"""Generate Vobi's tray icons and app-icon SVG from the cloud geometry.

Run from the repo root:  python3 design/icon/make_icons.py
Tray PNGs go to src-tauri/resources/, the app icon SVG to design/icon/.
The cloud matches src/components/vobi/cloudEngine.ts (polar union of puffs).
"""
import math
from PIL import Image, ImageDraw

PUFFS = [(-21, -2, 17), (-2, -14, 22), (21, -6, 18), (33, 8, 11)]
BASE = (-42, 4, 84, 34)
ORIGIN = (0, 10)


def cloud_points(n=240, smooth=3):
    circles = list(PUFFS)
    bx, by, bw, bh = BASE
    br = bh / 2
    x = bx + br
    step = max(4, (bw - bh) / 6)
    while x <= bx + bw - br + 0.01:
        circles.append((x, by + br, br))
        x += step
    ox, oy = ORIGIN
    radii = []
    for i in range(n):
        a = i / n * math.tau
        dx, dy = math.cos(a), math.sin(a)
        best = 0
        for cx, cy, r in circles:
            px, py = cx - ox, cy - oy
            b = dx * px + dy * py
            disc = b * b - (px * px + py * py - r * r)
            if disc >= 0:
                best = max(best, b + math.sqrt(disc))
        radii.append(best)
    for _ in range(smooth):
        c = radii[:]
        radii = [(c[i - 1] + 2 * c[i] + c[(i + 1) % n]) / 4 for i in range(n)]
    return [(ox + math.cos(i / n * math.tau) * r, oy + math.sin(i / n * math.tau) * r) for i, r in enumerate(radii)]


PTS = cloud_points()
# cloud bounds: x -45..45, y -38..39  -> centre (0, 0.5), size ~90 x 77


def tray(kind, color, size=64, ss=8):
    """kind: idle | recording | transcribing | warning"""
    S = size * ss
    shift_x = -9 if kind == "recording" else 0
    scale = S / 104 if kind != "recording" else S / 118
    cx, cy = S / 2 + shift_x * scale, S / 2 + 1 * scale

    def P(x, y):
        return (cx + x * scale, cy + y * scale)

    mask = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(mask)
    d.polygon([P(x, y) for x, y in PTS], fill=255)
    # face cut-outs
    if kind == "transcribing":
        for ex in (-14, 0, 14):
            r = 4.6
            d.ellipse([*P(ex - r, 13 - r), *P(ex + r, 13 + r)], fill=0)
    else:
        for ex in (-13, 13):
            rx, ry = 5.6, 7.6
            d.ellipse([*P(ex - rx, 13 - ry), *P(ex + rx, 13 + ry)], fill=0)
    if kind == "recording":
        w = 6.5 * scale
        for i, rad in enumerate((14, 25)):
            box = [*P(44 - rad, 6 - rad), *P(44 + rad, 6 + rad)]
            d.arc(box, start=-50, end=50, fill=255, width=int(w))
    if kind == "warning":
        bx, by, R = 33, 26, 17
        d.ellipse([*P(bx - R - 5, by - R - 5), *P(bx + R + 5, by + R + 5)], fill=0)
        d.ellipse([*P(bx - R, by - R), *P(bx + R, by + R)], fill=255)
        d.rounded_rectangle([*P(bx - 3, by - 10), *P(bx + 3, by + 3)], radius=3 * scale, fill=0)
        d.ellipse([*P(bx - 3.4, by + 6), *P(bx + 3.4, by + 12.8)], fill=0)
    img = Image.new("RGBA", (S, S), color + (0,))
    solid = Image.new("RGBA", (S, S), color + (255,))
    img = Image.composite(solid, img, mask)
    return img.resize((size, size), Image.LANCZOS)


def colored(kind, size=64, ss=8):
    """Linux 'colored' tray: Ocean blue cloud, white face."""
    S = size * ss
    base = tray(kind, (255, 255, 255), size=size, ss=ss)  # just to reuse geometry? no: draw directly
    scale = S / 104 if kind != "recording" else S / 118
    shift_x = -9 if kind == "recording" else 0
    cx, cy = S / 2 + shift_x * scale, S / 2 + 1 * scale

    def P(x, y):
        return (cx + x * scale, cy + y * scale)

    grad = Image.new("RGBA", (S, S))
    top, bot = (110, 214, 252), (43, 127, 240)
    gp = grad.load()
    for y in range(S):
        t = y / (S - 1)
        c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)) + (255,)
        for x in range(S):
            gp[x, y] = c
    mask = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(mask)
    d.polygon([P(x, y) for x, y in PTS], fill=255)
    if kind == "recording":
        for rad in (14, 25):
            d.arc([*P(44 - rad, 6 - rad), *P(44 + rad, 6 + rad)], start=-50, end=50, fill=255, width=int(6.5 * scale))
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    img = Image.composite(grad, img, mask)
    f = ImageDraw.Draw(img)
    navy = (20, 48, 76, 255)
    if kind == "transcribing":
        for ex in (-14, 0, 14):
            r = 4.6
            f.ellipse([*P(ex - r, 13 - r), *P(ex + r, 13 + r)], fill=navy)
    else:
        for ex in (-13, 13):
            f.ellipse([*P(ex - 5.6, 13 - 7.6), *P(ex + 5.6, 13 + 7.6)], fill=navy)
    if kind == "warning":
        bx, by, R = 33, 26, 17
        f.ellipse([*P(bx - R, by - R), *P(bx + R, by + R)], fill=(229, 72, 77, 255), outline=(255, 255, 255, 255), width=int(4 * scale))
        f.rounded_rectangle([*P(bx - 3, by - 10), *P(bx + 3, by + 3)], radius=3 * scale, fill=(255, 255, 255, 255))
        f.ellipse([*P(bx - 3.4, by + 6), *P(bx + 3.4, by + 12.8)], fill=(255, 255, 255, 255))
    return img.resize((size, size), Image.LANCZOS)


