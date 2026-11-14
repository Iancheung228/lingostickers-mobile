// Fills the STAGING calendar demo account (calendar-demo@tabi.test, creds in
// .maestro/calendar-demo.env) with ~60 cut-out stickers spread over Aug–Nov,
// so the Calendar's month grid, flip-in cascade and year mosaic can be seen
// with real data. Re-running resets the account to exactly this set.
//
// Images: research_notes/calendar-reimagine-2026-11/demo-cutouts/ — Wikimedia
// Commons photos cut out with Apple Vision (foreground instance mask), plus a
// 512px WebP thumbnail each, the same pair a device scan uploads. Two
// rectangular .jpg "photos" are included on purpose: the Calendar must skip
// them (only .png cutouts are drawn; see isCutout in lib/thumbnails.ts).
//
//   node scripts/seed-calendar-demo.mjs
// Staging only: refuses TABI_ENV=production.
import { readFileSync, existsSync } from 'node:fs';
import { SUPABASE_URL as URL, ANON_KEY as ANON, TABI_ENV, readEnvFile } from './lib/backend.mjs';

if (TABI_ENV !== 'staging') throw new Error('seed-calendar-demo is staging-only.');
const CREDS = '.maestro/calendar-demo.env';
if (!existsSync(CREDS)) throw new Error(`Missing ${CREDS}`);
const { MAESTRO_EMAIL, MAESTRO_PASSWORD } = readEnvFile(CREDS);
const DIR = 'research_notes/calendar-reimagine-2026-11/demo-cutouts';

// [file stem, word, translation, category, part of speech]. Cutouts the source
// photo cropped (a straight edge where the frame cut the object: sock, pizza
// box, ice-cream hand, watch strap) were dropped; they read as rectangles.
const WORDS = [
  ['ail', 'ail', 'garlic', 'Kitchen', 'noun'], ['appareil', 'appareil photo', 'camera', 'Other', 'noun'],
  ['avocat', 'avocat', 'avocado', 'Kitchen', 'noun'], ['banane', 'banane', 'banana', 'Kitchen', 'noun'],
  ['basket', 'basket', 'sneaker', 'Other', 'noun'], ['bougie', 'bougie', 'candle', 'Other', 'noun'],
  ['brocoli', 'brocoli', 'broccoli', 'Kitchen', 'noun'], ['canard', 'canard', 'duck', 'Animals', 'noun'],
  ['carotte', 'carotte', 'carrot', 'Kitchen', 'noun'], ['champignon', 'champignon', 'mushroom', 'Nature', 'noun'],
  ['ciseaux', 'ciseaux', 'scissors', 'Study', 'noun'],
  ['citron', 'citron', 'lemon', 'Kitchen', 'noun'], ['croissant', 'croissant', 'croissant', 'Kitchen', 'noun'],
  ['fraise', 'fraise', 'strawberry', 'Kitchen', 'noun'], ['fromage', 'fromage', 'cheese', 'Kitchen', 'noun'],
  ['gant', 'gant', 'glove', 'Other', 'noun'],
  ['horloge', 'réveil', 'alarm clock', 'Other', 'noun'], ['kiwi', 'kiwi', 'kiwi', 'Kitchen', 'noun'],
  ['livre', 'livre', 'book', 'Study', 'noun'],
  ['noix', 'noix', 'walnut', 'Kitchen', 'noun'], ['oeuf', 'œuf', 'egg', 'Kitchen', 'noun'],
  ['oignon', 'oignon', 'onion', 'Kitchen', 'noun'], ['orange', 'orange', 'orange', 'Kitchen', 'noun'],
  ['ours', 'ours en peluche', 'teddy bear', 'Other', 'noun'], ['pasteque', 'pastèque', 'watermelon', 'Kitchen', 'noun'],
  ['fleur', 'fleur', 'flower', 'Nature', 'noun'],
  ['poivron', 'poivron', 'bell pepper', 'Kitchen', 'noun'], ['pomme', 'pomme', 'apple', 'Kitchen', 'noun'],
  ['sac', 'sac à dos', 'backpack', 'Other', 'noun'], ['theiere', 'théière', 'teapot', 'Kitchen', 'noun'],
  ['tomate', 'tomate', 'tomato', 'Kitchen', 'noun'], ['tournesol', 'tournesol', 'sunflower', 'Nature', 'noun'],
  ['velo', 'vélo', 'bicycle', 'Other', 'noun'], ['voiture', 'voiture', 'car', 'Other', 'noun'],
];

// Which days get a find, Aug 1 → Nov 13 2026 (today, the 14th, stays empty so
// the "+" slot shows). Deterministic so screenshots are repeatable.
function schedule() {
  const days = [];
  const start = new Date(2026, 7, 1), end = new Date(2026, 10, 13);
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    // Denser in recent months: the habit "picks up".
    const m = d.getMonth();
    const p = m === 7 ? 0.38 : m === 8 ? 0.5 : m === 9 ? 0.62 : 0.7;
    if (rand() < p) days.push(new Date(d));
  }
  return days;
}

