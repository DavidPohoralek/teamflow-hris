-- Skrytí zaměstnance ze sekce Směny: manažer u zaměstnance klikne na očičko a
-- daný člověk se přestane zobrazovat v rozpisu Směn (ale zůstává v systému —
-- docházka, dovolená, analytika ho vidí dál). Aditivní, výchozí = zobrazovat.
alter table employees add column if not exists hidden_from_shifts boolean not null default false;
