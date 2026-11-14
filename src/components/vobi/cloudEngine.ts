/**
 * Vobi's character: the "Ocean Marshmallow" cloud.
 *
 * A procedural SVG drawn every animation frame. The silhouette is the exact
 * union of a few puffs (sampled in polar coordinates from a point inside the
 * cloud, then softened), so the puffs can swell with the voice while the
 * outline stays one smooth shape. Motion comes from small damped springs, so
 * every state change starts from wherever the cloud is right now.
 *
 * The design source is design/blob-options/marshmallow-colors.html ("ocean").
 */

export type CloudState = "idle" | "listening" | "thinking" | "done" | "error";

export interface CloudOptions {
  /** Pixel size of the square SVG. */
  size: number;
  /** Single-colour silhouette for menu bar / tray icons. */
  mono?: boolean;
  /** Soft contact shadow under the cloud (large sizes only). */
  shadow?: boolean;
}

type Spring = { x: number; v: number; to: number };
type Puff = [number, number, number];

const NAVY = "#14304C";
const PUFFS: Puff[] = [
  [-21, -2, 17],
  [-2, -14, 22],
  [21, -6, 18],
  [33, 8, 11],
];
const BASE: [number, number, number, number] = [-42, 4, 84, 34];
const ORIGIN: [number, number] = [0, 10];
const BASE_Y = 42;

const reduceMotion = () =>
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

let instance = 0;

function cloudPath(puffs: Puff[], samples: number): string {
  const circles: Puff[] = puffs.slice();
  const [bx, by, bw, bh] = BASE;
  const br = bh / 2;
  const step = Math.max(4, (bw - bh) / 6);
  for (let x = bx + br; x <= bx + bw - br + 0.01; x += step) {
    circles.push([x, by + br, br]);
  }
  const [ox, oy] = ORIGIN;
  const radii = new Array<number>(samples);
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let best = 0;
    for (const [cx, cy, r] of circles) {
      const px = cx - ox;
      const py = cy - oy;
      const b = dx * px + dy * py;
      const disc = b * b - (px * px + py * py - r * r);
      if (disc >= 0) best = Math.max(best, b + Math.sqrt(disc));
    }
    radii[i] = best;
  }
  // Soften the cusps between puffs a little.
  for (let k = 0; k < 3; k++) {
    const c = radii.slice();
    for (let i = 0; i < samples; i++) {
      radii[i] =
        (c[(i - 1 + samples) % samples] + 2 * c[i] + c[(i + 1) % samples]) / 4;
    }
  }
  let d = "M";
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    if (i) d += "L";
    d += `${(ox + Math.cos(a) * radii[i]).toFixed(2)},${(oy + Math.sin(a) * radii[i]).toFixed(2)}`;
  }
  return d + "Z";
}

function markup(id: string, o: CloudOptions): string {
  const small = o.size < 70;
  const eye = o.mono ? "var(--vobi-eye, #fff)" : NAVY;
  const body = o.mono
    ? `<path data-r="body" fill="currentColor"/>`
    : `<path data-r="body" fill="url(#${id}f)" filter="url(#${id}soft)"/>
       <g clip-path="url(#${id}clip)">
         <ellipse cx="0" cy="46" rx="60" ry="24" fill="url(#${id}ao)"/>
         <ellipse cx="0" cy="30" rx="30" ry="9" fill="url(#${id}glow)"/>
         <ellipse cx="-12" cy="-22" rx="34" ry="18" fill="url(#${id}hi)" opacity=".9"/>
       </g>
       <path data-r="rim" fill="none" stroke="url(#${id}rim)" stroke-width="2"/>
       <ellipse cx="-14" cy="-18" rx="6" ry="3.4" fill="#fff" opacity=".9" transform="rotate(-25 -14 -18)"/>`;
  const glints =
    o.mono || small
      ? ""
      : [1, 2, 3, 4]
          .map(
            (i) =>
              `<circle data-r="g${i}" r="${i > 2 ? 0.8 : 1.7}" fill="#fff"/>`,
          )
          .join("");
  return `<svg width="${o.size}" height="${o.size}" viewBox="-60 -60 120 120" style="overflow:visible;display:block" aria-hidden="true">
    <defs>
      <linearGradient id="${id}f" x1="0" y1="-40" x2="0" y2="40" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#DDF7FF"/><stop offset=".55" stop-color="#5ACCFB"/><stop offset="1" stop-color="#2B7FF0"/></linearGradient>
      <radialGradient id="${id}hi"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}ao"><stop offset="0" stop-color="#1B44C9" stop-opacity=".55"/><stop offset="1" stop-color="#1B44C9" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}glow"><stop offset="0" stop-color="#9EEBFF" stop-opacity=".85"/><stop offset="1" stop-color="#9EEBFF" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}bl"><stop offset="0" stop-color="#FF7EAA" stop-opacity=".75"/><stop offset="1" stop-color="#FF7EAA" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}rim" x1="0" y1="-40" x2="0" y2="20" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <filter id="${id}soft" x="-40%" y="-40%" width="180%" height="200%"><feDropShadow dx="0" dy="${small ? 1 : 5}" stdDeviation="${small ? 1.4 : 5}" flood-color="#1B44C9" flood-opacity=".32"/></filter>
      <clipPath id="${id}clip"><path data-r="clip"/></clipPath>
    </defs>
    ${o.shadow ? `<ellipse data-r="shadow" cx="0" cy="52" rx="34" ry="4" fill="#0B2A4A" opacity=".12"/>` : ""}
    <g data-r="root">${body}
      ${o.mono ? "" : `<ellipse data-r="bl" rx="6" ry="3.4" fill="url(#${id}bl)"/><ellipse data-r="br" rx="6" ry="3.4" fill="url(#${id}bl)"/>`}
      <ellipse data-r="el" fill="${eye}"/><ellipse data-r="er" fill="${eye}"/>
      ${glints}
      <path data-r="al" fill="none" stroke="${eye}" stroke-width="${o.mono ? 4.5 : 3}" stroke-linecap="round"/>
      <path data-r="ar" fill="none" stroke="${eye}" stroke-width="${o.mono ? 4.5 : 3}" stroke-linecap="round"/>
      ${o.mono ? "" : `<path data-r="smile" fill="none" stroke="${NAVY}" stroke-width="2.2" stroke-linecap="round"/><ellipse data-r="mouth" fill="#0E2238"/>`}
    </g>
  </svg>`;
}

