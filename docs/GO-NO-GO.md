# Go / no-go for a controlled launch

Branch: `launch-candidate` (https://github.com/gpetrucci1888/localdesk-site/compare/main...launch-candidate). **Nothing below has been done.** No deploy, no merge to main, no Stripe activation, no Vapi or Twilio change. Each step needs the owner's explicit approval at the time.

## Verdict today
**GO for a controlled deploy of the Books and HQ workers** once the backup in section 3 is taken. The new code is inactive where it needs secrets (Stripe) and otherwise adds features to HQ. **NO-GO for live Stripe payments, ads, or contacting customers** until sections 5 and 6 pass. The website merge is a separate approval (section 2).

## 1. Exact deploy changes
**Books worker** (`python3 ops/deploy_workers.py books`, uploads `worker.js`, `admin.js`, `freeagent.js`, `xero.js`, `stripe.js`):
- Stripe webhook `POST /stripe/webhook` and checkout `POST /checkout` (admin key). Both refuse until the Stripe secrets are set.
- Founding places reserved in the Store (five, atomic, 7-day hold), `GET /founding`.
- Leads: new stages (Interested, Zoom booked), call plan fields (next action, Zoom time and link, TPS result, do not call), lead source from the site forms, lead rename restored.
- Health report: adds software, last 10 digits of the mobile, and first-receipt flag per client.
- Xero self-test fix.

**HQ worker** (`python3 ops/deploy_workers.py hq`, uploads `worker.js`, `content.js`, `ui.js`, `font.js`, `leads.js`, `passkey.js`, `posts.js`, `posts-seed.js`):
- Leads: stages, call plan, TPS and do-not-call, payment-link button, Books onboarding view, founding places and sources cards.
- Content approval queue (More, Content).
- Face ID login (More, Face ID login). Passphrase and code login unchanged.

**Order:** Books first, then HQ (HQ reads the new Books routes and shows "unknown" if they are missing, so the order is safe either way).

## 2. Website (separate approval; merging to main publishes it)
New thank-you page, softer answering wording ("answers the calls you miss"), `?utm_source=` capture on the three forms. Cloudflare publishes `main` automatically. Include the preview-builds fix (`"previews": {}` in `wrangler.jsonc`). The forms send an extra optional `source` field; the old Books worker ignores it, so the order with the workers does not matter.

## 3. Backup and rollback
Before deploying:
1. HQ, Backups, **download a backup now** (Books data as a file). Keep it.
2. Note the live versions (read from Cloudflare on 31 Oct): **books `1c815831`**, **hq `5d07d17d`**, **website `e38b0c0f`**. These are the rollback targets.
3. After deploy, the daily HQ backup keeps running (last 30 days).

Rollback: Cloudflare, Workers and Pages, the worker, Deployments, choose the version above and roll back (one click). **Rolling back to a version restores that version's settings, including secrets, as they were at that time**, so roll back only to the versions listed (taken after the latest secret change). Website: revert the merge commit on main.

## 4. Secrets and data impact
- **Secrets:** existing secrets are kept on deploy. No new secret is needed to deploy. Optional, set later by the owner: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, four `STRIPE_PRICE_*` variables on `books`; `STRIPE_KEY`, `STRIPE_PRICES_*` on `hq`.
- **Data (Books Store):** only adds keys: `founding:`, `foundingflag:`, `once:`. Existing leads and clients are untouched; old stage values remain valid; new lead fields appear only when used.
- **Data (HQ Vault):** adds `posts` (content queue), `pk` and `pkch` (Face ID devices, one-time challenges), and a health cache. Login state (`totp`, `epoch`, lockouts, backups) is untouched.
- **Nothing is migrated, renamed or deleted.**

## 5. Stripe test-mode setup (owner; steps and decisions in docs/STRIPE-SETUP.md)
1. Stripe in **test mode**: create the four prices, a restricted key (Checkout Sessions write only), and the webhook to `https://books.localdeskai.co.uk/stripe/webhook` for `customer.subscription.created`, `updated` and `deleted`.
2. Cloudflare, `books`: add the two secrets and four price variables (the **test** ones).
3. Cloudflare, `hq`: test read-only key and price ids.
4. Decide: cancel within 7 days gives the place back (built as yes), unpaid hold 7 days (built as 7).
Live Stripe keys only after section 6 passes.

## 6. Real integration checks (none done yet; mocked tests do not count)
| Check | Who | Pass if |
|---|---|---|
| HQ pages load after deploy: Home, Leads, Customers, Payments, More, Content, Face ID login | Owner | no error pages; Leads shows "founding places reserved" |
| Face ID on the owner's phone | Owner | add the phone, log in with a touch |
| Add a test lead, set the call plan, TPS result, Zoom link | Owner | saved; a "registered" lead hides the Call button |
| Stripe test payment from "Make a payment link" with card 4242 4242 4242 4242 | Owner (Claude can watch the log) | success page is the thank-you page; webhook shows delivered in Stripe; founding place active |
| Cancel the test subscription in Stripe | Owner | the place comes back |
| Resend the same webhook from Stripe | Owner | nothing changes |
| Failed card 4000 0000 0000 0341 | Owner | HQ Payments shows it as failed |
| Mia ten test calls (docs/MIA-TEST-SCRIPT.md) | Owner | all rows ticked |
| Books: connect one real or test QuickBooks, FreeAgent or Xero company and file one receipt | Owner | lead page shows software, Connected, and "A receipt has been filed" |

## 7. Before any customer is contacted or charged
- ICO registration and your own details on the privacy page.
- A way to check TPS and CTPS (docs/COLD-CALLING-COMPLIANCE.md).
- The claims in docs/LAUNCH-READINESS.md confirmed (trial, 300 minutes, day-and-night answering, text summary, recording notice).
- Stripe live mode switched on by the owner, not by Claude.

## The approval request to send when ready (exact wording)
"Approved: deploy the **books** worker, then the **hq** worker from `launch-candidate`, after I have downloaded a backup. Do not merge to main, do not deploy the website, do not activate Stripe."
Claude does exactly that, reports the new version ids, and stops.
