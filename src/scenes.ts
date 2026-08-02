/**
 * The film. Eight states of one mind, keyed to scroll.
 * Everything in the world — forces, colour, camera, language — interpolates
 * continuously between these keys. Nothing snaps; the intelligence changes
 * state the way weather does.
 */

export interface SceneKey {
  /** forces on the field */
  noise: number; // free chaos
  cluster: number; // pull toward emerging structure
  graph: number; // link rendering strength 0..1
  flow: number; // directional streaming (routing)
  collapse: number; // pull of everything toward the one point
  focusGain: number; // how strongly cluster 0 outshines the rest
  dimOthers: number; // how far the rest of the world recedes 0..1
  linkDist: number;
  /** camera */
  camR: number; // orbit radius
  camEl: number; // elevation (radians)
  camDrift: number; // curiosity — how much the camera hunts salience
  /** state colours */
  cool: [number, number, number]; // the base of the world
  live: [number, number, number]; // what the intelligence is doing right now
  hot: [number, number, number]; // its most confident signals
  /** language */
  state: string; // telemetry state word
  kicker?: string;
  headline?: string;
  sub?: string;
  align: "left" | "right" | "center";
}

const c = (hex: number): [number, number, number] => [
  ((hex >> 16) & 255) / 255,
  ((hex >> 8) & 255) / 255,
  (hex & 255) / 255,
];

// the spectrum of thought
export const BLUE = c(0x4d7ea8); // searching
export const VIOLET = c(0x8b5cf6); // learning
export const CYAN = c(0x38e1ff); // prediction
export const EMERALD = c(0x2ed598); // qualification
export const AMBER = c(0xffb021); // decision
export const WHITE = c(0xffffff); // locked
export const MAGENTA = c(0xe4529e); // anomaly

