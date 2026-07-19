# WhatsApp AI Shop Assistant

> MVP built in a 2-day hackathon. Kirana stores managed entirely via WhatsApp + AI.

---

## Session 1 Setup (Do this now)

### 1. Install dependencies
```bash
npm install
```

### 2. Copy env file
```bash
cp .env.example .env
```
Then fill in your values (see below).

### 3. Start the server
```bash
npm run dev
```

### 4. Expose to internet (for Meta webhook)

**Option A — ngrok (fastest for dev)**
```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3000
# Copy the https URL, e.g. https://abc123.ngrok-free.app
```

**Option B — Railway (free, persistent URL)**
```bash
# Push to GitHub, connect repo to railway.app
# Deploy → get URL like https://whatsapp-shop-production.up.railway.app
```

### 5. Configure Meta webhook
1. Go to developers.facebook.com → Your App → WhatsApp → Configuration
2. Set **Callback URL**: `https://your-url.com/webhook`
3. Set **Verify token**: same as `WEBHOOK_VERIFY_TOKEN` in your `.env`
4. Click **Verify and Save**
5. Subscribe to **messages** field

### 6. Test the round-trip
Send any message to your WhatsApp test number.
You should see: `✅ Bot received: "your message"`

---

## Environment Variables

| Variable | Where to get it |
|---|---|
| `META_ACCESS_TOKEN` | developers.facebook.com → WhatsApp → API Setup |
| `META_PHONE_NUMBER_ID` | Same page as above |
| `WEBHOOK_VERIFY_TOKEN` | You choose any string — enter same in Meta dashboard |
| `SUPABASE_URL` | supabase.com → Project Settings → API |
| `SUPABASE_ANON_KEY` | Same page as above |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `OPENAI_API_KEY` | platform.openai.com |

---

## Project Structure

```
src/
  index.js              ← Express server entry point
  routes/
    webhook.js          ← GET (verify) + POST (messages)
  handlers/
    webhookHandler.js   ← Core message routing logic
  services/
    whatsapp.js         ← Meta Cloud API wrapper
    claude.js           ← AI + RAG (Session 3)
    supabase.js         ← DB client (Session 2)
  middleware/
    auth.js             ← Phone lookup + subscription check (Session 2)
  handlers/
    intentHandlers.js   ← add_stock, check_stock, etc. (Session 4)
scripts/
  migrate.sql           ← Run in Supabase SQL Editor
```

---

## Roadmap Progress

- [x] Session 1 — Webhook server + first reply
- [ ] Session 2 — Database + Auth layer
- [ ] Session 3 — Claude AI + RAG
- [ ] Session 4 — Action handlers
- [ ] Session 5 — RAGAS evaluation
- [ ] Session 6 — Low stock alerts + Ledger
- [ ] Session 7 — Razorpay subscription
- [ ] Session 8 — Voice + Dashboard
- [ ] Session 9 — Polish + Demo prep