def app_icon_svg():
    path = "M" + "L".join(f"{x:.2f},{y:.2f}" for x, y in PTS) + "Z"
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7FCFF"/><stop offset="1" stop-color="#CDE8FC"/></linearGradient>
    <radialGradient id="bgGlow" cx=".5" cy=".42" r=".55"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".95"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
    <linearGradient id="f" x1="0" y1="-40" x2="0" y2="40" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#DDF7FF"/><stop offset=".55" stop-color="#5ACCFB"/><stop offset="1" stop-color="#2B7FF0"/></linearGradient>
    <radialGradient id="hi"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="ao"><stop offset="0" stop-color="#1B44C9" stop-opacity=".55"/><stop offset="1" stop-color="#1B44C9" stop-opacity="0"/></radialGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="#9EEBFF" stop-opacity=".85"/><stop offset="1" stop-color="#9EEBFF" stop-opacity="0"/></radialGradient>
    <radialGradient id="bl"><stop offset="0" stop-color="#FF7EAA" stop-opacity=".75"/><stop offset="1" stop-color="#FF7EAA" stop-opacity="0"/></radialGradient>
    <linearGradient id="rim" x1="0" y1="-40" x2="0" y2="20" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="200%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#1B44C9" flood-opacity=".32"/></filter>
    <filter id="tile" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#1B3E6E" flood-opacity=".28"/></filter>
    <clipPath id="clip"><path d="{path}"/></clipPath>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bg)" filter="url(#tile)"/>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bgGlow)"/>
  <rect x="101" y="101" width="822" height="822" rx="184" fill="none" stroke="#FFFFFF" stroke-opacity=".8" stroke-width="2"/>
  <g transform="translate(512 520) scale(6.6)">
    <ellipse cx="0" cy="49" rx="32" ry="3.5" fill="#0B2A4A" opacity=".1"/>
    <path d="{path}" fill="url(#f)" filter="url(#soft)"/>
    <g clip-path="url(#clip)">
      <ellipse cx="0" cy="46" rx="60" ry="24" fill="url(#ao)"/>
      <ellipse cx="0" cy="30" rx="30" ry="9" fill="url(#glow)"/>
      <ellipse cx="-12" cy="-22" rx="34" ry="18" fill="url(#hi)" opacity=".9"/>
    </g>
    <path d="{path}" fill="none" stroke="url(#rim)" stroke-width="2"/>
    <ellipse cx="-14" cy="-18" rx="6" ry="3.4" fill="#fff" opacity=".9" transform="rotate(-25 -14 -18)"/>
    <ellipse cx="-21" cy="22" rx="6" ry="3.4" fill="url(#bl)"/><ellipse cx="21" cy="22" rx="6" ry="3.4" fill="url(#bl)"/>
    <ellipse cx="-12" cy="16" rx="4.6" ry="6.2" fill="#14304C"/><ellipse cx="12" cy="16" rx="4.6" ry="6.2" fill="#14304C"/>
    <circle cx="-10.5" cy="13.8" r="1.7" fill="#fff"/><circle cx="13.5" cy="13.8" r="1.7" fill="#fff"/>
    <circle cx="-13.6" cy="18.4" r=".8" fill="#fff"/><circle cx="10.4" cy="18.4" r=".8" fill="#fff"/>
    <path d="M-2.6,23.5 Q0,25.3 2.6,23.5" fill="none" stroke="#14304C" stroke-width="2.2" stroke-linecap="round"/>
  </g>
</svg>'''


if __name__ == "__main__":
    out = "src-tauri/resources/"
    black, white = (0, 0, 0), (255, 255, 255)
    # *_dark = dark icon for light menu bars (macOS uses these as templates)
    for kind, name in [("idle", "tray_idle"), ("recording", "tray_recording"), ("transcribing", "tray_transcribing"), ("warning", "tray_idle_warning")]:
        tray(kind, black).save(out + name + "_dark.png")
        tray(kind, white).save(out + name + ".png")
    colored("idle").save(out + "handy.png")
    colored("warning").save(out + "handy_warning.png")
    colored("recording").save(out + "recording.png")
    colored("transcribing").save(out + "transcribing.png")
    open("design/icon/vobi-app-icon.svg", "w").write(app_icon_svg())
    print("done")
