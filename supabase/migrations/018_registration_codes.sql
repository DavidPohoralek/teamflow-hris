-- Registration is invite-only: a company can only be created with a valid,
-- unused code. Codes are handed out one per company and consumed on use.

create table if not exists registration_codes (
  code        text primary key,
  note        text,                      -- komu byl kód poslán (volitelné)
  created_at  timestamptz not null default now(),
  used_at     timestamptz,               -- vyplní se automaticky při registraci
  used_by_org uuid references organizations(id) on delete set null
);

-- Vygenerování nového kódu (vrátí ho rovnou k odeslání firmě):
--   insert into registration_codes (code, note)
--   values (upper(substr(md5(gen_random_uuid()::text), 1, 8)), 'Firma XY')
--   returning code;
--
-- Přehled kódů:
--   select code, note, created_at, used_at from registration_codes order by created_at desc;
