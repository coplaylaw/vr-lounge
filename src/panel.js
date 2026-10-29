import * as THREE from 'three';
import { CVI } from './palette.js';

const W = 1024;
const H = 512;
const PAD = 56;
const CHARS_PER_SECOND = 38;

// Talebobl ved receptionisten. Teksten skrives frem tegn for tegn.
export class SpeechPanel {
  constructor(speaker, width = 1.1) {
    this.speaker = speaker;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, (width * H) / W),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, toneMapped: false }),
    );
    this.title = '';
    this.lines = [];
    this.total = 0;
    this.shown = 0;
    this.drawnChars = -1;
    this.finishedAt = 0;
    this.draw(0);
  }

  get isTyping() {
    return this.shown < this.total;
  }

  say({ title, body }) {
    this.title = title;
    this.lines = this.wrap(body);
    this.total = this.lines.reduce((n, line) => n + line.length, 0);
    this.shown = 0;
    this.drawnChars = -1;
  }

  update(dt, time) {
    if (!this.isTyping) return;
    this.shown = Math.min(this.total, this.shown + dt * CHARS_PER_SECOND);
    const chars = Math.floor(this.shown);
    if (chars !== this.drawnChars) this.draw(chars);
    if (!this.isTyping) this.finishedAt = time;
  }

  wrap(text) {
    const g = this.ctx;
    g.font = '40px "Segoe UI", Roboto, sans-serif';
    const maxWidth = W - PAD * 2;
    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (g.measureText(candidate).width > maxWidth && line) {
        lines.push(`${line} `);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  draw(chars) {
    this.drawnChars = chars;
    const g = this.ctx;
    g.clearRect(0, 0, W, H);

    g.fillStyle = 'rgba(21, 37, 62, 0.92)'; // CVI-navy
    g.beginPath();
    g.roundRect(8, 8, W - 16, H - 16, 36);
    g.fill();
    g.save();
    g.strokeStyle = CVI.cyan;
    g.shadowColor = CVI.cyan;
    g.shadowBlur = 16;
    g.lineWidth = 4;
    g.stroke();
    g.restore();

    g.textBaseline = 'top';
    g.fillStyle = CVI.cyan;
    g.font = '600 28px "Segoe UI", Roboto, sans-serif';
    g.fillText(this.speaker.toUpperCase(), PAD, 40);

    g.fillStyle = '#ffffff';
    g.font = '700 52px "Segoe UI", Roboto, sans-serif';
    g.fillText(this.title, PAD, 84);

    g.fillStyle = '#e8eef5';
    g.font = '40px "Segoe UI", Roboto, sans-serif';
    let left = chars;
    const top = this.title ? 170 : 92; // uden overskrift rykker teksten op
    this.lines.forEach((line, i) => {
      if (left <= 0) return;
      g.fillText(line.slice(0, left), PAD, top + i * 54);
      left -= line.length;
    });

    this.texture.needsUpdate = true;
  }
}
