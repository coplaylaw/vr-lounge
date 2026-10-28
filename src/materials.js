import * as THREE from 'three';
import { CVI, CYAN_LIGHT } from './palette.js';

// Deterministisk tilfældighed, så byen og teksturerne ser ens ud hver gang.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(canvas, { repeat = false } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

// Slører hele lærredet i ét hug. Filter pr. figur er alt for langsomt på Quest.
function blurCanvas(c, px) {
  const [copy, g] = makeCanvas(c.width, c.height);
  g.drawImage(c, 0, 0);
  const ctx = c.getContext('2d');
  ctx.filter = `blur(${px}px)`;
  ctx.drawImage(copy, 0, 0);
  ctx.filter = 'none';
}

// --- CO:PLAY-logoet (hvidt på gennemsigtig baggrund) ---

const LOGO_SRC = 'assets/coplay-logo.png';
const LOGO_ASPECT = 942 / 160;
const LOGO_CO_WIDTH = 380; // pixels til og med kolonet i "CO:"
let logoImage = null;

// Kalder draw, når logoet er hentet. Teksturen opdateres bagefter.
function withLogo(tex, draw) {
  if (!logoImage) {
    logoImage = new Image();
    logoImage.src = LOGO_SRC;
  }
  const run = () => {
    draw(logoImage);
    tex.needsUpdate = true;
  };
  if (logoImage.complete && logoImage.naturalWidth) run();
  else logoImage.addEventListener('load', run, { once: true });
}

