// MAP + LAYERS
// ============================================================

// Gemeinsame Tile-Definitionen für Detail- und Übersichtskarte
const TILE_DEFS = {
  'swiss-luft':  { url:'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg',                  attr:'© <a href="https://swisstopo.admin.ch">swisstopo</a>', maxZoom:20 },
  'swiss-karte': { url:'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',             attr:'© <a href="https://swisstopo.admin.ch">swisstopo</a>', maxZoom:20 },
  'google-maps': { url:'https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}',                                                             attr:'© Google', maxZoom:21 },
  'google-sat':  { url:'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',                                                             attr:'© Google', maxZoom:21 },
};
function makeTile(key, opts={}) {
  const d = TILE_DEFS[key];
  return L.tileLayer(d.url, { attribution: d.attr, maxZoom: d.maxZoom, ...opts });
}

// Umwelt-WMS-Overlays (GWS + KbS + Schutzgebiete) — werden bei Bedarf hinzugefügt/entfernt
let _umweltOverlays = [];

const _WMS_ZOOM_OPTS = { maxZoom: 20, maxNativeZoom: 18 };

function _buildUmweltOverlays() {
  return [
    // Gewässerschutzzonen (geodienste.ch, alle Kantone)
    L.tileLayer.wms('https://geodienste.ch/db/planerischer_gewaesserschutz_v1_2_0/deu', {
      layers: 'gewaesserschutzkarte', format: 'image/png', transparent: true, opacity: 0.55,
      ..._WMS_ZOOM_OPTS,
    }),
    // Kataster belasteter Standorte (geo.admin.ch)
    L.tileLayer.wms('https://wms.geo.admin.ch/', {
      layers: 'ch.bav.kataster-belasteter-standorte-oev,ch.bazl.kataster-belasteter-standorte-zivilflugplaetze,ch.vbs.kataster-belasteter-standorte-militaer',
      format: 'image/png', transparent: true, opacity: 0.7,
      ..._WMS_ZOOM_OPTS,
    }),
    // Bundesschutzgebiete (geo.admin.ch)
    L.tileLayer.wms('https://wms.geo.admin.ch/', {
      layers: 'ch.bafu.bundesinventare-bln,ch.bafu.schutzgebiete-aulav_auen,ch.bafu.schutzgebiete-aulav_moorlandschaften,ch.pronatura.naturschutzgebiete',
      format: 'image/png', transparent: true, opacity: 0.6,
      ..._WMS_ZOOM_OPTS,
    }),
  ];
}

function _applyUmweltOverlays(map) {
  _umweltOverlays.forEach(l => { try { map.removeLayer(l); } catch {} });
  _umweltOverlays = _buildUmweltOverlays();
  _umweltOverlays.forEach(l => l.addTo(map));
  _addUmweltLegend(map);
}

function _removeUmweltOverlays(map) {
  _umweltOverlays.forEach(l => { try { map.removeLayer(l); } catch {} });
  _umweltOverlays = [];
  const leg = document.getElementById('umwelt-legend');
  if (leg) leg.remove();
}

function _addUmweltLegend(map) {
  const existing = document.getElementById('umwelt-legend');
  if (existing) existing.remove();
  const container = map.getContainer();
  const div = document.createElement('div');
  div.id = 'umwelt-legend';
  div.style.cssText = 'position:absolute;bottom:60px;right:10px;z-index:1000;background:rgba(255,255,255,0.95);'
    + 'border:1px solid #d1d5db;border-radius:8px;padding:10px 12px;font-size:10px;'
    + 'font-family:inherit;box-shadow:0 2px 8px rgba(0,0,0,0.12);min-width:180px;';
  div.innerHTML = `
    <div style="font-weight:700;font-size:10px;color:#374151;margin-bottom:7px;letter-spacing:0.03em;">UMWELT — LEGENDE</div>
    <div style="font-weight:600;color:#6b7280;font-size:9px;margin-bottom:4px;margin-top:2px;">GEWÄSSERSCHUTZ (geodienste.ch)</div>
    ${[
      ['#0a1f6e','S1 — Fassungsbereich'],
      ['#1d4ed8','S2 — Engere Schutzzone'],
      ['#60a5fa','S3 — Weitere Schutzzone'],
      ['#bfdbfe','Zuströmbereich'],
      ['#fda4af','Ao — Bes. gefährdeter Bereich'],
      ['#fce7f3','Au — Übriger Schutzbereich'],
    ].map(([c,l]) => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
      <span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${c};flex-shrink:0;border:1px solid rgba(0,0,0,0.12);"></span>
      <span style="color:#374151;">${l}</span></div>`).join('')}
    <div style="font-weight:600;color:#6b7280;font-size:9px;margin-bottom:4px;margin-top:6px;">ALTLASTEN KbS (geo.admin.ch)</div>
    ${[
      ['#f59e0b','Kataster belasteter Standorte'],
    ].map(([c,l]) => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
      <span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${c};flex-shrink:0;border:1px solid rgba(0,0,0,0.12);"></span>
      <span style="color:#374151;">${l}</span></div>`).join('')}
    <div style="font-weight:600;color:#6b7280;font-size:9px;margin-bottom:4px;margin-top:6px;">SCHUTZGEBIETE (geo.admin.ch)</div>
    ${[
      ['#166534','BLN / Naturschutzgebiete'],
      ['#4ade80','Auen / Moorlandschaften'],
    ].map(([c,l]) => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
      <span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${c};flex-shrink:0;border:1px solid rgba(0,0,0,0.12);"></span>
      <span style="color:#374151;">${l}</span></div>`).join('')}`;
  container.style.position = 'relative';
  container.appendChild(div);
}

// Detailkarte: aktive Basis-Karte
let detailBaseLayer = null;
let detailBaseLayerKey = 'swiss-luft';

function setDetailBaseLayer(key) {
  detailBaseLayerKey = key;
  if (leafletMap) {
    _removeUmweltOverlays(leafletMap);
    if (detailBaseLayer) leafletMap.removeLayer(detailBaseLayer);
    detailBaseLayer = makeTile(key === 'umwelt' ? 'swiss-karte' : key,
      key === 'umwelt' ? { className: 'umwelt-base-tile' } : {}).addTo(leafletMap);
    detailBaseLayer.bringToBack();
    if (key === 'umwelt') _applyUmweltOverlays(leafletMap);
  }
  // Sync dropdown
  const sel = document.getElementById('detail-basemap-select');
  if (sel) sel.value = key;
  // Legacy buttons
  ['swiss-luft','swiss-karte','google-maps','google-sat'].forEach(k => {
    const btn = document.getElementById('map-btn-' + k);
    if (btn) btn.classList.toggle('active', k === key);
  });
}

// ============================================================
// PARZELLEN-INFO via swisstopo REST API
// ============================================================
let parcelQueryActive = false;

function toggleParcelQuery() {
  parcelQueryActive = !parcelQueryActive;
  const btn = document.getElementById('btn-parcel-query');
  if (btn) btn.classList.toggle('active', parcelQueryActive);
  if (leafletMap) leafletMap.getContainer().style.cursor = parcelQueryActive ? 'crosshair' : '';
}

function queryParcelInfo(latlng) {
  if (!leafletMap) return;

  const lat = latlng.lat, lng = latlng.lng;
  const lv95 = wgs84ToLv95(lat, lng);
  const E = lv95.e, N = lv95.n;

  // Standort-Links (koordinatenbasiert)
  const linkGeoAdmin   = `https://map.geo.admin.ch/#/map?lang=de&center=${E},${N}&z=17&bgLayer=ch.swisstopo.swissimage&crosshair=marker`;
  const linkGoogleMaps = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
  const linkStreetView = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lng.toFixed(6)}`;

  const loadingHtml = `<div class="map-popup">
    <div class="map-popup-header">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      Parzellendaten laden…
    </div>
    <div class="map-popup-body" style="color:#9ca3af;font-size:11px;padding:10px 12px;">Abfrage läuft…</div>
  </div>`;

  const popup = L.popup({ maxWidth: 300, className: 'sp-popup' })
    .setLatLng(latlng)
    .setContent(loadingHtml)
    .openOn(leafletMap);

  const bounds = leafletMap.getBounds();
  const size   = leafletMap.getSize();
  const params = new URLSearchParams({
    geometry:       `${lng},${lat}`,
    geometryType:   'esriGeometryPoint',
    layers:         'all:ch.swisstopo-vd.amtliche-vermessung',
    mapExtent:      `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`,
    imageDisplay:   `${size.x},${size.y},96`,
    tolerance:      '10',
    sr:             '4326',
    lang:           'de',
    returnGeometry: 'false',
  });

  // Gemeinsamer Link-Footer für alle Zustände
  const linksHtml = `
    <div class="map-popup-links">
      <a class="map-popup-link" href="${linkGeoAdmin}" target="_blank" title="map.geo.admin.ch">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
        geo.admin
      </a>
      <a class="map-popup-link" href="${linkGoogleMaps}" target="_blank" title="Google Maps">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Google Maps
      </a>
      <a class="map-popup-link" href="${linkStreetView}" target="_blank" title="Street View">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/></svg>
        Street View
      </a>
    </div>`;

  fetch(`https://api.geo.admin.ch/rest/services/ech/MapServer/identify?${params}`)
    .then(r => r.json())
    .then(data => {
      if (!data.results?.length) {
        popup.setContent(`<div class="map-popup">
          <div class="map-popup-header">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Koordinaten
          </div>
          <div class="map-popup-body">
            <div class="map-popup-row"><span class="map-popup-label">LV95</span><span class="map-popup-val">${E} / ${N}</span></div>
            <div class="map-popup-row"><span class="map-popup-label">WGS84</span><span class="map-popup-val">${lat.toFixed(5)}, ${lng.toFixed(5)}</span></div>
            <div class="map-popup-row" style="border:none;padding-top:5px;"><span class="map-popup-label" style="color:#d97706;">Parzelle</span><span class="map-popup-val" style="color:#9ca3af;">Keine Daten</span></div>
          </div>
          ${linksHtml}
        </div>`);
        return;
      }

      // Liegenschaft bevorzugen (rein numerische Nummer); SDR haben Buchstaben wie «D15»
      const hit = data.results.find(r => /^\d+$/.test(r.attributes.number)) ?? data.results[0];
      const a = hit.attributes;
      const parcel = {
        number:        a.number || a.label || '–',
        egrid:         a.egris_egrid || '',
        identnd:       a.identnd    || '',
        ak:            a.ak         || '',
        geoportal_url: a.geoportal_url || '',
      };

      popup.setContent(`<div class="map-popup">
        <div class="map-popup-header">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          Parzelle Nr. ${parcel.number}
        </div>
        <div class="map-popup-body">
          ${parcel.ak      ? `<div class="map-popup-row"><span class="map-popup-label">Kanton</span><span class="map-popup-val">${parcel.ak}</span></div>` : ''}
          ${parcel.egrid   ? `<div class="map-popup-row"><span class="map-popup-label">EGRID</span><span class="map-popup-val" style="font-size:10px;">${parcel.egrid}</span></div>` : ''}
          ${parcel.identnd ? `<div class="map-popup-row"><span class="map-popup-label">Ident.Nr.</span><span class="map-popup-val">${parcel.identnd}</span></div>` : ''}
          <div class="map-popup-row"><span class="map-popup-label">LV95</span><span class="map-popup-val">${E} / ${N}</span></div>
          ${parcel.geoportal_url ? `<div class="map-popup-row" style="border:none;padding-top:4px;"><a href="${parcel.geoportal_url}" target="_blank" style="color:#3b82f6;font-size:11px;font-weight:600;text-decoration:none;">→ Kantonsplan</a></div>` : ''}
        </div>
        ${linksHtml}
      </div>`);
    })
    .catch(() => {
      popup.setContent(`<div class="map-popup">
        <div class="map-popup-header" style="background:#ef4444;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Abfrage fehlgeschlagen
        </div>
        <div class="map-popup-body">
          <div class="map-popup-row"><span class="map-popup-label">LV95</span><span class="map-popup-val">${E} / ${N}</span></div>
        </div>
        ${linksHtml}
      </div>`);
    });
}


