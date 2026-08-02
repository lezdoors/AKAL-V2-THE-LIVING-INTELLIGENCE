/**
 * Boot. One clock, one scroll, one organism.
 * Scroll is time: the visitor carries the mind through its eight states.
 * When they stop, it keeps thinking. When they ask, it attends.
 */
import "@fontsource/syne/700.css";
import "@fontsource/syne/800.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./styles.css";
import Lenis from "lenis";
import { sample, SCENE_COUNT } from "./scenes";
import { World } from "./world";
import { WorldGL } from "./gl/passes";
import { UI } from "./ui";
import { dossier } from "./state/worldSeed";
import { recordQualified } from "./state/session";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = matchMedia("(pointer: coarse)").matches;
const small = Math.min(innerWidth, innerHeight) < 720;
const mobile = coarse || small;

const world = new World({ motes: mobile ? 1400 : 3000, anomalies: mobile ? 12 : 26 });
const canvas = document.getElementById("world") as HTMLCanvasElement;
const gl = new WorldGL(canvas, world);
const ui = new UI(world, reduced);

let dpr = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2);
gl.fieldScale = mobile ? 0.4 : 0.5;
const doResize = () => gl.resize(innerWidth, innerHeight, dpr);
doResize();
addEventListener("resize", doResize);

/* ---------------- scroll = time ---------------- */
let filmS = 0;
const maxS = SCENE_COUNT - 1;
const progressToS = () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  return max > 0 ? (scrollY / max) * maxS : 0;
};
let lenis: Lenis | null = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
}

/* ---------------- inquiry ---------------- */
let px = 99, py = 99; // world coords
let pcx = 0, pcy = 0; // client coords
let pointerAmp = 0;
let lastInput = performance.now();
const toWorld = (cx: number, cy: number): [number, number] => [
  ((cx / innerWidth) * 2 - 1) * world.A,
  -(((cy / innerHeight) * 2) - 1),
];
addEventListener("pointermove", (e) => {
  [px, py] = toWorld(e.clientX, e.clientY);
  pcx = e.clientX; pcy = e.clientY;
  pointerAmp = Math.min(1.2, pointerAmp + 0.12);
  lastInput = performance.now();
});
addEventListener("pointerdown", (e) => {
  [px, py] = toWorld(e.clientX, e.clientY);
  pcx = e.clientX; pcy = e.clientY;
  pointerAmp = 1.4;
  lastInput = performance.now();
});
addEventListener("scroll", () => { lastInput = performance.now(); }, { passive: true });

/* ---------------- free inquiry: dwell-to-qualify ---------------- */
let examTarget = -1;
let examCharge = 0;
let dwellStart = 0;
const sessionQualified = new Set<number>();

function updateInquiry(dt: number) {
  // available in the afterglow (and slightly before) — the mind is calm enough to answer
  const available = filmS > maxS - 1.4;
  if (!available || pointerAmp < 0.05) {
    if (examTarget >= 0) { world.examined = -1; world.examinedCharge = 0; ui.hideDossier(); examTarget = -1; examCharge = 0; }
    return;
  }
  // nearest surfaced node
  let best = -1, bestD = 0.14 * 0.14;
  for (let i = 0; i < 120; i++) {
    if (world.nAlpha[i] < 0.08) continue;
    const [nx, ny] = world.nodeWorld(i);
    const d = (nx - px) * (nx - px) + (ny - py) * (ny - py);
    if (d < bestD) { bestD = d; best = i; }
  }
  if (best !== examTarget) {
    examTarget = best;
    examCharge = 0;
    dwellStart = performance.now();
    ui.hideDossier();
    world.examined = best;
    world.examinedCharge = 0;
    return;
  }
  if (best < 0) return;
  if (performance.now() - dwellStart < 450) return; // dwell before the mind commits
  examCharge = Math.min(1, examCharge + dt / 1.4);
  world.examinedCharge = examCharge;
  const d = dossier(best);
  ui.showDossier(d, pcx, pcy, examCharge);
  if (examCharge >= 1 && d.qualified && !sessionQualified.has(best)) {
    sessionQualified.add(best);
    recordQualified(1);
    const [nx, ny] = world.nodeWorld(best);
    world.flares.push({ x: nx, y: ny, life: 1.4, chan: 2 });
  }
}

/* ---------------- idle life ---------------- */
let nextFeedAt = 0;
function updateIdle(now: number) {
  const idleFor = now - lastInput;
  ui.setFeedDimmed(idleFor < 8000);
  if (idleFor >= 8000 || !document.hasFocus()) {
    if (now >= nextFeedAt) {
      ui.feedEvent();
      nextFeedAt = now + 4000 + Math.random() * 7000;
    }
  } else {
    nextFeedAt = Math.max(nextFeedAt, now + 2500);
  }
}

addEventListener("blur", () => ui.onBlur());
addEventListener("focus", () => ui.onRefocus());

/* ---------------- adaptive quality ---------------- */
let fpsAvg = 60;
let degraded = false;
function govern(dt: number) {
  fpsAvg += (1 / Math.max(dt, 1e-3) - fpsAvg) * 0.04;
  if (!degraded && fpsAvg < 42 && performance.now() > 6000) {
    degraded = true;
    dpr = 1;
    gl.fieldScale = 0.32;
    doResize();
  }
}

/* ---------------- the loop ---------------- */
let last = performance.now();
let telemetryAt = 0;

function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  lenis?.raf(now);

  filmS += (progressToS() - filmS) * Math.min(1, dt * 7);
  const sc = sample(filmS);

  pointerAmp *= Math.pow(0.25, dt);
  gl.setPointer(px, py, pointerAmp);

  world.step(dt, sc);
  updateInquiry(dt);
  gl.render(sc, now / 1000, dt);
  ui.update(filmS);
  if (now > telemetryAt) {
    ui.telemetryTick(sc);
    telemetryAt = now + 250;
  }
  updateIdle(now);
  govern(dt);
  requestAnimationFrame(frame);
}

if (reduced) {
  // a settled mind, not a moving one: advance to the web state and hold
  const sc = sample(3.2);
  for (let i = 0; i < 140; i++) world.step(1 / 60, sc);
  gl.render(sc, 4, 1 / 60);
  ui.update(maxS); // all copy visible via .reduced css; scene index at end
  ui.telemetryTick(sc);
} else {
  requestAnimationFrame(frame);
}
