import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { sfx, unlockAudio, setMuted, isMuted } from './audio.js';
import { neonTexture, crackedGlassTexture } from './textures.js';
import { TYPES, MATS, drawScreen, crackScreen, rand, pick } from './objects.js';
import { buildCar, buildBus } from './vehicles.js';
import { LEVELS, SHELLS, UNLOCK_AT, BUS_X, BUS_Z } from './levels.js';

// ---------------------------------------------------------------------------
// Renderer, scene, camera
// ---------------------------------------------------------------------------
const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
// Phones get a lower starting resolution and no MSAA on very dense screens;
// adaptResolution() then tunes the resolution to keep the frame rate up.
const MAX_PIXEL_RATIO = Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2);
const MIN_PIXEL_RATIO = isTouch ? 0.75 : 1;
const renderer = new THREE.WebGLRenderer({
  antialias: !(isTouch && window.devicePixelRatio > 1.5),
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(MAX_PIXEL_RATIO);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0a0f);
scene.fog = new THREE.Fog(0x0c0a0f, 10, 26);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.4;

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 45);
camera.rotation.order = 'YXZ';
const EYE = 1.6;
const player = { x: 0, z: 2.6, vx: 0, vz: 0, bob: 0, floor: 0 }; // floor: height stood on (bus floor, door step)
camera.position.set(player.x, EYE, player.z);
scene.add(camera);

// Input moves the target angles; the camera eases toward them each frame.
const look = { yaw: 0, pitch: -0.18, targetYaw: 0, targetPitch: -0.18 };

function turnView(dYaw, dPitch) {
  look.targetYaw += dYaw;
  look.targetPitch = THREE.MathUtils.clamp(look.targetPitch + dPitch, -0.85, 0.35);
}

let pixelRatio = MAX_PIXEL_RATIO;
let pixelRatioCeiling = MAX_PIXEL_RATIO;
const framePerf = { frames: 0, time: 0 };
function adaptResolution(rawDt) {
  if (rawDt > 0.25) return; // tab was hidden; ignore
  framePerf.frames++;
  framePerf.time += rawDt;
  if (framePerf.time < 2) return;
  const avg = framePerf.time / framePerf.frames;
  framePerf.frames = 0;
  framePerf.time = 0;
  let next = pixelRatio;
  if (avg > 1 / 45) {
    next = Math.max(MIN_PIXEL_RATIO, pixelRatio - 0.25);
    pixelRatioCeiling = next; // don't climb back to a resolution that was too slow
  } else if (avg < 1 / 57) {
    next = Math.min(pixelRatioCeiling, pixelRatio + 0.25);
  }
  if (next !== pixelRatio) {
    pixelRatio = next;
    renderer.setPixelRatio(next);
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Zoom scales the field of view: below 1 zooms in, above 1 zooms out.
const ZOOM_MIN = 0.4, ZOOM_MAX = 1.25;
const zoomState = { current: 1, target: 1 };
function zoomBy(factor) {
  zoomState.target = THREE.MathUtils.clamp(zoomState.target * factor, ZOOM_MIN, ZOOM_MAX);
}
function applyFov() {
  camera.fov = (camera.aspect < 1 ? 82 : 65) * zoomState.current; // wider view in portrait phones
  camera.updateProjectionMatrix();
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  applyFov();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);
onResize();

// ---------------------------------------------------------------------------
// Lights
// ---------------------------------------------------------------------------
// Few lights on purpose: each one adds work to every pixel on screen.
scene.add(new THREE.HemisphereLight(0x8890b0, 0x201814, 0.85));

const spot = new THREE.SpotLight(0xfff1dc, 60, 12, Math.PI / 4.2, 0.45, 1.6);
spot.position.set(0.4, 4.2, 1.4);
spot.target.position.set(0, 0.6, -0.9);
spot.castShadow = true;
spot.shadow.mapSize.set(isTouch ? 512 : 1024, isTouch ? 512 : 1024);
spot.shadow.bias = -0.0004;
scene.add(spot, spot.target);

// Garage light (no shadows, to stay quick on phones)
const garageSpot = new THREE.SpotLight(0xfff1dc, 140, 18, Math.PI / 3, 0.5, 1.4);
garageSpot.position.set(9.5, 4.6, 1.2);
garageSpot.target.position.set(9.5, 0, 0.4);
scene.add(garageSpot, garageSpot.target);

// Light inside the bus (its roof blocks the garage light)
const busLight = new THREE.PointLight(0xfff2d8, 3, 8, 1.5);
busLight.position.set(9.5, 2.2, -1.6);
scene.add(busLight);

const neonLight = new THREE.PointLight(0xff2d6f, 6, 6, 1.5);
neonLight.position.set(0, 2.4, -2.4);
scene.add(neonLight);

// Re-used flash light for impacts (kept in the scene to avoid shader recompiles).
const flash = new THREE.PointLight(0xffd29a, 0, 3, 2);
scene.add(flash);

// ---------------------------------------------------------------------------
// Physics
// ---------------------------------------------------------------------------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.NaiveBroadphase();
world.allowSleep = true;
world.defaultContactMaterial.friction = 0.45;
world.defaultContactMaterial.restitution = 0.15;
world.solver.iterations = 7;

const staticMeshes = [];

function staticBox(w, h, d, x, y, z, material, { visible = true, rotY = 0, parent = scene } = {}) {
  let mesh = null;
  if (visible) {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    staticMeshes.push(mesh);
  }
  const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)) });
  body.position.set(x, y, z);
  body.quaternion.setFromEuler(0, rotY, 0);
  world.addBody(body);
  body.mesh = mesh;
  return body;
}

// ---------------------------------------------------------------------------
// The rooms. Each level's shell is built once and shown only while it is played.
// ---------------------------------------------------------------------------
const neons = [];
function neonSign(text, x, y, z, parent) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.6),
    new THREE.MeshBasicMaterial({ map: neonTexture(text), transparent: true, toneMapped: false }),
  );
  m.position.set(x, y, z);
  parent.add(m);
  neons.push(m);
}

const shellGroups = {};
for (const [key, shell] of Object.entries(SHELLS)) {
  const group = new THREE.Group();
  for (const [w, h, d, x, y, z, mat] of shell.boxes) staticBox(w, h, d, x, y, z, mat, { parent: group });
  for (const [w, d, x, y, z, mat] of shell.ceilings) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    c.rotation.x = Math.PI / 2; // facing down
    c.position.set(x, y, z);
    group.add(c);
  }
  for (const [text, x, y, z] of shell.neons) neonSign(text, x, y, z, group);
  scene.add(group);
  shellGroups[key] = group;
}

let level = LEVELS[0];
let ROOM = level.room;

// Furniture stays put until it is smashed. Then it collapses into pieces and
// everything standing on it falls. kind: 'wood' (default), 'metal' or 'glass'.
const furniture = [];

function buildFurniture() {
  for (const f of furniture) if (!f.broken) removeFurniturePieces(f);
  furniture.length = 0;
  for (const def of level.furniture()) {
    const f = { def, hp: def.hp, broken: false, pieces: [], obstacle: { ...def.obstacle } };
    for (const [w, h, d, x, y, z, mat, rotY = 0] of def.boxes) {
      const body = staticBox(w, h, d, x, y, z, mat, { rotY });
      body.mesh.userData.furniture = f;
      f.pieces.push({ body, mesh: body.mesh, size: [w, h, d], pos: [x, y, z] });
    }
    obstacles.push(f.obstacle);
    furniture.push(f);
  }
}

function removeFurniturePieces(f) {
  for (const p of f.pieces) {
    scene.remove(p.mesh);
    world.removeBody(p.body);
    const i = staticMeshes.indexOf(p.mesh);
    if (i >= 0) staticMeshes.splice(i, 1);
  }
  const oi = obstacles.indexOf(f.obstacle);
  if (oi >= 0) obstacles.splice(oi, 1);
}

// Things standing on a piece of furniture hop when it is hit.
function joltFurniture(f, strength) {
  const o = f.obstacle;
  const r = Math.max(o.w, o.d) / 2 + 0.3;
  for (const e of entities) {
    const p = e.body.position;
    if (e.held || Math.hypot(p.x - o.x, p.z - o.z) > r) continue;
    e.body.wakeUp();
    e.body.velocity.set(e.body.velocity.x + rand(-0.4, 0.4), e.body.velocity.y + rand(0.6, 1.2) * strength,
      e.body.velocity.z + rand(-0.4, 0.4));
  }
}

