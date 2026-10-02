-- Job Tracker v1 schema: workspaces own all data; members share it.
--
-- Trust model
-- * Personal workspaces are created only by the server (service role) after it
--   checks ALLOWED_EMAILS — users cannot create workspaces themselves.
-- * Invites are claimed only by Google sign-ins (verified email). Local dev may
--   allow password logins via the `allow_password_login` row in app_flags (supabase/seed.sql).
-- * Every child row carries workspace_id and composite FKs keep references
--   (stage, CV, application) inside the same workspace.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Email of the caller, from the JWT.
create or replace function public.jwt_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- Deployment flags; no policies, so only security-definer code can read them.
create table public.app_flags (key text primary key);
alter table public.app_flags enable row level security;

-- The JWT email can be trusted to claim invites: Google sign-ins, or password
-- logins when explicitly allowed (local development only).
create or replace function public.jwt_email_trusted()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.jwt_email() <> '' and (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'google'
    or exists (select 1 from public.app_flags where key = 'allow_password_login')
  )
$$;

-- workspaces + members --------------------------------------------------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  owner_id uuid not null references auth.users on delete cascade,
  personal boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- one personal workspace per owner (also makes first-login setup race-safe)
create unique index workspaces_one_personal on public.workspaces (owner_id) where personal;

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  email text not null check (email = lower(trim(email)) and email like '%_@_%'),
  user_id uuid references auth.users on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);
create index workspace_members_user_idx on public.workspace_members (user_id);
create index workspace_members_email_idx on public.workspace_members (email);

-- Membership checks bypass RLS (security definer) so policies don't recurse.
create or replace function public.is_member(ws uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  )
$$;

create or replace function public.is_owner(ws uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid() and m.role = 'owner'
  )
$$;

-- Storage folder names are text; a non-uuid folder is simply not a member folder.
create or replace function public.is_member_folder(folder text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  return public.is_member(folder::uuid);
exception when invalid_text_representation then
  return false;
end $$;

-- Member, or holder of a claimable invite: used by the sign-in gate.
create or replace function public.has_workspace_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.user_id = auth.uid()
       or (m.user_id is null and public.jwt_email_trusted() and m.email = public.jwt_email())
  )
$$;

-- data tables -----------------------------------------------------------
create table public.stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  name text not null check (length(trim(name)) > 0),
  position int not null default 0,
  kind text not null default 'active' check (kind in ('active', 'offer', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create index stages_ws_idx on public.stages (workspace_id, position);

create table public.cv_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  name text not null check (length(trim(name)) > 0),
  file_path text,
  file_type text check (file_type in ('pdf', 'tex')),
  extracted_text text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create unique index cv_versions_one_default on public.cv_versions (workspace_id) where is_default;

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  company text not null check (length(trim(company)) > 0),
  position text not null check (length(trim(position)) > 0),
  source text,
  jd_url text,
  jd_text text,
  salary text,
  location text,
  applied_at date not null default current_date,
  stage_id uuid not null,
  cv_version_id uuid,
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
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (stage_id, workspace_id) references public.stages (id, workspace_id) on delete restrict,
  foreign key (cv_version_id, workspace_id) references public.cv_versions (id, workspace_id) on delete restrict
);
create index applications_ws_idx on public.applications (workspace_id, applied_at desc);
create index applications_search_idx on public.applications using gin (search);

create table public.stage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  application_id uuid not null,
  stage_id uuid,
  event_date date not null default current_date,
  type text not null default 'note' check (type in ('stage_change', 'note', 'interview')),
  interviewer text,
  notes text,
  questions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (application_id, workspace_id) references public.applications (id, workspace_id) on delete cascade,
  foreign key (stage_id, workspace_id) references public.stages (id, workspace_id) on delete set null (stage_id)
);
create index stage_events_app_idx on public.stage_events (application_id, event_date desc);
create index stage_events_ws_idx on public.stage_events (workspace_id);

-- events default to their application's workspace (the composite FK enforces it)
create or replace function public.stage_event_workspace()
returns trigger language plpgsql as $$
begin
  if new.workspace_id is null then
    select a.workspace_id into new.workspace_id from public.applications a where a.id = new.application_id;
  end if;
  return new;
end $$;
create trigger stage_events_workspace before insert on public.stage_events
  for each row execute function public.stage_event_workspace();

-- rows never move between workspaces
create or replace function public.workspace_id_immutable()
returns trigger language plpgsql as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id cannot change' using errcode = '42501';
  end if;
  return new;
end $$;

