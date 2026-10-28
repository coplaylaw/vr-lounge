import * as THREE from 'three';
import { buildWorld, SKY_HORIZON } from './world.js';
import { Physics } from './physics.js';
import { Robot } from './robot.js';
import { Desk, DESK, DESK_TOP, PAD } from './desk.js';
import {
  createDisk, createLetterBlock, createBlaster, createCoffee, updateCoffee, CoffeeSpill, BLASTER_MUZZLE,
  Projectiles, Targets, Confetti, Butterflies,
} from './items.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { glowTexture } from './materials.js';
import { LanguageButtons } from './language.js';
import { Reveal } from './reveal.js';
import {
  SPEAKER, LANGUAGE_PROMPT, setLanguage, SIGN,
  INTRO, HIGH_FIVE, HIGH_FIVE_DONE, DISK_HINT, NEXT_DISK, TOPICS, HIT_LINES, HINTS, OUTRO, VOICE_FILES,
} from './content.js';

const LINE_PAUSE = 3; // sekunder mellem robottens linjer
const VOICE_PAUSE = 0.8; // kortere pause, når robotten har sagt linjen højt
const IDLE_HINT_AFTER = 30;
const HIGH_FIVE_TIMEOUT = 14;
const NEXT_DISK_AFTER = 12; // sekunder efter en diskette er sat i
const RESET_AFTER_HIDDEN = 15; // headsettet taget af i så mange sekunder = ny gæst

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.localClippingEnabled = true; // kaffens overflade klippes ved koppens kant
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(1);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_HORIZON);
scene.fog = new THREE.FogExp2(SKY_HORIZON, 0.0035);

// Siddende øjenhøjde til desktop-forhåndsvisningen. I VR styrer headsettet kameraet.
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.03, 2000);
// Bredere synsfelt på en stående telefon, så man ser mere end bare robotten.
const fitCamera = () => {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? 95 : 70;
  camera.updateProjectionMatrix();
};
fitCamera();
camera.position.set(0, 1.2, 0);

// Alt indhold ligger i "stage", som flyttes hen til gæsten, når VR starter.
const stage = new THREE.Group();
scene.add(stage);

const glowTex = glowTexture();
const physics = new Physics(stage, glowTex);
// Rummet, bordet og byen ligger i worldRoot, så de kan "indlæses", når gæsten har valgt sprog.
const worldRoot = new THREE.Group();
stage.add(worldRoot);
const world = buildWorld(worldRoot, physics);
const desk = new Desk(worldRoot, physics);
desk.beam.userData.noReveal = true; // styres af printeren selv
const reveal = new Reveal(scene, worldRoot);
reveal.prepare();
const robot = new Robot(stage, physics, SPEAKER, glowTex);
const projectiles = new Projectiles(stage, physics);
const targets = new Targets(stage);
const confetti = new Confetti(stage);
const butterflies = new Butterflies(stage);
// Spildt kaffe lander på bordet foran gæsten eller på gulvet.
const coffeeSpill = new CoffeeSpill(stage, [{
  y: DESK_TOP, minX: -DESK.width / 2, maxX: DESK.width / 2, minZ: DESK.z - DESK.depth / 2, maxZ: DESK.z + DESK.depth / 2,
}]);
const languageButtons = new LanguageButtons(stage);
const sound = new Sound(stage, VOICE_FILES);
// Rumskibet lyder som et dybere sus af toget.
world.spaceship.onPass = (pos) => sound.play('ambience/monorail-pass', { at: pos, ref: 30, volume: 0.9, rate: 0.7 });
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
  sound.play('robot/disk-launch', { at: disk.mesh.position });
  activeDisk = disk;
}

function startInsert(disk) {
  input.drop(disk);
  physics.freeze(disk);
  inserting = { disk, t: 0, from: disk.mesh.position.clone(), fromQ: disk.mesh.quaternion.clone() };
  sound.play('desk/disk-insert', { at: desk.slotFront });
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
    sound.play('desk/dematerialize', { at: item.mesh.position, volume: 0.7 });
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
  sound.play('desk/materialize', { at: item.mesh.position, volume: 0.7 });
}

const padTop = () => PAD.clone().setY(DESK_TOP + 0.08);

