import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { dueAtMs } from '@/lib/review';
import type { Sticker } from '@/lib/types';

// "Export my cards" (SPEC): a CSV opened in the share sheet, so a learner can
// take their cards to Anki or a spreadsheet. Built on the device from the
// cards already loaded; nothing is uploaded.
const HEADER = ['word', 'reading', 'meaning', 'sentence', 'translation', 'language', 'due', 'interval_days'];

function cell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function cardsToCsv(stickers: Sticker[]): string {
  const rows = stickers.map(s => {
    const due = dueAtMs(s);
    return [
      s.word, s.reading, s.translation, s.sentence, s.sentence_translation, s.language,
      Number.isFinite(due) ? new Date(due).toISOString() : '', s.interval_days ?? 0,
    ].map(cell).join(',');
  });
  // The BOM lets Excel and Numbers read the Japanese and Cantonese as UTF-8.
  return '﻿' + [HEADER.join(','), ...rows].join('\r\n') + '\r\n';
}

/** Writes the CSV to the cache and opens the share sheet. Throws if sharing is unavailable. */
export async function exportCards(stickers: Sticker[]): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  const file = new File(Paths.cache, 'tabi-cards.csv');
  if (file.exists) file.delete();
  file.create();
  file.write(cardsToCsv(stickers));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Export my cards',
  });
}
