-- ============================================
-- AUTO-CONFIRM ALL EXISTING USERS
-- Run this in Supabase SQL Editor
-- ============================================

-- Auto-confirm all users who haven't confirmed their email
-- Note: confirmed_at is a generated column, so we only update email_confirmed_at
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email_confirmed_at IS NULL;

-- Verify the update
SELECT 
  id,
  email,
  email_confirmed_at,
  confirmed_at,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- ============================================
-- This will auto-confirm all existing users
-- New signups will still need confirmation unless
-- you disable email confirmation in Settings
-- ============================================

