import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { woodTexture, fabricTexture } from './textures.js';

// Every smashable object: its look, physics body, toughness and how it breaks.
// hp: the bat deals 2 damage per hit, fists and knife 1. Glass breaks in one
// hit; everything else takes several.

// Round things collide as boxes. Cylinders cost the physics engine many times
// more and made the game stutter on phones.
const roundShape = (rTop, rBottom, h) => {
  const r = Math.max(rTop, rBottom);
  return new CANNON.Box(new CANNON.Vec3(r, h / 2, r));
};

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const glassMat = (color = 0xd6ecff, opacity = 0.32) => new THREE.MeshStandardMaterial({
  color, transparent: true, opacity, roughness: 0.04, metalness: 0.1,
  envMapIntensity: 3, side: THREE.DoubleSide, depthWrite: false,
});
export const ceramicMat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.02 });

export const MATS = {
  glass: glassMat(),
  green: glassMat(0x2f8f45, 0.7),
  brown: glassMat(0x8a4d1a, 0.72),
  plate: ceramicMat(0xf4f0e8),
  plastic: new THREE.MeshStandardMaterial({ color: 0x2d2d31, roughness: 0.55 }),
  black: new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.35, metalness: 0.3 }),
  board: new THREE.MeshStandardMaterial({ color: 0x1f6b35, roughness: 0.6 }),
  wood: new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.7 }),
  darkWood: new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.8 }),
  terracotta: ceramicMat(0xb5562f),
  leaf: new THREE.MeshStandardMaterial({ color: 0x2e8b3a, roughness: 0.8, side: THREE.DoubleSide }),
  metal: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.3, metalness: 0.85 }),
  lightPlastic: new THREE.MeshStandardMaterial({ color: 0xd9d9d4, roughness: 0.5 }),
  paper: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
  mirror: new THREE.MeshStandardMaterial({ color: 0xe8eef4, roughness: 0.02, metalness: 1, envMapIntensity: 2 }),
  shade: new THREE.MeshStandardMaterial({ color: 0xfff0c8, emissive: 0xffb85a, emissiveIntensity: 0.9, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  bulb: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe2a8, emissiveIntensity: 2 }),
  pillow: new THREE.MeshStandardMaterial({ map: fabricTexture('#eceae4'), roughness: 0.95 }),
  mattress: new THREE.MeshStandardMaterial({ map: fabricTexture('#dfe6f0', true), roughness: 0.95 }),
  blanket: new THREE.MeshStandardMaterial({ map: fabricTexture('#2f4f8f'), roughness: 1 }),
  sofa: new THREE.MeshStandardMaterial({ map: fabricTexture('#2a7f7a'), roughness: 1 }),
  cushion: new THREE.MeshStandardMaterial({ map: fabricTexture('#d9a33b'), roughness: 1 }),
  fur: new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 1 }),
  furLight: new THREE.MeshStandardMaterial({ color: 0xd7b48a, roughness: 1 }),
  foam: new THREE.MeshStandardMaterial({ color: 0xf2dc8a, roughness: 1 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.9 }),
  metalDark: new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.7 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x8d949c, roughness: 0.35, metalness: 0.8 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.15, metalness: 1 }),
  enamel: new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.3, metalness: 0.1 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x6b6966, roughness: 0.4 }),
  cabinet: new THREE.MeshStandardMaterial({ color: 0x2f6f6a, roughness: 0.6 }),
  whiteboard: new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.25 }),
  seat: new THREE.MeshStandardMaterial({ map: fabricTexture('#34509e'), roughness: 1 }),
  waterGlass: glassMat(0x7fb8ff, 0.45),
  darkGlass: new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.1, metalness: 0.4 }),
};
const VASE_COLORS = [0x1d8a8a, 0xc8643b, 0x2a4fbf, 0xd9b44a, 0x9b2f6b];
const MUG_COLORS = [0xe24a3b, 0xf2c94c, 0x4a90e2, 0xffffff, 0x27ae60];

