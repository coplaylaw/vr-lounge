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
    mass: 0.12, kind: 'block', radius: 0.05,
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
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.034, 24), new THREE.MeshLambertMaterial({ color: 0x3b2416 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.075;
  cup.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 8, 16, Math.PI), white);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(0.039, 0.045, 0);
  cup.add(handle);

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
  item.data.steam = steam;
  return item;
}

const tmpUp = new THREE.Vector3();
export function updateCoffee(item, time) {
  const upright = tmpUp.copy(UP).applyQuaternion(item.mesh.quaternion).y > 0.8;
  item.data.steam.forEach((puff, i) => {
    const t = (time * 0.35 + i / 3) % 1;
    puff.position.set(Math.sin(time * 2 + i * 2) * 0.008, 0.09 + t * 0.12, 0);
    puff.scale.setScalar(0.03 + t * 0.05);
    puff.material.opacity = upright ? 0.35 * Math.sin(t * Math.PI) : 0;
  });
}

// --- Skud fra konfettikanonen ---

export class Projectiles {
  constructor(stage, physics) {
    this.stage = stage;
    this.world = physics.world;
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
        const body = new CANNON.Body({ mass: 0.02, shape: this.shape, linearDamping: 0.01 });
        shot = { mesh, body, life: 0 };
        body.addEventListener('collide', () => this.onImpact?.(shot));
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
      });
    }
  }

  // perches: [{ id, point, speed, still }] i stage-koordinater.
  update(time, dt, perches) {
    for (const b of this.list) {
      let perch = b.perch >= 0 ? perches.find((p) => p.id === b.perch) : null;
      if (b.state !== 'fly' && (!perch || perch.speed > 0.35)) {
        if (b.state === 'perched') this.onTakeoff?.(b.group.position);
        b.state = 'fly';
        b.perch = -1;
        b.velocity.set((Math.random() - 0.5) * 0.4, 0.6, (Math.random() - 0.5) * 0.4);
      }

      if (b.state === 'fly') {
        for (const p of perches) {
          if (p.still < 0.6 || p.point.distanceTo(b.group.position) > 1.6) continue;
          if (this.list.filter((o) => o.perch === p.id).length >= 2) continue;
          if (Math.random() < dt * 0.7) {
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
            this.onLand?.(b.group.position);
          }
        } else if (time > b.nextTarget) {
          b.nextTarget = time + 1 + Math.random() * 2;
          b.target.set(
            SWARM_CENTER.x + (Math.random() - 0.5) * 2 * SWARM_SIZE.x,
            SWARM_CENTER.y + (Math.random() - 0.5) * 2 * SWARM_SIZE.y,
            SWARM_CENTER.z + (Math.random() - 0.5) * 2 * SWARM_SIZE.z,
          );
        }
        const speed = b.state === 'landing' ? 0.5 : 0.4;
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
