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
