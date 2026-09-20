#!/usr/bin/env node
// Scrape a page and extract image URLs matching a regex. Prints one URL per line.
// usage: node scripts/scrape-imgs.mjs <url> [regexPattern]
const [url, pat] = process.argv.slice(2);
const res = await fetch(url, {
  headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', accept: 'text/html,*/*' },
  redirect: 'follow', signal: AbortSignal.timeout(30000),
});
const t = await res.text();
const re = new RegExp(pat || 'https://[^"\'\\s<>]+\\.(?:png|jpe?g|webp|gif)(?:\\?[^"\'\\s<>]*)?', 'gi');
const seen = new Set();
for (const m of t.matchAll(re)) {
  let u = m[0].replace(/&amp;/g, '&').replace(/\\u0026/g, '&');
  if (u.length > 15 && !seen.has(u)) { seen.add(u); console.log(u); }
}
console.error('status=' + res.status + ' len=' + t.length + ' imgs=' + seen.size);
