// Which product a Stripe subscription is, and what counts as paying. Pure functions, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyProduct, priceConfig, progress } from '../workers/hq/leads.js';

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
