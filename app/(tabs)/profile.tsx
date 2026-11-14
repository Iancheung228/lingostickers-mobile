import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, Linking, Switch, AppState,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import {
  Camera, LogOut, Check, Trash2, Shield, ExternalLink, Mail, Plus, Minus, Bell, Clock, Download,
  Layers, Hand, Volume2, Repeat2, ScanLine,
} from 'lucide-react-native';
import RoseBand from '@/components/RoseBand';
import Row, { RowGroup } from '@/components/ui/Row';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ToastProvider';
import { isOnline } from '@/lib/connectivity';
import { showMenu } from '@/lib/actionMenu';
import { usePendingDeletes } from '@/components/PendingDeleteProvider';
import BottomSheet, { BottomSheetHandle } from '@/components/BottomSheet';
import Avatar from '@/components/Avatar';
import { TAB_BAR_CLEARANCE } from '@/constants/tabBar';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { Language, Sticker, WallDisplayStyle, CutoutBorderStyle } from '@/lib/types';
import { pickAvatarImage } from '@/lib/avatars';
import { isLocalCutoutAvailable } from '@/lib/cutout';
import { friendlyErrorSync } from '@/lib/friendlyError';
import { haptic } from '@/lib/haptics';
import { dueAtMs } from '@/lib/review';
import { useStudyPrefs } from '@/lib/studyPrefs';
import { exportCards } from '@/lib/exportCards';
import {
  DEFAULT_REMINDER, ReminderSettings, disableReminder, ensureReminderPermission, formatReminderTime,
  isReminderPermitted, loadReminder, scheduleReminder,
} from '@/lib/reminder';
import { LANGUAGES } from '@/lib/languages';
import {
  colors, e1, fonts, radii, spacing, type, wordFontFor, GUTTER, MIN_TAP,
} from '@/constants/theme';

// Published at the apex domain and linked from App Store Connect too. In
// the app because the Profile screen is where a person — and a reviewer —
// looks for it.
const PRIVACY_URL = 'https://tabistickers.com/privacy.html';

// Guideline 1.2 asks for published contact information, so it stays on the
// Profile screen under Support.
const SUPPORT_EMAIL = 'iancheung228@gmail.com';

const WALL_DISPLAY_STYLES: { code: WallDisplayStyle; label: string; subtitle: string }[] = [
  { code: 'framed', label: 'Framed', subtitle: 'Stickers sit inside a little photo card' },
  { code: 'cutout', label: 'Cutout only', subtitle: 'Just the sticker shape, no card behind it' },
];

// These describe what the setting ACTUALLY does: every sticker gets a thin white
// edge baked into its PNG when it is cut out, and nothing here can remove it
// (that is a Swift change and a native rebuild). The options change what sits
// on top of it.
const CUTOUT_BORDER_STYLES: { code: CutoutBorderStyle; label: string; subtitle: string }[] = [
  { code: 'outline', label: 'Thick outline', subtitle: 'Widens the white edge into a bold sticker border' },
  { code: 'shadow', label: 'Shadow', subtitle: 'A soft drop shadow behind the cutout' },
  { code: 'none', label: 'Flat', subtitle: 'No shadow and no extra border' },
];

// 30-minute steps, 6:00 to 23:30: enough choice for a daily nudge without a
// native time picker (which would need a rebuild).
const REMINDER_TIMES: { hour: number; minute: number }[] = Array.from({ length: 36 }, (_, i) => {
  const mins = 6 * 60 + i * 30;
  return { hour: Math.floor(mins / 60), minute: mins % 60 };
});

const stepUp = (v: number) => Math.min(100, v < 10 ? v + 1 : v + 5);
const stepDown = (v: number) => Math.max(1, v <= 10 ? v - 1 : v - 5);

