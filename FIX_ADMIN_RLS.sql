-- ============================================
-- FIX RLS POLICIES FOR ADMIN ACCESS
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop existing policies and recreate them properly

-- ============================================
-- PROFILES TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

-- Recreate policies
-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can view ALL profiles (using has_role function to avoid recursion)
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can update all profiles (using has_role function to avoid recursion)
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow profile creation (for signup trigger)
DROP POLICY IF EXISTS "Allow profile creation on signup" ON public.profiles;
CREATE POLICY "Allow profile creation on signup"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

-- ============================================
-- USER_ROLES TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Recreate policies
-- Users can view their own role
CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all roles (using has_role function to avoid recursion)
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage roles (using has_role function to avoid recursion)
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- JOB_REQUESTS TABLE POLICIES (for admin access)
-- ============================================

-- Ensure admin can view all job requests (using has_role function)
DROP POLICY IF EXISTS "Admins can view all requests" ON public.job_requests;
CREATE POLICY "Admins can view all requests"
  ON public.job_requests FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR auth.uid() = user_id
    OR auth.uid() = mechanic_id
  );

-- ============================================
-- VERIFICATION LOGS POLICIES
-- ============================================

-- Ensure admin can view all verification logs (using has_role function)
DROP POLICY IF EXISTS "Admins can view verification logs" ON public.mechanic_verification_logs;
CREATE POLICY "Admins can view verification logs"
  ON public.mechanic_verification_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can create verification logs" ON public.mechanic_verification_logs;
CREATE POLICY "Admins can create verification logs"
  ON public.mechanic_verification_logs FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- DONE!
-- ============================================

