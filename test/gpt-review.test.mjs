// The review script: skips safely without a key or model, builds the request from settings, redacts secrets, posts one comment.
import test from 'node:test';
import assert from 'node:assert/strict';
import { run, trim, outputText } from '../ops/gpt_review.mjs';

const base = { GITHUB_REPOSITORY: 'o/r', PR_NUMBER: '7', GITHUB_TOKEN: 'ghs_test' };
function net(answer = { output_text: 'VERDICT: approve' }, diff = 'diff --git a/x b/x\n+hello') {
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.endsWith('/pulls/7')) return (init.headers.Accept || '').includes('diff') ? new Response(diff) : Response.json({ title: 'T', body: 'B' });
    if (url === 'https://api.openai.com/v1/responses') return Response.json(answer);
    if (url.endsWith('/issues/7/comments')) return Response.json({}, { status: 201 });
    return new Response('{}', { status: 404 });
  };
  return { f, calls };
}

test('does nothing without a key, and without a model', async () => {
  const n = net(); const out = [];
  assert.deepEqual(await run({ ...base }, n.f, (m) => out.push(m)), { skipped: 'no key' });
  assert.deepEqual(await run({ ...base, OPENAI_API_KEY: 'k' }, n.f, (m) => out.push(m)), { skipped: 'no model' });
  assert.equal(n.calls.length, 0); assert.ok(out.every(m => !/\bk\b/.test(m)));
});

test('sends the model and reasoning setting it is given, and posts the answer as a comment', async () => {
  const n = net(); const out = [];
  const r = await run({ ...base, OPENAI_API_KEY: 'sk-test', OPENAI_REVIEW_MODEL: 'some-model', OPENAI_REASONING_EFFORT: 'high' }, n.f, (m) => out.push(m));
  assert.equal(r.posted, true);
  const ai = n.calls.find(c => c.url.includes('openai.com'));
  const body = JSON.parse(ai.init.body);
  assert.equal(body.model, 'some-model'); assert.deepEqual(body.reasoning, { effort: 'high' }); assert.match(body.input, /hello/);
  assert.equal(ai.init.headers.Authorization, 'Bearer sk-test');
  const posted = JSON.parse(n.calls.find(c => c.url.endsWith('/comments')).init.body).body;
  assert.match(posted, /<!-- gpt-review -->/); assert.match(posted, /VERDICT: approve/);
  assert.ok(out.join(' ').indexOf('sk-test') < 0, 'the key is never logged');
});

test('secret-shaped text is redacted before it leaves, and long diffs are cut and flagged', async () => {
  const secretDiff = '+key = sk-' + 'a'.repeat(30) + '\n+hash = ' + 'f'.repeat(48) + '\n' + 'x'.repeat(500);
  const n = net({ output_text: 'ok' }, secretDiff);
  const r = await run({ ...base, OPENAI_API_KEY: 'sk-test', OPENAI_REVIEW_MODEL: 'm', MAX_DIFF_BYTES: '200' }, n.f, () => {});
  assert.equal(r.truncated, true);
  const sent = JSON.parse(n.calls.find(c => c.url.includes('openai.com')).init.body).input;
  assert.doesNotMatch(sent, /sk-a{30}/); assert.doesNotMatch(sent, /f{48}/); assert.match(sent, /TRUNCATED/);
  assert.equal(trim('abc', 10).truncated, false);
});

test('reads the answer from either response shape, and fails loudly on errors', async () => {
  assert.equal(outputText({ output: [{ content: [{ text: 'a' }, { text: 'b' }] }] }), 'a\nb');
  const n = net({ error: { message: 'bad key' } });
  const f = async (url, init) => (url.includes('openai.com') ? Response.json({ error: { message: 'bad key' } }, { status: 401 }) : n.f(url, init));
  await assert.rejects(run({ ...base, OPENAI_API_KEY: 'sk-test', OPENAI_REVIEW_MODEL: 'm' }, f, () => {}), /OpenAI said 401: bad key/);
});
