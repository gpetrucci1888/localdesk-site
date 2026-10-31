// Content approval queue. Posts are drafts until the owner approves them here. Nothing is ever posted automatically:
// the owner (or Meta Business Suite and Google Business Profile, set up by the owner) does the publishing.
import { esc, shell, banner, btn, pill } from './ui.js';
import { SEED_POSTS } from './posts-seed.js';
import { SEED_MORE } from './posts-seed-30.js';

export const FOUNDING_PLACES = 5;
export const STATUSES = ['draft', 'approved', 'scheduled', 'posted', 'rejected'];
const LABEL = { draft: 'Draft', approved: 'Approved', scheduled: 'Scheduled', posted: 'Posted', rejected: 'Rejected' };
const KIND = { draft: 'warn', approved: 'ok', scheduled: 'ok', posted: 'ok', rejected: 'bad' };
// where each status may go next
const MOVES = { draft: ['approved', 'rejected'], approved: ['scheduled', 'posted', 'draft', 'rejected'], scheduled: ['posted', 'approved'], posted: [], rejected: ['draft'] };

const PLATFORMS = { facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', tiktok: 'TikTok', google: 'Google Business Profile', all: 'Several channels (see the note)', both: 'Facebook and Google' };
const FOUNDING_RE = /founding|setup waived|free setup/i, DEMO_RE = /talk to her|demo line|talk to mia/i;
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
export const today = (now = Date.now()) => new Date(now).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });

