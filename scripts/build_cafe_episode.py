"""Mix the approved cue into v4 speech and publish its matching timeline offline."""
import argparse
import copy
import json
import tempfile
import wave
from pathlib import Path
from build_cafe_preview import ROOT, run, measure
from compare_elevenlabs_v4 import duration

from edition_settings import SETTINGS, settings_for

TRANSITIONS = (12, 28)


def arrange_timing(source, transitions=TRANSITIONS, config=None):
    cues = config['transitions'] if config else [{'segmentIndex': i, 'durationMs': 1500} for i in transitions]
    intro = config['introMs'] if config else 3000
    outro = config['outroMs'] if config else 4000
    result = copy.deepcopy(source)
    for index, segment in enumerate(result['segments']):
        offset = intro + sum(cue['durationMs'] for cue in cues if index >= cue['segmentIndex'])
        for key in ('startMs', 'endMs'):
            segment[key] += offset
        for word in segment['words']:
            for key in ('startMs', 'endMs'):
                word[key] += offset
    added = intro + sum(cue['durationMs'] for cue in cues)
    result['durationMs'] = source['durationMs'] + added + outro
    result['musicOnlyRanges'] = [{'startMs': 0, 'endMs': intro}]
    offset = intro
    for cue in cues:
        start = source['segments'][cue['segmentIndex']]['startMs'] + offset
        result['musicOnlyRanges'].append({'startMs': start, 'endMs': start + cue['durationMs']})
        offset += cue['durationMs']
    result['musicOnlyRanges'].append({'startMs': source['durationMs'] + added, 'endMs': result['durationMs']})
    result['production'] = {'style': 'warm-cafe', 'introMs': intro, 'transitionMs': 1500, 'outroMs': outro}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--edition', default='2026-10-24', choices=SETTINGS)
    args = parser.parse_args()
    config = settings_for(args.edition)
    cues = config['transitions']
    output = ROOT / config['workDir']
    output.mkdir(parents=True, exist_ok=True)
    source_path = output / 'full-dry-timing.json'
    active = ROOT / config['dataDir'] / 'audio-timing.json'
    active_timing = json.loads(active.read_text())
    if not active_timing.get('production'):
        source_path.write_text(json.dumps(active_timing, indent=2, ensure_ascii=False) + '\n')
    elif not source_path.exists():
        raise ValueError('Original dry timing is missing.')
    source = json.loads(source_path.read_text())
    if active_timing.get('generation') != source.get('generation'):
        raise ValueError('Dry timing belongs to a different speech generation.')
    timing = arrange_timing(source, config=config)
    speech = ROOT / f'assets/audio/edition-{args.edition}-v4.mp3'
    with tempfile.TemporaryDirectory(prefix='ambio-cafe-full-') as directory:
        work = Path(directory)
        decoded = work / 'speech.wav'
        run(['-i', str(speech), '-ar', '44100', '-ac', '2', str(decoded)])
        with wave.open(str(decoded)) as audio:
            frames = audio.readframes(audio.getnframes())
        frame_at = lambda ms: round(ms * 44100 / 1000)
        total = frame_at(source['durationMs'])
        if abs(len(frames) // 4 - total) > 4410:
            raise ValueError('Dry audio duration does not match source timing.')
        frames = (frames + bytes(max(0, total * 4 - len(frames))))[:total * 4]
        parts = [bytes(frame_at(config['introMs']) * 4)]
        cursor = 0
        for cue in cues:
            index = cue['segmentIndex']
            cut = frame_at(source['segments'][index]['startMs'])
            parts.extend([frames[cursor * 4:cut * 4], bytes(frame_at(cue['durationMs']) * 4)])
            cursor = cut
        parts.extend([frames[cursor * 4:], bytes(frame_at(config['outroMs']) * 4)])
        arranged = work / 'arranged.wav'
        with wave.open(str(arranged), 'wb') as audio:
            audio.setnchannels(2); audio.setsampwidth(2); audio.setframerate(44100)
            audio.writeframes(b''.join(parts))
        inputs = ['-i', str(arranged), '-i', str(ROOT / config['introBed'])]
        ranges = timing['musicOnlyRanges']
        filters, labels = [], ['[0:a]', '[1:a]']
        render_cues = cues + [{'cue': config['outroCue'], 'durationMs': config['outroMs']}]
        for i, cue in enumerate(render_cues):
            path = work / f'cue-{i}.wav'
            seconds = cue['durationMs'] / 1000
            fade = min(.5, seconds / 2) if i < len(cues) else min(2, seconds / 2)
            run(['-i', str(ROOT / cue['cue']), '-af', f'apad,atrim=duration={seconds},asetpts=PTS-STARTPTS,afade=t=in:d=0.1,afade=t=out:st={seconds-fade}:d={fade}', '-ar', '44100', '-ac', '2', str(path)])
            inputs.extend(['-i', str(path)])
            filters.append(f'[{i+2}:a]adelay={ranges[i+1]["startMs"]}:all=1[m{i}]')
            labels.append(f'[m{i}]')
        filters.append(''.join(labels) + f'amix=inputs={len(labels)}:duration=first:normalize=0[out]')
        mixed, final = work / 'mixed.wav', work / 'final.mp3'
        run(inputs + ['-filter_complex', ';'.join(filters), '-map', '[out]', str(mixed)])
        reference, before = measure(speech), measure(mixed)
        gain = float(reference['input_i']) - float(before['input_i'])
        run(['-i', str(mixed), '-af', f'volume={gain}dB,alimiter=limit=0.891251:level=false:latency=true', '-ar', '44100', '-b:a', '128k', str(final)])
        measured = measure(final)
        if float(measured['input_tp']) >= 0 or abs(float(measured['input_i']) - float(reference['input_i'])) > .5:
            raise ValueError('Final loudness/peak check failed.')
        if abs(duration(final) * 1000 - timing['durationMs']) > 100:
            raise ValueError('Final duration mismatch.')
        destination = ROOT / f'assets/audio/edition-{args.edition}-cafe.mp3'
        destination.write_bytes(final.read_bytes())
        active.write_text(json.dumps(timing, indent=2, ensure_ascii=False) + '\n')
        (output / 'full-mix-settings.json').write_text(json.dumps({'settings': config, 'timeline': timing['production'], 'musicOnlyRanges': ranges, 'gainDb': gain, 'measurements': measured, 'reference': reference}, indent=2) + '\n')
        print(json.dumps({'durationMs': timing['durationMs'], 'LUFS': measured['input_i'], 'peakDb': measured['input_tp'], 'musicOnlyRanges': ranges}))


if __name__ == '__main__':
    main()
