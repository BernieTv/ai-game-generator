/**
 * animation.js — tweens, easing, idle motions, camera shake and timers.
 *
 * Everything here is driven by the shared `ticker`, which the game loop in
 * core.js advances every frame (and freezes while the game is paused).
 * You never need to call update yourself when you use createGame().
 *
 * @example
 * import { tween, bob, spin, shake, after, every } from "./engine/index.js";
 * tween(door, { "position.y": 3 }, { duration: 0.6, ease: "backOut" });
 * tween(mesh.material, { color: 0xff0000 }, { duration: 0.1, yoyo: true });
 * spin(coin, { speed: 3 });  bob(coin, { amplitude: 0.2 });
 * shake(game.camera, 0.4, 0.3);
 * const spawner = every(2, () => spawnEnemy());   // spawner.cancel() to stop
 * after(1.5, () => hud.toast("Go!"));
 */
import * as THREE from "three";

// --- Ticker ---------------------------------------------------------------

const systems = new Set(); // fn(dt, elapsed) — long-lived systems (particles, ...)
const beforeRender = new Set();
const afterRender = new Set();
const active = new Set(); // tweens, timers and idle motions (have .tick(dt) -> done?)

/**
 * The shared per-frame ticker. core.js calls `ticker.update(dt, elapsed)` after
 * your onUpdate callbacks, and `ticker.renderBegin()/renderEnd()` around render.
 */
export const ticker = {
  /** Register a per-frame function `fn(dt, elapsed)`. Returns an unsubscribe function. */
  add(fn) {
    systems.add(fn);
    return () => systems.delete(fn);
  },
  remove(fn) {
    systems.delete(fn);
  },
  /** Run `fn()` right before each render (undo it with onAfterRender). */
  onBeforeRender(fn) {
    beforeRender.add(fn);
    return () => beforeRender.delete(fn);
  },
  onAfterRender(fn) {
    afterRender.add(fn);
    return () => afterRender.delete(fn);
  },
  update(dt, elapsed = 0) {
    for (const item of [...active]) {
      if (!active.has(item)) continue;
      if (item.tick(dt)) active.delete(item);
    }
    for (const fn of [...systems]) fn(dt, elapsed);
  },
  renderBegin() {
    for (const fn of beforeRender) fn();
  },
  renderEnd() {
    for (const fn of afterRender) fn();
  },
};

/** Stop every tween, timer and idle motion (bob/spin/pulse/shake). Handy on restart. */
export function clearAnimations() {
  for (const item of [...active]) item.stop();
  active.clear();
}

// --- Easing ---------------------------------------------------------------

