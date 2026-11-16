import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Plus, Sticker as StickerIcon } from 'lucide-react-native';
import { Board } from '@/lib/types';
import { BoardPreview } from '@/hooks/useBoards';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { seededRandom } from '@/lib/seededRandom';
import { haptic } from '@/lib/haptics';
import { WallBackdrop } from '@/components/WallBackground';
import { GUTTER, radii } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

// The Boards tab's grid (C-look 4 "Board tile"): two-up white tiles, a 140pt
// preview well that is the board itself in miniature (the user's own cover
// photo, or the plain cream field, with up to three of its stickers at the
// rotation they chose), the name at 17 and the count in caption. "New board"
// is a dashed tile at the end.
const GAP = 12;
const PREVIEW_H = 140;
const CREATE_ID = '__create__';
type Item = Board | { id: typeof CREATE_ID };

// Where each preview cutout lands, as fractions of the well; `s` is its size
// as a fraction of the well's width.
const SLOTS = [
  { x: 0.32, y: 0.40, s: 0.40 },
  { x: 0.70, y: 0.58, s: 0.34 },
  { x: 0.36, y: 0.82, s: 0.27 },
];

interface Props {
  boards: Board[];
  previews: Map<string, BoardPreview>;
  onOpen: (board: Board) => void;
  onCreate: () => void;
  bottomPad: number;
}

export default function BoardTiles({ boards, previews, onOpen, onCreate, bottomPad }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const tileW = (width - GUTTER * 2 - GAP) / 2;
  const items: Item[] = useMemo(() => [...boards, { id: CREATE_ID }], [boards]);
  // One signed-url batch for every tile's cover and preview cutouts.
  const urls = useSignedUrls(useMemo(() => [
    ...boards.map(b => b.background_path),
    ...boards.flatMap(b => previews.get(b.id)?.paths ?? []),
  ], [boards, previews]));

  return (
    <FlatList
      data={items}
      keyExtractor={i => i.id}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 20, paddingBottom: bottomPad, gap: GAP }}
      renderItem={({ item }) => (
        <View style={{ width: tileW }}>
          {item.id === CREATE_ID
            ? <CreateTile onPress={onCreate} />
            : <Tile board={item as Board} preview={previews.get(item.id)} urls={urls} width={tileW} onPress={() => { haptic.tap(); onOpen(item as Board); }} />}
        </View>
      )}
    />
  );
}

function Tile({ board, preview, urls, width, onPress }: {
  board: Board; preview: BoardPreview | undefined; urls: Map<string, string>; width: number; onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const backgroundUrl = board.background_path ? urls.get(board.background_path) ?? null : null;
  const paths = preview?.paths ?? [];
  const count = preview?.count ?? 0;
  const countLabel = `${count} sticker${count === 1 ? '' : 's'}`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${board.name}, ${countLabel}`}
      accessibilityHint="Opens the board"
      testID={`board-tile-${board.name}`}
    >
      <View style={styles.preview}>
        <WallBackdrop url={backgroundUrl} dim={board.background_dim} cacheKey={board.background_path ?? undefined} />
        {paths.map((path, i) => {
          const slot = SLOTS[i];
          const url = urls.get(path);
          if (!slot || !url) return null;
          const size = width * slot.s;
          const rotation = (seededRandom(path, 3) * 2 - 1) * 8;
          return (
            <Image
              key={path}
              source={{ uri: url, cacheKey: path }}
              cachePolicy="memory-disk"
              contentFit="contain"
              style={{
                position: 'absolute',
                left: width * slot.x - size / 2,
                top: PREVIEW_H * slot.y - size / 2,
                width: size,
                height: size,
                transform: [{ rotate: `${rotation}deg` }],
              }}
            />
          );
        })}
        {paths.length === 0 && (
          <View style={styles.emptyPreview}>
            <StickerIcon size={28} strokeWidth={1.75} color={colors.inkLight} />
          </View>
        )}
      </View>
      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={1.5}>{board.name}</Text>
        <Text style={styles.caption} maxFontSizeMultiplier={1.5}>{countLabel}</Text>
      </View>
    </Pressable>
  );
}

function CreateTile({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.createTile, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="New board"
      testID="new-board-tile"
    >
      <View style={styles.createPreview}>
        <View style={styles.plusDisc}><Plus size={22} strokeWidth={2} color={colors.inkDark} /></View>
      </View>
      <View style={styles.meta}>
        <Text style={styles.name} maxFontSizeMultiplier={1.5}>New board</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = ({ colors, e1, type }: Theme) => StyleSheet.create({
  row: { gap: GAP },
  tile: { backgroundColor: colors.card, borderRadius: 20, overflow: 'hidden', ...e1 },
  pressed: { opacity: 0.92 },
  preview: { height: PREVIEW_H, backgroundColor: colors.sand, overflow: 'hidden' },
  emptyPreview: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  meta: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, minHeight: 66 },
  name: { ...type.button, fontSize: 17, lineHeight: 22 },
  caption: { ...type.small },
  createTile: {
    borderRadius: 20, overflow: 'hidden', backgroundColor: colors.terraLight,
  },
  createPreview: { height: PREVIEW_H, alignItems: 'center', justifyContent: 'center' },
  plusDisc: {
    width: 44, height: 44, borderRadius: radii.full, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
});
