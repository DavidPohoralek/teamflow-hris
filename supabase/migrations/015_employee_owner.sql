-- Majitel (owner): může rozdávat bonusy manažerům a vidí přehled všech bonusů.
-- Označuje ho admin ve formuláři zaměstnance. Aditivní — nemění employee_bonuses.
alter table employees add column if not exists is_owner boolean not null default false;
