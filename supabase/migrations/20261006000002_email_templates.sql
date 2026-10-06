-- The user's own sample emails (one per language) that the AI follows when drafting application emails.
alter table public.profiles
  add column email_templates jsonb not null default '{}'::jsonb check (jsonb_typeof(email_templates) = 'object');
