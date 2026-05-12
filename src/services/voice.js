const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const openai = new OpenAI();
const audioDir = path.join(__dirname, '../../audio');

if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

async function generateAudio(script) {
  const filename = `${crypto.randomUUID()}.mp3`;
  const filepath = path.join(audioDir, filename);

  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',   // warm, clear — works well for older listeners
    input: script,
    speed: 0.9,      // slightly slower for clarity
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filepath, buffer);

  const publicUrl = `${process.env.APP_URL}/audio/${filename}`;
  return { filepath, publicUrl, filename };
}

function deleteAudio(filename) {
  try {
    const filepath = path.join(audioDir, filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  } catch (_) {}
}

module.exports = { generateAudio, deleteAudio };
