// Real-browser check of the first-login terms sheet (needs Playwright, like csp.check.cjs): node test/browser/agree.check.cjs
const http = require('http');
const { chromium } = require('playwright');
(async () => {
  const H = await import('../harness.mjs');
  const w = H.world(); H.network({ after() {} });
  const c = await H.seedClient(w, { realm: H.REALM, appKey: 'appkey-real-00001', name: 'Real Plumbing', env: 'production' });
  const session = await H.seedSession(w, c.appKey);
  const srv = await new Promise(ok => { const s = http.createServer(async (req, res) => {
    const chunks = []; for await (const x of req) chunks.push(x);
    const r = await H.app.fetch(new Request('https://app.test' + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }), w.appEnv);
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
  }).listen(0, () => ok({ s, port: s.address().port })); });
  const results = []; const check = (n, ok) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}`); };
  const browser = await chromium.launch(); const ctx = await browser.newContext();
  await ctx.addCookies([{ name: 'bk', value: session, url: `http://localhost:${srv.port}/${c.appKey}/` }]);
  const page = await ctx.newPage(); const csp = [];
  await page.addInitScript(() => { document.addEventListener('securitypolicyviolation', e => (window.__csp = window.__csp || []).push(e.violatedDirective)); });
  await page.goto(`http://localhost:${srv.port}/${c.appKey}/`); await page.waitForTimeout(1200);
  check('terms sheet is shown to a client who has not agreed', await page.isVisible('#agreeBox'));
  check('Continue is disabled until the box is ticked', await page.isDisabled('#agreeGo'));
  await page.mouse.click(5, 5); await page.waitForTimeout(200);
  check('tapping outside does not dismiss it', await page.isVisible('#agreeBox'));
  await page.check('#agreeBox'); check('ticking enables Continue', !(await page.isDisabled('#agreeGo')));
  await page.click('#agreeGo'); await page.waitForTimeout(800);
  check('sheet closes after agreeing', !(await page.isVisible('#agreeBox').catch(() => false)));
  check('the agreement was recorded with a date', Boolean((await w.storage.get(`client:${H.REALM}`)).agreed));
  await page.reload(); await page.waitForTimeout(1000);
  check('not shown again once agreed', (await page.$('#agreeBox')) === null);
  check('no CSP violation', ((await page.evaluate(() => window.__csp || [])).length) === 0);
  await browser.close(); srv.s.close();
  const failed = results.filter(r => !r).length; console.log(`${results.length - failed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
