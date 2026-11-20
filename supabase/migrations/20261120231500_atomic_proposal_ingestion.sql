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
  v_item_payload jsonb;
  v_proposal_type text;
  v_event_id text;
  v_route_id text;
  v_field_name text;
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
    v_item_payload := item -> 'payload';
    v_proposal_type := item ->> 'proposal_type';
    v_event_id := v_item_payload ->> 'eventId';
    v_route_id := coalesce(v_item_payload ->> 'routeId', '');
    v_field_name := v_item_payload ->> 'field';

    if v_proposal_type not in ('event_change', 'route_change', 'data_correction')
       or v_event_id is null or v_event_id = '' or v_field_name is null or v_field_name = '' then
      raise exception 'Invalid proposal deduplication key' using errcode = '22023';
    end if;

    -- JSON array encoding avoids delimiter collisions in user-controlled key parts.
    lock_key := jsonb_build_array(v_proposal_type, v_event_id, v_route_id, v_field_name)::text;
    perform pg_advisory_xact_lock(hashtextextended(lock_key, 0));

    select id into existing_id
      from public.event_change_proposals
     where submitted_by = owner_id
       and status = 'pending'
       and event_change_proposals.proposal_type = v_proposal_type
       and payload ->> 'eventId' = v_event_id
       and coalesce(payload ->> 'routeId', '') = v_route_id
       and payload ->> 'field' = v_field_name
     limit 1;

    if found then
      duplicate_count := duplicate_count + 1;
    else
      insert into public.event_change_proposals
        (submitted_by, proposal_type, title, payload, status)
      values
        (owner_id, v_proposal_type, item ->> 'title', v_item_payload, 'pending')
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
