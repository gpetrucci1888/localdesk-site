# Handoff (written 30 Oct 2026, end of a long session)

**RELEASED 30 Oct 2026 (owner said "deploy" in chat): `main` is at 40e39a3 (PRs #2 and #3 merged). Books and HQ workers were deployed from that commit; rollback copies of the previous live code were saved in the old session scratchpad only. HQ has `leads.js`. Not yet live: nothing except the open branches `claude-handoff` (PR #6) and `fix-xero-selftest`. HQ money figures count nobody as paying until `STRIPE_PRICES_BOOKS` / `STRIPE_PRICES_RECEPTIONIST` are set on the HQ worker (and Stripe is connected there: HQ has no STRIPE_KEY yet).**

Read this first in a new session, then `CLAUDE.md` and `PROGRESS.md`. Secrets and private business notes are NOT in this repo (see "Where private things live").

## What exists and is live
- **Website** (`public/`): redesigned SaaS-style home page, Receptionist page (dark + yellow) and Books page (light + teal), shared `public/ui.css`. Published by pushing to `main` (Cloudflare builds it). Last published: commit `4c2f85b`.
- **Books connector worker `workers/books`** (QuickBooks, FreeAgent, Xero). Deployed with `ops/deploy_workers.py books` (files: worker.js, admin.js, freeagent.js, xero.js). Platform modules are chosen by one table (`PLATFORMS`, `SOFTWARE`) in `worker.js`; a new platform = one module with the same methods as `freeagent.js`/`xero.js` plus one line each.
  - FreeAgent: realm id = `88` + FreeAgent user id. Tested against FreeAgent's real SANDBOX (all 10 self-test steps). Live customer companies NOT tested; FreeAgent's live approval for the app is unconfirmed.
  - Xero: realm id = `77` + digits derived from the tenant GUID. Tested against a real Xero (trial business) and the self-test passes. Scopes are the granular set (the broad `accounting.transactions` is refused for new apps). A new Xero app can connect 5 organisations before Xero wants a paid plan.
  - Admin self-test: `POST /selftest/<realm>` (admin key) files, finds, undoes and cleans up TEST entries; on practice connections it also adds and archives a TEST bank account for Xero.
- **Customer app `workers/receipt-demo`**, **owner dashboard `workers/hq`** (HQ new-client form has a platform choice: QuickBooks, FreeAgent, Xero).
- Tests: `node --test test/*.test.mjs` (138 pass) and `node test/browser/site.check.cjs`, `hq.check.cjs`, `admin.check.cjs`, `agree.check.cjs` (Playwright; Chromium is preinstalled).

## Independent review (ChatGPT)
`docs/AI-COLLAB.md` explains the GitHub channel. PR #2 carries all pending work and the first review request (`docs/reviews/2026-10-30-release-readiness.md`). The automatic review comment is built but OFF until Gio adds an OpenAI API key (repo secret `OPENAI_API_KEY`) and variable `OPENAI_REVIEW_MODEL`. Also done: Xero refresh now takes a short lease in the Durable Object (`/reflock/<realm>`) so two Worker instances cannot both use a single-use refresh token; tested.

## Sales pipeline (GitHub issue #1, branch `lead-pipeline`, PR #3, NOT deployed)
Website enquiries now become leads in the Books connector's Durable Object (`lead:` keys; admin routes `/leads`), shown in HQ under **Leads** (`workers/hq/leads.js`). Pipeline new, contacted, demo, trial, onboarding, paying, lost, with follow-up dates, editable draft messages (never sent automatically: buttons open the owner's own Messages/WhatsApp), per-product onboarding checklists, delete on request, lost leads purged after 90 days, leads in backups. HQ money figures now count only ACTIVE paid Stripe subscriptions (trials and failed payments excluded) and show progress to 20 paying customers per product. HQ money figures use verified product IDs only (STRIPE_PRICES_BOOKS / STRIPE_PRICES_RECEPTIONIST on the HQ worker, or Stripe product metadata localdesk_product) and count paying only when the latest invoice is paid; see `docs/RELEASE-PLAN.md`. Deploy needs both workers: `ops/deploy_workers.py books` and `hq` (hq now has `leads.js`).

## Not yet deployed (branch `handoff-and-parity`, if merged)
- Health check now checks every connected business in parallel (admin client list was slow).
- FreeAgent missing-receipt flags (`noReceipt`) for the monthly check, with a test. After deploying, call the admin route `/noreceipt/<realm>` on the sandbox FreeAgent client to confirm against the real service, then the Books page table ("What works where") can add FreeAgent to the missing-receipt row.
- HQ help text now covers FreeAgent and Xero (`workers/hq/content.js`); the HQ worker needs a deploy (`ops/deploy_workers.py hq`) for Gio to see it.
- Deploy only with Gio's approval in the conversation. Before deploying a worker, merge latest `origin/main` and take a rollback copy of the live code.

## Feature coverage by platform (accurate as of now)
- All three: receipts (with photo), undo, invoices, who owes you, monthly summary text, health check, disconnect.
- Missing-receipt flags: QuickBooks and Xero (FreeAgent code written, undeployed). Tidy-up (uncategorised) flags: QuickBooks and Xero.
- QuickBooks only: quotes, quarterly accountant pack, profit per job and customer list, payment alerts.

