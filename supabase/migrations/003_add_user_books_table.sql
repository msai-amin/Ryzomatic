-- User Books table for storing user's uploaded books with TTS metadata
CREATE TABLE user_books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'text')),
  file_size INTEGER NOT NULL,
  
  -- PDF-specific fields
  total_pages INTEGER,
  pdf_data_base64 TEXT, -- Base64 encoded PDF data for storage
  page_texts TEXT[], -- Array of extracted text for each page (for TTS)
  
  -- Text content for text files
  text_content TEXT,
  
  -- TTS metadata
  tts_metadata JSONB DEFAULT '{}', -- Store TTS settings, voice preferences, etc.
  
  -- Reading progress
  last_read_page INTEGER DEFAULT 1,
  reading_progress DECIMAL(5,2) DEFAULT 0.00, -- Percentage (0.00 to 100.00)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ
);

-- Notes table for user annotations
CREATE TABLE user_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES user_books(id) ON DELETE CASCADE NOT NULL,
  page_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  position_x DECIMAL(10,2), -- X coordinate for positioning
  position_y DECIMAL(10,2), -- Y coordinate for positioning
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audio recordings table for TTS audio storage
CREATE TABLE user_audio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES user_books(id) ON DELETE CASCADE NOT NULL,
  page_number INTEGER NOT NULL,
  audio_data_base64 TEXT NOT NULL, -- Base64 encoded audio data
  duration_seconds DECIMAL(8,2), -- Audio duration in seconds
  voice_settings JSONB DEFAULT '{}', -- Voice settings used for generation
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_books_user_id ON user_books(user_id);
CREATE INDEX idx_user_books_created_at ON user_books(created_at DESC);
CREATE INDEX idx_user_books_file_type ON user_books(file_type);
CREATE INDEX idx_user_books_last_read_at ON user_books(last_read_at DESC);

CREATE INDEX idx_user_notes_user_id ON user_notes(user_id);
CREATE INDEX idx_user_notes_book_id ON user_notes(book_id);
CREATE INDEX idx_user_notes_page_number ON user_notes(book_id, page_number);

CREATE INDEX idx_user_audio_user_id ON user_audio(user_id);
CREATE INDEX idx_user_audio_book_id ON user_audio(book_id);
CREATE INDEX idx_user_audio_page_number ON user_audio(book_id, page_number);

-- Row Level Security (RLS)
ALTER TABLE user_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_audio ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_books
CREATE POLICY "Users can read own books" ON user_books
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own books" ON user_books
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own books" ON user_books
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own books" ON user_books
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for user_notes
CREATE POLICY "Users can read own notes" ON user_notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own notes" ON user_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" ON user_notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" ON user_notes
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for user_audio
CREATE POLICY "Users can read own audio" ON user_audio
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own audio" ON user_audio
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own audio" ON user_audio
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own audio" ON user_audio
  FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_user_books_updated_at BEFORE UPDATE ON user_books
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_notes_updated_at BEFORE UPDATE ON user_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update reading progress
CREATE OR REPLACE FUNCTION update_reading_progress(
  book_uuid UUID,
  page_num INTEGER,
  total_pages INTEGER
)
RETURNS void AS $$
BEGIN
  UPDATE user_books 
  SET 
    last_read_page = page_num,
    reading_progress = CASE 
      WHEN total_pages > 0 THEN (page_num::DECIMAL / total_pages::DECIMAL) * 100
      ELSE 0
    END,
    last_read_at = NOW(),
    updated_at = NOW()
  WHERE id = book_uuid AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's reading statistics
CREATE OR REPLACE FUNCTION get_user_reading_stats(user_uuid UUID)
RETURNS TABLE (
  total_books BIGINT,
  total_pages_read BIGINT,
  total_notes BIGINT,
  total_audio_files BIGINT,
  books_read_today BIGINT,
  average_reading_progress DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_books,
    COALESCE(SUM(last_read_page), 0)::BIGINT as total_pages_read,
    (SELECT COUNT(*)::BIGINT FROM user_notes WHERE user_id = user_uuid) as total_notes,
    (SELECT COUNT(*)::BIGINT FROM user_audio WHERE user_id = user_uuid) as total_audio_files,
    COUNT(*) FILTER (WHERE last_read_at > NOW() - INTERVAL '24 hours')::BIGINT as books_read_today,
    COALESCE(AVG(reading_progress), 0)::DECIMAL(5,2) as average_reading_progress
  FROM user_books
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
