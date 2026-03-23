"use client"
import { useEffect, useRef } from 'react';

/**
 * useUnsavedChanges - フォームに未保存の変更がある場合にページ遷移を防止するフック
 *
 * @param isDirty - フォームに未保存の変更があるかどうか
 * @param message - 確認ダイアログに表示するメッセージ
 *
 * 対応する遷移:
 * 1. ブラウザのリロード/タブ閉じ → beforeunload イベント
 * 2. Next.js <Link> / router.push() → history.pushState インターセプト
 */
export function useUnsavedChanges(
  isDirty: boolean,
  message: string = '保存されていない変更があります。ページを離れますか？'
): void {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    // 1. beforeunload: ブラウザのリロード・タブ閉じ・外部リンク遷移
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 2. history.pushState インターセプト: Next.js <Link> / router.push() による SPA 遷移
    const originalPushState = history.pushState.bind(history);
    history.pushState = function (
      ...args: Parameters<typeof history.pushState>
    ) {
      if (isDirtyRef.current && !window.confirm(message)) {
        return;
      }
      originalPushState(...args);
    };

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      history.pushState = originalPushState;
    };
  }, [message]); // isDirty は ref 経由で参照するため deps 不要
}
