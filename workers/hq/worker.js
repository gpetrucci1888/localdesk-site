// Localdesk Owner HQ: one private place for the owner to run the business, independent of any AI session.
//
// Login: the owner's passphrase (secret OWNER_PASSWORD, typed into Cloudflare by the owner) plus a 6-digit code from an
// authenticator app (enrolled on first login, stored in the Vault). No accounts, no emails, no third party in the login.
// Fails closed: with no OWNER_PASSWORD set, nothing can log in. Pages carry no scripts at all.
//
// Pages: / (home), /customers, /payments, /books (+ /books/new, /books/client/<realm>), /receptionist, /backups, /settings,
// /docs (help), /more. Public: /login and the brand font. Everything else needs the login.
//
// Bindings: BOOKS (service, the books worker), VAULT (Durable Object, class Vault). Secrets: OWNER_PASSWORD, ADMIN_KEY (the Books
// admin key, so the owner never handles it), optional STRIPE_KEY (RESTRICTED read-only). Plain: optional RESET_TOTP.
import { LINKS, REGISTER, DOCS } from './content.js';
import { FONT_B64 } from './font.js';
import { esc, shell, bare, pill, banner, btn, tile, bigLink, item, crumb, todo, ICON } from './ui.js';
import { pageContent, seedPosts, move as movePost, edit as editPost, add as addPost, plan as planPost, dueToday, missingSeeds, refreshDrafts, STATUSES } from './posts.js';
import { b64u, newChallenge, verifyRegistration, verifyAssertion, loginScript } from './passkey.js';
import { evaluate as stripeEval, EXPECTED as STRIPE_EXPECTED } from './stripecheck.js';
import { setupDue, trialsEnding, zoomsSoon, appFor, pageLeads, pageLead, newLeadForm, progress, progressCard, isDue, CHECKLISTS, priceConfig, subscriptionFacts } from './leads.js';

const enc = new TextEncoder();
const SESSION_SECONDS = 12 * 3600;            // this visit only
const REMEMBER_SECONDS = 90 * 24 * 3600;      // "remember this device" (the default): about 3 months

// ---------- small helpers ----------
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
async function sessionKey(env, vault, epoch = 0) {
  return enc.encode(await sha256(`${env.OWNER_PASSWORD}|${(vault && vault.secret) || 'none'}|${epoch}|hq-session`));
}
async function makeSession(env, vault, epoch, seconds) {
  const exp = Math.floor(Date.now() / 1000) + seconds, nonce = hex(crypto.getRandomValues(new Uint8Array(12)));
  return `${exp}.${nonce}.${hex(await hmac(await sessionKey(env, vault, epoch), `${exp}.${nonce}`))}`;
}
async function validSession(env, vault, epoch, cookie) {
  const m = /(?:^|;\s*)hq=(\d+)\.([0-9a-f]+)\.([0-9a-f]+)/.exec(cookie || '');
  if (!m || !vault || !vault.active || Number(m[1]) < Date.now() / 1000) return false;
  return same(m[3], hex(await hmac(await sessionKey(env, vault, epoch), `${m[1]}.${m[2]}`)));
}
const cookie = (value, maxAge) => `hq=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;


// ---------- responses ----------
function secure(res, { csp } = {}) {
  const h = new Headers(res.headers);
  h.set('X-Content-Type-Options', 'nosniff'); h.set('Referrer-Policy', 'no-referrer');
  h.set('Strict-Transport-Security', 'max-age=31536000'); h.set('Cache-Control', 'no-store');
  h.set('X-Robots-Tag', 'noindex, nofollow'); h.set('X-Frame-Options', 'DENY');
  if (/text\/html/.test(h.get('Content-Type') || '')) h.set('Content-Security-Policy', csp || "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  return new Response(res.body, { status: res.status, headers: h });
}
const html = (body, status = 200, extra = {}) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...extra } });
const redirect = (to, extra = {}) => new Response(null, { status: 303, headers: { Location: to, ...extra } });
let fontBytes;
const fontResponse = () => {
  fontBytes = fontBytes || Uint8Array.from(atob(FONT_B64), c => c.charCodeAt(0));
  return new Response(fontBytes, { headers: { 'Content-Type': 'font/woff', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
};

// ---------- the Vault (login state: authenticator secret, lockout counters, backups) ----------
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
    if (url.pathname === '/posts') { // the content approval queue
      if (body.op === 'save') { await s.put('posts', body.posts); return Response.json({ ok: true }); }
      return Response.json((await s.get('posts')) || null);
    }
    if (url.pathname === '/pk') { // passkeys: devices, and one-time challenges
      const now = Date.now();
      if (body.op === 'list') return Response.json((await s.get('pk')) || []);
      if (body.op === 'add') { const l = ((await s.get('pk')) || []).filter(k => k.id !== body.key.id); l.push(body.key); await s.put('pk', l.slice(-10)); return Response.json({ ok: true }); }
      if (body.op === 'remove') { await s.put('pk', ((await s.get('pk')) || []).filter(k => k.id !== body.id)); return Response.json({ ok: true }); }
      if (body.op === 'count') { await s.put('pk', ((await s.get('pk')) || []).map(k => k.id === body.id ? { ...k, signCount: body.count, lastUsed: now } : k)); return Response.json({ ok: true }); }
      if (body.op === 'challenge') { await s.put(`pkch:${body.value}`, { kind: body.kind, exp: now + 5 * 60000 }); return Response.json({ ok: true }); }
      if (body.op === 'use') { const c = await s.get(`pkch:${body.value}`); await s.delete(`pkch:${body.value}`); return Response.json({ ok: !!c && c.kind === body.kind && c.exp > now }); }
    }
    if (url.pathname === '/reset') {
      if (body.value !== undefined && (await s.get('resetSeen')) !== body.value) { await s.put('resetSeen', body.value); await s.delete('totp'); }
      return Response.json({ ok: true });
    }
    if (url.pathname === '/check') { // is this visitor locked out?
      const f = (await s.get(`lock2:${body.who}`)) || { n: 0, until: 0 }, g = (await s.get('lock2:all')) || { n: 0, until: 0 };
      return Response.json({ locked: Math.max(f.until, g.until) > Date.now() });
    }
    if (url.pathname === '/fail') {
      for (const [key, limit, ms] of [[`lock2:${body.who}`, 5, 15 * 60000], ['lock2:all', 200, 60 * 60000]]) {
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
    if (url.pathname === '/epoch') { if (request.method === 'POST') await s.put('epoch', ((await s.get('epoch')) || 0) + 1); return Response.json({ n: (await s.get('epoch')) || 0 }); }
    if (url.pathname === '/cache') return Response.json((await s.get(`cache:${body.key}`)) || null);
    if (url.pathname === '/cache/set') { await s.put(`cache:${body.key}`, { at: Date.now(), data: body.data }); return Response.json({ ok: true }); }
    if (url.pathname === '/hc') { if (request.method === 'POST') await s.put('hc', body); return Response.json((await s.get('hc')) || null); }
    if (url.pathname === '/ok') { await s.delete(`lock2:${body.who}`); return Response.json({ ok: true }); }
    return new Response('?', { status: 404 });
  }
}
const vaultOf = (env) => env.VAULT.get(env.VAULT.idFromName('owner'));
const vget = async (v, path, init) => (await v.fetch(`https://vault${path}`, init)).json();
const vpost = (v, path, body) => vget(v, path, { method: 'POST', body: JSON.stringify(body) });


// ---------- login ----------
const loginPage = (msg = '', enrol = null, nonce = '') => bare('Log in', `<h1>${enrol ? 'First time here' : 'Welcome back'}</h1>
<p class="lead">${enrol ? 'Set up your phone app once. After this, login takes seconds.' : 'Your private control room for Localdesk.'}</p>
${msg ? `<div class="banner bad" style="margin-top:14px">${ICON.alert}<div><p>${msg}</p></div></div>` : ''}
${enrol ? `<ol class="steps" style="margin-top:16px"><li>Open your authenticator app (Google Authenticator) and tap <b>+</b>, then <b>Enter a setup key</b>.</li><li>Name it <b>Localdesk HQ</b>, type this key, and choose <b>Time based</b>:</li></ol><p class="key">${esc(enrol)}</p><p class="help">The app then shows a 6-digit code. Type it below, together with your passphrase.</p>` : ''}
${enrol ? '' : `<button type="button" id="pk-login" class="btn block" hidden style="margin-top:14px">Log in with Face ID or fingerprint</button><p id="pk-msg" class="help" hidden role="alert"></p>`}
<form method="post" action="/login">
<label for="pw">Your passphrase</label><input id="pw" type="password" name="password" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" required${enrol ? ' autofocus' : ''}>
<label style="display:flex;align-items:center;gap:12px;font-weight:600;margin-top:10px"><input type="checkbox" id="pw-show" style="width:26px;height:26px;min-height:0;flex:none">Show what I type</label>
<label for="cd">6-digit code from your phone app${enrol ? '' : '<small>Leave blank only the very first time.</small>'}</label><input id="cd" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code"${enrol ? ' required' : ''}>
<label style="display:flex;align-items:center;gap:12px;font-weight:600;margin-top:16px"><input type="checkbox" name="remember" value="1" checked style="width:26px;height:26px;min-height:0;flex:none">Keep me logged in on this device for 3 months</label>
<button class="btn block" style="margin-top:14px">Log in</button></form>
${nonce ? `<script nonce="${nonce}">document.getElementById('pw-show').addEventListener('change',function(e){document.getElementById('pw').type=e.target.checked?'text':'password'})</script>${loginScript(nonce)}` : ''}`);
const pageCsp = (nonce) => `default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:; form-action 'self'; connect-src 'self'; script-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'`;
const WRONG = 'That didn\'t work. Check your passphrase, and that the 6-digit code is the current one (it changes every 30 seconds).';