function hitFurniture(f, hit, dir, weapon) {
  const kind = f.def.kind || 'wood';
  if (kind === 'glass') { collapseFurniture(f, dir); return; } // any hit shatters glass
  if (weapon === 'knife' && f.def.soft) {
    f.hp -= 1;
    addCut(hit, rand(0.12, 0.24));
    sfx.rip();
    spillStuffing('foam', hit.point, 0.6);
    haptic('hit');
    if (f.hp <= 0) collapseFurniture(f, dir);
    return;
  }
  if (weapon === 'knife') {
    // A knife only carves wood and scratches metal
    addCut(hit, rand(0.1, 0.2), kind === 'metal' ? scratchMat : cutMat);
    sfx.scrape();
    haptic('hit');
    return;
  }
  const dmg = WEAPONS[weapon].damage;
  f.hp -= dmg;
  joltFurniture(f, dmg * 0.6);
  if (f.hp <= 0) { collapseFurniture(f, dir); return; }
  if (kind === 'metal') {
    addCut(hit, rand(0.1, 0.2), scratchMat);
    burst(hit.point, 0xffd08a, 18, 2.5, true);
    sfx.metal(weapon === 'fists' ? 0.6 : 1);
  } else {
    addCut(hit, rand(0.15, 0.3)); // a crack in the wood
    burst(hit.point, 0xb08a60, 25, 1.8, false);
    if (weapon === 'fists') sfx.punch(); else sfx.wood();
  }
  shake = Math.max(shake, 0.035);
  haptic('hit');
}

function collapseFurniture(f, dir) {
  f.broken = true;
  removeFurniturePieces(f);
  if (f.def.soft) {
    const [x, y, z] = f.pieces[1].pos;
    spillStuffing('foam', new THREE.Vector3(x, y, z), 2);
    sfx.rip();
  }
  const kind = f.def.kind || 'wood';
  if (kind === 'glass') {
    // A pane bursts into flat shards
    for (const p of f.pieces) {
      const [w, h, d] = p.size;
      const [x, y, z] = p.pos;
      const n = THREE.MathUtils.clamp(Math.round(Math.max(w * h, h * d) * 10), 8, 26);
      for (let i = 0; i < n; i++) {
        const b = rand(0.06, 0.16);
        const pos = new THREE.Vector3(x + rand(-0.5, 0.5) * w, y + rand(-0.5, 0.5) * h, z + rand(-0.5, 0.5) * d);
        const vel = dir.clone().multiplyScalar(rand(1.5, 4)).add(new THREE.Vector3(rand(-1, 1), rand(0, 2), rand(-1, 1)));
        addShard(pick(shardGeos), p.mesh.material, pos, new THREE.Vector3(b, b * rand(0.1, 0.25), b * rand(0.6, 1.3)), vel);
      }
      burst(new THREE.Vector3(x, y, z), 0xe6f4ff, 60, 3, true);
    }
    for (const e of entities) e.body.wakeUp();
    countSmash();
    sfx.glass(1.3);
    shake = Math.max(shake, 0.05);
    haptic('heavy');
    return;
  }
  for (const p of f.pieces) {
    const [w, h, d] = p.size;
    const [x, y, z] = p.pos;
    const n = THREE.MathUtils.clamp(Math.round((w * d + w * h + h * d) * 6), 2, 10);
    for (let i = 0; i < n; i++) {
      const scale = new THREE.Vector3(
        Math.min(w, rand(0.2, 0.55)),
        Math.min(h, Math.max(rand(0.03, 0.06), h * rand(0.3, 0.6))),
        Math.min(d, rand(0.06, 0.16)),
      );
      const pos = new THREE.Vector3(x + rand(-0.4, 0.4) * w, y + rand(-0.4, 0.4) * h, z + rand(-0.4, 0.4) * d);
      const vel = dir.clone().multiplyScalar(rand(1, 3)).add(new THREE.Vector3(rand(-1.5, 1.5), rand(0.5, 2.5), rand(-1.5, 1.5)));
      addShard(boxChunk, p.mesh.material, pos, scale, vel);
    }
    burst(new THREE.Vector3(x, y, z), kind === 'metal' ? 0x9a9a9a : 0xb08a60, 30, 2, false);
  }
  // Everything that was resting on it is now in free fall
  for (const e of entities) e.body.wakeUp();
  countSmash();
  if (kind === 'metal') sfx.metal(1.2); else sfx.wood();
  sfx.thud();
  shake = Math.max(shake, 0.07);
  haptic('heavy');
}

// Footprints of the furniture, so the player walks around it instead of through it.
const PLAYER_R = 0.28;
const obstacles = []; // furniture and vehicles add theirs

// The player's body pushes bottles and shards around when walking into them.
const playerBody = new CANNON.Body({ type: CANNON.Body.KINEMATIC, shape: new CANNON.Box(new CANNON.Vec3(PLAYER_R, 0.85, PLAYER_R)) });
playerBody.isPlayer = true;
playerBody.position.set(player.x, 0.85, player.z);
world.addBody(playerBody);

function resolvePlayer() {
  player.x = THREE.MathUtils.clamp(player.x, ROOM.minX + PLAYER_R, ROOM.maxX - PLAYER_R);
  player.z = THREE.MathUtils.clamp(player.z, ROOM.minZ + PLAYER_R, ROOM.maxZ - PLAYER_R);
  for (const o of obstacles) {
    const c = Math.cos(o.rot), sn = Math.sin(o.rot);
    const dx = player.x - o.x, dz = player.z - o.z;
    let lx = c * dx - sn * dz, lz = sn * dx + c * dz; // into the box's own axes
    const hw = o.w / 2, hd = o.d / 2;
    const qx = THREE.MathUtils.clamp(lx, -hw, hw), qz = THREE.MathUtils.clamp(lz, -hd, hd);
    const ex = lx - qx, ez = lz - qz;
    const dist = Math.hypot(ex, ez);
    if (dist >= PLAYER_R) continue;
    if (dist > 1e-6) {
      lx = qx + (ex / dist) * PLAYER_R;
      lz = qz + (ez / dist) * PLAYER_R;
    } else {
      // Centre is inside the box: push out along the shallowest side
      const px = hw - Math.abs(lx), pz = hd - Math.abs(lz);
      if (px < pz) lx = Math.sign(lx || 1) * (hw + PLAYER_R);
      else lz = Math.sign(lz || 1) * (hd + PLAYER_R);
    }
    player.x = o.x + c * lx + sn * lz;
    player.z = o.z - sn * lx + c * lz;
  }
}

// ---------------------------------------------------------------------------
// Smashable objects
// ---------------------------------------------------------------------------
const entities = [];
const shards = [];
const pendingBreaks = new Set();
const MAX_SHARDS = 160;
let smashed = 0;

function countSmash() {
  smashed++;
  updateHud();
}

function spawn(typeName, x, baseY, z, rotY = Math.random() * Math.PI * 2, tilt = 0) {
  const type = TYPES[typeName];
  const ent = { typeName, type, hp: type.hp, alive: true, held: false, armedAt: performance.now() + 1500 };
  const mesh = type.build(ent);
  mesh.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.ent = ent; }
  });
  const body = type.body ? type.body() : new CANNON.Body({ mass: type.mass, shape: type.shape() });
  body.ent = ent;
  body.position.set(x, baseY + type.h / 2 + 0.003, z);
  body.quaternion.setFromEuler(tilt, rotY, 0, 'YXZ');
  body.sleepSpeedLimit = 0.25; // settle quickly so resting things cost nothing
  body.sleepTimeLimit = 0.4;
  body.linearDamping = 0.05;
  body.angularDamping = 0.1;
  body.addEventListener('collide', (e) => {
    if (!ent.alive || ent.held || performance.now() < ent.armedAt || e.body.isPlayer) return;
    const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
    const limit = e.body.isShard ? type.breakVel * 2.2 : type.breakVel;
    if (v > limit) pendingBreaks.add(ent);
    else if (v > 1.6 && !['tv', 'soft', 'rubber'].includes(type.kind)) sfx.clink(v / 4);
  });
  ent.mesh = mesh;
  ent.body = body;
  scene.add(mesh);
  world.addBody(body);
  body.interpolatedPosition.copy(body.position);
  body.interpolatedQuaternion.copy(body.quaternion);
  syncEnt(ent);
  entities.push(ent);
  return ent;
}

// Meshes follow the physics engine's interpolated pose, so motion stays
// smooth on 90/120 Hz screens where frames fall between physics steps.
function syncEnt(e, interpolate = true) {
  e.mesh.position.copy(interpolate ? e.body.interpolatedPosition : e.body.position);
  e.mesh.quaternion.copy(interpolate ? e.body.interpolatedQuaternion : e.body.quaternion);
}

function removeEnt(ent) {
  ent.alive = false;
  if (held === ent) held = null;
  scene.remove(ent.mesh);
  world.removeBody(ent.body);
  const i = entities.indexOf(ent);
  if (i >= 0) entities.splice(i, 1);
}

