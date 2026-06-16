create extension if not exists "uuid-ossp";

create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  role text not null default 'employee' check (role in ('owner', 'admin', 'manager', 'employee')),
  avatar_url text,
  created_at timestamptz default now()
);

create table employees (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  name text not null,
  email text,
  phone text,
  department text,
  position text,
  labels text[] default '{}',
  tier integer default 0,
  can_saturday boolean default false,
  max_saturdays integer default 0,
  target_hours integer default 160,
  active boolean default true,
  created_at timestamptz default now()
);

create table work_plans (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  date date not null,
  work_type text not null,
  start_time text,
  end_time text,
  note text,
  active boolean default true,
  created_at timestamptz default now()
);

create table schedule_days (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  draft text not null default 'A' check (draft in ('A', 'B')),
  date date not null,
  day_name text,
  day_type text default 'Pracovní',
  required_total integer default 0,
  assigned_employees jsonb default '[]',
  assigned_count integer default 0,
  status text default 'open',
  notes text,
  created_at timestamptz default now(),
  unique(organization_id, draft, date)
);

create table attendance_logs (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  date date not null,
  check_in timestamptz,
  check_out timestamptz,
  note text,
  created_at timestamptz default now()
);

create table requests (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  type text not null check (type in ('vacation', 'sick', 'correction', 'other')),
  date_from date not null,
  date_to date,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at timestamptz default now()
);

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  title text not null,
  body text,
  type text default 'info',
  read boolean default false,
  created_at timestamptz default now()
);

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table employees enable row level security;
alter table work_plans enable row level security;
alter table schedule_days enable row level security;
alter table attendance_logs enable row level security;
alter table requests enable row level security;
alter table notifications enable row level security;

create policy "org_insert" on organizations
  for insert with check (auth.uid() is not null);

create policy "org_select" on organizations
  for select using (
    id = (select organization_id from profiles where id = auth.uid())
  );

create policy "org_update" on organizations
  for update using (
    id = (select organization_id from profiles where id = auth.uid())
  );

create policy "own_profile_all" on profiles
  for all using (id = auth.uid());

create policy "org_profiles_select" on profiles
  for select using (
    organization_id = (select organization_id from profiles where id = auth.uid())
  );

create policy "org_isolation" on employees for all using (
  organization_id = (select organization_id from profiles where id = auth.uid())
);

create policy "org_isolation" on work_plans for all using (
  organization_id = (select organization_id from profiles where id = auth.uid())
);

create policy "org_isolation" on schedule_days for all using (
  organization_id = (select organization_id from profiles where id = auth.uid())
);

create policy "org_isolation" on attendance_logs for all using (
  organization_id = (select organization_id from profiles where id = auth.uid())
);

create policy "org_isolation" on requests for all using (
  organization_id = (select organization_id from profiles where id = auth.uid())
);

create policy "org_isolation" on notifications for all using (
  organization_id = (select organization_id from profiles where id = auth.uid())
);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
