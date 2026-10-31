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
      const path = new URL(url).pathname; const key = (init.headers || {})['X-Key']; const method = init.method || 'GET';
      booksCalls.push({ path, method, key, body: init.body });
      if (key !== ADMIN) return new Response('Not allowed', { status: 403 });
      if (extra.booksDown) throw new Error('down');
      if (path === '/health') return Response.json({ clients: [{ realmId: '111', name: 'Real Plumbing', ok: true, filed: 4, toTidy: 2, late: 1, seenDays: 0 }, { realmId: '222', name: '<img src=x onerror=alert(1)>', ok: false, problem: 'QuickBooks 401' }, { realmId: '333', name: 'JCM Group', ok: true }] });
      if (path === '/backup') return Response.json({ version: 1, entries: {} });
      if (path === '/invite') { const b = JSON.parse(init.body); return b.phone === 'bad' ? Response.json({ error: 'Error: \"bad\" is not a UK mobile number' }, { status: 500 }) : Response.json({ ok: true, link: 'https://books.test/connect?invite=ONETIME', phone: '+447700900123' }); }
      let m;
      if ((m = path.match(/^\/client\/(\d+)$/)) && method === 'GET') return Response.json(m[1] === '333' ? { name: 'JCM Group', demo: true, appUrl: 'https://app.test/DEMOKEY/', vat: '', chase: 'off' } : { name: 'Real Plumbing', phone: '+447700900123', accountant: 'acct@example.test', vat: 'yes', extras: 'quotes', chase: 'on', appUrl: 'https://app.test/REALKEY/' });
      if ((m = path.match(/^\/client\/(\d+)$/)) && method === 'PUT') return Response.json({ ok: true });
      if (path.match(/^\/(logout|revoke)\/\d+$/)) return Response.json({ ok: true });
      if (path.match(/^\/precheck\/\d+$/)) return Response.json({ ok: false, vatRegistered: true, vat: { standard: '20.0% S', reduced: null, zero: null, none: 'No VAT' }, banks: ['Current'], problems: ['No VAT code found for 5% reduced rate'] });
      if (path.match(/^\/monthly\/\d+$/)) return Response.json({ text: 'Hi, here is your September summary' });
      return Response.json({ ok: true, path });
    } },
    ...extra,
  };
  if (t) t.mock.method(globalThis, 'fetch', async (u) => {
    const path = String(u);
    if (path.includes('/subscriptions')) return Response.json({ data: [{ id: 's1', status: 'active', created: 1790000000, customer: { name: 'Real Plumbing', email: 'p@example.test' }, items: { data: [{ quantity: 1, price: { id: 'price_books', unit_amount: 15000, nickname: 'Books monthly', product: { metadata: { localdesk_product: 'books' } }, recurring: { interval: 'month' } } }] }, latest_invoice: { status: 'paid' } }, { id: 's2', status: 'past_due', created: 1790000000, customer: { email: 'late@example.test' }, items: { data: [{ quantity: 1, price: { id: 'price_growth', unit_amount: 39700, nickname: 'Growth', product: { metadata: { localdesk_product: 'receptionist' } }, recurring: { interval: 'month' } } }] }, latest_invoice: { status: 'open' } }] });
    if (path.includes('/charges')) return Response.json({ data: [{ created: 1790000000, amount: 15000, paid: true, billing_details: { name: 'Real Plumbing' } }] });
    return Response.json({});
  });
  return { env, storage, booksCalls };
}
const call = (w, path, { method = 'GET', form, cookie, ip = '203.0.113.5', headers = {} } = {}) => hq.fetch(new Request('https://hq.test' + path, {
  method, redirect: 'manual',
  headers: { ...(cookie ? { Cookie: cookie } : {}), 'CF-Connecting-IP': ip, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...headers },
  body: form ? new URLSearchParams(form).toString() : undefined }), w.env);
const setupKey = (html) => /class="key">([A-Z2-7]{32})</.exec(html)[1];
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
  for (const p of ['/', '/login', '/customers', '/books']) assert.equal((await call(w, p)).status, 503, p);
});

