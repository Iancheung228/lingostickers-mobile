export type Language = 'fr' | 'ja';

export interface Profile {
  id: string;
  username: string | null;
  target_language: Language;
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
  category: Category;
  image_path: string;
  memory_photo_path: string | null;
  discovered_at: string;
  latitude: number | null;
  longitude: number | null;
  location_label: string | null;
  source: 'scan' | 'challenge';
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
  category: Category;
  imagePath: string;
  memoryPhotoPath: string | null;
  discoveredAt: string;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
}
