// Real-browser check of the Content-Security-Policy: loads the actual pages (served locally by the real workers,
// on fake data) in Chromium and fails on any CSP violation. Needs Playwright (not a dependency of the repo):
//   PDFJS_DIR=/path/to/pdfjs-dist/build  TEST_PDF=/path/to/any.pdf  node test/browser/csp.check.cjs
// The PDF reader is normally loaded from cdnjs; here it is served from PDFJS_DIR so the check works offline.
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const PDFJS_DIR = process.env.PDFJS_DIR, TEST_PDF = process.env.TEST_PDF;
if (!PDFJS_DIR || !TEST_PDF) { console.error('Set PDFJS_DIR and TEST_PDF'); process.exit(2); }

(async () => {
  const H = await import('../harness.mjs');
  const w = H.world();
  H.network({ after() {} }); // fake QuickBooks, Intuit and Twilio: nothing real can be reached
  const DEMO = 'demo-appkey-0001', REAL = 'appkey-real-00001';
  await H.seedClient(w, { realm: H.SANDBOX_REALM, appKey: DEMO, name: 'Demo', env: 'sandbox', demo: true, extras: 'quotes' });
  await H.seedClient(w, { realm: H.REALM, appKey: REAL, name: 'Real Plumbing', env: 'production' });
  await w.storage.put('pack:PACKCSPCHECK00000001', { realmId: H.SANDBOX_REALM, from: '2026-07-06', to: '2026-10-05', created: Date.now() });

  const serve = (handler) => new Promise(ok => { const s = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await handler(new Request('https://x.test' + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }));
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
  }).listen(0, () => ok({ s, port: s.address().port })); });
  const appSrv = await serve(r => H.app.fetch(new Request('https://app.test' + new URL(r.url).pathname + new URL(r.url).search, r), w.appEnv));
  const booksSrv = await serve(r => H.books.fetch(new Request('https://books.test' + new URL(r.url).pathname + new URL(r.url).search, r), w.booksEnv));
  const other = await serve(async () => new Response('<h1>some other site</h1>', { headers: { 'Content-Type': 'text/html' } }));

  const results = []; const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); };
  const browser = await chromium.launch();
  const watch = async (page) => { await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)); }); };
  const violations = (page) => page.evaluate(() => window.__csp || []);
  const canned = (page, key) => page.route(`**/${key}/api/**`, r => {
    const p = new URL(r.request().url()).pathname.split('/api/')[1];
    const body = /^(summary)/.test(p) ? { month: '2026-10', moneyIn: 1000, moneyOut: 400, profit: 600, owed: 0, owedCount: 0, taxPot: 150 } : /^quarter/.test(p) ? { from: '2026-10-06', to: '2027-01-05', due: '2027-02-07', income: 1, expenses: 1, profit: 0, lines: [] } : /^trend/.test(p) ? { months: [] } : /^(owed|untidy|quotes|noreceipt|recent|customers|customerlist|invoices|changes)/.test(p) ? [] : {};
    r.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });

  // 1. the app itself, every tab, with the service worker registering
  { const page = await browser.newPage(); await watch(page); await canned(page, DEMO);
    await page.goto(`http://localhost:${appSrv.port}/${DEMO}/`); await page.waitForTimeout(1500);
    for (const tab of ['receipts', 'jobs', 'owed', 'invoice', 'home']) { await page.click(`nav [data-tab=${tab}]`); await page.waitForTimeout(300); }
    check('app: every tab opens with no CSP violation', (await violations(page)).length === 0, JSON.stringify(await violations(page)));
    check('app: the page rendered (title element present)', await page.$('#title') !== null);
    const sw = await page.evaluate(async () => { try { const r = await navigator.serviceWorker.ready; return !!r.active; } catch (e) { return false; } });
    check('app: the service worker registers (worker-src allows it)', sw);
    await page.close(); }

  // 2. the login page, step by step
  { const page = await browser.newPage(); await watch(page);
    await page.route('**/login/send', r => r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }));
    await page.goto(`http://localhost:${appSrv.port}/${REAL}/`); await page.click('#send'); await page.waitForSelector('#step2:not([hidden])'); await page.type('#code', '1234');
    check('login: page, send-code and typing a code, no CSP violation', (await violations(page)).length === 0, JSON.stringify(await violations(page)));
    await page.close(); }

  // 3. a PDF upload end to end (PDF reader + its worker come from the cdnjs address, served locally)
  { const page = await browser.newPage(); await watch(page); await canned(page, DEMO);
    let readCalled = false;
    await page.route('https://cdnjs.cloudflare.com/**', r => { const f = r.request().url().split('/').pop(); const p = `${PDFJS_DIR}/${f}`; fs.existsSync(p) ? r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(p) }) : r.abort(); });
    await page.route(`**/${DEMO}/read`, r => { readCalled = r.request().postData().includes('data:image'); r.fulfill({ contentType: 'application/json', body: JSON.stringify({ supplier: 'Test Supplies', date: '2026-10-28', total: 42, vat: 7, category: 'Materials', items: 'x', readable: true }) }); });
    await page.goto(`http://localhost:${appSrv.port}/${DEMO}/`); await page.waitForTimeout(1200);
    await page.click('nav [data-tab=receipts]'); await page.setInputFiles('#pick', TEST_PDF); await page.waitForTimeout(4000);
    check('PDF upload: reader loads from the allowed host, renders, and the page sends the image to be read', readCalled);
    check('PDF upload: no CSP violation (script, worker, blob and data images all allowed)', (await violations(page)).length === 0, JSON.stringify(await violations(page)));
    await page.close(); }

  // 4. the accountant pack page: its Print button works under a nonce-only script policy
  { const page = await browser.newPage(); await watch(page);
    await page.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    await page.goto(`http://localhost:${booksSrv.port}/pack/PACKCSPCHECK00000001`);
    await page.click('#prt'); await page.waitForTimeout(300);
    check('pack page: Print button works (nonce script runs)', (await page.evaluate(() => window.__printed)) === 1);
    check('pack page: no CSP violation', (await violations(page)).length === 0, JSON.stringify(await violations(page)));
    await page.close(); }

  // 5. another site cannot put the app, the login page or a pack page in a frame
  { const page = await browser.newPage();
    for (const [name, url] of [['app', `http://localhost:${appSrv.port}/${DEMO}/`], ['login page', `http://localhost:${appSrv.port}/${REAL}/`], ['pack page', `http://localhost:${booksSrv.port}/pack/PACKCSPCHECK00000001`]]) {
      await page.goto(`http://localhost:${other.port}/`);
      await page.evaluate(u => { const f = document.createElement('iframe'); f.id = 'f'; f.src = u; document.body.appendChild(f); }, url);
      await page.waitForTimeout(1500);
      const frame = page.frames().find(f => f !== page.mainFrame());
      const blocked = !frame || /chrome-error|about:blank/.test(frame.url()) || !(await frame.evaluate(() => document.title !== undefined && document.body && document.body.innerText.length > 0).catch(() => false));
      check(`framing: another site cannot embed the ${name}`, blocked, frame ? frame.url() : '');
    }
    await page.close(); }

  await browser.close(); [appSrv, booksSrv, other].forEach(x => x.s.close());
  const failed = results.filter(r => !r).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
