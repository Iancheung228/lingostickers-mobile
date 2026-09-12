import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { avatarUrl } from '@/lib/avatars';
import { colors, radii, fonts } from '@/constants/theme';

// ---------------------------------------------------------------------------
// One avatar, used everywhere a person appears.
//
// This was previously re-declared in four places — the friends list, the
// requests block, ChallengeCard and FriendProfile — each with its own size and
// its own idea of the initial. Same person, four appearances.
//
// It draws the person's uploaded profile picture when they have one, and falls
// back to a tinted initial when they don't. The fallback isn't a placeholder
// to be designed away: a picture is optional at sign-up, and plenty of people
// will never set one. The tint is derived from the name rather than fixed, so
// those people stay visually distinguishable in a list where every avatar is
// otherwise an identical circle with a letter in it.
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
  /// Storage path of the person's profile picture (profiles.avatar_path).
  /// Null/undefined — which is also what every call site that hasn't been
  /// given one yet passes — renders the initial instead.
  avatarPath?: string | null;
  size?: number;
  /// Draws a ring around it — used in the rail to mark someone with something
  /// waiting from them.
  highlighted?: boolean;
}

export default function Avatar({ name, avatarPath, size = 36, highlighted }: AvatarProps) {
  const uri = avatarUrl(avatarPath);

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
      {uri ? (
        // The URL carries the upload timestamp in its filename, so it changes
        // whenever the picture does — caching it hard is safe, and it means a
        // friend's face is instant on every screen after the first.
        <Image
          source={{ uri }}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={120}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initialOf(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  highlighted: { borderWidth: 2, borderColor: colors.sageDark },
  initial: { fontFamily: fonts.display, color: colors.inkDark },
});
