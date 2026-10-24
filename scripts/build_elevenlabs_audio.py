"""Generate bundled speech with the existing Ambio ElevenLabs setup.
Keys stay in the supplied env file; requests are cached; publish after full success.
"""
import argparse, base64, hashlib, json, os, re, subprocess, tempfile, urllib.request, urllib.error, wave
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--env-file',type=Path);parser.add_argument('--sample',action='store_true');args=parser.parse_args()
root=Path(__file__).resolve().parents[1];env=dict(os.environ)
if args.env_file:
 for line in args.env_file.read_text().splitlines():
  if '=' in line and not line.lstrip().startswith('#'):
   k,v=line.split('=',1);env[k.strip()]=v.strip().strip('\"\'')
key=env.get('ELEVENLABS_API_KEY');female=env.get('ELEVENLABS_VOICE_ID');male=env.get('ELEVENLABS_MALE_VOICE_ID','mgJuPHzoFzHp7TakLEYb')
if not key or not female: raise SystemExit('Supply ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID through the environment file.')
cache=root/'.audio-cache';cache.mkdir(exist_ok=True)
data=json.loads((root/'src/data/editorial.json').read_text())
words=['reculer','trompeuse','sonde','prélever','échantillons','hypothèses','départager','dégustations','saveurs','bouchée','décroche','savoir-faire']
def generate(text,voice,previous='',following=''):
 body={'text':text,'model_id':'eleven_multilingual_v2','voice_settings':{'stability':.4,'similarity_boost':.75,'speed':1},'previous_text':previous,'next_text':following}
 digest=hashlib.sha256((voice+json.dumps(body,ensure_ascii=False)).encode()).hexdigest();path=cache/(digest+'.json')
 if path.exists(): return json.loads(path.read_text())
 request=urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_128',data=json.dumps(body).encode(),headers={'xi-api-key':key,'content-type':'application/json'},method='POST')
 try: result=json.load(urllib.request.urlopen(request,timeout=90))
 except urllib.error.HTTPError as e:
  try:
   detail=json.loads(e.read()).get('detail',{});status=detail.get('status','request_failed') if isinstance(detail,dict) else 'request_failed'
  except Exception: status='request_failed'
  raise SystemExit(f'ElevenLabs HTTP {e.code}: {status}. Cached work retained; bundled audio unchanged.')
 if not result.get('audio_base64'): raise SystemExit('No audio returned.')
 path.write_text(json.dumps(result));return result
with tempfile.TemporaryDirectory(prefix='ambio-eleven-') as tmp:
 tmp=Path(tmp);chunks=[];segments=[];cursor=0
 turns=data['turns'][:2] if args.sample else data['turns']
 for i,(speaker,text,translation) in enumerate(turns):
  voice=female if speaker=='Camille' else male
  result=generate(text,voice,data['turns'][i-1][1] if i else '',data['turns'][i+1][1] if i+1<len(data['turns']) else '')
  mp3=tmp/f'{i}.mp3';mp3.write_bytes(base64.b64decode(result['audio_base64']));wav=tmp/f'{i}.wav'
  subprocess.run(['ffmpeg','-v','error','-y','-i',str(mp3),'-ar','44100','-ac','1',str(wav)],check=True)
  with wave.open(str(wav)) as f: frames=f.readframes(f.getnframes())
  duration=len(frames)/2/44100
  if duration<1: raise SystemExit('Invalid narration duration.')
  alignment=result.get('alignment')
  if not alignment or ''.join(alignment['characters'])!=text: raise SystemExit('Original-text alignment mismatch; bundled audio unchanged.')
  tokens=[]
  for match in re.finditer(r'\S+',text):
   a=alignment['character_start_times_seconds'][match.start()];b=alignment['character_end_times_seconds'][match.end()-1]
   tokens.append({'startMs':round((cursor+a)*1000),'endMs':round((cursor+b)*1000)})
  segments.append({'startMs':round(cursor*1000),'endMs':round((cursor+duration)*1000),'words':tokens})
  chunks.extend([frames,bytes(22050)]);cursor+=duration+.25
  print(f'{i+1}/{len(turns)} {speaker}: {duration:.1f}s',flush=True)
 full=tmp/'full.wav'
 with wave.open(str(full),'wb') as f:
  f.setnchannels(1);f.setsampwidth(2);f.setframerate(44100);f.writeframes(b''.join(chunks))
 destination=tmp/'episode.mp3'
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(full),'-af','loudnorm=I=-18:TP=-2:LRA=7','-ar','44100','-b:a','128k',str(destination)],check=True)
 if args.sample:
  (root/'assets/audio/voice-preview.mp3').write_bytes(destination.read_bytes());print('Saved two-host preview.');raise SystemExit(0)
 for i,word in enumerate(words):
  result=generate(word,female);(tmp/f'word-{i}.mp3').write_bytes(base64.b64decode(result['audio_base64']));print(f'Vocabulary {i+1}/{len(words)}',flush=True)
 for i in range(len(words)): (root/f'assets/audio/edition02-word-{i}.mp3').write_bytes((tmp/f'word-{i}.mp3').read_bytes())
 (root/'assets/audio/edition-2026-10-24.mp3').write_bytes(destination.read_bytes())
 (root/'src/data/audio-timing.json').write_text(json.dumps({'durationMs':round(cursor*1000),'provider':'elevenlabs','model':'eleven_multilingual_v2','voices':{'Camille':'Lucie narration','Louis':'Loïc - Engaging French Storyteller'},'segments':segments},indent=2)+'\n')
 print(f'Published {cursor:.1f}s with provider word alignment and 12 pronunciation clips.',flush=True)
