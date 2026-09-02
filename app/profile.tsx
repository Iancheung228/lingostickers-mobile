import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, Alert, Linking } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Camera, LogOut, BookOpen, Heart, Check, Trash2, Shield, ExternalLink, Ban, Mail } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { Language, Sticker, WallDisplayStyle, CutoutBorderStyle } from '@/lib/types';
import { useFriends } from '@/hooks/useFriends';
import { pickAvatarImage } from '@/lib/avatars';
import { isLocalCutoutAvailable } from '@/lib/cutout';
import Avatar from '@/components/Avatar';
import BlockedAccounts from '@/components/BlockedAccounts';
import { colors, shadows, radii, spacing, fonts, wordFontFor } from '@/constants/theme';

// Published at the apex domain and linked from App Store Connect too. In
// the app because the Profile screen is where a person — and a reviewer —
// looks for it.
const PRIVACY_URL = 'https://tabistickers.com/privacy.html';

// Guideline 1.2 asks for published contact information alongside the report
// and block controls, so it sits in the same section as them rather than only
// inside the privacy policy.
const SUPPORT_EMAIL = 'iancheung228@gmail.com';

const LANGUAGES: { code: Language; native: string; label: string }[] = [
  { code: 'fr', native: 'Français', label: 'French' },
  { code: 'ja', native: '日本語', label: 'Japanese' },
  { code: 'yue', native: '廣東話', label: 'Cantonese' },
];

const WALL_DISPLAY_STYLES: { code: WallDisplayStyle; label: string; subtitle: string }[] = [
  { code: 'framed', label: 'Framed', subtitle: 'Stickers sit inside a little photo card' },
  { code: 'cutout', label: 'Cutout only', subtitle: 'Just the sticker shape, no card behind it' },
];

// These describe what the setting ACTUALLY does, which is not what they used
// to say. Every sticker gets a thin white edge baked into its PNG at the
// moment it is cut out — on the device in StickerStyler.swift, and on the
// server in create-sticker — and nothing here can remove it, because by the
// time the app is drawing the sticker the border is already pixels. So the old
// "no outline" and "just the bare cutout, completely flat" were both promising
// something the app cannot deliver, and "White outline" was quietly stacking a
// second border on top of the first.
//
// Removing the baked border is a Swift change, which means a native rebuild;
// until then the honest fix is to describe the three options as what they are.
const CUTOUT_BORDER_STYLES: { code: CutoutBorderStyle; label: string; subtitle: string }[] = [
  { code: 'outline', label: 'Thick outline', subtitle: 'Widens the white edge into a bold sticker border' },
  { code: 'shadow', label: 'Shadow', subtitle: 'A soft drop shadow behind the cutout' },
  { code: 'none', label: 'Flat', subtitle: 'No shadow and no extra border' },
];