function layoutLevel() {
  for (const [type, x, y, z, rotY, tilt] of level.items()) spawn(type, x, y, z, rotY ?? Math.random() * Math.PI * 2, tilt ?? 0);
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------
const VEHICLE_SPOTS = [
  { build: () => buildBus(), x: BUS_X, z: BUS_Z },
  { build: () => buildCar(0xc8102e), x: 9.0, z: 3.0 },
];
const vehicles = [];
const vehicleImpacts = [];
const crackedGlass = Array.from({ length: 3 }, () => new THREE.MeshStandardMaterial({
  map: crackedGlassTexture(), transparent: true, roughness: 0.1, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false,
}));

// Colliders and walking footprints never change, so they are made once.
for (const spotDef of VEHICLE_SPOTS) {
  const v = spotDef.build();
  spotDef.colliders = v.colliders.map((c) => {
    const body = staticBox(c.w, c.h, c.d, spotDef.x + c.x, c.y, spotDef.z + c.z, null, { visible: false });
    body.addEventListener('collide', (e) => {
      // Thrown objects can break windows and lights
      const other = e.body;
      if (!other.ent || other.ent.held) return;
      const speed = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (speed < 4.5) return;
      const c2 = e.contact;
      const p = c2.bi === body ? c2.bi.position.vadd(c2.ri) : c2.bj.position.vadd(c2.rj);
      vehicleImpacts.push({ spot: spotDef, point: new THREE.Vector3(p.x, p.y, p.z), speed });
    });
    return body;
  });
  if (v.interior) {
    // Walk-in vehicle: block only its walls (with the door gap) and remember its floor
    spotDef.interior = v.interior;
    for (const c of v.colliders) {
      if (c.h > 1.5) obstacles.push({ x: spotDef.x + c.x, z: spotDef.z + c.z, w: c.w, d: Math.max(c.d, 0.12), rot: 0 });
    }
  } else {
    obstacles.push({ x: spotDef.x, z: spotDef.z, w: v.footprint.w, d: v.footprint.d, rot: 0 });
  }
}

function buildVehicles() {
  for (const v of vehicles) { scene.remove(v.group); v.stopAlarm?.(); }
  vehicles.length = 0;
  if (!level.vehicles) return;
  for (const spotDef of VEHICLE_SPOTS) {
    const v = spotDef.build();
    v.group.position.set(spotDef.x, 0, spotDef.z);
    v.spot = spotDef;
    for (const part of v.parts) {
      part.vehicle = v;
      part.mesh.userData.part = part;
    }
    scene.add(v.group);
    spotDef.vehicle = v;
    vehicles.push(v);
  }
}

function hitVehiclePart(part, point, dir, weapon, hit) {
  const v = part.vehicle;
  if (!v.alerted) {
    v.alerted = true;
    if (v.kind === 'car') { v.stopAlarm = sfx.alarm(6); v.alarmUntil = performance.now() + 6000; }
    else sfx.honk();
  }
  const dmg = WEAPONS[weapon]?.damage ?? 2;
  switch (part.kind) {
    case 'window':
      part.hp -= dmg;
      if (part.hp <= 0) breakPart(part, dir);
      else {
        part.mesh.material = pick(crackedGlass);
        burst(point, 0xe6f4ff, 25, 2, true);
        sfx.crack();
        haptic('hit');
      }
      break;
    case 'light':
    case 'mirror':
      breakPart(part, dir);
      break;
    case 'tire':
      if (weapon === 'knife') punctureWheel(part.wheel, v, point, hit);
      else { sfx.thud(); haptic('hit'); }
      break;
    case 'panel':
      if (weapon === 'knife') {
        // A blade scratches the paint instead of denting it
        if (hit) addCut(hit, rand(0.15, 0.3), scratchMat);
        sfx.scrape();
        haptic('hit');
        break;
      }
      // Only finely divided panels can dent; small pillars just clang
      if (part.mesh.geometry.attributes.position.count > 100) dent(part.mesh, point, dir, weapon === 'fists' ? 0.06 : 0.13);
      burst(point, 0xffd08a, 14, 2.5, true);
      sfx.metal(weapon === 'fists' ? 0.6 : 1);
      shake = Math.max(shake, 0.03);
      haptic('hit');
      break;
    default:
      sfx.thud();
      haptic('hit');
  }
}

// A stabbed tyre hisses, goes flat, and the vehicle sags onto that corner.
function punctureWheel(wheel, v, point, hit) {
  if (wheel.punctured) { sfx.rip(); return; }
  if (hit) addCut(hit, 0.08);
  wheel.hp -= 1;
  if (wheel.hp > 0) { sfx.scrape(); haptic('hit'); return; } // not through the rubber yet
  wheel.punctured = true;
  countSmash();
  sfx.hiss();
  burst(point, 0x9a8f85, 25, 1.2, false);
  haptic('break');
  tween(1.4, (k) => {
    wheel.squash = 1 - 0.32 * k;
    wheel.group.scale.y = wheel.squash;
    updateVehicleTilt(v);
  });
}

function updateVehicleTilt(v) {
  let rz = 0, rx = 0, dy = 0;
  for (const w of v.wheels) {
    const d = w.r * (1 - (w.squash ?? 1));
    if (!d) continue;
    rz -= Math.sign(w.x) * d / (2 * Math.abs(w.x));
    rx += Math.sign(w.z) * d / (2 * Math.abs(w.z));
    dy += d / 4;
  }
  v.group.rotation.set(rx, 0, rz);
  v.group.position.y = -dy;
}

function breakPart(part, dir, power = 1) {
  if (part.broken) return;
  part.broken = true;
  const box = new THREE.Box3().setFromObject(part.mesh);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  part.mesh.parent.remove(part.mesh);
  countSmash();
  if (part.kind === 'mirror') {
    // The mirror snaps off and drops
    addShard(boxChunk, part.mesh.material, center, size, dir.clone().multiplyScalar(2).add(new THREE.Vector3(0, 1, 0)));
    sfx.metal(0.6);
  } else {
    const area = Math.max(size.x * size.y, size.y * size.z, size.x * size.z);
    const n = THREE.MathUtils.clamp(Math.round(area * 25), 6, 20);
    const mat = part.kind === 'light' ? part.mesh.material : MATS.glass;
    for (let i = 0; i < n; i++) {
      const pos = new THREE.Vector3(center.x + rand(-0.5, 0.5) * size.x, center.y + rand(-0.5, 0.5) * size.y, center.z + rand(-0.5, 0.5) * size.z);
      const vel = dir.clone().multiplyScalar(rand(1.5, 4) * power).add(new THREE.Vector3(rand(-1, 1), rand(0, 2), rand(-1, 1)));
      const b = rand(0.04, 0.12);
      addShard(pick(shardGeos), mat, pos, new THREE.Vector3(b, b * rand(0.1, 0.3), b * rand(0.6, 1.3)), vel);
    }
    burst(center, 0xe6f4ff, 40, 3, true);
    sfx.glass(power);
  }
  flashAt(center, 5);
  shake = Math.max(shake, 0.03);
  haptic('break');
}

// Push the bodywork in around the hit point.
const dentV = new THREE.Vector3();
function dent(mesh, point, dir, depth) {
  const pos = mesh.geometry.attributes.position;
  const local = mesh.worldToLocal(point.clone());
  const q = new THREE.Quaternion();
  mesh.getWorldQuaternion(q).invert();
  const ld = dir.clone().applyQuaternion(q);
  const R = 0.38;
  for (let i = 0; i < pos.count; i++) {
    dentV.fromBufferAttribute(pos, i);
    const d = dentV.distanceTo(local);
    if (d < R) {
      const f = 1 - d / R;
      dentV.addScaledVector(ld, depth * f * f);
      pos.setXYZ(i, dentV.x, dentV.y, dentV.z);
    }
  }
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingSphere();
  mesh.geometry.computeBoundingBox();
}

function processVehicleImpacts() {
  for (const imp of vehicleImpacts) {
    const v = imp.spot.vehicle;
    if (!v) continue;
    let best = null, bestD = 0.9;
    const c = new THREE.Vector3();
    for (const part of v.parts) {
      if (part.broken || !['window', 'light', 'mirror'].includes(part.kind)) continue;
      new THREE.Box3().setFromObject(part.mesh).getCenter(c);
      const d = c.distanceTo(imp.point);
      if (d < bestD) { bestD = d; best = part; }
    }
    if (best) hitVehiclePart(best, imp.point, new THREE.Vector3(0, -0.2, 0), imp.speed > 8 ? 'bat' : 'fists');
  }
  vehicleImpacts.length = 0;
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------
const save = loadSave();
const levelStats = { entities: 0, furniture: 0, parts: 0 };
let levelDone = 0; // fraction smashed
let completeShown = false;

function loadSave() {
  const fallback = { unlocked: 1, best: {} };
  try {
    const raw = window.localStorage.getItem('rageroom.progress');
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch (_) { return fallback; }
}
function storeSave() {
  try { window.localStorage.setItem('rageroom.progress', JSON.stringify(save)); } catch (_) { /* progress just isn't kept */ }
}

// Things in a vehicle that count toward the level: glass, lights, mirrors, tyres.
const countsForLevel = (part) => ['window', 'light', 'mirror'].includes(part.kind);

function loadLevel(index) {
  level = LEVELS[index];
  ROOM = level.room;
  if (held) dropHeld();
  for (const e of [...entities]) removeEnt(e);
  for (const s of shards) { scene.remove(s.mesh); world.removeBody(s.body); }
  shards.length = 0;
  pendingBreaks.clear();
  tweens.length = 0;
  for (const [key, group] of Object.entries(shellGroups)) group.visible = key === level.shell;
  setLevelLights(level.lights);
  buildFurniture();
  layoutLevel();
  buildVehicles();

  levelStats.entities = entities.length;
  levelStats.furniture = furniture.length;
  levelStats.parts = vehicles.reduce((n, v) => n + v.parts.filter(countsForLevel).length + v.wheels.length, 0);
  smashed = 0;
  levelDone = 0;
  completeShown = (save.best[index] ?? 0) >= 1;
  player.x = level.spawn.x; player.z = level.spawn.z; player.vx = player.vz = 0; player.floor = 0;
  look.yaw = look.targetYaw = level.spawn.yaw;
  look.pitch = look.targetPitch = -0.18;
  ui.levelName.textContent = `Level ${index + 1} · ${level.name}`;
  ui.cleared.hidden = true;
  ui.map.hidden = true;
  updateHud();
}

function levelProgress() {
  const total = levelStats.entities + levelStats.furniture + levelStats.parts;
  const entsLeft = entities.filter((e) => !e.punctured).length;
  let done = levelStats.entities - entsLeft + furniture.filter((f) => f.broken).length;
  for (const v of vehicles) done += v.parts.filter((p) => countsForLevel(p) && p.broken).length + v.wheels.filter((w) => w.punctured).length;
  return total ? Math.min(1, done / total) : 1;
}

function updateHud() {
  const pct = Math.round(levelDone * 100);
  ui.count.textContent = `${smashed} smashed · ${pct}%`;
  ui.barFill.style.width = `${pct}%`;
  ui.bar.classList.toggle('done', levelDone >= UNLOCK_AT);
}

function checkLevelProgress() {
  const index = LEVELS.indexOf(level);
  levelDone = levelProgress();
  updateHud();
  if (levelDone > (save.best[index] ?? 0)) { save.best[index] = levelDone; storeSave(); }
  if (levelDone >= UNLOCK_AT && save.unlocked < index + 2 && index + 1 < LEVELS.length) {
    save.unlocked = index + 2;
    storeSave();
    showComplete(`${LEVELS[index + 1].name} unlocked!`, `You smashed ${Math.round(levelDone * 100)}% of the ${level.name}.`);
  } else if (levelDone >= 1 && !completeShown) {
    completeShown = true;
    showComplete('Everything destroyed 😤', index + 1 < LEVELS.length ? 'Not a single thing left standing.' : 'You wrecked every level. Feeling better?');
  }
}

function showComplete(title, text) {
  const index = LEVELS.indexOf(level);
  document.exitPointerLock?.();
  ui.clearTitle.textContent = title;
  ui.clearText.textContent = text;
  ui.next.hidden = index + 1 >= LEVELS.length || save.unlocked < index + 2;
  ui.cleared.hidden = false;
}

function setLevelLights(l) {
  const [mx, my, mz, mtx, mty, mtz] = l.main;
  spot.position.set(mx, my, mz);
  spot.target.position.set(mtx, mty, mtz);
  const [fx, fy, fz, ftx, fty, ftz, fi] = l.fill;
  garageSpot.position.set(fx, fy, fz);
  garageSpot.target.position.set(ftx, fty, ftz);
  garageSpot.intensity = fi;
  neonLight.position.set(...l.neon);
  busLight.intensity = l.bus ? 3 : 0;
}

function openMap() {
  document.exitPointerLock?.();
  const current = LEVELS.indexOf(level);
  ui.mapList.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const locked = i + 1 > save.unlocked;
    const best = Math.round((save.best[i] ?? 0) * 100);
    const stop = document.createElement('button');
    stop.className = `stop${locked ? ' locked' : ''}${i === current ? ' here' : ''}`;
    stop.disabled = locked;
    stop.innerHTML = `<span class="dot">${locked ? '🔒' : i + 1}</span><span class="info"><b>${lv.name}</b><small>${locked ? `Smash ${Math.round(UNLOCK_AT * 100)}% of ${LEVELS[i - 1].name} to open` : lv.blurb}</small></span><span class="best">${locked ? '' : `${best}%`}</span>`;
    stop.addEventListener('click', () => loadLevel(i));
    ui.mapList.appendChild(stop);
  });
  ui.cleared.hidden = true;
  ui.map.hidden = false;
}

function resetRoom() {
  loadLevel(LEVELS.indexOf(level));
}

// ---------------------------------------------------------------------------
// Shattering
// ---------------------------------------------------------------------------
const shardGeos = Array.from({ length: 6 }, () => {
  const g = new THREE.TetrahedronGeometry(1, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * rand(0.6, 1.3), p.getY(i) * rand(0.6, 1.3), p.getZ(i) * rand(0.6, 1.3));
  g.computeVertexNormals();
  return g;
});
const boxChunk = new THREE.BoxGeometry(1, 1, 1);

function addShard(geo, mat, pos, scale, vel) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.copy(scale);
  scene.add(mesh); // shards don't cast shadows: dozens of tiny casters are costly
  const body = new CANNON.Body({
    mass: Math.max(0.01, scale.x * scale.y * scale.z * 40),
    shape: new CANNON.Box(new CANNON.Vec3(scale.x * 0.55, scale.y * 0.55, scale.z * 0.55)),
  });
  body.isShard = true;
  body.position.set(pos.x, pos.y, pos.z);
  body.quaternion.setFromEuler(rand(0, 6), rand(0, 6), rand(0, 6));
  body.velocity.set(vel.x, vel.y, vel.z);
  body.angularVelocity.set(rand(-15, 15), rand(-15, 15), rand(-15, 15));
  body.linearDamping = 0.1;
  body.sleepSpeedLimit = 0.35;
  body.sleepTimeLimit = 0.3;
  body.interpolatedPosition.copy(body.position);
  body.interpolatedQuaternion.copy(body.quaternion);
  world.addBody(body);
  mesh.position.copy(body.position);
  mesh.quaternion.copy(body.quaternion);
  shards.push({ mesh, body });
  trimShards();
  return mesh;
}

