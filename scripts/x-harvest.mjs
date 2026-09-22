#!/usr/bin/env node
// Harvest tweets mentioning AI-build tools through the REAL logged-in browser
// via our own `cli.mjs mcp` stdio session. One hidden tab, DOM eval extract +
// DOM scroll (never activates, never uses OS input). Tweet JSON + outbound
// artifact links land directly on disk — nothing transits a chat transcript.
// Usage: node scripts/x-harvest.mjs [--queries "a,b"] [--scrolls 25] [--out dataset/twitter]
import { spawn } from 'node:child_process';
import { appendFile, mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
let OUT = path.join(ROOT, 'dataset', 'twitter'), SCROLLS = 25;
let QUERIES = [
  'v0.app', 'websim.com', 'gamma.app', 'lovable.app', 'blink.new',
  'trickle.so', 'bolt.new', 'made with v0', 'built with v0',
  'built with lovable', 'made with gamma', 'websim ai', 'v0 by vercel',
  'AI generated website', 'AI generated slides',
];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--queries') QUERIES = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
  else if (argv[i] === '--scrolls') SCROLLS = +argv[++i] || SCROLLS;
  else if (argv[i] === '--out') OUT = path.resolve(argv[++i]);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const mcp = spawn(process.execPath, [path.join(ROOT, 'src', 'cli.mjs'), 'mcp', '--config', path.join(homedir(), '.tobkiri-tabs', 'config.json')], { cwd: ROOT });
const rows = [];
let buf = '';
mcp.stdout.on('data', c => { buf += c; let n; while ((n = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, n).trim(); buf = buf.slice(n + 1); if (l) { try { rows.push(JSON.parse(l)); } catch {} } } });
mcp.stderr.on('data', c => process.stderr.write(c));
let seq = 0;
const call = async (name, args, timeout = 45000) => {
  const id = ++seq;
  mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }) + '\n');
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const r = rows.find(r => r.id === id);
    if (r) {
      if (r.result?.isError) throw new Error(r.result.content?.[0]?.text || 'tool error');
      const txt = r.result?.content?.[0]?.text;
      return txt ? JSON.parse(txt) : r.result;
    }
    await sleep(80);
  }
  throw new Error('MCP_TIMEOUT');
};
mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'x-harvest', version: '0' } } }) + '\n');
while (!rows.find(r => r.id === 0)) await sleep(80);
mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
await sleep(300);

await mkdir(OUT, { recursive: true });
const urlFile = path.join(ROOT, 'dataset', '_tmp', 'x-artifact-urls.txt');
const ws = await call('browser_workspace_create', { name: 'x-harvest', color: 'purple', url: 'about:blank' });
let tabId = ws.tabId;
console.log(`x-harvest: ${QUERIES.length} queries, scrolls=${SCROLLS}, tabId=${tabId}`);

// Extraction runs inside the granted tab (main world). Returns compact JSON.
const EXTRACT = `JSON.stringify([...document.querySelectorAll('article[data-testid="tweet"]')].map(a=>{
  const t=a.querySelector('time');
  const statusA=t&&t.closest('a[href*="/status/"]');
  const id=statusA?statusA.href.split('/status/')[1].split('/')[0].split('?')[0]:null;
  const nameEl=a.querySelector('[data-testid="User-Name"]');
  const handle=nameEl&&nameEl.querySelector('a[href^="/"]')?nameEl.querySelector('a[href^="/"]').getAttribute('href').slice(1):null;
  const links=[...a.querySelectorAll('a[href]')].map(x=>({href:x.href,text:(x.innerText||'').slice(0,120)})).filter(x=>/^https?:/.test(x.href));
  const imgs=[...a.querySelectorAll('img[src*="pbs.twimg.com/media"]')].map(i=>i.src);
  return {id,handle,time:t?t.getAttribute('datetime'):null,text:(a.querySelector('[data-testid="tweetText"]')||a).innerText.slice(0,1200),links,imgs};
}).filter(t=>t.id))`;

