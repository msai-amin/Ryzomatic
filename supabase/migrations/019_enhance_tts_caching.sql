-- Enhanced TTS audio cache table
-- Replaces old user_audio table with comprehensive caching support

-- Drop old user_audio table (replace with enhanced version)
DROP TABLE IF EXISTS user_audio CASCADE;

-- Enhanced TTS audio cache table
CREATE TABLE tts_audio_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES user_books(id) ON DELETE CASCADE NOT NULL,
  
  -- Content identification
  content_hash TEXT NOT NULL,              -- SHA-256 hash of text content for deduplication
  text_content TEXT NOT NULL,              -- Original text (for verification)
  
  -- Playback scope
  scope_type TEXT NOT NULL CHECK (scope_type IN ('paragraph', 'page', 'document', 'selection')),
  page_number INTEGER,                     -- NULL for document-level
  paragraph_index INTEGER,                 -- NULL for page/document-level
  start_char INTEGER,                      -- For selections
  end_char INTEGER,                        -- For selections
  
  -- Audio data (choose one approach based on size)
  audio_data_base64 TEXT,                  -- For smaller clips (<1MB)
  audio_storage_url TEXT,                  -- S3 URL for larger files
  audio_format TEXT DEFAULT 'mp3',         -- mp3, wav, ogg
  
  -- Metadata
  duration_seconds DECIMAL(8,2) NOT NULL,
  file_size_bytes INTEGER,
  
  -- Voice settings used for generation (for cache invalidation)
  voice_name TEXT NOT NULL,
  voice_language TEXT,
  voice_gender TEXT,
  speaking_rate DECIMAL(3,2) DEFAULT 1.00,
  pitch DECIMAL(3,2) DEFAULT 0.00,
  volume_gain DECIMAL(3,2) DEFAULT 0.00,
  provider TEXT NOT NULL CHECK (provider IN ('native', 'google-cloud')),
  
  -- Cache management
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Composite unique constraint for deduplication
  UNIQUE(user_id, book_id, content_hash, voice_name, speaking_rate, pitch)
);

-- Indexes for fast lookups
CREATE INDEX idx_tts_cache_user_book ON tts_audio_cache(user_id, book_id);
CREATE INDEX idx_tts_cache_content_hash ON tts_audio_cache(content_hash);
CREATE INDEX idx_tts_cache_page_para ON tts_audio_cache(book_id, page_number, paragraph_index) WHERE page_number IS NOT NULL;
CREATE INDEX idx_tts_cache_scope_type ON tts_audio_cache(scope_type);
CREATE INDEX idx_tts_cache_last_accessed ON tts_audio_cache(last_accessed_at DESC);

-- RLS Policies
ALTER TABLE tts_audio_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own TTS cache" ON tts_audio_cache
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own TTS cache" ON tts_audio_cache
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own TTS cache" ON tts_audio_cache
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own TTS cache" ON tts_audio_cache
  FOR DELETE USING (auth.uid() = user_id);

-- Function to clean old cache entries (keep last 30 days or top 1000 by access)
CREATE OR REPLACE FUNCTION cleanup_old_tts_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM tts_audio_cache
  WHERE id NOT IN (
    SELECT id FROM tts_audio_cache
    WHERE last_accessed_at > NOW() - INTERVAL '30 days'
    UNION
    SELECT id FROM (
      SELECT id FROM tts_audio_cache
      ORDER BY access_count DESC, last_accessed_at DESC
      LIMIT 1000
    ) top_accessed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment access count and update last accessed time
CREATE OR REPLACE FUNCTION increment_tts_cache_access(cache_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE tts_audio_cache
  SET 
    access_count = access_count + 1,
    last_accessed_at = NOW()
  WHERE id = cache_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
