#!/usr/bin/env node
// Fetch a ProductHunt product/launch page, extract gallery media URLs, download via fetch-asset.
// usage: node scripts/ph-gallery.mjs <ph-page-url> <tool-slug>
const [pageUrl, slug] = process.argv.slice(2);
const res = await fetch(pageUrl, {
  headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', accept: 'text/html' },
  redirect: 'follow', signal: AbortSignal.timeout(30000),
});
const t = await res.text();
// gallery media = ph-files URLs with auto=format&fit=crop (no w/h) or the big media list
const urls = [...new Set([...t.matchAll(/https:\/\/ph-files\.imgix\.net\/[a-f0-9-]+\.(?:png|jpe?g|gif|webp)\?auto=format&(?:amp;)?fit=crop/gi)].map(m => m[0].replace(/&amp;/g, '&')))];
console.error(`${slug}: status=${res.status} gallery=${urls.length}`);
console.log(JSON.stringify(urls.slice(0, 8)));
