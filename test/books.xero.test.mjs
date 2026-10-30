// Xero as a third platform: connecting, receipts, undo, figures, invoices, the monthly check, tidy, refresh, disconnect, and the others untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, network, seedClient, seedSession, callBooks, asAdmin, REALM } from './harness.mjs';
import { xeroRealm } from '../workers/books/xero.js';

const TENANT = '8a7f3c10-1111-4222-8333-444455556666';
const XE_REALM = xeroRealm(TENANT);
const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ';
async function xeroClient(w, extra = {}, tok = {}) {
  const c = await seedClient(w, { realm: XE_REALM, appKey: 'xe-appkey-0001', name: 'Penrose Plumbing', env: 'sandbox', tokens: false, ...extra });
  await w.storage.put(`tokens:${XE_REALM}`, { platform: 'xero', env: 'sandbox', access_token: 'xe-access-0', refresh_token: 'xe-refresh-0', expires_at: Date.now() + 1800_000, refresh_expires_at: Date.now() + 86400_000 * 60, saved_at: new Date().toISOString(), xero_tenant: TENANT, xero_connection: 'conn-1', xero_registered: true, ...tok });
  const session = await seedSession(w, c.appKey);
  const call = (method, path, body) => callBooks(w, method, path, { headers: { 'X-App': c.appKey, 'X-Session': session }, body });
  return { call, appKey: c.appKey };
}

test('a Xero invite sends the customer to Xero to approve, and refuses to exist without keys', async (t) => {
  const w = world(); network(t);
  const inv = await (await asAdmin(w, 'POST', '/invite', { name: 'Penrose Plumbing', phone: '07700 900123', env: 'sandbox', platform: 'xero' })).json();
  const go = await callBooks(w, 'GET', new URL(inv.link).pathname + new URL(inv.link).search);
  assert.equal(go.status, 302);
  const to = new URL(go.headers.get('location'));
  assert.equal(to.host, 'login.xero.com'); assert.equal(to.searchParams.get('client_id'), 'xero-id'); assert.equal(to.searchParams.get('redirect_uri'), 'https://books.test/callback');
  assert.match(to.searchParams.get('scope'), /offline_access/);
  const bare = world({ XERO_CLIENT_ID: undefined }); network(t);
  const refused = await asAdmin(bare, 'POST', '/invite', { name: 'No Keys', platform: 'xero' });
  assert.notEqual(refused.status, 200); assert.match(await refused.text(), /Xero keys set up/);
});

test('approving in Xero creates the client, saves tokens, and says Xero', async (t) => {
  const w = world(); const { log, xe } = network(t);
  const inv = await (await asAdmin(w, 'POST', '/invite', { name: 'Penrose Plumbing', phone: '07700 900123', env: 'sandbox', platform: 'xero' })).json();
  const state = new URL((await callBooks(w, 'GET', new URL(inv.link).pathname + new URL(inv.link).search)).headers.get('location')).searchParams.get('state');
  const back = await callBooks(w, 'GET', `/callback?code=good&state=${state}`);
  assert.equal(back.status, 200); assert.match(await back.text(), /Connected/);
  const tok = await w.storage.get(`tokens:${XE_REALM}`);
  assert.equal(tok.platform, 'xero'); assert.equal(tok.xero_tenant, TENANT); assert.ok(tok.refresh_token); assert.equal(tok.xero_demo, true);
  assert.equal((await w.storage.get(`client:${XE_REALM}`)).name, 'Penrose Plumbing');
  assert.ok(log.sms.some(m => m.To === '+447700900001' && /Xero/.test(m.Body)));
  assert.ok(xe.calls.filter(c => c.tenant).every(c => c.tenant === TENANT && /Localdesk Books/.test(c.ua)));
  assert.equal((await callBooks(w, 'GET', `/callback?code=good&state=${state}`)).status, 400, 'one-time state');
});