async function call(path, init) {
  const res = await fetch(`${URL}${path}`, init);
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

const session = await call('/auth/v1/token?grant_type=password', {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: MAESTRO_EMAIL, password: MAESTRO_PASSWORD }),
});
const userId = session.user.id;
const auth = { apikey: ANON, Authorization: `Bearer ${session.access_token}` };

// Profile: finished onboarding, learning French, so the app opens on the tabs.
await call(`/rest/v1/profiles?id=eq.${userId}`, {
  method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ target_language: 'fr' }),
}).catch((e) => console.warn('profile patch skipped:', e.message));

const upload = (path, bytes, type) => call(`/storage/v1/object/sticker-images/${path}`, {
  method: 'POST', headers: { ...auth, 'Content-Type': type, 'x-upsert': 'true' }, body: bytes,
});

// Upload each image once; stickers reuse them.
const stored = new Map();
for (const [stem] of WORDS) {
  const img = `${userId}/demo-${stem}.png`, thumb = `${userId}/demo-${stem}.thumb.webp`;
  await upload(img, readFileSync(`${DIR}/${stem}.png`), 'image/png');
  await upload(thumb, readFileSync(`${DIR}/${stem}.thumb.webp`), 'image/webp');
  stored.set(stem, { image_path: img, thumb_path: thumb });
}
const rects = {};
for (const stem of ['rect-vitrine', 'rect-terrasse']) {
  const p = `${userId}/demo-${stem}.jpg`;
  await upload(p, readFileSync(`${DIR}/${stem}.jpg`), 'image/jpeg');
  rects[stem] = p;
}

// Nov 3 is reserved for the rectangle-only test day, so no cutout lands on it.
const days = schedule().filter((d) => !(d.getMonth() === 10 && d.getDate() === 3));
const rows = [];
let w = 0;
const base = (date, extra) => {
  const iso = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10 + (rows.length % 8), (rows.length * 7) % 60).toISOString();
  // About 2 in 5 cards were reviewed, 1–4 days after they were found (never
  // after Nov 13), so review dots land on their own days instead of under
  // every sticker.
  const n = rows.length;
  const reviewedAt = n % 5 < 2
    ? new Date(Math.min(date.getTime() + (1 + (n % 4)) * 86_400_000 + 18 * 3_600_000, new Date(2026, 10, 13, 20).getTime())).toISOString()
    : null;
  return {
    user_id: userId, language: 'fr', created_at: iso, discovered_at: iso,
    reading: extra.word,
    sentence: `Regarde, c'est ${/^[aeiouhéœ]/i.test(extra.word) ? "l'" : 'le '}${extra.word}.`,
    sentence_translation: `Look, it's the ${extra.translation}.`,
    review_count: reviewedAt ? 1 : 0, last_reviewed_at: reviewedAt, interval_days: reviewedAt ? 3 : 0, ease_factor: 2.5, lapses: 0,
    learning_step: null, due_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    ...extra,
  };
};
const card = (date, i) => {
  const [stem, word, translation, category, pos] = WORDS[i % WORDS.length];
  return base(date, { word, translation, category, part_of_speech: pos, source: 'scan', ...stored.get(stem) });
};
days.forEach((date, di) => {
  rows.push(card(date, w++));
  if (di % 14 === 2) rows.push(card(date, w++)); // some days have two finds
});
// Non-cutout cards (must NOT be drawn on the Calendar):
//  - a day whose only find is a rectangular photo → no sticker on that day;
//  - a rectangular photo made BEFORE a cutout on the same day → the cutout shows.
const rectOnly = new Date(2026, 10, 3);
const rectFirst = days.find((d) => d.getMonth() === 9 && d.getDate() > 20) ?? new Date(2026, 9, 22);
const rect = (date, path, word, translation) => ({
  ...base(date, { word, translation, category: 'Other', part_of_speech: 'noun', source: 'scene', image_path: path, thumb_path: null }),
  created_at: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 8, 0).toISOString(),
});
rows.push(rect(rectOnly, rects['rect-terrasse'], 'terrasse', 'terrace'));
rows.push(rect(rectFirst, rects['rect-vitrine'], 'vitrine', 'shop window'));

await call(`/rest/v1/stickers?user_id=eq.${userId}`, { method: 'DELETE', headers: auth });
await call('/rest/v1/stickers', {
  method: 'POST', headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify(rows),
});
const days3 = new Set(rows.map((r) => r.created_at.slice(0, 10)));
console.log(`seeded ${rows.length} stickers (${rows.length - 2} cutouts + 2 rectangles) on ${days3.size} days for ${MAESTRO_EMAIL}`);
console.log(`rect-only day: ${rectOnly.toDateString()}; rect-before-cutout day: ${rectFirst.toDateString()}`);