function trimShards() {
  while (shards.length > MAX_SHARDS) {
    const old = shards.shift();
    scene.remove(old.mesh);
    world.removeBody(old.body);
  }
}

const tmpV = new THREE.Vector3();

function shatter(ent, dir = new THREE.Vector3(0, 0, -1), power = 1) {
  if (!ent.alive) return;
  const box = new THREE.Box3().setFromObject(ent.mesh);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const type = ent.type;

  // Collect the materials the object is made from, so shards match it.
  const mats = [];
  ent.mesh.traverse((o) => {
    if (o.isMesh && o.material !== ent.screen?.material && o.material !== cutMat && o.material !== scratchMat) mats.push(o.material);
  });
  removeEnt(ent);
  countSmash();

  const n = type.shards;
  const glassy = type.kind === 'glass';
  for (let i = 0; i < n; i++) {
    const pos = new THREE.Vector3(
      center.x + rand(-0.5, 0.5) * size.x,
      center.y + rand(-0.5, 0.5) * size.y,
      center.z + rand(-0.5, 0.5) * size.z,
    );
    const out = tmpV.copy(pos).sub(center).normalize();
    const vel = dir.clone().multiplyScalar(rand(1.5, 4.5) * power)
      .addScaledVector(out, rand(0.8, 2.8))
      .add(new THREE.Vector3(0, rand(0.5, 2.5), 0));
    let geo, mat, s;
    if (type.kind === 'tv' && i % 3 !== 0) {
      geo = boxChunk;
      mat = i % 5 === 0 ? MATS.board : pick(mats);
      s = new THREE.Vector3(rand(0.06, 0.16), rand(0.02, 0.1), rand(0.05, 0.14));
    } else if (type.kind === 'soft') {
      // Torn rags of fabric
      geo = boxChunk;
      mat = pick(mats);
      const base = Math.max(size.x, size.z) * rand(0.15, 0.3);
      s = new THREE.Vector3(base, 0.012, base * rand(0.5, 1));
    } else if (type.kind === 'wood') {
      // Splintered planks
      geo = boxChunk;
      mat = pick(mats);
      s = new THREE.Vector3(rand(0.03, 0.07), rand(0.02, 0.04), rand(0.15, 0.4));
    } else {
      geo = pick(shardGeos);
      mat = type.kind === 'tv' ? MATS.glass : pick(mats);
      const base = Math.max(size.x, size.y, size.z) * rand(0.1, 0.22);
      s = new THREE.Vector3(base, base * (glassy ? rand(0.12, 0.35) : rand(0.4, 0.9)), base * rand(0.6, 1.3));
    }
    addShard(geo, mat, pos, s, vel);
  }

  // Effects + sound
  const big = type.kind === 'tv' && type.mass > 5;
  if (type.kind === 'glass') { burst(center, 0xe6f4ff, 40, 3, true); sfx.glass(power); }
  else if (type.kind === 'ceramic') { burst(center, 0xd8cfc0, 30, 2, false); sfx.ceramic(power); }
  else if (type.kind === 'wood') { burst(center, 0xb08a60, 30, 2, false); sfx.wood(); }
  else if (type.kind === 'soft') { spillStuffing(type.stuffing, center, 3); sfx.rip(); haptic('break'); return; }
  else { burst(center, 0xffa040, 70, 5, true); burst(center, 0x777777, 40, 2, false); sfx.explode(); }
  flashAt(center, big ? 14 : 5);
  shake = Math.max(shake, big ? 0.07 : 0.025);
  if (big) slowMo = 0.55;
  haptic(big ? 'heavy' : 'break');
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------
const bursts = [];
function burst(origin, color, count, speed, additive, opts = {}) {
  const pos = new Float32Array(count * 3);
  const vel = [];
  for (let i = 0; i < count; i++) {
    pos.set([origin.x, origin.y, origin.z], i * 3);
    vel.push(new THREE.Vector3(rand(-1, 1), rand(-0.2, 1.2), rand(-1, 1)).normalize().multiplyScalar(rand(0.3, 1) * speed));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color, size: opts.size ?? (additive ? 0.025 : 0.035), transparent: true, opacity: 1, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  bursts.push({
    pts, vel, life: 0, max: opts.life ?? (additive ? 0.7 : 1.1), gravity: opts.gravity ?? (additive ? 6 : 1.5),
    drag: opts.drag ?? 1.5, flutter: opts.flutter ?? 0,
  });
}

function updateBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.life += dt;
    const p = b.pts.geometry.attributes.position;
    for (let j = 0; j < b.vel.length; j++) {
      const v = b.vel[j];
      v.y -= b.gravity * dt;
      v.multiplyScalar(Math.max(0, 1 - dt * b.drag));
      if (b.flutter) v.x += Math.sin(b.life * 5 + j) * b.flutter * dt;
      p.setXYZ(j, p.getX(j) + v.x * dt, p.getY(j) + v.y * dt, p.getZ(j) + v.z * dt);
    }
    p.needsUpdate = true;
    b.pts.material.opacity = 1 - b.life / b.max;
    if (b.life >= b.max) {
      scene.remove(b.pts);
      b.pts.geometry.dispose();
      b.pts.material.dispose();
      bursts.splice(i, 1);
    }
  }
}

