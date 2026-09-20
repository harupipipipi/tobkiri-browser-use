#!/usr/bin/env node
// Asset collector for the AI-design dataset. Dependency-free.
// Usage: node scripts/fetch-asset.mjs <url> <outdir> [--tool <name>] [--page <pageUrl>] [--name <basename>]
// Saves the asset as <outdir>/<hash>.<ext> and appends one JSON line to <outdir>/metadata.jsonl.
import { createHash } from 'node:crypto';
import { writeFile, mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';

const [url, outdir, ...rest] = process.argv.slice(2);
if (!url || !outdir) { console.error('usage: fetch-asset.mjs <url> <outdir> [--tool n] [--page u] [--name b]'); process.exit(2); }
const opt = {};
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'text/html': 'html', 'application/pdf': 'pdf', 'video/mp4': 'mp4' };

try {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) tobkiri-dataset/1.0', accept: '*/*' },
    redirect: 'follow', signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200) throw new Error(`too small (${buf.length}B)`);
  const ct = (res.headers.get('content-type') || '').split(';')[0].trim();
  let ext = EXT[ct] || path.extname(new URL(url).pathname).slice(1) || 'bin';
  if (!/^[a-z0-9]{1,5}$/i.test(ext)) ext = 'bin';
  const hash = createHash('sha1').update(buf).digest('hex').slice(0, 16);
  const base = (opt.name || hash).replace(/[^a-z0-9_.-]/gi, '_').slice(0, 120);
  const file = `${base}.${ext}`;
  await mkdir(outdir, { recursive: true });
  await writeFile(path.join(outdir, file), buf);
  const rec = { file, bytes: buf.length, contentType: ct, assetUrl: url, pageUrl: opt.page || null, tool: opt.tool || 'unknown', capturedAt: new Date().toISOString() };
  await appendFile(path.join(outdir, 'metadata.jsonl'), JSON.stringify(rec) + '\n');
  console.log(JSON.stringify(rec));
} catch (e) {
  console.error(JSON.stringify({ error: String(e.message || e), url }));
  process.exit(1);
}
