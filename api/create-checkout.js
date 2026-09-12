const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { name, email, question, plan } = req.body || {};
    if (!name || !email || !question || !['question', 'review'].includes(plan)) {
      return res.status(400).json({ error: 'Please complete every field.' });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const amount = plan === 'review' ? 3999 : 1999;
    const label = plan === 'review' ? 'Detailed automotive deal review' : 'Automotive finance question';
    const origin = `https://${req.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', customer_email: email,
      line_items: [{ price_data: { currency: 'usd', unit_amount: amount, product_data: { name: label, tax_code: 'txcd_20030000} }, quantity: 1 }],
      metadata: { name: String(name).slice(0, 200), email: String(email).slice(0, 200), question: String(question).slice(0, 450), plan },
      success_url: `${origin}/?paid=1`, cancel_url: `${origin}/?canceled=1`
    });
    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Checkout is temporarily unavailable.' });
  }
};
