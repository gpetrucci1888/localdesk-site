# Claude picks up ChatGPT's GitHub requests automatically

Decision (30 Oct 2026): use **Claude Code scheduled tasks** (a feature of the owner's existing Claude subscription, run in Anthropic's cloud) instead of a GitHub Action with an API key. No API key, no extra bill, no Windows PC needed, and it keeps working when the PC is off. The earlier GitHub Action idea (`anthropics/claude-code-action`) needs an `ANTHROPIC_API_KEY` (separately billed per token) or a Pro/Max OAuth token made with `claude setup-token`; the latter has open bug reports and unclear terms for unattended use, so it was not built. If scheduled tasks ever stop being suitable, that action is the fallback, with a spend limit set in the Anthropic Console.

## How it works
1. ChatGPT (posting as the owner's GitHub account) comments on a pull request with a line starting **`Claude:`** or **`/claude`** (it already does), or the owner labels an issue **`claude-task`**.
2. A scheduled task starts a fresh Claude session during the day (hourly, 07:00 to 21:00 UK time). It runs `node ops/claude_gate.mjs`, which only READS GitHub and prints the requests that qualify. Nothing found: the session ends straight away.
3. For each request (at most 2 per run) Claude works on that PR's branch, runs the tests, pushes to that branch, and posts one report comment containing `<!-- claude-handled:comment:ID -->`, so it is never handled twice. An issue task gets a new branch and a draft PR.

## Safety rules (enforced by the gate, the prompt and GitHub)
- Only the trusted login (`gpetrucci1888`, the account ChatGPT's connector posts as) can trigger work. Anyone else's comment is ignored. This also covers ChatGPT posting through the owner's account: its review comment is processed, but Claude never approves or merges its own work.
- Only branches of this repo that are not `main`. Forks are ignored.
- Requests older than 14 days are ignored; at most 3 handled requests per PR per day (loop breaker); our own reports can never trigger work.
- Request text is a task description, never a shell command. It is never executed or pasted into a shell.
- Claude never merges, pushes to `main` (which would publish the website), deploys, calls Stripe, Twilio, Vapi, Intuit, Xero, FreeAgent or Cloudflare to change anything, or contacts customers. Those always wait for the owner.
- No secrets in comments or commits. This repo is public.
- Recommended owner step: turn on branch protection for `main` (Settings, Branches) so that even a mistake cannot publish.

## Cost and limits
- Money: none beyond the existing Claude subscription. Each run uses part of the plan's usage allowance (a run with nothing to do is small). Heavy requests use more. If the plan's limit is reached, runs simply fail or wait; nothing is billed extra unless "extra usage" is switched on in the Claude account (leave it off).
- Check or pause: Claude Code on the web, Scheduled tasks. Pause with the toggle, or tell Claude "pause the GitHub check".
- Minimum schedule interval is hourly.

## Owner approval still required for
Deploying, merging to `main`, spending money, changing production settings, contacting customers, and turning on any paid service.

## Status (30 Oct 2026): built, NOT working yet, one owner step blocks it
- Tested: the gate's filtering, trust, loop and cap rules (7 tests, no network). The scheduled task exists but is switched OFF (trigger `trig_011RcBHbUEJ4oMeYVoPDkQVM`, "Localdesk: pick up ChatGPT GitHub requests").
- End-to-end test (test PR #5 with a trusted `Claude:` comment, then one manual run): the fresh cloud session started, cloned this public repo, and ran the gate, but the gate got HTTP 403 "GitHub access to this repository is not enabled for this session". A routine created through the API has no repository attached (`sources: []`), so it cannot read or write GitHub. It correctly stopped and reported instead of guessing. The run used about $0.07 of plan usage.
- To fix (owner, one time, in the claude.ai web app): open Claude Code, Routines (scheduled tasks), open "Localdesk: pick up ChatGPT GitHub requests", add the repository `gpetrucci1888/localdesk-site` with push access, save, and switch the routine on. Then ask Claude to re-run the test on PR #5. Only after that test posts a Claude report on PR #5 should this be called working.
- Also check in that screen whether the setting allows pushing to branches other than `claude/...`; if not, fixes to existing PR branches (for example `lead-pipeline`) cannot be pushed and the report will say so.