// A post the owner writes in HQ. It starts as a draft. The founding-offer guard applies to it like any other post.
export function add(posts, { title, text, platform = 'both', planned = '', picture = '' }, now = Date.now()) {
  const t = String(title || '').trim().slice(0, 80), body = String(text || '').replace(/\r/g, '').trim().slice(0, 1500);
  if (t.length < 3) return { error: 'Give the post a short title' };
  if (body.length < 10) return { error: 'The post is too short' };
  if (!PLATFORMS[platform]) return { error: 'Choose Facebook, Google Business Profile or both' };
  if (planned && !isDate(planned)) return { error: 'The date must look like 2026-11-05' };
  if (posts.length >= 200) return { error: 'That is a lot of posts. Remove some old ones first' };
  const id = `x${now.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  posts.push({ id, day: 0, dow: '', title: t, text: body, picture: String(picture || '').trim().slice(0, 200), note: '', founding: FOUNDING_RE.test(body), demo: DEMO_RE.test(body), platform, planned: planned || '', status: 'draft', updated: now, custom: true });
  return { ok: true, id };
}
export function plan(posts, id, { platform, planned }, now = Date.now()) {
  const post = posts.find(p => p.id === id);
  if (!post) return { error: 'No such post' };
  if (post.status === 'posted') return { error: 'That one has already been posted' };
  if (planned !== undefined && planned !== '' && !isDate(planned)) return { error: 'The date must look like 2026-11-05' };
  if (platform !== undefined && platform !== '' && !PLATFORMS[platform]) return { error: 'Choose Facebook, Google Business Profile or both' };
  if (planned !== undefined) post.planned = planned; if (platform) post.platform = platform; post.updated = now;
  return { ok: true };
}
// Approved or scheduled posts whose planned day has come and that are not posted yet (London time).
export const dueToday = (posts, now = Date.now()) => (posts || []).filter(p => p.planned && p.planned <= today(now) && ['approved', 'scheduled'].includes(p.status));
// The 30-day calendar (content/social-30-day.json). Added to the queue once, as drafts, when HQ next opens Content; posts already there are never touched.
export const missingSeeds = (posts) => { const have = new Set((posts || []).map(p => p.id)); return SEED_MORE.filter(p => !have.has(p.id)).map(p => ({ ...p })); };
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
  post.text = t; post.updated = now; post.founding = post.founding || FOUNDING_RE.test(t); post.demo = post.demo || DEMO_RE.test(t);
  if (post.status !== 'rejected') post.status = 'draft'; // any edit needs approving again
  return { ok: true };
}

const card = (p, left) => `<div class="card" id="${esc(p.id)}"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><small class="mute">${p.custom ? 'Your post' : `Day ${p.day} · ${esc(p.dow)}`}${p.planned ? ` · planned ${esc(p.planned)}` : ''}${p.platform ? ` · ${esc(PLATFORMS[p.platform] || '')}` : ''}</small><h2 style="margin:2px 0 8px">${esc(p.title)}</h2></div>${pill(KIND[p.status], LABEL[p.status])}</div>
${p.founding ? `<p class="help"><b>Mentions the founding offer.</b> ${left === null ? 'Founding places could not be checked.' : left > 0 ? `${left} of ${FOUNDING_PLACES} places left. It cannot be approved once they are gone.` : 'No places left, so it cannot be approved.'}</p>` : ''}
${p.demo ? '<p class="help"><b>Mentions the live demo.</b> Only post it while the demo is on the website.</p>' : ''}
<form method="post" action="/content/${esc(p.id)}/save"><textarea name="text" rows="7" style="width:100%" ${p.status === 'posted' ? 'readonly' : ''}>${esc(p.text)}</textarea>${p.status === 'posted' ? '' : '<button class="btn line" style="margin-top:8px">Save changes (needs approving again)</button>'}</form>
${p.status === 'posted' ? '' : `<form method="post" action="/content/${esc(p.id)}/plan" class="stack"><label for="pf-${esc(p.id)}">Where and when</label><select id="pf-${esc(p.id)}" name="platform">${Object.entries(PLATFORMS).map(([k, v]) => `<option value="${k}"${(p.platform || 'both') === k ? ' selected' : ''}>${v}</option>`).join('')}</select><input name="planned" type="date" value="${esc(p.planned || '')}" aria-label="Planned day"><button class="btn line">Save plan</button></form>`}${p.picture ? `<p class="mute"><b>Picture:</b> ${esc(p.picture)}</p>` : ''}${p.note ? `<p class="mute"><b>Note:</b> ${esc(p.note)}</p>` : ''}
<div class="qa" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">${(MOVES[p.status] || []).map(to => `<form method="post" action="/content/${esc(p.id)}/${to}"><button class="btn ${to === 'approved' ? '' : 'line'}">${{ approved: 'Approve', rejected: 'Reject', draft: 'Back to draft', scheduled: 'I scheduled it', posted: 'It is posted' }[to]}</button></form>`).join('')}</div></div>`;

export function pageContent(posts, foundingUsed, flash = '') {
  const left = foundingUsed === null || foundingUsed === undefined ? null : Math.max(0, FOUNDING_PLACES - foundingUsed);
  const by = (s) => posts.filter(p => p.status === s);
  const counts = STATUSES.map(s => `${by(s).length} ${LABEL[s].toLowerCase()}`).join(' · ');
  const order = ['draft', 'approved', 'scheduled', 'posted', 'rejected'];
  return shell('Content', `<div class="ph"><div><h1>Content</h1><p class="lead">Posts for Facebook and Google Business Profile. Write or edit, approve, then plan a day. <b>HQ never posts or schedules anything itself:</b> you schedule it in Meta Business Suite or Google Business Profile, then tick "I scheduled it" and later "It is posted" here.</p></div></div>${flash}
<p class="mute">${esc(counts)}</p>
<div class="card"><h2>Add a post</h2><form method="post" action="/content/new"><label for="nt">Title</label><input id="nt" name="title" maxlength="80" required><label for="nx">Post</label><textarea id="nx" name="text" rows="5" maxlength="1500" required></textarea><label for="np">Where</label><select id="np" name="platform">${Object.entries(PLATFORMS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><label for="nd">Planned day (optional)</label><input id="nd" name="planned" type="date"><label for="ni">Picture idea (optional)</label><input id="ni" name="picture" maxlength="200"><div class="stack"><button class="btn dark">Save as a draft</button></div></form></div>
${order.map(s => by(s).length ? `<h2>${LABEL[s]} (${by(s).length})</h2>${by(s).sort((a, b) => a.day - b.day).map(p => card(p, left)).join('')}` : '').join('')}
${posts.length ? '' : '<div class="card"><p class="mute">No posts yet.</p></div>'}`, '/content');
}
