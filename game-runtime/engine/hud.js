/**
 * hud.js — DOM overlay HUD: stats, bars, text, toasts, menus, crosshair, minimap.
 *
 * Styles live in style.css (classes prefixed `pf-`). Calls are cheap and
 * idempotent, so you can call `hud.score(...)` / `hud.bar(...)` every frame.
 * `text()` and `screen({ body })` accept HTML; `score()` values are plain text.
 *
 * @example
 * import { createHud } from "./engine/index.js";
 * const hud = createHud();
 * hud.screen({ title: "Coin Rush", subtitle: "Collect every coin!", button: "Play", onStart: startGame });
 * hud.score("Score", 120);
 * hud.bar("hp", { label: "Health", value: 70, max: 100, color: "#ff4d6d" });
 * hud.text("hint", "WASD to move · Space to jump", { position: "bottom" });
 * hud.toast("Level up!");
 */

const POSITIONS = ["top-left", "top", "top-right", "center", "bottom-left", "bottom", "bottom-right"];

/** @param {{parent?:HTMLElement}} [opts] */
export function createHud({ parent } = {}) {
  const host = parent || document.body;
  const root = document.createElement("div");
  root.className = "pf-hud";
  const zones = {};
  for (const p of POSITIONS) {
    const z = document.createElement("div");
    z.className = `pf-zone pf-zone-${p}`;
    root.appendChild(z);
    zones[p] = z;
  }
  const toasts = document.createElement("div");
  toasts.className = "pf-toasts";
  toasts.setAttribute("role", "status");
  toasts.setAttribute("aria-live", "polite");
  root.appendChild(toasts);
  host.appendChild(root);

  const items = new Map(); // id -> element
  let screenEl = null;
  let screenKeyHandler = null;
  let crosshairEl = null;

  const getItem = (id, className, zone) => {
    let el = items.get(id);
    if (!el) {
      el = document.createElement("div");
      items.set(id, el);
    }
    el.className = className;
    const target = zones[zone] || zones["top-left"];
    if (el.parentNode !== target) target.appendChild(el);
    return el;
  };
  const setText = (el, v) => {
    const s = String(v);
    if (el.textContent !== s) el.textContent = s;
  };

  const hud = {
    root,
    /**
     * Show a labeled number (score, coins, time...). Keyed by label.
     * @param {string} label
     * @param {string|number} value
     * @param {{position?:string, icon?:string}} [opts]
     */
    score(label, value, { position = "top-left", icon } = {}) {
      const el = getItem(`score:${label}`, "pf-stat", position);
      if (!el.firstChild) {
        el.innerHTML = '<span class="pf-stat-label"></span><span class="pf-stat-value"></span>';
      }
      setText(el.firstChild, icon ? `${icon} ${label}` : label);
      setText(el.lastChild, value);
      return el;
    },
    /**
     * Progress / health bar. Later calls may pass only changed fields.
     * @param {string} id
     * @param {{label?:string, value?:number, max?:number, color?:string, position?:string}} opts
     */
    bar(id, opts = {}) {
      let el = items.get(`bar:${id}`);
      const state = (el && el._state) || { label: id, value: 100, max: 100, color: "#4ade80", position: "top-left" };
      Object.assign(state, opts);
      el = getItem(`bar:${id}`, "pf-bar", state.position);
      el._state = state;
      if (!el.firstChild) {
        el.innerHTML = '<span class="pf-bar-label"></span><div class="pf-bar-track"><div class="pf-bar-fill"></div></div>';
        el.setAttribute("role", "progressbar");
      }
      setText(el.firstChild, state.label);
      const pct = Math.max(0, Math.min(1, state.value / (state.max || 1))) * 100;
      const fill = el.querySelector(".pf-bar-fill");
      fill.style.width = `${pct}%`;
      fill.style.background = state.color;
      el.setAttribute("aria-valuenow", String(Math.round(state.value)));
      el.setAttribute("aria-valuemax", String(state.max));
      return el;
    },
    /**
     * Free-form HTML text block. Pass `null` as html to remove it.
     * @param {string} id
     * @param {string|null} html
     * @param {{position?:"top-left"|"top"|"top-right"|"center"|"bottom-left"|"bottom"|"bottom-right", className?:string}} [opts]
     */
    text(id, html, { position = "top", className = "" } = {}) {
      if (html == null) return hud.remove(id);
      const el = getItem(`text:${id}`, `pf-text ${className}`.trim(), position);
      if (el._html !== html) {
        el.innerHTML = html;
        el._html = html;
      }
      return el;
    },
    /** Remove a score/bar/text by id (or label for scores). */
    remove(id) {
      for (const key of [`text:${id}`, `bar:${id}`, `score:${id}`, id]) {
        const el = items.get(key);
        if (el) {
          el.remove();
          items.delete(key);
        }
      }
    },
    /** Short message that fades out after `ms`. */
    toast(message, ms = 1600) {
      const el = document.createElement("div");
      el.className = "pf-toast";
      el.textContent = message;
      toasts.appendChild(el);
      while (toasts.children.length > 4) toasts.firstChild.remove();
      setTimeout(() => el.classList.add("pf-out"), Math.max(ms - 300, 0));
      setTimeout(() => el.remove(), ms);
      return el;
    },
    /**
     * Full-screen menu (start / pause / game over). The button (or Enter/Space) closes it and calls onStart.
     * The click also unlocks audio. Returns {close()}.
     * @param {{title?:string, subtitle?:string, body?:string, button?:string|null, onStart?:()=>void, dim?:boolean}} opts
     *   body: extra HTML (e.g. controls help, high score); button: null for a screen without a button.
     */
    screen({ title = "", subtitle = "", body = "", button = "Play", onStart, dim = true } = {}) {
      hud.hideScreen();
      const el = document.createElement("div");
      el.className = `pf-screen${dim ? "" : " pf-screen-clear"}`;
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.innerHTML = `<div class="pf-panel">
        ${title ? `<h1 class="pf-title"></h1>` : ""}
        ${subtitle ? `<p class="pf-subtitle"></p>` : ""}
        ${body ? `<div class="pf-body">${body}</div>` : ""}
        ${button ? `<button type="button" class="pf-button"></button>` : ""}
      </div>`;
      if (title) el.querySelector(".pf-title").textContent = title;
      if (subtitle) el.querySelector(".pf-subtitle").textContent = subtitle;
      root.appendChild(el);
      screenEl = el;
      const close = () => {
        if (screenEl !== el) return;
        hud.hideScreen();
        onStart?.();
      };
      if (button) {
        const btn = el.querySelector(".pf-button");
        btn.textContent = button;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          close();
        });
        setTimeout(() => btn.focus({ preventScroll: true }), 0);
        screenKeyHandler = (e) => {
          if (e.code === "Enter" || e.code === "Space" || e.code === "NumpadEnter") {
            e.preventDefault();
            e.stopImmediatePropagation();
            close();
          }
        };
        // capture so the keypress doesn't also trigger an in-game action this frame
        window.addEventListener("keydown", screenKeyHandler, true);
      }
      return { el, close };
    },
    /** Close the current screen without calling onStart. */
    hideScreen() {
      if (screenKeyHandler) window.removeEventListener("keydown", screenKeyHandler, true);
      screenKeyHandler = null;
      screenEl?.remove();
      screenEl = null;
    },
    get screenOpen() {
      return !!screenEl;
    },
    /** Show/hide a center crosshair. */
    crosshair(show = true) {
      if (show && !crosshairEl) {
        crosshairEl = document.createElement("div");
        crosshairEl.className = "pf-crosshair";
        root.appendChild(crosshairEl);
      } else if (!show && crosshairEl) {
        crosshairEl.remove();
        crosshairEl = null;
      }
    },
    /**
     * Small radar in a corner. Call draw() every frame.
     * @param {{size?:number, range?:number, position?:string}} [opts] range = world units from center to edge
     * @returns {{draw(center:{x:number,z:number}, dots:Array<{x:number,z:number,color?:string,size?:number}>, heading?:number):void, remove():void}}
     */
    minimap({ size = 120, range = 40, position = "top-right" } = {}) {
      const canvas = document.createElement("canvas");
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.height = size * dpr;
      canvas.className = "pf-minimap";
      canvas.style.width = canvas.style.height = `${size}px`;
      (zones[position] || zones["top-right"]).appendChild(canvas);
      const ctx = canvas.getContext("2d");
      return {
        draw(center, dots = [], heading = 0) {
          if (!ctx) return;
          const s = size * dpr;
          const half = s / 2;
          ctx.clearRect(0, 0, s, s);
          ctx.fillStyle = "rgba(10,14,30,0.55)";
          ctx.beginPath();
          ctx.arc(half, half, half - 1, 0, Math.PI * 2);
          ctx.fill();
          for (const d of dots) {
            const x = half + ((d.x - center.x) / range) * half;
            const y = half + ((d.z - center.z) / range) * half;
            if (Math.hypot(x - half, y - half) > half - 3) continue;
            ctx.fillStyle = d.color || "#ff5d73";
            ctx.beginPath();
            ctx.arc(x, y, (d.size || 3) * dpr, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.save();
          ctx.translate(half, half);
          ctx.rotate(Math.PI - heading); // heading = rotation.y of a +Z-facing object
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.moveTo(0, -6 * dpr);
          ctx.lineTo(4 * dpr, 4 * dpr);
          ctx.lineTo(-4 * dpr, 4 * dpr);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        },
        remove: () => canvas.remove(),
      };
    },
    /** Remove all stats, bars, texts, toasts, screen and crosshair. */
    clear() {
      for (const el of items.values()) el.remove();
      items.clear();
      toasts.innerHTML = "";
      hud.hideScreen();
      hud.crosshair(false);
    },
    show() {
      root.style.display = "";
    },
    hide() {
      root.style.display = "none";
    },
    dispose() {
      hud.hideScreen();
      root.remove();
    },
  };
  return hud;
}
