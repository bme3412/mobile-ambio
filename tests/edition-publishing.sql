-- Run against a disposable PostgreSQL database after the migration.
\set ON_ERROR_STOP on
begin;
insert into public.edition_revisions(id,edition_date,revision,bundle_path,bundle_sha256,audio_path,title,verified_at)
values ('daily-fr-2020-01-01','2020-01-01',1,'daily-fr-2020-01-01/bundle.json','hash','daily-fr-2020-01-01/audio.mp3','Test',now());
do $$
begin
  begin
    perform public.publish_edition('daily-fr-2020-01-01');
    raise exception 'TEST: partial upload was published';
  exception when others then
    if sqlerrm like 'TEST:%' then raise; end if;
  end;
  if exists(select 1 from public.edition_catalog) then raise exception 'Catalog changed on failure'; end if;
end $$;
insert into storage.objects(bucket_id,name) values ('editions','daily-fr-2020-01-01/bundle.json'),('editions','daily-fr-2020-01-01/audio.mp3');
select public.publish_edition('daily-fr-2020-01-01');
select public.publish_edition('daily-fr-2020-01-01');
do $$
begin
  if (select count(*) from public.edition_catalog) <> 1 then raise exception 'Duplicate publication'; end if;
  begin
    update public.edition_revisions set title='Changed' where id='daily-fr-2020-01-01';
    raise exception 'TEST: published content mutated';
  exception when others then if sqlerrm like 'TEST:%' then raise; end if; end;
  if not public.claim_edition_run('2020-01-01','00000000-0000-0000-0000-000000000001') then raise exception 'First lock failed'; end if;
  if public.claim_edition_run('2020-01-01','00000000-0000-0000-0000-000000000002') then raise exception 'Duplicate producer acquired lock'; end if;
  if not public.reserve_edition_cost('2020-01-01','00000000-0000-0000-0000-000000000001',9,10) then raise exception 'Budget reservation failed'; end if;
  if public.reserve_edition_cost('2020-01-01','00000000-0000-0000-0000-000000000001',2,10) then raise exception 'Budget exceeded'; end if;
  if public.reserve_edition_cost('2020-01-01','00000000-0000-0000-0000-000000000002',1,10) then raise exception 'Wrong producer charged budget'; end if;
end $$;
select public.withdraw_edition('daily-fr-2020-01-01');
do $$ begin if exists(select 1 from public.edition_catalog) then raise exception 'Withdrawal did not hide edition'; end if; end $$;
select public.publish_edition('daily-fr-2020-01-01');
do $$ begin if not exists(select 1 from public.edition_catalog) then raise exception 'Rollback did not restore edition'; end if; end $$;
rollback;
