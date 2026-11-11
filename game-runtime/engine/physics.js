/**
 * physics.js — lightweight arcade physics (spheres + axis-aligned boxes).
 *
 * Bodies wrap an Object3D (a direct child of the scene) and move it directly.
 * Boxes never rotate (AABB). Good for platformers, arenas, pickups, bullets —
 * not for stacking towers or ragdolls. Call `world.step(dt)` once per frame.
 *
 * If you omit radius/size, the body is fitted to the object's bounding box
 * (including the offset between pivot and center), so models with a pivot at
 * their feet just work. Add the object to the scene and position it first.
 *
 * @example
 * import { createPhysicsWorld } from "./engine/index.js";
 * const world = createPhysicsWorld({ gravity: -25, ground: 0 });
 * const playerBody = world.add({ object: player, shape: "sphere", radius: 0.5, offset: [0, 0.5, 0] });
 * world.add({ object: wall, shape: "box", isStatic: true });           // auto-fitted
 * world.add({ object: coin, isTrigger: true, onEnter: (other) => { if (other === playerBody) collect(coin); } });
 * game.onUpdate((dt) => world.step(dt));
 * if (playerBody.onGround && input.action("jump")) playerBody.velocity.y = 9;
 */
import * as THREE from "three";
import { vec3 } from "./math.js";

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();
const _box = new THREE.Box3();

/**
 * @param {{gravity?:number|number[], ground?:number|null, substeps?:number}} [opts]
 *   gravity: y acceleration (number) or [x,y,z]; ground: y of an infinite floor plane (null = none).
 */
