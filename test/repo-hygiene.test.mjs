// This repository is PUBLIC. This test fails if personal data, key-shaped strings or private links get committed.
// Run:  node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const files = execSync('git ls-files', { cwd: root }).toString().split('\n').filter(f => f && /\.(md|js|mjs|cjs|json|jsonc|html|css|txt|py|toml|yml|yaml)$/i.test(f) && !f.startsWith('public/vendor/'));
const lines = [];
for (const f of files) readFileSync(root + f, 'utf8').split('\n').forEach((text, i) => { if (text.length < 1500) lines.push({ f, n: i + 1, text }); }); // very long lines are embedded images
const mask = (s) => s.slice(0, 4) + '…';

// Numbers that are allowed to appear: the public demo line on the website, Ofcom's reserved fictional range
// (07700 900000–900999, used in tests and website examples), and the owner's own mobile in the two files
// that show it to clients as the support number. That last one is the owner's call (PENDING APPROVAL).
const PUBLIC_LINE = '01752741686';
const OWNER_HASH = '359f2167f1a801cfe6a6d9b8725eaae878b8f415c1481b5a27081c2c7d55aa23'; // sha-256 of the number, so the number itself isn't in this file
const ICO_HELPLINE = '03031231113';        // the Information Commissioner's public helpline, on the privacy page
const OWNER_ONLY_IN = ['workers/receipt-demo/page.js', 'workers/books/worker.js'];

test('no personal phone numbers (prospects, partners, clients) in the repo', () => {
  const bad = [];
  for (const { f, n, text } of lines) {
    for (const m of text.matchAll(/(?:\+44|\b0)[\d ]{9,12}\d/g)) {
      let d = m[0].replace(/\D/g, ''); if (d.startsWith('44')) d = '0' + d.slice(2);
      if (d.length < 10 || d.length > 11) continue;
      if (d === PUBLIC_LINE || d === ICO_HELPLINE || /^07700900\d{3}$/.test(d)) continue;
      if (createHash('sha256').update(d).digest('hex') === OWNER_HASH && OWNER_ONLY_IN.includes(f)) continue;
      bad.push(`${f}:${n} has a phone number (${mask(d)})`);
    }
  }
  assert.deepEqual(bad, []);
});

test('no keys, tokens or secrets by shape', () => {
  const shapes = [/\bAC[0-9a-f]{32}\b/, /\bSK[0-9a-f]{32}\b/, /sk_(live|test)_[A-Za-z0-9]{8,}/, /rk_live_[A-Za-z0-9]{8,}/, /whsec_[A-Za-z0-9]{8,}/, /ghp_[A-Za-z0-9]{20,}/, /xox[bp]-[0-9A-Za-z-]{10,}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY/, /"d" ?: ?"[A-Za-z0-9_-]{30,}"/, /\bAB[A-Za-z0-9]{40,}\b/, /[Bb]earer [A-Za-z0-9._-]{30,}/, /x-vapi-secret['"]? ?[:=] ?['"][A-Za-z0-9]{8,}/];
  const bad = [];
  for (const { f, n, text } of lines) for (const re of shapes) { const m = text.match(re); if (m) bad.push(`${f}:${n} looks like a secret (${mask(m[0])})`); }
  assert.deepEqual(bad, []);
});

test('the old demo app key is gone (it was published in two commits, so it is treated as burned)', () => {
  const burned = '7998baa3d8c627d24265503034e02c3ff9489941acf80eb275e1370208afb475'; // sha-256 of the old key, so the key itself isn't here
  const bad = [];
  for (const { f, n, text } of lines) for (const t of text.match(/[A-Za-z0-9_-]{12}/g) || []) if (createHash('sha256').update(t).digest('hex') === burned) bad.push(`${f}:${n}`);
  assert.deepEqual(bad, []);
});

test('no private links or key-in-URL patterns', () => {
  const bad = [];
  for (const { f, n, text } of lines) {
    if (/claude\.ai\/artifact\//.test(text)) bad.push(`${f}:${n} has a private claude.ai link`);
    if (/searchParams\.get\('k'\)/.test(text) && f.startsWith('workers/')) bad.push(`${f}:${n} reads an admin key from the web address`);
  }
  assert.deepEqual(bad, []);
});

test('no personal email addresses (only the business\'s own, and obvious examples)', () => {
  const ok = /@(localdeskai\.co\.uk|example\.(com|co\.uk|test|org)|example\.test)$/i;
  const bad = [];
  for (const { f, n, text } of lines) for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g)) if (!ok.test(m[0])) bad.push(`${f}:${n} has an email address (${mask(m[0])})`);
  assert.deepEqual(bad, []);
});
