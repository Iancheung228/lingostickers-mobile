// ---------------------------------------------------------------------------
// Grammar syllabus — the teaching point is an INPUT to the sentence, not a
// label read off it afterwards.
//
// The old prompt asked the vision model to describe the photo and then, in
// `sentence_insight`, to name whatever grammar the sentence happened to use.
// That is post-hoc rationalisation: the model commits to a caption, then
// hunts it for something teachable. Whether any given scan taught the learner
// a structure worth knowing was left entirely to chance, and the same handful
// of easy structures (present tense, "X is on Y") came up over and over
// because those are what a caption naturally reaches for.
//
// This is the same mistake skills.md #6 describes for the cutout: correcting
// an answer downstream instead of making the thing you want an input. The fix
// is the same shape too — hand the model the structure and let the photo
// supply the content.
//
// Two targets are offered per scan rather than one. A photo of a sleeping cat
// cannot host every structure without the sentence turning into a contortion,
// and unnatural input is worse than input with no form focus at all — so the
// model picks whichever of the two the scene can carry, and reports back
// which one it used in `grammar_key`. That report is what feeds the
// no-repeats window on the next scan, so it has to be read back rather than
// assumed.
//
// Ordering within a language is roughly CEFR, but the real selection
// criterion was "high yield": structures that are frequent in speech, or
// where the language does something English does not (French `depuis` + the
// present, Japanese counters, Cantonese classifiers and aspect markers).
// Those are where a learner's errors actually live.
// ---------------------------------------------------------------------------

export type Language = 'fr' | 'ja' | 'yue';

/** Rough CEFR band. 1 ≈ A1, 2 ≈ A2, 3 ≈ B1. */
export type Band = 1 | 2 | 3;

export interface GrammarTarget {
  /** Stable id, stored on the sticker row so rotation can avoid repeats. */
  key: string;
  band: Band;
  /** English name of the pattern — goes into the prompt and the insight. */
  name: string;
  /** What the sentence must actually *do* to count as demonstrating it. */
  brief: string;
  /** A model sentence, so the instruction is shown as well as described. */
  example: string;
}

