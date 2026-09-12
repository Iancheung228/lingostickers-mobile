// ---------------------------------------------------------------------------
// Print the prompt that would actually be sent, without sending it.
//
//   node --experimental-strip-types scripts/show-prompt.mts [fr|ja|yue] [cards]
//
// Everything the model reads is assembled from four places — the language
// schema, the syllabus pick, the band's budget, and the learner's own words —
// and none of those are legible from any one file. This stubs `fetch`, runs
// the real `identifyWithGroq`, and prints the text half of the request. No
// network, no key, no cost.
// ---------------------------------------------------------------------------
const { identifyFromPhoto } = await import('../supabase/functions/_shared/vocab.ts');
const { bandFor } = await import('../supabase/functions/_shared/syllabus.ts');
const { capturingProvider } = await import('./captureProvider.mts');

const language = (process.argv[2] ?? 'fr') as 'fr' | 'ja' | 'yue';
const stickerCount = Number(process.argv[3] ?? 0);

const KNOWN: Record<string, { word: string; translation: string }[]> = {
  fr: [
    { word: 'La Table', translation: 'Table' }, { word: 'La Fenêtre', translation: 'Window' },
    { word: 'Le Livre', translation: 'Book' }, { word: 'Le Matin', translation: 'Morning' },
    { word: 'Le Chat', translation: 'Cat' },
  ],
  ja: [
    { word: '机', translation: 'Desk' }, { word: '窓', translation: 'Window' },
    { word: '本', translation: 'Book' }, { word: '朝', translation: 'Morning' },
    { word: '猫', translation: 'Cat' },
  ],
  yue: [
    { word: '枱', translation: 'Table' }, { word: '窗', translation: 'Window' },
    { word: '書', translation: 'Book' }, { word: '朝早', translation: 'Morning' },
    { word: '貓', translation: 'Cat' },
  ],
};

const capture = capturingProvider();
const silence = console.log;
console.log = () => {};
await identifyFromPhoto('FAKEBASE64', language, 'FAKESCENE', {
  stickerCount,
  knownWords: stickerCount >= 10 ? KNOWN[language] : [],
  recentGrammarKeys: [],
}, { providers: [capture.provider], sleep: async () => {} });
console.log = silence;

const prompt = capture.prompt();
console.log(`\n\x1b[1m${language} · ${stickerCount} cards · band ${bandFor(stickerCount)}\x1b[0m`);
console.log('─'.repeat(78));
console.log(prompt);
console.log('─'.repeat(78));
console.log(`${prompt.length} characters · ${capture.imageCount()} images\n`);