// Popup-HTML für RS/RKS/BS-Marker — Sidebar-Design + Standort-Links
function mkMarkerPopupHtml(type, e, n, ll, pairId) {
  const isRS    = type === 'RS';
  const color   = isRS ? '#2b6cb0' : type === 'RKS' ? '#9d174d' : '#b45309';
  const lv95 = wgs84ToLv95(ll.lat, ll.lng);
  const E = lv95.e, N = lv95.n;
  const lat = ll.lat.toFixed(6), lng = ll.lng.toFixed(6);

  const linkGeoAdmin   = `https://map.geo.admin.ch/#/map?lang=de&center=${E},${N}&z=17&bgLayer=ch.swisstopo.swissimage&crosshair=marker`;
  const linkGoogleMaps = `https://www.google.com/maps?q=${lat},${lng}`;
  const linkStreetView = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

  const propBtn = pairId != null
    ? `<button onclick="if(leafletMap)leafletMap.closePopup();openQuickEdit(${pairId})"
        title="Eigenschaften"
        style="padding:2px 7px;border-radius:5px;border:1px solid rgba(255,255,255,0.35);background:rgba(255,255,255,0.15);
               color:white;font-size:10px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:3px;white-space:nowrap;">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Eigenschaften
      </button>`
    : '';

  return `<div class="map-popup" style="min-width:210px;">
    <div class="map-popup-header" style="background:${color};display:flex;align-items:center;justify-content:space-between;gap:6px;">
      <span style="display:flex;align-items:center;gap:5px;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        ${type}
      </span>
      ${propBtn}
    </div>
    <div class="map-popup-body">
      <div class="map-popup-row"><span class="map-popup-label">LV95 E</span><span class="map-popup-val">${e}</span></div>
      <div class="map-popup-row"><span class="map-popup-label">LV95 N</span><span class="map-popup-val">${n}</span></div>
      <div style="font-size:10px;color:#9ca3af;text-align:center;padding-top:4px;">Marker lang drücken zum verschieben</div>
    </div>
    <div class="map-popup-links">
      <a class="map-popup-link" href="${linkGeoAdmin}" target="_blank">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
        geo.admin
      </a>
      <a class="map-popup-link" href="${linkGoogleMaps}" target="_blank">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Google Maps
      </a>
      <a class="map-popup-link" href="${linkStreetView}" target="_blank">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/></svg>
        Street View
      </a>
    </div>
  </div>`;
}

// Popup für Fundamentstandort-Marker (Bauprojektphase) — Massnahme-Farbe, kein Entsperren-Button
function mkFundPopupHtml(pair, ll) {
  const bpData = loadAllBauprojekt()[pair.id] || {};
  const col = getMassnahmeColor(bpData);
  const massLabel = getMassnahmeLabel(bpData);
  const lat = ll.lat.toFixed(6), lng = ll.lng.toFixed(6);
  const E = pair.rs?.e || '', N = pair.rs?.n || '';
  const linkGeoAdmin   = `https://map.geo.admin.ch/#/map?lang=de&center=${E},${N}&z=17&bgLayer=ch.swisstopo.swissimage&crosshair=marker`;
  const linkGoogleMaps = `https://www.google.com/maps?q=${lat},${lng}`;
  const linkStreetView = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
  return `<div class="map-popup" style="min-width:210px;">
    <div class="map-popup-header" style="background:${col};">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      Mast ${pair.mast || '?'} &ndash; ${massLabel}
    </div>
    <div class="map-popup-body">
      <div class="map-popup-row"><span class="map-popup-label">LV95 E</span><span class="map-popup-val">${E}</span></div>
      <div class="map-popup-row"><span class="map-popup-label">LV95 N</span><span class="map-popup-val">${N}</span></div>
      ${bpData.fundtyp ? `<div class="map-popup-row"><span class="map-popup-label">Typ</span><span class="map-popup-val">${bpData.fundtyp}</span></div>` : ''}
    </div>
    <div class="map-popup-links">
      <a class="map-popup-link" href="${linkGeoAdmin}" target="_blank">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
        geo.admin
      </a>
      <a class="map-popup-link" href="${linkGoogleMaps}" target="_blank">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Google Maps
      </a>
      <a class="map-popup-link" href="${linkStreetView}" target="_blank">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/></svg>
        Street View
      </a>
    </div>
  </div>`;
}

function addGhostMarkers(currentPair) {
  // Vorhandene Ghost-Marker entfernen
  ghostMarkers.forEach(m => m.remove());
  ghostMarkers = [];
  if (!leafletMap) return;

  // Nur Nachbarn derselben Objektart anzeigen
  const currentObjType = currentPair._objType || (_activePhase === 'baugrund' ? 'sondage' : 'fundament');
  const phasePairs = currentObjType === 'installation'
    ? getInstallationen()
    : (currentObjType === 'sondage' ? getSondagen() : getFundamente());
  const idx = phasePairs.findIndex(p => p.id === currentPair.id);
  // ±3 Nachbarn anzeigen
  const neighbors = [];
  for (let d = -3; d <= 3; d++) {
    if (d === 0) continue;
    const nb = phasePairs[idx + d];
    if (nb) neighbors.push(nb);
  }

  const isAF = _activePhase === 'ausfuehrung';

  neighbors.forEach(nb => {
    const bez = nb.bezeichnung || nb.mast || `F${nb.id}`;
    const km  = (nb.km_rs || 0).toFixed ? (nb.km_rs || 0).toFixed(3) : '—';

    const mkGhost = (ll) => {
      const icon = L.divIcon({
        html: `<div style="
          width:28px;height:28px;border-radius:50%;
          background:rgba(255,255,255,0.55);
          border:1.5px solid rgba(100,116,139,0.45);
          display:flex;align-items:center;justify-content:center;
          font-size:8px;font-weight:700;color:rgba(71,85,105,0.65);
          backdrop-filter:blur(1px);
          box-shadow:0 1px 3px rgba(0,0,0,0.12);
          cursor:pointer;
        "></div>`,
        iconSize: [28, 28], iconAnchor: [14, 14], className: ''
      });
      return L.marker([ll.lat, ll.lng], { icon, zIndexOffset: -100, interactive: true })
        .addTo(leafletMap)
        .bindTooltip(`${bez} · KM ${km}`, { direction:'top', offset:[0,-14], opacity:0.85 })
        .on('click', () => showDetail(nb.id));
    };

    if (isAF) {
      // AF-Phase: Ghost-Marker nur am Fundamentstandort (fund), nicht an Sondagenkoordinaten
      const fundLL = nb.fund?.e && nb.fund?.n
        ? lv95ToWgs84(nb.fund.e, nb.fund.n)
        : (nb.rs?.e && nb.rs?.n ? lv95ToWgs84(nb.rs.e, nb.rs.n) : null);
      if (fundLL) ghostMarkers.push(mkGhost(fundLL));
    } else {
      // Baugrund / Bauprojekt: Ghost-Marker an RS-Koordinaten (Fallback: fund)
      const _rsE = nb.rs?.e || nb.fund?.e;
      const _rsN = nb.rs?.n || nb.fund?.n;
      if (_rsE && _rsN) ghostMarkers.push(mkGhost(lv95ToWgs84(_rsE, _rsN)));
      if (nb.rks?.e && nb.rks?.n) ghostMarkers.push(mkGhost(lv95ToWgs84(nb.rks.e, nb.rks.n)));
    }
  });
}

