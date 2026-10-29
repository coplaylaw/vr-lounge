import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CANNON } from './physics.js';
import { diskLabelTexture, letterTexture, wingTexture } from './materials.js';
import { CVI, CYAN_LIGHT } from './palette.js';

const UP = new THREE.Vector3(0, 1, 0);

// --- Ting, der kan gribes og kastes ---

export function createDisk(physics, topic, position) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.012, 0.09),
    new THREE.MeshLambertMaterial({ color: topic.color }),
  ));
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.068, 0.0425),
    new THREE.MeshLambertMaterial({ map: diskLabelTexture(topic.label, topic.color) }),
  );
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, 0.0065, 0.014);
  group.add(label);
  const shutter = new THREE.Mesh(
    new THREE.BoxGeometry(0.036, 0.0135, 0.026),
    new THREE.MeshLambertMaterial({ color: 0xaab4c0 }),
  );
  shutter.position.z = -0.03;
  group.add(shutter);
  group.position.copy(position);
  const item = physics.add(group, new CANNON.Box(new CANNON.Vec3(0.045, 0.006, 0.045)), {
    mass: 0.05, kind: 'disk', radius: 0.06,
  });
  item.data.topic = topic;
  return item;
}

const BLOCK = 0.07;
export function createLetterBlock(physics, letter, index, position) {
  const palette = [
    [CVI.navy, CVI.white],
    [CVI.cyan, CVI.navy],
  ];
  const [bg, fg] = letter === ':' ? [CVI.orange, CVI.white] : palette[index % 2];
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK),
    new THREE.MeshLambertMaterial({ map: letterTexture(letter, bg, fg) }),
  );
  mesh.position.copy(position);
  return physics.add(mesh, new CANNON.Box(new CANNON.Vec3(BLOCK / 2, BLOCK / 2, BLOCK / 2)), {
    mass: 0.12, kind: 'block', radius: 0.05, material: physics.blockMaterial,
  });
}

// Kanonen sidder fast i hånden med løbet fremad langs pegestrålen.
const BLASTER_HOLD = new THREE.Matrix4().makeTranslation(0, 0.035, 0.03);
export const BLASTER_MUZZLE = new THREE.Vector3(0, 0, -0.15);
export function createBlaster(physics, position) {
  const group = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xe8eef5 });
  const cyan = new THREE.MeshBasicMaterial({ color: CVI.cyan, toneMapped: false });
  group.add(new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.065, 0.16, 3, 0.015), white));
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.02, 0.07, 16),
    new THREE.MeshLambertMaterial({ color: CVI.navy }),
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.11;
  group.add(barrel);
  const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.004, 8, 24), cyan);
  muzzle.position.z = -0.145;
  group.add(muzzle);
  const grip = new THREE.Mesh(new RoundedBoxGeometry(0.035, 0.085, 0.045, 3, 0.012), white);
  grip.position.set(0, -0.065, 0.045);
  grip.rotation.x = 0.25;
  group.add(grip);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.008, 0.12), cyan);
  stripe.position.y = 0.012;
  group.add(stripe);
  const tank = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 16, 8),
    new THREE.MeshBasicMaterial({ color: CVI.orange, toneMapped: false }),
  );
  tank.position.set(0, 0.04, 0.03);
  group.add(tank);
  group.position.copy(position);
  const item = physics.add(group, new CANNON.Box(new CANNON.Vec3(0.025, 0.05, 0.085)), {
    mass: 0.3, kind: 'blaster', radius: 0.08, holdOffset: BLASTER_HOLD,
  });
  item.data.cooldown = 0;
  return item;
}

// Koppens mål (lokalt, bunden ved y = 0).
const CUP = { inner: 0.034, floor: 0.008, rim: 0.09 };
const COFFEE_COLOR = 0x3b2416;

