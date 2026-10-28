import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CANNON } from './physics.js';
import { CVI } from './palette.js';

// Tingene i rummet, der reagerer, når de bliver ramt: elgmaleriet hænger skævt, vasen vælter,
// neonskiltet blafrer og gulvlampen blinker. Lampen tændes og slukkes med snoren, og headsettene
// på bænken kan tages op og holdes for øjnene. Robotten flyver hen og retter maleriet og vasen.

// Lag, som kun gæstens egne øjne ser (billedet i headsettet), så det ikke kommer med på fotos.
export const VIEW_LAYER = 6;

const FIX_AFTER = 2.5; // sekunder før robotten tager sig af noget

function createHeadset(physics, position) {
  const group = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xfafafa });
  const black = new THREE.MeshLambertMaterial({ color: 0x18191b });
  group.add(new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.11, 0.1, 3, 0.03), white));
  const face = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.09, 0.02, 2, 0.01), black);
  face.position.z = 0.05;
  group.add(face);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 24, Math.PI), black);
  strap.rotation.set(0, -Math.PI / 2, 0);
  strap.position.set(0, 0.01, -0.05);
  group.add(strap);
  group.position.copy(position);
  const item = physics.add(group, new CANNON.Box(new CANNON.Vec3(0.095, 0.055, 0.06)), {
    mass: 0.5, kind: 'headset', radius: 0.1,
  });
  item.body.sleep();
  return item;
}

