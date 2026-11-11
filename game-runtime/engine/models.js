/**
 * models.js — procedural low-poly models (no asset files needed).
 *
 * Every factory returns a THREE.Group with shadows enabled. Conventions:
 *  - grounded models have their pivot at the bottom center (y = 0 sits on the floor);
 *    coins/gems are centered.
 *  - models face +Z, so `obj.lookAt(target)` or `obj.rotation.y = Math.atan2(dir.x, dir.z)` aims them.
 *  - animated models expose `group.userData.animate(time, speed01)`; characterController
 *    calls it for you.
 *
 * @example
 * import { makeCharacter, makeTree, makeCoin, scatter } from "./engine/index.js";
 * const hero = game.add(makeCharacter({ color: 0x3a86ff }));
 * scatter(game.scene, (rng) => makeTree({ rng }), { count: 40, area: 60, avoid: [{ x: 0, z: 0, radius: 6 }] });
 * const coin = game.add(makeCoin()); coin.position.set(3, 1, 0);
 */
import * as THREE from "three";
import { flat, glow, shade } from "./materials.js";
import { seededRandom } from "./math.js";

// Rounded position key (integers avoid "-0.000" vs "0.000" seams).
const posKey = (pos, i) => `${Math.round(pos.getX(i) * 1000)},${Math.round(pos.getY(i) * 1000)},${Math.round(pos.getZ(i) * 1000)}`;

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Enable cast/receive shadows on every mesh in a hierarchy. */
export function enableShadows(object, cast = true, receive = true) {
  object.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
  return object;
}

/**
 * Blocky humanoid (~1.8 units tall). userData.animate(t, speed01) swings limbs.
 * userData.parts = { body, head, leftArm, rightArm, leftLeg, rightLeg }.
 */
export function makeCharacter({ color = 0x3a86ff, accent = 0xffbe0b, skin = 0xffd6a5, scale = 1 } = {}) {
  const g = new THREE.Group();
  g.name = "character";
  const bodyMat = flat(color);
  const accentMat = flat(accent);
  const skinMat = flat(skin);
  const dark = flat(0x222233);

  const body = mesh(new THREE.BoxGeometry(0.7, 0.75, 0.42), bodyMat, 0, 1.0, 0);
  const belt = mesh(new THREE.BoxGeometry(0.72, 0.1, 0.44), accentMat, 0, 0.68, 0);
  const head = mesh(new THREE.BoxGeometry(0.56, 0.52, 0.52), skinMat, 0, 1.66, 0);
  const hair = mesh(new THREE.BoxGeometry(0.6, 0.16, 0.56), accentMat, 0, 1.96, -0.02);
  const eyeGeo = new THREE.BoxGeometry(0.08, 0.1, 0.04);
  head.add(mesh(eyeGeo, dark, -0.12, 0.03, 0.27), mesh(eyeGeo, dark, 0.12, 0.03, 0.27));

  const limb = (w, h, mat, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    pivot.add(mesh(new THREE.BoxGeometry(w, h, w), mat, 0, -h / 2, 0));
    return pivot;
  };
  const leftLeg = limb(0.26, 0.64, dark, -0.18, 0.64);
  const rightLeg = limb(0.26, 0.64, dark, 0.18, 0.64);
  const leftArm = limb(0.2, 0.62, bodyMat, -0.47, 1.33);
  const rightArm = limb(0.2, 0.62, bodyMat, 0.47, 1.33);
  leftArm.children[0].add(mesh(new THREE.BoxGeometry(0.2, 0.14, 0.2), skinMat, 0, -0.36, 0));
  rightArm.children[0].add(mesh(new THREE.BoxGeometry(0.2, 0.14, 0.2), skinMat, 0, -0.36, 0));

  const rig = new THREE.Group();
  rig.add(body, belt, head, hair, leftLeg, rightLeg, leftArm, rightArm);
  g.add(rig);
  g.scale.setScalar(scale);
  g.userData.parts = { body, head, leftArm, rightArm, leftLeg, rightLeg };
  g.userData.animate = (t, speed = 1) => {
    const s = Math.min(Math.max(speed, 0), 1);
    const swing = Math.sin(t * 11) * 0.7 * s;
    leftLeg.rotation.x = swing;
    rightLeg.rotation.x = -swing;
    leftArm.rotation.x = -swing * 0.8;
    rightArm.rotation.x = swing * 0.8;
    rig.position.y = Math.abs(Math.sin(t * 11)) * 0.08 * s + Math.sin(t * 2) * 0.015 * (1 - s);
  };
  return g;
}

