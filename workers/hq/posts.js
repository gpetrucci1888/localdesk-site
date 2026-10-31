// Content approval queue. Posts are drafts until the owner approves them here. Nothing is ever posted automatically:
// the owner (or Meta Business Suite and Google Business Profile, set up by the owner) does the publishing.
import { esc, shell, banner, btn, pill } from './ui.js';
import { SEED_POSTS } from './posts-seed.js';

export const FOUNDING_PLACES = 5;
export const STATUSES = ['draft', 'approved', 'scheduled', 'posted', 'rejected'];
const LABEL = { draft: 'Draft', approved: 'Approved', scheduled: 'Scheduled', posted: 'Posted', rejected: 'Rejected' };
const KIND = { draft: 'warn', approved: 'ok', scheduled: 'ok', posted: 'ok', rejected: 'bad' };
// where each status may go next
const MOVES = { draft: ['approved', 'rejected'], approved: ['scheduled', 'posted', 'draft', 'rejected'], scheduled: ['posted', 'approved'], posted: [], rejected: ['draft'] };

export const seedPosts = () => SEED_POSTS.map(p => ({ ...p, status: 'draft', updated: 0 }));

// Why a post may not move to this status right now, or '' if it may.
// A post that talks about the founding offer cannot be approved, scheduled or posted once all 5 places are taken.
export function blocked(post, to, foundingUsed) {
  if (!MOVES[post.status] || !MOVES[post.status].includes(to)) return `A ${LABEL[post.status] || post.status} post cannot become ${LABEL[to] || to}`;
  if (post.founding && ['approved', 'scheduled', 'posted'].includes(to)) {
    if (foundingUsed === null || foundingUsed === undefined) return 'I cannot check how many founding places are left right now, so this post stays a draft. Try again in a minute.';
    if (foundingUsed >= FOUNDING_PLACES) return `All ${FOUNDING_PLACES} founding places are taken, so a post offering free setup would be wrong. Edit the post to remove the offer, or reject it.`;
  }
  return '';
}

export function move(posts, id, to, foundingUsed, now = Date.now()) {
  const post = posts.find(p => p.id === id);
  if (!post) return { error: 'No such post' };
  const why = blocked(post, to, foundingUsed);
  if (why) return { error: why };
  post.status = to; post.updated = now;
  return { ok: true };
}

export function edit(posts, id, text, now = Date.now()) {
  const post = posts.find(p => p.id === id);
  if (!post) return { error: 'No such post' };
  const t = String(text || '').replace(/\r/g, '').trim().slice(0, 1500);
  if (t.length < 10) return { error: 'The post is too short' };
  if (post.status === 'posted') return { error: 'That one has already been posted' };
  post.text = t; post.updated = now;
  if (post.status !== 'rejected') post.status = 'draft'; // any edit needs approving again
  return { ok: true };
}

const card = (p, left) => `<div class="card" id="${esc(p.id)}"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><small class="mute">Day ${p.day} · ${esc(p.dow)}</small><h2 style="margin:2px 0 8px">${esc(p.title)}</h2></div>${pill(KIND[p.status], LABEL[p.status])}</div>
${p.founding ? `<p class="help"><b>Mentions the founding offer.</b> ${left === null ? 'Founding places could not be checked.' : left > 0 ? `${left} of ${FOUNDING_PLACES} places left. It cannot be approved once they are gone.` : 'No places left, so it cannot be approved.'}</p>` : ''}
${p.demo ? '<p class="help"><b>Mentions the live demo.</b> Only post it while the demo is on the website.</p>' : ''}
<form method="post" action="/content/${esc(p.id)}/save"><textarea name="text" rows="7" style="width:100%" ${p.status === 'posted' ? 'readonly' : ''}>${esc(p.text)}</textarea>${p.status === 'posted' ? '' : '<button class="btn line" style="margin-top:8px">Save changes (needs approving again)</button>'}</form>
${p.picture ? `<p class="mute"><b>Picture:</b> ${esc(p.picture)}</p>` : ''}${p.note ? `<p class="mute"><b>Note:</b> ${esc(p.note)}</p>` : ''}
<div class="qa" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">${(MOVES[p.status] || []).map(to => `<form method="post" action="/content/${esc(p.id)}/${to}"><button class="btn ${to === 'approved' ? '' : 'line'}">${{ approved: 'Approve', rejected: 'Reject', draft: 'Back to draft', scheduled: 'I scheduled it', posted: 'It is posted' }[to]}</button></form>`).join('')}</div></div>`;

export function pageContent(posts, foundingUsed, flash = '') {
  const left = foundingUsed === null || foundingUsed === undefined ? null : Math.max(0, FOUNDING_PLACES - foundingUsed);
  const by = (s) => posts.filter(p => p.status === s);
  const counts = STATUSES.map(s => `${by(s).length} ${LABEL[s].toLowerCase()}`).join(' · ');
  const order = ['draft', 'approved', 'scheduled', 'posted', 'rejected'];
  return shell('Content', `<div class="ph"><div><h1>Content</h1><p class="lead">Posts for Facebook and Google Business Profile. Approve the ones you like. Nothing is posted by HQ: you or Meta Business Suite do that, then tick it off here.</p></div></div>${flash}
<p class="mute">${esc(counts)}</p>
${order.map(s => by(s).length ? `<h2>${LABEL[s]} (${by(s).length})</h2>${by(s).sort((a, b) => a.day - b.day).map(p => card(p, left)).join('')}` : '').join('')}
${posts.length ? '' : '<div class="card"><p class="mute">No posts yet.</p></div>'}`, '/content');
}
