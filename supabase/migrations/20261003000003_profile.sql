-- Structured career profile per workspace: basics + typed items (see lib/profile/schema.ts).

create table public.profiles (
  workspace_id uuid primary key references public.workspaces on delete cascade,
  basics jsonb not null default '{}'::jsonb check (jsonb_typeof(basics) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  section text not null check (section in
    ('experience', 'education', 'project', 'publication', 'skill', 'certification', 'award', 'language', 'custom')),
  position int not null default 0,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profile_items_ws_idx on public.profile_items (workspace_id, section, position);

create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger profile_items_updated before update on public.profile_items
  for each row execute function public.set_updated_at();
create trigger profiles_ws_immutable before update of workspace_id on public.profiles
  for each row execute function public.workspace_id_immutable();
create trigger profile_items_ws_immutable before update of workspace_id on public.profile_items
  for each row execute function public.workspace_id_immutable();

do $$
declare t text;
begin
  foreach t in array array['profiles', 'profile_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "member_select" on public.%I for select to authenticated using (public.is_member(workspace_id))', t);
    execute format('create policy "member_insert" on public.%I for insert to authenticated with check (public.is_member(workspace_id))', t);
    execute format('create policy "member_update" on public.%I for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id))', t);
    execute format('create policy "member_delete" on public.%I for delete to authenticated using (public.is_member(workspace_id))', t);
  end loop;
end $$;

-- Apply a reviewed CV import in one transaction (runs under the caller's RLS).
--   p_basics:  fields to set on profiles.basics (merged into existing)
--   p_inserts: [{section, position, data, tags}]
--   p_updates: [{id, data}]  (only rows of p_ws are touched)
create or replace function public.import_profile(p_ws uuid, p_basics jsonb, p_inserts jsonb, p_updates jsonb)
returns void language plpgsql security invoker as $$
declare r jsonb;
begin
  if not public.is_member(p_ws) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;
  insert into public.profiles (workspace_id, basics) values (p_ws, coalesce(p_basics, '{}'::jsonb))
    on conflict (workspace_id) do update set basics = public.profiles.basics || coalesce(excluded.basics, '{}'::jsonb);
  for r in select * from jsonb_array_elements(coalesce(p_inserts, '[]'::jsonb)) loop
    insert into public.profile_items (workspace_id, section, position, data, tags)
    values (p_ws, r ->> 'section', coalesce((r ->> 'position')::int, 0), r -> 'data',
            coalesce(array(select jsonb_array_elements_text(coalesce(r -> 'tags', '[]'::jsonb))), '{}'));
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb)) loop
    update public.profile_items set data = r -> 'data'
     where id = (r ->> 'id')::uuid and workspace_id = p_ws;
  end loop;
end $$;
revoke execute on function public.import_profile(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.import_profile(uuid, jsonb, jsonb, jsonb) to authenticated;
