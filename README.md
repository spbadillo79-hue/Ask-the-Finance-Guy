# Ask the Finance Guy

Upload this complete folder to GitHub, then import the repository into Vercel.

## Vercel environment variables

Add these in **Vercel → Project → Settings → Environment Variables**:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `FROM_EMAIL` (a sender verified in Resend)
- `NOTIFICATION_EMAIL` (the address that receives paid customer questions)

## Stripe webhook

In Stripe, add this endpoint after Vercel gives you the live site address:

`https://YOUR-SITE.vercel.app/api/webhook`

Listen for `checkout.session.completed`, then copy its signing secret into
`STRIPE_WEBHOOK_SECRET` in Vercel.

The two checkout choices are $19.99 and $39.99. No Stripe Price IDs are needed;
the server creates the line item securely for each checkout.
