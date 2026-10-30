// ---------------------------------------------------------------------------
// qa-budget — how many AI calls the QA account has made today, and how many
// are left of the 100-a-day budget.
//
//   node scripts/qa-budget.mjs            prints the table, exits 0
//   node scripts/qa-budget.mjs --need 18  exits 1 if 18 more would overspend
//
// The count is the server's own (`api_usage`, one row per user, endpoint and
// UTC day, readable by its owner under RLS), so it includes every call made
// from anywhere: probes, Maestro flows that scan, a human poking the app.
// A local tally would miss all of those.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs';

const DAILY_BUDGET = 100;

const env = (p) => Object.fromEntries(
  readFileSync(p, 'utf8').split('\n')
    .filter((l) => /^\w+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; }),
);
const { EXPO_PUBLIC_SUPABASE_URL: URL, EXPO_PUBLIC_SUPABASE_ANON_KEY: ANON } = env('.env');
const { MAESTRO_EMAIL, MAESTRO_PASSWORD } = env('.maestro/qa.env');

const auth = await (await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: MAESTRO_EMAIL, password: MAESTRO_PASSWORD }),
})).json();
if (!auth.access_token) throw new Error('could not sign in as the QA account');

const today = new Date().toISOString().slice(0, 10);
const res = await fetch(`${URL}/rest/v1/api_usage?select=endpoint,count&usage_date=eq.${today}`, {
  headers: { apikey: ANON, Authorization: `Bearer ${auth.access_token}` },
});
const rows = await res.json();
if (!Array.isArray(rows)) throw new Error(`api_usage read failed: ${JSON.stringify(rows)}`);

const used = rows.reduce((n, r) => n + r.count, 0);
const left = DAILY_BUDGET - used;
for (const r of rows) console.log(`  ${r.endpoint.padEnd(20)} ${r.count}`);
console.log(`QA budget ${today} (UTC): ${used} used, ${left} of ${DAILY_BUDGET} left`);

const i = process.argv.indexOf('--need');
const need = i >= 0 ? Number(process.argv[i + 1]) : 0;
if (need > left) {
  console.error(`Not enough budget: need ${need}, have ${left}.`);
  process.exit(1);
}
