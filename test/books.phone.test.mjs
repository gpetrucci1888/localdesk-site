// Phone numbers: any normal UK way of writing a mobile is saved as +44…, and a wrong number is refused when saved.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, network, seedClient, asAdmin, REALM } from './harness.mjs';

const GOOD = ['07700 900123', '07700900123', '+44 7700 900123', '+447700900123', '0044 7700 900123', '(07700) 900-123', '7700 900123', '+44 (0)7700 900123'];
const BAD = ['0191 498 0000', '12345', '+1 202 555 0143', 'call me', '077009001', '0770090012345', '+44 7700 90012'];

test('every normal way of writing a UK mobile is saved in one international form', async (t) => {
  const w = world(); network(t);
  await seedClient(w, { env: 'production' });
  for (const n of GOOD) {
    const r = await asAdmin(w, 'PUT', `/client/${REALM}`, { phone: n });
    assert.equal(r.status, 200, n);
    assert.equal((await w.storage.get(`client:${REALM}`)).phone, '+447700900123', n);
  }
});

test('a number that is not a UK mobile is refused with a plain message and nothing is saved', async (t) => {
  const w = world(); network(t);
  await seedClient(w, { env: 'production' });
  await asAdmin(w, 'PUT', `/client/${REALM}`, { phone: '07700 900123' });
  for (const n of BAD) {
    const r = await asAdmin(w, 'PUT', `/client/${REALM}`, { phone: n });
    assert.notEqual(r.status, 200, n);
    assert.match(await r.text(), /isn't a UK mobile|doesn't look like a phone/, n);
    assert.equal((await w.storage.get(`client:${REALM}`)).phone, '+447700900123', `${n} must not overwrite the saved number`);
  }
});

test('an invite normalises the number, and a bad one is refused before any link exists', async (t) => {
  const w = world(); network(t);
  const ok = await asAdmin(w, 'POST', '/invite', { name: 'Synthetic Plumbing', phone: '07700 900123', env: 'sandbox' });
  assert.equal(ok.status, 200);
  const inv = [...(await w.storage.list({ prefix: 'invite:' })).values()];
  assert.equal(inv.length, 1);
  assert.equal(inv[0].phone, '+447700900123');
  const bad = await asAdmin(w, 'POST', '/invite', { name: 'X', phone: '0191 498 0000', env: 'sandbox' });
  assert.notEqual(bad.status, 200);
  assert.equal((await w.storage.list({ prefix: 'invite:' })).size, 1, 'no second invite was made');
});

test('a number saved in the old format still gets its login code, sent in international form', async (t) => {
  const w = world(); const { log } = network(t);
  const c = await seedClient(w, { env: 'production', phone: '07700 900123' });
  const { callBooks } = await import('./harness.mjs');
  const r = await callBooks(w, 'POST', '/c/login/send', { headers: { 'X-App': c.appKey } });
  assert.equal(r.status, 200);
  assert.equal(log.sms.at(-1).To, '+447700900123');
});
