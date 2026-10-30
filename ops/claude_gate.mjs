// Finds work that ChatGPT (or Gio) has asked Claude to do on GitHub, safely. It only READS GitHub and prints JSON; it never runs anything it finds.
// A request counts only when ALL of these hold:
//   - written by a trusted GitHub login (default: the owner account that ChatGPT's connector posts as),
//   - on a pull request from a branch of this same repository that is not main, or on an issue labelled "claude-task",
//   - explicit: a comment line starting "Claude:" or "/claude", or the label,
//   - not already handled: Claude marks every request it handled with <!-- claude-handled:comment:ID --> (or issue:NUMBER) in its report,
//   - not stale (older than 14 days) and under the daily cap per PR, so it cannot loop.
// Usage: node ops/claude_gate.mjs   (needs the gh CLI logged in, or inject get() in tests)
import { execFileSync } from 'node:child_process';

export const COMMAND = /(^|\n)\s*(claude:|\/claude\b)/i;
export const TRUSTED = ['gpetrucci1888'];
const DAY = 86400000;
const marked = (text, kind, id) => String(text || '').includes(`<!-- claude-handled:${kind}:${id} -->`);

export async function findTasks({ get, repo, trusted = TRUSTED, maxTasks = 2, maxPerPrPerDay = 3, now = Date.now() }) {
  const tasks = [], skipped = [], skip = (reason, ref) => skipped.push({ reason, ref });
  const T = new Set(trusted.map(x => x.toLowerCase()));
  const items = await get(`/repos/${repo}/issues?state=open&per_page=50`);
  for (const it of items) {
    const isPR = Boolean(it.pull_request), n = it.number;
    const comments = await get(`/repos/${repo}/issues/${n}/comments?per_page=100`);
    const reviewComments = isPR ? await get(`/repos/${repo}/pulls/${n}/comments?per_page=100`) : [];
    const all = [...comments, ...reviewComments];
    const handledToday = all.filter(c => /<!-- claude-handled:/.test(c.body || '') && now - Date.parse(c.created_at) < DAY).length;
    let head = null;
    if (isPR) {
      const pr = await get(`/repos/${repo}/pulls/${n}`);
      if (!pr.head || !pr.head.repo || pr.head.repo.full_name !== repo) { skip('pull request is from a fork', `#${n}`); continue; }
      if (pr.head.ref === 'main' || pr.head.ref === pr.base.repo.default_branch) { skip('head branch is the default branch', `#${n}`); continue; }
      head = { headRef: pr.head.ref, baseRef: pr.base.ref };
    }
    if (isPR && handledToday >= maxPerPrPerDay) { skip('daily cap reached for this pull request', `#${n}`); continue; }
    const candidates = [];
    for (const c of all) {
      const who = (c.user && c.user.login || '').toLowerCase();
      if (!T.has(who)) continue;                                         // not a trusted identity
      if (c.user.type === 'Bot') continue;
      if (!isPR && !(it.labels || []).some(l => l.name === 'claude-task')) continue;
      if (!COMMAND.test(c.body || '')) continue;                         // not an explicit request
      if (/<!-- claude-handled:/.test(c.body || '')) continue;           // our own report
      if (now - Date.parse(c.created_at) > 14 * DAY) { skip('request is older than 14 days', `#${n} comment ${c.id}`); continue; }
      if (all.some(r => marked(r.body, 'comment', c.id))) continue;      // already handled
      candidates.push({ kind: 'comment', number: n, id: c.id, isPR, url: c.html_url, author: c.user.login, body: String(c.body).slice(0, 4000), ...(head || {}) });
    }
    if (!isPR && (it.user && T.has(it.user.login.toLowerCase())) && (it.labels || []).some(l => l.name === 'claude-task') && !all.some(r => marked(r.body, 'issue', n)) && now - Date.parse(it.created_at) <= 14 * DAY)
      candidates.push({ kind: 'issue', number: n, id: n, isPR: false, url: it.html_url, author: it.user.login, body: String(it.body || '').slice(0, 6000), title: it.title });
    for (const c of candidates) { if (tasks.length < maxTasks) tasks.push(c); else skip('more than the per-run limit; will be picked up next time', `#${n}`); }
  }
  return { tasks, skipped };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const repo = process.env.GITHUB_REPOSITORY || 'gpetrucci1888/localdesk-site';
  const get = async (path) => JSON.parse(execFileSync('gh', ['api', path], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }));
  findTasks({ get, repo, trusted: (process.env.CLAUDE_TRUSTED_LOGINS || TRUSTED.join(',')).split(',').map(x => x.trim()).filter(Boolean) })
    .then(r => console.log(JSON.stringify(r, null, 2)))
    .catch(e => { console.error('gate failed: ' + String(e.message || e).slice(0, 200)); process.exit(1); });
}
