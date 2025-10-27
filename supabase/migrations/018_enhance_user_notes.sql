-- Enhance user_notes table for SQ3R Research Notes feature
-- Add support for different note types and AI-generated notes

-- Add new columns to user_notes table
ALTER TABLE user_notes 
ADD COLUMN note_type TEXT CHECK (note_type IN ('cornell', 'outline', 'mindmap', 'chart', 'boxing', 'freeform')),
ADD COLUMN note_metadata JSONB DEFAULT '{}',
ADD COLUMN is_ai_generated BOOLEAN DEFAULT FALSE;

-- Create index on note_type for faster queries
CREATE INDEX IF NOT EXISTS idx_user_notes_note_type ON user_notes(book_id, note_type);

-- Create index on is_ai_generated for filtering
CREATE INDEX IF NOT EXISTS idx_user_notes_ai_generated ON user_notes(book_id, is_ai_generated);

-- Update existing notes to have type 'freeform' if they don't have a type
UPDATE user_notes 
SET note_type = 'freeform' 
WHERE note_type IS NULL;

