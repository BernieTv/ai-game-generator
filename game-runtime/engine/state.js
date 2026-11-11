/**
 * state.js — a tiny game state machine and safe localStorage helpers.
 *
 * @example
 * import { createStateMachine, storage } from "./engine/index.js";
 * const fsm = createStateMachine({
 *   initial: "menu",
 *   states: {
 *     menu:     { enter: () => hud.screen({ title: "Go!", onStart: () => fsm.go("playing") }) },
 *     playing:  { enter: resetLevel, update: (dt) => tickGame(dt) },
 *     gameover: { enter: ({ score }) => { const { best } = storage.submitScore(score); showGameOver(score, best); } },
 *   },
 * });
 * game.onUpdate((dt) => fsm.update(dt));
 * fsm.go("gameover", { score: 42 });
 */

/**
 * @param {{initial:string, states:Record<string,{enter?:(payload:any, from:string|null)=>void,
 *   exit?:(to:string)=>void, update?:(dt:number, timeInState:number)=>void}>}} config
 * @returns {{readonly current:string, readonly previous:string|null, readonly time:number,
 *   is(name:string):boolean, go(name:string, payload?:any):void, update(dt:number):void}}
 */
export function createStateMachine({ initial, states = {} }) {
  let current = null;
  let previous = null;
  let time = 0;
  let depth = 0;

  const fsm = {
    get current() {
      return current;
    },
    get previous() {
      return previous;
    },
    /** Seconds spent in the current state. */
    get time() {
      return time;
    },
    is: (name) => current === name,
    /** Switch state: runs exit() of the old state, then enter(payload, from) of the new one. */
    go(name, payload) {
      if (!states[name]) throw new Error(`Unknown state "${name}"`);
      if (++depth > 20) {
        depth = 0;
        throw new Error("State machine: too many nested transitions");
      }
      try {
        if (current) states[current].exit?.(name);
        previous = current;
        current = name;
        time = 0;
        states[name].enter?.(payload, previous);
      } finally {
        depth--;
      }
    },
    /** Call every frame; forwards to the current state's update(dt, timeInState). */
    update(dt) {
      if (!current) return;
      time += dt;
      states[current].update?.(dt, time);
    },
  };
  if (initial) fsm.go(initial);
  return fsm;
}

const PREFIX = "pf:";

/** localStorage wrapper that never throws (private mode, sandboxed iframes...). Values are JSON. */
export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  },
  /** Best score saved under `key` (default 0). */
  getHighScore(key = "highscore") {
    return Number(storage.get(key, 0)) || 0;
  },
  /**
   * Save `score` if it beats the stored best.
   * @param {number} score
   * @param {{key?:string, lowerIsBetter?:boolean}} [opts] lowerIsBetter for race times
   * @returns {{best:number, isNew:boolean}}
   */
  submitScore(score, { key = "highscore", lowerIsBetter = false } = {}) {
    const stored = storage.get(key, null);
    const isNew = stored == null || (lowerIsBetter ? score < stored : score > stored);
    if (isNew) storage.set(key, score);
    return { best: isNew ? score : Number(stored), isNew };
  },
};
