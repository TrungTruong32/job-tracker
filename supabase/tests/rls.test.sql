begin;
select plan(29);

-- A = owner, B = invited member, C = outsider, D = second owner
insert into auth.users (id, email, instance_id, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.dev', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'd@test.dev', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

create temp table t (ws uuid, stage uuid, app uuid, ws_d uuid, stage_d uuid);
grant all on t to authenticated, service_role;
insert into t default values;

-- Personal workspaces are created by the trusted server (service role) only.
set local role service_role;
select lives_ok($$ select public.create_personal_workspace('00000000-0000-0000-0000-00000000000a', 'a@test.dev') $$,
  'server creates A personal workspace');
select lives_ok($$ select public.create_personal_workspace('00000000-0000-0000-0000-00000000000a', 'a@test.dev') $$,
  'creating it again is a no-op');
select lives_ok($$ select public.create_personal_workspace('00000000-0000-0000-0000-00000000000d', 'd@test.dev') $$,
  'server creates D personal workspace');
update t set ws_d = (select id from public.workspaces where owner_id = '00000000-0000-0000-0000-00000000000d');
update t set stage_d = (select id from public.stages where workspace_id = (select ws_d from t) order by position limit 1);

delete from public.app_flags;  -- behave like production: Google only
set local role authenticated;

-- ---------- A: owner ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","email":"a@test.dev","app_metadata":{"provider":"google"}}';
select is((select count(*)::int from public.workspaces), 1, 'A has exactly one workspace');
update t set ws = (select id from public.workspaces limit 1);
select is((select count(*)::int from public.stages), 8, 'workspace is seeded with 8 stages');
select is((select count(*)::int from public.settings), 1, 'workspace has settings');
update t set stage = (select id from public.stages order by position limit 1);
insert into public.applications (workspace_id, company, position, stage_id) select ws, 'Acme', 'AI Engineer', stage from t;
update t set app = (select id from public.applications limit 1);
select throws_ok($$ insert into public.workspace_members (workspace_id, email, user_id, role)
  select ws, 'fake@x.dev', '00000000-0000-0000-0000-00000000000c', 'member' from t $$,
  null, 'owner cannot write membership rows directly');
select lives_ok($$ select public.invite_member((select ws from t), 'B@Test.dev') $$, 'owner invites B through the RPC');
select throws_ok($$ select public.invite_member((select ws from t), 'not-an-email') $$, null, 'invite rejects a bad email');
select throws_ok($$ insert into public.applications (workspace_id, company, position, stage_id) select ws, 'X', 'Y', stage_d from t $$,
  null, 'application cannot reference a stage from another workspace');

-- ---------- C: outsider ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated","email":"c@test.dev","app_metadata":{"provider":"google"}}';
select throws_ok($$ select public.create_personal_workspace('00000000-0000-0000-0000-00000000000c', 'c@test.dev') $$,
  '42501', null, 'outsider cannot create a personal workspace');
select throws_ok($$ select public.create_workspace('evil') $$, '42883', null, 'generic create_workspace no longer exists');
select is(public.has_workspace_access(), false, 'C has no access');
select is((select count(*)::int from public.applications), 0, 'C cannot see applications');
select throws_ok($$ insert into public.applications (workspace_id, company, position, stage_id) select ws, 'X', 'Y', stage from t $$,
  null, 'C cannot insert into A workspace');
select throws_ok($$ select public.invite_member((select ws from t), 'c@test.dev') $$, null, 'C cannot invite itself');

-- ---------- B signs up with email/password: must not claim the invite ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated","email":"b@test.dev","app_metadata":{"provider":"email"}}';
select is(public.has_workspace_access(), false, 'password sign-up cannot use a Google invite');
select public.ensure_user_setup();
select is((select count(*)::int from public.applications), 0, 'password sign-up did not claim the invite');

-- ---------- B signs in with Google ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated","email":"b@test.dev","app_metadata":{"provider":"google"}}';
select is(public.has_workspace_access(), true, 'invited B has access before first login');
select lives_ok($$ select public.ensure_user_setup() $$, 'B claims the invite');
select is((select count(*)::int from public.workspaces), 1, 'B sees only A workspace');
select is((select count(*)::int from public.applications), 1, 'B sees A applications');
update public.applications set company = 'Acme 2';
select is((select company from public.applications limit 1), 'Acme 2', 'B can edit data');
update public.settings set stale_days = 30;
select is((select stale_days from public.settings limit 1), 7, 'B cannot change workspace settings');
select throws_ok($$ select public.invite_member((select ws from t), 'c@test.dev') $$, null, 'B cannot invite others');
insert into public.stage_events (application_id, type) select app, 'note' from t;
select throws_ok($$ update public.stage_events set workspace_id = (select ws_d from t) $$, null, 'events cannot drift to another workspace');
delete from public.workspace_members where role = 'owner';

-- ---------- A removes B ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","email":"a@test.dev","app_metadata":{"provider":"google"}}';
select is((select count(*)::int from public.workspace_members where role = 'owner'), 1, 'B could not delete the owner row');
delete from public.workspace_members where email = 'b@test.dev';

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated","email":"b@test.dev","app_metadata":{"provider":"google"}}';
select is((select count(*)::int from public.applications), 0, 'removed B loses access immediately');
select is(public.has_workspace_access(), false, 'removed B can no longer sign in');

select * from finish();
rollback;