test('a visitor who is not logged in is sent to the login page; the login page has strict headers, only nonce-locked scripts, and the brand font is public', async () => {
  const w = world();
  for (const p of ['/', '/customers', '/payments', '/books', '/books/new', '/books/client/111', '/books/client/111/check', '/receptionist', '/backups', '/settings', '/more', '/docs', '/docs/start']) {
    const r = await call(w, p); assert.equal(r.status, 303, p); assert.equal(r.headers.get('location'), '/login', p);
  }
  for (const [m, p] of [['POST', '/books/new'], ['POST', '/books/client/111/do/end'], ['POST', '/books/client/111/save'], ['POST', '/backups/download']]) assert.equal((await call(w, p, { method: m })).status, 303, `${m} ${p}`);
  assert.equal(w.booksCalls.length, 0, 'Books was never contacted');
  const login = await call(w, '/login'); assert.equal(login.status, 200);
  const csp = login.headers.get('content-security-policy');
  assert.match(csp, /default-src 'none'/); assert.match(csp, /script-src 'nonce-[\w-]+'/); assert.doesNotMatch(csp, /unsafe-inline'[^;]*script|script-src[^;]*unsafe/); assert.match(csp, /frame-ancestors 'none'/); assert.match(csp, /font-src 'self'/);
  assert.equal(login.headers.get('x-frame-options'), 'DENY'); assert.equal(login.headers.get('cache-control'), 'no-store');
  assert.match(login.headers.get('x-robots-tag'), /noindex/); assert.equal(login.headers.get('referrer-policy'), 'no-referrer');
  const lh = await login.text(), nn = /nonce-([\w-]+)/.exec(csp)[1];
  assert.ok([...lh.matchAll(/<script([^>]*)>/g)].every(m => m[1].includes(`nonce="${nn}"`)), 'every script carries the page nonce');
  assert.match(lh, /autocapitalize="none"/); assert.match(lh, /autocorrect="off"/); assert.doesNotMatch(lh, /autocomplete="off"/);
  const font = await call(w, '/font.woff'); assert.equal(font.status, 200); assert.equal(font.headers.get('content-type'), 'font/woff'); assert.ok((await font.arrayBuffer()).byteLength > 50000);
});

test('first login enrols the authenticator: a wrong code fails, the right one logs in with a locked-down cookie', async (t) => {
  const w = world({}, t);
  const first = await call(w, '/login', { method: 'POST', form: { password: PASS } });
  const page = await first.text(); assert.equal(first.status, 200); assert.match(page, /Enter a setup key/);
  const key = setupKey(page);
  const bad = await call(w, '/login', { method: 'POST', form: { password: PASS, code: '000000' } });
  assert.equal(bad.status, 401); assert.equal(bad.headers.get('set-cookie'), null); assert.match(await bad.text(), /wasn't right/);
  const good = await call(w, '/login', { method: 'POST', form: { password: PASS, code: await totp(key, Math.floor(Date.now() / 30000)) } });
  assert.equal(good.status, 303); assert.equal(good.headers.get('location'), '/');
  const c = good.headers.get('set-cookie');
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert.match(c, new RegExp(flag));
  assert.equal((await call(w, '/', { cookie: sessionCookie(good) })).status, 200);
});

test('a wrong passphrase, an empty one and a right one with a wrong code all fail the same plain way', async (t) => {
  const w = world({}, t); await enrol(w, t);
  for (const form of [{ password: 'nope', code: '123456' }, { password: '', code: '' }, { password: PASS, code: '111111' }, { password: PASS }]) {
    const r = await call(w, '/login', { method: 'POST', form, ip: '198.51.100.1' + Math.floor(Math.random() * 90) });
    assert.equal(r.status, 401); assert.match(await r.text(), /didn't work\. Check your passphrase/);
  }
});

test('five wrong tries lock that visitor out for a while, but not the owner from somewhere else', async (t) => {
  const w = world({}, t); const { key } = await enrol(w, t);
  for (let i = 0; i < 5; i++) await call(w, '/login', { method: 'POST', form: { password: 'wrong', code: '000000' }, ip: '192.0.2.50' });
  const locked = await call(w, '/login', { method: 'POST', form: { password: PASS, code: await totp(key, Math.floor(Date.now() / 30000) + 1) }, ip: '192.0.2.50' });
  assert.equal(locked.status, 429); assert.match(await locked.text(), /wait 15 minutes/);
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 31000 });
  const elsewhere = await call(w, '/login', { method: 'POST', form: { password: PASS, code: await totp(key, Math.floor(Date.now() / 30000)) }, ip: '192.0.2.99' });
  assert.equal(elsewhere.status, 303);
});

test('mistyping the code while setting up never locks the owner out', async (t) => {
  const w = world({}, t);
  await call(w, '/login', { method: 'POST', form: { password: PASS } });
  for (let i = 0; i < 8; i++) assert.equal((await call(w, '/login', { method: 'POST', form: { password: PASS, code: '000000' } })).status, 401);
  assert.equal((await call(w, '/login', { method: 'POST', form: { password: PASS } })).status, 200, 'still not locked');
});

test('a code cannot be used twice; sessions fail when forged, expired or logged out', async (t) => {
  const w = world({}, t); const first = await enrol(w, t);
  assert.equal((await call(w, '/login', { method: 'POST', form: { password: PASS, code: first.code }, ip: '192.0.2.7' })).status, 401, 'the same code again');
  const bits = first.cookie.split('.'); const forged = bits.slice(0, 2).join('.') + '.' + '0'.repeat(64);
  assert.equal((await call(w, '/', { cookie: forged })).status, 303);
  assert.equal((await call(w, '/', { cookie: first.cookie })).status, 200);
  const out = await call(w, '/logout', { method: 'POST', cookie: first.cookie });
  assert.equal(out.status, 303); assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 13 * 3600 * 1000 });
  assert.equal((await call(w, '/', { cookie: first.cookie })).status, 303, 'a session lasts 12 hours');
});

test('every page opens, in plain English, with data from Books and Stripe, and never shows a secret or a raw status', async (t) => {
  const w = world({}, t); const { cookie } = await enrol(w, t);
  let all = '';
  const pages = { '/': /coming in each month/, '/customers': /Receptionist customers/, '/payments': /Subscriptions/, '/books': /Your clients/, '/receptionist': /Mia answers/, '/backups': /Take one now/, '/settings': /Where your passwords and keys are kept/, '/docs': /Step-by-step guides/, '/docs/start': /Three rules/, '/more': /Log out of HQ/, '/books/new': /Add a new client/ };
  for (const [p, re] of Object.entries(pages)) {
    const r = await call(w, p, { cookie }); assert.equal(r.status, 200, p); const body = await r.text(); all += body; assert.match(body, re, p);
    assert.match(r.headers.get('content-security-policy'), /default-src 'none'/); assert.ok(!body.includes('<script'), `${p} has no script`);
    assert.match(body, /class="tabs"/); assert.match(body, /Home/);
  }
  const home = await (await call(w, '/', { cookie })).text();
  assert.match(home, /£150/, 'monthly income counts only the active paid subscription'); assert.doesNotMatch(home, /£547|£546/, 'a failed payment is not counted as income'); assert.match(home, /1 of 20 paying/); assert.match(home, /0 of 20 paying/); assert.match(home, /payment failed/i); assert.match(home, /Books lost its link to their QuickBooks/);
  const pay = await (await call(w, '/payments', { cookie })).text();
  assert.match(pay, /Payment failed/); assert.match(pay, /Paying/); const words = pay.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' '); assert.ok(!/past_due|\bactive\b/.test(words), 'no raw Stripe words: ' + words.slice(Math.max(0, words.search(/past_due|\bactive\b/) - 60), words.search(/past_due|\bactive\b/) + 40));
  const cust = await (await call(w, '/customers', { cookie })).text();
  assert.ok(!cust.includes('<img src=x'), 'a client name is escaped'); assert.match(cust, /&lt;img src=x/);
  const visible = all.replace(/href="[^"]*"/g, '');
  for (const secret of [PASS, ADMIN, STRIPE, 'REALKEY', 'DEMOKEY']) assert.ok(!visible.includes(secret), 'a secret or key appeared in a page');
  assert.ok(!all.includes(ADMIN) && !all.includes(STRIPE) && !all.includes(PASS), 'no real secret even inside a link');
});

