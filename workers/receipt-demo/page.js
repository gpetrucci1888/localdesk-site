// The phone app: one page, tabs Home, Receipts, (Jobs), Owed, New. LOGIN and NO_LOGIN share its look.
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
section{display:grid;gap:14px;grid-template-columns:minmax(0,1fr)}
main{grid-template-columns:minmax(0,1fr)}
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
nav svg{width:24px;height:24px;padding:2px 10px;box-sizing:content-box;border-radius:20px}
nav button[aria-current="page"]{color:var(--ink)}
nav button[aria-current="page"] svg{background:var(--acc);color:var(--accInk)}
.by{text-align:center;font-size:12px;color:var(--muted);margin:6px 0 0}
.toast{position:fixed;left:12px;right:12px;bottom:84px;max-width:496px;margin:0 auto;background:#16181b;color:#fff;border-radius:14px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;box-shadow:0 8px 24px #0005;z-index:5}
.toast button{background:var(--acc);color:var(--accInk);padding:8px 14px;font-size:15px}
.why{color:var(--stop);font-weight:700;margin:0 0 10px;font-size:14px}
[hidden]{display:none!important}
nav.five{grid-template-columns:repeat(5,1fr)}
.potrow{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:10px;padding:12px;border-radius:12px;background:var(--bg);border-left:5px solid var(--acc)}
.potrow span{display:block;font-size:13px;color:var(--muted)}.potrow b{font-size:20px}.potrow small{color:var(--muted);font-size:12px;text-align:right;max-width:46%}
.seg{display:flex;background:var(--bg);border-radius:12px;padding:4px;gap:4px;margin-bottom:12px}
.seg button{flex:1;background:none;color:var(--muted);padding:9px;font-size:15px}
.seg button[aria-pressed="true"]{background:var(--card);color:var(--ink);box-shadow:var(--shadow)}
select.chip{font:inherit;font-size:13px;font-weight:700;padding:4px 8px;border:1px solid var(--line);border-radius:20px;background:var(--bg);color:var(--ink);max-width:150px;margin-top:4px}
.todo li{cursor:pointer}.todo li b{font-size:15px}.todo .arr{color:var(--muted);font-size:20px}
.pos{color:var(--go)}.neg{color:var(--stop)}
.right{text-align:right;flex:none}
.jobsel{display:flex;align-items:center;gap:10px}
.jobsel select{flex:1;width:100%;font:inherit;font-size:16px;padding:11px;border:1.5px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);min-width:0}
.jobsel span{font-weight:800;font-size:14px;white-space:nowrap}
.sendrow{display:flex;gap:8px;margin-top:12px}.sendrow select{font:inherit;font-size:15px;padding:10px;border:1.5px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);min-width:0}
</style></head><body>
<header class="top"><div class="in">{{LOGO}}<div><p class="biz">{{NAME}}</p><h1 id="title">This month</h1><p class="sub" id="subtitle"></p></div></div></header>
<main>
<p class="msg" id="msg" hidden></p>

<section id="tab-home">
  <div class="snaps"><label class="snap" for="file"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Snap a receipt</label><label class="snap alt" for="pick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>Photos or PDFs</label></div>
  <div class="card"><h2>Profit so far</h2><p class="big" id="profit">…</p>
    <div class="grid2" style="margin-top:12px"><div class="stat"><span>Money in</span><b id="in">…</b></div><div class="stat"><span>Money out</span><b id="out">…</b></div></div>
    <div class="potrow"><div><span>Put aside for tax</span><b id="pot">…</b></div><small>Rough guide, about a quarter of profit</small></div></div>
  <div class="card todo" id="todo" hidden><h2>To do</h2><ul id="todoList"></ul></div>
  <div class="card"><h2>Owed to you</h2><p class="big" id="owedTotal">…</p><p class="note" id="owedCount"></p><button class="link" data-tab="owed">See who owes you →</button></div>
  <div class="card"><h2>For your accountant</h2><p class="sub" id="qDates"></p>
    <div class="grid2" style="margin-top:10px"><div class="stat"><span>Income</span><b id="qIn">…</b></div><div class="stat"><span>Expenses</span><b id="qOut">…</b></div></div>
    <p class="note" id="qDue"></p>
    <div class="sendrow"><select id="pPeriod" aria-label="Which period"><option value="quarter">This quarter</option><option value="lastquarter">Last quarter</option><option value="taxyear">This tax year</option><option value="lasttaxyear">Last tax year</option></select><button class="go" id="pSend">Send to accountant</button></div>
    <div id="acctWrap" hidden style="margin-top:12px"><label class="f">Your accountant's email<input id="acctEmail" type="email" inputmode="email" autocomplete="off"></label><button class="go" id="acctGo" style="width:100%">Save and send</button></div>
    <button class="link" id="pView">See what they get →</button></div>
