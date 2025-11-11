-- Fix ambiguous column reference in update_reading_progress

DROP FUNCTION IF EXISTS update_reading_progress(uuid, int, int);

CREATE OR REPLACE FUNCTION update_reading_progress(
  book_uuid uuid,
  page_num int,
  total_pages_param int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.user_books AS ub
  SET 
    last_read_page = page_num,
    reading_progress = CASE 
      WHEN total_pages_param > 0 THEN LEAST(100, GREATEST(0, (page_num::numeric / total_pages_param::numeric) * 100))
      ELSE COALESCE(ub.reading_progress, 0)
    END,
    last_read_at = NOW()
  WHERE ub.id = book_uuid;
END;
$$;

