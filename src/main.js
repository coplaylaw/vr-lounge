import * as THREE from 'three';
import { buildWorld, SKY_HORIZON } from './world.js';
import { Physics, CANNON } from './physics.js';
import { Robot } from './robot.js';
import { Desk, DESK, DESK_TOP, PAD } from './desk.js';
import {
  createDisk, createLetterBlock, createBlaster, createCoffee, updateCoffee, CoffeeSpill, BLASTER_MUZZLE,
  Projectiles, Targets, Confetti, Butterflies,
} from './items.js';
import {
  createCamera, LENS, SHUTTER, Photos, createStamp, createContract, StampMarks, createPlane, updatePlane,
  createPaperBall, PaperBin,
} from './toys.js';
import { Props, VIEW_LAYER } from './props.js';
import { Avatar } from './avatar.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { glowTexture } from './materials.js';
import { LanguageButtons } from './language.js';
import { ControllerGuide } from './guide.js';
import { Reveal } from './reveal.js';
import {
  SPEAKER, LANGUAGE_PROMPT, CONTROLLER_GUIDE, setLanguage, SIGN,
  INTRO, HIGH_FIVE, HIGH_FIVE_DONE, DISK_HINT, NEXT_DISK, TOPICS, BONUS_TOPICS, BONUS, EVENTS,
  HIT_LINES, HINTS, OUTRO, VOICE_FILES,
} from './content.js';

const LINE_PAUSE = 3; // sekunder mellem robottens linjer
const VOICE_PAUSE = 0.8; // kortere pause, når robotten har sagt linjen højt
const IDLE_HINT_AFTER = 30;
const HIGH_FIVE_TIMEOUT = 14;
// Næste diskette kommer, når gæsten har rørt ved det, maskinen printede (plus PLAY_DELAY),
// eller senest PLAY_TIMEOUT sekunder efter, at disketten blev sat i.
const PLAY_DELAY = 4;
const PLAY_TIMEOUT = 30;
const RESET_AFTER_HIDDEN = 5; // headsettet taget af i så mange sekunder = ny gæst, og oplevelsen starter forfra

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
camera.layers.enable(VIEW_LAYER); // billedet i headsettet ses kun af gæsten selv

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
// Skraldespanden bag gæsten hører til rummet og "indlæses" med det.
const bin = new PaperBin(worldRoot, physics, glowTex);
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
const guide = new ControllerGuide(stage);
const sound = new Sound(stage, VOICE_FILES);
const avatar = new Avatar(scene);
const photos = new Photos(physics);
const stampMarks = new StampMarks(stage);
const clock = new THREE.Clock();
const now = () => clock.elapsedTime;

// Små forsinkede handlinger (printning, næste diskette osv.).
let timers = [];
const later = (seconds, fn) => timers.push({ at: now() + seconds, fn });

// Tegner scenen fra et andet kamera til en render target (kameraets billeder og headsettet på bænken).
// WebXR slås fra imens, ligesom three.js' Reflector gør.
function renderView(target, viewCamera) {
  const xr = renderer.xr.enabled;
  const previous = renderer.getRenderTarget();
  renderer.xr.enabled = false;
  renderer.setRenderTarget(target);
  renderer.render(scene, viewCamera);
  renderer.setRenderTarget(previous);
  renderer.xr.enabled = xr;
}

// --- Disketter og printer ---

// Alle disketter på det valgte sprog.
const allTopics = () => [...TOPICS, ...BONUS_TOPICS];
let disksOut = []; // disketter robotten har givet gæsten, som ikke er sat i endnu
let inserting = null;
let printed = []; // ting fra printeren, der fjernes ved nyt print af samme slags

// Bonusdisketterne lægges på række langs bordkanten, uden om printpladen og maskinen.
const BONUS_SPOTS = [-0.6, -0.04, 0.15, 0.33];

