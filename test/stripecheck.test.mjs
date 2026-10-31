// "Is Stripe set up right?": the four prices are checked against the canonical figures, and no secret is ever shown. Fake Stripe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, keyMode, EXPECTED } from '../workers/hq/stripecheck.js';
import { world, asAdmin } from './harness.mjs';

const ids = { receptionist: 'price_rec', receptionist_setup: 'price_recs', books: 'price_bk', books_setup: 'price_bks' };
const good = (over = {}) => ({
  receptionist: { id: 'price_rec', currency: 'gbp', unit_amount: 39700, recurring: { interval: 'month', interval_count: 1 }, livemode: false, active: true },
  receptionist_setup: { id: 'price_recs', currency: 'gbp', unit_amount: 49700, recurring: null, livemode: false, active: true },
  books: { id: 'price_bk', currency: 'gbp', unit_amount: 15000, recurring: { interval: 'month', interval_count: 1 }, livemode: false, active: true },
  books_setup: { id: 'price_bks', currency: 'gbp', unit_amount: 39500, recurring: null, livemode: false, active: true }, ...over });
const status = (over = {}) => ({ secretKey: true, webhookSecret: true, prices: ids, ...over });
const run = (o) => evaluate({ status: status(), fetched: good(), hqKey: 'rk_test_abc', hqMonthlyIds: new Set(['price_rec', 'price_bk']), ...o });

test('canonical figures are fixed in the checker', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(EXPECTED).map(([k, v]) => [k, [v.amount, v.monthly]])), { receptionist: [39700, true], receptionist_setup: [49700, false], books: [15000, true], books_setup: [39500, false] });
  assert.deepEqual(['rk_test_x', 'sk_live_x', 'whatever', ''].map(keyMode), ['test', 'live', 'unknown', 'none']);
});

test('everything right in test mode is ready', () => { const r = run(); assert.equal(r.ready, true); assert.equal(r.mode, 'test'); assert.ok(r.rows.every(x => !x.problems.length)); assert.match(r.general.map(g => g.text).join(' '), /TEST mode/); });

test('each mistake is named in plain words', () => {
  const say = (o) => JSON.stringify(run(o).rows.map(r => r.problems));
  assert.match(say({ fetched: good({ receptionist: { ...good().receptionist, unit_amount: 39500 } }) }), /Amount is £395, it should be £397/);
  assert.match(say({ fetched: good({ receptionist_setup: { ...good().receptionist_setup, unit_amount: 39700 } }) }), /should be £497/);
  assert.match(say({ fetched: good({ books: { ...good().books, unit_amount: 39500 } }) }), /should be £150/);
  assert.match(say({ fetched: good({ books_setup: { ...good().books_setup, unit_amount: 15000 } }) }), /should be £395/);
  assert.match(say({ fetched: good({ books: { ...good().books, currency: 'usd' } }) }), /Currency is USD/);
  assert.match(say({ fetched: good({ books: { ...good().books, recurring: { interval: 'year' } } }) }), /repeat every month/);
  assert.match(say({ fetched: good({ books_setup: { ...good().books_setup, recurring: { interval: 'month' } } }) }), /one-off price/);
  assert.match(say({ fetched: good({ books: { ...good().books, active: false } }) }), /archived/);
  assert.match(say({ fetched: good({ books: { ...good().books, livemode: true } }) }), /other mode/);
  assert.match(say({ fetched: good({ books: { error: 'No such price' } }) }), /could not find price_bk/);
  assert.match(say({ status: status({ prices: { ...ids, books_setup: null } }) }), /STRIPE_PRICE_BOOKS_SETUP in Cloudflare/);
  assert.match(say({ hqMonthlyIds: new Set(['price_bk']) }), /Add price_rec to STRIPE_PRICES_RECEPTIONIST/);
  assert.match(say({ hqMonthlyIds: new Set() }), /STRIPE_PRICES_BOOKS/);
  assert.equal(run({ fetched: good({ books: { ...good().books, unit_amount: 1 } }) }).ready, false);
});

test('missing secrets, no HQ key, live mode and an unreachable Books worker are all flagged; nothing is ready then', () => {
  assert.equal(run({ status: status({ secretKey: false }) }).ready, false); assert.match(run({ status: status({ secretKey: false }) }).general[0].text, /STRIPE_SECRET_KEY/);
  assert.match(run({ status: status({ webhookSecret: false }) }).general[1].text, /STRIPE_WEBHOOK_SECRET/);
  const noKey = run({ hqKey: undefined }); assert.equal(noKey.ready, false); assert.ok(noKey.rows.every(r => r.unchecked)); assert.match(JSON.stringify(noKey.general), /no read-only STRIPE_KEY/);
  const live = run({ hqKey: 'rk_live_abc', fetched: Object.fromEntries(Object.entries(good()).map(([k, v]) => [k, { ...v, livemode: true }])) }); assert.match(live.general[2].text, /LIVE mode/); assert.equal(live.general[2].warn, true);
  const down = evaluate({ status: null, fetched: {}, hqKey: 'rk_test_abc' }); assert.equal(down.ready, false); assert.match(down.general[0].text, /Could not ask the Books worker/);
});

test('the Books status route gives names and price ids only, never a secret, and only to the admin', async () => {
  const w = world(); Object.assign(w.booksEnv, { STRIPE_SECRET_KEY: ['rk', 'test', 'SECRETVALUE'].join('_'), STRIPE_WEBHOOK_SECRET: ['whsec', 'SECRETVALUE'].join('_'), STRIPE_PRICE_BOOKS: 'price_bk' });
  const body = await (await asAdmin(w, 'GET', '/stripe/status')).text(); const j = JSON.parse(body);
  assert.equal(j.secretKey, true); assert.equal(j.webhookSecret, true); assert.equal(j.prices.books, 'price_bk'); assert.equal(j.prices.receptionist, null); assert.ok(!body.includes('SECRETVALUE'));
  const { default: books } = await import('../workers/books/worker.js');
  assert.equal((await books.fetch(new Request('https://books.test/stripe/status'), w.booksEnv)).status, 403);
});