// --- French --------------------------------------------------------------
// Weighted toward the places French and English genuinely diverge: the
// partitive (English has no word for "some" here), possessives that agree
// with the thing owned rather than the owner, object pronouns that move in
// front of the verb, and `depuis` + present where English insists on a
// perfect.
const FR: GrammarTarget[] = [
  { key: 'fr.cest-adj', band: 1, name: 'c\'est / il est + adjective',
    brief: 'describe the object with être and an adjective that agrees in gender and number',
    example: "C'est une vieille tasse bleue." },
  { key: 'fr.il-y-a', band: 1, name: 'il y a',
    brief: 'use "il y a" to say what is present in the scene',
    example: "Il y a encore du café dans la tasse." },
  { key: 'fr.partitif', band: 1, name: 'the partitive (du / de la / des)',
    brief: 'use a partitive article for an uncountable or unspecified quantity — English simply has no word here',
    example: 'Je bois du café tous les matins.' },
  { key: 'fr.present-er', band: 1, name: 'present tense, regular -er verb',
    brief: 'build the sentence on a regular -er verb in the present',
    example: 'Je regarde la photo sur mon bureau.' },
  { key: 'fr.adj-position', band: 1, name: 'adjective position',
    brief: 'place the adjective correctly — most follow the noun, but beau/nouveau/vieux/petit/grand/bon come before it',
    example: 'un vieux livre relié / un livre rouge' },
  { key: 'fr.prep-lieu', band: 1, name: 'prepositions of place',
    brief: 'locate the object with sur / sous / dans / devant / à côté de',
    example: 'La clé est sous le carnet ouvert.' },
  { key: 'fr.possessif', band: 1, name: 'possessive adjectives',
    brief: 'use mon/ma/mes — they agree with the thing owned, not with the owner, so "son" is both "his" and "her"',
    example: "C'est ma tasse préférée." },
  { key: 'fr.negation', band: 1, name: 'negation with ne … pas',
    brief: 'wrap the conjugated verb in ne … pas',
    example: 'Je ne trouve pas mes clés.' },

  { key: 'fr.passe-compose', band: 2, name: 'passé composé with avoir',
    brief: 'say what happened, using avoir + past participle',
    example: "J'ai acheté ce café ce matin." },
  { key: 'fr.pc-etre', band: 2, name: 'passé composé with être',
    brief: 'use one of the être verbs (aller, venir, rester, sortir…) and agree the participle with the subject',
    example: 'Je suis allée au marché avant la pluie.' },
  { key: 'fr.futur-proche', band: 2, name: 'near future (aller + infinitive)',
    brief: 'say what is about to happen with aller + an infinitive',
    example: 'Je vais finir mon café avant qu\'il refroidisse.' },
  { key: 'fr.pronom-cod', band: 2, name: 'direct object pronoun',
    brief: 'replace the object with le / la / les and put it BEFORE the verb, unlike English',
    example: 'Je la bois toujours trop vite.' },
  { key: 'fr.pronominaux', band: 2, name: 'reflexive verbs',
    brief: 'use a reflexive verb (se lever, s\'asseoir, se trouver…) with its pronoun',
    example: 'Le chat s\'installe toujours sur ce coussin.' },
  { key: 'fr.comparatif', band: 2, name: 'comparison (plus / moins / aussi … que)',
    brief: 'compare two things in the scene',
    example: 'Ce livre est plus vieux que moi.' },
  { key: 'fr.imperatif', band: 2, name: 'the imperative',
    brief: 'give an instruction or make a request in the imperative',
    example: 'Passe-moi la tasse bleue, s\'il te plaît.' },
  { key: 'fr.depuis', band: 2, name: 'depuis + present tense',
    brief: 'express how long something has been going on with depuis and the PRESENT tense — English uses a perfect here and learners get this wrong constantly',
    example: "J'ai cette tasse depuis trois ans." },

  { key: 'fr.imparfait', band: 3, name: 'imparfait vs passé composé',
    brief: 'set a background in the imparfait and land a completed event on it in the passé composé',
    example: 'Il pleuvait quand j\'ai pris cette photo.' },
  { key: 'fr.subjonctif', band: 3, name: 'the subjunctive',
    brief: 'trigger the subjunctive with il faut que / je veux que / bien que',
    example: 'Il faut que je range enfin ce bureau.' },
  { key: 'fr.y-en', band: 3, name: 'the pronouns y and en',
    brief: 'replace a place with y, or a quantity/de-phrase with en',
    example: "J'en bois trois par jour." },
  { key: 'fr.relatif', band: 3, name: 'relative clauses (qui / que / où)',
    brief: 'attach a relative clause to the object, choosing qui or que by its role in the clause',
    example: "C'est la tasse que ma sœur m'a offerte." },
  { key: 'fr.conditionnel', band: 3, name: 'the conditional',
    brief: 'soften a wish or request, or state a hypothetical, in the conditional',
    example: 'Je prendrais bien un autre café.' },
  { key: 'fr.si-clauses', band: 3, name: 'si + present → future',
    brief: 'build a real condition: si + present in one half, future or near future in the other',
    example: 'Si je finis ce café, je vais mal dormir.' },
];