/** Tree. style "pine" (stacked cones) or "round" (blobby crown). */
export function makeTree({ height = 3, color, trunkColor = 0x8b5a2b, style, rng = Math.random } = {}) {
  const g = new THREE.Group();
  g.name = "tree";
  const kind = style || (rng() < 0.5 ? "pine" : "round");
  const trunkH = height * 0.35;
  g.add(mesh(new THREE.CylinderGeometry(height * 0.05, height * 0.08, trunkH, 6), flat(trunkColor), 0, trunkH / 2, 0));
  if (kind === "pine") {
    const leaf = flat(color ?? [0x2d6a4f, 0x40916c, 0x3a7d44][Math.floor(rng() * 3)]);
    for (let i = 0; i < 3; i++) {
      const r = height * (0.38 - i * 0.09);
      const h = height * 0.38;
      const cone = mesh(new THREE.ConeGeometry(r, h, 7), leaf, 0, trunkH + i * h * 0.55 + h / 2 - 0.1, 0);
      cone.rotation.y = rng() * Math.PI;
      g.add(cone);
    }
  } else {
    const leaf = flat(color ?? [0x52b788, 0x74c69d, 0x95d5b2, 0x6a994e][Math.floor(rng() * 4)]);
    const r = height * 0.32;
    g.add(mesh(new THREE.IcosahedronGeometry(r, 0), leaf, 0, trunkH + r * 0.8, 0));
    g.add(mesh(new THREE.IcosahedronGeometry(r * 0.7, 0), leaf, r * 0.55, trunkH + r * 0.55, r * 0.2));
    g.add(mesh(new THREE.IcosahedronGeometry(r * 0.6, 0), leaf, -r * 0.5, trunkH + r * 0.7, -r * 0.25));
  }
  return g;
}

/**
 * Randomly displace a geometry's vertices for an organic low-poly look. Vertices
 * that share a position move together, so faces stay connected. Returns the geometry.
 * @param {THREE.BufferGeometry} geometry
 * @param {number} [amount=0.1] max displacement per axis
 * @param {number} [seed=1]
 */
