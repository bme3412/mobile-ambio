"""Offline checks for alignment failures before experiment output is written."""
import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('comparison', Path(__file__).resolve().parents[1] / 'scripts/compare_elevenlabs_v4.py')
comparison = importlib.util.module_from_spec(spec)
spec.loader.exec_module(comparison)


class AlignmentTests(unittest.TestCase):
    def setUp(self):
        self.inputs = [{'text': 'Salut.', 'voice_id': 'lucie'}, {'text': 'Oui.', 'voice_id': 'loic'}]
        self.turns = [('Camille', 'Salut.', 'Hello.'), ('Louis', 'Oui.', 'Yes.')]
        self.result = {
            'alignment': {'characters': list('Salut. Oui.'),
                          'character_start_times_seconds': [i / 10 for i in range(11)],
                          'character_end_times_seconds': [(i + 1) / 10 for i in range(11)]},
            'voice_segments': [
                {'voice_id': 'lucie', 'dialogue_input_index': 0, 'start_time_seconds': 0,
                 'end_time_seconds': .6, 'character_start_index': 0, 'character_end_index': 6},
                {'voice_id': 'loic', 'dialogue_input_index': 1, 'start_time_seconds': .7,
                 'end_time_seconds': 1.1, 'character_start_index': 7, 'character_end_index': 11}]}

    def convert(self, result):
        return comparison.align_turns(result, self.inputs, self.turns, 1.2)

    def test_preserves_word_and_speaker_boundaries(self):
        result = self.convert(self.result)
        self.assertEqual(result['segments'][1]['words'], [{'startMs': 700, 'endMs': 1100}])
        self.assertEqual(result['model'], 'eleven_v4')

    def test_rejects_missing_alignment_and_script_changes(self):
        for mutate in [lambda r: r.pop('alignment'),
                       lambda r: r['alignment']['characters'].__setitem__(0, 'X')]:
            result = copy.deepcopy(self.result)
            mutate(result)
            with self.assertRaises(ValueError):
                self.convert(result)

    def test_rejects_wrong_voice_and_overlap(self):
        for key, value in [('voice_id', 'wrong-voice'), ('start_time_seconds', .2)]:
            result = copy.deepcopy(self.result)
            result['voice_segments'][1][key] = value
            with self.assertRaises(ValueError):
                self.convert(result)

    def test_rejects_invalid_timing_and_incomplete_mapping(self):
        result = copy.deepcopy(self.result)
        result['alignment']['character_end_times_seconds'][0] = 10
        with self.assertRaises(ValueError):
            self.convert(result)
        result = copy.deepcopy(self.result)
        result['voice_segments'][1]['character_end_index'] = 9
        with self.assertRaises(ValueError):
            self.convert(result)


if __name__ == '__main__':
    unittest.main()

class FullEpisodeBatchTests(unittest.TestCase):
    def test_batches_preserve_all_turns_and_approved_opening(self):
        import sys
        import json
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
        from build_elevenlabs_v4 import batches
        turns = json.loads((comparison.ROOT / 'src/data/editorial.json').read_text())['turns']
        groups = batches(turns)
        self.assertEqual(groups[0], turns[:4])
        self.assertEqual([turn for group in groups for turn in group], turns)
        for group in groups:
            self.assertLessEqual(sum(len(turn[1]) for turn in group), 2000)