const spring = (x = 1): Spring => ({ x, v: 0, to: x });
const step = (s: Spring, k: number, c: number, dt: number) => {
  s.v += (-k * (s.x - s.to) - c * s.v) * dt;
  s.x += s.v * dt;
};
const set = (
  el: Element | undefined,
  attrs: Record<string, string | number>,
) => {
  if (!el) return;
  for (const k in attrs) el.setAttribute(k, String(attrs[k]));
};

export class CloudEngine {
  private state: CloudState = "idle";
  private level = 0;
  private target = 0;
  private t = Math.random() * 10;
  private last = 0;
  private raf = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private nextBlink = performance.now() + 900 + Math.random() * 3000;
  private readonly r: Record<string, Element> = {};
  private readonly samples: number;
  private readonly sy = spring();
  private readonly sx = spring();
  private readonly ty = spring(0);
  private readonly open = spring();
  private readonly happy = spring(0);
  private readonly err = spring(0);
  private readonly lx = spring(0);
  private readonly ly = spring(0);
  private readonly big = spring(1);

  constructor(
    mount: HTMLElement,
    private readonly o: CloudOptions,
  ) {
    const id = `vobi${++instance}`;
    mount.innerHTML = markup(id, o);
    mount.querySelectorAll("[data-r]").forEach((el) => {
      this.r[el.getAttribute("data-r") as string] = el;
    });
    this.samples = o.size < 70 ? 80 : 140;
    this.raf = requestAnimationFrame(this.frame);
  }

  setState(s: CloudState) {
    if (s === this.state) return;
    const prev = this.state;
    this.state = s;
    this.happy.to = s === "done" ? 1 : 0;
    this.err.to = s === "error" ? 1 : 0;
    this.big.to = s === "listening" ? 1.12 : 1;
    if (s === "done") {
      this.sy.v -= 2.8;
      this.sx.v += 1.8;
      this.ty.v -= 200;
    }
    if (s === "listening" && prev !== "listening") {
      this.sy.v += 1.5;
      this.sx.v -= 0.8;
      this.ty.v -= 60;
    }
    if (s === "error") this.sy.v += 1.2;
  }

  /** Voice loudness, 0..1. Only used while listening. */
  setLevel(level: number) {
    this.target = Math.max(0, Math.min(1, level));
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
  }

