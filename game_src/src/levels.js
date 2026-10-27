import * as THREE from 'three';
import { MATS, rand } from './objects.js';
import { brickTexture, concreteTexture, fabricTexture, tileTexture, plasterTexture } from './textures.js';

// Every level: its room (walls the player can't leave), where the player
// starts, how it is lit, its furniture and the objects to smash.
//
// Shell boxes and furniture boxes are [w, h, d, x, y, z, material, rotY].
// Items are [type, x, baseY, z, rotY?, tilt?] (rotY left out = random).

// --- Shells: the fixed rooms --------------------------------------------------
const brick = new THREE.MeshStandardMaterial({ map: brickTexture(4, 2), roughness: 0.9 });
const longBrick = new THREE.MeshStandardMaterial({ map: brickTexture(9, 2), roughness: 0.9 });
const concrete = new THREE.MeshStandardMaterial({ map: concreteTexture(6), roughness: 0.85 });
concrete.map.repeat.set(7, 3);
const carpet = new THREE.MeshStandardMaterial({ map: fabricTexture('#4f5a6e'), roughness: 1 });
carpet.map.repeat.set(10, 7);
const plaster = new THREE.MeshStandardMaterial({ map: plasterTexture('#d9d6cf', [3, 1]), roughness: 0.9 });
const officeCeiling = new THREE.MeshStandardMaterial({ map: tileTexture('#e9e7e2', '#bdbab3', [6, 4]), roughness: 0.9 });
const kitchenFloor = new THREE.MeshStandardMaterial({ map: tileTexture('#e8e4dc', '#8b8680', [5, 4], '#2b2b2f'), roughness: 0.35 });
const kitchenWall = new THREE.MeshStandardMaterial({ map: tileTexture('#f1efe9', '#c9c5bd', [8, 3]), roughness: 0.3 });
const kitchenCeiling = new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.9 });
const lampPanel = new THREE.MeshBasicMaterial({ color: 0xfffaf0 });

export const SHELLS = {
  // Rage room (x < 3.95) and garage (x > 3.95) share one building
  building: {
    boxes: [
      [19, 0.1, 8.5, 5.7, -0.05, 1.0, concrete],
      [19, 4, 0.2, 5.7, 2, -3, longBrick],
      [19, 4, 0.2, 5.7, 2, 5.0, longBrick],
      [0.2, 4, 8.2, -3.6, 2, 1.0, brick],
      [0.2, 4, 8.2, 15.2, 2, 1.0, brick],
      [0.2, 4, 8.2, 3.95, 2, 1.0, brick], // wall between the rage room and the garage
    ],
    ceilings: [],
    neons: [['SMASH IT', 0, 2.45, -2.88], ['WRECK IT', 9.5, 3.45, -2.88]],
  },
  office: {
    boxes: [
      [12.4, 0.1, 8.4, 46, -0.05, 1, carpet],
      [12.4, 3.2, 0.2, 46, 1.6, -3.1, plaster],
      [12.4, 3.2, 0.2, 46, 1.6, 5.1, plaster],
      [0.2, 3.2, 8.4, 39.9, 1.6, 1, plaster],
      [0.2, 3.2, 8.4, 52.1, 1.6, 1, plaster],
    ],
    ceilings: [[12.4, 8.4, 46, 3.2, 1, officeCeiling],
      ...[[43, -0.6], [43, 2.6], [47, -0.6], [47, 2.6], [50.8, -1.5]].map(([x, z]) => [1.2, 0.3, x, 3.19, z, lampPanel])],
    neons: [['OVERTIME', 46, 2.55, -2.98]],
  },
  kitchen: {
    boxes: [
      [10.4, 0.1, 8.4, 75, -0.05, 1, kitchenFloor],
      [10.4, 3, 0.2, 75, 1.5, -3.1, kitchenWall],
      [10.4, 3, 0.2, 75, 1.5, 5.1, kitchenWall],
      [0.2, 3, 8.4, 69.9, 1.5, 1, kitchenWall],
      [0.2, 3, 8.4, 80.1, 1.5, 1, kitchenWall],
    ],
    ceilings: [[10.4, 8.4, 75, 3, 1, kitchenCeiling], [3, 0.25, 74, 2.99, 0, lampPanel], [2, 0.25, 77.8, 2.99, 3.3, lampPanel]],
    neons: [['NO DISHES', 74, 2.4, -2.98]],
  },
};

