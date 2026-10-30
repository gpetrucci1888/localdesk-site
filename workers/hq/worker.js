// Localdesk Owner HQ: one private place for the owner to run the business, independent of any AI session.
//
// Login: the owner's passphrase (secret OWNER_PASSWORD, typed into Cloudflare by the owner) plus a 6-digit code from an
// authenticator app (enrolled on first login, stored in the Vault). No accounts, no emails, no third party in the login.
// Fails closed: with no OWNER_PASSWORD set, nothing can log in.
//
//   GET  /               overview: Books clients, subscriptions, what needs attention
//   GET  /customers      every customer: Books clients (from the connector) and Stripe subscriptions
//   GET  /products       Books and Receptionist: dashboards and links
//   GET  /books-admin    the Books admin page, served here with the admin key added by this worker (never sent to the browser)
//   ANY  /ba/<path>      the Books admin routes that page uses (allow-listed), key added server side
//   GET  /settings       business settings, product links, where every credential lives (names only, never values)
//   GET  /docs[/<name>]  operating instructions
//   GET  /backups        stored backups (and a download of the live Books backup)
//   GET/POST /login, POST /logout
//
// Bindings: BOOKS (service, the books worker), VAULT (Durable Object, class Vault), optional BACKUPS (R2 bucket).
// Secrets: OWNER_PASSWORD, ADMIN_KEY (the Books admin key, so the owner never has to handle it), optional STRIPE_KEY
// (a RESTRICTED read-only Stripe key). Plain: BOOKS_URL (public address of the books worker), optional RESET_TOTP.
import { LINKS, REGISTER, DOCS } from './content.js';

const enc = new TextEncoder();
const SESSION_SECONDS = 12 * 3600;

// ---------- small helpers ----------
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
async function same(a, b) {
  if (!a || !b) return false;
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let d = 0; for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}
const hmac = async (keyBytes, data, hash = 'SHA-256') => {
  const k = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, typeof data === 'string' ? enc.encode(data) : data));
};

