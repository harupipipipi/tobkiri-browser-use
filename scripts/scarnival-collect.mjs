// Collect SlidesCarnival full-size slide previews (human-made templates).
// Usage: node scripts/scarnival-collect.mjs <tagUrl> <outdir> [max]
import { execFileSync } from 'node:child_process';

const [tagUrl, outdir, maxS = '80'] = process.argv.slice(2);
const max = parseInt(maxS, 10);
const ua = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

const r = await fetch(tagUrl, { headers: ua });
const html = await r.text();
const all = [...html.matchAll(/(?:src|data-src)="(https:\/\/www\.slidescarnival\.com\/wp-content\/uploads\/[^"]+\.(?:png|jpe?g|webp))"/gi)].map(m => m[1]);
// Full-size slides have no WxH suffix like -720x405
const full = [...new Set(all)].filter(u => !/-\d+x\d+\.(png|jpe?g|webp)$/i.test(u));
// Limit per template (group by name without trailing -N)
const byTpl = new Map();
for (const u of full) {
  const key = u.replace(/-\d+\.(png|jpe?g|webp)$/i, '');
  if (!byTpl.has(key)) byTpl.set(key, []);
  byTpl.get(key).push(u);
}
const picked = [];
for (const urls of byTpl.values()) {
  urls.sort();
  picked.push(...urls.slice(0, 4)); // up to 4 slides per template
}
const targets = picked.slice(0, max);
console.log(`templates=${byTpl.size} fullImgs=${full.length} picked=${targets.length}`);

let ok = 0, fail = 0;
for (const u of targets) {
  try {
    execFileSync('node', ['scripts/fetch-asset.mjs', u, outdir, '--tool', 'human', '--page', tagUrl], { stdio: 'pipe' });
    ok++;
  } catch { fail++; }
}
console.log(`done ok=${ok} fail=${fail}`);
