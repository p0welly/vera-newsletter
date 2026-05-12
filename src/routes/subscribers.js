const express = require('express');
const db = require('../db');
const { sendConfirmation } = require('../services/email');

const router = express.Router();

// Normalise UK phone numbers to E.164 format (+447...)
function normaliseUKPhone(raw) {
  const digits = raw.replace(/\D/g, '');

  if (digits.startsWith('07') && digits.length === 11) {
    return '+44' + digits.slice(1);
  }
  if (digits.startsWith('447') && digits.length === 12) {
    return '+' + digits;
  }
  if (digits.startsWith('44') && digits.length === 12) {
    return '+' + digits;
  }
  return null;
}

// Extract phone from email local part: 07712345678@domain.com → 07712345678
function phoneFromEmail(email) {
  const local = email.split('@')[0];
  return normaliseUKPhone(local);
}

// POST /subscribers — add a subscriber
router.post('/', express.json(), async (req, res) => {
  const { email, name } = req.body;

  if (!email) return res.status(400).json({ error: 'email required' });

  const phone = phoneFromEmail(email);
  if (!phone) {
    return res.status(400).json({
      error: 'Email address must start with a valid UK phone number, e.g. 07712345678@yourdomain.com',
    });
  }

  try {
    await db.query(
      `INSERT INTO subscribers (email, phone, name, confirmed)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (email) DO UPDATE SET active = TRUE, name = COALESCE($3, subscribers.name)`,
      [email.toLowerCase(), phone, name || null]
    );

    await sendConfirmation(email, phone).catch((err) =>
      console.error('Failed to send confirmation email:', err.message)
    );

    res.json({ ok: true, phone });
  } catch (err) {
    console.error('Add subscriber error:', err);
    res.status(500).json({ error: 'Failed to add subscriber' });
  }
});

// DELETE /subscribers — remove by email
router.delete('/', express.json(), async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  await db.query('UPDATE subscribers SET active = FALSE WHERE email = $1', [email.toLowerCase()]);
  res.json({ ok: true });
});

// GET /subscribers — list all (admin use)
router.get('/', async (req, res) => {
  const { rows } = await db.query(
    'SELECT id, email, phone, name, active, confirmed, created_at FROM subscribers ORDER BY created_at DESC'
  );
  res.json(rows);
});

// GET /subscribers/sends — history of sends and call outcomes
router.get('/sends', async (req, res) => {
  const { rows } = await db.query(`
    SELECT
      s.id, s.subject, s.sent_at, s.total_subscribers,
      COUNT(cl.id) FILTER (WHERE cl.status = 'completed') AS answered,
      COUNT(cl.id) FILTER (WHERE cl.status IN ('failed', 'no-answer', 'busy')) AS missed,
      COUNT(cl.id) FILTER (WHERE cl.unsubscribed = TRUE) AS unsubscribed
    FROM sends s
    LEFT JOIN call_log cl ON cl.send_id = s.id
    GROUP BY s.id
    ORDER BY s.sent_at DESC
    LIMIT 50
  `);
  res.json(rows);
});

module.exports = router;