## Decisions and standing rules
- Never deploy, push to `main`, spend money, contact customers or change production config without Gio's explicit approval in the current conversation. Pushing `main` publishes the website.
- No secrets in chat or in the repo. Gio types secrets into Cloudflare himself.
- Do not claim a legal requirement unless confirmed (identity checks wording was removed from the pages). The monthly books-check only flags things; it never certifies accounts or replaces an accountant.
- Gio has said he does not want HMRC / anti-money-laundering raised again. Do not bring it up unless he does.
- Keep token use low; plain English; no unnecessary reports.

## Open items (all need Gio)
1. Stripe payment links for Receptionist and Books are prepared (`ops/mia_stripe.py`, `ops/books_stripe.py`) and switched off. Needs his "go".
2. Branded addresses (`books.` and `app.localdeskai.co.uk`) are not switched on (`ops/books_domains.py`); customers still see workers.dev addresses. Add the new callback address in Intuit, Xero and FreeAgent when switching.
3. Legal documents need a solicitor's review and his details (legal name, UK address, ICO number, insurance). Data deletion after a customer leaves is still in dry run (`PURGE_MODE`).
4. FreeAgent: email their API support about live approval (draft wording is in the private notes). Xero app redirect URI is the books worker callback.
5. First real customer connections (one per platform) are the real proof; use HQ new client with "A real customer's company".
6. Breach record for the earlier public-repo exposure is unsigned; GitHub purge request not made.

## Test accounts and what a new session loses
- Session scratchpad files are lost between sessions: the admin key copy, the demo key copy, and the FreeAgent sandbox login. The real admin key lives only in Cloudflare (books and hq workers). To work with the admin routes, Gio must set a new `ADMIN_KEY` secret in Cloudflare on both workers and hand it to the new session privately.
- FreeAgent sandbox company "Penrose Test Plumbing" (fictional) is connected to Books (realm 8845659). Its login password was kept only in the old scratchpad: use "forgot password" or make a new sandbox company.
- Xero: developer app "Localdesk Books" (Gio's Xero login) and a trial business connected as a test client. Delete test clients from HQ when finished.
- Cloudflare API access works from sessions through the proxy with no token (see `ops/deploy_workers.py`). FreeAgent and Xero hosts must be allowed in the environment's network settings.

## Where private things live
- Private notes (launch blockers, onboarding checklist, breach record, runbooks, FreeAgent and Xero status) were in `Localdesk/00 Private` and `Localdesk/10 Bookkeeping` in the old session's working folder, and are copied into a PRIVATE Claude artifact titled "Localdesk private handoff" (find it with the Artifact tool `list`). The private repo `localdesk-client-sites` could not be attached to the session.

## Deployed 31 Oct 2026 (owner approved in chat: books worker, then hq worker, from `launch-candidate`)
- books: new version `a0a0c13c` (previous `1c815831`). hq: new version `fa39aeb8` (previous `5d07d17d`). Bindings and secrets unchanged, checked through the Cloudflare API. Rolling back restores that version's secrets, so use these two ids only.
- Not done: website (main not merged), Stripe (no keys, prices or webhook), Vapi, Twilio. I could not reach the live addresses from the build environment, so no live page check was possible.

## Deployed 31 Oct 2026, second time (owner approved "approve A": books worker, then hq worker, for the Stripe check)
- books: new version `1d50027d` (previous `a0a0c13c`). hq: new version `2b32bcda` (previous `fa39aeb8`). Bindings and secrets unchanged (checked via the Cloudflare API). Adds the HQ Stripe check page and the Books `/stripe/status` route (read-only).
- Still not done: website and main merge, Stripe keys, prices and webhook, Vapi, Twilio. Rollback targets are the two previous version ids above.

## Deployed 31 Oct 2026, third time (owner approved "deploy" after the redeploy request: books worker, then hq worker)
- books: new version `d5924a7d` (previous `1d50027d`). hq: new version `0cbb034f` (previous `2b32bcda`). Secrets and bindings unchanged. The deploy gate ran inside each upload ("Gate passed: all tests green, tree committed", commit `22453c2`).
- Brings: Receptionist links without the setup fee (invoiced after the trial), permanent do-not-call and TPS bars by number, no duplicate manual leads, Stripe ticking a lead's payment step, Zoom reminders on Home, the deploy gate.
- Still not done: website and main merge, Stripe keys, prices and webhook, Vapi, Twilio. Rollback targets: the two previous version ids above.

## Deployed 31 Oct 2026, fourth time (owner said "deploy" in chat: books worker, then hq worker, from `launch-candidate` commit `12399a6`)
- books: new version `6c138077`. hq: new version `15d95823`. The deploy gate ran before each upload and passed.
- **Rollback targets (current before this deploy; they include the Stripe secrets the owner added in the dashboard):** books `4a4f1a69`, hq `0cbb034f`. Do not roll books back to an older version than `4a4f1a69`: it would drop the Stripe webhook secret.
- Preserved (Cloudflare API): books has 24 bindings including `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and the four `STRIPE_PRICE_*` variables; hq has its 5 bindings (no Stripe key yet).
- Brings: the Books `/thanks` page (payment redirect default), HQ reading the monthly price ids from Books, content planning and the Home reminder for posts due.
- Smoke checks, no charges: Stripe webhook endpoint still enabled with its three events; no checkout sessions or subscriptions exist; no traffic yet on either worker since the deploy. Live addresses are unreachable from the build environment.
- Not done: website and main merge, any test charge, live Stripe, Vapi, Twilio, customers.
