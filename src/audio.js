import * as THREE from 'three';

// Musik og lydeffekter fra assets/audio (genereret med ElevenLabs, se tools/sounds.json).
// Lydene hentes, så snart siden åbner, men kan først høres efter et klik (browserkrav).
// Positioner angives i stage-koordinater og placeres rumligt i forhold til gæstens hoved.
const ROOT = 'assets/audio/';
const MUSIC_VOLUME = 0.32;

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();

export class Sound {
  // extra: lyde ud over tools/sounds.json, fx robottens replikker ('voice/intro-da').
  constructor(stage, extra = []) {
    this.stage = stage;
    this.extra = extra;
    this.buffers = new Map(); // 'robot/hit-1' -> AudioBuffer
    this.variants = new Map(); // 'robot/hit' -> ['robot/hit-1', 'robot/hit-2', ...]
    this.loops = [];
    this.last = new Map(); // seneste afspilning pr. lyd, så den samme lyd ikke stables
    this.levels = {}; // forstærkning pr. lyd, så de ligger på samme niveau (se tools/levels.py)
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.music = ctx.createGain();
    this.music.gain.value = MUSIC_VOLUME;
    this.music.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.voice = ctx.createGain();
    this.voice.connect(this.master);
    this.speech = null; // den replik, robotten siger lige nu
    this.ready = this.load();
  }

  async load() {
    const spec = await (await fetch('tools/sounds.json')).json();
    try {
      this.levels = await (await fetch(`${ROOT}levels.json`)).json();
    } catch (err) {
      console.warn('Lydniveauer mangler', err);
    }
    const names = [...spec.music, ...spec.sfx].map((e) => e.file.replace(/\.mp3$/, '')).concat(this.extra);
    for (const name of names) {
      const base = name.replace(/-\d+$/, '');
      if (base !== name) this.variants.set(base, [...(this.variants.get(base) ?? []), name]);
    }
    await Promise.all(names.map(async (name) => {
      try {
        const data = await (await fetch(`${ROOT}${name}.mp3`)).arrayBuffer();
        this.buffers.set(name, await this.ctx.decodeAudioData(data));
      } catch (err) {
        console.warn(`Lyd mangler: ${name}`, err);
      }
    }));
  }

  // Kaldes fra startknappen. Musik og baggrundslyde starter, når filerne er hentet.
  start() {
    if (!this.ctx) return;
    this.ctx.resume();
    if (this.started) return;
    this.started = true;
    this.ready.then(() => {
      this.loop('music/lounge-theme', { volume: 1, bus: this.music });
      this.loop('ambience/room-tone', { volume: 0.9 });
      this.loop('ambience/neon-buzz', { volume: 0.12, at: new THREE.Vector3(-4.5, 2.15, -1.0) });
      this.loop('ambience/clock-tick', { volume: 0.35, at: new THREE.Vector3(4.5, 2.0, -1.5) });
      this.loop('ambience/drone-hum', { volume: 0.12 });
    });
  }

  // Lyden selv eller en tilfældig af dens varianter (robot/hit -> robot/hit-1..3).
  pick(name) {
    const list = this.variants.get(name);
    return list ? list[Math.floor(Math.random() * list.length)] : name;
  }

  // Et lydobjekt i rummet, eller direkte i ørerne uden position.
  // ref er afstanden i meter, hvor lyden har fuld styrke.
  output(at, bus = this.sfx, ref = 0.6) {
    if (!at) return bus;
    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = ref;
    panner.rolloffFactor = 1;
    this.place(panner, at);
    panner.connect(bus);
    return panner;
  }

  place(panner, at) {
    _pos.copy(at);
    this.stage.localToWorld(_pos);
    const t = this.ctx.currentTime;
    if (panner.positionX) {
      panner.positionX.setValueAtTime(_pos.x, t);
      panner.positionY.setValueAtTime(_pos.y, t);
      panner.positionZ.setValueAtTime(_pos.z, t);
    } else {
      panner.setPosition(_pos.x, _pos.y, _pos.z);
    }
  }

