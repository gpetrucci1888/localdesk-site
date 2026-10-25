// Localdesk: serves the website and receives Vapi end-of-call reports at /api/vapi.
// For each finished call it texts the client a short summary through Twilio.
//
// Secrets (set in Cloudflare > Workers > localdesk > Settings > Variables and Secrets, type "Secret"):
//   VAPI_WEBHOOK_SECRET   the same secret you put in the Vapi custom credential
//   TWILIO_ACCOUNT_SID    from the Twilio console
//   TWILIO_AUTH_TOKEN     from the Twilio console
//   TWILIO_FROM           the Twilio number or alphanumeric sender the texts come from
//   CLIENTS_JSON          which assistant belongs to which client, for example:
//                         {"<vapi assistant id>":{"business":"Smith Roofing","mobile":"+447700900123"}}

const E164 = /^\+[1-9]\d{7,14}$/;
const MAX_SMS_CHARS = 480;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/vapi') return env.ASSETS.fetch(request);
    if (request.method !== 'POST') return reply(405, { error: 'method not allowed' });
    if (!isAuthorised(request, env)) return reply(401, { error: 'unauthorised' });

    let body;
    try {
      body = await request.json();
    } catch {
      return reply(400, { error: 'bad json' });
    }

    const message = body && body.message ? body.message : body;
    if (!message || message.type !== 'end-of-call-report') {
      return reply(200, { ok: true, skipped: 'not an end-of-call report' });
    }

    const call = message.call || {};
    const callId = call.id || 'unknown';

    // Website demo calls (in the browser) are not real customer calls.
    if (call.type === 'webCall') return reply(200, { ok: true, skipped: 'web call' });

    const assistantId = call.assistantId || (message.assistant && message.assistant.id) || '';
    const client = findClient(env, assistantId);
    if (!client) {
      console.log(`call ${callId}: no client set up for this assistant, nothing sent`);
      return reply(200, { ok: true, skipped: 'no client for assistant' });
    }

    const text = buildText(message, client);
    try {
      await sendSms(env, client.mobile, text);
    } catch (err) {
      console.log(`call ${callId}: text failed: ${err.message}`);
      return reply(502, { error: 'text failed' });
    }
    console.log(`call ${callId}: text sent to ${client.business}`);
    return reply(200, { ok: true });
  },
};

function reply(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Vapi sends the secret either as "Authorization: Bearer <secret>" or as "X-Vapi-Secret: <secret>".
function isAuthorised(request, env) {
  const secret = env.VAPI_WEBHOOK_SECRET;
  if (!secret) return false; // no secret set means nothing gets in
  const auth = request.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const legacy = request.headers.get('x-vapi-secret') || '';
  return safeEqual(bearer, secret) || safeEqual(legacy, secret);
}

function findClient(env, assistantId) {
  if (!assistantId || !env.CLIENTS_JSON) return null;
  let map;
  try {
    map = JSON.parse(env.CLIENTS_JSON);
  } catch {
    console.log('CLIENTS_JSON is not valid JSON');
    return null;
  }
  const entry = map[assistantId];
  if (!entry || !E164.test(entry.mobile || '')) return null;
  return { business: entry.business || 'your business', mobile: entry.mobile };
}

function clean(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function pick(data, keys) {
  if (!data || typeof data !== 'object') return '';
  for (const key of keys) {
    const found = Object.keys(data).find((k) => k.toLowerCase() === key);
    if (found && data[found] != null && clean(String(data[found]))) return clean(String(data[found]));
  }
  return '';
}

function callerNumber(message) {
  const call = message.call || {};
  return (call.customer && call.customer.number) || (message.customer && message.customer.number) || '';
}

function heardCaller(message) {
  const msgs = (message.artifact && message.artifact.messages) || [];
  return msgs.some((m) => m && (m.role === 'user' || m.role === 'customer') && clean(m.message || m.content || ''));
}

function buildText(message, client) {
  const analysis = message.analysis || {};
  const data = analysis.structuredData;
  const callerId = callerNumber(message) || 'number withheld';

  const lines = [`New call for ${client.business}`];

  if (!heardCaller(message) && !clean(analysis.summary || '')) {
    lines.push(`From: ${callerId}`, 'They hung up before leaving any details.');
    return lines.join('\n').slice(0, MAX_SMS_CHARS);
  }

  const name = pick(data, ['name', 'callername', 'caller_name']);
  const number = pick(data, ['callbacknumber', 'callback_number', 'phone', 'phonenumber', 'number']);
  const address = pick(data, ['address', 'postcode', 'location']);
  const job = pick(data, ['job', 'need', 'request', 'reason', 'description']);
  const urgency = pick(data, ['urgency', 'urgent']);

  if (name) lines.push(`Name: ${name}`);
  lines.push(`Call back: ${number || callerId}`);
  if (address) lines.push(`Where: ${address}`);
  if (job) lines.push(`Need: ${job}`);
  if (urgency) lines.push(`Urgency: ${urgency}`);

  const summary = clean(analysis.summary || '');
  if (summary && !job) lines.push(summary);

  return lines.join('\n').slice(0, MAX_SMS_CHARS);
}

async function sendSms(env, to, body) {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_FROM;
  if (!sid || !token || !from) throw new Error('Twilio settings missing');

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      authorization: 'Basic ' + btoa(`${sid}:${token}`),
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (!res.ok) throw new Error(`Twilio said ${res.status}`);
}
