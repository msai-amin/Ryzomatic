-- Add cleaned texts column to user_books table
-- Stores cleaned text for each page, parallel to page_texts array
-- Used for TTS playback in reading mode when text cleanup has been applied

ALTER TABLE user_books 
ADD COLUMN IF NOT EXISTS page_texts_cleaned TEXT[];

COMMENT ON COLUMN user_books.page_texts_cleaned IS 'Array of cleaned text for each page, parallel to page_texts. Used for TTS playback in reading mode when text cleanup has been applied. Index corresponds to page number (0-indexed).';

-- Add index for efficient querying (though arrays are usually small per row)
CREATE INDEX IF NOT EXISTS idx_user_books_cleaned_texts 
ON user_books(user_id, id) 
WHERE page_texts_cleaned IS NOT NULL AND array_length(page_texts_cleaned, 1) > 0;

