const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { rewriteForPhone } = require('../services/rewrite');
const { generateAudio, deleteAudio } = require('../services/voice');
const { initiateCall } = require('../services/calls');

const router = express.Router();

function verifyMailgunSignature(req) {
  const { timestamp, token, signature } = req.body;
  if (!timestamp || !token || !signature) return false;
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

// Extract inbound token from recipient address: newsletter-abc123@domain.com → abc123
function extractToken(recipient) {
  const local = recipient.split('@')[0];
  const match = local.match(/^newsletter-([a-f0-9]+)$/i);
  return match ? match[1] : null;
}

// POST /webhook/inbound — Mailgun inbound email
router.post('/inbound', express.urlencoded({ extended: true }), async (req, res) => {
  res.sendStatus(200);

  try {
    if (!verifyMailgunSignature(req)) {
      console.warn('Mailgun signature verification failed');
      return;
    }

    // Identify org from the recipient address (To header)
    const recipient = req.body.recipient || req.body['To'] || '';
    const token = extractToken(recipient);

    if (!token) {
      console.log(`No inbound token found in recipient: ${recipient}`);
      return;
    }

    const { rows: orgRows } = await db.query(
      'SELECT * FROM organisations WHERE inbound_token = $1 AND active = TRUE',
      [token]
    );

    if (!orgRows[0]) {
      console.log(`No active org found for token: ${token}`);
      return;
    }

    const org = orgRows[0];
    const sender = req.body.sender || req.body.from || '';
    const subject = req.body.subject || '(no subject)';
    const bodyHtml = req.body['body-html'] || '';
    const bodyText = req.body['body-plain'] || '';

    if (org.trusted_sender && !sender.includes(org.trusted_sender)) {
      console.log(`[${org.slug}] Ignored email from untrusted sender: ${sender}`);
      return;
    }

    const emailContent = bodyText || stripHtml(bodyHtml);
    if (!emailContent) return;

    console.log(`[${org.slug}] Processing newsletter: "${subject}"`);

    const script = await rewriteForPhone(subject, emailContent, org.name);
    const { publicUrl: audioUrl, filename } = await generateAudio(script);

    const sendResult = await db.query(
      `INSERT INTO sends (org_id, subject, original_content, rewritten_script, audio_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [org.id, subject, emailContent, script, audioUrl]
    );
    const sendId = sendResult.rows[0].id;

    const { rows: subscribers } = await db.query(
      'SELECT id, phone FROM subscribers WHERE org_id = $1 AND active = TRUE AND confirmed = TRUE',
      [org.id]
    );

    await db.query('UPDATE sends SET total_subscribers = $1 WHERE id = $2', [
      subscribers.length,
      sendId,
    ]);

    console.log(`[${org.slug}] Calling ${subscribers.length} subscribers`);

    for (const sub of subscribers) {
      try {
        const callSid = await initiateCall(sub.phone, sendId, sub.id, audioUrl);
        await db.query(
          `INSERT INTO call_log (send_id, subscriber_id, twilio_call_sid, status)
           VALUES ($1, $2, $3, 'initiated')`,
          [sendId, sub.id, callSid]
        );
      } catch (err) {
        console.error(`[${org.slug}] Failed to call ${sub.phone}:`, err.message);
        await db.query(
          `INSERT INTO call_log (send_id, subscriber_id, status) VALUES ($1, $2, 'failed')`,
          [sendId, sub.id]
        );
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    setTimeout(() => deleteAudio(filename), 2 * 60 * 60 * 1000);
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
});

module.exports = router;
