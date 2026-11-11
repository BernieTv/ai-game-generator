/**
 * particles.js — pooled GPU point particles for bursts, trails, smoke and sparkles.
 *
 * One system = one draw call with up to `max` particles. Systems update
 * themselves through the game loop's ticker (no manual update needed) and
 * recycle dead particles automatically. Use `blending: "normal"` for smoke/dust,
 * the default additive blending for fire, magic, sparks and explosions.
 *
 * @example
 * import { createParticles } from "./engine/index.js";
 * const fx = createParticles(game.scene);
 * fx.burst(coin.position, { count: 30, color: [0xffd60a, 0xffffff], speed: 5 });
 * const trail = fx.emitter({ preset: "trail", follow: ship, color: 0x00e5ff });
 * trail.stop();   // later
 */
import * as THREE from "three";
import { ticker } from "./animation.js";
import { vec3 } from "./math.js";

const rangeOf = (v, fallback) => (v === undefined ? fallback : Array.isArray(v) ? v : [v, v]);
const rand = (r) => r[0] + Math.random() * (r[1] - r[0]);

/** Emitter presets: default options merged under yours. */
export const PARTICLE_PRESETS = {
  trail: { rate: 60, count: 1, speed: [0.1, 0.6], life: [0.3, 0.6], size: [0.25, 0.4], gravity: 0, color: 0x9be7ff },
  smoke: { rate: 18, count: 1, speed: [0.3, 0.9], life: [1.4, 2.2], size: [0.6, 1.1], gravity: 1.2, drag: 0.8, color: [0x888888, 0xaaaaaa], direction: [0, 1, 0], spread: 0.5, opacity: 0.5, grow: 1.8 },
  sparkle: { rate: 20, count: 1, speed: [0.2, 0.8], life: [0.6, 1.2], size: [0.1, 0.25], gravity: 0.3, color: [0xffffff, 0xfff3b0, 0xa0e7ff], radius: 0.6 },
  fire: { rate: 50, count: 1, speed: [0.8, 1.6], life: [0.4, 0.8], size: [0.35, 0.6], gravity: 2, color: [0xff6b00, 0xffb703, 0xff3d00], direction: [0, 1, 0], spread: 0.35, radius: 0.15 },
};

/**
 * @param {THREE.Object3D} scene parent to add the points to
 * @param {{max?:number, blending?:"additive"|"normal", autoUpdate?:boolean}} [opts]
 */
