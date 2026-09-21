#!/usr/bin/env node
// Rescue SPA-stub sites through the REAL browser via our own `cli.mjs mcp`
// stdio session: hydrated DOM (browser_eval outerHTML) + rendered PDF
// (browser_cdp Page.printToPDF) land directly on disk — nothing transits a
// chat transcript. Reuses one background tab; never activates anything.
// Usage: node scripts/mcp-rescue.mjs <listfile> [--out dataset/blink] [--limit N] [--hydrate-ms 4500]
//   listfile lines: <url>  (tab-separated extra fields ignored)
import { spawn } from 'node:child_process';
import { appendFile, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
let OUT = path.join(ROOT, 'dataset', 'blink'), LIMIT = Infinity, HYDRATE = 4500;
const argv = process.argv.slice(2);
const listfile = argv[0];
for (let i = 1; i < argv.length; i++) {
  if (argv[i] === '--out') OUT = path.resolve(argv[++i]);
  else if (argv[i] === '--limit') LIMIT = +argv[++i] || LIMIT;
  else if (argv[i] === '--hydrate-ms') HYDRATE = +argv[++i] || HYDRATE;
}
if (!listfile) { console.error('usage: mcp-rescue.mjs <listfile> [--out dir] [--limit N] [--hydrate-ms N]'); process.exit(2); }

const urls = (await readFile(listfile, 'utf8')).split('\n').map(l => l.trim().split('\t')[0]).filter(u => /^https?:/.test(u)).slice(0, LIMIT);
const slugOf = u => { try { return new URL(u).hostname.split('.')[0]; } catch { return 'x'; } };
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

const init = new Promise((res, rej) => {
  const t = setInterval(() => { const r = rows.find(r => r.id === 0); if (r) { clearInterval(t); res(r); } }, 50);
});
mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'stub-rescue', version: '0' } } }) + '\n');
await init;
mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
await sleep(300);

await mkdir(OUT, { recursive: true });
const meta = path.join(OUT, 'metadata.jsonl');
const ws = await call('browser_workspace_create', { name: 'stub-rescue', color: 'purple', url: 'about:blank' });
let tabId = ws.tabId;
console.log(`rescue: ${urls.length} urls, tabId=${tabId}`);

let ok = 0, fail = 0, done = 0;
for (const url of urls) {
  const slug = slugOf(url);
  try {
    await call('browser_tab_navigate', { tabId, url });
    await sleep(HYDRATE);
    let saved = 0;
    try {
      const dom = await call('browser_eval', { tabId, expression: 'document.documentElement.outerHTML' });
      const html = dom.value || dom;
      if (typeof html === 'string' && html.length > 3000) {
        const file = slug + '.hydrated.html';
        await appendFile(path.join(OUT, file), html);
        await appendFile(meta, JSON.stringify({ pageUrl: url.split('?')[0] + '/', tool: 'blink', fingerprint: 'blink', file, contentType: 'text/html', rendered: true, via: 'mcp-eval-hydrated', bytes: html.length, capturedAt: new Date().toISOString() }) + '\n');
        saved++;
      }
    } catch (e) { console.log(`  ${slug}: eval ${e.message.slice(0, 60)}`); }
    try {
      const pdf = await call('browser_cdp', { tabId, method: 'Page.printToPDF', params: { printBackground: true } }, 30000);
      if (pdf?.data) {
        const buf = Buffer.from(pdf.data, 'base64');
        const file = slug + '.mcp.pdf';
        await appendFile(path.join(OUT, file), buf);
        await appendFile(meta, JSON.stringify({ pageUrl: url.split('?')[0] + '/', tool: 'blink', fingerprint: 'blink', file, contentType: 'application/pdf', rendered: true, via: 'mcp-printToPDF', bytes: buf.length, capturedAt: new Date().toISOString() }) + '\n');
        saved++;
      }
    } catch (e) { console.log(`  ${slug}: pdf ${e.message.slice(0, 60)}`); }
    saved ? ok++ : fail++;
  } catch (e) {
    fail++;
    console.log(`  ${slug}: ${e.message.slice(0, 80)}`);
    if (/NOT_GRANTED|revoked|expired/i.test(e.message)) {
      try { await call('browser_tab_regrant', { tabId }); }
      catch { try { tabId = (await call('browser_tab_open', { workspaceId: ws.workspaceId, url: 'about:blank' })).tabId; } catch {} }
    }
  }
  if (++done % 10 === 0) console.log(`rescue ${done}/${urls.length} ok=${ok} fail=${fail}`);
}
try { await call('browser_tab_close', { tabId }); await call('browser_workspace_release', { workspaceId: ws.workspaceId }); } catch {}
console.log(`DONE rescued=${ok} failed=${fail}`);
mcp.kill();
