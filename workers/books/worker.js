// QuickBooks connector.
//
// Holds each client's QuickBooks connection and keeps it alive, so checks and
// receipt uploads can talk to QuickBooks without anyone logging in again.
//
//   POST /invite                (X-Key) {name, phone, env, brand, extras} one-off connect link for a new client (14 days)
//   GET  /connect?invite=<id>   the client clicks this, then "Allow" at Intuit
//   GET  /callback              Intuit sends them back here; tokens saved, client's app link shown
//   GET  /disconnect            landing page after a client disconnects in QuickBooks
//   POST /revoke/<realmId>      (X-Key) end a client: revoke at Intuit and cut access at once (tokens, logins, notifications,
//                               shared links, app link). Their record, mileage and change log are then held for RETENTION_DAYS (30)
//                               and purged (see PURGE_MODE below)
//   POST /purge/<realmId>?confirm=<realmId>  (X-Key) delete everything Books holds for an ended client now (refused on legal hold)
//   GET  /precheck/<realmId>    (X-Key) read-only: do VAT codes, bank and expense accounts line up in this QuickBooks company?
//   GET  /backup                (X-Key) everything that can't be recreated (not connection tokens), as one JSON file
//   POST /restore[?overwrite=1] (X-Key) put a backup file back; existing records are kept unless overwrite=1
//   (Daily 07:00 cron also writes the backup to the BACKUPS bucket if one is bound, keeping 30 days)
//   GET  /export/<realmId>      (X-Key) everything Books holds about that client, as JSON (handover and data requests)
//   GET  /app/<appKey>          (X-Key) which company an app link belongs to
//   GET  /companies             (X-Key header) which QuickBooks companies are connected
//   ANY  /qb/<realmId>/<path>   (X-Key header) passed through to the QuickBooks API,
//                               e.g. /qb/123/query?query=select * from Purchase
//   POST /file/<realmId>        (X-Key header) files one receipt as an expense with its photo:
//                               {image, supplier, date, total, vat, category, items}
//   GET  /summary/<realmId>     (X-Key) this month: money in, money out, profit, owed, rough tax pot
//   GET  /owed/<realmId>        (X-Key) unpaid invoices, most overdue first
//   POST /remind/<realmId>/<id> (X-Key) emails that invoice to the customer again
//   POST /paid/<realmId>/<id>   (X-Key) {method: cash|bank|card} records the invoice as paid in full
//   POST /undo/<realmId>/<id>   (X-Key) deletes an expense the app has just filed (the Undo button)
//   POST /invoice/<realmId>     (X-Key) {customer, email, description, amount, vat} new invoice, emailed if there's an address
//   GET  /recent/<realmId>      (X-Key) the last few expenses
//   POST /parse/<realmId>       (X-Key) {text} "40 quid diesel at Shell" -> receipt fields to check and file
//   GET  /untidy/<realmId>      (X-Key) expenses sitting in Uncategorised, each with a suggested category
//   POST /tidy/<realmId>/<id>   (X-Key) {category} moves that expense to the right account
//   GET  /quarter/<realmId>     (X-Key) the Making Tax Digital quarter so far, by category, for the accountant
//   GET  /monthly/<realmId>     (X-Key) preview of the monthly text; POST sends it (?to= to send elsewhere)
//   PUT  /client/<realmId>      (X-Key) {name, phone, brand, accountant, extras, appKey, demo} changes only the fields given
//                               (demo: true means the app needs no login; only for the practice company)
//   POST /quote/<realmId>       (X-Key) {customer, email, description, amount, vat, cis, labour, materials} quote, emailed if email given
//   GET  /quotes/<realmId>      (X-Key) quotes waiting for an answer (last 30 days) and booked-in jobs
//   POST /won/<realmId>/<id>    (X-Key) quote accepted: booked in, nothing sent
//   POST /chase/<realmId>/<id>  (X-Key) emails the quote to them again
//   POST /invoiceit/<realmId>/<id> (X-Key) {amount} job done: invoice from the quote (emailed if it has an email)
//   POST /lost/<realmId>/<id>   (X-Key) quote turned down
//   GET  /customers/<realmId>   (X-Key) customers, most recent first (the "jobs" receipts can go against)
//   GET  /jobs/<realmId>        (X-Key) money in, costs and profit per customer, last 12 months
//   POST /job/<realmId>/<id>    (X-Key) {customerId} puts an expense against a job ("" takes it off)
//   POST /pack/<realmId>        (X-Key) {period: quarter|lastquarter|taxyear|lasttaxyear} link to the accountant pack
//   POST /logout/<realmId>      (X-Key) logs that client's app out on every phone
//   POST /testlink/<realmId>    (X-Key) an extra app link for that company that always needs a login (for testing)
//   GET  /changes/<realmId>     (X-Key) everything Books changed in their QuickBooks, newest first (60 days)
//   POST /revert/<realmId>/<id> (X-Key) undoes one of those changes, where it can be undone
//   GET  /miles/<realmId>       (X-Key) this tax year's mileage log and what it's worth; POST {date, miles, why} adds a trip
//   POST /mileoff/<realmId>/<id> (X-Key) deletes a trip
//   GET  /cis/<realmId>         (X-Key) CIS taken off their pay this tax year (they claim it back)
//   GET  /health                (X-Key) the daily check: every client's connection, anything stuck
//   POST /enquiry               (public, from the website form) texts the owner and keeps the enquiry 90 days
//   GET  /admin                 Gio's admin page (asks for the admin key, then uses the routes above)
//   GET  /client/<realmId>      (X-Key) one client's settings and their app link
//   GET  /expenses/<realmId>    (X-Key) ?from&to&q&cat every expense in a period, searchable, with receipt flags
//   GET  /expense/<realmId>/<id> (X-Key) one expense; POST /fix/<realmId>/<id> {date, supplier, total, vat, category} edits it
//   GET  /receipt/<realmId>/<id> (X-Key) the receipt photo on an expense
//   GET  /invoices/<realmId>    (X-Key) ?status=paid|unpaid|all invoices from the last 12 months
//   GET  /invoicedoc/<realmId>/<id> (X-Key) one invoice with its lines
//   POST /share/<realmId>       (X-Key) {type: invoice|quote, id} a link the customer can open (page + PDF)
//   GET  /customerlist/<realmId> (X-Key) customers with what they owe, what they've paid and how to reach them
//   GET  /customer/<realmId>/<id> (X-Key) one customer with their invoices and quotes
//   GET  /trend/<realmId>       (X-Key) money in and out for each of the last 6 months
//   GET  /status/<realmId>      (X-Key) is QuickBooks connected, and as which company
//   POST /push/<realmId>        (X-Key) {subscription} saves a phone for notifications; POST /unpush {endpoint} removes it
//   POST /pushtest/<realmId>    (X-Key) sends a test notification to their phones
//   GET  /d/<id>                (public, by link) an invoice or quote for the customer; /d/<id>.pdf the PDF
//
// The app (one client, over the service binding): /c/... with X-App: <their app key>
//   GET  /c/app                  business name, brand, extras, whether they're logged in
//   POST /c/login/send           texts a 6-digit code to the client's phone
//   POST /c/login/verify         {code} -> {session}; the app keeps it in a cookie for a year
//   ANY  /c/<what>[/<id>]        same as the admin routes above, for their company only (needs X-Session)
//
//   GET  /pack/<id>             (public, by link) the accountant pack: figures, every expense and invoice, receipts
//   GET  /pack/<id>.csv         the same as a spreadsheet
//
// On the 8th after each quarter ends (cron) every client gets a text with their accountant pack link.
// Once a month (cron) every client with a phone gets their monthly text, and OWNER_PHONE gets a
// short check report. Texts need TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN; SMS_FROM is the sender name.
// Every hour (cron) new payments are looked for, and phones with notifications on hear about them.
// Every morning (cron) each connection is kept fresh and checked, and late invoices and quiet quotes
// are chased for clients who switched that on. Mondays, OWNER_PHONE gets the weekly check.
// When something breaks (a connection, QuickBooks, a text) OWNER_PHONE gets a text, at most one
// per problem every 12 hours.
//
// Client settings (PUT /client): vat "yes" | "no" ("" = go by QuickBooks), chase "on" | "off".
// A client who isn't VAT registered never gets VAT reclaimed on receipts or added to invoices.
//
// Settings: QB_CLIENT_ID, QB_CLIENT_SECRET (Intuit development keys, used for sandbox companies),
// QB_PROD_CLIENT_ID, QB_PROD_CLIENT_SECRET (production keys, for real clients), ADMIN_KEY,
// APP_URL (where the phone app lives). Each saved connection remembers which keys it used.
// PURGE_MODE (plain text, optional): "live" lets the daily job delete ended clients' held data after RETENTION_DAYS.
// Anything else (including unset) is a dry run that only texts what is due. Never set it without the owner's go-ahead.
// Demo: a client record with demo:true is only honoured on a sandbox (practice) company. It never emails or texts,
// needs no login, and is rate-limited (DEMO_LIMITS). The app worker forwards the visitor's address as X-Client-IP.
// Tokens, invites and clients live in the Store Durable Object.

import { ADMIN_PAGE } from './admin.js';
import { createFreeAgent, faAuthorizeUrl, faExchange, faCreds } from './freeagent.js';
import { stripeWebhook, createCheckout } from './stripe.js';
import { createXero, xeroAuthorizeUrl, xeroExchange, xeroCreds, xeroDisconnect } from './xero.js';

const AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const SCOPE = 'com.intuit.quickbooks.accounting';
const MINOR_VERSION = '75';
const REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';

// Development keys only work with sandbox companies; real QuickBooks needs production keys.
function creds(env, which) {
  return which === 'production'
    ? { id: env.QB_PROD_CLIENT_ID, secret: env.QB_PROD_CLIENT_SECRET }
    : { id: env.QB_CLIENT_ID, secret: env.QB_CLIENT_SECRET };
}
const randomKey = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12)))).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));