function lathe(profile, segments = 18, height) {
  const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
  geo.translate(0, -height / 2, 0);
  return geo;
}

const GEOS = {
  tumbler: lathe([[0, 0], [0.036, 0], [0.04, 0.006], [0.046, 0.12], [0.043, 0.12], [0.037, 0.01], [0, 0.01]], 18, 0.12),
  wine: lathe([[0, 0], [0.035, 0], [0.034, 0.006], [0.005, 0.012], [0.005, 0.1], [0.02, 0.11], [0.04, 0.15], [0.038, 0.21], [0.036, 0.21], [0.037, 0.15], [0, 0.12]], 18, 0.21),
  bottle: lathe([[0, 0], [0.038, 0], [0.039, 0.2], [0.03, 0.245], [0.014, 0.27], [0.013, 0.33], [0.016, 0.335], [0.01, 0.335], [0, 0.3]], 16, 0.335),
  vase: lathe([[0, 0], [0.07, 0], [0.105, 0.08], [0.11, 0.15], [0.07, 0.26], [0.045, 0.31], [0.06, 0.36], [0.052, 0.36], [0.035, 0.3], [0, 0.2]], 22, 0.36),
  plate: new THREE.CylinderGeometry(0.13, 0.095, 0.022, 26),
  mug: new THREE.CylinderGeometry(0.045, 0.042, 0.1, 18, 1, false),
  mugHandle: new THREE.TorusGeometry(0.028, 0.008, 8, 16, Math.PI),
};

/**
 * Each type: how to build the mesh, its physics body, how tough it is and
 * what it sounds like when it breaks.
 */
