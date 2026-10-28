import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Physics } from './physics.js';
import { Robot } from './robot.js';
import { Desk, DESK_TOP, PAD } from './desk.js';
import {
  createDisk, createLetterBlock, createBlaster, createCoffee, updateCoffee, BLASTER_MUZZLE,
  Projectiles, Targets, Confetti, Butterflies,
} from './items.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { glowTexture } from './materials.js';
import {
  SPEAKER, INTRO, HIGH_FIVE, HIGH_FIVE_DONE, DISK_HINT, NEXT_DISK, TOPICS, HIT_LINES, HINTS, OUTRO,
} from './content.js';

const LINE_PAUSE = 3; // sekunder mellem robottens linjer
const IDLE_HINT_AFTER = 30;
const HIGH_FIVE_TIMEOUT = 14;
const NEXT_DISK_AFTER = 12; // sekunder efter en diskette er sat i
const RESET_AFTER_HIDDEN = 15; // headsettet taget af i så mange sekunder = ny gæst
const ROOM_RADIUS = 4;
const ROOM_HEIGHT = 3.6;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(1);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1d3a);
scene.fog = new THREE.FogExp2(0x0d1d3a, 0.0035);

// Siddende øjenhøjde til desktop-forhåndsvisningen. I VR styrer headsettet kameraet.
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.03, 2000);
camera.position.set(0, 1.2, 0);

// Alt indhold ligger i "stage", som flyttes hen til gæsten, når VR starter.
const stage = new THREE.Group();
scene.add(stage);

const glowTex = glowTexture();
const world = buildWorld(stage);
const physics = new Physics(stage, glowTex);
physics.addRoom(ROOM_RADIUS, ROOM_HEIGHT);
const desk = new Desk(stage, physics);
const robot = new Robot(stage, physics, SPEAKER, glowTex);
const projectiles = new Projectiles(stage, physics);
const targets = new Targets(stage);
const confetti = new Confetti(stage);
const butterflies = new Butterflies(stage);
const sound = new Sound();
const clock = new THREE.Clock();
const now = () => clock.elapsedTime;

// Små forsinkede handlinger (printning, næste diskette osv.).
let timers = [];
const later = (seconds, fn) => timers.push({ at: now() + seconds, fn });

// --- Disketter og printer ---

let activeDisk = null; // disketten robotten har givet gæsten
let inserting = null;
let printed = []; // ting fra printeren, der fjernes ved nyt print af samme slags

function dispenseDisk(topicIndex) {
  const start = robot.chestSlot(new THREE.Vector3());
  const disk = createDisk(physics, TOPICS[topicIndex], start);
  disk.data.index = topicIndex;
  disk.data.ignoreRobotUntil = now() + 1;
  disk.data.lowSince = null;
  disk.appear = 0;
  disk.mesh.scale.setScalar(0.001);
  // Kastebane fra robottens bryst ned på bordet foran gæsten.
  const target = new THREE.Vector3((Math.random() - 0.5) * 0.12, DESK_TOP + 0.02, -0.5);
  const T = 0.6;
  const v = target.sub(start).divideScalar(T);
  v.y += 0.5 * 9.82 * T;
  disk.body.velocity.set(v.x, v.y, v.z);
  disk.body.angularVelocity.set(0, 2.5, 0);
  robot.express('happy', 1, now());
  sound.tone(400, 800, 0.2, { type: 'triangle', volume: 0.08 });
  activeDisk = disk;
}

function startInsert(disk) {
  input.drop(disk);
  physics.freeze(disk);
  inserting = { disk, t: 0, from: disk.mesh.position.clone(), fromQ: disk.mesh.quaternion.clone() };
  sound.insert();
}

const flat = new THREE.Quaternion();
function updateInsert(dt) {
  if (!inserting) return;
  const s = inserting;
  s.t += dt;
  const mesh = s.disk.mesh;
  if (s.t < 0.25) {
    const k = s.t / 0.25;
    mesh.position.lerpVectors(s.from, desk.slotFront, k);
    mesh.quaternion.slerpQuaternions(s.fromQ, flat, k);
  } else {
    const k = Math.min(1, (s.t - 0.25) / 0.4);
    mesh.position.lerpVectors(desk.slotFront, desk.slotInside, k * k);
    mesh.quaternion.copy(flat);
    if (k >= 1) {
      physics.remove(s.disk);
      if (activeDisk === s.disk) activeDisk = null;
      inserting = null;
      onDiskInserted(s.disk.data.topic);
    }
  }
}

