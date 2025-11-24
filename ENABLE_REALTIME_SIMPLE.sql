-- ✅ GOOD NEWS: The error "already member of publication" means real-time IS ENABLED!
-- Real-time is already enabled for chat_messages table ✅

-- Just verify it's enabled (this should show "chat_messages"):
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'chat_messages';

-- If you see "chat_messages" in results, real-time is working!
-- Now check your browser console for subscription status

-- OR Method 2: Safe version (checks first, won't error if already added)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'chat_messages'
    AND schemaname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
    RAISE NOTICE '✅ chat_messages added to realtime publication';
  ELSE
    RAISE NOTICE 'ℹ️ chat_messages already in realtime publication';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '⚠️ Error: %. Make sure chat_messages table exists.', SQLERRM;
END $$;

-- Verify it worked:
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'chat_messages';

-- If you see "chat_messages" in the results, real-time is enabled! ✅

