"""Build the full v4 edition in validated chunks; keep existing v2 audio intact."""
import argparse
import base64
import hashlib
import json
import math
from pathlib import Path
import subprocess
import tempfile
import wave
from compare_elevenlabs_v4 import ROOT, ENDPOINT, read_env, request_json, align_turns, normalize


def batches(turns):
    # Preserve the approved opening exactly; start fresh at chapter boundaries.
    result = []
    for start, end in [(0, 4), (4, 12), (12, 28), (28, len(turns))]:
        group, count = [], 0
        for turn in turns[start:end]:
            if len(turn[1]) > 2000:
                raise ValueError('A presenter turn exceeds the dialogue limit.')
            if group and count + len(turn[1]) > 1800:
                result.append(group)
                group, count = [], 0
            group.append(turn)
            count += len(turn[1])
        if group:
            result.append(group)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', type=Path)
    parser.add_argument('--cached-only', action='store_true')
    args = parser.parse_args()
    env = read_env(args.env_file)
    key = env.get('ELEVENLABS_API_KEY')
    female = env.get('ELEVENLABS_VOICE_ID')
    male = env.get('ELEVENLABS_MALE_VOICE_ID', 'mgJuPHzoFzHp7TakLEYb')
    if not female or (not key and not args.cached_only):
        raise ValueError('Existing ElevenLabs credentials required.')
    if not args.cached_only:
        models = request_json('https://api.elevenlabs.io/v1/models', key)
        if not any(m['model_id'] == 'eleven_v4' for m in models):
            raise ValueError('Eleven v4 unavailable.')
        for voice in {female, male}:
            if request_json(f'https://api.elevenlabs.io/v1/voices/{voice}', key).get('voice_id') != voice:
                raise ValueError('Configured voice unavailable.')
    turns = json.loads((ROOT / 'src/data/editorial.json').read_text())['turns']
    groups = batches(turns)
    segments, chunks, hashes = [], [], []
    frames_total = 0
    with tempfile.TemporaryDirectory(prefix='ambio-full-v4-') as directory:
        work = Path(directory)
        for index, group in enumerate(groups):
            inputs = [{'text': text, 'voice_id': female if speaker == 'Camille' else male}
                      for speaker, text, _ in group]
            body = {'inputs': inputs, 'model_id': 'eleven_v4', 'language_code': 'fr'}
            digest = hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()
            hashes.append(digest)
            cache = ROOT / '.audio-cache/v4-comparison' / digest
            cache.mkdir(parents=True, exist_ok=True)
            response_path = cache / 'response.json'
            if not response_path.exists():
                if args.cached_only:
                    raise ValueError(f'Missing cached chunk {index + 1}.')
                print(f'Generating chunk {index + 1}/{len(groups)} ({len(group)} turns).', flush=True)
                (cache / 'request.json').write_text(json.dumps(body, ensure_ascii=False, indent=2))
                result = request_json(ENDPOINT, key, body)
                temporary = cache / 'response.tmp'
                temporary.write_text(json.dumps(result))
                temporary.replace(response_path)
            result = json.loads(response_path.read_text())
            raw, pcm = work / f'{index}.mp3', work / f'{index}.wav'
            raw.write_bytes(base64.b64decode(result['audio_base64'], validate=True))
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(raw), '-ar', '44100', '-ac', '1', str(pcm)], check=True)
            with wave.open(str(pcm)) as audio:
                count = audio.getnframes()
                frames = audio.readframes(count)
            timing = align_turns(result, inputs, group, count / 44100)
            # Providers may place the last boundary a few milliseconds beyond the
            # decoded file. Pad that validated <=100ms tail instead of clipping words.
            last_ms = max(s['endMs'] for s in timing['segments'])
            required = max(count, math.ceil(last_ms / 1000 * 44100))
            frames += bytes((required - count) * 2)
            count = required
            offset = frames_total / 44100 * 1000
            for segment in timing['segments']:
                segments.append({
                    'startMs': round(segment['startMs'] + offset),
                    'endMs': round(segment['endMs'] + offset),
                    'words': [{k: round(v + offset) for k, v in word.items()} for word in segment['words']]})
            chunks.append(frames)
            frames_total += count
            if index < len(groups) - 1:
                chunks.append(bytes(8820 * 2))  # 200ms only at batch boundaries.
                frames_total += 8820
            print(f'Validated chunk {index + 1}: {len(group)} turns, {count / 44100:.2f}s.', flush=True)
        previous = 0
        for segment, turn in zip(segments, turns):
            if segment['startMs'] < previous or len(segment['words']) != len(turn[1].split(' ')):
                raise ValueError('Full episode alignment mismatch.')
            for word in segment['words']:
                if not segment['startMs'] <= word['startMs'] <= word['endMs'] <= segment['endMs'] + 30:
                    raise ValueError('Word timing outside its presenter turn.')
            previous = segment['endMs']
        if len(segments) != len(turns):
            raise ValueError('Incomplete episode.')
        full = work / 'full.wav'
        with wave.open(str(full), 'wb') as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(44100)
            audio.writeframes(b''.join(chunks))
        rendered = work / 'episode.mp3'
        normalize(full, rendered)
        timing = {'durationMs': round(frames_total / 44100 * 1000), 'provider': 'elevenlabs',
                  'model': 'eleven_v4', 'voices': timing['voices'], 'segments': segments,
                  'generation': {'requestHashes': hashes, 'chunkGapMs': 200}}
        # All validation and rendering finishes before publishing either output.
        destination = ROOT / 'assets/audio/edition-2026-10-24-v4.mp3'
        timing_destination = ROOT / 'src/data/audio-timing.json'
        backup = ROOT / '.audio-cache/pre-v4-audio-timing.json'
        if not backup.exists():
            backup.write_bytes(timing_destination.read_bytes())
        destination.with_suffix('.tmp').write_bytes(rendered.read_bytes())
        timing_destination.with_suffix('.tmp').write_text(json.dumps(timing, indent=2, ensure_ascii=False) + '\n')
        destination.with_suffix('.tmp').replace(destination)
        timing_destination.with_suffix('.tmp').replace(timing_destination)
        print(f'Published {timing["durationMs"] / 1000:.2f}s, {len(segments)} turns, {sum(len(s["words"]) for s in segments)} aligned words.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, subprocess.CalledProcessError) as error:
        raise SystemExit(f'V4 build failed: {error}') from None
