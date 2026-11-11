/**
 * input.js — keyboard, mouse, touch and gamepad input with action mapping.
 *
 * createGame() already creates one for you as `game.input` and calls
 * `input.update()` at the end of every frame, so `wasPressed` means
 * "went down during this frame". Codes are KeyboardEvent.code values
 * ("KeyW", "Space", "ArrowLeft", "ShiftLeft"...) plus "Mouse0/1/2" for mouse
 * buttons (taps count as Mouse0) and "Pad0".."Pad15" for gamepad buttons.
 *
 * Default actions: up, down, left, right, jump (Space/Pad0), fire (Mouse0/KeyF/Pad2/Pad7),
 * pause (KeyP/Escape/Pad9). Rebind with input.bind(name, codes).
 *
 * @example
 * const { input } = game;
 * game.onUpdate((dt) => {
 *   const move = input.moveVector();            // {x, y} from WASD/arrows/stick/joystick
 *   player.position.x += move.x * 6 * dt;
 *   player.position.z -= move.y * 6 * dt;       // y = forward (screen up) -> -Z
 *   if (input.action("jump")) jump();
 *   if (input.wasPressed("KeyE")) interact();
 * });
 * input.touchControls({ buttons: [{ label: "Jump", action: "jump" }] }); // only on touch devices
 */
import * as THREE from "three";

const DEFAULT_BINDINGS = {
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  jump: ["Space", "Pad0"],
  fire: ["Mouse0", "KeyF", "Pad2", "Pad7"],
  pause: ["KeyP", "Escape", "Pad9"],
};

const PREVENT = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"]);

/** True when the device has a touch screen. */
export const isTouchDevice = () =>
  typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

/**
 * Create an input manager.
 * @param {HTMLElement} [dom] element that receives mouse/pointer input (usually the canvas).
 */
