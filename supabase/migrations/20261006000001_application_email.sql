-- AI-drafted application email (to / subject / body), editable by the user.
alter table public.applications
  add column email_draft jsonb check (email_draft is null or jsonb_typeof(email_draft) = 'object');
