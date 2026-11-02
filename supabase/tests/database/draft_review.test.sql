begin;
select plan(12);

-- Fixtures (superuser) --------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.dev');

insert into public.contacts (id, user_id, full_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Alice Contact 1'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Alice Contact 2'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Bob Contact');

insert into public.drafts (id, user_id, contact_id, language, body, status) values
  ('aaaaaaaa-3333-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000001', 'en', 'Alice approved draft text', 'approved'),
  ('aaaaaaaa-3333-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000002', 'en', 'Alice pending draft text', 'pending'),
  ('bbbbbbbb-3333-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   'bbbbbbbb-0000-0000-0000-000000000001', 'en', 'Bob approved draft text', 'approved');

insert into public.nudges (user_id, contact_id, week_start, score, status, reason) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001',
   '2026-10-26', 2.000, 'never_contacted', 'No contact logged yet.'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000001',
   '2026-10-26', 1.500, 'overdue', 'Last contact 45 days ago.');

select is(
  (select original_body from public.drafts where id = 'aaaaaaaa-3333-0000-0000-000000000001'),
  'Alice approved draft text',
  'inserting a draft records the agent''s original body'
);

-- Act as Alice ---------------------------------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);

select throws_ok(
  $$ update public.drafts set original_body = 'rewritten'
     where id = 'aaaaaaaa-3333-0000-0000-000000000002' $$,
  '42501', null,
  'users cannot rewrite the agent''s original body (column-level grant)'
);

select lives_ok(
  $$ update public.drafts set body = 'Edited body text here'
     where id = 'aaaaaaaa-3333-0000-0000-000000000002' $$,
  'users can edit a draft body'
);

select is(
  (select original_body from public.drafts where id = 'aaaaaaaa-3333-0000-0000-000000000002'),
  'Alice pending draft text',
  'the original body survives the edit'
);

select throws_ok(
  $$ select public.mark_draft_sent('aaaaaaaa-3333-0000-0000-000000000002') $$,
  'P0002', null,
  'a draft that is still pending cannot be marked sent'
);

select throws_ok(
  $$ select public.mark_draft_sent('bbbbbbbb-3333-0000-0000-000000000001') $$,
  'P0002', null,
  'alice cannot mark bob''s draft as sent'
);

select lives_ok(
  $$ select public.mark_draft_sent('aaaaaaaa-3333-0000-0000-000000000001') $$,
  'alice can mark her approved draft as sent'
);

select results_eq(
  $$ select status, sent_at is not null from public.drafts
     where id = 'aaaaaaaa-3333-0000-0000-000000000001' $$,
  $$ values ('sent'::text, true) $$,
  'the draft is now sent, with a timestamp'
);

select results_eq(
  $$ select count(*)::int from public.interactions
     where contact_id = 'aaaaaaaa-0000-0000-0000-000000000001'
       and kind = 'message' and source = 'manual' $$,
  $$ values (1) $$,
  'an outreach interaction was logged'
);

select results_eq(
  $$ select state from public.nudges
     where contact_id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  $$ values ('done'::text) $$,
  'the open nudge for that contact is closed'
);

-- Back to superuser -------------------------------------------------------------------------
reset role;

select is(
  (select state from public.nudges where contact_id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  'open',
  'bob''s nudge was untouched'
);

select ok(
  not has_function_privilege('anon', 'public.mark_draft_sent(uuid)', 'execute'),
  'anon cannot execute mark_draft_sent'
);

select * from finish();
rollback;