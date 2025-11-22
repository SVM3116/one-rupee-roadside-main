-- ============================================
-- COMPREHENSIVE FIX FOR ADMIN ACCESS AND MECHANIC MATCHING
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: FIX RLS FOR MECHANIC_LOCATIONS
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow authenticated users to view mechanic locations" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Anyone can view online mechanic locations" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Users can view mechanic locations" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Authenticated users can view mechanic locations" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Mechanics can manage their own location" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Admins can view all mechanic locations" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Allow mechanics to manage their own location" ON public.mechanic_locations;

-- Create permissive policy for ALL authenticated users (for job matching)
CREATE POLICY "Allow authenticated users to view mechanic locations"
  ON public.mechanic_locations FOR SELECT
  TO authenticated
  USING (true);

-- Allow mechanics to manage their own location
CREATE POLICY "Mechanics can manage their own location"
  ON public.mechanic_locations FOR ALL
  USING (auth.uid() = mechanic_id)
  WITH CHECK (auth.uid() = mechanic_id);

-- Allow admins to view all (redundant but explicit)
CREATE POLICY "Admins can view all mechanic locations"
  ON public.mechanic_locations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- STEP 2: FIX RLS FOR PROFILES (ADMIN ACCESS)
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

-- ============================================
-- STEP 3: FIX RLS FOR USER_LOCATIONS (ADMIN ACCESS)
-- ============================================

-- Ensure admins can view all user locations
DROP POLICY IF EXISTS "Admins can view all user locations" ON public.user_locations;
CREATE POLICY "Admins can view all user locations"
  ON public.user_locations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- STEP 4: FIX RLS FOR USER_ROLES (ADMIN ACCESS)
-- ============================================

-- Ensure admins can view all user roles
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
CREATE POLICY "Admins can view all user roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- STEP 5: FIX RLS FOR JOB_REQUESTS (ADMIN ACCESS)
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
WHERE (p.availability_status = 'online' OR p.availability_status IS NULL)
  AND (p.verification_status = 'approved' OR p.verification_status IS NULL);

-- Grant access to authenticated users
GRANT SELECT ON public.online_mechanic_locations TO authenticated;

-- ============================================
-- STEP 7: VERIFY POLICIES
-- ============================================

-- Check mechanic_locations policies
SELECT 
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'mechanic_locations'
ORDER BY policyname;

-- Check profiles policies
SELECT 
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
-- Now:
-- 1. Admins can see all mechanics and users
-- 2. Users can see mechanic locations for matching
-- 3. Job assignment should work correctly

