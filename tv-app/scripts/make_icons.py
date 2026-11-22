"""Builds the TV banner and launcher icons from the MetsXMFanZone TV app icon (tv-app/icons/tv-icon.png).
Run from tv-app/ after `npx cap add android`."""
import os
import sys
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else "icons/tv-icon.png"
RES = "android/app/src/main/res"
BG = (11, 58, 140, 255)  # #0B3A8C
BANNER_BG = (7, 16, 31, 255)  # #07101f

icon = Image.open(SRC).convert("RGBA")
icon = icon.crop(icon.getbbox())

def square(px):
    s = max(icon.size)
    sq = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sq.paste(icon, ((s - icon.width) // 2, (s - icon.height) // 2))
    return sq.resize((px, px), Image.LANCZOS)

# Android TV banner: 320x180, icon centred on the dark MetsXMFanZone background
os.makedirs(f"{RES}/drawable", exist_ok=True)
banner = Image.new("RGBA", (320, 180), BANNER_BG)
art = square(160)
banner.alpha_composite(art, ((320 - 160) // 2, (180 - 160) // 2))
banner.convert("RGB").save(f"{RES}/drawable/tv_banner.png")

sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for density, px in sizes.items():
    folder = f"{RES}/mipmap-{density}"
    os.makedirs(folder, exist_ok=True)
    full = square(px)
    full.save(f"{folder}/ic_launcher.png")
    full.save(f"{folder}/ic_launcher_round.png")
    layer = Image.new("RGBA", (int(px * 108 / 48),) * 2, (0, 0, 0, 0))
    art = square(int(layer.width * 0.62))
    layer.alpha_composite(art, ((layer.width - art.width) // 2, (layer.height - art.height) // 2))
    layer.save(f"{folder}/ic_launcher_foreground.png")

os.makedirs(f"{RES}/values", exist_ok=True)
with open(f"{RES}/values/ic_launcher_background.xml", "w") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0B3A8C</color>\n</resources>\n')
print("Banner and icons written.")
