import copy
import datetime as dt
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from scripts.daily.core import schedule, identity, production_settings, PaidClient
from scripts.daily.providers import write_and_review

class MemoryStorage:
    def __init__(self): self.data={}; self.spent=0; self.calls=[]
    def get(self,b,p):return self.data.get((b,p))
    def put(self,b,p,d,*a,**k):self.data[b,p]=d
    def upsert(self,*args):pass
    def rpc(self,name,**args):
        self.calls.append(name)
        if name=='claim_edition_run':return True
        if self.spent+args['p_amount']>args['p_limit']:return False
        self.spent+=args['p_amount'];return True

class DailyTests(unittest.TestCase):
    def test_dst_window_and_publish_boundary(self):
        for date,offset in [('2026-03-08',4),('2026-11-01',5)]:
            def at(hour):return dt.datetime.fromisoformat(f'{date}T{hour+offset:02}:17:00+00:00')
            self.assertEqual(schedule(at(4)),(date,True,False))
            self.assertEqual(schedule(at(7)),(date,True,True))
            self.assertFalse(schedule(at(12))[1])
            self.assertFalse(schedule(at(3))[1])
    def test_revision_and_dynamic_boundaries(self):
        self.assertEqual(identity('2026-10-27',2),'daily-fr-2026-10-27@r2')
        cfg=production_settings('2026-10-27',{'stories':[{'segmentIndex':2},{'segmentIndex':11},{'segmentIndex':19}]},Path('/tmp/work'))['2026-10-27']
        self.assertEqual(cfg['batchBoundaries'],[0,2,11,19])
        self.assertEqual([x['segmentIndex'] for x in cfg['transitions']],[11,19])
    def test_budget_is_reserved_before_provider_and_cached_calls_are_free(self):
        storage=MemoryStorage();client=PaidClient(storage,'2026-10-27','owner',1)
        with patch('urllib.request.urlopen') as call:
            with self.assertRaisesRegex(RuntimeError,'budget'):client.call('https://api.example',{}, {},2)
            call.assert_not_called()
            call.return_value.__enter__.return_value.read.return_value=b'{"ok":true}'
            self.assertEqual(client.call('https://api.example',{}, {},.5),{'ok':True})
            self.assertEqual(client.call('https://api.example',{}, {},.5),{'ok':True})
            self.assertEqual(call.call_count,1);self.assertEqual(storage.spent,.5)
    def test_transient_failures_have_bounded_retries_and_reserved_cost(self):
        storage=MemoryStorage();client=PaidClient(storage,'2026-10-27','owner',10)
        with patch('urllib.request.urlopen',side_effect=TimeoutError),patch('time.sleep'):
            with self.assertRaisesRegex(RuntimeError,'unavailable'):client.call('https://api.example',{}, {},1)
        self.assertEqual(storage.spent,4)
    def test_editorial_failure_allows_only_one_repair(self):
        class Checkpoint(dict):
            def save(self):pass
        with patch('scripts.daily.providers.generate',return_value={}),patch('scripts.daily.providers.from_wire',side_effect=lambda x:x),patch('scripts.daily.providers.validate_draft',side_effect=ValueError('bad translation')) as validate:
            with self.assertRaisesRegex(ValueError,'one repair'):write_and_review(None,'2026-10-27',[],[],{},Checkpoint())
            self.assertEqual(validate.call_count,2)

if __name__=='__main__':unittest.main()

class PipelineResumeTests(unittest.TestCase):
    def run_at(self,due):
        from scripts.daily.run import run
        from argparse import Namespace
        from unittest.mock import MagicMock
        storage=MagicMock()
        storage.rpc.return_value=True
        storage.get.return_value=b'{"uploaded":true}'
        storage.rows.return_value=[]
        args=Namespace(date='2026-10-27',revision=1,scheduled=True)
        with patch('scripts.daily.run.Storage',return_value=storage),patch('scripts.daily.run.schedule',return_value=('2026-10-27',True,due)):
            run(args)
        return storage
    def test_uploaded_checkpoint_waits_until_seven_without_regeneration(self):
        storage=self.run_at(False)
        self.assertFalse(any(c.args[0]=='publish_edition' for c in storage.rpc.call_args_list))
        self.assertTrue(any(c.kwargs.get('method')=='PATCH' and c.args[1].get('status')=='ready' for c in storage.request.call_args_list))
    def test_uploaded_checkpoint_publishes_after_seven(self):
        storage=self.run_at(True)
        self.assertTrue(any(c.args[0]=='publish_edition' for c in storage.rpc.call_args_list))
    def test_no_automatic_work_after_noon(self):
        from scripts.daily.run import run
        from argparse import Namespace
        with patch('scripts.daily.run.schedule',return_value=('2026-10-27',False,True)),patch('scripts.daily.run.Storage') as storage:
            run(Namespace(date=None,revision=1,scheduled=True));storage.assert_not_called()

class StorageErrorTests(unittest.TestCase):
    def test_missing_object_400_is_distinct_from_other_bad_requests(self):
        import io, urllib.error
        from scripts.daily.storage import Storage
        for code,missing in [('NoSuchKey',True),('InvalidKey',False)]:
            error=urllib.error.HTTPError('https://example.test',400,'Bad Request',{},io.BytesIO(json.dumps({'code':code}).encode()))
            with patch.dict('os.environ',{'SUPABASE_URL':'https://example.test','SUPABASE_SERVICE_ROLE_KEY':'test'}),patch('urllib.request.urlopen',side_effect=error):
                if missing:self.assertIsNone(Storage().get('editions','missing'))
                else:
                    with self.assertRaisesRegex(RuntimeError,'Storage HTTP 400'):Storage().get('editions','missing')

class DraftShapeTests(unittest.TestCase):
    def test_wrong_featured_shape_enters_editorial_repair(self):
        from scripts.daily.core import validate_draft
        d=json.loads(Path('scripts/daily/example.json').read_text())
        d['featured']=[d['featured']]
        with self.assertRaisesRegex(ValueError,'featured must be an object'):validate_draft(d)
    def test_json_mode_keyword_is_in_input_not_only_instructions(self):
        from scripts.daily.providers import generate
        from unittest.mock import Mock
        client=Mock();client.call.return_value={'status':'completed','output':[{'content':[{'type':'output_text','text':'{}'}]}]}
        with patch.dict('os.environ',{'EDITION_OPENAI_MODEL':'test','OPENAI_API_KEY':'test','OPENAI_INPUT_USD_PER_MILLION':'1','OPENAI_OUTPUT_USD_PER_MILLION':'1'}):generate(client,'Write a draft',{'date':'2026-10-27'})
        self.assertIn('JSON',client.call.call_args.args[2]['input'])

class ProviderSchemaTests(unittest.TestCase):
    def test_word_dictionary_round_trip_and_duplicate_rejection(self):
        from scripts.daily.schema import to_wire,from_wire
        d=json.loads(Path('scripts/daily/example.json').read_text())
        wire=to_wire(d)
        self.assertEqual(from_wire(wire),d)
        wire['definitions'].append(wire['definitions'][0])
        with self.assertRaisesRegex(ValueError,'Duplicate'):from_wire(wire)