// Logoet farvet i én farve på et separat lærred.
function tintedLogo(img, color, height, cropWidth = img.naturalWidth) {
  const scale = height / img.naturalHeight;
  const [c, g] = makeCanvas(Math.ceil(cropWidth * scale), Math.ceil(height));
  g.drawImage(img, 0, 0, cropWidth, img.naturalHeight, 0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

// Neonskiltet med logoet, som på væggen ved indgangen.
export function logoNeonTexture(color = CVI.cyan) {
  const [c, g] = makeCanvas(1024, 256);
  const tex = canvasTexture(c);
  withLogo(tex, (img) => {
    const h = 128;
    const w = h * LOGO_ASPECT;
    const x = (1024 - w) / 2;
    const y = (256 - h) / 2;
    const glow = tintedLogo(img, color, h);
    g.shadowColor = color;
    for (const blur of [48, 24, 10]) {
      g.shadowBlur = blur;
      g.drawImage(glow, x, y);
    }
    g.shadowBlur = 0;
    g.drawImage(tintedLogo(img, CYAN_LIGHT, h), x, y);
  });
  return tex;
}

// --- Kontoret ---

// Lyse ahornplanker. Én tekstur dækker 1,4 x 1,4 m.
export function floorTexture() {
  const [c, g] = makeCanvas(512, 512);
  const rnd = seededRandom(11);
  const plank = 32;
  for (let i = 0; i < 512 / plank; i++) {
    let y = -rnd() * 300;
    while (y < 512) {
      const len = 160 + rnd() * 260;
      const l = 80 + rnd() * 7;
      g.fillStyle = `hsl(${32 + rnd() * 6}, ${30 + rnd() * 12}%, ${l}%)`;
      g.fillRect(i * plank, y, plank, len);
      g.fillStyle = 'rgba(120, 90, 60, 0.35)';
      g.fillRect(i * plank, y, plank, 1.5);
      y += len;
    }
    g.fillStyle = 'rgba(120, 90, 60, 0.3)';
    g.fillRect(i * plank, 0, 1.5, 512);
  }
  // Svag åretegning.
  g.strokeStyle = 'rgba(150, 110, 70, 0.06)';
  for (let k = 0; k < 220; k++) {
    const x = rnd() * 512;
    g.beginPath();
    g.moveTo(x, rnd() * 512);
    g.lineTo(x + (rnd() - 0.5) * 3, rnd() * 512);
    g.stroke();
  }
  return canvasTexture(c, { repeat: true });
}

// Grå, spartlet væg som bag CO:PLAY-skiltet.
export function plasterTexture(seed = 5) {
  const [c, g] = makeCanvas(512, 512);
  const rnd = seededRandom(seed);
  g.fillStyle = '#e1e2e3';
  g.fillRect(0, 0, 512, 512);
  for (let k = 0; k < 500; k++) {
    const v = 150 + rnd() * 100;
    g.fillStyle = `rgba(${v}, ${v + 3}, ${v + 6}, ${0.05 + rnd() * 0.22})`;
    const x = rnd() * 512;
    const y = rnd() * 512;
    const rx = 8 + rnd() * 50;
    const ry = 2 + rnd() * 9;
    const rot = rnd() * Math.PI;
    // Tegnes også forskudt, så teksturen kan gentages uden synlige kanter.
    for (const dx of [-512, 0, 512]) {
      for (const dy of [-512, 0, 512]) {
        g.beginPath();
        g.ellipse(x + dx, y + dy, rx, ry, rot, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  blurCanvas(c, 3);
  return canvasTexture(c, { repeat: true });
}

// Søjlerne: lodrette riller med grå skygger.
export function columnTexture() {
  const [c, g] = makeCanvas(256, 512);
  const rnd = seededRandom(17);
  g.fillStyle = '#dcdedf';
  g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 18; i++) {
    const x = (i / 18) * 256 + rnd() * 4;
    g.strokeStyle = `rgba(110, 118, 126, ${0.25 + rnd() * 0.35})`;
    g.lineWidth = 1.5 + rnd() * 2.5;
    g.beginPath();
    g.moveTo(x, 0);
    for (let y = 0; y <= 512; y += 32) g.lineTo(x + (rnd() - 0.5) * 3, y);
    g.stroke();
  }
  for (let k = 0; k < 160; k++) {
    g.fillStyle = `rgba(130, 138, 146, ${0.05 + rnd() * 0.15})`;
    g.beginPath();
    g.ellipse(rnd() * 256, rnd() * 512, 3 + rnd() * 8, 10 + rnd() * 50, 0, 0, Math.PI * 2);
    g.fill();
  }
  blurCanvas(c, 2);
  return canvasTexture(c, { repeat: true });
}

// Hvide akustikplader i loftet. Én tekstur er én plade på 0,6 x 0,6 m.
export function ceilingTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.fillStyle = '#f3f3f1';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#c9cac8';
  g.lineWidth = 2;
  g.strokeRect(1, 1, 126, 126);
  return canvasTexture(c, { repeat: true });
}

// Spiralfalsede ventilationsrør. v går langs røret, én tekstur er 0,5 m.
export function ductTexture() {
  const [c, g] = makeCanvas(64, 128);
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#c4c9ce');
  grad.addColorStop(0.5, '#dfe3e6');
  grad.addColorStop(1, '#c4c9ce');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 128);
  for (const y of [0, 42, 85]) {
    g.fillStyle = 'rgba(80, 88, 96, 0.55)';
    g.fillRect(0, y, 64, 3);
    g.fillStyle = 'rgba(255, 255, 255, 0.7)';
    g.fillRect(0, y + 3, 64, 2);
  }
  return canvasTexture(c, { repeat: true });
}

// Lyst gulvtæppe med bølgende højdekurver.
export function rugTexture() {
  const size = 512;
  const [c, g] = makeCanvas(size, size);
  const img = g.createImageData(size, size);
  const base = [239, 233, 222];
  const line = [196, 180, 156];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const f = Math.sin(x * 0.017 + Math.sin(y * 0.011) * 2.4)
        + 0.7 * Math.sin(y * 0.021 + Math.cos(x * 0.012) * 1.9)
        + 0.25 * Math.sin((x + y) * 0.03);
      const t = (((f * 3.2) % 1) + 1) % 1;
      const k = t < 0.2 ? 1 - Math.abs(t - 0.1) / 0.1 : 0;
      const i = (y * size + x) * 4;
      for (let ch = 0; ch < 3; ch++) img.data[i + ch] = base[ch] + (line[ch] - base[ch]) * Math.min(1, k * 1.6);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return canvasTexture(c);
}

// Mørkeblå gardiner med folder. Én tekstur er 0,6 m bred.
export function curtainTexture() {
  const [c, g] = makeCanvas(128, 8);
  for (let x = 0; x < 128; x++) {
    const shade = 0.7 + 0.3 * Math.sin((x / 128) * Math.PI * 2 * 4);
    g.fillStyle = `rgb(${32 * shade}, ${48 * shade}, ${72 * shade})`;
    g.fillRect(x, 0, 1, 8);
  }
  return canvasTexture(c, { repeat: true });
}

// Det farverige elgmaleri fra receptionen, gengivet frit.
export function paintingTexture() {
  const W = 512;
  const H = 768;
  const [c, g] = makeCanvas(W, H);
  const rnd = seededRandom(23);
  g.fillStyle = '#9c9fa2';
  g.fillRect(0, 0, W, H);
  for (let k = 0; k < 80; k++) {
    const v = 120 + rnd() * 110;
    g.fillStyle = `rgba(${v}, ${v + 2}, ${v + 4}, 0.35)`;
    g.fillRect(rnd() * W, rnd() * H, 40 + rnd() * 160, 10 + rnd() * 40);
  }
  blurCanvas(c, 6);

  // Grøn plet nederst og farvede strøg omkring hovedet.
  g.fillStyle = '#2f9b4a';
  g.beginPath();
  g.moveTo(40, 520);
  g.lineTo(230, 470);
  g.lineTo(300, 640);
  g.lineTo(120, 700);
  g.closePath();
  g.fill();
  g.fillStyle = '#4fbf5c';
  g.fillRect(330, 560, 140, 70);

  const splash = [CVI.orange, '#f39a2b', CVI.cyan, CVI.blue, '#e86aa6', '#ffffff', CVI.sand];
  for (let k = 0; k < 60; k++) {
    g.fillStyle = splash[k % splash.length];
    g.globalAlpha = 0.55 + rnd() * 0.45;
    const x = 150 + rnd() * 260;
    const y = 90 + rnd() * 300;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 120, y + (rnd() - 0.5) * 90);
    g.lineTo(x + (rnd() - 0.5) * 90, y + (rnd() - 0.5) * 120);
    g.closePath();
    g.fill();
  }
  g.globalAlpha = 1;

  // Elgen som mørk silhuet.
  g.fillStyle = '#16223a';
  g.beginPath();
  g.ellipse(300, 470, 150, 90, -0.08, 0, Math.PI * 2);
  g.fill();
  for (const x of [190, 235, 360, 405]) g.fillRect(x, 500, 26, 230);
  g.beginPath();
  g.moveTo(190, 430);
  g.lineTo(250, 330);
  g.lineTo(225, 270);
  g.lineTo(175, 300);
  g.lineTo(150, 400);
  g.closePath();
  g.fill();
  g.beginPath();
  g.ellipse(195, 300, 42, 60, 0.4, 0, Math.PI * 2);
  g.fill();
  // Skovlformede gevirer med takker.
  for (const side of [-1, 1]) {
    g.beginPath();
    const bx = 205 + side * 30;
    g.moveTo(bx, 255);
    g.quadraticCurveTo(bx + side * 90, 240, bx + side * 140, 150);
    for (let t = 0; t < 5; t++) {
      const px = bx + side * (140 - t * 26);
      g.lineTo(px + side * 8, 120 - (t % 2) * 18);
      g.lineTo(px - side * 6, 165 - t * 4);
    }
    g.quadraticCurveTo(bx + side * 30, 220, bx, 255);
    g.fill();
  }
  // Farvede skår hen over hoved og gevir, som i originalen.
  for (let k = 0; k < 45; k++) {
    g.fillStyle = splash[k % splash.length];
    g.globalAlpha = 0.6 + rnd() * 0.4;
    const x = 110 + rnd() * 240;
    const y = 110 + rnd() * 240;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 70, y + (rnd() - 0.5) * 50);
    g.lineTo(x + (rnd() - 0.5) * 50, y + (rnd() - 0.5) * 70);
    g.closePath();
    g.fill();
  }
  g.globalAlpha = 1;
  // Et par lyse strøg oven på silhuetten.
  for (let k = 0; k < 14; k++) {
    g.strokeStyle = splash[(k * 3) % splash.length];
    g.lineWidth = 3 + rnd() * 6;
    g.beginPath();
    const x = 160 + rnd() * 220;
    const y = 160 + rnd() * 260;
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 80, y + (rnd() - 0.5) * 80);
    g.stroke();
  }
  return canvasTexture(c);
}

