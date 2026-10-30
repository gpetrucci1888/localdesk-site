// Look and layout for the owner HQ: Localdesk branding (charcoal, yellow, Archivo), phone first.
// Pages are plain HTML with no scripts at all, so there is nothing for an attacker to inject into.
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const LOGO = `<svg width="40" height="38" viewBox="-4 -4 228 214" role="img" aria-label="Localdesk logo"><defs><linearGradient id="hqg0" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD23F"/><stop offset="1" stop-color="#F5B800"/></linearGradient><linearGradient id="hqg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD23F"/><stop offset="1" stop-color="#F5B800"/></linearGradient><linearGradient id="hqg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD23F"/><stop offset="1" stop-color="#F5B800"/></linearGradient></defs><circle cx="110" cy="58" r="58" fill="url(#hqg0)" stroke="#1F2328" stroke-width="6"/><g transform="translate(110 55) scale(2.2)"><path d="M-9 3V-1a9 9 0 0 1 18 0V3" fill="none" stroke="#1F2328" stroke-width="2.8" stroke-linecap="round"/><rect x="-12.5" y="-1" width="6" height="11" rx="2.5" fill="#1F2328"/><rect x="6.5" y="-1" width="6" height="11" rx="2.5" fill="#1F2328"/><path d="M9.5 10Q9.5 13 4 13H0" fill="none" stroke="#1F2328" stroke-width="2.4" stroke-linecap="round"/><circle cx="-1" cy="13" r="2" fill="#1F2328"/></g><circle cx="60" cy="144" r="58" fill="url(#hqg1)" stroke="#1F2328" stroke-width="6"/><g transform="translate(60 144) scale(2.2)"><rect x="-12" y="-9.5" width="24" height="21.5" rx="3.6" fill="#1F2328"/><rect x="-7.6" y="-13" width="3.2" height="6.5" rx="1.6" fill="#1F2328"/><rect x="4.4" y="-13" width="3.2" height="6.5" rx="1.6" fill="#1F2328"/><rect x="-12" y="-5" width="24" height="2.4" fill="#F5B800"/><path d="M-5.8 5.2L-1.6 9L6.2 0.8" fill="none" stroke="#F5B800" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></g><circle cx="160" cy="144" r="58" fill="url(#hqg2)" stroke="#1F2328" stroke-width="6"/><g transform="translate(160 146) scale(2.2)"><path d="M-12 -10.5h24a3.5 3.5 0 0 1 3.5 3.5v11a3.5 3.5 0 0 1-3.5 3.5H-1.5L-9 15v-6.5h-3a3.5 3.5 0 0 1-3.5-3.5V-7a3.5 3.5 0 0 1 3.5-3.5Z" fill="#1F2328" transform="scale(.82) translate(0 -1)"/><rect x="-8.5" y="-6.8" width="17" height="2.6" rx="1.3" fill="#F5B800"/><rect x="-8.5" y="-1.8" width="10.5" height="2.6" rx="1.3" fill="#F5B800"/></g></svg>`;

const I = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  home: I('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>'),
  customers: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.8c2 .6 3.1 2.3 3.5 5.2"/>'),
  payments: I('<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>'),
  books: I('<path d="M5 3.5h12.5a1.5 1.5 0 0 1 1.5 1.5v14.5H6.5A2.5 2.5 0 0 0 4 22V5a1.5 1.5 0 0 1 1-1.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H19M9 8h6M9 11.5h6"/>'),
  receptionist: I('<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2.5" y="13" width="4" height="7" rx="1.8"/><rect x="17.5" y="13" width="4" height="7" rx="1.8"/><path d="M19.5 20c0 1.7-1.8 2-4 2h-2"/>'),
  backups: I('<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 9.5z"/><path d="M12 11v6m-2.5-2.5L12 17l2.5-2.5"/>'),
  settings: I('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>'),
  help: I('<circle cx="12" cy="12" r="9.5"/><path d="M9.3 9.3a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2 1-1.2 1.9"/><path d="M12 17.2v.1"/>'),
  more: I('<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>'),
  check: I('<circle cx="12" cy="12" r="9.5"/><path d="M8 12.3l2.7 2.7L16 9.5"/>'),
  alert: I('<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.4v.1"/>'),
  info: I('<circle cx="12" cy="12" r="9.5"/><path d="M12 11v5.5M12 7.8v.1"/>'),
  out: I('<path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9"/><path d="M16 8l4 4-4 4M20 12H9"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  chevron: I('<path d="M9 5l7 7-7 7"/>'),
  external: I('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>'),
};

