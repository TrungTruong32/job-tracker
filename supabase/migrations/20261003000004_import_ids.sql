-- import_profile: accept client-assigned ids so sub-projects can reference experiences imported in the same batch.
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
    insert into public.profile_items (id, workspace_id, section, position, data, tags)
    values (coalesce((r ->> 'id')::uuid, gen_random_uuid()), p_ws, r ->> 'section', coalesce((r ->> 'position')::int, 0), r -> 'data',
            coalesce(array(select jsonb_array_elements_text(coalesce(r -> 'tags', '[]'::jsonb))), '{}'));
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb)) loop
    update public.profile_items set data = r -> 'data'
     where id = (r ->> 'id')::uuid and workspace_id = p_ws;
  end loop;
end $$;