function dispenseDisk(topic, x = (Math.random() - 0.5) * 0.12, z = -0.5) {
  const start = robot.chestSlot(new THREE.Vector3());
  const disk = createDisk(physics, topic, start);
  disk.data.ignoreRobotUntil = now() + 1;
  disk.data.lowSince = null;
  disk.data.spot = [x, z];
  disk.appear = 0;
  disk.mesh.scale.setScalar(0.001);
  // Kastebane fra robottens bryst ned på bordet foran gæsten.
  const target = new THREE.Vector3(x, DESK_TOP + 0.02, z);
  const T = 0.6;
  const v = target.sub(start).divideScalar(T);
  v.y += 0.5 * 9.82 * T;
  disk.body.velocity.set(v.x, v.y, v.z);
  disk.body.angularVelocity.set(0, 2.5, 0);
  robot.express('happy', 1, now());
  sound.play('robot/disk-launch', { at: disk.mesh.position });
  disksOut.push(disk);
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
      disksOut = disksOut.filter((d) => d !== s.disk);
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
  item.data.printedAt = now();
  printed.push(item);
  sound.play('desk/materialize', { at: item.mesh.position, volume: 0.7 });
}

const padTop = () => PAD.clone().setY(DESK_TOP + 0.08);
const BALLS = 5;
let ballSeed = 1;

function printBall(delay = 0) {
  later(delay, () => {
    const ball = createPaperBall(physics, padTop(), ballSeed++);
    spawnOnPad(ball, new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.1, (Math.random() - 0.5) * 0.3));
  });
}

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
    } else if (kind === 'camera') {
      clearPrinted('camera');
      spawnOnPad(createCamera(physics, padTop()), new THREE.Vector3(0, 0.6, 0));
    } else if (kind === 'stamp') {
      clearPrinted('paper');
      clearPrinted('stamp');
      spawnOnPad(createContract(physics, padTop()), new THREE.Vector3(0.05, 0.5, 0.25));
      later(0.5, () => spawnOnPad(createStamp(physics, padTop()), new THREE.Vector3(0.25, 0.8, 0)));
      sound.play('paper/rustle', { at: PAD, delay: 0.1 });
    } else if (kind === 'plane') {
      clearPrinted('plane');
      for (const i of [0, 1]) later(i * 0.5, () => spawnOnPad(createPlane(physics, padTop()), new THREE.Vector3(0.1 - i * 0.25, 0.7, 0.1)));
    } else if (kind === 'paperballs') {
      clearPrinted('ball');
      for (let i = 0; i < BALLS; i++) printBall(i * 0.3);
      sound.play('paper/crumple', { at: PAD, delay: 0.2 });
      bin.flash = 1;
    }
  });
}

// --- Forløbet ---

