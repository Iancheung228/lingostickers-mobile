#!/usr/bin/env node
// Backfill stickers.thumb_path for cutouts made before the app started
// uploading thumbnails itself (047_sticker_thumbnails.sql, lib/thumbnails.ts).
//
// For each sticker with an image_path and no thumb_path: download the cutout,
// render a 512px WebP beside it (same naming as thumbPathFor in
// lib/thumbnails.ts), upload it, then set thumb_path. Safe to re-run: rows that
// already have a thumbnail are skipped, uploads use upsert, and the row is only
// updated after its file exists, so an interrupted run leaves nothing pointing
// at a missing file.
//
// Dry run by default. Needs the service-role key, because it reads and writes
// every user's folder:
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-thumbnails.mjs          # dry run
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-thumbnails.mjs --apply  # do it
//
// The project is staging unless TABI_ENV=production (scripts/lib/backend.mjs);
// use the service-role key of that same project.

import sharp from 'sharp';
import { SUPABASE_URL as URL, TABI_ENV } from './lib/backend.mjs';

const APPLY = process.argv.includes('--apply');
const THUMB_MAX_SIDE = 512; // keep in step with lib/thumbnails.ts
const THUMB_QUALITY = 80;   // lib/thumbnails.ts uses 0.8 on a 0-1 scale
const BUCKET = 'sticker-images';
const PAGE = 500;

const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error(`Need EXPO_PUBLIC_SUPABASE_URL for ${TABI_ENV} and SUPABASE_SERVICE_ROLE_KEY in the environment.`);
  process.exit(1);
}
console.log(`Backend: ${TABI_ENV} (${URL})`);
const H = { apikey: KEY, authorization: `Bearer ${KEY}` };

const thumbPathFor = (p) => p.replace(/\.[a-z0-9]+$/i, '') + '.thumb.webp';

async function pendingRows() {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(
      `${URL}/rest/v1/stickers?select=id,image_path&image_path=not.is.null&thumb_path=is.null&order=created_at.asc`,
      { headers: { ...H, range: `${from}-${from + PAGE - 1}` } },
    );
    if (!res.ok) throw new Error(`list stickers: ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

async function backfill(row) {
  const src = await fetch(`${URL}/storage/v1/object/${BUCKET}/${row.image_path}`, { headers: H });
  if (!src.ok) return { skipped: `download ${src.status}` };
  const input = Buffer.from(await src.arrayBuffer());

  const thumb = await sharp(input)
    .resize(THUMB_MAX_SIDE, THUMB_MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY, alphaQuality: 100 })
    .toBuffer();
  const path = thumbPathFor(row.image_path);
  const result = { before: input.length, after: thumb.length, path };
  if (!APPLY) return result;

  const up = await fetch(`${URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...H, 'content-type': 'image/webp', 'x-upsert': 'true' },
    body: thumb,
  });
  if (!up.ok) return { skipped: `upload ${up.status} ${await up.text()}` };

  const patch = await fetch(`${URL}/rest/v1/stickers?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { ...H, 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify({ thumb_path: path }),
  });
  if (!patch.ok) return { skipped: `update ${patch.status} ${await patch.text()}` };
  return result;
}

const rows = await pendingRows();
console.log(`${rows.length} stickers without a thumbnail${APPLY ? '' : ' (dry run: nothing will be written)'}`);
let done = 0, skipped = 0, before = 0, after = 0;
for (const row of rows) {
  try {
    const r = await backfill(row);
    if (r.skipped) { skipped++; console.log(`skip ${row.id}: ${r.skipped}`); continue; }
    done++; before += r.before; after += r.after;
  } catch (err) {
    skipped++; console.log(`skip ${row.id}: ${err.message}`);
  }
}
const kb = (n) => `${Math.round(n / 1024)}KB`;
console.log(
  `${APPLY ? 'backfilled' : 'would backfill'} ${done}, skipped ${skipped}.` +
  (done ? ` Average ${kb(before / done)} -> ${kb(after / done)}.` : ''),
);
