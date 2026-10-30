// Harness verifier: decides which harness/feature_list.json features pass.
// Owned by the human — the loop is forbidden to edit it (see harness/guard.sh).
// Usage: node --experimental-strip-types scripts/test-drivable.mts [--json]
import { readFileSync, existsSync } from 'node:fs';

type Check = { file: string; testIDs?: string[]; includes?: string[]; strings?: string[] };
type Feature = { id: string; checks: Check[]; flow?: string };

const { features } = JSON.parse(readFileSync('harness/feature_list.json', 'utf8')) as { features: Feature[] };

// Written by harness/qa.sh after every Maestro run. A feature with a flow is
// only done once that flow has actually passed on the Simulator.
type QaStatus = { ready: boolean; flows?: Record<string, { passed: boolean; error?: string }> };
const qa: QaStatus = existsSync('harness/logs/qa-status.json')
  ? JSON.parse(readFileSync('harness/logs/qa-status.json', 'utf8'))
  : { ready: false };

function hasTestID(src: string, id: string): boolean {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`testID=(?:"${esc}"|\\{\\s*['"\`]${esc}['"\`]\\s*\\})`).test(src);
}

const status: Record<string, { passes: boolean; missing: string[] }> = {};
for (const f of features) {
  const missing: string[] = [];
  for (const c of f.checks) {
    if (!existsSync(c.file)) { missing.push(`${c.file}: file missing`); continue; }
    const src = readFileSync(c.file, 'utf8');
    for (const id of c.testIDs ?? []) if (!hasTestID(src, id)) missing.push(`${c.file}: testID="${id}"`);
    for (const s of [...(c.includes ?? []), ...(c.strings ?? [])]) if (!src.includes(s)) missing.push(`${c.file}: "${s}"`);
  }
  if (f.flow) {
    const run = qa.flows?.[f.flow];
    if (!existsSync(f.flow)) missing.push(`flow ${f.flow}: not written yet`);
    else if (!qa.ready || !run) missing.push(`flow ${f.flow}: not run yet (harness/qa.sh ${f.flow})`);
    else if (!run.passed) missing.push(`flow ${f.flow}: FAILED — ${run.error ?? 'see harness/logs/qa-status.json'}`);
  }
  status[f.id] = { passes: missing.length === 0, missing };
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(status, null, 2));
} else {
  for (const [id, s] of Object.entries(status)) {
    console.log(`${s.passes ? 'PASS' : 'FAIL'}  ${id}`);
    for (const m of s.missing) console.log(`        missing ${m}`);
  }
}
