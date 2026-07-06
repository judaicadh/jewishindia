# Jewish India Digital Heritage Trail

A static website mapping synagogues, cemeteries, schools, mills, and civic landmarks shaped by India's Jewish communities (Bene Israel, Baghdadi/Sassoon, Cochini, Indian Jewish diaspora, and emerging communities).

## What's included

- **Features** Places across India including synagogues, cemeteries, and educational institutions.
- **Interactive map** with community layer toggles, timeline filter (ancient era to present), category and region filters.
- **Themed pages**: Synagogues, Cemeteries, Sassoon Mills, plus per-feature detail pages.
- **Self-contained, no build step** — just static HTML, CSS, and JS plus one `data/features.json` file.
- **Google Sheet as the source of truth** — content is edited in a shared spreadsheet and synced into the site automatically.

## How the data flows

The site's content is **not** hand-edited in JSON. Instead:

1. Editors maintain a **Google Sheet** (one row per site).
2. `sync-from-sheet.py` reads the sheet's published CSV and regenerates
   `data/features.json` (the master file the site fetches) and
   `data/features.js` (an inline copy so the site also works from `file://`).
3. A **GitHub Action** runs the sync and redeploys to GitHub Pages — daily,
   on every push to `main`, and on demand.

```
Google Sheet ──(Publish to web → CSV)──▶ sync-from-sheet.py ──▶ data/features.json
                                                            └──▶ data/features.js
                                                                        │
                                                          GitHub Action deploys ▶ GitHub Pages
```

## File layout

```
jewishindia/
├── index.html              ← home
├── map.html                ← interactive map (all features)
├── synagogues.html         ← synagogues listing + map
├── cemeteries.html         ← cemeteries listing + map
├── mills.html              ← Sassoon Mills collection
├── feature.html            ← per-feature detail page (?id=...)
├── about.html              ← project notes
├── data/
│   ├── features.json       ← generated master data (do not hand-edit)
│   ├── features.js         ← inline copy for file:// use (generated)
│   └── sheet-template.csv  ← column reference / starter for the Google Sheet
├── assets/
│   ├── site.css            ← styling
│   ├── site.js             ← shared utilities
│   └── map.js              ← main map page logic
├── images/                 ← optional local images
├── sync-from-sheet.py      ← pull the Google Sheet → regenerate data files
└── convert-tiffs.py        ← convert .tif files → web-friendly .jpgs
```

## Editing content (the Google Sheet)

All site content lives in a Google Sheet. Each row is one site. `data/sheet-template.csv` shows the expected columns and a couple of example rows you can copy into the sheet.

Recognized columns (case-insensitive; friendly aliases also work):

| Column | Meaning |
| --- | --- |
| `Place Name` | Site name (required — rows with no name are skipped) |
| `Latitude` / `Longitude` | Coordinates; leave blank if unknown |
| `Coords Approximate` | `TRUE` if the pin is only roughly placed |
| `Date Established` / `Date Closed` | Years — plain (`1861`), BCE (`562 BCE`), or `c. 1861` |
| `State` / `City` / `Address` | Location details |
| `Theme` | Maps to a category (see below) |
| `Community` | One or more communities, comma-separated (see below) |
| `Description` | Body text shown on the feature page |
| `Images` / `Image URLs` | One or more image URLs (one per line, or comma-separated) |
| `IIIF Manifest` | URL of a IIIF manifest, if any |
| `Verified` | `TRUE` once the row has been reviewed |
| `Published` | `FALSE` to hide a row; blank = published |
| `Source` | Where the data came from |
| `Image Uploaded?` / `Text Uploaded` / `Notes` | Workflow flags, kept under `extras` |

### Communities

Use any combination of: `Bene Israel`, `Baghdadi` (or `Sassoon`), `Cochini` (or `Malabar`/`Paradesi`), `Kerala`, `Diaspora`, `Emerging` (or `Bene Menashe`), `Civic`/`Shared`. The map's color coding and layer toggles are driven by this list.

### Categories (the `Theme` column)

`synagogue`, `cemetery`, `education`, `medical`, `trade and business`, `library`, `clock tower`, `garden`, `dock`, `mill`, `mill site`, `district`, `chabad`, `civic`, `other`. Common synonyms (e.g. `school` → education, `hospital` → medical) are mapped automatically.

## Syncing the sheet into the site

### 1. Publish the sheet as CSV

In Google Sheets: **File → Share → Publish to web → Comma-separated values (.csv)**. Copy the resulting URL (it looks like `https://docs.google.com/spreadsheets/d/e/…/pub?output=csv`).

### 2. Run the sync

```
pip install requests
python sync-from-sheet.py "https://docs.google.com/.../pub?output=csv"
```

The URL can also be supplied via the `SHEET_URL` environment variable, or the `SHEET_URL` constant at the top of `sync-from-sheet.py`. The script overwrites `data/features.json` and regenerates `data/features.js`, then prints a summary (counts by theme and community, and how many sites are missing coordinates). Reload the site to see the changes.

### 3. Automatic sync & deploy (GitHub Action)

`.github/workflows/static.yml` runs the same sync and redeploys to GitHub Pages:

- on every push to `main`,
- daily at 06:00 UTC, and
- manually via **Actions → Sync & Deploy → Run workflow**.

It reads the published-CSV URL from the **`SHEET_URL` repository secret**
(Settings → Secrets and variables → Actions). If that secret is missing, the
workflow fails with a clear error. This means editors can just update the
Google Sheet and the live site refreshes on the next run — no code changes or
manual JSON edits needed.

## Images

Images come from the **`Images` column in the sheet** (one or more URLs), and/or an `IIIF Manifest` URL. The sync no longer scans local folders, so URLs are the simplest way to attach photos: host them anywhere (a CDN, GitHub, Google Drive direct-link, etc.) and paste the links into the sheet.

The `images/` folder is still available if you want to commit images to the repo and reference them by relative path.

## Working with TIFF files

Browsers don't display `.tif` / `.tiff` files. To make them web-friendly, run:

```
python convert-tiffs.py
```

This requires Pillow (`pip install pillow`). It converts each TIFF to a 1600px JPG under `images/converted/{folder}/`.

## Hosting

Because everything is static, you can host it free on:

- **GitHub Pages** — already wired up via the Action above.
- **Netlify** or **Cloudflare Pages** — drag and drop the folder (run `sync-from-sheet.py` locally first so `data/` is up to date).
- **Locally** — open `index.html` in a browser (some browsers may block `fetch()` for `data/features.json` from `file://`; in that case use a tiny local server: `python -m http.server`, or rely on the inline `data/features.js` copy).

## Migrating to Astro later

The data structure was designed to be portable. To migrate to Astro:

1. Create one Markdown file per feature, with frontmatter from each `features.json` entry.
2. Use Astro's content collections to render listing and detail pages.
3. Keep the same Leaflet map setup; pass it the same JSON.

## Data sources

- Mumbai/Deccan GeoJSON (contributor-maintained)
- Synagogues in India, Pakistan, and Burma — spreadsheet (43 entries)
- Locations of Jewish cemeteries in India — Isaac Solomon field survey (42 entries)
- Ongoing edits maintained in the project's Google Sheet
- Site images referenced by URL from the sheet

Communities and founding eras for entries added from the synagogue and cemetery datasets are auto-classified and marked `"verified": false`. Review each (set `Verified` to `TRUE` in the sheet) before publishing.
