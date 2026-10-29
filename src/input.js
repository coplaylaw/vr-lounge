import * as THREE from 'three';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { ControllerHand } from './hands.js';
import { CVI } from './palette.js';

const NEAR_GRAB = 0.07; // afstand fra hånd til tingens overflade
const RAY_LENGTH = 5;
const PULL_TIME = 0.3; // sekunder om at hente en ting hen til hånden
const HISTORY = 6;
const THROW_BOOST = 1.2;

const ZERO = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

// Greb og kast med controllere (grebknap eller aftrækker), hænder (knib) og mus i desktop-visningen.
// Holder man noget, er den anden knap "brug" (fx kameraets udløser eller kanonens aftrækker), og source.using
// er sand, så længe den er trykket ned. Med musen er det højreklik eller mellemrum.
// Alt regnes i stage-koordinater, så det passer med fysikken.
export class Input {
  constructor({ renderer, scene, camera, stage, physics, onGrab, onRelease, onPull, onPoint, onClick, onUse }) {
    this.renderer = renderer;
    this.camera = camera;
    this.stage = stage;
    this.physics = physics;
    this.onGrab = onGrab;
    this.onRelease = onRelease;
    this.onPull = onPull;
    this.onPoint = onPoint;
    this.onClick = onClick;
    this.onUse = onUse;
    this.clickables = []; // ting i rummet, der gør noget, når man peger og trykker (fx lampen)
    this.raycaster = new THREE.Raycaster();
    this.stageInverse = new THREE.Matrix4();
    this.sources = [];

    const handModels = new XRHandModelFactory();
    const rayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);

    for (let i = 0; i < 2; i++) {
      const controller = renderer.xr.getController(i);
      const ray = new THREE.Line(rayGeo, new THREE.LineBasicMaterial({ color: CVI.cyan, transparent: true, opacity: 0.35 }));
      ray.visible = false;
      controller.add(ray);
      scene.add(controller);

      // Controlleren vises som en hånd (se hands.js). Den laves, når vi ved, om det er venstre eller højre.
      const grip = renderer.xr.getControllerGrip(i);
      scene.add(grip);

      const hand = renderer.xr.getHand(i);
      hand.add(handModels.createHandModel(hand, 'mesh'));
      scene.add(hand);

      const source = this.createSource(i, 'xr');
      Object.assign(source, { controller, grip, hand, ray });

      controller.addEventListener('connected', (e) => {
        source.active = true;
        source.isHand = Boolean(e.data.hand);
        source.inputSource = e.data;
        source.history.length = 0;
        if (!source.isHand && source.handModel?.handedness !== e.data.handedness) {
          source.handModel?.group.removeFromParent();
          source.handModel = new ControllerHand(e.data.handedness);
          source.handModel.handedness = e.data.handedness;
          grip.add(source.handModel.group);
        }
      });
      controller.addEventListener('disconnected', () => {
        this.release(source, null);
        source.active = false;
        ray.visible = false;
      });
      for (const button of ['select', 'squeeze']) {
        controller.addEventListener(`${button}start`, () => {
          if (source.held && source.heldButton !== button) {
            source.using = true;
            this.onUse?.(source.held, source);
          } else this.grab(source, button);
        });
        controller.addEventListener(`${button}end`, () => {
          if (button !== source.heldButton) source.using = false;
          this.release(source, button);
        });
      }
    }

