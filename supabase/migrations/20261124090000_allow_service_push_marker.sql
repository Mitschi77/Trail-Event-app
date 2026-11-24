-- Allow the trusted service-role push dispatcher to update only the
-- push delivery marker. Proposal content and owner decisions remain immutable.
create or replace function public.protect_event_change_proposal()
returns trigger
language plpgsql
set search_path to 'public', 'pg_catalog'
as $function$
begin
  if auth.role() = 'service_role' then
    if old.status <> 'pending'
       or new.id is distinct from old.id
       or new.submitted_by is distinct from old.submitted_by
       or new.proposal_type is distinct from old.proposal_type
       or new.title is distinct from old.title
       or new.payload is distinct from old.payload
       or new.status is distinct from old.status
       or new.reviewer_note is distinct from old.reviewer_note
       or new.decided_by is distinct from old.decided_by
       or new.decided_at is distinct from old.decided_at
       or new.created_at is distinct from old.created_at
       or new.published_at is distinct from old.published_at
       or new.published_by is distinct from old.published_by
       or new.publication_ref is distinct from old.publication_ref
       or new.comparison_decision is distinct from old.comparison_decision then
      raise exception 'Service role may only update the push marker on pending proposals';
    end if;
    return new;
  end if;

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
