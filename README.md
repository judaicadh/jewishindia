# Jewish India Digital Heritage Trail

A static website mapping synagogues, cemeteries, schools, mills, and civic landmarks shaped by India's Jewish communities (Bene Israel, Baghdadi/Sassoon, Cochini, Indian Jewish diaspora, and emerging communities).

## What's included

- **102 features** across India: 28 Bombay/Deccan sites with images, 32 synagogues from across India/Pakistan/Burma, and 42 cemeteries from the Isaac Solomon survey.
- **Interactive map** with community layer toggles, timeline filter (ancient era to present), category and region filters.
- **Themed pages**: Synagogues, Cemeteries, Sassoon Mills, plus per-feature detail pages.
- **Self-contained, no build step** — just static HTML, CSS, and JS plus one `data/features.json` file.

## File layout

```
jewish-india-trail/
├── index.html              ← home
├── map.html                ← interactive map (all features)
├── synagogues.html         ← synagogues listing + map
├── cemeteries.html         ← cemeteries listing + map
├── mills.html              ← Sassoon Mills collection
├── feature.html            ← per-feature detail page (?id=...)
├── about.html              ← project notes
├── data/
│   └── features.json       ← THE master data file — edit this
├── assets/
│   ├── site.css            ← styling
│   ├── site.js             ← shared utilities
│   └── map.js              ← main map page logic
├── images/
│   ├── mills/              ← Sassoon Mills images go here
│   └── converted/          ← auto-generated JPGs from TIFFs
├── rebuild.py              ← rescan folders → update features.json
└── convert-tiffs.py        ← convert .tif files → web-friendly .jpgs
```

## Where images come from

The site lives **inside** your main `Images/` folder so it can reach each feature's image folder via a relative path: e.g. `../Magen David Synagogue/`. Whenever you add or remove images in a feature folder on disk, run `rebuild.py` to refresh `features.json`.

For the Sassoon Mills collection, copy your `Mills/` folder contents into `jewish-india-trail/images/mills/` and run `rebuild.py`.

## Working with TIFF files

Browsers don't display `.tif` / `.tiff` files. The data file tracks them under `tiff_archive` for each feature, but they won't show in the gallery. To make them visible, run:

```
python convert-tiffs.py
```

This requires Pillow (`pip install pillow`). It converts each TIFF to a 1600px JPG under `images/converted/{folder}/`, then updates `features.json` so the site picks them up.

## Editing data

All site content lives in `data/features.json`. Each feature looks like:

```json
{
  "id": "magen-david-synagogue",
  "name": "Magen David Synagogue",
  "image_folder": "Magen David Synagogue",
  "image_dir": "../Magen David Synagogue",
  "images": ["...jpg", "...jpg"],
  "tiff_archive": ["...tif"],
  "coords": [18.9669, 72.8322],
  "category": "synagogue",
  "community": ["baghdadi"],
  "era_start": 1861,
  "era_end": null,
  "city": "Bombay",
  "state": "Maharashtra",
  "address": "...",
  "description": "",
  "iiif_manifest": null,
  "verified": false,
  "sources": ["Synagogues XLSX"]
}
```

To add a description, fill in `"description"`. To attach a IIIF manifest, set `"iiif_manifest"` to its URL. To add a new feature, append an object to the `features` array.

### Communities

Use any combination of: `bene_israel`, `baghdadi`, `cochini`, `kerala`, `diaspora`, `emerging`, `civic`. The map's color coding and layer toggles are driven by this list.

### Categories

Used for filtering and the listing pages: `synagogue`, `cemetery`, `education`, `hospital`, `library`, `military`, `mill`, `civic`, `other`.

## Hosting

Because everything is static, you can host it free on:

- **GitHub Pages** — push the `jewish-india-trail/` folder as a repo, enable Pages
- **Netlify** or **Cloudflare Pages** — drag and drop the folder
- **Locally** — open `index.html` in a browser (some browsers may block `fetch()` for `data/features.json` from `file://`; in that case use a tiny local server: `python -m http.server` from inside `jewish-india-trail/`)

When hosting on the web, you'll want to upload the relevant image folders too. Either:

- **(Recommended)** copy each feature's images into `images/<folder>/` so the site is fully self-contained, then update each feature's `image_dir` to `images/<folder>` in `features.json`. Or:
- Keep the current `../<folder>/` references and upload the parent `Images/` folder structure.

## Migrating to Astro later

The data structure was designed to be portable. To migrate to Astro:

1. Create one Markdown file per feature, with frontmatter from each `features.json` entry.
2. Use Astro's content collections to render listing and detail pages.
3. Keep the same Leaflet map setup; pass it the same JSON.

## Data sources

- Mumbai/Deccan GeoJSON (contributor-maintained)
- Synagogues in India, Pakistan, and Burma — spreadsheet (43 entries)
- Locations of Jewish cemeteries in India — Isaac Solomon field survey (42 entries)
- Site images from the project's image collection

Communities and founding eras for entries added from the synagogue and cemetery datasets are auto-classified and marked `"verified": false`. Review each before publishing.