// Feathers drift down slowly; foam falls in yellow lumps.
function spillStuffing(kind, point, amount = 1) {
  if (kind === 'feathers') {
    burst(point, 0xffffff, Math.round(45 * amount), 2, false, { gravity: 0.35, life: 3.5, size: 0.035, drag: 2.5, flutter: 1.5 });
  } else {
    burst(point, 0xf2dc8a, Math.round(25 * amount), 1.6, false, { gravity: 3, life: 1.6, size: 0.045 });
    for (let i = 0; i < Math.round(3 * amount); i++) {
      const b = rand(0.04, 0.1);
      const lump = addShard(boxChunk, MATS.foam, point, new THREE.Vector3(b, b * rand(0.6, 1), b * rand(0.7, 1.2)),
        new THREE.Vector3(rand(-1.5, 1.5), rand(0.5, 2.5), rand(-1.5, 1.5)));
      lump.userData.noHit = true; // stabs go through loose foam to the thing underneath
    }
  }
}

// Cut marks stay on whatever was slashed and move with it.
const cutMat = new THREE.MeshBasicMaterial({ color: 0x140b08 });
const scratchMat = new THREE.MeshBasicMaterial({ color: 0xd8dde2 });
const UP = new THREE.Vector3(0, 1, 0);
function addCut(hit, len, mat = cutMat) {
  if (!hit.face) return;
  const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  const m = new THREE.Mesh(boxChunk, mat);
  m.scale.set(len, 0.004, 0.012);
  m.position.copy(hit.point).addScaledVector(n, 0.002);
  m.quaternion.setFromUnitVectors(UP, n);
  m.rotateY(rand(0, Math.PI));
  m.userData = { ...hit.object.userData };
  hit.object.attach(m);
}

// Small animations (tyres going flat)
const tweens = [];
function tween(dur, fn) { tweens.push({ t: 0, dur, fn }); }
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t = Math.min(tw.t + dt, tw.dur);
    tw.fn(easeOut(tw.t / tw.dur));
    if (tw.t >= tw.dur) tweens.splice(i, 1);
  }
}

function flashAt(p, intensity) {
  flash.position.copy(p).add(new THREE.Vector3(0, 0.2, 0.2));
  flash.intensity = intensity;
}

// ---------------------------------------------------------------------------
// Weapons: bat, fists, knife, and bare hands for grabbing
// ---------------------------------------------------------------------------
const WEAPONS = {
  bat: { reach: 2.0, damage: 2, push: 1 },
  fists: { reach: 1.4, damage: 1, push: 0.45 },
  knife: { reach: 1.5, damage: 1, push: 0.15 },
  grab: { reach: 1.8, damage: 0, push: 0 },
};

// Soft things and tyres shrug off blunt hits; only a blade gets through.
function damageFor(weapon, kind) {
  if (kind === 'soft' || kind === 'rubber') return weapon === 'knife' ? 1 : 0;
  return WEAPONS[weapon].damage;
}
const MAX_LIFT = 15; // kg
let mode = 'bat';

// Bat
const bat = new THREE.Group();
{
  const wood = new THREE.MeshStandardMaterial({ color: 0xc08a58, roughness: 0.45 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 16), wood);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.28, 12), grip);
  handle.position.y = 0.15;
  const taper = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.017, 0.26, 16), wood);
  taper.position.y = 0.42;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.034, 0.26, 16), wood);
  barrel.position.y = 0.68;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), wood);
  cap.position.y = 0.81;
  bat.add(knob, handle, taper, barrel, cap);
}
const batPivot = new THREE.Group();
batPivot.add(bat);
camera.add(batPivot);

// Hands
const skin = new THREE.MeshStandardMaterial({ color: 0xb87a52, roughness: 0.65 });
const sleeve = new THREE.MeshStandardMaterial({ color: 0x23232b, roughness: 0.85 });
function makeHand(side, parent = camera) {
  const g = new THREE.Group();
  const fist = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 12), skin);
  fist.scale.set(1, 0.85, 1.25);
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.03, 4, 8), skin);
  thumb.rotation.z = Math.PI / 2;
  thumb.position.set(-side * 0.03, -0.015, -0.035);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.034, 0.3, 12), sleeve);
  arm.rotation.x = Math.PI / 2;
  arm.position.z = 0.19;
  g.add(fist, thumb, arm);
  g.traverse((o) => { o.castShadow = false; });
  parent.add(g);
  return g;
}
const hands = { l: makeHand(-1), r: makeHand(1) };
const HAND_REST = { l: new THREE.Vector3(-0.2, -0.27, -0.42), r: new THREE.Vector3(0.2, -0.27, -0.42) };
const HAND_HOLD = { l: new THREE.Vector3(-0.17, -0.2, -0.46), r: new THREE.Vector3(0.17, -0.2, -0.46) };
const HAND_LOW = { l: new THREE.Vector3(-0.24, -0.36, -0.4), r: new THREE.Vector3(0.24, -0.36, -0.4) };

// Knife held in the right hand
const knifePivot = new THREE.Group();
const knifeModel = new THREE.Group();
{
  const steel = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.18 });
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.6 });
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.028, 0);
  shape.quadraticCurveTo(0.03, 0.12, 0, 0.19); // curved edge up to the point
  shape.lineTo(0, 0);
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.003, bevelEnabled: false }), steel);
  blade.position.set(-0.014, 0.055, -0.0015);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.012), steel);
  guard.position.y = 0.052;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.11, 12), handleMat);
  knifeModel.add(blade, guard, handle);
  knifeModel.rotation.x = -1.25;
  knifePivot.add(knifeModel);
  makeHand(1, knifePivot);
  knifePivot.visible = false;
  camera.add(knifePivot);
}
const KNIFE_REST = new THREE.Vector3(0.15, -0.25, -0.45);
knifePivot.position.copy(KNIFE_REST);
const stab = { active: false, t: 0, hitDone: false, ndc: new THREE.Vector2(), target: new THREE.Vector3(), queued: null };
const STAB = { out: 0.08, end: 0.28, next: 0.18 };

function startStab(ndc) {
  if (stab.active && stab.t < STAB.next) { stab.queued = ndc.clone(); return; }
  stab.queued = null;
  stab.active = true;
  stab.t = 0;
  stab.hitDone = false;
  stab.ndc.copy(ndc);
  stab.target.set(ndc.x * 0.22 + 0.04, -0.14 + ndc.y * 0.15, -0.66);
  sfx.whoosh();
}

