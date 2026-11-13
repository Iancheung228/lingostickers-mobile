// Unit tests for the tiered hint (lib/hint.ts) and the new-card limit
// (lib/studyQueue.ts).
//
//   node --experimental-strip-types --test scripts/test-study-logic.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hintTiers, frenchParts, jyutpingTones } from '../lib/hint.ts';
import { limitNewCards } from '../lib/studyQueue.ts';

test('French hint drops the article and gives the gender, never the article letter', () => {
  const t = hintTiers({ word: 'Le Café', language: 'fr', part_of_speech: 'noun', reading: '' });
  assert.equal(t[0], 'masculine noun, 4 letters');
  assert.equal(t[1], 'Starts with C');
  assert.equal(t.length, 2);
});

test('French elision and feminine articles', () => {
  assert.deepEqual(frenchParts("l'eau"), { bare: 'eau', gender: null });
  assert.equal(frenchParts('la tasse').gender, 'feminine');
  assert.equal(frenchParts('l’école', [{ l: 'Gender', v: 'feminine' }]).gender, 'feminine');
  assert.equal(hintTiers({ word: 'la tasse', language: 'fr' })[0], 'feminine, 5 letters');
  assert.equal(hintTiers({ word: "l'eau", language: 'fr' })[1], 'Starts with E');
});

test('French multi-word', () => {
  assert.equal(hintTiers({ word: 'pomme de terre', language: 'fr' })[0], '3 words, 12 letters');
});

test('Japanese: third tier is the first kana when the word starts with kanji', () => {
  const t = hintTiers({ word: '林檎', reading: 'りんご', language: 'ja', part_of_speech: 'noun' });
  assert.deepEqual(t, ['noun, 2 characters', 'Starts with 林', 'Reads り…']);
  assert.equal(hintTiers({ word: 'りんご', reading: 'りんご', language: 'ja' }).length, 2);
});

test('Cantonese: tone count', () => {
  assert.deepEqual(jyutpingTones('gaa3 fe1'), [3, 1]);
  const t = hintTiers({ word: '咖啡', reading: 'gaa3 fe1', language: 'yue' });
  assert.equal(t[2], '2 syllables, tones 3-1');
});

test('no tier shows the whole word', () => {
  for (const word of ['Le Café', '林檎', '咖啡']) {
    const t = hintTiers({ word, reading: 'gaa3 fe1', language: word === 'Le Café' ? 'fr' : 'yue' });
    assert.ok(t.every(x => !x.includes(word)), word);
  }
});

test('new-card limit keeps reviews and caps introductions', () => {
  const q = [
    { id: 'a', review_count: 0 }, { id: 'b', review_count: 3 }, { id: 'c', review_count: 0 },
    { id: 'd', review_count: 0 }, { id: 'e', review_count: 1 },
  ] as any[];
  assert.deepEqual(limitNewCards(q, 2, 0).map(c => c.id), ['a', 'b', 'c', 'e']);
  assert.deepEqual(limitNewCards(q, 2, 1).map(c => c.id), ['a', 'b', 'e']);
  assert.deepEqual(limitNewCards(q, 10, 0).map(c => c.id), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(limitNewCards(q, 0, 0).map(c => c.id), ['b', 'e']);
  assert.deepEqual(limitNewCards(q, 2, 5).map(c => c.id), ['b', 'e']);
});