</section>

<section id="tab-tidy" hidden>
  <div class="card"><h2>Put these in the right place</h2><ul id="tidyList"></ul><p class="msg" id="tidyEmpty" hidden>All tidy. Nothing to sort.</p></div>
  <p class="note">The category is a suggestion. Change it if it's wrong, then tap ✓.</p>
</section>

<section id="tab-receipts" hidden>
  <div class="card jobsel" id="jobCard" hidden><span>Which job?</span><select id="jobPick" aria-label="Which job"><option value="">No job (general)</option></select></div>
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

<section id="tab-jobs" hidden>
  <div class="card"><h2>Quotes waiting</h2><ul id="quoteList"></ul><p class="note" id="quoteEmpty" hidden>No quotes waiting. Make one from New.</p></div>
  <div class="card" id="bookedCard" hidden><h2>Booked in</h2><ul id="bookedList"></ul><p class="note">Tap "Invoice it" when the job's done.</p></div>
  <div class="card"><h2>Profit per job</h2><p class="sub">Last 12 months</p><ul id="jobList" style="margin-top:6px"></ul></div>
  <p class="note">Costs count when a receipt is put against the job (on Receipts). Quotes with no answer after 30 days drop off.</p>
</section>

<section id="tab-invoice" hidden>
  <div class="card"><div class="seg" id="kind" hidden><button data-kind="invoice" aria-pressed="true">Invoice</button><button data-kind="quote" aria-pressed="false">Quote</button></div>
    <label class="f">Customer name<input id="iCust" autocomplete="off" list="custList"></label><datalist id="custList"></datalist>
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
  <button data-tab="home" aria-current="page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></svg>Home</button>
  <button data-tab="receipts"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>Receipts</button>
  <button data-tab="jobs" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/></svg>Jobs</button>
  <button data-tab="owed"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M14.5 8.5a2.5 2.5 0 0 0-5 .5c0 3-1 4.5-2 6h8M8 12.5h5"/></svg>Owed</button>
  <button data-tab="invoice"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>New</button>
</nav>

