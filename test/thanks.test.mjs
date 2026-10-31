// The page a customer lands on after paying: honest, safe, not indexed, no scripts, no claims about timing or price.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkoutParams } from '../workers/books/stripe.js';

const html = readFileSync('public/thanks.html', 'utf8');
test('the thank-you pages do not promise a receipt (a trial sign-up has no payment, so none would be sent)', async () => {
  const { readFileSync } = await import('node:fs'); const w = readFileSync('workers/books/worker.js', 'utf8'), p = readFileSync('public/thanks.html', 'utf8');
  for (const t of [w.slice(w.indexOf('const THANKS_PAGE'), w.indexOf('const FOUNDING_PLACES')), p]) { assert.ok(!/receipt/i.test(t.replace(/<style>[\s\S]*?<\/style>/, ''))); assert.match(t, /tell you before anything is charged/); }
});

test('thanks page: not indexed, no scripts, legal links work, makes no promise of timing or price', () => {
  assert.match(html, /<meta name="robots" content="noindex">/); assert.ok(!/<script/i.test(html));
  assert.match(html, /href="terms\.html"/); assert.match(html, /href="privacy\.html"/); assert.match(html, /mailto:hello@localdeskai\.co\.uk/);
  assert.ok(!/£|within \d|hours|today|tomorrow|guarantee/i.test(html.replace(/<head>[\s\S]*<\/head>/, '')), 'no price, timing or guarantee claims');
  assert.ok(!html.includes('—'));
});
test('checkout sends customers to the thanks page by default, and the owner can override it', () => {
  const lead = { id: 'L1', product: 'books' }, env = { STRIPE_PRICE_BOOKS: 'a', STRIPE_PRICE_BOOKS_SETUP: 'b' };
  assert.equal(checkoutParams(env, lead, false).get('success_url'), 'https://books.localdeskai.co.uk/thanks');
  assert.equal(checkoutParams({ ...env, CHECKOUT_SUCCESS_URL: 'https://x.example/ok' }, lead, false).get('success_url'), 'https://x.example/ok');
});

test('the thank-you page is served by the Books worker, so the payment redirect never 404s before the website is published', async () => {
  const { world } = await import('./harness.mjs'); const { default: books } = await import('../workers/books/worker.js'); const w = world();
  const res = await books.fetch(new Request('https://books.test/thanks'), w.booksEnv); assert.equal(res.status, 200);
  const h = await res.text(); assert.match(h, /<meta name="robots" content="noindex">/); assert.ok(!/<script/i.test(h)); assert.match(h, /Thank you/); assert.match(h, /mailto:hello@localdeskai\.co\.uk/); assert.ok(!/£|within \d|guarantee|today|tomorrow/i.test(h.replace(/<style>[\s\S]*<\/style>/, '')), 'no price, timing or guarantee claims');
  assert.equal(res.headers.get('x-robots-tag'), 'noindex'); assert.match(res.headers.get('content-security-policy'), /default-src 'none'/); assert.match(res.headers.get('content-security-policy'), /script-src 'none'/, 'scripts are forbidden outright');
  assert.equal((await books.fetch(new Request('https://books.test/thanks', { method: 'HEAD' }), w.booksEnv)).status, 200); assert.notEqual((await books.fetch(new Request('https://books.test/thanks', { method: 'POST', body: '{}' }), w.booksEnv)).status, 200, 'only GET and HEAD');
});
