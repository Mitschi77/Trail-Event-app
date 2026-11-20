#!/usr/bin/env python3
"""Run a real PostgreSQL concurrency test for the proposal-ingestion RPC."""

import json
import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase/migrations/20261120231500_atomic_proposal_ingestion.sql"
EVENT_ID = "__proposal_ingestion_concurrency_ci_test__"
ROUTE_ID = "__ci_route__"


def psql(*, sql=None, file=None, capture=True):
    command = ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-qAt"]
    if file is not None:
        command += ["-f", str(file)]
    else:
        command += ["-c", sql]
    result = subprocess.run(
        command,
        check=True,
        text=True,
        capture_output=capture,
        env=os.environ.copy(),
    )
    return result.stdout.strip() if capture else ""


def main():
    setup = """
    do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
    drop table if exists public.event_change_proposals cascade;
    create table public.event_change_proposals (
      id uuid primary key default gen_random_uuid(),
      submitted_by uuid not null,
      proposal_type text not null,
      title text not null check (length(trim(title)) > 0),
      payload jsonb not null check (jsonb_typeof(payload) = 'object'),
      status text not null default 'pending'
    );
    grant usage on schema public to service_role;
    grant select, insert on public.event_change_proposals to service_role;
    """
    psql(sql=setup)
    psql(file=MIGRATION, capture=False)

    # Keep the first transaction inside its INSERT long enough for the second
    # connection to overlap while trying to acquire the same advisory lock.
    psql(sql="""
      create or replace function public.test_delay_proposal_insert()
      returns trigger language plpgsql as $$
      begin
        perform pg_sleep(1.2);
        return new;
      end;
      $$;
      create trigger test_delay_proposal_insert
      before insert on public.event_change_proposals
      for each row execute function public.test_delay_proposal_insert();
    """)

    payload = {
        "proposal_type": "data_correction",
        "title": "Concurrent CI proposal",
        "payload": {
            "eventId": EVENT_ID,
            "routeId": ROUTE_ID,
            "field": "maxh",
            "source": "automated_event_data_finder",
        },
    }
    body = json.dumps([payload], separators=(",", ":"))
    call = (
        "begin; set local role service_role; "
        f"select public.ingest_event_change_proposals('{body}'::jsonb); commit;"
    )
    processes = [
        subprocess.Popen(
            ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-qAt", "-c", call],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=os.environ.copy(),
        )
        for _ in range(2)
    ]
    outputs = []
    for process in processes:
        stdout, stderr = process.communicate(timeout=20)
        if process.returncode:
            raise RuntimeError(f"Concurrent ingestion failed: {stderr}")
        outputs.append(json.loads(stdout.strip().splitlines()[-1]))

    count = int(psql(sql=f"""
      select count(*) from public.event_change_proposals
      where payload->>'eventId' = '{EVENT_ID}'
        and payload->>'routeId' = '{ROUTE_ID}'
        and payload->>'field' = 'maxh'
        and status = 'pending';
    """))
    if count != 1:
        raise AssertionError(f"Concurrent requests created {count} pending rows, expected 1")
    if sorted(result["inserted"] for result in outputs) != [0, 1]:
        raise AssertionError(f"Unexpected concurrent RPC results: {outputs}")
    if sorted(result["duplicates"] for result in outputs) != [0, 1]:
        raise AssertionError(f"Unexpected duplicate counts: {outputs}")

    privilege_result = psql(sql="""
      select has_function_privilege('anon', 'public.ingest_event_change_proposals(jsonb)', 'EXECUTE'),
             has_function_privilege('authenticated', 'public.ingest_event_change_proposals(jsonb)', 'EXECUTE'),
             has_function_privilege('service_role', 'public.ingest_event_change_proposals(jsonb)', 'EXECUTE');
    """)
    if privilege_result != "f|f|t":
        raise AssertionError(f"Unexpected RPC execute privileges: {privilege_result}")

    repeat = psql(sql=f"""
      begin;
      set local role service_role;
      select public.ingest_event_change_proposals('{body}'::jsonb);
      rollback;
    """)
    repeated_result = json.loads(repeat.splitlines()[-1])
    if repeated_result["inserted"] != 0 or repeated_result["duplicates"] != 1:
        raise AssertionError(f"Retry was not idempotent: {repeated_result}")

    print("PostgreSQL proposal-ingestion concurrency test passed: one row, one duplicate, service_role-only RPC.")


if __name__ == "__main__":
    main()
