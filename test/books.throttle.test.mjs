// QuickBooks says 429 when asked too often. Books waits and asks again instead of showing a problem.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, network, seedClient, seedSession, callBooks } from './harness.mjs';

async function setup(t, failures) {
  const w = world(); const net = network(t);
  const c = await seedClient(w, { env: 'production' });
  const session = await seedSession(w, c.appKey);
  const real = net.qb.handle.bind(net.qb); let seen = 0;
  net.qb.handle = (url, init) => (String(url).includes('/query') && seen++ < failures ? Response.json({ Fault: { Error: [{ Message: 'ThrottleExceeded' }] } }, { status: 429 }) : real(url, init));
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const call = () => callBooks(w, 'GET', '/c/owed', { headers: { 'X-App': c.appKey, 'X-Session': session } });
  return { call, tick: async () => { for (let i = 0; i < 8; i++) { t.mock.timers.tick(1500); await Promise.resolve(); } } };
}

test('two 429s in a row are waited out and the request succeeds', async (t) => {
  const { call, tick } = await setup(t, 2);
  const p = call(); const timer = setInterval(() => tick(), 5); const r = await p; clearInterval(timer);
  assert.equal(r.status, 200);
});

test('if QuickBooks keeps saying 429 it ends as a clear, plain message after a few tries', async (t) => {
  const { call, tick } = await setup(t, 99);
  const p = call(); const timer = setInterval(() => tick(), 5); const r = await p; clearInterval(timer);
  assert.equal(r.status, 500); assert.match(await r.text(), /is busy\. Wait a minute and try again\. Nothing was saved/);
});
