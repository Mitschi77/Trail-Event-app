-- SPORTJAHR – SQL-Schema-Vorschau (NICHT AUSFÜHREN)
-- Zweck: reviewbare, additive Entwurfsdatei für die spätere Supabase-Migration.
-- Diese Datei ist ausdrücklich KEINE Supabase-Migration und wurde NICHT angewendet.
-- Keine bestehenden Tabellen oder planner_data-Schlüssel werden verändert.
--
-- Vor einer späteren Migration zwingend prüfen:
-- 1. Data-API-Exposition und Grants im konkreten Supabase-Projekt.
-- 2. RLS mit mindestens zwei Benutzerkonten testen.
-- 3. Katalog-Seeding und UI-Verwendung der Sport-IDs festlegen.
-- 4. Migration lokal mit Supabase CLI erzeugen und testen.

begin;

create table if not exists public.sports_catalog (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete cascade,
  parent_id uuid null references public.sports_catalog(id) on delete set null,
  code text not null check (length(trim(code)) > 0),
  name text not null check (length(trim(name)) > 0),
  category text null,
  is_system boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sports_catalog_system_owner_check
    check ((is_system and user_id is null) or (not is_system and user_id is not null))
);

create unique index if not exists sports_catalog_global_code_uidx
  on public.sports_catalog (lower(code)) where is_system = true;

create unique index if not exists sports_catalog_user_code_uidx
  on public.sports_catalog (user_id, lower(code)) where is_system = false;

create index if not exists sports_catalog_parent_idx
  on public.sports_catalog (parent_id);

create table if not exists public.sport_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sport_id uuid null references public.sports_catalog(id) on delete set null,
  activity_type text not null default 'activity'
    check (length(trim(activity_type)) > 0),
  title text not null default 'Aktivität'
    check (length(trim(title)) > 0),
  starts_at timestamptz null,
  ends_at timestamptz null,
  location text null,
  distance_km numeric(10,3) null check (distance_km is null or distance_km >= 0),
  elevation_gain_m integer null check (elevation_gain_m is null or elevation_gain_m >= 0),
  duration_seconds integer null check (duration_seconds is null or duration_seconds >= 0),
  status text not null default 'planned'
    check (length(trim(status)) > 0),
  catalog_event_id text null,
  catalog_route_id text null,
  result jsonb not null default '{}'::jsonb
    check (jsonb_typeof(result) = 'object'),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sport_activities_time_order_check
    check (starts_at is null or ends_at is null or ends_at >= starts_at)
);

create index if not exists sport_activities_owner_start_idx
  on public.sport_activities (user_id, starts_at desc);

create index if not exists sport_activities_owner_sport_idx
  on public.sport_activities (user_id, sport_id);

create index if not exists sport_activities_catalog_event_idx
  on public.sport_activities (catalog_event_id)
  where catalog_event_id is not null;

create table if not exists public.sport_activity_segments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.sport_activities(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  sport_id uuid null references public.sports_catalog(id) on delete set null,
  segment_type text not null default 'other'
    check (length(trim(segment_type)) > 0),
  name text null,
  distance numeric(10,3) null check (distance is null or distance >= 0),
  distance_unit text null,
  duration_seconds integer null check (duration_seconds is null or duration_seconds >= 0),
  result jsonb not null default '{}'::jsonb
    check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  constraint sport_activity_segments_sequence_uidx unique (activity_id, sequence)
);

create index if not exists sport_activity_segments_activity_idx
  on public.sport_activity_segments (activity_id, sequence);

-- RLS wird unmittelbar aktiviert. Segmentzugriffe werden über die Eigentümerschaft
-- der übergeordneten Aktivität geprüft.
alter table public.sports_catalog enable row level security;
alter table public.sport_activities enable row level security;
alter table public.sport_activity_segments enable row level security;

drop policy if exists sports_catalog_read_policy on public.sports_catalog;
create policy sports_catalog_read_policy
  on public.sports_catalog for select to authenticated
  using (is_system = true or user_id = (select auth.uid()));

drop policy if exists sports_catalog_insert_policy on public.sports_catalog;
create policy sports_catalog_insert_policy
  on public.sports_catalog for insert to authenticated
  with check (is_system = false and user_id = (select auth.uid()));

drop policy if exists sports_catalog_update_policy on public.sports_catalog;
create policy sports_catalog_update_policy
  on public.sports_catalog for update to authenticated
  using (is_system = false and user_id = (select auth.uid()))
  with check (is_system = false and user_id = (select auth.uid()));

drop policy if exists sports_catalog_delete_policy on public.sports_catalog;
create policy sports_catalog_delete_policy
  on public.sports_catalog for delete to authenticated
  using (is_system = false and user_id = (select auth.uid()));

drop policy if exists sport_activities_select_policy on public.sport_activities;
create policy sport_activities_select_policy
  on public.sport_activities for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists sport_activities_insert_policy on public.sport_activities;
create policy sport_activities_insert_policy
  on public.sport_activities for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists sport_activities_update_policy on public.sport_activities;
