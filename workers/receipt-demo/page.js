// The phone app: one page, four tabs (Overview, Receipts, Owed, Invoice).
// Kept as String.raw so the script inside needs no extra escaping. No ${...} or backticks inside.
export const PAGE = String.raw`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex"><meta name="theme-color" content="#f2b705">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Books">
<link rel="manifest" href="manifest.json"><link rel="apple-touch-icon" href="icon-180.png">
<title>Books</title>
<style>
:root{--bg:#f3f4f6;--card:#fff;--ink:#1d1f23;--muted:#5b616b;--line:#dfe2e6;--acc:#f2b705;--go:#1f7a4d;--stop:#b5402c;--blue:#2459a8}
@media (prefers-color-scheme:dark){:root{--bg:#15171a;--card:#1f2226;--ink:#eceef1;--muted:#a5abb4;--line:#353a40;--go:#5cc78f;--stop:#f08a76;--blue:#8fb4f0}}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:520px;margin:0 auto;padding:16px 16px 96px;display:grid;gap:14px}
header{display:flex;justify-content:space-between;align-items:baseline}
h1{font-size:24px;margin:4px 0 0}
.sub{color:var(--muted);margin:0;font-size:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}
.card h2{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 10px}
.big{font-size:30px;font-weight:800;margin:0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.stat span{display:block;font-size:13px;color:var(--muted)}
.stat b{font-size:22px}
.pot{border-left:6px solid var(--acc)}
.note{font-size:12px;color:var(--muted);margin:6px 0 0}
.snap{display:block;text-align:center;background:var(--acc);color:#1d1f23;font-weight:800;font-size:20px;padding:20px;border-radius:14px;cursor:pointer}
.snap.alt{background:var(--card);color:var(--ink);border:1.5px solid var(--line);font-size:17px;padding:15px}
.snap input{display:none}
img.prev{width:100%;max-height:240px;object-fit:contain;border-radius:10px;background:#0001}
label.f{display:grid;gap:3px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
label.f input,label.f select{font:inherit;font-size:16px;padding:10px;border:1.5px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);text-transform:none;letter-spacing:0;font-weight:400;width:100%}
.tick{display:flex;gap:10px;align-items:center;font-weight:700;margin:4px 0 12px}
.tick input{width:22px;height:22px}
.btns{display:flex;gap:8px}
button{font:inherit;font-weight:800;font-size:16px;padding:12px 14px;border-radius:10px;border:0;cursor:pointer}
button:disabled{opacity:.5}
.go{background:var(--go);color:#fff;flex:1}
.ghost{background:transparent;border:1.5px solid var(--line);color:var(--ink)}
.small{font-size:14px;padding:8px 12px}
.msg{color:var(--muted);text-align:center;margin:0}
.err{color:var(--stop)}
ul{list-style:none;margin:0;padding:0}
li{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line)}
li:first-child{border-top:0}
li small{display:block;color:var(--muted)}
.late{color:var(--stop);font-weight:700}
.link{background:none;border:0;color:var(--blue);font-weight:800;padding:0;font-size:15px}
nav{position:fixed;left:0;right:0;bottom:0;background:var(--card);border-top:1px solid var(--line);display:grid;grid-template-columns:repeat(4,1fr);padding-bottom:env(safe-area-inset-bottom)}
nav button{background:none;color:var(--muted);font-size:12px;font-weight:700;padding:9px 4px 10px;border-radius:0;display:grid;gap:2px;justify-items:center}
nav button span{font-size:22px;line-height:1}
nav button[aria-current="page"]{color:var(--ink)}
nav button[aria-current="page"] span{transform:scale(1.1)}
[hidden]{display:none!important}
</style></head><body>
<main>
<header><div><h1 id="title">This month</h1><p class="sub" id="subtitle"></p></div></header>
<p class="msg" id="msg" hidden></p>

<section id="tab-home">
  <div class="card"><h2>Profit so far</h2><p class="big" id="profit">…</p>
    <div class="grid2" style="margin-top:10px"><div class="stat"><span>Money in</span><b id="in">…</b></div><div class="stat"><span>Money out</span><b id="out">…</b></div></div></div>
  <div class="card pot" style="margin-top:14px"><h2>Put aside for tax</h2><p class="big" id="pot">…</p><p class="note">Rough guide only, about a quarter of profit. Your accountant gives the real figure.</p></div>
  <div class="card" style="margin-top:14px"><h2>Owed to you</h2><p class="big" id="owedTotal">…</p><p class="note" id="owedCount"></p><button class="link" data-tab="owed" style="margin-top:8px">See who owes you →</button></div>
</section>

<section id="tab-receipts" hidden>
  <label class="snap">📷 Snap a receipt<input id="file" type="file" accept="image/*" capture="environment"></label>
  <label class="snap alt" style="margin-top:10px">🖼️ Add photos or PDFs<input id="pick" type="file" accept="image/*,application/pdf,.pdf" multiple></label>
  <div class="card" id="check" hidden style="margin-top:14px">
    <h2>Check it's right</h2>
    <img class="prev" id="prev" alt="Your receipt"><div style="height:10px"></div>
    <label class="f">Supplier<input id="supplier"></label>
    <div class="grid2"><label class="f">Date<input id="date" type="date"></label><label class="f">Category<select id="category"></select></label></div>
    <div class="grid2"><label class="f">Total £<input id="total" inputmode="decimal"></label><label class="f">VAT £<input id="vat" inputmode="decimal"></label></div>
    <label class="f">What for<input id="items"></label>
    <div class="btns"><button class="go" id="save">Looks right, send it</button><button class="ghost" id="cancel">Skip</button></div>
  </div>
  <div class="card" style="margin-top:14px"><h2>Latest in QuickBooks</h2><ul id="recent"></ul></div>
</section>

<section id="tab-owed" hidden>
  <div class="card"><h2>Unpaid invoices</h2><ul id="owedList"></ul><p class="msg" id="owedEmpty" hidden>Nobody owes you anything. Nice.</p></div>
  <p class="note">"Remind" emails the invoice to them again from QuickBooks.</p>
</section>

<section id="tab-invoice" hidden>
  <div class="card"><h2>New invoice</h2>
    <label class="f">Customer name<input id="iCust" autocomplete="off"></label>
    <label class="f">Their email (to send it)<input id="iEmail" type="email" inputmode="email" autocomplete="off" placeholder="optional"></label>
    <label class="f">What for<input id="iDesc" placeholder="Boiler service"></label>
    <label class="f">Amount £ (before VAT)<input id="iAmt" inputmode="decimal"></label>
    <label class="tick"><input type="checkbox" id="iVat">Add VAT at 20%</label>
    <button class="go" id="iSend" style="width:100%">Create invoice</button>
  </div>
</section>
</main>

<nav aria-label="Sections">
  <button data-tab="home" aria-current="page"><span>🏠</span>Overview</button>
  <button data-tab="receipts"><span>📷</span>Receipts</button>
  <button data-tab="owed"><span>💷</span>Owed</button>
  <button data-tab="invoice"><span>🧾</span>Invoice</button>
</nav>

<script>
var CATS=["Materials","Tools and equipment","Fuel","Vehicle","Subcontractors","Phone and internet","Office","Food and drink","Other"];
var BASE=location.pathname.replace(/\/$/,'');
var $=function(id){return document.getElementById(id)};
function money(n){return '£'+(Number(n)||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}
function ukDate(d){var t=Date.parse(d);return isNaN(t)?(d||''):new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function say(t,bad){$('msg').hidden=!t;$('msg').textContent=t||'';$('msg').className='msg'+(bad?' err':'')}
async function api(path,opts){var r=await fetch(BASE+'/api/'+path,opts);var d=await r.json().catch(function(){return {error:'No response'}});if(d.error)throw new Error(d.error);return d}
CATS.forEach(function(c){var o=document.createElement('option');o.textContent=c;$('category').appendChild(o)});

// ---- tabs ----
var TITLES={home:'This month',receipts:'Receipts',owed:'Who owes you',invoice:'New invoice'};
function show(tab){
  Object.keys(TITLES).forEach(function(t){$('tab-'+t).hidden=t!==tab});
  document.querySelectorAll('nav button').forEach(function(b){b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false')});
  $('title').textContent=TITLES[tab];say('');
  if(tab==='home')loadSummary(); if(tab==='owed')loadOwed(); if(tab==='receipts')loadRecent();
  try{localStorage.setItem('books-tab',tab)}catch(e){}
}
document.addEventListener('click',function(e){var b=e.target.closest('[data-tab]');if(b)show(b.dataset.tab)});

// ---- overview ----
async function loadSummary(){
  try{var s=await api('summary');
    $('subtitle').textContent=new Date(s.month+'-01').toLocaleDateString('en-GB',{month:'long',year:'numeric'});
    $('profit').textContent=money(s.profit);$('in').textContent=money(s.moneyIn);$('out').textContent=money(s.moneyOut);
    $('pot').textContent=money(s.taxPot);$('owedTotal').textContent=money(s.owed);
    $('owedCount').textContent=s.owedCount?(s.owedCount+' unpaid invoice'+(s.owedCount>1?'s':'')):'All paid up';
  }catch(err){say("Couldn't load your figures: "+err.message,true)}
}

// ---- owed ----
async function loadOwed(){
  $('owedList').innerHTML='<li><small>Loading…</small></li>';
  try{var list=await api('owed');
    $('owedEmpty').hidden=list.length>0;
    $('owedList').innerHTML=list.map(function(i){
      var late=i.daysOverdue>0?'<span class="late">'+i.daysOverdue+' days late</span>':'Due '+esc(ukDate(i.due));
      var btn=i.email?'<button class="ghost small" data-remind="'+esc(i.id)+'">Remind</button>':'<small>No email</small>';
      return '<li><div><b>'+esc(i.customer)+'</b><small>'+money(i.balance)+' · '+late+'</small></div>'+btn+'</li>'}).join('');
  }catch(err){$('owedList').innerHTML='';say("Couldn't load invoices: "+err.message,true)}
}
document.addEventListener('click',async function(e){
  var b=e.target.closest('[data-remind]');if(!b)return;
  b.disabled=true;b.textContent='Sending…';
  try{var r=await api('remind/'+b.dataset.remind,{method:'POST'});b.textContent='Sent ✓';say('Reminder emailed to '+r.sentTo)}
  catch(err){b.disabled=false;b.textContent='Remind';say(err.message,true)}
});

// ---- invoice ----
$('iSend').addEventListener('click',async function(){
  var body={customer:$('iCust').value,email:$('iEmail').value,description:$('iDesc').value,amount:parseFloat($('iAmt').value)||0,vat:$('iVat').checked};
  $('iSend').disabled=true;say('Creating invoice…');
  try{var r=await api('invoice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    say('Invoice '+(r.number?r.number+' ':'')+'for '+money(r.total)+' created'+(r.sentTo?' and emailed to '+r.sentTo:'')+' ✓');
    ['iCust','iEmail','iDesc','iAmt'].forEach(function(id){$(id).value=''});$('iVat').checked=false;
  }catch(err){say(err.message,true)}
  $('iSend').disabled=false;
});

// ---- receipts ----
async function loadRecent(){
  try{var list=await api('recent');
    $('recent').innerHTML=list.map(function(p){return '<li><div>'+esc(p.supplier||'Expense')+'<small>'+esc(ukDate(p.date))+'</small></div><div>'+money(p.total)+'</div></li>'}).join('')||'<li><small>Nothing yet.</small></li>';
  }catch(err){$('recent').innerHTML='<li><small>Couldn\'t load: '+esc(err.message)+'</small></li>'}
}
var PDFJS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
function loadPdfJs(){return window.pdfjsLib?Promise.resolve(window.pdfjsLib):new Promise(function(ok,no){var sc=document.createElement('script');sc.src=PDFJS+'pdf.min.js';sc.onload=function(){pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS+'pdf.worker.min.js';ok(pdfjsLib)};sc.onerror=function(){no(new Error('Could not load the PDF reader'))};document.head.appendChild(sc)})}
async function pdfToImage(file){
  var lib=await loadPdfJs(),doc=await lib.getDocument({data:await file.arrayBuffer()}).promise,page=await doc.getPage(1);
  var v=page.getViewport({scale:1}),s=1280/Math.max(v.width,v.height),vp=page.getViewport({scale:s});
  var c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);
  var ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
  await page.render({canvasContext:ctx,viewport:vp}).promise;return c.toDataURL('image/jpeg',0.85);
}
function shrink(file){
  if(file.type==='application/pdf'||/\.pdf$/i.test(file.name))return pdfToImage(file);
  return new Promise(function(ok,no){var img=new Image();img.onload=function(){var s=Math.min(1,1280/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);ok(c.toDataURL('image/jpeg',0.82))};img.onerror=no;img.src=URL.createObjectURL(file)});
}
var queue=[];
function addFiles(e){queue=queue.concat(Array.prototype.slice.call(e.target.files));e.target.value='';if($('check').hidden)next()}
$('file').addEventListener('change',addFiles);$('pick').addEventListener('change',addFiles);
async function next(){
  var f=queue.shift();if(!f)return;
  $('check').hidden=true;say('Reading your receipt…'+(queue.length?' ('+queue.length+' more to go)':''));
  try{
    var data=await shrink(f);$('prev').src=data;
    var r=await (await fetch(BASE+'/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:data})})).json();
    if(r.error)throw new Error(r.error);
    if(!r.readable){say("Couldn't read that one. Try again in better light, with the whole receipt in shot.",true);setTimeout(next,2500);return}
    $('supplier').value=r.supplier;$('date').value=r.date;$('category').value=r.category;$('total').value=r.total.toFixed(2);$('vat').value=r.vat.toFixed(2);$('items').value=r.items;
    say('');$('check').hidden=false;$('check').scrollIntoView({behavior:'smooth'});
  }catch(err){say('Something went wrong: '+err.message,true);setTimeout(next,2500)}
}
$('save').addEventListener('click',async function(){
  var r={image:$('prev').src,supplier:$('supplier').value.trim(),date:$('date').value,category:$('category').value,total:parseFloat($('total').value)||0,vat:parseFloat($('vat').value)||0,items:$('items').value.trim()};
  $('save').disabled=true;say('Sending to QuickBooks…');
  try{var out=await api('file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(r)});
    $('check').hidden=true;loadRecent();
    var done=out.duplicate?'Already in QuickBooks, so not added twice ✓':'In QuickBooks ✓';
    say(done);if(queue.length)setTimeout(next,1200);
  }catch(err){say("Couldn't send it: "+err.message,true)}
  $('save').disabled=false;
});
$('cancel').addEventListener('click',function(){$('check').hidden=true;say('');next()});

var start='home';try{start=localStorage.getItem('books-tab')||'home'}catch(e){}
show(TITLES[start]?start:'home');
</script></body></html>`;
