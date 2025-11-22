-- ============================================
-- COMPREHENSIVE FIX FOR ALL RLS POLICIES
-- This fixes admin access and mechanic matching
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: FIX MECHANIC_LOCATIONS RLS
-- ============================================

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Allow authenticated users to view mechanic locations" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Anyone can view online mechanic locations" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Users can view mechanic locations" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Authenticated users can view mechanic locations" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Mechanics can manage their own location" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Admins can view all mechanic locations" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Allow mechanics to manage their own location" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Users can view mechanic locations for their jobs" ON public.mechanic_locations;

-- Create permissive policy for ALL authenticated users (for job matching)
-- This is the most important one - allows users to find mechanics
CREATE POLICY "Allow authenticated users to view mechanic locations"
  ON public.mechanic_locations FOR SELECT
  TO authenticated
  USING (true);

-- Allow mechanics to manage their own location
CREATE POLICY "Mechanics can manage their own location"
  ON public.mechanic_locations FOR ALL
  USING (auth.uid() = mechanic_id)
  WITH CHECK (auth.uid() = mechanic_id);

-- Allow admins to view all (explicit)
CREATE POLICY "Admins can view all mechanic locations"
  ON public.mechanic_locations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- STEP 2: FIX PROFILES RLS (ADMIN ACCESS)
-- ============================================

-- Ensure admins can view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Ensure admins can update profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow authenticated users to view profiles for job matching
-- This helps when checking if mechanic is online
DROP POLICY IF EXISTS "Authenticated users can view profiles for matching" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles for matching"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- STEP 3: FIX USER_LOCATIONS RLS (ADMIN ACCESS)
-- ============================================

-- Ensure admins can view all user locations
DROP POLICY IF EXISTS "Admins can view all user locations" ON public.user_locations;
CREATE POLICY "Admins can view all user locations"
  ON public.user_locations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- STEP 4: FIX USER_ROLES RLS (ADMIN ACCESS)
-- ============================================

-- Ensure admins can view all user roles
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
CREATE POLICY "Admins can view all user roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow authenticated users to view user_roles (for checking roles)
DROP POLICY IF EXISTS "Authenticated users can view user roles" ON public.user_roles;
CREATE POLICY "Authenticated users can view user roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- STEP 5: FIX JOB_REQUESTS RLS (ADMIN ACCESS)
-- ============================================

-- Ensure admins can view all job requests
DROP POLICY IF EXISTS "Admins can view all job requests" ON public.job_requests;
CREATE POLICY "Admins can view all job requests"
  ON public.job_requests FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Ensure admins can update all job requests
DROP POLICY IF EXISTS "Admins can update all job requests" ON public.job_requests;
CREATE POLICY "Admins can update all job requests"
  ON public.job_requests FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- STEP 6: CREATE/UPDATE VIEW FOR ONLINE MECHANICS
-- ============================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.online_mechanic_locations;

-- Create view that joins mechanic_locations with profiles
-- More lenient - includes mechanics even if profile check fails
CREATE OR REPLACE VIEW public.online_mechanic_locations AS
SELECT 
  ml.mechanic_id,
  ml.latitude,
  ml.longitude,
  ml.updated_at,
  p.availability_status,
  p.full_name,
  p.verification_status
FROM public.mechanic_locations ml
LEFT JOIN public.profiles p ON p.id = ml.mechanic_id
WHERE (p.availability_status = 'online' OR p.availability_status IS NULL OR ml.mechanic_id NOT IN (SELECT id FROM public.profiles));

-- Grant access to authenticated users
GRANT SELECT ON public.online_mechanic_locations TO authenticated;

-- ============================================
-- STEP 7: VERIFY POLICIES
-- ============================================

-- Check mechanic_locations policies
SELECT 
  'mechanic_locations' as table_name,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'mechanic_locations'
ORDER BY policyname;

-- Check profiles policies
SELECT 
  'profiles' as table_name,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ============================================
-- DONE!
-- ============================================
-- After running this:
-- 1. Admins can see all mechanics and users
-- 2. Users can see mechanic locations for matching
-- 3. Job assignment should work correctly
-- 4. Same location matching should work

