-- ============================================
-- VERIFY JOB STATUS FIX
-- Run this to confirm everything is working
-- ============================================

-- 1. Check the status constraint (should show all XState statuses)
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.job_requests'::regclass 
AND conname = 'job_requests_status_check';

-- Expected output should include:
-- 'pending', 'accepted', 'on_the_way', 'reached_destination', 
-- 'repair_started', 'repair_completed', 'completed', 'cancelled', 'rejected'

-- ============================================
-- If the constraint doesn't show all statuses, run this:
-- ============================================

/*
ALTER TABLE public.job_requests 
DROP CONSTRAINT IF EXISTS job_requests_status_check;

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
  'in_progress'
));
*/
