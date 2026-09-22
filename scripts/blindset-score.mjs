#!/usr/bin/env node
// blindset-score.mjs — score Tier-C visual-only judgments against blindset ground truth.
//
// Inputs (eval/blindset/ committed copies preferred, dataset/_tmp fallback):
//   blindset-key.json          ground truth (blind filename -> {dir,file,label,pipe})
//   blindset-key-audit.json    post-hoc label audit (--audit)
//   judgments.jsonl            visual verdicts {f,v,pipe,conf,badge,ev}
//
// Modes:
//   (default)        full run — badges/tool chrome allowed as visual evidence
//   --audit          apply blindset-key-audit.json label fixes + drop contested items
//   --no-badge       exclude items where the visual call relied on a service
//                    badge/chrome (badge:true) — the strict "no watermark" mode
//
// Verdict mapping: ai_confirmed|ai_likely -> "ai", human_likely -> "human",
//                  uncertain|unavailable -> abstain/unmeasured.
// Usage: node scripts/blindset-score.mjs [--no-badge] [--audit] [--set v2]
//   --set v2  score the second blindset (blindset2-key.json + blindset2-judge.jsonl
//             + blindset2-key-audit.json exclusion categories)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVAL = path.join(ROOT, 'eval', 'blindset');
const TMP = path.join(ROOT, 'dataset', '_tmp');
const setArg = process.argv.includes('--set') ? process.argv[process.argv.indexOf('--set') + 1] : 'v1';
const base = setArg === 'v1' ? 'blindset' : 'blindset' + setArg.replace(/^v/, ''); // v2 -> blindset2, v2b -> blindset2b
const dir = fs.existsSync(path.join(EVAL, `${base}-key.json`)) ? EVAL : TMP;
const judgeFile = fs.existsSync(path.join(dir, `${base}-judgments.jsonl`))
  ? path.join(dir, `${base}-judgments.jsonl`)
  : fs.existsSync(path.join(dir, 'judgments.jsonl'))
    ? path.join(dir, 'judgments.jsonl')
    : path.join(TMP, `${base}-judge.jsonl`);
const noBadge = process.argv.includes('--no-badge');
const audit = process.argv.includes('--audit');

const key = JSON.parse(fs.readFileSync(path.join(dir, `${base}-key.json`), 'utf8'));
const exclusions = { dup: [], contested: [], unavailable: [] };
if (audit) {
  const a = JSON.parse(fs.readFileSync(path.join(dir, `${base}-key-audit.json`), 'utf8'));
  if (a.overrides) {
    for (const [f, o] of Object.entries(a.overrides)) {
      if (o.contested) key[f].contested = true;
      else Object.assign(key[f], { label: o.label, pipe: o.pipe, auditNote: o.note });
    }
  }
  if (a.excluded) {
    for (const [cat, items] of Object.entries(a.excluded)) {
      const bucket = cat.startsWith('dup') ? 'dup' : cat.startsWith('contested') ? 'contested' : 'unavailable';
      for (const f of Object.keys(items)) { key[f].excluded = cat; exclusions[bucket].push(f); }
    }
  }
}
const judge = fs.readFileSync(judgeFile, 'utf8')
  .trim().split('\n').map(JSON.parse);

const aiCall = v => v === 'ai_confirmed' || v === 'ai_likely';

