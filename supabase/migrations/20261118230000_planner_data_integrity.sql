create unique index if not exists planner_data_one_row_per_user
  on public.planner_data(user_id);

create or replace function public.protect_planner_data_row()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'Planner data cannot be reassigned to another account';
    end if;
    new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  elsif tg_op = 'INSERT' then
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$function$;

drop trigger if exists planner_data_protect_row on public.planner_data;
create trigger planner_data_protect_row
before insert or update on public.planner_data
for each row execute function public.protect_planner_data_row();

revoke all on function public.protect_planner_data_row() from public, anon, authenticated;
