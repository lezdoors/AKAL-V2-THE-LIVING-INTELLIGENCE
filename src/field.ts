/**
 * The field — the mind's substrate.
 *
 * Not particles. Signals. Each one has a life: it appears, drifts, joins a
 * structure or dies, and a few of them — the ones the intelligence cares
 * about — accumulate salience. Forces are blended per-frame from the film
 * state, so the same population continuously re-organizes: chaos → pattern →
 * graph → stream → a single point.
 */
import { sample, MAGENTA, type SceneKey } from "./scenes";

export interface FieldConfig {
  count: number;
  linkBudget: number;
  structural: number; // how many signals participate in link formation
}

const K = 6; // cluster attractors; cluster 0 is the opportunity

export class SignalField {
  n: number;
  pos: Float32Array;
  vel: Float32Array;
  colr: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
  salience: Float32Array;
  cluster: Uint8Array;
  phase: Float32Array;
  anomaly: Uint8Array;

  attractors = new Float32Array(K * 3);
  focus = new Float32Array(3); // where everything collapses
  linkPos: Float32Array;
  linkColr: Float32Array;
  linkCount = 0;

  private cfg: FieldConfig;
  private t = 0;
  scene: SceneKey = sample(0);
  /** confidence in the opportunity, 0..1 — drives telemetry + copy */
  confidence = 0;
  linksFormed = 0;

  constructor(cfg: FieldConfig) {
    this.cfg = cfg;
    const n = (this.n = cfg.count);
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.colr = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.salience = new Float32Array(n);
    this.cluster = new Uint8Array(n);
    this.phase = new Float32Array(n);
    this.anomaly = new Uint8Array(n);
    this.linkPos = new Float32Array(cfg.linkBudget * 6);
    this.linkColr = new Float32Array(cfg.linkBudget * 6);

    for (let i = 0; i < n; i++) {
      this.spawn(i, true);
      this.cluster[i] = i % 97 === 0 ? 0 : 1 + (Math.floor(Math.random() * (K - 1)) % (K - 1));
      // the opportunity cluster is deliberately small — rarity is the point
      if (Math.random() < 0.09) this.cluster[i] = 0;
      this.phase[i] = Math.random() * Math.PI * 2;
      if (Math.random() < 0.012) this.anomaly[i] = 1;
    }
  }

  private spawn(i: number, initial = false) {
    const r = 16 + Math.random() * 26;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    this.pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    this.pos[i * 3 + 1] = r * Math.cos(ph) * 0.72;
    this.pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    this.vel[i * 3] = this.vel[i * 3 + 1] = this.vel[i * 3 + 2] = 0;
    this.alpha[i] = initial ? Math.random() : 0;
    this.size[i] = 0.7 + Math.random() * 1.9;
  }

  /** cheap organic vector field — two folded trig gradients */
  private curl(x: number, y: number, z: number, t: number, out: number[]) {
    const s = 0.11;
    out[0] = Math.sin(y * s + t * 0.21) + Math.cos(z * s * 1.3 - t * 0.17);
    out[1] = Math.sin(z * s * 0.9 - t * 0.19) + Math.cos(x * s * 1.1 + t * 0.13);
    out[2] = Math.sin(x * s * 1.2 + t * 0.23) + Math.cos(y * s * 0.8 - t * 0.11);
  }

  /**
   * pointer inquiry: world-space ray (origin + dir). Signals near the ray
   * gain salience — the visitor asks, the system attends.
   */
  pointerRay: { ox: number; oy: number; oz: number; dx: number; dy: number; dz: number; active: boolean } = {
    ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: -1, active: false,
  };

