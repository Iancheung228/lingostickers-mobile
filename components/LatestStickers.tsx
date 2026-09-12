import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { MapPin, Volume2 } from 'lucide-react-native';
import { Sticker } from '@/lib/types';
import { timeAgo } from '@/lib/relativeTime';
import { useTrimmedVoicePlayback } from '@/hooks/useTrimmedVoicePlayback';
import { colors, radii, spacing, shadows, fonts, wordFontFor } from '@/constants/theme';

interface LatestStickersProps {
  stickers: Sticker[];
  sortLabel: string;
  onCycleSort: () => void;
  getUrl: (path: string | null | undefined) => string | null;
  onPressSticker: (sticker: Sticker) => void;
}

// The feed scrolls inside its own card, so it can hold more than fits — but
// it is rendered inside the home screen's list *header*, which means these
// rows are not virtualized. Capped so a large collection can't put hundreds
// of live rows behind a viewport that shows four.
export const MAX_ROWS = 15;

// A little over three rows, so the cut-off fourth is visible and the card
// reads as scrollable without needing a scrollbar to say so.
const VIEWPORT_HEIGHT = 268;

export default function LatestStickers({
  stickers, sortLabel, onCycleSort, getUrl, onPressSticker,
}: LatestStickersProps) {
  const rows = stickers.slice(0, MAX_ROWS);
  if (rows.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Latest stickers</Text>
        {/* The same sort the grid below uses — one control, so the feed and
            the grid can never disagree about what order the screen is in. */}
        <TouchableOpacity onPress={onCycleSort} hitSlop={8}>
          <Text style={styles.sortLabel}>{sortLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* maxHeight rather than height, so a feed of one or two rows sizes to
          its content instead of leaving a hole. nestedScrollEnabled is what
          lets this scroll inside the screen's own list on Android; iOS
          handles the nesting natively. */}
      <ScrollView
        style={{ maxHeight: VIEWPORT_HEIGHT }}
        nestedScrollEnabled
        showsVerticalScrollIndicator
        // Without this a drag begun on a row is claimed by the outer list and
        // the card never scrolls — the rows are all touchables.
        keyboardShouldPersistTaps="handled"
      >
        {rows.map((sticker, i) => (
          <Row
            key={sticker.id}
            sticker={sticker}
            last={i === rows.length - 1}
            imageUrl={getUrl(sticker.image_path)}
            voiceUrl={getUrl(sticker.voice_note_path)}
            onPress={() => onPressSticker(sticker)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function Row({ sticker, last, imageUrl, voiceUrl, onPress }: {
  sticker: Sticker; last: boolean; imageUrl: string | null; voiceUrl: string | null; onPress: () => void;
}) {
  const { play } = useTrimmedVoicePlayback(
    voiceUrl, sticker.voice_note_start_ms, sticker.voice_note_end_ms
  );
  const when = timeAgo(sticker.discovered_at);
  // One helper, in one place — the family a headword needs depends entirely
  // on which language it is in. See wordFontFor in constants/theme.ts.
  const wordFont = wordFontFor(sticker.language);

  return (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowDivided]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.thumb}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl, cacheKey: sticker.image_path }}
            cachePolicy="memory-disk"
            contentFit="contain"
            style={styles.thumbImage}
          />
        ) : (
          <ActivityIndicator size="small" color={colors.terra} />
        )}
      </View>

      <View style={styles.rowText}>
        <Text style={[styles.word, { fontFamily: wordFont }]} numberOfLines={1}>{sticker.word}</Text>
        <Text style={styles.reading} numberOfLines={1}>
          [{sticker.reading}] · {sticker.translation}
        </Text>
        {!!sticker.location_label && (
          <View style={styles.metaRow}>
            <MapPin size={11} color={colors.inkFaint} />
            <Text style={styles.meta} numberOfLines={1}>{sticker.location_label} · {when}</Text>
          </View>
        )}
      </View>

      {/* Your own recording is worth a tap target; without one the row just
          says how long ago it was, the way the reference does. */}
      {sticker.voice_note_path ? (
        <TouchableOpacity
          style={styles.speakBtn}
          onPress={(e) => { e.stopPropagation(); play(); }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Play your recording of ${sticker.word}`}
        >
          <Volume2 size={16} color={colors.blushDeep} />
        </TouchableOpacity>
      ) : (
        <Text style={styles.when}>{when}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.ms,
    marginHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 26,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: { fontSize: 18, fontFamily: fonts.display, color: colors.inkDark },
  sortLabel: { fontSize: 13, fontFamily: fonts.display, color: colors.inkLight },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingVertical: spacing.sm + 2,
  },
  rowDivided: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  // Just the cut-out, no disc. The sand fill, white ring and shadow behind it
  // read as a second object sitting under the sticker — and the disc had to
  // clip, which is why the image was `cover` and lost the edges of anything
  // that wasn't roughly square.
  thumb: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: { width: '100%', height: '100%' },
  rowText: { flex: 1, gap: 1 },
  word: { fontSize: 20, color: colors.inkDark },
  reading: { fontSize: 12, fontFamily: fonts.mono, color: colors.inkLight },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  meta: { flex: 1, fontSize: 11, fontFamily: fonts.text, color: colors.inkFaint },
  when: { fontSize: 12, fontFamily: fonts.text, color: colors.inkFaint},
  speakBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
