/**
 * The film. Eight morphologies of one mind, keyed to scroll.
 * Every number below interpolates continuously (colours through OKLab), so
 * the world transmutes — nebular static → liquid filaments → neural web →
 * attention bloom → mitosis → rivers → incandescence → afterglow — without
 * a single cut. Nothing snaps. Nothing loops.
 */
import { mixOklab, hex, type RGB } from "./gl/palette";

export interface SceneKey {
  /* field behaviour */
  flowAmp: number;    // how hard the fluid moves
  flowScale: number;  // spatial frequency of the flow
  swirl: number;      // rotational energy around the focus
  attract: number;    // pull of everything toward the focus
  decay: number;      // trail persistence (closer to 1 = longer liquid light)
  nebula: number;     // background breath
  /* structures */
  moteEnergy: number; // how brightly the drifting signals burn
  web: number;        // dendritic link growth 0..1
  mitosis: number;    // cell-division behaviour 0..1
  attention: number;  // the bloom that arrives BEFORE structure
  core: number;       // the incandescent decision point 0..1
  dimOthers: number;  // how far unchosen structures recede
  /* grade */
  cool: RGB; live: RGB; hot: RGB;
  warm: number;       // cool↔warm breath of the whole frame
  exposure: number;
  /* language */
  state: string;
  kicker?: string;
  headline?: string;
  sub?: string;
  align: "left" | "right" | "center";
}

export const BLUE = hex(0x3f6fa8);
export const VIOLET = hex(0x7c4dff);
export const CYAN = hex(0x2fe0ff);
export const EMERALD = hex(0x22d493);
export const AMBER = hex(0xffb021);
export const WHITE = hex(0xf5f9ff);
export const MAGENTA = hex(0xe4529e);

