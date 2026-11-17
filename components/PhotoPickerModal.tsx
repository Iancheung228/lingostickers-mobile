import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ChevronLeft, Shuffle } from 'lucide-react-native';
import { fonts, radii, spacing } from '@/constants/theme';
import { BATCH_MAX } from '@/lib/batchScan';
import { confirmLabel } from '@/lib/photoSelection';
import {
  allowMorePhotos, fetchSourcePage, loadAlbums,
  type AlbumInfo, type LibAsset, type LibraryAccess, type PickerSource,
} from '@/lib/photoLibrary';
import PhotoThumb from '@/components/PhotoThumb';
import Chip from '@/components/ui/Chip';
import Button from '@/components/ui/Button';
import { useMotion } from '@/lib/motion';
import { useThemedStyles, type Theme } from '@/hooks/useTheme';

type Tab = 'new' | 'favorites' | 'albums' | 'shuffle';

interface Props {
  visible: boolean;
  access: LibraryAccess;
  used: ReadonlySet<string>;
  selected: LibAsset[];
  capped: boolean;
  busy: boolean;
  onToggle: (a: LibAsset) => void;
  onConfirm: () => void;
  onClose: () => void;
  onSystemPicker: () => void;
  /** Re-read permission and the recent strip (after "Allow more photos"). */
  onRefresh: () => void;
  /** Changes when the library's visible contents may have changed under a steady access level. */
  reloadToken?: number;
}

const COLS = 4;
const GAP = 3;

