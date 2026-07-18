-- MiLey Platform - Storage Bucket Policies
-- Security policies for Supabase Storage buckets

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('songs', 'songs', false, 104857600, ARRAY['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg', 'audio/webm']),
  ('covers', 'covers', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('banners', 'banners', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('profiles', 'profiles', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('documents', 'documents', false, 20971520, ARRAY['application/pdf', 'image/jpeg', 'image/png']),
  ('backgrounds', 'backgrounds', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SONGS BUCKET POLICIES
-- ============================================
-- Users can upload to their own folder in songs bucket
CREATE POLICY "Users can upload songs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'songs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view their own songs and public songs
CREATE POLICY "Users can view songs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'songs' AND
    (auth.uid()::text = (storage.foldername(name))[1] OR owner = storage.extension())
  );

-- Users can update their own songs
CREATE POLICY "Users can update their songs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'songs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own songs
CREATE POLICY "Users can delete their songs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'songs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- COVERS BUCKET POLICIES
-- ============================================
-- Authenticated users can upload covers
CREATE POLICY "Users can upload covers"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'covers' AND
    auth.role() = 'authenticated'
  );

-- Everyone can view covers (public bucket)
CREATE POLICY "Everyone can view covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'covers');

-- Users can update their own covers
CREATE POLICY "Users can update their covers"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'covers' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own covers
CREATE POLICY "Users can delete their covers"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'covers' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- BANNERS BUCKET POLICIES
-- ============================================
-- Authenticated users can upload banners
CREATE POLICY "Users can upload banners"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'banners' AND
    auth.role() = 'authenticated'
  );

-- Everyone can view banners (public bucket)
CREATE POLICY "Everyone can view banners"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'banners');

-- Users can update their own banners
CREATE POLICY "Users can update their banners"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'banners' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own banners
CREATE POLICY "Users can delete their banners"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'banners' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- PROFILES BUCKET POLICIES
-- ============================================
-- Authenticated users can upload profile images
CREATE POLICY "Users can upload profile images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'profiles' AND
    auth.role() = 'authenticated'
  );

-- Everyone can view profile images (public bucket)
CREATE POLICY "Everyone can view profile images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profiles');

-- Users can update their own profile images
CREATE POLICY "Users can update their profile images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'profiles' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own profile images
CREATE POLICY "Users can delete their profile images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'profiles' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- DOCUMENTS BUCKET POLICIES
-- ============================================
-- Authenticated users can upload documents
CREATE POLICY "Users can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents' AND
    auth.role() = 'authenticated'
  );

-- Users can view their own documents
CREATE POLICY "Users can view their documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Staff can view all documents
CREATE POLICY "Staff can view all documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents' AND
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid())
  );

-- Users can delete their own documents
CREATE POLICY "Users can delete their documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- BACKGROUNDS BUCKET POLICIES
-- ============================================
-- Everyone can view backgrounds (public bucket)
CREATE POLICY "Everyone can view backgrounds"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'backgrounds');

-- Only admins can upload backgrounds
CREATE POLICY "Admins can upload backgrounds"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'backgrounds' AND
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Admins can update backgrounds
CREATE POLICY "Admins can update backgrounds"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'backgrounds' AND
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Admins can delete backgrounds
CREATE POLICY "Admins can delete backgrounds"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'backgrounds' AND
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );
