-- Local development only (runs on `supabase db reset`, never on `db push`):
-- let email/password dev logins claim workspace invites.
insert into public.app_flags (key) values ('allow_password_login') on conflict do nothing;
