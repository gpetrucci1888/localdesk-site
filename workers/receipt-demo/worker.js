import { PAGE, LOGIN, NO_LOGIN } from './page.js';
import { BRANDS } from './brands.js';

// "Books" phone app for a trade client.
//
// GET  /<appKey>/            the app (installable: manifest + icons alongside)
// POST /<appKey>/read        reads one receipt photo with Workers AI and returns the details as JSON
// POST /<appKey>/login/send  texts a login code; /login/verify {code} logs this phone in
// ANY  /<appKey>/api/...     passed to the books connector (service binding BOOKS) for this client's
//                            QuickBooks company; extras like quotes only if switched on for them
//
// Each client's link has its own app key, and the connector only lets it near that client's
// QuickBooks company. A phone logs in once with a code texted to the client's number, then stays
// logged in for a year (cookie). The demo link (practice company) needs no login.
// Everything is saved in QuickBooks; the app itself stores nothing.

const MODELS = [
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  '@cf/google/gemma-3-12b-it',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
];
const CATEGORIES = ['Materials', 'Tools and equipment', 'Fuel', 'Vehicle', 'Subcontractors', 'Phone and internet', 'Office', 'Food and drink', 'Other'];
const PROMPT = `You read UK receipts for a plumber's bookkeeping. Look at the receipt photo and reply with ONLY a JSON object, no other text:
{"supplier": "", "date": "YYYY-MM-DD", "total": 0.00, "vat": 0.00, "category": "", "items": "", "readable": true}
- supplier: the shop or company name.
- total: the amount paid, including VAT, as a number.
- vat: the VAT amount if shown, else 0.
- category: one of ${CATEGORIES.join(', ')}.
- items: a few words on what was bought.
- readable: false if this isn't a receipt or you can't read it.`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const seg = url.pathname.match(/^\/([\w-]{8,})(\/.*)?$/);
    if (!seg) return new Response('Not found', { status: 404 });
    const KEY = seg[1];
    const app = `/${KEY}/`;
    const session = cookie(request, 'bk');
    // Everything goes to the connector as this client only: their app key, plus their login.
    const books = (path, init = {}) => env.BOOKS.fetch(`https://books/c/${path}`, {
      ...init, headers: { 'X-App': KEY, 'X-Session': session, 'Content-Type': 'application/json' },
    });
    const info = await books('app');
    if (!info.ok) return new Response('Not found', { status: 404 });
    const client = await info.json();
    if (!seg[2]) return Response.redirect(url.origin + app, 301);
    const rest = seg[2].slice(1);

    const brand = BRANDS[client.brand] || BRANDS.localdesk;
    const fill = (html) => html.replaceAll('{{NAME}}', esc(client.name || 'Your business'))
      .replaceAll('{{EXTRAS}}', esc(client.extras || '')).replaceAll('{{PHONE_END}}', esc(client.phoneEnd || ''))
      .replaceAll('{{HD}}', brand.hd).replaceAll('{{ACC}}', brand.acc).replaceAll('{{ACCINK}}', brand.accInk)
      .replace('{{LOGO}}', brand.logo ? `<img class="logo" src="data:image/png;base64,${brand.logo}" alt="">` : '');
    const html = (body) => new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });

    if (rest === '' && request.method === 'GET') return html(fill(client.loggedIn ? PAGE : client.canLogin ? LOGIN : NO_LOGIN));
    if (rest === 'manifest.json') {
      return json({ name: `${client.name || 'Books'} · Books`, short_name: 'Books', start_url: app, scope: app, display: 'standalone', background_color: brand.hd, theme_color: brand.hd,
        icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] });
    }
    const icon = rest.match(/^icon-(180|192|512)\.png$/);
    if (icon) return new Response(Uint8Array.from(atob(brand.icons[icon[1]]), c => c.charCodeAt(0)), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' } });

    if (rest === 'login/send' && request.method === 'POST') return pass(await books('login/send', { method: 'POST' }));
    if (rest === 'login/verify' && request.method === 'POST') {
      const res = await books('login/verify', { method: 'POST', body: await request.text() });
      const out = await res.json().catch(() => ({ error: 'No response' }));
      if (!out.session) return json({ error: out.error || 'Could not log in' }, 400);
      return new Response(JSON.stringify({ ok: true }), { headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `bk=${out.session}; Path=${app}; Max-Age=${(out.days || 365) * 86400}; HttpOnly; Secure; SameSite=Lax`,
      } });
    }

    if (!client.loggedIn) return json({ error: 'Please log in again', login: true }, 401);

    if (rest === 'read' && request.method === 'POST') {
      try {
        const { image } = await request.json();
        if (!/^data:image\/(jpeg|png|webp);base64,/.test(image || '')) return json({ error: 'No photo received' }, 400);
        return json(await readReceipt(env, image));
      } catch (err) {
        return json({ error: String(err && err.message || err) }, 500);
      }
    }

    const api = rest.match(/^api\/([a-z]+(?:\/\d+)?)$/);
    if (api) return pass(await books(api[1] + url.search, { method: request.method, body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body }));
    return new Response('Not found', { status: 404 });
  },
};

// The connector's answer, always as JSON.
async function pass(res) {
  const text = await res.text();
  return new Response(text.startsWith('{') || text.startsWith('[') ? text : JSON.stringify({ error: text.replace(/^Error: /, '') }), { status: res.status, headers: { 'Content-Type': 'application/json' } });
}

function cookie(request, name) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : '';
}

async function readReceipt(env, image) {
  const tried = [];
  for (const model of MODELS) {
    try {
      const out = await env.AI.run(model, {
        messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: image } }] }],
        max_tokens: 400,
      });
      const text = typeof out.response === 'string' ? out.response : JSON.stringify(out.response || out);
      const found = text.match(/\{[\s\S]*\}/);
      if (!found) { tried.push(`${model}: no JSON`); continue; }
      const r = JSON.parse(found[0]);
      return {
        supplier: String(r.supplier || ''),
        date: String(r.date || ''),
        total: Number(r.total) || 0,
        vat: Number(r.vat) || 0,
        category: CATEGORIES.includes(r.category) ? r.category : 'Other',
        items: String(r.items || ''),
        readable: r.readable !== false,
        model,
      };
    } catch (err) {
      tried.push(`${model}: ${err && err.message || err}`);
    }
  }
  throw new Error('Could not read the receipt. ' + tried.join(' | '));
}

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
