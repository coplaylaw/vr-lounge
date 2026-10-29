import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CANNON } from './physics.js';
import { CVI } from './palette.js';
import { LightBaker, bakedMaterial, withSwitchedLight } from './bake.js';
import { DESK, DESK_TOP, PRINTER } from './desk.js';
import {
  seededRandom, windowTexture, logoNeonTexture, clockFaceTexture, glowTexture, hologramMaterial, beamMaterial,
  floorTexture, plasterTexture, columnTexture, ceilingTexture, ductTexture, rugTexture, curtainTexture,
  paintingTexture, deskFrontTexture, leafTexture,
} from './materials.js';

// Gæsten sidder i origo og kigger mod -Z. Rummet er bygget over CO:PLAYs reception:
// vinduesvæg foran, spartlet væg med neonskilt til venstre, skranken til højre og et gardin bagved.
export const ROOM = { minX: -4.6, maxX: 4.6, minZ: -4.2, maxZ: 4.4, height: 3.1 };
const THICK = 0.3;
const WIN = { halfWidth: 0.65, sill: 0.85, top: 2.75 };
const GROUND = -32; // gadeniveau langt under receptionen

export const SKY_HORIZON = '#35609a';

const ONE = new THREE.Vector3(1, 1, 1);
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
// Placering i rummet: position og drejning (først om y, så om x).
function at(x, y, z, ry = 0, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ');
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e).clone(), ONE);
}

// Samler de faste dele pr. materiale og fletter dem til én mesh hver, så Quest 2 får færre draw calls.
class Kit {
  constructor() {
    this.parts = new Map();
  }

  add(geometry, material, matrix) {
    const geo = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geo.clearGroups();
    if (matrix) geo.applyMatrix4(matrix);
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material).push(geo);
  }

  build(parent) {
    for (const [material, geos] of this.parts) parent.add(new THREE.Mesh(mergeGeometries(geos), material));
  }
}

function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return geo;
}

export function buildWorld(stage, physics) {
  const animated = [];
  const holoMaterials = [];
  const glowTex = glowTexture();

  // Gulv, vægge og loft har bagt lys (se bake.js). Disse lys giver møbler, robot og ting form:
  // lyst ovenfra fra spotsene, mørkere på undersiden.
  stage.add(new THREE.HemisphereLight(0xfff6ec, 0x5a524b, 1.0));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.7);
  key.position.set(0.6, 4, 1.0);
  stage.add(key);

  physics.addRoom(ROOM);
  const props = buildRoom(stage, physics, glowTex, animated);
  const trainCars = buildCity(stage, animated, holoMaterials);
  buildSky(stage);

  return {
    trainCars, // svævetogets vogne, til lyden når toget kører forbi
    props, // de ting i rummet, der reagerer på at blive ramt (se props.js)
    update(time, dt) {
      for (const m of holoMaterials) m.uniforms.uTime.value = time;
      for (const fn of animated) fn(time, dt);
    },
  };
}

