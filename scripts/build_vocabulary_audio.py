import subprocess, tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
words=['baignade','rassurer','courant','consignes','restauration','dégradés','cadre','savoir-faire','patrimoine','immatériel','transmettre','réserve']
with tempfile.TemporaryDirectory(prefix='ambio-words-') as tmp:
    for i,word in enumerate(words):
        path=Path(tmp)/f'{i}.aiff'
        subprocess.run(['say','-v','Thomas','-r','145','-o',str(path),word],check=True)
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(path),'-af','loudnorm=I=-18:TP=-2:LRA=7','-ar','24000','-b:a','96k',str(root/f'assets/audio/word-{i}.mp3')],check=True)
        print(word,flush=True)
