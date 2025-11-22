-- ============================================
-- DIAGNOSE MECHANIC MATCHING ISSUES
-- Run this in Supabase SQL Editor to check current state
-- ============================================

-- ============================================
-- CHECK 1: RLS POLICIES
-- ============================================
SELECT 
  'RLS Policies Check' as check_type,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'mechanic_locations'
ORDER BY policyname;

-- Expected: Should see at least:
-- - "Allow authenticated users to view mechanic locations" (SELECT, authenticated)
-- - "Allow mechanics to manage their own location" (ALL, authenticated)

-- ============================================
-- CHECK 2: MECHANIC_LOCATIONS TABLE DATA
-- ============================================
SELECT 
  'Mechanic Locations Data' as check_type,
  COUNT(*) as total_locations,
  COUNT(DISTINCT mechanic_id) as unique_mechanics,
  MIN(updated_at) as oldest_location,
  MAX(updated_at) as newest_location,
  AVG(EXTRACT(EPOCH FROM (NOW() - updated_at))/60) as avg_age_minutes
FROM public.mechanic_locations;

-- Expected: Should have at least 1 location with recent updated_at

-- ============================================
-- CHECK 3: ONLINE MECHANICS
-- ============================================
SELECT 
  'Online Mechanics' as check_type,
  id,
  full_name,
  availability_status,
  verification_status,
  updated_at
FROM public.profiles
WHERE availability_status = 'online'
ORDER BY updated_at DESC;

-- Expected: Should have at least 1 mechanic with availability_status = 'online'

-- ============================================
-- CHECK 4: ONLINE MECHANICS WITH LOCATIONS
-- ============================================
SELECT 
  'Online Mechanics with Locations' as check_type,
  ml.mechanic_id,
  p.full_name,
  ml.latitude,
  ml.longitude,
  ml.updated_at as location_updated,
  p.availability_status,
  p.verification_status,
  EXTRACT(EPOCH FROM (NOW() - ml.updated_at))/60 as location_age_minutes
FROM public.mechanic_locations ml
JOIN public.profiles p ON p.id = ml.mechanic_id
WHERE p.availability_status = 'online'
  AND p.verification_status = 'approved'
ORDER BY ml.updated_at DESC;

-- Expected: Should have at least 1 row
-- This is what the matching algorithm needs!

-- ============================================
-- CHECK 5: RECENT LOCATIONS (within 1 hour)
-- ============================================
SELECT 
  'Recent Locations (within 1 hour)' as check_type,
  COUNT(*) as count
FROM public.mechanic_locations ml
JOIN public.profiles p ON p.id = ml.mechanic_id
WHERE p.availability_status = 'online'
  AND p.verification_status = 'approved'
  AND ml.updated_at > NOW() - INTERVAL '1 hour';

-- Expected: Should be > 0

-- ============================================
-- CHECK 6: TEST RLS ACCESS (as authenticated user)
-- ============================================
-- This will show if RLS is blocking access
-- Run this while logged in as a user (not admin)

-- Note: This query will only work if RLS allows it
-- If it fails, RLS is blocking access
SELECT 
  'RLS Access Test' as check_type,
  COUNT(*) as accessible_locations
FROM public.mechanic_locations;

-- Expected: Should return a count (not an error)
-- If error: RLS policies need to be fixed

-- ============================================
-- SUMMARY
-- ============================================
SELECT 
  'SUMMARY' as check_type,
  (SELECT COUNT(*) FROM public.mechanic_locations) as total_locations,
  (SELECT COUNT(*) FROM public.profiles WHERE availability_status = 'online') as online_mechanics,
  (SELECT COUNT(*) 
   FROM public.mechanic_locations ml
   JOIN public.profiles p ON p.id = ml.mechanic_id
   WHERE p.availability_status = 'online'
     AND p.verification_status = 'approved'
     AND ml.updated_at > NOW() - INTERVAL '1 hour') as online_mechanics_with_recent_location;

-- Expected results for matching to work:
-- - total_locations > 0
-- - online_mechanics > 0
-- - online_mechanics_with_recent_location > 0

-- ============================================
-- FIXES BASED ON RESULTS
-- ============================================

-- If total_locations = 0:
--   → Mechanics need to go online and share location

-- If online_mechanics = 0:
--   → Mechanics need to toggle online in dashboard

-- If online_mechanics_with_recent_location = 0:
--   → Either mechanics aren't online, or locations are too old
--   → Make sure mechanics are online and location sharing is active

-- If RLS Access Test fails:
--   → Run COMPREHENSIVE_FIX_MECHANIC_MATCHING.sql