    this.mouse = this.createSource(2, 'mouse');
    this.mouse.distance = 0.6;
    this.setupMouse(renderer.domElement);
  }

  createSource(id, type) {
    const source = {
      id, type, active: type === 'mouse', isHand: false,
      position: new THREE.Vector3(), // holderens position (stage)
      quaternion: new THREE.Quaternion(),
      grabPoint: new THREE.Vector3(),
      touchPoint: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      history: [],
      still: 0,
      held: null, heldButton: null, using: false, offset: new THREE.Matrix4(),
      pulling: null,
      target: null,
    };
    this.sources.push(source);
    return source;
  }

  get xrActive() {
    return this.renderer.xr.isPresenting;
  }

  // Punkter, hvor sommerfugle kan lande, og hvor robotten kan få en high five.
  get perches() {
    return this.sources
      .filter((s) => s.active && !s.held && !s.pulling && (s.type === 'xr') === this.xrActive)
      .map((s) => ({ id: s.id, point: s.touchPoint, speed: s.velocity.length(), still: s.still }));
  }

  get holders() {
    return this.sources.filter((s) => s.held);
  }

  // --- Greb ---

  // Peg på mesh og tryk, så kaldes onClick(source). Rammes en undermesh, tæller den også.
  addClickable(mesh, onClick) {
    this.clickables.push({ mesh, onClick });
  }

  grab(source, button) {
    if (source.held || source.pulling || !source.target) return;
    if (source.target.clickable) {
      source.target.clickable.onClick(source);
      return;
    }
    const { item, mode } = source.target;
    const other = this.sources.find((s) => s.held === item || s.pulling?.item === item);
    if (other) this.release(other, null, { gentle: true });
    if (item.frozen) return;

    this.physics.hold(item, source);
    source.heldButton = button;
    if (mode === 'near') {
      this.attach(source, item);
    } else {
      source.pulling = { item, t: 0, from: item.mesh.position.clone(), fromQ: item.mesh.quaternion.clone() };
      this.onPull?.(item, source);
    }
  }

  attach(source, item) {
    source.pulling = null;
    source.held = item;
    if (item.holdOffset) {
      source.offset.copy(item.holdOffset);
    } else {
      _m.compose(source.position, source.quaternion, _s.set(1, 1, 1)).invert();
      _m2.compose(item.mesh.position, item.mesh.quaternion, _s);
      source.offset.multiplyMatrices(_m, _m2);
    }
    this.onGrab?.(item, source);
  }

  release(source, button, { gentle = false } = {}) {
    if (button && source.heldButton !== button) return;
    const item = source.held ?? source.pulling?.item;
    if (!item) return;
    source.held = null;
    source.pulling = null;
    source.heldButton = null;
    source.using = false;
    if (gentle) {
      this.physics.release(item, ZERO, ZERO);
      return;
    }
    // Kastehastighed: håndens fart plus rotationens bidrag i tingens position.
    const v = _v.copy(source.velocity);
    v.add(new THREE.Vector3().subVectors(item.mesh.position, source.position).cross(source.angularVelocity).negate());
    v.multiplyScalar(THROW_BOOST);
    if (v.length() > 10) v.setLength(10);
    const w = source.angularVelocity.clone();
    if (w.length() > 25) w.setLength(25);
    this.physics.release(item, v, w);
    this.onRelease?.(item, source);
  }

  // Slip en ting uden kast, fx når en diskette suges ind i maskinen.
  drop(item) {
    for (const s of this.sources) {
      if (s.held === item || s.pulling?.item === item) {
        s.held = null;
        s.pulling = null;
        s.heldButton = null;
      }
    }
    item.heldBy = null;
  }

  releaseAll() {
    for (const s of this.sources) {
      s.held = null;
      s.pulling = null;
      s.heldButton = null;
      s.target = null;
    }
  }

  // --- Mus (desktop-forhåndsvisning) ---

  setupMouse(el) {
    this.ndc = new THREE.Vector2(10, 10);
    this.yaw = 0;
    this.pitch = -0.45;
    let look = null;
    const track = (e) => this.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    const use = (down) => {
      if (!this.mouse.held) return;
      if (down && !this.mouse.using) this.onUse?.(this.mouse.held, this.mouse);
      this.mouse.using = down;
    };
    addEventListener('keydown', (e) => e.code === 'Space' && !e.repeat && use(true));
    addEventListener('keyup', (e) => e.code === 'Space' && use(false));
    el.addEventListener('pointerdown', (e) => {
      track(e);
      if (e.button === 2) {
        use(true);
        return;
      }
      el.setPointerCapture(e.pointerId);
      this.updateMousePose(0);
      this.findTarget(this.mouse);
      if (this.mouse.target?.clickable) {
        this.grab(this.mouse, 'mouse');
        return;
      }
      if (this.mouse.target) {
        this.mouse.distance = THREE.MathUtils.clamp(this.mouse.target.distance, 0.3, 1.4);
        this.updateMousePose(0);
        this.mouse.target.mode = 'near';
        this.grab(this.mouse, 'mouse');
        return;
      }
      this.raycaster.setFromCamera(this.ndc, this.camera);
      if (this.onClick?.(this.raycaster)) return;
      look = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointermove', (e) => {
      track(e);
      if (!look) return;
      this.yaw += (e.clientX - look.x) * 0.004;
      this.pitch = THREE.MathUtils.clamp(this.pitch + (e.clientY - look.y) * 0.004, -1.3, 1.2);
      look = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointerup', (e) => {
      if (e.button === 2) {
        use(false);
        return;
      }
      this.release(this.mouse, 'mouse');
      look = null;
    });
    el.addEventListener('wheel', (e) => {
      this.mouse.distance = THREE.MathUtils.clamp(this.mouse.distance - e.deltaY * 0.0008, 0.25, 1.6);
    }, { passive: true });
  }

  updateMousePose() {
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const { origin, direction } = this.raycaster.ray;
    _v.copy(origin).addScaledVector(direction, this.mouse.distance);
    this.toStage(_v, this.camera.quaternion, this.mouse.position, this.mouse.quaternion);
    this.mouse.grabPoint.copy(this.mouse.position);
    this.mouse.touchPoint.copy(this.mouse.position);
  }

  // --- Opdatering hvert billede ---

  toStage(worldPos, worldQuat, outPos, outQuat) {
    _m.compose(worldPos, worldQuat, _s.set(1, 1, 1)).premultiply(this.stageInverse);
    _m.decompose(outPos, outQuat, _s);
  }

  localPoint(object, out) {
    return out.setFromMatrixPosition(object.matrixWorld).applyMatrix4(this.stageInverse);
  }

  update(time, dt) {
    this.stage.updateMatrixWorld();
    this.stageInverse.copy(this.stage.matrixWorld).invert();
    for (const item of this.physics.items) item.highlight = false;

    if (!this.xrActive) {
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      this.camera.updateMatrixWorld();
      this.updateMousePose();
      this.track(this.mouse, time);
      this.updateHeld(this.mouse, dt);
      if (!this.mouse.held) this.findTarget(this.mouse);
      const over = this.mouse.target?.clickable ? 'pointer' : this.mouse.target ? 'grab' : 'default';
      this.renderer.domElement.style.cursor = this.mouse.held ? 'grabbing' : over;
      return;
    }

    for (const source of this.sources) {
      if (source.type !== 'xr' || !source.active) continue;
      const { controller, grip, hand, ray } = source;
      controller.matrixWorld.decompose(_v, _q, _s);
      this.toStage(_v, _q, source.position, source.quaternion);

      const thumb = hand.joints?.['thumb-tip'];
      const index = hand.joints?.['index-finger-tip'];
      if (source.isHand && thumb && index) {
        this.localPoint(index, source.touchPoint);
        this.localPoint(thumb, source.grabPoint).add(source.touchPoint).multiplyScalar(0.5);
      } else {
        this.localPoint(grip, source.grabPoint);
        source.touchPoint.copy(source.grabPoint).y += 0.04;
      }

      this.track(source, time);
      this.updateHeld(source, dt);
      if (!source.held && !source.pulling) this.findTarget(source);
      else source.target = null;
      if (source.handModel) {
        source.handModel.group.visible = !source.isHand;
        source.handModel.update(source.inputSource?.gamepad, Boolean(source.held || source.pulling), dt);
      }

      // Strålen vises svagt, og tydeligt når den peger på noget, der kan hentes.
      const far = source.target?.mode === 'ray';
      ray.visible = !source.held && !source.pulling && (far || !source.isHand);
      ray.scale.z = far ? source.target.distance : RAY_LENGTH;
      ray.material.opacity = far ? 0.8 : 0.2;
    }
  }

  track(source, time) {
    const h = source.history;
    h.push({ p: source.position.clone(), q: source.quaternion.clone(), t: time });
    if (h.length > HISTORY) h.shift();
    const first = h[0];
    const last = h[h.length - 1];
    const span = last.t - first.t;
    if (span <= 0) return;
    source.velocity.subVectors(last.p, first.p).divideScalar(span);
    const dq = _q.copy(last.q).multiply(first.q.clone().invert());
    if (dq.w < 0) dq.set(-dq.x, -dq.y, -dq.z, -dq.w);
    const angle = 2 * Math.acos(Math.min(1, dq.w));
    const sin = Math.sqrt(1 - dq.w * dq.w);
    if (sin > 1e-4) source.angularVelocity.set(dq.x / sin, dq.y / sin, dq.z / sin).multiplyScalar(angle / span);
    else source.angularVelocity.set(0, 0, 0);
    const speed = source.velocity.length();
    source.still = speed < 0.12 ? source.still + (h.length > 1 ? last.t - h[h.length - 2].t : 0) : 0;
  }

  updateHeld(source, dt) {
    const pull = source.pulling;
    if (pull) {
      pull.t += dt;
      const k = Math.min(1, pull.t / PULL_TIME);
      const ease = k * k;
      _v.copy(pull.from).lerp(source.grabPoint, ease);
      _q.copy(pull.fromQ).slerp(source.quaternion, ease);
      this.physics.moveHeld(pull.item, _v, _q, dt);
      if (k >= 1) this.attach(source, pull.item);
      return;
    }
    if (!source.held) return;
    _m.compose(source.position, source.quaternion, _s.set(1, 1, 1)).multiply(source.offset);
    _m.decompose(_v, _q, _s);
    this.physics.moveHeld(source.held, _v, _q, dt);
  }

  // Nærmeste ting inden for rækkevidde, ellers den første ting strålen rammer.
  findTarget(source) {
    let best = null;
    for (const item of this.physics.items) {
      if (source.type === 'mouse' || item.frozen || item.heldBy) continue;
      const d = item.mesh.position.distanceTo(source.grabPoint) - item.radius;
      if (d < NEAR_GRAB && (!best || d < best.distance)) best = { item, mode: 'near', distance: d };
    }
    if (!best) {
      if (source.type === 'mouse') this.raycaster.setFromCamera(this.ndc, this.camera);
      else {
        source.controller.matrixWorld.decompose(_v, _q, _s);
        this.raycaster.set(_v, new THREE.Vector3(0, 0, -1).applyQuaternion(_q));
      }
      this.raycaster.far = RAY_LENGTH;
      const meshes = [];
      for (const item of this.physics.items) if (!item.frozen && !item.heldBy) meshes.push(item.mesh);
      for (const c of this.clickables) meshes.push(c.mesh);
      const hit = this.raycaster.intersectObjects(meshes, true)[0];
      if (hit) {
        let obj = hit.object;
        while (obj && !meshes.includes(obj)) obj = obj.parent;
        const item = [...this.physics.items].find((it) => it.mesh === obj);
        const clickable = this.clickables.find((c) => c.mesh === obj);
        if (item) best = { item, mode: 'ray', distance: hit.distance };
        else if (clickable) best = { clickable, mode: 'ray', distance: hit.distance };
      }
      this.raycaster.far = Infinity;
    }
    if (best?.item && best.mode === 'ray' && best.item !== source.target?.item) this.onPoint?.(best.item, source);
    source.target = best;
    if (best?.item) best.item.highlight = true;
  }
}
