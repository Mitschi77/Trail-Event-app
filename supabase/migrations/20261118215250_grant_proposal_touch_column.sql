-- The updated_at touch trigger runs as the caller and needs this column privilege.
grant update (updated_at) on public.event_change_proposals to authenticated;
