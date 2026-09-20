#!/usr/bin/env node
// Hidden-tab screenshot collector via the Tobkiri Tabs MCP bridge. Dependency-free.
// Usage: node scripts/browser-shots.mjs <urlfile> <outdir> [--tool <name>] [--full] [--settle ms] [--limit N] [--keep]
// urlfile: one URL per line; optional "<url>\t<pageUrl>" records a different source page. '#' = comment.
// Requires the local bridge running (npm start) and an installed+paired extension with
// "new AI tabs" enabled (browser_status.allowCreate). Tabs stay background — never activated.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [urlfile, outdir, ...rest] = process.argv.slice(2);
if (!urlfile || !outdir) { console.error('usage: browser-shots.mjs <urlfile> <outdir> [--tool n] [--full] [--settle ms] [--limit N] [--keep]'); process.exit(2); }
const opt = {};
for (let i = 0; i < rest.length; i++) { const k = rest[i].replace(/^--/, ''); if (rest[i + 1] !== undefined && !rest[i + 1].startsWith('--')) { opt[k] = rest[++i]; } else opt[k] = true; }
const TOOL = opt.tool || 'unknown';
const FULL = !!opt.full;
const SETTLE = parseInt(opt.settle || '2500', 10);
const LIMIT = parseInt(opt.limit || '0', 10);
const KEEP = !!opt.keep;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const jobs = (await readFile(urlfile, 'utf8')).split(/\r?\n/)
  .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  .map(l => { const [url, page] = l.split('\t'); return { url, pageUrl: page || url }; })
  .slice(0, LIMIT || undefined);
if (!jobs.length) { console.error('no urls in ' + urlfile); process.exit(2); }

// Minimal newline-delimited JSON-RPC client for `src/cli.mjs mcp`.
const proc = spawn(process.execPath, [resolve(root, 'src/cli.mjs'), 'mcp'], { stdio: ['pipe', 'pipe', 'inherit'] });
proc.stdin.on('error', () => {}); // child died mid-write; pending calls reject via the exit handler
let buf = '', nextId = 0; const pending = new Map();
proc.stdout.on('data', d => {
  buf += d; let end;
  while ((end = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, end).trim(); buf = buf.slice(end + 1); if (!line) continue;
    let m; try { m = JSON.parse(line); } catch { continue; }
    if (m.id !== undefined && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); clearTimeout(p.t); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  }
});
proc.on('exit', c => { for (const p of pending.values()) { clearTimeout(p.t); p.rej(new Error('mcp exited (' + c + ')')); } pending.clear(); });
function rpc(method, params, timeoutMs = 90000) {
  const id = ++nextId;
  return new Promise((res, rej) => {
    const t = setTimeout(() => { pending.delete(id); rej(new Error('RPC_TIMEOUT ' + method)); }, timeoutMs);
    pending.set(id, { res, rej, t });
    if (proc.exitCode !== null) { pending.delete(id); clearTimeout(t); rej(new Error('mcp exited')); return; }
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
async function tool(name, args, timeoutMs) {
  const r = await rpc('tools/call', { name, arguments: args }, timeoutMs);
  if (r?.isError) throw new Error((r.content?.find(c => c.type === 'text')?.text) || 'tool error');
  const text = r?.content?.find(c => c.type === 'text')?.text;
  const image = r?.content?.find(c => c.type === 'image');
  return { meta: text ? JSON.parse(text) : null, image };
}

const slugOf = u => { try { const x = new URL(u); return (x.hostname + x.pathname).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'shot'; } catch { return 'shot'; } };

let tabId = null, workspaceId = null;
const errors = []; let ok = 0;
const done = new Set(); // urls that reached a terminal state this run
await mkdir(outdir, { recursive: true });
try {
  await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'dataset-shots', version: '1.0' } });
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n');

  const { meta: status } = await tool('browser_status', {});
  if (!status?.connected) throw new Error('extension not connected to the bridge');
  if (status.enabled === false) throw new Error('extension automation is disabled in the popup');
  if (!status.allowCreate) throw new Error('new-tab creation is off — enable "new AI tabs" in the extension popup first');

  const { meta: ws } = await tool('browser_workspace_create', { name: `dataset-${TOOL}`.slice(0, 80), color: 'grey', url: 'about:blank' });
  workspaceId = ws.workspaceId; tabId = ws.tabId;
  const metaPath = path.join(outdir, 'metadata.jsonl');
  console.log(`workspace ${workspaceId} tab ${tabId}; shooting ${jobs.length} urls → ${outdir}`);

  for (const j of jobs) {
    let navError = null;
    try {
      try {
        await tool('browser_tab_navigate', { tabId, url: j.url, timeoutMs: 20000 });
      } catch (e) {
        if (/gone|closed|no tab/i.test(e.message)) {
          const { meta: t } = await tool('browser_tab_open', { workspaceId, url: j.url });
          tabId = t.tabId;
        } else if (/TIMEOUT|NAVIGATION/i.test(e.message)) {
          // A navigation timeout does not prove the page failed to load — settle and
          // screenshot whatever state the tab reached rather than dropping the sample.
          navError = String(e.message || e);
        } else throw e;
      }
      await sleep(SETTLE);
      const { meta, image } = await tool('browser_screenshot', { tabId, fullPage: FULL, format: 'png' }, 120000);
      if (!image?.data) throw new Error('no image in screenshot result');
      const buf = Buffer.from(image.data, 'base64');
      const file = `${slugOf(j.url)}-${createHash('sha1').update(buf).digest('hex').slice(0, 8)}.png`;
      await writeFile(path.join(outdir, file), buf);
      const rec = { file, bytes: buf.length, contentType: image.mimeType || 'image/png', assetUrl: j.url, pageUrl: j.pageUrl, tool: TOOL, via: 'browser_screenshot', navTimeout: navError, shot: meta ? { width: meta.width, height: meta.height, imagePixels: meta.imagePixels, clipped: meta.clipped, fullPage: meta.fullPage } : null, capturedAt: new Date().toISOString() };
      await appendFile(metaPath, JSON.stringify(rec) + '\n');
      ok++; console.log(`ok ${ok}/${jobs.length} ${j.url}`);
    } catch (e) {
      errors.push({ url: j.url, error: String(e.message || e) });
      console.log(`fail ${j.url}: ${e.message}`);
    }
    done.add(j.url);
  }
} catch (e) {
  // Fatal (setup or mid-run): attribute the failure to every unfinished job so
  // collect.mjs can count attempts instead of retrying silently forever.
  for (const j of jobs) if (!done.has(j.url)) errors.push({ url: j.url, error: String(e.message || e) });
  console.log(`fatal: ${e.message}`);
} finally {
  if (workspaceId && !KEEP) {
    if (tabId) await tool('browser_tab_close', { tabId }).catch(() => {});
    await tool('browser_workspace_release', { workspaceId }).catch(() => {});
  }
  proc.kill();
}
// Always write — collect.mjs treats this file as the authoritative error list for THIS batch.
await writeFile(path.join(outdir, 'errors.json'), JSON.stringify(errors, null, 1));
console.log(`DONE ok=${ok} fail=${errors.length} out=${outdir}`);
process.exit(ok || !errors.length ? 0 : 1);
