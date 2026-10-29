// The phone app: one page, four tabs (Overview, Receipts, Owed, Invoice).
// Kept as String.raw so the script inside needs no extra escaping. No ${...} or backticks inside.
export const PAGE = String.raw`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex"><meta name="theme-color" content="{{HD}}">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Books">
<link rel="manifest" href="manifest.json"><link rel="apple-touch-icon" href="icon-180.png">
<title>{{NAME}} · Books</title>
<style>
:root{--hd:{{HD}};--acc:{{ACC}};--accInk:{{ACCINK}};--bg:#f2f3f5;--card:#fff;--ink:#16181b;--muted:#646a73;--line:#e4e6ea;--go:#1f7a4d;--stop:#b5402c;--blue:#1f5fbf;--shadow:0 1px 2px #0000000d,0 4px 14px #0000000a}
@media (prefers-color-scheme:dark){:root{--bg:#101113;--card:#1b1d20;--ink:#eceef1;--muted:#a1a7b0;--line:#2c3035;--go:#5cc78f;--stop:#f08a76;--blue:#8fb4f0;--shadow:none}}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.top{background:var(--hd);color:#fff;padding:calc(env(safe-area-inset-top) + 18px) 20px 22px;border-radius:0 0 26px 26px}
.top .in{max-width:520px;margin:0 auto;display:flex;align-items:center;gap:14px}
.logo{width:58px;height:58px;border-radius:50%;flex:none;box-shadow:0 0 0 2px #ffffff22}
.biz{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--acc);margin:0}
h1{font-size:26px;line-height:1.15;margin:2px 0 0;font-weight:800}
.sub{color:var(--muted);margin:0;font-size:14px}
.top .sub{color:#ffffffa8}
main{max-width:520px;margin:0 auto;padding:16px 16px 104px;display:grid;gap:14px}
section{display:grid;gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:var(--shadow)}
.card h2{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 8px;font-weight:700}
.big{font-size:32px;font-weight:800;margin:0;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.stat{background:var(--bg);border-radius:12px;padding:10px 12px}
.stat span{display:block;font-size:13px;color:var(--muted)}
.stat b{font-size:20px;font-variant-numeric:tabular-nums}
.pot{border-left:5px solid var(--acc)}
.note{font-size:12.5px;color:var(--muted);margin:8px 0 0}
.snaps{display:grid;grid-template-columns:1.4fr 1fr;gap:10px}
.snap{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;background:var(--acc);color:var(--accInk);font-weight:800;font-size:17px;padding:18px 10px;border-radius:18px;cursor:pointer;box-shadow:var(--shadow);min-height:108px}
.snap svg{width:34px;height:34px}
.snap.alt{background:var(--card);color:var(--ink);border:1px solid var(--line);font-size:15px}
.snap.alt svg{width:28px;height:28px}
.snap input{display:none}
img.prev{width:100%;max-height:240px;object-fit:contain;border-radius:12px;background:#0001}
label.f{display:grid;gap:4px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px}
label.f input,label.f select{font:inherit;font-size:16px;padding:12px;border:1.5px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);text-transform:none;letter-spacing:0;font-weight:400;width:100%}
input:focus,select:focus{outline:2px solid var(--acc);outline-offset:1px}
.tick{display:flex;gap:10px;align-items:center;font-weight:700;margin:4px 0 14px}
.tick input{width:22px;height:22px;accent-color:var(--hd)}
.btns{display:flex;gap:8px}
button{font:inherit;font-weight:800;font-size:16px;padding:13px 16px;border-radius:12px;border:0;cursor:pointer}
button:disabled{opacity:.5}
.go{background:var(--hd);color:#fff;flex:1}
@media (prefers-color-scheme:dark){.go{background:var(--acc);color:var(--accInk)}}
.ghost{background:transparent;border:1.5px solid var(--line);color:var(--ink)}
.small{font-size:14px;padding:8px 12px;border-radius:10px}
.msg{color:var(--muted);text-align:center;margin:0;background:var(--card);border-radius:12px;padding:10px;border:1px solid var(--line)}
.err{color:var(--stop)}
ul{list-style:none;margin:0;padding:0}
li{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 0;border-top:1px solid var(--line)}
li:first-child{border-top:0}
li small{display:block;color:var(--muted)}
.late{color:var(--stop);font-weight:700}
.link{background:none;border:0;color:var(--blue);font-weight:800;padding:0;font-size:15px;margin-top:10px}
nav{position:fixed;left:0;right:0;bottom:0;background:var(--card);border-top:1px solid var(--line);display:grid;grid-template-columns:repeat(4,1fr);padding:6px 6px calc(env(safe-area-inset-bottom) + 6px);z-index:4}
nav button{background:none;color:var(--muted);font-size:12px;font-weight:700;padding:6px 4px;border-radius:12px;display:grid;gap:3px;justify-items:center}
nav svg{width:24px;height:24px;padding:2px 12px;box-sizing:content-box;border-radius:20px}
nav button[aria-current="page"]{color:var(--ink)}
nav button[aria-current="page"] svg{background:var(--acc);color:var(--accInk)}
.by{text-align:center;font-size:12px;color:var(--muted);margin:6px 0 0}
.toast{position:fixed;left:12px;right:12px;bottom:84px;max-width:496px;margin:0 auto;background:#16181b;color:#fff;border-radius:14px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;box-shadow:0 8px 24px #0005;z-index:5}
.toast button{background:var(--acc);color:var(--accInk);padding:8px 14px;font-size:15px}
.why{color:var(--stop);font-weight:700;margin:0 0 10px;font-size:14px}
[hidden]{display:none!important}
</style></head><body>
<header class="top"><div class="in">{{LOGO}}<div><p class="biz">{{NAME}}</p><h1 id="title">This month</h1><p class="sub" id="subtitle"></p></div></div></header>
<main>
<p class="msg" id="msg" hidden></p>

<section id="tab-home">
  <div class="snaps"><label class="snap" for="file"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Snap a receipt</label><label class="snap alt" for="pick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>Photos or PDFs</label></div>
  <div class="card"><h2>Profit so far</h2><p class="big" id="profit">…</p>
    <div class="grid2" style="margin-top:12px"><div class="stat"><span>Money in</span><b id="in">…</b></div><div class="stat"><span>Money out</span><b id="out">…</b></div></div></div>
  <div class="card pot"><h2>Put aside for tax</h2><p class="big" id="pot">…</p><p class="note">Rough guide only, about a quarter of profit. Your accountant gives the real figure.</p></div>
  <div class="card pot" id="tidyCard" hidden style="border-left-color:var(--stop)"><h2>Needs sorting</h2><p style="margin:0"><b id="tidyCount"></b> expense(s) in "Uncategorised".</p><button class="link" data-tab="tidy">Tidy up (one tap each) →</button></div>
  <div class="card"><h2>Owed to you</h2><p class="big" id="owedTotal">…</p><p class="note" id="owedCount"></p><button class="link" data-tab="owed">See who owes you →</button></div>
  <div class="card"><h2>Tax quarter (for your accountant)</h2><p class="sub" id="qDates"></p>
    <div class="grid2" ><div class="stat"><span>Income</span><b id="qIn">…</b></div><div class="stat"><span>Expenses</span><b id="qOut">…</b></div></div>
    <p class="note" id="qDue"></p><button class="link" id="qCsv">Download for your accountant (CSV)</button></div>
</section>

<section id="tab-tidy" hidden>
  <div class="card"><h2>Put these in the right place</h2><ul id="tidyList"></ul><p class="msg" id="tidyEmpty" hidden>All tidy. Nothing to sort.</p></div>
  <p class="note">The category is a suggestion. Change it if it's wrong, then tap ✓.</p>
</section>

<section id="tab-receipts" hidden>
  <div class="snaps"><label class="snap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Snap a receipt<input id="file" type="file" accept="image/*" capture="environment"></label><label class="snap alt"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>Photos or PDFs<input id="pick" type="file" accept="image/*,application/pdf,.pdf" multiple></label></div>
  <div class="card"><h2>No receipt? Just say it</h2>
    <div class="btns"><input id="say" placeholder="40 quid diesel at Shell" style="flex:1;font:inherit;font-size:16px;padding:12px;border:1.5px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);min-width:0">
    <button class="ghost" id="mic" title="Speak" hidden>🎙️</button><button class="go" id="sayGo" style="flex:0">Add</button></div></div>
  <div class="card" id="check" hidden>
    <h2>Check this one</h2><p class="why" id="why"></p>
    <img class="prev" id="prev" alt="Your receipt"><div style="height:10px"></div>
    <label class="f">Supplier<input id="supplier"></label>
    <div class="grid2"><label class="f">Date<input id="date" type="date"></label><label class="f">Category<select id="category"></select></label></div>
    <div class="grid2"><label class="f">Total £<input id="total" inputmode="decimal"></label><label class="f">VAT £<input id="vat" inputmode="decimal"></label></div>
    <label class="f">What for<input id="items"></label>
    <div class="btns"><button class="go" id="save">Send it</button><button class="ghost" id="cancel">Skip</button></div>
  </div>
  <div class="card"><h2>Latest in QuickBooks</h2><ul id="recent"></ul></div>
</section>

<section id="tab-owed" hidden>
  <div class="card"><h2>Unpaid invoices</h2><ul id="owedList"></ul><p class="msg" id="owedEmpty" hidden>Nobody owes you anything. Nice.</p></div>
  <p class="note">"Paid" records the money in QuickBooks. "Remind" emails the invoice to them again.</p>
</section>

<section id="tab-invoice" hidden>
  <div class="card"><h2>New invoice</h2>
    <label class="f">Customer name<input id="iCust" autocomplete="off"></label>
    <label class="f">Their email (to send it)<input id="iEmail" type="email" inputmode="email" autocomplete="off" placeholder="optional"></label>
    <label class="f">What for<input id="iDesc" placeholder="Boiler service"></label>
    <label class="tick"><input type="checkbox" id="iCis">CIS job (for a main contractor)</label>
    <label class="f" id="amtWrap">Amount £ (before VAT)<input id="iAmt" inputmode="decimal"></label>
    <div class="grid2" id="cisWrap" hidden><label class="f">Labour £<input id="iLab" inputmode="decimal"></label><label class="f">Materials £<input id="iMat" inputmode="decimal"></label></div>
    <label class="tick"><input type="checkbox" id="iVat">Add VAT at 20%</label>
    <button class="go" id="iSend" style="width:100%">Create invoice</button>
  </div>
</section>
<p class="by">Books by Localdesk</p>
</main>
<div class="toast" id="toast" hidden><span id="toastText"></span><button id="undo">Undo</button></div>

<nav aria-label="Sections">
  <button data-tab="home" aria-current="page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></svg>Overview</button>
  <button data-tab="receipts"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>Receipts</button>
  <button data-tab="owed"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M14.5 8.5a2.5 2.5 0 0 0-5 .5c0 3-1 4.5-2 6h8M8 12.5h5"/></svg>Owed</button>
  <button data-tab="invoice"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/></svg>Invoice</button>
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
var TITLES={home:'This month',receipts:'Receipts',owed:'Who owes you',invoice:'New invoice',tidy:'Tidy up'};
function show(tab){
  Object.keys(TITLES).forEach(function(t){$('tab-'+t).hidden=t!==tab});
  document.querySelectorAll('nav button').forEach(function(b){b.setAttribute('aria-current',b.dataset.tab===(tab==='tidy'?'home':tab)?'page':'false')});
  $('title').textContent=TITLES[tab];say('');
  if(tab==='home'){loadSummary();loadQuarter();loadTidyCount()} if(tab==='owed')loadOwed(); if(tab==='receipts')loadRecent(); if(tab==='tidy')loadTidy();
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
      var btn='<span class="btns" data-acts="'+esc(i.id)+'"><button class="go small" data-paid="'+esc(i.id)+'">Paid</button>'+(i.email?'<button class="ghost small" data-remind="'+esc(i.id)+'">Remind</button>':'')+'</span>';
      return '<li><div><b>'+esc(i.customer)+'</b><small>'+money(i.balance)+' · '+late+'</small></div>'+btn+'</li>'}).join('');
  }catch(err){$('owedList').innerHTML='';say("Couldn't load invoices: "+err.message,true)}
}
document.addEventListener('click',async function(e){
  var b=e.target.closest('[data-remind]');if(!b)return;
  b.disabled=true;b.textContent='Sending…';
  try{var r=await api('remind/'+b.dataset.remind,{method:'POST'});b.textContent='Sent ✓';say('Reminder emailed to '+r.sentTo)}
  catch(err){b.disabled=false;b.textContent='Remind';say(err.message,true)}
});

document.addEventListener('click',async function(e){
  var b=e.target.closest('[data-paid]');
  if(b){var box=b.parentNode;box.innerHTML='<button class="ghost small" data-how="cash" data-inv="'+b.dataset.paid+'">Cash</button><button class="ghost small" data-how="bank" data-inv="'+b.dataset.paid+'">Bank</button><button class="ghost small" data-how="card" data-inv="'+b.dataset.paid+'">Card</button>';return}
  var h=e.target.closest('[data-how]');if(!h)return;
  var li=h.closest('li');li.querySelectorAll('button').forEach(function(x){x.disabled=true});
  try{var r=await api('paid/'+h.dataset.inv,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method:h.dataset.how})});
    li.remove();say('Marked as paid: '+money(r.amount||0)+' ('+(r.how||'').toLowerCase()+') ✓');if(!$('owedList').children.length)$('owedEmpty').hidden=false;
  }catch(err){li.querySelectorAll('button').forEach(function(x){x.disabled=false});say(err.message,true)}
});

// ---- invoice ----
$('iSend').addEventListener('click',async function(){
  var body={customer:$('iCust').value,email:$('iEmail').value,description:$('iDesc').value,amount:parseFloat($('iAmt').value)||0,vat:$('iVat').checked,cis:$('iCis').checked,labour:parseFloat($('iLab').value)||0,materials:parseFloat($('iMat').value)||0};
  $('iSend').disabled=true;say('Creating invoice…');
  try{var r=await api('invoice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    say('Invoice '+(r.number?r.number+' ':'')+'for '+money(r.total)+' created'+(r.sentTo?' and emailed to '+r.sentTo:'')+' ✓'+(r.cisDeduction?' They deduct '+money(r.cisDeduction)+' CIS, so expect '+money(r.toReceive)+'.':''));
    ['iCust','iEmail','iDesc','iAmt','iLab','iMat'].forEach(function(id){$(id).value=''});$('iVat').checked=false;$('iCis').checked=false;cisToggle();
  }catch(err){say(err.message,true)}
  $('iSend').disabled=false;
});

function cisToggle(){var on=$('iCis').checked;$('cisWrap').hidden=!on;$('amtWrap').hidden=on}
$('iCis').addEventListener('change',cisToggle);

// ---- quarter and tidy ----
var quarterData=null;
async function loadQuarter(){
  try{var q=await api('quarter');quarterData=q;
    $('qDates').textContent=ukDate(q.from)+' to '+ukDate(q.to);$('qIn').textContent=money(q.income);$('qOut').textContent=money(q.expenses);
    $('qDue').textContent='Figures due to HMRC by '+ukDate(q.due)+' (your accountant sends them).';
  }catch(err){$('qDates').textContent="Couldn't load: "+err.message}
}
$('qCsv').addEventListener('click',function(){
  if(!quarterData)return;
  var rows=[['Section','Category','Amount']].concat(quarterData.lines.map(function(l){return [l.section,l.name,l.amount.toFixed(2)]}));
  rows.push(['','Total income',quarterData.income.toFixed(2)],['','Total expenses',quarterData.expenses.toFixed(2)],['','Profit',quarterData.profit.toFixed(2)]);
  var csv=rows.map(function(r){return r.map(function(v){return '"'+String(v).replace(/"/g,'""')+'"'}).join(',')}).join('\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='quarter-'+quarterData.from+'.csv';a.click();
});
async function loadTidyCount(){
  try{var list=await api('untidy');$('tidyCard').hidden=!list.length;$('tidyCount').textContent=list.length}catch(e){}
}
async function loadTidy(){
  $('tidyList').innerHTML='<li><small>Loading…</small></li>';
  try{var list=await api('untidy');$('tidyEmpty').hidden=list.length>0;
    $('tidyList').innerHTML=list.map(function(i){
      var opts=CATS.map(function(c){return '<option'+(c===(i.suggested||'Other')?' selected':'')+'>'+c+'</option>'}).join('');
      return '<li><div style="flex:1;min-width:0"><b>'+esc(i.supplier||'Expense')+'</b> '+money(i.amount)+'<small>'+esc(ukDate(i.date))+'</small>'+
        '<select data-cat="'+esc(i.id)+'" style="margin-top:6px;width:100%;font:inherit;padding:8px;border:1.5px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)">'+opts+'</select></div>'+
        '<button class="go small" style="flex:0" data-tidy="'+esc(i.id)+'">✓</button></li>'}).join('');
  }catch(err){$('tidyList').innerHTML='';say("Couldn't load: "+err.message,true)}
}
document.addEventListener('click',async function(e){
  var b=e.target.closest('[data-tidy]');if(!b)return;
  var id=b.dataset.tidy,cat=document.querySelector('[data-cat="'+id+'"]').value;b.disabled=true;b.textContent='…';
  try{var r=await api('tidy/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category:cat})});
    b.closest('li').remove();say('Moved to '+r.account+' ✓');if(!$('tidyList').children.length)$('tidyEmpty').hidden=false;
  }catch(err){b.disabled=false;b.textContent='✓';say(err.message,true)}
});

// ---- say it ----
var Rec=window.SpeechRecognition||window.webkitSpeechRecognition;
if(Rec){$('mic').hidden=false;$('mic').addEventListener('click',function(){
  var r=new Rec();r.lang='en-GB';r.interimResults=false;$('mic').textContent='…';
  r.onresult=function(e){$('say').value=e.results[0][0].transcript;$('mic').textContent='🎙️';sayIt()};
  r.onerror=r.onend=function(){$('mic').textContent='🎙️'};r.start();
})}
async function sayIt(){
  var t=$('say').value.trim();if(!t)return;say('Working it out…');
  try{var r=await api('parse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:t})});
    $('say').value='';r.image='';
    if(r.total>0){say('');await autoFile(r)}else{showCheck(r,'',"Couldn't work out the amount. Put it in below.")}
  }catch(err){say(err.message,true)}
}
$('sayGo').addEventListener('click',sayIt);
$('say').addEventListener('keydown',function(e){if(e.key==='Enter')sayIt()});

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
    var data=await shrink(f);$('prev').src=data;$('prev').hidden=false;
    var r=await (await fetch(BASE+'/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:data})})).json();
    if(r.error)throw new Error(r.error);
    if(!r.readable){say("Couldn't read that one. Try again in better light, with the whole receipt in shot.",true);setTimeout(next,2500);return}
    r.image=data;var problem=unsure(r);
    if(problem){showCheck(r,data,problem)}else{say('');await autoFile(r);setTimeout(next,600)}
  }catch(err){say('Something went wrong: '+err.message,true);setTimeout(next,2500)}
}

// Only stop and ask when something doesn't add up; otherwise file it straight away.
function unsure(r){
  if(!(r.total>0))return "Couldn't find the total.";
  if(!r.supplier)return "Couldn't see who it's from.";
  var d=Date.parse(r.date);if(isNaN(d)||d>Date.now()+86400000||d<Date.now()-730*86400000)return 'The date looks odd.';
  if(r.vat>0){var net=r.total-r.vat,rate=net>0?r.vat/net:0;if(!(Math.abs(rate-0.2)<0.02||Math.abs(rate-0.05)<0.01))return "The VAT doesn't add up.";}
  return '';
}
function showCheck(r,img,why){
  if(img){$('prev').src=img;$('prev').hidden=false}else{$('prev').removeAttribute('src');$('prev').hidden=true}
  $('supplier').value=r.supplier||'';$('date').value=r.date||'';$('category').value=r.category||'Other';$('total').value=(r.total||0).toFixed(2);$('vat').value=(r.vat||0).toFixed(2);$('items').value=r.items||'';
  $('why').textContent=why||'';say('');
  if($('tab-receipts').hidden)show('receipts');
  $('check').hidden=false;$('check').scrollIntoView({behavior:'smooth'});
}
var toastTimer=null,lastFiled=null;
async function autoFile(r){
  say('Filing…');
  var out=await api('file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(r)});
  say('');loadRecent();
  if(out.duplicate){toast('Already in QuickBooks: '+(r.supplier||'expense')+' '+money(r.total),null);return}
  toast('✓ '+(r.supplier||'Expense')+' '+money(r.total)+' filed',out.id);
}
function toast(text,id){
  clearTimeout(toastTimer);lastFiled=id;$('toastText').textContent=text;$('undo').hidden=!id;$('toast').hidden=false;
  toastTimer=setTimeout(function(){$('toast').hidden=true;lastFiled=null},id?8000:3000);
}
$('undo').addEventListener('click',async function(){
  if(!lastFiled)return;var id=lastFiled;lastFiled=null;$('undo').hidden=true;$('toastText').textContent='Undoing…';
  try{await api('undo/'+id,{method:'POST'});$('toastText').textContent='Undone. Not in QuickBooks.';loadRecent();loadSummary()}
  catch(err){$('toastText').textContent="Couldn't undo: "+err.message}
  clearTimeout(toastTimer);toastTimer=setTimeout(function(){$('toast').hidden=true},3000);
});
$('save').addEventListener('click',async function(){
  var r={image:$('prev').hidden?'':$('prev').src,supplier:$('supplier').value.trim(),date:$('date').value,category:$('category').value,total:parseFloat($('total').value)||0,vat:parseFloat($('vat').value)||0,items:$('items').value.trim()};
  $('save').disabled=true;say('Sending to QuickBooks…');
  try{var out=await api('file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(r)});
    $('check').hidden=true;loadRecent();say('');
    if(out.duplicate)toast('Already in QuickBooks, so not added twice',null);else toast('✓ '+(r.supplier||'Expense')+' '+money(r.total)+' filed',out.id);
    if(queue.length)setTimeout(next,1200);
  }catch(err){say("Couldn't send it: "+err.message,true)}
  $('save').disabled=false;
});
$('cancel').addEventListener('click',function(){$('check').hidden=true;say('');next()});

var start='home';try{start=localStorage.getItem('books-tab')||'home'}catch(e){}
show(TITLES[start]?start:'home');
</script></body></html>`;
