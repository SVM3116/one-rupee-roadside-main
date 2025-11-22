-- ============================================
-- SETUP LIVE LOCATION TRACKING FOR USERS AND MECHANICS
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- CREATE USER_LOCATIONS TABLE (for users)
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_locations
DROP POLICY IF EXISTS "Users can manage their own location" ON public.user_locations;
CREATE POLICY "Users can manage their own location"
  ON public.user_locations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Mechanics can view user locations for assigned jobs" ON public.user_locations;
CREATE POLICY "Mechanics can view user locations for assigned jobs"
  ON public.user_locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_requests
      WHERE job_requests.user_id = user_locations.user_id
        AND job_requests.mechanic_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all user locations" ON public.user_locations;
CREATE POLICY "Admins can view all user locations"
  ON public.user_locations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON public.user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_updated_at ON public.user_locations(updated_at);

-- ============================================
-- ENSURE MECHANIC_LOCATIONS TABLE EXISTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.mechanic_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(mechanic_id)
);

-- Enable RLS (if not already enabled)
ALTER TABLE public.mechanic_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mechanic_locations (if not exist)
DROP POLICY IF EXISTS "Mechanics can manage their own location" ON public.mechanic_locations;
CREATE POLICY "Mechanics can manage their own location"
  ON public.mechanic_locations FOR ALL
  USING (auth.uid() = mechanic_id)
  WITH CHECK (auth.uid() = mechanic_id);

DROP POLICY IF EXISTS "Users can view mechanic locations for their jobs" ON public.mechanic_locations;
CREATE POLICY "Users can view mechanic locations for their jobs"
  ON public.mechanic_locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_requests
      WHERE job_requests.mechanic_id = mechanic_locations.mechanic_id
        AND job_requests.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all mechanic locations" ON public.mechanic_locations;
CREATE POLICY "Admins can view all mechanic locations"
  ON public.mechanic_locations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can view online mechanic locations" ON public.mechanic_locations;
CREATE POLICY "Anyone can view online mechanic locations"
  ON public.mechanic_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = mechanic_locations.mechanic_id
        AND profiles.availability_status = 'online'
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mechanic_locations_mechanic_id ON public.mechanic_locations(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mechanic_locations_updated_at ON public.mechanic_locations(updated_at);

-- ============================================
-- DONE!
-- ============================================

