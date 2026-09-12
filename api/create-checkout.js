const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { name, email, question = '', plan } = body;

    if (!name || !email || !plan) {
      return res.status(400).json({ error: 'Please enter your name and email.' });
    }

    const prices = {
      question: 1999,
      review: 3999,
      training: 39900
    };

    const labels = {
      question: 'Automotive Finance Question',
      review: 'Detailed Automotive Deal Review',
      training: "The New Era Finance Manager — Founder's Edition"
    };

    if (!prices[plan]) {
      return res.status(400).json({ error: 'Invalid purchase option.' });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const origin = `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  managed_payments: { enabled: false },
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: prices[plan],
            product_data: {
              name: labels[plan]
            }
          },
          quantity: 1
        }
      ],
      metadata: {
        name: String(name).slice(0, 200),
        email: String(email).slice(0, 200),
        question: String(question).slice(0, 450),
        plan: String(plan)
      },
      success_url: `${origin}/?paid=1`,
      cancel_url: `${origin}/?canceled=1`
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('CHECKOUT ERROR:', error);
    return res.status(500).json({
      error: error.message || 'Checkout could not be started.'
    });
  }
};
