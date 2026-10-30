// Ending a client: access is cut at once, the rest is held for 30 days, then purged. Plus disconnect handling and housekeeping.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { world, network, seedClient, seedSession, callBooks, asAdmin, runCron, sha256, ADMIN, REALM } from './harness.mjs';

const OTHER = '3333333333333333';
const DAY = 86400000;

// Everything Books keeps about one client, so we can check it all goes (and nothing else does).
async function footprint(w, realm, appKey) {
  const s = w.storage;
  await s.put(`session:${await sha256('s1-' + realm)}`, { appKey, created: Date.now() });
  await s.put(`session:${await sha256('s2-' + realm)}`, { appKey, created: Date.now() });
  await s.put(`code:${appKey}`, { sent: [Date.now()] });
  await s.put(`push:${realm}:${await sha256('device-' + realm)}`, { endpoint: 'https://push.test/' + realm, keys: { p256dh: 'x', auth: 'y' } });
  await s.put(`doc:DOC${realm}0000000000`, { realmId: realm, type: 'invoice', id: '1', created: Date.now() });
  await s.put(`pack:PACK${realm}000000000`, { realmId: realm, from: '2026-07-06', to: '2026-10-05', created: Date.now() });
  await s.put(`trips:${realm}:a1`, { id: 'a1', date: '2026-10-01', miles: 12, why: 'Job' });
  await s.put(`trips:${realm}:a2`, { id: 'a2', date: '2026-10-02', miles: 8, why: 'Supplier' });
  await s.put(`log:${realm}:b1`, { id: 'b1', at: Date.now(), kind: 'file', text: 'Filed Shell £40.00' });
  await s.put(`chased:${realm}:inv-1`, [Date.now()]);
  await s.put(`seen:${realm}`, Date.now());
  await s.put(`paycheck:${realm}`, new Date().toISOString());
  await s.put(`alert:conn:${realm}`, Date.now());
  await s.put(`alert:err:${realm}:/summary`, Date.now());
}
const keysWith = (w, ...needles) => w.storage.keys().filter(k => needles.some(n => k.includes(n)));
const sessionsOf = async (w, appKey) => [...(await w.storage.list({ prefix: 'session:' })).values()].filter(v => v.appKey === appKey).length;

async function twoClients(w) {
  const a = await seedClient(w, { realm: REALM, name: 'Leaving Plumbing', phone: '+447700900002' });
  const b = await seedClient(w, { realm: OTHER, name: 'Staying Electrical', phone: '+447700900004', appKey: 'appkey-other-0001' });
  await footprint(w, REALM, a.appKey); await footprint(w, OTHER, b.appKey);
  return { a, b };
}

test('ending a client cuts access at once and holds the rest', async (t) => {
  const w = world(); const { log } = network(t);
  const { a, b } = await twoClients(w);
  const otherBefore = keysWith(w, OTHER, b.appKey).sort();
  const res = await asAdmin(w, 'POST', `/revoke/${REALM}`);
  const out = await res.json();
  assert.equal(res.status, 200);
  assert.deepEqual({ tokens: out.tokens, sessions: out.sessions, notifications: out.notifications, links: out.links, purgeAfterDays: out.purgeAfterDays }, { tokens: 1, sessions: 2, notifications: 1, links: 2, purgeAfterDays: 30 });
  assert.equal(log.revokes, 1, 'told Intuit to drop the connection');
  assert.ok(log.sms.some(s => s.To === '+447700900002' && /disconnected/.test(s.Body)), 'the client was told');
  // access is gone
  assert.equal(await w.storage.get(`tokens:${REALM}`), undefined);
  assert.equal(await w.storage.get(`appkey:${a.appKey}`), undefined);
  assert.equal(await w.storage.get(`code:${a.appKey}`), undefined);
  assert.equal(await sessionsOf(w, a.appKey), 0);
  assert.deepEqual(keysWith(w, `push:${REALM}`, `doc:DOC${REALM}`, `pack:PACK${REALM}`, `seen:${REALM}`, `paycheck:${REALM}`), []);
  assert.equal((await callBooks(w, 'GET', '/c/app', { headers: { 'X-App': a.appKey } })).status, 404, 'the app link no longer opens');
  // the rest is held for the retention window
  const held = await w.storage.get(`client:${REALM}`);
  assert.ok(held.ended_at && held.ended_reason === 'revoked');
  assert.equal(keysWith(w, `trips:${REALM}`).length, 2, 'mileage held');
  assert.equal(keysWith(w, `log:${REALM}`).length, 1, 'change log held');
  // the other client is untouched
  assert.deepEqual(keysWith(w, OTHER, b.appKey).sort(), otherBefore);
  assert.equal(await sessionsOf(w, b.appKey), 2);
});

