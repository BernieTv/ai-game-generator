/**
 * debug.js — FPS meter and wireframe helpers for development.
 *
 * @example
 * import { fpsMeter, showPhysics, drawBox } from "./engine/index.js";
 * fpsMeter();                         // press ` (backtick) to toggle
 * showPhysics(game.scene, world);     // wireframes for every body, toggled with `
 * drawBox(game.scene, [0, 1, 0], [2, 2, 2], 0xff0000);
 */
import * as THREE from "three";
import { ticker } from "./animation.js";
import { vec3 } from "./math.js";

let debugVisible = false;
const toggles = new Set();
let keyInstalled = false;

function installKey(code) {
  if (keyInstalled || typeof window === "undefined") return;
  keyInstalled = true;
  window.addEventListener("keydown", (e) => {
    if (e.code !== code || e.repeat) return;
    debugVisible = !debugVisible;
    for (const fn of toggles) fn(debugVisible);
  });
}

/**
 * Small FPS / frame-time readout in the top-right corner.
 * @param {{key?:string, visible?:boolean}} [opts] key toggles visibility (default Backquote)
 */
export function fpsMeter({ key = "Backquote", visible = false } = {}) {
  const el = document.createElement("div");
  el.className = "pf-fps";
  document.body?.appendChild(el);
  debugVisible = debugVisible || visible;
  const apply = (v) => (el.style.display = v ? "block" : "none");
  apply(debugVisible);
  toggles.add(apply);
  installKey(key);
  let frames = 0;
  let last = performance.now();
  let rafId = 0;
  const loop = (now) => {
    rafId = requestAnimationFrame(loop);
    frames++;
    if (now - last >= 500) {
      const fps = (frames * 1000) / (now - last);
      el.textContent = `${fps.toFixed(0)} fps · ${(1000 / Math.max(fps, 1)).toFixed(1)} ms`;
      frames = 0;
      last = now;
    }
  };
  rafId = requestAnimationFrame(loop);
  return {
    el,
    dispose() {
      cancelAnimationFrame(rafId);
      toggles.delete(apply);
      el.remove();
    },
  };
}

/** Wireframe box (center, full size). Returns the helper; remove it with helper.removeFromParent(). */
export function drawBox(scene, center, size = [1, 1, 1], color = 0x00ff88) {
  const s = vec3(size);
  const helper = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(s.x, s.y, s.z)),
    new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true })
  );
  helper.position.copy(vec3(center));
  helper.renderOrder = 999;
  scene.add(helper);
  return helper;
}

/** Wireframe sphere. Returns the helper. */
export function drawSphere(scene, center, radius = 0.5, color = 0x00ff88) {
  const helper = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.SphereGeometry(radius, 10, 6)),
    new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true })
  );
  helper.position.copy(vec3(center));
  helper.renderOrder = 999;
  scene.add(helper);
  return helper;
}

/**
 * Keep wireframes in sync with every physics body (triggers yellow, static grey).
 * Hidden until the debug key (`) is pressed, unless visible: true.
 */
export function showPhysics(scene, world, { visible = false, key = "Backquote" } = {}) {
  const group = new THREE.Group();
  group.name = "physics-debug";
  scene.add(group);
  const helpers = new Map();
  debugVisible = debugVisible || visible;
  const apply = (v) => (group.visible = v);
  apply(debugVisible);
  toggles.add(apply);
  installKey(key);
  const tmp = new THREE.Vector3();
  const off = ticker.add(() => {
    if (!group.visible) return;
    const alive = new Set(world.bodies);
    for (const [b, h] of helpers) {
      if (!alive.has(b)) {
        h.removeFromParent();
        h.geometry.dispose();
        helpers.delete(b);
      }
    }
    for (const b of world.bodies) {
      let h = helpers.get(b);
      if (!h) {
        const color = b.isTrigger ? 0xffd60a : b.isStatic ? 0x999999 : 0x00ff88;
        h = b.shape === "sphere" ? drawSphere(group, [0, 0, 0], b.radius, color) : drawBox(group, [0, 0, 0], b.size, color);
        helpers.set(b, h);
      }
      h.position.copy(tmp.copy(b.object.position).add(b.offset));
      h.visible = b.enabled && b.object.parent !== null;
    }
  });
  return {
    group,
    dispose() {
      off();
      toggles.delete(apply);
      group.removeFromParent();
    },
  };
}
