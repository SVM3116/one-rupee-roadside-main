-- ============================================
-- VIEW COMPLETE STATUS CONSTRAINT
-- This will show the full constraint definition
-- ============================================

-- Method 1: Get full constraint definition (no truncation)
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid, true) AS full_definition
FROM pg_constraint 
WHERE conrelid = 'public.job_requests'::regclass 
AND conname = 'job_requests_status_check';

-- ============================================
-- Method 2: Test if specific statuses are allowed
-- ============================================

-- Try to check what statuses are currently in the database
SELECT DISTINCT status 
FROM public.job_requests 
ORDER BY status;

-- ============================================
-- Method 3: Try updating a test record (if you have one)
-- ============================================

-- First, find a job request ID
-- SELECT id, status, mechanic_id FROM public.job_requests LIMIT 5;

-- Then try to update it to 'on_the_way' (replace YOUR_JOB_ID)
-- UPDATE public.job_requests 
-- SET status = 'on_the_way' 
-- WHERE id = 'YOUR_JOB_ID';

-- If this works without error, the constraint is correct!
-- If you get an error, we need to update the constraint.
