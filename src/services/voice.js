const OpenAI = require('openai');

async function generateAudio(script) {
  const openai = new OpenAI();
  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',   // warm, clear — works well for older listeners
    input: script,
    speed: 0.9,      // slightly slower for clarity
  });
  return Buffer.from(await response.arrayBuffer());
}

module.exports = { generateAudio };
