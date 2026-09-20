#!/usr/bin/env node
// Continuous collector for the AI-design dataset. Dependency-free.
// Usage: node scripts/collect.mjs [--sources scripts/sources.json] [--dataset dataset]
//   [--only t1,t2] [--per-tool N] [--interval sec] [--until ISO] [--max-rounds N]
//   [--exit-when-empty] [--dry-run]
//
// Queues: sources.json `tools.<name>.urls` plus append-only files
// dataset/_work/queues/<name>.txt (one URL per line; "url\tpageUrl" allowed; '#' comments).
// PM/discovery agents keep the queues fed; this runner drains them with dedup.
// State: dataset/_work/seen/<name>.txt (captured URLs), dataset/_work/failed/<name>.json
// ({url: {attempts,lastError}} — retried up to 3×). Logs to dataset/_work/collector.log.
import { spawnSync } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) { const k = args[i].replace(/^--/, ''); if (args[i + 1] !== undefined && !args[i + 1].startsWith('--')) opt[k] = args[++i]; else opt[k] = true; }

const SRC = resolve(root, opt.sources || 'scripts/sources.json');
const DATASET = resolve(root, opt.dataset || 'dataset');
const ONLY = opt.only ? String(opt.only).split(',') : null;
const PER = parseInt(opt['per-tool'] || '10', 10);
const INTERVAL = parseInt(opt.interval || '60', 10) * 1000;
const UNTIL = opt.until ? Date.parse(opt.until) : null;
const MAXROUNDS = parseInt(opt['max-rounds'] || '0', 10);
const EXIT_EMPTY = !!opt['exit-when-empty'];
const DRY = !!opt['dry-run'];
const MAX_ATTEMPTS = 3;

const work = (...p) => resolve(DATASET, '_work', ...p);
const sources = JSON.parse(await readFile(SRC, 'utf8'));
const tools = Object.entries(sources.tools || {}).filter(([n]) => !ONLY || ONLY.includes(n));
if (!tools.length) { console.error('no matching tools in ' + SRC); process.exit(2); }

const readLines = async f => { try { return (await readFile(f, 'utf8')).split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')); } catch { return []; } };
const loadJson = async f => { try { return JSON.parse(await readFile(f, 'utf8')); } catch { return {}; } };
async function log(msg) { const line = `${new Date().toISOString()} ${msg}`; console.log(line); if (!DRY) { await mkdir(work(), { recursive: true }); await appendFile(work('collector.log'), line + '\n'); } }
const sleep = ms => new Promise(r => setTimeout(r, ms));

let round = 0;
for (;;) {
  round++;
  let didWork = false;
  for (const [name, cfg] of tools) {
    const mode = cfg.mode || 'fetch';
    const queueRaw = [...(cfg.urls || []), ...(await readLines(work('queues', name + '.txt')))];
    const seenSet = new Set(await readLines(work('seen', name + '.txt')));
    const failed = await loadJson(work('failed', name + '.json'));
    const pending = queueRaw.map(l => l.split('\t')).map(([url, page]) => ({ url, pageUrl: page || url }))
      .filter(j => j.url && !seenSet.has(j.url) && (failed[j.url]?.attempts || 0) < MAX_ATTEMPTS);
    const batch = pending.slice(0, PER);
    if (!batch.length) continue;
    didWork = true;
    await log(`round ${round} ${name}: ${batch.length}/${pending.length} pending (mode=${mode})`);
    if (DRY) { for (const j of batch) console.log(`  ${j.url}`); continue; }

    const seenPath = work('seen', name + '.txt');
    const failedPath = work('failed', name + '.json');
    await mkdir(path.dirname(seenPath), { recursive: true });

    if (mode === 'fetch' || mode === 'both') {
      for (const j of batch) {
        const slug = j.url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
        const r = spawnSync(process.execPath, [resolve(root, 'scripts/fetch-asset.mjs'), j.url, resolve(DATASET, name), '--tool', name, '--page', j.pageUrl, '--name', slug], { encoding: 'utf8' });
        if (r.status === 0) { if (!seenSet.has(j.url)) { seenSet.add(j.url); await appendFile(seenPath, j.url + '\n'); } delete failed[j.url]; }
        else failed[j.url] = { attempts: (failed[j.url]?.attempts || 0) + 1, lastError: (r.stderr || r.stdout || '').trim().slice(0, 300) };
      }
    }
    if (mode === 'shots' || mode === 'both') {
      const tmpDir = work('tmp'); await mkdir(tmpDir, { recursive: true });
      const batchFile = resolve(tmpDir, name + '-batch.txt');
      const shotsDir = resolve(DATASET, name, 'shots');
      await mkdir(shotsDir, { recursive: true });
      await writeFile(resolve(shotsDir, 'errors.json'), '[]'); // clear stale batch errors before the run
      await writeFile(batchFile, batch.map(j => `${j.url}\t${j.pageUrl}`).join('\n') + '\n');
      const r = spawnSync(process.execPath, [resolve(root, 'scripts/browser-shots.mjs'), batchFile, shotsDir, '--tool', name], { encoding: 'utf8', timeout: batch.length * 180000 + 120000 });
      if (r.stdout) process.stdout.write(r.stdout);
      if (r.stderr) process.stderr.write(r.stderr);
      const okUrls = new Set([...(r.stdout || '').matchAll(/^ok \d+\/\d+ (\S+)/gm)].map(m => m[1]));
      const errs = await readFile(resolve(shotsDir, 'errors.json'), 'utf8').then(t => new Map(JSON.parse(t).map(e => [e.url, e.error]))).catch(() => new Map());
      for (const j of batch) {
        if (okUrls.has(j.url) && !errs.has(j.url)) { if (!seenSet.has(j.url)) { seenSet.add(j.url); await appendFile(seenPath, j.url + '\n'); } delete failed[j.url]; }
        else if (errs.has(j.url)) failed[j.url] = { attempts: (failed[j.url]?.attempts || 0) + 1, lastError: String(errs.get(j.url)).slice(0, 300) };
        // neither ok nor listed → collector died mid-batch; leave unmarked so it retries
      }
    }
    await mkdir(path.dirname(failedPath), { recursive: true });
    await writeFile(failedPath, JSON.stringify(failed, null, 1) + '\n');
  }
  if (MAXROUNDS && round >= MAXROUNDS) break;
  if (UNTIL && Date.now() >= UNTIL) break;
  if (EXIT_EMPTY && !didWork) { await log('queues drained — exiting'); break; }
  await sleep(INTERVAL * (0.8 + 0.4 * Math.random()));
  if (UNTIL && Date.now() >= UNTIL) break;
}
await log(`collector done after ${round} round(s)`);
