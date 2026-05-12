const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendConfirmation(toEmail, phone, orgName) {
  await resend.emails.send({
    from: `${orgName} <${process.env.FROM_EMAIL}>`,
    to: toEmail,
    subject: `Vera will be calling you from ${orgName}`,
    text: `Hi,

You've been signed up to receive phone calls from ${orgName}.

When we send our newsletter, Vera will call ${phone} and read it to you.

To unsubscribe at any time, either:
- Press 9 during one of Vera's calls
- Reply to this email

Thanks,
${orgName}`,
  });
}

async function sendUnsubscribeConfirmation(toEmail, orgName) {
  await resend.emails.send({
    from: `${orgName} <${process.env.FROM_EMAIL}>`,
    to: toEmail,
    subject: `Vera won't be calling anymore`,
    text: `Hi,

You've been unsubscribed. Vera won't call again.

If this was a mistake, just reply and we'll get you back on the list.

Thanks,
${orgName}`,
  });
}

module.exports = { sendConfirmation, sendUnsubscribeConfirmation };
