/* Shared utilities for Jewish India Digital Heritage Trail */

const COMMUNITY_LABELS = {
  bene_israel: "Bene Israel",
  baghdadi: "Baghdadi",
  cochini: "Cochini / Malabar",
  kerala: "Jews of Kerala",
  diaspora: "Indian Jewish Diaspora",
  emerging: "Emerging Communities"
};

const CATEGORY_LABELS = {
  "synagogue": "Synagogue",
  "cemetery": "Cemetery",
  "education": "Education",
  "medical": "Medical",
  "library": "Library",
  "mill": "Mill",
  "civic": "Civic",
  "trade_and_business": "Trade and Business",
  "bollywood": "Bollywood",
  "military": "Military",
  "other": "Other"
};

// ─── Live Google Sheet fetch ──────────────────────────────────────────────────
// Mirrors sync-from-sheet.py so both code paths produce identical feature objects.

const _COL = {
  'place name':'name','name':'name','title':'name',
  'latitude':'lat','lat':'lat','longitude':'lon','lon':'lon','lng':'lon',
  'date established':'era_start','established':'era_start','era start':'era_start',
  'date closed':'era_end','closed':'era_end','era end':'era_end',
  'state':'state','province':'state','city':'city','town':'city',
  'theme':'category','category':'category','type':'category',
  'community':'community','communities':'community',
  'image uploaded?':'image_uploaded','image uploaded':'image_uploaded',
  'image':'image_folder','image folder':'image_folder',
  'text uploaded':'text_uploaded','text uploaded?':'text_uploaded',
  'description':'description','notes':'notes','address':'address',
  'source':'sources','sources':'sources',
  'iiif manifest':'iiif_manifest','iiif':'iiif_manifest',
  'verified':'verified','coords approximate':'coords_approximate',
  'id':'id','slug':'id',
  'published':'published','live':'published','show':'published','visible':'published',
};
const _COM = {
  'bene israel':'bene_israel','beneisrael':'bene_israel',
  'baghdadi':'baghdadi','baghdadi incl sassoon':'baghdadi','baghdadi sassoon':'baghdadi','sassoon':'baghdadi',
  'cochini':'cochini','cochin':'cochini','cochini malabar':'cochini','malabar':'cochini','paradesi':'cochini',
  'kerala':'kerala','jews of kerala':'kerala',
  'diaspora':'diaspora','indian jewish diaspora':'diaspora',
  'emerging':'emerging','emerging communities':'emerging','bene menashe':'emerging','benemenashe':'emerging','bnei menashe':'emerging',
  'civic':'civic','shared':'civic','shared site':'civic',
};
const _CAT = {
  'synagogue':'synagogue','synagogues':'synagogue','prayer hall':'synagogue',
  'cemetery':'cemetery','cemeteries':'cemetery','burial ground':'cemetery','graveyard':'cemetery',
  'education':'school':'education','schools':'education','college':'edcuation','education',
  'hospital':'hospital','library':'library',
  'clock tower':'clock_tower','clock_tower':'clock_tower','tower':'clock_tower',
  'garden':'garden','park':'garden','dock':'dock','docks':'dock',
  'mill':'mill','mills':'mill','mill site':'mill_site','mill_site':'mill_site',
  'district':'district','neighbourhood':'district','neighborhood':'district',
  'chabad':'chabad','chabad house':'chabad',
  'civic':'civic','civic site':'civic','civic heritage':'civic','heritage':'civic',
  'other':'other',
};

function _nk(s) { // normalize key
  return (s||'').trim().toLowerCase().replace(/_/g,' ').replace(/-/g,' ').replace(/[^\w?\s]/g,' ').replace(/\s+/g,' ').trim();
}
function _nv(s) { // normalize value
  return (s||'').trim().toLowerCase().replace(/[^\w\s]/g,' ').replace(/\s+/g,' ').trim();
}
function _slug(s) {
  return s.replace(/[^\w\s-]/g,'').trim().toLowerCase().replace(/[\s_-]+/g,'-').replace(/^-+|-+$/g,'');
}
function _bool(v) {
  return ['true','yes','y','1','x','done','complete','completed'].includes(String(v).trim().toLowerCase());
}
function _year(v) {
  if (v==null) return null;
  const s=String(v).trim(); if(!s) return null;
  const low=s.toLowerCase(), bce=low.includes('bce')||low.includes('b.c.e')||low.endsWith(' bc');
  const m=s.match(/-?\d+/); if(!m) return null;
  let n=parseInt(m[0],10); if(bce&&n>0) n=-n; return n;
}
function _float(v) {
  if(v==null) return null; const n=parseFloat(String(v).trim()); return isNaN(n)?null:n;
}
function _list(v) {
  if(!v) return []; return String(v).split(/[,;/]/).map(x=>x.trim()).filter(Boolean);
}
function _mapCom(val) {
  const out=[],seen=new Set();
  for(const raw of _list(val)){
    const k=_nv(raw),slug=_COM[k]||_COM[k.replace(/s$/,'')];
    if(slug&&!seen.has(slug)){out.push(slug);seen.add(slug);}
  }
  return out;
}
function _mapCat(val) {
  if(!val) return 'other'; const k=_nv(val);
  return _CAT[k]||_CAT[k.replace(/s$/,'')]||'other';
}

