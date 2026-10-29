import * as THREE from 'three';
import { CVI } from './palette.js';

// "Indlæsning" af verdenen: mens gæsten vælger sprog, er der kun et tomt rum med et gitter på gulvet.
// Bagefter vokser en kugle ud fra gæsten. Lige uden for kuglens kant tegnes verdenen som lysende
// cyan gitterlinjer, og inden for kanten fyldes den ud med de rigtige overflader.
// Det sker i materialernes egne shadere (onBeforeCompile), så der ikke skal tegnes noget ekstra.

const VOID_COLOR = new THREE.Color('#060c18');

// Kuglens radius efter t sekunder: roligt gennem rummet, så hurtigere ud over byen.
const radiusAt = (t) => 1.2 * t + 0.1 * t ** 3 + 0.02 * t ** 4;
const DONE_RADIUS = 1600;

export class Reveal {
  constructor(scene, root) {
    this.scene = scene;
    this.root = root;
    this.uniforms = {
      uReveal: { value: -1 },
      uRevealBand: { value: 1 },
      uRevealCenter: { value: new THREE.Vector3() },
      uRevealColor: { value: new THREE.Color(CVI.cyan) },
    };
    this.patched = new Set();
    this.toggled = []; // ting, der ikke kan patches (egne shadere, sprites): vises, når kuglen når dem
    // Baggrund og tåge får tomrummets farve, indtil kuglen når ud over byen.
    this.background = scene.background.clone();
    this.fogColor = scene.fog.color.clone();
    this.time = 0;
    this.running = false;
    this.done = false;

    // Gitter på gulvet i det tomme rum.
    this.grid = new THREE.GridHelper(40, 160, CVI.cyan, CVI.cyan);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.18;
    this.grid.material.depthWrite = false;
    this.grid.position.y = 0.001;
    root.parent.add(this.grid);
  }

  // Kaldes, når verdenen er bygget. Alle materialer under root får effekten.
  prepare() {
    const tmp = new THREE.Vector3();
    this.root.traverse((obj) => {
      if (obj.userData.noReveal) return;
      if (obj.isSprite || obj.isPoints || obj.isLine || (obj.material && obj.material.isShaderMaterial)) {
        obj.updateWorldMatrix(true, false);
        const distance = obj.userData.revealAt ?? this.root.worldToLocal(obj.getWorldPosition(tmp)).length();
        this.toggled.push({ obj, distance, visible: obj.visible });
        return;
      }
      if (!obj.isMesh) return;
      for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) this.patch(material);
    });
  }

  patch(material) {
    if (this.patched.has(material)) return;
    this.patched.add(material);
    const uniforms = this.uniforms;
    // Materialet kan have sin egen udvidelse i forvejen (fx lampens lys i bake.js), som køres først.
    const previous = material.onBeforeCompile;
    const previousKey = material.customProgramCacheKey.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRevealPos;')
        .replace('#include <project_vertex>', `#include <project_vertex>
          #ifdef USE_INSTANCING
            vRevealPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          #else
            vRevealPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          #endif`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vRevealPos;
          uniform float uReveal;
          uniform float uRevealBand;
          uniform vec3 uRevealCenter;
          uniform vec3 uRevealColor;`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          float rd = length(vRevealPos - uRevealCenter);
          if (rd > uReveal) {
            if (rd > uReveal + uRevealBand) discard;
            // Gitterlinjer langs fladen: 20 cm tæt på, 2 m ude i byen.
            vec3 n = abs(normalize(cross(dFdx(vRevealPos), dFdy(vRevealPos))));
            float k = rd < 15.0 ? 5.0 : 0.5;
            vec3 g = abs(fract(vRevealPos * k) - 0.5);
            float line = 0.0;
            if (n.x < 0.8) line = max(line, step(0.45, g.x));
            if (n.y < 0.8) line = max(line, step(0.45, g.y));
            if (n.z < 0.8) line = max(line, step(0.45, g.z));
            if (line < 0.5) discard;
            float fade = 1.0 - (rd - uReveal) / uRevealBand;
            gl_FragColor = vec4(uRevealColor * (0.4 + 0.9 * fade), 1.0);
          } else if (rd > uReveal - 0.08 * max(1.0, uReveal * 0.05)) {
            gl_FragColor.rgb = mix(gl_FragColor.rgb, uRevealColor * 1.4, 0.75);
          }`);
    };
    material.customProgramCacheKey = () => `${previousKey()}|reveal`;
    material.needsUpdate = true;
  }

  // Tilbage til det tomme rum (ny gæst).
  hide() {
    this.running = false;
    this.done = false;
    this.time = 0;
    this.uniforms.uReveal.value = -1;
    for (const t of this.toggled) t.obj.visible = false;
    this.scene.background.copy(VOID_COLOR);
    this.scene.fog.color.copy(VOID_COLOR);
    this.sky = false;
    this.grid.visible = true;
    this.grid.material.opacity = 0.18;
  }

  start() {
    this.running = true;
    this.time = 0;
  }

  // center: gæstens position i verden.
  update(dt, center) {
    this.uniforms.uRevealCenter.value.copy(center);
    if (!this.running) return;
    this.time += dt;
    const r = radiusAt(this.time);
    this.uniforms.uReveal.value = r;
    this.uniforms.uRevealBand.value = Math.max(1.2, r * 0.35);
    for (const t of this.toggled) if (!t.obj.visible && r > t.distance) t.obj.visible = t.visible;
    this.grid.material.opacity = 0.18 * Math.max(0, 1 - r / 8);
    this.grid.visible = this.grid.material.opacity > 0.001;
    if (r > 60 && !this.sky) {
      this.sky = true;
      this.scene.background.copy(this.background);
      this.scene.fog.color.copy(this.fogColor);
    }
    if (r > DONE_RADIUS) {
      this.running = false;
      this.done = true;
      this.uniforms.uReveal.value = 1e6;
    }
  }
}
