-- Per-workspace wait per AI model (free models can be slow).
alter table public.settings
  add column ai_timeout_s int not null default 90 check (ai_timeout_s between 15 and 120);
