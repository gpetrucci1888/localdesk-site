# Localdesk site and Books

**This repo is public.** Never commit secrets, access keys or links containing them (app keys, invite, pack or `/d/` links), client data or real people's phone numbers.

## Business
Localdesk: Giovanni (Gio) Petrucci, sole trader, Saltash, Cornwall. Sells to local trades:
- **AI receptionist "Mia"** (Vapi voice + Twilio number, call summaries by text). Demo line 01752 741686.
- **Websites** for trades (separate repo `localdesk-client-sites`).
- **Books**: phone app on top of the client's own QuickBooks (receipts, invoices, quotes, chasing, CIS, mileage, accountant pack).

Current state, prices and decisions: `PROGRESS.md`. It is long, so grep for the section you need rather than reading it all.

**New session? Read `docs/HANDOFF.md` first (state, open items, what is undeployed). Claude is the technical lead; ChatGPT is the independent reviewer via GitHub: see `docs/AI-COLLAB.md` (the automatic review needs an OpenAI API key and is not on yet).**

## Rules (from Gio)
- **Never deploy, publish, push to `main`, spend money or change production config** (Cloudflare, Vapi, Twilio, Stripe, Intuit, DNS) without Gio's explicit approval in the current conversation. Show a preview first.
- **Before deploying a Worker, merge the approved branch with the latest `origin/main`** so no other session's work is lost. Other Claude sessions work on this repo too.
- **Customer data:** test only with the QuickBooks sandbox and made-up data. Don't put real client data in git, logs, screenshots or third-party tools.
- Never print, log or commit secrets.
- Plain English, UK spelling, no em dashes. Short replies. Ask before changing anything Gio didn't ask for.

## Layout
| Path | What |
|---|---|
| `public/` | Website www.localdeskai.co.uk: `index.html`, `privacy.html`, `terms.html`, `books/privacy.html` + `books/terms.html`, `example/` (demo roofer site, noindex), `404.html`, `vendor/` (Vapi web SDK) |
| `wrangler.jsonc` | Website Worker `localdesk`: serves `public/` as static assets, 404 page |
| `workers/books/worker.js` | Books connector, Worker `books`: QuickBooks OAuth, all API routes (listed in the header comment), Durable Object `Store`, crons, Web Push |
| `workers/receipt-demo/` | Books app, Worker `receipt-demo`: `worker.js` (routes), `page.js` (app HTML/JS in `String.raw`, so no backticks or `${` inside), `brands.js` (client branding), `icons.js` |
| `ops/` | Vapi receptionist scripts: `new_client.py <client.json>`, `demo_line.py`, `client-prompt.txt`, `keyterms.json`, `local-knowledge.txt` |

Not in this repo: the call-summary Worker `localdesk-call-summaray` (code is in Gio's local launch folder).

## Cloudflare
Account subdomain `gpetrucci93.workers.dev`. The session proxy injects the Cloudflare API credentials (no key needed). wrangler is not installed.

| Worker | Deploys by | Bindings (names only) | Crons |
|---|---|---|---|
| `localdesk` | Push to `main` (Cloudflare Git integration, per README) | none | none |
| `books` | API upload of `workers/books/worker.js` | secrets `ADMIN_KEY`, `QB_CLIENT_ID`, `QB_CLIENT_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `VAPID_PRIVATE_JWK`; plain `APP_URL`, `OWNER_PHONE`, `SMS_FROM`, `VAPID_PUBLIC`; `AI`; Durable Object `STORE` (class `Store`). Code also reads `QB_PROD_CLIENT_ID`/`QB_PROD_CLIENT_SECRET` (not set until Intuit approves) and optional `BOOKS_URL` | `0 * * * *` push for new payments, `0 7 * * *` daily check, `0 8 1 * *` monthly text, `0 8 8 1,4,7,10 *` quarter packs |
| `receipt-demo` | API upload of all four files in `workers/receipt-demo/` | `AI`; service `BOOKS` → `books` | none |
| `localdesk-call-summaray` | Not from this repo | `CLIENTS`, `SMS_SENDER`, `TWILIO_*`, `VAPI_SECRET` | none |

API deploy (only with approval): `PUT /accounts/{account}/workers/scripts/{name}` as multipart, metadata `main_module: worker.js`, `compatibility_date: 2025-09-01`, the non-secret bindings above, and `keep_bindings: ["secret_text"]` so secrets survive. Afterwards check `/settings` lists every binding. Crons: `PUT .../schedules` with the **full** list. Before deploying, download the live code (`.../content/v2`) and confirm it matches `origin/main`, so you don't overwrite unmerged work.

## Secrets
- Worker secrets live only in Cloudflare (names above). The VAPID private key is only there.
- Cloudflare, Twilio, Vapi, Stripe and Calendly keys are injected by the session proxy. Never ask Gio to paste a key.
- `ADMIN_KEY` is not available in sessions, so the admin routes can't be called. Test through the demo app instead.

## Run and test
No build step, no `package.json`, no test suite.
- Syntax: `node --check workers/books/worker.js`; `node -e "import('./workers/receipt-demo/worker.js')"`.
- Logic: import the worker in Node with an in-memory `Store` and a fake `fetch` for QuickBooks and Twilio. Keep the harness in the scratchpad, not the repo. Synthetic data only.
- UI: render `page.js` with mocked API data and screenshot with the preinstalled Playwright at 390px (phone) and 1280px.
- Live checks, read-only: the demo app below.

## Demo links
- Books demo, JCM branding, QuickBooks sandbox, no login (for prospects): `https://receipt-demo.gpetrucci93.workers.dev/<demo key>/`. The key is an access credential: keep it out of this repo. Gio has the full link.
- Books connector: `https://books.gpetrucci93.workers.dev` (OAuth `/callback`, customer invoice pages `/d/<id>`, accountant packs `/pack/<id>`)
- Website demo roofer site: `/example` on the website
- Mia demo line: 01752 741686

## Git
- Work on a branch, never directly on `main` (pushing `main` deploys the website).
- `git fetch origin && git merge origin/main` before starting and before any deploy. For `PROGRESS.md` conflicts, keep both sides.
- Shallow clone: run `git config --add remote.origin.fetch "+refs/heads/<branch>:refs/remotes/origin/<branch>"` so status tracks your branch.
- Add a short dated note to `PROGRESS.md` for anything another session needs to know.

## Token usage
At the end of a long session: `npx -y ccusage@20.0.45 claude session --offline` (nothing to install; the logs are wiped with the cloud machine, so run it before you finish).
