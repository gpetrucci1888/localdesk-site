// Builds everything for the 30-day social calendar from ONE data file, content/social-30-day.json:
//   content/social-30-day.md          the calendar the owner reads (captions per channel, links, briefs)
//   workers/hq/posts-seed-30.js       the same posts for the HQ content queue (drafts only)
//   content/social/tiles/day-NN.png   one 1080x1080 branded image per post (node ops/social_build.mjs --tiles)
// Nothing here posts, schedules or contacts anyone. Run: node ops/social_build.mjs [--tiles]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

export const UTM = { facebook: 'facebook', google: 'gbp' };
export const NAMES = { facebook: 'Facebook Page', google: 'Google Business Profile' };
// Suggested times (UK): weekdays at lunchtime when trades check their phones, weekends mid-morning. Google a quarter of an hour after Facebook.
export const slot = (date, channel) => { const wk = new Date(date + 'T12:00:00Z').getUTCDay(); const base = wk === 0 || wk === 6 ? [9, 0] : [12, 30]; const m = base[1] + (channel === 'google' ? 15 : 0); return `${String(base[0]).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
const PATH = { receptionist: '/receptionist/', books: '/books/', home: '/' };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FOUNDING_RE = /founding|setup waived|free setup/i, DEMO_RE = /talk to her|demo line|talk to mia/i;
const LABEL = { story: 'OUR STORY', problem: 'MISSED CALLS', how: 'HOW IT WORKS', honest: 'HONEST ANSWER', offer: 'FOUNDING PLACES', value: 'TIP', question: 'QUESTION', books: 'BOOKS', demo: 'SEE IT YOURSELF', faq: 'FAQ' };
export const linkFor = (data, post, channel) => `${data.base}${PATH[post.link] || '/'}?utm_source=${UTM[channel]}`;
const platformOf = (ch) => ch.length === 1 ? ch[0] : 'both';
const dow = (date) => DOW[new Date(date + 'T12:00:00Z').getUTCDay()];

export function seedFor(data) {
  return data.posts.map((p, i) => {
    const primary = p.channels[0], text = p.caption.replaceAll('{LINK}', linkFor(data, p, primary));
    const notes = [`Channels: ${p.channels.map(c => NAMES[c]).join(', ')}.`];
    if (p.channels.length > 1) notes.push('Links: the Facebook text uses utm_source=facebook; for Google Business Profile use the same page with utm_source=gbp.');
    notes.push(`Suggested times: ${p.channels.map(c => `${NAMES[c]} ${slot(p.date, c)}`).join(', ')}.`);
    if (p.gbp) notes.push(`Google Business Profile version: ${p.gbp}`);
    if (p.video) notes.push(`Video idea: ${p.video}`);
    if (p.needs_owner) notes.push('Personal or founder wording: the owner must be happy it is true before this goes out.');
    notes.push(`Image: content/social/tiles/day-${String(i + 1).padStart(2, '0')}.png`);
    return { id: p.id, day: i + 1, dow: dow(p.date), title: p.title, text, picture: p.brief, note: notes.join(' '), founding: FOUNDING_RE.test(text), demo: DEMO_RE.test(text), platform: platformOf(p.channels), planned: p.date, status: 'draft', updated: 0 };
  });
}

export function calendarMd(data) {
  const rows = data.posts.map((p, i) => `| ${i + 1} | ${dow(p.date)} ${p.date.slice(8)}/${p.date.slice(5, 7)} | ${p.title} | ${p.channels.map(c => NAMES[c]).join(', ')} | ${p.kind} |`).join('\n');
  const body = data.posts.map((p, i) => {
    const n = String(i + 1).padStart(2, '0');
    const links = p.channels.map(c => `- ${NAMES[c]} at ${slot(p.date, c)}: ${linkFor(data, p, c)}`).join('\n');
    return `### Day ${i + 1}: ${p.title} (${dow(p.date)} ${p.date})\n**Channels:** ${p.channels.map(c => NAMES[c]).join(', ')}${p.needs_owner ? '  \n**Owner check:** personal wording, only if it is true for you.' : ''}\n\n**Facebook caption (use the Facebook link below):**\n\n${p.caption.split('\n').map(l => '> ' + l).join('\n')}\n\n**Links to use:**\n${links}\n\n**Image:** \`content/social/tiles/day-${n}.png\` (text: "${p.tile}"). **Brief:** ${p.brief}\n${p.gbp ? `\n**Google Business Profile version (under 300 characters):** ${p.gbp}\n` : ''}${p.video ? `\n**Optional Facebook video idea:** ${p.video}\n` : ''}`;
  }).join('\n---\n\n');
  return `# 30-day Facebook and Google Business Profile calendar for UK trades (Mon 2 Nov to Tue 1 Dec 2026)

DRAFTS for the owner to approve. Generated from \`content/social-30-day.json\` by \`node ops/social_build.mjs\`: edit that file, not this one. **Nothing is posted or scheduled by anyone but you.** The same posts are in HQ, More, Content, as drafts with planned days.

## Rules every post follows
- Only claims already on the website. No "every call", no "never", no results, savings or customer quotes (there are none yet), no stock photos of fake customers.
- Founding-offer posts (Days 5 and 19) are blocked in HQ once all five founding places are taken, and must not be posted after that. The offer wording is always "while places last".
- **Only the Localdesk Facebook business Page and the Localdesk Google Business Profile.**
- **No prices or costs in any post** (owner rule): no pound amounts, no setup fee, no "free setup", no minimum term. Saying there is a 7-day free trial is fine. HQ will not let a post that mentions cost be approved.
- One call to action per post: book a 15 to 20 minute Zoom, or see the page. Replies and comments are answered by the owner. **Do not message people who have not messaged you first** (the cold-call rules in \`docs/COLD-CALLING-COMPLIANCE.md\` apply to anything that starts a conversation).

## How each post goes out
- **Facebook Page:** the caption as written, with the Facebook link and the image for that day.
- **Google Business Profile:** only on the days that have a short version (14 of the 30, about three a week). Use that text, add the image, and set the button to "Learn more" pointing at the Google link.
- Optional Facebook video: where a video idea is given, 15 to 30 seconds, captions on, no music that needs a licence.
- Only these two accounts are used. No other platform is needed.

## Link tracking
Every link ends \`?utm_source=<channel>\`. When someone fills in the website form from it, the lead in HQ is tagged with that source and HQ Leads shows "Where leads come from". Look at it once a week (see \`docs/SOCIAL-PLAN.md\`).

## The calendar
| Day | Date | Post | Channels | Type |
|---|---|---|---|---|
${rows}

## The posts

${body}`;
}

