const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

async function rewriteForPhone(subject, emailText) {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: `You are converting a community newsletter into a warm, friendly phone message for an older person.

Rules:
- Natural spoken English only — write exactly as someone would say it aloud
- No bullet points, no links, no email formatting, no jargon
- Maximum 200 words (about 90 seconds when spoken)
- Start with: "Hello, this is a message from ${process.env.ORG_NAME}."
- End with: "That's all for today. Goodbye."
- Friendly but not patronising
- If the newsletter is too long, summarise the key points warmly
- Convert dates to natural speech: "the fourteenth of June" not "14/06"`,
    messages: [
      {
        role: 'user',
        content: `Subject: ${subject}\n\n${emailText}`,
      },
    ],
  });

  return message.content[0].text;
}

module.exports = { rewriteForPhone };