export function createInput(dom = document.body) {
  const down = new Set();
  const pressed = new Set();
  const released = new Set();
  const bindings = {};
  for (const [k, v] of Object.entries(DEFAULT_BINDINGS)) bindings[k] = [...v];

  const mouse = { x: 0, y: 0, ndcX: 0, ndcY: 0, dx: 0, dy: 0, wheel: 0, inside: false };
  const stick = { x: 0, y: 0 }; // gamepad left stick
  const stickRight = { x: 0, y: 0 };
  const joy = { x: 0, y: 0 }; // touch joystick
  let padDown = new Set();
  const listeners = [];
  let touchUi = null;

  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    listeners.push(() => target.removeEventListener(type, fn, opts));
  };
  const press = (code) => {
    if (!down.has(code)) {
      down.add(code);
      pressed.add(code);
    }
  };
  const release = (code) => {
    if (down.delete(code)) released.add(code);
  };
  const isTyping = (e) => {
    const t = e.target;
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  };

  on(window, "keydown", (e) => {
    if (isTyping(e)) return;
    if (PREVENT.has(e.code)) e.preventDefault();
    if (!e.repeat) press(e.code);
  });
  on(window, "keyup", (e) => release(e.code));
  on(window, "blur", () => {
    for (const code of [...down]) release(code);
  });

  const updatePointer = (e) => {
    const rect = dom.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.ndcX = rect.width ? (mouse.x / rect.width) * 2 - 1 : 0;
    mouse.ndcY = rect.height ? -(mouse.y / rect.height) * 2 + 1 : 0;
  };
  on(dom, "pointerdown", (e) => {
    updatePointer(e);
    press(`Mouse${e.button}`);
    mouse.pointerType = e.pointerType;
  });
  on(window, "pointerup", (e) => release(`Mouse${e.button}`));
  on(window, "pointercancel", () => release("Mouse0"));
  on(window, "pointermove", (e) => {
    updatePointer(e);
    mouse.pointerType = e.pointerType;
    // Accumulate deltas when locked, or while dragging/hovering on our element.
    if (document.pointerLockElement === dom || e.target === dom) {
      mouse.dx += e.movementX || 0;
      mouse.dy += e.movementY || 0;
    }
  });
  on(dom, "pointerenter", () => (mouse.inside = true));
  on(dom, "pointerleave", () => (mouse.inside = false));
  on(dom, "wheel", (e) => (mouse.wheel += Math.sign(e.deltaY)), { passive: true });
  on(dom, "contextmenu", (e) => e.preventDefault());

  const any = (codes, set) => {
    if (Array.isArray(codes)) return codes.some((c) => set.has(c));
    return set.has(codes);
  };
  const codesFor = (name) => [...(bindings[name] || []), `Action:${name}`];

  function pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && Array.from(pads).find((p) => p && p.connected);
    const now = new Set();
    stick.x = stick.y = stickRight.x = stickRight.y = 0;
    if (pad) {
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
      stick.x = dz(pad.axes[0] || 0);
      stick.y = -dz(pad.axes[1] || 0);
      stickRight.x = dz(pad.axes[2] || 0);
      stickRight.y = -dz(pad.axes[3] || 0);
      pad.buttons.forEach((b, i) => {
        if (b.pressed) now.add(`Pad${i}`);
      });
    }
    for (const c of now) if (!padDown.has(c)) press(c);
    for (const c of padDown) if (!now.has(c)) release(c);
    padDown = now;
  }

  const input = {
    mouse,
    /** Gamepad sticks, {x, y} in -1..1 (y up). */
    gamepad: { left: stick, right: stickRight },
    bindings,
    get isTouch() {
      return isTouchDevice();
    },

    /** Is any of the given code(s) held right now? */
    isDown: (codes) => any(codes, down),
    /** Did any of the code(s) go down this frame? */
    wasPressed: (codes) => any(codes, pressed),
    /** Did any of the code(s) go up this frame? */
    wasReleased: (codes) => any(codes, released),
    /** Was anything at all pressed this frame (key, click, tap, pad)? */
    anyPressed: () => pressed.size > 0,

    /** Bind an action name to a list of codes (replaces previous binding). */
    bind(name, codes) {
      bindings[name] = Array.isArray(codes) ? [...codes] : [codes];
      return input;
    },
    /** True on the frame an action was triggered (pressed). */
    action: (name) => any(codesFor(name), pressed),
    /** True while an action is held. */
    actionDown: (name) => any(codesFor(name), down),
    /** True on the frame an action was released. */
    actionReleased: (name) => any(codesFor(name), released),

    /** -1, 0 or 1 from two (sets of) codes, e.g. axis("KeyA", "KeyD"). */
    axis: (neg, pos) => (any(pos, down) ? 1 : 0) - (any(neg, down) ? 1 : 0),

    /**
     * Movement intent as {x, y} with length <= 1 (x = right, y = forward/up).
     * Combines the up/down/left/right actions, gamepad left stick and touch joystick.
     */
    moveVector() {
      let x = input.axis(codesFor("left"), codesFor("right")) + stick.x + joy.x;
      let y = input.axis(codesFor("down"), codesFor("up")) + stick.y + joy.y;
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      return { x, y };
    },

    /** Request pointer lock on the element (call from a click handler). */
    lockPointer() {
      try {
        const p = dom.requestPointerLock?.();
        if (p && p.catch) p.catch(() => {});
      } catch {
        /* not allowed right now */
      }
    },
    unlockPointer() {
      if (document.pointerLockElement) document.exitPointerLock?.();
    },
    get pointerLocked() {
      return document.pointerLockElement === dom;
    },

    /** Raycast from the pointer into `objects` (array or single Object3D). Returns intersections. */
    raycast(camera, objects, recursive = true) {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(mouse.ndcX, mouse.ndcY), camera);
      return ray.intersectObjects(Array.isArray(objects) ? objects : [objects], recursive);
    },

    /** Point where the pointer ray hits the horizontal plane y = `height` (or null). */
    pointerOnGround(camera, height = 0) {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(mouse.ndcX, mouse.ndcY), camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -height);
      return ray.ray.intersectPlane(plane, new THREE.Vector3());
    },

    /**
     * Show an on-screen joystick (left) and action buttons (right) on touch devices.
     * @param {{joystick?:boolean, buttons?:Array<{label:string, action?:string, code?:string}>, force?:boolean}} [opts]
     */
    touchControls({ joystick = true, buttons = [{ label: "A", action: "jump" }], force = false } = {}) {
      if ((!force && !isTouchDevice()) || touchUi || !document.body) return input;
      touchUi = buildTouchUi({ joystick, buttons, joy, press, release });
      return input;
    },

    /** Clear per-frame state. Call once at the END of each frame (createGame does this). */
    update() {
      pressed.clear();
      released.clear();
      mouse.dx = mouse.dy = mouse.wheel = 0;
      pollGamepad();
    },

    /** Release every held key/button (e.g. when showing a menu). */
    reset() {
      for (const code of [...down]) release(code);
      pressed.clear();
      released.clear();
    },

    dispose() {
      listeners.forEach((off) => off());
      listeners.length = 0;
      touchUi?.remove();
      touchUi = null;
    },
  };
  return input;
}

function buildTouchUi({ joystick, buttons, joy, press, release }) {
  const root = document.createElement("div");
  root.className = "pf-touch";
  if (joystick) {
    const base = document.createElement("div");
    base.className = "pf-joystick";
    const knob = document.createElement("div");
    knob.className = "pf-joystick-knob";
    base.appendChild(knob);
    root.appendChild(base);
    let id = null;
    const move = (e) => {
      const r = base.getBoundingClientRect();
      const radius = r.width / 2;
      let x = (e.clientX - (r.left + radius)) / radius;
      let y = (e.clientY - (r.top + radius)) / radius;
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      joy.x = x;
      joy.y = -y;
      knob.style.transform = `translate(${x * radius * 0.6}px, ${y * radius * 0.6}px)`;
    };
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      joy.x = joy.y = 0;
      knob.style.transform = "";
    };
    base.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      id = e.pointerId;
      base.setPointerCapture?.(id);
      move(e);
    });
    base.addEventListener("pointermove", (e) => e.pointerId === id && move(e));
    base.addEventListener("pointerup", end);
    base.addEventListener("pointercancel", end);
  }
  const wrap = document.createElement("div");
  wrap.className = "pf-touch-buttons";
  for (const b of buttons) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "pf-touch-button";
    el.textContent = b.label ?? b.action ?? b.code;
    const code = b.code || `Action:${b.action}`;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture?.(e.pointerId);
      press(code);
    });
    const up = () => release(code);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    wrap.appendChild(el);
  }
  root.appendChild(wrap);
  document.body.appendChild(root);
  return root;
}
