/**
 * Every visit is a different mind. The seed comes from the URL hash so any
 * particular mind is shareable; absent a hash we mint one and write it back,
 * silently, so every URL a visitor copies already carries their world.
 */

export function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseHash(): number | null {
  const h = location.hash.replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(h)) return parseInt(h, 16);
  return null;
}

export const seed: number = (() => {
  const fromHash = parseHash();
  if (fromHash !== null) return fromHash;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const s = buf[0] % 0xffffff;
  history.replaceState(null, "", `#${s.toString(16).padStart(6, "0")}`);
  return s;
})();

export const seedHex = `#${seed.toString(16).padStart(6, "0")}`;

export const rng = mulberry32(seed);

/** deterministic per-signal hash → 0..1 */
export function sigHash(index: number, salt: number): number {
  let h = (seed ^ Math.imul(index + 1, 2654435761) ^ Math.imul(salt + 1, 40503)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ------------------------------------------------------------------ *
 * Dossiers — what the mind knows about a signal. Deterministic per
 * (seed, index): re-asking gives the same answer. Knowledge, not lorem.
 * ------------------------------------------------------------------ */

const SECTORS = [
  "logistics", "energy", "dental", "legal", "e-commerce", "real estate",
  "insurance", "hospitality", "med-tech", "construction", "finance", "education",
];
const REGIONS = ["EMEA", "NA-EAST", "NA-WEST", "LATAM", "APAC", "MENA"];
const ROUTES = ["direct", "nurture", "priority desk", "partner"];

export interface Dossier {
  id: string;
  sector: string;
  region: string;
  intent: number; // 0..1
  velocity: string; // e.g. "+12%/wk"
  qualified: boolean;
  route: string;
}

export function dossier(index: number): Dossier {
  const id = String(1000 + Math.floor(sigHash(index, 1) * 90000)).padStart(5, "0");
  const intent = 0.42 + sigHash(index, 2) * 0.55;
  const qualified = intent > 0.78; // rarity is the point — ~15%
  const vel = Math.round((sigHash(index, 3) - 0.35) * 40);
  return {
    id,
    sector: SECTORS[Math.floor(sigHash(index, 4) * SECTORS.length)],
    region: REGIONS[Math.floor(sigHash(index, 5) * REGIONS.length)],
    intent: Math.round(intent * 100) / 100,
    velocity: `${vel >= 0 ? "+" : ""}${vel}%/wk`,
    qualified,
    route: ROUTES[Math.floor(sigHash(index, 6) * ROUTES.length)],
  };
}
