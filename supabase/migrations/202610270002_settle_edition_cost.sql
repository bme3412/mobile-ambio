-- Keep original reservations for audit; release only verified unused amounts.
alter table public.edition_cost_events add column settled_usd numeric check (settled_usd >= 0 and settled_usd <= reserved_usd);
alter table public.edition_cost_events add column settlement_basis jsonb;
create function public.settle_edition_cost(p_event uuid,p_actual numeric,p_basis jsonb) returns boolean
language plpgsql security definer set search_path=public as $$
declare event_date date; event_row edition_cost_events%rowtype;
begin
  select run_date into event_date from edition_cost_events where id=p_event;
  if event_date is null then raise exception 'Unknown cost event'; end if;
  perform 1 from edition_runs where run_date=event_date for update;
  select * into event_row from edition_cost_events where id=p_event for update;
  if event_row.settled_usd is not null then return event_row.settled_usd=p_actual; end if;
  if event_row.status <> 'completed' or p_actual is null or p_actual < 0 or p_actual > event_row.reserved_usd or p_basis is null then
    raise exception 'Only completed, verified costs within their reservation may settle';
  end if;
  update edition_cost_events set settled_usd=p_actual,settlement_basis=p_basis where id=p_event;
  update edition_runs set reserved_usd=reserved_usd-(event_row.reserved_usd-p_actual),updated_at=now() where run_date=event_date;
  return true;
end $$;
revoke all on function public.settle_edition_cost(uuid,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.settle_edition_cost(uuid,numeric,jsonb) to service_role;
