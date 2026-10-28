// Diskret baggrundssummen og små lyde ved berøring. Startes fra et klik (browserkrav).
export class Sound {
  start() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const pad = ctx.createGain();
    pad.gain.value = 0.05;
    filter.connect(pad).connect(this.master);
    for (const [freq, detune] of [[55, 0], [82.4, 4], [110, -5]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start();
    }
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
  }

  // Kort tone, der glider fra en frekvens til en anden.
  tone(from, to, duration, { type = 'sine', volume = 0.15, delay = 0 } = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + duration * 0.6);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  blip(pitch = 1) {
    this.tone(660 * pitch, 1320 * pitch, 0.35);
  }

  pew() {
    this.tone(1400, 300, 0.18, { type: 'triangle', volume: 0.08 });
  }

  pop() {
    this.tone(500, 1800, 0.12, { type: 'square', volume: 0.06 });
    this.tone(900, 2600, 0.25, { volume: 0.1, delay: 0.05 });
  }

  boing() {
    this.tone(320, 110, 0.5, { type: 'triangle', volume: 0.18 });
  }

  clap() {
    this.tone(1800, 400, 0.08, { type: 'square', volume: 0.08 });
    this.tone(880, 1760, 0.3, { volume: 0.12, delay: 0.06 });
  }

  printing() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.16, { type: 'square', volume: 0.04, delay: i * 0.15 }));
  }

  insert() {
    this.tone(200, 90, 0.25, { type: 'square', volume: 0.06 });
  }
}
