begin;
select plan(13);

-- Fixtures (superuser) ----------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.dev');

insert into public.contacts (id, user_id, full_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Alice Contact 1'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Alice Contact 2'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Bob Contact');

insert into public.nudges (id, user_id, contact_id, week_start, score, status, reason) values
  ('aaaaaaaa-2222-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000001', '2026-10-05', 2.000, 'never_contacted', 'No contact logged yet.'),
  ('bbbbbbbb-2222-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   'bbbbbbbb-0000-0000-0000-000000000001', '2026-10-05', 1.500, 'overdue', 'Last contact 45 days ago.');

-- Act as Alice -------------------------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);

select results_eq(
  $$ select count(*)::int from public.nudges $$,
  $$ values (1) $$,
  'alice sees only her own nudges'
);

select throws_ok(
  $$ insert into public.nudges (contact_id, week_start, score, status, reason)
     values ('aaaaaaaa-0000-0000-0000-000000000002', '2026-10-12', 2, 'overdue', 'x') $$,
  '42501',
  'permission denied for table nudges',
  'signed-in users cannot create nudges (no INSERT privilege)'
);

select lives_ok(
  $$ update public.nudges set state = 'dismissed'
     where id = 'aaaaaaaa-2222-0000-0000-000000000001' $$,
  'alice can dismiss her own nudge'
);

select throws_ok(
  $$ update public.nudges set score = 99
     where id = 'aaaaaaaa-2222-0000-0000-000000000001' $$,
  '42501', null,
  'alice cannot edit a nudge''s score (column-level grant)'
);

select lives_ok(
  $$ update public.nudges set state = 'done'
     where id = 'bbbbbbbb-2222-0000-0000-000000000001' $$,
  'alice updating bob''s nudge is a silent no-op'
);

select throws_ok(
  $$ delete from public.nudges $$,
  '42501', null,
  'users cannot delete nudges'
);

select throws_ok(
  $$ select * from public.users_with_contacts() $$,
  '42501', null,
  'signed-in users cannot list other users'
);

-- Back to superuser ----------------------------------------------------------------
reset role;

select is(
  (select state from public.nudges where id = 'bbbbbbbb-2222-0000-0000-000000000001'),
  'open',
  'bob''s nudge was untouched'
);

select throws_ok(
  $$ insert into public.nudges (user_id, contact_id, week_start, score, status, reason)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002',
             '2026-10-12', 1.5, 'due_soon', 'x') $$,
  '23514', null,
  'due_soon is not a storable nudge status'
);

select throws_ok(
  $$ insert into public.nudges (user_id, contact_id, week_start, score, status, reason)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002',
             '2026-10-07', 1.5, 'overdue', 'x') $$,
  '23514', null,
  'week_start must be a Monday'
);

select throws_ok(
  $$ insert into public.nudges (user_id, contact_id, week_start, score, status, reason)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001',
             '2026-10-05', 1.5, 'overdue', 'x') $$,
  '23505', null,
  'one nudge per user, contact, and week'
);

select is(
  (select count(*)::int from public.users_with_contacts() u
    where u.user_id in ('11111111-1111-1111-1111-111111111111'::uuid,
                        '22222222-2222-2222-2222-222222222222'::uuid)),
  2,
  'users_with_contacts returns each user once, even with several contacts'
);

select ok(
  has_function_privilege('service_role', 'public.users_with_contacts()', 'execute'),
  'the service role may call users_with_contacts'
);

select * from finish();
rollback;