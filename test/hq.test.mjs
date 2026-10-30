// Owner HQ: login (passphrase + authenticator), lockout, sessions, pages, the Books admin proxy. Fake Books, Stripe and storage.
import test from 'node:test';
import assert from 'node:assert/strict';
import hq, { Vault, totp, backupDaily } from '../workers/hq/worker.js';
import { MemStorage } from './harness.mjs';

const PASS = 'correct horse battery staple', ADMIN = 'books-admin-key-for-tests', STRIPE = 'rk_test_hq_readonly';
const BOOKS_HTML = '<!doctype html><html lang="en"><head><title>Books admin</title></head><body><div id="app"></div><script nonce="abc123">var KEY="";</script></body></html>';

function world(extra = {}, t) {
  const storage = new MemStorage(); const vault = new Vault({ storage });
  const stub = { fetch: (u, init) => vault.fetch(new Request(u, init)) };
  const booksCalls = [];
  const env = {
    OWNER_PASSWORD: PASS, ADMIN_KEY: ADMIN, STRIPE_KEY: STRIPE,
    VAULT: { idFromName: () => 'owner', get: () => stub },
    BOOKS: { fetch: async (url, init = {}) => {
      const path = new URL(url).pathname; const key = (init.headers || {})['X-Key']; booksCalls.push({ path, method: init.method || 'GET', key });
      if (path === '/admin') return new Response(BOOKS_HTML, { headers: { 'Content-Type': 'text/html' } });
      if (key !== ADMIN) return new Response('Not allowed', { status: 403 });
      if (path === '/health') return Response.json({ clients: [{ name: 'Real Plumbing', ok: true, filed: 4, toTidy: 2, late: 1, seenDays: 0 }, { name: '<img src=x onerror=alert(1)>', ok: false, problem: 'QuickBooks 401' }] });
      if (path === '/backup') return Response.json({ version: 1, entries: {} });
      return Response.json({ ok: true, path });
    } },
    ...extra,
  };
  if (t) t.mock.method(globalThis, 'fetch', async (u) => {
    const path = String(u);
    if (path.includes('/subscriptions')) return Response.json({ data: [{ id: 's1', status: 'active', created: 1790000000, customer: { name: 'Real Plumbing', email: 'p@example.test' }, items: { data: [{ quantity: 1, price: { unit_amount: 15000, nickname: 'Books monthly', recurring: { interval: 'month' } } }] } }, { id: 's2', status: 'past_due', created: 1790000000, customer: { email: 'late@example.test' }, items: { data: [{ quantity: 1, price: { unit_amount: 39700, nickname: 'Growth', recurring: { interval: 'month' } } }] } }] });
    if (path.includes('/charges')) return Response.json({ data: [{ created: 1790000000, amount: 15000, paid: true, billing_details: { name: 'Real Plumbing' } }] });
    return Response.json({});
  });
  return { env, storage, booksCalls };
}
const call = (w, path, { method = 'GET', form, cookie, ip = '203.0.113.5', headers = {} } = {}) => hq.fetch(new Request('https://hq.test' + path, {
  method, redirect: 'manual',
  headers: { ...(cookie ? { Cookie: cookie } : {}), 'CF-Connecting-IP': ip, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...headers },
  body: form ? new URLSearchParams(form).toString() : undefined }), w.env);
const setupKey = (html) => /<code>([A-Z2-7]{32})<\/code>/.exec(html)[1];
const sessionCookie = (res) => (res.headers.get('set-cookie') || '').split(';')[0];

async function enrol(w, t) {
  const first = await call(w, '/login', { method: 'POST', form: { password: PASS } });
  const key = setupKey(await first.text());
  const code = await totp(key, Math.floor(Date.now() / 30000));
  const ok = await call(w, '/login', { method: 'POST', form: { password: PASS, code } });
  return { key, res: ok, cookie: sessionCookie(ok), code };
}

test('with no passphrase set, HQ is switched off and nothing gets in', async () => {
  const w = world({ OWNER_PASSWORD: undefined });
  for (const p of ['/', '/login', '/customers', '/ba/health']) assert.equal((await call(w, p)).status, 503, p);
});

test('a visitor who is not logged in is sent to the login page, with strict headers and no scripts', async () => {
  const w = world();
  for (const p of ['/', '/customers', '/products', '/settings', '/docs', '/backups', '/books-admin']) {
    const r = await call(w, p); assert.equal(r.status, 303, p); assert.equal(r.headers.get('location'), '/login', p);
  }
  assert.equal((await call(w, '/ba/health')).status, 401);
  const login = await call(w, '/login');
  assert.equal(login.status, 200);
  const csp = login.headers.get('content-security-policy');
  assert.match(csp, /default-src 'none'/); assert.doesNotMatch(csp, /script-src/); assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(login.headers.get('x-frame-options'), 'DENY'); assert.equal(login.headers.get('cache-control'), 'no-store');
  assert.match(login.headers.get('x-robots-tag'), /noindex/); assert.equal(login.headers.get('referrer-policy'), 'no-referrer');
  assert.ok(!(await login.text()).includes('<script'));
});

