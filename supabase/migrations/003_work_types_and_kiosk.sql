-- Work types (configurable per organization)
create table work_types (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  color text not null default '#3b82f6',
  icon text default null,
  category text not null default 'shift' check (category in ('shift', 'presence', 'absence')),
  -- shift = pracovní plán (Prodejna, Kancelář, Expedice, HO...)
  -- presence = docházkový typ (stejné nebo jiné)
  -- absence = dovolená, nemoc...
  sort_order integer default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- Add pin_code to employees for kiosk attendance
alter table employees add column if not exists pin_code text default null;

-- Add work_type_id to attendance_logs
alter table attendance_logs add column if not exists work_type_id uuid references work_types(id) on delete set null;
alter table attendance_logs add column if not exists work_type_name text default null;

-- Unique index for upsert on attendance (one record per employee per day)
create unique index if not exists attendance_logs_employee_date_idx on attendance_logs(employee_id, date);

-- RLS for work_types
alter table work_types enable row level security;
create policy "org_isolation" on work_types for all using (
  organization_id = (select organization_id from profiles where id = auth.uid())
);

-- Default work types for new organizations (insert via function)
create or replace function create_default_work_types(org_id uuid)
returns void as $$
begin
  insert into work_types (organization_id, name, color, category, sort_order) values
    (org_id, 'Prodejna',   '#3b82f6', 'shift',    1),
    (org_id, 'Kancelář',   '#8b5cf6', 'shift',    2),
    (org_id, 'Expedice',   '#f59e0b', 'shift',    3),
    (org_id, 'Home Office','#10b981', 'shift',    4),
    (org_id, 'Dovolená',   '#ef4444', 'absence',  5),
    (org_id, 'Nemoc',      '#f97316', 'absence',  6);
end;
$$ language plpgsql security definer;
