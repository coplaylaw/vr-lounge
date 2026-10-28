import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { CANNON } from './physics.js';
import {
  contractTexture, stampTexture, paperTexture, photoFrameTexture, seededRandom,
} from './materials.js';
import { CVI } from './palette.js';

// Bonusdisketternes legetøj: kamera og billeder, stempel og aftale, papirfly og papirkugler med skraldespand.

const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

// --- Kameraet ---

// Kameraet sidder i hånden med linsen fremad langs pegestrålen.
const CAMERA_HOLD = new THREE.Matrix4().makeTranslation(0, 0.01, -0.05);
export const LENS = new THREE.Vector3(0, 0.005, -0.045); // midt i linsen, lokalt
export const SHUTTER = new THREE.Vector3(0.042, 0.05, -0.005); // udløserknappen ovenpå
const PHOTO_SLOT = new THREE.Vector3(0, 0.045, 0.012); // billedet skubbes op her

export function createCamera(physics, position) {
  const group = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xf2f4f6 });
  const navy = new THREE.MeshLambertMaterial({ color: CVI.navy });
  group.add(new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.09, 0.07, 3, 0.016), white));
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.131, 0.012, 0.071), new THREE.MeshLambertMaterial({ color: CVI.cyan }));
  stripe.position.y = -0.022;
  group.add(stripe);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.033, 0.02, 28), navy);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(LENS.x, LENS.y, -0.042);
  group.add(lens);
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(0.021, 24),
    new THREE.MeshPhongMaterial({ color: 0x0d1626, specular: 0x8899aa, shininess: 80 }),
  );
  glass.position.set(LENS.x, LENS.y, -0.0525);
  glass.rotation.y = Math.PI;
  group.add(glass);
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.016), new THREE.MeshBasicMaterial({ color: 0xdfe8f0 }));
  flash.position.set(-0.04, 0.03, -0.0352);
  flash.rotation.y = Math.PI;
  group.add(flash);
  const button = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.009, 0.008, 16),
    new THREE.MeshBasicMaterial({ color: CVI.orange, toneMapped: false }),
  );
  button.position.copy(SHUTTER);
  group.add(button);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.002, 0.006), new THREE.MeshBasicMaterial({ color: 0x0b1424 }));
  slot.position.set(0, 0.0451, PHOTO_SLOT.z);
  group.add(slot);
  const viewfinder = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.016, 0.004), navy);
  viewfinder.position.set(0.04, 0.03, 0.036);
  group.add(viewfinder);

  group.position.copy(position);
  const item = physics.add(group, new CANNON.Box(new CANNON.Vec3(0.065, 0.045, 0.035)), {
    mass: 0.35, kind: 'camera', radius: 0.08, holdOffset: CAMERA_HOLD,
  });
  item.data.button = button;
  return item;
}

// Billeder taget med kameraet. Hvert billede har sin egen render target, som tegnes, når der trykkes.
const MAX_PHOTOS = 6;
const PHOTO = { w: 0.09, h: 0.108, image: 0.08 };
export class Photos {
  constructor(physics) {
    this.physics = physics;
    this.list = [];
    this.lens = new THREE.PerspectiveCamera(72, 1, 0.04, 80);
    this.lens.layers.enable(5); // gæstens avatar er kun med på billeder (se avatar.js)
    this.frameTex = photoFrameTexture();
    this.stuck = null; // billedet, der stikker op af kameraet
  }

  // Tegner billedet fra kameraets linse og skubber det ud af kameraet. render(target, camera) tegner scenen.
  take(cameraItem, render) {
    const target = new THREE.WebGLRenderTarget(384, 384);
    target.texture.colorSpace = THREE.SRGBColorSpace;
    cameraItem.mesh.updateMatrixWorld();
    this.lens.position.copy(LENS).applyMatrix4(cameraItem.mesh.matrixWorld);
    cameraItem.mesh.getWorldQuaternion(this.lens.quaternion);
    this.lens.updateMatrixWorld();
    render(target, this.lens);

    if (this.stuck) this.unstick(this.stuck);
    while (this.list.length >= MAX_PHOTOS) this.remove(this.list[0]);

    const group = new THREE.Group();
    const card = new THREE.Mesh(
      new THREE.BoxGeometry(PHOTO.w, PHOTO.h, 0.002),
      [...Array(4).fill(new THREE.MeshLambertMaterial({ color: 0xf6f6f2 })),
        new THREE.MeshBasicMaterial({ map: this.frameTex }), new THREE.MeshLambertMaterial({ color: 0xf6f6f2 })],
    );
    group.add(card);
    const imageY = PHOTO.h / 2 - (PHOTO.w - PHOTO.image) / 2 - PHOTO.image / 2;
    const image = new THREE.Mesh(new THREE.PlaneGeometry(PHOTO.image, PHOTO.image), new THREE.MeshBasicMaterial({ map: target.texture }));
    image.position.set(0, imageY, 0.0012);
    group.add(image);
    // Fremkaldelse: først mørkt, så toner billedet frem.
    const veil = new THREE.Mesh(
      new THREE.PlaneGeometry(PHOTO.image, PHOTO.image),
      new THREE.MeshBasicMaterial({ color: 0x2a2f38, transparent: true, opacity: 1, depthWrite: false }),
    );
    veil.position.set(0, imageY, 0.0016);
    group.add(veil);
    group.position.copy(cameraItem.mesh.position);
    group.quaternion.copy(cameraItem.mesh.quaternion);

    const item = this.physics.add(group, new CANNON.Box(new CANNON.Vec3(PHOTO.w / 2, PHOTO.h / 2, 0.002)), {
      mass: 0.01, kind: 'photo', radius: 0.06,
    });
    item.body.type = CANNON.Body.KINEMATIC;
    item.body.collisionResponse = false;
    Object.assign(item.data, { target, veil, camera: cameraItem, eject: 0, develop: 0 });
    this.list.push(item);
    this.stuck = item;
    return item;
  }

