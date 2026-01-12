const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const replaceChildIdsWithNames = (text: string, nameById: Map<string, string>) => {
  if (!text) return text;
  return text.replace(/@?child:([^\s、。,.!?]+)/g, (match, id) => {
    const name = nameById.get(id);
    // 名前が見つかった場合は @name 形式で返す（MentionTextareaの一括削除対応）
    return name ? `@${name}` : match;
  });
};

export const replaceChildNamesWithIds = (text: string, nameById: Map<string, string>) => {
  if (!text || nameById.size === 0) return text;
  const entries = Array.from(nameById.entries())
    .filter(([, name]) => name)
    .sort((a, b) => b[1].length - a[1].length);
  let next = text;
  entries.forEach(([id, name]) => {
    const escapedName = escapeRegex(name);
    // @name 形式と name 形式の両方を child:id に変換
    next = next.replace(new RegExp(`@${escapedName}`, 'g'), `child:${id}`);
    next = next.replace(new RegExp(escapedName, 'g'), `child:${id}`);
  });
  return next;
};
