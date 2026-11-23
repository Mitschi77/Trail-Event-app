-- PostgreSQL integration test for the single-active-device RLS guard.
-- Run against a disposable PostgreSQL database as a superuser:
-- psql -v ON_ERROR_STOP=1 -f scripts/test_single_active_session_guard.sql

do $roles$
begin
  create role anon nologin;
exception when duplicate_object then null;
end
$roles$;
do $roles$
begin
  create role authenticated nologin;
exception when duplicate_object then null;
end
$roles$;

create schema auth;
create table auth.sessions (id uuid primary key, user_id uuid not null);
create or replace function auth.uid()
returns uuid language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;
create or replace function auth.jwt()
returns jsonb language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

create table public.planner_data (
  user_id uuid primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.planner_data enable row level security;
grant select, insert, update, delete on public.planner_data to authenticated;
create policy "Users can delete own planner data" on public.planner_data
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own planner data" on public.planner_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can read own planner data" on public.planner_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can update own planner data" on public.planner_data
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create schema storage;
create table storage.objects (bucket_id text not null, name text not null);
create or replace function storage.foldername(value text)
returns text[] language sql immutable
as $$ select string_to_array(trim(both '/' from value), '/') $$;
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
create policy "Users can read own trail documents" on storage.objects
  for select to authenticated using (
    bucket_id = 'trail-private-documents'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  );
create policy "Users can upload own trail documents" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'trail-private-documents'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  );
create policy "Users can update own trail documents" on storage.objects
  for update to authenticated using (
    bucket_id = 'trail-private-documents'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  ) with check (
    bucket_id = 'trail-private-documents'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  );
create policy "Users can delete own trail documents" on storage.objects
  for delete to authenticated using (
    bucket_id = 'trail-private-documents'
    and (storage.foldername(name))[1] = ((select auth.uid()))::text
  );

create table public.event_push_subscriptions (user_id uuid not null);
alter table public.event_push_subscriptions enable row level security;
grant select, insert, update, delete on public.event_push_subscriptions to authenticated;
create policy "Users manage own push subscriptions" on public.event_push_subscriptions
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table public.event_change_proposals (
  submitted_by uuid not null,
  status text not null default 'pending',
  decided_by uuid,
  decided_at timestamptz
);
alter table public.event_change_proposals enable row level security;
grant select, insert, update, delete on public.event_change_proposals to authenticated;
create policy "owner and submitter read proposals" on public.event_change_proposals
  for select to authenticated using (
    (select auth.uid()) = 'a5d10e85-e559-4d44-9ee0-d8b8de08262f'::uuid
    or submitted_by = (select auth.uid())
  );
create policy "owner decides proposals" on public.event_change_proposals
  for update to authenticated using (
    (select auth.uid()) = 'a5d10e85-e559-4d44-9ee0-d8b8de08262f'::uuid
  ) with check (
    (select auth.uid()) = 'a5d10e85-e559-4d44-9ee0-d8b8de08262f'::uuid
    and status = any (array['approved'::text, 'rejected'::text])
    and decided_by = (select auth.uid())
    and decided_at is not null
  );
create policy "submit authenticated proposals" on public.event_change_proposals
  for insert to authenticated with check (
    submitted_by = (select auth.uid())
    and status = 'pending'::text
    and decided_by is null
    and decided_at is null
  );

\i supabase/migrations/20261123100000_single_active_device_session.sql

