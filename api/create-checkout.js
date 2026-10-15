const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-03-31.basil',
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
    });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const {
      plan, name, email, vehicle, situation, question,
    } = req.body || {};

    const prices = {
      single: process.env.STRIPE_PRICE_SINGLE,
      session: process.env.STRIPE_PRICE_SESSION,
    };

    if (plan !== 'training' && !prices[plan]) {
      return res.status(400).json({
        error: 'Invalid plan selected.',
      });
    }

    if (!name || !email || !question) {
      return res.status(400).json({
        error: 'Name, email, and question are required.',
      });
    }

    const siteUrl =
      process.env.SITE_URL || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: plan === 'training'
        ? [{
            price_data: {
              currency: 'usd',
              unit_amount: 39900,
              product_data: {
                name: "The New Era Finance Manager — Founder's Edition",
                tax_code: 'txcd_10302000',
              },
            },
            quantity: 1,
          }]
        : [{ price: prices[plan], quantity: 1 }],
      customer_email: email,
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

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout error:', err);
    return res.status(500).json({
      error: 'Could not start checkout. Please try again.',
    });
  }
};
