require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');
const webhookRouter = require('./routes/webhook');
const twimlRouter = require('./routes/twiml');
const subscriberRouter = require('./routes/subscribers');
const testRouter = require('./routes/test');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve generated audio files publicly (Twilio needs to fetch them)
app.use('/audio', express.static(path.join(__dirname, '../audio')));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/webhook', webhookRouter);
app.use('/twiml', twimlRouter);
app.use('/subscribers', subscriberRouter);
app.use('/test', testRouter);

async function start() {
  // Run schema on startup — idempotent, safe to re-run
  const fs = require('fs');
  const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
  await db.query(schema);
  console.log('Database schema ready');

  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