test('export hands over what Books holds, and still works while the data is held', async (t) => {
  const w = world(); network(t);
  const { a } = await twoClients(w);
  await asAdmin(w, 'POST', `/revoke/${REALM}`);
  const res = await asAdmin(w, 'GET', `/export/${REALM}`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.client.name, 'Leaving Plumbing');
  assert.equal(data.client.appKey, undefined, 'the app key is not part of an export');
  assert.equal(data.mileage.length, 2);
  assert.equal(data.changeLog.length, 1);
  assert.equal(data.changeLog[0].text, 'Filed Shell £40.00');
  assert.equal((await callBooks(w, 'GET', `/export/${REALM}`)).status, 403, 'admin only');
  assert.equal((await asAdmin(w, 'GET', '/export/9999999999999999')).status, 404);
});

test('purge: needs the confirm word, an ended client and no legal hold; then removes everything for that client and nothing else', async (t) => {
  const w = world(); network(t);
  const { a, b } = await twoClients(w);
  const otherBefore = keysWith(w, OTHER, b.appKey).sort();
  assert.equal((await callBooks(w, 'POST', `/purge/${REALM}?confirm=${REALM}`)).status, 403, 'admin only');
  assert.equal((await asAdmin(w, 'POST', `/purge/${REALM}`)).status, 400, 'no confirm');
  assert.equal((await asAdmin(w, 'POST', `/purge/${REALM}?confirm=wrong`)).status, 400, 'wrong confirm');
  assert.equal((await asAdmin(w, 'POST', `/purge/${REALM}?confirm=${REALM}`)).status, 409, 'not ended yet');
  assert.ok(keysWith(w, REALM).length > 5, 'nothing was deleted by the refused attempts');
  await asAdmin(w, 'POST', `/revoke/${REALM}`);
  await asAdmin(w, 'PUT', `/client/${REALM}`, { hold: true });
  const held = await asAdmin(w, 'POST', `/purge/${REALM}?confirm=${REALM}`);
  assert.equal(held.status, 409);
  assert.match((await held.json()).error, /legal hold/);
  assert.equal(keysWith(w, `trips:${REALM}`).length, 2, 'a held client keeps everything');
  await asAdmin(w, 'PUT', `/client/${REALM}`, { hold: false });
  const res = await asAdmin(w, 'POST', `/purge/${REALM}?confirm=${REALM}`);
  const out = (await res.json()).deleted;
  assert.equal(res.status, 200);
  assert.equal(out.mileage, 2); assert.equal(out.changeLog, 1); assert.equal(out.chaseNotes, 1); assert.equal(out.client, 1);
  assert.deepEqual(keysWith(w, REALM, a.appKey), [], 'not a single key for that client is left');
  assert.deepEqual(keysWith(w, OTHER, b.appKey).sort(), otherBefore, 'the other client is untouched');
});

test('the 30-day purge is a dry run until PURGE_MODE is "live": it only reports', async (t) => {
  t.after(() => mock.timers.reset());
  mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 2, 7) }); // a Monday
  const w = world(); const { log } = network(t);
  const iso = (days) => new Date(Date.now() - days * DAY).toISOString();
  for (const [realm, name, days, extra] of [['4000000000000001', 'Old Ended Ltd', 45, {}], ['4000000000000002', 'Recent Ended Ltd', 10, {}], ['4000000000000003', 'Held Ltd', 45, { hold: true }], ['4000000000000004', 'Demo', 45, { demo: true }]]) {
    const c = await seedClient(w, { realm, name, tokens: false, ended_at: iso(days), ended_reason: 'revoked', ...extra });
    await footprint(w, realm, c.appKey);
  }
  await runCron(w, '0 7 * * *');
  assert.equal(keysWith(w, '4000000000000001').length > 5, true, 'dry run deleted nothing');
  const report = log.sms.filter(s => s.To === '+447700900001').map(s => s.Body).join(' | ');
  assert.match(report, /Old Ended Ltd/);
  assert.match(report, /nothing deleted yet/);
  assert.doesNotMatch(report, /Recent Ended|Held Ltd|Demo/);
});

