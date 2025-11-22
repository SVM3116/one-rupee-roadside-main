-- ============================================
-- VERIFY JOB ASSIGNMENT DATA
-- Run this to check why jobs aren't assigning
-- ============================================

-- ============================================
-- STEP 1: Check if mechanics have locations
-- ============================================
SELECT 
  'Mechanics with locations' as check_name,
  COUNT(*) as count
FROM mechanic_locations;

-- List all mechanics with their locations
SELECT 
  ml.mechanic_id,
  ml.latitude,
  ml.longitude,
  ml.updated_at,
  p.email,
  p.availability_status,
  p.verification_status,
  -- Calculate age of location
  EXTRACT(EPOCH FROM (NOW() - ml.updated_at)) / 60 as age_minutes
FROM mechanic_locations ml
LEFT JOIN profiles p ON p.id = ml.mechanic_id
ORDER BY ml.updated_at DESC;

-- ============================================
-- STEP 2: Check online mechanics
-- ============================================
SELECT 
  'Online mechanics' as check_name,
  COUNT(*) as count
FROM profiles
WHERE id IN (SELECT user_id FROM user_roles WHERE role = 'mechanic')
  AND availability_status = 'online';

-- List online mechanics with locations
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.availability_status,
  p.verification_status,
  ml.latitude,
  ml.longitude,
  ml.updated_at,
  EXTRACT(EPOCH FROM (NOW() - ml.updated_at)) / 60 as location_age_minutes
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'mechanic'
LEFT JOIN mechanic_locations ml ON ml.mechanic_id = p.id
WHERE ur.user_id IS NOT NULL
  AND p.availability_status = 'online'
ORDER BY ml.updated_at DESC;

-- ============================================
-- STEP 3: Check pending job requests
-- ============================================
SELECT 
  'Pending job requests' as check_name,
  COUNT(*) as count
FROM job_requests
WHERE status = 'pending';

-- List pending job requests with user locations
SELECT 
  jr.id,
  jr.user_id,
  jr.mechanic_id,
  jr.status,
  jr.vehicle_type,
  jr.user_location,
  jr.created_at,
  u.email as user_email,
  m.email as mechanic_email
FROM job_requests jr
LEFT JOIN profiles u ON u.id = jr.user_id
LEFT JOIN profiles m ON m.id = jr.mechanic_id
WHERE jr.status = 'pending'
ORDER BY jr.created_at DESC;

-- ============================================
-- STEP 4: Calculate distance between user and mechanic
-- ============================================
-- Replace these with actual IDs from your database
-- This calculates distance between a user and mechanic
WITH user_location AS (
  SELECT 
    user_location->>'lat' as lat,
    user_location->>'lng' as lng
  FROM job_requests
  WHERE status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1
),
mechanic_location AS (
  SELECT 
    mechanic_id,
    latitude,
    longitude
  FROM mechanic_locations
  WHERE mechanic_id IN (
    SELECT user_id FROM user_roles WHERE role = 'mechanic'
  )
)
SELECT 
  ml.mechanic_id,
  ml.latitude,
  ml.longitude,
  ul.lat as user_lat,
  ul.lng as user_lng,
  -- Haversine distance calculation (in meters)
  (
    6371000 * acos(
      cos(radians(ul.lat::float)) * 
      cos(radians(ml.latitude::float)) * 
      cos(radians(ml.longitude::float) - radians(ul.lng::float)) + 
      sin(radians(ul.lat::float)) * 
      sin(radians(ml.latitude::float))
    )
  ) as distance_meters,
  (
    6371000 * acos(
      cos(radians(ul.lat::float)) * 
      cos(radians(ml.latitude::float)) * 
      cos(radians(ml.longitude::float) - radians(ul.lng::float)) + 
      sin(radians(ul.lat::float)) * 
      sin(radians(ml.latitude::float))
    )
  ) / 1000 as distance_km,
  p.availability_status,
  p.verification_status
FROM mechanic_location ml
CROSS JOIN user_location ul
LEFT JOIN profiles p ON p.id = ml.mechanic_id
WHERE ul.lat IS NOT NULL AND ul.lng IS NOT NULL
ORDER BY distance_meters ASC;

-- ============================================
-- STEP 5: Check RLS policies
-- ============================================
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('mechanic_locations', 'profiles', 'job_requests')
ORDER BY tablename, policyname;

-- ============================================
-- DONE!
-- ============================================
-- Review the results:
-- 1. If "Mechanics with locations" = 0 → Mechanic needs to share location
-- 2. If "Online mechanics" = 0 → Mechanic needs to toggle online
-- 3. If distance > 50000m (50km) → Too far (expected)
-- 4. If distance < 50000m but not assigned → Check RLS or profile status
-- 5. If RLS policies missing → Run FIX_ALL_RLS_COMPREHENSIVE.sql

