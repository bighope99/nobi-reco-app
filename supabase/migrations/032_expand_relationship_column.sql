-- _child_guardian.relationship を VARCHAR(20) から VARCHAR(50) に拡張
-- 自由入力対応（例: 叔母、叔父、ファミサポ、里親 等）
ALTER TABLE _child_guardian ALTER COLUMN relationship TYPE VARCHAR(50);
COMMENT ON COLUMN _child_guardian.relationship IS '続柄（自由入力、最大50文字）例: 母/父/祖母/祖父/その他';