/** Easing functions mapping t in [0,1] to eased progress. Use by name or reference. */
export const ease = {
  linear: (t) => t,
  quadIn: (t) => t * t,
  quadOut: (t) => t * (2 - t),
  quadInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  cubicIn: (t) => t * t * t,
  cubicOut: (t) => --t * t * t + 1,
  cubicInOut: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  backOut: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  elasticOut: (t) =>
    t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  bounceOut: (t) => {
    const n = 7.5625;
    const d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

// --- Tweens ---------------------------------------------------------------

function resolvePath(root, path) {
  const parts = path.split(".");
  let obj = root;
  for (let i = 0; i < parts.length - 1; i++) {
    obj = obj?.[parts[i]];
    if (obj == null) return null;
  }
  const key = parts[parts.length - 1];
  return key in obj ? { obj, key } : null;
}

/** Flatten {position: {y: 2}} / {"position.y": 2} / {scale: [2,2,2]} into tracks. */
function buildTracks(target, props, prefix, tracks) {
  for (const [name, to] of Object.entries(props)) {
    const path = prefix ? `${prefix}.${name}` : name;
    const ref = resolvePath(target, path);
    if (!ref) continue;
    const current = ref.obj[ref.key];
    if (current && current.isColor) {
      tracks.push({ color: current, from: current.clone(), to: new THREE.Color(to) });
    } else if (Array.isArray(to) && current && typeof current === "object") {
      const keys = ["x", "y", "z", "w"].slice(0, to.length);
      keys.forEach((k, i) => buildTracks(target, { [k]: to[i] }, path, tracks));
    } else if (typeof to === "object" && to !== null) {
      buildTracks(target, to, path, tracks);
    } else if (typeof current === "number") {
      tracks.push({ obj: ref.obj, key: ref.key, from: current, to: Number(to) });
    }
  }
  return tracks;
}

/**
 * Animate numeric properties of `target` toward `props`.
 * Supports nested paths ("position.y" or {position: {y}}), arrays for vectors
 * ({scale: [2,2,2]}) and THREE.Color values ({color: 0xff0000}).
 * @param {object} target
 * @param {object} props
 * @param {{duration?:number, delay?:number, ease?:string|Function, yoyo?:boolean, loop?:boolean|number,
 *   onUpdate?:Function, onComplete?:Function}} [opts]
 * @returns {{stop():void, stopped:boolean, finished:Promise<void>}}
 */
export function tween(target, props, opts = {}) {
  const { duration = 0.5, delay = 0, yoyo = false, onUpdate, onComplete } = opts;
  const easeFn = typeof opts.ease === "function" ? opts.ease : ease[opts.ease] || ease.quadOut;
  let loops = opts.loop === true ? Infinity : Number(opts.loop) || 0;
  let tracks = null;
  let t = -delay;
  let forward = true;
  let resolveDone;
  const finished = new Promise((r) => (resolveDone = r));

  const handle = {
    stopped: false,
    finished,
    target,
    stop() {
      handle.stopped = true;
      active.delete(handle);
      resolveDone();
    },
    tick(dt) {
      if (handle.stopped) return true;
      t += dt;
      if (t < 0) return false;
      if (!tracks) tracks = buildTracks(target, props, "", []);
      const raw = duration > 0 ? Math.min(t / duration, 1) : 1;
      const k = easeFn(forward ? raw : 1 - raw);
      for (const tr of tracks) {
        if (tr.color) tr.color.copy(tr.from).lerp(tr.to, k);
        else tr.obj[tr.key] = tr.from + (tr.to - tr.from) * k;
      }
      onUpdate?.(k);
      if (raw < 1) return false;
      if (yoyo && forward) {
        forward = false;
        t = 0;
        return false;
      }
      if (loops > 0) {
        loops--;
        forward = true;
        t = 0;
        return false;
      }
      handle.stopped = true;
      resolveDone();
      onComplete?.();
      return true;
    },
  };
  active.add(handle);
  return handle;
}

/** Stop all running tweens on `target`. */
export function killTweensOf(target) {
  for (const item of active) if (item.target === target) item.stop();
}

// --- Idle motions -----------------------------------------------------------

function motion(target, tick) {
  const handle = {
    target,
    stopped: false,
    stop() {
      handle.stopped = true;
      active.delete(handle);
    },
    tick(dt) {
      if (handle.stopped || (target.parent === null && target.isObject3D && handle.age > 1)) return true;
      handle.age = (handle.age || 0) + dt;
      tick(dt, handle.age);
      return false;
    },
  };
  active.add(handle);
  return handle;
}

/**
 * Float an object up and down around its current position. Stops automatically
 * when the object is removed from the scene. @returns {{stop():void}}
 */
export function bob(object, { amplitude = 0.25, speed = 2, axis = "y", phase = Math.random() * 6 } = {}) {
  const base = object.position[axis];
  return motion(object, (dt, age) => {
    object.position[axis] = base + Math.sin(age * speed + phase) * amplitude;
  });
}

/** Rotate an object continuously (`speed` in radians/second). @returns {{stop():void}} */
export function spin(object, { speed = 1, axis = "y" } = {}) {
  return motion(object, (dt) => {
    object.rotation[axis] += speed * dt;
  });
}

/** Breathe the object's scale by ±`amount` (relative). @returns {{stop():void}} */
export function pulse(object, { amount = 0.1, speed = 3 } = {}) {
  const base = object.scale.clone();
  return motion(object, (dt, age) => {
    object.scale.copy(base).multiplyScalar(1 + Math.sin(age * speed) * amount);
  });
}

/**
 * Shake the camera for `duration` seconds. The offset is applied only while
 * rendering, so it never fights your camera controller.
 */
export function shake(camera, intensity = 0.3, duration = 0.3) {
  const offset = new THREE.Vector3();
  let left = duration;
  let applied = false;
  const removeBefore = ticker.onBeforeRender(() => {
    const k = Math.max(left / duration, 0) * intensity;
    offset.set((Math.random() - 0.5) * 2 * k, (Math.random() - 0.5) * 2 * k, 0);
    offset.applyQuaternion(camera.quaternion);
    camera.position.add(offset);
    applied = true;
  });
  const removeAfter = ticker.onAfterRender(() => {
    if (applied) camera.position.sub(offset);
    applied = false;
  });
  const handle = {
    stopped: false,
    stop() {
      handle.stopped = true;
      active.delete(handle);
      removeBefore();
      removeAfter();
    },
    tick(dt) {
      left -= dt;
      if (left <= 0 || handle.stopped) {
        removeBefore();
        removeAfter();
        return true;
      }
      return false;
    },
  };
  active.add(handle);
  return handle;
}

// --- Timers -----------------------------------------------------------------

/** Call `fn` once after `seconds` of (unpaused) game time. @returns {{cancel():void}} */
export function after(seconds, fn) {
  let left = seconds;
  const handle = {
    stopped: false,
    cancel() {
      handle.stopped = true;
      active.delete(handle);
    },
    tick(dt) {
      if (handle.stopped) return true;
      left -= dt;
      if (left > 0) return false;
      fn();
      return true;
    },
  };
  handle.stop = handle.cancel;
  active.add(handle);
  return handle;
}

/**
 * Call `fn(count)` every `seconds` of game time. Return `false` from fn to stop.
 * @returns {{cancel():void, interval:number}} — change `interval` to speed up a spawner.
 */
export function every(seconds, fn, { immediate = false } = {}) {
  let acc = immediate ? seconds : 0;
  let count = 0;
  const handle = {
    interval: seconds,
    stopped: false,
    cancel() {
      handle.stopped = true;
      active.delete(handle);
    },
    tick(dt) {
      if (handle.stopped) return true;
      acc += dt;
      let guard = 0;
      while (acc >= handle.interval && guard++ < 5) {
        acc -= handle.interval;
        if (fn(count++) === false || handle.stopped) return true;
      }
      if (guard >= 5) acc = 0;
      return false;
    },
  };
  handle.stop = handle.cancel;
  active.add(handle);
  return handle;
}
