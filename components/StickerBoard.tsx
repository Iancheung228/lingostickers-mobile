import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { Sticker, WallDisplayStyle, CutoutBorderStyle } from '@/lib/types';
import { Chapter } from '@/lib/chapters';
import { supabase } from '@/lib/supabase';
import CorkBackground from '@/components/CorkBackground';
import CutoutSticker from '@/components/CutoutSticker';
import { colors, fonts } from '@/constants/theme';

interface StickerBoardProps {
  chapters: Chapter[];
  onSelectSticker: (sticker: Sticker) => void;
  displayStyle?: WallDisplayStyle;
  borderStyle?: CutoutBorderStyle;
}

interface BoardPage {
  key: string;
  title: string;
  subtitle: string;
  stickers: Sticker[];
}

const MAX_PER_PAGE = 9;
const BOARD_HEIGHT = 460;
const BOARD_MARGIN = 16;
const TAPE_COLORS = [colors.skyNight + 'CC', colors.sageLight + 'EE', colors.terraLight + 'EE'];
const STAMP_GLYPHS = ['印', '友', '夢'];

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Each chapter becomes one or more board "pages" (capped at MAX_PER_PAGE
// stickers each) so a single page never gets too cluttered to read.
function buildBoardPages(chapters: Chapter[]): BoardPage[] {
  const pages: BoardPage[] = [];
  for (const chapter of chapters) {
    const chunks = chunk(chapter.stickers, MAX_PER_PAGE);
    chunks.forEach((stickers, i) => {
      pages.push({
        key: `${chapter.key}-${i}`,
        title: chapter.title,
        subtitle: chunks.length > 1 ? `${chapter.subtitle} · part ${i + 1}/${chunks.length}` : chapter.subtitle,
        stickers,
      });
    });
  }
  return pages;
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}

// Deterministic per-sticker "randomness" (rotation, jitter, tape color, …)
// so the scatter layout doesn't reshuffle on every re-render.
function seededRandom(seed: string, salt: number): number {
  const x = Math.sin(hashString(`${seed}:${salt}`)) * 10000;
  return x - Math.floor(x);
}

function BoardTile({
  sticker, cellWidth, cellHeight, x, y, onPress, displayStyle, borderStyle,
}: {
  sticker: Sticker; cellWidth: number; cellHeight: number; x: number; y: number; onPress: () => void;
  displayStyle: WallDisplayStyle; borderStyle: CutoutBorderStyle;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.storage.from('sticker-images')
      .createSignedUrl(sticker.image_path, 3600)
      .then(({ data }) => { if (data) setImageUrl(data.signedUrl); });
  }, [sticker.image_path]);

  const rotation = (seededRandom(sticker.id, 3) * 2 - 1) * 8;
  const useStamp = seededRandom(sticker.id, 5) < 0.3;
  const tapeColor = TAPE_COLORS[Math.floor(seededRandom(sticker.id, 4) * TAPE_COLORS.length)];
  const tapeRotation = (seededRandom(sticker.id, 6) * 2 - 1) * 14;
  const stampGlyph = STAMP_GLYPHS[Math.floor(seededRandom(sticker.id, 7) * STAMP_GLYPHS.length)];

  const tileHeight = Math.min(cellHeight * 0.7, 132);
  const tileWidth = Math.min(tileHeight / 1.28, cellWidth * 0.84);

  return (
    <TouchableOpacity
      style={[
        styles.tile,
        displayStyle === 'cutout' && styles.tileCutout,
        displayStyle === 'cutout' && (borderStyle === 'shadow' ? styles.tileCutoutShadow : styles.tileCutoutFlat),
        {
          left: x - tileWidth / 2,
          top: y - tileHeight / 2,
          width: tileWidth,
          height: tileHeight,
          transform: [{ rotate: `${rotation}deg` }],
        },
      ]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {!useStamp && (
        <View
          style={[
            styles.tape,
            { backgroundColor: tapeColor, transform: [{ rotate: `${tapeRotation}deg` }] },
          ]}
        />
      )}
      <View style={displayStyle === 'cutout' ? styles.tileImageWrapCutout : styles.tileImageWrap}>
        {imageUrl ? (
          displayStyle === 'cutout' && borderStyle === 'outline' ? (
            <CutoutSticker uri={imageUrl} borderStyle="outline" />
          ) : (
            <Image source={{ uri: imageUrl }} style={styles.tileImage} resizeMode="contain" />
          )
        ) : (
          <ActivityIndicator color={colors.terra} />
        )}
      </View>
      <Text style={styles.tileWord} numberOfLines={1}>{sticker.word}</Text>
      {useStamp && (
        <View style={styles.stamp}>
          <Text style={styles.stampGlyph}>{stampGlyph}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function BoardPageView({
  page, width, onSelectSticker, displayStyle, borderStyle,
}: {
  page: BoardPage; width: number; onSelectSticker: (s: Sticker) => void;
  displayStyle: WallDisplayStyle; borderStyle: CutoutBorderStyle;
}) {
  const columns = page.stickers.length <= 4 ? 2 : 3;
  const rows = Math.ceil(page.stickers.length / columns);
  const cellWidth = width / columns;
  const cellHeight = BOARD_HEIGHT / rows;

  return (
    <View style={{ width }}>
      <View style={styles.pageLabel}>
        <Text style={styles.pageTitle}>{page.title}</Text>
        <Text style={styles.pageSubtitle}>{page.subtitle}</Text>
      </View>
      <View style={[styles.board, { height: BOARD_HEIGHT }]}>
        <CorkBackground />
        {page.stickers.map((sticker, i) => {
          const col = i % columns;
          const row = Math.floor(i / columns);
          const baseX = col * cellWidth + cellWidth / 2;
          const baseY = row * cellHeight + cellHeight / 2;
          const jitterX = (seededRandom(sticker.id, 1) * 2 - 1) * cellWidth * 0.08;
          const jitterY = (seededRandom(sticker.id, 2) * 2 - 1) * cellHeight * 0.08;
          return (
            <BoardTile
              key={sticker.id}
              sticker={sticker}
              cellWidth={cellWidth}
              cellHeight={cellHeight}
              x={baseX + jitterX}
              y={baseY + jitterY}
              onPress={() => onSelectSticker(sticker)}
              displayStyle={displayStyle}
              borderStyle={borderStyle}
            />
          );
        })}
      </View>
    </View>
  );
}

export default function StickerBoard({
  chapters, onSelectSticker, displayStyle = 'framed', borderStyle = 'shadow',
}: StickerBoardProps) {
  const { width: screenWidth } = useWindowDimensions();
  const pageWidth = screenWidth - BOARD_MARGIN * 2;
  const [pageIndex, setPageIndex] = useState(0);
  const pages = buildBoardPages(chapters);

  if (pages.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No stickers yet</Text>
        <Text style={styles.emptySubtitle}>Tap the Scan tab to discover your first word!</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={pages}
        keyExtractor={p => p.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => {
          setPageIndex(Math.round(e.nativeEvent.contentOffset.x / screenWidth));
        }}
        renderItem={({ item }) => (
          <View style={{ width: screenWidth, paddingHorizontal: BOARD_MARGIN }}>
            <BoardPageView
              page={item}
              width={pageWidth}
              onSelectSticker={onSelectSticker}
              displayStyle={displayStyle}
              borderStyle={borderStyle}
            />
          </View>
        )}
      />
      {pages.length > 1 && (
        <View style={styles.dots}>
          {pages.map((p, i) => (
            <View key={p.key} style={[styles.dot, i === pageIndex && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pageLabel: { paddingHorizontal: 4, marginBottom: 10 },
  pageTitle: { fontSize: 18, fontFamily: fonts.cozy, color: colors.inkDark },
  pageSubtitle: { fontSize: 12, color: colors.inkFaint, fontStyle: 'italic', marginTop: 2 },
  board: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: colors.skyNight,
  },
  tile: {
    position: 'absolute',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 6,
    shadowColor: colors.inkDark,
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  // "Cutout" mode: just the sticker shape floating on the corkboard, no
  // card behind it.
  tileCutout: {
    backgroundColor: 'transparent',
    padding: 0,
  },
  // Elevation is dropped for both — Android draws it as a rectangle
  // regardless of the PNG's alpha, which looks wrong without a card.
  tileCutoutShadow: { shadowOpacity: 0.22, elevation: 0 },
  tileCutoutFlat: { shadowOpacity: 0, elevation: 0 },
  tileImageWrap: { flex: 1, marginBottom: 4 },
  tileImageWrapCutout: { flex: 1, marginBottom: 2 },
  tileImage: { width: '100%', height: '100%' },
  tileWord: { fontSize: 11, fontFamily: fonts.jp, color: colors.inkDark, textAlign: 'center' },
  tape: {
    position: 'absolute',
    top: -10,
    left: '50%',
    marginLeft: -22,
    width: 44,
    height: 16,
    borderRadius: 2,
  },
  stamp: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.error,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  stampGlyph: { fontSize: 12, color: colors.error, fontWeight: '800' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderLight },
  dotActive: { backgroundColor: colors.terra, width: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontFamily: fonts.cozy, color: colors.inkDark, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: colors.inkFaint, textAlign: 'center', lineHeight: 22 },
});