function addMarkers(pair) {
  if (rsMarker)  rsMarker.remove();
  if (rksMarker) rksMarker.remove();
  if (window.bsMarker) { window.bsMarker.remove(); window.bsMarker = null; }

  // Installation: eigener quadratischer Marker, dann fertig
  if (pair._objType === 'installation') {
    if (!pair.rs?.e || !pair.rs?.n) return;
    const ll = lv95ToWgs84(pair.rs.e, pair.rs.n);
    const typLabel = INST_TYP_LABELS[pair.installTyp] || pair.installTyp || '?';
    const fStr = pair.flaeche ? `${pair.flaeche} m²` : (pair.flaecheL && pair.flaecheB ? `${pair.flaecheL}×${pair.flaecheB} m` : '—');
    const instIcon = L.divIcon({
      html: `<div style="background:#0891b2;color:white;border-radius:4px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">I</div>`,
      iconSize: [32, 32], iconAnchor: [16, 16], className: ''
    });
    rsMarker = L.marker([ll.lat, ll.lng], { icon: instIcon, draggable: false })
      .addTo(leafletMap)
      .bindPopup(`<b>${pair.bezeichnung || 'Installation'}</b><br>${typLabel} · ${fStr}`);
    if (leafletMap) leafletMap.setView([ll.lat, ll.lng], leafletMap.getZoom() || 16);
    return;
  }

  const isBP = _activePhase === 'bauprojekt';
  const isAF = _activePhase === 'ausfuehrung';
  const rsAktiv  = !!(pair.rs?.e  && pair.rs?.n);
  const rksAktiv = !!(pair.rks?.e && pair.rks?.n);
  // Für BP: pair.fund als Fallback wenn pair.rs fehlt (z.B. via Modal gespeicherte Importpaare)
  const _fundFallback = isBP && !rsAktiv && !!(pair.fund?.e && pair.fund?.n);

  // Label: Bauprojekt → Mastnummer, Baugrund → RS/RKS/BS
  const rsLabel  = isBP ? (pair.mast || 'F') : 'RS';
  const rksLabel = isBP ? (pair.mast || 'F') : 'RKS';

  const rsLL  = rsAktiv        ? lv95ToWgs84(pair.rs.e,   pair.rs.n)
              : _fundFallback  ? lv95ToWgs84(pair.fund.e, pair.fund.n) : null;
  const rksLL = rksAktiv ? lv95ToWgs84(pair.rks.e, pair.rks.n) : null;

  const OFFSET = 44;

  // Alle vorhandenen Punkte sammeln
  const points = [];
  if ((rsAktiv || _fundFallback) && rsLL) points.push({ key:'rs',  ll: rsLL });
  if (rksAktiv && rksLL && !isBP) points.push({ key:'rks', ll: rksLL });
  if (!isBP && pair.bs?.e && pair.bs?.n) points.push({ key:'bs', ll: lv95ToWgs84(pair.bs.e, pair.bs.n) });

  // Hinweis "Kein Standort" anzeigen wenn keine Koordinaten vorhanden
  const _hint = document.getElementById('map-no-coords-hint');
  if (_hint) _hint.style.display = points.length ? 'none' : 'flex';

  // Centroid berechnen
  let cx = 0, cy = 0;
  if (leafletMap && points.length > 0) {
    const pxs = points.map(p => leafletMap.latLngToContainerPoint(L.latLng(p.ll.lat, p.ll.lng)));
    pxs.forEach(p => { cx += p.x; cy += p.y; });
    cx /= pxs.length; cy /= pxs.length;

    // Winkel jedes Punktes zum Centroid berechnen, Label radial nach aussen verschieben
    points.forEach((p, i) => {
      const px = pxs[i];
      let angle = Math.atan2(px.y - cy, px.x - cx);
      // Falls alle Punkte fast gleich → gleichmässig verteilen
      if (pxs.every(q => Math.hypot(q.x - cx, q.y - cy) < 5)) {
        angle = (2 * Math.PI * i / points.length) - Math.PI / 2;
      }
      p.dx = Math.round(Math.cos(angle) * OFFSET);
      p.dy = Math.round(Math.sin(angle) * OFFSET);
    });
  } else {
    // Fallback ohne Karte
    points.forEach((p, i) => {
      const angle = (2 * Math.PI * i / Math.max(points.length, 1)) - Math.PI / 2;
      p.dx = Math.round(Math.cos(angle) * OFFSET);
      p.dy = Math.round(Math.sin(angle) * OFFSET);
    });
  }

  const rsOff  = points.find(p => p.key === 'rs')  || { dx: -OFFSET, dy: -OFFSET };
  const rksOff = points.find(p => p.key === 'rks') || { dx:  OFFSET, dy: -OFFSET };
  const bsOff  = points.find(p => p.key === 'bs')  || { dx:  0,      dy:  OFFSET };

  const lockSvg = (cx, cy, open, color) => {
    const lx = cx, ly = cy + 4;
    return open
      ? `<rect x="${lx-4}" y="${ly}" width="8" height="5.5" rx="1" fill="none" stroke="${color}" stroke-width="1.3"/>
         <path d="M${lx-2.5},${ly} v-2.5 a2.5,2.5 0 0,1 5,0" fill="none" stroke="${color}" stroke-width="1.3" stroke-linecap="round" opacity="0.4"/>`
      : `<rect x="${lx-4}" y="${ly}" width="8" height="5.5" rx="1" fill="none" stroke="${color}" stroke-width="1.3"/>
         <path d="M${lx-2.5},${ly} v-2.5 a2.5,2.5 0 0,1 5,0 v2.5" fill="none" stroke="${color}" stroke-width="1.3" stroke-linecap="round"/>`;
  };

  const mkLeaderIcon = (label, bg, unlocked=false, dx=0, dy=0) => {
    const r = 18;
    const svgW = Math.abs(dx) + r*2 + 6;
    const svgH = Math.abs(dy) + r*2 + 6;
    const ax = dx < 0 ? svgW - 3 : 3;
    const ay = dy < 0 ? svgH - 3 : 3;
    const cx = dx < 0 ? r + 3 : svgW - r - 3;
    const cy = dy < 0 ? r + 3 : svgH - r - 3;
    const ring = unlocked ? '#b45309' : bg;
    return L.divIcon({
      html: `<div style="position:relative;">
        <svg width="${svgW}" height="${svgH}" style="position:absolute;top:0;left:0;overflow:visible;">
          <circle cx="${ax}" cy="${ay}" r="4" fill="white" stroke="${bg}" stroke-width="2"/>
          <line x1="${ax}" y1="${ay}" x2="${cx}" y2="${cy}" stroke="white" stroke-width="4" opacity="0.7" stroke-linecap="round"/>
          <line x1="${ax}" y1="${ay}" x2="${cx}" y2="${cy}" stroke="${bg}" stroke-width="2" stroke-dasharray="5,3" stroke-linecap="round"/>
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="white" stroke="${ring}" stroke-width="2.5"/>
          <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="${bg}" font-size="9" font-weight="800">${label}</text>
        </svg>
      </div>`,
      iconSize: [svgW, svgH],
      iconAnchor: [ax, ay],
      className: ''
    });
  };

  const mkBsLeaderIcon = (dx=0, dy=0) => {
    const r = 18; const bg = '#b45309';
    const svgW = Math.abs(dx) + r*2 + 6;
    const svgH = Math.abs(dy) + r*2 + 6;
    const ax = dx < 0 ? svgW - 3 : 3;
    const ay = dy < 0 ? svgH - 3 : 3;
    const cx = dx < 0 ? r + 3 : svgW - r - 3;
    const cy = dy < 0 ? r + 3 : svgH - r - 3;
    return L.divIcon({
      html: `<div style="position:relative;">
        <svg width="${svgW}" height="${svgH}" style="position:absolute;top:0;left:0;overflow:visible;">
          <rect cx="${ax}" cy="${ay}" x="${ax-4}" y="${ay-4}" width="8" height="8" rx="2" fill="white" stroke="${bg}" stroke-width="2"/>
          <line x1="${ax}" y1="${ay}" x2="${cx}" y2="${cy}" stroke="white" stroke-width="4" opacity="0.7" stroke-linecap="round"/>
          <line x1="${ax}" y1="${ay}" x2="${cx}" y2="${cy}" stroke="${bg}" stroke-width="2" stroke-dasharray="5,3" stroke-linecap="round"/>
          <rect x="${cx-r}" y="${cy-r}" width="${r*2}" height="${r*2}" rx="5" fill="white" stroke="${bg}" stroke-width="2.5"/>
          <text x="${cx}" y="${cy-4}" text-anchor="middle" dominant-baseline="middle" fill="${bg}" font-size="9" font-weight="800">BS</text>
        </svg>
      </div>`,
      iconSize: [svgW, svgH],
      iconAnchor: [ax, ay],
      className: ''
    });
  };

  // Ausführungsphase: Marker NACH mkLeaderIcon setzen (const-Deklaration muss zuerst ausgewertet sein)
  if (isAF) {
    const fundLL = pair.fund?.e && pair.fund?.n ? lv95ToWgs84(pair.fund.e, pair.fund.n)
                 : (rsAktiv ? lv95ToWgs84(pair.rs.e, pair.rs.n) : null);
    if (!fundLL) return;
    const bpData = loadAllBauprojekt()[pair.id] || {};
    const col    = getMassnahmeColor(bpData);
    rsMarker = L.marker([fundLL.lat, fundLL.lng], {
      icon: mkLeaderIcon(pair.mast || '?', col, false, 0, -44),
      zIndexOffset: 100, draggable: false
    }).addTo(leafletMap)
      .bindPopup(() => mkFundPopupHtml(pair, fundLL), { maxWidth: 300 });
    leafletMap.setView([fundLL.lat, fundLL.lng], leafletMap.getZoom());
    addGhostMarkers(pair);
    return;
  }

  if (rsAktiv || _fundFallback) {
    // In Bauprojektphase: Massnahme-Farbe + vereinfachtes Popup (kein Entsperren-Button)
    const rsMarkerColor = isBP ? getMassnahmeColor(loadAllBauprojekt()[pair.id] || {}) : '#2b6cb0';
    rsMarker = L.marker([rsLL.lat, rsLL.lng], {
      icon: mkLeaderIcon(rsLabel, rsMarkerColor, false, rsOff.dx, rsOff.dy),
      zIndexOffset:100, draggable:false
    }).addTo(leafletMap)
      .bindPopup(() => isBP
        ? mkFundPopupHtml(pair, rsLL)
        : mkMarkerPopupHtml(rsLabel, pair.rs?.e, pair.rs?.n, rsLL, pair.id),
        { maxWidth: 300 });
    addLongPress(rsMarker, () => unlockMarker(rsMarker, 'RS'));
    rsMarker.on('dragstart', () => { if (pendingDrag) cancelDrag(); });
    rsMarker.on('dragend', () => {
      const _dragPair = PAIRS.find(x=>x.id===currentPairId);
      const origLL = lv95ToWgs84(_dragPair?.rs?.e ?? 0, _dragPair?.rs?.n ?? 0);
      const newLL  = rsMarker.getLatLng();
      const newLv  = wgs84ToLv95(newLL.lat, newLL.lng);
      pendingDrag = { type:'rs', marker: rsMarker, origLatLng: L.latLng(origLL.lat, origLL.lng), newLv };
      showDragConfirm('RS', newLv);
    });
  } else {
    rsMarker = null;
  }

  if (rksAktiv && !isBP) {
    rksMarker = L.marker([rksLL.lat, rksLL.lng], {
      icon: mkLeaderIcon(rksLabel,'#9d174d', false, rksOff.dx, rksOff.dy),
      zIndexOffset:100, draggable:false
    }).addTo(leafletMap)
      .bindPopup(() => mkMarkerPopupHtml(rksLabel, pair.rks?.e, pair.rks?.n, rksLL, pair.id), { maxWidth: 300 });
    addLongPress(rksMarker, () => unlockMarker(rksMarker, 'RKS'));
    rksMarker.on('dragstart', () => { if (pendingDrag) cancelDrag(); });
    rksMarker.on('dragend', () => {
      const _dragPair = PAIRS.find(x=>x.id===currentPairId);
      const origLL = lv95ToWgs84(_dragPair?.rks?.e ?? 0, _dragPair?.rks?.n ?? 0);
      const newLL  = rksMarker.getLatLng();
      const newLv  = wgs84ToLv95(newLL.lat, newLL.lng);
      pendingDrag = { type:'rks', marker: rksMarker, origLatLng: L.latLng(origLL.lat, origLL.lng), newLv };
      showDragConfirm('RKS', newLv);
    });
  } else {
    rksMarker = null;
  }

  // BS-Marker (optional, nur Baugrundphase)
  if (!isBP && pair.bs && pair.bs.e && pair.bs.n) {
    const bsLL = lv95ToWgs84(pair.bs.e, pair.bs.n);
    window.bsMarker = L.marker([bsLL.lat, bsLL.lng], {
      icon: mkBsLeaderIcon(bsOff.dx, bsOff.dy),
      zIndexOffset: 90, draggable: false
    }).addTo(leafletMap)
      .bindPopup(() => mkMarkerPopupHtml('BS', pair.bs.e, pair.bs.n, bsLL, pair.id), { maxWidth: 300 });
  }

  addGhostMarkers(pair);
}

