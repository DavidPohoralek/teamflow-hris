-- Vacation lives in two tables: a `requests` row (which drives the remaining
-- balance) and one `attendance_logs` row per day (which drives what Docházka
-- shows). Until now nothing tied the two together — the logs were matched back
-- to their request by (employee, note, date range), which meant:
--   * deleting a request could wipe an overlapping request's logs
--   * deleting a request from a path that forgot to delete logs left orphans
--     that no code could ever attribute or clean up
--
-- This column makes the relationship explicit, and `on delete cascade` makes it
-- impossible to lose: whatever removes a vacation request — any endpoint, or a
-- manual DELETE in the SQL editor — takes its attendance logs with it.
--
-- NULL request_id on a vacation-noted log means "entered by hand in Docházka,
-- no request behind it". Those are the ones the app now backfills a request for.

alter table attendance_logs
  add column if not exists request_id uuid references requests(id) on delete cascade;

create index if not exists attendance_logs_request_id_idx
  on attendance_logs(request_id);

-- Backfill: attach every existing vacation log to the approved request covering
-- its date. Where several requests cover the same day (overlapping ranges), the
-- oldest one wins, so the result is deterministic and re-running is a no-op.
update attendance_logs a
set request_id = (
  select r.id
  from requests r
  where r.employee_id = a.employee_id
    and r.organization_id = a.organization_id
    and r.type = 'vacation'
    and r.status = 'approved'
    and a.date between r.date_from and coalesce(r.date_to, r.date_from)
  order by r.created_at
  limit 1
)
where a.request_id is null
  and a.note = 'Placená dovolená';

-- Kolik záznamů dovolené zůstalo bez žádosti (= osiřelé, vzniklé ručně nebo
-- ztracené starým mazáním). Nula je ideál; cokoliv jiného je k prohlédnutí.
--   select e.name, a.date
--   from attendance_logs a
--   join employees e on e.id = a.employee_id
--   where a.note = 'Placená dovolená' and a.request_id is null
--   order by e.name, a.date;
