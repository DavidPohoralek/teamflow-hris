-- Add is_evening flag to work_plans so each shift can be individually marked as evening.
-- Replaces the old company-settings-based time-threshold approach.
ALTER TABLE work_plans ADD COLUMN IF NOT EXISTS is_evening BOOLEAN DEFAULT false;
