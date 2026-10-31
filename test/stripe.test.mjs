// Stripe: signed webhooks keep the founding places honest, checkout links are built correctly and fail closed. Fake Stripe, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, asAdmin } from './harness.mjs';
import books from '../workers/books/worker.js';
import { verifyStripeSignature, checkoutParams } from '../workers/books/stripe.js';

const WHSEC = 'whsec_test_secret', SK = 'rk_test_checkout_only';
const PRICES = { STRIPE_PRICE_RECEPTIONIST: 'price_rec', STRIPE_PRICE_RECEPTIONIST_SETUP: 'price_rec_setup', STRIPE_PRICE_BOOKS: 'price_books', STRIPE_PRICE_BOOKS_SETUP: 'price_books_setup' };
const DAY = 86400000;
const sig = async (raw, t = Math.floor(Date.now() / 1000), secret = WHSEC) => { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return `t=${t},v1=${[...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${t}.${raw}`)))].map(b => b.toString(16).padStart(2, '0')).join('')}`; };
const enable = (w) => Object.assign(w.booksEnv, { STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_SECRET_KEY: SK, ...PRICES });
let n = 0;
const hook = async (w, type, sub, { header, id } = {}) => { const raw = JSON.stringify({ id: id || `evt_${++n}`, type, data: { object: sub } }); return books.fetch(new Request('https://books.test/stripe/webhook', { method: 'POST', headers: { 'Stripe-Signature': header ?? await sig(raw) }, body: raw }), w.booksEnv); };
const fsub = (lead, status = 'trialing', over = {}) => ({ id: `sub_${lead}`, status, metadata: { lead_id: lead, product: 'receptionist', founding: 'true' }, ...over });
const enquire = (w, i, product = 'receptionist') => books.fetch(new Request('https://books.test/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://www.localdeskai.co.uk', 'CF-Connecting-IP': `203.0.113.${100 + i}` }, body: JSON.stringify({ name: `Pay ${i}`, phone: `07700 93${String(1000 + i).slice(-4)}`, product }) }), w.booksEnv);
const leadId = async (w, i) => (await (await asAdmin(w, 'GET', '/leads')).json()).find(l => l.name === `Pay ${i}`).id;
const places = async (w) => (await asAdmin(w, 'GET', '/founding')).json();

test('stripe signature: right secret and fresh timestamp only', async () => {
  const raw = '{"id":"evt_1"}', now = Date.now(), t = Math.floor(now / 1000);
  assert.equal(await verifyStripeSignature(WHSEC, raw, await sig(raw, t), now), true);
  assert.equal(await verifyStripeSignature(WHSEC, raw, await sig(raw, t, 'other'), now), false);
  assert.equal(await verifyStripeSignature(WHSEC, raw + ' ', await sig(raw, t), now), false, 'body changed');
  assert.equal(await verifyStripeSignature(WHSEC, raw, await sig(raw, t - 400), now), false, 'too old');
  assert.equal(await verifyStripeSignature(WHSEC, raw, 'garbage', now), false);
  assert.equal(await verifyStripeSignature('', raw, await sig(raw, t), now), false);
  assert.equal(await verifyStripeSignature(WHSEC, raw, undefined, now), false);
});

test('webhook fails closed: not set up, bad signature, bad body', async () => {
  const w = world(); const raw = '{"id":"evt_x","type":"customer.subscription.created","data":{"object":{}}}';
  const call = (header, body = raw) => books.fetch(new Request('https://books.test/stripe/webhook', { method: 'POST', headers: header ? { 'Stripe-Signature': header } : {}, body }), w.booksEnv);
  assert.equal((await call(await sig(raw))).status, 503, 'no secret configured');
  enable(w);
  assert.equal((await call()).status, 400); assert.equal((await call('t=1,v1=00')).status, 400);
  assert.equal((await call(await sig('not json'), 'not json')).status, 400);
  assert.equal((await call(await sig('{"x":1}'), '{"x":1}')).status, 400, 'no event id');
  assert.equal((await books.fetch(new Request('https://books.test/stripe/webhook'), w.booksEnv)).status !== 200, true, 'GET is not a webhook');
});

test('founding place: reserved by the owner, becomes active when the subscription starts, repeated events change nothing', async () => {
  const w = world(); enable(w); await enquire(w, 1); const id = await leadId(w, 1);
  await asAdmin(w, 'PUT', `/leads/${id}`, { checklist: { founding: true } });
  assert.equal((await places(w)).active, 0);
  assert.deepEqual(await (await hook(w, 'customer.subscription.created', fsub(id), { id: 'evt_same' })).json(), { activated: id });
  assert.deepEqual(await (await hook(w, 'customer.subscription.created', fsub(id), { id: 'evt_same' })).json(), { ignored: 'event already handled' });
  await hook(w, 'customer.subscription.updated', fsub(id, 'active'));
  const p = await places(w); assert.equal(p.used, 1); assert.equal(p.active, 1);
});

test('founding place: a reservation nobody pays for frees itself after 7 days', async () => {
  const w = world(); enable(w); const store = w.store;
  const op = (o, id, now) => store.fetch('https://store/founding', { method: 'POST', body: JSON.stringify({ op: o, id, now }) }).then(r => r.json());
  const t0 = Date.now();
  for (const i of [1, 2, 3, 4, 5]) assert.equal((await op('claim', `l${i}`, t0)).ok, true);
  assert.equal((await op('claim', 'l6', t0)).ok, false, 'full');
  assert.equal((await op('claim', 'l6', t0 + 6 * DAY)).ok, false, 'still held on day 6');
  assert.equal((await op('claim', 'l6', t0 + 8 * DAY)).ok, true, 'free on day 8');
  assert.equal((await op('list', undefined, t0 + 8 * DAY)).used, 1 + 0, 'the five unpaid reservations expired, only the new one is live');
});

test('founding place: cancel within 7 days gives it back, later keeps it, and a sixth founding payment is flagged not granted', async () => {
  const w = world(); enable(w); const ids = [];
  for (let i = 1; i <= 6; i++) { await enquire(w, i); ids.push(await leadId(w, i)); }
  for (const id of ids.slice(0, 5)) { await asAdmin(w, 'PUT', `/leads/${id}`, { checklist: { founding: true } }); await hook(w, 'customer.subscription.created', fsub(id)); }
  assert.equal((await places(w)).used, 5);
  // a sixth founding subscription arrives anyway (for example a link made before the places ran out)
  const six = await (await hook(w, 'customer.subscription.created', fsub(ids[5]))).json(); assert.equal(six.flagged, 'all five places were already used');
  const p = await places(w); assert.equal(p.used, 5); assert.equal(p.flags.length, 1); assert.equal(p.flags[0].id, ids[5]);
  // cancel inside 7 days: the place comes back
  assert.deepEqual(await (await hook(w, 'customer.subscription.deleted', fsub(ids[0], 'canceled'))).json(), { cancelled: ids[0], released: true });
  assert.equal((await places(w)).used, 4);
  // cancel after 7 days: the place stays used (simulated by activating 8 days ago)
  const old = Date.now() - 8 * DAY;
  await w.store.fetch('https://store/founding', { method: 'POST', body: JSON.stringify({ op: 'activate', id: ids[1], sub: `sub_${ids[1]}`, now: old }) });
  await w.storage.put(`founding:${ids[1]}`, { at: old, state: 'active', sub: `sub_${ids[1]}`, activated: old });
  assert.deepEqual(await (await hook(w, 'customer.subscription.deleted', fsub(ids[1], 'canceled'))).json(), { cancelled: ids[1], released: false });
  assert.equal((await places(w)).used, 4);
});

test('webhook ignores subscriptions that are not founding Receptionist ones', async () => {
  const w = world(); enable(w); await enquire(w, 1); const id = await leadId(w, 1);
  for (const md of [{ lead_id: id, product: 'books', founding: 'true' }, { lead_id: id, product: 'receptionist', founding: 'false' }, { lead_id: '../x', product: 'receptionist', founding: 'true' }, {}]) {
    const r = await (await hook(w, 'customer.subscription.created', { id: 'sub_z', status: 'active', metadata: md })).json(); assert.match(r.ignored, /not a founding/);
  }
  assert.match((await (await hook(w, 'invoice.paid', {})).json()).ignored, /not used/);
  assert.equal((await places(w)).used, 0);
});

function fakeStripe(t, { status = 200 } = {}) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (u, init = {}) => { if (!String(u).startsWith('https://api.stripe.com/')) return Response.json({ sid: 'SM1' }); calls.push({ url: String(u), headers: init.headers, body: init.body && String(init.body) }); return status === 200 ? Response.json({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }) : new Response('no', { status }); });
  return calls;
}
const checkout = (w, lead_id) => asAdmin(w, 'POST', '/checkout', { lead_id });

test('checkout: founding Receptionist is monthly only with a 7-day trial; others pay the setup fee; Books never gets the waiver', async (t) => {
  const w = world(); enable(w); const calls = fakeStripe(t);
  await enquire(w, 1); await enquire(w, 2); await enquire(w, 3, 'books'); const [a, b, c] = [await leadId(w, 1), await leadId(w, 2), await leadId(w, 3)];
  await asAdmin(w, 'PUT', `/leads/${a}`, { checklist: { founding: true } });
  let r = await (await checkout(w, a)).json(); assert.equal(r.founding, true); assert.equal(r.setupFee, false); assert.match(r.url, /^https:\/\/checkout\.stripe\.com\//);
  let q = new URLSearchParams(calls[0].body); assert.equal(q.get('line_items[0][price]'), 'price_rec'); assert.equal(q.get('line_items[1][price]'), null); assert.equal(q.get('subscription_data[trial_period_days]'), '7'); assert.equal(q.get('subscription_data[metadata][founding]'), 'true'); assert.equal(q.get('mode'), 'subscription');
  assert.equal(calls[0].headers.Authorization, `Bearer ${SK}`); assert.ok(calls[0].headers['Idempotency-Key']);
  r = await (await checkout(w, b)).json(); assert.equal(r.founding, false); assert.equal(r.setupFee, true);
  q = new URLSearchParams(calls[1].body); assert.deepEqual([q.get('line_items[0][price]'), q.get('line_items[1][price]')], ['price_rec', 'price_rec_setup']); assert.equal(q.get('subscription_data[metadata][founding]'), 'false');
  r = await (await checkout(w, c)).json(); q = new URLSearchParams(calls[2].body);
  assert.deepEqual([q.get('line_items[0][price]'), q.get('line_items[1][price]')], ['price_books', 'price_books_setup']); assert.equal(q.get('subscription_data[trial_period_days]'), null, 'Books has no trial'); assert.equal(q.get('subscription_data[metadata][founding]'), 'false');
  assert.ok(!JSON.stringify(r).includes(SK), 'the key never leaves');
});

test('checkout: a sixth founding link is refused, missing setup is explained, nothing is called without full setup', async (t) => {
  const w = world(); const calls = fakeStripe(t); const ids = [];
  for (let i = 1; i <= 6; i++) { await enquire(w, i); ids.push(await leadId(w, i)); }
  const r0 = await checkout(w, ids[0]); assert.equal(r0.status, 503); assert.match((await r0.json()).error, /STRIPE_SECRET_KEY/);
  assert.equal(calls.length, 0, 'no Stripe call without setup');
  enable(w); delete w.booksEnv.STRIPE_PRICE_BOOKS_SETUP;
  await enquire(w, 7, 'books'); const bid = await leadId(w, 7); const rb = await checkout(w, bid); assert.equal(rb.status, 503); assert.match((await rb.json()).error, /STRIPE_PRICE_BOOKS_SETUP/);
  w.booksEnv.STRIPE_PRICE_BOOKS_SETUP = 'price_books_setup';
  for (const id of ids.slice(0, 5)) await asAdmin(w, 'PUT', `/leads/${id}`, { checklist: { founding: true } });
  // the sixth lead cannot even be ticked, and a hand-made tick cannot sneak through checkout
  assert.equal((await asAdmin(w, 'PUT', `/leads/${ids[5]}`, { checklist: { founding: true } })).status, 500);
  const l6 = await (await w.store.fetch(`https://store/lead/${ids[5]}`)).json(); l6.checklist.founding = true; await w.store.fetch(`https://store/lead/${ids[5]}`, { method: 'PUT', body: JSON.stringify(l6) });
  const r6 = await checkout(w, ids[5]); assert.equal(r6.status, 409); assert.equal(calls.length, 0);
  assert.equal((await checkout(w, 'nosuchlead')).status, 404);
  const unsure = await books.fetch(new Request('https://books.test/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://www.localdeskai.co.uk', 'CF-Connecting-IP': '203.0.113.200' }, body: JSON.stringify({ name: 'Pay 9', phone: '07700 939999', product: 'unsure' }) }), w.booksEnv);
  assert.equal((await checkout(w, await leadId(w, 9))).status, 400);
});

test('checkout: Stripe errors are reported plainly and the lead is untouched; only the admin can use it', async (t) => {
  const w = world(); enable(w); fakeStripe(t, { status: 402 }); await enquire(w, 1); const id = await leadId(w, 1);
  const r = await checkout(w, id); assert.equal(r.status, 502); assert.match((await r.json()).error, /status 402/);
  const anon = await books.fetch(new Request('https://books.test/checkout', { method: 'POST', body: JSON.stringify({ lead_id: id }) }), w.booksEnv); assert.equal(anon.status, 403);
  assert.throws(() => checkoutParams({}, { id: 'x', product: 'unsure' }, false), /Receptionist or Books/);
});
