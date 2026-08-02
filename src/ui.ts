/**
 * The mind's voice. Headlines are earned — they assemble character by
 * character as the intelligence reaches them and dissolve when it moves on.
 * Telemetry never stops. When you go quiet, the feed proves the system
 * kept working without you.
 *
 * All dynamic text goes through textContent — nothing user- or
 * network-supplied is ever parsed as HTML.
 */
import { SCENES, SCENE_COUNT, type SceneKey } from "./scenes";
import { seedHex } from "./state/worldSeed";
import { greeting, loadSession, type SessionMemory } from "./state/session";
import type { World } from "./world";
import type { Dossier } from "./state/worldSeed";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

interface Block {
  el: HTMLElement;
  chars: { el: HTMLElement; d: number }[];
  scene: number;
  visible: boolean;
}

const FEED_TEMPLATES = [
  "pattern detected · sector: {sector}",
  "signal {id} qualified · {intent}",
  "route recalculated · latency −{n}ms",
  "anomaly discarded · {region}",
  "cluster deepening · {sector}",
  "intent rising · {sector} · {intent}",
  "{n} weak signals expired",
  "correlation found · {sector} × {region}",
  "forecast updated · confidence {intent}",
  "signal {id} entered the field",
  "dormant cluster waking · {region}",
  "noise floor recalibrated",
];
const SECTORS = ["energy", "legal", "dental", "logistics", "e-commerce", "real estate", "med-tech", "finance"];
const REGIONS = ["EMEA", "NA-EAST", "LATAM", "APAC", "MENA"];

export class UI {
  private blocks: Block[] = [];
  private telemetry = document.getElementById("telemetry")!;
  private sceneIndex = document.getElementById("scene-index")!;
  private feedEl: HTMLElement;
  private dossierEl: HTMLElement;
  private dossierCharge: HTMLElement;
  private dossierLines: HTMLElement;
  private lastTitleAt = 0;
  private recentTemplates: number[] = [];
  private startAt = performance.now();
  discoveriesWhileAway = 0;
  session: SessionMemory;
  private greetLines: string[];

  constructor(private world: World, reduced: boolean) {
    this.session = loadSession();
    this.greetLines = greeting(this.session);
    const copy = document.getElementById("copy")!;
    SCENES.forEach((sc, i) => copy.appendChild(this.buildBlock(sc, i, reduced)));

    this.feedEl = el("aside", "mono");
    this.feedEl.id = "feed";
    this.feedEl.setAttribute("aria-hidden", "true");
    document.getElementById("app")!.appendChild(this.feedEl);

    this.dossierEl = el("div", "mono");
    this.dossierEl.id = "dossier";
    this.dossierEl.setAttribute("aria-hidden", "true");
    const charge = el("div", "charge");
    this.dossierCharge = el("i");
    charge.appendChild(this.dossierCharge);
    this.dossierLines = el("div", "dossier-lines");
    this.dossierEl.append(charge, this.dossierLines);
    document.getElementById("app")!.appendChild(this.dossierEl);

    if (reduced) document.body.classList.add("reduced");
  }

  private buildBlock(sc: SceneKey, i: number, reduced: boolean): HTMLElement {
    const block = el("section", `scene-copy align-${sc.align}`);
    block.dataset.scene = String(i);
    const chars: Block["chars"] = [];

    if (sc.kicker) block.appendChild(el("p", "kicker mono", sc.kicker));
    if (sc.headline) {
      const h = el(i === 0 ? "h1" : "h2", "headline");
      for (const word of sc.headline.split(" ")) {
        const w = el("span", "w");
        for (const ch of word) {
          const s = el("span", "ch", ch);
          chars.push({ el: s, d: 0 });
          w.appendChild(s);
        }
        h.appendChild(w);
        h.appendChild(document.createTextNode(" "));
      }
      block.appendChild(h);
      // assembly order: mostly left-to-right, slightly shuffled — thought, not typewriter
      chars.forEach((c, idx) => {
        c.d = (idx / chars.length) * 0.75 + Math.random() * 0.25;
      });
    }
    if (sc.sub) block.appendChild(el("p", "sub", sc.sub));
    if (i === SCENE_COUNT - 1) block.appendChild(this.buildInvitation());
    this.blocks.push({ el: block, chars, scene: i, visible: reduced });
    return block;
  }

