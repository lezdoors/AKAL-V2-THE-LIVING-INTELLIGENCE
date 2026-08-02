/** The mind remembers you. localStorage-only; telemetry does the talking. */

export interface SessionMemory {
  sessions: number;
  lastVisit: number;
  qualified: number;
}

const KEY = "akal-mind";

export function loadSession(): SessionMemory {
  try {
    const raw = localStorage.getItem(KEY);
    const prev: SessionMemory = raw ? JSON.parse(raw) : { sessions: 0, lastVisit: 0, qualified: 0 };
    const now = Date.now();
    const mem = { sessions: prev.sessions + 1, lastVisit: prev.lastVisit, qualified: prev.qualified };
    localStorage.setItem(KEY, JSON.stringify({ ...mem, lastVisit: now }));
    return mem;
  } catch {
    return { sessions: 1, lastVisit: 0, qualified: 0 };
  }
}

export function recordQualified(n: number) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const m = JSON.parse(raw);
    m.qualified = (m.qualified || 0) + n;
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch { /* private mode — the mind forgets */ }
}

export function greeting(mem: SessionMemory): string[] {
  const lines: string[] = [];
  const n = String(mem.sessions).padStart(3, "0");
  if (mem.sessions <= 1) {
    lines.push(`session ${n} · new signal detected`);
  } else {
    const days = Math.max(0, Math.round((Date.now() - mem.lastVisit) / 86400000));
    const ago = days === 0 ? "earlier today" : days === 1 ? "1d ago" : `${days}d ago`;
    lines.push(`session ${n} · signal remembered · last seen ${ago}`);
    if (mem.qualified > 0) lines.push(`you qualified ${mem.qualified} signal${mem.qualified > 1 ? "s" : ""} before`);
  }
  return lines;
}
