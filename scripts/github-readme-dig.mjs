#!/usr/bin/env node
// Dig AI-artifact URLs out of GitHub READMEs: takes repos already recorded by
// social-harvest (dataset/github-links/metadata.jsonl), fetches each README via
// raw.githubusercontent.com, extracts links to AI-builder hosts, writes a
// collect-site queue. Dependency-free, unauthenticated.
// Usage: node scripts/github-readme-dig.mjs [--queue outfile] [--limit N]
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const META = path.join(ROOT, 'dataset', 'github-links', 'metadata.jsonl');
let QUEUE = path.join(ROOT, 'dataset', '_tmp', 'gh-readme-urls.txt'), LIMIT = Infinity;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--queue') QUEUE = path.resolve(argv[++i]);
  else if (argv[i] === '--limit') LIMIT = +argv[++i] || LIMIT;
}
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) tobkiri-dataset/1.0' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const AI_HOST = /\.(lovable\.app|lovable\.dev|v0\.app|bolt\.host|websim\.com|websim\.ai|trickle\.host|butternut\.ai|framer\.website|create\.xyz|same\.new|replit\.app|base44\.app|durable\.co|mixo\.io|softr\.app|blink\.new|blinkusercontent\.com|magicpath\.app|a0\.dev|tempo\.new|we-web\.io|dora\.run|typedream\.site|webflow\.io|wixsite\.com|10web\.io)|gamma\.app\/|pitch\.com\/|tome\.app|beautiful\.ai|presenton\.ai|slidesai\.io|decktopus\.com|slidebean\.com|canva\.com\/design|prezi\.com|visme\.co|share\.grok\.com|grok\.com\/share|claude\.ai\/share/i;

const repos = new Set();
for (const l of (await readFile(META, 'utf8')).split('\n')) {
  if (!l.trim()) continue;
  try { const j = JSON.parse(l); if (j.name) repos.add(j.name); } catch {}
}
console.log(`repos: ${repos.size}`);
const found = new Map();
let done = 0, fetched = 0;
const BRANCHES = ['main', 'master'];
const NAMES = ['README.md', 'readme.md', 'README.MD', 'Readme.md', 'README.txt', 'README'];
for (const full of [...repos].slice(0, LIMIT)) {
  let got = false;
  for (const br of BRANCHES) {
    for (const nm of NAMES) {
      try {
        const r = await fetch(`https://raw.githubusercontent.com/${full}/${br}/${nm}`, { headers: UA, signal: AbortSignal.timeout(12000) });
        if (!r.ok) continue;
        const t = await r.text();
        fetched++;
        for (const m of t.matchAll(/https?:\/\/[^\s"'<>)\]]+/g)) {
          const u = m[0].replace(/[.,;!?'")\]]+$/, '');
          if (AI_HOST.test(u)) found.set(u, full);
        }
        got = true;
        break;
      } catch {}
    }
    if (got) break;
  }
  if (++done % 100 === 0) console.log(`readme ${done}/${Math.min(repos.size, LIMIT)} found=${found.size}`);
  await sleep(120);
}
const rows = [...found.entries()].map(([u, repo]) => `${u}\tmixed`);
await writeFile(QUEUE, rows.join('\n') + '\n');
await appendFile(path.join(ROOT, 'dataset', 'github-links', 'readme-dig.log'), `${new Date().toISOString()} repos=${done} readmes=${fetched} artifacts=${found.size}\n`);
console.log(`DONE repos=${done} readmes=${fetched} artifacts=${found.size} -> ${QUEUE}`);
