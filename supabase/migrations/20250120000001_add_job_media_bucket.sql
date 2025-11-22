-- Create storage bucket for job media (images/videos of vehicle issues)
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-media', 'job-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for job media
CREATE POLICY "Users can upload job media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view job media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'job-media');

CREATE POLICY "Users can delete their own job media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'job-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

