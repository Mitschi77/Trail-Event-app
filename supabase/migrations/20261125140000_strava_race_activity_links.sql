-- Strava race assignment links.
-- Keeps imported Strava activities immutable and stores race/stage assignments separately.
-- A run_record_key references a completed participation in planner_data JSON:
-- eventId::routeKey for the primary record, or
-- eventId::routeKey::attempt::YYYY-MM-DD[::createdAt] for a repeat participation.
-- No existing activity or run-history row is rewritten.

create unique index if not exists strava_activities_id_user_uidx
  on public.strava_activities (id, user_id);

create table if not exists public.strava_race_activity_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null,
  run_record_key text not null check (length(btrim(run_record_key)) > 0),
  stage_order integer not null default 1 check (stage_order >= 1),
  stage_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strava_race_activity_links_activity_owner_fkey
    foreign key (activity_id, user_id)
    references public.strava_activities (id, user_id)
    on delete restrict,
  constraint strava_race_activity_links_activity_once
    unique (user_id, activity_id),
  constraint strava_race_activity_links_stage_once
    unique (user_id, run_record_key, stage_order)
);

create index if not exists strava_race_activity_links_race_idx
  on public.strava_race_activity_links (user_id, run_record_key, stage_order);

alter table public.strava_race_activity_links enable row level security;

revoke all on table public.strava_race_activity_links from anon, authenticated;
grant select, insert, update, delete on table public.strava_race_activity_links to authenticated;

drop policy if exists "Users manage own Strava race activity links"
  on public.strava_race_activity_links;
create policy "Users manage own Strava race activity links"
  on public.strava_race_activity_links
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- A link may only point to a completed participation record owned by the same user.
create or replace function public.validate_strava_race_activity_link()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  planner jsonb;
  records jsonb;
  attempts jsonb;
  run_record jsonb;
  attempt_key text[];
  attempt_list jsonb;
  attempt_item jsonb;
begin
  select pd.data
    into planner
    from public.planner_data pd
   where pd.user_id = new.user_id
   for update;

  -- Serialize assignment creation with concurrent planner-data updates/deletes.
  if planner is null then
    raise exception 'No planner data exists for this user'
      using errcode = '23514';
  end if;

  attempt_key := regexp_match(
    new.run_record_key,
    '^(.*)::attempt::([0-9]{4}-[0-9]{2}-[0-9]{2})(::([0-9]+))?$'
  );

  if attempt_key is not null then
    attempts := coalesce(nullif(planner ->> 'trailEventRunAttempts', '')::jsonb, '{}'::jsonb);
    attempt_list := attempts -> attempt_key[1];

    if jsonb_typeof(attempt_list) = 'array' then
      select item
        into attempt_item
        from jsonb_array_elements(attempt_list) as elements(item)
       where item ->> 'date' = attempt_key[2]
         and coalesce((item ->> 'done')::boolean, false) is true
         and (
           attempt_key[4] is null
           or item ->> 'createdAt' = attempt_key[4]
         )
       limit 1;
    end if;

    if attempt_item is null then
      raise exception 'Strava activity can only be linked to an existing completed repeat participation owned by this user'
        using errcode = '23514';
    end if;
  else
    records := coalesce(nullif(planner ->> 'trailEventRunRecords', '')::jsonb, '{}'::jsonb);
    run_record := records -> new.run_record_key;

    if run_record is null
       or jsonb_typeof(run_record) <> 'object'
       or coalesce((run_record ->> 'done')::boolean, false) is not true then
      raise exception 'Strava activity can only be linked to an existing completed race record owned by this user'
        using errcode = '23514';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists validate_strava_race_activity_link
  on public.strava_race_activity_links;
create trigger validate_strava_race_activity_link
  before insert or update of user_id, activity_id, run_record_key, stage_order, stage_name
  on public.strava_race_activity_links
  for each row execute function public.validate_strava_race_activity_link();

-- Do not allow cloud sync to remove or reopen a race record while Strava activities
-- are assigned to it. The owner can unlink the activities first.
create or replace function public.protect_linked_strava_race_records()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  records jsonb;
  attempts jsonb;
  attempt_key text[];
  attempt_list jsonb;
begin
  if new.data is not distinct from old.data then
    return new;
  end if;

  records := coalesce(nullif(new.data ->> 'trailEventRunRecords', '')::jsonb, '{}'::jsonb);
  attempts := coalesce(nullif(new.data ->> 'trailEventRunAttempts', '')::jsonb, '{}'::jsonb);

  if exists (
    select 1
      from public.strava_race_activity_links l
     where l.user_id = new.user_id
       and not (
         l.run_record_key ~ '::attempt::[0-9]{4}-[0-9]{2}-[0-9]{2}(::[0-9]+)?$'
         and exists (
           select 1
             from jsonb_array_elements(
               case
                 when jsonb_typeof(attempts -> regexp_replace(l.run_record_key, '::attempt::[0-9]{4}-[0-9]{2}-[0-9]{2}(::[0-9]+)?$', '')) = 'array'
                 then attempts -> regexp_replace(l.run_record_key, '::attempt::[0-9]{4}-[0-9]{2}-[0-9]{2}(::[0-9]+)?$', '')
                 else '[]'::jsonb
               end
             ) as elements(item)
            where item ->> 'date' = (regexp_match(l.run_record_key, '::attempt::([0-9]{4}-[0-9]{2}-[0-9]{2})'))[1]
              and coalesce((item ->> 'done')::boolean, false) is true
              and (
                (regexp_match(l.run_record_key, '::attempt::[0-9]{4}-[0-9]{2}-[0-9]{2}(::([0-9]+))?$'))[2] is null
                or item ->> 'createdAt' = (regexp_match(l.run_record_key, '::attempt::[0-9]{4}-[0-9]{2}-[0-9]{2}(::([0-9]+))?$'))[2]
              )
         )
       )
       and not (
         l.run_record_key !~ '::attempt::[0-9]{4}-[0-9]{2}-[0-9]{2}(::[0-9]+)?$'
         and records ? l.run_record_key
         and coalesce(((records -> l.run_record_key) ->> 'done')::boolean, false) is true
       )
  ) then
    raise exception 'A linked race participation cannot be removed or marked as not completed; unlink its Strava activities first'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_linked_strava_race_records on public.planner_data;
create trigger protect_linked_strava_race_records
  before update of data on public.planner_data
  for each row execute function public.protect_linked_strava_race_records();

-- Also protect the parent planner row itself: deleting it must not leave
-- Strava assignments pointing at a participation record that no longer exists.
create or replace function public.prevent_linked_planner_data_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.strava_race_activity_links l
     where l.user_id = old.user_id
  ) then
    raise exception 'Planner data with linked Strava activities cannot be deleted; unlink the activities first'
      using errcode = '23514';
  end if;

  return old;
end;
$$;

drop trigger if exists prevent_linked_planner_data_delete on public.planner_data;
create trigger prevent_linked_planner_data_delete
  before delete on public.planner_data
  for each row execute function public.prevent_linked_planner_data_delete();