function buildRoom(stage, physics, glowTex, animated) {
  const { minX, maxX, minZ, maxZ, height: H } = ROOM;
  const room = new THREE.Group();
  stage.add(room);
  const kit = new Kit();
  const light = new LightBaker();

  const M = {
    wall: new THREE.MeshLambertMaterial({ color: 0xf1f0ec }),
    trim: new THREE.MeshLambertMaterial({ color: 0xfafafa }),
    alu: new THREE.MeshLambertMaterial({ color: 0xaeb4ba }),
    navy: new THREE.MeshLambertMaterial({ color: CVI.navy }),
    black: new THREE.MeshPhongMaterial({ color: 0x1b1c1f, specular: 0x333333, shininess: 30, side: THREE.DoubleSide }),
    blackMatte: new THREE.MeshLambertMaterial({ color: 0x18191b }),
    pot: new THREE.MeshLambertMaterial({ color: 0x45413c }),
    bark: new THREE.MeshLambertMaterial({ color: 0x6b5a45 }),
    light: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    warm: new THREE.MeshBasicMaterial({ color: 0xfff1d6 }),
    glass: new THREE.MeshBasicMaterial({
      color: 0xcfe6ee, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide,
    }),
  };

  // --- Vægge ---

  // Væg med vinduesåbninger. Lokalt: x langs væggen, indersiden ved z = 0, tykkelsen bagud.
  const windowWall = (length, centers, matrix, material) => {
    const shape = new THREE.Shape();
    shape.moveTo(-length / 2, 0);
    shape.lineTo(length / 2, 0);
    shape.lineTo(length / 2, H);
    shape.lineTo(-length / 2, H);
    shape.lineTo(-length / 2, 0);
    for (const c of centers) {
      const hole = new THREE.Path();
      hole.moveTo(c - WIN.halfWidth, WIN.sill);
      hole.lineTo(c + WIN.halfWidth, WIN.sill);
      hole.lineTo(c + WIN.halfWidth, WIN.top);
      hole.lineTo(c - WIN.halfWidth, WIN.top);
      hole.lineTo(c - WIN.halfWidth, WIN.sill);
      shape.holes.push(hole);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: THICK, bevelEnabled: false });
    geo.translate(0, 0, -THICK);
    const wall = new THREE.Mesh(geo, material);
    wall.applyMatrix4(matrix);
    room.add(wall);

    // Hvide sprosser: to fag og tre rækker ruder, som de gamle vinduer i huset.
    const zMid = -THICK * 0.6;
    const span = WIN.top - WIN.sill;
    for (const c of centers) {
      const part = (w, h, x, y) => kit.add(new THREE.BoxGeometry(w, h, 0.07), M.trim, matrix.clone().multiply(at(x, y, zMid)));
      part(0.07, span, c - WIN.halfWidth + 0.035, WIN.sill + span / 2);
      part(0.07, span, c + WIN.halfWidth - 0.035, WIN.sill + span / 2);
      part(0.05, span, c, WIN.sill + span / 2);
      part(WIN.halfWidth * 2, 0.07, c, WIN.top - 0.035);
      part(WIN.halfWidth * 2, 0.08, c, WIN.sill + 0.04);
      for (const y of [WIN.sill + 0.85, WIN.top - 0.5]) part(WIN.halfWidth * 2, 0.045, c, y);
      kit.add(new THREE.BoxGeometry(WIN.halfWidth * 2 + 0.1, 0.03, 0.2), M.trim, matrix.clone().multiply(at(c, WIN.sill, -0.08)));
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(WIN.halfWidth * 2, span), M.glass);
      pane.applyMatrix4(matrix.clone().multiply(at(c, WIN.sill + span / 2, zMid - 0.02)));
      room.add(pane);
      // Svagt blåt skumringslys ind ad vinduet.
      const p = new THREE.Vector3(c, 1.8, -0.4).applyMatrix4(matrix);
      const d = new THREE.Vector3(0, 0, 1).transformDirection(matrix);
      light.light(p.toArray(), 0x8fa9d6, 0.35, { dir: d.toArray(), cutoff: 0, power: 1, shadows: false });
    }
  };

  const width = maxX - minX;
  const depth = maxZ - minZ;
  const wallColor = 0xf1f0ec;
  const frontWallMat = bakedMaterial(null, { color: wallColor });
  windowWall(width, [-3, 0, 3], at(0, 0, minZ), frontWallMat);
  // Lokal x er verdens z regnet fra væggens midte.
  // Vinduerne sidder på hver side af skranken, så uret kan hænge på den hvide væg bag den.
  const rightLength = depth;
  const rightMid = (minZ + maxZ) / 2;
  const rightWallMat = bakedMaterial(null, { color: wallColor });
  windowWall(rightLength, [-3.0 - rightMid, 0.0 - rightMid], at(maxX, 0, rightMid, -Math.PI / 2), rightWallMat);
  buildClock(room, at(maxX - 0.02, 2.0, -1.5, -Math.PI / 2), animated);

  // Spartlet væg til venstre med neonskiltet.
  const plaster = plasterTexture();
  plaster.repeat.set(depth / 2.2, H / 2.2);
  const leftWallMat = bakedMaterial(null, { map: plaster });
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(depth, H), leftWallMat);
  leftWall.position.set(minX, H / 2, (minZ + maxZ) / 2);
  leftWall.rotation.y = Math.PI / 2;
  room.add(leftWall);

  const neon = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.65),
    new THREE.MeshBasicMaterial({ map: logoNeonTexture(), transparent: true, depthWrite: false, toneMapped: false }),
  );
  neon.position.set(minX + 0.03, 2.15, -1.0);
  neon.rotation.y = Math.PI / 2;
  room.add(neon);
  physics.addStatic(new CANNON.Box(new CANNON.Vec3(0.04, 0.3, 1.25)), { x: minX + 0.04, y: 2.15, z: -1.0 }, null, 'neon');

  // --- Gulv og loft ---

  const fullDepth = depth;
  const floorTex = floorTexture();
  floorTex.repeat.set(width / 1.4, fullDepth / 1.4);
  const floorMat = bakedMaterial(null, { map: floorTex });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, fullDepth), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, minZ + fullDepth / 2);
  room.add(floor);

  const RUG = { x: 0, z: -0.5, w: 3.6, d: 3.0 };
  const rugMat = bakedMaterial(null, { map: rugTexture() });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(RUG.w, RUG.d), rugMat);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(RUG.x, 0.006, RUG.z);
  room.add(rug);

  const ceilTex = ceilingTexture();
  ceilTex.repeat.set(width / 0.6, fullDepth / 0.6);
  const ceilingMat = bakedMaterial(null, { map: ceilTex });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, fullDepth), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, H, minZ + fullDepth / 2);
  room.add(ceiling);

  // Indbyggede spots i loftet. Rækken ved vinduerne er svagere, fordi den sidder tæt på væggen.
  const spot = (x, z, intensity) => {
    kit.add(new THREE.CircleGeometry(0.075, 20), M.light, at(x, H - 0.004, z, 0, Math.PI / 2));
    kit.add(new THREE.RingGeometry(0.075, 0.095, 20), M.alu, at(x, H - 0.003, z, 0, Math.PI / 2));
    light.light([x, H - 0.03, z], 0xffe9d2, intensity, { cutoff: 0.3, power: 4 });
  };
  for (const x of [-3.3, -1.1, 1.1, 3.3]) {
    spot(x, -3.6, 1.4);
    for (const z of [-2.0, -0.2, 1.6, 3.3]) spot(x, z, 2.1);
  }

  // Spiralfalsede ventilationsrør langs vinduesvæggen med to runde udblæsninger.
  const ductMat = new THREE.MeshPhongMaterial({ map: ductTexture(), specular: 0x666666, shininess: 50 });
  for (const [z, y, r] of [[-3.3, 2.8, 0.17], [-2.85, 2.86, 0.13]]) {
    const geo = scaleUV(new THREE.CylinderGeometry(r, r, width, 20, 1, true), 1, width / 0.5);
    kit.add(geo, ductMat, at(0, y, z, 0, 0, Math.PI / 2));
    light.box([minX, y - r, z - r * 0.85], [maxX, y + r, z + r * 0.85]);
  }
  for (const x of [-2.1, 2.2]) {
    kit.add(scaleUV(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 12, 1, true), 1, 0.4), ductMat, at(x, 2.7, -2.85));
    kit.add(scaleUV(new THREE.CylinderGeometry(0.15, 0.15, 0.17, 20, 1, true), 1, 0.34), ductMat, at(x, 2.55, -2.85));
    kit.add(new THREE.CircleGeometry(0.145, 20), M.blackMatte, at(x, 2.465, -2.85, 0, Math.PI / 2));
  }

  // --- Gardinet bag gæsten: mørkeblåt fra væg til væg og fra gulv til loft ---

  const curtainMat = new THREE.MeshLambertMaterial({ map: curtainTexture() });
  kit.add(scaleUV(new THREE.PlaneGeometry(width, H), width / 0.6, 1), curtainMat, at(0, H / 2, maxZ - 0.01, Math.PI));

  // --- Søjlerne ---

  const colTex = columnTexture();
  colTex.repeat.set(3, 1);
  const colMat = new THREE.MeshLambertMaterial({ map: colTex });
  const capital = new THREE.LatheGeometry([
    new THREE.Vector2(0.3, 0), new THREE.Vector2(0.34, 0.04), new THREE.Vector2(0.44, 0.12),
    new THREE.Vector2(0.52, 0.2), new THREE.Vector2(0.53, 0.26), new THREE.Vector2(0.5, 0.3),
    new THREE.Vector2(0.5, 0.42),
  ], 32);
  for (const x of [-3.3, 3.3]) {
    const z = 1.5;
    kit.add(new THREE.CylinderGeometry(0.3, 0.3, H - 0.5, 28, 1, true), colMat, at(x, 0.08 + (H - 0.5) / 2, z));
    kit.add(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 28), M.trim, at(x, 0.04, z));
    kit.add(capital, M.trim, at(x, H - 0.42, z));
    kit.add(new THREE.TorusGeometry(0.47, 0.06, 8, 32), M.trim, at(x, H - 0.24, z, 0, Math.PI / 2));
    physics.addStatic(new CANNON.Cylinder(0.32, 0.32, H, 12), { x, y: H / 2, z }, null, 'wall');
    light.cylinder(x, z, 0.3, 0, H);
    light.cylinder(x, z, 0.5, H - 0.3, H);
  }

  // --- Møbler ---

  // Lav hvid bænk langs vinduerne med de to headsets, som står i den rigtige reception.
  const benchD = 0.42;
  kit.add(new THREE.BoxGeometry(width - 0.4, 0.06, benchD), M.trim, at(0, 0.45, minZ + benchD / 2));
  for (const x of [-4.1, -1.4, 1.4, 4.1]) kit.add(new THREE.BoxGeometry(0.06, 0.42, benchD - 0.04), M.trim, at(x, 0.21, minZ + benchD / 2));
  physics.addBox(new THREE.Vector3(width - 0.4, 0.48, benchD), { x: 0, y: 0.24, z: minZ + benchD / 2 });
  light.box([minX + 0.2, 0.42, minZ], [maxX - 0.2, 0.48, minZ + benchD]);

  // Selve headsettene kan gribes og bygges i props.js. Her står kun holderne.
  const headsetSpots = [];
  for (const x of [-1.85, -1.2]) {
    const base = at(x, 0.48, minZ + 0.2);
    const part = (geo, mat, m) => kit.add(geo, mat, base.clone().multiply(m));
    part(new THREE.CylinderGeometry(0.06, 0.07, 0.015, 20), M.trim, at(0, 0.0075, 0));
    part(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8), M.trim, at(0, 0.07, 0));
    physics.addBox(new THREE.Vector3(0.08, 0.01, 0.06), { x, y: 0.48 + 0.135, z: minZ + 0.2 });
    headsetSpots.push(new THREE.Vector3(x, 0.48 + 0.14 + 0.055, minZ + 0.21));
  }

  // Elgmaleriet mellem vinduerne.
  // Det hænger i et søm over midten, så det kan svinge og komme til at hænge skævt.
  const painting = new THREE.Group();
  painting.position.set(-1.5, 2.6, minZ + 0.03);
  room.add(painting);
  const canvas = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 1.5, 0.04),
    [M.trim, M.trim, M.trim, M.trim, new THREE.MeshLambertMaterial({ map: paintingTexture() }), M.trim],
  );
  canvas.position.y = -0.8;
  painting.add(canvas);
  physics.addStatic(new CANNON.Box(new CANNON.Vec3(0.5, 0.75, 0.03)), { x: -1.5, y: 1.8, z: minZ + 0.04 }, null, 'painting');

  // Receptionsskranken i navy med "CO:" og lysende firkanter på forsiden.
  const desk = { x: 3.2, z: -1.5, w: 0.7, h: 1.08, l: 2.2 };
  kit.add(new THREE.BoxGeometry(desk.w, desk.h - 0.06, desk.l), M.navy, at(desk.x, (desk.h - 0.06) / 2 + 0.06, desk.z));
  kit.add(new THREE.BoxGeometry(desk.w - 0.06, 0.06, desk.l - 0.06), M.blackMatte, at(desk.x, 0.03, desk.z));
  const deskFront = new THREE.Mesh(
    new THREE.PlaneGeometry(desk.l, desk.h - 0.06),
    new THREE.MeshLambertMaterial({ map: deskFrontTexture() }),
  );
  deskFront.position.set(desk.x - desk.w / 2 - 0.002, (desk.h - 0.06) / 2 + 0.06, desk.z);
  deskFront.rotation.y = -Math.PI / 2;
  room.add(deskFront);
  physics.addBox(new THREE.Vector3(desk.w, desk.h, desk.l), { x: desk.x, y: desk.h / 2, z: desk.z });
  light.box([desk.x - desk.w / 2, 0, desk.z - desk.l / 2], [desk.x + desk.w / 2, desk.h, desk.z + desk.l / 2]);
  // Vase med hvide blomster og et par lys på skranken.
  // Vasen er sin egen gruppe med origo midt i bunden, så den kan vælte.
  const vase = new THREE.Group();
  vase.position.set(desk.x, desk.h, desk.z - 0.75);
  room.add(vase);
  vase.add(new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.05, 0), new THREE.Vector2(0.11, 0.06), new THREE.Vector2(0.12, 0.14),
    new THREE.Vector2(0.08, 0.24), new THREE.Vector2(0.06, 0.28),
  ], 20), M.wall));
  const bloom = new THREE.IcosahedronGeometry(0.06, 1);
  const blooms = [];
  const rnd = seededRandom(31);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    blooms.push(bloom.clone().translate(Math.cos(a) * 0.1 * rnd(), 0.36 + rnd() * 0.12, Math.sin(a) * 0.12));
  }
  vase.add(new THREE.Mesh(mergeGeometries(blooms), M.trim));
  // Grønne stilke fra bunden af vasen op til hver blomst, let buede.
  const stemMat = new THREE.MeshLambertMaterial({ color: 0x5f7a45 });
  const stems = blooms.map((b) => {
    b.computeBoundingSphere();
    const top = b.boundingSphere.center;
    const base = new THREE.Vector3(top.x * 0.15, 0.12, top.z * 0.15);
    const mid = new THREE.Vector3().lerpVectors(base, top, 0.5);
    mid.x *= 0.7;
    mid.z *= 0.7;
    return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(base, mid, top), 6, 0.005, 5);
  });
  vase.add(new THREE.Mesh(mergeGeometries(stems), stemMat));
  physics.addStatic(new CANNON.Cylinder(0.12, 0.12, 0.45, 10), { x: desk.x, y: desk.h + 0.23, z: desk.z - 0.75 }, null, 'vase');
  for (const [dz, h] of [[0.6, 0.18], [0.68, 0.12]]) {
    kit.add(new THREE.CylinderGeometry(0.035, 0.035, h, 16), M.trim, at(desk.x, desk.h + h / 2, desk.z + dz));
    kit.add(new THREE.SphereGeometry(0.012, 8, 6), M.warm, at(desk.x, desk.h + h + 0.012, desk.z + dz));
  }

  // Sort skalstol i læder på drejefod, op ad den spartlede væg til venstre for planterne.
  const shell = new THREE.LatheGeometry([
    new THREE.Vector2(0.0, 0.0), new THREE.Vector2(0.3, 0.02), new THREE.Vector2(0.36, 0.12),
    new THREE.Vector2(0.37, 0.3), new THREE.Vector2(0.35, 0.36),
  ], 24, Math.PI * 0.32, Math.PI * 1.36);
  const cushion = new THREE.CylinderGeometry(0.3, 0.3, 0.06, 24);
  {
    const x = minX + 0.45;
    const z = -2.3;
    const base = at(x, 0, z, Math.PI / 2);
    const part = (geo, mat, m) => kit.add(geo, mat, base.clone().multiply(m));
    const shellMatrix = at(0, 0.42, 0);
    shellMatrix.scale(new THREE.Vector3(1, 1.15, 1));
    part(shell, M.black, shellMatrix);
    part(cushion, M.black, at(0, 0.47, 0.02));
    part(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 10), M.blackMatte, at(0, 0.22, 0));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      part(new THREE.BoxGeometry(0.03, 0.025, 0.32), M.blackMatte, at(Math.sin(a) * 0.15, 0.03, Math.cos(a) * 0.15, a));
    }
    physics.addBox(new THREE.Vector3(0.74, 0.84, 0.74), { x, y: 0.42, z });
    light.cylinder(x, z, 0.36, 0.42, 0.85);
    light.cylinder(x, z, 0.16, 0, 0.05, 0.6);
  }

  // Sort gulvlampe med stor skærm, mellem det midterste og det højre vindue.
  const lamp = { x: 1.5, z: -3.45 };
  kit.add(new THREE.CylinderGeometry(0.16, 0.16, 0.025, 24), M.blackMatte, at(lamp.x, 0.0125, lamp.z));
  kit.add(new THREE.CylinderGeometry(0.012, 0.012, 1.7, 8), M.blackMatte, at(lamp.x, 0.85, lamp.z));
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.32, 0.3, 32, 1, true),
    new THREE.MeshLambertMaterial({ color: 0x1b1c1f, side: THREE.DoubleSide }),
  );
  shade.position.set(lamp.x, 1.75, lamp.z);
  room.add(shade);
  // Lampen kan tændes og slukkes, så dens lys bages for sig (gruppen 'lamp').
  const lampBulb = new THREE.Mesh(new THREE.CircleGeometry(0.3, 32), new THREE.MeshBasicMaterial({ color: 0xfff1d6 }));
  lampBulb.position.set(lamp.x, 1.61, lamp.z);
  lampBulb.rotation.x = Math.PI / 2;
  room.add(lampBulb);
  // Snoren, man trækker i.
  const cord = new THREE.Group();
  cord.position.set(lamp.x + 0.2, 1.62, lamp.z + 0.12);
  room.add(cord);
  const cordLine = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.3, 6), M.blackMatte);
  cordLine.position.y = -0.15;
  cord.add(cordLine);
  const cordKnob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), new THREE.MeshLambertMaterial({ color: CVI.orange }));
  cordKnob.position.y = -0.31;
  cord.add(cordKnob);
  physics.addStatic(new CANNON.Cylinder(0.3, 0.32, 0.32, 12), { x: lamp.x, y: 1.75, z: lamp.z }, null, 'lamp');
  light.cylinder(lamp.x, lamp.z, 0.3, 1.6, 1.9);
  light.light([lamp.x, 1.58, lamp.z], 0xffc98a, 0.7, { cutoff: 0.15, power: 1, group: 'lamp' });
  light.light([lamp.x, 1.92, lamp.z], 0xffc98a, 0.6, { dir: [0, 1, 0], cutoff: 0.3, power: 1, group: 'lamp' });
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffe2b0, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  lampGlow.scale.set(1.2, 0.8, 1);
  lampGlow.position.set(lamp.x, 1.5, lamp.z);
  room.add(lampGlow);

  // Violinfigen i mørke krukker.
  const potGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0.12, 0), new THREE.Vector2(0.24, 0.08), new THREE.Vector2(0.29, 0.24),
    new THREE.Vector2(0.24, 0.42), new THREE.Vector2(0.2, 0.45), new THREE.Vector2(0.18, 0.43),
  ], 24);
  const plants = [[-3.95, -3.35, 2.05], [-3.3, -3.45, 1.9], [4.05, 0.75, 1.8]];
  const leafGeo = new THREE.PlaneGeometry(0.2, 0.25).translate(0, 0.125, 0);
  const leaves = new THREE.InstancedMesh(
    leafGeo,
    new THREE.MeshLambertMaterial({ map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide }),
    plants.length * 80,
  );
  let leafCount = 0;
  const leafRnd = seededRandom(13);
  const soil = new THREE.CircleGeometry(0.2, 20);
  const soilMat = new THREE.MeshLambertMaterial({ color: 0x2b211a });
  const up = new THREE.Vector3(0, 1, 0);
  // En gren fra a til b. Bladene sættes fast et sted på grenene, så intet svæver.
  const stem = (a, b, r0, r1) => {
    const dir = b.clone().sub(a);
    const geo = new THREE.CylinderGeometry(r1, r0, dir.length(), 6);
    const m = new THREE.Matrix4().compose(
      a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(up, dir.normalize()), ONE,
    );
    kit.add(geo, M.bark, m);
  };
  for (const [x, z, top] of plants) {
    kit.add(potGeo, M.pot, at(x, 0, z));
    kit.add(soil, soilMat, at(x, 0.4, z, 0, -Math.PI / 2));
    physics.addStatic(new CANNON.Cylinder(0.27, 0.22, 0.45, 10), { x, y: 0.225, z });
    light.cylinder(x, z, 0.28, 0, 0.45);
    light.sphere([x, (1.0 + top) / 2 + 0.1, z], 0.4, 0.55);

    // Tre stammer, der starter nede i jorden og skråner lidt udad, med et par sidegrene hver.
    const branches = [];
    const turn = leafRnd() * Math.PI * 2;
    for (let k = 0; k < 3; k++) {
      const a = turn + (k / 3) * Math.PI * 2;
      const lean = 0.1 + leafRnd() * 0.12;
      const base = new THREE.Vector3(x + Math.sin(a) * 0.03, 0.38, z + Math.cos(a) * 0.03);
      const tip = new THREE.Vector3(x + Math.sin(a) * lean, top - leafRnd() * 0.2, z + Math.cos(a) * lean);
      stem(base, tip, 0.018, 0.009);
      branches.push({ a: base, b: tip, from: 0.4 });
      for (let j = 0; j < 2; j++) {
        const start = base.clone().lerp(tip, 0.5 + leafRnd() * 0.3);
        const ba = a + (leafRnd() - 0.5) * 2;
        const len = 0.22 + leafRnd() * 0.15;
        const end = start.clone().add(new THREE.Vector3(Math.sin(ba) * len, len * 0.7, Math.cos(ba) * len));
        stem(start, end, 0.008, 0.005);
        branches.push({ a: start, b: end, from: 0.2 });
      }
    }
    // Bladene fordeles på grenene, flest mod toppen.
    for (let i = 0; i < 80; i++) {
      const br = branches[i % branches.length];
      const t = br.from + (1 - br.from) * Math.sqrt(leafRnd());
      const p = br.a.clone().lerp(br.b, t);
      const m = at(p.x, p.y, p.z, leafRnd() * Math.PI * 2, 0.5 + leafRnd() * 0.7, (leafRnd() - 0.5) * 0.5);
      m.scale(new THREE.Vector3().setScalar(0.75 + leafRnd() * 0.45));
      leaves.setMatrixAt(leafCount++, m);
    }
  }
  room.add(leaves);

  // Bordet foran gæsten og diskettemaskinen (de bygges i desk.js).
  const deskZ0 = DESK.z - DESK.depth / 2;
  light.box([-DESK.width / 2, DESK_TOP - 0.04, deskZ0], [DESK.width / 2, DESK_TOP, DESK.z + DESK.depth / 2]);
  light.box([-DESK.width / 2, 0, deskZ0], [DESK.width / 2, DESK_TOP - 0.04, deskZ0 + 0.03]);
  light.box([PRINTER.x - 0.14, DESK_TOP, PRINTER.z - 0.13], [PRINTER.x + 0.14, DESK_TOP + 0.2, PRINTER.z + 0.13]);

  kit.build(room);
  const lampLevel = { value: 1 };
  bakeRoom(light, { floorMat, rugMat, RUG, ceilingMat, frontWallMat, rightWallMat, rightLength, rightMid, leftWallMat }, lampLevel);

  return {
    painting, vase, neon, headsetSpots,
    lamp: { level: lampLevel, bulb: lampBulb, glow: lampGlow, cord, shade },
  };
}

