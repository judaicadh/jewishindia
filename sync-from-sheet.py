#!/usr/bin/env python3
"""
Sync data/features.json from a published Google Sheet (CSV).

Workflow:
  1. In your Google Sheet:  File → Share → Publish to web → Comma-separated values (.csv)
     Copy the resulting URL.
  2. Either paste it as the SHEET_URL constant below, or pass it on the command line:
         python sync-from-sheet.py "https://docs.google.com/spreadsheets/d/.../pub?output=csv"
  3. Run it. The script overwrites features.json AND regenerates data/features.js
     (the inline copy used so the site works from file://).

Sheet column layout (case-insensitive, extra columns ignored):

    id              short slug — auto-generated from `name` if blank (e.g. magen-david-synagogue)
    name            REQUIRED — display name of the site
    category        synagogue | cemetery | school | hospital | library | mill | civic | other
    community       comma-separated: bene_israel, baghdadi, cochini, kerala,
                    diaspora, emerging  (one row can have multiple)
    lat             decimal latitude (e.g. 18.9669)   — leave blank if unknown
    lon             decimal longitude (e.g. 72.8322)
    coords_approximate  TRUE / FALSE  — flags city-level guesses
    era_start       founding year (negative for BCE — e.g. -562)
    era_end         year demolished/closed (blank if still standing)
    city            e.g. Bombay
    state           e.g. Maharashtra
    address         freeform street address
    description     freeform paragraph
    image_folder    name of the folder under /Images that holds the photos
                    (e.g. "Magen David Synagogue")
    iiif_manifest   URL to a IIIF manifest, if you have one
    verified        TRUE / FALSE — set TRUE once a human has reviewed the row
    sources         comma-separated list of where the data came from

Anything you put in extra columns is preserved in features.json under
`extras` (untouched, available for later use).

Requires:  pip install requests
"""
import sys, os, csv, json, re, io, datetime

try:
    import requests
except ImportError:
    print("ERROR: requests is required. Install with:  pip install requests")
    sys.exit(1)

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_JSON = os.path.join(HERE, 'data', 'features.json')
DATA_JS   = os.path.join(HERE, 'data', 'features.js')
sheet = os.getenv('SHEET_URL')
# Paste your published-CSV URL here (or pass on the command line)
SHEET_URL = sheet

KNOWN_COLS = {
    'id','name','category','community','lat','lon','coords_approximate',
    'date_start','date_end','city','state','address','description',
    'image_folder','iiif_manifest','verified','sources'
}

VALID_COMMUNITIES = {'bene_israel','baghdadi','cochini','kerala','diaspora','emerging'}
VALID_CATEGORIES  = {'synagogue','cemetery','school','hospital','library','mill', 'civic','other'}

def slugify(s):
    s = re.sub(r"[^\w\s-]", "", s).strip().lower()
    s = re.sub(r"[\s_-]+", "-", s)
    return s.strip("-")

def truthy(v):
    return str(v).strip().lower() in ('true','yes','y','1','x','✓','✔')

def parse_int(v):
    s = str(v).strip()
    if not s: return None
    try: return int(float(s))
    except ValueError: return None

def parse_float(v):
    s = str(v).strip()
    if not s: return None
    try: return float(s)
    except ValueError: return None

def parse_list(v):
    if not v: return []
    return [x.strip() for x in str(v).split(',') if x.strip()]

def fetch_csv(url):
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.text

def row_to_feature(row, existing_by_id):
    # Normalize keys to lowercase
    row = { (k or '').strip().lower(): (v or '').strip() for k, v in row.items() }
    name = row.get('name', '')
    if not name:
        return None  # skip blank rows
    fid = row.get('id') or slugify(name)

    coords = None
    lat, lon = parse_float(row.get('lat')), parse_float(row.get('lon'))
    if lat is not None and lon is not None:
        coords = [lat, lon]

    feat = {
        'id': fid,
        'name': name,
        'category': row.get('category', 'other').lower() or 'other',
        'community': [c.lower() for c in parse_list(row.get('community')) if c.lower() in VALID_COMMUNITIES],
        'coords': coords,
        'coords_approximate': truthy(row.get('coords_approximate')),
        'era_start': parse_int(row.get('era_start')),
        'era_end':   parse_int(row.get('era_end')),
        'city':  row.get('city') or None,
        'state': row.get('state') or None,
        'address': row.get('address') or None,
        'description': row.get('description') or '',
        'image_folder': row.get('image_folder') or None,
        'iiif_manifest': row.get('iiif_manifest') or None,
        'verified': truthy(row.get('verified')),
        'sources': parse_list(row.get('sources')) or ['Google Sheet'],
    }
    if feat['image_folder']:
        feat['image_dir'] = f"../{feat['image_folder']}"

    # Carry over auto-generated image lists from the existing features.json
    # (so the sheet doesn't need to know about images on disk)
    prev = existing_by_id.get(fid)
    if prev:
        for k in ('images','tiff_archive','image_dir','image_dir_converted','converted_images'):
            if k in prev and not feat.get(k):
                feat[k] = prev[k]

    # Preserve any extra columns that aren't part of the known schema
    extras = { k: v for k, v in row.items() if k not in KNOWN_COLS and v }
    if extras:
        feat['extras'] = extras

    if feat['category'] not in VALID_CATEGORIES:
        print(f"  warn: unknown category {feat['category']!r} on {name}")

    return feat

def main():
    url = sys.argv[1] if len(sys.argv) > 1 else SHEET_URL
    if not url:
        print("Usage: python sync-from-sheet.py <published-csv-url>")
        print("Or set SHEET_URL near the top of this script.")
        sys.exit(1)

    print(f"Fetching {url}")
    csv_text = fetch_csv(url)
    reader = csv.DictReader(io.StringIO(csv_text))

    # Load existing features.json so we can preserve image-list info
    if os.path.exists(DATA_JSON):
        with open(DATA_JSON, encoding='utf-8') as f:
            existing = json.load(f)
        existing_by_id = { f['id']: f for f in existing.get('features', []) }
    else:
        existing = { 'features': [], 'meta': {} }
        existing_by_id = {}

    new_features = []
    for row in reader:
        feat = row_to_feature(row, existing_by_id)
        if feat: new_features.append(feat)

    if not new_features:
        print("No rows produced. Aborting.")
        sys.exit(1)

    # Write features.json
    out = {
        'features': new_features,
        'meta': {
            'source': 'google-sheet',
            'sheet_url': url,
            'synced_at': datetime.datetime.utcnow().isoformat() + 'Z',
            'count': len(new_features)
        }
    }
    with open(DATA_JSON, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    # Regenerate the inline JS copy that the site reads from file://
    with open(DATA_JS, 'w', encoding='utf-8') as f:
        f.write('// Auto-generated from features.json. Do not edit by hand.\n')
        f.write('window.JIH_FEATURES = ')
        json.dump(new_features, f, ensure_ascii=False)
        f.write(';\nwindow.JIH_META = ')
        json.dump(out['meta'], f, ensure_ascii=False)
        f.write(';\n')

    print()
    print(f"Synced {len(new_features)} sites from the sheet.")
    print(f"  features.json updated.")
    print(f"  features.js (inline copy) regenerated.")
    print(f"Reload the site to see the changes.")

if __name__ == '__main__':
    main()
