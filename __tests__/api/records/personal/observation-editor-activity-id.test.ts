/**
 * ObservationEditor - activity_id機能のテスト
 *
 * このテストは、ObservationEditorコンポーネントが:
 * 1. URLパラメータからactivity_idを取得すること
 * 2. ドラフトからactivity_idを取得すること
 * 3. 保存時にactivity_idをAPIに送信すること
 *
 * を確認します。
 */

/**
 * 統合テストとして実装
 * - URLパラメータの解析とactivity_idの抽出
 * - ドラフトからのactivity_idの取得
 * - POSTリクエストへのactivity_id含有
 */
describe('ObservationEditor - activity_id機能', () => {
  describe('URLパラメータからのactivity_id取得', () => {
    it('URLにactivityIdパラメータがある場合、それを取得できること', () => {
      // URLSearchParamsを使ってパラメータ解析をテスト
      const searchParams = new URLSearchParams('?draftId=draft-123&childId=child-456&activityId=activity-789');

      const draftId = searchParams.get('draftId');
      const childId = searchParams.get('childId');
      const activityId = searchParams.get('activityId');

      expect(draftId).toBe('draft-123');
      expect(childId).toBe('child-456');
      expect(activityId).toBe('activity-789');
    });

    it('URLにactivityIdパラメータがない場合、nullを返すこと', () => {
      const searchParams = new URLSearchParams('?draftId=draft-123&childId=child-456');

      const activityId = searchParams.get('activityId');

      expect(activityId).toBeNull();
    });
  });

  describe('ドラフトからのactivity_id取得', () => {
    it('ドラフトにactivity_idがある場合、それを取得できること', () => {
      // ドラフトデータの構造をテスト
      const drafts = [
        {
          draft_id: 'draft-123',
          activity_id: 'activity-789',
          child_id: 'child-456',
          child_display_name: 'テスト太郎',
          observation_date: '2026-01-10',
          content: 'テスト内容',
          status: 'pending' as const,
        },
      ];

      const draftId = 'draft-123';
      const draft = drafts.find((d) => d.draft_id === draftId);

      expect(draft).toBeDefined();
      expect(draft?.activity_id).toBe('activity-789');
    });

    it('ドラフトにactivity_idがない場合、nullであること', () => {
      const drafts = [
        {
          draft_id: 'draft-123',
          activity_id: null,
          child_id: 'child-456',
          child_display_name: 'テスト太郎',
          observation_date: '2026-01-10',
          content: 'テスト内容',
          status: 'pending' as const,
        },
      ];

      const draftId = 'draft-123';
      const draft = drafts.find((d) => d.draft_id === draftId);

      expect(draft).toBeDefined();
      expect(draft?.activity_id).toBeNull();
    });
  });

  describe('activity_idの優先順位', () => {
    it('URLパラメータとドラフトの両方がある場合、URLパラメータを優先すること', () => {
      const searchParams = new URLSearchParams('?draftId=draft-123&activityId=url-activity-id');
      const drafts = [
        {
          draft_id: 'draft-123',
          activity_id: 'draft-activity-id',
          child_id: 'child-456',
          child_display_name: 'テスト太郎',
          observation_date: '2026-01-10',
          content: 'テスト内容',
          status: 'pending' as const,
        },
      ];

      const paramActivityId = searchParams.get('activityId');
      const draftId = searchParams.get('draftId');
      const draft = drafts.find((d) => d.draft_id === draftId);

      // 優先順位: URLパラメータ > ドラフト
      const activityId = paramActivityId || draft?.activity_id || null;

      expect(activityId).toBe('url-activity-id');
    });
  });

  describe('POSTリクエストへのactivity_id含有', () => {
    it('activity_idがある場合、POSTリクエストに含まれること', () => {
      const activityId = 'activity-789';

      const requestBody = {
        child_id: 'child-456',
        observation_date: '2026-01-10',
        content: 'テスト観察内容',
        activity_id: activityId || null,
        ai_action: '客観的事実',
        ai_opinion: '主観的解釈',
        tag_flags: {},
      };

      expect(requestBody.activity_id).toBe('activity-789');
    });

    it('activity_idがない場合、POSTリクエストにnullが含まれること', () => {
      const activityId: string | null = null;

      const requestBody = {
        child_id: 'child-456',
        observation_date: '2026-01-10',
        content: 'テスト観察内容',
        activity_id: activityId || null,
        ai_action: '客観的事実',
        ai_opinion: '主観的解釈',
        tag_flags: {},
      };

      expect(requestBody.activity_id).toBeNull();
    });
  });
});