// Forsiden af receptionsskranken: navy med "CO:" og et felt af lysende firkanter.
export function deskFrontTexture() {
  const W = 1024;
  const H = 512;
  const [c, g] = makeCanvas(W, H);
  g.fillStyle = CVI.navy;
  g.fillRect(0, 0, W, H);
  const cell = 20;
  for (let y = cell; y < H - cell; y += cell) {
    for (let x = 420; x < W - cell / 2; x += cell) {
      const t = Math.min(1, ((x - 420) / (W - 420)) * 0.9 + (y / H) * 0.4);
      const s = cell * 0.78 * t * t;
      if (s < 1.5) continue;
      g.fillStyle = CVI.cyan;
      g.fillRect(x - s / 2, y - s / 2, s, s);
    }
  }
  const tex = canvasTexture(c);
  withLogo(tex, (img) => {
    g.drawImage(tintedLogo(img, CVI.white, 72, LOGO_CO_WIDTH), 48, 52);
  });
  return tex;
}

// Et figenblad med gennemsigtig baggrund.
export function leafTexture() {
  const [c, g] = makeCanvas(128, 128);
  const grad = g.createLinearGradient(0, 128, 0, 0);
  grad.addColorStop(0, '#2c5123');
  grad.addColorStop(1, '#4d7d33');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(64, 126);
  g.bezierCurveTo(20, 110, 30, 80, 14, 50);
  g.bezierCurveTo(4, 20, 40, 2, 64, 6);
  g.bezierCurveTo(88, 2, 124, 20, 114, 50);
  g.bezierCurveTo(98, 80, 108, 110, 64, 126);
  g.fill();
  g.strokeStyle = 'rgba(190, 220, 150, 0.6)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(64, 126);
  g.lineTo(64, 12);
  g.stroke();
  g.lineWidth = 1.5;
  for (let y = 30; y < 118; y += 16) {
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(64, y + 10);
      g.quadraticCurveTo(64 + side * 20, y + 2, 64 + side * 38, y - 6);
      g.stroke();
    }
  }
  return canvasTexture(c);
}

