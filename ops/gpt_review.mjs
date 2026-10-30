// Asks an independent reviewer model (OpenAI API) to review a pull request and posts the answer as a PR comment.
// Runs from .github/workflows/gpt-review.yml when a PR gets the label "gpt-review". It does nothing, and says why, unless
// OPENAI_API_KEY (a repository secret) and OPENAI_REVIEW_MODEL (a repository variable) are both set. No model name is assumed.
const MARK = '<!-- gpt-review -->';
const REDACT = /(sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|[A-Fa-f0-9]{40,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/g;

export const SYSTEM = `You are an independent senior engineer reviewing a pull request for Localdesk (UK software for tradespeople: an AI receptionist and a bookkeeping app that connects to QuickBooks, FreeAgent and Xero).
Review for correctness, security (secrets, auth, injection, data exposure), money or customer-data risk, missing tests and anything that would stop a safe launch.
Answer in this format only:
VERDICT: approve | approve with changes | do not merge
FINDINGS: a numbered list. Each item: severity (high/medium/low), file and line if known, what is wrong, the concrete failure, the fix.
QUESTIONS: anything you could not judge from the diff.
Be specific and brief. Do not praise. Do not invent files or behaviour that is not in the diff. If the diff is truncated, say what you could not see.`;

export function trim(text, max) {
  const t = text.replace(REDACT, '[redacted]');
  return t.length <= max ? { text: t, truncated: false } : { text: t.slice(0, max), truncated: true };
}

export function outputText(data) {
  if (typeof data.output_text === 'string' && data.output_text) return data.output_text;
  const parts = [];
  for (const o of data.output || []) for (const c of o.content || []) if (typeof c.text === 'string') parts.push(c.text);
  return parts.join('\n').trim();
}

export async function run(env, fetchFn = fetch, log = console.log) {
  const key = env.OPENAI_API_KEY, model = env.OPENAI_REVIEW_MODEL;
  if (!key) { log('Skipped: OPENAI_API_KEY is not set, so no review was requested.'); return { skipped: 'no key' }; }
  if (!model) { log('Skipped: OPENAI_REVIEW_MODEL is not set. Set it to a model name you have verified.'); return { skipped: 'no model' }; }
  const repo = env.GITHUB_REPOSITORY, n = env.PR_NUMBER;
  if (!repo || !n) throw new Error('GITHUB_REPOSITORY and PR_NUMBER are required');
  const gh = (path, init = {}, accept = 'application/vnd.github+json') => fetchFn(`https://api.github.com/repos/${repo}${path}`, { ...init, headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: accept, 'User-Agent': 'localdesk-gpt-review', ...(init.headers || {}) } });
  const pr = await (await gh(`/pulls/${n}`)).json();
  const diffRes = await gh(`/pulls/${n}`, {}, 'application/vnd.github.v3.diff');
  const { text: diff, truncated } = trim(await diffRes.text(), Number(env.MAX_DIFF_BYTES) || 60000);
  const request = trim(`${pr.title || ''}\n\n${pr.body || ''}`, 8000).text;
  const input = `${SYSTEM}\n\n=== Pull request ===\n${request}\n\n=== Diff${truncated ? ' (TRUNCATED)' : ''} ===\n${diff}`;
  const body = { model, input };
  if (env.OPENAI_REASONING_EFFORT) body.reasoning = { effort: env.OPENAI_REASONING_EFFORT };
  const res = await fetchFn('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI said ${res.status}: ${String((data.error && data.error.message) || 'request failed').slice(0, 200)}`);
  const answer = outputText(data);
  if (!answer) throw new Error('OpenAI returned no text');
  const comment = `${MARK}\n**Independent review** (model \`${model}\`${env.OPENAI_REASONING_EFFORT ? `, reasoning \`${env.OPENAI_REASONING_EFFORT}\`` : ''})${truncated ? '\n\n_The diff was truncated, so parts were not reviewed._' : ''}\n\n${answer}\n\n_Advice only. Verify against the code and tests before acting._`;
  const post = await gh(`/issues/${n}/comments`, { method: 'POST', body: JSON.stringify({ body: comment }) });
  if (!post.ok) throw new Error(`Could not post the comment (${post.status})`);
  log(`Posted a review on #${n}.`);
  return { posted: true, truncated };
}

if (import.meta.url === `file://${process.argv[1]}`) run(process.env).catch((e) => { console.error(String(e.message || e)); process.exit(1); });
