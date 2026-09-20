#!/usr/bin/env node
// Probe a page: print status, length, and first N image/asset URLs matching pattern.
// usage: node scripts/probe.mjs <url> [regex] [maxN]
const [url, pat, maxN] = process.argv.slice(2);
const res = await fetch(url, {
  headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', accept: 'text/html,*/*' },
  redirect: 'follow', signal: AbortSignal.timeout(30000),
});
const t = await res.text();
console.log(`status=${res.status} len=${t.length} final=${res.url}`);
const re = new RegExp(pat || 'https://[^"\'\\s<>]+\\.(?:png|jpe?g|webp|gif|pdf)(?:\\?[^"\'\\s<>]*)?', 'gi');
const seen = new Set();
for (const m of t.matchAll(re)) {
  const u = m[0].replace(/&amp;/g, '&');
  if (!seen.has(u)) { seen.add(u); console.log(u); if (seen.size >= (+maxN || 15)) break; }
}
