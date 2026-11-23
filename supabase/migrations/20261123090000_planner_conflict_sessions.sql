-- Durable, per-user storage for a two-device planner conflict.
-- This migration only creates the storage boundary; the app must still implement
-- capture, polling, confirmation, compare-and-swap publication and recovery.
create table if not exists public.planner_conflict_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_a_id text not null check (length(btrim(device_a_id)) between 1 and 200),
  device_b_id text not null check (length(btrim(device_b_id)) between 1 and 200),
  device_a_label text not null default 'Gerät A',
  device_b_label text not null default 'Gerät B',
  device_a_snapshot jsonb not null,
  device_b_snapshot jsonb not null,
  selected_device_id text,
  resolved_snapshot jsonb,
  status text not null default 'open'
    check (status in ('open', 'selected', 'resolved', 'expired')),
  confirmed_device_a_at timestamptz,
  confirmed_device_b_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint planner_conflict_distinct_devices
    check (device_a_id <> device_b_id),
  constraint planner_conflict_snapshot_objects
    check (
      jsonb_typeof(device_a_snapshot) = 'object'
      and jsonb_typeof(device_b_snapshot) = 'object'
      and (resolved_snapshot is null or jsonb_typeof(resolved_snapshot) = 'object')
    ),
  constraint planner_conflict_selected_device
    check (selected_device_id is null or selected_device_id in (device_a_id, device_b_id)),
  constraint planner_conflict_resolved_requires_choice
    check (status <> 'resolved' or (
      selected_device_id is not null
      and resolved_snapshot is not null
      and confirmed_device_a_at is not null
      and confirmed_device_b_at is not null
    ))
);

create index if not exists planner_conflict_sessions_user_updated_idx
  on public.planner_conflict_sessions (user_id, updated_at desc);

create index if not exists planner_conflict_sessions_expiry_idx
  on public.planner_conflict_sessions (expires_at)
  where status in ('open', 'selected');

alter table public.planner_conflict_sessions enable row level security;

drop policy if exists "Users can read own planner conflict sessions"
  on public.planner_conflict_sessions;
create policy "Users can read own planner conflict sessions"
  on public.planner_conflict_sessions
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create own planner conflict sessions"
  on public.planner_conflict_sessions;
create policy "Users can create own planner conflict sessions"
  on public.planner_conflict_sessions
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own planner conflict sessions"
  on public.planner_conflict_sessions;
create policy "Users can update own planner conflict sessions"
  on public.planner_conflict_sessions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.planner_conflict_sessions to authenticated;
revoke all on public.planner_conflict_sessions from anon;
