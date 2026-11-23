-- Enforce the currently valid Supabase Auth session for planner_data access.
-- The app revokes other sessions after an explicit successful password login
-- with supabase.auth.signOut({ scope: 'others' }). This RLS guard also blocks
-- already-issued JWTs from reading/writing planner_data after their auth.sessions
-- row has been removed. It does not replace the app-side logout UX.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_current_auth_session_active()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select
    auth.uid() is not null
    and nullif(auth.jwt() ->> 'session_id', '') is not null
    and exists (
      select 1
      from auth.sessions as s
      where s.id = (auth.jwt() ->> 'session_id')::uuid
        and s.user_id = auth.uid()
    );
$function$;

revoke all on function private.is_current_auth_session_active() from public, anon;
grant execute on function private.is_current_auth_session_active() to authenticated;

drop policy if exists "Users can read own planner data" on public.planner_data;
create policy "Users can read own planner data"
  on public.planner_data
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (select private.is_current_auth_session_active())
  );

drop policy if exists "Users can insert own planner data" on public.planner_data;
create policy "Users can insert own planner data"
  on public.planner_data
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select private.is_current_auth_session_active())
  );

drop policy if exists "Users can update own planner data" on public.planner_data;
create policy "Users can update own planner data"
  on public.planner_data
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (select private.is_current_auth_session_active())
  )
  with check (
    (select auth.uid()) = user_id
    and (select private.is_current_auth_session_active())
  );

drop policy if exists "Users can delete own planner data" on public.planner_data;
create policy "Users can delete own planner data"
  on public.planner_data
  for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and (select private.is_current_auth_session_active())
  );

-- Extend the same revoked-session check to the app's private documents and
-- user-owned review/push records. This keeps a still-unexpired old JWT from
-- using these RLS-protected resources after another device signs in.

alter policy "Users can read own trail documents"
  on storage.objects
  using (
    bucket_id = 'trail-private-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_current_auth_session_active())
  );

alter policy "Users can upload own trail documents"
  on storage.objects
  with check (
    bucket_id = 'trail-private-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_current_auth_session_active())
  );

alter policy "Users can update own trail documents"
  on storage.objects
  using (
    bucket_id = 'trail-private-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_current_auth_session_active())
  )
  with check (
    bucket_id = 'trail-private-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_current_auth_session_active())
  );

alter policy "Users can delete own trail documents"
  on storage.objects
  using (
    bucket_id = 'trail-private-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_current_auth_session_active())
  );

alter policy "Users manage own push subscriptions"
  on public.event_push_subscriptions
  using (
    (select auth.uid()) = user_id
    and (select private.is_current_auth_session_active())
  )
  with check (
    (select auth.uid()) = user_id
    and (select private.is_current_auth_session_active())
  );

alter policy "owner and submitter read proposals"
  on public.event_change_proposals
  using (
    (
      (select auth.uid()) = 'a5d10e85-e559-4d44-9ee0-d8b8de08262f'::uuid
      or submitted_by = (select auth.uid())
    )
    and (select private.is_current_auth_session_active())
  );

alter policy "owner decides proposals"
  on public.event_change_proposals
  using (
    (select auth.uid()) = 'a5d10e85-e559-4d44-9ee0-d8b8de08262f'::uuid
    and (select private.is_current_auth_session_active())
  )
  with check (
    (select auth.uid()) = 'a5d10e85-e559-4d44-9ee0-d8b8de08262f'::uuid
    and status = any (array['approved'::text, 'rejected'::text])
    and decided_by = (select auth.uid())
    and decided_at is not null
    and (select private.is_current_auth_session_active())
  );

alter policy "submit authenticated proposals"
  on public.event_change_proposals
  with check (
    submitted_by = (select auth.uid())
    and status = 'pending'::text
    and decided_by is null
    and decided_at is null
    and (select private.is_current_auth_session_active())
  );


-- A zero-argument wrapper lets authenticated Edge Function callers validate
-- their own JWT session through PostgREST without exposing auth.sessions.
create or replace function public.is_current_auth_session_active()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select private.is_current_auth_session_active();
$function$;

revoke all on function public.is_current_auth_session_active() from public, anon;
grant execute on function public.is_current_auth_session_active() to authenticated;