export function createCoffee(physics, position, glowTex) {
  const group = new THREE.Group();
  const cup = new THREE.Group();
  cup.position.y = -0.045; // fysikkens cylinder er centreret, koppens geometri starter i bunden
  group.add(cup);
  const white = new THREE.MeshLambertMaterial({ color: 0xf4f6f8, side: THREE.DoubleSide });
  const profile = [[0.001, 0], [0.034, 0], [0.04, 0.09], [0.036, 0.09], [0.031, 0.008], [0.001, 0.008]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  cup.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 28), white));
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0382, 0.0372, 0.018, 28, 1, true),
    new THREE.MeshLambertMaterial({ color: CVI.cyan }),
  );
  band.position.y = 0.055;
  cup.add(band);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 8, 16, Math.PI), white);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(0.039, 0.045, 0);
  cup.add(handle);

  // Kaffens overflade holder sig vandret, uanset hvordan koppen vendes (se updateCoffee).
  // Overfladen klippes ved koppens kant og bund, så den ikke stikker ud, når kaffen hældes.
  const clip = [new THREE.Plane(), new THREE.Plane()];
  const surface = new THREE.Mesh(
    new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: COFFEE_COLOR, side: THREE.DoubleSide, clippingPlanes: clip }),
  );
  surface.matrixAutoUpdate = false;
  surface.raycast = () => {};
  cup.add(surface);

  const steam = [0, 1, 2].map(() => {
    const puff = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
    }));
    puff.raycast = () => {};
    cup.add(puff);
    return puff;
  });

  group.position.copy(position);
  const item = physics.add(group, new CANNON.Cylinder(0.04, 0.034, 0.09, 12), {
    mass: 0.25, kind: 'coffee', radius: 0.06,
  });
  Object.assign(item.data, { steam, cup, surface, clip, fill: 0.7, pouring: 0 });
  return item;
}

const _q = new THREE.Quaternion();
const _up = new THREE.Vector3();
const _lip = new THREE.Vector3();
const _t = new THREE.Vector3();
const _b = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();

// Væsken: overfladen er et vandret plan gennem koppens akse i fyldhøjden. Når planet når over
// kanten på den lave side, løber kaffen ud. Returnerer, hvor meget der hældes (0..1).
export function updateCoffee(item, time, dt, spill) {
  const { cup, surface, steam, clip } = item.data;
  cup.updateWorldMatrix(true, false);
  // Verdens "op" set fra koppen.
  _up.copy(UP).applyQuaternion(cup.getWorldQuaternion(_q).invert());
  const tilt = Math.hypot(_up.x, _up.z);
  const depth = CUP.rim - CUP.floor;
  let level = CUP.floor + item.data.fill * depth;

  // Hvor højt står kaffen ved den laveste del af kanten? Over kanten = den løber ud.
  let pour = 0;
  if (item.data.fill > 0) {
    const rise = _up.y > 0.05 ? (CUP.inner * tilt) / _up.y : Infinity;
    const over = level + rise - CUP.rim;
    if (over > 0) {
      pour = Math.min(1, over / 0.03 + (_up.y < 0.2 ? 1 : 0));
      item.data.fill = Math.max(0, item.data.fill - pour * dt * 0.3);
      level = CUP.floor + item.data.fill * depth;
      if (spill) {
        // Kaffen løber ud over den laveste del af kanten.
        _lip.set(-_up.x, 0, -_up.z);
        if (_lip.lengthSq() < 1e-6) _lip.set(1, 0, 0);
        _lip.normalize().multiplyScalar(CUP.inner + 0.004).setY(CUP.rim);
        cup.localToWorld(_lip);
        spill.pour(_lip, item.body.velocity, pour * dt);
      }
    }
  }
  item.data.pouring = pour;

  // Overfladen: normal = verdens op, strakt ud langs hældningen, så den dækker den skrå kop.
  surface.visible = item.data.fill > 0.02 && _up.y > 0.15;
  if (surface.visible) {
    _t.set(-_up.x, 0, -_up.z);
    if (_t.lengthSq() < 1e-8) _t.set(1, 0, 0);
    _t.addScaledVector(_up, -_t.dot(_up)).normalize();
    _b.crossVectors(_t, _up).normalize();
    const r = CUP.inner - 0.001 + (level - CUP.floor) * 0.08;
    _m.makeBasis(_t.multiplyScalar(r / _up.y), _v.copy(_up), _b.multiplyScalar(r));
    _m.setPosition(0, level, 0);
    surface.matrix.copy(_m);
    // Klippeplanerne i verdenskoordinater: under kanten og over bunden.
    const axis = _v.set(0, 1, 0).applyQuaternion(cup.getWorldQuaternion(_q));
    clip[0].setFromNormalAndCoplanarPoint(_t.copy(axis).negate(), cup.localToWorld(_lip.set(0, CUP.rim, 0)));
    clip[1].setFromNormalAndCoplanarPoint(axis, cup.localToWorld(_lip.set(0, CUP.floor, 0)));
  }

  const steaming = _up.y > 0.8 && item.data.fill > 0.1;
  steam.forEach((puff, i) => {
    const t = (time * 0.35 + i / 3) % 1;
    puff.position.set(Math.sin(time * 2 + i * 2) * 0.008, 0.09 + t * 0.12, 0);
    puff.scale.setScalar(0.03 + t * 0.05);
    puff.material.opacity = steaming ? 0.35 * Math.sin(t * Math.PI) : 0;
  });
  return pour;
}

