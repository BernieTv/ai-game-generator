/**
 * welcome.js — the placeholder scene shown before the agent builds a game.
 * It doubles as a worked example of composing the engine modules:
 * a floating low-poly island with trees, a house and a hero, drifting sparkles,
 * clouds and a slowly orbiting camera you can drag.
 */
import {
  THREE,
  createGame,
  environment,
  createSky,
  flat,
  jitter,
  makeTree,
  makeRock,
  makeHouse,
  makeCharacter,
  makeGem,
  scatter,
  createParticles,
  createHud,
  orbitCamera,
  bob,
  spin,
  seededRandom,
} from "./engine/index.js";

const game = createGame({ pixelRatioCap: 1.5, camera: { fov: 42, position: [0, 8, 22] } });
environment(game.scene, "sunset", { sky: false, shadowArea: 22, shadowMapSize: 1024, fogNear: 40, fogFar: 140 });
// The camera looks down at the island, so shift the gradient down to keep it visible.
createSky(game.scene, { top: 0x5a63c9, bottom: 0xffb38a, offset: 0.85, exponent: 1.3 });

// --- Floating island ---------------------------------------------------------
const island = new THREE.Group();
const grass = new THREE.Mesh(jitter(new THREE.CylinderGeometry(6, 5.7, 0.7, 11, 1), 0.12, 1), flat(0x86d16f));
grass.position.y = -0.35;
const dirt = new THREE.Mesh(jitter(new THREE.CylinderGeometry(5.7, 5, 1, 11, 1), 0.2, 2), flat(0xb8794f));
dirt.position.y = -1.2;
const rockGeo = new THREE.ConeGeometry(5, 5.5, 11, 3);
rockGeo.rotateX(Math.PI);
const underside = new THREE.Mesh(jitter(rockGeo, 0.45, 3), flat(0xa585b4));
underside.position.y = -4.45;
for (const m of [grass, dirt, underside]) m.receiveShadow = m.castShadow = true;
island.add(grass, dirt, underside);

const house = makeHouse({ color: 0xfff1d6, roofColor: 0xe85d75, width: 2.4, depth: 2.2, height: 1.7 });
house.position.set(-1.6, 0, -1.4);
house.rotation.y = 0.5;
const hero = makeCharacter({ color: 0x4d7cfe, accent: 0xffc93c });
hero.scale.setScalar(0.7);
hero.position.set(1.2, 0, 3.4);
hero.rotation.y = 0.35;
island.add(house, hero);

const onIsland = (x, z) => Math.hypot(x, z) > 4.8 || Math.hypot(x + 1.6, z + 1.4) < 2.4 || Math.hypot(x - 1.2, z - 3.4) < 1.4;
scatter(island, (rng) => makeTree({ height: 1.6 + rng() * 1.4, rng }), { count: 9, area: 5, seed: 4, avoid: onIsland, minDistance: 1.3 });
scatter(island, (rng) => makeRock({ size: 0.35 + rng() * 0.4, rng }), { count: 6, area: 5, seed: 9, avoid: onIsland, minDistance: 0.8 });
game.add(island);
bob(island, { amplitude: 0.25, speed: 0.8, phase: 0 });

// A glowing gem hovering over the island: "something is about to appear".
const gem = makeGem({ size: 0.9, color: 0x7df9ff });
gem.position.set(2.6, 3.4, -1.6);
game.add(gem);
spin(gem, { speed: 1.2 });
bob(gem, { amplitude: 0.3, speed: 1.6 });

// Little rocks floating around the island.
const rng = seededRandom(11);
for (let i = 0; i < 5; i++) {
  const a = (i / 5) * Math.PI * 2 + 0.4;
  const r = makeRock({ size: 0.6 + rng() * 0.6, color: 0x9a83a3, rng });
  r.position.set(Math.cos(a) * (8 + rng() * 2), -1 + rng() * 3, Math.sin(a) * (8 + rng() * 2));
  game.add(r);
  bob(r, { amplitude: 0.35, speed: 0.6 + rng() * 0.5 });
}

// Clouds: clusters of white blobs on a slowly turning ring.
const clouds = new THREE.Group();
const cloudMat = flat(0xffffff, { emissive: 0xffe9e0, emissiveIntensity: 0.25 });
for (let i = 0; i < 6; i++) {
  const cloud = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1 + rng() * 0.8, 0), cloudMat);
    puff.position.set(k * 1.3 - 2, rng() * 0.5, rng() * 0.8);
    cloud.add(puff);
  }
  const a = (i / 6) * Math.PI * 2;
  cloud.position.set(Math.cos(a) * 34, -4 + rng() * 12, Math.sin(a) * 34);
  cloud.scale.setScalar(1.6);
  cloud.lookAt(0, cloud.position.y, 0);
  clouds.add(cloud);
}
game.add(clouds);
spin(clouds, { speed: 0.03 });

// Drifting sparkles.
const fx = createParticles(game.scene, { max: 400 });
fx.emitter({ preset: "sparkle", position: [0, 2.5, 0], radius: 7, rate: 14, color: [0xffffff, 0xffe29a, 0xa9f1ff], life: [2, 3.5], speed: [0.1, 0.4], gravity: 0.15 });

// Camera: slow auto-orbit, draggable.
const cam = orbitCamera(game.camera, game.canvas, {
  target: [0, 1.2, 0],
  distance: 25,
  polar: 1.2,
  minDistance: 12,
  maxDistance: 40,
  autoRotate: 0.12,
});
game.onLateUpdate((dt) => cam.update(dt));
game.onUpdate((dt, t) => hero.userData.animate(t, 0));

const hud = createHud();
hud.text(
  "welcome",
  "<h1>Your game is on its way</h1><p>Answer a few questions in the chat and the agent will build it here.</p>",
  { position: "top", className: "pf-hero" }
);

game.start();
