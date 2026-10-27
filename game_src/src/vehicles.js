import * as THREE from 'three';
import { ledBoardTexture, plateTexture } from './textures.js';

// Vehicles are built from parts the player can damage one at a time:
//   window  - cracks on the first hit, shatters on the next
//   light   - head/tail lights and signs, shatter in one hit
//   mirror  - snaps off and falls
//   panel   - painted bodywork, dents where it is hit
//   tire   - bounces blunt hits; a knife punctures it and it goes flat
//   trim   - just thuds
// Each vehicle's local origin is at ground level in its middle, front facing +x.

const vehicleGlass = () => new THREE.MeshStandardMaterial({
  color: 0x8fb4c9, transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.2,
  envMapIntensity: 2.5, side: THREE.DoubleSide, depthWrite: false,
});
const rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.25, metalness: 0.9 });
const trimMat = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.6 });
const seatMat = new THREE.MeshStandardMaterial({ color: 0x2a2522, roughness: 0.9 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.9 });
const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xd9d6cc, roughness: 0.8 });
const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff4dc });

function box(w, h, d, mat, x, y, z, segs) {
  const geo = segs ? new THREE.BoxGeometry(w, h, d, ...segs) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

function makeBuilder() {
  const group = new THREE.Group();
  const parts = [];
  const add = (mesh, kind, hp = 1) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    parts.push({ mesh, kind, hp });
    return mesh;
  };
  return { group, parts, add, wheels: [] };
}

// Tyre and rim share a group, so a puncture can squash the whole wheel.
function wheel(b, x, z, r, w) {
  const g = new THREE.Group();
  g.position.set(x, r, z);
  b.group.add(g);
  const info = { group: g, x, z, r, punctured: false };
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 22), rubber);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.6, w + 0.01, 16), rimMat);
  for (const m of [tire, rim]) {
    m.rotation.x = Math.PI / 2;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    b.parts.push({ mesh: m, kind: 'tire', hp: 1, wheel: info });
  }
  b.wheels.push(info);
}

export function buildCar(color = 0xc8102e, plate = 'TN 09 RR 2026') {
  const b = makeBuilder();
  const { group, parts, add } = b;
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 });
  const glass = vehicleGlass();
  const headM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 1.2 });
  const tailM = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 0.8 });

  // Bodywork: finely divided so dents look smooth
  add(box(4.2, 0.62, 1.8, paint, 0, 0.62, 0, [42, 6, 18]), 'panel');
  add(box(1.8, 0.06, 1.52, paint, -0.17, 1.47, 0, [18, 1, 14]), 'panel');
  add(box(0.1, 0.5, 1.54, paint, -0.15, 1.18, 0), 'panel'); // centre pillars

  // Inside
  add(box(2.0, 0.04, 1.5, trimMat, -0.2, 0.94, 0), 'trim');
  for (const z of [-0.38, 0.38]) add(box(0.45, 0.45, 0.55, seatMat, 0.1, 1.15, z), 'trim');
  add(box(0.45, 0.45, 1.3, seatMat, -0.85, 1.15, 0), 'trim');

  // Glass
  const windshield = add(box(0.02, 0.66, 1.46, glass, 0.89, 1.2, 0), 'window', 2);
  windshield.rotation.z = 0.55;
  const rear = add(box(0.02, 0.62, 1.42, glass, -1.24, 1.19, 0), 'window', 2);
  rear.rotation.z = -0.5;
  for (const z of [-0.76, 0.76]) {
    add(box(0.78, 0.46, 0.02, glass, 0.32, 1.19, z), 'window', 2);
    add(box(0.78, 0.46, 0.02, glass, -0.62, 1.19, z), 'window', 2);
  }

  // Lights, grille, bumpers, plates
  const lights = [];
  for (const z of [-0.6, 0.6]) {
    lights.push(add(box(0.04, 0.12, 0.32, headM, 2.1, 0.75, z), 'light'));
    lights.push(add(box(0.04, 0.1, 0.3, tailM, -2.1, 0.78, z), 'light'));
  }
  add(box(0.03, 0.18, 0.7, trimMat, 2.11, 0.68, 0), 'trim');
  add(box(0.12, 0.16, 1.82, trimMat, 2.12, 0.42, 0), 'trim');
  add(box(0.12, 0.16, 1.82, trimMat, -2.12, 0.42, 0), 'trim');
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTexture(plate), roughness: 0.6 });
  for (const s of [1, -1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.1), plateMat);
    p.position.set(s * 2.185, 0.44, 0);
    p.rotation.y = s * Math.PI / 2;
    add(p, 'trim');
  }

  for (const z of [-1.0, 1.0]) add(box(0.1, 0.08, 0.16, paint, 0.78, 1.0, z), 'mirror');
  for (const x of [1.35, -1.35]) for (const z of [-0.82, 0.82]) wheel(b, x, z, 0.33, 0.24);

  return {
    kind: 'car', group, parts, lights, wheels: b.wheels,
    colliders: [{ w: 4.2, h: 0.93, d: 1.8, x: 0, y: 0.465, z: 0 }, { w: 1.9, h: 0.56, d: 1.5, x: -0.2, y: 1.2, z: 0 }],
    footprint: { w: 4.4, d: 2.0 },
  };
}

