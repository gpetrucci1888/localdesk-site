# Launch readiness: `launch-candidate` branch

One branch with everything built so far, merged and tested together: Stripe checkout and webhook, founding places, Books onboarding view, lead sources, HQ content queue, Face ID login, Mia checks, thank-you page, softer website claims, Xero test fix, preview-builds fix, roadmap and plans. **Not deployed. Nothing merged to main.** Compare: https://github.com/gpetrucci1888/localdesk-site/compare/main...launch-candidate

## What the tests do and do not prove
- **Automated, mocked (195 unit tests, 84 HQ + 61 site + 12 admin + 8 agree browser checks):** all logic, with fake Stripe, fake texts and fake GitHub. These prove the code does what it says. They are **not** verification of real Stripe, real Vapi or Twilio, or real phones.
- **Not yet verified for real:** a Stripe test-mode payment and webhook, Mia's ten test calls, HQ revenue figures against real subscriptions, Face ID on the owner's phone, FreeAgent live approval, Xero on a real company.

## Deployment order (each needs the owner's explicit approval; Claude does the upload)
1. **Books worker** (`python3 ops/deploy_workers.py books`): adds Stripe webhook and checkout (inactive until secrets are set), founding places in the Store, lead source, health fields. Existing secrets kept.
2. **HQ worker** (`python3 ops/deploy_workers.py hq`): content queue, payment-link button, Books lead view, sources card, Face ID login (the live HQ already runs the login fix).
3. **Website** (merge to main, which publishes it): thank-you page, softer answering wording, `?utm_source=` capture on forms. Merge last, so the forms never post a field the worker ignores.
4. **Stripe test mode** (owner, `docs/STRIPE-SETUP.md`), then run `docs/JOURNEY-TEST-PLAN.md` steps 1 to 6.
5. **Mia ten-call test** (`docs/MIA-TEST-SCRIPT.md`) before the first client goes live.
6. Live Stripe keys and prices only after step 4 passes.

## Rollback
- **Workers:** Cloudflare, the worker, Deployments, roll back to the previous version (one click). Secrets and data are untouched. The new Store routes only add keys (`founding:`, `once:`, `foundingflag:`), nothing is migrated or removed.
- **Website:** revert the merge commit on main (publishes the previous site).
- **Stripe:** nothing is created by the code. Disabling is deleting the webhook endpoint or removing the secrets (the webhook then answers "not set up").
- **Face ID login:** the passphrase and code login still works, so a bad Face ID setup cannot lock the owner out.

## HQ revenue accuracy checklist (owner, after Stripe is connected)
- [ ] `STRIPE_KEY` is a read-only key. `STRIPE_PRICES_RECEPTIONIST` and `STRIPE_PRICES_BOOKS` list the monthly and setup price ids.
- [ ] HQ Payments shows only real Localdesk subscriptions: a test subscription is "on trial", not "paying", until its first invoice is paid.
- [ ] "Road to 20 each" matches Stripe's own subscriber list for each product.
- [ ] "Founding places reserved" matches the leads that have the waiver ticked.
- [ ] Failed payments appear under "Needs you".

## Legal and business details still needed from the owner
Name and address for the privacy policy, ICO registration number, insurance details, and confirmation that the terms and privacy pages are right for how Localdesk really operates.

## Claims the owner should confirm before ads or posts go out
7-day free trial honoured, 300 minutes included, calls answered day and night (the pages say "24/7"), text summary after each call, recording notice, QuickBooks live today, FreeAgent and Xero status.

## Genuine owner blockers
Stripe test-mode setup and keys, the two default decisions (cancel within 7 days gives the place back, unpaid hold 7 days), deploy approvals in the order above, Mia ten-call test, legal details, and the Vapi Calls check.
