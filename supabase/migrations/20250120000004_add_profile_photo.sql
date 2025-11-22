-- Add profile_photo column to profiles table
-- This migration ensures documents column exists and adds profile_photo

-- Ensure documents column exists (if migration wasn't applied)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '{}';

-- Add profile_photo column (separate from documents for easier access)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_photo TEXT;

-- Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for profile photos
CREATE POLICY "Users can upload their own profile photo"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view profile photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can update their own profile photo"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own profile photo"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add comment
COMMENT ON COLUMN public.profiles.profile_photo IS 'URL or path to user profile photo';

