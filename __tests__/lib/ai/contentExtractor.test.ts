import { extractChildContent } from '@/lib/ai/contentExtractor';

const sampleEncryptedToken1 = 'sample_encrypted_token_1';
const sampleEncryptedToken2 = 'sample_encrypted_token_2';
const sampleEncryptedToken3 = 'sample_encrypted_token_3';

// Gemini APIのモック
jest.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockImplementation(async (messages) => {
      // メッセージから子供のIDを抽出
      const userMessage = messages.find((m: any) => m._getType() === 'human');
      const content = userMessage?.content || '';

      // テスト用のモックレスポンス
      if (content.includes(`child:${sampleEncryptedToken1}`)) {
        return {
          content: `@child:${sampleEncryptedToken1} が積み木で高い塔を作りました。創造性と集中力が見られました。`,
        };
      } else if (content.includes(`child:${sampleEncryptedToken2}`)) {
        return {
          content: `@child:${sampleEncryptedToken2} が友達と協力して作品を完成させました。協調性が育っています。`,
        };
      } else if (content.includes(`child:${sampleEncryptedToken3}`)) {
        return {
          content: `@child:${sampleEncryptedToken3} が元気に外遊びを楽しみました。活発な様子が見られました。`,
        };
      }

      return {
        content: 'この子供に関する記録が抽出されました。',
      };
    }),
  })),
}));

