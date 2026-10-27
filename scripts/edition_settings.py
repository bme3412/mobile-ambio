"""Shared, validated edition production settings for synthesis and mixing."""
import json
import os
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
SETTINGS = json.loads(Path(os.environ.get('AMBIO_EDITION_SETTINGS', ROOT / 'scripts/edition-settings.json')).read_text())

def settings_for(edition):
    config = SETTINGS[edition]
    turns = json.loads((ROOT / config['dataDir'] / 'editorial.json').read_text())['turns']
    boundaries = config['batchBoundaries']
    if boundaries != sorted(set(boundaries)) or boundaries[0] != 0 or boundaries[-1] >= len(turns):
        raise ValueError('Invalid synthesis boundaries.')
    transitions = config['transitions']
    indices = [item['segmentIndex'] for item in transitions]
    if indices != sorted(set(indices)) or any(i not in boundaries or i == 0 for i in indices):
        raise ValueError('Transitions must coincide with synthesis boundaries.')
    if any(item['durationMs'] <= 0 for item in transitions):
        raise ValueError('Transition duration must be positive.')
    return config
