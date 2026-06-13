import * as Speech from 'expo-speech';
import { Language } from './types';

const LOCALE_BY_LANGUAGE: Record<Language, string> = {
  fr: 'fr-FR',
  ja: 'ja-JP',
};

export function speak(text: string, language: Language) {
  if (!text) return;
  Speech.stop();
  Speech.speak(text, { language: LOCALE_BY_LANGUAGE[language] });
}

export function stopSpeaking() {
  Speech.stop();
}
