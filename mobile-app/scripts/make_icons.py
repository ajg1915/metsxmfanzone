"""Builds the Android launcher icons from the MetsXMFanZone app icon (mobile-app/icons/app-icon.png).
The launcher icon is the dark blue MetsXMFanZone tile with an orange edge and the icon artwork inside.
Run from mobile-app/ after `npx cap add android`."""
import os
import sys
from PIL import Image, ImageDraw

SRC = sys.argv[1] if len(sys.argv) > 1 else "icons/app-icon.png"
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

def adaptive_foreground(px, round_shape=False):
    """Adaptive-icon layer (108dp canvas). The launcher cuts it to its own shape, so the whole canvas is orange
    and the dark blue tile sits inside it: the orange shows as the border right at the edge of the icon."""
    S = px * 4
    c1, c2 = (15, 79, 147), (7, 17, 29)
    g = Image.new("RGB", (S, S))
    pix = g.load()
    for y in range(S):
        for x in range(S):
            t = min(1, max(0, (x * 0.35 + y * 0.65) / S))
            pix[x, y] = tuple(int(c1[i] * (1 - t) + c2[i] * t) for i in range(3))
    img = Image.new("RGBA", (S, S), (255, 68, 0, 255))
    box = int(S * (0.655 if round_shape else 0.65))
    o = (S - box) // 2
    mask = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(mask)
    if round_shape:
        md.ellipse((o, o, o + box, o + box), fill=255)
    else:
        md.rounded_rectangle((o, o, o + box, o + box), radius=int(box * 0.26), fill=255)
    img.paste(g, (0, 0), mask)
    a = art(int(box * (0.78 if round_shape else 0.84)))
    img.alpha_composite(a, ((S - a.width) // 2, (S - a.height) // 2))
    return img.resize((px, px), Image.LANCZOS)

def art(size):
    s = max(icon.size)
    sq = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sq.paste(icon, ((s - icon.width) // 2, (s - icon.height) // 2))
    return sq.resize((size, size), Image.LANCZOS)

sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for density, px in sizes.items():
    folder = f"{RES}/mipmap-{density}"
    os.makedirs(folder, exist_ok=True)
    full = tile(px)
    full.save(f"{folder}/ic_launcher.png")
    tile_round(px).save(f"{folder}/ic_launcher_round.png")
    adaptive_foreground(int(px * 108 / 48)).save(f"{folder}/ic_launcher_foreground.png")
    adaptive_foreground(int(px * 108 / 48), True).save(f"{folder}/ic_launcher_round_foreground.png")

os.makedirs(f"{RES}/values", exist_ok=True)
with open(f"{RES}/values/ic_launcher_background.xml", "w") as f:
    f.write(f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{BG_HEX}</color>\n</resources>\n')
# Square launchers get the rounded-square border, round launchers get the circle border.
os.makedirs(f"{RES}/mipmap-anydpi-v26", exist_ok=True)
for name, fg in (("ic_launcher", "ic_launcher_foreground"), ("ic_launcher_round", "ic_launcher_round_foreground")):
    with open(f"{RES}/mipmap-anydpi-v26/{name}.xml", "w") as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/' + fg + '"/>\n</adaptive-icon>\n')
print("Launcher icons written.")