  unstick(item) {
    if (this.stuck === item) this.stuck = null;
    item.data.camera = null;
    item.body.collisionResponse = true;
    if (!item.heldBy) this.physics.release(item, new THREE.Vector3(), new THREE.Vector3());
  }

  remove(item) {
    if (this.stuck === item) this.stuck = null;
    item.data.target.dispose();
    this.physics.remove(item);
    this.list = this.list.filter((p) => p !== item);
  }

  update(dt) {
    for (const item of this.list) {
      const d = item.data;
      if (d.develop < 1 && d.eject >= 1) {
        d.develop = Math.min(1, d.develop + dt / 4);
        d.veil.material.opacity = 1 - d.develop * d.develop;
      }
      if (!d.camera) continue;
      // Gribes billedet, eller forsvinder kameraet, slipper det.
      if (item.heldBy || !this.physics.items.has(d.camera)) {
        this.unstick(item);
        if (item.heldBy) item.body.collisionResponse = true;
        continue;
      }
      d.eject = Math.min(1, d.eject + dt / 1.1);
      const k = 1 - (1 - d.eject) ** 2;
      _v.copy(PHOTO_SLOT).setY(PHOTO_SLOT.y + (k - 0.85) * PHOTO.h * 0.85);
      _m.compose(d.camera.mesh.position, d.camera.mesh.quaternion, _s).multiply(
        new THREE.Matrix4().makeTranslation(_v.x, _v.y, _v.z),
      );
      _m.decompose(item.mesh.position, item.mesh.quaternion, _v);
      item.body.position.copy(item.mesh.position);
      item.body.quaternion.copy(item.mesh.quaternion);
    }
  }

  clear() {
    for (const item of [...this.list]) this.remove(item);
  }
}

// --- Stemplet og aftalen ---

const STAMP_HOLD = new THREE.Matrix4().makeTranslation(0, -0.03, 0);
const STAMP_FACE = new THREE.Vector3(0, -0.055, 0);
export function createStamp(physics, position) {
  const group = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x8a6446 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.07, 16), wood);
  handle.position.y = 0.012;
  group.add(handle);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 20, 12), wood);
  knob.position.y = 0.055;
  group.add(knob);
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.026, 0.07, 2, 0.006), new THREE.MeshLambertMaterial({ color: CVI.navy }));
  base.position.y = -0.034;
  group.add(base);
  const rubber = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.008, 0.064), new THREE.MeshLambertMaterial({ color: CVI.orange }));
  rubber.position.y = -0.051;
  group.add(rubber);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0125, 0.003, 6, 20), new THREE.MeshBasicMaterial({ color: CVI.cyan, toneMapped: false }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.018;
  group.add(ring);
  group.position.copy(position);
  return physics.add(group, new CANNON.Box(new CANNON.Vec3(0.035, 0.055, 0.035)), {
    mass: 0.25, kind: 'stamp', radius: 0.07, holdOffset: STAMP_HOLD,
  });
}

export function createContract(physics, position) {
  const paper = new THREE.MeshLambertMaterial({ color: 0xf6f5f0 });
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.003, 0.21),
    [paper, paper, new THREE.MeshLambertMaterial({ map: contractTexture() }), paper, paper, paper],
  );
  mesh.position.copy(position);
  return physics.add(mesh, new CANNON.Box(new CANNON.Vec3(0.075, 0.003, 0.105)), {
    mass: 0.03, kind: 'paper', radius: 0.1,
  });
}

