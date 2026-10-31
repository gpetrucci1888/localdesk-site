# Launch status (31 Oct 2026): what is actually live, and go / no-go

This replaces the "not deployed" wording in older launch documents. Where they disagree, this file is right.

## Live now
| Piece | Version | State |
|---|---|---|
| Books worker | `777e3fd3` | Stripe checkout and webhook, founding places, leads, Books onboarding view, thank-you page at `/thanks`, request logs on. |
| HQ worker | `5c9c1a25` | Leads with call plan and cold-call safeguards, content queue, Stripe check, Face ID login, Zoom and setup-fee reminders, request logs on. |
| Website | `6545b782` | Redesigned pages, softer wording, lead-source links, privacy page with sales-calls paragraph, thank-you page. |
| Stripe | test mode | Four prices, webhook with three events, and one real test sign-up verified end to end (7-day trial, no setup fee, webhook delivered). |
| Logs | on | Workers Logs on books and hq with query strings redacted (one-time link tokens are not logged). |

## On the branch, not live yet
The 30-day social calendar in HQ (drafts), the 30 images, and the social tooling. Say "deploy" to put the HQ part live.

## Go / no-go
- **Technical, ready:** Books, HQ, website, Stripe test flow, deploy gate, tests (237 pass), logs.
- **Technical, not yet proven:** a founding-client checkout, a cancellation inside 7 days, a failed card, and a resent event, all with real Stripe test payments (mocked tests cover the logic); HQ revenue figures (need HQ's read-only Stripe key); Books on a real connected company; Mia's ten test calls (no calls have been placed).
- **Owner only:** ICO registration, address on the privacy page, a TPS and CTPS check method, Stripe live mode and live prices, the Mia ten calls, and approving any social connection.

**Verdict:** GO for cold calling and Zoom demos once the owner's legal items are in place (they are the owner's, not technical). GO for taking a first real customer in test mode today. NO-GO for taking real money until Stripe live mode is switched on by the owner and the live prices and keys are in Cloudflare.
