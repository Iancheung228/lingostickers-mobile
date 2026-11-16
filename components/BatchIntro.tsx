import { Modal, View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { X } from 'lucide-react-native';
import { fonts, spacing } from '@/constants/theme';
import Button from '@/components/ui/Button';
import { useTheme, useThemedStyles, type Theme } from '@/hooks/useTheme';

// Shown once, when 2+ photos were picked, before anything is made. It says what
// the next minutes look like, so the batch never feels like it skips the review.
// Cancelling discards nothing: no card exists yet.
interface Props {
  count: number;
  onStart: () => void;
  onCancel: () => void;
}

export default function BatchIntro({ count, onStart, onCancel }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <SafeAreaView style={styles.container} testID="batch-intro">
        <View style={styles.header}>
          <TouchableOpacity
            testID="batch-intro-cancel"
            onPress={onCancel}
            style={styles.closeButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Cancel. Nothing has been made yet."
          >
            <X size={24} color={colors.inkDark} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={styles.title} accessibilityRole="header" testID="batch-intro-title">{`${count} photos`}</Text>
          <Text style={styles.sub}>Each one becomes a card you can check and edit, just like a single photo.</Text>

          <View style={styles.steps}>
            <View style={styles.step}>
              <View style={styles.num}><Text style={styles.numText}>1</Text></View>
              <Text style={styles.stepText}>Cut out the object in each photo</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.num}><Text style={styles.numText}>2</Text></View>
              <Text style={styles.stepText}>Check each card — edit the word, add more words — while the rest finish</Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Button label="Start" testID="batch-intro-start" onPress={onStart} />
          <Button kind="tertiary" label="Cancel" testID="batch-intro-cancel-text" onPress={onCancel} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = ({ colors, type }: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 12 },
  closeButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, gap: spacing.md },
  title: { fontSize: 34, lineHeight: 40, fontFamily: fonts.display, color: colors.inkDark },
  sub: { ...type.body, color: colors.inkMid },
  steps: { gap: spacing.md, marginTop: spacing.sm },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  num: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.terraLight,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  numText: { fontSize: 15, fontFamily: fonts.display, color: colors.terraInk },
  stepText: { flex: 1, fontSize: 17, lineHeight: 24, fontFamily: fonts.text, color: colors.inkDark },
  actions: { paddingHorizontal: 24, paddingBottom: spacing.md, gap: spacing.sm },
});