// --- Japanese ------------------------------------------------------------
// Particles first, because a Japanese sentence is its particles, and counters
// early because they are the thing an English speaker does not expect to
// exist at all. The later bands are the classic error-generators:
// transitive/intransitive pairs, giving-and-receiving verbs, and 〜てしまう.
const JA: GrammarTarget[] = [
  { key: 'ja.wa-desu', band: 1, name: '〜は〜です',
    brief: 'a plain topic-comment statement with は and です',
    example: 'これは母のカップです。' },
  { key: 'ja.i-adjective', band: 1, name: 'い-adjectives',
    brief: 'describe the object with an い-adjective, either before the noun or as the predicate',
    example: 'この本はとても古いです。' },
  { key: 'ja.na-adjective', band: 1, name: 'な-adjectives',
    brief: 'use a な-adjective, keeping the な when it sits before a noun',
    example: '静かな部屋で本を読みます。' },
  { key: 'ja.aru-iru', band: 1, name: '〜に〜があります / います',
    brief: 'say what exists where, choosing あります for objects and います for living things',
    example: '机の上にコップがあります。' },
  { key: 'ja.wo-verb', band: 1, name: 'を + verb',
    brief: 'mark the direct object with を',
    example: '毎朝コーヒーを飲みます。' },
  { key: 'ja.de-place', band: 1, name: 'で marking where an action happens',
    brief: 'use で for the place of the action — not に, which marks a destination or a location of existence',
    example: 'この喫茶店で勉強しました。' },
  { key: 'ja.counters', band: 1, name: 'counters',
    brief: 'count something in the scene with the right counter (個・本・枚・杯・匹・冊) — English has no equivalent',
    example: 'コーヒーを二杯飲みました。' },
  { key: 'ja.past-mashita', band: 1, name: 'polite past 〜ました',
    brief: 'say what happened in the polite past',
    example: '昨日この店で買いました。' },

  { key: 'ja.te-iru', band: 2, name: '〜ている',
    brief: 'express an action in progress, or a resulting state that is still true',
    example: '猫が窓のそばで寝ています。' },
  { key: 'ja.te-kudasai', band: 2, name: '〜てください',
    brief: 'ask someone to do something with the て-form + ください',
    example: 'そのカップを取ってください。' },
  { key: 'ja.tai', band: 2, name: '〜たい',
    brief: 'say what you want to do, remembering たい conjugates like an い-adjective',
    example: 'もう一杯飲みたいです。' },
  { key: 'ja.kara-node', band: 2, name: 'から / ので for reasons',
    brief: 'give a reason and its consequence in one sentence',
    example: '寒いから、熱いお茶を入れました。' },
  { key: 'ja.noun-modify', band: 2, name: 'a clause modifying a noun',
    brief: 'put a whole plain-form clause in front of the noun — Japanese has no relative pronoun, the clause simply leans on the noun',
    example: '母がくれたカップです。' },
  { key: 'ja.wa-ga', band: 2, name: 'は vs が',
    brief: 'use the contrast deliberately — は for what the sentence is about, が for new or singled-out information',
    example: '部屋は暗いですが、この窓だけが明るいです。' },
  { key: 'ja.te-mo-ii', band: 2, name: 'permission and obligation',
    brief: 'use 〜てもいい for permission or 〜なければなりません for obligation',
    example: 'この席に座ってもいいですか。' },
  { key: 'ja.to-omoimasu', band: 2, name: '〜と思います',
    brief: 'report an opinion or guess, quoting a plain-form clause with と',
    example: 'この写真はよく撮れたと思います。' },

  { key: 'ja.te-shimau', band: 3, name: '〜てしまう',
    brief: 'mark something as finished off, or as a regret — the nuance English carries only by tone',
    example: 'コーヒーをこぼしてしまいました。' },
  { key: 'ja.transitive-pairs', band: 3, name: 'transitive / intransitive pairs',
    brief: 'pick correctly between a pair like 開く/開ける, 閉まる/閉める, 落ちる/落とす',
    example: '窓が開いていて、風が入ってきます。' },
  { key: 'ja.ageru-kureru', band: 3, name: 'あげる / くれる / もらう',
    brief: 'describe a gift with the verb that matches its direction — English uses "give" for all of them',
    example: '友達がくれた本を今読んでいます。' },
  { key: 'ja.passive', band: 3, name: 'the passive',
    brief: 'use the passive, including the "suffering passive" for something done to you',
    example: '朝、猫に起こされました。' },
  { key: 'ja.tara-ba', band: 3, name: 'conditionals (〜たら / 〜ば)',
    brief: 'set up a condition and its result',
    example: '家に帰ったら、まずお茶を入れます。' },
  { key: 'ja.nagara-mae-ato', band: 3, name: 'sequencing (〜ながら / 〜前に / 〜てから)',
    brief: 'relate two actions in time within one sentence',
    example: '音楽を聞きながら、この絵を描きました。' },
];

