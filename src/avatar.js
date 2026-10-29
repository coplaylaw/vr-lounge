import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CVI } from './palette.js';

// Gæsten selv: et hoved med Quest-headset og et par skuldre. Den ligger på lag 5, som kun kameraet
// og robottens kamera (gennem headsettet på bænken) ser, så gæsten kan se sig selv udefra.
export const AVATAR_LAYER = 5;

export class Avatar {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    const skin = new THREE.MeshLambertMaterial({ color: 0xe7eaee });
    const white = new THREE.MeshLambertMaterial({ color: 0xf4f5f7 });
    const black = new THREE.MeshLambertMaterial({ color: 0x18191b });

    this.head = new THREE.Group();
    this.group.add(this.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.095, 24, 16), skin);
    skull.scale.set(0.92, 1.12, 1.02);
    skull.position.set(0, 0.0, 0.03);
    this.head.add(skull);
    const visor = new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.11, 0.1, 3, 0.03), white);
    visor.position.set(0, 0.0, -0.075);
    this.head.add(visor);
    const front = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.085, 0.01, 2, 0.008), black);
    front.position.set(0, 0.0, -0.126);
    this.head.add(front);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 32), black);
    strap.rotation.x = Math.PI / 2;
    strap.scale.set(0.95, 1.15, 1);
    strap.position.set(0, 0.0, 0.02);
    this.head.add(strap);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.192, 0.008, 0.102),
      new THREE.MeshBasicMaterial({ color: CVI.cyan, toneMapped: false }),
    );
    stripe.position.set(0, -0.03, -0.075);
    this.head.add(stripe);

    // Hals og skuldre følger kun hovedets drejning til siden.
    this.body = new THREE.Group();
    this.group.add(this.body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 16), skin);
    neck.position.set(0, -0.15, 0.04);
    this.body.add(neck);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.25, 6, 16), new THREE.MeshLambertMaterial({ color: CVI.navy }));
    torso.scale.set(1.25, 1, 0.6);
    torso.position.set(0, -0.42, 0.06);
    this.body.add(torso);

    this.group.traverse((o) => o.layers.set(AVATAR_LAYER));
    this.euler = new THREE.Euler();
  }

  // viewer: kameraet, gæsten ser med (i VR headsettet).
  update(viewer) {
    viewer.getWorldPosition(this.group.position);
    viewer.getWorldQuaternion(this.head.quaternion);
    this.euler.setFromQuaternion(this.head.quaternion, 'YXZ');
    this.body.rotation.set(0, this.euler.y, 0);
  }
}
