#!/usr/bin/env python3
"""Generate app icons and the Open Graph share image."""
from pathlib import Path
import math

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / "public"
OUT.mkdir(parents=True, exist_ok=True)
FONT = "/System/Library/Fonts/STHeiti Light.ttc"
FONT_BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"
if not Path(FONT_BOLD).exists():
    FONT_BOLD = FONT


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(
        box, radius=radius, fill=fill, outline=outline, width=width
    )


def draw_icon(size: int, path: Path) -> None:
    image = Image.new("RGB", (size, size), (5, 12, 24))
    draw = ImageDraw.Draw(image)

    for index, color in [(0, (12, 35, 66)), (1, (10, 27, 52)), (2, (7, 19, 37))]:
        pad = int(size * (0.07 + index * 0.06))
        rounded(draw, (pad, pad, size - pad, size - pad), int(size * 0.2), color)

    x1, y1, x2, y2 = [int(value * size) for value in (0.22, 0.29, 0.78, 0.74)]
    stroke = max(2, int(size * 0.035))
    rounded(
        draw,
        (x1, y1, x2, y2),
        int(size * 0.08),
        (37, 99, 235),
        (111, 211, 255),
        stroke,
    )
    draw.rounded_rectangle(
        (int(size * 0.39), int(size * 0.18), int(size * 0.61), int(size * 0.36)),
        radius=int(size * 0.04),
        outline=(111, 211, 255),
        width=stroke,
    )
    draw.rounded_rectangle(
        (int(size * 0.47), y1, int(size * 0.53), y2),
        radius=int(size * 0.025),
        fill=(111, 211, 255),
    )

    center_x, center_y, radius = int(size * 0.70), int(size * 0.69), int(size * 0.15)
    draw.ellipse(
        (
            center_x - radius,
            center_y - radius,
            center_x + radius,
            center_y + radius,
        ),
        fill=(251, 191, 36),
        outline=(255, 238, 166),
        width=stroke,
    )
    symbol_font = ImageFont.truetype(FONT_BOLD, int(size * 0.13))
    bounds = draw.textbbox((0, 0), "$", font=symbol_font)
    draw.text(
        (
            center_x - (bounds[2] - bounds[0]) / 2,
            center_y - (bounds[3] - bounds[1]) / 2 - bounds[1],
        ),
        "$",
        font=symbol_font,
        fill=(74, 44, 5),
    )
    image.save(path, optimize=True)


def draw_share_image() -> None:
    width, height = 1200, 630
    image = Image.new("RGB", (width, height), (5, 12, 24))
    draw = ImageDraw.Draw(image)
    rounded(
        draw,
        (52, 52, width - 52, height - 52),
        44,
        (8, 23, 45),
        (30, 64, 105),
        2,
    )

    route = [(120, 500), (260, 420), (430, 470), (610, 350), (800, 400), (1060, 220)]
    for start, end in zip(route, route[1:]):
        dx, dy = end[0] - start[0], end[1] - start[1]
        distance = math.hypot(dx, dy)
        segments = int(distance / 24)
        for index in range(0, segments, 2):
            first = index / segments
            second = min((index + 1) / segments, 1)
            draw.line(
                (
                    start[0] + dx * first,
                    start[1] + dy * first,
                    start[0] + dx * second,
                    start[1] + dy * second,
                ),
                fill=(35, 84, 135),
                width=5,
            )

    rounded(draw, (92, 112, 382, 402), 64, (10, 31, 60), (59, 130, 246), 3)
    icon = Image.open(OUT / "icon-512.png").resize((230, 230), Image.Resampling.LANCZOS)
    image.paste(icon, (122, 142))

    title_font = ImageFont.truetype(FONT_BOLD, 78)
    subtitle_font = ImageFont.truetype(FONT, 36)
    chip_font = ImageFont.truetype(FONT_BOLD, 24)
    label_font = ImageFont.truetype(
        "/System/Library/Fonts/Supplemental/Arial.ttf", 22
    )
    draw.text((440, 145), "旅程記帳", font=title_font, fill=(245, 249, 255))
    draw.text(
        (444, 258),
        "一齊去旅行，分帳唔使煩",
        font=subtitle_font,
        fill=(148, 211, 255),
    )

    x_position = 444
    for chip in ["多人分帳", "多幣種", "自動結算"]:
        bounds = draw.textbbox((0, 0), chip, font=chip_font)
        chip_width = bounds[2] - bounds[0] + 42
        rounded(
            draw,
            (x_position, 342, x_position + chip_width, 394),
            26,
            (17, 55, 94),
            (38, 110, 180),
            2,
        )
        draw.text(
            (x_position + 21, 351), chip, font=chip_font, fill=(218, 239, 255)
        )
        x_position += chip_width + 14

    draw.text((92, 528), "TRAVEL TOOLS", font=label_font, fill=(94, 139, 185))
    image.save(OUT / "og-image.png", optimize=True)


for icon_size, filename in [
    (512, "icon-512.png"),
    (192, "icon-192.png"),
    (180, "apple-touch-icon.png"),
    (32, "favicon-32.png"),
]:
    draw_icon(icon_size, OUT / filename)

draw_share_image()
print("Generated app icons and og-image.png")
