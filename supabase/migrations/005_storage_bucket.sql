-- Storage bucket for entry attachments (photo proof, etc.)
-- Run in Supabase Dashboard → SQL Editor

-- Create bucket (idempotent: use INSERT with ON CONFLICT or check)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'entry-attachments',
  'entry-attachments',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  file_size_limit = EXCLUDED.file_size_limit;

-- RLS: users can upload/read/delete only in their own folder (user_id/entry_id/file)
-- Policy names are unique to avoid conflicts with other buckets
DROP POLICY IF EXISTS "WIS users upload entry-attachments" ON storage.objects;
CREATE POLICY "WIS users upload entry-attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'entry-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "WIS users read entry-attachments" ON storage.objects;
CREATE POLICY "WIS users read entry-attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'entry-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "WIS users delete entry-attachments" ON storage.objects;
CREATE POLICY "WIS users delete entry-attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'entry-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
