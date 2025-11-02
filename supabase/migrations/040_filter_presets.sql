-- Migration: Add Filter Presets for Saved Search Combinations
-- Enables users to save and quickly apply frequently used filter combinations
-- Date: 2025-01-27

-- ============================================================================
-- FILTER PRESETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS filter_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Preset metadata
  name TEXT NOT NULL,
  description TEXT,
  
  -- Filter configuration (JSONB for flexibility)
  filter_config JSONB NOT NULL DEFAULT '{}',
  
  -- Display settings
  icon TEXT DEFAULT 'filter',
  color TEXT DEFAULT '#6B7280',
  is_favorite BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate preset names per user
  UNIQUE(user_id, name)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_filter_presets_user ON filter_presets(user_id, display_order);
CREATE INDEX IF NOT EXISTS idx_filter_presets_favorite ON filter_presets(user_id) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_filter_presets_usage ON filter_presets(user_id, last_used_at DESC NULLS LAST);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE filter_presets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for filter_presets
CREATE POLICY "Users can read own filter presets" ON filter_presets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own filter presets" ON filter_presets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own filter presets" ON filter_presets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own filter presets" ON filter_presets
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER update_filter_presets_updated_at
BEFORE UPDATE ON filter_presets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to increment preset usage
CREATE OR REPLACE FUNCTION increment_preset_usage(preset_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.filter_presets
  SET 
    usage_count = usage_count + 1,
    last_used_at = NOW(),
    updated_at = NOW()
  WHERE id = preset_id_param;
END;
$$;

-- Function to get popular presets
CREATE OR REPLACE FUNCTION get_popular_presets(user_id_param UUID, limit_count INTEGER DEFAULT 5)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  filter_config JSONB,
  icon TEXT,
  color TEXT,
  usage_count INTEGER,
  last_used_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    id,
    name,
    description,
    filter_config,
    icon,
    color,
    usage_count,
    last_used_at
  FROM public.filter_presets
  WHERE user_id = user_id_param
  ORDER BY usage_count DESC, last_used_at DESC NULLS LAST
  LIMIT limit_count;
$$;

-- ============================================================================
-- SAMPLE FILTER PRESETS (Optional - for power users)
-- ============================================================================

-- Note: Users can create their own presets via UI
-- These are just examples if you want to seed defaults

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE filter_presets IS 
  'User-defined filter presets for quick access to saved search combinations';

COMMENT ON COLUMN filter_presets.filter_config IS 
  'JSONB configuration matching LibraryFilters interface structure';

COMMENT ON COLUMN filter_presets.usage_count IS 
  'Track how many times this preset has been used';

COMMENT ON FUNCTION increment_preset_usage IS 
  'Increments usage counter and updates last_used_at timestamp';

COMMENT ON FUNCTION get_popular_presets IS 
  'Returns most frequently used presets for quick access';