  step(dt: number, filmTime: number) {
    const sc = (this.scene = sample(filmTime));
    this.t += dt;
    const t = this.t;

    // attractors breathe and drift — structure is alive, not architected
    for (let k = 0; k < K; k++) {
      const baseR = k === 0 ? 10 : 13 + k * 1.7;
      const w = 0.05 + k * 0.013;
      const a0 = (k / K) * Math.PI * 2;
      this.attractors[k * 3] = Math.cos(a0 + t * w) * baseR;
      this.attractors[k * 3 + 1] = Math.sin(t * (0.11 + k * 0.017) + k * 2.1) * (4.5 - (k === 0 ? 2 : 0));
      this.attractors[k * 3 + 2] = Math.sin(a0 + t * w) * baseR;
    }
    // the collapse point is where the opportunity cluster lives
    this.focus[0] = this.attractors[0];
    this.focus[1] = this.attractors[1];
    this.focus[2] = this.attractors[2];

    this.confidence += ((sc.focusGain > 0.5 ? sc.focusGain : sc.focusGain * 0.4) - this.confidence) * Math.min(1, dt * 0.8);

    const curlV = [0, 0, 0];
    const damp = Math.pow(0.14, dt); // frame-rate independent drag
    const P = this.pos, V = this.vel, S = this.salience;
    const ray = this.pointerRay;

    for (let i = 0; i < this.n; i++) {
      const ix = i * 3;
      const x = P[ix], y = P[ix + 1], z = P[ix + 2];
      const cl = this.cluster[i];
      const isFocus = cl === 0;

      // — forces —
      this.curl(x, y, z, t + this.phase[i] * 0.35, curlV);
      let fx = curlV[0] * sc.noise * 2.2;
      let fy = curlV[1] * sc.noise * 2.2;
      let fz = curlV[2] * sc.noise * 2.2;

      const ax = this.attractors[cl * 3] - x;
      const ay = this.attractors[cl * 3 + 1] - y;
      const az = this.attractors[cl * 3 + 2] - z;
      const clPull = sc.cluster * (isFocus ? 1.15 : 1) * 0.55;
      fx += ax * clPull; fy += ay * clPull; fz += az * clPull;

      if (sc.flow > 0.01) {
        // routing: a stream that runs through the focus, downhill along x
        const sw = Math.sin(y * 0.25 + t * 0.7) * 0.6;
        fx += (2.6 + sw) * sc.flow * (isFocus ? 1.4 : 0.5);
        fy += -y * 0.12 * sc.flow;
        fz += -z * 0.12 * sc.flow;
      }

      if (sc.collapse > 0.01) {
        const gx = this.focus[0] - x, gy = this.focus[1] - y, gz = this.focus[2] - z;
        const g = sc.collapse * (isFocus ? 2.4 : 1.5);
        fx += gx * g; fy += gy * g; fz += gz * g;
      }

      // — inquiry: distance from pointer ray —
      if (ray.active) {
        const wx = x - ray.ox, wy = y - ray.oy, wz = z - ray.oz;
        const d = wx * ray.dx + wy * ray.dy + wz * ray.dz;
        if (d > 0) {
          const px = wx - ray.dx * d, py = wy - ray.dy * d, pz = wz - ray.dz * d;
          const rr = px * px + py * py + pz * pz;
          if (rr < 30) {
            S[i] = Math.min(1, S[i] + dt * (1.6 - rr * 0.045));
            // attended signals lean toward the asking — a soft answer
            fx -= px * 0.35; fy -= py * 0.35; fz -= pz * 0.35;
          }
        }
      }

      V[ix] = V[ix] * damp + fx * dt;
      V[ix + 1] = V[ix + 1] * damp + fy * dt;
      V[ix + 2] = V[ix + 2] * damp + fz * dt;
      P[ix] += V[ix] * dt * 8;
      P[ix + 1] += V[ix + 1] * dt * 8;
      P[ix + 2] += V[ix + 2] * dt * 8;

      // — life —
      const flicker = 0.62 + 0.38 * Math.sin(t * (1.1 + this.phase[i] * 0.13) + this.phase[i]);
      const focusBoost = isFocus ? sc.focusGain : 0;
      const recede = !isFocus ? 1 - sc.dimOthers * 0.85 : 1;
      let a = (0.28 + 0.5 * flicker) * recede + focusBoost * 0.5;
      // signals die and are reborn — the field never repeats itself
      if (Math.random() < dt * 0.012 && !isFocus) this.spawn(i);
      if (this.alpha[i] < a) this.alpha[i] = Math.min(a, this.alpha[i] + dt * 0.9);
      else this.alpha[i] = a;

      S[i] *= Math.pow(0.45, dt); // salience decays — attention is earned
      const sal = Math.min(1, S[i] + focusBoost);

      // — colour is meaning —
      let r: number, g: number, b: number;
      if (this.anomaly[i] && sal < 0.35) {
        r = MAGENTA[0]; g = MAGENTA[1]; b = MAGENTA[2];
      } else {
        r = sc.cool[0] + (sc.live[0] - sc.cool[0]) * sal;
        g = sc.cool[1] + (sc.live[1] - sc.cool[1]) * sal;
        b = sc.cool[2] + (sc.live[2] - sc.cool[2]) * sal;
        if (sal > 0.72) {
          const h = (sal - 0.72) / 0.28;
          r += (sc.hot[0] - r) * h; g += (sc.hot[1] - g) * h; b += (sc.hot[2] - b) * h;
        }
      }
      this.colr[ix] = r; this.colr[ix + 1] = g; this.colr[ix + 2] = b;
    }

    this.formLinks(sc);
  }

