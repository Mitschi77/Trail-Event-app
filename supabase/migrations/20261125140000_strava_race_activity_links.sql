-- Strava race assignment links.
-- Keeps imported Strava activities immutable and stores race/stage assignments separately.
-- A run_record_key references the existing JSON key in planner_data.data->>'trailEventRunRecords'
-- (format: eventId::routeKey). No existing activity or run-history row is rewritten.

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
  records jsonb;
  run_record jsonb;
begin
  select coalesce(nullif(pd.data ->> 'trailEventRunRecords', '')::jsonb, '{}'::jsonb)
    into records
    from public.planner_data pd
   where pd.user_id = new.user_id;

  run_record := records -> new.run_record_key;

  if run_record is null
     or jsonb_typeof(run_record) <> 'object'
     or coalesce((run_record ->> 'done')::boolean, false) is not true then
    raise exception 'Strava activity can only be linked to an existing completed race record owned by this user'
      using errcode = '23514';
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
begin
  if new.data is not distinct from old.data then
    return new;
  end if;

  records := coalesce(nullif(new.data ->> 'trailEventRunRecords', '')::jsonb, '{}'::jsonb);

  if exists (
    select 1
      from public.strava_race_activity_links l
     where l.user_id = new.user_id
       and (
         not (records ? l.run_record_key)
         or coalesce(((records -> l.run_record_key) ->> 'done')::boolean, false) is not true
       )
  ) then
    raise exception 'A race record with linked Strava activities cannot be removed or marked as not completed; unlink its activities first'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_linked_strava_race_records on public.planner_data;
create trigger protect_linked_strava_race_records
  before update of data on public.planner_data
  for each row execute function public.protect_linked_strava_race_records();
