#!/usr/bin/env python3
"""
Convert .tif / .tiff images in feature folders to web-friendly .jpg copies,
saved under jewish-india-trail/images/converted/<folder>/.

Browsers do not display TIFFs natively, so any TIFF in a feature folder
will be invisible on the site until it is converted. This script does
that conversion and updates features.json so the site picks up the JPGs.

Requires Pillow:
    pip install pillow

Run from the jewish-india-trail/ directory:
    python convert-tiffs.py
"""
import os, sys, json, time

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow is required. Install with:  pip install pillow")
    sys.exit(1)

Image.MAX_IMAGE_PIXELS = None
MAX_PX = 1600
QUALITY = 82

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data', 'features.json')
PARENT = os.path.dirname(HERE)
CONVERTED_ROOT = os.path.join(HERE, 'images', 'converted')

def convert_one(src, dst):
    with Image.open(src) as im:
        if hasattr(im, 'seek'):
            try: im.seek(0)
            except Exception: pass
        if im.mode not in ('RGB',):
            im = im.convert('RGB')
        im.thumbnail((MAX_PX, MAX_PX), Image.LANCZOS)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        im.save(dst, 'JPEG', quality=QUALITY, optimize=True)

def main():
    with open(DATA, encoding='utf-8') as f:
        data = json.load(f)

    converted = 0
    skipped = 0
    failed = 0

    for feat in data['features']:
        folder = feat.get('image_folder')
        tiffs = feat.get('tiff_archive', [])
        if not folder or not tiffs:
            continue
        if feat['id'] == 'sassoon-mills':
            src_dir = os.path.join(HERE, 'images', 'mills')
        else:
            src_dir = os.path.join(PARENT, folder)
        dst_dir = os.path.join(CONVERTED_ROOT, folder)
        for fn in tiffs:
            base, _ = os.path.splitext(fn)
            src = os.path.join(src_dir, fn)
            dst = os.path.join(dst_dir, base + '.jpg')
            if os.path.exists(dst) and os.path.getsize(dst) > 1000:
                skipped += 1
                continue
            try:
                print(f"  converting: {folder}/{fn}")
                convert_one(src, dst)
                converted += 1
            except Exception as e:
                print(f"  FAILED: {folder}/{fn}: {e}")
                failed += 1

        # After conversion, point the feature's image_dir at the converted folder
        # if there are now JPGs there. Append converted .jpg names to images list.
        if os.path.isdir(dst_dir):
            converted_jpgs = sorted([
                x for x in os.listdir(dst_dir)
                if x.lower().endswith('.jpg') and os.path.getsize(os.path.join(dst_dir, x)) > 1000
            ])
            if converted_jpgs:
                # Merge: include both the originals (web JPGs already in image_folder)
                # AND the converted-from-TIFF JPGs. Show them under image_dir = converted folder,
                # but also keep references to originals via a second list.
                feat['image_dir_converted'] = f"images/converted/{folder}"
                feat['converted_images'] = converted_jpgs
                # For simplicity, prefer the converted folder for display:
                # (If feature also has originals in ../folder, those are in feat['images'].)
                # The site should show converted images in addition; we add them to images list.
                merged = list(dict.fromkeys(feat.get('images', []) + converted_jpgs))
                feat['images'] = merged
                feat['image_dir'] = f"images/converted/{folder}"  # JPG conversions live here

    with open(DATA, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print()
    print(f"Done. Converted: {converted}  Already converted: {skipped}  Failed: {failed}")
    if converted:
        print("features.json updated. Reload the site to see the new images.")

if __name__ == '__main__':
    main()
