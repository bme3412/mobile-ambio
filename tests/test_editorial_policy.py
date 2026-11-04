import copy
import datetime as dt
import unittest
from unittest.mock import patch, MagicMock
from scripts.daily.editorial_policy import LANES, LABELS, POLICY, QUERIES
from scripts.daily.providers import validate_brief, research, WRITE, REVIEW

class EditorialPolicyTests(unittest.TestCase):
    def fixture(self):
        sources=[]; stories=[]
        for i,lane in enumerate(LANES):
            url=f'https://news.example/{i}'; evidence='Reported November 3, 2026: a substantive new development.'
            sources.append({'url':url,'evidence':evidence})
            fact={'url':url,'evidence':evidence,'claim':'A supported development'}
            stories.append({'lane':lane,'developmentDate':'2026-11-03','dateEvidence':fact,'novelty':'A new result absent from recent editions','facts':[dict(fact) for _ in range(3)]})
        return {'stories':stories},sources
    def test_exact_order_and_missing_lane(self):
        brief,sources=self.fixture();validate_brief(brief,sources,'2026-11-03',1)
        brief['stories'].reverse()
        with self.assertRaisesRegex(ValueError,'lanes'):validate_brief(brief,sources,'2026-11-03')
        brief['stories']=[]
        with self.assertRaises(ValueError):validate_brief(brief,sources,'2026-11-03')
    def test_freshness_fallback_and_future_rejection(self):
        brief,sources=self.fixture();brief['stories'][0]['developmentDate']='2026-11-01'
        with self.assertRaisesRegex(ValueError,'freshness'):validate_brief(brief,sources,'2026-11-03',1)
        validate_brief(brief,sources,'2026-11-03',3)
        for date in ['2026-10-31','2026-11-04']:
            brief['stories'][0]['developmentDate']=date
            with self.assertRaisesRegex(ValueError,'freshness'):validate_brief(brief,sources,'2026-11-03',3)
    def test_evidence_and_distinct_articles(self):
        brief,sources=self.fixture();brief['stories'][0]['dateEvidence']={'url':sources[0]['url'],'evidence':'invented'}
        with self.assertRaisesRegex(ValueError,'Unsupported'):validate_brief(brief,sources,'2026-11-03')
        brief,sources=self.fixture();brief['stories'][1]['facts']=copy.deepcopy(brief['stories'][0]['facts'])
        with self.assertRaisesRegex(ValueError,'distinct'):validate_brief(brief,sources,'2026-11-03')
    def test_retrieval_ranges_and_global_ai(self):
        client=MagicMock();client.call.return_value={'data':{'web':[{'url':f'https://news.example/{i}','markdown':'Article evidence '*80} for i in range(3)]}}
        with patch.dict('os.environ',{'FIRECRAWL_API_KEY':'test','FIRECRAWL_SEARCH_MAX_USD':'.01'}): research(client,'2026-11-03',days=3)
        bodies=[call.args[2] for call in client.call.call_args_list]
        self.assertEqual(len(bodies),4)
        self.assertTrue(all('3 novembre 2026' in b['query'] and '1 novembre 2026' in b['query'] for b in bodies))
        self.assertTrue(all(b['tbs']=='cdr:1,cd_min:11/01/2026,cd_max:11/03/2026' for b in bodies))
        self.assertTrue(any('AI news' in b['query'] for b in bodies))
    def test_shared_selection_and_review_rules(self):
        for prompt in [WRITE,REVIEW]:
            self.assertIn(POLICY,prompt)
            self.assertIn('no European connection required',prompt)
            self.assertIn('Reject unchanged repeats',prompt)
            self.assertIn('tennis, rugby, cycling, F1',prompt)
            self.assertIn('No repetitive summaries',prompt)
        self.assertNotIn('Create length through clear paraphrase',WRITE)
