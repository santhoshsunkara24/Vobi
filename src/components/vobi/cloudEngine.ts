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

/**
 * What Vobi is doing, each with its own face:
 *
 * - `idle`         calm, breathing, blinking now and then
 * - `listening`    looking up at you, mouth moving with your voice
 * - `transcribing` eyes down, reading left to right as it writes
 * - `thinking`     working on it (generic): glancing side to side
 * - `refining`     pondering: eyes up, a "hmm" mouth, sparkles twinkling
 * - `fixing`       focused: narrowed eyes checking the text, small nods
 * - `done`         delighted: hop, wiggle, ^ ^ eyes and a grin
 * - `clean`        all good: a wink and a smile
 * - `confused`     head tilt, eyes searching, wavy mouth, a "?"
 * - `error`        sad: droopy eyes, a frown, a little shrink
 * - `sleepy`       half-closed eyes, a yawn and a "z" (loading, not set up)
 */
export type CloudState =
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "refining"
  | "fixing"
  | "done"
  | "clean"
  | "confused"
  | "error"
  | "sleepy";

export interface CloudOptions {
  /** Pixel size of the square SVG. */
  size: number;
  /** Single-colour silhouette for menu bar / tray icons. */
  mono?: boolean;
  /** Soft contact shadow under the cloud (large sizes only). */
  shadow?: boolean;
  /** Little legs under the cloud (the on-screen buddy). Full colour only. */
  legs?: boolean;
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
  // Small sizes get thicker strokes so the face still reads at 46px.
  const line = o.mono ? 4.5 : small ? 3.4 : 3;
  const mouthLine = small ? 2.8 : 2.2;
  const face = o.mono
    ? ""
    : `<path data-r="wl" fill="none" stroke="${NAVY}" stroke-width="${small ? 2.8 : 2.2}" stroke-linecap="round" opacity="0"/>
       <path data-r="wr" fill="none" stroke="${NAVY}" stroke-width="${small ? 2.8 : 2.2}" stroke-linecap="round" opacity="0"/>
       <path data-r="smile" fill="none" stroke="${NAVY}" stroke-width="${mouthLine}" stroke-linecap="round" stroke-linejoin="round"/>
       <ellipse data-r="mouth" fill="#0E2238"/>
       <path data-r="grin" fill="#0E2238" stroke="#0E2238" stroke-width="1.2" stroke-linejoin="round"/>
       <ellipse data-r="tongue" fill="#FF7EAA"/>`;
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
    <g data-r="root">${o.legs && !o.mono ? legsMarkup(id) : ""}${body}
      ${o.mono ? "" : `<ellipse data-r="bl" rx="6" ry="3.4" fill="url(#${id}bl)"/><ellipse data-r="br" rx="6" ry="3.4" fill="url(#${id}bl)"/>`}
      <ellipse data-r="el" fill="${eye}"/><ellipse data-r="er" fill="${eye}"/>
      ${glints}
      <path data-r="al" fill="none" stroke="${eye}" stroke-width="${line}" stroke-linecap="round"/>
      <path data-r="ar" fill="none" stroke="${eye}" stroke-width="${line}" stroke-linecap="round"/>
      ${face}
    </g>
    ${o.mono ? "" : extras(id, small)}
  </svg>`;
}

/** Two stubby legs, drawn behind the body so the hips tuck under it. */
function legsMarkup(id: string): string {
  const leg = (k: string) =>
    `<path data-r="leg${k}" fill="none" stroke="url(#${id}leg)" stroke-width="6.5" stroke-linecap="round"/><ellipse data-r="foot${k}" rx="5" ry="3.2" fill="#1D5FD6"/>`;
  return `<defs><linearGradient id="${id}leg" x1="0" y1="30" x2="0" y2="52" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2F8CF2"/><stop offset="1" stop-color="#2468DC"/></linearGradient></defs>${leg("l")}${leg("r")}`;
}

