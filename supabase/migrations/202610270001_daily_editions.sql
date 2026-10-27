begin;
create table public.edition_revisions (
  id text primary key check (id ~ '^daily-fr-[0-9]{4}-[0-9]{2}-[0-9]{2}(@r[0-9]+)?$'),
  edition_date date not null,
  revision integer not null check (revision > 0),
  bundle_path text not null unique,
  bundle_sha256 text not null,
  audio_path text not null unique,
  title text not null,
  status text not null default 'draft' check (status in ('draft','published','withdrawn')),
  verified_at timestamptz,
  published_at timestamptz,
  unique (edition_date, revision)
);
create table public.edition_catalog (
  edition_date date primary key,
  edition_id text not null references public.edition_revisions(id)
);
create table public.edition_runs (
  run_date date primary key,
  owner uuid,
  lease_until timestamptz,
  stage text not null default 'pending',
  status text not null default 'pending',
  reserved_usd numeric not null default 0 check (reserved_usd >= 0),
  details jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
create table public.edition_cost_events (
  id uuid primary key,
  run_date date not null references public.edition_runs(run_date),
  provider text not null,
  request_hash text not null,
  reserved_usd numeric not null check (reserved_usd > 0),
  status text not null,
  usage jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.edition_cost_events enable row level security;
revoke all on public.edition_cost_events from anon, authenticated;
grant all on public.edition_cost_events to service_role;
alter table public.edition_revisions enable row level security;
alter table public.edition_catalog enable row level security;
alter table public.edition_runs enable row level security;
revoke all on public.edition_revisions, public.edition_catalog, public.edition_runs from anon, authenticated;
grant all on public.edition_revisions, public.edition_catalog, public.edition_runs to service_role;
insert into storage.buckets (id,name,public) values ('editions','editions',false),('edition-work','edition-work',false) on conflict (id) do nothing;

create function public.claim_edition_run(p_date date,p_owner uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin
  insert into edition_runs(run_date) values (p_date) on conflict do nothing;
  update edition_runs set owner=p_owner,lease_until=now()+interval '20 minutes',updated_at=now()
    where run_date=p_date and (lease_until is null or lease_until<now() or owner=p_owner);
  return found;
end $$;
create function public.reserve_edition_cost(p_date date,p_owner uuid,p_amount numeric,p_limit numeric) returns boolean language plpgsql security definer set search_path=public as $$
begin
  if p_amount < 0 or p_limit <= 0 then raise exception 'Invalid budget'; end if;
  update edition_runs set reserved_usd=reserved_usd+p_amount,updated_at=now()
  where run_date=p_date and owner=p_owner and lease_until>now() and reserved_usd+p_amount<=p_limit;
  return found;
end $$;
create function public.publish_edition(p_id text,p_backfill boolean default false) returns void language plpgsql security definer set search_path=public,storage as $$
declare r edition_revisions;
begin
  select * into strict r from edition_revisions where id=p_id for update;
  if r.verified_at is null then raise exception 'Edition has not passed verification'; end if;
  if p_backfill and r.edition_date >= (now() at time zone 'America/New_York')::date then raise exception 'Backfill is only for past editions'; end if;
  if not p_backfill and now() < (r.edition_date+time '07:00') at time zone 'America/New_York' then raise exception 'Publication is not due'; end if;
  if not exists(select 1 from storage.objects where bucket_id='editions' and name=r.bundle_path)
     or not exists(select 1 from storage.objects where bucket_id='editions' and name=r.audio_path) then raise exception 'Missing assets'; end if;
  update edition_revisions set status='published',published_at=coalesce(published_at,now()) where id=p_id;
  insert into edition_catalog values (r.edition_date,p_id) on conflict (edition_date) do update set edition_id=excluded.edition_id;
end $$;
create function public.withdraw_edition(p_id text) returns void language plpgsql security definer set search_path=public as $$
begin
  delete from edition_catalog where edition_id=p_id;
  update edition_revisions set status='withdrawn' where id=p_id;
end $$;
create function public.protect_edition_revision() returns trigger language plpgsql as $$
begin
  if old.published_at is not null and new.published_at is distinct from old.published_at then raise exception 'Publication timestamp is immutable'; end if;
  if old.published_at is not null and (new.id,new.edition_date,new.revision,new.bundle_path,new.bundle_sha256,new.audio_path,new.title,new.verified_at) is distinct from (old.id,old.edition_date,old.revision,old.bundle_path,old.bundle_sha256,old.audio_path,old.title,old.verified_at) then raise exception 'Published revision is immutable'; end if;
  return new;
end $$;
create trigger immutable_edition before update on public.edition_revisions for each row execute function public.protect_edition_revision();
revoke all on function public.claim_edition_run(date,uuid), public.reserve_edition_cost(date,uuid,numeric,numeric), public.publish_edition(text,boolean), public.withdraw_edition(text) from public,anon,authenticated;
grant execute on function public.claim_edition_run(date,uuid), public.reserve_edition_cost(date,uuid,numeric,numeric), public.publish_edition(text,boolean), public.withdraw_edition(text) to service_role;
commit;