export function buildBus(route = '21G  BROADWAY') {
  const b = makeBuilder();
  const { group, parts, add } = b;
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xd63a1f, metalness: 0.3, roughness: 0.45, clearcoat: 0.6 });
  const cream = new THREE.MeshPhysicalMaterial({ color: 0xf1e6c8, metalness: 0.2, roughness: 0.5, clearcoat: 0.4 });
  const glass = vehicleGlass();
  const headM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 1.2 });
  const tailM = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 0.8 });

  // Hollow body you can walk into: floor, ceiling, thin walls, and a door gap
  // on the +z side between the axles.
  const FLOOR = 0.4, ROOF = 2.45;
  const DOOR_A = 1.85, DOOR_B = 2.95; // door opening along x
  const LOW_H = 1.2, LOW_Y = FLOOR + LOW_H / 2;
  const behindDoor = { w: DOOR_A + 5, x: (DOOR_A - 5) / 2 };
  const aheadDoor = { w: 5 - DOOR_B, x: (5 + DOOR_B) / 2 };
  add(box(9.94, 0.1, 2.44, floorMat, 0, FLOOR - 0.05, 0), 'trim');
  add(box(9.94, 0.04, 2.44, ceilingMat, 0, ROOF - 0.02, 0), 'trim');
  add(box(10, 0.45, 2.5, cream, 0, 2.675, 0, [80, 2, 16]), 'panel'); // roof
  add(box(10, LOW_H, 0.06, paint, 0, LOW_Y, -1.22, [80, 8, 1]), 'panel');
  add(box(behindDoor.w, LOW_H, 0.06, paint, behindDoor.x, LOW_Y, 1.22, [55, 8, 1]), 'panel');
  add(box(aheadDoor.w, LOW_H, 0.06, paint, aheadDoor.x, LOW_Y, 1.22, [16, 8, 1]), 'panel');
  add(box(0.06, LOW_H, 2.5, paint, 5.0, LOW_Y, 0, [1, 8, 16]), 'panel');
  add(box(0.06, LOW_H, 2.5, paint, -5.0, LOW_Y, 0, [1, 8, 16]), 'panel');
  add(box(10.02, 0.12, 0.08, cream, 0, 1.45, -1.22), 'trim'); // stripes
  add(box(behindDoor.w, 0.12, 0.08, cream, behindDoor.x, 1.45, 1.22), 'trim');
  add(box(aheadDoor.w, 0.12, 0.08, cream, aheadDoor.x, 1.45, 1.22), 'trim');

  // Seven windows a side with pillars between them; the door replaces one on +z
  for (const side of [1, -1]) {
    for (let i = 0; i < 7; i++) {
      if (side === 1 && i === 5) continue;
      add(box(1.15, 0.8, 0.02, glass, -4.1 + i * 1.3, 2.0, side * 1.24), 'window', 2);
    }
    for (let i = 0; i < 6; i++) add(box(0.15, 0.9, 0.04, paint, -3.45 + i * 1.3, 2.0, side * 1.25), 'panel');
    add(box(0.725, 0.9, 0.04, paint, 4.64, 2.0, side * 1.25), 'panel');
    add(box(0.325, 0.9, 0.04, paint, -4.84, 2.0, side * 1.25), 'panel');
    add(box(0.04, 0.9, 0.35, paint, -5.0, 2.0, side * 1.075), 'panel'); // rear corners
  }

  // Inside: ceiling lights, grab poles, dashboard and steering wheel, door step
  for (const z of [-0.45, 0.45]) add(box(8.2, 0.02, 0.12, lampMat, -0.3, ROOF - 0.05, z), 'trim');
  for (const [x, z] of [[-2.6, 0.42], [0.45, -0.42], [1.75, 0.42], [3.1, 0.42]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, ROOF - FLOOR, 10), rimMat);
    pole.position.set(x, (ROOF + FLOOR) / 2, z);
    add(pole, 'trim');
  }
  add(box(0.35, 0.25, 2.3, trimMat, 4.8, 1.3, 0), 'trim');
  const steering = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 24), trimMat);
  steering.position.set(4.5, 1.35, -0.6);
  steering.rotation.set(0, Math.PI / 2, 0.5);
  add(steering, 'trim');
  add(box(DOOR_B - DOOR_A, 0.2, 0.3, trimMat, (DOOR_A + DOOR_B) / 2, 0.1, 1.4), 'trim');

  const windshield = add(box(0.02, 0.85, 2.3, glass, 5.0, 2.0, 0), 'window', 2);
  windshield.rotation.z = 0.06;
  add(box(0.02, 0.6, 1.8, glass, -5.0, 2.05, 0), 'window', 2);

  // Destination board
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.28),
    new THREE.MeshBasicMaterial({ map: ledBoardTexture(route), toneMapped: false }),
  );
  board.position.set(5.012, 2.6, 0);
  board.rotation.y = Math.PI / 2;
  add(board, 'light');

  const lights = [];
  for (const z of [-0.9, 0.9]) {
    lights.push(add(box(0.04, 0.16, 0.3, headM, 5.01, 0.85, z), 'light'));
    lights.push(add(box(0.04, 0.2, 0.2, tailM, -5.01, 0.9, z * 1.1), 'light'));
  }
  add(box(0.14, 0.25, 2.52, trimMat, 5.05, 0.5, 0), 'trim');
  add(box(0.14, 0.25, 2.52, trimMat, -5.05, 0.5, 0), 'trim');
  for (const z of [-1.35, 1.35]) add(box(0.08, 0.35, 0.12, trimMat, 5.15, 2.0, z), 'mirror');
  for (const x of [3.5, -3.0]) for (const z of [-1.12, 1.12]) wheel(b, x, z, 0.5, 0.3);

  return {
    kind: 'bus', group, parts, lights, wheels: b.wheels,
    // Physics: chassis, roof and walls with the same door gap as the body
    colliders: [
      { w: 10, h: 0.4, d: 2.5, x: 0, y: 0.2, z: 0 },
      { w: 10, h: 0.5, d: 2.5, x: 0, y: 2.7, z: 0 },
      { w: 10, h: 2.05, d: 0.1, x: 0, y: 1.425, z: -1.22 },
      { w: 6.85, h: 2.05, d: 0.1, x: -1.575, y: 1.425, z: 1.22 },
      { w: 2.05, h: 2.05, d: 0.1, x: 3.975, y: 1.425, z: 1.22 },
      { w: 0.1, h: 2.05, d: 2.5, x: 5.0, y: 1.425, z: 0 },
      { w: 0.1, h: 2.05, d: 2.5, x: -5.0, y: 1.425, z: 0 },
    ],
    // Where the player can walk inside, and the step up at the door
    interior: { minX: -4.95, maxX: 4.95, minZ: -1.18, maxZ: 1.18, y: 0.4, step: { x: 2.4, w: 1.1, minZ: 1.18, maxZ: 1.6, y: 0.2 } },
    footprint: { w: 10.4, d: 2.8 },
  };
}
