/**
 * world.js — lighting presets, gradient sky, ground, stars and fog.
 *
 * Presets: "day", "sunset", "night", "studio", "underwater", "space".
 * `environment()` is the one-liner (lights + sky + fog); the pieces are also
 * exported separately.
 *
 * @example
 * import { environment, createGround } from "./engine/index.js";
 * const env = environment(game.scene, "sunset");     // { lights, sky }
 * game.add(createGround({ size: 200, color: 0x6fbf5f }));
 * game.onUpdate(() => env.lights.follow(player.position)); // keep shadows around the player
 */
import * as THREE from "three";

/** Color/intensity settings per preset. */
export const LIGHT_PRESETS = {
  day: { top: 0x3f8fe0, bottom: 0xcfe6fb, hemi: [0xdcefff, 0x5c7a48, 1.25], sun: [0xfff1dc, 2.3], dir: [30, 50, 20], fog: 0xd6ecff },
  sunset: { top: 0x4b5bb8, bottom: 0xffb48a, hemi: [0xffd9b8, 0x5b4a78, 1.5], sun: [0xffa25e, 2.6], dir: [-40, 20, 25], fog: 0xf2ae8e },
  night: { top: 0x03060f, bottom: 0x1a2650, hemi: [0x7088cc, 0x0d0d1a, 0.8], sun: [0xa8c0ff, 1.1], dir: [-20, 40, -10], fog: 0x0f1733 },
  studio: { top: 0xf4f4f6, bottom: 0xd4d6de, hemi: [0xffffff, 0x9a9aa8, 2.0], sun: [0xffffff, 2.2], dir: [15, 30, 20], fog: 0xe4e5ea },
  underwater: { top: 0x1683b8, bottom: 0x03243d, hemi: [0x8adfff, 0x05304a, 1.5], sun: [0xa8ecff, 1.6], dir: [5, 50, 5], fog: 0x0a4a70 },
  space: { top: 0x000004, bottom: 0x0b0a26, hemi: [0x8a9aff, 0x150a26, 0.6], sun: [0xffffff, 2.8], dir: [40, 30, 30], fog: 0x05050f },
};

const presetOf = (name) => LIGHT_PRESETS[name] || LIGHT_PRESETS.day;

/**
 * Add hemisphere + shadow-casting directional light to the scene.
 * @param {THREE.Scene} scene
 * @param {keyof LIGHT_PRESETS} [preset="day"]
 * @param {{shadows?:boolean, shadowArea?:number, shadowMapSize?:number, intensity?:number}} [opts]
 * @returns {{hemi:THREE.HemisphereLight, sun:THREE.DirectionalLight, follow(pos:THREE.Vector3):void, dispose():void}}
 */
export function applyLighting(scene, preset = "day", opts = {}) {
  const { shadows = true, shadowArea = 60, shadowMapSize = 2048, intensity = 1 } = opts;
  const p = presetOf(preset);
  const hemi = new THREE.HemisphereLight(p.hemi[0], p.hemi[1], p.hemi[2] * intensity);
  const sun = new THREE.DirectionalLight(p.sun[0], p.sun[1] * intensity);
  const dir = new THREE.Vector3(...p.dir);
  sun.position.copy(dir);
  sun.castShadow = shadows;
  if (shadows) {
    const s = sun.shadow;
    s.mapSize.set(shadowMapSize, shadowMapSize);
    s.camera.left = s.camera.bottom = -shadowArea / 2;
    s.camera.right = s.camera.top = shadowArea / 2;
    s.camera.near = 1;
    s.camera.far = dir.length() * 2 + shadowArea;
    s.bias = -0.0005;
    s.normalBias = 0.03;
  }
  scene.add(hemi, sun, sun.target);
  return {
    hemi,
    sun,
    /** Center the sun (and its shadow area) on a position — call each frame in big worlds. */
    follow(pos) {
      sun.target.position.copy(pos);
      sun.position.copy(pos).add(dir);
    },
    dispose() {
      scene.remove(hemi, sun, sun.target);
      sun.dispose();
      hemi.dispose();
    },
  };
}

/**
 * Gradient sky dome that follows the camera (never clipped by the far plane).
 * @param {THREE.Scene} scene
 * @param {{top?:number|string, bottom?:number|string, exponent?:number, offset?:number, radius?:number}} [opts]
 *   The gradient runs from `bottom` at view-height -offset to `top` straight up. Raise offset
 *   (e.g. 0.8) when the camera mostly looks down and you still want to see the gradient.
 * @returns {THREE.Mesh} (mesh.material.uniforms.top/bottom are THREE.Color you can tween)
 */