export function jitter(geometry, amount = 0.1, seed = 1) {
  const rng = seededRandom(seed);
  const pos = geometry.attributes.position;
  const moved = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = posKey(pos, i);
    if (!moved.has(key)) moved.set(key, [(rng() - 0.5) * 2 * amount, (rng() - 0.5) * 2 * amount, (rng() - 0.5) * 2 * amount]);
    const d = moved.get(key);
    pos.setXYZ(i, pos.getX(i) + d[0], pos.getY(i) + d[1], pos.getZ(i) + d[2]);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Jagged low-poly boulder, slightly buried. */
export function makeRock({ size = 1, color = 0x9aa0a6, seed, rng } = {}) {
  const random = rng || seededRandom(seed ?? Math.floor(Math.random() * 1e9));
  const geo = new THREE.IcosahedronGeometry(size * 0.6, 0);
  const pos = geo.attributes.position;
  const jitter = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = posKey(pos, i);
    if (!jitter.has(key)) jitter.set(key, 0.75 + random() * 0.45);
    const k = jitter.get(key);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k * 0.7, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const g = new THREE.Group();
  g.name = "rock";
  const m = mesh(geo, flat(color), 0, size * 0.25, 0);
  m.rotation.y = random() * Math.PI * 2;
  g.add(m);
  return g;
}

/** Wooden crate with darker edge trims. */
export function makeCrate({ size = 1, color = 0xc68642 } = {}) {
  const g = new THREE.Group();
  g.name = "crate";
  g.add(mesh(new THREE.BoxGeometry(size, size, size), flat(color), 0, size / 2, 0));
  const trim = flat(shade(color, -0.35));
  const t = size * 0.12;
  const o = size / 2 - t / 2 + 0.005;
  for (const [x, z] of [[-o, -o], [o, -o], [-o, o], [o, o]]) {
    g.add(mesh(new THREE.BoxGeometry(t, size + 0.01, t), trim, x, size / 2, z));
  }
  for (const y of [t / 2, size - t / 2]) {
    g.add(mesh(new THREE.BoxGeometry(size + 0.01, t, t), trim, 0, y, -o));
    g.add(mesh(new THREE.BoxGeometry(size + 0.01, t, t), trim, 0, y, o));
    g.add(mesh(new THREE.BoxGeometry(t, t, size + 0.01), trim, -o, y, 0));
    g.add(mesh(new THREE.BoxGeometry(t, t, size + 0.01), trim, o, y, 0));
  }
  return g;
}

/** Gold coin standing upright, centered pivot. Pair with spin()/bob(). */
export function makeCoin({ radius = 0.4, color = 0xffc800 } = {}) {
  const g = new THREE.Group();
  g.name = "coin";
  const edge = mesh(new THREE.CylinderGeometry(radius, radius, radius * 0.2, 20), glow(color, 0.35, { metalness: 0.4, roughness: 0.35 }));
  edge.rotation.x = Math.PI / 2;
  const face = mesh(new THREE.CylinderGeometry(radius * 0.7, radius * 0.7, radius * 0.24, 20), glow(shade(color, 0.15), 0.3));
  face.rotation.x = Math.PI / 2;
  g.add(edge, face);
  return g;
}

/** Faceted gem (octahedron), centered pivot. */
export function makeGem({ size = 0.5, color = 0x4cc9f0 } = {}) {
  const g = new THREE.Group();
  g.name = "gem";
  const m = mesh(new THREE.OctahedronGeometry(size * 0.6, 0), glow(color, 0.6, { flatShading: true, roughness: 0.2 }));
  m.scale.y = 1.4;
  g.add(m);
  return g;
}

/** Simple car facing +Z. userData.wheels; userData.animate(t, speed01) spins wheels. */
export function makeCar({ color = 0xe63946, accent = 0x1d3557 } = {}) {
  const g = new THREE.Group();
  g.name = "car";
  const paint = flat(color);
  g.add(mesh(new THREE.BoxGeometry(1.6, 0.5, 3), paint, 0, 0.55, 0));
  g.add(mesh(new THREE.BoxGeometry(1.4, 0.5, 1.6), flat(accent), 0, 1.05, -0.2));
  const glassMat = flat(0x9ad1ff, { roughness: 0.2 });
  g.add(mesh(new THREE.BoxGeometry(1.3, 0.38, 0.05), glassMat, 0, 1.06, 0.61));
  const lightMat = glow(0xfff3b0, 1.2);
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.15, 0.05), lightMat, -0.5, 0.6, 1.51));
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.15, 0.05), lightMat, 0.5, 0.6, 1.51));
  const tail = glow(0xff2244, 0.8);
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.15, 0.05), tail, -0.5, 0.6, -1.51));
  g.add(mesh(new THREE.BoxGeometry(0.3, 0.15, 0.05), tail, 0.5, 0.6, -1.51));
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const tire = flat(0x222222);
  const wheels = [];
  for (const [x, z] of [[-0.8, 1], [0.8, 1], [-0.8, -1], [0.8, -1]]) {
    const w = mesh(wheelGeo, tire, x, 0.35, z);
    wheels.push(w);
    g.add(w);
  }
  g.userData.wheels = wheels;
  let last = 0;
  g.userData.animate = (t, speed = 1) => {
    const dt = Math.min(Math.max(t - last, 0), 0.1);
    last = t;
    for (const w of wheels) w.rotation.x += dt * speed * 15;
  };
  return g;
}

