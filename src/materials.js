import * as THREE from 'three';

// Deterministisk tilfældighed, så byen ser ens ud hver gang.
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

// Mørke mursten som på CO:PLAY-huset. Én tekstur dækker 1,2 x 0,6 m.
export function brickTexture() {
  const [c, g] = makeCanvas(512, 256);
  const rnd = seededRandom(7);
  g.fillStyle = '#1a1512';
  g.fillRect(0, 0, 512, 256);
  const rows = 8;
  const bh = 256 / rows;
  const bw = 512 / 4;
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 ? bw / 2 : 0;
    for (let i = -1; i < 5; i++) {
      const v = 40 + rnd() * 30;
      g.fillStyle = `rgb(${v + 18}, ${v * 0.75}, ${v * 0.6})`;
      g.fillRect(i * bw + offset + 3, r * bh + 3, bw - 6, bh - 6);
    }
  }
  const tex = canvasTexture(c, { repeat: true });
  tex.repeat.set(1 / 1.2, 1 / 0.6);
  return tex;
}

export function woodTexture() {
  const [c, g] = makeCanvas(256, 512);
  const rnd = seededRandom(11);
  for (let i = 0; i < 8; i++) {
    const v = 26 + rnd() * 14;
    g.fillStyle = `rgb(${v + 10}, ${v * 0.7}, ${v * 0.5})`;
    g.fillRect(i * 32, 0, 32, 512);
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(i * 32, 0, 2, 512);
    g.fillRect(i * 32, rnd() * 512, 32, 2);
  }
  const tex = canvasTexture(c, { repeat: true });
  tex.repeat.set(1 / 1.6, 1 / 3.2);
  return tex;
}

// Facadevinduer til skyskraberne: 16 x 16 vinduer, hvor en del er tændt.
// Pixel (0,0) er altid mørk, så tagflader kan pege derhen.
export function windowTexture() {
  const [c, g] = makeCanvas(512, 512);
  const rnd = seededRandom(3);
  g.fillStyle = '#060c18';
  g.fillRect(0, 0, 512, 512);
  const cell = 32;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const lit = rnd();
      let color;
      if (lit < 0.55) color = `rgba(20, 40, 70, ${0.5 + rnd() * 0.3})`;
      else if (lit < 0.8) color = `rgba(120, 200, 255, ${0.5 + rnd() * 0.5})`;
      else color = `rgba(255, 200, 130, ${0.6 + rnd() * 0.4})`;
      g.fillStyle = color;
      g.fillRect(x * cell + 6, y * cell + 5, cell - 12, cell - 12);
    }
  }
  const tex = canvasTexture(c, { repeat: true });
  tex.anisotropy = 8;
  return tex;
}

// Neonskilt med glød. Bruges både ude i byen og inde i loungen.
export function neonTexture(text, color = '#36d6ff') {
  const [c, g] = makeCanvas(1024, 256);
  g.font = 'bold 170px "Segoe UI", Roboto, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.strokeStyle = color;
  g.shadowColor = color;
  for (const [blur, width] of [[60, 14], [30, 10], [12, 7]]) {
    g.shadowBlur = blur;
    g.lineWidth = width;
    g.strokeText(text, 512, 132);
  }
  g.shadowBlur = 0;
  g.lineWidth = 3;
  g.strokeStyle = '#eaffff';
  g.strokeText(text, 512, 132);
  return canvasTexture(c);
}

export function clockFaceTexture() {
  const [c, g] = makeCanvas(512, 512);
  const grad = g.createRadialGradient(256, 256, 40, 256, 256, 256);
  grad.addColorStop(0, '#12305a');
  grad.addColorStop(1, '#050d1c');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(256, 256, 250, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#36d6ff';
  g.shadowColor = '#36d6ff';
  g.shadowBlur = 20;
  g.lineWidth = 8;
  g.beginPath();
  g.arc(256, 256, 235, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const major = i % 5 === 0;
    const r1 = major ? 185 : 205;
    g.lineWidth = major ? 10 : 3;
    g.beginPath();
    g.moveTo(256 + Math.sin(a) * r1, 256 - Math.cos(a) * r1);
    g.lineTo(256 + Math.sin(a) * 220, 256 - Math.cos(a) * 220);
    g.stroke();
  }
  return canvasTexture(c);
}

// Lille tekstskilt, fx navne over kuglerne.
export function labelTexture(text, color) {
  const [c, g] = makeCanvas(512, 128);
  g.fillStyle = 'rgba(5, 11, 24, 0.7)';
  g.beginPath();
  g.roundRect(4, 14, 504, 100, 50);
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.stroke();
  g.fillStyle = '#ffffff';
  g.font = '600 56px "Segoe UI", Roboto, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  return canvasTexture(c);
}

// Hologram-materiale: kant-glød, scanlinjer og let flimmer. Fader ud under fadeBelow (verdens-y).
export function hologramMaterial(color = '#36d6ff', { opacity = 1, fadeBelow = -1000 } = {}) {
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
  g.fillStyle = '#0a1424';
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
  grad.addColorStop(0, '#eafcff');
  grad.addColorStop(0.35, '#36d6ff');
  grad.addColorStop(1, '#2a3f9e');
  g.fillStyle = grad;
  g.strokeStyle = '#0a1424';
  g.lineWidth = 4;
  for (const [x, y, rx, ry, rot] of [[62, 82, 58, 40, 0.35], [48, 32, 42, 28, -0.25]]) {
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.fillStyle = 'rgba(255, 180, 94, 0.9)';
  for (const [x, y, r] of [[86, 88, 9], [60, 30, 6]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return canvasTexture(c);
}

// Enkel tekst på mørk baggrund, fx skiltet på maskinen.
export function signTexture(text, { width = 512, height = 96, color = '#36d6ff' } = {}) {
  const [c, g] = makeCanvas(width, height);
  g.fillStyle = '#0a1424';
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
export function beamMaterial(color = '#36d6ff', strength = 0.35, { invert = false } = {}) {
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
