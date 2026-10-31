# Smallest next approvals (separate, in this order)

## A. Deploy the Stripe check (Books and HQ workers again)
New since the last deploy: HQ **Stripe check** page and the Books `/stripe/status` route, both read-only. Needed so Stripe test setup can be verified at a glance. Same method, backup and rollback as before (rollback targets now: books `a0a0c13c`, hq `fa39aeb8`). Exact wording: "Approved: deploy the books worker, then the hq worker from launch-candidate. Do not merge to main, do not deploy the website, do not activate Stripe."

## B. Website merge (separate; publishes the site)
Contents: thank-you page, softer answering wording, `?utm_source=` capture, a new privacy paragraph about sales calls (draft wording for you to read first), preview-builds fix. Rollback: revert the merge commit. Not needed for the cold-calling and Zoom route, so it can wait until you are happy with the wording.
Blockers on the live site today, whatever we merge: the privacy page still has comment placeholders for **your business address** and **ICO registration number**, and nothing yet states insurance details. Fill these in before you cold call.

## C. Live payments (last; owner activates, not Claude)
Only after: Stripe test steps in docs/JOURNEY-TEST-PLAN.md pass, Stripe check is all green in test mode, the Mia ten-call test passes, ICO registration and your address are on the privacy page, a TPS and CTPS checking method is in place, and the claims in docs/LAUNCH-READINESS.md are confirmed. Then you switch Stripe to live mode, create live prices, and replace the test keys and ids in Cloudflare yourself.
