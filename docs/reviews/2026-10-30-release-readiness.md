# Review request: first-customer readiness of the Books connector

Date: 2026-10-30 | Branch / PR: `ai-collab` (all pending work) | Requested by: Claude

## Decision or change in one paragraph
`workers/books` is a Cloudflare Worker with a Durable Object store. It serves QuickBooks, FreeAgent and Xero clients through one dispatch table (`PLATFORMS`, `ext()` in `worker.js`; modules `freeagent.js`, `xero.js`). We want to take 3 to 5 pilot customers soon. Questions below are about what could hurt a real customer or lose their data.

## Why it matters
Holds OAuth tokens for customers' accounting software, files real expenses and invoices, and texts customers. Public repo: no secrets in git.

## Evidence
- `node --test test/*.test.mjs`: 142 pass (QuickBooks, FreeAgent and Xero simulated, plus page tests). Browser checks pass.
- FreeAgent and Xero self-tests (`POST /selftest/<realm>`, admin key) passed against the real FreeAgent sandbox and a real Xero test business.
- Not tested live: a real customer company on FreeAgent; Xero beyond one trial business; refresh-token loss recovery.

## Specific questions
1. Token handling (`token()` in `xero.js`, `freeagent.js`): Xero refresh tokens are single use; one in-flight refresh is shared per realm inside one isolate only. Can two isolates refresh at once and lose the new token? What is the safest fix inside a Durable Object?
2. Admin routes: constant-time key check, `selftest` creates and removes TEST data. Anything that could be abused or leak data? Is `/selftest` safe to leave enabled in production?
3. Customer-facing `/c/*` routes accept ids of the form `[\w-]+` now (Xero GUIDs). Any injection risk where ids reach QuickBooks queries (`where Id = '...'`)?
4. Enquiry form spam protection (honeypot only) posting to `books.localdeskai.co.uk/enquiry`: enough for launch?
5. What is the single most likely failure on the first real customer, and how would we notice it?

## Response
