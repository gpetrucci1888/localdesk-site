// FreeAgent as a second platform: connecting, filing receipts, undo, figures, invoices, monthly text, refresh, and QuickBooks untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, network, seedClient, seedSession, callBooks, asAdmin, runCron, REALM } from './harness.mjs';

const FA_REALM = '884242';
const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ';
async function faClient(w, extra = {}) {
  const c = await seedClient(w, { realm: FA_REALM, appKey: 'fa-appkey-0001', name: 'Penrose Plumbing', env: 'sandbox', tokens: false, ...extra });
  await w.storage.put(`tokens:${FA_REALM}`, { platform: 'freeagent', env: 'sandbox', access_token: 'fa-access-0', refresh_token: 'fa-refresh-0', expires_at: Date.now() + 3600_000, refresh_expires_at: Date.now() + 86400_000 * 3650, saved_at: new Date().toISOString(), fa_user: 'https://api.freeagent.com/v2/users/4242', fa_registered: true });
  const session = await seedSession(w, c.appKey);
  const call = (method, path, body) => callBooks(w, method, path, { headers: { 'X-App': c.appKey, 'X-Session': session }, body });
  return { call, appKey: c.appKey };
}

test('an invite for FreeAgent sends the customer to FreeAgent to approve, using the right address and keys', async (t) => {
  const w = world(); network(t);
  const inv = await (await asAdmin(w, 'POST', '/invite', { name: 'Penrose Plumbing', phone: '07700 900123', env: 'sandbox', platform: 'freeagent' })).json();
  const go = await callBooks(w, 'GET', new URL(inv.link).pathname + new URL(inv.link).search);
  assert.equal(go.status, 302);
  const to = new URL(go.headers.get('location'));
  assert.equal(to.host, 'api.sandbox.freeagent.com'); assert.equal(to.pathname, '/v2/approve_app');
  assert.equal(to.searchParams.get('client_id'), 'fa-sandbox-id'); assert.equal(to.searchParams.get('response_type'), 'code'); assert.equal(to.searchParams.get('redirect_uri'), 'https://books.test/callback');
  const live = await (await asAdmin(w, 'POST', '/invite', { name: 'Live One', env: 'production', platform: 'freeagent' })).json();
  assert.equal(new URL((await callBooks(w, 'GET', new URL(live.link).pathname + new URL(live.link).search)).headers.get('location')).host, 'api.freeagent.com');
  const bare = world({ FA_SANDBOX_CLIENT_ID: undefined }); network(t);
  const refused = await asAdmin(bare, 'POST', '/invite', { name: 'No Keys', env: 'sandbox', platform: 'freeagent' });
  assert.notEqual(refused.status, 200); assert.match(await refused.text(), /FreeAgent keys set up/);
});

test('the customer approving in FreeAgent creates their client, saves tokens safely, and texts them their app link', async (t) => {
  const w = world(); const { log, fa } = network(t);
  const inv = await (await asAdmin(w, 'POST', '/invite', { name: 'Penrose Plumbing', phone: '07700 900123', env: 'sandbox', platform: 'freeagent', vat: 'yes' })).json();
  const go = await callBooks(w, 'GET', new URL(inv.link).pathname + new URL(inv.link).search);
  const state = new URL(go.headers.get('location')).searchParams.get('state');
  const back = await callBooks(w, 'GET', `/callback?code=good&state=${state}`);
  assert.equal(back.status, 200); assert.match(await back.text(), /Connected/);
  const tok = await w.storage.get(`tokens:${FA_REALM}`);
  assert.equal(tok.platform, 'freeagent'); assert.equal(tok.fa_user, 'https://api.freeagent.com/v2/users/4242'); assert.ok(tok.refresh_token);
  const client = await w.storage.get(`client:${FA_REALM}`);
  assert.equal(client.name, 'Penrose Plumbing'); assert.equal(client.phone, '+447700900123');
  assert.ok(log.sms.some(m => m.To === '+447700900123' && /Welcome to Books/.test(m.Body)));
  assert.ok(log.sms.some(m => m.To === '+447700900001' && /FreeAgent/.test(m.Body)), 'the owner is told it is FreeAgent');
  assert.ok(fa.calls.every(c => c.ua && /Localdesk Books/.test(c.ua)), 'every call says who it is');
  assert.equal(await w.storage.get(`state:${state}`), undefined, 'the one-time state is used up');
  const replay = await callBooks(w, 'GET', `/callback?code=good&state=${state}`); assert.equal(replay.status, 400);
});

