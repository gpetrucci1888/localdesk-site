import { PAGE } from './page.js';
import { ICONS } from './icons.js';

// "Books" phone app for a trade client.
//
// GET  /<appKey>/            the app (installable: manifest + icons alongside)
// POST /<appKey>/read        reads one receipt photo with Workers AI and returns the details as JSON
// ANY  /<appKey>/api/...     passed to the books connector (service binding BOOKS) for this client's
//                            QuickBooks company
//
// Each client's link has its own app key; the connector says which QuickBooks company it belongs
// to. KEY (with REALM) is the demo link on the practice company. Everything is saved in
// QuickBooks; the app itself stores nothing.

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
    const realm = await realmFor(env, KEY);
    if (!realm) return new Response('Not found', { status: 404 });
    const app = `/${KEY}/`;
    if (!seg[2]) return Response.redirect(url.origin + app, 301);
    const rest = seg[2].slice(1);

    if (rest === '' && request.method === 'GET') {
      return new Response(PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    if (rest === 'manifest.json') {
      return json({ name: 'Books', short_name: 'Books', start_url: app, scope: app, display: 'standalone', background_color: '#f3f4f6', theme_color: '#f2b705',
        icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] });
    }
    const icon = rest.match(/^icon-(180|192|512)\.png$/);
    if (icon) return new Response(Uint8Array.from(atob(ICONS[icon[1]]), c => c.charCodeAt(0)), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' } });

    if (rest === 'read' && request.method === 'POST') {
      try {
        const { image } = await request.json();
        if (!/^data:image\/(jpeg|png|webp);base64,/.test(image || '')) return json({ error: 'No photo received' }, 400);
        return json(await readReceipt(env, image));
      } catch (err) {
        return json({ error: String(err && err.message || err) }, 500);
      }
    }

    const api = rest.match(/^api\/(file|summary|owed|recent|invoice|parse|untidy|quarter|remind\/\d+|tidy\/\d+)$/);
    if (api) {
      const [what, id] = api[1].split('/');
      const res = await env.BOOKS.fetch(`https://books/${what}/${realm}${id ? '/' + id : ''}`, {
        method: request.method, headers: { 'X-Key': env.BOOKS_KEY, 'Content-Type': 'application/json' },
        body: request.method === 'GET' ? undefined : request.body,
      });
      const text = await res.text();
      return new Response(text.startsWith('{') || text.startsWith('[') ? text : JSON.stringify({ error: text }), { status: res.status, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('Not found', { status: 404 });
  },
};

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

// Which QuickBooks company an app link belongs to (null if none). Remembered while this instance lives.
const known = new Map();
async function realmFor(env, key) {
  if (env.KEY && key === env.KEY) return env.REALM || null;
  if (known.has(key)) return known.get(key);
  const res = await env.BOOKS.fetch(`https://books/app/${key}`, { headers: { 'X-Key': env.BOOKS_KEY } });
  const realm = res.ok ? (await res.json()).realmId : null;
  if (realm) known.set(key, realm);
  return realm;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
