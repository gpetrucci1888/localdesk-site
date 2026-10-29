// QuickBooks connector.
//
// Holds each client's QuickBooks connection and keeps it alive, so checks and
// receipt uploads can talk to QuickBooks without anyone logging in again.
//
//   GET  /connect?k=ADMIN_KEY   send the client to Intuit to click "Allow"
//   GET  /callback              Intuit sends them back here; tokens are saved
//   GET  /companies             (X-Key header) which QuickBooks companies are connected
//   ANY  /qb/<realmId>/<path>   (X-Key header) passed through to the QuickBooks API,
//                               e.g. /qb/123/query?query=select * from Purchase
//
// Settings: QB_CLIENT_ID, QB_CLIENT_SECRET (from the Intuit app), ADMIN_KEY,
// QB_ENV ("sandbox" or "production"). Tokens live in the Store Durable Object.

const AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const SCOPE = 'com.intuit.quickbooks.accounting';
const MINOR_VERSION = '75';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const store = env.STORE.get(env.STORE.idFromName('main'));
    const redirectUri = `${url.origin}/callback`;
    try {
      if (url.pathname === '/connect') {
        if (url.searchParams.get('k') !== env.ADMIN_KEY) return text('Not allowed', 403);
        const state = crypto.randomUUID();
        await store.fetch('https://store/state', { method: 'PUT', body: state });
        const go = new URL(AUTH_URL);
        go.search = new URLSearchParams({ client_id: env.QB_CLIENT_ID, response_type: 'code', scope: SCOPE, redirect_uri: redirectUri, state }).toString();
        return Response.redirect(go.toString(), 302);
      }

      if (url.pathname === '/callback') {
        const ok = await store.fetch('https://store/state', { method: 'POST', body: url.searchParams.get('state') || '' });
        if (!ok.ok) return page('That link has expired. Ask Gio for a fresh one.');
        const code = url.searchParams.get('code'), realmId = url.searchParams.get('realmId');
        if (!code || !realmId) return page('QuickBooks didn\'t connect. Nothing was changed.');
        const tokens = await tokenRequest(env, { grant_type: 'authorization_code', code, redirect_uri: redirectUri });
        await store.fetch(`https://store/tokens/${realmId}`, { method: 'PUT', body: JSON.stringify(tokens) });
        return page('Connected ✓ You can close this page.');
      }

      if (request.headers.get('X-Key') !== env.ADMIN_KEY || !env.ADMIN_KEY) return text('Not allowed', 403);

      if (url.pathname === '/companies') return store.fetch('https://store/tokens');

      const m = url.pathname.match(/^\/qb\/(\d+)\/(.+)$/);
      if (m) {
        const [, realmId, path] = m;
        const access = await accessToken(env, store, realmId);
        const base = env.QB_ENV === 'production' ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com';
        const target = new URL(`${base}/v3/company/${realmId}/${path}`);
        url.searchParams.forEach((v, k) => target.searchParams.set(k, v));
        target.searchParams.set('minorversion', MINOR_VERSION);
        const headers = { Authorization: `Bearer ${access}`, Accept: 'application/json' };
        if (request.headers.get('Content-Type')) headers['Content-Type'] = request.headers.get('Content-Type');
        const res = await fetch(target, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body });
        return new Response(res.body, { status: res.status, headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' } });
      }

      return text('Not found', 404);
    } catch (err) {
      return text(`Error: ${err && err.message || err}`, 500);
    }
  },
};

// A fresh access token for this company, refreshing (and saving the new refresh token) when needed.
async function accessToken(env, store, realmId) {
  const res = await store.fetch(`https://store/tokens/${realmId}`);
  if (!res.ok) throw new Error(`QuickBooks company ${realmId} isn't connected`);
  const t = await res.json();
  if (t.expires_at - Date.now() > 60_000) return t.access_token;
  const fresh = await tokenRequest(env, { grant_type: 'refresh_token', refresh_token: t.refresh_token });
  await store.fetch(`https://store/tokens/${realmId}`, { method: 'PUT', body: JSON.stringify(fresh) });
  return fresh.access_token;
}

async function tokenRequest(env, params) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${env.QB_CLIENT_ID}:${env.QB_CLIENT_SECRET}`),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(params),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Intuit said ${res.status}: ${body.error || ''} ${body.error_description || ''}`.trim());
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: Date.now() + body.expires_in * 1000,
    refresh_expires_at: Date.now() + body.x_refresh_token_expires_in * 1000,
    saved_at: new Date().toISOString(),
  };
}

// One instance holds every client's tokens, so refreshes never race each other.
export class Store {
  constructor(state) { this.storage = state.storage; }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/state') {
      if (request.method === 'PUT') { await this.storage.put('state', { value: await request.text(), at: Date.now() }); return text('ok'); }
      const saved = await this.storage.get('state');
      await this.storage.delete('state');
      const fresh = saved && saved.value === await request.text() && Date.now() - saved.at < 15 * 60_000;
      return text(fresh ? 'ok' : 'expired', fresh ? 200 : 400);
    }
    const m = url.pathname.match(/^\/tokens(?:\/(\d+))?$/);
    if (!m) return text('Not found', 404);
    if (!m[1]) {
      const all = await this.storage.list({ prefix: 'tokens:' });
      return Response.json([...all].map(([k, t]) => ({ realmId: k.slice(7), connected_at: t.saved_at, refresh_expires_at: new Date(t.refresh_expires_at).toISOString() })));
    }
    const key = `tokens:${m[1]}`;
    if (request.method === 'PUT') { await this.storage.put(key, JSON.parse(await request.text())); return text('ok'); }
    const t = await this.storage.get(key);
    return t ? Response.json(t) : text('Not connected', 404);
  }
}

function text(body, status = 200) { return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
function page(msg) {
  return new Response(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>QuickBooks</title><body style="font:18px system-ui;display:grid;place-items:center;min-height:90vh;margin:0;padding:16px;text-align:center"><p>${msg}</p></body>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
