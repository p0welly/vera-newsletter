process.on('uncaughtException', (err) => console.error('UNCAUGHT EXCEPTION:', err));
process.on('unhandledRejection', (err) => console.error('UNHANDLED REJECTION:', err));

console.log('Starting Vera server...');
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const webhookRouter = require('./routes/webhook');
const twimlRouter = require('./routes/twiml');
const subscriberRouter = require('./routes/subscribers');
const testRouter = require('./routes/test');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

let dbReady = false;

// Health check responds immediately
app.get('/health', (req, res) => res.json({ ok: true, db: dbReady }));

// Serve audio from DB — survives deploys, no ephemeral filesystem dependency
app.get('/audio/:sendId', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT audio_data FROM sends WHERE id = $1', [req.params.sendId]);
    if (!rows[0] || !rows[0].audio_data) return res.status(404).send('Audio not found');
    res.type('audio/mpeg');
    res.send(rows[0].audio_data);
  } catch (err) {
    console.error('Audio serve error:', err);
    res.status(500).send('Error');
  }
});

// Web UI
app.use(express.static(path.join(__dirname, '../public')));

app.use('/webhook', webhookRouter);
app.use('/twiml', twimlRouter);
app.use('/subscribers', subscriberRouter);
app.use('/test', testRouter);
app.use('/admin', adminRouter);

// Start listening immediately so health check passes
console.log(`Binding to port ${PORT}...`);
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

async function initDb() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
    await db.query(schema);
    dbReady = true;
    console.log('Database schema ready');
  } catch (err) {
    console.error('Database init failed (check DATABASE_URL env var):', err.message);
  }
}

initDb();
