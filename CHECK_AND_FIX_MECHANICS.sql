-- ============================================
-- CHECK AND FIX MECHANICS IN DATABASE
-- Run this to verify mechanics exist and fix role assignments
-- ============================================

-- ============================================
-- STEP 1: Check if mechanics exist in profiles
-- ============================================
SELECT 
  'Mechanics in profiles table' as check_name,
  COUNT(*) as count
FROM profiles
WHERE role = 'mechanic';

-- List all mechanics from profiles
SELECT 
  id,
  email,
  full_name,
  role,
  availability_status,
  verification_status
FROM profiles
WHERE role = 'mechanic';

-- ============================================
-- STEP 2: Check if mechanics exist in user_roles
-- ============================================
SELECT 
  'Mechanics in user_roles table' as check_name,
  COUNT(*) as count
FROM user_roles
WHERE role = 'mechanic';

-- List all mechanics from user_roles
SELECT 
  ur.user_id,
  ur.role,
  p.email,
  p.full_name,
  p.availability_status
FROM user_roles ur
LEFT JOIN profiles p ON p.id = ur.user_id
WHERE ur.role = 'mechanic';

-- ============================================
-- STEP 3: Fix mechanics - Add to user_roles if missing
-- ============================================
-- This will add mechanics from profiles to user_roles if they're missing
INSERT INTO user_roles (user_id, role)
SELECT 
  id as user_id,
  'mechanic' as role
FROM profiles
WHERE role = 'mechanic'
  AND id NOT IN (SELECT user_id FROM user_roles WHERE role = 'mechanic')
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================
-- STEP 4: Verify the fix
-- ============================================
SELECT 
  'After fix - Mechanics in user_roles' as check_name,
  COUNT(*) as count
FROM user_roles
WHERE role = 'mechanic';

-- ============================================
-- STEP 5: Check if mechanics have locations
-- ============================================
SELECT 
  'Mechanics with locations' as check_name,
  COUNT(*) as count
FROM mechanic_locations
WHERE mechanic_id IN (SELECT user_id FROM user_roles WHERE role = 'mechanic');

-- List mechanics with their locations and online status
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.availability_status,
  ml.latitude,
  ml.longitude,
  ml.updated_at
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'mechanic'
LEFT JOIN mechanic_locations ml ON ml.mechanic_id = p.id
WHERE ur.user_id IS NOT NULL
ORDER BY p.availability_status DESC, ml.updated_at DESC;

-- ============================================
-- DONE!
-- ============================================
-- After running this:
-- 1. Mechanics should be in both profiles and user_roles
-- 2. Admin dashboard should show mechanics
-- 3. Check the last query to see online mechanics with locations

