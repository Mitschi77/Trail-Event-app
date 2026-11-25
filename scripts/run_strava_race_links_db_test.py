#!/usr/bin/env python3
"""Apply the Strava race-link migration to ephemeral PostgreSQL and test its integrity guards."""

import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase/migrations/20261125140000_strava_race_activity_links.sql"


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

    create table public.planner_data (
      user_id uuid primary key references auth.users(id) on delete cascade,
      data jsonb not null default '{}'::jsonb
    );
    create table public.strava_activities (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      provider_activity_id bigint not null,
      unique (id, user_id),
      unique (user_id, provider_activity_id)
    );
    insert into auth.users(id) values
      ('00000000-0000-0000-0000-000000000001'),
      ('00000000-0000-0000-0000-000000000002');
    insert into public.planner_data(user_id, data) values
      ('00000000-0000-0000-0000-000000000001',
       jsonb_build_object('trailEventRunRecords', jsonb_build_object(
         'race-a::route-1', jsonb_build_object('done', true),
         'race-b::route-1', jsonb_build_object('done', false)
       ), 'trailEventRunAttempts', jsonb_build_object(
         'race-a::route-1', jsonb_build_array(
           jsonb_build_object('date','2025-09-12','year','2025','done',true,'createdAt',1757678400000),
           jsonb_build_object('date','2026-09-12','year','2026','done',true,'createdAt',1789214400000)
         )
       ))),
      ('00000000-0000-0000-0000-000000000002',
       jsonb_build_object('trailEventRunRecords', jsonb_build_object(
         'other-race::route-1', jsonb_build_object('done', true)
       )));
    insert into public.strava_activities(id, user_id, provider_activity_id) values
      ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 101),
      ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 102),
      ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 201),
      ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 103),
      ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 104);
    """
    psql(sql=setup)
    psql(file=MIGRATION)
    psql(sql='grant select on public.planner_data to authenticated;')

    tests = """
    insert into public.strava_race_activity_links(user_id, activity_id, run_record_key, stage_order, stage_name)
    values
      ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'race-a::route-1', 1, 'Stage 1'),
      ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'race-a::route-1', 2, 'Stage 2'),
      ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'race-a::route-1::attempt::2025-09-12::1757678400000', 1, '2025 repeat'),
      ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'race-a::route-1::attempt::2026-09-12::1789214400000', 1, '2026 repeat');

    do $$
    begin
      begin
        insert into public.strava_race_activity_links(user_id, activity_id, run_record_key)
        values ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'missing::route');
        raise exception 'Expected missing-record rejection';
      exception when check_violation then null;
      end;
      begin
        insert into public.strava_race_activity_links(user_id, activity_id, run_record_key)
        values ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'race-b::route-1');
        raise exception 'Expected unfinished-record rejection';
      exception when check_violation then null;
      end;
      begin
        insert into public.strava_race_activity_links(user_id, activity_id, run_record_key, stage_order)
        values ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'race-a::route-1', 3);
        raise exception 'Expected duplicate-activity rejection';
      exception when unique_violation then null;
      end;
      begin
        insert into public.strava_race_activity_links(user_id, activity_id, run_record_key, stage_order)
        values ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'race-a::route-1', 1);
        raise exception 'Expected duplicate-stage rejection';
      exception when unique_violation then null;
      end;
      begin
        insert into public.strava_race_activity_links(user_id, activity_id, run_record_key)
        values ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'other-race::route-1');
        raise exception 'Expected cross-owner rejection';
      exception when foreign_key_violation then null;
      end;
    end $$;

    -- Verify the authenticated table policy exposes only the current user's links.
    set role authenticated;
    select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
    do $$
    begin
      if (select count(*) from public.strava_race_activity_links) <> 4 then
        raise exception 'RLS should expose exactly the four links owned by the current user';
      end if;
    end $$;
    select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
    do $$
    begin
      if (select count(*) from public.strava_race_activity_links) <> 0 then
        raise exception 'RLS leaked links belonging to another user';
      end if;
    end $$;
    reset role;

    do $$
    begin
      begin
        update public.planner_data
           set data = jsonb_set(data, '{trailEventRunRecords,race-a::route-1,done}', 'false'::jsonb)
         where user_id = '00000000-0000-0000-0000-000000000001';
        raise exception 'Expected reopen protection';
      exception when check_violation then null;
      end;
      begin
        update public.planner_data
           set data = jsonb_set(data, '{trailEventRunRecords}', (data->'trailEventRunRecords') - 'race-a::route-1')
         where user_id = '00000000-0000-0000-0000-000000000001';
        raise exception 'Expected removal protection';
      exception when check_violation then null;
      end;
      begin
        update public.planner_data
           set data = jsonb_set(data, '{trailEventRunAttempts,race-a::route-1}', '[]'::jsonb)
         where user_id = '00000000-0000-0000-0000-000000000001';
        raise exception 'Expected repeat-removal protection';
      exception when check_violation then null;
      end;
      begin
        delete from public.planner_data where user_id = '00000000-0000-0000-0000-000000000001';
        raise exception 'Expected parent-delete protection';
      exception when check_violation then null;
      end;
    end $$;

    delete from public.strava_race_activity_links
     where user_id = '00000000-0000-0000-0000-000000000001';
    update public.planner_data
       set data = jsonb_set(data, '{trailEventRunRecords}', (data->'trailEventRunRecords') - 'race-a::route-1')
     where user_id = '00000000-0000-0000-0000-000000000001';
    delete from public.planner_data where user_id = '00000000-0000-0000-0000-000000000001';

    select count(*) from public.strava_activities;
    """
    count = psql(sql=tests)
    if count.splitlines()[-1] != "5":
        raise AssertionError(f"Existing Strava activity rows changed; expected 5, got {count}")
    print("Strava race-link PostgreSQL migration test passed: valid stages, repeat participations across years, ownership, uniqueness, completed-record guards, unlink flow, and activity preservation.")


if __name__ == "__main__":
    main()
