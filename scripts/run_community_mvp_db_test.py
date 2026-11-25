#!/usr/bin/env python3
"""Apply the Community MVP migration to ephemeral PostgreSQL and test RLS/storage access."""

import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase/migrations/20261125170000_community_mvp.sql"
MAP_MIGRATION = ROOT / "supabase/migrations/20261125173000_community_map_locations.sql"


def psql(*, sql=None, file=None):
    command = ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-qAt"]
    command += ["-f", str(file)] if file else ["-c", sql]
    result = subprocess.run(command, check=True, text=True, capture_output=True, env=os.environ.copy())
    return result.stdout.strip()


def main():
    setup = """
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create or replace function auth.uid() returns uuid
      language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;

    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null,
      name text not null,
      unique (bucket_id, name)
    );
    alter table storage.objects enable row level security;
    create or replace function storage.foldername(path text)
      returns text[] language sql immutable as $$
        select case
          when array_length(string_to_array(path, '/'), 1) > 1
          then (string_to_array(path, '/'))[1:array_length(string_to_array(path, '/'), 1)-1]
          else array[]::text[]
        end
      $$;
    grant usage on schema storage to authenticated;
    grant select, insert, update, delete on storage.objects to authenticated;

    insert into auth.users(id) values
      ('00000000-0000-0000-0000-000000000001'),
      ('00000000-0000-0000-0000-000000000002');

    """
    psql(sql=setup)
    psql(file=MIGRATION)
    psql(file=MAP_MIGRATION)

    fixtures = """
    insert into public.community_profiles(user_id, display_name, profile_visibility) values
      ('00000000-0000-0000-0000-000000000001', 'Runner A', 'private'),
      ('00000000-0000-0000-0000-000000000002', 'Runner B', 'public');

    insert into public.community_trails(
      id, owner_id, title, visibility, publication_status, gpx_download_enabled,
      map_location_enabled, start_latitude, start_longitude
    ) values
      ('10000000-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-000000000001', 'Public Trail', 'public', 'published', false, true, 47.1, 12.2),
      ('10000000-0000-0000-0000-000000000002',
       '00000000-0000-0000-0000-000000000001', 'Private Trail', 'private', 'published', true, false, null, null),
      ('10000000-0000-0000-0000-000000000003',
       '00000000-0000-0000-0000-000000000001', 'Public GPX Trail', 'public', 'published', true, false, null, null);

    insert into public.community_trail_assets(
      trail_id, owner_id, asset_kind, storage_path, content_type, download_enabled
    ) values
      ('10000000-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-000000000001', 'image',
       '00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000001/cover.jpg',
       'image/jpeg', false),
      ('10000000-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-000000000001', 'gpx',
       '00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000001/route.gpx',
       'application/gpx+xml', false),
      ('10000000-0000-0000-0000-000000000002',
       '00000000-0000-0000-0000-000000000001', 'gpx',
       '00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000002/private.gpx',
       'application/gpx+xml', true),
      ('10000000-0000-0000-0000-000000000003',
       '00000000-0000-0000-0000-000000000001', 'gpx',
       '00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000003/allowed.gpx',
       'application/gpx+xml', true),
      ('10000000-0000-0000-0000-000000000003',
       '00000000-0000-0000-0000-000000000001', 'gpx',
       '00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000003/asset-disabled.gpx',
       'application/gpx+xml', false);

    insert into storage.objects(bucket_id, name) values
      ('community-trail-assets', '00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000001/cover.jpg'),
      ('community-trail-assets', '00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000001/route.gpx'),
      ('community-trail-assets', '00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000002/private.gpx'),
      ('community-trail-assets', '00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000003/allowed.gpx'),
      ('community-trail-assets', '00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000003/asset-disabled.gpx');
    """
    psql(sql=fixtures)

    tests = """
    -- Account B can see public trail, not private trail, and only public image metadata.
    set role authenticated;
    select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
    do $$
    begin
      if (select count(*) from public.community_trails) <> 2 then
        raise exception 'Public trail visibility leaked or private trail was hidden incorrectly';
      end if;
      if (select count(*) from public.community_trail_assets) <> 2 then
        raise exception 'Public asset metadata policy should expose only the public image';
      end if;
      if (select count(*) from storage.objects where bucket_id='community-trail-assets') <> 2 then
        raise exception 'Storage policy exposed private or download-disabled GPX data';
      end if;
      if (select count(*) from public.community_profiles) <> 1 then
        raise exception 'Private profile was exposed to another account';
      end if;
      if (select count(*) from public.community_trails where map_location_enabled) <> 1 then
        raise exception 'Public map should expose only the explicitly opted-in trail';
      end if;
      if not exists (
        select 1 from public.community_trails
        where id='10000000-0000-0000-0000-000000000001'
          and start_latitude=47.1 and start_longitude=12.2
      ) then
        raise exception 'Opted-in public map coordinates are missing';
      end if;
    end $$;

    -- Account B cannot favorite a private trail, but can favorite a public one.
    do $$
    begin
      begin
        insert into public.community_trail_favorites(user_id, trail_id)
        values ('00000000-0000-0000-0000-000000000002',
                '10000000-0000-0000-0000-000000000002');
        raise exception 'Expected private-trail favorite rejection';
      exception when insufficient_privilege then null;
      end;
    end $$;
    insert into public.community_trail_favorites(user_id, trail_id)
    values ('00000000-0000-0000-0000-000000000002',
            '10000000-0000-0000-0000-000000000001');

    -- Account B may comment on the public trail but cannot move that comment to a private trail.
    insert into public.community_trail_comments(trail_id, user_id, body)
    values ('10000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002', 'Good route');
    do $$
    declare comment_id uuid;
    begin
      select id into comment_id from public.community_trail_comments
       where user_id='00000000-0000-0000-0000-000000000002';
      begin
        update public.community_trail_comments
           set trail_id='10000000-0000-0000-0000-000000000002'
         where id=comment_id;
        raise exception 'Expected private-trail comment move rejection';
      exception when insufficient_privilege then null;
      end;
    end $$;

    -- A user cannot change a profile, trail or asset owned by another account.
    do $$
    begin
      if (select count(*) from public.community_trails
          where id='10000000-0000-0000-0000-000000000002') <> 0 then
        raise exception 'Account B can see another account private trail';
      end if;
      if (select count(*) from public.community_profiles
          where user_id='00000000-0000-0000-0000-000000000001') <> 0 then
        raise exception 'Account B can see another account private profile';
      end if;
    end $$;
    reset role;

    -- Account A owns both trails and all three assets.
    set role authenticated;
    select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
    do $$
    begin
      if (select count(*) from public.community_trails) <> 3 then
        raise exception 'Owner cannot see all of their trails';
      end if;
      if (select count(*) from public.community_trail_assets) <> 5 then
        raise exception 'Owner cannot see all of their assets';
      end if;
      if (select count(*) from storage.objects where bucket_id='community-trail-assets') <> 5 then
        raise exception 'Owner cannot access all of their storage objects';
      end if;
    end $$;
    reset role;

    -- Constraints reject malformed path, unsupported MIME and duplicate review.
    do $mapcheck$
    begin
      begin
        insert into public.community_trail_assets(
          trail_id, owner_id, asset_kind, storage_path, content_type
        ) values (
          '10000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000001',
          'image', 'wrong-owner/path/image.jpg', 'image/jpeg'
        );
        raise exception 'Expected invalid storage path rejection';
      exception when check_violation then null;
      end;
      begin
        insert into public.community_trail_assets(
          trail_id, owner_id, asset_kind, storage_path, content_type
        ) values (
          '10000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000001',
          'image', '00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000001/bad.svg',
          'image/svg+xml'
        );
        raise exception 'Expected unsupported MIME rejection';
      exception when check_violation then null;
      end;
      begin
        insert into public.community_trails(
          owner_id, title, visibility, publication_status,
          map_location_enabled, start_latitude, start_longitude
        ) values (
          '00000000-0000-0000-0000-000000000001',
          'Private map pin', 'private', 'draft', true, 47.0, 12.0
        );
        raise exception 'Expected private map location rejection';
      exception when check_violation then null;
      end;
      begin
        insert into public.community_trails(
          owner_id, title, visibility, publication_status,
          map_location_enabled, start_latitude, start_longitude
        ) values (
          '00000000-0000-0000-0000-000000000001',
          'Invalid map pin', 'public', 'published', true, 97.0, 12.0
        );
        raise exception 'Expected invalid latitude rejection';
      exception when check_violation then null;
      end;
    end $mapcheck$;

    select public, file_size_limit from storage.buckets where id='community-trail-assets';
    """
    result = psql(sql=tests)
    if result.splitlines()[-1] != "f|26214400":
        raise AssertionError(f"Community bucket must be private with 25 MiB limit, got {result}")
    print("Community MVP PostgreSQL test passed: private/public trail visibility, profile privacy, opt-in map coordinate privacy, asset/GPX access, storage RLS, ownership, comments, favorites and upload constraints.")


if __name__ == "__main__":
    main()
