// First login: the client accepts the terms once, and the date is kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, network, seedClient, seedSession, callBooks, callApp, SANDBOX_REALM, REALM } from './harness.mjs';

test('a new client has not agreed; agreeing is recorded once with a date; the app reports it', async (t) => {
  const w = world(); network(t);
  const c = await seedClient(w, { env: 'production' });
  const session = await seedSession(w, c.appKey);
  const h = { 'X-App': c.appKey, 'X-Session': session };
  assert.equal((await (await callBooks(w, 'GET', '/c/app', { headers: h })).json()).agreed, false);
  assert.equal((await callBooks(w, 'POST', '/c/agree', { headers: h })).status, 200);
  const first = (await w.storage.get(`client:${REALM}`)).agreed;
  assert.match(first.at, /^20\d\d-/); assert.ok(first.version);
  await callBooks(w, 'POST', '/c/agree', { headers: h });
  assert.equal((await w.storage.get(`client:${REALM}`)).agreed.at, first.at, 'the first date stands');
  assert.equal((await (await callBooks(w, 'GET', '/c/app', { headers: h })).json()).agreed, true);
});

test('agreeing needs a login, and the demo never records anything', async (t) => {
  const w = world(); network(t);
  const c = await seedClient(w, { env: 'production' });
  assert.equal((await callBooks(w, 'POST', '/c/agree', { headers: { 'X-App': c.appKey } })).status, 401);
  assert.equal((await w.storage.get(`client:${REALM}`)).agreed, undefined);
  const d = await seedClient(w, { realm: SANDBOX_REALM, appKey: 'demo-appkey-0001', env: 'sandbox', demo: true });
  assert.equal((await (await callBooks(w, 'GET', '/c/app', { headers: { 'X-App': d.appKey } })).json()).agreed, true);
  await callBooks(w, 'POST', '/c/agree', { headers: { 'X-App': d.appKey } });
  assert.equal((await w.storage.get(`client:${SANDBOX_REALM}`)).agreed, undefined);
});

test('the app shows the terms sheet to a client who has not agreed, and not to one who has or to the demo', async (t) => {
  const w = world(); network(t);
  const c = await seedClient(w, { env: 'production' });
  const session = await seedSession(w, c.appKey);
  const page = async () => (await (await callApp(w, 'GET', `/${c.appKey}/`, { headers: { Cookie: `bk=${session}` } })).text());
  assert.match(await page(), /var AGREED='0'==='1'|var AGREED='0'/);
  await callBooks(w, 'POST', '/c/agree', { headers: { 'X-App': c.appKey, 'X-Session': session } });
  assert.match(await page(), /var AGREED='1'/);
});
