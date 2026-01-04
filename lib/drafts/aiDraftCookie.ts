/**
 * AI個別記録下書きのCookie管理
 * activity/page.tsx と observation-editor.tsx で共通利用
 */

export interface AiObservationDraft {
  draft_id: string;
  activity_id: string | null;
  child_id: string;
  child_display_name: string;
  observation_date: string;
  content: string;
  status: 'pending' | 'saved';
  observation_id?: string;
}

const AI_DRAFT_COOKIE = 'nobiRecoAiDrafts';

/**
 * Cookieから指定された名前の値を読み取る
 */
const readCookieValue = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`));
  if (!cookie) return null;
  return cookie.split('=').slice(1).join('=');
};

/**
 * CookieからAI下書きを読み込む
 */
export const loadAiDraftsFromCookie = (): AiObservationDraft[] => {
  const raw = readCookieValue(AI_DRAFT_COOKIE);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as AiObservationDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to parse AI drafts cookie:', error);
    return [];
  }
};

/**
 * AI下書きをCookieに保存
 * status='saved'のものは除外（pendingのみ保存）
 */
export const persistAiDraftsToCookie = (drafts: AiObservationDraft[]): void => {
  if (typeof document === 'undefined') return;
  const pendingDrafts = drafts.filter((draft) => draft.status !== 'saved');
  if (pendingDrafts.length === 0) {
    document.cookie = `${AI_DRAFT_COOKIE}=; path=/; max-age=0`;
    return;
  }
  const value = encodeURIComponent(JSON.stringify(pendingDrafts));
  document.cookie = `${AI_DRAFT_COOKIE}=${value}; path=/; max-age=86400`;
};

/**
 * 指定されたdraft_idの下書きを'saved'ステータスに更新
 * observation_idを設定してCookieに保存
 */
export const markDraftAsSaved = (
  draftId: string,
  observationId: string,
  observationDate?: string,
  content?: string,
): void => {
  const drafts = loadAiDraftsFromCookie();
  const updatedDrafts = drafts.map((draft) =>
    draft.draft_id === draftId
      ? {
          ...draft,
          status: 'saved' as const,
          observation_id: observationId,
          observation_date: observationDate ?? draft.observation_date,
          content: content ?? draft.content,
        }
      : draft,
  );
  persistAiDraftsToCookie(updatedDrafts);
};

/**
 * 指定されたdraft_idの下書きを削除
 */
export const removeDraftById = (draftId: string): void => {
  const drafts = loadAiDraftsFromCookie();
  const nextDrafts = drafts.filter((d) => d.draft_id !== draftId);
  persistAiDraftsToCookie(nextDrafts);
};

/**
 * 指定されたdraft_idの下書きを取得
 */
export const getDraftById = (draftId: string): AiObservationDraft | null => {
  const drafts = loadAiDraftsFromCookie();
  return drafts.find((d) => d.draft_id === draftId) ?? null;
};
