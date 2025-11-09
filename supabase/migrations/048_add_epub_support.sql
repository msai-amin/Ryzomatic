-- 048_add_epub_support.sql
-- Extend user_books.file_type to include EPUB support and align storage constraints

-- Allow EPUB alongside existing PDF/Text types
ALTER TABLE user_books
  DROP CONSTRAINT IF EXISTS user_books_file_type_check;

ALTER TABLE user_books
  ADD CONSTRAINT user_books_file_type_check
  CHECK (file_type IN ('pdf', 'text', 'epub'));

-- Ensure EPUB files follow the same storage requirements as PDFs
ALTER TABLE user_books
  DROP CONSTRAINT IF EXISTS user_books_file_storage_check;

ALTER TABLE user_books
  ADD CONSTRAINT user_books_file_storage_check
  CHECK (
    (file_type IN ('pdf', 'epub') AND s3_key IS NOT NULL) OR
    (file_type = 'text' AND (text_content IS NOT NULL OR s3_key IS NOT NULL))
  );

