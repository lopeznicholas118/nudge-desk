begin;
select plan(13);

-- Fixtures (superuser) ----------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.dev');

insert into public.contacts (id, user_id, full_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Alice Contact'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Bob Contact');

insert into public.agent_runs (id, user_id, triggered_by, model, prompt_version) values
  ('aaaaaaaa-1111-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'manual', 'm', 'v1'),
  ('bbbbbbbb-1111-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'manual', 'm', 'v1');

insert into public.agent_steps (run_id, user_id, step_index, kind) values
  ('bbbbbbbb-1111-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 0, 'llm');

insert into public.drafts (user_id, contact_id, language, body) values
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000001', 'en', 'bob draft');

-- Act as Alice -----------------------------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);

select results_eq(
  $$ select count(*)::int from public.agent_runs $$,
  $$ values (1) $$,
  'alice sees only her own runs'
);

select is_empty($$ select 1 from public.agent_steps $$, 'alice cannot see bob''s steps');
select is_empty($$ select 1 from public.drafts $$, 'alice cannot see bob''s drafts');

select lives_ok(
  $$ insert into public.drafts (contact_id, run_id, language, body)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-1111-0000-0000-000000000001', 'es', 'Hola, cómo estás?') $$,
  'alice can save a draft for her own contact and run'
);

select throws_ok(
  $$ insert into public.drafts (contact_id, language, body)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'en', 'second pending draft') $$,
  '23505', null,
  'a contact cannot have two pending drafts'
);

select lives_ok(
  $$ update public.drafts set status = 'discarded'
     where contact_id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'alice can discard her draft'
);

select lives_ok(
  $$ insert into public.drafts (contact_id, language, body)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'en', 'fresh draft after discarding') $$,
  'a new pending draft is allowed once the old one is discarded'
);

select throws_ok(
  $$ insert into public.drafts (contact_id, run_id, language, body, status)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-1111-0000-0000-000000000001', 'en', 'x', 'discarded') $$,
  '23503', null,
  'alice cannot attach a draft to bob''s run'
);

select throws_ok(
  $$ insert into public.agent_steps (run_id, step_index, kind)
     values ('bbbbbbbb-1111-0000-0000-000000000001', 1, 'llm') $$,
  '23503', null,
  'alice cannot write steps into bob''s run'
);

select throws_ok(
  $$ delete from public.agent_steps $$,
  '42501', null,
  'traces are append-only: no delete privilege'
);

select lives_ok(
  $$ update public.agent_runs set status = 'completed'
     where id = 'bbbbbbbb-1111-0000-0000-000000000001' $$,
  'alice updating bob''s run is a silent no-op'
);

-- Back to superuser ----------------------------------------------------------------------
reset role;

select is(
  (select status from public.agent_runs where id = 'bbbbbbbb-1111-0000-0000-000000000001'),
  'running',
  'bob''s run was untouched'
);

-- Anonymous users --------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok($$ select 1 from public.drafts $$, '42501', null, 'anon has no access to drafts');

select * from finish();
rollback;