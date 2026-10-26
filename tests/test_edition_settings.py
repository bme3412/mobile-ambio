import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from edition_settings import ROOT, SETTINGS, settings_for
from build_cafe_episode import arrange_timing
from build_elevenlabs_v4 import batches

class EditionProductionTests(unittest.TestCase):
    def test_boundaries_requests_and_dated_assets(self):
        for edition in SETTINGS:
            config = settings_for(edition)
            turns = json.loads((ROOT / config['dataDir'] / 'editorial.json').read_text())['turns']
            groups = batches(turns, tuple(config['batchBoundaries']))
            self.assertEqual([turn for group in groups for turn in group], turns)
            for group in groups:
                self.assertLess(sum(len(t[1]) for t in group), 2000)
            for cue in config['transitions']:
                self.assertTrue((ROOT / cue['cue']).exists())

    def test_october26_timeline_and_mixed_cues(self):
        config = settings_for('2026-10-26')
        dry = json.loads((ROOT / config['workDir'] / 'full-dry-timing.json').read_text())
        mixed = json.loads((ROOT / config['dataDir'] / 'audio-timing.json').read_text())
        self.assertEqual(arrange_timing(dry, config=config), mixed)
        self.assertEqual(mixed['durationMs'] - dry['durationMs'], 10000)
        self.assertNotEqual(config['transitions'][0]['cue'], config['transitions'][1]['cue'])
        for index, (a, b) in enumerate(zip(dry['segments'], mixed['segments'])):
            offset = 3000 + 1500 * (index >= 10) + 1500 * (index >= 18)
            for x, y in zip(a['words'], b['words']):
                self.assertEqual(y['startMs'] - x['startMs'], offset)
                self.assertEqual(y['endMs'] - x['endMs'], offset)
                for gap in mixed['musicOnlyRanges']:
                    self.assertTrue(y['endMs'] <= gap['startMs'] or y['startMs'] >= gap['endMs'])

if __name__ == '__main__': unittest.main()
