const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, question, plan } = req.body || {};

    if (!name || !email || !plan) {
      return res.status(400).json({ error: 'Please complete every field.' });
    }

    if (plan !== 'training' && !question) {
      return res.status(400).json({ error: 'Please complete every field.' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    let amount;
    let label;

    if (plan === 'training') {
      amount = 39900;
      label = "The New Era Finance Manager — Founder's Edition";
    } else if (plan === 'review') {
      amount = 3999;
      label = 'Detailed Deal Review';
    } else {
      amount = 1999;
      label = 'Quick Question';
    }

    const origin = `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: label,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        name: String(name).slice(0, 500),
        email: String(email).slice(0, 500),
        question: String(question || '').slice(0, 500),
        plan: String(plan).slice(0, 100),
      },
      success_url: `${origin}/?paid=1`,
      cancel_url: `${origin}/`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Checkout could not be started.' });
  }
};
