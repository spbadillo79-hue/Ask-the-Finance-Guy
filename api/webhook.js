const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Vercel needs the raw request body to verify the Stripe signature,
// so we turn off the default JSON body parser for this route only.
module.exports.config = { api: { bodyParser: false } };

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).end('Method not allowed');
    return;
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata || {};
    const amount = ((session.amount_total || 0) / 100).toFixed(2);
    const planLabel = meta.plan === 'session' ? '10-minute session' : 'Single question';

    try {
      // Uses Resend (resend.com) — swap this block for SendGrid/Postmark/SMTP if you prefer.
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.FROM_EMAIL,
          to: process.env.NOTIFY_EMAIL,
          reply_to: meta.email || session.customer_email || undefined,
          subject: `New paid question — ${planLabel} ($${amount})`,
          text:
            `Plan: ${planLabel} ($${amount})\n` +
            `From: ${meta.name || 'unknown'} <${meta.email || session.customer_email || 'no email'}>\n` +
            `Vehicle / deal: ${meta.vehicle || '(not provided)'}\n` +
            `Situation: ${meta.situation || '(not provided)'}\n\n` +
            `Question:\n${meta.question || '(not provided)'}`,
        }),
      });

      if (!emailRes.ok) {
        console.error('Resend API error:', await emailRes.text());
      }
    } catch (err) {
      console.error('Failed to send notification email:', err);
      // Don't fail the webhook over an email issue — Stripe already has the payment.
    }
  }

  res.status(200).json({ received: true });
};
