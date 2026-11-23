-- Durable, per-user storage for a two-device planner conflict.
-- This migration creates the storage boundary and an atomic compare-and-swap
-- publication RPC. The browser integration is a separate, still-pending step.
create table if not exists public.planner_conflict_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_a_id text not null check (length(btrim(device_a_id)) between 1 and 200),
  device_b_id text,
  device_a_label text not null default 'Gerät A',
  device_b_label text,
  device_a_snapshot jsonb not null,
  device_b_snapshot jsonb,
  base_cloud_updated_at timestamptz not null,
  selected_device_id text,
  resolved_snapshot jsonb,
  status text not null default 'open'
    check (status in ('open', 'selected', 'resolved', 'published', 'expired')),
  confirmed_device_a_at timestamptz,
  confirmed_device_b_at timestamptz,
  published_cloud_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint planner_conflict_distinct_devices
    check (device_b_id is null or device_a_id <> device_b_id),
  constraint planner_conflict_snapshot_objects
    check (
      jsonb_typeof(device_a_snapshot) = 'object'
      and (device_b_snapshot is null or jsonb_typeof(device_b_snapshot) = 'object')
      and (resolved_snapshot is null or jsonb_typeof(resolved_snapshot) = 'object')
    ),
  constraint planner_conflict_device_b_pair
    check ((device_b_id is null) = (device_b_snapshot is null)),
  constraint planner_conflict_selected_device
    check (selected_device_id is null or selected_device_id in (device_a_id, device_b_id)),
  constraint planner_conflict_selected_requires_both
    check (status not in ('selected', 'resolved', 'published') or (
      device_b_id is not null
      and selected_device_id is not null
      and resolved_snapshot is not null
    )),
  constraint planner_conflict_resolved_requires_both_confirmations
    check (status not in ('resolved', 'published') or (
      confirmed_device_a_at is not null
      and confirmed_device_b_at is not null
    )),
  constraint planner_conflict_published_requires_timestamp
    check (status <> 'published' or published_cloud_updated_at is not null)
);

create index if not exists planner_conflict_sessions_user_updated_idx
  on public.planner_conflict_sessions (user_id, updated_at desc);

create index if not exists planner_conflict_sessions_expiry_idx
  on public.planner_conflict_sessions (expires_at)
  where status in ('open', 'selected', 'resolved');

create unique index if not exists planner_conflict_sessions_one_active_per_user_idx
  on public.planner_conflict_sessions (user_id)
  where status in ('open', 'selected', 'resolved');

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

-- Publish only the mutually confirmed snapshot, and only if planner_data still
-- has the exact version captured when the conflict session was opened.
create or replace function public.publish_planner_conflict_session(p_session_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_session public.planner_conflict_sessions%rowtype;
  v_published_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select *
    into v_session
    from public.planner_conflict_sessions
   where id = p_session_id
     and user_id = auth.uid()
   for update;

  if not found then
    raise exception 'conflict_session_not_found';
  end if;
  if v_session.status <> 'resolved' then
    raise exception 'conflict_session_not_confirmed';
  end if;
  if v_session.expires_at <= now() then
    raise exception 'conflict_session_expired';
  end if;

  update public.planner_data
     set data = v_session.resolved_snapshot,
         updated_at = v_published_at
   where user_id = v_session.user_id
     and updated_at = v_session.base_cloud_updated_at;

  if not found then
    raise exception 'planner_data_changed_retry_required';
  end if;

  update public.planner_conflict_sessions
     set status = 'published',
         published_cloud_updated_at = v_published_at,
         updated_at = v_published_at
   where id = v_session.id;

  return v_published_at;
end;
$$;

revoke all on function public.publish_planner_conflict_session(uuid) from public, anon;
grant execute on function public.publish_planner_conflict_session(uuid) to authenticated;