// Kaffe, der er hældt ud: dråber, der falder, og pytter, hvor de lander.
const DROPS = 160;
const PUDDLES = 24;

export class CoffeeSpill {
  // surfaces: [{ y, minX, maxX, minZ, maxZ }] vandrette flader dråberne kan lande på (gulvet tjekkes altid).
  constructor(stage, surfaces = []) {
    this.surfaces = surfaces;
    const material = new THREE.MeshLambertMaterial({ color: COFFEE_COLOR });
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.005, 6, 4), material, DROPS);
    this.drops.frustumCulled = false;
    this.drops.raycast = () => {};
    stage.add(this.drops);
    this.list = Array.from({ length: DROPS }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3() }));
    this.puddleMat = new THREE.MeshLambertMaterial({ color: 0x2e1b10, transparent: true, opacity: 0.9, depthWrite: false });
    this.puddleGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
    this.puddles = [];
    this.stage = stage;
    this.carry = 0;
    this.matrix = new THREE.Matrix4();
    this.clear();
  }

  // lip er i verdenskoordinater, velocity i scenens. amount: hvor meget der hældes i dette billede.
  pour(lip, velocity, amount) {
    this.carry += amount * 250;
    while (this.carry >= 1) {
      this.carry -= 1;
      const d = this.list.find((x) => x.life <= 0);
      if (!d) return;
      d.life = 3;
      this.stage.worldToLocal(d.p.copy(lip)).add(_v.set((Math.random() - 0.5) * 0.008, 0, (Math.random() - 0.5) * 0.008));
      d.v.set(velocity.x, velocity.y, velocity.z).multiplyScalar(0.8);
      d.v.x += (Math.random() - 0.5) * 0.08;
      d.v.z += (Math.random() - 0.5) * 0.08;
    }
  }

  land(p, y) {
    const near = this.puddles.find((x) => Math.abs(x.position.y - y) < 0.01 && Math.hypot(x.position.x - p.x, x.position.z - p.z) < x.scale.x + 0.02);
    if (near) {
      // Pytten vokser med arealet af dråben.
      near.scale.setScalar(Math.min(0.12, Math.sqrt(near.scale.x ** 2 + 0.00006)));
      return;
    }
    let puddle = this.puddles.length >= PUDDLES ? this.puddles.shift() : null;
    if (!puddle) puddle = new THREE.Mesh(this.puddleGeo, this.puddleMat);
    puddle.raycast = () => {};
    puddle.position.set(p.x, y + 0.002 + this.puddles.length * 0.0001, p.z);
    puddle.scale.setScalar(0.012);
    this.stage.add(puddle);
    this.puddles.push(puddle);
  }

  update(dt) {
    this.list.forEach((d, i) => {
      if (d.life > 0) {
        d.life -= dt;
        d.v.y -= 9.82 * dt;
        const prevY = d.p.y;
        d.p.addScaledVector(d.v, dt);
        let ground = 0;
        for (const s of this.surfaces) {
          if (d.p.x > s.minX && d.p.x < s.maxX && d.p.z > s.minZ && d.p.z < s.maxZ && prevY >= s.y) ground = Math.max(ground, s.y);
        }
        if (d.p.y <= ground) {
          this.land(d.p, ground);
          d.life = 0;
        }
      }
      this.matrix.makeScale(d.life > 0 ? 1 : 0, d.life > 0 ? 1.6 : 0, d.life > 0 ? 1 : 0).setPosition(d.p);
      this.drops.setMatrixAt(i, this.matrix);
    });
    this.drops.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (const d of this.list) d.life = 0;
    for (const p of this.puddles) p.removeFromParent();
    this.puddles = [];
    this.carry = 0;
    this.update(0);
  }
}