test('with PURGE_MODE=live the 30-day purge deletes only ended, un-held, non-demo clients past the window', async (t) => {
  t.after(() => mock.timers.reset());
  mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 3, 7) }); // a Tuesday
  const w = world({ PURGE_MODE: 'live' }); const { log } = network(t);
  const iso = (days) => new Date(Date.now() - days * DAY).toISOString();
  const keep = {};
  for (const [realm, name, days, extra] of [['4000000000000001', 'Old Ended Ltd', 45, {}], ['4000000000000002', 'Recent Ended Ltd', 10, {}], ['4000000000000003', 'Held Ltd', 45, { hold: true }], ['4000000000000004', 'Demo', 45, { demo: true }], ['4000000000000005', 'Not Ended Ltd', 0, { ended_at: undefined }]]) {
    const c = await seedClient(w, { realm, name, tokens: false, ended_at: days ? iso(days) : undefined, ended_reason: days ? 'revoked' : undefined, ...extra });
    await footprint(w, realm, c.appKey); keep[realm] = c.appKey;
  }
  await runCron(w, '0 7 * * *');
  assert.deepEqual(keysWith(w, '4000000000000001', keep['4000000000000001']), [], 'the old ended client is gone');
  for (const r of ['4000000000000002', '4000000000000003', '4000000000000004', '4000000000000005']) assert.ok(keysWith(w, r).length > 8, `${r} must be kept`);
  assert.ok(log.sms.some(s => /deleted what was held/.test(s.Body) && /Old Ended Ltd/.test(s.Body)));
});

test('housekeeping clears out old invites (name and phone), codes, sessions, alerts and counters, and keeps the live ones', async (t) => {
  const w = world(); network(t);
  const s = w.storage, now = Date.now();
  await s.put('invite:old', { id: 'old', name: 'Gone Ltd', phone: '+447700900009', created: now - 20 * DAY });
  await s.put('invite:fresh', { id: 'fresh', name: 'Waiting Ltd', phone: '+447700900008', created: now - 2 * DAY });
  await s.put('state:old', { value: 'old', at: now - 3600_000 }); await s.put('state:fresh', { value: 'fresh', at: now });
  await s.put('code:expired', { hash: 'h', expires: now - 3600_000 * 5, tries: 0, sent: [now - 3600_000 * 5] });
  await s.put('code:used', { sent: [now - 3600_000 * 3] });
  await s.put('code:live', { hash: 'h', expires: now + 600_000, tries: 0, sent: [now] });
  await s.put('session:' + await sha256('old'), { appKey: 'a', created: now - 400 * DAY });
  await s.put('session:' + await sha256('new'), { appKey: 'a', created: now - 5 * DAY });
  await s.put('alert:x:old', now - 9 * DAY); await s.put('alert:x:new', now - 3600_000);
  const res = await w.store.fetch('https://store/housekeeping', { method: 'POST' });
  const out = await res.json();
  assert.deepEqual(out, { invites: 1, states: 1, codes: 2, sessions: 1, alerts: 1, enquiries: 0 });
  assert.equal(await s.get('invite:old'), undefined); assert.ok(await s.get('invite:fresh'));
  assert.ok(await s.get('code:live')); assert.ok(await s.get('state:fresh'));
  assert.equal(keysWith(w, 'alert:x:old').length, 0); assert.equal(keysWith(w, 'alert:x:new').length, 1);
});

test('usage counters from past windows are tidied up', async (t) => {
  const w = world(); network(t);
  const win = 3600, old = Math.floor(Date.now() / (win * 1000)) - 5;
  for (let i = 0; i < 50; i++) await w.storage.put(`rl:${win}:${old}:demo:x:${i}`, 3);
  mock.method(Math, 'random', () => 0); // force the tidy-up on this call
  t.after(() => mock.restoreAll());
  await w.store.fetch('https://store/limit', { method: 'POST', body: JSON.stringify({ name: 'demo:x:now', limit: 5, windowSec: win }) });
  assert.equal(keysWith(w, `rl:${win}:${old}:`).length, 0);
  assert.equal(keysWith(w, 'demo:x:now').length, 1);
});

// ---------------------------------------------------------------- when the client disconnects Books inside QuickBooks

const expire = async (w, realm = REALM) => { const t = await w.storage.get(`tokens:${realm}`); await w.storage.put(`tokens:${realm}`, { ...t, expires_at: Date.now() - 1000 }); };

