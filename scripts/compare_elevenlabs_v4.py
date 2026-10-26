"""Generate a cached, isolated four-turn v2/v4 comparison. Never publishes app assets."""
import argparse
import base64
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import tempfile
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-dialogue/with-timestamps?output_format=mp3_44100_128'


def read_env(path):
    env = dict(os.environ)
    if path:
        for line in path.read_text().splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                key, value = line.split('=', 1)
                env[key.strip()] = value.strip().strip('\"\'')
    return env


def request_json(url, key, body=None):
    request = urllib.request.Request(url, data=json.dumps(body).encode() if body else None,
                                    headers={'xi-api-key': key, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # Never log request headers, credentials, or arbitrary provider response bodies.
        raise ValueError(f'ElevenLabs HTTP {error.code}; no app assets changed.') from None
    except urllib.error.URLError:
        raise ValueError('Cannot reach ElevenLabs; cached work retained.') from None


def align_turns(result, inputs, turns, duration):
    alignment = result.get('alignment')
    if not alignment or not result.get('voice_segments'):
        raise ValueError('Missing original-text alignment or speaker mappings.')
    chars = alignment['characters']
    starts = alignment['character_start_times_seconds']
    ends = alignment['character_end_times_seconds']
    if not chars or len(chars) != len(starts) or len(chars) != len(ends) or any(len(c) != 1 for c in chars):
        raise ValueError('Invalid character alignment arrays.')
    previous = 0
    for start, end in zip(starts, ends):
        if not all(isinstance(t, (int, float)) and math.isfinite(t) for t in (start, end)):
            raise ValueError('Invalid timestamp.')
        if start < previous or end < start or end > duration + 0.1:
            raise ValueError('Non-monotonic or out-of-range timestamps.')
        previous = start
    text = ''.join(chars)
    cursor = 0
    segments = []
    previous_end = 0
    for index, (entry, turn) in enumerate(zip(inputs, turns)):
        original = entry['text']
        while cursor < len(text) and text[cursor].isspace():
            cursor += 1
        if text[cursor:cursor + len(original)] != original:
            raise ValueError(f'Original script mismatch in turn {index + 1}.')
        end_cursor = cursor + len(original)
        voices = [v for v in result['voice_segments'] if v['dialogue_input_index'] == index]
        if not voices or any(v['voice_id'] != entry['voice_id'] for v in voices):
            raise ValueError(f'Wrong or missing voice in turn {index + 1}.')
        coverage = set()
        for voice in voices:
            a, b = voice['character_start_index'], voice['character_end_index']
            if not 0 <= a <= b <= len(chars):
                raise ValueError('Invalid speaker character range.')
            coverage.update(range(a, b))
            if not 0 <= voice['start_time_seconds'] <= voice['end_time_seconds'] <= duration + 0.1:
                raise ValueError('Invalid speaker time range.')
        if any(i not in coverage for i in range(cursor, end_cursor) if not text[i].isspace()):
            raise ValueError(f'Incomplete speaker mapping in turn {index + 1}.')
        tokens = [{'startMs': round(starts[cursor + m.start()] * 1000),
                   'endMs': round(ends[cursor + m.end() - 1] * 1000)}
                  for m in re.finditer(r'\S+', original)]
        start = min(v['start_time_seconds'] for v in voices)
        end = max(v['end_time_seconds'] for v in voices)
        if start < previous_end - 0.03:
            raise ValueError('Overlapping presenter turns; sample requires review.')
        segments.append({'startMs': round(start * 1000), 'endMs': round(end * 1000), 'words': tokens})
        previous_end = end
        cursor = end_cursor
    if text[cursor:].strip() or any(v['dialogue_input_index'] not in range(len(inputs)) for v in result['voice_segments']):
        raise ValueError('Unexpected extra speech or speaker mapping.')
    return {'durationMs': round(duration * 1000), 'provider': 'elevenlabs', 'model': 'eleven_v4',
            'voices': {'Camille': 'Lucie narration', 'Louis': 'Loïc - Engaging French Storyteller'},
            'segments': segments}


def duration(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                         '-of', 'default=noprint_wrappers=1:nokey=1', str(path)], text=True))


