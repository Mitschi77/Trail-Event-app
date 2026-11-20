-- Store review comparison decisions separately from the immutable submitted proposal payload.
alter table public.event_change_proposals
  add column if not exists comparison_decision jsonb;
