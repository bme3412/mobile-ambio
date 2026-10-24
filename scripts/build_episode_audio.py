"""Rebuild original narration offline using installed macOS voices and ffmpeg.
Segment boundaries are measured from PCM; word timing is proportional, not forced alignment.
"""
import json, subprocess, tempfile, wave
from pathlib import Path
root = Path(__file__).resolve().parents[1]
data = json.loads((root/'src/data/editorial.json').read_text())
output = root/'assets/audio'; output.mkdir(exist_ok=True)
metadata = []; cursor = 0
with tempfile.TemporaryDirectory(prefix='ambio-audio-') as tmp:
    tmp = Path(tmp); chunks = []
    for i, (speaker, text, translation) in enumerate(data['turns']):
        source = tmp/f'{i}.txt'; source.write_text(text)
        aiff = tmp/f'{i}.aiff'; wav = tmp/f'{i}.wav'
        voice = 'Flo (French (France))' if speaker == 'Camille' else 'Thomas'
        subprocess.run(['say','-v',voice,'-r','160','-f',str(source),'-o',str(aiff)],check=True)
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(aiff),'-ar','24000','-ac','1',str(wav)],check=True)
        with wave.open(str(wav)) as f: frames = f.readframes(f.getnframes()); duration = len(frames)/2/24000
        if duration < 1: raise RuntimeError("Empty speech output: run with access to macOS speech services")
        chunks.append(frames); chunks.append(bytes(12000)) # 250 ms between turns
        metadata.append({'startMs':round(cursor*1000), 'endMs':round((cursor+duration)*1000)})
        cursor += duration + .25
        print(f'{i+1}/{len(data["turns"])} {speaker}: {duration:.1f}s',flush=True)
    full = tmp/'episode.wav'
    with wave.open(str(full),'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(24000); f.writeframes(b''.join(chunks))
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(full),'-af','loudnorm=I=-18:TP=-2:LRA=7','-ar','24000','-b:a','96k',str(output/'shared-world-fr.mp3')],check=True)
(root/'src/data/audio-timing.json').write_text(json.dumps({'durationMs':round(cursor*1000),'segments':metadata},indent=2)+'\n')