/** Little marks around the head: sparkles (refining), "?" (confused), "z" (sleepy). */
function extras(id: string, small: boolean): string {
  const star = (r: number) =>
    `M0,${-r} C${r * 0.18},${-r * 0.18} ${r * 0.18},${-r * 0.18} ${r},0 C${r * 0.18},${r * 0.18} ${r * 0.18},${r * 0.18} 0,${r} C${-r * 0.18},${r * 0.18} ${-r * 0.18},${r * 0.18} ${-r},0 C${-r * 0.18},${-r * 0.18} ${-r * 0.18},${-r * 0.18} 0,${-r}Z`;
  // At the overlay size everything is scaled by ~0.38, so marks grow a bit.
  const k = small ? 1.3 : 1;
  const sw = small ? 1.6 : 1.2;
  // "?" and "z" are drawn as paths, not text, so they look the same on every
  // system (no font fallback on Windows or Linux).
  const ink = `fill="none" stroke="${NAVY}" stroke-linecap="round" stroke-linejoin="round"`;
  const q = `<g data-r="q" opacity="0"><g transform="scale(${k})"><path d="M-4.6,-5 C-4.6,-10.6 4.8,-10.6 4.8,-5 C4.8,-1.2 0,-0.8 0,3" ${ink} stroke-width="3.4"/><circle cx="0" cy="8.4" r="2.1" fill="${NAVY}"/></g></g>`;
  const z = (n: number) =>
    `<g data-r="z${n}" opacity="0"><path d="M${-4.4 * k},${-4.6 * k} H${4.4 * k} L${-4.4 * k},${4.6 * k} H${4.4 * k}" ${ink} stroke-width="${2.6 * k}"/></g>`;
  return `<defs><linearGradient id="${id}sp" x1="0" y1="-1" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#9FE3FF"/></linearGradient></defs>
    <path data-r="s1" d="${star(8 * k)}" fill="url(#${id}sp)" stroke="#2B7FF0" stroke-width="${sw}" stroke-linejoin="round" opacity="0"/>
    <path data-r="s2" d="${star(5.2 * k)}" fill="url(#${id}sp)" stroke="#2B7FF0" stroke-width="${sw}" stroke-linejoin="round" opacity="0"/>
    <path data-r="s3" d="${star(3.8 * k)}" fill="url(#${id}sp)" stroke="#2B7FF0" stroke-width="${sw * 0.9}" stroke-linejoin="round" opacity="0"/>
    ${q}${z(1)}${z(2)}`;
}

/** How each state holds the face; motion on top of this lives in `frame`. */
type Pose = {
  /** Eye openness, 1 = normal. */
  open: number;
  /** Eye size. */
  big: number;
  /** Mouth: curve depth (negative = frown), half-width, wobble, one side raised. */
  dp: number;
  mw: number;
  wv: number;
  asym: number;
  /** Mouth as a small "o" (0..1). */
  mo: number;
  /** Head tilt in degrees. */
  tilt: number;
  blush: number;
  /** Brows: how visible, inner-end slope (+ worried, - focused), left brow raise. */
  brow: number;
  bs: number;
  bl: number;
  /** Body scale (error shrinks a little). */
  size: number;
};

const P = (p: Partial<Pose>): Pose => ({
  open: 1,
  big: 1,
  dp: 1.8,
  mw: 2.6,
  wv: 0,
  asym: 0,
  mo: 0,
  tilt: 0,
  blush: 0.7,
  brow: 0,
  bs: 0,
  bl: 0,
  size: 1,
  ...p,
});

