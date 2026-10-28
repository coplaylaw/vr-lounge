import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CVI } from './palette.js';
import { LANGUAGES } from './content.js';

const SIZE = { w: 0.24, h: 0.09, d: 0.03 };

function labelTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = CVI.navy;
  g.beginPath();
  g.roundRect(6, 6, 500, 180, 40);
  g.fill();
  g.strokeStyle = CVI.cyan;
  g.lineWidth = 8;
  g.stroke();
  g.fillStyle = CVI.white;
  g.font = '700 84px "Segoe UI", Roboto, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 100);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// To knapper over bordet. Gæsten vælger sprog ved at røre en af dem med hånden eller controlleren,
// eller ved at klikke på den i den flade visning.
export class LanguageButtons {
  constructor(stage) {
    this.group = new THREE.Group();
    stage.add(this.group);
    const body = new RoundedBoxGeometry(SIZE.w, SIZE.h, SIZE.d, 3, 0.012);
    const bodyMat = new THREE.MeshLambertMaterial({ color: CVI.navy });
    this.buttons = LANGUAGES.map((lang, i) => {
      const button = new THREE.Group();
      button.position.set(i === 0 ? -0.16 : 0.16, 1.0, -0.48);
      button.rotation.x = -0.25; // let vippet op mod gæsten
      button.add(new THREE.Mesh(body, bodyMat));
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(SIZE.w, SIZE.h),
        new THREE.MeshBasicMaterial({ map: labelTexture(lang.label), transparent: true }),
      );
      face.position.z = SIZE.d / 2 + 0.001;
      button.add(face);
      button.userData = { id: lang.id, home: button.position.clone(), hover: 0 };
      this.group.add(button);
      return button;
    });
    this.local = new THREE.Vector3();
    this.hide();
  }

  show() {
    this.group.visible = true;
  }

  hide() {
    this.group.visible = false;
  }

  get visible() {
    return this.group.visible;
  }

  // Klik i den flade visning. Returnerer sprogets id eller null.
  pick(raycaster) {
    if (!this.visible) return null;
    const hit = raycaster.intersectObjects(this.buttons, true)[0];
    if (!hit) return null;
    let obj = hit.object;
    while (obj && !obj.userData.id) obj = obj.parent;
    return obj?.userData.id ?? null;
  }

  // points: hænder og controllere i stage-koordinater. Returnerer sprogets id, når en knap røres.
  update(time, points) {
    if (!this.visible) return null;
    let chosen = null;
    this.buttons.forEach((button, i) => {
      const { home } = button.userData;
      let near = Infinity;
      for (const p of points) {
        this.local.copy(p);
        button.worldToLocal(this.local.applyMatrix4(button.parent.matrixWorld));
        const inside = Math.abs(this.local.x) < SIZE.w / 2 + 0.01
          && Math.abs(this.local.y) < SIZE.h / 2 + 0.01
          && Math.abs(this.local.z) < SIZE.d / 2 + 0.04;
        if (inside) chosen = button.userData.id;
        near = Math.min(near, p.distanceTo(button.position));
      }
      // Knappen vokser lidt, når en hånd nærmer sig.
      const hover = THREE.MathUtils.clamp(1 - (near - 0.08) / 0.2, 0, 1);
      button.userData.hover += (hover - button.userData.hover) * 0.2;
      button.scale.setScalar(1 + button.userData.hover * 0.12);
      button.position.y = home.y + Math.sin(time * 2 + i * 1.5) * 0.008;
    });
    return chosen;
  }
}
