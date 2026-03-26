-- private-child-photos バケット作成
-- 子どもの顔写真を施設スコープで管理するプライベートバケット

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'private-child-photos',
  'private-child-photos',
  false,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLSポリシー: 施設スコープのスタッフアクセス制限
-- パス構造: {facility_id}/children/{child_id}.{ext}
-- facility_id プレフィックスで施設間のアクセスを分離

CREATE POLICY "Facility staff can read child photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'private-child-photos'
  AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'current_facility_id')
);

CREATE POLICY "Facility staff can upload child photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'private-child-photos'
  AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'current_facility_id')
);

CREATE POLICY "Facility staff can update child photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'private-child-photos'
  AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'current_facility_id')
)
WITH CHECK (
  bucket_id = 'private-child-photos'
  AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'current_facility_id')
);

CREATE POLICY "Facility staff can delete child photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'private-child-photos'
  AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'current_facility_id')
);
