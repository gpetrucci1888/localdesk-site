// Security tests for the books worker: admin key, headers, expired links, pack-receipt scoping.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, network, seedClient, callBooks, asAdmin, ADMIN, REALM } from './harness.mjs';

const packId = 'PACKTESTLINK000000001';
const OLD = 401 * 86400000;

test('the admin key is not accepted in a web address any more', async (t) => {
  const w = world(); network(t);
  const res = await callBooks(w, 'GET', `/connect?k=${ADMIN}`);
  assert.equal(res.status, 400);
  assert.equal(res.headers.get('location'), null, 'must not start a connection');
  assert.match(await res.text(), /missing its invite/);
});

test('admin routes need the exact key (wrong, same-length, empty, absent all refused)', async (t) => {
  const w = world(); network(t);
  for (const key of ['wrong', ADMIN.slice(0, -1) + 'X', ADMIN.toUpperCase(), '', undefined]) {
    const res = await callBooks(w, 'GET', '/companies', { key });
    assert.equal(res.status, 403, `key ${JSON.stringify(key)}`);
  }
  assert.equal((await callBooks(w, 'GET', '/companies', { key: ADMIN })).status, 200);
  // No admin key configured at all: nothing gets in, not even an empty key.
  const bare = world({ ADMIN_KEY: undefined });
  assert.equal((await callBooks(bare, 'GET', '/companies', { key: '' })).status, 403);
});

test('an expired or unknown invite is an error page, not a success', async (t) => {
  const w = world(); network(t);
  const res = await callBooks(w, 'GET', '/connect?invite=nothere');
  assert.equal(res.status, 410);
  assert.equal(res.headers.get('x-robots-tag'), 'noindex');
});

test('expired and unknown pack and invoice links return 404 (not 200) and are not indexed', async (t) => {
  const w = world(); network(t);
  await w.storage.put(`pack:${packId}`, { realmId: REALM, from: '2026-07-06', to: '2026-10-05', created: Date.now() - OLD });
  await w.storage.put('doc:DOCTESTLINK00000000001', { realmId: REALM, type: 'invoice', id: '1', created: Date.now() - OLD });
  for (const path of [`/pack/${packId}`, `/pack/${packId}.csv`, '/pack/NEVERMADE00000000000', '/d/DOCTESTLINK00000000001', '/d/DOCTESTLINK00000000001.pdf', '/d/NEVERMADE00000000000']) {
    const res = await callBooks(w, 'GET', path);
    assert.equal(res.status, 404, path);
    assert.equal(res.headers.get('x-robots-tag'), 'noindex', path);
  }
  assert.equal((await callBooks(w, 'GET', '/disconnect')).status, 200, 'the disconnect page stays a normal page');
});

test('security headers: HTML gets CSP and frame protection; every answer gets nosniff and no-referrer; data is not cached', async (t) => {
  const w = world(); network(t);
  const html = await callBooks(w, 'GET', '/disconnect');
  assert.match(html.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(html.headers.get('content-security-policy'), /script-src 'none'/);
  assert.equal(html.headers.get('x-frame-options'), 'DENY');
  assert.equal(html.headers.get('cache-control'), 'no-store');
  const json = await callBooks(w, 'GET', '/companies', { key: ADMIN });
  for (const r of [html, json]) {
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
    assert.match(r.headers.get('strict-transport-security'), /max-age=\d+/);
  }
  assert.match(json.headers.get('cache-control'), /no-store/);
  assert.equal(json.headers.get('content-security-policy'), null, 'no CSP on non-HTML (it can break the PDF viewer)');
});

test('a pack link only serves receipts on expenses inside that pack\'s own dates', async (t) => {
  const w = world(); const { qb, log } = network(t);
  await seedClient(w);
  await w.storage.put(`pack:${packId}`, { realmId: REALM, from: '2026-07-06', to: '2026-10-05', created: Date.now() });
  qb.add('Purchase', { Id: '10', TxnDate: '2026-08-01', TotalAmt: 10 });          // inside the pack
  qb.add('Purchase', { Id: '11', TxnDate: '2026-12-01', TotalAmt: 11 });          // another quarter
  qb.add('Purchase', { Id: '12', TxnDate: '2026-07-05', TotalAmt: 12 });          // the day before the pack starts
  qb.add('Purchase', { Id: '13', TxnDate: '2026-10-05', TotalAmt: 13 });          // the last day (inside)
  const att = (Id, ref) => qb.add('Attachable', { Id, TempDownloadUri: 'https://download.test/' + Id, AttachableRef: ref });
  att('501', [{ EntityRef: { type: 'Purchase', value: '10' } }]);
  att('502', [{ EntityRef: { type: 'Purchase', value: '11' } }]);
  att('503', [{ EntityRef: { type: 'Invoice', value: '10' } }]);                  // not an expense
  att('504', []);                                                                  // attached to nothing
  att('505', [{ EntityRef: { type: 'Purchase', value: '999' } }]);                // expense that doesn't exist
  att('506', [{ EntityRef: { type: 'Purchase', value: '12' } }]);
  att('507', [{ EntityRef: { type: 'Purchase', value: '13' } }]);
  att('508', [{ EntityRef: { type: 'Customer', value: '1' } }, { EntityRef: { type: 'Purchase', value: '10' } }]); // mixed refs: finds the expense
  const get = (id) => callBooks(w, 'GET', `/pack/${packId}/r/${id}`);
  for (const id of ['501', '507', '508']) assert.equal((await get(id)).status, 200, `receipt ${id} should be served`);
  for (const id of ['502', '503', '504', '505', '506', '999999']) assert.equal((await get(id)).status, 404, `receipt ${id} must be refused`);
  assert.deepEqual(log.downloads.sort(), ['https://download.test/501', 'https://download.test/507', 'https://download.test/508'], 'refused receipts are never even downloaded');
});

test('the pack page prints with a nonce script, not a javascript: link, and the nonce header is not leaked', async (t) => {
  const w = world(); network(t);
  await seedClient(w);
  await w.storage.put(`pack:${packId}`, { realmId: REALM, from: '2026-07-06', to: '2026-10-05', created: Date.now() });
  const res = await callBooks(w, 'GET', `/pack/${packId}`);
  assert.equal(res.status, 200);
  const html = await res.text(), csp = res.headers.get('content-security-policy');
  const nonce = (csp.match(/script-src 'nonce-([^']+)'/) || [])[1];
  assert.ok(nonce, 'CSP carries a nonce');
  assert.ok(html.includes(`<script nonce="${nonce}">`), 'the page\'s one script uses it');
  assert.ok(!/javascript:/.test(html), 'no javascript: links');
  assert.equal(res.headers.get('x-csp-nonce'), null);
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  // a second view gets a different nonce
  const again = await callBooks(w, 'GET', `/pack/${packId}`);
  assert.notEqual((again.headers.get('content-security-policy').match(/'nonce-([^']+)'/) || [])[1], nonce);
});

test('the csv from a pack link is not cached and cannot be sniffed', async (t) => {
  const w = world(); network(t);
  await seedClient(w);
  await w.storage.put(`pack:${packId}`, { realmId: REALM, from: '2026-07-06', to: '2026-10-05', created: Date.now() });
  const res = await callBooks(w, 'GET', `/pack/${packId}.csv`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  assert.match(res.headers.get('cache-control'), /no-store/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});