// Aftryk efter stemplet. Et aftryk sættes, når stemplets gummi kommer helt ned mod en flade,
// og først igen, når stemplet er løftet.
const MAX_MARKS = 40;
export class StampMarks {
  constructor(stage) {
    this.stage = stage;
    this.marks = [];
    this.geometry = new THREE.PlaneGeometry(0.058, 0.058);
    this.material = new THREE.MeshLambertMaterial({
      map: stampTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
    });
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 0.04;
    this.onStamp = null; // (hit) når der er sat et aftryk
  }

  // targets: de meshes, der kan stemples på.
  update(stamp, targets) {
    const mesh = stamp.mesh;
    mesh.updateMatrixWorld();
    const origin = _v.copy(STAMP_FACE).setY(STAMP_FACE.y + 0.012).applyMatrix4(mesh.matrixWorld);
    const down = new THREE.Vector3(0, -1, 0).transformDirection(mesh.matrixWorld);
    this.raycaster.set(origin, down);
    const hit = this.raycaster.intersectObjects(targets, true).find((h) => h.face && h.object.geometry !== this.geometry && !isInside(h.object, mesh));
    const touching = hit && hit.distance < 0.018;
    if (!hit || hit.distance > 0.03) stamp.data.inked = false;
    if (!touching || stamp.data.inked) return;
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (normal.dot(down) > -0.6) return; // stemplet skal ned på fladen, ikke ind fra siden
    stamp.data.inked = true;

    const mark = new THREE.Mesh(this.geometry, this.material);
    mark.position.copy(hit.point).addScaledVector(normal, 0.0008);
    // Aftrykket vendes som stemplet: dets fremad (-Z) bliver aftrykkets "op".
    const forward = new THREE.Vector3(0, 0, -1).transformDirection(mesh.matrixWorld);
    forward.addScaledVector(normal, -forward.dot(normal)).normalize();
    const side = new THREE.Vector3().crossVectors(forward, normal);
    mark.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, forward, normal));
    this.stage.add(mark);
    mark.updateMatrixWorld();
    hit.object.attach(mark);
    this.marks.push(mark);
    while (this.marks.length > MAX_MARKS) this.marks.shift().removeFromParent();
    this.onStamp?.(hit);
  }

  clear() {
    for (const mark of this.marks) mark.removeFromParent();
    this.marks = [];
  }
}

function isInside(object, root) {
  for (let o = object; o; o = o.parent) if (o === root) return true;
  return false;
}

// --- Papirfly ---

const PLANE_HOLD = new THREE.Matrix4().makeTranslation(0, 0, -0.05);
let planeGeometry = null;
function buildPlaneGeometry() {
  const N = [0, 0, -0.13];
  const T = [0, 0, 0.08];
  const L = [-0.075, 0.014, 0.08];
  const R = [0.075, 0.014, 0.08];
  const K = [0, -0.028, 0.07];
  const tris = [N, T, L, N, R, T, N, K, T];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  // uv fra x og z, så papirets linjer følger vingerne.
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(tris.flatMap(([x, , z]) => [x * 6 + 0.5, z * 4]), 2));
  geo.computeVertexNormals();
  return geo;
}

export function createPlane(physics, position) {
  planeGeometry ??= buildPlaneGeometry();
  const mesh = new THREE.Mesh(
    planeGeometry,
    new THREE.MeshLambertMaterial({ map: paperTexture(), side: THREE.DoubleSide }),
  );
  mesh.position.copy(position);
  const item = physics.add(mesh, new CANNON.Box(new CANNON.Vec3(0.06, 0.014, 0.1)), {
    mass: 0.015, kind: 'plane', radius: 0.09, holdOffset: PLANE_HOLD,
  });
  item.data.flying = false;
  return item;
}

// Flyet svæver, så længe det har fart nok: næsen drejes mod fartretningen, og der er opdrift.
const _look = new THREE.Matrix4();
const _target = new THREE.Quaternion();
const _origin = new THREE.Vector3();
export function updatePlane(item, dt) {
  if (!item.data.flying || item.heldBy || item.frozen) return;
  const b = item.body;
  const v = _v.set(b.velocity.x, b.velocity.y, b.velocity.z);
  const speed = v.length();
  if (speed < 0.7) {
    item.data.flying = false;
    return;
  }
  _look.lookAt(_origin, v, UP);
  _target.setFromRotationMatrix(_look);
  _q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w).slerp(_target, Math.min(1, dt * 8));
  b.quaternion.set(_q.x, _q.y, _q.z, _q.w);
  b.angularVelocity.set(0, 0, 0);
  const lift = 9.82 * 0.92 * Math.min(1, (speed * speed) / 6);
  b.velocity.y += lift * dt;
  const drag = 1 - 0.22 * dt;
  b.velocity.x *= drag;
  b.velocity.y *= drag;
  b.velocity.z *= drag;
}

// --- Papirkugler og skraldespanden bag gæsten ---