test('first login enrols the authenticator: a wrong code fails, the right one logs in with a locked-down cookie', async (t) => {
  const w = world({}, t);
  const first = await call(w, '/login', { method: 'POST', form: { password: PASS } });
  const html = await first.text(); assert.equal(first.status, 200); assert.match(html, /setup key/i);
  const key = setupKey(html);
  const bad = await call(w, '/login', { method: 'POST', form: { password: PASS, code: '000000' } });
  assert.equal(bad.status, 401); assert.equal(bad.headers.get('set-cookie'), null);
  const good = await call(w, '/login', { method: 'POST', form: { password: PASS, code: await totp(key, Math.floor(Date.now() / 30000)) } });
  assert.equal(good.status, 303); assert.equal(good.headers.get('location'), '/');
  const c = good.headers.get('set-cookie');
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) assert.match(c, new RegExp(flag));
  assert.equal((await call(w, '/', { cookie: sessionCookie(good) })).status, 200);
});

test('a wrong passphrase, an empty one and a right one with a wrong code all fail the same way', async (t) => {
  const w = world({}, t); const { key } = await enrol(w, t);
  for (const form of [{ password: 'nope', code: '123456' }, { password: '', code: '' }, { password: PASS, code: '111111' }, { password: PASS }]) {
    const r = await call(w, '/login', { method: 'POST', form, ip: '198.51.100.1' + Math.floor(Math.random() * 90) });
    assert.equal(r.status, 401); assert.match(await r.text(), /That did not work/);
  }
  assert.ok(key);
});

test('five wrong tries lock that visitor out for a while, but not the owner from somewhere else', async (t) => {
  const w = world({}, t); const { key } = await enrol(w, t);
  for (let i = 0; i < 5; i++) await call(w, '/login', { method: 'POST', form: { password: 'wrong', code: '000000' }, ip: '192.0.2.50' });
  const locked = await call(w, '/login', { method: 'POST', form: { password: PASS, code: await totp(key, Math.floor(Date.now() / 30000) + 1) }, ip: '192.0.2.50' });
  assert.equal(locked.status, 429, 'even the right answer is refused while locked');
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 31000 });
  const elsewhere = await call(w, '/login', { method: 'POST', form: { password: PASS, code: await totp(key, Math.floor(Date.now() / 30000)) }, ip: '192.0.2.99' });
  assert.equal(elsewhere.status, 303);
});

test('an authenticator code cannot be used twice, and sessions stop working when tampered with, expired or logged out', async (t) => {
  const w = world({}, t); const first = await enrol(w, t);
  const replay = await call(w, '/login', { method: 'POST', form: { password: PASS, code: first.code }, ip: '192.0.2.7' });
  assert.equal(replay.status, 401, 'the same code again is refused');
  const bits = first.cookie.split('.'); const forged = bits.slice(0, 2).join('.') + '.' + '0'.repeat(64);
  assert.equal((await call(w, '/', { cookie: forged })).status, 303, 'forged signature');
  assert.equal((await call(w, '/', { cookie: first.cookie })).status, 200);
  const out = await call(w, '/logout', { method: 'POST', cookie: first.cookie });
  assert.equal(out.status, 303); assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 13 * 3600 * 1000 });
  assert.equal((await call(w, '/', { cookie: first.cookie })).status, 303, 'a session lasts 12 hours');
});

test('the pages show Books and Stripe data, escape what clients typed, and never show a secret', async (t) => {
  const w = world({}, t); const { cookie } = await enrol(w, t);
  let all = '';
  for (const p of ['/', '/customers', '/products', '/settings', '/docs', '/docs/start', '/docs/setup-hq', '/backups']) {
    const r = await call(w, p, { cookie }); assert.equal(r.status, 200, p); all += await r.text();
    assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
  }
  const overview = await (await call(w, '/', { cookie })).text();
  assert.match(overview, /Books clients connected/); assert.match(overview, /£547\.00|£550\.00|£547/, 'monthly recurring from Stripe');
  assert.match(overview, /past_due/);
  const customers = await (await call(w, '/customers', { cookie })).text();
  assert.match(customers, /Real Plumbing/); assert.match(customers, /Books monthly/);
  assert.ok(!customers.includes('<img src=x'), 'a client name is escaped');
  assert.match(customers, /&lt;img src=x/);
  for (const secret of [PASS, ADMIN, STRIPE]) assert.ok(!all.includes(secret), 'a secret appeared in a page');
  assert.match(all, /ADMIN_KEY/, 'the register names credentials');
});

