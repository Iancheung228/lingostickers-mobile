import { router } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useBoards } from '@/hooks/useBoards';
import { Board } from '@/lib/types';
import BoardsList from '@/components/BoardsList';
import { colors, shadows, radii, spacing, fonts } from '@/constants/theme';

// Reached only when picking a different board than the one the Wall tab
// already jumped you into (see app/(tabs)/wall.tsx) — replace, not push, so
// switching boards never grows a deep stack of past boards to back through.
export default function BoardsScreen() {
  const { user } = useAuth();
  const { boards, loading, createBoard, deleteBoard } = useBoards(user?.id);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <ArrowLeft size={18} color={colors.inkMid} />
        </TouchableOpacity>
        <Text style={styles.title}>My Boards</Text>
        <View style={styles.headerSpacer} />
      </View>

      <BoardsList
        boards={boards}
        loading={loading}
        onCreateBoard={createBoard}
        onDeleteBoard={deleteBoard}
        onOpenBoard={(board: Board) => router.replace(`/board/${board.id}`)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.ms,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  headerSpacer: { width: 36, height: 36 },
  title: { flex: 1, fontSize: 15, fontFamily: fonts.cozy, color: colors.inkDark, textAlign: 'center' },
});
