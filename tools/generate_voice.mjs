// Indtaler robottens replikker med CO:BOT-stemmen ud fra src/content.js.
// Kun replikker, der mangler en lydfil, laves. Slet en fil (eller brug --force) for at lave den igen.
//
//   ELEVENLABS_API_KEY=... node tools/generate_voice.mjs [--force] [del af filnavn ...]
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { VOICE_LINES } from '../src/content.js';

const VOICE_ID = 'PCVeXCARzNJocOl0eH5z'; // CO:BOT
const MODEL = 'eleven_v4';
const KEY = process.env.ELEVENLABS_API_KEY;
const root = new URL('../assets/audio/', import.meta.url);

// Navnene udtales som ord, ikke som bogstaver og kolon.
const spoken = (text) => text.replaceAll('CO:BOT', 'Co-Bot').replaceAll('CO:PLAY', 'Co-Play');

const args = process.argv.slice(2);
const force = args.includes('--force');
const words = args.filter((a) => !a.startsWith('--'));
if (!KEY) throw new Error('ELEVENLABS_API_KEY mangler');

let failed = 0;
for (const { voice, lang, text } of VOICE_LINES) {
  const file = new URL(`${voice}.mp3`, root);
  if (words.length && !words.some((w) => voice.includes(w))) continue;
  if (existsSync(file) && !force) continue;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text: spoken(text), model_id: MODEL, language_code: lang }),
  });
  if (!res.ok) {
    failed++;
    console.log(`FEJL  ${voice}: ${res.status} ${await res.text()}`);
    continue;
  }
  await mkdir(dirname(file.pathname), { recursive: true });
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  console.log(`ok    ${voice}  "${text}"`);
}
process.exit(failed ? 1 : 0);