function clearPrinted(kind) {
  printed = printed.filter((item) => {
    if (item.kind !== kind) return true;
    confetti.burst(item.mesh.position.clone(), 12, 0.8);
    input.drop(item);
    physics.remove(item);
    return false;
  });
}

function spawnOnPad(item, velocity) {
  item.appear = 0;
  item.mesh.scale.setScalar(0.001);
  item.body.velocity.set(velocity.x, velocity.y, velocity.z);
  printed.push(item);
}

const padTop = () => PAD.clone().setY(DESK_TOP + 0.08);

function printItem(kind) {
  desk.startPrint();
  sound.printing();
  later(1.0, () => {
    if (kind === 'blocks') {
      clearPrinted('block');
      [...'CO:PLAY'].forEach((letter, i) => later(i * 0.3, () => {
        const block = createLetterBlock(physics, letter, i, padTop());
        spawnOnPad(block, new THREE.Vector3((Math.random() - 0.3) * 0.5, 1.2, (Math.random() - 0.5) * 0.3));
      }));
    } else if (kind === 'blaster') {
      clearPrinted('blaster');
      spawnOnPad(createBlaster(physics, padTop()), new THREE.Vector3(0, 0.6, 0));
      targets.spawn();
    } else if (kind === 'butterflies') {
      butterflies.spawn(6, padTop());
    } else if (kind === 'coffee') {
      clearPrinted('coffee');
      spawnOnPad(createCoffee(physics, padTop(), glowTex), new THREE.Vector3(0, 0.5, 0));
    }
  });
}

// --- Forløbet ---

const story = {
  phase: 'intro', // intro | highfive | play
  queue: [],
  idle: 0,
  hint: 0,
  hits: 0,
  phaseTime: 0,
  nextDisk: 0,
  nextDiskAt: Infinity,
  disksGiven: 0,
  topicsSeen: new Set(),
  outroShown: false,

  reset() {
    for (const item of [...physics.items]) physics.remove(item);
    input.releaseAll();
    projectiles.clear();
    targets.clear();
    confetti.clear();
    butterflies.clear();
    timers = [];
    printed = [];
    activeDisk = null;
    inserting = null;
    robot.reset();

    Object.assign(this, {
      phase: 'intro', queue: [], idle: 0, hint: 0, hits: 0, phaseTime: 0,
      nextDisk: 0, nextDiskAt: Infinity, disksGiven: 0, topicsSeen: new Set(), outroShown: false,
    });
    robot.wave(4, now());
    this.say(INTRO[0]);
    for (const line of INTRO.slice(1)) this.queue.push(line);
  },

  say(line) {
    this.queue = [];
    robot.panel.say(line);
  },

  get quiet() {
    return !robot.panel.isTyping && this.queue.length === 0;
  },

  highFive(touched) {
    robot.setHighFive(false);
    if (touched) {
      robot.express('love', 1.8, now());
      sound.clap();
      confetti.burst(robot.highFiveHand(new THREE.Vector3()), 30, 1.2);
    }
    this.say(HIGH_FIVE_DONE);
    this.phase = 'play';
    this.nextDiskAt = now() + 2.5;
  },

  onGrab() {
    this.idle = 0;
  },

  onHit(item) {
    if (item?.data.ignoreRobotUntil > now()) return;
    if (!robot.hit(now())) return;
    sound.boing();
    if (this.phase === 'play' && this.quiet && now() - robot.panel.finishedAt > 4) {
      this.say(HIT_LINES[this.hits++ % HIT_LINES.length]);
    }
  },

  update(time, dt) {
    const panel = robot.panel;
    const since = time - panel.finishedAt;
    if (!panel.isTyping && this.queue.length && since > LINE_PAUSE) panel.say(this.queue.shift());
    this.phaseTime += dt;

    if (this.phase === 'intro') {
      if (this.quiet && since > 1.5) {
        this.phase = 'highfive';
        this.phaseTime = 0;
        robot.setHighFive(true);
        this.say(HIGH_FIVE);
      }
      return;
    }

    if (this.phase === 'highfive') {
      const hand = robot.highFiveHand(new THREE.Vector3());
      const touched = input.perches.some((p) => p.point.distanceTo(hand) < 0.11);
      if (touched || this.phaseTime > HIGH_FIVE_TIMEOUT) this.highFive(touched);
      return;
    }

    // Næste diskette, når den forrige er sat i og robotten har talt færdig.
    if (!activeDisk && !inserting && time > this.nextDiskAt && this.quiet) {
      dispenseDisk(this.nextDisk);
      this.queue.push(this.disksGiven === 0 ? DISK_HINT : NEXT_DISK);
      this.nextDisk = (this.nextDisk + 1) % TOPICS.length;
      this.disksGiven++;
      this.nextDiskAt = Infinity;
    }

    // En tabt diskette kastes igen, hvis den har ligget på gulvet et stykke tid.
    if (activeDisk && !activeDisk.heldBy && !activeDisk.frozen) {
      const low = activeDisk.mesh.position.y < 0.3;
      if (!low) activeDisk.data.lowSince = null;
      else if (activeDisk.data.lowSince === null) activeDisk.data.lowSince = time;
      else if (time - activeDisk.data.lowSince > 8) {
        const index = activeDisk.data.index;
        physics.remove(activeDisk);
        dispenseDisk(index);
      }
    }

    this.idle += dt;
    if (this.idle > IDLE_HINT_AFTER && this.quiet && since > 8) {
      this.idle = 0;
      this.say(HINTS[this.hint++ % HINTS.length]);
    }
  },
};

