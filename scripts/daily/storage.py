"""Server-only Supabase REST client. Errors never contain secrets/provider bodies."""
import hashlib
import json
import os
import time
import uuid
import urllib.error
import urllib.request
from urllib.parse import quote

class Storage:
    def __init__(self):
        self.url = os.environ['SUPABASE_URL'].rstrip('/')
        self.key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
        if not self.url.startswith('https://'):
            raise ValueError('SUPABASE_URL must use HTTPS')

    def request(self, path, body=None, method=None, raw=False, missing=False, headers=None):
        data = body if isinstance(body, bytes) else json.dumps(body).encode() if body is not None else None
        for attempt in range(4):
            req = urllib.request.Request(self.url+path, data=data, method=method,
                headers={'apikey':self.key,'Authorization':'Bearer '+self.key,
                         'Content-Type':'application/json', **(headers or {})})
            try:
                with urllib.request.urlopen(req,timeout=90) as response:
                    result=response.read()
                    return result if raw else json.loads(result) if result else None
            except urllib.error.HTTPError as e:
                if missing and e.code == 404: return None
                # Storage can return HTTP 400 with a structured missing-object code.
                if missing and e.code == 400:
                    try:
                        detail = json.loads(e.read())
                    except (ValueError, UnicodeDecodeError):
                        detail = {}
                    if detail.get('code') == 'NoSuchKey': return None
                if e.code not in (408,429,500,502,503,504) or attempt==3:
                    raise RuntimeError(f'Storage HTTP {e.code}') from None
            except (urllib.error.URLError, TimeoutError):
                if attempt==3: raise RuntimeError('Storage unavailable') from None
            time.sleep(2**attempt)

    def rpc(self, name, **kwargs):
        return self.request('/rest/v1/rpc/'+name,kwargs)

    def get(self, bucket, path):
        # Mutable checkpoints must not read a CDN-cached prior version after upload.
        return self.request(f'/storage/v1/object/authenticated/{bucket}/{quote(path,safe="/")}?version={uuid.uuid4().hex}',raw=True,missing=True,
                            headers={'Cache-Control':'no-cache'})

    def put(self,bucket,path,data,content_type='application/json',immutable=False):
        old=self.get(bucket,path) if immutable else None
        if old is not None:
            if old != data: raise ValueError('Immutable object already exists with different content')
            return
        self.request(f'/storage/v1/object/{bucket}/{quote(path,safe="/")}',data,method='POST',raw=True,
                     headers={'Content-Type':content_type,'x-upsert':'false' if immutable else 'true'})
        if hashlib.sha256(self.get(bucket,path) or b'').digest()!=hashlib.sha256(data).digest():
            raise ValueError('Uploaded asset checksum mismatch')

    def rows(self,query):
        return self.request('/rest/v1/'+query)

    def upsert(self,table,row):
        return self.request('/rest/v1/'+table,row,headers={'Prefer':'resolution=merge-duplicates'})