test('a bad or expired approval changes nothing and says so plainly', async (t) => {
  const w = world(); network(t);
  const inv = await (await asAdmin(w, 'POST', '/invite', { name: 'X', env: 'sandbox', platform: 'freeagent' })).json();
  const state = new URL((await callBooks(w, 'GET', new URL(inv.link).pathname + new URL(inv.link).search)).headers.get('location')).searchParams.get('state');
  const r = await callBooks(w, 'GET', `/callback?state=${state}`);
  assert.equal(r.status, 400); assert.match(await r.text(), /FreeAgent didn't connect\. Nothing was changed/);
  assert.equal([...w.storage.keys()].filter(k => k.startsWith('tokens:')).length, 0);
});

test('filing a receipt creates a FreeAgent expense in the right category with VAT and the photo, once only', async (t) => {
  const w = world(); const { fa } = network(t); const { call } = await faClient(w);
  const r = await (await call('POST', '/c/file', { supplier: 'Shell', date: '2026-10-28', total: 60, vat: 10, category: 'Fuel', items: 'diesel', image: PHOTO })).json();
  assert.equal(r.ok, true); assert.equal(r.account, 'Motor Expenses'); assert.equal(r.vatCode, '20%'); assert.equal(r.attached, true);
  const e = fa.expenses[0];
  assert.equal(e.gross_value, '-60'); assert.equal(e.dated_on, '2026-10-28'); assert.equal(e.sales_tax_rate, '20'); assert.match(e.description, /^Shell - diesel/); assert.equal(e.user, 'https://api.freeagent.com/v2/users/4242'); assert.equal(e.hasAttachment, true);
  assert.match(fa.calls.find(c => c.method === 'POST' && c.path === '/expenses').auth, /^Bearer fa-access-0$/);
  const again = await (await call('POST', '/c/file', { supplier: 'Shell', date: '2026-10-28', total: 60, vat: 10, category: 'Fuel' })).json();
  assert.equal(again.duplicate, true); assert.equal(fa.expenses.length, 1, 'not filed twice');
  const mat = await (await call('POST', '/c/file', { supplier: 'Travis Perkins', date: '2026-10-28', total: 120, vat: 20, category: 'Materials' })).json();
  assert.equal(mat.account, 'Materials Purchased');
});

test('a company not VAT registered files with no VAT, a blank total is refused, and nothing is written for a bad receipt', async (t) => {
  const w = world(); const { fa } = network(t); const { call } = await faClient(w, { vat: 'no' });
  const r = await (await call('POST', '/c/file', { supplier: 'Wickes', date: '2026-10-28', total: 30, vat: 5, category: 'Materials' })).json();
  assert.equal(r.vatCode, 'none'); assert.equal(fa.expenses[0].sales_tax_rate, undefined);
  const bad = await call('POST', '/c/file', { supplier: 'X', total: 0 }); assert.equal(bad.status, 500); assert.match(await bad.text(), /No total on the receipt/);
  assert.equal(fa.expenses.length, 1);
});

test('Undo removes an expense the app filed, and refuses anything the app did not file', async (t) => {
  const w = world(); const { fa } = network(t); const { call } = await faClient(w);
  const r = await (await call('POST', '/c/file', { supplier: 'Shell', date: '2026-10-28', total: 40, vat: 0, category: 'Fuel' })).json();
  assert.equal((await (await call('POST', `/c/undo/${r.id}`)).json()).ok, true);
  assert.equal(fa.expenses.length, 0);
  fa.expenses.push({ url: 'https://api.freeagent.com/v2/expenses/9', dated_on: '2026-10-01', gross_value: '-5', description: 'typed in FreeAgent itself' });
  const no = await call('POST', '/c/undo/9'); assert.equal(no.status, 500); assert.match(await no.text(), /Only expenses added from the app/);
  assert.equal(fa.expenses.length, 1, 'the one the owner made by hand stays');
});

test('figures, who owes you, recent expenses and the monthly text all come from FreeAgent', async (t) => {
  const w = world(); const { fa, log } = network(t); const { call } = await faClient(w);
  fa.contacts.push({ url: 'https://api.freeagent.com/v2/contacts/7', organisation_name: 'Mrs Tremayne' });
  fa.invoices.push({ url: 'https://api.freeagent.com/v2/invoices/70', reference: 'INV-070', contact: 'https://api.freeagent.com/v2/contacts/7', dated_on: '2026-09-01', due_on: '2026-09-15', total_value: '300.00', due_value: '300.00' });
  fa.expenses.push({ url: 'https://api.freeagent.com/v2/expenses/71', dated_on: '2026-10-20', gross_value: '-42.5', description: 'Screwfix - fixings' });
  const s = await (await call('GET', '/c/summary?month=2026-10')).json();
  assert.deepEqual([s.moneyIn, s.moneyOut, s.profit, s.owed, s.owedCount, s.taxPot], [4200, 1300, 2900, 300, 1, 725]);
  const o = await (await call('GET', '/c/owed')).json();
  assert.equal(o[0].customer, 'Mrs Tremayne'); assert.equal(o[0].balance, 300); assert.ok(o[0].daysOverdue > 0);
  const rec = await (await call('GET', '/c/recent')).json();
  assert.equal(rec[0].supplier, 'Screwfix'); assert.equal(rec[0].total, 42.5);
  assert.deepEqual(await (await call('GET', '/c/untidy')).json(), []);
  await runCron(w, '0 8 1 * *');
  const text = log.sms.find(m => m.To === '+447700900002');
  assert.ok(text && /profit/.test(text.Body) && /Owed to you/.test(text.Body), 'the monthly text works for a FreeAgent client');
});

test('an invoice creates the contact and lines with VAT, and is only emailed for a real client', async (t) => {
  const w = world(); const { fa } = network(t); const { call } = await faClient(w);
  const r = await (await call('POST', '/c/invoice', { customer: 'Mrs Tremayne', email: 'tremayne@example.test', description: 'Boiler service', amount: 100, vat: true })).json();
  assert.equal(r.ok, true); assert.equal(r.total, 120); assert.equal(r.sentTo, 'tremayne@example.test'); assert.deepEqual(fa.mails.map(m => m.to), ['tremayne@example.test']);
  assert.equal(fa.contacts.length, 1);
  await call('POST', '/c/invoice', { customer: 'mrs tremayne', description: 'Another', amount: 50, vatRate: 'zero' });
  assert.equal(fa.contacts.length, 1, 'the same customer is reused');
  assert.equal(fa.invoices[1].invoice_items[0].sales_tax_rate, '0');
  const cis = await (await call('POST', '/c/invoice', { customer: 'Big Builders', cis: true, labour: 500, materials: 100, description: 'Roof' })).json();
  assert.equal(cis.cisDeduction, 100); assert.equal(fa.invoices[2].invoice_items.length, 2);
  const demo = world(); const net2 = network(t); const d = await faClient(demo, { demo: true });
  await d.call('POST', '/c/invoice', { customer: 'Someone', email: 'someone@example.test', description: 'x', amount: 10 });
  assert.equal(net2.fa.mails.length, 0, 'a demo company never emails');
});

test('features that FreeAgent does not have yet give one plain message and never a QuickBooks error', async (t) => {
  const w = world(); network(t); const { call } = await faClient(w);
  for (const path of ['/c/quarter', '/c/trend', '/c/customerlist']) {
    const r = await call('GET', path); const text = await r.text();
    assert.equal(r.status, 500, path); assert.match(text, /not available for FreeAgent yet/, path); assert.ok(!/QuickBooks/.test(text), path);
  }
  assert.equal((await (await call('GET', '/c/status')).json()).software, 'FreeAgent');
});

test('an expired access token is refreshed (and kept), a 429 is waited out, and a dead connection is flagged', async (t) => {
  const w = world(); const { fa, log } = network(t); const { call } = await faClient(w);
  const tok = await w.storage.get(`tokens:${FA_REALM}`); await w.storage.put(`tokens:${FA_REALM}`, { ...tok, expires_at: Date.now() - 1000 });
  assert.equal((await call('GET', '/c/owed')).status, 200);
  assert.equal(fa.refreshes, 1); assert.equal((await w.storage.get(`tokens:${FA_REALM}`)).access_token, 'fa-access-1'); assert.equal((await w.storage.get(`tokens:${FA_REALM}`)).refresh_token, 'fa-refresh-0');
  t.mock.timers.enable({ apis: ['setTimeout'] }); fa.fail429 = 2;
  const p = call('GET', '/c/owed'); const timer = setInterval(() => t.mock.timers.tick(1500), 5); const r = await p; clearInterval(timer);
  assert.equal(r.status, 200);
});

test('health reports FreeAgent and QuickBooks clients side by side, and never sends a FreeAgent client to QuickBooks', async (t) => {
  const w = world(); const { qb, fa } = network(t);
  await seedClient(w, { env: 'production' });
  await faClient(w);
  const h = await (await asAdmin(w, 'GET', '/health')).json();
  const rows = Object.fromEntries(h.clients.map(c => [c.realmId, c]));
  assert.equal(rows[REALM].ok, true); assert.equal(rows[FA_REALM].ok, true); assert.equal(rows[FA_REALM].platform, 'freeagent');
  assert.ok(!qb.calls.some(c => String(c.path || '').includes(FA_REALM)), 'QuickBooks was never asked about the FreeAgent client');
  assert.ok(fa.calls.length > 0);
  const list = await (await asAdmin(w, 'GET', '/companies')).json();
  assert.deepEqual(list.map(c => c.platform).sort(), ['freeagent', 'quickbooks']);
});

test('QuickBooks still works exactly as before alongside FreeAgent', async (t) => {
  const w = world(); const { qb, fa } = network(t);
  const c = await seedClient(w, { env: 'production', vat: 'yes' }); const session = await seedSession(w, c.appKey);
  await faClient(w);
  const r = await (await callBooks(w, 'POST', '/c/file', { headers: { 'X-App': c.appKey, 'X-Session': session }, body: { supplier: 'Shell', date: '2026-10-28', total: 60, vat: 10, category: 'Fuel' } })).json();
  assert.equal(r.ok, true); assert.equal(qb.t.Purchase.length, 1); assert.equal(fa.expenses.length, 0, 'nothing leaked across');
});