test('without Stripe the pages still work and explain what to do; with Books down they say so kindly', async (t) => {
  const w = world({ STRIPE_KEY: undefined }, t); const { cookie } = await enrol(w, t);
  const r = await (await call(w, '/payments', { cookie })).text();
  assert.match(r, /Stripe isn&#39;t connected yet/); assert.match(r, /href="\/docs\/stripe"/);
  const d = world({ booksDown: true }, t); const c2 = (await enrol(d, t)).cookie;
  const home = await call(d, '/', { cookie: c2 }); assert.equal(home.status, 200);
  assert.match(await home.text(), /reach Books just now/);
});

test('adding a client: the form, a bad number is explained, a good one gives a one-time link and send buttons', async (t) => {
  const w = world({}, t); const { cookie } = await enrol(w, t);
  const bad = await call(w, '/books/new', { method: 'POST', cookie, form: { name: 'Test Roofing', phone: 'bad', vat: '', extras: '', env: 'sandbox' } });
  assert.equal(bad.status, 400); const bt = await bad.text(); assert.match(bt, /not a UK mobile number/); assert.match(bt, /value="Test Roofing"/, 'what they typed is kept');
  const ok = await call(w, '/books/new', { method: 'POST', cookie, form: { name: 'Test Roofing', phone: '07700 900123', vat: 'yes', extras: 'quotes', env: 'production' } });
  assert.equal(ok.status, 200); const t2 = await ok.text();
  assert.match(t2, /connect\?invite=ONETIME/); assert.match(t2, /wa\.me\/447700900123\?text=/); assert.match(t2, /href="sms:\+447700900123/);
  const sent = JSON.parse(w.booksCalls.filter(c => c.path === '/invite').at(-1).body);
  assert.deepEqual([sent.name, sent.vat, sent.extras, sent.env], ['Test Roofing', 'yes', 'quotes', 'production']);
});

test('a client page shows plain facts, saves changes, and ending or logging out always asks first', async (t) => {
  const w = world({}, t); const { cookie } = await enrol(w, t);
  const page = await (await call(w, '/books/client/111', { cookie })).text();
  assert.match(page, /Real Plumbing/); assert.match(page, /Open their app/); assert.match(page, /End their service/); assert.match(page, /Check their accounting setup/);
  assert.ok(!page.replace(/href="[^"]*"/g, '').includes('REALKEY'), 'the app link is a tappable link, never written out as text');
  const save = await call(w, '/books/client/111/save', { method: 'POST', cookie, form: { name: 'Real Plumbing Ltd', phone: '07700 900123', accountant: 'a@example.test', vat: 'no', extras: '', chase: 'on' } });
  assert.equal(save.status, 303); assert.match(save.headers.get('location'), /done=saved/);
  const put = w.booksCalls.filter(c => c.method === 'PUT').at(-1); assert.equal(JSON.parse(put.body).name, 'Real Plumbing Ltd');
  const confirm = await (await call(w, '/books/client/111/confirm/end', { cookie })).text();
  assert.match(confirm, /End their service\?/); assert.match(confirm, /cannot be undone/); assert.ok(!w.booksCalls.some(c => c.path.startsWith('/revoke')), 'asking is not doing');
  const done = await call(w, '/books/client/111/do/end', { method: 'POST', cookie }); assert.equal(done.status, 303); assert.match(done.headers.get('location'), /done=ended/);
  assert.ok(w.booksCalls.some(c => c.path === '/revoke/111' && c.method === 'POST'));
  assert.equal((await call(w, '/books/client/111/do/logout', { method: 'POST', cookie })).status, 303);
  assert.equal((await call(w, '/books/client/111/do/purge', { method: 'POST', cookie })).status, 404, 'only the actions on the page exist');
  assert.equal((await call(w, '/books/client/abc', { cookie })).status, 404);
});

test('the demo has no End button, the setup check explains each fix, and the monthly text can be previewed', async (t) => {
  const w = world({}, t); const { cookie } = await enrol(w, t);
  const demo = await (await call(w, '/books/client/333', { cookie })).text();
  assert.match(demo, /Open the demo/); assert.ok(!/End their service/.test(demo));
  const books = await (await call(w, '/books', { cookie })).text(); assert.match(books, /Open the demo for a prospect/);
  const check = await (await call(w, '/books/client/111/check', { cookie })).text();
  assert.match(check, /1 thing to look at/); assert.match(check, /No VAT code found for 5% reduced rate/);
  assert.match(await (await call(w, '/books/client/111/monthly', { cookie })).text(), /September summary/);
});

test('the daily job stores a Books backup in HQ, keeps 30, shows it plainly, and lets the owner download any day', async (t) => {
  const w = world({}, t); const { cookie } = await enrol(w, t);
  assert.match(await (await call(w, '/backups', { cookie })).text(), /No backup yet/);
  assert.match(await (await call(w, '/', { cookie })).text(), /No recent backup of your Books data/);
  await backupDaily(w.env);
  assert.match(await (await call(w, '/backups', { cookie })).text(), /Backed up/);
  assert.ok(!(await (await call(w, '/', { cookie })).text()).includes('No recent backup'));
  const day = new Date().toISOString().slice(0, 10);
  const dl = await call(w, '/backups/download', { method: 'POST', cookie, form: { date: day } });
  assert.equal(dl.status, 200); assert.match(dl.headers.get('content-disposition'), new RegExp(`books-backup-${day}`)); assert.equal((await dl.json()).version, 1);
  assert.equal((await call(w, '/backups/download', { method: 'POST', cookie, form: { date: '1999-01-01' } })).status, 404);
  assert.equal((await (await call(w, '/backups/download', { method: 'POST', cookie })).json()).version, 1);
});

test('a backup that is not a backup is never kept, and 30 days are kept in large pieces too', async (t) => {
  const w = world({}, t);
  w.env.BOOKS.fetch = async () => new Response('<html>oops</html>');
  await assert.rejects(() => backupDaily(w.env));
  assert.equal((await w.storage.list({ prefix: 'bkmeta:' })).size, 0);
  const big = JSON.stringify({ version: 1, entries: { x: 'y'.repeat(2500000) } });
  const stub = w.env.VAULT.get();
  for (let d = 1; d <= 33; d++) await (await stub.fetch('https://vault/bk/put', { method: 'POST', body: JSON.stringify({ date: `2026-09-${String(d).padStart(2, '0')}`, data: big }) })).json();
  assert.equal((await w.storage.list({ prefix: 'bkmeta:' })).size, 30);
  assert.equal((await (await stub.fetch('https://vault/bk/get', { method: 'POST', body: JSON.stringify({ date: '2026-09-33' }) })).json()).data, big);
});

test('losing the authenticator: changing RESET_TOTP clears it so the owner can enrol again', async (t) => {
  const w = world({}, t); await enrol(w, t);
  assert.equal(await w.storage.get('totp') !== undefined, true);
  w.env.RESET_TOTP = 'lost-my-phone';
  assert.equal((await call(w, '/login')).status, 200);
  assert.equal(await w.storage.get('totp'), undefined);
  assert.match(await (await call(w, '/login', { method: 'POST', form: { password: PASS } })).text(), /Enter a setup key/);
});

test('an unexpected failure shows a friendly page, not a stack trace', async (t) => {
  const w = world({}, t); const { cookie } = await enrol(w, t);
  w.env.BOOKS.fetch = async () => { throw new Error('secret internal detail'); };
  const r = await call(w, '/books/client/111', { cookie });
  assert.ok(r.status < 600); const body = await r.text(); assert.ok(!body.includes('secret internal detail')); assert.match(body, /Localdesk/);
});

test('"keep me logged in" is the default: three months, and ticking it off gives a 12 hour session', async (t) => {
  const w = world({}, t);
  const first = await call(w, '/login', { method: 'POST', form: { password: PASS } }); const key = setupKey(await first.text());
  assert.match(await (await call(w, '/login')).text(), /name="remember" value="1" checked/, 'the box is ticked by default');
  const remembered = await call(w, '/login', { method: 'POST', form: { password: PASS, remember: '1', code: await totp(key, Math.floor(Date.now() / 30000)) } });
  assert.match(remembered.headers.get('set-cookie'), /Max-Age=7776000/);
  const c = sessionCookie(remembered);
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 80 * 86400 * 1000 });
  assert.equal((await call(w, '/', { cookie: c })).status, 200, 'still in after 80 days');
  t.mock.timers.setTime(Date.now() + 20 * 86400 * 1000);
  assert.equal((await call(w, '/', { cookie: c })).status, 303, 'but not after 3 months');
});

test('"log out every device" ends every session at once, including ones that were remembered', async (t) => {
  const w = world({}, t); const a = await enrol(w, t);
  assert.equal((await call(w, '/', { cookie: a.cookie })).status, 200);
  assert.equal((await call(w, '/logout-all', { method: 'POST' })).status, 303, 'cannot be used without a login');
  assert.equal((await call(w, '/', { cookie: a.cookie })).status, 200, 'and did nothing');
  const out = await call(w, '/logout-all', { method: 'POST', cookie: a.cookie });
  assert.equal(out.status, 303); assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await call(w, '/', { cookie: a.cookie })).status, 303, 'the old session is dead');
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 31000 });
  const again = await call(w, '/login', { method: 'POST', form: { password: PASS, code: await totp(a.key, Math.floor(Date.now() / 30000)) }, ip: '192.0.2.77' });
  assert.equal(again.status, 303, 'logging back in still works');
  assert.equal((await call(w, '/', { cookie: sessionCookie(again) })).status, 200);
});

