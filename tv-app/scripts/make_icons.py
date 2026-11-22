"""Builds the Android launcher icons and the TV banner from the MetsXMFanZone TV app icon (tv-app/icons/tv-icon.png).
The launcher icon is the dark blue MetsXMFanZone tile with an orange edge and the icon artwork inside.
Run from tv-app/ after `npx cap add android`."""
import os
import sys
from PIL import Image, ImageDraw

SRC = sys.argv[1] if len(sys.argv) > 1 else "icons/tv-icon.png"
RES = "android/app/src/main/res"
BG_HEX = "#0B3A8C"
icon = Image.open(SRC).convert("RGBA")
icon = icon.crop(icon.getbbox())

def tile(px, art_scale=0.80):
    """Dark blue MetsXMFanZone tile with an orange edge and the icon artwork in the middle."""
    S = px * 4
    g = Image.new("RGB", (S, S))
    pix = g.load()
    c1, c2 = (15, 79, 147), (7, 17, 29)
    for y in range(S):
        for x in range(S):
            t = min(1, max(0, (x * 0.35 + y * 0.65) / S))
            pix[x, y] = tuple(int(c1[i] * (1 - t) + c2[i] * t) for i in range(3))
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), radius=int(S * 0.22), fill=255)
    img.paste(g, (0, 0), mask)
    ImageDraw.Draw(img).rounded_rectangle((S * 0.012, S * 0.012, S * 0.988, S * 0.988), radius=int(S * 0.21), outline=(255, 68, 0), width=max(2, int(S * 0.018)))
    a = art(int(S * art_scale))
    img.alpha_composite(a, ((S - a.width) // 2, (S - a.height) // 2))
    return img.resize((px, px), Image.LANCZOS)

def tile_round(px):
    """Round launcher icon: dark blue circle with a circular orange edge and the artwork inside."""
    S = px * 4
    c1, c2 = (15, 79, 147), (7, 17, 29)
    g = Image.new("RGB", (S, S))
    pix = g.load()
    for y in range(S):
        for x in range(S):
            t = min(1, max(0, (x * 0.35 + y * 0.65) / S))
            pix[x, y] = tuple(int(c1[i] * (1 - t) + c2[i] * t) for i in range(3))
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, S - 1, S - 1), fill=255)
    img.paste(g, (0, 0), mask)
    ImageDraw.Draw(img).ellipse((S * 0.012, S * 0.012, S * 0.988, S * 0.988), outline=(255, 68, 0), width=max(2, int(S * 0.02)))
    a = art(int(S * 0.62))
    img.alpha_composite(a, ((S - a.width) // 2, (S - a.height) // 2))
    return img.resize((px, px), Image.LANCZOS)

def adaptive_foreground(px):
    """Adaptive-icon layer (108dp canvas): dark blue fill, orange ring and the artwork, all inside the safe zone."""
    S = px * 4
    c1, c2 = (15, 79, 147), (7, 17, 29)
    g = Image.new("RGB", (S, S))
    pix = g.load()
    for y in range(S):
        for x in range(S):
            t = min(1, max(0, (x * 0.35 + y * 0.65) / S))
            pix[x, y] = tuple(int(c1[i] * (1 - t) + c2[i] * t) for i in range(3))
    img = g.convert("RGBA")
    box = int(S * 0.58)
    o = (S - box) // 2
    ImageDraw.Draw(img).ellipse((o, o, o + box, o + box), outline=(255, 68, 0), width=max(2, int(S * 0.014)))
    a = art(int(box * 0.74))
    img.alpha_composite(a, ((S - a.width) // 2, (S - a.height) // 2))
    return img.resize((px, px), Image.LANCZOS)

def art(size):
    s = max(icon.size)
    sq = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sq.paste(icon, ((s - icon.width) // 2, (s - icon.height) // 2))
    return sq.resize((size, size), Image.LANCZOS)

os.makedirs(f"{RES}/drawable", exist_ok=True)
banner = Image.new("RGBA", (320, 180), (7, 16, 31, 255))
a = art(160)
banner.alpha_composite(a, ((320 - 160) // 2, (180 - 160) // 2))
banner.convert("RGB").save(f"{RES}/drawable/tv_banner.png")

sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for density, px in sizes.items():
    folder = f"{RES}/mipmap-{density}"
    os.makedirs(folder, exist_ok=True)
    full = tile(px)
    full.save(f"{folder}/ic_launcher.png")
    tile_round(px).save(f"{folder}/ic_launcher_round.png")
    adaptive_foreground(int(px * 108 / 48)).save(f"{folder}/ic_launcher_foreground.png")

os.makedirs(f"{RES}/values", exist_ok=True)
with open(f"{RES}/values/ic_launcher_background.xml", "w") as f:
    f.write(f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{BG_HEX}</color>\n</resources>\n')
print("Launcher icons written.")