export const SCENES: SceneKey[] = [
  {
    // 1 — CHAOS. Millions of weak signals. No obvious structure.
    noise: 1.0, cluster: 0.0, graph: 0.0, flow: 0, collapse: 0,
    focusGain: 0, dimOthers: 0, linkDist: 0,
    camR: 46, camEl: 0.1, camDrift: 0.25,
    cool: BLUE, live: BLUE, hot: c(0x9db8cc),
    state: "LISTENING",
    kicker: "AKAL — the infrastructure for customer acquisition",
    headline: "Most of the market is noise.",
    sub: "Right now, thousands of weak signals are moving. Almost none of them matter.",
    align: "left",
  },
  {
    // 2 — PATTERNS begin appearing. The system recognizes relationships.
    noise: 0.55, cluster: 0.38, graph: 0.12, flow: 0, collapse: 0,
    focusGain: 0.05, dimOthers: 0, linkDist: 2.6,
    camR: 38, camEl: 0.32, camDrift: 0.45,
    cool: BLUE, live: VIOLET, hot: VIOLET,
    state: "CORRELATING",
    kicker: "// pattern memory",
    headline: "It learns the shape of intent.",
    sub: "Relationships form between signals that have never met.",
    align: "right",
  },
  {
    // 3 — CONNECTIONS strengthen. Noise disappears.
    noise: 0.28, cluster: 0.75, graph: 0.7, flow: 0, collapse: 0,
    focusGain: 0.18, dimOthers: 0.15, linkDist: 3.4,
    camR: 30, camEl: 0.5, camDrift: 0.6,
    cool: c(0x3a5f80), live: VIOLET, hot: CYAN,
    state: "CONNECTING",
    kicker: "// structure",
    headline: "Signal separates from noise.",
    align: "left",
  },
  {
    // 4 — PREDICTION. The system saw it before you did.
    noise: 0.18, cluster: 0.85, graph: 0.85, flow: 0.1, collapse: 0,
    focusGain: 0.75, dimOthers: 0.35, linkDist: 3.6,
    camR: 22, camEl: 0.42, camDrift: 1.0,
    cool: c(0x2f4d6b), live: CYAN, hot: CYAN,
    state: "PREDICTING",
    kicker: "// t minus",
    headline: "It was watching this one before you arrived.",
    sub: "Prediction is not magic. It is attention, at a scale you can't hold.",
    align: "right",
  },
  {
    // 5 — ONE OPPORTUNITY becomes undeniable. The world reorganizes.
    noise: 0.1, cluster: 1.0, graph: 0.9, flow: 0.18, collapse: 0.04,
    focusGain: 1.0, dimOthers: 0.66, linkDist: 3.2,
    camR: 15, camEl: 0.3, camDrift: 1.0,
    cool: c(0x27404f), live: EMERALD, hot: EMERALD,
    state: "QUALIFYING",
    kicker: "// qualification",
    headline: "One opportunity becomes undeniable.",
    sub: "Budget. Timing. Intent. The system asks before you ever speak.",
    align: "left",
  },
  {
    // 6 — the system explains itself through motion. Routing.
    noise: 0.08, cluster: 0.9, graph: 0.75, flow: 0.9, collapse: 0.1,
    focusGain: 1.0, dimOthers: 0.8, linkDist: 2.8,
    camR: 12, camEl: 0.16, camDrift: 0.9,
    cool: c(0x223441), live: EMERALD, hot: AMBER,
    state: "ROUTING",
    align: "center",
  },
  {
    // 7 — DECISION. Everything collapses into one route, one action.
    noise: 0.03, cluster: 0.2, graph: 0.2, flow: 0.35, collapse: 1.0,
    focusGain: 1.0, dimOthers: 0.9, linkDist: 2.0,
    camR: 10, camEl: 0.08, camDrift: 0.4,
    cool: c(0x1d2733), live: AMBER, hot: WHITE,
    state: "DECIDING",
    kicker: "// resolution",
    headline: "One route. One action.",
    align: "center",
  },
  {
    // 8 — INVITATION. The mind is calm. It is looking at you now.
    noise: 0.1, cluster: 0.12, graph: 0.25, flow: 0.05, collapse: 0.35,
    focusGain: 0.8, dimOthers: 0.6, linkDist: 3.0,
    camR: 17, camEl: 0.22, camDrift: 0.2,
    cool: c(0x21303e), live: AMBER, hot: WHITE,
    state: "READY",
    align: "left",
  },
];

export const SCENE_COUNT = SCENES.length;

/** Continuous scene sample at film time s ∈ [0, SCENE_COUNT-1]. */
export function sample(s: number): SceneKey {
  const i = Math.min(SCENE_COUNT - 2, Math.max(0, Math.floor(s)));
  const f = Math.min(1, Math.max(0, s - i));
  const t = f * f * (3 - 2 * f);
  const a = SCENES[i];
  const b = SCENES[i + 1];
  const L = (x: number, y: number) => x + (y - x) * t;
  const LC = (x: [number, number, number], y: [number, number, number]): [number, number, number] => [
    L(x[0], y[0]), L(x[1], y[1]), L(x[2], y[2]),
  ];
  const src = t < 0.5 ? a : b;
  return {
    noise: L(a.noise, b.noise),
    cluster: L(a.cluster, b.cluster),
    graph: L(a.graph, b.graph),
    flow: L(a.flow, b.flow),
    collapse: L(a.collapse, b.collapse),
    focusGain: L(a.focusGain, b.focusGain),
    dimOthers: L(a.dimOthers, b.dimOthers),
    linkDist: L(a.linkDist, b.linkDist),
    camR: L(a.camR, b.camR),
    camEl: L(a.camEl, b.camEl),
    camDrift: L(a.camDrift, b.camDrift),
    cool: LC(a.cool, b.cool),
    live: LC(a.live, b.live),
    hot: LC(a.hot, b.hot),
    state: src.state,
    kicker: src.kicker,
    headline: src.headline,
    sub: src.sub,
    align: src.align,
  };
}