// Rund maske med kant og tekst over billedet i headsettet.
function maskTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(256, 256, 170, 256, 256, 256);
  grad.addColorStop(0, 'rgba(10,16,28,0)');
  grad.addColorStop(0.75, 'rgba(10,16,28,0.6)');
  grad.addColorStop(1, 'rgba(10,16,28,1)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = CVI.cyan;
  g.lineWidth = 4;
  g.beginPath();
  g.arc(256, 256, 236, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = CVI.cyan;
  g.font = '600 22px "Segoe UI", Roboto, sans-serif';
  g.textAlign = 'center';
  g.fillText('● CO:BOT-KAMERA', 256, 470);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Props {
  // refs: fra buildWorld (painting, vase, neon, lamp, headsetSpots).
  // render(target, camera) tegner scenen til en render target.
  constructor({ scene, physics, input, robot, sound, refs, render }) {
    this.physics = physics;
    this.robot = robot;
    this.sound = sound;
    this.render = render;
    this.refs = refs;
    this.onEvent = null; // (name) til robottens replikker: painting, vase, lamp-off, headset

    // Lampen tændes og slukkes ved at pege på den (eller snoren) og trykke.
    const lamp = refs.lamp;
    for (const mesh of [lamp.shade, lamp.bulb, lamp.cord]) input.addClickable(mesh, () => this.toggleLamp());

    // Billedet i headsettet: robottens kamera, set gennem en rund maske lige foran øjnene.
    this.viewTarget = new THREE.WebGLRenderTarget(512, 512);
    this.viewTarget.texture.colorSpace = THREE.SRGBColorSpace;
    this.viewCamera = new THREE.PerspectiveCamera(75, 1, 0.05, 80);
    this.viewCamera.layers.enable(5);
    this.view = new THREE.Group();
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.36),
      new THREE.MeshBasicMaterial({ map: this.viewTarget.texture, depthTest: false, depthWrite: false }),
    );
    const mask = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.36),
      new THREE.MeshBasicMaterial({ map: maskTexture(), transparent: true, depthTest: false, depthWrite: false }),
    );
    screen.renderOrder = 1000;
    mask.renderOrder = 1001;
    mask.position.z = 0.001;
    this.view.add(screen, mask);
    this.view.traverse((o) => o.layers.set(VIEW_LAYER));
    this.view.visible = false;
    scene.add(this.view);

    this.tmp = new THREE.Vector3();
    this.tmpQ = new THREE.Quaternion();
    this.reset();
  }

  reset() {
    const { painting, vase, neon, lamp } = this.refs;
    this.painting = { angle: 0, velocity: 0, rest: 0, fixAt: Infinity };
    painting.rotation.z = 0;
    this.vase = { state: 'up', tilt: 0, velocity: 0, wobble: 0, wobbleTime: 0, axis: new THREE.Vector3(1, 0, 0), fixAt: Infinity };
    vase.quaternion.identity();
    vase.position.y = vase.userData.baseY ??= vase.position.y;
    this.neonFlicker = 0;
    neon.material.opacity = 1;
    this.lampOn = true;
    this.lampLevel = 1;
    this.lampFlicker = 0;
    this.cordTug = 0;
    lamp.level.value = 1;
    this.lampOffSeen = false;
    this.headsetSeen = false;
    this.headsets = this.refs.headsetSpots.map((p) => createHeadset(this.physics, p));
    this.worn = null;
    this.view.visible = false;
  }

  // En ting eller et skud ramte en af tingene. surface er fysikkens navn for fladen.
  hit(surface, speed, at, time) {
    if (surface === 'painting' && speed > 0.5) {
      const p = this.painting;
      const side = at.x > this.refs.painting.position.x ? 1 : -1;
      p.velocity += side * Math.min(2.5, 0.5 + speed * 0.5);
      p.rest = THREE.MathUtils.clamp(p.rest + side * (0.05 + Math.random() * 0.08), -0.28, 0.28);
      p.fixAt = Math.abs(p.rest) > 0.03 ? time + FIX_AFTER : Infinity;
      this.sound.play('props/painting-swing', { at: this.refs.painting.position, volume: Math.min(1, 0.4 + speed / 4), gap: 0.4 });
      return true;
    }
    if (surface === 'vase' && speed > 0.4) {
      const v = this.vase;
      const pos = this.refs.vase.position;
      if (v.state === 'up' && speed > 1.1) {
        // Vasen vælter væk fra det, der ramte den.
        const push = this.tmp.set(pos.x - at.x, 0, pos.z - at.z);
        if (push.lengthSq() < 1e-6) push.set(1, 0, 0);
        push.normalize();
        v.axis.set(push.z, 0, -push.x);
        Object.assign(v, { state: 'falling', velocity: 1.5, fixAt: Infinity });
        this.sound.play('props/vase-topple', { at: pos, ref: 2 });
      } else if (v.state === 'up') {
        v.wobble = Math.min(0.15, 0.04 + speed * 0.05);
        v.wobbleTime = 0;
        this.sound.play('impact/glass', { at: pos, volume: 0.6, ref: 2 });
      }
      return true;
    }
    if (surface === 'neon' && speed > 0.3) {
      if (this.neonFlicker <= 0) this.sound.play('props/neon-flicker', { at: this.refs.neon.position, ref: 2 });
      this.neonFlicker = 1.8;
      return true;
    }
    if (surface === 'lamp' && speed > 0.3) {
      this.lampFlicker = 1.2;
      this.sound.play('props/neon-flicker', { at: this.refs.lamp.shade.position, volume: 0.5, ref: 2, gap: 1 });
      return true;
    }
    return false;
  }

  toggleLamp() {
    this.lampOn = !this.lampOn;
    this.cordTug = 1;
    this.sound.play('props/lamp-switch', { at: this.refs.lamp.cord.position, ref: 2 });
    if (!this.lampOn && !this.lampOffSeen) {
      this.lampOffSeen = true;
      this.onEvent?.('lamp-off');
    }
  }

  // Næste ting, robotten skal rette, når den har tid: { kind, spot, look, onFix } eller null.
  nextFix(time) {
    const { painting, vase } = this.refs;
    if (time > this.painting.fixAt) {
      this.painting.fixAt = Infinity;
      return {
        kind: 'painting',
        spot: painting.position.clone().add(new THREE.Vector3(0.25, -0.75, 0.5)),
        look: painting.position.clone().setY(1.8),
        onFix: () => {
          this.painting.rest = 0;
          this.painting.velocity += -Math.sign(this.painting.angle) * 0.3;
          this.sound.play('robot/fix', { at: painting.position, ref: 2 });
        },
      };
    }
    if (time > this.vase.fixAt) {
      this.vase.fixAt = Infinity;
      const pos = vase.position;
      return {
        kind: 'vase',
        spot: new THREE.Vector3(pos.x - 0.6, pos.y + 0.35, pos.z),
        look: pos.clone().setY(pos.y + 0.15),
        onFix: () => {
          this.vase.state = 'rising';
          this.sound.play('robot/fix', { at: pos, ref: 2 });
        },
      };
    }
    return null;
  }

  // viewer: kameraet, gæsten ser med. viewerLocal: hovedets position i stage.
  update(time, dt, viewer, viewerLocal) {
    const { painting, vase, neon, lamp } = this.refs;

    // Maleriet svinger om sømmet og falder til ro ved sin nye hvilevinkel.
    const p = this.painting;
    p.velocity += (-14 * (p.angle - p.rest) - 2.2 * p.velocity) * dt;
    p.angle += p.velocity * dt;
    painting.rotation.z = p.angle;

    // Vasen vælter om bunden, hopper lidt og bliver liggende, til robotten rejser den op.
    const v = this.vase;
    if (v.state === 'falling') {
      v.velocity += 9 * Math.cos(v.tilt) * dt;
      v.tilt += v.velocity * dt;
      if (v.tilt >= 1.45) {
        v.tilt = 1.45;
        v.velocity = -v.velocity * 0.25;
        if (Math.abs(v.velocity) < 0.3) {
          v.state = 'down';
          v.fixAt = time + FIX_AFTER;
        }
      }
    } else if (v.state === 'rising') {
      v.tilt = Math.max(0, v.tilt - dt * 2.2);
      if (v.tilt === 0) {
        v.state = 'up';
        v.wobble = 0.05;
        v.wobbleTime = 0;
      }
    }
    v.wobbleTime += dt;
    const wobble = v.state === 'up' ? v.wobble * Math.exp(-v.wobbleTime * 2.5) * Math.sin(v.wobbleTime * 18) : 0;
    vase.quaternion.setFromAxisAngle(v.axis, v.tilt + wobble);
    vase.position.y = vase.userData.baseY + Math.sin(v.tilt) * 0.1;

    // Neonskiltet blafrer et øjeblik.
    if (this.neonFlicker > 0) {
      this.neonFlicker -= dt;
      neon.material.opacity = this.neonFlicker > 0 ? (Math.random() < 0.45 ? 0.15 : 1) : 1;
    }

    // Lampen: lyset toner op og ned og blinker, hvis den bliver ramt.
    this.lampLevel += ((this.lampOn ? 1 : 0) - this.lampLevel) * Math.min(1, dt * 8);
    let level = this.lampLevel;
    if (this.lampFlicker > 0) {
      this.lampFlicker -= dt;
      if (Math.random() < 0.4) level *= 0.2;
    }
    lamp.level.value = level;
    lamp.glow.material.opacity = 0.35 * level;
    lamp.bulb.material.color.setRGB(0.22 + 0.78 * level, 0.2 + 0.74 * level, 0.18 + 0.66 * level);
    this.cordTug = Math.max(0, this.cordTug - dt * 4);
    lamp.cord.position.y = 1.62 - Math.sin(this.cordTug * Math.PI) * 0.05;

    this.updateHeadsets(viewer, viewerLocal);
  }

  // Holdes et headset op foran øjnene, ser gæsten rummet gennem robottens kamera.
  updateHeadsets(viewer, viewerLocal) {
    const near = (item) => item.heldBy
      && item.mesh.position.distanceTo(viewerLocal) < (item.heldBy.type === 'mouse' ? 0.32 : 0.2);
    const worn = this.headsets.find((h) => this.physics.items.has(h) && near(h)) ?? null;
    if (worn !== this.worn) {
      if (this.worn) this.worn.mesh.visible = true;
      if (worn) {
        worn.mesh.visible = false;
        this.sound.play('props/headset-on', { volume: 0.8 });
        if (!this.headsetSeen) {
          this.headsetSeen = true;
          this.onEvent?.('headset');
        }
      }
      this.worn = worn;
    }
    this.view.visible = Boolean(worn);
    if (!worn) return;

    const cam = this.viewCamera;
    this.robot.headPosition(cam.position);
    this.robot.group.parent.localToWorld(cam.position);
    viewer.getWorldPosition(this.tmp);
    // Lidt foran robottens ansigt, så kameraet ikke ser hovedet indefra.
    cam.position.lerp(this.tmp, 0.12);
    cam.lookAt(this.tmp);
    cam.updateMatrixWorld();
    this.robot.head.visible = false;
    this.render(this.viewTarget, cam);
    this.robot.head.visible = true;

    viewer.getWorldQuaternion(this.tmpQ);
    this.view.position.copy(this.tmp).add(new THREE.Vector3(0, 0, -0.22).applyQuaternion(this.tmpQ));
    this.view.quaternion.copy(this.tmpQ);
  }
}
