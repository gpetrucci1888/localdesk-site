#!/usr/bin/env python3
"""Owner HQ set-up on Cloudflare. DRY RUN by default; --apply changes production (needs Gio's approval).

Creates/updates: the `hq` worker (Durable Object VAULT, service binding BOOKS -> books, plain BOOKS_URL) and attaches
hq.localdeskai.co.uk to it. With --with-backups it also creates the R2 bucket `books-backups` and binds it to the books
worker as BACKUPS (so the daily backup runs). Credentials come from the session proxy.

It NEVER sets a secret. The owner types these into Cloudflare (Workers > hq > Settings > Variables and Secrets):
  OWNER_PASSWORD   a long passphrase, kept in the owner's password manager
  ADMIN_KEY        the Books admin key
  STRIPE_KEY       (optional) a restricted read-only Stripe key
"""
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from deploy_gate import gate, FILES
ACC = '473eff2d9b7f75e8cad6442ed5a4fc5a'; HOST = 'hq.localdeskai.co.uk'; ZONE = 'localdeskai.co.uk'
APPLY = '--apply' in sys.argv; BACKUPS = '--with-backups' in sys.argv
API = 'https://api.cloudflare.com/client/v4'; R = 'workers'
def cf(method, path, **kw):
    cmd = ['curl', '-s', '-m', '60', '-X', method, API + path]
    for k, v in kw.get('form', []): cmd += ['-F', f'{k}={v}']
    if 'json' in kw: cmd += ['-H', 'Content-Type: application/json', '-d', json.dumps(kw['json'])]
    return json.loads(subprocess.run(cmd, capture_output=True, text=True).stdout)

books_url = 'https://books.' + ZONE
plan = [f'Upload worker "hq" (workers/hq/worker.js + content.js) with Durable Object VAULT, service binding BOOKS -> books, BOOKS_URL={books_url}',
        f'Attach {HOST} to the hq worker (DNS record and certificate are automatic)']
if BACKUPS: plan += ['Create R2 bucket "books-backups"', 'Add binding BACKUPS -> books-backups to the books worker (keeping every other binding and secret)']
print('\n'.join('- ' + p for p in plan))
if not APPLY: print('\nDry run only. Then set OWNER_PASSWORD and ADMIN_KEY in the Cloudflare dashboard.'); sys.exit(0)
gate()   # no upload unless every test passes and the tree is committed

meta = {'main_module': 'worker.js', 'compatibility_date': '2025-09-01',
        'bindings': [{'type': 'durable_object_namespace', 'name': 'VAULT', 'class_name': 'Vault'},
                     {'type': 'service', 'name': 'BOOKS', 'service': 'books', 'environment': 'production'},
                     {'type': 'plain_text', 'name': 'BOOKS_URL', 'text': books_url}],
        'migrations': {'new_tag': 'hq-v1', 'new_sqlite_classes': ['Vault']}, 'keep_bindings': ['secret_text']}
form = [('metadata', json.dumps(meta) + ';type=application/json')]
for f in FILES['hq']: form.append((f, f'@{__file__.rsplit("/ops/", 1)[0]}/workers/hq/{f};type=application/javascript+module;filename={f}'))
r = cf('PUT', f'/accounts/{ACC}/{R}/scripts/hq', form=form); print('worker:', 'ok' if r.get('success') else r.get('errors'))
zone = cf('GET', '/zones?name=' + ZONE)['result'][0]
r = cf('PUT', f'/accounts/{ACC}/{R}/domains', json={'hostname': HOST, 'service': 'hq', 'environment': 'production', 'zone_id': zone['id']}); print('domain:', 'ok' if r.get('success') else r.get('errors'))
if BACKUPS:
    r = cf('POST', f'/accounts/{ACC}/r2/buckets', json={'name': 'books-backups'}); print('bucket:', 'ok' if r.get('success') else r.get('errors'))
    s = cf('GET', f'/accounts/{ACC}/{R}/scripts/books/settings')['result']
    binds = [b for b in s['bindings'] if b['type'] != 'secret_text'] + [{'type': 'r2_bucket', 'name': 'BACKUPS', 'bucket_name': 'books-backups'}]
    print('Next books deploy must include the BACKUPS binding (r2_bucket BACKUPS -> books-backups) alongside the existing bindings.')
