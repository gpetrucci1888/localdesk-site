// Gio's admin page for Books, served at /admin. It holds no data itself: it asks for the admin
// key once (kept on this device only) and calls the same admin routes as before with X-Key.
// Kept as String.raw so the script inside needs no extra escaping. No ${...} or backticks inside.
export const ADMIN_PAGE = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Books admin</title>
<style>
:root{--bg:#f2f3f5;--card:#fff;--ink:#16181b;--muted:#646a73;--line:#e4e6ea;--acc:#f2b705;--go:#1f7a4d;--stop:#b5402c}
@media (prefers-color-scheme:dark){:root{--bg:#101113;--card:#1b1d20;--ink:#eceef1;--muted:#a1a7b0;--line:#2c3035;--go:#5cc78f;--stop:#f08a76}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header{background:#1d1f23;color:#fff;padding:18px 16px}header h1{margin:0;font-size:22px}header p{margin:2px 0 0;color:#ffffffa8;font-size:14px}
main{max-width:720px;margin:0 auto;padding:16px;display:grid;gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px}
h2{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 10px}
label{display:grid;gap:4px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px}
input,select{font:inherit;font-size:16px;padding:11px;border:1.5px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);text-transform:none;letter-spacing:0;font-weight:400;width:100%}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
button{font:inherit;font-weight:800;padding:12px 14px;border-radius:12px;border:0;cursor:pointer;background:#1d1f23;color:#fff}
@media (prefers-color-scheme:dark){button{background:var(--acc);color:#1d1f23}}
button.ghost{background:transparent;border:1.5px solid var(--line);color:var(--ink)}button.bad{background:var(--stop);color:#fff}
button:disabled{opacity:.5}
.cl{border-top:1px solid var(--line);padding:12px 0}.cl:first-child{border-top:0;padding-top:0}
.cl b{font-size:17px}.meta{color:var(--muted);font-size:14px}
.pill{display:inline-block;font-size:12px;font-weight:800;padding:2px 9px;border-radius:20px;background:var(--bg);color:var(--muted);margin:4px 4px 0 0}
.ok{color:var(--go)}.no{color:var(--stop)}
.acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.acts button{padding:8px 12px;font-size:14px}
.out{background:var(--bg);border-radius:12px;padding:12px;word-break:break-all;margin-top:10px}
.msg{padding:10px 12px;border-radius:12px;background:var(--card);border:1px solid var(--line)}.err{color:var(--stop)}
[hidden]{display:none!important}
details summary{cursor:pointer;font-weight:800;margin-top:8px}
</style></head><body>
<header><h1>Books admin</h1><p>Invite clients, change their settings, see how they're doing.</p></header>
<main>
<p class="msg" id="msg" hidden></p>
<div class="card" id="keyCard"><h2>Admin key</h2>
  <label>Paste the Books admin key<input id="key" type="password" autocomplete="off"></label>
  <button id="keyGo">Unlock</button>
  <p class="meta">Kept only until you close this tab. Don't use this page on a shared computer.</p></div>

<div id="app" hidden>
<div class="card"><h2>New client</h2>
  <label>Business name<input id="nName" autocomplete="off"></label>
  <label>Owner's mobile (login codes and texts go here)<input id="nPhone" inputmode="tel" autocomplete="off" placeholder="+447700900123"></label>
  <div class="row"><label>VAT registered<select id="nVat"><option value="">Go by QuickBooks</option><option value="yes">Yes</option><option value="no">No</option></select></label>
  <label>Quotes extra<select id="nQuotes"><option value="">No</option><option value="quotes">Yes</option></select></label></div>
  <div class="row"><label>Branding<input id="nBrand" placeholder="blank = Localdesk" autocomplete="off"></label>
  <label>QuickBooks<select id="nEnv"><option value="production">Real company</option><option value="sandbox">Practice (sandbox)</option></select></label></div>
  <button id="nGo">Make connect link</button>
  <div class="out" id="nOut" hidden></div></div>

<div class="card"><h2>Clients</h2><div id="list"><p class="meta">Loading…</p></div>
  <div class="acts"><button class="ghost" id="refresh">Refresh</button><button class="ghost" id="forget">Lock this device</button></div></div>
</div>
</main>
<script>
var $=function(id){return document.getElementById(id)};
var KEY='';try{KEY=sessionStorage.getItem('books-admin-key')||''}catch(e){}
// Behind the owner HQ the page is served from a prefix and the HQ adds the key itself, so there is nothing to paste.
var BASE=(document.querySelector('meta[name=base]')||{}).content||'';
if(document.querySelector('meta[name=prekey]'))KEY='via-hq';
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function say(t,bad){$('msg').hidden=!t;$('msg').textContent=t||'';$('msg').className='msg'+(bad?' err':'')}
async function api(method,path,body){
  var r=await fetch(BASE+path,{method:method,headers:{'X-Key':KEY,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  if(r.status===403){lock();throw new Error('That key was not accepted.')}
  var t=await r.text(),d;try{d=JSON.parse(t)}catch(e){d={error:t.replace(/^Error: /,'')}}
  if(!r.ok||d.error)throw new Error(d.error||('Failed ('+r.status+')'));return d;
}
function lock(){if(document.querySelector('meta[name=prekey]')){say('The HQ session has ended. Log in to the HQ again.',true);return}KEY='';try{sessionStorage.removeItem('books-admin-key')}catch(e){}$('app').hidden=true;$('keyCard').hidden=false}
async function unlock(){
  try{await api('GET','/health');$('keyCard').hidden=true;$('app').hidden=false;say('');load()}
  catch(err){lock();say(err.message,true)}
}
$('keyGo').addEventListener('click',function(){KEY=$('key').value.trim();if(!KEY)return;try{sessionStorage.setItem('books-admin-key',KEY)}catch(e){}$('key').value='';unlock()});
$('forget').addEventListener('click',function(){lock();say('Locked. The key is no longer stored on this device.')});
$('refresh').addEventListener('click',load);

var clients={};
async function load(){
  $('list').innerHTML='<p class="meta">Loading…</p>';
  try{var h=await api('GET','/health');
    var rows=await Promise.all(h.clients.map(function(c){return api('GET','/client/'+c.realmId).then(function(d){return Object.assign({},c,d,{health:c})}).catch(function(){return Object.assign({},c,{health:c})})}));
    clients={};rows.forEach(function(c){clients[c.realmId]=c});
    $('list').innerHTML=rows.map(function(c){var hh=c.health;
      return '<div class="cl" data-realm="'+esc(c.realmId)+'"><b>'+esc(c.name||c.realmId)+'</b> '+(hh.ok?'<span class="pill ok">Connected</span>':'<span class="pill no">Not connected</span>')+(c.env==='sandbox'?'<span class="pill">Practice</span>':'')+(c.demo?'<span class="pill">Open demo</span>':'')+
        '<div class="meta">'+(hh.ok?(hh.filed+' filed this week · '+hh.toTidy+' to sort · '+hh.late+' late · app '+(hh.seenDays==null?'never opened':hh.seenDays===0?'used today':'used '+hh.seenDays+'d ago')):esc(hh.problem||''))+'</div>'+
        '<div class="meta">Phone '+esc(c.phone||'none')+' · VAT '+esc(c.vat||'by QuickBooks')+' · extras '+esc(c.extras||'none')+' · brand '+esc(c.brand||'Localdesk')+' · chasing '+esc(c.chase||'off')+'</div>'+
        '<div class="acts"><button class="ghost" data-act="link">App link</button><button class="ghost" data-act="edit">Change</button><button class="ghost" data-act="monthly">Preview monthly text</button><button class="ghost" data-act="logout">Log out all phones</button><button class="bad" data-act="revoke">Disconnect</button></div><div class="out" hidden></div></div>'}).join('')||'<p class="meta">No clients connected yet.</p>';
  }catch(err){$('list').innerHTML='';say(err.message,true)}
}

$('nGo').addEventListener('click',async function(){
  var name=$('nName').value.trim(),phone=$('nPhone').value.replace(/\s+/g,'');
  if(!name){say('Put in the business name',true);return}
  if(/^07\d{9}$/.test(phone))phone='+44'+phone.slice(1);
  if(phone&&!/^\+447\d{9}$/.test(phone)){say("That doesn't look like a UK mobile. It should look like 07700 900123",true);return}
  $('nGo').disabled=true;say('');
  try{var r=await api('POST','/invite',{name:name,phone:phone,env:$('nEnv').value,vat:$('nVat').value,extras:$('nQuotes').value,brand:$('nBrand').value.trim()});
    var text='Hi, here is the link to connect your QuickBooks to Books: '+r.link+' (it works once, for 14 days). Log in to QuickBooks and tap Allow. Your app link comes straight after.';
    $('nOut').hidden=false;
    $('nOut').innerHTML='<b>Connect link</b> (send it to the client, it works once, for 14 days):<br><a href="'+esc(r.link)+'">'+esc(r.link)+'</a><div class="acts"><button class="ghost" id="nCopy">Copy</button>'+(phone?'<a href="https://wa.me/'+esc(phone.slice(1))+'?text='+encodeURIComponent(text)+'" target="_blank" rel="noopener"><button class="ghost">WhatsApp it</button></a>':'')+'</div>';
    $('nCopy').addEventListener('click',function(){navigator.clipboard.writeText(r.link).then(function(){say('Copied')})});
  }catch(err){say(err.message,true)}
  $('nGo').disabled=false;
});

document.addEventListener('click',async function(e){
  var b=e.target.closest('[data-act]');if(!b)return;
  var row=b.closest('[data-realm]'),realm=row.dataset.realm,c=clients[realm],out=row.querySelector('.out'),act=b.dataset.act;
  try{
    if(act==='link'){out.hidden=false;out.innerHTML=c.appUrl?'<a href="'+esc(c.appUrl)+'" target="_blank" rel="noopener">'+esc(c.appUrl)+'</a><br><span class="meta">Their personal app link. Treat it like a password: send it only to them.</span>':'No app link yet.';return}
    if(act==='edit'){out.hidden=false;out.innerHTML='<label>Phone<input data-f="phone" value="'+esc(c.phone)+'"></label><div class="row"><label>VAT<select data-f="vat"><option value="">By QuickBooks</option><option value="yes">Yes</option><option value="no">No</option></select></label><label>Quotes extra<select data-f="extras"><option value="">No</option><option value="quotes">Yes</option></select></label></div><label>Branding<input data-f="brand" value="'+esc(c.brand)+'"></label><button data-act="save">Save</button>';
      out.querySelector('[data-f=vat]').value=c.vat||'';out.querySelector('[data-f=extras]').value=(c.extras||'').indexOf('quotes')>=0?'quotes':'';return}
    if(act==='save'){var v={};out.querySelectorAll('[data-f]').forEach(function(i){v[i.dataset.f]=i.value.trim()});
      if(v.phone&&!/^\+44\d{9,10}$/.test(v.phone.replace(/\s+/g,''))){say('Put the mobile in as +44 then the number',true);return}
      v.phone=v.phone.replace(/\s+/g,'');await api('PUT','/client/'+realm,v);say('Saved');load();return}
    if(act==='monthly'){var m=await api('GET','/monthly/'+realm);out.hidden=false;out.textContent=m.text;return}
    if(act==='logout'){if(!confirm('Log '+(c.name||realm)+' out on every phone? They will need a new texted code.'))return;await api('POST','/logout/'+realm);say('Logged out on every phone');return}
    if(act==='revoke'){if(!confirm('Disconnect '+(c.name||realm)+' from QuickBooks? Books stops working for them, and they get a text saying so. Nothing in their QuickBooks is deleted.'))return;
      if(prompt('Type the business name to confirm')!==(c.name||realm))return;await api('POST','/revoke/'+realm);say('Disconnected');load();return}
  }catch(err){say(err.message,true)}
});
if(KEY)unlock();
</script></body></html>`;
