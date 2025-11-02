-- User Highlights table for storing text highlights in PDFs
CREATE TABLE user_highlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES user_books(id) ON DELETE CASCADE NOT NULL,
  page_number INTEGER NOT NULL,
  highlighted_text TEXT NOT NULL,
  color_id TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  
  -- Position data for PDF canvas mode (stores x, y, width, height)
  position_data JSONB NOT NULL,
  
  -- Text range data for reading mode sync
  text_start_offset INTEGER,
  text_end_offset INTEGER,
  text_context_before TEXT, -- 50 chars before for smart matching
  text_context_after TEXT,  -- 50 chars after for smart matching
  
  -- Orphaned status (when text is edited)
  is_orphaned BOOLEAN DEFAULT FALSE,
  orphaned_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_highlights_user_id ON user_highlights(user_id);
CREATE INDEX idx_user_highlights_book_id ON user_highlights(book_id);
CREATE INDEX idx_user_highlights_page_number ON user_highlights(book_id, page_number);
CREATE INDEX idx_user_highlights_orphaned ON user_highlights(book_id, is_orphaned) WHERE is_orphaned = TRUE;
CREATE INDEX idx_user_highlights_created_at ON user_highlights(created_at DESC);

-- Row Level Security (RLS)
ALTER TABLE user_highlights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_highlights
CREATE POLICY "Users can read own highlights" ON user_highlights
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own highlights" ON user_highlights
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own highlights" ON user_highlights
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own highlights" ON user_highlights
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_highlights_updated_at BEFORE UPDATE ON user_highlights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get highlights for a book
CREATE OR REPLACE FUNCTION get_book_highlights(
  book_uuid UUID,
  include_orphaned BOOLEAN DEFAULT TRUE
)
RETURNS SETOF user_highlights AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM user_highlights
  WHERE book_id = book_uuid
    AND user_id = auth.uid()
    AND (include_orphaned OR is_orphaned = FALSE)
  ORDER BY page_number, created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark highlights as orphaned when page text is edited
CREATE OR REPLACE FUNCTION mark_page_highlights_orphaned(
  book_uuid UUID,
  page_num INTEGER,
  reason TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE user_highlights
  SET 
    is_orphaned = TRUE,
    orphaned_reason = COALESCE(reason, 'Page text was edited on ' || NOW()::DATE),
    updated_at = NOW()
  WHERE book_id = book_uuid
    AND page_number = page_num
    AND user_id = auth.uid()
    AND is_orphaned = FALSE;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get highlight statistics for a book
CREATE OR REPLACE FUNCTION get_highlight_stats(book_uuid UUID)
RETURNS TABLE (
  total_highlights BIGINT,
  orphaned_highlights BIGINT,
  highlights_by_color JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_highlights,
    COUNT(*) FILTER (WHERE is_orphaned = TRUE)::BIGINT as orphaned_highlights,
    jsonb_object_agg(color_id, count) as highlights_by_color
  FROM (
    SELECT 
      color_id,
      COUNT(*)::INTEGER as count
    FROM user_highlights
    WHERE book_id = book_uuid
      AND user_id = auth.uid()
    GROUP BY color_id
  ) color_counts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to bulk delete highlights
CREATE OR REPLACE FUNCTION bulk_delete_highlights(
  highlight_ids UUID[]
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_highlights
  WHERE id = ANY(highlight_ids)
    AND user_id = auth.uid();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