// --- Furniture builders ---------------------------------------------------------
const box = (w, h, d, x, y, z, mat, rotY = 0) => [w, h, d, x, y, z, mat, rotY];

function table(name, hp, x, z, w, d, topY, topMat, legMat = MATS.darkWood) {
  return { name, hp, obstacle: { x, z, w, d, rot: 0 }, boxes: [
    box(w, 0.06, d, x, topY - 0.03, z, topMat),
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => box(0.07, topY - 0.06, 0.07, x + sx * (w / 2 - 0.06), (topY - 0.06) / 2, z + sz * (d / 2 - 0.06), legMat)),
  ] };
}

function desk(x, z, w = 1.6, d = 0.8) {
  return { name: 'desk', hp: 12, obstacle: { x, z, w, d, rot: 0 }, boxes: [
    box(w, 0.05, d, x, 0.735, z, MATS.wood),
    box(0.05, 0.71, d - 0.05, x - w / 2 + 0.05, 0.355, z, MATS.metalDark),
    box(0.05, 0.71, d - 0.05, x + w / 2 - 0.05, 0.355, z, MATS.metalDark),
  ] };
}

function counter(x, z, w = 1.4) {
  return { name: 'counter', hp: 12, obstacle: { x, z, w, d: 0.62, rot: 0 }, boxes: [
    box(w - 0.02, 0.86, 0.6, x, 0.43, z, MATS.cabinet),
    box(w, 0.04, 0.62, x, 0.88, z, MATS.stone),
  ] };
}

// --- Level 2 helpers: the bus ------------------------------------------------------
export const BUS_X = 9.5, BUS_Z = -1.6, BUS_FLOOR = 0.4;

// Bus seats face the front (+x): pedestal, cushion and backrest. Soft: the
// knife can slash them as well as the bat and fists.
function busSeat(lx, lz, width = 0.8) {
  const x = BUS_X + lx, z = BUS_Z + lz;
  return { name: 'bus seat', hp: 8, soft: true, obstacle: { x: x - 0.02, z, w: 0.5, d: width, rot: 0 }, boxes: [
    box(0.12, 0.35, width * 0.6, x, BUS_FLOOR + 0.175, z, MATS.metalDark),
    box(0.45, 0.1, width, x, BUS_FLOOR + 0.4, z, MATS.seat),
    box(0.08, 0.6, width, x - 0.22, BUS_FLOOR + 0.7, z, MATS.seat),
  ] };
}
function busSeats() {
  const seats = [];
  for (let i = 0; i < 7; i++) {
    const lx = -4.3 + i * 1.05;
    seats.push(busSeat(lx, -0.78));
    if (lx < 1.4 || lx > 3.3) seats.push(busSeat(lx, 0.78)); // keep the doorway clear
  }
  seats.push(busSeat(4.0, -0.6, 0.5)); // driver
  return seats;
}

// --- The levels ------------------------------------------------------------------------
const TABLE_TOP = 0.82;
const SHELF_Z = -2.55, SHELF_LOW = 0.92, SHELF_HIGH = 1.67;
const BENCH_TOP = 0.9, BENCH_Z = 4.5;
const BED_TOP = 0.3;

