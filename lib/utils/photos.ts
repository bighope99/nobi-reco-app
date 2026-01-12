/**
 * 正規化された写真の型定義
 */
export interface NormalizedPhoto {
  url: string;
  caption: string | null;
  thumbnail_url: string | null;
  file_id: string | null;
  file_path: string | null;
}

/**
 * 写真配列を正規化する
 * @param photos - 任意の形式の写真データ
 * @returns 正規化された写真配列、または入力が配列でない場合はnull
 */
export function normalizePhotos(photos: unknown): NormalizedPhoto[] | null {
  if (!Array.isArray(photos)) {
    return null;
  }

  return photos
    .map((photo: any): NormalizedPhoto | null => {
      if (!photo || typeof photo.url !== 'string') {
        return null;
      }
      return {
        url: photo.url,
        caption: typeof photo.caption === 'string' ? photo.caption : null,
        thumbnail_url: typeof photo.thumbnail_url === 'string' ? photo.thumbnail_url : null,
        file_id: typeof photo.file_id === 'string' ? photo.file_id : null,
        file_path: typeof photo.file_path === 'string' ? photo.file_path : null,
      };
    })
    .filter((p): p is NormalizedPhoto => p !== null);
}
