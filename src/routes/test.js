const express = require('express');
const db = require('../db');
const { requireOrg } = require('../middleware/auth');
const { rewriteForPhone } = require('../services/rewrite');
const { generateAudio } = require('../services/voice');
const { initiateCall } = require('../services/calls');

const router = express.Router();

const SAMPLE_NEWSLETTER = `
Welcome to the community newsletter for May.

This month we've been busy setting up our new Tuesday afternoon drop-in sessions
at the library on Church Street. They run from two until four o'clock and are
completely free. No booking needed — just turn up with your questions.

We're also pleased to announce that our annual summer lunch will be held on the
twenty-first of June at the Crown Hotel. Tickets are five pounds and include a
two-course meal. Call Janet on 01234 567890 to reserve your place.

Finally, a reminder that our phone helpline is available Monday to Friday,
nine in the morning until five in the afternoon, if you ever need a hand.

See you soon.
`;

function normalisePhone(raw) {
  if (!raw) return null;
  // Already E.164
  if (/^\+\d{10,15}$/.test(raw)) return raw;
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('07') && digits.length === 11) return '+44' + digits.slice(1);
  if (digits.startsWith('447') && digits.length === 12) return '+' + digits;
  if (digits.startsWith('44') && digits.length === 12) return '+' + digits;
  return null;
}

// POST /test/call — fire the full chain for one phone number
// Requires org API key. Body: { phone: "+447712345678", content: "optional" }
router.post('/call', express.json(), requireOrg, async (req, res) => {
  const { phone: rawPhone, content } = req.body;
  const phone = normalisePhone(rawPhone);

  if (!phone) {
    return res.status(400).json({ error: 'phone required — UK mobile (07...) or E.164 (+447...)' });
  }

  res.json({ ok: true, org: req.org.name, phone, message: 'Call chain started — Vera should ring within 30 seconds.' });

  try {
    const emailContent = content || SAMPLE_NEWSLETTER;
    const subject = 'Test Newsletter — May Edition';

    console.log(`[TEST][${req.org.slug}] Rewriting for ${phone}`);
    const script = await rewriteForPhone(subject, emailContent, req.org.name);
    console.log(`[TEST][${req.org.slug}] Script ready (${script.length} chars)`);

    const audioBuffer = await generateAudio(script);
    console.log(`[TEST][${req.org.slug}] Audio generated (${audioBuffer.length} bytes)`);

    const sendResult = await db.query(
      `INSERT INTO sends (org_id, subject, original_content, rewritten_script, audio_data, total_subscribers)
       VALUES ($1, $2, $3, $4, $5, 1) RETURNING id`,
      [req.org.id, subject, emailContent, script, audioBuffer]
    );
    const sendId = sendResult.rows[0].id;
    const audioUrl = `${process.env.APP_URL}/audio/${sendId}`;
    console.log(`[TEST][${req.org.slug}] Audio URL: ${audioUrl}`);

    const callSid = await initiateCall(phone, sendId, null, audioUrl);
    console.log(`[TEST][${req.org.slug}] Call SID: ${callSid}`);

    await db.query(
      `INSERT INTO call_log (send_id, twilio_call_sid, status) VALUES ($1, $2, 'initiated')`,
      [sendId, callSid]
    );
  } catch (err) {
    console.error(`[TEST][${req.org.slug}] Error:`, err);
  }
});

module.exports = router;