export function createSky(scene, { top = 0x4a9be8, bottom = 0xd6ecff, exponent = 0.7, offset = 0.05, radius = 400 } = {}) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(top) },
      bottom: { value: new THREE.Color(bottom) },
      exponent: { value: exponent },
      offset: { value: offset },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        p.z = p.w * 0.99999; // always at the far plane, never clipped
        gl_Position = p;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 bottom; uniform float exponent; uniform float offset;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y + offset, 0.0, 1.0);
        gl_FragColor = vec4(mix(bottom, top, pow(h, exponent)), 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), material);
  sky.name = "sky";
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  sky.onBeforeRender = (renderer, s, camera) => {
    sky.position.copy(camera.position);
    sky.updateMatrixWorld();
  };
  scene.add(sky);
  return sky;
}

/**
 * Field of stars (screen-sized points) that follows the camera.
 * @returns {THREE.Points}
 */
export function createStars(scene, { count = 1500, radius = 350, size = 1.6, color = 0xffffff } = {}) {
  const pos = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.randomDirection().multiplyScalar(radius);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color, size, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9, depthWrite: false })
  );
  stars.frustumCulled = false;
  stars.renderOrder = -999;
  stars.onBeforeRender = (r, s, camera) => {
    stars.position.copy(camera.position);
    stars.updateMatrixWorld();
  };
  scene.add(stars);
  return stars;
}

/**
 * Flat ground plane at y = 0 that receives shadows.
 * @param {{size?:number, color?:number|string, color2?:number|string, checker?:boolean, tileSize?:number}} [opts]
 *   checker: two-tone squares of `tileSize` units (color2 defaults to a darker color).
 * @returns {THREE.Mesh}
 */
export function createGround({ size = 200, color = 0x7cc26b, color2, checker = false, tileSize = 4 } = {}) {
  const geo = new THREE.PlaneGeometry(size, size);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: checker ? 0xffffff : color, roughness: 0.95 });
  if (checker) {
    const c = document.createElement("canvas");
    c.width = c.height = 2;
    const ctx = c.getContext("2d");
    const a = `#${new THREE.Color(color).getHexString()}`;
    const b = `#${new THREE.Color(color2 ?? new THREE.Color(color).multiplyScalar(0.85)).getHexString()}`;
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, 2, 2);
    ctx.fillStyle = b;
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillRect(1, 1, 1, 1);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(size / (2 * tileSize), size / (2 * tileSize));
    mat.map = tex;
  }
  const ground = new THREE.Mesh(geo, mat);
  ground.name = "ground";
  ground.receiveShadow = true;
  return ground;
}

/** Linear fog between `near` and `far`. */
export function setFog(scene, color, near = 20, far = 120) {
  scene.fog = new THREE.Fog(color, near, far);
  return scene.fog;
}

/** Exponential fog (good for underwater/space haze). */
export function setFogExp(scene, color, density = 0.02) {
  scene.fog = new THREE.FogExp2(color, density);
  return scene.fog;
}

/**
 * Lights + sky + fog from a preset in one call.
 * @param {THREE.Scene} scene
 * @param {keyof LIGHT_PRESETS} [preset="day"]
 * @param {{sky?:boolean, fog?:boolean, fogNear?:number, fogFar?:number, stars?:boolean, shadows?:boolean, shadowArea?:number}} [opts]
 * @returns {{lights:ReturnType<typeof applyLighting>, sky:THREE.Mesh|null, stars:THREE.Points|null}}
 */
export function environment(scene, preset = "day", opts = {}) {
  const { sky = true, fog = true, fogNear = 30, fogFar = 110 } = opts;
  const p = presetOf(preset);
  const lights = applyLighting(scene, preset, opts);
  scene.background = new THREE.Color(p.bottom);
  const skyMesh = sky ? createSky(scene, { top: p.top, bottom: p.bottom }) : null;
  const wantStars = opts.stars ?? (preset === "night" || preset === "space");
  const stars = wantStars ? createStars(scene) : null;
  if (fog && preset !== "space") {
    if (preset === "underwater") setFogExp(scene, p.fog, 0.03);
    else setFog(scene, p.fog, fogNear, fogFar);
  }
  return { lights, sky: skyMesh, stars };
}
