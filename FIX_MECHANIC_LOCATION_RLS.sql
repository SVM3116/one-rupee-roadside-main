-- ============================================
-- FIX RLS POLICIES FOR MECHANIC LOCATIONS
-- This allows users to view mechanic locations for job matching
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop conflicting policies
DROP POLICY IF EXISTS "Anyone can view online mechanic locations" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Users can view mechanic locations" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Anyone can view mechanic locations" ON public.mechanic_locations;

-- Create a simple policy that allows ALL authenticated users to view mechanic locations
-- This is needed for the job matching algorithm to work
CREATE POLICY "Authenticated users can view mechanic locations"
  ON public.mechanic_locations FOR SELECT
  TO authenticated
  USING (true);

-- Keep the policy for mechanics to manage their own location
-- (This should already exist, but ensure it's there)
DROP POLICY IF EXISTS "Mechanics can manage their own location" ON public.mechanic_locations;
CREATE POLICY "Mechanics can manage their own location"
  ON public.mechanic_locations FOR ALL
  USING (auth.uid() = mechanic_id)
  WITH CHECK (auth.uid() = mechanic_id);

-- Keep admin policy
DROP POLICY IF EXISTS "Admins can view all mechanic locations" ON public.mechanic_locations;
CREATE POLICY "Admins can view all mechanic locations"
  ON public.mechanic_locations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- VERIFY THE POLICIES
-- ============================================

-- Check existing policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'mechanic_locations'
ORDER BY policyname;

-- ============================================
-- DONE!
-- ============================================
-- Now users should be able to view mechanic locations for job matching
-- The application code will filter by online status and distance

