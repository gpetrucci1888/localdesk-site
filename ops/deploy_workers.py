"""Upload the Books workers to Cloudflare without wrangler, keeping live secrets and settings.
  python3 ops/deploy_workers.py books|app|hq [dry]
Needs CLOUDFLARE_API_TOKEN (a token with Workers Scripts: Edit) in the environment, or a session that injects credentials.
Simplest alternative for a developer: npx wrangler deploy -c workers/<name>/wrangler.jsonc
"""
import json,subprocess,sys,os
A=os.environ.get('CLOUDFLARE_ACCOUNT_ID','473eff2d9b7f75e8cad6442ed5a4fc5a'); API=f'https://api.cloudflare.com/client/v4/accounts/{A}/workers/scripts'
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','workers')
AUTH=['-H','Authorization: Bearer '+os.environ['CLOUDFLARE_API_TOKEN']] if os.environ.get('CLOUDFLARE_API_TOKEN') else []
def settings(w):
    out=subprocess.run(['curl','-s','-m','30',*AUTH,f'{API}/{w}/settings'],capture_output=True,text=True).stdout
    return json.loads(out)['result']
def deploy(w,files,main='worker.js',dry=False):
    s=settings(w)
    binds=[b for b in s['bindings'] if b['type']!='secret_text']
    if os.environ.get('BACKUPS_BUCKET') and w=='books' and not any(b['name']=='BACKUPS' for b in binds): binds.append({'type':'r2_bucket','name':'BACKUPS','bucket_name':os.environ['BACKUPS_BUCKET']})
    meta={'main_module':main,'compatibility_date':s.get('compatibility_date','2025-09-01'),'bindings':binds,'keep_bindings':['secret_text']}
    if s.get('compatibility_flags'): meta['compatibility_flags']=s['compatibility_flags']
    cmd=['curl','-s','-m','120',*AUTH,'-X','PUT',f'{API}/{w}','-F','metadata='+json.dumps(meta)+';type=application/json']
    for f,path in files:
        cmd+=['-F',f'{f}=@{path};type=application/javascript+module;filename={f}']
    if dry: print(w,'bindings',[(b['name'],b['type']) for b in binds],'files',[f for f,_ in files]); return
    r=json.loads(subprocess.run(cmd,capture_output=True,text=True).stdout)
    print(w,'success' if r.get('success') else r.get('errors'))
    after=settings(w); print(w,'after bindings:',sorted((b['name'],b['type']) for b in after['bindings'])==sorted((b['name'],b['type']) for b in s['bindings']))
    return r
def deploy_hq(dry=False):
    s=settings('hq'); binds=[b for b in s['bindings'] if b['type']!='secret_text']
    meta={'main_module':'worker.js','compatibility_date':'2025-09-01','bindings':binds,'keep_bindings':['secret_text']}
    cmd=['curl','-s','-m','120',*AUTH,'-X','PUT',f'{API}/hq','-F','metadata='+json.dumps(meta)+';type=application/json']
    for f in ('worker.js','content.js','ui.js','font.js','leads.js','passkey.js'): cmd+=['-F',f'{f}=@{R}/hq/{f};type=application/javascript+module;filename={f}']
    if dry: print('hq bindings',[(b['name'],b['type']) for b in binds]); return
    r=json.loads(subprocess.run(cmd,capture_output=True,text=True).stdout); print('hq','success' if r.get('success') else r.get('errors'))
which=sys.argv[1]; dry=len(sys.argv)>2 and sys.argv[2]=='dry'
if which=='books': deploy('books',[('worker.js',f'{R}/books/worker.js'),('admin.js',f'{R}/books/admin.js'),('freeagent.js',f'{R}/books/freeagent.js'),('xero.js',f'{R}/books/xero.js')],dry=dry)
if which=='app': deploy('receipt-demo',[(f,f'{R}/receipt-demo/{f}') for f in ['worker.js','page.js','brands.js','icons.js']],dry=dry)

if which=='hq': deploy_hq(dry=dry)
