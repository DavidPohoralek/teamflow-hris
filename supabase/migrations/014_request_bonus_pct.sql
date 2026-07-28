-- Bonusové procento u žádosti typu „Ostatní" (výjimečná událost)
-- Zaměstnanec zadá počet hodin (sloupec hours) + bonus %, manažer schvaluje obojí.
alter table requests add column if not exists bonus_pct numeric default null;
