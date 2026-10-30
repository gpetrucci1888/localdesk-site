// The website enquiry form: validated, rate limited, texts the owner, kept for 90 days, only callable from our own website.
import test from 'node:test';
import assert from 'node:assert/strict';
import { world, network, runCron } from './harness.mjs';
import books from '../workers/books/worker.js';

const post = (w, body, { origin = 'https://www.localdeskai.co.uk', ip = '203.0.113.5', method = 'POST' } = {}) =>
  books.fetch(new Request('https://books.test/enquiry', { method, headers: { 'Content-Type': 'application/json', Origin: origin, 'CF-Connecting-IP': ip }, body: method === 'POST' ? JSON.stringify(body) : undefined }), w.booksEnv);
const good = { name: 'Dave Penrose', phone: '07700 900123', business: 'Penrose Plumbing', product: 'books', message: 'Do you cover Truro?' };

test('a good enquiry is kept and texted to the owner, and the website may read the answer', async (t) => {
  const w = world(); const { log } = network(t);
  const r = await post(w, good);
  assert.equal(r.status, 200); assert.equal((await r.json()).ok, true);
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://www.localdeskai.co.uk');
  const kept = [...w.storage.keys()].filter(k => k.startsWith('lead:'));
  assert.equal(kept.length, 1); assert.equal((await w.storage.get(kept[0])).name, 'Dave Penrose');
  assert.equal(log.sms.length, 1); assert.equal(log.sms[0].To, '+447700900001'); assert.match(log.sms[0].Body, /New Books enquiry: Dave Penrose \(Penrose Plumbing\), 07700 900123\. Do you cover Truro\?/);
});

test('missing name or phone is explained plainly, nothing is kept or texted, and a robot field is ignored quietly', async (t) => {
  const w = world(); const { log } = network(t);
  const a = await post(w, { ...good, name: '' }); assert.equal(a.status, 400); assert.match((await a.json()).error, /your name/);
  const b = await post(w, { ...good, phone: '123' }); assert.equal(b.status, 400); assert.match((await b.json()).error, /phone number/);
  const c = await post(w, { ...good, website: 'http://spam.example' }); assert.equal(c.status, 200);
  assert.equal([...w.storage.keys()].filter(k => k.startsWith('lead:')).length, 0); assert.equal(log.sms.length, 0);
});

test('other websites cannot use it, the preflight works, and one visitor is limited to 5 an hour', async (t) => {
  const w = world(); const { log } = network(t);
  assert.equal((await post(w, good, { origin: 'https://evil.example' })).status, 403);
  const pre = await post(w, null, { method: 'OPTIONS' }); assert.equal(pre.status, 204); assert.match(pre.headers.get('access-control-allow-methods'), /POST/);
  for (let i = 0; i < 5; i++) assert.equal((await post(w, good)).status, 200);
  const sixth = await post(w, good); assert.equal(sixth.status, 429); assert.match((await sixth.json()).error, /email hello@localdeskai\.co\.uk/);
  assert.equal((await post(w, good, { ip: '198.51.100.9' })).status, 200, 'another visitor is fine');
  assert.equal(log.sms.length, 6);
});

test('new lines in what someone types cannot break the text message, and enquiries older than 90 days are deleted', async (t) => {
  const w = world(); const { log } = network(t);
  await post(w, { ...good, message: 'line one\nline two\r\nMore' });
  assert.ok(!/[\r\n]/.test(log.sms[0].Body));
  await w.storage.put('enquiry:1:old', { name: 'Old', phone: '07700900000', at: Date.now() - 91 * 86400000 });
  await runCron(w, '0 7 * * *');
  assert.equal(await w.storage.get('enquiry:1:old'), undefined); assert.equal([...w.storage.keys()].filter(k => k.startsWith('lead:')).length, 1);
});
