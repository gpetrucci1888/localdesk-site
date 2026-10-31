// The 30-day social calendar: the data is clean and honest, the generated calendar, queue seed and images match it, and HQ takes the posts in as drafts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { calendarMd, firstBatchMd, seedJs, seedFor, linkFor, tileHtml, slot, UTM } from '../ops/social_build.mjs';
import { missingSeeds } from '../workers/hq/posts.js';
import hq, { Vault, totp } from '../workers/hq/worker.js';
import { MemStorage } from './harness.mjs';

const data = JSON.parse(readFileSync('content/social-30-day.json', 'utf8')), posts = data.posts;

test('30 posts, one a day from Mon 2 Nov 2026, unique ids, only Facebook and Google Business Profile, Google only where a short version exists', () => {
  assert.equal(posts.length, 30); assert.equal(new Set(posts.map(p => p.id)).size, 30);
  posts.forEach((p, i) => { assert.equal(p.id, `m${String(i + 1).padStart(2, '0')}`); assert.equal(p.date, new Date(Date.parse('2026-11-02T12:00:00Z') + i * 86400000).toISOString().slice(0, 10), `day ${i + 1} date`); assert.ok(p.channels[0] === 'facebook' && p.channels.every(c => ['facebook', 'google'].includes(c)), `${p.id}: only Facebook and Google`); assert.equal(p.channels.includes('google'), Boolean(p.gbp), `${p.id}: Google only where there is a short version`); assert.ok(['receptionist', 'books', 'home'].includes(p.link)); });
  assert.equal(new Date(posts[0].date + 'T12:00:00Z').getUTCDay(), 1, 'starts on a Monday');
});

test('honest copy: no absolute claims, no results or testimonials, no contact details, and NO prices or costs anywhere (owner rule), no em dashes', async () => {
  const all = posts.map(p => [p.caption, p.tile, p.gbp || '', p.video || '', p.brief].join('\n')).join('\n').toLowerCase();
  assert.ok(!/\bevery call\b/.test(all), 'banned phrase: every call (every caller is fine)');
  for (const bad of ['never miss', 'never clocks', '24/7', '100%', 'guarantee', 'testimonial', 'customers love', 'we saved', 'saved you', 'best in', 'number one', '#1', 'answers every', 'free forever']) assert.ok(!all.includes(bad), `banned phrase: ${bad}`);
  assert.ok(!all.includes('—')); assert.ok(!/\b0\d{3,4} ?\d{6}\b|\b07\d{3} ?\d{6}\b|@[a-z0-9-]+\.(com|co\.uk)/i.test(all.replace(/hello@localdeskai\.co\.uk/g, '')), 'no phone numbers or other email addresses');
  const { mentionsCost } = await import('../workers/hq/posts.js');
  for (const p of posts) for (const f of ['caption', 'tile', 'gbp', 'video', 'brief', 'title']) if (p[f]) { assert.ok(!mentionsCost(p[f]), `${p.id} ${f} mentions a price or cost`); assert.ok(!/£/.test(p[f]), `${p.id} ${f} has a pound sign`); }
  for (const p of posts) { assert.ok(p.tile.length <= 40, `${p.id} tile too long`); if (p.gbp) assert.ok(p.gbp.length <= 300, `${p.id} Google version over 300 characters`); assert.ok((p.caption.match(/\{LINK\}/g) || []).length <= 1, p.id); }
});

test('founding-offer posts are flagged so HQ blocks them when the five places are used; personal wording is flagged for the owner; offer wording never mentions cost', () => {
  const seeds = seedFor(data);
  for (const p of posts) { const mentions = /founding|setup waived|free setup/i.test(p.caption + (p.gbp || '')); assert.equal(seeds.find(s => s.id === p.id).founding, mentions, `${p.id} founding flag`); if (mentions) { assert.match(p.caption, /while places last/, `${p.id}: offer wording`); assert.ok(!/free setup|£|setup/i.test(p.caption + (p.gbp || '')), `${p.id}: no cost in the offer`); } }
  assert.deepEqual(seeds.filter(s => s.founding).map(s => s.id), ['m05', 'm19']);
  for (const id of ['m01', 'm13', 'm21', 'm29']) assert.ok(posts.find(p => p.id === id).needs_owner, `${id} is personal wording`);
  assert.ok(!posts.some(p => /project manager|I started|I'm a|I've watched/.test(p.caption) && !p.needs_owner), 'every personal-claim post is flagged for the owner');
});

test('only the two real accounts appear anywhere, and about three Google posts a week', () => {
  const md = readFileSync('content/social-30-day.md', 'utf8') + readFileSync('content/first-batch.md', 'utf8') + readFileSync('docs/SOCIAL-PLAN.md', 'utf8');
  assert.ok(!/instagram|tiktok|tik tok|reels/i.test(md.replace(/Meta Business Suite/g, '')), 'no other platform is mentioned in the calendar, the first batch or the plan');
  assert.ok(!/linkedin/i.test(readFileSync('content/social-30-day.md', 'utf8') + readFileSync('content/first-batch.md', 'utf8')));
  assert.equal(posts.filter(p => p.gbp).length, 14); for (let w = 0; w < 4; w++) assert.ok(posts.slice(w * 7, w * 7 + 7).filter(p => p.gbp).length >= 3, `week ${w + 1} has at least three Google posts`);
  assert.equal(slot('2026-11-02', 'facebook'), '12:30'); assert.equal(slot('2026-11-02', 'google'), '12:45'); assert.equal(slot('2026-11-07', 'facebook'), '09:00');
});

