import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CANNON } from './physics.js';
import { signTexture, beamMaterial } from './materials.js';
import { CVI } from './palette.js';

export const DESK_TOP = 0.72;
export const DESK = { width: 1.5, depth: 0.45, z: -0.62 };
export const PRINTER = new THREE.Vector3(0.5, DESK_TOP, -0.66);
export const PAD = new THREE.Vector3(-0.3, DESK_TOP, -0.6);

// Bordet foran gæsten med diskettemaskinen (til højre) og printpladen (til venstre).
export class Desk {
  constructor(stage, physics) {
    // Lys bordplade som kontorets hvide borde.
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(DESK.width, 0.04, DESK.depth),
      new THREE.MeshLambertMaterial({ color: 0xf4f4f2 }),
    );
    top.position.set(0, DESK_TOP - 0.02, DESK.z);
    stage.add(top);
    physics.addStatic(new CANNON.Box(new CANNON.Vec3(DESK.width / 2, 0.02, DESK.depth / 2)), top.position);

    const cyan = new THREE.MeshBasicMaterial({ color: CVI.cyan, toneMapped: false });
    for (const side of [1, -1]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(DESK.width, 0.008, 0.008), cyan);
      edge.position.set(0, DESK_TOP - 0.004, DESK.z + (side * DESK.depth) / 2);
      stage.add(edge);
    }

    // Spottet over bordet, så tingene på det får lidt ekstra lys.
    const lamp = new THREE.PointLight(0xffeedb, 1.4, 3);
    lamp.position.set(0, 1.9, -0.6);
    stage.add(lamp);

    const front = new THREE.Mesh(
      new THREE.BoxGeometry(DESK.width, DESK_TOP - 0.04, 0.03),
      new THREE.MeshLambertMaterial({ color: CVI.navy }),
    );
    front.position.set(0, (DESK_TOP - 0.04) / 2, DESK.z - DESK.depth / 2 + 0.03);
    stage.add(front);
    physics.addStatic(new CANNON.Box(new CANNON.Vec3(DESK.width / 2, (DESK_TOP - 0.04) / 2, 0.015)), front.position);

    // Diskettemaskinen.
    const printer = new THREE.Group();
    printer.position.copy(PRINTER);
    stage.add(printer);
    const casing = new THREE.Mesh(
      new RoundedBoxGeometry(0.28, 0.2, 0.26, 4, 0.03),
      new THREE.MeshLambertMaterial({ color: 0xdfe7ef }),
    );
    casing.position.y = 0.1;
    printer.add(casing);
    physics.addStatic(new CANNON.Box(new CANNON.Vec3(0.14, 0.1, 0.13)), PRINTER.clone().setY(DESK_TOP + 0.1));

    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.024, 0.01), new THREE.MeshBasicMaterial({ color: 0x0b1424 }));
    slot.position.set(0, 0.14, 0.128);
    printer.add(slot);
    this.slotGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.005, 0.004),
      new THREE.MeshBasicMaterial({ color: CVI.cyan, transparent: true, toneMapped: false }),
    );
    this.slotGlow.position.set(0, 0.158, 0.131);
    printer.add(this.slotGlow);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.0375),
      new THREE.MeshBasicMaterial({ map: signTexture('INDSÆT DISKETTE'), toneMapped: false }),
    );
    sign.position.set(0, 0.075, 0.131);
    printer.add(sign);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.004, 0.16),
      new THREE.MeshBasicMaterial({ color: CVI.cyan, transparent: true, opacity: 0.6, toneMapped: false }),
    );
    roof.position.y = 0.201;
    printer.add(roof);

    // Printpladen, hvor tingene dukker op.
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.13, 0.012, 48),
      new THREE.MeshLambertMaterial({ color: CVI.navy }),
    );
    pad.position.copy(PAD).setY(DESK_TOP + 0.006);
    stage.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.005, 8, 64), cyan);
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(PAD).setY(DESK_TOP + 0.013);
    stage.add(ring);
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.4, 32, 1, true),
      beamMaterial(CVI.cyan, 0.45, { invert: true }),
    );
    this.beam.position.copy(PAD).setY(DESK_TOP + 0.2);
    this.beam.visible = false;
    stage.add(this.beam);

    this.slotFront = PRINTER.clone().add(new THREE.Vector3(0, 0.14, 0.15));
    this.slotInside = PRINTER.clone().add(new THREE.Vector3(0, 0.14, 0.0));
    this.printTime = -1;
  }

  startPrint() {
    this.printTime = 0;
  }

  get printing() {
    return this.printTime >= 0;
  }

  // diskNear: 0..1, hvor tæt en holdt diskette er på åbningen.
  update(time, dt, diskNear) {
    this.slotGlow.material.opacity = 0.3 + diskNear * 0.7 * (0.6 + 0.4 * Math.sin(time * 12));
    if (this.printTime < 0) return;
    this.printTime += dt;
    this.beam.visible = this.printTime < 2.2;
    this.beam.scale.y = 0.6 + 0.4 * Math.sin(this.printTime * 20);
    if (this.printTime > 2.2) this.printTime = -1;
  }
}
