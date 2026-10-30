// Long lists: "all of them" queries keep asking QuickBooks for the next page; deliberate "latest few" limits stay short.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, network, seedClient, seedSession, callBooks } from './harness.mjs';

const owedCount = async (w, c, session) => (await (await callBooks(w, 'GET', '/c/owed', { headers: { 'X-App': c.appKey, 'X-Session': session } })).json()).length;
async function withInvoices(t, n) {
  const w = world(); const net = network(t);
  const c = await seedClient(w, { env: 'production' });
  const session = await seedSession(w, c.appKey);
  for (let i = 0; i < n; i++) net.qb.add('Invoice', { Id: 'I' + i, DocNumber: String(i), TxnDate: '2026-10-01', Balance: 10, TotalAmt: 10, CustomerRef: { value: '1', name: 'X' } });
  return { w, net, c, session };
}

test('2,300 unpaid invoices are all listed (three pages), not the first 1,000 or 200', async (t) => {
  const { w, net, c, session } = await withInvoices(t, 2300);
  assert.equal(await owedCount(w, c, session), 2300);
  assert.equal(net.qb.queries, 3);
});

test('exactly one full page costs one extra look and no more', async (t) => {
  const { w, net, c, session } = await withInvoices(t, 1000);
  assert.equal(await owedCount(w, c, session), 1000);
  assert.equal(net.qb.queries, 2);
});

test('a small list is a single request', async (t) => {
  const { w, net, c, session } = await withInvoices(t, 12);
  assert.equal(await owedCount(w, c, session), 12);
  assert.equal(net.qb.queries, 1);
});