function _parseCSV(text) {
  const rows=[]; let i=0;
  while(i<text.length){
    const row=[]; let endOfData=false;
    while(!endOfData){
      let cell='';
      if(i<text.length&&text[i]==='"'){
        i++;
        while(i<text.length){
          if(text[i]==='"'&&text[i+1]==='"'){cell+='"';i+=2;}
          else if(text[i]==='"'){i++;break;}
          else cell+=text[i++];
        }
      } else {
        while(i<text.length&&text[i]!==','&&text[i]!=='\n'&&text[i]!=='\r') cell+=text[i++];
      }
      row.push(cell);
      if(i<text.length&&text[i]===',') i++;
      else endOfData=true;
    }
    while(i<text.length&&(text[i]==='\r'||text[i]==='\n')) i++;
    if(row.length&&!(row.length===1&&row[0]==='')) rows.push(row);
  }
  if(!rows.length) return [];
  const hdrs=rows[0];
  return rows.slice(1).map(r=>Object.fromEntries(hdrs.map((h,j)=>[h,r[j]??''])));
}

function _rowToFeature(row, existingById) {
  const n={},extras={};
  for(const [k,v] of Object.entries(row)){
    const int=_COL[_nk(k)];
    if(int) n[int]=(v||'').trim();
    else if(_nk(k)) extras[(k||'').trim()]=(v||'').trim();
  }
  const name=(n.name||'').trim(); if(!name) return null;
  // Skip rows explicitly marked unpublished (blank = publish by default)
  const pub=(n.published||'').trim();
  if(pub&&!_bool(pub)) return null;

  const fid=n.id||_slug(name);
  const lat=_float(n.lat),lon=_float(n.lon);
  const coords=(lat!=null&&lon!=null)?[lat,lon]:null;
  const feat={
    id:fid,name,
    category:_mapCat(n.category),
    community:_mapCom(n.community),
    coords,coords_approximate:_bool(n.coords_approximate),
    era_start:_year(n.era_start),era_end:_year(n.era_end),
    city:n.city||null,state:n.state||null,address:n.address||null,
    description:n.description||'',
    image_folder:n.image_folder||name,
    iiif_manifest:n.iiif_manifest||null,
    verified:_bool(n.verified),
    sources:_list(n.sources).length?_list(n.sources):['Google Sheet'],
  };
  if(feat.image_folder) feat.image_dir=`../${feat.image_folder}`;
  // Carry over image data from the static snapshot (images on disk)
  const prev=existingById[fid];
  if(prev){
    for(const k of ['images','tiff_archive','image_dir','image_dir_converted','converted_images']){
      if(k in prev&&!feat[k]) feat[k]=prev[k];
    }
  }
  if(n.notes) extras.notes=n.notes;
  if(n.image_uploaded!==undefined) extras.image_uploaded=_bool(n.image_uploaded);
  if(n.text_uploaded!==undefined)  extras.text_uploaded=_bool(n.text_uploaded);
  if(Object.keys(extras).length) feat.extras=extras;
  return feat;
}

