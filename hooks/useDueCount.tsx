import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

// The Collection screen already computes the due queue (dueToday); the tab bar
// only needs its length for the badge. One small context (skills.md #1) so the
// two agree without a second query.
interface DueCountApi {
  dueCount: number;
  setDueCount: (n: number) => void;
}

const DueCountContext = createContext<DueCountApi>({ dueCount: 0, setDueCount: () => {} });

export function DueCountProvider({ children }: { children: ReactNode }) {
  const [dueCount, setDueCount] = useState(0);
  const value = useMemo(() => ({ dueCount, setDueCount }), [dueCount]);
  return <DueCountContext.Provider value={value}>{children}</DueCountContext.Provider>;
}

export function useDueCount(): DueCountApi {
  return useContext(DueCountContext);
}
