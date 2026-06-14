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
}

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
