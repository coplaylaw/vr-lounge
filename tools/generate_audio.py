#!/usr/bin/env python3
"""Genererer musik og lydeffekter via ElevenLabs ud fra tools/sounds.json.

Kræver ELEVENLABS_API_KEY. Filer, der allerede findes, springes over;
slet en fil (eller brug --force) for at lave den igen.

    python3 tools/generate_audio.py [--force] [--only music|sfx] [filter]
"""
import json, os, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'audio'
API = 'https://api.elevenlabs.io/v1'
KEY = os.environ.get('ELEVENLABS_API_KEY')


def post(path, body, timeout):
    req = urllib.request.Request(
        f'{API}{path}?output_format=mp3_44100_128',
        data=json.dumps(body).encode(),
        headers={'xi-api-key': KEY, 'content-type': 'application/json'},
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return res.read()
        except urllib.error.HTTPError as err:
            if err.code not in (429, 500, 502, 503) or attempt == 3:
                raise RuntimeError(f'{err.code}: {err.read().decode(errors="replace")[:300]}')
        except (urllib.error.URLError, ConnectionError, TimeoutError):
            if attempt == 3:
                raise
        time.sleep(2 ** (attempt + 1))


def music(entry):
    return post('/music', {
        'prompt': entry['prompt'],
        'music_length_ms': entry['length_ms'],
        'force_instrumental': True,
    }, timeout=600)


def sfx(entry):
    body = {
        'text': entry['prompt'],
        'duration_seconds': entry['duration'],
        'prompt_influence': entry.get('influence', 0.5),
        'model_id': 'eleven_text_to_sound_v2',
    }
    if entry.get('loop'):
        body['loop'] = True
    return post('/sound-generation', body, timeout=180)


def run(kind, entry, force):
    target = OUT / entry['file']
    if target.exists() and not force:
        return f'skip  {entry["file"]}'
    data = (music if kind == 'music' else sfx)(entry)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return f'ok    {entry["file"]} ({len(data) // 1024} KB)'


def main():
    if not KEY:
        sys.exit('ELEVENLABS_API_KEY mangler')
    args = sys.argv[1:]
    force = '--force' in args
    only = args[args.index('--only') + 1] if '--only' in args else None
    words = [a for a in args if not a.startswith('--') and a != only]
    spec = json.loads((ROOT / 'tools' / 'sounds.json').read_text())
    jobs = [(kind, e) for kind in ('music', 'sfx') if only in (None, kind) for e in spec[kind]
            if not words or any(w in e['file'] for w in words)]
    failed = 0
    with ThreadPoolExecutor(4) as pool:
        futures = [(e, pool.submit(run, kind, e, force)) for kind, e in jobs]
        for e, f in futures:
            try:
                print(f.result(), flush=True)
            except Exception as err:
                failed += 1
                print(f'FEJL  {e["file"]}: {err}', flush=True)
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
