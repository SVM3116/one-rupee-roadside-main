-- ============================================
-- ADD NEW JOB STATUSES FOR MECHANICS
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop existing constraint
ALTER TABLE public.job_requests 
DROP CONSTRAINT IF EXISTS job_requests_status_check;

-- Add new constraint with all status options
ALTER TABLE public.job_requests 
ADD CONSTRAINT job_requests_status_check 
CHECK (status IN (
  'pending',           -- Initial state when user submits request
  'accepted',          -- Mechanic accepts the job
  'on_the_way',        -- Mechanic is traveling to user
  'reached_destination', -- Mechanic has reached the user
  'repair_started',    -- Mechanic has started the repair
  'repair_completed',  -- Repair is done, waiting for user confirmation
  'completed',         -- Job fully completed
  'cancelled',         -- Job was cancelled
  'rejected'           -- Mechanic rejected the job
));

-- Update any existing 'in_progress' to 'on_the_way' for consistency
UPDATE public.job_requests
SET status = 'on_the_way'
WHERE status = 'in_progress';

-- ============================================
-- DONE!
-- ============================================
-- New status flow:
-- pending → accepted → on_the_way → reached_destination → repair_started → repair_completed → completed
-- Or: pending → rejected/cancelled

