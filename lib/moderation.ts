import { supabase } from '@/lib/supabase';
import type { ReportReason } from '@/lib/types';

// ---------------------------------------------------------------------------
// Reporting.
//
// Deliberately NOT part of useFriends' context. A report is a one-shot write
// with no shared state — nothing else on any screen needs to re-render because
// one was filed, and you can report someone who is not (and never was) a
// friend. Putting it in the friends context would mean every challenge screen
// had to reach into the friend graph to say "this picture is offensive".
//
// See migration 034 for where these land and why the table has a `status`.
// ---------------------------------------------------------------------------

export const REPORT_REASONS: { code: ReportReason; label: string; detail: string }[] = [
  { code: 'sexual',     label: 'Nudity or sexual content', detail: 'Explicit imagery' },
  { code: 'violent',    label: 'Violence or gore',          detail: 'Graphic or disturbing' },
  { code: 'hateful',    label: 'Hate speech or symbols',    detail: 'Targets a group' },
  { code: 'harassment', label: 'Harassment or bullying',    detail: 'Aimed at you or someone else' },
  { code: 'spam',       label: 'Spam or a scam',            detail: 'Unwanted or deceptive' },
  { code: 'other',      label: 'Something else',            detail: "Tell us what's wrong" },
];

export interface ReportInput {
  reportedUserId: string;
  /// Set when the report is about one specific challenge rather than the
  /// person in general — it is what lets a reviewer see the actual image.
  challengeId?: string | null;
  reason: ReportReason;
  detail?: string | null;
}

/**
 * File a report. Resolves with an error rather than throwing so the caller can
 * decide how loudly to fail — a report that failed to send still needs to tell
 * the user, because they will otherwise assume it was received.
 */
export async function submitReport(
  reporterId: string,
  input: ReportInput,
): Promise<{ error: Error | null }> {
  const trimmed = input.detail?.trim();
  const { error } = await supabase.from('content_reports').insert({
    reporter_id: reporterId,
    reported_user_id: input.reportedUserId,
    challenge_id: input.challengeId ?? null,
    reason: input.reason,
    // The column caps this at 1000 chars; trim here so a whitespace-only note
    // is stored as absent rather than as a blank string.
    detail: trimmed ? trimmed.slice(0, 1000) : null,
  });
  return { error };
}
