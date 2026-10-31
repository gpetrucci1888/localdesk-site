// End-to-end demonstration with test events and mocked GitHub and OpenAI. Spends nothing, calls nothing.
//   node ops/bridge_demo.mjs
import bridgeWorker, { Bridge } from '../workers/bridge/worker.js';
import { build } from './bridge_request.mjs';
import { MemStorage } from '../test/harness.mjs';

const SECRET = 'demo-webhook-secret', t0 = Date.now(), stamp = () => `+${String(Date.now() - t0).padStart(4)}ms`;
const say = (m) => console.log(`${stamp()}  ${m}`);
const storage = new MemStorage(); storage.setAlarm = async () => {}; // in production a Durable Object alarm runs the job a moment after the webhook returns
const env = { BRIDGE_MODE: 'live', GITHUB_WEBHOOK_SECRET: SECRET, GITHUB_TOKEN: 'github_pat_demo0123456789abcdefghij', OPENAI_API_KEY: 'sk-demo-0123456789abcdefghij', OPENAI_MODEL: 'demo-model',
  ALLOWED_REPO: 'owner/repo', ALLOWED_AUTHORS: 'owner', PRICE_IN_PER_MTOK: '2', PRICE_OUT_PER_MTOK: '8', BRIDGE_ADMIN_TOKEN: 'demo-admin', MIN_SECONDS_BETWEEN_REVIEWS: '0' };
const obj = new Bridge({ storage }, env), stub = { fetch: (u, i) => obj.fetch(new Request(u, i)) };
env.BRIDGE = { idFromName: () => 'main', get: () => stub };

const posted = [];
globalThis.fetch = async (u, init = {}) => {
  const url = String(u);
  if (url.startsWith('https://api.openai.com/')) { say('OpenAI (mock): reviewer called'); return Response.json({ output_text: 'VERDICT: approve with changes\nDECISION CLASS: routine (Claude proceeds on its own)\nFINDINGS:\n1. medium: workers/books/worker.js: the founding claim has no test for a release after a failed save. Add one.\nINSTRUCTIONS FOR CLAUDE:\n1. Add the test, then continue with the Stripe plan.\nQUESTIONS: none', usage: { input_tokens: 14000, output_tokens: 300 } }); }
  const accept = (init.headers || {}).Accept || '';
  if (init.method === 'POST') { posted.push(JSON.parse(init.body).body); say('GitHub (mock): reply posted on the pull request'); return Response.json({ id: 1 }); }
  if (/\/pulls\/\d+$/.test(url)) return accept.includes('diff') ? new Response('diff --git a/x b/x\n+example change\n') : Response.json({ head: { sha: 'c'.repeat(40), ref: 'stage1-founding' }, base: { ref: 'main' } });
  if (url.includes('/commits/')) return Response.json({ sha: 'c'.repeat(40) });
  if (url.includes('/comments')) return Response.json(posted.map(body => ({ body, created_at: new Date().toISOString() })));
  return new Response(`(mock contents of ${url.split('/contents/')[1]})`);
};

const sign = async (body) => { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return 'sha256=' + [...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(body)))].map(b => b.toString(16).padStart(2, '0')).join(''); };
async function webhook(comment, { who = 'owner', assoc = 'OWNER', delivery } = {}) {
  const body = JSON.stringify({ action: 'created', repository: { full_name: 'owner/repo' }, issue: { number: 6, pull_request: {} }, comment: { id: Math.floor(Math.random() * 1e9), body: comment, user: { login: who }, author_association: assoc } });
  const res = await bridgeWorker.fetch(new Request('https://bridge.demo/webhook', { method: 'POST', headers: { 'X-GitHub-Event': 'issue_comment', 'X-GitHub-Delivery': delivery || crypto.randomUUID(), 'X-Hub-Signature-256': await sign(body) }, body }), env, { waitUntil: () => {} });
  const out = await res.json(); if (res.status === 202) { say('   job saved, alarm fires, review runs'); await obj.runDue(); } return out;
}

say('1. Claude finishes a milestone and posts a structured request on PR #6');
const request = build({ type: 'review', topic: 'founding places', files: ['docs/ROADMAP.md'], ref: 'stage1-founding', text: 'Atomic reservation is built. What would you challenge?', id: 'demo-0001-founding' });
console.log(request.split('\n').map(l => '      | ' + l).join('\n'));
say('2. GitHub sends the webhook (signed). The bridge checks signature, repository, author and request format');
console.log('      result:', JSON.stringify(await webhook(request)));
say('3. The same comment arrives again (GitHub retry): it must not be answered twice');
console.log('      result:', JSON.stringify(await webhook(request, { delivery: 'same-delivery' })));
say('4. A stranger posts a request: it must be ignored');
console.log('      result:', JSON.stringify(await webhook(build({ type: 'question', text: 'hi', id: 'stranger-0001' }), { who: 'stranger', assoc: 'NONE' })));
say('5. The reviewer\'s own reply arrives as a webhook: it must not start a loop');
console.log('      result:', JSON.stringify(await webhook(posted[0], { who: 'owner' })));
console.log('\n--- Reply as it appears on the pull request ---\n' + posted[0]);
const usage = await (await bridgeWorker.fetch(new Request('https://bridge.demo/usage', { headers: { Authorization: 'Bearer demo-admin' } }), env)).json();
console.log('\n--- Usage today ---\n' + JSON.stringify(usage));