test('without a Stripe key the pages still work and say so', async (t) => {
  const w = world({ STRIPE_KEY: undefined }, t); const { cookie } = await enrol(w, t);
  const r = await (await call(w, '/', { cookie })).text();
  assert.match(r, /Stripe is not connected yet/);
});

test('Books admin is served inside HQ with the key added server side; only the admin routes it needs are allowed', async (t) => {
  const w = world({}, t); const { cookie } = await enrol(w, t);
  const page = await call(w, '/books-admin', { cookie }); assert.equal(page.status, 200);
  const body = await page.text(), csp = page.headers.get('content-security-policy');
  assert.match(body, /<meta name="base" content="\/ba">/); assert.match(body, /<meta name="prekey"/);
  assert.match(csp, /script-src 'nonce-abc123'/); assert.match(csp, /connect-src 'self'/);
  assert.ok(!body.includes(ADMIN), 'the key is never sent to the browser');
  const h = await call(w, '/ba/health', { cookie }); assert.equal(h.status, 200);
  assert.equal(w.booksCalls.at(-1).key, ADMIN, 'the worker added the key');
  assert.equal((await call(w, '/ba/invite', { method: 'POST', cookie, headers: { 'Content-Type': 'application/json' } })).status, 200);
  for (const [m, p] of [['POST', '/ba/restore'], ['POST', '/ba/purge/123'], ['GET', '/ba/export'], ['DELETE', '/ba/client/123'], ['POST', '/ba/connect']]) {
    assert.equal((await call(w, p, { method: m, cookie })).status, 403, `${m} ${p} is not allowed through HQ`);
  }
  assert.equal((await call(w, '/ba/health')).status, 401, 'no session, no admin');
});

test('the daily job stores a Books backup in HQ, keeps 30, shows it, and lets the owner download any day', async (t) => {
  const w = world({}, t); const { cookie } = await enrol(w, t);
  assert.match(await (await call(w, '/backups', { cookie })).text(), /No backup yet/);
  assert.match(await (await call(w, '/', { cookie })).text(), /No recent Books backup/);
  await backupDaily(w.env);
  const page = await (await call(w, '/backups', { cookie })).text();
  assert.match(page, /Last backup: 20\d\d-\d\d-\d\d/);
  assert.ok(!(await (await call(w, '/', { cookie })).text()).includes('No recent Books backup'));
  const day = new Date().toISOString().slice(0, 10);
  const dl = await call(w, '/backups/download', { method: 'POST', cookie, form: { date: day } });
  assert.equal(dl.status, 200); assert.match(dl.headers.get('content-disposition'), new RegExp(`books-backup-${day}`));
  assert.equal((await dl.json()).version, 1);
  assert.equal((await call(w, '/backups/download', { method: 'POST', cookie, form: { date: '1999-01-01' } })).status, 404);
  const fresh = await call(w, '/backups/download', { method: 'POST', cookie }); assert.equal((await fresh.json()).version, 1);
  assert.equal((await call(w, '/backups/download', { method: 'POST' })).status, 303, 'login needed');
});

test('a backup that is not a backup is never kept, and 30 days are kept in large pieces too', async (t) => {
  const w = world({}, t);
  w.env.BOOKS.fetch = async () => new Response('<html>oops</html>');
  await assert.rejects(() => backupDaily(w.env));
  assert.equal((await w.storage.list({ prefix: 'bkmeta:' })).size, 0);
  const big = JSON.stringify({ version: 1, entries: { x: 'y'.repeat(2500000) } });
  w.env.BOOKS.fetch = async () => new Response(big);
  const stub = w.env.VAULT.get();
  for (let d = 1; d <= 33; d++) await (await stub.fetch('https://vault/bk/put', { method: 'POST', body: JSON.stringify({ date: `2026-09-${String(d).padStart(2, '0')}`, data: big }) })).json();
  assert.equal((await w.storage.list({ prefix: 'bkmeta:' })).size, 30);
  const got = await (await stub.fetch('https://vault/bk/get', { method: 'POST', body: JSON.stringify({ date: '2026-09-33' }) })).json();
  assert.equal(got.data, big, 'a 2.5 MB backup comes back exactly');
});

test('losing the authenticator: changing RESET_TOTP clears it so the owner can enrol again', async (t) => {
  const w = world({}, t); await enrol(w, t);
  assert.equal(await w.storage.get('totp') !== undefined, true);
  w.env.RESET_TOTP = 'lost-my-phone';
  const r = await call(w, '/login'); assert.equal(r.status, 200);
  assert.equal(await w.storage.get('totp'), undefined, 'the old authenticator is gone');
  assert.match(await (await call(w, '/login', { method: 'POST', form: { password: PASS } })).text(), /setup key/i);
});