-- The internal helper must remain private; only its authenticated wrapper is exposed.
do $security_surface_test$
begin
  if has_schema_privilege('anon', 'private', 'USAGE')
     or has_schema_privilege('authenticated', 'private', 'USAGE') then
    raise exception 'FAIL: API roles can access the private helper schema';
  end if;
  if has_function_privilege('anon', 'private.is_current_auth_session_active()', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.is_current_auth_session_active()', 'EXECUTE') then
    raise exception 'FAIL: API roles can execute the internal session helper directly';
  end if;
  if has_function_privilege('anon', 'public.is_current_auth_session_active()', 'EXECUTE') then
    raise exception 'FAIL: anon can execute the authenticated session RPC';
  end if;
  if not has_function_privilege('authenticated', 'public.is_current_auth_session_active()', 'EXECUTE') then
    raise exception 'FAIL: authenticated cannot execute the session RPC wrapper';
  end if;
end
$security_surface_test$;

set role anon;
do $anon_rpc_test$
begin
  begin
    perform public.is_current_auth_session_active();
    raise exception 'FAIL: anon executed the authenticated session RPC';
  exception when insufficient_privilege then null;
  end;
end
$anon_rpc_test$;
reset role;



-- Seed one row in each additional protected resource before switching roles.
insert into storage.objects(bucket_id, name)
values ('trail-private-documents', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/plan.pdf');
insert into public.event_push_subscriptions(user_id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.event_change_proposals(submitted_by, status)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pending');

insert into auth.sessions(id, user_id) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('33333333-3333-4333-8333-333333333333', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

set request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","session_id":"11111111-1111-4111-8111-111111111111"}';
set role authenticated;
insert into public.planner_data(user_id, data)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{"from":"device-a"}');
do $test$
begin
  if public.is_current_auth_session_active() is not true then
    raise exception 'FAIL: active session helper rejected the current session';
  end if;

  -- A valid user JWT without a session_id must never pass the guard.
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}', true);
  if public.is_current_auth_session_active() is not false then
    raise exception 'FAIL: session guard accepted a JWT without session_id';
  end if;

  -- A session belonging to a different user must not authorize this JWT.
  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","session_id":"33333333-3333-4333-8333-333333333333"}', true);
  if public.is_current_auth_session_active() is not false then
    raise exception 'FAIL: session guard accepted another user session';
  end if;

  perform set_config('request.jwt.claims',
    '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","session_id":"11111111-1111-4111-8111-111111111111"}', true);
  if (select count(*) from storage.objects) <> 1 then
    raise exception 'FAIL: active session cannot read private documents';
  end if;
  if (select count(*) from public.event_push_subscriptions) <> 1 then
    raise exception 'FAIL: active session cannot read push subscriptions';
  end if;
  if (select count(*) from public.event_change_proposals) <> 1 then
    raise exception 'FAIL: active session cannot read own proposals';
  end if;
end
$test$;
reset role;

-- Simulate signOut({ scope: 'others' }) removing the old auth session row.
delete from auth.sessions where id = '11111111-1111-4111-8111-111111111111';

set role authenticated;
do $test$
declare
  affected integer;
  visible_rows integer;
begin
  if public.is_current_auth_session_active() is not false then
    raise exception 'FAIL: revoked session helper still reports active';
  end if;

  update public.planner_data
     set data = '{"from":"stale-device"}'
   where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: stale session updated planner_data (% rows)', affected;
  end if;

  select count(*) into visible_rows from public.planner_data;
  if visible_rows <> 0 then
    raise exception 'FAIL: stale session can still read planner_data';
  end if;

  if (select count(*) from storage.objects) <> 0 then
    raise exception 'FAIL: stale session can still read private documents';
  end if;
  if (select count(*) from public.event_push_subscriptions) <> 0 then
    raise exception 'FAIL: stale session can still read push subscriptions';
  end if;
  if (select count(*) from public.event_change_proposals) <> 0 then
    raise exception 'FAIL: stale session can still read own proposals';
  end if;

  update storage.objects set name = name || '.stale';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: stale session updated private documents';
  end if;
  update public.event_push_subscriptions set user_id = user_id;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: stale session updated push subscriptions';
  end if;

  begin
    insert into storage.objects(bucket_id, name)
    values ('trail-private-documents', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/stale.pdf');
    raise exception 'FAIL: stale session inserted a private document';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.event_push_subscriptions(user_id)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    raise exception 'FAIL: stale session inserted a push subscription';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.event_change_proposals(submitted_by, status)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pending');
    raise exception 'FAIL: stale session submitted a proposal';
  exception when insufficient_privilege then null;
  end;
end
$test$;
reset role;

-- A new session for the same user is allowed to read and update.
insert into auth.sessions(id, user_id) values
  ('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
set request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","session_id":"22222222-2222-4222-8222-222222222222"}';
set role authenticated;
do $test$
declare
  affected integer;
  visible_rows integer;
begin
  select count(*) into visible_rows from public.planner_data;
  if visible_rows <> 1 then
    raise exception 'FAIL: new active session cannot read planner_data';
  end if;
  if (select count(*) from storage.objects) <> 1 then
    raise exception 'FAIL: new active session cannot read private documents';
  end if;
  if (select count(*) from public.event_push_subscriptions) <> 1 then
    raise exception 'FAIL: new active session cannot read push subscriptions';
  end if;
  if (select count(*) from public.event_change_proposals) <> 1 then
    raise exception 'FAIL: new active session cannot read own proposals';
  end if;

  insert into storage.objects(bucket_id, name)
  values ('trail-private-documents', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/new-plan.pdf');
  insert into public.event_push_subscriptions(user_id)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  insert into public.event_change_proposals(submitted_by, status)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pending');

  update public.planner_data
     set data = '{"from":"new-device"}'
   where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'FAIL: new active session cannot update planner_data';
  end if;
end
$test$;
reset role;

-- Verify the documented rollback on this disposable database.
\i supabase/rollback/20261123100000_single_active_device_session_rollback.sql

do $rollback_test$
begin
  if to_regprocedure('public.is_current_auth_session_active()') is not null then
    raise exception 'FAIL: rollback left public session RPC installed';
  end if;
  if to_regprocedure('private.is_current_auth_session_active()') is not null then
    raise exception 'FAIL: rollback left private session helper installed';
  end if;
  if position('is_current_auth_session_active' in coalesce((
    select pg_get_expr(polqual, polrelid)
    from pg_policy
    where polrelid = 'public.planner_data'::regclass
      and polname = 'Users can read own planner data'
  ), '')) > 0 then
    raise exception 'FAIL: rollback did not restore original planner_data policy';
  end if;
end
$rollback_test$;

select 'single-active-session RLS and rollback integration tests passed' as result;
