# Localdesk roadmap and audit (31 Oct 2026)

Goal: 20 paying customers of each product (Receptionist 397 a month, Books 150 a month) = 10,940 a month before costs, excluding setup fees (Receptionist 497 setup waived for the first 5 founding clients only; Books 395 setup).
Rules: branches only. The owner approves every deploy, merge to main, spend, customer contact, public posting or ads, and every Vapi or Twilio change. No secrets in this public repo.

Status key: BUILT (works and tested), PARTIAL, MISSING, EXTERNAL (lives outside this repo, so not verified here).

## Product
| Area | Status | Notes |
|---|---|---|
| Books on QuickBooks | BUILT | Live. Receipt filing, chasing, monthly summary, admin tools, tests. |
| Books on FreeAgent | PARTIAL | Code and tests built. Live approval from FreeAgent unconfirmed. |
| Books on Xero | PARTIAL | Code built, sandbox tested. Self-test fix on branch `fix-xero-selftest`, not deployed. |
| Receptionist (Mia on Vapi and Twilio) | EXTERNAL | Assistant, numbers and call-summary live in Vapi and Twilio, not in this repo. Not verified here. |
| Receptionist onboarding checklist | BUILT | Checklist per product in HQ Leads. |
| Caller exclusion ("leave these callers alone") | MISSING | Designed and parked. Needs a Vapi or Twilio change, so owner approval first. |

## Selling
| Area | Status | Notes |
|---|---|---|
| Website (home, Books, Receptionist, terms) | BUILT | Live. Prices correct. Live demo button and demo number still on the site. |
| Lead capture and CRM (HQ Leads) | BUILT | Website form to leads, statuses, follow-up dates, drafts never auto-sent. Deployed. |
| Founding-places guard | BUILT, not deployed | Branch `stage1-founding`: a sixth waiver is refused. |
| Content pack and approval queue | BUILT, not deployed | Branch `content-queue`: 14 draft posts, HQ approve or reject page, founding posts blocked when 5 used. Drafts only. |
| Automatic posting to Facebook and Google Business Profile | MISSING | Needs a Meta app, Google API access and owner approval of each connection. No connector found. |
| Meta ads | MISSING | Owner approval and a spend cap needed. Not started. |
| Website for trades (add-on) | MISSING | Mentioned as "add later" only. Lovable is connected but empty. |

## Money
| Area | Status | Notes |
|---|---|---|
| Stripe in HQ (paying, failed, road to 20) | PARTIAL | Code and tests built. No `STRIPE_KEY` on the HQ worker yet. Owner types it into Cloudflare. |
| Stripe products and prices | MISSING | Planned in docs/STRIPE-PLAN.md. Nothing created. |
| Automatic provisioning after payment | MISSING | Would touch Vapi and Twilio, so approval needed. |

## Running the business
| Area | Status | Notes |
|---|---|---|
| HQ owner dashboard | BUILT | Home, Leads, Customers, Payments, Books, Backups, Docs. |
| HQ login | BUILT | Passphrase plus code, SameSite Lax, deployed. Phone fix with Face ID or fingerprint is live (branch `login-mobile`, not yet merged to main). |
| Backups of Books data | BUILT | Daily, last 30 kept. |
| Tests | BUILT | 164 unit tests and browser checks. |
| Support triage and retention | MISSING | Not started. |
| Exception-based HQ ("only what needs you") | PARTIAL | Home shows items needing attention. No alerts to the owner yet. |
| Security and UK privacy documents | PARTIAL | Terms and privacy pages exist. Owner's own legal details (name, address, ICO number, insurance) still needed. |

## Open blockers that need the owner
1. Merge `fix-preview-builds` (adds `"previews": {}` so branch preview builds pass).
2. Deploy decisions for `fix-xero-selftest`, `stage1-founding`, `content-queue`, and merging `login-mobile` to main (the live HQ already runs it).
3. Stripe key and price IDs in Cloudflare.
4. Check Vapi Calls and billing (docs/RECEPTIONIST-RELIABILITY.md).
5. FreeAgent live approval email.
6. Own legal details for the website.

## Phases
1. **Revenue foundations (now):** Stripe connected in HQ, founding places counted from real entitlements, price IDs set, content approval queue live.
2. **Receptionist reliability:** Vapi checks and protections, recording notice wording, onboarding in minutes, then caller exclusion.
3. **Books completion:** FreeAgent and Xero live, onboarding automation, reminders.
4. **Sales automation:** follow-up drafts, trial tracking, drafts for the owner to approve, scheduled posting once the owner connects the accounts.
5. **Exception-based operation:** alerts for failed payments, broken connections and unhappy clients, support triage.
