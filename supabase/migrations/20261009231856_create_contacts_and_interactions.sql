-- Helpers ---------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- contacts --------------------------------------------------------------

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  email text check (email = lower(email)),
  company text,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'es')),
  tier text not null default 'warm' check (tier in ('close', 'warm', 'weak')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- lets child tables reference (id, user_id) so ownership can't be spoofed
  unique (id, user_id),
  -- plain unique constraint (not an expression index) so upserts can target it;
  -- nulls are distinct, so contacts without an email are fine
  unique (user_id, email)
);

create index contacts_user_id_idx on public.contacts (user_id);

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- interactions ----------------------------------------------------------

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  contact_id uuid not null,
  kind text not null check (kind in ('meeting', 'email', 'call', 'message')),
  occurred_at timestamptz not null,
  source text not null check (source in ('google_calendar', 'manual', 'csv')),
  external_id text,
  summary text,
  created_at timestamptz not null default now(),
  -- composite FK: an interaction can only point at a contact owned by the same user
  foreign key (contact_id, user_id)
    references public.contacts (id, user_id) on delete cascade,
  check (source <> 'google_calendar' or external_id is not null),
  -- makes calendar sync idempotent. Deliberately a constraint, not a partial
  -- index: PostgREST upserts can't target partial indexes. Nulls are distinct,
  -- so manual rows without an external_id are unaffected.
  unique (user_id, contact_id, source, external_id)
);

create index interactions_user_id_idx on public.interactions (user_id);
create index interactions_contact_occurred_idx
  on public.interactions (contact_id, occurred_at desc);

-- Row-level security ----------------------------------------------------

alter table public.contacts enable row level security;
alter table public.interactions enable row level security;

create policy contacts_own on public.contacts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy interactions_own on public.interactions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Explicit grants: don't rely on platform defaults --------------------------

revoke all on public.contacts, public.interactions from anon;
grant select, insert, update, delete
  on public.contacts, public.interactions to authenticated;
grant all on public.contacts, public.interactions to service_role;

-- View: each contact with its most recent *past* interaction ----------------
-- security_invoker = true makes the view run with the CALLER's permissions, so
-- RLS applies. Without it, views run as their owner and silently bypass RLS.

create view public.contacts_with_last_interaction
with (security_invoker = true) as
select
  c.*,
  max(i.occurred_at) filter (where i.occurred_at <= now()) as last_interaction_at
from public.contacts c
left join public.interactions i on i.contact_id = c.id
group by c.id;

revoke all on public.contacts_with_last_interaction from anon;
grant select on public.contacts_with_last_interaction to authenticated;
grant all on public.contacts_with_last_interaction to service_role;