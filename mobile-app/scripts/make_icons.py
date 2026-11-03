"""Builds the launcher icons from the site's logo: logo on the dark blue MetsXMFanZone tile with an orange edge.
Run from mobile-app/ after `npx cap add android`. Images are generated in the build, not stored in the repo."""
import os
import sys
from PIL import Image, ImageDraw

SRC = sys.argv[1] if len(sys.argv) > 1 else "../src/assets/metsxmfanzone-logo.png"
RES = "android/app/src/main/res"
logo = Image.open(SRC).convert("RGBA")
logo = logo.crop(logo.getbbox())

def tile(px):
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
    w = int(S * 0.78)
    h = int(logo.height * w / logo.width)
    art = logo.resize((w, h), Image.LANCZOS)
    img.alpha_composite(art, ((S - w) // 2, (S - h) // 2))
    return img.resize((px, px), Image.LANCZOS)

sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for density, px in sizes.items():
    folder = f"{RES}/mipmap-{density}"
    os.makedirs(folder, exist_ok=True)
    icon = tile(px)
    for name in ("ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"):
        icon.save(f"{folder}/{name}")
print("Launcher icons written.")
