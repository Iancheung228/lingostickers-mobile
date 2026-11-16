import { memo, useEffect, useRef, useState } from 'react';
import { Animated, LayoutAnimation, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Lightbulb, ChevronDown, ChevronUp, MapPin, Volume2, ImageOff } from 'lucide-react-native';
import { SentenceGloss, SentenceInsight } from '@/components/SentenceGloss';
import type { EditTarget } from '@/lib/cardEdit';
import { frenchParts } from '@/lib/hint';
import type { Sticker, StickerDraft, Language } from '@/lib/types';
import { fonts, radii, sentenceFontFor, spacing, MIN_TAP } from '@/constants/theme';
import { useMotion } from '@/lib/motion';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

// ONE card, three postures (A-card 0): the study front, the answer (study back,
// card detail body, new-card reveal), and the helpers they share. The study
// card, the card detail and the scan reveal all render <CardBack/> so a field
// looks and reads the same wherever you meet it.

/** What the card faces need. A `Sticker` satisfies it; a scan draft maps onto it. */
export interface CardContent {
  language: Language;
  word: string;
  reading: string;
  translation: string;
  part_of_speech: string | null;
  sentence: string;
  sentence_translation: string;
  sentence_gloss: unknown;
  sentence_insight: string | null;
  forms?: { l: string; v: string }[] | null;
  notes?: string | null;
  location_label?: string | null;
  discovered_at?: string | null;
}

export function contentFromDraft(d: StickerDraft): CardContent {
  return {
    language: d.language, word: d.word, reading: d.reading, translation: d.translation,
    part_of_speech: d.partOfSpeech, sentence: d.sentence, sentence_translation: d.sentenceTranslation,
    sentence_gloss: d.sentenceGloss, sentence_insight: d.sentenceInsight,
    location_label: d.locationLabel, discovered_at: d.discoveredAt,
  };
}

export type CardVariant = 'study' | 'detail' | 'reveal';

// ---------------------------------------------------------------------------
// Copy and labels shared by the faces and by VoiceOver
// ---------------------------------------------------------------------------

export const STILL_LEARNING = 'Still learning — one more look';

/**
 * The question on the front. A scan's photo shows one object, so the photo
 * is the cue. A scene card shares its photo with its siblings (a verb, an
 * adjective, an idiom from the same picture), so it has to say which word.
 */
export function frontQuestion(card: Pick<Sticker, 'source' | 'translation' | 'image_path'>): string {
  if (card.source === 'scene') return `How do you say “${card.translation}”?`;
  return card.image_path ? 'What did you call this?' : 'How do you say this?';
}

/** What VoiceOver reads for the card's front: the prompt, plus any hint shown. */
export function promptLabel(card: Pick<Sticker, 'source' | 'translation' | 'image_path'>, hints: string[]): string {
  return hints.length ? `${frontQuestion(card)} Hint: ${hints.join('. ')}` : frontQuestion(card);
}

/** What VoiceOver reads for the card's back: the answer and its example. */
export function answerLabel(card: CardContent): string {
  const parts = [card.word];
  if (card.reading) parts.push(card.reading);
  let label = `${parts.join(', ')}, means ${card.translation}`;
  if (card.sentence) label += `. ${card.sentence} ${card.sentence_translation}`.trimEnd();
  return label;
}

/**
 * Splits a sentence around the headword so it can be picked out in place.
 *
 * The headword is often stored with an article the sentence doesn't repeat
 * ("Le Café" vs "…un café…"), so a failed exact match falls back to the word
 * without its article, then the last whitespace-separated token. Returns null
 * when none is found, and the caller renders the sentence plain.
 */
export function splitAroundWord(sentence: string, word: string): [string, string, string] | null {
  const attempt = (needle: string): [string, string, string] | null => {
    if (!needle) return null;
    const at = sentence.toLowerCase().indexOf(needle.toLowerCase());
    if (at < 0) return null;
    return [sentence.slice(0, at), sentence.slice(at, at + needle.length), sentence.slice(at + needle.length)];
  };
  const tokens = word.trim().split(/\s+/);
  return attempt(word.trim()) ?? attempt(frenchParts(word).bare) ?? attempt(tokens[tokens.length - 1]);
}

const shortDate = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

