/**
 * math.js — small math helpers for games.
 *
 * Everything here is pure (no scene access) and works with plain numbers or
 * THREE.Vector3. Random helpers take an optional `rng` (a function returning
 * [0, 1)), so you can pass `seededRandom(42)` for reproducible levels.
 *
 * @example
 * import { damp, randRange, seededRandom, noise2D } from "./engine/index.js";
 * const rng = seededRandom(7);
 * const x = randRange(-10, 10, rng);
 * player.position.x = damp(player.position.x, targetX, 8, dt); // smooth follow
 * const height = noise2D(x * 0.1, z * 0.1) * 3;              // terrain bumps
 */
import * as THREE from "three";

/** Clamp `v` into [min, max]. */
export const clamp = (v, min = 0, max = 1) => (v < min ? min : v > max ? max : v);

/** Linear interpolation from a to b by t. */
export const lerp = (a, b, t) => a + (b - a) * t;

/** Inverse of lerp: where `v` sits between a and b (0..1, unclamped). */
export const inverseLerp = (a, b, v) => (a === b ? 0 : (v - a) / (b - a));

/** Map `v` from range [a1, b1] to [a2, b2]. */
export const remap = (v, a1, b1, a2, b2) => lerp(a2, b2, inverseLerp(a1, b1, v));

/**
 * Frame-rate independent smoothing toward a target.
 * `lambda` is the responsiveness (≈ 1..20; higher = snappier).
 */
export const damp = (current, target, lambda, dt) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** In-place frame-rate independent smoothing of a Vector3 toward `target`. */
export function dampVec3(vec, target, lambda, dt) {
  return vec.lerp(target, 1 - Math.exp(-lambda * dt));
}

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(a) {
  a %= Math.PI * 2;
  if (a <= -Math.PI) a += Math.PI * 2;
  else if (a > Math.PI) a -= Math.PI * 2;
  return a;
}

/** Interpolate between two angles (radians) along the shortest arc. */
export const angleLerp = (a, b, t) => a + wrapAngle(b - a) * t;

/** Frame-rate independent angle smoothing along the shortest arc. */
export const angleDamp = (a, b, lambda, dt) => angleLerp(a, b, 1 - Math.exp(-lambda * dt));

/** Random float in [min, max). */
export const randRange = (min, max, rng = Math.random) => min + (max - min) * rng();

/** Random integer in [min, max] (inclusive). */
export const randInt = (min, max, rng = Math.random) => Math.floor(min + (max - min + 1) * rng());

/** Random element of an array. */
export const choose = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];

/** Shuffle an array in place (Fisher–Yates) and return it. */
export function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Deterministic PRNG (mulberry32). Returns a function producing [0, 1). */
export function seededRandom(seed = 1) {
  let s = (typeof seed === "string" ? hashString(seed) : seed) >>> 0;
  return function rng() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Convert [x,y,z], a number (all axes), {x,y,z} or a Vector3 into a new Vector3.
 * @returns {THREE.Vector3}
 */
export function vec3(x = 0, y, z) {
  if (x && x.isVector3) return x.clone();
  if (Array.isArray(x)) return new THREE.Vector3(x[0] || 0, x[1] || 0, x[2] || 0);
  if (typeof x === "object" && x !== null) return new THREE.Vector3(x.x || 0, x.y || 0, x.z || 0);
  if (y === undefined) return new THREE.Vector3(x, x, x);
  return new THREE.Vector3(x, y, z || 0);
}

const pt = (p) => (p && p.isObject3D ? p.position : p);

/** Distance between two points (or Object3Ds) on the XZ plane (ignores height). */
export function distXZ(a, b) {
  a = pt(a);
  b = pt(b);
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Yaw (rotation.y) that makes a +Z-facing object at `from` face `to` (points or Object3Ds). */
export const yawTo = (from, to) => Math.atan2(pt(to).x - pt(from).x, pt(to).z - pt(from).z);

/** Random point inside a circle of `radius` on XZ, returned as Vector3 (y = 0). */
export function randomInCircle(radius = 1, rng = Math.random) {
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(rng()) * radius;
  return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
}

// --- Value noise --------------------------------------------------------

function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

/** Smooth 2D value noise in [0, 1). Scale inputs (e.g. x * 0.1) to control feature size. */
export function noise2D(x, y, seed = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}

/** Fractal (layered) value noise in roughly [0, 1). */
export function fbm2D(x, y, { octaves = 4, seed = 0 } = {}) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2D(x, y, seed + i * 17) * amp;
    norm += amp;
    x *= 2;
    y *= 2;
    amp *= 0.5;
  }
  return sum / norm;
}
