import { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Plus } from 'lucide-react-native';
import { Board } from '@/lib/types';
import { BoardPreview } from '@/hooks/useBoards';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { seededRandom } from '@/lib/seededRandom';
import { WallBackdrop } from '@/components/WallBackground';
import { colors, radii, spacing, fonts, shadows } from '@/constants/theme';

const CREATE_TILE_ID = '__create__';
type RailItem = Board | { id: typeof CREATE_TILE_ID };

// A tile is a miniature of the board itself — same portrait proportion as
// the canvas it stands for, so the strip reads as "the same boards, smaller"
// rather than a row of unrelated chips.
const TILE_W = 62;
const TILE_H = 80;
const TILE_GAP = spacing.ms;
const LABEL_H = 15;
export const BOARD_RAIL_HEIGHT = TILE_H + LABEL_H + spacing.xs + spacing.sm * 2 + 2;

// Where each preview cutout lands inside a tile, as fractions of tile size.
// Deliberately only two, and large: a tile is meant to read as *this board,
// shrunk* — a wall with a couple of things pinned to it. Four small cutouts
// filled the frame evenly and turned every board into the same busy mosaic,
// which hid the one thing that actually tells boards apart at this size,
// the cover photo behind them. `s` is the sticker's size as a fraction of
// the tile's width.
const SLOTS: Array<{ x: number; y: number; s: number }> = [
  { x: 0.42, y: 0.40, s: 0.62 },
  { x: 0.64, y: 0.69, s: 0.50 },
];

interface BoardRailProps {
  boards: Board[];
  previews: Map<string, BoardPreview>;
  activeIndex: number;
  onSelect: (index: number) => void;
  onCreate: () => void;
}

// The Wall tab's bottom strip: every board at a glance, with "new board"
// permanently parked at the right end. It's the tab's primary navigation now
// — the carousel still swipes, but nothing depends on swiping to reach a
// board you can see from here.
export default function BoardRail({ boards, previews, activeIndex, onSelect, onCreate }: BoardRailProps) {
  const listRef = useRef<FlatList<RailItem>>(null);
  const items: RailItem[] = useMemo(() => [...boards, { id: CREATE_TILE_ID }], [boards]);

  // One signed-url batch for the whole strip — every board's cover photo and
  // every preview cutout in a single request (see hooks/useSignedUrls.ts),
  // rather than one round-trip per tile.
  const urls = useSignedUrls(useMemo(() => [
    ...boards.map(b => b.background_path),
    ...boards.flatMap(b => previews.get(b.id)?.paths ?? []),
  ], [boards, previews]));

  // Keep the lit tile on screen when the carousel is what moved. Guarded:
  // scrollToIndex throws outright if the index is past the end, which it
  // briefly is right after a board is deleted.
  useEffect(() => {
    if (activeIndex < 0 || activeIndex >= items.length) return;
    listRef.current?.scrollToIndex({ index: activeIndex, viewPosition: 0.5, animated: true });
  }, [activeIndex, items.length]);

  return (
    <View style={styles.band}>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={i => i.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        getItemLayout={(_, index) => ({
          length: TILE_W + TILE_GAP,
          offset: (TILE_W + TILE_GAP) * index,
          index,
        })}
        renderItem={({ item, index }) => (
          item.id === CREATE_TILE_ID ? (
            <CreateTile onPress={onCreate} />
          ) : (
            <BoardTile
              board={item as Board}
              preview={previews.get(item.id)}
              urls={urls}
              active={index === activeIndex}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(index);
              }}
            />
          )
        )}
      />
    </View>
  );
}

function BoardTile({
  board, preview, urls, active, onPress,
}: {
  board: Board;
  preview: BoardPreview | undefined;
  urls: Map<string, string>;
  active: boolean;
  onPress: () => void;
}) {
  const backgroundUrl = board.background_path ? urls.get(board.background_path) ?? null : null;
  const paths = preview?.paths ?? [];

  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      // The tile is mostly a picture of the board; without this a screen
      // reader gets the name and no hint that it is the thing to press, nor
      // which one is already open.
      accessibilityLabel={`Open the board “${board.name}”`}
      accessibilityState={{ selected: active }}
    >
      <View style={[styles.thumb, active && styles.thumbActive]}>
        {/* The exact component the real canvas draws itself with, handed the
            URL this strip already signed in its own batch — not a copy of it.
            The copy this replaced skipped the vignette, so a dimmed board
            looked edge-darkened full-size and flat down here. */}
        <WallBackdrop
          url={backgroundUrl}
          dim={board.background_dim}
          cacheKey={board.background_path ?? undefined}
        />

        {/* Plain images, not CutoutSticker: its white outline is eight extra
            image layers per sticker, and at 25px wide the outline isn't
            legible anyway — that's ~32 layers per tile bought for nothing. */}
        {paths.map((path, i) => {
          const slot = SLOTS[i];
          const url = urls.get(path);
          if (!slot || !url) return null;
          const size = TILE_W * slot.s;
          const rotation = (seededRandom(path, 3) * 2 - 1) * 12;
          return (
            <Image
              key={path}
              source={{ uri: url, cacheKey: path }}
              cachePolicy="memory-disk"
              contentFit="contain"
              style={{
                position: 'absolute',
                left: TILE_W * slot.x - size / 2,
                top: TILE_H * slot.y - size / 2,
                width: size,
                height: size,
                transform: [{ rotate: `${rotation}deg` }],
              }}
            />
          );
        })}

        {paths.length === 0 && (
          <View style={styles.emptyThumb}>
            <Text style={styles.emptyThumbText}>0</Text>
          </View>
        )}
      </View>
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
        {board.name}
      </Text>
    </TouchableOpacity>
  );
}

function CreateTile({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Create a new board"
    >
      <View style={styles.createThumb}>
        <Plus size={20} color={colors.terra} strokeWidth={2.5} />
      </View>
      <Text style={styles.createLabel} numberOfLines={1}>New</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // An opaque band, not a scrim over the canvas: the board above it keeps a
  // hard bottom edge, so a sticker dragged low never half-disappears behind
  // a translucent strip.
  band: {
    height: BOARD_RAIL_HEIGHT,
    backgroundColor: colors.cream,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: TILE_GAP,
    alignItems: 'flex-start',
  },
  tile: { width: TILE_W, alignItems: 'center' },
  thumb: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: colors.cardAlt,
    borderWidth: 2,
    borderColor: colors.transparent,
    ...shadows.card,
  },
  // Border-as-ring rather than an outer glow: the tile is small enough that
  // anything softer reads as a rendering artifact instead of a selection.
  thumbActive: { borderColor: colors.terra },
  emptyThumb: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  emptyThumbText: { fontSize: 16, fontFamily: fonts.display, color: colors.white, opacity: 0.7 },
  label: { height: LABEL_H, marginTop: spacing.xs, fontSize: 10, fontFamily: fonts.mono, color: colors.inkLight, textAlign: 'center', },
  labelActive: { color: colors.inkDark, fontFamily: fonts.monoBold },
  createThumb: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: radii.sm,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.terraLight,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createLabel: { height: LABEL_H, marginTop: spacing.xs, fontSize: 10, fontFamily: fonts.mono, color: colors.terra, textAlign: 'center', },
});