  /** connections — spatial hash over the structural subset */
  private grid = new Map<number, number[]>();
  private formLinks(sc: SceneKey) {
    this.linkCount = 0;
    if (sc.graph < 0.02 || sc.linkDist < 0.1) return;
    const cell = sc.linkDist;
    const inv = 1 / cell;
    const grid = this.grid;
    grid.clear();
    const S = Math.min(this.cfg.structural, this.n);
    const P = this.pos;
    const key = (cx: number, cy: number, cz: number) => ((cx + 512) << 20) | ((cy + 512) << 10) | (cz + 512);

    for (let i = 0; i < S; i++) {
      const cx = Math.floor(P[i * 3] * inv), cy = Math.floor(P[i * 3 + 1] * inv), cz = Math.floor(P[i * 3 + 2] * inv);
      const k = key(cx, cy, cz);
      let b = grid.get(k);
      if (!b) grid.set(k, (b = []));
      b.push(i);
    }

    const maxD2 = cell * cell;
    const budget = this.cfg.linkBudget;
    let L = 0;
    outer: for (let i = 0; i < S; i++) {
      const ix = i * 3;
      const cx = Math.floor(P[ix] * inv), cy = Math.floor(P[ix + 1] * inv), cz = Math.floor(P[ix + 2] * inv);
      let made = 0;
      for (let ox = 0; ox <= 1 && made < 2; ox++)
        for (let oy = -1; oy <= 1 && made < 2; oy++)
          for (let oz = -1; oz <= 1 && made < 2; oz++) {
            const bucket = this.grid.get(key(cx + ox, cy + oy, cz + oz));
            if (!bucket) continue;
            for (const j of bucket) {
              if (j <= i) continue;
              const jx = j * 3;
              const dx = P[jx] - P[ix], dy = P[jx + 1] - P[ix + 1], dz = P[jx + 2] - P[ix + 2];
              const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 > maxD2) continue;
              const o = L * 6;
              this.linkPos[o] = P[ix]; this.linkPos[o + 1] = P[ix + 1]; this.linkPos[o + 2] = P[ix + 2];
              this.linkPos[o + 3] = P[jx]; this.linkPos[o + 4] = P[jx + 1]; this.linkPos[o + 5] = P[jx + 2];
              const fade = (1 - d2 / maxD2) * sc.graph;
              for (let q = 0; q < 2; q++) {
                const src = q === 0 ? ix : jx;
                this.linkColr[o + q * 3] = this.colr[src] * fade;
                this.linkColr[o + q * 3 + 1] = this.colr[src + 1] * fade;
                this.linkColr[o + q * 3 + 2] = this.colr[src + 2] * fade;
              }
              L++; made++;
              if (L >= budget) break outer;
              if (made >= 2) break;
            }
          }
    }
    this.linkCount = L;
    this.linksFormed = L;
  }
}
