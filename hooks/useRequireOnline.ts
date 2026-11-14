import { useCallback } from 'react';
import { useToast } from '@/components/ToastProvider';
import { isOnline, useOnline } from '@/lib/connectivity';

/**
 * For actions that need the network. `gate('Scanning needs a connection.')`
 * returns true when it's fine to go ahead; offline it toasts the reason and
 * returns false, so the control stays visible (disabled-looking) and says why
 * (B-app 9 item 5).
 */
export function useRequireOnline() {
  const toast = useToast();
  const online = useOnline();
  const gate = useCallback((reason: string) => {
    if (isOnline()) return true;
    toast.show({ kind: 'info', message: reason, aboveTabBar: true });
    return false;
  }, [toast]);
  return { online, gate };
}
