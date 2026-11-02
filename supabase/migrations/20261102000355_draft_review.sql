-- 1. Draft lifecycle: pending -> approved -> sent (or discarded) ------------------------
-- Inline column checks are auto-named <table>_<column>_check.
alter table public.drafts drop constraint drafts_status_check;
alter table public.drafts add constraint drafts_status_check
  check (status in ('pending', 'approved', 'sent', 'discarded'));

alter table public.drafts
  add column original_body text,    -- what the agent wrote; users can never change it
  add column approved_at timestamptz,
  add column sent_at timestamptz,
  add column alt_body text,         -- the same message in the other language (for the EN/ES toggle)
  add column alt_language text,
  add constraint drafts_alt_body_check
    check (alt_body is null or length(trim(alt_body)) between 1 and 2000),
  add constraint drafts_alt_language_check
    check (alt_language is null or alt_language in ('en', 'es')),
  add constraint drafts_alt_pair_check
    check ((alt_body is null) = (alt_language is null)),
  add constraint drafts_alt_differs_check
    check (alt_language is null or alt_language <> language);

update public.drafts set original_body = body where original_body is null;

-- 2. Record the agent's original text automatically, so agent code doesn't change ---------
create function public.drafts_set_original_body()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.original_body := coalesce(new.original_body, new.body);
  return new;
end;
$$;

create trigger drafts_original_body
  before insert on public.drafts
  for each row execute function public.drafts_set_original_body();

-- 3. Users may edit only the reviewable columns ------------------------------------------
revoke update on public.drafts from authenticated;
grant update (body, language, status, approved_at, sent_at, alt_body, alt_language)
  on public.drafts to authenticated;

-- 4. "I sent it": one atomic step that closes the loop -------------------------------------
-- SECURITY INVOKER (the default): runs as the caller, so RLS and column grants still apply.
create function public.mark_draft_sent(p_draft_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  d public.drafts%rowtype;
begin
  select * into d
  from public.drafts
  where id = p_draft_id and status = 'approved'
  for update;

  if not found then
    raise exception 'draft not found or not approved' using errcode = 'P0002';
  end if;

  update public.drafts set status = 'sent', sent_at = now() where id = d.id;

  insert into public.interactions (user_id, contact_id, kind, occurred_at, source, summary)
  values (d.user_id, d.contact_id, 'message', now(), 'manual', 'Sent a message drafted in Nudge Desk');

  update public.nudges
  set state = 'done'
  where user_id = d.user_id and contact_id = d.contact_id and state = 'open';
end;
$$;

revoke all on function public.mark_draft_sent(uuid) from public, anon, authenticated;
grant execute on function public.mark_draft_sent(uuid) to authenticated, service_role;