// --- Cantonese -----------------------------------------------------------
// Classifiers appear in band 1 because they are unavoidable — you cannot say
// "this cup" without one. Aspect markers (咗・緊・過・住・晒) get their own
// entries rather than being lumped as "tense", because they are separate
// choices and learners collapse them. Final particles are here on purpose:
// they are most of what makes Cantonese sound like Cantonese, and no textbook
// sentence ever contains one.
const YUE: GrammarTarget[] = [
  { key: 'yue.hai-noun', band: 1, name: '係 + noun',
    brief: 'identify something with 係 — and remember 係 is NOT used before an adjective',
    example: '呢個係我媽媽嘅杯。' },
  { key: 'yue.classifier', band: 1, name: 'classifiers',
    brief: 'use the right classifier (個・杯・隻・本・張・部) between the number or demonstrative and the noun',
    example: '枱上面有兩本書。' },
  { key: 'yue.hou-adj', band: 1, name: 'adjective predicates with 好',
    brief: 'describe with 好 + adjective and no 係 at all',
    example: '呢本書好舊。' },
  { key: 'yue.hai-dou', band: 1, name: '喺…度 for location',
    brief: 'say where something is with 喺 and a place word',
    example: '杯咖啡喺張枱度。' },
  { key: 'yue.jau', band: 1, name: '有 for existence and possession',
    brief: 'say what there is, or what someone has, with 有',
    example: '我有一隻好鍾意瞓喺度嘅貓。' },
  { key: 'yue.ni-go', band: 1, name: '呢 / 嗰 + classifier',
    brief: 'point at something with 呢 or 嗰 plus its classifier',
    example: '嗰隻貓成日瞓喺窗邊。' },
  { key: 'yue.m-mou', band: 1, name: '唔 vs 冇',
    brief: 'negate correctly — 唔 for "not", 冇 for "have not / did not"',
    example: '我今日冇飲咖啡。' },

  { key: 'yue.zo', band: 2, name: '咗 (completed action)',
    brief: 'mark an action as finished with 咗 right after the verb',
    example: '我飲咗成杯咖啡。' },
  { key: 'yue.gan', band: 2, name: '緊 (in progress)',
    brief: 'mark an action as ongoing with 緊',
    example: '隻貓喺張櫈度瞓緊覺。' },
  { key: 'yue.gwo', band: 2, name: '過 (experience)',
    brief: 'say you have ever done something, with 過',
    example: '我去過呢間茶餐廳好多次。' },
  { key: 'yue.ge-possessive', band: 2, name: '嘅 (possession and modification)',
    brief: 'link a modifier to a noun with 嘅',
    example: '呢個係我阿媽用咗二十年嘅杯。' },
  { key: 'yue.a-not-a', band: 2, name: 'A-not-A questions',
    brief: 'ask a yes/no question by repeating the verb around 唔 or 冇 (係唔係, 有冇, 飲唔飲)',
    example: '你飲唔飲多杯茶？' },
  { key: 'yue.final-particles', band: 2, name: 'sentence-final particles',
    brief: 'end with 啦 / 囉 / 㗎 / 喎 / 添 and let it carry the attitude — this is what makes it sound spoken rather than written',
    example: '呢杯茶好靚㗎！' },
  { key: 'yue.comparative', band: 2, name: 'comparison with 過 or 啲',
    brief: 'compare two things: adjective + 過 + the other, or adjective + 啲',
    example: '呢杯茶熱過嗰杯。' },
  { key: 'yue.bei-give', band: 2, name: '畀 (give / for / by)',
    brief: 'use 畀 for giving something to someone, or for doing something for them',
    example: '我阿爸畀咗個杯我。' },

  { key: 'yue.resultative', band: 3, name: 'resultative complements',
    brief: 'attach a result to the verb (食完, 搵到, 聽唔明, 買錯)',
    example: '我終於搵到本書喇。' },
  { key: 'yue.directional', band: 3, name: 'directional complements',
    brief: 'add direction to the verb with 出嚟 / 返去 / 上去 / 落嚟',
    example: '我攞返個舊杯出嚟用。' },
  { key: 'yue.saai', band: 3, name: '晒 (all / completely)',
    brief: 'use 晒 to say the action covered everything',
    example: '啲咖啡俾我飲晒喇。' },
  { key: 'yue.jyu', band: 3, name: '住 (a state that is holding)',
    brief: 'mark a state left in place with 住',
    example: '個窗開住，好涼快。' },
  { key: 'yue.duration', band: 3, name: 'duration phrases',
    brief: 'put the length of time AFTER the verb, not before it',
    example: '我喺度坐咗成個鐘。' },
  { key: 'yue.topic-fronting', band: 3, name: 'fronting the topic',
    brief: 'move what the sentence is about to the front and comment on it',
    example: '呢啲舊相，我一直冇捨得掉。' },
];

