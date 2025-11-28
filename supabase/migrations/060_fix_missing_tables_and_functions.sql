-- Migration: Fix Missing Tables and Update Functions
-- Fixes missing pomodoro_sessions and document_descriptions tables
-- Updates functions to work with consolidated schema
-- Date: 2025-01-XX

-- ============================================================================
-- 1. ENSURE DOCUMENT_DESCRIPTIONS TABLE EXISTS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.document_descriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID REFERENCES public.user_books(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- AI-generated description
  description TEXT,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  last_auto_generated_at TIMESTAMPTZ,
  
  -- Vector embedding for similarity search (768 dimensions)
  description_embedding vector(768),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One description per book
  UNIQUE(book_id)
);

-- Indexes for document_descriptions
CREATE INDEX IF NOT EXISTS idx_document_descriptions_book_id 
  ON public.document_descriptions(book_id);
CREATE INDEX IF NOT EXISTS idx_document_descriptions_user_id 
  ON public.document_descriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_document_descriptions_embedding 
  ON public.document_descriptions USING hnsw (description_embedding vector_cosine_ops);

-- RLS for document_descriptions
ALTER TABLE public.document_descriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own document descriptions" ON public.document_descriptions;
DROP POLICY IF EXISTS "Users can create own document descriptions" ON public.document_descriptions;
DROP POLICY IF EXISTS "Users can update own document descriptions" ON public.document_descriptions;
DROP POLICY IF EXISTS "Users can delete own document descriptions" ON public.document_descriptions;

CREATE POLICY "Users can read own document descriptions" ON public.document_descriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own document descriptions" ON public.document_descriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own document descriptions" ON public.document_descriptions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own document descriptions" ON public.document_descriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_document_descriptions_updated_at ON public.document_descriptions;
CREATE TRIGGER update_document_descriptions_updated_at 
  BEFORE UPDATE ON public.document_descriptions
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. ENSURE READING_SESSIONS HAS POMODORO FIELDS
-- ============================================================================

-- Add Pomodoro fields to reading_sessions if they don't exist
ALTER TABLE reading_sessions 
ADD COLUMN IF NOT EXISTS is_pomodoro BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pomodoro_mode TEXT CHECK (pomodoro_mode IN ('work', 'shortBreak', 'longBreak'));

CREATE INDEX IF NOT EXISTS idx_reading_sessions_pomodoro ON reading_sessions(user_id, is_pomodoro);

-- ============================================================================
-- 3. RECREATE POMODORO_SESSIONS TABLE (for backward compatibility)
-- ============================================================================

-- Recreate pomodoro_sessions table if it doesn't exist
-- This provides backward compatibility while code is being migrated
CREATE TABLE IF NOT EXISTS public.pomodoro_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES user_books(id) ON DELETE CASCADE NOT NULL,
  
  -- Session timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  
  -- Session metadata
  mode TEXT NOT NULL CHECK (mode IN ('work', 'shortBreak', 'longBreak')),
  completed BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for pomodoro_sessions
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_id ON pomodoro_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_book_id ON pomodoro_sessions(book_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_started_at ON pomodoro_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_book ON pomodoro_sessions(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_active ON pomodoro_sessions(user_id) WHERE ended_at IS NULL;

-- RLS for pomodoro_sessions
ALTER TABLE pomodoro_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own pomodoro sessions" ON pomodoro_sessions;
DROP POLICY IF EXISTS "Users can create own pomodoro sessions" ON pomodoro_sessions;
DROP POLICY IF EXISTS "Users can update own pomodoro sessions" ON pomodoro_sessions;
DROP POLICY IF EXISTS "Users can delete own pomodoro sessions" ON pomodoro_sessions;

CREATE POLICY "Users can read own pomodoro sessions" ON pomodoro_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own pomodoro sessions" ON pomodoro_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pomodoro sessions" ON pomodoro_sessions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pomodoro sessions" ON pomodoro_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_pomodoro_sessions_updated_at ON pomodoro_sessions;
CREATE TRIGGER update_pomodoro_sessions_updated_at 
  BEFORE UPDATE ON pomodoro_sessions
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. UPDATE/FIX get_pomodoro_stats_by_book FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pomodoro_stats_by_book(book_uuid UUID)
RETURNS TABLE (
  total_sessions BIGINT,
  total_time_seconds BIGINT,
  total_time_minutes BIGINT,
  total_time_hours BIGINT,
  average_session_minutes NUMERIC,
  completed_sessions BIGINT,
  work_sessions BIGINT,
  break_sessions BIGINT,
  last_session_at TIMESTAMPTZ
) 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = '' 
AS $$
  SELECT
    COUNT(*) as total_sessions,
    COALESCE(SUM(duration_seconds), 0) as total_time_seconds,
    COALESCE(SUM(duration_seconds), 0) / 60 as total_time_minutes,
    COALESCE(SUM(duration_seconds), 0) / 3600 as total_time_hours,
    COALESCE(AVG(duration_seconds), 0) / 60 as average_session_minutes,
    COUNT(*) FILTER (WHERE completed = true) as completed_sessions,
    COUNT(*) FILTER (WHERE mode = 'work') as work_sessions,
    COUNT(*) FILTER (WHERE mode IN ('shortBreak', 'longBreak')) as break_sessions,
    MAX(started_at) as last_session_at
  FROM public.pomodoro_sessions
  WHERE book_id = book_uuid;
$$;

-- ============================================================================
-- 5. UPDATE/FIX get_daily_pomodoro_stats FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_daily_pomodoro_stats(user_uuid UUID, days_back INT DEFAULT 7)
RETURNS TABLE (
  date DATE,
  total_sessions BIGINT,
  total_time_minutes BIGINT,
  work_sessions BIGINT,
  break_sessions BIGINT
) 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = '' 
AS $$
  SELECT
    DATE(started_at) as date,
    COUNT(*) as total_sessions,
    COALESCE(SUM(duration_seconds), 0) / 60 as total_time_minutes,
    COUNT(*) FILTER (WHERE mode = 'work') as work_sessions,
    COUNT(*) FILTER (WHERE mode IN ('shortBreak', 'longBreak')) as break_sessions
  FROM public.pomodoro_sessions
  WHERE user_id = user_uuid
    AND started_at >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY DATE(started_at)
  ORDER BY date DESC;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.document_descriptions IS 'Stores AI-generated descriptions and vector embeddings for documents to enable semantic search and automatic relationship discovery.';
COMMENT ON TABLE public.pomodoro_sessions IS 'Tracks individual Pomodoro sessions. Note: This table is maintained for backward compatibility. Future versions may consolidate into reading_sessions.';