export function createParticles(scene, { max = 2000, blending = "additive", autoUpdate = true } = {}) {
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  const size = new Float32Array(max);
  const alpha = new Float32Array(max);
  const vel = new Float32Array(max * 3);
  const life = new Float32Array(max);
  const maxLife = new Float32Array(max);
  const baseSize = new Float32Array(max);
  const baseAlpha = new Float32Array(max);
  const grav = new Float32Array(max);
  const drag = new Float32Array(max);
  const grow = new Float32Array(max);
  let count = 0;

  const geo = new THREE.BufferGeometry();
  const attr = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("position", attr(pos, 3));
  geo.setAttribute("color", attr(col, 3));
  geo.setAttribute("size", attr(size, 1));
  geo.setAttribute("alpha", attr(alpha, 1));
  geo.setDrawRange(0, 0);

  const material = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 500 } },
    vertexShader: /* glsl */ `
      attribute float size; attribute float alpha; attribute vec3 color;
      uniform float uScale; varying vec3 vColor; varying float vAlpha;
      void main() {
        vColor = color; vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uScale / max(-mv.z, 0.1);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor; varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.15, d) * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor, a);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: blending === "normal" ? THREE.NormalBlending : THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 10;
  const drawSize = new THREE.Vector2();
  points.onBeforeRender = (renderer, s, camera) => {
    renderer.getDrawingBufferSize(drawSize);
    const fov = camera.isPerspectiveCamera ? camera.fov : 50;
    material.uniforms.uScale.value = drawSize.y / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
  };
  scene.add(points);

  const tmpColor = new THREE.Color();
  const tmpDir = new THREE.Vector3();
  const emitters = new Set();

  function spawn(p, o) {
    if (count >= max) return;
    const i = count++;
    const speed = rand(rangeOf(o.speed, [2, 5]));
    if (o.direction) {
      tmpDir.copy(vec3(o.direction)).normalize();
      const spread = o.spread ?? 0.4;
      tmpDir.x += (Math.random() - 0.5) * 2 * spread;
      tmpDir.y += (Math.random() - 0.5) * 2 * spread;
      tmpDir.z += (Math.random() - 0.5) * 2 * spread;
      tmpDir.normalize();
    } else tmpDir.randomDirection();
    const r = o.radius ?? 0;
    pos[i * 3] = p.x + (r ? (Math.random() - 0.5) * 2 * r : 0);
    pos[i * 3 + 1] = p.y + (r ? (Math.random() - 0.5) * 2 * r : 0);
    pos[i * 3 + 2] = p.z + (r ? (Math.random() - 0.5) * 2 * r : 0);
    vel[i * 3] = tmpDir.x * speed;
    vel[i * 3 + 1] = tmpDir.y * speed;
    vel[i * 3 + 2] = tmpDir.z * speed;
    const colors = Array.isArray(o.color) ? o.color : [o.color ?? 0xffffff];
    tmpColor.set(colors[Math.floor(Math.random() * colors.length)]);
    col[i * 3] = tmpColor.r;
    col[i * 3 + 1] = tmpColor.g;
    col[i * 3 + 2] = tmpColor.b;
    maxLife[i] = life[i] = Math.max(rand(rangeOf(o.life, [0.5, 1])), 0.01);
    baseSize[i] = size[i] = rand(rangeOf(o.size, [0.2, 0.4]));
    baseAlpha[i] = alpha[i] = o.opacity ?? 1;
    grav[i] = o.gravity ?? -9;
    drag[i] = o.drag ?? 0;
    grow[i] = o.grow ?? 0;
  }

  function kill(i) {
    const last = --count;
    if (i === last) return;
    for (let k = 0; k < 3; k++) {
      pos[i * 3 + k] = pos[last * 3 + k];
      vel[i * 3 + k] = vel[last * 3 + k];
      col[i * 3 + k] = col[last * 3 + k];
    }
    size[i] = size[last];
    alpha[i] = alpha[last];
    life[i] = life[last];
    maxLife[i] = maxLife[last];
    baseSize[i] = baseSize[last];
    baseAlpha[i] = baseAlpha[last];
    grav[i] = grav[last];
    drag[i] = drag[last];
    grow[i] = grow[last];
  }

  function update(dt) {
    for (const e of emitters) e._tick(dt);
    for (let i = count - 1; i >= 0; i--) {
      life[i] -= dt;
      if (life[i] <= 0) {
        kill(i);
        continue;
      }
      const t = life[i] / maxLife[i]; // 1 -> 0
      const d = drag[i] > 0 ? Math.max(0, 1 - drag[i] * dt) : 1;
      vel[i * 3] *= d;
      vel[i * 3 + 1] = vel[i * 3 + 1] * d + grav[i] * dt;
      vel[i * 3 + 2] *= d;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      alpha[i] = baseAlpha[i] * Math.min(1, t * 2.5);
      size[i] = grow[i] > 0 ? baseSize[i] * (1 + (1 - t) * grow[i]) : baseSize[i] * (0.35 + 0.65 * t);
    }
    geo.setDrawRange(0, count);
    for (const name of ["position", "color", "size", "alpha"]) geo.attributes[name].needsUpdate = true;
  }

  const unsubscribe = autoUpdate ? ticker.add(update) : null;

  const system = {
    points,
    get count() {
      return count;
    },
    /**
     * Emit `count` particles at once.
     * @param {THREE.Vector3|number[]} position
     * @param {{count?:number, color?:number|string|Array, speed?:number|[number,number], life?:number|[number,number],
     *   size?:number|[number,number], gravity?:number, drag?:number, direction?:number[], spread?:number,
     *   radius?:number, opacity?:number, grow?:number}} [opts]
     *   gravity is y acceleration (negative falls); direction+spread make a cone, otherwise all directions.
     */
    burst(position, opts = {}) {
      const n = opts.count ?? 24;
      const p = position && position.isVector3 ? position : vec3(position);
      for (let i = 0; i < n; i++) spawn(p, opts);
      return system;
    },
    /**
     * Continuous emitter. `follow` an Object3D or set `position`. preset: "trail"|"smoke"|"sparkle"|"fire".
     * @returns {{position:THREE.Vector3, follow:THREE.Object3D|null, rate:number, active:boolean, start():void, stop():void, remove():void}}
     */
    emitter(opts = {}) {
      const o = { ...(PARTICLE_PRESETS[opts.preset] || PARTICLE_PRESETS.trail), ...opts };
      let acc = 0;
      const em = {
        position: vec3(opts.position ?? [0, 0, 0]),
        follow: opts.follow || null,
        offset: vec3(opts.offset ?? [0, 0, 0]),
        rate: o.rate,
        active: true,
        options: o,
        start() {
          em.active = true;
        },
        stop() {
          em.active = false;
        },
        remove() {
          emitters.delete(em);
        },
        _tick(dt) {
          if (em.follow) {
            if (em.follow.parent === null && em.follow.isObject3D) return;
            em.follow.getWorldPosition(em.position).add(em.offset);
          }
          if (!em.active) return;
          acc += dt * em.rate;
          while (acc >= 1) {
            acc -= 1;
            for (let i = 0; i < (o.count ?? 1); i++) spawn(em.position, o);
          }
        },
      };
      emitters.add(em);
      return em;
    },
    /** Advance manually (only needed with autoUpdate: false). */
    update,
    /** Kill all live particles. */
    clear() {
      count = 0;
      geo.setDrawRange(0, 0);
    },
    dispose() {
      unsubscribe?.();
      emitters.clear();
      points.removeFromParent();
      geo.dispose();
      material.dispose();
    },
  };
  return system;
}
