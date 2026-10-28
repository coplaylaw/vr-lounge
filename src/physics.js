import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export { CANNON };

const STEP = 1 / 72;

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
    this.items = new Set();
  }

  addStatic(shape, position, quaternion) {
    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
    body.addShape(shape);
    body.position.set(position.x, position.y, position.z);
    if (quaternion) body.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    this.world.addBody(body);
    return body;
  }

  // Gulv, loft og de otte vægge (også vinduerne, så intet ryger ud).
  addRoom(radius, height) {
    const flat = new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0);
    this.addStatic(new CANNON.Plane(), { x: 0, y: 0, z: 0 }, flat);
    const down = new CANNON.Quaternion().setFromEuler(Math.PI / 2, 0, 0);
    this.addStatic(new CANNON.Plane(), { x: 0, y: height, z: 0 }, down);
    const wall = new CANNON.Box(new CANNON.Vec3(2, height / 2 + 0.5, 0.25));
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const q = new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
      const d = radius + 0.25;
      this.addStatic(wall, { x: -Math.sin(angle) * d, y: height / 2, z: -Math.cos(angle) * d }, q);
    }
  }

  // Et objekt, der kan gribes og kastes. radius bruges til greb og glød.
  add(mesh, shape, { mass = 0.2, kind = 'thing', radius = 0.05, holdOffset = null } = {}) {
    const body = new CANNON.Body({
      mass,
      shape,
      linearDamping: 0.05,
      angularDamping: 0.1,
      sleepSpeedLimit: 0.06,
      sleepTimeLimit: 0.6,
    });
    body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
    body.quaternion.set(mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w);
    this.world.addBody(body);
    this.stage.add(mesh);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex, color: 0x36d6ff, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.setScalar(radius * 5);
    glow.visible = false;
    glow.raycast = () => {}; // gløden skal ikke kunne rammes af strålen
    mesh.add(glow);

    const item = {
      mesh, body, kind, radius, holdOffset, glow,
      heldBy: null, frozen: false, highlight: false, appear: 1, data: {},
    };
    body.userData = { item };
    this.items.add(item);
    return item;
  }

  remove(item) {
    this.world.removeBody(item.body);
    item.mesh.removeFromParent();
    this.items.delete(item);
  }

  // Objektet følger en hånd: kinematisk, så det stadig kan skubbe til andre ting.
  hold(item, holder) {
    item.heldBy = holder;
    item.body.type = CANNON.Body.KINEMATIC;
    item.body.velocity.setZero();
    item.body.angularVelocity.setZero();
    item.body.wakeUp();
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