function onDiskInserted(topic) {
  story.topicsSeen.add(topic.label);
  story.say(topic);
  story.queue.push(topic.play);
  if (!story.outroShown && story.topicsSeen.size === TOPICS.length) {
    story.outroShown = true;
    story.queue.push(OUTRO);
  }
  story.nextDiskAt = now() + NEXT_DISK_AFTER;
  story.idle = 0;
  robot.express('happy', 2, now());
  printItem(topic.item);
}

const input = new Input({
  renderer, scene, camera, stage, physics,
  onGrab: () => story.onGrab(),
  // Desktop: klik på robottens hånd giver high five.
  onClick: (raycaster) => {
    if (story.phase !== 'highfive') return false;
    if (!raycaster.intersectObject(robot.highFiveMesh, true).length) return false;
    story.highFive(true);
    return true;
  },
});
robot.onHit = (item) => story.onHit(item);

// --- Det der sker hvert billede ---

const viewerPos = new THREE.Vector3();
const viewerLocal = new THREE.Vector3();
const headPos = new THREE.Vector3();
const tmp = new THREE.Vector3();
const tmpDir = new THREE.Vector3();

function updatePlay(time, dt) {
  // Disketter suges ind, når de kommer tæt på åbningen.
  let diskNear = 0;
  for (const item of physics.items) {
    if (item.kind !== 'disk' || item.frozen) continue;
    const d = item.mesh.position.distanceTo(desk.slotFront);
    if (d < 0.07 && !inserting) startInsert(item);
    else if (item.heldBy) diskNear = Math.max(diskNear, 1 - Math.min(1, (d - 0.07) / 0.3));
  }
  desk.update(time, dt, diskNear);
  updateInsert(dt);

  // Konfettikanonen skyder af sig selv, mens den holdes.
  for (const holder of input.holders) {
    const item = holder.held;
    if (item.kind === 'blaster') {
      item.data.cooldown -= dt;
      if (item.data.cooldown <= 0) {
        item.data.cooldown = 0.3;
        tmp.copy(BLASTER_MUZZLE).applyQuaternion(item.mesh.quaternion).add(item.mesh.position);
        tmpDir.set(0, 0, -1).applyQuaternion(item.mesh.quaternion).multiplyScalar(11).add(holder.velocity);
        projectiles.fire(tmp, tmpDir);
        sound.pew();
      }
    }
    // Slag mod robotten med noget i hånden.
    robot.headPosition(headPos);
    if (item.mesh.position.distanceTo(headPos) < 0.22 && holder.velocity.length() > 1.2) story.onHit(item);
  }
  projectiles.update(dt);

  // Skydeskiver rammes af skud og af kastede ting.
  const hits = [];
  for (const shot of projectiles.alive) {
    const t = targets.hitTest(shot.mesh.position, 0.02);
    if (t) {
      hits.push(t);
      projectiles.retire(shot);
    }
  }
  for (const item of physics.items) {
    if (item.heldBy || item.frozen || item.body.velocity.length() < 1) continue;
    const t = targets.hitTest(item.mesh.position, item.radius * 0.6);
    if (t) hits.push(t);
  }
  for (const t of hits) {
    confetti.burst(t.group.position.clone(), 60, 2.2);
    sound.pop();
    robot.express('happy', 1, time);
  }
  if (hits.length && targets.allDown) {
    robot.celebrate(time);
    sound.clap();
    later(3, () => targets.spawn());
  }
  targets.update(time, dt, viewerLocal);

  for (const item of printed) if (item.kind === 'coffee') updateCoffee(item, time);
  butterflies.update(time, dt, input.perches);
  confetti.update(dt);
}