const story = {
  phase: 'intro', // guide | language | intro | highfive | play
  queue: [],
  idle: 0,
  hint: 0,
  hits: 0,
  phaseTime: 0,
  nextDisk: 0,
  nextDiskAt: Infinity,
  insertedAt: Infinity, // når den seneste diskette blev sat i
  disksGiven: 0,
  topicsSeen: new Set(),
  bonusGiven: false,
  outroShown: false,
  said: new Set(), // replikker fra EVENTS, der allerede er sagt
  fixing: null,

  reset() {
    for (const item of [...physics.items]) physics.remove(item);
    input.releaseAll();
    projectiles.clear();
    targets.clear();
    confetti.clear();
    butterflies.clear();
    photos.clear();
    stampMarks.clear();
    bin.reset();
    coffeeSpill.clear();
    timers = [];
    printed = [];
    disksOut = [];
    inserting = null;
    robot.reset();
    sound.stopSpeaking();
    props.reset();

    Object.assign(this, {
      speakingUntil: 0,
      phase: 'language', queue: [], idle: 0, hint: 0, hits: 0, phaseTime: 0,
      nextDisk: 0, nextDiskAt: Infinity, insertedAt: Infinity, disksGiven: 0, topicsSeen: new Set(), bonusGiven: false, outroShown: false,
      said: new Set(),
    });
    // Hver ny gæst får først vist, hvordan controllerne holdes (kun i VR), og vælger så sprog.
    robot.wave(4, now());
    sound.play('robot/wave', { at: robot.headPosition(tmp), delay: 0.4 });
    reveal.hide();
    languageButtons.hide();
    if (renderer.xr.isPresenting) {
      this.phase = 'guide';
      guide.show();
      this.say(CONTROLLER_GUIDE);
    } else {
      this.askLanguage();
    }
  },

  askLanguage() {
    this.phase = 'language';
    this.phaseTime = 0;
    guide.hide();
    languageButtons.show();
    this.say(LANGUAGE_PROMPT);
  },

  chooseLanguage(id) {
    setLanguage(id);
    desk.setSign(SIGN);
    languageButtons.hide();
    reveal.start();
    // Headsettene på bænken tegnes frem af indlæsningen ligesom resten af rummet.
    for (const headset of props.spawnHeadsets()) {
      headset.mesh.traverse((obj) => obj.isMesh && reveal.patch(obj.material));
    }
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

  // En replik fra EVENTS. once: kun første gang. Den venter, hvis robotten er i gang med at tale.
  event(name, { once = true } = {}) {
    if (once && this.said.has(name)) return;
    this.said.add(name);
    if (this.phase !== 'play') return;
    if (this.quiet) this.say(EVENTS[name]);
    else if (this.queue.length < 2) this.queue.push(EVENTS[name]);
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

  onGrab(item) {
    this.idle = 0;
    if (item?.data.printedAt >= this.insertedAt) this.played();
  },

  // Gæsten har leget med det, der blev printet: næste diskette om lidt.
  played() {
    if (this.phase === 'play') this.nextDiskAt = Math.min(this.nextDiskAt, now() + PLAY_DELAY);
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

    if (this.phase === 'guide') {
      guide.update(dt);
      if (this.quiet && this.phaseTime > 3 && since > 1.2) this.askLanguage();
      return;
    }

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

    // Robotten flyver hen og retter maleriet eller vasen, når den har tid.
    if (!robot.away && !inserting && this.quiet) {
      const fix = props.nextFix(time);
      if (fix) {
        this.say(EVENTS[fix.kind]);
        robot.goFix(fix.spot, fix.look, fix.onFix);
        sound.play('robot/fly', { at: robot.headPosition(tmp), volume: 0.7 });
        later(2.5, () => sound.play('robot/fly', { at: robot.headPosition(tmp), volume: 0.6 }));
      }
    }

    // Næste diskette, når den forrige er sat i og robotten har talt færdig.
    // Har gæsten prøvet de første fire, deles bonusdisketterne ud på én gang.
    if (!disksOut.length && !inserting && time > this.nextDiskAt && this.quiet && !robot.away) {
      const round1 = TOPICS.every((t) => this.topicsSeen.has(t.label));
      if (round1 && !this.bonusGiven) {
        this.bonusGiven = true;
        this.say(BONUS);
        robot.express('love', 1.5, time);
        BONUS_TOPICS.forEach((topic, i) => later(0.6 + i * 0.45, () => dispenseDisk(topic, BONUS_SPOTS[i], -0.47)));
        this.nextDisk = 0;
      } else {
        // Efter bonusrunden gives alle disketterne én ad gangen i ring.
        const list = this.bonusGiven ? allTopics() : TOPICS;
        dispenseDisk(list[this.nextDisk % list.length]);
        this.queue.push(this.disksGiven === 0 ? DISK_HINT : NEXT_DISK);
        this.nextDisk = (this.nextDisk + 1) % list.length;
      }
      this.disksGiven++;
      this.nextDiskAt = Infinity;
    }

    // En tabt diskette kastes igen, hvis den har ligget på gulvet et stykke tid.
    for (const disk of disksOut) {
      if (disk.heldBy || disk.frozen) continue;
      const low = disk.mesh.position.y < 0.3;
      if (!low) disk.data.lowSince = null;
      else if (disk.data.lowSince === null) disk.data.lowSince = time;
      else if (time - disk.data.lowSince > 8 && !robot.away) {
        physics.remove(disk);
        disksOut = disksOut.filter((d) => d !== disk);
        dispenseDisk(disk.data.topic, ...disk.data.spot);
        break;
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
  if (!story.outroShown && story.topicsSeen.size === allTopics().length) {
    story.outroShown = true;
    story.queue.push(OUTRO);
  }
  story.insertedAt = now();
  story.nextDiskAt = now() + PLAY_TIMEOUT;
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
    story.onGrab(item);
    sound.play('interact/grab', { at: item.mesh.position, volume: 0.6 });
  },
  onRelease: (item) => {
    const fast = item.body.velocity.length() > 1.5;
    sound.play(fast ? 'interact/throw' : 'interact/release', { at: item.mesh.position, volume: fast ? 0.8 : 0.4 });
    if (item.kind === 'plane' && item.body.velocity.length() > 1) {
      item.data.flying = true;
      sound.play('paper/plane-whoosh', { at: item.mesh.position, volume: 0.7 });
    }
  },
  onPull: (item) => sound.play('interact/pull', { at: item.mesh.position, volume: 0.8 }),
  onPoint: (item) => sound.play('interact/pointer-hover', { at: item.mesh.position, volume: 0.3, gap: 0.15 }),
  onUse: (item) => {
    if (item.kind === 'camera') takePhoto(item);
  },
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

const props = new Props({ scene, physics, input, robot, sound, refs: world.props, render: renderView });
props.onEvent = (name) => story.event(name);

// --- Kameraet, stemplet og skraldespanden ---

let photoQueued = null;
function takePhoto(cameraItem) {
  // Billedet tegnes først lige før næste billede, så det ikke sker midt i en XR-hændelse.
  if (photoQueued || cameraItem.data.cooldown > now()) return;
  photoQueued = cameraItem;
  cameraItem.data.cooldown = now() + 1.2;
}

function developQueuedPhoto() {
  const cameraItem = photoQueued;
  photoQueued = null;
  if (!physics.items.has(cameraItem)) return;
  const at = cameraItem.mesh.position;
  sound.play('camera/shutter', { at });
  // Blitz: et kort hvidt lys foran kameraet.
  tmp.copy(LENS).setZ(-0.08).applyQuaternion(cameraItem.mesh.quaternion).add(at);
  flash.position.copy(tmp);
  flash.intensity = 1.2;
  flashSprite.position.copy(tmp);
  flashSprite.material.opacity = 1;
  scene.updateMatrixWorld();
  photos.take(cameraItem, renderView);
  sound.play('camera/eject', { at, delay: 0.25 });
  sound.play('camera/develop', { at, delay: 1.6, volume: 0.6 });
  robot.express('happy', 2, now());
  story.event('photo');
}

// Blitzen er der hele tiden (med styrke 0), så lysene ikke skifter antal og shaderne skal bygges om.
const flash = new THREE.PointLight(0xffffff, 0, 3);
stage.add(flash);
const flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
}));
flashSprite.scale.setScalar(0.5);
flashSprite.raycast = () => {};
stage.add(flashSprite);

stampMarks.onStamp = (hit) => {
  const at = hit.point.clone();
  stage.worldToLocal(at);
  sound.play('stamp/stamp', { at });
  let owner = hit.object;
  while (owner && owner !== stage && owner !== robot.group) {
    const item = [...physics.items].find((it) => it.mesh === owner);
    if (item) {
      owner = item;
      break;
    }
    owner = owner.parent;
  }
  if (owner === robot.group) {
    robot.hit(now());
    sound.play('robot/hit', { at: robot.headPosition(tmp) });
    story.event('stamp-robot');
  } else if (owner?.kind === 'paper' && !owner.data.approved) {
    owner.data.approved = true;
    confetti.burst(at.clone(), 40, 1.4);
    sound.play('stamp/approved', { at, delay: 0.15 });
    robot.express('love', 1.5, now());
    story.event('contract');
  }
};

// --- Lyde fra fysikken og tingene ---

// Lyden afhænger af tingen og det, den rammer. Uden et bedre match bruges væggens eller bordets lyd.
const IMPACTS = {
  disk: { table: 'impact/disk-table', floor: 'impact/disk-floor' },
  block: { table: 'impact/block-table', floor: 'impact/block-floor' },
  blaster: { table: 'impact/blaster-table', floor: 'impact/blaster-floor' },
  coffee: { table: 'impact/mug-table', floor: 'impact/mug-floor' },
  camera: { table: 'impact/plastic', floor: 'impact/plastic' },
  headset: { table: 'impact/plastic', floor: 'impact/plastic' },
  stamp: { table: 'impact/block-table', floor: 'impact/block-floor' },
  paper: { table: 'impact/paper', floor: 'impact/paper' },
  photo: { table: 'impact/paper', floor: 'impact/paper' },
  plane: { table: 'impact/paper', floor: 'impact/paper', wall: 'impact/paper', window: 'impact/paper' },
  ball: { table: 'impact/paper', floor: 'impact/paper', bin: 'impact/paper' },
};
const SURFACES = {
  wall: 'impact/wall', window: 'impact/glass', glass: 'impact/glass', ceiling: 'impact/ceiling', item: 'impact/soft-thud',
  painting: 'impact/wall', neon: 'impact/glass', lamp: 'impact/soft-thud', vase: 'impact/soft-thud', bin: 'paper/bin-rim',
};
physics.onImpact = (item, surface, speed, other) => {
  if (item.kind === 'plane' && speed > 0.25) item.data.flying = false;
  if (speed < 0.35 || item.frozen) return;
  if (props.hit(surface, speed, item.mesh.position, now()) && surface !== 'painting' && surface !== 'neon') return;
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
projectiles.onImpact = (shot, surface) => {
  sound.play('blaster/shot-impact', { at: shot.mesh.position, volume: 0.35, gap: 0.08 });
  props.hit(surface, 3, shot.mesh.position, now());
};
butterflies.onLand = (pos, perch) => {
  sound.play('butterflies/land', { at: pos, volume: 0.7 });
  if (perch.hand) story.played(); // en sommerfugl på hånden tæller som at have prøvet den
};
butterflies.onTakeoff = (pos) => sound.play('butterflies/takeoff', { at: pos, volume: 0.6 });

// --- Det der sker hvert billede ---

const viewerPos = new THREE.Vector3();
const viewerLocal = new THREE.Vector3();
const headPos = new THREE.Vector3();
const tmp = new THREE.Vector3();
const tmpDir = new THREE.Vector3();

// Hvor sommerfuglene må lande: på gæstens hænder i VR og oven på ting, der ligger stille.
// I den flade visning er musen ikke en hånd, ellers satte de sig i luften ved markøren.
function butterflyPerches() {
  const perches = input.xrActive ? input.perches.map((p) => ({ ...p, hand: true })) : [];
  for (const item of physics.items) {
    if (item.heldBy || item.frozen) continue;
    const b = item.body;
    const sleeping = b.sleepState === CANNON.Body.SLEEPING;
    perches.push({
      id: 1000 + b.id,
      point: item.data.perchPoint ??= new THREE.Vector3(),
      speed: sleeping ? 0 : b.velocity.length(),
      still: sleeping ? 10 : item.still,
      hand: false,
    });
    if (b.aabbNeedsUpdate) b.updateAABB();
    item.data.perchPoint.set(b.position.x, b.aabb.upperBound.y + 0.004, b.position.z);
  }
  return perches;
}

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

  // Konfettikanonen holdes med grebknappen og skyder med aftrækkeren (med musen: højreklik eller mellemrum).
  // Gribes den med aftrækkeren eller med håndsporing (knib), skyder den af sig selv.
  for (const holder of input.holders) {
    const item = holder.held;
    if (item.kind === 'blaster') {
      item.data.cooldown -= dt;
      const firing = holder.heldButton === 'select' || holder.using;
      if (firing && item.data.cooldown <= 0) {
        item.data.cooldown = 0.3;
        tmp.copy(BLASTER_MUZZLE).applyQuaternion(item.mesh.quaternion).add(item.mesh.position);
        tmpDir.set(0, 0, -1).applyQuaternion(item.mesh.quaternion).multiplyScalar(11).add(holder.velocity);
        projectiles.fire(tmp, tmpDir);
        sound.play('blaster/shot', { at: tmp, volume: 0.6 });
        holder.inputSource?.gamepad?.hapticActuators?.[0]?.pulse?.(0.4, 40); // et lille ryk i hånden
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
  updateToys(time, dt);
  if (butterflies.list.length) butterflies.update(time, dt, butterflyPerches(), input.perches);
  confetti.update(dt);
  updateSounds(time, dt, diskNear);
}

// Kameraet, stemplet, papirflyene og skraldespanden.
let selfieUntil = 0;
const lensPos = new THREE.Vector3();
const lensDir = new THREE.Vector3();
const shutterPos = new THREE.Vector3();
function updateToys(time, dt) {
  if (photoQueued) developQueuedPhoto();
  flash.intensity = Math.max(0, flash.intensity - dt * 8);
  flashSprite.material.opacity = Math.max(0, flashSprite.material.opacity - dt * 6);

  for (const cam of physics.items) {
    if (cam.kind !== 'camera') continue;
    const q = cam.mesh.quaternion;
    // Udløserknappen kan trykkes med den anden hånds pegefinger.
    shutterPos.copy(SHUTTER).applyQuaternion(q).add(cam.mesh.position);
    const pressed = input.perches.some((p) => p.point.distanceTo(shutterPos) < 0.025);
    if (pressed && cam.heldBy && !cam.data.pressed) takePhoto(cam);
    cam.data.pressed = pressed;
    cam.data.button.position.y = SHUTTER.y - (pressed || cam.data.cooldown > time + 0.9 ? 0.003 : 0);
    if (!cam.heldBy) continue;

    // Vendes kameraet mod gæsten, flyver robotten med på billedet. Peges det på robotten, smiler den.
    lensPos.copy(LENS).applyQuaternion(q).add(cam.mesh.position);
    lensDir.set(0, 0, -1).applyQuaternion(q);
    tmp.subVectors(viewerLocal, lensPos);
    const toViewer = tmp.length();
    if (toViewer < 1.1 && lensDir.dot(tmp.normalize()) > 0.75 && story.phase === 'play' && !robot.trip) {
      // Lidt bag gæsten og til siden i billedet (gæstens højre side), så begge er med.
      tmpDir.set(-1, 0, 0).applyQuaternion(q).setY(0).normalize();
      tmp.copy(lensPos).addScaledVector(lensDir, toViewer + 0.2).addScaledVector(tmpDir, 0.3);
      tmp.y = THREE.MathUtils.clamp(tmp.y, 0.9, 1.8);
      robot.follow(tmp, lensPos);
      if (time > selfieUntil) robot.express('happy', 1.5, time);
      selfieUntil = time + 1.2;
    } else if (lensDir.dot(tmp.subVectors(robot.headPosition(headPos), lensPos).normalize()) > 0.95) {
      robot.express('happy', 0.5, time);
    }
  }
  if (time > selfieUntil) robot.follow(null);
  photos.update(dt);

  // Stemplet sætter aftryk på bordet, på tingene og på robotten.
  const stamps = [...physics.items].filter((item) => item.kind === 'stamp' && !item.frozen);
  if (stamps.length) {
    const surfaces = [desk.top, robot.head];
    for (const item of physics.items) if (item.kind !== 'stamp') surfaces.push(item.mesh);
    for (const stamp of stamps) stampMarks.update(stamp, surfaces);
  }

  for (const item of physics.items) if (item.kind === 'plane') updatePlane(item, dt);

  // Papirkugler i skraldespanden giver point. Kuglen forsvinder, og maskinen printer en ny.
  bin.update(dt);
  for (const item of physics.items) {
    if (item.kind !== 'ball' || item.heldBy || item.data.scored || !bin.inside(item)) continue;
    item.data.scored = true;
    bin.addPoint();
    confetti.burst(bin.rimPosition, 50, 1.6);
    sound.play('paper/bin-score', { at: bin.rimPosition });
    robot.express('happy', 1.5, time);
    story.event(bin.score >= BALLS ? 'bin-five' : 'bin');
    later(1.5, () => {
      if (physics.items.has(item)) {
        confetti.burst(item.mesh.position.clone(), 12, 0.8);
        physics.remove(item);
      }
      // Spanden flytter, så næste kast bliver et nyt skud.
      if (bin.score < BALLS) {
        bin.moveTo();
        sound.play('fx/sparkle', { at: bin.rimPosition, volume: 0.6 });
      }
      printed = printed.filter((p) => p !== item);
      if (printed.filter((p) => p.kind === 'ball').length < BALLS) {
        desk.startPrint();
        sound.play('desk/print', { at: PAD, delay: 0.3 });
        printBall(1);
      }
    });
  }
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
// På Quest starter et tryk hvor som helst på startskærmen oplevelsen, så en ny gæst ikke skal ramme knappen.
overlay.addEventListener('click', (e) => {
  if (isQuest && vrSupported && !e.target.closest('button')) startVR();
});
// Quest-browseren må selv starte VR igen uden et tryk, når den giver lov (WebXR-navigation).
navigator.xr?.addEventListener('sessiongranted', () => {
  if (!renderer.xr.isPresenting) startVR();
});

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

let starting = false;
async function startVR() {
  if (starting || renderer.xr.isPresenting) return;
  starting = true;
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
  starting = false;
}

// Tager gæsten headsettet af, bliver sessionen skjult (hidden). Har den været skjult i mindst
// RESET_AFTER_HIDDEN sekunder, starter oplevelsen forfra med sprogvalget, lige når den næste gæst
// tager headsettet på. Systemmenuen (visible-blurred) tæller ikke.
// Headsettet kan også gå i dvale, og så bliver selve siden skjult.
let hiddenSince = null;
function headsetOff() {
  hiddenSince ??= performance.now();
}
function headsetOn() {
  if (hiddenSince && renderer.xr.isPresenting && performance.now() - hiddenSince >= RESET_AFTER_HIDDEN * 1000) {
    sound.play('ui/reset', { volume: 0.6 });
    story.reset();
    alignFrames = 0;
  }
  hiddenSince = null;
}
document.addEventListener('visibilitychange', () => (document.hidden ? headsetOff() : headsetOn()));
renderer.xr.addEventListener('sessionstart', () => {
  overlay.classList.add('hidden');
  story.reset();
  alignFrames = 0;
  hiddenSince = null;
  const session = renderer.xr.getSession();
  session.addEventListener('visibilitychange', () => (session.visibilityState === 'hidden' ? headsetOff() : headsetOn()));
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
  avatar.update(viewer);
  input.update(time, dt);
  projectiles.sweep(dt);
  physics.step(dt);
  robot.voiceLevel = sound.voiceLevel();
  robot.update(time, dt, viewerLocal);
  updatePlay(time, dt);
  props.update(time, dt, viewer, viewerLocal);
  story.update(time, dt);
  sound.update(viewer);
}

// Til fejlfinding i browserens konsol. advance(sek) spoler tiden frem uden at tegne.
window.lounge = {
  story, physics, input, robot, targets, butterflies, desk, languageButtons, guide, reveal, world, scene, camera, printItem, dispenseDisk, startInsert, renderer, sound,
  props, photos, bin, takePhoto, allTopics, projectiles,
  advance(seconds) {
    for (let t = 0; t < seconds; t += 1 / 60) {
      clock.elapsedTime += 1 / 60;
      simulate(clock.elapsedTime, 1 / 60);
    }
  },
};