  private buildInvitation(): HTMLElement {
    const wrap = el("div");
    wrap.id = "invitation";
    wrap.appendChild(el("p", "kicker mono", "// the invitation"));
    wrap.appendChild(el("h2", "headline invite-headline", "Talk to us."));
    wrap.appendChild(el("p", "sub", "The system is already watching your market. Ask it what it sees."));

    const form = el("form");
    form.id = "contact";
    form.noValidate = true;
    const row = el("div", "row");
    const mkField = (labelText: string, input: HTMLInputElement | HTMLTextAreaElement) => {
      const label = el("label", undefined, labelText);
      label.appendChild(input);
      return label;
    };
    const name = el("input") as HTMLInputElement;
    name.name = "name"; name.type = "text"; name.autocomplete = "name";
    const email = el("input") as HTMLInputElement;
    email.name = "email"; email.type = "email"; email.autocomplete = "email";
    row.append(mkField("Name", name), mkField("Work email", email));
    const msg = el("textarea") as HTMLTextAreaElement;
    msg.name = "msg"; msg.rows = 2;
    const btn = el("button", undefined, "Open a channel");
    btn.type = "submit";
    btn.appendChild(el("span", undefined, " →"));
    form.append(row, mkField("What are you trying to acquire?", msg), btn, el("p", "mono form-note", "routes to hello@akal.agency"));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const body = [
        `Name: ${name.value}`,
        `Email: ${email.value}`,
        `Acquiring: ${msg.value}`,
        `Mind: ${seedHex}`,
      ].join("\n");
      location.href = `mailto:hello@akal.agency?subject=${encodeURIComponent("AKAL — open a channel")}&body=${encodeURIComponent(body)}`;
    });
    wrap.appendChild(form);
    return wrap;
  }

  /** film-time update: assembly + dissolve, scene index */
  update(s: number) {
    for (const b of this.blocks) {
      const isLast = b.scene === SCENE_COUNT - 1;
      const enter = smooth(b.scene - 0.55, b.scene - 0.12, s);
      const exit = isLast ? 0 : smooth(b.scene + 0.18, b.scene + 0.52, s);
      const p = enter * (1 - exit);
      const on = p > 0.001;
      if (on !== b.visible) {
        b.visible = on;
        b.el.classList.toggle("on", on);
      }
      if (!on) continue;
      b.el.style.setProperty("--p", p.toFixed(3));
      for (const c of b.chars) {
        const cp = clamp01((enter - c.d * 0.82) / 0.16) * (1 - exit);
        c.el.style.opacity = cp.toFixed(2);
        c.el.style.transform = cp >= 1 ? "none" : `translateY(${((1 - cp) * 0.35).toFixed(3)}em)`;
        c.el.style.filter = cp >= 1 ? "none" : `blur(${((1 - cp) * 6).toFixed(1)}px)`;
      }
    }
    const idx = Math.min(SCENE_COUNT, Math.max(1, Math.round(s + 1)));
    this.sceneIndex.textContent = `${String(idx).padStart(2, "0")} / ${String(SCENE_COUNT).padStart(2, "0")}`;
  }

  private seedChipArmed = false;
  telemetryTick(sc: SceneKey) {
    // live structure: links that actually carry light right now
    let linkCount = 0;
    for (let l = 0; l < this.world.linkN; l++) if (this.world.lAlpha[l * 2] > 0.06) linkCount++;
    const up = ((performance.now() - this.startAt) / 1000) | 0;
    const mm = String((up / 60) | 0).padStart(2, "0");
    const ss = String(up % 60).padStart(2, "0");
    this.telemetry.replaceChildren();
    const chip = el("span", "chip", `mind ${seedHex}`);
    chip.id = "seed-chip";
    chip.title = "copy this mind's address";
    if (!this.seedChipArmed) this.seedChipArmed = true;
    chip.addEventListener("click", () => {
      navigator.clipboard?.writeText(location.href).then(() => {
        chip.textContent = "copied — this exact mind, shared";
        setTimeout(() => (chip.textContent = `mind ${seedHex}`), 2400);
      });
    });
    const stateRow = el("span", undefined, "state ");
    stateRow.appendChild(el("b", undefined, sc.state));
    const rows: (HTMLElement | string)[] = [
      chip,
      stateRow,
      el("span", undefined, `t+${mm}:${ss} · links ${linkCount} · confidence ${(this.world.confidence * 100).toFixed(0)}%`),
      ...this.greetLines.map((l) => el("span", undefined, l)),
    ];
    rows.forEach((r, i) => {
      if (i > 0) this.telemetry.appendChild(document.createElement("br"));
      this.telemetry.append(r);
    });
    if (document.hasFocus() && performance.now() - this.lastTitleAt > 5000) {
      document.title = `AKAL — ${sc.state.toLowerCase()}`;
      this.lastTitleAt = performance.now();
    }
  }

  /** the mind keeps working while you're idle */
  feedEvent() {
    let ti: number;
    do { ti = Math.floor(Math.random() * FEED_TEMPLATES.length); } while (this.recentTemplates.includes(ti));
    this.recentTemplates.push(ti);
    if (this.recentTemplates.length > 6) this.recentTemplates.shift();
    const up = (performance.now() - this.startAt) / 1000;
    const stamp = `${String((up / 60) | 0).padStart(2, "0")}:${String((up | 0) % 60).padStart(2, "0")}`;
    const text = FEED_TEMPLATES[ti]
      .replace("{sector}", SECTORS[Math.floor(Math.random() * SECTORS.length)])
      .replace("{region}", REGIONS[Math.floor(Math.random() * REGIONS.length)])
      .replace("{id}", String(10000 + Math.floor(Math.random() * 89999)))
      .replace("{intent}", (0.6 + Math.random() * 0.38).toFixed(2))
      .replace("{n}", String(4 + Math.floor(Math.random() * 60)));
    const line = el("div", "feed-line");
    line.appendChild(el("span", "stamp", stamp));
    line.appendChild(document.createTextNode(text));
    this.feedEl.appendChild(line);
    while (this.feedEl.children.length > 8) this.feedEl.removeChild(this.feedEl.firstChild!);
    if (!document.hasFocus()) this.discoveriesWhileAway++;

    // …and the event is real: somewhere, the field flares
    const w = this.world;
    const i = Math.floor(Math.random() * 120);
    const [x, y] = w.nodeWorld(i);
    w.flares.push({ x, y, life: 1, chan: 1 });
  }

  setFeedDimmed(dim: boolean) {
    this.feedEl.classList.toggle("dim", dim);
  }

  /* ---------------- dossier (free inquiry) ---------------- */
  showDossier(d: Dossier, cx: number, cy: number, charge: number) {
    this.dossierCharge.style.transform = `scaleX(${Math.min(1, charge).toFixed(2)})`;
    const lines: { text: string; cls?: string }[] = [
      { text: `SIGNAL ${d.id}` },
      { text: `sector: ${d.sector} · region: ${d.region}` },
      { text: `intent ${d.intent.toFixed(2)} · velocity ${d.velocity}` },
      d.qualified
        ? { text: `QUALIFIED — route: ${d.route}`, cls: "ok" }
        : { text: "HOLD — insufficient signal", cls: "hold" },
    ];
    const shown = charge >= 1 ? lines.length : Math.max(1, Math.floor(charge * lines.length));
    this.dossierLines.replaceChildren(
      ...lines.slice(0, shown).map((l) => el("div", l.cls, l.text))
    );
    this.dossierEl.style.left = `${Math.min(innerWidth - 300, cx + 18)}px`;
    this.dossierEl.style.top = `${Math.min(innerHeight - 150, cy + 14)}px`;
    this.dossierEl.classList.add("on");
  }
  hideDossier() {
    this.dossierEl.classList.remove("on");
  }

  onRefocus() {
    if (this.discoveriesWhileAway > 0) {
      document.title = `AKAL — ${this.discoveriesWhileAway} discover${this.discoveriesWhileAway > 1 ? "ies" : "y"} while you were away`;
      this.lastTitleAt = performance.now() + 3000;
      this.discoveriesWhileAway = 0;
    }
  }
  onBlur() {
    document.title = "AKAL — still thinking…";
  }
}
