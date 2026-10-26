"""Generate one cached café cue and mix an isolated opening preview."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import urllib.error
import urllib.request
from compare_elevenlabs_v4 import ROOT, read_env, duration

BODY = {'text': 'An eight-second warm cafe podcast signature, instrumental only. Warm electric piano notes, soft brushed percussion and a gentle bass motif. Relaxed, welcoming and conversational. A small memorable melody with a soft ending. No vocals, no speech, no cafe chatter, no sound effects.',
        'duration_seconds': 8, 'loop': False, 'prompt_influence': 0.7,
        'model_id': 'eleven_text_to_sound_v2'}
ENDPOINT = 'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128'


def shift_timing(timing):
    shifted = copy.deepcopy(timing)
    shifted['durationMs'] += 3000
    for segment in shifted['segments']:
        for key in ('startMs', 'endMs'):
            segment[key] += 3000
        for word in segment['words']:
            for key in ('startMs', 'endMs'):
                word[key] += 3000
    shifted['introOffsetMs'] = 3000
    return shifted


def run(args):
    return subprocess.run(['ffmpeg', '-hide_banner', '-y'] + args, capture_output=True, text=True, check=True)


def measure(path):
    result = run(['-i', str(path), '-af', 'loudnorm=I=-19:TP=-1:LRA=7:print_format=json', '-f', 'null', '-'])
    return json.loads(result.stderr[result.stderr.rfind('{'):result.stderr.rfind('}') + 1])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', type=Path)
    parser.add_argument('--cached-only', action='store_true')
    args = parser.parse_args()
    digest = hashlib.sha256(json.dumps(BODY, sort_keys=True).encode()).hexdigest()
    cache = ROOT / '.audio-cache/cafe-signature' / digest
    cache.mkdir(parents=True, exist_ok=True)
    raw = cache / 'response.mp3'
    if not raw.exists():
        if args.cached_only:
            raise ValueError('No cached cue for this request.')
        key = read_env(args.env_file).get('ELEVENLABS_API_KEY')
        if not key:
            raise ValueError('Existing ElevenLabs credential required.')
        request = urllib.request.Request(ENDPOINT, data=json.dumps(BODY).encode(),
            headers={'xi-api-key': key, 'Content-Type': 'application/json'})
        print('Generating one 8-second cafe signature.', flush=True)
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                audio = response.read()
        except urllib.error.HTTPError as error:
            if error.code == 401:
                raise ValueError('ElevenLabs denied access. Verify the key has sound_generation permission; app unchanged.') from None
            raise ValueError(f'ElevenLabs HTTP {error.code}; app unchanged.') from None
        except urllib.error.URLError:
            raise ValueError('Cannot reach ElevenLabs.') from None
        pending = cache / 'response.tmp.mp3'
        pending.write_bytes(audio)
        if not 7.5 <= duration(pending) <= 8.5:
            raise ValueError('Generated cue has unexpected duration.')
        pending.replace(raw)
        (cache / 'request.json').write_text(json.dumps(BODY, indent=2))
    speech = ROOT / 'experiments/eleven-v4/B-eleven-v4.mp3'
    timing = json.loads((ROOT / 'experiments/eleven-v4/B-timing.json').read_text())
    original = measure(speech)
    with tempfile.TemporaryDirectory(prefix='ambio-cafe-') as directory:
        work = Path(directory)
        cue, bed, mixed, preview = [work / name for name in ('cafe-cue.mp3', 'music-bed.wav', 'mix.wav', 'opening-preview.mp3')]
        cue_measure = measure(raw)
        cue_gain = -20 - float(cue_measure['input_i'])
        run(['-i', str(raw), '-af', f'apad,atrim=duration=8,volume={cue_gain}dB,afade=t=in:d=0.15,afade=t=out:st=7:d=1', '-ar', '44100', '-b:a', '128k', str(cue)])
        # Duck before speech enters, stay quiet beneath it, and reach silence at 8s.
        run(['-i', str(cue), '-af', "volume='if(lt(t,2.5),1,if(lt(t,3),1-0.8*(t-2.5)/0.5,0.2))':eval=frame,afade=t=out:st=5:d=3", '-ar', '44100', '-ac', '2', str(bed)])
        run(['-i', str(speech), '-i', str(bed), '-filter_complex',
             '[0:a]adelay=3000:all=1[s];[s][1:a]amix=inputs=2:duration=longest:normalize=0[out]', '-map', '[out]', '-ar', '44100', str(mixed)])
        mixed_measure = measure(mixed)
        gain = float(original['input_i']) - float(mixed_measure['input_i'])
        run(['-i', str(mixed), '-af', f'volume={gain}dB,alimiter=limit=0.891251:level=false:latency=true', '-ar', '44100', '-b:a', '128k', str(preview)])
        final = measure(preview)
        if float(final['input_tp']) >= 0 or abs(float(final['input_i']) - float(original['input_i'])) > 0.5:
            raise ValueError('Preview failed peak/loudness validation.')
        if abs(duration(preview) - duration(speech) - 3) > 0.1:
            raise ValueError('Preview duration does not preserve complete speech.')
        output = ROOT / 'experiments/cafe-signature'
        output.mkdir(parents=True, exist_ok=True)
        for file in (cue, bed, preview):
            (output / file.name).write_bytes(file.read_bytes())
        (output / 'request.json').write_text(json.dumps(BODY, indent=2))
        (output / 'preview-timing.json').write_text(json.dumps(shift_timing(timing), indent=2) + '\n')
        settings = {'requestHash': digest, 'speechSource': str(speech.relative_to(ROOT)),
            'speechSHA256': hashlib.sha256(speech.read_bytes()).hexdigest(), 'speechOffsetMs': 3000,
            'musicEndMs': 8000, 'musicDuckGain': 0.2, 'duckStartMs': 2500, 'duckEndMs': 3000,
            'fadeStartMs': 5000, 'fadeEndMs': 8000, 'cueGainDb': cue_gain, 'finalGainDb': gain,
            'referenceMeasurements': original, 'previewMeasurements': final,
            'durationSeconds': duration(preview), 'listeningReview': 'pending'}
        (output / 'mix-settings.json').write_text(json.dumps(settings, indent=2) + '\n')
        print(json.dumps({'output': str(output), 'durationSeconds': duration(preview),
            'referenceLUFS': original['input_i'], 'previewLUFS': final['input_i'], 'truePeakDb': final['input_tp']}), flush=True)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, subprocess.CalledProcessError) as error:
        raise SystemExit(f'Cafe preview failed: {error}') from None