function updateKnife(dt) {
  if (mode !== 'knife') return;
  if (!stab.active) {
    knifePivot.position.lerp(KNIFE_REST, 1 - Math.pow(0.0001, dt));
    knifeModel.rotation.x = -1.25;
    return;
  }
  stab.t += dt;
  const t = stab.t;
  if (t < STAB.out) {
    knifePivot.position.lerpVectors(KNIFE_REST, stab.target, easeOut(t / STAB.out));
    knifeModel.rotation.x = -1.25 - 0.3 * (t / STAB.out);
  } else if (t < STAB.end) {
    const k = easeInOut((t - STAB.out) / (STAB.end - STAB.out));
    knifePivot.position.lerpVectors(stab.target, KNIFE_REST, k);
    knifeModel.rotation.x = -1.55 + 0.3 * k;
  } else stab.active = false;
  if (!stab.hitDone && t >= STAB.out) { stab.hitDone = true; doHit(stab.ndc, 'knife'); }
  if (stab.queued && t >= STAB.next) startStab(stab.queued);
}

function setMode(m) {
  if (m === mode) return;
  if (held && m !== 'grab') dropHeld();
  mode = m;
  swing.active = false; swing.queued = null;
  punch.active = false; punch.queued = null;
  stab.active = false; stab.queued = null;
  batPivot.visible = m === 'bat';
  knifePivot.visible = m === 'knife';
  hands.l.visible = hands.r.visible = m === 'fists' || m === 'grab';
  for (const b of document.querySelectorAll('#modes button')) b.classList.toggle('on', b.dataset.mode === m);
}

// --- Bat swing ---
const POSE_REST = { p: new THREE.Vector3(0.36, -0.52, -0.6), r: new THREE.Euler(-0.5, 0, -0.05) };
const POSE_WIND = { p: new THREE.Vector3(0.4, -0.32, -0.5), r: new THREE.Euler(0.25, 0, -0.35) };
const strikePose = { p: new THREE.Vector3(), r: new THREE.Euler() };

const swing = { active: false, t: 0, hitDone: false, ndc: new THREE.Vector2(), queued: null };
const SWING = { wind: 0.07, strike: 0.16, hit: 0.13, end: 0.42 };

function lerpPose(a, b, t) {
  batPivot.position.lerpVectors(a.p, b.p, t);
  batPivot.rotation.set(
    THREE.MathUtils.lerp(a.r.x, b.r.x, t),
    THREE.MathUtils.lerp(a.r.y, b.r.y, t),
    THREE.MathUtils.lerp(a.r.z, b.r.z, t),
  );
}

function startSwing(ndc) {
  if (swing.active && swing.t < 0.24) { swing.queued = ndc.clone(); return; }
  swing.queued = null;
  swing.active = true;
  swing.t = 0;
  swing.hitDone = false;
  swing.ndc.copy(ndc);
  strikePose.p.set(0.05 + ndc.x * 0.3, -0.32 + ndc.y * 0.2, -0.6);
  strikePose.r.set(-1.55 + ndc.y * 0.3, 0, 0.95 + ndc.x * 0.4);
  sfx.whoosh();
}

function updateSwing(dt) {
  if (!swing.active) { lerpPose(POSE_REST, POSE_REST, 0); return; }
  swing.t += dt;
  const t = swing.t;
  if (t < SWING.wind) lerpPose(POSE_REST, POSE_WIND, easeOut(t / SWING.wind));
  else if (t < SWING.strike) lerpPose(POSE_WIND, strikePose, easeIn((t - SWING.wind) / (SWING.strike - SWING.wind)));
  else if (t < SWING.end) lerpPose(strikePose, POSE_REST, easeInOut((t - SWING.strike) / (SWING.end - SWING.strike)));
  else { swing.active = false; lerpPose(POSE_REST, POSE_REST, 0); }
  if (!swing.hitDone && t >= SWING.hit) { swing.hitDone = true; doHit(swing.ndc, 'bat'); }
  if (swing.queued && t >= 0.24) startSwing(swing.queued);
}
const easeIn = (t) => t * t;
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// --- Punches: left and right jab in turn ---
const punch = { active: false, t: 0, side: 'r', hitDone: false, ndc: new THREE.Vector2(), target: new THREE.Vector3(), queued: null };
const PUNCH = { out: 0.07, end: 0.26, next: 0.16 };

function startPunch(ndc) {
  if (punch.active && punch.t < PUNCH.next) { punch.queued = ndc.clone(); return; }
  punch.queued = null;
  punch.side = punch.side === 'r' ? 'l' : 'r';
  punch.active = true;
  punch.t = 0;
  punch.hitDone = false;
  punch.ndc.copy(ndc);
  punch.target.set(ndc.x * 0.25 + (punch.side === 'r' ? 0.05 : -0.05), -0.13 + ndc.y * 0.15, -0.62);
  noiseWhoosh();
}
const noiseWhoosh = () => sfx.whoosh();

function updateHands(dt) {
  if (mode !== 'fists' && mode !== 'grab') return;
  const rest = mode === 'grab' ? (held ? HAND_HOLD : HAND_LOW) : HAND_REST;
  for (const s of ['l', 'r']) hands[s].position.lerp(rest[s], 1 - Math.pow(0.0001, dt));
  if (mode === 'fists' && punch.active) {
    punch.t += dt;
    const h = hands[punch.side];
    const t = punch.t;
    if (t < PUNCH.out) h.position.lerpVectors(HAND_REST[punch.side], punch.target, easeOut(t / PUNCH.out));
    else if (t < PUNCH.end) h.position.lerpVectors(punch.target, HAND_REST[punch.side], easeInOut((t - PUNCH.out) / (PUNCH.end - PUNCH.out)));
    else punch.active = false;
    if (!punch.hitDone && t >= PUNCH.out) { punch.hitDone = true; doHit(punch.ndc, 'fists'); }
    if (punch.queued && t >= PUNCH.next) startPunch(punch.queued);
  }
}

// --- Grab, carry and throw ---
let held = null;

function pickTarget(ndc) {
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObjects(hitTargets(), true)[0] || null;
}

// Reach is measured along the ground: you can bend down to things near your feet.
function outOfReach(hit, reach) {
  return Math.hypot(hit.point.x - player.x, hit.point.z - player.z) > reach || hit.distance > reach + 1.4;
}

function tryGrab(ndc) {
  const hit = pickTarget(ndc);
  if (!hit) return;
  if (outOfReach(hit, WEAPONS.grab.reach)) { toast('Walk closer to grab'); return; }
  const ent = hit.object.userData.ent;
  if (hit.object.userData.part) { toast('Way too heavy to lift'); return; }
  if (hit.object.userData.furniture) { toast('Too heavy to lift — smash it instead'); return; }
  if (!ent || !ent.alive) return;
  if (ent.type.mass > MAX_LIFT) { toast('Too heavy to lift'); return; }
  held = ent;
  ent.held = true;
  const box = new THREE.Box3().setFromObject(ent.mesh);
  ent.holdDist = 0.45 + box.getSize(new THREE.Vector3()).length() * 0.5;
  const b = ent.body;
  b.type = CANNON.Body.KINEMATIC;
  b.collisionResponse = false;
  b.velocity.setZero();
  b.angularVelocity.setZero();
  b.wakeUp();
  sfx.clink(1);
  toast('Tap to throw');
}

function releaseHeld(vel) {
  const ent = held;
  if (!ent) return;
  held = null;
  ent.held = false;
  ent.armedAt = performance.now() + 60;
  const b = ent.body;
  b.type = CANNON.Body.DYNAMIC;
  b.collisionResponse = true;
  b.updateMassProperties();
  b.velocity.set(vel.x, vel.y, vel.z);
  b.angularVelocity.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
  b.wakeUp();
}

function throwHeld(ndc) {
  raycaster.setFromCamera(ndc, camera);
  const dir = raycaster.ray.direction.clone();
  const speed = THREE.MathUtils.clamp(14 - held.type.mass * 0.6, 6, 13);
  releaseHeld(dir.multiplyScalar(speed).add(new THREE.Vector3(0, 1.2, 0)));
  sfx.whoosh();
}

function dropHeld() {
  releaseHeld(new THREE.Vector3(player.vx, 0, player.vz));
}

const holdPos = new THREE.Vector3();
const camDir = new THREE.Vector3();
function updateHeld() {
  if (!held) return;
  camera.getWorldDirection(camDir);
  holdPos.copy(camera.position).addScaledVector(camDir, held.holdDist).add(new THREE.Vector3(0, -0.18, 0));
  held.body.position.set(holdPos.x, holdPos.y, holdPos.z);
  held.body.quaternion.setFromEuler(0, look.yaw, 0);
  held.body.velocity.setZero();
}

