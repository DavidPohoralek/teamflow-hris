-- Add short_long_week flag to employees
-- Employees with this flag enabled are skipped by the shift assistant

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS short_long_week boolean NOT NULL DEFAULT false;
