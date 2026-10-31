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
4. One-at-a-time Durable Object decides: duplicate delivery, duplicate comment, duplicate request id, minimum gap per PR, per-PR and per-day caps, monthly spend cap. Cost is reserved before the call.
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
- Defaults (all changeable only by the owner in Cloudflare): 20 seconds minimum between reviews, 8 per PR per day, 30 per day, 20 dollars a month. When a limit is hit, one notice is posted and nothing more.
- Input is capped (90,000 characters) and output is capped (2,500 tokens). A failed review costs nothing.
- Kill switch: set `BRIDGE_MODE` to `off`, or delete the webhook in GitHub.
- Live mode refuses to run (fails closed) unless every secret, the model name and both prices are set.

## Logging, errors, retries, fallback
- The Durable Object keeps the last 500 log lines: event, ids, PR number, attempt, cost and tokens. Never message text or keys. `GET /log` and `GET /usage` need the admin token.
- OpenAI and GitHub calls retry 3 times with backoff on 429 and 5xx.
- If the reviewer stays down, one notice is posted ("Claude: carry on with routine work"), the job is kept, and a 5-minute scheduled pass retries after 1, 5 and 20 minutes. After that it posts one "gave up" notice. Claude should continue with routine work and re-send with a new id later.

## Permissions and secrets needed (owner sets all of them, never in chat or GitHub)
| Item | Where | Notes |
|---|---|---|
| `GITHUB_WEBHOOK_SECRET` | Cloudflare secret and the GitHub webhook | A long random string. Payload type JSON, SSL verification on, event: Issue comments only. |
| `GITHUB_TOKEN` | Cloudflare secret | Fine-grained token for **this repository only**: Contents read, Pull requests read, Issues read and write, Metadata read. Nothing else. Best created from a separate GitHub bot account so replies show as the reviewer, not as the owner. If the owner's own account is used, replies carry the owner's name and Claude must rely on the hidden marker. |
| `OPENAI_API_KEY` | Cloudflare secret | A key in an OpenAI project with a **hard monthly budget** set in OpenAI's billing settings. |
| `OPENAI_MODEL`, `PRICE_IN_PER_MTOK`, `PRICE_OUT_PER_MTOK` | Cloudflare variables | The owner (or GPT) verifies the model name and current prices on OpenAI's site. I have not verified current prices. |
| `BRIDGE_ADMIN_TOKEN` | Cloudflare secret | Lets the owner read `/log` and `/usage`. |
| `REVIEWER_LOGIN` | Cloudflare variable | The bot account's GitHub name, if one is used. |
| Public address | Cloudflare | Add a custom domain for the worker, for example `bridge.localdeskai.co.uk`. |

## Estimated cost
Cloudflare: Workers and Durable Objects are already in use on this account. The scheduled retry pass runs about 288 times a day and does nothing when idle. No extra cost expected, but the owner should check the plan limits.

OpenAI: pay per use. The worker reserves a worst-case cost before each call: (input characters / 3.5 tokens x input price) + (output tokens x output price). **Illustration only, with made-up prices of 2 dollars per million input tokens and 8 per million output:** about 0.07 dollars worst case per review and about 0.03 for a typical one (14,000 tokens in, 300 out). At the daily cap of 30 that is at most about 2 dollars a day, and the 20-dollar monthly cap stops it sooner. Real prices will differ. Nothing is spent until a key is added and live mode is switched on.

## Owner approvals needed before it can go live
1. Approve deploying the `bridge` worker in mode **off** (harmless: it answers `/health` and ignores webhooks).
2. Add the custom domain, the GitHub webhook and the secrets above.
3. Test in mode **dry** (logs only, calls nothing). Claude posts a request and the log shows it was accepted.
4. Approve the OpenAI cost and set a budget in OpenAI. Then set `BRIDGE_MODE` to **live**.
5. One live test, then watch `/usage` for a few days.

## Tested so far (all with mocked GitHub and OpenAI, no network)
14 automated tests (`test/bridge.test.mjs`) and a demo (`node ops/bridge_demo.mjs`): signature checks, who may trigger, loops, duplicates, all limits, spend tracking, modes and fail-closed behaviour, retries, fallback and later success, GitHub failure, log access, prompt canon. Not tested: a real webhook from GitHub, the real OpenAI API, real replies waking a Claude session.