const put = (p, x, y, z) => {
  p[0] = x;
  p[1] = y;
  p[2] = z;
};

// Regner lyset ud på gulv, tæppe, loft og de tre vægge.
// Lampens lys bages for sig på de flader, det når, og lægges oven i med lampLevel (0..1).
function bakeRoom(light, m, lampLevel) {
  const { minX, maxX, minZ, maxZ, height: H } = ROOM;
  const lamp = (mat, spec) => {
    const map = light.bake({ ...spec, group: 'lamp' });
    map.repeat.copy(mat.lightMap.repeat);
    map.offset.copy(mat.lightMap.offset);
    withSwitchedLight(mat, map, lampLevel);
    return map;
  };
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const fullDepth = depth;
  // Mørkere tæt på en kant (hjørner, fodlister og loftskanter).
  const edge = (d, strength = 0.4, reach = 0.25) => 1 - strength * Math.exp(-Math.max(d, 0) / reach);
  const sideWalls = (x) => edge(x - minX) * edge(maxX - x);

  const floorSpec = {
    width: 192,
    height: 200,
    normal: [0, 1, 0],
    ambient: new THREE.Color(0.14, 0.135, 0.13),
    point: (u, v, p) => put(p, minX + u * width, 0, minZ + (1 - v) * fullDepth),
    ao: (x, y, z) => sideWalls(x) * edge(z - minZ) * edge(maxZ - z),
  };
  m.floorMat.lightMap = light.bake(floorSpec);
  const floorLamp = lamp(m.floorMat, floorSpec);
  // Tæppet bruger gulvets lightmap, flyttet og skaleret til tæppets egne uv'er.
  const rugMap = m.floorMat.lightMap.clone();
  rugMap.repeat.set(m.RUG.w / width, m.RUG.d / fullDepth);
  rugMap.offset.set((m.RUG.x - m.RUG.w / 2 - minX) / width, 1 - (m.RUG.z + m.RUG.d / 2 - minZ) / fullDepth);
  m.rugMat.lightMap = rugMap;
  const rugLamp = floorLamp.clone();
  rugLamp.repeat.copy(rugMap.repeat);
  rugLamp.offset.copy(rugMap.offset);
  withSwitchedLight(m.rugMat, rugLamp, lampLevel);

  const ceilingSpec = {
    width: 128,
    height: 128,
    normal: [0, -1, 0],
    ambient: new THREE.Color(0.38, 0.38, 0.39),
    point: (u, v, p) => put(p, minX + u * width, H, minZ + v * fullDepth),
    ao: (x, y, z) => sideWalls(x) * edge(z - minZ) * edge(maxZ - z),
  };
  m.ceilingMat.lightMap = light.bake(ceilingSpec);
  lamp(m.ceilingMat, ceilingSpec);

  // Vinduesvæggenes uv'er er i meter (fra ExtrudeGeometry), så lightmappet strækkes over hele væggen.
  const wallMap = (tex, length) => {
    tex.repeat.set(1 / length, 1 / H);
    tex.offset.set(0.5, 0);
    return tex;
  };
  const wallAmbient = new THREE.Color(0.24, 0.235, 0.23);
  const wallAO = (s, y, s0, s1) => edge(y, 0.35) * edge(H - y, 0.3) * edge(s - s0) * edge(s1 - s);

  const frontSpec = {
    width: 256,
    height: 96,
    normal: [0, 0, 1],
    ambient: wallAmbient,
    point: (u, v, p) => put(p, (u - 0.5) * width, v * H, minZ),
    ao: (x, y) => wallAO(x, y, minX, maxX),
  };
  m.frontWallMat.lightMap = wallMap(light.bake(frontSpec), width);
  lamp(m.frontWallMat, frontSpec);

  m.rightWallMat.lightMap = wallMap(light.bake({
    width: 256,
    height: 96,
    normal: [-1, 0, 0],
    ambient: wallAmbient,
    point: (u, v, p) => put(p, maxX, v * H, m.rightMid + (u - 0.5) * m.rightLength),
    ao: (x, y, z) => wallAO(z, y, minZ, maxZ),
  }), m.rightLength);

  // Den spartlede væg er et almindeligt plan: u går fra glasvæggen (u = 0) mod vinduerne.
  const leftSpec = {
    width: 192,
    height: 80,
    normal: [1, 0, 0],
    ambient: wallAmbient,
    point: (u, v, p) => put(p, minX, v * H, maxZ - u * depth),
    ao: (x, y, z) => wallAO(z, y, minZ, maxZ),
  };
  m.leftWallMat.lightMap = light.bake(leftSpec);
  lamp(m.leftWallMat, leftSpec);
}

