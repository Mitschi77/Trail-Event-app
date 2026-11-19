-- The RPC validates the owner via auth.uid() and uses a fixed search_path.
-- SECURITY DEFINER lets it update the protected publication columns while
-- the trigger still enforces the proposal state transition.
alter function public.mark_event_proposal_published(uuid, text) security definer;
revoke all on function public.mark_event_proposal_published(uuid, text) from public, anon;
grant execute on function public.mark_event_proposal_published(uuid, text) to authenticated;
