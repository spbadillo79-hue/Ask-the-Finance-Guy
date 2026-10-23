// Prices and caps are enforced by the existing Stripe Payment Links.
const offers = [
  ['plink_1UTQSmF02F3K8298f293POZM', 1999],
  ['plink_1UTQSxF02F3K8298uqFTv8x6', 2999],
  ['plink_1UTQT5F02F3K8298s2kkNXC6', 3999],
  ['plink_1UTQTEF02F3K8298FPzIVM4S', 5999],
];
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !/^(sk|rk)_live_/.test(key)) return res.status(503).json({ error: 'Bundle availability is temporarily unavailable. Please use the contact form.' });
  try {
    for (const [id, expectedAmount] of offers) {
      const response = await fetch(`https://api.stripe.com/v1/payment_links/${id}?expand[]=line_items`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Payment link lookup failed');
      const link = await response.json();
      const cap = link.restrictions?.completed_sessions;
      if (!link.active || (cap && cap.count >= cap.limit)) continue;
      const price = link.line_items?.data?.[0]?.price;
      const amount = price?.unit_amount;
      if (price?.currency !== 'usd' || !Number.isInteger(amount) || (expectedAmount !== null && amount !== expectedAmount)) throw new Error('Unexpected bundle price');
      if (!/^https:\/\/buy\.stripe\.com\//.test(link.url)) throw new Error('Unexpected checkout URL');
      if (req.query?.checkout === '1') return res.redirect(303, link.url);
      return res.status(200).json({ amount, currency: 'usd', remaining: cap ? Math.max(0, cap.limit - cap.count) : null, url: link.url });
    }
    return res.status(410).json({ error: 'This bundle is currently unavailable. Please contact us.' });
  } catch {
    return res.status(503).json({ error: 'We could not check the current offer. Please try again or contact us.' });
  }
};
