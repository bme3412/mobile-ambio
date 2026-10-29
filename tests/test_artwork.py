import unittest, os, base64
from unittest.mock import patch
from scripts.daily.artwork import generate_artwork
class Client:
    def call(self,url,headers,body,cost):
        self.body,self.cost=body,cost
        return {'data':[{'b64_json':base64.b64encode(b'\xff\xd8\xfftest').decode()}]}
class ArtworkTests(unittest.TestCase):
    @patch.dict(os.environ, {'OPENAI_API_KEY':'test'})
    def test_cover_uses_stories_and_budgeted_private_payload(self):
        client=Client()
        result=generate_artwork(client,'2026-10-28',{'stories':[{'title':'Bat research','description':'Origins'}]})
        self.assertIn('Bat research',client.body['prompt'])
        self.assertEqual(client.body['output_format'],'jpeg')
        self.assertGreater(client.cost,0)
        self.assertTrue(result['dataUri'].startswith('data:image/jpeg;base64,'))
    @patch.dict(os.environ, {'OPENAI_API_KEY':'test'})
    def test_bad_image_rejected(self):
        client=Client();client.call=lambda *a:{'data':[{'b64_json':'AAAA'}]}
        with self.assertRaises(ValueError):generate_artwork(client,'2026-10-28',{'stories':[]})
