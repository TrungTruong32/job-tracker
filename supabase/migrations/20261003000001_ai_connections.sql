-- Several AI connections (each with its own key) and an ordered model chain for fallback.

alter table public.settings
  add column ai_connections jsonb not null default '[]'::jsonb check (jsonb_typeof(ai_connections) = 'array'),
  add column ai_chain jsonb not null default '[]'::jsonb check (jsonb_typeof(ai_chain) = 'array');

-- carry over a single configured provider as connection #1 / chain entry #1
update public.settings s
   set ai_connections = jsonb_build_array(jsonb_build_object(
         'id', c.id, 'provider', s.ai_provider, 'base_url', s.ai_base_url, 'key_enc', s.ai_api_key_encrypted)),
       ai_chain = case when coalesce(trim(s.ai_model), '') = '' then '[]'::jsonb
                       else jsonb_build_array(jsonb_build_object('connection_id', c.id, 'model', trim(s.ai_model))) end
  from (select workspace_id, gen_random_uuid()::text as id from public.settings) c
 where c.workspace_id = s.workspace_id
   and coalesce(trim(s.ai_base_url), '') <> '';

alter table public.settings
  drop column ai_provider,
  drop column ai_base_url,
  drop column ai_model,
  drop column ai_api_key_encrypted;
