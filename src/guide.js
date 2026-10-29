import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CVI } from './palette.js';

// Allerførst i VR: to Quest 2-controllere svæver foran gæsten, og knapperne trykkes skiftevis ind
// og lyser op, mens CO:BOT forklarer dem: grebknappen under langfingeren (cyan) griber,
// og aftrækkeren under pegefingeren (orange) trykker. Modellerne er Metas egne fra WebXR Input Profiles.

const STEP = 1.8; // sekunder pr. knap, før den anden knap vises
// Hvordan controllerne vender (hældning og drejning, spejlet for venstre), så knappen kan ses.
const VIEWS = [[1.0, 1.0], [0.9, 2.2]];
const PARTS = [
  { mesh: 'squeeze', node: 'xr_standard_squeeze', color: CVI.cyan },
  { mesh: 'trigger', node: 'xr_standard_trigger', color: CVI.orange },
];

function labelTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 160;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  // active: 0 grebknappen, 1 aftrækkeren. Den aktive række står tydeligst.
  tex.draw = (active) => {
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(21, 37, 62, 0.88)';
    g.beginPath();
    g.roundRect(4, 4, c.width - 8, c.height - 8, 40);
    g.fill();
    g.font = '700 54px "Segoe UI", Roboto, sans-serif';
    g.textBaseline = 'middle';
    [['GRIB · GRAB', CVI.cyan], ['TRYK · PRESS', CVI.orange]].forEach(([text, color], i) => {
      const x = 60 + i * 500;
      g.globalAlpha = i === active ? 1 : 0.4;
      g.fillStyle = color;
      g.beginPath();
      g.arc(x, 80, 22, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = CVI.white;
      g.fillText(text, x + 44, 82);
    });
    g.globalAlpha = 1;
    tex.needsUpdate = true;
  };
  tex.draw(0);
  return tex;
}

export class ControllerGuide {
  constructor(stage) {
    this.group = new THREE.Group();
    this.group.position.set(0, 1.0, -0.45);
    this.group.visible = false;
    stage.add(this.group);
    this.controllers = [];
    this.active = -1;
    this.time = 0;

    const loader = new GLTFLoader();
    ['left', 'right'].forEach((side, i) => {
      const holder = new THREE.Group();
      holder.position.x = i === 0 ? -0.13 : 0.13;
      this.group.add(holder);
      loader.load(`assets/models/quest2-${side}.glb`, (gltf) => {
        const model = gltf.scene;
        model.scale.setScalar(1.15);
        holder.add(model);
        const parts = PARTS.map((p) => {
          const mesh = model.getObjectByName(p.mesh);
          // Hver knap får sit eget materiale, så den kan lyse op uden at resten af controlleren gør.
          mesh.material = mesh.material.clone();
          mesh.material.emissive = new THREE.Color(p.color);
          mesh.material.emissiveIntensity = 0;
          return {
            mesh,
            value: model.getObjectByName(`${p.node}_pressed_value`),
            min: model.getObjectByName(`${p.node}_pressed_min`),
            max: model.getObjectByName(`${p.node}_pressed_max`),
          };
        });
        this.controllers.push({ holder, parts, side: i === 0 ? -1 : 1, tilt: VIEWS[0][0], turn: VIEWS[0][1] });
      });
    });

    this.label = labelTexture();
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.32, 0.05),
      new THREE.MeshBasicMaterial({ map: this.label, transparent: true, depthWrite: false }),
    );
    label.position.set(0, -0.13, 0.02);
    label.rotation.x = -0.35;
    this.group.add(label);
  }

  get visible() {
    return this.group.visible;
  }

  show() {
    this.group.visible = true;
    this.time = 0;
    this.active = -1;
  }

  hide() {
    this.group.visible = false;
  }

  update(dt) {
    if (!this.group.visible) return;
    this.time += dt;
    const active = Math.floor(this.time / STEP) % 2;
    if (active !== this.active) {
      this.active = active;
      this.label.draw(active);
    }
    // Knappen trykkes ind og slippes to gange i løbet af sit trin og lyser imens.
    const t = (this.time % STEP) / STEP;
    const press = Math.max(0, Math.sin(t * Math.PI * 4)) ** 0.6;
    // Controllerne står, som når de holdes, og drejer sig, så den knap, der vises, vender mod gæsten.
    const [tiltTo, turnTo] = VIEWS[active];
    const k = Math.min(1, dt * 5);
    for (const c of this.controllers) {
      c.tilt += (tiltTo - c.tilt) * k;
      c.turn += (turnTo - c.turn) * k;
      c.holder.rotation.set(c.tilt, c.side * (c.turn + Math.sin(this.time * 1.3) * 0.12), 0, 'YXZ');
      c.parts.forEach((part, i) => {
        const k = i === active ? press : 0;
        part.mesh.material.emissiveIntensity = i === active ? 0.35 + 0.65 * press : 0;
        part.value.position.lerpVectors(part.min.position, part.max.position, k);
        part.value.quaternion.slerpQuaternions(part.min.quaternion, part.max.quaternion, k);
      });
    }
  }
}