export default function ProfileScreen() {
  const { user, signOut, deleteAccount } = useAuth();
  const toast = useToast();
  const {
    profile, setTargetLanguage, setWallDisplayStyle, setCutoutBorderStyle, setAvatar, removeAvatar,
  } = useProfile();
  const prefs = useStudyPrefs();
  const { pendingDeleteIds } = usePendingDeletes();
  const [fetched, setFetched] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  // The stats quote counts from this fetch; a failure would otherwise report a
  // confident, wrong "0".
  const [loadError, setLoadError] = useState(false);
  const [updatingLanguage, setUpdatingLanguage] = useState<Language | null>(null);
  const [updatingWallStyle, setUpdatingWallStyle] = useState<WallDisplayStyle | null>(null);
  const [updatingBorderStyle, setUpdatingBorderStyle] = useState<CutoutBorderStyle | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Reminder
  const [reminder, setReminder] = useState<ReminderSettings>(DEFAULT_REMINDER);
  const [notifDenied, setNotifDenied] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  const stickers = useMemo(
    () => (pendingDeleteIds.size ? fetched.filter(s => !pendingDeleteIds.has(s.id)) : fetched),
    [fetched, pendingDeleteIds],
  );

  const fetchStickers = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('stickers').select('*').eq('user_id', user.id);
    if (error) {
      setLoadError(true);
    } else if (data) {
      setLoadError(false);
      setFetched(data as Sticker[]);
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { fetchStickers(); }, [fetchStickers]));

  // The reminder's stored state, checked against what the system now allows
  // (permission can be revoked in Settings while the app is away).
  const syncReminder = useCallback(async () => {
    const stored = await loadReminder();
    const permitted = await isReminderPermitted();
    if (stored.enabled && !permitted) {
      setReminder({ ...stored, enabled: false });
      setNotifDenied(true);
    } else {
      setReminder(stored);
      if (permitted) setNotifDenied(false);
    }
  }, []);
  useEffect(() => { void syncReminder(); }, [syncReminder]);
  const denied = useRef(notifDenied);
  denied.current = notifDenied;
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { if (s === 'active' && denied.current) void syncReminder(); });
    return () => sub.remove();
  }, [syncReminder]);

  // Whether Apple Vision segmentation is available on this phone. Fixed for
  // the life of the process, so it is read once rather than per render.
  const onDevice = useMemo(() => isLocalCutoutAvailable(), []);
  const username = profile?.username ?? 'Explorer';

  // ── stats: from the cards already fetched, no new queries ──
  const stats = useMemo(() => {
    const startOfTomorrow = new Date(); startOfTomorrow.setHours(24, 0, 0, 0);
    const from = startOfTomorrow.getTime();
    const to = from + 24 * 60 * 60 * 1000;
    let reviewed = 0, dueTomorrow = 0;
    for (const s of stickers) {
      reviewed += s.review_count ?? 0;
      const due = dueAtMs(s);
      if (due >= from && due < to) dueTomorrow += 1;
    }
    return { cards: stickers.length, reviewed, dueTomorrow };
  }, [stickers]);
  const stat = (n: number) => (loading || loadError ? '–' : String(n));

  const update = async (run: () => Promise<{ error: Error | null }>, fallback: string) => {
    if (!isOnline()) {
      toast.show({ kind: 'info', message: 'Changing this needs a connection.', aboveTabBar: true });
      return;
    }
    const { error } = await run();
    if (error) {
      haptic.error();
      toast.show({ kind: 'error', message: friendlyErrorSync(error, fallback) });
    }
  };

  const handleSelectLanguage = async (code: Language) => {
    if (!profile || code === profile.target_language || updatingLanguage) return;
    haptic.select();
    setUpdatingLanguage(code);
    await update(() => setTargetLanguage(code), "Couldn't change the language. Try again.");
    setUpdatingLanguage(null);
  };

  const handleSelectWallStyle = async (style: WallDisplayStyle) => {
    if (!profile || style === profile.wall_display_style || updatingWallStyle) return;
    haptic.select();
    setUpdatingWallStyle(style);
    await update(() => setWallDisplayStyle(style), "Couldn't change the wall style. Try again.");
    setUpdatingWallStyle(null);
  };

  const handleSelectBorderStyle = async (style: CutoutBorderStyle) => {
    if (!profile || style === profile.cutout_border_style || updatingBorderStyle) return;
    haptic.select();
    setUpdatingBorderStyle(style);
    await update(() => setCutoutBorderStyle(style), "Couldn't change the border. Try again.");
    setUpdatingBorderStyle(null);
  };

  const handleChangeAvatar = async () => {
    if (savingAvatar) return;
    const picked = await pickAvatarImage();
    if (!picked) return;
    setSavingAvatar(true);
    await update(() => setAvatar(picked.uri), "Couldn't update your photo. Try again.");
    setSavingAvatar(false);
  };

  const handleAvatarPress = () => {
    if (!profile?.avatar_path) { handleChangeAvatar(); return; }
    // Three choices is an action sheet, not an alert (B-app 8).
    showMenu([
      { label: 'Choose a new photo', onPress: handleChangeAvatar },
      {
        label: 'Remove photo', destructive: true,
        onPress: () => { void update(() => removeAvatar(), "Couldn't remove your photo. Try again."); },
      },
    ], 'Profile picture');
  };

  // ── reminder ──
  const handleToggleReminder = async (on: boolean) => {
    haptic.select();
    try {
      if (!on) {
        await disableReminder(reminder.hour, reminder.minute);
        setReminder(r => ({ ...r, enabled: false }));
        return;
      }
      // Permission is asked here, the moment it is wanted, and not before.
      const permission = await ensureReminderPermission();
      if (permission === 'denied') {
        setNotifDenied(true);
        setReminder(r => ({ ...r, enabled: false }));
        return;
      }
      setNotifDenied(false);
      await scheduleReminder(reminder.hour, reminder.minute);
      setReminder(r => ({ ...r, enabled: true }));
      haptic.success();
    } catch (e) {
      toast.show({ kind: 'error', message: friendlyErrorSync(e, "Couldn't set the reminder. Try again.") });
    }
  };

  const handlePickTime = async (hour: number, minute: number) => {
    setReminder(r => ({ ...r, hour, minute }));
    try {
      if (reminder.enabled) await scheduleReminder(hour, minute);
      else await disableReminder(hour, minute);
    } catch (e) {
      toast.show({ kind: 'error', message: friendlyErrorSync(e, "Couldn't change the reminder time. Try again.") });
    }
  };

  // ── export ──
  const handleExport = async () => {
    if (exporting) return;
    if (stickers.length === 0) {
      toast.show({ kind: 'info', message: 'No cards to export yet.' });
      return;
    }
    setExporting(true);
    try {
      await exportCards(stickers);
    } catch (e) {
      haptic.error();
      toast.show({ kind: 'error', message: friendlyErrorSync(e, "Couldn't export your cards. Try again.") });
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const performDeleteAccount = async () => {
    setDeletingAccount(true);
    const { error } = await deleteAccount();
    setDeletingAccount(false);
    if (error) toast.show({ kind: 'error', message: friendlyErrorSync(error, "Couldn't delete your account. Try again.") });
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      `This permanently deletes your account, all ${stickers.length} sticker${stickers.length === 1 ? '' : 's'}, and everything else tied to it. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue', style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'There is no way to recover your account or stickers after this.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete Everything', style: 'destructive', onPress: performDeleteAccount },
              ]
            );
          },
        },
      ]
    );
  };

  const avatar = (
    <Pressable
      onPress={handleAvatarPress}
      disabled={!profile}
      accessibilityRole="button"
      accessibilityLabel={profile?.avatar_path ? 'Change or remove your profile picture' : 'Add a profile picture'}
      style={styles.avatarHit}
    >
      <Avatar name={username} avatarPath={profile?.avatar_path} size={52} />
      <View style={styles.avatarBadge}>
        {savingAvatar
          ? <ActivityIndicator size="small" color={colors.white} />
          : <Camera size={11} color={colors.white} />}
      </View>
    </Pressable>
  );

  const stepper = (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => { haptic.tap(); prefs.set({ newCardsPerDay: stepDown(prefs.newCardsPerDay) }); }}
        style={styles.stepBtn}
        accessibilityRole="button"
        accessibilityLabel="Fewer new cards per day"
        testID="new-cards-minus"
      >
        <Minus size={18} strokeWidth={2} color={colors.inkDark} />
      </Pressable>
      <Text style={styles.stepValue} accessibilityLabel={`${prefs.newCardsPerDay} new cards per day`} testID="new-cards-value">
        {prefs.newCardsPerDay}
      </Text>
      <Pressable
        onPress={() => { haptic.tap(); prefs.set({ newCardsPerDay: stepUp(prefs.newCardsPerDay) }); }}
        style={styles.stepBtn}
        accessibilityRole="button"
        accessibilityLabel="More new cards per day"
        testID="new-cards-plus"
      >
        <Plus size={18} strokeWidth={2} color={colors.inkDark} />
      </Pressable>
    </View>
  );

  const toggle = (value: boolean, onChange: (v: boolean) => void, label: string, testID?: string) => (
    <View style={styles.switchBox}><View style={[styles.switchRing, !value && styles.switchRingOff]}><Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: colors.trackOff, true: colors.terra }}
      ios_backgroundColor={colors.trackOff}
      accessibilityLabel={label}
      testID={testID}
    /></View></View>
  );

  const iconProps = { size: 20, strokeWidth: 1.75, color: colors.inkDark } as const;

  return (
    <View style={styles.container}>
      <RoseBand title="Profile" subtitle={username} leading={avatar} fitContent bottomPad={spacing.lg} />

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {/* Stats: from the cards already loaded. No streaks (SPEC). */}
        <View style={styles.statsCard} testID="profile-stats">
          <Stat value={stat(stats.cards)} label="Cards" />
          <Stat value={stat(stats.reviewed)} label="Reviewed" />
          <Stat value={stat(stats.dueTomorrow)} label="Due tomorrow" />
        </View>
        {loadError && (
          <Text style={[styles.footnote, { marginTop: spacing.sm }]}>
            We couldn&apos;t reach your collection just now, so the counts are blank. Nothing has been lost.
          </Text>
        )}

        {/* ── Learning ── */}
        <Text style={styles.sectionTitle}>Learning</Text>
        <RowGroup>
          <View style={styles.segmentWrap}>
            <View style={styles.segment} accessibilityRole="radiogroup">
              {LANGUAGES.map(({ code, native, label }) => {
                const active = profile?.target_language === code;
                return (
                  <Pressable
                    key={code}
                    onPress={() => handleSelectLanguage(code)}
                    disabled={!profile}
                    style={[styles.segmentItem, active && styles.segmentItemOn]}
                    accessibilityRole="button"
                    accessibilityLabel={`${label}, ${native}`}
                    accessibilityState={{ selected: active }}
                    testID={`language-${code}`}
                  >
                    {updatingLanguage === code
                      ? <ActivityIndicator color={colors.terra} />
                      : (
                        <Text
                          style={[styles.segmentText, { fontFamily: wordFontFor(code) }, active && styles.segmentTextOn]}
                          numberOfLines={1}
                          maxFontSizeMultiplier={1.3}
                        >
                          {native}
                        </Text>
                      )}
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.segmentCaption}>The language of the cards you make and study.</Text>
          </View>
          <Divider />
          <Row title="New cards per day" icon={<Layers {...iconProps} />} right={stepper} divider />
          <Row
            title="Simple grading"
            icon={<Repeat2 {...iconProps} />}
            right={toggle(prefs.simpleGrading, v => { haptic.select(); prefs.set({ simpleGrading: v }); }, 'Simple grading', 'toggle-simple-grading')}
            divider
          />
          <Row
            title="Swipe to grade"
            icon={<Hand {...iconProps} />}
            right={toggle(prefs.swipeGrading, v => { haptic.select(); prefs.set({ swipeGrading: v }); }, 'Swipe to grade', 'toggle-swipe-grading')}
            divider
          />
          <Row
            title="Autoplay audio"
            icon={<Volume2 {...iconProps} />}
            right={toggle(prefs.autoplayAudio, v => { haptic.select(); prefs.set({ autoplayAudio: v }); }, 'Autoplay audio', 'toggle-autoplay')}
          />
        </RowGroup>
        <Text style={styles.footnote}>
          Simple grading shows only Again and Good. Swiping left on a card&apos;s answer is Again, right is Good.
        </Text>

        {/* ── Reminders ── */}
        <Text style={styles.sectionTitle}>Reminders</Text>
        <RowGroup>
          <Row
            title="Daily reminder"
            icon={<Bell {...iconProps} />}
            right={toggle(reminder.enabled, handleToggleReminder, 'Daily reminder', 'toggle-reminder')}
            divider={reminder.enabled || notifDenied}
          />
          {reminder.enabled && (
            <Row
              title="Reminder time"
              value={formatReminderTime(reminder.hour, reminder.minute)}
              icon={<Clock {...iconProps} />}
              onPress={() => setTimeOpen(true)}
              testID="reminder-time"
            />
          )}
          {notifDenied && (
            <View style={styles.deniedRow} accessibilityRole="alert" testID="notifications-off">
              <Text style={styles.deniedTitle}>Notifications are off</Text>
              <Text style={styles.deniedBody}>
                Allow notifications for Tabi Stickers in Settings to get a daily reminder.
              </Text>
              <Button kind="secondary" label="Open Settings" onPress={() => { void Linking.openSettings(); }} style={{ marginTop: spacing.sm }} />
            </View>
          )}
        </RowGroup>

        {/* ── Data ── */}
        <Text style={styles.sectionTitle}>Data</Text>
        <RowGroup>
          <Row
            title="Export my cards"
            value={exporting ? undefined : 'CSV'}
            icon={<Download {...iconProps} />}
            right={exporting ? <ActivityIndicator color={colors.terra} /> : undefined}
            onPress={handleExport}
            testID="export-cards"
          />
        </RowGroup>

        {/* ── Appearance ── */}
        <Text style={styles.sectionTitle}>Appearance</Text>
        <RowGroup>
          {WALL_DISPLAY_STYLES.map(({ code, label, subtitle }, i) => (
            <ChoiceRow
              key={code}
              label={label}
              subtitle={subtitle}
              active={profile?.wall_display_style === code}
              busy={updatingWallStyle === code}
              disabled={!profile}
              divider={i < WALL_DISPLAY_STYLES.length - 1}
              onPress={() => handleSelectWallStyle(code)}
            />
          ))}
        </RowGroup>

        {/* Only meaningful once stickers have no card behind them */}
        {profile?.wall_display_style === 'cutout' && (
          <>
            <Text style={styles.sectionTitle}>Cutout border</Text>
            <RowGroup>
              {CUTOUT_BORDER_STYLES.map(({ code, label, subtitle }, i) => (
                <ChoiceRow
                  key={code}
                  label={label}
                  subtitle={subtitle}
                  active={profile?.cutout_border_style === code}
                  busy={updatingBorderStyle === code}
                  disabled={!profile}
                  divider={i < CUTOUT_BORDER_STYLES.length - 1}
                  onPress={() => handleSelectBorderStyle(code)}
                />
              ))}
            </RowGroup>
            <Text style={styles.footnote}>
              Every sticker keeps the thin white edge it was cut out with. These change what sits on top of it.
            </Text>
          </>
        )}

        {/* ── Support: contact details and the privacy policy stay findable. ── */}
        <Text style={styles.sectionTitle}>Support</Text>
        <RowGroup>
          <Row
            title="Report a problem"
            icon={<Mail {...iconProps} />}
            right={<ExternalLink size={16} color={colors.inkLight} />}
            onPress={() => Linking.openURL(
              `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Tabi Stickers: report a problem')}`,
            )}
            accessibilityLabel="Email us about a problem"
            divider
          />
          <Row
            title="Privacy Policy"
            icon={<Shield {...iconProps} />}
            right={<ExternalLink size={16} color={colors.inkLight} />}
            onPress={() => Linking.openURL(PRIVACY_URL)}
            accessibilityLabel="Open the privacy policy"
            divider
          />
          {/* Reports what is actually the case on this phone. */}
          <Row
            title="Scanner"
            value={onDevice ? 'On this device' : 'In the cloud'}
            icon={<ScanLine {...iconProps} />}
          />
        </RowGroup>
        <Text style={styles.footnote}>Write to us at {SUPPORT_EMAIL}</Text>

        {/* ── Account ── */}
        <Text style={styles.sectionTitle}>Account</Text>
        <RowGroup>
          <Row
            title="Log Out"
            icon={<LogOut size={20} strokeWidth={1.75} color={colors.error} />}
            destructive
            onPress={deletingAccount ? undefined : handleLogout}
            right={<View />}
            divider
          />
          <Row
            title={deletingAccount ? 'Deleting Account…' : 'Delete Account'}
            icon={deletingAccount
              ? <ActivityIndicator size="small" color={colors.error} />
              : <Trash2 size={20} strokeWidth={1.75} color={colors.error} />}
            destructive
            onPress={deletingAccount ? undefined : handleDeleteAccount}
            right={<View />}
            accessibilityLabel="Delete your account permanently"
          />
        </RowGroup>

        <Text style={styles.version} testID="profile-version">
          Tabi Stickers {Constants.expoConfig?.version ?? '–'}
        </Text>
      </ScrollView>

      {timeOpen && (
        <TimeSheet
          current={reminder}
          onPick={handlePickTime}
          onClosed={() => setTimeOpen(false)}
        />
      )}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.statValue} maxFontSizeMultiplier={1.3}>{value}</Text>
      <Text style={styles.statLabel} maxFontSizeMultiplier={1.5}>{label}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function ChoiceRow({ label, subtitle, active, busy, disabled, divider, onPress }: {
  label: string; subtitle: string; active: boolean; busy: boolean; disabled: boolean; divider: boolean; onPress: () => void;
}) {
  return (
    <View>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={subtitle}
        accessibilityState={{ selected: active }}
        style={({ pressed }) => [styles.choice, pressed && { backgroundColor: colors.sand }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.choiceLabel} maxFontSizeMultiplier={1.5}>{label}</Text>
          <Text style={styles.choiceSubtitle} maxFontSizeMultiplier={2}>{subtitle}</Text>
        </View>
        {busy ? (
          <ActivityIndicator color={colors.terra} />
        ) : active ? (
          <View style={styles.activeBadge}><Check size={14} strokeWidth={2.5} color={colors.white} /></View>
        ) : null}
      </Pressable>
      {divider && <View style={[styles.divider, { marginLeft: spacing.md }]} />}
    </View>
  );
}

function TimeSheet({ current, onPick, onClosed }: {
  current: ReminderSettings; onPick: (hour: number, minute: number) => void; onClosed: () => void;
}) {
  const sheet = useRef<BottomSheetHandle>(null);
  return (
    <BottomSheet
      ref={sheet}
      onRequestClose={() => sheet.current?.close()}
      onClosed={onClosed}
      maxHeight="70%"
      header={<Text style={styles.sheetTitle}>Remind me at</Text>}
    >
      <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
        {REMINDER_TIMES.map(({ hour, minute }) => {
          const active = hour === current.hour && minute === current.minute;
          return (
            <Pressable
              key={`${hour}:${minute}`}
              onPress={() => { haptic.select(); onPick(hour, minute); sheet.current?.close(); }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [styles.timeRow, pressed && { backgroundColor: colors.sand }]}
            >
              <Text style={[styles.timeText, active && { color: colors.inkDark }]}>{formatReminderTime(hour, minute)}</Text>
              {active && <Check size={18} strokeWidth={2.25} color={colors.terra} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  scrollBody: { paddingHorizontal: GUTTER, paddingTop: spacing.md, paddingBottom: TAB_BAR_CLEARANCE + 34 + spacing.xl },

  avatarHit: { width: MIN_TAP + 8, height: MIN_TAP + 8, alignItems: 'center', justifyContent: 'center' },
  avatarBadge: {
    position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: radii.full,
    backgroundColor: colors.terra, borderWidth: 2, borderColor: colors.blush,
    alignItems: 'center', justifyContent: 'center',
  },

  statsCard: {
    flexDirection: 'row', backgroundColor: colors.card, borderRadius: radii.md, paddingVertical: spacing.md, ...e1,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { ...type.title, fontSize: 30, lineHeight: 34 },
  statLabel: { ...type.small, textAlign: 'center' },

  sectionTitle: { ...type.small, fontFamily: fonts.display, marginTop: spacing.lg, marginBottom: spacing.sm, marginLeft: spacing.xs },
  footnote: { ...type.small, marginTop: spacing.sm, marginHorizontal: spacing.xs },
  divider: { height: 1, backgroundColor: colors.divider },

  segmentWrap: { padding: spacing.md, paddingBottom: spacing.ms },
  segment: { flexDirection: 'row', backgroundColor: colors.sand, borderRadius: radii.full, padding: 3, height: 44 },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full },
  segmentItemOn: { backgroundColor: colors.card, ...e1 },
  segmentText: { fontSize: 15, color: colors.inkLight },
  segmentTextOn: { color: colors.inkDark },
  segmentCaption: { ...type.small, marginTop: spacing.sm },

  switchBox: { height: MIN_TAP, justifyContent: 'center' },
  // A 1.5px ring that is always there (so toggling never shifts layout) and only painted when OFF.
  switchRing: { borderRadius: 17, borderWidth: 1.5, borderColor: 'transparent' },
  switchRingOff: { borderColor: colors.trackOffRing },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  stepValue: { ...type.data, fontSize: 15, minWidth: 28, textAlign: 'center', color: colors.inkDark },

  deniedRow: { padding: spacing.md, backgroundColor: colors.errorLight },
  deniedTitle: { fontFamily: fonts.display, fontSize: 16, lineHeight: 22, color: colors.error },
  deniedBody: { ...type.small, color: colors.inkMid, marginTop: 2 },

  choice: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.ms, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  choiceLabel: { fontFamily: fonts.text, fontSize: 16, lineHeight: 24, color: colors.inkMid },
  choiceSubtitle: { ...type.small },
  activeBadge: { width: 24, height: 24, borderRadius: radii.full, backgroundColor: colors.terra, alignItems: 'center', justifyContent: 'center' },

  version: { ...type.small, textAlign: 'center', marginTop: spacing.lg },

  sheetTitle: { ...type.h2 },
  timeRow: {
    minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.sm, borderRadius: radii.sm,
  },
  timeText: { fontFamily: fonts.text, fontSize: 17, lineHeight: 22, color: colors.inkMid },
});
