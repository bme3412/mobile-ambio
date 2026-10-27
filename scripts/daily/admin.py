"""Explicit operator commands; use staging credentials until staging review passes."""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
from .storage import Storage
from .run import validate_bundle, upload
from .core import json_bytes

def main():
    p=argparse.ArgumentParser(description=__doc__);sub=p.add_subparsers(dest='command',required=True)
    x=sub.add_parser('import');x.add_argument('directory',type=Path)
    for name in ('publish','unpublish','rollback'):
        x=sub.add_parser(name);x.add_argument('id')
    x=sub.add_parser('review');x.add_argument('date');x.add_argument('--notes',required=True)
    sub.add_parser('check-staging')
    a=p.parse_args();s=Storage()
    if a.command=='import':
        for path in sorted(a.directory.glob('*/bundle.json')):
            validate_bundle(path);b=json.loads(path.read_text());audio=path.with_name('audio.mp3').read_bytes()
            if hashlib.sha256(audio).hexdigest()!=b['audio']['sha256'] or len(audio)!=b['audio']['bytes']:raise ValueError('Audio checksum mismatch')
            existing=s.rows(f'edition_revisions?id=eq.{b["id"]}&select=status')
            if existing and existing[0]['status']=='published':continue
            upload(s,b,audio);s.rpc('publish_edition',p_id=b['id'],p_backfill=True);print('Imported '+b['id'])
    elif a.command in ('publish','rollback'):s.rpc('publish_edition',p_id=a.id,p_backfill=False)
    elif a.command=='unpublish':s.rpc('withdraw_edition',p_id=a.id)
    elif a.command=='review':
        rows=s.rows(f'edition_runs?run_date=eq.{a.date}&status=eq.published')
        if len(rows)!=1:raise ValueError('Only a successfully published staging run can be reviewed')
        details={**rows[0]['details'],'review':{'passed':True,'notes':a.notes,'at':dt.datetime.now(dt.timezone.utc).isoformat()}}
        s.request(f'/rest/v1/edition_runs?run_date=eq.{a.date}',{'details':details},method='PATCH')
    elif a.command=='check-staging':
        rows=s.rows('edition_runs?status=eq.published&order=run_date.desc&limit=3')
        dates=[dt.date.fromisoformat(r['run_date']) for r in rows]
        if len(rows)!=3 or any(not r['details'].get('review',{}).get('passed') for r in rows) or any((dates[i]-dates[i+1]).days!=1 for i in range(2)):raise ValueError('Three consecutive reviewed staging editions are required')
        print('Three consecutive staging reviews passed.')
if __name__=='__main__':
    try:main()
    except Exception as e:raise SystemExit(str(e)) from None
