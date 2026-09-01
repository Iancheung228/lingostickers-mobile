import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Pencil } from 'lucide-react-native';
import { Sticker, WallBackgroundDim } from '@/lib/types';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { useHomeWall } from '@/hooks/useHomeWall';
import { seededRandom } from '@/lib/seededRandom';
import { homeCanvasSize, homeTileFraction, HOME_WALL_HEIGHT, HOME_WALL_INSET } from '@/lib/homeWall';
import WallBackground from '@/components/WallBackground';
import HomeWallTile from '@/components/HomeWallTile';
import HomeWallEditor from '@/components/HomeWallEditor';
import { colors, radii, fonts, spacing, shadows } from '@/constants/theme';

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
}

// How many the auto fan shows before the user has arranged anything.
const PREVIEW_COUNT = 6;
const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;
const BASE_TILE = 72;

// ── The auto fan: what an un-arranged wall looks like ────────────────────
//
// Kept, rather than starting everyone at an empty canvas, because a brand
// new user has nothing to arrange yet and "here's what you just captured"
// is a better first thing to see than a blank board and a chore. The first
// time the user opens the editor, whatever's in this fan is seeded as their
// real arrangement (useHomeWall.seedFrom), so the hand-off is invisible.

function fanSlots(n: number): number[] {
  if (n === 0) return [];
  // Center-out: 0, +1, -1, +2, -2, … — the newest sticker always lands at
  // slot 0 (front and center), older ones alternate out to either side.
  const seq: number[] = [0];
  let k = 1;
  while (seq.length < n) {
    seq.push(k);
    if (seq.length < n) seq.push(-k);
    k++;
  }
  return seq;
}

// "Most fav or recent": the newest capture anchors the center, the rest is
// a blend of favorites and latest additions — favoriting is a direct way to
// make something show up here.
function pickPreview(stickers: Sticker[]): Sticker[] {
  if (stickers.length === 0) return [];
  const [hero, ...rest] = stickers;
  const favorites = rest.filter(s => s.is_favorite).slice(0, 3);
  const favoriteIds = new Set(favorites.map(s => s.id));
  const recents = rest.filter(s => !favoriteIds.has(s.id));
  const fillCount = Math.max(PREVIEW_COUNT - 1 - favorites.length, 0);
  return [hero, ...favorites, ...recents.slice(0, fillCount)];
}

function FanTile({
  sticker, slot, canvasWidth, canvasHeight, isHero, heroScale, opacity, url, onPress,
}: {
  sticker: Sticker; slot: number; canvasWidth: number; canvasHeight: number;
  isHero: boolean; heroScale: Animated.Value; opacity: Animated.Value;
  url: string | null; onPress: () => void;
}) {
  const scale = Math.max(0.7, 1.15 - Math.abs(slot) * 0.09);
  const size = BASE_TILE * scale;
  const jitter = (seededRandom(sticker.id, 5) * 2 - 1) * 4;
  const rotation = slot * 6 + jitter;
  const spread = Math.min(BASE_TILE * 0.62, (canvasWidth / 2 - size / 2) / 3.2);
  const x = canvasWidth / 2 + slot * spread - size / 2;
  const y = canvasHeight / 2 + Math.abs(slot) * 5 - size / 2;
  const isFresh = Date.now() - new Date(sticker.created_at).getTime() < NEW_WINDOW_MS;

  return (
    <Animated.View
      style={[
        styles.tile,
        {
          left: x, top: y, width: size, height: size,
          zIndex: 10 - Math.abs(slot),
          opacity,
          transform: [{ rotate: `${rotation}deg` }, { scale: isHero ? heroScale : 1 }],
        },
      ]}
    >
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onPress} activeOpacity={0.85}>
        <HomeWallTile sticker={sticker} size={size} url={url} />
      </TouchableOpacity>
      {isHero && isFresh && (
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>✨ new</Text>
        </View>
      )}
    </Animated.View>
  );
}

// Owns the entrance stagger + hero "breathing" idle animation. Keyed by the
// caller on the joined preview ids, so it fully remounts only when the set
// of stickers shown actually changes — not on every unrelated re-render.
function TileFan({
  preview, slots, canvasWidth, canvasHeight, urls, onPressSticker,
}: {
  preview: Sticker[]; slots: number[]; canvasWidth: number; canvasHeight: number;
  urls: Map<string, string>; onPressSticker: (s: Sticker) => void;
}) {
  const opacities = useRef(preview.map(() => new Animated.Value(0))).current;
  const heroScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.stagger(45, opacities.map(v =>
      Animated.timing(v, { toValue: 1, duration: 260, useNativeDriver: true })
    )).start();

    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(heroScale, { toValue: 1.035, duration: 1800, useNativeDriver: true }),
        Animated.timing(heroScale, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    );
    breathe.start();
    return () => breathe.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {preview.map((sticker, i) => (
        <FanTile
          key={sticker.id}
          sticker={sticker}
          slot={slots[i]}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          isHero={slots[i] === 0}
          heroScale={heroScale}
          opacity={opacities[i]}
          url={urls.get(sticker.image_path) ?? null}
          onPress={() => onPressSticker(sticker)}
        />
      ))}
    </>
  );
}

