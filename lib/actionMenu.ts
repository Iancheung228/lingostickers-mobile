import { ActionSheetIOS, Alert, Platform } from 'react-native';

export interface MenuItem {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

/**
 * A native action sheet: the sheet's own row is the confirm for anything
 * destructive, so a destructive item goes last and is drawn red by the OS.
 * Android has no action sheet, so it falls back to an Alert with the same rows.
 */
export function showMenu(items: MenuItem[], title?: string) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [...items.map(i => i.label), 'Cancel'],
        cancelButtonIndex: items.length,
        destructiveButtonIndex: items.findIndex(i => i.destructive) >= 0 ? items.findIndex(i => i.destructive) : undefined,
      },
      index => { if (index < items.length) items[index].onPress(); },
    );
    return;
  }
  Alert.alert(title ?? 'More', undefined, [
    ...items.map(i => ({ text: i.label, style: i.destructive ? ('destructive' as const) : ('default' as const), onPress: i.onPress })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}
