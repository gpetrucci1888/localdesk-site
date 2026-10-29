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
.sendrow{display:flex;gap:8px;margin-top:12px}
.ready{margin:10px 0 0;padding:10px 12px;border-radius:12px;background:var(--bg);font-size:14px;font-weight:700}
.ready.ok{color:var(--go)}.ready.no{color:var(--stop)}
.switch{display:flex;justify-content:space-between;align-items:center;gap:12px}
.switch input{width:48px;height:28px;accent-color:var(--hd);flex:none}
.wait{border-left:5px solid var(--acc)}
.steps{margin:0;padding-left:20px}.steps li{display:list-item;border:0;padding:4px 0}
.inrow{display:flex;gap:8px;align-items:end}.inrow label.f{margin:0;flex:1;min-width:0}
.undone{color:var(--muted);text-decoration:line-through}
/* app look: avatars, pills, rows, sheets, switches, skeletons */
.card{border-radius:20px}
.stack{display:grid;gap:10px;grid-template-columns:minmax(0,1fr)}
.av{width:44px;height:44px;border-radius:50%;flex:none;display:grid;place-items:center;font-weight:800;font-size:15px;color:#fff;letter-spacing:.02em}
.av svg{width:22px;height:22px}
.av.soft{background:var(--bg);color:var(--ink)}
.r{display:flex;align-items:center;gap:12px;min-width:0}
.grow{flex:1;min-width:0}
.grow b,.grow .t{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.grow small{display:block;color:var(--muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.amt{font-size:18px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
.pill{display:inline-block;font-size:12px;font-weight:800;padding:3px 9px;border-radius:20px;background:var(--bg);color:var(--muted);white-space:nowrap}
.pill.bad{background:color-mix(in srgb,var(--stop) 14%,transparent);color:var(--stop)}
.pill.ok{background:color-mix(in srgb,var(--go) 14%,transparent);color:var(--go)}
.pill.info{background:color-mix(in srgb,var(--blue) 14%,transparent);color:var(--blue)}
.ends{display:grid;justify-items:end;gap:4px;flex:none}
.inv{padding:14px 16px}
.inv.overdue{box-shadow:inset 4px 0 0 var(--stop),var(--shadow)}
.acts{display:flex;gap:8px;margin-top:12px}
.acts button{flex:1;padding:11px 12px;font-size:15px;border-radius:12px}
.acts .ghost{flex:0 0 auto}
.list>.r{padding:12px 0;border-top:1px solid var(--line)}
.list>.r:first-child{border-top:0;padding-top:4px}
.list>.r:last-child{padding-bottom:2px}
.hero2{display:grid;gap:4px}
.hero2 .big{font-size:36px}
.bar{height:10px;border-radius:6px;background:var(--bg);overflow:hidden;display:flex;margin-top:14px}
.bar i{display:block;height:100%}
.legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;font-size:13px;color:var(--muted)}
.legend b{color:var(--ink);font-variant-numeric:tabular-nums}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:1px}
.tog{appearance:none;-webkit-appearance:none;width:52px;height:32px;border-radius:20px;background:var(--line);position:relative;flex:none;cursor:pointer;transition:background .2s;margin:0}
.tog::after{content:"";position:absolute;top:3px;left:3px;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 1px 3px #0004;transition:transform .2s}
.tog:checked{background:var(--go)}
.tog:checked::after{transform:translateX(20px)}
.tog:disabled{opacity:.6}
.scrim{position:fixed;inset:0;background:#0008;z-index:20;display:flex;align-items:flex-end;justify-content:center;animation:fade .18s ease}
.sheet{background:var(--card);width:100%;max-width:520px;border-radius:24px 24px 0 0;padding:10px 20px calc(env(safe-area-inset-bottom) + 20px);animation:up .22s cubic-bezier(.2,.8,.2,1);max-height:90vh;overflow:auto}
.grab{width:40px;height:5px;border-radius:3px;background:var(--line);margin:0 auto 16px}
.sheet h3{font-size:21px;margin:0}
.sheet .sub{margin:4px 0 16px}
.opt{display:flex;align-items:center;gap:14px;width:100%;background:var(--bg);color:var(--ink);padding:15px 16px;border-radius:14px;font-size:17px;margin-bottom:10px;text-align:left}
.opt svg{width:24px;height:24px;flex:none}
.opt span{flex:1}
.opt small{display:block;color:var(--muted);font-weight:600;font-size:13px;margin-top:2px}
.cancel{display:block;width:100%;background:none;color:var(--muted);padding:12px;font-size:16px}
.split{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 16px}
.split div{background:var(--bg);border-radius:12px;padding:10px 12px}.split span{display:block;font-size:12px;color:var(--muted)}.split b{font-size:18px;font-variant-numeric:tabular-nums}
@keyframes up{from{transform:translateY(100%)}to{transform:none}}
@keyframes fade{from{opacity:0}to{opacity:1}}
.skel{height:56px;border-radius:14px;background:linear-gradient(90deg,var(--bg) 25%,var(--line) 50%,var(--bg) 75%);background-size:200% 100%;animation:sh 1.2s infinite linear}
@keyframes sh{from{background-position:200% 0}to{background-position:-200% 0}}
.empty{text-align:center;padding:28px 16px;color:var(--muted)}
.empty .av{margin:0 auto 10px;width:56px;height:56px}
.empty b{display:block;color:var(--ink);font-size:17px;margin-bottom:2px}
.helpbtns{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.helpbtns a{display:grid;justify-items:center;gap:6px;padding:12px 6px;border-radius:14px;background:var(--bg);color:var(--ink);text-decoration:none;font-weight:800;font-size:14px}
.helpbtns svg{width:24px;height:24px}
.chev{color:var(--muted);font-size:22px;flex:none}
/* header buttons, chips, search, chart, pull to refresh, transitions */
:root{--cin:#1f8a70;--cout:#c4622d}
@media (prefers-color-scheme:dark){:root{--cin:#2fa583;--cout:#d4774a}}
.top .in>div.t{flex:1;min-width:0}
.hbtn{background:#ffffff1a;color:#fff;width:42px;height:42px;border-radius:50%;padding:0;display:grid;place-items:center;flex:none}
.hbtn svg{width:22px;height:22px}
.chips{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:0 16px}
.chips::-webkit-scrollbar{display:none}
.chips button{flex:none;background:var(--card);color:var(--ink);border:1px solid var(--line);padding:8px 14px;border-radius:20px;font-size:14px}
.chips button[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.search{display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0 12px}
.search svg{width:20px;height:20px;color:var(--muted);flex:none}
.search input{flex:1;min-width:0;border:0;background:none;font:inherit;font-size:16px;padding:12px 0;color:var(--ink);outline:none}
.tap{cursor:pointer}
.chart svg{display:block;width:100%;height:auto;overflow:visible}
.chart text{font:11px system-ui,-apple-system,sans-serif;fill:var(--muted)}
.chart .grid{stroke:var(--line);stroke-width:1}
.chart .hit{fill:transparent;cursor:pointer}
.chart g.sel .bar{opacity:1}.chart g.dim .bar{opacity:.35}
.tip{font-size:14px;margin:8px 0 0;min-height:1.4em}
.tip b{font-variant-numeric:tabular-nums}
.ptr{position:fixed;left:50%;top:8px;width:40px;height:40px;margin-left:-20px;border-radius:50%;background:var(--card);box-shadow:0 2px 10px #0003;display:grid;place-items:center;z-index:30;transform:translateY(-60px);transition:transform .2s;color:var(--ink);font-size:20px}
.ptr.spin{animation:spin .8s linear infinite}
@keyframes spin{to{rotate:360deg}}
section.enter{animation:enter .18s ease}
@keyframes enter{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.rowlink{display:flex;align-items:center;gap:12px;padding:14px 0;border-top:1px solid var(--line);color:var(--ink);text-decoration:none;background:none;width:100%;font:inherit;font-weight:700;text-align:left;border-radius:0}
.rowlink:first-of-type{border-top:0;padding-top:4px}
.rowlink .grow small{font-weight:400}
.kv{display:grid;grid-template-columns:auto 1fr;gap:8px 16px;margin:0 0 16px;font-size:15px}.kv dt{color:var(--muted)}.kv dd{margin:0;text-align:right;font-weight:700;min-width:0;overflow-wrap:anywhere}
.rimg{width:100%;max-height:320px;object-fit:contain;border-radius:14px;background:var(--bg);margin:0 0 14px}
.lines{margin:0 0 14px}.lines div{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid var(--line)}.lines div:first-child{border-top:0}
.lines .tot{font-weight:800;font-size:18px}
.contact{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 16px}
.contact a{display:grid;justify-items:center;gap:6px;padding:12px 4px;border-radius:14px;background:var(--bg);color:var(--ink);text-decoration:none;font-weight:800;font-size:13px}
.contact svg{width:22px;height:22px}
.inv{touch-action:pan-y;transition:transform .15s}
li.q{flex-wrap:wrap}li.q>.btns{width:100%;padding-left:56px}li.q>.btns button{flex:1}.sendrow select{font:inherit;font-size:15px;padding:10px;border:1.5px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);min-width:0}
</style></head><body>
<header class="top"><div class="in"><button class="hbtn" id="back" hidden aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg></button>{{LOGO}}<div class="t"><p class="biz">{{NAME}}</p><h1 id="title">This month</h1><p class="sub" id="subtitle"></p></div>
<button class="hbtn" data-tab="settings" aria-label="Settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button></div></header>
<div class="ptr" id="ptr" aria-hidden="true">↻</div>
<main>
<p class="msg" id="msg" hidden></p>

<section id="tab-home">
  <div class="card wait" id="waitCard" hidden><h2>Waiting for signal</h2><p style="margin:0" id="waitText"></p><button class="link" id="waitGo">Send them now →</button></div>
  <div class="card" id="startCard" hidden><h2>Getting started</h2><ol class="steps">
    <li>Add Books to your home screen (Share, then "Add to Home Screen").</li>
    <li>Snap your next receipt. Books reads it and files it in QuickBooks.</li>
    <li>Add your accountant's email in Settings (the cog, top right).</li></ol>
    <button class="link" id="startDone">Got it, hide this</button></div>
  <div class="snaps"><label class="snap" for="file"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Snap a receipt</label><label class="snap alt" for="pick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>Photos or PDFs</label></div>
  <div class="card"><h2>Profit so far</h2><p class="big" id="profit">…</p>
    <div class="grid2" style="margin-top:12px"><div class="stat"><span>Money in</span><b id="in">…</b></div><div class="stat"><span>Money out</span><b id="out">…</b></div></div>
    <div class="potrow"><div><span>Put aside for tax</span><b id="pot">…</b></div><small>Rough guide, about a quarter of profit</small></div></div>
  <div class="card" id="trendCard"><h2>Last 6 months</h2>
    <div class="legend" style="margin:0 0 8px"><span><i class="dot" style="background:var(--cin)"></i>Money in</span><span><i class="dot" style="background:var(--cout)"></i>Money out</span></div>
    <div class="chart" id="chart"><div class="skel" style="height:150px"></div></div><p class="tip" id="tip"></p></div>
  <div class="card todo" id="todo" hidden><h2>To do</h2><ul id="todoList"></ul></div>
  <div class="card" id="cisCard" hidden><h2>CIS taken off this tax year</h2><p class="big" id="cisTotal">…</p><p class="note">Contractors paid this to HMRC for you. It comes off your tax bill (or comes back to you) through your tax return.</p></div>
  <div class="card"><h2>Owed to you</h2><p class="big" id="owedTotal">…</p><p class="note" id="owedCount"></p><button class="link" data-tab="owed">See who owes you →</button></div>
  <div class="card"><h2>For your accountant</h2><p class="sub" id="qDates"></p>
    <div class="grid2" style="margin-top:10px"><div class="stat"><span>Income</span><b id="qIn">…</b></div><div class="stat"><span>Expenses</span><b id="qOut">…</b></div></div>
    <p class="note" id="qDue"></p>
    <p class="ready" id="qReady" hidden></p>
    <div class="sendrow"><select id="pPeriod" aria-label="Which period"><option value="quarter">This quarter</option><option value="lastquarter">Last quarter</option><option value="taxyear">This tax year</option><option value="lasttaxyear">Last tax year</option></select><button class="go" id="pSend">Send to accountant</button></div>
    <div id="acctWrap" hidden style="margin-top:12px"><label class="f">Your accountant's email<input id="acctEmail" type="email" inputmode="email" autocomplete="off"></label><button class="go" id="acctGo" style="width:100%">Save and send</button></div>
    <button class="link" id="pView">See what they get →</button></div>
</section>

<section id="tab-expenses" hidden>
  <div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="xQ" type="search" placeholder="Search supplier, item or category" autocomplete="off" enterkeyhint="search"></div>
  <div class="chips" id="xPer"><button data-per="month" aria-pressed="true">This month</button><button data-per="last" aria-pressed="false">Last month</button><button data-per="quarter" aria-pressed="false">3 months</button><button data-per="tax" aria-pressed="false">This tax year</button><button data-per="year" aria-pressed="false">12 months</button></div>
  <div class="card hero2"><div class="r" style="justify-content:space-between"><h2 style="margin:0">Spent</h2><select class="chip" id="xCat" aria-label="Category" style="margin:0"><option value="">All categories</option></select></div><p class="big" id="xTotal">…</p><p class="sub" id="xCount"></p></div>
  <div class="card"><ul id="xList"></ul></div>
</section>

<section id="tab-settings" hidden>
  <div class="card"><div class="r"><span class="av" style="background:var(--hd);border:2px solid var(--acc)" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg></span><div class="grow"><b>{{NAME}}</b><div id="stConn" style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap;font-size:13px;color:var(--muted)">Checking QuickBooks…</div></div></div></div>
  <div class="card"><h2>Settings</h2>
    <div class="switch" style="padding:6px 0 12px"><div><b>Notifications</b><p class="note" style="margin-top:2px" id="pushNote">When someone pays, and a morning nudge if something's late.</p></div><input type="checkbox" class="tog" id="pushTog" role="switch" aria-label="Notifications"></div>
    <div class="switch" style="padding:12px 0;border-top:1px solid var(--line)"><div><b>Chase late payers for me</b><p class="note" style="margin-top:2px">Emails the invoice again at 7, 14 and 28 days late.</p></div><input type="checkbox" class="tog" id="chase2" role="switch" aria-label="Chase late payers for me"></div>
    <div class="switch" style="padding:12px 0 2px;border-top:1px solid var(--line)"><div><b>VAT registered</b><p class="note" style="margin-top:2px">Set up by Gio. Ask him if this changes.</p></div><b id="stVat">…</b></div></div>
  <div class="card"><h2>Your accountant</h2><div class="inrow"><label class="f" style="margin:0"><span style="position:absolute;left:-9999px">Accountant's email</span><input id="stAcct" type="email" inputmode="email" placeholder="accountant@example.co.uk" autocomplete="off"></label><button class="go" id="stAcctGo" style="flex:0">Save</button></div></div>
  <div class="card"><h2>Help</h2>
    <p style="margin:0 0 10px">Stuck, or something looks wrong? Text or ring Gio on 07700 900000.</p>
    <div class="helpbtns"><a href="sms:+447700900000"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H8l-4 4z"/></svg>Text</a><a href="https://wa.me/447700900000" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/></svg>WhatsApp</a><a href="tel:+447700900000"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>Ring</a></div>
    <button class="link" data-tab="changes">What Books changed in QuickBooks →</button>
    <p class="note">Want to stop? Tell Gio, or disconnect Books in QuickBooks (Apps). Everything already filed stays in your QuickBooks.</p></div>
  <div class="card"><a class="rowlink" href="https://www.localdeskai.co.uk/books/privacy.html" target="_blank" rel="noopener"><span class="grow">Privacy policy</span><span class="chev">›</span></a><a class="rowlink" href="https://www.localdeskai.co.uk/books/terms.html" target="_blank" rel="noopener"><span class="grow">Terms</span><span class="chev">›</span></a></div>
  <button class="ghost" id="logout" style="width:100%">Log out of this phone</button>
</section>

<section id="tab-changes" hidden>
  <div class="card"><h2>Last 60 days</h2><ul id="changeList"></ul></div>
  <p class="note">Everything Books did in your QuickBooks. "Undo" puts it back. Anything emailed to a customer can't be taken back here.</p>
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
  <div class="card"><h2>Latest in QuickBooks</h2><ul id="recent"></ul><button class="link" data-tab="expenses">See all expenses →</button></div>
  <div class="card"><h2>Mileage</h2>
    <div class="inrow"><label class="f">Miles<input id="mMiles" inputmode="decimal" placeholder="24"></label><label class="f" style="flex:2">What for<input id="mWhy" placeholder="Mrs Smith, boiler"></label></div>
    <div class="inrow" style="margin-top:10px"><label class="f">Date<input id="mDate" type="date"></label><button class="go" id="mAdd" style="flex:0">Add</button></div>
    <p class="sub" id="mSum" style="margin-top:12px"></p><ul id="mList"></ul>
    <p class="note">Business trips only, not home to a regular base. Worth 45p a mile for the first 10,000 miles in the tax year, 25p after. Goes in your accountant pack. Your accountant decides whether you claim this or your actual van costs.</p></div>
</section>

<section id="tab-owed" hidden>
  <div class="seg" id="owSeg" style="margin:0"><button data-ow="unpaid" aria-pressed="true">Owed</button><button data-ow="paid" aria-pressed="false">Paid</button><button data-ow="cust" aria-pressed="false">Customers</button></div>
  <div id="ow-unpaid" class="stack">
  <div class="card hero2"><h2>Owed to you</h2><p class="big" id="owTotal">…</p><p class="sub" id="owSub"></p>
    <div class="bar" id="owBar" hidden><i id="owBarLate" style="background:var(--stop)"></i><i id="owBarDue" style="background:var(--acc)"></i></div>
    <div class="legend" id="owLegend" hidden><span><i class="dot" style="background:var(--stop)"></i>Late <b id="owLate"></b></span><span><i class="dot" style="background:var(--acc)"></i>Not due yet <b id="owDue"></b></span></div></div>
  <div class="stack" id="owedList"></div>
  <div class="card empty" id="owedEmpty" hidden><div class="av" style="background:var(--go)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg></div><b>All paid up</b>Nobody owes you anything. Nice.</div>
  <div class="card switch"><div><b>Chase late payers for me</b><p class="note" style="margin-top:4px" id="chaseNote">Books emails the invoice again when it's 7, 14 and 28 days late.</p></div><input type="checkbox" class="tog" id="chase" role="switch" aria-label="Chase late payers for me"></div>
  </div>
  <div id="ow-paid" class="stack" hidden><div class="card"><h2>Paid in the last 12 months</h2><ul id="paidList"></ul></div></div>
  <div id="ow-cust" class="stack" hidden>
    <div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="cQ" type="search" placeholder="Find a customer" autocomplete="off"></div>
    <div class="card"><ul id="custList2"></ul></div></div>
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
function money(n){n=Number(n)||0;return (n<0?'-':'')+'£'+Math.abs(n).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}
function ukDate(d){var t=Date.parse(d);return isNaN(t)?(d||''):new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function say(t,bad){$('msg').hidden=!t;$('msg').textContent=t||'';$('msg').className='msg'+(bad?' err':'')}
// Instant open: draw the last figures straight away, then the fresh ones when they arrive.
function live(path,draw,fail){
  var k='bk:'+BASE+':'+path,c=null;try{c=JSON.parse(localStorage.getItem(k)||'null')}catch(e){}
  if(c)try{draw(c.d,true)}catch(e){}
  return api(path).then(function(d){try{localStorage.setItem(k,JSON.stringify({d:d,at:Date.now()}))}catch(e){}draw(d,false);return d})
    .catch(function(err){if(fail)fail(err,Boolean(c))});
}
function buzz(){try{if(navigator.vibrate)navigator.vibrate(12)}catch(e){}}
async function api(path,opts){var r=await fetch(BASE+'/api/'+path,opts);if(r.status===401){location.reload();throw new Error('Logging in again…')}var d=await r.json().catch(function(){return {error:'No response'}});if(d.error)throw new Error(d.error);return d}
CATS.forEach(function(c){var o=document.createElement('option');o.textContent=c;$('category').appendChild(o)});

// ---- tabs ----
var TITLES={home:'This month',receipts:'Receipts',jobs:'Jobs',owed:'Who owes you',invoice:'New invoice',tidy:'Tidy up',changes:'What Books changed',expenses:'All expenses',settings:'Settings'};
// Screens that sit under another one get a back button.
var PARENT={tidy:'home',changes:'settings',expenses:'receipts',settings:'home'};
var current='home';
var VAT='{{VAT}}'==='1';
var EXTRAS='{{EXTRAS}}'.split(',').map(function(x){return x.trim()});
var QUOTES=EXTRAS.indexOf('quotes')>=0;
if(QUOTES){document.querySelector('nav').classList.add('five');document.querySelector('nav [data-tab=jobs]').hidden=false;$('jobCard').hidden=false}
function show(tab){
  var moved=tab!==current;current=tab;
  Object.keys(TITLES).forEach(function(t){var el=$('tab-'+t);el.hidden=t!==tab;if(t===tab&&moved){el.classList.remove('enter');void el.offsetWidth;el.classList.add('enter')}});
  var top=tab;while(PARENT[top])top=PARENT[top];
  document.querySelectorAll('nav button').forEach(function(b){b.setAttribute('aria-current',b.dataset.tab===top?'page':'false')});
  $('back').hidden=!PARENT[tab];
  $('title').textContent=tab==='invoice'?(kind==='quote'?'New quote':'New invoice'):TITLES[tab];say('');
  if(tab!=='home')$('subtitle').textContent='';
  load(tab);
  if(moved)window.scrollTo(0,0);
  try{localStorage.setItem('books-tab',tab)}catch(e){}
}
function load(tab){
  if(tab==='home'){loadSummary();loadTrend();loadQuarter();loadTodo();loadCis();showWaiting()} if(tab==='owed')loadOwedView(); if(tab==='receipts'){if(QUOTES)loadJobsPick();loadRecent();loadMiles()} if(tab==='changes')loadChanges(); if(tab==='tidy')loadTidy(); if(tab==='jobs')loadJobs(); if(tab==='invoice')loadJobsPick();
  if(tab==='expenses')loadExpenses(); if(tab==='settings')loadSettings();
}
$('back').addEventListener('click',function(){show(PARENT[current]||'home')});
document.addEventListener('click',function(e){var b=e.target.closest('[data-tab]');if(b)show(b.dataset.tab)});

// ---- overview ----
function loadSummary(){
  return live('summary',function(s){
    if(current==='home')$('subtitle').textContent=new Date(s.month+'-01').toLocaleDateString('en-GB',{month:'long',year:'numeric'});
    $('profit').textContent=money(s.profit);$('in').textContent=money(s.moneyIn);$('out').textContent=money(s.moneyOut);
    $('pot').textContent=money(s.taxPot);$('owedTotal').textContent=money(s.owed);
    $('owedCount').textContent=s.owedCount?(s.owedCount+' unpaid invoice'+(s.owedCount>1?'s':'')):'All paid up';
  },function(err){say("Couldn't load your figures: "+err.message,true)});
}

// ---- chart: money in and out, last 6 months ----
var trendData=null;
function loadTrend(){return live('trend',function(d){trendData=d.months;drawTrend(-1)},function(err,had){if(!had)$('chart').innerHTML='<p class="note">Couldn\'t load the chart.</p>'})}
function drawTrend(sel){
  var m=trendData||[];if(!m.length)return;
  var W=320,H=150,L=34,B=20,T=6,top=Math.max.apply(null,m.map(function(x){return Math.max(x.in,x.out)}).concat([1]));
  var step=Math.pow(10,Math.floor(Math.log10(top))),nice=Math.ceil(top/step)*step;if(nice/step>5)step*=2;nice=Math.ceil(top/step)*step;
  var y=function(v){return T+(H-T-B)*(1-v/nice)},gw=(W-L)/m.length,bw=Math.min(16,gw/2-4);
  var short=function(v){return v>=1000?'£'+(v/1000).toFixed(v%1000?1:0).replace('.0','')+'k':'£'+Math.round(v)};
  var bar=function(x,v,c){var h=Math.max(0,(H-B)-y(v)),r=Math.min(4,h,bw/2);if(h<=0)return '';var yy=H-B-h;
    return '<path class="bar" fill="'+c+'" d="M'+x+','+(H-B)+'V'+(yy+r)+'Q'+x+','+yy+' '+(x+r)+','+yy+'H'+(x+bw-r)+'Q'+(x+bw)+','+yy+' '+(x+bw)+','+(yy+r)+'V'+(H-B)+'Z"/>'};
  var g='';for(var v=0;v<=nice;v+=step)g+='<line class="grid" x1="'+L+'" x2="'+W+'" y1="'+y(v)+'" y2="'+y(v)+'"/><text x="'+(L-6)+'" y="'+(y(v)+4)+'" text-anchor="end">'+short(v)+'</text>';
  m.forEach(function(x,i){var gx=L+i*gw,cx=gx+gw/2;
    g+='<g class="'+(sel<0?'':i===sel?'sel':'dim')+'" data-i="'+i+'">'+bar(cx-bw-1,x.in,'var(--cin)')+bar(cx+1,x.out,'var(--cout)')+
      '<text x="'+cx+'" y="'+(H-4)+'" text-anchor="middle"'+(i===sel?' style="fill:var(--ink);font-weight:700"':'')+'>'+esc(x.label)+(i===m.length-1?'*':'')+'</text>'+
      '<rect class="hit" x="'+gx+'" y="0" width="'+gw+'" height="'+H+'"/></g>'});
  $('chart').innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Money in and out for the last 6 months">'+g+'</svg>';
  var x=m[sel<0?m.length-1:sel];
  $('tip').innerHTML='<b>'+esc(x.label)+(sel<0||sel===m.length-1?' so far':'')+'</b>: in <b>'+money(x.in)+'</b> · out <b>'+money(x.out)+'</b> · profit <b class="'+(x.in-x.out<0?'neg':'pos')+'">'+money(x.in-x.out)+'</b>';
}
$('chart').addEventListener('click',function(e){var g=e.target.closest('[data-i]');if(g)drawTrend(Number(g.dataset.i))});

// ---- shared bits: avatars, sheets, confirm ----
var AVC=['#2f6f5e','#6b4fa3','#b5602c','#2f5fa8','#a33d5c','#4f7d2f','#8a6d1f','#3d6f8a'];
function initials(n){var w=String(n||'?').replace(/\(.*?\)/g,'').trim().split(/\s+/).filter(function(x){return !/^(ltd|limited|plc|&|and|the)$/i.test(x)});return ((w[0]||'?')[0]+(w.length>1?w[w.length-1][0]:'')).toUpperCase()}
function avatar(n){var h=0;String(n).split('').forEach(function(c){h=(h*31+c.charCodeAt(0))>>>0});return '<span class="av" style="background:'+AVC[h%AVC.length]+'" aria-hidden="true">'+esc(initials(n))+'</span>'}
function skel(n){return new Array(n||3).fill('<div class="skel"></div>').join('')}
var ICON={
  bank:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10 12 4l9 6"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"/></svg>',
  card:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg>',
  cash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/></svg>'};
function sheet(html){
  var bg=document.createElement('div');bg.className='scrim';bg.innerHTML='<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>'+html+'</div>';
  bg.addEventListener('click',function(e){if(e.target===bg||e.target.closest('[data-close]'))close()});
  function close(){bg.remove()}
  document.body.appendChild(bg);return {el:bg.firstChild,close:close};
}
function ask(title,text,ok,danger){return new Promise(function(done){
  var sh=sheet('<h3>'+esc(title)+'</h3><p class="sub">'+esc(text)+'</p><button class="go" style="width:100%;'+(danger?'background:var(--stop);color:#fff':'')+'" data-yes>'+esc(ok)+'</button><button class="cancel" data-close>Cancel</button>');
  sh.el.querySelector('[data-yes]').addEventListener('click',function(){sh.close();done(true)});
  sh.el.parentNode.addEventListener('click',function(e){if(e.target===sh.el.parentNode||e.target.closest('[data-close]'))done(false)});
})}

// ---- owed ----
var owedData={};
function loadOwed(){
  if(!$('owedList').children.length)$('owedList').innerHTML=skel(3);$('owedEmpty').hidden=true;
  return live('owed',function(list){owedData={};list.forEach(function(i){owedData[i.id]=i});drawOwed(list)},function(err,had){if(!had)$('owedList').innerHTML='';say("Couldn't load invoices: "+err.message,true)});
}
function drawOwed(list){
  var late=list.filter(function(i){return i.daysOverdue>0}),lateSum=late.reduce(function(s,i){return s+i.balance},0),all=list.reduce(function(s,i){return s+i.balance},0);
  $('owTotal').textContent=money(all);
  $('owSub').textContent=list.length?(list.length+' unpaid invoice'+(list.length>1?'s':'')+(late.length?', '+late.length+' late':', none late')):'Nothing outstanding';
  $('owBar').hidden=$('owLegend').hidden=!list.length;
  $('owBarLate').style.width=(all?lateSum/all*100:0)+'%';$('owBarDue').style.width=(all?(all-lateSum)/all*100:0)+'%';
  $('owLate').textContent=money(lateSum);$('owDue').textContent=money(all-lateSum);
  $('owedEmpty').hidden=list.length>0;
  $('owedList').innerHTML=list.map(function(i){
    var status=i.daysOverdue>0?'<span class="pill bad">'+i.daysOverdue+(i.daysOverdue===1?' day':' days')+' late</span>':'<span class="pill">Due '+esc(ukDate(i.due).replace(/ \d{4}$/,''))+'</span>';
    var meta=(i.number?'Invoice '+esc(i.number)+' · ':'')+'sent '+esc(ukDate(i.date).replace(/ \d{4}$/,''))+(i.cis>0?' · <span class="pill info">CIS</span>':'');
    return '<div class="card inv'+(i.daysOverdue>0?' overdue':'')+'" data-inv-card="'+esc(i.id)+'"><div class="r">'+avatar(i.customer)+'<div class="grow"><b>'+esc(i.customer)+'</b><small>'+meta+'</small></div><div class="ends"><span class="amt">'+money(i.balance)+'</span>'+status+'</div></div>'+
      '<div class="acts"><button class="go" data-paid="'+esc(i.id)+'">Mark as paid</button>'+(i.email?'<button class="ghost" data-remind="'+esc(i.id)+'">Remind</button>':'')+'</div></div>'}).join('');
}
document.addEventListener('click',async function(e){
  var b=e.target.closest('[data-remind]');if(!b)return;
  var i=owedData[b.dataset.remind];
  if(!(await ask('Send '+(i?i.customer:'them')+' a reminder?','Emails invoice'+(i&&i.number?' '+i.number:'')+' to '+(i?i.email:'them')+' again, from QuickBooks.','Send reminder')))return;
  b.disabled=true;b.textContent='Sending…';
  try{var r=await api('remind/'+b.dataset.remind,{method:'POST'});b.textContent='Sent ✓';toast('Reminder emailed to '+r.sentTo,null)}
  catch(err){b.disabled=false;b.textContent='Remind';say(err.message,true)}
});

// Mark as paid: a sheet asks how they paid (and, for a CIS job, how much CIS came off).
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-paid]');if(!b)return;
  var i=owedData[b.dataset.paid];if(!i)return;
  var cis=i.cis>0;
  var sh=sheet('<h3>Mark as paid</h3><p class="sub">'+esc(i.customer)+(i.number?' · invoice '+esc(i.number):'')+' · '+money(i.balance)+'</p>'+
    (cis?'<label class="f">CIS they took off £<input id="pCis" inputmode="decimal" value="'+i.cis.toFixed(2)+'"></label><div class="split"><div><span>Into your bank</span><b id="pNet"></b></div><div><span>CIS (you claim back)</span><b id="pCisShow"></b></div></div>':'')+
    '<h2 style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 10px">How did they pay?</h2>'+
    '<button class="opt" data-how="bank">'+ICON.bank+'<span>Bank transfer</span></button><button class="opt" data-how="card">'+ICON.card+'<span>Card</span></button><button class="opt" data-how="cash">'+ICON.cash+'<span>Cash<small>Shows as cash to bank until you pay it in</small></span></button>'+
    '<p class="err" id="pErr" style="margin:4px 0 0"></p><button class="cancel" data-close>Cancel</button>');
  function sums(){if(!cis)return;var c=Math.min(Math.max(parseFloat($('pCis').value)||0,0),i.balance);$('pNet').textContent=money(i.balance-c);$('pCisShow').textContent=money(c)}
  if(cis){sums();$('pCis').addEventListener('input',sums)}
  sh.el.addEventListener('click',async function(ev){
    var h=ev.target.closest('[data-how]');if(!h)return;
    var c=cis?Math.max(parseFloat($('pCis').value)||0,0):0;
    sh.el.querySelectorAll('button').forEach(function(x){x.disabled=true});h.querySelector('span').textContent='Saving…';
    try{var r=await api('paid/'+i.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method:h.dataset.how,cis:c})});
      sh.close();delete owedData[i.id];drawOwed(Object.keys(owedData).map(function(k){return owedData[k]}).sort(function(a,b){return b.daysOverdue-a.daysOverdue}));
      toast('✓ '+i.customer+' paid '+money(r.amount||0)+(r.cis?' + '+money(r.cis)+' CIS':''),null);
    }catch(err){sh.el.querySelectorAll('button').forEach(function(x){x.disabled=false});$('pErr').textContent=err.message;loadOwed()}
  });
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

if(!VAT){$('iVat').closest('label').hidden=true;$('iVat').checked=false}
function cisToggle(){var on=$('iCis').checked;$('cisWrap').hidden=!on;$('amtWrap').hidden=on}
$('iCis').addEventListener('change',cisToggle);

// ---- quarter and tidy ----
var quarterData=null;
function loadQuarter(){
  return live('quarter',function(q){quarterData=q;
    $('qDates').textContent=ukDate(q.from)+' to '+ukDate(q.to);$('qIn').textContent=money(q.income);$('qOut').textContent=money(q.expenses);
    $('qDue').textContent='Making Tax Digital update due '+ukDate(q.due)+'. Your accountant sends it from QuickBooks.';
    var bits=[];if(q.toTidy)bits.push(q.toTidy+' to sort');if(q.noReceipt)bits.push(q.noReceipt+' expense'+(q.noReceipt>1?'s':'')+' with no receipt');
    $('qReady').hidden=false;$('qReady').className='ready '+(q.ready?'ok':'no');
    $('qReady').textContent=q.ready?'✓ Ready: everything sorted, every receipt attached.':'Before it goes: '+bits.join(', ')+'.';
  },function(err,had){if(!had)$('qDates').textContent="Couldn't load: "+err.message});
}
// ---- to do (home) ----
async function loadTodo(){
  var items=[];
  var calls=[api('untidy').then(function(l){if(l.length)items.push({tab:'tidy',t:l.length+' expense'+(l.length>1?'s':'')+' to sort',s:'One tap each'})}).catch(function(){}),
    api('owed').then(function(l){var late=l.filter(function(i){return i.daysOverdue>0});if(late.length)items.push({tab:'owed',t:late.length+' invoice'+(late.length>1?'s':'')+' late',s:'Oldest '+late[0].daysOverdue+' days. Tap to remind'})}).catch(function(){})];
  if(QUOTES)calls.push(api('quotes').then(function(l){var c=l.filter(function(q){return q.status==='waiting'&&q.days>=7});if(c.length)items.push({tab:'jobs',t:c.length+' quote'+(c.length>1?'s':'')+' to chase',s:'No answer for a week. One tap'})}).catch(function(){}));
  await Promise.all(calls);
  $('todo').hidden=!items.length;
  var TI={tidy:KIND.tidy,owed:KIND.remind,jobs:KIND.quote};
  $('todoList').innerHTML=items.map(function(i){return '<li data-tab="'+i.tab+'"><span class="av soft" aria-hidden="true">'+(TI[i.tab]||'')+'</span><div class="grow"><b>'+esc(i.t)+'</b><small>'+esc(i.s)+'</small></div><span class="chev">›</span></li>'}).join('');
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
function loadJobs(){
  if(!$('jobList').children.length)$('jobList').innerHTML=skel(3);
  loadQuotes();
  return live('jobs',function(d){
    $('jobList').innerHTML=d.jobs.map(function(j){
      return '<li>'+avatar(j.name)+'<div class="grow"><b>'+esc(j.name)+'</b><small>In '+money(j.in)+' · Costs '+money(j.out)+'</small></div><div class="ends"><span class="amt '+(j.profit<0?'neg':'pos')+'">'+money(j.profit)+'</span>'+(j.in>0?'<span class="pill '+(j.profit<0?'bad':'ok')+'">'+Math.round(j.profit/j.in*100)+'% kept</span>':'')+'</div></li>'}).join('')||'<li><small>No jobs yet. Invoice someone and they show up here.</small></li>';
    if(d.unassigned>0)$('jobList').insertAdjacentHTML('beforeend','<li><div><small>Costs not on a job</small></div><div class="right"><small>'+money(d.unassigned)+'</small></div></li>');
  },function(err,had){if(!had)$('jobList').innerHTML='';say("Couldn't load jobs: "+err.message,true)});
}
function loadQuotes(){
  return live('quotes',function(l){quoteData={};l.forEach(function(q){quoteData[q.id]=q});
    var w=l.filter(function(q){return q.status==='waiting'}),bk=l.filter(function(q){return q.status==='booked'});
    $('quoteEmpty').hidden=w.length>0;$('bookedCard').hidden=!bk.length;
    var info=function(q){return avatar(q.customer)+'<div class="grow"><b>'+esc(q.customer)+'</b><small>'+money(q.total)+(q.description?' · '+esc(q.description):'')+'</small>'+(q.status==='waiting'?'<span class="pill'+(q.days>=7?' bad':'')+'" style="margin-top:4px">'+(q.days?q.days+(q.days===1?' day':' days')+' waiting':'Sent today')+'</span>':'')+'</div>'};
    $('quoteList').innerHTML=w.map(function(q){return '<li class="q tap" data-qt="'+esc(q.id)+'">'+info(q)+'<span class="btns"><button class="go small" data-won="'+esc(q.id)+'">Won</button>'+(q.days>=3?'<button class="ghost small" data-chase="'+esc(q.id)+'">Chase</button>':'')+'</span></li>'}).join('');
    $('bookedList').innerHTML=bk.map(function(q){return '<li class="q" data-q="'+esc(q.id)+'">'+info(q)+'<span class="btns"><button class="go small" data-bill="'+esc(q.id)+'" data-net="'+q.net+'" data-lines="'+q.lines+'">Invoice it</button></span></li>'}).join('');
  },function(err){say("Couldn't load quotes: "+err.message,true)});
}
var quoteData={};
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
  $('tidyList').innerHTML=skel(3);
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
function loadRecent(){
  return live('recent',async function(list){
    if(!custs&&QUOTES)await loadJobsPick();
    $('recent').innerHTML=list.map(function(p){return '<li class="tap" data-exp="'+esc(p.id)+'">'+avatar(p.supplier||'Expense')+'<div class="grow"><b>'+esc(p.supplier||'Expense')+'</b><small>'+esc(ukDate(p.date))+'</small>'+(QUOTES?'<select class="chip" data-setjob="'+esc(p.id)+'" aria-label="Job">'+jobOptions(p.jobId)+'</select>':'')+'</div><div class="ends"><span class="amt">'+money(p.total)+'</span></div></li>'}).join('')||'<li><small>Nothing yet. Snap your first receipt above.</small></li>';
  },function(err,had){if(!had)$('recent').innerHTML='<li><small>Couldn\'t load: '+esc(err.message)+'</small></li>'});
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
  $('check').hidden=true;
  if(!navigator.onLine&&!f.waitId){await park(f);setTimeout(next,300);return}
  say('Reading your receipt…'+(queue.length?' ('+queue.length+' more to go)':''));
  try{
    var data=await shrink(f);$('prev').src=data;$('prev').hidden=false;
    var r=await (await fetch(BASE+'/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:data})})).json();
    if(f.waitId){await unpark(f.waitId);showWaiting()}
    if(r.error)throw new Error(r.error);
    if(!r.readable){say("Couldn't read that one. Try again in better light, with the whole receipt in shot.",true);setTimeout(next,2500);return}
    r.image=data;if(f.waitId)r.jobId=f.jobId||'';var problem=unsure(r);
    if(problem){showCheck(r,data,problem)}else{say('');await autoFile(r);setTimeout(next,600)}
  }catch(err){
    if(noSignal(err)&&!f.waitId){await park(f);setTimeout(next,600);return}
    say('Something went wrong: '+err.message,true);setTimeout(next,2500)}
}

// ---- no signal: receipts wait on the phone (IndexedDB) and go when there's a connection ----
function noSignal(err){return !navigator.onLine||err instanceof TypeError||/Failed to fetch|Load failed|NetworkError|Could not load the PDF/i.test(err&&err.message||'')}
var DB=null;
function db(){return DB||(DB=new Promise(function(ok,no){var r=indexedDB.open('books',1);r.onupgradeneeded=function(){r.result.createObjectStore('wait',{keyPath:'id',autoIncrement:true})};r.onsuccess=function(){ok(r.result)};r.onerror=function(){DB=null;no(r.error)}}))}
function idb(mode,fn){return db().then(function(d){return new Promise(function(ok,no){var q=fn(d.transaction('wait',mode).objectStore('wait'));q.onsuccess=function(){ok(q.result)};q.onerror=function(){no(q.error)}})})}
async function park(f){
  try{await idb('readwrite',function(s){return s.add({file:f,jobId:QUOTES?$('jobPick').value:'',at:Date.now()})});say('No signal. Saved on this phone. It goes to QuickBooks when you have signal.')}
  catch(e){say("No signal, and this phone couldn't save it. Keep the paper receipt and try again later.",true)}
  showWaiting();
}
function unpark(id){return idb('readwrite',function(s){return s.delete(id)}).catch(function(){})}
function waiting(){return idb('readonly',function(s){return s.getAll()}).catch(function(){return []})}
async function showWaiting(){var l=await waiting();$('waitCard').hidden=!l.length;$('waitText').textContent=l.length+' receipt'+(l.length>1?'s':'')+' saved on this phone, waiting for signal.'}
var flushing=false;
async function flush(){
  if(!navigator.onLine||flushing)return;flushing=true;
  var l=await waiting();
  l.forEach(function(w){var f=w.file;f.waitId=w.id;f.jobId=w.jobId;if(!queue.some(function(q){return q.waitId===w.id}))queue.push(f)});
  flushing=false;if(l.length&&$('check').hidden)next();
}
window.addEventListener('online',flush);
$('waitGo').addEventListener('click',function(){if(!navigator.onLine){say('Still no signal on this phone.',true);return}flush()});

// Only stop and ask when something doesn't add up; otherwise file it straight away.
function unsure(r){
  if(!(r.total>0))return "Couldn't find the total.";
  if(!r.supplier)return "Couldn't see who it's from.";
  var d=Date.parse(r.date);if(isNaN(d)||d>Date.now()+86400000||d<Date.now()-730*86400000)return 'The date looks odd.';
  if(VAT&&r.vat>0){var net=r.total-r.vat,rate=net>0?r.vat/net:0;if(!(Math.abs(rate-0.2)<0.02||Math.abs(rate-0.05)<0.01))return "The VAT doesn't add up.";}
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
  if(r.jobId==null)r.jobId=QUOTES?$('jobPick').value:'';
  var out=await api('file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(r)});
  say('');loadRecent();
  if(out.duplicate){toast('Already in QuickBooks: '+(r.supplier||'expense')+' '+money(r.total),null);return}
  toast('✓ '+(r.supplier||'Expense')+' '+money(r.total)+' filed',out.id);
}
function toast(text,id){
  buzz();clearTimeout(toastTimer);lastFiled=id;$('toastText').textContent=text;$('undo').hidden=!id;$('toast').hidden=false;
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

// ---- CIS taken off ----
function loadCis(){return live('cis',function(c){$('cisCard').hidden=!(c.total>0);$('cisTotal').textContent=money(c.total)})}

// ---- what Books changed ----
var SVG=function(d){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>'};
var KIND={file:SVG('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),tidy:SVG('<path d="M4 7h16M4 12h10M4 17h6"/>'),job:SVG('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>'),
  paid:SVG('<path d="m5 12 5 5 9-10"/>'),status:SVG('<path d="M5 12h14M13 6l6 6-6 6"/>'),invoice:SVG('<path d="M7 3h10v18H7z"/><path d="M10 8h4M10 12h4"/>'),quote:SVG('<path d="M7 3h10v18H7z"/><path d="M10 8h4M10 12h4"/>'),
  remind:SVG('<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>'),chase:SVG('<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>')};
async function loadChanges(){
  $('changeList').innerHTML=skel(4);
  try{var l=await api('changes');
    $('changeList').innerHTML=l.map(function(c){
      var when=new Date(c.at).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
      return '<li><span class="av soft" aria-hidden="true">'+(KIND[c.kind]||KIND.file)+'</span><div class="grow"><span class="t'+(c.undone?' undone':'')+'" style="white-space:normal">'+esc(c.text)+'</span><small>'+esc(when)+(c.undone?' · undone':'')+'</small></div>'+(c.canUndo?'<button class="ghost small" data-revert="'+esc(c.id)+'">Undo</button>':'')+'</li>'}).join('')||'<li><small>Nothing yet.</small></li>';
  }catch(err){$('changeList').innerHTML='';say("Couldn't load: "+err.message,true)}
}
document.addEventListener('click',async function(e){
  var b=e.target.closest('[data-revert]');if(!b)return;
  if(!(await ask('Undo this?','Books puts it back the way it was in QuickBooks.','Undo it')))return;
  b.disabled=true;b.textContent='…';
  try{await api('revert/'+b.dataset.revert,{method:'POST'});say('Undone in QuickBooks ✓');loadChanges()}
  catch(err){b.disabled=false;b.textContent='Undo';say(err.message,true)}
});

// ---- mileage ----
function todayIso(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
$('mDate').value=todayIso();
async function loadMiles(){
  try{var d=await api('miles');
    $('mSum').textContent=d.trips.length?(d.miles.toLocaleString('en-GB')+' miles this tax year, worth '+money(d.worth)+' at HMRC rates'):'No trips logged this tax year yet.';
    $('mList').innerHTML=d.trips.slice(-5).reverse().map(function(t){return '<li><span class="av soft" aria-hidden="true">'+SVG('<path d="M5 17h14v-5l-2-5H7l-2 5z"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/>')+'</span><div class="grow"><b>'+esc(t.miles)+' miles'+(t.why?' · '+esc(t.why):'')+'</b><small>'+esc(ukDate(t.date))+' · '+money(t.worth)+'</small></div><button class="ghost small" data-mileoff="'+esc(t.id)+'" aria-label="Delete trip">✕</button></li>'}).join('');
  }catch(err){$('mSum').textContent="Couldn't load mileage: "+err.message}
}
$('mAdd').addEventListener('click',async function(){
  var n=parseFloat($('mMiles').value)||0;if(!(n>0)){say('Put in the miles',true);return}
  $('mAdd').disabled=true;
  try{await api('miles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({miles:n,why:$('mWhy').value,date:$('mDate').value})});
    $('mMiles').value='';$('mWhy').value='';$('mDate').value=todayIso();say(n+' miles logged ✓');loadMiles()}
  catch(err){say(err.message,true)}
  $('mAdd').disabled=false;
});
document.addEventListener('click',async function(e){
  var b=e.target.closest('[data-mileoff]');if(!b)return;
  if(!(await ask('Delete this trip?','It comes off your mileage log.','Delete',true)))return;
  try{await api('mileoff/'+b.dataset.mileoff,{method:'POST'});loadMiles()}catch(err){say(err.message,true)}
});

// ---- chasing ----
$('chase').checked='{{CHASE}}'==='1';
if(QUOTES)$('chaseNote').textContent+=' Quotes too, at 3 and 7 days with no answer. Only customers with an email.';
else $('chaseNote').textContent+=' Only customers with an email.';
$('chase2').checked=$('chase').checked;
async function setChase(on,el){
  [$('chase'),$('chase2')].forEach(function(x){x.disabled=true});
  try{var r=await api('settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({chase:on})});$('chase').checked=$('chase2').checked=r.chase;toast(r.chase?'Books will chase for you. It checks every morning.':'Chasing switched off',null)}
  catch(err){el.checked=!on;say(err.message,true)}
  [$('chase'),$('chase2')].forEach(function(x){x.disabled=false});
}
$('chase').addEventListener('change',function(){setChase($('chase').checked,$('chase'))});
$('chase2').addEventListener('change',function(){setChase($('chase2').checked,$('chase2'))});

// ---- Owed: Owed | Paid | Customers ----
var owView='unpaid';
$('owSeg').addEventListener('click',function(e){var b=e.target.closest('[data-ow]');if(!b)return;owView=b.dataset.ow;
  document.querySelectorAll('[data-ow]').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});loadOwedView()});
function loadOwedView(){
  ['unpaid','paid','cust'].forEach(function(v){$('ow-'+v).hidden=v!==owView});
  if(owView==='unpaid')loadOwed();if(owView==='paid')loadPaid();if(owView==='cust')loadCustomers();
}
function loadPaid(){
  if(!$('paidList').children.length)$('paidList').innerHTML=skel(4);
  return live('invoices?status=paid',function(l){
    $('paidList').innerHTML=l.map(function(i){return '<li class="tap" data-invdoc="'+esc(i.id)+'">'+avatar(i.customer)+'<div class="grow"><b>'+esc(i.customer)+'</b><small>'+(i.number?'Invoice '+esc(i.number)+' · ':'')+esc(ukDate(i.date))+'</small></div><div class="ends"><span class="amt">'+money(i.total)+'</span><span class="pill ok">Paid</span></div></li>'}).join('')||'<li><small>Nothing paid in the last 12 months yet.</small></li>';
  },function(err){say("Couldn't load: "+err.message,true)});
}
var custAll=[];
function loadCustomers(){
  if(!$('custList2').children.length)$('custList2').innerHTML=skel(5);
  return live('customerlist',function(l){custAll=l;drawCustomers()},function(err){say("Couldn't load customers: "+err.message,true)});
}
function drawCustomers(){
  var q=$('cQ').value.trim().toLowerCase(),l=custAll.filter(function(c){return !q||c.name.toLowerCase().indexOf(q)>=0});
  $('custList2').innerHTML=l.map(function(c){return '<li class="tap" data-cust="'+esc(c.id)+'">'+avatar(c.name)+'<div class="grow"><b>'+esc(c.name)+'</b><small>'+(c.last?'Last invoice '+esc(ukDate(c.last)):'No invoices this year')+'</small></div><div class="ends">'+(c.owes>0?'<span class="amt">'+money(c.owes)+'</span><span class="pill bad">Owes</span>':(c.paid>0?'<span class="amt" style="font-size:15px;color:var(--muted)">'+money(c.paid)+'</span><span class="pill">Paid this year</span>':''))+'</div></li>'}).join('')||'<li><small>No customers found.</small></li>';
}
$('cQ').addEventListener('input',drawCustomers);

// Phone numbers for WhatsApp and texts: 07... becomes 447...
function intl(n){var d=String(n||'').replace(/[^\d+]/g,'');if(!d)return '';if(d[0]==='+')return d.slice(1);if(d.slice(0,2)==='00')return d.slice(2);if(d[0]==='0')return '44'+d.slice(1);return d}
var CICON={call:SVG('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),wa:SVG('<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/>'),text:SVG('<path d="M4 5h16v11H8l-4 4z"/>'),mail:SVG('<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>'),share:SVG('<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v7h14v-7"/>'),copy:SVG('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>')};
function contactBtns(phone,email){var p=intl(phone),out='';
  if(p)out+='<a href="tel:+'+p+'">'+CICON.call+'Call</a><a href="https://wa.me/'+p+'" target="_blank" rel="noopener">'+CICON.wa+'WhatsApp</a><a href="sms:+'+p+'">'+CICON.text+'Text</a>';
  if(email)out+='<a href="mailto:'+esc(email)+'">'+CICON.mail+'Email</a>';
  return out?'<div class="contact">'+out+'</div>':'';
}

// ---- customer sheet ----
document.addEventListener('click',async function(e){
  var r=e.target.closest('[data-cust]');if(!r)return;
  var sh=sheet('<div class="skel" style="height:220px"></div>');
  try{var c=await api('customer/'+r.dataset.cust);
    sh.el.innerHTML='<div class="grab"></div><div class="r" style="margin-bottom:14px">'+avatar(c.name)+'<div class="grow"><h3>'+esc(c.name)+'</h3>'+(c.address?'<small>'+esc(c.address)+'</small>':'')+'</div></div>'+
      '<div class="split"><div><span>Owes you</span><b'+(c.owes>0?' class="neg"':'')+'>'+money(c.owes)+'</b></div><div><span>Paid you (all time)</span><b>'+money(c.paid)+'</b></div></div>'+
      contactBtns(c.phone,c.email)+
      (c.invoices.length?'<h2 style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 4px">Invoices</h2><ul>'+c.invoices.map(function(i){return '<li class="tap" data-invdoc="'+esc(i.id)+'"><div class="grow"><b>'+(i.number?'Invoice '+esc(i.number):'Invoice')+'</b><small>'+esc(ukDate(i.date))+'</small></div><div class="ends"><span class="amt" style="font-size:16px">'+money(i.total)+'</span>'+(i.balance>0?'<span class="pill bad">'+money(i.balance)+' to pay</span>':'<span class="pill ok">Paid</span>')+'</div></li>'}).join('')+'</ul>':'')+
      (c.quotes.length?'<h2 style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:14px 0 4px">Quotes</h2><ul>'+c.quotes.map(function(q){return '<li><div class="grow"><b>'+(q.number?'Quote '+esc(q.number):'Quote')+'</b><small>'+esc(ukDate(q.date))+'</small></div><div class="ends"><span class="amt" style="font-size:16px">'+money(q.total)+'</span><span class="pill">'+esc({Pending:'Waiting',Accepted:'Won',Closed:'Invoiced',Rejected:'Lost'}[q.status]||q.status)+'</span></div></li>'}).join('')+'</ul>':'')+
      '<button class="cancel" data-close>Close</button>';
  }catch(err){sh.el.innerHTML='<div class="grab"></div><p class="err">'+esc(err.message)+'</p><button class="cancel" data-close>Close</button>'}
});

// ---- invoice sheet: see it, share it, mark it paid ----
document.addEventListener('click',async function(e){
  var r=e.target.closest('[data-invdoc]'),card=e.target.closest('[data-inv-card]');
  if(card&&!e.target.closest('button'))r={dataset:{invdoc:card.dataset.invCard}};
  if(!r)return;
  var prev=document.querySelector('.scrim');if(prev)prev.remove();
  var sh=sheet('<div class="skel" style="height:260px"></div>');
  try{var d=await api('invoicedoc/'+r.dataset.invdoc);
    var paid=d.balance===0;
    sh.el.innerHTML='<div class="grab"></div><h3>Invoice'+(d.number?' '+esc(d.number):'')+'</h3><p class="sub">'+esc(d.customer)+' · '+esc(ukDate(d.date))+(d.due&&!paid?' · due '+esc(ukDate(d.due)):'')+'</p>'+
      '<div class="lines">'+d.lines.map(function(l){return '<div><span>'+esc(l.description||'Work')+'</span><b>'+money(l.amount)+'</b></div>'}).join('')+
      (d.vat?'<div><span>VAT</span><b>'+money(d.vat)+'</b></div>':'')+'<div class="tot"><span>Total</span><span>'+money(d.total)+'</span></div>'+
      (!paid&&d.balance<d.total?'<div><span>Still to pay</span><b class="neg">'+money(d.balance)+'</b></div>':'')+'</div>'+
      (paid?'<p style="margin:0 0 14px"><span class="pill ok">Paid</span></p>':'')+
      '<button class="go" style="width:100%" data-share="invoice:'+esc(d.id)+'">Send it to '+esc(d.customer.split(' ')[0])+'</button>'+
      (!paid&&owedData[d.id]?'<div class="acts"><button class="ghost" data-paid="'+esc(d.id)+'">Mark as paid</button>'+(d.email?'<button class="ghost" data-remind="'+esc(d.id)+'">Remind by email</button>':'')+'</div>':'')+
      '<button class="cancel" data-close>Close</button>';
  }catch(err){sh.el.innerHTML='<div class="grab"></div><p class="err">'+esc(err.message)+'</p><button class="cancel" data-close>Close</button>'}
});
// The pay sheet opens on top: close the invoice sheet first.
document.addEventListener('click',function(e){var b=e.target.closest('.sheet [data-paid],.sheet [data-remind]');if(b){var s=b.closest('.scrim');setTimeout(function(){if(s)s.remove()},0)}},true);

// ---- quote sheet ----
document.addEventListener('click',function(e){
  var r=e.target.closest('[data-qt]');if(!r||e.target.closest('button'))return;
  var q=quoteData[r.dataset.qt];if(!q)return;
  sheet('<h3>Quote for '+esc(q.customer)+'</h3><p class="sub">'+money(q.total)+(q.description?' · '+esc(q.description):'')+' · '+(q.days?q.days+(q.days===1?' day':' days')+' waiting':'sent today')+'</p>'+
    '<button class="go" style="width:100%" data-share="quote:'+esc(q.id)+'">Send it to '+esc(q.customer.split(' ')[0])+'</button><button class="cancel" data-close>Close</button>');
});

// ---- send an invoice or quote: WhatsApp, text, or anything else on the phone ----
document.addEventListener('click',async function(e){
  var b=e.target.closest('[data-share]');if(!b)return;
  var parts=b.dataset.share.split(':');b.disabled=true;b.textContent='Getting the link…';
  try{var r=await api('share',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:parts[0],id:parts[1]})});
    var biz=document.querySelector('.biz').textContent,first=(r.customer||'').split(' ')[0],what=parts[0]==='quote'?'quote':'invoice';
    var msg='Hi '+first+', here\'s your '+what+(r.number?' '+r.number:'')+' for '+money(r.total)+' from '+biz+': '+r.url;
    var p=intl(r.phone),s=b.closest('.scrim');if(s)s.remove();
    var sh=sheet('<h3>Send the '+what+'</h3><p class="sub">'+esc(r.customer)+(p?' · '+esc(r.phone):'')+'</p>'+
      '<a class="opt" style="text-decoration:none" href="https://wa.me/'+(p||'')+'?text='+encodeURIComponent(msg)+'" target="_blank" rel="noopener">'+CICON.wa+'<span>WhatsApp'+(p?'':'<small>Pick who to send it to</small>')+'</span></a>'+
      '<a class="opt" style="text-decoration:none" href="sms:'+(p?'+'+p:'')+'?&body='+encodeURIComponent(msg)+'">'+CICON.text+'<span>Text message</span></a>'+
      (navigator.share?'<button class="opt" data-native>'+CICON.share+'<span>Other ways</span></button>':'')+
      '<button class="opt" data-copy>'+CICON.copy+'<span>Copy the link</span></button>'+
      '<p class="note" style="margin:4px 0 0">They get a page with the '+what+' and a PDF. <a href="'+esc(r.url)+'" target="_blank" rel="noopener">See it</a></p><button class="cancel" data-close>Done</button>');
    sh.el.addEventListener('click',async function(ev){
      if(ev.target.closest('[data-native]')){try{await navigator.share({title:'Your '+what,text:msg})}catch(x){}}
      if(ev.target.closest('[data-copy]')){try{await navigator.clipboard.writeText(r.url);toast('Link copied',null)}catch(x){say(r.url)}}
    });
  }catch(err){b.disabled=false;b.textContent='Try again';say(err.message,true)}
});

// ---- all expenses ----
var xData=null,xPer='month';
function periodRange(p){
  var d=new Date(),y=d.getFullYear(),m=d.getMonth(),iso=function(x){return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
  if(p==='month')return {from:iso(new Date(y,m,1)),to:iso(d)};
  if(p==='last')return {from:iso(new Date(y,m-1,1)),to:iso(new Date(y,m,0))};
  if(p==='quarter')return {from:iso(new Date(y,m-2,1)),to:iso(d)};
  if(p==='tax'){var ty=(m>3||(m===3&&d.getDate()>=6))?y:y-1;return {from:ty+'-04-06',to:iso(d)}}
  return {from:iso(new Date(y-1,m,d.getDate()+1)),to:iso(d)};
}
$('xPer').addEventListener('click',function(e){var b=e.target.closest('[data-per]');if(!b)return;xPer=b.dataset.per;
  document.querySelectorAll('[data-per]').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});loadExpenses()});
function loadExpenses(){
  var r=periodRange(xPer);$('xList').innerHTML=skel(6);
  return live('expenses?from='+r.from+'&to='+r.to,function(d){xData=d;
    var keep=$('xCat').value;$('xCat').innerHTML='<option value="">All categories</option>'+d.accounts.map(function(a){return '<option>'+esc(a)+'</option>'}).join('');
    if(d.accounts.indexOf(keep)>=0)$('xCat').value=keep;drawExpenses()},function(err){say("Couldn't load expenses: "+err.message,true)});
}
function drawExpenses(){
  if(!xData)return;
  var q=$('xQ').value.trim().toLowerCase(),c=$('xCat').value;
  var l=xData.items.filter(function(i){return (!c||i.account===c)&&(!q||(i.supplier+' '+i.note+' '+i.account+' '+i.job).toLowerCase().indexOf(q)>=0)});
  var tot=l.reduce(function(s,i){return s+i.total},0);
  $('xTotal').textContent=money(tot);
  $('xCount').textContent=l.length+' expense'+(l.length===1?'':'s')+(l.length?' · '+l.filter(function(i){return !i.hasReceipt}).length+' without a receipt':'');
  $('xList').innerHTML=l.map(function(i){return '<li class="tap" data-exp="'+esc(i.id)+'">'+avatar(i.supplier||'Expense')+'<div class="grow"><b>'+esc(i.supplier||'Expense')+'</b><small>'+esc(ukDate(i.date))+(i.account?' · '+esc(i.account):'')+'</small></div><div class="ends"><span class="amt">'+money(i.total)+'</span>'+(i.hasReceipt?'':'<span class="pill">No receipt</span>')+'</div></li>'}).join('')||'<li><small>Nothing found.</small></li>';
}
$('xQ').addEventListener('input',drawExpenses);$('xCat').addEventListener('change',drawExpenses);

// ---- expense sheet: the receipt, the details, and fixing them ----
document.addEventListener('click',async function(e){
  var r=e.target.closest('[data-exp]');if(!r||e.target.closest('select'))return;
  var sh=sheet('<div class="skel" style="height:260px"></div>');
  try{var x=await api('expense/'+r.dataset.exp);drawExpense(sh,x)}
  catch(err){sh.el.innerHTML='<div class="grab"></div><p class="err">'+esc(err.message)+'</p><button class="cancel" data-close>Close</button>'}
});
function drawExpense(sh,x){
  sh.el.innerHTML='<div class="grab"></div>'+(x.hasReceipt?'<img class="rimg" alt="The receipt" src="'+BASE+'/receiptimg/'+esc(x.id)+'">':'')+
    '<h3>'+esc(x.supplier||'Expense')+'</h3><p class="big" style="margin:4px 0 14px">'+money(x.total)+'</p>'+
    '<dl class="kv"><dt>Date</dt><dd>'+esc(ukDate(x.date))+'</dd><dt>Category</dt><dd>'+esc(x.account||'None')+'</dd>'+(VAT?'<dt>VAT</dt><dd>'+money(x.vat)+'</dd>':'')+(x.job?'<dt>Job</dt><dd>'+esc(x.job)+'</dd>':'')+(x.note?'<dt>Note</dt><dd>'+esc(x.note)+'</dd>':'')+
    '<dt>Receipt</dt><dd>'+(x.hasReceipt?'Attached ✓':'None')+'</dd><dt>Added</dt><dd>'+(x.fromApp?'In Books':'In QuickBooks')+'</dd></dl>'+
    (x.editable?'<button class="go" style="width:100%" data-edit>Change it</button>':'<p class="note">This one has more than one line, so change it in QuickBooks.</p>')+
    '<button class="cancel" data-close>Close</button>';
  var ed=sh.el.querySelector('[data-edit]');if(!ed)return;
  ed.addEventListener('click',function(){
    sh.el.innerHTML='<div class="grab"></div><h3>Change this expense</h3><p class="sub">You can undo it after from "What Books changed".</p>'+
      '<label class="f">Supplier<input id="eSup" value="'+esc(x.supplier)+'"></label>'+
      '<div class="grid2"><label class="f">Date<input id="eDate" type="date" value="'+esc(x.date)+'"></label><label class="f">Category<select id="eCat">'+CATS.map(function(c){return '<option'+(c===x.category?' selected':'')+'>'+c+'</option>'}).join('')+'</select></label></div>'+
      '<div class="grid2"><label class="f">Total £<input id="eTot" inputmode="decimal" value="'+x.total.toFixed(2)+'"></label>'+(VAT?'<label class="f">VAT £<input id="eVat" inputmode="decimal" value="'+x.vat.toFixed(2)+'"></label>':'')+'</div>'+
      '<p class="err" id="eErr" style="margin:0 0 8px"></p><button class="go" style="width:100%" id="eSave">Save</button><button class="cancel" data-close>Cancel</button>';
    $('eSave').addEventListener('click',async function(){
      $('eSave').disabled=true;$('eSave').textContent='Saving…';
      try{var out=await api('fix/'+x.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({supplier:$('eSup').value,date:$('eDate').value,category:$('eCat').value,total:parseFloat($('eTot').value)||0,vat:VAT?parseFloat($('eVat').value)||0:0})});
        sh.close();toast('✓ Saved: '+money(out.total),null);if(current==='expenses')loadExpenses();if(current==='receipts')loadRecent();
      }catch(err){$('eErr').textContent=err.message;$('eSave').disabled=false;$('eSave').textContent='Save'}
    });
  });
}

// ---- settings ----
function loadSettings(){
  live('me',function(m){$('stVat').textContent=m.vat?'Yes':'No';if(document.activeElement!==$('stAcct'))$('stAcct').value=m.accountant||'';$('chase').checked=$('chase2').checked=m.chase});
  $('stConn').textContent='Checking QuickBooks…';
  api('status').then(function(s){$('stConn').innerHTML=s.connected?'<span class="pill ok">Connected to QuickBooks ✓</span>'+(s.sandbox?' <span class="pill">Practice company</span>':''):'<span class="pill bad">Not connected</span> Ring Gio'}).catch(function(){$('stConn').textContent="Couldn't check QuickBooks"});
  pushState();
}
$('stAcctGo').addEventListener('click',async function(){
  var em=$('stAcct').value.trim();if(!/.+@.+\..+/.test(em)){say('Put in their email address',true);return}
  try{await api('accountant',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountant:em})});toast('Accountant saved',null)}catch(err){say(err.message,true)}
});
$('logout').addEventListener('click',async function(){
  if(!(await ask('Log out of this phone?','You\'ll need a texted code to log back in.','Log out',true)))return;
  try{await pushOff(true)}catch(e){}
  try{Object.keys(localStorage).forEach(function(k){if(k.indexOf('bk:'+BASE)===0)localStorage.removeItem(k)})}catch(e){}
  await fetch(BASE+'/logout',{method:'POST'}).catch(function(){});location.reload();
});

// ---- notifications ----
var standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
var iPhone=/iPhone|iPad|iPod/.test(navigator.userAgent);
function b64key(s){var p='='.repeat((4-s.length%4)%4),r=atob((s+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(r,function(c){return c.charCodeAt(0)})}
async function pushReg(){if(!('serviceWorker' in navigator)||!('PushManager' in window))return null;return navigator.serviceWorker.ready}
async function pushState(){
  var reg=await pushReg();
  if(!reg){$('pushTog').checked=false;if(iPhone&&!standalone)$('pushNote').textContent='On iPhone, add Books to your Home Screen first, then open it from there to turn these on.';return}
  var sub=await reg.pushManager.getSubscription();$('pushTog').checked=Boolean(sub)&&Notification.permission==='granted';
}
async function pushOn(){
  var reg=await pushReg();
  if(!reg)throw new Error(iPhone&&!standalone?'Add Books to your Home Screen first (Share, then Add to Home Screen), open it from there, then turn this on.':'This phone can\'t do notifications.');
  var perm=await Notification.requestPermission();if(perm!=='granted')throw new Error('Notifications are blocked. Allow them for Books in your phone settings.');
  var key=(await api('pushkey')).key;if(!key)throw new Error('Notifications aren\'t set up yet. Ask Gio.');
  var sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64key(key)});
  await api('push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:sub.toJSON()})});
  await api('pushtest',{method:'POST'});
}
async function pushOff(quiet){
  var reg=await pushReg();if(!reg)return;var sub=await reg.pushManager.getSubscription();if(!sub)return;
  await api('unpush',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})}).catch(function(){});
  await sub.unsubscribe();
}
$('pushTog').addEventListener('change',async function(){
  var on=$('pushTog').checked;$('pushTog').disabled=true;
  try{if(on){await pushOn();toast('Notifications on. A test one is on its way.',null)}else{await pushOff();toast('Notifications off',null)}}
  catch(err){$('pushTog').checked=!on;say(err.message,true)}
  $('pushTog').disabled=false;
});

// ---- pull down to refresh ----
var ptr=null;
document.addEventListener('touchstart',function(e){ptr=(window.scrollY<=0&&!document.querySelector('.scrim'))?{y:e.touches[0].clientY,d:0}:null},{passive:true});
document.addEventListener('touchmove',function(e){if(!ptr)return;ptr.d=e.touches[0].clientY-ptr.y;if(ptr.d>0)$('ptr').style.transform='translateY('+Math.min(ptr.d*0.5,60)+'px) rotate('+ptr.d*2+'deg)'},{passive:true});
document.addEventListener('touchend',function(){
  if(!ptr)return;var go=ptr.d>110;ptr=null;
  if(!go){$('ptr').style.transform='';return}
  $('ptr').style.transform='translateY(56px)';$('ptr').classList.add('spin');buzz();
  try{Object.keys(localStorage).forEach(function(k){if(k.indexOf('bk:'+BASE)===0&&k.indexOf('expenses')<0)localStorage.removeItem(k)})}catch(e){}
  load(current);setTimeout(function(){$('ptr').classList.remove('spin');$('ptr').style.transform=''},900);
});

// ---- swipe an invoice right to mark it paid ----
var sw=null;
document.addEventListener('touchstart',function(e){var c=e.target.closest('[data-inv-card]');sw=c?{c:c,x:e.touches[0].clientX,y:e.touches[0].clientY,dx:0}:null},{passive:true});
document.addEventListener('touchmove',function(e){if(!sw)return;var dx=e.touches[0].clientX-sw.x,dy=e.touches[0].clientY-sw.y;if(Math.abs(dy)>Math.abs(dx)){sw.c.style.transform='';sw=null;return}sw.dx=dx;if(dx>0)sw.c.style.transform='translateX('+Math.min(dx,120)+'px)'},{passive:true});
document.addEventListener('touchend',function(){if(!sw)return;var s=sw;sw=null;s.c.style.transform='';if(s.dx>90){buzz();var b=s.c.querySelector('[data-paid]');if(b)b.click()}});

// ---- VAT: not registered means no VAT on receipts or invoices ----
if(!VAT)$('vat').closest('label').hidden=true;

// ---- getting started ----
try{$('startCard').hidden=Boolean(localStorage.getItem('books-started'))}catch(e){}
$('startDone').addEventListener('click',function(){$('startCard').hidden=true;try{localStorage.setItem('books-started','1')}catch(e){}});

if('serviceWorker' in navigator)navigator.serviceWorker.register(BASE+'/sw.js',{scope:BASE+'/'}).catch(function(){});
var start='home';try{start=localStorage.getItem('books-tab')||'home'}catch(e){}
var want=new URLSearchParams(location.search).get('tab');if(want&&TITLES[want])start=want;
if(location.search)history.replaceState(null,'',location.pathname);
if(start==='settings'||start==='changes')start='home';
show(TITLES[start]?start:'home');
flush();
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
.otp{width:100%;height:68px;border-radius:14px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);font:800 32px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.45em;text-indent:.45em;text-align:center;font-variant-numeric:tabular-nums}
.otp::placeholder{color:var(--line);letter-spacing:.45em}
.otp:focus{outline:none;border-color:var(--hd);box-shadow:0 0 0 3px var(--acc)}
.otp.bad{border-color:var(--stop)}
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
    <p class="lead">Sent to your mobile ending in <b style="color:var(--ink)">{{PHONE_END}}</b>. Tap the box: your phone should offer the code from the text.</p>
    <input class="otp" id="code" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" maxlength="6" placeholder="------" aria-label="6-digit code">
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
async function post(path,body){var r=await fetch(BASE+'/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});var d=await r.json().catch(function(){return {error:'No response'}});if(d.error)throw new Error(d.error);return d}
function draw(){var v=$('code').value.replace(/\D/g,'').slice(0,6);if($('code').value!==v)$('code').value=v;$('code').classList.remove('bad')}
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
  catch(e){$('err').textContent=e.message;$('code').classList.add('bad');$('verify').disabled=false;$('verify').textContent='Log in'}}
$('verify').addEventListener('click',verify);
$('code').addEventListener('input',function(){draw();if($('code').value.length===6)verify()});
// Android Chrome: read the code straight from the text.
function listen(){if(!('OTPCredential' in window))return;navigator.credentials.get({otp:{transport:['sms']}}).then(function(o){if(o&&o.code){$('code').value=o.code;draw();verify()}}).catch(function(){})}
</script></body></html>`;

// A client with no phone number saved can't log in yet.
export const NO_LOGIN = HEAD + String.raw`<style>body{background:var(--hd);min-height:100vh;display:flex;flex-direction:column}.hero{color:#fff;text-align:center;padding:72px 24px 40px}.hero .logo{width:104px;height:104px}.sheet{background:var(--bg);border-radius:28px 28px 0 0;flex:1;padding:28px 20px}.sheet .in{max-width:420px;margin:0 auto}</style>
<div class="hero">{{LOGO}}<p class="biz" style="margin-top:18px">{{NAME}}</p><h1>Books</h1></div>
<div class="sheet"><div class="in"><h2 style="margin:0 0 8px">Nearly ready</h2><p style="margin:0;color:var(--muted)">Your app isn't switched on yet. Ring Gio on <a href="tel:07700900000">07700 900000</a> and he'll sort it.</p><p class="by">Books by Localdesk</p></div></div></body></html>`;
