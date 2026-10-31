// Mia's per-client assistant: the offline checks catch a bad client file before anything is sent to Vapi. Nothing here touches the network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const py = (code, env = {}) => spawnSync('python3', ['-I', '-c', `import importlib.util,json,sys\nspec=importlib.util.spec_from_file_location('nc','ops/new_client.py');nc=importlib.util.module_from_spec(spec);spec.loader.exec_module(nc)\n${code}`], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', ...env } });
const base = JSON.parse(readFileSync('ops/example-client.json', 'utf8'));
const check = (client) => { const r = py(`print(json.dumps(nc.validate(json.loads(sys.argv[1]))))`.replace('sys.argv[1]', JSON.stringify(JSON.stringify(client)))); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };

test('the example client passes every offline check', () => assert.deepEqual(check(base), []));

test('missing, oversized and number-containing client facts are caught', () => {
  for (const f of ['business', 'trade', 'owner', 'services', 'areas', 'hours']) assert.match(check({ ...base, [f]: '' })[0], new RegExp(`'${f}' is missing`));
  assert.match(check({ ...base, services: 'x'.repeat(401) })[0], /too long/);
  assert.match(check({ ...base, extra: 'ring me on 07700 900123' })[0], /phone number/);
  assert.match(check({ ...base, hours: 'call +44 7700 900123' })[0], /phone number/);
  assert.deepEqual(check({ ...base, assistantId: '734343a2-b907-4d6d-9055-fdded03d4579' }), [], 'an assistant id is not a phone number');
});

test('the finished assistant keeps the rules that protect the owner: no promised times, 999, AI disclosure, recording notice, call limits', () => {
  const r = py(`c=nc.build(json.loads(open('ops/example-client.json').read()));print(json.dumps(c))`); assert.equal(r.status, 0, r.stderr);
  const c = JSON.parse(r.stdout), sys = c.model.messages[0].content;
  assert.match(sys, /NEVER promise or suggest a time, day, visit, call-back time or price/); assert.match(sys, /ring 999/); assert.match(sys, /virtual receptionist \(an AI\)/); assert.match(sys, /Never claim to be human/);
  assert.match(sys, /No exclamation marks/); assert.match(sys, /Never make anything up/);
  assert.match(c.firstMessage, /Calls may be recorded/); assert.ok(c.firstMessage.includes(base.business));
  assert.ok(c.maxDurationSeconds > 0 && c.maxDurationSeconds <= 1800); assert.ok(c.silenceTimeoutSeconds > 0); assert.ok(c.model.toolIds.length >= 1);
  assert.equal(c.analysisPlan.summaryPlan.enabled, true); assert.ok(c.transcriber.keyterm.length <= 100);
  assert.ok(!/\[[A-Z]{4,}\]/.test(sys), 'no unfilled placeholders');
});

test('validation notices a damaged config (missing recording notice, no end-call tool, over-long calls, leftover placeholder)', () => {
  const r = py(`c=nc.build(json.loads(open('ops/example-client.json').read()))
bad=json.loads(json.dumps(c)); bad['firstMessage']='Hello'; bad['model']['toolIds']=[]; bad['maxDurationSeconds']=7200; bad['model']['messages'][0]['content']+=' [OWNER]'
print(json.dumps(nc.validate(json.loads(open('ops/example-client.json').read()), bad)))`); assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout).join(' | ');
  for (const m of [/may be recorded/, /end-call tool/, /over 30 minutes/, /still contains \[OWNER\]/]) assert.match(p, m);
});

test('--check calls nothing and sets a failing exit code on a bad file; sending refuses a bad file before any network call', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mia-')), good = join(dir, 'good.json'), bad = join(dir, 'bad.json');
  writeFileSync(good, JSON.stringify(base)); writeFileSync(bad, JSON.stringify({ ...base, owner: '', extra: 'phone 07700 900123' }));
  const blockNet = `import urllib.request;urllib.request.urlopen=lambda *a,**k:(_ for _ in ()).throw(SystemExit('NETWORK CALLED'))\n`;
  let r = py(`${blockNet}sys.argv=['x',${JSON.stringify(good)}];\ntry:\n  nc.main(${JSON.stringify(good)}, check=True)\nexcept SystemExit as e:\n  print('exit',e.code)`); assert.match(r.stdout, /OK: nothing to fix/); assert.match(r.stdout, /exit 0/); assert.ok(!/NETWORK/.test(r.stdout + r.stderr));
  r = py(`${blockNet}try:\n  nc.main(${JSON.stringify(bad)}, check=True)\nexcept SystemExit as e:\n  print('exit',e.code)`); assert.match(r.stdout, /Fix these first/); assert.match(r.stdout, /exit 1/);
  r = py(`${blockNet}try:\n  nc.main(${JSON.stringify(bad)})\nexcept SystemExit as e:\n  print('exit',str(e.code)[:40])`); assert.match(r.stdout, /Not sent to Vapi/); assert.ok(!/NETWORK/.test(r.stdout + r.stderr), 'a bad file never reaches the network');
});
