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

    // 2. クリックキャプチャ: Next.js <Link> より先にインターセプトして遷移をブロック
    //    capture:true でイベントがターゲットに到達する前に捕捉し、
    //    preventDefault + stopPropagation で Next.js のルーター処理を止める
    const handleClick = (e: MouseEvent) => {
      if (!isDirtyRef.current) return;
      const anchor = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      // 別オリジン・ページ内アンカー(#)は対象外
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.hash) return;

      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('click', handleClick, true); // capture phase

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleClick, true);
    };
  }, [message]); // isDirty は ref 経由で参照するため deps 不要
}