// --- Skud fra konfettikanonen ---

const SHOT_GROUP = 4; // skuddenes egen kollisionsgruppe, så strålen herunder ikke rammer dem selv
const SHOT_PUSH = 1.5; // skuddets bevægelsesmængde ganges op, så selv tunge ting kan ses at blive skubbet
const _rayResult = new CANNON.RaycastResult();
const _rayOptions = { collisionFilterMask: ~SHOT_GROUP, skipBackfaces: true };
const _to = new CANNON.Vec3();
const _impulse = new CANNON.Vec3();
const _point = new CANNON.Vec3();

// Skuddene er så hurtige, at de kan flyve igennem en klods mellem to fysiktrin, og en ting, der sover,
// mærker ikke et almindeligt sammenstød. Derfor sendes en stråle ud foran hvert skud før fysiktrinnet
// (sweep), og rammer den en ting, får tingen et skub i træfpunktet, og skuddet preller af.
export class Projectiles {
  constructor(stage, physics) {
    this.stage = stage;
    this.world = physics.world;
    this.physics = physics;
    this.list = [];
    this.geometry = new THREE.SphereGeometry(0.017, 12, 8);
    this.materials = [CVI.cyan, CVI.orange, CVI.blue, CVI.sand].map(
      (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false }),
    );
    this.shape = new CANNON.Sphere(0.017);
  }

  fire(position, velocity) {
    let shot = this.list.find((s) => s.life <= 0);
    if (!shot) {
      if (this.list.length >= 16) {
        shot = this.list.reduce((a, b) => (a.life < b.life ? a : b));
      } else {
        const mesh = new THREE.Mesh(this.geometry, this.materials[this.list.length % this.materials.length]);
        const body = new CANNON.Body({ mass: 0.02, shape: this.shape, linearDamping: 0.01, collisionFilterGroup: SHOT_GROUP });
        shot = { mesh, body, life: 0 };
        body.addEventListener('collide', (e) => this.onImpact?.(shot, e.body.userData?.surface));
        this.list.push(shot);
      }
    }
    if (shot.life <= 0) {
      this.stage.add(shot.mesh);
      this.world.addBody(shot.body);
    }
    shot.life = 2.5;
    shot.body.position.set(position.x, position.y, position.z);
    shot.body.velocity.set(velocity.x, velocity.y, velocity.z);
    shot.body.angularVelocity.setZero();
    shot.mesh.position.copy(position);
  }

  update(dt) {
    for (const shot of this.list) {
      if (shot.life <= 0) continue;
      shot.life -= dt;
      shot.body.velocity.y += 9.82 * 0.75 * dt; // næsten vægtløse, så det er nemt at ramme
      shot.mesh.position.copy(shot.body.position);
      if (shot.life <= 0) this.retire(shot);
    }
  }

  // Kaldes før fysiktrinnet med dets længde.
  sweep(dt) {
    for (const shot of this.list) if (shot.life > 0) this.push(shot, dt);
  }

  push(shot, dt) {
    const p = shot.body.position;
    p.addScaledVector(dt * 1.5, shot.body.velocity, _to);
    _rayResult.reset();
    if (!this.world.raycastClosest(p, _to, _rayOptions, _rayResult)) return;
    const item = _rayResult.body.userData?.item;
    if (!item || item.heldBy || item.frozen) return;
    const v = shot.body.velocity;
    const n = _rayResult.hitNormalWorld;
    const b = item.body;
    b.wakeUp();
    item.still = 0;
    v.scale(shot.body.mass * SHOT_PUSH, _impulse);
    _impulse.y += 0.35 * _impulse.length(); // et lille hop, så tingen ikke bare bremses af bordet
    _rayResult.hitPointWorld.vsub(b.position, _point);
    b.applyImpulse(_impulse, _point);
    // Skuddet preller af og lægges lige uden for tingen.
    v.vsub(n.scale(2 * v.dot(n), _point), v);
    v.scale(0.3, v);
    _rayResult.hitPointWorld.addScaledVector(0.02, n, shot.body.position);
    this.onImpact?.(shot, b.userData?.surface ?? item.kind, item);
  }

  retire(shot) {
    shot.life = 0;
    shot.mesh.removeFromParent();
    this.world.removeBody(shot.body);
  }

  get alive() {
    return this.list.filter((s) => s.life > 0);
  }

  clear() {
    for (const shot of this.list) if (shot.life > 0) this.retire(shot);
  }
}

