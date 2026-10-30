// Demo protection: the demo can only ever be a practice company, nothing leaves it, and its usage is capped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, network, seedClient, seedSession, callBooks, asAdmin, REALM, SANDBOX_REALM } from './harness.mjs';

const DEMO_KEY = 'demo-appkey-0001';
const demo = async (w, extra = {}) => seedClient(w, { realm: SANDBOX_REALM, appKey: DEMO_KEY, name: 'Demo', phone: '+447700900003', env: 'sandbox', demo: true, extras: 'quotes', ...extra });
const asDemo = (w, method, path, { body, ip } = {}) => callBooks(w, method, path, { headers: { 'X-App': DEMO_KEY, ...(ip ? { 'CF-Connecting-IP': ip } : {}) }, body });

test('the demo flag does nothing on a real (production) company', async (t) => {
  const w = world(); network(t);
  const real = await seedClient(w, { demo: true, env: 'production' });
  const app = await (await callBooks(w, 'GET', '/c/app', { headers: { 'X-App': real.appKey } })).json();
  assert.equal(app.loggedIn, false);
  assert.equal((await callBooks(w, 'GET', '/c/summary', { headers: { 'X-App': real.appKey } })).status, 401, 'real books stay behind the login');
});

test('a connection with no recorded type is never treated as a demo', async (t) => {
  const w = world(); network(t);
  const odd = await seedClient(w, { demo: true, env: 'sandbox' });
  const tok = await w.storage.get(`tokens:${REALM}`); delete tok.env; await w.storage.put(`tokens:${REALM}`, tok);
  const app = await (await callBooks(w, 'GET', '/c/app', { headers: { 'X-App': odd.appKey } })).json();
  assert.equal(app.loggedIn, false);
});

test('demo mode cannot be switched on for a production company, only a sandbox one', async (t) => {
  const w = world(); network(t);
  await seedClient(w, { env: 'production' });
  await demo(w);
  const bad = await asAdmin(w, 'PUT', `/client/${REALM}`, { demo: true });
  assert.equal(bad.status, 500);
  assert.match(await bad.text(), /only allowed on a sandbox/);
  assert.equal((await w.storage.get(`client:${REALM}`)).demo, undefined);
  assert.equal((await asAdmin(w, 'PUT', `/client/${SANDBOX_REALM}`, { demo: true })).status, 200);
  assert.equal((await asAdmin(w, 'PUT', `/client/${REALM}`, { demo: false })).status, 200, 'switching it off is always fine');
});

test('the demo shows no personal contact details and needs no login', async (t) => {
  const w = world(); network(t);
  await demo(w);
  const app = await (await asDemo(w, 'GET', '/c/app')).json();
  assert.equal(app.loggedIn, true);
  assert.equal(app.phoneEnd, '');
  assert.equal(app.canLogin, false);
  const me = await (await asDemo(w, 'GET', '/c/me')).json();
  assert.equal(me.phoneEnd, '');
});

test('the demo never texts anyone: no login codes, no problem alerts, no scheduled texts', async (t) => {
  const w = world(); const { log } = network(t);
  await demo(w);
  assert.equal((await asDemo(w, 'POST', '/c/login/send')).status, 400);
  assert.equal((await asDemo(w, 'POST', '/c/login/verify', { body: { code: '123456' } })).status, 400);
  assert.equal((await asDemo(w, 'POST', '/c/problem', { body: { what: 'read', message: 'spam' } })).status, 200);
  const { runCron } = await import('./harness.mjs');
  await runCron(w, '0 8 1 * *');           // monthly texts
  await runCron(w, '0 8 8 1,4,7,10 *');    // quarterly packs
  assert.deepEqual(log.sms.filter(m => m.To === '+447700900003'), [], 'nothing was texted to the demo\'s phone');
  assert.ok(log.sms.every(m => m.To === '+447700900001' && !/Demo/.test(m.Body)), 'the only texts are the owner\'s own summaries, and they don\'t include the demo');
});

