// Backup and restore: everything that can't be recreated is saved; connection tokens never are; a restore never clobbers by accident.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, network, seedClient, seedSession, callBooks, asAdmin, runCron, REALM } from './harness.mjs';

const fakeR2 = () => { const m = new Map(); return { m,
  put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); },
  list: async ({ prefix = '' } = {}) => ({ objects: [...m.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key })) }) }; };

async function populated(t, extra) {
  const w = world(extra); network(t);
  const c = await seedClient(w, { env: 'production' });
  const session = await seedSession(w, c.appKey);
  await callBooks(w, 'POST', '/c/miles', { headers: { 'X-App': c.appKey, 'X-Session': session }, body: { miles: 12, why: 'Job' } });
  return { w, c, session };
}

test('a backup holds clients, mileage and the change log, and no tokens, sessions or codes', async (t) => {
  const { w } = await populated(t);
  const res = await asAdmin(w, 'GET', '/backup');
  assert.equal(res.status, 200);
  const b = await res.json();
  const keys = Object.keys(b.entries);
  assert.ok(keys.some(k => k.startsWith('client:')) && keys.some(k => k.startsWith('appkey:')) && keys.some(k => k.startsWith('trips:')));
  assert.ok(!keys.some(k => /^(tokens|session|code|state|rl|alert):/.test(k)), 'nothing secret or temporary: ' + keys.join(','));
  assert.equal(b.count, keys.length);
  assert.equal((await callBooks(w, 'GET', '/backup')).status, 403, 'the key is needed');
});

test('restore puts everything back after a wipe; tokens are not restored, so clients reconnect', async (t) => {
  const { w, c } = await populated(t);
  const backup = await (await asAdmin(w, 'GET', '/backup')).json();
  const tripKey = Object.keys(backup.entries).find(k => k.startsWith('trips:'));
  const tripsBefore = JSON.stringify(await w.storage.get(tripKey));
  for (const k of w.storage.keys()) await w.storage.delete(k);
  assert.equal(w.storage.keys().length, 0);
  const r = await asAdmin(w, 'POST', '/restore', backup);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).written, backup.count);
  assert.equal((await w.storage.get(`client:${REALM}`)).appKey, c.appKey);
  assert.equal(JSON.stringify(await w.storage.get(tripKey)), tripsBefore, 'mileage is back exactly as it was');
  assert.ok(tripsBefore.includes('Job'));
  assert.equal(await w.storage.get(`tokens:${REALM}`), undefined, 'no tokens came back');
});

test('a restore does not overwrite existing records unless asked, and refuses a file that is not a backup', async (t) => {
  const { w } = await populated(t);
  const backup = await (await asAdmin(w, 'GET', '/backup')).json();
  await asAdmin(w, 'PUT', `/client/${REALM}`, { name: 'Changed Since' });
  const r = await (await asAdmin(w, 'POST', '/restore', backup)).json();
  assert.equal(r.written, 0);
  assert.equal((await w.storage.get(`client:${REALM}`)).name, 'Changed Since');
  assert.equal((await (await asAdmin(w, 'POST', '/restore?overwrite=1', backup)).json()).written > 0, true);
  assert.notEqual((await w.storage.get(`client:${REALM}`)).name, 'Changed Since');
  assert.equal((await asAdmin(w, 'POST', '/restore', { hello: 'world' })).status, 400);
  const sneaky = await (await asAdmin(w, 'POST', '/restore?overwrite=1', { version: 1, entries: { 'tokens:1': { access_token: 'x' }, 'session:abc': {} } })).json();
  assert.equal(sneaky.written, 0, 'a restore file cannot plant tokens or sessions');
});

test('the daily job writes a backup to the bucket when there is one, keeps 30, and does nothing without one', async (t) => {
  const r2 = fakeR2();
  const { w } = await populated(t, { BACKUPS: r2 });
  for (let d = 1; d <= 35; d++) r2.m.set(`books/2026-08-${String(d).padStart(2, '0')}.json`, '{}');
  await runCron(w, '0 7 * * *');
  const keys = [...r2.m.keys()].sort();
  assert.equal(keys.length, 30);
  const today = keys.at(-1); const saved = JSON.parse(r2.m.get(today));
  assert.ok(saved.count > 0 && saved.entries[`client:${REALM}`]);
  const none = world(); network(t); await seedClient(none, { env: 'production' });
  await runCron(none, '0 7 * * *'); // no bucket bound: must not throw
});
