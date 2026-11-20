-- Serialize proposal ingestion by logical proposal key so concurrent or retried
-- workflow requests cannot create duplicate pending rows.
create or replace function public.ingest_event_change_proposals(p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $function$
declare
  owner_id constant uuid := 'a5d10e85-e559-4d44-9ee0-d8b8de08262f'::uuid;
  item jsonb;
  item_payload jsonb;
  proposal_type text;
  event_id text;
  route_id text;
  field_name text;
  lock_key text;
  existing_id uuid;
  inserted_id uuid;
  inserted_ids uuid[] := '{}'::uuid[];
  duplicate_count integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the proposal ingestion service may insert automated proposals'
      using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Proposal batch must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 300 then
    raise exception 'Proposal batch exceeds the 300 item limit' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_rows) as entries(value)
  loop
    item_payload := item -> 'payload';
    proposal_type := item ->> 'proposal_type';
    event_id := item_payload ->> 'eventId';
    route_id := coalesce(item_payload ->> 'routeId', '');
    field_name := item_payload ->> 'field';

    if proposal_type not in ('event_change', 'route_change', 'data_correction')
       or event_id is null or event_id = '' or field_name is null or field_name = '' then
      raise exception 'Invalid proposal deduplication key' using errcode = '22023';
    end if;

    -- JSON array encoding avoids delimiter collisions in user-controlled key parts.
    lock_key := jsonb_build_array(proposal_type, event_id, route_id, field_name)::text;
    perform pg_advisory_xact_lock(hashtextextended(lock_key, 0));

    select id into existing_id
      from public.event_change_proposals
     where submitted_by = owner_id
       and status = 'pending'
       and event_change_proposals.proposal_type = ingest_event_change_proposals.proposal_type
       and payload ->> 'eventId' = event_id
       and coalesce(payload ->> 'routeId', '') = route_id
       and payload ->> 'field' = field_name
     limit 1;

    if found then
      duplicate_count := duplicate_count + 1;
    else
      insert into public.event_change_proposals
        (submitted_by, proposal_type, title, payload, status)
      values
        (owner_id, proposal_type, item ->> 'title', item_payload, 'pending')
      returning id into inserted_id;
      inserted_ids := array_append(inserted_ids, inserted_id);
    end if;
  end loop;

  return jsonb_build_object(
    'inserted', cardinality(inserted_ids),
    'duplicates', duplicate_count,
    'insertedIds', to_jsonb(inserted_ids)
  );
end;
$function$;

revoke all on function public.ingest_event_change_proposals(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_event_change_proposals(jsonb) to service_role;
