-- Slack member ID zaměstnance — pro @zmínky v notifikacích z Asistenta směn
-- (Slack → profil člověka → ⋮ → "Copy member ID", tvar U03ABC123)

alter table employees add column if not exists slack_id text;
