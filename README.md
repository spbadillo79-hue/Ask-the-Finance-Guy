# Ask The Finance Guy — setup guide

This is a static site (`index.html`) plus three small serverless functions.
`/api/create-checkout.js` and `/api/webhook.js` handle real payments and email
you when someone pays, while `/api/contact.js` delivers general inquiries.
It's built to deploy on **Vercel** for free, with no server to manage.

The site also includes a **Contact Me** section. General inquiries are sent by
`/api/contact.js` to the same `NOTIFY_EMAIL` inbox used for paid questions.
The form includes basic validation, a spam honeypot, and a reminder not to send
sensitive financial information.

## What happens when someone submits the form

1. They fill out the form and hit "Continue to payment."
2. Your site calls `/api/create-checkout`, which creates a Stripe Checkout
   Session for $19.99 or $39.99 and stores their name/email/question as
   metadata on that session.
3. They pay on Stripe's hosted checkout page (Stripe handles all card data —
   you never touch it).
4. Stripe sends a `checkout.session.completed` event to `/api/webhook`, which
   emails you the buyer's question, contact info, and which plan they paid for.

## One-time setup (about 20 minutes)

### 1. Create your Stripe account and prices
- Sign up at stripe.com.
- Go to **Product catalog → Add product**. Create two products, each with a
  one-time price: **$19.99** ("Single question") and **$39.99** ("10-minute
  session"). Copy each price's ID (starts with `price_...`).
- Go to **Developers → API keys** and copy your **Secret key** (starts with
  `sk_...`). Keep test mode on until you're ready to go live.

### 2. Create a Resend account (for the email notification)
- Sign up at resend.com (free tier is plenty for this).
- Verify a sending domain, or use their default test domain to start.
- Copy your **API key**.

### 3. Push this folder to GitHub
Create a new repo and push the contents of this folder (including the
`api/` folder) to it.

### 4. Deploy to Vercel
- Sign up at vercel.com, click **Add New → Project**, and import the GitHub repo.
- Before the first deploy, add these **Environment Variables** in the Vercel
  project settings:

  | Variable | Value |
  |---|---|
  | `STRIPE_SECRET_KEY` | your Stripe secret key |
  | `STRIPE_PRICE_SINGLE` | price ID for the $19.99 product |
  | `STRIPE_PRICE_SESSION` | price ID for the $39.99 product |
  | `RESEND_API_KEY` | your Resend API key |
  | `FROM_EMAIL` | an address on your verified Resend domain, e.g. `notify@yourdomain.com` |
  | `NOTIFY_EMAIL` | your real inbox — where paid questions land |
  | `SITE_URL` | your deployed site URL, e.g. `https://yourdomain.vercel.app` |
  | `STRIPE_WEBHOOK_SECRET` | see step 5 below (add after first deploy) |

- Deploy.

### 5. Connect the Stripe webhook
- In the Stripe Dashboard, go to **Developers → Webhooks → Add endpoint**.
- Endpoint URL: `https://yourdomain.vercel.app/api/webhook`
- Select event: `checkout.session.completed`
- After creating it, copy the **Signing secret** (starts with `whsec_...`)
  and add it as `STRIPE_WEBHOOK_SECRET` in Vercel, then redeploy.

### 6. Test it
- With Stripe still in test mode, submit the form on your live site and pay
  with card number `4242 4242 4242 4242`, any future expiry, any CVC.
- You should land on the success page, and an email should land in
  `NOTIFY_EMAIL` within a few seconds.
- When you're ready to accept real money, switch your Stripe account to
  **live mode** and swap in your live secret key and live price IDs.

## Notes
- The webhook is what actually confirms payment — never treat the "success"
  redirect alone as proof of payment, since a customer could close the tab
  early. The email only fires once Stripe confirms the charge.
- All card data is handled by Stripe's hosted checkout page; it never touches
  your server.
