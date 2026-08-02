/**
 * The mind's inhabitants, on the CPU.
 *
 * Motes — thousands of weak signals riding the same currents as the fluid.
 * Nodes — ~120 thoughts that surface, grow dendritic links, divide under
 * qualification, and recede when unchosen. One of them — seeded, unknowable
 * in advance — is the opportunity everything else reorganizes around.
 *
 * All geometry is written into shared Float32Arrays each frame; the GL layer
 * wraps them without copying. Positions are stored normalized and mapped to
 * the live aspect at write time, so the composition survives any viewport.
 */
import { rng, sigHash } from "./state/worldSeed";
import type { SceneKey } from "./scenes";

export const NODE_COUNT = 120;
const LINKS_PER_NODE = 3;

export interface WorldConfig {
  motes: number;
  anomalies: number;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class World {
  A = 1.6; // live aspect (half-width in world units; half-height = 1)

  // focus — where the opportunity lives (normalized, mapped by aspect)
  focusN: [number, number];

  // motes
  n: number;
  mPos: Float32Array; // xyz (z=0)
  mChan: Float32Array; // rgb channel weights (cool/live/hot)
  mSize: Float32Array;
  mAlpha: Float32Array;
  private mNorm: Float32Array; // normalized xy + phase
  private mVel: Float32Array;

  // anomalies (magenta strays — drawn by their own material)
  an: number;
  aPos: Float32Array;
  aAlpha: Float32Array;
  private aNorm: Float32Array;

  // nodes + children (mitosis doubles the population)
  nodeN = NODE_COUNT;
  nPos: Float32Array; // 2 * NODE_COUNT points (parent + child)
  nChan: Float32Array;
  nSize: Float32Array;
  nAlpha: Float32Array;
  private nodeNorm: Float32Array; // normalized xy
  private nodePhase: Float32Array;
  private nodeGate: Float32Array; // web threshold at which this thought surfaces
  private childDir: Float32Array;
  links: Uint16Array; // pairs of node indices
  linkN: number;
  lPos: Float32Array; // 2 verts per link
  lChan: Float32Array;
  lAlpha: Float32Array;
  private linkGate: Float32Array;

  winner: number; // node index of the opportunity
  /** transient flares injected by the idle feed / examinations */
  flares: { x: number; y: number; life: number; chan: 0 | 1 | 2 }[] = [];

  confidence = 0;
  private t = 0;

  constructor(cfg: WorldConfig) {
    this.n = cfg.motes;
    this.an = cfg.anomalies;
    this.mPos = new Float32Array(this.n * 3);
    this.mChan = new Float32Array(this.n * 3);
    this.mSize = new Float32Array(this.n);
    this.mAlpha = new Float32Array(this.n);
    this.mNorm = new Float32Array(this.n * 3);
    this.mVel = new Float32Array(this.n * 2);
    this.aPos = new Float32Array(this.an * 3);
    this.aAlpha = new Float32Array(this.an);
    this.aNorm = new Float32Array(this.an * 2);

    for (let i = 0; i < this.n; i++) {
      this.mNorm[i * 3] = rng() * 2 - 1;
      this.mNorm[i * 3 + 1] = rng() * 2 - 1;
      this.mNorm[i * 3 + 2] = rng() * Math.PI * 2;
      this.mSize[i] = 1.1 + rng() * 2.4;
    }
    for (let i = 0; i < this.an; i++) {
      this.aNorm[i * 2] = rng() * 2 - 1;
      this.aNorm[i * 2 + 1] = rng() * 2 - 1;
    }

    this.focusN = [(rng() * 0.9 - 0.45), (rng() * 0.7 - 0.35)];

    const P = 2 * NODE_COUNT;
    this.nPos = new Float32Array(P * 3);
    this.nChan = new Float32Array(P * 3);
    this.nSize = new Float32Array(P);
    this.nAlpha = new Float32Array(P);
    this.nodeNorm = new Float32Array(NODE_COUNT * 2);
    this.nodePhase = new Float32Array(NODE_COUNT);
    this.nodeGate = new Float32Array(NODE_COUNT);
    this.childDir = new Float32Array(NODE_COUNT * 2);
    for (let i = 0; i < NODE_COUNT; i++) {
      this.nodeNorm[i * 2] = rng() * 1.9 - 0.95;
      this.nodeNorm[i * 2 + 1] = rng() * 1.7 - 0.85;
      this.nodePhase[i] = rng() * Math.PI * 2;
      this.nodeGate[i] = 0.08 + rng() * 0.8;
      const a = rng() * Math.PI * 2;
      this.childDir[i * 2] = Math.cos(a);
      this.childDir[i * 2 + 1] = Math.sin(a);
    }

    // the opportunity: the node the seed placed closest to the focus
    let best = 0, bestD = Infinity;
    for (let i = 0; i < NODE_COUNT; i++) {
      const dx = this.nodeNorm[i * 2] - this.focusN[0] * 1.1;
      const dy = this.nodeNorm[i * 2 + 1] - this.focusN[1] * 1.1;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    this.winner = best;
    // move the winner's home onto the focus so the attention bloom is honest
    this.nodeNorm[best * 2] = this.focusN[0] * 1.1;
    this.nodeNorm[best * 2 + 1] = this.focusN[1] * 1.1;
    this.nodeGate[best] = 0.3;

    // dendrites: k nearest neighbours
    const pairs: number[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const ds: { j: number; d: number }[] = [];
      for (let j = 0; j < NODE_COUNT; j++) {
        if (j === i) continue;
        const dx = this.nodeNorm[j * 2] - this.nodeNorm[i * 2];
        const dy = this.nodeNorm[j * 2 + 1] - this.nodeNorm[i * 2 + 1];
        ds.push({ j, d: dx * dx + dy * dy });
      }
      ds.sort((a, b) => a.d - b.d);
      for (let k = 0; k < LINKS_PER_NODE; k++) {
        const j = ds[k].j;
        if (j > i) pairs.push(i, j);
      }
    }
    this.links = new Uint16Array(pairs);
    this.linkN = pairs.length / 2;
    this.lPos = new Float32Array(this.linkN * 6);
    this.lChan = new Float32Array(this.linkN * 6);
    this.lAlpha = new Float32Array(this.linkN * 2);
    this.linkGate = new Float32Array(this.linkN);
    for (let l = 0; l < this.linkN; l++) this.linkGate[l] = 0.1 + rng() * 0.85;
  }

  focusWorld(): [number, number] {
    return [this.focusN[0] * this.A * 0.82, this.focusN[1] * 0.82];
  }

  nodeWorld(i: number): [number, number] {
    const wob = 0.02;
    return [
      this.nodeNorm[i * 2] * this.A * 0.8 + Math.sin(this.t * 0.23 + this.nodePhase[i]) * wob,
      this.nodeNorm[i * 2 + 1] * 0.8 + Math.cos(this.t * 0.19 + this.nodePhase[i] * 1.7) * wob,
    ];
  }

  private curl(x: number, y: number, t: number, out: [number, number]) {
    const s = 2.1;
    out[0] = Math.sin(y * s + t * 0.31) + 0.6 * Math.cos((x + y) * s * 1.7 - t * 0.23);
    out[1] = Math.cos(x * s - t * 0.27) + 0.6 * Math.sin((x - y) * s * 1.6 + t * 0.19);
  }

  /** examined node (free inquiry) — boosts its glow and pulls dendrites */
  examined = -1;
  examinedCharge = 0;

  step(dt: number, sc: SceneKey) {
    this.t += dt;
    const t = this.t;
    const A = this.A;
    const [fx, fy] = this.focusWorld();
    const cv: [number, number] = [0, 0];
    const damp = Math.pow(0.001, dt);

    this.confidence += (Math.max(sc.attention, sc.core, sc.mitosis * 0.7) - this.confidence) * Math.min(1, dt * 1.2);

    // ---- motes ----
    for (let i = 0; i < this.n; i++) {
      let x = this.mNorm[i * 3] * A;
      let y = this.mNorm[i * 3 + 1];
      this.curl(x * sc.flowScale, y * sc.flowScale, t + this.mNorm[i * 3 + 2], cv);
      let vx = cv[0] * sc.flowAmp;
      let vy = cv[1] * sc.flowAmp;
      const dx = fx - x, dy = fy - y;
      const r = Math.hypot(dx, dy) + 1e-4;
      vx += (-dy / r) * sc.swirl * smooth(1.6, 0.15, r) * 1.4;
      vy += (dx / r) * sc.swirl * smooth(1.6, 0.15, r) * 1.4;
      vx += dx * sc.attract * 1.1;
      vy += dy * sc.attract * 1.1;

      this.mVel[i * 2] = this.mVel[i * 2] * damp + vx * (1 - damp);
      this.mVel[i * 2 + 1] = this.mVel[i * 2 + 1] * damp + vy * (1 - damp);
      x += this.mVel[i * 2] * dt * 0.55;
      y += this.mVel[i * 2 + 1] * dt * 0.55;

      // respawn when swallowed by the core or lost off-frame
      const rr = Math.hypot(fx - x, fy - y);
      if ((sc.core > 0.3 && rr < 0.05) || Math.abs(x) > A * 1.15 || Math.abs(y) > 1.15 || Math.random() < dt * 0.008) {
        x = (Math.random() * 2 - 1) * A;
        y = Math.random() * 2 - 1;
        this.mVel[i * 2] = this.mVel[i * 2 + 1] = 0;
        this.mAlpha[i] = 0;
      }
      this.mNorm[i * 3] = x / A;
      this.mNorm[i * 3 + 1] = y;
      this.mPos[i * 3] = x;
      this.mPos[i * 3 + 1] = y;

      const flick = 0.55 + 0.45 * Math.sin(t * (0.9 + sigHash(i, 9) * 1.6) + this.mNorm[i * 3 + 2] * 7);
      const target = sc.moteEnergy * flick * (1 - sc.dimOthers * 0.55);
      this.mAlpha[i] += (target - this.mAlpha[i]) * Math.min(1, dt * 2.2);
      // channel: cool signals; near the focus they pick up the live colour
      const liveMix = smooth(0.9, 0.15, rr) * (sc.attention * 0.7 + sc.core * 0.9 + sc.swirl * 0.3);
      this.mChan[i * 3] = 1 - liveMix;
      this.mChan[i * 3 + 1] = liveMix;
      this.mChan[i * 3 + 2] = sc.core * smooth(0.5, 0.08, rr) * 0.8;
    }

    // ---- anomalies (rare magenta strays; they do not join anything) ----
    for (let i = 0; i < this.an; i++) {
      let x = this.aNorm[i * 2] * A, y = this.aNorm[i * 2 + 1];
      this.curl(x * 0.7, y * 0.7, t * 0.6 + i * 13.7, cv);
      x += cv[0] * dt * 0.12;
      y += cv[1] * dt * 0.12;
      if (Math.abs(x) > A || Math.abs(y) > 1) { x = (Math.random() * 2 - 1) * A; y = Math.random() * 2 - 1; }
      this.aNorm[i * 2] = x / A; this.aNorm[i * 2 + 1] = y;
      this.aPos[i * 3] = x; this.aPos[i * 3 + 1] = y;
      this.aAlpha[i] = (0.16 + 0.2 * Math.sin(t * 0.7 + i * 2.4)) * (1 - sc.dimOthers) * (1 - sc.core);
    }

    // ---- nodes + mitosis ----
    const W = this.winner;
    for (let i = 0; i < NODE_COUNT; i++) {
      const [x, y] = this.nodeWorld(i);
      const isW = i === W;
      const surfaced = smooth(this.nodeGate[i] - 0.06, this.nodeGate[i] + 0.06, sc.web + (isW ? sc.attention + sc.core : 0));
      const recede = isW ? 1 : 1 - sc.dimOthers * 0.9;
      const exam = this.examined === i ? this.examinedCharge : 0;
      const pulse = 0.75 + 0.25 * Math.sin(t * 1.3 + this.nodePhase[i] * 3);

      // parent
      this.nPos[i * 3] = x; this.nPos[i * 3 + 1] = y;
      this.nAlpha[i] = surfaced * recede * pulse + exam * 0.6;
      this.nSize[i] = (isW ? 5.2 + sc.core * 9 + sc.attention * 3 : 2.6 + surfaced * 1.6) + exam * 3;
      const hotW = isW ? Math.max(sc.core, sc.mitosis * 0.6) : 0;
      this.nChan[i * 3] = 0.15;
      this.nChan[i * 3 + 1] = 1 - hotW + exam;
      this.nChan[i * 3 + 2] = hotW;

      // child (mitosis) — divides out, competes, loses unless it is the winner's
      const j = NODE_COUNT + i;
      const m = sc.mitosis * surfaced;
      const sep = m * (0.05 + sigHash(i, 11) * 0.09);
      this.nPos[j * 3] = x + this.childDir[i * 2] * sep;
      this.nPos[j * 3 + 1] = y + this.childDir[i * 2 + 1] * sep;
      this.nAlpha[j] = m * recede * 0.8 * pulse;
      this.nSize[j] = 2 + m * 1.6;
      this.nChan[j * 3] = 0.3; this.nChan[j * 3 + 1] = 0.9; this.nChan[j * 3 + 2] = 0;
    }

    // ---- dendrites ----
    for (let l = 0; l < this.linkN; l++) {
      const i = this.links[l * 2], j = this.links[l * 2 + 1];
      const grow = smooth(this.linkGate[l] - 0.12, this.linkGate[l] + 0.12, sc.web);
      const [x1, y1] = this.nodeWorld(i);
      const [x2, y2] = this.nodeWorld(j);
      // links grow segment-by-segment: endpoint 2 extends with growth
      const g = grow;
      const ex = x1 + (x2 - x1) * g, ey = y1 + (y2 - y1) * g;
      const o = l * 6;
      this.lPos[o] = x1; this.lPos[o + 1] = y1; this.lPos[o + 3] = ex; this.lPos[o + 4] = ey;
      const touchesW = i === W || j === W;
      const recede = touchesW ? 1 : 1 - sc.dimOthers * 0.92;
      const a = grow * recede * (0.3 + 0.7 * Math.min(this.nAlpha[i], 1));
      this.lAlpha[l * 2] = a;
      this.lAlpha[l * 2 + 1] = a * 0.7;
      for (let q = 0; q < 2; q++) {
        this.lChan[o + q * 3] = 0.2;
        this.lChan[o + q * 3 + 1] = 1;
        this.lChan[o + q * 3 + 2] = touchesW ? sc.core * 0.8 : 0;
      }
    }

    // flares age out
    for (let i = this.flares.length - 1; i >= 0; i--) {
      this.flares[i].life -= dt;
      if (this.flares[i].life <= 0) this.flares.splice(i, 1);
    }
  }
}
