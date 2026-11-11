/**
 * controls.js — camera controllers and a character controller.
 *
 * Each controller returns an object with `update(dt)`. Call it once per frame:
 * movement controllers in game.onUpdate, cameras in game.onLateUpdate (so they
 * see the final player position).
 *
 * @example
 * import { characterController, followCamera } from "./engine/index.js";
 * const ctrl = characterController(hero, game.input, { speed: 7, cameraRelativeTo: game.camera, onJump: () => sfx.play("jump") });
 * const cam = followCamera(game.camera, hero, { offset: [0, 7, 11] });
 * game.onUpdate((dt) => ctrl.update(dt));
 * game.onLateUpdate((dt) => cam.update(dt));
 */
import * as THREE from "three";
import { vec3, angleDamp, clamp } from "./math.js";

const UP = new THREE.Vector3(0, 1, 0);
const posOf = (t) => (t && t.isObject3D ? t.position : t);

/**
 * Smooth third-person/side/top camera that follows a target.
 * @param {THREE.Camera} camera
 * @param {THREE.Object3D|THREE.Vector3} target
 * @param {{offset?:number[], lerp?:number, lookAhead?:number, lookAtOffset?:number[], rotateWithTarget?:boolean}} [opts]
 *   offset: camera position relative to target (world space, or target-local when rotateWithTarget);
 *   lerp: smoothing speed (higher = tighter); lookAhead: seconds of target velocity to lead by.
 */
export function followCamera(camera, target, opts = {}) {
  const { lerp = 6, lookAhead = 0, rotateWithTarget = false } = opts;
  const offset = vec3(opts.offset ?? [0, 6, 10]);
  const lookAtOffset = vec3(opts.lookAtOffset ?? [0, 1, 0]);
  const look = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const lastPos = posOf(target).clone();
  const velocity = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function compute(dt) {
    const p = posOf(target);
    if (dt > 0) {
      tmp.subVectors(p, lastPos).divideScalar(dt);
      velocity.lerp(tmp, 1 - Math.exp(-5 * dt));
    }
    lastPos.copy(p);
    tmp.copy(offset);
    if (rotateWithTarget && target.isObject3D) tmp.applyAxisAngle(UP, target.rotation.y);
    desired.copy(p).add(tmp).addScaledVector(velocity, lookAhead);
    return tmp.copy(p).add(lookAtOffset).addScaledVector(velocity, lookAhead);
  }

  const ctrl = {
    offset,
    lookAtOffset,
    target,
    lerp,
    update(dt) {
      const lookTarget = compute(dt);
      const k = 1 - Math.exp(-ctrl.lerp * dt);
      camera.position.lerp(desired, k);
      look.lerp(lookTarget, k);
      camera.lookAt(look);
    },
    /** Jump straight to the target pose (use after teleports/restarts). */
    snap() {
      const lookTarget = compute(0);
      camera.position.copy(desired);
      look.copy(lookTarget);
      camera.lookAt(look);
    },
  };
  ctrl.snap();
  return ctrl;
}

/**
 * Top-down camera looking down at a target (slight tilt by default).
 * @param {{height?:number, tilt?:number, lerp?:number}} [opts] tilt = distance behind (+Z) the target
 */
export function topDownCamera(camera, target, { height = 18, tilt = 6, lerp = 6 } = {}) {
  return followCamera(camera, target, { offset: [0, height, tilt], lookAtOffset: [0, 0, 0], lerp });
}

/**
 * Orbit camera: drag to rotate, wheel/pinch to zoom. Implemented with pointer events.
 * @param {THREE.Camera} camera
 * @param {HTMLElement} dom usually game.canvas
 * @param {{target?:THREE.Vector3|THREE.Object3D|number[], distance?:number, minDistance?:number, maxDistance?:number,
 *   azimuth?:number, polar?:number, minPolar?:number, maxPolar?:number, rotateSpeed?:number, autoRotate?:number,
 *   damping?:number, enabled?:boolean}} [opts] angles in radians; polar 0 = straight down from above, PI/2 = horizon.
 */
