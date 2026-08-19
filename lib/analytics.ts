import Aptabase from '@aptabase/react-native';

export { trackEvent } from '@aptabase/react-native';

export function initAnalytics() {
  const appKey = process.env.EXPO_PUBLIC_APTABASE_APP_KEY;
  if (!appKey) {
    console.warn('EXPO_PUBLIC_APTABASE_APP_KEY not set — analytics disabled');
    return;
  }
  Aptabase.init(appKey);
}