export default function ProfileScreen() {
  const { user, signOut, deleteAccount } = useAuth();
  const {
    profile, setTargetLanguage, setWallDisplayStyle, setCutoutBorderStyle,
    setAvatar, removeAvatar,
  } = useProfile(user?.id);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  // The stat cards and the welcome note both quote a sticker count. A failed
  // fetch would otherwise report a confident, wrong "0 captured".
  const [loadError, setLoadError] = useState(false);
  const [updatingLanguage, setUpdatingLanguage] = useState<Language | null>(null);
  const [updatingWallStyle, setUpdatingWallStyle] = useState<WallDisplayStyle | null>(null);
  const [updatingBorderStyle, setUpdatingBorderStyle] = useState<CutoutBorderStyle | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const { blocked } = useFriends();

  const fetchStickers = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('stickers')
      .select('*')
      .eq('user_id', user.id);
    if (error) {
      setLoadError(true);
    } else if (data) {
      setLoadError(false);
      setStickers(data as Sticker[]);
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { fetchStickers(); }, [fetchStickers]));

  // Whether Apple Vision segmentation is available on this phone. Fixed for
  // the life of the process, so it is read once rather than per render.
  const onDevice = useMemo(() => isLocalCutoutAvailable(), []);

  const favoriteCount = useMemo(() => stickers.filter(s => s.is_favorite).length, [stickers]);
  const username = profile?.username ?? 'Explorer';

  const handleSelectLanguage = async (code: Language) => {
    if (!profile || code === profile.target_language || updatingLanguage) return;
    setUpdatingLanguage(code);
    const { error } = await setTargetLanguage(code);
    setUpdatingLanguage(null);
    if (error) Alert.alert("Couldn't update", error.message);
  };

  const handleSelectWallStyle = async (style: WallDisplayStyle) => {
    if (!profile || style === profile.wall_display_style || updatingWallStyle) return;
    setUpdatingWallStyle(style);
    const { error } = await setWallDisplayStyle(style);
    setUpdatingWallStyle(null);
    if (error) Alert.alert("Couldn't update", error.message);
  };

  const handleSelectBorderStyle = async (style: CutoutBorderStyle) => {
    if (!profile || style === profile.cutout_border_style || updatingBorderStyle) return;
    setUpdatingBorderStyle(style);
    const { error } = await setCutoutBorderStyle(style);
    setUpdatingBorderStyle(null);
    if (error) Alert.alert("Couldn't update", error.message);
  };

  const handleChangeAvatar = async () => {
    if (savingAvatar) return;
    const picked = await pickAvatarImage();
    if (!picked) return;
    setSavingAvatar(true);
    const { error } = await setAvatar(picked.uri);
    setSavingAvatar(false);
    if (error) Alert.alert("Couldn't update your photo", error.message);
  };

  const handleAvatarPress = () => {
    if (!profile?.avatar_path) { handleChangeAvatar(); return; }
    Alert.alert('Profile picture', undefined, [
      { text: 'Choose a new photo', onPress: handleChangeAvatar },
      {
        text: 'Remove photo', style: 'destructive',
        onPress: async () => {
          const { error } = await removeAvatar();
          if (error) Alert.alert("Couldn't remove your photo", error.message);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
    if (error) Alert.alert("Couldn't delete account", error.message);
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={18} color={colors.inkMid} />
        </TouchableOpacity>
        <Text style={styles.title}>My Profile</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.terra} size="large" />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollBody}>
          {/* Cozy panel with user card + stats */}
          <View style={styles.panel}>
            <View style={styles.userCard}>
              <TouchableOpacity
                onPress={handleAvatarPress}
                activeOpacity={0.8}
                disabled={!profile}
                accessibilityRole="button"
                accessibilityLabel={profile?.avatar_path ? 'Change or remove your profile picture' : 'Add a profile picture'}
              >
                <Avatar name={username} avatarPath={profile?.avatar_path} size={52} />
                <View style={styles.avatarBadge}>
                  {savingAvatar
                    ? <ActivityIndicator size="small" color={colors.white} />
                    : <Camera size={11} color={colors.white} />}
                </View>
              </TouchableOpacity>
              <View style={styles.userInfo}>
                <Text style={styles.username} numberOfLines={1}>{username}</Text>
                <Text style={styles.email} numberOfLines={1}>{user?.email}</Text>
              </View>
            </View>

            <View style={styles.statCardsRow}>
              <View style={styles.statCard}>
                <BookOpen size={16} color={colors.terraDark} />
                <View>
                  <Text style={styles.statValue}>{loadError ? '—' : stickers.length}</Text>
                  <Text style={styles.statLabel}>Captured</Text>
                </View>
              </View>
              <View style={styles.statCard}>
                <Heart size={16} color={colors.error} />
                <View>
                  <Text style={styles.statValue}>{loadError ? '—' : favoriteCount}</Text>
                  <Text style={styles.statLabel}>Favorites</Text>
                </View>
              </View>
            </View>

            <View style={styles.note}>
              <Text style={styles.noteText}>
                {loadError
                  ? "We couldn't reach your collection just now, so the counts above are blank. Nothing has been lost — pull back and open this again once you're online."
                  : `Welcome back to your cozy corner! You've captured ${stickers.length} watercolor memor${stickers.length === 1 ? 'y' : 'ies'} so far. Keep it up! 🌸`}
              </Text>
            </View>
          </View>

          {/* Learning language */}
          <Text style={styles.sectionLabel}>LEARNING LANGUAGE</Text>
          <View style={styles.card}>
            {LANGUAGES.map(({ code, native, label }, i) => {
              const active = profile?.target_language === code;
              return (
                <TouchableOpacity
                  key={code}
                  style={[styles.langRow, i > 0 && styles.rowDivider]}
                  onPress={() => handleSelectLanguage(code)}
                  disabled={!profile}
                  activeOpacity={0.8}
                >
                  <View>
                    <Text style={[styles.langNative, { fontFamily: wordFontFor(code) }]}>{native}</Text>
                    <Text style={styles.langLabel}>{label}</Text>
                  </View>
                  {updatingLanguage === code ? (
                    <ActivityIndicator color={colors.terra} />
                  ) : active ? (
                    <View style={styles.activeBadge}>
                      <Check size={12} color={colors.white} />
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Sticker wall appearance */}
          <Text style={styles.sectionLabel}>WALL DISPLAY</Text>
          <View style={styles.card}>
            {WALL_DISPLAY_STYLES.map(({ code, label, subtitle }, i) => {
              const active = profile?.wall_display_style === code;
              return (
                <TouchableOpacity
                  key={code}
                  style={[styles.langRow, i > 0 && styles.rowDivider]}
                  onPress={() => handleSelectWallStyle(code)}
                  disabled={!profile}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.wallStyleLabel}>{label}</Text>
                    <Text style={styles.wallStyleSubtitle}>{subtitle}</Text>
                  </View>
                  {updatingWallStyle === code ? (
                    <ActivityIndicator color={colors.terra} />
                  ) : active ? (
                    <View style={styles.activeBadge}>
                      <Check size={12} color={colors.white} />
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Only meaningful once stickers have no card behind them */}
          {profile?.wall_display_style === 'cutout' && (
            <>
              <Text style={styles.sectionLabel}>CUTOUT BORDER</Text>
              <View style={styles.card}>
                {CUTOUT_BORDER_STYLES.map(({ code, label, subtitle }, i) => {
                  const active = profile?.cutout_border_style === code;
                  return (
                    <TouchableOpacity
                      key={code}
                      style={[styles.langRow, i > 0 && styles.rowDivider]}
                      onPress={() => handleSelectBorderStyle(code)}
                      disabled={!profile}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.wallStyleLabel}>{label}</Text>
                        <Text style={styles.wallStyleSubtitle}>{subtitle}</Text>
                      </View>
                      {updatingBorderStyle === code ? (
                        <ActivityIndicator color={colors.terra} />
                      ) : active ? (
                        <View style={styles.activeBadge}>
                          <Check size={12} color={colors.white} />
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.sectionFootnote}>
                Every sticker keeps the thin white edge it was cut out with — these
                change what sits on top of it.
              </Text>
            </>
          )}

          {/* Safety — the controls Guideline 1.2 asks for, gathered in one
              place so they can be found by someone who needs them in a hurry
              and by a reviewer looking for them specifically. Reporting and
              blocking themselves live where the person is (a friend's profile,
              a challenge, an incoming request); this section is where you
              review what you've done and how to reach a human. */}
          <Text style={styles.sectionLabel}>SAFETY</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => setBlockedOpen(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Manage blocked accounts"
            >
              <Ban size={16} color={colors.terraDark} />
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoTitle}>Blocked accounts</Text>
                <Text style={styles.infoSubtitle}>
                  {blocked.length === 0
                    ? 'Nobody is blocked'
                    : `${blocked.length} ${blocked.length === 1 ? 'person' : 'people'} blocked`}
                </Text>
              </View>
              <Text style={styles.rowChevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.infoRow, styles.rowDivider]}
              onPress={() => Linking.openURL(
                `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Tabi Stickers — report a problem')}`,
              )}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel="Email us about a problem"
            >
              <Mail size={16} color={colors.terraDark} />
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoTitle}>Report a problem</Text>
                <Text style={styles.infoSubtitle}>{SUPPORT_EMAIL}</Text>
              </View>
              <ExternalLink size={14} color={colors.inkFaint} />
            </TouchableOpacity>
          </View>

          {/* Info */}
          <Text style={styles.sectionLabel}>ABOUT</Text>
          <View style={styles.card}>
            {/* This row used to read "Background removal online" beside a
                hardcoded green ONLINE pill — a status indicator that could
                never report anything but healthy, and which stopped being
                true the day cutouts moved onto the device. It now reports
                what is actually the case on this phone. */}
            <View style={styles.infoRow}>
              <Camera size={16} color={colors.terraDark} />
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoTitle}>Scanner</Text>
                <Text style={styles.infoSubtitle}>
                  {onDevice
                    ? 'Cuts out stickers on this device'
                    : 'Cuts out stickers in the cloud'}
                </Text>
              </View>
              <View style={styles.engineBadge}>
                <Text style={styles.engineBadgeText}>{onDevice ? 'ON DEVICE' : 'CLOUD'}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.infoRow, styles.rowDivider]}
              onPress={() => Linking.openURL(PRIVACY_URL)}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel="Open the privacy policy"
            >
              <Shield size={16} color={colors.terraDark} />
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoTitle}>Privacy Policy</Text>
                <Text style={styles.infoSubtitle}>What we collect, and why</Text>
              </View>
              <ExternalLink size={14} color={colors.inkFaint} />
            </TouchableOpacity>
          </View>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} disabled={deletingAccount}>
            <LogOut size={16} color={colors.inkFaint} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>

          {/* Danger zone */}
          <TouchableOpacity
            style={styles.deleteAccountButton}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
            accessibilityRole="button"
            accessibilityLabel="Delete your account permanently"
          >
            {deletingAccount ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Trash2 size={15} color={colors.error} />
            )}
            <Text style={styles.deleteAccountText}>
              {deletingAccount ? 'Deleting Account…' : 'Delete Account'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <BlockedAccounts visible={blockedOpen} onClose={() => setBlockedOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sky },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
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
  title: { fontSize: 15, fontFamily: fonts.cozy, color: colors.inkDark },
  loader: { flex: 1 },

  scrollBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },

  panel: {
    backgroundColor: colors.skyDeep,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.skyNight,
    padding: spacing.md,
    gap: spacing.ms,
    marginBottom: spacing.lg,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.ms,
    ...shadows.card,
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: radii.full,
    backgroundColor: colors.terra,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: { flex: 1 },
  username: { fontSize: 15, fontFamily: fonts.cozy, color: colors.inkDark },
  email: { fontSize: 11, fontFamily: fonts.mono, color: colors.inkFaint, marginTop: 2 },

  statCardsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.ms,
    ...shadows.card,
  },
  statValue: { fontSize: 16, fontFamily: fonts.mono, fontWeight: '700', color: colors.inkDark },
  statLabel: { fontSize: 9, fontWeight: '700', color: colors.inkFaint },

  note: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: radii.lg,
    padding: spacing.ms,
  },
  noteText: { fontSize: 11, fontWeight: '500', color: colors.inkDark, lineHeight: 16 },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.inkFaint,
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  langNative: { fontSize: 16, color: colors.inkDark },
  langLabel: { fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  wallStyleLabel: { fontSize: 14, fontWeight: '700', color: colors.inkDark },
  wallStyleSubtitle: { fontSize: 11, color: colors.inkFaint, marginTop: 2 },
  activeBadge: {
    width: 22,
    height: 22,
    borderRadius: radii.full,
    backgroundColor: colors.terra,
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    padding: spacing.md,
  },
  infoTextWrap: { flex: 1 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: colors.inkDark },
  infoSubtitle: { fontSize: 10, color: colors.inkFaint, marginTop: 2 },
  rowChevron: { fontSize: 20, color: colors.inkFaint, lineHeight: 20 },
  sectionFootnote: {
    fontSize: 11, color: colors.inkFaint, lineHeight: 15,
    marginTop: spacing.sm, marginHorizontal: spacing.xs,
  },
  engineBadge: {
    backgroundColor: colors.sageLight,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  engineBadgeText: { fontSize: 9, fontWeight: '800', color: colors.sageDark },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    ...shadows.card,
  },
  logoutText: { fontSize: 14, fontWeight: '700', color: colors.inkFaint },

  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  deleteAccountText: { fontSize: 13, fontWeight: '700', color: colors.error },
});
