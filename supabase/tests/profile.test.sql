begin;
select plan(10);

insert into auth.users (id, email, instance_id, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'pa@test.dev', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'pc@test.dev', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

create temp table t (ws uuid, ws_c uuid, item uuid);
grant all on t to authenticated, service_role;
insert into t default values;

set local role service_role;
update t set ws = public.create_personal_workspace('00000000-0000-0000-0000-0000000000a1', 'pa@test.dev');
update t set ws_c = public.create_personal_workspace('00000000-0000-0000-0000-0000000000c1', 'pc@test.dev');

set local role authenticated;

-- A (owner/member of ws)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","email":"pa@test.dev","app_metadata":{"provider":"google"}}';
select lives_ok($$
  select public.import_profile((select ws from t), '{"full_name":"A"}',
    '[{"section":"experience","position":0,"data":{"company":"X","title":"Y","bullets":[]},"tags":["ai"]},
      {"section":"skill","position":0,"data":{"category":"ML","items":["PyTorch"]}}]', '[]')
$$, 'member imports into own workspace');
select is((select count(*)::int from public.profile_items), 2, 'two items imported');
select is((select basics ->> 'full_name' from public.profiles), 'A', 'basics saved');
select is((select tags from public.profile_items where section = 'experience'), array['ai'], 'tags saved');
update t set item = (select id from public.profile_items where section = 'experience');
select lives_ok($$ select public.import_profile((select ws from t), '{"headline":"AI Eng"}', '[]',
  jsonb_build_array(jsonb_build_object('id', (select item from t), 'data', '{"company":"X","title":"Y2","bullets":[]}'::jsonb))) $$,
  'import updates existing item and merges basics');
select is((select basics from public.profiles), '{"full_name":"A","headline":"AI Eng"}'::jsonb, 'basics merged, not replaced');
select throws_ok($$ update public.profile_items set workspace_id = (select ws_c from t) $$, null, 'items cannot move to another workspace');

-- C (outsider)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","email":"pc@test.dev","app_metadata":{"provider":"google"}}';
select is((select count(*)::int from public.profile_items), 0, 'outsider sees no items');
select throws_ok($$ select public.import_profile((select ws from t), '{}', '[]', '[]') $$, '42501', null, 'outsider cannot import into A workspace');
select lives_ok($$ select public.import_profile((select ws_c from t), '{}', '[]',
  jsonb_build_array(jsonb_build_object('id', (select item from t), 'data', '{"company":"HACK","title":"Z","bullets":[]}'::jsonb))) $$,
  'updating a foreign item id through own workspace is a no-op');

select * from finish();
rollback;
