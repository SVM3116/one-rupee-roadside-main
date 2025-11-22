-- ============================================
-- CREATE ADMIN ACCOUNT - SQL Script
-- ============================================
-- 
-- INSTRUCTIONS:
-- 1. First, create a user account (see CREATE_ADMIN_ACCOUNT.md)
-- 2. Get the User ID (UUID) from Supabase Dashboard → Authentication → Users
-- 3. Replace 'YOUR_USER_ID_HERE' below with your actual UUID
-- 4. Replace 'admin@yourproject.com' with your admin email
-- 5. Run this SQL in Supabase SQL Editor
--
-- ============================================

-- Replace these values:
DO $$
DECLARE
  admin_user_id UUID := 'YOUR_USER_ID_HERE';  -- ⚠️ CHANGE THIS: Get UUID from Authentication → Users
  admin_email TEXT := 'admin@yourproject.com';  -- ⚠️ CHANGE THIS: Your admin email
BEGIN
  -- Step 1: Create/update profile with admin role
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    admin_user_id,
    admin_email,
    'Admin User',
    'admin',
    'active'
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    role = 'admin',
    status = 'active',
    email = admin_email,
    full_name = COALESCE(profiles.full_name, 'Admin User');

  -- Step 2: Assign admin role in user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Success message
  RAISE NOTICE '✅ Admin account created successfully!';
  RAISE NOTICE 'User ID: %', admin_user_id;
  RAISE NOTICE 'Email: %', admin_email;
END $$;

-- ============================================
-- VERIFY ADMIN WAS CREATED (Optional - Run to check)
-- ============================================
-- Uncomment and run this to verify:

/*
SELECT 
  ur.user_id,
  ur.role,
  p.email,
  p.full_name,
  p.status
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.role = 'admin';
*/
-- ============================================

