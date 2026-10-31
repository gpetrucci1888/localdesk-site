// Builds a structured request for the GPT reviewer bridge and (optionally) posts it on a pull request.
//   node ops/bridge_request.mjs --type review --topic "founding places" --files docs/ROADMAP.md,workers/books/worker.js --ref stage1-founding --text "What would you challenge?" [--post 6]
// Without --post it only prints the comment, so nothing is sent. Types: review, question, milestone.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { parseRequest } from '../workers/bridge/worker.js';

export function build({ type = 'question', topic = '', files = [], ref, text = '', id } = {}) {
  const header = { v: 1, type, id: id || `${new Date().toISOString().slice(0, 10)}-${randomBytes(4).toString('hex')}`, topic, files, ...(ref ? { ref } : {}) };
  const body = `<!-- claude-request ${JSON.stringify(header)} -->\n${text}`;
  const check = parseRequest(body); if (check.error) throw new Error(check.error);
  return body;
}
if (process.argv[1] && process.argv[1].endsWith('bridge_request.mjs')) {
  const a = Object.fromEntries(process.argv.slice(2).reduce((o, x, i, all) => (x.startsWith('--') ? [...o, [x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : o), []));
  const body = build({ type: a.type, topic: a.topic, files: a.files ? String(a.files).split(',') : [], ref: a.ref, text: a.text || '' });
  if (a.post && a.post !== true) {
    const repo = process.env.GITHUB_REPOSITORY || 'gpetrucci1888/localdesk-site';
    console.log(execFileSync('gh', ['api', `repos/${repo}/issues/${a.post}/comments`, '-f', `body=${body}`, '--jq', '.html_url'], { encoding: 'utf8' }).trim());
  } else console.log(body);
}
