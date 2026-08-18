-- Manager-login brute-force protection: record failed /api/public/verify-manager
-- attempts per client IP so the route can lock an IP out after too many misses
-- within a time window. Only failures are stored; a successful login clears the
-- IP's rows. Safe to run anytime — the route fails open if this table is absent.

create table if not exists manager_login_attempts (
  id         uuid primary key default gen_random_uuid(),
  ip         text not null,
  org_id     uuid,
  created_at timestamptz not null default now()
);

-- The route counts recent rows for one IP, so index by (ip, created_at).
create index if not exists idx_mla_ip_created
  on manager_login_attempts (ip, created_at desc);
