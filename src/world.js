import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  seededRandom, brickTexture, woodTexture, windowTexture, neonTexture,
  clockFaceTexture, glowTexture, hologramMaterial, beamMaterial,
} from './materials.js';

// Gæsten sidder i origo og kigger mod -Z. Loungen er et ottekantet rum øverst i urtårnet.
const R = 4; // afstand fra centrum til væggene
const WALL_H = 3.6;
const THICK = 0.3;
const SEG_W = 2 * R * Math.tan(Math.PI / 8) + 0.02;
const GROUND = -32; // gadeniveau under tårnet

const WIN = { halfWidth: 0.9, sill: 0.75, spring: 2.2 }; // buet vindue som på CO:PLAY-huset

const CYAN = 0x36d6ff;
const AMBER = 0xffb45e;

function archPath(path) {
  const { halfWidth: hw, sill, spring } = WIN;
  path.moveTo(-hw, sill);
  path.lineTo(hw, sill);
  path.lineTo(hw, spring);
  path.absarc(0, spring, hw, 0, Math.PI, false);
  path.lineTo(-hw, sill);
  return path;
}

export function buildWorld(stage) {
  const animated = [];
  const holoMaterials = [];
  const glowTex = glowTexture();

  stage.add(new THREE.HemisphereLight(0x5a7cc0, 0x1a1008, 1.1));
  for (const x of [-2, 2]) {
    const lamp = new THREE.PointLight(0xffb066, 6);
    lamp.position.set(x, 2.7, 1.4);
    stage.add(lamp);
  }

  buildRoom(stage, glowTex, animated);
  buildCity(stage, animated, holoMaterials);
  buildSky(stage);

  return {
    update(time, dt) {
      for (const m of holoMaterials) m.uniforms.uTime.value = time;
      for (const fn of animated) fn(time, dt);
    },
  };
}

function buildRoom(stage, glowTex, animated) {
  const room = new THREE.Group();
  stage.add(room);

  const brick = new THREE.MeshLambertMaterial({ map: brickTexture() });
  const frame = new THREE.MeshLambertMaterial({ color: 0x2a1d14 });
  const glass = new THREE.MeshBasicMaterial({
    color: 0x9fd8ff, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide,
  });
  const cyanLine = new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false });
  const warmLamp = new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false });

  // Vægsegmenter: 0 = forfra, positive vinkler går mod venstre.
  const layout = ['window', 'clock', 'window', 'wall', 'sign', 'wall', 'window', 'window'];
  layout.forEach((kind, i) => {
    const seg = new THREE.Group();
    seg.rotation.y = (i * Math.PI) / 4;
    room.add(seg);

    const shape = new THREE.Shape();
    shape.moveTo(-SEG_W / 2, 0);
    shape.lineTo(SEG_W / 2, 0);
    shape.lineTo(SEG_W / 2, WALL_H);
    shape.lineTo(-SEG_W / 2, WALL_H);
    shape.lineTo(-SEG_W / 2, 0);
    if (kind === 'window') shape.holes.push(archPath(new THREE.Path()));
    const wall = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: THICK, bevelEnabled: false, curveSegments: 20 }),
      brick,
    );
    wall.position.z = -R - THICK;
    seg.add(wall);

    if (kind === 'window') {
      const zMid = -R - THICK / 2;
      const top = WIN.spring + WIN.halfWidth;
      const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.05, top - WIN.sill, 0.06), frame);
      vertical.position.set(0, (top + WIN.sill) / 2, zMid);
      seg.add(vertical);
      for (const y of [1.45, WIN.spring]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(WIN.halfWidth * 2, 0.05, 0.06), frame);
        bar.position.set(0, y, zMid);
        seg.add(bar);
      }
      const sill = new THREE.Mesh(new THREE.BoxGeometry(WIN.halfWidth * 2 + 0.2, 0.05, 0.3), frame);
      sill.position.set(0, WIN.sill, -R + 0.08);
      seg.add(sill);
      const pane = new THREE.Mesh(new THREE.ShapeGeometry(archPath(new THREE.Shape()), 20), glass);
      pane.position.z = zMid;
      seg.add(pane);
    }

    if (kind === 'clock') buildClock(seg, cyanLine, animated);

    if (kind === 'sign') {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 0.65),
        new THREE.MeshBasicMaterial({ map: neonTexture('CO:PLAY'), transparent: true, toneMapped: false }),
      );
      sign.position.set(0, 2.5, -R + 0.03);
      seg.add(sign);
    }

    // Væglamper på de lukkede vægge og mellem vinduerne.
    if (kind !== 'window') {
      for (const x of kind === 'clock' ? [] : [-0.95, 0.95]) {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.06), warmLamp);
        lamp.position.set(x, 1.9, -R + 0.04);
        seg.add(lamp);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTex, color: 0xffb066, transparent: true, opacity: 0.5,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        glow.scale.set(0.9, 0.9, 1);
        glow.position.set(x, 1.9, -R + 0.1);
        seg.add(glow);
      }
    }
  });

  // Gulv og loft som ottekanter, der flugter med væggenes yderside.
  const octRadius = (R + THICK) / Math.cos(Math.PI / 8);
  const floorTex = woodTexture();
  floorTex.repeat.set(6, 3);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(octRadius, 8, Math.PI / 8),
    new THREE.MeshLambertMaterial({ map: floorTex }),
  );
  floor.rotation.x = -Math.PI / 2;
  room.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.CircleGeometry(octRadius, 8, Math.PI / 8),
    new THREE.MeshLambertMaterial({ color: 0x4a362a }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = WALL_H;
  room.add(ceiling);

  const ceilingRing = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.03, 8, 96), cyanLine);
  ceilingRing.rotation.x = Math.PI / 2;
  ceilingRing.position.y = WALL_H - 0.12;
  room.add(ceilingRing);

  for (const [inner, color] of [[1.35, CYAN], [3.2, AMBER]]) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(inner, inner + 0.04, 96),
      new THREE.MeshBasicMaterial({ color, toneMapped: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.004;
    room.add(ring);
  }

  // Bænke under sidevinduerne og et par planter bagved.
  const fabric = new THREE.MeshLambertMaterial({ color: 0x1b2a4a });
  for (const side of [-1, 1]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.42, 1.8), fabric);
    bench.position.set(side * 3.45, 0.21, 0);
    room.add(bench);
    const piping = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1.8), cyanLine);
    piping.position.set(side * 3.15, 0.42, 0);
    room.add(piping);

    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.18, 0.5, 16),
      new THREE.MeshLambertMaterial({ color: 0x15171c }),
    );
    pot.position.set(side * 2.6, 0.25, 2.6);
    room.add(pot);
    const leaves = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.45, 1),
      new THREE.MeshLambertMaterial({ color: 0x1f4a2c, flatShading: true }),
    );
    leaves.position.set(side * 2.6, 0.85, 2.6);
    room.add(leaves);
  }
}