// Uret viser den rigtige tid. Sekundviseren er i CO:PLAY-orange.
function buildClock(parent, matrix, animated) {
  const clock = new THREE.Group();
  clock.applyMatrix4(matrix);
  parent.add(clock);

  clock.add(new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 64),
    new THREE.MeshBasicMaterial({ map: clockFaceTexture() }),
  ));
  clock.add(new THREE.Mesh(new THREE.TorusGeometry(0.51, 0.02, 8, 96), new THREE.MeshLambertMaterial({ color: CVI.navy })));
  clock.add(new THREE.Mesh(new THREE.TorusGeometry(0.485, 0.006, 6, 96), new THREE.MeshBasicMaterial({ color: CVI.cyan })));

  const white = new THREE.MeshBasicMaterial({ color: CVI.white });
  const hand = (length, width, material, z) => {
    const geo = new THREE.BoxGeometry(width, length, 0.008);
    geo.translate(0, length / 2 - 0.05, 0);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.z = z;
    clock.add(mesh);
    return mesh;
  };
  const hourHand = hand(0.27, 0.028, white, 0.012);
  const minuteHand = hand(0.4, 0.018, white, 0.02);
  const secondHand = hand(0.44, 0.008, new THREE.MeshBasicMaterial({ color: CVI.orange }), 0.028);
  const hub = new THREE.Mesh(new THREE.CircleGeometry(0.022, 20), new THREE.MeshBasicMaterial({ color: CVI.orange }));
  hub.position.z = 0.034;
  clock.add(hub);

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

  // Nabohuset, set gennem vinduet forrest til højre.
  const signSpot = new THREE.Vector3(15, 0, -21.5);
  addBuilding(signSpot.x, signSpot.z, 11, 11, 32, new THREE.Color(0.5, 0.5, 0.55));

  stage.add(new THREE.Mesh(
    mergeGeometries(buildings),
    new THREE.MeshBasicMaterial({ map: winTex, vertexColors: true }),
  ));
  stage.add(new THREE.Mesh(
    mergeGeometries(strips),
    new THREE.MeshBasicMaterial({ color: CVI.cyan, toneMapped: false }),
  ));

  const beaconMat = new THREE.PointsMaterial({
    color: CVI.orange, size: 4, sizeAttenuation: false, transparent: true,
  });
  const beaconGeo = new THREE.BufferGeometry();
  beaconGeo.setAttribute('position', new THREE.Float32BufferAttribute(beacons, 3));
  stage.add(new THREE.Points(beaconGeo, beaconMat));
  animated.push((time) => {
    beaconMat.opacity = Math.sin(time * 2.4) > 0.2 ? 1 : 0.15;
  });

  buildLandmark(stage, winTex);
  const trainCars = buildMonorail(stage, animated);
  buildDrones(stage, animated, holoMaterials);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshBasicMaterial({ color: 0x060d1a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND;
  stage.add(ground);
  return trainCars;
}

// Det kugleformede tårn fra konceptbilledet, langt ude i byen.
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
  // Ses gennem vinduet forrest til venstre.
  const spot = new THREE.Vector3(-103, GROUND, -147);
  tower.position.copy(spot);
  stage.add(tower);

  const ringMat = new THREE.MeshBasicMaterial({ color: CVI.cyan, toneMapped: false });
  for (const t of [0.2, 0.45, 0.7]) {
    const r = radius * Math.sin(Math.PI * (0.25 + 0.75 * t)) + 0.3;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.35, 6, 64), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(spot.x, GROUND + t * height, spot.z);
    stage.add(ring);
  }
}

