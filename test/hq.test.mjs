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

test('a visitor who is not logged in is sent to the login page; the login page has strict headers, no scripts, and the brand font is public', async () => {
  const w = world();
  for (const p of ['/', '/customers', '/payments', '/books', '/books/new', '/books/client/111', '/books/client/111/check', '/receptionist', '/backups', '/settings', '/more', '/docs', '/docs/start']) {
    const r = await call(w, p); assert.equal(r.status, 303, p); assert.equal(r.headers.get('location'), '/login', p);
  }
  for (const [m, p] of [['POST', '/books/new'], ['POST', '/books/client/111/do/end'], ['POST', '/books/client/111/save'], ['POST', '/backups/download']]) assert.equal((await call(w, p, { method: m })).status, 303, `${m} ${p}`);
  assert.equal(w.booksCalls.length, 0, 'Books was never contacted');
  const login = await call(w, '/login'); assert.equal(login.status, 200);
  const csp = login.headers.get('content-security-policy');
  assert.match(csp, /default-src 'none'/); assert.doesNotMatch(csp, /script-src/); assert.match(csp, /frame-ancestors 'none'/); assert.match(csp, /font-src 'self'/);
  assert.equal(login.headers.get('x-frame-options'), 'DENY'); assert.equal(login.headers.get('cache-control'), 'no-store');
  assert.match(login.headers.get('x-robots-tag'), /noindex/); assert.equal(login.headers.get('referrer-policy'), 'no-referrer');
  assert.ok(!(await login.text()).includes('<script'));
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
