-- Individual dated benefit entries (one row per visit/day)
-- Replaces the freeform count in employee_benefit_logs with auditable records

CREATE TABLE IF NOT EXISTS benefit_entries (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id      UUID NOT NULL REFERENCES employees(id)     ON DELETE CASCADE,
  benefit_key      TEXT NOT NULL,
  date             DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT benefit_entries_unique_day
    UNIQUE (organization_id, employee_id, benefit_key, date)
);

CREATE INDEX IF NOT EXISTS benefit_entries_org_month
  ON benefit_entries (organization_id, date);
