/* Map page — Jewish India Digital Heritage Trail */

const COMMUNITY_COLORS = {
  bene_israel: "#2a6f97",
  baghdadi:    "#b8862f",
  cochini:     "#6a994e",
  kerala:      "#386641",
  diaspora:    "#9c4f3f",
  emerging:    "#6f4e7c"
};

let MAP, ALL = [], LAYER, MARKERS = {};

const state = {
  communities: new Set(Object.keys(COMMUNITY_COLORS)),
  categories: new Set(),  // empty = all
  regions: new Set(),     // empty = all
  yearMin: -500,
  yearMax: 2026,
  showUndated: true
};

function urlState() {
  const u = new URLSearchParams(location.search);
  if (u.has("community")) {
    state.communities = new Set([u.get("community")]);
  }
  if (u.has("category")) {
    state.categories = new Set([u.get("category")]);
  }
}

function communityIcon(community) {
  const c = (community && community.find(x => COMMUNITY_COLORS[x])) || "bene_israel";
  const color = COMMUNITY_COLORS[c] || "#888";
  return L.divIcon({
    className: "ji-marker",
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

function buildFilters() {
  // Communities
  const comm = document.getElementById("community-filters");
  comm.innerHTML = Object.keys(COMMUNITY_COLORS).map(k => `
    <label>
      <input type="checkbox" data-community="${k}" ${state.communities.has(k) ? 'checked' : ''}>
      <span class="legend-swatch" style="background:${COMMUNITY_COLORS[k]}"></span>
      ${COMMUNITY_LABELS[k]}
    </label>
  `).join("");

  // Categories — derive from data
  const allCats = ALL.flatMap(f => f.category || []);
  const cats = [...new Set(allCats)].sort();
  
  const catEl = document.getElementById("category-filters");
  catEl.innerHTML = `<label><input type="checkbox" id="all-categories" ${state.categories.size === 0 ? 'checked' : ''}> All</label>` +
    cats.map(c => `
      <label>
        <input type="checkbox" data-category="${c}" ${state.categories.size === 0 || state.categories.has(c) ? 'checked' : ''}>
        ${(typeof CATEGORY_LABELS !== 'undefined' && CATEGORY_LABELS[c]) || c}
      </label>
    `).join("");
    
  // Regions — top cities
  const regions = {};
  ALL.forEach(f => {
    const r = f.city || f.region || 'Unknown';
    regions[r] = (regions[r] || 0) + 1;
  });
  const sortedRegions = Object.entries(regions).sort((a, b) => b[1] - a[1]);
  const regEl = document.getElementById("region-filters");
  regEl.innerHTML = `<label><input type="checkbox" id="all-regions" checked> All regions</label>` +
    sortedRegions.map(([r, n]) => `
      <label>
        <input type="checkbox" data-region="${r}" ${state.regions.size === 0 || state.regions.has(r) ? 'checked' : ''}>
        ${r} <span style="color:var(--muted);font-size:11px">(${n})</span>
      </label>
    `).join("");

  bindFilterEvents();
  updateTimelineLabels();
}

function bindFilterEvents() {
  document.querySelectorAll('input[data-community]').forEach(el => {
    el.addEventListener('change', () => {
      if (el.checked) state.communities.add(el.dataset.community);
      else state.communities.delete(el.dataset.community);
      render();
    });
  });
  document.getElementById('all-categories').addEventListener('change', e => {
    document.querySelectorAll('input[data-category]').forEach(c => c.checked = e.target.checked);
    state.categories.clear();
    render();
  });
  document.querySelectorAll('input[data-category]').forEach(el => {
    el.addEventListener('change', () => {
      const checked = [...document.querySelectorAll('input[data-category]')].filter(c => c.checked).map(c => c.dataset.category);
      const total = document.querySelectorAll('input[data-category]').length;
      if (checked.length === total) {
        state.categories.clear();
        document.getElementById('all-categories').checked = true;
      } else {
        state.categories = new Set(checked);
        document.getElementById('all-categories').checked = false;
      }
      render();
    });
  });
  document.getElementById('all-regions').addEventListener('change', e => {
    document.querySelectorAll('input[data-region]').forEach(c => c.checked = e.target.checked);
    state.regions.clear();
    render();
  });
  document.querySelectorAll('input[data-region]').forEach(el => {
    el.addEventListener('change', () => {
      const checked = [...document.querySelectorAll('input[data-region]')].filter(c => c.checked).map(c => c.dataset.region);
      const total = document.querySelectorAll('input[data-region]').length;
      if (checked.length === total) {
        state.regions.clear();
        document.getElementById('all-regions').checked = true;
      } else {
        state.regions = new Set(checked);
        document.getElementById('all-regions').checked = false;
      }
      render();
    });
  });
  // Timeline
  const tmin = document.getElementById('timeline-min');
  const tmax = document.getElementById('timeline-max');
  const upd = () => {
    let lo = +tmin.value, hi = +tmax.value;
    if (lo > hi) { [lo, hi] = [hi, lo]; }
    state.yearMin = lo;
    state.yearMax = hi;
    updateTimelineLabels();
    render();
  };
  tmin.addEventListener('input', upd);
  tmax.addEventListener('input', upd);
  document.getElementById('show-undated').addEventListener('change', e => {
    state.showUndated = e.target.checked;
    render();
  });
}

function fmtYear(y) {
  if (y < 0) return `${-y} BCE`;
  if (y < 1000) return `${y} CE`;
  return `${y}`;
}
function updateTimelineLabels() {
  const out = document.getElementById('timeline-output');
  out.innerHTML = `<span>${fmtYear(state.yearMin)}</span><span>${fmtYear(state.yearMax)}</span>`;
  const fill = document.getElementById('timeline-fill');
  if (fill) {
    const tmin = document.getElementById('timeline-min');
    const lo = +tmin.min, hi = +tmin.max;
    const a = Math.max(0, Math.min(1, (state.yearMin - lo) / (hi - lo)));
    const b = Math.max(0, Math.min(1, (state.yearMax - lo) / (hi - lo)));
    fill.style.left  = (a * 100) + '%';
    fill.style.right = ((1 - b) * 100) + '%';
  }
}

function passesFilters(f) {
  // Community: must intersect (your existing logic)
  if (state.communities.size > 0) {
    const cs = (f.community || []).filter(c => COMMUNITY_COLORS[c]);
    if (cs.length > 0 && !cs.some(c => state.communities.has(c))) {
      return false;
    }
  }

  // FIXED: Category logic for Lists
  if (state.categories.size > 0) {
    // Check if at least one of the site's categories is in the selected filters
    const siteCategories = f.category || [];
    const hasMatch = siteCategories.some(cat => state.categories.has(cat));
    if (!hasMatch) return false;
  }

  // Region & Timeline (your existing logic)
  if (state.regions.size > 0) {
    const r = f.city || f.region || 'Unknown';
    if (!state.regions.has(r)) return false;
  }
  
  // Use date_start from your features.json (check if it exists)
  if (f.date_start == null) {
    if (!state.showUndated) return false;
  } else {
    if (f.date_start < state.yearMin || f.date_start > state.yearMax) return false;
  }
  
  return true;
}

function render() {
  if (LAYER) { MAP.removeLayer(LAYER); }
  LAYER = L.markerClusterGroup({ maxClusterRadius: 40, disableClusteringAtZoom: 14 });
  MARKERS = {};
  let shown = 0;
  ALL.forEach(f => {
    if (!f.coords) return;
    if (!passesFilters(f)) return;
    const m = L.marker(f.coords, { icon: communityIcon(f.community) });
    
    // THIS IS CORRECT: Click only shows detail, URL is not updated here.
    m.on('click', () => {
      showDetail(f);
    });
    
    LAYER.addLayer(m);
    MARKERS[f.id] = m;
    shown++;
  });
  MAP.addLayer(LAYER);
  document.getElementById('counts').innerHTML = `<strong>${shown}</strong> of ${ALL.length} sites shown`;
}

function showDetail(f) {
  const panel = document.getElementById('detail');
  
  // 1. Smart Media Handling
  let mediaHtml = '';

  // Safely ensure manifests is an array
  const manifests = Array.isArray(f.iiif_manifest) 
    ? f.iiif_manifest 
    : (f.iiif_manifest ? [f.iiif_manifest] : []);

  if (manifests.length > 0) {
    // Multi-viewer Horizontal Slider (same logic as feature.html)
    mediaHtml = `
      <style>
        .sidebar-iiif-slider {
          display: flex;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          gap: 1rem;
          padding-bottom: 0.5rem;
          scrollbar-width: thin;
        }
        .sidebar-iiif-slider::-webkit-scrollbar { height: 6px; }
        .sidebar-iiif-slider::-webkit-scrollbar-thumb { background: var(--border, #ccc); border-radius: 4px; }
        .sidebar-iiif-slide {
          flex: 0 0 100%;
          scroll-snap-align: center;
          min-width: 0;
        }
      </style>
      <div style="margin: 1rem 0;">
        ${manifests.length > 1 ? `<p style="font-size: 0.8em; color: var(--muted); margin-bottom: 0.5rem;">Swipe to view ${manifests.length} collections →</p>` : ''}
        <div class="sidebar-iiif-slider">
          ${manifests.map((manifestUrl, index) => `
            <div class="sidebar-iiif-slide">
              <div style="border: 1px solid var(--border); border-radius: 6px; overflow: hidden; background: #111;">
                <iframe 
                  src="https://uv-v4.netlify.app/#?manifest=${encodeURIComponent(manifestUrl)}" 
                  width="100%" 
                  height="280px" 
                  frameborder="0" 
                  allowfullscreen
                  title="IIIF Document Viewer ${index + 1}">
                </iframe>
              </div>
              <p style="margin-top: 0.5rem; font-size: 0.8em; text-align: center;">
                <a class="full-link" href="https://uv-v4.netlify.app/#?manifest=${encodeURIComponent(manifestUrl)}" target="_blank" rel="noopener">
                  Open Viewer ${manifests.length > 1 ? index + 1 : ''} full screen ↗
                </a>
              </p>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  } else if (f.images && f.images.length > 0) {
    // If no IIIF, but local images exist, show the standard gallery
    const imgs = f.images.slice(0, 6);
    mediaHtml = `<div class="gallery">` +
        imgs.map(img => `<img src="${imageUrl(f, img)}" alt="${f.name}" loading="lazy" onclick="openLightbox(this.src)">`).join("") +
        (f.images.length > 6 ? `<div class="more">+${f.images.length - 6} more</div>` : '') +
      `</div>`;
  } else {
    // Only show this placeholder if NEITHER exist
    mediaHtml = `<div class="no-images">No images yet</div>`;
  }

  // 2. Build the rest of the text
  const desc = f.description
    ? `<div class="description">${f.description}</div>`
    : `<div class="description placeholder">Description not yet written.</div>`;
    
  const meta = [
    categoryLabel(f),
    eraText(f),
    f.city || f.region,
    f.coords_approximate ? '· coords approximate' : ''
  ].filter(Boolean).join(' · ');

  // Generate the absolute URL for the permalink
  const permalinkUrl = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(f.id)}`;

  // 3. Render the panel
  panel.innerHTML = `
    <div class="panel-content">
      <h2>${f.name}</h2>
      <div class="meta-line">${meta}</div>
      <div class="chips chips-row">${communityChips(f)}</div>
      ${mediaHtml}
      ${desc}
      ${f.address ? `<div class="panel-address"><strong>Address:</strong> ${f.address}</div>` : ''}
      
      <div style="margin: 1.5rem 0 1rem 0; padding: 0.75rem; background: var(--bg-alt, #f4f4f4); border-radius: 6px;">
        <label style="display: block; font-size: 0.8em; font-weight: 600; margin-bottom: 0.3rem; color: var(--muted, #666); text-transform: uppercase; letter-spacing: 0.5px;">Map Permalink</label>
        <input 
          type="text" 
          readonly 
          value="${permalinkUrl}" 
          onclick="this.select(); navigator.clipboard.writeText(this.value);" 
          style="width: 100%; padding: 0.5rem; border: 1px solid var(--border, #ccc); border-radius: 4px; background: #fff; color: #333; cursor: copy; font-family: monospace; font-size: 0.85em;"
          title="Click to copy to clipboard"
        >
      </div>

      <a class="full-link" href="feature.html?id=${encodeURIComponent(f.id)}">View full page →</a>
    </div>
  `;
}

function setupSidebarToggle() {
  const layout  = document.querySelector('.map-layout');
  const toggle  = document.getElementById('sidebar-toggle');
  if (!layout || !toggle) return;

  // Persist collapsed state across reloads
  const stored = localStorage.getItem('jih-sidebar-collapsed');
  if (stored === '1') layout.classList.add('sidebar-collapsed');

  function syncLabel() {
    const collapsed = layout.classList.contains('sidebar-collapsed');
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.title = collapsed ? 'Show filters' : 'Hide filters';
  }
  syncLabel();

  toggle.addEventListener('click', () => {
    layout.classList.toggle('sidebar-collapsed');
    localStorage.setItem(
      'jih-sidebar-collapsed',
      layout.classList.contains('sidebar-collapsed') ? '1' : '0'
    );
    syncLabel();
    // Leaflet needs to recalc tile size after layout change
    setTimeout(() => MAP && MAP.invalidateSize(), 220);
  });
}

(async function() {
  ALL = await loadFeatures();
  urlState();
  // Initial map view: India
  MAP = L.map('map', {
    center: [21, 78], zoom: 5, scrollWheelZoom: true,
    zoomControl: false   // we add it on the right so it doesn't collide with the sidebar toggle
  });
  L.control.zoom({ position: 'topright' }).addTo(MAP);

  // Soft, archive-friendly base map (CARTO Positron — clean, light, free, no key)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(MAP);

  buildFilters();
  setupSidebarToggle();
  render();

  // --- DYNAMIC VIEWPORT SYNC ---
  // Allow initial page load animations (like fitBounds) to finish before tracking movement
  let isMapReady = false;
  setTimeout(() => isMapReady = true, 1000);

  MAP.on('moveend', () => {
    if (!isMapReady) return;

    const currentUrl = new URL(window.location);
    const center = MAP.getCenter();
    const zoom = MAP.getZoom();
    
    // Always track the viewport
    currentUrl.searchParams.set('lat', center.lat.toFixed(4));
    currentUrl.searchParams.set('lng', center.lng.toFixed(4));
    currentUrl.searchParams.set('z', zoom);
    
    // Drop the ID so the URL strictly represents the geographic view
    currentUrl.searchParams.delete('id');
    
    window.history.replaceState({}, '', currentUrl);
  });

  // --- URL ROUTING LOGIC ---
  const u = new URLSearchParams(location.search);

  // 1. Zoom to a specific feature (e.g., ?id=haffkine-institute)
  if (u.has("id")) {
    const targetId = u.get("id");
    const feature = ALL.find(f => f.id === targetId);
    
    if (feature && feature.coords) {
      // Zoom close up to the feature
      MAP.setView(feature.coords, 16); 
      // Open the sidebar detail panel automatically
      showDetail(feature); 
    }
  } 
  // 2. Center on specific coordinates (e.g., ?lat=18.96&lng=72.83&z=14)
  else if (u.has("lat") && u.has("lng")) {
    const lat = parseFloat(u.get("lat"));
    const lng = parseFloat(u.get("lng"));
    const z = parseInt(u.get("z")) || 12; // Default to zoom 12 if 'z' is missing
    
    if (!isNaN(lat) && !isNaN(lng)) {
      MAP.setView([lat, lng], z);
    }
  } 
  // 3. Your existing logic: zoom to fit filtered communities/categories
  else if (u.has("community") || u.has("category")) {
    const visibleCoords = ALL.filter(passesFilters).filter(f => f.coords).map(f => f.coords);
    if (visibleCoords.length > 1) {
      MAP.fitBounds(L.latLngBounds(visibleCoords).pad(0.1));
    }
  }
})();
