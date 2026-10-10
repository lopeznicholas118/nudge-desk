begin;
select plan(10);

-- Fixtures, created as the superuser ---------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.dev');

insert into public.contacts (id, user_id, full_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Alice Contact'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Bob Contact');

insert into public.interactions (user_id, contact_id, kind, occurred_at, source) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'meeting', now() - interval '10 days', 'manual'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000001', 'meeting', now() - interval '20 days', 'manual');

-- Act as Alice -------------------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);

select results_eq(
  $$ select full_name from public.contacts $$,
  $$ values ('Alice Contact'::text) $$,
  'alice sees only her own contacts'
);

select is_empty(
  $$ select 1 from public.contacts where id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  'alice cannot read bob''s contact even by id'
);

select results_eq(
  $$ select count(*)::int from public.interactions $$,
  $$ values (1) $$,
  'alice sees only her own interactions'
);

select throws_ok(
  $$ insert into public.contacts (user_id, full_name)
     values ('22222222-2222-2222-2222-222222222222', 'Spoof') $$,
  '42501', null,
  'alice cannot insert a contact owned by bob'
);

select lives_ok(
  $$ update public.contacts set full_name = 'Hacked'
     where id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  'alice updating bob''s contact is a silent no-op'
);

select lives_ok(
  $$ delete from public.contacts
     where id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  'alice deleting bob''s contact is a silent no-op'
);

select throws_ok(
  $$ insert into public.interactions (user_id, contact_id, kind, occurred_at, source)
     values ('11111111-1111-1111-1111-111111111111',
             'bbbbbbbb-0000-0000-0000-000000000001',
             'call', now(), 'manual') $$,
  '23503', null,
  'alice cannot attach an interaction to bob''s contact'
);

select results_eq(
  $$ select count(*)::int from public.contacts_with_last_interaction $$,
  $$ values (1) $$,
  'the view respects RLS (security_invoker)'
);

-- Back to superuser: confirm Bob's data is untouched ---------------------------
reset role;

select is(
  (select full_name from public.contacts
    where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  'Bob Contact',
  'bob''s contact survived alice''s update and delete attempts'
);

-- Anonymous users ---------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$ select 1 from public.contacts $$,
  '42501', null,
  'anon has no access to contacts'
);

select * from finish();
rollback;