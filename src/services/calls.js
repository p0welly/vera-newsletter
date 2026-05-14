const twilio = require('twilio');

async function initiateCall(toNumber, sendId, subscriberId, audioUrl) {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const twimlUrl = `${process.env.APP_URL}/twiml/play?` + new URLSearchParams({
    audioUrl,
    sendId,
    subscriberId,
  });

  const call = await client.calls.create({
    to: toNumber,
    from: process.env.TWILIO_PHONE_NUMBER,
    url: twimlUrl,
    method: 'GET',
    statusCallback: `${process.env.APP_URL}/twiml/status`,
    statusCallbackEvent: ['completed', 'failed', 'no-answer', 'busy'],
    statusCallbackMethod: 'POST',
    machineDetection: 'DetectMessageEnd',
    asyncAmd: 'true',
    asyncAmdStatusCallback: `${process.env.APP_URL}/twiml/amd`,
    asyncAmdStatusCallbackMethod: 'POST',
    timeout: 30,
  });

  return call.sid;
}

module.exports = { initiateCall };
