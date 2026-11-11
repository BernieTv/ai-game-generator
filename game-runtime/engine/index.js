/**
 * Playforge engine — a small toolkit of plain ES modules on top of three.js.
 *
 * Import everything from here (path relative to your HTML/JS file):
 * @example
 * import { THREE, createGame, environment, makeCharacter, createHud, sfx } from "./engine/index.js";
 *
 * Modules: core (game loop), input, controls (cameras + character), physics,
 * world (lights/sky/ground), materials, models, animation (tweens/timers),
 * particles, hud, audio, state (FSM + storage), math, debug.
 */
import * as THREE from "three";

export { THREE };
export * from "./core.js";
export * from "./input.js";
export * from "./controls.js";
export * from "./physics.js";
export * from "./world.js";
export * from "./materials.js";
export * from "./models.js";
export * from "./animation.js";
export * from "./particles.js";
export * from "./hud.js";
export * from "./audio.js";
export * from "./state.js";
export * from "./math.js";
export * from "./debug.js";
