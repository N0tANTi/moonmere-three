"""Compare the two rendered Moonmere films and the user's local 1080p reference."""

import argparse
from io import BytesIO
import os
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory

from PIL import Image, ImageDraw, ImageFont


OUTPUT = Path(__file__).resolve().parents[2] / "output"
OLD = OUTPUT / "moonmere_three" / "moonmere.mp4"
NEW = OUTPUT / "moonmere_three_refined" / "moonmere.mp4"
ENGRAVED = OUTPUT / "moonmere_three_engraved" / "moonmere.mp4"
BACKGROUND = "#151a17"

# The reference has a different camera. Crop corresponding subjects at the
# same scale. The two Three.js versions always use exactly the same rectangle.
DETAILS = (
    ("白堡石墙", 5.0, (510, 385, 1145, 680), (538, 391, 1173, 686)),
    ("拱廊与岩壁", 9.3, (737, 166, 1375, 462), (750, 186, 1388, 482)),
    ("花瓣与花蕊", 9.3, (32, 559, 812, 1080), (32, 559, 812, 1080)),
    ("浮叶与水面", 9.3, (912, 555, 1820, 968), (912, 555, 1820, 968)),
)
ENGRAVED_DETAILS = (
    ("整体明暗", 5.0, (0, 0, 1920, 1080), (0, 0, 1920, 1080)),
    ("树冠受光与深影", 5.0, (154, 198, 736, 456), (154, 198, 736, 456)),
    ("白堡窗饰与石纹", 5.0, (505, 95, 1195, 617), (544, 105, 1234, 627)),
    ("水边拱廊与壁龛", 9.3, (853, 191, 1509, 483), (870, 199, 1526, 491)),
    ("前景叶影", 9.3, (2, 320, 771, 764), (2, 320, 771, 764)),
)


def label(image, x, y, text, size, font, color="#e6e9df"):
    face = ImageFont.truetype(str(font), size)
    ImageDraw.Draw(image).text((x, y), text, font=face, fill=color, anchor="lm")


def frame(ffmpeg, movie, seconds):
    result = subprocess.run([
        ffmpeg, "-v", "error", "-ss", str(seconds), "-i", str(movie), "-map", "0:v:0",
        "-frames:v", "1", "-f", "image2pipe", "-c:v", "png", "pipe:1",
    ], stdout=subprocess.PIPE, check=True)
    with Image.open(BytesIO(result.stdout)) as image:
        if image.size != (1920, 1080):
            raise ValueError(f"Expected a 1920 × 1080 frame from {movie}, got {image.size}")
        return image.convert("RGB")


def detail_sheet(ffmpeg, reference, font, destination, previous=OLD, current=NEW, details=DETAILS):
    margin, gap, tile, label_height = 21, 10, 518, 42
    heights = [round(tile * (r[3] - r[1]) / (r[2] - r[0])) for _, _, r, _ in details]
    sheet = Image.new("RGB", (margin * 2 + gap * 2 + tile * 3,
                              66 + label_height * len(details) + sum(heights) + margin), BACKGROUND)
    titles = ("原片", "Three.js 上一版", "Three.js 本次调整")
    movies = (reference, previous, current)
    for column, title in enumerate(titles):
        label(sheet, margin + column * (tile + gap), 39, title, 26, font)
    frames = {(movie, t): frame(ffmpeg, movie, t)
              for movie in movies for t in sorted({t for _, t, _, _ in details})}
    y = 66
    for (title, t, reference_rect, scene_rect), height in zip(details, heights):
        label(sheet, margin, y + 21, title, 21, font)
        label(sheet, margin + max(151, len(title) * 21 + 22), y + 21, f"{t:.1f} 秒", 16, font, "#b7c2af")
        y += label_height
        for column, movie in enumerate(movies):
            rect = reference_rect if column == 0 else scene_rect
            crop = frames[movie, t].crop(rect).resize((tile, height), Image.Resampling.LANCZOS)
            sheet.paste(crop, (margin + column * (tile + gap), y))
        y += height
    sheet.save(destination, quality=96, subsampling=0, optimize=True)


def split_screen(ffmpeg, font, workspace, previous=OLD, current=NEW):
    header = Image.new("RGB", (1920, 50), BACKGROUND)
    label(header, 25, 25, "上一版", 24, font)
    label(header, 985, 25, "本次调整", 24, font)
    header.save(workspace / "header.png")
    filters = ("[0:v]scale=960:540,setsar=1[a];[1:v]scale=960:540,setsar=1[b];"
               "[a][b]hstack=shortest=1[pair];[2:v]format=yuv420p[header];"
               "[header][pair]vstack=shortest=1[comparison]")
    subprocess.run([
        ffmpeg, "-v", "error", "-i", str(previous), "-i", str(current), "-loop", "1",
        "-framerate", "30", "-i", str(workspace / "header.png"),
        "-filter_complex", filters, "-map", "[comparison]", "-map", "1:a:0",
        "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-c:a", "copy", "-movflags", "+faststart", str(workspace / "side-by-side.mp4"),
    ], check=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reference", type=Path)
    parser.add_argument("--engraved", action="store_true", help="Compare the carved and graded film to the material refinement")
    parser.add_argument("--ffmpeg", default=os.environ.get("FFMPEG_PATH", "ffmpeg"))
    parser.add_argument("--font", default="C:/Windows/Fonts/msyhbd.ttc",
                        help="Path to a font with Chinese glyphs for the comparison labels")
    args = parser.parse_args()
    previous, current, details = (NEW, ENGRAVED, ENGRAVED_DETAILS) if args.engraved else (OLD, NEW, DETAILS)
    for source in (args.reference, previous, current):
        if not source.is_file():
            parser.error(f"Missing video file: {source}")
    with TemporaryDirectory(dir=current.parent) as temp:
        workspace = Path(temp)
        detail_sheet(args.ffmpeg, args.reference, args.font, workspace / "details-comparison.jpg", previous, current, details)
        split_screen(args.ffmpeg, args.font, workspace, previous, current)
        for name in ("details-comparison.jpg", "side-by-side.mp4"):
            (workspace / name).replace(current.parent / name)
            print(current.parent / name)
