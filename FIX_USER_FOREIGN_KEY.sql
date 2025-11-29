-- ============================================
-- FIX FOREIGN KEY FOR USER PROFILE JOIN
-- Run this in Supabase SQL Editor
-- ============================================

-- This fixes the 400 error when fetching jobs with user profile data
-- Error: job_requests_user_id_fkey foreign key constraint not found

-- 1. Check if foreign key exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'job_requests_user_id_fkey'
        AND table_name = 'job_requests'
    ) THEN
        -- Add foreign key constraint
        ALTER TABLE public.job_requests
        ADD CONSTRAINT job_requests_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.profiles(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Foreign key job_requests_user_id_fkey created successfully';
    ELSE
        RAISE NOTICE 'Foreign key job_requests_user_id_fkey already exists';
    END IF;
END $$;

-- 2. Verify the foreign key was created
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'job_requests'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.constraint_name = 'job_requests_user_id_fkey';

-- Expected output:
-- constraint_name: job_requests_user_id_fkey
-- table_name: job_requests
-- column_name: user_id
-- foreign_table_name: profiles
-- foreign_column_name: id

-- 3. Test the join query
SELECT 
    jr.id,
    jr.user_id,
    jr.status,
    p.full_name,
    p.phone
FROM public.job_requests jr
LEFT JOIN public.profiles p ON jr.user_id = p.id
LIMIT 5;

-- If this query works, the foreign key is set up correctly!

-- ============================================
-- DONE! The foreign key should now work
-- ============================================
