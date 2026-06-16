-- Fix RLS policies for proper registration flow

-- Drop existing policies
drop policy if exists "org_isolation" on organizations;
drop policy if exists "org_isolation" on profiles;
drop policy if exists "org_isolation" on employees;
drop policy if exists "org_isolation" on work_plans;
drop policy if exists "org_isolation" on schedule_days;
drop policy if exists "org_isolation" on attendance_logs;
drop policy if exists "org_isolation" on requests;
drop policy if exists "org_isolation" on notifications;

-- Organizations
-- Any authenticated user can create an org (needed for registration)
create policy "org_insert" on organizations
  for insert with check (auth.uid() is not null);

-- Users can only see/update their own org
create policy "org_select" on organizations
  for select using (
    id = (select organization_id from profiles where id = auth.uid())
  );

create policy "org_update" on organizations
  for update using (
    id = (select organization_id from profiles where id = auth.uid())
  );

-- Profiles
-- Users can always read/update their own profile (needed for registration)
create policy "own_profile_all" on profiles
  for all using (id = auth.uid());

-- Users can also see other profiles in the same org
create policy "org_profiles_select" on profiles
  for select using (
    organization_id = (select organization_id from profiles where id = auth.uid())
  );

-- Employees
create policy "org_isolation" on employees for all using (
  organization_id = (select organization_id from profiles where id = auth.uid())
);

-- Work Plans
create policy "org_isolation" on work_plans for all using (
  organization_id = (select organization_id from profiles where id = auth.uid())
);

-- Schedule Days
create policy "org_isolation" on schedule_days for all using (
  organization_id = (select organization_id from profiles where id = auth.uid())
);

-- Attendance Logs
create policy "org_isolation" on attendance_logs for all using (
  organization_id = (select organization_id from profiles where id = auth.uid())
);

-- Requests
create policy "org_isolation" on requests for all using (
  organization_id = (select organization_id from profiles where id = auth.uid())
);

-- Notifications
create policy "org_isolation" on notifications for all using (
  organization_id = (select organization_id from profiles where id = auth.uid())
);
