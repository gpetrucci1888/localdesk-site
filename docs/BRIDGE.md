# Claude and GPT bridge (built, tested with mocks, NOT deployed, NOT active)

**What it is.** A Cloudflare worker called `bridge`. When Claude posts a structured request on a pull request, GitHub sends a signed webhook to the worker. The worker asks an OpenAI model to review, using the project's canon (prices, roles, approval rules), repo documents, the diff and the reviewer's own earlier replies. The answer is posted back on the same pull request. No polling.

**What it is not.** It is a separate reviewer called through the OpenAI API. It is not the owner's ChatGPT conversation and has no memory beyond what the worker sends it. It can only write comments.

## Audit: can the current setup do this?
| Piece | Status |
|---|---|
| GitHub webhooks to a Cloudflare worker | Possible. Needs a public URL for the worker (a custom domain such as `bridge.localdeskai.co.uk`) and a webhook added in the repo settings by the owner. |
| Cloudflare Workers and Durable Objects | Already used by Books and HQ on this account. The bridge adds one worker and one Durable Object. No new product. |
| OpenAI API | **Not set up.** Needs an API key, a model name and a spending limit. New paid service: owner approval first. |
| GitHub write access for replies | Needs a fine-grained token restricted to this one repo (below). |
| Waking Claude when GPT replies | The Claude Code session subscribes to PR activity (`subscribe_pr_activity`), which already woke Claude for comments in this session. A reply from the bridge's account should arrive the same way but that is **untested**. If no Claude session is open, the reply waits on the PR and is read at the next session. |
| Existing `.github/workflows/gpt-review.yml` | Label-triggered PR review in GitHub Actions, off until a key is added. It can stay off. The bridge replaces it for conversation-style requests. |

## Flow
1. Claude posts a request (`ops/bridge_request.mjs` builds it) on PR #6: a hidden JSON header plus plain text.
2. GitHub sends `issue_comment` to `https://bridge.../webhook`.
3. Worker checks, in order: signature (HMAC-SHA-256, constant time), mode, event type, repository, author is the owner and `author_association` is OWNER, not its own comment, request format, files allowed.
4. One-at-a-time Durable Object decides: duplicate delivery, duplicate comment, duplicate request id, minimum gap per PR, per-PR and per-day caps, monthly spend cap. Each OpenAI attempt is reserved at its worst case first.
5. Worker reads context from GitHub (canon docs plus the files Claude named, at the named branch) and the PR diff, redacts secret-shaped text, calls OpenAI, posts the reply, records the real cost.
6. Claude receives the PR comment and continues.

Typical latency: webhook and checks take well under a second. The OpenAI call dominates: seconds for a small answer, up to a minute or two for a long review.

## Request format (Claude to GPT)
```
<!-- claude-request {"v":1,"type":"review","id":"2026-11-01-founding-1","topic":"founding places","files":["docs/ROADMAP.md"],"ref":"stage1-founding"} -->
Plain text: what changed and the specific questions.
```
`type`: review (includes the PR diff), question, milestone. `id` must be new for each request. Up to 8 files, only under docs, workers, test, ops, public, content. No dotfiles, no `..`, no `.env`, `.pem`, `.key`.

## Reply format (GPT to Claude)
`VERDICT`, `DECISION CLASS` (routine, or owner approval required with the actions named), `FINDINGS`, `INSTRUCTIONS FOR CLAUDE`, `QUESTIONS`. The reply starts with a hidden marker so the bridge never reacts to it, and can never contain a request marker.

## Routine versus owner approval
- **Routine (Claude and GPT decide, no owner wait):** planning, reviews, code on branches, tests, documentation, preparing PRs.
- **Owner only:** production deploys, merges to main, any spending or new paid service, contacting real customers, public posting, paid ads, any Vapi or Twilio change, irreversible billing or data changes. This list is in the reviewer's canon and the bridge cannot do any of them.