function score(items) {
  const r = {
    n: items.length,
    ai: { n: 0, caught: 0, missed: 0, abstain: 0 },
    human: { n: 0, fp: 0, correct: 0, abstain: 0 },
    unknown: { n: 0, overclaim: 0, abstain: 0 },   // host-only: abstain is correct
    byPipe: {}, byBasis: {},
    misses: [], fps: [], abstains: [], overclaims: [],
  };
  for (const it of items) {
    const truth = it.truth.label;              // 'ai' | 'human' | 'unknown'
    const call = aiCall(it.judge.v) ? 'ai' : (it.judge.v === 'human_likely' || it.judge.v === 'human_confirmed') ? 'human' : 'abstain';
    const pk = `${it.truth.label}/${it.truth.pipe}`;
    const bk = `${it.truth.label}/${it.truth.basis || 'na'}`;
    r.byPipe[pk] ??= { n: 0, caught: 0, fp: 0, abstain: 0, overclaim: 0 };
    r.byPipe[pk].n++;
    r.byBasis[bk] ??= { n: 0, caught: 0, fp: 0, abstain: 0, overclaim: 0 };
    r.byBasis[bk].n++;
    if (truth === 'ai') {
      r.ai.n++;
      if (call === 'ai') { r.ai.caught++; r.byPipe[pk].caught++; r.byBasis[bk].caught++; }
      else if (call === 'abstain') { r.ai.abstain++; r.byPipe[pk].abstain++; r.byBasis[bk].abstain++; r.abstains.push(it); }
      else { r.ai.missed++; r.misses.push(it); }
    } else if (truth === 'unknown') {
      r.unknown.n++;
      if (call === 'abstain') { r.unknown.abstain++; r.byPipe[pk].abstain++; r.byBasis[bk].abstain++; }
      else { r.unknown.overclaim++; r.byPipe[pk].overclaim++; r.byBasis[bk].overclaim++; r.overclaims.push(it); }
    } else {
      r.human.n++;
      if (call === 'ai') { r.human.fp++; r.byPipe[pk].fp++; r.byBasis[bk].fp++; r.fps.push(it); }
      else if (call === 'abstain') { r.human.abstain++; r.byPipe[pk].abstain++; r.byBasis[bk].abstain++; r.abstains.push(it); }
      else { r.human.correct++; r.byBasis[bk].caught++; }
    }
  }
  return r;
}

function report(title, r) {
  const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '-';
  console.log(`\n=== ${title} (n=${r.n}) ===`);
  console.log(`AI      n=${r.ai.n}: caught ${r.ai.caught} (${pct(r.ai.caught, r.ai.n)}), missed ${r.ai.missed} (${pct(r.ai.missed, r.ai.n)}), abstain ${r.ai.abstain} (${pct(r.ai.abstain, r.ai.n)})`);
  console.log(`HUMAN   n=${r.human.n}: false-positive ${r.human.fp} (${pct(r.human.fp, r.human.n)}), correct ${r.human.correct} (${pct(r.human.correct, r.human.n)}), abstain ${r.human.abstain} (${pct(r.human.abstain, r.human.n)})`);
  if (r.unknown.n)
    console.log(`UNKNOWN n=${r.unknown.n}: correct-abstain ${r.unknown.abstain} (${pct(r.unknown.abstain, r.unknown.n)}), overclaim ${r.unknown.overclaim} (${pct(r.unknown.overclaim, r.unknown.n)})`);
  console.log('by pipeline:', JSON.stringify(r.byPipe));
  if (Object.keys(r.byBasis).length > 1)
    console.log('by label basis:', JSON.stringify(r.byBasis));
  if (r.overclaims.length) {
    console.log('UNKNOWN OVERCLAIMS (host-only items called ai/human):');
    for (const m of r.overclaims) console.log(`  ${m.f} truth=${m.truth.dir} call=${m.judge.v} ev=${m.judge.ev}`);
  }
  if (r.misses.length) {
    console.log('AI MISSES (called human):');
    for (const m of r.misses) console.log(`  ${m.f} truth=${m.truth.dir}/${m.truth.pipe} ev=${m.judge.ev}`);
  }
  if (r.fps.length) {
    console.log('HUMAN FALSE-POSITIVES (called ai):');
    for (const m of r.fps) console.log(`  ${m.f} truth=${m.truth.dir}/${m.truth.pipe} ev=${m.judge.ev}`);
  }
  if (r.abstains.length) {
    console.log(`ABSTAINS (${r.abstains.length}):`);
    for (const m of r.abstains) console.log(`  ${m.f} truth=${m.truth.dir}/${m.truth.pipe} ev=${m.judge.ev}`);
  }
}

const all = judge.map(j => ({ f: j.f, judge: j, truth: key[j.f] })).filter(x => x.truth);
const exd = all.filter(x => x.truth.excluded || x.truth.contested || x.judge.v === 'unavailable');
const joined = all.filter(x => !x.truth.excluded && !x.truth.contested && x.judge.v !== 'unavailable');

if (exd.length) {
  console.log(`excluded/unmeasured: ${exd.length}`);
  for (const x of exd)
    console.log(`  ${x.f} [${x.truth.excluded || (x.truth.contested ? 'contested' : 'judge-unavailable')}] truth=${x.truth.dir}/${x.truth.pipe}`);
}
if (all.length !== judge.length)
  console.log(`note: ${judge.length - all.length} judge rows unkeyed`);

report('ALL ITEMS (badge evidence allowed)', score(joined));

if (noBadge) {
  report('NO-BADGE MODE (items where call used badge/chrome removed)',
    score(joined.filter(x => !x.judge.badge)));
}
