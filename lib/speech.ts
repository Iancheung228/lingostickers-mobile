import * as Speech from 'expo-speech';
import { setAudioModeAsync } from 'expo-audio';
import { Language } from './types';

const LOCALE_BY_LANGUAGE: Record<Language, string> = {
  fr: 'fr-FR',
  ja: 'ja-JP',
};

// By default, iOS plays expo-speech audio through the app's ambient audio
// session, which follows the Ringer/Alerts volume rather than the media
// volume — on devices where that's turned down, TTS is silent even with the
// mute switch off. Switching to the playback category routes it through
// media volume instead, like any other audio/video app.
setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});

export function speak(text: string, language: Language) {
  if (!text) return;
  Speech.stop();
  Speech.speak(text, { language: LOCALE_BY_LANGUAGE[language] });
}

export function stopSpeaking() {
  Speech.stop();
}
