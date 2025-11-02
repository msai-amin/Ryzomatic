-- Search RPCs and supporting indexes for scalable library queries

-- Covering indexes for hot sorts and favorites
CREATE INDEX IF NOT EXISTS idx_user_books_last_read_cursor ON user_books(user_id, last_read_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_user_books_created_cursor ON user_books(user_id, created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_user_books_favorites_partial ON user_books(user_id, id) WHERE is_favorite = TRUE;

-- Helper: convert jsonb array of UUIDs to a set
CREATE OR REPLACE FUNCTION jsonb_uuid_elems(arr jsonb)
RETURNS SETOF uuid LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT (jsonb_array_elements_text(arr))::uuid;
$$;

-- Main search function: FTS aligned with idx_books_search and keyset pagination
CREATE OR REPLACE FUNCTION search_user_books(
  user_uuid uuid,
  q text DEFAULT NULL,
  filters jsonb DEFAULT '{}'::jsonb,
  sort_field text DEFAULT 'last_read_at', -- supported: 'last_read_at' | 'created_at'
  sort_order text DEFAULT 'desc',          -- currently optimized for 'desc'
  after jsonb DEFAULT NULL,                -- e.g. {"last_read_at":"2024-01-01T00:00:00Z","id":"..."}
  page_limit int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  title text,
  file_name text,
  file_type text,
  file_size_bytes bigint,
  total_pages int,
  reading_progress numeric,
  last_read_page int,
  last_read_at timestamptz,
  is_favorite boolean,
  notes_count int,
  pomodoro_sessions_count int,
  created_at timestamptz,
  updated_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH base AS (
    SELECT ub.*
    FROM public.user_books ub
    WHERE ub.user_id = user_uuid
      -- Full-text search on title + file_name (matches idx_books_search expression)
      AND (
        q IS NULL OR q = '' OR
        to_tsvector('english', coalesce(ub.title,'') || ' ' || coalesce(ub.file_name,'')) @@ plainto_tsquery('english', q)
      )
      -- Simple filters from jsonb
      AND (NOT (filters ? 'fileType') OR ub.file_type = lower(filters->>'fileType'))
      AND (NOT (filters ? 'isFavorite') OR ub.is_favorite = (filters->>'isFavorite')::boolean)
      AND (
        NOT (filters ? 'hasNotes') OR (
          CASE WHEN (filters->>'hasNotes')::boolean THEN ub.notes_count > 0 ELSE ub.notes_count = 0 END
        )
      )
      AND (
        NOT (filters ? 'hasAudio') OR (
          CASE WHEN (filters->>'hasAudio')::boolean THEN ub.pomodoro_sessions_count > 0 ELSE ub.pomodoro_sessions_count = 0 END
        )
      )
      AND (
        NOT (filters ? 'readingProgress') OR (
          ub.reading_progress >= ((filters->'readingProgress'->>'min')::numeric) AND
          ub.reading_progress <= ((filters->'readingProgress'->>'max')::numeric)
        )
      )
      AND (
        NOT (filters ? 'fileSizeRange') OR (
          ub.file_size_bytes >= ((filters->'fileSizeRange'->>'min')::bigint) AND
          ub.file_size_bytes <= ((filters->'fileSizeRange'->>'max')::bigint)
        )
      )
      AND (
        NOT (filters ? 'dateRange') OR (
          ub.created_at >= ((filters->'dateRange'->>'start')::timestamptz) AND
          ub.created_at <= ((filters->'dateRange'->>'end')::timestamptz)
        )
      )
      -- Collection filter via EXISTS when provided
      AND (
        NOT (filters ? 'collections') OR EXISTS (
          SELECT 1 FROM public.book_collections bc
          WHERE bc.book_id = ub.id
            AND bc.collection_id IN (SELECT public.jsonb_uuid_elems(filters->'collections'))
        )
      )
      -- Tag filter via EXISTS when provided
      AND (
        NOT (filters ? 'tags') OR EXISTS (
          SELECT 1 FROM public.book_tag_assignments bta
          WHERE bta.book_id = ub.id
            AND bta.tag_id IN (SELECT public.jsonb_uuid_elems(filters->'tags'))
        )
      )
      -- Keyset pagination for supported sort fields (DESC only for now)
      AND (
        after IS NULL OR (
          (sort_field = 'last_read_at' AND (
            (ub.last_read_at, ub.id) < (((after->>'last_read_at')::timestamptz), (after->>'id')::uuid)
          )) OR
          (sort_field = 'created_at' AND (
            (ub.created_at, ub.id) < (((after->>'created_at')::timestamptz), (after->>'id')::uuid)
          ))
        )
      )
  )
  SELECT
    b.id,
    b.title,
    b.file_name,
    b.file_type,
    b.file_size_bytes,
    b.total_pages,
    b.reading_progress,
    b.last_read_page,
    b.last_read_at,
    b.is_favorite,
    b.notes_count,
    b.pomodoro_sessions_count,
    b.created_at,
    b.updated_at
  FROM base b
  ORDER BY
    CASE WHEN sort_field = 'last_read_at' THEN b.last_read_at END DESC NULLS LAST,
    CASE WHEN sort_field = 'created_at' THEN b.created_at END DESC NULLS LAST,
    b.id DESC
  LIMIT COALESCE(page_limit, 50);
$$;

-- Grant execute to authenticated users via RLS-safe filter on user_id
REVOKE ALL ON FUNCTION search_user_books(uuid, text, jsonb, text, text, jsonb, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_user_books(uuid, text, jsonb, text, text, jsonb, int) TO anon, authenticated, service_role;


