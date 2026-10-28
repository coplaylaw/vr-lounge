import * as THREE from 'three';

// Bagt lys: lyset på gulv, vægge og loft regnes ud én gang, når siden indlæses, og lægges i lightmaps.
// Spots i loftet kaster skygger af møblerne, hjørner og fodlister bliver mørkere, og det koster
// intet, mens oplevelsen kører. Overfladerne tegnes med MeshBasicMaterial + lightMap.

export const LIGHTMAP_MAX = 1.6; // lightmap-værdien 1 svarer til 1,6 gange fuldt lys
export const LIGHTMAP_INTENSITY = Math.PI * LIGHTMAP_MAX; // MeshBasicMaterial deler med pi

const EPS = 1e-3;

function srgb(x) {
  const c = Math.min(1, Math.max(0, x));
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

export class LightBaker {
  constructor() {
    this.lights = [];
    this.occluders = [];
  }

  // Lys med en kegle omkring dir. power styrer, hvor hurtigt lyset aftager væk fra midten.
  light(position, color, intensity, { dir = [0, -1, 0], cutoff = 0.3, power = 2, shadows = true } = {}) {
    const c = new THREE.Color(color);
    this.lights.push({
      x: position[0], y: position[1], z: position[2],
      r: c.r * intensity, g: c.g * intensity, b: c.b * intensity,
      dir, cutoff, power, shadows,
    });
  }

  // Forhindringer, som kaster skygge og giver mørke kanter (ambient occlusion).
  // lo/hi er en omsluttende kasse, så de fleste forhindringer kan springes over hurtigt.
  box(min, max, opacity = 1) {
    this.occluders.push({ type: 'box', min, max, opacity, lo: min, hi: max });
  }

  cylinder(x, z, radius, y0, y1, opacity = 1) {
    this.occluders.push({
      type: 'cyl', x, z, r: radius, y0, y1, opacity, lo: [x - radius, y0, z - radius], hi: [x + radius, y1, z + radius],
    });
  }

  sphere(center, radius, opacity = 0.5) {
    const [x, y, z] = center;
    this.occluders.push({
      type: 'sphere', c: center, r: radius, opacity, lo: [x - radius, y - radius, z - radius], hi: [x + radius, y + radius, z + radius],
    });
  }

  // Hvor meget lys der slipper igennem på strækningen fra p til q (0..1).
  transmittance(px, py, pz, qx, qy, qz) {
    const dx = qx - px;
    const dy = qy - py;
    const dz = qz - pz;
    const x0 = Math.min(px, qx);
    const x1 = Math.max(px, qx);
    const y0 = Math.min(py, qy);
    const y1 = Math.max(py, qy);
    const z0 = Math.min(pz, qz);
    const z1 = Math.max(pz, qz);
    let t = 1;
    for (const o of this.occluders) {
      if (o.lo[0] > x1 || o.hi[0] < x0 || o.lo[1] > y1 || o.hi[1] < y0 || o.lo[2] > z1 || o.hi[2] < z0) continue;
      if (o.type === 'box') {
        // Slab-test på de tre akser. Kaldes millioner af gange, så ingen arrays her.
        let t0 = EPS;
        let t1 = 1 - EPS;
        if (Math.abs(dx) < 1e-9) {
          if (px < o.min[0] || px > o.max[0]) continue;
        } else {
          const ta = (o.min[0] - px) / dx;
          const tb = (o.max[0] - px) / dx;
          t0 = Math.max(t0, Math.min(ta, tb));
          t1 = Math.min(t1, Math.max(ta, tb));
          if (t0 > t1) continue;
        }
        if (Math.abs(dy) < 1e-9) {
          if (py < o.min[1] || py > o.max[1]) continue;
        } else {
          const ta = (o.min[1] - py) / dy;
          const tb = (o.max[1] - py) / dy;
          t0 = Math.max(t0, Math.min(ta, tb));
          t1 = Math.min(t1, Math.max(ta, tb));
          if (t0 > t1) continue;
        }
        if (Math.abs(dz) < 1e-9) {
          if (pz < o.min[2] || pz > o.max[2]) continue;
        } else {
          const ta = (o.min[2] - pz) / dz;
          const tb = (o.max[2] - pz) / dz;
          t0 = Math.max(t0, Math.min(ta, tb));
          t1 = Math.min(t1, Math.max(ta, tb));
          if (t0 > t1) continue;
        }
        t *= 1 - o.opacity;
      } else if (o.type === 'cyl') {
        // Lodret cylinder: først cirklen i xz, så højden.
        const fx = px - o.x;
        const fz = pz - o.z;
        const a = dx * dx + dz * dz;
        const b = 2 * (fx * dx + fz * dz);
        const c = fx * fx + fz * fz - o.r * o.r;
        let t0;
        let t1;
        if (a < 1e-12) {
          if (c > 0) continue;
          t0 = 0;
          t1 = 1;
        } else {
          const disc = b * b - 4 * a * c;
          if (disc <= 0) continue;
          const s = Math.sqrt(disc);
          t0 = (-b - s) / (2 * a);
          t1 = (-b + s) / (2 * a);
        }
        if (Math.abs(dy) > 1e-9) {
          let ya = (o.y0 - py) / dy;
          let yb = (o.y1 - py) / dy;
          if (ya > yb) [ya, yb] = [yb, ya];
          t0 = Math.max(t0, ya);
          t1 = Math.min(t1, yb);
        } else if (py < o.y0 || py > o.y1) continue;
        if (Math.max(t0, EPS) < Math.min(t1, 1 - EPS)) t *= 1 - o.opacity;
      } else {
        // Kugle (bladkroner): blødere jo tættere strålen er på kanten.
        const fx = o.c[0] - px;
        const fy = o.c[1] - py;
        const fz = o.c[2] - pz;
        const len2 = dx * dx + dy * dy + dz * dz;
        const k = Math.min(1 - EPS, Math.max(EPS, (fx * dx + fy * dy + fz * dz) / len2));
        const ex = fx - dx * k;
        const ey = fy - dy * k;
        const ez = fz - dz * k;
        const dist = Math.sqrt(ex * ex + ey * ey + ez * ez);
        if (dist < o.r) t *= 1 - o.opacity * (1 - dist / o.r);
      }
      if (t <= 0.001) return 0;
    }
    return t;
  }

  // Afstand fra et punkt til en forhindring, til de bløde mørke kanter.
  static distance(o, x, y, z) {
    if (o.type === 'box') {
      const dx = Math.max(o.min[0] - x, 0, x - o.max[0]);
      const dy = Math.max(o.min[1] - y, 0, y - o.max[1]);
      const dz = Math.max(o.min[2] - z, 0, z - o.max[2]);
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    if (o.type === 'cyl') {
      const dr = Math.max(0, Math.hypot(x - o.x, z - o.z) - o.r);
      const dy = Math.max(o.y0 - y, 0, y - o.y1);
      return Math.hypot(dr, dy);
    }
    return Math.max(0, Math.hypot(x - o.c[0], y - o.c[1], z - o.c[2]) - o.r);
  }

  // Lyset på én flade. point(u, v) giver punktet på fladen og dens normal for u, v i 0..1.
  // ambient er det indirekte lys, ao(x, y, z) kan gøre det mørkere ved kanter og hjørner.
  bake({ width, height, point, normal, ambient, ao = () => 1 }) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    const img = g.createImageData(width, height);
    const [nx, ny, nz] = normal;
    const amb = new THREE.Color(ambient);
    const p = [0, 0, 0];
    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        // Lærredets øverste række er v = 1 (CanvasTexture vendes).
        point((i + 0.5) / width, 1 - (j + 0.5) / height, p);
        const [x, y, z] = p;
        let occ = ao(x, y, z);
        for (const o of this.occluders) {
          const d = LightBaker.distance(o, x, y, z);
          if (d < 0.9) occ *= 1 - 0.55 * o.opacity * Math.exp(-d / 0.25);
        }
        let r = amb.r * occ;
        let gg = amb.g * occ;
        let b = amb.b * occ;
        // Lidt væk fra fladen, så den ikke skygger for sig selv.
        const sx = x + nx * 0.01;
        const sy = y + ny * 0.01;
        const sz = z + nz * 0.01;
        for (const L of this.lights) {
          const lx = L.x - sx;
          const ly = L.y - sy;
          const lz = L.z - sz;
          const d2 = lx * lx + ly * ly + lz * lz;
          const d = Math.sqrt(d2);
          const cosSurf = (lx * nx + ly * ny + lz * nz) / d;
          if (cosSurf <= 0) continue;
          const cosBeam = -(lx * L.dir[0] + ly * L.dir[1] + lz * L.dir[2]) / d;
          if (cosBeam <= L.cutoff) continue;
          const edge = Math.min(1, (cosBeam - L.cutoff) / 0.25);
          let e = (cosSurf * Math.pow(cosBeam, L.power) * edge * edge) / (d2 + 0.05);
          if (e < 0.002) continue;
          if (L.shadows) e *= this.transmittance(sx, sy, sz, L.x, L.y, L.z);
          r += L.r * e;
          gg += L.g * e;
          b += L.b * e;
        }
        const k = (j * width + i) * 4;
        img.data[k] = srgb(r / LIGHTMAP_MAX) * 255;
        img.data[k + 1] = srgb(gg / LIGHTMAP_MAX) * 255;
        img.data[k + 2] = srgb(b / LIGHTMAP_MAX) * 255;
        img.data[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
}

// Materiale til en flade med bagt lys.
export function bakedMaterial(lightMap, options = {}) {
  return new THREE.MeshBasicMaterial({ ...options, lightMap, lightMapIntensity: LIGHTMAP_INTENSITY });
}
