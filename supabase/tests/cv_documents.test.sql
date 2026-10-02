begin;
select plan(7);

insert into auth.users (id, email, instance_id, aud, role) values
  ('00000000-0000-0000-0000-0000000000d1', 'da@test.dev', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d2', 'dc@test.dev', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
create temp table t (ws uuid, ws_c uuid, doc uuid, app uuid);
grant all on t to authenticated, service_role;
insert into t default values;
set local role service_role;
update t set ws = public.create_personal_workspace('00000000-0000-0000-0000-0000000000d1', 'da@test.dev');
update t set ws_c = public.create_personal_workspace('00000000-0000-0000-0000-0000000000d2', 'dc@test.dev');
set local role authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","email":"da@test.dev","app_metadata":{"provider":"google"}}';
insert into public.cv_documents (workspace_id, name) select ws, 'AI Engineer' from t;
update t set doc = (select id from public.cv_documents limit 1);
select is((select count(*)::int from public.cv_documents), 1, 'owner creates a document');
select lives_ok($$ insert into public.cv_versions (workspace_id, name, document_id) select ws, 'v1', doc from t $$, 'a version can point at its document');
insert into public.applications (workspace_id, company, position, stage_id)
  select ws, 'Acme', 'AI', (select id from public.stages where workspace_id = (select ws from t) order by position limit 1) from t;
update t set app = (select id from public.applications limit 1);
select lives_ok($$ update public.cv_documents set target_application_id = (select app from t) $$, 'a document can target an application of its workspace');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated","email":"dc@test.dev","app_metadata":{"provider":"google"}}';
select is((select count(*)::int from public.cv_documents), 0, 'outsider cannot see documents');
select throws_ok($$ insert into public.cv_versions (workspace_id, name, document_id) select ws_c, 'x', doc from t $$, null,
  'a version cannot point at another workspace''s document');
insert into public.cv_documents (workspace_id, name) select ws_c, 'C doc' from t;
select throws_ok($$ update public.cv_documents set target_application_id = (select app from t) where workspace_id = (select ws_c from t) $$, null,
  'a document cannot target another workspace''s application');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","email":"da@test.dev","app_metadata":{"provider":"google"}}';
delete from public.cv_documents;
select is((select count(*)::int from public.cv_versions where document_id is null and name = 'v1'), 1, 'deleting the document keeps the saved version');

select * from finish();
rollback;
