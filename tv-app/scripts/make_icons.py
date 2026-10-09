"""Builds the TV banner and launcher icons from the site's own logo (src/assets/metsxmfanzone-logo.png).
Run from tv-app/ after `npx cap add android`. Keeps images out of the repo: they are generated in the build."""
import os
import sys
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else "../src/assets/metsxmfanzone-logo.png"
RES = "android/app/src/main/res"
BG = (7, 16, 31, 255)  # #07101f

logo = Image.open(SRC).convert("RGBA")

def fit(img, box_w, box_h, pad=0.12):
    w = int(box_w * (1 - 2 * pad))
    h = int(box_h * (1 - 2 * pad))
    scale = min(w / img.width, h / img.height)
    return img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.LANCZOS)

def on_canvas(w, h, pad=0.12):
    canvas = Image.new("RGBA", (w, h), BG)
    art = fit(logo, w, h, pad)
    canvas.paste(art, ((w - art.width) // 2, (h - art.height) // 2), art)
    return canvas

# Android TV banner: 320x180
os.makedirs(f"{RES}/drawable", exist_ok=True)
on_canvas(320, 180, 0.1).convert("RGB").save(f"{RES}/drawable/tv_banner.png")

# Launcher icons
sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for density, px in sizes.items():
    folder = f"{RES}/mipmap-{density}"
    os.makedirs(folder, exist_ok=True)
    icon = on_canvas(px, px, 0.08).convert("RGB")
    for name in ("ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"):
        icon.save(f"{folder}/{name}")
print("Banner and icons written.")
