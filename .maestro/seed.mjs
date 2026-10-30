// Puts the QA account into a known state before Maestro runs: exactly one
// sticker, "pomme", due for review now. Re-running resets it, because grading
// it in a flow pushes its due date into the future.
// Signs in AS the QA account (no service-role key needed); RLS allows a user
// to write their own stickers and their own storage folder.
//   node .maestro/seed.mjs
import { readFileSync } from 'node:fs';

const env = (file) => Object.fromEntries(
  readFileSync(file, 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const { EXPO_PUBLIC_SUPABASE_URL: URL, EXPO_PUBLIC_SUPABASE_ANON_KEY: ANON } = env('.env');
const { MAESTRO_EMAIL, MAESTRO_PASSWORD } = env('.maestro/qa.env');

// Fixed id, so every run updates the same row instead of piling up copies.
const STICKER_ID = '00000000-0000-4000-8000-00000000a001';

async function call(path, init) {
  const res = await fetch(`${URL}${path}`, init);
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

const session = await call('/auth/v1/token?grant_type=password', {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: MAESTRO_EMAIL, password: MAESTRO_PASSWORD }),
});
const userId = session.user.id;
const auth = { apikey: ANON, Authorization: `Bearer ${session.access_token}` };

const imagePath = `${userId}/qa-pomme.png`;
await call(`/storage/v1/object/sticker-images/${imagePath}`, {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'image/png', 'x-upsert': 'true' },
  body: readFileSync('.maestro/fixtures/qa-sticker.png'),
});

// Remove anything else the flows may have created, then upsert the one card.
await call(`/rest/v1/stickers?user_id=eq.${userId}&id=neq.${STICKER_ID}`, { method: 'DELETE', headers: auth });
await call('/rest/v1/stickers?on_conflict=id', {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify({
    id: STICKER_ID,
    user_id: userId,
    word: 'pomme',
    reading: 'pɔm',
    translation: 'apple',
    part_of_speech: 'noun',
    category: 'Kitchen',
    language: 'fr',
    sentence: 'Je mange une pomme rouge.',
    sentence_translation: 'I am eating a red apple.',
    image_path: imagePath,
    // Review state: a new card, due an hour ago.
    review_count: 0,
    last_reviewed_at: null,
    interval_days: 0,
    ease_factor: 2.5,
    lapses: 0,
    learning_step: null,
    due_at: new Date(Date.now() - 3_600_000).toISOString(),
  }),
});
console.log(`seeded: 1 sticker due for ${MAESTRO_EMAIL}`);
