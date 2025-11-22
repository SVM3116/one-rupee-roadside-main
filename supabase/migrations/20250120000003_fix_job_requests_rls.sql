-- Fix RLS policies for job_requests to ensure users can create requests
-- This fixes the "Failed to submit request" error

-- Ensure media_urls column exists (if migration wasn't applied)
ALTER TABLE public.job_requests
ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT '{}';

-- Drop and recreate INSERT policy to ensure it works
DROP POLICY IF EXISTS "Users can create their own job requests" ON public.job_requests;

CREATE POLICY "Users can create their own job requests"
ON public.job_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Ensure SELECT policy allows users to see their requests
DROP POLICY IF EXISTS "Users can view their own job requests" ON public.job_requests;

CREATE POLICY "Users can view their own job requests"
ON public.job_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = mechanic_id);

-- Ensure UPDATE policy works
DROP POLICY IF EXISTS "Users can update their own job requests" ON public.job_requests;

CREATE POLICY "Users can update their own job requests"
ON public.job_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = mechanic_id);

