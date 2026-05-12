const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { rewriteForPhone } = require('../services/rewrite');
const { generateAudio, deleteAudio } = require('../services/voice');
const { initiateCall } = require('../services/calls');

const router = express.Router();

// Mailgun signs each webhook — verify before processing
function verifyMailgunSignature(req) {
  const { timestamp, token, signature } = req.body;
  if (!timestamp || !token || !signature) return false;

  // Reject if timestamp is more than 5 minutes old
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;

  const hash = crypto
    .createHmac('sha256', process.env.MAILGUN_SIGNING_KEY)
    .update(timestamp + token)
    .digest('hex');

  return hash === signature;
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// POST /webhook/inbound — Mailgun inbound email
router.post('/inbound', express.urlencoded({ extended: true }), async (req, res) => {
  // Acknowledge immediately — Mailgun retries if it doesn't get 200 within 25s
  res.sendStatus(200);

  try {
    if (!verifyMailgunSignature(req)) {
      console.warn('Mailgun signature verification failed');
      return;
    }

    const sender = req.body.sender || req.body.from || '';
    const subject = req.body.subject || '(no subject)';
    const bodyHtml = req.body['body-html'] || '';
    const bodyText = req.body['body-plain'] || '';

    // Optionally restrict to a trusted sender address
    if (process.env.TRUSTED_SENDER && !sender.includes(process.env.TRUSTED_SENDER)) {
      console.log(`Ignored email from untrusted sender: ${sender}`);
      return;
    }

    const emailContent = bodyText || stripHtml(bodyHtml);
    if (!emailContent) {
      console.log('Empty email body, skipping');
      return;
    }

    console.log(`Processing newsletter: "${subject}"`);

    // 1. Rewrite with Claude
    const script = await rewriteForPhone(subject, emailContent);
    console.log('Script:', script);

    // 2. Generate audio once — shared by all subscribers
    const { publicUrl: audioUrl, filename } = await generateAudio(script);
    console.log('Audio generated:', audioUrl);

    // 3. Record the send
    const sendResult = await db.query(
      `INSERT INTO sends (subject, original_content, rewritten_script, audio_url)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [subject, emailContent, script, audioUrl]
    );
    const sendId = sendResult.rows[0].id;

    // 4. Get active, confirmed subscribers
    const { rows: subscribers } = await db.query(
      'SELECT id, phone FROM subscribers WHERE active = TRUE AND confirmed = TRUE'
    );

    await db.query('UPDATE sends SET total_subscribers = $1 WHERE id = $2', [
      subscribers.length,
      sendId,
    ]);

    console.log(`Calling ${subscribers.length} subscribers`);

    // 5. Call each subscriber with a short delay between calls
    for (const sub of subscribers) {
      try {
        const callSid = await initiateCall(sub.phone, sendId, sub.id, audioUrl);
        await db.query(
          `INSERT INTO call_log (send_id, subscriber_id, twilio_call_sid, status)
           VALUES ($1, $2, $3, 'initiated')`,
          [sendId, sub.id, callSid]
        );
        console.log(`Call initiated to ${sub.phone}: ${callSid}`);
      } catch (err) {
        console.error(`Failed to call ${sub.phone}:`, err.message);
        await db.query(
          `INSERT INTO call_log (send_id, subscriber_id, status) VALUES ($1, $2, 'failed')`,
          [sendId, sub.id]
        );
      }

      // 2 second gap between calls — avoids Twilio rate limits
      await new Promise((r) => setTimeout(r, 2000));
    }

    // 6. Keep audio for 2 hours then delete (calls may still be in-flight)
    setTimeout(() => deleteAudio(filename), 2 * 60 * 60 * 1000);
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
});

module.exports = router;
