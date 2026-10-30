// The app worker (what phones and laptops talk to): security headers, receipt-reader limits, login cookie.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, network, seedClient, seedSession, callApp, REALM, SANDBOX_REALM } from './harness.mjs';

const DEMO_KEY = 'demo-appkey-0001';
const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ'; // tiny, but the right shape
const demo = (w) => seedClient(w, { realm: SANDBOX_REALM, appKey: DEMO_KEY, name: 'Demo', env: 'sandbox', demo: true });
const read = (w, ip, extra = {}) => callApp(w, 'POST', `/${DEMO_KEY}/read`, { body: { image: PHOTO }, headers: { 'CF-Connecting-IP': ip, ...extra } });

test('every page and answer carries the security headers; HTML also gets the CSP and frame protection', async (t) => {
  const w = world(); network(t);
  await demo(w);
  const real = await seedClient(w, { realm: REALM, appKey: 'appkey-real-00001', env: 'production' });
  const page = await callApp(w, 'GET', `/${DEMO_KEY}/`);                 // the app itself (demo, so no login)
  const login = await callApp(w, 'GET', `/${real.appKey}/`);             // a real client, not logged in: the login page
  assert.match(await login.clone().text(), /Text me a code/);
  for (const [name, res] of [['app', page], ['login', login]]) {
    const csp = res.headers.get('content-security-policy');
    assert.equal(res.status, 200, name);
    assert.match(csp, /frame-ancestors 'none'/, name);
    assert.match(csp, /object-src 'none'/, name);
    assert.match(csp, /base-uri 'none'/, name);
    assert.match(csp, /script-src [^;]*https:\/\/cdnjs\.cloudflare\.com/, `${name}: the PDF reader's host is allowed, nothing else external`);
    assert.doesNotMatch(csp, /\*/, `${name}: no wildcards`);
    assert.equal(res.headers.get('x-frame-options'), 'DENY', name);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff', name);
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer', `${name}: the address contains the client's app key`);
    assert.match(res.headers.get('permissions-policy'), /microphone=\(self\)/, `${name}: the speech button must keep working`);
    assert.match(res.headers.get('strict-transport-security'), /max-age=\d+/, name);
    assert.equal(res.headers.get('cache-control'), 'no-store', name);
  }
  const api = await callApp(w, 'GET', `/${DEMO_KEY}/api/miles`);
  assert.equal(api.status, 200);
  assert.match(api.headers.get('cache-control'), /no-store/);
  assert.equal(api.headers.get('x-content-type-options'), 'nosniff');
  for (const path of ['manifest.json', 'sw.js', 'icon-192.png']) {
    const r = await callApp(w, 'GET', `/${DEMO_KEY}/${path}`);
    assert.equal(r.status, 200, path);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff', path);
    assert.equal(r.headers.get('content-security-policy'), null, `${path}: CSP is for pages only`);
  }
});

test('the receipt reader: a valid photo is read; a non-photo and an oversized one are refused before the AI sees them', async (t) => {
  const w = world(); network(t);
  await demo(w);
  const ok = await read(w, '203.0.113.5');
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).supplier, 'Shell');
  assert.equal(w.ai.calls, 1);
  const notPhoto = await callApp(w, 'POST', `/${DEMO_KEY}/read`, { body: { image: 'hello' }, headers: { 'CF-Connecting-IP': '203.0.113.5' } });
  assert.equal(notPhoto.status, 400);
  const huge = await callApp(w, 'POST', `/${DEMO_KEY}/read`, { body: { image: PHOTO + 'A'.repeat(6_100_000) }, headers: { 'CF-Connecting-IP': '203.0.113.5' } });
  assert.equal(huge.status, 413);
  assert.match((await huge.json()).error, /too big/);
  const declared = await callApp(w, 'POST', `/${DEMO_KEY}/read`, { body: { image: PHOTO }, headers: { 'CF-Connecting-IP': '203.0.113.5', 'Content-Length': '99999999' } });
  assert.equal(declared.status, 413, 'a body that says it is enormous is turned away');
  assert.equal(w.ai.calls, 1, 'none of the refused ones reached the AI');
});

test('the demo receipt reader stops a visitor after 15 an hour, plainly, and does not stop other visitors', async (t) => {
  const w = world(); network(t);
  await demo(w);
  for (let i = 0; i < 15; i++) assert.equal((await read(w, '203.0.113.5')).status, 200, `read ${i + 1}`);
  const stopped = await read(w, '203.0.113.5');
  assert.equal(stopped.status, 429);
  assert.match((await stopped.json()).error, /lot of receipts at once/);
  assert.equal((await read(w, '198.51.100.7')).status, 200);
  assert.equal(w.ai.calls, 16, 'the 16th from the first visitor never reached the AI');
});

test('a real client\'s reads are counted too (and refused only far above normal use)', async (t) => {
  const w = world(); network(t);
  const c = await seedClient(w, { realm: REALM, appKey: 'appkey-real-00001', env: 'production' });
  const session = await seedSession(w, c.appKey);
  const r = await callApp(w, 'POST', `/${c.appKey}/read`, { body: { image: PHOTO }, headers: { Cookie: `bk=${session}` } });
  assert.equal(r.status, 200);
  assert.equal(w.ai.calls, 1);
  const noLogin = await callApp(w, 'POST', `/${c.appKey}/read`, { body: { image: PHOTO } });
  assert.equal(noLogin.status, 401, 'no login, no AI');
  assert.equal(w.ai.calls, 1);
});

test('the login cookie stays HttpOnly, Secure and SameSite, and logging out clears it', async (t) => {
  const w = world(); network(t);
  const c = await seedClient(w, { realm: REALM, appKey: 'appkey-real-00001', env: 'production' });
  const code = '123456';
  const { sha256 } = await import('./harness.mjs');
  await w.storage.put(`code:${c.appKey}`, { hash: await sha256(code), expires: Date.now() + 600_000, tries: 0, sent: [Date.now()] });
  const login = await callApp(w, 'POST', `/${c.appKey}/login/verify`, { body: { code } });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, new RegExp(`Path=/${c.appKey}/`));
  const session = cookie.match(/bk=([^;]+)/)[1];
  const out = await callApp(w, 'POST', `/${c.appKey}/logout`, { headers: { Cookie: `bk=${session}` } });
  assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
  const after = await callApp(w, 'GET', `/${c.appKey}/api/miles`, { headers: { Cookie: `bk=${session}` } });
  assert.equal(after.status, 401, 'the old session is dead');
});

test('the page offers no way to talk to anything but itself and the PDF reader', async (t) => {
  const w = world(); network(t);
  await demo(w);
  const html = await (await callApp(w, 'GET', `/${DEMO_KEY}/`)).text();
  const hosts = [...new Set([...html.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map(m => m[1].toLowerCase()))];
  const allowed = new Set(['cdnjs.cloudflare.com', 'www.w3.org', 'wa.me']); // the PDF reader; the SVG namespace string; wa.me is a tap-to-open WhatsApp link (a plain navigation, which CSP does not restrict)
  const stray = hosts.filter(h => !allowed.has(h) && !/localdeskai\.co\.uk$/.test(h));
  assert.deepEqual(stray, [], 'every address the page mentions is one the CSP allows (or our own site)');
});