// Drej og flyt scenen, så robotten står foran gæsten uanset hvor headsettet blev startet.
let alignFrames = -1;
function alignStage() {
  const xrCamera = renderer.xr.getCamera();
  xrCamera.getWorldPosition(viewerPos);
  xrCamera.getWorldDirection(tmpDir);
  stage.position.set(viewerPos.x, 0, viewerPos.z);
  stage.rotation.y = Math.atan2(-tmpDir.x, -tmpDir.z);
}

// --- Startskærm og VR-session ---
const overlay = document.getElementById('overlay');
const startButton = document.getElementById('start');
const hint = document.getElementById('hint');
let vrSupported = false;

if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-vr').then((ok) => {
    vrSupported = ok;
    if (!ok) showPreviewHint();
  });
} else {
  showPreviewHint();
}

function showPreviewHint() {
  startButton.textContent = 'Se forhåndsvisning';
  hint.textContent = 'VR understøttes ikke i denne browser. Træk for at kigge rundt, træk i tingene for at kaste dem, og brug scrollhjulet til at flytte dem frem og tilbage.';
}

startButton.addEventListener('click', async () => {
  sound.start();
  if (!vrSupported) {
    overlay.classList.add('hidden');
    story.reset();
    return;
  }
  try {
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'hand-tracking'],
    });
    await renderer.xr.setSession(session);
  } catch (err) {
    hint.textContent = `Kunne ikke starte VR: ${err.message}`;
  }
});

let hiddenSince = null;
renderer.xr.addEventListener('sessionstart', () => {
  overlay.classList.add('hidden');
  story.reset();
  alignFrames = 0;
  const session = renderer.xr.getSession();
  session.addEventListener('visibilitychange', () => {
    if (session.visibilityState !== 'visible') {
      hiddenSince ??= performance.now();
      return;
    }
    if (hiddenSince && performance.now() - hiddenSince > RESET_AFTER_HIDDEN * 1000) {
      story.reset();
      alignFrames = 0;
    }
    hiddenSince = null;
  });
  renderer.xr.getReferenceSpace()?.addEventListener('reset', () => {
    alignFrames = 0;
  });
});
renderer.xr.addEventListener('sessionend', () => {
  overlay.classList.remove('hidden');
  stage.position.set(0, 0, 0);
  stage.rotation.set(0, 0, 0);
  story.reset();
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

story.reset();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  simulate(clock.elapsedTime, dt);
  renderer.render(scene, camera);
});

function simulate(time, dt) {
  // XR-kameraet har først en gyldig position efter et par billeder.
  if (alignFrames >= 0 && renderer.xr.isPresenting && ++alignFrames > 3) {
    alignStage();
    alignFrames = -1;
  }

  const due = timers.filter((t) => t.at <= time);
  timers = timers.filter((t) => t.at > time);
  for (const t of due) t.fn();

  scene.updateMatrixWorld();
  const viewer = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
  viewer.getWorldPosition(viewerPos);
  viewerLocal.copy(viewerPos);
  stage.worldToLocal(viewerLocal);

  world.update(time, dt);
  input.update(time, dt);
  physics.step(dt);
  robot.update(time, dt, viewerLocal);
  updatePlay(time, dt);
  story.update(time, dt);
}

// Til fejlfinding i browserens konsol. advance(sek) spoler tiden frem uden at tegne.
window.lounge = {
  story, physics, input, robot, targets, butterflies, desk, printItem, dispenseDisk, startInsert,
  advance(seconds) {
    for (let t = 0; t < seconds; t += 1 / 60) {
      clock.elapsedTime += 1 / 60;
      simulate(clock.elapsedTime, 1 / 60);
    }
  },
};
