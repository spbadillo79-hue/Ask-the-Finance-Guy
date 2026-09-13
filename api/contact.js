const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const body = req.body || {};

  // Quietly accept automated submissions that fill the hidden honeypot field.
  if (clean(body.website, 200)) {
    res.status(200).json({ sent: true });
    return;
  }

  const name = clean(body.name, 100);
  const email = clean(body.email, 254);
  const phone = clean(body.phone, 40);
  const preferredContact = clean(body.preferredContact, 30) || 'Email';
  const topic = clean(body.topic, 100) || 'General inquiry';
  const message = clean(body.message, 4000);

  if (!name || !EMAIL_PATTERN.test(email) || !message) {
    res.status(400).json({ error: 'Please enter your name, a valid email address, and a message.' });
    return;
  }

  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL || !process.env.NOTIFY_EMAIL) {
    console.error('Contact form email settings are incomplete.');
    res.status(500).json({ error: 'The contact form is temporarily unavailable. Please try again later.' });
    return;
  }

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL,
        to: process.env.NOTIFY_EMAIL,
        reply_to: email,
        subject: `Website inquiry — ${topic}`,
        text:
          `New website inquiry\n\n` +
          `Name: ${name}\n` +
          `Email: ${email}\n` +
          `Phone: ${phone || '(not provided)'}\n` +
          `Preferred reply: ${preferredContact}\n` +
          `Topic: ${topic}\n\n` +
          `Message:\n${message}`,
      }),
    });

    if (!emailRes.ok) {
      console.error('Resend API error:', await emailRes.text());
      res.status(502).json({ error: 'Your inquiry could not be sent. Please try again.' });
      return;
    }

    res.status(200).json({ sent: true });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ error: 'Your inquiry could not be sent. Please try again.' });
  }
};