<script>
var CATS=["Materials","Tools and equipment","Fuel","Vehicle","Subcontractors","Phone and internet","Office","Food and drink","Other"];
var BASE=location.pathname.replace(/\/$/,'');
var $=function(id){return document.getElementById(id)};
function money(n){return '£'+(Number(n)||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}
function ukDate(d){var t=Date.parse(d);return isNaN(t)?(d||''):new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function say(t,bad){$('msg').hidden=!t;$('msg').textContent=t||'';$('msg').className='msg'+(bad?' err':'')}
async function api(path,opts){var r=await fetch(BASE+'/api/'+path,opts);if(r.status===401){location.reload();throw new Error('Logging in again…')}var d=await r.json().catch(function(){return {error:'No response'}});if(d.error)throw new Error(d.error);return d}
CATS.forEach(function(c){var o=document.createElement('option');o.textContent=c;$('category').appendChild(o)});

// ---- tabs ----
var TITLES={home:'This month',receipts:'Receipts',jobs:'Jobs',owed:'Who owes you',invoice:'New invoice',tidy:'Tidy up'};
var EXTRAS='{{EXTRAS}}'.split(',').map(function(x){return x.trim()});
var QUOTES=EXTRAS.indexOf('quotes')>=0;
if(QUOTES){document.querySelector('nav').classList.add('five');document.querySelector('nav [data-tab=jobs]').hidden=false;$('jobCard').hidden=false}
function show(tab){
  Object.keys(TITLES).forEach(function(t){$('tab-'+t).hidden=t!==tab});
  document.querySelectorAll('nav button').forEach(function(b){b.setAttribute('aria-current',b.dataset.tab===(tab==='tidy'?'home':tab)?'page':'false')});
  $('title').textContent=tab==='invoice'?(kind==='quote'?'New quote':'New invoice'):TITLES[tab];say('');
  if(tab==='home'){loadSummary();loadQuarter();loadTodo()} if(tab==='owed')loadOwed(); if(tab==='receipts'){if(QUOTES)loadJobsPick();loadRecent()} if(tab==='tidy')loadTidy(); if(tab==='jobs')loadJobs(); if(tab==='invoice')loadJobsPick();
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
  $('iSend').disabled=true;say(kind==='quote'?'Making the quote…':'Creating invoice…');
  try{var r=await api(kind,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(kind==='quote')say('Quote '+(r.number?r.number+' ':'')+'for '+money(r.total)+' made'+(r.sentTo?' and emailed to '+r.sentTo:'')+' ✓ It waits on Jobs until you mark it won or lost.');else say('Invoice '+(r.number?r.number+' ':'')+'for '+money(r.total)+' created'+(r.sentTo?' and emailed to '+r.sentTo:'')+' ✓'+(r.cisDeduction?' They deduct '+money(r.cisDeduction)+' CIS, so expect '+money(r.toReceive)+'.':''));
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
// ---- to do (home) ----
async function loadTodo(){
  var items=[];
  var calls=[api('untidy').then(function(l){if(l.length)items.push({tab:'tidy',t:l.length+' expense'+(l.length>1?'s':'')+' to sort',s:'One tap each'})}).catch(function(){}),
    api('owed').then(function(l){var late=l.filter(function(i){return i.daysOverdue>0});if(late.length)items.push({tab:'owed',t:late.length+' invoice'+(late.length>1?'s':'')+' late',s:'Oldest '+late[0].daysOverdue+' days. Tap to remind'})}).catch(function(){})];
  if(QUOTES)calls.push(api('quotes').then(function(l){var c=l.filter(function(q){return q.status==='waiting'&&q.days>=7});if(c.length)items.push({tab:'jobs',t:c.length+' quote'+(c.length>1?'s':'')+' to chase',s:'No answer for a week. One tap'})}).catch(function(){}));
  await Promise.all(calls);
  $('todo').hidden=!items.length;
  $('todoList').innerHTML=items.map(function(i){return '<li data-tab="'+i.tab+'"><div><b>'+esc(i.t)+'</b><small>'+esc(i.s)+'</small></div><span class="arr">›</span></li>'}).join('');
}

// ---- accountant pack ----
var lastPack=null;
async function makePack(){var r=await api('pack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({period:$('pPeriod').value})});lastPack=r;return r}
function emailPack(r,to){
  var nice=function(d){return ukDate(d)};
  var body='Hi,\n\nHere are my books for '+nice(r.from)+' to '+nice(r.to)+':\n'+r.url+'\n\nIt has the figures, every expense with its receipt, and all invoices. There\'s a spreadsheet download at the top.\n\nThanks,\n'+document.querySelector('.biz').textContent;
  location.href='mailto:'+encodeURIComponent(to||'')+'?subject='+encodeURIComponent('Books: '+nice(r.from)+' to '+nice(r.to))+'&body='+encodeURIComponent(body);
}
$('pSend').addEventListener('click',async function(){
  $('pSend').disabled=true;say('Getting it ready…');
  try{var r=await makePack();say('');if(r.accountant)emailPack(r,r.accountant);else{$('acctWrap').hidden=false;$('acctEmail').focus()}}
  catch(err){say(err.message,true)}
  $('pSend').disabled=false;
});
$('acctGo').addEventListener('click',async function(){
  var em=$('acctEmail').value.trim();if(!/.+@.+\..+/.test(em)){say('Put in their email address',true);return}
  try{await api('accountant',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountant:em})});$('acctWrap').hidden=true;say('');emailPack(lastPack||await makePack(),em)}
  catch(err){say(err.message,true)}
});
$('pView').addEventListener('click',async function(){
  var w=window.open('','_blank');
  try{var r=await makePack();if(w)w.location=r.url;else location.href=r.url}catch(err){if(w)w.close();say(err.message,true)}
});

// ---- jobs ----
var custs=null;
async function loadJobsPick(){
  if(!custs){try{custs=await api('customers')}catch(e){custs=[]}}
  var keep=$('jobPick').value||sticky();
  $('jobPick').innerHTML='<option value="">No job (general)</option>'+custs.map(function(c){return '<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>'}).join('');
  $('jobPick').value=keep;if($('jobPick').value!==keep)$('jobPick').value='';
  $('custList').innerHTML=custs.map(function(c){return '<option value="'+esc(c.name)+'">'}).join('');
}
// The chosen job sticks for the day.
function sticky(){try{var v=JSON.parse(localStorage.getItem('books-job')||'{}');return v.day===new Date().toDateString()?v.id:''}catch(e){return ''}}
$('jobPick').addEventListener('change',function(){try{localStorage.setItem('books-job',JSON.stringify({day:new Date().toDateString(),id:$('jobPick').value}))}catch(e){}});
function jobOptions(sel){return '<option value="">No job</option>'+(custs||[]).map(function(c){return '<option value="'+esc(c.id)+'"'+(c.id===sel?' selected':'')+'>'+esc(c.name)+'</option>'}).join('')}
document.addEventListener('change',async function(e){
  var s=e.target.closest('[data-setjob]');if(!s)return;s.disabled=true;
  try{var r=await api('job/'+s.dataset.setjob,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerId:s.value})});say(r.job?'Put against '+r.job+' ✓':'Taken off the job ✓')}
  catch(err){say(err.message,true)}
  s.disabled=false;
});
async function loadJobs(){
  $('jobList').innerHTML='<li><small>Loading…</small></li>';
  loadQuotes();
  try{var d=await api('jobs');
    $('jobList').innerHTML=d.jobs.map(function(j){
      return '<li><div style="min-width:0"><b>'+esc(j.name)+'</b><small>In '+money(j.in)+' · Costs '+money(j.out)+'</small></div><div class="right"><b class="'+(j.profit<0?'neg':'pos')+'">'+money(j.profit)+'</b><small>'+(j.in>0?Math.round(j.profit/j.in*100)+'% kept':'')+'</small></div></li>'}).join('')||'<li><small>No jobs yet. Invoice someone and they show up here.</small></li>';
    if(d.unassigned>0)$('jobList').insertAdjacentHTML('beforeend','<li><div><small>Costs not on a job</small></div><div class="right"><small>'+money(d.unassigned)+'</small></div></li>');
  }catch(err){$('jobList').innerHTML='';say("Couldn't load jobs: "+err.message,true)}
}
async function loadQuotes(){
  try{var l=await api('quotes');
    var w=l.filter(function(q){return q.status==='waiting'}),bk=l.filter(function(q){return q.status==='booked'});
    $('quoteEmpty').hidden=w.length>0;$('bookedCard').hidden=!bk.length;
    var info=function(q){return '<div style="min-width:0"><b>'+esc(q.customer)+'</b><small>'+money(q.total)+(q.description?' · '+esc(q.description):'')+'</small></div>'};
    $('quoteList').innerHTML=w.map(function(q){return '<li>'+info(q)+'<span class="btns"><button class="go small" data-won="'+esc(q.id)+'">Won</button>'+(q.days>=3?'<button class="ghost small" data-chase="'+esc(q.id)+'">Chase</button>':'')+'</span></li>'}).join('');
    $('bookedList').innerHTML=bk.map(function(q){return '<li data-q="'+esc(q.id)+'">'+info(q)+'<span class="btns"><button class="go small" data-bill="'+esc(q.id)+'" data-net="'+q.net+'" data-lines="'+q.lines+'">Invoice it</button></span></li>'}).join('');
  }catch(err){say("Couldn't load quotes: "+err.message,true)}
}
document.addEventListener('click',async function(e){
  var w=e.target.closest('[data-won]'),c=e.target.closest('[data-chase]'),b=e.target.closest('[data-bill]'),go=e.target.closest('[data-billgo]');
  if(!w&&!c&&!b&&!go)return;
  var el=w||c||b||go;
  if(b){// ask for the final amount (one-line quotes only), then send
    var li=b.closest('li'),one=b.dataset.lines==='1';
    b.parentNode.outerHTML='';li.insertAdjacentHTML('afterend','<li class="billrow"><div style="flex:1;min-width:0">'+(one?'<label class="f" style="margin:0">Final amount £ (before VAT)<input id="billAmt" inputmode="decimal" value="'+Number(b.dataset.net).toFixed(2)+'"></label>':'<small>Invoice it as quoted?</small>')+'</div><button class="go small" style="flex:0;align-self:end" data-billgo="'+esc(b.dataset.bill)+'">Send</button></li>');
    return}
  el.disabled=true;
  try{
    if(w){await api('won/'+w.dataset.won,{method:'POST'});say('Booked in ✓ Tap "Invoice it" when the job\'s done.');loadQuotes()}
    else if(c){var r=await api('chase/'+c.dataset.chase,{method:'POST'});c.textContent='Sent ✓';say('Quote sent again to '+r.sentTo)}
    else{var amt=$('billAmt')?parseFloat($('billAmt').value)||0:0;var r2=await api('invoiceit/'+go.dataset.billgo,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:amt})});
      say('Invoice '+(r2.number?r2.number+' ':'')+'for '+money(r2.total)+' made'+(r2.sentTo?' and emailed to '+r2.sentTo:'')+' ✓');loadQuotes()}
  }catch(err){el.disabled=false;say(err.message,true)}
});

