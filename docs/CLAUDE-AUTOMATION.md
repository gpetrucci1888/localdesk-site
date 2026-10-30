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

## Status
See the comment on issue #4 for what has been tested end to end. Do not treat it as working until that test is recorded there.
