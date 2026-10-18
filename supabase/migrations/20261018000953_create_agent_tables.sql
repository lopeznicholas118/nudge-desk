-- agent_runs: one row per agent execution -------------------------------------
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  triggered_by text not null check (triggered_by in ('manual', 'cron', 'eval')),
  status text not null default 'running'
    check (status in ('running', 'completed', 'max_steps', 'max_tokens', 'error')),
  model text not null,
  prompt_version text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  drafts_created integer not null default 0,
  final_text text,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (id, user_id)
);
create index agent_runs_user_created_idx on public.agent_runs (user_id, created_at desc);

-- agent_steps: the trace (one row per LLM call or tool call) ------------------
create table public.agent_steps (
  id bigint generated always as identity primary key,
  run_id uuid not null,
  user_id uuid not null default auth.uid(),
  step_index integer not null,
  kind text not null check (kind in ('llm', 'tool')),
  tool_name text,
  input jsonb,
  output text,          -- tool result as the model saw it, or the assistant's text
  error text,           -- internal error detail the model never sees
  is_error boolean not null default false,
  stop_reason text,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now(),
  foreign key (run_id, user_id) references public.agent_runs (id, user_id) on delete cascade,
  unique (run_id, step_index)
);

-- drafts: messages waiting for the user's review --------------------------------
create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  contact_id uuid not null,
  run_id uuid,
  language text not null check (language in ('en', 'es')),
  body text not null check (length(trim(body)) between 1 and 2000),
  rationale text check (length(rationale) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'discarded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (contact_id, user_id) references public.contacts (id, user_id) on delete cascade,
  -- keep the draft if its run is deleted (needs Postgres 15+)
  foreign key (run_id, user_id) references public.agent_runs (id, user_id) on delete set null (run_id)
);

-- at most one pending draft per contact, enforced by the database
create unique index drafts_one_pending_per_contact on public.drafts (contact_id) where status = 'pending';
create index drafts_user_status_idx on public.drafts (user_id, status, created_at desc);

create trigger drafts_set_updated_at
  before update on public.drafts
  for each row execute function public.set_updated_at();

-- Row-level security -------------------------------------------------------------
alter table public.agent_runs enable row level security;
alter table public.agent_steps enable row level security;
alter table public.drafts enable row level security;

create policy agent_runs_select on public.agent_runs
  for select to authenticated using (user_id = (select auth.uid()));
create policy agent_runs_insert on public.agent_runs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy agent_runs_update on public.agent_runs
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy agent_steps_select on public.agent_steps
  for select to authenticated using (user_id = (select auth.uid()));
create policy agent_steps_insert on public.agent_steps
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy drafts_own on public.drafts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Grants: strip the platform defaults first, then grant the minimum ------------------
revoke all on public.agent_runs, public.agent_steps, public.drafts from anon, authenticated;
grant select, insert, update on public.agent_runs to authenticated;
grant select, insert on public.agent_steps to authenticated;   -- traces are append-only
grant select, insert, update, delete on public.drafts to authenticated;
grant all on public.agent_runs, public.agent_steps, public.drafts to service_role;