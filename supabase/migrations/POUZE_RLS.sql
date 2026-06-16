-- Smazání starých politik
drop policy if exists "org_isolation" on organizations;
drop policy if exists "org_isolation" on profiles;
drop policy if exists "org_isolation" on employees;
drop policy if exists "org_isolation" on work_plans;
drop policy if exists "org_isolation" on schedule_days;
drop policy if exists "org_isolation" on attendance_logs;
drop policy if exists "org_isolation" on requests;
drop policy if exists "org_isolation" on notifications;
drop policy if exists "org_insert" on organizations;
drop policy if exists "org_select" on organizations;
drop policy if exists "org_update" on organizations;
drop policy if exists "own_profile_all" on profiles;
drop policy if exists "org_profiles_select" on profiles;

-- Organizations
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

-- Profiles
create policy "own_profile_all" on profiles
  for all using (id = auth.uid());

create policy "org_profiles_select" on profiles
  for select using (
    organization_id = (select organization_id from profiles where id = auth.uid())
  );

-- Ostatní tabulky
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

-- Trigger pro auto-vytvoření profilu při registraci
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
