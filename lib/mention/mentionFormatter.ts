/**
 * メンションのプレースホルダー管理ユーティリティ
 *
 * プレースホルダー形式: @[child_id] (UUIDは36文字)
 * 表示形式: @田中太郎
 */

/** プレースホルダーパターン: @[UUID形式のchild_id] */
const PLACEHOLDER_PATTERN = /@\[([a-f0-9-]{36})\]/g;

/** 表示名パターン: @に続く非空白文字列 */
const DISPLAY_NAME_PATTERN = /@([^\s@\[\]]+)/g;

/**
 * 表示名をプレースホルダーに変換（保存用）
 *
 * @example
 * ```typescript
 * const content = "今日は@田中太郎くんと@山田花子さんが元気でした";
 * const nameToIdMap = new Map([
 *   ["田中太郎", "123e4567-e89b-12d3-a456-426614174000"],
 *   ["山田花子", "223e4567-e89b-12d3-a456-426614174001"],
 * ]);
 * const result = convertToPlaceholders(content, nameToIdMap);
 * // => "今日は@[123e4567-e89b-12d3-a456-426614174000]くんと@[223e4567-e89b-12d3-a456-426614174001]さんが元気でした"
 * ```
 *
 * @param content - メンション表示名を含む本文
 * @param nameToIdMap - display_name -> child_id のMap
 * @returns プレースホルダー形式に変換された本文
 */
export function convertToPlaceholders(
  content: string,
  nameToIdMap: Map<string, string>
): string {
  if (!content || nameToIdMap.size === 0) {
    return content;
  }

  return content.replace(DISPLAY_NAME_PATTERN, (match, displayName: string) => {
    const childId = nameToIdMap.get(displayName);
    if (childId) {
      return `@[${childId}]`;
    }
    // マッチしない場合は元の表示名を保持
    return match;
  });
}

/**
 * プレースホルダーを表示名に変換（表示用）
 *
 * @example
 * ```typescript
 * const content = "今日は@[123e4567-e89b-12d3-a456-426614174000]くんが元気でした";
 * const idToNameMap = new Map([
 *   ["123e4567-e89b-12d3-a456-426614174000", "田中太郎"],
 * ]);
 * const result = convertToDisplayNames(content, idToNameMap);
 * // => "今日は@田中太郎くんが元気でした"
 * ```
 *
 * @param content - プレースホルダーを含む本文
 * @param idToNameMap - child_id -> display_name のMap
 * @returns 表示名形式に変換された本文
 */
export function convertToDisplayNames(
  content: string,
  idToNameMap: Map<string, string>
): string {
  if (!content || idToNameMap.size === 0) {
    return content;
  }

  return content.replace(PLACEHOLDER_PATTERN, (match, childId: string) => {
    const displayName = idToNameMap.get(childId);
    if (displayName) {
      return `@${displayName}`;
    }
    // マッチしない場合は元のプレースホルダーを保持
    return match;
  });
}

/**
 * コンテンツからchild_idを抽出
 *
 * @example
 * ```typescript
 * const content = "今日は@[123e4567-e89b-12d3-a456-426614174000]くんと@[223e4567-e89b-12d3-a456-426614174001]さんが元気でした";
 * const ids = extractChildIdsFromContent(content);
 * // => ["123e4567-e89b-12d3-a456-426614174000", "223e4567-e89b-12d3-a456-426614174001"]
 * ```
 *
 * @param content - プレースホルダーを含む本文
 * @returns 抽出されたchild_idの配列（重複なし）
 */
export function extractChildIdsFromContent(content: string): string[] {
  if (!content) {
    return [];
  }

  const ids: string[] = [];
  let match: RegExpExecArray | null;

  // グローバルパターンを使用するため、新しいRegExpインスタンスを作成
  const pattern = new RegExp(PLACEHOLDER_PATTERN.source, 'g');

  while ((match = pattern.exec(content)) !== null) {
    const childId = match[1];
    // 重複を避ける
    if (!ids.includes(childId)) {
      ids.push(childId);
    }
  }

  return ids;
}

/**
 * 子ども情報からID→表示名のMapを構築
 *
 * @example
 * ```typescript
 * const children = [
 *   { child_id: "123e4567-e89b-12d3-a456-426614174000", display_name: "田中太郎" },
 *   { child_id: "223e4567-e89b-12d3-a456-426614174001", display_name: "山田花子" },
 * ];
 * const map = buildIdToNameMap(children);
 * // => Map { "123e4567..." => "田中太郎", "223e4567..." => "山田花子" }
 * ```
 *
 * @param children - child_idとdisplay_nameを持つオブジェクトの配列
 * @returns child_id -> display_name のMap
 */
export function buildIdToNameMap(
  children: Array<{ child_id: string; display_name: string }>
): Map<string, string> {
  const map = new Map<string, string>();

  for (const child of children) {
    map.set(child.child_id, child.display_name);
  }

  return map;
}

/**
 * 子ども情報から表示名→IDのMapを構築
 *
 * @example
 * ```typescript
 * const children = [
 *   { child_id: "123e4567-e89b-12d3-a456-426614174000", display_name: "田中太郎" },
 *   { child_id: "223e4567-e89b-12d3-a456-426614174001", display_name: "山田花子" },
 * ];
 * const map = buildNameToIdMap(children);
 * // => Map { "田中太郎" => "123e4567...", "山田花子" => "223e4567..." }
 * ```
 *
 * @param children - child_idとdisplay_nameを持つオブジェクトの配列
 * @returns display_name -> child_id のMap
 */
export function buildNameToIdMap(
  children: Array<{ child_id: string; display_name: string }>
): Map<string, string> {
  const map = new Map<string, string>();

  for (const child of children) {
    map.set(child.display_name, child.child_id);
  }

  return map;
}
