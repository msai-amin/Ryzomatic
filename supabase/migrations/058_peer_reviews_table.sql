-- Migration: Peer Reviews Table
-- Stores peer review data for academic journal articles
-- Date: 2025-01-XX

-- ============================================================================
-- PEER REVIEWS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS peer_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES user_books(id) ON DELETE CASCADE NOT NULL,
  
  -- Review content (HTML format from TipTap editor)
  review_content TEXT NOT NULL DEFAULT '',
  
  -- Citations array (text snippets from PDF selections)
  citations TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Editor settings
  font_family TEXT DEFAULT 'Times New Roman' CHECK (font_family IN (
    'Times New Roman',
    'Arial',
    'Helvetica',
    'Georgia',
    'Courier New',
    'Verdana',
    'Calibri',
    'Garamond'
  )),
  font_size INTEGER DEFAULT 12 CHECK (font_size >= 8 AND font_size <= 24),
  theme TEXT DEFAULT 'dark' CHECK (theme IN ('light', 'dark')),
  
  -- Review metadata
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'archived')),
  submitted_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one review per user per document (can be updated)
  UNIQUE(user_id, book_id)
);

-- Indexes for performance
CREATE INDEX idx_peer_reviews_user_id ON peer_reviews(user_id);
CREATE INDEX idx_peer_reviews_book_id ON peer_reviews(book_id);
CREATE INDEX idx_peer_reviews_status ON peer_reviews(status);
CREATE INDEX idx_peer_reviews_created_at ON peer_reviews(created_at DESC);
CREATE INDEX idx_peer_reviews_updated_at ON peer_reviews(updated_at DESC);

-- Full-text search index for review content
CREATE INDEX idx_peer_reviews_content_fts ON peer_reviews USING gin(to_tsvector('english', review_content));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_peer_reviews_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger to auto-update updated_at
CREATE TRIGGER peer_reviews_updated_at_trigger
  BEFORE UPDATE ON peer_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_peer_reviews_updated_at();

-- Row Level Security
ALTER TABLE peer_reviews ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own reviews
CREATE POLICY "Users can read own peer reviews" ON peer_reviews
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can create their own reviews
CREATE POLICY "Users can create own peer reviews" ON peer_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own reviews
CREATE POLICY "Users can update own peer reviews" ON peer_reviews
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own reviews
CREATE POLICY "Users can delete own peer reviews" ON peer_reviews
  FOR DELETE USING (auth.uid() = user_id);

-- Comments for documentation
COMMENT ON TABLE peer_reviews IS 'Stores peer review data for academic journal articles. Each user can have one review per document.';
COMMENT ON COLUMN peer_reviews.review_content IS 'HTML content from TipTap rich text editor';
COMMENT ON COLUMN peer_reviews.citations IS 'Array of text citations selected from the PDF';
COMMENT ON COLUMN peer_reviews.font_family IS 'Font family preference for the review editor';
COMMENT ON COLUMN peer_reviews.font_size IS 'Font size in points (8-24)';
COMMENT ON COLUMN peer_reviews.theme IS 'Editor theme preference (light or dark)';
COMMENT ON COLUMN peer_reviews.status IS 'Review status: draft (editing), submitted (finalized), archived (old reviews)';

