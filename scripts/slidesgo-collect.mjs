#!/usr/bin/env node
// For each slidesgo theme slug: fetch page, extract largest preview images, download to dataset/human.
// usage: node scripts/slidesgo-collect.mjs <slug> [slug...]
import { execFileSync } from 'node:child_process';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let done = 0;
for (const slug of process.argv.slice(2)) {
  const pageUrl = `https://slidesgo.com/theme/${slug}`;
  try {
    const res = await fetch(pageUrl, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
    if (!res.ok) { console.error(`${slug}: HTTP ${res.status}`); continue; }
    const t = await res.text();
    // original-size preview images for this theme
    const imgs = [...new Set([...t.matchAll(/https:\/\/media\.slidesgo\.com\/storage\/\d+\/responsive-images\/[^"'\s]*___media_library_original_1600_900\.jpg/gi)].map(m => m[0]))];
    const fallback = [...new Set([...t.matchAll(/https:\/\/media\.slidesgo\.com\/storage\/\d+\/[^"'\s]*\.jpg/gi)].map(m => m[0]))].filter(u => !u.includes('responsive'));
    const pick = (imgs.length ? imgs : fallback).slice(0, 3);
    console.error(`${slug}: ${pick.length} imgs`);
    for (const u of pick) {
      try { execFileSync('node', ['scripts/fetch-asset.mjs', u, 'dataset/human', '--tool', 'human', '--page', pageUrl], { stdio: 'pipe' }); process.stdout.write('.'); done++; }
      catch { process.stdout.write('x'); }
      await sleep(300);
    }
    console.error('');
  } catch (e) { console.error(`${slug}: ${e.message}`); }
  await sleep(1000);
}
console.error('done=' + done);
