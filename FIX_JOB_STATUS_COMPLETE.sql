-- ============================================
-- FIX JOB STATUS CONSTRAINT AND RLS POLICIES
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Drop the old constraint that limits status values
ALTER TABLE public.job_requests 
DROP CONSTRAINT IF EXISTS job_requests_status_check;

-- 2. Add new constraint with ALL XState status values
ALTER TABLE public.job_requests 
ADD CONSTRAINT job_requests_status_check 
CHECK (status IN (
  'pending',
  'accepted', 
  'on_the_way',
  'reached_destination',
  'repair_started',
  'repair_completed',
  'completed',
  'cancelled',
  'rejected',
  'in_progress'  -- Keep for backward compatibility
));

-- 3. Ensure mechanics can UPDATE job status (RLS policy)
DROP POLICY IF EXISTS "Mechanics can update assigned requests" ON public.job_requests;
CREATE POLICY "Mechanics can update assigned requests"
  ON public.job_requests FOR UPDATE
  USING (auth.uid() = mechanic_id)
  WITH CHECK (auth.uid() = mechanic_id);

-- 4. Ensure mechanics can VIEW assigned requests (RLS policy)
DROP POLICY IF EXISTS "Mechanics can view assigned requests" ON public.job_requests;
CREATE POLICY "Mechanics can view assigned requests"
  ON public.job_requests FOR SELECT
  USING (auth.uid() = mechanic_id);

-- 5. Ensure users can view their own requests
DROP POLICY IF EXISTS "Users can view their own requests" ON public.job_requests;
CREATE POLICY "Users can view their own requests"
  ON public.job_requests FOR SELECT
  USING (auth.uid() = user_id);

-- 6. Ensure users can update their own requests (for cancellation)
DROP POLICY IF EXISTS "Users can update their requests" ON public.job_requests;
CREATE POLICY "Users can update their requests"
  ON public.job_requests FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Ensure admins can view all requests
DROP POLICY IF EXISTS "Admins can view all requests" ON public.job_requests;
CREATE POLICY "Admins can view all requests"
  ON public.job_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 8. Ensure admins can update all requests
DROP POLICY IF EXISTS "Admins can update all requests" ON public.job_requests;
CREATE POLICY "Admins can update all requests"
  ON public.job_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- VERIFICATION QUERIES (Optional - run to verify)
-- ============================================

-- Check the constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.job_requests'::regclass 
AND conname = 'job_requests_status_check';

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'job_requests'
ORDER BY policyname;

-- ============================================
-- DONE! Job status updates should now work
-- ============================================
