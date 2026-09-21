#!/usr/bin/env node
// Harvest Manus shared-session replays + generated artifacts via public api.manus.im/api/chat endpoints.
// Reads dataset/_work/manus-usecases.json (RESOURCE_TYPE_SESSION rows), writes:
//   dataset/manus/sessions/<sessionUid>/session.json      full getSessionV2 replay
//   dataset/manus/sessions/<sessionUid>/files.json        getSessionFilesV2 listing
//   dataset/_work/jobs-manus-sessions.json                download jobs for agent-generated files
// Skips user_file uploads (type==='user_file' or /users/<id>/uploads/ paths).
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const usecases = JSON.parse(await readFile(ROOT + 'dataset/_work/manus-usecases.json', 'utf8'));
const seen = new Set();
const sessions = usecases.filter(u => u.sessionUid && !seen.has(u.sessionUid) && seen.add(u.sessionUid));
console.log('sessions:', sessions.length);

const CONC = 6;
const jobs = [];
let ok = 0, fail = 0;

const walk = (o, fn, path = '') => {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { o.forEach((v, i) => fn(v, path + '[' + i + ']')); o.forEach((v, i) => walk(v, fn, path)); return; }
  fn(o, path);
  for (const k of Object.keys(o)) walk(o[k], fn, path + '.' + k);
};

async function one(s, i) {
  const uid = s.sessionUid;
  const dir = ROOT + 'dataset/manus/sessions/' + uid;
  const page = 'https://manus.im/share/' + s.recordUid + '?replay=1';
  try {
    const exists = await readFile(dir + '/session.json', 'utf8').catch(() => null);
    if (exists) { ok++; return; }
    const [v2, fl] = await Promise.all([
      fetch(`https://api.manus.im/api/chat/getSessionV2?sessionId=${uid}&type=shared`, { signal: AbortSignal.timeout(45000) }).then(r => r.json()),
      fetch(`https://api.manus.im/api/chat/getSessionFilesV2?sessionId=${uid}&type=shared`, { signal: AbortSignal.timeout(45000) }).then(r => r.json()),
    ]);
    if (v2.error || fl.error) throw new Error('api:' + JSON.stringify(v2.error || fl.error).slice(0, 120));
    await mkdir(dir, { recursive: true });
    await writeFile(dir + '/session.json', JSON.stringify(v2));
    await writeFile(dir + '/files.json', JSON.stringify(fl));
    // collect agent-generated file urls from files listing (raw[] entries with type sbx_file)
    const urls = new Map();
    walk(fl, (o) => {
      if (typeof o.url === 'string' && o.url.startsWith('http')) {
        const isUser = o.type === 'user_file' || /\/users\/\d+\/uploads\//.test(o.url);
        if (!isUser && /sessionFile|manuscdn|cloudfront/.test(o.url)) urls.set(o.url, o.filename || o.displayFilename || null);
      }
    });
    // also scan the session event stream for sandbox file urls (agent outputs)
    walk(v2, (o) => {
      if (typeof o.url === 'string' && /sessionFile\//.test(o.url) && !/\/users\/\d+\/uploads\//.test(o.url)) urls.set(o.url, o.filename || null);
    });
    let n = 0;
    for (const [url, fn] of urls) {
      const name = (fn || url.split('/').pop().split('?')[0] || 'file').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_.-]/gi, '_').slice(0, 80) + '_' + n;
      jobs.push({ url, sub: 'sessions/' + uid + '/files', name, pageUrl: page, title: (s.sessionInfo && s.sessionInfo.title) || null });
      n++;
    }
    ok++;
  } catch (e) {
    fail++;
    console.log('FAIL', uid, String(e.message || e).slice(0, 140));
  }
  if ((i + 1) % 20 === 0) console.log(`progress ${i + 1}/${sessions.length} ok=${ok} fail=${fail} jobs=${jobs.length}`);
}

const queue = sessions.map((s, i) => [s, i]);
await Promise.all(Array.from({ length: CONC }, async () => {
  while (queue.length) { const it = queue.shift(); if (it) await one(it[0], it[1]); }
}));
await writeFile(ROOT + 'dataset/_work/jobs-manus-sessions2.json', JSON.stringify(jobs, null, 1));
console.log(`DONE ok=${ok} fail=${fail} download-jobs=${jobs.length}`);