export default function MiniStickerWall({
  stickers, userId, backgroundPath, backgroundDim, onChangeBackground,
  arranged, onArranged, onPressSticker,
}: MiniStickerWallProps) {
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
  const wall = useHomeWall(userId);

  // Deleting a sticker from the collection cascades its home_stickers row
  // away in the database, but this component has no way to hear about that
  // — the delete happens over on the grid. Two belts: re-read on focus, and
  // never render a pin whose sticker isn't in the collection the parent
  // just fetched, so a delete on this same screen takes effect immediately
  // rather than leaving a tile pointing at nothing.
  useFocusEffect(useCallback(() => { wall.refetch(); }, [wall.refetch]));

  const items = useMemo(() => {
    if (stickers.length === 0) return wall.items; // still loading — don't blank the wall
    const live = new Set(stickers.map(s => s.id));
    return wall.items.filter(i => live.has(i.sticker_id));
  }, [wall.items, stickers]);

  const preview = useMemo(() => pickPreview(stickers), [stickers]);
  const slots = fanSlots(preview.length);
  const previewKey = preview.map(s => s.id).join(',');
  // One batched sign request for whichever set is on screen, rather than
  // each tile minting its own — see hooks/useSignedUrls.ts.
  const shownPaths = useMemo(
    () => (arranged ? items.map(i => i.sticker.image_path) : preview.map(s => s.image_path)),
    [arranged, items, previewKey]
  );
  const urls = useSignedUrls(shownPaths);

  const openEditor = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // First open: adopt whatever the fan is currently showing as the
    // starting arrangement, and only then flip the profile flag — if the
    // seed insert fails we stay on the fan rather than dropping the user
    // onto a wall that lost everything it had on it.
    if (!arranged && !seeding) {
      setSeeding(true);
      const { error } = await wall.seedFrom(preview.map(s => s.id), canvas.aspect);
      setSeeding(false);
      if (error) return;
      const { error: flagError } = await onArranged();
      if (flagError) return;
    }
    setEditorOpen(true);
  };

  const showEmpty = arranged ? items.length === 0 : preview.length === 0;

  return (
    <>
      <View style={styles.panel}>
        <WallBackground path={backgroundPath} dim={backgroundDim} version={backgroundVersion} />

        {showEmpty ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              {stickers.length === 0
                ? 'Your wall is empty — scan something to start filling it in!'
                : 'Nothing pinned yet — tap Arrange to put stickers up.'}
            </Text>
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
                    left: item.x * canvas.width,
                    top: item.y * canvas.height,
                    width: side,
                    height: side,
                    transform: [{ rotate: `${item.rotation}deg` }],
                  },
                ]}
                activeOpacity={0.85}
                onPress={() => onPressSticker(item.sticker)}
              >
                <HomeWallTile
                  sticker={item.sticker}
                  size={side}
                  url={urls.get(item.sticker.image_path) ?? null}
                />
              </TouchableOpacity>
            );
          })
        ) : (
          canvas.width > 0 && (
            <TileFan
              key={previewKey}
              preview={preview}
              slots={slots}
              canvasWidth={canvas.width}
              canvasHeight={canvas.height}
              urls={urls}
              onPressSticker={onPressSticker}
            />
          )
        )}

        {/* The one control on the panel now. It used to sit next to a
            cover-photo button and a whole-panel tap target that both went
            somewhere else; the cover photo moved inside the editor (it's an
            arranging decision), and the Boards tab is already reachable
            from the tab bar and doesn't need a second door here. */}
        <TouchableOpacity style={styles.arrangeBtn} onPress={openEditor} activeOpacity={0.85} disabled={seeding}>
          {seeding ? (
            <ActivityIndicator size="small" color={colors.inkDark} />
          ) : (
            <Pencil size={12} color={colors.inkDark} />
          )}
          <Text style={styles.arrangeText}>Arrange</Text>
        </TouchableOpacity>
      </View>

      <HomeWallEditor
        visible={editorOpen}
        onClose={() => setEditorOpen(false)}
        userId={userId}
        stickers={stickers}
        items={items}
        onAdd={wall.addSticker}
        onRemove={wall.removeSticker}
        onMove={wall.moveSticker}
        onTidy={wall.tidy}
        backgroundPath={backgroundPath}
        backgroundDim={backgroundDim}
        backgroundVersion={backgroundVersion}
        onChangeBackground={onChangeBackground}
        onBackgroundUploaded={() => setBackgroundVersion(v => v + 1)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: HOME_WALL_INSET,
    marginBottom: spacing.sm,
    height: HOME_WALL_HEIGHT,
    borderRadius: radii.xl,
    // The white mount is what lets the panel sit half-over the home
    // screen's rose band and still read as one card rather than a hole
    // punched in the band. The editor wears the same mount.
    borderWidth: 5,
    borderColor: colors.white,
    overflow: 'hidden',
    ...shadows.card,
  },
  // No card behind a tile on purpose — just the sticker's own cutout PNG,
  // so the panel shows photos floating on the board rather than boxed in
  // white index cards. Android ignores PNG alpha for shadow shape, so
  // elevation is dropped there (matches BoardCanvas's cutout tiles).
  tile: {
    position: 'absolute',
    shadowColor: colors.inkDark,
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0,
  },
  newBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.sage,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radii.full,
    zIndex: 3,
    ...shadows.card,
  },
  newBadgeText: { fontSize: 8, fontFamily: fonts.mono, fontWeight: '700', color: colors.inkDark },
  emptyWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.inkDark, textAlign: 'center', opacity: 0.8 },
  arrangeBtn: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingLeft: spacing.ms,
    paddingRight: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.full,
    ...shadows.card,
  },
  arrangeText: { fontSize: 12, fontWeight: '700', color: colors.inkDark },
});
