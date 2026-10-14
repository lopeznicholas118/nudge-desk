begin;
select plan(3);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev');

insert into public.google_connections (user_id, google_email, scopes, refresh_token_encrypted)
values ('11111111-1111-1111-1111-111111111111', 'alice@gmail.com', array['calendar.readonly'], 'v1:x:y:z');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);

select throws_ok(
  $$ select * from public.google_connections $$,
  '42501', null,
  'a signed-in user cannot read connections, not even their own'
);

select throws_ok(
  $$ insert into public.google_connections (user_id, google_email, scopes, refresh_token_encrypted)
     values ('11111111-1111-1111-1111-111111111111', 'x@gmail.com', array['a'], 'v1:x:y:z') $$,
  '42501', null,
  'a signed-in user cannot insert connections'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$ select * from public.google_connections $$,
  '42501', null,
  'anon cannot read connections'
);

select * from finish();
rollback;