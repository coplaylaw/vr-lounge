import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CANNON } from './physics.js';
import { beamMaterial } from './materials.js';
import { SpeechPanel } from './panel.js';
import { CVI, CYAN_LIGHT } from './palette.js';

const HOME = new THREE.Vector3(0, 1.22, -1.15);
// Hvor robotten holder hånden frem til high five: inden for rækkevidde af en siddende gæst.
const HIGH_FIVE_SPOT = new THREE.Vector3(0.14, 1.12, -0.5);
const HEAD_RADIUS = 0.15;

// CO:BOT: en lille svævende robot med skærmansigt og to løse hænder, inspireret af First Contact.
export class Robot {
  constructor(stage, physics, speaker, glowTex) {
    this.group = new THREE.Group();
    this.group.position.copy(HOME);
    stage.add(this.group);

    const shell = new THREE.MeshLambertMaterial({ color: 0xeef1f4 });
    const dark = new THREE.MeshLambertMaterial({ color: CVI.navy });
    const cyan = new THREE.MeshBasicMaterial({ color: CVI.cyan, toneMapped: false });

    this.head = new THREE.Group();
    this.group.add(this.head);
    this.head.add(new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.22, 0.2, 4, 0.06), shell));

    this.faceCanvas = document.createElement('canvas');
    this.faceCanvas.width = 256;
    this.faceCanvas.height = 160;
    this.faceTexture = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTexture.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.25, 0.156),
      new THREE.MeshBasicMaterial({ map: this.faceTexture, toneMapped: false }),
    );
    face.position.z = 0.101;
    this.head.add(face);

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 20), dark);
      ear.rotation.z = Math.PI / 2;
      ear.position.x = side * 0.155;
      this.head.add(ear);
      const earRing = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 24), cyan);
      earRing.rotation.y = Math.PI / 2;
      earRing.position.x = side * 0.171;
      this.head.add(earRing);
    }
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.08, 8), dark);
    antenna.position.y = 0.15;
    this.head.add(antenna);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 16, 8),
      new THREE.MeshBasicMaterial({ color: CVI.orange, toneMapped: false }),
    );
    bulb.position.y = 0.195;
    this.head.add(bulb);
    const bulbGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: CVI.orange, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    bulbGlow.scale.setScalar(0.12);
    bulb.add(bulbGlow);

    const body = new THREE.Group();
    body.position.y = -0.2;
    this.group.add(body);
    body.add(new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.13, 0.12, 4, 0.04), shell));
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.014, 0.01), dark);
    slot.position.set(0, 0.02, 0.06);
    body.add(slot);
    this.slotLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.004, 0.004),
      new THREE.MeshBasicMaterial({ color: CVI.cyan, transparent: true, toneMapped: false }),
    );
    this.slotLight.position.set(0, 0.032, 0.062);
    body.add(this.slotLight);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.172, 0.012, 0.122), cyan);
    belt.position.y = -0.04;
    body.add(belt);
    const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.025, 0.03, 20), dark);
    thruster.position.y = -0.08;
    body.add(thruster);
    const flame = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.1, 0.35, 16, 1, true),
      beamMaterial(CVI.cyan, 0.3),
    );
    flame.position.y = -0.27;
    body.add(flame);

    // Løse hænder, der svæver ved siden af kroppen.
    this.hands = [-1, 1].map((side) => {
      const hand = new THREE.Group();
      hand.add(new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.08, 0.035, 3, 0.015), shell));
      const knuckles = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.006, 0.037), cyan);
      knuckles.position.y = 0.02;
      hand.add(knuckles);
      hand.userData.rest = new THREE.Vector3(side * 0.2, -0.17, 0.03);
      hand.position.copy(hand.userData.rest);
      this.group.add(hand);
      return hand;
    });
    this.handGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: CVI.cyan, transparent: true, opacity: 0, depthWrite: false,
    }));
    this.handGlow.scale.setScalar(0.3);
    this.hands[1].add(this.handGlow);

    // Blød skygge på gulvet under robotten.
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.7).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.shadow.position.set(HOME.x, 0.012, HOME.z);
    stage.add(this.shadow);

    // Kollider om hovedet, så ting kan ramme robotten.
    this.collider = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, shape: new CANNON.Sphere(HEAD_RADIUS) });
    physics.world.addBody(this.collider);
    this.collider.addEventListener('collide', (e) => {
      const speed = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (speed > 0.8) this.onHit?.(e.body.userData?.item ?? null);
    });

    this.panel = new SpeechPanel(speaker, 0.72);
    const p = new THREE.Vector3(0.62, 1.48, -1.2);
    this.panel.mesh.position.copy(p);
    this.panel.mesh.rotation.y = Math.atan2(-p.x, -p.z);
    stage.add(this.panel.mesh);

    this.onHit = null;
    this.tmp = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.mode = 'idle'; // idle | wave | highfive
    this.modeUntil = 0;
    this.expression = 'idle';
    this.expressionUntil = 0;
    this.recoil = new THREE.Vector3();
    this.recoilVelocity = new THREE.Vector3();
    this.spin = 0;
    this.yaw = 0;
    this.hitCooldown = 0;
    this.slotFlash = 0;
    this.nextBlink = 2;
    this.faceKey = '';
  }

  express(name, seconds, time) {
    this.expression = name;
    this.expressionUntil = time + seconds;
  }

  wave(seconds, time) {
    this.mode = 'wave';
    this.modeUntil = time + seconds;
  }

  setHighFive(on) {
    this.mode = on ? 'highfive' : 'idle';
    this.modeUntil = Infinity;
  }

  celebrate(time) {
    this.spin = Math.PI * 2;
    this.express('happy', 2, time);
  }

  // Returnerer true, hvis robotten reagerer (ikke lige ramt).
  hit(time) {
    if (time < this.hitCooldown) return false;
    this.hitCooldown = time + 0.6;
    this.recoilVelocity.set((Math.random() - 0.5) * 1.5, 0.6, -1.8);
    this.express('dizzy', 1.6, time);
    return true;
  }

  headPosition(out) {
    return out.copy(this.group.position).add(this.head.position);
  }

  highFiveHand(out) {
    return out.copy(this.group.position).add(this.hands[1].position);
  }

  get highFiveMesh() {
    return this.hands[1];
  }

  chestSlot(out) {
    this.slotFlash = 1;
    // Lidt foran brystet, så disketten ikke rammer robottens eget hoved på vej op.
    return out.copy(this.group.position).add(this.tmp.set(0, -0.2, 0.2));
  }

  update(time, dt, viewerLocal) {
    this.panel.update(dt, time);
    if (time > this.modeUntil) this.mode = 'idle';
    if (time > this.expressionUntil) this.expression = 'idle';

    // Fjeder tilbage efter et slag.
    this.recoilVelocity.addScaledVector(this.recoil, -40 * dt).multiplyScalar(Math.max(0, 1 - 6 * dt));
    this.recoil.addScaledVector(this.recoilVelocity, dt);
    this.group.position.copy(HOME).add(this.recoil);
    this.group.position.y += Math.sin(time * 1.6) * 0.02;
    this.shadow.position.x = this.group.position.x;
    this.shadow.position.z = this.group.position.z;

    // Hovedet følger gæsten.
    this.headPosition(this.tmp);
    const dx = viewerLocal.x - this.tmp.x;
    const dy = viewerLocal.y - this.tmp.y;
    const dz = viewerLocal.z - this.tmp.z;
    const yaw = Math.atan2(dx, dz);
    const pitch = THREE.MathUtils.clamp(-Math.atan2(dy, Math.hypot(dx, dz)), -0.5, 0.5);
    const k = Math.min(1, dt * 4);
    if (this.spin > 0) this.spin = Math.max(0, this.spin - dt * 9);
    const tilt = this.expression === 'dizzy' ? Math.sin(time * 14) * 0.25 : 0;
    this.head.rotation.order = 'YXZ';
    this.yaw += (yaw - this.yaw) * k;
    this.head.rotation.y = this.yaw + this.spin;
    this.head.rotation.x += (pitch - this.head.rotation.x) * k;
    this.head.rotation.z += (tilt - this.head.rotation.z) * k;

    // Hænder: hvile, vinke eller high five.
    this.hands.forEach((hand, i) => {
      const target = this.tmp.copy(hand.userData.rest);
      target.y += Math.sin(time * 2 + i * 2) * 0.012;
      let rotZ = 0;
      if (i === 1 && this.mode === 'wave') {
        target.set(0.24, 0.06, 0.06);
        rotZ = Math.sin(time * 10) * 0.5;
      } else if (i === 1 && this.mode === 'highfive') {
        target.copy(HIGH_FIVE_SPOT).sub(this.group.position);
        target.y += Math.sin(time * 3) * 0.015;
      }
      hand.position.lerp(target, Math.min(1, dt * 6));
      hand.rotation.z += (rotZ - hand.rotation.z) * Math.min(1, dt * 10);
    });
    this.handGlow.material.opacity = this.mode === 'highfive' ? 0.4 + 0.3 * Math.sin(time * 5) : 0;

    this.slotFlash = Math.max(0, this.slotFlash - dt * 1.5);
    this.slotLight.material.opacity = 0.35 + this.slotFlash * 0.65;

    this.headPosition(this.tmp);
    this.collider.position.set(this.tmp.x, this.tmp.y, this.tmp.z);

    if (time > this.nextBlink + 0.13) this.nextBlink = time + 2 + Math.random() * 3;
    const blinking = time > this.nextBlink && this.expression === 'idle';
    const mouth = this.panel.isTyping ? (Math.sin(time * 18) > 0 ? 2 : 1) : 0;
    const key = `${this.expression}|${blinking}|${mouth}`;
    if (key !== this.faceKey) {
      this.faceKey = key;
      this.drawFace(this.expression, blinking, mouth);
    }
  }

  drawFace(expression, blinking, mouth) {
    const g = this.faceCanvas.getContext('2d');
    g.clearRect(0, 0, 256, 160);
    g.fillStyle = CVI.navy;
    g.beginPath();
    g.roundRect(0, 0, 256, 160, 28);
    g.fill();

    g.save();
    g.fillStyle = g.strokeStyle = CYAN_LIGHT;
    g.shadowColor = CVI.cyan;
    g.shadowBlur = 14;
    g.lineWidth = 10;
    g.lineCap = 'round';
    for (const x of [84, 172]) {
      const y = 66;
      g.beginPath();
      if (expression === 'happy') {
        g.arc(x, y + 12, 24, Math.PI * 1.15, Math.PI * 1.85);
        g.stroke();
      } else if (expression === 'dizzy') {
        g.moveTo(x - 18, y - 18);
        g.lineTo(x + 18, y + 18);
        g.moveTo(x + 18, y - 18);
        g.lineTo(x - 18, y + 18);
        g.stroke();
      } else if (expression === 'love') {
        g.fillStyle = CVI.orange;
        g.shadowColor = CVI.orange;
        g.moveTo(x, y + 22);
        g.bezierCurveTo(x - 34, y - 2, x - 18, y - 30, x, y - 12);
        g.bezierCurveTo(x + 18, y - 30, x + 34, y - 2, x, y + 22);
        g.fill();
      } else {
        const h = blinking ? 6 : 52;
        g.roundRect(x - 17, y - h / 2, 34, h, 14);
        g.fill();
      }
    }
    g.beginPath();
    if (mouth > 0) {
      g.ellipse(128, 124, 16, mouth === 2 ? 12 : 5, 0, 0, Math.PI * 2);
      g.fill();
    } else if (expression === 'dizzy') {
      g.moveTo(108, 126);
      g.quadraticCurveTo(118, 116, 128, 126);
      g.quadraticCurveTo(138, 136, 148, 126);
      g.stroke();
    } else {
      g.arc(128, 110, 18, Math.PI * 0.2, Math.PI * 0.8);
      g.stroke();
    }
    g.restore();
    this.faceTexture.needsUpdate = true;
  }
}