export function createPhysicsWorld({ gravity = -20, ground = null, substeps = 0 } = {}) {
  const g = typeof gravity === "number" ? new THREE.Vector3(0, gravity, 0) : vec3(gravity);
  const bodies = [];
  const toRemove = new Set();
  let stepping = false;

  /** World-space center of a body. */
  const center = (b, out) => out.copy(b.object.position).add(b.offset);

  /**
   * Add a body.
   * @param {object} o
   * @param {THREE.Object3D} o.object
   * @param {"sphere"|"box"} [o.shape="box"]
   * @param {number} [o.radius] sphere radius
   * @param {number|number[]|THREE.Vector3} [o.size] box full extents [w, h, d]
   * @param {number[]|THREE.Vector3} [o.offset] center relative to object.position
   * @param {number[]|THREE.Vector3} [o.velocity]
   * @param {number} [o.mass=1]
   * @param {boolean} [o.isStatic=false] never moves (walls, floors)
   * @param {boolean} [o.kinematic=false] moves by its velocity, ignores gravity and pushes (moving platforms)
   * @param {number} [o.restitution=0] bounciness 0..1
   * @param {number} [o.friction=0.3] 0..1, applied at contacts
   * @param {number} [o.damping=0] velocity loss per second (air drag)
   * @param {number} [o.gravityScale] default 1 (0 for triggers, so pickups/zones don't fall)
   * @param {boolean} [o.isTrigger=false] detects overlaps but never pushes
   * @param {number} [o.layer=1] bitmask this body belongs to
   * @param {number} [o.mask=0xffffffff] bitmask of layers it collides with
   * @param {(other:object, info:{normal:THREE.Vector3, depth:number})=>void} [o.onCollide] every step while touching
   * @param {(other:object)=>void} [o.onEnter] first step of contact
   * @param {(other:object)=>void} [o.onExit] contact ended
   */
  function add(o) {
    const object = o.object;
    if (!object) throw new Error("physics.add: `object` is required");
    const shape = o.shape || (o.radius !== undefined ? "sphere" : "box");
    let offset = o.offset !== undefined ? vec3(o.offset) : null;
    let radius = o.radius;
    let size = o.size !== undefined ? (typeof o.size === "number" ? vec3(o.size) : vec3(o.size)) : null;
    if ((shape === "sphere" && radius === undefined) || (shape === "box" && !size)) {
      object.updateWorldMatrix(true, true);
      _box.setFromObject(object);
      if (_box.isEmpty()) _box.set(_a.set(-0.5, -0.5, -0.5).add(object.position), _b.set(0.5, 0.5, 0.5).add(object.position));
      const s = _box.getSize(new THREE.Vector3());
      if (shape === "sphere") radius = Math.max(s.x, s.y, s.z) / 2;
      else size = s;
      if (!offset) offset = _box.getCenter(new THREE.Vector3()).sub(object.position);
    }
    const body = {
      object,
      shape,
      radius: radius ?? 0.5,
      size: size || new THREE.Vector3(1, 1, 1),
      offset: offset || new THREE.Vector3(),
      velocity: o.velocity ? vec3(o.velocity) : new THREE.Vector3(),
      isStatic: !!o.isStatic,
      kinematic: !!o.kinematic,
      mass: o.mass ?? 1,
      restitution: o.restitution ?? 0,
      friction: o.friction ?? 0.3,
      damping: o.damping ?? 0,
      gravityScale: o.gravityScale ?? (o.isTrigger ? 0 : 1),
      isTrigger: !!o.isTrigger,
      layer: o.layer ?? 1,
      mask: o.mask ?? 0xffffffff,
      onCollide: o.onCollide,
      onEnter: o.onEnter,
      onExit: o.onExit,
      onGround: false,
      enabled: true,
      userData: o.userData || {},
      contacts: new Set(),
      /** Remove this body from the world. */
      remove: () => remove(body),
    };
    object.userData.body = body;
    bodies.push(body);
    return body;
  }

  /** Remove a body (safe to call inside collision callbacks). */
  function remove(body) {
    if (!body) return;
    if (stepping) {
      body.enabled = false;
      toRemove.add(body);
    } else {
      const i = bodies.indexOf(body);
      if (i >= 0) bodies.splice(i, 1);
      for (const other of bodies) other.contacts.delete(body);
    }
  }

  // Bodies whose object was removed from the scene are ignored automatically.
  const live = (b) => b.enabled && b.object.parent !== null;
  const invMass = (b) => (b.isStatic || b.kinematic || b.mass <= 0 ? 0 : 1 / b.mass);
  const canCollide = (a, b) => (a.layer & b.mask) !== 0 && (b.layer & a.mask) !== 0;

  /** Contact normal points from a to b. Returns depth > 0 if overlapping, else 0. */
  function collide(a, b, normal) {
    center(a, _a);
    center(b, _b);
    if (a.shape === "sphere" && b.shape === "sphere") {
      _d.subVectors(_b, _a);
      const dist = _d.length();
      const r = a.radius + b.radius;
      if (dist >= r) return 0;
      if (dist > 1e-6) normal.copy(_d).divideScalar(dist);
      else normal.set(0, 1, 0);
      return r - dist;
    }
    if (a.shape === "box" && b.shape === "box") {
      const ox = (a.size.x + b.size.x) / 2 - Math.abs(_b.x - _a.x);
      const oy = (a.size.y + b.size.y) / 2 - Math.abs(_b.y - _a.y);
      const oz = (a.size.z + b.size.z) / 2 - Math.abs(_b.z - _a.z);
      if (ox <= 0 || oy <= 0 || oz <= 0) return 0;
      if (oy <= ox && oy <= oz) {
        normal.set(0, Math.sign(_b.y - _a.y) || 1, 0);
        return oy;
      }
      if (ox <= oz) {
        normal.set(Math.sign(_b.x - _a.x) || 1, 0, 0);
        return ox;
      }
      normal.set(0, 0, Math.sign(_b.z - _a.z) || 1);
      return oz;
    }
    // sphere vs box (flip so `s` is the sphere)
    const flip = a.shape === "box";
    const s = flip ? b : a;
    const bx = flip ? a : b;
    const sc = flip ? _b : _a;
    const bc = flip ? _a : _b;
    const hx = bx.size.x / 2;
    const hy = bx.size.y / 2;
    const hz = bx.size.z / 2;
    const lx = sc.x - bc.x;
    const ly = sc.y - bc.y;
    const lz = sc.z - bc.z;
    const cx = Math.max(-hx, Math.min(hx, lx));
    const cy = Math.max(-hy, Math.min(hy, ly));
    const cz = Math.max(-hz, Math.min(hz, lz));
    let depth;
    if (cx === lx && cy === ly && cz === lz) {
      // center inside the box: push out along the axis of least penetration
      const px = hx - Math.abs(lx);
      const py = hy - Math.abs(ly);
      const pz = hz - Math.abs(lz);
      if (py <= px && py <= pz) normal.set(0, Math.sign(ly) || 1, 0), (depth = py + s.radius);
      else if (px <= pz) normal.set(Math.sign(lx) || 1, 0, 0), (depth = px + s.radius);
      else normal.set(0, 0, Math.sign(lz) || 1), (depth = pz + s.radius);
    } else {
      _d.set(lx - cx, ly - cy, lz - cz);
      const dist = _d.length();
      if (dist >= s.radius) return 0;
      normal.copy(_d).divideScalar(dist || 1);
      depth = s.radius - dist;
    }
    // `normal` currently points from box to sphere; we need a -> b
    if (!flip) normal.negate();
    return depth;
  }

  const _n = new THREE.Vector3();
  const _rv = new THREE.Vector3();
  const _t = new THREE.Vector3();
  let touching = new Map(); // body -> Set(others) for this step

  function touch(a, b) {
    if (!touching.has(a)) touching.set(a, new Set());
    touching.get(a).add(b);
  }

  function resolve(a, b, n, depth) {
    const ia = invMass(a);
    const ib = invMass(b);
    const sum = ia + ib;
    if (sum === 0) return;
    // positional correction (slightly under-correct to stay stable)
    const corr = (Math.max(depth - 0.001, 0) / sum) * 0.9;
    a.object.position.addScaledVector(n, -corr * ia);
    b.object.position.addScaledVector(n, corr * ib);
    if (n.y < -0.6 && ia > 0) a.onGround = true;
    if (n.y > 0.6 && ib > 0) b.onGround = true;
    // velocity response
    _rv.subVectors(b.velocity, a.velocity);
    const vn = _rv.dot(n);
    if (vn >= 0) return;
    const e = Math.max(a.restitution, b.restitution);
    const j = (-(1 + e) * vn) / sum;
    a.velocity.addScaledVector(n, -j * ia);
    b.velocity.addScaledVector(n, j * ib);
    // friction
    _rv.subVectors(b.velocity, a.velocity);
    _t.copy(_rv).addScaledVector(n, -_rv.dot(n));
    const vt = _t.length();
    if (vt > 1e-5) {
      _t.divideScalar(vt);
      const mu = Math.sqrt(a.friction * b.friction);
      const jt = Math.min(vt / sum, mu * j);
      a.velocity.addScaledVector(_t, jt * ia);
      b.velocity.addScaledVector(_t, -jt * ib);
    }
  }

  function substep(h) {
    for (const b of bodies) {
      if (!live(b) || b.isStatic) continue;
      if (!b.kinematic) {
        b.velocity.addScaledVector(g, h * b.gravityScale);
        if (b.damping > 0) b.velocity.multiplyScalar(Math.max(0, 1 - b.damping * h));
      }
      b.object.position.addScaledVector(b.velocity, h);
      // infinite ground plane
      if (ground !== null && !b.isTrigger && !b.kinematic) {
        const bottom = b.object.position.y + b.offset.y - (b.shape === "sphere" ? b.radius : b.size.y / 2);
        if (bottom < ground) {
          b.object.position.y += ground - bottom;
          if (b.velocity.y < 0) {
            b.velocity.y = -b.velocity.y * b.restitution;
            if (Math.abs(b.velocity.y) < 1) b.velocity.y = 0;
          }
          const f = Math.max(0, 1 - b.friction * 10 * h);
          b.velocity.x *= f;
          b.velocity.z *= f;
          b.onGround = true;
        }
      }
    }
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      if (!live(a)) continue;
      for (let k = i + 1; k < bodies.length; k++) {
        const b = bodies[k];
        if (!live(b) || !canCollide(a, b)) continue;
        if ((a.isStatic || a.kinematic) && (b.isStatic || b.kinematic) && !a.isTrigger && !b.isTrigger) continue;
        const depth = collide(a, b, _n);
        if (depth <= 0) continue;
        const first = !touching.get(a)?.has(b); // fire onCollide once per pair per step
        touch(a, b);
        touch(b, a);
        const trigger = a.isTrigger || b.isTrigger;
        if (!trigger) resolve(a, b, _n, depth);
        if (first && (a.onCollide || b.onCollide)) {
          const nA = _n.clone();
          a.onCollide?.(b, { normal: nA, depth, trigger });
          b.onCollide?.(a, { normal: nA.clone().negate(), depth, trigger });
        }
      }
    }
  }

  /** Advance the simulation by dt seconds (split into substeps of <= 1/60 s). */
  function step(dt) {
    if (!(dt > 0)) return;
    stepping = true;
    touching = new Map();
    for (const b of bodies) b.onGround = false;
    const n = substeps || Math.min(Math.ceil(dt / (1 / 60)), 8);
    const h = dt / n;
    for (let i = 0; i < n; i++) substep(h);
    // enter / exit events
    for (const b of bodies) {
      const now = touching.get(b) || new Set();
      if (b.onEnter) for (const o of now) if (!b.contacts.has(o)) b.onEnter(o);
      if (b.onExit) for (const o of b.contacts) if (!now.has(o)) b.onExit(o);
      b.contacts = now;
    }
    stepping = false;
    if (toRemove.size) {
      for (const b of toRemove) remove(b);
      toRemove.clear();
    }
  }

  const _ray = new THREE.Ray();
  const _hit = new THREE.Vector3();
  const _sph = new THREE.Sphere();
  /**
   * Cast a ray against all bodies (not triggers unless includeTriggers).
   * @returns {{body:object, point:THREE.Vector3, distance:number}|null} nearest hit
   */
  function raycast(origin, direction, maxDistance = Infinity, { mask = 0xffffffff, ignore = null, includeTriggers = false } = {}) {
    _ray.set(vec3(origin), vec3(direction).normalize());
    let best = null;
    for (const b of bodies) {
      if (!live(b) || b === ignore || (b.isTrigger && !includeTriggers) || (b.layer & mask) === 0) continue;
      center(b, _a);
      let p = null;
      if (b.shape === "sphere") p = _ray.intersectSphere(_sph.set(_a, b.radius), _hit);
      else {
        _box.setFromCenterAndSize(_a, b.size);
        p = _ray.intersectBox(_box, _hit);
      }
      if (!p) continue;
      const dist = p.distanceTo(_ray.origin);
      if (dist <= maxDistance && (!best || dist < best.distance)) best = { body: b, point: p.clone(), distance: dist };
    }
    if (ground !== null && _ray.direction.y < 0) {
      const dist = (ground - _ray.origin.y) / _ray.direction.y;
      if (dist >= 0 && dist <= maxDistance && (!best || dist < best.distance)) {
        best = { body: null, point: _ray.at(dist, new THREE.Vector3()), distance: dist };
      }
    }
    return best;
  }

  /** Height of the first surface below `position` (or -Infinity). */
  function groundHeight(position, maxDistance = 100, opts) {
    const hit = raycast(_d.set(position.x, position.y + 0.01, position.z), [0, -1, 0], maxDistance, opts);
    return hit ? hit.point.y : -Infinity;
  }

  /** All bodies overlapping a sphere at `position` with `radius`. */
  function query(position, radius, { mask = 0xffffffff, includeTriggers = true } = {}) {
    const p = vec3(position);
    const probe = { shape: "sphere", radius, offset: new THREE.Vector3(), object: { position: p } };
    return bodies.filter((b) => live(b) && (b.layer & mask) !== 0 && (includeTriggers || !b.isTrigger) && collide(probe, b, _n) > 0);
  }

  return {
    bodies,
    gravity: g,
    /** y of the infinite floor plane, or null. */
    get ground() {
      return ground;
    },
    set ground(v) {
      ground = v;
    },
    add,
    remove,
    step,
    raycast,
    groundHeight,
    query,
    /** Remove all bodies. */
    clear() {
      bodies.length = 0;
      toRemove.clear();
    },
  };
}
