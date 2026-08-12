import * as Speech from 'expo-speech';
import { setAudioModeAsync } from 'expo-audio';
import { Language } from './types';

const LOCALE_BY_LANGUAGE: Record<Language, string> = {
  fr: 'fr-FR',
  ja: 'ja-JP',
  yue: 'zh-HK',
};

// By default, iOS plays expo-speech audio through the app's ambient audio
// session, which follows the Ringer/Alerts volume rather than the media
// volume — on devices where that's turned down, TTS is silent even with the
// mute switch off. Switching to the playback category routes it through
// media volume instead, like any other audio/video app.
setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});

// 1.0 is native/conversational speed — too fast for someone still learning
// to distinguish sounds. Slowed down so learners can actually follow along.
const LEARNING_RATE = 0.7;

export function speak(text: string, language: Language, rate: number = LEARNING_RATE) {
  if (!text) return;
  Speech.stop();
  Speech.speak(text, { language: LOCALE_BY_LANGUAGE[language], rate });
}

export function stopSpeaking() {
  Speech.stop();
}
