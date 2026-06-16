-- ============================================================
-- MIGRACE 004 — Chybějící sloupce (spusť v Supabase SQL editoru)
-- ============================================================

-- 1) pin_code na zaměstnancích (pro kiosk a zaměstnanecký portál)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pin_code TEXT DEFAULT NULL;

-- 2) vacation_days_per_year na zaměstnancích
ALTER TABLE employees ADD COLUMN IF NOT EXISTS vacation_days_per_year INTEGER DEFAULT 20;

-- 3) work_type_id a work_type_name na work_plans (pro plánování směn s typem)
ALTER TABLE work_plans ADD COLUMN IF NOT EXISTS work_type_id UUID REFERENCES work_types(id) ON DELETE SET NULL;

-- 4) work_type_name na attendance_logs (textový název pro zobrazení)
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS work_type_name TEXT DEFAULT NULL;

-- 5) work_type_id na attendance_logs
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS work_type_id UUID REFERENCES work_types(id) ON DELETE SET NULL;

-- 6) weekend_open v nastavení organizace (pokud tabulka company_settings existuje)
-- Pokud tabulka neexistuje, vytvoříme ji:
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, key)
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'company_settings' AND policyname = 'org_isolation'
  ) THEN
    CREATE POLICY "org_isolation" ON company_settings FOR ALL USING (
      organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
END $$;

-- ============================================================
-- Ověření:  SELECT column_name FROM information_schema.columns
--           WHERE table_name = 'employees';
-- ============================================================