// ============================================================
// MARKER ENTSPERREN (Lang drücken)
// ============================================================
function addLongPress(marker, callback) {
  let timer = null;
  const el = () => marker.getElement();
  const start = () => { timer = setTimeout(() => { callback(); timer = null; }, 700); };
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  marker.on('add', () => {
    if (!el()) return;
    el().addEventListener('touchstart', start, { passive: true });
    el().addEventListener('touchend', cancel);
    el().addEventListener('touchmove', cancel);
    el().addEventListener('mousedown', start);
    el().addEventListener('mouseup', cancel);
    el().addEventListener('mouseleave', cancel);
  });
}

function unlockMarker(marker, label) {
  marker.dragging.enable();
  marker.closePopup();
  const bg = label === 'RS' ? '#2b6cb0' : '#9d174d';
  const dx = label === 'RS' ? -40 : 40;
  const r = 18;
  const svgW = Math.abs(dx) + r*2 + 6, svgH = Math.abs(dx) + r*2 + 6;
  const ax = dx < 0 ? svgW - 3 : 3, ay = svgH - 3;
  const cx = dx < 0 ? r + 3 : svgW - r - 3, cy = r + 3;
  const lx = cx, ly = cy + 4;
  marker.setIcon(L.divIcon({
    html: `<div><svg width="${svgW}" height="${svgH}" style="overflow:visible;">
      <circle cx="${ax}" cy="${ay}" r="4" fill="white" stroke="${bg}" stroke-width="2"/>
      <line x1="${ax}" y1="${ay}" x2="${cx}" y2="${cy}" stroke="white" stroke-width="4" opacity="0.7" stroke-linecap="round"/>
      <line x1="${ax}" y1="${ay}" x2="${cx}" y2="${cy}" stroke="#b45309" stroke-width="2" stroke-dasharray="5,3" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="white" stroke="#b45309" stroke-width="2.5"/>
      <text x="${cx}" y="${cy-4}" text-anchor="middle" dominant-baseline="middle" fill="${bg}" font-size="9" font-weight="800">${label}</text>
      <rect x="${lx-4}" y="${ly}" width="8" height="5.5" rx="1" fill="none" stroke="#9ca3af" stroke-width="1.3"/>
      <path d="M${lx-2.5},${ly} v-2.5 a2.5,2.5 0 0,1 5,0" fill="none" stroke="#9ca3af" stroke-width="1.3" stroke-linecap="round" opacity="0.5"/>
    </svg></div>`,
    iconSize:[svgW,svgH], iconAnchor:[ax,ay], className:''
  }));
  marker.setPopupContent(`<b>${label}</b><br><span style="color:#92400e;font-weight:700;">Entsperrt — ziehen zum Verschieben</span><br>
    <button onclick="relockMarker('${label}')" style="margin-top:6px;width:100%;padding:5px;background:#fee2e2;border:1px solid #fca5a5;color:#b91c1c;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;">Wieder sperren</button>`);
  setTimeout(() => relockMarker(label), 15000);
}

function relockMarker(label) {
  const marker = label === 'RS' ? rsMarker : rksMarker;
  if (!marker) return;
  marker.dragging.disable();
  const bg = label === 'RS' ? '#2b6cb0' : '#9d174d';
  const dx = label === 'RS' ? -40 : 40;
  const r = 18;
  const svgW = Math.abs(dx) + r*2 + 6, svgH = Math.abs(dx) + r*2 + 6;
  const ax = dx < 0 ? svgW - 3 : 3, ay = svgH - 3;
  const cx = dx < 0 ? r + 3 : svgW - r - 3, cy = r + 3;
  const lx = cx, ly = cy + 4;
  marker.setIcon(L.divIcon({
    html: `<div><svg width="${svgW}" height="${svgH}" style="overflow:visible;">
      <circle cx="${ax}" cy="${ay}" r="4" fill="white" stroke="${bg}" stroke-width="2"/>
      <line x1="${ax}" y1="${ay}" x2="${cx}" y2="${cy}" stroke="white" stroke-width="4" opacity="0.7" stroke-linecap="round"/>
      <line x1="${ax}" y1="${ay}" x2="${cx}" y2="${cy}" stroke="${bg}" stroke-width="2" stroke-dasharray="5,3" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="white" stroke="${bg}" stroke-width="2.5"/>
      <text x="${cx}" y="${cy-4}" text-anchor="middle" dominant-baseline="middle" fill="${bg}" font-size="9" font-weight="800">${label}</text>
      <rect x="${lx-4}" y="${ly}" width="8" height="5.5" rx="1" fill="none" stroke="#9ca3af" stroke-width="1.3"/>
      <path d="M${lx-2.5},${ly} v-2.5 a2.5,2.5 0 0,1 5,0 v2.5" fill="none" stroke="#9ca3af" stroke-width="1.3" stroke-linecap="round"/>
    </svg></div>`,
    iconSize:[svgW,svgH], iconAnchor:[ax,ay], className:''
  }));
  marker.closePopup();
}

function unlockMarkerFromPopup(type) {
  const marker = type === 'rs' ? rsMarker : rksMarker;
  const label  = type === 'rs' ? 'RS' : 'RKS';
  if (marker) { marker.closePopup(); unlockMarker(marker, label); }
}



// Marker-Sperre beim Wechsel von Standort immer aktivieren
function lockMarkers() {
  markersLocked = true;
  if (rsMarker?.dragging)  rsMarker.dragging.disable();
  if (rksMarker?.dragging) rksMarker.dragging.disable();
}

function showDragConfirm(type, lv) {
  const bar = document.getElementById('drag-confirm-bar');
  document.getElementById('drag-confirm-label').textContent =
    `${type}: E ${lv.e} / N ${lv.n}`;
  bar.style.display = 'flex';
}

function confirmDrag() {
  if (!pendingDrag) return;
  const p = PAIRS.find(x => x.id === currentPairId);
  pushUndo();
  p[pendingDrag.type] = pendingDrag.newLv;
  savePairs();
  pendingDrag = null;
  document.getElementById('drag-confirm-bar').style.display = 'none';
  refreshSidebarCoords();
}

function cancelDrag() {
  if (!pendingDrag) return;
  pendingDrag.marker.setLatLng(pendingDrag.origLatLng);
  pendingDrag = null;
  document.getElementById('drag-confirm-bar').style.display = 'none';
}

async function resetToOriginalPos() {
  const p = PAIRS.find(x => x.id === currentPairId);
  const orig = DEFAULT_PAIRS.find(x => x.id === p.id);
  if (!orig) { ui.toast('Keine Originalposition für diesen Standort vorhanden.', 'fehler'); return; }
  if (!await ui.confirm('Position auf Originalkoordinaten aus dem Sondierkonzept zurücksetzen?')) return;
  pushUndo();
  if (pendingDrag) { pendingDrag = null; document.getElementById('drag-confirm-bar').style.display = 'none'; }
  p.rs  = { ...orig.rs  };
  p.rks = { ...orig.rks };
  savePairs();
  addMarkers(p);
  refreshSidebarCoords();
}

// Koordinaten in der Sidebar nach Drag/Reset aktualisieren (nutzt renderMetaSection)
function refreshSidebarCoords() {
  renderMetaSection(PAIRS.find(p => p.id === currentPairId));
}

function updateMapToCurrentPair() {
  if (!leafletMap) return;
  const pair = PAIRS.find(p => p.id === currentPairId);
  const center = pairCenter(pair);
  leafletMap.setView([center.lat, center.lng], 19);
  addMarkers(pair);
  loadSketchFromStorage();
  // Messlayer neu rendern nach Kartenupdate
  renderMeasureLayer();
}

// ============================================================
// GPS
// ============================================================
function toggleGPS() {
  const btn    = document.getElementById('btn-gps');
  const btnTop = document.getElementById('btn-gps-top');
  const btnAuto = document.getElementById('btn-gps-auto');
  const syncGpsBtn = (active) => {
    if (btn)    { btn.classList.toggle('active', active); btn.style.opacity = active ? '1' : '0.45'; }
    if (btnTop) btnTop.classList.toggle('aus', !active);
    if (btnAuto) btnAuto.style.display = active ? 'flex' : 'none';
  };
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId); watchId = null;
    gpsAutoStandortSetzen(false);
    if (gpsMarker)  { gpsMarker.remove();  gpsMarker  = null; }
    if (gpsCircle)  { gpsCircle.remove();  gpsCircle  = null; }
    if (btn) { btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> GPS'; }
    syncGpsBtn(false);
    document.getElementById('btn-gps-zoom').style.display = 'none';
    return;
  }
  if (!navigator.geolocation) { ui.toast('GPS wird von diesem Browser nicht unterstützt.', 'fehler'); return; }
  syncGpsBtn(false);
  if (btn) btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> GPS…';
  watchId = navigator.geolocation.watchPosition(
    pos => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      const gpsIcon = L.divIcon({
        html: '<div class="gps-dot"></div>', iconSize:[14,14], iconAnchor:[7,7], className:''
      });
      if (!gpsMarker) {
        gpsMarker = L.marker([lat,lng], { icon: gpsIcon, zIndexOffset:1000 }).addTo(leafletMap)
          .bindPopup(`Mein Standort<br>Genauigkeit: ±${Math.round(accuracy)} m`);
        gpsCircle = L.circle([lat,lng], { radius:accuracy, color:'#3b82f6', fillColor:'#3b82f6', fillOpacity:0.1, weight:1 }).addTo(leafletMap);
        leafletMap.panTo([lat,lng]);
      } else {
        gpsMarker.setLatLng([lat,lng]).setPopupContent(`Mein Standort<br>Genauigkeit: ±${Math.round(accuracy)} m`);
        gpsCircle.setLatLng([lat,lng]).setRadius(accuracy);
      }
      if (btn) btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> Aktiv';
      syncGpsBtn(true);
      document.getElementById('btn-gps-zoom').style.display = '';
      updateDistances(lat, lng);
      gpsAutoStandortAnwenden(lat, lng);
    },
    err => {
      if (btn) btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> GPS';
      watchId = null; syncGpsBtn(false);
      document.getElementById('btn-gps-zoom').style.display = 'none';
      let msg = 'GPS-Fehler: ';
      if (err.code === 1) {
        msg = "GPS-Zugriff verweigert. Bitte App ueber https:// oeffnen (z.B. GitHub Pages).\n\nNicht als lokale Datei oeffnen.";
      } else if (err.code === 2) {
        msg = "GPS-Position konnte nicht ermittelt werden. Bitte GPS aktivieren.";
      } else if (err.code === 3) {
        msg = "GPS-Zeitüberschreitung. Bitte erneut versuchen oder ins Freie gehen.";
      } else {
        msg = 'GPS-Fehler: ' + err.message;
      }
      btn.style.opacity = '0.45';
      ui.toast(msg, 'fehler');
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
}

function zoomToGPS() {
  if (gpsMarker && leafletMap) {
    leafletMap.setView(gpsMarker.getLatLng(), 18);
  }
}

// ── Automatische Standortwahl nach GPS ───────────────────────
// Auf der Baustelle geht man die Standorte der Reihe nach ab. Statt jedes Mal
// von Hand umzuschalten, uebernimmt dieser Schalter die Wahl: bei jeder neuen
// Position wird der naechstgelegene Standort geoeffnet.
let _gpsAutoStandort = false;
let _gpsAutoHighlight = null;