// Admin key check that doesn't leak anything through timing: both sides are hashed first.
async function sameKey(given, wanted) {
  if (!given || !wanted) return false;
  const [a, b] = await Promise.all([sha256(given), sha256(wanted)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Security headers on every response. CSP and frame protection only go on HTML (a CSP on a PDF can break the viewer).
// A page that needs one inline script passes its nonce in X-CSP-Nonce, which is used here and then removed.
function secure(res) {
  const h = new Headers(res.headers);
  const nonce = h.get('X-CSP-Nonce');
  h.delete('X-CSP-Nonce');
  const connect = h.get('X-CSP-Connect') === 'self'; // only the admin page talks back to this server
  h.delete('X-CSP-Connect');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'no-referrer');
  h.set('Strict-Transport-Security', 'max-age=31536000');
  const type = h.get('Content-Type') || '';
  if (/text\/html/.test(type)) {
    h.set('Content-Security-Policy', `default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; script-src ${nonce ? `'nonce-${nonce}'` : "'none'"}; ${connect ? "connect-src 'self'; " : ''}frame-ancestors 'none'; base-uri 'none'; form-action 'none'`);
    h.set('X-Frame-Options', 'DENY');
    h.set('Cache-Control', 'no-store');
  } else if (!h.has('Cache-Control') && /json|text\/plain|csv/.test(type)) {
    h.set('Cache-Control', 'private, no-store');
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

// Usage limits, counted in the Store. true = go ahead. Demo limits are per visitor plus a global ceiling.
async function throttle(store, name, limit, windowSec) {
  const res = await store.fetch('https://store/limit', { method: 'POST', body: JSON.stringify({ name, limit, windowSec }) });
  return res.ok;
}
async function visitor(request) {
  // CF-Connecting-IP is set by Cloudflare itself. X-Client-IP is only believed on calls that came from our own app worker (they carry no CF-Connecting-IP).
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Client-IP') || 'unknown';
  return (await sha256(`${ip}|${new Date().toISOString().slice(0, 10)}`)).slice(0, 16);
}
const TOO_MANY = () => Response.json({ error: 'That is a lot at once. Give it a few minutes and try again.' }, { status: 429, headers: { 'Retry-After': '300' } });
const AI_WHATS = ['parse', 'untidy', 'allow'];
// What one demo visitor, and the demo overall, can do per hour. Real clients only get a runaway-loop ceiling on the AI.
const DEMO_LIMITS = { aiPerVisitor: 15, lightPerVisitor: 60, writesPerVisitor: 60, aiPerHour: 60, aiPerDay: 300, writesPerDay: 1500 };
const CLIENT_AI_PER_HOUR = 200;
const PROBLEM_WHATS = ['read', 'file', 'other'];
const PROBLEMS_PER_HOUR = 3;

// Emails an invoice or quote through QuickBooks. false = not sent (demo companies never email anyone).
// FreeAgent clients are served by freeagent.js. QuickBooks clients never touch it.
let faInstance;
const FA = () => (faInstance = faInstance || createFreeAgent({ ACCOUNT_NAMES, getClient, logChange, markUndone, alertOwner, clientName, ukToday, money }));
// Xero clients are served by xero.js, the same way. A new platform is one module with the same methods, one line in PLATFORMS and one in SOFTWARE.
let xeroInstance;
const XE = () => (xeroInstance = xeroInstance || createXero({ ACCOUNT_NAMES, getClient, logChange, markUndone, alertOwner, clientName, ukToday, money }));
const PLATFORMS = { freeagent: FA, xero: XE };
const SOFTWARE = { quickbooks: 'QuickBooks', freeagent: 'FreeAgent', xero: 'Xero' };
const platformOf = (p) => (SOFTWARE[p] ? p : 'quickbooks');
async function ext(store, realmId) { // the module for this client's platform, or null for QuickBooks
  const r = await store.fetch(`https://store/tokens/${realmId}`);
  const p = r.ok ? (await r.json()).platform : null;
  return PLATFORMS[p] ? PLATFORMS[p]() : null;
}
async function emailAllowed(env, store, realmId) { return !isDemoClient(await getClient(store, realmId)); }
const later = (p) => `That feature is not available for ${SOFTWARE[p] || 'this software'} yet. Receipts, invoices, who owes you and your monthly summary all work.`;

async function sendDoc(env, store, realmId, kind, id, email) {
  if (isDemoClient(await getClient(store, realmId))) return false;
  await qb(env, store, realmId, 'POST', `${kind}/${id}/send?sendTo=${encodeURIComponent(email)}`);
  return true;
}

const isDemoClient = (client) => Boolean(client && client.demo === true);
// A demo record is only honoured on a sandbox (practice) company, so it can never open a real customer's books.
async function isSandboxRealm(store, realmId) {
  const res = await store.fetch(`https://store/tokens/${realmId}`);
  if (!res.ok) return false;
  return (await res.json()).env === 'sandbox';
}

export default {
  async fetch(request, env) {
    return secure(await route(request, env));
  },

  // 1st of the month: monthly text. 8th after a quarter: accountant packs. Every morning: daily check.
  async scheduled(event, env, ctx) {
    const run = event.cron === QUARTER_CRON ? quarterRun : event.cron === DAILY_CRON ? dailyRun : event.cron === HOURLY_CRON ? hourlyRun : monthlyRun;
    ctx.waitUntil(run(env).catch(async err => {
      console.error('scheduled run failed', err && err.stack || err);
      if (env.OWNER_PHONE) await sendSms(env, env.OWNER_PHONE, `Books: the ${event.cron} run failed: ${String(err && err.message || err).slice(0, 200)}`).catch(() => {});
    }));
  },
};

async function route(request, env) {
    const url = new URL(request.url);
    const store = env.STORE.get(env.STORE.idFromName('main'));
    const redirectUri = `${url.origin}/callback`;
    // Calls from the app come over the service binding (host "books"); links we hand out need the public address.
    const origin = url.hostname === 'books' ? (env.BOOKS_URL || 'https://books.gpetrucci93.workers.dev') : url.origin;
    try {
      if (url.pathname === '/connect') {
        // Only invite links start a connection. (A sandbox connection is a sandbox invite: POST /invite {env: 'sandbox'}.)
        if (!url.searchParams.get('invite')) return page('This link is missing its invite. Ask Gio for a fresh one.', 400);
        const res = await store.fetch(`https://store/invites/${encodeURIComponent(url.searchParams.get('invite'))}`);
        if (!res.ok) return page('This link has expired or already been used. Ask Gio for a fresh one.', 410);
        const invite = await res.json();
        const which = invite.env;
        const state = crypto.randomUUID();
        await store.fetch('https://store/state', { method: 'PUT', body: JSON.stringify({ value: state, invite: invite.id, env: which, platform: invite.platform || 'quickbooks' }) });
        if (invite.platform === 'freeagent') return Response.redirect(faAuthorizeUrl(env, which, redirectUri, state), 302);
        if (invite.platform === 'xero') return Response.redirect(xeroAuthorizeUrl(env, redirectUri, state), 302);
        const go = new URL(AUTH_URL);
        go.search = new URLSearchParams({ client_id: creds(env, which).id, response_type: 'code', scope: SCOPE, redirect_uri: redirectUri, state }).toString();
        return Response.redirect(go.toString(), 302);
      }

      if (url.pathname === '/callback') {
        const ok = await store.fetch('https://store/state', { method: 'POST', body: url.searchParams.get('state') || '' });
        if (!ok.ok) return page('That link has expired. Ask Gio for a fresh one.', 400);
        const st = await ok.json();
        const code = url.searchParams.get('code');
        const software = SOFTWARE[platformOf(st.platform)];
        let realmId = url.searchParams.get('realmId');
        if (!code || (!PLATFORMS[st.platform] && !realmId)) return page(`${software} didn't connect. Nothing was changed.`, 400);
        let tokens;
        if (st.platform === 'freeagent') {
          const fa = await faExchange(env, st.env, redirectUri, code);
          realmId = fa.realmId; tokens = fa.tokens;
        } else if (st.platform === 'xero') {
          const xe = await xeroExchange(env, st.env, redirectUri, code);
          realmId = xe.realmId; tokens = xe.tokens;
        } else tokens = await tokenRequest(env, st.env, { grant_type: 'authorization_code', code, redirect_uri: redirectUri });
        await store.fetch(`https://store/tokens/${realmId}`, { method: 'PUT', body: JSON.stringify(tokens) });
        if (!st.invite) return page('Connected ✓ You can close this page.');
        const inv = await (await store.fetch(`https://store/invites/${encodeURIComponent(st.invite)}`)).json().catch(() => ({}));
        const existing = await getClient(store, realmId);
        const keep = (f) => inv[f] || (existing && existing[f]) || '';
        const client = { ...(existing || {}), name: inv.name || '', phone: inv.phone || '', brand: keep('brand'), extras: keep('extras'), vat: keep('vat'), chase: keep('chase') || 'off', appKey: (existing && existing.appKey) || randomKey(), env: st.env, connected_at: new Date().toISOString(), ended_at: undefined, ended_reason: undefined, disconnected_at: undefined };
        await store.fetch(`https://store/clients/${realmId}`, { method: 'PUT', body: JSON.stringify(client) });
        await store.fetch(`https://store/invites/${encodeURIComponent(st.invite)}`, { method: 'DELETE' });
        const app = `${env.APP_URL}/${client.appKey}/`;
        if (env.OWNER_PHONE && env.TWILIO_ACCOUNT_SID) await sendSms(env, env.OWNER_PHONE, `Books: ${client.name || realmId} just connected their ${software}. Their app: ${app}`).catch(() => {});
        if (client.phone && env.TWILIO_ACCOUNT_SID) await sendSms(env, client.phone, `Welcome to Books. Your app: ${app} Open it on your phone and tap "Add to Home Screen". ${supportLine(env)}`).catch(() => {});
        return page(`Connected ✓<br><br>Your Books app:<br><a href="${app}" style="font-weight:800;word-break:break-all">${app}</a><br><br><small>On your phone, open it and tap "Add to Home Screen" so it sits with your other apps. On a computer, just bookmark it.</small>`);
      }

      if (url.pathname === '/disconnect') {
        return page('Books is disconnected from your QuickBooks.<br><br>We no longer read or change anything in your books. Anything already filed stays in QuickBooks.<br><br><small>Questions: hello@localdeskai.co.uk</small>');
      }

      const pk = url.pathname.match(/^\/pack\/([\w-]{12,})(\.csv|\/r\/(\d+))?$/);
      if (pk && request.method === 'GET') {
        const res = await store.fetch(`https://store/packs/${pk[1]}`);
        if (!res.ok) return page('This link has expired. Ask for a fresh one from the Books app.', 404);
        const link = await res.json();
        if (pk[3]) return receiptFile(env, store, link, pk[3]);
        const data = await pack(env, store, link.realmId, link.from, link.to);
        if (pk[2]) return new Response(packCsv(data), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="books-${link.from}-to-${link.to}.csv"` } });
        const nonce = randomKey();
        return new Response(packPage(data, `${url.origin}/pack/${pk[1]}`, nonce), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex', 'X-CSP-Nonce': nonce } });
      }

      const dl = url.pathname.match(/^\/d\/([\w-]{12,})(\.pdf)?$/);
      if (dl && request.method === 'GET') {
        const res = await store.fetch(`https://store/docs/${dl[1]}`);
        if (!res.ok) return page('This link has expired. Ask for a fresh one.', 404);
        const link = await res.json();
        if (dl[2]) {
          const pdf = await qbRaw(env, store, link.realmId, `${link.type === 'quote' ? 'estimate' : 'invoice'}/${link.id}/pdf`, 'application/pdf');
          return new Response(pdf.body, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${link.type}-${link.id}.pdf"` } });
        }
        return new Response(await docPage(env, store, link, `${url.origin}/d/${dl[1]}`), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' } });
      }

      // The page customers land on after paying (Stripe sends them here). Static, no scripts, not indexed. Served from here so it works before the website is next published.
      if (url.pathname === '/thanks' && (request.method === 'GET' || request.method === 'HEAD')) return new Response(request.method === 'HEAD' ? null : THANKS_PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'", 'Referrer-Policy': 'no-referrer' } });

      // Stripe webhook (public, but only accepted with a valid Stripe signature). Keeps the founding places honest.
      if (url.pathname === '/stripe/webhook' && request.method === 'POST') return await stripeWebhook(request, env, { store, foundingOp, markLead });

      // Website enquiry form (public, called from www.localdeskai.co.uk). Texts the owner and keeps the enquiry for 90 days.
      if (url.pathname === '/enquiry') return await enquiry(request, env, store);

      if (url.pathname === '/admin' && request.method === 'GET') {
        const nonce = randomKey();
        return new Response(ADMIN_PAGE.replace('<script>', `<script nonce="${nonce}">`), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex', 'X-CSP-Nonce': nonce, 'X-CSP-Connect': 'self' } });
      }

      // The app, for one client: X-App (their app key) plus X-Session (from logging in with a texted code).
      const c = url.pathname.match(/^\/c\/([a-z]+(?:\/[a-z]+)?)(?:\/([\w-]+))?$/);
      if (c) return await clientRoute(c[1], c[2], request, url, env, store, origin);

      if (!(await sameKey(request.headers.get('X-Key'), env.ADMIN_KEY))) return text('Not allowed', 403);

      if (url.pathname === '/companies') return store.fetch('https://store/tokens');

      // Sales pipeline (HQ uses these). Leads hold a name and phone number, so they are admin-only and never logged.
      if (url.pathname === '/leads' && request.method === 'GET') return store.fetch('https://store/leads');
      if (url.pathname === '/stripe/status' && request.method === 'GET') return Response.json({ secretKey: Boolean(env.STRIPE_SECRET_KEY), webhookSecret: Boolean(env.STRIPE_WEBHOOK_SECRET), prices: { receptionist: env.STRIPE_PRICE_RECEPTIONIST || null, receptionist_setup: env.STRIPE_PRICE_RECEPTIONIST_SETUP || null, books: env.STRIPE_PRICE_BOOKS || null, books_setup: env.STRIPE_PRICE_BOOKS_SETUP || null } }); // names and price ids only, never a secret
      if (url.pathname === '/checkout' && request.method === 'POST') { const { lead_id } = await request.json().catch(() => ({})); const r = await createCheckout(env, store, String(lead_id || ''), { foundingOp }); return Response.json(r, { status: r.status }); }
      if (url.pathname === '/founding' && request.method === 'GET') return Response.json({ places: FOUNDING_PLACES, ...(await foundingOp(store, 'list')) });
      if (url.pathname === '/leads' && request.method === 'POST') return Response.json(await addLead(store, await request.json()));
      const ldm = url.pathname.match(/^\/leads\/([\w-]+)$/);
      if (ldm) {
        if (request.method === 'GET') return store.fetch(`https://store/lead/${ldm[1]}`);
        if (request.method === 'PUT') return Response.json(await updateLead(store, ldm[1], await request.json()));
        if (request.method === 'DELETE') { await foundingOp(store, 'release', ldm[1]); return store.fetch(`https://store/lead/${ldm[1]}`, { method: 'DELETE' }); }
      }

      if (url.pathname === '/invite' && request.method === 'POST') {
        const r = await request.json();
        const which = r.env === 'sandbox' ? 'sandbox' : 'production';
        const platform = platformOf(r.platform);
        if (!(platform === 'freeagent' ? faCreds(env, which) : platform === 'xero' ? xeroCreds(env) : creds(env, which)).id) throw new Error(`No ${platform === 'xero' ? '' : which + ' '}${SOFTWARE[platform]} keys set up yet`);
        const inv = { id: randomKey(), name: String(r.name || '').slice(0, 100), phone: ukMobile(r.phone), brand: String(r.brand || ''), extras: String(r.extras || ''),
          vat: ['yes', 'no'].includes(r.vat) ? r.vat : '', chase: r.chase === 'on' ? 'on' : '', env: which, platform, created: Date.now() };
        await store.fetch(`https://store/invites/${inv.id}`, { method: 'PUT', body: JSON.stringify(inv) });
        return Response.json({ ok: true, link: `${url.origin}/connect?invite=${inv.id}`, expires: new Date(inv.created + INVITE_DAYS * 86400000).toISOString() });
      }

      const ak = url.pathname.match(/^\/app\/([\w-]+)$/);
      if (ak) {
        const res = await store.fetch(`https://store/appkeys/${ak[1]}`);
        return res.ok ? res : Response.json({ error: 'Unknown app link' }, { status: 404 });
      }

      if (url.pathname === '/health') return Response.json(await health(env, store));

      const rv = url.pathname.match(/^\/revoke\/(\d+)$/);
      if (rv && request.method === 'POST') {
        const leaving = await getClient(store, rv[1]);
        const leaveTokens = await store.fetch(`https://store/tokens/${rv[1]}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
        const software = SOFTWARE[platformOf(leaveTokens && leaveTokens.platform)];
        if (leaving && leaving.phone && env.TWILIO_ACCOUNT_SID) await sendSms(env, leaving.phone, `Books is now disconnected from your ${software}. Everything already filed stays in your ${software}, and nothing else will be changed. Thanks for using Books.`).catch(() => {});
        const t = await (await store.fetch(`https://store/tokens/${rv[1]}`)).json().catch(() => null);
        if (t && t.platform === 'xero') await xeroDisconnect(t); // Xero: delete our connection there too
        else if (t && t.platform !== 'freeagent') { // FreeAgent has no revoke call: our access ends when the saved tokens are deleted below
          const c = creds(env, t.env);
          await fetch(REVOKE_URL, { method: 'POST', headers: { Authorization: 'Basic ' + btoa(`${c.id}:${c.secret}`), 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ token: t.refresh_token }) });
        }
        // Access ends now. The client's record, mileage and change log are held for RETENTION_DAYS, then purged.
        const cut = await (await store.fetch(`https://store/cutoff/${rv[1]}`, { method: 'POST', body: JSON.stringify({ reason: 'revoked' }) })).json();
        return Response.json({ ok: true, ...cut, purgeAfterDays: RETENTION_DAYS });
      }

      const pg = url.pathname.match(/^\/purge\/(\d+)$/);
      if (pg && request.method === 'POST') {
        const cl = await getClient(store, pg[1]);
        if (!cl) return Response.json({ error: 'No such client' }, { status: 404 });
        if (url.searchParams.get('confirm') !== pg[1]) return Response.json({ error: 'Add ?confirm=' + pg[1] + ' to delete everything for this client' }, { status: 400 });
        if (cl.hold) return Response.json({ error: 'This client is on legal hold. Clear the hold first' }, { status: 409 });
        if (!cl.ended_at) return Response.json({ error: 'This client has not been ended (POST /revoke first)' }, { status: 409 });
        return Response.json({ ok: true, deleted: await (await store.fetch(`https://store/purge/${pg[1]}`, { method: 'POST' })).json() });
      }

      if (url.pathname === '/backup' && request.method === 'GET') {
        const entries = await (await store.fetch('https://store/dump')).json();
        return Response.json({ version: 1, made: new Date().toISOString(), count: Object.keys(entries).length, entries });
      }
      if (url.pathname === '/restore' && request.method === 'POST') {
        const b = await request.json().catch(() => null);
        if (!b || b.version !== 1 || typeof b.entries !== 'object') return Response.json({ error: 'That is not a Books backup file' }, { status: 400 });
        return store.fetch('https://store/load', { method: 'POST', body: JSON.stringify({ entries: b.entries, overwrite: url.searchParams.get('overwrite') === '1' }) });
      }

      const ex = url.pathname.match(/^\/export\/(\d+)$/);
      if (ex && request.method === 'GET') {
        const cl = await getClient(store, ex[1]);
        if (!cl) return Response.json({ error: 'No such client' }, { status: 404 });
        const [trips, log, pushes] = await Promise.all(['trips', 'log', 'pushsubs'].map(k => store.fetch(`https://store/${k}/${ex[1]}`).then(r => r.json())));
        return Response.json({ exported: new Date().toISOString(), client: { ...cl, appKey: undefined }, mileage: trips, changeLog: log, notificationDevices: pushes.length });
      }

      const a = url.pathname.match(/^\/([a-z]+)\/(\d+)(?:\/([\w-]+))?$/);
      if (a) {
        const res = await handle(a[1], a[2], a[3], request, url, env, store, origin);
        if (res) return res;
      }

      const m = url.pathname.match(/^\/qb\/(\d+)\/(.+)$/);
      if (m) {
        const [, realmId, path] = m;
        const t = await accessToken(env, store, realmId);
        const base = t.env === 'production' ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com';
        const access = t.access_token;
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
      const msg = String(err && err.message || err);
      // Problems on our side (not someone typing something wrong) get texted to Gio.
      if (SYSTEM_ERROR.test(msg)) {
        const what = url.pathname.replace(/\/\d+/g, '').replace(/^\/c/, '') || '/';
        const realm = (url.pathname.match(/\/(\d{5,})/) || [])[1] || '';
        await alertOwner(env, store, `err:${realm}:${what}`, `Books problem${realm ? ` for ${await clientName(store, realm)}` : ''} (${what}): ${msg.slice(0, 200)}`).catch(() => {});
      }
      return text(`Error: ${friendly(msg)}`, 500);
    }
}

const AGREEMENT_VERSION = '2026-10'; // change when the terms or privacy policy change materially

// What a customer sees. QuickBooks' own wording ("Object Not Found", "Stale object", a code number) means nothing to a plumber,
// so it is replaced by a sentence that says what happened and whether anything was saved. The full text still goes to Gio.
function friendly(msg) {
  const m = /^(QuickBooks|FreeAgent|Xero)(?: said)? (\d{3})/.exec(msg);
  if (!m) return msg;
  const sw = m[1], code = Number(m[2]);
  if (code === 401 || code === 403) return "Books can't reach your accounts software right now. Gio has been told. Nothing was saved";
  if (code === 429) return 'Your accounts software is busy. Wait a minute and try again. Nothing was saved';
  if (code >= 500) return `${sw} isn't answering at the moment. Try again in a few minutes. Nothing was saved`;
  if (/inactive|not found|no longer|deleted|stale/i.test(msg)) return `That has changed in ${sw} since you opened it. Pull down to refresh and try again. Nothing was saved`;
  return `${sw} wouldn't accept that. Nothing was saved. Gio has been told`;
}

// Errors that mean something is broken, rather than a missing amount or a typo.
const SYSTEM_ERROR = /^(QuickBooks \d|FreeAgent \d|Xero \d|Xero said \d|QuickBooks company|FreeAgent company|Xero organisation|Text failed|Texts are not set up|Could not understand)/;
const ALERT_HOURS = 12;

// Texts Gio about a problem, at most once per key every ALERT_HOURS.
async function alertOwner(env, store, key, msg) {
  if (!env.OWNER_PHONE) return;
  const res = await store.fetch(`https://store/alerts/${encodeURIComponent(key)}`, { method: 'POST' });
  if (!res.ok) return; // already told him recently
  await sendSms(env, env.OWNER_PHONE, msg);
}

async function clientName(store, realmId) {
  const c = await getClient(store, realmId);
  return (c && c.name) || realmId;
}

// ---------- the app: one client, logged in by text code ----------

const CLIENT_WHATS = ['file', 'agree', 'summary', 'owed', 'recent', 'invoice', 'remind', 'paid', 'undo', 'parse', 'untidy', 'tidy', 'quarter',
  'quote', 'quotes', 'won', 'chase', 'invoiceit', 'customers', 'jobs', 'job', 'pack', 'accountant',
  'changes', 'revert', 'miles', 'mileoff', 'cis', 'settings', 'problem',
  'expenses', 'expense', 'fix', 'receipt', 'invoices', 'invoicedoc', 'share', 'customerlist', 'customer', 'trend', 'status',
  'pushkey', 'push', 'unpush', 'pushtest', 'me', 'noreceipt', 'attach'];
// Extras a client pays for on top of the starter. "quotes" = quotes and jobs.
const EXTRA_ONLY = { quote: 'quotes', quotes: 'quotes', won: 'quotes', chase: 'quotes', invoiceit: 'quotes', jobs: 'quotes', job: 'quotes' };
const SESSION_DAYS = 365, CODE_MINUTES = 10, CODES_PER_HOUR = 5, CODE_TRIES = 5;
// After a client is ended we hold their record, mileage and change log this long (so they can be handed over), then purge.
// Nothing is deleted automatically until PURGE_MODE is set to "live"; until then the weekly text only says what is due.
const RETENTION_DAYS = 30;

// The number shown to clients as "ring us" (SUPPORT_PHONE, else the owner's). The page never has it written in; the demo gets none.
function supportLine(env) {
  const n = supportNumber(env);
  return n ? `Stuck? Text or ring Gio on 0${n.slice(3, 7)} ${n.slice(7)}.` : 'Stuck? Just reply to this message.';
}
function supportNumber(env) {
  try { return ukMobile(env.SUPPORT_PHONE || env.OWNER_PHONE || ''); } catch { return ''; }
}

async function clientRoute(what, id, request, url, env, store, origin) {
  const appKey = request.headers.get('X-App') || '';
  if (!/^[\w-]{8,}$/.test(appKey)) return text('Not allowed', 403);
  const res = await store.fetch(`https://store/appkeys/${appKey}`);
  if (!res.ok) return Response.json({ error: 'Unknown app link' }, { status: 404 });
  const realmId = (await res.json()).realmId;
  const client = (await getClient(store, realmId)) || {};
  // demo: the practice company's main link needs no login; any extra (test) link for it still does.
  const isDemo = isDemoClient(client) && appKey === client.appKey && await isSandboxRealm(store, realmId);
  const loggedIn = isDemo || await validSession(store, appKey, request.headers.get('X-Session'));

  if (what === 'app') {
    if (loggedIn) await store.fetch(`https://store/seen/${realmId}`, { method: 'POST' });
    return Response.json({ realmId, name: client.name || '', brand: client.brand || '', extras: client.extras || '', loggedIn: Boolean(loggedIn),
      phoneEnd: isDemo ? '' : (client.phone || '').replace(/\D/g, '').slice(-3), canLogin: !isDemo && Boolean(client.phone),
      support: isDemo ? '' : supportNumber(env),
      agreed: isDemo || Boolean(client.agreed),
      vat: await vatRegistered(env, store, realmId, client).catch(() => true), chase: client.chase === 'on' });
  }
  if (isDemo && what.startsWith('login/')) return Response.json({ error: 'This is the demo, so there is nothing to log in to.' }, { status: 400 });
  if (what === 'login/send' && request.method === 'POST') {
    if (!client.phone) throw new Error('No phone number saved. Ask Gio to add it');
    const old = await (await store.fetch(`https://store/codes/${appKey}`)).json().catch(() => null);
    const sent = (old && old.sent || []).filter(t => Date.now() - t < 3600000);
    if (sent.length >= CODES_PER_HOUR) throw new Error('Too many codes. Try again in an hour');
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
    await store.fetch(`https://store/codes/${appKey}`, { method: 'PUT', body: JSON.stringify({ hash: await sha256(code), expires: Date.now() + CODE_MINUTES * 60000, tries: 0, sent: [...sent, Date.now()] }) });
    // Plain "Your ... code is 123456" wording: iPhones and Android keyboards both offer it above the keyboard.
    await sendSms(env, client.phone, `Your Books login code is ${code}. Don't share it with anyone.`);
    return Response.json({ ok: true });
  }
  if (what === 'login/verify' && request.method === 'POST') {
    const code = String((await request.json()).code || '').replace(/\D/g, '');
    const st = await (await store.fetch(`https://store/codes/${appKey}`)).json().catch(() => null);
    if (!st || !st.hash || Date.now() > st.expires) throw new Error('That code has run out. Send a new one');
    if (st.tries >= CODE_TRIES) throw new Error('Too many wrong tries. Send a new code');
    if (await sha256(code) !== st.hash) {
      await store.fetch(`https://store/codes/${appKey}`, { method: 'PUT', body: JSON.stringify({ ...st, tries: st.tries + 1 }) });
      throw new Error('That code is wrong. Check the text and try again');
    }
    await store.fetch(`https://store/codes/${appKey}`, { method: 'PUT', body: JSON.stringify({ sent: st.sent }) });
    const session = randomKey() + randomKey() + randomKey();
    await store.fetch(`https://store/sessions/${await sha256(session)}`, { method: 'PUT', body: JSON.stringify({ appKey, created: Date.now() }) });
    return Response.json({ ok: true, session, days: SESSION_DAYS });
  }

  if (!loggedIn) return Response.json({ error: 'Please log in again', login: true }, { status: 401 });
  { const limited = await limitFor(what, request, store, isDemo, realmId); if (limited) return limited; }
  if (what === 'allow' && request.method === 'POST') return Response.json({ ok: true }); // the check above is the point: the app asks before using the AI
  // Their own settings, for the Settings screen (only once logged in).
  if (what === 'me') return Response.json({ name: client.name || '', accountant: client.accountant || '', chase: client.chase === 'on',
    vat: await vatRegistered(env, store, realmId, client).catch(() => true), phoneEnd: isDemo ? '' : (client.phone || '').replace(/\D/g, '').slice(-3), extras: client.extras || '' });
  // Log out this phone only (the admin /logout logs out every phone).
  if (what === 'bye' && request.method === 'POST') {
    const sess = request.headers.get('X-Session');
    if (sess) await store.fetch(`https://store/sessions/${await sha256(sess)}`, { method: 'DELETE' });
    return Response.json({ ok: true });
  }
  if (!CLIENT_WHATS.includes(what)) return text('Not found', 404);
  if (EXTRA_ONLY[what] && !String(client.extras || '').split(',').map(x => x.trim()).includes(EXTRA_ONLY[what])) {
    return Response.json({ error: 'Not part of your plan. Ask Gio to switch it on.' }, { status: 403 });
  }
  if (what === 'accountant' && request.method === 'PUT') {
    if (isDemo) return Response.json({ ok: true }); // the demo is shared, so nothing typed into it is kept
    const em = String((await request.json()).accountant || '').trim().slice(0, 200);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) throw new Error('That email doesn\'t look right');
    await store.fetch(`https://store/clients/${realmId}`, { method: 'PUT', body: JSON.stringify({ ...client, accountant: em }) });
    return Response.json({ ok: true });
  }
  // The only setting a client changes themselves: whether Books chases for them.
  // First login: the client ticks that they accept the terms and privacy policy. Kept with the date so there is a record.
  if (what === 'agree' && request.method === 'POST') {
    if (isDemo) return Response.json({ ok: true });
    if (!client.agreed) {
      client.agreed = { at: new Date().toISOString(), version: AGREEMENT_VERSION };
      await store.fetch(`https://store/clients/${realmId}`, { method: 'PUT', body: JSON.stringify(client) });
    }
    return Response.json({ ok: true });
  }
  if (what === 'settings' && request.method === 'PUT') {
    if (isDemo) return Response.json({ ok: true, chase: false }); // the demo never emails anyone
    const v = await request.json();
    if (typeof v.chase === 'boolean') client.chase = v.chase ? 'on' : 'off';
    await store.fetch(`https://store/clients/${realmId}`, { method: 'PUT', body: JSON.stringify(client) });
    return Response.json({ ok: true, chase: client.chase === 'on' });
  }
  // The app couldn't do something on its own side (reading a receipt): tell Gio.
  if (what === 'problem' && request.method === 'POST') {
    if (isDemo) return Response.json({ ok: true });
    const v = await request.json().catch(() => ({}));
    if (!(await throttle(store, `problem:${realmId}`, PROBLEMS_PER_HOUR, 3600))) return Response.json({ ok: true });
    await alertOwner(env, store, `app:${realmId}:${PROBLEM_WHATS.includes(v.what) ? v.what : 'other'}`, `Books app problem for ${client.name || realmId}: ${String(v.message || '').slice(0, 200)}`).catch(() => {});
    return Response.json({ ok: true });
  }
  return (await handle(what, realmId, id, request, url, env, store, origin)) || text('Not found', 404);
}

// Usage limits for the app's calls. AI calls cost money, so they are limited for everyone; the demo is limited much harder.
async function limitFor(what, request, store, isDemo, realmId) {
  const ai = what === 'parse' || what === 'allow';   // each one is a model call
  const light = what === 'untidy';                    // a model call only when something needs sorting
  const write = request.method !== 'GET' && !ai;
  if (isDemo) {
    const v = await visitor(request);
    if (ai && !(await throttle(store, `demo:ai:${v}`, DEMO_LIMITS.aiPerVisitor, 3600) && await throttle(store, 'demo:ai:all', DEMO_LIMITS.aiPerHour, 3600) && await throttle(store, 'demo:ai:day', DEMO_LIMITS.aiPerDay, 86400))) return TOO_MANY();
    if (light && !(await throttle(store, `demo:light:${v}`, DEMO_LIMITS.lightPerVisitor, 3600))) return TOO_MANY();
    if (write && !(await throttle(store, `demo:w:${v}`, DEMO_LIMITS.writesPerVisitor, 3600) && await throttle(store, 'demo:w:day', DEMO_LIMITS.writesPerDay, 86400))) return TOO_MANY();
    return null;
  }
  if ((ai || light) && !(await throttle(store, `ai:${realmId}`, CLIENT_AI_PER_HOUR, 3600))) return TOO_MANY();
  return null;
}

async function validSession(store, appKey, session) {
  if (!session) return false;
  const res = await store.fetch(`https://store/sessions/${await sha256(session)}`);
  if (!res.ok) return false;
  const v = await res.json();
  return v.appKey === appKey && Date.now() - v.created < SESSION_DAYS * 86400000;
}

async function sha256(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// One request about one QuickBooks company. Returns null if there's no such route.
async function handle(what, realmId, id, request, url, env, store, origin) {
  const post = request.method === 'POST';
  const body = () => request.json();
  if (what === 'file' && post) return Response.json(await fileReceipt(env, store, realmId, await body()));
  if (what === 'summary') return Response.json(await summary(env, store, realmId, url.searchParams.get('month')));
  if (what === 'owed') return Response.json(await owed(env, store, realmId));
  if (what === 'recent') return Response.json(await recent(env, store, realmId));
  if (what === 'invoice' && post) return Response.json(await newInvoice(env, store, realmId, await body()));
  if (what === 'remind' && post && id) return Response.json(await remind(env, store, realmId, id));
  if (what === 'paid' && post && id) { const v = await body(); return Response.json(await markPaid(env, store, realmId, id, v.method, v.cis)); }
  if (what === 'changes') return Response.json(await changes(store, realmId));
  if (what === 'revert' && post && id) return Response.json(await revert(env, store, realmId, id));
  if (what === 'miles' && post) return Response.json(await addTrip(store, realmId, await body()));
  if (what === 'miles') return Response.json(await miles(store, realmId, url.searchParams.get('year')));
  if (what === 'mileoff' && post && id) return Response.json(await deleteTrip(store, realmId, id));
  if (what === 'cis') return Response.json(await cisSuffered(env, store, realmId));
  if (what === 'expenses') return Response.json(await expenses(env, store, realmId, url.searchParams));
  if (what === 'noreceipt') return Response.json(await noReceipt(env, store, realmId));
  if (what === 'attach' && post && id) return Response.json(await attachReceipt(env, store, realmId, id, (await body()).image));
  if (what === 'expense' && id) return Response.json(await expense(env, store, realmId, id));
  if (what === 'fix' && post && id) return Response.json(await fixExpense(env, store, realmId, id, await body()));
  if (what === 'receipt' && id) return receiptOfPurchase(env, store, realmId, id);
  if (what === 'invoices') return Response.json(await invoices(env, store, realmId, url.searchParams.get('status')));
  if (what === 'invoicedoc' && id) return Response.json(await invoiceDoc(env, store, realmId, id));
  if (what === 'share' && post) return Response.json(await shareLink(env, store, origin, realmId, await body()));
  if (what === 'customerlist') return Response.json(await customerList(env, store, realmId));
  if (what === 'customer' && id) return Response.json(await customerOne(env, store, realmId, id));
  if (what === 'trend') return Response.json(await trend(env, store, realmId));
  if (what === 'status') return Response.json(await status(env, store, realmId));
  if (what === 'pushkey') return Response.json({ key: env.VAPID_PUBLIC || '' });
  if (what === 'push' && post) return Response.json(await savePush(store, realmId, (await body()).subscription));
  if (what === 'unpush' && post) return Response.json(await dropPush(store, realmId, (await body()).endpoint));
  if (what === 'pushtest' && post) return Response.json({ ok: true, sent: await notify(env, store, realmId, { title: 'Books', body: 'Notifications are on. You\'ll hear when someone pays.', tab: 'home' }) });
  if (what === 'undo' && post && id) return Response.json(await undoPurchase(env, store, realmId, id));
  if (what === 'parse' && post) return Response.json(await parseSpoken(env, (await body()).text));
  if (what === 'untidy') return Response.json(await untidy(env, store, realmId));
  if (what === 'tidy' && post && id) return Response.json(await tidy(env, store, realmId, id, (await body()).category));
  if (what === 'quarter') return Response.json(await quarter(env, store, realmId, url.searchParams.get('date')));
  if (what === 'quote' && post) return Response.json(await newQuote(env, store, realmId, await body()));
  if (what === 'quotes') return Response.json(await quotes(env, store, realmId));
  if (what === 'won' && post && id) return Response.json(await quoteWon(env, store, realmId, id));
  if (what === 'chase' && post && id) return Response.json(await quoteChase(env, store, realmId, id));
  if (what === 'invoiceit' && post && id) return Response.json(await quoteInvoice(env, store, realmId, id, (await body().catch(() => ({}))).amount));
  if (what === 'lost' && post && id) return Response.json(await quoteLost(env, store, realmId, id));
  if (what === 'customers') return Response.json(await customers(env, store, realmId));
  if (what === 'jobs') return Response.json(await jobs(env, store, realmId));
  if (what === 'job' && post && id) return Response.json(await setJob(env, store, realmId, id, (await body()).customerId));
  if (what === 'pack' && post) {
    const p = packPeriod((await body()).period);
    return Response.json({ ...p, url: await packLink(store, origin, realmId, p), accountant: ((await getClient(store, realmId)) || {}).accountant || '' });
  }
  if (what === 'client' && request.method === 'GET') {
    const c = (await getClient(store, realmId)) || {};
    return Response.json({ ...c, appUrl: c.appKey ? `${env.APP_URL}/${c.appKey}/` : '' });
  }
  // Run once right after a client connects (read-only): will VAT codes and accounts line up in THIS QuickBooks company?
  // Admin only, FreeAgent clients: a connection test that cleans up after itself (entries named TEST are created and deleted).
  if (what === 'selftest' && post) {
    const X = await ext(store, realmId);
    if (!X) return Response.json({ error: 'That client is not on FreeAgent or Xero' }, { status: 400 });
    return Response.json(await X.selftest(env, store, realmId));
  }
  if (what === 'precheck' && request.method === 'GET') {
    const XP = await ext(store, realmId);
    if (XP) {   // read-only: connection, VAT status and whether each category has a matching account in their software
      const cats = (await XP.categories(env, store, realmId)).map(c => ({ description: c.description || c.Name })), registered = !!(await XP.registered(store, realmId));
      const found = Object.fromEntries(CATEGORIES.map(c => { const k = (ACCOUNT_NAMES[c] || []).find(n => cats.some(x => String(x.description || '').toLowerCase().includes(n))); return [c, k ? cats.find(x => String(x.description || '').toLowerCase().includes(k)).description : null]; }));
      const unmatched = Object.entries(found).filter(([k, v]) => !v && k !== 'Other').map(([k]) => k);
      const problems = unmatched.length ? [`No matching expense account for: ${unmatched.join(', ')}. Those go under a general category`] : [];
      return Response.json({ vatRegistered: registered, vat: {}, banks: [], categories: found, problems, ok: problems.length === 0 });
    }
    const accounts = (await query(env, store, realmId, 'select Id, Name, AccountType, Active from Account maxresults 1000')).Account || [];
    const registered = await vatRegistered(env, store, realmId);
    const codes = (await query(env, store, realmId, 'select Id, Name, Active from TaxCode')).TaxCode || [];
    const vat = {};
    for (const k of VAT_KINDS) { try { vat[k] = pickTaxCode(codes, k).Name; } catch { vat[k] = null; } }
    const expense = accounts.filter(a => a.AccountType === 'Expense' || a.AccountType === 'Cost of Goods Sold');
    const categories = Object.fromEntries(CATEGORIES.map(c => { const a = matchAccount(expense, c); return [c, a ? a.Name : null]; }));
    const banks = accounts.filter(a => a.AccountType === 'Bank' && a.Active !== false).map(a => a.Name);
    const problems = [];
    if (registered) for (const k of VAT_KINDS) if (!vat[k]) problems.push(`No VAT code found for ${VAT_LABEL[k]}: filing or invoicing with it will stop with an error`);
    if (!banks.length) problems.push('No bank account: payments cannot be recorded');
    if (banks.length > 1) problems.push(`${banks.length} bank accounts: card and bank payments go to "${banks[0]}". Check that is the right one`);
    const unmatched = Object.entries(categories).filter(([, v]) => !v).map(([k]) => k);
    if (unmatched.length) problems.push(`No matching expense account for: ${unmatched.join(', ')}. Those land in Uncategorised`);
    return Response.json({ vatRegistered: registered, vat, banks, categories, problems, ok: problems.length === 0 });
  }
  if (what === 'client' && request.method === 'PUT') {
    const v = await body(), old = (await getClient(store, realmId)) || {};
    for (const f of ['name', 'phone', 'brand', 'accountant', 'extras', 'appKey', 'vat', 'chase', 'basis']) if (typeof v[f] === 'string') old[f] = f === 'phone' ? ukMobile(v[f]) : v[f];
    if (old.vat && !['yes', 'no'].includes(old.vat)) throw new Error('vat is "yes", "no" or ""');
    if (old.basis && !['cash', 'accrual'].includes(old.basis)) throw new Error('basis is "cash" or "accrual"');
    if (typeof v.demo === 'boolean') {
      if (v.demo && !(await isSandboxRealm(store, realmId))) throw new Error('Demo mode is only allowed on a sandbox (practice) company');
      old.demo = v.demo;
    }
    if (typeof v.hold === 'boolean') old.hold = v.hold;
    if (old.appKey && !/^[\w-]{8,}$/.test(old.appKey)) throw new Error('Bad app key');
    await store.fetch(`https://store/clients/${realmId}`, { method: 'PUT', body: JSON.stringify(old) });
    return Response.json(old);
  }
  if (what === 'testlink' && post) {
    const key = randomKey();
    await store.fetch(`https://store/appkeys/${key}`, { method: 'PUT', body: realmId });
    return Response.json({ ok: true, link: `${env.APP_URL}/${key}/` });
  }
  if (what === 'logout' && post) {
    const cl = await getClient(store, realmId);
    if (cl && cl.appKey) await store.fetch(`https://store/sessions-of/${cl.appKey}`, { method: 'DELETE' });
    return Response.json({ ok: true });
  }
  if (what === 'monthly') {
    const msg = await monthlyText(env, store, realmId, url.searchParams.get('month'));
    if (!post) return Response.json({ text: msg });
    const client = await getClient(store, realmId);
    const to = url.searchParams.get('to') || (client && client.phone);
    if (!to) throw new Error('No phone number saved for this client');
    await sendSms(env, to, msg);
    return Response.json({ ok: true, sentTo: to, text: msg });
  }
  return null;
}

// ---------- filing a receipt ----------

// Which QuickBooks account each receipt category goes to: the first account whose name
// matches, exactly or in part, in this order. Anything unmatched goes to Uncategorised.
const ACCOUNT_NAMES = {
  'Materials': ['cost of sales', 'materials', 'purchases'],
  'Tools and equipment': ['tools', 'equipment', 'repair and maintenance'],
  'Fuel': ['motor', 'vehicle', 'fuel', 'travel'],
  'Vehicle': ['motor', 'vehicle', 'travel'],
  'Subcontractors': ['subcontract'],
  'Phone and internet': ['telephone', 'internet'],
  'Office': ['office'],
  'Food and drink': ['meals', 'subsistence', 'entertainment'],
  'Other': [],
};

async function fileReceipt(env, store, realmId, r) {
  { const X = await ext(store, realmId); if (X) return X.fileReceipt(env, store, realmId, r); }
  const q = (sql) => qb(env, store, realmId, 'GET', 'query?query=' + encodeURIComponent(sql)).then(d => d.QueryResponse || {});
  const total = round(r.total), vat = round(r.vat);
  if (!(total > 0)) throw new Error('No total on the receipt');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : ukToday();

  const vendorId = await findOrCreateVendor(env, store, realmId, q, (r.supplier || 'Unknown supplier').trim().slice(0, 100));

  // Same supplier, date and total already in QuickBooks: don't file it twice.
  const same = (await q(`select Id, EntityRef from Purchase where TxnDate = '${date}' and TotalAmt = '${total}'`)).Purchase || [];
  const dup = same.find(p => p.EntityRef && p.EntityRef.value === vendorId);
  if (dup) return { ok: true, duplicate: true, id: dup.Id };

  const accounts = (await q("select Id, Name, AccountType, Active from Account maxresults 1000")).Account || [];
  const bank = accounts.find(a => a.AccountType === 'Bank');
  if (!bank) throw new Error('No bank account in QuickBooks to pay from');
  const expense = pickAccount(accounts.filter(a => a.AccountType === 'Expense' || a.AccountType === 'Cost of Goods Sold'), r.category);

  // Not VAT registered: the whole amount is the cost and no VAT is reclaimed, whatever the receipt says.
  const registered = await vatRegistered(env, store, realmId);
  const codes = registered ? (await q('select Id, Name, Active from TaxCode')).TaxCode || [] : [];
  const net = round(total - vat);
  const rate = net > 0 ? vat / net : 0;
  const code = registered ? pickTaxCode(codes, vat <= 0 ? 'none' : Math.abs(rate - 0.05) < 0.01 ? 'reduced' : 'standard') : undefined;

  const purchase = {
    PaymentType: 'Cash',
    AccountRef: { value: bank.Id },
    EntityRef: { value: vendorId, type: 'Vendor' },
    TxnDate: date,
    PrivateNote: `${r.items || ''} (${r.image ? 'added from a receipt photo' : 'added in Books'})`.trim().slice(0, 4000),
    GlobalTaxCalculation: code ? 'TaxExcluded' : 'NotApplicable',
    Line: [{
      Amount: code ? net : total,
      DetailType: 'AccountBasedExpenseLineDetail',
      Description: (r.items || r.category || '').slice(0, 4000),
      AccountBasedExpenseLineDetail: { AccountRef: { value: expense.Id }, ...(code ? { TaxCodeRef: { value: code.Id } } : {}) },
    }],
  };
  if (r.jobId && /^\d+$/.test(String(r.jobId))) purchase.Line[0].AccountBasedExpenseLineDetail.CustomerRef = { value: String(r.jobId) };
  const created = (await qb(env, store, realmId, 'POST', 'purchase', purchase)).Purchase;

  let attached = false;
  if (/^data:image\//.test(r.image || '')) attached = await uploadReceipt(env, store, realmId, created.Id, r.image);
  await logChange(store, realmId, { kind: 'file', ref: created.Id, text: `Filed ${r.supplier || 'an expense'} ${money(created.TotalAmt)} (${expense.Name})` });
  return { ok: true, id: created.Id, total: created.TotalAmt, account: expense.Name, vatCode: code ? code.Name : 'none', attached };
}

// The client's own setting wins; otherwise go by whether VAT is switched on in their QuickBooks.
const vatSeen = new Map();
async function vatRegistered(env, store, realmId, client) {
  const c = client || (await getClient(store, realmId)) || {};
  if (c.vat === 'yes') return true;
  if (c.vat === 'no') return false;
  const hit = vatSeen.get(realmId);
  if (hit && Date.now() - hit.at < 3600000) return hit.on;
  const prefs = ((await query(env, store, realmId, 'select * from Preferences')).Preferences || [])[0] || {};
  const tp = prefs.TaxPrefs || {};
  const on = Boolean(tp.UsingSalesTax || tp.PartnerTaxEnabled);
  vatSeen.set(realmId, { on, at: Date.now() });
  return on;
}

async function findOrCreateVendor(env, store, realmId, q, name) {
  const safe = name.replace(/'/g, "\\'");
  const found = (await q(`select Id from Vendor where DisplayName = '${safe}'`)).Vendor || [];
  if (found.length) return found[0].Id;
  return (await qb(env, store, realmId, 'POST', 'vendor', { DisplayName: name })).Vendor.Id;
}

const namedAccount = (accounts, n) => accounts.filter(a => a.Active !== false && a.Name.toLowerCase() === n)[0]
  || accounts.filter(a => a.Active !== false && a.Name.toLowerCase().includes(n))[0];
// The account a category is meant to go in, or undefined if this company has nothing that looks right.
function matchAccount(accounts, category) {
  for (const n of ACCOUNT_NAMES[category] || []) { const a = namedAccount(accounts, n); if (a) return a; }
}
function pickAccount(accounts, category) {
  return matchAccount(accounts, category) || namedAccount(accounts, 'uncategorised') || namedAccount(accounts, 'uncategorized') || accounts[0];
}

// ---------- money in, money out, who owes ----------

const queryOnce = (env, store, realmId, sql) => qb(env, store, realmId, 'GET', 'query?query=' + encodeURIComponent(sql)).then(d => d.QueryResponse || {});
// QuickBooks answers at most 1000 rows at a time. A query ending "maxresults 1000" means "all of them", so keep asking for the next
// page until a short page comes back (capped at 10,000 rows so a runaway company can't loop forever). Other limits ("maxresults 10")
// are deliberate "latest few" lists and are left alone.
const PAGE = 1000, MAX_PAGES = 10;
async function query(env, store, realmId, sql) {
  const first = await queryOnce(env, store, realmId, sql);
  if (!/\bmaxresults 1000\s*$/i.test(sql)) return first;
  const key = Object.keys(first).find(k => Array.isArray(first[k]));
  if (!key) return first;
  const all = [...first[key]];
  for (let page = 1, last = all.length; last === PAGE && page < MAX_PAGES; page++) {
    const next = await queryOnce(env, store, realmId, sql.replace(/\bmaxresults 1000\s*$/i, `startposition ${page * PAGE + 1} maxresults ${PAGE}`));
    last = (next[key] || []).length;
    all.push(...(next[key] || []));
  }
  return { ...first, [key]: all };
}

// Rough tax guide: about a quarter of profit (basic-rate income tax plus Class 4 NI). Shown as a guide only.
const TAX_POT = 0.25;

async function summary(env, store, realmId, month) {
  { const X = await ext(store, realmId); if (X) return X.summary(env, store, realmId, month, TAX_POT); }
  const m = /^\d{4}-\d{2}$/.test(month || '') ? month : ukToday().slice(0, 7);
  const [y, mo] = m.split('-').map(Number);
  const end = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
  const report = await qb(env, store, realmId, 'GET', await pnl(store, realmId, `reports/ProfitAndLoss?start_date=${m}-01&end_date=${end}`));
  const totals = {};
  for (const row of (report.Rows && report.Rows.Row) || []) {
    const cols = row.Summary && row.Summary.ColData;
    if (row.group && cols) totals[row.group] = Number(cols[cols.length - 1].value) || 0;
  }
  const moneyIn = round(totals.Income || 0);
  const moneyOut = round((totals.COGS || 0) + (totals.Expenses || 0) + (totals.OtherExpenses || 0));
  const profit = round(totals.NetIncome != null ? totals.NetIncome : moneyIn - moneyOut);
  const inv = await owed(env, store, realmId);
  return { month: m, moneyIn, moneyOut, profit, owed: round(inv.reduce((s, i) => s + i.balance, 0)), owedCount: inv.length, taxPot: round(Math.max(0, profit) * TAX_POT) };
}

async function owed(env, store, realmId) {
  { const X = await ext(store, realmId); if (X) return X.owed(env, store, realmId); }
  const list = (await query(env, store, realmId, "select Id, DocNumber, CustomerRef, TxnDate, DueDate, TotalAmt, Balance, BillEmail, PrivateNote from Invoice where Balance > '0' maxresults 1000")).Invoice || [];
  const today = Date.now();
  const cisOf = (i) => Number((String(i.PrivateNote || '').match(/CIS job\. Expected deduction £(\d+(?:\.\d+)?)/) || [])[1]) || 0;
  return list.map(i => ({
    id: i.Id, number: i.DocNumber || '', customer: (i.CustomerRef && i.CustomerRef.name) || 'Customer',
    date: i.TxnDate, due: i.DueDate || i.TxnDate, total: Number(i.TotalAmt), balance: Number(i.Balance),
    email: (i.BillEmail && i.BillEmail.Address) || '', cis: Math.min(cisOf(i), Number(i.Balance)),
    daysOverdue: Math.max(0, Math.floor((today - Date.parse(i.DueDate || i.TxnDate)) / 86400000)),
  })).sort((a, b) => b.daysOverdue - a.daysOverdue);
}

async function remind(env, store, realmId, id, quiet) {
  const inv = (await qb(env, store, realmId, 'GET', `invoice/${id}`)).Invoice;
  const email = inv.BillEmail && inv.BillEmail.Address;
  if (!email) throw new Error('No email address for this customer. Add one in QuickBooks first');
  if (!(await sendDoc(env, store, realmId, 'invoice', id, email))) throw new Error('Emails are switched off in the demo');
  if (!quiet) await logChange(store, realmId, { kind: 'remind', text: `Emailed invoice${num(inv.DocNumber)} to ${email} again` });
  return { ok: true, sentTo: email };
}

const CIS_RATE = 0.2;
const INVITE_DAYS = 14;

// Paid in full by cash, bank transfer or card. Bank and card go straight to the bank account;
// cash goes to QuickBooks' Undeposited Funds until it's banked.
// CIS job: the contractor pays what's left after taking off CIS. The money received goes to the
// bank as usual; the CIS taken off is a second payment into the "CIS deductions suffered" account
// (money HMRC owes back), so the invoice ends up fully paid and the CIS is counted for the tax year.
async function markPaid(env, store, realmId, id, method, cis) {
  const inv = (await qb(env, store, realmId, 'GET', `invoice/${id}`)).Invoice;
  const balance = Number(inv.Balance);
  if (!(balance > 0)) return { ok: true, alreadyPaid: true };
  const how = { cash: 'Cash', bank: 'Bank transfer', card: 'Card' }[method] || 'Cash';
  const deducted = Math.min(round(cis), balance);
  if (deducted < 0) throw new Error('The CIS amount can\'t be below zero');
  let deposit;
  if (method === 'bank' || method === 'card') {
    const banks = (await query(env, store, realmId, "select Id from Account where AccountType = 'Bank' and Active = true")).Account || [];
    if (banks.length) deposit = { value: banks[0].Id };
  }
  const today = ukToday();
  const pay = (amount, note, to) => qb(env, store, realmId, 'POST', 'payment', {
    CustomerRef: inv.CustomerRef, TotalAmt: amount, TxnDate: today, PrivateNote: note,
    ...(to ? { DepositToAccountRef: to } : {}),
    Line: [{ Amount: amount, LinkedTxn: [{ TxnId: inv.Id, TxnType: 'Invoice' }] }],
  }).then(d => d.Payment);
  const received = round(balance - deducted);
  const refs = [];
  if (received > 0) refs.push((await pay(received, `Paid by ${how.toLowerCase()} (marked in Books)`, deposit)).Id);
  if (deducted > 0) refs.push((await pay(deducted, `CIS deducted by the contractor (marked in Books)`, { value: await cisAccount(env, store, realmId) })).Id);
  const who = (inv.CustomerRef && inv.CustomerRef.name) || 'Customer';
  await logChange(store, realmId, { kind: 'paid', ref: refs.join(','), text: `Marked ${who} invoice${num(inv.DocNumber)} paid: ${money(received)} ${how.toLowerCase()}${deducted ? `, ${money(deducted)} CIS taken off` : ''}` });
  return { ok: true, amount: received, cis: deducted, how };
}

const CIS_ACCOUNT = 'CIS deductions suffered';
async function cisAccount(env, store, realmId) {
  const found = ((await query(env, store, realmId, `select Id from Account where Name = '${CIS_ACCOUNT}'`)).Account || [])[0];
  if (found) return found.Id;
  return (await qb(env, store, realmId, 'POST', 'account', { Name: CIS_ACCOUNT, AccountType: 'Other Current Asset', AccountSubType: 'OtherCurrentAssets',
    Description: 'CIS taken off by contractors. Claimed back from HMRC (Self Assessment).' })).Account.Id;
}

// CIS taken off this tax year: payments into the CIS account.
async function cisSuffered(env, store, realmId) {
  const p = packPeriod('taxyear');
  const acc = ((await query(env, store, realmId, `select Id from Account where Name = '${CIS_ACCOUNT}'`)).Account || [])[0];
  if (!acc) return { ...p, total: 0, count: 0 };
  const pays = (await query(env, store, realmId, `select Id, TotalAmt, DepositToAccountRef from Payment where TxnDate >= '${p.from}' and TxnDate <= '${p.to}' maxresults 1000`)).Payment || [];
  const mine = pays.filter(x => x.DepositToAccountRef && x.DepositToAccountRef.value === acc.Id);
  return { ...p, total: round(mine.reduce((s, x) => s + Number(x.TotalAmt), 0)), count: mine.length };
}

// Only expenses this app filed can be undone (they carry our note).
async function undoPurchase(env, store, realmId, id) {
  { const X = await ext(store, realmId); if (X) return X.undo(env, store, realmId, id); }
  const p = (await qb(env, store, realmId, 'GET', `purchase/${id}`)).Purchase;
  if (!/added from a receipt photo|added in Books/.test(p.PrivateNote || '')) throw new Error('Only expenses added from the app can be undone here');
  await qb(env, store, realmId, 'POST', 'purchase?operation=delete', { Id: p.Id, SyncToken: p.SyncToken });
  await markUndone(store, realmId, 'file', p.Id);
  return { ok: true };
}

// The customer and lines for an invoice or quote. CIS job: labour and materials on separate lines;
// the contractor deducts 20% of the labour only.
async function saleParts(env, store, realmId, r) {
  const amount = r.cis ? round((Number(r.labour) || 0) + (Number(r.materials) || 0)) : round(r.amount);
  if (!(amount > 0)) throw new Error('Put in an amount');
  const name = (r.customer || '').trim().slice(0, 100);
  if (!name) throw new Error('Put in the customer\'s name');
  const email = (r.email || '').trim();
  const safe = name.replace(/'/g, "\\'");
  let cust = ((await query(env, store, realmId, `select Id, PrimaryEmailAddr from Customer where DisplayName = '${safe}'`)).Customer || [])[0];
  if (!cust) cust = (await qb(env, store, realmId, 'POST', 'customer', { DisplayName: name, ...(email ? { PrimaryEmailAddr: { Address: email } } : {}) })).Customer;
  const items = (await query(env, store, realmId, "select Id, Name from Item where Type = 'Service' and Active = true maxresults 50")).Item || [];
  const item = items.find(i => /^(services?|labour)$/i.test(i.Name)) || items[0];
  if (!item) throw new Error('No service item in QuickBooks to invoice for');
  const registered = await vatRegistered(env, store, realmId);
  const codes = registered ? (await query(env, store, realmId, 'select Id, Name from TaxCode')).TaxCode || [] : [];
  const code = registered ? pickTaxCode(codes, VAT_KINDS.includes(r.vatRate) ? r.vatRate : r.vat ? 'standard' : 'none') : undefined;
  const labour = round(r.labour), materials = round(r.materials);
  const cis = Boolean(r.cis) && labour > 0;
  const line = (amt, desc) => ({
    Amount: amt, DetailType: 'SalesItemLineDetail', Description: desc.slice(0, 4000),
    SalesItemLineDetail: { ItemRef: { value: item.Id }, Qty: 1, UnitPrice: amt, ...(code ? { TaxCodeRef: { value: code.Id } } : {}) },
  });
  const desc = (r.description || '').trim();
  const cisDeduction = cis ? round(labour * CIS_RATE) : 0;
  const doc = {
    CustomerRef: { value: cust.Id },
    ...(email ? { BillEmail: { Address: email } } : {}),
    GlobalTaxCalculation: code ? 'TaxExcluded' : 'NotApplicable',
    Line: cis
      ? [line(labour, `Labour${desc ? ': ' + desc : ''}`), ...(materials > 0 ? [line(materials, `Materials${desc ? ': ' + desc : ''}`)] : [])]
      : [line(amount, desc)],
    ...(cis ? {
      CustomerMemo: { value: `CIS: labour £${labour.toFixed(2)}, materials £${materials.toFixed(2)}. Deduct 20% of labour only (£${cisDeduction.toFixed(2)}).` },
      PrivateNote: `CIS job. Expected deduction £${cisDeduction.toFixed(2)}.`,
    } : {}),
  };
  return { doc, email, cisDeduction };
}

async function newInvoice(env, store, realmId, r) {
  { const X = await ext(store, realmId); if (X) return X.newInvoice(env, store, realmId, r, await emailAllowed(env, store, realmId)); }
  const { doc, email, cisDeduction } = await saleParts(env, store, realmId, r);
  const created = (await qb(env, store, realmId, 'POST', 'invoice', doc)).Invoice;
  let sentTo = '';
  if (email && await sendDoc(env, store, realmId, 'invoice', created.Id, email)) sentTo = email;
  await logChange(store, realmId, { kind: 'invoice', ref: created.Id, text: `Invoice${num(created.DocNumber)} for ${r.customer} ${money(created.TotalAmt)}${sentTo ? `, emailed to ${sentTo}` : ''}` });
  return { ok: true, id: created.Id, number: created.DocNumber, total: Number(created.TotalAmt), sentTo, cisDeduction, toReceive: round(Number(created.TotalAmt) - cisDeduction) };
}

// ---------- quotes ----------

async function newQuote(env, store, realmId, r) {
  const { doc, email } = await saleParts(env, store, realmId, r);
  const created = (await qb(env, store, realmId, 'POST', 'estimate', { ...doc, TxnStatus: 'Pending' })).Estimate;
  let sentTo = '';
  if (email && await sendDoc(env, store, realmId, 'estimate', created.Id, email)) sentTo = email;
  await logChange(store, realmId, { kind: 'quote', ref: created.Id, text: `Quote${num(created.DocNumber)} for ${r.customer} ${money(created.TotalAmt)}${sentTo ? `, emailed to ${sentTo}` : ''}` });
  return { ok: true, id: created.Id, number: created.DocNumber, total: Number(created.TotalAmt), sentTo };
}

// Waiting: sent, no answer yet (quotes with no answer after QUOTE_DAYS drop off the list).
// Booked: accepted, job not invoiced yet.
const QUOTE_DAYS = 30;
async function quotes(env, store, realmId) {
  const list = (await query(env, store, realmId, 'select * from Estimate orderby TxnDate desc maxresults 200')).Estimate || [];
  const today = Date.now();
  return list.map(e => ({
    id: e.Id, number: e.DocNumber || '', customer: (e.CustomerRef && e.CustomerRef.name) || 'Customer',
    date: e.TxnDate, total: Number(e.TotalAmt), email: (e.BillEmail && e.BillEmail.Address) || '',
    net: round(Number(e.TotalAmt) - Number((e.TxnTaxDetail && e.TxnTaxDetail.TotalTax) || 0)),
    lines: (e.Line || []).filter(l => l.DetailType === 'SalesItemLineDetail').length,
    description: ((e.Line || []).find(l => l.Description) || {}).Description || '',
    days: Math.max(0, Math.floor((today - Date.parse(e.TxnDate)) / 86400000)),
    status: (e.TxnStatus || 'Pending') === 'Accepted' ? 'booked' : (e.TxnStatus || 'Pending') === 'Pending' ? 'waiting' : 'done',
  })).filter(q => q.status === 'booked' || (q.status === 'waiting' && q.days <= QUOTE_DAYS));
}

async function quoteWon(env, store, realmId, id) {
  const e = (await qb(env, store, realmId, 'GET', `estimate/${id}`)).Estimate;
  if ((e.TxnStatus || 'Pending') !== 'Pending') throw new Error('That quote has already been dealt with');
  await qb(env, store, realmId, 'POST', 'estimate', { Id: e.Id, SyncToken: e.SyncToken, sparse: true, TxnStatus: 'Accepted' });
  await logChange(store, realmId, { kind: 'status', ref: e.Id, text: `Quote${num(e.DocNumber)} for ${(e.CustomerRef && e.CustomerRef.name) || 'customer'} marked won` });
  return { ok: true };
}

async function quoteChase(env, store, realmId, id, quiet) {
  const e = (await qb(env, store, realmId, 'GET', `estimate/${id}`)).Estimate;
  const email = e.BillEmail && e.BillEmail.Address;
  if (!email) throw new Error('No email on this quote, so give them a ring');
  if (!(await sendDoc(env, store, realmId, 'estimate', id, email))) throw new Error('Emails are switched off in the demo');
  if (!quiet) await logChange(store, realmId, { kind: 'remind', text: `Emailed quote${num(e.DocNumber)} to ${email} again` });
  return { ok: true, sentTo: email };
}

// Job done: a matching invoice, linked to the quote, and the quote closed. A one-line quote can
// go out at a different final amount (before VAT) if extras came up.
async function quoteInvoice(env, store, realmId, id, amount) {
  const e = (await qb(env, store, realmId, 'GET', `estimate/${id}`)).Estimate;
  if (['Closed', 'Rejected'].includes(e.TxnStatus)) throw new Error('That quote has already been dealt with');
  const lines = (e.Line || []).filter(l => l.DetailType === 'SalesItemLineDetail').map(l => ({ Amount: l.Amount, DetailType: l.DetailType, Description: l.Description, SalesItemLineDetail: { ...l.SalesItemLineDetail } }));
  const final = round(amount);
  if (final > 0 && lines.length === 1) { lines[0].Amount = final; lines[0].SalesItemLineDetail.UnitPrice = final; lines[0].SalesItemLineDetail.Qty = 1; }
  const invoice = {
    CustomerRef: e.CustomerRef,
    ...(e.BillEmail ? { BillEmail: e.BillEmail } : {}),
    GlobalTaxCalculation: e.GlobalTaxCalculation,
    Line: lines,
    LinkedTxn: [{ TxnId: e.Id, TxnType: 'Estimate' }],
    ...(e.CustomerMemo ? { CustomerMemo: e.CustomerMemo } : {}),
    ...(e.PrivateNote ? { PrivateNote: e.PrivateNote } : {}),
  };
  const created = (await qb(env, store, realmId, 'POST', 'invoice', invoice)).Invoice;
  const fresh = (await qb(env, store, realmId, 'GET', `estimate/${id}`)).Estimate;
  if (fresh.TxnStatus !== 'Closed') await qb(env, store, realmId, 'POST', 'estimate', { Id: fresh.Id, SyncToken: fresh.SyncToken, sparse: true, TxnStatus: 'Closed' }).catch(() => {});
  let sentTo = '';
  const email = e.BillEmail && e.BillEmail.Address;
  if (email && await sendDoc(env, store, realmId, 'invoice', created.Id, email)) sentTo = email;
  await logChange(store, realmId, { kind: 'invoice', ref: created.Id, text: `Invoice${num(created.DocNumber)} for ${(e.CustomerRef && e.CustomerRef.name) || 'customer'} ${money(created.TotalAmt)} from quote${num(e.DocNumber)}${sentTo ? `, emailed to ${sentTo}` : ''}` });
  return { ok: true, id: created.Id, number: created.DocNumber, total: Number(created.TotalAmt), sentTo };
}

async function quoteLost(env, store, realmId, id) {
  const e = (await qb(env, store, realmId, 'GET', `estimate/${id}`)).Estimate;
  await qb(env, store, realmId, 'POST', 'estimate', { Id: e.Id, SyncToken: e.SyncToken, sparse: true, TxnStatus: 'Rejected' });
  await logChange(store, realmId, { kind: 'status', ref: e.Id, text: `Quote${num(e.DocNumber)} for ${(e.CustomerRef && e.CustomerRef.name) || 'customer'} marked lost` });
  return { ok: true };
}

// ---------- jobs: profit per customer ----------

async function customers(env, store, realmId) {
  const list = (await query(env, store, realmId, 'select Id, DisplayName from Customer where Active = true orderby MetaData.LastUpdatedTime desc maxresults 100')).Customer || [];
  return list.map(c => ({ id: c.Id, name: c.DisplayName }));
}

// Money in = invoices before VAT. Costs = expense lines put against that customer.
async function jobs(env, store, realmId) {
  const since = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const [invs, buys, bills] = await Promise.all([
    query(env, store, realmId, `select * from Invoice where TxnDate >= '${since}' maxresults 1000`).then(d => d.Invoice || []),
    query(env, store, realmId, `select * from Purchase where TxnDate >= '${since}' maxresults 1000`).then(d => d.Purchase || []),
    query(env, store, realmId, `select * from Bill where TxnDate >= '${since}' maxresults 1000`).then(d => d.Bill || []),
  ]);
  const by = {};
  const job = (ref, date) => {
    const j = by[ref.value] || (by[ref.value] = { id: ref.value, name: ref.name || 'Customer', in: 0, out: 0, last: '' });
    if (date > j.last) j.last = date;
    return j;
  };
  let unassigned = 0;
  for (const i of invs) if (i.CustomerRef) job(i.CustomerRef, i.TxnDate).in += Number(i.TotalAmt) - Number((i.TxnTaxDetail && i.TxnTaxDetail.TotalTax) || 0);
  for (const p of [...buys, ...bills]) {
    for (const l of p.Line || []) {
      const d = l.AccountBasedExpenseLineDetail || l.ItemBasedExpenseLineDetail;
      if (!d) continue;
      if (d.CustomerRef) job(d.CustomerRef, p.TxnDate).out += Number(l.Amount) || 0;
      else unassigned += Number(l.Amount) || 0;
    }
  }
  const list = Object.values(by).map(j => ({ ...j, in: round(j.in), out: round(j.out), profit: round(j.in - j.out) }))
    .sort((a, b) => (b.last > a.last ? 1 : -1));
  return { since, jobs: list, unassigned: round(unassigned) };
}

async function setJob(env, store, realmId, id, customerId, quiet) {
  const p = (await qb(env, store, realmId, 'GET', `purchase/${id}`)).Purchase;
  const before = (p.Line || []).map(l => l.AccountBasedExpenseLineDetail && l.AccountBasedExpenseLineDetail.CustomerRef).find(Boolean);
  for (const l of p.Line || []) {
    const d = l.AccountBasedExpenseLineDetail;
    if (!d) continue;
    if (customerId) d.CustomerRef = { value: String(customerId) }; else delete d.CustomerRef;
  }
  const saved = (await qb(env, store, realmId, 'POST', 'purchase', p)).Purchase;
  const ref = (saved.Line || []).map(l => l.AccountBasedExpenseLineDetail && l.AccountBasedExpenseLineDetail.CustomerRef).find(Boolean);
  if (!quiet) await logChange(store, realmId, { kind: 'job', ref: `${p.Id}:${before ? before.value : ''}`, text: `${(p.EntityRef && p.EntityRef.name) || 'Expense'} ${money(p.TotalAmt)} ${ref ? `put against ${ref.name || 'a job'}` : 'taken off its job'}` });
  return { ok: true, job: ref ? ref.name || '' : '' };
}

async function recent(env, store, realmId) {
  { const X = await ext(store, realmId); if (X) return X.recent(env, store, realmId); }
  const list = (await query(env, store, realmId, 'select * from Purchase orderby MetaData.CreateTime desc maxresults 10')).Purchase || [];
  return list.map(p => {
    const job = (p.Line || []).map(l => l.AccountBasedExpenseLineDetail && l.AccountBasedExpenseLineDetail.CustomerRef).find(Boolean);
    return { id: p.Id, date: p.TxnDate, total: Number(p.TotalAmt), supplier: (p.EntityRef && p.EntityRef.name) || '', jobId: job ? job.value : '', job: job ? job.name || '' : '' };
  });
}

// ---------- quick add by voice or typing ----------

const CATEGORIES = Object.keys(ACCOUNT_NAMES);
const TEXT_MODELS = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct'];

async function askJson(env, prompt) {
  let last = '';
  for (const model of TEXT_MODELS) {
    try {
      const out = await env.AI.run(model, { messages: [{ role: 'user', content: prompt }], max_tokens: 600 });
      const t = typeof out.response === 'string' ? out.response : JSON.stringify(out.response || out);
      const m = t.match(/[\[{][\s\S]*[\]}]/);
      if (m) return JSON.parse(m[0]);
      last = 'no JSON';
    } catch (err) { last = err && err.message || String(err); }
  }
  throw new Error('Could not understand that: ' + last);
}

async function parseSpoken(env, text) {
  if (!(text || '').trim()) throw new Error('Say or type what you spent');
  const today = ukToday();
  const r = await askJson(env, `A UK tradesman said this about something he paid for: "${String(text).slice(0, 500)}"
Today is ${today}. Reply with ONLY a JSON object:
{"supplier": "", "date": "YYYY-MM-DD", "total": 0.00, "vat": 0.00, "category": "", "items": ""}
- "40 quid" means 40.00. Use today's date unless he says another day ("yesterday" etc).
- vat: only if he mentions VAT, else 0.
- category: one of ${CATEGORIES.join(', ')}.
- supplier: the shop if he says one, else "".`);
  return {
    supplier: String(r.supplier || ''), date: /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : today,
    total: Number(r.total) || 0, vat: Number(r.vat) || 0,
    category: CATEGORIES.includes(r.category) ? r.category : 'Other', items: String(r.items || ''), readable: Number(r.total) > 0,
  };
}

// ---------- tidy up: expenses left in Uncategorised ----------

async function untidy(env, store, realmId, countOnly) {
  { const X = await ext(store, realmId); if (X) return X.untidy(env, store, realmId); }
  const list = (await query(env, store, realmId, 'select * from Purchase orderby TxnDate desc maxresults 300')).Purchase || [];
  const items = [];
  for (const p of list) {
    for (const l of p.Line || []) {
      const acc = l.AccountBasedExpenseLineDetail && l.AccountBasedExpenseLineDetail.AccountRef;
      if (acc && /uncategori[sz]ed/i.test(acc.name || '')) {
        items.push({ id: p.Id, date: p.TxnDate, amount: Number(l.Amount), supplier: (p.EntityRef && p.EntityRef.name) || '', note: [l.Description, p.PrivateNote].filter(Boolean).join(' · ') });
        break;
      }
    }
  }
  if (items.length && env.AI && !countOnly) {
    try {
      const guesses = await askJson(env, `For each UK trade business expense below, pick the best category from: ${CATEGORIES.join(', ')}.
Reply with ONLY a JSON array of category names, same order, same length.
${items.slice(0, 30).map((i, n) => `${n + 1}. ${i.supplier || 'unknown supplier'} £${i.amount} ${i.note}`).join('\n')}`);
      items.slice(0, 30).forEach((i, n) => { i.suggested = CATEGORIES.includes(guesses[n]) ? guesses[n] : 'Other'; });
    } catch (err) { /* suggestions are a bonus; the list still works without them */ }
  }
  return items;
}

async function tidy(env, store, realmId, id, category) {
  if (!CATEGORIES.includes(category)) throw new Error('Pick a category');
  { const X = await ext(store, realmId); if (X) { if (!X.tidy) throw new Error(later(platformOf((await store.fetch(`https://store/tokens/${realmId}`).then(r => r.json())).platform))); return X.tidy(env, store, realmId, id, category); } }
  const p = (await qb(env, store, realmId, 'GET', `purchase/${id}`)).Purchase;
  const accounts = (await query(env, store, realmId, 'select Id, Name, AccountType, Active from Account maxresults 1000')).Account || [];
  const target = pickAccount(accounts.filter(a => a.AccountType === 'Expense' || a.AccountType === 'Cost of Goods Sold'), category);
  let changed = 0, from = '';
  for (const l of p.Line || []) {
    const d = l.AccountBasedExpenseLineDetail;
    if (d && d.AccountRef && /uncategori[sz]ed/i.test(d.AccountRef.name || '')) { from = d.AccountRef.value; d.AccountRef = { value: target.Id }; changed++; }
  }
  if (!changed) return { ok: true, account: target.Name, unchanged: true };
  await qb(env, store, realmId, 'POST', 'purchase', p);
  await logChange(store, realmId, { kind: 'tidy', ref: `${p.Id}:${from}:${target.Id}`, text: `Moved ${(p.EntityRef && p.EntityRef.name) || 'expense'} ${money(p.TotalAmt)} to ${target.Name}` });
  return { ok: true, account: target.Name };
}

// ---------- the Making Tax Digital quarter ----------

// Standard MTD quarters: 6 Apr-5 Jul, 6 Jul-5 Oct, 6 Oct-5 Jan, 6 Jan-5 Apr. Updates are due on the 7th of the month after.
function mtdQuarter(dateStr) {
  const d = new Date((dateStr && Date.parse(dateStr)) ? dateStr : Date.now());
  const y = d.getUTCFullYear();
  const starts = [[y - 1, 9, 6], [y, 0, 6], [y, 3, 6], [y, 6, 6], [y, 9, 6]].map(([yy, mm, dd]) => new Date(Date.UTC(yy, mm, dd)));
  let start = starts[0];
  for (const s of starts) if (s <= d) start = s;
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 5));
  const due = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 7));
  const iso = x => x.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(end), due: iso(due) };
}

async function quarter(env, store, realmId, dateStr) {
  const q = mtdQuarter(dateStr);
  const report = await qb(env, store, realmId, 'GET', await pnl(store, realmId, `reports/ProfitAndLoss?start_date=${q.from}&end_date=${q.to}`));
  const lines = [], totals = {};
  const walk = (rows, section) => {
    for (const row of rows || []) {
      const sec = row.group || section;
      if (row.ColData) {
        const amt = Number(row.ColData[row.ColData.length - 1].value) || 0;
        if (amt) lines.push({ section: sec, name: row.ColData[0].value, amount: round(amt) });
      }
      if (row.Rows) walk(row.Rows.Row, sec);
      if (row.group && row.Summary) totals[row.group] = Number(row.Summary.ColData[row.Summary.ColData.length - 1].value) || 0;
    }
  };
  walk(report.Rows && report.Rows.Row, '');
  const income = round(totals.Income || 0), expenses = round((totals.COGS || 0) + (totals.Expenses || 0) + (totals.OtherExpenses || 0));
  // Ready for the quarterly update? Nothing left uncategorised, and every expense has its receipt.
  const [buys, files, messy] = await Promise.all([
    query(env, store, realmId, `select Id from Purchase where TxnDate >= '${q.from}' and TxnDate <= '${q.to}' maxresults 1000`).then(d => d.Purchase || []),
    query(env, store, realmId, 'select Id, AttachableRef from Attachable maxresults 1000').then(d => d.Attachable || []),
    untidy(env, store, realmId, true).catch(() => []),
  ]);
  const withReceipt = new Set();
  for (const a of files) for (const ref of a.AttachableRef || []) if (ref.EntityRef && ref.EntityRef.type === 'Purchase') withReceipt.add(ref.EntityRef.value);
  const toTidy = messy.filter(m => m.date >= q.from && m.date <= q.to).length;
  const noReceipt = buys.filter(b => !withReceipt.has(b.Id)).length;
  return { ...q, income, expenses, profit: round(income - expenses), lines, toTidy, noReceipt, ready: !toTidy && !noReceipt };
}

// ---------- accountant pack ----------

const PACK_DAYS = 400;
const QUARTER_CRON = '0 8 8 1,4,7,10 *';

// UK tax year: 6 April to 5 April.
function packPeriod(period) {
  const iso = x => x.toISOString().slice(0, 10);
  if (period === 'lastquarter') {
    const q = mtdQuarter();
    const before = new Date(Date.parse(q.from) - 86400000);
    const p = mtdQuarter(iso(before));
    return { from: p.from, to: p.to, label: 'Last quarter' };
  }
  if (period === 'taxyear' || period === 'lasttaxyear') {
    const d = new Date();
    let y = d.getUTCFullYear();
    if (d < new Date(Date.UTC(y, 3, 6))) y--;
    if (period === 'lasttaxyear') y--;
    return { from: `${y}-04-06`, to: `${y + 1}-04-05`, label: `Tax year ${y}/${String(y + 1).slice(2)}` };
  }
  const q = mtdQuarter();
  return { from: q.from, to: q.to, label: 'This quarter' };
}

async function packLink(store, origin, realmId, p) {
  const id = randomKey() + randomKey();
  await store.fetch(`https://store/packs/${id}`, { method: 'PUT', body: JSON.stringify({ realmId, from: p.from, to: p.to, created: Date.now() }) });
  return `${origin}/pack/${id}`;
}

async function pack(env, store, realmId, from, to) {
  const when = `TxnDate >= '${from}' and TxnDate <= '${to}'`;
  const [pl, buys, invs, files, client, trips, cisPays] = await Promise.all([
    qb(env, store, realmId, 'GET', await pnl(store, realmId, `reports/ProfitAndLoss?start_date=${from}&end_date=${to}`)),
    query(env, store, realmId, `select * from Purchase where ${when} orderby TxnDate maxresults 1000`).then(d => d.Purchase || []),
    query(env, store, realmId, `select * from Invoice where ${when} orderby TxnDate maxresults 1000`).then(d => d.Invoice || []),
    query(env, store, realmId, 'select Id, AttachableRef from Attachable maxresults 1000').then(d => d.Attachable || []),
    getClient(store, realmId),
    tripsFor(store, realmId, from, to),
    query(env, store, realmId, `select Id from Account where Name = '${CIS_ACCOUNT}'`).then(async d => {
      const acc = (d.Account || [])[0];
      if (!acc) return [];
      const pays = (await query(env, store, realmId, `select * from Payment where ${when} maxresults 1000`)).Payment || [];
      return pays.filter(x => x.DepositToAccountRef && x.DepositToAccountRef.value === acc.Id);
    }),
  ]);
  const receiptOf = {};
  for (const a of files) for (const ref of a.AttachableRef || []) if (ref.EntityRef && ref.EntityRef.type === 'Purchase') receiptOf[ref.EntityRef.value] = a.Id;
  const q = mtdQuarter(from);
  const lines = [], totals = {};
  const walk = (rows, section) => {
    for (const row of rows || []) {
      const sec = row.group || section;
      if (row.ColData) { const amt = Number(row.ColData[row.ColData.length - 1].value) || 0; if (amt) lines.push({ section: sec, name: row.ColData[0].value, amount: round(amt) }); }
      if (row.Rows) walk(row.Rows.Row, sec);
      if (row.group && row.Summary) totals[row.group] = Number(row.Summary.ColData[row.Summary.ColData.length - 1].value) || 0;
    }
  };
  walk(pl.Rows && pl.Rows.Row, '');
  const income = round(totals.Income || 0), expenses = round((totals.COGS || 0) + (totals.Expenses || 0) + (totals.OtherExpenses || 0));
  const tax = t => round((t.TxnTaxDetail && t.TxnTaxDetail.TotalTax) || 0);
  return {
    business: (client && client.name) || await qb(env, store, realmId, 'GET', `companyinfo/${realmId}`).then(r => r.CompanyInfo.CompanyName).catch(() => 'Your business'),
    from, to, income, expenses, profit: round(income - expenses), lines, due: q.from === from && q.to === to ? q.due : '',
    spent: buys.map(p => ({
      id: p.Id, date: p.TxnDate, supplier: (p.EntityRef && p.EntityRef.name) || '',
      category: ((p.Line || []).map(l => l.AccountBasedExpenseLineDetail && l.AccountBasedExpenseLineDetail.AccountRef && l.AccountBasedExpenseLineDetail.AccountRef.name).find(Boolean)) || '',
      total: Number(p.TotalAmt), vat: tax(p), receipt: receiptOf[p.Id] || '',
    })),
    invoiced: invs.map(i => ({ date: i.TxnDate, number: i.DocNumber || '', customer: (i.CustomerRef && i.CustomerRef.name) || '', total: Number(i.TotalAmt), vat: tax(i), unpaid: Number(i.Balance) })),
    trips: trips.trips, miles: trips.miles, mileWorth: trips.worth,
    cis: cisPays.map(x => ({ date: x.TxnDate, customer: (x.CustomerRef && x.CustomerRef.name) || '', amount: Number(x.TotalAmt) })),
    cisTotal: round(cisPays.reduce((s, x) => s + Number(x.TotalAmt), 0)),
    big: buys.filter(p => Number(p.TotalAmt) - tax(p) >= BIG_PURCHASE && !EVERYDAY.test(accountOf(p))).map(p => ({ date: p.TxnDate, supplier: (p.EntityRef && p.EntityRef.name) || '', total: Number(p.TotalAmt), net: round(Number(p.TotalAmt) - tax(p)),
      what: (p.Line || []).map(l => l.Description).filter(Boolean).join(', ') || String(p.PrivateNote || '').replace(/\s*\((added from a receipt photo|added in Books)\)/, '').trim() })),
  };
}

// A receipt photo, fetched fresh from QuickBooks (its own download links only last 15 minutes).
// Only a receipt on an expense dated inside the pack's own period can be fetched through a pack link.
async function receiptFile(env, store, link, id) {
  const realmId = link.realmId;
  let a, p;
  try {
    a = (await qb(env, store, realmId, 'GET', `attachable/${id}`)).Attachable;
    const ref = ((a && a.AttachableRef) || []).map(r => r.EntityRef).find(e => e && e.type === 'Purchase');
    if (a && a.TempDownloadUri && ref) p = (await qb(env, store, realmId, 'GET', `purchase/${ref.value}`)).Purchase;
  } catch (err) { return text('Not found', 404); }
  if (!p || !(p.TxnDate >= link.from && p.TxnDate <= link.to)) return text('Not found', 404);
  const res = await fetch(a.TempDownloadUri);
  return new Response(res.body, { headers: { 'Content-Type': a.ContentType || res.headers.get('Content-Type') || 'application/octet-stream', 'Cache-Control': 'private, max-age=600' } });
}

// Purchases this big (before VAT) are listed on their own in the pack: tools, equipment or a van
// may need to go in as assets (capital allowances) rather than everyday costs.
const BIG_PURCHASE = 500;
// Big costs that are plainly everyday running costs, not equipment, so left off that list.
const EVERYDAY = /rent|insurance|rates|subcontract|wage|salar|cost of sales|purchases|materials|utilit|telephone|legal|professional|accountan|subscription/i;
const accountOf = p => ((p.Line || []).map(l => l.AccountBasedExpenseLineDetail && l.AccountBasedExpenseLineDetail.AccountRef && l.AccountBasedExpenseLineDetail.AccountRef.name).find(Boolean)) || '';

function packCsv(d) {
  const rows = [['Books pack', d.business, `${d.from} to ${d.to}`], [],
    ['SUMMARY'], ['Income', d.income.toFixed(2)], ['Expenses', d.expenses.toFixed(2)], ['Profit', d.profit.toFixed(2)], [],
    ['BY CATEGORY'], ['Section', 'Category', 'Amount'], ...d.lines.map(l => [l.section, l.name, l.amount.toFixed(2)]), [],
    ...(d.big.length ? [['BIG PURCHASES (£500+ before VAT: check if any are equipment or vehicles)'], ['Date', 'Supplier', 'What', 'Before VAT', 'Total'], ...d.big.map(b => [b.date, b.supplier, b.what, b.net.toFixed(2), b.total.toFixed(2)]), []] : []),
    ['EXPENSES'], ['Date', 'Supplier', 'Category', 'VAT', 'Total', 'Receipt'], ...d.spent.map(s => [s.date, s.supplier, s.category, s.vat.toFixed(2), s.total.toFixed(2), s.receipt ? 'Yes' : 'No']), [],
    ['INVOICES'], ['Date', 'Number', 'Customer', 'VAT', 'Total', 'Unpaid'], ...d.invoiced.map(i => [i.date, i.number, i.customer, i.vat.toFixed(2), i.total.toFixed(2), i.unpaid.toFixed(2)]), [],
    ['CIS TAKEN OFF BY CONTRACTORS'], ['Date', 'Contractor', 'Amount'], ...d.cis.map(c => [c.date, c.customer, c.amount.toFixed(2)]), ['Total', '', d.cisTotal.toFixed(2)], [],
    ['MILEAGE (45p a mile for the first 10,000 business miles in the tax year, 25p after)'], ['Date', 'Miles', 'What for', 'Worth'], ...d.trips.map(t => [t.date, String(t.miles), t.why, t.worth.toFixed(2)]), ['Total', String(d.miles), '', d.mileWorth.toFixed(2)]];
  return rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
}

function packPage(d, self, nonce) {
  const e = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const m = n => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dt = s => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const missing = d.spent.filter(s => !s.receipt).length;
  const sections = {};
  for (const l of d.lines) (sections[l.section] = sections[l.section] || []).push(l);
  const label = { Income: 'Income', COGS: 'Cost of sales', Expenses: 'Expenses', OtherExpenses: 'Other expenses', OtherIncome: 'Other income' };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${e(d.business)} · Books pack</title><style>
:root{--ink:#16181b;--muted:#646a73;--line:#e4e6ea;--bg:#f2f3f5;--card:#fff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px 48px;display:grid;gap:16px}
h1{font-size:26px;margin:0}h2{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 10px}
.sub{color:var(--muted);margin:4px 0 0}.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;overflow-x:auto}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.tiles div{background:var(--bg);border-radius:12px;padding:10px 12px}.tiles span{display:block;font-size:13px;color:var(--muted)}.tiles b{font-size:20px}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:7px 8px;border-top:1px solid var(--line);white-space:nowrap}th{font-size:12px;color:var(--muted);border-top:0}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
.btns{display:flex;gap:8px;flex-wrap:wrap}.btn{display:inline-block;background:var(--ink);color:#fff;text-decoration:none;font-weight:700;padding:10px 14px;border-radius:10px}.btn.alt{background:var(--card);color:var(--ink);border:1px solid var(--line)}
a{color:#1f5fbf}.note{font-size:13px;color:var(--muted);margin:8px 0 0}
@media print{body{background:#fff}.btns{display:none}.card{border:0;padding:0}}
@media (max-width:560px){.tiles{grid-template-columns:1fr}}
</style></head><body><main>
<div><h1>${e(d.business)}</h1><p class="sub">Books pack · ${dt(d.from)} to ${dt(d.to)}${d.due ? ` · Making Tax Digital update due ${dt(d.due)}` : ''}</p></div>
<div class="btns"><a class="btn" href="${self}.csv">Download spreadsheet (CSV)</a><a class="btn alt" href="#" id="prt">Print or save as PDF</a></div>
<div class="card"><h2>Summary</h2><div class="tiles"><div><span>Income</span><b>${m(d.income)}</b></div><div><span>Expenses</span><b>${m(d.expenses)}</b></div><div><span>Profit</span><b>${m(d.profit)}</b></div></div>
<p class="note">From QuickBooks, before any adjustments. ${d.spent.length} expenses, ${d.spent.length - missing} with a receipt attached.</p></div>
<div class="card"><h2>By category</h2><table>${Object.keys(sections).map(k => `<tr><th colspan="2">${e(label[k] || k)}</th></tr>` + sections[k].map(l => `<tr><td>${e(l.name)}</td><td class="n">${m(l.amount)}</td></tr>`).join('')).join('') || '<tr><td>Nothing in this period.</td></tr>'}</table></div>
${d.big.length ? `<div class="card"><h2>Big purchases</h2><p class="note" style="margin:0 0 8px">£${BIG_PURCHASE}+ before VAT. Worth checking if any are tools, equipment or a vehicle (capital allowances).</p><table><tr><th>Date</th><th>Supplier</th><th>What</th><th class="n">Before VAT</th><th class="n">Total</th></tr>
${d.big.map(b => `<tr><td>${dt(b.date)}</td><td>${e(b.supplier)}</td><td>${e(b.what)}</td><td class="n">${m(b.net)}</td><td class="n">${m(b.total)}</td></tr>`).join('')}</table></div>` : ''}
<div class="card"><h2>Expenses</h2><table><tr><th>Date</th><th>Supplier</th><th>Category</th><th class="n">VAT</th><th class="n">Total</th><th>Receipt</th></tr>
${d.spent.map(s => `<tr><td>${dt(s.date)}</td><td>${e(s.supplier)}</td><td>${e(s.category)}</td><td class="n">${m(s.vat)}</td><td class="n">${m(s.total)}</td><td>${s.receipt ? `<a href="${self}/r/${s.receipt}" target="_blank" rel="noopener">View</a>` : '–'}</td></tr>`).join('') || '<tr><td colspan="6">None.</td></tr>'}</table></div>
<div class="card"><h2>Invoices</h2><table><tr><th>Date</th><th>No.</th><th>Customer</th><th class="n">VAT</th><th class="n">Total</th><th class="n">Unpaid</th></tr>
${d.invoiced.map(i => `<tr><td>${dt(i.date)}</td><td>${e(i.number)}</td><td>${e(i.customer)}</td><td class="n">${m(i.vat)}</td><td class="n">${m(i.total)}</td><td class="n">${i.unpaid ? m(i.unpaid) : '–'}</td></tr>`).join('') || '<tr><td colspan="6">None.</td></tr>'}</table></div>
${d.cis.length ? `<div class="card"><h2>CIS taken off by contractors</h2><table><tr><th>Date</th><th>Contractor</th><th class="n">Amount</th></tr>
${d.cis.map(c => `<tr><td>${dt(c.date)}</td><td>${e(c.customer)}</td><td class="n">${m(c.amount)}</td></tr>`).join('')}<tr><th>Total</th><th></th><th class="n">${m(d.cisTotal)}</th></tr></table><p class="note">Paid to HMRC on their behalf. Recorded in QuickBooks under "${CIS_ACCOUNT}".</p></div>` : ''}
${d.trips.length ? `<div class="card"><h2>Mileage log</h2><table><tr><th>Date</th><th class="n">Miles</th><th>What for</th><th class="n">At HMRC rate</th></tr>
${d.trips.map(t => `<tr><td>${dt(t.date)}</td><td class="n">${t.miles}</td><td>${e(t.why)}</td><td class="n">${m(t.worth)}</td></tr>`).join('')}<tr><th>Total</th><th class="n">${d.miles}</th><th></th><th class="n">${m(d.mileWorth)}</th></tr></table>
<p class="note">Logged in the Books app, not in QuickBooks. 45p a mile for the first 10,000 business miles in the tax year, 25p after. Only claimable instead of actual vehicle costs for that vehicle.</p></div>` : ''}
<p class="note">Made by Books (Localdesk). Everything here comes straight from QuickBooks, apart from the mileage log.</p>
</main><script nonce="${nonce}">document.getElementById('prt').addEventListener('click',function(e){e.preventDefault();print()})</script></body></html>`;
}

// 8th of Jan, Apr, Jul, Oct: each client gets their pack link for the quarter that just ended.
async function quarterRun(env) {
  const store = env.STORE.get(env.STORE.idFromName('main'));
  const companies = await (await store.fetch('https://store/tokens')).json();
  const origin = env.BOOKS_URL || 'https://books.gpetrucci93.workers.dev';
  const p = packPeriod('lastquarter'), report = [];
  for (const c of companies) {
    const client = await getClient(store, c.realmId);
    if (isDemoClient(client)) continue;
    if (PLATFORMS[c.platform]) { report.push(`${(client && client.name) || c.realmId}: no accountant pack for ${SOFTWARE[c.platform]} yet.`); continue; }
    try {
      const link = await packLink(store, origin, c.realmId, p);
      if (client && client.phone) await sendSms(env, client.phone, `Your books for the quarter to ${new Date(p.to).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })} are ready for your accountant: ${link} (open Books and tap "Send to accountant", or forward this link).`);
      report.push(`${(client && client.name) || c.realmId}: ${client && client.phone ? 'pack sent' : 'no phone'}.`);
    } catch (err) { report.push(`${(client && client.name) || c.realmId}: FAILED (${err.message}).`); }
  }
  if (env.OWNER_PHONE) await sendSms(env, env.OWNER_PHONE, `Books quarter packs: ${report.join(' ') || 'no clients.'}`);
}

// ---------- change log: everything Books did in their QuickBooks ----------

const LOG_DAYS = 60;
const logId = () => `${Date.now()}${String(crypto.getRandomValues(new Uint16Array(1))[0] % 1000).padStart(3, '0')}`;

// kind: file | tidy | job | paid | status (can be undone); invoice | quote | remind | chase (sent to someone, so they stay).
async function logChange(store, realmId, entry) {
  const id = logId();
  await store.fetch(`https://store/log/${realmId}/${id}`, { method: 'PUT', body: JSON.stringify({ id, at: Date.now(), ...entry }) }).catch(() => {});
}

async function markUndone(store, realmId, kind, ref) {
  const list = await (await store.fetch(`https://store/log/${realmId}`)).json();
  const e = list.find(x => x.kind === kind && String(x.ref) === String(ref) && !x.undone);
  if (e) await store.fetch(`https://store/log/${realmId}/${e.id}`, { method: 'PUT', body: JSON.stringify({ ...e, undone: Date.now() }) });
}

const UNDOABLE = ['file', 'tidy', 'job', 'paid', 'status', 'edit'];
async function changes(store, realmId) {
  const list = await (await store.fetch(`https://store/log/${realmId}`)).json();
  return list.filter(e => Date.now() - e.at < LOG_DAYS * 86400000)
    .map(e => ({ id: e.id, kind: e.kind, at: new Date(e.at).toISOString(), text: e.text, undone: Boolean(e.undone), canUndo: !e.undone && UNDOABLE.includes(e.kind) }));
}

async function revert(env, store, realmId, id) {
  const res = await store.fetch(`https://store/log/${realmId}/${id}`);
  if (!res.ok) throw new Error('Can\'t find that change');
  const e = await res.json();
  if (e.undone) return { ok: true, already: true };
  if (!UNDOABLE.includes(e.kind)) throw new Error('That one went to someone, so it can\'t be taken back here. Ring Gio if it needs sorting');
  const ref = String(e.ref || '');
  if (e.kind === 'file') {
    await undoPurchase(env, store, realmId, ref);
    return { ok: true };
  }
  if (e.kind === 'tidy') {
    const [pid, from, to] = ref.split(':');
    const p = (await qb(env, store, realmId, 'GET', `purchase/${pid}`)).Purchase;
    for (const l of p.Line || []) { const d = l.AccountBasedExpenseLineDetail; if (d && d.AccountRef && d.AccountRef.value === to) d.AccountRef = { value: from }; }
    await qb(env, store, realmId, 'POST', 'purchase', p);
  } else if (e.kind === 'job') {
    const [pid, prev] = ref.split(':');
    await setJob(env, store, realmId, pid, prev, true);
  } else if (e.kind === 'paid') {
    for (const pid of ref.split(',').filter(Boolean)) {
      const pay = (await qb(env, store, realmId, 'GET', `payment/${pid}`)).Payment;
      await qb(env, store, realmId, 'POST', 'payment?operation=delete', { Id: pay.Id, SyncToken: pay.SyncToken });
    }
  } else if (e.kind === 'edit') {
    const before = JSON.parse(ref);
    const p = (await qb(env, store, realmId, 'GET', `purchase/${before.Id}`)).Purchase;
    await qb(env, store, realmId, 'POST', 'purchase', { ...p, TxnDate: before.TxnDate, EntityRef: before.EntityRef, GlobalTaxCalculation: before.GlobalTaxCalculation, Line: before.Line });
  } else if (e.kind === 'status') {
    const q = (await qb(env, store, realmId, 'GET', `estimate/${ref}`)).Estimate;
    if (q.TxnStatus === 'Closed') throw new Error('That quote has been invoiced, so it can\'t go back');
    await qb(env, store, realmId, 'POST', 'estimate', { Id: q.Id, SyncToken: q.SyncToken, sparse: true, TxnStatus: 'Pending' });
  }
  await store.fetch(`https://store/log/${realmId}/${e.id}`, { method: 'PUT', body: JSON.stringify({ ...e, undone: Date.now() }) });
  return { ok: true };
}

// ---------- mileage log ----------

// HMRC mileage rates for cars and vans: 45p a mile for the first 10,000 business miles in a tax year, 25p after.
const MILE_RATE = 0.45, MILE_RATE_AFTER = 0.25, MILE_BAND = 10000;

async function addTrip(store, realmId, r) {
  const n = round(r.miles);
  if (!(n > 0) || n > 2000) throw new Error('Put in the miles for the trip');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : ukToday();
  if (Date.parse(date) > Date.now() + 86400000) throw new Error('That date is in the future');
  const trip = { id: logId(), date, miles: n, why: String(r.why || '').trim().slice(0, 120) };
  await store.fetch(`https://store/trips/${realmId}/${trip.id}`, { method: 'PUT', body: JSON.stringify(trip) });
  return { ok: true, trip };
}

async function deleteTrip(store, realmId, id) {
  await store.fetch(`https://store/trips/${realmId}/${id}`, { method: 'DELETE' });
  return { ok: true };
}

// This tax year's trips (year=last for last year's), oldest first, each with what it's worth.
async function miles(store, realmId, year) {
  const p = packPeriod(year === 'last' ? 'lasttaxyear' : 'taxyear');
  return { ...p, ...(await tripsFor(store, realmId, p.from, p.to)) };
}

// Trips between two dates. The 45p band runs over the whole tax year, so it's counted from 6 April.
async function tripsFor(store, realmId, from, to) {
  const all = await (await store.fetch(`https://store/trips/${realmId}`)).json();
  const y = Number(from.slice(0, 4)) - (from.slice(5) < '04-06' ? 1 : 0);
  const yearFrom = `${y}-04-06`;
  const year = all.filter(t => t.date >= yearFrom && t.date <= to).sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
  let run = 0;
  for (const t of year) {
    const at45 = Math.max(0, Math.min(t.miles, MILE_BAND - run));
    t.worth = round(at45 * MILE_RATE + (t.miles - at45) * MILE_RATE_AFTER);
    run += t.miles;
  }
  const trips = year.filter(t => t.date >= from);
  return { trips, miles: round(trips.reduce((s, t) => s + t.miles, 0)), worth: round(trips.reduce((s, t) => s + t.worth, 0)) };
}

// ---------- daily check, chasing and the weekly report ----------

const DAILY_CRON = '0 7 * * *';
const BACKUP_KEYS = /^(client|appkey|trips|log|push|chased|pack|doc|seen|paycheck|invite|lead):/;
const BACKUP_DAYS = 30;

// Writes today's backup to the BACKUPS bucket (if one is bound) and keeps the last 30. Returns how many records, or -1 if no bucket.
async function backupNow(env, store) {
  if (!env.BACKUPS) return -1;
  const entries = await (await store.fetch('https://store/dump')).json();
  const made = new Date().toISOString();
  await env.BACKUPS.put(`books/${made.slice(0, 10)}.json`, JSON.stringify({ version: 1, made, count: Object.keys(entries).length, entries }));
  const old = (await env.BACKUPS.list({ prefix: 'books/' })).objects.map(o => o.key).sort().slice(0, -BACKUP_DAYS);
  for (const key of old) await env.BACKUPS.delete(key);
  return Object.keys(entries).length;
}
const CHASE_INVOICE_DAYS = [7, 14, 28]; // days late
const CHASE_QUOTE_DAYS = [3, 7];        // days since the quote
const CHASES_PER_DAY = 10;

async function dailyRun(env) {
  const store = env.STORE.get(env.STORE.idFromName('main'));
  const report = await health(env, store, { refresh: true, chase: true });
  await store.fetch('https://store/housekeeping', { method: 'POST' }).catch(() => {});
  await backupNow(env, store).catch(async err => { if (env.OWNER_PHONE) await sendSms(env, env.OWNER_PHONE, `Books: the daily backup failed: ${String(err && err.message || err).slice(0, 150)}`).catch(() => {}); });
  const retention = await purgeDue(env, store);
  if (new Date().getUTCDay() === 1 && env.OWNER_PHONE && retention.due.length) {
    await sendSms(env, env.OWNER_PHONE, `Books: ${retention.due.length} ended client${retention.due.length > 1 ? 's are' : ' is'} past the ${RETENTION_DAYS}-day holding period and still held (nothing deleted yet): ${retention.due.join(', ')}. Export first if they want a copy, then switch automatic deletion on.`).catch(() => {});
  }
  if (new Date().getUTCDay() === 1 && env.OWNER_PHONE) {
    const lines = report.clients.map(c => c.ok
      ? `${c.name}: ${c.filed} filed, ${c.toTidy} to sort, ${c.late} late${c.chased ? `, ${c.chased} chased` : ''}, app ${c.seenDays == null ? 'never opened' : c.seenDays === 0 ? 'used today' : `last used ${c.seenDays}d ago`}.`
      : `${c.name}: NOT CONNECTED (${c.problem}).`);
    await sendSms(env, env.OWNER_PHONE, `Books weekly check: ${lines.join(' ') || 'no clients connected.'}`);
  }
}

// Ended clients past RETENTION_DAYS (and not on legal hold). Only deletes when PURGE_MODE is "live"; otherwise it just reports.
async function purgeDue(env, store) {
  const clients = await (await store.fetch('https://store/clients')).json();
  const due = clients.filter(c => c.ended_at && !c.hold && !isDemoClient(c) && Date.now() - Date.parse(c.ended_at) > RETENTION_DAYS * 86400000);
  if (!due.length) return { due: [], purged: [] };
  if (env.PURGE_MODE !== 'live') return { due: due.map(c => c.name || c.realmId), purged: [] };
  const purged = [];
  for (const c of due) {
    await store.fetch(`https://store/purge/${c.realmId}`, { method: 'POST' });
    purged.push(c.name || c.realmId);
  }
  if (env.OWNER_PHONE) await sendSms(env, env.OWNER_PHONE, `Books: deleted what was held for ended clients after ${RETENTION_DAYS} days: ${purged.join(', ')}.`).catch(() => {});
  return { due: [], purged };
}

// Each client's connection, kept fresh, plus what needs doing. With chase, also chases for clients who switched it on.
async function health(env, store, opts = {}) {
  const companies = await (await store.fetch('https://store/tokens')).json();
  const clients = [];
  const rows = await Promise.all(companies.map(async (c) => { // every connected business is checked at once, so the page doesn't wait on them one by one
    const client = (await getClient(store, c.realmId)) || {};
    const row = { realmId: c.realmId, name: client.name || c.realmId, ok: true, platform: c.platform || 'quickbooks', phoneKey: String(client.phone || '').replace(/\D/g, '').slice(-10) }; // last 10 digits only, so HQ can match a client to their lead
    if (PLATFORMS[c.platform]) { // other software: their module refreshes its own tokens; same figures as a QuickBooks row
      try {
        const X = PLATFORMS[c.platform]();
        await X.token(env, store, c.realmId);
        const [late, tidyList, log, seen] = await Promise.all([
          X.owed(env, store, c.realmId).then(l => l.filter(i => i.daysOverdue > 0)),
          X.untidy(env, store, c.realmId).catch(() => []),
          store.fetch(`https://store/log/${c.realmId}`).then(r => r.json()),
          store.fetch(`https://store/seen/${c.realmId}`).then(r => r.json()).catch(() => null),
        ]);
        const week = Date.now() - 7 * 86400000;
        row.toTidy = tidyList.length; row.late = late.length; row.platform = c.platform;
        row.filed = log.filter(e => e.kind === 'file' && !e.undone && e.at > week).length; row.everFiled = log.some(e => e.kind === 'file' && !e.undone);
        row.seenDays = seen && seen.at ? Math.floor((Date.now() - seen.at) / 86400000) : null;
        row.chased = log.filter(e => e.kind === 'chase' && e.at > week).length;
      } catch (err) { row.ok = false; row.problem = String(err && err.message || err).slice(0, 120); }
      return row;
    }
    try {
      // Intuit drops a connection that isn't used for 100 days; refreshing well before keeps it alive.
      await accessToken(env, store, c.realmId, opts.refresh && Date.parse(c.refresh_expires_at) - Date.now() < 30 * 86400000);
      const [messy, late, log, seen] = await Promise.all([
        untidy(env, store, c.realmId).catch(() => []),
        owed(env, store, c.realmId).then(l => l.filter(i => i.daysOverdue > 0)),
        store.fetch(`https://store/log/${c.realmId}`).then(r => r.json()),
        store.fetch(`https://store/seen/${c.realmId}`).then(r => r.json()).catch(() => null),
      ]);
      const week = Date.now() - 7 * 86400000;
      row.toTidy = messy.length; row.late = late.length;
      row.filed = log.filter(e => e.kind === 'file' && !e.undone && e.at > week).length; row.everFiled = log.some(e => e.kind === 'file' && !e.undone);
      row.seenDays = seen && seen.at ? Math.floor((Date.now() - seen.at) / 86400000) : null;
      if (opts.chase && client.chase === 'on' && !isDemoClient(client)) row.chasedToday = await chaseAll(env, store, c.realmId, client, late);
      row.chased = log.filter(e => e.kind === 'chase' && e.at > week).length + (row.chasedToday || 0);
      if (opts.chase && !isDemoClient(client)) {
        const bits = [];
        if (late.length) bits.push(`${late.length} invoice${late.length > 1 ? 's' : ''} late (${money(late.reduce((t, i) => t + i.balance, 0))})`);
        if (messy.length) bits.push(`${messy.length} expense${messy.length > 1 ? 's' : ''} to sort`);
        if (row.chasedToday) bits.push(`Books chased ${row.chasedToday} for you`);
        if (bits.length) await notify(env, store, c.realmId, { title: 'Books', body: bits.join(' · '), tab: late.length ? 'owed' : 'home' }).catch(() => 0);
      }
    } catch (err) {
      row.ok = false; row.problem = String(err && err.message || err).slice(0, 120);
      await alertOwner(env, store, `conn:${c.realmId}`, `Books: ${row.name}'s QuickBooks isn't working (${row.problem}). They may need a fresh connect link.`).catch(() => {});
    }
    return row;
  }));
  clients.push(...rows);
  const have = new Set(companies.map(c => c.realmId));
  for (const c of await (await store.fetch('https://store/clients')).json()) {
    if (c.disconnected_at && !c.ended_at && !have.has(c.realmId)) clients.push({ realmId: c.realmId, name: c.name || c.realmId, ok: false, problem: `disconnected in QuickBooks on ${String(c.disconnected_at).slice(0, 10)}` });
  }
  return { checked: new Date().toISOString(), clients };
}

// Emails late invoices (and quiet quotes, if they have quotes) again through QuickBooks, a few times at most.
async function chaseAll(env, store, realmId, client, late) {
  const due = [];
  for (const i of late) if (i.email) due.push({ key: `inv-${i.id}`, days: i.daysOverdue, steps: CHASE_INVOICE_DAYS, send: () => remind(env, store, realmId, i.id, true), text: `Chased ${i.customer} for invoice ${i.number} (${i.daysOverdue} days late) by email` });
  if (String(client.extras || '').split(',').map(x => x.trim()).includes('quotes')) {
    for (const q of await quotes(env, store, realmId)) {
      if (q.status === 'waiting' && q.email) due.push({ key: `quote-${q.id}`, days: q.days, steps: CHASE_QUOTE_DAYS, send: () => quoteChase(env, store, realmId, q.id, true), text: `Chased ${q.customer} about quote ${q.number} (${q.days} days, no answer) by email` });
    }
  }
  let sent = 0;
  for (const d of due) {
    if (sent >= CHASES_PER_DAY) break;
    const done = await store.fetch(`https://store/chased/${realmId}/${d.key}`).then(r => r.json()).catch(() => []);
    const reached = d.steps.filter(s => d.days >= s);
    // Only the latest step that's due, once. Switching chasing on doesn't fire off a backlog.
    if (!reached.length || done.includes(reached[reached.length - 1])) continue;
    try {
      await d.send();
      await store.fetch(`https://store/chased/${realmId}/${d.key}`, { method: 'PUT', body: JSON.stringify(reached) });
      await logChange(store, realmId, { kind: 'chase', text: d.text });
      sent++;
    } catch (err) { /* e.g. no email any more; try again tomorrow */ }
  }
  return sent;
}

// ---------- everything, not just the latest: expenses, invoices, customers ----------

// Today's date in the UK (not UTC): a receipt filed at 12:30am on a summer morning belongs to that day, not the one before.
const ukToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
const isoDay = (d) => d.toISOString().slice(0, 10);

// Expenses in a period (default: last 12 months), newest first. q searches supplier, note and category.
async function expenses(env, store, realmId, params) {
  const to = /^\d{4}-\d{2}-\d{2}$/.test(params.get('to') || '') ? params.get('to') : ukToday();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.get('from') || '') ? params.get('from') : isoDay(new Date(Date.now() - 365 * 86400000));
  const [buys, files] = await Promise.all([
    query(env, store, realmId, `select * from Purchase where TxnDate >= '${from}' and TxnDate <= '${to}' orderby TxnDate desc maxresults 1000`).then(d => d.Purchase || []),
    query(env, store, realmId, 'select Id, AttachableRef from Attachable maxresults 1000').then(d => d.Attachable || []),
  ]);
  const withReceipt = new Set();
  for (const a of files) for (const ref of a.AttachableRef || []) if (ref.EntityRef && ref.EntityRef.type === 'Purchase') withReceipt.add(ref.EntityRef.value);
  let items = buys.map(p => purchaseRow(p, withReceipt.has(p.Id)));
  const accounts = [...new Set(items.map(i => i.account).filter(Boolean))].sort();
  const q = String(params.get('q') || '').trim().toLowerCase();
  if (q) items = items.filter(i => `${i.supplier} ${i.note} ${i.account} ${i.job}`.toLowerCase().includes(q));
  const cat = params.get('cat');
  if (cat) items = items.filter(i => i.account === cat);
  return { from, to, items, total: round(items.reduce((s, i) => s + i.total, 0)), accounts };
}

// Saves a receipt photo (data: URL) onto an expense in QuickBooks. True if it was saved.
async function uploadReceipt(env, store, realmId, purchaseId, image) {
  const img = (image || '').match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!img) return false;
  const bytes = Uint8Array.from(atob(img[2]), c => c.charCodeAt(0));
  const form = new FormData();
  form.append('file_metadata_01', new Blob([JSON.stringify({ AttachableRef: [{ EntityRef: { type: 'Purchase', value: purchaseId } }], FileName: 'receipt.jpg', ContentType: img[1] })], { type: 'application/json' }), 'meta.json');
  form.append('file_content_01', new Blob([bytes], { type: img[1] }), 'receipt.jpg');
  await qb(env, store, realmId, 'POST', 'upload', form);
  return true;
}

// Expenses in the last 90 days with no receipt attached (bank-feed ones included): the accountant
// and HMRC can ask for these, so the app asks for a photo.
const NO_RECEIPT_DAYS = 90;
async function noReceipt(env, store, realmId) {
  { const X = await ext(store, realmId); if (X) return X.noReceipt(env, store, realmId); }
  const from = isoDay(new Date(Date.now() - NO_RECEIPT_DAYS * 86400000));
  const d = await expenses(env, store, realmId, new URLSearchParams({ from }));
  return d.items.filter(i => !i.hasReceipt && i.total > 0).map(i => ({ id: i.id, date: i.date, supplier: i.supplier, total: i.total, account: i.account }));
}

async function attachReceipt(env, store, realmId, id, image) {
  const p = (await qb(env, store, realmId, 'GET', `purchase/${id}`)).Purchase;
  if (!(await uploadReceipt(env, store, realmId, p.Id, image))) throw new Error('No photo received');
  await logChange(store, realmId, { kind: 'attach', ref: p.Id, text: `Added the receipt to ${(p.EntityRef && p.EntityRef.name) || 'an expense'} ${money(p.TotalAmt)}` });
  return { ok: true };
}

function purchaseRow(p, hasReceipt) {
  const lines = (p.Line || []).filter(l => l.AccountBasedExpenseLineDetail);
  const d = (lines[0] || {}).AccountBasedExpenseLineDetail || {};
  return {
    id: p.Id, date: p.TxnDate, supplier: (p.EntityRef && p.EntityRef.name) || '', total: Number(p.TotalAmt),
    vat: round((p.TxnTaxDetail && p.TxnTaxDetail.TotalTax) || 0), account: (d.AccountRef && d.AccountRef.name) || '',
    note: [...new Set([lines.map(l => l.Description).filter(Boolean).join(', '), String(p.PrivateNote || '').replace(/\s*\((added from a receipt photo|added in Books)\)/, '').trim()].filter(Boolean))].join(' · '),
    job: (d.CustomerRef && d.CustomerRef.name) || '', jobId: (d.CustomerRef && d.CustomerRef.value) || '',
    hasReceipt: Boolean(hasReceipt), lines: lines.length, fromApp: /added from a receipt photo|added in Books/.test(p.PrivateNote || ''),
  };
}

async function expense(env, store, realmId, id) {
  const p = (await qb(env, store, realmId, 'GET', `purchase/${id}`)).Purchase;
  const att = (await query(env, store, realmId, `select Id from Attachable where AttachableRef.EntityRef.Type = 'Purchase' and AttachableRef.EntityRef.value = '${id}'`).catch(() => ({}))).Attachable || [];
  const row = purchaseRow(p, att.length > 0);
  const cat = Object.keys(ACCOUNT_NAMES).find(c => (ACCOUNT_NAMES[c] || []).some(n => row.account.toLowerCase().includes(n))) || 'Other';
  return { ...row, category: cat, editable: row.lines === 1, net: round(row.total - row.vat) };
}

// Edit a one-line expense: date, supplier, total, VAT, category. The old version is kept so it can be undone.
async function fixExpense(env, store, realmId, id, r) {
  const p = (await qb(env, store, realmId, 'GET', `purchase/${id}`)).Purchase;
  const lines = (p.Line || []).filter(l => l.AccountBasedExpenseLineDetail);
  if (lines.length !== 1 || (p.Line || []).length !== 1) throw new Error('This one has more than one line. Change it in QuickBooks');
  const before = { Id: p.Id, TxnDate: p.TxnDate, EntityRef: p.EntityRef, GlobalTaxCalculation: p.GlobalTaxCalculation, Line: p.Line };
  const total = round(r.total), vat = Math.max(0, round(r.vat));
  if (!(total > 0)) throw new Error('Put in the total');
  if (vat >= total) throw new Error('The VAT can\'t be more than the total');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : p.TxnDate;
  const q = (sql) => query(env, store, realmId, sql);
  const vendorId = r.supplier && r.supplier.trim() && r.supplier.trim() !== (p.EntityRef && p.EntityRef.name)
    ? await findOrCreateVendor(env, store, realmId, q, r.supplier.trim().slice(0, 100)) : p.EntityRef && p.EntityRef.value;
  const line = JSON.parse(JSON.stringify(lines[0]));
  const d = line.AccountBasedExpenseLineDetail;
  if (r.category && CATEGORIES.includes(r.category)) {
    const accounts = (await q('select Id, Name, AccountType, Active from Account maxresults 1000')).Account || [];
    d.AccountRef = { value: pickAccount(accounts.filter(a => a.AccountType === 'Expense' || a.AccountType === 'Cost of Goods Sold'), r.category).Id };
  }
  const registered = await vatRegistered(env, store, realmId);
  const codes = registered ? (await q('select Id, Name from TaxCode')).TaxCode || [] : [];
  const net = round(total - vat), rate = net > 0 ? vat / net : 0;
  const code = registered ? pickTaxCode(codes, vat <= 0 ? 'none' : Math.abs(rate - 0.05) < 0.01 ? 'reduced' : 'standard') : undefined;
  if (code) d.TaxCodeRef = { value: code.Id }; else delete d.TaxCodeRef;
  line.Amount = code ? net : total;
  const saved = (await qb(env, store, realmId, 'POST', 'purchase', {
    ...p, TxnDate: date, EntityRef: vendorId ? { value: vendorId, type: 'Vendor' } : p.EntityRef,
    GlobalTaxCalculation: code ? 'TaxExcluded' : 'NotApplicable', Line: [line], TxnTaxDetail: undefined,
  })).Purchase;
  await logChange(store, realmId, { kind: 'edit', ref: JSON.stringify(before), text: `Changed ${(saved.EntityRef && saved.EntityRef.name) || 'expense'}: ${money(p.TotalAmt)} → ${money(saved.TotalAmt)}` });
  return { ok: true, total: Number(saved.TotalAmt) };
}

// The receipt photo on an expense, fetched fresh (QuickBooks' own links only last 15 minutes).
async function receiptOfPurchase(env, store, realmId, id) {
  const att = ((await query(env, store, realmId, `select * from Attachable where AttachableRef.EntityRef.Type = 'Purchase' and AttachableRef.EntityRef.value = '${id}'`)).Attachable || [])[0];
  if (!att || !att.TempDownloadUri) return text('No receipt', 404);
  const res = await fetch(att.TempDownloadUri);
  return new Response(res.body, { headers: { 'Content-Type': att.ContentType || res.headers.get('Content-Type') || 'image/jpeg', 'Cache-Control': 'private, max-age=600' } });
}

async function invoices(env, store, realmId, which) {
  const since = isoDay(new Date(Date.now() - 365 * 86400000));
  const list = (await query(env, store, realmId, `select * from Invoice where TxnDate >= '${since}' orderby TxnDate desc maxresults 500`)).Invoice || [];
  const rows = list.map(i => ({
    id: i.Id, number: i.DocNumber || '', customer: (i.CustomerRef && i.CustomerRef.name) || 'Customer', customerId: (i.CustomerRef && i.CustomerRef.value) || '',
    date: i.TxnDate, due: i.DueDate || i.TxnDate, total: Number(i.TotalAmt), balance: Number(i.Balance), email: (i.BillEmail && i.BillEmail.Address) || '',
    paid: Number(i.Balance) <= 0,
  }));
  return which === 'paid' ? rows.filter(r => r.paid) : which === 'unpaid' ? rows.filter(r => !r.paid) : rows;
}

async function invoiceDoc(env, store, realmId, id) {
  const i = (await qb(env, store, realmId, 'GET', `invoice/${id}`)).Invoice;
  return docData(i, 'invoice');
}

function docData(x, type) {
  return {
    id: x.Id, type, number: x.DocNumber || '', customer: (x.CustomerRef && x.CustomerRef.name) || 'Customer', customerId: (x.CustomerRef && x.CustomerRef.value) || '',
    date: x.TxnDate, due: x.DueDate || '', email: (x.BillEmail && x.BillEmail.Address) || '',
    lines: (x.Line || []).filter(l => l.DetailType === 'SalesItemLineDetail').map(l => ({ description: l.Description || '', amount: Number(l.Amount) })),
    net: round(Number(x.TotalAmt) - Number((x.TxnTaxDetail && x.TxnTaxDetail.TotalTax) || 0)), vat: round((x.TxnTaxDetail && x.TxnTaxDetail.TotalTax) || 0),
    total: Number(x.TotalAmt), balance: x.Balance != null ? Number(x.Balance) : null, memo: (x.CustomerMemo && x.CustomerMemo.value) || '', status: x.TxnStatus || '',
  };
}

// A link the customer can open: the invoice or quote as a page, with its PDF. Lives as long as a pack link.
async function shareLink(env, store, origin, realmId, r) {
  const type = r.type === 'quote' ? 'quote' : 'invoice';
  if (!/^\d+$/.test(String(r.id || ''))) throw new Error('Which one?');
  const doc = type === 'quote' ? (await qb(env, store, realmId, 'GET', `estimate/${r.id}`)).Estimate : (await qb(env, store, realmId, 'GET', `invoice/${r.id}`)).Invoice;
  const id = randomKey() + randomKey();
  await store.fetch(`https://store/docs/${id}`, { method: 'PUT', body: JSON.stringify({ realmId, type, id: String(r.id), created: Date.now() }) });
  const cust = doc.CustomerRef ? (await qb(env, store, realmId, 'GET', `customer/${doc.CustomerRef.value}`).catch(() => ({}))).Customer || {} : {};
  return { ok: true, url: `${origin}/d/${id}`, phone: phoneOf(cust), customer: (doc.CustomerRef && doc.CustomerRef.name) || '', total: Number(doc.TotalAmt), number: doc.DocNumber || '' };
}

const phoneOf = (c) => ((c.Mobile && c.Mobile.FreeFormNumber) || (c.PrimaryPhone && c.PrimaryPhone.FreeFormNumber) || '').trim();

async function docPage(env, store, link, self) {
  const raw = link.type === 'quote'
    ? (await qb(env, store, link.realmId, 'GET', `estimate/${link.id}`)).Estimate
    : (await qb(env, store, link.realmId, 'GET', `invoice/${link.id}?include=invoiceLink`)).Invoice;
  const d = docData(raw, link.type);
  const client = (await getClient(store, link.realmId)) || {};
  const biz = client.name || await qb(env, store, link.realmId, 'GET', `companyinfo/${link.realmId}`).then(r => r.CompanyInfo.CompanyName).catch(() => '');
  const e = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const m = n => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dt = s => s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const paid = link.type === 'invoice' && d.balance === 0;
  const pay = link.type === 'invoice' && !paid && raw.InvoiceLink ? raw.InvoiceLink : '';
  const title = link.type === 'quote' ? 'Quote' : 'Invoice';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${e(title)}${d.number ? ' ' + e(d.number) : ''} · ${e(biz)}</title><style>
:root{--ink:#16181b;--muted:#646a73;--line:#e4e6ea;--bg:#f2f3f5;--card:#fff;--go:#1f7a4d}
@media (prefers-color-scheme:dark){:root{--ink:#eceef1;--muted:#a1a7b0;--line:#2c3035;--bg:#101113;--card:#1b1d20;--go:#5cc78f}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:620px;margin:0 auto;padding:24px 16px 48px;display:grid;gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:20px}
.biz{font-size:13px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0}
h1{font-size:28px;margin:4px 0 0}.sub{color:var(--muted);margin:2px 0 0}
.total{font-size:40px;font-weight:800;margin:6px 0 0;font-variant-numeric:tabular-nums}
table{width:100%;border-collapse:collapse}td{padding:10px 0;border-top:1px solid var(--line);vertical-align:top}td.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;padding-left:12px}
tr.sum td{border-top:0;padding:4px 0;color:var(--muted)}tr.big td{font-weight:800;color:var(--ink);font-size:18px;border-top:1px solid var(--line);padding-top:10px}
.btn{display:block;text-align:center;background:var(--ink);color:var(--bg);text-decoration:none;font-weight:800;padding:15px;border-radius:14px}
.btn.alt{background:var(--card);color:var(--ink);border:1px solid var(--line)}
.paid{display:inline-block;background:color-mix(in srgb,var(--go) 15%,transparent);color:var(--go);font-weight:800;padding:4px 12px;border-radius:20px;margin-top:8px}
.note{font-size:14px;color:var(--muted);margin:0}
</style></head><body><main>
<div class="card"><p class="biz">${e(biz)}</p><h1>${e(title)}${d.number ? ' ' + e(d.number) : ''}</h1><p class="sub">For ${e(d.customer)} · ${e(dt(d.date))}</p>
<p class="total">${m(paid ? d.total : (d.balance != null ? d.balance : d.total))}</p>
${paid ? '<span class="paid">Paid, thank you</span>' : link.type === 'invoice' && d.due ? `<p class="sub">Due by ${e(dt(d.due))}</p>` : link.type === 'quote' ? '<p class="sub">Quote</p>' : ''}</div>
<div class="card"><table>${d.lines.map(l => `<tr><td>${e(l.description || 'Work')}</td><td class="n">${m(l.amount)}</td></tr>`).join('')}
${d.vat ? `<tr class="sum"><td>Before VAT</td><td class="n">${m(d.net)}</td></tr><tr class="sum"><td>VAT</td><td class="n">${m(d.vat)}</td></tr>` : ''}
<tr class="big"><td>Total</td><td class="n">${m(d.total)}</td></tr></table>${d.memo ? `<p class="note" style="margin-top:12px">${e(d.memo)}</p>` : ''}</div>
${pay ? `<a class="btn" href="${e(pay)}">Pay now by card</a>` : ''}
<a class="btn${pay ? ' alt' : ''}" href="${self}.pdf">Download PDF</a>
<p class="note" style="text-align:center">Sent by ${e(biz)} using Books</p>
</main></body></html>`;
}

async function customerList(env, store, realmId) {
  const since = isoDay(new Date(Date.now() - 365 * 86400000));
  const [custs, invs] = await Promise.all([
    query(env, store, realmId, 'select * from Customer where Active = true maxresults 1000').then(d => d.Customer || []),
    query(env, store, realmId, `select * from Invoice where TxnDate >= '${since}' maxresults 1000`).then(d => d.Invoice || []),
  ]);
  const paid = {}, last = {};
  for (const i of invs) {
    const c = i.CustomerRef && i.CustomerRef.value; if (!c) continue;
    paid[c] = (paid[c] || 0) + Number(i.TotalAmt) - Number(i.Balance);
    if (!last[c] || i.TxnDate > last[c]) last[c] = i.TxnDate;
  }
  return custs.map(c => ({
    id: c.Id, name: c.DisplayName, owes: round(c.Balance), paid: round(paid[c.Id] || 0), last: last[c.Id] || '',
    phone: phoneOf(c), email: (c.PrimaryEmailAddr && c.PrimaryEmailAddr.Address) || '',
  })).sort((a, b) => (b.owes > 0) - (a.owes > 0) || (b.last > a.last ? 1 : b.last < a.last ? -1 : 0) || a.name.localeCompare(b.name));
}

async function customerOne(env, store, realmId, id) {
  const [c, invs, ests] = await Promise.all([
    qb(env, store, realmId, 'GET', `customer/${id}`).then(d => d.Customer),
    query(env, store, realmId, `select * from Invoice where CustomerRef = '${id}' orderby TxnDate desc maxresults 100`).then(d => d.Invoice || []),
    query(env, store, realmId, `select * from Estimate where CustomerRef = '${id}' orderby TxnDate desc maxresults 50`).then(d => d.Estimate || []).catch(() => []),
  ]);
  const addr = c.BillAddr ? [c.BillAddr.Line1, c.BillAddr.City, c.BillAddr.PostalCode].filter(Boolean).join(', ') : '';
  return {
    id: c.Id, name: c.DisplayName, owes: round(c.Balance), phone: phoneOf(c), email: (c.PrimaryEmailAddr && c.PrimaryEmailAddr.Address) || '', address: addr,
    paid: round(invs.reduce((s, i) => s + Number(i.TotalAmt) - Number(i.Balance), 0)),
    invoices: invs.map(i => ({ id: i.Id, number: i.DocNumber || '', date: i.TxnDate, total: Number(i.TotalAmt), balance: Number(i.Balance) })),
    quotes: ests.map(q => ({ id: q.Id, number: q.DocNumber || '', date: q.TxnDate, total: Number(q.TotalAmt), status: q.TxnStatus || 'Pending' })),
  };
}

// Money in and out for each of the last 6 months (this one so far), from QuickBooks' profit and loss.
async function trend(env, store, realmId) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const report = await qb(env, store, realmId, 'GET', await pnl(store, realmId, `reports/ProfitAndLoss?start_date=${isoDay(start)}&end_date=${isoDay(now)}&summarize_column_by=Month`));
  const cols = ((report.Columns && report.Columns.Column) || []).slice(1);
  const months = [];
  for (let k = 0; k < 6; k++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + k, 1));
    months.push({ month: isoDay(d).slice(0, 7), label: d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }), in: 0, out: 0 });
  }
  const totals = {};
  for (const row of (report.Rows && report.Rows.Row) || []) {
    const cd = row.Summary && row.Summary.ColData;
    if (row.group && cd) totals[row.group] = cd.slice(1).map(c => Number(c.value) || 0);
  }
  months.forEach((m, k) => {
    if (k >= cols.length) return;
    m.in = round((totals.Income || [])[k] || 0);
    m.out = round(((totals.COGS || [])[k] || 0) + ((totals.Expenses || [])[k] || 0) + ((totals.OtherExpenses || [])[k] || 0));
    m.profit = round(m.in - m.out);
  });
  months.forEach(m => { if (m.profit == null) m.profit = round(m.in - m.out); });
  return { months };
}

async function status(env, store, realmId) {
  { const X = await ext(store, realmId); if (X) return X.status(env, store, realmId); }
  const t = await (await store.fetch(`https://store/tokens/${realmId}`)).json().catch(() => null);
  try {
    const info = (await qb(env, store, realmId, 'GET', `companyinfo/${realmId}`)).CompanyInfo;
    return { connected: true, company: info.CompanyName, sandbox: (t && t.env) !== 'production', since: t && t.saved_at };
  } catch (err) {
    return { connected: false, problem: String(err.message).slice(0, 120) };
  }
}

// ---------- notifications (Web Push) ----------

async function savePush(store, realmId, sub) {
  if (!sub || !/^https:\/\//.test(sub.endpoint || '') || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) throw new Error('This phone can\'t take notifications');
  await store.fetch(`https://store/pushsubs/${realmId}/${await sha256(sub.endpoint)}`, { method: 'PUT', body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys, at: Date.now() }) });
  return { ok: true };
}

async function dropPush(store, realmId, endpoint) {
  if (endpoint) await store.fetch(`https://store/pushsubs/${realmId}/${await sha256(endpoint)}`, { method: 'DELETE' });
  return { ok: true };
}

// Sends one notification to every phone this client turned them on for. Returns how many got it.
async function notify(env, store, realmId, msg) {
  if (!env.VAPID_PUBLIC || !env.VAPID_PRIVATE_JWK) return 0;
  const subs = await (await store.fetch(`https://store/pushsubs/${realmId}`)).json();
  let sent = 0;
  for (const sub of subs) {
    try {
      const res = await webPush(env, sub, JSON.stringify(msg));
      if (res.status === 404 || res.status === 410) await dropPush(store, realmId, sub.endpoint); // phone turned them off
      else if (res.ok) sent++;
    } catch (err) { console.error('push failed', err && err.message); }
  }
  return sent;
}

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const joinBytes = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
const enc = (s) => new TextEncoder().encode(s);
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

// RFC 8291 (aes128gcm) payload encryption plus a VAPID (RFC 8292) signature.
async function webPush(env, sub, payload) {
  const uaPublic = unb64u(sub.keys.p256dh), authSecret = unb64u(sub.keys.auth);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const prkKey = await hmac(authSecret, shared);
  const ikm = await hmac(prkKey, joinBytes(enc('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, joinBytes(enc('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, joinBytes(enc('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, joinBytes(enc(payload), new Uint8Array([2]))));
  const header = new Uint8Array(21); header.set(salt); new DataView(header.buffer).setUint32(16, 4096); header[20] = asPublic.length;
  const body = joinBytes(header, asPublic, sealed);

  const aud = new URL(sub.endpoint).origin;
  const jwtHead = b64u(enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const jwtBody = b64u(enc(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:hello@localdeskai.co.uk' })));
  const signKey = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signKey, enc(`${jwtHead}.${jwtBody}`));
  return fetch(sub.endpoint, {
    method: 'POST', body,
    headers: { Authorization: `vapid t=${jwtHead}.${jwtBody}.${b64u(sig)}, k=${env.VAPID_PUBLIC}`, 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'normal' },
  });
}

// Every hour: new payments in QuickBooks (not ones they marked in the app themselves) become a notification.
const HOURLY_CRON = '0 * * * *';
async function hourlyRun(env) {
  if (!env.VAPID_PUBLIC) return;
  const store = env.STORE.get(env.STORE.idFromName('main'));
  const companies = await (await store.fetch('https://store/tokens')).json();
  for (const c of companies) {
    if (isDemoClient(await getClient(store, c.realmId)) || PLATFORMS[c.platform]) continue; // payment alerts for other software come later
    const subs = await (await store.fetch(`https://store/pushsubs/${c.realmId}`)).json();
    if (!subs.length) continue;
    const since = await store.fetch(`https://store/paycheck/${c.realmId}`).then(r => (r.ok ? r.text() : ''));
    const now = new Date().toISOString();
    await store.fetch(`https://store/paycheck/${c.realmId}`, { method: 'PUT', body: now });
    if (!since) continue; // first look: start from now
    try {
      const pays = (await query(env, store, c.realmId, `select * from Payment where MetaData.CreateTime > '${since}' maxresults 50`)).Payment || [];
      for (const p of pays) {
        if (/marked in Books/.test(p.PrivateNote || '')) continue;
        await notify(env, store, c.realmId, { title: 'Payment in', body: `${(p.CustomerRef && p.CustomerRef.name) || 'A customer'} paid ${money(p.TotalAmt)}`, tab: 'owed' });
      }
    } catch (err) { console.error('payment check failed', c.realmId, err && err.message); }
  }
}

// ---------- monthly text and check report ----------

async function getClient(store, realmId) {
  const res = await store.fetch(`https://store/clients/${realmId}`);
  return res.ok ? res.json() : null;
}

function lastMonth() {
  const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

const gbp = n => (n < 0 && Math.round(n) !== 0 ? '-' : '') + '£' + Math.abs(Math.round(n)).toLocaleString('en-GB');

async function monthlyText(env, store, realmId, month) {
  const m = month || lastMonth();
  const s = await summary(env, store, realmId, m);
  const inv = await owed(env, store, realmId);
  const messy = await untidy(env, store, realmId).catch(() => []);
  const name = new Date(m + '-01').toLocaleDateString('en-GB', { month: 'long' });
  const parts = [`Your books for ${name}: in ${gbp(s.moneyIn)}, out ${gbp(s.moneyOut)}, profit ${gbp(s.profit)}.`];
  if (inv.length) parts.push(`Owed to you: ${gbp(s.owed)} on ${inv.length} invoice${inv.length > 1 ? 's' : ''}${inv[0].daysOverdue ? `, oldest ${inv[0].daysOverdue} days late` : ''}.`);
  if (s.taxPot > 0) parts.push(`Put aside roughly ${gbp(s.taxPot)} for tax (a guide, not advice).`);
  if (messy.length) parts.push(`${messy.length} expense${messy.length > 1 ? 's need' : ' needs'} a category: open Books, Tidy up.`);
  return parts.join(' ');
}

async function monthlyRun(env) {
  const store = env.STORE.get(env.STORE.idFromName('main'));
  const companies = await (await store.fetch('https://store/tokens')).json();
  const report = [];
  for (const c of companies) {
    const client = await getClient(store, c.realmId);
    if (isDemoClient(client)) continue;
    try {
      const msg = await monthlyText(env, store, c.realmId);
      if (client && client.phone) await sendSms(env, client.phone, msg);
      const messy = (msg.match(/(\d+) expenses? needs? a category/) || [])[1] || 0;
      report.push(`${(client && client.name) || c.realmId}: ${client && client.phone ? 'text sent' : 'no phone saved'}, ${messy} to tidy.`);
    } catch (err) {
      report.push(`${(client && client.name) || c.realmId}: FAILED (${err.message}).`);
    }
  }
  if (env.OWNER_PHONE) await sendSms(env, env.OWNER_PHONE, `Books monthly check: ${report.join(' ') || 'no clients connected.'}`);
}

// Profit and loss figures are on the CASH basis (money in when it is received, money out when it is paid), which is how most
// sole traders report and what the "Money in", profit and tax-pot figures mean. QuickBooks defaults to accruals, which counts
// an invoice the day it is raised and overstates a tradesperson's profit. A client can be switched to accrual with
// PUT /client/<realm> {"basis":"accrual"}.
async function pnl(store, realmId, path) {
  const client = (await getClient(store, realmId)) || {};
  return `${path}&accounting_method=${client.basis === 'accrual' ? 'Accrual' : 'Cash'}`;
}

// VAT codes. QuickBooks UK names them "20.0% S", "5.0% R", "0.0% Z" and "No VAT" in a fresh company, but a real company can
// differ in spacing or decimals, so match the shape and not the exact text. On a VAT-registered company, a code that cannot be
// found is an error that saves nothing: leaving VAT off without saying so would put wrong figures in a VAT return.
const VAT_KINDS = ['standard', 'reduced', 'zero', 'none'];
const VAT_CODE = { standard: /^20(\.0+)?\s*%\s*S$/i, reduced: /^5(\.0+)?\s*%\s*R$/i, zero: /^0(\.0+)?\s*%\s*Z$/i, none: /^no\s*vat$/i };
const VAT_LABEL = { standard: '20% standard rate', reduced: '5% reduced rate', zero: '0% zero rate', none: 'no VAT' };
function pickTaxCode(codes, kind) {
  const found = (codes || []).filter(c => c.Active !== false).find(c => VAT_CODE[kind].test(String(c.Name || '').trim()));
  if (!found) throw new Error(`Your QuickBooks has no VAT code for ${VAT_LABEL[kind]}, so nothing was saved. Ask Gio to check the VAT codes`);
  return found;
}

const ENQUIRY_ORIGINS = ['https://www.localdeskai.co.uk', 'https://localdeskai.co.uk'];
const ENQUIRY_PRODUCTS = { receptionist: 'Receptionist', books: 'Books', unsure: 'Not sure yet' };
// ---------- sales pipeline: leads (website enquiries and ones added by hand) ----------
// new -> contacted -> demo -> trial -> onboarding -> paying, or lost from anywhere. Nothing here ever contacts anyone.
const LEAD_STAGES = ['new', 'contacted', 'interested', 'zoom', 'demo', 'trial', 'onboarding', 'paying'];
const NEXT_DAYS = { contacted: 3, interested: 3, zoom: 1, demo: 2, trial: 3, onboarding: 2 };   // when to look at a lead again after it moves
function leadMove(from, to) {
  if (from === to) return true;
  if (to === 'lost') return true;
  if (from === 'lost') return to === 'new' || to === 'contacted';
  if (!LEAD_STAGES.includes(to)) return false;
  const a = LEAD_STAGES.indexOf(from), b = LEAD_STAGES.indexOf(to);
  if (to === 'paying') return from === 'onboarding';      // paying only after onboarding, and Stripe is what proves it
  return b > a || b === a - 1;                            // forward any distance, back one step
}
// A subscription for a lead started or ended in Stripe: tick the payment step and record the state on the lead. Never changes the stage.
async function markLead(store, id, state, now = Date.now()) {
  const res = await store.fetch(`https://store/lead/${encodeURIComponent(id)}`); if (!res.ok) return false;
  const lead = await res.json(); lead.checklist = lead.checklist || {};
  lead.subscription = { id: state.sub, status: state.status, at: now };
  lead.checklist.payment = state.live === true; lead.updated = now;
  await store.fetch(`https://store/lead/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(lead) });
  return true;
}
const THANKS_PAGE = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Thank you | Localdesk</title>
<style>body{margin:0;background:#F6F7F8;color:#1F2328;font:18px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}main{max-width:560px;margin:0 auto;padding:48px 20px}.brand{font-weight:800;letter-spacing:.04em;margin-bottom:28px}.card{background:#fff;border-radius:16px;padding:28px;box-shadow:0 1px 4px rgba(0,0,0,.08)}h1{margin:0 0 12px;font-size:28px}a{color:#8a6100}p{margin:0 0 14px}</style></head>
<body><main><div class="brand">LOCALDESK</div><div class="card"><h1>Thank you</h1><p>Your sign-up has gone through. Stripe will email you a receipt, and nothing else is charged without you knowing.</p><p><b>What happens next:</b> we'll be in touch by phone or text to finish setting things up with you. If you have a question in the meantime, email <a href="mailto:hello@localdeskai.co.uk">hello@localdeskai.co.uk</a>.</p><p>Localdesk, a trading name of Gio Petrucci, sole trader, Saltash, Cornwall.</p></div></main></body></html>`;
const FOUNDING_PLACES = 5;
// Founding places are reserved in the Store, which handles one request at a time and serialises claims. Fail closed: any problem means no place.
async function foundingOp(store, op, id, extra = {}) {
  const res = await store.fetch('https://store/founding', { method: 'POST', body: JSON.stringify({ op, id, ...extra }) });
  if (!res.ok) throw new Error('Could not check the founding places, so nothing was changed');
  return res.json();
}
async function updateLead(store, id, patch) {
  const res = await store.fetch(`https://store/lead/${id}`);
  if (!res.ok) throw new Error('No such lead');
  const lead = await res.json(), now = Date.now(), clean = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, n);
  const before = { ...lead.checklist };
  if (patch.status !== undefined && patch.status !== lead.status) {
    if (!LEAD_STAGES.includes(patch.status) && patch.status !== 'lost') throw new Error('Unknown status');
    if (!leadMove(lead.status, patch.status)) throw new Error(`A lead can't go from ${lead.status} to ${patch.status}`);
    lead.history.push({ at: now, from: lead.status, to: patch.status }); lead.status = patch.status;
    lead.next_at = NEXT_DAYS[patch.status] ? new Date(now + NEXT_DAYS[patch.status] * 86400000).toISOString().slice(0, 10) : '';
    if (patch.status === 'contacted') lead.last_contacted = now;
    if (patch.status === 'lost' && lead.checklist.founding) { lead.checklist.founding = false; await foundingOp(store, 'release', lead.id); }
  }
  if (patch.notes !== undefined) lead.notes = clean(patch.notes, 3000);
  if (patch.draft !== undefined) lead.draft = clean(patch.draft, 1200);
  if (patch.next_at !== undefined) { if (patch.next_at && !/^\d{4}-\d{2}-\d{2}$/.test(patch.next_at)) throw new Error('Follow-up date must look like 2026-11-05'); lead.next_at = patch.next_at; }
  if (patch.checklist && typeof patch.checklist === 'object') for (const [k, v] of Object.entries(patch.checklist)) if (k !== 'founding' && /^[a-z_]{2,30}$/.test(k) && Object.keys(lead.checklist).length < 25) lead.checklist[k] = Boolean(v);
  if (patch.checklist && 'founding' in patch.checklist) { // the setup waiver is for the first 5 Receptionist clients only, claimed atomically in the Store
    const want = patch.checklist.founding === true, had = !!before.founding;
    if (want && !had) {
      if (lead.product !== 'receptionist') throw new Error('The founding waiver is only for Receptionist clients');
      const r = await foundingOp(store, 'claim', lead.id);
      if (!r.ok) throw new Error(r.error || `All ${FOUNDING_PLACES} founding places are taken, so the setup fee applies`);
    } else if (!want && had) await foundingOp(store, 'release', lead.id);
    lead.checklist.founding = want;
  }

  for (const f of ['name', 'business']) if (patch[f] !== undefined) lead[f] = clean(patch[f], 100);
  if (patch.next_action !== undefined) lead.next_action = clean(patch.next_action, 120);
  if (patch.meeting_at !== undefined) { const m = clean(patch.meeting_at, 20); if (m && !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(m)) throw new Error('Meeting time must look like 2026-11-05T14:00'); lead.meeting_at = m; }
  if (patch.meeting_link !== undefined) { const m = clean(patch.meeting_link, 200); if (m && !/^https:\/\/[\w.-]+\.[a-z]{2,}(\/[^\s<>"']*)?$/i.test(m)) throw new Error('The meeting link must start with https://'); lead.meeting_link = m; }
  if (patch.tps !== undefined) { if (!['', 'clear', 'registered'].includes(patch.tps)) throw new Error('TPS result must be clear or registered'); lead.tps = patch.tps; if (patch.tps) lead.tps_checked = new Date(now).toISOString().slice(0, 10); else delete lead.tps_checked; }
  if (patch.dnc !== undefined) { lead.dnc = Boolean(patch.dnc); if (lead.dnc) { lead.next_at = ''; lead.next_action = ''; } } // do not call: no follow-up is ever due
  if (patch.phone !== undefined) { const ph = clean(patch.phone, 40); if (ph.replace(/\D/g, '').length < 10) throw new Error('That phone number looks too short'); lead.phone = ph; lead.phoneKey = ph.replace(/\D/g, '').slice(-10); }
  if (patch.product !== undefined && ENQUIRY_PRODUCTS[patch.product]) lead.product = patch.product;
  lead.updated = now;
  await store.fetch(`https://store/lead/${id}`, { method: 'PUT', body: JSON.stringify(lead) });
  return lead;
}
async function addLead(store, b) {
  const clean = (v, n) => String(v || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);
  const name = clean(b.name, 80), phone = clean(b.phone, 40);
  if (name.length < 2) throw new Error('Put in their name');
  if (phone.replace(/\D/g, '').length < 10) throw new Error('Put in a phone number');
  return (await store.fetch('https://store/enquiry', { method: 'POST', body: JSON.stringify({ name, phone, business: clean(b.business, 100), product: ENQUIRY_PRODUCTS[b.product] ? b.product : 'unsure', message: clean(b.message, 600), manual: true, source: clean(b.source, 20) || 'manual', at: Date.now() }) })).json();
}

async function enquiry(request, env, store) {
  const origin = request.headers.get('Origin') || '';
  const cors = { 'Access-Control-Allow-Origin': ENQUIRY_ORIGINS.includes(origin) ? origin : ENQUIRY_ORIGINS[0], 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' };
  const reply = (obj, status = 200) => Response.json(obj, { status, headers: cors });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return reply({ error: 'Not found' }, 404);
  if (origin && !ENQUIRY_ORIGINS.includes(origin)) return reply({ error: 'Not allowed' }, 403);
  const b = await request.json().catch(() => null);
  if (!b || typeof b !== 'object') return reply({ error: 'Something went wrong. Please try again, or email hello@localdeskai.co.uk.' }, 400);
  if (b.website) return reply({ ok: true }); // hidden field only a robot fills in
  const clean = (v, n) => String(v || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);
  const name = clean(b.name, 80), business = clean(b.business, 100), message = clean(b.message, 600), phone = clean(b.phone, 40);
  const product = ENQUIRY_PRODUCTS[b.product] ? b.product : 'unsure', source = /^[a-z0-9_-]{1,20}$/.test(String(b.source || '')) ? b.source : 'website';
  if (name.length < 2) return reply({ error: 'Please tell us your name.' }, 400);
  if (phone.replace(/\D/g, '').length < 10) return reply({ error: 'Please give us a phone number we can reach you on.' }, 400);
  if (!(await throttle(store, `enq:${await visitor(request)}`, 5, 3600)) || !(await throttle(store, 'enq:all', 40, 86400))) return reply({ error: 'That is a lot of enquiries at once. Please email hello@localdeskai.co.uk instead.' }, 429);
  await store.fetch('https://store/enquiry', { method: 'POST', body: JSON.stringify({ name, phone, business, product, message, source, at: Date.now() }) });
  if (env.OWNER_PHONE && env.TWILIO_ACCOUNT_SID) await sendSms(env, env.OWNER_PHONE, `New ${ENQUIRY_PRODUCTS[product]} enquiry${source !== 'website' ? ` via ${source}` : ''}: ${name}${business ? ` (${business})` : ''}, ${phone}.${message ? ' ' + message.slice(0, 160) : ''}`).catch(() => {});
  return reply({ ok: true });
}

// UK mobile numbers as people write them ("07700 900123", "+44 7700 900123", "0044 7700 900123", "(07700) 900-123")
// all become +447700900123. Anything that isn't a UK mobile is refused with a plain message, so a wrong number is
// caught when it is saved and not when a login code silently fails to arrive. A blank stays blank.
function ukMobile(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  let d = raw.replace(/[\s().-]/g, '');
  if (/[^\d+]/.test(d)) throw new Error(`"${raw}" doesn't look like a phone number`);
  if (d.startsWith('+')) d = d.slice(1); else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '44' + d.slice(1);
  else if (/^7\d{9}$/.test(d)) d = '44' + d;
  if (d.startsWith('4407')) d = '44' + d.slice(3); // "+44 (0)7700 …"
  if (!/^447\d{9}$/.test(d)) throw new Error(`"${raw}" isn't a UK mobile number. It should look like 07700 900123`);
  return '+' + d;
}

async function sendSms(env, to, body) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) throw new Error('Texts are not set up yet (Twilio keys missing)');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: env.SMS_FROM || 'Books', To: (() => { try { return ukMobile(to) || to; } catch { return to; } })(), Body: body.slice(0, 900) }),
  });
  if (!res.ok) throw new Error(`Text failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

function round(n) { return Math.round((Number(n) || 0) * 100) / 100; }
const money = n => '£' + (Number(n) || 0).toFixed(2);
const num = n => (n ? ` ${n}` : '');

// A QuickBooks call whose answer isn't JSON (PDFs).
async function qbRaw(env, store, realmId, path, accept) {
  const t = await accessToken(env, store, realmId);
  const base = t.env === 'production' ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com';
  const res = await fetch(`${base}/v3/company/${realmId}/${path}?minorversion=${MINOR_VERSION}`, { headers: { Authorization: `Bearer ${t.access_token}`, Accept: accept } });
  if (!res.ok) throw new Error(`QuickBooks ${res.status}: couldn't get that document`);
  return res;
}

// One QuickBooks API call. Body may be JSON-able or FormData.
async function qb(env, store, realmId, method, path, body) {
  const t = await accessToken(env, store, realmId);
  const base = t.env === 'production' ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com';
  const access = t.access_token;
  const sep = path.includes('?') ? '&' : '?';
  const headers = { Authorization: `Bearer ${access}`, Accept: 'application/json' };
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  // QuickBooks answers 429 when it is asked too often (500 a minute per company). That passes in a moment, so wait and ask again
  // (up to 3 more times) before treating it as a problem. A body can only be sent once, so retries are for reads and JSON writes.
  let res;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(`${base}/v3/company/${realmId}/${path}${sep}minorversion=${MINOR_VERSION}`, {
      method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    if (res.status !== 429 || attempt >= 3 || body instanceof FormData) break;
    await new Promise(r => setTimeout(r, 700 * (attempt + 1) + Math.random() * 300));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.Fault) {
    const e = data.Fault && data.Fault.Error && data.Fault.Error[0];
    throw new Error(`QuickBooks ${res.status}: ${e ? `${e.Message} ${e.Detail || ''}` : 'request failed'}`.trim());
  }
  return data;
}

// Fresh tokens for this company (with .env), refreshing and saving the new refresh token when needed.
// Connections saved before env was recorded are sandbox ones.
async function accessToken(env, store, realmId, force, retried) {
  const res = await store.fetch(`https://store/tokens/${realmId}`);
  if (!res.ok) throw new Error(`QuickBooks company ${realmId} isn't connected`);
  const t = await res.json();
  if (PLATFORMS[t.platform]) throw new Error(later(t.platform));
  t.env = t.env || 'sandbox';
  if (!force && t.expires_at - Date.now() > 60_000) return t;
  let fresh;
  try {
    fresh = await tokenRequest(env, t.env, { grant_type: 'refresh_token', refresh_token: t.refresh_token });
  } catch (err) {
    if (/invalid_grant/i.test(String(err.message)) && !retried) {
      // Intuit rotates the refresh token, so another request may have just refreshed it: use theirs.
      const now = await store.fetch(`https://store/tokens/${realmId}`).then(r => (r.ok ? r.json() : null));
      if (now && now.refresh_token !== t.refresh_token) return accessToken(env, store, realmId, false, true);
      if (now) {
        // Same token and Intuit says it's finished: Books was disconnected in QuickBooks (or it expired). It's no use, so don't keep it.
        await store.fetch(`https://store/tokens/${realmId}`, { method: 'DELETE' });
        const cl = await getClient(store, realmId);
        if (cl) await store.fetch(`https://store/clients/${realmId}`, { method: 'PUT', body: JSON.stringify({ ...cl, disconnected_at: new Date().toISOString() }) });
      }
    }
    await alertOwner(env, store, `conn:${realmId}`, `Books: ${await clientName(store, realmId)}'s QuickBooks connection has dropped (${String(err.message).slice(0, 120)}). Send them a fresh connect link.`).catch(() => {});
    throw err;
  }
  await store.fetch(`https://store/tokens/${realmId}`, { method: 'PUT', body: JSON.stringify(fresh) });
  return fresh;
}

async function tokenRequest(env, which, params) {
  const c = creds(env, which);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${c.id}:${c.secret}`),
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
    env: which,
  };
}

// One instance holds every client's tokens, so refreshes never race each other.
export class Store {
  constructor(state) { this.storage = state.storage; }
  async fetch(request) {
    const url = new URL(request.url);
    const rl = url.pathname.match(/^\/reflock\/(\d+)$/);   // a short lease so only one request at a time refreshes a single-use refresh token
    if (rl) {
      const key = `reflock:${rl[1]}`, cur = await this.storage.get(key);
      if (request.method === 'POST') {
        if (cur && cur.until > Date.now()) return Response.json({ ok: false });
        const id = crypto.randomUUID(); await this.storage.put(key, { id, until: Date.now() + 20000 });
        return Response.json({ ok: true, id });
      }
      if (request.method === 'DELETE') { if (cur && cur.id === url.searchParams.get('id')) await this.storage.delete(key); return Response.json({ ok: true }); }
    }
    if (url.pathname === '/state') {
      // Several people may be connecting at once, so each state is kept under its own key.
      if (request.method === 'PUT') { const st = JSON.parse(await request.text()); await this.storage.put(`state:${st.value}`, { ...st, at: Date.now() }); return text('ok'); }
      const value = await request.text();
      const saved = await this.storage.get(`state:${value}`);
      await this.storage.delete(`state:${value}`);
      return saved && Date.now() - saved.at < 15 * 60_000 ? Response.json(saved) : text('expired', 400);
    }
    const inv = url.pathname.match(/^\/invites\/([\w-]+)$/);
    if (inv) {
      const key = `invite:${inv[1]}`;
      if (request.method === 'PUT') { await this.storage.put(key, JSON.parse(await request.text())); return text('ok'); }
      if (request.method === 'DELETE') { await this.storage.delete(key); return text('ok'); }
      const v = await this.storage.get(key);
      return v && Date.now() - v.created < INVITE_DAYS * 86400000 ? Response.json(v) : text('No invite', 404);
    }
    const cd = url.pathname.match(/^\/codes\/([\w-]+)$/);
    if (cd) {
      const key = `code:${cd[1]}`;
      if (request.method === 'PUT') { await this.storage.put(key, JSON.parse(await request.text())); return text('ok'); }
      const v = await this.storage.get(key);
      return v ? Response.json(v) : text('No code', 404);
    }
    const se = url.pathname.match(/^\/sessions\/([0-9a-f]{64})$/);
    if (se) {
      const key = `session:${se[1]}`;
      if (request.method === 'PUT') { await this.storage.put(key, JSON.parse(await request.text())); return text('ok'); }
      if (request.method === 'DELETE') { await this.storage.delete(key); return text('ok'); }
      const v = await this.storage.get(key);
      return v ? Response.json(v) : text('No session', 404);
    }
    const so = url.pathname.match(/^\/sessions-of\/([\w-]+)$/);
    if (so && request.method === 'DELETE') {
      const all = await this.storage.list({ prefix: 'session:' });
      const gone = [...all].filter(([, v]) => v.appKey === so[1]).map(([k]) => k);
      if (gone.length) await this.storage.delete(gone);
      return text('ok');
    }
    const al = url.pathname.match(/^\/alerts\/(.+)$/);
    if (al) {
      // 200 = go ahead and send; 409 = already sent one within ALERT_HOURS.
      const key = `alert:${decodeURIComponent(al[1])}`, last = await this.storage.get(key);
      if (last && Date.now() - last < ALERT_HOURS * 3600000) return text('recent', 409);
      await this.storage.put(key, Date.now());
      return text('ok');
    }
    const sn = url.pathname.match(/^\/seen\/(\d+)$/);
    if (sn) {
      const key = `seen:${sn[1]}`;
      if (request.method === 'POST') { await this.storage.put(key, Date.now()); return text('ok'); }
      const v = await this.storage.get(key);
      return v ? Response.json({ at: v }) : text('never', 404);
    }
    // Change log and trips: one key each, listed newest or oldest first per company.
    const lg = url.pathname.match(/^\/(log|trips)\/(\d+)(?:\/(\d+))?$/);
    if (lg) {
      const prefix = `${lg[1]}:${lg[2]}:`;
      if (!lg[3]) {
        const all = await this.storage.list(lg[1] === 'log' ? { prefix, reverse: true, limit: 200 } : { prefix, limit: 5000 });
        return Response.json([...all.values()]);
      }
      const key = prefix + lg[3];
      if (request.method === 'PUT') {
        await this.storage.put(key, JSON.parse(await request.text()));
        if (lg[1] === 'log') { // keep 90 days
          const old = await this.storage.list({ prefix, end: prefix + String(Date.now() - 90 * 86400000), limit: 100 });
          if (old.size) await this.storage.delete([...old.keys()]);
        }
        return text('ok');
      }
      if (request.method === 'DELETE') { await this.storage.delete(key); return text('ok'); }
      const v = await this.storage.get(key);
      return v ? Response.json(v) : text('Not found', 404);
    }
    const ch = url.pathname.match(/^\/chased\/(\d+)\/([\w-]+)$/);
    if (ch) {
      const key = `chased:${ch[1]}:${ch[2]}`;
      if (request.method === 'PUT') { await this.storage.put(key, JSON.parse(await request.text())); return text('ok'); }
      return Response.json((await this.storage.get(key)) || []);
    }
    const dc = url.pathname.match(/^\/docs\/([\w-]+)$/);
    if (dc) {
      const key = `doc:${dc[1]}`;
      if (request.method === 'PUT') { await this.storage.put(key, JSON.parse(await request.text())); return text('ok'); }
      const v = await this.storage.get(key);
      return v && Date.now() - v.created < PACK_DAYS * 86400000 ? Response.json(v) : text('No doc', 404);
    }
    // Phones with notifications on: one key per phone, per company.
    const ps = url.pathname.match(/^\/pushsubs\/(\d+)(?:\/([0-9a-f]{64}))?$/);
    if (ps) {
      const prefix = `push:${ps[1]}:`;
      if (!ps[2]) return Response.json([...(await this.storage.list({ prefix })).values()]);
      if (request.method === 'PUT') { await this.storage.put(prefix + ps[2], JSON.parse(await request.text())); return text('ok'); }
      if (request.method === 'DELETE') { await this.storage.delete(prefix + ps[2]); return text('ok'); }
      return text('Not found', 404);
    }
    const lc = url.pathname.match(/^\/paycheck\/(\d+)$/);
    if (lc) {
      const key = `paycheck:${lc[1]}`;
      if (request.method === 'PUT') { await this.storage.put(key, await request.text()); return text('ok'); }
      const v = await this.storage.get(key);
      return v ? text(v) : text('', 404);
    }
    const pk = url.pathname.match(/^\/packs\/([\w-]+)$/);
    if (pk) {
      const key = `pack:${pk[1]}`;
      if (request.method === 'PUT') { await this.storage.put(key, JSON.parse(await request.text())); return text('ok'); }
      const v = await this.storage.get(key);
      return v && Date.now() - v.created < PACK_DAYS * 86400000 ? Response.json(v) : text('No pack', 404);
    }
    const ak = url.pathname.match(/^\/appkeys\/([\w-]+)$/);
    if (ak && request.method === 'PUT') { await this.storage.put(`appkey:${ak[1]}`, await request.text()); return text('ok'); }
    if (ak) {
      const realmId = await this.storage.get(`appkey:${ak[1]}`);
      if (!realmId) return text('Unknown', 404);
      const client = await this.storage.get(`client:${realmId}`);
      return Response.json({ realmId, name: (client && client.name) || '', brand: (client && client.brand) || '', extras: (client && client.extras) || '' });
    }
    if (url.pathname === '/clients') {
      const all = await this.storage.list({ prefix: 'client:' });
      return Response.json([...all].map(([k, v]) => ({ realmId: k.slice(7), ...v })));
    }
    if (url.pathname === '/limit' && request.method === 'POST') {
      const { name, limit, windowSec } = JSON.parse(await request.text());
      const key = `rl:${windowSec}:${Math.floor(Date.now() / (windowSec * 1000))}:${name}`;
      const n = ((await this.storage.get(key)) || 0) + 1;
      await this.storage.put(key, n);
      if (Math.random() < 0.05) { // now and then, tidy counters from past windows
        const all = await this.storage.list({ prefix: 'rl:', limit: 500 });
        const stale = [...all.keys()].filter(k => { const [, w, b] = k.split(':'); return (Number(b) + 2) * Number(w) * 1000 < Date.now(); });
        if (stale.length) await dropKeys(this.storage, stale);
      }
      return n > limit ? text('limited', 429) : text('ok');
    }
    const co = url.pathname.match(/^\/(cutoff|purge)\/(\d+)$/);
    if (co && request.method === 'POST') {
      const realm = co[2], key = `client:${realm}`;
      const cl = await this.storage.get(key);
      const out = await cutAccess(this.storage, realm, cl);
      if (co[1] === 'cutoff') {
        const { reason } = JSON.parse((await request.text()) || '{}');
        if (cl) await this.storage.put(key, { ...cl, ended_at: new Date().toISOString(), ended_reason: reason || 'revoked' });
        return Response.json(out);
      }
      out.mileage = await dropWhere(this.storage, `trips:${realm}:`, () => true);
      out.changeLog = await dropWhere(this.storage, `log:${realm}:`, () => true);
      out.chaseNotes = await dropWhere(this.storage, `chased:${realm}:`, () => true);
      const seg = new RegExp(`:${realm}(:|$)`);
      const alerts = [...(await this.storage.list({ prefix: 'alert:' })).keys()].filter(k => seg.test(k));
      await dropKeys(this.storage, alerts);
      await this.storage.delete(key);
      out.client = cl ? 1 : 0;
      return Response.json(out);
    }
    // Backup and restore. Only what can't be recreated: clients, their app links, mileage, change log, notification devices,
    // shared links, chasing history. Never connection tokens (they are credentials and Intuit rotates them, so an old copy is useless:
    // after a restore each client reconnects), sessions, login codes or counters.
    if (url.pathname === '/dump' && request.method === 'GET') {
      const out = {};
      for (const [key, value] of await this.storage.list()) if (BACKUP_KEYS.test(key)) out[key] = value;
      return Response.json(out);
    }
    if (url.pathname === '/load' && request.method === 'POST') {
      const { entries, overwrite } = JSON.parse(await request.text());
      let written = 0, skipped = 0;
      for (const [key, value] of Object.entries(entries || {})) {
        if (!BACKUP_KEYS.test(key)) { skipped++; continue; }
        if (!overwrite && (await this.storage.get(key)) !== undefined) { skipped++; continue; }
        await this.storage.put(key, value); written++;
      }
      return Response.json({ written, skipped });
    }
    if (url.pathname === '/enquiry' && request.method === 'POST') {
      // Every enquiry becomes a lead in the sales pipeline. The same person asking again within a week is added to their lead.
      const e = JSON.parse(await request.text()), key = String(e.phone || '').replace(/\D/g, '').slice(-10);
      const all = [...(await this.storage.list({ prefix: 'lead:' })).values()];
      const barred = all.find(l => l.phoneKey === key && (l.dnc || l.tps === 'registered')); // a number marked do not call, or TPS registered, stays barred however old or closed that lead is
      if (e.manual && barred) return Response.json({ ok: false, blocked: true, id: barred.id, error: barred.dnc ? 'This number is marked do not call. Do not ring it.' : 'This number is TPS registered. Do not cold call it.' });
      if (e.manual) { // adding by hand: a number already in HQ is never added twice, and the existing lead is left as it is
        const have = all.find(l => l.phoneKey === key && l.status !== 'lost');
        if (have) return Response.json({ ok: true, id: have.id, merged: true, existing: true });
      }
      const dup = e.manual ? null : all.find(l => l.phoneKey === key && l.status !== 'lost' && l.status !== 'paying' && e.at - l.created < 7 * 86400000);
      if (dup) {
        if (e.message) dup.messages.push({ at: e.at, text: e.message });
        dup.updated = e.at; dup.repeat = (dup.repeat || 1) + 1; if (barred && !e.manual) dup.reenquired = e.at; await this.storage.put(`lead:${dup.id}`, dup);
        return Response.json({ ok: true, id: dup.id, merged: true });
      }
      const id = `${e.at.toString(36)}${crypto.randomUUID().slice(0, 4)}`;
      const lead = { id, name: e.name, phone: e.phone, phoneKey: key, business: e.business || '', product: e.product, status: 'new', source: e.source || 'website', created: e.at, updated: e.at,
        messages: e.message ? [{ at: e.at, text: e.message }] : [], notes: '', next_at: new Date(e.at).toISOString().slice(0, 10), draft: '', checklist: {}, history: [{ at: e.at, from: null, to: 'new' }], repeat: 1, ...(barred && !e.manual ? { reenquired: e.at } : {}) };
      await this.storage.put(`lead:${id}`, lead);
      return Response.json({ ok: true, id });
    }
    if (url.pathname === '/once' && request.method === 'POST') { // true the first time a key is seen (used to ignore repeated Stripe events)
      const { key } = JSON.parse(await request.text() || '{}');
      const run = async () => { if (await this.storage.get(`once:${key}`)) return { first: false }; await this.storage.put(`once:${key}`, Date.now()); return { first: true }; };
      const turn = (this._once || Promise.resolve()).then(run, run); this._once = turn.catch(() => {});
      return Response.json(await turn);
    }
    if (url.pathname === '/founding' && request.method === 'POST') { // reserve, activate, cancel, release or list the first-five setup-waiver places (one request at a time, so two claims can never both win the last place)
      const { op, id, sub, now: at } = JSON.parse(await request.text() || '{}'), now = Number(at) || Date.now();
      const run = async () => {
        const recs = new Map([...(await this.storage.list({ prefix: 'founding:' })).entries()].map(([k, v]) => [k.slice(9), v]));
        const live = (v) => v && (v.state === 'active' || v.exp > now);                // a reserved place that nobody paid for expires and frees itself
        const usedIds = (except) => [...recs.entries()].filter(([k, v]) => k !== except && live(v)).map(([k]) => k);
        if (op === 'list') { const ids = usedIds(); return { used: ids.length, ids, active: ids.filter(k => recs.get(k).state === 'active').length, flags: [...(await this.storage.list({ prefix: 'foundingflag:' })).values()] }; }
        if (!/^[\w-]{1,40}$/.test(String(id || ''))) return { ok: false, error: 'Bad id' };
        const cur = recs.get(id), others = usedIds(id).length;
        if (op === 'release') { await this.storage.delete(`founding:${id}`); return { ok: true, used: others }; }
        if (op === 'claim') {
          if (live(cur)) return { ok: true, used: others + 1, already: true };
          if (others >= 5) return { ok: false, used: others };
          await this.storage.put(`founding:${id}`, { at: now, state: 'reserved', exp: now + 7 * 86400000 });
          return { ok: true, used: others + 1 };
        }
        if (op === 'activate') { // a founding client's subscription started: the place is theirs for good (unless they cancel in the first 7 days)
          if (!live(cur) && others >= 5) { await this.storage.put(`foundingflag:${id}`, { id, at: now, why: 'a founding subscription started but all five places were already used' }); return { ok: false, over: true, used: others }; }
          await this.storage.put(`founding:${id}`, { ...(live(cur) ? cur : { at: now }), state: 'active', sub: sub || (cur && cur.sub) || '', activated: (cur && cur.activated) || now });
          await this.storage.delete(`foundingflag:${id}`);
          return { ok: true, used: others + 1 };
        }
        if (op === 'cancel') { // cancelled within 7 days of starting: the place comes back. Later: it stays used.
          if (cur && cur.state === 'active' && (!sub || cur.sub === sub) && now - cur.activated <= 7 * 86400000) { await this.storage.delete(`founding:${id}`); return { ok: true, released: true, used: others }; }
          return { ok: true, released: false, used: others + (live(cur) ? 1 : 0) };
        }
        return { ok: false, error: 'Unknown' };
      };
      const turn = (this._founding || Promise.resolve()).then(run, run); this._founding = turn.catch(() => {});
      return Response.json(await turn);
    }
    if (url.pathname === '/leads' && request.method === 'GET') return Response.json([...(await this.storage.list({ prefix: 'lead:' })).values()].sort((a, b) => b.updated - a.updated));
    const ld = url.pathname.match(/^\/lead\/([\w-]+)$/);
    if (ld) {
      if (request.method === 'GET') { const l = await this.storage.get(`lead:${ld[1]}`); return l ? Response.json(l) : new Response('Not found', { status: 404 }); }
      if (request.method === 'PUT') { await this.storage.put(`lead:${ld[1]}`, JSON.parse(await request.text())); return Response.json({ ok: true }); }
      if (request.method === 'DELETE') { await this.storage.delete(`lead:${ld[1]}`); return Response.json({ ok: true }); }
    }
    if (url.pathname === '/housekeeping' && request.method === 'POST') {
      // Old invites (they hold a name and phone), login codes, sessions and counters that nobody needs any more.
      const now = Date.now();
      return Response.json({
        invites: await dropWhere(this.storage, 'invite:', v => now - v.created > INVITE_DAYS * 86400000),
        states: await dropWhere(this.storage, 'state:', v => now - v.at > 15 * 60_000),
        codes: await dropWhere(this.storage, 'code:', v => (!v.expires || now > v.expires) && !(v.sent || []).some(t => now - t < 3600000)),
        sessions: await dropWhere(this.storage, 'session:', v => now - v.created > SESSION_DAYS * 86400000),
        alerts: await dropWhere(this.storage, 'alert:', v => now - v > 7 * 86400000),
        enquiries: await dropWhere(this.storage, 'enquiry:', v => now - v.at > 90 * 86400000),
        lostLeads: await dropWhere(this.storage, 'lead:', v => v.status === 'lost' && now - v.updated > 90 * 86400000),
      });
    }
    const c = url.pathname.match(/^\/clients\/(\d+)$/);
    if (c) {
      const key = `client:${c[1]}`;
      if (request.method === 'PUT') {
        const v = JSON.parse(await request.text());
        const old = await this.storage.get(key);
        if (old && old.appKey && old.appKey !== v.appKey) await this.storage.delete(`appkey:${old.appKey}`);
        await this.storage.put(key, v);
        if (v.appKey) await this.storage.put(`appkey:${v.appKey}`, c[1]);
        return text('ok');
      }
      if (request.method === 'DELETE') {
        const old = await this.storage.get(key);
        if (old && old.appKey) await this.storage.delete(`appkey:${old.appKey}`);
        await this.storage.delete(key);
        return text('ok');
      }
      const v = await this.storage.get(key);
      return v ? Response.json(v) : text('No client', 404);
    }
    const m = url.pathname.match(/^\/tokens(?:\/(\d+))?$/);
    if (!m) return text('Not found', 404);
    if (!m[1]) {
      const all = await this.storage.list({ prefix: 'tokens:' });
      return Response.json([...all].map(([k, t]) => ({ realmId: k.slice(7), connected_at: t.saved_at, platform: t.platform || 'quickbooks', refresh_expires_at: new Date(t.refresh_expires_at).toISOString() })));
    }
    const key = `tokens:${m[1]}`;
    if (request.method === 'PUT') { await this.storage.put(key, JSON.parse(await request.text())); return text('ok'); }
    if (request.method === 'DELETE') { await this.storage.delete(key); return text('ok'); }
    const t = await this.storage.get(key);
    return t ? Response.json(t) : text('Not connected', 404);
  }
}

// A Durable Object takes at most 128 keys per delete.
async function dropKeys(storage, keys) {
  for (let i = 0; i < keys.length; i += 128) await storage.delete(keys.slice(i, i + 128));
  return keys.length;
}
async function dropWhere(storage, prefix, test) {
  const all = await storage.list({ prefix });
  return dropKeys(storage, [...all].filter(([, v]) => test(v)).map(([k]) => k));
}
// Ends everything that gives access: QuickBooks tokens, logins, login codes, app link, notifications and shared links.
async function cutAccess(storage, realm, cl) {
  const out = { tokens: (await storage.delete(`tokens:${realm}`)) ? 1 : 0, sessions: 0, notifications: 0, links: 0 };
  if (cl && cl.appKey) {
    await storage.delete([`code:${cl.appKey}`, `appkey:${cl.appKey}`]);
    out.sessions = await dropWhere(storage, 'session:', v => v.appKey === cl.appKey);
  }
  out.notifications = await dropWhere(storage, `push:${realm}:`, () => true);
  out.links = await dropWhere(storage, 'doc:', v => v.realmId === realm) + await dropWhere(storage, 'pack:', v => v.realmId === realm);
  await storage.delete([`seen:${realm}`, `paycheck:${realm}`]);
  return out;
}

function text(body, status = 200) { return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
function page(msg, status = 200) {
  const html = `<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Localdesk Books</title>
<style>:root{color-scheme:light dark;--bg:#f4f6fa;--card:#fff;--ink:#14213d;--mute:#5b6577}@media(prefers-color-scheme:dark){:root{--bg:#0f1624;--card:#18223a;--ink:#f1f4fa;--mute:#a9b3c7}}
body{font:18px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;background:var(--bg);color:var(--ink);display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;box-sizing:border-box}
main{background:var(--card);border-radius:16px;padding:28px 24px;max-width:440px;width:100%;text-align:center;box-shadow:0 2px 14px rgba(0,0,0,.08)}
.brand{font-weight:800;font-size:15px;letter-spacing:.04em;text-transform:uppercase;color:var(--mute);margin:0 0 14px}p{margin:0}small{color:var(--mute)}a{color:inherit}</style>
<body><main><p class="brand">Localdesk Books</p><p>${msg}</p></main></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