test('the demo never emails: invoices, quotes, reminders and chasing are all switched off', async (t) => {
  const w = world(); const { qb } = network(t);
  await demo(w);
  // an invoice with an email address is made but not sent
  const inv = await (await asDemo(w, 'POST', '/c/invoice', { body: { customer: 'Synthetic Customer', email: 'someone@example.test', description: 'Test job', amount: 100 } })).json();
  assert.ok(inv.ok, JSON.stringify(inv));
  assert.equal(inv.sentTo, '');
  // so is a quote
  const q = await (await asDemo(w, 'POST', '/c/quote', { body: { customer: 'Synthetic Customer', email: 'someone@example.test', description: 'Test quote', amount: 500 } })).json();
  assert.ok(q.ok, JSON.stringify(q));
  assert.equal(q.sentTo, '');
  // reminders and quote chasing say why they won't
  qb.add('Invoice', { Id: '900', DocNumber: '900', BillEmail: { Address: 'late@example.test' }, Balance: 50, TotalAmt: 50, CustomerRef: { value: '1', name: 'X' } });
  qb.add('Estimate', { Id: '901', DocNumber: '901', BillEmail: { Address: 'quote@example.test' }, TotalAmt: 50, TxnDate: '2026-10-01', TxnStatus: 'Pending', CustomerRef: { value: '1', name: 'X' }, Line: [] });
  const remind = await asDemo(w, 'POST', '/c/remind/900');
  assert.equal(remind.status, 500); assert.match(await remind.text(), /switched off in the demo/);
  const chase = await asDemo(w, 'POST', '/c/chase/901');
  assert.equal(chase.status, 500); assert.match(await chase.text(), /switched off in the demo/);
  assert.deepEqual(qb.sent, [], 'QuickBooks was never asked to email anyone');
});

test('the demo cannot switch on automatic chasing or store anything the next visitor would see', async (t) => {
  const w = world(); network(t);
  await demo(w);
  const set = await (await asDemo(w, 'PUT', '/c/settings', { body: { chase: true } })).json();
  assert.equal(set.chase, false);
  assert.equal((await w.storage.get(`client:${SANDBOX_REALM}`)).chase, 'off');
  assert.equal((await asDemo(w, 'PUT', '/c/accountant', { body: { accountant: 'visitor@example.test' } })).status, 200);
  assert.equal((await w.storage.get(`client:${SANDBOX_REALM}`)).accountant, undefined);
});

test('a real client can still email, chase and set an accountant (the demo rules do not leak into them)', async (t) => {
  const w = world(); const { qb } = network(t);
  const c = await seedClient(w, { env: 'production', extras: 'quotes' });
  const session = await seedSession(w, c.appKey);
  const h = { 'X-App': c.appKey, 'X-Session': session };
  const inv = await (await callBooks(w, 'POST', '/c/invoice', { headers: h, body: { customer: 'Synthetic Customer', email: 'customer@example.test', description: 'Job', amount: 100 } })).json();
  assert.equal(inv.sentTo, 'customer@example.test');
  assert.equal(qb.sent.length, 1);
  assert.equal((await (await callBooks(w, 'PUT', '/c/settings', { headers: h, body: { chase: true } })).json()).chase, true);
  await callBooks(w, 'PUT', '/c/accountant', { headers: h, body: { accountant: 'acct@example.test' } });
  assert.equal((await w.storage.get(`client:${REALM}`)).accountant, 'acct@example.test');
});

// ---------------------------------------------------------------- usage limits

