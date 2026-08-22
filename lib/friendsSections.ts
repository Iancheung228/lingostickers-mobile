import { ChallengeWithSender, ChallengeWithReceiver, FriendWithProfile } from '@/lib/types';

// ---------------------------------------------------------------------------
// What the Friends tab shows, decided without reference to how it looks.
//
// Pulled out of the screen so the branching can be exercised directly. The
// interesting behaviour here isn't rendering — it's that both sections must
// survive being empty, that a friend request and a challenge have to land in
// the same group, and that "you have nobody" is a different state from "your
// friends have been quiet". Those are the cases that used to be wrong, and
// they're all decidable from data alone.
// ---------------------------------------------------------------------------

export type InboxItem =
  | { kind: 'request'; key: string; friendship: FriendWithProfile }
  | { kind: 'challenge'; key: string; challenge: ChallengeWithSender };

export type Row =
  | InboxItem
  | { kind: 'solved'; key: string; challenge: ChallengeWithReceiver }
  | { kind: 'resting'; key: string; text: string };

export interface FriendsSection {
  key: 'needs' | 'solved';
  title: string;
  /// Rendered as a pill beside the heading. Zero means no pill.
  count: number;
  data: Row[];
}

export const RESTING_NEEDS = 'Nothing waiting right now.';
export const RESTING_SOLVED =
  'Challenges you send will show up here once a friend solves them.';

/**
 * A friend request and a challenge are the same job — someone is waiting on an
 * answer — so they share one group. Requests come first: they gate everything
 * else, since you can't be challenged by someone who isn't a friend yet.
 */
export function buildInboxItems(
  pendingReceived: FriendWithProfile[],
  inbox: ChallengeWithSender[],
): InboxItem[] {
  return [
    ...pendingReceived.map<InboxItem>(f => ({ kind: 'request', key: `r-${f.id}`, friendship: f })),
    ...inbox.map<InboxItem>(c => ({ kind: 'challenge', key: `c-${c.id}`, challenge: c })),
  ];
}

/**
 * Both sections always exist. An empty one carries a resting line instead of
 * disappearing — a page whose shape depends on its data can't be learned, and
 * a vanished section takes with it the only evidence that its feature exists.
 */
export function buildSections(
  inboxItems: InboxItem[],
  feed: ChallengeWithReceiver[],
): FriendsSection[] {
  return [
    {
      key: 'needs',
      title: 'Needs you',
      count: inboxItems.length,
      data: inboxItems.length > 0
        ? inboxItems
        : [{ kind: 'resting', key: 'needs-rest', text: RESTING_NEEDS }],
    },
    {
      key: 'solved',
      title: 'Solved by friends',
      // No pill: this section is reading material, not an obligation, and a
      // count here would compete with the one that means something.
      count: 0,
      data: feed.length > 0
        ? feed.map<Row>(c => ({ kind: 'solved', key: `s-${c.id}`, challenge: c }))
        : [{ kind: 'resting', key: 'solved-rest', text: RESTING_SOLVED }],
    },
  ];
}

export function subtitleFor(acceptedCount: number): string {
  if (acceptedCount === 0) return 'Nobody here yet';
  return `${acceptedCount} ${acceptedCount === 1 ? 'friend' : 'friends'} learning with you`;
}

/**
 * The first-run panel shows only when there is genuinely nobody — not merely
 * when there's no activity. A pending request counts as somebody, because the
 * user's next move is to answer it rather than to go looking for people.
 */
export function isFirstRun(
  acceptedCount: number,
  pendingReceivedCount: number,
): boolean {
  return acceptedCount === 0 && pendingReceivedCount === 0;
}
