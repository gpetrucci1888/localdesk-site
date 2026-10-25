// Run with: node test/test.mjs   (no network needed; Twilio and Resend are faked)
import assert from 'node:assert/strict';
import worker, { summarise, smsText, pretty, isUkMobile } from '../src/index.js';

const sent = [];
globalThis.fetch = async (url, opts) => {
  const body = opts.body instanceof URLSearchParams ? Object.fromEntries(opts.body) : JSON.parse(opts.body);
  sent.push({ url: String(url), body, auth: opts.headers.Authorization });
  return new Response('{}', { status: 201 });
};

const client = {
  name: 'Westcountry Roofing', assistantId: 'asst-1', fromNumber: '+441234567890',
  notifySms: ['+447700900111'], notifyEmail: ['owner@example.com'], missedCallTextBack: true,
};
const env = {
  VAPI_SECRET: 's3cret', TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'tok', RESEND_API_KEY: 're_1',
  EMAIL_FROM: 'Localdesk <calls@localdeskai.co.uk>', CLIENTS: JSON.stringify([client]),
};

async function post(message, headers = { 'x-vapi-secret': 's3cret' }) {
  const waits = [];
  const res = await worker.fetch(new Request('https://w.example/', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ message }) }), env, { waitUntil: p => waits.push(p) });
  await Promise.all(waits);
  return res;
}

const answered = {
  type: 'end-of-call-report', assistant: { id: 'asst-1' }, customer: { number: '+447700900123' },
  durationSeconds: 95, endedAt: '2026-10-26T09:14:00Z',
  analysis: { summary: 'Leak through ceiling from flat roof, wants someone out.', structuredData: { callerName: 'Sarah Patel', address: '14 Elm Road, Truro', job: 'Flat roof leak, water through ceiling', urgency: 'Urgent' } },
  transcript: 'AI: Westcountry Roofing...\nUser: Hi, my roof is leaking\nAI: Sorry to hear that...',
  recordingUrl: 'https://example.com/rec.wav', call: { id: 'call-1' },
};

// 1. wrong secret is rejected and sends nothing
assert.equal((await post(answered, { 'x-vapi-secret': 'nope' })).status, 401);
assert.equal(sent.length, 0);

// 2. answered call -> one SMS to owner + one email
let res = await post(answered);
assert.equal(res.status, 200);
assert.equal(sent.length, 2);
const sms = sent.find(s => s.url.includes('twilio'));
assert.equal(sms.body.To, '+447700900111');
assert.equal(sms.body.From, '+441234567890');
assert.match(sms.body.Body, /Name: Sarah Patel/);
assert.match(sms.body.Body, /Number: 07700 900123/);
assert.match(sms.body.Body, /Urgency: Urgent/);
const email = sent.find(s => s.url.includes('resend'));
assert.deepEqual(email.body.to, 'owner@example.com');
assert.match(email.body.subject, /Sarah Patel – Flat roof leak/);
assert.match(email.body.html, /Listen to the recording/);
console.log('SMS the owner gets:\n---\n' + sms.body.Body + '\n---');

// 3. missed call (hung up, nobody spoke) -> text back to caller + note to owner, no email
sent.length = 0;
await post({ type: 'end-of-call-report', assistant: { id: 'asst-1' }, customer: { number: '+447700900999' }, durationSeconds: 4, transcript: 'AI: Westcountry Roofing, how can I help?', endedAt: '2026-10-26T19:02:00Z' });
assert.equal(sent.length, 2);
assert.ok(sent.some(s => s.body.To === '+447700900999' && /Sorry we couldn't take your call/.test(s.body.Body)));
assert.ok(sent.some(s => s.body.To === '+447700900111' && /Missed call from 07700 900999.*texted them back/.test(s.body.Body)));
console.log('Missed-call texts:', sent.map(s => `${s.body.To}: ${s.body.Body}`));

// 4. landline caller who hung up -> no text back (can't text a landline), owner still told
sent.length = 0;
await post({ type: 'end-of-call-report', assistant: { id: 'asst-1' }, customer: { number: '+441872000000' }, durationSeconds: 3, transcript: '' });
assert.equal(sent.length, 1);
assert.match(sent[0].body.Body, /hung up before leaving details/);

// 5. other Vapi messages and unknown assistants are ignored
sent.length = 0;
await post({ type: 'status-update', status: 'in-progress' });
await post({ ...answered, assistant: { id: 'someone-else' } });
assert.equal(sent.length, 0);

// helpers
assert.equal(pretty('+447700900123'), '07700 900123');
assert.ok(isUkMobile('+447700900123') && !isUkMobile('+441872000000'));
assert.equal(summarise({ transcript: 'User: hi', durationSeconds: 40 }).missed, false);
assert.ok(smsText(summarise(answered)).length <= 600);

// 6. no SMS number for the client -> texts come from "Localdesk" and the text-back doesn't say "reply"
sent.length = 0;
const env2 = { ...env, CLIENTS: JSON.stringify([{ ...client, fromNumber: '' }]) };
const waits = [];
await worker.fetch(new Request('https://w.example/', { method: 'POST', headers: { 'x-vapi-secret': 's3cret' }, body: JSON.stringify({ message: { type: 'end-of-call-report', assistant: { id: 'asst-1' }, customer: { number: '+447700900555' }, durationSeconds: 3, transcript: '' } }) }), env2, { waitUntil: p => waits.push(p) });
await Promise.all(waits);
assert.ok(sent.every(s => s.body.From === 'Localdesk'));
const back = sent.find(s => s.body.To === '+447700900555');
assert.ok(back && !/Reply here/.test(back.body.Body));
console.log('Text-back from Localdesk:', back.body.Body);

console.log('\nAll call-summary tests passed.');
