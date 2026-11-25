-- Community MVP: private-first trails, metadata, reviews, comments and reports.
-- Additive only. Existing planner, event and Strava tables are not modified.
-- Storage objects must be pre-registered in community_trail_assets before upload.
-- Public GPX access is allowed only for published public trails with download_enabled=true.

create table if not exists public.community_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or length(btrim(display_name)) between 1 and 60),
  bio text check (bio is null or length(bio) <= 500),
  avatar_path text,
  profile_visibility text not null default 'private'
    check (profile_visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_trails (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  description text not null default '' check (length(description) <= 10000),
  visibility text not null default 'private'
    check (visibility in ('private', 'public')),
  publication_status text not null default 'draft'
    check (publication_status in ('draft', 'published', 'archived')),
  distance_m numeric(12,2) check (distance_m is null or distance_m > 0),
  ascent_m integer check (ascent_m is null or ascent_m >= 0),
  descent_m integer check (descent_m is null or descent_m >= 0),
  difficulty text check (difficulty is null or difficulty in ('easy', 'moderate', 'difficult', 'technical', 'expert')),
  surface_summary text check (surface_summary is null or length(surface_summary) <= 500),
  region_name text check (region_name is null or length(region_name) <= 120),
  country_code char(2),
  start_location_label text check (start_location_label is null or length(start_location_label) <= 160),
  gpx_download_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint community_trails_id_owner_unique unique (id, owner_id)
);

create index if not exists community_trails_public_search_idx
  on public.community_trails (country_code, region_name, difficulty)
  where visibility = 'public' and publication_status = 'published';

create index if not exists community_trails_owner_updated_idx
  on public.community_trails (owner_id, updated_at desc);

create table if not exists public.community_trail_assets (
  id uuid primary key default gen_random_uuid(),
  trail_id uuid not null,
  owner_id uuid not null,
  asset_kind text not null check (asset_kind in ('image', 'gpx', 'elevation_profile')),
  bucket_id text not null default 'community-trail-assets'
    check (bucket_id = 'community-trail-assets'),
  storage_path text not null unique check (
    length(btrim(storage_path)) > 0
    and storage_path like owner_id::text || '/' || trail_id::text || '/%'
  ),
  content_type text not null,
  file_size bigint check (file_size is null or file_size between 1 and 26214400),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$'),
  download_enabled boolean not null default false,
  caption text check (caption is null or length(caption) <= 300),
  alt_text text check (alt_text is null or length(alt_text) <= 300),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint community_trail_assets_trail_owner_fkey
    foreign key (trail_id, owner_id)
    references public.community_trails (id, owner_id)
    on delete cascade,
  constraint community_trail_assets_kind_content_check check (
    (asset_kind = 'image' and content_type in ('image/jpeg', 'image/png', 'image/webp'))
    or (asset_kind = 'elevation_profile' and content_type in ('image/jpeg', 'image/png', 'image/webp'))
    or (asset_kind = 'gpx' and content_type in ('application/gpx+xml', 'application/xml', 'text/xml'))
  )
);

create index if not exists community_trail_assets_trail_idx
  on public.community_trail_assets (trail_id, sort_order, created_at);

create table if not exists public.community_trail_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  trail_id uuid not null references public.community_trails(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, trail_id)
);

create table if not exists public.community_trail_reviews (
  id uuid primary key default gen_random_uuid(),
  trail_id uuid not null references public.community_trails(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  review_text text check (review_text is null or length(review_text) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trail_id, user_id)
);

create table if not exists public.community_trail_comments (
  id uuid primary key default gen_random_uuid(),
  trail_id uuid not null references public.community_trails(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists community_trail_comments_trail_created_idx
  on public.community_trail_comments (trail_id, created_at desc)
  where deleted_at is null;

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('trail', 'asset', 'review', 'comment', 'profile')),
  target_id uuid not null,
  reason_code text not null check (reason_code in ('unsafe', 'spam', 'copyright', 'abuse', 'privacy', 'other')),
  description text check (description is null or length(description) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create index if not exists community_reports_status_created_idx
  on public.community_reports (status, created_at)
  where status in ('open', 'reviewing');

-- Private bucket by default. Public access is mediated by RLS on storage.objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-trail-assets',
  'community-trail-assets',
  false,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'application/gpx+xml', 'application/xml', 'text/xml']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.community_profiles enable row level security;
alter table public.community_trails enable row level security;
alter table public.community_trail_assets enable row level security;
alter table public.community_trail_favorites enable row level security;
alter table public.community_trail_reviews enable row level security;
alter table public.community_trail_comments enable row level security;
alter table public.community_reports enable row level security;

revoke all on public.community_profiles, public.community_trails,
  public.community_trail_assets, public.community_trail_favorites,
  public.community_trail_reviews, public.community_trail_comments,
  public.community_reports from anon, authenticated;

grant select, insert, update, delete on public.community_profiles,
  public.community_trails, public.community_trail_assets,
  public.community_trail_favorites, public.community_trail_reviews,
  public.community_trail_comments, public.community_reports to authenticated;

-- Profiles are optional. Other users can only see explicitly public profiles.
create policy community_profiles_read on public.community_profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or profile_visibility = 'public');
create policy community_profiles_insert_own on public.community_profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy community_profiles_update_own on public.community_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy community_profiles_delete_own on public.community_profiles
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Only published public trails are discoverable. Owners can always manage their own.
create policy community_trails_read_visible on public.community_trails
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or (visibility = 'public' and publication_status = 'published')
  );
