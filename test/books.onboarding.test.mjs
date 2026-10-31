// Books onboarding: the owner can see, from the connected app itself, which software, whether it works and whether a first receipt landed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, network, asAdmin, seedClient, REALM } from './harness.mjs';

const stamp = () => String(Date.now() - 30 * 86400000); // log ids are timestamps
const healthRow = async (w) => (await (await asAdmin(w, 'GET', '/health')).json()).clients.find(c => c.realmId === REALM);

test('health rows carry the software, the last 10 digits of the mobile (to match the lead), and whether a receipt was ever filed', async (t) => {
  const w = world(); network(t); await seedClient(w, { name: 'Onboarding Plumbing', phone: '+447700900123' });
  let row = await healthRow(w);
  assert.equal(row.platform, 'quickbooks'); assert.equal(row.phoneKey, '7700900123'); assert.ok(!JSON.stringify(row).includes('+447700900123'), 'the full number is not in the health report');
  assert.equal(row.everFiled, false);
  const id = stamp(); await w.store.fetch(`https://store/log/${REALM}/${id}`, { method: 'PUT', body: JSON.stringify({ id, at: Date.now() - 30 * 86400000, kind: 'file' }) });
  row = await healthRow(w); assert.equal(row.everFiled, true, 'a receipt filed more than a week ago still counts as the first one');
  await w.store.fetch(`https://store/log/${REALM}/${id}`, { method: 'PUT', body: JSON.stringify({ id, at: Date.now() - 30 * 86400000, kind: 'file', undone: Date.now() }) });
  assert.equal((await healthRow(w)).everFiled, false, 'an undone filing does not count');
});
