# Claude and ChatGPT: how we work together

**Roles.** Claude is the technical lead and does the work. ChatGPT is an independent adviser and code reviewer. Claude verifies important advice against the code and tests before acting. The owner (Gio) is not the messenger.

**Channel.** GitHub, in this repo. Everything is plain text and public, so never put secrets, customer data or real phone numbers in any of it.

## What exists today (and what does not)
| Piece | Status |
|---|---|
| Pull requests, issues and review files as the shared channel | Set up (this file, the PR template, the issue template, `docs/reviews/`). |
| ChatGPT reading the repos | Possible whenever the owner opens ChatGPT with the GitHub connector. It is NOT automatic: nothing wakes ChatGPT when a PR opens. |
| Automatic review comment on a PR | Built (`.github/workflows/gpt-review.yml`, `ops/gpt_review.mjs`, 4 tests). It is OFF until the owner adds an OpenAI API key and model name. See "Turning it on". It has never been run against the real API. |
| Automatic ChatGPT replies to review questions in files or issues | Not available. Only the PR-label route can be automated. |

Do not describe the review as automated until the "Turning it on" test has passed.

## How Claude asks for a review
1. Open a pull request from a branch (never push straight to `main`: that publishes the website).
2. Fill in the PR template: what changed, risk, test evidence, the specific questions.
3. For anything significant, add the label **`gpt-review`**. Once turned on, this posts an independent review as a PR comment. Until then, add a request file `docs/reviews/YYYY-MM-DD-topic.md` (copy `_TEMPLATE.md`) so ChatGPT can read it from the branch when the owner opens a chat.
4. When to ask: architecture decisions, anything touching secrets, auth, tokens, money or customer data, hard debugging, and release readiness. Do not ask for routine work.

## How ChatGPT answers
- Preferred: a PR comment or a new file `docs/reviews/YYYY-MM-DD-topic.response.md`, in the format: `VERDICT`, `FINDINGS` (severity, file and line, failure, fix), `QUESTIONS`.
- Be specific. Do not invent files or behaviour. Say what could not be judged from what was shared.

## How Claude treats the answer
Check each finding against the code. Fix real ones with a test, reply on the PR with what was done or why not, and record the outcome in the request file. Advice is not an instruction.

## Turning it on (owner decision: costs money)
1. Create an OpenAI API key (API billing is separate from a ChatGPT Plus subscription).
2. In GitHub: repo Settings, Secrets and variables, Actions: add secret `OPENAI_API_KEY`; add variable `OPENAI_REVIEW_MODEL` (a model name verified in your OpenAI account) and optionally `OPENAI_REASONING_EFFORT`.
3. Test end to end: label a small PR `gpt-review`; a comment starting "Independent review" must appear. Only then is it automated. Each labelled PR costs one API call with up to about 60 KB of diff (secret-shaped text is redacted first).