// ─── loadFeatures ─────────────────────────────────────────────────────────────
// 1. If JIH_SHEET_URL is set, fetch the live published CSV directly from Google.
//    Changes to the sheet appear within minutes — no deploy required.
// 2. Falls back to the static JIH_FEATURES snapshot if the fetch fails.
// 3. Last resort: fetches data/features.json over HTTP.
async function loadFeatures() {
  const sheetUrl = typeof window !== 'undefined' && window.JIH_SHEET_URL;

  if (sheetUrl) {
    try {
      const res = await fetch(sheetUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const csvText = await res.text();
      const staticFeatures = (typeof window !== 'undefined' && window.JIH_FEATURES) || [];
      const existingById = Object.fromEntries(staticFeatures.map(f => [f.id, f]));
      const features = _parseCSV(csvText).map(r => _rowToFeature(r, existingById)).filter(Boolean);
      if (features.length > 0) return features;
      console.warn('[JIH] Live sheet returned 0 features — falling back to cached data.');
    } catch (e) {
      console.warn('[JIH] Live sheet fetch failed, using cached data:', e.message);
    }
  }

  // Fallback: static snapshot bundled at last deploy
  if (typeof window !== 'undefined' && window.JIH_FEATURES) return window.JIH_FEATURES;

  // Last resort: JSON over HTTP
  try {
    const res = await fetch('data/features.json');
    if (!res.ok) throw new Error('Failed to load features.json');
    const data = await res.json();
    return data.features;
  } catch (e) {
    console.error('[JIH] Could not load features:', e);
    return [];
  }
}

// Resolve image URL given a feature + filename
function imageUrl(feature, filename) {
  const dir = feature.image_dir || `../${feature.image_folder || ''}`;
  const enc = dir.split('/').map(seg => seg === '..' ? '..' : encodeURIComponent(seg)).join('/');
  return `${enc}/${encodeURIComponent(filename)}`;
}

function firstImage(feature) {
  if (!feature.images || !feature.images.length) return null;
  return imageUrl(feature, feature.images[0]);
}

function communityChips(feature) {
  // Ensure we are working with an array, even if data is missing
  const communities = Array.isArray(feature.community) 
    ? feature.community 
    : (feature.community ? [feature.community] : []);

  return communities
    .filter(c => COMMUNITY_LABELS[c]) // Only show valid, labeled communities
    .map(c => `<span class="chip ${c}">${COMMUNITY_LABELS[c]}</span>`)
    .join("");
}

function categoryLabel(feature) {
  // 1. Handle missing categories
  if (!feature.category || feature.category.length === 0) return "Site";
  
  // 2. Ensure it's treated as an array (just in case some old data is still a string)
  const cats = Array.isArray(feature.category) ? feature.category : [feature.category];
  
  // 3. Map each category to its human-readable label and join them with a comma
  return cats.map(c => CATEGORY_LABELS[c] || c).join(" · ");
}

function eraText(feature) {
  if (feature.date_start && feature.date_end) return `${feature.date_start}–${feature.date_end}`;
  if (feature.date_start) return `est. ${feature.date_start}`;
  return "Date unknown";
}

function setActiveNav(name) {
  document.querySelectorAll(".site-nav a").forEach(a => {
    if (a.dataset.nav === name) a.classList.add("active");
  });
}

function openLightbox(src) {
  let lb = document.getElementById("lightbox");
  if (!lb) {
    lb = document.createElement("div");
    lb.id = "lightbox";
    lb.className = "lightbox";
    lb.innerHTML = `<span class="close" aria-label="Close">&times;</span><img alt="">`;
    document.body.appendChild(lb);
    lb.addEventListener("click", () => lb.classList.remove("open"));
  }
  lb.querySelector("img").src = src;
  lb.classList.add("open");
}

function featureCardHTML(feature) {
  const img = firstImage(feature);
  const thumb = img
    ? `<div class="thumb" style="background-image:url('${img}')"></div>`
    : `<div class="thumb empty"><span>${categoryLabel(feature)}</span></div>`;
  return `
    <article class="card">
      <a href="feature.html?id=${encodeURIComponent(feature.id)}">
        ${thumb}
        <div class="body">
          <h3 class="title">${feature.name}</h3>
          <div class="meta">${categoryLabel(feature)} · ${eraText(feature)}${feature.city ? ' · ' + feature.city : ''}</div>
          <div class="chips">${communityChips(feature)}</div>
        </div>
      </a>
    </article>`;
}

// The Peacock SVG mark — used in headers, hero, and as a subtle empty-state illustration.
const PEACOCK_SVG = `
<svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <!-- Plumes (stylized eye feathers, fanning out) -->
  <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
    <path d="M60 78 C 18 78  -2 50  16 14"/>
    <path d="M60 78 C 28 80  10 56  22 22"/>
    <path d="M60 78 C 38 84  20 64  34 28"/>
    <path d="M60 78 C 50 86  44 70  50 30"/>
    <path d="M60 78 C 60 86  62 70  60 28"/>
    <path d="M60 78 C 70 86  76 70  70 30"/>
    <path d="M60 78 C 82 84 100 64  86 28"/>
    <path d="M60 78 C 92 80 110 56  98 22"/>
    <path d="M60 78 C 102 78 122 50 104 14"/>
  </g>
  <!-- Eye markings on plume tips -->
  <g>
    <ellipse cx="16" cy="14" rx="3.2" ry="4.6" fill="#D4A537"/>
    <ellipse cx="22" cy="22" rx="3.2" ry="4.6" fill="#D4A537"/>
    <ellipse cx="34" cy="28" rx="3.2" ry="4.6" fill="#D4A537"/>
    <ellipse cx="50" cy="30" rx="3.2" ry="4.6" fill="#D4A537"/>
    <ellipse cx="60" cy="28" rx="3.2" ry="4.6" fill="#D4A537"/>
    <ellipse cx="70" cy="30" rx="3.2" ry="4.6" fill="#D4A537"/>
    <ellipse cx="86" cy="28" rx="3.2" ry="4.6" fill="#D4A537"/>
    <ellipse cx="98" cy="22" rx="3.2" ry="4.6" fill="#D4A537"/>
    <ellipse cx="104" cy="14" rx="3.2" ry="4.6" fill="#D4A537"/>
  </g>
  <g fill="currentColor">
    <circle cx="16" cy="14" r="1.4"/>
    <circle cx="22" cy="22" r="1.4"/>
    <circle cx="34" cy="28" r="1.4"/>
    <circle cx="50" cy="30" r="1.4"/>
    <circle cx="60" cy="28" r="1.4"/>
    <circle cx="70" cy="30" r="1.4"/>
    <circle cx="86" cy="28" r="1.4"/>
    <circle cx="98" cy="22" r="1.4"/>
    <circle cx="104" cy="14" r="1.4"/>
  </g>
  <!-- Body (teardrop) -->
  <path d="M60 78 C 50 78 46 88 50 100 C 52 110 58 118 60 122 C 62 118 68 110 70 100 C 74 88 70 78 60 78 Z"
        fill="currentColor"/>
  <!-- Head + crest -->
  <circle cx="60" cy="74" r="6" fill="currentColor"/>
  <g stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none">
    <line x1="58" y1="68" x2="56" y2="62"/>
    <line x1="60" y1="67" x2="60" y2="60"/>
    <line x1="62" y1="68" x2="64" y2="62"/>
  </g>
  <circle cx="56" cy="62" r="1.4" fill="#D4A537"/>
  <circle cx="60" cy="60" r="1.4" fill="#D4A537"/>
  <circle cx="64" cy="62" r="1.4" fill="#D4A537"/>
  <!-- Beak -->
  <path d="M65 75 L 71 76 L 65 78 Z" fill="#D4A537"/>
  <!-- Eye -->
  <circle cx="58" cy="73" r="1.1" fill="#fff"/>
</svg>`;

// Inject the peacock into any element matching .peacock-mark
function injectPeacock() {
  document.querySelectorAll('.peacock-mark').forEach(el => {
    el.innerHTML = PEACOCK_SVG;
  });
}
document.addEventListener('DOMContentLoaded', injectPeacock);

/* ============ Dark mode ============ */
(function applyStoredTheme() {
  // Run before paint to avoid flash
  let stored;
  try { stored = localStorage.getItem('jih-theme'); } catch (e) { stored = null; }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
})();

function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const sync = () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    btn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    btn.innerHTML = dark
      ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/></svg>'
      : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  };
  sync();
  btn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('jih-theme', next); } catch (e) {}
    sync();
  });
}
document.addEventListener('DOMContentLoaded', setupThemeToggle);

