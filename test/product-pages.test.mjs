// The Receptionist and Books pages: shared design file, commercial terms, forms, legal links and honest platform wording.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../public/${p}`, import.meta.url), 'utf8');
const rec = read('receptionist/index.html'), books = read('books/index.html');
const text = (h) => h.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('both pages use the shared design file and keep their canonical address and legal links', () => {
  assert.ok(existsSync(new URL('../public/ui.css', import.meta.url)));
  for (const [h, canon, legal] of [[rec, 'https://www.localdeskai.co.uk/receptionist/', ['../privacy.html', '../terms.html']], [books, 'https://www.localdeskai.co.uk/books/', ['privacy.html', 'terms.html', '../privacy.html', '../terms.html']]]) {
    assert.match(h, /<link rel="stylesheet" href="\.\.\/ui\.css">/);
    assert.ok(h.includes(`rel="canonical" href="${canon}"`));
    for (const l of legal) assert.ok(h.includes(`href="${l}"`), l);
  }
});

test('commercial terms are unchanged', () => {
  const r = text(rec), b = text(books);
  for (const t of ['£397', '7-day free trial', '300 minutes', '25p', '£497', 'first 5 founding clients', '3-month minimum', '30 days']) assert.ok(r.includes(t), `Receptionist: ${t}`);
  for (const t of ['£150', '£395', '30 days', 'No VAT to add', 'Now taking']) assert.ok(b.includes(t), `Books: ${t}`);
  assert.ok(r.includes('£150') && r.includes('£395'), 'Receptionist still shows the Books price in its Also from Localdesk card');
});

test('both enquiry forms keep their fields, spam trap and handler', () => {
  for (const h of [rec, books]) {
    for (const n of ['name', 'phone', 'business', 'message', 'website', 'product']) assert.match(h, new RegExp(`name="${n}"`));
    assert.match(h, /class="hp"/); assert.match(h, /tabindex="-1"/);
    assert.match(h, /books\.localdeskai\.co\.uk\/enquiry/);
  }
});

test('Books names the three platforms and says plainly what works where', () => {
  const b = text(books), h = text(read('index.html'));
  for (const t of [b, h]) { assert.match(t, /QuickBooks/); assert.match(t, /FreeAgent/); assert.match(t, /Xero/); }
  assert.doesNotMatch(b + h, /Xero[^.]{0,80}being verified/i, 'Xero is verified now');
  assert.match(b, /live FreeAgent companies are still being confirmed/i);
  assert.match(b, /Quotes, profit per job and the quarterly accountant pack[^.]{0,40}QuickBooks only for now/);
  assert.match(h, /Quotes and the quarterly accountant pack are QuickBooks-only for now/);
  assert.doesNotMatch(b, /filed in your QuickBooks|set up on your QuickBooks|connect Books to your QuickBooks/i, 'no QuickBooks-only claims left');
  assert.doesNotMatch(text(rec), /filed in your QuickBooks/i);
});

test('the monthly books-check is described as flags only, never as certifying or replacing an accountant', () => {
  const b = text(books);
  assert.match(b, /flags missing receipts and anything else that needs your attention/i);
  assert.match(b, /doesn't check that your accounts are right, certify them, or replace your accountant/i);
  assert.match(text(read('index.html')), /doesn't replace your accountant/i);
  for (const h of [books, read('index.html'), rec]) assert.doesNotMatch(text(h), /(certif(ies|y) your (books|accounts))|(audit(s|ed)? your)|(guarantee[sd]? (your )?(books|accounts))/i);
});

test('no page claims a legal requirement for identity checks', () => {
  for (const f of ['index.html', 'books/index.html', 'receptionist/index.html']) assert.doesNotMatch(text(read(f)), /(the law requires|required by law|legal requirement|money laundering)/i, f);
  assert.match(text(books), /quick identity check/);
});

test('the missed-call calculator is labelled as an estimate', () => {
  const r = text(rec);
  assert.match(r, /Estimate: what could missed calls be costing you/);
  assert.match(r, /The figures below are estimates, not results/);
  assert.match(rec, /class="est">Estimated</);
  assert.match(r, /It is not a promise or a forecast/);
});

test('prices are the same wherever they appear', () => {
  const pages = { home: text(read('index.html')), rec: text(rec), books: text(books) };
  for (const [name, t] of Object.entries(pages)) {
    for (const bad of [/£39[0-6]\s*a month/, /£14\d\s*a month/, /£15[1-9]\s*a month/]) if (name !== 'books' || bad !== /£39[0-6]\s*a month/) assert.doesNotMatch(t, bad.source.includes('39') ? /£(39[0-6]|398|399)\s*a month/ : bad, `${name}: ${bad}`);
  }
  assert.ok(pages.home.includes('£397') && pages.home.includes('£150') && pages.home.includes('£395') && pages.home.includes('£497'));
  assert.ok(pages.books.includes('£150') && pages.books.includes('£395') && !pages.books.includes('£397'));
});

test('the Receptionist page keeps its call demo, calculator and sticky booking bar', () => {
  for (const id of ['phone', 'replay', 'calc', 'c-calls', 'o-loss', 'lines', 'talk', 'orb', 'mbar', 'clock']) assert.match(rec, new RegExp(`id="${id}"`), id);
});