async function handleLogin(request, env, nonce) {
  const vault = vaultOf(env), who = await sha256(request.headers.get('CF-Connecting-IP') || 'unknown');
  if ((await vpost(vault, '/check', { who })).locked) return html(loginPage('Too many wrong tries from this device. For your security, wait 15 minutes and try again.', null, nonce), 429);
  const form = await request.formData().catch(() => null);
  const password = form && String(form.get('password') || ''), code = form ? String(form.get('code') || '').trim() : '';
  const fail = async (msg) => { await vpost(vault, '/fail', { who }); return html(loginPage(msg, null, nonce), 401); };
  if (!env.OWNER_PASSWORD || !(await same(password, env.OWNER_PASSWORD) || await same(password.trim(), env.OWNER_PASSWORD))) return fail(WRONG); // phone keyboards add a stray space
  let rec = await vget(vault, '/totp');
  if (!rec) { // first login: make a secret, keep it pending until a valid code proves the authenticator works
    rec = { secret: b32encode(crypto.getRandomValues(new Uint8Array(20))), active: false, lastStep: -1 };
    await vget(vault, '/totp', { method: 'PUT', body: JSON.stringify(rec) });
  }
  if (!code && !rec.active) return html(loginPage('', rec.secret, nonce));
  const step = await codeStep(rec.secret, code);
  if (step < 0 || step <= rec.lastStep) return rec.active ? fail(WRONG) : html(loginPage('That code wasn\'t right. Wait for the app to show a new one and try again.', rec.secret, nonce), 401);
  rec = { ...rec, active: true, lastStep: step };
  await vget(vault, '/totp', { method: 'PUT', body: JSON.stringify(rec) });
  await vpost(vault, '/ok', { who });
  const seconds = form.get('remember') ? REMEMBER_SECONDS : SESSION_SECONDS;
  return redirect('/', { 'Set-Cookie': cookie(await makeSession(env, rec, (await vget(vault, '/epoch')).n, seconds), seconds) });
}

