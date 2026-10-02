begin;
select plan(7);

-- two users
insert into auth.users (id, email, instance_id, aud, role)
values ('00000000-0000-0000-0000-00000000000a', 'a@test.dev', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-00000000000b', 'b@test.dev', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

create temp table t_ids (stage_id uuid);
grant all on t_ids to authenticated;

-- act as A
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select lives_ok($$ select public.ensure_user_setup() $$, 'A seeds stages + settings');
select is((select count(*)::int from public.stages), 8, 'A sees 8 seeded stages');
select lives_ok($$ select public.ensure_user_setup() $$, 'seed is idempotent');
insert into public.applications (company, position, stage_id)
select 'Acme', 'AI Engineer', id from public.stages order by position limit 1;
insert into t_ids select id from public.stages order by position limit 1;

-- act as B
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.applications), 0, 'B cannot see A applications');
select is((select count(*)::int from public.stages), 0, 'B cannot see A stages');
select throws_ok(
  $$ insert into public.applications (user_id, company, position, stage_id)
     select '00000000-0000-0000-0000-00000000000a', 'X', 'Y', stage_id from t_ids $$,
  null, 'B cannot insert rows owned by A');
update public.applications set company = 'hacked';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is((select company from public.applications limit 1), 'Acme', 'B update did not touch A rows');

select * from finish();
rollback;