export const TYPES = {
  tumbler: { kind: 'glass', mass: 0.25, hp: 1, breakVel: 3, shards: 12, shape: () => roundShape(0.044, 0.04, 0.12), h: 0.12,
    build: () => new THREE.Mesh(GEOS.tumbler, MATS.glass) },
  wine: { kind: 'glass', mass: 0.2, hp: 1, breakVel: 2.6, shards: 12, shape: () => roundShape(0.038, 0.035, 0.21), h: 0.21,
    build: () => new THREE.Mesh(GEOS.wine, MATS.glass) },
  bottle: { kind: 'glass', mass: 0.5, hp: 1, breakVel: 3.6, shards: 14, shape: () => roundShape(0.03, 0.038, 0.335), h: 0.335,
    build: () => new THREE.Mesh(GEOS.bottle, Math.random() < 0.5 ? MATS.green : MATS.brown) },
  vase: { kind: 'ceramic', mass: 0.9, hp: 4, breakVel: 3.6, shards: 14, shape: () => roundShape(0.08, 0.09, 0.36), h: 0.36,
    build: () => new THREE.Mesh(GEOS.vase, ceramicMat(pick(VASE_COLORS))) },
  plate: { kind: 'ceramic', mass: 0.3, hp: 4, breakVel: 3.4, shards: 10, shape: () => roundShape(0.13, 0.095, 0.022), h: 0.022,
    build: () => new THREE.Mesh(GEOS.plate, MATS.plate) },
  mug: { kind: 'ceramic', mass: 0.35, hp: 4, breakVel: 3.8, shards: 10, shape: () => roundShape(0.045, 0.042, 0.1), h: 0.1,
    build: () => {
      const mat = ceramicMat(pick(MUG_COLORS));
      const g = new THREE.Group();
      g.add(new THREE.Mesh(GEOS.mug, mat));
      const handle = new THREE.Mesh(GEOS.mugHandle, mat);
      handle.rotation.z = -Math.PI / 2;
      handle.position.x = 0.044;
      g.add(handle);
      return g;
    } },
  tv: { kind: 'tv', mass: 14, hp: 12, breakVel: 4.5, shards: 22, shape: () => new CANNON.Box(new CANNON.Vec3(0.32, 0.26, 0.38)), h: 0.52,
    build: (ent) => {
      const g = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.52, 0.46), MATS.plastic);
      shell.position.z = 0.15;
      const tube = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.38, 0.3), MATS.plastic);
      tube.position.z = -0.23;
      ent.screen = makeScreen(256, 192, 'bars');
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.39), ent.screen.material);
      screen.position.set(-0.02, 0.01, 0.381);
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12), MATS.black);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(0.28, -0.12, 0.385);
      g.add(shell, tube, screen, knob);
      return g;
    } },
  monitor: { kind: 'tv', mass: 6, hp: 8, breakVel: 4.5, shards: 16, shape: null, h: 0.5,
    build: (ent) => {
      const g = new THREE.Group();
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.43, 0.04), MATS.black);
      panel.position.y = 0.08;
      ent.screen = makeScreen(256, 154, 'error');
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.39), ent.screen.material);
      screen.position.set(0, 0.08, 0.021);
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.03), MATS.black);
      neck.position.set(0, -0.17, -0.02);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 0.18), MATS.black);
      base.position.set(0, -0.24, 0);
      g.add(panel, screen, neck, base);
      return g;
    },
    body: () => {
      const b = new CANNON.Body({ mass: 6 });
      b.addShape(new CANNON.Box(new CANNON.Vec3(0.36, 0.215, 0.03)), new CANNON.Vec3(0, 0.08, 0));
      b.addShape(new CANNON.Box(new CANNON.Vec3(0.14, 0.04, 0.09)), new CANNON.Vec3(0, -0.21, 0));
      return b;
    } },
  // --- Workbench and room clutter -------------------------------------------
  lamp: { kind: 'glass', mass: 1.2, hp: 1, breakVel: 3.2, shards: 14, shape: () => roundShape(0.12, 0.08, 0.5), h: 0.5,
    build: () => {
      const g = new THREE.Group();
      const base = new THREE.Mesh(lathe([[0, 0], [0.08, 0], [0.08, 0.03], [0.03, 0.06], [0.015, 0.08], [0, 0.08]], 18, 0.08), ceramicMat(0x2b2b30));
      base.position.y = -0.21;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.26), MATS.metal);
      stem.position.y = -0.04;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), MATS.bulb);
      bulb.position.y = 0.1;
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.13, 0.18, 20, 1, true), MATS.shade);
      shade.position.y = 0.16;
      g.add(base, stem, bulb, shade);
      return g;
    } },
  jar: { kind: 'glass', mass: 0.5, hp: 1, breakVel: 3.2, shards: 12, shape: () => roundShape(0.06, 0.06, 0.21), h: 0.21,
    build: () => {
      const g = new THREE.Group();
      const jar = new THREE.Mesh(lathe([[0, 0], [0.055, 0], [0.06, 0.01], [0.06, 0.15], [0.045, 0.17], [0.045, 0.19], [0, 0.19]], 18, 0.19), MATS.glass);
      jar.position.y = -0.01;
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.025, 18), MATS.metal);
      lid.position.y = 0.0925;
      g.add(jar, lid);
      return g;
    } },
  teapot: { kind: 'ceramic', mass: 0.8, hp: 4, breakVel: 3.6, shards: 12, shape: () => roundShape(0.09, 0.09, 0.16), h: 0.16,
    build: () => {
      const mat = ceramicMat(pick([0xffffff, 0x3b6fb6, 0xe8d9b5]));
      const g = new THREE.Group();
      const pot = new THREE.Mesh(lathe([[0, 0], [0.06, 0], [0.09, 0.04], [0.095, 0.08], [0.07, 0.13], [0.03, 0.14], [0, 0.14]], 20, 0.14), mat);
      pot.position.y = -0.01;
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.015, 10, 6), mat);
      knob.position.y = 0.07;
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.018, 0.12, 10), mat);
      spout.position.set(0.11, 0.0, 0);
      spout.rotation.z = -0.9;
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 8, 16, Math.PI), mat);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(-0.09, -0.01, 0);
      g.add(pot, knob, spout, handle);
      return g;
    } },
  flowerpot: { kind: 'ceramic', mass: 2.5, hp: 4, breakVel: 3.8, shards: 14, h: 0.4,
    build: () => {
      const g = new THREE.Group();
      const pot = new THREE.Mesh(lathe([[0, 0], [0.07, 0], [0.1, 0.2], [0.11, 0.2], [0.11, 0.22], [0.095, 0.21], [0, 0.19]], 20, 0.22), MATS.terracotta);
      pot.position.y = -0.09;
      g.add(pot);
      for (let i = 0; i < 6; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.22, 6), MATS.leaf);
        const a = (i / 6) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 0.03, 0.1, Math.sin(a) * 0.03);
        leaf.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
        g.add(leaf);
      }
      return g;
    },
    body: () => {
      const b = new CANNON.Body({ mass: 2.5 });
      b.addShape(roundShape(0.11, 0.07, 0.22), new CANNON.Vec3(0, -0.09, 0));
      return b;
    } },
  laptop: { kind: 'tv', mass: 2, hp: 6, breakVel: 5, shards: 12, h: 0.02,
    build: (ent) => {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.24), MATS.lightPlastic);
      const keys = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.003, 0.12), MATS.black);
      keys.position.set(0, 0.011, -0.02);
      const hinge = new THREE.Group();
      hinge.position.set(0, 0.01, -0.12);
      hinge.rotation.x = -0.25;
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.012), MATS.lightPlastic);
      lid.position.y = 0.11;
      ent.screen = makeScreen(256, 160, 'code');
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.19), ent.screen.material);
      screen.position.set(0, 0.11, 0.0065);
      hinge.add(lid, screen);
      g.add(base, keys, hinge);
      return g;
    },
    body: () => {
      const b = new CANNON.Body({ mass: 2 });
      b.addShape(new CANNON.Box(new CANNON.Vec3(0.17, 0.01, 0.12)));
      const q = new CANNON.Quaternion();
      q.setFromEuler(-0.25, 0, 0);
      b.addShape(new CANNON.Box(new CANNON.Vec3(0.17, 0.11, 0.006)),
        new CANNON.Vec3(0, 0.01 + 0.11 * Math.cos(-0.25), -0.12 + 0.11 * Math.sin(-0.25)), q);
      return b;
    } },
  printer: { kind: 'tv', mass: 7, hp: 8, breakVel: 5, shards: 16, shape: () => new CANNON.Box(new CANNON.Vec3(0.23, 0.1, 0.18)), h: 0.2,
    build: () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.36), MATS.lightPlastic);
      const tray = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.2), MATS.plastic);
      tray.position.set(0, 0.105, -0.02);
      const paper = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.005, 0.12), MATS.paper);
      paper.position.set(0, 0.02, 0.22);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 0.005), MATS.bulb);
      led.position.set(0.18, 0.06, 0.181);
      g.add(body, tray, paper, led);
      return g;
    } },
  mirror: { kind: 'glass', mass: 9, hp: 1, breakVel: 2.5, shards: 26, shape: () => new CANNON.Box(new CANNON.Vec3(0.35, 0.75, 0.025)), h: 1.5,
    build: () => {
      const g = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.5, 0.05), MATS.darkWood);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.42), MATS.mirror);
      glass.position.z = 0.026;
      g.add(frame, glass);
      return g;
    } },
  chair: { kind: 'wood', mass: 4, hp: 8, breakVel: 6, shards: 12, h: 0.9,
    build: () => {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.42), MATS.wood);
      g.add(seat);
      for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.43, 0.04), MATS.darkWood);
        leg.position.set(x, -0.235, z);
        g.add(leg);
      }
      for (const x of [-0.18, 0.18]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.04), MATS.darkWood);
        post.position.set(x, 0.245, -0.18);
        g.add(post);
      }
      const rest = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.03), MATS.wood);
      rest.position.set(0, 0.38, -0.18);
      g.add(rest);
      return g;
    },
    body: () => {
      const b = new CANNON.Body({ mass: 4 });
      b.addShape(new CANNON.Box(new CANNON.Vec3(0.2, 0.215, 0.2)), new CANNON.Vec3(0, -0.235, 0));
      b.addShape(new CANNON.Box(new CANNON.Vec3(0.21, 0.02, 0.21)));
      b.addShape(new CANNON.Box(new CANNON.Vec3(0.21, 0.22, 0.02)), new CANNON.Vec3(0, 0.24, -0.18));
      return b;
    } },
  crate: { kind: 'wood', mass: 6, hp: 8, breakVel: 6.5, shards: 14, shape: () => new CANNON.Box(new CANNON.Vec3(0.25, 0.25, 0.25)), h: 0.5,
    build: () => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), MATS.wood));
      // dark slats across each side
      for (const [w, h, d] of [[0.52, 0.06, 0.52], [0.06, 0.52, 0.52], [0.52, 0.52, 0.06]]) {
        g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MATS.darkWood));
      }
      return g;
    } },
  // --- Soft things: only a knife can rip them ------------------------------
  // stuffing: what spills out when cut (feathers float, foam falls in lumps)
  pillow: { kind: 'soft', stuffing: 'feathers', mass: 0.6, hp: 4, breakVel: 99, shards: 6, shape: () => new CANNON.Box(new CANNON.Vec3(0.29, 0.065, 0.19)), h: 0.14,
    build: () => {
      const geo = new THREE.SphereGeometry(1, 28, 14);
      geo.scale(0.3, 0.07, 0.2);
      return new THREE.Mesh(geo, MATS.pillow);
    } },
  cushion: { kind: 'soft', stuffing: 'foam', mass: 1.5, hp: 4, breakVel: 99, shards: 6, shape: () => new CANNON.Box(new CANNON.Vec3(0.26, 0.07, 0.3)), h: 0.14,
    build: () => new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.14, 0.6, 4, 2, 4), MATS.cushion) },
  teddy: { kind: 'soft', stuffing: 'foam', mass: 0.5, hp: 4, breakVel: 99, shards: 6, shape: () => roundShape(0.12, 0.12, 0.42), h: 0.42,
    build: () => {
      const g = new THREE.Group();
      const ball = (r, mat, x, y, z, sy = 1) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
        m.scale.y = sy;
        m.position.set(x, y, z);
        g.add(m);
        return m;
      };
      ball(0.12, MATS.fur, 0, -0.06, 0, 1.15);            // body
      ball(0.075, MATS.furLight, 0, -0.06, 0.07, 1.2);    // belly
      ball(0.09, MATS.fur, 0, 0.12, 0);                   // head
      ball(0.035, MATS.fur, -0.07, 0.19, 0);              // ears
      ball(0.035, MATS.fur, 0.07, 0.19, 0);
      ball(0.04, MATS.furLight, 0, 0.1, 0.08);            // muzzle
      ball(0.012, MATS.black, -0.032, 0.14, 0.08);        // eyes
      ball(0.012, MATS.black, 0.032, 0.14, 0.08);
      ball(0.045, MATS.fur, -0.12, -0.02, 0.03, 1.4);     // arms
      ball(0.045, MATS.fur, 0.12, -0.02, 0.03, 1.4);
      ball(0.05, MATS.fur, -0.07, -0.17, 0.06);           // legs
      ball(0.05, MATS.fur, 0.07, -0.17, 0.06);
      return g;
    } },
  mattress: { kind: 'soft', stuffing: 'foam', mass: 25, hp: 10, breakVel: 99, shards: 14, shape: () => new CANNON.Box(new CANNON.Vec3(0.95, 0.11, 0.7)), h: 0.22,
    build: () => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 1.4, 8, 1, 6), MATS.mattress));
      const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 1.44), MATS.blanket);
      blanket.position.set(-0.45, 0.125, 0);
      g.add(blanket);
      return g;
    } },
  sofa: { kind: 'soft', stuffing: 'foam', mass: 40, hp: 16, breakVel: 99, shards: 16, h: 0.92,
    build: () => {
      const g = new THREE.Group();
      const part = (w, h, d, x, y, z, mat = MATS.sofa) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z);
        g.add(m);
      };
      part(1.8, 0.42, 0.9, 0, -0.15, 0);          // seat base
      part(2.0, 0.5, 0.22, 0, 0.21, -0.34);       // back
      part(0.2, 0.52, 0.9, -0.9, -0.1, 0);        // arms
      part(0.2, 0.52, 0.9, 0.9, -0.1, 0);
      for (const [x, z] of [[-0.9, -0.38], [0.9, -0.38], [-0.9, 0.38], [0.9, 0.38]]) part(0.06, 0.1, 0.06, x, -0.41, z, MATS.darkWood);
      return g;
    },
    body: () => {
      const b = new CANNON.Body({ mass: 40 });
      b.addShape(new CANNON.Box(new CANNON.Vec3(1.0, 0.26, 0.45)), new CANNON.Vec3(0, -0.2, 0));
      b.addShape(new CANNON.Box(new CANNON.Vec3(1.0, 0.25, 0.11)), new CANNON.Vec3(0, 0.21, -0.34));
      for (const x of [-0.9, 0.9]) b.addShape(new CANNON.Box(new CANNON.Vec3(0.1, 0.26, 0.45)), new CANNON.Vec3(x, -0.1, 0));
      return b;
    } },
  // A spare tyre: bounces off bats, goes flat when stabbed
  tyre: { kind: 'rubber', mass: 9, hp: 2, breakVel: 99, shards: 0, shape: () => roundShape(0.35, 0.35, 0.18), h: 0.18,
    build: () => {
      const g = new THREE.Group();
      const torus = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.09, 12, 28), MATS.rubber);
      torus.rotation.x = Math.PI / 2;
      g.add(torus);
      return g;
    } },
  // --- Office and kitchen -----------------------------------------------------
  keyboard: { kind: 'tv', mass: 0.8, hp: 2, breakVel: 5, shards: 6, shape: () => new CANNON.Box(new CANNON.Vec3(0.22, 0.015, 0.075)), h: 0.03,
    build: () => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.03, 0.15), MATS.black));
      const keys = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.012, 0.11), MATS.lightPlastic);
      keys.position.y = 0.018;
      g.add(keys);
      return g;
    } },
  microwave: { kind: 'tv', mass: 12, hp: 8, breakVel: 5, shards: 16, shape: () => new CANNON.Box(new CANNON.Vec3(0.25, 0.15, 0.18)), h: 0.3,
    build: () => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.36), MATS.enamel));
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.22), MATS.darkGlass);
      door.position.set(-0.06, 0, 0.181);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.01), MATS.metalDark);
      panel.position.set(0.18, 0, 0.18);
      g.add(door, panel);
      return g;
    } },
  toaster: { kind: 'tv', mass: 2, hp: 4, breakVel: 5, shards: 8, shape: () => new CANNON.Box(new CANNON.Vec3(0.14, 0.1, 0.08)), h: 0.2,
    build: () => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.16), MATS.chrome));
      for (const z of [-0.035, 0.035]) {
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.01, 0.03), MATS.black);
        slot.position.set(0, 0.1, z);
        g.add(slot);
      }
      return g;
    } },
  // Big blue bottle on top of the office water cooler
  jug: { kind: 'glass', mass: 3, hp: 1, breakVel: 3, shards: 20, shape: () => roundShape(0.14, 0.14, 0.48), h: 0.48,
    build: () => new THREE.Mesh(lathe([[0, 0], [0.03, 0], [0.035, 0.08], [0.13, 0.13], [0.14, 0.2], [0.14, 0.44], [0.12, 0.48], [0, 0.48]], 22, 0.48), MATS.waterGlass) },
};


