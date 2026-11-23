-- Minimal disposable schema needed to exercise the production session migration
-- against a real local Supabase Auth + PostgREST + Storage stack.
-- This is CI-only test scaffolding; it is not a production schema baseline.

create table public.planner_data (
  user_id uuid primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.planner_data enable row level security;
grant select, insert, update, delete on public.planner_data to authenticated;
create policy "Users can read own planner data" on public.planner_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own planner data" on public.planner_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own planner data" on public.planner_data
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete own planner data" on public.planner_data
  for delete to authenticated using ((select auth.uid()) = user_id);

create table public.event_push_subscriptions (user_id uuid not null);
alter table public.event_push_subscriptions enable row level security;
grant select, insert, update, delete on public.event_push_subscriptions to authenticated;
create policy "Users manage own push subscriptions" on public.event_push_subscriptions
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table public.event_change_proposals (
  id bigint generated always as identity primary key,
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

insert into storage.buckets (id, name, public, file_size_limit)
values ('trail-private-documents', 'trail-private-documents', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

create policy "Users can read own trail documents" on storage.objects
  for select to authenticated using (
    bucket_id = 'trail-private-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Users can upload own trail documents" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'trail-private-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Users can update own trail documents" on storage.objects
  for update to authenticated using (
    bucket_id = 'trail-private-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  ) with check (
    bucket_id = 'trail-private-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Users can delete own trail documents" on storage.objects
  for delete to authenticated using (
    bucket_id = 'trail-private-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
