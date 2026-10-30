// Profit, money in and the tax pot are worked out on the cash basis, unless a client is switched to accrual.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, network, seedClient, seedSession, callBooks, asAdmin, REALM } from './harness.mjs';

const reports = (net) => net.qb.calls.filter(c => /reports\/ProfitAndLoss/.test(JSON.stringify(c)));

test('every profit and loss request asks QuickBooks for the cash basis', async (t) => {
  const w = world(); const net = network(t);
  const c = await seedClient(w, { env: 'production' });
  const session = await seedSession(w, c.appKey);
  for (const path of ['summary', 'quarter', 'trend']) await callBooks(w, 'GET', `/c/${path}`, { headers: { 'X-App': c.appKey, 'X-Session': session } });
  const seen = reports(net);
  assert.ok(seen.length >= 3, `expected report calls, saw ${seen.length}`);
  for (const r of seen) assert.match(JSON.stringify(r), /accounting_method=Cash/);
});

test('a client can be switched to accrual, and only to a valid basis', async (t) => {
  const w = world(); const net = network(t);
  const c = await seedClient(w, { env: 'production' });
  const session = await seedSession(w, c.appKey);
  assert.equal((await asAdmin(w, 'PUT', `/client/${REALM}`, { basis: 'accrual' })).status, 200);
  assert.notEqual((await asAdmin(w, 'PUT', `/client/${REALM}`, { basis: 'whatever' })).status, 200);
  await callBooks(w, 'GET', '/c/summary', { headers: { 'X-App': c.appKey, 'X-Session': session } });
  assert.match(JSON.stringify(reports(net).at(-1)), /accounting_method=Accrual/);
});