test('links carry the channel as utm_source (which the website forms turn into the lead source in HQ)', () => {
  assert.equal(linkFor(data, { link: 'receptionist' }, 'facebook'), 'https://www.localdeskai.co.uk/receptionist/?utm_source=facebook');
  assert.equal(linkFor(data, { link: 'books' }, 'google'), 'https://www.localdeskai.co.uk/books/?utm_source=gbp');
  for (const src of Object.values(UTM)) assert.match(src, /^[a-z0-9_-]{1,20}$/, 'fits the lead-source rule on the Books worker');
  const form = readFileSync('public/receptionist/index.html', 'utf8'); assert.match(form, /utm_source/); assert.match(form, /replace\(\/\[\^a-z0-9_-\]\/g, ''\)\.slice\(0, 20\)/);
});

test('the generated calendar, HQ seed and tiles match the data file (edit the JSON, then run node ops/social_build.mjs --tiles)', () => {
  assert.equal(readFileSync('content/social-30-day.md', 'utf8'), calendarMd(data), 'content/social-30-day.md is out of date');
  assert.equal(readFileSync('workers/hq/posts-seed-30.js', 'utf8'), seedJs(data), 'workers/hq/posts-seed-30.js is out of date');
  assert.equal(readFileSync('content/first-batch.md', 'utf8'), firstBatchMd(data), 'content/first-batch.md is out of date');
  posts.forEach((p, i) => { const f = `content/social/tiles/day-${String(i + 1).padStart(2, '0')}.png`; assert.ok(existsSync(f), f); const b = readFileSync(f); assert.equal(b.readUInt32BE(16), 1080); assert.equal(b.readUInt32BE(20), 1080); assert.ok(tileHtml(p, i).includes(p.tile.replace(/&/g, '&amp;'))); });
});

test('HQ adds the posts to the queue once, as drafts, and never touches posts already there', () => {
  assert.equal(missingSeeds([]).length, 30); assert.equal(missingSeeds([{ id: 'p01' }, { id: 'm05' }]).length, 29); assert.equal(missingSeeds(seedFor(data)).length, 0);
  assert.ok(missingSeeds([]).every(p => p.status === 'draft' && p.planned && p.text && !p.text.includes('{LINK}')));
});

test('HQ Content shows the calendar, routes work for the new ids, the founding guard applies, and drafts raise no Home reminder', async (t) => {
  const storage = new MemStorage(), vault = new Vault({ storage }), stub = { fetch: (u, i) => vault.fetch(new Request(u, i)) }; let used = 2;
  const env = { OWNER_PASSWORD: 'social test passphrase', ADMIN_KEY: 'k', VAULT: { idFromName: () => 'o', get: () => stub }, BOOKS: { fetch: async (url) => { const p = new URL(url).pathname; return p === '/founding' ? Response.json({ places: 5, used, ids: [] }) : p === '/leads' ? Response.json([]) : Response.json({ clients: [] }); } } };
  const call = (path, o = {}) => hq.fetch(new Request('https://hq.test' + path, { method: o.method || 'GET', redirect: 'manual', headers: { ...(o.cookie ? { Cookie: o.cookie } : {}), 'CF-Connecting-IP': '203.0.113.9', ...(o.form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body: o.form ? new URLSearchParams(o.form).toString() : undefined }), env);
  const first = await (await call('/login', { method: 'POST', form: { password: env.OWNER_PASSWORD } })).text(); const key = /class="key">([A-Z2-7]{32})</.exec(first)[1];
  const cookie = ((await call('/login', { method: 'POST', form: { password: env.OWNER_PASSWORD, code: await totp(key, Math.floor(Date.now() / 30000)) } })).headers.get('set-cookie') || '').split(';')[0];
  const page = await (await call('/content', { cookie })).text(); assert.match(page, /Why Localdesk exists/); assert.match(page, /Book a demo/); assert.ok(!/£/.test(page.replace(/<style>[\s\S]*?<\/style>/g, '')), 'no pound sign anywhere on the Content page'); assert.match(page, /planned 2026-11-02/); assert.match(page, /Facebook and Google/); assert.ok(!/Instagram|LinkedIn|TikTok/.test(page.replace(/<option[^>]*>[^<]*<\/option>/g, '')), 'no other platform is shown on the cards');
  assert.equal((await call('/content/m02/approved', { method: 'POST', cookie })).status, 303);
  used = 5; const refused = await call('/content/m05/approved', { method: 'POST', cookie }); assert.equal(refused.status, 400); assert.match(await refused.text(), /founding places are taken/);
  assert.equal((await call('/content/m01/plan', { method: 'POST', cookie, form: { platform: 'both', planned: '2026-11-03' } })).status, 303);
  const home = await (await call('/', { cookie })).text(); assert.ok(!/post.* to put out today/.test(home), 'a draft or a future-dated approved post is not due');
});
