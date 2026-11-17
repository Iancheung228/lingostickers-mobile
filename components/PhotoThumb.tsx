import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import { fonts } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';
import type { LibAsset } from '@/lib/photoLibrary';

interface Props {
  asset: LibAsset;
  size: number;
  radius: number;
  /** 1-based tap order, or 0 when not selected. */
  order: number;
  /** Already turned into a sticker on this device. */
  used?: boolean;
  onPress: (a: LibAsset) => void;
}

// One photo. expo-image asks the Photos framework for a thumbnail the size of
// the view, so a 4-up grid never decodes full-resolution images. Memoised: a
// selection change re-renders only the cells whose `order` changed.
function PhotoThumb({ asset, size, radius, order, used, onPress }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const selected = order > 0;
  return (
    <Pressable
      testID={`photo-thumb-${selected ? 'selected' : 'idle'}`}
      onPress={() => onPress(asset)}
      accessibilityRole="button"
      accessibilityLabel={selected ? `Photo, selected ${order}` : used ? 'Photo, already a sticker' : 'Photo'}
      accessibilityState={{ selected }}
      style={[{ width: size, height: size, borderRadius: radius }, styles.cell]}
    >
      <Image
        source={{ uri: asset.uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        recyclingKey={asset.id}
        transition={0}
      />
      {used && !selected && (
        <View style={styles.usedBadge} pointerEvents="none"><Check size={11} strokeWidth={3} color={colors.white} /></View>
      )}
      {selected && (
        <View style={[StyleSheet.absoluteFill, styles.ring, { borderRadius: radius }]} pointerEvents="none">
          <View style={styles.badge}><Text style={styles.badgeText} maxFontSizeMultiplier={1.2}>{order}</Text></View>
        </View>
      )}
    </Pressable>
  );
}

export default memo(PhotoThumb);

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  cell: { overflow: 'hidden', backgroundColor: colors.cardAlt },
  ring: { borderWidth: 3, borderColor: colors.terra, alignItems: 'flex-end', padding: 4 },
  badge: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 4,
    backgroundColor: colors.terra, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 12, lineHeight: 15, fontFamily: fonts.display },
  usedBadge: {
    position: 'absolute', left: 4, bottom: 4, width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.photoBadge, alignItems: 'center', justifyContent: 'center',
  },
});
