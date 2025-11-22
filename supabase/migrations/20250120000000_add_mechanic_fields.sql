-- Add comprehensive mechanic fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS services TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS work_location TEXT,
ADD COLUMN IF NOT EXISTS pincode TEXT,
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS bank_ifsc TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_branch TEXT,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '{}';

-- Create index for verification status
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON public.profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON public.profiles(role, status);

-- Add media field to job_requests for vehicle issue images/videos
ALTER TABLE public.job_requests
ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT '{}';

-- Create mechanic_verification_logs table for admin tracking
CREATE TABLE IF NOT EXISTS public.mechanic_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'blocked')),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on verification logs
ALTER TABLE public.mechanic_verification_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for verification logs
CREATE POLICY "Admins can view all verification logs"
ON public.mechanic_verification_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create verification logs"
ON public.mechanic_verification_logs
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update profiles to include document structure
-- documents JSONB will store: { aadhar: "path", pan: "path", skill_cert: "path", passbook: "path", profile_photo: "path" }

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.services IS 'Array of services offered by mechanic (e.g., ["engine_repair", "battery_replacement"])';
COMMENT ON COLUMN public.profiles.work_location IS 'Working area/location name';
COMMENT ON COLUMN public.profiles.pincode IS 'Pincode of working area';
COMMENT ON COLUMN public.profiles.verification_status IS 'Verification status: pending, approved, rejected';
COMMENT ON COLUMN public.profiles.documents IS 'JSON object with document paths: {aadhar, pan, skill_cert, passbook, profile_photo}';
COMMENT ON COLUMN public.job_requests.media_urls IS 'Array of media URLs (images/videos) of vehicle issue';