## Loop, duplicate and spend protection
- Reviewer replies and notices are ignored by marker and by reviewer login. Only the owner's account can trigger a review, and only with a valid request header.
- Each request id is answered once. GitHub retries of the same delivery are ignored.
- Defaults (changeable only by the owner in Cloudflare): 20 seconds minimum between reviews, 8 per PR per day, 30 per day, an estimated 20 dollars a month. When a limit is hit, one notice is posted and nothing more.
- Input is capped (90,000 characters) and output is capped (2,500 tokens).
- Kill switch: set `BRIDGE_MODE` to `off`, or delete the webhook in GitHub.
- Live mode refuses to run (fails closed) unless every secret, the model name and both prices are set.

### The spending limit is an estimate, not a guarantee
The monthly cap is the worker's own estimate. It is **not** a provider-side hard limit, and OpenAI project budgets and alerts may not stop spend instantly either. So there are two layers and both are estimates: the worker's cap, and a budget set in the OpenAI project. Do not rely on either as a promise.
How the estimate is kept pessimistic:
- **Every OpenAI attempt is reserved at its worst case before it is made** (input at 3 characters per token, plus the full output cap). If the reservation would pass the cap, the attempt is not made. This covers retries, so the total across all retries is checked attempt by attempt.
- **A failed attempt keeps its reservation** (it may still have been billed). Only a request the provider rejected outright (400 to 499 except 429) or rate limited (429) gives its reservation back. On success the real token usage replaces the reservation.
- Worst case per request: the inline attempts (default 2) times the scheduled retries (first try plus 2 retries) is at most 6 OpenAI attempts.

## Safe to repeat, pinned to one commit, run outside the webhook
- **No duplicate replies.** Before every comment post the worker looks for its own hidden marker on the PR. If GitHub accepted a post but the answer was lost, the retry finds the marker and does not post again.
- **Pinned commit.** The worker turns the request's `ref` (or the PR head if none) into one immutable commit SHA, reads every file at that SHA, and says the SHA in the reply. If the commit is the PR head the diff is the PR diff. If it is a different branch, the diff is main to that branch and the reply says it is not this PR's head. A branch that does not exist stops the request with one notice and no retries.
- **Runtime limits.** The webhook only verifies, saves a job and sets a Durable Object alarm, then returns. The review runs in the alarm, so a slow model is not cut off when the response is sent. A 15-minute scheduled pass wakes the alarm if one was ever lost.
- **Logs hold no upstream text.** Only our own event names, ids, status codes, costs and token counts are stored. Upstream error bodies are never logged or posted.

## Logging, errors, retries, fallback
- The Durable Object keeps the last 500 log lines. `GET /log` and `GET /usage` need the admin token.
- Reads from GitHub and calls to OpenAI retry with backoff on 429 and 5xx.
- If the reviewer stays down, one notice is posted ("Claude: carry on with routine work"), the job is kept, and it is retried after 1 and 10 minutes. Then one "stopped" notice. Claude should continue with routine work and send a new request (new id) later.

## Trust model and what is still unproven
- **Single-account trust.** Only the owner's GitHub login, with association OWNER, can trigger a review. Claude posts as the owner's account, so a request and a human comment look alike except for the hidden request header. A separate bot account for the reviewer's replies is recommended. Its permissions, and whether its replies wake a Claude session, need a live test.
- **Untested live:** a real GitHub webhook, the real OpenAI API, Durable Object alarm behaviour on Cloudflare, and the Cloudflare runtime limits in practice.

