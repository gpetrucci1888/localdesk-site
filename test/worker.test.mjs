// Run with: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const env = {
  VAPI_WEBHOOK_SECRET: 'sekret',
  TWILIO_ACCOUNT_SID: 'ACtest',
  TWILIO_AUTH_TOKEN: 'tok',
  TWILIO_FROM: 'Localdesk',
  CLIENTS_JSON: JSON.stringify({ 'asst-1': { business: 'Smith Roofing', mobile: '+447700900123' } }),
  ASSETS: { fetch: async () => new Response('static page') },
};

function report(overrides = {}) {
  return {
    message: {
      type: 'end-of-call-report',
      call: { id: 'call-1', type: 'inboundPhoneCall', assistantId: 'asst-1', customer: { number: '+447700900555' } },
      artifact: { messages: [{ role: 'user', message: 'Hi, I have a leak' }] },
      analysis: { summary: 'Caller has a roof leak.', structuredData: { name: 'Sam Jones', job: 'Roof leak', urgency: 'Urgent', address: 'PL1 2AB' } },
      ...overrides,
    },
  };
}

function post(body, headers = { authorization: 'Bearer sekret' }) {
  return new Request('https://x.test/api/vapi', { method: 'POST', headers, body: JSON.stringify(body) });
}

async function withTwilio(run) {
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), body: init.body.toString(), auth: init.headers.authorization });
    return new Response('{}', { status: 201 });
  };
  try { await run(sent); } finally { globalThis.fetch = realFetch; }
}

test('sends a text to the right client', async () => {
  await withTwilio(async (sent) => {
    const res = await worker.fetch(post(report()), env);
    assert.equal(res.status, 200);
    assert.equal(sent.length, 1);
    const form = new URLSearchParams(sent[0].body);
    assert.equal(form.get('To'), '+447700900123');
    assert.equal(form.get('From'), 'Localdesk');
    assert.match(form.get('Body'), /New call for Smith Roofing/);
    assert.match(form.get('Body'), /Name: Sam Jones/);
    assert.match(form.get('Body'), /Call back: \+447700900555/);
    assert.match(form.get('Body'), /Urgency: Urgent/);
    assert.match(sent[0].url, /Accounts\/ACtest\/Messages\.json$/);
  });
});

test('accepts the X-Vapi-Secret header too', async () => {
  await withTwilio(async (sent) => {
    const res = await worker.fetch(post(report(), { 'x-vapi-secret': 'sekret' }), env);
    assert.equal(res.status, 200);
    assert.equal(sent.length, 1);
  });
});

test('rejects wrong or missing secret and sends nothing', async () => {
  await withTwilio(async (sent) => {
    assert.equal((await worker.fetch(post(report(), { authorization: 'Bearer nope' }), env)).status, 401);
    assert.equal((await worker.fetch(post(report(), {}), env)).status, 401);
    assert.equal((await worker.fetch(post(report()), { ...env, VAPI_WEBHOOK_SECRET: '' })).status, 401);
    assert.equal(sent.length, 0);
  });
});

test('ignores other message types, website calls and unknown assistants', async () => {
  await withTwilio(async (sent) => {
    assert.equal((await worker.fetch(post({ message: { type: 'status-update' } }), env)).status, 200);
    const web = report(); web.message.call.type = 'webCall';
    assert.equal((await worker.fetch(post(web), env)).status, 200);
    const other = report(); other.message.call.assistantId = 'someone-else';
    assert.equal((await worker.fetch(post(other), env)).status, 200);
    assert.equal(sent.length, 0);
  });
});

test('says so when the caller hung up without speaking', async () => {
  await withTwilio(async (sent) => {
    const r = report({ artifact: { messages: [] }, analysis: {} });
    await worker.fetch(post(r), env);
    assert.match(new URLSearchParams(sent[0].body).get('Body'), /hung up before leaving any details/);
  });
});

test('falls back to the summary when there is no structured data', async () => {
  await withTwilio(async (sent) => {
    const r = report({ analysis: { summary: 'Wants a quote for gutters.' } });
    await worker.fetch(post(r), env);
    assert.match(new URLSearchParams(sent[0].body).get('Body'), /Wants a quote for gutters/);
  });
});

test('reports a failure if Twilio refuses', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('no', { status: 400 });
  try {
    assert.equal((await worker.fetch(post(report()), env)).status, 502);
  } finally { globalThis.fetch = realFetch; }
});

test('serves the website for every other path', async () => {
  const res = await worker.fetch(new Request('https://x.test/'), env);
  assert.equal(await res.text(), 'static page');
});
