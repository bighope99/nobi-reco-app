import {
  encryptPII,
  decryptPII,
  generateSearchHash,
  normalizeNameForSearch,
} from '@/utils/crypto/piiEncryption';

describe('piiEncryption', () => {
  const validPlaintext = '09012345678'; // 日本の電話番号形式

  describe('encryptPII', () => {
    describe('正常系 - Happy Path', () => {
      it('通常の文字列を暗号化して非nullの文字列を返すこと', () => {
        const encrypted = encryptPII(validPlaintext);

        expect(encrypted).toBeDefined();
        expect(typeof encrypted).toBe('string');
        expect(encrypted).not.toBeNull();
        expect(encrypted!.length).toBeGreaterThan(0);
      });

      it('日本語/Unicode文字を正しく暗号化できること', () => {
        const japaneseName = '田中太郎';
        const encrypted = encryptPII(japaneseName);

        expect(encrypted).toBeDefined();
        expect(typeof encrypted).toBe('string');
        expect(encrypted).not.toBeNull();
      });

      it('URL-safeなBase64url形式で返すこと（+/= を含まない）', () => {
        const encrypted = encryptPII(validPlaintext);

        expect(encrypted).not.toBeNull();
        expect(encrypted).not.toMatch(/[+/=]/);
      });

      it('暗号化結果が元の文字列と異なることを確認', () => {
        const encrypted = encryptPII(validPlaintext);

        expect(encrypted).not.toBe(validPlaintext);
      });

      it('同じ入力でも毎回異なる暗号文を生成すること（IV使用のため）', () => {
        const encrypted1 = encryptPII(validPlaintext);
        const encrypted2 = encryptPII(validPlaintext);

        expect(encrypted1).not.toBe(encrypted2);
      });
    });

    describe('エッジケース - Edge Cases', () => {
      it('null入力の場合nullを返すこと', () => {
        const encrypted = encryptPII(null);

        expect(encrypted).toBeNull();
      });

      it('undefined入力の場合nullを返すこと', () => {
        const encrypted = encryptPII(undefined);

        expect(encrypted).toBeNull();
      });

      it('空文字列の場合nullを返すこと', () => {
        const encrypted = encryptPII('');

        expect(encrypted).toBeNull();
      });

      it('空白のみの文字列の場合nullを返すこと', () => {
        const encrypted = encryptPII('   ');

        expect(encrypted).toBeNull();
      });

      it('長い文字列を正しく暗号化できること', () => {
        const longText = 'a'.repeat(10000);
        const encrypted = encryptPII(longText);

        expect(encrypted).not.toBeNull();
        expect(typeof encrypted).toBe('string');
      });

      it('特殊文字を含む文字列を正しく暗号化できること', () => {
        const specialChars = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/';
        const encrypted = encryptPII(specialChars);

        expect(encrypted).not.toBeNull();
        expect(typeof encrypted).toBe('string');
      });

      it('UTF-8マルチバイト文字（絵文字など）を正しく暗号化できること', () => {
        const emoji = '🎌🎍🎎🎏';
        const encrypted = encryptPII(emoji);

        expect(encrypted).not.toBeNull();
        expect(typeof encrypted).toBe('string');
      });
    });

    describe('環境変数エラー', () => {
      it('PII_ENCRYPTION_KEYが未設定の場合エラーをスローすること', () => {
        const originalKey = process.env.PII_ENCRYPTION_KEY;
        delete process.env.PII_ENCRYPTION_KEY;

        expect(() => {
          encryptPII(validPlaintext);
        }).toThrow('PII_ENCRYPTION_KEY is not defined in environment variables');

        process.env.PII_ENCRYPTION_KEY = originalKey;
      });

      it('PII_ENCRYPTION_KEYが不正な長さの場合エラーをスローすること', () => {
        const originalKey = process.env.PII_ENCRYPTION_KEY;
        process.env.PII_ENCRYPTION_KEY = 'short_key'; // 32 bytes未満

        expect(() => {
          encryptPII(validPlaintext);
        }).toThrow(/must be 64 hex characters/);

        process.env.PII_ENCRYPTION_KEY = originalKey;
      });
    });
  });

  describe('decryptPII', () => {
    describe('正常系 - Happy Path', () => {
      it('正しい暗号文を元の平文に復号できること', () => {
        const encrypted = encryptPII(validPlaintext);
        const decrypted = decryptPII(encrypted);

        expect(decrypted).toBe(validPlaintext);
      });

      it('日本語を含む暗号文を正しく復号できること', () => {
        const japaneseName = '田中太郎';
        const encrypted = encryptPII(japaneseName);
        const decrypted = decryptPII(encrypted);

        expect(decrypted).toBe(japaneseName);
      });

      it('複数回暗号化・復号化しても元の値に戻ること', () => {
        const encrypted1 = encryptPII(validPlaintext);
        const decrypted1 = decryptPII(encrypted1);

        const encrypted2 = encryptPII(decrypted1!);
        const decrypted2 = decryptPII(encrypted2);

        expect(decrypted2).toBe(validPlaintext);
      });

      it('特殊文字を含む文字列を正しく復号できること', () => {
        const specialChars = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/';
        const encrypted = encryptPII(specialChars);
        const decrypted = decryptPII(encrypted);

        expect(decrypted).toBe(specialChars);
      });
    });

    describe('レガシー形式のサポート', () => {
      it('レガシー形式（hex:hex:hex）の暗号文を復号できること', () => {
        // レガシー形式の暗号化をシミュレート
        const crypto = require('crypto');
        const key = Buffer.from(process.env.PII_ENCRYPTION_KEY!, 'hex');
        const iv = crypto.randomBytes(16); // Legacy IV length
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        let encrypted = cipher.update(validPlaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();

        const legacyFormat = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
        const encodedLegacy = Buffer.from(legacyFormat, 'utf8').toString('base64url');

        const decrypted = decryptPII(encodedLegacy);

        expect(decrypted).toBe(validPlaintext);
      });
    });

    describe('エッジケース - Edge Cases', () => {
      it('null入力の場合nullを返すこと', () => {
        const decrypted = decryptPII(null);

        expect(decrypted).toBeNull();
      });

      it('undefined入力の場合nullを返すこと', () => {
        const decrypted = decryptPII(undefined);

        expect(decrypted).toBeNull();
      });

      it('空文字列の場合nullを返すこと', () => {
        const decrypted = decryptPII('');

        expect(decrypted).toBeNull();
      });

      it('空白のみの文字列の場合nullを返すこと', () => {
        const decrypted = decryptPII('   ');

        expect(decrypted).toBeNull();
      });
    });

    describe('エラーハンドリング - Error Cases', () => {
      it('不正な形式の文字列の場合nullを返すこと（エラーをスローしない）', () => {
        const decrypted = decryptPII('invalid_base64url');

        expect(decrypted).toBeNull();
      });

      it('改ざんされた暗号文の場合nullを返すこと', () => {
        const encrypted = encryptPII(validPlaintext);
        const tampered = encrypted!.slice(0, -5) + 'XXXXX';
        const decrypted = decryptPII(tampered);

        expect(decrypted).toBeNull();
      });

      it('Base64形式が不正な場合nullを返すこと', () => {
        const decrypted = decryptPII('not-valid-base64!!!');

        expect(decrypted).toBeNull();
      });

      it('データ長が不足している場合nullを返すこと', () => {
        // IV(12) + AuthTag(12) = 24バイト未満のデータ
        const shortData = Buffer.from('short', 'utf8').toString('base64url');
        const decrypted = decryptPII(shortData);

        expect(decrypted).toBeNull();
      });

      it('平文データ（暗号化されていないデータ）の場合nullを返すこと', () => {
        const plainData = Buffer.from('plain_text_not_encrypted', 'utf8').toString('base64url');
        const decrypted = decryptPII(plainData);

        expect(decrypted).toBeNull();
      });
    });

    describe('環境変数エラー', () => {
      it('PII_ENCRYPTION_KEYが未設定の場合nullを返すこと（復号化はエラーをスローしない）', () => {
        const encrypted = encryptPII(validPlaintext);
        const originalKey = process.env.PII_ENCRYPTION_KEY;
        delete process.env.PII_ENCRYPTION_KEY;

        const decrypted = decryptPII(encrypted);

        expect(decrypted).toBeNull();

        process.env.PII_ENCRYPTION_KEY = originalKey;
      });
    });
  });

  describe('generateSearchHash', () => {
    describe('正常系 - Happy Path', () => {
      it('通常の文字列からSHA-256ハッシュを生成すること', () => {
        const hash = generateSearchHash(validPlaintext);

        expect(hash).toBeDefined();
        expect(typeof hash).toBe('string');
        expect(hash).not.toBeNull();
        expect(hash!.length).toBe(64); // SHA-256 = 64 hex chars
      });

      it('16進数文字列形式であることを確認', () => {
        const hash = generateSearchHash(validPlaintext);

        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      });

      it('同じ入力に対して常に同じハッシュを生成すること（一貫性）', () => {
        const hash1 = generateSearchHash(validPlaintext);
        const hash2 = generateSearchHash(validPlaintext);
        const hash3 = generateSearchHash(validPlaintext);

        expect(hash1).toBe(hash2);
        expect(hash2).toBe(hash3);
      });

      it('異なる入力に対して異なるハッシュを生成すること', () => {
        const hash1 = generateSearchHash('09012345678');
        const hash2 = generateSearchHash('09087654321');

        expect(hash1).not.toBe(hash2);
      });

      it('日本語文字列のハッシュを生成できること', () => {
        const hash = generateSearchHash('田中太郎');

        expect(hash).not.toBeNull();
        expect(hash!.length).toBe(64);
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      });
    });

    describe('エッジケース - Edge Cases', () => {
      it('null入力の場合nullを返すこと', () => {
        const hash = generateSearchHash(null);

        expect(hash).toBeNull();
      });

      it('undefined入力の場合nullを返すこと', () => {
        const hash = generateSearchHash(undefined);

        expect(hash).toBeNull();
      });

      it('空文字列の場合nullを返すこと', () => {
        const hash = generateSearchHash('');

        expect(hash).toBeNull();
      });

      it('空白のみの文字列の場合nullを返すこと', () => {
        const hash = generateSearchHash('   ');

        expect(hash).toBeNull();
      });

      it('長い文字列のハッシュを生成できること', () => {
        const longText = 'a'.repeat(10000);
        const hash = generateSearchHash(longText);

        expect(hash).not.toBeNull();
        expect(hash!.length).toBe(64);
      });
    });

    describe('ハッシュの一意性', () => {
      it('わずかな違いでも異なるハッシュを生成すること', () => {
        const hash1 = generateSearchHash('test');
        const hash2 = generateSearchHash('Test'); // 大文字小文字の違い

        expect(hash1).not.toBe(hash2);
      });

      it('空白の有無で異なるハッシュを生成すること', () => {
        const hash1 = generateSearchHash('田中太郎');
        const hash2 = generateSearchHash('田中 太郎');

        expect(hash1).not.toBe(hash2);
      });
    });
  });

  describe('normalizeNameForSearch', () => {
    describe('正常系 - Happy Path', () => {
      it('全角スペースを削除すること', () => {
        const normalized = normalizeNameForSearch('田中　太郎');

        expect(normalized).toBe('田中太郎');
      });

      it('半角スペースを削除すること', () => {
        const normalized = normalizeNameForSearch('田中 太郎');

        expect(normalized).toBe('田中太郎');
      });

      it('混合スペース（全角・半角）を削除すること', () => {
        const normalized = normalizeNameForSearch('田中　太郎 次郎');

        expect(normalized).toBe('田中太郎次郎');
      });

      it('複数連続スペースを削除すること', () => {
        const normalized = normalizeNameForSearch('田中    太郎');

        expect(normalized).toBe('田中太郎');
      });

      it('先頭・末尾のスペースを削除すること', () => {
        const normalized = normalizeNameForSearch('  田中太郎  ');

        expect(normalized).toBe('田中太郎');
      });

      it('スペースのない文字列はそのまま返すこと', () => {
        const normalized = normalizeNameForSearch('田中太郎');

        expect(normalized).toBe('田中太郎');
      });
    });

    describe('エッジケース - Edge Cases', () => {
      it('null入力の場合nullを返すこと', () => {
        const normalized = normalizeNameForSearch(null);

        expect(normalized).toBeNull();
      });

      it('undefined入力の場合nullを返すこと', () => {
        const normalized = normalizeNameForSearch(undefined);

        expect(normalized).toBeNull();
      });

      it('空文字列の場合nullを返すこと', () => {
        const normalized = normalizeNameForSearch('');

        expect(normalized).toBeNull();
      });

      it('空白のみの文字列の場合nullを返すこと', () => {
        const normalized = normalizeNameForSearch('   ');

        expect(normalized).toBeNull();
      });

      it('全角スペースのみの文字列の場合nullを返すこと', () => {
        const normalized = normalizeNameForSearch('　　　');

        expect(normalized).toBeNull();
      });

      it('混合スペースのみの文字列の場合nullを返すこと', () => {
        const normalized = normalizeNameForSearch('  　  　 ');

        expect(normalized).toBeNull();
      });
    });

    describe('様々な文字種のテスト', () => {
      it('英数字のみの文字列を正しく処理すること', () => {
        const normalized = normalizeNameForSearch('John Doe');

        expect(normalized).toBe('JohnDoe');
      });

      it('カタカナの文字列を正しく処理すること', () => {
        const normalized = normalizeNameForSearch('タナカ　タロウ');

        expect(normalized).toBe('タナカタロウ');
      });

      it('ひらがなの文字列を正しく処理すること', () => {
        const normalized = normalizeNameForSearch('たなか　たろう');

        expect(normalized).toBe('たなかたろう');
      });

      it('漢字・ひらがな・カタカナ混合を正しく処理すること', () => {
        const normalized = normalizeNameForSearch('田中　たろう　タロウ');

        expect(normalized).toBe('田中たろうタロウ');
      });
    });
  });

  describe('ラウンドトリップテスト - 暗号化と復号化の完全性', () => {
    const testCases = [
      { name: '日本の電話番号', value: '09012345678' },
      { name: 'メールアドレス', value: 'test@example.com' },
      { name: '日本語の名前', value: '田中太郎' },
      { name: 'カタカナの名前', value: 'タナカタロウ' },
      { name: 'ひらがなの名前', value: 'たなかたろう' },
      { name: '長い文字列', value: 'a'.repeat(1000) },
      { name: '特殊文字を含む文字列', value: '!@#$%^&*()_+-=[]{}|;:\'",.<>?/' },
      { name: 'UTF-8マルチバイト文字（絵文字）', value: '🎌🎍🎎🎏' },
      { name: '複数行の文字列', value: 'Line1\nLine2\nLine3' },
      { name: 'Unicode制御文字', value: 'test\u0000\u0001\u0002' },
    ];

    testCases.forEach(({ name, value }) => {
      it(`${name}: ${value.substring(0, 50)}... を正しく暗号化・復号化できること`, () => {
        const encrypted = encryptPII(value);
        const decrypted = decryptPII(encrypted);

        expect(decrypted).toBe(value);
      });
    });
  });

  describe('セキュリティテスト', () => {
    it('暗号文から元の平文を推測できないこと', () => {
      const encrypted = encryptPII(validPlaintext);

      // Base64デコードしても元のデータは含まれていない
      const decoded = Buffer.from(encrypted!, 'base64url').toString('utf8');
      expect(decoded).not.toContain(validPlaintext);
    });

    it('同じデータでも異なるIVにより異なる暗号文になること', () => {
      const encrypted1 = encryptPII(validPlaintext);
      const encrypted2 = encryptPII(validPlaintext);
      const encrypted3 = encryptPII(validPlaintext);

      const ciphertexts = [encrypted1, encrypted2, encrypted3];
      const uniqueCiphertexts = new Set(ciphertexts);

      expect(uniqueCiphertexts.size).toBe(3);
    });

    it('改ざん検出: 暗号文の一部を変更すると復号に失敗すること', () => {
      const encrypted = encryptPII(validPlaintext);
      const buffer = Buffer.from(encrypted!, 'base64url');

      // 中間部分のバイトを改ざん
      buffer[20] = buffer[20] ^ 0xFF;

      const tampered = buffer.toString('base64url');
      const decrypted = decryptPII(tampered);

      expect(decrypted).toBeNull();
    });
  });

  describe('パフォーマンステスト', () => {
    it('1000回の暗号化・復号化が妥当な時間で完了すること', () => {
      const iterations = 1000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const encrypted = encryptPII(validPlaintext);
        const decrypted = decryptPII(encrypted);
        expect(decrypted).toBe(validPlaintext);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 1000回で5秒以内（妥当な範囲）
      expect(duration).toBeLessThan(5000);
    });

    it('1000個の異なる値のハッシュ生成が妥当な時間で完了すること', () => {
      const iterations = 1000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const hash = generateSearchHash(`test_value_${i}`);
        expect(hash).not.toBeNull();
        expect(hash!.length).toBe(64);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 1000回で2秒以内（ハッシュは暗号化より高速）
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('統合テスト - 実際のユースケース', () => {
    it('電話番号の暗号化とハッシュ生成の組み合わせ', () => {
      const phoneNumber = '09012345678';

      // 暗号化（保存用）
      const encrypted = encryptPII(phoneNumber);
      expect(encrypted).not.toBeNull();

      // 復号化（表示用）
      const decrypted = decryptPII(encrypted);
      expect(decrypted).toBe(phoneNumber);

      // ハッシュ生成（検索用）
      const hash = generateSearchHash(phoneNumber);
      expect(hash).not.toBeNull();
      expect(hash!.length).toBe(64);

      // 同じ電話番号からは同じハッシュが生成される
      const hash2 = generateSearchHash(phoneNumber);
      expect(hash2).toBe(hash);
    });

    it('名前の正規化とハッシュ生成の組み合わせ', () => {
      const name = '田中　太郎';

      // 正規化
      const normalized = normalizeNameForSearch(name);
      expect(normalized).toBe('田中太郎');

      // 暗号化（元の名前を保存）
      const encrypted = encryptPII(name);
      const decrypted = decryptPII(encrypted);
      expect(decrypted).toBe(name);

      // 正規化された名前のハッシュ生成（検索用）
      const hash = generateSearchHash(normalized!);
      expect(hash).not.toBeNull();

      // スペースの有無に関わらず同じハッシュになる
      const hash2 = generateSearchHash(normalizeNameForSearch('田中太郎')!);
      expect(hash2).toBe(hash);
    });

    it('メールアドレスの暗号化とハッシュ生成の組み合わせ', () => {
      const email = 'test@example.com';

      // 暗号化
      const encrypted = encryptPII(email);
      expect(encrypted).not.toBeNull();

      // 復号化
      const decrypted = decryptPII(encrypted);
      expect(decrypted).toBe(email);

      // ハッシュ生成（一意性検証用）
      const hash = generateSearchHash(email);
      expect(hash).not.toBeNull();

      // 異なるメールアドレスは異なるハッシュ
      const hash2 = generateSearchHash('other@example.com');
      expect(hash2).not.toBe(hash);
    });
  });
});
