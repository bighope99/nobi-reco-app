/**
 * テキストエリア内のカーソル位置を取得するユーティリティ
 *
 * textarea-caret-position ライブラリを使用して、
 * テキストエリア内のカーソル位置の画面座標を取得します。
 */

// CommonJS モジュールをインポート
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CaretCoordinates = require('textarea-caret-position');

/** CaretCoordinates インスタンスの型定義 */
interface CaretCoordinatesInstance {
  get(positionLeft: number, positionRight: number): {
    top: number;
    left: number;
    right: number;
  };
}

/** CaretCoordinates コンストラクタの型定義 */
interface CaretCoordinatesConstructor {
  new (element: HTMLTextAreaElement | HTMLInputElement): CaretCoordinatesInstance;
}

/** インスタンスをキャッシュするための WeakMap */
const caretInstanceCache = new WeakMap<
  HTMLTextAreaElement,
  CaretCoordinatesInstance
>();

/**
 * CaretCoordinates インスタンスを取得（キャッシュを利用）
 */
function getCaretInstance(
  textarea: HTMLTextAreaElement
): CaretCoordinatesInstance {
  let instance = caretInstanceCache.get(textarea);
  if (!instance) {
    const Constructor = CaretCoordinates as CaretCoordinatesConstructor;
    instance = new Constructor(textarea);
    caretInstanceCache.set(textarea, instance);
  }
  return instance;
}

/**
 * テキストエリア内のカーソル位置の画面座標を取得
 *
 * @param textarea - 対象のテキストエリア要素
 * @returns カーソル位置の座標（top, left, height）、または null
 *
 * @example
 * ```typescript
 * const textarea = document.querySelector('textarea');
 * const position = getCaretScreenPosition(textarea);
 * if (position) {
 *   console.log(`Top: ${position.top}, Left: ${position.left}`);
 * }
 * ```
 */
export function getCaretScreenPosition(
  textarea: HTMLTextAreaElement | null
): { top: number; left: number; height: number } | null {
  if (!textarea) {
    return null;
  }

  try {
    const caretInstance = getCaretInstance(textarea);
    const caretPosition = textarea.selectionStart ?? 0;
    const coordinates = caretInstance.get(caretPosition, caretPosition);

    // テキストエリアの位置を取得
    const rect = textarea.getBoundingClientRect();

    // スクロール位置を考慮した画面座標を計算
    const top =
      rect.top + coordinates.top - textarea.scrollTop + window.scrollY;
    const left =
      rect.left + coordinates.left - textarea.scrollLeft + window.scrollX;

    // 行の高さを取得（フォントサイズから推定）
    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(computedStyle.lineHeight) || 20;

    return {
      top,
      left,
      height: lineHeight,
    };
  } catch {
    // エラーが発生した場合は null を返す
    return null;
  }
}

/**
 * Radix Popover の virtualRef 用の DOMRect を生成
 *
 * Radix UI の Popover コンポーネントは virtualRef を使用して
 * 任意の位置にポップオーバーを表示できます。
 * この関数は、テキストエリアのカーソル位置に基づいた
 * getBoundingClientRect メソッドを持つオブジェクトを返します。
 *
 * @param textarea - 対象のテキストエリア要素
 * @returns getBoundingClientRect メソッドを持つオブジェクト、または null
 *
 * @example
 * ```typescript
 * const textarea = document.querySelector('textarea');
 * const virtualAnchor = createVirtualAnchor(textarea);
 * if (virtualAnchor) {
 *   // Radix Popover で使用
 *   <Popover.Anchor virtualRef={{ current: virtualAnchor }} />
 * }
 * ```
 */
export function createVirtualAnchor(
  textarea: HTMLTextAreaElement | null
): { getBoundingClientRect: () => DOMRect } | null {
  if (!textarea) {
    return null;
  }

  return {
    getBoundingClientRect: (): DOMRect => {
      const position = getCaretScreenPosition(textarea);

      if (!position) {
        // フォールバック: テキストエリア自体の位置を返す
        return textarea.getBoundingClientRect();
      }

      // DOMRect を生成
      // 注意: DOMRect のコンストラクタは一部のブラウザでサポートされていないため、
      // オブジェクトリテラルで作成し、DOMRect.fromRect() を使用
      const rectInit = {
        x: position.left,
        y: position.top,
        width: 0,
        height: position.height,
      };

      // DOMRect.fromRect が利用可能な場合は使用
      if (typeof DOMRect !== 'undefined' && DOMRect.fromRect) {
        return DOMRect.fromRect(rectInit);
      }

      // フォールバック: 手動で DOMRect 互換オブジェクトを作成
      return {
        x: rectInit.x,
        y: rectInit.y,
        width: rectInit.width,
        height: rectInit.height,
        top: rectInit.y,
        left: rectInit.x,
        bottom: rectInit.y + rectInit.height,
        right: rectInit.x + rectInit.width,
        toJSON: () => ({
          x: rectInit.x,
          y: rectInit.y,
          width: rectInit.width,
          height: rectInit.height,
          top: rectInit.y,
          left: rectInit.x,
          bottom: rectInit.y + rectInit.height,
          right: rectInit.x + rectInit.width,
        }),
      } as DOMRect;
    },
  };
}