export function firstBatchMd(data) {
  const wk = data.posts.slice(0, 7), name = (c) => NAMES[c];
  const rows = wk.flatMap(p => p.channels.map(c => `| ${dow(p.date)} ${p.date.slice(8)}/${p.date.slice(5, 7)} ${slot(p.date, c)} | ${name(c)} | ${p.title} | ${p.needs_owner ? 'owner checks wording' : FOUNDING_RE.test(p.caption) ? 'only while founding places remain' : ''} |`)).join('\n');
  const body = wk.map((p, i) => `### ${dow(p.date)} ${p.date}: ${p.title}${p.needs_owner ? '  (founder wording: only if every word is true for you)' : ''}\n**Facebook Page, ${slot(p.date, 'facebook')}:**\n\n${p.caption.replaceAll('{LINK}', linkFor(data, p, 'facebook')).split('\n').map(l => '> ' + l).join('\n')}\n\nImage: \`content/social/tiles/day-${String(i + 1).padStart(2, '0')}.png\`\n${p.gbp ? `\n**Google Business Profile, ${slot(p.date, 'google')}** (button: Learn more, ${linkFor(data, p, 'google')}):\n\n> ${p.gbp}\n` : ''}`).join('\n---\n\n');
  return `# First batch for approval: week 1 (Mon 2 Nov to Sun 8 Nov 2026)

**Accounts:** the Localdesk Facebook business Page and the Localdesk Google Business Profile. No other account.
**Nothing has been scheduled or published.** This is exactly what would go out, and when. Approving it means: schedule these posts at these times on these two accounts, and nothing else. No ads, no spend, no messages to anyone.

| When (UK) | Account | Post | Note |
|---|---|---|---|
${rows}

${body}`;
}