// --- Lysende skydeskiver rundt i rummet ---

const TARGET_SPOTS = [
  [-1.5, 1.45, -2.0],
  [-0.7, 2.05, -2.7],
  [0.9, 2.2, -2.6],
  [1.9, 1.35, -1.9],
  [-2.3, 1.7, -0.8],
];
const TARGET_RADIUS = 0.16;

export class Targets {
  constructor(stage) {
    this.stage = stage;
    this.list = [];
    this.ringMat = new THREE.MeshBasicMaterial({ color: CVI.cyan, transparent: true, toneMapped: false });
    this.discMat = new THREE.MeshBasicMaterial({
      color: CVI.cyan, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false,
    });
    this.eyeMat = new THREE.MeshBasicMaterial({ color: CVI.orange, toneMapped: false });
    this.lookTarget = new THREE.Vector3();
  }

  spawn() {
    this.clear();
    TARGET_SPOTS.forEach(([x, y, z], i) => {
      const target = new THREE.Group();
      target.add(new THREE.Mesh(new THREE.TorusGeometry(TARGET_RADIUS, 0.014, 8, 40), this.ringMat));
      target.add(new THREE.Mesh(new THREE.CircleGeometry(TARGET_RADIUS, 32), this.discMat));
      const eye = new THREE.Mesh(new THREE.CircleGeometry(0.04, 24), this.eyeMat);
      eye.position.z = 0.002;
      target.add(eye);
      target.position.set(x, y, z);
      target.scale.setScalar(0.01);
      this.stage.add(target);
      this.list.push({ group: target, home: new THREE.Vector3(x, y, z), index: i, alive: true, pop: 0, grow: 0 });
    });
  }

  get allDown() {
    return this.list.length > 0 && this.list.every((t) => !t.alive);
  }

  // Rammer noget inden for radius en skive? Returnerer skiven, der blev ramt.
  hitTest(position, radius) {
    for (const t of this.list) {
      if (t.alive && t.group.position.distanceTo(position) < TARGET_RADIUS + radius) {
        t.alive = false;
        return t;
      }
    }
    return null;
  }

  update(time, dt, viewerLocal) {
    for (const t of this.list) {
      if (t.alive) {
        t.grow = Math.min(1, t.grow + dt * 2);
        t.group.scale.setScalar(Math.max(0.01, t.grow));
        t.group.position.copy(t.home);
        t.group.position.y += Math.sin(time * 1.2 + t.index) * 0.05;
        this.lookTarget.copy(viewerLocal);
        t.group.lookAt(this.stage.localToWorld(this.lookTarget));
      } else if (t.group.parent) {
        t.pop += dt * 4;
        t.group.scale.setScalar(1 + t.pop);
        if (t.pop > 1) t.group.removeFromParent();
      }
    }
  }

  clear() {
    for (const t of this.list) t.group.removeFromParent();
    this.list = [];
  }
}

// --- Konfetti ---

