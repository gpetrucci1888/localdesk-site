# Localdesk website

Edit public/index.html. Every push to main deploys automatically via Cloudflare.

## Books workers (workers/books, workers/receipt-demo)

These are deployed separately from the website (not by pushing to main). The tests run both workers locally on
made-up data, with fake QuickBooks, Intuit, Twilio and AI. Nothing in them can reach a real service.

    node --test test/*.test.mjs                         # needs Node 22 or newer; no installs

`test/browser/csp.check.cjs` is a real-browser check of the security headers (needs Playwright; see the file).

**This repository is public.** No personal data (names or numbers of prospects, partners or clients), prospect
pricing, keys, tokens, app or demo keys, private links or bank details belong in it. `test/repo-hygiene.test.mjs`
fails if any slip in. Private notes live outside git.
