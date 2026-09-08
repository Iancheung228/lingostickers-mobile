import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';
import { Sticker, Language, PersonSummary } from '@/lib/types';
import { ageInDays } from '@/lib/review';
import { seededRandom } from '@/lib/seededRandom';
import Avatar from '@/components/Avatar';
import { colors, radii, spacing, shadows, fonts } from '@/constants/theme';
import { languageLabel } from '@/lib/languages';

interface DueTodayRailProps {
  /// Already sliced for display — `totalDue` is the honest count.
  due: Sticker[];
  totalDue: number;
  /// Every language in the collection — not just the ones with cards due —
  /// so the chip row can always undo its own filter.
  languages: Language[];
  /// The chips live here but scope the whole home screen (the Latest feed and
  /// the grid below it too), not only this rail — see collection.tsx.
  activeLanguage: Language | null;
  onSelectLanguage: (language: Language | null) => void;
  getUrl: (path: string | null | undefined) => string | null;
  /// Whose find this was — you for anything you scanned, the friend who sent
  /// it for anything won off a challenge. Their face goes on the card.
  getAuthor: (sticker: Sticker) => PersonSummary | null;
  onPressSticker: (sticker: Sticker) => void;
  onReviewAll: () => void;
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

// Each card's image well gets its own tint so a row of them reads as a
// shelf of different things rather than one repeated card. Seeded off the
// sticker id (not the index) so a card keeps its color as the queue
// reshuffles day to day — same reasoning as the wall's tape colors.
const WELL_TINTS = [colors.sand, colors.skyBlue, colors.terraLight, colors.borderLight];

export default function DueTodayRail({
  due, totalDue, languages, activeLanguage, onSelectLanguage,
  getUrl, getAuthor, onPressSticker, onReviewAll,
}: DueTodayRailProps) {
  const { width } = useWindowDimensions();
  const cardWidth = cardWidthFor(width);
  // The filter chips have to survive an empty queue: hiding the whole
  // section when a language filter matches nothing would take away the only
  // control that could undo it — and it governs the rest of the screen too,
  // so losing it would strand the grid below in a filter with no off switch.
  const multilingual = languages.length > 1;
  if (due.length === 0 && !multilingual) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Due today · {totalDue} card{totalDue === 1 ? '' : 's'}
        </Text>
        {totalDue > 0 && (
          <TouchableOpacity style={styles.link} onPress={onReviewAll} hitSlop={8}>
            <Text style={styles.linkText}>Review all</Text>
            <ChevronRight size={14} color={colors.inkLight} />
          </TouchableOpacity>
        )}
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

      {due.length === 0 ? (
        <Text style={styles.empty}>Nothing due here right now.</Text>
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
        {due.map(sticker => (
          <DueCard
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

function DueCard({ sticker, width, url, author, onPress }: {
  sticker: Sticker; width: number; url: string | null;
  author: PersonSummary | null; onPress: () => void;
}) {
  const discovered = new Date(sticker.discovered_at);
  const day = discovered.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
  const age = ageInDays(sticker.discovered_at);
  const tint = WELL_TINTS[Math.floor(seededRandom(sticker.id, 7) * WELL_TINTS.length)];

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

      <View style={[styles.well, { backgroundColor: tint }]}>
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

  well: {
    height: 62,
    borderRadius: radii.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