test('a link tapped in another app (a cross-site navigation) still arrives logged in: the cookie is Lax, never Strict', async () => {
  const w = world(); const { cookie, res } = await enrol(w);
  assert.doesNotMatch(res.headers.get('set-cookie') || '', /SameSite=Strict/); assert.match(res.headers.get('set-cookie') || '', /SameSite=Lax/);
  assert.equal((await call(w, '/')).status, 303, 'without the cookie: login page');
  const ok = await call(w, '/', { cookie, headers: { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate' } });
  assert.equal(ok.status, 200, 'with the cookie, a cross-site link lands on Home');
});

test('payment link: made from a lead, shown only to the owner, never sent; errors are plain; only Stripe links are shown', async () => {
  const w = world(); const orig = w.env.BOOKS.fetch; let reply = { status: 200, body: { url: 'https://checkout.stripe.com/c/pay/cs_test_1', founding: true, setupFee: false } }; let sentCheckouts = 0;
  w.env.BOOKS.fetch = async (url, init = {}) => { const path = new URL(url).pathname; if (path === '/checkout') { sentCheckouts++; return Response.json(reply.body, { status: reply.status }); } if (path === '/leads/L1' && !init.method) return Response.json({ id: 'L1', name: 'Dave', phone: '+447700900123', product: 'receptionist', status: 'onboarding', checklist: { founding: true }, history: [], messages: [] }); return orig(url, init); };
  assert.equal((await call(w, '/leads/L1/checkout', { method: 'POST' })).status, 303, 'login needed');
  const { cookie } = await enrol(w);
  const page = await (await call(w, '/leads/L1', { cookie })).text(); assert.match(page, /Make a payment link/); assert.match(page, /founding client: monthly price only/);
  const ok = await call(w, '/leads/L1/checkout', { method: 'POST', cookie }); assert.equal(ok.status, 200);
  const html = await ok.text(); assert.match(html, /https:\/\/checkout\.stripe\.com\/c\/pay\/cs_test_1/); assert.match(html, /Nothing was sent/); assert.equal(sentCheckouts, 1);
  reply = { status: 503, body: { error: 'Stripe is not set up yet. Missing in Cloudflare: STRIPE_SECRET_KEY' } };
  const bad = await call(w, '/leads/L1/checkout', { method: 'POST', cookie }); assert.equal(bad.status, 400); assert.match(await bad.text(), /Stripe is not set up yet/);
  reply = { status: 200, body: { url: 'https://evil.example/phish' } };
  const odd = await call(w, '/leads/L1/checkout', { method: 'POST', cookie }); assert.equal(odd.status, 502); assert.ok(!(await odd.text()).includes('evil.example'));
});

test('Books lead page: software, connection and first receipt come from the connected app, with one clear next step', async () => {
  const base = { id: 'B1', name: 'Dave', phone: '+447700900123', phoneKey: '7700900123', product: 'books', status: 'onboarding', checklist: { demo_done: true, agreement: true, id_check: true, payment: true }, history: [], messages: [] };
  const look = async (app, lead = base) => { // a fresh HQ each time, because HQ caches the app health for a few minutes
    const w = world(); const orig = w.env.BOOKS.fetch;
    w.env.BOOKS.fetch = async (url, init = {}) => { const path = new URL(url).pathname; if (path === '/leads/B1' && !init.method) return Response.json(lead); if (path === '/health') return Response.json({ clients: app ? [app] : [] }); return orig(url, init); };
    const { cookie } = await enrol(w); return (await call(w, '/leads/B1', { cookie })).text();
  };
  const app = { realmId: '555', name: 'Dave Plumbing', ok: true, platform: 'xero', phoneKey: '7700900123', everFiled: false, seenDays: 2 };
  let page = await look(app);
  assert.match(page, /Their app/); assert.match(page, />Xero</); assert.match(page, /Connected and working/); assert.match(page, /No receipt filed yet/);
  assert.match(page, /Next step: First test receipt filed/, 'software, invite and connection are done automatically, so the next step is the first receipt');
  assert.match(page, /name="ck_software" value="1" checked/); assert.match(page, /name="ck_connected" value="1" checked/); assert.ok(!/name="ck_first_receipt" value="1" checked/.test(page));
  page = await look({ ...app, everFiled: true }); assert.match(page, /A receipt has been filed/); assert.match(page, /name="ck_first_receipt" value="1" checked/); assert.match(page, /Next step: Their accountant/);
  page = await look({ ...app, ok: false, problem: 'invalid_grant' }); assert.match(page, /Needs attention/); assert.ok(!/name="ck_connected" value="1" checked/.test(page), 'a broken connection is not shown as connected');
  page = await look(null); assert.match(page, /Not connected yet/); assert.match(page, /Next step: Their accounting software chosen/);
  page = await look({ ...app, phoneKey: '7700900999' }); assert.match(page, /Not connected yet/, 'a different mobile is not matched');
  page = await look(app, { ...base, product: 'receptionist' }); assert.ok(!/Their app/.test(page), 'other products never get the card');
  page = await look(app, { ...base, status: 'lost' }); assert.ok(!/Their app/.test(page));
});

// ---- content approval queue ----
import { move as moveP, edit as editP, blocked as blockedP, seedPosts as seedP } from '../workers/hq/posts.js';

test('content queue: a founding-offer post cannot be approved once five places are used, or when places cannot be checked', () => {
  const posts = seedP(); const founding = posts.find(p => p.founding), plain = posts.find(p => !p.founding && !p.demo);
  assert.ok(founding && plain);
  assert.equal(moveP(posts, founding.id, 'approved', 5).error?.includes('founding places are taken'), true);
  assert.equal(moveP(posts, founding.id, 'approved', 9).error?.includes('founding places are taken'), true);
  assert.match(moveP(posts, founding.id, 'approved', null).error, /cannot check/);
  assert.equal(founding.status, 'draft');
  assert.equal(moveP(posts, founding.id, 'approved', 4).ok, true);
  assert.equal(moveP(posts, plain.id, 'approved', 5).ok, true, 'ordinary posts do not care');
});

test('content queue: sensible status moves only, edits need approving again, posted posts are final', () => {
  const posts = seedP(); const p = posts.find(x => !x.founding);
  assert.match(moveP(posts, p.id, 'posted', 0).error, /cannot become/);
  assert.equal(moveP(posts, p.id, 'approved', 0).ok, true);
  assert.equal(moveP(posts, p.id, 'scheduled', 0).ok, true);
  assert.equal(editP(posts, p.id, 'A new version of this post.').ok, true); assert.equal(p.status, 'draft');
  assert.match(editP(posts, p.id, 'x').error, /too short/);
  moveP(posts, p.id, 'approved', 0); moveP(posts, p.id, 'posted', 0);
  assert.match(editP(posts, p.id, 'Changed after posting.').error, /already been posted/);
  assert.equal(moveP(posts, p.id, 'draft', 0).error.includes('cannot become'), true);
});

test('content queue: no absolute or unsupported claims in the drafts', () => {
  const all = seedP().map(p => p.text).join('\n').toLowerCase();
  for (const bad of ['every call', 'never missed', 'most people', 'honest review', 'first 5 founding clients', 'no vat', 'always']) assert.ok(!all.includes(bad), bad);
});

test('content queue: seeded posts are the 14 drafts, with correct prices and no stale claims', () => {
  const posts = seedP(); assert.equal(posts.length, 14); assert.ok(posts.every(p => p.status === 'draft'));
  const all = posts.map(p => p.text).join('\n');
  assert.ok(!/£\s?(395)\b.*Receptionist/.test(all)); assert.match(all, /£397/); assert.match(all, /£150/); assert.match(all, /£395 setup/);
  assert.ok(!all.includes('—'), 'no em dashes');
  assert.ok(posts.every(p => !/\b0175\d? ?74/.test(p.text) || p.demo), 'the demo number only appears in a demo post');
});

test('content queue in HQ: login needed, approve works, a founding post is refused when five places are used', async () => {
  const w = world(); const orig = w.env.BOOKS.fetch; let used = 5;
  w.env.BOOKS.fetch = async (url, init) => new URL(url).pathname === '/founding' ? Response.json({ places: 5, used, ids: [] }) : orig(url, init);
  assert.equal((await call(w, '/content')).status, 303);
  assert.equal((await call(w, '/content/p01/approved', { method: 'POST' })).status, 303);
  const { cookie } = await enrol(w);
  const page = await call(w, '/content', { cookie }); assert.equal(page.status, 200); assert.match(await page.text(), /Day 1/);
  assert.equal((await call(w, '/content/p01/approved', { method: 'POST', cookie })).status, 303);
  const refused = await call(w, '/content/p05/approved', { method: 'POST', cookie }); assert.equal(refused.status, 400); assert.match(await refused.text(), /founding places are taken/);
  used = 2;
  const down = w.env.BOOKS.fetch; w.env.BOOKS.fetch = async (url, init) => new URL(url).pathname === '/founding' ? new Response('down', { status: 500 }) : down(url, init);
  const unsure = await call(w, '/content/p10/approved', { method: 'POST', cookie }); assert.equal(unsure.status, 400); assert.match(await unsure.text(), /cannot check/, 'fails closed when the count is unavailable');
  w.env.BOOKS.fetch = down;
  assert.equal((await call(w, '/content/p05/approved', { method: 'POST', cookie })).status, 303);
  const after = await (await call(w, '/content', { cookie })).text(); assert.match(after, /Approved \(2\)/);

});

// ---- Face ID / fingerprint login (a simulated phone signs with a real P-256 key) ----
const B = (u) => Buffer.from(u).toString('base64url');
async function fakePhone(w, cookie, { ip } = {}) {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  const id = B(crypto.getRandomValues(new Uint8Array(16)));
  const postJson = (path, body, ck, from) => hq.fetch(new Request('https://hq.test' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': from || ip || '203.0.113.9', ...(ck ? { Cookie: ck } : {}) }, body: JSON.stringify(body || {}) }), w.env);
  const cdj = (type, challenge, origin = 'https://hq.test') => new TextEncoder().encode(JSON.stringify({ type, challenge, origin }));
  return {
    id, postJson,
    async register(name = 'My iPhone') {
      const { challenge } = await (await postJson('/passkey/new-options', {}, cookie)).json();
      return postJson('/passkey/register', { id, clientDataJSON: B(cdj('webauthn.create', challenge)), publicKey: B(spki), alg: -7, name }, cookie);
    },
    async assert({ flags = 0x05, count = 1, rp = 'hq.test', origin, tamper = false, challenge, from } = {}) {
      const ch = challenge || (await (await postJson('/passkey/options', {}, null, from)).json()).challenge;
      const ad = new Uint8Array(37); ad.set(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rp)))); ad[32] = flags; new DataView(ad.buffer).setUint32(33, count);
      const cd = cdj('webauthn.get', ch, origin);
      const signed = new Uint8Array([...ad, ...new Uint8Array(await crypto.subtle.digest('SHA-256', cd))]);
      const raw = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, signed));
      const der = (x) => { let i = 0; while (i < 31 && x[i] === 0) i++; let v = x.slice(i); if (v[0] & 0x80) v = new Uint8Array([0, ...v]); return [2, v.length, ...v]; };
      const r = der(raw.slice(0, 32)), sg = der(raw.slice(32)); const sig = new Uint8Array([0x30, r.length + sg.length, ...r, ...sg]);
      if (tamper) sig[sig.length - 1] ^= 1;
      return postJson('/passkey/login', { id, clientDataJSON: B(cd), authenticatorData: B(ad), signature: B(sig) }, null, from);
    },
  };
}

