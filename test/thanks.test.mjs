// The page a customer lands on after paying: honest, safe, not indexed, no scripts, no claims about timing or price.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkoutParams } from '../workers/books/stripe.js';

const html = readFileSync('public/thanks.html', 'utf8');
test('thanks page: not indexed, no scripts, legal links work, makes no promise of timing or price', () => {
  assert.match(html, /<meta name="robots" content="noindex">/); assert.ok(!/<script/i.test(html));
  assert.match(html, /href="terms\.html"/); assert.match(html, /href="privacy\.html"/); assert.match(html, /mailto:hello@localdeskai\.co\.uk/);
  assert.ok(!/£|within \d|hours|today|tomorrow|guarantee/i.test(html.replace(/<head>[\s\S]*<\/head>/, '')), 'no price, timing or guarantee claims');
  assert.ok(!html.includes('—'));
});
test('checkout sends customers to the thanks page by default, and the owner can override it', () => {
  const lead = { id: 'L1', product: 'books' }, env = { STRIPE_PRICE_BOOKS: 'a', STRIPE_PRICE_BOOKS_SETUP: 'b' };
  assert.equal(checkoutParams(env, lead, false).get('success_url'), 'https://www.localdeskai.co.uk/thanks.html');
  assert.equal(checkoutParams({ ...env, CHECKOUT_SUCCESS_URL: 'https://x.example/ok' }, lead, false).get('success_url'), 'https://x.example/ok');
});
