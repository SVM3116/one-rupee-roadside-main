-- ============================================
-- FIX JOB REQUESTS STATUS AND RLS POLICIES
-- Run this in Supabase SQL Editor
-- ============================================

-- Ensure status column allows all needed values
ALTER TABLE public.job_requests 
DROP CONSTRAINT IF EXISTS job_requests_status_check;

ALTER TABLE public.job_requests 
ADD CONSTRAINT job_requests_status_check 
CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled'));

-- Update any existing "on_the_way" status to "in_progress"
UPDATE public.job_requests
SET status = 'in_progress'
WHERE status = 'on_the_way';

-- Ensure mechanics can update job status
DROP POLICY IF EXISTS "Mechanics can update assigned requests" ON public.job_requests;
CREATE POLICY "Mechanics can update assigned requests"
  ON public.job_requests FOR UPDATE
  USING (auth.uid() = mechanic_id)
  WITH CHECK (auth.uid() = mechanic_id);

-- Ensure mechanics can view assigned requests
DROP POLICY IF EXISTS "Mechanics can view assigned requests" ON public.job_requests;
CREATE POLICY "Mechanics can view assigned requests"
  ON public.job_requests FOR SELECT
  USING (auth.uid() = mechanic_id);

-- ============================================
-- DONE!
-- ============================================