  private frame = (now: number) => {
    const dt = Math.min(0.033, (now - (this.last || now)) / 1000 || 0.016);
    this.last = now;
    this.t += dt;
    const st = this.state;
    const still = reduceMotion();
    const t = still ? 0 : this.t;

    const tl = st === "listening" ? this.target : 0;
    this.level += (tl - this.level) * (tl > this.level ? 0.45 : 0.12);
    const L = this.level;

    if (now > this.nextBlink && st !== "done" && st !== "error") {
      this.open.x = 0.08;
      this.open.v = 0;
      this.nextBlink = now + 2400 + Math.random() * 3400;
    }
    this.lx.to =
      st === "thinking" ? 3.5 * Math.sign(Math.sin(this.t * 1.3)) : 0;
    this.ly.to =
      st === "thinking"
        ? -2.5
        : st === "listening"
          ? -1
          : st === "error"
            ? 1.5
            : 0;
    const breathe = still
      ? 0
      : Math.sin(this.t * (st === "idle" ? 1.3 : 2.4)) *
        (st === "idle" ? 0.022 : 0.015);
    this.sy.to = 1 + breathe + L * 0.1 - this.err.x * 0.04;
    this.sx.to = 1 - breathe * 0.5 + L * 0.05;

    step(this.sy, 260, 13, dt);
    step(this.sx, 260, 13, dt);
    step(this.ty, 220, 16, dt);
    step(this.open, 300, 22, dt);
    step(this.happy, 240, 22, dt);
    step(this.err, 240, 22, dt);
    step(this.lx, 140, 16, dt);
    step(this.ly, 140, 16, dt);
    step(this.big, 220, 18, dt);

    const hap = Math.max(0, Math.min(1, this.happy.x));
    const er = Math.max(0, Math.min(1, this.err.x));
    const ty = Math.min(0, this.ty.x);

    const puffs = PUFFS.map(([cx, cy, rr], i): Puff => {
      const ph = i * 1.9;
      let d = Math.sin(t * (1.1 + i * 0.17) + ph) * 0.9;
      if (st === "listening")
        d += Math.max(0, Math.sin(t * 9 + ph * 1.4)) * L * 5.5;
      if (st === "thinking")
        d += Math.max(0, Math.sin(t * 4.2 - i * 0.9)) * 2.6;
      return [cx, cy, rr + d - er * 1.2];
    });
    const d = cloudPath(puffs, this.samples);
    set(this.r.body, { d });
    set(this.r.clip, { d });
    set(this.r.rim, { d });
    set(this.r.root, {
      transform: `translate(0 ${ty.toFixed(2)}) translate(0 ${BASE_Y}) scale(${this.sx.x.toFixed(3)} ${this.sy.x.toFixed(3)}) translate(0 ${-BASE_Y})`,
    });
    set(this.r.shadow, { opacity: (0.12 * (1 + ty / 45)).toFixed(3) });

    // Face
    const mono = !!this.o.mono;
    const gap = mono ? 13 : 12;
    const rx = mono ? 5.5 : 4.6;
    const ry = mono ? 7.5 : 6.2;
    const lx = this.lx.x;
    const big = this.big.x;
    const ey = (mono ? 15 : 16) + this.ly.x;
    const eyeOpen = Math.max(0.06, this.open.x) * (1 - hap) * (1 - er * 0.7);
    for (const [key, s] of [
      ["el", -1],
      ["er", 1],
    ] as const) {
      set(this.r[key], {
        cx: (s * gap + lx).toFixed(2),
        cy: ey.toFixed(2),
        rx: (rx * big * (1 + er * 0.25)).toFixed(2),
        ry: Math.max(0.6, ry * big * eyeOpen).toFixed(2),
        opacity: hap > 0.85 ? 0 : 1,
      });
    }
    for (const [key, s] of [
      ["al", -1],
      ["ar", 1],
    ] as const) {
      const cx = s * gap + lx;
      const w = rx * 1.25;
      set(this.r[key], {
        d: `M${(cx - w).toFixed(2)},${(ey + 1.5).toFixed(2)} Q${cx.toFixed(2)},${(ey - 4.2).toFixed(2)} ${(cx + w).toFixed(2)},${(ey + 1.5).toFixed(2)}`,
        opacity: (hap > 0.5 ? Math.min(1, (hap - 0.5) * 3) : 0).toFixed(2),
      });
    }
    const glintsOn = eyeOpen > 0.55 ? 1 : 0;
    [1, 2, 3, 4].forEach((i) => {
      const s = i % 2 ? -1 : 1;
      const small = i > 2;
      set(this.r[`g${i}`], {
        cx: (s * gap + lx + (small ? -1.6 : 1.5) * big).toFixed(2),
        cy: (ey + (small ? 2.4 : -2.2) * big).toFixed(2),
        opacity: glintsOn,
      });
    });
    const blush = ((0.7 + hap * 0.3) * (1 - er * 0.6)).toFixed(2);
    set(this.r.bl, {
      cx: (-gap - 9 + lx * 0.5).toFixed(2),
      cy: (ey + 6).toFixed(2),
      opacity: blush,
    });
    set(this.r.br, {
      cx: (gap + 9 + lx * 0.5).toFixed(2),
      cy: (ey + 6).toFixed(2),
      opacity: blush,
    });
    if (this.r.smile) {
      const talk = st === "listening" ? L : 0;
      const my = ey + 7.5;
      const mx = lx * 0.6;
      set(this.r.mouth, {
        cx: mx.toFixed(2),
        cy: (my + 1).toFixed(2),
        rx: (2.6 + talk * 0.8).toFixed(2),
        ry: (0.5 + talk * 3.6).toFixed(2),
        opacity: talk > 0.06 ? 1 : 0,
      });
      const w = 2.6 + hap * 2.2;
      const dp = 1.8 + hap * 2.6 - er * 4.2;
      const y = my + er * 1.5;
      set(this.r.smile, {
        d: `M${(mx - w).toFixed(2)},${y.toFixed(2)} Q${mx.toFixed(2)},${(y + dp).toFixed(2)} ${(mx + w).toFixed(2)},${y.toFixed(2)}`,
        opacity: talk > 0.06 ? 0 : 1,
      });
    }

    // Hidden documents (the overlay window when it's not on screen) don't need
    // 60 fps: check back a couple of times a second instead.
    if (document.hidden) {
      this.timer = setTimeout(() => {
        this.raf = requestAnimationFrame(this.frame);
      }, 400);
    } else {
      this.raf = requestAnimationFrame(this.frame);
    }
  };
}
