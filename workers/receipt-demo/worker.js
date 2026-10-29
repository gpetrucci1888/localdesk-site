// Receipt reader demo.
//
// GET  /<KEY>        the phone page: snap a receipt, check what was read, save it.
// POST /<KEY>/read   reads one receipt photo with Workers AI and returns the details as JSON.
//
// The key in the path (the KEY setting on the Worker) keeps strangers from running up AI usage. Saved receipts stay in
// the phone's own browser (localStorage); nothing is stored on the server.

const MODELS = [
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  '@cf/google/gemma-3-12b-it',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
];
const CATEGORIES = ['Materials', 'Tools and equipment', 'Fuel', 'Vehicle', 'Subcontractors', 'Phone and internet', 'Office', 'Food and drink', 'Other'];
const PROMPT = `You read UK receipts for a plumber's bookkeeping. Look at the receipt photo and reply with ONLY a JSON object, no other text:
{"supplier": "", "date": "YYYY-MM-DD", "total": 0.00, "vat": 0.00, "category": "", "items": "", "readable": true}
- supplier: the shop or company name.
- total: the amount paid, including VAT, as a number.
- vat: the VAT amount if shown, else 0.
- category: one of ${CATEGORIES.join(', ')}.
- items: a few words on what was bought.
- readable: false if this isn't a receipt or you can't read it.`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const KEY = env.KEY;
    if (!KEY) return new Response('Not set up', { status: 503 });
    if (url.pathname === `/${KEY}` && request.method === 'GET') {
      return new Response(PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    if (url.pathname === `/${KEY}/read` && request.method === 'POST') {
      try {
        const { image } = await request.json();
        if (!/^data:image\/(jpeg|png|webp);base64,/.test(image || '')) return json({ error: 'No photo received' }, 400);
        return json(await readReceipt(env, image));
      } catch (err) {
        return json({ error: String(err && err.message || err) }, 500);
      }
    }
    if (url.pathname === `/${KEY}/file` && request.method === 'POST') {
      // Straight into QuickBooks, through the books connector (service binding).
      if (!env.BOOKS || !env.REALM) return json({ error: 'QuickBooks isn\'t connected for this page' }, 503);
      const res = await env.BOOKS.fetch(`https://books/file/${env.REALM}`, {
        method: 'POST', headers: { 'X-Key': env.BOOKS_KEY, 'Content-Type': 'application/json' }, body: request.body,
      });
      const text = await res.text();
      return new Response(text.startsWith('{') ? text : JSON.stringify({ error: text }), { status: res.status, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('Not found', { status: 404 });
  },
};

async function readReceipt(env, image) {
  const tried = [];
  for (const model of MODELS) {
    try {
      const out = await env.AI.run(model, {
        messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: image } }] }],
        max_tokens: 400,
      });
      const text = typeof out.response === 'string' ? out.response : JSON.stringify(out.response || out);
      const found = text.match(/\{[\s\S]*\}/);
      if (!found) { tried.push(`${model}: no JSON`); continue; }
      const r = JSON.parse(found[0]);
      return {
        supplier: String(r.supplier || ''),
        date: String(r.date || ''),
        total: Number(r.total) || 0,
        vat: Number(r.vat) || 0,
        category: CATEGORIES.includes(r.category) ? r.category : 'Other',
        items: String(r.items || ''),
        readable: r.readable !== false,
        model,
      };
    } catch (err) {
      tried.push(`${model}: ${err && err.message || err}`);
    }
  }
  throw new Error('Could not read the receipt. ' + tried.join(' | '));
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

