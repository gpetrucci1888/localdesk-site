# Handoff (written 30 Oct 2026, end of a long session)

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
