import type { EditorSpec, Suggestion } from '@/components/FieldEditor';
import { supabase } from '@/lib/supabase';
import { getFunctionErrorMessage } from '@/lib/functionError';
import { languageLabel } from '@/lib/languages';
import type { Sticker } from '@/lib/types';
import { fonts, wordFontFor, sentenceFontFor } from '@/constants/theme';

// What each tappable field of a card opens in the FieldEditor sheet, and the
// two translate-word lookups that follow a word or meaning edit. Moved out of
// StudyCard so the card detail, the reveal and the study card's "Edit card"
// all open exactly the same editors.

/** Kana or CJK ideographs: text that is not an English meaning. */
const CJK = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/;

export type EditTarget = 'note' | 'word' | 'reading' | 'meaning' | 'sentence';

// Columns that are genuinely nullable — anything else keeps its old value
// rather than being blanked, so an accidental empty save can't strip the
// headword off a card.
export const NULLABLE_FIELDS = new Set(['notes', 'part_of_speech', 'sentence_insight']);

export function editorSpecFor(target: EditTarget, sticker: Sticker): EditorSpec {
  switch (target) {
    case 'note':
      return {
        title: 'What happened?',
        subtitle: 'Where you were, who you were with, why this one stuck — the part no dictionary has.',
        inputs: [{
          key: 'notes',
          value: sticker.notes ?? '',
          placeholder: 'Queued twenty minutes in the rain for this…',
          multiline: true,
        }],
      };
    case 'word':
      return {
        title: 'The word',
        subtitle: `As it is written in ${languageLabel(sticker.language)}. Change it and how it's said and what it means follow.`,
        inputs: [
          { key: 'word', label: 'Word', value: sticker.word, fontFamily: wordFontFor(sticker.language), maxLength: 60 },
        ],
        // The reading and meaning change with the word: a new word under the
        // old reading teaches the wrong sound, and for Japanese and Cantonese
        // the reading is the part a learner cannot check for themselves.
        follow: {
          from: 'word',
          fetch: (text) => readingForWord(text, sticker.language),
          copy: {
            looking: 'Looking up how it’s said and what it means…',
            heading: 'Update how it’s said and what it means to',
            failed: 'Couldn’t look that word up',
            kept: 'Keeping the old reading and meaning.',
            failedKeep: 'Saving changes only the word, so check the reading and meaning after.',
          },
          fontFamily: fonts.mono,
          note: 'Your example sentence stays as it is.',
          skip: (text) => sticker.language !== 'fr' && !CJK.test(text)
            ? `That looks like English. To change the meaning, edit the meaning and the ${languageLabel(sticker.language)} word will follow.`
            : null,
        },
      };
    case 'reading':
      return {
        title: 'How to say it',
        inputs: [{ key: 'reading', label: 'Reading', value: sticker.reading, fontFamily: fonts.mono }],
      };
    case 'meaning':
      return {
        title: 'What it means',
        subtitle: `In English. Change it and the ${languageLabel(sticker.language)} word follows.`,
        inputs: [
          { key: 'translation', label: 'Meaning', value: sticker.translation, maxLength: 60 },
          { key: 'part_of_speech', label: 'Part of speech', value: sticker.part_of_speech ?? '', placeholder: 'noun, verb, adjective…' },
        ],
        follow: {
          from: 'translation',
          fetch: (text) => wordForMeaning(text, sticker.language),
          copy: {
            looking: `Finding the ${languageLabel(sticker.language)} word…`,
            heading: `Change the ${languageLabel(sticker.language)} word to`,
            failed: `Couldn’t find the ${languageLabel(sticker.language)} word`,
            kept: `Keeping ${sticker.word}.`,
            failedKeep: `Saving keeps the word as ${sticker.word}.`,
          },
          fontFamily: wordFontFor(sticker.language),
          // The sentence was written about the actual photo; translate-word
          // only sees a bare English word, so it is never regenerated here.
          note: 'Your example sentence stays as it is.',
          skip: (text) => sticker.language !== 'fr' && CJK.test(text)
            ? `That is the English meaning. To change the ${languageLabel(sticker.language)} word itself, edit the word.`
            : null,
        },
      };
    case 'sentence':
      return {
        title: 'The sentence',
        subtitle: 'The example sentence and its English.',
        inputs: [
          { key: 'sentence', label: 'Sentence', value: sticker.sentence, multiline: true, fontFamily: sentenceFontFor(sticker.language) },
          { key: 'sentence_translation', label: 'In English', value: sticker.sentence_translation, multiline: true },
        ],
      };
  }
}

/**
 * The target-language word for a corrected English meaning, shown in the
 * editor before anything is saved.
 *
 * Deliberately does NOT touch `sentence`/`sentence_translation`: the stored
 * sentence was generated against the actual photo and names real things in
 * the scene, while translate-word only ever sees a bare English word and
 * returns a generic example. Overwriting would trade something specific to
 * that moment for something anyone could have written.
 */
export async function wordForMeaning(englishWord: string, language: Sticker['language']): Promise<Suggestion> {
  const { data, error } = await supabase.functions.invoke('translate-word', {
    body: { englishWord, language },
  });
  if (error) throw new Error(await getFunctionErrorMessage(error));
  if (data?.error) throw new Error(String(data.error));
  if (!data?.word) throw new Error('No word came back.');
  // Only keys the model actually returned — an `undefined` in the patch would
  // travel to Supabase as a column being set, not as one being left alone.
  const fields: Record<string, string> = { word: String(data.word) };
  if (data.reading) fields.reading = String(data.reading);
  if (data.part_of_speech) fields.part_of_speech = String(data.part_of_speech);
  if (data.category) fields.category = String(data.category);
  return { fields, title: fields.word, detail: fields.reading };
}

/**
 * The reading, meaning and part of speech for a word the learner typed in
 * the target language: the other direction of `wordForMeaning`.
 */
export async function readingForWord(word: string, language: Sticker['language']): Promise<Suggestion> {
  const { data, error } = await supabase.functions.invoke('translate-word', {
    body: { word, language },
  });
  if (error) throw new Error(await getFunctionErrorMessage(error));
  if (data?.error) throw new Error(String(data.error));
  if (!data?.reading && !data?.translation) throw new Error('Nothing came back.');
  // The word stays exactly as typed: the learner was correcting it, and a
  // model "fixing" their fix back would be maddening.
  const fields: Record<string, string> = {};
  if (data.reading) fields.reading = String(data.reading);
  if (data.translation) fields.translation = String(data.translation);
  if (data.part_of_speech) fields.part_of_speech = String(data.part_of_speech);
  return {
    fields,
    title: fields.reading ?? fields.translation,
    detail: fields.reading && fields.translation ? `means ${fields.translation}` : undefined,
  };
}
