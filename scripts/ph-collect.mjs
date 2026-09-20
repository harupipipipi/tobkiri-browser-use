#!/usr/bin/env node
// For each ProductHunt product slug: scrape gallery media, download to dataset/<tool>.
// usage: node scripts/ph-collect.mjs slug:tool [slug:tool ...]
import { execFileSync } from 'node:child_process';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (const arg of process.argv.slice(2)) {
  const [slug, tool] = arg.split(':');
  const pageUrl = `https://www.producthunt.com/products/${slug}`;
  try {
    const res = await fetch(pageUrl, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
    if (!res.ok) { console.error(`${slug}: HTTP ${res.status}`); continue; }
    const t = await res.text();
    const urls = [...new Set([...t.matchAll(/https:\/\/ph-files\.imgix\.net\/[a-f0-9-]+\.(?:png|jpe?g|gif|webp)\?auto=format&(?:amp;)?fit=crop/gi)].map(m => m[0].replace(/&amp;/g, '&')))];
    console.error(`${slug} (${tool}): ${urls.length} gallery imgs`);
    for (const u of urls.slice(0, 8)) {
      const full = u + '&w=1600';
      try {
        execFileSync('node', ['scripts/fetch-asset.mjs', full, `dataset/${tool}`, '--tool', tool, '--page', pageUrl], { stdio: 'pipe' });
        process.stdout.write('.');
      } catch { process.stdout.write('x'); }
      await sleep(400);
    }
    console.error('');
  } catch (e) { console.error(`${slug}: ${e.message}`); }
  await sleep(1200);
}
