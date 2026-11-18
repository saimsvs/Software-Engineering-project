"""Generate the app icon, Android adaptive icon and splash image from the
CarbonTrail logo (a leaf inside a light grey ring — the logo shown top-left on
the Home screen). The original logo.png is only 86px, so the leaf was traced
into smooth curves and is redrawn here at full resolution so it stays sharp.

Run from the project root:  python3 scripts/make-app-icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets/images"

RING = (184, 184, 184, 255)  # colours sampled from logo.png
INK = (23, 23, 23, 255)
SS = 4  # supersampling for smooth edges

# --- Leaf traced from the original 86px logo (coordinates in that space) ---
# Leaf traced from logo.png (86px space, pixel centres). Tip = sharp corner.
OUTLINE = [(58.6,35.3),(52,35.4),(46,36.5),(41.5,38.2),(37.5,40.3),(34,42.6),(31,45.2),(29,47.8),(28.2,50.5),(28.3,53.5),(29.3,56.3),(31.3,58.2),(34.5,59.4),(38.5,59.8),(42.3,59.3),(45.6,58),(48.6,56),(51.3,53.6),(53.7,50.8),(55.7,47.6),(57.2,44.2),(58.2,40.5),(58.6,37.5)]
VEINS = [
  [(30.2,58.3),(33.5,55.5),(37,52.4),(40.5,49.4),(44,46.6),(47,44.6),(49.8,43.3)],
  [(35.6,46.2),(35.6,56)],
  [(41.2,49.7),(54.2,49.7)],
]
def catmull(pts, closed, n=12, corner_idx=None):
    out=[]; N=len(pts)
    rng = range(N) if closed else range(N-1)
    for i in rng:
        p0=pts[(i-1)%N] if (closed or i>0) else pts[i]
        p1=pts[i]; p2=pts[(i+1)%N]
        p3=pts[(i+2)%N] if (closed or i+2<N) else p2
        if corner_idx is not None:
            if i==corner_idx: p0=p1
            if (i+1)%N==corner_idx: p3=p2
        for k in range(n):
            t=k/n; t2=t*t; t3=t2*t
            out.append(tuple(0.5*((2*p1[j])+(-p0[j]+p2[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3) for j in (0,1)))
    if not closed: out.append(pts[-1])
    else: out.append(out[0])
    return out
def stroke(d, pts, width, fill):
    """Smooth round-capped stroke: stamp overlapping discs densely along the path
    (avoids the hairline gaps PIL leaves between many short thick segments)."""
    r = width / 2
    step = max(1.0, width / 8)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        seg = max(abs(x1 - x0), abs(y1 - y0))
        n = max(1, int(seg / step))
        for k in range(n + 1):
            x = x0 + (x1 - x0) * k / n
            y = y0 + (y1 - y0) * k / n
            d.ellipse((x - r, y - r, x + r, y + r), fill=fill)

def draw_leaf(d, scale, ox, oy, width, fill):
    T=lambda pts:[(ox+x*scale, oy+y*scale) for x,y in pts]
    stroke(d, T(catmull(OUTLINE, True, corner_idx=0)), width, fill)
    for v in VEINS:
        stroke(d, T(v if len(v) == 2 else catmull(v, False)), width, fill)

# Ring in the original logo: centre (41, 49.5), outer diameter 64.
RING_CX, RING_CY, RING_D = 41.0, 49.5, 64.0


def draw_logo(size: int, diameter: float, ring=RING, ink=INK, bg=(0, 0, 0, 0)) -> Image.Image:
    """Logo centred on a size x size canvas; `diameter` is the ring's outer size."""
    big = size * SS
    img = Image.new("RGBA", (big, big), bg)
    d = ImageDraw.Draw(img)

    D = diameter * SS
    k = D / RING_D  # original-logo px -> canvas px
    c = big / 2
    d.ellipse((c - D / 2, c - D / 2, c + D / 2, c + D / 2), outline=ring, width=max(SS, round(1.5 * k)))
    draw_leaf(d, k, c - RING_CX * k, c - RING_CY * k, max(SS, round(1.9 * k)), ink)

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    white = (255, 255, 255, 255)

    # Launcher icon (iOS / fallback): white square, logo filling most of it.
    draw_logo(1024, 860, bg=white).save(OUT / "icon.png")

    # Android adaptive icon: transparent foreground kept inside the ~66% safe
    # zone (launchers crop the edges into circles/squircles) + white background.
    draw_logo(1024, 600).save(OUT / "android-icon-foreground.png")
    Image.new("RGBA", (1024, 1024), white).save(OUT / "android-icon-background.png")
    # Monochrome (Android 13 themed icons): single-colour silhouette.
    draw_logo(1024, 600, ring=white, ink=white).save(OUT / "android-icon-monochrome.png")

    # Splash: transparent logo shown on a white background (see app.json).
    draw_logo(1024, 1000).save(OUT / "splash-icon.png")

    # Sharper version of the in-app logo (Home header / loading screen), with
    # the ring at the same 64/86 share of the image as the original logo.png.
    draw_logo(512, 512 * 64 / 86).save(OUT / "logo.png")

    print("Wrote icon.png, android-icon-*.png, splash-icon.png, logo.png to", OUT)


if __name__ == "__main__":
    main()
