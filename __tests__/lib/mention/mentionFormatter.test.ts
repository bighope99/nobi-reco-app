import {
  convertToPlaceholders,
  convertToDisplayNames,
  extractChildIdsFromContent,
  buildIdToNameMap,
  buildNameToIdMap,
} from '@/lib/mention/mentionFormatter';

describe('mentionFormatter', () => {
  const mockChildren = [
    {
      child_id: '123e4567-e89b-12d3-a456-426614174000',
      display_name: '田中太郎',
    },
    {
      child_id: '223e4567-e89b-12d3-a456-426614174001',
      display_name: '山田花子',
    },
    {
      child_id: '323e4567-e89b-12d3-a456-426614174002',
      display_name: '佐藤一郎',
    },
  ];

  describe('convertToPlaceholders', () => {
    it('should convert display names to placeholders', () => {
      const content = '今日は@田中太郎 と @山田花子 が元気でした';
      const nameToIdMap = new Map([
        ['田中太郎', '123e4567-e89b-12d3-a456-426614174000'],
        ['山田花子', '223e4567-e89b-12d3-a456-426614174001'],
      ]);

      const result = convertToPlaceholders(content, nameToIdMap);

      expect(result).toBe(
        '今日は@[123e4567-e89b-12d3-a456-426614174000] と @[223e4567-e89b-12d3-a456-426614174001] が元気でした'
      );
    });

    it('should return original content when nameToIdMap is empty', () => {
      const content = '今日は@田中太郎くんが元気でした';
      const result = convertToPlaceholders(content, new Map());
      expect(result).toBe(content);
    });

    it('should preserve names not in the map', () => {
      const content = '@田中太郎 と @未登録者 が遊びました';
      const nameToIdMap = new Map([
        ['田中太郎', '123e4567-e89b-12d3-a456-426614174000'],
      ]);

      const result = convertToPlaceholders(content, nameToIdMap);

      expect(result).toContain('@[123e4567-e89b-12d3-a456-426614174000]');
      expect(result).toContain('@未登録者');
    });

    it('should handle empty content', () => {
      const nameToIdMap = new Map([
        ['田中太郎', '123e4567-e89b-12d3-a456-426614174000'],
      ]);
      const result = convertToPlaceholders('', nameToIdMap);
      expect(result).toBe('');
    });

    it('should handle content with no mentions', () => {
      const content = '今日はみんな元気でした';
      const nameToIdMap = new Map([
        ['田中太郎', '123e4567-e89b-12d3-a456-426614174000'],
      ]);

      const result = convertToPlaceholders(content, nameToIdMap);
      expect(result).toBe(content);
    });

    it('should handle multiple mentions of same person', () => {
      const content = '@田中太郎 と @田中太郎 が遊びました';
      const nameToIdMap = new Map([
        ['田中太郎', '123e4567-e89b-12d3-a456-426614174000'],
      ]);

      const result = convertToPlaceholders(content, nameToIdMap);

      expect(result).toBe(
        '@[123e4567-e89b-12d3-a456-426614174000] と @[123e4567-e89b-12d3-a456-426614174000] が遊びました'
      );
    });

    it('should handle display names with honorifics in map', () => {
      const content = '@田中太郎くん と @山田花子さん と @佐藤一郎ちゃん';
      const nameToIdMap = new Map([
        ['田中太郎くん', '123e4567-e89b-12d3-a456-426614174000'],
        ['山田花子さん', '223e4567-e89b-12d3-a456-426614174001'],
        ['佐藤一郎ちゃん', '323e4567-e89b-12d3-a456-426614174002'],
      ]);

      const result = convertToPlaceholders(content, nameToIdMap);

      expect(result).toBe(
        '@[123e4567-e89b-12d3-a456-426614174000] と @[223e4567-e89b-12d3-a456-426614174001] と @[323e4567-e89b-12d3-a456-426614174002]'
      );
    });
  });

  describe('convertToDisplayNames', () => {
    it('should convert placeholders to display names', () => {
      const content =
        '今日は@[123e4567-e89b-12d3-a456-426614174000]くんが元気でした';
      const idToNameMap = new Map([
        ['123e4567-e89b-12d3-a456-426614174000', '田中太郎'],
      ]);

      const result = convertToDisplayNames(content, idToNameMap);
      expect(result).toBe('今日は@田中太郎くんが元気でした');
    });

    it('should preserve placeholders not in the map', () => {
      const content =
        '今日は@[unknown-uuid-000000000000000000000000]くんが元気でした';
      const idToNameMap = new Map();

      const result = convertToDisplayNames(content, idToNameMap);
      expect(result).toBe(content);
    });

    it('should return original content when idToNameMap is empty', () => {
      const content =
        '今日は@[123e4567-e89b-12d3-a456-426614174000]くんが元気でした';
      const result = convertToDisplayNames(content, new Map());
      expect(result).toBe(content);
    });

    it('should handle empty content', () => {
      const idToNameMap = new Map([
        ['123e4567-e89b-12d3-a456-426614174000', '田中太郎'],
      ]);
      const result = convertToDisplayNames('', idToNameMap);
      expect(result).toBe('');
    });

    it('should handle content with no placeholders', () => {
      const content = '今日はみんな元気でした';
      const idToNameMap = new Map([
        ['123e4567-e89b-12d3-a456-426614174000', '田中太郎'],
      ]);

      const result = convertToDisplayNames(content, idToNameMap);
      expect(result).toBe(content);
    });

    it('should handle multiple placeholders', () => {
      const content =
        '@[123e4567-e89b-12d3-a456-426614174000]と@[223e4567-e89b-12d3-a456-426614174001]が遊びました';
      const idToNameMap = new Map([
        ['123e4567-e89b-12d3-a456-426614174000', '田中太郎'],
        ['223e4567-e89b-12d3-a456-426614174001', '山田花子'],
      ]);

      const result = convertToDisplayNames(content, idToNameMap);
      expect(result).toBe('@田中太郎と@山田花子が遊びました');
    });

    it('should handle mixed placeholders (some in map, some not)', () => {
      const content =
        '@[123e4567-e89b-12d3-a456-426614174000]と@[unknown-uuid-000000000000000000000000]が遊びました';
      const idToNameMap = new Map([
        ['123e4567-e89b-12d3-a456-426614174000', '田中太郎'],
      ]);

      const result = convertToDisplayNames(content, idToNameMap);
      expect(result).toBe(
        '@田中太郎と@[unknown-uuid-000000000000000000000000]が遊びました'
      );
    });
  });

  describe('extractChildIdsFromContent', () => {
    it('should extract child IDs from placeholders', () => {
      const content =
        '@[123e4567-e89b-12d3-a456-426614174000]と@[223e4567-e89b-12d3-a456-426614174001]が遊びました';

      const result = extractChildIdsFromContent(content);

      expect(result).toHaveLength(2);
      expect(result).toContain('123e4567-e89b-12d3-a456-426614174000');
      expect(result).toContain('223e4567-e89b-12d3-a456-426614174001');
    });

    it('should return empty array for empty content', () => {
      const result = extractChildIdsFromContent('');
      expect(result).toEqual([]);
    });

    it('should return empty array for content with no placeholders', () => {
      const content = '今日はみんな元気でした';
      const result = extractChildIdsFromContent(content);
      expect(result).toEqual([]);
    });

    it('should remove duplicate IDs', () => {
      const content =
        '@[123e4567-e89b-12d3-a456-426614174000]と@[123e4567-e89b-12d3-a456-426614174000]が遊びました';

      const result = extractChildIdsFromContent(content);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should extract multiple unique IDs with duplicates', () => {
      const content =
        '@[123e4567-e89b-12d3-a456-426614174000]、@[223e4567-e89b-12d3-a456-426614174001]、@[123e4567-e89b-12d3-a456-426614174000]が遊びました';

      const result = extractChildIdsFromContent(content);

      expect(result).toHaveLength(2);
      expect(result).toContain('123e4567-e89b-12d3-a456-426614174000');
      expect(result).toContain('223e4567-e89b-12d3-a456-426614174001');
    });

    it('should only extract valid UUID format (36 characters)', () => {
      const content =
        '@[123e4567-e89b-12d3-a456-426614174000]と@[invalid]が遊びました';

      const result = extractChildIdsFromContent(content);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should handle null content gracefully', () => {
      const result = extractChildIdsFromContent(null as any);
      expect(result).toEqual([]);
    });

    it('should handle undefined content gracefully', () => {
      const result = extractChildIdsFromContent(undefined as any);
      expect(result).toEqual([]);
    });
  });

  describe('buildIdToNameMap', () => {
    it('should build ID to display name map', () => {
      const result = buildIdToNameMap(mockChildren);

      expect(result.size).toBe(3);
      expect(result.get('123e4567-e89b-12d3-a456-426614174000')).toBe(
        '田中太郎'
      );
      expect(result.get('223e4567-e89b-12d3-a456-426614174001')).toBe(
        '山田花子'
      );
      expect(result.get('323e4567-e89b-12d3-a456-426614174002')).toBe(
        '佐藤一郎'
      );
    });

    it('should return empty map for empty array', () => {
      const result = buildIdToNameMap([]);
      expect(result.size).toBe(0);
    });

    it('should handle single child', () => {
      const result = buildIdToNameMap([mockChildren[0]]);

      expect(result.size).toBe(1);
      expect(result.get('123e4567-e89b-12d3-a456-426614174000')).toBe(
        '田中太郎'
      );
    });

    it('should handle duplicate child_ids (last one wins)', () => {
      const childrenWithDuplicates = [
        {
          child_id: '123e4567-e89b-12d3-a456-426614174000',
          display_name: '田中太郎',
        },
        {
          child_id: '123e4567-e89b-12d3-a456-426614174000',
          display_name: '田中次郎',
        },
      ];

      const result = buildIdToNameMap(childrenWithDuplicates);

      expect(result.size).toBe(1);
      expect(result.get('123e4567-e89b-12d3-a456-426614174000')).toBe(
        '田中次郎'
      );
    });
  });

  describe('buildNameToIdMap', () => {
    it('should build display name to ID map', () => {
      const result = buildNameToIdMap(mockChildren);

      expect(result.size).toBe(3);
      expect(result.get('田中太郎')).toBe(
        '123e4567-e89b-12d3-a456-426614174000'
      );
      expect(result.get('山田花子')).toBe(
        '223e4567-e89b-12d3-a456-426614174001'
      );
      expect(result.get('佐藤一郎')).toBe(
        '323e4567-e89b-12d3-a456-426614174002'
      );
    });

    it('should return empty map for empty array', () => {
      const result = buildNameToIdMap([]);
      expect(result.size).toBe(0);
    });

    it('should handle single child', () => {
      const result = buildNameToIdMap([mockChildren[0]]);

      expect(result.size).toBe(1);
      expect(result.get('田中太郎')).toBe(
        '123e4567-e89b-12d3-a456-426614174000'
      );
    });

    it('should handle duplicate display_names (last one wins)', () => {
      const childrenWithDuplicates = [
        {
          child_id: '123e4567-e89b-12d3-a456-426614174000',
          display_name: '田中太郎',
        },
        {
          child_id: '223e4567-e89b-12d3-a456-426614174001',
          display_name: '田中太郎',
        },
      ];

      const result = buildNameToIdMap(childrenWithDuplicates);

      expect(result.size).toBe(1);
      expect(result.get('田中太郎')).toBe(
        '223e4567-e89b-12d3-a456-426614174001'
      );
    });
  });

  describe('Round-trip conversion', () => {
    it('should preserve content through placeholder conversion and back', () => {
      const originalContent = '今日は@田中太郎 と @山田花子 が元気でした';
      const nameToIdMap = buildNameToIdMap(mockChildren);
      const idToNameMap = buildIdToNameMap(mockChildren);

      // Convert to placeholders
      const withPlaceholders = convertToPlaceholders(
        originalContent,
        nameToIdMap
      );

      // Convert back to display names
      const backToDisplay = convertToDisplayNames(
        withPlaceholders,
        idToNameMap
      );

      expect(backToDisplay).toBe(originalContent);
    });

    it('should maintain data integrity through multiple conversions', () => {
      const content = '@田中太郎、@山田花子、@佐藤一郎';
      const nameToIdMap = buildNameToIdMap(mockChildren);
      const idToNameMap = buildIdToNameMap(mockChildren);

      // First round trip
      const placeholder1 = convertToPlaceholders(content, nameToIdMap);
      const display1 = convertToDisplayNames(placeholder1, idToNameMap);

      // Second round trip
      const placeholder2 = convertToPlaceholders(display1, nameToIdMap);
      const display2 = convertToDisplayNames(placeholder2, idToNameMap);

      expect(display1).toBe(content);
      expect(display2).toBe(content);
      expect(placeholder1).toBe(placeholder2);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle special characters in display names', () => {
      const children = [
        {
          child_id: '123e4567-e89b-12d3-a456-426614174000',
          display_name: '田中-太郎',
        },
      ];
      const nameToIdMap = buildNameToIdMap(children);

      const content = '@田中-太郎 くん';
      const result = convertToPlaceholders(content, nameToIdMap);

      expect(result).toBe('@[123e4567-e89b-12d3-a456-426614174000] くん');
    });

    it('should handle content with line breaks', () => {
      const content =
        '今日は@田中太郎 が元気でした。\n明日も@山田花子 と遊びます。';
      const nameToIdMap = new Map([
        ['田中太郎', '123e4567-e89b-12d3-a456-426614174000'],
        ['山田花子', '223e4567-e89b-12d3-a456-426614174001'],
      ]);

      const result = convertToPlaceholders(content, nameToIdMap);

      expect(result).toBe(
        '今日は@[123e4567-e89b-12d3-a456-426614174000] が元気でした。\n明日も@[223e4567-e89b-12d3-a456-426614174001] と遊びます。'
      );
    });

    it('should handle very long content with many mentions', () => {
      const nameToIdMap = buildNameToIdMap(mockChildren);
      const mentions = Array(100)
        .fill('@田中太郎 ')
        .join('');

      const result = convertToPlaceholders(mentions, nameToIdMap);

      const extractedIds = extractChildIdsFromContent(result);
      expect(extractedIds).toHaveLength(1);
      expect(extractedIds[0]).toBe('123e4567-e89b-12d3-a456-426614174000');
    });
  });
});
