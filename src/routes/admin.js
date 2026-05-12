const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

// All admin routes require the ADMIN_KEY env var
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Invalid admin key' });
  }
  next();
}

// POST /admin/orgs — create a new organisation
router.post('/orgs', express.json(), requireAdmin, async (req, res) => {
  const { name, slug, trusted_sender } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ error: 'name and slug required' });
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'slug must be lowercase letters, numbers, hyphens only' });
  }

  const apiKey = crypto.randomBytes(32).toString('hex');
  const inboundToken = crypto.randomBytes(12).toString('hex');

  try {
    const { rows } = await db.query(
      `INSERT INTO organisations (name, slug, api_key, inbound_token, trusted_sender)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, slug, api_key, inbound_token, trusted_sender, created_at`,
      [name, slug, apiKey, inboundToken, trusted_sender || null]
    );

    const org = rows[0];
    const inboundEmail = `newsletter-${org.inbound_token}@${process.env.INBOUND_DOMAIN}`;

    res.status(201).json({
      ...org,
      inbound_email: inboundEmail,
      note: 'Save the api_key now — it cannot be retrieved again.',
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'slug already exists' });
    }
    console.error('Create org error:', err);
    res.status(500).json({ error: 'Failed to create organisation' });
  }
});

// GET /admin/orgs — list all organisations
router.get('/orgs', requireAdmin, async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, name, slug, inbound_token, trusted_sender, active, created_at,
            'newsletter-' || inbound_token || '@' || $1 AS inbound_email
     FROM organisations ORDER BY created_at DESC`,
    [process.env.INBOUND_DOMAIN]
  );
  res.json(rows);
});

// PATCH /admin/orgs/:id — update name, trusted_sender, or active status
router.patch('/orgs/:id', express.json(), requireAdmin, async (req, res) => {
  const { name, trusted_sender, active } = req.body;
  const { id } = req.params;

  await db.query(
    `UPDATE organisations SET
       name = COALESCE($1, name),
       trusted_sender = COALESCE($2, trusted_sender),
       active = COALESCE($3, active)
     WHERE id = $4`,
    [name || null, trusted_sender || null, active ?? null, id]
  );

  res.json({ ok: true });
});

module.exports = router;
