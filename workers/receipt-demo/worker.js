import { PAGE } from './page.js';
import { ICONS } from './icons.js';

// "Books" phone app for a trade client.
//
// GET  /<KEY>/              the app (installable: manifest + icons alongside)
// POST /<KEY>/read          reads one receipt photo with Workers AI and returns the details as JSON
// ANY  /<KEY>/api/...       passed to the books connector (service binding BOOKS) for this client's
//                           QuickBooks company (REALM): file, summary, owed, recent, invoice, remind/<id>
//
// The key in the path (the KEY setting on the Worker) keeps strangers out. Everything is saved
// in QuickBooks; the app itself stores nothing.

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
    const KEY = env.KEY;
    if (!KEY) return new Response('Not set up', { status: 503 });
    const app = `/${KEY}/`;
    if (url.pathname === `/${KEY}`) return Response.redirect(url.origin + app, 301);
    if (!url.pathname.startsWith(app)) return new Response('Not found', { status: 404 });
    const rest = url.pathname.slice(app.length);

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

    const api = rest.match(/^api\/(file|summary|owed|recent|invoice|remind\/\d+)$/);
    if (api) {
      if (!env.BOOKS || !env.REALM) return json({ error: "QuickBooks isn't connected yet" }, 503);
      const [what, id] = api[1].split('/');
      const res = await env.BOOKS.fetch(`https://books/${what}/${env.REALM}${id ? '/' + id : ''}`, {
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

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