export const STYLE = `<style>
@font-face{font-family:'Archivo';src:url('/font.woff') format('woff');font-weight:100 900;font-stretch:62% 125%;font-display:swap}
:root{--charcoal:#1F2328;--charcoal2:#2A3038;--yellow:#F5B800;--yellow2:#FFD23F;--paper:#F7F8F8;--concrete:#E9EBED;--steel:#566069;--line:#D6DADE;--white:#fff;--ok:#16794a;--okbg:#E6F4EC;--warn:#8A5A00;--warnbg:#FFF4D6;--bad:#B3361F;--badbg:#FBE9E5;--r:18px}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{font-size:17px}body{margin:0;background:var(--paper);color:var(--charcoal);font-family:'Archivo',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.5;padding-bottom:calc(84px + env(safe-area-inset-bottom))}
a{color:inherit}h1,h2,h3{font-weight:800;line-height:1.2;margin:0}h1{font-size:1.65rem;letter-spacing:-.01em}h2{font-size:1.15rem}h3{font-size:1rem}p{margin:0 0 .7em}
.top{position:sticky;top:0;z-index:5;background:var(--charcoal);color:#fff;display:flex;align-items:center;gap:12px;padding:10px 16px;padding-top:calc(10px + env(safe-area-inset-top))}
.top svg.logo,.side svg.logo{flex:none}.top b{font-size:1.05rem;letter-spacing:.01em}.top b span{color:var(--yellow)}
.page{max-width:760px;margin:0 auto;padding:20px 16px 24px;display:grid;gap:18px}
.lead{color:var(--steel);margin:4px 0 0}
.card{background:var(--white);border:1px solid var(--line);border-radius:var(--r);padding:18px}
.card>h2{margin-bottom:12px}
.banner{display:flex;gap:14px;align-items:flex-start;border-radius:var(--r);padding:16px 18px;border:1px solid}
.banner svg{flex:none;width:28px;height:28px;margin-top:1px}.banner p{margin:0}.banner b{display:block;font-size:1.08rem;margin-bottom:2px}
.banner.ok{background:var(--okbg);border-color:#BFE1CE;color:var(--ok)}.banner.warn{background:var(--warnbg);border-color:#F1D88C;color:var(--warn)}.banner.bad{background:var(--badbg);border-color:#F0C3B9;color:var(--bad)}.banner.info{background:var(--concrete);border-color:var(--line);color:var(--charcoal)}
.banner .btn{margin-top:12px}.banner.ok p,.banner.warn p,.banner.bad p{color:var(--charcoal)}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:12px}.tile{background:var(--white);border:1px solid var(--line);border-radius:var(--r);padding:16px}
.tile b{display:block;font-size:1.8rem;font-weight:800;line-height:1.1;letter-spacing:-.01em}.tile span{color:var(--steel);font-size:.92rem;display:block;margin-top:4px;line-height:1.3}.tile.wide{grid-column:1/-1}
.big{display:grid;grid-template-columns:1fr 1fr;gap:12px}.big a{background:var(--white);border:1px solid var(--line);border-radius:var(--r);padding:16px;text-decoration:none;display:flex;flex-direction:column;gap:6px;min-height:118px;transition:transform .12s,border-color .12s}
.big a:active{transform:scale(.98)}.big a:hover{border-color:var(--yellow)}.big .ic{width:44px;height:44px;border-radius:12px;background:var(--charcoal);color:var(--yellow);display:grid;place-items:center}.big strong{font-size:1.05rem}.big small{color:var(--steel);line-height:1.25;font-size:.88rem}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:12px 22px;border-radius:14px;border:2px solid var(--yellow);background:var(--yellow);color:var(--charcoal);font:inherit;font-weight:800;font-size:1.02rem;text-decoration:none;cursor:pointer;text-align:center}
.btn:hover{background:var(--yellow2)}.btn.dark{background:var(--charcoal);border-color:var(--charcoal);color:#fff}.btn.line{background:transparent;border-color:var(--line);color:var(--charcoal)}.btn.line:hover{border-color:var(--charcoal)}.btn.danger{background:var(--bad);border-color:var(--bad);color:#fff}.btn.block{display:flex;width:100%}.btn svg{width:20px;height:20px}
.stack{display:grid;gap:10px}.row2{display:grid;grid-template-columns:1fr;gap:10px}
.list{display:grid;gap:0}.item{display:flex;align-items:center;gap:14px;padding:14px 4px;border-top:1px solid var(--line);text-decoration:none;color:inherit}.item:first-child{border-top:0}
.item .av{flex:none;width:44px;height:44px;border-radius:50%;background:var(--charcoal);color:var(--yellow);display:grid;place-items:center;font-weight:800}.item .body{flex:1;min-width:0}.item .body b{display:block;overflow-wrap:anywhere}.item .body small{display:block;color:var(--steel);line-height:1.3}.item>svg{flex:none;color:var(--steel);width:20px;height:20px}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:.84rem;font-weight:700;padding:3px 11px;border-radius:99px;white-space:nowrap}.pill.ok{background:var(--okbg);color:var(--ok)}.pill.warn{background:var(--warnbg);color:var(--warn)}.pill.bad{background:var(--badbg);color:var(--bad)}.pill.mute{background:var(--concrete);color:var(--steel)}
.kv{display:grid;gap:0}.kv div{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-top:1px solid var(--line)}.kv div:first-child{border-top:0}.kv span{color:var(--steel)}.kv b{text-align:right;overflow-wrap:anywhere}
label{display:block;font-weight:700;margin:14px 0 6px}label small{display:block;font-weight:400;color:var(--steel)}input,select{font:inherit;font-size:1.05rem;width:100%;min-height:52px;padding:12px 14px;border:2px solid var(--line);border-radius:14px;background:#fff;color:var(--charcoal)}input:focus,select:focus{outline:none;border-color:var(--charcoal)}
.help{color:var(--steel);font-size:.92rem;margin-top:6px}.steps{margin:0;padding-left:1.3em}.steps li{margin:0 0 .6em;padding-left:.2em}.steps li::marker{font-weight:800}
code{background:var(--concrete);padding:3px 8px;border-radius:8px;overflow-wrap:anywhere;font-size:.95em}pre{background:var(--concrete);padding:12px;border-radius:12px;overflow-x:auto}
details{border-top:1px solid var(--line);padding:12px 0}details:first-of-type{border-top:0}summary{font-weight:700;cursor:pointer;min-height:32px}details[open] summary{margin-bottom:8px}
.crumb{display:inline-flex;align-items:center;gap:6px;color:var(--steel);text-decoration:none;font-weight:700;min-height:40px}.crumb svg{transform:rotate(180deg);width:18px;height:18px}
.tabs{position:fixed;left:0;right:0;bottom:0;z-index:6;background:var(--charcoal);display:grid;grid-template-columns:repeat(5,1fr);padding:6px 6px calc(6px + env(safe-area-inset-bottom));border-top:1px solid #000}
.tabs a{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px;color:#ffffffb8;text-decoration:none;font-size:.74rem;font-weight:700;border-radius:12px;min-height:56px;justify-content:center}.tabs a.on{color:var(--yellow)}.tabs a svg{width:25px;height:25px}
.side{display:none}
.center{min-height:100vh;display:grid;place-items:center;padding:20px}.login{width:100%;max-width:420px}.login .brand{display:flex;align-items:center;gap:12px;margin-bottom:18px}.login .brand b{font-size:1.25rem}.login .brand b span{color:var(--yellow)}
.key{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:1.1rem;letter-spacing:.12em;background:var(--concrete);padding:14px;border-radius:12px;overflow-wrap:anywhere;font-weight:700;text-align:center}
.mute{color:var(--steel)}.right{text-align:right}.sp{height:4px}
@media (min-width:900px){body{padding-bottom:0;padding-left:250px}.tabs{display:none}.top{display:none}
 .side{display:flex;flex-direction:column;position:fixed;left:0;top:0;bottom:0;width:250px;background:var(--charcoal);color:#fff;padding:22px 14px;gap:4px}
 .side .brand{display:flex;align-items:center;gap:12px;padding:4px 10px 20px}.side .brand b{font-size:1.15rem}.side .brand b span{color:var(--yellow)}
 .side a,.side button.lo{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;color:#ffffffc8;text-decoration:none;font-weight:700;font:inherit;font-weight:700;background:none;border:0;cursor:pointer;width:100%;text-align:left}
 .side a:hover,.side button.lo:hover{background:#ffffff14;color:#fff}.side a.on{background:var(--yellow);color:var(--charcoal)}.side .grow{flex:1}.side form{margin:0}
 .page{padding:32px 32px 48px;max-width:900px;margin:0}.tiles{grid-template-columns:repeat(3,1fr)}.tile.wide{grid-column:auto}.big{grid-template-columns:repeat(3,1fr)}.row2{grid-template-columns:1fr 1fr}}
</style>`;

