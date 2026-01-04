-- Add mentioned_children column to r_activity table
-- This column stores encrypted child IDs for mention functionality

-- Add mentioned_children column (array of encrypted tokens)
ALTER TABLE r_activity
ADD COLUMN mentioned_children TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN r_activity.mentioned_children IS '活動記録内でメンションされた子供の暗号化トークンの配列';

-- Create index for faster queries on mentioned_children
CREATE INDEX idx_activity_mentioned_children ON r_activity USING GIN (mentioned_children);
