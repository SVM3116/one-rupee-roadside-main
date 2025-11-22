-- ============================================
-- DIAGNOSTIC QUERIES FOR ADMIN DASHBOARD ISSUE
-- Run these in Supabase SQL Editor to check what's wrong
-- ============================================

-- ============================================
-- STEP 1: Check if mechanics exist
-- ============================================
SELECT 
  'Total mechanics in user_roles' as check_name,
  COUNT(*) as count
FROM user_roles
WHERE role = 'mechanic';

-- List all mechanics
SELECT 
  ur.user_id,
  ur.role,
  p.email,
  p.full_name,
  p.availability_status,
  p.verification_status
FROM user_roles ur
LEFT JOIN profiles p ON p.id = ur.user_id
WHERE ur.role = 'mechanic';

-- ============================================
-- STEP 2: Check if mechanics have locations
-- ============================================
SELECT 
  'Total mechanic locations' as check_name,
  COUNT(*) as count
FROM mechanic_locations;

-- List all mechanic locations
SELECT 
  ml.mechanic_id,
  ml.latitude,
  ml.longitude,
  ml.updated_at,
  p.email,
  p.availability_status
FROM mechanic_locations ml
LEFT JOIN profiles p ON p.id = ml.mechanic_id;

-- ============================================
-- STEP 3: Check online mechanics
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
  ml.latitude,
  ml.longitude,
  ml.updated_at
FROM profiles p
LEFT JOIN mechanic_locations ml ON ml.mechanic_id = p.id
WHERE p.id IN (SELECT user_id FROM user_roles WHERE role = 'mechanic')
  AND p.availability_status = 'online';

-- ============================================
-- STEP 4: Check RLS policies
-- ============================================
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('mechanic_locations', 'profiles', 'user_roles', 'user_locations', 'job_requests')
ORDER BY tablename, policyname;

-- ============================================
-- STEP 5: Check if admin role exists
-- ============================================
SELECT 
  'Admins' as check_name,
  COUNT(*) as count
FROM user_roles
WHERE role = 'admin';

-- List all admins
SELECT 
  ur.user_id,
  ur.role,
  p.email,
  p.full_name
FROM user_roles ur
LEFT JOIN profiles p ON p.id = ur.user_id
WHERE ur.role = 'admin';

-- ============================================
-- STEP 6: Check job requests
-- ============================================
SELECT 
  'Pending job requests' as check_name,
  COUNT(*) as count
FROM job_requests
WHERE status = 'pending';

-- List pending job requests
SELECT 
  jr.id,
  jr.user_id,
  jr.mechanic_id,
  jr.status,
  jr.vehicle_type,
  jr.created_at,
  u.email as user_email,
  m.email as mechanic_email
FROM job_requests jr
LEFT JOIN profiles u ON u.id = jr.user_id
LEFT JOIN profiles m ON m.id = jr.mechanic_id
WHERE jr.status = 'pending'
ORDER BY jr.created_at DESC;

-- ============================================
-- DONE!
-- ============================================
-- Review the results:
-- 1. If "Total mechanics" is 0 → No mechanics registered
-- 2. If "Total mechanic locations" is 0 → Mechanics haven't shared location
-- 3. If "Online mechanics" is 0 → Mechanics are offline
-- 4. If RLS policies are missing → Run FIX_ALL_RLS_COMPREHENSIVE.sql
-- 5. If admin count is 0 → Create an admin account