const NAV = [
  ['/', 'Home', 'home'], ['/customers', 'Customers', 'customers'], ['/payments', 'Payments', 'payments'], ['/books', 'Books', 'books'],
  ['/receptionist', 'Receptionist', 'receptionist'], ['/backups', 'Backups', 'backups'], ['/settings', 'Settings', 'settings'], ['/docs', 'Help', 'help'],
];
const TABS = [['/', 'Home', 'home'], ['/customers', 'Customers', 'customers'], ['/payments', 'Payments', 'payments'], ['/books', 'Books', 'books'], ['/more', 'More', 'more']];
const MORE = ['/receptionist', '/backups', '/settings', '/docs', '/more'];

const FAVICON = `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='#1F2328'/><circle cx='32' cy='32' r='16' fill='#F5B800'/></svg>`)}">`;
const head = (title) => `<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex"><meta name="theme-color" content="#1F2328"><title>${esc(title)} · Localdesk HQ</title>${FAVICON}${STYLE}`;

export function shell(title, body, path = '', { heading = title } = {}) {
  const on = (p) => p === path || (p !== '/' && path.startsWith(p + '/'));
  const tabOn = (p) => p === '/more' ? MORE.some(m => on(m)) : on(p);
  return `${head(title)}<body>
<header class="top">${LOGO}<b>Localdesk <span>HQ</span></b></header>
<aside class="side"><div class="brand">${LOGO}<b>Localdesk <span>HQ</span></b></div>${NAV.map(([h, t, ic]) => `<a href="${h}"${on(h) ? ' class="on" aria-current="page"' : ''}>${ICON[ic]}${t}</a>`).join('')}<div class="grow"></div><form method="post" action="/logout"><button class="lo">${ICON.out}Log out</button></form></aside>
<main class="page">${body}</main>
<nav class="tabs" aria-label="Main">${TABS.map(([h, t, ic]) => `<a href="${h}"${tabOn(h) ? ' class="on" aria-current="page"' : ''}>${ICON[ic]}${t}</a>`).join('')}</nav></body></html>`;
}
export const bare = (title, body) => `${head(title)}<body><div class="center"><div class="login"><div class="brand">${LOGO}<b>Localdesk <span>HQ</span></b></div><div class="card">${body}</div></div></div></body></html>`;