// ---------- authenticator codes (RFC 6238: 6 digits, 30 seconds, SHA-1) ----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function b32encode(bytes) {
  let bits = '', out = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return out;
}
export function b32decode(s) {
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) bits += B32.indexOf(c).toString(2).padStart(5, '0');
  const out = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return out;
}
export async function totp(secretB32, step) {
  const msg = new Uint8Array(8); new DataView(msg.buffer).setUint32(4, step);
  const h = await hmac(b32decode(secretB32), msg, 'SHA-1');
  const o = h[19] & 15;
  const n = ((h[o] & 127) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 1000000;
  return String(n).padStart(6, '0');
}
// The step a code belongs to (within one step either side of now), or -1.
async function codeStep(secret, code) {
  if (!/^\d{6}$/.test(code)) return -1;
  const now = Math.floor(Date.now() / 30000);
  for (const s of [now, now - 1, now + 1]) if (await totp(secret, s) === code) return s;
  return -1;
}

// ---------- sessions ----------
async function sessionKey(env, vault) {
  return enc.encode(await sha256(`${env.OWNER_PASSWORD}|${(vault && vault.secret) || 'none'}|hq-session`));
}
async function makeSession(env, vault) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS, nonce = hex(crypto.getRandomValues(new Uint8Array(12)));
  return `${exp}.${nonce}.${hex(await hmac(await sessionKey(env, vault), `${exp}.${nonce}`))}`;
}
async function validSession(env, vault, cookie) {
  const m = /(?:^|;\s*)hq=(\d+)\.([0-9a-f]+)\.([0-9a-f]+)/.exec(cookie || '');
  if (!m || !vault || !vault.active || Number(m[1]) < Date.now() / 1000) return false;
  return same(m[3], hex(await hmac(await sessionKey(env, vault), `${m[1]}.${m[2]}`)));
}
const cookie = (value, maxAge) => `hq=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

// ---------- responses ----------
function secure(res, { csp } = {}) {
  const h = new Headers(res.headers);
  h.set('X-Content-Type-Options', 'nosniff'); h.set('Referrer-Policy', 'no-referrer');
  h.set('Strict-Transport-Security', 'max-age=31536000'); h.set('Cache-Control', 'no-store');
  h.set('X-Robots-Tag', 'noindex, nofollow'); h.set('X-Frame-Options', 'DENY');
  if (/text\/html/.test(h.get('Content-Type') || '')) h.set('Content-Security-Policy', csp || "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  return new Response(res.body, { status: res.status, headers: h });
}
const html = (body, status = 200, extra = {}) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...extra } });
const redirect = (to, extra = {}) => new Response(null, { status: 303, headers: { Location: to, ...extra } });

const STYLE = `<style>:root{color-scheme:light dark;--bg:#f2f3f5;--card:#fff;--ink:#16181b;--mute:#646a73;--line:#e4e6ea;--acc:#f5b800;--ok:#1f7a4d;--bad:#b5402c}
@media(prefers-color-scheme:dark){:root{--bg:#101113;--card:#1b1d20;--ink:#eceef1;--mute:#a1a7b0;--line:#2c3035;--ok:#5cc78f;--bad:#f08a76}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
header{background:#1f2328;color:#fff;padding:14px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}header b{font-size:18px}header b span{color:var(--acc)}
nav{display:flex;gap:4px;flex-wrap:wrap;flex:1}nav a{color:#ffffffc8;text-decoration:none;padding:6px 10px;border-radius:8px;font-size:15px}nav a.on,nav a:hover{background:#ffffff1f;color:#fff}
form.out{margin:0}form.out button{background:transparent;border:1px solid #ffffff55;color:#fff;border-radius:8px;padding:6px 10px;font:inherit;font-size:14px;cursor:pointer}
main{max-width:980px;margin:0 auto;padding:16px;display:grid;gap:14px}h1{font-size:22px;margin:4px 0}h2{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);margin:0 0 10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;overflow-x:auto}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.stat b{display:block;font-size:26px}.stat span{color:var(--mute);font-size:14px}table{border-collapse:collapse;width:100%;font-size:15px}th,td{text-align:left;padding:8px 10px;border-top:1px solid var(--line);vertical-align:top}th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute);border-top:0}
.ok{color:var(--ok)}.bad{color:var(--bad)}.mute{color:var(--mute)}.pill{display:inline-block;padding:2px 9px;border-radius:20px;background:var(--bg);font-size:13px;font-weight:700}
a{color:inherit}.links a{display:block;padding:8px 0;border-top:1px solid var(--line);text-decoration:none}.links a:first-child{border-top:0}.links small{display:block;color:var(--mute)}
input{font:inherit;font-size:18px;padding:12px;border:1.5px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);width:100%;margin:6px 0 12px}
button.go{font:inherit;font-weight:800;padding:12px 18px;border-radius:12px;border:0;background:#1f2328;color:#fff;cursor:pointer;width:100%}@media(prefers-color-scheme:dark){button.go{background:var(--acc);color:#1f2328}}
.msg{padding:10px 12px;border-radius:12px;border:1px solid var(--line);margin-bottom:10px}code{background:var(--bg);padding:2px 6px;border-radius:6px;word-break:break-all}pre{background:var(--bg);padding:12px;border-radius:10px;overflow-x:auto}</style>`;

const NAV = [['/', 'Overview'], ['/customers', 'Customers'], ['/products', 'Products'], ['/books-admin', 'Books admin'], ['/settings', 'Settings'], ['/docs', 'Docs'], ['/backups', 'Backups']];
const shell = (title, body, path = '') => `<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} · Localdesk HQ</title>${STYLE}
<body><header><b>Localdesk <span>HQ</span></b><nav>${NAV.map(([h, t]) => `<a href="${h}"${h === path ? ' class="on"' : ''}>${t}</a>`).join('')}</nav><form class="out" method="post" action="/logout"><button>Log out</button></form></header><main>${body}</main></body></html>`;
const bare = (title, body) => `<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>${STYLE}<body><main style="min-height:100vh;align-content:center;max-width:420px"><div class="card"><h1>Localdesk HQ</h1>${body}</div></main></body></html>`;

// ---------- the Vault (login state: authenticator secret, lockout counters) ----------
export class Vault {
  constructor(state) { this.storage = state.storage; }
  async fetch(request) {
    const url = new URL(request.url), body = request.method !== 'GET' && request.method !== 'DELETE' ? await request.json().catch(() => ({})) : {};
    const s = this.storage;
    if (url.pathname === '/totp') {
      if (request.method === 'GET') return Response.json((await s.get('totp')) || null);
      if (request.method === 'PUT') { await s.put('totp', body); return Response.json({ ok: true }); }
      if (request.method === 'DELETE') { await s.delete('totp'); return Response.json({ ok: true }); }
    }
    if (url.pathname === '/reset') {
      if (body.value !== undefined && (await s.get('resetSeen')) !== body.value) { await s.put('resetSeen', body.value); if ((await s.get('resetInit')) !== undefined) await s.delete('totp'); await s.put('resetInit', true); }
      return Response.json({ ok: true });
    }
    if (url.pathname === '/check') { // is this visitor locked out?
      const f = (await s.get(`fail:${body.who}`)) || { n: 0, until: 0 }, g = (await s.get('fail:all')) || { n: 0, until: 0 };
      return Response.json({ locked: Math.max(f.until, g.until) > Date.now() });
    }
    if (url.pathname === '/fail') {
      for (const [key, limit, ms] of [[`fail:${body.who}`, 5, 15 * 60000], ['fail:all', 200, 60 * 60000]]) {
        let f = (await s.get(key)) || { n: 0, until: 0, first: Date.now() };
        if (Date.now() - f.first > ms) f = { n: 0, until: 0, first: Date.now() };
        f.n++; if (f.n >= limit) { f.until = Date.now() + ms; f.n = 0; f.first = Date.now(); }
        await s.put(key, f);
      }
      return Response.json({ ok: true });
    }
    // Daily Books backups kept here (a different worker and storage from Books itself): last 30, in 1 MB pieces.
    if (url.pathname === '/bk/put') {
      const parts = Math.max(1, Math.ceil(body.data.length / 1000000));
      for (let i = 0; i < parts; i++) await s.put(`bk:${body.date}:${i}`, body.data.slice(i * 1000000, (i + 1) * 1000000));
      await s.put(`bkmeta:${body.date}`, { parts, size: body.data.length, at: Date.now() });
      const dates = [...(await s.list({ prefix: 'bkmeta:' })).keys()].map(k => k.slice(7)).sort();
      for (const d of dates.slice(0, -30)) { const m = await s.get(`bkmeta:${d}`); for (let i = 0; i < m.parts; i++) await s.delete(`bk:${d}:${i}`); await s.delete(`bkmeta:${d}`); }
      return Response.json({ ok: true });
    }
    if (url.pathname === '/bk/list') return Response.json([...(await s.list({ prefix: 'bkmeta:' })).entries()].map(([k, v]) => ({ date: k.slice(7), size: v.size, at: v.at })).sort((a, b) => b.date.localeCompare(a.date)));
    if (url.pathname === '/bk/get') {
      const m = await s.get(`bkmeta:${body.date}`); if (!m) return Response.json({ data: null });
      let data = ''; for (let i = 0; i < m.parts; i++) data += await s.get(`bk:${body.date}:${i}`);
      return Response.json({ data });
    }
    if (url.pathname === '/ok') { await s.delete(`fail:${body.who}`); return Response.json({ ok: true }); }
    return new Response('?', { status: 404 });
  }
}
const vaultOf = (env) => env.VAULT.get(env.VAULT.idFromName('owner'));
const vget = async (v, path, init) => (await v.fetch(`https://vault${path}`, init)).json();
const vpost = (v, path, body) => vget(v, path, { method: 'POST', body: JSON.stringify(body) });

// ---------- login ----------
const loginForm = (msg = '', enrol = null) => bare('Log in', `${msg ? `<p class="msg">${esc(msg)}</p>` : ''}
${enrol ? `<p><b>First login: set up your authenticator.</b> In an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy) add a new account by <i>entering a setup key</i>, then type the 6-digit code it shows.</p>
<p>Setup key:<br><code>${esc(enrol)}</code></p>` : ''}
<form method="post" action="/login" autocomplete="off">
<label>Passphrase<input type="password" name="password" autocomplete="current-password" required autofocus></label>
<label>6-digit code<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"${enrol ? ' required' : ''}></label>
<button class="go">Log in</button></form>`);

async function handleLogin(request, env) {
  const vault = vaultOf(env), who = await sha256(request.headers.get('CF-Connecting-IP') || 'unknown');
  if ((await vpost(vault, '/check', { who })).locked) return html(loginForm('Too many tries. Wait 15 minutes and try again.'), 429);
  const form = await request.formData().catch(() => null);
  const password = form && String(form.get('password') || ''), code = form ? String(form.get('code') || '').trim() : '';
  const fail = async (msg) => { await vpost(vault, '/fail', { who }); return html(loginForm(msg), 401); };
  if (!env.OWNER_PASSWORD || !(await same(password, env.OWNER_PASSWORD))) return fail('That did not work.');
  let rec = await vget(vault, '/totp');
  if (!rec) { // first login: make a secret, keep it pending until a valid code proves the authenticator works
    rec = { secret: b32encode(crypto.getRandomValues(new Uint8Array(20))), active: false, lastStep: -1 };
    await vget(vault, '/totp', { method: 'PUT', body: JSON.stringify(rec) });
  }
  if (!code && !rec.active) return html(loginForm('', rec.secret));
  const step = await codeStep(rec.secret, code);
  if (step < 0 || step <= rec.lastStep) return rec.active ? fail('That did not work.') : (await vpost(vault, '/fail', { who }), html(loginForm('That code was not right. Try the next one.', rec.secret), 401));
  rec = { ...rec, active: true, lastStep: step };
  await vget(vault, '/totp', { method: 'PUT', body: JSON.stringify(rec) });
  await vpost(vault, '/ok', { who });
  return redirect('/', { 'Set-Cookie': cookie(await makeSession(env, rec), SESSION_SECONDS) });
}

// ---------- data ----------
async function books(env, path, init = {}) {
  return env.BOOKS.fetch(`https://books${path}`, { ...init, headers: { 'X-Key': env.ADMIN_KEY || '', ...(init.headers || {}) } });
}
const money = (n) => '£' + (Number(n) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
async function stripe(env, path) {
  if (!env.STRIPE_KEY) return { off: true };
  try {
    const r = await fetch(`https://api.stripe.com/v1${path}`, { headers: { Authorization: `Bearer ${env.STRIPE_KEY}` } });
    const d = await r.json();
    return r.ok ? d : { error: (d.error && d.error.message) || `Stripe ${r.status}` };
  } catch (e) { return { error: 'Could not reach Stripe' }; }
}
async function overview(env) {
  const [hRes, subs, charges] = await Promise.all([
    books(env, '/health').then(r => r.ok ? r.json() : { error: `Books answered ${r.status}` }).catch(() => ({ error: 'Could not reach Books' })),
    stripe(env, '/subscriptions?status=all&limit=100&expand[]=data.customer'),
    stripe(env, '/charges?limit=8'),
  ]);
  return { health: hRes, subs, charges };
}
function mrr(subs) {
  let pence = 0;
  for (const s of subs.data || []) if (['active', 'past_due'].includes(s.status)) for (const i of (s.items && s.items.data) || []) {
    const p = i.price || {}; if (p.recurring && p.recurring.interval === 'month') pence += (p.unit_amount || 0) * (i.quantity || 1);
    if (p.recurring && p.recurring.interval === 'year') pence += Math.round((p.unit_amount || 0) * (i.quantity || 1) / 12);
  }
  return pence / 100;
}

const stripeNote = (x) => x.off ? '<p class="mute">Stripe is not connected yet. Add a restricted read-only Stripe key as STRIPE_KEY (see Docs: Connect Stripe).</p>' : x.error ? `<p class="bad">${esc(x.error)}</p>` : '';

async function pageOverview(env) {
  const { health, subs, charges } = await overview(env);
  const clients = health.clients || [];
  const bl = await vget(vaultOf(env), '/bk/list'), stale = !bl[0] || Date.now() - bl[0].at > 36 * 3600000;
  const backupLine = stale ? '<div class="card"><p class="bad">No recent Books backup. Open Backups.</p></div>' : '';
  const bad = clients.filter(c => !c.ok), late = clients.reduce((n, c) => n + (c.late || 0), 0);
  const active = (subs.data || []).filter(s => s.status === 'active').length, pastDue = (subs.data || []).filter(s => ['past_due', 'unpaid'].includes(s.status));
  return shell('Overview', `<h1>Overview</h1>
<div class="grid">
<div class="card stat"><b>${clients.length}</b><span>Books clients connected</span></div>
<div class="card stat"><b class="${bad.length ? 'bad' : 'ok'}">${bad.length}</b><span>Books connections needing attention</span></div>
<div class="card stat"><b>${subs.data ? active : '–'}</b><span>Active subscriptions</span></div>
<div class="card stat"><b>${subs.data ? money(mrr(subs)) : '–'}</b><span>Monthly recurring (Stripe)</span></div>
<div class="card stat"><b class="${pastDue.length ? 'bad' : ''}">${subs.data ? pastDue.length : '–'}</b><span>Failed or overdue payments</span></div>
<div class="card stat"><b>${late}</b><span>Late invoices across Books clients</span></div></div>
${health.error ? `<div class="card"><p class="bad">${esc(health.error)}</p></div>` : ''}
${backupLine}
${bad.length ? `<div class="card"><h2>Needs attention</h2><table><tr><th>Client</th><th>Problem</th></tr>${bad.map(c => `<tr><td>${esc(c.name)}</td><td class="bad">${esc(c.problem || 'Not working')}</td></tr>`).join('')}</table></div>` : ''}
${pastDue.length ? `<div class="card"><h2>Payments to chase</h2><table><tr><th>Customer</th><th>Status</th></tr>${pastDue.map(s => `<tr><td>${esc((s.customer && (s.customer.name || s.customer.email)) || s.customer)}</td><td class="bad">${esc(s.status)}</td></tr>`).join('')}</table></div>` : ''}
<div class="card"><h2>Recent payments</h2>${stripeNote(charges)}${charges.data ? `<table><tr><th>When</th><th>Who</th><th>Amount</th><th></th></tr>${charges.data.map(c => `<tr><td>${esc(new Date(c.created * 1000).toLocaleDateString('en-GB'))}</td><td>${esc((c.billing_details && (c.billing_details.name || c.billing_details.email)) || '')}</td><td>${money(c.amount / 100)}</td><td class="${c.paid ? 'ok' : 'bad'}">${c.paid ? 'paid' : esc(c.failure_message || 'failed')}</td></tr>`).join('')}</table>` : ''}</div>`, '/');
}
async function pageCustomers(env) {
  const { health, subs } = await overview(env);
  const clients = health.clients || [];
  return shell('Customers', `<h1>Customers</h1>
<div class="card"><h2>Books clients (from QuickBooks connections)</h2>${health.error ? `<p class="bad">${esc(health.error)}</p>` : ''}
<table><tr><th>Client</th><th>Status</th><th>Filed this week</th><th>To tidy</th><th>Late invoices</th><th>App last used</th></tr>
${clients.map(c => `<tr><td>${esc(c.name)}</td><td class="${c.ok ? 'ok' : 'bad'}">${c.ok ? 'connected' : esc(c.problem || 'problem')}</td><td>${esc(c.filed ?? '–')}</td><td>${esc(c.toTidy ?? '–')}</td><td>${esc(c.late ?? '–')}</td><td>${c.seenDays == null ? '–' : c.seenDays === 0 ? 'today' : `${esc(c.seenDays)}d ago`}</td></tr>`).join('') || '<tr><td colspan="6" class="mute">None yet</td></tr>'}</table>
<p><a href="/books-admin">Open the Books admin page</a> to invite, change settings, log out or end a client.</p></div>
<div class="card"><h2>Subscriptions (Stripe)</h2>${stripeNote(subs)}${subs.data ? `<table><tr><th>Customer</th><th>Plan</th><th>Status</th><th>Per month</th><th>Since</th></tr>${subs.data.map(s => {
    const items = (s.items && s.items.data) || [], p = (items[0] && items[0].price) || {}, cust = s.customer && typeof s.customer === 'object' ? s.customer : {};
    return `<tr><td>${esc(cust.name || cust.email || s.customer)}</td><td>${esc(p.nickname || (p.product && String(p.product)) || '')}</td><td class="${s.status === 'active' ? 'ok' : 'bad'}">${esc(s.status)}${s.cancel_at_period_end ? ' (cancelling)' : ''}</td><td>${money((p.unit_amount || 0) / 100)}</td><td>${esc(new Date(s.created * 1000).toLocaleDateString('en-GB'))}</td></tr>`;
  }).join('')}</table>` : ''}</div>`, '/customers');
}
const linkList = (items) => `<div class="links">${items.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.name)}<small>${esc(l.note || '')}</small></a>`).join('')}</div>`;
const pageProducts = () => shell('Products', `<h1>Products</h1>
<div class="card"><h2>Books (QuickBooks bookkeeping for trades)</h2>${linkList([{ name: 'Books admin (inside HQ)', url: '/books-admin', note: 'Invite clients, change settings, log out, end a client. No key needed here.' }, ...LINKS.books])}</div>
<div class="card"><h2>Receptionist (Mia)</h2>${linkList(LINKS.receptionist)}</div>
<div class="card"><h2>Website</h2>${linkList(LINKS.website)}</div>`, '/products');
const pageSettings = () => shell('Settings', `<h1>Settings and links</h1>
<div class="card"><h2>Business accounts</h2>${linkList(LINKS.accounts)}</div>
<div class="card"><h2>Where every credential lives</h2><p class="mute">Names and locations only. Values are never shown here and are never kept in the code.</p>
<table><tr><th>What</th><th>Where it lives</th><th>Used for</th><th>If lost</th></tr>${REGISTER.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.where)}</td><td>${esc(r.use)}</td><td>${esc(r.recover)}</td></tr>`).join('')}</table></div>`, '/settings');

