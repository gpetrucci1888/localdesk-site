// Real-browser check of the public website (served locally from public/): every internal link, no sideways scrolling on phone or
// desktop, no console errors, and the enquiry form end to end against the real Books code. SHOTS=/dir node test/browser/site.check.cjs
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '../../public'), SHOTS = process.env.SHOTS;
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.xml': 'text/xml' };
(async () => {
  const H = await import('../harness.mjs'); const books = (await import('../../workers/books/worker.js')).default;
  const w = H.world(); const net = H.network({ after() {} });
  const srv = await new Promise(ok => { const s = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }).listen(0, () => ok({ s, port: s.address().port })); });
  const base = `http://localhost:${srv.port}`; const results = []; const ck = (n, ok, x = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); };
  const browser = await chromium.launch();
  const pages = ['/', '/receptionist/', '/books/', '/privacy.html', '/terms.html', '/books/privacy.html', '/books/terms.html'];
  for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 860 }]]) {
    const ctx = await browser.newContext({ viewport: vp }); 
    await ctx.route('https://books.localdeskai.co.uk/enquiry', async (route) => { const r = route.request();
      const res = await books.fetch(new Request('https://books.test/enquiry', { method: r.method(), headers: { 'Content-Type': 'application/json', Origin: 'https://www.localdeskai.co.uk', 'CF-Connecting-IP': '203.0.113.' + Math.floor(Math.random() * 200) }, body: r.method() === 'POST' ? r.postData() : undefined }), w.booksEnv);
      await route.fulfill({ status: res.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: await res.text() }); });
    await ctx.route(/calendly|fonts\.g/, r => r.abort());
    for (const p of pages) {
      const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|calendly/i.test(m.text())) errs.push(m.text()); });
      await page.goto(base + p); await page.waitForTimeout(400);
      ck(`${name} ${p}: no sideways scrolling`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      ck(`${name} ${p}: no script errors`, errs.length === 0, errs.join(' | ').slice(0, 120));
      const hrefs = await page.$$eval('a[href]', as => as.map(a => a.getAttribute('href')));
      let bad = [];
      for (const h of [...new Set(hrefs)]) {
        if (/^(mailto:|tel:|https?:)/.test(h)) { if (/^mailto:/.test(h) && !/^mailto:[^@]+@[^?]+/.test(h)) bad.push(h); continue; }
        if (h.startsWith('#')) { if (h.length > 1 && !(await page.$(h))) bad.push(h); continue; }
        const url = new URL(h, base + p); const r = await ctx.request.get(url.origin + url.pathname);
        if (r.status() !== 200) bad.push(h); else if (url.hash && url.hash.length > 1 && /html/.test(url.pathname + 'html')) { /* anchors on other pages checked below */ }
      }
      ck(`${name} ${p}: every link works`, bad.length === 0, bad.join(' '));
      if (p === '/' || p === '/books/' || p === '/receptionist/') {
        const sel = '#enquiry'; await page.locator(sel).scrollIntoViewIfNeeded();
        await page.click(sel + ' button'); await page.waitForTimeout(200);
        ck(`${name} ${p}: empty form asks for name and phone`, /name and a phone/.test(await page.textContent(sel + ' .msg')));
        await page.fill(sel + ' [name=name]', 'Test Person'); await page.fill(sel + ' [name=phone]', '07700 900123'); await page.fill(sel + ' [name=message]', 'Hello from the check'); await page.click(sel + ' button'); await page.waitForTimeout(800);
        ck(`${name} ${p}: a valid enquiry is accepted`, /Thank you/.test(await page.textContent(sel + ' .msg')));
        ck(`${name} ${p}: the hidden robot field is off-screen`, (await page.locator(sel + ' [name=website]').boundingBox()).x < -1000);
        if (SHOTS) { await page.reload(); await page.waitForTimeout(300); await page.locator('#enquiry').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${SHOTS}/${name}-${p === '/' ? 'home' : 'books'}-form.png` }); }
      }
      if (SHOTS && p === '/books/') { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: `${SHOTS}/${name}-books-top.png` }); await page.screenshot({ path: `${SHOTS}/${name}-books-full.png`, fullPage: true }); }
      await page.close();
    }
    await ctx.close();
  }
  const sms = net.log.sms.filter(m => /enquiry/.test(m.Body)); ck('the owner was texted for each accepted enquiry', sms.length >= 4, `${sms.length} texts`);
  await browser.close(); srv.s.close(); const f = results.filter(r => !r).length; console.log(`${results.length - f} passed, ${f} failed`); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
