-- ============================================
-- FIX LOCATION SHARING AND DOCUMENT VIEWING
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- CREATE MECHANIC_LOCATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.mechanic_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(mechanic_id)
);

-- Enable RLS
ALTER TABLE public.mechanic_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mechanic_locations
DROP POLICY IF EXISTS "Mechanics can manage their own location" ON public.mechanic_locations;
CREATE POLICY "Mechanics can manage their own location"
  ON public.mechanic_locations FOR ALL
  USING (auth.uid() = mechanic_id)
  WITH CHECK (auth.uid() = mechanic_id);

DROP POLICY IF EXISTS "Admins can view all locations" ON public.mechanic_locations;
CREATE POLICY "Admins can view all locations"
  ON public.mechanic_locations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can view mechanic locations" ON public.mechanic_locations;
CREATE POLICY "Users can view mechanic locations"
  ON public.mechanic_locations FOR SELECT
  USING (true); -- Allow users to see mechanic locations for tracking

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_mechanic_locations_mechanic_id ON public.mechanic_locations(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_locations_updated_at ON public.mechanic_locations(updated_at);

-- ============================================
-- ENSURE STORAGE BUCKETS EXIST
-- ============================================

-- Create verification-documents bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-documents', 'verification-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create job-media bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-media', 'job-media', true)
ON CONFLICT (id) DO NOTHING;

-- Create profile-photos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- FIX STORAGE POLICIES FOR VERIFICATION DOCUMENTS
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Mechanics can upload verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Mechanics can view their documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all documents" ON storage.objects;
DROP POLICY IF EXISTS "Mechanics can upload their own verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Mechanics can view their own verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all verification documents" ON storage.objects;

-- Mechanics can upload their own documents
CREATE POLICY "Mechanics can upload verification documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'verification-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Mechanics can view their own documents
CREATE POLICY "Mechanics can view their documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'verification-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can view ALL documents (this is critical for admin dashboard)
CREATE POLICY "Admins can view all documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND public.has_role(auth.uid(), 'admin')
  );

-- ============================================
-- FIX STORAGE POLICIES FOR JOB MEDIA
-- ============================================

DROP POLICY IF EXISTS "Users can upload job media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view job media" ON storage.objects;

CREATE POLICY "Users can upload job media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'job-media' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Anyone can view job media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'job-media');

-- ============================================
-- FIX STORAGE POLICIES FOR PROFILE PHOTOS
-- ============================================

DROP POLICY IF EXISTS "Users can upload profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete profile photos" ON storage.objects;

CREATE POLICY "Users can upload profile photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Anyone can view profile photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can update profile photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete profile photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- DONE!
-- ============================================