export function orbitCamera(camera, dom, opts = {}) {
  const {
    minDistance = 2,
    maxDistance = 60,
    minPolar = 0.15,
    maxPolar = 1.45,
    rotateSpeed = 0.006,
    damping = 10,
  } = opts;
  const follow = opts.target && opts.target.isObject3D ? opts.target : null;
  const target = follow ? follow.position.clone() : vec3(opts.target ?? [0, 0, 0]);
  const goal = { azimuth: opts.azimuth ?? 0, polar: opts.polar ?? 1.0, distance: opts.distance ?? 12 };
  const cur = { ...goal };
  const pointers = new Map();
  let pinchStart = 0;
  let pinchDist = 0;
  const listeners = [];
  const on = (t, type, fn, o) => {
    t.addEventListener(type, fn, o);
    listeners.push(() => t.removeEventListener(type, fn, o));
  };

  const ctrl = {
    target,
    autoRotate: opts.autoRotate ?? 0,
    enabled: opts.enabled ?? true,
    get azimuth() {
      return goal.azimuth;
    },
    set azimuth(v) {
      goal.azimuth = v;
    },
    get polar() {
      return goal.polar;
    },
    set polar(v) {
      goal.polar = clamp(v, minPolar, maxPolar);
    },
    get distance() {
      return goal.distance;
    },
    set distance(v) {
      goal.distance = clamp(v, minDistance, maxDistance);
    },
    update(dt) {
      if (follow) target.copy(follow.position);
      goal.azimuth += ctrl.autoRotate * dt;
      const k = 1 - Math.exp(-damping * dt);
      cur.azimuth += (goal.azimuth - cur.azimuth) * k;
      cur.polar += (goal.polar - cur.polar) * k;
      cur.distance += (goal.distance - cur.distance) * k;
      const s = Math.sin(cur.polar) * cur.distance;
      camera.position.set(
        target.x + Math.sin(cur.azimuth) * s,
        target.y + Math.cos(cur.polar) * cur.distance,
        target.z + Math.cos(cur.azimuth) * s
      );
      camera.lookAt(target);
    },
    dispose() {
      listeners.forEach((off) => off());
    },
  };

  if (dom) {
    on(dom, "pointerdown", (e) => {
      if (!ctrl.enabled) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
        pinchDist = goal.distance;
      }
    });
    on(window, "pointermove", (e) => {
      const p = pointers.get(e.pointerId);
      if (!p || !ctrl.enabled) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 1) {
        goal.azimuth -= dx * rotateSpeed;
        goal.polar = clamp(goal.polar - dy * rotateSpeed, minPolar, maxPolar);
      } else if (pointers.size === 2 && pinchStart > 0) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        goal.distance = clamp((pinchDist * pinchStart) / Math.max(d, 1), minDistance, maxDistance);
      }
    });
    const up = (e) => pointers.delete(e.pointerId);
    on(window, "pointerup", up);
    on(window, "pointercancel", up);
    on(
      dom,
      "wheel",
      (e) => {
        if (!ctrl.enabled) return;
        e.preventDefault();
        goal.distance = clamp(goal.distance * (e.deltaY > 0 ? 1.1 : 0.9), minDistance, maxDistance);
      },
      { passive: false }
    );
  }
  ctrl.update(1);
  return ctrl;
}

function groundAt(ground, x, z) {
  return typeof ground === "function" ? ground(x, z) : ground ?? 0;
}

function clampBounds(p, bounds) {
  if (bounds == null) return;
  const b = typeof bounds === "number" ? { minX: -bounds, maxX: bounds, minZ: -bounds, maxZ: bounds } : bounds;
  p.x = clamp(p.x, b.minX, b.maxX);
  p.z = clamp(p.z, b.minZ, b.maxZ);
}

/**
 * First-person controls: click to lock the mouse, WASD to move, Space to jump,
 * Shift to sprint. On touch devices drag to look (pair with input.touchControls()).
 * @param {THREE.PerspectiveCamera} camera
 * @param {ReturnType<import("./input.js").createInput>} input
 * @param {{speed?:number, sensitivity?:number, height?:number, jumpSpeed?:number, gravity?:number,
 *   groundHeight?:number|((x:number,z:number)=>number), bounds?:number|object, body?:object, clickToLock?:boolean}} [opts]
 *   body: optional physics body (sphere) to drive instead of the built-in ground check.
 */
