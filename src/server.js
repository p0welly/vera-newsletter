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

// Serve generated audio files publicly (Twilio needs to fetch them)
app.use('/audio', express.static(path.join(__dirname, '../audio')));

app.use('/webhook', webhookRouter);
app.use('/twiml', twimlRouter);
app.use('/subscribers', subscriberRouter);
app.use('/test', testRouter);
app.use('/admin', adminRouter);

// Start listening immediately so health check passes
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
