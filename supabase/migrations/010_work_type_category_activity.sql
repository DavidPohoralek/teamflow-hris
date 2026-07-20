-- Allow 'activity' as a valid work_type category (alongside shift, presence, absence)
ALTER TABLE work_types DROP CONSTRAINT IF EXISTS work_types_category_check;
ALTER TABLE work_types ADD CONSTRAINT work_types_category_check
  CHECK (category IN ('shift', 'presence', 'absence', 'activity'));
