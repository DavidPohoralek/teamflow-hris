-- Evidence bonusů — žurnál bonusů od vedoucího
-- Libovolný počet záznamů na zaměstnance a měsíc; historie zůstává navždy.

create table if not exists employee_bonuses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  month text not null,                        -- 'YYYY-MM'
  amount numeric not null default 0,          -- Kč
  note text,
  granted_by text,                            -- jméno manažera, který bonus zadal
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pokud tabulka vznikla starší verzí migrace s unique constraintem, odstraň ho
-- (žurnál povoluje více bonusů na osobu a měsíc)
alter table employee_bonuses
  drop constraint if exists employee_bonuses_organization_id_employee_id_month_key;

create index if not exists idx_employee_bonuses_org_month
  on employee_bonuses (organization_id, month);

-- Přístup jen přes service role (API routes) — stejně jako ostatní tabulky
alter table employee_bonuses enable row level security;
