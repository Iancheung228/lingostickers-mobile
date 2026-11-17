import { useEffect, useMemo, useState } from 'react';
import { useMotion } from '@/lib/motion';
import { Modal, View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { X } from 'lucide-react-native';
import { Sticker } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { listImagePath } from '@/lib/thumbnails';
import StickerCard from '@/components/StickerCard';
import { spacing, fonts } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

interface StickerPickerModalProps {
  visible: boolean;
  currentUserId: string | undefined;
  onSelect: (sticker: Sticker) => void;
  onClose: () => void;
  title?: string;
  /// Passing this switches the grid from "pick one" to "toggle membership":
  /// every id in here draws checked, and tapping a checked card calls
  /// onSelect again to take it off. That was already true of the board
  /// caller's handler — nothing on screen said so, which made removing a
  /// sticker a behaviour you could only find by accident.
  selectedIds?: Set<string>;
  /// What the checked state means here, e.g. "on this board". Only shown
  /// alongside selectedIds.
  selectionNoun?: string;
}

export default function StickerPickerModal({
  visible, currentUserId, onSelect, onClose, title = 'Pick a Sticker', selectedIds, selectionNoun,
}: StickerPickerModalProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { reduced } = useMotion();
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!visible || !currentUserId) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    supabase
      .from('stickers')
      .select('*')
      .eq('user_id', currentUserId)
      .order('discovered_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setFailed(true);
        else setStickers((data ?? []) as Sticker[]);
        setLoading(false);
      }, () => {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [visible, currentUserId, attempt]);

  // One batched sign request for the whole picker grid — see
  // hooks/useSignedUrls.ts.
  const urls = useSignedUrls(useMemo(
    () => stickers.flatMap(s => [listImagePath(s), s.voice_note_path]),
    [stickers]
  ));

  return (
    <Modal visible={visible} animationType={reduced ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            {!!selectedIds && !!selectionNoun && (
              <Text style={styles.subtitle}>
                {selectedIds.size} {selectionNoun}
                {selectedIds.size > 0 ? ' · tap a checked one to take it off' : ' — tap to add'}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close the sticker picker"
          >
            <X size={22} color={colors.inkDark} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 48 }} color={colors.terraInk} size="large" />
        ) : failed ? (
          <View style={styles.errorBox}>
            <Text style={styles.empty}>{"Couldn't load your collection. Check your connection and try again."}</Text>
            <TouchableOpacity
              onPress={() => setAttempt(n => n + 1)}
              accessibilityRole="button"
              accessibilityLabel="Retry loading your collection"
              style={styles.retry}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : stickers.length === 0 ? (
          <Text style={styles.empty}>Nothing in your collection yet — scan something first!</Text>
        ) : (
          <FlatList
            data={stickers}
            keyExtractor={s => s.id}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <View style={styles.cardWrapper}>
                <StickerCard
                  sticker={item}
                  onPress={() => onSelect(item)}
                  selected={selectedIds?.has(item.id)}
                  imageUrl={urls.get(listImagePath(item) ?? '') ?? null}
                  voiceUrl={item.voice_note_path ? urls.get(item.voice_note_path) ?? null : null}
                />
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerText: { flex: 1, paddingRight: spacing.md },
  title: { fontSize: 20, fontFamily: fonts.display, color: colors.inkDark },
  subtitle: { fontSize: 12, fontFamily: fonts.display, color: colors.inkLight, marginTop: 2 },
  empty: { color: colors.inkFaint, textAlign: 'center', marginTop: 48, fontSize: 14, fontFamily: fonts.text, paddingHorizontal: 32 },
  errorBox: { alignItems: 'center' },
  retry: { marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  retryText: { fontSize: 15, fontFamily: fonts.display, color: colors.terraInk },
  grid: { paddingHorizontal: 16, paddingBottom: 32 },
  row: { gap: 12, marginBottom: 12 },
  cardWrapper: { flex: 1 },
});
