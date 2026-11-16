import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Pressable, useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Camera, Move } from 'lucide-react-native';
import { CutoutBorderStyle, Sticker, WallBackgroundDim } from '@/lib/types';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { useHomeWall } from '@/hooks/useHomeWall';
import {
  bouquetSlots, homeCanvasSize, homeTileFraction, HOME_WALL_HEIGHT, HOME_WALL_INSET, HOME_WALL_RADIUS, HOME_WALL_SAFE,
} from '@/lib/homeWall';
import HomeWallField from '@/components/HomeWallField';
import HomeWallTile from '@/components/HomeWallTile';
import { listImagePath } from '@/lib/thumbnails';
import HomeWallEditor from '@/components/HomeWallEditor';
import { haptic } from '@/lib/haptics';
import { fonts, radii } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

interface MiniStickerWallProps {
  stickers: Sticker[]; // newest-first, as fetched by the caller
  userId?: string;
  backgroundPath?: string | null;
  backgroundDim?: WallBackgroundDim;
  onChangeBackground: (path: string | null) => Promise<{ error: Error | null }>;
  // False until the user first arranges the wall by hand; until then the
  // panel shows the auto fan below. Flipped through the profile hook (the
  // single owner of that row) rather than from inside this component.
  arranged: boolean;
  onArranged: () => Promise<{ error: Error | null }>;
  // Opens the sticker's detail sheet. Tapping a sticker used to jump to
  // another tab entirely, which is not what tapping a sticker means
  // anywhere else in the app.
  onPressSticker: (sticker: Sticker) => void;
  borderStyle: CutoutBorderStyle;
}

// How many the auto bouquet shows before the user has arranged anything.
const PREVIEW_COUNT = 6;

