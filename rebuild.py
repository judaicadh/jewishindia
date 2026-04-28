#!/usr/bin/env python3
"""
Rebuild data/features.json by re-scanning the surrounding image folders.

Run this from the jewish-india-trail/ directory whenever you:
  - add new images to a feature folder (e.g. /Images/Magen David Synagogue/)
  - add new files to /images/mills/  (Sassoon Mills collection)

It will:
  - Re-scan every feature's image_folder and refresh its `images` list
  - Separate web-renderable images (jpg/png/webp/gif) from .tif/.tiff archive
  - Leave all other fields (name, coords, community, era, description, sources) untouched
"""
import json, os, sys

WEB_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
TIFF_EXTS = {'.tif', '.tiff'}

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data', 'features.json')
PARENT = os.path.dirname(HERE)  # /Images
MILLS_LOCAL = os.path.join(HERE, 'images', 'mills')

def scan(folder):
    if not os.path.isdir(folder):
        return [], []
    web, tiff = [], []
    for fn in sorted(os.listdir(folder)):
        if fn.startswith('.') or fn.startswith('_'): continue
        full = os.path.join(folder, fn)
        if not os.path.isfile(full): continue
        if os.path.getsize(full) < 100: continue  # skip 0-byte placeholders
        ext = os.path.splitext(fn)[1].lower()
        if ext in WEB_EXTS:
            web.append(fn)
        elif ext in TIFF_EXTS:
            tiff.append(fn)
    return web, tiff

def main():
    with open(DATA, encoding='utf-8') as f:
        data = json.load(f)

    changed = 0
    for feat in data['features']:
        if feat['id'] == 'sassoon-mills':
            web, tiff = scan(MILLS_LOCAL)
            feat['image_dir'] = 'images/mills'
        elif feat.get('image_folder'):
            folder = os.path.join(PARENT, feat['image_folder'])
            web, tiff = scan(folder)
            feat['image_dir'] = f"../{feat['image_folder']}"
        else:
            continue
        if feat.get('images') != web or feat.get('tiff_archive') != tiff:
            changed += 1
        feat['images'] = web
        feat['tiff_archive'] = tiff

    with open(DATA, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    web_total = sum(len(f.get('images', [])) for f in data['features'])
    tiff_total = sum(len(f.get('tiff_archive', [])) for f in data['features'])
    feats_with_imgs = sum(1 for f in data['features'] if f.get('images'))
    print(f"Rebuild complete.")
    print(f"  Features changed:        {changed}")
    print(f"  Features with images:    {feats_with_imgs}")
    print(f"  Web-ready images total:  {web_total}")
    print(f"  TIFFs in archive:        {tiff_total}")
    if tiff_total:
        print()
        print("To make TIFFs visible on the website, run convert-tiffs.py")

if __name__ == '__main__':
    main()
