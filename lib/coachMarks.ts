import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// A hint that has to be read once and then never again.
//
// The board canvas used to carry its instructions as permanent chrome under
// the header — 10pt inkFaint (#C4A9AB) on cream (#FAF4EA), about 1.9:1
// contrast. That fails twice over: it's below any legibility bar precisely
// *because* it was made unobtrusive enough to live there forever, and it goes
// on paying rent long after it has been learnt. A coach mark can afford to be
// legible, because it only has to survive one reading.
// ---------------------------------------------------------------------------
const PREFIX = 'coachMark:';

/// `ready` gates on the moment the hint is actually about something — there's
/// no point explaining how to drag a sticker off a board that hasn't got one
/// yet, and spending the hint on an empty board would burn it unseen.
export function useCoachMark(id: string, ready: boolean) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    AsyncStorage.getItem(PREFIX + id)
      .then(seen => { if (!cancelled && !seen) setVisible(true); })
      .catch(() => {}); // an unreadable store just means the hint shows again
    return () => { cancelled = true; };
  }, [id, ready]);

  const dismiss = useCallback(() => {
    setVisible(false);
    AsyncStorage.setItem(PREFIX + id, '1').catch(() => {});
  }, [id]);

  return { visible, dismiss };
}
