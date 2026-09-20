// Probe a page's HTML for interesting URLs. Usage: node scripts/probe-page.mjs <url> <outfile>
import { writeFileSync } from 'node:fs';
const [url, out] = process.argv.slice(2);
const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', 'accept-language': 'en-US,en' }, signal: AbortSignal.timeout(30000) });
const t = await r.text();
if (out) writeFileSync(out, t);
console.log('status', r.status, 'len', t.length);
const urls = [...new Set([...t.matchAll(/https?:[^"'\s)<>\\]+/g)].map(m => m[0]))];
const interesting = urls.filter(u => /share|replay|mp4|webm|video|usecase|task/.test(u));
console.log('interesting URLs:', interesting.length);
console.log(interesting.slice(0, 60).join('\n'));
const shares = [...new Set([...t.matchAll(/(?:share|replay)\/[A-Za-z0-9_-]+/g)].map(m => m[0]))];
console.log('share paths:', shares.slice(0, 60).join(', '));
