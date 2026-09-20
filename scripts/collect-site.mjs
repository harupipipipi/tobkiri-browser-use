#!/usr/bin/env node
// Batch site collector for the AI-design dataset. Dependency-free.
// For each candidate URL: rendered HTML (Edge --dump-dom), screenshot PNG,
// print PDF, plus og-image/hero images fetched directly. Appends metadata.jsonl.
// Usage: node scripts/collect-site.mjs <listfile> [--jobs N]
//   listfile lines: <url>\t<tool-slug>   (or just <url> -> tool auto-fingerprinted)
import { spawn } from 'node:child_process';
import { writeFile, mkdir, appendFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BROWSER = existsSync(EDGE) ? EDGE : CHROME;
const TMP = path.join(ROOT, 'dataset', '_tmp', 'profiles');

const FINGERPRINTS = [
  [/gpteng|lovable\.app|lovable\.dev|Made with Lovable|__lovable/i, 'lovable'],
  [/v0\.dev|v0\.app|v0-vercel|__v0/i, 'v0'],
  [/bolt\.host|bolt\.new|stackblitz.*bolt|__bolt/i, 'bolt'],
  [/blinkusercontent|blink\.new|__bpt/i, 'blink'],
  [/wegic/i, 'wegic'],
  [/durable\.co|durable-generator/i, 'durable'],
  [/create\.xyz|created\.app|__create/i, 'createxyz'],
  [/same\.new|__same/i, 'samenew'],
  [/framerusercontent|framer\.com/i, 'framer'],
  [/wix\.com|wixstatic/i, 'wix'],
  [/webflow\.io|webflow\.com/i, 'webflow'],
  [/vercel\.app/i, 'vercel'],
  [/netlify\.app/i, 'netlify'],
  [/replit\.app|replit\.dev/i, 'replit'],
  [/we-web|weweb/i, 'weweb'],
  [/softr/i, 'softr'],
  [/base44/i, 'base44'],
  [/tempo\.new|tempo-dev/i, 'tempo'],
  [/magicpath/i, 'magicpath'],
  [/builder\.io/i, 'builderio'],
  [/10web/i, 'tenweb'],
  [/hostinger.*ai|zyro/i, 'hostinger'],
  [/chatgpt\.site|openai.*canvas/i, 'chatgpt'],
  [/grok\.me|xai\.ai|grok\.com/i, 'grok'],
  [/emergent\.host|emergent\.sh/i, 'emergent'],
  [/polsia/i, 'polsia'],
  [/ai\.studio|aistudio|AI Studio|made with google ai studio/i, 'aistudio'],
];

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif', 'text/html': 'html', 'application/pdf': 'pdf', 'video/mp4': 'mp4' };
const slugify = (s) => s.replace(/[^a-z0-9_.-]/gi, '_').replace(/^_+|_+$/g, '').slice(0, 110) || 'site';
const nameFor = (u) => { try { const x = new URL(u); return slugify(x.hostname + (x.pathname === '/' ? '' : x.pathname)); } catch { return 'site'; } };

function fingerprint(html, url) {
  for (const [re, name] of FINGERPRINTS) if (re.test(html)) return name;
  try { const h = new URL(url).hostname; for (const [re, name] of FINGERPRINTS) if (re.test(h)) return name; } catch {}
  return null;
}

function run(url, args, timeout = 60000) {
  return new Promise((resolve) => {
    const p = spawn(url, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => out += d);
    p.stderr.on('data', d => err += d);
    const t = setTimeout(() => { p.kill('SIGKILL'); resolve({ code: -1, out, err: err + ' TIMEOUT' }); }, timeout);
    p.on('close', c => { clearTimeout(t); resolve({ code: c, out, err }); });
    p.on('error', e => { clearTimeout(t); resolve({ code: -1, out, err: String(e) }); });
  });
}

async function fetchBuf(u, timeout = 30000) {
  const res = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) tobkiri-dataset/1.0' }, redirect: 'follow', signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return { buf: Buffer.from(await res.arrayBuffer()), ct: (res.headers.get('content-type') || '').split(';')[0].trim() };
}

async function saveAsset(outdir, file, buf, rec) {
  await writeFile(path.join(outdir, file), buf);
  rec.bytes = buf.length;
  rec.capturedAt = new Date().toISOString();
  await appendFile(path.join(outdir, 'metadata.jsonl'), JSON.stringify(rec) + '\n');
}

