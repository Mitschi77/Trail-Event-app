alter table public.event_change_proposals
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references auth.users(id),
  add column if not exists publication_ref text;

alter table public.event_change_proposals
  add constraint event_change_proposals_publication_complete
  check (
    (published_at is null and published_by is null and publication_ref is null)
    or
    (status = 'approved' and published_at is not null and published_by is not null
      and publication_ref is not null and length(trim(publication_ref)) between 7 and 500)
  );

create index if not exists event_change_proposals_decided_by_idx
  on public.event_change_proposals(decided_by);

drop trigger if exists event_change_proposals_lock_decision on public.event_change_proposals;

create or replace function public.protect_event_change_proposal()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $function$
begin
  if auth.uid() is distinct from 'a5d10e85-e559-4d44-9ee0-d8b8de08262f'::uuid then
    raise exception 'Only the database owner may decide or publish proposals';
  end if;

  if old.status = 'pending' then
    if new.id is distinct from old.id
       or new.submitted_by is distinct from old.submitted_by
       or new.proposal_type is distinct from old.proposal_type
       or new.title is distinct from old.title
       or new.payload is distinct from old.payload
       or new.created_at is distinct from old.created_at then
      raise exception 'Submitted proposal content is immutable';
    end if;
    if new.status not in ('approved','rejected')
       or new.decided_by is distinct from auth.uid()
       or new.decided_at is null
       or new.published_at is not null
       or new.published_by is not null
       or new.publication_ref is not null then
      raise exception 'Invalid proposal decision';
    end if;
    return new;
  end if;

  if old.status = 'approved' and old.published_at is null then
    if new.id is distinct from old.id
       or new.submitted_by is distinct from old.submitted_by
       or new.proposal_type is distinct from old.proposal_type
       or new.title is distinct from old.title
       or new.payload is distinct from old.payload
       or new.status is distinct from old.status
       or new.reviewer_note is distinct from old.reviewer_note
       or new.decided_by is distinct from old.decided_by
       or new.decided_at is distinct from old.decided_at
       or new.created_at is distinct from old.created_at
       or new.published_at is null
       or new.published_by is distinct from auth.uid()
       or new.publication_ref is null
       or length(trim(new.publication_ref)) not between 7 and 500 then
      raise exception 'Invalid publication record; approved proposal content remains immutable';
    end if;
    return new;
  end if;

  raise exception 'A decided proposal is immutable';
end;
$function$;

create or replace function public.mark_event_proposal_published(
  p_proposal_id uuid,
  p_publication_ref text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $function$
declare
  result_row public.event_change_proposals%rowtype;
begin
  if auth.uid() is distinct from 'a5d10e85-e559-4d44-9ee0-d8b8de08262f'::uuid then
    raise exception 'Nur der Datenbankinhaber darf eine Veröffentlichung dokumentieren.';
  end if;
  if p_publication_ref is null
     or length(trim(p_publication_ref)) not between 7 and 500
     or trim(p_publication_ref) !~ '^(https://github[.]com/Mitschi77/Trail-Event-app/(commit|pull)/[A-Za-z0-9._/-]+|[0-9a-fA-F]{7,40})$' then
    raise exception 'Bitte einen gültigen GitHub-Commit-SHA oder Link zu Commit/PR angeben.';
  end if;

  update public.event_change_proposals
     set published_at = now(),
         published_by = auth.uid(),
         publication_ref = trim(p_publication_ref)
   where id = p_proposal_id
     and status = 'approved'
     and published_at is null
   returning * into result_row;

  if not found then
    raise exception 'Nur freigegebene und noch nicht veröffentlichte Vorschläge können dokumentiert werden.';
  end if;

  return jsonb_build_object(
    'id', result_row.id,
    'published_at', result_row.published_at,
    'published_by', result_row.published_by,
    'publication_ref', result_row.publication_ref
  );
end;
$function$;

revoke all on function public.mark_event_proposal_published(uuid, text) from public, anon;
grant execute on function public.mark_event_proposal_published(uuid, text) to authenticated;

revoke update on public.event_change_proposals from authenticated;
grant update (status, reviewer_note, decided_by, decided_at, published_at, published_by, publication_ref)
  on public.event_change_proposals to authenticated;

create index if not exists event_change_proposals_published_by_idx
  on public.event_change_proposals(published_by);

drop policy if exists "owner and submitter read proposals" on public.event_change_proposals;
create policy "owner and submitter read proposals"
  on public.event_change_proposals for select to authenticated
  using ((select auth.uid()) = 'a5d10e85-e559-4d44-9ee0-d8b8de08262f'::uuid
      or submitted_by = (select auth.uid()));

drop policy if exists "owner decides proposals" on public.event_change_proposals;
create policy "owner decides proposals"
  on public.event_change_proposals for update to authenticated
  using ((select auth.uid()) = 'a5d10e85-e559-4d44-9ee0-d8b8de08262f'::uuid)
  with check ((select auth.uid()) = 'a5d10e85-e559-4d44-9ee0-d8b8de08262f'::uuid
      and status = any(array['approved'::text,'rejected'::text])
      and decided_by = (select auth.uid())
      and decided_at is not null);

drop policy if exists "submit authenticated proposals" on public.event_change_proposals;
create policy "submit authenticated proposals"
  on public.event_change_proposals for insert to authenticated
  with check (submitted_by = (select auth.uid())
      and status = 'pending' and decided_by is null and decided_at is null);

drop policy if exists "Users manage own push subscriptions" on public.event_push_subscriptions;
create policy "Users manage own push subscriptions"
  on public.event_push_subscriptions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
