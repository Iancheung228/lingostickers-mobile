import { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Check, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { REPORT_REASONS, submitReport } from '@/lib/moderation';
import type { ReportReason } from '@/lib/types';
import { colors, radii, spacing, shadows, fonts, typography } from '@/constants/theme';

// ---------------------------------------------------------------------------
// Reporting content or a person.
//
// One sheet serves both, because from the reporter's side they are the same
// act — something is wrong and a human should look at it. What differs is only
// whether a challenge id rides along, which decides whether a reviewer sees a
// specific image or a person's history.
//
// The offer to block afterwards is the important part of this screen. Someone
// who has just reported a person almost always wants them gone too, and making
// that a second, separately-discovered action is how you end up with reports
// filed by people who are still being contacted by the person they reported.
// ---------------------------------------------------------------------------

interface ReportSheetProps {
  visible: boolean;
  reporterId: string | undefined;
  reportedUserId: string | undefined;
  reportedName: string | null;
  /// Set when reporting one specific challenge rather than the person.
  challengeId?: string | null;
  /// Omitted where blocking makes no sense or is already handled by the caller.
  onBlock?: () => void;
  onClose: () => void;
}

export default function ReportSheet({
  visible, reporterId, reportedUserId, reportedName, challengeId, onBlock, onClose,
}: ReportSheetProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [sending, setSending] = useState(false);

  // A pageSheet is dismissed by a downward swipe that iOS performs itself —
  // there is no hook to veto it and no confirmation to put in front of it. So
  // an accidental swipe must not be able to destroy anything: the answers are
  // cleared when the sheet opens on a *different* subject, or after a report
  // actually goes, and not merely because it closed. Reopening on the same
  // person hands back exactly what was typed.
  //
  // (Clearing on close rather than on open was also wrong for a second
  // reason: the previous answers stayed on screen while the sheet slid away,
  // which read as the report having failed to send.)
  const target = `${reportedUserId ?? ''}|${challengeId ?? ''}`;
  const [draftFor, setDraftFor] = useState(target);

  useEffect(() => {
    if (!visible) return;
    setSending(false);
    if (draftFor !== target) {
      setReason(null);
      setDetail('');
      setDraftFor(target);
    }
  }, [visible, target, draftFor]);

  const name = reportedName ?? 'this person';

  const handleSend = async () => {
    if (!reason || !reporterId || !reportedUserId || sending) return;
    setSending(true);
    const { error } = await submitReport(reporterId, {
      reportedUserId,
      challengeId,
      reason,
      detail,
    });
    setSending(false);

    if (error) {
      Alert.alert(
        "Report didn't send",
        'Check your connection and try again — nothing was submitted.',
      );
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setReason(null);
    setDetail('');
    onClose();

    if (onBlock) {
      Alert.alert(
        'Report received',
        `Thanks — we'll review this. Do you also want to block ${name}? They won't be able to send you challenges or friend requests.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: `Block ${name}`, style: 'destructive', onPress: onBlock },
        ],
      );
    } else {
      Alert.alert('Report received', "Thanks — we'll review this.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Report</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close without reporting"
          >
            <X size={22} color={colors.inkDark} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.lede}>
              {challengeId
                ? `What's wrong with this challenge from ${name}?`
                : `What's wrong with ${name}?`}
            </Text>

            <View style={styles.card}>
              {REPORT_REASONS.map(({ code, label, detail: hint }, i) => {
                const active = reason === code;
                return (
                  <TouchableOpacity
                    key={code}
                    style={[styles.reasonRow, i > 0 && styles.rowDivider]}
                    onPress={() => { Haptics.selectionAsync(); setReason(code); }}
                    activeOpacity={0.8}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={label}
                  >
                    <View style={styles.reasonText}>
                      <Text style={styles.reasonLabel}>{label}</Text>
                      <Text style={styles.reasonHint}>{hint}</Text>
                    </View>
                    {active && (
                      <View style={styles.tick}>
                        <Check size={12} color={colors.white} strokeWidth={3} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>ANYTHING ELSE? (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              value={detail}
              onChangeText={setDetail}
              placeholder="Add any detail that would help us review this"
              placeholderTextColor={colors.inkFaint}
              multiline
              maxLength={1000}
              textAlignVertical="top"
              accessibilityLabel="Extra detail about this report"
            />

            <TouchableOpacity
              style={[styles.submit, (!reason || sending) && styles.submitDisabled]}
              onPress={handleSend}
              disabled={!reason || sending}
              accessibilityRole="button"
              accessibilityLabel="Send this report"
              accessibilityState={{ disabled: !reason || sending, busy: sending }}
            >
              {sending
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.submitText}>Send report</Text>}
            </TouchableOpacity>

            <Text style={styles.footnote}>
              Reports go to a person, not a robot. We look at every one, and we
              never tell the person you reported them.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { fontSize: 20, fontFamily: fonts.display, color: colors.inkDark },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  lede: { ...typography.body, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.card,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.ms,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  reasonText: { flex: 1 },
  reasonLabel: { fontSize: 15, fontFamily: fonts.display, color: colors.inkDark },
  reasonHint: { fontSize: 12, fontFamily: fonts.text, color: colors.inkLight, marginTop: 1 },
  tick: {
    width: 20, height: 20, borderRadius: radii.full,
    backgroundColor: colors.sageDark,
    alignItems: 'center', justifyContent: 'center',
  },
  fieldLabel: { fontSize: 11, fontFamily: fonts.monoBold, color: colors.inkFaint, letterSpacing: 1.2, marginTop: spacing.lg, marginBottom: spacing.sm, },
  input: { backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.md, minHeight: 96, fontSize: 15, fontFamily: fonts.text, color: colors.inkMid, },
  submit: {
    backgroundColor: colors.terra,
    borderRadius: radii.lg,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...shadows.button,
  },
  submitDisabled: { backgroundColor: colors.terraLight, shadowOpacity: 0 },
  submitText: { color: colors.white, fontSize: 15, fontFamily: fonts.display, letterSpacing: 0.3 },
  footnote: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 17,
  },
});