describe('extractChildContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本的な内容抽出', () => {
    it('メンションされた子供の内容を抽出できること', async () => {
      const fullContent = `<mention data-child-id="${sampleEncryptedToken1}">@田中太郎</mention>くんが積み木で高い塔を作りました。`;
      const childId = 'child-id-1';

      const result = await extractChildContent(fullContent, childId, sampleEncryptedToken1);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain(`child:${sampleEncryptedToken1}`);
    });

    it('複数のメンションがある場合、指定した子供の内容のみを抽出すること', async () => {
      const fullContent = `
        <mention data-child-id="${sampleEncryptedToken1}">@田中太郎</mention>くんが積み木で遊んでいました。
        <mention data-child-id="${sampleEncryptedToken2}">@佐藤花子</mention>さんも一緒に協力していました。
      `;
      const childId = 'child-id-1';

      const result = await extractChildContent(fullContent, childId, sampleEncryptedToken1);

      expect(result).toContain(`child:${sampleEncryptedToken1}`);
      // 他の子供が言及されていても良いが、メインは指定ID
    });

    it('メンションタグをプレーンテキスト化して処理すること', async () => {
      const fullContent = `<mention data-child-id="${sampleEncryptedToken1}">@田中太郎</mention>くんが元気に遊びました。`;
      const childId = 'child-id-1';

      const result = await extractChildContent(fullContent, childId, sampleEncryptedToken1);

      // HTMLタグが除去され、@child:{ID}の形式で処理されること
      expect(result).toBeDefined();
    });
  });

  describe('エッジケース', () => {
    it('メンションがない場合でも処理できること', async () => {
      const fullContent = '今日はみんなで外遊びをしました。';
      const childId = 'child-id-1';

      const result = await extractChildContent(fullContent, '', '');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('空の内容の場合でも処理できること', async () => {
      const fullContent = '';
      const childId = 'child-id-1';

      const result = await extractChildContent(fullContent, childId, sampleEncryptedToken1);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('特殊文字を含む内容でも処理できること', async () => {
      const fullContent = `<mention data-child-id="${sampleEncryptedToken1}">@田中太郎</mention>くんが「楽しい！」と言っていました。`;
      const childId = 'child-id-1';

      const result = await extractChildContent(fullContent, childId, sampleEncryptedToken1);

      expect(result).toBeDefined();
    });

    it('長文の活動記録から抽出できること', async () => {
      const fullContent = `
        今日の活動では、子供たちが様々な遊びを楽しみました。
        <mention data-child-id="${sampleEncryptedToken1}">@田中太郎</mention>くんは積み木コーナーで創造的な作品を作っていました。
        <mention data-child-id="${sampleEncryptedToken2}">@佐藤花子</mention>さんは絵本を読んでいました。
        <mention data-child-id="${sampleEncryptedToken3}">@鈴木次郎</mention>くんは外で元気に走り回っていました。
        午後からは全員で工作活動を行い、協力して大きな作品を完成させました。
      `.trim();
      const childId = 'child-id-1';

      const result = await extractChildContent(fullContent, childId, sampleEncryptedToken1);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('メンションIDの抽出', () => {
    it('メンションタグから子供のIDを正しく抽出すること', async () => {
      const fullContent = `<mention data-child-id="${sampleEncryptedToken1}">@田中太郎</mention>くんが遊びました。`;
      const childId = 'child-id-1';

      const result = await extractChildContent(fullContent, childId, sampleEncryptedToken1);

      // 子供のIDが結果に含まれていることを確認
      expect(result).toContain(`child:${sampleEncryptedToken1}`);
    });

    it('複数の同じ子供のメンションがある場合でも正しく処理すること', async () => {
      const fullContent = `
        <mention data-child-id="${sampleEncryptedToken1}">@田中太郎</mention>くんが積み木で遊び始めました。
        その後、<mention data-child-id="${sampleEncryptedToken1}">@田中太郎</mention>くんは高い塔を完成させました。
      `;
      const childId = 'child-id-1';

      const result = await extractChildContent(fullContent, childId, sampleEncryptedToken1);

      expect(result).toBeDefined();
      expect(result).toContain(`child:${sampleEncryptedToken1}`);
    });
  });

  describe('セキュリティ', () => {
    it('XSS攻撃を含む入力でも安全に処理すること', async () => {
      const maliciousContent = `<mention data-child-id="${sampleEncryptedToken1}">@田中太郎</mention><script>alert('XSS')</script>くんが遊びました。`;
      const childId = 'child-id-1';

      const result = await extractChildContent(maliciousContent, childId, sampleEncryptedToken1);

      expect(result).toBeDefined();
      expect(result).not.toContain('<script>');
    });

    it('SQLインジェクションを含む入力でも安全に処理すること', async () => {
      const maliciousContent = `<mention data-child-id="${sampleEncryptedToken1}">@田中'; DROP TABLE children; --</mention>くんが遊びました。`;
      const childId = 'child-id-1';

      const result = await extractChildContent(maliciousContent, childId, sampleEncryptedToken1);

      expect(result).toBeDefined();
    });
  });

  describe('出力形式', () => {
    it('簡潔な文章（目安200文字程度）を返すこと', async () => {
      const fullContent = `<mention data-child-id="${sampleEncryptedToken1}">@田中太郎</mention>くんが積み木で高い塔を作りました。`;
      const childId = 'child-id-1';

      const result = await extractChildContent(fullContent, childId, sampleEncryptedToken1);

      // 極端に長すぎないこと（500文字以内を目安）
      expect(result.length).toBeLessThan(500);
    });

    it('自然な日本語の文章を返すこと', async () => {
      const fullContent = `<mention data-child-id="${sampleEncryptedToken1}">@田中太郎</mention>くんが積み木で遊びました。`;
      const childId = 'child-id-1';

      const result = await extractChildContent(fullContent, childId, sampleEncryptedToken1);

      // 基本的な日本語の文字が含まれていること
      expect(result).toMatch(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/);
    });
  });

  describe('エラーハンドリング', () => {
    it('API呼び出しが失敗した場合はエラーをスローすること', async () => {
      // Gemini APIのモックを一時的にエラーを返すように変更
      const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
      const mockInvoke = jest.fn().mockRejectedValueOnce(new Error('API Error'));
      ChatGoogleGenerativeAI.mockImplementationOnce(() => ({
        invoke: mockInvoke,
      }));

      const fullContent = `<mention data-child-id="${sampleEncryptedToken1}">@田中太郎</mention>くんが遊びました。`;
      const childId = 'child-id-1';

      await expect(
        extractChildContent(fullContent, childId, sampleEncryptedToken1)
      ).rejects.toThrow('API Error');
    });
  });

  describe('トークンの正規表現エスケープ', () => {
    it('特殊文字を含むトークンでも正しく処理すること', async () => {
      const specialToken = 'token+with/special=chars';
      const fullContent = `<mention data-child-id="${specialToken}">@田中太郎</mention>くんが遊びました。`;
      const childId = 'child-id-1';

      // エラーをスローしないこと
      const result = await extractChildContent(fullContent, childId, specialToken);

      expect(result).toBeDefined();
    });
  });
});