// Svævetog i et glasrør, der kører rundt om huset i gæstens øjenhøjde.
function buildMonorail(stage, animated) {
  const points = [];
  for (let k = 0; k < 10; k++) {
    const angle = (k / 10) * Math.PI * 2;
    const r = 44 + 10 * Math.sin(k * 1.7);
    points.push(new THREE.Vector3(Math.sin(angle) * r, -2 + 2.5 * Math.sin(k * 2.3), Math.cos(angle) * r));
  }
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
  const shifted = (dy) => new THREE.CatmullRomCurve3(points.map((p) => p.clone().setY(p.y + dy)), true, 'centripetal');

  const trackMat = new THREE.MeshBasicMaterial({ color: CVI.navy });
  stage.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 300, 0.7, 6, true), trackMat));
  stage.add(new THREE.Mesh(
    new THREE.TubeGeometry(shifted(0.8), 300, 0.15, 5, true),
    new THREE.MeshBasicMaterial({ color: CVI.cyan, toneMapped: false }),
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

  const bodyMat = new THREE.MeshBasicMaterial({ color: CVI.blue });
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xf6e3c8, toneMapped: false });
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
  return cars;
}

// Svævende kugler med lyskegler, som på billedet.
function buildDrones(stage, animated, holoMaterials) {
  // Placeret så hver kugle kan ses gennem et af vinduerne.
  const spots = [
    [-60, 26, -80, 4],
    [55, 28, -75, 5],
    [80, 24, -10, 4],
  ];
  const body = new THREE.MeshLambertMaterial({ color: CVI.navy });
  spots.forEach(([x, y, z, r], i) => {
    const drone = new THREE.Group();
    drone.position.set(x, y, z);
    drone.add(new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), body));
    const shellMat = hologramMaterial(CVI.cyan, { opacity: 0.6 });
    holoMaterials.push(shellMat);
    drone.add(new THREE.Mesh(new THREE.SphereGeometry(r * 1.04, 32, 16), shellMat));
    const beamLength = 40;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.2, r * 2.2, beamLength, 24, 1, true),
      beamMaterial(CVI.cyan, 0.16),
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
      // Blå time som på billederne fra receptionen: lysere blå i horisonten, navy oppe.
      uniforms: {
        uHorizon: { value: new THREE.Color(SKY_HORIZON) },
        uZenith: { value: new THREE.Color(CVI.navy) },
      },
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
        uniform vec3 uHorizon;
        uniform vec3 uZenith;
        varying vec3 vDir;
        void main() {
          float h = smoothstep(0.0, 0.6, vDir.y);
          gl_FragColor = vec4(mix(uHorizon, uZenith, h), 1.0);
        }
      `,
    }),
  );
  sky.userData.revealAt = 60; // himlen kommer, når indlæsningen er nået ud over byen
  stage.add(sky);

  const rnd = seededRandom(99);
  const starPos = [];
  for (let i = 0; i < 600; i++) {
    const theta = rnd() * Math.PI * 2;
    const y = 0.15 + rnd() * 0.85;
    const r = Math.sqrt(1 - y * y);
    starPos.push(Math.cos(theta) * r * 1400, y * 1400, Math.sin(theta) * r * 1400);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xcfe0ff, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0.3, fog: false,
  }));
  stars.userData.revealAt = 60;
  stage.add(stars);
}
