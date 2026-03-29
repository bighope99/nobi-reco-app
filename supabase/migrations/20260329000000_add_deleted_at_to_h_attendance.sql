-- h_attendance にソフトデリート用の deleted_at カラムを追加
-- 登所取り消し時に物理削除ではなく論理削除を行うため
ALTER TABLE h_attendance
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- deleted_at が NULL のレコードのみを対象とするインデックス
-- 大半のクエリは有効レコードのみを参照するため、部分インデックスで効率化
CREATE INDEX idx_h_attendance_deleted_at
ON h_attendance (deleted_at)
WHERE deleted_at IS NULL;
