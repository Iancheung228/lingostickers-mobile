import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect } from 'react-native-svg';
import { Sticker } from '@/lib/types';
import { Chapter } from '@/lib/chapters';
import { supabase } from '@/lib/supabase';

interface StickerBoardProps {
  chapters: Chapter[];
  onSelectSticker: (sticker: Sticker) => void;
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
const TAPE_COLORS = ['#C9A87CB3', '#A8C2A3B3', '#D9A98CB3'];
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
  sticker, cellWidth, cellHeight, x, y, onPress,
}: {
  sticker: Sticker; cellWidth: number; cellHeight: number; x: number; y: number; onPress: () => void;
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
      <View style={styles.tileImageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.tileImage} resizeMode="contain" />
        ) : (
          <ActivityIndicator color="#A7D7C5" />
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
  page, width, onSelectSticker,
}: { page: BoardPage; width: number; onSelectSticker: (s: Sticker) => void }) {
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
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#D9AE7E" />
              <Stop offset="1" stopColor="#AD7B4C" />
            </LinearGradient>
            <RadialGradient id="vignette" cx="50%" cy="50%" r="75%">
              <Stop offset="0.6" stopColor="#3A2210" stopOpacity="0" />
              <Stop offset="1" stopColor="#3A2210" stopOpacity="0.35" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#wood)" />
          {Array.from({ length: 10 }).map((_, i) => (
            <Rect
              key={i}
              x="0"
              y={`${(i + 0.5) * 10}%`}
              width="100%"
              height="1"
              fill="#5A3A1E"
              opacity={0.06 + (i % 3) * 0.02}
            />
          ))}
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#vignette)" />
        </Svg>
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
            />
          );
        })}
      </View>
    </View>
  );
}

export default function StickerBoard({ chapters, onSelectSticker }: StickerBoardProps) {
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
            <BoardPageView page={item} width={pageWidth} onSelectSticker={onSelectSticker} />
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
  pageTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A2E' },
  pageSubtitle: { fontSize: 12, color: '#9E9E9E', fontStyle: 'italic', marginTop: 2 },
  board: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 6,
    borderColor: '#7C5230',
  },
  tile: {
    position: 'absolute',
    backgroundColor: '#FBF6EC',
    borderRadius: 4,
    padding: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  tileImageWrap: { flex: 1, marginBottom: 4 },
  tileImage: { width: '100%', height: '100%' },
  tileWord: { fontSize: 11, fontWeight: '700', color: '#1A1A2E', textAlign: 'center' },
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
    borderColor: '#A6362E',
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  stampGlyph: { fontSize: 12, color: '#A6362E', fontWeight: '800' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E5E7EB' },
  dotActive: { backgroundColor: '#A7D7C5', width: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#9E9E9E', textAlign: 'center', lineHeight: 22 },
});