test('Face ID login: add a device while logged in, then log in with it and no passphrase', async () => {
  const w = world(); const { cookie } = await enrol(w);
  const phone = await fakePhone(w, cookie);
  assert.equal((await (await phone.register()).json()).ok, true);
  const page = await (await call(w, '/passkey', { cookie })).text(); assert.match(page, /My iPhone/);
  const res = await phone.assert();
  assert.equal(res.status, 200); assert.equal((await res.json()).ok, true);
  const ck = sessionCookie(res); assert.match(ck, /^hq=/);
  assert.equal((await call(w, '/', { cookie: ck })).status, 200, 'the passkey session works like a normal login');
});

test('Face ID login refuses: no login for adding, wrong origin or site, no Face ID check, replay, bad signature, unknown device, used challenge', async () => {
  const w = world(); const { cookie } = await enrol(w);
  const stranger = await fakePhone(w, null);
  assert.equal((await stranger.postJson('/passkey/new-options', {})).status, 303, 'cannot add a device without being logged in');
  assert.equal((await stranger.postJson('/passkey/register', {})).status, 303);
  const phone = await fakePhone(w, cookie); await phone.register();
  assert.equal((await phone.assert({ origin: 'https://evil.test', from: '192.0.2.10' })).status, 401, 'wrong origin');
  assert.equal((await phone.assert({ rp: 'evil.test', from: '192.0.2.11' })).status, 401, 'wrong site');
  assert.equal((await phone.assert({ flags: 0x01, from: '192.0.2.12' })).status, 401, 'no Face ID or PIN check');
  assert.equal((await phone.assert({ tamper: true, from: '192.0.2.13' })).status, 401, 'bad signature');
  assert.equal((await phone.assert({ challenge: 'made-up', from: '192.0.2.14' })).status, 401, 'unknown challenge');
  assert.equal((await stranger.assert({ from: '192.0.2.30' })).status, 401, 'unknown device');
  assert.equal((await phone.assert({ count: 5 })).status, 200);
  assert.equal((await phone.assert({ count: 5, from: '192.0.2.31' })).status, 401, 'replayed counter');
  assert.equal((await phone.assert({ count: 4, from: '192.0.2.32' })).status, 401, 'counter went backwards');
  assert.equal((await phone.assert({ count: 6 })).status, 200);
});

