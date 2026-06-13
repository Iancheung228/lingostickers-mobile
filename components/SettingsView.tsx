import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { X, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Language, Profile } from '@/lib/types';

interface SettingsViewProps {
  visible: boolean;
  profile: Profile | null;
  onClose: () => void;
  onChangeLanguage: (language: Language) => Promise<{ error: any }>;
}

const LANGUAGES: { code: Language; native: string; label: string }[] = [
  { code: 'fr', native: 'Français', label: 'French' },
  { code: 'ja', native: '日本語', label: 'Japanese' },
];

export default function SettingsView({ visible, profile, onClose, onChangeLanguage }: SettingsViewProps) {
  const [updating, setUpdating] = useState<Language | null>(null);

  const handleSelect = async (code: Language) => {
    if (!profile || code === profile.target_language || updating) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUpdating(code);
    const { error } = await onChangeLanguage(code);
    setUpdating(null);
    if (error) Alert.alert("Couldn't update", error.message);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#1A1A2E" />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionLabel}>LEARNING LANGUAGE</Text>
          <Text style={styles.sectionHint}>New stickers will be captured in this language.</Text>

          {LANGUAGES.map(({ code, native, label }) => {
            const active = profile?.target_language === code;
            return (
              <TouchableOpacity
                key={code}
                style={[styles.option, active && styles.optionActive]}
                onPress={() => handleSelect(code)}
                disabled={!profile}
                activeOpacity={0.8}
              >
                <View>
                  <Text style={[styles.optionNative, active && styles.optionTextActive]}>{native}</Text>
                  <Text style={[styles.optionLabel, active && styles.optionTextActive]}>{label}</Text>
                </View>
                {updating === code ? (
                  <ActivityIndicator color={active ? '#fff' : '#A7D7C5'} />
                ) : active ? (
                  <Check size={20} color="#fff" />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: 20, paddingTop: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9E9E9E', letterSpacing: 1.5, marginBottom: 4 },
  sectionHint: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  optionActive: { backgroundColor: '#A7D7C5', borderColor: '#A7D7C5' },
  optionNative: { fontSize: 18, fontWeight: '800', color: '#1A1A2E', marginBottom: 2 },
  optionLabel: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  optionTextActive: { color: '#fff' },
});
