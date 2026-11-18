create table if not exists public.event_push_rate_limits (
  id bigint generated always as identity primary key,
  caller_id uuid not null,
  sent_at timestamptz not null default now()
);

create index if not exists event_push_rate_limits_caller_sent_at_idx
  on public.event_push_rate_limits (caller_id, sent_at desc);

alter table public.event_push_rate_limits enable row level security;
revoke all on table public.event_push_rate_limits from anon, authenticated;
grant all on table public.event_push_rate_limits to service_role;

create or replace function public.claim_event_push_rate_limit(p_caller_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_caller_id::text));
  select count(*) into recent_count
  from public.event_push_rate_limits
  where caller_id = p_caller_id
    and sent_at > now() - interval '10 minutes';

  if recent_count >= 3 then
    return false;
  end if;

  insert into public.event_push_rate_limits(caller_id) values (p_caller_id);
  return true;
end;
$$;

revoke all on function public.claim_event_push_rate_limit(uuid) from public, anon, authenticated;
grant execute on function public.claim_event_push_rate_limit(uuid) to service_role;
