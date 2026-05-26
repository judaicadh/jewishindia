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
  synagogue: "Synagogue",
  cemetery: "Cemetery",
  education: "Education",
  medical: "Medical",
  mill: "Mill",
  library: "Library",
  trade_and_buisness: "Trade and Business",
  military: "Military",
  bollywood: "Bollywood",
  civic: "Civic",
  other: "Other"
};

// Load features from the inline data file (works from file:// — no fetch needed)
async function loadFeatures() {
  if (typeof window !== 'undefined' && window.JIH_FEATURES) {
    return window.JIH_FEATURES;
  }
  // Fallback: fetch the JSON (only works over http(s))
  try {
    const res = await fetch("data/features.json");
    if (!res.ok) throw new Error("Failed to load features.json");
    const data = await res.json();
    return data.features;
  } catch (e) {
    console.error("Could not load features:", e);
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
  return (feature.community || [])
    .filter(c => COMMUNITY_LABELS[c])  // hide internal-only tags like "civic"
    .map(c => `<span class="chip ${c}">${COMMUNITY_LABELS[c]}</span>`)
    .join("");
}

function categoryLabel(feature) {
  return CATEGORY_LABELS[feature.category] || feature.category || "Site";
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
