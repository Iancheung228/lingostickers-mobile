/**
 * "3h ago", "yesterday", "just now".
 *
 * Kept out of the components that render it so it can be exercised without a
 * React Native runtime — the boundaries here are all off-by-one prone and
 * every one of them is worth a test.
 */
export function timeAgo(dateStr: string, now: number = Date.now()): string {
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return '';

  const diff = now - then;
  // Clock skew between device and server can put a "sent at" slightly in the
  // future; "in -2m" would be worse than rounding to the present.
  if (diff < 0) return 'just now';

  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;

  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
