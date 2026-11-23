-- Rollback for 20261123100000_single_active_device_session.sql
-- IMPORTANT: restore the previous app/Edge Function versions or disable their
-- calls to public.is_current_auth_session_active() before dropping the RPC.
-- Run only if the migration has been applied and a rollback is required.
begin;

-- Restore the original planner_data policies.
drop policy if exists "Users can read own planner data" on public.planner_data;
create policy "Users can read own planner data"
  on public.planner_data for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own planner data" on public.planner_data;
create policy "Users can insert own planner data"
  on public.planner_data for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own planner data" on public.planner_data;
create policy "Users can update own planner data"
  on public.planner_data for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own planner data" on public.planner_data;
create policy "Users can delete own planner data"
  on public.planner_data for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Restore the original private-document policies.
alter policy "Users can read own trail documents"
  on storage.objects using (
    bucket_id = 'trail-private-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

alter policy "Users can upload own trail documents"
  on storage.objects with check (
    bucket_id = 'trail-private-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

alter policy "Users can update own trail documents"
  on storage.objects using (
    bucket_id = 'trail-private-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  ) with check (
    bucket_id = 'trail-private-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

alter policy "Users can delete own trail documents"
  on storage.objects using (
    bucket_id = 'trail-private-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Restore push-subscription access.
alter policy "Users manage own push subscriptions"
  on public.event_push_subscriptions
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Restore proposal access and decision rules.
alter policy "owner and submitter read proposals"
  on public.event_change_proposals
  using (
    (select auth.uid()) = 'a5d10e85-e559-4d44-9ee0-d8b8de08262f'::uuid
    or submitted_by = (select auth.uid())
  );

alter policy "owner decides proposals"
  on public.event_change_proposals
  using ((select auth.uid()) = 'a5d10e85-e559-4d44-9ee0-d8b8de08262f'::uuid)
  with check (
    (select auth.uid()) = 'a5d10e85-e559-4d44-9ee0-d8b8de08262f'::uuid
    and status = any (array['approved'::text, 'rejected'::text])
    and decided_by = (select auth.uid())
    and decided_at is not null
  );

alter policy "submit authenticated proposals"
  on public.event_change_proposals
  with check (
    submitted_by = (select auth.uid())
    and status = 'pending'::text
    and decided_by is null
    and decided_at is null
  );

-- Drop the RPCs only after all policies no longer reference them.
drop function if exists public.is_current_auth_session_active();
drop function if exists private.is_current_auth_session_active();

commit;
