-- Explicit opt-in coordinates for the public Community map.
-- Existing trails remain absent from the map until their owner enables the option.
alter table public.community_trails
  add column if not exists map_location_enabled boolean not null default false,
  add column if not exists start_latitude double precision,
  add column if not exists start_longitude double precision;

alter table public.community_trails
  drop constraint if exists community_trails_map_location_consistency_check;

alter table public.community_trails
  add constraint community_trails_map_location_consistency_check check (
    (
      map_location_enabled
      and start_latitude is not null
      and start_longitude is not null
      and visibility = 'public'
      and publication_status = 'published'
    )
    or (
      not map_location_enabled
      and start_latitude is null
      and start_longitude is null
    )
  ),
  add constraint community_trails_start_latitude_range_check
    check (start_latitude is null or start_latitude between -90 and 90),
  add constraint community_trails_start_longitude_range_check
    check (start_longitude is null or start_longitude between -180 and 180);

create index if not exists community_trails_public_map_idx
  on public.community_trails (id)
  where visibility = 'public'
    and publication_status = 'published'
    and map_location_enabled = true;