def normalize(source, target, limit=None):
    args = ['ffmpeg', '-v', 'info', '-i', str(source)]
    if limit is not None:
        args += ['-t', str(limit)]
    analysis = subprocess.run(args + ['-af', 'loudnorm=I=-18:TP=-2:LRA=7:print_format=json',
                                      '-f', 'null', '-'], capture_output=True, text=True, check=True)
    measured = json.loads(analysis.stderr[analysis.stderr.rfind('{'):analysis.stderr.rfind('}') + 1])
    settings = ':'.join(f'{name}={measured[field]}' for name, field in [
        ('measured_I', 'input_i'), ('measured_TP', 'input_tp'), ('measured_LRA', 'input_lra'),
        ('measured_thresh', 'input_thresh'), ('offset', 'target_offset')])
    subprocess.run(args + ['-af', f'loudnorm=I=-18:TP=-2:LRA=7:{settings}:linear=true',
                           '-ar', '44100', '-b:a', '128k', '-y', str(target)], capture_output=True, check=True)
    return measured


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', type=Path)
    parser.add_argument('--cached-only', action='store_true', help='Validate and render cached generation without network calls.')
    args = parser.parse_args()
    env = read_env(args.env_file)
    key, female = env.get('ELEVENLABS_API_KEY'), env.get('ELEVENLABS_VOICE_ID')
    male = env.get('ELEVENLABS_MALE_VOICE_ID', 'mgJuPHzoFzHp7TakLEYb')
    if not female or (not key and not args.cached_only):
        raise ValueError('Existing ElevenLabs key and female voice configuration required.')
    editorial = json.loads((ROOT / 'src/data/editorial.json').read_text())
    turns = editorial['turns'][:4]
    inputs = [{'text': text, 'voice_id': female if speaker == 'Camille' else male} for speaker, text, _ in turns]
    count = sum(len(i['text']) for i in inputs)
    if len(turns) != 4 or count > 2000:
        raise ValueError('Expected four turns totaling at most 2,000 characters.')
    body = {'inputs': inputs, 'model_id': 'eleven_v4', 'language_code': 'fr'}
    digest = hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()
    cache = ROOT / '.audio-cache' / 'v4-comparison' / digest
    cache.mkdir(parents=True, exist_ok=True)
    response_path = cache / 'response.json'
    if not args.cached_only:
        models = request_json('https://api.elevenlabs.io/v1/models', key)
        if not any(m['model_id'] == 'eleven_v4' for m in models):
            raise ValueError('Eleven v4 is unavailable to this account.')
        for voice in {female, male}:
            info = request_json(f'https://api.elevenlabs.io/v1/voices/{voice}', key)
            if info.get('voice_id') != voice:
                raise ValueError('Existing voice is unavailable.')
        print('Model and both voice IDs verified.', flush=True)
    if not response_path.exists():
        if args.cached_only:
            raise ValueError('No cached response for this exact request.')
        (cache / 'request.json').write_text(json.dumps(body, indent=2, ensure_ascii=False))
        print(f'Generating four turns, {count} characters.', flush=True)
        response = request_json(ENDPOINT, key, body)
        temporary = cache / 'response.tmp'
        temporary.write_text(json.dumps(response))
        temporary.replace(response_path)
    result = json.loads(response_path.read_text())
    if not result.get('audio_base64'):
        raise ValueError('No audio returned; raw response retained for diagnosis.')
    with tempfile.TemporaryDirectory(prefix='ambio-v4-') as directory:
        work = Path(directory)
        raw = work / 'raw.mp3'
        raw.write_bytes(base64.b64decode(result['audio_base64'], validate=True))
        seconds = duration(raw)
        timings = align_turns(result, inputs, turns, seconds)
        old = json.loads((ROOT / 'src/data/audio-timing.json').read_text())
        if old['model'] != 'eleven_multilingual_v2':
            old = json.loads((ROOT / '.audio-cache/pre-v4-audio-timing.json').read_text())
        a_end = old['segments'][3]['endMs'] / 1000
        a, b = work / 'A-current.mp3', work / 'B-eleven-v4.mp3'
        measures = {'A': normalize(ROOT / 'assets/audio/edition-2026-10-24.mp3', a, a_end),
                    'B': normalize(raw, b)}
        output = ROOT / 'experiments' / 'eleven-v4'
        output.mkdir(parents=True, exist_ok=True)
        for file in (a, b):
            (output / file.name).write_bytes(file.read_bytes())
        (output / 'B-timing.json').write_text(json.dumps(timings, indent=2, ensure_ascii=False) + '\n')
        (output / 'A-timing.json').write_text(json.dumps({**old, 'durationMs': round(a_end * 1000), 'segments': old['segments'][:4]}, indent=2) + '\n')
        (output / 'comparison.json').write_text(json.dumps({'requestHash': digest, 'characters': count,
            'turns': turns, 'durationSeconds': {'A': duration(a), 'B': duration(b)},
            'targetLUFS': -18, 'normalizationMeasurements': measures,
            'rawResponse': str(response_path.relative_to(ROOT)), 'reviewStatus': 'awaiting listening comparison'}, indent=2, ensure_ascii=False) + '\n')
        print(f'Comparison saved to {output}. App audio unchanged.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, subprocess.CalledProcessError) as error:
        raise SystemExit(f'Comparison failed: {error}') from None
