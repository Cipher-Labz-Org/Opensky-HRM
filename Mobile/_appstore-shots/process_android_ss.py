"""Fallback: convert Android screenshots into App Store iPhone/iPad sizes with iOS chrome."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

DEST = Path(r"C:\Users\asus\OneDrive\Desktop\mobile")
ASSETS = Path(r"C:\Users\asus\.cursor\projects\d-Opensky-letast\assets")

SCREENS = [
    (
        "01-login",
        "WhatsApp_Image_2026-09-29_at_10.16.32-ff0c651f-e5ba-46bf-9d04-fa8d7e7a1f37.jpg",
    ),
    (
        "02-home",
        "WhatsApp_Image_2026-09-29_at_10.16.32__2_-5fd6731d-beb9-491d-8527-6fa3121a7d4a.jpg",
    ),
    (
        "03-leave",
        "WhatsApp_Image_2026-09-29_at_10.16.31__2_-3eb3a365-cb1f-49c6-8a0a-7d14f377df24.jpg",
    ),
    (
        "04-attendance",
        "WhatsApp_Image_2026-09-29_at_10.16.32__1_-46b6502e-d668-407a-8110-3f9c8913663c.jpg",
    ),
    (
        "05-alerts",
        "WhatsApp_Image_2026-09-29_at_10.16.31-4d13fe6e-fa77-4d39-b2a8-06acf0b63951.jpg",
    ),
    (
        "06-payslips",
        "WhatsApp_Image_2026-09-29_at_10.16.30-0a930848-811f-4e74-aaf6-7c2d006a73b8.jpg",
    ),
    (
        "07-profile",
        "WhatsApp_Image_2026-09-29_at_10.16.31__1_-e2cc2e94-2e5d-473f-a852-884f4ea9b638.jpg",
    ),
]

SIZES = {
    "iphone-6.5": (1284, 2778),
    "iphone-6.5-xsmax": (1242, 2688),
    "ipad-13": (2064, 2752),
}


def find_src(name: str) -> Path:
    matches = list(ASSETS.glob(f"*{name}"))
    if not matches:
        raise FileNotFoundError(name)
    return matches[0]


def crop_android_chrome(im: Image.Image) -> Image.Image:
    w, h = im.size
    top = int(h * 0.034)
    return im.crop((0, top, w, h))


def sample_bg(im: Image.Image) -> tuple[int, int, int]:
    px = im.getpixel((im.width // 2, 4))
    return px[:3] if len(px) == 4 else px


def fit_contain(im: Image.Image, box: tuple[int, int]) -> Image.Image:
    tw, th = box
    scale = min(tw / im.width, th / im.height)
    nw, nh = max(1, int(im.width * scale)), max(1, int(im.height * scale))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def draw_status_icons(d, w: int, bar_h: int) -> None:
    ink = (10, 37, 64, 255)
    pad = int(w * 0.068)
    try:
        font_b = ImageFont.truetype("segoeuib.ttf", max(22, int(bar_h * 0.34)))
    except OSError:
        font_b = ImageFont.load_default()
    d.text((pad, int(bar_h * 0.36)), "9:41", font=font_b, fill=ink)

    iw, ih = int(w * 0.245), int(bar_h * 0.48)
    ix, iy = (w - iw) // 2, int(bar_h * 0.28)
    d.rounded_rectangle((ix, iy, ix + iw, iy + ih), radius=ih // 2, fill=(17, 17, 17, 255))

    rx = w - pad
    by = int(bar_h * 0.40)
    bw, bh = int(w * 0.058), int(bar_h * 0.24)
    d.rounded_rectangle((rx - bw, by, rx, by + bh), radius=3, outline=ink, width=2)
    d.rectangle((rx, by + int(bh * 0.28), rx + 4, by + int(bh * 0.72)), fill=ink)
    d.rounded_rectangle((rx - bw + 3, by + 3, rx - 3, by + bh - 3), radius=2, fill=ink)

    wx = rx - bw - int(w * 0.038)
    cy = by + bh // 2
    d.arc((wx - 11, cy - 10, wx + 11, cy + 10), 205, 335, fill=ink, width=2)
    d.arc((wx - 7, cy - 6, wx + 7, cy + 6), 205, 335, fill=ink, width=2)
    d.ellipse((wx - 2, cy + 2, wx + 2, cy + 6), fill=ink)

    sx = wx - int(w * 0.052)
    for i, hh in enumerate((7, 10, 13, 16)):
        d.rectangle((sx + i * 6, cy + 8 - hh, sx + i * 6 + 4, cy + 8), fill=ink)


def compose(src: Image.Image, size: tuple[int, int]) -> Image.Image:
    tw, th = size
    content = crop_android_chrome(src).convert("RGB")
    bg = sample_bg(content)
    canvas = Image.new("RGB", size, bg)
    d = ImageDraw.Draw(canvas)

    bar_h = 162 if tw >= 1284 else 148
    if tw >= 2000:
        bar_h = 96
    bottom_h = 46 if tw < 2000 else 36

    inner_w, inner_h = tw, th - bar_h - bottom_h
    fitted = fit_contain(content, (inner_w, inner_h))
    x = (tw - fitted.width) // 2
    y = bar_h + (inner_h - fitted.height) // 2
    canvas.paste(fitted, (x, y))

    d.rectangle((0, 0, tw, bar_h), fill=bg)
    draw_status_icons(d, tw, bar_h)

    d.rectangle((0, th - bottom_h, tw, th), fill=canvas.getpixel((tw // 2, max(0, th - bottom_h - 8))))
    hw, hh = int(tw * 0.31), 7
    hx, hy = (tw - hw) // 2, th - 22
    d.rounded_rectangle((hx, hy, hx + hw, hy + hh), radius=4, fill=(28, 28, 30))
    return canvas


def export(name: str, src: Image.Image, folder: str, size: tuple[int, int]) -> Path:
    out_dir = DEST / folder
    out_dir.mkdir(parents=True, exist_ok=True)
    final = compose(src, size)
    path = out_dir / f"{name}-{size[0]}x{size[1]}.png"
    final.save(path, "PNG", optimize=True)
    print("wrote", path, final.size)
    return path


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    for name, filename in SCREENS:
        src = Image.open(find_src(filename)).convert("RGB")
        for folder, size in SIZES.items():
            export(name, src, folder, size)
    print("done")


if __name__ == "__main__":
    main()