// Gewechselt wird erst, wenn der andere Standort deutlich naeher liegt.
// Ohne diesen Abstand springt die Ansicht zwischen zwei fast gleich weit
// entfernten Standorten hin und her, sobald das GPS um ein paar Meter wandert.
const GPS_AUTO_VORSPRUNG_M = 15;

function toggleGpsAutoStandort() {
  gpsAutoStandortSetzen(!_gpsAutoStandort);
  if (_gpsAutoStandort) {
    const p = gpsMarker?.getLatLng();
    if (p) gpsAutoStandortAnwenden(p.lat, p.lng);
    else ui.toast('Warte auf GPS-Position…');
  }
}

function gpsAutoStandortSetzen(an) {
  _gpsAutoStandort = !!an;
  const btn = document.getElementById('btn-gps-auto');
  if (btn) {
    btn.classList.toggle('an',  _gpsAutoStandort);
    btn.classList.toggle('aus', !_gpsAutoStandort);
  }
  if (!_gpsAutoStandort) standortHighlightEntfernen();
}

function gpsAutoStandortAnwenden(lat, lng) {
  if (!_gpsAutoStandort) return;
  // pairCenter liefert fuer Standorte ohne Koordinaten die Schweizmitte —
  // ein gueltiger Punkt, der die Auswahl verfaelschen wuerde. Deshalb wird
  // hier am Datensatz geprueft, nicht am berechneten Mittelpunkt.
  const kandidaten = PAIRS
    .filter(p => p.rs?.e || p.rks?.e || p.fund?.e)
    .map(p => ({ p, c: pairCenter(p) }))
    .filter(x => !x.c.invalid)
    .map(x => ({ id: x.p.id, dist: haversine(lat, lng, x.c.lat, x.c.lng) }))
    .sort((a, b) => a.dist - b.dist);
  if (!kandidaten.length) return;
  const naechster = kandidaten[0];
  if (naechster.id === currentPairId) { standortHighlightZeigen(currentPairId); return; }
  const aktuell = kandidaten.find(k => k.id === currentPairId);
  if (aktuell && aktuell.dist - naechster.dist < GPS_AUTO_VORSPRUNG_M) return;
  showDetail(naechster.id);
  standortHighlightZeigen(naechster.id);
  const pair = PAIRS.find(p => p.id === naechster.id);
  ui.toast(`Standort ${pair?.mast || naechster.id} · ${formatDist(naechster.dist)}`);
}

// Der gewaehlte Standort wird auf der Karte hervorgehoben — sonst ist bei
// dicht beieinanderliegenden Punkten nicht erkennbar, welcher gerade gilt.
function standortHighlightZeigen(pairId) {
  const pair = PAIRS.find(p => p.id === pairId);
  if (!pair || !leafletMap) return;
  if (!(pair.rs?.e || pair.rks?.e || pair.fund?.e)) return;
  const c = pairCenter(pair);
  if (c.invalid) return;
  standortHighlightEntfernen();
  _gpsAutoHighlight = L.circleMarker([c.lat, c.lng], {
    radius: 22, color: '#1a3a5c', weight: 3, opacity: 0.9,
    fillColor: '#1a3a5c', fillOpacity: 0.12, interactive: false,
  }).addTo(leafletMap);
}

function standortHighlightEntfernen() {
  if (_gpsAutoHighlight) { _gpsAutoHighlight.remove(); _gpsAutoHighlight = null; }
}

// ============================================================
// SKETCH CANVAS — Vektor-basiert (geografische Koordinaten)
// Striche werden als Lat/Lng gespeichert → zoom- und scrollfest
// ============================================================
let sketchInitialized = false;
let canvasDpr = 1; // Geräte-Pixelverhältnis für HiDPI-Schärfe
let _sketchResizeHandler = null;
let _sketchKeydownHandler = null;

function destroySketchListeners() {
  if (_sketchResizeHandler)  { window.removeEventListener('resize',  _sketchResizeHandler);  _sketchResizeHandler  = null; }
  if (_sketchKeydownHandler) { window.removeEventListener('keydown', _sketchKeydownHandler); _sketchKeydownHandler = null; }
  sketchInitialized = false;
}

function initSketchCanvas() {
  const canvas = document.getElementById('sketch-canvas');
  const container = document.querySelector('.map-container');
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvasDpr = dpr;
    const r = container.getBoundingClientRect();
    // Physische Auflösung = CSS-Grösse × DPR → gestochen scharf auf Retina
    canvas.width  = r.width  * dpr;
    canvas.height = r.height * dpr;
    canvas.style.width  = r.width  + 'px';
    canvas.style.height = r.height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    redrawSketch();
  }
  resize();
  if (!sketchInitialized) {
    sketchInitialized = true;
    _sketchResizeHandler = resize;
    window.addEventListener('resize', resize);
    // Freehand: Pointer Events (Maus + Touch + Stift, unified)
    canvas.addEventListener('pointerdown',   onPtrDown,  { passive: false });
    canvas.addEventListener('pointermove',   onPtrMove,  { passive: false });
    canvas.addEventListener('pointerup',     onPtrUp);
    canvas.addEventListener('pointercancel', onPtrUp);
    canvas.addEventListener('pointerleave',  onPtrLeave);
    // Zwei Finger: Karte verschieben und zoomen (siehe onSkizzeTouchStart)
    canvas.addEventListener('touchstart',  onSkizzeTouchStart, { passive: false });
    canvas.addEventListener('touchmove',   onSkizzeTouchMove,  { passive: false });
    canvas.addEventListener('touchend',    onSkizzeTouchEnd);
    canvas.addEventListener('touchcancel', onSkizzeTouchEnd);
    // Polylinie & Text: Klick / Doppelklick / Rechtsklick
    canvas.addEventListener('click',        onCanvasClick);
    canvas.addEventListener('dblclick',     onCanvasDblClick);
    canvas.addEventListener('contextmenu',  onCanvasRightClick);
    // Mausrad-Zoom: Event an Leaflet weiterleiten (auch im Zeichenmodus)
    canvas.addEventListener('wheel', e => {
      if (!isDrawMode || !leafletMap) return;
      e.preventDefault();
      leafletMap.getContainer().dispatchEvent(new WheelEvent('wheel', {
        deltaX: e.deltaX, deltaY: e.deltaY, deltaZ: e.deltaZ, deltaMode: e.deltaMode,
        clientX: e.clientX, clientY: e.clientY,
        ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey,
        bubbles: true, cancelable: true
      }));
    }, { passive: false });
    // ESC zum Abbrechen
    _sketchKeydownHandler = e => {
      if (e.key === 'Escape' && isDrawMode) {
        if (polyActive) cancelPolyline();
        if (currentTool === 'text') {
          document.getElementById('sketch-text-input').style.display = 'none';
          textInputPending = false;
        }
      }
    };
    window.addEventListener('keydown', _sketchKeydownHandler);
  }
  // Skizze bei Zoom und Pan neu zeichnen
  if (leafletMap) {
    leafletMap.off('zoom move', redrawSketch);
    leafletMap.on('zoom move', redrawSketch);
    // Canvas unter Popup senken wenn Popup offen
    const _canvas = document.getElementById('sketch-canvas');
    leafletMap.off('popupopen popupclose');
    leafletMap.on('popupopen',  () => _canvas.classList.add('popup-open'));
    leafletMap.on('popupclose', () => _canvas.classList.remove('popup-open'));
  }
}

