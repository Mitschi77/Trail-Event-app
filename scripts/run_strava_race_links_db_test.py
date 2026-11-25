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
       ))),
      ('00000000-0000-0000-0000-000000000002',
       jsonb_build_object('trailEventRunRecords', jsonb_build_object(
         'other-race::route-1', jsonb_build_object('done', true)
       )));
    insert into public.strava_activities(id, user_id, provider_activity_id) values
      ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 101),
      ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 102),
      ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 201);
    """
    psql(sql=setup)
    psql(file=MIGRATION)

    tests = """
    insert into public.strava_race_activity_links(user_id, activity_id, run_record_key, stage_order, stage_name)
    values
      ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'race-a::route-1', 1, 'Stage 1'),
      ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'race-a::route-1', 2, 'Stage 2');

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
    if count.splitlines()[-1] != "3":
        raise AssertionError(f"Existing Strava activity rows changed; expected 3, got {count}")
    print("Strava race-link PostgreSQL migration test passed: valid stages, ownership, uniqueness, completed-record guards, unlink flow, and activity preservation.")


if __name__ == "__main__":
    main()
