# Phone Newsletter — Setup Guide

## How it works

1. Newsletter sender emails to your Mailgun inbound address
2. Mailgun sends a webhook to your Railway app
3. Claude (Haiku) rewrites it as a warm 90-second phone script
4. OpenAI TTS generates one MP3, stored temporarily on your server
5. Twilio calls every subscriber and plays it
6. Subscribers press 1 to replay or 9 to unsubscribe
7. Resend emails confirmation when someone subscribes or unsubscribes

---

## 1. Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
3. Add a **PostgreSQL** plugin to the project
4. Railway auto-sets `DATABASE_URL` — no action needed
5. Set environment variables (see below)

---

## 2. Domain + Mailgun inbound

You need a domain with MX records pointed at Mailgun for inbound routing.

1. Sign up at [mailgun.com](https://www.mailgun.com)
2. Add your domain → follow their DNS setup (MX records)
3. Go to **Receiving** → Create a Route:
   - Expression: `match_recipient("newsletter@yourdomain.com")` (or `catch_all()`)
   - Action: **Forward** → `https://your-app.up.railway.app/webhook/inbound`
4. Get your **HTTP Webhook Signing Key** from Settings → Security → Webhook Signing Key
5. Set `MAILGUN_SIGNING_KEY` in Railway env vars

The MX records are what point `@yourdomain.com` at Mailgun's servers. Your registrar's DNS panel is where you set these.

---

## 3. Twilio

1. Sign up at [twilio.com](https://www.twilio.com)
2. Buy a UK phone number (Voice-enabled)
3. Note your Account SID, Auth Token, and phone number
4. No webhook config needed — the app passes its URL to Twilio per-call

---

## 4. Anthropic (Claude)

1. Go to [console.anthropic.com](https://console.anthropic.com) → API Keys
2. Create a key, copy it into `ANTHROPIC_API_KEY`

---

## 5. OpenAI (TTS)

1. Go to [platform.openai.com](https://platform.openai.com) → API Keys
2. Create a key, copy it into `OPENAI_API_KEY`

---

## 6. Resend

1. Sign up at [resend.com](https://resend.com)
2. Add and verify your sending domain
3. Create an API key → `RESEND_API_KEY`
4. Set `FROM_EMAIL` to an address on your verified domain

---

## Environment variables (Railway)

| Variable | Where to find it |
|---|---|
| `MAILGUN_SIGNING_KEY` | Mailgun → Settings → Security → Webhook Signing Key |
| `NEWSLETTER_FROM_ADDRESS` | The email address your newsletter arrives from |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `OPENAI_API_KEY` | platform.openai.com |
| `TWILIO_ACCOUNT_SID` | Twilio Console |
| `TWILIO_AUTH_TOKEN` | Twilio Console |
| `TWILIO_PHONE_NUMBER` | Your Twilio number in E.164: `+441234567890` |
| `RESEND_API_KEY` | resend.com |
| `FROM_EMAIL` | e.g. `hello@yourdomain.com` |
| `ORG_NAME` | e.g. `Inclusive Bytes` |
| `APP_URL` | Your Railway URL, no trailing slash |
| `TRUSTED_SENDER` | Optional: only process emails from this address |

---

## Adding subscribers

POST to `/subscribers`:
```bash
curl -X POST https://your-app.up.railway.app/subscribers \
  -H "Content-Type: application/json" \
  -d '{"email": "07712345678@yourdomain.com", "name": "Margaret"}'
```

The phone number is extracted from the email address automatically.

---

## Sending a newsletter

Just email `newsletter@yourdomain.com` from your trusted sender. Everything else is automatic.

---

## Costs (per newsletter send, 50 subscribers)

| | Cost |
|---|---|
| Claude Haiku rewrite | ~$0.001 |
| OpenAI TTS (one audio file) | ~$0.02 |
| Twilio calls (3 min avg, UK landline) | ~£2.00 |
| **Total** | **~£2** |

Upgrade to ElevenLabs for a warmer voice: replace `src/services/voice.js` — cost rises to ~£20/send but the difference is noticeable.
