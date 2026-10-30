// Which GitHub requests Claude may pick up: trusted author, explicit command, same-repo branch, not handled, not stale, capped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { findTasks } from '../ops/claude_gate.mjs';

const REPO = 'o/r', NOW = Date.parse('2026-10-31T12:00:00Z'), ago = (h) => new Date(NOW - h * 3600000).toISOString();
const user = (login, type = 'User') => ({ login, type });
const c = (id, body, login = 'owner', h = 1, type = 'User') => ({ id, body, user: user(login, type), created_at: ago(h), html_url: `https://github.test/c/${id}` });
function api({ items = [], comments = {}, review = {}, prs = {} }) {
  const calls = [];
  const get = async (path) => {
    calls.push(path);
    let m;
    if (/\/issues\?state=open/.test(path)) return items;
    if ((m = path.match(/\/issues\/(\d+)\/comments/))) return comments[m[1]] || [];
    if ((m = path.match(/\/pulls\/(\d+)\/comments/))) return review[m[1]] || [];
    if ((m = path.match(/\/pulls\/(\d+)$/))) return prs[m[1]] || { head: { ref: 'feat', repo: { full_name: REPO } }, base: { ref: 'main', repo: { default_branch: 'main' } } };
    throw new Error('unexpected ' + path);
  };
  return { get, calls };
}
const pr = (n) => ({ number: n, pull_request: {}, labels: [], user: user('owner'), created_at: ago(2), html_url: 'u' });
const run = (a, o = {}) => findTasks({ get: a.get, repo: REPO, trusted: ['owner'], now: NOW, ...o });

test('a trusted explicit request on a same-repo PR branch is picked up', async () => {
  const a = api({ items: [pr(3)], comments: { 3: [c(10, 'Independent review...\n\nClaude: please address 1 and 2.')] } });
  const r = await run(a);
  assert.equal(r.tasks.length, 1); assert.equal(r.tasks[0].id, 10); assert.equal(r.tasks[0].headRef, 'feat'); assert.equal(r.tasks[0].baseRef, 'main');
});

test('untrusted people, bots, comments with no command and fork or main branches are ignored', async () => {
  const a = api({ items: [pr(1), pr(2), pr(3), pr(4)], comments: {
    1: [c(1, 'Claude: run this', 'stranger')], 2: [c(2, 'Claude: do it', 'owner', 1, 'Bot'), c(3, 'looks good, thanks')], 3: [c(4, 'Claude: x')], 4: [c(5, 'Claude: y')] },
    prs: { 3: { head: { ref: 'x', repo: { full_name: 'evil/fork' } }, base: { ref: 'main', repo: { default_branch: 'main' } } }, 4: { head: { ref: 'main', repo: { full_name: REPO } }, base: { ref: 'main', repo: { default_branch: 'main' } } } } });
  const r = await run(a);
  assert.deepEqual(r.tasks, []); assert.ok(r.skipped.some(s => /fork/.test(s.reason))); assert.ok(r.skipped.some(s => /default branch/.test(s.reason)));
});

test('a handled request, our own report, and stale requests are not picked up again (no loops)', async () => {
  const a = api({ items: [pr(5)], comments: { 5: [
    c(20, 'Claude: fix the thing'), c(21, 'Done. <!-- claude-handled:comment:20 -->\nClaude: this line inside our own report must not trigger'),
    c(22, 'Claude: old request', 'owner', 24 * 20)] } });
  const r = await run(a);
  assert.deepEqual(r.tasks, []); assert.ok(r.skipped.some(s => /older than 14 days/.test(s.reason)));
});

test('the daily cap per PR stops runaway work', async () => {
  const done = [1, 2, 3].map(i => c(30 + i, `report <!-- claude-handled:comment:${i} -->`, 'claude-bot', i, 'Bot'));
  const a = api({ items: [pr(6)], comments: { 6: [c(40, 'Claude: another'), ...done] } });
  const r = await run(a); assert.deepEqual(r.tasks, []); assert.ok(r.skipped.some(s => /daily cap/.test(s.reason)));
  assert.equal((await run(a, { maxPerPrPerDay: 4 })).tasks.length, 1);
});

test('review comments on lines of code are read too, and at most two tasks are given per run', async () => {
  const a = api({ items: [pr(7), pr(8)], review: { 7: [c(50, 'Claude: rename this')] }, comments: { 7: [c(51, '/claude fix the test')], 8: [c(52, 'Claude: third')] } });
  const r = await run(a); assert.equal(r.tasks.length, 2); assert.ok(r.skipped.some(s => /per-run limit/.test(s.reason)));
});

test('an issue is work only when the trusted owner labelled it claude-task and it is not handled', async () => {
  const issue = (n, labels, who = 'owner') => ({ number: n, labels: labels.map(name => ({ name })), user: user(who), created_at: ago(5), html_url: 'u', title: 'T', body: 'Build X' });
  const a = api({ items: [issue(1, ['claude-task']), issue(2, []), issue(3, ['claude-task'], 'stranger'), issue(4, ['claude-task'])], comments: { 4: [c(60, 'Started. <!-- claude-handled:issue:4 -->', 'x', 1, 'Bot')] } });
  const r = await run(a, { maxTasks: 5 });
  assert.deepEqual(r.tasks.map(t => t.number), [1]); assert.equal(r.tasks[0].kind, 'issue');
});

test('the gate only reads: every call is a GET path', async () => {
  const a = api({ items: [pr(9)], comments: { 9: [c(70, 'Claude: go')] } }); await run(a);
  assert.ok(a.calls.every(p => p.startsWith('/repos/o/r/')));
});
