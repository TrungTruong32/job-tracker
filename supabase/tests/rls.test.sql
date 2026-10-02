begin;
select plan(20);

-- A = owner, B = invited member, C = outsider
insert into auth.users (id, email, instance_id, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.dev', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

create temp table t (ws uuid, stage uuid, app uuid);
grant all on t to authenticated;
insert into t values (null, null, null);

set local role authenticated;

-- ---------- A: owner ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","email":"a@test.dev"}';
select lives_ok($$ select public.ensure_user_setup(true) $$, 'A gets a personal workspace');
select lives_ok($$ select public.ensure_user_setup(true) $$, 'setup is idempotent');
select is((select count(*)::int from public.workspaces), 1, 'A has exactly one workspace');
update t set ws = (select id from public.workspaces limit 1);
select is((select count(*)::int from public.stages), 8, 'workspace is seeded with 8 stages');
select is((select count(*)::int from public.settings), 1, 'workspace has settings');
update t set stage = (select id from public.stages order by position limit 1);
insert into public.applications (workspace_id, company, position, stage_id)
  select ws, 'Acme', 'AI Engineer', stage from t;
update t set app = (select id from public.applications limit 1);
select lives_ok($$ insert into public.workspace_members (workspace_id, email, role) select ws, 'B@Test.dev', 'member' from t $$,
  'owner invites B');

-- ---------- C: outsider ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated","email":"c@test.dev"}';
select is(public.has_workspace_access(), false, 'C has no access');
select is((select count(*)::int from public.applications), 0, 'C cannot see applications');
select throws_ok($$ insert into public.applications (workspace_id, company, position, stage_id) select ws, 'X', 'Y', stage from t $$,
  null, 'C cannot insert into A workspace');
select throws_ok($$ insert into public.workspace_members (workspace_id, email, role) select ws, 'c@test.dev', 'member' from t $$,
  null, 'C cannot invite itself');

-- ---------- B: invited member ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated","email":"b@test.dev"}';
select is(public.has_workspace_access(), true, 'invited B has access before first login');
select lives_ok($$ select public.ensure_user_setup(false) $$, 'B claims the invite without a personal workspace');
select is((select count(*)::int from public.workspaces), 1, 'B sees only A workspace');
select is((select count(*)::int from public.applications), 1, 'B sees A applications');
update public.applications set company = 'Acme 2';
select is((select company from public.applications limit 1), 'Acme 2', 'B can edit data');
update public.settings set stale_days = 30;
select is((select stale_days from public.settings limit 1), 7, 'B cannot change workspace settings');
select throws_ok($$ insert into public.workspace_members (workspace_id, email, role) select ws, 'c@test.dev', 'member' from t $$,
  null, 'B cannot invite others');
delete from public.workspace_members where role = 'owner';

-- ---------- A removes B ----------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","email":"a@test.dev"}';
select is((select count(*)::int from public.workspace_members where role = 'owner'), 1, 'B could not delete the owner row');
delete from public.workspace_members where email = 'b@test.dev';

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated","email":"b@test.dev"}';
select is((select count(*)::int from public.applications), 0, 'removed B loses access immediately');
select is(public.has_workspace_access(), false, 'removed B can no longer sign in');

select * from finish();
rollback;