const POSES: Record<CloudState, Pose> = {
  idle: P({}),
  listening: P({ big: 1.12, blush: 0.75 }),
  transcribing: P({ open: 0.78, dp: 1.2, mw: 2.2 }),
  thinking: P({ dp: 1, mw: 2.2 }),
  refining: P({
    open: 0.95,
    dp: 0.6,
    mw: 2.6,
    asym: 1.8,
    blush: 0.75,
    brow: 0.9,
    bs: 0.6,
    bl: 1.6,
  }),
  fixing: P({ open: 0.68, dp: 0, mw: 1.6, mo: 0.4, brow: 0.85, bs: -1.4 }),
  done: P({ dp: 4.4, mw: 4.8, blush: 1 }),
  clean: P({ dp: 3.2, mw: 4, asym: 0.8, tilt: 4, blush: 0.9 }),
  confused: P({
    big: 1.05,
    dp: 0,
    mw: 3.4,
    wv: 1.1,
    tilt: -9,
    blush: 0.6,
    brow: 1,
    bs: 0,
    bl: 2.6,
  }),
  error: P({
    open: 0.6,
    big: 1.1,
    dp: -2.6,
    mw: 2.8,
    blush: 0.25,
    brow: 1,
    bs: 1.8,
    size: 0.95,
  }),
  sleepy: P({ open: 0.2, dp: 0.6, mw: 2.2, mo: 0.35, tilt: 6, blush: 0.55 }),
};

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
const f = (n: number) => n.toFixed(2);
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** A polyline mouth: a curve of depth `dp`, one end raised by `asym`, with an optional wave. */
function mouthPath(
  mx: number,
  y: number,
  w: number,
  dp: number,
  asym: number,
  wv: number,
  phase: number,
): string {
  const n = 12;
  let d = "";
  for (let i = 0; i <= n; i++) {
    const u = -1 + (2 * i) / n;
    const x = mx + u * w;
    const yy =
      y +
      dp * (1 - u * u) -
      asym * ((u + 1) / 2) +
      wv * Math.sin(u * Math.PI * 1.5 + phase);
    d += `${i ? "L" : "M"}${f(x)},${f(yy)}`;
  }
  return d;
}