export const SCENES: SceneKey[] = [
  {
    // 1 — STATIC. Most of the market is noise.
    flowAmp: 0.22, flowScale: 1.3, swirl: 0, attract: 0, decay: 0.952, nebula: 0.68,
    moteEnergy: 0.78, web: 0, mitosis: 0, attention: 0, core: 0, dimOthers: 0,
    cool: hex(0x27436b), live: BLUE, hot: hex(0x7fa3c8),
    warm: 0, exposure: 1.1,
    state: "SEARCHING",
    kicker: "AKAL — the infrastructure for customer acquisition",
    headline: "Most of the market is noise.",
    sub: "Right now, thousands of weak signals are moving. Almost none of them matter.",
    align: "left",
  },
  {
    // 2 — FILAMENTS. Liquid light; the field starts flowing with intent.
    flowAmp: 0.5, flowScale: 0.9, swirl: 0.25, attract: 0.02, decay: 0.965, nebula: 0.35,
    moteEnergy: 0.85, web: 0.06, mitosis: 0, attention: 0, core: 0, dimOthers: 0,
    cool: hex(0x33406e), live: VIOLET, hot: hex(0xa88bff),
    warm: 0.04, exposure: 1.05,
    state: "LEARNING",
    kicker: "// pattern memory",
    headline: "It learns the shape of intent.",
    sub: "Currents form between signals that have never met.",
    align: "right",
  },
  {
    // 3 — THE WEB. Dendrites grow; noise dies out.
    flowAmp: 0.3, flowScale: 1.1, swirl: 0.12, attract: 0.06, decay: 0.955, nebula: 0.22,
    moteEnergy: 0.55, web: 1.0, mitosis: 0, attention: 0, core: 0, dimOthers: 0.2,
    cool: hex(0x2c3f63), live: hex(0x8f7bff), hot: CYAN,
    warm: 0.06, exposure: 1.05,
    state: "CONNECTING",
    kicker: "// structure",
    headline: "Signal separates from noise.",
    align: "left",
  },
  {
    // 4 — ATTENTION. The bloom arrives before the structure does.
    flowAmp: 0.34, flowScale: 1.0, swirl: 0.3, attract: 0.16, decay: 0.962, nebula: 0.18,
    moteEnergy: 0.6, web: 0.85, mitosis: 0, attention: 1.0, core: 0, dimOthers: 0.35,
    cool: hex(0x24456b), live: CYAN, hot: hex(0xbdf3ff),
    warm: 0.08, exposure: 1.1,
    state: "PREDICTING",
    kicker: "// t minus",
    headline: "It was watching this one before you arrived.",
    sub: "Prediction is attention, at a scale you can't hold.",
    align: "right",
  },
  {
    // 5 — MITOSIS. Candidates divide and compete; one floods emerald.
    flowAmp: 0.26, flowScale: 1.3, swirl: 0.4, attract: 0.22, decay: 0.957, nebula: 0.14,
    moteEnergy: 0.5, web: 0.6, mitosis: 1.0, attention: 0.35, core: 0.05, dimOthers: 0.6,
    cool: hex(0x1f4247), live: EMERALD, hot: hex(0xa5ffd9),
    warm: 0.14, exposure: 1.1,
    state: "QUALIFYING",
    kicker: "// qualification",
    headline: "One opportunity becomes undeniable.",
    sub: "Budget. Timing. Intent. The system asks before you ever speak.",
    align: "left",
  },
  {
    // 6 — RIVERS. Flowing data bends toward the chosen one. Motion narrates.
    flowAmp: 0.85, flowScale: 0.7, swirl: 0.7, attract: 0.5, decay: 0.968, nebula: 0.1,
    moteEnergy: 0.95, web: 0.3, mitosis: 0.25, attention: 0.15, core: 0.25, dimOthers: 0.8,
    cool: hex(0x233d46), live: EMERALD, hot: AMBER,
    warm: 0.35, exposure: 1.12,
    state: "ROUTING",
    align: "center",
  },
  {
    // 7 — INCANDESCENCE. Everything drains into one point.
    flowAmp: 0.5, flowScale: 0.8, swirl: 1.0, attract: 1.0, decay: 0.952, nebula: 0.08,
    moteEnergy: 0.7, web: 0.08, mitosis: 0, attention: 0, core: 0.85, dimOthers: 0.95,
    cool: hex(0x2b2e3c), live: AMBER, hot: WHITE,
    warm: 0.85, exposure: 1.18,
    state: "DECIDING",
    kicker: "// resolution",
    headline: "One route. One action.",
    align: "center",
  },
  {
    // 8 — AFTERGLOW. The mind is calm. It is looking at you now.
    flowAmp: 0.22, flowScale: 1.0, swirl: 0.18, attract: 0.1, decay: 0.962, nebula: 0.3,
    moteEnergy: 0.55, web: 0.35, mitosis: 0, attention: 0.1, core: 0.18, dimOthers: 0.55,
    cool: hex(0x2c3550), live: hex(0xd7a15c), hot: WHITE,
    warm: 0.5, exposure: 1.05,
    state: "LISTENING",
    align: "left",
  },
];

export const SCENE_COUNT = SCENES.length;

const L = (x: number, y: number, t: number) => x + (y - x) * t;

/** Continuous sample at film time s ∈ [0, SCENE_COUNT-1]. */
export function sample(s: number): SceneKey {
  const i = Math.min(SCENE_COUNT - 2, Math.max(0, Math.floor(s)));
  const f = Math.min(1, Math.max(0, s - i));
  const t = f * f * (3 - 2 * f);
  const a = SCENES[i], b = SCENES[i + 1];
  const src = t < 0.5 ? a : b;
  return {
    flowAmp: L(a.flowAmp, b.flowAmp, t), flowScale: L(a.flowScale, b.flowScale, t),
    swirl: L(a.swirl, b.swirl, t), attract: L(a.attract, b.attract, t),
    decay: L(a.decay, b.decay, t), nebula: L(a.nebula, b.nebula, t),
    moteEnergy: L(a.moteEnergy, b.moteEnergy, t), web: L(a.web, b.web, t),
    mitosis: L(a.mitosis, b.mitosis, t), attention: L(a.attention, b.attention, t),
    core: L(a.core, b.core, t), dimOthers: L(a.dimOthers, b.dimOthers, t),
    cool: mixOklab(a.cool, b.cool, t), live: mixOklab(a.live, b.live, t), hot: mixOklab(a.hot, b.hot, t),
    warm: L(a.warm, b.warm, t), exposure: L(a.exposure, b.exposure, t),
    state: src.state, kicker: src.kicker, headline: src.headline, sub: src.sub, align: src.align,
  };
}
