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

test('Books says accurately which software it works with, and what is still being verified', () => {
  const b = text(books);
  assert.match(b, /QuickBooks/); assert.match(b, /FreeAgent/); assert.match(b, /Xero/);
  assert.match(b, /Xero[^.]{0,80}(being verified|still being verified)/i);
  assert.match(b, /live FreeAgent companies are still being confirmed/i);
  assert.match(b, /QuickBooks only for now/);
  assert.doesNotMatch(b, /filed in your QuickBooks|set up on your QuickBooks|connect Books to your QuickBooks/i, 'no QuickBooks-only claims left');
  assert.doesNotMatch(text(rec), /filed in your QuickBooks/i);
});

test('the Receptionist page keeps its call demo, calculator and sticky booking bar', () => {
  for (const id of ['phone', 'replay', 'calc', 'c-calls', 'o-loss', 'lines', 'talk', 'orb', 'mbar', 'clock']) assert.match(rec, new RegExp(`id="${id}"`), id);
});
