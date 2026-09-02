import { ComponentType, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, Pressable, Platform, useWindowDimensions,
} from 'react-native';
import { colors, radii, spacing, shadows, fonts } from '@/constants/theme';

type IconComponent = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export interface BoardMenuItem {
  key: string;
  label: string;
  icon: IconComponent;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /// Draws a hairline above this row. Used to fence the destructive action
  /// off from the routine ones, so "delete this board" is never simply the
  /// next row down from something harmless.
  separated?: boolean;
}

export interface MenuAnchor { x: number; y: number }

interface BoardMenuProps {
  visible: boolean;
  /// Window coordinates of the anchor button's bottom-left corner, from
  /// measureInWindow. Null keeps the menu closed — a menu with nowhere to
  /// point would otherwise flash in the top-left corner for a frame.
  anchor: MenuAnchor | null;
  items: BoardMenuItem[];
  onClose: () => void;
}

const MENU_WIDTH = 232;
const SCREEN_MARGIN = spacing.sm;

// A popover, not a bottom sheet. The board-level actions it holds (rename,
// tidy up, cover photo, delete) are *about* the thing directly under the
// button that opened it, and a sheet sliding up from the bottom would cover
// that thing while you choose. It also frees the header: every one of these
// used to need its own top-level control, which is why board rename had
// nowhere to live and autoArrange shipped with no way to call it.
export default function BoardMenu({ visible, anchor, items, onClose }: BoardMenuProps) {
  const { width: screenWidth } = useWindowDimensions();
  // Running an item's action while this Modal is still dismissing leaves a
  // second Modal (rename sheet, image picker) fighting the first for the
  // presentation slot on iOS — it silently never appears. Hold the action
  // until the dismissal actually completes.
  const pending = useRef<(() => void) | null>(null);

  const run = (item: BoardMenuItem) => {
    if (item.disabled) return;
    if (Platform.OS === 'ios') {
      pending.current = item.onPress;
      onClose();
    } else {
      onClose();
      item.onPress();
    }
  };

  if (!anchor) return null;

  const left = Math.min(
    Math.max(anchor.x, SCREEN_MARGIN),
    screenWidth - MENU_WIDTH - SCREEN_MARGIN,
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={() => { const fn = pending.current; pending.current = null; fn?.(); }}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Swallows taps on the card itself so choosing an item doesn't also
            fire the backdrop's dismiss underneath it. */}
        <Pressable style={[styles.card, { left, top: anchor.y + spacing.xs }]} onPress={() => {}}>
          {items.map(item => {
            const Icon = item.icon;
            const tint = item.disabled
              ? colors.inkFaint
              : item.destructive ? colors.error : colors.inkMid;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.row, item.separated && styles.rowSeparated]}
                onPress={() => run(item)}
                disabled={item.disabled}
                activeOpacity={0.6}
              >
                <Icon size={16} color={tint} />
                <Text style={[styles.label, { color: tint }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(43, 42, 40, 0.18)' },
  card: {
    position: 'absolute',
    width: MENU_WIDTH,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    paddingVertical: spacing.xs,
    ...shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.ms - 1,
  },
  rowSeparated: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    marginTop: spacing.xs,
    paddingTop: spacing.ms,
  },
  label: { fontSize: 14, fontFamily: fonts.text, letterSpacing: 0.1 },
});