const seen = new Set();
let totalNew = 0;
for (const q of QUERIES) {
  const out = path.join(OUT, `tweets-${q.replace(/[^\w.-]+/g, '_')}.jsonl`);
  try {
    await call('browser_tab_navigate', { tabId, url: `https://x.com/search?q=${encodeURIComponent(q)}&src=typed_query&f=live` });
    await sleep(6000);
    if ((await call('browser_eval', { tabId, expression: 'JSON.stringify({r:/login|i\\/flow/.test(location.href)})' })).value?.includes('true')) {
      console.log(`  ${q}: LOGIN REDIRECT — session not logged in, aborting`);
      break;
    }
    let stale = 0, qNew = 0;
    for (let i = 0; i < SCROLLS && stale < 4; i++) {
      const res = await call('browser_eval', { tabId, expression: EXTRACT });
      let batch = [];
      try { batch = JSON.parse(res.value || '[]'); } catch {}
      const fresh = batch.filter(t => !seen.has(t.id));
      for (const t of fresh) {
        seen.add(t.id); qNew++;
        await appendFile(out, JSON.stringify({ q, ...t }) + '\n');
        for (const l of t.links) {
          const ext = /(?:v0\.app|websim\.com|gamma\.app|lovable\.app|blink\.new|blink\.so|trickle\.so|bolt\.new|netlify\.app|vercel\.app|github\.io|replit\.|framer\.|canva\.|slides|beautiful\.ai|tome\.|decktopus|presentations\.ai)/i.test(l.href + ' ' + l.text);
          if (ext) await appendFile(urlFile, `${l.href}\t${q}\ttweet:${t.id}\n`);
        }
      }
      stale = fresh.length ? 0 : stale + 1;
      await call('browser_eval', { tabId, expression: 'window.scrollBy(0, 5000), "ok"' });
      await sleep(2600);
    }
    totalNew += qNew;
    console.log(`  ${q}: +${qNew} tweets (seen=${seen.size})`);
    await sleep(3000);
  } catch (e) {
    console.log(`  ${q}: ${e.message.slice(0, 90)}`);
    if (/NOT_GRANTED|revoked|expired/i.test(e.message)) {
      try { await call('browser_tab_regrant', { tabId }); }
      catch { try { tabId = (await call('browser_tab_open', { workspaceId: ws.workspaceId, url: 'about:blank' })).tabId; } catch {} }
    }
  }
}
try { await call('browser_tab_close', { tabId }); await call('browser_workspace_release', { workspaceId: ws.workspaceId }); } catch {}
console.log(`DONE queries=${QUERIES.length} tweets=${totalNew} unique=${seen.size}`);

// Media resolver pass: hidden tabs never hydrate X lazy media
// (document.visibilityState=hidden -> IntersectionObserver gated imgs stay
// placeholders). Resolve media URLs via api.fxtwitter.com instead — public,
// no auth, returns pbs.twimg.com media links for the tweet id.
const allTweets = [];
for (const f of await readdir(OUT).catch(() => [])) {
  if (!f.endsWith('.jsonl') || !f.startsWith('tweets-')) continue;
  for (const l of (await readFile(path.join(OUT, f), 'utf8')).trim().split('\n')) {
    try { allTweets.push(JSON.parse(l)); } catch {}
  }
}
const photoTweets = allTweets.filter(t => (t.links || []).some(x => /\/photo\/\d/.test(x.href)));
const mediaOut = path.join(OUT, 'media.jsonl');
const haveMedia = new Set();
try { for (const l of (await readFile(mediaOut, 'utf8')).trim().split('\n')) haveMedia.add(JSON.parse(l).id); } catch {}
let resolved = 0, mediaUrls = 0;
for (const t of photoTweets) {
  if (haveMedia.has(t.id)) continue;
  try {
    const j = await fetch(`https://api.fxtwitter.com/status/${t.id}`).then(r => r.json());
    const photos = (j.tweet?.media?.photos || []).map(p => p.url);
    const videos = (j.tweet?.media?.videos || []).map(v => v.url);
    if (photos.length || videos.length) {
      await appendFile(mediaOut, JSON.stringify({ id: t.id, handle: t.handle, q: t.q, text: (t.text || '').slice(0, 400), photos, videos }) + '\n');
      resolved++; mediaUrls += photos.length + videos.length;
    }
  } catch {}
  await sleep(350); // polite rate
}
console.log(`media: resolved ${resolved}/${photoTweets.length} photo tweets, ${mediaUrls} media urls`);
mcp.kill();
