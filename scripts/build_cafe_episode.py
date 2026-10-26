"""Mix the approved cue into v4 speech and publish its matching timeline offline."""
import copy
import json
import tempfile
import wave
from pathlib import Path
from build_cafe_preview import ROOT, run, measure
from compare_elevenlabs_v4 import duration

TRANSITIONS = (12, 28)


def arrange_timing(source):
    result = copy.deepcopy(source)
    cuts = [source['segments'][index]['startMs'] for index in TRANSITIONS]
    for index, segment in enumerate(result['segments']):
        offset = 3000 + 1500 * sum(index >= boundary for boundary in TRANSITIONS)
        for key in ('startMs', 'endMs'):
            segment[key] += offset
        for word in segment['words']:
            for key in ('startMs', 'endMs'):
                word[key] += offset
    result['durationMs'] = source['durationMs'] + 10000
    result['musicOnlyRanges'] = [{'startMs': 0, 'endMs': 3000}]
    for i, cut in enumerate(cuts):
        start = cut + 3000 + i * 1500
        result['musicOnlyRanges'].append({'startMs': start, 'endMs': start + 1500})
    result['musicOnlyRanges'].append({'startMs': source['durationMs'] + 6000, 'endMs': result['durationMs']})
    result['production'] = {'style': 'warm-cafe', 'introMs': 3000, 'transitionMs': 1500, 'outroMs': 4000}
    return result


def main():
    output = ROOT / 'experiments/cafe-signature'
    source_path = output / 'full-dry-timing.json'
    active = ROOT / 'src/data/audio-timing.json'
    if not source_path.exists():
        source = json.loads(active.read_text())
        if source.get('production'):
            raise ValueError('Original dry timing is missing.')
        source_path.write_text(json.dumps(source, indent=2, ensure_ascii=False) + '\n')
    source = json.loads(source_path.read_text())
    timing = arrange_timing(source)
    speech = ROOT / 'assets/audio/edition-2026-10-24-v4.mp3'
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
        parts = [bytes(frame_at(3000) * 4)]
        cursor = 0
        for index in TRANSITIONS:
            cut = frame_at(source['segments'][index]['startMs'])
            parts.extend([frames[cursor * 4:cut * 4], bytes(frame_at(1500) * 4)])
            cursor = cut
        parts.extend([frames[cursor * 4:], bytes(frame_at(4000) * 4)])
        arranged = work / 'arranged.wav'
        with wave.open(str(arranged), 'wb') as audio:
            audio.setnchannels(2); audio.setsampwidth(2); audio.setframerate(44100)
            audio.writeframes(b''.join(parts))
        transition, outro = work / 'transition.wav', work / 'outro.wav'
        cue = output / 'cafe-cue.mp3'
        run(['-i', str(cue), '-af', 'atrim=duration=1.5,asetpts=PTS-STARTPTS,afade=t=in:d=0.1,afade=t=out:st=1:d=0.5', '-ar', '44100', '-ac', '2', str(transition)])
        run(['-i', str(cue), '-af', 'atrim=duration=4,asetpts=PTS-STARTPTS,afade=t=in:d=0.2,afade=t=out:st=2:d=2', '-ar', '44100', '-ac', '2', str(outro)])
        inputs = ['-i', str(arranged), '-i', str(output / 'music-bed.wav'), '-i', str(transition), '-i', str(transition), '-i', str(outro)]
        ranges = timing['musicOnlyRanges']
        filters = [f'[{i+2}:a]adelay={ranges[i+1]["startMs"]}:all=1[m{i}]' for i in range(3)]
        filters.append('[0:a][1:a][m0][m1][m2]amix=inputs=5:duration=first:normalize=0[out]')
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
        destination = ROOT / 'assets/audio/edition-2026-10-24-cafe.mp3'
        destination.write_bytes(final.read_bytes())
        active.write_text(json.dumps(timing, indent=2, ensure_ascii=False) + '\n')
        (output / 'full-mix-settings.json').write_text(json.dumps({'timeline': timing['production'], 'musicOnlyRanges': ranges, 'gainDb': gain, 'measurements': measured, 'reference': reference}, indent=2) + '\n')
        print(json.dumps({'durationMs': timing['durationMs'], 'LUFS': measured['input_i'], 'peakDb': measured['input_tp'], 'musicOnlyRanges': ranges}))


if __name__ == '__main__':
    main()
