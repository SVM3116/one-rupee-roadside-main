-- Add onboarding_completed column to profiles table
-- This tracks whether a user has completed the onboarding tour

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN public.profiles.onboarding_completed IS 'Indicates whether the user has completed the onboarding tour';

