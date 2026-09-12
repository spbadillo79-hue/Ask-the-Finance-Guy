const Stripe = require('stripe');
const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let event;
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const rawBody = Buffer.concat(chunks);
    event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) { return res.status(400).send(`Webhook error: ${error.message}`); }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object, m = session.metadata || {};
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.FROM_EMAIL,
        to: process.env.NOTIFICATION_EMAIL,
        subject: `Paid Finance Guy request — ${m.name || 'Customer'}`,
        text: `Payment received: $${((session.amount_total || 0) / 100).toFixed(2)}\n\nName: ${m.name}\nEmail: ${m.email}\nService: ${m.plan}\n\nQuestion:\n${m.question}`
      });
    } catch (error) { console.error('Email failed', error); return res.status(500).end(); }
  }
  return res.status(200).json({ received: true });
};

module.exports.config = { api: { bodyParser: false } };
