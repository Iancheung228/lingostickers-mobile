export type Language = 'fr' | 'ja' | 'yue';

export type WallDisplayStyle = 'framed' | 'cutout';
export type CutoutBorderStyle = 'shadow' | 'outline' | 'none';
export type WallBackgroundDim = 'none' | 'light' | 'medium' | 'dark';

export interface Profile {
  id: string;
  username: string | null;
  target_language: Language;
  wall_display_style: WallDisplayStyle;
  cutout_border_style: CutoutBorderStyle;
  // Home-screen mini wall's own cover photo — deliberately separate from
  // any individual board's background_path so personalizing the home
  // preview doesn't force a matching change onto any board, or vice versa.
  home_background_path: string | null;
  home_background_dim: WallBackgroundDim;
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
}

export interface Board {
  id: string;
  user_id: string;
  name: string;
  // Each board has its own independent cover photo — see
  // 025_per_board_background.sql.
  background_path: string | null;
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

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

export interface FriendWithProfile extends Friendship {
  friend: Pick<Profile, 'id' | 'username'>;
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
  sender: Pick<Profile, 'id' | 'username'>;
}

export interface ChallengeWithReceiver extends StickerChallenge {
  receiver: Pick<Profile, 'id' | 'username'>;
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
  category: Category;
  imagePath: string;
  memoryPhotoPath: string | null;
  memoryPhotoColor: string | null;
  bgIssue: { kind: string; message: string } | null;
  discoveredAt: string;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
}
