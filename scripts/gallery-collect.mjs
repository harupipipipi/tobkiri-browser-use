#!/usr/bin/env node
// Generic: scrape a page for image URLs matching a regex, download each to a dataset dir.
// usage: node scripts/gallery-collect.mjs <pageUrl> <regex> <outdir> <tool> [max] [absBase]
import { execFileSync } from 'node:child_process';
const [pageUrl, pat, outdir, tool, maxN, absBase] = process.argv.slice(2);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const res = await fetch(pageUrl, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
const t = await res.text();
const re = new RegExp(pat, 'gi');
const seen = new Set();
let n = 0;
for (const m of t.matchAll(re)) {
  let u = m[0].replace(/&amp;/g, '&').replace(/[);]+$/, '');
  if (u.startsWith('/')) u = (absBase || new URL(pageUrl).origin) + u;
  if (!/^https?:/.test(u) || seen.has(u)) continue;
  seen.add(u);
  if (seen.size > (+maxN || 30)) break;
}
console.error(`${pageUrl} -> ${seen.size} candidates`);
for (const u of seen) {
  try { execFileSync('node', ['scripts/fetch-asset.mjs', u, outdir, '--tool', tool, '--page', pageUrl], { stdio: 'pipe' }); process.stdout.write('.'); n++; }
  catch { process.stdout.write('x'); }
  await sleep(250);
}
console.error(`\ndone=${n}`);