create table public.settings (
  workspace_id uuid primary key references public.workspaces on delete cascade,
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
  foreach t in array array['workspaces', 'stages', 'cv_versions', 'applications', 'stage_events', 'settings'] loop
    execute format('create trigger %I_updated before update on public.%I
      for each row execute function public.set_updated_at()', t, t);
  end loop;
  foreach t in array array['stages', 'cv_versions', 'applications', 'stage_events'] loop
    execute format('create trigger %I_ws_immutable before update of workspace_id on public.%I
      for each row execute function public.workspace_id_immutable()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "member_select" on public.%I for select to authenticated using (public.is_member(workspace_id))', t);
    execute format('create policy "member_insert" on public.%I for insert to authenticated with check (public.is_member(workspace_id))', t);
    execute format('create policy "member_update" on public.%I for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id))', t);
    execute format('create policy "member_delete" on public.%I for delete to authenticated using (public.is_member(workspace_id))', t);
  end loop;
end $$;

alter table public.settings enable row level security;
create policy "member_select" on public.settings for select to authenticated using (public.is_member(workspace_id));
create policy "owner_update" on public.settings for update to authenticated
  using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));

alter table public.workspaces enable row level security;
create policy "member_select" on public.workspaces for select to authenticated using (public.is_member(id));
create policy "owner_update" on public.workspaces for update to authenticated
  using (public.is_owner(id)) with check (owner_id = auth.uid());
revoke update on public.workspaces from authenticated;
grant update (name) on public.workspaces to authenticated;

-- membership rows are written only through invite_member / ensure_user_setup;
-- direct deletes: owner removes members, a member may leave, the owner row stays
alter table public.workspace_members enable row level security;
create policy "member_select" on public.workspace_members for select to authenticated
  using (public.is_member(workspace_id) or user_id = auth.uid());
create policy "remove_member" on public.workspace_members for delete to authenticated
  using (role = 'member' and (public.is_owner(workspace_id) or user_id = auth.uid()));
revoke insert, update on public.workspace_members from authenticated, anon;

-- functions --------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;

-- Server only (service role): create the personal workspace of an allowlisted user.
create or replace function public.create_personal_workspace(p_user uuid, p_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare ws uuid; mail text := lower(trim(p_email));
begin
  select id into ws from public.workspaces where owner_id = p_user and personal;
  if ws is not null then return ws; end if;
  insert into public.workspaces (name, owner_id, personal)
    values ('Workspace của ' || coalesce(nullif(split_part(mail, '@', 1), ''), 'tôi'), p_user, true)
    on conflict (owner_id) where personal do nothing
    returning id into ws;
  if ws is null then  -- lost a race with a concurrent first request
    select id into ws from public.workspaces where owner_id = p_user and personal;
    return ws;
  end if;
  insert into public.workspace_members (workspace_id, email, user_id, role) values (ws, mail, p_user, 'owner')
    on conflict (workspace_id, email) do update set user_id = excluded.user_id, role = 'owner';
  insert into public.settings (workspace_id) values (ws);
  insert into public.stages (workspace_id, name, position, kind) values
    (ws, 'Đã nộp', 0, 'active'),
    (ws, 'Screening', 1, 'active'),
    (ws, 'Test', 2, 'active'),
    (ws, 'PV1', 3, 'active'),
    (ws, 'PV2', 4, 'active'),
    (ws, 'Offer', 5, 'offer'),
    (ws, 'Rejected', 6, 'closed'),
    (ws, 'Ghosted', 7, 'closed');
  return ws;
end $$;
revoke execute on function public.create_personal_workspace(uuid, text) from public, anon, authenticated;
grant execute on function public.create_personal_workspace(uuid, text) to service_role;

-- Owner invites an email to the workspace.
create or replace function public.invite_member(p_ws uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare mail text := lower(trim(p_email));
begin
  if not public.is_owner(p_ws) then
    raise exception 'only the owner can invite' using errcode = '42501';
  end if;
  if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  insert into public.workspace_members (workspace_id, email, role) values (p_ws, mail, 'member');
end $$;

-- On sign-in: claim pending invites addressed to this (trusted) email.
create or replace function public.ensure_user_setup()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if public.jwt_email_trusted() then
    update public.workspace_members set user_id = auth.uid()
     where user_id is null and email = public.jwt_email();
  end if;
end $$;

-- move an application to another stage + log it, atomically (runs under RLS)
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

grant execute on function
  public.is_member(uuid), public.is_owner(uuid), public.is_member_folder(text),
  public.has_workspace_access(), public.invite_member(uuid, text), public.ensure_user_setup(),
  public.move_application(uuid, uuid, date), public.jwt_email(), public.jwt_email_trusted()
  to authenticated;

-- storage bucket for CV files: cvs/{workspace_id}/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cvs', 'cvs', false, 5242880,
        array['application/pdf', 'application/x-tex', 'text/x-tex', 'text/plain', 'application/octet-stream'])
on conflict (id) do nothing;

create policy "cv_files_select" on storage.objects for select to authenticated
  using (bucket_id = 'cvs' and public.is_member_folder((storage.foldername(name))[1]));
create policy "cv_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'cvs' and public.is_member_folder((storage.foldername(name))[1]));
create policy "cv_files_update" on storage.objects for update to authenticated
  using (bucket_id = 'cvs' and public.is_member_folder((storage.foldername(name))[1]));
create policy "cv_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'cvs' and public.is_member_folder((storage.foldername(name))[1]));