// --- What a hit does ---
const raycaster = new THREE.Raycaster();
function hitTargets() {
  const t = [...entities.filter((e) => !e.held).map((e) => e.mesh), ...shards.filter((s) => !s.mesh.userData.noHit).map((s) => s.mesh), ...staticMeshes];
  for (const v of vehicles) t.push(v.group);
  return t;
}

function doHit(ndc, weapon) {
  const w = WEAPONS[weapon];
  const hit = pickTarget(ndc);
  if (!hit) return;
  if (outOfReach(hit, w.reach)) {
    toast('Too far — walk closer');
    return;
  }
  const dir = raycaster.ray.direction.clone();
  dir.y = Math.max(dir.y, -0.1);
  dir.normalize();

  const part = hit.object.userData.part;
  if (part) { hitVehiclePart(part, hit.point, raycaster.ray.direction.clone(), weapon, hit); return; }

  const ent = hit.object.userData.ent;
  if (ent && ent.alive) {
    const body = ent.body;
    body.wakeUp();
    const rel = new CANNON.Vec3(hit.point.x - body.position.x, hit.point.y - body.position.y, hit.point.z - body.position.z);
    const kind = ent.type.kind;
    if (kind === 'soft' || kind === 'rubber') { hitSoft(ent, hit, dir, weapon, rel); return; }
    ent.hp -= w.damage;
    // Tough objects only get nudged, so they stay in reach for the next hit.
    const strength = (ent.hp > 0 ? Math.min(body.mass * 0.6, 8) : Math.min(body.mass * 5, 30)) * w.push;
    body.applyImpulse(new CANNON.Vec3(dir.x * strength, (dir.y + 0.3) * strength, dir.z * strength), rel);
    if (ent.hp <= 0) {
      shatter(ent, dir, weapon === 'bat' ? 1.2 : 0.8);
    } else {
      // Damaged but still in one piece
      if (ent.screen) {
        const uv = hit.object.material === ent.screen.material && hit.uv ? hit.uv : { x: rand(0.2, 0.8), y: rand(0.2, 0.8) };
        crackScreen(ent.screen, uv.x, uv.y);
        sfx.crack();
        burst(hit.point, 0xffb347, 35, 4, true);
      } else if (ent.type.kind === 'wood') {
        sfx.wood();
        burst(hit.point, 0xb08a60, 15, 1.5, false);
      } else {
        sfx.crack();
        burst(hit.point, 0xffb347, 20, 3, true);
      }
      flashAt(hit.point, 4);
      shake = Math.max(shake, 0.03);
      haptic('hit');
    }
    return;
  }

  const shard = shards.find((s) => s.mesh === hit.object);
  if (shard) {
    shard.body.wakeUp();
    shard.body.velocity.set(dir.x * 6 * w.push + dir.x, 3, dir.z * 6 * w.push + dir.z);
    sfx.clink(1);
    return;
  }

  const f = hit.object.userData.furniture;
  if (f && !f.broken) { hitFurniture(f, hit, dir, weapon); return; }

  // Wall / floor
  burst(hit.point, 0x9a8f85, 20, 1.5, false);
  if (weapon === 'fists') sfx.punch(); else sfx.thud();
  shake = Math.max(shake, 0.02);
  haptic('hit');
}

function hitSoft(ent, hit, dir, weapon, rel) {
  const body = ent.body;
  const dmg = damageFor(weapon, ent.type.kind);
  if (dmg === 0) {
    // Blunt hits just knock soft things about
    const st = Math.min(body.mass * 3, 14) * WEAPONS[weapon].push;
    body.applyImpulse(new CANNON.Vec3(dir.x * st, (dir.y + 0.4) * st, dir.z * st), rel);
    if (ent.type.stuffing === 'feathers') spillStuffing('feathers', hit.point, 0.2);
    if (ent.type.kind === 'rubber') sfx.thud(); else sfx.softThump();
    haptic('hit');
    return;
  }
  if (ent.punctured) { sfx.rip(); return; }
  ent.hp -= dmg;
  addCut(hit, ent.type.kind === 'rubber' ? 0.08 : rand(0.12, 0.24));
  haptic('hit');
  if (ent.type.kind === 'rubber') {
    if (ent.hp > 0) { sfx.scrape(); return; } // not through the rubber yet
    // Spare tyre: hiss and go flat
    ent.punctured = true;
    countSmash();
    sfx.hiss();
    burst(hit.point, 0x9a8f85, 20, 1.2, false);
    const torus = ent.mesh.children[0];
    tween(1.4, (k) => torus.scale.set(1 + 0.08 * k, 1 + 0.08 * k, 1 - 0.55 * k));
    return;
  }
  sfx.rip();
  spillStuffing(ent.type.stuffing, hit.point, 1);
  if (ent.hp <= 0) shatter(ent, dir, 0.5);
}

function act(ndc) {
  unlockAudio();
  ui.hint.classList.add('gone');
  if (mode === 'bat') startSwing(ndc);
  else if (mode === 'fists') startPunch(ndc);
  else if (mode === 'knife') startStab(ndc);
  else if (held) throwHeld(ndc);
  else tryGrab(ndc);
}

function haptic(kind) {
  try {
    if (window.RageRoom && window.RageRoom.postMessage) window.RageRoom.postMessage(kind);
    else if (navigator.vibrate) navigator.vibrate(kind === 'heavy' ? 60 : kind === 'break' ? 25 : 12);
  } catch (_) { /* haptics are optional */ }
}

// ---------------------------------------------------------------------------
// Input: tap to act, drag to look, joystick or WASD to walk
// ---------------------------------------------------------------------------
const canvas = renderer.domElement;
const drag = { id: null, x: 0, y: 0, sx: 0, sy: 0, moved: false };

// On a computer, clicking locks the mouse for proper first-person aiming:
// moving the mouse turns, clicking hits whatever is under the crosshair.
const mouseLocked = () => document.pointerLockElement === canvas;
const CENTER = new THREE.Vector2(0, 0);
document.addEventListener('pointerlockchange', () => {
  document.body.classList.toggle('locked', mouseLocked());
});
document.addEventListener('pointerlockerror', () => { /* not allowed here: drag-to-look still works */ });
document.addEventListener('mousemove', (e) => {
  // Some browsers report one huge jump right after locking; ignore spikes
  if (!mouseLocked() || Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
  const k = 0.0022 * zoomState.current; // finer aim when zoomed in
  turnView(-e.movementX * k, -e.movementY * k);
});

// Two fingers on the screen pinch to zoom.
const touches = new Map();
let pinchDist = 0;
const touchSpread = () => {
  const [a, b] = [...touches.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
};

canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (mouseLocked()) { act(CENTER); return; }
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) {
      pinchDist = touchSpread();
      drag.id = null; // a pinch is neither a look-drag nor a tap
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* optional */ }
      return;
    }
  }
  if (!isTouch && e.pointerType === 'mouse' && canvas.requestPointerLock) {
    try {
      const req = canvas.requestPointerLock();
      if (req && req.catch) req.catch(() => {});
    } catch (_) { /* fall back to drag-to-look */ }
  }
  if (drag.id !== null) return;
  drag.id = e.pointerId;
  drag.x = drag.sx = e.clientX;
  drag.y = drag.sy = e.clientY;
  drag.moved = false;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* refused while the mouse is being locked */ }
});
canvas.addEventListener('pointermove', (e) => {
  if (touches.has(e.pointerId)) {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size >= 2) {
      const dist = touchSpread();
      if (pinchDist > 0 && dist > 0) zoomBy(pinchDist / dist);
      pinchDist = dist;
      return;
    }
  }
  if (e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 10) drag.moved = true;
  if (drag.moved) {
    const k = (1.5 / Math.min(window.innerWidth, window.innerHeight)) * zoomState.current;
    turnView(-dx * k, -dy * k);
  }
  drag.x = e.clientX; drag.y = e.clientY;
});
const endPointer = (e) => {
  touches.delete(e.pointerId);
  if (touches.size < 2) pinchDist = 0;
  if (e.pointerId !== drag.id || mouseLocked()) { if (e.pointerId === drag.id) drag.id = null; return; }
  drag.id = null;
  if (!drag.moved && e.type === 'pointerup') {
    const r = canvas.getBoundingClientRect();
    act(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1));
  }
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

function showZoom() { toast(`Zoom ${(1 / zoomState.target).toFixed(1)}×`); }
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomBy(Math.exp(e.deltaY * 0.0012));
  showZoom();
}, { passive: false });
document.getElementById('zoom-in').addEventListener('click', () => { zoomBy(1 / 1.3); showZoom(); });
document.getElementById('zoom-out').addEventListener('click', () => { zoomBy(1.3); showZoom(); });

