#!/usr/bin/env node
// Harvest slidesgo category listing cover images -> dataset/human
// usage: node scripts/slidesgo-cat.mjs <category-url> [more urls]
import { execFileSync } from 'node:child_process';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let done = 0;
for (const pageUrl of process.argv.slice(2)) {
  try {
    const res = await fetch(pageUrl, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
    const t = await res.text();
    // cover images: storage/<id>/<slug>.jpg (not responsive-images), dedupe by id+name
    const covers = [...new Set([...t.matchAll(/https:\/\/media\.slidesgo\.com\/storage\/\d+\/[a-z0-9-]+\d+\.jpg/gi)].map(m => m[0]))];
    console.error(`${pageUrl}: ${covers.length} covers`);
    for (const u of covers) {
      try { execFileSync('node', ['scripts/fetch-asset.mjs', u, 'dataset/human', '--tool', 'human', '--page', pageUrl], { stdio: 'pipe' }); process.stdout.write('.'); done++; }
      catch { process.stdout.write('x'); }
      await sleep(200);
    }
    console.error('');
  } catch (e) { console.error(`${pageUrl}: ${e.message}`); }
  await sleep(1000);
}
console.error('done=' + done);
