#!/usr/bin/env python3
"""Custom domains for Books: app.localdeskai.co.uk -> the app worker (receipt-demo), books.localdeskai.co.uk -> the connector (books).
Cloudflare creates the DNS record and certificate. Dry run by default; --apply changes live DNS/routing (needs Gio's approval).
Credentials come from the session proxy. After --apply you still must (by hand):
  1. Set APP_URL=https://app.localdeskai.co.uk and BOOKS_URL=https://books.localdeskai.co.uk on the books worker (plain-text settings).
  2. Add https://books.localdeskai.co.uk/callback as a redirect URI in the Intuit developer app (sandbox AND production keys),
     before applying for production keys, so it is registered once.
  3. Check each address loads, then send new clients links on the new addresses. Old workers.dev links keep working.
"""
import json, subprocess, sys
ACC = '473eff2d9b7f75e8cad6442ed5a4fc5a'; ZONE_NAME = 'localdeskai.co.uk'
APPLY = '--apply' in sys.argv
WANT = [('app.' + ZONE_NAME, 'receipt-demo'), ('books.' + ZONE_NAME, 'books')]
def cf(method, path, body=None):
    cmd = ['curl', '-s', '-m', '30', '-X', method, 'https://api.cloudflare.com/client/v4' + path]
    if body is not None: cmd += ['-H', 'Content-Type: application/json', '-d', json.dumps(body)]
    return json.loads(subprocess.run(cmd, capture_output=True, text=True).stdout)
zone = next(z for z in cf('GET', '/zones?name=' + ZONE_NAME)['result'])
existing = {d['hostname']: d['service'] for d in cf('GET', f'/accounts/{ACC}/workers/domains')['result']}
for host, svc in WANT:
    state = 'already attached' if existing.get(host) == svc else ('ATTACHED TO ' + existing[host] + ' (conflict)' if host in existing else 'to attach')
    print(f'{host} -> worker {svc}: {state}')
    if APPLY and host not in existing:
        r = cf('PUT', f'/accounts/{ACC}/workers/domains', {'hostname': host, 'service': svc, 'environment': 'production', 'zone_id': zone['id']})
        print('  ', 'done' if r.get('success') else r.get('errors'))
if not APPLY: print('\nDry run only. Re-run with --apply after approval.')
