-- nudges: one row per (user, contact, ISO week) ---------------------------------
create table public.nudges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  contact_id uuid not null,
  week_start date not null check (extract(isodow from week_start) = 1),  -- must be a Monday
  score numeric(8, 3) not null check (score >= 1),
  status text not null check (status in ('never_contacted', 'overdue')),
  reason text not null check (length(reason) between 1 and 300),
  state text not null default 'open' check (state in ('open', 'dismissed', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (contact_id, user_id)
    references public.contacts (id, user_id) on delete cascade,
  -- the idempotency guarantee for the cron job
  unique (user_id, contact_id, week_start)
);

create index nudges_user_week_idx on public.nudges (user_id, week_start desc, state);

create trigger nudges_set_updated_at
  before update on public.nudges
  for each row execute function public.set_updated_at();

alter table public.nudges enable row level security;

create policy nudges_select on public.nudges
  for select to authenticated using (user_id = (select auth.uid()));

create policy nudges_update on public.nudges
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Users may read nudges and change ONLY their state (dismiss / mark done).
-- Only the job (service role) creates nudges, so scores can't be edited from a browser.
revoke all on public.nudges from anon, authenticated;
grant select on public.nudges to authenticated;
grant update (state) on public.nudges to authenticated;
grant all on public.nudges to service_role;

-- Which users should the job process? -------------------------------------------
create function public.users_with_contacts()
returns table (user_id uuid)
language sql
stable
set search_path = ''
as $$
  select distinct c.user_id from public.contacts c
$$;

-- Functions are executable by everyone by default. Lock this one to the job.
revoke all on function public.users_with_contacts() from public, anon, authenticated;
grant execute on function public.users_with_contacts() to service_role;