function getCanvasPos(e) {
  const r = document.getElementById('sketch-canvas').getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// ── Zwei-Finger-Geste im Zeichenmodus ───────────────────────────────────────
// Der Skizzen-Canvas liegt über der Karte und fängt alle Berührungen ab. Der
// frühere Weg — beim zweiten Finger Leaflets dragging/touchZoom einschalten und
// die Ereignisse durchreichen — konnte nicht funktionieren: das Ziel einer
// Berührung steht beim touchstart fest, Leaflet bekam die Bewegungen nie zu
// sehen. Zoomen und Verschieben waren im Zeichenmodus damit tot.
//
// Jetzt wird die Geste selbst ausgewertet und die Karte direkt gesteuert —
// dasselbe Verhalten wie im Skizzenmodus der Begehung: ein Finger zeichnet,
// zwei Finger verschieben und zoomen.
let _skizzeGeste = null;      // { punkte:[{x,y},{x,y}], zoomSnapAlt }

function _skizzePaar(e) {
  return [0, 1].map(i => ({ x: e.touches[i].clientX, y: e.touches[i].clientY }));
}

function onSkizzeTouchStart(e) {
  if (!isDrawMode || !leafletMap || e.touches.length < 2) return;
  e.preventDefault();
  // Laufenden Strich verwerfen — die Geste gilt der Karte, nicht der Skizze
  isDrawing = false; currentStroke = null;
  redrawSketch();
  // Bruchteil-Zoom zulassen, sonst rastet jede Zwischenstufe auf ganze Stufen
  const alt = leafletMap.options.zoomSnap;
  leafletMap.options.zoomSnap = 0;
  _skizzeGeste = { punkte: _skizzePaar(e), zoomSnapAlt: alt };
}

function onSkizzeTouchMove(e) {
  if (!_skizzeGeste || e.touches.length < 2) return;
  e.preventDefault();
  const [a, b]       = _skizzeGeste.punkte;
  const [n0, n1]     = _skizzePaar(e);
  const abstandAlt   = Math.hypot(b.x - a.x, b.y - a.y);
  const abstandNeu   = Math.hypot(n1.x - n0.x, n1.y - n0.y);
  const mitteAlt     = { x: (a.x + b.x) / 2,   y: (a.y + b.y) / 2 };
  const mitteNeu     = { x: (n0.x + n1.x) / 2, y: (n0.y + n1.y) / 2 };

  // Verschieben: Karte folgt der Mitte zwischen den Fingern
  const dx = mitteNeu.x - mitteAlt.x, dy = mitteNeu.y - mitteAlt.y;
  if (dx || dy) leafletMap.panBy([-dx, -dy], { animate: false });

  // Zoomen um die Fingermitte
  if (abstandAlt > 0 && abstandNeu > 0) {
    const stufen = Math.log2(abstandNeu / abstandAlt);
    if (Math.abs(stufen) > 0.001) {
      const r  = leafletMap.getContainer().getBoundingClientRect();
      const pt = L.point(mitteNeu.x - r.left, mitteNeu.y - r.top);
      leafletMap.setZoomAround(leafletMap.containerPointToLatLng(pt),
                               leafletMap.getZoom() + stufen, { animate: false });
    }
  }
  _skizzeGeste.punkte = [n0, n1];
}

function onSkizzeTouchEnd(e) {
  if (!_skizzeGeste || (e.touches && e.touches.length >= 2)) return;
  if (leafletMap) leafletMap.options.zoomSnap = _skizzeGeste.zoomSnapAlt;
  _skizzeGeste = null;
  redrawSketch();
}

// ── Pointer-Event-Handler (Maus / Touch / Stift) ───────────────
function onPtrDown(e) {
  // Palm Rejection: Touch ignorieren wenn Stift aktiv
  if (e.pointerType === 'touch' && _activePenId !== null) return;
  if (e.pointerType === 'pen') _activePenId = e.pointerId;

  // Zweifinger-Touch: Karte schieben / zoomen statt zeichnen.
  // Die Geste selbst wertet onSkizzeTouchMove aus — hier nur den laufenden
  // Strich verwerfen und aus dem Weg gehen.
  if (e.pointerType === 'touch') {
    _activeTouchIds.add(e.pointerId);
    if (_activeTouchIds.size >= 2) {
      isDrawing = false; currentStroke = null;
      return;
    }
  }

  e.preventDefault();
  // Pointer-Capture: Events kommen weiter auch wenn Pointer den Canvas verlässt
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch(_) {}
  startDraw(e);
}

function onPtrMove(e) {
  if (e.pointerType === 'touch' && _activeTouchIds.size >= 2) return; // Karte wird geschoben
  if (e.pointerType === 'touch' && _activePenId !== null) return;     // Palm Rejection
  e.preventDefault();
  if (!isDrawing) { onCanvasMouseMove(e); return; }                   // Polylinie-Vorschau
  // Coalesced Events: alle Zwischenpunkte abrufen (glattere Stiftspur)
  const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
  for (const ce of events) draw(ce);
}

function onPtrUp(e) {
  if (e && e.pointerType === 'pen' && e.pointerId === _activePenId) _activePenId = null;
  if (e && e.pointerType === 'touch') _activeTouchIds.delete(e.pointerId);
  stopDraw();
}

function onPtrLeave(e) {
  if (e.pointerType === 'touch') _activeTouchIds.delete(e.pointerId);
  // Nur bei unkaptured Touch/Maus → Stift mit setPointerCapture bleibt aktiv
  if (e.pointerType !== 'pen') stopDraw();
}

function canvasPosToLatLng(pos) {
  // Pixel auf dem Canvas → geografische Koordinate via Leaflet
  return leafletMap.containerPointToLatLng(L.point(pos.x, pos.y));
}

function latLngToCanvasPos(latlng) {
  // Geografische Koordinate → Pixel auf dem Canvas
  return leafletMap.latLngToContainerPoint(latlng);
}

function startDraw(e) {
  if (!isDrawMode || !leafletMap) return;
  if (currentTool === 'poly' || currentTool === 'polygon') return; // eigene Handler
  if (currentTool === 'text') {
    // Mousedown auf vorhandenem Text → Drag starten
    const pos = getCanvasPos(e);
    const idx = findTextStrokeAt(pos);
    if (idx >= 0) {
      const tp = latLngToCanvasPos(L.latLng(sketchStrokes[idx].pos.lat, sketchStrokes[idx].pos.lng));
      draggingTextIdx = idx;
      dragTextOffsetX = pos.x - tp.x;
      dragTextOffsetY = pos.y - tp.y;
      textDragMoved = false;
    }
    return;
  }
  isDrawing = true;
  const pos = getCanvasPos(e);
  lastX = pos.x; lastY = pos.y;
  lastMidX = pos.x; lastMidY = pos.y;
  _sX = pos.x; _sY = pos.y; // EMA-Startwert
  const latlng = canvasPosToLatLng(pos);
  currentStroke = {
    color: currentTool === 'eraser' ? null : currentColor,
    size: brushSize,
    tool: currentTool,
    points: [{ lat: latlng.lat, lng: latlng.lng }]
  };
}

function draw(e) {
  if (!isDrawMode || !isDrawing || !currentStroke || !leafletMap) return;

  const raw = getCanvasPos(e);
  const isPen = e.pointerType === 'pen';

  // EMA-Glättung für Maus/Touch (Stift braucht das nicht — Coalesced Events)
  let x, y;
  if (isPen) {
    x = raw.x; y = raw.y;
  } else {
    _sX += (raw.x - _sX) * DRAW_SMOOTH;
    _sY += (raw.y - _sY) * DRAW_SMOOTH;
    x = _sX; y = _sY;
  }

  // Mindestabstand: zu nahe Punkte überspringen
  const dx = x - lastX, dy = y - lastY;
  if (dx * dx + dy * dy < 4) return;

  const canvas = document.getElementById('sketch-canvas');
  const ctx = canvas.getContext('2d');
  const latlng = canvasPosToLatLng({ x, y });

  // Druckstärke: minimaler Einfluss (90–110% der Basisstärke)
  const pressure = isPen ? (e.pressure > 0 ? e.pressure : 0.5) : null;
  currentStroke.points.push(pressure !== null
    ? { lat: latlng.lat, lng: latlng.lng, p: pressure }
    : { lat: latlng.lat, lng: latlng.lng });

  const lineWidth = currentTool === 'eraser'
    ? brushSize * 4
    : isPen ? brushSize * (0.9 + pressure * 0.2) : brushSize;

  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = lineWidth;

  if (currentTool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke();
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = currentColor;

    if (isPen) {
      // Stift: direkte Linie (Coalesced Events liefern dichte Punkte)
      ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke();
    } else {
      // Maus / Touch: Mittelpunkt-Bézier (live, schnell)
      const midX = (lastX + x) / 2;
      const midY = (lastY + y) / 2;
      ctx.beginPath();
      ctx.moveTo(lastMidX, lastMidY);
      ctx.quadraticCurveTo(lastX, lastY, midX, midY);
      ctx.stroke();
      lastMidX = midX; lastMidY = midY;
    }
  }

  lastX = x; lastY = y;
}

function stopDraw() {
  // Text-Drag beenden
  if (draggingTextIdx >= 0) {
    draggingTextIdx = -1;
    if (textDragMoved) saveSketchToStorage();
    // textDragMoved bleibt gesetzt bis onCanvasClick es ausliest
    return;
  }
  if (!isDrawing) return;
  isDrawing = false;
  if (currentStroke && currentStroke.points.length > 1) {
    if (currentStroke.tool === 'eraser') {
      // Radierer: entferne Striche die in der Nähe liegen
      applyEraser(currentStroke);
    } else {
      sketchStrokes.push(currentStroke);
    }
    currentStroke = null;
    redrawSketch();
    saveSketchToStorage();
  } else {
    currentStroke = null;
  }
}

function applyEraser(eraserStroke) {
  if (!leafletMap || typeof L === 'undefined') return;
  const threshold = eraserStroke.size * 4;
  const eraserPts = eraserStroke.points.map(ep => latLngToCanvasPos(L.latLng(ep.lat, ep.lng)));
  const nearEraser = (cx, cy) => eraserPts.some(ep => {
    const dx = cx - ep.x, dy = cy - ep.y;
    return Math.sqrt(dx*dx + dy*dy) < threshold;
  });
  // Ray-Casting: Punkt innerhalb eines Polygons?
  const ptInPoly = (px, py, pts) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      if (((yi > py) !== (yj > py)) && px < (xj - xi) * (py - yi) / (yj - yi) + xi)
        inside = !inside;
    }
    return inside;
  };
  sketchStrokes = sketchStrokes.filter(stroke => {
    if (stroke.tool === 'text') {
      const pos = latLngToCanvasPos(L.latLng(stroke.pos.lat, stroke.pos.lng));
      return !nearEraser(pos.x, pos.y);
    }
    if (stroke.tool === 'polygon') {
      const pts = stroke.points.map(p => latLngToCanvasPos(L.latLng(p.lat, p.lng)));
      // Kante berührt oder Radierer-Punkt innerhalb der Fläche → löschen
      const edgeHit = pts.some(p => nearEraser(p.x, p.y));
      const interior = eraserPts.some(ep => ptInPoly(ep.x, ep.y, pts));
      return !edgeHit && !interior;
    }
    return !stroke.points.some(sp => {
      const sPos = latLngToCanvasPos(L.latLng(sp.lat, sp.lng));
      return nearEraser(sPos.x, sPos.y);
    });
  });
}

// ============================================================
// POLYLINIE-TOOL
// ============================================================
let polyActive    = false;
let polyPoints    = [];      // [{lat,lng}] — gesetzte Eckpunkte
let polyPreviewPos = null;   // Mauszeiger-Position (Canvas px)

// ============================================================
// TEXT-TOOL  — Neu platzieren, Verschieben, Bearbeiten
// ============================================================
let textInputPending  = false;
let textInputLatlng   = null;
let draggingTextIdx   = -1;   // Index des gerade gezogenen Textes
let dragTextOffsetX   = 0, dragTextOffsetY = 0;
let textDragMoved     = false; // Unterscheidet Drag von Click
let editingTextBackup = null;  // Backup beim Bearbeiten (für ESC)
let editingTextIdx    = -1;    // ≥0 → Bearbeitung (nicht Neu)

// Gibt den Index des obersten Text-Strokes an der Canvas-Position zurück (-1 wenn keiner)
function findTextStrokeAt(pos) {
  const canvas = document.getElementById('sketch-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  for (let i = sketchStrokes.length - 1; i >= 0; i--) {
    const s = sketchStrokes[i];
    if (s.tool !== 'text') continue;
    const tp = latLngToCanvasPos(L.latLng(s.pos.lat, s.pos.lng));
    // Breite via measureText falls Canvas verfügbar, sonst Schätzung
    const w = ctx ? ctx.measureText(s.text).width : s.text.length * s.size * 0.6;
    if (pos.x >= tp.x - 6 && pos.x <= tp.x + w + 6 &&
        pos.y >= tp.y - s.size - 4 && pos.y <= tp.y + 8) {
      return i;
    }
  }
  return -1;
}

function onCanvasClick(e) {
  if (!isDrawMode || !leafletMap) return;
  if (currentTool === 'eraser') {
    // Single tap: delete the stroke/text nearest to tap point
    const pos = getCanvasPos(e);
    const threshold = brushSize * 6 + 20;
    const before = sketchStrokes.length;
    sketchStrokes = sketchStrokes.filter(stroke => {
      if (stroke.tool === 'text') {
        const p = latLngToCanvasPos(L.latLng(stroke.pos.lat, stroke.pos.lng));
        const dx = pos.x - p.x, dy = pos.y - p.y;
        return Math.sqrt(dx*dx + dy*dy) > threshold;
      }
      return !stroke.points.some(sp => {
        const p = latLngToCanvasPos(L.latLng(sp.lat, sp.lng));
        const dx = pos.x - p.x, dy = pos.y - p.y;
        return Math.sqrt(dx*dx + dy*dy) < threshold;
      });
    });
    if (sketchStrokes.length !== before) { redrawSketch(); saveSketchToStorage(); }
    return;
  }
  if (currentTool === 'poly' || currentTool === 'polygon') {
    const pos = getCanvasPos(e);
    polyPoints.push({ ...canvasPosToLatLng(pos) });
    polyActive = true;
    redrawSketch(); drawPolyPreview();
  } else if (currentTool === 'text') {
    const wasDrag = textDragMoved;
    textDragMoved = false;
    if (wasDrag) return;
    if (findTextStrokeAt(getCanvasPos(e)) >= 0) return;
    openTextInput(e);
  }
}

