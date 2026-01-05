import { encryptChildId, decryptChildId } from '@/utils/crypto/childIdEncryption';

describe('childIdEncryption', () => {
  const validChildId = '550e8400-e29b-41d4-a716-446655440000'; // UUID v4 format

  describe('encryptChildId', () => {
    it('暗号化されたトークンを返すこと', () => {
      const encrypted = encryptChildId(validChildId);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('同じIDでも毎回異なる暗号化トークンを生成すること（IV使用のため）', () => {
      const encrypted1 = encryptChildId(validChildId);
      const encrypted2 = encryptChildId(validChildId);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('URL-safeなBase64形式で返すこと（+/= を含まない）', () => {
      const encrypted = encryptChildId(validChildId);

      expect(encrypted).not.toMatch(/[+/=]/);
    });

    it('空文字列を暗号化できること', () => {
      const encrypted = encryptChildId('');

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });
  });

  describe('decryptChildId', () => {
    it('暗号化されたトークンを正しく復号化すること', () => {
      const encrypted = encryptChildId(validChildId);
      const decrypted = decryptChildId(encrypted);

      expect(decrypted).toBe(validChildId);
    });

    it('複数回暗号化・復号化しても元の値に戻ること', () => {
      const encrypted1 = encryptChildId(validChildId);
      const decrypted1 = decryptChildId(encrypted1);

      const encrypted2 = encryptChildId(decrypted1!);
      const decrypted2 = decryptChildId(encrypted2);

      expect(decrypted2).toBe(validChildId);
    });

    it('不正なトークンの場合nullを返すこと', () => {
      const decrypted = decryptChildId('invalid_token');

      expect(decrypted).toBeNull();
    });

    it('空文字列の場合nullを返すこと', () => {
      const decrypted = decryptChildId('');

      expect(decrypted).toBeNull();
    });

    it('改ざんされたトークンの場合nullを返すこと', () => {
      const encrypted = encryptChildId(validChildId);
      const tampered = encrypted.slice(0, -5) + 'XXXXX';
      const decrypted = decryptChildId(tampered);

      expect(decrypted).toBeNull();
    });

    it('Base64形式が不正な場合nullを返すこと', () => {
      const decrypted = decryptChildId('not-valid-base64!!!');

      expect(decrypted).toBeNull();
    });
  });

  describe('ラウンドトリップテスト', () => {
    const testCases = [
      { name: 'UUID形式の子供ID', value: '550e8400-e29b-41d4-a716-446655440000' },
      { name: '日本語を含む文字列', value: '田中太郎_abc123' },
      { name: '長い文字列', value: 'a'.repeat(1000) },
      { name: '特殊文字を含む文字列', value: '!@#$%^&*()_+-=[]{}|;:\'",.<>?/' },
      { name: 'UTF-8マルチバイト文字', value: '🎌🎍🎎🎏' },
    ];

    testCases.forEach(({ name, value }) => {
      it(`${name}: ${value.substring(0, 50)}... を正しく暗号化・復号化できること`, () => {
        const encrypted = encryptChildId(value);
        const decrypted = decryptChildId(encrypted);

        expect(decrypted).toBe(value);
      });
    });
  });

  describe('セキュリティテスト', () => {
    it('暗号化トークンから元のIDを推測できないこと', () => {
      const encrypted = encryptChildId(validChildId);

      // Base64デコードしても元のIDは含まれていない
      const decoded = Buffer.from(encrypted, 'base64url').toString('utf8');
      expect(decoded).not.toContain(validChildId);
    });

    it('同じIDでも異なるIVにより異なるトークンになること', () => {
      const encrypted1 = encryptChildId(validChildId);
      const encrypted2 = encryptChildId(validChildId);
      const encrypted3 = encryptChildId(validChildId);

      const tokens = [encrypted1, encrypted2, encrypted3];
      const uniqueTokens = new Set(tokens);

      expect(uniqueTokens.size).toBe(3);
    });
  });

  describe('エラーハンドリング', () => {
    it('CHILD_ID_ENCRYPTION_KEYが設定されていない場合エラーをスローすること', () => {
      const originalKey = process.env.CHILD_ID_ENCRYPTION_KEY;
      delete process.env.CHILD_ID_ENCRYPTION_KEY;

      expect(() => {
        encryptChildId(validChildId);
      }).toThrow();

      process.env.CHILD_ID_ENCRYPTION_KEY = originalKey;
    });

    it('CHILD_ID_ENCRYPTION_KEYが不正な長さの場合エラーをスローすること', () => {
      const originalKey = process.env.CHILD_ID_ENCRYPTION_KEY;
      process.env.CHILD_ID_ENCRYPTION_KEY = 'short_key'; // 32 bytes未満

      expect(() => {
        encryptChildId(validChildId);
      }).toThrow();

      process.env.CHILD_ID_ENCRYPTION_KEY = originalKey;
    });
  });

  describe('パフォーマンステスト', () => {
    it('1000回の暗号化・復号化が妥当な時間で完了すること', () => {
      const iterations = 1000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const encrypted = encryptChildId(validChildId);
        const decrypted = decryptChildId(encrypted);
        expect(decrypted).toBe(validChildId);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 1000回で5秒以内（妥当な範囲）
      expect(duration).toBeLessThan(5000);
    });
  });
});