test('Face ID login: removing a device stops it, and log out everywhere stops sessions', async () => {
  const w = world(); const { cookie } = await enrol(w);
  const phone = await fakePhone(w, cookie); await phone.register();
  await call(w, '/passkey/delete', { method: 'POST', form: { id: phone.id }, cookie });
  assert.equal((await phone.assert()).status, 401);
  const phone2 = await fakePhone(w, cookie); await phone2.register();
  const ck = sessionCookie(await phone2.assert());
  await call(w, '/logout-all', { method: 'POST', cookie });
  assert.equal((await call(w, '/', { cookie: ck })).status, 303);
});

test('Face ID login: wrong tries are counted toward the lockout', async () => {
  const w = world(); const { cookie } = await enrol(w);
  const phone = await fakePhone(w, cookie, { ip: '198.51.100.7' }); await phone.register();
  for (let i = 0; i < 5; i++) assert.equal((await phone.assert({ tamper: true })).status, 401);
  assert.equal((await phone.assert()).status, 429);
});

test('passphrase login ignores a stray space from a phone keyboard', async () => {
  const w = world(); const { key } = await enrol(w);
  const code = await totp(key, Math.floor(Date.now() / 30000) + 1);
  const res = await call(w, '/login', { method: 'POST', form: { password: PASS + ' ', code } });
  assert.equal(res.status, 303);
});

test('cold-call lead page: stages, call plan, TPS and do-not-call hide the Call button, Zoom link, and a cold-called note on drafts', async () => {
  const base = { id: 'C1', name: 'Steve', phone: '+447700900321', phoneKey: '7700900321', product: 'receptionist', source: 'phone call', status: 'interested', checklist: {}, history: [{ at: Date.now(), from: null, to: 'new' }], messages: [] };
  let saved = null;
  const look = async (lead, form) => {
    const w = world(); const orig = w.env.BOOKS.fetch;
    w.env.BOOKS.fetch = async (url, init = {}) => { const path = new URL(url).pathname; if (path === '/leads/C1' && !init.method) return Response.json(lead); if (path === '/leads/C1' && init.method === 'PUT') { saved = JSON.parse(init.body); return Response.json({ ...lead, ...saved }); } return orig(url, init); };
    const { cookie } = await enrol(w); return form ? call(w, '/leads/C1/save', { method: 'POST', form, cookie }) : (await call(w, '/leads/C1', { cookie })).text();
  };
  let page = await look(base);
  assert.match(page, /Interested/); assert.match(page, /Call plan/); assert.match(page, /Check the number against the TPS/); assert.match(page, />Call</); assert.match(page, /You rang them, so only send a message if they agreed/);
  for (const label of ['Called or contacted', 'Zoom booked', 'Demo attended']) assert.match(page, new RegExp(label), label);
  page = await look({ ...base, tps: 'registered', tps_checked: '2026-10-31' }); assert.match(page, /Do not cold call this number/); assert.ok(!/>Call</.test(page), 'no Call button for a TPS-registered number');
  page = await look({ ...base, dnc: true }); assert.match(page, /marked this lead do not call/); assert.ok(!/>Call</.test(page));
  page = await look({ ...base, tps: 'clear', tps_checked: '2026-10-31', meeting_link: 'https://zoom.us/j/9', meeting_at: '2026-11-05T14:30' }); assert.match(page, /Open the Zoom link/); assert.match(page, /checked 2026-10-31/);
  page = await look({ ...base, messages: [{ at: Date.now(), text: 'please ring me' }], source: 'website' }); assert.ok(!/You rang them/.test(page), 'an enquiry they sent is not cold calling');
  const res = await look(base, { plan_form: '1', next_action: 'Ring Tuesday', meeting_at: '2026-11-05T14:30', meeting_link: 'https://zoom.us/j/9', tps: 'clear' });
  assert.equal(res.status, 303); assert.deepEqual(saved, { next_action: 'Ring Tuesday', meeting_at: '2026-11-05T14:30', meeting_link: 'https://zoom.us/j/9', tps: 'clear', dnc: false });
  await look(base, { plan_form: '1', dnc: '1', tps: 'registered' }); assert.equal(saved.dnc, true); assert.equal(saved.tps, 'registered');
});