// --- Byen udenfor ---

// Facadevinduer til skyskraberne: 16 x 16 vinduer, hvor en del er tændt.
// Pixel (0,0) er altid mørk, så tagflader kan pege derhen.
export function windowTexture() {
  const [c, g] = makeCanvas(512, 512);
  const rnd = seededRandom(3);
  g.fillStyle = '#0a1322';
  g.fillRect(0, 0, 512, 512);
  const cell = 32;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const lit = rnd();
      let color;
      if (lit < 0.5) color = `rgba(30, 52, 84, ${0.5 + rnd() * 0.3})`;
      else if (lit < 0.78) color = `rgba(113, 205, 220, ${0.5 + rnd() * 0.5})`;
      else color = `rgba(240, 216, 186, ${0.6 + rnd() * 0.4})`;
      g.fillStyle = color;
      g.fillRect(x * cell + 6, y * cell + 5, cell - 12, cell - 12);
    }
  }
  const tex = canvasTexture(c, { repeat: true });
  tex.anisotropy = 8;
  return tex;
}

// --- Rekvisitter ---

export function clockFaceTexture() {
  const [c, g] = makeCanvas(512, 512);
  const grad = g.createRadialGradient(256, 256, 40, 256, 256, 256);
  grad.addColorStop(0, '#1d3254');
  grad.addColorStop(1, CVI.navy);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(256, 256, 250, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = CVI.white;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const major = i % 5 === 0;
    const r1 = major ? 180 : 205;
    g.lineWidth = major ? 12 : 4;
    g.beginPath();
    g.moveTo(256 + Math.sin(a) * r1, 256 - Math.cos(a) * r1);
    g.lineTo(256 + Math.sin(a) * 224, 256 - Math.cos(a) * 224);
    g.stroke();
  }
  return canvasTexture(c);
}

