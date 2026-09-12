import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Sticker, Language, PersonSummary } from '@/lib/types';
import { ageInDays } from '@/lib/review';
import Avatar from '@/components/Avatar';
import { colors, radii, spacing, shadows, fonts } from '@/constants/theme';
import { languageLabel } from '@/lib/languages';

// ---------------------------------------------------------------------------
// The home screen's feed of recent finds.
//
// This was "Due today" — a preview of the review queue. It is a feed now, for
// a reason worth recording: a card you scanned a minute ago is the newest
// thing you have and the *last* thing worth reviewing, because you were
// looking at the object when you made it. A queue must hide it (see
// NEW_CARD_REST_DAYS); a feed must show it. Trying to be both meant a card
// could be made and not appear.
//
// Reviewing did not lose its way in: HomeHeader carries the "N due · M min"
// button, which is the entry point the session actually starts from.
//
// Today every card here is one of yours, or one won off a friend — whose face
// it correctly carries, via stickers.origin_author_id. When sharing arrives,
// this rail is where other people's finds appear, and nothing about its shape
// has to change.
// ---------------------------------------------------------------------------
interface FeedRailProps {
  /// Newest first, already sliced for display.
  items: Sticker[];
  /// Every language in the collection — not just the ones with cards due —
  /// so the chip row can always undo its own filter.
  languages: Language[];
  /// The chips live here but scope the whole home screen (the list and the
  /// grid below it too), not only this rail — see collection.tsx.
  activeLanguage: Language | null;
  onSelectLanguage: (language: Language | null) => void;
  getUrl: (path: string | null | undefined) => string | null;
  /// Who originally made this card — you for anything you scanned, the person
  /// who first scanned it for anything won off a challenge, at any depth.
  /// Their face goes on the card.
  getAuthor: (sticker: Sticker) => PersonSummary | null;
  onPressSticker: (sticker: Sticker) => void;
}

// Cards are sized to the screen rather than fixed: exactly three fill the
// rail edge to edge, on every phone width. A fixed width can only ever be
// right for one screen size — tuned to fit three on a 390pt phone it
// overflows a 375pt one and leaves a stripe of dead space on a 430pt one.
//
// Height doesn't move with width: the head, the fixed-height body and the
// image well below are all fixed, so a narrower card is a narrower card,
// not a taller one.
const RAIL_GUTTER = spacing.md;
// Tight, because the three cards have to share what's left after the
// gutters — every point spent here comes straight out of card width.
const CARD_GAP = spacing.sm;
const CARDS_ACROSS = 3;

function cardWidthFor(screenWidth: number): number {
  const usable = screenWidth - RAIL_GUTTER * 2 - CARD_GAP * (CARDS_ACROSS - 1);
  // Floored so rounding can never push the third card past the right
  // gutter; clamped so an unusual width can't produce a card too narrow to
  // hold two lines of body text.
  return Math.max(96, Math.min(150, Math.floor(usable / CARDS_ACROSS)));
}

// The image well used to carry a seeded tint per card, so a row read as a
// shelf of different things. Dropped deliberately: the sticker IS the object,
// and a coloured panel behind a cut-out reads as a second card behind the
// first rather than as a backdrop. The cut-out now floats on the card itself.

