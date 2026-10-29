import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CVI } from './palette.js';

// Enkle hænder, der vises i stedet for Quest-controllerne. Hånden sidder i controllerens grebspunkt
// (WebXR grip space): origo midt i den lukkede hånd, -Z langs grebet mod tommelfingeren,
// +Y op mod armen og håndryggen mod +X på højre hånd. Venstre hånd er spejlet i x.
// Fingrene bøjer efter knapperne: grebknappen lukker de tre yderste fingre, aftrækkeren pegefingeren,
// og tommelfingeren lægger sig ned, når den rører pinden eller knapperne.

// Fingrene fra pegefinger til lillefinger: position af knoen (z) og længden af de tre led.
const FINGERS = [
  { z: -0.027, len: [0.044, 0.026, 0.021], r: 0.0085 },
  { z: -0.008, len: [0.048, 0.029, 0.022], r: 0.0088 },
  { z: 0.011, len: [0.045, 0.027, 0.021], r: 0.0084 },
  { z: 0.028, len: [0.036, 0.021, 0.018], r: 0.0076 },
];
const THUMB = { len: [0.034, 0.03, 0.024], r: 0.0095 };
// Bøjning i hvert led (radianer) for en åben og en lukket hånd.
const OPEN = [0.15, 0.15, 0.1];
const CLOSED = [1.45, 1.55, 1.1];
const THUMB_OPEN = [0.05, 0.05, 0.05];
const THUMB_DOWN = [0.5, 0.45, 0.4];

const material = new THREE.MeshLambertMaterial({ color: 0xe7eaee });
const cuffMaterial = new THREE.MeshBasicMaterial({ color: CVI.cyan, toneMapped: false });
const segmentGeo = new Map();
// Et led som en kapsel, der starter i leddet og peger ned (-Y).
function segment(length, radius) {
  const key = `${length}|${radius}`;
  if (!segmentGeo.has(key)) {
    segmentGeo.set(key, new THREE.CapsuleGeometry(radius, length - radius, 4, 10).translate(0, -length / 2, 0));
  }
  return new THREE.Mesh(segmentGeo.get(key), material);
}

function chain(lengths, radius, parent) {
  const joints = [];
  let at = parent;
  for (const length of lengths) {
    const joint = new THREE.Group();
    joint.add(segment(length, radius));
    at.add(joint);
    joints.push({ joint, length });
    const next = new THREE.Group();
    next.position.y = -length;
    joint.add(next);
    at = next;
  }
  return joints.map((j) => j.joint);
}

export class ControllerHand {
  constructor(handedness) {
    this.group = new THREE.Group();
    this.side = handedness === 'left' ? -1 : 1;
    const hand = new THREE.Group();
    hand.scale.x = this.side;
    // Lidt op, så de bøjede fingre lægger sig om midten af grebet.
    hand.position.y = 0.025;
    this.group.add(hand);

    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.085, 0.078, 3, 0.012), material);
    palm.position.set(0.028, 0.045, 0.0);
    hand.add(palm);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.012, 20, 1, true), cuffMaterial);
    cuff.position.set(0.026, 0.09, 0);
    cuff.scale.set(0.75, 1, 1.2);
    hand.add(cuff);
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.04, 16), material);
    wrist.position.set(0.026, 0.11, 0);
    wrist.scale.set(0.75, 1, 1.2);
    hand.add(wrist);

    // Fingrene sidder i knoerne langs underkanten af håndfladen og bøjer ind mod håndfladen (-X).
    this.fingers = FINGERS.map((f) => {
      const knuckle = new THREE.Group();
      knuckle.position.set(0.028, 0.004, f.z);
      hand.add(knuckle);
      return chain(f.len, f.r, knuckle);
    });

    // Tommelfingeren peger mod -Z og bøjer ind over grebet.
    const thumbBase = new THREE.Group();
    thumbBase.position.set(0.014, 0.05, -0.034);
    thumbBase.rotation.set(Math.PI / 2 - 0.3, 0, -0.25);
    hand.add(thumbBase);
    this.thumb = chain(THUMB.len, THUMB.r, thumbBase);

    this.curl = [0, 0, 0, 0];
    this.thumbCurl = 0;
  }

  // gamepad: Quest-controllerens knapper (0 aftrækker, 1 grebknap, 3 pind, 4 og 5 A/B eller X/Y).
  update(gamepad, holding, dt) {
    const buttons = gamepad?.buttons ?? [];
    const trigger = buttons[0] ? Math.max(buttons[0].value, buttons[0].touched ? 0.35 : 0) : 0;
    const grip = buttons[1]?.value ?? 0;
    const thumbDown = [3, 4, 5].some((i) => buttons[i]?.touched || buttons[i]?.pressed);
    const target = [Math.max(trigger, holding ? 0.6 : 0), grip, grip, grip].map((g) => Math.max(g, 0.12));
    const k = Math.min(1, dt * 18);
    this.curl = this.curl.map((c, i) => c + (target[i] - c) * k);
    this.thumbCurl += ((thumbDown || holding ? 1 : 0) - this.thumbCurl) * k;

    this.fingers.forEach((joints, i) => {
      joints.forEach((joint, j) => {
        joint.rotation.z = -THREE.MathUtils.lerp(OPEN[j], CLOSED[j], this.curl[i]);
      });
    });
    this.thumb.forEach((joint, j) => {
      joint.rotation.z = -THREE.MathUtils.lerp(THUMB_OPEN[j], THUMB_DOWN[j], this.thumbCurl);
    });
  }
}
