// Localdesk call summaries.
//
// Vapi calls this Worker when a call ends ("end-of-call-report"). It then:
//   1. texts the business owner who called and what they need (Twilio SMS)
//   2. emails them the summary, transcript and recording link (Resend, optional)
//   3. for missed calls (caller hung up before saying anything useful),
//      texts the caller back so they don't ring a rival, and tells the owner.
//
// Which business a call belongs to comes from the CLIENTS setting (see README).

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (!authorised(request, env)) return json({ error: 'Unauthorised' }, 401);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
    const msg = body && body.message;
    if (!msg || msg.type !== 'end-of-call-report') return json({ ok: true, ignored: msg && msg.type });

    const clients = loadClients(env);
    const client = findClient(clients, msg);
    if (!client) {
      console.log('No client matched', assistantId(msg), businessNumber(msg));
      return json({ ok: true, matched: false });
    }

    // Reply to Vapi straight away; send the messages in the background.
    ctx.waitUntil(handleCall(msg, client, env).catch(err => console.error('handleCall failed', err && err.stack || err)));
    return json({ ok: true, matched: client.name });
  }
};

export async function handleCall(msg, client, env) {
  const call = summarise(msg);
  const sent = [];

  if (call.missed) {
    if (client.missedCallTextBack !== false && call.callerNumber && isUkMobile(call.callerNumber)) {
      const from = senderFor(client, env);
      const canReply = from.startsWith('+');
      const text = (client.textBackMessage || (canReply
        ? "Hi, it's {business}. Sorry we couldn't take your call just now. Reply here with what you need, or we'll call you back as soon as we can."
        : "Hi, it's {business}. Sorry we couldn't take your call just now. We'll call you back as soon as we can."))
        .replace('{business}', client.name);
      sent.push(await sendSms(env, from, call.callerNumber, text));
    }
    for (const to of list(client.notifySms)) {
      sent.push(await sendSms(env, senderFor(client, env), to,
        `Missed call from ${pretty(call.callerNumber) || 'a withheld number'} (${call.when}). ` +
        (call.callerNumber && isUkMobile(call.callerNumber) && client.missedCallTextBack !== false ? "We've texted them back." : 'They hung up before leaving details.')));
    }
    return sent;
  }

  const sms = smsText(call);
  for (const to of list(client.notifySms)) sent.push(await sendSms(env, senderFor(client, env), to, sms));
  for (const to of list(client.notifyEmail)) sent.push(await sendEmail(env, to, client, call));
  return sent;
}

// ---------- reading Vapi's report ----------

export function summarise(msg) {
  const sd = (msg.analysis && msg.analysis.structuredData) || {};
  const art = msg.artifact || {};
  const transcript = msg.transcript || art.transcript || '';
  const callerNumber = (msg.customer && msg.customer.number) || (msg.call && msg.call.customer && msg.call.customer.number) || '';
  const duration = msg.durationSeconds != null ? msg.durationSeconds
    : (msg.startedAt && msg.endedAt ? (Date.parse(msg.endedAt) - Date.parse(msg.startedAt)) / 1000 : null);

  const callerSpoke = /(^|\n)\s*(User|Customer)\s*:/i.test(transcript) || (Array.isArray(art.messages) && art.messages.some(m => m.role === 'user'));
  const gotDetails = Boolean(sd.callerName || sd.job || sd.address);
  const missed = !gotDetails && (!callerSpoke || (duration != null && duration < 10));

  return {
    missed,
    callerName: clean(sd.callerName),
    callbackNumber: clean(sd.callbackNumber) || callerNumber,
    callerNumber,
    address: clean(sd.address),
    job: clean(sd.job),
    urgency: clean(sd.urgency),
    summary: clean((msg.analysis && msg.analysis.summary) || msg.summary),
    transcript,
    recordingUrl: msg.recordingUrl || art.recordingUrl || (msg.recording && msg.recording.url) || '',
    callId: (msg.call && msg.call.id) || '',
    durationSeconds: duration,
    when: ukTime(msg.endedAt || msg.timestamp || Date.now()),
  };
}

export function smsText(c) {
  const lines = [`New call (${c.when})`];
  if (c.callerName) lines.push(`Name: ${c.callerName}`);
  if (c.callbackNumber) lines.push(`Number: ${pretty(c.callbackNumber)}`);
  if (c.address) lines.push(`Address: ${c.address}`);
  if (c.job) lines.push(`Job: ${c.job}`);
  if (c.urgency) lines.push(`Urgency: ${c.urgency}`);
  if (!c.job && c.summary) lines.push(c.summary);
  lines.push('Full details in your email.');
  return truncate(lines.join('\n'), 600);
}

// ---------- matching a call to a client ----------