test('a bad approval changes nothing and says so', async (t) => {
  const w = world(); network(t);
  const inv = await (await asAdmin(w, 'POST', '/invite', { name: 'X', platform: 'xero', env: 'sandbox' })).json();
  const state = new URL((await callBooks(w, 'GET', new URL(inv.link).pathname + new URL(inv.link).search)).headers.get('location')).searchParams.get('state');
  const r = await callBooks(w, 'GET', `/callback?state=${state}`);
  assert.equal(r.status, 400); assert.match(await r.text(), /Xero didn't connect\. Nothing was changed/);
  assert.equal([...w.storage.keys()].filter(k => k.startsWith('tokens:')).length, 0);
});

test('filing a receipt makes a Xero spend-money entry in the right account with VAT and the photo, once only', async (t) => {
  const w = world(); const { xe } = network(t); const { call } = await xeroClient(w);
  const r = await (await call('POST', '/c/file', { supplier: 'Shell', date: '2026-10-28', total: 60, vat: 10, category: 'Fuel', items: 'diesel', image: PHOTO })).json();
  assert.equal(r.ok, true); assert.equal(r.account, 'Motor Vehicle Expenses'); assert.equal(r.vatCode, '20%'); assert.equal(r.attached, true);
  const b = xe.tx[0]; assert.equal(b.Type, 'SPEND'); assert.equal(b.LineItems[0].TaxType, 'INPUT2'); assert.equal(b.LineItems[0].UnitAmount, 60); assert.equal(b.BankAccount.AccountID, 'acc-bank');
  assert.equal(b.HasAttachments, true); assert.equal(xe.attachments[b.BankTransactionID].type, 'image/jpeg');
  const again = await (await call('POST', '/c/file', { supplier: 'Shell', date: '2026-10-28', total: 60, vat: 10, category: 'Fuel' })).json();
  assert.equal(again.duplicate, true); assert.equal(xe.tx.length, 1);
  const mat = await (await call('POST', '/c/file', { supplier: 'Travis Perkins', date: '2026-10-28', total: 120, vat: 20, category: 'Materials' })).json();
  assert.equal(mat.account, 'Purchases');
});

test('a client who is not VAT registered gets no VAT on a receipt', async (t) => {
  const w = world(); const { xe } = network(t); const { call } = await xeroClient(w, {}, { xero_registered: false });
  const r = await (await call('POST', '/c/file', { supplier: 'Screwfix', date: '2026-10-28', total: 30, vat: 0, category: 'Materials' })).json();
  assert.equal(r.vatCode, 'none'); assert.equal(xe.tx[0].LineItems[0].TaxType, 'NONE');
});

test('undo removes only what the app filed', async (t) => {
  const w = world(); const { xe } = network(t); const { call } = await xeroClient(w);
  const r = await (await call('POST', '/c/file', { supplier: 'Shell', date: '2026-10-28', total: 60, vat: 10, category: 'Fuel' })).json();
  xe.tx.push({ BankTransactionID: 'bt-other', Status: 'AUTHORISED', Contact: { Name: 'Other' }, Total: 5, Date: '2026-10-01', DateString: '2026-10-01T00:00:00', LineItems: [] });
  assert.equal((await (await call('POST', `/c/undo/${r.id}`)).json()).ok, true);
  assert.equal(xe.tx.find(b => b.BankTransactionID === r.id).Status, 'DELETED');
  assert.notEqual((await call('POST', '/c/undo/bt-other')).status, 200);
});

test('an invoice for a customer shows under who owes you, reusing the customer', async (t) => {
  const w = world(); const { xe } = network(t); const { call } = await xeroClient(w);
  const a = await (await call('POST', '/c/invoice', { customer: 'Mr Jago', description: 'Tap', amount: 40, vat: true })).json();
  await call('POST', '/c/invoice', { customer: 'Mr Jago', description: 'Valve', amount: 20 });
  assert.equal(a.total, 48); assert.equal(xe.contacts.length, 1);
  const owed = await (await call('GET', '/c/owed')).json();
  assert.equal(owed.length, 2); assert.equal(owed[0].customer, 'Mr Jago');
  const mailed = await (await call('POST', '/c/invoice', { customer: 'Mrs Day', email: 'day@example.com', description: 'Boiler', amount: 90 })).json();
  assert.equal(mailed.sentTo, 'day@example.com'); assert.equal(xe.mails.length, 1);
});

test('figures read Xero profit and loss and the monthly text says Xero-based numbers', async (t) => {
  const w = world(); network(t); const { call } = await xeroClient(w);
  const s = await (await call('GET', '/c/summary?month=2026-09')).json();
  assert.equal(s.moneyIn, 4200); assert.equal(s.moneyOut, 1300); assert.equal(s.profit, 2900);
  const m = await (await asAdmin(w, 'GET', `/monthly/${XE_REALM}`)).json();
  assert.match(m.text, /in £4,200, out £1,300, profit £2,900/);
});

test('the monthly check finds spending with no receipt and spending in Suspense, and tidy moves it', async (t) => {
  const w = world(); const { xe } = network(t); const { call } = await xeroClient(w);
  const day = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
  const mk = (id, name, code, attached) => xe.tx.push({ BankTransactionID: id, Type: 'SPEND', Status: 'AUTHORISED', Contact: { Name: name }, Total: 25, Date: day, DateString: `${day}T00:00:00`, HasAttachments: attached, LineItems: [{ Description: name, Quantity: 1, UnitAmount: 25, AccountCode: code }] });
  mk('bt-a', 'Bank feed Screwfix', '999', false); mk('bt-b', 'Has receipt', '449', true);
  const none = await (await call('GET', '/c/noreceipt')).json();
  assert.deepEqual(none.map(i => i.id), ['bt-a']);
  const tidyList = await (await call('GET', '/c/untidy')).json();
  assert.deepEqual(tidyList.map(i => i.id), ['bt-a']);
  assert.equal((await (await call('POST', '/c/tidy/bt-a', { category: 'Materials' })).json()).ok, true);
  assert.equal(xe.tx.find(b => b.BankTransactionID === 'bt-a').LineItems[0].AccountCode, '300');
  assert.equal((await (await call('GET', '/c/untidy')).json()).length, 0);
});

test('Xero refresh tokens are single use: parallel calls share one refresh and the new token is saved', async (t) => {
  const w = world(); const { xe } = network(t); const { call } = await xeroClient(w, {}, { expires_at: Date.now() - 1000 });
  await Promise.all([call('GET', '/c/owed'), call('GET', '/c/owed'), call('GET', '/c/recent')]);
  assert.equal(xe.refreshes, 1);
  assert.equal((await w.storage.get(`tokens:${XE_REALM}`)).refresh_token, 'xe-refresh-1');
  xe.fail429 = 2; assert.equal((await call('GET', '/c/owed')).status, 200, 'asking too often is retried');
});

test('a dropped Xero connection is reported plainly, not as a raw error', async (t) => {
  const w = world(); const { xe } = network(t); const { call } = await xeroClient(w, {}, { expires_at: Date.now() - 1000 });
  const orig = xe.handle.bind(xe); xe.handle = (u, i) => (/identity\.xero\.com/.test(u) ? Response.json({ error: 'invalid_grant' }, { status: 400 }) : orig(u, i));
  const r = await call('GET', '/c/owed'); assert.notEqual(r.status, 200);
  assert.match(await r.text(), /Xero wouldn't accept that/); 
});

test('health shows Xero, FreeAgent and QuickBooks side by side; unsupported features say so by name', async (t) => {
  const w = world(); network(t); const { call } = await xeroClient(w); await seedClient(w, { realm: REALM, appKey: 'qb-appkey-0001' });
  const h = await (await asAdmin(w, 'GET', '/health')).json();
  const x = h.clients.find(c => c.realmId === XE_REALM); assert.equal(x.ok, true); assert.equal(x.platform, 'xero');
  assert.ok(h.clients.find(c => c.realmId === REALM));
  const q = await call('GET', '/c/quarter'); assert.match(await q.text(), /not available for Xero yet/);
});

test('disconnecting removes our connection in Xero and keeps QuickBooks and FreeAgent untouched', async (t) => {
  const w = world(); const { xe, log } = network(t); await xeroClient(w);
  const r = await asAdmin(w, 'POST', `/revoke/${XE_REALM}`);
  assert.equal(r.status, 200); assert.equal(xe.disconnected, 'conn-1'); assert.equal(log.revokes, 0);
  assert.equal(await w.storage.get(`tokens:${XE_REALM}`), undefined);
});

test('the admin connection test files, finds, undoes and cleans up its own Xero entries', async (t) => {
  const w = world(); const { xe } = network(t); await xeroClient(w);
  const r = await (await asAdmin(w, 'POST', `/selftest/${XE_REALM}`)).json();
  assert.equal(r.ok, true, JSON.stringify(r.steps.filter(s => !s.ok)));
  assert.ok(xe.tx.every(b => b.Status === 'DELETED')); assert.ok(xe.invoices.every(i => i.Status === 'VOIDED')); assert.ok(xe.contacts.every(c => c.ContactStatus === 'ARCHIVED'));
  const read = await (await asAdmin(w, 'GET', `/precheck/${XE_REALM}`)).json(); assert.ok(read.categories && Array.isArray(read.problems));
});

test('two separate Worker instances refreshing at the same moment cause only one Xero refresh (single-use refresh token)', async (t) => {
  const { Store } = await import('../workers/books/worker.js');
  const { createXero } = await import('../workers/books/xero.js');
  const w = world(); const { xe } = network(t);
  let queue = Promise.resolve();   // a Durable Object handles one request at a time on its storage, so the test store does too
  const store = { fetch: (u, init) => { const r = queue.then(() => new Store({ storage: w.storage }).fetch(new Request(u, init))); queue = r.catch(() => {}); return r; } };
  await w.storage.put(`tokens:${XE_REALM}`, { platform: 'xero', env: 'sandbox', access_token: 'old', refresh_token: 'xe-refresh-0', expires_at: Date.now() - 1000, xero_tenant: TENANT });
  const D = { ACCOUNT_NAMES: {}, getClient: async () => null, logChange: async () => {}, markUndone: async () => {}, alertOwner: async () => {}, clientName: async () => 'x', ukToday: () => '2026-10-30', money: String };
  const env = { XERO_CLIENT_ID: 'id', XERO_CLIENT_SECRET: 's' };
  const a = createXero(D), b = createXero(D);   // each has its own in-memory state, like two isolates
  const [ta, tb] = await Promise.all([a.token(env, store, XE_REALM), b.token(env, store, XE_REALM)]);
  assert.equal(xe.refreshes, 1, 'exactly one refresh happened');
  assert.equal(ta.access_token, tb.access_token); assert.equal((await w.storage.get(`tokens:${XE_REALM}`)).refresh_token, 'xe-refresh-1');
  assert.equal(await w.storage.get(`reflock:${XE_REALM}`), undefined, 'the lease is released');
});