function extractImages(html, base) {
  const urls = new Set();
  const push = (v) => { try { const a = new URL(v, base).href; if (/\.(png|jpe?g|webp|gif|avif|svg)(\?|#|$)/i.test(a) || /og\.|image|cdn|media|asset/i.test(a)) urls.add(a); } catch {} };
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|og:image:url|twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)["']/gi)) push(m[1]);
  for (const m of html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/gi)) push(m[1]);
  let n = 0;
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) { if (n++ > 14) break; const s = m[1]; if (!/data:|\.svg$|icon|logo/i.test(s)) push(s); }
  return [...urls].slice(0, 8);
}

async function collect(url, toolHint, worker) {
  const name = nameFor(url);
  // preflight
  let status = 0;
  try { const r = await fetch(url, { method: 'GET', headers: { 'user-agent': 'Mozilla/5.0' }, redirect: 'follow', signal: AbortSignal.timeout(15000) }); status = r.status; await r.body?.cancel(); } catch (e) { return { url, ok: false, why: 'preflight: ' + e.message }; }
  if (status >= 400) return { url, ok: false, why: 'HTTP ' + status };

  const prof = path.join(TMP, 'w' + worker + '-' + Date.now());
  const shot = path.join(TMP, `shot-${worker}.png`);
  const pdf = path.join(TMP, `shot-${worker}.pdf`);
  const rmProf = () => rm(prof, { recursive: true, force: true, maxRetries: 8, retryDelay: 700 }).catch(() => {});
  const r = await run(BROWSER, [
    '--headless', '--disable-gpu', '--disable-extensions', '--no-first-run', '--disable-sync',
    '--hide-scrollbars', '--mute-audio', '--disable-dev-shm-usage',
    '--user-data-dir=' + prof,
    '--window-size=1440,2400', '--virtual-time-budget=16000', '--timeout=45000',
    `--screenshot=${shot}`, `--print-to-pdf=${pdf}`, '--dump-dom', url,
  ], 70000);
  const html = r.out || '';
  if (html.length < 500) { await rmProf(); return { url, ok: false, why: 'dom ' + html.length + 'B ' + (r.err || '').slice(0, 120) }; }

  const BUILDERS = new Set(['lovable', 'v0', 'bolt', 'blink', 'wegic', 'durable', 'createxyz', 'samenew', 'framer', 'wix', 'webflow', 'replit', 'weweb', 'softr', 'base44', 'tempo', 'magicpath', 'builderio', 'tenweb', 'hostinger', 'chatgpt', 'grok', 'emergent', 'polsia', 'aistudio']);
  const detected0 = fingerprint(html, url);
  const tool = (toolHint && toolHint !== 'auto') ? toolHint : (BUILDERS.has(detected0) ? detected0 : 'sites-mixed');
  const outdir = path.join(ROOT, 'dataset', tool);
  await mkdir(outdir, { recursive: true });
  const h = createHash('sha1').update(html).digest('hex').slice(0, 10);
  const base = slugify(name + '-' + h);
  const detected = detected0;
  const common = { pageUrl: url, tool, fingerprint: detected || null };

  await saveAsset(outdir, base + '.html', Buffer.from(html), { ...common, file: base + '.html', contentType: 'text/html', assetUrl: url, rendered: true });
  try { const b = await readFile(shot); if (b.length > 2000) await saveAsset(outdir, base + '.png', b, { ...common, file: base + '.png', contentType: 'image/png', assetUrl: url, kind: 'screenshot' }); } catch {}
  try { const b = await readFile(pdf); if (b.length > 1000) await saveAsset(outdir, base + '.pdf', b, { ...common, file: base + '.pdf', contentType: 'application/pdf', assetUrl: url, kind: 'pdf' }); } catch {}

  let imgs = 0;
  for (const iu of extractImages(html, url)) {
    try {
      const { buf, ct } = await fetchBuf(iu);
      if (buf.length < 800) continue;
      const ext = EXT[ct] || 'bin';
      imgs++;
      await saveAsset(outdir, `${base}-img${imgs}.${ext}`, buf, { ...common, file: `${base}-img${imgs}.${ext}`, contentType: ct, assetUrl: iu, kind: 'image' });
      if (imgs >= 5) break;
    } catch {}
  }
  rmProf();
  return { url, ok: true, tool, dir: tool, bytes: html.length, imgs };
}

const [listfile, ...rest] = process.argv.slice(2);
const opt = {}; for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];
const JOBS = +(opt.jobs || 4);
const lines = (await readFile(listfile, 'utf8')).split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
const tasks = lines.map(l => { const [u, t] = l.split(/\t/); return { url: u.trim(), tool: (t || '').trim() || null }; });

console.log(`collecting ${tasks.length} sites, jobs=${JOBS}`);
let done = 0, ok = 0;
const results = [];
async function worker(w) {
  while (tasks.length) {
    const t = tasks.shift();
    const res = await collect(t.url, t.tool, w);
    results.push(res); done++;
    if (res.ok) { ok++; console.log(`[${done}] OK ${res.tool} ${res.url} (${res.bytes}B html, ${res.imgs} imgs)`); }
    else console.log(`[${done}] FAIL ${res.url} :: ${res.why}`);
  }
}
await Promise.all(Array.from({ length: JOBS }, (_, i) => worker(i)));
await writeFile(path.join(ROOT, 'dataset', '_tmp', 'collect-results.json'), JSON.stringify(results, null, 1));
console.log(`DONE ok=${ok} fail=${done - ok}`);