const SYLLABUS: Record<Language, GrammarTarget[]> = { fr: FR, ja: JA, yue: YUE };

/** Every key the model is allowed to claim, per language. */
export function isKnownGrammarKey(language: Language, key: unknown): key is string {
  return typeof key === 'string' && SYLLABUS[language].some(t => t.key === key);
}

// Where the bands change hands. Deliberately early: 15 cards is one or two
// sittings, and a learner who is still being fed nothing but "c'est une tasse
// rouge" at card 20 has stopped being taught anything. Lower bands never drop
// out of the pool (see pickTargets), so moving up adds material rather than
// replacing it.
const BAND_THRESHOLDS = { two: 15, three: 50 } as const;

export function bandFor(stickerCount: number): Band {
  if (stickerCount >= BAND_THRESHOLDS.three) return 3;
  if (stickerCount >= BAND_THRESHOLDS.two) return 2;
  return 1;
}

/**
 * Picks the two structures offered to the model for one scan.
 *
 * Three things this has to balance:
 *
 * - **New material vs. spacing.** Targets at the learner's current band are
 *   entered twice into the pool and everything below once, so roughly two
 *   thirds of scans push into current material and a third revisit something
 *   already met. Dropping the lower bands entirely would mean a structure is
 *   taught for fifteen cards and then never seen again, which is the exact
 *   opposite of what the rest of this app does with spacing.
 * - **No repeats.** `recentKeys` (what the last handful of scans actually
 *   used, read back off the rows rather than assumed) is excluded outright.
 *   If that empties the pool — a band-1 learner has only eight targets — the
 *   exclusion is dropped rather than returning nothing.
 * - **A real choice.** The two targets must differ, and the alternate is
 *   drawn from a different band where possible, so the model is choosing
 *   between genuinely different sentences rather than two flavours of past
 *   tense. That choice is what lets it refuse a structure the photo cannot
 *   host without contortion.
 */
