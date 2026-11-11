/**
 * materials.js — material factories and color palettes.
 *
 * Every call returns a NEW material, so mutating one (e.g. flashing an enemy
 * red) never affects other objects. Colors accept numbers (0xff8800), CSS
 * strings ("#ff8800", "tomato") or THREE.Color.
 *
 * @example
 * import { flat, toon, glow, PALETTES, pick } from "./engine/index.js";
 * const mat = flat(pick("pastel", 2));               // flat-shaded low-poly look
 * const lava = glow(0xff5500, 2);                     // self-lit
 * const mesh = new THREE.Mesh(new THREE.BoxGeometry(), toon(PALETTES.neon[0]));
 */
import * as THREE from "three";

/** Named palettes (arrays of hex colors). */
export const PALETTES = {
  pastel: [0xffadad, 0xffd6a5, 0xfdffb6, 0xcaffbf, 0x9bf6ff, 0xa0c4ff, 0xbdb2ff, 0xffc6ff],
  neon: [0xff2e88, 0x00f0ff, 0xb3ff00, 0xffe600, 0x9d4dff, 0xff6b00],
  retro: [0xe63946, 0xf1faee, 0xa8dadc, 0x457b9d, 0x1d3557, 0xf4a261],
  forest: [0x2d6a4f, 0x40916c, 0x52b788, 0x74c69d, 0x95d5b2, 0x8b5e34, 0x6f4518],
  desert: [0xe9c46a, 0xf4a261, 0xe76f51, 0xd4a373, 0xfaedcd, 0x8d6e63],
  ocean: [0x03045e, 0x0077b6, 0x00b4d8, 0x48cae4, 0x90e0ef, 0xcaf0f8],
  candy: [0xff70a6, 0xff9770, 0xffd670, 0xe9ff70, 0x70d6ff, 0xc77dff],
  mono: [0x111111, 0x444444, 0x777777, 0xaaaaaa, 0xdddddd, 0xffffff],
};

/**
 * Pick a color from a palette (array or palette name). Index wraps around;
 * omit `i` for a random entry. @returns {number}
 */
export function pick(palette, i, rng = Math.random) {
  const list = typeof palette === "string" ? PALETTES[palette] || PALETTES.pastel : palette;
  const idx = i === undefined ? Math.floor(rng() * list.length) : ((i % list.length) + list.length) % list.length;
  return list[idx];
}

/** Lighten (amount > 0) or darken (amount < 0) a color. Returns a hex number. */
export function shade(color, amount = 0.2) {
  const c = new THREE.Color(color);
  const target = amount >= 0 ? new THREE.Color(0xffffff) : new THREE.Color(0x000000);
  return c.lerp(target, Math.min(Math.abs(amount), 1)).getHex();
}

let gradientMap = null;
function toonGradient() {
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([90, 170, 255]);
  gradientMap = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

/** Cel-shaded (3-band) material. */
export function toon(color = 0xffffff, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra });
}

/** Flat-shaded matte material — the classic low-poly look. */
export function flat(color = 0xffffff, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0, ...extra });
}

/** Self-illuminated material that ignores shadows/lighting darkness. */
export function glow(color = 0xffffff, intensity = 1.5, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.5,
    ...extra,
  });
}

/** Physically based material. Any MeshStandardMaterial option is accepted. */
export function standard({ color = 0xffffff, roughness = 0.6, metalness = 0, ...rest } = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...rest });
}

/** See-through material (glass, water, force fields). */
export function glass(color = 0x88ccff, opacity = 0.35, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    roughness: 0.1,
    metalness: 0.1,
    depthWrite: false,
    ...extra,
  });
}

/** Unlit solid color (UI-like objects, skyboxes, sprites). */
export function unlit(color = 0xffffff, extra = {}) {
  return new THREE.MeshBasicMaterial({ color, ...extra });
}
