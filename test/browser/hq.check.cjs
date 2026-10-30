// Real-browser check of the Owner HQ against the real Books worker (fake QuickBooks): login, enrolment, pages, Books admin inside HQ.
//   node test/browser/hq.check.cjs
const http = require('http');
const { chromium } = require('playwright');
(async () => {
  const H = await import('../harness.mjs');
  const { default: hq, Vault, totp } = await import('../../workers/hq/worker.js');
  const w = H.world(); H.network({ after() {} });
  await H.seedClient(w, { realm: H.REALM, appKey: 'appkey-real-00001', name: 'Real Plumbing', env: 'production' });
  const vault = new Vault({ storage: new H.MemStorage() }); const stub = { fetch: (u, init) => vault.fetch(new Request(u, init)) };
  const PASS = 'a long test passphrase for the browser';
  const env = { OWNER_PASSWORD: PASS, ADMIN_KEY: H.ADMIN, VAULT: { idFromName: () => 'o', get: () => stub },
    BOOKS: { fetch: (u, init) => H.books.fetch(new Request(u, init && init.body && typeof init.body !== 'string' ? { ...init, duplex: 'half' } : init), w.booksEnv) } };
  const srv = await new Promise(ok => { const s = http.createServer(async (req, res) => {
    const chunks = []; for await (const x of req) chunks.push(x);
    const r = await hq.fetch(new Request('https://hq.test' + req.url, { method: req.method, headers: req.headers, redirect: 'manual', body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }), env);
    const hd = {}; r.headers.forEach((v, k) => { hd[k] = v; }); res.writeHead(r.status, hd); res.end(Buffer.from(await r.arrayBuffer()));
  }).listen(0, () => ok({ s, port: s.address().port })); });
  const base = `http://localhost:${srv.port}`;
  const results = []; const ck = (n, ok, x = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); };
  const browser = await chromium.launch(); const page = await browser.newPage();
  await page.addInitScript(() => { document.addEventListener('securitypolicyviolation', e => (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + e.blockedURI)); });
  await page.goto(base + '/');
  ck('not logged in: sent to the login page', page.url().endsWith('/login'));
  await page.fill('[name=password]', 'wrong'); await page.click('button.go'); await page.waitForTimeout(300);
  ck('wrong passphrase is refused', /That did not work/.test(await page.textContent('body')));
  await page.fill('[name=password]', PASS); await page.click('button.go'); await page.waitForTimeout(300);
  const key = (await page.textContent('code'));
  ck('first login shows an authenticator setup key', /^[A-Z2-7]{32}$/.test(key));
  await page.fill('[name=password]', PASS); await page.fill('[name=code]', await totp(key, Math.floor(Date.now() / 30000))); await page.click('button.go'); await page.waitForTimeout(600);
  ck('the code logs in and shows the overview', page.url() === base + '/' && /Overview/.test(await page.textContent('h1')));
  for (const [p, text] of [['/customers', 'Real Plumbing'], ['/products', 'Receptionist'], ['/settings', 'ADMIN_KEY'], ['/docs/start', 'Rules that protect you'], ['/backups', 'Download']]) {
    await page.goto(base + p); ck(`page ${p} opens`, (await page.textContent('body')).includes(text));
  }
  await page.goto(base + '/books-admin'); await page.waitForTimeout(1500);
  ck('Books admin opens already unlocked and lists the client', await page.isVisible('#app') && (await page.textContent('#list')).includes('Real Plumbing'));
  await page.fill('#nName', 'Synthetic Roofing'); await page.fill('#nPhone', '07700 900123'); await page.selectOption('#nEnv', 'sandbox'); await page.click('#nGo'); await page.waitForTimeout(1000);
  ck('inviting a client from inside HQ works', (await page.textContent('#nOut')).includes('/connect?invite='));
  ck('the admin key never reached the browser', !(await page.content()).includes(H.ADMIN) && !(await page.evaluate(() => JSON.stringify(sessionStorage) + JSON.stringify(localStorage))).includes(H.ADMIN));
  ck('no CSP violation anywhere', (await page.evaluate(() => window.__csp || [])).length === 0, JSON.stringify(await page.evaluate(() => window.__csp || [])));
  await page.goto(base + '/'); await page.click('form.out button'); await page.waitForTimeout(400);
  ck('log out returns to the login page', page.url().endsWith('/login'));
  await page.goto(base + '/customers'); ck('after logout the pages are closed again', page.url().endsWith('/login'));
  const direct = await page.request.get(base + '/ba/health'); ck('after logout the admin routes answer 401', direct.status() === 401);
  await browser.close(); srv.s.close();
  const f = results.filter(r => !r).length; console.log(`${results.length - f} passed, ${f} failed`); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