/** Arcade spaceship facing +Z, centered pivot, with a glowing engine (userData.engine). */
export function makeSpaceship({ color = 0xdfe7ff, accent = 0x4361ee, engineColor = 0x00e5ff } = {}) {
  const g = new THREE.Group();
  g.name = "spaceship";
  const hull = flat(color);
  const acc = flat(accent);
  const body = mesh(new THREE.CylinderGeometry(0.28, 0.45, 2, 8), hull);
  body.rotation.x = Math.PI / 2;
  const nose = mesh(new THREE.ConeGeometry(0.28, 0.8, 8), acc, 0, 0, 1.4);
  nose.rotation.x = Math.PI / 2;
  const cockpit = mesh(new THREE.SphereGeometry(0.25, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), flat(0x80ffdb, { roughness: 0.2 }), 0, 0.22, 0.3);
  cockpit.scale.z = 1.6;
  const wingGeo = new THREE.BoxGeometry(2.6, 0.08, 0.8);
  const wings = mesh(wingGeo, acc, 0, 0, -0.4);
  const finL = mesh(new THREE.BoxGeometry(0.08, 0.5, 0.5), acc, -1.25, 0.2, -0.6);
  const finR = mesh(new THREE.BoxGeometry(0.08, 0.5, 0.5), acc, 1.25, 0.2, -0.6);
  const engine = mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.2, 8), glow(engineColor, 2.5), 0, 0, -1.05);
  engine.rotation.x = Math.PI / 2;
  engine.castShadow = false;
  g.add(body, nose, cockpit, wings, finL, finR, engine);
  g.userData.engine = engine;
  return g;
}

/** Bouncy blob enemy with angry eyes. userData.animate(t) squashes/stretches. */
export function makeEnemyBlob({ color = 0x9d4edd, size = 1 } = {}) {
  const g = new THREE.Group();
  g.name = "enemy";
  const inner = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.5, 12, 9), flat(color), 0, 0.5, 0);
  body.scale.y = 0.85;
  const white = flat(0xffffff);
  const black = flat(0x111111);
  for (const x of [-0.17, 0.17]) {
    const eye = mesh(new THREE.SphereGeometry(0.11, 8, 6), white, x, 0.58, 0.4);
    eye.add(mesh(new THREE.SphereGeometry(0.055, 6, 5), black, 0, 0, 0.08));
    const brow = mesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), black, x, 0.72, 0.43);
    brow.rotation.z = x < 0 ? -0.45 : 0.45;
    inner.add(eye, brow);
  }
  inner.add(body);
  g.add(inner);
  g.scale.setScalar(size);
  const phase = Math.random() * 10;
  g.userData.animate = (t, speed = 1) => {
    const s = Math.sin((t + phase) * 8 * Math.max(speed, 0.3));
    inner.scale.set(1 + s * 0.06, 1 - s * 0.08, 1 + s * 0.06);
  };
  return g;
}

/** Little house with pitched roof, door and windows. */
export function makeHouse({ color = 0xf1e3c6, roofColor = 0xc0392b, width = 3, depth = 3, height = 2.2 } = {}) {
  const g = new THREE.Group();
  g.name = "house";
  g.add(mesh(new THREE.BoxGeometry(width, height, depth), flat(color), 0, height / 2, 0));
  const roofH = height * 0.6;
  const roofGeo = new THREE.CylinderGeometry(0.0001, 1, 1, 4, 1);
  roofGeo.rotateY(Math.PI / 4);
  const roof = mesh(roofGeo, flat(roofColor), 0, height + roofH / 2, 0);
  roof.scale.set(width * 0.78, roofH, depth * 0.78);
  g.add(roof);
  g.add(mesh(new THREE.BoxGeometry(width * 0.22, height * 0.5, 0.06), flat(0x6b3e26), 0, height * 0.25, depth / 2 + 0.02));
  const win = glow(0xffe8a3, 0.4);
  for (const x of [-width * 0.3, width * 0.3]) {
    g.add(mesh(new THREE.BoxGeometry(width * 0.18, width * 0.18, 0.06), win, x, height * 0.6, depth / 2 + 0.02));
  }
  return g;
}

/** A flat platform block (top surface at y = height). */
export function makePlatform({ width = 4, depth = 4, height = 0.5, color = 0x8ecae6, topColor } = {}) {
  const g = new THREE.Group();
  g.name = "platform";
  g.add(mesh(new THREE.BoxGeometry(width, height, depth), flat(color), 0, height / 2, 0));
  if (topColor !== undefined) g.add(mesh(new THREE.BoxGeometry(width + 0.02, height * 0.25, depth + 0.02), flat(topColor), 0, height * 0.875, 0));
  return g;
}

