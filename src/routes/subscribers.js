const express = require('express');
const db = require('../db');
const { requireOrg } = require('../middleware/auth');
const { sendConfirmation } = require('../services/email');

const router = express.Router();

function normaliseUKPhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('07') && digits.length === 11) return '+44' + digits.slice(1);
  if (digits.startsWith('447') && digits.length === 12) return '+' + digits;
  if (digits.startsWith('44') && digits.length === 12) return '+' + digits;
  return null;
}

function phoneFromEmail(email) {
  const local = email.split('@')[0];
  return normaliseUKPhone(local);
}

// All routes require a valid org API key
router.use(requireOrg);

// POST /subscribers — add a subscriber to this org
router.post('/', express.json(), async (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  const phone = phoneFromEmail(email);
  if (!phone) {
    return res.status(400).json({
      error: 'Email must start with a valid UK phone number, e.g. 07712345678@yourdomain.com',
    });
  }

  try {
    await db.query(
      `INSERT INTO subscribers (org_id, email, phone, name, confirmed)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (org_id, email) DO UPDATE SET active = TRUE, name = COALESCE($4, subscribers.name)`,
      [req.org.id, email.toLowerCase(), phone, name || null]
    );

    await sendConfirmation(email, phone, req.org.name).catch((err) =>
      console.error('Confirmation email failed:', err.message)
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

  await db.query(
    'UPDATE subscribers SET active = FALSE WHERE org_id = $1 AND email = $2',
    [req.org.id, email.toLowerCase()]
  );
  res.json({ ok: true });
});

// GET /subscribers — list this org's subscribers
router.get('/', async (req, res) => {
  const { rows } = await db.query(
    'SELECT id, email, phone, name, active, confirmed, created_at FROM subscribers WHERE org_id = $1 ORDER BY created_at DESC',
    [req.org.id]
  );
  res.json(rows);
});

// GET /subscribers/sends — send history for this org
router.get('/sends', async (req, res) => {
  const { rows } = await db.query(
    `SELECT
       s.id, s.subject, s.sent_at, s.total_subscribers,
       COUNT(cl.id) FILTER (WHERE cl.status = 'completed') AS answered,
       COUNT(cl.id) FILTER (WHERE cl.status IN ('failed','no-answer','busy')) AS missed,
       COUNT(cl.id) FILTER (WHERE cl.unsubscribed = TRUE) AS unsubscribed
     FROM sends s
     LEFT JOIN call_log cl ON cl.send_id = s.id
     WHERE s.org_id = $1
     GROUP BY s.id
     ORDER BY s.sent_at DESC
     LIMIT 50`,
    [req.org.id]
  );
  res.json(rows);
});

module.exports = router;
