// Which product a Stripe subscription is, and what counts as paying. Pure functions, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyProduct, priceConfig, progress, subscriptionFacts } from '../workers/hq/leads.js';

const cfg = (b = '', r = '') => priceConfig({ STRIPE_PRICES_BOOKS: b, STRIPE_PRICES_RECEPTIONIST: r });
const product = (v) => ({ product: { metadata: { localdesk_product: v } } });

test('a price is a product only by its ID or its Stripe product metadata, never by its name', () => {
  assert.equal(classifyProduct({ id: 'p1', nickname: 'Books monthly' }, cfg()), null);
  assert.equal(classifyProduct({ id: 'p1', nickname: 'Books monthly', ...product('books') }, cfg()), 'books');
  assert.equal(classifyProduct({ id: 'p1', ...product('receptionist') }, cfg()), 'receptionist');
  assert.equal(classifyProduct({ id: 'p1', ...product('something else') }, cfg()), null);
  assert.equal(classifyProduct({ id: 'p1', product: 'prod_unexpanded' }, cfg()), null);
  assert.equal(classifyProduct({ id: 'p9' }, cfg(' p9 , p8')), 'books');
  assert.equal(classifyProduct({ id: 'p9' }, cfg('', 'p9')), 'receptionist');
  assert.equal(classifyProduct({ id: 'p9' }, cfg('p9', 'p9')), null, 'listed under both is ambiguous');
  assert.equal(classifyProduct({ id: 'p1', ...product('receptionist') }, cfg('p1')), 'books', 'a listed price ID wins over metadata');
  assert.equal(classifyProduct(null, cfg()), null);
});

test('paying needs a classified, active, priced subscription with a paid latest invoice', () => {
  const s = (o) => ({ status: 'active', per: 150, product: 'books', invoicePaid: true, who: 'x', ...o });
  const pr = progress([
    s({}), s({ product: 'receptionist', per: 397 }),
    s({ invoicePaid: false }), s({ invoicePaid: null }),            // active but not confirmed paid
    s({ status: 'trialing' }), s({ status: 'past_due' }), s({ status: 'unpaid' }), s({ status: 'canceled' }),
    s({ per: 0 }),                                                    // free
    s({ product: null }), s({ product: null, status: 'canceled' }),    // unmatched
  ]);
  assert.equal(pr.books, 1); assert.equal(pr.receptionist, 1); assert.equal(pr.mrr, 547);
  assert.equal(pr.unconfirmed.length, 2, 'active but the latest invoice is unpaid or unknown');
  assert.equal(pr.trial.length, 1); assert.equal(pr.atRisk.length, 2);
  assert.equal(pr.unclassified.length, 1, 'a cancelled unmatched subscription is not worth flagging');
  assert.equal(pr.target, 20);
});

test('a subscription is read from all its recurring items, and odd shapes stay unclassified', () => {
  const rec = (id, amount, meta, extra = {}) => ({ quantity: 1, price: { id, unit_amount: amount, currency: 'gbp', recurring: { interval: 'month' }, product: { metadata: { localdesk_product: meta } }, ...extra } });
  const facts = (items, c = cfg()) => subscriptionFacts({ items: { data: items } }, c);
  // a one-off setup price is ignored, whatever order Stripe lists the items in
  const setup = { quantity: 1, price: { id: 'setup', unit_amount: 39500, currency: 'gbp', product: { metadata: { localdesk_product: 'books' } } } };
  assert.deepEqual(facts([setup, rec('m', 15000, 'books')]), { per: 150, product: 'books', priceId: 'm', plan: 'Subscription' });
  assert.equal(facts([rec('m', 15000, 'books'), setup]).per, 150);
  // two recurring items of the same product add up (monthly plus an add-on)
  const both = facts([rec('m', 15000, 'books'), rec('q', 2500, 'books')]); assert.equal(both.per, 175); assert.equal(both.product, 'books');
  // mixed products, one unverified item, or a non-pound price: ambiguous, so unclassified
  assert.equal(facts([rec('m', 15000, 'books'), rec('r', 39700, 'receptionist')]).product, null);
  assert.equal(facts([rec('m', 15000, 'books'), rec('x', 1000, 'mystery')]).product, null);
  assert.equal(facts([rec('m', 15000, 'books', { currency: 'usd' })]).product, null);
  // quantity, yearly and every-3-months prices become a monthly figure
  assert.equal(facts([{ ...rec('m', 15000, 'books'), quantity: 2 }]).per, 300);
  assert.equal(facts([rec('y', 120000, 'books', { recurring: { interval: 'year' } })]).per, 100);
  assert.equal(facts([rec('t', 45000, 'books', { recurring: { interval: 'month', interval_count: 3 } })]).per, 150);
  // weekly or unknown intervals, missing prices and no items cannot be priced
  assert.deepEqual(facts([rec('w', 1000, 'books', { recurring: { interval: 'week' } })]), { per: 0, product: null, priceId: 'w', plan: 'Subscription' });
  assert.equal(facts([]).product, null); assert.equal(facts([{ quantity: 1 }]).per, 0);
  assert.equal(subscriptionFacts({}, cfg()).product, null);
  // a price ID listed in the settings classifies it even without product metadata
  assert.equal(facts([{ quantity: 1, price: { id: 'mine', unit_amount: 15000, currency: 'gbp', recurring: { interval: 'month' } } }], cfg('mine')).product, 'books');
});
