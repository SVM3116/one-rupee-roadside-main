-- ============================================
-- COMPLETE DATABASE SETUP FOR ONE RUPEE PROJECT
-- Copy this entire file and run in Supabase SQL Editor
-- ============================================

-- Create app_role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'mechanic', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role app_role NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  availability_status TEXT DEFAULT 'offline',
  services TEXT[] DEFAULT '{}',
  work_location TEXT,
  pincode TEXT,
  bank_account_number TEXT,
  bank_ifsc TEXT,
  bank_name TEXT,
  bank_branch TEXT,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  documents JSONB DEFAULT '{}',
  profile_photo TEXT
);

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Create job_requests table
CREATE TABLE IF NOT EXISTS public.job_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mechanic_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  location TEXT NOT NULL,
  user_location JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')),
  media_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create testimonials table
CREATE TABLE IF NOT EXISTS public.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mechanic_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create mechanic_verification_logs table
CREATE TABLE IF NOT EXISTS public.mechanic_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'blocked')),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_verification_logs ENABLE ROW LEVEL SECURITY;

-- Create security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for job_requests
DROP POLICY IF EXISTS "Users can view their own requests" ON public.job_requests;
CREATE POLICY "Users can view their own requests"
  ON public.job_requests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Mechanics can view assigned requests" ON public.job_requests;
CREATE POLICY "Mechanics can view assigned requests"
  ON public.job_requests FOR SELECT
  USING (auth.uid() = mechanic_id);

DROP POLICY IF EXISTS "Users can create requests" ON public.job_requests;
CREATE POLICY "Users can create requests"
  ON public.job_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their requests" ON public.job_requests;
CREATE POLICY "Users can update their requests"
  ON public.job_requests FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Mechanics can update assigned requests" ON public.job_requests;
CREATE POLICY "Mechanics can update assigned requests"
  ON public.job_requests FOR UPDATE
  USING (auth.uid() = mechanic_id);

DROP POLICY IF EXISTS "Admins can view all requests" ON public.job_requests;
CREATE POLICY "Admins can view all requests"
  ON public.job_requests FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for testimonials
DROP POLICY IF EXISTS "Anyone can view testimonials" ON public.testimonials;
CREATE POLICY "Anyone can view testimonials"
  ON public.testimonials FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create testimonials" ON public.testimonials;
CREATE POLICY "Users can create testimonials"
  ON public.testimonials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their testimonials" ON public.testimonials;
CREATE POLICY "Users can update their testimonials"
  ON public.testimonials FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for verification logs
DROP POLICY IF EXISTS "Admins can view verification logs" ON public.mechanic_verification_logs;
CREATE POLICY "Admins can view verification logs"
  ON public.mechanic_verification_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can create verification logs" ON public.mechanic_verification_logs;
CREATE POLICY "Admins can create verification logs"
  ON public.mechanic_verification_logs FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('verification-documents', 'verification-documents', false),
  ('job-media', 'job-media', true),
  ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for verification-documents
DROP POLICY IF EXISTS "Mechanics can upload verification documents" ON storage.objects;
CREATE POLICY "Mechanics can upload verification documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'verification-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Mechanics can view their documents" ON storage.objects;
CREATE POLICY "Mechanics can view their documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'verification-documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Admins can view all documents" ON storage.objects;
CREATE POLICY "Admins can view all documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND public.has_role(auth.uid(), 'admin')
  );

-- Storage policies for job-media
DROP POLICY IF EXISTS "Users can upload job media" ON storage.objects;
CREATE POLICY "Users can upload job media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'job-media' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Anyone can view job media" ON storage.objects;
CREATE POLICY "Anyone can view job media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'job-media');

-- Storage policies for profile-photos
DROP POLICY IF EXISTS "Users can upload profile photos" ON storage.objects;
CREATE POLICY "Users can upload profile photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Anyone can view profile photos" ON storage.objects;
CREATE POLICY "Anyone can view profile photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "Users can update profile photos" ON storage.objects;
CREATE POLICY "Users can update profile photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete profile photos" ON storage.objects;
CREATE POLICY "Users can delete profile photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-photos' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- DONE! All tables, policies, and storage buckets are created
-- ============================================

