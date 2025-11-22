-- Create job_requests table
CREATE TABLE public.job_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mechanic_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'on_the_way', 'completed', 'cancelled')),
  user_location JSONB NOT NULL,
  issue_description TEXT,
  vehicle_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create mechanic_locations table for real-time tracking
CREATE TABLE public.mechanic_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mechanic_id UUID NOT NULL UNIQUE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.job_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanic_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for job_requests
CREATE POLICY "Users can view their own job requests"
  ON public.job_requests FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = mechanic_id);

CREATE POLICY "Users can create their own job requests"
  ON public.job_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own job requests"
  ON public.job_requests FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = mechanic_id);

-- RLS Policies for mechanic_locations (publicly readable for tracking)
CREATE POLICY "Anyone can view mechanic locations"
  ON public.mechanic_locations FOR SELECT
  USING (true);

CREATE POLICY "Mechanics can insert their own location"
  ON public.mechanic_locations FOR INSERT
  WITH CHECK (auth.uid() = mechanic_id);

CREATE POLICY "Mechanics can update their location"
  ON public.mechanic_locations FOR UPDATE
  USING (auth.uid() = mechanic_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_job_requests_updated_at
  BEFORE UPDATE ON public.job_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mechanic_locations_updated_at
  BEFORE UPDATE ON public.mechanic_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for mechanic_locations
ALTER PUBLICATION supabase_realtime ADD TABLE public.mechanic_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_requests;