// "Most fav or recent": the newest capture is the hero, the rest is a blend of
// favourites and latest additions: favouriting is a direct way to make
// something show up here. The first time the user opens the editor, whatever is
// in the bouquet is seeded as their real arrangement (useHomeWall.seedFrom).
function pickPreview(stickers: Sticker[]): Sticker[] {
  if (stickers.length === 0) return [];
  const [hero, ...rest] = stickers;
  const favorites = rest.filter(s => s.is_favorite).slice(0, 3);
  const favoriteIds = new Set(favorites.map(s => s.id));
  const recents = rest.filter(s => !favoriteIds.has(s.id));
  const fillCount = Math.max(PREVIEW_COUNT - 1 - favorites.length, 0);
  return [hero, ...favorites, ...recents.slice(0, fillCount)];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

export default function MiniStickerWall({
  stickers, userId, backgroundPath, backgroundDim, onChangeBackground,
  arranged, onArranged, onPressSticker, borderStyle,
}: MiniStickerWallProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { width: screenWidth } = useWindowDimensions();
  const canvas = useMemo(() => homeCanvasSize(screenWidth), [screenWidth]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  // home_background_path is a fixed filename so it reads identically before
  // and after a re-upload — bump this alongside it so WallBackground
  // actually re-fetches a fresh signed URL. See WallBackground.tsx.
  const [backgroundVersion, setBackgroundVersion] = useState(0);

  // Mounted here, once, and handed to the editor as props — two call sites
  // of this hook would each fetch their own copy and diverge the moment one
  // of them mutated (skills.md #1).
  const wall_ = useHomeWall(userId);

  // Deleting a sticker from the collection cascades its home_stickers row
  // away in the database, but this component has no way to hear about that
  // — the delete happens over on the grid. Two belts: re-read on focus, and
  // never render a pin whose sticker isn't in the collection the parent
  // just fetched, so a delete on this same screen takes effect immediately
  // rather than leaving a tile pointing at nothing.
  useFocusEffect(useCallback(() => { wall_.refetch(); }, [wall_.refetch]));

  const items = useMemo(() => {
    if (stickers.length === 0) return wall_.items; // still loading — don't blank the wall
    const live = new Set(stickers.map(s => s.id));
    return wall_.items.filter(i => live.has(i.sticker_id));
  }, [wall_.items, stickers]);

  const preview = useMemo(() => pickPreview(stickers), [stickers]);
  const slots = bouquetSlots(preview.length);
  const previewKey = preview.map(s => s.id).join(',');
  // One batched sign request for whichever set is on screen, rather than
  // each tile minting its own — see hooks/useSignedUrls.ts.
  const shownPaths = useMemo(
    () => (arranged ? items.map(i => listImagePath(i.sticker)) : preview.map(listImagePath)),
    [arranged, items, previewKey]
  );
  const urls = useSignedUrls(shownPaths);

  const openEditor = async () => {
    if (seeding) return;
    haptic.tap();
    // First open: adopt whatever the fan is currently showing as the
    // starting arrangement, and only then flip the profile flag — if the
    // seed insert fails we stay on the fan rather than dropping the user
    // onto a wall that lost everything it had on it.
    if (!arranged && !seeding) {
      setSeeding(true);
      const { error } = await wall_.seedFrom(preview.map(s => s.id), canvas.aspect);
      setSeeding(false);
      if (error) return;
      const { error: flagError } = await onArranged();
      if (flagError) return;
    }
    setEditorOpen(true);
  };

  const showEmpty = arranged ? items.length === 0 : preview.length === 0;
  const brandNew = stickers.length === 0;
  const cy = canvas.height * 0.45;
  const cx = canvas.width / 2;

  return (
    <>
      {/* Outer view casts the shadow, inner view clips (a view that does both
          loses its shadow on iOS). */}
      <View style={styles.shadow}>
        <View style={styles.panel}>
          <HomeWallField path={backgroundPath} version={backgroundVersion} />
          <View pointerEvents="none" style={styles.topLight} />

          {/* Long-press anywhere on the wall also opens Arrange; stickers sit above it. */}
          {!showEmpty && (
            <Pressable
              style={StyleSheet.absoluteFill}
              onLongPress={() => { haptic.press(); openEditor(); }}
              delayLongPress={450}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          )}

          {showEmpty ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle} maxFontSizeMultiplier={1.3}>
                {brandNew ? 'Nothing stuck yet' : 'Nothing pinned yet'}
              </Text>
              <Text style={styles.emptyText} maxFontSizeMultiplier={1.5}>
                {brandNew
                  ? 'Photograph something near you. It becomes a sticker and a word.'
                  : 'Tap Arrange to put stickers up.'}
              </Text>
              {brandNew && (
                <Pressable
                  testID="home-wall-take-photo"
                  onPress={() => { haptic.tap(); router.push('/scan'); }}
                  style={({ pressed }) => [styles.photoBtn, pressed && styles.photoBtnPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Take a photo"
                >
                  <Camera size={18} strokeWidth={1.75} color={colors.white} />
                  <Text style={styles.photoText} maxFontSizeMultiplier={1.3}>Take a photo</Text>
                </Pressable>
              )}
            </View>
          ) : arranged ? (
            items.map(item => {
              const side = homeTileFraction(item.sticker_id) * canvas.width;
              return (
                <TouchableOpacity
                  key={item.sticker_id}
                  style={[
                    styles.tile,
                    {
                      left: clamp(item.x * canvas.width, HOME_WALL_SAFE, canvas.width - side - HOME_WALL_SAFE),
                      top: clamp(item.y * canvas.height, HOME_WALL_SAFE, canvas.height - side - HOME_WALL_SAFE),
                      width: side,
                      height: side,
                      transform: [{ rotate: `${Math.max(-6, Math.min(6, item.rotation))}deg` }],
                    },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => onPressSticker(item.sticker)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.sticker.word} — ${item.sticker.translation}`}
                >
                  <HomeWallTile
                    sticker={item.sticker}
                    size={side}
                    url={urls.get(listImagePath(item.sticker) ?? '') ?? null}
                    borderStyle={borderStyle}
                  />
                </TouchableOpacity>
              );
            })
          ) : (
            canvas.width > 0 && preview.map((sticker, i) => {
              const slot = slots[i];
              if (!slot) return null;
              return (
                <TouchableOpacity
                  key={sticker.id}
                  style={[
                    styles.tile,
                    {
                      left: cx + slot.dx - slot.size / 2,
                      top: cy + slot.dy - slot.size / 2,
                      width: slot.size,
                      height: slot.size,
                      zIndex: slot.z,
                      transform: [{ rotate: `${slot.tilt}deg` }],
                    },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => onPressSticker(sticker)}
                  accessibilityRole="button"
                  accessibilityLabel={`${sticker.word} — ${sticker.translation}`}
                >
                  <HomeWallTile
                    sticker={sticker}
                    size={slot.size}
                    url={urls.get(listImagePath(sticker) ?? '') ?? null}
                    borderStyle={borderStyle}
                  />
                </TouchableOpacity>
              );
            })
          )}

          {/* The one control on the wall: 28pt visible, 44pt hit, bottom-right. */}
          {(!brandNew || !showEmpty) && (
            <Pressable
              testID="home-wall-arrange"
              style={styles.chipHit}
              onPress={openEditor}
              disabled={seeding}
              accessibilityRole="button"
              accessibilityLabel="Arrange your wall"
              accessibilityState={{ disabled: seeding, busy: seeding }}
            >
              <View style={styles.chip}>
                {seeding
                  ? <ActivityIndicator size="small" color={colors.inkDark} />
                  : <Move size={14} strokeWidth={2} color={colors.inkDark} />}
                <Text style={styles.chipText} maxFontSizeMultiplier={1.15}>Arrange</Text>
              </View>
            </Pressable>
          )}
        </View>
      </View>

      <HomeWallEditor
        borderStyle={borderStyle}
        visible={editorOpen}
        onClose={() => setEditorOpen(false)}
        userId={userId}
        stickers={stickers}
        items={items}
        onAdd={wall_.addSticker}
        onRemove={wall_.removeSticker}
        onMove={wall_.moveSticker}
        onTidy={wall_.tidy}
        backgroundPath={backgroundPath}
        backgroundDim={backgroundDim}
        backgroundVersion={backgroundVersion}
        onChangeBackground={onChangeBackground}
        onBackgroundUploaded={() => setBackgroundVersion(v => v + 1)}
      />
    </>
  );
}

const makeStyles = ({ wall, colors }: Theme) => StyleSheet.create({
  shadow: {
    marginHorizontal: HOME_WALL_INSET,
    height: HOME_WALL_HEIGHT,
    borderRadius: HOME_WALL_RADIUS,
    backgroundColor: wall.fieldStops[1],
    shadowColor: colors.shadowDeep,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  panel: { flex: 1, borderRadius: HOME_WALL_RADIUS, overflow: 'hidden' },
  topLight: { position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: wall.shadowTop },
  tile: { position: 'absolute' },
  emptyWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: { fontSize: 20, lineHeight: 26, fontFamily: fonts.display, color: colors.inkDark, textAlign: 'center' },
  emptyText: { fontSize: 15, lineHeight: 21, fontFamily: fonts.text, color: colors.inkLight, textAlign: 'center', maxWidth: 240 },
  photoBtn: {
    marginTop: 4, height: 40, paddingHorizontal: 16, borderRadius: radii.full, backgroundColor: colors.terra,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  photoBtnPressed: { backgroundColor: colors.terraDark },
  photoText: { fontSize: 15, fontFamily: fonts.display, color: colors.white },
  chipHit: {
    position: 'absolute', right: 8, bottom: 8, height: 44, paddingHorizontal: 4,
    justifyContent: 'center', zIndex: 40,
  },
  chip: {
    height: 28, paddingLeft: 8, paddingRight: 10, borderRadius: radii.full,
    backgroundColor: wall.chip, borderWidth: 1, borderColor: wall.chipRing,
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  chipText: { fontSize: 13, fontFamily: fonts.display, color: colors.inkDark },
});