// ---------- data ----------
async function books(env, path, init = {}) {
  return env.BOOKS.fetch(`https://books${path}`, { ...init, headers: { 'X-Key': env.ADMIN_KEY || '', ...(init.headers || {}) } });
}
const money = (n) => '£' + (Number(n) || 0).toLocaleString('en-GB', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
const day = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });
async function stripe(env, path) {
  if (!env.STRIPE_KEY) return { off: true };
  const v = vaultOf(env), ck = `sc:${path}`, hit = await vget(v, '/cache', { method: 'POST', body: JSON.stringify({ key: ck }) });
  if (hit && Date.now() - hit.at < 300000) return hit.data;
  const fresh = await stripeFetch(env, path);
  if (!fresh.error) await vpost(v, '/cache/set', { key: ck, data: fresh });
  return fresh;
}
async function stripeFetch(env, path) {
  try {
    const r = await fetch(`https://api.stripe.com/v1${path}`, { headers: { Authorization: `Bearer ${env.STRIPE_KEY}` } });
    const d = await r.json();
    return r.ok ? d : { error: (d.error && d.error.message) || `Stripe ${r.status}` };
  } catch (e) { return { error: 'Could not reach Stripe' }; }
}
// QuickBooks limits how often it can be asked, and /health asks it for every client, so HQ keeps the last answer for 10 minutes.
async function cachedHealth(env) {
  const v = vaultOf(env), hit = await vget(v, '/hc');
  if (hit && hit.at && Date.now() - hit.at < 600000) return hit.data;
  const data = await books(env, '/health').then(r => r.ok ? r.json() : { error: true }).catch(() => ({ error: true }));
  if (!data.error) await vpost(v, '/hc', { at: Date.now(), data });
  return data;
}
// The owner lists the monthly price ids in Cloudflare on the books worker. HQ reads them from there too, so they are set once. The hq
// variables STRIPE_PRICES_RECEPTIONIST and STRIPE_PRICES_BOOKS still work and are added on top.
async function priceCfg(env, status) {
  const cfg = priceConfig(env);
  try {
    const st = status !== undefined ? status : await books(env, '/stripe/status').then(r => r.ok ? r.json() : null);
    if (st && st.prices) { if (/^price_\w+$/.test(st.prices.receptionist || '')) cfg.receptionist.add(st.prices.receptionist); if (/^price_\w+$/.test(st.prices.books || '')) cfg.books.add(st.prices.books); }
  } catch { /* the hq variables still apply */ }
  return cfg;
}
async function load(env) {
  const [health, subs, charges, bl] = await Promise.all([
    cachedHealth(env),
    stripe(env, '/subscriptions?status=all&limit=100&expand[]=data.customer&expand[]=data.items.data.price.product&expand[]=data.latest_invoice'),
    stripe(env, '/charges?limit=10'),
    vget(vaultOf(env), '/bk/list'),
  ]);
  const clients = health.clients || [];
  const cfg = await priceCfg(env);
  const subList = (subs.data || []).map(s => {
    const cust = s.customer && typeof s.customer === 'object' ? s.customer : {}, f = subscriptionFacts(s, cfg);
    return { id: s.id, who: cust.name || cust.email || 'Customer', email: cust.email || '', plan: f.plan, per: f.per, status: s.status, cancelling: Boolean(s.cancel_at_period_end), since: s.created * 1000, priceId: f.priceId, product: f.product, isBooks: f.product === 'books', invoicePaid: s.latest_invoice && typeof s.latest_invoice === 'object' ? s.latest_invoice.status === 'paid' : null };
  });
  const failed = subList.filter(s => ['past_due', 'unpaid'].includes(s.status));
  const pr = progress(subList), live = pr.paid;   // paying = classified, active, costs money, latest invoice paid. Trials, failed and unmatched ones are not counted
  const income = live.reduce((n, s) => n + s.per, 0);
  const last = bl[0], stale = !last || Date.now() - last.at > 36 * 3600000;
  return { health, clients, subs, subList, failed, live, pr, income, charges, backups: bl, stale, booksProblems: clients.filter(c => !c.ok) };
}
const STATUS = { active: ['ok', 'Paying'], trialing: ['ok', 'On trial'], past_due: ['bad', 'Payment failed'], unpaid: ['bad', 'Payment failed'], canceled: ['mute', 'Cancelled'], incomplete: ['warn', 'Not finished'], incomplete_expired: ['mute', 'Expired'], paused: ['warn', 'Paused'] };
const statusPill = (s) => { const [k, t] = s.cancelling && s.status === 'active' ? ['warn', 'Cancelling'] : STATUS[s.status] || ['mute', s.status]; return pill(k, t); };
function plainProblem(p) {
  const t = String(p || '');
  if (/disconnect/i.test(t)) return 'They disconnected Books in QuickBooks.';
  if (/401|403|invalid|expired|token|grant/i.test(t)) return 'Books lost its link to their QuickBooks.';
  return 'Books can\'t reach their QuickBooks right now.';
}
const FIX = 'Send them a new connect link: open their page and choose "Make a new connect link".';
const stripeSetup = () => banner('info', 'Stripe isn\'t connected yet', 'Connect it once and your customers, subscriptions and payments appear here. It takes about 3 minutes and Stripe only gets to show, never change, anything.', btn('/docs/stripe', 'Show me how', 'dark'));
const stripeError = () => banner('warn', 'Couldn\'t get your Stripe figures just now', 'This usually fixes itself. Try again in a minute. If it keeps happening, the Stripe key may have been deleted: open Help and choose "Connect Stripe".', btn('/payments', 'Try again', 'line'));
const booksError = () => banner('warn', 'Couldn\'t reach Books just now', 'This usually fixes itself. Try again in a minute. If it keeps happening, open Help and choose "If something goes wrong".', btn('/books', 'Try again', 'line'));
const dueGreeting = () => { const h = Number(new Date().toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/London' })); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

// ---------- leads (the sales pipeline lives in the Books connector; HQ only shows and edits it) ----------
const getLeads = (env) => books(env, '/leads').then(async r => { const j = r.ok ? await r.json() : null; return Array.isArray(j) ? j : null; }).catch(() => null);
const getLead = (env, id) => books(env, `/leads/${encodeURIComponent(id)}`).then(r => r.ok ? r.json() : null).catch(() => null);
const putLead = (env, id, patch) => books(env, `/leads/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
const LEAD_FLASH = { exists: ['info', 'That number was already in HQ, so this is the lead you already had. Nothing was changed.'], saved: ['ok', 'Saved.'], added: ['ok', 'Lead added. Nothing was sent to them.'], deleted: ['ok', 'Deleted.'] };
const leadFlash = (url) => { const f = LEAD_FLASH[url.searchParams.get('done')]; return f ? banner(f[0], f[1]) : ''; };
const leadsDown = () => shell('Leads', `<h1>Leads</h1>${booksError()}`, '/leads');
const loadPosts = async (vault) => { let p = await vpost(vault, '/posts', {}); let changed = false; if (!Array.isArray(p)) { p = seedPosts(); changed = true; } const more = missingSeeds(p); if (more.length) { p = [...p, ...more]; changed = true; } if (refreshDrafts(p)) changed = true; if (changed) await vpost(vault, '/posts', { op: 'save', posts: p }); return p; };
async function contentAction(request, env, vault, id, action) {
  const posts = await loadPosts(vault); let r;
  const form = async () => Object.fromEntries([...(await request.formData().catch(() => new FormData())).entries()].map(([k, x]) => [k, String(x)]));
  if (id === 'new') { r = addPost(posts, await form()); if (r.error) return html(pageContent(posts, await foundingCount(env), banner('bad', r.error)), 400); await vpost(vault, '/posts', { op: 'save', posts }); return redirect(`/content#${encodeURIComponent(r.id)}`); }
  if (action === 'plan') r = planPost(posts, id, await form());
  else if (action === 'save') r = editPost(posts, id, String((await request.formData().catch(() => new FormData())).get('text') || ''));
  else if (STATUSES.includes(action)) r = movePost(posts, id, action, await foundingCount(env));
  else return html(shell('Not found', banner('warn', 'Nothing here', '', btn('/content', 'Back to Content', 'dark')), '/content'), 404);
  if (r.error) return html(pageContent(posts, await foundingCount(env), banner('bad', r.error)), 400);
  await vpost(vault, '/posts', { op: 'save', posts });
  return redirect(`/content#${encodeURIComponent(id)}`);
}
// Founding places are reserved in the Books store (atomic, one at a time). null means it could not be checked.
const foundingCount = (env) => books(env, '/founding').then(async r => { const j = r.ok ? await r.json() : null; return j && Number.isInteger(j.used) ? j.used : null; }).catch(() => null);
async function pageLeadsList(env, url) {
  const [leads, d, founding] = await Promise.all([getLeads(env), load(env), foundingCount(env)]);
  return leads ? pageLeads(leads, d.pr, !d.subs.off && !d.subs.error, leadFlash(url), founding) : leadsDown();
}
async function leadSave(request, env, id) {
  const f = await request.formData(), v = Object.fromEntries([...f.entries()].map(([k, x]) => [k, String(x)])), patch = {};
  const cur = await getLead(env, id);
  if (!cur) return html(shell('Lead', banner('warn', 'No such lead', '', btn('/leads', 'Back to Leads', 'dark')), '/leads'), 404);
  if (v.status) patch.status = v.status;
  for (const k of ['draft', 'notes', 'next_at']) if (v[k] !== undefined) patch[k] = v[k];
  if (v.plan_form) { for (const k of ['next_action', 'meeting_at', 'meeting_link', 'tps']) if (v[k] !== undefined) patch[k] = v[k]; patch.dnc = v.dnc === '1'; }
  if (v.checklist_form) patch.checklist = Object.fromEntries((CHECKLISTS[cur.product] || CHECKLISTS.unsure).map(([k]) => [k, v[`ck_${k}`] === '1']));
  const res = await putLead(env, id, patch);
  if (!res.ok) { const msg = String(await res.text().catch(() => '')).replace(/^Error: /, '') || 'That didn\'t work.'; return html(pageLead(cur, { flash: banner('bad', msg) }), 400); }
  return redirect(`/leads/${encodeURIComponent(id)}?done=saved`);
}
async function pageStripeCheck(env) {
  const status = await books(env, '/stripe/status').then(r => r.ok ? r.json() : null).catch(() => null), cfg = await priceCfg(env, status), fetched = {};
  if (status && env.STRIPE_KEY) await Promise.all(Object.keys(STRIPE_EXPECTED).map(async (k) => { const id = status.prices && status.prices[k]; if (id && /^price_[\w]+$/.test(id)) fetched[k] = await stripeFetch(env, `/prices/${id}`); }));
  const r = stripeEval({ status, fetched, hqKey: env.STRIPE_KEY, hqMonthlyIds: new Set([...cfg.books, ...cfg.receptionist]) });
  const line = (g) => `<div class="banner ${g.bad ? 'bad' : g.warn ? 'warn' : 'ok'}">${g.bad || g.warn ? ICON.alert : ICON.check}<div><p>${esc(g.text)}</p></div></div>`;
  return shell('Stripe check', `${crumb('/more', 'More')}<h1>Is Stripe set up right?</h1><p class="lead">${r.ready ? 'Everything here checks out.' : 'Fix the red items, then reload this page.'} It shows no secrets. Nothing here changes anything in Stripe.</p>
${r.general.map(line).join('')}
<div class="card"><h2>The four prices</h2><div class="list">${r.rows.map(x => `<div class="item"><span class="body"><b>${esc(x.label)}</b><small>Should be ${esc(x.expected)}${x.id ? ` · ${esc(x.id)}` : ''}</small>${x.problems.map(p => `<small class="bad">${esc(p)}</small>`).join('')}${x.unchecked ? '<small class="mute">Not checked: HQ needs its Stripe key first.</small>' : ''}</span>${x.problems.length ? pill('bad', 'Fix') : x.unchecked ? pill('mute', 'Not checked') : pill('ok', 'OK')}</div>`).join('')}</div></div>
<div class="card"><h2>Still checked by hand</h2><p class="mute">In the Stripe dashboard, Developers, Webhooks: one endpoint for <b>books.localdeskai.co.uk/stripe/webhook</b> listening to <b>customer.subscription.created</b>, <b>updated</b> and <b>deleted</b>. HQ cannot see this with a read-only key. Then run the test steps in docs/JOURNEY-TEST-PLAN.md.</p></div>`, '/more');
}
async function leadCheckout(env, id) {
  const cur = await getLead(env, id);
  if (!cur) return html(shell('Lead', banner('warn', 'No such lead', '', btn('/leads', 'Back to Leads', 'dark')), '/leads'), 404);
  const res = await books(env, '/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: id }) }).catch(() => null);
  const out = res ? await res.json().catch(() => ({})) : {};
  if (!res || !res.ok || !out.url) return html(pageLead(cur, { flash: banner('bad', out.error || 'That didn\'t work. Stripe may not be set up yet.') }), 400);
  const link = String(out.url);
  if (!/^https:\/\/checkout\.stripe\.com\//.test(link)) return html(pageLead(cur, { flash: banner('bad', 'Stripe sent back something unexpected, so no link is shown.') }), 502);
  return html(pageLead(cur, { flash: banner('ok', `Payment link made${out.founding ? ' (founding client: monthly price only, no setup fee, 7-day trial)' : out.setupDueAfterTrial ? ' (monthly price with a 7-day trial)' : out.setupAtCheckout ? ' (includes the setup fee)' : ''}`, `Copy this and send it yourself. Nothing was sent. <code style="word-break:break-all">${esc(link)}</code>${out.setupDueAfterTrial ? ' <b>The £497 setup fee is not in this link:</b> our terms say nothing is charged during the 7-day trial. Charge it (a Stripe invoice) when the trial ends, and note it on the lead.' : ''}`) }));
}
async function leadCreate(request, env) {
  const f = await request.formData(), v = Object.fromEntries([...f.entries()].map(([k, x]) => [k, String(x)]));
  const res = await books(env, '/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: v.name, phone: v.phone, business: v.business, product: v.product, source: v.source, message: v.message }) });
  const out = await res.json().catch(() => ({}));
  if (out.blocked) return html(newLeadForm(`${String(out.error || 'Do not ring this number.')} It is already in HQ as a lead you marked.`, v), 400);
  if (!res.ok || !out.id) return html(newLeadForm(String(out.error || await res.text().catch(() => '') || 'That didn\'t work.').replace(/^Error: /, ''), v), 400);
  return redirect(`/leads/${encodeURIComponent(out.id)}?done=${out.existing ? 'exists' : 'added'}`);
}

// ---------- pages ----------
async function pageHome(env) {
  const d = await load(env);
  const todos = [];
  for (const c of d.booksProblems) todos.push(banner('bad', `${esc(c.name)}: ${plainProblem(c.problem)}`, esc(FIX), btn(`/books/client/${esc(c.realmId)}`, 'Open their page', 'dark')));
  const leadsNow = await getLeads(env);
  if (leadsNow) {
    const fresh = leadsNow.filter(l => l.status === 'new'), due = leadsNow.filter(l => l.status !== 'new' && isDue(l));
    if (fresh.length) todos.push(banner('warn', `${fresh.length} new enquir${fresh.length === 1 ? 'y' : 'ies'}`, fresh.slice(0, 3).map(l => esc(l.name)).join(', ') + (fresh.length > 3 ? '...' : '') + '. Nothing is sent to them automatically: you choose when to ring.', btn('/leads', 'Open Leads', 'dark')));
    const owing = setupDue(leadsNow); if (owing.length) todos.push(banner('warn', `${owing.length} setup fee${owing.length === 1 ? '' : 's'} to invoice`, owing.slice(0, 3).map(x => `${esc(x.lead.name)} (${x.over ? 'trial ended' : 'trial ends ' + x.ends.toLocaleDateString('en-GB')})`).join(', ') + '. Not taken at sign-up: send each a Stripe invoice for 497 pounds, then tick it off on the lead.', btn(`/leads/${esc(owing[0].lead.id)}`, 'Open the first', 'dark')));
    const ending = trialsEnding(leadsNow); if (ending.length) todos.push(banner('warn', `${ending.length} free trial${ending.length === 1 ? '' : 's'} ending within 2 days`, ending.slice(0, 3).map(x => `${esc(x.lead.name)} (ends ${x.ends.toLocaleDateString('en-GB')})`).join(', ') + '. Ring them for the decision. If they cancel before it ends they pay nothing. Otherwise the first payment is taken when it ends.', btn(`/leads/${esc(ending[0].lead.id)}`, 'Open the first', 'dark')));
    const zooms = zoomsSoon(leadsNow); if (zooms.length) todos.push(banner('info', `${zooms.length} Zoom demo${zooms.length === 1 ? '' : 's'} ${zooms.every(z => z.when === 'today') ? 'today' : 'today or tomorrow'}`, zooms.slice(0, 4).map(z => `${esc(z.lead.name)}${z.time ? ' at ' + esc(z.time) : ''}${z.when === 'tomorrow' ? ' (tomorrow)' : ''}`).join(', ') + '.', btn(`/leads/${esc(zooms[0].lead.id)}`, 'Open the first', 'dark')));
    if (due.length) todos.push(banner('warn', `${due.length} follow-up${due.length === 1 ? '' : 's'} due`, due.slice(0, 3).map(l => esc(l.name)).join(', ') + '.', btn('/leads', 'Open Leads', 'dark')));
  }
  try { const due2 = dueToday(await loadPosts(vaultOf(env))); if (due2.length) todos.push(banner('warn', `${due2.length} post${due2.length === 1 ? '' : 's'} to put out today`, due2.slice(0, 3).map(x => esc(x.title)).join(', ') + '. Schedule or post them yourself, then tick them off.', btn('/content', 'Open Content', 'dark'))); } catch { /* the reminder is optional */ }
  for (const s of d.failed) todos.push(banner('bad', `${esc(s.who)}'s payment failed`, 'Their card was declined. Stripe tries again automatically and emails them. If it is still unpaid after 14 days, get in touch.', btn('/payments', 'See payments', 'dark')));
  if (d.stale) todos.push(banner('warn', 'No recent backup of your Books data', 'A backup is made every morning. Take one now, and if this still shows tomorrow, open Help.', `<form method="post" action="/backups/download" style="margin-top:12px"><button class="btn dark">Download a backup now</button></form>`));
  const noStripe = d.subs.off || d.subs.error;
  const setup = [
    todo(!d.subs.off, 'Connect Stripe', 'See your customers and money here. Takes 3 minutes.', btn('/docs/stripe', 'Do it now', 'dark')),
    todo(!d.stale, 'Daily backup', d.stale ? 'No backup stored yet. One is made every morning.' : 'Running. A copy is made every morning.', `<form method="post" action="/backups/download"><button class="btn line">Make one now</button></form>`),
    todo(false, 'Before your first paying client', 'Register with HMRC and get your agreement checked.', btn('/docs/launch-checklist', 'See the list', 'dark')),
  ].filter(x => !x.includes('class="dot"') || true);
  const doneAll = !d.subs.off && !d.stale;
  return shell('Home', `<div class="ph"><div><h1>${dueGreeting()}, Gio</h1><p class="lead">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' })}</p></div></div>
<section class="section">${todos.length ? `<h2>${todos.length === 1 ? '1 thing needs' : `${todos.length} things need`} you</h2>${todos.join('')}` : banner('ok', 'All good', 'Nothing needs you right now.')}</section>
${d.health.error ? booksError() : ''}
<div class="tiles">${tile(noStripe ? '–' : money(d.income), noStripe ? 'monthly income (connect Stripe)' : 'coming in each month', false, true)}${tile(noStripe ? '–' : d.live.length, 'paying customers')}${tile(d.health.error ? '–' : d.clients.length, 'Books clients', true)}</div>
${noStripe ? '' : progressCard(d.pr, true)}
<section class="section"><h2>Quick actions</h2><div class="qa">${btn('/leads', 'See my leads')}${btn('/books/new', 'Add a Books client', 'dark')}</div></section>
<section class="section"><h2>Everything</h2><div class="big">${bigLink('/leads', 'leads', 'Leads', 'Enquiries and follow-ups')}${bigLink('/books', 'books', 'Books', 'Your bookkeeping clients')}${bigLink('/receptionist', 'receptionist', 'Receptionist', 'Mia, calls and texts')}${bigLink('/customers', 'customers', 'Customers', 'Everyone you look after')}${bigLink('/payments', 'payments', 'Payments', 'Money in, failed payments')}${bigLink('/backups', 'backups', 'Backups', 'Your data, kept safe')}${bigLink('/settings', 'settings', 'Settings', 'Accounts and security')}</div></section>
<div class="card"><h2>${doneAll ? 'Set-up' : 'Getting set up'}</h2>${setup.join('')}</div>`, '/');
}
async function pageCustomers(env) {
  const d = await load(env);
  const booksRows = d.clients.map(c => item(`/books/client/${esc(c.realmId)}`, c.name, c.ok ? 'Connected to QuickBooks' : esc(plainProblem(c.problem)), c.ok ? pill('ok', 'Connected') : pill('bad', 'Needs you'))).join('');
  const mia = d.subList.filter(s => s.product === 'receptionist');
  const miaRows = mia.map(s => item('', s.who, `${esc(s.plan)} · ${money(s.per)} a month`, statusPill(s))).join('');
  return shell('Customers', `<h1>Customers</h1>
${d.health.error ? booksError() : ''}
${d.pr.unclassified.length ? banner('warn', `${d.pr.unclassified.length} subscription${d.pr.unclassified.length === 1 ? ' isn\'t' : 's aren\'t'} matched to a product`, `${d.pr.unclassified.map(s => `${esc(s.who)} (price ${esc(s.priceId || 'unknown')})`).join(', ')}. They are not counted as Receptionist or Books customers. Add the price ID to STRIPE_PRICES_BOOKS or STRIPE_PRICES_RECEPTIONIST on the HQ worker, or set the Stripe product's metadata localdesk_product.`) : ''}
<div class="cols"><div class="card"><h2>Books clients</h2>${booksRows ? `<div class="list">${booksRows}</div>` : '<p class="mute">No Books clients yet. Add your first one.</p>'}<div class="sp"></div>${btn('/books/new', 'Add a new Books client')}</div>
<div class="card"><h2>Receptionist customers</h2>${d.subs.off ? stripeSetup() : d.subs.error ? stripeError() : miaRows ? `<div class="list">${miaRows}</div>` : '<p class="mute">No receptionist customers yet. They show here once they subscribe.</p>'}</div></div>`, '/customers');
}
async function pagePayments(env) {
  const d = await load(env);
  if (d.subs.off) return shell('Payments', `<h1>Payments</h1>${stripeSetup()}<div class="card"><h2>Open Stripe directly</h2>${btn('https://dashboard.stripe.com', 'Open Stripe', 'line', true)}</div>`, '/payments');
  if (d.subs.error) return shell('Payments', `<h1>Payments</h1>${stripeError()}`, '/payments');
  const ch = (d.charges.data || []).map(c => item('https://dashboard.stripe.com/payments', (c.billing_details && (c.billing_details.name || c.billing_details.email)) || 'Payment', `${day(c.created * 1000)}${c.paid ? '' : ' · ' + esc(c.failure_message || 'Failed')}`, `<b>${money(c.amount / 100)}</b>${c.paid ? '' : pill('bad', 'Failed')}`, true)).join('');
  return shell('Payments', `<h1>Payments</h1>
<div class="tiles">${tile(money(d.income), 'coming in each month')}${tile(d.live.length, 'paying customers')}</div>
${d.failed.length ? `<h2>Needs you</h2>${d.failed.map(s => banner('bad', `${esc(s.who)}: payment failed`, `Their card for ${esc(s.plan)} (${money(s.per)} a month) was declined. Stripe tries again automatically and emails them. If it is still unpaid after 14 days, phone them. After 30 days you can end their service.`, btn('https://dashboard.stripe.com/subscriptions', 'Open in Stripe', 'dark', true))).join('')}` : banner('ok', 'No failed payments', 'Everyone who should be paying, is.')}
<div class="card"><h2>Subscriptions</h2>${d.subList.length ? `<div class="list">${d.subList.map(s => item('https://dashboard.stripe.com/subscriptions', s.who, `${esc(s.plan)} · ${money(s.per)} a month · since ${day(s.since)}`, statusPill(s), true)).join('')}</div>` : '<p class="mute">No subscriptions yet.</p>'}</div>
<div class="card"><h2>Recent payments</h2>${ch ? `<div class="list">${ch}</div>` : '<p class="mute">No payments yet.</p>'}</div>
${btn('https://dashboard.stripe.com', 'Open Stripe', 'line', true)}`, '/payments');
}
async function pageBooks(env, flash = '') {
  const d = await load(env);
  const demo = await demoLink(env, d.clients);
  const rows = d.clients.map(c => item(`/books/client/${esc(c.realmId)}`, c.name, c.ok ? `${c.filed ?? 0} receipts filed this week${c.late ? ` · ${c.late} late invoice${c.late > 1 ? 's' : ''}` : ''}` : esc(plainProblem(c.problem)), c.ok ? pill('ok', 'Connected') : pill('bad', 'Needs you'))).join('');
  return shell('Books', `<h1>Books</h1><p class="lead">Bookkeeping for tradespeople, on their own QuickBooks.</p>
${flash}${d.health.error ? booksError() : ''}
${d.booksProblems.length ? d.booksProblems.map(c => banner('bad', `${esc(c.name)}: ${plainProblem(c.problem)}`, esc(FIX), btn(`/books/client/${esc(c.realmId)}`, 'Open their page', 'dark'))).join('') : ''}
${btn('/books/new', 'Add a new client')}
<div class="card"><h2>Your clients</h2>${rows ? `<div class="list">${rows}</div>` : '<p class="mute">No clients yet. Add your first with the button above.</p>'}</div>
<div class="card"><h2>Handy</h2><div class="stack">${demo ? btn(demo, 'Open the demo for a prospect', 'line', true) : ''}${btn('/docs/books-onboard', 'Taking on a new client: step by step', 'line')}${btn('https://developer.intuit.com/app/developer/dashboard', 'QuickBooks developer account', 'line', true)}</div></div>`, '/books');
}
// The demo is a practice company marked "demo" in Books. Its app link is built here for the owner only.
async function demoLink(env, clients) {
  const v = vaultOf(env), hit = await vpost(v, '/cache', { key: 'demolink' });
  if (hit && Date.now() - hit.at < 600000) return hit.data;
  const link = await findDemo(env, clients);
  await vpost(v, '/cache/set', { key: 'demolink', data: link });
  return link;
}
async function findDemo(env, clients) {
  for (const c of clients) {
    const r = await books(env, `/client/${encodeURIComponent(c.realmId)}`).then(x => x.ok ? x.json() : null).catch(() => null);
    if (r && r.demo && r.appUrl) return r.appUrl;
  }
  return '';
}
const FLASH = { saved: ['ok', 'Saved.'], loggedout: ['ok', 'Done. Every phone of theirs has been logged out.'], ended: ['ok', 'Their service has ended. Books can no longer see their QuickBooks. Their data is held for 30 days and then deleted.'] };
const flashOf = (url) => { const f = FLASH[url.searchParams.get('done')]; return f ? banner(f[0], f[1]) : ''; };

const NEW_HELP = 'We\'ll make a one-time link for them to connect their QuickBooks. It works once and lasts 14 days.';
function newClientForm(msg = '', v = {}) {
  return shell('New client', `${crumb('/books', 'Books')}<h1>Add a new client</h1><p class="lead">${NEW_HELP}</p>${msg ? banner('bad', msg) : ''}
<div class="card"><form method="post" action="/books/new">
<label for="n">Business name</label><input id="n" name="name" value="${esc(v.name || '')}" required>
<label for="p">Owner's mobile number<small>Login codes and texts go here. Any normal UK format works.</small></label><input id="p" name="phone" inputmode="tel" value="${esc(v.phone || '')}" placeholder="07700 900123" required>
<label for="v">Are they VAT registered?</label><select id="v" name="vat"><option value="">Not sure, let their software tell us</option><option value="yes">Yes</option><option value="no">No</option></select>
<label for="q">Include quotes?<small>The quotes add-on.</small></label><select id="q" name="extras"><option value="">No</option><option value="quotes">Yes</option></select>
<label for="s">Which accounting software do they use?</label><select id="s" name="platform"><option value="quickbooks">QuickBooks Online</option><option value="freeagent">FreeAgent</option><option value="xero">Xero</option></select>
<label for="e">Real or practice company?</label><select id="e" name="env"><option value="production">A real customer's company</option><option value="sandbox">A practice company (testing only)</option></select>
<div class="sp"></div><button class="btn block" style="margin-top:16px">Make the connect link</button></form></div>`, '/books');
}
async function createClient(request, env) {
  const f = await request.formData(), v = Object.fromEntries([...f.entries()].map(([k, x]) => [k, String(x)]));
  const res = await books(env, '/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: v.name, phone: v.phone, vat: v.vat, extras: v.extras, platform: ['freeagent', 'xero'].includes(v.platform) ? v.platform : 'quickbooks', env: v.env === 'sandbox' ? 'sandbox' : 'production' }) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.link) return html(newClientForm(String(out.error || await res.text().catch(() => '') || 'That didn\'t work.').replace(/^Error: /, ''), v), 400);
  const sw = { freeagent: 'FreeAgent', xero: 'Xero' }[v.platform] || 'QuickBooks', approve = sw === 'FreeAgent' ? 'Approve' : sw === 'Xero' ? 'Allow access' : 'Allow';
  const msg = `Hi, here is the link to connect your ${sw} to Books: ${out.link} (it works once, for 14 days). Log in to ${sw} and tap ${approve}. Your app link comes straight after.`;
  const digits = String(out.phone || v.phone || '').replace(/\D/g, '').replace(/^0/, '44');
  return html(shell('Link ready', `<h1>Link ready</h1>${banner('ok', `Connect link for ${esc(v.name)}`, 'Send it to them now. It only works once.')}
<div class="card"><h2>Send it</h2><div class="stack">${btn(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, 'Send on WhatsApp', '', true)}${btn(`sms:${digits ? '+' + digits : ''}?&body=${encodeURIComponent(msg)}`, 'Send as a text', 'dark')}</div>
<p class="help">Or copy this link yourself:</p><p><code>${esc(out.link)}</code></p></div>
<div class="card"><h2>What happens next</h2><ol class="steps"><li>They open the link, log in to ${sw} and tap <b>${approve}</b>.</li><li>They get their own app link by text, and so do you.</li><li>Open their page here and run <b>Check their accounting setup</b>.</li></ol></div>${btn('/books', 'Back to Books', 'line')}`, '/books'));
}
async function pageClient(env, realm, url) {
  const [c, hr] = await Promise.all([books(env, `/client/${realm}`).then(r => r.ok ? r.json() : null), books(env, '/health').then(r => r.json()).catch(() => ({}))]);
  if (!c) return html(shell('Not found', `${crumb('/books', 'Books')}${banner('warn', 'We can\'t find that client', 'They may have been ended already.', btn('/books', 'Back to Books', 'dark'))}`, '/books'), 404);
  const row = (hr.clients || []).find(x => x.realmId === realm) || {};
  const isDemo = Boolean(c.demo);
  const vatLabel = c.vat === 'yes' ? 'Yes' : c.vat === 'no' ? 'No' : 'Ask QuickBooks';
  return html(shell(c.name || 'Client', `${crumb('/books', 'Books')}<div><h1>${esc(c.name || 'Client')}</h1><p class="lead">${isDemo ? 'Practice company used for demos' : row.ok === false ? plainProblem(row.problem) : 'Connected to their QuickBooks'}</p></div>
${flashOf(url)}${row.ok === false ? banner('bad', plainProblem(row.problem), esc(FIX)) : ''}
${c.appUrl ? `<div class="card"><h2>Their app</h2>${btn(c.appUrl, isDemo ? 'Open the demo' : 'Open their app', '', true)}<p class="help">${isDemo ? 'No login needed. Good for showing prospects.' : 'This opens their own app. Their login is a code texted to their mobile.'}</p></div>` : ''}
<div class="card"><h2>This week</h2><div class="kv"><div><span>Receipts filed</span><b>${esc(row.filed ?? '–')}</b></div><div><span>Waiting to be tidied</span><b>${esc(row.toTidy ?? '–')}</b></div><div><span>Late invoices</span><b>${esc(row.late ?? '–')}</b></div><div><span>App last opened</span><b>${row.seenDays == null ? 'Not yet' : row.seenDays === 0 ? 'Today' : `${esc(row.seenDays)} days ago`}</b></div></div></div>
<div class="card"><h2>Details</h2><form method="post" action="/books/client/${esc(realm)}/save">
<label for="n">Business name</label><input id="n" name="name" value="${esc(c.name || '')}" required>
<label for="p">Owner's mobile</label><input id="p" name="phone" inputmode="tel" value="${esc(c.phone || '')}"${isDemo ? ' disabled' : ''}>
<label for="a">Their accountant's email<small>Quarterly packs are sent here.</small></label><input id="a" name="accountant" type="email" value="${esc(c.accountant || '')}">
<label for="v">VAT registered?</label><select id="v" name="vat"><option value=""${!c.vat ? ' selected' : ''}>Ask QuickBooks</option><option value="yes"${c.vat === 'yes' ? ' selected' : ''}>Yes</option><option value="no"${c.vat === 'no' ? ' selected' : ''}>No</option></select>
<label for="q">Quotes add-on</label><select id="q" name="extras"><option value=""${!c.extras ? ' selected' : ''}>Off</option><option value="quotes"${c.extras === 'quotes' ? ' selected' : ''}>On</option></select>
<label for="c">Chase late invoices automatically?</label><select id="c" name="chase"><option value="off"${c.chase !== 'on' ? ' selected' : ''}>No</option><option value="on"${c.chase === 'on' ? ' selected' : ''}>Yes</option></select>
<button class="btn block" style="margin-top:16px">Save changes</button></form></div>
<div class="card"><h2>Tools</h2><div class="stack">${btn(`/books/client/${esc(realm)}/check`, 'Check their accounting setup', 'line')}${btn(`/books/client/${esc(realm)}/monthly`, 'See their monthly text', 'line')}${btn(`/books/client/${esc(realm)}/confirm/logout`, 'Log out their phones', 'line')}</div><p class="help">Checking their setup is read-only. It confirms the VAT codes and accounts are right.</p></div>
${isDemo ? '' : `<div class="card"><h2>Ending their service</h2><p class="mute">Stops Books straight away. Their data is held for 30 days, then deleted.</p>${btn(`/books/client/${esc(realm)}/confirm/end`, 'End their service', 'danger')}</div>`}`, '/books'));
}
async function saveClient(request, env, realm) {
  const f = await request.formData(), body = {};
  for (const k of ['name', 'phone', 'accountant', 'vat', 'extras', 'chase']) if (f.has(k)) body[k] = String(f.get(k));
  const res = await books(env, `/client/${realm}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { const t = (await res.text()).replace(/^Error: /, ''); return html(shell('Couldn\'t save', `${crumb(`/books/client/${esc(realm)}`, 'Back')}${banner('bad', 'That wasn\'t saved', esc(t))}`, '/books'), 400); }
  return redirect(`/books/client/${realm}?done=saved`);
}
const CONFIRM = {
  logout: { title: 'Log out their phones?', text: 'Every phone they have logged in will be logged out. They log back in with a code texted to their mobile. Nothing is lost.', button: 'Yes, log them out', kind: 'dark', path: (r) => `/logout/${r}`, done: 'loggedout', to: (r) => `/books/client/${r}` },
  end: { title: 'End their service?', text: 'Books stops working for them straight away and can no longer see their QuickBooks. Their data is held for 30 days, then deleted. Their own QuickBooks is not touched. This cannot be undone, but you can invite them again later.', button: 'Yes, end their service', kind: 'danger', path: (r) => `/revoke/${r}`, done: 'ended', to: () => '/books' },
};
const pageConfirm = (realm, what) => { const c = CONFIRM[what]; return shell(c.title, `${crumb(`/books/client/${esc(realm)}`, 'Back')}<h1>${esc(c.title)}</h1><div class="card"><p>${esc(c.text)}</p><form method="post" action="/books/client/${esc(realm)}/do/${what}" class="stack"><button class="btn block ${c.kind}">${esc(c.button)}</button>${btn(`/books/client/${esc(realm)}`, 'No, go back', 'line')}</form></div>`, '/books'); };
async function doConfirmed(env, realm, what) {
  const c = CONFIRM[what];
  const res = await books(env, c.path(realm), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (!res.ok) return html(shell('Didn\'t work', `${crumb(`/books/client/${esc(realm)}`, 'Back')}${banner('bad', 'That didn\'t go through', 'Nothing was changed. Try again in a minute. If it keeps happening, open Help.')}`, '/books'), 502);
  return redirect(`${c.to(realm)}?done=${c.done}`);
}
async function pageCheck(env, realm) {
  const r = await books(env, `/precheck/${realm}`).then(x => x.ok ? x.json() : null).catch(() => null);
  if (!r) return shell('Setup check', `${crumb(`/books/client/${esc(realm)}`, 'Back')}${banner('warn', 'Couldn\'t check just now', 'Books couldn\'t reach their accounting software. Try again in a minute.', btn(`/books/client/${esc(realm)}/check`, 'Try again', 'line'))}`, '/books');
  return shell('Setup check', `${crumb(`/books/client/${esc(realm)}`, 'Back')}<h1>Setup check</h1>
${r.ok ? banner('ok', 'Looks right', 'VAT codes, bank account and expense accounts all line up. They can start using Books.') : banner('warn', `${r.problems.length} thing${r.problems.length > 1 ? 's' : ''} to look at`, 'Fix these in their QuickBooks before their first receipt.')}
${r.problems.length ? `<div class="card"><h2>To fix</h2><ol class="steps">${r.problems.map(p => `<li>${esc(p)}</li>`).join('')}</ol></div>` : ''}
<div class="card"><h2>What we found</h2><div class="kv"><div><span>VAT registered</span><b>${r.vatRegistered ? 'Yes' : 'No'}</b></div><div><span>Bank account</span><b>${esc((r.banks || []).join(', ') || 'None')}</b></div><div><span>20% VAT code</span><b>${esc(r.vat.standard || 'Not found')}</b></div><div><span>5% VAT code</span><b>${esc(r.vat.reduced || 'Not found')}</b></div><div><span>0% VAT code</span><b>${esc(r.vat.zero || 'Not found')}</b></div></div></div>`, '/books');
}
async function pageMonthly(env, realm) {
  const r = await books(env, `/monthly/${realm}`).then(x => x.ok ? x.json() : null).catch(() => null);
  return shell('Monthly text', `${crumb(`/books/client/${esc(realm)}`, 'Back')}<h1>Their monthly text</h1>${r ? `<div class="card"><p class="mute">This is what they get by text on the 1st of each month.</p><p style="white-space:pre-wrap;font-weight:600">${esc(r.text)}</p></div>` : banner('warn', 'Couldn\'t get it just now', 'Try again in a minute.')}`, '/books');
}
function pageReceptionist(d) {
  const mia = d.subList.filter(s => s.product === 'receptionist');
  return shell('Receptionist', `<h1>Receptionist</h1><p class="lead">Mia answers your customers' calls, takes messages and texts you a summary.</p>
<div class="big">${bigLink(LINKS.receptionist[0].url, 'receptionist', 'Calls and Mia', 'Vapi: call recordings and Mia\'s wording', true)}${bigLink(LINKS.receptionist[1].url, 'customers', 'Numbers and texts', 'Twilio: phone numbers and messages', true)}${bigLink(LINKS.receptionist[2].url, 'home', 'Booked calls', 'Calendly: demo calls booked with you', true)}${bigLink('tel:01752741686', 'receptionist', 'Try the demo line', 'Ring it to hear Mia (01752 741686)')}</div>
<div class="card"><h2>Receptionist customers</h2>${d.subs.off ? stripeSetup() : d.subs.error ? stripeError() : mia.length ? `<div class="list">${mia.map(s => item('/payments', s.who, `${esc(s.plan)} · ${money(s.per)} a month`, statusPill(s))).join('')}</div>` : '<p class="mute">None yet. They appear here once they subscribe.</p>'}</div>
<div class="card"><h2>If a customer says Mia isn't answering</h2><ol class="steps"><li>Open <b>Calls and Mia</b> and check the assistant is switched on.</li><li>Open <b>Numbers and texts</b> and check their number is active.</li><li>Still stuck? Open Help, then "If something goes wrong".</li></ol></div>`, '/receptionist');
}
function pageBackups(d) {
  const last = d.backups[0], hours = last ? (Date.now() - last.at) / 3600000 : null;
  const status = !last ? banner('warn', 'No backup yet', 'Your first one is made at about 6:30 tomorrow morning. You can take one now with the button below.')
    : d.stale ? banner('bad', `Your last backup is ${Math.floor(hours)} hours old`, 'One should be made every morning, so something has stopped. Take one now with the button below, then open Help and choose "Backups and restore".')
    : banner('ok', 'Backed up', `Last backup: ${day(last.at)} (${Math.max(1, Math.round(last.size / 1024))} KB). A new one is made every morning and the last 30 are kept.`);
  return shell('Backups', `<h1>Backups</h1><p class="lead">A safe copy of everything Books holds that can't be recreated: clients, mileage, change log and app links.</p>
${status}
<div class="card"><h2>Take one now</h2><p class="mute">Downloads a fresh copy to your phone or computer. Keep it somewhere safe.</p><form method="post" action="/backups/download"><button class="btn block">Download a backup now</button></form></div>
<div class="card"><h2>Earlier backups</h2>${d.backups.length ? `<div class="list">${d.backups.map(b => `<form method="post" action="/backups/download" class="item"><input type="hidden" name="date" value="${esc(b.date)}"><span class="body"><b>${esc(day(Date.parse(b.date)))}</b><small>${Math.max(1, Math.round(b.size / 1024))} KB</small></span><button class="btn line" style="min-height:44px;padding:8px 16px">Download</button></form>`).join('')}</div>` : '<p class="mute">None yet.</p>'}</div>
<div class="card"><h2>Good to know</h2><p>Your clients' QuickBooks data lives in their own QuickBooks, so it is not part of this. If you ever have to restore, each client reconnects with a fresh link.</p>${btn('/docs/backups', 'How to restore', 'line')}</div>`, '/backups');
}
const pageSettings = () => shell('Settings', `<h1>Settings</h1>
<div class="card"><h2>Your accounts</h2><div class="list">${LINKS.accounts.map(l => item(l.url, l.name, esc(l.note), '', true)).join('')}</div></div>
<div class="card"><details><summary style="font-size:1.15rem;font-weight:800">Where your passwords and keys are kept</summary><p class="mute">You never need to type these here. This only tells you where each one lives.</p><div class="list">${REGISTER.map(r => `<div class="item" style="align-items:flex-start"><span class="body"><b>${esc(r.name)}</b><small>Kept in: ${esc(r.where)}</small><small>What it does: ${esc(r.use)}</small><small>If you lose it: ${esc(r.recover)}</small></span></div>`).join('')}</div></details></div>
<div class="card"><h2>Your HQ login</h2><details><summary>I've lost my phone</summary><p>In Cloudflare, open <b>Workers &amp; Pages</b>, then <b>hq</b>, then <b>Settings</b>, then <b>Variables and Secrets</b>. Change the variable <code>RESET_TOTP</code> to any new word. Then log in again and set up the app on your new phone.</p></details><details><summary>I want a new passphrase</summary><p>In the same place in Cloudflare, edit <code>OWNER_PASSWORD</code> and save. Every phone and computer is logged out and you log in with the new one.</p></details></div>
<div class="card"><h2>Lost or lent a device?</h2><p class="mute">HQ remembers your phone and computer for 3 months so you don't log in every time. If a device is lost, log every device out at once. You then log back in with your passphrase and code.</p><form method="post" action="/logout-all"><button class="btn block danger">Log out every device</button></form></div>
<form method="post" action="/logout"><button class="btn block line">Log out of this device</button></form>`, '/settings');
async function pagePasskey(vault, nonce, added) {
  const keys = await vpost(vault, '/pk', { op: 'list' });
  return shell('Face ID login', `<h1>Face ID or fingerprint login</h1>
${added ? banner('ok', 'Added', 'Next time, tap "Log in with Face ID or fingerprint" on the login page.') : ''}
<div class="card"><h2>Add this device</h2><p class="mute">Do this on each phone or computer you want to log in with. You will be asked for your Face ID, fingerprint or phone PIN.</p>
<label for="pk-name">Name for this device</label><input id="pk-name" maxlength="40" placeholder="e.g. My iPhone" autocapitalize="words">
<button type="button" id="pk-add" class="btn block" style="margin-top:14px">Add Face ID or fingerprint</button><p id="pk-msg" class="help" hidden role="alert"></p></div>
<div class="card"><h2>Your devices</h2>${keys.length ? `<div class="list">${keys.map(k => `<div class="item"><span class="body"><b>${esc(k.name)}</b><small>Added ${esc(k.added || '')}</small></span><form method="post" action="/passkey/delete"><input type="hidden" name="id" value="${esc(k.id)}"><button class="btn line">Remove</button></form></div>`).join('')}</div>` : '<p class="mute">None yet. Your passphrase and code still work either way.</p>'}</div>
${loginScript(nonce)}`, '/more');
}
const pageMore = () => shell('More', `<h1>More</h1><div class="card"><div class="list">${[['/leads', 'Leads', 'Enquiries and follow-ups', 'leads'], ['/content', 'Content', 'Posts to approve', 'leads'], ['/receptionist', 'Receptionist', 'Mia, calls and texts', 'receptionist'], ['/backups', 'Backups', 'Your data, kept safe', 'backups'], ['/passkey', 'Face ID login', 'Log in with a touch', 'settings'], ['/stripe-check', 'Stripe check', 'Is payment setup right?', 'settings'], ['/settings', 'Settings', 'Accounts and security', 'settings'], ['/docs', 'Help', 'Step-by-step guides', 'help']].map(([h, t, s, ic]) => `<a class="item" href="${h}"><span class="av" style="border-radius:12px">${ICON[ic]}</span><span class="body"><b>${t}</b><small>${s}</small></span>${ICON.chevron}</a>`).join('')}</div></div><form method="post" action="/logout"><button class="btn block line">Log out of HQ</button></form>`, '/more');

// ---------- help ----------
function md(src) {
  const lines = src.split('\n'); let out = '', list = '', code = false;
  const inline = (t) => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  const close = () => { if (list) { out += `</${list}>`; list = ''; } };
  for (const line of lines) {
    if (line.startsWith('```')) { close(); out += code ? '</pre>' : '<pre>'; code = !code; continue; }
    if (code) { out += esc(line) + '\n'; continue; }
    const ul = /^[-*] (.*)/.exec(line), ol = /^\d+\. (.*)/.exec(line);
    if (ul || ol) { const t = ul ? 'ul' : 'ol'; if (list !== t) { close(); out += `<${t} class="steps">`; list = t; } out += `<li>${inline((ul || ol)[1])}</li>`; continue; }
    close();
    const h = /^(#{1,3}) (.*)/.exec(line);
    if (h) out += `<h${h[1].length + 1} style="margin:1em 0 .4em">${inline(h[2])}</h${h[1].length + 1}>`; else if (line.trim()) out += `<p>${inline(line)}</p>`;
  }
  close(); return out + (code ? '</pre>' : '');
}
const pageDocs = (name) => {
  const doc = DOCS.find(d => d.id === name);
  if (name && !doc) return null;
  return doc ? shell(doc.title, `${crumb('/docs', 'Help')}<div class="card">${md(doc.body)}</div>`, '/docs')
    : shell('Help', `<h1>Help</h1><p class="lead">Step-by-step guides, in plain English.</p><div class="card"><div class="list">${DOCS.map(d => item(`/docs/${esc(d.id)}`, d.title, esc(d.about))).join('')}</div></div>`, '/docs');
};

// ---------- routes ----------
const friendlyError = () => html(shell('Something went wrong', banner('warn', 'Something went wrong on our side', 'Nothing was changed. Try again in a minute. If it keeps happening, open Help and choose "If something goes wrong".', btn('/', 'Back to Home', 'dark')), ''), 500);
export async function backupDaily(env) {
  const res = await books(env, '/backup');
  if (!res.ok) throw new Error(`Books backup answered ${res.status}`);
  const data = await res.text(); JSON.parse(data); // never keep something that is not a backup
  await vpost(vaultOf(env), '/bk/put', { date: new Date().toISOString().slice(0, 10), data });
}
export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(backupDaily(env)); },
  async fetch(request, env) {
    const url = new URL(request.url), vault = vaultOf(env);
    const respond = (res, opts) => secure(res, opts);
    if (url.pathname === '/font.woff') return fontResponse();
    if (!env.OWNER_PASSWORD) return respond(html(bare('Not set up', '<h1>Not switched on yet</h1><p class="lead">HQ stays closed until you set your passphrase in Cloudflare. The setup guide has the steps.</p>'), 503));
    if (env.RESET_TOTP !== undefined) await vpost(vault, '/reset', { value: String(env.RESET_TOTP) });
    const nonce = newChallenge().slice(0, 16), withNonce = { csp: pageCsp(nonce) };
    if (url.pathname === '/login') return respond(request.method === 'POST' ? await handleLogin(request, env, nonce) : html(loginPage('', null, nonce)), withNonce);
    const origin = url.origin, jsonOut = (o, status = 200) => respond(Response.json(o, { status, headers: { 'Cache-Control': 'no-store' } }));
    if (request.method === 'POST' && url.pathname === '/passkey/options') { // login step 1: a one-time challenge
      const who = await sha256(request.headers.get('CF-Connecting-IP') || 'unknown');
      if ((await vpost(vault, '/check', { who })).locked) return jsonOut({ error: 'Too many wrong tries. Wait 15 minutes.' }, 429);
      const challenge = newChallenge(); await vpost(vault, '/pk', { op: 'challenge', kind: 'get', value: challenge });
      return jsonOut({ challenge });
    }
    if (request.method === 'POST' && url.pathname === '/passkey/login') { // login step 2: check the signature
      const who = await sha256(request.headers.get('CF-Connecting-IP') || 'unknown');
      if ((await vpost(vault, '/check', { who })).locked) return jsonOut({ error: 'Too many wrong tries. Wait 15 minutes.' }, 429);
      const body = await request.json().catch(() => ({}));
      const bad = async () => { await vpost(vault, '/fail', { who }); return jsonOut({ error: 'That did not work. Use your passphrase instead.' }, 401); };
      let cd; try { cd = JSON.parse(new TextDecoder().decode(b64u.dec(body.clientDataJSON))); } catch { return bad(); }
      if (!(await vpost(vault, '/pk', { op: 'use', kind: 'get', value: String(cd.challenge || '') })).ok) return bad();
      const key = (await vpost(vault, '/pk', { op: 'list' })).find(k => k.id === body.id), rec2 = await vget(vault, '/totp');
      if (!key || !rec2 || !rec2.active) return bad();
      const count = await verifyAssertion(body, key, { challenge: cd.challenge, origin, rpId: url.hostname });
      if (count === null) return bad();
      await vpost(vault, '/pk', { op: 'count', id: key.id, count }); await vpost(vault, '/ok', { who });
      return respond(Response.json({ ok: true }, { headers: { 'Set-Cookie': cookie(await makeSession(env, rec2, (await vget(vault, '/epoch')).n, REMEMBER_SECONDS), REMEMBER_SECONDS), 'Cache-Control': 'no-store' } }));
    }
    const [rec, ep] = await Promise.all([vget(vault, '/totp'), vget(vault, '/epoch')]);
    const epoch = ep.n;
    const authed = await validSession(env, rec, epoch, request.headers.get('Cookie'));
    if (url.pathname === '/logout' && request.method === 'POST') return respond(redirect('/login', { 'Set-Cookie': cookie('', 0) }));
    if (url.pathname === '/logout-all' && request.method === 'POST' && authed) { await vpost(vault, '/epoch', {}); return respond(redirect('/login', { 'Set-Cookie': cookie('', 0) })); }
    if (!authed) return respond(redirect('/login'));
    try {
      const p = url.pathname;
      { const cm = request.method === 'POST' && (p.match(/^\/content\/([pxm][a-z0-9]+)\/(\w+)$/) || (p === '/content/new' ? [null, 'new', 'new'] : null)); if (cm) return respond(await contentAction(request, env, vault, cm[1], cm[2])); }
      if (request.method === 'POST' && p === '/passkey/new-options') {
        const challenge = newChallenge(); await vpost(vault, '/pk', { op: 'challenge', kind: 'create', value: challenge });
        return jsonOut({ challenge, user: b64u.enc(enc.encode('owner')) });
      }
      if (request.method === 'POST' && p === '/passkey/register') {
        const body = await request.json().catch(() => ({}));
        let cd; try { cd = JSON.parse(new TextDecoder().decode(b64u.dec(body.clientDataJSON))); } catch { return jsonOut({ error: 'That did not work.' }, 400); }
        if (!(await vpost(vault, '/pk', { op: 'use', kind: 'create', value: String(cd.challenge || '') })).ok) return jsonOut({ error: 'That took too long. Try again.' }, 400);
        const key = await verifyRegistration(body, { challenge: cd.challenge, origin });
        if (!key) return jsonOut({ error: 'That did not work. Nothing was added.' }, 400);
        await vpost(vault, '/pk', { op: 'add', key: { ...key, name: String(body.name || '').trim().slice(0, 40) || 'My device', added: new Date().toISOString().slice(0, 10) } });
        return jsonOut({ ok: true });
      }
      if (request.method === 'POST' && p === '/passkey/delete') {
        const f = await request.formData().catch(() => new FormData());
        await vpost(vault, '/pk', { op: 'remove', id: String(f.get('id') || '') });
        return respond(redirect('/passkey'));
      }
      if (request.method === 'GET' && p === '/passkey') return respond(html(await pagePasskey(vault, nonce, url.searchParams.get('added') === '1')), withNonce);
      if (request.method === 'POST') {
        if (p === '/backups/download') {
          const date = String((await request.formData().catch(() => new FormData())).get('date') || '');
          let body, name = new Date().toISOString().slice(0, 10), status = 200;
          if (/^\d{4}-\d{2}-\d{2}$/.test(date)) { const got = await vpost(vault, '/bk/get', { date }); if (got.data == null) return respond(new Response('No such backup', { status: 404 })); body = got.data; name = date; }
          else { await backupDaily(env).catch(() => {}); const res = await books(env, '/backup'); body = res.body; status = res.status; } // also keeps a copy in HQ
          return respond(new Response(body, { status, headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="books-backup-${name}.json"` } }));
        }
        if (p === '/books/new') return respond(await createClient(request, env));
        if (p === '/leads/new') return respond(await leadCreate(request, env));
        { const cm = p.match(/^\/leads\/([\w-]+)\/checkout$/); if (cm) return respond(await leadCheckout(env, cm[1])); }
        const lm = p.match(/^\/leads\/([\w-]+)\/(save|delete)$/);
        if (lm && lm[2] === 'save') return respond(await leadSave(request, env, lm[1]));
        if (lm) {
          const f = await request.formData().catch(() => new FormData());
          if (String(f.get('confirm') || '') !== 'yes') return respond(redirect(`/leads/${encodeURIComponent(lm[1])}`));
          const r = await books(env, `/leads/${encodeURIComponent(lm[1])}`, { method: 'DELETE' });
          return respond(r.ok ? redirect('/leads?done=deleted') : friendlyError());
        }
        const m = p.match(/^\/books\/client\/(\d+)\/(save|do\/(logout|end))$/);
        if (m) return respond(m[2] === 'save' ? await saveClient(request, env, m[1]) : await doConfirmed(env, m[1], m[3]));
        return respond(html(shell('Not found', banner('warn', 'Nothing here', '', btn('/', 'Back to Home', 'dark'))), 404));
      }
      if (request.method !== 'GET') return respond(new Response('Not found', { status: 404 }));
      if (p === '/help') return respond(redirect('/docs'));
      let m;
      if (p === '/books/new') return respond(html(newClientForm('', { name: (url.searchParams.get('name') || '').slice(0, 100), phone: (url.searchParams.get('phone') || '').slice(0, 40) })));
      if (p === '/leads/new') return respond(html(newLeadForm()));
      if ((m = p.match(/^\/leads\/([\w-]+)$/))) { const l = await getLead(env, m[1]); const app = l && l.product === 'books' ? appFor(l, (await cachedHealth(env).catch(() => ({}))).clients) : null; return respond(l ? html(pageLead(l, { template: url.searchParams.get('template') === '1', flash: leadFlash(url), app, problem: app && !app.ok ? plainProblem(app.problem) : '', demoUrl: /^https:\/\/[^\s"'<>]+$/.test(env.BOOKS_DEMO_URL || '') ? env.BOOKS_DEMO_URL : '' })) : html(shell('Lead', banner('warn', 'No such lead', 'It may have been deleted.', btn('/leads', 'Back to Leads', 'dark')), '/leads'), 404)); }
      if ((m = p.match(/^\/books\/client\/(\d+)$/))) return respond(await pageClient(env, m[1], url));
      if ((m = p.match(/^\/books\/client\/(\d+)\/check$/))) return respond(html(await pageCheck(env, m[1])));
      if ((m = p.match(/^\/books\/client\/(\d+)\/monthly$/))) return respond(html(await pageMonthly(env, m[1])));
      if ((m = p.match(/^\/books\/client\/(\d+)\/confirm\/(logout|end)$/))) return respond(html(pageConfirm(m[1], m[2])));
      if ((m = p.match(/^\/docs(?:\/([\w-]+))?$/))) { const pg = pageDocs(m[1]); return respond(pg ? html(pg) : html(shell('Not found', banner('warn', 'No such guide', '', btn('/docs', 'All guides', 'dark')), '/docs'), 404)); }
      const pages = { '/': () => pageHome(env), '/leads': () => pageLeadsList(env, url), '/content': async () => pageContent(await loadPosts(vault), await foundingCount(env)), '/customers': () => pageCustomers(env), '/payments': () => pagePayments(env), '/books': () => pageBooks(env, flashOf(url)), '/receptionist': async () => pageReceptionist(await load(env)), '/backups': async () => pageBackups(await load(env)), '/settings': pageSettings, '/stripe-check': () => pageStripeCheck(env), '/more': pageMore };
      if (pages[p]) return respond(html(await pages[p]()));
      return respond(html(shell('Not found', banner('warn', 'Nothing here', 'That page doesn\'t exist.', btn('/', 'Back to Home', 'dark')), ''), 404));
    } catch (e) { return respond(friendlyError()); }
  },
};