const keys = new Set();
const MODE_KEYS = { Digit1: 'bat', Digit2: 'fists', Digit3: 'knife', Digit4: 'grab' };
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Space') { e.preventDefault(); act(new THREE.Vector2(0, 0)); }
  if (e.code === 'KeyR') resetRoom();
  if (e.code === 'KeyM') { if (ui.map.hidden) openMap(); else ui.map.hidden = true; }
  if (e.code === 'Equal' || e.code === 'NumpadAdd') { zoomBy(1 / 1.2); showZoom(); }
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') { zoomBy(1.2); showZoom(); }
  if (MODE_KEYS[e.code]) setMode(MODE_KEYS[e.code]);
  if (e.code === 'KeyQ') setMode({ bat: 'fists', fists: 'knife', knife: 'grab', grab: 'bat' }[mode]);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

// On-screen joystick for phones
const joy = { id: null, x: 0, y: 0, el: document.getElementById('joy'), knob: document.getElementById('knob') };
function setJoy(e) {
  const r = joy.el.getBoundingClientRect();
  const max = r.width / 2;
  let x = e.clientX - (r.left + max), y = e.clientY - (r.top + max);
  const len = Math.hypot(x, y);
  if (len > max) { x *= max / len; y *= max / len; }
  joy.x = x / max; joy.y = y / max;
  joy.knob.style.transform = `translate(${x}px, ${y}px)`;
}
joy.el.addEventListener('pointerdown', (e) => {
  unlockAudio();
  joy.id = e.pointerId;
  joy.el.setPointerCapture(e.pointerId);
  setJoy(e);
  ui.hint.classList.add('gone');
});
joy.el.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) setJoy(e); });
const endJoy = (e) => {
  if (e.pointerId !== joy.id) return;
  joy.id = null; joy.x = 0; joy.y = 0;
  joy.knob.style.transform = '';
};
joy.el.addEventListener('pointerup', endJoy);
joy.el.addEventListener('pointercancel', endJoy);

for (const b of document.querySelectorAll('#modes button')) {
  b.addEventListener('click', () => { unlockAudio(); setMode(b.dataset.mode); });
}

if (isTouch) document.body.classList.add('touch');
if (new URLSearchParams(location.search).has('app')) document.body.classList.add('in-app');
document.getElementById('hint').textContent = isTouch
  ? 'Joystick to walk · Drag to look · Pinch to zoom · Tap to hit'
  : 'Click to lock the mouse · WASD to walk · Wheel to zoom · 1-4 to switch';

// Height of whatever the player stands on: a bus floor, its door step, or the ground.
function floorHeightAt(x, z) {
  for (const spotDef of VEHICLE_SPOTS) {
    const r = spotDef.interior;
    if (!r) continue;
    const lx = x - spotDef.x, lz = z - spotDef.z;
    if (lx > r.minX && lx < r.maxX && lz > r.minZ && lz < r.maxZ) return r.y;
    const st = r.step;
    if (Math.abs(lx - st.x) < st.w / 2 && lz >= st.minZ && lz < st.maxZ) return st.y;
  }
  return 0;
}

const WALK_SPEED = 2.6;
const JOY_DEAD = 0.15;
function updatePlayer(dt) {
  // Dead zone, then a gentle curve so small pushes give slow, precise steps
  let jx = joy.x, jy = joy.y;
  const jm = Math.hypot(jx, jy);
  if (jm < JOY_DEAD) { jx = 0; jy = 0; } else {
    const k = Math.pow((jm - JOY_DEAD) / (1 - JOY_DEAD), 1.5) / jm;
    jx *= k; jy *= k;
  }
  let fwd = -jy, side = jx;
  if (keys.has('KeyW') || keys.has('ArrowUp')) fwd += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) fwd -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) side -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) side += 1;
  const len = Math.hypot(fwd, side);
  if (len > 1) { fwd /= len; side /= len; }
  const sy = Math.sin(look.yaw), cy = Math.cos(look.yaw);
  const tx = (-sy * fwd + cy * side) * WALK_SPEED;
  const tz = (-cy * fwd - sy * side) * WALK_SPEED;
  const k = 1 - Math.pow(0.0001, dt); // quick ease in/out
  player.vx += (tx - player.vx) * k;
  player.vz += (tz - player.vz) * k;
  const ox = player.x, oz = player.z;
  player.x += player.vx * dt;
  player.z += player.vz * dt;
  resolvePlayer();
  const moved = Math.hypot(player.x - ox, player.z - oz);
  if (moved > 0.0005) player.bob += moved * 9;
  player.floor += (floorHeightAt(player.x, player.z) - player.floor) * (1 - Math.exp(-dt * 12));
  if (dt > 0) playerBody.velocity.set((player.x - ox) / dt, 0, (player.z - oz) / dt);
  playerBody.position.set(player.x, player.floor + 0.85, player.z);
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
const ui = {
  count: document.getElementById('count'),
  levelName: document.getElementById('level-name'),
  bar: document.getElementById('bar'),
  barFill: document.getElementById('bar-fill'),
  map: document.getElementById('map'),
  mapList: document.getElementById('map-list'),
  clearTitle: document.getElementById('clear-title'),
  clearText: document.getElementById('clear-text'),
  next: document.getElementById('next'),
  hint: document.getElementById('hint'),
  cleared: document.getElementById('cleared'),
  mute: document.getElementById('mute'),
  toast: document.getElementById('toast'),
};
document.getElementById('reset').addEventListener('click', resetRoom);
document.getElementById('refill').addEventListener('click', resetRoom);
document.getElementById('map-btn').addEventListener('click', openMap);
document.getElementById('map-close').addEventListener('click', () => { ui.map.hidden = true; });
document.getElementById('keep').addEventListener('click', () => { ui.cleared.hidden = true; });
document.getElementById('open-map').addEventListener('click', openMap);
ui.next.addEventListener('click', () => loadLevel(LEVELS.indexOf(level) + 1));
ui.mute.addEventListener('click', () => {
  setMuted(!isMuted());
  ui.mute.textContent = isMuted() ? '🔇' : '🔊';
});

let toastTimer = 0;
function toast(text) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1100);
}

let progressTick = 0;

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let shake = 0;
let slowMo = 0;
let screenTick = 0;
const clock = new THREE.Clock();

function frame() {
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);
  adaptResolution(rawDt);

  // Ease the view toward where the player is pointing it
  const ease = 1 - Math.exp(-dt * 30);
  look.yaw += (look.targetYaw - look.yaw) * ease;
  look.pitch += (look.targetPitch - look.pitch) * ease;
  if (Math.abs(zoomState.target - zoomState.current) > 0.0005) {
    zoomState.current += (zoomState.target - zoomState.current) * (1 - Math.exp(-dt * 14));
    applyFov();
  }

  updatePlayer(dt);
  slowMo = Math.max(0, slowMo - dt);
  const timeScale = slowMo > 0 ? 0.3 + 0.7 * (1 - slowMo / 0.55) ** 3 : 1;
  world.step(1 / 60, dt * timeScale, 2); // at most 2 catch-up steps, so a slow frame can't snowball

  for (const ent of pendingBreaks) {
    const v = ent.body.velocity;
    shatter(ent, new THREE.Vector3(v.x, v.y, v.z).normalize(), 0.4);
  }
  pendingBreaks.clear();
  processVehicleImpacts();

  for (const e of entities) {
    syncEnt(e);
    if (e.body.position.y < -2) removeEnt(e);
  }
  for (const s of shards) {
    if (s.body.sleepState === CANNON.Body.SLEEPING) continue;
    s.mesh.position.copy(s.body.interpolatedPosition);
    s.mesh.quaternion.copy(s.body.interpolatedQuaternion);
  }

  // Damaged screens flicker; alarmed cars flash their lights
  screenTick += dt;
  if (screenTick > 0.06) {
    screenTick = 0;
    for (const e of entities) if (e.screen && e.screen.damaged) drawScreen(e.screen);
  }
  const now = performance.now();
  for (const v of vehicles) {
    if (!v.alarmUntil) continue;
    const on = now < v.alarmUntil ? Math.floor(now / 250) % 2 === 0 : true;
    for (const l of v.lights) l.material.emissiveIntensity = on ? 1.4 : 0.05;
    if (now >= v.alarmUntil) v.alarmUntil = 0;
  }

  updateSwing(dt);
  updateHands(dt);
  updateKnife(dt);
  updateTweens(dt);
  updateBursts(dt * timeScale);
  flash.intensity *= Math.pow(0.002, dt);

  camera.rotation.set(look.pitch, look.yaw, 0);
  camera.position.set(player.x, player.floor + EYE + Math.sin(player.bob) * 0.012, player.z);
  if (shake > 0.0005) {
    camera.position.x += rand(-1, 1) * shake * 0.7;
    camera.position.y += rand(-1, 1) * shake * 0.7;
    shake *= Math.pow(0.0005, dt);
  }
  updateHeld();
  if (held) syncEnt(held, false);

  for (const n of neons) n.material.opacity = Math.random() < 0.015 ? 0.4 : 1;

  progressTick += dt;
  if (progressTick > 0.3) { progressTick = 0; checkLevelProgress(); }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

hands.l.visible = hands.r.visible = false;
loadLevel(0);
frame();