export function createPaperBall(physics, position, seed) {
  const rnd = seededRandom(seed);
  const geo = mergeVertices(new THREE.IcosahedronGeometry(0.032, 2).deleteAttribute('normal').deleteAttribute('uv'));
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i).multiplyScalar(0.78 + rnd() * 0.32);
    pos.setXYZ(i, _v.x, _v.y, _v.z);
  }
  geo.computeVertexNormals();
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) * 12 + 0.5;
    uv[i * 2 + 1] = pos.getY(i) * 12 + pos.getZ(i) * 5;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: paperTexture(), flatShading: true }));
  mesh.position.copy(position);
  const item = physics.add(mesh, new CANNON.Sphere(0.03), { mass: 0.015, kind: 'ball', radius: 0.045 });
  item.body.linearDamping = 0.12;
  return item;
}

export const BIN = new THREE.Vector3(0.3, 0, 1.5);
const BIN_TOP = 0.4;
const BIN_RADIUS = 0.17;

export class PaperBin {
  constructor(stage, physics, glowTex) {
    this.group = new THREE.Group();
    this.group.position.copy(BIN);
    stage.add(this.group);
    const navy = new THREE.MeshLambertMaterial({ color: CVI.navy, side: THREE.DoubleSide });
    this.group.add(new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0.001, 0.005), new THREE.Vector2(0.13, 0.005), new THREE.Vector2(0.135, 0.02),
      new THREE.Vector2(BIN_RADIUS, BIN_TOP),
    ], 32), navy));
    this.rim = new THREE.Mesh(
      new THREE.TorusGeometry(BIN_RADIUS, 0.008, 8, 48),
      new THREE.MeshBasicMaterial({ color: CVI.cyan, toneMapped: false, transparent: true }),
    );
    this.rim.rotation.x = Math.PI / 2;
    this.rim.position.y = BIN_TOP;
    this.group.add(this.rim);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.6).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    shadow.position.y = 0.008;
    this.group.add(shadow);

    // Pointtavle på siden, der vender mod gæsten.
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 128;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(0.17, 0.085),
      new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false }),
    );
    const toGuest = Math.atan2(-BIN.x, -BIN.z);
    board.position.set(Math.sin(toGuest) * 0.16, 0.24, Math.cos(toGuest) * 0.16);
    board.rotation.y = toGuest;
    board.rotation.x = -0.12;
    this.group.add(board);

    // Bund og en ring af tynde vægge, så tingene kan lande i spanden.
    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
    body.userData = { surface: 'bin' };
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.13, 0.01, 0.13)), new CANNON.Vec3(0, 0.0, 0));
    const walls = 14;
    for (let i = 0; i < walls; i++) {
      const a = (i / walls) * Math.PI * 2;
      const r = (BIN_RADIUS + 0.135) / 2 + 0.005;
      const q = new CANNON.Quaternion().setFromEuler(0, -a, 0);
      // Væggene hælder udad som spanden.
      const tilt = new CANNON.Quaternion().setFromEuler(0, 0, -Math.atan2(BIN_RADIUS - 0.135, BIN_TOP));
      body.addShape(
        new CANNON.Box(new CANNON.Vec3(0.008, BIN_TOP / 2, 0.042)),
        new CANNON.Vec3(Math.cos(a) * r, BIN_TOP / 2, Math.sin(a) * r),
        q.mult(tilt),
      );
    }
    body.position.set(BIN.x, BIN.y, BIN.z);
    physics.world.addBody(body);

    this.score = 0;
    this.flash = 0;
    this.drawScore();
  }

  drawScore() {
    const g = this.canvas.getContext('2d');
    g.fillStyle = CVI.navy;
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = CVI.cyan;
    g.lineWidth = 6;
    g.strokeRect(5, 5, 246, 118);
    g.fillStyle = CVI.cyan;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '600 24px "Segoe UI", Roboto, sans-serif';
    g.fillText('KURVE', 128, 32);
    g.fillStyle = '#ffffff';
    g.font = '800 62px "Segoe UI", Roboto, sans-serif';
    g.fillText(String(this.score), 128, 84);
    this.texture.needsUpdate = true;
  }

  // Er en ting landet i spanden? Kun papirkugler giver point.
  inside(item) {
    const p = item.mesh.position;
    return Math.hypot(p.x - BIN.x, p.z - BIN.z) < 0.14 && p.y < BIN_TOP - 0.02 && p.y > 0;
  }

  addPoint() {
    this.score++;
    this.flash = 1;
    this.drawScore();
  }

  get rimPosition() {
    return BIN.clone().setY(BIN_TOP);
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - dt * 1.5);
    this.rim.material.opacity = 0.6 + 0.4 * this.flash;
    this.rim.scale.setScalar(1 + this.flash * 0.08);
  }

  reset() {
    this.score = 0;
    this.drawScore();
  }
}
