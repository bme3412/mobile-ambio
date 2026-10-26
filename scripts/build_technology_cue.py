"""Generate and cache the October 26 technology transition without touching speech."""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.error
import urllib.request
from build_cafe_preview import ROOT, ENDPOINT, run, measure
from compare_elevenlabs_v4 import read_env, duration

BODY = {'text': 'A restrained podcast transition: two warm electric-piano notes answered by a soft rounded synthesizer tone, with a delicate brushed-percussion accent. Calm, curious, understated, compatible with a warm cafe signature. No vocals, no speech, no alarms, no dramatic rise. A short complete musical phrase with a gentle ending.', 'duration_seconds': 1.5, 'loop': False, 'prompt_influence': 0.7, 'model_id': 'eleven_text_to_sound_v2'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', type=Path)
    parser.add_argument('--cached-only', action='store_true')
    args = parser.parse_args()
    digest = hashlib.sha256(json.dumps(BODY, sort_keys=True).encode()).hexdigest()
    cache = ROOT / '.audio-cache/technology-cue' / digest
    cache.mkdir(parents=True, exist_ok=True)
    raw = cache / 'response.mp3'
    if not raw.exists():
        if args.cached_only: raise ValueError('Technology cue not cached.')
        key = read_env(args.env_file).get('ELEVENLABS_API_KEY')
        if not key: raise ValueError('Existing ElevenLabs credential required.')
        request = urllib.request.Request(ENDPOINT, data=json.dumps(BODY).encode(), headers={'xi-api-key': key, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                audio = response.read()
        except urllib.error.HTTPError as error:
            raise ValueError(f'Sound generation HTTP {error.code}; no episode assets changed.') from None
        pending = cache / 'response.tmp.mp3'
        pending.write_bytes(audio)
        if abs(duration(pending) - 1.5) > .25: raise ValueError('Unexpected cue duration.')
        pending.replace(raw)
        (cache / 'request.json').write_text(json.dumps(BODY, indent=2))
    output = ROOT / 'experiments/2026-10-26'
    output.mkdir(parents=True, exist_ok=True)
    gain = -20 - float(measure(raw)['input_i'])
    cue = output / 'technology-cue.mp3'
    run(['-i', str(raw), '-af', f'apad,atrim=duration=1.5,volume={gain}dB,afade=t=in:d=0.08,afade=t=out:st=1.1:d=0.4,alimiter=limit=0.891251:level=false:latency=true', '-ar', '44100', '-b:a', '128k', str(cue)])
    measured = measure(cue)
    if float(measured['input_tp']) >= 0: raise ValueError('Cue clips.')
    (output / 'technology-cue-settings.json').write_text(json.dumps({'request': BODY, 'requestHash': digest, 'gainDb': gain, 'measurements': measured}, indent=2)+'\n')
    print(json.dumps({'cue': str(cue), 'duration': duration(cue), 'peakDb': measured['input_tp']}))
if __name__ == '__main__': main()