// Hologram-materiale: kant-glød, scanlinjer og let flimmer. Fader ud under fadeBelow (verdens-y).
export function hologramMaterial(color = CVI.cyan, { opacity = 1, fadeBelow = -1000 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uFadeBelow: { value: fadeBelow },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      varying float vWorldY;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldY = wp.y;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uFadeBelow;
      varying vec3 vNormal;
      varying vec3 vView;
      varying float vWorldY;
      void main() {
        float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.0);
        float scan = 0.65 + 0.35 * sin(vWorldY * 140.0 - uTime * 5.0);
        float flicker = 0.93 + 0.07 * sin(uTime * 41.0) * sin(uTime * 7.0);
        float fade = smoothstep(uFadeBelow, uFadeBelow + 0.5, vWorldY);
        float a = (0.18 + fres * 0.9) * scan * flicker * fade * uOpacity;
        gl_FragColor = vec4(uColor * (0.7 + fres * 0.8), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// Papirlabel til disketterne.
export function diskLabelTexture(text, color) {
  const [c, g] = makeCanvas(256, 160);
  g.fillStyle = '#f4f1e8';
  g.fillRect(0, 0, 256, 160);
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 30);
  g.fillStyle = CVI.navy;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 40;
  do {
    g.font = `700 ${size}px "Segoe UI", Roboto, sans-serif`;
    size -= 2;
  } while (g.measureText(text).width > 236 && size > 18);
  g.fillText(text, 128, 98);
  return canvasTexture(c);
}

// Bogstavklodser, der tilsammen staver CO:PLAY.
export function letterTexture(letter, background, foreground) {
  const [c, g] = makeCanvas(128, 128);
  g.fillStyle = background;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = foreground;
  g.lineWidth = 6;
  g.strokeRect(8, 8, 112, 112);
  g.fillStyle = foreground;
  g.font = '800 88px "Segoe UI", Roboto, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 64, 70);
  return canvasTexture(c);
}

// Én sommerfuglevinge med hængslet langs venstre kant.
export function wingTexture() {
  const [c, g] = makeCanvas(128, 128);
  const grad = g.createRadialGradient(8, 64, 4, 8, 64, 120);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.35, CVI.cyan);
  grad.addColorStop(1, CVI.blue);
  g.fillStyle = grad;
  g.strokeStyle = CVI.navy;
  g.lineWidth = 4;
  for (const [x, y, rx, ry, rot] of [[62, 82, 58, 40, 0.35], [48, 32, 42, 28, -0.25]]) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.fillStyle = CVI.orange;
  for (const [x, y, r] of [[86, 88, 9], [60, 30, 6]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return canvasTexture(c);
}

// Enkel tekst på mørk baggrund, fx skiltet på maskinen.
export function signTexture(text, { width = 512, height = 96, color = CVI.cyan } = {}) {
  const [c, g] = makeCanvas(width, height);
  g.fillStyle = CVI.navy;
  g.fillRect(0, 0, width, height);
  g.fillStyle = color;
  g.font = `700 ${Math.round(height * 0.5)}px "Segoe UI", Roboto, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, width / 2, height / 2 + 2);
  return canvasTexture(c);
}

// Blød rund glød til sprites (lamper, kugler).
export function glowTexture() {
  const [c, g] = makeCanvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return canvasTexture(c);
}

// Lyskegle på en åben cylinder. Lysest i toppen, eller i bunden med invert.
export function beamMaterial(color = CVI.cyan, strength = 0.35, { invert = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uStrength: { value: strength },
      uInvert: { value: invert ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStrength;
      uniform float uInvert;
      varying vec2 vUv;
      void main() {
        float y = mix(vUv.y, 1.0 - vUv.y, uInvert);
        gl_FragColor = vec4(uColor, pow(y, 1.6) * uStrength);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}
