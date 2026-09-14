const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' });
// Set these to the Price IDs you create in the Stripe Dashboard
// (Product catalog -> Add product -> $19.99 one-time, and $39.99 one-time)
const PRICES = {
  single: process.env.STRIPE_PRICE_SINGLE,
  session: process.env.STRIPE_PRICE_SESSION,
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { plan, name, email, vehicle, situation, question } = req.body;
    const siteUrl = process.env.SITE_URL || `https://${req.headers.host}`;

    const priceId = PRICES[plan];
    if (!priceId && plan !== 'training') {
      res.status(400).json({ error: 'Invalid plan selected.' });
      return;
    }
    if (!name || !email || !question) {
      res.status(400).json({ error: 'Name, email, and question are required.' });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      
      line_items: plan === 'training'
        ? [{
            price_data: {
              currency: 'usd',
              unit_amount: 39900,
              product_data: { name: "The New Era Finance Manager — Founder's Edition" },
            },
            quantity: 1,
          }]
        : [{ price: priceId, quantity: 1 }],
      customer_email: email,
      // Metadata is how the webhook below knows what the buyer actually asked.
      // Stripe metadata values are capped at 500 characters each.
      metadata: {
        plan,
        name: String(name).slice(0, 490),
        email: String(email).slice(0, 490),
        vehicle: String(vehicle || '').slice(0, 490),
        situation: String(situation || '').slice(0, 490),
        question: String(question).slice(0, 490),
      },
      success_url: `${siteUrl}/?paid=1`,
      cancel_url: `${siteUrl}/?canceled=1`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout error:', err);
    res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
};