// ---- invoice or quote ----
var kind='invoice';
if(QUOTES)$('kind').hidden=false;
$('kind').addEventListener('click',function(e){var b=e.target.closest('[data-kind]');if(!b)return;kind=b.dataset.kind;
  document.querySelectorAll('[data-kind]').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});
  $('title').textContent=kind==='quote'?'New quote':'New invoice';$('iSend').textContent=kind==='quote'?'Send quote':'Create invoice'});

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
    if(!custs&&QUOTES)await loadJobsPick();
    $('recent').innerHTML=list.map(function(p){return '<li><div style="min-width:0">'+esc(p.supplier||'Expense')+'<small>'+esc(ukDate(p.date))+'</small>'+(QUOTES?'<select class="chip" data-setjob="'+esc(p.id)+'" aria-label="Job">'+jobOptions(p.jobId)+'</select>':'')+'</div><div class="right">'+money(p.total)+'</div></li>'}).join('')||'<li><small>Nothing yet.</small></li>';
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
  r.jobId=QUOTES?$('jobPick').value:'';
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
  var r={image:$('prev').hidden?'':$('prev').src,supplier:$('supplier').value.trim(),date:$('date').value,category:$('category').value,total:parseFloat($('total').value)||0,vat:parseFloat($('vat').value)||0,items:$('items').value.trim(),jobId:QUOTES?$('jobPick').value:''};
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

