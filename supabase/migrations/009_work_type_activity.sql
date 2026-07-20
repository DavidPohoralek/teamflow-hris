-- Add benefit_key to work_types so activity types can be linked to benefit tracking
-- benefit_key: 'blood' | 'english' | 'gym' | NULL (for activities without a benefit)
ALTER TABLE work_types ADD COLUMN IF NOT EXISTS benefit_key TEXT;
