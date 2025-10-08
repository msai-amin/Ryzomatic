-- Migration: Move books to S3 storage
-- This removes large columns that cause disk I/O issues
-- Books will now be stored in S3, with only metadata in database

-- Add s3_key column to store S3 location
ALTER TABLE user_books 
ADD COLUMN IF NOT EXISTS s3_key TEXT;

-- Remove large columns that cause disk I/O issues
-- These will be replaced by S3 storage
ALTER TABLE user_books 
DROP COLUMN IF EXISTS pdf_data_base64 CASCADE;

-- Optionally keep page_texts but limit to 50 pages for search/TTS
-- Or remove completely and regenerate on-demand
ALTER TABLE user_books 
DROP COLUMN IF EXISTS page_texts CASCADE;

-- Add index on s3_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_books_s3_key 
ON user_books(s3_key) 
WHERE s3_key IS NOT NULL;

-- Add check constraint to ensure either s3_key or text_content exists
ALTER TABLE user_books
ADD CONSTRAINT check_file_storage 
CHECK (
  (file_type = 'pdf' AND s3_key IS NOT NULL) OR
  (file_type = 'text' AND (text_content IS NOT NULL OR s3_key IS NOT NULL))
);

-- Update table comment
COMMENT ON TABLE user_books IS 'User books with files stored in S3. pdf_data_base64 removed to prevent disk I/O issues.';
COMMENT ON COLUMN user_books.s3_key IS 'S3 key for book file storage. Format: books/{user_id}/{book_id}.{ext}';

-- Create function to get book size from S3
-- This is a placeholder - actual implementation would call S3 API
CREATE OR REPLACE FUNCTION get_book_storage_stats(user_uuid UUID)
RETURNS TABLE (
  total_books BIGINT,
  pdf_books BIGINT,
  text_books BIGINT,
  total_size_bytes BIGINT,
  total_size_mb DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_books,
    COUNT(*) FILTER (WHERE file_type = 'pdf')::BIGINT as pdf_books,
    COUNT(*) FILTER (WHERE file_type = 'text')::BIGINT as text_books,
    COALESCE(SUM(file_size), 0)::BIGINT as total_size_bytes,
    COALESCE(SUM(file_size), 0)::DECIMAL / 1024 / 1024 as total_size_mb
  FROM user_books
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vacuum table to reclaim space
VACUUM FULL user_books;
ANALYZE user_books;

