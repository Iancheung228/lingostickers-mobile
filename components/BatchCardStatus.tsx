import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { X, RotateCcw } from 'lucide-react-native';
import { colors, fonts } from '@/constants/theme';

// Batch create's review step, for a card that is not ready to show: still being
// made, or failed. A finished card goes through DiscoveryReveal instead. The
// X closes the sheet and leaves the batch queued (lesson #10); only "Skip this
// card" throws anything away.
interface Props {
  label: string; // "2 of 5"
  state: 'pending' | 'failed';
  error: string | null;
  onRetry: () => void;
  onSkip: () => void;
  onDismiss: () => void;
}

export default function BatchCardStatus({ label, state, error, onRetry, onSkip, onDismiss }: Props) {
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onDismiss}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title} testID="batch-status-title">{`Card ${label}`}</Text>
          <TouchableOpacity
            testID="batch-status-close"
            onPress={onDismiss}
            style={styles.closeButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close and finish these cards later"
          >
            <X size={24} color={colors.inkDark} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {state === 'pending' ? (
            <>
              <ActivityIndicator size="large" color={colors.terra} />
              <Text style={styles.headline} testID="batch-status-pending">Still making this card…</Text>
              <Text style={styles.sub}>It will appear here as soon as it is ready.</Text>
            </>
          ) : (
            <>
              <Text style={styles.headline} testID="batch-status-failed">This card didn&apos;t work out</Text>
              <Text style={styles.sub}>{error ?? 'Something went wrong. Please try again.'}</Text>
              <TouchableOpacity testID="batch-status-retry" style={styles.primary} onPress={onRetry} accessibilityRole="button">
                <RotateCcw size={18} color={colors.white} />
                <Text style={styles.primaryText}>Try again</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity testID="batch-status-skip" style={styles.skip} onPress={onSkip} accessibilityRole="button">
            <Text style={styles.skipText}>Skip this card</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  title: { fontSize: 18, fontFamily: fonts.display, color: colors.inkDark },
  closeButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  headline: { fontSize: 20, fontFamily: fonts.display, color: colors.inkDark, textAlign: 'center' },
  sub: { fontSize: 15, fontFamily: fonts.text, color: colors.inkMid, textAlign: 'center', lineHeight: 21 },
  primary: {
    marginTop: 8, backgroundColor: colors.terra, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 28,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  primaryText: { color: colors.white, fontSize: 16, fontFamily: fonts.display },
  skip: { paddingVertical: 12, paddingHorizontal: 20 },
  skipText: { color: colors.inkFaint, fontSize: 14, fontFamily: fonts.display },
});
