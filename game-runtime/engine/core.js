/**
 * core.js — renderer, scene, camera and the game loop.
 *
 * createGame() builds a full-window WebGL canvas, a scene and a perspective
 * camera, creates `game.input`, and runs a requestAnimationFrame loop:
 *   onFrame (always) -> onUpdate (unpaused) -> animation ticker -> onLateUpdate -> render -> input.update()
 * dt is clamped (default 1/20 s) so a hiccup never teleports objects. The loop
 * auto-pauses while the tab is hidden, survives exceptions in your callbacks
 * (each distinct error is reported once), and sets window.__playforgeReady = true
 * after the first rendered frame.
 *
 * @example
 * import { createGame } from "./engine/index.js";
 * const game = createGame({ background: 0x87ceeb, camera: { position: [0, 6, 12] } });
 * const box = game.add(new THREE.Mesh(geo, mat));
 * game.onUpdate((dt, elapsed) => { box.rotation.y += dt; });
 * game.start();
 */
import * as THREE from "three";
import { createInput } from "./input.js";
import { ticker } from "./animation.js";
import { vec3 } from "./math.js";

/**
 * @param {object} [opts]
 * @param {HTMLElement} [opts.container=document.body]
 * @param {number|string|null} [opts.background=0x87ceeb] scene background color (null = transparent)
 * @param {{color?:number|string, near?:number, far?:number, density?:number}|null} [opts.fog]
 * @param {boolean} [opts.shadows=true]
 * @param {boolean} [opts.antialias=true]
 * @param {number} [opts.pixelRatioCap=2]
 * @param {number} [opts.maxDt=0.05] largest dt passed to updates (seconds)
 * @param {"aces"|"agx"|"none"} [opts.toneMapping="aces"]
 * @param {{fov?:number, near?:number, far?:number, position?:number[], lookAt?:number[]}} [opts.camera]
 */
export function createGame(opts = {}) {
  const {
    container = document.body,
    background = 0x87ceeb,
    fog = null,
    shadows = true,
    antialias = true,
    pixelRatioCap = 2,
    maxDt = 1 / 20,
    toneMapping = "aces",
  } = opts;
  const camOpts = { fov: 60, near: 0.1, far: 1000, position: [0, 6, 12], lookAt: [0, 0, 0], ...opts.camera };

  const renderer = new THREE.WebGLRenderer({ antialias, alpha: background == null, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping =
    toneMapping === "none" ? THREE.NoToneMapping : toneMapping === "agx" ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = !!shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = "pf-canvas";
  canvas.tabIndex = 0;
  (container || document.body).appendChild(canvas);

  const scene = new THREE.Scene();
  if (background != null) scene.background = new THREE.Color(background);
  if (fog) {
    const color = new THREE.Color(fog.color ?? background ?? 0xffffff);
    scene.fog = fog.density ? new THREE.FogExp2(color, fog.density) : new THREE.Fog(color, fog.near ?? 20, fog.far ?? 120);
  }

  const camera = new THREE.PerspectiveCamera(camOpts.fov, 1, camOpts.near, camOpts.far);
  camera.position.copy(vec3(camOpts.position));
  camera.lookAt(vec3(camOpts.lookAt));

  const input = createInput(canvas);
  const clock = { elapsed: 0, dt: 0, frame: 0, timeScale: 1 };
  const updates = new Set();
  const lateUpdates = new Set();
  const frames = new Set();
  const resizers = new Set();
  const size = { width: 1, height: 1 };
  let renderFn = (r, s, c) => r.render(s, c);
  let running = false;
  let paused = false;
  let autoPaused = false;
  let rafId = 0;
  let last = 0;
  let readyFlagged = false;
  const reported = new Set();

  function resize() {
    const isBody = !container || container === document.body;
    const w = Math.max(1, isBody ? window.innerWidth : container.clientWidth);
    const h = Math.max(1, isBody ? window.innerHeight : container.clientHeight);
    size.width = w;
    size.height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    for (const fn of resizers) fn(w, h);
  }
  resize();
  const ro = typeof ResizeObserver !== "undefined" && container !== document.body ? new ResizeObserver(resize) : null;
  ro?.observe(container);
  window.addEventListener("resize", resize);

  const onVisibility = () => {
    if (document.hidden) {
      if (!paused) {
        paused = true;
        autoPaused = true;
      }
    } else {
      last = performance.now();
      if (autoPaused) {
        paused = false;
        autoPaused = false;
      }
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  function report(err) {
    const key = String(err && err.message) + (err && err.stack ? err.stack.split("\n")[1] : "");
    if (reported.has(key)) return;
    reported.add(key);
    setTimeout(() => {
      throw err;
    }); // surfaces via window.onerror -> report.js, without killing the loop
  }
  const run = (set, dt) => {
    for (const fn of [...set]) {
      try {
        fn(dt, clock.elapsed);
      } catch (err) {
        report(err);
      }
    }
  };

  function frame(now) {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    const raw = Math.max(0, (now - last) / 1000);
    last = now;
    const dt = Math.min(raw, maxDt) * clock.timeScale;
    clock.dt = dt;
    run(frames, dt);
    if (!paused) {
      clock.elapsed += dt;
      clock.frame++;
      run(updates, dt);
      try {
        ticker.update(dt, clock.elapsed);
      } catch (err) {
        report(err);
      }
      run(lateUpdates, dt);
    }
    try {
      ticker.renderBegin();
      renderFn(renderer, scene, camera);
      ticker.renderEnd();
      if (!readyFlagged) {
        readyFlagged = true;
        window.__playforgeReady = true;
        window.dispatchEvent(new Event("playforge:ready"));
      }
    } catch (err) {
      report(err);
    }
    input.update();
  }

  const subscribe = (set) => (fn) => {
    set.add(fn);
    return () => set.delete(fn);
  };

  const game = {
    renderer,
    scene,
    camera,
    canvas,
    input,
    clock,
    /** Current canvas size in CSS pixels. */
    size,
    /** Add one or more objects to the scene. Returns the first one. */
    add(...objects) {
      for (const o of objects) if (o) scene.add(o);
      return objects[0];
    },
    /** Remove objects from their parent (usually the scene). */
    remove(...objects) {
      for (const o of objects) o?.removeFromParent();
    },
    /** fn(dt, elapsed) every unpaused frame. Returns an unsubscribe function. */
    onUpdate: subscribe(updates),
    /** fn(dt, elapsed) after onUpdate + animations (good for cameras). Returns unsubscribe. */
    onLateUpdate: subscribe(lateUpdates),
    /** fn(dt) every frame, even while paused (e.g. to toggle pause). Returns unsubscribe. */
    onFrame: subscribe(frames),
    /** fn(width, height) after the canvas is resized. Returns unsubscribe. */
    onResize: subscribe(resizers),
    /** Replace the render step, e.g. (renderer, scene, camera) => composer.render(). */
    setRender(fn) {
      renderFn = fn || ((r, s, c) => r.render(s, c));
    },
    start() {
      if (running) return game;
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(frame);
      return game;
    },
    pause() {
      paused = true;
      autoPaused = false;
    },
    resume() {
      paused = false;
      autoPaused = false;
      last = performance.now();
    },
    /** Toggle pause; returns the new paused state. */
    togglePause() {
      paused ? game.resume() : game.pause();
      return paused;
    },
    get isPaused() {
      return paused;
    },
    get elapsed() {
      return clock.elapsed;
    },
    dispose() {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      ro?.disconnect();
      input.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
  return game;
}
