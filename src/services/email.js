const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendConfirmation(toEmail, phone) {
  await resend.emails.send({
    from: `${process.env.ORG_NAME} <${process.env.FROM_EMAIL}>`,
    to: toEmail,
    subject: `Vera will be calling you from ${process.env.ORG_NAME}`,
    text: `Hi,

You've been signed up to receive phone calls from ${process.env.ORG_NAME}.

When we send our newsletter, Vera will call ${phone} and read it to you.

To unsubscribe at any time, either:
- Press 9 during one of Vera's calls
- Reply to this email

Thanks,
${process.env.ORG_NAME}`,
  });
}

async function sendUnsubscribeConfirmation(toEmail) {
  await resend.emails.send({
    from: `${process.env.ORG_NAME} <${process.env.FROM_EMAIL}>`,
    to: toEmail,
    subject: `Vera won't be calling anymore`,
    text: `Hi,

You've been unsubscribed. Vera won't call again.

If this was a mistake, just reply and we'll get you back on the list.

Thanks,
${process.env.ORG_NAME}`,
  });
}

module.exports = { sendConfirmation, sendUnsubscribeConfirmation };