export class CloudEngine {
  private state: CloudState = "idle";
  private level = 0;
  private target = 0;
  private t = Math.random() * 10;
  /** Seconds since the current state began. */
  private since = 0;
  private last = 0;
  private raf = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private nextBlink = performance.now() + 900 + Math.random() * 3000;
  private fixStep = -1;
  private readonly r: Record<string, Element> = {};
  private readonly samples: number;
  private readonly sy = spring();
  private readonly sx = spring();
  private readonly ty = spring(0);
  private readonly blink = spring();
  private readonly happy = spring(0);
  private readonly wink = spring(0);
  private readonly lx = spring(0);
  private readonly ly = spring(0);
  /** Face-only nod, on top of where the eyes look. */
  private readonly nod = spring(0);
  /** A little side-to-side wiggle when something worked. */
  private readonly tilt = spring(0);
  private carried = false;
  /** Each leg's swing (degrees) and foot lift, eased toward the pose. */
  private readonly legSwing = [0, 0];
  private readonly legLift = [0, 0];
  /** The pose, every number on its own spring. */
  private readonly p: Record<keyof Pose, Spring>;
  /** Extras: sparkles, "?", "z". */
  private readonly sp = spring(0);
  private readonly qm = spring(0);
  private readonly zz = spring(0);

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
    const idle = POSES.idle;
    this.p = Object.fromEntries(
      (Object.keys(idle) as (keyof Pose)[]).map((k) => [k, spring(idle[k])]),
    ) as Record<keyof Pose, Spring>;
    this.raf = requestAnimationFrame(this.frame);
  }

  setState(s: CloudState) {
    if (s === this.state) return;
    const prev = this.state;
    this.state = s;
    this.since = 0;
    this.fixStep = -1;
    const pose = POSES[s];
    for (const k in pose) this.p[k as keyof Pose].to = pose[k as keyof Pose];
    this.happy.to = s === "done" ? 1 : 0;
    this.wink.to = s === "clean" ? 1 : 0;
    this.sp.to = s === "refining" ? 1 : 0;
    this.qm.to = s === "confused" ? 1 : 0;
    this.zz.to = s === "sleepy" ? 1 : 0;
    if (s === "done") {
      this.sy.v -= 2.8;
      this.sx.v += 1.8;
      this.ty.v -= 200;
      this.tilt.v += 160;
    }
    if (s === "clean") {
      this.nod.v += 70;
      this.sy.v += 0.9;
      this.ty.v -= 70;
    }
    if (s === "listening" && prev !== "listening") {
      this.sy.v += 1.5;
      this.sx.v -= 0.8;
      this.ty.v -= 60;
    }
    if (s === "confused") this.tilt.v -= 60;
    if (s === "error") {
      this.sy.v += 1.2;
      this.nod.v += 40;
    }
  }

  /** Picked up and being dragged: the legs dangle and kick. */
  setCarried(carried: boolean) {
    this.carried = carried;
  }

  /** Voice loudness, 0..1. Only used while listening. */
  setLevel(level: number) {
    this.target = Math.max(0, Math.min(1, level));
  }

  /** Where each leg points for what Vobi is doing. */
  private legs(
    st: CloudState,
    t: number,
    L: number,
    ty: number,
    dt: number,
    still: boolean,
  ) {
    const hop = clamp01(-ty / 26);
    for (const [i, s] of [
      [0, -1],
      [1, 1],
    ] as const) {
      const phase = s < 0 ? 0 : Math.PI;
      let swing = 0;
      let lift = 0;
      if (this.carried) {
        // Dangling from the pointer, kicking a little.
        swing = Math.sin(t * 13 + phase) * 22;
      } else if (still) {
        swing = 0;
      } else if (st === "listening") {
        // Tapping one foot along with the voice.
        if (s > 0) lift = Math.max(0, Math.sin(t * 8)) * (1.5 + L * 3);
      } else if (
        st === "transcribing" ||
        st === "thinking" ||
        st === "refining" ||
        st === "fixing"
      ) {
        // Jogging on the spot while it works.
        swing = Math.sin(t * 11 + phase) * 13;
        lift = Math.max(0, Math.sin(t * 11 + phase)) * 2.6;
      } else if (st === "done") {
        // Both legs kick out on the hop.
        swing = s * 26 * hop;
      } else if (st === "clean") {
        if (s > 0) swing = 16;
      } else if (st === "confused") {
        if (s > 0) swing = Math.sin(t * 3.2) * 11;
      } else if (st === "error") {
        // Knock-kneed.
        swing = -s * 11;
      } else if (st === "sleepy") {
        swing = s * 3;
      } else {
        // Idle: a lazy little sway.
        swing = Math.sin(t * 1.7 + phase / 2) * 5;
      }
      const k = Math.min(1, dt * 16);
      this.legSwing[i] += (swing - this.legSwing[i]) * k;
      this.legLift[i] += (lift - this.legLift[i]) * k;
      const a = (this.legSwing[i] * Math.PI) / 180;
      const hipX = s * 12.5;
      const hipY = 32;
      const len = this.carried ? 17 : 15.5;
      const fx = hipX + Math.sin(a) * len;
      const fy = hipY + Math.cos(a) * len - this.legLift[i];
      const key = i ? "r" : "l";
      set(this.r[`leg${key}`], { d: `M${f(hipX)},${hipY} L${f(fx)},${f(fy)}` });
      set(this.r[`foot${key}`], {
        cx: f(fx + s * 1.6),
        cy: f(fy + 1.2),
        transform: `rotate(${f(this.legSwing[i] * 0.6)} ${f(fx)} ${f(fy)})`,
      });
    }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
  }

  private frame = (now: number) => {
    const dt = Math.min(0.033, (now - (this.last || now)) / 1000 || 0.016);
    this.last = now;
    this.t += dt;
    this.since += dt;
    const st = this.state;
    const still = reduceMotion();
    const t = still ? 0 : this.t;
    const p = this.p;

    const tl = st === "listening" ? this.target : 0;
    this.level += (tl - this.level) * (tl > this.level ? 0.45 : 0.12);
    const L = this.level;

    if (now > this.nextBlink && st !== "done" && st !== "sleepy") {
      this.blink.x = 0.08;
      this.blink.v = 0;
      this.nextBlink = now + 2400 + Math.random() * 3400;
    }

    // Where the eyes look, per state.
    let lx = 0;
    let ly = 0;
    if (st === "thinking") {
      lx = 3.5 * Math.sign(Math.sin(this.t * 1.3));
      ly = -2.5;
    } else if (st === "listening") ly = -1;
    else if (st === "transcribing") {
      // Reading: drift left to right along a line, then flick back.
      const ph = (this.t / 1.5) % 1;
      lx = still ? 0 : ph < 0.82 ? -3.4 + (ph / 0.82) * 6.8 : -3.4;
      ly = 2.4;
    } else if (st === "refining") {
      lx = still ? 2 : 3.2 * Math.sin(this.t * 0.9);
      ly = -3;
    } else if (st === "fixing") {
      // Quick little checks across the text, with a tiny nod at each one.
      const i = Math.floor(this.t / 0.48);
      if (i !== this.fixStep) {
        if (this.fixStep >= 0 && !still) this.nod.v += 26;
        this.fixStep = i;
      }
      lx = still ? 0 : [-3, 0.5, 3, -0.8][i % 4];
      ly = 2.6;
    } else if (st === "confused") {
      lx = still ? 2.5 : 3.2 * Math.sin(this.t * 1.15);
      ly = -1.2;
    } else if (st === "error") ly = 1.8;
    else if (st === "sleepy") ly = 1;
    this.lx.to = lx;
    this.ly.to = ly;

    // Sleepy: a slow yawn every few seconds.
    const yawn =
      st === "sleepy" && !still
        ? Math.pow(Math.max(0, Math.sin(this.t * 1.1)), 4)
        : 0;

    const breathe = still
      ? 0
      : Math.sin(this.t * (st === "idle" ? 1.3 : st === "sleepy" ? 0.9 : 2.4)) *
        (st === "idle" || st === "sleepy" ? 0.022 : 0.015);
    const size = p.size.x;
    this.sy.to = size * (1 + breathe + L * 0.1 + yawn * 0.03);
    this.sx.to = size * (1 - breathe * 0.5 + L * 0.05);

    step(this.sy, 260, 13, dt);
    step(this.sx, 260, 13, dt);
    step(this.ty, 220, 16, dt);
    step(this.blink, 300, 22, dt);
    step(this.happy, 240, 22, dt);
    step(this.wink, 260, 22, dt);
    step(this.lx, st === "fixing" ? 320 : 140, st === "fixing" ? 26 : 16, dt);
    step(this.ly, 140, 16, dt);
    step(this.nod, 260, 14, dt);
    step(this.tilt, 170, 7, dt);
    step(this.sp, 120, 18, dt);
    step(this.qm, 160, 16, dt);
    step(this.zz, 90, 16, dt);
    for (const k in p) step(p[k as keyof Pose], 170, 22, dt);

    const hap = clamp01(this.happy.x);
    const wink = clamp01(this.wink.x);
    const ty = Math.min(0, this.ty.x);

    const puffs = PUFFS.map(([cx, cy, rr], i): Puff => {
      const ph = i * 1.9;
      let d = Math.sin(t * (1.1 + i * 0.17) + ph) * 0.9;
      if (st === "listening")
        d += Math.max(0, Math.sin(t * 9 + ph * 1.4)) * L * 5.5;
      if (st === "thinking")
        d += Math.max(0, Math.sin(t * 4.2 - i * 0.9)) * 2.6;
      // Typing along: small, even puffs in turn.
      if (st === "transcribing")
        d += Math.max(0, Math.sin(t * 7 - i * 1.6)) * 1.3;
      // Mulling it over: a slow swirl around the cloud.
      if (st === "refining") d += Math.sin(t * 1.8 - i * 1.4) * 2;
      return [cx, cy, rr + d];
    });
    const d = cloudPath(puffs, this.samples);
    set(this.r.body, { d });
    set(this.r.clip, { d });
    set(this.r.rim, { d });
    const lean =
      p.tilt.x + (st === "sleepy" && !still ? Math.sin(this.t * 0.9) * 2 : 0);
    set(this.r.root, {
      transform: `translate(0 ${f(ty)}) translate(0 ${BASE_Y}) rotate(${f(still ? p.tilt.to : this.tilt.x + lean)}) scale(${this.sx.x.toFixed(3)} ${this.sy.x.toFixed(3)}) translate(0 ${-BASE_Y})`,
    });
    set(this.r.shadow, { opacity: (0.12 * (1 + ty / 45)).toFixed(3) });
    if (this.r.legl) this.legs(st, t, L, ty, dt, still);

    // Face
    const mono = !!this.o.mono;
    const gap = mono ? 13 : 12;
    const rx = mono ? 5.5 : 4.6;
    const ry = mono ? 7.5 : 6.2;
    const ex = this.lx.x;
    const big = p.big.x;
    const ey = (mono ? 15 : 16) + this.ly.x + this.nod.x * 0.06;
    const lid = Math.max(0.06, this.blink.x) * p.open.x * (1 - yawn * 0.6);
    for (const [key, s] of [
      ["el", -1],
      ["er", 1],
    ] as const) {
      const arc = s > 0 ? Math.max(hap, wink) : hap;
      const open = lid * (1 - arc);
      const h = Math.max(0.6, ry * big * open);
      set(this.r[key], {
        cx: f(s * gap + ex),
        // Keep the bottom of the eye still so a closing eye looks like a lid.
        cy: f(ey + (ry * big - h) * 0.55),
        rx: f(rx * big),
        ry: f(h),
        opacity: arc > 0.85 ? 0 : 1,
      });
    }
    for (const [key, s] of [
      ["al", -1],
      ["ar", 1],
    ] as const) {
      const arc = s > 0 ? Math.max(hap, wink) : hap;
      const cx = s * gap + ex;
      const w = rx * 1.25;
      set(this.r[key], {
        d: `M${f(cx - w)},${f(ey + 1.5)} Q${f(cx)},${f(ey - 4.2)} ${f(cx + w)},${f(ey + 1.5)}`,
        opacity: f(arc > 0.5 ? Math.min(1, (arc - 0.5) * 3) : 0),
      });
    }
    [1, 2, 3, 4].forEach((i) => {
      const s = i % 2 ? -1 : 1;
      const small = i > 2;
      const arc = s > 0 ? Math.max(hap, wink) : hap;
      set(this.r[`g${i}`], {
        cx: f(s * gap + ex + (small ? -1.6 : 1.5) * big),
        cy: f(ey + (small ? 2.4 : -2.2) * big),
        opacity: lid * (1 - arc) > 0.55 ? 1 : 0,
      });
    });
    const blush = f(clamp01(p.blush.x + hap * 0.3));
    set(this.r.bl, {
      cx: f(-gap - 9 + ex * 0.5),
      cy: f(ey + 6),
      opacity: blush,
    });
    set(this.r.br, {
      cx: f(gap + 9 + ex * 0.5),
      cy: f(ey + 6),
      opacity: blush,
    });

    // Brows sit just above each eye; the inner ends tip up (worried) or down (focused).
    if (this.r.wl) {
      for (const [key, s] of [
        ["wl", -1],
        ["wr", 1],
      ] as const) {
        const cx = s * gap + ex;
        // Brows follow the top of the eye down as it narrows.
        const by =
          ey - ry * big * (0.45 + 0.55 * p.open.x) - 3.2 - (s < 0 ? p.bl.x : 0);
        const w = 4.2;
        const slope = p.bs.x;
        const arch = s < 0 ? p.bl.x * 0.5 : 0;
        // Outer end, inner end (towards the middle of the face).
        const ox = cx + s * w;
        const ix = cx - s * w;
        set(this.r[key], {
          d: `M${f(ox)},${f(by + slope * 0.5)} Q${f(cx)},${f(by - (slope < 0 ? 0.4 : 1.2) - arch)} ${f(ix)},${f(by - slope)}`,
          opacity: f(clamp01(p.brow.x)),
        });
      }
    }

    if (this.r.smile) {
      const talk = st === "listening" ? L : 0;
      const my = ey + 7.5;
      const mx = ex * 0.6;
      const mo = clamp01(p.mo.x + yawn * 0.9);
      const oShape = talk > 0.06 ? 0 : mo;
      set(this.r.mouth, {
        cx: f(mx),
        cy: f(my + 1 + oShape * 0.6),
        rx: f(talk > 0.06 ? 2.6 + talk * 0.8 : 1.3 + oShape * 1.3),
        ry: f(talk > 0.06 ? 0.5 + talk * 3.6 : 1.1 + oShape * 2.4),
        opacity: talk > 0.06 ? 1 : f(clamp01(oShape * 3)),
      });
      const w = p.mw.x;
      const dp = p.dp.x;
      // Happy: the smile opens into a grin with a little tongue.
      const grin = hap > 0.4 ? Math.min(1, (hap - 0.4) * 2.5) : 0;
      set(this.r.smile, {
        d: mouthPath(mx, my, w, dp, p.asym.x, p.wv.x, t * 2.2),
        opacity: talk > 0.06 ? 0 : f((1 - grin) * (1 - clamp01(oShape * 3))),
      });
      const gw = 4.6;
      const gd = 6.4 * grin;
      const y = my;
      set(this.r.grin, {
        d: `M${f(mx - gw)},${f(y - 0.6)} Q${f(mx)},${f(y - 1.4)} ${f(mx + gw)},${f(y - 0.6)} Q${f(mx + gw * 0.7)},${f(y + gd)} ${f(mx)},${f(y + gd)} Q${f(mx - gw * 0.7)},${f(y + gd)} ${f(mx - gw)},${f(y - 0.6)}Z`,
        opacity: talk > 0.06 ? 0 : f(grin),
      });
      set(this.r.tongue, {
        cx: f(mx),
        cy: f(y + gd * 0.78),
        rx: f(2.4 * grin),
        ry: f(1.5 * grin),
        opacity: talk > 0.06 ? 0 : f(grin),
      });
    }

    // Extras around the head.
    if (this.r.s1) {
      const sp = clamp01(this.sp.x);
      (
        [
          ["s1", 38, -38, 0],
          ["s2", -44, -28, 2.1],
          ["s3", 48, -10, 4.2],
        ] as const
      ).forEach(([key, x, y, ph]) => {
        const tw = still ? 0.85 : 0.5 + 0.5 * Math.sin(this.t * 2.6 + ph);
        const sc = sp * (0.55 + 0.45 * tw);
        set(this.r[key], {
          transform: `translate(${x} ${f(y - (1 - sp) * 6)}) rotate(${f(still ? 0 : this.t * 25 + ph * 20)}) scale(${sc.toFixed(3)})`,
          opacity: f(sp * (0.45 + 0.55 * tw)),
        });
      });
      const q = clamp01(this.qm.x);
      set(this.r.q, {
        transform: `translate(38 ${f(-38 + (still ? 0 : Math.sin(this.t * 2.4) * 2.4) + (1 - q) * 8)}) rotate(${f(still ? 10 : 10 + Math.sin(this.t * 1.7) * 10)}) scale(${(0.6 + q * 0.4).toFixed(3)})`,
        opacity: f(q),
      });
      const z = clamp01(this.zz.x);
      (
        [
          ["z1", 0],
          ["z2", 0.5],
        ] as const
      ).forEach(([key, off]) => {
        const ph = still ? 0.35 + off : (this.t / 2.8 + off) % 1;
        set(this.r[key], {
          transform: `translate(${f(30 + ph * 14 + Math.sin(ph * 6) * 2)} ${f(-24 - ph * 30)}) rotate(-12) scale(${(0.55 + ph * 0.6).toFixed(3)})`,
          opacity: f(z * Math.sin(Math.min(1, ph) * Math.PI)),
        });
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