test('Intuit says the connection is finished (invalid_grant, token unchanged): the dead tokens are deleted, the client is flagged, Gio is told, data is kept', async (t) => {
  const w = world(); const { log } = network(t, { token: () => Response.json({ error: 'invalid_grant' }, { status: 400 }) });
  await seedClient(w, { name: 'Dropped Plumbing' }); await expire(w);
  await w.storage.put(`trips:${REALM}:a1`, { id: 'a1', date: '2026-10-01', miles: 5, why: 'x' });
  const res = await asAdmin(w, 'GET', `/summary/${REALM}`);
  assert.equal(res.status, 500);
  assert.equal(await w.storage.get(`tokens:${REALM}`), undefined, 'useless tokens are not kept');
  const client = await w.storage.get(`client:${REALM}`);
  assert.ok(client.disconnected_at);
  assert.equal(client.ended_at, undefined, 'a disconnect does not start the deletion clock');
  assert.equal(keysWith(w, `trips:${REALM}`).length, 1, 'their data is not touched');
  assert.ok(log.sms.some(s => /connection has dropped/.test(s.Body)));
  const health = await (await asAdmin(w, 'GET', '/health')).json();
  const row = health.clients.find(c => c.realmId === REALM);
  assert.equal(row.ok, false);
  assert.match(row.problem, /disconnected in QuickBooks/);
  assert.equal(await sessionsOf(w, 'appkey-' + REALM), 0);
});

test('another request already refreshed the token (Intuit rotates it): nothing is deleted and the call succeeds', async (t) => {
  const w = world();
  const { log } = network(t, { token: async () => {
    // while this refresh was in flight, a parallel request refreshed and saved a new token
    await w.storage.put(`tokens:${REALM}`, { access_token: 'access-NEW', refresh_token: 'refresh-NEW', expires_at: Date.now() + 3600_000, refresh_expires_at: Date.now() + 90 * DAY, saved_at: new Date().toISOString(), env: 'production' });
    return Response.json({ error: 'invalid_grant' }, { status: 400 });
  } });
  await seedClient(w); await expire(w);
  const res = await asAdmin(w, 'GET', `/summary/${REALM}`);
  assert.equal(res.status, 200, await res.clone().text());
  assert.equal((await w.storage.get(`tokens:${REALM}`)).refresh_token, 'refresh-NEW');
  assert.equal((await w.storage.get(`client:${REALM}`)).disconnected_at, undefined);
  assert.ok(!log.sms.some(s => /dropped/.test(s.Body)));
});

test('an Intuit outage (not invalid_grant) never deletes anything', async (t) => {
  const w = world(); network(t, { token: () => Response.json({ error: 'server_error' }, { status: 503 }) });
  await seedClient(w); await expire(w);
  assert.equal((await asAdmin(w, 'GET', `/summary/${REALM}`)).status, 500);
  assert.ok(await w.storage.get(`tokens:${REALM}`), 'tokens kept');
  assert.equal((await w.storage.get(`client:${REALM}`)).disconnected_at, undefined);
});

test('reconnecting an ended or disconnected client clears the marks and restores their app link', async (t) => {
  const w = world(); network(t);
  const { a } = await twoClients(w);
  await asAdmin(w, 'POST', `/revoke/${REALM}`);
  assert.ok((await w.storage.get(`client:${REALM}`)).ended_at);
  const invite = await (await asAdmin(w, 'POST', '/invite', { name: 'Leaving Plumbing', phone: '+447700900002', env: 'production' })).json();
  const id = new URL(invite.link).searchParams.get('invite');
  const go = await callBooks(w, 'GET', `/connect?invite=${id}`);
  assert.equal(go.status, 302);
  const state = new URL(go.headers.get('location')).searchParams.get('state');
  const back = await callBooks(w, 'GET', `/callback?code=abc&realmId=${REALM}&state=${state}`);
  assert.equal(back.status, 200);
  const client = await w.storage.get(`client:${REALM}`);
  assert.equal(client.ended_at, undefined); assert.equal(client.ended_reason, undefined); assert.equal(client.disconnected_at, undefined);
  assert.equal(client.appKey, a.appKey);
  assert.equal(await w.storage.get(`appkey:${a.appKey}`), REALM);
  assert.ok(await w.storage.get(`tokens:${REALM}`));
  assert.equal(keysWith(w, `trips:${REALM}`).length, 2, 'held mileage is still there after they come back');
});

test('ending a client that already has no connection still works', async (t) => {
  const w = world(); network(t);
  await seedClient(w, { tokens: false });
  const res = await asAdmin(w, 'POST', `/revoke/${REALM}`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).tokens, 0);
  assert.ok((await w.storage.get(`client:${REALM}`)).ended_at);
});