create policy community_trails_insert_own on public.community_trails
  for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy community_trails_update_own on public.community_trails
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy community_trails_delete_own on public.community_trails
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Public asset metadata is visible only when the trail is published and public.
-- GPX metadata is exposed to others only when the owner enabled downloads.
create policy community_trail_assets_read_visible on public.community_trail_assets
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.community_trails t
      where t.id = community_trail_assets.trail_id
        and t.owner_id = community_trail_assets.owner_id
        and t.visibility = 'public'
        and t.publication_status = 'published'
        and (
          community_trail_assets.asset_kind <> 'gpx'
          or (t.gpx_download_enabled and community_trail_assets.download_enabled)
        )
    )
  );
create policy community_trail_assets_insert_own on public.community_trail_assets
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.community_trails t
      where t.id = trail_id and t.owner_id = (select auth.uid())
    )
  );
create policy community_trail_assets_update_own on public.community_trail_assets
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.community_trails t
      where t.id = trail_id and t.owner_id = (select auth.uid())
    )
  );
create policy community_trail_assets_delete_own on public.community_trail_assets
  for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy community_trail_favorites_read_own on public.community_trail_favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy community_trail_favorites_insert_own on public.community_trail_favorites
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.community_trails t
      where t.id = trail_id and t.visibility = 'public' and t.publication_status = 'published'
    )
  );
create policy community_trail_favorites_delete_own on public.community_trail_favorites
  for delete to authenticated using (user_id = (select auth.uid()));

create policy community_trail_reviews_read_visible on public.community_trail_reviews
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.community_trails t
      where t.id = trail_id and t.visibility = 'public' and t.publication_status = 'published'
    )
  );
create policy community_trail_reviews_insert_own on public.community_trail_reviews
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.community_trails t
      where t.id = trail_id and t.visibility = 'public' and t.publication_status = 'published'
    )
  );
create policy community_trail_reviews_update_own on public.community_trail_reviews
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.community_trails t
      where t.id = trail_id and t.visibility = 'public' and t.publication_status = 'published'
    )
  );
create policy community_trail_reviews_delete_own on public.community_trail_reviews
  for delete to authenticated using (user_id = (select auth.uid()));

create policy community_trail_comments_read_visible on public.community_trail_comments
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.community_trails t
      where t.id = trail_id and t.visibility = 'public' and t.publication_status = 'published'
    )
  );
create policy community_trail_comments_insert_own on public.community_trail_comments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.community_trails t
      where t.id = trail_id and t.visibility = 'public' and t.publication_status = 'published'
    )
  );
create policy community_trail_comments_update_own on public.community_trail_comments
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.community_trails t
      where t.id = trail_id and t.visibility = 'public' and t.publication_status = 'published'
    )
  );
create policy community_trail_comments_delete_own on public.community_trail_comments
  for delete to authenticated using (user_id = (select auth.uid()));

-- Reports are private to the reporter until a dedicated moderator-role model is introduced.
create policy community_reports_read_own on public.community_reports
  for select to authenticated
  using (reporter_id = (select auth.uid()));
create policy community_reports_insert_own on public.community_reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()));

-- Storage object access is coupled to a pre-created asset row and the parent trail.
create policy community_assets_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'community-trail-assets'
    and exists (
      select 1 from public.community_trail_assets a
      join public.community_trails t on t.id = a.trail_id and t.owner_id = a.owner_id
      where a.bucket_id = 'community-trail-assets'
        and a.storage_path = name
        and (
          a.owner_id = (select auth.uid())
          or (
            t.visibility = 'public'
            and t.publication_status = 'published'
            and (a.asset_kind <> 'gpx' or (t.gpx_download_enabled and a.download_enabled))
          )
        )
    )
  );

create policy community_assets_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'community-trail-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.community_trail_assets a
      where a.bucket_id = 'community-trail-assets'
        and a.storage_path = name
        and a.owner_id = (select auth.uid())
    )
  );

create policy community_assets_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'community-trail-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.community_trail_assets a
      where a.bucket_id = 'community-trail-assets'
        and a.storage_path = name
        and a.owner_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'community-trail-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.community_trail_assets a
      where a.bucket_id = 'community-trail-assets'
        and a.storage_path = name
        and a.owner_id = (select auth.uid())
    )
  );

create policy community_assets_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'community-trail-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.community_trail_assets a
      where a.bucket_id = 'community-trail-assets'
        and a.storage_path = name
        and a.owner_id = (select auth.uid())
    )
  );
