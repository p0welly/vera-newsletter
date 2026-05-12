const express = require('express');
const db = require('../db');
const { rewriteForPhone } = require('../services/rewrite');
const { generateAudio, deleteAudio } = require('../services/voice');
const { initiateCall } = require('../services/calls');

const router = express.Router();

const SAMPLE_NEWSLETTER = `
Welcome to the Inclusive Bytes community newsletter for May.

This month we've been busy setting up our new Tuesday afternoon drop-in sessions
at the library on Church Street. They run from two until four o'clock and are
completely free. No booking needed — just turn up with your questions.

We're also pleased to announce that our annual summer lunch will be held on the
twenty-first of June at the Crown Hotel. Tickets are five pounds and include a
two-course meal. Call Janet on 01234 567890 to reserve your place.

Finally, a reminder that our phone helpline is available Monday to Friday,
nine in the morning until five in the afternoon, if you ever need a hand with
anything technology related.

See you soon.
`;

// POST /test/call
// Body: { phone: "+447712345678", content: "optional custom text" }
router.post('/call', express.json(), async (req, res) => {
  const { phone, content } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'phone required (E.164 format, e.g. +447712345678)' });
  }

  try {
    res.json({ ok: true, message: 'Call chain started — you should receive a call within 30 seconds.' });

    const emailContent = content || SAMPLE_NEWSLETTER;
    const subject = 'Test Newsletter — May Edition';

    console.log(`[TEST] Rewriting script for ${phone}`);
    const script = await rewriteForPhone(subject, emailContent);
    console.log(`[TEST] Script:\n${script}`);

    const { publicUrl: audioUrl, filename } = await generateAudio(script);
    console.log(`[TEST] Audio: ${audioUrl}`);

    const sendResult = await db.query(
      `INSERT INTO sends (subject, original_content, rewritten_script, audio_url, total_subscribers)
       VALUES ($1, $2, $3, $4, 1) RETURNING id`,
      [subject, emailContent, script, audioUrl]
    );
    const sendId = sendResult.rows[0].id;

    const callSid = await initiateCall(phone, sendId, null, audioUrl);
    console.log(`[TEST] Call SID: ${callSid}`);

    await db.query(
      `INSERT INTO call_log (send_id, twilio_call_sid, status) VALUES ($1, $2, 'initiated')`,
      [sendId, callSid]
    );

    // Clean up audio after 2 hours
    setTimeout(() => deleteAudio(filename), 2 * 60 * 60 * 1000);
  } catch (err) {
    console.error('[TEST] Error:', err);
  }
});

module.exports = router;