const PAGE = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Receipts</title>
<style>
:root{--bg:#f3f4f6;--card:#fff;--ink:#1d1f23;--muted:#5b616b;--line:#dfe2e6;--acc:#f2b705;--go:#1f7a4d;--stop:#b5402c}
@media (prefers-color-scheme:dark){:root{--bg:#15171a;--card:#1f2226;--ink:#eceef1;--muted:#a5abb4;--line:#353a40;--go:#5cc78f;--stop:#f08a76}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:520px;margin:0 auto;padding:16px;display:grid;gap:14px}
h1{font-size:22px;margin:4px 0 0}
.sub{color:var(--muted);margin:0}
.snap{display:block;text-align:center;background:var(--acc);color:#1d1f23;font-weight:800;font-size:20px;padding:22px;border-radius:14px;cursor:pointer}
.snap input{display:none}
.snap.alt{background:var(--card);color:var(--ink);border:1.5px solid var(--line);font-size:17px;padding:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}
.card h2{font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 10px}
img.prev{width:100%;max-height:260px;object-fit:contain;border-radius:10px;background:#0001}
label.f{display:grid;gap:3px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
label.f input,label.f select{font:inherit;font-size:16px;padding:9px 10px;border:1.5px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);text-transform:none;letter-spacing:0;font-weight:400}
.two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.btns{display:flex;gap:8px}
button{font:inherit;font-weight:800;font-size:16px;padding:12px 14px;border-radius:10px;border:0;cursor:pointer}
.save{background:var(--go);color:#fff;flex:1}
.cancel{background:transparent;border:1.5px solid var(--line);color:var(--ink)}
.msg{color:var(--muted);text-align:center}
.err{color:var(--stop)}
.totals{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center}
.totals b{display:block;font-size:20px}
.totals span{font-size:12px;color:var(--muted)}
ul{list-style:none;margin:0;padding:0}
li{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid var(--line)}
li small{display:block;color:var(--muted)}
.link{background:none;border:0;color:var(--muted);font-weight:700;font-size:14px;padding:6px;text-decoration:underline}
</style></head><body><main>
<div><h1>Receipts</h1><p class="sub">Snap a receipt, or add photos and PDFs. They go straight into QuickBooks.</p></div>
<label class="snap">📷 Snap a receipt<input id="file" type="file" accept="image/*" capture="environment"></label>
<label class="snap alt">🖼️ Add photos or PDFs<input id="pick" type="file" accept="image/*,application/pdf,.pdf" multiple></label>
<p class="msg" id="msg" hidden></p>
<section class="card" id="check" hidden>
  <h2>Check it's right</h2>
  <img class="prev" id="prev" alt="Your receipt">
  <div style="height:10px"></div>
  <label class="f">Supplier<input id="supplier"></label>
  <div class="two"><label class="f">Date<input id="date" type="date"></label><label class="f">Category<select id="category"></select></label></div>
  <div class="two"><label class="f">Total £<input id="total" inputmode="decimal"></label><label class="f">VAT £<input id="vat" inputmode="decimal"></label></div>
  <label class="f">What for<input id="items"></label>
  <div class="btns"><button class="save" id="save">Looks right, send to QuickBooks</button><button class="cancel" id="cancel">Cancel</button></div>
</section>
<section class="card">
  <h2>This month</h2>
  <div class="totals"><div><b id="n">0</b><span>receipts</span></div><div><b id="spent">£0</b><span>spent</span></div><div><b id="vatt">£0</b><span>VAT</span></div></div>
</section>
<section class="card"><h2>Filed</h2><ul id="list"></ul><p class="msg" id="empty">Nothing yet.</p>
<div style="text-align:center"><button class="link" id="csv">Download for QuickBooks (CSV)</button></div></section>
</main>
<script>
var CATS=${JSON.stringify(CATEGORIES)};
var $=function(id){return document.getElementById(id)};
CATS.forEach(function(c){var o=document.createElement('option');o.textContent=c;$('category').appendChild(o)});
function load(){try{return JSON.parse(localStorage.getItem('receipts')||'[]')}catch(e){return []}}
function store(a){try{localStorage.setItem('receipts',JSON.stringify(a))}catch(e){}}
function money(n){return '£'+(Number(n)||0).toFixed(2)}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function render(){
  var all=load(), ym=new Date().toISOString().slice(0,7), mon=all.filter(function(r){return (r.date||'').slice(0,7)===ym});
  $('n').textContent=mon.length;
  $('spent').textContent=money(mon.reduce(function(s,r){return s+r.total},0));
  $('vatt').textContent=money(mon.reduce(function(s,r){return s+r.vat},0));
  $('list').innerHTML=all.slice().reverse().map(function(r){return '<li><div>'+esc(r.supplier||'Unknown')+'<small>'+esc(r.date)+' · '+esc(r.category)+'</small></div><div>'+money(r.total)+'</div></li>'}).join('');
  $('empty').hidden=all.length>0;
}
function say(t,bad){$('msg').hidden=!t;$('msg').textContent=t||'';$('msg').className='msg'+(bad?' err':'')}
var PDFJS='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
function loadPdfJs(){return window.pdfjsLib?Promise.resolve(window.pdfjsLib):new Promise(function(ok,no){var sc=document.createElement('script');sc.src=PDFJS+'pdf.min.js';sc.onload=function(){pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS+'pdf.worker.min.js';ok(pdfjsLib)};sc.onerror=function(){no(new Error('Could not load the PDF reader'))};document.head.appendChild(sc)})}
// First page of the PDF, drawn as an image the same size as a photo.
async function pdfToImage(file){
  var lib=await loadPdfJs(), doc=await lib.getDocument({data:await file.arrayBuffer()}).promise, page=await doc.getPage(1);
  var v=page.getViewport({scale:1}), s=1280/Math.max(v.width,v.height), vp=page.getViewport({scale:s});
  var c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);
  var ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
  await page.render({canvasContext:ctx,viewport:vp}).promise;
  return c.toDataURL('image/jpeg',0.85);
}
function shrink(file){
  if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)) return pdfToImage(file);return new Promise(function(ok,no){var img=new Image();img.onload=function(){var s=Math.min(1,1280/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);ok(c.toDataURL('image/jpeg',0.82))};img.onerror=no;img.src=URL.createObjectURL(file)})}
var queue=[];
function addFiles(e){
  queue=queue.concat(Array.prototype.slice.call(e.target.files)); e.target.value='';
  if($('check').hidden) next();
}
$('file').addEventListener('change',addFiles);
$('pick').addEventListener('change',addFiles);
async function next(){
  var f=queue.shift(); if(!f){return}
  $('check').hidden=true; say('Reading your receipt…'+(queue.length?' ('+queue.length+' more to go)':''));
  try{
    var data=await shrink(f); $('prev').src=data;
    var res=await fetch(location.pathname.replace(/\\/$/,'')+'/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:data})});
    var r=await res.json(); if(r.error) throw new Error(r.error);
    if(!r.readable){say("Couldn't read that one. Try again in better light, with the whole receipt in shot.",true);setTimeout(next,2500);return}
    $('supplier').value=r.supplier;$('date').value=r.date;$('category').value=r.category;$('total').value=r.total.toFixed(2);$('vat').value=r.vat.toFixed(2);$('items').value=r.items;
    say('');$('check').hidden=false;$('check').scrollIntoView({behavior:'smooth'});
  }catch(err){say('Something went wrong: '+err.message,true);setTimeout(next,2500)}
}
$('save').addEventListener('click',async function(){
  var r={supplier:$('supplier').value.trim(),date:$('date').value,category:$('category').value,total:parseFloat($('total').value)||0,vat:parseFloat($('vat').value)||0,items:$('items').value.trim()};
  $('save').disabled=true;say('Sending to QuickBooks…');
  try{
    var res=await fetch(location.pathname.replace(/\/$/,'')+'/file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({image:$('prev').src},r))});
    var out=await res.json(); if(out.error) throw new Error(out.error);
    r.qb=out.duplicate?'already there':'filed';
    var a=load();a.push(r);store(a);$('check').hidden=true;render();
    var done=out.duplicate?'Already in QuickBooks, so not added twice ✓':'In QuickBooks ✓ ('+out.account+')';
    if(queue.length){say(done);setTimeout(next,1200)}else{say(done);setTimeout(function(){say('')},2500)}
  }catch(err){say("Couldn't send to QuickBooks: "+err.message,true)}
  $('save').disabled=false;
});
$('cancel').addEventListener('click',function(){$('check').hidden=true;next()});
$('csv').addEventListener('click',function(){
  var rows=[['Date','Supplier','Category','Description','Total','VAT']].concat(load().map(function(r){return [r.date,r.supplier,r.category,r.items,r.total.toFixed(2),r.vat.toFixed(2)]}));
  var csv=rows.map(function(r){return r.map(function(v){return '"'+String(v).replace(/"/g,'""')+'"'}).join(',')}).join('\\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='receipts.csv';a.click();
});
render();
</script></body></html>`;
