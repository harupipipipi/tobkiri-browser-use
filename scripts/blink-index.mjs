#!/usr/bin/env node
// Harvest project slugs from the public blink index: https://blink.new/p/llms.txt?page=N
// Writes NEW slugs (not already in --skip files) to outfile, one per line.
// usage: node scripts/blink-index.mjs <outfile> <firstPage> <lastPage> [--skip file...]
import { appendFile, readFile, writeFile } from 'node:fs/promises';

const [outfile, first, last, ...rest] = process.argv.slice(2);
if (!outfile || !first || !last) { console.error('usage: blink-index.mjs <outfile> <firstPage> <lastPage> [--skip f...]'); process.exit(2); }
const skip = [];
for (let i = 0; i < rest.length; i++) if (rest[i] === '--skip') { while (rest[i + 1] && !rest[i + 1].startsWith('--')) skip.push(rest[++i]); }

const seen = new Set();
for (const f of skip) {
  try { for (const l of (await readFile(f, 'utf8')).split(/\r?\n/)) { const s = l.trim(); if (s) seen.add(s); } } catch {}
}
await writeFile(outfile, '');
let added = 0;
for (let p = +first; p <= +last; p++) {
  try {
    const r = await fetch(`https://blink.new/p/llms.txt?page=${p}`, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) tobkiri-dataset/1.0' }, signal: AbortSignal.timeout(25000) });
    if (!r.ok) { console.log(`page ${p}: HTTP ${r.status}`); continue; }
    const t = await r.text();
    const slugs = [...t.matchAll(/blink\.new\/p\/([a-z0-9-]+)\.md/gi)].map(m => m[1]).filter(s => !seen.has(s));
    for (const s of slugs) seen.add(s);
    if (slugs.length) { await appendFile(outfile, slugs.join('\n') + '\n'); added += slugs.length; }
    console.log(`page ${p}: +${slugs.length} (total new=${added})`);
    await new Promise(r => setTimeout(r, 250));
  } catch (e) { console.log(`page ${p}: ERR ${e.message}`); await new Promise(r => setTimeout(r, 1500)); }
}
console.log(`DONE new slugs=${added}`);
