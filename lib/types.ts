export type Language = 'fr' | 'ja' | 'yue';

export type WallDisplayStyle = 'framed' | 'cutout';
export type CutoutBorderStyle = 'shadow' | 'outline' | 'none';
export type WallBackgroundDim = 'none' | 'light' | 'medium' | 'dark';

export interface Profile {
  id: string;
  username: string | null;
  // Storage path of the profile picture in the public `avatars` bucket —
  // see 030_profile_avatar.sql. Null for anyone who skipped it at sign-up;
  // Avatar falls back to a tinted initial.
  avatar_path: string | null;
  target_language: Language;
  wall_display_style: WallDisplayStyle;
  cutout_border_style: CutoutBorderStyle;
  // Home-screen mini wall's own cover photo — deliberately separate from
  // any individual board's background_path so personalizing the home
  // preview doesn't force a matching change onto any board, or vice versa.
  home_background_path: string | null;
  home_background_dim: WallBackgroundDim;
  // False until the user first arranges the home mini wall by hand. While
  // false the panel draws the auto fan of newest + favorites; once true it
  // draws home_stickers, even when that's empty — see 031_home_wall.sql.
  home_wall_arranged: boolean;
  created_at: string;
}

export type Category = 'Kitchen' | 'Animals' | 'Study' | 'Nature' | 'Other';

export interface Sticker {
  id: string;
  user_id: string;
  language: Language;
  word: string;
  translation: string;
  reading: string;
  sentence: string;
  sentence_translation: string;
  // Short English callout naming a grammar pattern the sentence uses, or a
  // bonus word it introduces — see supabase/functions/_shared/vocab.ts.
  // Null for stickers created before this existed.
  sentence_insight: string | null;
  // "noun", "verb", … — the qualifier on the study card's MEANS row. Null
  // for stickers created before 028_study_card_review_state.sql, which
  // render the row without it.
  part_of_speech: string | null;
  category: Category;
  image_path: string;
  memory_photo_path: string | null;
  // Dominant color of the memory photo (hex), extracted server-side at
  // upload time — see supabase/functions/_shared/imageColor.ts. Null when
  // there's no memory photo, or for rows created before this existed.
  memory_photo_color: string | null;
  voice_note_path: string | null;
  // Where within the recorded file actual speech starts/ends — playback
  // seeks to voice_note_start_ms and stops at voice_note_end_ms so it
  // skips leading/trailing silence without re-encoding the audio. Null on
  // recordings made before this existed — play the whole file for those.
  voice_note_start_ms: number | null;
  voice_note_end_ms: number | null;
  discovered_at: string;
  // Row-insertion time — "when it landed in your collection", distinct from
  // discovered_at ("when the memory happened", which can be backdated on
  // photo import). Used only for the "Recently added" sort.
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  location_label: string | null;
  source: 'scan' | 'challenge';
  is_favorite: boolean;
  notes: string | null;
  // How many times this card has been studied to the end (front flipped to
  // back), and when that last happened. Together they drive the review
  // schedule in lib/review.ts — see 028_study_card_review_state.sql.
  // last_reviewed_at is null until the first review; review_count is 0.
  review_count: number;
  last_reviewed_at: string | null;
  // SM-2 state — see 029_sm2_scheduler.sql and lib/review.ts.
  // interval_days is 0 for a card that has never been studied.
  ease_factor: number;
  interval_days: number;
  lapses: number;
}

/// The region of a source photo that's actually on screen. x/y/w/h are
/// fractions (0-1) of the source, not pixels — see
/// 032_board_background_crop.sql for why.
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/// A CropRect plus the pixel size of the stored source it refers to, which is
/// what lets the editor reopen on that source without measuring the file
/// first. This is the shape persisted in boards.background_crop.
export interface BackgroundCrop extends CropRect {
  sw: number;
  sh: number;
}

export interface Board {
  id: string;
  user_id: string;
  name: string;
  // Each board has its own independent cover photo — see
  // 025_per_board_background.sql.
  background_path: string | null;
  // Which part of the *uncropped* source photo background_path was cut from,
  // so the framing stays editable instead of being baked in at upload time.
  // Null for backgrounds uploaded before 032_board_background_crop.sql —
  // those have no stored source, so they can be replaced but not repositioned.
  background_crop: BackgroundCrop | null;
  // Tint strength as a percent (0-70), via a continuous slider — see
  // 026_board_background_dim_percent.sql. Unlike home_background_dim above,
  // this is NOT the fixed none/light/medium/dark enum.
  background_dim: number;
  created_at: string;
}

export interface BoardSticker {
  board_id: string;
  sticker_id: string;
  x: number;
  y: number;
  rotation: number;
  added_at: string;
}

export interface BoardStickerWithSticker extends BoardSticker {
  sticker: Sticker;
}

// One sticker pinned to the home screen's mini wall. Unlike BoardSticker
// above, x/y are NORMALIZED fractions of the canvas (0-1), not pixels —
// the same arrangement is drawn at two different sizes. lib/homeWall.ts
// owns the conversion.
export interface HomeSticker {
  user_id: string;
  sticker_id: string;
  x: number;
  y: number;
  rotation: number;
  added_at: string;
}

export interface HomeStickerWithSticker extends HomeSticker {
  sticker: Sticker;
}

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

// The public face of a person: everything needed to render them in a list,
// and nothing else. Every screen that shows someone other than the
// signed-in user reads exactly these three columns.
export type PersonSummary = Pick<Profile, 'id' | 'username' | 'avatar_path'>;

export interface FriendWithProfile extends Friendship {
  friend: PersonSummary;
  is_requester: boolean;
}

export type ChallengeStatus = 'pending' | 'active' | 'won';

export interface StickerChallenge {
  id: string;
  sender_id: string;
  receiver_id: string;
  source_sticker_id: string | null;
  snapshot_word: string;
  snapshot_translation: string;
  snapshot_reading: string;
  snapshot_sentence: string;
  snapshot_image_path: string;
  snapshot_memory_photo_path: string | null;
  snapshot_language: Language;
  snapshot_accepted_answers: string[];
  status: ChallengeStatus;
  attempts_used: number;
  hint_used: boolean;
  won_sticker_id: string | null;
  sent_at: string;
  completed_at: string | null;
}

export interface ChallengeWithSender extends StickerChallenge {
  sender: PersonSummary;
}

export interface ChallengeWithReceiver extends StickerChallenge {
  receiver: PersonSummary;
}

export type SubmitAnswerResult =
  | { outcome: 'correct'; won_sticker_id: string }
  | { outcome: 'wrong'; attempts_used: number; hint_available: boolean }
  | { outcome: 'hint'; first_letter: string; attempts_used: number }
  | { outcome: 'already_completed' };

export interface StickerDraft {
  language: Language;
  word: string;
  translation: string;
  reading: string;
  sentence: string;
  sentenceTranslation: string;
  sentenceInsight: string | null;
  partOfSpeech: string | null;
  category: Category;
  imagePath: string;
  memoryPhotoPath: string | null;
  memoryPhotoColor: string | null;
  bgIssue: { kind: string; message: string } | null;
  // Which engine produced this cutout. 'device' means Apple Vision cut it out
  // locally; 'server' means it went through the edge function's background
  // removal.
  bgSource: 'device' | 'server';
  // Set only while CUTOUT_DRY_RUN is on: a local file URI for the cutout the
  // device produced, shown in place of the saved one so the new pipeline can
  // be looked at before anything is deployed or stored.
  localCutoutUri?: string | null;
  discoveredAt: string;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
}
