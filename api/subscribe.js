const crypto = require('node:crypto');
const SITE = 'https://www.askthefinanceguy.org';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const secret = () => process.env.NEWSLETTER_SIGNING_SECRET || process.env.RESEND_API_KEY;
function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return data + '.' + crypto.createHmac('sha256', secret()).update('newsletter-v1:' + data).digest('base64url');
}
function verify(token) {
  const [data, signature, extra] = String(token || '').split('.');
  if (!data || !signature || extra || token.length > 2000) throw new Error('Invalid link');
  const expected = crypto.createHmac('sha256', secret()).update('newsletter-v1:' + data).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error('Invalid link');
  const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
  if (!EMAIL.test(payload.email) || (payload.expires && payload.expires < Date.now())) throw new Error('Expired link');
  return payload;
}
async function resend(path, options = {}) {
  return fetch('https://api.resend.com' + path, { ...options, headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(10000) });
}
function page(res, status, title, content) {
  return res.status(status).setHeader('Content-Type','text/html; charset=utf-8').send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escape(title)} | Ask The Finance Guy</title><style>body{font:18px/1.6 system-ui;background:#f7f5ef;color:#142238;margin:0;padding:28px}main{max-width:620px;margin:8vh auto}img{width:72px}h1{line-height:1.1}button,.button{display:inline-block;background:#142238;color:white;border:0;padding:15px 22px;font:inherit;border-radius:5px;cursor:pointer}a{color:inherit}p{margin:24px 0}</style><main><img src="/brand-logo.svg" alt="Ask The Finance Guy"><h1>${escape(title)}</h1>${content}<p><a href="/">Return to Ask The Finance Guy</a></p></main></html>`);
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex');
  const body = req.body || {};
  const action = req.query?.action || body.action || 'request';
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) return action === 'status' ? res.status(200).json({available:false}) : res.status(503).json({error:'Email sign-up is temporarily unavailable. You can still read the free sample.'});
  try {
    if (req.method === 'GET' && action === 'status') {
      const check = await resend('/contacts?limit=1');
      return res.status(200).json({ available: check.ok });
    }
    if (action === 'confirm' || action === 'unsubscribe') {
      const token = req.query?.token || body.token;
      const payload = verify(token);
      if ((action === 'confirm' && payload.purpose !== 'confirm') || (action === 'unsubscribe' && payload.purpose !== 'unsubscribe')) throw new Error('Invalid link');
      if (req.method === 'GET') {
        return page(res,200,action === 'confirm' ? 'Confirm your email' : 'Unsubscribe from training tips', `<p>${action === 'confirm' ? 'Confirm to join the free training list and open your five-objection sample.' : 'Choose below to stop training and promotional emails.'}</p><form method="post" action="/api/subscribe"><input type="hidden" name="action" value="${action}"><input type="hidden" name="token" value="${escape(token)}"><button>${action === 'confirm' ? 'Confirm and get my free sample' : 'Unsubscribe'}</button></form>`);
      }
      const path = '/contacts/' + encodeURIComponent(payload.email);
      const existing = await resend(path);
      if (!existing.ok && existing.status !== 404) throw new Error('Service unavailable');
      const update = existing.ok
        ? await resend(path,{method:'PATCH',body:JSON.stringify({unsubscribed:action === 'unsubscribe'})})
        : action === 'confirm' ? await resend('/contacts',{method:'POST',body:JSON.stringify({email:payload.email,unsubscribed:false})}) : {ok:true};
      if (!update.ok) throw new Error('Service unavailable');
      if (action === 'unsubscribe') return page(res,200,'You are unsubscribed','<p>You will no longer receive training and promotional emails from this list.</p>');
      const unsubscribe = sign({email:payload.email,purpose:'unsubscribe'});
      return page(res,200,'Your free sample is ready',`<p>You have confirmed your subscription to occasional automotive sales training tips and product updates.</p><a class="button" href="/free-sales-objections.html?confirmed=1">Open the free objection guide</a><p><a href="/api/subscribe?action=unsubscribe&amp;token=${escape(unsubscribe)}">Unsubscribe any time</a> · <a href="/privacy.html">Privacy</a></p>`);
    }
    if (req.method !== 'POST' || action !== 'request') return res.status(400).json({error:'Invalid request.'});
    if (req.headers.origin && req.headers.origin !== SITE && req.headers.origin !== 'https://askthefinanceguy.org') return res.status(403).json({error:'Please use the sign-up form on our website.'});
    if (body.website) return res.status(200).json({sent:true});
    const email = String(body.email || '').trim().toLowerCase();
    if (email.length > 254 || !EMAIL.test(email) || body.consent !== true) return res.status(400).json({error:'Enter a valid email and agree to receive training tips.'});
    // Check list access before promising a confirmation email.
    const check = await resend('/contacts?limit=1');
    if (!check.ok) return res.status(503).json({error:'Email sign-up is temporarily unavailable. Please read the free sample below.'});
    // Stable daily tokens and send keys avoid duplicate confirmation mail on retries.
    const day = Math.floor(Date.now()/86400000);
    const token = sign({email,purpose:'confirm',expires:(day+3)*86400000});
    const confirm = `${SITE}/api/subscribe?action=confirm&token=${token}`;
    const key = crypto.createHash('sha256').update(`${email}:${day}`).digest('hex');
    const sent = await resend('/emails',{method:'POST',headers:{'Idempotency-Key':`newsletter-confirm-${key}`},body:JSON.stringify({from:process.env.FROM_EMAIL,to:email,subject:'Confirm your free sales objection guide — Ask The Finance Guy',text:`You requested five common car-sales objections and practice responses.\n\nConfirm your email and join our occasional training tips and product updates:\n${confirm}\n\nIf you did not request this, ignore this email. You will not be subscribed. This link expires in about two days.\n\nAsk The Finance Guy\n${SITE}/privacy.html`})});
    if (!sent.ok) return res.status(502).json({error:'We could not send the confirmation email. Please try again later.'});
    return res.status(200).json({sent:true});
  } catch {
    if (action === 'confirm' || action === 'unsubscribe') return page(res,400,'We could not complete that request','<p>The link may have expired, or the email service may be unavailable. Please try again or <a href="/#contact">contact us</a>.</p>');
    return res.status(503).json({error:'Email sign-up is temporarily unavailable. Please try again later.'});
  }
};
