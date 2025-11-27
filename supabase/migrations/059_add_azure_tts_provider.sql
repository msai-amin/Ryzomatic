-- Add Azure TTS provider support to tts_audio_cache table
-- Updates the provider CHECK constraint to include 'azure'

-- Drop existing provider constraint if it exists
ALTER TABLE tts_audio_cache 
DROP CONSTRAINT IF EXISTS tts_audio_cache_provider_check;

-- Also try to drop any auto-named constraint
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN 
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'tts_audio_cache'::regclass
          AND contype = 'c'
    LOOP
        IF pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = constraint_record.conname)) LIKE '%provider%' 
           AND pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = constraint_record.conname)) LIKE '%IN%' THEN
            EXECUTE format('ALTER TABLE tts_audio_cache DROP CONSTRAINT %I', constraint_record.conname);
        END IF;
    END LOOP;
END $$;

-- Add the new CHECK constraint with Azure support
ALTER TABLE tts_audio_cache
ADD CONSTRAINT tts_audio_cache_provider_check 
CHECK (provider IN ('native', 'google-cloud', 'azure'));

-- Update comment
COMMENT ON COLUMN tts_audio_cache.provider IS 'TTS provider: native (browser), google-cloud, or azure';