export function loadClients(env) {
  try { return JSON.parse(env.CLIENTS || '[]'); } catch (e) { console.error('CLIENTS is not valid JSON'); return []; }
}
function assistantId(msg) {
  return (msg.assistant && msg.assistant.id) || (msg.call && msg.call.assistantId) || '';
}
function businessNumber(msg) {
  return (msg.phoneNumber && msg.phoneNumber.number) || (msg.call && msg.call.phoneNumber && msg.call.phoneNumber.number) || '';
}
export function findClient(clients, msg) {
  const aid = assistantId(msg), num = businessNumber(msg);
  return clients.find(c => (c.assistantId && c.assistantId === aid) || (c.vapiNumber && num && c.vapiNumber === num)) || null;
}

// ---------- sending ----------

// Who texts appear to come from: the client's own SMS-capable number (+447...) so customers can reply,
// or a name like "Localdesk" (alphanumeric sender: one-way, up to 11 letters/numbers).
export function senderFor(client, env) {
  return client.fromNumber || env.SMS_SENDER || 'Localdesk';
}

async function sendSms(env, from, to, body) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return { channel: 'sms', to, skipped: 'Twilio not configured' };
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: from, To: to, Body: body }),
  });
  if (!res.ok) console.error('Twilio error', res.status, await res.text());
  return { channel: 'sms', to, status: res.status };
}

async function sendEmail(env, to, client, c) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return { channel: 'email', to, skipped: 'Email not configured' };
  const subject = `New call: ${c.callerName || pretty(c.callbackNumber) || 'unknown caller'}${c.job ? ' – ' + c.job : ''}`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject: truncate(subject, 140), html: emailHtml(client, c), text: emailText(c) }),
  });
  if (!res.ok) console.error('Resend error', res.status, await res.text());
  return { channel: 'email', to, status: res.status };
}

export function emailHtml(client, c) {
  const row = (k, v) => v ? `<tr><td style="padding:6px 14px 6px 0;color:#566069;vertical-align:top">${k}</td><td style="padding:6px 0;font-weight:700">${esc(v)}</td></tr>` : '';
  return `<div style="font-family:Arial,sans-serif;max-width:560px;color:#1F2328">
<p style="margin:0 0 4px;color:#566069;font-size:13px">${esc(client.name)} · ${esc(c.when)}</p>
<h2 style="margin:0 0 14px">New call${c.urgency ? ' · ' + esc(c.urgency) : ''}</h2>
<table style="border-collapse:collapse;font-size:15px">${row('Name', c.callerName)}${row('Number', pretty(c.callbackNumber))}${row('Address', c.address)}${row('Job', c.job)}${row('Urgency', c.urgency)}</table>
${c.summary ? `<h3 style="margin:22px 0 6px">Summary</h3><p style="margin:0">${esc(c.summary)}</p>` : ''}
${c.recordingUrl ? `<p style="margin:18px 0 0"><a href="${esc(c.recordingUrl)}">Listen to the recording</a></p>` : ''}
${c.transcript ? `<h3 style="margin:22px 0 6px">Transcript</h3><pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:14px;background:#F7F8F8;padding:12px;margin:0">${esc(c.transcript)}</pre>` : ''}
<p style="margin:22px 0 0;color:#566069;font-size:12px">Sent by Localdesk, your AI receptionist.</p></div>`;
}
function emailText(c) {
  const details = [['Name', c.callerName], ['Number', pretty(c.callbackNumber)], ['Address', c.address], ['Job', c.job], ['Urgency', c.urgency]]
    .filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  const parts = [`New call (${c.when})\n` + details.join('\n')];
  if (c.summary) parts.push(`Summary: ${c.summary}`);
  if (c.recordingUrl) parts.push(`Recording: ${c.recordingUrl}`);
  if (c.transcript) parts.push(`Transcript:\n${c.transcript}`);
  return parts.join('\n\n');
}

// ---------- helpers ----------

function authorised(request, env) {
  if (!env.VAPI_SECRET) return false;
  const h = request.headers.get('x-vapi-secret') || (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  return safeEqual(h, env.VAPI_SECRET);
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export function isUkMobile(n) { return /^\+447\d{9}$/.test((n || '').replace(/\s/g, '')); }
export function pretty(n) {
  const s = (n || '').replace(/\s/g, '');
  if (/^\+44\d{10}$/.test(s)) { const l = '0' + s.slice(3); return l.startsWith('07') ? `${l.slice(0, 5)} ${l.slice(5)}` : `${l.slice(0, 5)} ${l.slice(5)}`; }
  return n || '';
}
function ukTime(t) {
  const d = new Date(typeof t === 'number' ? t : Date.parse(t) || Date.now());
  return d.toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', hour: '2-digit', minute: '2-digit' });
}
function clean(v) { return typeof v === 'string' ? v.trim() : (v == null ? '' : String(v)); }
function list(v) { return Array.isArray(v) ? v : (v ? [v] : []); }
function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function esc(s) { return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function json(obj, status = 200) { return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } }); }
