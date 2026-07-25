import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Camera, LogOut, BookOpen, Heart, Check, Trash2, ImagePlus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/lib/supabase';
import { Language, Sticker, WallDisplayStyle, CutoutBorderStyle, WallBackgroundDim } from '@/lib/types';
import OtterMascot from '@/components/illustrations/OtterMascot';
import { colors, shadows, radii, spacing, fonts } from '@/constants/theme';

// Long side capped so a full-res photo library import doesn't balloon
// storage/bandwidth — this is a full-screen backdrop, so it gets more
// headroom than the 1280px cap used for sticker memory photos.
const WALL_BACKGROUND_MAX_SIDE = 1600;
const WALL_BACKGROUND_DIMS: { code: WallBackgroundDim; label: string }[] = [
  { code: 'light', label: 'Light' },
  { code: 'medium', label: 'Medium' },
  { code: 'dark', label: 'Dark' },
];

const LANGUAGES: { code: Language; native: string; label: string }[] = [
  { code: 'fr', native: 'Français', label: 'French' },
  { code: 'ja', native: '日本語', label: 'Japanese' },
  { code: 'yue', native: '廣東話', label: 'Cantonese' },
];

const WALL_DISPLAY_STYLES: { code: WallDisplayStyle; label: string; subtitle: string }[] = [
  { code: 'framed', label: 'Framed', subtitle: 'Stickers sit inside a little photo card' },
  { code: 'cutout', label: 'Cutout only', subtitle: 'Just the sticker shape, no card behind it' },
];

const CUTOUT_BORDER_STYLES: { code: CutoutBorderStyle; label: string; subtitle: string }[] = [
  { code: 'outline', label: 'White outline', subtitle: 'A thick white sticker-style border' },
  { code: 'shadow', label: 'Shadow', subtitle: 'A soft drop shadow, no outline' },
  { code: 'none', label: 'No border', subtitle: 'Just the bare cutout, completely flat' },
];

