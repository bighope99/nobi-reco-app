import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

/**
 * 活動記録から特定の子供に関する内容を抽出
 *
 * Gemini AIを使用して、活動記録の全文から特定の子供に関連する
 * 内容を抽出し、個別記録として適切な形式に整形します。
 *
 * @param fullContent - 活動記録の全文（メンション含む）
 * @param childId - 対象の子供ID（UUID）
 * @param mentionToken - その子供のメンショントークン（暗号化済み）
 * @returns その子供に関連する抽出された内容（200文字程度）
 * @throws {Error} Gemini API呼び出しが失敗した場合
 *
 * @example
 * ```typescript
 * const fullContent = '<mention data-child-id="token1">@田中太郎</mention>くんが積み木で遊びました。';
 * const extracted = await extractChildContent(fullContent, 'child-id-1', 'token1');
 * console.log(extracted); // "田中太郎くんが積み木で高い塔を作りました。..."
 * ```
 */
export async function extractChildContent(
  fullContent: string,
  childId: string,
  mentionToken: string
): Promise<string> {
  // メンションタグから子供の名前を抽出
  let childName = '該当の子供';

  if (mentionToken) {
    // 正規表現の特殊文字をエスケープ
    const escapedToken = mentionToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mentionRegex = new RegExp(
      `<mention data-child-id="${escapedToken}">@([^<]+)</mention>`,
      'g'
    );

    const match = mentionRegex.exec(fullContent);
    if (match && match[1]) {
      childName = match[1];
    }
  }

  // HTMLタグを除去してプレーンテキスト化
  const plainContent = fullContent.replace(
    /<mention[^>]*>@([^<]+)<\/mention>/g,
    '@$1'
  );

  // Gemini APIクライアントの初期化
  const model = new ChatGoogleGenerativeAI({
    modelName: 'gemini-2.0-flash-exp',
    apiKey: process.env.GOOGLE_GEMINI_API_KEY,
    temperature: 0.7,
    maxOutputTokens: 300,
  });

  // システムプロンプト
  const systemMessage = new SystemMessage(
    `あなたは学童保育の記録作成支援AIです。活動記録から特定の子供に関する内容を抽出してください。

【抽出ルール】
1. その子供の行動、発言、様子に関する記述を抽出
2. その子供がメンションされている文脈を含める
3. 他の子供との関わりも含める
4. 個別記録として自然な文章に整形
5. 簡潔に200文字程度でまとめる
6. 事実ベースで記述し、推測や誇張は避ける
7. 子供の成長に関わる観察ポイントを含める`
  );

  // ユーザープロンプト
  const userMessage = new HumanMessage(
    `【活動記録全文】
${plainContent}

【対象の子供】
${childName}

この子供に関する個別記録を抽出してください。`
  );

  try {
    // Gemini API呼び出し
    const response = await model.invoke([systemMessage, userMessage]);

    // レスポンスから内容を取得
    const extractedContent =
      typeof response.content === 'string'
        ? response.content
        : response.content.toString();

    return extractedContent.trim();
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error(
      `Failed to extract child content: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * 複数の子供の内容を一括で抽出
 *
 * @param fullContent - 活動記録の全文
 * @param children - 抽出対象の子供情報の配列
 * @returns 各子供の抽出内容の配列
 *
 * @example
 * ```typescript
 * const children = [
 *   { id: 'child-id-1', token: 'token1' },
 *   { id: 'child-id-2', token: 'token2' },
 * ];
 * const results = await extractMultipleChildrenContent(fullContent, children);
 * ```
 */
export async function extractMultipleChildrenContent(
  fullContent: string,
  children: Array<{ id: string; token: string }>
): Promise<Array<{ childId: string; content: string }>> {
  const results = await Promise.all(
    children.map(async (child) => {
      try {
        const content = await extractChildContent(
          fullContent,
          child.id,
          child.token
        );
        return { childId: child.id, content };
      } catch (error) {
        console.error(`Failed to extract content for child ${child.id}:`, error);
        return { childId: child.id, content: '' };
      }
    })
  );

  return results;
}