function printItem(kind) {
  desk.startPrint();
  sound.play('desk/print', { at: PAD, delay: 0.3 });
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
      spawnTargets();
    } else if (kind === 'butterflies') {
      butterflies.spawn(6, padTop());
      sound.play('butterflies/spawn', { at: PAD });
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
    coffeeSpill.clear();
    timers = [];
    printed = [];
    activeDisk = null;
    inserting = null;
    robot.reset();
    sound.stopSpeaking();

    Object.assign(this, {
      speakingUntil: 0,
      phase: 'language', queue: [], idle: 0, hint: 0, hits: 0, phaseTime: 0,
      nextDisk: 0, nextDiskAt: Infinity, disksGiven: 0, topicsSeen: new Set(), outroShown: false,
    });
    // Hver ny gæst starter med at vælge sprog.
    robot.wave(4, now());
    sound.play('robot/wave', { at: robot.headPosition(tmp), delay: 0.4 });
    languageButtons.show();
    reveal.hide();
    this.say(LANGUAGE_PROMPT);
  },

  chooseLanguage(id) {
    setLanguage(id);
    desk.setSign(SIGN);
    languageButtons.hide();
    reveal.start();
    sound.play('desk/print', { volume: 0.8 });
    robot.express('happy', 1.2, now());
    sound.play('robot/happy', { at: robot.headPosition(tmp) });
    this.phase = 'intro';
    this.phaseTime = 0;
    this.say(INTRO[0]);
    for (const line of INTRO.slice(1)) this.queue.push(line);
  },

  say(line) {
    this.queue = [];
    this.show(line);
  },

  show(line) {
    robot.panel.say(line);
    this.voiced = Boolean(line.voice);
    sound.play('ui/panel-open', { at: robot.panel.mesh.position, volume: 0.5 });
    if (line.voice) {
      // Historien venter, til robotten har talt færdig (højst 30 sekunder, hvis lyden aldrig slutter).
      this.speakingUntil = now() + 30;
      sound.speak(line.voice, { at: robot.headPosition(tmp), onEnd: () => (this.speakingUntil = now()) });
    } else {
      sound.stopSpeaking();
      this.speakingUntil = 0;
      sound.play('robot/talk-blip', { at: robot.headPosition(tmp), volume: 0.6, delay: 0.1 });
    }
    if (HINTS.includes(line)) sound.play('ui/hint', { volume: 0.6 });
    if (line === OUTRO) sound.play('ui/outro', { volume: 0.7, delay: 0.3 });
  },

  get quiet() {
    return !robot.panel.isTyping && this.queue.length === 0 && now() >= this.speakingUntil;
  },

  // Hvornår robotten sidst blev færdig med at vise og sige noget.
  get doneTalkingAt() {
    return Math.max(robot.panel.finishedAt, this.speakingUntil);
  },

  highFive(touched) {
    robot.setHighFive(false);
    if (touched) {
      robot.express('love', 1.8, now());
      const hand = robot.highFiveHand(new THREE.Vector3());
      sound.play('robot/highfive', { at: hand });
      sound.play('fx/confetti-burst', { at: hand, volume: 0.6 });
      sound.play('robot/love', { at: robot.headPosition(tmp), delay: 0.5 });
      confetti.burst(hand, 30, 1.2);
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
    sound.play('robot/hit', { at: robot.headPosition(tmp) });
    if (this.phase === 'play' && this.quiet && now() - this.doneTalkingAt > 4) {
      this.say(HIT_LINES[this.hits++ % HIT_LINES.length]);
    }
  },

  update(time, dt) {
    const panel = robot.panel;
    const since = time - this.doneTalkingAt;
    const pause = this.voiced ? VOICE_PAUSE : LINE_PAUSE;
    if (!panel.isTyping && this.queue.length && since > pause) this.show(this.queue.shift());
    this.phaseTime += dt;

    if (this.phase === 'language') {
      // I VR vælges sproget ved at røre en knap. På skærmen klikkes der (se onClick).
      const points = input.xrActive ? input.perches.map((p) => p.point) : [];
      const id = languageButtons.update(time, points);
      if (id) this.chooseLanguage(id);
      return;
    }

    if (this.phase === 'intro') {
      if (this.quiet && since > 1.5) {
        this.phase = 'highfive';
        this.phaseTime = 0;
        robot.setHighFive(true);
        sound.play('robot/highfive-ready', { at: robot.headPosition(tmp) });
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
  sound.play('desk/disk-read', { at: desk.slotFront, volume: 0.8 });
  sound.play('robot/happy', { at: robot.headPosition(tmp), delay: 0.8 });
  printItem(topic.item);
}

function spawnTargets() {
  targets.spawn();
  sound.play('blaster/target-spawn', { volume: 0.7 });
}

const input = new Input({
  renderer, scene, camera, stage, physics,
  onGrab: (item) => {
    story.onGrab();
    sound.play('interact/grab', { at: item.mesh.position, volume: 0.6 });
  },
  onRelease: (item) => {
    const fast = item.body.velocity.length() > 1.5;
    sound.play(fast ? 'interact/throw' : 'interact/release', { at: item.mesh.position, volume: fast ? 0.8 : 0.4 });
  },
  onPull: (item) => sound.play('interact/pull', { at: item.mesh.position, volume: 0.8 }),
  onPoint: (item) => sound.play('interact/pointer-hover', { at: item.mesh.position, volume: 0.3, gap: 0.15 }),
  // Skærm: klik på en sprogknap eller på robottens hånd for high five.
  onClick: (raycaster) => {
    if (story.phase === 'language') {
      const id = languageButtons.pick(raycaster);
      if (id) story.chooseLanguage(id);
      return Boolean(id);
    }
    if (story.phase !== 'highfive') return false;
    if (!raycaster.intersectObject(robot.highFiveMesh, true).length) return false;
    story.highFive(true);
    return true;
  },
});
robot.onHit = (item) => story.onHit(item);

// --- Lyde fra fysikken og tingene ---

// Lyden afhænger af tingen og det, den rammer. Uden et bedre match bruges væggens eller bordets lyd.
const IMPACTS = {
  disk: { table: 'impact/disk-table', floor: 'impact/disk-floor' },
  block: { table: 'impact/block-table', floor: 'impact/block-floor' },
  blaster: { table: 'impact/blaster-table', floor: 'impact/blaster-floor' },
  coffee: { table: 'impact/mug-table', floor: 'impact/mug-floor' },
};
const SURFACES = {
  wall: 'impact/wall', window: 'impact/glass', glass: 'impact/glass', ceiling: 'impact/ceiling', item: 'impact/soft-thud',
};
physics.onImpact = (item, surface, speed, other) => {
  if (speed < 0.35 || item.frozen) return;
  const t = now();
  if (t - (item.data.lastImpact ?? -1) < 0.12) return;
  item.data.lastImpact = t;
  if (other) other.data.lastImpact = t; // én lyd pr. sammenstød
  if (surface === 'window' && item.mesh.position.y < 0.85) surface = 'wall'; // under vindueskarmen
  let name = IMPACTS[item.kind]?.[surface] ?? SURFACES[surface] ?? IMPACTS[item.kind]?.table;
  if (surface === 'item' && item.kind === 'block' && other.kind === 'block') name = 'impact/block-stack';
  if (!name) return;
  sound.play(name, { at: item.mesh.position, volume: Math.min(1, 0.15 + speed / 3), gap: 0.03 });
  if (item.kind === 'coffee' && speed > 1) sound.play('coffee/slosh', { at: item.mesh.position, volume: 0.6, gap: 0.5 });
};
projectiles.onImpact = (shot) => sound.play('blaster/shot-impact', { at: shot.mesh.position, volume: 0.35, gap: 0.08 });
butterflies.onLand = (pos) => sound.play('butterflies/land', { at: pos, volume: 0.7 });
butterflies.onTakeoff = (pos) => sound.play('butterflies/takeoff', { at: pos, volume: 0.6 });

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
        sound.play('blaster/shot', { at: tmp, volume: 0.6 });
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
    sound.play('blaster/target-hit', { at: t.group.position });
    robot.express('happy', 1, time);
  }
  if (hits.length && targets.allDown) {
    robot.celebrate(time);
    sound.play('blaster/all-targets');
    sound.play('robot/celebrate', { at: robot.headPosition(tmp), delay: 0.6 });
    later(3, spawnTargets);
  }
  targets.update(time, dt, viewerLocal);

  for (const item of printed) {
    if (item.kind !== 'coffee') continue;
    if (updateCoffee(item, time, dt, coffeeSpill) > 0.05) sound.play('coffee/slosh', { at: item.mesh.position, volume: 0.6, gap: 0.5 });
  }
  coffeeSpill.update(dt);
  butterflies.update(time, dt, input.perches);
  confetti.update(dt);
  updateSounds(time, dt, diskNear);
}

// Lyde, der følger med tingene: robottens summen, skydeskiver, sommerfugle, kaffen og toget udenfor.
const soundState = { yaw: 0, servoAt: 0, trainDist: Infinity, trainCloser: false, trainAt: -Infinity };
const center = new THREE.Vector3();
function updateSounds(time, dt, diskNear) {
  sound.steady('robot/hover-loop', 0.3, robot.headPosition(headPos));
  sound.steady('desk/disk-near', diskNear * 0.6, desk.slotFront);

  // Servoen høres, når robotten drejer hovedet hurtigt.
  const turn = Math.abs(robot.yaw - soundState.yaw) / Math.max(dt, 1e-3);
  soundState.yaw = robot.yaw;
  if (turn > 1.2 && time > soundState.servoAt) {
    soundState.servoAt = time + 1.5;
    sound.play('robot/servo', { at: headPos, volume: 0.35 });
  }

  const alive = targets.list.filter((t) => t.alive);
  center.set(0, 0, 0);
  for (const t of alive) center.add(t.group.position);
  sound.steady('blaster/target-hum', alive.length ? 0.2 : 0, alive.length ? center.divideScalar(alive.length) : null);

  const flying = butterflies.list.filter((b) => b.state !== 'perched');
  center.set(0, 0, 0);
  for (const b of flying) center.add(b.group.position);
  sound.steady('butterflies/flutter-loop', flying.length ? 0.35 : 0, flying.length ? center.divideScalar(flying.length) : null);

  const coffee = printed.find((item) => item.kind === 'coffee');
  sound.steady('coffee/steam-loop', coffee ? 0.25 : 0, coffee?.mesh.position);
  if (coffee?.heldBy) {
    if (coffee.heldBy.velocity.length() > 0.9) sound.play('coffee/slosh', { at: coffee.mesh.position, volume: 0.4, gap: 0.8 });
    if (coffee.mesh.position.distanceTo(viewerLocal) < 0.2) sound.play('coffee/sip', { at: coffee.mesh.position, gap: 6 });
  }

  // Toget: lyden starter, når den nærmeste vogn er tættest på tårnet.
  let dist = Infinity;
  let nearest = null;
  for (const car of world.trainCars) {
    const d = car.position.distanceTo(viewerLocal);
    if (d < dist) {
      dist = d;
      nearest = car;
    }
  }
  const closer = dist < soundState.trainDist;
  if (soundState.trainCloser && !closer && dist < 55 && time - soundState.trainAt > 20) {
    soundState.trainAt = time;
    sound.play('ambience/monorail-pass', { at: nearest.position, ref: 25, volume: 0.8 });
  }
  soundState.trainCloser = closer;
  soundState.trainDist = dist;
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
const flatButton = document.getElementById('flat');
const hint = document.getElementById('hint');
// Startskærmen vises, før gæsten har valgt sprog, så den er på begge sprog.
const PREVIEW_HINT = 'Træk for at kigge rundt og kaste ting. Drag to look around and throw things.';
// Telefoner siger også ja til VR (Cardboard), så kun Quest-browseren starter i VR som standard.
const isQuest = /OculusBrowser|Quest/i.test(navigator.userAgent);
let vrSupported = false;

startButton.textContent = 'Start';
startButton.addEventListener('click', () => (vrSupported && isQuest ? startVR() : startPreview()));
flatButton.addEventListener('click', () => (isQuest ? startPreview() : startVR()));

if (navigator.xr) {
  navigator.xr.isSessionSupported('immersive-vr').then((ok) => {
    vrSupported = ok;
    if (ok) flatButton.textContent = isQuest ? 'Uden VR · Without VR' : 'VR';
    flatButton.hidden = !ok;
    if (!ok || !isQuest) hint.textContent = PREVIEW_HINT;
  });
} else {
  hint.textContent = PREVIEW_HINT;
}

// Flad visning på skærmen, som på en pc.
function startPreview() {
  sound.start();
  sound.play('ui/start', { volume: 0.7 });
  overlay.classList.add('hidden');
  story.reset();
}

async function startVR() {
  sound.start();
  sound.play('ui/start', { volume: 0.7 });
  try {
    const session = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'hand-tracking'],
    });
    await renderer.xr.setSession(session);
  } catch (err) {
    hint.textContent = `Kunne ikke starte VR · Could not start VR: ${err.message}`;
  }
}

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
      sound.play('ui/reset', { volume: 0.6 });
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
  fitCamera();
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
  reveal.update(dt, viewerPos);
  input.update(time, dt);
  physics.step(dt);
  robot.update(time, dt, viewerLocal);
  updatePlay(time, dt);
  story.update(time, dt);
  sound.update(viewer);
}

// Til fejlfinding i browserens konsol. advance(sek) spoler tiden frem uden at tegne.
window.lounge = {
  story, physics, input, robot, targets, butterflies, desk, languageButtons, reveal, world, scene, camera, printItem, dispenseDisk, startInsert, renderer, sound,
  advance(seconds) {
    for (let t = 0; t < seconds; t += 1 / 60) {
      clock.elapsedTime += 1 / 60;
      simulate(clock.elapsedTime, 1 / 60);
    }
  },
};
