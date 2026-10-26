import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_cafe_episode import arrange_timing, ROOT

class CafeEpisodeTests(unittest.TestCase):
    def test_every_word_shifts_with_insertions_and_no_speech_is_lost(self):
        source = json.loads((ROOT / 'experiments/cafe-signature/full-dry-timing.json').read_text())
        mixed = arrange_timing(source)
        self.assertEqual(mixed['durationMs'], source['durationMs'] + 10000)
        self.assertEqual(len(mixed['segments']), len(source['segments']))
        for i, (a, b) in enumerate(zip(source['segments'], mixed['segments'])):
            offset = 3000 + (1500 if i >= 12 else 0) + (1500 if i >= 28 else 0)
            self.assertEqual(b['startMs'] - a['startMs'], offset)
            self.assertEqual(b['endMs'] - a['endMs'], offset)
            self.assertEqual(len(a['words']), len(b['words']))
            for x, y in zip(a['words'], b['words']):
                self.assertEqual(y['startMs'] - x['startMs'], offset)
                self.assertEqual(y['endMs'] - x['endMs'], offset)
                for cue in mixed['musicOnlyRanges']:
                    self.assertTrue(y['endMs'] <= cue['startMs'] or y['startMs'] >= cue['endMs'])

if __name__ == '__main__':
    unittest.main()
