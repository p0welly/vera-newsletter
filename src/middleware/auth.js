const db = require('../db');

async function requireOrg(req, res, next) {
  const header = req.headers['authorization'] || '';
  const apiKey = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!apiKey) {
    return res.status(401).json({ error: 'Authorization: Bearer <api-key> required' });
  }

  const { rows } = await db.query(
    'SELECT * FROM organisations WHERE api_key = $1 AND active = TRUE',
    [apiKey]
  );

  if (!rows[0]) {
    return res.status(401).json({ error: 'Invalid or inactive API key' });
  }

  req.org = rows[0];
  next();
}

module.exports = { requireOrg };
