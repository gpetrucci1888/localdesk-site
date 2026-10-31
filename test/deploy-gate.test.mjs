// The deploy gate: a failing test, a missing hygiene test, uncommitted code or an unknown target stops EVERY upload to Cloudflare,
// and the upload lists can never miss a module. Nothing here uploads anything: node and git are replaced by stubs, no network is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, chmodSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const stubs = (node, git) => { const d = mkdtempSync(join(tmpdir(), 'stub-')); for (const [n, body] of [['node', node], ['git', git]]) { writeFileSync(join(d, n), `#!/bin/sh\n${body}\n`); chmodSync(join(d, n), 0o755); } return d; };
const run = (args, bin, extra = {}) => spawnSync('python3', ['-B', ...args], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, PYTHONDONTWRITEBYTECODE: '1', CLOUDFLARE_API_TOKEN: 'not-a-real-token', HTTPS_PROXY: 'http://127.0.0.1:9', ...extra } });
const gatePy = (code, bin) => run(['-c', `import sys;sys.path.insert(0,'ops')\nimport deploy_gate as g\n${code}`], bin);

test('failing tests block every upload script, and nothing is uploaded', () => {
  const bin = stubs('echo "not ok 1 - a test failed"; exit 1', 'exit 0');
  for (const args of [['ops/deploy_workers.py', 'books'], ['ops/deploy_workers.py', 'hq'], ['ops/deploy_workers.py', 'app'], ['ops/hq_setup.py', '--apply']]) {
    const r = run(args, bin); assert.equal(r.status, 2, args.join(' ')); assert.match(r.stderr, /DEPLOY BLOCKED: the tests did not all pass/); assert.match(r.stderr, /Nothing was uploaded/); assert.ok(!/success|worker: ok|domain: ok|Gate passed/i.test(r.stdout), 'no upload output');
  }
});

test('uncommitted code blocks the upload even when the tests pass', () => {
  const bin = stubs('exit 0', 'if [ "$1" = "status" ]; then echo " M workers/books/worker.js"; fi; exit 0');
  const r = run(['ops/deploy_workers.py', 'books'], bin); assert.equal(r.status, 2); assert.match(r.stderr, /uncommitted changes under workers\/ or ops\//); assert.match(r.stderr, /workers\/books\/worker\.js/);
});

test('a clean tree with green tests passes the gate (this is the only way through)', () => {
  const bin = stubs('exit 0', 'if [ "$1" = "rev-parse" ]; then echo abc1234; fi; exit 0');
  const r = gatePy('g.gate()', bin); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /Gate passed: all tests green, tree committed \(commit abc1234\)/);
});

test('node missing or git broken also blocks (fail closed)', () => {
  const noNode = mkdtempSync(join(tmpdir(), 'empty-')); writeFileSync(join(noNode, 'git'), '#!/bin/sh\nexit 0\n'); chmodSync(join(noNode, 'git'), 0o755);
  let r = spawnSync('python3', ['-B', '-c', `import sys,os;sys.path.insert(0,'ops')\nos.environ['PATH']=${JSON.stringify(noNode)}\nimport deploy_gate as g\ng.gate()`], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  assert.equal(r.status, 2); assert.match(r.stderr, /the tests could not be run/);
  r = run(['-c', "import sys;sys.path.insert(0,'ops')\nimport deploy_gate as g\nprint(g.uncommitted())"], stubs('exit 0', 'exit 1')); assert.match(r.stdout, /git status failed/);
});

test('the hygiene test cannot be deleted to get a green run, and a failing hygiene check blocks', () => {
  const root = mkdtempSync(join(tmpdir(), 'root-')); mkdirSync(join(root, 'test'));
  const pass = "import test from 'node:test'; test('ok', () => {});\n", fail = "import test from 'node:test'; test('secrets by shape', () => { throw new Error('a key was found'); });\n";
  for (const f of ['hq', 'leads', 'stripe']) writeFileSync(join(root, 'test', `${f}.test.mjs`), pass);
  let r = run(['-c', `import sys;sys.path.insert(0,'ops')\nimport deploy_gate as g\ng.gate(${JSON.stringify(root)})`], stubs('exec /usr/bin/env node "$@"', 'exit 0'));
  assert.equal(r.status, 2); assert.match(r.stderr, /required test files are missing: test\/repo-hygiene\.test\.mjs/);
  writeFileSync(join(root, 'test', 'repo-hygiene.test.mjs'), fail);
  const real = spawnSync('which', ['node'], { encoding: 'utf8' }).stdout.trim();
  r = run(['-c', `import sys;sys.path.insert(0,'ops')\nimport deploy_gate as g\ng.gate(${JSON.stringify(root)})`], stubs(`exec ${real} "$@"`, 'exit 0'));
  assert.equal(r.status, 2); assert.match(r.stderr, /the tests did not all pass/); assert.match(r.stderr, /a key was found/);
});

test('an unknown target does nothing, and every script that uploads worker code imports the gate before it uploads', () => {
  const r = run(['ops/deploy_workers.py', 'bogus'], stubs('exit 0', 'exit 0')); assert.notEqual(r.status, 0); assert.match(r.stderr, /Usage/);
  const dw = readFileSync('ops/deploy_workers.py', 'utf8'); assert.ok(dw.indexOf('if not dry: gate()') > 0 && dw.indexOf('if not dry: gate()') < dw.indexOf("if which=='books': deploy("), 'the gate runs before the first deploy call');
  const hs = readFileSync('ops/hq_setup.py', 'utf8'); assert.ok(hs.indexOf('gate()   #') > hs.indexOf('sys.exit(0)') && hs.indexOf('gate()   #') < hs.indexOf("cf('PUT', f'/accounts/{ACC}/{R}/scripts/hq'"), 'hq_setup gates --apply before its first upload');
  for (const f of readdirSync('ops').filter(f => f.endsWith('.py'))) { const t = readFileSync(join('ops', f), 'utf8'); if (/\/scripts\//.test(t) && /'PUT'|-X', *'PUT'|method: ?'PUT'/.test(t)) assert.match(t, /deploy_gate/, `${f} uploads worker code, so it must use the gate`); }
});

test('the upload lists contain every module in each worker folder (a missing module would break the worker on Cloudflare)', () => {
  const r = run(['-c', "import sys,json;sys.path.insert(0,'ops')\nimport deploy_gate as g\nprint(json.dumps({'files':g.FILES,'folder':g.FOLDER}))"], stubs('exit 0', 'exit 0')); assert.equal(r.status, 0, r.stderr);
  const { files, folder } = JSON.parse(r.stdout);
  for (const [name, list] of Object.entries(files)) { const onDisk = readdirSync(join('workers', folder[name])).filter(f => f.endsWith('.js')).sort(); assert.deepEqual([...list].sort(), onDisk, `${name}: the upload list must match workers/${folder[name]}`); }
});

test('every upload keeps request logs on and redacts query strings, so a redeploy cannot silently switch logging off or log one-time link tokens', () => {
  const dw = readFileSync('ops/deploy_workers.py', 'utf8');
  const metas = dw.match(/'keep_bindings':\['secret_text'\][^}]*\}/g) || [];
  assert.ok(metas.length >= 2, 'both upload paths set metadata');
  for (const m of metas) { assert.match(m, /'observability':\{'enabled':True/); assert.match(m, /'redact_query_string':True/); }
});
