// Real-browser check of the Owner HQ against the real Books worker (fake QuickBooks): login, enrolment, pages, Books admin inside HQ.
//   node test/browser/hq.check.cjs
const http = require('http');
const { chromium } = require('playwright');
(async () => {
  const H = await import('../harness.mjs');
  const { default: hq, Vault, totp } = await import('../../workers/hq/worker.js');
  const w = H.world(); H.network({ after() {} });
  await H.seedClient(w, { realm: H.REALM, appKey: 'appkey-real-00001', name: 'Real Plumbing', env: 'production' });
  const PASS = 'a long test passphrase for the browser'; let env;
  const makeEnv = () => { const vault = new Vault({ storage: new H.MemStorage() }); const stub = { fetch: (u, init) => vault.fetch(new Request(u, init)) }; return { OWNER_PASSWORD: PASS, ADMIN_KEY: H.ADMIN, VAULT: { idFromName: () => 'o', get: () => stub },
    BOOKS: { fetch: (u, init) => H.books.fetch(new Request(u, init && init.body && typeof init.body !== 'string' ? { ...init, duplex: 'half' } : init), w.booksEnv) } }; };
  env = makeEnv();
  const srv = await new Promise(ok => { const s = http.createServer(async (req, res) => {
    const chunks = []; for await (const x of req) chunks.push(x);
    const r = await hq.fetch(new Request('https://hq.test' + req.url, { method: req.method, headers: req.headers, redirect: 'manual', body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }), env);
    const hd = {}; r.headers.forEach((v, k) => { hd[k] = v; }); res.writeHead(r.status, hd); res.end(Buffer.from(await r.arrayBuffer()));
  }).listen(0, () => ok({ s, port: s.address().port })); });
  const base = `http://localhost:${srv.port}`;
  const results = []; const ck = (n, ok, x = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); };
  const browser = await chromium.launch();
  for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 860 }]]) {
    env = makeEnv();
    const ctx = await browser.newContext({ viewport: vp, hasTouch: name === 'phone' }); const page = await ctx.newPage();
    await page.addInitScript(() => { document.addEventListener('securitypolicyviolation', e => (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + e.blockedURI)); });
    const t = (n) => `${name}: ${n}`;
    await page.goto(base + '/');
    ck(t('not logged in: sent to the login page'), page.url().endsWith('/login'));
    await page.fill('[name=password]', 'wrong'); await page.click('.btn'); await page.waitForTimeout(300);
    ck(t('wrong passphrase is refused kindly'), /didn't work/.test(await page.textContent('body')));
    await page.fill('[name=password]', PASS); await page.click('.btn'); await page.waitForTimeout(300);
    const key = (await page.textContent('.key')).trim();
    ck(t('first login shows the setup key and steps'), /^[A-Z2-7]{32}$/.test(key) && /Enter a setup key/.test(await page.textContent('body')));
    await page.fill('[name=password]', PASS); await page.fill('[name=code]', await totp(key, Math.floor(Date.now() / 30000) + (name === 'desktop' ? 0 : 0))); await page.click('.btn'); await page.waitForTimeout(700);
    ck(t('the code logs in and shows Home'), page.url() === base + '/' && /Good (morning|afternoon|evening)/.test(await page.textContent('h1')));
    const noScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    ck(t('Home fits the screen width (no sideways scrolling)'), noScroll);
    const nav = name === 'phone' ? '.tabs a' : '.side a';
    ck(t('navigation is visible with Home, Customers, Payments, Books'), (await page.$$eval(nav, els => els.filter(e => e.offsetParent).map(e => e.textContent.trim()))).join(',').includes('Home,Customers,Payments,Books'));
    const small = await page.$$eval(nav, els => els.filter(e => e.offsetParent).some(e => e.getBoundingClientRect().height < 44));
    ck(t('navigation buttons are big enough to tap'), !small);
    for (const [p, text] of [['/customers', 'Books clients'], ['/payments', 'Stripe'], ['/books', 'Add a new client'], ['/receptionist', 'Mia'], ['/backups', 'Take one now'], ['/settings', 'Where your passwords'], ['/docs', 'Step-by-step'], ['/docs/start', 'Three rules'], ['/more', 'Log out of HQ'], ['/books/new', 'Make the connect link']]) {
      await page.goto(base + p); ck(t(`page ${p} opens`), (await page.textContent('body')).includes(text));
      ck(t(`page ${p} fits the screen`), await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    }
    await page.goto(base + '/books'); await page.click('a.item'); await page.waitForTimeout(500);
    ck(t('tapping a client opens their page'), /Details/.test(await page.textContent('body')) && /Check their QuickBooks setup/.test(await page.textContent('body')));
    await page.goto(base + '/books/new'); await page.fill('#n', 'Synthetic Roofing'); await page.fill('#p', '07700 900123'); await page.selectOption('#e', 'sandbox'); await page.click('.btn'); await page.waitForTimeout(900);
    ck(t('adding a client gives a one-time connect link and send buttons'), /connect\?invite=/.test(await page.textContent('body')) && /Send on WhatsApp/.test(await page.textContent('body')));
    ck(t('the admin key never reached the browser'), !(await page.content()).includes(H.ADMIN));
    ck(t('no CSP violation anywhere'), (await page.evaluate(() => window.__csp || [])).length === 0, JSON.stringify(await page.evaluate(() => window.__csp || [])));
    await page.goto(base + '/settings'); await page.click('form button.btn'); await page.waitForTimeout(400);
    ck(t('log out returns to the login page'), page.url().endsWith('/login'));
    await page.goto(base + '/customers'); ck(t('after logout the pages are closed again'), page.url().endsWith('/login'));
    await ctx.close();
  }
  await browser.close(); srv.s.close();
  const f = results.filter(r => !r).length; console.log(`${results.length - f} passed, ${f} failed`); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