function onCanvasRightClick(e) {
  if (!isDrawMode) return;
  e.preventDefault();
  if (polyActive) {
    if (currentTool === 'poly')     commitPolyline();
    if (currentTool === 'polygon')  commitPolygon();
  }
}

function onCanvasDblClick(e) {
  if (!isDrawMode) return;
  if (currentTool === 'text') {
    const idx = findTextStrokeAt(getCanvasPos(e));
    if (idx >= 0) startEditText(idx);
  }
  if (currentTool === 'poly'    && polyActive) commitPolyline();
  if (currentTool === 'polygon' && polyActive) commitPolygon();
}

function onCanvasMouseMove(e) {
  if (!isDrawMode) return;
  const canvas = document.getElementById('sketch-canvas');
  const pos = getCanvasPos(e);

  if (currentTool === 'text') {
    if (draggingTextIdx >= 0) {
      // Text verschieben
      const newLL = canvasPosToLatLng({ x: pos.x - dragTextOffsetX, y: pos.y - dragTextOffsetY });
      sketchStrokes[draggingTextIdx].pos = { lat: newLL.lat, lng: newLL.lng };
      textDragMoved = true;
      redrawSketch();
    } else {
      // Cursor-Feedback: Zeigefinger über Text, Fadenkreuz sonst
      canvas.style.cursor = findTextStrokeAt(pos) >= 0 ? 'move' : 'crosshair';
    }
    return;
  }

  if ((currentTool === 'poly' || currentTool === 'polygon') && polyActive) {
    polyPreviewPos = pos;
    redrawSketch(); drawPolyPreview();
  }
}

