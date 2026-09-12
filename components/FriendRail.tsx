import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { UserPlus } from 'lucide-react-native';
import Avatar from '@/components/Avatar';
import { FriendWithProfile } from '@/lib/types';
import { colors, radii, spacing, fonts } from '@/constants/theme';

// ---------------------------------------------------------------------------
// The friends directory, as one line.
//
// Five to twenty people don't need a full-width row each. As a vertical list
// this pushed everything with a deadline attached below the fold; as a rail it
// costs one line, stays visible while the rest of the page is read, and puts
// the person first — which is the right way round for starting a challenge,
// since you think of who before you think of what.
//
// "Add" lives at the end rather than in the header, so the act of growing the
// list sits with the list itself, and is reachable at any length.
// ---------------------------------------------------------------------------
interface FriendRailProps {
  friends: FriendWithProfile[];
  /// Ids with something waiting from them, so the rail can point at the inbox.
  awaitingIds?: Set<string>;
  onSelect: (friend: FriendWithProfile) => void;
  onAdd: () => void;
}

const ITEM_WIDTH = 60;

export default function FriendRail({ friends, awaitingIds, onSelect, onAdd }: FriendRailProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {friends.map(f => (
        <TouchableOpacity
          key={f.id}
          style={styles.item}
          onPress={() => onSelect(f)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Open ${f.friend.username ?? 'friend'}`}
        >
          <Avatar
            name={f.friend.username}
            avatarPath={f.friend.avatar_path}
            size={46}
            highlighted={awaitingIds?.has(f.friend.id)}
          />
          <Text style={styles.name} numberOfLines={1}>
            {f.friend.username ?? 'friend'}
          </Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={styles.item}
        onPress={onAdd}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Add a friend"
      >
        <View style={styles.addCircle}>
          <UserPlus size={19} color={colors.inkLight} />
        </View>
        <Text style={[styles.name, styles.addName]} numberOfLines={1}>
          Add
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  item: { width: ITEM_WIDTH, alignItems: 'center', gap: 5 },
  name: { fontSize: 11, fontFamily: fonts.display, color: colors.inkLight, maxWidth: ITEM_WIDTH },
  addName: { color: colors.inkFaint },
  addCircle: {
    width: 46,
    height: 46,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.inkFaint,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
});
