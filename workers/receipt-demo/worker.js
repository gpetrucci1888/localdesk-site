import { PAGE, LOGIN, NO_LOGIN } from './page.js';
import { BRANDS } from './brands.js';

// "Books" phone app for a trade client.
//
// GET  /<appKey>/            the app (installable: manifest + icons alongside)
// GET  /<appKey>/sw.js       service worker: the app opens with no signal, and receipts wait on the phone until there is
// POST /<appKey>/read        reads one receipt photo with Workers AI and returns the details as JSON
// POST /<appKey>/login/send  texts a login code; /login/verify {code} logs this phone in
// GET  /<appKey>/receiptimg/<id>  the receipt photo on an expense (straight through, not JSON)
// POST /<appKey>/logout      logs this phone out
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

// Security headers on everything. The app is one page with inline script and style, so CSP allows those,
// but only from itself plus the PDF reader on cdnjs; nothing else can load, and nothing can frame the app.
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://cdnjs.cloudflare.com; worker-src 'self' blob: https://cdnjs.cloudflare.com; manifest-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'";
function secure(res) {
  const h = new Headers(res.headers);
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'no-referrer'); // the app's address contains the client's app key
  h.set('Strict-Transport-Security', 'max-age=31536000');
  const type = h.get('Content-Type') || '';
  if (/text\/html/.test(type)) {
    h.set('Content-Security-Policy', CSP);
    h.set('X-Frame-Options', 'DENY');
    h.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(), payment=()');
  } else if (!h.has('Cache-Control') && /json/.test(type)) {
    h.set('Cache-Control', 'private, no-store');
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

// A receipt photo (as a data: URL) bigger than this is refused before it reaches the AI.
const MAX_IMAGE = 6_000_000;

export default {
  async fetch(request, env) {
    return secure(await serve(request, env));
  },
};

async function serve(request, env) {
    const url = new URL(request.url);
    const seg = url.pathname.match(/^\/([\w-]{8,})(\/.*)?$/);
    if (!seg) return new Response('Not found', { status: 404 });
    const KEY = seg[1];
    const app = `/${KEY}/`;
    const session = cookie(request, 'bk');
    // Everything goes to the connector as this client only: their app key, plus their login.
    const ip = request.headers.get('CF-Connecting-IP');
    const books = (path, init = {}) => env.BOOKS.fetch(`https://books/c/${path}`, {
      ...init, headers: { 'X-App': KEY, 'X-Session': session, 'Content-Type': 'application/json', ...(ip ? { 'X-Client-IP': ip } : {}) },
    });
    const info = await books('app');
    if (!info.ok) return new Response('Not found', { status: 404 });
    const client = await info.json();
    if (!seg[2]) return Response.redirect(url.origin + app, 301);
    const rest = seg[2].slice(1);

    const brand = BRANDS[client.brand] || BRANDS.localdesk;
    const fill = (html) => html.replaceAll('{{NAME}}', esc(client.name || 'Your business'))
      .replaceAll('{{EXTRAS}}', esc(client.extras || '')).replaceAll('{{PHONE_END}}', esc(client.phoneEnd || ''))
      .replaceAll('{{VAT}}', client.vat === false ? '0' : '1').replaceAll('{{CHASE}}', client.chase ? '1' : '0')
      .replaceAll('{{HD}}', brand.hd).replaceAll('{{ACC}}', brand.acc).replaceAll('{{ACCINK}}', brand.accInk)
      .replace('{{LOGO}}', brand.logo ? `<img class="logo" src="data:image/png;base64,${brand.logo}" alt="">` : '');
    const html = (body) => new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });

    if (rest === '' && request.method === 'GET') return html(fill(client.loggedIn ? PAGE : client.canLogin ? LOGIN : NO_LOGIN));
    if (rest === 'manifest.json') {
      return json({ name: `${client.name || 'Books'} · Books`, short_name: 'Books', id: app, start_url: app, scope: app, display: 'standalone', orientation: 'portrait', background_color: brand.hd, theme_color: brand.hd,
        description: 'Receipts, invoices and money owed, straight into QuickBooks.',
        shortcuts: [{ name: 'Snap a receipt', url: `${app}?tab=receipts&snap=1` }, { name: 'Who owes me', url: `${app}?tab=owed` }],
        icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] });
    }
    if (rest === 'sw.js') return new Response(SW, { headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': app } });
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

    if (rest === 'logout' && request.method === 'POST') {
      await books('bye', { method: 'POST' });
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': `bk=; Path=${app}; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
    }
    const img = rest.match(/^receiptimg\/(\d+)$/);
    if (img) {
      const res = await books(`receipt/${img[1]}`);
      return new Response(res.body, { status: res.status, headers: { 'Content-Type': res.headers.get('Content-Type') || 'image/jpeg', 'Cache-Control': 'private, max-age=600' } });
    }

    if (rest === 'read' && request.method === 'POST') {
      if (Number(request.headers.get('Content-Length') || 0) > MAX_IMAGE * 1.4) return json({ error: 'That photo is too big. Try a smaller one.' }, 413);
      // The connector counts every read, for the client (or, on the demo, the visitor and the demo overall) and says no when it's too many.
      const ok = await books('allow', { method: 'POST' });
      if (ok.status === 429) return json({ error: 'That is a lot of receipts at once. Give it a few minutes and try again.' }, 429);
      if (!ok.ok) return json({ error: 'Try again in a moment.' }, 503);
      try {
        const { image } = await request.json();
        if (!/^data:image\/(jpeg|png|webp);base64,/.test(image || '')) return json({ error: 'No photo received' }, 400);
        if (image.length > MAX_IMAGE) return json({ error: 'That photo is too big. Try a smaller one.' }, 413);
        return json(await readReceipt(env, image));
      } catch (err) {
        // Every reading model failed: that's on us, so Gio hears about it.
        await books('problem', { method: 'POST', body: JSON.stringify({ what: 'read', message: String(err && err.message || err) }) }).catch(() => {});
        return json({ error: String(err && err.message || err) }, 500);
      }
    }

    const api = rest.match(/^api\/([a-z]+(?:\/\d+)?)$/);
    if (api) return pass(await books(api[1] + url.search, { method: request.method, body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body }));
    return new Response('Not found', { status: 404 });
}

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

// Opens the app with no signal: the page is fetched fresh when there's a connection and kept
// for when there isn't. Nothing else is cached; figures always come live from QuickBooks.
const SW = `const CACHE = 'books-page-v2';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request;
  const same = new URL(r.url).origin === location.origin;
  const keep = r.mode === 'navigate' || (same && /(manifest\\.json|icon-\\d+\\.png)$/.test(r.url));
  if (r.method !== 'GET' || !keep) return;
  e.respondWith(fetch(r).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: true }).then(hit => hit || new Response('No signal. Try again in a moment.', { headers: { 'Content-Type': 'text/plain' } }))));
});
// Notifications: show them, and open the right screen when tapped.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Books', { body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag, data: { tab: d.tab || 'home' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = self.registration.scope + '?tab=' + ((e.notification.data && e.notification.data.tab) || 'home');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) if ('focus' in w) { w.navigate(url); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});`;

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
