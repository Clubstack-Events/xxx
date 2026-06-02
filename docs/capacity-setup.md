# Capacity Tracking Setup

Two things to configure before capacity tracking works: Vercel KV and the Stripe webhook secret.

---

## 1. Upstash Redis

### Provision the store

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard) and open the `ditp-june6` project.
2. Click the **Storage** tab → **Connect Store** → select **Upstash Redis**.
3. Follow the prompts to create or connect a database. Vercel will automatically add the env vars to your project.

### Add env vars locally

The Vercel env pull doesn't always include marketplace integration vars. Grab the values directly from the Upstash dashboard or the Vercel project **Settings → Environment Variables** and add them to `.env.local`:

```
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

### Production

Vars added via the Vercel/Upstash integration are automatically available in production deployments with no extra steps.

---

## 2. Stripe Webhook Secret

The webhook secret proves that incoming requests to `/api/webhook` actually came from Stripe.

### Local development

Install the Stripe CLI if you haven't:

```bash
brew install stripe/stripe-cli/stripe
stripe login
```

Forward events to your local server:

```bash
stripe listen --forward-to localhost:3005/api/webhook
```

The CLI prints a webhook signing secret like `whsec_...`. Copy it and add to `.env.local`:

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

Leave `stripe listen` running in a separate terminal while developing. Every time you restart it, the secret changes — update `.env.local` accordingly.

To test that a completed checkout fires the webhook correctly:

```bash
stripe trigger checkout.session.completed
```

This sends a synthetic event; check your Next.js dev server logs for the response.

### Production

1. Go to [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks) → **Add endpoint**.
2. Set the endpoint URL to `https://your-domain.clubstack.studio/api/webhook`.
3. Under **Events to send**, select `checkout.session.completed` only.
4. Click **Add endpoint** → copy the **Signing secret** (`whsec_...`).
5. In your Vercel project → **Settings** → **Environment Variables**, add:
   - Key: `STRIPE_WEBHOOK_SECRET`
   - Value: the signing secret from step 4
   - Environment: Production (and Preview if you want)
6. Redeploy (or trigger a new deployment) for the variable to take effect.

---

## Verify everything is working

After both are set up, hit the availability endpoint directly to confirm KV is connected:

```bash
curl http://localhost:3005/api/availability
```

Expected response (all slots empty):

```json
{
  "outbound": {
    "10:30pm": { "id": "10:30pm", "booked": 0, "remaining": 30, "full": false },
    "12am":    { "id": "12am",    "booked": 0, "remaining": 30, "full": false }
  },
  "inbound": {
    "3am":   { "id": "3am",   "booked": 0, "remaining": 30, "full": false },
    "5:30am": { "id": "5:30am", "booked": 0, "remaining": 30, "full": false }
  }
}
```

If you get a 500 or connection error, the `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` env vars are missing or incorrect.
