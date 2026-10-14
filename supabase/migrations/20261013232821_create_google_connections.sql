create table public.google_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  google_email text not null,
  scopes text[] not null,
  refresh_token_encrypted text not null,
  status text not null default 'active' check (status in ('active', 'needs_reauth')),
  last_synced_at timestamptz,
  last_sync_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger google_connections_set_updated_at
  before update on public.google_connections
  for each row execute function public.set_updated_at();

-- Deliberately NO policies and NO grants for anon/authenticated:
-- this table holds credentials, so only server code using the service role may touch it.
alter table public.google_connections enable row level security;
revoke all on public.google_connections from anon, authenticated;
grant all on public.google_connections to service_role;