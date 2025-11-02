-- Migration: Add OCR support to profiles and documents tables
-- Date: 2025-10-18

-- Add OCR tracking columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS ocr_count_monthly INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ocr_last_reset TIMESTAMP DEFAULT NOW();

-- Add OCR-related columns to documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS needs_ocr BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ocr_status TEXT DEFAULT 'not_needed',
ADD COLUMN IF NOT EXISTS ocr_metadata JSONB;

-- Add comment explaining ocr_status values
COMMENT ON COLUMN documents.ocr_status IS 'OCR status: not_needed, pending, processing, completed, failed, user_declined';

-- Create index for faster queries on OCR status
CREATE INDEX IF NOT EXISTS idx_documents_ocr_status ON documents(ocr_status) WHERE ocr_status != 'not_needed';

-- Create index for monthly OCR reset queries
CREATE INDEX IF NOT EXISTS idx_profiles_ocr_reset ON profiles(ocr_last_reset);

-- Function to reset monthly OCR counters (can be called via cron or API)
CREATE OR REPLACE FUNCTION reset_monthly_ocr_counters()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET ocr_count_monthly = 0,
      ocr_last_reset = NOW()
  WHERE ocr_last_reset < NOW() - INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql;

-- Add check constraint for ocr_status values
ALTER TABLE documents
DROP CONSTRAINT IF EXISTS check_ocr_status;

ALTER TABLE documents
ADD CONSTRAINT check_ocr_status 
CHECK (ocr_status IN ('not_needed', 'pending', 'processing', 'completed', 'failed', 'user_declined'));