/** Single cube block with pivot at bottom center. */
export function makeVoxel({ size = 1, color = 0x8ac926 } = {}) {
  const g = new THREE.Group();
  g.name = "voxel";
  g.add(mesh(new THREE.BoxGeometry(size, size, size), flat(color), 0, size / 2, 0));
  return g;
}

/**
 * Build a voxel model from text layers (one InstancedMesh, cheap to render).
 * layers[y][z] is a string; each character is a voxel along x ("." or " " = empty).
 * @param {string[][]} layers bottom layer first
 * @param {Record<string, number|string>} colors map from character to color
 * @example makeVoxelModel([["RRR", "R.R"], ["YYY", "..."]], { R: 0xff0000, Y: 0xffff00 }, { size: 0.25 })
 */
export function makeVoxelModel(layers, colors, { size = 0.25 } = {}) {
  const cells = [];
  layers.forEach((rows, y) =>
    rows.forEach((row, z) =>
      [...row].forEach((ch, x) => {
        if (ch !== "." && ch !== " " && colors[ch] !== undefined) cells.push({ x, y, z, ch });
      })
    )
  );
  const w = Math.max(1, ...layers.flatMap((rows) => rows.map((r) => r.length)));
  const d = Math.max(1, ...layers.map((rows) => rows.length));
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(size, size, size), flat(0xffffff), Math.max(cells.length, 1));
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  cells.forEach((cell, i) => {
    m.makeTranslation((cell.x - (w - 1) / 2) * size, (cell.y + 0.5) * size, (cell.z - (d - 1) / 2) * size);
    inst.setMatrixAt(i, m);
    inst.setColorAt(i, c.set(colors[cell.ch]));
  });
  inst.count = cells.length;
  inst.castShadow = inst.receiveShadow = true;
  const g = new THREE.Group();
  g.name = "voxel-model";
  g.add(inst);
  return g;
}

/**
 * Place many objects randomly on the XZ plane.
 * @param {THREE.Object3D} parent scene or group to add to
 * @param {(rng:()=>number, i:number)=>THREE.Object3D} factory
 * @param {{count?:number, area?:number|{minX:number,maxX:number,minZ:number,maxZ:number}, seed?:number,
 *   avoid?:Array<{x:number,z:number,radius:number}>|((x:number,z:number)=>boolean), minDistance?:number,
 *   y?:number|((x:number,z:number)=>number), scale?:[number,number], rotate?:boolean}} [opts]
 *   area = half-size of a square centered on the origin.
 * @returns {THREE.Object3D[]}
 */
export function scatter(parent, factory, opts = {}) {
  const { count = 20, area = 40, seed = 1, avoid = [], minDistance = 0, y = 0, scale = [0.8, 1.2], rotate = true } = opts;
  const rng = seededRandom(seed);
  const box = typeof area === "number" ? { minX: -area, maxX: area, minZ: -area, maxZ: area } : area;
  const placed = [];
  const blocked = (x, z) => {
    if (typeof avoid === "function") return avoid(x, z);
    return avoid.some((a) => Math.hypot(x - a.x, z - a.z) < a.radius);
  };
  for (let i = 0, tries = 0; placed.length < count && tries < count * 30; tries++) {
    const x = box.minX + rng() * (box.maxX - box.minX);
    const z = box.minZ + rng() * (box.maxZ - box.minZ);
    if (blocked(x, z)) continue;
    if (minDistance > 0 && placed.some((o) => Math.hypot(o.position.x - x, o.position.z - z) < minDistance)) continue;
    const obj = factory(rng, i++);
    obj.position.set(x, typeof y === "function" ? y(x, z) : y, z);
    if (rotate) obj.rotation.y = rng() * Math.PI * 2;
    obj.scale.multiplyScalar(scale[0] + rng() * (scale[1] - scale[0]));
    parent.add(obj);
    placed.push(obj);
  }
  return placed;
}