// Urskive der viser den rigtige tid, ligesom uret på tårnet.
function buildClock(seg, cyanLine, animated) {
  const clock = new THREE.Group();
  clock.position.set(0, 2.0, -R + 0.02);
  seg.add(clock);

  clock.add(new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 64),
    new THREE.MeshBasicMaterial({ map: clockFaceTexture(), toneMapped: false }),
  ));
  clock.add(new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.025, 8, 96), cyanLine));

  const hand = (length, width, material) => {
    const geo = new THREE.BoxGeometry(width, length, 0.01);
    geo.translate(0, length / 2 - 0.06, 0);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.z = 0.02;
    clock.add(mesh);
    return mesh;
  };
  const hourHand = hand(0.48, 0.045, cyanLine);
  const minuteHand = hand(0.72, 0.03, cyanLine);
  const secondHand = hand(0.78, 0.012, new THREE.MeshBasicMaterial({ color: AMBER, toneMapped: false }));
  secondHand.position.z = 0.03;

  animated.push(() => {
    const now = new Date();
    const s = now.getSeconds() + now.getMilliseconds() / 1000;
    const m = now.getMinutes() + s / 60;
    const h = (now.getHours() % 12) + m / 60;
    secondHand.rotation.z = -(s / 60) * Math.PI * 2;
    minuteHand.rotation.z = -(m / 60) * Math.PI * 2;
    hourHand.rotation.z = -(h / 12) * Math.PI * 2;
  });
}

// Skyskrabernes facader: UV'erne skaleres til meter, så vinduerne får samme størrelse overalt.
const TEX_W = 32; // meter facade pr. tekstur (16 vinduer à 2 m)
const TEX_H = 48; // 16 etager à 3 m

function buildingGeometry(w, h, d, rnd) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const ou = Math.floor(rnd() * 16) / 16;
  const ov = Math.floor(rnd() * 16) / 16;
  // Fladernes rækkefølge i BoxGeometry: +x, -x, +y, -y, +z, -z (4 hjørner hver).
  const spans = [[d, h], [d, h], null, null, [w, h], [w, h]];
  spans.forEach((span, face) => {
    for (let k = face * 4; k < face * 4 + 4; k++) {
      if (!span) uv.setXY(k, 0.001, 0.001); // tag: peg på en mørk pixel
      else uv.setXY(k, ou + (uv.getX(k) * span[0]) / TEX_W, ov + (uv.getY(k) * span[1]) / TEX_H);
    }
  });
  return geo;
}

