// Real-browser check of the Books admin page (/admin) and the home-screen install card. Needs Playwright:
//   node test/browser/admin.check.cjs
const http = require('http');
const { chromium } = require('playwright');
(async () => {
  const H = await import('../harness.mjs');
  const w = H.world(); const net = H.network({ after() {} });
  await H.seedClient(w, { realm: H.SANDBOX_REALM, appKey: 'demo-appkey-0001', name: 'Demo', env: 'sandbox', demo: true });
  await H.seedClient(w, { realm: H.REALM, appKey: 'appkey-real-00001', name: 'Real Plumbing', env: 'production' });
  const serve = (handler) => new Promise(ok => { const s = http.createServer(async (req, res) => {
    const chunks = []; for await (const x of req) chunks.push(x);
    const r = await handler(new Request('https://x.test' + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }));
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
  }).listen(0, () => ok({ s, port: s.address().port })); });
  const books = await serve(r => H.books.fetch(new Request('https://books.test' + new URL(r.url).pathname + new URL(r.url).search, r), w.booksEnv));
  const app = await serve(r => H.app.fetch(new Request('https://app.test' + new URL(r.url).pathname + new URL(r.url).search, r), w.appEnv));
  const results = []; const check = (n, ok, x = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); };
  const browser = await chromium.launch(); const page = await browser.newPage();
  await page.addInitScript(() => { document.addEventListener('securitypolicyviolation', e => (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + e.blockedURI)); });
  await page.goto(`http://localhost:${books.port}/admin`);
  const res = await page.request.get(`http://localhost:${books.port}/admin`);
  check('admin page has CSP, frame protection, no-store', /frame-ancestors 'none'/.test(res.headers()['content-security-policy']) && res.headers()['x-frame-options'] === 'DENY' && /no-store/.test(res.headers()['cache-control']));
  check('admin page asks for the key first', await page.isVisible('#key') && !(await page.isVisible('#app')));
  await page.fill('#key', 'wrong-key'); await page.click('#keyGo'); await page.waitForTimeout(600);
  check('a wrong key does not unlock it', !(await page.isVisible('#app')));
  await page.reload(); await page.fill('#key', H.ADMIN); await page.click('#keyGo'); await page.waitForTimeout(900);
  check('the right key unlocks it and lists clients', await page.isVisible('#app') && (await page.textContent('#list')).includes('Real Plumbing'));
  check('the key is held for this tab only (not in localStorage)', await page.evaluate(() => localStorage.length === 0));
  await page.fill('#nName', 'Synthetic Roofing'); await page.fill('#nPhone', '07700 900123'); await page.selectOption('#nEnv', 'sandbox'); await page.click('#nGo'); await page.waitForTimeout(900);
  check('inviting a client (phone typed with a leading 0) gives a one-off connect link', (await page.textContent('#nOut')).includes('/connect?invite='));
  check('admin page: no CSP violation', ((await page.evaluate(() => window.__csp || [])).length) === 0, JSON.stringify(await page.evaluate(() => window.__csp || [])));
  // install card on the demo app, as an iPhone browser tab (not yet added to the home screen)
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 390, height: 800 } });
  const a = await ctx.newPage(); await a.addInitScript(() => { document.addEventListener('securitypolicyviolation', e => (window.__csp = window.__csp || []).push(e.violatedDirective)); });
  await a.goto(`http://localhost:${app.port}/demo-appkey-0001/`); await a.waitForTimeout(1800);
  check('install card shows the iPhone steps on an iPhone', await a.isVisible('#installCard') && await a.isVisible('#installIos'));
  await a.click('#installLater'); await a.waitForTimeout(300);
  check('"Not now" hides it', !(await a.isVisible('#installCard')));
  await a.reload(); await a.waitForTimeout(1500);
  check('and it stays hidden after a reload (snoozed a week)', !(await a.isVisible('#installCard')));
  check('app with install card: no CSP violation', ((await a.evaluate(() => window.__csp || [])).length) === 0);
  const d = await browser.newPage(); await d.goto(`http://localhost:${app.port}/demo-appkey-0001/`); await d.waitForTimeout(1200);
  check('on a laptop the card stays hidden', !(await d.isVisible('#installCard')));
  await browser.close(); [books, app].forEach(x => x.s.close());
  const failed = results.filter(r => !r).length; console.log(`${results.length - failed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
