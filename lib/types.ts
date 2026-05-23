export interface Profile {
  id: string;
  username: string | null;
  created_at: string;
}

export type Category = 'Kitchen' | 'Animals' | 'Study' | 'Nature' | 'Other';

export interface Sticker {
  id: string;
  user_id: string;
  name: string;
  translation: string;
  pronunciation: string;
  category: Category;
  image_path: string;
  discovered_at: string;
}

export interface StickerDraft {
  name: string;
  translation: string;
  pronunciation: string;
  category: Category;
  imagePath: string;
}
