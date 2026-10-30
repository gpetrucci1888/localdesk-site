// Screenshots of every HQ page at phone and desktop size, with made-up data (writes PNGs to $OUT). Needs Playwright.
//   OUT=/tmp/shots node test/browser/hq.shots.cjs
const http = require('http'); const fs = require('fs');
const { chromium } = require('playwright');
const OUT = process.env.OUT || '/tmp/hq-shots'; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const H = await import('../harness.mjs');
  const { default: hq, Vault, totp, backupDaily } = await import('../../workers/hq/worker.js');
  const w = H.world(); const net = H.network({ after() {} });
  await H.seedClient(w, { realm: H.REALM, appKey: 'appkey-real-00001', name: 'Penrose Plumbing', env: 'production' });
  await H.seedClient(w, { realm: H.SANDBOX_REALM, appKey: 'demo-appkey-0001', name: 'JCM Group', env: 'sandbox', demo: true });
  const real = globalThis.fetch;
  globalThis.fetch = async (u, i) => {
    const p = String(u);
    if (p.includes('api.stripe.com')) {
      if (p.includes('/subscriptions')) return Response.json({ data: [
        { id: 's1', status: 'active', created: 1790000000, customer: { name: 'Penrose Plumbing', email: 'p@example.test' }, items: { data: [{ quantity: 1, price: { unit_amount: 15000, nickname: 'Books monthly', recurring: { interval: 'month' } } }] } },
        { id: 's2', status: 'active', created: 1789000000, customer: { name: 'Tamar Roofing', email: 't@example.test' }, items: { data: [{ quantity: 1, price: { unit_amount: 39700, nickname: 'Growth', recurring: { interval: 'month' } } }] } },
        { id: 's3', status: 'past_due', created: 1788000000, customer: { name: 'Looe Electrics', email: 'l@example.test' }, items: { data: [{ quantity: 1, price: { unit_amount: 19900, nickname: 'Starter', recurring: { interval: 'month' } } }] } }] });
      if (p.includes('/charges')) return Response.json({ data: [
        { created: 1790200000, amount: 15000, paid: true, billing_details: { name: 'Penrose Plumbing' } },
        { created: 1790100000, amount: 39700, paid: true, billing_details: { name: 'Tamar Roofing' } },
        { created: 1790000000, amount: 19900, paid: false, failure_message: 'Card declined', billing_details: { name: 'Looe Electrics' } }] });
      return Response.json({ data: [] });
    }
    return real(u, i);
  };
  const PASS = 'shot passphrase'; let env;
  const makeEnv = () => { const vault = new Vault({ storage: new H.MemStorage() }); const stub = { fetch: (u, init) => vault.fetch(new Request(u, init)) }; return { OWNER_PASSWORD: PASS, ADMIN_KEY: H.ADMIN, STRIPE_KEY: 'rk_test_x', VAULT: { idFromName: () => 'o', get: () => stub },
    BOOKS: { fetch: (u, init) => H.books.fetch(new Request(u, init && init.body && typeof init.body !== 'string' ? { ...init, duplex: 'half' } : init), w.booksEnv) } }; };
  env = makeEnv(); await backupDaily(env);
  const srv = await new Promise(ok => { const s = http.createServer(async (req, res) => {
    const chunks = []; for await (const x of req) chunks.push(x);
    const r = await hq.fetch(new Request('https://hq.test' + req.url, { method: req.method, headers: req.headers, redirect: 'manual', body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }), env);
    const hd = {}; r.headers.forEach((v, k) => { hd[k] = v; }); res.writeHead(r.status, hd); res.end(Buffer.from(await r.arrayBuffer()));
  }).listen(0, () => ok({ s, port: s.address().port })); });
  const base = `http://localhost:${srv.port}`; const browser = await chromium.launch();
  for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 860 }]]) {
    env = makeEnv(); await backupDaily(env);
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: name === 'phone' ? 2 : 1 }); const page = await ctx.newPage();
    await page.goto(base + '/login'); await page.screenshot({ path: `${OUT}/${name}-login.png` });
    await page.fill('[name=password]', PASS); await page.click('.btn'); await page.waitForTimeout(300);
    const key = (await page.textContent('.key')).trim(); await page.screenshot({ path: `${OUT}/${name}-enrol.png` });
    await page.fill('[name=password]', PASS); await page.fill('[name=code]', await totp(key, Math.floor(Date.now() / 30000))); await page.click('.btn'); await page.waitForTimeout(600);
    for (const p of ['/', '/customers', '/payments', '/books', '/books/client/111', '/books/new', '/receptionist', '/backups', '/settings', '/more', '/docs', '/docs/start']) {
      await page.goto(base + p); await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${name}-${p === '/' ? 'home' : p.slice(1).replace('/', '-')}.png`, fullPage: true });
    }
    await ctx.close();
  }
  await browser.close(); srv.s.close(); console.log('shots in', OUT); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
