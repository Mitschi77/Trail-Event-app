-- Strava Phase 1: single-account OAuth connection and private activity import.
-- OAuth tokens are encrypted in the Edge Function before they reach this database.

create table if not exists public.strava_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists strava_oauth_states_expiry_idx
  on public.strava_oauth_states (expires_at);

create table if not exists public.strava_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  athlete_id text not null,
  access_token_ciphertext text not null,
  access_token_iv text not null,
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  expires_at bigint not null,
  scope text not null default '',
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  history_before bigint,
  history_complete boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.strava_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'strava' check (provider = 'strava'),
  provider_activity_id text not null,
  name text not null,
  sport_type text not null,
  started_at timestamptz,
  distance_m numeric,
  moving_time_seconds integer,
  elapsed_time_seconds integer,
  total_elevation_gain_m numeric,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, provider_activity_id)
);

alter table public.strava_oauth_states enable row level security;
alter table public.strava_connections enable row level security;
alter table public.strava_activities enable row level security;

-- Only Edge Functions using the server-side secret key may access OAuth state and tokens.
revoke all on table public.strava_oauth_states from anon, authenticated;
revoke all on table public.strava_connections from anon, authenticated;
grant all on table public.strava_oauth_states to service_role;
grant all on table public.strava_connections to service_role;

-- The signed-in owner may read their normalized imported activities, but cannot write them directly.
revoke all on table public.strava_activities from anon, authenticated;
grant select on table public.strava_activities to authenticated;
grant all on table public.strava_activities to service_role;

drop policy if exists "Users can read their own Strava activities" on public.strava_activities;
create policy "Users can read their own Strava activities"
  on public.strava_activities
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists strava_activities_user_started_idx
  on public.strava_activities (user_id, started_at desc);

-- Expired OAuth state rows are removed by the connection endpoint on future starts.
