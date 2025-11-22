-- ============================================
-- COMPREHENSIVE FIX FOR MECHANIC MATCHING
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: FIX RLS POLICIES FOR MECHANIC_LOCATIONS
-- ============================================

-- Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Anyone can view online mechanic locations" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Users can view mechanic locations" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Anyone can view mechanic locations" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Authenticated users can view mechanic locations" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Users can view mechanic locations for their jobs" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Mechanics can manage their own location" ON public.mechanic_locations;
DROP POLICY IF EXISTS "Admins can view all mechanic locations" ON public.mechanic_locations;

-- Create a simple, permissive policy for SELECT (for job matching)
-- This allows ALL authenticated users to view mechanic locations
CREATE POLICY "Allow authenticated users to view mechanic locations"
  ON public.mechanic_locations FOR SELECT
  TO authenticated
  USING (true);

-- Allow mechanics to insert/update their own location
CREATE POLICY "Allow mechanics to manage their own location"
  ON public.mechanic_locations FOR ALL
  USING (auth.uid() = mechanic_id)
  WITH CHECK (auth.uid() = mechanic_id);

-- Allow admins to view all locations
CREATE POLICY "Allow admins to view all mechanic locations"
  ON public.mechanic_locations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- STEP 2: CREATE A VIEW FOR EASIER QUERYING
-- ============================================

-- Create a view that joins mechanic_locations with profiles
-- This makes it easier to query online mechanics with locations
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
WHERE p.availability_status = 'online'
  AND p.verification_status = 'approved';

-- Grant access to authenticated users
GRANT SELECT ON public.online_mechanic_locations TO authenticated;

-- ============================================
-- STEP 3: ENSURE MECHANIC_LOCATIONS TABLE EXISTS
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

-- ============================================
-- STEP 4: CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_mechanic_locations_mechanic_id ON public.mechanic_locations(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_locations_updated_at ON public.mechanic_locations(updated_at);
CREATE INDEX IF NOT EXISTS idx_mechanic_locations_lat_lng ON public.mechanic_locations(latitude, longitude);

-- ============================================
-- STEP 5: VERIFY SETUP
-- ============================================

-- Check policies
SELECT 
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'mechanic_locations'
ORDER BY policyname;

-- Check if table exists and has data
SELECT 
  COUNT(*) as total_locations,
  COUNT(DISTINCT mechanic_id) as unique_mechanics
FROM public.mechanic_locations;

-- Check online mechanics with locations
SELECT 
  COUNT(*) as online_mechanics_with_location
FROM public.online_mechanic_locations;

-- ============================================
-- DONE!
-- ============================================
-- Now:
-- 1. Mechanics can share their location
-- 2. Users can view all mechanic locations (for matching)
-- 3. You can query online_mechanic_locations view for online mechanics only
-- 4. RLS policies are properly configured