create policy sport_activities_update_policy
  on public.sport_activities for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists sport_activities_delete_policy on public.sport_activities;
create policy sport_activities_delete_policy
  on public.sport_activities for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists sport_activity_segments_select_policy on public.sport_activity_segments;
create policy sport_activity_segments_select_policy
  on public.sport_activity_segments for select to authenticated
  using (exists (
    select 1 from public.sport_activities a
    where a.id = activity_id and a.user_id = (select auth.uid())
  ));

drop policy if exists sport_activity_segments_insert_policy on public.sport_activity_segments;
create policy sport_activity_segments_insert_policy
  on public.sport_activity_segments for insert to authenticated
  with check (exists (
    select 1 from public.sport_activities a
    where a.id = activity_id and a.user_id = (select auth.uid())
  ));

drop policy if exists sport_activity_segments_update_policy on public.sport_activity_segments;
create policy sport_activity_segments_update_policy
  on public.sport_activity_segments for update to authenticated
  using (exists (
    select 1 from public.sport_activities a
    where a.id = activity_id and a.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.sport_activities a
    where a.id = activity_id and a.user_id = (select auth.uid())
  ));

drop policy if exists sport_activity_segments_delete_policy on public.sport_activity_segments;
create policy sport_activity_segments_delete_policy
  on public.sport_activity_segments for delete to authenticated
  using (exists (
    select 1 from public.sport_activities a
    where a.id = activity_id and a.user_id = (select auth.uid())
  ));

-- Zusätzliche Eigentümerprüfung für Fremdschlüssel:
-- Ein gültiger UUID-Fremdschlüssel allein reicht nicht aus: sonst könnte ein
-- Benutzer eine private Sportart eines anderen Benutzers referenzieren.
-- Diese Trigger laufen standardmäßig als SECURITY INVOKER (kein SECURITY DEFINER).
-- Die SELECT-Prüfungen unterliegen damit weiterhin den RLS-Regeln des Aufrufers.

create or replace function public.sport_year_check_catalog_parent()
returns trigger
language plpgsql
set search_path = ''
as $sport_year$
begin
  if new.parent_id is not null and not exists (
    select 1
    from public.sports_catalog parent
    where parent.id = new.parent_id
      and (
        (new.is_system = true and parent.is_system = true)
        or
        (new.is_system = false and (
          parent.is_system = true
          or parent.user_id = new.user_id
        ))
      )
  ) then
    raise exception 'Übergeordnete Sportart ist nicht zugänglich.'
      using errcode = '23503';
  end if;
  return new;
end;
$sport_year$;

drop trigger if exists sport_year_catalog_parent_guard on public.sports_catalog;
create trigger sport_year_catalog_parent_guard
before insert or update of parent_id, user_id, is_system
on public.sports_catalog
for each row execute function public.sport_year_check_catalog_parent();

create or replace function public.sport_year_check_activity_sport()
returns trigger
language plpgsql
set search_path = ''
as $sport_year$
begin
  if new.sport_id is not null and not exists (
    select 1
    from public.sports_catalog catalog
    where catalog.id = new.sport_id
      and (catalog.is_system = true or catalog.user_id = new.user_id)
  ) then
    raise exception 'Sportart ist nicht zugänglich.'
      using errcode = '23503';
  end if;
  return new;
end;
$sport_year$;

drop trigger if exists sport_year_activity_sport_guard on public.sport_activities;
create trigger sport_year_activity_sport_guard
before insert or update of sport_id, user_id
on public.sport_activities
for each row execute function public.sport_year_check_activity_sport();

create or replace function public.sport_year_check_segment_references()
returns trigger
language plpgsql
set search_path = ''
as $
declare
  activity_owner uuid;
begin
  select activity.user_id
    into activity_owner
  from public.sport_activities activity
  where activity.id = new.activity_id;

  if activity_owner is null or activity_owner <> (select auth.uid()) then
    -- Service-role/admin operations may run without an end-user JWT.
    -- The segment RLS policy remains the user-facing ownership boundary.
    if (select auth.uid()) is not null then
      raise exception 'Aktivität ist nicht zugänglich.'
        using errcode = '23503';
    end if;
  end if;

  if new.sport_id is not null and not exists (
    select 1
    from public.sports_catalog catalog
    where catalog.id = new.sport_id
      and (
        catalog.is_system = true
        or catalog.user_id = activity_owner
      )
  ) then
    raise exception 'Segment-Sportart ist nicht zugänglich.'
      using errcode = '23503';
  end if;
  return new;
end;
$sport_year$;

drop trigger if exists sport_year_segment_reference_guard on public.sport_activity_segments;
create trigger sport_year_segment_reference_guard
before insert or update of activity_id, sport_id
on public.sport_activity_segments
for each row execute function public.sport_year_check_segment_references();

-- Bewusst keine anon-Rechte. Grants für authenticated werden erst nach Prüfung
-- der Data-API-Exposition im Zielprojekt ergänzt.
-- updated_at wird vorerst nicht automatisch geändert; ein vorhandener,
-- projektweiter Trigger darf nicht ungeprüft vorausgesetzt werden.

commit;
