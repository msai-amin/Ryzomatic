-- Add text_anchors field to user_highlights table
-- This stores PDF.js text item IDs/indices for improved highlight positioning accuracy and fallback

ALTER TABLE user_highlights
ADD COLUMN IF NOT EXISTS text_anchors JSONB;

-- Add comment explaining the field
COMMENT ON COLUMN user_highlights.text_anchors IS 'Stores PDF.js text item IDs/indices for selected text spans. Used as fallback when coordinate-based positioning fails. Format: {startIndex: number, endIndex: number, itemIds: number[]}';

-- Create index for text_anchors queries (if needed for future features)
CREATE INDEX IF NOT EXISTS idx_user_highlights_text_anchors ON user_highlights USING GIN (text_anchors);

