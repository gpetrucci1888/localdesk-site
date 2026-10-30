// "Today" is the UK date: at 00:30 on a summer morning (23:30 UTC the night before) a receipt belongs to the new day.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, network, seedClient, seedSession, callBooks } from './harness.mjs';

async function fileAt(t, iso) {
  const w = world(); const net = network(t);
  const c = await seedClient(w, { env: 'production', vat: 'no' });
  const session = await seedSession(w, c.appKey);
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(iso) });
  const r = await callBooks(w, 'POST', '/c/file', { headers: { 'X-App': c.appKey, 'X-Session': session }, body: { supplier: 'Synthetic Supplies', total: 12, vat: 0, category: 'Materials' } });
  assert.equal(r.status, 200, await r.clone().text());
  return net.qb.t.Purchase.at(-1).TxnDate;
}

test('a receipt filed at 00:30 British Summer Time is dated that day, not the day before', async (t) => {
  assert.equal(await fileAt(t, '2026-07-15T23:30:00Z'), '2026-07-16');
});
test('in winter the UK date and the UTC date are the same', async (t) => {
  assert.equal(await fileAt(t, '2026-12-15T23:30:00Z'), '2026-12-15');
});