export const LEVELS = [
  {
    name: 'Rage Room',
    blurb: 'Glasses, bottles, a TV, a shelf full of vases',
    shell: 'building',
    room: { minX: -3.5, maxX: 3.75, minZ: -2.9, maxZ: 4.9 },
    spawn: { x: 0, z: 2.6, yaw: 0 },
    lights: { main: [0.4, 4.2, 1.4, 0, 0.6, -0.9], fill: [-1, 3.8, 3.5, -1, 0, 3.5, 50], neon: [0, 2.4, -2.4] },
    furniture: () => [
      table('table', 12, 0, 0.05, 2.7, 1.0, TABLE_TOP, MATS.wood),
      { name: 'shelf', hp: 16, obstacle: { x: 0, z: SHELF_Z, w: 4.3, d: 0.5, rot: 0 }, boxes: [
        box(4.2, 0.04, 0.5, 0, SHELF_LOW - 0.02, SHELF_Z, MATS.darkWood),
        box(4.2, 0.04, 0.5, 0, SHELF_HIGH - 0.02, SHELF_Z, MATS.darkWood),
        box(0.06, 1.8, 0.5, -2.1, 0.9, SHELF_Z, MATS.metalDark),
        box(0.06, 1.8, 0.5, 2.1, 0.9, SHELF_Z, MATS.metalDark),
      ] },
      { name: 'tv crate', hp: 12, obstacle: { x: -2.35, z: -1.3, w: 0.9, d: 0.7, rot: 0.45 }, boxes: [
        box(0.9, 0.95, 0.7, -2.35, 0.475, -1.3, MATS.wood, 0.45),
      ] },
      { name: 'monitor desk', hp: 8, obstacle: { x: 2.35, z: -1.3, w: 0.9, d: 0.6, rot: -0.45 }, boxes: [
        box(0.9, 0.06, 0.6, 2.35, 0.72, -1.3, MATS.darkWood, -0.45),
        box(0.08, 0.7, 0.5, 2.35, 0.35, -1.3, MATS.metalDark, -0.45),
      ] },
      { name: 'workbench', hp: 16, obstacle: { x: -0.6, z: BENCH_Z, w: 4, d: 0.7, rot: 0 }, boxes: [
        box(4, 0.06, 0.7, -0.6, BENCH_TOP - 0.03, BENCH_Z, MATS.darkWood),
        box(0.08, 0.84, 0.6, -2.5, 0.42, BENCH_Z, MATS.metalDark),
        box(0.08, 0.84, 0.6, 1.3, 0.42, BENCH_Z, MATS.metalDark),
      ] },
    ],
    items: () => [
      // Table: glasses, bottles, plates, mugs
      ...[-1.05, -0.88, -0.71].map((x) => ['tumbler', x, TABLE_TOP, 0.25]),
      ...[-0.45, -0.25].map((x) => ['wine', x, TABLE_TOP, 0.3]),
      ...[0.05, 0.22, 0.39].map((x) => ['bottle', x, TABLE_TOP, 0.12]),
      ...[0, 1, 2, 3].map((i) => ['plate', 0.85, TABLE_TOP + i * 0.023, 0.2, 0]),
      ...[-1.0, -0.72].map((x) => ['mug', x, TABLE_TOP, -0.2]),
      ['vase', -0.25, TABLE_TOP, -0.22], ['wine', 0.62, TABLE_TOP, -0.15], ['tumbler', 1.12, TABLE_TOP, -0.15],
      // Shelf: vases and bottles below, a row of glasses above
      ...[-1.5, -0.5, 0.6, 1.55].map((x) => ['vase', x, SHELF_LOW, SHELF_Z]),
      ...[-1.05, 0.05, 1.05].map((x) => ['bottle', x, SHELF_LOW, SHELF_Z]),
      ...Array.from({ length: 12 }, (_, i) => [i % 3 === 1 ? 'wine' : 'tumbler', -1.8 + i * 0.33, SHELF_HIGH, SHELF_Z]),
      // Electronics
      ['tv', -2.35, 0.95, -1.3, 0.45], ['monitor', 2.35, 0.75, -1.3, -0.45],
      // Workbench (screens face the room)
      ['laptop', -2.1, BENCH_TOP, BENCH_Z, Math.PI], ['lamp', -1.6, BENCH_TOP, BENCH_Z + 0.1], ['teapot', -1.15, BENCH_TOP, BENCH_Z],
      ...[-0.8, -0.62, -0.44].map((x) => ['jar', x, BENCH_TOP, BENCH_Z]),
      ...[-0.05, 0.35].map((x) => ['flowerpot', x, BENCH_TOP, BENCH_Z]),
      ['printer', 0.9, BENCH_TOP, BENCH_Z, Math.PI],
      // Floor: chairs, crates, a standing mirror and a few strays
      ['chair', -1.9, 0, 1.6, 2.6], ['chair', 1.9, 0, 1.7, -2.4],
      ['crate', 2.9, 0, 3.9, 0.2], ['crate', 3.0, 0, 3.3, -0.1], ['crate', 2.95, 0.5, 3.6, 0.5],
      ['mirror', -3.38, 0, 1.6, Math.PI / 2, -0.1],
      ['vase', 1.75, 0, 0.7], ['bottle', -1.75, 0, 0.75],
    ],
  },
  {
    name: 'Garage',
    blurb: 'A car, a city bus to wreck inside and out, a bed and a sofa',
    shell: 'building',
    room: { minX: 4.15, maxX: 15.1, minZ: -2.9, maxZ: 4.9 },
    spawn: { x: 5.0, z: 1.2, yaw: -Math.PI / 2 },
    lights: { main: [9.5, 4.4, 1.2, 9.5, 0, 0.4], fill: [13.5, 3.8, 3.6, 13.5, 0, 3.6, 70], neon: [9.5, 3.2, -2.4], bus: true },
    vehicles: true,
    furniture: () => [
      ...busSeats(),
      { name: 'bed', hp: 20, obstacle: { x: 13.85, z: 3.6, w: 2.1, d: 1.55, rot: 0 }, boxes: [
        box(2.0, 0.26, 1.5, 13.8, 0.17, 3.6, MATS.darkWood),
        box(0.08, 0.95, 1.55, 14.84, 0.475, 3.6, MATS.darkWood),
      ] },
    ],
    items: () => [
      // Bed with pillows and a teddy
      ['mattress', 13.8, BED_TOP, 3.6, 0],
      ['pillow', 14.45, BED_TOP + 0.22, 3.25, Math.PI / 2], ['pillow', 14.45, BED_TOP + 0.22, 3.95, Math.PI / 2],
      ['teddy', 13.95, BED_TOP + 0.22, 3.6, -Math.PI / 2],
      // Sofa against the front wall, with seat cushions and a pillow
      ['sofa', 5.4, 0, 4.45, Math.PI],
      ...[-0.53, 0, 0.53].map((dx) => ['cushion', 5.4 + dx, 0.52, 4.37, Math.PI]),
      ['pillow', 4.9, 0.66, 4.4, Math.PI + 0.3],
      // Spare tyres stacked by the bus
      ...[0, 1, 2].map((i) => ['tyre', 14.45, i * 0.181, 0.75, rand(0, 6)]),
    ],
  },
  {
    name: 'Office',
    blurb: 'Desks, computers, filing cabinets and glass walls',
    shell: 'office',
    room: { minX: 40.1, maxX: 51.9, minZ: -2.9, maxZ: 4.9 },
    spawn: { x: 41.2, z: 1.0, yaw: -Math.PI / 2 },
    lights: { main: [45, 3.1, 1, 45, 0, 0.6], fill: [49.8, 3.1, 1.2, 49.8, 0, 1.2, 70], neon: [46, 2.3, -2.5] },
    furniture: () => [
      desk(43, -0.6), desk(43, 2.6), desk(47, -0.6), desk(47, 2.6),
      desk(50.8, -1.5, 1.8, 0.9), // manager's desk
      ...[41.0, 41.65, 42.3].map((x) => ({ name: 'filing cabinet', hp: 12, kind: 'metal', obstacle: { x, z: -2.65, w: 0.6, d: 0.55, rot: 0 }, boxes: [
        box(0.6, 1.3, 0.55, x, 0.65, -2.65, MATS.steel),
      ] })),
      // Glass wall around the manager's corner (door gap at the room side)
      ...[-2.35, -1.05, 0.25].map((z) => ({ name: 'glass wall', hp: 1, kind: 'glass', obstacle: { x: 49.6, z, w: 0.08, d: 1.28, rot: 0 }, boxes: [
        box(0.04, 2.2, 1.28, 49.6, 1.1, z, MATS.glass),
      ] })),
      { name: 'water cooler', hp: 6, kind: 'metal', obstacle: { x: 51.55, z: 3.6, w: 0.4, d: 0.4, rot: 0 }, boxes: [
        box(0.35, 0.9, 0.35, 51.55, 0.45, 3.6, MATS.enamel),
      ] },
      { name: 'whiteboard', hp: 4, obstacle: { x: 40.1, z: 1, w: 0.1, d: 1.8, rot: 0 }, boxes: [
        box(0.04, 1.0, 1.8, 40.05, 1.5, 1, MATS.whiteboard),
      ] },
      table('printer table', 6, 44.8, 4.5, 0.9, 0.55, 0.75, MATS.wood, MATS.metalDark),
    ],
    items: () => {
      const list = [];
      [[43, -0.6], [43, 2.6], [47, -0.6], [47, 2.6]].forEach(([x, z], i) => {
        list.push(['monitor', x, 0.76, z - 0.15, 0], ['keyboard', x, 0.76, z + 0.15, 0], ['mug', x + 0.55, 0.76, z + 0.12]);
        if (i % 2 === 0) list.push(['laptop', x - 0.5, 0.76, z + 0.05, 0]);
        list.push(['chair', x, 0, z + 0.85, Math.PI]);
      });
      list.push(
        // Manager's desk and corner
        ['monitor', 50.8, 0.76, -1.75, 0], ['laptop', 50.2, 0.76, -1.4, 0.2], ['lamp', 51.45, 0.76, -1.8],
        ['vase', 51.4, 0.76, -1.2], ['tumbler', 50.3, 0.76, -1.15], ['tumbler', 50.45, 0.76, -1.15],
        ['chair', 50.8, 0, -0.65, Math.PI],
        ['jug', 51.55, 0.9, 3.6],
        ['printer', 44.8, 0.75, 4.5, Math.PI],
        ['flowerpot', 41.0, 1.3, -2.65], ['flowerpot', 40.6, 0, 4.5], ['flowerpot', 51.4, 0, 4.5], ['flowerpot', 46.2, 0, 4.55],
      );
      return list;
    },
  },
  {
    name: 'Kitchen',
    blurb: 'Stacks of plates, a fridge, a microwave and a dinner table',
    shell: 'kitchen',
    room: { minX: 70.1, maxX: 79.9, minZ: -2.9, maxZ: 4.9 },
    spawn: { x: 71.0, z: 3.6, yaw: -Math.PI / 2 },
    lights: { main: [74, 2.9, 0.4, 74, 0, -0.2], fill: [77.8, 2.9, 3.2, 77.8, 0, 3.2, 70], neon: [74, 2.2, -2.5] },
    furniture: () => [
      ...[71.4, 72.8, 74.2, 75.6].map((x) => counter(x, -2.6)),
      { name: 'fridge', hp: 16, kind: 'metal', obstacle: { x: 78.9, z: -2.5, w: 0.85, d: 0.7, rot: 0 }, boxes: [
        box(0.85, 1.9, 0.7, 78.9, 0.95, -2.5, MATS.enamel),
        box(0.03, 0.5, 0.03, 78.6, 1.3, -2.14, MATS.chrome),
      ] },
      { name: 'kitchen island', hp: 14, obstacle: { x: 75, z: 1.0, w: 1.8, d: 0.9, rot: 0 }, boxes: [
        box(1.76, 0.86, 0.86, 75, 0.43, 1.0, MATS.cabinet),
        box(1.8, 0.04, 0.9, 75, 0.88, 1.0, MATS.stone),
      ] },
      table('dining table', 12, 77.8, 3.3, 1.6, 0.9, 0.75, MATS.wood),
    ],
    items: () => [
      // Counters
      ['microwave', 71.4, 0.9, -2.62, 0], ['toaster', 72.5, 0.9, -2.65, 0],
      ...[72.95, 73.12, 73.29].map((x) => ['jar', x, 0.9, -2.7]),
      ...[0, 1, 2, 3, 4].map((i) => ['plate', 74.0, 0.9 + i * 0.023, -2.6, 0]),
      ...[0, 1, 2, 3].map((i) => ['plate', 74.4, 0.9 + i * 0.023, -2.6, 0]),
      ...[75.2, 75.4, 75.6].map((x) => ['mug', x, 0.9, -2.5]),
      ['teapot', 75.95, 0.9, -2.62], ['bottle', 76.15, 0.9, -2.7],
      ['bottle', 78.85, 1.9, -2.5], ['jar', 79.1, 1.9, -2.45],
      // Island
      ...[0, 1, 2, 3].map((i) => ['plate', 74.4, 0.9 + i * 0.023, 1.0, 0]),
      ...[74.95, 75.12, 75.29, 75.46].map((x) => ['wine', x, 0.9, 0.8]),
      ['bottle', 75.0, 0.9, 1.25], ['bottle', 75.2, 0.9, 1.25], ['vase', 75.65, 0.9, 1.1],
      // Dining table and chairs
      ...[[77.3, 3.05], [78.3, 3.05], [77.3, 3.55], [78.3, 3.55]].map(([x, z]) => ['plate', x, 0.75, z, 0]),
      ...[[77.5, 3.05], [78.5, 3.05], [77.5, 3.55], [78.5, 3.55]].map(([x, z]) => ['tumbler', x, 0.75, z]),
      ['vase', 77.8, 0.75, 3.3], ['bottle', 77.95, 0.75, 3.3],
      ['chair', 77.3, 0, 2.5, 0], ['chair', 78.3, 0, 2.5, 0], ['chair', 77.3, 0, 4.1, Math.PI], ['chair', 78.3, 0, 4.1, Math.PI],
    ],
  },
];

// Share of a level that has to be smashed before the next one opens.
export const UNLOCK_AT = 0.8;
