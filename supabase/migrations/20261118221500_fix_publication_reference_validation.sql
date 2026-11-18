create or replace function public.mark_event_proposal_published(
  p_proposal_id uuid,
  p_publication_ref text
)
returns jsonb
language plpgsql
security definer
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
