import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CVI } from './palette.js';

export { CANNON };

const STEP = 1 / 72;
// Små kasser (klodserne er 7 cm) ryster i cannon-es og glider langsomt af hinanden.
// Derfor lægges en ting til at sove, så snart den næsten ligger stille, og den vågner
// først igen, når noget rammer den hurtigere end SLEEP_SPEED.
const SLEEP_SPEED = 0.2;
const SETTLE = { speed: 0.15, spin: 0.8, after: 0.1 };

// Fysik i scenens lokale koordinater (stage), så alt følger med, når scenen drejes hen til gæsten.
export class Physics {
  constructor(stage, glowTex) {
    this.stage = stage;
    this.glowTex = glowTex;
    const world = (this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) }));
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.allowSleep = true;
    world.defaultContactMaterial.friction = 0.5;
    world.defaultContactMaterial.restitution = 0.3;
    world.solver.iterations = 20;
    // Klodser mod klodser: ingen hop og mere friktion, så de kan stables.
    this.blockMaterial = new CANNON.Material('block');
    world.addContactMaterial(new CANNON.ContactMaterial(this.blockMaterial, this.blockMaterial, { friction: 0.8, restitution: 0 }));
    this.items = new Set();
    this.onImpact = null; // (item, surface, speed, other) når en ting rammer noget
  }

  // surface bruges til at vælge lyden, når noget rammer: table, floor, ceiling, wall, window.
  addStatic(shape, position, quaternion, surface = 'table') {
    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
    body.userData = { surface };
    body.addShape(shape);
    body.position.set(position.x, position.y, position.z);
    if (quaternion) body.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    this.world.addBody(body);
    return body;
  }

  // Gulv, loft og de fire vægge (også vinduerne, så intet ryger ud).
  addRoom({ minX, maxX, minZ, maxZ, height }) {
    const flat = new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0);
    this.addStatic(new CANNON.Plane(), { x: 0, y: 0, z: 0 }, flat, 'floor');
    const down = new CANNON.Quaternion().setFromEuler(Math.PI / 2, 0, 0);
    this.addStatic(new CANNON.Plane(), { x: 0, y: height, z: 0 }, down, 'ceiling');
    const t = 0.25;
    const w = (maxX - minX) / 2 + t * 2;
    const d = (maxZ - minZ) / 2 + t * 2;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const y = height / 2;
    // Vinduer foran og til højre, glasvæg bagved og den spartlede væg til venstre.
    this.addStatic(new CANNON.Box(new CANNON.Vec3(w, y, t)), { x: cx, y, z: minZ - t }, null, 'window');
    this.addStatic(new CANNON.Box(new CANNON.Vec3(w, y, t)), { x: cx, y, z: maxZ + t }, null, 'glass');
    this.addStatic(new CANNON.Box(new CANNON.Vec3(t, y, d)), { x: minX - t, y, z: cz }, null, 'wall');
    this.addStatic(new CANNON.Box(new CANNON.Vec3(t, y, d)), { x: maxX + t, y, z: cz }, null, 'window');
  }

  // Fast kasse til møbler: størrelse og midtpunkt i meter, drejet om y.
  addBox(size, center, rotY = 0) {
    const q = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
    return this.addStatic(new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)), center, q);
  }

  // Et objekt, der kan gribes og kastes. radius bruges til greb og glød.
  add(mesh, shape, { mass = 0.2, kind = 'thing', radius = 0.05, holdOffset = null, material } = {}) {
    const body = new CANNON.Body({
      mass,
      shape,
      material,
      linearDamping: 0.05,
      angularDamping: 0.1,
      sleepSpeedLimit: SLEEP_SPEED,
      sleepTimeLimit: 0.6,
    });
    body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
    body.quaternion.set(mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w);
    this.world.addBody(body);
    this.stage.add(mesh);

    // Normal blanding (ikke additiv), så gløden også kan ses mod de lyse vægge.
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex, color: CVI.cyan, transparent: true, opacity: 0.6, depthWrite: false,
    }));
    glow.scale.setScalar(radius * 5);
    glow.visible = false;
    glow.raycast = () => {}; // gløden skal ikke kunne rammes af strålen
    mesh.add(glow);

    const item = {
      mesh, body, kind, radius, holdOffset, glow,
      heldBy: null, frozen: false, highlight: false, appear: 1, still: 0, data: {},
    };
    body.userData = { item };
    body.addEventListener('collide', (e) => {
      const speed = Math.abs(e.contact.getImpactVelocityAlongNormal());
      const other = e.body.userData?.item;
      const surface = other ? 'item' : e.body.userData?.surface;
      if (surface) this.onImpact?.(item, surface, speed, other);
    });
    this.items.add(item);
    return item;
  }

  remove(item) {
    this.world.removeBody(item.body);
    item.mesh.removeFromParent();
    this.items.delete(item);
    this.wakeNear(item.mesh.position);
  }

  // Ting, der lå oven på den, der tages væk, skal kunne falde ned igen.
  wakeNear(position, radius = 0.3) {
    for (const other of this.items) {
      if (other.mesh.position.distanceTo(position) > radius) continue;
      other.body.wakeUp();
      other.still = 0;
    }
  }

  // Objektet følger en hånd: kinematisk, så det stadig kan skubbe til andre ting.
  hold(item, holder) {
    item.heldBy = holder;
    item.body.type = CANNON.Body.KINEMATIC;
    item.body.velocity.setZero();
    item.body.angularVelocity.setZero();
    this.wakeNear(item.mesh.position);
  }

  moveHeld(item, position, quaternion, dt) {
    const b = item.body;
    if (dt > 0) {
      b.velocity.set(
        (position.x - b.position.x) / dt,
        (position.y - b.position.y) / dt,
        (position.z - b.position.z) / dt,
      );
    }
    b.position.set(position.x, position.y, position.z);
    b.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    item.mesh.position.copy(position);
    item.mesh.quaternion.copy(quaternion);
  }

  release(item, velocity, angularVelocity) {
    item.heldBy = null;
    const b = item.body;
    b.type = CANNON.Body.DYNAMIC;
    b.velocity.set(velocity.x, velocity.y, velocity.z);
    b.angularVelocity.set(angularVelocity.x, angularVelocity.y, angularVelocity.z);
    b.wakeUp();
  }

  // Tager objektet ud af fysikken, mens det animeres (fx når en diskette glider ind i maskinen).
  freeze(item) {
    item.frozen = true;
    item.body.type = CANNON.Body.KINEMATIC;
    item.body.collisionResponse = false;
    item.body.velocity.setZero();
  }

  launch(item, velocity) {
    const b = item.body;
    b.position.set(item.mesh.position.x, item.mesh.position.y, item.mesh.position.z);
    b.velocity.set(velocity.x, velocity.y, velocity.z);
    b.type = CANNON.Body.DYNAMIC;
    b.wakeUp();
  }

  step(dt) {
    this.world.step(STEP, dt, 4);
    for (const item of this.items) {
      const b = item.body;
      if (!item.heldBy && !item.frozen && b.sleepState !== CANNON.Body.SLEEPING) {
        const settle = item.settle ?? SETTLE;
        const still = b.velocity.length() < settle.speed && b.angularVelocity.length() < settle.spin;
        item.still = still ? item.still + dt : 0;
        if (item.still > SETTLE.after) b.sleep();
      }
      if (!item.heldBy && !item.frozen) {
        item.mesh.position.copy(item.body.position);
        item.mesh.quaternion.copy(item.body.quaternion);
      }
      if (item.appear < 1) {
        item.appear = Math.min(1, item.appear + dt * 2.2);
        const t = item.appear - 1;
        item.mesh.scale.setScalar(1 + 2.7 * t * t * t + 1.7 * t * t); // easeOutBack
      }
      item.glow.visible = item.highlight && !item.heldBy;
    }
  }
}
