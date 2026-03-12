-- 活動記録写真用のprivateバケットを作成
-- パス構造: {facility_id}/{activity_date}/{file_id}.{ext}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'private-activity-photos',
  'private-activity-photos',
  false,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLSポリシー: 認証済みユーザーが自施設のデータのみ操作可能
-- パスの先頭セグメントがfacility_idなので、それを使ってアクセス制御

-- INSERT: 自施設のパスにのみアップロード可能
CREATE POLICY "staff_insert_own_facility_photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'private-activity-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT uf.facility_id::text
    FROM _user_facility uf
    WHERE uf.user_id = auth.uid()
  )
);

-- SELECT: 自施設の写真のみ閲覧可能
CREATE POLICY "staff_select_own_facility_photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'private-activity-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT uf.facility_id::text
    FROM _user_facility uf
    WHERE uf.user_id = auth.uid()
  )
);

-- DELETE: 自施設の写真のみ削除可能
CREATE POLICY "staff_delete_own_facility_photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'private-activity-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT uf.facility_id::text
    FROM _user_facility uf
    WHERE uf.user_id = auth.uid()
  )
);