// ---------- docs ----------
function md(src) {
  const lines = src.split('\n'); let out = '', list = false, code = false;
  const inline = (t) => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  for (const line of lines) {
    if (line.startsWith('```')) { out += code ? '</pre>' : (list ? '</ul>' : '') + '<pre>'; list = list && code; code = !code; continue; }
    if (code) { out += esc(line) + '\n'; continue; }
    const li = /^[-*] (.*)/.exec(line) || /^\d+\. (.*)/.exec(line);
    if (li) { if (!list) { out += '<ul>'; list = true; } out += `<li>${inline(li[1])}</li>`; continue; }
    if (list) { out += '</ul>'; list = false; }
    const h = /^(#{1,3}) (.*)/.exec(line);
    if (h) out += `<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`; else if (line.trim()) out += `<p>${inline(line)}</p>`;
  }
  return out + (list ? '</ul>' : '') + (code ? '</pre>' : '');
}
const pageDocs = (name) => {
  const doc = DOCS.find(d => d.id === name);
  if (name && !doc) return null;
  return shell(doc ? doc.title : 'Docs', doc ? `<div class="card">${md(doc.body)}</div><p><a href="/docs">All documents</a></p>` : `<h1>Operating instructions</h1><div class="card links">${DOCS.map(d => `<a href="/docs/${esc(d.id)}">${esc(d.title)}<small>${esc(d.about)}</small></a>`).join('')}</div>`, '/docs');
};
async function pageBackups(env) {
  const list = await vget(vaultOf(env), '/bk/list');
  const last = list[0], hours = last ? (Date.now() - last.at) / 3600000 : null;
  const status = !last ? '<p class="bad">No backup yet. The first one is made at 06:30 each morning.</p>' : hours > 36 ? `<p class="bad">The last backup is ${Math.floor(hours)} hours old. Something is wrong: open Docs, Backups and restore.</p>` : `<p class="ok">Last backup: ${esc(last.date)} (${Math.max(1, Math.round(last.size / 1024))} KB). Kept for 30 days.</p>`;
  const r2 = env.BACKUPS ? (await env.BACKUPS.list({ prefix: 'books/' })).objects.length : null;
  return shell('Backups', `<h1>Backups</h1><div class="card"><h2>Daily Books backups</h2>${status}
<table><tr><th>Day</th><th>Size</th><th></th></tr>${list.map(b => `<tr><td>${esc(b.date)}</td><td>${Math.max(1, Math.round(b.size / 1024))} KB</td><td><form method="post" action="/backups/download"><input type="hidden" name="date" value="${esc(b.date)}"><button class="go" style="width:auto;padding:6px 12px">Download</button></form></td></tr>`).join('') || '<tr><td colspan="3" class="mute">None yet</td></tr>'}</table></div>
<div class="card"><h2>Take one now</h2><p>Everything Books holds that cannot be recreated (clients, mileage, change log, app links). Connection tokens are never included: after a restore each client reconnects.</p><form method="post" action="/backups/download"><button class="go" style="width:auto">Download a fresh backup file</button></form>${r2 != null ? `<p class="mute">Also stored in the backup bucket: ${r2} files.</p>` : ''}</div>`, '/backups');
}

// ---------- Books admin, behind the HQ session ----------
const BA_ALLOWED = [['GET', /^\/(health|companies|backup)$/], ['GET', /^\/(client|monthly|precheck|export)\/\d+$/], ['PUT', /^\/client\/\d+$/], ['POST', /^\/(invite|logout\/\d+|revoke\/\d+)$/]];
async function booksAdmin(env) {
  const res = await env.BOOKS.fetch('https://books/admin');
  let page = await res.text();
  const nonce = (/<script nonce="([^"]+)"/.exec(page) || [])[1];
  if (!res.ok || !nonce) return html(shell('Books admin', '<div class="card"><p class="bad">The Books admin page could not be loaded.</p></div>', '/books-admin'), 502);
  page = page.replace('<head>', '<head><meta name="base" content="/ba"><meta name="prekey" content="1">');
  return html(page, 200, { 'X-Hq-Csp': `default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; script-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` });
}
async function booksProxy(request, env, url) {
  const path = url.pathname.slice(3) || '/';
  if (!BA_ALLOWED.some(([m, re]) => m === request.method && re.test(path))) return new Response('Not allowed here', { status: 403 });
  const init = { method: request.method, headers: { 'Content-Type': 'application/json' } };
  if (!['GET', 'HEAD'].includes(request.method)) init.body = await request.text();
  const res = await books(env, path + url.search, init);
  return new Response(res.body, { status: res.status, headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' } });
}

// ---------- daily backup of Books into the Vault ----------
export async function backupDaily(env) {
  const res = await books(env, '/backup');
  if (!res.ok) throw new Error(`Books backup answered ${res.status}`);
  const data = await res.text(); JSON.parse(data); // never keep something that is not a backup
  await vpost(vaultOf(env), '/bk/put', { date: new Date().toISOString().slice(0, 10), data });
}

// ---------- routes ----------
export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(backupDaily(env)); },
  async fetch(request, env) {
    const url = new URL(request.url), vault = vaultOf(env);
    const respond = (res, opts) => secure(res, opts);
    if (!env.OWNER_PASSWORD) return respond(html(bare('Not set up', '<p>HQ is switched off until the owner passphrase is set in Cloudflare (see the setup notes).</p>'), 503));
    await vpost(vault, '/reset', { value: String(env.RESET_TOTP || '') });
    if (url.pathname === '/login') {
      if (request.method === 'POST') return respond(await handleLogin(request, env));
      return respond(html(loginForm()));
    }
    const rec = await vget(vault, '/totp');
    const authed = await validSession(env, rec, request.headers.get('Cookie'));
    if (url.pathname === '/logout' && request.method === 'POST') return respond(redirect('/login', { 'Set-Cookie': cookie('', 0) }));
    if (!authed) return respond(url.pathname.startsWith('/ba/') ? new Response('Log in again', { status: 401 }) : redirect('/login'));
    if (url.pathname.startsWith('/ba/')) return respond(await booksProxy(request, env, url));
    if (request.method === 'POST' && url.pathname === '/backups/download') {
      const date = String((await request.formData().catch(() => new FormData())).get('date') || '');
      let body, name = new Date().toISOString().slice(0, 10), status = 200;
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) { const got = await vpost(vault, '/bk/get', { date }); if (got.data == null) return respond(new Response('No such backup', { status: 404 })); body = got.data; name = date; }
      else { const res = await books(env, '/backup'); body = res.body; status = res.status; }
      return respond(new Response(body, { status, headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="books-backup-${name}.json"` } }));
    }
    if (request.method !== 'GET') return respond(new Response('Not found', { status: 404 }));
    if (url.pathname === '/books-admin') { const r = await booksAdmin(env); const csp = r.headers.get('X-Hq-Csp'); r.headers.delete('X-Hq-Csp'); return respond(r, csp ? { csp } : {}); }
    const d = url.pathname.match(/^\/docs(?:\/([\w-]+))?$/);
    if (d) { const p = pageDocs(d[1]); return respond(p ? html(p) : html(shell('Not found', '<div class="card">No such document.</div>'), 404)); }
    const pages = { '/': pageOverview, '/customers': pageCustomers, '/products': pageProducts, '/settings': pageSettings, '/backups': pageBackups };
    if (pages[url.pathname]) return respond(html(await pages[url.pathname](env)));
    return respond(html(shell('Not found', '<div class="card">Nothing here.</div>'), 404));
  },
};