test('Stripe check page: login needed, shows the four prices and what to fix, never a secret', async (t) => {
  const w = world(); w.env.STRIPE_KEY = 'rk_test_HQSECRETKEY'; const orig = w.env.BOOKS.fetch;
  const prices = { price_rec: { id: 'price_rec', currency: 'gbp', unit_amount: 39700, recurring: { interval: 'month' }, livemode: false, active: true }, price_recs: { id: 'price_recs', currency: 'gbp', unit_amount: 49700, livemode: false, active: true }, price_bk: { id: 'price_bk', currency: 'gbp', unit_amount: 14000, recurring: { interval: 'month' }, livemode: false, active: true } };
  w.env.BOOKS.fetch = async (url, init = {}) => new URL(url).pathname === '/stripe/status' ? Response.json({ secretKey: true, webhookSecret: false, prices: { receptionist: 'price_rec', receptionist_setup: 'price_recs', books: 'price_bk', books_setup: null } }) : orig(url, init);
  t.mock.method(globalThis, 'fetch', async (u) => { const m = /\/v1\/prices\/(\w+)/.exec(String(u)); return m && prices[m[1]] ? Response.json(prices[m[1]]) : m ? new Response(JSON.stringify({ error: { message: 'No such price' } }), { status: 404 }) : Response.json({ data: [] }); });
  assert.equal((await call(w, '/stripe-check')).status, 303);
  const { cookie } = await enrol(w); const res = await call(w, '/stripe-check', { cookie }); assert.equal(res.status, 200); const page = await res.text();
  assert.match(page, /TEST mode/); assert.match(page, /Amount is £140, it should be £150/); assert.match(page, /STRIPE_WEBHOOK_SECRET/); assert.match(page, /STRIPE_PRICE_BOOKS_SETUP/); assert.match(page, /Fix the red items/);
  assert.ok(!page.includes('HQSECRETKEY')); assert.match(await (await call(w, '/more', { cookie })).text(), /Stripe check/);
});

test('Home shows Zoom demos booked for today and tomorrow, and leaves out lost, paying and do-not-call leads', async () => {
  const { zoomsSoon } = await import('../workers/hq/leads.js');
  const now = Date.parse('2026-11-04T09:00:00Z'), L = (id, meeting_at, extra = {}) => ({ id, name: id, status: 'zoom', meeting_at, ...extra });
  const out = zoomsSoon([L('a', '2026-11-04T15:30'), L('b', '2026-11-05T10:00'), L('c', '2026-11-06T10:00'), L('d', '2026-11-04T11:00', { status: 'lost' }), L('e', '2026-11-04T11:00', { dnc: true }), L('f', '2026-11-04T11:00', { status: 'paying' }), L('g', '')], now);
  assert.deepEqual(out.map(z => [z.lead.id, z.when, z.time]), [['a', 'today', '15:30'], ['b', 'tomorrow', '10:00']]);
  const w = world(); const orig = w.env.BOOKS.fetch; const d = new Date(), pad = (n) => String(n).padStart(2, '0'), stamp = `${d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' })}T16:45`;
  w.env.BOOKS.fetch = async (url, init = {}) => new URL(url).pathname === '/leads' && !init.method ? Response.json([{ id: 'Z1', name: 'Zoe Zoom', phone: '+447700900888', product: 'receptionist', status: 'zoom', meeting_at: stamp, checklist: {}, history: [], messages: [], created: Date.now(), updated: Date.now() }]) : orig(url, init);
  const { cookie } = await enrol(w); const page = await (await call(w, '/', { cookie })).text();
  assert.match(page, /1 Zoom demo today/); assert.match(page, /Zoe Zoom at 16:45/);
});

test('cold-call edge cases in HQ: a blocked number says so, an existing number opens the existing lead, re-enquiry, subscription and missing Zoom date are explained', async () => {
  const base = { id: 'E1', name: 'Eve', phone: '+447700900555', phoneKey: '7700900555', product: 'receptionist', source: 'phone call', status: 'zoom', checklist: {}, history: [{ at: Date.now(), from: null, to: 'new' }], messages: [] };
  const mk = async (lead, post) => { const w = world(); const orig = w.env.BOOKS.fetch;
    w.env.BOOKS.fetch = async (url, init = {}) => { const path = new URL(url).pathname; if (path === '/leads/E1' && !init.method) return Response.json(lead); if (path === '/leads' && init.method === 'POST') return Response.json(post, { status: post.ok === false ? 409 : 200 }); return orig(url, init); };
    return { w, ...(await enrol(w)) }; };
  let { w, cookie } = await mk(base, {}); let page = await (await call(w, '/leads/E1', { cookie })).text();
  assert.match(page, /Zoom booked, but no date set/);
  ({ w, cookie } = await mk({ ...base, reenquired: Date.parse('2026-11-02T10:00:00Z'), dnc: true, meeting_at: '2026-11-05T10:00', subscription: { id: 'sub_1', status: 'trialing', at: Date.parse('2026-11-03T10:00:00Z') } }, {}));
  page = await (await call(w, '/leads/E1', { cookie })).text();
  assert.match(page, /They got in touch themselves/); assert.match(page, /after you marked this number do not call/); assert.match(page, /Stripe: subscription trialing/); assert.match(page, /Counts as paying only when HQ Payments shows the subscription paid/); assert.ok(!/Zoom booked, but no date set/.test(page));
  ({ w, cookie } = await mk(base, { ok: false, blocked: true, id: 'E1', error: 'This number is marked do not call. Do not ring it.' }));
  let res = await call(w, '/leads/new', { method: 'POST', form: { name: 'Eve', phone: '07700 900555', product: 'receptionist', source: 'phone call' }, cookie }); assert.equal(res.status, 400); assert.match(await res.text(), /marked do not call/);
  ({ w, cookie } = await mk(base, { ok: true, id: 'E1', merged: true, existing: true }));
  res = await call(w, '/leads/new', { method: 'POST', form: { name: 'Eve', phone: '07700 900555', product: 'receptionist', source: 'phone call' }, cookie }); assert.equal(res.status, 303); assert.equal(res.headers.get('location'), '/leads/E1?done=exists');
  page = await (await call(w, '/leads/E1?done=exists', { cookie })).text(); assert.match(page, /already in HQ/);
});