// building blocks
export const pill = (kind, text) => `<span class="pill ${kind}">${esc(text)}</span>`;
export const banner = (kind, title, text, action = '') => `<div class="banner ${kind}">${ICON[kind === 'ok' ? 'check' : kind === 'info' ? 'info' : 'alert']}<div><b>${esc(title)}</b>${text ? `<p>${text}</p>` : ''}${action}</div></div>`;
export const btn = (href, text, kind = '', ext = false) => `<a class="btn ${kind}" href="${esc(href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(text)}${ext ? ICON.external : ''}</a>`;
export const tile = (value, label, wide = false) => `<div class="tile${wide ? ' wide' : ''}"><b>${value}</b><span>${esc(label)}</span></div>`;
export const bigLink = (href, icon, title, text, ext = false) => `<a href="${esc(href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}><span class="ic">${ICON[icon]}</span><strong>${esc(title)}</strong><small>${esc(text)}</small></a>`;
export const item = (href, name, sub, right = '', ext = false) => `<a class="item" href="${esc(href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}><span class="av">${esc((name || '?').trim().charAt(0).toUpperCase())}</span><span class="body"><b>${esc(name)}</b><small>${sub}</small></span>${right}${ICON.chevron}</a>`;
export const crumb = (href, text) => `<a class="crumb" href="${esc(href)}">${ICON.chevron}${esc(text)}</a>`;