export function pickTargets(
  language: Language,
  stickerCount: number,
  recentKeys: string[] = [],
  rng: () => number = Math.random,
): [GrammarTarget, GrammarTarget] {
  const all = SYLLABUS[language];
  const band = bandFor(stickerCount);
  const recent = new Set(recentKeys);

  const eligible = all.filter(t => t.band <= band);
  const weighted: GrammarTarget[] = [];
  for (const t of eligible) {
    weighted.push(t);
    if (t.band === band) weighted.push(t);
  }

  const fresh = weighted.filter(t => !recent.has(t.key));
  const pool = fresh.length > 0 ? fresh : weighted;

  const primary = pool[Math.floor(rng() * pool.length)];

  // Prefer an alternate from another band, so the pair spans difficulty.
  const others = pool.filter(t => t.key !== primary.key);
  const differentBand = others.filter(t => t.band !== primary.band);
  const altPool = differentBand.length > 0 ? differentBand : others;
  const alternate = altPool.length > 0
    ? altPool[Math.floor(rng() * altPool.length)]
    // Only reachable if a language ever ships a single target — keep the
    // signature honest rather than returning a one-element tuple.
    : primary;

  return [primary, alternate];
}

/**
 * The length and vocabulary budget for a band, phrased in units the language
 * actually has — "eight words" is meaningless for Japanese.
 *
 * These numbers were badly wrong on the first pass and the measurement is
 * worth keeping, because the mistake is an easy one to repeat. The budget
 * started at 6–10 words with "no rare vocabulary at all", on the reasoning
 * that a beginner needs high lexical coverage. Run against real photographs
 * it produced "Il y a du soleil dans le ciel", "ビルは高いです", "嗰架車好靚仔"
 * — sentences that would describe any photograph ever taken, from an app
 * whose entire premise is that the sentence is about YOUR photograph. A
 * mandated structure spends three of those ten words before the picture gets
 * a look in.
 *
 * The coverage research those numbers came from is about reading extended
 * text, where an unknown word blocks the words after it. This is one sentence
 * sitting beside the photo it describes and its own English translation: the
 * picture carries the meaning, so coverage was never the binding constraint.
 *
 * So the ceiling now discriminates by *word class* rather than by count. A
 * concrete noun the learner can point at in their own photo — parking lot,
 * 停車場, 高層ビル — is exactly the word this app exists to teach, whether or
 * not it is frequent. A rare adjective or verb is what actually costs:
 * *chipped*, *nestled*, *gleaming* are vivid, unusable, and never recur.
 */
export function budgetFor(band: Band, language: Language): { length: string; vocabulary: string } {
  const length = language === 'fr'
    ? { 1: 'Aim for about 10–14 words.', 2: 'Aim for about 12–18 words.', 3: 'Aim for about 14–22 words.' }[band]
    : { 1: 'Aim for roughly 14–22 characters.', 2: 'Aim for roughly 18–28 characters.', 3: 'Aim for roughly 22–34 characters.' }[band];

  const nouns = 'Naming a real thing in the photo is always allowed, even if that noun is uncommon — a concrete object the learner can point at is worth learning. What to avoid is uncommon ADJECTIVES and VERBS: they are vivid, unusable and never come up again.';
  const vocabulary = {
    1: `Outside the headword and the things you are naming, use plain everyday words — roughly the most common 1000. ${nouns}`,
    2: `Outside the headword and the things you are naming, stay around the most common 2000 words. ${nouns}`,
    3: `Outside the headword and the things you are naming, stay around the most common 3000 words. ${nouns}`,
  }[band];

  return { length, vocabulary };
}

/**
 * Renders the two targets as the prompt block the model reads.
 *
 * Shown as a *choice* with the reporting requirement attached, because the
 * key coming back is what drives the next scan's rotation — a target that is
 * silently swapped for something easier and reported as used would poison the
 * no-repeats window and the insight in the same move.
 */
export function renderTargetChoice(targets: [GrammarTarget, GrammarTarget]): string {
  const lines = targets.map(t => `   • "${t.key}" — ${t.name}: ${t.brief}. (e.g. ${t.example})`);
  return `Build the sentence around ONE of these two structures — whichever this particular photo can carry without sounding forced:
${lines.join('\n')}
   Put the key of the one you used in "grammar_key". The sentence must genuinely demonstrate it, not merely be compatible with it. If neither structure can describe what is in the photo, still use one of them to say something true and natural about this object in this place — the structure is the requirement, an awkward sentence is not.`;
}