test('content workflow end to end: write, edit, approve, plan, mark scheduled, mark posted, with the founding guard on your own posts and a Home reminder (HQ never posts anything)', async (t) => {
  const w = world(); let places = 2; const orig = w.env.BOOKS.fetch;
  w.env.BOOKS.fetch = async (url, init = {}) => new URL(url).pathname === '/founding' ? Response.json({ places: 5, used: places, ids: [] }) : orig(url, init);
  const posted = []; t.mock.method(globalThis, 'fetch', async (u) => { posted.push(String(u)); return Response.json({}); });
  const { cookie } = await enrol(w); const post = (path, form) => call(w, path, { method: 'POST', form, cookie });
  const page = async () => (await call(w, '/content', { cookie })).text();
  const idOf = async (title) => new RegExp(`id="(x[a-z0-9]+)"[^]*?<h2[^>]*>${title}<`).exec(await page())[1];
  // write
  assert.equal((await post('/content/new', { title: 'x', text: 'short' })).status, 400, 'too short is refused');
  assert.equal((await post('/content/new', { title: 'Roofers tip', text: 'Check your gutters before the winter storms arrive.', platform: 'facebook', planned: '2026-02-30x' })).status, 400, 'bad date refused');
  assert.equal((await post('/content/new', { title: 'Roofers tip', text: 'Check your gutters before the winter storms arrive.', platform: 'facebook' })).status, 303);
  const a = await idOf('Roofers tip'); assert.match(await page(), /Your post/); assert.match(await page(), /Draft \(/);
  // edit, approve, plan
  assert.equal((await post(`/content/${a}/save`, { text: 'Check your gutters and flashings before the winter storms arrive.' })).status, 303);
  assert.equal((await post(`/content/${a}/approved`)).status, 303);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  assert.equal((await post(`/content/${a}/plan`, { platform: 'both', planned: 'tomorrow' })).status, 400); assert.equal((await post(`/content/${a}/plan`, { platform: 'both', planned: today })).status, 303);
  let home = await (await call(w, '/', { cookie })).text(); assert.match(home, /1 post to put out today/); assert.match(home, /Roofers tip/);
  assert.equal((await post(`/content/${a}/scheduled`)).status, 303); assert.equal((await post(`/content/${a}/posted`)).status, 303);
  home = await (await call(w, '/', { cookie })).text(); assert.ok(!/post to put out today/.test(home), 'once posted the reminder goes');
  assert.equal((await post(`/content/${a}/plan`, { planned: today })).status, 400, 'a posted post cannot be re-planned'); assert.equal((await post(`/content/${a}/save`, { text: 'Changed after posting, which is not allowed.' })).status, 400);
  // founding guard applies to your own posts, and fails closed
  places = 5; assert.equal((await post('/content/new', { title: 'Founding offer', text: 'Founding clients get free setup while places last.', platform: 'both' })).status, 303);
  const f = await idOf('Founding offer'); const refused = await post(`/content/${f}/approved`); assert.equal(refused.status, 400); assert.match(await refused.text(), /founding places are taken/);
  places = 3; assert.equal((await post(`/content/${f}/approved`)).status, 303);
  assert.equal((await post(`/content/${a.replace(/^x/, 'y')}/approved`)).status, 404, 'an id that is not a route is a plain not-found, not a crash'); assert.equal((await post('/content/x0nosuchpost/approved')).status, 400, 'a well-formed id that does not exist is refused');
  assert.ok(posted.every(u => !/facebook|graph\.|business\.google|api\.twitter|linkedin/i.test(u)), 'HQ never calls Facebook, Google or any social service');
});

test('HQ learns the monthly price ids from the Books worker, so STRIPE_PRICES_* on hq are optional', async (t) => {
  const w = world(); w.env.STRIPE_KEY = ['rk', 'test', 'HQREADONLY'].join('_'); const orig = w.env.BOOKS.fetch;
  w.env.BOOKS.fetch = async (url, init = {}) => new URL(url).pathname === '/stripe/status' ? Response.json({ secretKey: true, webhookSecret: true, prices: { receptionist: 'price_rec', receptionist_setup: 'price_recs', books: 'price_bk', books_setup: 'price_bks' } }) : orig(url, init);
  const sub = (id, price, amount) => ({ id, status: 'active', created: 1790000000, customer: { name: id, email: `${id}@example.test` }, items: { data: [{ quantity: 1, price: { id: price, unit_amount: amount, product: {}, recurring: { interval: 'month' } } }] }, latest_invoice: { status: 'paid' } });
  t.mock.method(globalThis, 'fetch', async (u) => { const p = String(u); if (p.includes('/subscriptions')) return Response.json({ data: [sub('Dave', 'price_bk', 15000), sub('Steve', 'price_rec', 39700)] }); if (/\/prices\/(\w+)/.test(p)) return new Response(JSON.stringify({ error: { message: 'x' } }), { status: 404 }); return Response.json({ data: [] }); });
  const { cookie } = await enrol(w); const page = await (await call(w, '/payments', { cookie })).text();
  assert.ok(!/not matched to a product/.test(page), 'subscriptions on the Books-listed price ids are recognised with no hq price variables');
  assert.match(await (await call(w, '/leads', { cookie })).text(), /1 .*Receptionist|Receptionist|Books/, 'the leads page still loads');
});

test('setup-fee reminder: non-founding Receptionist clients whose trial ends within 2 days or has ended show on Home and the lead page until ticked; founding, cancelled and ticked ones never do; failed payments are flagged', async () => {
  const { setupDue } = await import('../workers/hq/leads.js');
  const now = Date.parse('2026-11-10T09:00:00Z'), secs = (d) => Math.floor((now + d * 86400000) / 1000);
  const L = (id, over = {}) => ({ id, name: id, product: 'receptionist', status: 'trial', checklist: {}, subscription: { id: 's', status: 'trialing', trial_end: secs(1) }, ...over });
  const rows = setupDue([L('soon'), L('over', { subscription: { status: 'active', trial_end: secs(-3) } }), L('later', { subscription: { status: 'trialing', trial_end: secs(6) } }), L('founding', { checklist: { founding: true } }), L('done', { checklist: { setup_fee: true } }), L('cancelled', { subscription: { status: 'cancelled', trial_end: secs(-1) } }), L('lost', { status: 'lost' }), L('books', { product: 'books' }), L('nosub', { subscription: undefined })], now);
  assert.deepEqual(rows.map(r => [r.lead.id, r.over]), [['soon', false], ['over', true]]);
  const w = world(); const orig = w.env.BOOKS.fetch; const real = Math.floor(Date.now() / 1000);
  const leads = [{ id: 'S1', name: 'Sam Setup', phone: '+447700900611', product: 'receptionist', status: 'trial', checklist: { payment: true }, history: [], messages: [], created: Date.now(), updated: Date.now(), subscription: { id: 'sub', status: 'trialing', at: Date.now(), trial_end: real - 3600 } }, { id: 'S2', name: 'Pat Pays', phone: '+447700900612', product: 'receptionist', status: 'trial', checklist: { payment: true }, history: [], messages: [], created: Date.now(), updated: Date.now(), subscription: { id: 'sub2', status: 'past_due', at: Date.now(), trial_end: real + 9 * 86400 } }];
  w.env.BOOKS.fetch = async (url, init = {}) => { const p = new URL(url).pathname; if (p === '/leads' && !init.method) return Response.json(leads); const m = /^\/leads\/(S\d)$/.exec(p); if (m && !init.method) return Response.json(leads.find(l => l.id === m[1])); return orig(url, init); };
  const { cookie } = await enrol(w); const home = await (await call(w, '/', { cookie })).text();
  assert.match(home, /1 setup fee to invoice/); assert.match(home, /Sam Setup \(trial ended\)/); assert.ok(!/Pat Pays \(/.test(home), 'a trial ending in 9 days is not due yet');
  const p1 = await (await call(w, '/leads/S1', { cookie })).text(); assert.match(p1, /Setup fee: invoice the 497 pounds now \(the trial has ended\)/); assert.match(p1, /Setup fee invoiced when the trial ended/);
  const p2 = await (await call(w, '/leads/S2', { cookie })).text(); assert.match(p2, /Their payment failed/); assert.match(p2, /after 14 days, phone them/);
});