test('demo receipt/AI limit: 15 an hour per visitor, other visitors unaffected, spoofing the forwarded IP does not help', async (t) => {
  const w = world(); network(t);
  await demo(w);
  const parse = (ip, extra = {}) => callBooks(w, 'POST', '/c/parse', { headers: { 'X-App': DEMO_KEY, ...(ip ? { 'CF-Connecting-IP': ip } : {}), ...extra }, body: { text: '40 quid diesel at Shell' } });
  for (let i = 0; i < 15; i++) assert.equal((await parse('203.0.113.5')).status, 200, `call ${i + 1}`);
  const blocked = await parse('203.0.113.5');
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '300');
  assert.match((await blocked.json()).error, /few minutes/);
  assert.equal((await parse('198.51.100.7')).status, 200, 'a different visitor is fine');
  // Direct hit with a real edge IP plus a made-up forwarded one: the edge IP wins, so the spoof changes nothing.
  assert.equal((await parse('203.0.113.5', { 'X-Client-IP': '192.0.2.99' })).status, 429);
  assert.equal(w.ai.calls, 16, 'the blocked calls never reached the AI');
});

test('calls from our own app worker are told apart by the forwarded IP (they carry no edge IP)', async (t) => {
  const w = world(); network(t);
  await demo(w);
  const viaApp = (ip) => callBooks(w, 'POST', '/c/parse', { headers: { 'X-App': DEMO_KEY, 'X-Client-IP': ip }, body: { text: 'x' } });
  for (let i = 0; i < 15; i++) await viaApp('192.0.2.1');
  assert.equal((await viaApp('192.0.2.1')).status, 429);
  assert.equal((await viaApp('192.0.2.2')).status, 200);
});

test('demo overall ceiling: many visitors together cannot exceed 60 AI calls an hour', async (t) => {
  const w = world(); network(t);
  await demo(w);
  let ok = 0, refused = 0;
  for (let visitor = 1; visitor <= 8; visitor++) for (let i = 0; i < 12; i++) {
    const r = await callBooks(w, 'POST', '/c/parse', { headers: { 'X-App': DEMO_KEY, 'CF-Connecting-IP': `10.0.0.${visitor}` }, body: { text: 'x' } });
    r.status === 200 ? ok++ : refused++;
  }
  assert.equal(ok, 60);
  assert.equal(refused, 36);
  assert.equal(w.ai.calls, 60);
});

test('demo writes are capped per visitor (60 an hour)', async (t) => {
  const w = world(); network(t);
  await demo(w);
  const trip = () => asDemo(w, 'POST', '/c/miles', { body: { miles: 5, why: 'test' }, ip: '203.0.113.9' });
  for (let i = 0; i < 60; i++) assert.equal((await trip()).status, 200);
  assert.equal((await trip()).status, 429);
  assert.equal((await asDemo(w, 'GET', '/c/miles', { ip: '203.0.113.9' })).status, 200, 'reading is never limited');
});

test('a real client has a high runaway-loop ceiling on the AI, not the demo limits', async (t) => {
  const w = world(); network(t);
  const c = await seedClient(w, { env: 'production' });
  const session = await seedSession(w, c.appKey);
  const parse = () => callBooks(w, 'POST', '/c/parse', { headers: { 'X-App': c.appKey, 'X-Session': session }, body: { text: 'x' } });
  for (let i = 0; i < 200; i++) assert.equal((await parse()).status, 200);
  assert.equal((await parse()).status, 429);
});

test('"something went wrong" alerts cannot be used to flood the owner with texts', async (t) => {
  const w = world(); const { log } = network(t);
  const c = await seedClient(w, { env: 'production' });
  const session = await seedSession(w, c.appKey);
  for (let i = 0; i < 12; i++) await callBooks(w, 'POST', '/c/problem', { headers: { 'X-App': c.appKey, 'X-Session': session }, body: { what: 'attack-' + i, message: 'x'.repeat(500) } });
  const toOwner = log.sms.filter(s => s.To === '+447700900001');
  assert.ok(toOwner.length <= 1, `owner got ${toOwner.length} texts`); // unknown kinds all count as one kind
  assert.ok(toOwner[0].Body.length < 300);
});
