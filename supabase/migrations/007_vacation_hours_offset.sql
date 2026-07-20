-- Hours of vacation already used outside the system (before system was set up or carry-over).
-- Subtracted from the employee's remaining vacation balance.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS vacation_hours_offset NUMERIC DEFAULT 0;