// The in-app picker: newest-first grid, filter chips, paged. Selection lives in
// the parent (usePhotoLibrary) so the pageSheet's swipe-down, which the OS
// performs and we can't veto (lesson 10), loses nothing. Every change of
// source takes a ticket (lesson 11) so a slow reply for "Shuffle" can't land
// on top of "Favorites".
export default function PhotoPickerModal({ visible, access, used, selected, capped, busy, onToggle, onConfirm, onClose, onSystemPicker, onRefresh, reloadToken = 0 }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { reduced } = useMotion();
  const { width } = useWindowDimensions();
  const cell = Math.floor((width - GAP * (COLS - 1)) / COLS);

  const [tab, setTab] = useState<Tab>('new');
  const [album, setAlbum] = useState<AlbumInfo | null>(null);
  const [albums, setAlbums] = useState<AlbumInfo[]>([]);
  const [favoritesId, setFavoritesId] = useState<string | null>(null);
  const [assets, setAssets] = useState<LibAsset[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const seq = useRef(0);
  const loadingMore = useRef(false);
  const emptyPages = useRef(0);

  const source = useMemo<PickerSource | null>(() =>
    tab === 'new' ? { kind: 'new' }
    : tab === 'shuffle' ? { kind: 'shuffle' }
    : tab === 'favorites' ? { kind: 'favorites', albumId: favoritesId }
    : album ? { kind: 'album', albumId: album.id, title: album.title }
    : null, [tab, favoritesId, album]);
  const sourceKey = source ? `${source.kind}:${'albumId' in source ? source.albumId : ''}` : 'albums-list';

  const load = useCallback(async (src: PickerSource | null) => {
    const ticket = ++seq.current;
    loadingMore.current = false;
    emptyPages.current = 0;
    setError(false);
    if (!src) { setAssets([]); setCursor(null); setHasMore(false); setLoading(false); return; }
    setLoading(true);
    setAssets([]);
    try {
      const page = await fetchSourcePage(src, null, used);
      if (ticket !== seq.current) return;
      setAssets(page.assets); setCursor(page.cursor); setHasMore(page.hasMore);
    } catch {
      if (ticket === seq.current) setError(true);
    } finally {
      if (ticket === seq.current) setLoading(false);
    }
  }, [used]);

  // Albums + the Favorites album id: read once per open (after Allow more, too).
  useEffect(() => {
    if (!visible) return;
    let live = true;
    loadAlbums().then((r) => { if (live) { setAlbums(r.albums); setFavoritesId(r.favoritesId); } });
    return () => { live = false; };
  }, [visible, access, reloadToken]);

  // Reload when the source changes or the sheet opens. Not on `used` changes:
  // a photo saved while open shouldn't vanish from under the finger.
  const usedRef = useRef(used);
  usedRef.current = used;
  useEffect(() => {
    if (!visible) return;
    void load(source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sourceKey, favoritesId, access, reloadToken]);

  const loadMore = useCallback(async () => {
    if (!source || source.kind === 'shuffle' || !hasMore || loadingMore.current || loading) return;
    loadingMore.current = true;
    const ticket = seq.current;
    try {
      const page = await fetchSourcePage(source, cursor, usedRef.current);
      if (ticket !== seq.current) return;
      setAssets((cur) => cur.concat(page.assets)); setCursor(page.cursor); setHasMore(page.hasMore);
    } catch {
      if (ticket === seq.current) setHasMore(false);
    } finally {
      loadingMore.current = false;
    }
  }, [source, hasMore, loading, cursor]);

  // Every scanned page can be all used / screenshots: the grid is then empty, so
  // nothing scrolls and onEndReached never fires. Keep going, a few times.
  useEffect(() => {
    if (!visible || loading || error || assets.length > 0 || !hasMore) return;
    if (emptyPages.current >= 5) return;
    emptyPages.current += 1;
    void loadMore();
  }, [visible, loading, error, assets.length, hasMore, cursor, loadMore]);

  const order = (id: string) => selected.findIndex((s) => s.id === id) + 1;
  const n = selected.length;
  const inAlbumList = tab === 'albums' && !album;

  const empty =
    tab === 'new' ? 'No new photos. Everything recent already has a sticker.'
    : tab === 'favorites' ? (favoritesId ? 'No favorites yet.' : 'No Favorites album found.')
    : tab === 'shuffle' ? 'No photos from the past year.'
    : 'This album is empty.';

  return (
    <Modal visible={visible} animationType={reduced ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} testID="photo-picker">
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.cancel} hitSlop={{ top: 8, bottom: 8 }} accessibilityRole="button" accessibilityLabel="Cancel" testID="photo-picker-cancel">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            {capped ? `Up to ${BATCH_MAX} at a time` : n ? `${n} selected` : 'Choose photos'}
          </Text>
          <View style={styles.cancel} />
        </View>

        {access === 'limited' && (
          <View style={styles.limited} testID="photo-picker-limited">
            <Text style={styles.limitedText} maxFontSizeMultiplier={1.3}>Tabi can only see the photos you shared with it.</Text>
            <Pressable
              onPress={async () => { await allowMorePhotos(); onRefresh(); }}
              style={styles.limitedBtn}
              hitSlop={{ top: 8, bottom: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Allow more photos"
              testID="photo-picker-allow-more"
            >
              <Text style={styles.limitedBtnText} maxFontSizeMultiplier={1.2}>Allow more photos</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.chipsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="New" testID="picker-chip-new" selected={tab === 'new'} onPress={() => setTab('new')} />
            {!!favoritesId && <Chip label="Favorites" testID="picker-chip-favorites" selected={tab === 'favorites'} onPress={() => setTab('favorites')} />}
            <Chip label="Albums" testID="picker-chip-albums" selected={tab === 'albums'} onPress={() => { setTab('albums'); setAlbum(null); }} />
            <Chip label="Shuffle: past year" testID="picker-chip-shuffle" selected={tab === 'shuffle'} onPress={() => setTab('shuffle')} />
          </ScrollView>
        </View>

        {tab === 'albums' && album && (
          <Pressable onPress={() => setAlbum(null)} style={styles.crumb} accessibilityRole="button" accessibilityLabel="Back to albums" hitSlop={{ top: 6, bottom: 6 }}>
            <ChevronLeft size={18} color={styles.crumbText.color} />
            <Text style={styles.crumbText} numberOfLines={1}>{album.title}</Text>
          </Pressable>
        )}
        {tab === 'shuffle' && (
          <View style={styles.reshuffleRow}>
            <Pressable
              onPress={() => void load({ kind: 'shuffle' })}
              disabled={loading}
              style={[styles.reshuffle, loading && styles.dim]}
              accessibilityRole="button"
              accessibilityLabel="Reshuffle"
              testID="picker-reshuffle"
            >
              <Shuffle size={16} color={styles.reshuffleText.color} />
              <Text style={styles.reshuffleText} maxFontSizeMultiplier={1.2}>Reshuffle</Text>
            </Pressable>
          </View>
        )}

        {inAlbumList ? (
          <FlatList
            data={albums}
            keyExtractor={(a) => a.id}
            contentContainerStyle={styles.albumList}
            ListEmptyComponent={<Text style={styles.empty}>No albums.</Text>}
            renderItem={({ item }) => (
              <Pressable onPress={() => setAlbum(item)} style={styles.albumRow} accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.count} photos`}>
                <Text style={styles.albumTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.albumCount}>{item.count}</Text>
              </Pressable>
            )}
          />
        ) : (
          <FlatList
            key={`grid-${COLS}`}
            data={assets}
            numColumns={COLS}
            keyExtractor={(a) => a.id}
            columnWrapperStyle={{ gap: GAP }}
            ItemSeparatorComponent={GridGap}
            onEndReached={loadMore}
            onEndReachedThreshold={0.6}
            initialNumToRender={24}
            maxToRenderPerBatch={16}
            windowSize={7}
            removeClippedSubviews
            extraData={selected}
            renderItem={({ item }) => (
              <PhotoThumb asset={item} size={cell} radius={0} order={order(item.id)} used={tab !== 'new' && used.has(item.id)} onPress={onToggle} />
            )}
            ListEmptyComponent={
              loading ? <ActivityIndicator style={styles.spinner} />
              : error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.empty}>{"Couldn't load photos."}</Text>
                  <Button kind="tertiary" label="Try again" testID="photo-picker-retry" onPress={() => void load(source)} />
                </View>
              )
              : <Text style={styles.empty}>{empty}</Text>
            }
            ListFooterComponent={hasMore && assets.length ? <ActivityIndicator style={styles.spinner} /> : null}
          />
        )}

        <View style={styles.footer}>
          <Pressable onPress={onSystemPicker} style={styles.allPhotos} hitSlop={{ top: 8, bottom: 8 }} accessibilityRole="button" accessibilityLabel="All Photos, open the iOS photo picker" testID="photo-picker-all">
            <Text style={styles.allPhotosText} maxFontSizeMultiplier={1.2}>All Photos</Text>
          </Pressable>
          <Button
            label={n ? confirmLabel(n) : 'Select photos'}
            onPress={onConfirm}
            disabled={!n || busy}
            loading={busy}
            style={styles.confirm}
            testID="photo-picker-confirm"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const GridGap = () => <View style={{ height: GAP }} />;

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, minHeight: 52 },
  cancel: { minWidth: 72, minHeight: 44, justifyContent: 'center' },
  cancelText: { fontSize: 16, lineHeight: 22, fontFamily: fonts.text, color: colors.inkMid },
  title: { fontSize: 17, lineHeight: 22, fontFamily: fonts.display, color: colors.inkDark },
  limited: {
    marginHorizontal: spacing.md, marginBottom: spacing.sm, padding: spacing.md, borderRadius: 12,
    backgroundColor: colors.terraLight, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  limitedText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: fonts.text, color: colors.inkDark },
  limitedBtn: { minHeight: 44, justifyContent: 'center' },
  limitedBtnText: { fontSize: 14, lineHeight: 18, fontFamily: fonts.display, color: colors.terraInk },
  chipsWrap: { paddingBottom: spacing.sm },
  chips: { paddingHorizontal: spacing.md, gap: spacing.sm },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  crumbText: { fontSize: 15, lineHeight: 20, fontFamily: fonts.display, color: colors.inkDark, flexShrink: 1 },
  reshuffleRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, flexDirection: 'row' },
  reshuffle: {
    minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radii.full, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.terraLight,
  },
  reshuffleText: { fontSize: 14, lineHeight: 18, fontFamily: fonts.display, color: colors.inkDark },
  dim: { opacity: 0.45 },
  albumList: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  albumRow: {
    minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule,
  },
  albumTitle: { flex: 1, fontSize: 16, lineHeight: 22, fontFamily: fonts.text, color: colors.inkDark },
  albumCount: { fontSize: 14, lineHeight: 18, fontFamily: fonts.text, color: colors.inkLight },
  errorBox: { alignItems: 'center' },
  spinner: { marginVertical: spacing.lg },
  empty: { textAlign: 'center', padding: spacing.xl, fontSize: 15, lineHeight: 21, fontFamily: fonts.text, color: colors.inkMid },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule, backgroundColor: colors.sky,
  },
  allPhotos: { minHeight: 44, justifyContent: 'center', paddingRight: spacing.sm },
  allPhotosText: { fontSize: 15, lineHeight: 20, fontFamily: fonts.display, color: colors.terraInk },
  confirm: { flex: 1 },
});
