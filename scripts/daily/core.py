import datetime as dt
import hashlib
import json
import math
import os
import re
import time
import uuid
from urllib.parse import urlparse
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo
EASTERN=ZoneInfo('America/New_York')

def schedule(now=None):
    local=(now or dt.datetime.now(dt.timezone.utc)).astimezone(EASTERN)
    return local.date().isoformat(), 4 <= local.hour < 12, local.hour >= 7

def identity(date,revision):
    dt.date.fromisoformat(date)
    if revision < 1: raise ValueError('Revision must be positive')
    return f'daily-fr-{date}'+('' if revision==1 else f'@r{revision}')

def production_settings(date,editorial,work):
    boundaries=sorted({0,*[s['segmentIndex'] for s in editorial['stories']]})
    return {date:{'dataDir':str(work),'workDir':str(work),'audioDir':str(work),
        'batchBoundaries':boundaries,'introMs':3000,'introBed':'experiments/cafe-signature/music-bed.wav',
        'outroMs':4000,'outroCue':'experiments/cafe-signature/cafe-cue.mp3',
        'transitions':[{'segmentIndex':i,'durationMs':1500,'cue':'experiments/cafe-signature/cafe-cue.mp3'} for i in boundaries[2:]]}}

def align_featured(d):
    """Derive word offsets from the text; models must not count transcript tokens."""
    featured=d['featured']; turns=d['editorial']['turns']
    norm=lambda s: re.sub('[^a-zàâéèêëîïôùûüç]', '', s.lower())
    target=norm(featured['text']); count=len(featured['text'].split())
    preferred=featured.get('segmentIndex')
    indices=([preferred] if isinstance(preferred,int) and 0<=preferred<len(turns) else [])
    indices += [i for i in range(len(turns)) if i not in indices]
    for index in indices:
        words=turns[index][1].split(' ')
        for start in range(len(words)-count+1):
            if target and norm(' '.join(words[start:start+count]))==target:
                featured.update(segmentIndex=index,startWord=start,wordCount=count)
                return
    raise ValueError('Featured expression is absent from transcript')

def validate_draft(d):
    if not isinstance(d,dict): raise ValueError('Draft must be an object')
    for key in ('editorial','definitions','vocabulary','featured'):
        if not isinstance(d.get(key),dict): raise ValueError(key+' must be an object, not an array')
    if not isinstance(d.get('pairs'),list): raise ValueError('pairs must be an array')
    e=d['editorial']; turns=e['turns']
    if not all(isinstance(e.get(k),str) and e[k].strip() for k in ('title','subtitle','edition','speakingPrompt')): raise ValueError('Missing editorial fields')
    if not all(all(isinstance(s.get(k),str) and s[k].strip() for k in ('id','category','title','description')) for s in e['stories']): raise ValueError('Incomplete story metadata')
    if len({s['id'] for s in e['stories']}) != 3: raise ValueError('Duplicate story IDs')
    if not all(all(isinstance(s.get(k),str) and s[k].strip() for k in ('title','publisher','url')) and s['url'].startswith('https://') for s in e['sources']): raise ValueError('Incomplete sources')
    if not all(isinstance(d['featured'].get(k),str) and d['featured'][k].strip() for k in ('id','text','meaning','example')): raise ValueError('Incomplete featured expression')

    if len(e['stories'])!=3 or not 8<=len(turns)<=100: raise ValueError('Expected three stories and 8–100 turns')
    if len(d['pairs'])!=len(turns): raise ValueError('Missing phrase translations')
    missing=set()
    for turn,pairs in zip(turns,d['pairs']):
        if len(turn)!=3 or turn[0] not in ('Camille','Louis') or not all(isinstance(x,str) and x.strip() for x in turn): raise ValueError('Invalid turn')
        if ' '.join(p[0] for p in pairs)!=turn[1] or not all(len(p)==2 and p[1].strip() for p in pairs): raise ValueError('Phrase coverage mismatch')
        if any(not w for w in turn[1].split(' ')): raise ValueError('Use single spaces')
        for word in turn[1].split(' '):
            key=re.sub('[^a-zàâéèêëîïôùûüç]', '', word.lower())
            if key and not (d['definitions'].get(key) or d['vocabulary'].get(key,{}).get('meaning')): missing.add(key)
    if missing: raise ValueError('Missing word definitions: '+', '.join(sorted(missing)))
    boundaries=[s['segmentIndex'] for s in e['stories']]
    if boundaries!=sorted(set(boundaries)) or not all(0<=i<len(turns) for i in boundaries): raise ValueError('Invalid story boundaries')
    f=d['featured']; words=turns[f['segmentIndex']][1].split(' ')[f['startWord']:f['startWord']+f['wordCount']]
    norm=lambda s: re.sub('[^a-zàâéèêëîïôùûüç]', '', s.lower())
    if not words or norm(' '.join(words))!=norm(f['text']): raise ValueError('Featured expression mismatch')
    if len(e['sources'])<3: raise ValueError('Missing sources')
    if not all(v.get(k) for v in d['vocabulary'].values() for k in ('meaning','pronunciation','kind','example','translation')): raise ValueError('Incomplete vocabulary')

def json_bytes(value): return (json.dumps(value,ensure_ascii=False,sort_keys=True,indent=2)+'\n').encode()

class PaidClient:
    def __init__(self,storage,date,owner,limit=10,allow=lambda: None):
        self.storage,self.date,self.owner,self.limit=storage,date,owner,limit
        self.allow=allow
    def call(self,url,headers,body,cost):
        if not math.isfinite(cost) or cost<=0: raise ValueError('Positive provider cost reservation required')
        digest=hashlib.sha256(json_bytes({'url':url,'body':body})).hexdigest()
        path=f'{self.date}/requests/{digest}.json'
        cached=self.storage.get('edition-work',path)
        if cached: return json.loads(cached)
        for attempt in range(4):
            self.allow()
            if not self.storage.rpc('claim_edition_run',p_date=self.date,p_owner=self.owner): raise RuntimeError('Lost production lease')
            if not self.storage.rpc('reserve_edition_cost',p_date=self.date,p_owner=self.owner,p_amount=cost,p_limit=self.limit): raise RuntimeError('Daily budget exhausted')
            event={'id':str(uuid.uuid4()),'run_date':self.date,'provider':urlparse(url).hostname,'request_hash':digest,'reserved_usd':cost,'status':'reserved'}
            self.storage.upsert('edition_cost_events',event)
            request=urllib.request.Request(url,data=json_bytes(body),headers={'Content-Type':'application/json',**headers})
            try:
                with urllib.request.urlopen(request,timeout=180) as response: result=json.load(response)
                self.storage.put('edition-work',path,json_bytes(result))
                event.update(status='completed',usage=result.get('usage') or {'characters':sum(len(x['text']) for x in body.get('inputs',[])),'creditsUsed':result.get('creditsUsed')})
                self.storage.upsert('edition_cost_events',event)
                return result
            except urllib.error.HTTPError as e:
                if e.code not in (408,429,500,502,503,504) or attempt==3: raise RuntimeError(f'Provider HTTP {e.code}') from None
            except (urllib.error.URLError,TimeoutError):
                if attempt==3: raise RuntimeError('Provider unavailable') from None
            time.sleep(2**attempt)

def required_rate(name):
    value=float(os.environ[name])
    if not math.isfinite(value) or value<=0: raise ValueError('Invalid rate '+name)
    return value
