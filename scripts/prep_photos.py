"""Make web images for new photos and print their photos.json entries.

    python3 scripts/prep_photos.py <place> <yyyy-mm> <original.jpg> [...]

For each original (in the order given): trims a plain white print border, writes
assets/photos/web/<place>-<yyyy-mm>-<nn>-800.webp and a full-size copy (at most 1600 px wide),
WebP quality 70, with no EXIF or location data. Run from the repository root.
"""
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageOps
from PIL.ExifTags import TAGS

WEB = Path("assets/photos/web")


def trim_border(im):
    """Crop a uniform white frame (as exported by some editors), if there is one."""
    bg = Image.new("RGB", im.size, (255, 255, 255))
    mask = ImageChops.difference(im, bg).convert("L").point(lambda v: 255 if v > 18 else 0)
    box = mask.getbbox()
    if not box:
        return im
    l, t, r, b = box
    w, h = im.size
    # only trim a real frame: a few percent on each side, not part of the picture
    if 0 < l < w * .06 and 0 < t < h * .08 and w - r < w * .06 and h - b < h * .08:
        return im.crop(box)
    return im


def camera(path):
    model = {TAGS.get(k, k): v for k, v in Image.open(path).getexif().items()}.get("Model", "")
    return {"ZV-E10": "Sony ZV-E10", "iPhone 15": "iPhone 15"}.get(model, model)


def next_number(web, place, month):
    """One more than the highest photo number already made for this place and month,
    so a second batch never overwrites published images."""
    nums = [int(m.group(1)) for f in Path(web).glob(f"{place}-{month}-*-800.webp")
            if (m := re.fullmatch(rf"{re.escape(place)}-{month}-(\d+)-800\.webp", f.name))]
    return max(nums, default=0) + 1


def prep(place, month, files, web=WEB):
    web = Path(web)
    out = []
    for n, f in enumerate(files, next_number(web, place, month)):
        # exif_transpose: phones store "rotate to view" in EXIF; apply it so nothing comes out sideways
        im = trim_border(ImageOps.exif_transpose(Image.open(f)).convert("RGB"))
        W, H = im.size
        stem = f"{place}-{month}-{n:02d}"
        im.resize((800, round(H * 800 / W)), Image.LANCZOS).save(web / f"{stem}-800.webp", "WEBP", quality=70, method=6)
        fw = min(1600, W)
        im.resize((fw, round(H * fw / W)), Image.LANCZOS).save(web / f"{stem}-{fw}.webp", "WEBP", quality=70, method=6)
        out.append({"stem": stem, "full": f"{stem}-{fw}.webp", "w": 800, "h": round(H * 800 / W),
                    "caption": "", "camera": camera(f), "tall": H > W * 1.1})
    return out


if __name__ == "__main__":
    print(json.dumps(prep(sys.argv[1], sys.argv[2], sys.argv[3:]), indent=1))