// Logging in on a new phone: a 6-digit code texted to the client's number. Same head and styles as the app.
const HEAD = PAGE.slice(0, PAGE.indexOf('<header'));
export const LOGIN = HEAD + String.raw`<style>
body{background:var(--hd);min-height:100vh;display:flex;flex-direction:column}
.hero{color:#fff;text-align:center;padding:calc(env(safe-area-inset-top) + 56px) 24px 40px}
.hero .logo{width:104px;height:104px;box-shadow:0 0 0 3px #ffffff1f,0 10px 30px #0006}
.hero .biz{margin:18px 0 0;font-size:13px}
.hero h1{font-size:28px;margin:6px 0 0}
.sheet{background:var(--bg);border-radius:28px 28px 0 0;flex:1;padding:28px 20px calc(env(safe-area-inset-bottom) + 28px)}
.sheet .in{max-width:420px;margin:0 auto;display:grid;gap:16px}
.sheet h2{font-size:22px;margin:0;letter-spacing:-.01em}
.sheet p.lead{margin:0;color:var(--muted)}
.big-btn{width:100%;padding:17px;font-size:17px;border-radius:14px}
.otp{position:relative;display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
.otp div{height:58px;border-radius:12px;border:1.5px solid var(--line);background:var(--card);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;font-variant-numeric:tabular-nums}
.otp div.on{border-color:var(--hd);box-shadow:0 0 0 3px var(--acc)}
.otp input{position:absolute;inset:0;width:100%;height:100%;opacity:.01;font-size:16px;border:0;color:transparent;caret-color:transparent;background:transparent}
.otp.bad div{border-color:var(--stop)}
.row{display:flex;justify-content:space-between;align-items:center;font-size:14px}
.row button{background:none;border:0;padding:0;color:var(--blue);font-weight:800;font-size:14px}
.row button:disabled{color:var(--muted);opacity:1}
.err{color:var(--stop);font-weight:700;margin:0;min-height:1.2em;font-size:14px}
.help{text-align:center;font-size:13px;color:var(--muted);margin:8px 0 0}
.help a{color:inherit}
</style>
<div class="hero">{{LOGO}}<p class="biz">{{NAME}}</p><h1>Books</h1></div>
<div class="sheet"><div class="in">
  <div id="step1" style="display:grid;gap:16px">
    <h2>Log in</h2>
    <p class="lead">We'll text a code to your mobile ending in <b style="color:var(--ink)">{{PHONE_END}}</b>.</p>
    <button class="go big-btn" id="send">Text me a code</button>
  </div>
  <div id="step2" hidden style="display:grid;gap:16px">
    <h2>Enter your code</h2>
    <p class="lead">Sent to your mobile ending in <b style="color:var(--ink)">{{PHONE_END}}</b>.</p>
    <div class="otp" id="otp"><div></div><div></div><div></div><div></div><div></div><div></div>
      <input id="code" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" maxlength="6" aria-label="6-digit code"></div>
    <p class="err" id="err"></p>
    <button class="go big-btn" id="verify">Log in</button>
    <div class="row"><span style="color:var(--muted)">No text?</span><button id="again" disabled>Send again</button></div>
  </div>
  <p class="err" id="err1"></p>
  <p class="help">You'll stay logged in on this phone.<br>Need a hand? <a href="tel:07700900000">07700 900000</a></p>
  <p class="by">Books by Localdesk</p>
</div></div>
<script>
var BASE=location.pathname.replace(/\/$/,'');
var $=function(id){return document.getElementById(id)};
var boxes=document.querySelectorAll('#otp div');
async function post(path,body){var r=await fetch(BASE+'/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});var d=await r.json().catch(function(){return {error:'No response'}});if(d.error)throw new Error(d.error);return d}
function draw(){var v=$('code').value.replace(/\D/g,'').slice(0,6);$('code').value=v;$('otp').classList.remove('bad');
  boxes.forEach(function(b,i){b.textContent=v[i]||'';b.className=(document.activeElement===$('code')&&i===Math.min(v.length,5))?'on':''})}
var timer=null;
function countdown(){var n=30;$('again').disabled=true;clearInterval(timer);
  timer=setInterval(function(){n--;$('again').textContent=n>0?'Send again in '+n+'s':'Send again';if(n<=0){clearInterval(timer);$('again').disabled=false}},1000);$('again').textContent='Send again in 30s'}
async function send(){var b=this;b.disabled=true;$('err1').textContent='';var was=b.textContent;b.textContent='Sending…';
  try{await post('login/send');$('step1').hidden=true;$('step2').hidden=false;$('code').value='';draw();$('code').focus();countdown();listen()}
  catch(e){$('err1').textContent=e.message;b.disabled=false}
  b.textContent=was}
$('send').addEventListener('click',send);$('again').addEventListener('click',send);
async function verify(){var c=$('code').value;if(c.length!==6){$('err').textContent='Put in all 6 numbers';return}
  $('verify').disabled=true;$('verify').textContent='Checking…';$('err').textContent='';
  try{await post('login/verify',{code:c});$('verify').textContent='✓';location.reload()}
  catch(e){$('err').textContent=e.message;$('otp').classList.add('bad');$('verify').disabled=false;$('verify').textContent='Log in'}}
$('verify').addEventListener('click',verify);
$('code').addEventListener('input',function(){draw();if($('code').value.length===6)verify()});
$('code').addEventListener('focus',draw);$('code').addEventListener('blur',draw);
// Android Chrome: read the code straight from the text.
function listen(){if(!('OTPCredential' in window))return;navigator.credentials.get({otp:{transport:['sms']}}).then(function(o){if(o&&o.code){$('code').value=o.code;draw();verify()}}).catch(function(){})}
</script></body></html>`;

// A client with no phone number saved can't log in yet.
export const NO_LOGIN = HEAD + String.raw`<style>body{background:var(--hd);min-height:100vh;display:flex;flex-direction:column}.hero{color:#fff;text-align:center;padding:72px 24px 40px}.hero .logo{width:104px;height:104px}.sheet{background:var(--bg);border-radius:28px 28px 0 0;flex:1;padding:28px 20px}.sheet .in{max-width:420px;margin:0 auto}</style>
<div class="hero">{{LOGO}}<p class="biz" style="margin-top:18px">{{NAME}}</p><h1>Books</h1></div>
<div class="sheet"><div class="in"><h2 style="margin:0 0 8px">Nearly ready</h2><p style="margin:0;color:var(--muted)">Your app isn't switched on yet. Ring Gio on <a href="tel:07700900000">07700 900000</a> and he'll sort it.</p><p class="by">Books by Localdesk</p></div></div></body></html>`;