function paint(geo, color) {
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function buildCity(stage, animated, holoMaterials) {
  const rnd = seededRandom(42);
  const winTex = windowTexture();
  const buildings = [];
  const strips = [];
  const beacons = [];
  const dark = new THREE.Color(0.6, 0.6, 0.6);

  const addBuilding = (x, z, w, d, h, tint) => {
    const geo = buildingGeometry(w, h, d, rnd);
    geo.translate(x, GROUND + h / 2, z);
    buildings.push(paint(geo, tint));
    if (h > 110) {
      const spire = new THREE.BoxGeometry(0.5, 14, 0.5);
      spire.translate(x, GROUND + h + 7, z);
      spire.attributes.uv.array.fill(0.001); // hele spiret mørkt
      buildings.push(paint(spire, dark));
      beacons.push(x, GROUND + h + 14.5, z);
    }
    if (rnd() < 0.3) {
      const strip = new THREE.BoxGeometry(0.5, h * 0.92, 0.5);
      strip.translate(x + w / 2, GROUND + h * 0.46, z + d / 2);
      strips.push(strip);
    }
  };

  // Første ring af huse starter uden for svævetogets bane.
  for (let i = 0; i < 260; i++) {
    const angle = rnd() * Math.PI * 2;
    const dist = 62 + Math.pow(rnd(), 0.7) * 360;
    const x = Math.sin(angle) * dist;
    const z = Math.cos(angle) * dist;
    const near = dist < 110;
    const h = near ? 12 + rnd() * 34 : 30 + Math.pow(rnd(), 1.5) * 260;
    const t = 0.55 + rnd() * 0.45;
    addBuilding(x, z, 10 + rnd() * 22, 10 + rnd() * 22, h, new THREE.Color(t * 0.9, t * 0.95, t));
  }

  // Nabohuset med det store CO:PLAY-skilt, set gennem vinduet skråt til højre.
  const signSpot = new THREE.Vector3(21, 0, -21);
  addBuilding(signSpot.x, signSpot.z, 11, 11, 32, new THREE.Color(0.5, 0.5, 0.55));

  stage.add(new THREE.Mesh(
    mergeGeometries(buildings),
    new THREE.MeshBasicMaterial({ map: winTex, vertexColors: true }),
  ));
  stage.add(new THREE.Mesh(
    mergeGeometries(strips),
    new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false }),
  ));

  const sign = new THREE.Group();
  sign.position.set(signSpot.x, GROUND + 32, signSpot.z);
  sign.rotation.y = Math.atan2(-signSpot.x, -signSpot.z);
  const neon = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 3),
    new THREE.MeshBasicMaterial({
      map: neonTexture('CO:PLAY'), transparent: true, depthWrite: false, toneMapped: false,
    }),
  );
  neon.position.y = 3.2;
  sign.add(neon);
  for (const x of [-4, 0, 4]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 0.2), new THREE.MeshBasicMaterial({ color: 0x0b1424 }));
    strut.position.set(x, 1.1, -0.1);
    sign.add(strut);
  }
  stage.add(sign);

  const beaconMat = new THREE.PointsMaterial({
    color: 0xff3344, size: 4, sizeAttenuation: false, transparent: true,
  });
  const beaconGeo = new THREE.BufferGeometry();
  beaconGeo.setAttribute('position', new THREE.Float32BufferAttribute(beacons, 3));
  stage.add(new THREE.Points(beaconGeo, beaconMat));
  animated.push((time) => {
    beaconMat.opacity = Math.sin(time * 2.4) > 0.2 ? 1 : 0.15;
  });

  buildLandmark(stage, winTex);
  buildMonorail(stage, animated);
  buildDrones(stage, animated, holoMaterials);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshBasicMaterial({ color: 0x060d1a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND;
  stage.add(ground);
}

// Det kugleformede tårn fra billedet.
function buildLandmark(stage, winTex) {
  const height = 180;
  const radius = 22;
  const profile = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    profile.push(new THREE.Vector2(Math.max(radius * Math.sin(Math.PI * (0.25 + 0.75 * t)), 0.01), t * height));
  }
  const tex = winTex.clone();
  tex.repeat.set(6, 4);
  const tower = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 40),
    new THREE.MeshBasicMaterial({ map: tex, color: 0x9ec9ff }),
  );
  // Ses gennem vinduet til venstre.
  const spot = new THREE.Vector3(-180, GROUND, -15);
  tower.position.copy(spot);
  stage.add(tower);

  const ringMat = new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false });
  for (const t of [0.2, 0.45, 0.7]) {
    const r = radius * Math.sin(Math.PI * (0.25 + 0.75 * t)) + 0.3;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.35, 6, 64), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(spot.x, GROUND + t * height, spot.z);
    stage.add(ring);
  }
}

