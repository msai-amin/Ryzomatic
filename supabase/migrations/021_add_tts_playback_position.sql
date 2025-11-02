-- Add playback position tracking to user_books table
ALTER TABLE user_books 
ADD COLUMN IF NOT EXISTS tts_last_position JSONB DEFAULT '{}';

COMMENT ON COLUMN user_books.tts_last_position IS 'Stores last playback position: {page, paragraph, timestamp, mode, progress}';

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_books_tts_position ON user_books(user_id, id) 
WHERE tts_last_position IS NOT NULL;

