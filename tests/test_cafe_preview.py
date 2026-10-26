import copy
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_cafe_preview import shift_timing, BODY


class CafePreviewTests(unittest.TestCase):
    def test_shifts_every_speech_boundary_without_mutating_source(self):
        path = Path(__file__).resolve().parents[1] / 'experiments/eleven-v4/B-timing.json'
        source = json.loads(path.read_text())
        before = copy.deepcopy(source)
        shifted = shift_timing(source)
        self.assertEqual(source, before)
        self.assertEqual(shifted['durationMs'], source['durationMs'] + 3000)
        self.assertEqual(len(shifted['segments']), 4)
        for old, new in zip(source['segments'], shifted['segments']):
            for field in ('startMs', 'endMs'):
                self.assertEqual(new[field], old[field] + 3000)
            self.assertEqual(len(old['words']), len(new['words']))
            for a, b in zip(old['words'], new['words']):
                self.assertEqual(b['startMs'], a['startMs'] + 3000)
                self.assertEqual(b['endMs'], a['endMs'] + 3000)

    def test_request_is_one_short_nonlooping_cue(self):
        self.assertEqual(BODY['duration_seconds'], 8)
        self.assertFalse(BODY['loop'])


if __name__ == '__main__':
    unittest.main()
