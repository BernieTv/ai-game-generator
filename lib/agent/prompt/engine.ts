/**
 * Reference manual for the Playforge game engine (game-runtime/engine), given to the
 * agent that writes games into the sandbox. Keep in sync with game-runtime/engine/*.js.
 */
export const enginePrompt = `# Playforge engine reference

The sandbox is served as static files by a plain HTTP server: no bundler, no npm, no node_modules.
Write plain ES modules. three.js r170 is loaded from a CDN through an import map, so import it with the
bare specifiers "three" and "three/addons/..." only. Everything else comes from the engine toolkit
already in the sandbox. The engine is a toolkit you compose, not a framework: you still own the scene.

## Files present at the start
- index.html: placeholder page (rewrite it, keeping the rules below).
- style.css: full-screen canvas + HUD styles (classes pf-*). Keep it linked; add your own CSS after it.
- report.js: error reporter for the Playforge preview. Never edit, never remove.
- welcome.js: placeholder "Your game is on its way" scene. Replace it with your own entry (main.js).
- engine/index.js and engine/*.js: the toolkit described below. Do not edit engine files; build on them.

## index.html (use this skeleton)
\`\`\`html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    <title>My Game</title>
    <link rel="stylesheet" href="./style.css" />
    <script src="./report.js"></script>
    <script type="importmap">
      { "imports": {
          "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
          "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/" } }
    </script>
  </head>
  <body>
    <script type="module" src="./main.js"></script>
  </body>
</html>
\`\`\`
Rules: report.js must stay the FIRST script; keep the import map exactly; load your code as type="module".

## Importing
From main.js (next to index.html): \`import { THREE, createGame, ... } from "./engine/index.js";\`
From src/foo.js: \`import { ... } from "../engine/index.js";\`. \`THREE\` is re-exported (same as \`import * as THREE from "three"\`).
Addons: \`import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";\` (rarely needed: prefer procedural models).

## Conventions
- Units are meters-ish; y is up. Ground is y = 0. Models face +Z and have their pivot at the feet
  (coins/gems are centered). To face a direction: \`obj.rotation.y = Math.atan2(dir.x, dir.z)\` or \`obj.lookAt(x, y, z)\`.
- \`dt\` is in seconds (clamped to 0.05). Vectors may be passed as \`[x, y, z]\` or THREE.Vector3 almost everywhere.
- Colors: 0xff8800, "#ff8800" or CSS names.

## core.js
createGame(opts?) -> game. opts: { container=document.body, background=0x87ceeb (null = transparent), fog: {color, near, far} | {color, density},
  shadows=true, antialias=true, pixelRatioCap=2, maxDt=0.05, toneMapping: "aces"|"agx"|"none",
  camera: { fov=60, near=0.1, far=1000, position=[0,6,12], lookAt=[0,0,0] } }
game: renderer, scene, camera, canvas, input (see input.js), clock {elapsed, dt, frame, timeScale}, size {width, height}, elapsed
- add(...objs) -> first obj (adds to scene); remove(...objs) (removes from parent)
- onUpdate(fn(dt, elapsed)), onLateUpdate(fn) (after updates + animations: cameras go here),
  onFrame(fn(dt)) (runs even while paused), onResize(fn(w, h)); each returns an unsubscribe function
- setRender(fn(renderer, scene, camera)) replaces the render step (post-processing)
- start(), pause(), resume(), togglePause() -> paused, isPaused, dispose()
Frame order: onFrame -> onUpdate -> animations/particles -> onLateUpdate -> render -> input.update().
The loop auto-pauses when the tab is hidden, survives exceptions (each reported once) and sets
window.__playforgeReady = true after the first frame. Set clock.timeScale for slow motion.

## input.js (game.input is created for you; never call input.update() yourself)
Codes are KeyboardEvent.code ("KeyW", "Space", "ArrowUp", "ShiftLeft", "Enter", "Escape"), "Mouse0/1/2" (taps = Mouse0), "Pad0".."Pad15".
- isDown(code|codes), wasPressed(code|codes) (this frame), wasReleased(code|codes), anyPressed()
- bind(action, codes); action(name) (pressed this frame), actionDown(name) (held), actionReleased(name)
  default actions: up/down/left/right (WASD + arrows), jump (Space, Pad0), fire (Mouse0, KeyF, Pad2, Pad7), pause (KeyP, Escape, Pad9)
- axis(negCodes, posCodes) -> -1|0|1
- moveVector() -> {x, y}, length <= 1, x = right, y = forward. Merges keys, gamepad stick and touch joystick.
  On the XZ plane: \`pos.x += v.x * speed * dt; pos.z -= v.y * speed * dt;\`
- mouse: {x, y (px), ndcX, ndcY (-1..1), dx, dy (movement this frame), wheel}; gamepad: {left: {x,y}, right: {x,y}}
- lockPointer() (call after a click), unlockPointer(), pointerLocked
- raycast(camera, objects) -> intersections under the pointer; pointerOnGround(camera, height=0) -> Vector3|null
- touchControls({ joystick=true, buttons=[{label, action} | {label, code}], force=false }): on-screen joystick + buttons,
  only shown on touch devices. Buttons trigger action(name) / the code. isTouch: boolean. reset(): release everything.
createInput(dom) and isTouchDevice() are also exported.

## controls.js (each returns a controller with update(dt); call it every frame)
- characterController(object, input, { speed=6, jumpSpeed=9, gravity=25, acceleration=14, turnSpeed=12,
  cameraRelativeTo: camera|null, groundHeight: number | (x,z)=>y (default 0), body: physicsBody|null,
  bounds: halfSize | {minX,maxX,minZ,maxZ}, canJump=true, onJump(), onLand() })
  -> { update(dt), velocity, onGround, isMoving, speed, enabled, jump(power?) }. Moves on XZ with moveVector, jumps on
  action("jump"), turns to face movement, calls object.userData.animate(t, speed01). With \`body\`, it only sets the body's
  velocity; world.step(dt) moves it and handles collisions.
- followCamera(camera, target, { offset=[0,6,10], lerp=6, lookAhead=0, lookAtOffset=[0,1,0], rotateWithTarget=false })
  -> { update(dt), snap(), offset, lookAtOffset, lerp }. Third-person / side-scroller (offset [0,2,14]) / chase cam (rotateWithTarget).
- topDownCamera(camera, target, { height=18, tilt=6, lerp=6 }) -> same as followCamera.
- orbitCamera(camera, dom, { target: Vector3|Object3D|[x,y,z], distance=12, minDistance=2, maxDistance=60, azimuth=0, polar=1,
  minPolar=0.15, maxPolar=1.45, rotateSpeed, autoRotate=0, damping=10 }) -> { update(dt), target, azimuth, polar, distance,
  autoRotate, enabled, dispose() }. Drag to rotate, wheel/pinch to zoom.
- firstPersonController(camera, input, { speed=6, sensitivity=0.0022, height=1.7, jumpSpeed=8, gravity=25,
  groundHeight, bounds, body, clickToLock=true }) -> { update(dt), yaw, pitch, position (feet), velocity, onGround,
  getForward(out?) }. Click locks the mouse, Shift sprints, touch: drag to look. Pair with hud.crosshair().

## physics.js (arcade: spheres + axis-aligned boxes, no rotation)
createPhysicsWorld({ gravity=-20 | [x,y,z], ground=null (y of an infinite floor), substeps=auto }) -> world
- world.add({ object, shape: "sphere"|"box", radius, size: [w,h,d]|number, offset: [x,y,z], velocity, mass=1,
  isStatic, kinematic, restitution=0, friction=0.3, damping=0, gravityScale (1; 0 for triggers), isTrigger,
  layer=1, mask=0xffffffff, onCollide(other, {normal, depth, trigger}), onEnter(other), onExit(other), userData }) -> body
  Omit radius/size to auto-fit the object's bounds (position the object and add it to the scene first).
  For a character with feet pivot: { shape: "sphere", radius: 0.5, offset: [0, 0.5, 0] }.
- body: { object, velocity, onGround, enabled, contacts, userData, remove() }. Set body.velocity.y = 9 to jump.
- world.step(dt) once per frame (in onUpdate); world.remove(body) (safe inside callbacks); world.clear()
- world.raycast(origin, dir, maxDist?, { mask, ignore, includeTriggers }) -> { body|null, point, distance } | null
- world.groundHeight(position) -> y of the surface below; world.query(position, radius) -> bodies overlapping
- world.bodies, world.gravity, world.ground. Bodies whose object was removed from the scene are ignored.
onCollide fires every step while touching (triggers too); onEnter/onExit fire once per contact change.

## world.js
- environment(scene, preset="day", { sky=true, fog=true, fogNear=30, fogFar=110, stars, shadows=true, shadowArea=60 })
  -> { lights, sky, stars }. Presets: "day", "sunset", "night", "studio", "underwater", "space".
- applyLighting(scene, preset, { shadows, shadowArea=60, shadowMapSize=2048, intensity=1 }) -> { hemi, sun, follow(pos), dispose() }.
  Shadows only cover shadowArea around the sun target: in big levels call lights.follow(player.position) each frame.
- createSky(scene, { top, bottom, exponent=0.7, offset=0.05 }) gradient dome (raise offset if the camera looks down a lot)
- createStars(scene, { count=1500 }), createGround({ size=200, color, checker=false, color2, tileSize=4 }) -> Mesh (add it)
- setFog(scene, color, near, far), setFogExp(scene, color, density), LIGHT_PRESETS

## materials.js (each call returns a new material)
flat(color, extra?) flat-shaded low-poly (default choice) · toon(color) cel shading · glow(color, intensity=1.5) emissive ·
standard({ color, roughness, metalness, ... }) · glass(color, opacity=0.35) · unlit(color)
PALETTES.{pastel, neon, retro, forest, desert, ocean, candy, mono} (arrays of hex) · pick(palette|name, i?) · shade(color, +-amount)

## models.js (procedural low-poly THREE.Group's with shadows on)
makeCharacter({ color, accent, skin, scale }) (~1.8 tall; userData.animate(t, speed01) walk cycle; userData.parts) ·
makeTree({ height=3, style: "pine"|"round", color, rng }) · makeRock({ size, color, seed }) · makeCrate({ size, color }) ·
makeCoin({ radius=0.4, color }) · makeGem({ size, color }) · makeCar({ color, accent }) (userData.wheels, animate) ·
makeSpaceship({ color, accent, engineColor }) (centered, userData.engine) · makeEnemyBlob({ color, size }) (animate) ·
makeHouse({ color, roofColor, width, depth, height }) · makePlatform({ width, depth, height, color, topColor }) (top at y=height) ·
makeVoxel({ size, color }) · makeVoxelModel(layers, colors, { size=0.25 }) (layers[y][z] strings, one char per voxel, "." empty)
scatter(parent, (rng, i) => object, { count=20, area=40 (half-size) | {minX,maxX,minZ,maxZ}, seed, avoid: [{x,z,radius}] | (x,z)=>bool,
  minDistance, y: number | (x,z)=>y, scale=[0.8,1.2], rotate=true }) -> objects
jitter(geometry, amount=0.1, seed) organic vertex noise · enableShadows(object)
Build anything else from THREE primitives + flat() materials (set mesh.castShadow = true).

## animation.js (driven by the game loop; frozen while paused)
- tween(target, props, { duration=0.5, delay=0, ease="quadOut", yoyo, loop: true|n, onUpdate, onComplete }) -> { stop(), finished }
  props: { "position.y": 3 } or { position: { y: 3 } }, vectors as arrays { scale: [2,2,2] }, colors { "material.color": 0xff0000 }
- ease.{linear, quadIn, quadOut, quadInOut, cubicIn, cubicOut, cubicInOut, sineInOut, backOut, elasticOut, bounceOut}
- killTweensOf(target), clearAnimations() (stops every tween/timer/motion: call on restart if needed)
- bob(obj, { amplitude=0.25, speed=2 }), spin(obj, { speed=1, axis="y" }), pulse(obj, { amount=0.1, speed=3 }) -> { stop() }
  (auto-stop once the object is removed from the scene)
- shake(camera, intensity=0.3, duration=0.3) (applied only during render, safe with camera controllers)
- after(seconds, fn) -> { cancel() }; every(seconds, fn(count), { immediate }) -> { cancel(), interval } (return false to stop)
- ticker.add(fn(dt, elapsed)) -> unsubscribe: register your own per-frame system

## particles.js
createParticles(scene, { max=2000, blending: "additive"|"normal" }) -> fx (auto-updated)
- fx.burst(position, { count=24, color: c | [c...], speed=[2,5], life=[0.5,1], size=[0.2,0.4], gravity=-9, drag, direction, spread=0.4,
  radius, opacity, grow }) (ranges are number or [min,max])
- fx.emitter({ preset: "trail"|"smoke"|"sparkle"|"fire", follow: object, offset, position, rate, ...burst options })
  -> { position, follow, rate, active, start(), stop(), remove() }
- fx.clear(), fx.dispose(), fx.count. Use a second system with blending "normal" for smoke/dust.

## hud.js (DOM overlay; safe to call every frame)
createHud() -> hud
- score(label, value, { position="top-left", icon }) · bar(id, { label, value, max=100, color, position })
- text(id, html|null, { position: "top-left"|"top"|"top-right"|"center"|"bottom-left"|"bottom"|"bottom-right", className })
  (className "pf-hero" = big title with <h1>/<p>; "pf-plain" = no panel) · remove(id)
- toast(message, ms=1600)
- screen({ title, subtitle, body (HTML, e.g. <kbd>W</kbd>), button="Play" (null = no button), onStart, dim=true }) -> { close() }
  The button, Enter or Space closes it and calls onStart. hideScreen(), screenOpen
- crosshair(show=true) · minimap({ size=120, range=40, position="top-right" }) -> { draw(center, [{x, z, color, size}], heading), remove() }
- clear(), show(), hide(), root

## audio.js (synthesized, no files; unlocked automatically by the first click/key; M toggles mute)
- sfx.play("jump"|"coin"|"hit"|"explosion"|"shoot"|"powerup"|"click"|"lose"|"win"|"step", { volume=1, pitch=1 })
- sfx.tone({ freq, to, duration, type, volume }), sfx.define(name, (ctx, destination, volume, pitch) => {...}), sfx.setVolume(v)
- music.start({ style: "arp"|"drone", tempo=110, root=57, volume=0.25 }) (waits for unlock), music.stop(), music.setVolume(v)
- setMuted(bool), isMuted(), unlockAudio(), isAudioUnlocked()

## state.js
- createStateMachine({ initial, states: { name: { enter(payload, from), exit(to), update(dt, timeInState) } } })
  -> { current, previous, time, is(name), go(name, payload), update(dt) }
- storage.get(key, fallback), set(key, value), remove(key) (JSON, never throws);
  storage.getHighScore(key="highscore"), storage.submitScore(score, { key, lowerIsBetter }) -> { best, isNew }

## math.js
clamp(v, min, max), lerp, inverseLerp, remap(v, a1, b1, a2, b2), damp(cur, target, lambda, dt) (smooth follow),
dampVec3(vec, target, lambda, dt), wrapAngle, angleLerp, angleDamp, randRange(min, max, rng?), randInt(min, max, rng?) (inclusive),
choose(arr), shuffle(arr), seededRandom(seed) -> rng, vec3(x|[x,y,z]|number), distXZ(a, b) (points or objects),
yawTo(from, to), randomInCircle(radius), noise2D(x, y, seed) (0..1), fbm2D(x, y, { octaves, seed })

## debug.js
fpsMeter() (toggle with the \` key) · showPhysics(scene, world, { visible }) wireframes for all bodies ·
drawBox(scene, center, size, color) · drawSphere(scene, center, radius, color)

## Example main.js (complete game: collect coins, avoid blobs, start screen, score, game over, restart)
\`\`\`js
import { THREE, createGame, environment, createGround, makeCharacter, makeCoin, makeEnemyBlob, makeTree, scatter,
  characterController, followCamera, createParticles, createHud, createStateMachine, storage, sfx, music, spin, shake,
  randRange, distXZ } from "./engine/index.js";

const game = createGame({ camera: { fov: 55 } });
environment(game.scene, "day");
game.add(createGround({ color: 0x7cc26b }));
scatter(game.scene, (rng) => makeTree({ rng }), { count: 40, area: 50, avoid: [{ x: 0, z: 0, radius: 24 }] });
const hero = game.add(makeCharacter({ color: 0x3a86ff }));
const ctrl = characterController(hero, game.input, { speed: 7, bounds: 20, onJump: () => sfx.play("jump") });
const cam = followCamera(game.camera, hero, { offset: [0, 9, 12] });
const fx = createParticles(game.scene);
const hud = createHud();
game.input.touchControls({ buttons: [{ label: "Jump", action: "jump" }] });
let coins = [], blobs = [], score = 0;

function reset() {
  game.remove(...coins, ...blobs);
  score = 0; hero.position.set(0, 0, 0); cam.snap();
  coins = Array.from({ length: 12 }, () => game.add(makeCoin()));
  coins.forEach((c) => { c.position.set(randRange(-18, 18), 1, randRange(-18, 18)); spin(c, { speed: 3 }); });
  blobs = Array.from({ length: 3 }, (_, i) => game.add(makeEnemyBlob({ color: 0x9d4edd })));
  blobs.forEach((b, i) => b.position.set(-15 + i * 15, 0, -18));
}

const fsm = createStateMachine({ initial: "menu", states: {
  menu: { enter: () => hud.screen({ title: "Coin Dash", subtitle: "Grab every coin, dodge the blobs!",
    body: "<kbd>WASD</kbd> move · <kbd>Space</kbd> jump", button: "Play", onStart: () => fsm.go("playing") }) },
  playing: {
    enter: () => { reset(); music.start(); },
    update: (dt, t) => {
      ctrl.update(dt);
      for (const c of coins) if (c.parent && distXZ(c, hero) < 1.2) {
        game.remove(c); score++; sfx.play("coin"); fx.burst(c.position, { color: [0xffd60a, 0xffffff] });
      }
      for (const b of blobs) {
        const dir = new THREE.Vector3().subVectors(hero.position, b.position).setY(0).normalize();
        b.position.addScaledVector(dir, (2.5 + t * 0.05) * dt);
        b.lookAt(hero.position.x, 0, hero.position.z);
        b.userData.animate(t, 1);
        if (distXZ(b, hero) < 1 && hero.position.y < 0.8) return fsm.go("over", { won: false });
      }
      if (score === coins.length) fsm.go("over", { won: true });
      hud.score("Coins", \`\${score} / \${coins.length}\`);
    },
  },
  over: { enter: ({ won }) => {
    music.stop(); sfx.play(won ? "win" : "lose"); if (!won) shake(game.camera, 0.5, 0.4);
    const { best } = storage.submitScore(score);
    hud.screen({ title: won ? "You win!" : "Caught!", subtitle: \`Coins: \${score} · Best: \${best}\`, button: "Play again", onStart: () => fsm.go("playing") });
  } },
} });

game.onUpdate((dt) => fsm.update(dt));
game.onLateUpdate((dt) => cam.update(dt));
game.start();
\`\`\`

## Rules
- Keep report.js as the first script and keep the import map. Entry point: <script type="module" src="./main.js">.
- Prefer engine helpers over reimplementing loops, input, physics, HUD, audio or particles. Never call input.update().
- Always open with hud.screen({... button: "Play", onStart }) so the first click unlocks audio and focuses the game;
  show a game-over screen with the score and a restart button. Restarting must fully reset state (no page reload).
- Support keyboard + mouse AND touch: use input.moveVector() / input.action(...), call input.touchControls({ buttons })
  with every action the game needs, and keep HUD readable on small screens.
- Put game logic in game.onUpdate, cameras in game.onLateUpdate, and call world.step(dt) once per frame if you use physics.
- Keep it cheap: reuse geometries/materials for many copies, keep particle counts modest, avoid per-frame allocations in hot loops.
- Split bigger games into src/*.js modules; import the engine with a correct relative path.
- If something fails, errors from report.js are shown to you: fix the first error first.
`
