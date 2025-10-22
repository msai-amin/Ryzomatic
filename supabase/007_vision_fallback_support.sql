-- Migration: Add Vision Extraction Fallback Support
-- Date: 2025-10-22
-- Purpose: Track vision extraction usage and costs for hybrid PDF text extraction

-- =====================================================
-- PROFILES TABLE: Add vision extraction tracking
-- =====================================================

-- Add vision extraction tracking columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS vision_pages_monthly INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS vision_last_reset TIMESTAMP DEFAULT NOW();

-- Add comments for documentation
COMMENT ON COLUMN profiles.vision_pages_monthly IS 'Number of pages processed with vision extraction this month';
COMMENT ON COLUMN profiles.vision_last_reset IS 'Timestamp of last monthly vision counter reset';

-- Create index for efficient monthly reset queries
CREATE INDEX IF NOT EXISTS idx_profiles_vision_reset ON profiles(vision_last_reset);

-- =====================================================
-- DOCUMENTS TABLE: Add vision metadata
-- =====================================================

-- Add vision-related columns to documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS vision_pages JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS extraction_method TEXT DEFAULT 'pdfjs';

-- Add comments explaining the columns
COMMENT ON COLUMN documents.vision_pages IS 'Array of page numbers that used vision extraction: [1, 3, 5]';
COMMENT ON COLUMN documents.extraction_method IS 'Primary extraction method used: pdfjs (native), hybrid (mixed), vision (all pages), ocr (full document OCR)';

-- Create index for filtering by extraction method
CREATE INDEX IF NOT EXISTS idx_documents_extraction_method ON documents(extraction_method);

-- Add check constraint for extraction_method values
ALTER TABLE documents
DROP CONSTRAINT IF EXISTS check_extraction_method;

ALTER TABLE documents
ADD CONSTRAINT check_extraction_method 
CHECK (extraction_method IN ('pdfjs', 'hybrid', 'vision', 'ocr'));

-- =====================================================
-- MONTHLY RESET FUNCTION
-- =====================================================

-- Function to reset monthly vision counters
-- Should be called via cron job or scheduled task
CREATE OR REPLACE FUNCTION reset_monthly_vision_counters()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET vision_pages_monthly = 0,
      vision_last_reset = NOW()
  WHERE vision_last_reset < NOW() - INTERVAL '1 month';
  
  -- Log the reset for monitoring
  RAISE NOTICE 'Monthly vision counters reset for % profiles', 
    (SELECT COUNT(*) FROM profiles WHERE vision_last_reset >= NOW() - INTERVAL '1 second');
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users (if needed)
-- GRANT EXECUTE ON FUNCTION reset_monthly_vision_counters() TO authenticated;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to check if user can perform vision extraction
CREATE OR REPLACE FUNCTION can_perform_vision_extraction(
  user_id UUID,
  page_count INTEGER
)
RETURNS TABLE(
  allowed BOOLEAN,
  reason TEXT,
  current_usage INTEGER,
  monthly_limit INTEGER,
  credits_available NUMERIC,
  credits_needed NUMERIC
) AS $$
DECLARE
  user_tier TEXT;
  user_credits NUMERIC;
  user_vision_count INTEGER;
  tier_limit INTEGER;
  credits_required NUMERIC;
BEGIN
  -- Get user profile
  SELECT tier, credits, vision_pages_monthly
  INTO user_tier, user_credits, user_vision_count
  FROM profiles
  WHERE id = user_id;

  -- If user not found
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'User not found'::TEXT, 0, 0, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  -- Determine tier limits
  tier_limit := CASE user_tier
    WHEN 'free' THEN 20
    WHEN 'pro' THEN 200
    WHEN 'premium' THEN 1000
    WHEN 'enterprise' THEN -1 -- unlimited
    ELSE 20 -- default to free tier
  END;

  -- Calculate credits needed (0.1 per page, except enterprise)
  credits_required := CASE 
    WHEN user_tier = 'enterprise' THEN 0
    ELSE page_count * 0.1
  END;

  -- Check monthly limit (if not unlimited)
  IF tier_limit != -1 AND (user_vision_count + page_count) > tier_limit THEN
    RETURN QUERY SELECT 
      false,
      'Monthly vision extraction limit exceeded'::TEXT,
      user_vision_count,
      tier_limit,
      user_credits,
      credits_required;
    RETURN;
  END IF;

  -- Check credits (if not enterprise)
  IF user_tier != 'enterprise' AND user_credits < credits_required THEN
    RETURN QUERY SELECT 
      false,
      'Insufficient credits'::TEXT,
      user_vision_count,
      tier_limit,
      user_credits,
      credits_required;
    RETURN;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT 
    true,
    'Allowed'::TEXT,
    user_vision_count,
    tier_limit,
    user_credits,
    credits_required;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STATISTICS VIEW
-- =====================================================

-- View for vision extraction statistics
CREATE OR REPLACE VIEW vision_extraction_stats AS
SELECT 
  p.tier,
  COUNT(*) as user_count,
  SUM(p.vision_pages_monthly) as total_pages_this_month,
  AVG(p.vision_pages_monthly) as avg_pages_per_user,
  COUNT(CASE WHEN p.vision_pages_monthly > 0 THEN 1 END) as active_users
FROM profiles p
GROUP BY p.tier;

-- View for document extraction methods
CREATE OR REPLACE VIEW document_extraction_stats AS
SELECT 
  extraction_method,
  COUNT(*) as document_count,
  COUNT(CASE WHEN vision_pages IS NOT NULL AND jsonb_array_length(vision_pages) > 0 THEN 1 END) as docs_with_vision,
  AVG(CASE WHEN vision_pages IS NOT NULL THEN jsonb_array_length(vision_pages) ELSE 0 END) as avg_vision_pages
FROM documents
GROUP BY extraction_method;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for finding documents that used vision extraction
CREATE INDEX IF NOT EXISTS idx_documents_vision_pages ON documents USING GIN (vision_pages);

-- Composite index for user vision usage queries
CREATE INDEX IF NOT EXISTS idx_profiles_vision_usage ON profiles(id, vision_pages_monthly, vision_last_reset);

-- =====================================================
-- MIGRATION VERIFICATION
-- =====================================================

-- Verify the migration was successful
DO $$
BEGIN
  -- Check if columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'vision_pages_monthly'
  ) THEN
    RAISE EXCEPTION 'Migration failed: vision_pages_monthly column not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'documents' AND column_name = 'vision_pages'
  ) THEN
    RAISE EXCEPTION 'Migration failed: vision_pages column not created';
  END IF;

  RAISE NOTICE 'Vision fallback support migration completed successfully';
END $$;

