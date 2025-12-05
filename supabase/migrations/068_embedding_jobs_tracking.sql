-- Migration: Embedding Generation Job Tracking
-- Tracks pending embedding generation jobs for notes and highlights
-- Date: 2025-01-27

-- ============================================================================
-- EMBEDDING GENERATION JOBS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS embedding_generation_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Job target
  item_type TEXT NOT NULL CHECK (item_type IN ('note', 'highlight')),
  item_id UUID NOT NULL,
  
  -- Job status
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  priority INTEGER DEFAULT 5, -- 1-10, higher = more important
  
  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_embedding_jobs_user_id ON embedding_generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_status ON embedding_generation_jobs(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_priority ON embedding_generation_jobs(priority DESC, created_at ASC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_item ON embedding_generation_jobs(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_created ON embedding_generation_jobs(created_at DESC);

-- Partial unique index to ensure one pending job per item
CREATE UNIQUE INDEX IF NOT EXISTS idx_embedding_jobs_unique_pending 
ON embedding_generation_jobs(item_type, item_id) 
WHERE status IN ('pending', 'processing');

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE embedding_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own embedding jobs" ON embedding_generation_jobs
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Service role can manage embedding jobs" ON embedding_generation_jobs
  FOR ALL USING (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to queue an embedding generation job
CREATE OR REPLACE FUNCTION queue_embedding_job(
  p_user_id UUID,
  p_item_type TEXT,
  p_item_id UUID,
  p_priority INTEGER DEFAULT 5
)
RETURNS UUID AS $$
DECLARE
  job_id UUID;
BEGIN
  INSERT INTO embedding_generation_jobs (
    user_id,
    item_type,
    item_id,
    status,
    priority
  )
  VALUES (
    p_user_id,
    p_item_type,
    p_item_id,
    'pending',
    p_priority
  )
  ON CONFLICT (item_type, item_id) 
  WHERE status IN ('pending', 'processing')
  DO UPDATE SET
    priority = GREATEST(embedding_generation_jobs.priority, EXCLUDED.priority),
    updated_at = NOW()
  RETURNING id INTO job_id;
  
  RETURN job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get next batch of pending jobs
CREATE OR REPLACE FUNCTION get_pending_embedding_jobs(
  batch_size INTEGER DEFAULT 50,
  max_priority INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  item_type TEXT,
  item_id UUID,
  priority INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.user_id,
    j.item_type,
    j.item_id,
    j.priority
  FROM embedding_generation_jobs j
  WHERE j.status = 'pending'
    AND j.retry_count < j.max_retries
    AND j.priority <= max_priority
  ORDER BY j.priority DESC, j.created_at ASC
  LIMIT batch_size
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark job as processing
CREATE OR REPLACE FUNCTION start_embedding_job(job_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE embedding_generation_jobs
  SET 
    status = 'processing',
    started_at = NOW(),
    updated_at = NOW()
  WHERE id = job_uuid
    AND status = 'pending';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark job as completed
CREATE OR REPLACE FUNCTION complete_embedding_job(job_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE embedding_generation_jobs
  SET 
    status = 'completed',
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = job_uuid
    AND status = 'processing';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark job as failed
CREATE OR REPLACE FUNCTION fail_embedding_job(
  job_uuid UUID,
  error_msg TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  updated_count INTEGER;
  current_retry_count INTEGER;
  current_max_retries INTEGER;
BEGIN
  SELECT retry_count, max_retries 
  INTO current_retry_count, current_max_retries
  FROM embedding_generation_jobs
  WHERE id = job_uuid;
  
  IF current_retry_count < current_max_retries THEN
    -- Retry: mark as pending again
    UPDATE embedding_generation_jobs
    SET 
      status = 'pending',
      retry_count = current_retry_count + 1,
      error_message = error_msg,
      updated_at = NOW()
    WHERE id = job_uuid;
  ELSE
    -- Max retries reached: mark as failed
    UPDATE embedding_generation_jobs
    SET 
      status = 'failed',
      error_message = error_msg,
      completed_at = NOW(),
      updated_at = NOW()
    WHERE id = job_uuid;
  END IF;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS TO AUTO-QUEUE NEW ITEMS
-- ============================================================================

-- Function to auto-queue note for embedding
CREATE OR REPLACE FUNCTION auto_queue_note_embedding()
RETURNS TRIGGER AS $$
BEGIN
  -- Only queue if embedding is NULL
  IF NEW.embedding IS NULL THEN
    PERFORM queue_embedding_job(
      NEW.user_id,
      'note',
      NEW.id,
      5 -- Default priority
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new notes
DROP TRIGGER IF EXISTS trigger_auto_queue_note_embedding ON user_notes;
CREATE TRIGGER trigger_auto_queue_note_embedding
  AFTER INSERT ON user_notes
  FOR EACH ROW
  WHEN (NEW.embedding IS NULL)
  EXECUTE FUNCTION auto_queue_note_embedding();

-- Function to auto-queue highlight for embedding
CREATE OR REPLACE FUNCTION auto_queue_highlight_embedding()
RETURNS TRIGGER AS $$
BEGIN
  -- Only queue if embedding is NULL
  IF NEW.embedding IS NULL THEN
    PERFORM queue_embedding_job(
      NEW.user_id,
      'highlight',
      NEW.id,
      5 -- Default priority
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for new highlights
DROP TRIGGER IF EXISTS trigger_auto_queue_highlight_embedding ON user_highlights;
CREATE TRIGGER trigger_auto_queue_highlight_embedding
  AFTER INSERT ON user_highlights
  FOR EACH ROW
  WHEN (NEW.embedding IS NULL)
  EXECUTE FUNCTION auto_queue_highlight_embedding();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE embedding_generation_jobs IS 'Tracks pending and in-progress embedding generation jobs for notes and highlights';
COMMENT ON FUNCTION queue_embedding_job IS 'Queues a new embedding generation job or updates priority if already queued';
COMMENT ON FUNCTION get_pending_embedding_jobs IS 'Gets next batch of pending jobs for processing, ordered by priority';