export default function ProfileScreen() {
  const { user, signOut, deleteAccount } = useAuth();
  const {
    profile, setTargetLanguage, setWallDisplayStyle, setCutoutBorderStyle,
    setWallBackground, setWallBackgroundDim,
  } = useProfile(user?.id);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingLanguage, setUpdatingLanguage] = useState<Language | null>(null);
  const [updatingWallStyle, setUpdatingWallStyle] = useState<WallDisplayStyle | null>(null);
  const [updatingBorderStyle, setUpdatingBorderStyle] = useState<CutoutBorderStyle | null>(null);
  const [updatingBackgroundDim, setUpdatingBackgroundDim] = useState<WallBackgroundDim | null>(null);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const fetchStickers = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('stickers')
      .select('*')
      .eq('user_id', user.id);
    if (!error && data) setStickers(data as Sticker[]);
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { fetchStickers(); }, [fetchStickers]));

  useEffect(() => {
    if (!profile?.wall_background_path) { setBackgroundPreviewUrl(null); return; }
    supabase.storage.from('sticker-images')
      .createSignedUrl(profile.wall_background_path, 3600)
      .then(({ data }) => { if (data) setBackgroundPreviewUrl(data.signedUrl); });
  }, [profile?.wall_background_path]);

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

  const handlePickBackground = async () => {
    if (!user || uploadingBackground) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photos Access Needed', 'LingoStickers needs access to your photo library to set a wall background.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const asset = !result.canceled ? result.assets[0] : null;
    if (!asset) return;

    setUploadingBackground(true);
    try {
      let context = ImageManipulator.manipulate(asset.uri);
      const longSide = Math.max(asset.width, asset.height);
      if (longSide > WALL_BACKGROUND_MAX_SIDE) {
        const scale = WALL_BACKGROUND_MAX_SIDE / longSide;
        context = context.resize({ width: Math.round(asset.width * scale) });
      }
      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });

      // Fixed filename + upsert so re-uploading just replaces the old photo
      // rather than accumulating orphaned files under the user's folder.
      const path = `${user.id}/wall-background.jpg`;
      const bytes = await new File(saved.uri).bytes();
      const { error: uploadError } = await supabase.storage
        .from('sticker-images')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { error } = await setWallBackground(path);
      if (error) throw error;
    } catch (err: any) {
      Alert.alert("Couldn't set background", err?.message ?? 'Something went wrong.');
    } finally {
      setUploadingBackground(false);
    }
  };

  const handleRemoveBackground = () => {
    if (!profile?.wall_background_path) return;
    Alert.alert(
      'Remove background',
      'Go back to the default corkboard look?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            const path = profile.wall_background_path!;
            const { error } = await setWallBackground(null);
            if (error) { Alert.alert("Couldn't remove background", error.message); return; }
            await supabase.storage.from('sticker-images').remove([path]);
          },
        },
      ]
    );
  };

  const handleSelectBackgroundDim = async (dim: WallBackgroundDim) => {
    if (!profile || dim === profile.wall_background_dim || updatingBackgroundDim) return;
    setUpdatingBackgroundDim(dim);
    const { error } = await setWallBackgroundDim(dim);
    setUpdatingBackgroundDim(null);
    if (error) Alert.alert("Couldn't update", error.message);
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
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
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{username[0]?.toUpperCase() ?? 'E'}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.username} numberOfLines={1}>{username}</Text>
                <Text style={styles.email} numberOfLines={1}>{user?.email}</Text>
              </View>
            </View>

            <View style={styles.statCardsRow}>
              <View style={styles.statCard}>
                <BookOpen size={16} color={colors.terraDark} />
                <View>
                  <Text style={styles.statValue}>{stickers.length}</Text>
                  <Text style={styles.statLabel}>Captured</Text>
                </View>
              </View>
              <View style={styles.statCard}>
                <Heart size={16} color={colors.error} />
                <View>
                  <Text style={styles.statValue}>{favoriteCount}</Text>
                  <Text style={styles.statLabel}>Favorites</Text>
                </View>
              </View>
            </View>

            <View style={styles.dialogueRow}>
              <View style={styles.dialogueAvatar}>
                <OtterMascot size={30} variant="small" />
              </View>
              <View style={styles.dialogueBubble}>
                <Text style={styles.dialogueText}>
                  Welcome back to your cozy corner! You've captured {stickers.length} watercolor
                  {' '}memor{stickers.length === 1 ? 'y' : 'ies'} so far. Keep it up! 🌸
                </Text>
              </View>
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
                    <Text style={styles.langNative}>{native}</Text>
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
            </>
          )}

          {/* Custom wall photo */}
          <Text style={styles.sectionLabel}>WALL BACKGROUND</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.backgroundPreview}
              onPress={handlePickBackground}
              disabled={uploadingBackground}
              activeOpacity={0.85}
            >
              {backgroundPreviewUrl ? (
                <Image source={{ uri: backgroundPreviewUrl }} style={styles.backgroundPreviewImage} resizeMode="cover" />
              ) : (
                <View style={styles.backgroundPreviewEmpty}>
                  <ImagePlus size={22} color={colors.inkFaint} />
                </View>
              )}
              {uploadingBackground && (
                <View style={styles.backgroundPreviewOverlay}>
                  <ActivityIndicator color={colors.white} />
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.backgroundActionsRow}>
              <TouchableOpacity
                style={styles.backgroundActionBtn}
                onPress={handlePickBackground}
                disabled={uploadingBackground}
              >
                <Text style={styles.backgroundActionText}>
                  {profile?.wall_background_path ? 'Change Photo' : 'Choose Photo'}
                </Text>
              </TouchableOpacity>
              {profile?.wall_background_path && (
                <TouchableOpacity
                  style={styles.backgroundActionBtn}
                  onPress={handleRemoveBackground}
                  disabled={uploadingBackground}
                >
                  <Text style={[styles.backgroundActionText, styles.backgroundActionTextDanger]}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
            {profile?.wall_background_path && (
              <View style={[styles.dimRow, styles.rowDivider]}>
                {WALL_BACKGROUND_DIMS.map(({ code, label }) => {
                  const active = profile?.wall_background_dim === code;
                  return (
                    <TouchableOpacity
                      key={code}
                      style={[styles.dimChip, active && styles.dimChipActive]}
                      onPress={() => handleSelectBackgroundDim(code)}
                      disabled={!profile}
                      activeOpacity={0.8}
                    >
                      {updatingBackgroundDim === code ? (
                        <ActivityIndicator size="small" color={active ? colors.white : colors.terra} />
                      ) : (
                        <Text style={[styles.dimChipText, active && styles.dimChipTextActive]}>{label}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Info */}
          <Text style={styles.sectionLabel}>ABOUT</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Camera size={16} color={colors.terraDark} />
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoTitle}>Scanner Engine</Text>
                <Text style={styles.infoSubtitle}>Background removal online</Text>
              </View>
              <View style={styles.onlineBadge}>
                <Text style={styles.onlineBadgeText}>ONLINE</Text>
              </View>
            </View>
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
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.terra,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: colors.inkDark },
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

  dialogueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  dialogueAvatar: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dialogueBubble: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: radii.lg,
    borderTopLeftRadius: radii.xs,
    padding: spacing.ms,
  },
  dialogueText: { fontSize: 11, fontWeight: '500', color: colors.inkDark, lineHeight: 16 },

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
  langNative: { fontSize: 16, fontFamily: fonts.jp, color: colors.inkDark },
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

  backgroundPreview: {
    height: 120,
    margin: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.cardAlt,
  },
  backgroundPreviewImage: { width: '100%', height: '100%' },
  backgroundPreviewEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backgroundPreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28,73,102,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  backgroundActionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    backgroundColor: colors.cardAlt,
  },
  backgroundActionText: { fontSize: 12, fontWeight: '700', color: colors.inkDark },
  backgroundActionTextDanger: { color: colors.error },
  dimRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  dimChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.cardAlt,
  },
  dimChipActive: { backgroundColor: colors.terra },
  dimChipText: { fontSize: 12, fontWeight: '700', color: colors.inkMid },
  dimChipTextActive: { color: colors.white },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    padding: spacing.md,
  },
  infoTextWrap: { flex: 1 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: colors.inkDark },
  infoSubtitle: { fontSize: 10, color: colors.inkFaint, marginTop: 2 },
  onlineBadge: {
    backgroundColor: colors.successLight,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  onlineBadgeText: { fontSize: 9, fontWeight: '800', color: colors.success },

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
