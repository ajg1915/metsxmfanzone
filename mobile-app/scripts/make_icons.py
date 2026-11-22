"""Builds the Android launcher icons from the MetsXMFanZone app icon (mobile-app/icons/app-icon.png).
Run from mobile-app/ after `npx cap add android`."""
import os
import sys
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else "icons/app-icon.png"
RES = "android/app/src/main/res"
icon = Image.open(SRC).convert("RGBA")
icon = icon.crop(icon.getbbox())
BG_HEX = "#0B3A8C"  # blue behind the icon on adaptive (round / squircle) launchers

def square(px):
    s = max(icon.size)
    sq = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sq.paste(icon, ((s - icon.width) // 2, (s - icon.height) // 2))
    return sq.resize((px, px), Image.LANCZOS)

def foreground(px):
    # adaptive-icon layer: keep the artwork inside the centre safe zone so no launcher mask cuts it
    layer = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    art = square(int(px * 0.62))
    layer.alpha_composite(art, ((px - art.width) // 2, (px - art.height) // 2))
    return layer

sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for density, px in sizes.items():
    folder = f"{RES}/mipmap-{density}"
    os.makedirs(folder, exist_ok=True)
    full = square(px)
    full.save(f"{folder}/ic_launcher.png")
    full.save(f"{folder}/ic_launcher_round.png")
    foreground(int(px * 108 / 48)).save(f"{folder}/ic_launcher_foreground.png")

os.makedirs(f"{RES}/values", exist_ok=True)
with open(f"{RES}/values/ic_launcher_background.xml", "w") as f:
    f.write(f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{BG_HEX}</color>\n</resources>\n')
print("Launcher icons written.")
