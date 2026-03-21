"use client"
import { useEffect, useCallback } from 'react';

/**
 * useUnsavedChanges - フォームに未保存の変更がある場合にページ遷移を防止するフック
 *
 * @param isDirty - フォームに未保存の変更があるかどうか
 * @param message - 確認ダイアログに表示するメッセージ（beforeunload では無視される場合あり）
 *
 * 対応する遷移:
 * 1. ブラウザの戻る/進む/リロード/タブ閉じ → beforeunload イベント
 * 2. <a> タグでの遷移 → beforeunload イベント（SPA内遷移でない場合）
 *
 * 注意: Next.js App Router では router.push() による SPA 遷移のインターセプトは
 * 公式サポートがないため、beforeunload のみで対応する。
 * window.location.href による遷移は beforeunload で捕捉される。
 */
export function useUnsavedChanges(
  isDirty: boolean,
  message: string = '保存されていない変更があります。ページを離れますか？'
): void {
  const handleBeforeUnload = useCallback(
    (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      // 一部ブラウザでは returnValue の設定が必要
      e.returnValue = message;
    },
    [isDirty, message]
  );

  useEffect(() => {
    if (isDirty) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, handleBeforeUnload]);
}
