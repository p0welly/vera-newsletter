const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendConfirmation(toEmail, phone) {
  await resend.emails.send({
    from: `${process.env.ORG_NAME} <${process.env.FROM_EMAIL}>`,
    to: toEmail,
    subject: `You're signed up for phone calls from ${process.env.ORG_NAME}`,
    text: `Hi,

You've been signed up to receive phone calls from ${process.env.ORG_NAME}.

When we send our newsletter, we'll call ${phone} and read it to you.

To unsubscribe at any time, either:
- Press 9 during a call
- Reply to this email

Thanks,
${process.env.ORG_NAME}`,
  });
}

async function sendUnsubscribeConfirmation(toEmail) {
  await resend.emails.send({
    from: `${process.env.ORG_NAME} <${process.env.FROM_EMAIL}>`,
    to: toEmail,
    subject: `You've been unsubscribed from ${process.env.ORG_NAME} phone calls`,
    text: `Hi,

You've been unsubscribed and won't receive any more calls from us.

If this was a mistake, just reply and we'll get you back on the list.

Thanks,
${process.env.ORG_NAME}`,
  });
}

module.exports = { sendConfirmation, sendUnsubscribeConfirmation };