export function seedJs(data) {
  return `// GENERATED by ops/social_build.mjs from content/social-30-day.json. Do not edit by hand. Drafts only: nothing here is ever posted.\nexport const SEED_MORE = ${JSON.stringify(seedFor(data), null, 1)};\n`;
}

const css = (n, theme) => ({ dark: ['#1F2328', '#FFFFFF', '#F5B800', '#A6AFB7'], yellow: ['#F5B800', '#15181C', '#15181C', '#3B3000'], light: ['#F7F8F8', '#15181C', '#1F8A7A', '#566069'] }[theme]);
export function tileHtml(post, i) {
  const theme = ['dark', 'yellow', 'light'][i % 3], [bg, fg, accent, soft] = css(i, theme), len = post.tile.length;
  const size = len <= 26 ? 118 : len <= 40 ? 98 : 82, label = post.kind === 'value' ? 'TIP' : LABEL[post.kind] || 'LOCALDESK';
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0}body{width:1080px;height:1080px;background:${bg};color:${fg};font-family:'Archivo','Inter',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;display:flex;flex-direction:column;justify-content:space-between;padding:84px 84px 72px}
.top{display:flex;align-items:center;gap:16px;font-weight:800;letter-spacing:.2em;font-size:30px}.dot{width:26px;height:26px;border-radius:50%;background:${theme === 'yellow' ? '#15181C' : '#F5B800'}}
.label{display:inline-block;color:${theme === 'dark' ? '#F5B800' : accent};font-weight:800;letter-spacing:.18em;font-size:30px;margin-bottom:28px}
h1{font-size:${size}px;line-height:1.04;letter-spacing:-.03em;font-weight:800;max-width:900px}
.foot{display:flex;justify-content:space-between;align-items:flex-end;font-size:32px;color:${soft};font-weight:600}.bar{height:10px;width:140px;background:${theme === 'yellow' ? '#15181C' : '#F5B800'};border-radius:6px}</style>
<div class="top"><span class="dot"></span>LOCALDESK</div><div><div class="label">${label}</div><h1>${esc(post.tile)}</h1></div><div class="foot"><span class="bar"></span><span>localdeskai.co.uk</span></div>`;
}

export async function renderTiles(data, dir = 'content/social/tiles') {
  const { chromium } = createRequire(import.meta.url)('playwright'); mkdirSync(dir, { recursive: true });
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1080, height: 1080 } });
  for (let i = 0; i < data.posts.length; i++) { await page.setContent(tileHtml(data.posts[i], i)); await page.screenshot({ path: `${dir}/day-${String(i + 1).padStart(2, '0')}.png` }); }
  await b.close();
}

if (process.argv[1] && process.argv[1].endsWith('social_build.mjs')) {
  const data = JSON.parse(readFileSync('content/social-30-day.json', 'utf8'));
  writeFileSync('content/social-30-day.md', calendarMd(data)); writeFileSync('content/first-batch.md', firstBatchMd(data)); writeFileSync('workers/hq/posts-seed-30.js', seedJs(data));
  console.log('wrote content/social-30-day.md, content/first-batch.md and workers/hq/posts-seed-30.js');
  if (process.argv.includes('--tiles')) { await renderTiles(data); console.log(`wrote ${data.posts.length} tiles in content/social/tiles`); }
}
