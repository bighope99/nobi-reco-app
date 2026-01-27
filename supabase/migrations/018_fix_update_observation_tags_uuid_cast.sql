-- Fix update_observation_tags RPC function to properly cast TEXT to UUID
-- The tag_id column is UUID type but unnest returns TEXT

CREATE OR REPLACE FUNCTION update_observation_tags(
  p_observation_id UUID,
  p_tag_ids TEXT[],
  p_is_auto_tagged BOOLEAN DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete existing tags for this observation
  DELETE FROM _record_tag
  WHERE observation_id = p_observation_id;

  -- Insert new tags if any provided
  IF p_tag_ids IS NOT NULL AND array_length(p_tag_ids, 1) > 0 THEN
    INSERT INTO _record_tag (observation_id, tag_id, is_auto_tagged, confidence_score)
    SELECT
      p_observation_id,
      unnest(p_tag_ids)::uuid,
      p_is_auto_tagged,
      NULL;
  END IF;

  -- If any error occurs, transaction will be automatically rolled back
EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise the error with detailed context
    RAISE EXCEPTION 'Failed to update observation tags for observation_id %: %',
      p_observation_id, SQLERRM;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION update_observation_tags IS
'Atomically updates tags for an observation record. Deletes all existing tags and inserts new ones within a single transaction. Automatically rolls back on any error.';