export function firstPersonController(camera, input, opts = {}) {
  const { speed = 6, sensitivity = 0.0022, height = 1.7, jumpSpeed = 8, gravity = 25, clickToLock = true, body = null } = opts;
  camera.rotation.order = "YXZ";
  const position = body ? body.object.position : camera.position.clone().setY(camera.position.y - height);
  if (body) body.friction = 0;
  const velocity = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();

  const ctrl = {
    yaw: camera.rotation.y,
    pitch: camera.rotation.x,
    position,
    velocity,
    onGround: false,
    enabled: true,
    speed,
    /** Unit vector the camera looks along on the XZ plane. */
    getForward(out = new THREE.Vector3()) {
      return out.set(-Math.sin(ctrl.yaw), 0, -Math.cos(ctrl.yaw));
    },
    update(dt) {
      if (!ctrl.enabled) return;
      const m = input.mouse;
      if (clickToLock && !input.pointerLocked && !input.isTouch && input.wasPressed("Mouse0")) input.lockPointer();
      if (input.pointerLocked || input.isDown("Mouse0")) {
        ctrl.yaw -= m.dx * sensitivity;
        ctrl.pitch -= m.dy * sensitivity;
      }
      ctrl.yaw -= input.gamepad.right.x * 2.5 * dt;
      ctrl.pitch += input.gamepad.right.y * 2.0 * dt;
      ctrl.pitch = clamp(ctrl.pitch, -1.45, 1.45);

      const move = input.moveVector();
      const sprint = input.isDown(["ShiftLeft", "ShiftRight"]) ? 1.6 : 1;
      ctrl.getForward(forward);
      right.set(-forward.z, 0, forward.x);
      const vx = (right.x * move.x + forward.x * move.y) * ctrl.speed * sprint;
      const vz = (right.z * move.x + forward.z * move.y) * ctrl.speed * sprint;

      if (body) {
        body.velocity.x = vx;
        body.velocity.z = vz;
        ctrl.onGround = body.onGround;
        if (ctrl.onGround && input.action("jump")) body.velocity.y = jumpSpeed;
        velocity.copy(body.velocity);
        camera.position.set(position.x, position.y + height, position.z);
      } else {
        velocity.x = vx;
        velocity.z = vz;
        velocity.y -= gravity * dt;
        if (ctrl.onGround && input.action("jump")) velocity.y = jumpSpeed;
        position.addScaledVector(velocity, dt);
        clampBounds(position, opts.bounds);
        const gy = groundAt(opts.groundHeight, position.x, position.z);
        ctrl.onGround = position.y <= gy + 1e-3;
        if (ctrl.onGround) {
          position.y = gy;
          velocity.y = Math.max(velocity.y, 0);
        }
        camera.position.set(position.x, position.y + height, position.z);
      }
      camera.rotation.set(ctrl.pitch, ctrl.yaw, 0);
    },
  };
  return ctrl;
}

/**
 * Third-person/top-down character movement on the XZ plane with jumping.
 * Faces the movement direction and calls object.userData.animate(t, speed01) if present.
 * @param {THREE.Object3D} object model with its pivot at the feet
 * @param {ReturnType<import("./input.js").createInput>} input
 * @param {{speed?:number, jumpSpeed?:number, gravity?:number, acceleration?:number, turnSpeed?:number,
 *   cameraRelativeTo?:THREE.Camera|null, groundHeight?:number|((x:number,z:number)=>number), body?:object|null,
 *   bounds?:number|{minX:number,maxX:number,minZ:number,maxZ:number}, canJump?:boolean,
 *   onJump?:()=>void, onLand?:()=>void}} [opts]
 *   body: a physics body for `object`; the controller then sets its velocity and world.step() moves it.
 */
export function characterController(object, input, opts = {}) {
  const { jumpSpeed = 9, gravity = 25, acceleration = 14, turnSpeed = 12, body = null, canJump = true } = opts;
  if (body) body.friction = 0;
  const velocity = body ? body.velocity : new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  let time = 0;
  let wasGrounded = true;

  const ctrl = {
    velocity,
    speed: opts.speed ?? 6,
    onGround: true,
    isMoving: false,
    enabled: true,
    /** Make the character jump now (ignores ground check). */
    jump(power = jumpSpeed) {
      velocity.y = power;
      ctrl.onGround = false;
      opts.onJump?.();
    },
    update(dt) {
      time += dt;
      const move = ctrl.enabled ? input.moveVector() : { x: 0, y: 0 };
      if (opts.cameraRelativeTo) {
        opts.cameraRelativeTo.getWorldDirection(forward);
        forward.y = 0;
        if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
        forward.normalize();
      } else forward.set(0, 0, -1);
      right.set(-forward.z, 0, forward.x);
      const tx = (right.x * move.x + forward.x * move.y) * ctrl.speed;
      const tz = (right.z * move.x + forward.z * move.y) * ctrl.speed;
      const k = 1 - Math.exp(-acceleration * dt);
      velocity.x += (tx - velocity.x) * k;
      velocity.z += (tz - velocity.z) * k;

      const p = object.position;
      if (body) {
        ctrl.onGround = body.onGround;
      } else {
        velocity.y -= gravity * dt;
        p.addScaledVector(velocity, dt);
        const gy = groundAt(opts.groundHeight, p.x, p.z);
        ctrl.onGround = p.y <= gy + 1e-3;
        if (ctrl.onGround) {
          p.y = gy;
          velocity.y = Math.max(velocity.y, 0);
        }
      }
      clampBounds(p, opts.bounds);
      if (ctrl.onGround && !wasGrounded) opts.onLand?.();
      wasGrounded = ctrl.onGround;
      if (ctrl.enabled && canJump && ctrl.onGround && input.action("jump")) ctrl.jump();

      const planar = Math.hypot(velocity.x, velocity.z);
      ctrl.isMoving = planar > 0.2;
      if (Math.hypot(tx, tz) > 0.1) object.rotation.y = angleDamp(object.rotation.y, Math.atan2(tx, tz), turnSpeed, dt);
      object.userData.animate?.(time, ctrl.onGround ? Math.min(planar / Math.max(ctrl.speed, 0.01), 1) : 0.3);
    },
  };
  return ctrl;
}