function drawPolyPreview() {
  if (!polyActive || !polyPoints.length) return;
  const canvas = document.getElementById('sketch-canvas');
  const ctx = canvas.getContext('2d');

  ctx.save();
  ctx.strokeStyle = currentColor;
  ctx.lineWidth   = brushSize;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  // Bereits gesetzte Segmente — durchgezogene Linie
  if (polyPoints.length >= 2) {
    ctx.setLineDash([]);
    ctx.beginPath();
    polyPoints.forEach((pt, i) => {
      const p = latLngToCanvasPos(L.latLng(pt.lat, pt.lng));
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }

  const isPolygonTool = currentTool === 'polygon';

  // Gestrichelte Vorschaulinie vom letzten Punkt zum Mauszeiger
  if (polyPreviewPos) {
    const last = polyPoints[polyPoints.length - 1];
    const lp = latLngToCanvasPos(L.latLng(last.lat, last.lng));
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(lp.x, lp.y);
    ctx.lineTo(polyPreviewPos.x, polyPreviewPos.y);
    ctx.stroke();

    // Polygon: gestrichelte Schliess-Linie vom Mauszeiger zurück zum ersten Punkt
    if (isPolygonTool && polyPoints.length >= 2) {
      const first = polyPoints[0];
      const fp = latLngToCanvasPos(L.latLng(first.lat, first.lng));
      ctx.setLineDash([4, 6]);
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(polyPreviewPos.x, polyPreviewPos.y);
      ctx.lineTo(fp.x, fp.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // Tooltip am Mauszeiger (ab 1 gesetztem Punkt)
  if (polyPreviewPos && polyPoints.length >= 1) {
    ctx.setLineDash([]);
    ctx.font = 'bold 11px Segoe UI, sans-serif';
    const minPts = isPolygonTool ? 3 : 2;
    const hint = polyPoints.length >= minPts
      ? 'Rechtsklick = Schliessen · ESC = Abbrechen'
      : 'Klick = Punkt setzen · ESC = Abbrechen';
    const tw = ctx.measureText(hint).width;
    const tx = Math.min(polyPreviewPos.x - tw/2 - 6, canvas.width / canvasDpr - tw - 16);
    ctx.fillStyle = 'rgba(26,58,92,0.85)';
    ctx.fillRect(tx, polyPreviewPos.y - 28, tw + 12, 20);
    ctx.fillStyle = 'white';
    ctx.fillText(hint, tx + 6, polyPreviewPos.y - 14);
  }

  ctx.restore();
}

function commitPolyline() {
  if (!polyActive || polyPoints.length < 2) { cancelPolyline(); return; }
  sketchStrokes.push({ tool:'poly', color:currentColor, size:brushSize, points:[...polyPoints] });
  polyActive = false; polyPoints = []; polyPreviewPos = null;
  redrawSketch(); saveSketchToStorage();
}

function commitPolygon() {
  if (!polyActive || polyPoints.length < 3) { cancelPolyline(); return; }
  sketchStrokes.push({ tool:'polygon', color:currentColor, size:brushSize, points:[...polyPoints] });
  polyActive = false; polyPoints = []; polyPreviewPos = null;
  redrawSketch(); saveSketchToStorage();
}

function cancelPolyline() {
  polyActive = false; polyPoints = []; polyPreviewPos = null;
  redrawSketch();
}

// --- Text: Neu platzieren ---
function openTextInput(e) {
  const pos = getCanvasPos(e);
  textInputLatlng = canvasPosToLatLng(pos);
  textInputPending = true;
  editingTextIdx = -1; editingTextBackup = null;
  showTextInputAt(pos, '', currentColor, fontSizeFromBrush());
}

function fontSizeFromBrush() {
  return brushSize <= 3 ? 14 : brushSize <= 6 ? 18 : brushSize <= 10 ? 24 : 32;
}

function showTextInputAt(canvasPos, value, color, fontSize) {
  const input = document.getElementById('sketch-text-input');
  input.style.color = color;
  input.style.fontSize = fontSize + 'px';
  input.style.left = Math.min(canvasPos.x + 4, window.innerWidth - 300) + 'px';
  input.style.top  = (canvasPos.y - fontSize - 8) + 'px';
  input.value = value;
  input.style.display = 'block';
  setTimeout(() => { input.focus(); if (value) input.select(); }, 0);
}

// --- Text: Bearbeiten (Doppelklick) ---
function startEditText(idx) {
  const s = sketchStrokes[idx];
  editingTextIdx    = idx;
  editingTextBackup = { ...s, pos: { ...s.pos } };
  textInputLatlng   = { ...s.pos };
  textInputPending  = true;
  // Stroke temporär entfernen (wird bei commitText neu eingefügt)
  sketchStrokes.splice(idx, 1);
  redrawSketch();
  const tp = latLngToCanvasPos(L.latLng(s.pos.lat, s.pos.lng));
  showTextInputAt(tp, s.text, s.color, s.size);
}

function onTextInputKey(e) {
  if (e.key === 'Enter')  { e.preventDefault(); commitText(); }
  if (e.key === 'Escape') { e.preventDefault(); cancelTextInput(); }
}

function cancelTextInput() {
  document.getElementById('sketch-text-input').style.display = 'none';
  textInputPending = false;
  // Bei Bearbeitung: Original wiederherstellen
  if (editingTextBackup) {
    sketchStrokes.splice(editingTextIdx, 0, editingTextBackup);
    redrawSketch();
  }
  editingTextIdx = -1; editingTextBackup = null;
}

function commitText() {
  if (!textInputPending) return; // Verhindert Doppelaufruf durch blur nach ESC
  const input = document.getElementById('sketch-text-input');
  const text = input.value.trim();
  input.style.display = 'none';
  textInputPending = false;
  if (!text || !textInputLatlng) { cancelTextInput(); return; }
  // Bei Bearbeitung: Farbe + Grösse des Originals beibehalten
  const color    = editingTextBackup ? editingTextBackup.color : currentColor;
  const fontSize = editingTextBackup ? editingTextBackup.size  : fontSizeFromBrush();
  sketchStrokes.push({
    tool: 'text', color, size: fontSize,
    pos: { lat: textInputLatlng.lat, lng: textInputLatlng.lng },
    text
  });
  editingTextIdx = -1; editingTextBackup = null; textInputLatlng = null;
  redrawSketch(); saveSketchToStorage();
}

function redrawSketch() {
  // Alle Striche anhand aktueller Kartenposition neu auf Canvas zeichnen
  const canvas = document.getElementById('sketch-canvas');
  if (!canvas || !leafletMap || typeof L === 'undefined') return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width / canvasDpr, canvas.height / canvasDpr);

  sketchStrokes.forEach(stroke => {
    ctx.globalCompositeOperation = 'source-over';

    // Textbeschriftung
    if (stroke.tool === 'text') {
      const pos = latLngToCanvasPos(L.latLng(stroke.pos.lat, stroke.pos.lng));
      ctx.save();
      ctx.font = `bold ${stroke.size}px 'Segoe UI', sans-serif`;
      ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'white';  ctx.strokeText(stroke.text, pos.x, pos.y);
      ctx.fillStyle = stroke.color; ctx.fillText(stroke.text, pos.x, pos.y);
      ctx.restore();
      return;
    }

    // Linien-Striche (Freehand & Polylinie)
    if (!stroke.points || stroke.points.length < 2) return;
    ctx.strokeStyle = stroke.color;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash([]);

    const hasPressure = stroke.points.some(pt => pt.p !== undefined);
    const pts = stroke.points.map(pt => latLngToCanvasPos(L.latLng(pt.lat, pt.lng)));

    if (hasPressure) {
      // Stift: minimaler Druckeinfluss (90–110%)
      for (let i = 1; i < stroke.points.length; i++) {
        const prs = ((stroke.points[i-1].p ?? 0.5) + (stroke.points[i].p ?? 0.5)) / 2;
        ctx.lineWidth = stroke.size * (0.9 + prs * 0.2);
        ctx.beginPath(); ctx.moveTo(pts[i-1].x, pts[i-1].y); ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    } else if (stroke.tool === 'poly') {
      // Polylinie: gerade Segmente (gewollt)
      ctx.lineWidth = stroke.size;
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
    } else if (stroke.tool === 'polygon') {
      // Geschlossene Fläche: Füllung + Kontur
      ctx.lineWidth = stroke.size;
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.closePath();
      // Halbtransparente Füllung
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = stroke.color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = stroke.color;
      ctx.stroke();
    } else {
      // Maus / Touch Freehand: Catmull-Rom-Spline → sehr glatte Kurve
      ctx.lineWidth = stroke.size;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < pts.length - 1; i++) {
        // Nachbarpunkte (Anfang/Ende: Spiegelung)
        const p0 = pts[i > 0 ? i - 1 : 0];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2 < pts.length ? i + 2 : pts.length - 1];
        // Catmull-Rom → kubische Bézier-Kontrollpunkte (Spannung 0.5)
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
      ctx.stroke();
    }
  });
  // Referenz-Layer über eigene Skizze zeichnen (nach jedem redraw)
  if (typeof redrawRefLayer === 'function' && _refLayerPhase) setTimeout(redrawRefLayer, 0);
}

let currentMode = 'pan'; // pan | draw | measure

function setMode(mode) {
  // Stop measure if switching away
  if (currentMode === 'measure' && mode !== 'measure') stopMeasure();
  currentMode = mode;
  const isDraw = mode === 'draw';
  const isMeasure = mode === 'measure';
  isDrawMode = isDraw;
  const canvas = document.getElementById('sketch-canvas');
  canvas.classList.toggle('draw-mode', isDraw);
  if (leafletMap) {
    if (isDraw || isMeasure) {
      leafletMap.dragging.disable();
      leafletMap.doubleClickZoom.disable();
      leafletMap.scrollWheelZoom.enable();  // Zoom per Mausrad immer erlaubt
    } else {
      leafletMap.dragging.enable();
      leafletMap.scrollWheelZoom.enable();
      leafletMap.doubleClickZoom.enable();
    }
    // touchZoom bleibt in JEDEM Modus eingeschaltet. Es wurde früher beim Ende
    // einer Zweifingergeste im Zeichenmodus abgeschaltet und nirgends wieder
    // aktiviert — die Karte liess sich danach bis zum Neuladen der App nicht
    // mehr mit zwei Fingern zoomen. Hier auch als Reparatur für Sitzungen,
    // die noch im abgeschalteten Zustand stecken.
    leafletMap.touchZoom.enable();
  }
  document.getElementById('btn-mode-pan').classList.toggle('active', mode === 'pan');
  document.getElementById('btn-mode-draw').classList.toggle('active', isDraw);
  document.getElementById('btn-mode-measure').classList.toggle('active', isMeasure);

  // Unterfunktionen dynamisch ein-/ausblenden
  document.querySelectorAll('.toolbar-draw-tools').forEach(el => {
    el.style.display = isDraw ? 'flex' : 'none';
  });
  document.getElementById('pan-tools').style.display = (mode === 'pan') ? 'flex' : 'none';
  document.getElementById('measure-tools').style.display = isMeasure ? 'flex' : 'none';

  if (isMeasure) startMeasure();
}

// Keep old setDrawMode for compatibility
function setDrawMode(draw) { setMode(draw ? 'draw' : 'pan'); }

function setMapOpacity(val, step) {
  if (leafletMap) {
    const opacity = val / 100;
    // Nur Kacheln transparent machen — alle anderen Ebenen bleiben sichtbar
    ['tilePane', 'shadowPane'].forEach(pane => {
      const p = leafletMap.getPane(pane);
      if (p) p.style.opacity = opacity;
    });
    // Marker, Overlay, Popup Ebenen explizit auf 1 setzen
    ['markerPane', 'overlayPane', 'popupPane', 'tooltipPane'].forEach(pane => {
      const p = leafletMap.getPane(pane);
      if (p) p.style.opacity = '1';
    });
    // Skizze-Canvas ebenfalls auf 1 halten
    const canvas = document.getElementById('sketch-canvas');
    if (canvas) canvas.style.opacity = '1';
  }
  if (step) {
    [1,2,3,4].forEach(s => {
      const btn = document.getElementById('op-btn-' + s);
      if (btn) btn.classList.toggle('active', s === step);
    });
  }
}

function setTool(t) {
  // Laufende Poly/Polygon-Eingabe abbrechen wenn Tool wechselt
  if (polyActive && t !== 'poly' && t !== 'polygon') cancelPolyline();
  // Text-Eingabe verstecken wenn Tool wechselt
  if (t !== 'text') {
    const ti = document.getElementById('sketch-text-input');
    if (ti) { ti.style.display = 'none'; }
    textInputPending = false;
  }
  currentTool = t;
  ['pen','poly','polygon','text','eraser'].forEach(id => {
    const btn = document.getElementById('btn-' + id);
    if (btn) btn.classList.toggle('active', id === t);
  });
}

function setBrushSize(step, size) {
  brushSize = size;
  [1,2,3,4].forEach(s => {
    const btn = document.getElementById('size-btn-' + s);
    if (btn) btn.classList.toggle('active', s === step);
  });
}

function setBrushSizeFromSelect(val) {
  const sizes = { '1': 3, '2': 6, '3': 10, '4': 18 };
  brushSize = sizes[val] || 6;
}

let _sketchLayerVisible = true;
function toggleSketchLayer() {
  _sketchLayerVisible = !_sketchLayerVisible;
  const canvas = document.getElementById('sketch-canvas');
  if (canvas) canvas.style.opacity = _sketchLayerVisible ? '1' : '0';
  const btn = document.getElementById('btn-layer-toggle');
  if (btn) {
    btn.classList.toggle('active', _sketchLayerVisible);
    btn.title = _sketchLayerVisible ? 'Kommentare ausblenden' : 'Kommentare einblenden';
    btn.innerHTML = _sketchLayerVisible
      ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
      : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  }
}

function setColor(c) {
  currentColor = c;
  const btn = document.getElementById('sketch-color-btn');
  if (btn) btn.style.background = c;
  // Tool nicht zurücksetzen — aktives Tool behalten
}

function toggleSketchColorPicker() {
  const picker = document.getElementById('sketch-color-picker');
  const btn    = document.getElementById('sketch-color-btn');
  if (!picker) return;
  if (picker.style.display !== 'none') { picker.style.display = 'none'; return; }
  // Position oberhalb des Farbbuttons berechnen (position:fixed → Viewport-Koordinaten)
  const r = btn.getBoundingClientRect();
  picker.style.display = 'block';
  picker.style.left = Math.max(4, r.left - picker.offsetWidth / 2 + r.width / 2) + 'px';
  picker.style.top  = (r.top - picker.offsetHeight - 8) + 'px';
}

async function clearSketch() {
  if (!await ui.confirm('Skizze wirklich löschen?')) return;
  sketchStrokes = [];
  redrawSketch();
  setPairData(currentPairId, { sketch: null });
}

// Skizze manuell speichern — kein renderCards nötig, Sketch-Icon wird beim nächsten Öffnen aktualisiert
function saveSketch() {
  saveSketchToStorage();
  const btn = document.querySelector('.sketch-toolbar button:last-child');
  const orig = btn.textContent;
  btn.textContent = '✓'; setTimeout(() => btn.textContent = orig, 1500);
}

function saveSketchToStorage() {
  // Phasenspezifischer Key: sketch_<phase>
  const key = `sketch_${_activePhase}`;
  if (sketchStrokes.length > 0) {
    setPairData(currentPairId, { [key]: JSON.stringify(sketchStrokes), sketchPairId: currentPairId });
  } else {
    setPairData(currentPairId, { [key]: null });
  }
}

function loadSketchFromStorage() {
  const pd = getPairData(currentPairId);
  sketchStrokes = [];
  const key = `sketch_${_activePhase}`;

  if (pd[key]) {
    try {
      const parsed = jsonParse(pd[key]);
      if (Array.isArray(parsed)) sketchStrokes = parsed;
    } catch(e) { sketchStrokes = []; }
  } else if (pd.sketch && (!pd.sketchPairId || pd.sketchPairId === currentPairId)) {
    // Migration: altes phasenloses sketch → in aktive Phase übernehmen
    try {
      const parsed = jsonParse(pd.sketch);
      if (Array.isArray(parsed)) {
        sketchStrokes = parsed;
        saveSketchToStorage(); // in phasenspezifischen Key migrieren
        setPairData(currentPairId, { sketch: null }); // alten Key leeren
      }
    } catch(e) { sketchStrokes = []; }
  }

  if (leafletMap) { redrawSketch(); redrawRefLayer(); }
}

// ── Referenz-Layer: andere Phasen ────────────────────────────
let _refLayerPhase = null; // aktuell angezeigte Referenz-Phase

function toggleRefLayerPicker() {
  const picker = document.getElementById('ref-layer-picker');
  if (!picker) return;
  const isOpen = picker.style.display !== 'none';
  // Schliessen bei Klick ausserhalb
  if (!isOpen) {
    buildRefLayerOptions();
    picker.style.display = 'block';
    setTimeout(() => document.addEventListener('click', closeRefLayerPickerOnOutside), 10);
  } else {
    picker.style.display = 'none';
  }
}

function closeRefLayerPickerOnOutside(e) {
  const picker = document.getElementById('ref-layer-picker');
  const btn    = document.getElementById('btn-ref-layer');
  if (picker && !picker.contains(e.target) && e.target !== btn) {
    picker.style.display = 'none';
    document.removeEventListener('click', closeRefLayerPickerOnOutside);
  }
}

function buildRefLayerOptions() {
  const container = document.getElementById('ref-layer-options');
  if (!container) return;
  const phases = Object.values(PHASEN_CONFIG).filter(p => p.id !== _activePhase);
  container.innerHTML = [
    { id: null, label: 'Keiner' },
    ...phases
  ].map(p => {
    const active = _refLayerPhase === p.id;
    return `<button onclick="setRefLayer('${p.id}')"
      style="padding:5px 10px;border-radius:5px;border:1px solid ${active ? '#1a3a5c' : '#e5e7eb'};
             background:${active ? '#1a3a5c' : 'white'};color:${active ? 'white' : '#374151'};
             font-size:11px;font-weight:${active ? '700' : '500'};cursor:pointer;text-align:left;">
      ${p.label || 'Keiner'}
    </button>`;
  }).join('');
}

function setRefLayer(phase) {
  _refLayerPhase = phase === 'null' || phase === null ? null : phase;
  document.getElementById('ref-layer-picker').style.display = 'none';
  document.removeEventListener('click', closeRefLayerPickerOnOutside);
  // Referenz-Button aktiv markieren
  const btn = document.getElementById('btn-ref-layer');
  if (btn) btn.classList.toggle('active', _refLayerPhase !== null);
  redrawRefLayer();
}

function redrawRefLayer() {
  const canvas = document.getElementById('sketch-canvas');
  if (!canvas || !leafletMap) return;
  // Eigene Skizze neu zeichnen (setzt Ref-Layer zurück)
  redrawSketch();
  if (!_refLayerPhase || !currentPairId) return;

  const pd  = getPairData(currentPairId);
  const key = `sketch_${_refLayerPhase}`;
  if (!pd[key]) return;

  let refStrokes = [];
  try { refStrokes = jsonParse(pd[key]); } catch { return; }
  if (!Array.isArray(refStrokes) || refStrokes.length === 0) return;

  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.globalAlpha = 0.28;

  refStrokes.forEach(stroke => {
    if (stroke.tool === 'text') {
      const pos = latLngToCanvasPos(L.latLng(stroke.pos.lat, stroke.pos.lng));
      ctx.font = `bold ${stroke.size}px 'Segoe UI', sans-serif`;
      ctx.fillStyle = '#6b7280';
      ctx.fillText(stroke.text, pos.x, pos.y);
      return;
    }
    if (!stroke.points || stroke.points.length < 2) return;
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth   = stroke.size;
    ctx.lineCap     = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    const pts = stroke.points.map(pt => latLngToCanvasPos(L.latLng(pt.lat, pt.lng)));
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const mid = { x: (pts[i-1].x + pts[i].x)/2, y: (pts[i-1].y + pts[i].y)/2 };
      ctx.quadraticCurveTo(pts[i-1].x, pts[i-1].y, mid.x, mid.y);
    }
    ctx.stroke();
  });

  ctx.restore();
}

// ============================================================
