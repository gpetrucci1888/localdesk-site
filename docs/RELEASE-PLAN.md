# Release plan for the pending work (needs Gio's approval for every step)

Pending branches, in this order: `ai-collab` (PR #2: handoff notes, review channel, parallel health check, FreeAgent receipt flags, Xero refresh lease, HQ help) then `lead-pipeline` (PR #3: sales pipeline, paying-only figures). PR #3 is based on PR #2, so merge #2 first; PR #3's base is set to `ai-collab` so its diff shows only the pipeline.

## Before anything is deployed
1. Rollback copies: download the live code of `books`, `hq` and `receipt-demo` (`GET .../workers/scripts/<name>/content/v2`) and keep them outside the repo.
2. Confirm the live code matches `origin/main`'s workers, so nothing unmerged is overwritten.
3. `node --test test/*.test.mjs` and the browser checks in `test/browser/` pass on the exact commit to be deployed.
4. Bindings: no new bindings are added. `books` needs the `STORE` Durable Object (new internal routes `/lead`, `/leads`, `/reflock` live inside the existing class). `hq` needs `BOOKS` (service), `VAULT` (Durable Object) and its existing secrets. HQ gains two OPTIONAL settings: `STRIPE_PRICES_BOOKS` and `STRIPE_PRICES_RECEPTIONIST` (comma separated Stripe price IDs). After deploy, check `/settings` of each worker lists every binding.

## Deploy order
1. `books` worker first (HQ calls its new `/leads` routes). Check `GET /companies` and `GET /leads` with the admin key.
2. `hq` worker (now four files: worker.js, content.js, ui.js, font.js, leads.js). Open Home, Leads and Customers.
3. Website: merging to `main` publishes it. `public/` is unchanged by these branches.
4. Set `STRIPE_PRICES_BOOKS` and `STRIPE_PRICES_RECEPTIONIST` on the HQ worker with the real price IDs (or tag the Stripe products with metadata `localdesk_product`). Until then every subscription shows as "not matched to a product" and nothing counts as paying. That is deliberate.

## Rollback
Redeploy the saved copy of the worker that broke (about a minute). Leads are stored under their own `lead:` keys, so rolling the code back loses nothing.