const CONFETTI = 400;
export class Confetti {
  constructor(stage) {
    this.positions = new Float32Array(CONFETTI * 3).fill(-100);
    this.colors = new Float32Array(CONFETTI * 3);
    this.velocities = new Float32Array(CONFETTI * 3);
    this.life = new Float32Array(CONFETTI);
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.025, vertexColors: true, transparent: true, depthWrite: false,
    }));
    this.points.frustumCulled = false;
    stage.add(this.points);
    this.palette = [CVI.cyan, CVI.orange, CVI.blue, CVI.white, CVI.sand, CVI.navy].map((c) => new THREE.Color(c));
  }

  burst(position, count = 50, speed = 2) {
    for (let n = 0; n < count; n++) {
      const i = this.cursor++ % CONFETTI;
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize();
      const s = speed * (0.4 + Math.random() * 0.6);
      position.toArray(this.positions, i * 3);
      this.velocities.set([dir.x * s, dir.y * s + 1, dir.z * s], i * 3);
      this.palette[n % this.palette.length].toArray(this.colors, i * 3);
      this.life[i] = 1.2 + Math.random() * 0.6;
    }
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  update(dt) {
    const p = this.positions;
    const v = this.velocities;
    for (let i = 0; i < CONFETTI; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = i * 3;
      v[k + 1] -= 4 * dt;
      for (let a = 0; a < 3; a++) {
        v[k + a] *= 1 - 1.5 * dt;
        p[k + a] += v[k + a] * dt;
      }
      if (this.life[i] <= 0) p[k + 1] = -100;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    for (let i = 0; i < CONFETTI; i++) this.positions[i * 3 + 1] = -100;
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

// --- Sommerfugle, der lander på en hånd, der holdes stille ---

const SWARM_CENTER = new THREE.Vector3(0, 1.15, -0.75);
const SWARM_SIZE = new THREE.Vector3(0.8, 0.35, 0.45);

export class Butterflies {
  constructor(stage) {
    this.stage = stage;
    this.list = [];
    const tex = wingTexture();
    this.wingGeo = new THREE.PlaneGeometry(0.04, 0.04).translate(0.02, 0, 0).rotateX(Math.PI / 2);
    this.wingMats = [CVI.white, CVI.sand, CYAN_LIGHT].map((c) => new THREE.MeshBasicMaterial({
      map: tex, color: c, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, toneMapped: false,
    }));
    this.bodyGeo = new THREE.CapsuleGeometry(0.004, 0.022, 4, 8).rotateX(Math.PI / 2);
    this.bodyMat = new THREE.MeshBasicMaterial({ color: CVI.navy });
    this.matrix = new THREE.Matrix4();
    this.desired = new THREE.Vector3();
    this.ahead = new THREE.Vector3();
  }

  spawn(count, origin) {
    this.clear();
    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(this.bodyGeo, this.bodyMat));
      const mat = this.wingMats[i % this.wingMats.length];
      const right = new THREE.Mesh(this.wingGeo, mat);
      const left = new THREE.Mesh(this.wingGeo, mat);
      left.scale.x = -1;
      group.add(right, left);
      group.position.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * 0.1, 0.05, (Math.random() - 0.5) * 0.1));
      this.stage.add(group);
      this.list.push({
        group, right, left,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.5 + Math.random() * 0.3, (Math.random() - 0.5) * 0.4),
        target: new THREE.Vector3(),
        nextTarget: 0,
        phase: Math.random() * 10,
        state: 'fly',
        perch: -1,
        offset: new THREE.Vector3(),
        leaveAt: Infinity,
        scaredUntil: 0,
      });
    }
  }

  // perches: [{ id, point, speed, still, hand }] i stage-koordinater. Hænder foretrækkes frem for ting.
  // scarers: hænder (eller musen), der skræmmer sommerfuglene væk, når de vifter tæt forbi.
  update(time, dt, perches, scarers = []) {
    const stillHand = perches.some((p) => p.hand && p.still > 0.6);
    for (const b of this.list) {
      let perch = b.perch >= 0 ? perches.find((p) => p.id === b.perch) : null;

      // Viftes der efter sommerfuglen, flyver den hurtigt væk fra hånden og lander ikke lige med det samme.
      for (const s of scarers) {
        if (s.speed < 0.6 || s.point.distanceTo(b.group.position) > 0.3) continue;
        if (b.state === 'perched' && b.perch === s.id) continue; // den sidder på hånden og følger med
        if (b.state === 'perched') this.onTakeoff?.(b.group.position);
        b.state = 'fly';
        b.perch = -1;
        perch = null;
        b.scaredUntil = time + 2;
        this.desired.subVectors(b.group.position, s.point).setY(0).normalize();
        b.velocity.copy(this.desired).multiplyScalar(1.2).setY(0.5);
        b.target.copy(b.group.position).addScaledVector(this.desired, 0.7).setY(SWARM_CENTER.y + 0.2);
        b.nextTarget = time + 1;
        break;
      }

      // På en ting bliver den kun siddende et stykke tid, og den letter hurtigere, når en hånd holdes stille.
      const leave = perch && !perch.hand && b.state === 'perched' && (time > b.leaveAt || (stillHand && Math.random() < dt * 0.4));
      if (b.state !== 'fly' && (!perch || perch.speed > 0.35 || leave)) {
        if (b.state === 'perched') this.onTakeoff?.(b.group.position);
        b.state = 'fly';
        b.perch = -1;
        b.velocity.set((Math.random() - 0.5) * 0.4, 0.6, (Math.random() - 0.5) * 0.4);
        if (leave) b.scaredUntil = time + 1.5;
      }

      if (b.state === 'fly' && time > b.scaredUntil) {
        for (const p of perches) {
          if (p.still < 0.6 || p.point.distanceTo(b.group.position) > 1.6) continue;
          if (this.list.filter((o) => o.perch === p.id).length >= 2) continue;
          if (Math.random() < dt * (p.hand ? 1.5 : 0.12)) {
            b.state = 'landing';
            b.perch = p.id;
            perch = p;
            b.offset.set((Math.random() - 0.5) * 0.03, 0.012, (Math.random() - 0.5) * 0.03);
            break;
          }
        }
      }

      let flap;
      if (b.state === 'perched') {
        b.group.position.copy(perch.point).add(b.offset);
        flap = 0.7 + 0.5 * Math.sin(time * 3 + b.phase);
      } else {
        if (b.state === 'landing') {
          b.target.copy(perch.point).add(b.offset);
          if (b.group.position.distanceTo(b.target) < 0.015) {
            b.state = 'perched';
            b.leaveAt = perch.hand ? Infinity : time + 6 + Math.random() * 8;
            this.onLand?.(b.group.position, perch);
          }
        } else if (time > b.nextTarget) {
          b.nextTarget = time + 1 + Math.random() * 2;
          b.target.set(
            SWARM_CENTER.x + (Math.random() - 0.5) * 2 * SWARM_SIZE.x,
            SWARM_CENTER.y + (Math.random() - 0.5) * 2 * SWARM_SIZE.y,
            SWARM_CENTER.z + (Math.random() - 0.5) * 2 * SWARM_SIZE.z,
          );
        }
        const speed = time < b.scaredUntil - 1 ? 1.1 : b.state === 'landing' ? 0.5 : 0.4;
        this.desired.subVectors(b.target, b.group.position);
        const dist = this.desired.length();
        this.desired.setLength(Math.min(speed, dist * 3));
        b.velocity.lerp(this.desired, Math.min(1, dt * 2.5));
        b.velocity.y += Math.sin(time * 9 + b.phase) * 0.6 * dt;
        b.group.position.addScaledVector(b.velocity, dt);
        if (b.velocity.lengthSq() > 1e-4) {
          this.ahead.copy(b.group.position).add(b.velocity);
          this.matrix.lookAt(this.ahead, b.group.position, UP);
          b.group.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(this.matrix), Math.min(1, dt * 6));
        }
        flap = 0.35 + 0.9 * Math.sin(time * 28 + b.phase);
      }
      b.right.rotation.z = flap;
      b.left.rotation.z = -flap;
    }
  }

  clear() {
    for (const b of this.list) b.group.removeFromParent();
    this.list = [];
  }
}