// Svævetog i et glasrør, der kører rundt om tårnet i gæstens øjenhøjde.
function buildMonorail(stage, animated) {
  const points = [];
  for (let k = 0; k < 10; k++) {
    const angle = (k / 10) * Math.PI * 2;
    const r = 44 + 10 * Math.sin(k * 1.7);
    points.push(new THREE.Vector3(Math.sin(angle) * r, -2 + 2.5 * Math.sin(k * 2.3), Math.cos(angle) * r));
  }
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
  const shifted = (dy) => new THREE.CatmullRomCurve3(points.map((p) => p.clone().setY(p.y + dy)), true, 'centripetal');

  const trackMat = new THREE.MeshBasicMaterial({ color: 0x0b1424 });
  stage.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 300, 0.7, 6, true), trackMat));
  stage.add(new THREE.Mesh(
    new THREE.TubeGeometry(shifted(0.8), 300, 0.15, 5, true),
    new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false }),
  ));
  stage.add(new THREE.Mesh(
    new THREE.TubeGeometry(shifted(2.2), 300, 2.6, 12, true),
    new THREE.MeshBasicMaterial({
      color: 0x6fb8ff, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide,
    }),
  ));

  const pillars = [];
  for (let k = 0; k < 24; k++) {
    const p = curve.getPointAt(k / 24);
    const h = p.y - GROUND;
    const geo = new THREE.CylinderGeometry(0.8, 1.2, h, 8);
    geo.translate(p.x, GROUND + h / 2, p.z);
    pillars.push(geo);
  }
  stage.add(new THREE.Mesh(mergeGeometries(pillars), trackMat));

  const bodyMat = new THREE.MeshBasicMaterial({ color: 0x1a2b45 });
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false });
  const cars = [];
  for (let i = 0; i < 5; i++) {
    const car = new THREE.Group();
    car.add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 9), bodyMat));
    const windows = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.7, 8.4), windowMat);
    windows.position.y = 0.3;
    car.add(windows);
    stage.add(car);
    cars.push(car);
  }
  const length = curve.getLength();
  const tmp = new THREE.Vector3();
  animated.push((time) => {
    const head = (time * 9) / length; // 9 m/s
    cars.forEach((car, i) => {
      const u = (((head - (i * 9.6) / length) % 1) + 1) % 1;
      curve.getPointAt(u, car.position);
      car.position.y += 1.6;
      curve.getPointAt((u + 0.002) % 1, tmp);
      tmp.y += 1.6;
      car.lookAt(tmp);
    });
  });
}

// Svævende kugler med lyskegler, som på billedet.
function buildDrones(stage, animated, holoMaterials) {
  // Placeret så hver kugle kan ses gennem et af vinduerne.
  const spots = [
    [-70, 25, 0, 4],
    [50, 30, -50, 5],
    [-6, 30, -90, 4.5],
    [75, 22, 8, 4],
  ];
  const body = new THREE.MeshLambertMaterial({ color: 0x0d1830 });
  spots.forEach(([x, y, z, r], i) => {
    const drone = new THREE.Group();
    drone.position.set(x, y, z);
    drone.add(new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), body));
    const shellMat = hologramMaterial('#36d6ff', { opacity: 0.6 });
    holoMaterials.push(shellMat);
    drone.add(new THREE.Mesh(new THREE.SphereGeometry(r * 1.04, 32, 16), shellMat));
    const beamLength = 40;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.2, r * 2.2, beamLength, 24, 1, true),
      beamMaterial('#36d6ff', 0.16),
    );
    beam.position.y = -beamLength / 2 - r * 0.6;
    drone.add(beam);
    stage.add(drone);
    animated.push((time) => {
      drone.position.y = y + Math.sin(time * 0.4 + i * 1.7) * 1.5;
    });
  });
}

function buildSky(stage) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          float h = smoothstep(0.0, 0.6, vDir.y);
          vec3 horizon = vec3(0.051, 0.114, 0.227);
          vec3 zenith = vec3(0.008, 0.016, 0.043);
          gl_FragColor = vec4(mix(horizon, zenith, h), 1.0);
        }
      `,
    }),
  );
  stage.add(sky);

  const rnd = seededRandom(99);
  const stars = [];
  for (let i = 0; i < 600; i++) {
    const theta = rnd() * Math.PI * 2;
    const y = 0.15 + rnd() * 0.85;
    const r = Math.sqrt(1 - y * y);
    stars.push(Math.cos(theta) * r * 1400, y * 1400, Math.sin(theta) * r * 1400);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
  stage.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0x9fbfff, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0.6, fog: false,
  })));
}