/* ============ Mobile menu toggle ============ */
function setupMobileMenu() {
  const btn = document.getElementById('menu-btn');
  const nav = document.querySelector('.site-nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  // Close menu when a link is clicked
  nav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      nav.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
  });
}
document.addEventListener('DOMContentLoaded', setupMobileMenu);

/* ============ Site-wide search (header dropdown) ============ */
async function setupSiteSearch() {
  const input   = document.getElementById('site-search');
  const results = document.getElementById('site-search-results');
  if (!input || !results) return;

  const features = await loadFeatures();

  function close() {
    results.classList.remove('open');
    results.innerHTML = '';
  }

  function render(matches, q) {
    if (!matches.length) {
      results.innerHTML = `<div class="site-search-empty">No matches for "${q}".</div>`;
      results.classList.add('open');
      return;
    }
    results.innerHTML = matches.slice(0, 10).map(f => {
      const where = [f.city, f.state].filter(Boolean).join(', ');
      return `
        <a class="site-search-item" href="feature.html?id=${encodeURIComponent(f.id)}">
          <span class="site-search-name">${f.name}</span>
          <span class="site-search-meta">${categoryLabel(f)}${where ? ' · ' + where : ''}</span>
        </a>`;
    }).join('') + (matches.length > 10
      ? `<div class="site-search-more">+${matches.length - 10} more matches</div>`
      : '');
    results.classList.add('open');
  }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { close(); return; }
    const matches = features.filter(f =>
      f.name.toLowerCase().includes(q) ||
      (f.city || '').toLowerCase().includes(q) ||
      (f.state || '').toLowerCase().includes(q) ||
      (f.description || '').toLowerCase().includes(q)
    );
    render(matches, q);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2) input.dispatchEvent(new Event('input'));
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.site-search')) close();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); input.blur(); }
    if (e.key === 'Enter') {
      const first = results.querySelector('.site-search-item');
      if (first) location.href = first.getAttribute('href');
    }
  });
}
document.addEventListener('DOMContentLoaded', setupSiteSearch);
