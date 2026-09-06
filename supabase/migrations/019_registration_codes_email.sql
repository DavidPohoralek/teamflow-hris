-- Bind a registration code to the e-mail it was issued for, so a leaked or
-- forwarded code can't be redeemed by someone else.
-- NULL e-mail = code works for any address (kept for flexibility).

alter table registration_codes add column if not exists email text;

-- Vygenerování kódu pro konkrétní e-mail:
--   insert into registration_codes (code, email, note)
--   values (upper(substr(md5(gen_random_uuid()::text), 1, 8)), 'jan@pekarna.cz', 'Pekárna Novák')
--   returning code, email;
