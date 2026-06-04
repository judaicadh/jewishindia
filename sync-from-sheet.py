#!/usr/bin/env python3
"""
Sync data/features.json from a published Google Sheet (CSV).

Accepts the column names from your sheet:

    Place Name | Latitude | Longitude | Date Established | Date Closed |
    State | City | Theme | Community | Image Uploaded? | Text Uploaded |
    Description | Notes | Address | Source

(case-insensitive; the older internal names like `name`, `lat`, `lon`,
`era_start`, `era_end`, `category`, `community`, `sources` also still
work, so you can mix and match.)

Workflow:
  1. In your Google Sheet:  File > Share > Publish to web >
     Comma-separated values (.csv). Copy the URL.
  2. Either:
       a) Run locally:
            python sync-from-sheet.py "https://docs.google.com/.../pub?output=csv"
          (or paste it into SHEET_URL below and run with no arguments)
       b) Or let the GitHub Action do it — it runs daily and reads
          the URL from the SHEET_URL repository secret.
  3. The script overwrites features.json AND regenerates data/features.js
     (the inline copy used so the site works from file://).

Notes on a few fields:
  - Community can be a comma-separated list, with friendly names:
        "Bene Israel"               -> bene_israel
        "Baghdadi" / "Sassoon"      -> baghdadi
        "Cochini" / "Malabar"       -> cochini
        "Kerala"                    -> kerala
        "Diaspora"                  -> diaspora
        "Emerging" / "Bene Menashe" -> emerging
  - Theme maps onto a category:
        synagogue, cemetery, education, medical, library, clock tower,
        garden, dock, mill, mill site, district, chabad, civic, other
  - Date Established / Date Closed accept plain years (1861), BCE
    ("562 BCE" or -562), or "c. 1861" - non-digit text is stripped.
  - Image Uploaded? / Text Uploaded are kept as workflow flags under
    the `extras` field so you can sort by them in the sheet.

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

# Paste your published-CSV URL here (or pass on the command line, or
# set the SHEET_URL environment variable, which is what the GitHub
# Action does via a repository secret).
SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSyf6wTEAhfvZYlYKbMMNheC6h7_emAWtJ0gZ_PLCSRQtyNZoEqP1MVxLHECOilT8FK4uZFZba3WyWR/pub?output=csv"

# Map sheet column headers -> internal field name (lowercased, _/- as space)
COLUMN_ALIASES = {
    'place name':          'name',
    'name':                'name',
    'title':               'name',
    'latitude':            'lat',
    'lat':                 'lat',
    'longitude':           'lon',
    'lon':                 'lon',
    'lng':                 'lon',
    'date established':    'era_start',
    'established':         'era_start',
    'era start':           'era_start',
    'date closed':         'era_end',
    'closed':              'era_end',
    'era end':             'era_end',
    'state':               'state',
    'province':            'state',
    'city':                'city',
    'town':                'city',
    'theme':               'category',
    'category':            'category',
    'type':                'category',
    'community':           'community',
    'communities':         'community',
    'image uploaded?':     'image_uploaded',
    'image uploaded':      'image_uploaded',
    'image':               'image_folder',
    'image folder':        'image_folder',
    'images':              'images',
    'image urls':          'images',
    'photos':              'images',
    'photo urls':          'images',
    'text uploaded':       'text_uploaded',
    'text uploaded?':      'text_uploaded',
    'description':         'description',
    'notes':               'notes',
    'address':             'address',
    'source':              'sources',
    'sources':             'sources',
    'iiif manifest':       'iiif_manifest',
    'iiif':                'iiif_manifest',
    'verified':            'verified',
    'coords approximate':  'coords_approximate',
    'id':                  'id',
    'slug':                'id',
    'published':           'published',
    'live':                'published',
    'show':                'published',
    'visible':             'published',
}

COMMUNITY_ALIASES = {
    'bene israel':            'bene_israel',
    'beneisrael':             'bene_israel',
    'baghdadi':               'baghdadi',
    'baghdadi incl sassoon':  'baghdadi',
    'baghdadi sassoon':       'baghdadi',
    'sassoon':                'baghdadi',
    'cochini':                'cochini',
    'cochin':                 'cochini',
    'cochini malabar':        'cochini',
    'malabar':                'cochini',
    'paradesi':               'cochini',
    'kerala':                 'kerala',
    'jews of kerala':         'kerala',
    'diaspora':               'diaspora',
    'indian jewish diaspora': 'diaspora',
    'emerging':               'emerging',
    'emerging communities':   'emerging',
    'bene menashe':           'emerging',
    'benemenashe':            'emerging',
    'bnei menashe':           'emerging',
    'civic':                  'civic',
    'shared':                 'civic',
    'shared site':            'civic',
}

CATEGORY_ALIASES = {
    'synagogue':       'synagogue',
    'synagogues':      'synagogue',
    'prayer hall':     'synagogue',
    'cemetery':        'cemetery',
    'cemeteries':      'cemetery',
    'burial ground':   'cemetery',
    'graveyard':       'cemetery',
    'education':       'education',
    'school':          'education',
    'schools':         'education',
    'college':         'education',
    'medical':         'medical',
    'hospital':        'medical',
    'library':         'library',
    'clock tower':     'clock_tower',
    'clock_tower':     'clock_tower',
    'garden':          'garden',
    'park':            'garden',
    'dock':            'dock',
    'docks':           'dock',
    'mill':            'mill',
    'mills':           'mill',
    'mill site':       'mill_site',
    'mill_site':       'mill_site',
    'district':        'district',
    'neighbourhood':   'district',
    'neighborhood':    'district',
    'chabad':          'chabad',
    'chabad house':    'chabad',
    'civic':           'civic',
    'civic site':      'civic',
    'civic heritage':  'civic',
    'heritage':        'civic',
    'other':           'other',
}

def normalize_key(s):
    s = (s or '').strip().lower()
    s = s.replace('_', ' ').replace('-', ' ')
    s = re.sub(r"[^\w?\s]", ' ', s)
    s = re.sub(r"\s+", ' ', s).strip()
    return s

def normalize_value(s):
    s = (s or '').strip().lower()
    s = re.sub(r"[^\w\s]", ' ', s)
    s = re.sub(r"\s+", ' ', s).strip()
    return s

def slugify(s):
    s = re.sub(r"[^\w\s-]", "", s).strip().lower()
    s = re.sub(r"[\s_-]+", "-", s)
    return s.strip("-")

def truthy(v):
    return str(v).strip().lower() in ('true','yes','y','1','x','done','complete','completed')

def parse_year(v):
    if v is None: return None
    s = str(v).strip()
    if not s: return None
    low = s.lower()
    bce = ('bce' in low) or ('b.c.e' in low) or low.endswith(' bc')
    m = re.search(r"-?\d+", s)
    if not m: return None
    n = int(m.group(0))
    if bce and n > 0: n = -n
    return n

def parse_float(v):
    if v is None: return None
    s = str(v).strip()
    if not s: return None
    try: return float(s)
    except ValueError:
        m = re.search(r"-?\d+(\.\d+)?", s)
        return float(m.group(0)) if m else None

def parse_list(v):
    if not v: return []
    parts = re.split(r"[,;/]", str(v))
    return [p.strip() for p in parts if p.strip()]

def parse_url_list(v):
    # Like parse_list, but does NOT split on '/' (URLs contain slashes).
    # Splits on newlines, commas, and semicolons — friendly for sheet cells
    # where the user pastes one URL per line.
    if not v: return []
    parts = re.split(r"[\n,;]+", str(v))
    return [p.strip() for p in parts if p.strip()]

def map_community(values):
    out, seen = [], set()
    for raw in parse_list(values):
        key = normalize_value(raw)
        slug = COMMUNITY_ALIASES.get(key) or COMMUNITY_ALIASES.get(key.rstrip('s'))
        if slug and slug not in seen:
            out.append(slug); seen.add(slug)
    return out

def map_category(value):
    if not value: return 'other'
    key = normalize_value(value)
    return CATEGORY_ALIASES.get(key) or CATEGORY_ALIASES.get(key.rstrip('s'), 'other')

def fetch_csv(url):
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    return r.text

def row_to_feature(row, existing_by_id):
    normed = {}
    extras_unknown = {}
    for k, v in row.items():
        key = normalize_key(k)
        internal = COLUMN_ALIASES.get(key)
        if internal:
            normed[internal] = (v or '').strip()
        elif key:
            extras_unknown[(k or '').strip()] = (v or '').strip()

    name = normed.get('name', '').strip()
    if not name:
        return None

    # Skip rows explicitly marked as unpublished (blank = publish by default)
    pub = normed.get('published', '').strip()
    if pub and not truthy(pub):
        return None

    fid = normed.get('id') or slugify(name)

    coords = None
    lat = parse_float(normed.get('lat'))
    lon = parse_float(normed.get('lon'))
    if lat is not None and lon is not None:
        coords = [lat, lon]

    feat = {
        'id': fid,
        'name': name,
        'category': map_category(normed.get('category')),
        'community': map_community(normed.get('community')),
        'coords': coords,
        'coords_approximate': truthy(normed.get('coords_approximate')),
        'era_start': parse_year(normed.get('era_start')),
        'era_end':   parse_year(normed.get('era_end')),
        'city':  normed.get('city') or None,
        'state': normed.get('state') or None,
        'address': normed.get('address') or None,
        'description': normed.get('description') or '',
        'image_folder': normed.get('image_folder') or name,
        'iiif_manifest': normed.get('iiif_manifest') or None,
        'verified': truthy(normed.get('verified')),
        'sources': parse_list(normed.get('sources')) or ['Google Sheet'],
    }
    if feat['image_folder']:
        feat['image_dir'] = f"../{feat['image_folder']}"

    # If the sheet provides explicit image URLs, use them. Otherwise the
    # carry-over below will fill in the locally-discovered filename list.
    image_urls = parse_url_list(normed.get('images'))
    if image_urls:
        feat['images'] = image_urls

    prev = existing_by_id.get(fid)
    if prev:
        for k in ('images','tiff_archive','image_dir','image_dir_converted','converted_images'):
            if k in prev and not feat.get(k):
                feat[k] = prev[k]

    extras = dict(extras_unknown)
    if normed.get('notes'):          extras['notes'] = normed['notes']
    if 'image_uploaded' in normed:   extras['image_uploaded'] = truthy(normed['image_uploaded'])
    if 'text_uploaded'  in normed:   extras['text_uploaded']  = truthy(normed['text_uploaded'])
    if extras:
        feat['extras'] = extras

    return feat

def main():
    # Priority: CLI arg > env var SHEET_URL > constant at top of file
    url = (sys.argv[1] if len(sys.argv) > 1 else None) or os.environ.get('SHEET_URL') or SHEET_URL
    if not url:
        print("Usage:  python sync-from-sheet.py <published-csv-url>")
        print("Or set the SHEET_URL environment variable / constant.")
        sys.exit(1)

    print(f"Fetching {url}")
    csv_text = fetch_csv(url)
    reader = csv.DictReader(io.StringIO(csv_text))

    if os.path.exists(DATA_JSON):
        with open(DATA_JSON, encoding='utf-8') as f:
            existing = json.load(f)
        existing_by_id = { f['id']: f for f in existing.get('features', []) }
    else:
        existing_by_id = {}

    new_features = []
    skipped = 0
    for row in reader:
        feat = row_to_feature(row, existing_by_id)
        if feat:
            new_features.append(feat)
        else:
            skipped += 1

    if not new_features:
        print("No rows produced. Aborting.")
        sys.exit(1)

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

    with open(DATA_JS, 'w', encoding='utf-8') as f:
        f.write('// Auto-generated from features.json. Do not edit by hand.\n')
        f.write('window.JIH_FEATURES = ')
        json.dump(new_features, f, ensure_ascii=False)
        f.write(';\nwindow.JIH_META = ')
        json.dump(out['meta'], f, ensure_ascii=False)
        f.write(';\nwindow.JIH_SHEET_URL = ')
        json.dump(url, f)
        f.write(';\n')

    by_cat, by_com, no_coords = {}, {}, 0
    for f in new_features:
        by_cat[f['category']] = by_cat.get(f['category'], 0) + 1
        for c in f['community']:
            by_com[c] = by_com.get(c, 0) + 1
        if not f.get('coords'):
            no_coords += 1

    print()
    print(f"Synced {len(new_features)} sites from the sheet.")
    if skipped:
        print(f"  (Skipped {skipped} rows with no Place Name.)")
    print(f"  features.json updated.")
    print(f"  features.js (inline copy) regenerated.")
    print(f"  Sites missing coordinates: {no_coords}")
    print()
    print("By Theme / category:")
    for k, v in sorted(by_cat.items(), key=lambda x: -x[1]):
        print(f"  {v:>4}  {k}")
    print("By Community:")
    for k, v in sorted(by_com.items(), key=lambda x: -x[1]):
        print(f"  {v:>4}  {k}")
    print()
    print("Reload the site to see the changes.")

if __name__ == '__main__':
    main()