## Permissions and secrets needed (owner sets all of them, never in chat or GitHub)
| Item | Where | Notes |
|---|---|---|
| `GITHUB_WEBHOOK_SECRET` | Cloudflare secret and the GitHub webhook | A long random string. Payload type JSON, SSL verification on, event: Issue comments only. |
| `GITHUB_TOKEN` | Cloudflare secret | Fine-grained token for **this repository only**: Contents read, Pull requests read, Issues read and write, Metadata read. Nothing else. Best created from a separate GitHub bot account. |
| `OPENAI_API_KEY` | Cloudflare secret | A key in its own OpenAI project, with a monthly budget and alerts set there as a second layer. |
| `OPENAI_MODEL`, `PRICE_IN_PER_MTOK`, `PRICE_OUT_PER_MTOK` | Cloudflare variables | Verify the model name and current prices on OpenAI's site. I have not verified current prices. |
| `BRIDGE_ADMIN_TOKEN` | Cloudflare secret | Lets the owner read `/log` and `/usage`. |
| `REVIEWER_LOGIN` | Cloudflare variable | The bot account's GitHub name, if one is used. |
| Public address | Cloudflare | A custom domain for the worker, for example `bridge.localdeskai.co.uk`. |

## Realistic worst-case pricing
Cloudflare: Workers and Durable Objects are already in use. The 15-minute scheduled pass is about 96 runs a day and does nothing when idle. No extra cost expected, but check the plan limits.

OpenAI is pay per use. **The prices below are made up for illustration (2 dollars per million input tokens, 8 per million output). Replace them with the real ones before deciding.**
| Case | Calculation | Illustration |
|---|---|---|
| One attempt, worst case | 90,000 chars / 3 = 30,000 tokens in, 2,500 out | about 0.08 dollars |
| One typical review | 14,000 tokens in, 300 out | about 0.03 dollars |
| One request, everything fails and retries | 6 attempts at worst case | about 0.48 dollars |
| One day at the 30-review cap, all typical | 30 x typical | about 0.9 dollars |
| One day at the cap, all worst case | 30 x 0.08 | about 2.4 dollars |
| Month, theoretical absolute worst (30 per day, all failing) | 30 x 0.48 x 30 days | over 400 dollars, **which the estimated monthly cap of 20 dollars stops** |
The estimated cap is what limits the damage, and it is an estimate. If the owner wants a tighter worst case, lower `MONTHLY_CAP_USD`, `MAX_REVIEWS_PER_DAY` or `MAX_INPUT_CHARS` before going live. Nothing is spent until a key is added and live mode is switched on.

## Owner activation checklist (nothing is deployed or paid yet)
1. [ ] Say "deploy bridge off". Claude deploys the worker with `BRIDGE_MODE` off. It answers `/health` and ignores webhooks.
2. [ ] In Cloudflare: add the custom domain, and add `GITHUB_WEBHOOK_SECRET` and `BRIDGE_ADMIN_TOKEN`.
3. [ ] In GitHub: (optional) create a bot account, create the repo-only token, add the webhook (Issue comments only, same secret). Press "ping" and see `/health` answer.
4. [ ] Set `BRIDGE_MODE` to `dry`. Claude posts a request. The log shows it accepted and nothing was called or spent.
5. [ ] Approve the OpenAI cost. Create the OpenAI key with a monthly budget. Add `OPENAI_API_KEY`, `OPENAI_MODEL` and both prices. Set a `MONTHLY_CAP_USD` you are comfortable with.
6. [ ] Set `BRIDGE_MODE` to `live`. Claude sends one request. Check the reply appears, `/usage` shows a small cost, and whether the reply wakes Claude.
7. [ ] Watch `/usage` for a few days. To stop at any time: set `BRIDGE_MODE` to `off`.

## Tested so far (all with mocked GitHub and OpenAI, no network)
20 automated tests (`test/bridge.test.mjs`) and a demo (`node ops/bridge_demo.mjs`): signature checks, who may trigger, loops, duplicates, all limits, per-attempt spend reservation (kept for possibly billed failures, returned for rejected ones, enforced across retries), modes and fail-closed behaviour, retries, fallback and later success, no duplicate comments when a post answer is lost, pinned commit and matching diff, bad branch, alarm-based execution, no upstream text in logs, log access, prompt canon. Changing the code to drop the author check or the per-PR limit makes tests fail.
