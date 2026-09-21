#!/usr/bin/env node
// Resolve blink.new project slugs to signed live-preview URLs.
// For each slug, fetches https://blink.new/p/<slug>.md and extracts the "Live URL:" line
// (the signed ?__bpt= blinkusercontent URL). Output is a collect-site.mjs listfile:
//   <live-url>\tblink
// usage: node scripts/blink-resolve.mjs <slugfile> <outfile> [--jobs N] [--skip alreadyfile...]
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const [slugfile, outfile, ...rest] = process.argv.slice(2);
if (!slugfile || !outfile) { console.error('usage: blink-resolve.mjs <slugfile> <outfile> [--jobs N] [--skip f1 f2 ...]'); process.exit(2); }
const opt = { skip: [] };
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--jobs') { opt.jobs = +rest[++i]; continue; }
  if (rest[i] === '--skip') { while (rest[i + 1] && !rest[i + 1].startsWith('--')) opt.skip.push(rest[++i]); continue; }
}
const JOBS = opt.jobs || 6;

const slugs = (await readFile(slugfile, 'utf8')).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const seen = new Set();
for (const f of opt.skip) {
  try {
    for (const l of (await readFile(f, 'utf8')).split(/\r?\n/)) {
      const m = l.match(/https?:\/\/([a-z0-9-]+)\.blinkusercontent\.com/i) || l.trim().match(/^([a-z0-9-]+)$/);
      if (m) seen.add(m[1]);
    }
  } catch {}
}
const todo = slugs.filter(s => !seen.has(s));
console.log(`slugs=${slugs.length} already-seen=${seen.size} todo=${todo.length} jobs=${JOBS}`);

let done = 0, ok = 0;
await writeFile(outfile, '');
async function worker() {
  while (todo.length) {
    const slug = todo.shift();
    try {
      const r = await fetch(`https://blink.new/p/${slug}.md`, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) tobkiri-dataset/1.0' }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) { done++; continue; }
      const t = await r.text();
      const m = t.match(/\*?\*?Live URL:\*?\*?\s*(https:\/\/[a-z0-9-]+\.blinkusercontent\.com\/\?__bpt=\S+)/i);
      if (m) { await appendFile(outfile, `${m[1].replace(/\*+$/, '')}\tblink\n`); ok++; }
    } catch {}
    done++;
    if (done % 200 === 0) console.log(`resolve ${done} ok=${ok}`);
    await new Promise(r => setTimeout(r, 80));
  }
}
await Promise.all(Array.from({ length: JOBS }, worker));
console.log(`DONE resolved=${ok} of ${done}`);
