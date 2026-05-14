const express = require('express');
const twilio = require('twilio');
const db = require('../db');
const { sendUnsubscribeConfirmation } = require('../services/email');

const router = express.Router();

// Twilio calls this URL when the call connects — returns TwiML to play the audio
router.get('/play', (req, res) => {
  const { audioUrl, sendId, subscriberId } = req.query;

  if (!audioUrl) {
    res.type('text/xml');
    res.send('<Response><Say>Sorry, something went wrong. Goodbye.</Say></Response>');
    return;
  }

  const twiml = new twilio.twiml.VoiceResponse();

  twiml.play(audioUrl);

  const gather = twiml.gather({ numDigits: '1', action: `/twiml/keypress?sendId=${sendId}&subscriberId=${subscriberId}`, method: 'POST', timeout: 5 });
  gather.say({ voice: 'Polly.Amy', language: 'en-GB' }, "This was Vera. To hear the message again, press 1. To stop receiving calls from Vera, press 9.");

  res.type('text/xml');
  res.send(twiml.toString());
});

// Handles keypress after message plays
router.post('/keypress', express.urlencoded({ extended: false }), async (req, res) => {
  const { sendId, subscriberId } = req.query;
  const digit = req.body.Digits;
  const twiml = new twilio.twiml.VoiceResponse();

  if (digit === '9') {
    // Unsubscribe
    try {
      await db.query('UPDATE subscribers SET active = FALSE WHERE id = $1', [subscriberId]);

      const { rows } = await db.query(
        `SELECT s.email, s.phone, o.name AS org_name
         FROM subscribers s JOIN organisations o ON o.id = s.org_id
         WHERE s.id = $1`,
        [subscriberId]
      );
      if (rows[0]) {
        await sendUnsubscribeConfirmation(rows[0].email, rows[0].org_name).catch(() => {});
        await db.query(
          'UPDATE call_log SET unsubscribed = TRUE WHERE send_id = $1 AND subscriber_id = $2',
          [sendId, subscriberId]
        );
      }
      twiml.say({ voice: 'Polly.Amy', language: 'en-GB' }, "You've been unsubscribed. Vera won't call again. Goodbye.");
    } catch (err) {
      console.error('Unsubscribe error:', err);
      twiml.say({ voice: 'Polly.Amy', language: 'en-GB' }, "Sorry, Vera couldn't process that. Please contact us directly to unsubscribe. Goodbye.");
    }
  } else if (digit === '1') {
    // Replay — redirect back to the play endpoint
    twiml.redirect({ method: 'GET' }, `/twiml/play?audioUrl=${encodeURIComponent(req.query.audioUrl || '')}&sendId=${sendId}&subscriberId=${subscriberId}`);
  } else {
    twiml.say({ voice: 'Polly.Amy', language: 'en-GB' }, 'Goodbye.');
  }

  twiml.hangup();

  res.type('text/xml');
  res.send(twiml.toString());
});

// Twilio posts call status updates here
router.post('/status', express.urlencoded({ extended: false }), async (req, res) => {
  const { CallSid, CallStatus, CallDuration } = req.body;

  try {
    await db.query(
      `UPDATE call_log SET status = $1, duration_secs = $2, updated_at = NOW()
       WHERE twilio_call_sid = $3`,
      [CallStatus, parseInt(CallDuration) || null, CallSid]
    );
  } catch (err) {
    console.error('Status callback error:', err);
  }

  res.sendStatus(200);
});

// Answering machine detection — skip message if machine detected
router.post('/amd', express.urlencoded({ extended: false }), async (req, res) => {
  const { CallSid, AnsweredBy } = req.body;
  console.log(`AMD result for ${CallSid}: ${AnsweredBy}`);

  // machine_start = answering machine picked up immediately
  // fax = fax machine
  if (AnsweredBy === 'machine_start' || AnsweredBy === 'fax') {
    try {
      // Hang up — don't leave robotic voicemails
      const twClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await twClient.calls(CallSid).update({ status: 'completed' });
      await db.query("UPDATE call_log SET status = 'machine' WHERE twilio_call_sid = $1", [CallSid]);
    } catch (err) {
      console.error('AMD hangup error:', err);
    }
  }

  res.sendStatus(200);
});

module.exports = router;
