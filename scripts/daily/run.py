"""python3 -m scripts.daily.run --scheduled | --date YYYY-MM-DD [--revision N]."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid
from .core import schedule, identity, production_settings, json_bytes, PaidClient, required_rate
from .storage import Storage
from .providers import research, write_and_review
ROOT=Path(__file__).resolve().parents[2]

class Checkpoint(dict):
    def __init__(self,storage,key):
        self.storage,self.key=storage,key
        super().__init__(json.loads(storage.get('edition-work',key) or '{}'))
    def save(self): self.storage.put('edition-work',self.key,json_bytes(self))

def validate_bundle(path):
    subprocess.run(['node',str(ROOT/'scripts/validate-edition.cjs'),str(path)],check=True)

def upload(storage,bundle,audio):
    raw=json_bytes(bundle)
    storage.put('editions',bundle['audio']['path'],audio,'audio/mpeg',immutable=True)
    storage.put('editions',bundle['id']+'/bundle.json',raw,immutable=True)
    storage.upsert('edition_revisions',{'id':bundle['id'],'edition_date':bundle['date'],'revision':bundle['revision'],
        'title':bundle['editorial']['title'],'bundle_path':bundle['id']+'/bundle.json','bundle_sha256':hashlib.sha256(raw).hexdigest(),
        'audio_path':bundle['audio']['path'],'verified_at':bundle['verifiedAt']})

def run(args):
    today,allowed,due=schedule()
    if args.scheduled and not allowed:
        print('Outside production window; no work.'); return
    date=args.date or today
    if args.scheduled and date!=today: raise ValueError('Scheduled work must target today')
    id=identity(date,args.revision)
    storage=Storage(); owner=str(uuid.uuid4())
    if not storage.rpc('claim_edition_run',p_date=date,p_owner=owner):
        print('Another producer owns this date.'); return
    checkpoint=Checkpoint(storage,f'{id}/checkpoint.json')
    work=ROOT/'.edition-work'/id; work.mkdir(parents=True,exist_ok=True)
    def status(stage,state='running',error=None):
        storage.request(f'/rest/v1/edition_runs?run_date=eq.{date}&owner=eq.{owner}',{'stage':stage,'status':state,'updated_at':dt.datetime.now(dt.timezone.utc).isoformat(),'details':{'editionId':id,'error':error}},method='PATCH')
        print(f'{id}: {stage} ({state})',flush=True)
    def still_allowed():
        if args.scheduled and (schedule()[0]!=date or not schedule()[1]): raise RuntimeError('Automatic production window ended')
    try:
        existing=storage.rows(f'edition_revisions?id=eq.{id}&select=status')
        if existing and existing[0]['status']=='published': print('Already published.'); return
        if existing and existing[0]['status']=='withdrawn': raise ValueError('Withdrawn edition requires explicit rollback or a new revision')
        if not checkpoint.get('uploaded'):
            client=PaidClient(storage,date,owner,float(os.environ.get('EDITION_DAILY_BUDGET_USD','10')),still_allowed)
            still_allowed(); status('research')
            if 'sources' not in checkpoint:
                checkpoint['sources']=research(client,date); checkpoint.save()
            if 'recent' not in checkpoint:
                checkpoint['recent']=storage.rows('edition_revisions?status=eq.published&select=id,title,bundle_path&order=edition_date.desc&limit=14')
                for entry in checkpoint['recent']:
                    b=json.loads(storage.get('editions',entry.pop('bundle_path')))
                    entry['stories']=b['editorial']['stories']
                checkpoint.save()
            still_allowed(); status('write-and-review')
            example=json.loads((ROOT/'scripts/daily/example.json').read_text())
            draft,review=write_and_review(client,date,checkpoint['sources'],checkpoint['recent'],example,checkpoint)
            for name,value in [('editorial',draft['editorial']),('phrases',draft['pairs']),('dictionary',draft['definitions']),('vocabulary',draft['vocabulary'])]:
                (work/f'{name}.json').write_bytes(json_bytes(value))
            config=work/'settings.json';config.write_bytes(json_bytes(production_settings(date,draft['editorial'],work)))
            os.environ['AMBIO_EDITION_SETTINGS']=str(config)
            sys.path.insert(0,str(ROOT/'scripts'))
            import build_elevenlabs_v4 as speech
            import build_cafe_episode as mix
            # Each paid chunk is budgeted and durably cached before the mixer runs.
            original=speech.request_json
            def request(url,key,body=None):
                if body is None: return original(url,key,body)
                still_allowed()
                cost=sum(len(x['text']) for x in body['inputs'])*required_rate('ELEVENLABS_USD_PER_1000_CHARS')/1000
                return client.call(url,{'xi-api-key':key},body,cost)
            speech.request_json=request
            still_allowed();status('speech');sys.argv=['build_elevenlabs_v4','--edition',date];speech.main()
            still_allowed();status('mix');sys.argv=['build_cafe_episode','--edition',date];mix.main()
            audio=(work/f'edition-{date}-cafe.mp3').read_bytes()
            bundle={**draft,'schemaVersion':1,'id':id,'date':date,'revision':args.revision,
                    'verifiedAt':checkpoint.setdefault('verifiedAt',dt.datetime.now(dt.timezone.utc).isoformat()),
                    'timing':json.loads((work/'audio-timing.json').read_text()),
                    'audio':{'path':id+'/audio.mp3','sha256':hashlib.sha256(audio).hexdigest(),'bytes':len(audio)}}
            checkpoint.save()
            path=work/'bundle.json';path.write_bytes(json_bytes(bundle));validate_bundle(path)
            still_allowed()
            if not storage.rpc('claim_edition_run',p_date=date,p_owner=owner): raise RuntimeError('Lost production lease')
            status('upload');upload(storage,bundle,audio)
            checkpoint['uploaded']=True;checkpoint.save()
        still_allowed()
        if date<today or (date==today and schedule()[2]):
            status('publish');storage.rpc('publish_edition',p_id=id,p_backfill=False);status('complete','published')
        else: status('awaiting-publication','ready')
    except Exception as error:
        status('failed','failed',str(error)[:600]);raise
    finally:
        storage.request(f'/rest/v1/edition_runs?run_date=eq.{date}&owner=eq.{owner}',{'lease_until':None,'owner':None},method='PATCH')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scheduled',action='store_true');parser.add_argument('--date');parser.add_argument('--revision',type=int,default=1)
    try: run(parser.parse_args())
    except Exception as error: raise SystemExit(f'Daily edition failed: {error}') from None
