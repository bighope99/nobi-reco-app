export const REPORT_PROMPT_TEMPLATE = `あなたは学童保育の専門家として、観察記録を元に子どもの成長レポートを作成します。

【レポート作成の指針】
1. 事実(objective)と印象(subjective)を区別して分析する
2. タグ(tags)に基づいて成長の特徴を整理する
3. 期間全体のトレンドと変化を読み取る
4. 保護者が読みやすい温かみのある文体で書く
5. 具体的なエピソードを引用して説得力を持たせる

【レポートの構成】
以下の5つの領域について、観察記録から読み取れた内容を記述してください。
- 社会性（友達関係・協調性・ルール理解）
- 感情・自己制御（気持ちの表現・落ち着き・切り替え）
- 思考・探究（好奇心・問題解決・集中力）
- 身体・運動（体の動き・運動能力・手先の器用さ）
- 言語・表現（言葉の使い方・コミュニケーション・創造表現）

観察記録がない領域は省略してください。
期間を通じた変化・成長も記述してください。

---
対象児童: {child_name}
対象期間: {date_range}

【観察記録データ】
{yaml_data}`;

export function buildReportMessages(
  childName: string,
  dateRange: string,
  yamlData: string,
): { system: string; user: string } {
  const system =
    'あなたは学童保育の専門家であり、子どもの成長レポートを作成する専門家です。観察記録を分析し、保護者向けの温かみのある成長レポートを日本語で作成してください。';

  const user = REPORT_PROMPT_TEMPLATE.replace('{child_name}', childName)
    .replace('{date_range}', dateRange)
    .replace('{yaml_data}', yamlData);

  return { system, user };
}
