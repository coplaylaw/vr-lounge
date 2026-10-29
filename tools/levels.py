"""Afbalancerer lydniveauerne: måler hver lyd i assets/audio med ffmpeg (EBU R128, LUFS)
og skriver en forstærkning pr. lyd til assets/audio/levels.json, så den rammer sin kategoris målniveau.

Kør igen, når der kommer nye lyde:  python3 tools/levels.py
Målene herunder er før den styrke, koden selv giver hver afspilning (volume i sound.play).
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'assets' / 'audio'

# Mål i LUFS. Første mønster, der passer på navnet, vinder.
TARGETS = [
    (r'^music/', -14),            # musikken dæmpes yderligere af musikbussen i audio.js
    (r'^ambience/monorail-pass', -30),
    (r'^ambience/', -38),
    (r'^robot/servo', -34),
    (r'^robot/hover-loop', -36),
    (r'^robot/talk-blip', -30),
    (r'^robot/fly', -32),
    (r'^robot/', -26),
    (r'^ui/type-tick', -36),
    (r'^ui/panel-open', -32),
    (r'^ui/', -27),
    (r'^interact/(grab|release|pointer-hover)', -36),
    (r'^interact/', -30),
    (r'^impact/blocks-tumble', -28),
    (r'^impact/', -29),
    (r'^desk/disk-near', -36),
    (r'^desk/', -28),
    (r'^blaster/target-hum', -38),
    (r'^blaster/shot', -31),
    (r'^blaster/', -27),
    (r'^fx/', -28),
    (r'^butterflies/', -31),
    (r'^coffee/steam', -38),
    (r'^coffee/', -32),
    (r'^camera/develop', -33),
    (r'^camera/', -28),
    (r'^stamp/', -27),
    (r'^paper/plane', -31),
    (r'^paper/', -29),
    (r'^props/neon', -31),
    (r'^props/', -28),
    (r'.', -30),
]
MIN_GAIN, MAX_GAIN = 0.03, 4.0  # meget stille optagelser forstærkes højst 12 dB


def loudness(path):
    out = subprocess.run(
        ['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-af', 'ebur128', '-f', 'null', '-'],
        capture_output=True, text=True,
    ).stderr
    match = re.findall(r'^\s+I:\s+(-?[\d.]+) LUFS', out, re.M)
    return float(match[-1]) if match else None


def main():
    levels = {}
    for path in sorted(ROOT.rglob('*.mp3')):
        name = path.relative_to(ROOT).with_suffix('').as_posix()
        if name.startswith('voice/'):
            continue  # robottens stemme afspilles for sig (Sound.speak) og ligger allerede jævnt
        lufs = loudness(path)
        if lufs is None or lufs < -70:
            continue
        target = next(t for pattern, t in TARGETS if re.search(pattern, name))
        gain = min(MAX_GAIN, max(MIN_GAIN, 10 ** ((target - lufs) / 20)))
        levels[name] = round(gain, 3)
        print(f'{name:32s} {lufs:6.1f} LUFS -> {target} LUFS  gain {gain:.3f}')
    (ROOT / 'levels.json').write_text(json.dumps(levels, indent=2) + '\n')


if __name__ == '__main__':
    main()