// Screens drawn on a canvas so they can crack and flicker.
export function makeScreen(w, h, mode) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const s = { canvas, ctx, tex, material, mode, cracks: [], damaged: false };
  drawScreen(s);
  return s;
}

export function drawScreen(s) {
  const { ctx, canvas: { width: w, height: h } } = s;
  if (!s.damaged) {
    if (s.mode === 'bars') {
      const bars = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
      bars.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect((i * w) / 7, 0, w / 7 + 1, h * 0.75); });
      ctx.fillStyle = '#111'; ctx.fillRect(0, h * 0.75, w, h * 0.25);
      ctx.fillStyle = '#fff'; ctx.font = `bold ${h * 0.11}px monospace`; ctx.textAlign = 'center';
      ctx.fillText('NO SIGNAL', w / 2, h * 0.92);
    } else if (s.mode === 'code') {
      ctx.fillStyle = '#1e1e24'; ctx.fillRect(0, 0, w, h);
      const colors = ['#c678dd', '#61afef', '#98c379', '#e5c07b', '#abb2bf'];
      for (let y = 10, i = 0; y < h - 6; y += 11, i++) {
        const indent = ((i * 7) % 4) * 10;
        ctx.fillStyle = colors[(i * 3) % colors.length];
        ctx.fillRect(8 + indent, y, 30 + ((i * 37) % 90), 5);
        ctx.fillStyle = colors[(i * 5 + 1) % colors.length];
        ctx.fillRect(48 + indent + ((i * 37) % 90), y, 20 + ((i * 53) % 60), 5);
      }
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1b4fd8'); g.addColorStop(1, '#0a2a8a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.font = `bold ${h * 0.2}px sans-serif`; ctx.fillText(':(', w / 2, h * 0.38);
      ctx.font = `bold ${h * 0.09}px sans-serif`; ctx.fillText('ERROR 404', w / 2, h * 0.6);
      ctx.font = `${h * 0.075}px sans-serif`; ctx.fillText('calm not found', w / 2, h * 0.75);
    }
  } else {
    // Broken signal: animated static with glitch bars
    const img = ctx.createImageData(w / 4, h / 4);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 200;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v + 20; img.data[i + 3] = 255;
    }
    const tmp = s.tmp || (s.tmp = Object.assign(document.createElement('canvas'), { width: w / 4, height: h / 4 }));
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, w, h);
    if (Math.random() < 0.3) {
      ctx.fillStyle = `hsla(${Math.random() * 360},90%,55%,0.5)`;
      ctx.fillRect(0, Math.random() * h, w, rand(4, 18));
    }
  }
  // Cracks
  ctx.lineCap = 'round';
  for (const c of s.cracks) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = c.width;
    ctx.beginPath();
    ctx.moveTo(c.pts[0][0], c.pts[0][1]);
    for (const p of c.pts) ctx.lineTo(p[0], p[1]);
    ctx.stroke();
  }
  s.tex.needsUpdate = true;
}

export function crackScreen(s, u = 0.5, v = 0.5) {
  const { width: w, height: h } = s.canvas;
  const cx = u * w, cy = (1 - v) * h;
  const n = 7 + Math.floor(Math.random() * 5);
  for (let i = 0; i < n; i++) {
    let a = (i / n) * Math.PI * 2 + rand(-0.3, 0.3);
    let x = cx, y = cy;
    const pts = [[x, y]];
    const len = rand(0.3, 0.8) * w;
    for (let d = 0; d < len; d += rand(8, 20)) {
      a += rand(-0.35, 0.35);
      x += Math.cos(a) * 14; y += Math.sin(a) * 14;
      pts.push([x, y]);
    }
    s.cracks.push({ pts, width: rand(1, 2.5) });
  }
  // A ring around the impact point
  const ring = [];
  for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.4) ring.push([cx + Math.cos(a) * rand(10, 18), cy + Math.sin(a) * rand(10, 18)]);
  s.cracks.push({ pts: ring, width: 2 });
  s.damaged = true;
  drawScreen(s);
}
