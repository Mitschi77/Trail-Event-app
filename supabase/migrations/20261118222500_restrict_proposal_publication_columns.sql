revoke update (published_at, published_by, publication_ref)
  on public.event_change_proposals from authenticated;
grant update (status, reviewer_note, decided_by, decided_at)
  on public.event_change_proposals to authenticated;