  // Engangslyd. volume 0..1, rate er afspilningshastigheden, gap er mindste tid mellem to af samme lyd.
  play(name, { at = null, volume = 1, rate = 1, vary = 0.06, delay = 0, gap = 0.05, ref } = {}) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    if (t - (this.last.get(name) ?? -1) < gap) return;
    const picked = this.pick(name);
    const buffer = this.buffers.get(picked);
    if (!buffer) return;
    this.last.set(name, t);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate * (1 + (Math.random() - 0.5) * 2 * vary);
    const gain = this.ctx.createGain();
    gain.gain.value = volume * (this.levels[picked] ?? 1);
    src.connect(gain).connect(this.output(at, this.sfx, ref));
    src.start(t + delay);
  }

  // Robottens replik: et filnavn eller en liste af filnavne og pauser i sekunder.
  // Afbryder en replik, der er i gang, og skruer ned for musikken imens.
  // onEnd kaldes, når replikken er slut, eller med det samme, hvis den ikke kan afspilles.
  speak(voice, { at = null, onEnd = () => {} } = {}) {
    this.stopSpeaking();
    const parts = [].concat(voice);
    if (!this.ctx || !this.started) {
      onEnd();
      return;
    }
    const speech = (this.speech = { sources: [], onEnd });
    // Venter på filerne, hvis gæsten er hurtigere end netværket.
    this.ready.then(() => {
      if (this.speech !== speech) return;
      const out = this.output(at, this.voice, 1.5);
      let t = this.ctx.currentTime + 0.05;
      for (const part of parts) {
        if (typeof part === 'number') {
          t += part;
          continue;
        }
        const buffer = this.buffers.get(part);
        if (!buffer) continue;
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(out);
        src.start(t);
        speech.sources.push(src);
        t += buffer.duration;
      }
      const last = speech.sources.at(-1);
      if (!last) {
        this.finishSpeaking(speech);
        return;
      }
      last.onended = () => this.finishSpeaking(speech);
      this.music.gain.setTargetAtTime(MUSIC_VOLUME * 0.45, this.ctx.currentTime, 0.15);
    });
  }

  stopSpeaking() {
    const speech = this.speech;
    if (!speech) return;
    this.speech = null;
    for (const src of speech.sources) {
      src.onended = null;
      try {
        src.stop();
      } catch {
        // allerede stoppet
      }
    }
    this.music.gain.setTargetAtTime(MUSIC_VOLUME, this.ctx.currentTime, 0.4);
  }

  finishSpeaking(speech) {
    if (this.speech !== speech) return;
    this.speech = null;
    this.music.gain.setTargetAtTime(MUSIC_VOLUME, this.ctx.currentTime, 0.4);
    speech.onEnd();
  }

  // Lyd i ring. Returnerer et håndtag til at ændre styrke og position eller stoppe den.
  loop(name, { at = null, volume = 1, bus = this.sfx } = {}) {
    const buffer = this.buffers.get(name);
    if (!this.ctx || !buffer) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const level = this.levels[name] ?? 1;
    const gain = this.ctx.createGain();
    gain.gain.value = volume * level;
    const out = this.output(at, bus);
    src.connect(gain).connect(out);
    src.start();
    const handle = {
      volume: (v) => gain.gain.setTargetAtTime(v * level, this.ctx.currentTime, 0.08),
      move: (p) => out !== bus && this.place(out, p),
      stop: () => {
        gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        src.stop(this.ctx.currentTime + 0.5);
        this.loops = this.loops.filter((l) => l !== handle);
      },
    };
    this.loops.push(handle);
    return handle;
  }

  // En loop, der kører, så længe der er brug for den: tænd med en styrke over 0 og en position.
  // Startes først, når lyden er hentet og afspilningen er i gang.
  steady(name, volume, at) {
    this.steadyLoops ??= new Map();
    let handle = this.steadyLoops.get(name);
    if (!handle && volume > 0.001 && this.started && this.buffers.has(name)) {
      handle = this.loop(name, { at, volume: 0 });
      this.steadyLoops.set(name, handle);
    }
    if (!handle) return;
    handle.volume(volume);
    if (at) handle.move(at);
  }

  // Gæstens hoved er lytteren. Kaldes hvert billede med det kamera, der tegnes fra.
  update(viewer) {
    if (!this.ctx) return;
    viewer.matrixWorld.decompose(_pos, _quat, _scale);
    _fwd.set(0, 0, -1).applyQuaternion(_quat);
    _up.set(0, 1, 0).applyQuaternion(_quat);
    const l = this.ctx.listener;
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setValueAtTime(_pos.x, t);
      l.positionY.setValueAtTime(_pos.y, t);
      l.positionZ.setValueAtTime(_pos.z, t);
      l.forwardX.setValueAtTime(_fwd.x, t);
      l.forwardY.setValueAtTime(_fwd.y, t);
      l.forwardZ.setValueAtTime(_fwd.z, t);
      l.upX.setValueAtTime(_up.x, t);
      l.upY.setValueAtTime(_up.y, t);
      l.upZ.setValueAtTime(_up.z, t);
    } else {
      l.setPosition(_pos.x, _pos.y, _pos.z);
      l.setOrientation(_fwd.x, _fwd.y, _fwd.z, _up.x, _up.y, _up.z);
    }
  }
}
