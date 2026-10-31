// The whole customer journey with a fake Stripe, fake texts and no network:
// website enquiry -> lead -> founding place -> payment link -> signed webhook -> places and sources in HQ -> cancel, abandon, duplicate, failure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, asAdmin } from './harness.mjs';
import books from '../workers/books/worker.js';
import hq, { Vault, totp } from '../workers/hq/worker.js';
import { MemStorage } from './harness.mjs';

const PASS = 'journey passphrase', WHSEC = 'whsec_journey', SK = 'rk_test_journey';
const PRICES = { STRIPE_PRICE_RECEPTIONIST: 'price_rec', STRIPE_PRICE_RECEPTIONIST_SETUP: 'price_rec_setup', STRIPE_PRICE_BOOKS: 'price_books', STRIPE_PRICE_BOOKS_SETUP: 'price_books_setup' };
const DAY = 86400000;
const hex = (b) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const sig = async (raw) => { const t = Math.floor(Date.now() / 1000), k = await crypto.subtle.importKey('raw', new TextEncoder().encode(WHSEC), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return `t=${t},v1=${hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${t}.${raw}`)))}`; };

function journey(t, { stripeDown = false } = {}) {
  const w = world(); Object.assign(w.booksEnv, { STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_SECRET_KEY: SK, ...PRICES });
  const texts = [], sessions = []; let sid = 0;
  t.mock.method(globalThis, 'fetch', async (u, init = {}) => {
    const url = String(u);
    if (url.startsWith('https://api.stripe.com/')) { if (stripeDown) return new Response('down', { status: 500 }); const q = new URLSearchParams(String(init.body)); sessions.push(q); return Response.json({ id: `cs_${++sid}`, url: `https://checkout.stripe.com/c/pay/cs_${sid}` }); }
    if (url.includes('twilio')) { texts.push(String(init.body)); return Response.json({ sid: 'SM1' }); }
    return Response.json({});
  });
  const vault = new Vault({ storage: new MemStorage() }), stub = { fetch: (u, init) => vault.fetch(new Request(u, init)) };
  const hqEnv = { OWNER_PASSWORD: PASS, ADMIN_KEY: w.booksEnv.ADMIN_KEY, VAULT: { idFromName: () => 'o', get: () => stub }, BOOKS: { fetch: (u, init) => books.fetch(new Request(u, init), w.booksEnv) } };
  const h = (path, { method = 'GET', form, cookie } = {}) => hq.fetch(new Request('https://hq.test' + path, { method, redirect: 'manual', headers: { ...(cookie ? { Cookie: cookie } : {}), 'CF-Connecting-IP': '203.0.113.9', ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body: form ? new URLSearchParams(form).toString() : undefined }), hqEnv);
  return { w, texts, sessions, h, async login() { const first = await (await h('/login', { method: 'POST', form: { password: PASS } })).text(); const key = /class="key">([A-Z2-7]{32})</.exec(first)[1]; const r = await h('/login', { method: 'POST', form: { password: PASS, code: await totp(key, Math.floor(Date.now() / 30000)) } }); return (r.headers.get('set-cookie') || '').split(';')[0]; } };
}
const enquire = (w, i, product = 'receptionist', source) => books.fetch(new Request('https://books.test/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://www.localdeskai.co.uk', 'CF-Connecting-IP': `198.51.100.${i}` }, body: JSON.stringify({ name: `Journey ${i}`, phone: `07700 90${String(2000 + i).slice(-4)}`, business: `Trade ${i}`, product, source }) }), w.booksEnv);
const lead = async (w, i) => (await (await asAdmin(w, 'GET', '/leads')).json()).find(l => l.name === `Journey ${i}`);
const hook = async (w, type, obj, id) => { const raw = JSON.stringify({ id, type, data: { object: obj } }); return books.fetch(new Request('https://books.test/stripe/webhook', { method: 'POST', headers: { 'Stripe-Signature': await sig(raw) }, body: raw }), w.booksEnv); };
const subOf = (l, status = 'trialing') => ({ id: `sub_${l.id}`, status, metadata: { lead_id: l.id, product: l.product, founding: 'true' } });
const places = async (w) => (await asAdmin(w, 'GET', '/founding')).json();

