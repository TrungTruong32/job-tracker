-- Job Tracker v1 schema

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- stages ---------------------------------------------------------------
create table public.stages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(trim(name)) > 0),
  position int not null default 0,
  kind text not null default 'active' check (kind in ('active', 'offer', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stages_user_idx on public.stages (user_id, position);

-- cv_versions ----------------------------------------------------------
create table public.cv_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(trim(name)) > 0),
  file_path text,
  file_type text check (file_type in ('pdf', 'tex')),
  extracted_text text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index cv_versions_one_default on public.cv_versions (user_id) where is_default;

-- applications ---------------------------------------------------------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  company text not null check (length(trim(company)) > 0),
  position text not null check (length(trim(position)) > 0),
  source text,
  jd_url text,
  jd_text text,
  salary text,
  location text,
  applied_at date not null default current_date,
  stage_id uuid not null references public.stages on delete restrict,
  cv_version_id uuid references public.cv_versions on delete restrict,
  next_action text,
  next_action_due date,
  ai_summary jsonb,
  ai_fit jsonb,
  last_activity_at timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector('simple',
      coalesce(company, '') || ' ' || coalesce(position, '') || ' ' || coalesce(jd_text, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index applications_user_idx on public.applications (user_id, applied_at desc);
create index applications_search_idx on public.applications using gin (search);

-- stage_events ---------------------------------------------------------
create table public.stage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  application_id uuid not null references public.applications on delete cascade,
  stage_id uuid references public.stages on delete set null,
  event_date date not null default current_date,
  type text not null default 'note' check (type in ('stage_change', 'note', 'interview')),
  interviewer text,
  notes text,
  questions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stage_events_app_idx on public.stage_events (application_id, event_date desc);

-- settings -------------------------------------------------------------
create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  ai_provider text not null default 'openrouter'
    check (ai_provider in ('openrouter', 'gemini', 'ollama', 'custom')),
  ai_base_url text,
  ai_model text,
  ai_api_key_encrypted text,
  stale_days int not null default 7 check (stale_days between 1 and 90),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- triggers + RLS -------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['stages', 'cv_versions', 'applications', 'stage_events', 'settings'] loop
    execute format('create trigger %I_updated before update on public.%I
      for each row execute function public.set_updated_at()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own_select" on public.%I for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy "own_insert" on public.%I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('create policy "own_update" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "own_delete" on public.%I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;

-- first-login seed (idempotent) ----------------------------------------
create or replace function public.ensure_user_setup()
returns void language plpgsql security invoker as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  insert into public.settings (user_id) values (uid) on conflict do nothing;
  if not exists (select 1 from public.stages where user_id = uid) then
    insert into public.stages (user_id, name, position, kind) values
      (uid, 'Đã nộp', 0, 'active'),
      (uid, 'Screening', 1, 'active'),
      (uid, 'Test', 2, 'active'),
      (uid, 'PV1', 3, 'active'),
      (uid, 'PV2', 4, 'active'),
      (uid, 'Offer', 5, 'offer'),
      (uid, 'Rejected', 6, 'closed'),
      (uid, 'Ghosted', 7, 'closed');
  end if;
end $$;
grant execute on function public.ensure_user_setup() to authenticated;

-- move an application to another stage + log it, atomically
create or replace function public.move_application(p_app uuid, p_stage uuid, p_date date default current_date)
returns void language plpgsql security invoker as $$
begin
  update public.applications
     set stage_id = p_stage, last_activity_at = now()
   where id = p_app;
  if not found then
    raise exception 'application not found';
  end if;
  insert into public.stage_events (application_id, stage_id, event_date, type)
  values (p_app, p_stage, p_date, 'stage_change');
end $$;
grant execute on function public.move_application(uuid, uuid, date) to authenticated;

-- storage bucket for CV files: cvs/{user_id}/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cvs', 'cvs', false, 5242880,
        array['application/pdf', 'application/x-tex', 'text/x-tex', 'text/plain', 'application/octet-stream'])
on conflict (id) do nothing;

create policy "cv_files_select" on storage.objects for select to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "cv_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "cv_files_update" on storage.objects for update to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "cv_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);