// ---------------------------------------------------------------------------
// Front: the photo, the question, a quiet hint. The word never appears.
// ---------------------------------------------------------------------------

export function CardFront({ card, imageUrl, hints, hasMoreHints, totalHints, onHint, stillLearning }: {
  card: Sticker;
  imageUrl: string | null;
  /// The hint tiers revealed so far, mildest first.
  hints: string[];
  hasMoreHints: boolean;
  /// How many hint tiers this card has in all (for "2 of 3").
  totalHints: number;
  onHint: () => void;
  stillLearning: boolean;
}) {
  const { stickerShadow, type, colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { ms } = useMotion();
  const [well, setWell] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setWell({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const size = Math.min(well.w, well.h) * 0.62;
  const hintFade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    hintFade.setValue(0);
    Animated.timing(hintFade, { toValue: 1, duration: ms(150) || 1, useNativeDriver: true }).start();
  }, [hints.length]);

  const photo = !!card.image_path;
  const scene = card.source === 'scene';

  return (
    <View style={styles.front}>
      <View style={styles.well} onLayout={onLayout}>
        {photo ? (
          imageUrl ? (
            <View style={[stickerShadow, { width: size, height: size, opacity: scene ? 0.5 : 1 }]}>
              <Image
                source={{ uri: imageUrl, cacheKey: card.image_path ?? undefined }}
                cachePolicy="memory-disk"
                contentFit="contain"
                style={styles.fill}
              />
            </View>
          ) : <View style={[styles.skeleton, { width: size, height: size }]} />
        ) : (
          // No picture to cue from: the English meaning is the cue. Never the
          // headword's first character, which would give the answer away.
          <View style={styles.meaningCue}>
            <Text style={styles.meaningCueText} maxFontSizeMultiplier={type.title.maxFontSizeMultiplier}>
              {card.translation}
            </Text>
            {!!card.part_of_speech && <PosChip text={card.part_of_speech} />}
            <ImageOff size={16} strokeWidth={1.75} color={colors.inkLight} style={{ marginTop: spacing.ms }} />
          </View>
        )}
      </View>

      {stillLearning && <Text style={styles.stillLearning}>{STILL_LEARNING}</Text>}
      <Text style={styles.prompt} maxFontSizeMultiplier={type.h2.maxFontSizeMultiplier}>{frontQuestion(card)}</Text>

      <Animated.View style={[styles.hintArea, { opacity: hintFade }]}>
        {hints.length > 0 && (
          <View style={styles.hintBox} accessible accessibilityLabel={`Hint ${hints.length} of ${totalHints}: ${hints[hints.length - 1]}`}>
            <Text style={styles.hintOverline} maxFontSizeMultiplier={1.3}>HINT</Text>
            <Text style={styles.hintText} maxFontSizeMultiplier={type.body.maxFontSizeMultiplier}>
              {hints[hints.length - 1]}
            </Text>
          </View>
        )}
        {hasMoreHints ? (
          <Pressable
            onPress={onHint}
            style={({ pressed }) => [styles.hintPill, pressed && styles.hintPillPressed]}
            accessibilityRole="button"
            accessibilityLabel={hints.length ? `Next hint, ${hints.length + 1} of ${totalHints}` : `Hint, 1 of ${totalHints}`}
            accessibilityHint="Shows a little more of the word. Nothing is counted against you."
          >
            <Lightbulb size={16} strokeWidth={2} color={colors.inkDark} />
            <Text style={styles.hintPillText} maxFontSizeMultiplier={1.5}>
              {hints.length ? `Next hint (${hints.length + 1} of ${totalHints})` : `Hint (1 of ${totalHints})`}
            </Text>
          </Pressable>
        ) : hints.length > 0 ? (
          <View
            style={[styles.hintPill, styles.hintPillDone]}
            accessible accessibilityRole="button" accessibilityState={{ disabled: true }} accessibilityLabel="No more hints"
          >
            <Text style={[styles.hintPillText, { color: colors.inkLight }]} maxFontSizeMultiplier={1.5}>No more hints</Text>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

export function PosChip({ text }: { text: string }) {
  const { type } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.pos}>
      <Text style={styles.posText} maxFontSizeMultiplier={type.micro.maxFontSizeMultiplier}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Back: the answer. Same component for the study back, the detail body and the
// new-card reveal.
// ---------------------------------------------------------------------------

interface CardBackProps {
  card: CardContent;
  variant: CardVariant;
  /// 56pt thumbnail, top right (study only; detail has its hero).
  thumbUrl?: string | null;
  thumbPath?: string | null;
  onSpeak: () => void;
  /// Which fields can be tapped to edit, and what happens. Study passes none.
  onEdit?: (target: EditTarget) => void;
  editable?: EditTarget[];
  /// Study: the memory line opens the card detail over the session.
  onOpenMemory?: () => void;
  /// Reveal opens "More" on first meeting.
  moreOpen?: boolean;
  /// Reveal only: fade a field while its translation is being rewritten.
  fading?: { word?: boolean; sentence?: boolean };
  /// Reveal only: a control drawn right under the headword and its meaning
  /// (the "Not a dog?" button), above the sentence.
  underHeadword?: React.ReactNode;
}

function CardBackImpl({
  card, variant, thumbUrl, thumbPath, onSpeak, onEdit, editable, onOpenMemory, moreOpen, fading, underHeadword,
}: CardBackProps) {
  const { headwordStyle, type, colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { reduced } = useMotion();
  const [translationShown, setTranslationShown] = useState(variant !== 'study');
  const [more, setMore] = useState(!!moreOpen);
  const parts = splitAroundWord(card.sentence, card.word);
  const wordFont = headwordStyle(card.language);
  const sentenceFont = sentenceFontFor(card.language);
  const canEdit = (t: EditTarget) => !!onEdit && (!editable || editable.includes(t));
  const hasMore = !!(
    (card.sentence_gloss && card.sentence) || card.sentence_insight?.trim() || (card.forms && card.forms.length)
  );
  const place = card.location_label?.trim() || '';
  const note = card.notes?.trim() || '';
  const hasMemory = !!(place || note);

  return (
    <View>
      {variant === 'study' && (
        <View style={styles.thumb}>
          {thumbUrl && (
            <Image
              source={{ uri: thumbUrl, cacheKey: thumbPath ?? undefined }}
              cachePolicy="memory-disk"
              contentFit="cover"
              style={styles.fill}
            />
          )}
        </View>
      )}

      <Editable on={canEdit('word')} onPress={() => onEdit?.('word')} label={`Word, ${card.word}. Edit`}>
        <Text
          style={[wordFont, { opacity: fading?.word ? 0.5 : 1 }, variant === 'study' && styles.beside]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          maxFontSizeMultiplier={type.headword.maxFontSizeMultiplier}
        >
          {card.word}
        </Text>
      </Editable>

      <View style={styles.readingRow}>
        <Editable
          on={canEdit('reading') && !!card.reading}
          onPress={() => onEdit?.('reading')}
          label={`Reading, ${card.reading}. Edit`}
          style={styles.readingEdit}
        >
          {!!card.reading && (
            <Text style={[styles.reading, { opacity: fading?.word ? 0.5 : 1 }]} numberOfLines={2} maxFontSizeMultiplier={type.data.maxFontSizeMultiplier}>
              [{card.reading}]
            </Text>
          )}
        </Editable>
        <Pressable
          onPress={onSpeak}
          style={({ pressed }) => [styles.speak, pressed && styles.speakPressed]}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={`Hear ${card.word} pronounced`}
        >
          <Volume2 size={18} strokeWidth={1.75} color={colors.inkDark} />
        </Pressable>
      </View>

      <Editable on={canEdit('meaning')} onPress={() => onEdit?.('meaning')} label={`Meaning, ${card.translation}. Edit`}>
        <View style={styles.meaningRow}>
          <Text style={styles.meaning} maxFontSizeMultiplier={type.h2.maxFontSizeMultiplier}>
            {card.translation}
          </Text>
          {!!card.part_of_speech && <PosChip text={card.part_of_speech} />}
        </View>
      </Editable>

      {underHeadword}

      {!!card.sentence && (
        <>
          <View style={styles.divider} />
          <Editable on={canEdit('sentence')} onPress={() => onEdit?.('sentence')} label={`Sentence, ${card.sentence}. Edit`}>
            <Text
              style={[styles.sentence, { fontFamily: sentenceFont, opacity: fading?.sentence ? 0.5 : 1 }]}
              maxFontSizeMultiplier={type.body.maxFontSizeMultiplier}
            >
              {parts ? (
                <>
                  {parts[0]}
                  <Text style={styles.sentenceWord}>{parts[1]}</Text>
                  {parts[2]}
                </>
              ) : card.sentence}
            </Text>
            {translationShown ? (
              <Text style={[styles.translation, fading?.sentence && { opacity: 0.5 }]} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>
                {card.sentence_translation}
              </Text>
            ) : null}
          </Editable>
          {!translationShown && (
            <Pressable
              onPress={() => setTranslationShown(true)}
              hitSlop={{ top: 12, bottom: 12, right: 24 }}
              accessibilityRole="button"
              accessibilityLabel="Show translation"
            >
              <Text style={styles.showTranslation} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>Show translation</Text>
            </Pressable>
          )}
        </>
      )}

      {hasMemory && variant !== 'reveal' && (
        <MemoryLine
          place={place}
          note={variant === 'study' ? '' : note}
          date={shortDate(card.discovered_at)}
          onPress={variant === 'study' ? onOpenMemory : canEdit('note') ? () => onEdit?.('note') : undefined}
          label={variant === 'study' ? 'Open card details' : `What happened. ${note || place}. Edit`}
        />
      )}
      {!hasMemory && variant === 'detail' && canEdit('note') && (
        <Pressable
          onPress={() => onEdit?.('note')}
          style={({ pressed }) => [styles.notePrompt, pressed && { backgroundColor: colors.sand }]}
          accessibilityRole="button"
          accessibilityLabel="Add what happened that day"
        >
          <MapPin size={16} strokeWidth={1.75} color={colors.inkLight} />
          <Text style={styles.memoryText} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>Add what happened that day</Text>
        </Pressable>
      )}

      {hasMore && (
        <>
          <Pressable
            onPress={() => {
              if (!reduced) LayoutAnimation.configureNext({ duration: 200, update: { type: 'easeInEaseOut' } });
              setMore(m => !m);
            }}
            style={styles.moreRow}
            accessibilityRole="button"
            accessibilityState={{ expanded: more }}
            accessibilityLabel="More"
          >
            <Text style={styles.moreText} maxFontSizeMultiplier={1.5}>More</Text>
            {more
              ? <ChevronUp size={16} strokeWidth={2} color={colors.inkDark} />
              : <ChevronDown size={16} strokeWidth={2} color={colors.inkDark} />}
          </Pressable>
          {more && (
            <View>
              <SentenceGloss raw={card.sentence_gloss} sentence={card.sentence} language={card.language} />
              <SentenceInsight text={card.sentence_insight} />
              <Forms forms={card.forms} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

export const CardBack = memo(CardBackImpl);

function Forms({ forms }: { forms?: CardContent['forms'] }) {
  const { type } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const rows = (forms ?? []).filter(f => f && f.l && f.v);
  if (!rows.length) return null;
  return (
    <View style={styles.forms}>
      <Text style={styles.formsLabel} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>Forms</Text>
      {rows.map((f, i) => (
        <View key={`${f.l}-${i}`} style={styles.formRow} accessible accessibilityLabel={`${f.l}, ${f.v}`}>
          <Text style={styles.formKey} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>{f.l}</Text>
          <Text style={styles.formVal} maxFontSizeMultiplier={type.body.maxFontSizeMultiplier}>{f.v}</Text>
        </View>
      ))}
    </View>
  );
}

/** One muted line: where, when, and (in detail) what happened. Hidden when there is nothing. */
function MemoryLine({ place, note, date, onPress, label }: {
  place: string; note: string; date: string; onPress?: () => void; label: string;
}) {
  const { colors, type } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const body = (
    <>
      <MapPin size={16} strokeWidth={1.75} color={colors.inkLight} style={styles.memoryPin} />
      <View style={styles.memoryBody}>
        {!!note && <Text style={styles.memoryText} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>{note}</Text>}
        <Text style={styles.memoryText} maxFontSizeMultiplier={type.small.maxFontSizeMultiplier}>
          {place}
          {!!place && !!date ? ' · ' : ''}
          {!!date && <Text style={styles.memoryDate}>{date}</Text>}
        </Text>
      </View>
    </>
  );
  if (!onPress) return <View style={styles.memory}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.memory, pressed && { backgroundColor: colors.sand2 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {body}
    </Pressable>
  );
}

/** A field that opens its editor when tapped; plain content otherwise. */
function Editable({ on, onPress, label, children, style }: {
  on: boolean; onPress: () => void; label: string; children: React.ReactNode; style?: object;
}) {
  const styles = useThemedStyles(makeStyles);
  if (!on) return <View style={style}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.editable, style, pressed && styles.editablePressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {children}
    </Pressable>
  );
}

const makeStyles = ({ colors, type }: Theme) => StyleSheet.create({
  fill: { width: '100%', height: '100%' },

  // ── front ──
  front: { flex: 1, padding: 12 },
  well: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  skeleton: { borderRadius: radii.md, backgroundColor: colors.sand2 },
  meaningCue: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  meaningCueText: { ...type.title, textAlign: 'center' },
  stillLearning: { ...type.small, textAlign: 'center', marginTop: spacing.ms },
  prompt: { ...type.h2, textAlign: 'center', marginTop: spacing.md },
  hintArea: { minHeight: 44 + spacing.md, alignItems: 'center', justifyContent: 'flex-start', gap: spacing.sm, marginTop: spacing.ms, paddingBottom: 44 },
  hintBox: {
    alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radii.md, backgroundColor: colors.sand, gap: 2, maxWidth: '100%',
  },
  hintOverline: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 14, letterSpacing: 1, color: colors.inkMid },
  hintText: { ...type.body, color: colors.inkDark, textAlign: 'center' },
  hintPill: {
    height: 44,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.terraLight,
  },
  hintPillDone: { backgroundColor: colors.sand, opacity: 0.8 },
  hintPillPressed: { backgroundColor: colors.terraTintPressed },
  hintPillText: { ...type.button, fontSize: 15, lineHeight: 20 },

  // ── back ──
  thumb: {
    position: 'absolute', right: 0, top: 0, width: 56, height: 56,
    borderRadius: radii.sm, backgroundColor: colors.sand, overflow: 'hidden',
  },
  beside: { paddingRight: 64 },
  editable: { borderRadius: radii.sm, marginHorizontal: -6, paddingHorizontal: 6 },
  editablePressed: { backgroundColor: colors.sand },
  readingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  readingEdit: { flexShrink: 1 },
  reading: { ...type.data, fontSize: 16, lineHeight: 22, color: colors.inkLight },
  speak: {
    width: 44, height: 44, borderRadius: radii.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.terraLight,
  },
  speakPressed: { backgroundColor: colors.terraTintPressed },
  meaningRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  meaning: { ...type.h2, color: colors.inkMid, flexShrink: 1 },
  pos: { borderRadius: radii.full, backgroundColor: colors.sand, paddingHorizontal: 10, paddingVertical: 2 },
  posText: { ...type.micro },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: 18 },
  // The sentence is the one place Klee One is set at body size.
  sentence: { fontSize: 20, lineHeight: 30, color: colors.inkMid },
  sentenceWord: { color: colors.inkDark, textDecorationLine: 'underline' },
  translation: { ...type.small, marginTop: spacing.sm },
  showTranslation: { ...type.small, textDecorationLine: 'underline', marginTop: spacing.sm },

  memory: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: 20,
    backgroundColor: colors.sand,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 40,
  },
  memoryPin: { marginTop: 2 },
  memoryBody: { flex: 1, gap: 2 },
  memoryText: { ...type.small },
  memoryDate: { ...type.data, color: colors.inkLight },
  notePrompt: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 20,
    minHeight: 44, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.ctl,
    paddingHorizontal: 12,
  },

  moreRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 44, marginTop: 10,
  },
  moreText: { ...type.button, fontSize: 16 },
  forms: { marginTop: spacing.ms, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  formsLabel: { ...type.small, fontFamily: fonts.display, marginBottom: spacing.sm },
  formRow: { flexDirection: 'row', gap: spacing.ms, paddingVertical: 2 },
  formKey: { ...type.small, minWidth: 96 },
  formVal: { ...type.body, flex: 1 },
});
