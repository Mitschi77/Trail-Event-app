-- PostgreSQL integration test for the single-active-device RLS guard.
-- Run against a disposable PostgreSQL database as a superuser:
-- psql -v ON_ERROR_STOP=1 -f scripts/test_single_active_session_guard.sql

create role anon;
create role authenticated;

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

insert into auth.sessions(id, user_id) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

set request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","session_id":"11111111-1111-4111-8111-111111111111"}';
set role authenticated;
insert into public.planner_data(user_id, data)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{"from":"device-a"}');
reset role;

-- Simulate signOut({ scope: 'others' }) removing the old auth session row.
delete from auth.sessions where id = '11111111-1111-4111-8111-111111111111';

set role authenticated;
do $test$
declare
  affected integer;
  visible_rows integer;
begin
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

select 'single-active-session RLS integration test passed' as result;
