#!/usr/bin/env node
// Self-feeding loop: extracts "Live URL:" entries from collected .showcase.md
// files, dedups against already-processed hosts in metadata.jsonl, and runs
// collect-site.mjs on each new batch. Repeats until the showcase corpus stops
// yielding new URLs (or --max-hours is hit). Dependency-free.
// Usage: node scripts/blink-feed.mjs [--jobs N] [--interval-min M] [--max-hours H]
import { spawn } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'dataset', 'blink');
const TMP = path.join(ROOT, 'dataset', '_tmp');
const META = path.join(OUT, 'metadata.jsonl');

let JOBS = 6, INTERVAL_MIN = 5, MAX_HOURS = 20;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--jobs') JOBS = +argv[++i] || JOBS;
  else if (argv[i] === '--interval-min') INTERVAL_MIN = +argv[++i] || INTERVAL_MIN;
  else if (argv[i] === '--max-hours') MAX_HOURS = +argv[++i] || MAX_HOURS;
}

const hostOf = u => { try { return new URL(u).hostname; } catch { return null; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function processedHosts() {
  const done = new Set();
  if (existsSync(META)) {
    for (const l of await readFile(META, 'utf8').then(s => s.split('\n'))) {
      if (!l.trim()) continue;
      try { const j = JSON.parse(l); const h = hostOf(j.pageUrl || j.url || ''); if (h) done.add(h); } catch {}
    }
  }
  return done;
}

async function liveUrls() {
  const urls = [];
  for (const f of await readdir(OUT)) {
    if (!f.endsWith('.showcase.md')) continue;
    const m = (await readFile(path.join(OUT, f), 'utf8')).match(/\*\*Live URL:\*\*\s*(\S+)/);
    if (m) urls.push(m[1]);
  }
  return urls;
}

function collect(listfile) {
  return new Promise(resolve => {
    const p = spawn(process.execPath, [path.join(ROOT, 'scripts', 'collect-site.mjs'), listfile, '--no-render', '--jobs', String(JOBS)], { stdio: 'inherit' });
    p.on('exit', () => resolve(p.exitCode ?? 1));
  });
}

const t0 = Date.now();
let round = 0, emptyStreak = 0;
while (Date.now() - t0 < MAX_HOURS * 3600e3) {
  round++;
  const [done, urls] = await Promise.all([processedHosts(), liveUrls()]);
  const fresh = [...new Set(urls)].filter(u => { const h = hostOf(u); return h && !done.has(h); });
  console.log(`[feed] round ${round}: showcase urls=${urls.length} processed=${done.size} fresh=${fresh.length}`);
  if (!fresh.length) {
    if (++emptyStreak >= 3) { console.log('[feed] no new URLs for 3 rounds — done'); break; }
  } else {
    emptyStreak = 0;
    const listfile = path.join(TMP, `blink-feed-${round}.txt`);
    await writeFile(listfile, fresh.map(u => `${u}\tblink`).join('\n') + '\n');
    const code = await collect(listfile);
    console.log(`[feed] round ${round} collect exited ${code}`);
  }
  await sleep(INTERVAL_MIN * 60e3);
}
console.log(`[feed] finished after ${round} rounds`);
