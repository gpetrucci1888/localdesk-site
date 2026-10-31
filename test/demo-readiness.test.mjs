// The public Mia demo, checked offline: the web demo has a call limit that matches what visitors are told, tells them calls may be
// recorded, loads its own (checked-in) script, and the demo number is the same everywhere. No call is placed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const rec = readFileSync('public/receptionist/index.html', 'utf8');

test('web demo: call limit matches the words on the page, recording is disclosed, script is local, only a public key is on the page', () => {
  const secs = Number(/var DEMO_MAX_SECONDS = (\d+);/.exec(rec)[1]);
  assert.ok(secs > 0 && secs <= 300, 'demo calls are short (5 minutes at most)');
  assert.match(rec, new RegExp(`Demo calls end after ${secs / 60} minutes`), 'the page tells visitors the real limit');
  assert.match(rec, /may be recorded and transcribed/); assert.match(rec, /href="\.\.\/privacy\.html"/);
  const src = /sc\.src = '(\.\.\/vendor\/[\w.-]+\.js)'/.exec(rec)[1]; assert.ok(existsSync(`public/${src.replace('../', '')}`), 'the demo script is served from this site, not a third party');
  assert.match(rec, /var VAPI_ASSISTANT_ID = "[0-9a-f-]{36}"/); assert.match(rec, /var VAPI_PUBLIC_KEY = "[0-9a-f-]{36}"/);
  assert.ok(!/(private|secret)[_ ]?key|Authorization|Bearer /i.test(rec.slice(rec.indexOf('Live demo: talk to Mia'))), 'no private key or bearer token near the demo code');
  assert.match(rec, /vapi\.stop\(\)/, 'the call is ended when the limit is reached');
});

test('the demo number is the same on every page and every link', () => {
  const numbers = new Set(); for (const f of ['public/index.html', 'public/receptionist/index.html', 'public/books/index.html']) for (const m of readFileSync(f, 'utf8').matchAll(/tel:(\+?\d+)/g)) numbers.add(m[1]);
  assert.deepEqual([...numbers], ['+441752741686']);
  for (const f of ['public/index.html', 'public/receptionist/index.html']) assert.match(readFileSync(f, 'utf8'), /01752 741686/);
});

test('Mia\'s client prompt and greeting still protect callers and the owner ', () => {
  const prompt = readFileSync('ops/client-prompt.txt', 'utf8');
  for (const must of [/NEVER promise or suggest a time, day, visit, call-back time or price/, /ring 999/, /virtual receptionist \(an AI\)/, /Never claim to be human/, /Never make anything up/, /No exclamation marks/]) assert.match(prompt, must);
});
