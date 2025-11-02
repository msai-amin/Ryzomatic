-- Migration: Standardize field names and clean up schema
-- Removes duplicate file_size column and ensures consistent field usage
-- Date: 2025-01-27

-- Step 1: Ensure all JSONB defaults are properly formatted
-- Some may have been created with inconsistent defaults

-- Update user_books metadata fields
ALTER TABLE user_books 
ALTER COLUMN custom_metadata SET DEFAULT '{}'::jsonb;

ALTER TABLE user_books
ALTER COLUMN ocr_metadata SET DEFAULT '{}'::jsonb;

-- Update user_notes
ALTER TABLE user_notes
ALTER COLUMN note_metadata SET DEFAULT '{}'::jsonb;

-- Update conversations (still in public schema at this point)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations' AND table_schema = 'public') THEN
    ALTER TABLE conversations ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Update messages (still in public schema at this point)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages' AND table_schema = 'public') THEN
    ALTER TABLE messages ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Step 2: Standardize file size handling
-- Note: file_size column was already migrated to file_size_bytes in migration 007
-- This step ensures the old column is dropped if it still exists

-- First, ensure file_size_bytes has data from old file_size before dropping
-- This was already done in migration 007, but ensure it's complete
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_books' AND column_name = 'file_size'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_books' AND column_name = 'file_size_bytes'
  ) THEN
    UPDATE user_books 
    SET file_size_bytes = file_size 
    WHERE file_size_bytes IS NULL AND file_size IS NOT NULL;
  END IF;
END $$;

-- Drop the old file_size column if it exists (keeping file_size_bytes as canonical)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_books' AND column_name = 'file_size'
  ) THEN
    ALTER TABLE user_books DROP COLUMN file_size;
  END IF;
END $$;

-- Step 3: Standardize timestamp column names
-- Ensure all tables have consistent created_at and updated_at columns
-- user_books, user_notes, user_collections, book_tags already have these

-- Verify pomodoro_achievements and pomodoro_streaks have correct column types
ALTER TABLE pomodoro_achievements
ALTER COLUMN unlocked_at TYPE TIMESTAMPTZ USING unlocked_at AT TIME ZONE 'UTC';

ALTER TABLE pomodoro_streaks
ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- Step 4: Add any missing updated_at triggers
-- user_books, user_notes, conversations already have these from base schema
-- Add for any tables that might be missing them

DO $$
BEGIN
  -- Add updated_at trigger for pomodoro_sessions if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_pomodoro_sessions_updated_at'
  ) THEN
    CREATE TRIGGER update_pomodoro_sessions_updated_at 
      BEFORE UPDATE ON pomodoro_sessions
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- Add updated_at trigger for user_highlights if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_highlights_updated_at'
  ) THEN
    CREATE TRIGGER update_user_highlights_updated_at 
      BEFORE UPDATE ON user_highlights
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Step 5: Standardize naming conventions
-- Ensure all boolean columns follow consistent naming (no is_ prefix inconsistency)
-- Ensure all ID columns are consistently named (id, user_id, book_id, etc.)

-- Step 6: Add comments for documentation
COMMENT ON COLUMN user_books.file_size_bytes IS 'File size in bytes (canonical size field, use this instead of file_size)';
COMMENT ON COLUMN user_books.custom_metadata IS 'Flexible JSONB metadata for custom fields (defaults to empty object)';
COMMENT ON COLUMN pomodoro_achievements.unlocked_at IS 'Timestamp when achievement was unlocked (with timezone)';
COMMENT ON COLUMN pomodoro_streaks.updated_at IS 'Last update timestamp (with timezone)';