export default function FeedRail({
  items, languages, activeLanguage, onSelectLanguage,
  getUrl, getAuthor, onPressSticker,
}: FeedRailProps) {
  const { width } = useWindowDimensions();
  const cardWidth = cardWidthFor(width);
  // The filter chips have to survive an empty queue: hiding the whole
  // section when a language filter matches nothing would take away the only
  // control that could undo it — and it governs the rest of the screen too,
  // so losing it would strand the grid below in a filter with no off switch.
  const multilingual = languages.length > 1;
  if (items.length === 0 && !multilingual) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Latest finds</Text>
      </View>

      {multilingual && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.langRow}
        >
          <LangChip label="All" active={activeLanguage === null} onPress={() => onSelectLanguage(null)} />
          {languages.map(l => (
            <LangChip
              key={l}
              label={languageLabel(l)}
              active={activeLanguage === l}
              onPress={() => onSelectLanguage(l)}
            />
          ))}
        </ScrollView>
      )}

      {items.length === 0 ? (
        <Text style={styles.empty}>Nothing in this language yet.</Text>
      ) : (

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        // Cards are a fixed width, so snapping to that pitch keeps a card
        // edge aligned to the gutter instead of leaving a sliver showing.
        snapToInterval={cardWidth + CARD_GAP}
        decelerationRate="fast"
      >
        {items.map(sticker => (
          <FeedCard
            key={sticker.id}
            sticker={sticker}
            width={cardWidth}
            url={getUrl(sticker.image_path)}
            author={getAuthor(sticker)}
            onPress={() => onPressSticker(sticker)}
          />
        ))}
      </ScrollView>
      )}
    </View>
  );
}

function LangChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.langChip, active && styles.langChipActive]} onPress={onPress}>
      <Text style={[styles.langChipText, active && styles.langChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FeedCard({ sticker, width, url, author, onPress }: {
  sticker: Sticker; width: number; url: string | null;
  author: PersonSummary | null; onPress: () => void;
}) {
  const discovered = new Date(sticker.discovered_at);
  const day = discovered.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
  const age = ageInDays(sticker.discovered_at);

  return (
    <TouchableOpacity style={[styles.card, { width }]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.cardHead}>
        {/* The person, not the sticker — the same photo is already the whole
            image well below, so repeating it here said nothing. Whose find
            this was is the one thing the card couldn't otherwise tell you. */}
        <Avatar name={author?.username} avatarPath={author?.avatar_path} size={26} />
        <View style={styles.cardHeadText}>
          <Text style={styles.cardDay}>{day}</Text>
          <Text style={styles.cardAge}>DAY {age}</Text>
        </View>
      </View>

      <Text style={styles.cardBody} numberOfLines={2}>
        {sticker.notes?.trim() || sticker.sentence_translation || sticker.translation}
      </Text>

      <View style={styles.well}>
        {url ? (
          <Image
            source={{ uri: url, cacheKey: sticker.image_path }}
            cachePolicy="memory-disk"
            contentFit="contain"
            style={StyleSheet.absoluteFillObject}
          />
        ) : (
          <ActivityIndicator color={colors.terra} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.ms },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.ms,
  },
  title: { fontSize: 19, fontFamily: fonts.display, color: colors.inkDark },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  linkText: { fontSize: 13, fontFamily: fonts.display, color: colors.inkLight },

  langRow: { paddingHorizontal: RAIL_GUTTER, gap: spacing.sm, paddingBottom: spacing.ms },
  langChip: {
    paddingHorizontal: spacing.ms,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
  },
  langChipActive: { backgroundColor: colors.terra, borderColor: colors.terra },
  langChipText: { fontSize: 12, fontFamily: fonts.display, color: colors.inkMid },
  langChipTextActive: { color: colors.white },
  empty: { paddingHorizontal: RAIL_GUTTER, paddingBottom: spacing.sm, fontSize: 13, fontFamily: fonts.text, color: colors.inkFaint, },

  rail: { paddingHorizontal: RAIL_GUTTER, gap: CARD_GAP, paddingBottom: spacing.xs },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.sm + 2,
    gap: 6,
    ...shadows.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardHeadText: { flex: 1 },
  cardDay: { fontSize: 14, fontFamily: fonts.display, color: colors.inkDark },
  cardAge: { fontSize: 9, fontFamily: fonts.mono, color: colors.inkFaint, letterSpacing: 1 },

  cardBody: { fontSize: 12.5, fontFamily: fonts.text, color: colors.inkMid, lineHeight: 16, minHeight: 32 },

  // No background: the cut-out sits directly on the card. Height is kept so
  // the rail's cards stay the same size whether or not an image has loaded.
  well: {
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
