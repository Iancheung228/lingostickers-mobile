import { View, Text, StyleSheet } from 'react-native';
import { colors, radii } from '@/constants/theme';

// ---------------------------------------------------------------------------
// One avatar, used everywhere a person appears.
//
// This was previously re-declared in four places — the friends list, the
// requests block, ChallengeCard and FriendProfile — each with its own size and
// its own idea of the initial. Same person, four appearances.
//
// The tint is derived from the name rather than fixed, so people stay visually
// distinguishable in a list where every avatar is otherwise an identical blue
// circle with a letter in it.
// ---------------------------------------------------------------------------
const TINTS = [
  colors.terra,
  colors.sage,
  colors.skyDeep,
  colors.sageLight,
  colors.skyNight,
  colors.terraLight,
];

function initialOf(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : '?';
}

/// Stable per-name, so the same friend keeps the same colour between renders
/// and between screens.
function tintFor(name: string | null | undefined): string {
  const key = (name ?? '').trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length];
}

interface AvatarProps {
  name: string | null | undefined;
  size?: number;
  /// Draws a ring around it — used in the rail to mark someone with something
  /// waiting from them.
  highlighted?: boolean;
}

export default function Avatar({ name, size = 36, highlighted }: AvatarProps) {
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: radii.full,
          backgroundColor: tintFor(name),
        },
        highlighted && styles.highlighted,
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initialOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  highlighted: { borderWidth: 2, borderColor: colors.sageDark },
  initial: { fontWeight: '800', color: colors.inkDark },
});
