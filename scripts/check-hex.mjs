#!/usr/bin/env node
// Guard: fail on NEW hex colour literals in app/ and components/ (colours live in
// constants/theme.ts). Existing offenders are frozen per-file in
// scripts/hex-baseline.json; a file may reduce its count but not raise it, and a
// new file may have none. Run with --update after deliberately lowering counts.
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const baselinePath = join(root, 'scripts/hex-baseline.json');
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}

const counts = {};
for (const dir of ['app', 'components']) {
  for (const f of walk(join(root, dir))) {
    const n = (readFileSync(f, 'utf8').match(HEX) ?? []).length;
    if (n) counts[relative(root, f)] = n;
  }
}

if (process.argv.includes('--update')) {
  writeFileSync(baselinePath, JSON.stringify(counts, null, 2) + '\n');
  console.log(`hex baseline written: ${Object.keys(counts).length} files, ${Object.values(counts).reduce((a, b) => a + b, 0)} literals`);
  process.exit(0);
}

const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {};
const bad = Object.entries(counts).filter(([f, n]) => n > (baseline[f] ?? 0));
if (bad.length) {
  console.error('New hex colour literals found (use tokens from constants/theme.ts):');
  for (const [f, n] of bad) console.error(`  ${f}: ${n} (baseline ${baseline[f] ?? 0})`);
  process.exit(1);
}