test('journey: enquiry, founding place, payment link, payment, duplicate events, HQ, and cancellation inside 7 days', async (t) => {
  const j = journey(t); const { w } = j;
  // 1. website enquiry from a Facebook post link
  assert.equal((await enquire(w, 1, 'receptionist', 'facebook')).status, 200);
  assert.ok(j.texts.some(x => /via\+facebook|via%20facebook|via facebook/.test(decodeURIComponent(x.replace(/\+/g, ' ')))), 'the owner is texted, naming the source');
  let l = await lead(w, 1); assert.equal(l.status, 'new'); assert.equal(l.source, 'facebook'); assert.equal(l.product, 'receptionist');
  // 2. qualified and moved on by the owner
  for (const s of ['contacted', 'demo', 'trial', 'onboarding']) assert.equal((await asAdmin(w, 'PUT', `/leads/${l.id}`, { status: s })).status, 200);
  const cookie = await j.login();
  let page = await (await j.h('/leads', { cookie })).text(); assert.match(page, /0 of 5/); assert.match(page, /facebook/); assert.match(page, /Where leads come from/);
  // 3. the owner gives the founding place; HQ shows it reserved; the link is monthly only with a 7-day trial and returns to the thank-you page
  assert.equal((await asAdmin(w, 'PUT', `/leads/${l.id}`, { checklist: { founding: true } })).status, 200);
  assert.match(await (await j.h('/leads', { cookie })).text(), /1 of 5/);
  const made = await j.h(`/leads/${l.id}/checkout`, { method: 'POST', cookie }); const madeHtml = await made.text();
  assert.equal(made.status, 200); assert.match(madeHtml, /checkout\.stripe\.com\/c\/pay\/cs_1/); assert.match(madeHtml, /Nothing was sent/);
  const q = j.sessions[0]; assert.equal(q.get('line_items[0][price]'), 'price_rec'); assert.equal(q.get('line_items[1][price]'), null); assert.equal(q.get('subscription_data[trial_period_days]'), '7'); assert.equal(q.get('success_url'), 'https://www.localdeskai.co.uk/thanks.html');
  assert.equal(j.texts.filter(x => /checkout/.test(x)).length, 0, 'no link was texted to anyone');
  // 4. the customer pays: the signed webhook makes the place permanent; a repeat of the same event and a later update change nothing
  assert.equal((await (await hook(w, 'customer.subscription.created', subOf(l), 'evt_a')).json()).activated, l.id);
  assert.equal((await (await hook(w, 'customer.subscription.created', subOf(l), 'evt_a')).json()).ignored, 'event already handled');
  await hook(w, 'customer.subscription.updated', subOf(l, 'active'), 'evt_b');
  let p = await places(w); assert.equal(p.used, 1); assert.equal(p.active, 1);
  // 5. they cancel on day 3: the place comes back
  assert.equal((await (await hook(w, 'customer.subscription.deleted', subOf(l, 'canceled'), 'evt_c')).json()).released, true);
  assert.equal((await places(w)).used, 0);
});

test('journey: abandoned checkout frees the place after 7 days; a forged webhook and a Stripe outage change nothing', async (t) => {
  const j = journey(t); const { w } = j;
  for (let i = 1; i <= 6; i++) await enquire(w, i);
  const ids = []; for (let i = 1; i <= 6; i++) ids.push((await lead(w, i)).id);
  for (const id of ids.slice(0, 5)) assert.equal((await asAdmin(w, 'PUT', `/leads/${id}`, { checklist: { founding: true } })).status, 200);
  assert.equal((await asAdmin(w, 'PUT', `/leads/${ids[5]}`, { checklist: { founding: true } })).status, 500, 'a sixth cannot be reserved');
  // a forged or unsigned webhook does nothing
  const forged = await books.fetch(new Request('https://books.test/stripe/webhook', { method: 'POST', headers: { 'Stripe-Signature': 't=1,v1=00' }, body: JSON.stringify({ id: 'evt_f', type: 'customer.subscription.created', data: { object: subOf({ id: ids[5], product: 'receptionist' }) } }) }), w.booksEnv);
  assert.equal(forged.status, 400); assert.equal((await places(w)).active, 0);
  // abandoned: nobody pays for 8 days, the reservation lapses, and the next client can take the place
  const store = (op, id, now) => w.store.fetch('https://store/founding', { method: 'POST', body: JSON.stringify({ op, id, now }) }).then(r => r.json());
  assert.equal((await store('claim', ids[5], Date.now() + 8 * DAY)).ok, true);
  // a Stripe outage while making a link: plain error, nothing reserved or changed
  t.mock.restoreAll(); const j2 = journey(t, { stripeDown: true }); await enquire(j2.w, 7); const l7 = await lead(j2.w, 7);
  const cookie = await j2.login(); const down = await j2.h(`/leads/${l7.id}/checkout`, { method: 'POST', cookie });
  assert.equal(down.status, 400); assert.match(await down.text(), /Stripe refused to make the link/); assert.equal((await places(j2.w)).used, 0);
});

test('journey: Books pays the setup fee with no trial and can never take a founding place; duplicate enquiries join one lead', async (t) => {
  const j = journey(t); const { w } = j;
  await enquire(w, 1, 'books'); await enquire(w, 1, 'books'); const all = await (await asAdmin(w, 'GET', '/leads')).json(); assert.equal(all.length, 1); assert.equal(all[0].repeat, 2);
  const l = await lead(w, 1);
  assert.equal((await asAdmin(w, 'PUT', `/leads/${l.id}`, { checklist: { founding: true } })).status, 500);
  const r = await (await asAdmin(w, 'POST', '/checkout', { lead_id: l.id })).json();
  assert.equal(r.founding, false); assert.equal(r.setupFee, true); const q = j.sessions[0];
  assert.deepEqual([q.get('line_items[0][price]'), q.get('line_items[1][price]')], ['price_books', 'price_books_setup']); assert.equal(q.get('subscription_data[trial_period_days]'), null);
  // a Books subscription event is ignored by the founding places
  assert.match((await (await hook(w, 'customer.subscription.created', { id: 'sub_b', status: 'active', metadata: { lead_id: l.id, product: 'books', founding: 'true' } }, 'evt_books')).json()).ignored, /not a founding/);
  assert.equal((await places(w)).used, 0);
});
