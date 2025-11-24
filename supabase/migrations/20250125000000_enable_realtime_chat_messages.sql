-- Enable real-time for chat_messages table
-- This allows real-time subscriptions to work for chat notifications

-- Enable real-time replication for chat_messages table
-- This is required for Supabase real-time subscriptions to work
-- Note: ALTER PUBLICATION doesn't support IF NOT EXISTS, so we use DO block
DO $$ 
BEGIN
  -- Check if table is already in the publication
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'chat_messages'
    AND schemaname = 'public'
  ) THEN
    -- Add table to publication if not already added
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
    RAISE NOTICE '✅ chat_messages table added to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'ℹ️ chat_messages table is already in supabase_realtime publication';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- If table doesn't exist, this will fail - that's okay
    RAISE WARNING '⚠️ Could not add chat_messages to publication: %. Make sure the table exists first.', SQLERRM;
END $$;

-- If the table doesn't exist, create it first
-- (You can comment this out if the table already exists)
/*
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES job_requests(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'mechanic')),
  message TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_request_id ON chat_messages(request_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can read messages for their requests
CREATE POLICY "Users can read their chat messages"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM job_requests
      WHERE job_requests.id = chat_messages.request_id
      AND (job_requests.user_id = auth.uid() OR job_requests.mechanic_id = auth.uid())
    )
  );

-- Create policy: Users can insert their own messages
CREATE POLICY "Users can insert their own messages"
  ON chat_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- Create policy: Users can update read_at for messages they received
CREATE POLICY "Users can update read status"
  ON chat_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM job_requests
      WHERE job_requests.id = chat_messages.request_id
      AND (job_requests.user_id = auth.uid() OR job_requests.mechanic_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM job_requests
      WHERE job_requests.id = chat_messages.request_id
      AND (job_requests.user_id = auth.uid() OR job_requests.mechanic_id = auth.uid())
    )
  );
*/

