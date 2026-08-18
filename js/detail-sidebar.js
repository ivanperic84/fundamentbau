// DETAIL
// ============================================================
let currentPairId = 1;
let leafletMap = null;
let rsMarker = null, rksMarker = null;
let ghostMarkers = []; // Nachbar-Sondagen (dezent)
let layerControl = null;
let isDrawMode = false;
let currentTool = 'pen', currentColor = '#e53e3e', brushSize = 3;
let isDrawing = false, lastX = 0, lastY = 0, lastMidX = 0, lastMidY = 0;
let _sX = 0, _sY = 0; // EMA-geglättete Position (Maus/Touch)
const DRAW_SMOOTH = 0.35; // EMA-Faktor: 0 = eingefroren, 1 = kein Glätten
let sketchStrokes = [];   // [{color, size, tool, points:[{lat,lng,p?}]}]  p = Druckstärke (Stift)
let currentStroke = null;
let _activePenId    = null;        // Pointer-ID des aktiven Stifts → Palm Rejection
const _activeTouchIds = new Set(); // Aktive Touch-Pointer → Zweifinger-Erkennung
let gpsMarker = null, gpsCircle = null, watchId = null;
let searchQuery = '';
let currentFeldTab = 'rs';
let pendingDrag = null;
let markersLocked = true;

function showDetail(pairId) {
  try {
  // Übersichtskarte-Popup schliessen (verhindert DOM-Überlagerung nach Zurück-Navigation)
  if (overviewMap) overviewMap.closePopup();
  currentPairId = pairId;
  lockMarkers();
  document.getElementById('overview-view').style.display = 'none';
  document.getElementById('create-view').style.display = 'none';
  document.getElementById('create-view').style.visibility = 'hidden';
  document.getElementById('create-view').style.pointerEvents = 'none';
  const dv = document.getElementById('detail-view');
  dv.style.display = 'block';
  dv.style.visibility = 'visible';
  dv.style.pointerEvents = '';
  bannerProjektZeigen(false);
  if (typeof ansichtEinblenden === 'function') ansichtEinblenden(dv);
  if (createMapLeaflet) { createMapLeaflet.remove(); createMapLeaflet = null; createRsMarker = null; createRksMarker = null; createBsMarker = null; }

  const pair = PAIRS.find(p => p.id === pairId);
  const isInst = pair?._objType === 'installation';
  const isBP = _activePhase === 'bauprojekt';
  const isAF = _activePhase === 'ausfuehrung';
  const isBG = !isBP && !isAF;

  // Sektion-Sichtbarkeit je nach Objekttyp
  ['sec-zugang','sec-feld','sec-sicher'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = (!isInst && isBG) ? '' : 'none';
  });

  // Installation: eigene Info-Sektion anzeigen
  const secInstInfo = document.getElementById('sec-inst-info');
  if (secInstInfo) secInstInfo.style.display = isInst ? '' : 'none';

  const fotosTitle = document.getElementById('sec-fotos-title');
  if (fotosTitle) fotosTitle.textContent = 'Fotos';

  renderDetail();

  ['sec-fotos','sec-skizzen','sec-notizen'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = '';
  });

  ['sec-phase-bauprojekt','sec-bodenkennwerte','sec-naturschutz'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = (!isInst && isBP) ? '' : 'none';
  });

  ['sec-ausfuehrung-ref','sec-aushub','sec-material','sec-abnahme-link','sec-ausfplanung'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = (!isInst && isAF) ? '' : 'none';
  });

  // Installations-Sidebar-Inhalt füllen
  if (isInst && pair) {
    const _si = document.getElementById('sec-inst-content');
    if (_si) {
      const typLabel = INST_TYP_LABELS[pair.installTyp] || pair.installTyp || '—';
      // Gerechnete Flaeche mit den Massen daneben — dieselbe Rechnung wie auf
      // der Kachel (instFlaeche), damit beide dasselbe anschreiben.
      const _fl = typeof instFlaeche === 'function' ? instFlaeche(pair) : { m2: null, masse: null };
      const fStr = _fl.m2
        ? `<b>${_fl.m2 >= 10 ? Math.round(_fl.m2) : Math.round(_fl.m2 * 10) / 10} m²</b>`
          + (_fl.masse ? ` <span style="color:#9ca3af;">${_fl.masse}</span>` : '')
        : '—';
      const _tage = typeof instTage === 'function' ? instTage(pair) : null;
      const vonStr = pair.von ? pair.von.split('-').reverse().join('.') : null;
      const bisStr = pair.bis ? pair.bis.split('-').reverse().join('.') : null;
      const zeitraum = (vonStr || bisStr)
        ? `${vonStr || '?'} – ${bisStr || '?'}` + (_tage ? ` <span style="color:#9ca3af;">· ${_tage} Tage</span>` : '')
        : '—';
      const _cbRow = (key, label) => {
        const checked = !!pair[key];
        const col = checked ? '#1a3a5c' : '#6b7280';
        return `<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;border-bottom:1px solid #f3f4f6;" onclick="toggleInstStatus(${pair.id},'${key}')">
          <div style="width:15px;height:15px;border-radius:3px;border:1.5px solid ${checked ? '#1a3a5c' : '#d1d5db'};background:${checked ? '#1a3a5c' : 'white'};display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;">
            ${checked ? '<svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 6 5 9 10 3"/></svg>' : ''}
          </div>
          <span style="font-size:12px;color:${col};font-weight:${checked ? '600' : '400'};">${label}</span>
        </label>`;
      };
      const bestelltDatumVal = pair.instBestelltDatum || '';
      _si.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px;">
          <tr><td style="color:#9ca3af;padding:4px 0;width:80px;font-size:11px;">Typ</td><td style="font-weight:600;color:#1a3a5c;font-size:12px;">${typLabel}</td></tr>
          <tr><td style="color:#9ca3af;padding:4px 0;font-size:11px;">Fläche</td><td style="color:#374151;font-size:12px;">${fStr}</td></tr>
          <tr><td style="color:#9ca3af;padding:4px 0;font-size:11px;">Zeitraum</td><td style="color:#374151;font-size:12px;">${zeitraum}</td></tr>
          ${pair.bemerkung ? `<tr><td style="color:#9ca3af;padding:4px 0;font-size:11px;vertical-align:top;">Bemerkung</td><td style="white-space:pre-wrap;color:#374151;font-size:12px;">${pair.bemerkung}</td></tr>` : ''}
          ${pair.instBestellLink ? `<tr><td style="color:#9ca3af;padding:4px 0;font-size:11px;vertical-align:top;">Bestelllink</td><td style="font-size:12px;"><a href="${pair.instBestellLink}" target="_blank" rel="noopener" style="color:#1a3a5c;font-weight:600;text-decoration:none;word-break:break-all;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">Öffnen <svg style="vertical-align:middle" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a></td></tr>` : ''}
        </table>
        ${(pair.instAbschaltung || pair.instErdung || pair.instGleisAbstand)
          ? `<div style="font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:.05em;text-transform:uppercase;margin:10px 0 4px;">Fahrleitung</div>
             <div style="font-size:12px;color:#374151;line-height:1.8;">
               ${pair.instAbschaltung ? '<div>Abschaltung erforderlich</div>' : ''}
               ${pair.instErdung ? '<div>Erdung erforderlich</div>' : ''}
               ${pair.instGleisAbstand ? `<div>Abstand Gleisachse ${pair.instGleisAbstand} m</div>` : ''}
             </div>`
          : ''}
        <div style="font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:.05em;text-transform:uppercase;margin:10px 0 4px;">Status</div>
        ${_cbRow('instBestellt',     'Bestellt')}
        <div id="inst-bestellt-datum-row" style="padding:4px 0 6px 23px;border-bottom:1px solid #f3f4f6;${pair.instBestellt ? '' : 'display:none;'}">
          <label style="font-size:10px;color:#9ca3af;display:block;margin-bottom:3px;">Bestelldatum</label>
          <input type="date" id="inst-bestellt-datum" value="${bestelltDatumVal}"
            onchange="saveInstBestelltDatum(${pair.id}, this.value)"
            style="padding:4px 8px;border:1px solid #d1d5db;border-radius:5px;font-size:11px;font-family:inherit;color:#374151;background:white;cursor:pointer;">
        </div>
        ${_cbRow('instRueckmeldung', 'Rückmeldung pendent')}
        ${_cbRow('instBestaetigt',   'Bestätigt')}
        ${pair.instFrist ? `<div style="padding:5px 0 0 23px;font-size:11px;color:${
            (typeof instFristStand === 'function' && instFristStand(pair)) ? instFristStand(pair).farbe : '#9ca3af'};">
            Bestellfrist ${_instDatum(pair.instFrist)}${
              (typeof instFristStand === 'function' && instFristStand(pair)) ? ' · ' + instFristStand(pair).text : ''}</div>` : ''}
        <div style="font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:.05em;text-transform:uppercase;margin:12px 0 4px;">Rückgabe</div>
        ${_cbRow('instRueckgabeOk', 'Fläche zurückgegeben')}
        <div id="inst-rueckgabe-datum-row" style="padding:4px 0 6px 23px;border-bottom:1px solid #f3f4f6;${pair.instRueckgabeOk ? '' : 'display:none;'}">
          <label style="font-size:10px;color:#9ca3af;display:block;margin-bottom:3px;">Rückgabedatum</label>
          <input type="date" id="inst-rueckgabe-datum" value="${pair.instRueckgabeDatum || ''}"
            onchange="saveInstFeld(${pair.id},'instRueckgabeDatum',this.value)"
            style="padding:4px 8px;border:1px solid #d1d5db;border-radius:5px;font-size:11px;font-family:inherit;color:#374151;background:white;cursor:pointer;">
        </div>
        <div style="font-size:10px;color:#9ca3af;padding:6px 0 0;line-height:1.6;">
          Zustand vor und nach der Nutzung mit Fotos belegen — in der Foto-Sektion
          unter «Rückgabe» ablegen.</div>
        <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
          <button onclick="openCreateInstallation(${pair.id})"
            style="padding:4px 12px;border-radius:6px;border:1px solid #1a3a5c;background:white;color:#1a3a5c;font-size:11px;font-weight:600;cursor:pointer;">Bearbeiten</button>
          <button onclick="instFlaecheAusMessung(${pair.id})" title="Die zuletzt auf der Karte gemessene Fläche als Installationsfläche übernehmen"
            style="padding:4px 12px;border-radius:6px;border:1px solid #d1d5db;background:white;color:#374151;font-size:11px;font-weight:600;cursor:pointer;">Fläche aus Messung</button>
        </div>`;
    }
  }

  if (!isInst) {
    loadBegehungFelder(pairId);
    loadSidebar_Termine(pairId);
    setTimeout(() => loadMeasureLayer(pairId), 100);
  }
  setTimeout(() => renderSkizzeThumbs(), 50);
  renderPaarNotizen(pairId);
  // User-Sidebar-Config anwenden (nach Phase-basierter Sichtbarkeit).
  // Vorher festhalten, was die Phase zeigt — sonst kann eine Vorlage zwar
  // ausblenden, aber beim Zurueckschalten nichts wieder einblenden.
  setTimeout(() => { sbPhasenStandMerken(); applySidebarCfg(); }, 0);

  if (!isInst && isBP) {
    loadBauprojektFelder(pairId);
    updateBodenkennwerteUI();
    updateBkProfilInfo();
    loadNaturschutzFelder(pairId);
    setTimeout(() => { queryGisNaturschutz(); queryGisAltlasten(); queryGisGrundwasser(); }, 300);
  }
  if (!isInst && isAF) {
    loadAusfuehrungFelder(pairId);
    renderSidebarAushubSummary(pairId);
  }
  setTimeout(() => initMap(), 50);
  updatePhaseSelectState();
  pushNavState({ type: 'detail', phase: _activePhase, pairId });
  updateNavButtons();
  } catch(e) {
    // Fehler loggen und UI-Zustand wiederherstellen
    console.error('showDetail Fehler:', e);
    const dv2 = document.getElementById('detail-view');
    if (!dv2 || dv2.style.display !== 'block') {
      // Detail wurde nicht vollständig gezeigt → zurück zur Übersicht
      document.getElementById('overview-view').style.display = 'block';
      bannerProjektZeigen(true);
    }
  }
}

// ============================================================
// SIDEBAR ACCORDION
// ============================================================
function toggleSection(id) {
  const section = document.getElementById(id);
  if (!section) return;
  const body = section.querySelector('.sb-body');
  const chevron = section.querySelector('.sb-chevron');
  if (!body) return;
  const collapsed = body.classList.toggle('collapsed');
  if (chevron) chevron.style.transform = collapsed ? 'rotate(-90deg)' : '';
  section.classList.toggle('section-open', !collapsed);
  try { sessionStorage.setItem('sb-' + id, collapsed ? '1' : '0'); } catch(e) {}
  _updateCollapseAllBtn();
}

// Alle Sidebar-Sektionen auf- oder zuklappen
function toggleAllSections() {
  const sections = document.querySelectorAll('.detail-sidebar .sidebar-section');
  // Zustand ermitteln: wenn mindestens eine offen ist → alle schliessen; sonst alle öffnen
  const anyOpen = Array.from(sections).some(s => {
    const body = s.querySelector('.sb-body');
    return body && !body.classList.contains('collapsed');
  });
  sections.forEach(section => {
    const body    = section.querySelector('.sb-body');
    const chevron = section.querySelector('.sb-chevron');
    if (!body) return;
    if (anyOpen) {
      body.classList.add('collapsed');
      if (chevron) chevron.style.transform = 'rotate(-90deg)';
      section.classList.remove('section-open');
      try { sessionStorage.setItem('sb-' + section.id, '1'); } catch(e) {}
    } else {
      body.classList.remove('collapsed');
      if (chevron) chevron.style.transform = '';
      section.classList.add('section-open');
      try { sessionStorage.setItem('sb-' + section.id, '0'); } catch(e) {}
    }
  });
  _updateCollapseAllBtn();
}

// Button-Label + Icon passend aktualisieren
function _updateCollapseAllBtn() {
  const sections = document.querySelectorAll('.detail-sidebar .sidebar-section');
  const anyOpen  = Array.from(sections).some(s => {
    const body = s.querySelector('.sb-body');
    return body && !body.classList.contains('collapsed');
  });
  const lbl  = document.getElementById('sb-collapse-all-label');
  const icon = document.getElementById('sb-collapse-all-icon');
  const btn = document.getElementById('sb-collapse-all-btn');
  if (btn) btn.title = anyOpen ? 'Alle zuklappen' : 'Alle aufklappen';
  if (icon) icon.innerHTML = anyOpen
    ? '<polyline points="6 9 12 15 18 9"/>'   // Pfeil nach unten = zuklappen
    : '<polyline points="18 15 12 9 6 15"/>'; // Pfeil nach oben = aufklappen
}

const SECTION_DEFAULT_OPEN = new Set(['sec-zugang','sec-inst-info']);

// ── Sidebar Section Drag & Drop ──────────────────────────
const SB_ORDER_KEY = 'fb_sb_section_order';
let _sbDragId = null;

function _loadSbOrder()  { try { return jsonParse(store.getItem(SB_ORDER_KEY)) || null; } catch { return null; } }
function _saveSbOrder()  {
  const sidebar = document.querySelector('.detail-sidebar');
  if (!sidebar) return;
  const order = [...sidebar.querySelectorAll(':scope > .sidebar-section')].map(s => s.id).filter(Boolean);
  store.setItem(SB_ORDER_KEY, JSON.stringify(order));
}
function _applySbOrder() {
  const order = _loadSbOrder();
  if (!order?.length) return;
  const sidebar = document.querySelector('.detail-sidebar');
  if (!sidebar) return;
  order.forEach(id => {
    const el = document.getElementById(id);
    if (el?.parentNode === sidebar) sidebar.appendChild(el);
  });
}
async function resetSbOrder() {
  if (!await ui.confirm('Reihenfolge der Sidebar-Gruppen zurücksetzen?')) return;
  store.removeItem(SB_ORDER_KEY);
  appReload();
}

function _initSidebarDragHandles() {
  _applySbOrder();
  const sidebar = document.querySelector('.detail-sidebar');
  if (!sidebar) return;

  sidebar.querySelectorAll(':scope > .sidebar-section').forEach(sec => {
    if (sec.dataset.sbDrag) return;
    sec.dataset.sbDrag = '1';
    const h3 = sec.querySelector('h3');
    if (!h3) return;

    // Fix h3 layout to accommodate the new handle on the left
    h3.style.justifyContent = 'flex-start';
    h3.style.gap = '4px';
    const labelSpan = h3.querySelector('span:first-child');
    if (labelSpan) labelSpan.style.flex = '1';

    const handle = document.createElement('span');
    handle.className = 'sb-drag-handle';
    handle.textContent = '⠿';
    handle.title = 'Ziehen zum Neuanordnen';
    h3.insertBefore(handle, h3.firstChild);

    handle.addEventListener('pointerdown', () => sec.setAttribute('draggable', 'true'));

    sec.addEventListener('dragstart', e => {
      _sbDragId = sec.id;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => sec.classList.add('sb-dragging'), 0);
    });
    sec.addEventListener('dragend', () => {
      sec.removeAttribute('draggable');
      sec.classList.remove('sb-dragging');
      sidebar.querySelectorAll('.sb-drag-over-top, .sb-drag-over-bottom')
        .forEach(el => el.classList.remove('sb-drag-over-top', 'sb-drag-over-bottom'));
      _sbDragId = null;
    });
    sec.addEventListener('dragover', e => {
      if (!_sbDragId || _sbDragId === sec.id) return;
      e.preventDefault();
      const mid = sec.getBoundingClientRect().top + sec.getBoundingClientRect().height / 2;
      sec.classList.toggle('sb-drag-over-top',    e.clientY < mid);
      sec.classList.toggle('sb-drag-over-bottom', e.clientY >= mid);
    });
    sec.addEventListener('dragleave', e => {
      if (!sec.contains(e.relatedTarget))
        sec.classList.remove('sb-drag-over-top', 'sb-drag-over-bottom');
    });
    sec.addEventListener('drop', e => {
      e.preventDefault();
      sec.classList.remove('sb-drag-over-top', 'sb-drag-over-bottom');
      if (!_sbDragId || _sbDragId === sec.id) return;
      const srcEl = document.getElementById(_sbDragId);
      if (!srcEl) return;
      const mid = sec.getBoundingClientRect().top + sec.getBoundingClientRect().height / 2;
      sidebar.insertBefore(srcEl, e.clientY < mid ? sec : sec.nextSibling);
      _saveSbOrder();
    });
  });
}

function restoreSectionStates() {
  ['sec-meta','sec-begehung','sec-zugang','sec-inst-info','sec-fotos','sec-skizzen','sec-feld','sec-sicher','sec-changelog'].forEach(id => {
    const saved = sessionStorage.getItem('sb-' + id);
    const collapse = saved !== null ? saved === '1' : !SECTION_DEFAULT_OPEN.has(id);
    const section = document.getElementById(id);
    if (!section) return;
    const body    = section.querySelector('.sb-body');
    const chevron = section.querySelector('.sb-chevron');
    if (collapse) {
      if (body)    body.classList.add('collapsed');
      if (chevron) chevron.style.transform = 'rotate(-90deg)';
      section.classList.remove('section-open');
    } else {
      if (body)    body.classList.remove('collapsed');
      if (chevron) chevron.style.transform = '';
      section.classList.add('section-open');
    }
  });
  _initSidebarDragHandles();
}

function appRefresh() {
  // Aktuelle Ansicht merken damit nach Reload wieder dieselbe Seite gezeigt wird
  const inDetail = document.getElementById('detail-view').style.display === 'block';
  try {
    sessionStorage.setItem('refresh_view', inDetail ? 'detail' : 'overview');
    if (inDetail) sessionStorage.setItem('refresh_pair', currentPairId);
    sessionStorage.setItem('refresh_tab', currentOverviewView || 'karten');
  } catch(e) {}
  if (watchId) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  destroySketchListeners();
  if (leafletMap) { try { leafletMap.remove(); } catch(e) {} leafletMap = null; }
  if (createMapLeaflet) { try { createMapLeaflet.remove(); } catch(e) {} createMapLeaflet = null; }
  appReload();
}

function showOverview() {
  if (pendingDrag) cancelDrag();
  _createInstallMode = false;
  appRefresh();
  setTimeout(updatePhaseSelectState, 50);
}

// Karten-Vollbildmodus in der Detailansicht ein-/ausschalten
let _mapFullscreen = false;
function toggleMapFullscreen() {
  _mapFullscreen = !_mapFullscreen;
  const layout = document.querySelector('.detail-layout');
  const btn    = document.getElementById('btn-map-fullscreen');
  layout.classList.toggle('map-fullscreen', _mapFullscreen);
  closePairJump();
  btn.innerHTML = _mapFullscreen
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>'
    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
  btn.title = _mapFullscreen ? 'Vollbild beenden' : 'Karte Vollbild';
  // Die neue Kartengroesse meldet der Groessenbeobachter der Karte selbst
  // (karteGroesseBeobachten in js/karte-skizze.js) — waehrend des Einfahrens
  // und am Ende, ohne geratene Verzoegerung.
}
// ESC verlässt den Vollbildmodus / hebt FT-Selektion auf
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && _mapFullscreen) toggleMapFullscreen();
  if (e.key === 'Escape' && typeof _ftSelected !== 'undefined' && _ftSelected.size > 0) {
    clearFtSelection();
    e.stopPropagation();
  }
});

// Beim Verlassen der Detailansicht Vollbild zurücksetzen
function exitMapFullscreen() {
  if (_mapFullscreen) {
    _mapFullscreen = false;
    closePairJump();
    document.querySelector('.detail-layout')?.classList.remove('map-fullscreen');
    const btn = document.getElementById('btn-map-fullscreen');
    if (btn) { btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>'; btn.title = 'Karte Vollbild'; }
  }
}

// Gibt die zur aktiven Phase gehörenden Pairs zurück (für Navigation + Zählung)
// Installationen werden in getPhasePairs() nie berücksichtigt — sie haben ihren eigenen Tab
function getPhasePairs() {
  if (_activePhase === 'baugrund') return PAIRS.filter(p => p._objType === 'sondage');
  return PAIRS.filter(p => p._objType === 'fundament');
}

// ============================================================
// STANDORTWAHL AUS DER DETAILANSICHT
// Der Name in der Navigationszeile oeffnet eine durchsuchbare Liste. Vorher
// fuehrte nur Blaettern zum Ziel — bei 25 Positionen bis zu 24 Klicks.
// ============================================================
let _pjMarkiert = 0;   // Tastaturauswahl in der offenen Liste

function pairJumpQuelle() {
  const aktuell = PAIRS.find(p => p.id === currentPairId);
  return aktuell?._objType === 'installation' ? getInstallationen() : getPhasePairs();
}

function pairJumpName(p) {
  if (p._objType === 'installation') return p.bezeichnung || 'Installation ' + p.id;
  return _activePhase !== 'baugrund'
    ? standortName(p)
    : (p.bezeichnung || 'Standort ' + p.id);
}

function togglePairJump(ev) {
  if (ev) ev.stopPropagation();
  const panel = document.getElementById('pair-jump-panel');
  if (!panel) return;
  const offen = panel.classList.toggle('offen');
  if (!offen) return;
  const feld = document.getElementById('pair-jump-such');
  if (feld) { feld.value = ''; feld.focus(); }
  renderPairJumpListe('');
}

function closePairJump() {
  document.getElementById('pair-jump-panel')?.classList.remove('offen');
}

function renderPairJumpListe(filter) {
  const liste = document.getElementById('pair-jump-liste');
  if (!liste) return;
  // Dieselbe Regel wie im Suchfeld des Kopfes: Text ueberall, Zahlen als
  // Mast-/Positionsnummer oder Kilometer.
  const q = (filter || '').trim();
  const notAll = q ? loadAllNotizen() : {};
  const bpAll  = q && typeof loadAllBauprojekt === 'function' ? loadAllBauprojekt() : {};
  const treffer = pairJumpQuelle().filter(p => !q || sucheTrifftStandort(p, q, notAll, bpAll));
  _pjMarkiert = 0;
  if (!treffer.length) {
    liste.innerHTML = '<div class="pair-jump-leer">Kein Standort gefunden</div>';
    return;
  }
  liste.innerHTML = treffer.map((p, i) => {
    const km = p.km_rs || p.km_rks;
    return '<button class="pair-jump-eintrag'
      + (p.id === currentPairId ? ' aktiv' : '')
      + (i === 0 ? ' markiert' : '') + '" data-pair-id="' + p.id + '">'
      + '<span>' + escHtml(pairJumpName(p)) + '</span>'
      + (km ? '<span class="pj-neben">' + escHtml(parseFloat(km).toFixed(3)) + '</span>' : '')
      + '</button>';
  }).join('');
  liste.querySelectorAll('[data-pair-id]').forEach(btn => {
    btn.onclick = () => springeZuPair(btn.dataset.pairId);
  });
  // Aktuellen Standort ins Sichtfeld holen
  liste.querySelector('.pair-jump-eintrag.aktiv')?.scrollIntoView({ block: 'nearest' });
}

function springeZuPair(id) {
  closePairJump();
  const ziel = pairJumpQuelle().find(p => String(p.id) === String(id));
  if (ziel) showDetail(ziel.id);
}

// Pfeiltasten und Eingabetaste im Suchfeld
function pairJumpTaste(ev) {
  const eintraege = [...document.querySelectorAll('#pair-jump-liste .pair-jump-eintrag')];
  if (ev.key === 'Escape') { closePairJump(); return; }
  if (!eintraege.length) return;
  if (ev.key === 'Enter') {
    ev.preventDefault();
    springeZuPair(eintraege[_pjMarkiert]?.dataset.pairId);
    return;
  }
  if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
  ev.preventDefault();
  eintraege[_pjMarkiert]?.classList.remove('markiert');
  _pjMarkiert = (_pjMarkiert + (ev.key === 'ArrowDown' ? 1 : -1) + eintraege.length) % eintraege.length;
  eintraege[_pjMarkiert].classList.add('markiert');
  eintraege[_pjMarkiert].scrollIntoView({ block: 'nearest' });
}

// Klick daneben schliesst — der Waehler selbst stoppt das Ereignis
document.addEventListener('click', e => {
  if (!e.target.closest('.pair-jump-wrap')) closePairJump();
});

function navigatePair(dir) {
  closePairJump();
  if (pendingDrag) cancelDrag();
  lockMarkers();
  const currentPair = PAIRS.find(p => p.id === currentPairId);
  const isInst = currentPair?._objType === 'installation';
  const phasePairs = isInst ? getInstallationen() : getPhasePairs();
  const idx = phasePairs.findIndex(p => p.id === currentPairId);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= phasePairs.length) return;
  saveSketchToStorage();
  currentPairId = phasePairs[newIdx].id;
  renderDetail();
  updateMapToCurrentPair();
  // Phase-spezifische Sidebar-Daten für das neue Pair nachladen (nicht für Installationen)
  if (!isInst) {
    if (_activePhase === 'bauprojekt') loadBauprojektFelder(currentPairId);
    else if (_activePhase === 'ausfuehrung') loadAusfuehrungFelder(currentPairId);
    loadBegehungFelder(currentPairId);
    loadSidebar_Termine(currentPairId);
  }
  // Vollbild-Modus aufrechterhalten — Leaflet nach Neu-Render informieren
  if (_mapFullscreen && leafletMap) setTimeout(() => leafletMap.invalidateSize(), 80);
}

// Metadaten-Grid und Koordinatentabelle gemeinsam aktualisieren
// Inaktive Typen (typAktiv) werden ausgeblendet
function renderMetaSection(pair) {
  const hasRS   = !!(pair.rs?.e   && pair.rs?.n);
  const hasRKS  = !!(pair.rks?.e  && pair.rks?.n);
  const hasFund = !!(pair.fund?.e && pair.fund?.n);
  const isBP = _activePhase === 'bauprojekt';
  const isAF = _activePhase === 'ausfuehrung';
  const isBG = !isBP && !isAF;
  const fmt  = v => v ? parseFloat(v).toFixed(3) : '—';
  const anchor = hasFund ? pair.fund : (hasRS ? pair.rs : (hasRKS ? pair.rks : null));

  const _schichtEntry = pair.schichtId ? loadSchichten().find(s => s.id === pair.schichtId) : null;
  const _schichtHtml  = _schichtEntry
    ? `<div class="meta-item"><label>Schicht</label><span>${_schichtEntry.name}</span></div>`
    : pair.tag
      ? `<div class="meta-item"><label>Schicht</label><span style="color:#9ca3af;">${pair.tag}</span></div>`
      : '';

  if (isBP || isAF) {
    document.getElementById('meta-grid').innerHTML = `
      <div class="meta-item"><label>Mast</label><span>${pair.mast || '—'}</span></div>
      <div class="meta-item"><label>KM</label><span>${fmt(pair.km_rs || pair.km_rks)}</span></div>
      <div class="meta-item"><label>Gleis</label><span>${pair.gleis || '—'}</span></div>
      ${_schichtHtml}
      ${pair.schlitz ? `<div class="meta-item"><label>Baggerschlitz</label><span>${pair.schlitz} m</span></div>` : ''}
      ${hasFund ? `<div class="meta-item"><label>Fundament LV95</label><span style="font-size:10px;">${pair.fund.e} / ${pair.fund.n}</span></div>`
                : anchor ? `<div class="meta-item"><label>Standort LV95</label><span style="font-size:10px;">${anchor.e} / ${anchor.n}</span></div>` : ''}
      ${pair.z != null && !isNaN(parseFloat(pair.z)) ? `<div class="meta-item"><label>Z-Achse OK Kopf</label><span>${parseFloat(pair.z).toFixed(2)} m ü.M.</span></div>` : ''}`;
  } else {
    document.getElementById('meta-grid').innerHTML = `
      ${hasRS  ? `<div class="meta-item"><label>KM (RS)</label><span>${fmt(pair.km_rs)}</span></div>` : ''}
      ${hasRKS ? `<div class="meta-item"><label>KM (RKS)</label><span>${fmt(pair.km_rks)}</span></div>` : ''}
      <div class="meta-item"><label>Mast</label><span>${pair.mast || '—'}</span></div>
      <div class="meta-item"><label>Tiefe Soll</label><span>${pair.tiefe ? pair.tiefe + ' m' : '—'}</span></div>
      ${pair.schlitz ? `<div class="meta-item"><label>Baggerschlitz</label><span>${pair.schlitz} m</span></div>` : ''}
      <div class="meta-item"><label>Gleis</label><span>${pair.gleis || '—'}</span></div>
      ${_schichtHtml}
      ${hasRS  ? `<div class="meta-item"><label>RS LV95</label><span style="font-size:10px;">${pair.rs.e} / ${pair.rs.n}</span></div>` : ''}
      ${hasRKS ? `<div class="meta-item"><label>RKS LV95</label><span style="font-size:10px;">${pair.rks.e} / ${pair.rks.n}</span></div>` : ''}
      ${pair.bs?.e ? `<div class="meta-item"><label>BS LV95</label><span style="font-size:10px;color:#b45309;">${pair.bs.e} / ${pair.bs.n}</span></div>` : ''}
      ${pair.bs?.km ? `<div class="meta-item"><label>BS KM</label><span>${fmt(pair.bs.km)}</span></div>` : ''}
      ${pair.bs?.tiefe ? `<div class="meta-item"><label>BS Tiefe</label><span>${pair.bs.tiefe} m</span></div>` : ''}
      ${pair.gelaendehoehe ? `<div class="meta-item"><label>Geländehöhe (m ü.M.)</label><span>${parseFloat(pair.gelaendehoehe).toFixed(1)} m</span></div>` : ''}`;
  }

  const pt = document.getElementById('pair-table');
  if (pt) {
    pt.innerHTML = isBG ? [
      `<tr><th>Typ</th><th>KM</th><th>E</th><th>N</th></tr>`,
      hasRS  ? `<tr><td><span class="type-badge type-rs">RS</span></td><td>${fmt(pair.km_rs)}</td><td>${pair.rs.e}</td><td>${pair.rs.n}</td></tr>` : '',
      hasRKS ? `<tr><td><span class="type-badge type-rks">RKS</span></td><td>${fmt(pair.km_rks)}</td><td>${pair.rks.e}</td><td>${pair.rks.n}</td></tr>` : '',
    ].join('') : '';
  }

  const swissEl = document.getElementById('swisstopo-link');
  if (swissEl && anchor) {
    swissEl.href = `https://map.geo.admin.ch/#/map?lang=de&center=${anchor.e},${anchor.n}&z=12&bgLayer=ch.swisstopo.swissimage`;
  }
}

function renderDetail() {
  isLoading = true;
  try {
  const pair = PAIRS.find(p => p.id === currentPairId);
  if (!pair) { isLoading = false; return; }
  const pd = getPairData(currentPairId);
  const isInst = pair._objType === 'installation';

  const phasePairs  = isInst ? getInstallationen() : getPhasePairs();
  const phaseIdx    = phasePairs.findIndex(p => p.id === currentPairId);
  const phaseLabel  = isInst
    ? (pair.bezeichnung || 'Installation ' + pair.id)
    : (_activePhase !== 'baugrund' ? `${standortName(pair)}` : (pair.bezeichnung || 'Standort ' + pair.id));
  const navText = document.getElementById('pair-nav-text');
  if (navText) navText.textContent = `${phaseLabel} / ${phasePairs.length}`;
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  if (prevBtn) prevBtn.disabled = phaseIdx <= 0;
  if (nextBtn) nextBtn.disabled = phaseIdx >= phasePairs.length - 1;

  renderMetaSection(pair);
  const zugangText = document.getElementById('zugang-text');
  if (zugangText) zugangText.textContent = pair.zugang || '';

  ['geplant','abklaerung','abgeschlossen'].forEach(s => {
    const el = document.getElementById('btn-'+s);
    if (el) el.className = 'status-btn' + (pd.status===s ? ` active-${s}` : '');
  });

  const ca = document.getElementById('comment-area');
  if (ca) ca.value = pd.comment || '';
  renderTagAssignment();
  loadZugangData();
  loadSicherheit();
  loadFelddaten();
  loadSchlagzahlFelder(currentPairId);
  loadSketchFromStorage();
  renderFotos();
  renderChangelog();
  updateTypToggles();
  restoreSectionStates();
  } catch(e) {
    console.error('renderDetail error:', e);
    const dv = document.getElementById('detail-view');
    if (dv) dv.innerHTML = `<div style="padding:20px;color:red;font-family:monospace;font-size:12px;white-space:pre-wrap;background:white;">${e.message}\n\n${e.stack}</div>`;
  }
  isLoading = false;
}

// Nur den Status speichern und Buttons aktualisieren — kein Full-Rerender nötig
function setStatus(s) {
  setPairData(currentPairId, { status: s });
  ['geplant','abklaerung','abgeschlossen'].forEach(v => {
    document.getElementById('btn-'+v).className = 'status-btn' + (v === s ? ` active-${v}` : '');
  });
}

function setZugart(val) {
  ['fremd','sbb-inf','sbb-imm','oeff'].forEach(v => {
    const el = document.getElementById('zugart-' + v);
    if (el) el.classList.toggle('active', v === val);
  });
  document.getElementById('fremd-kontakt-wrap').style.display = val === 'fremd' ? 'block' : 'none';
  if (!isLoading) saveComment();
}

function saveComment() {
  const zugart = ['fremd','sbb-inf','sbb-imm','oeff'].find(v => {
    const el = document.getElementById('zugart-' + v);
    return el && el.classList.contains('active');
  }) || '';
  const kontakt = zugart === 'fremd' ? {
    name:  document.getElementById('fremd-name').value,
    tel:   document.getElementById('fremd-tel').value,
    email: document.getElementById('fremd-email').value,
    kat:   document.getElementById('fremd-kat').value,
    notiz: document.getElementById('fremd-notiz').value,
  } : null;
  setPairData(currentPairId, {
    comment: document.getElementById('comment-area').value,
    zugart,
    kontakt,
  });
  showAutoSaved();
}

async function sendFremdAnfrage() {
  const btn = document.getElementById('anfrage-btn');
  const hint = document.getElementById('anfrage-hint');
  const pair = PAIRS.find(p => p.id === currentPairId);

  // Screenshot der Karte
  btn.textContent = 'Screenshot wird erstellt…';
  btn.disabled = true;
  try {
    const mapEl = document.getElementById('map');
    const canvas = await html2canvas(mapEl, { useCORS: true, allowTaint: true, scale: 1.5 });

    // Bild in Zwischenablage kopieren (Ctrl+V direkt in Mail einfügbar)
    let clipboardOk = false;
    try {
      await new Promise((res, rej) => canvas.toBlob(async blob => {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          clipboardOk = true; res();
        } catch(e) { rej(e); }
      }, 'image/png'));
    } catch(e) {
      // Fallback: als Datei herunterladen
      const filename = `Standort_${pair.id}_${(pair.bezeichnung||'').replace(/[^a-z0-9]/gi,'_')||'RS'+pair.id}.png`;
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = filename;
      a.click();
    }

    // Mailto vorbereiten
    const name  = document.getElementById('fremd-name').value  || 'Eigentümer/in';
    const email = document.getElementById('fremd-email').value || '';
    const kat   = document.getElementById('fremd-kat').value   || '–';
    const bez   = pair.bezeichnung || `Standort ${pair.id}`;
    const km    = pair.km_rs ? `KM ${pair.km_rs.toFixed(3)}` : '';
    const subject = encodeURIComponent(`Nutzungsanfrage Sondage Baugrund – ${bez}`);
    const body = encodeURIComponent(
`Guten Tag ${name}

Im Rahmen der geotechnischen Voruntersuchungen für das Projekt [Projektname] (Bahnstrecke SBB) benötigen wir die Erlaubnis, eine Rammsondierung (RS) bzw. Rammkernsondierung (RKS) auf Ihrer Parzelle durchzuführen.

Standort:    ${bez} ${km}
Parzelle:    ${kat}

Die Untersuchung dient der Erkundung des Baugrunds und hat keine dauerhaften Einwirkungen auf das Grundstück. Die Bohrstellen werden nach Abschluss der Arbeiten sorgfältig rückgebaut.

Einen Lageplan des geplanten Standorts finden Sie im Anhang dieser E-Mail.

Für Rückfragen stehen wir Ihnen gerne zur Verfügung.

Freundliche Grüsse
Gentiana Leci
Geotechnische Voruntersuchungen [Projektname] 2026`
    );
    hint.style.display = 'block';
    hint.innerHTML = clipboardOk
      ? 'Kartenbild in Zwischenablage — E-Mail öffnet sich, bitte mit <strong>Ctrl+V</strong> einfügen.'
      : 'Screenshot heruntergeladen — E-Mail öffnet sich, bitte Bild manuell anhängen.';
    setTimeout(() => { window.location.href = `mailto:${email}?subject=${subject}&body=${body}`; }, 700);
  } catch(e) {
    ui.toast('Screenshot fehlgeschlagen: ' + e.message, 'fehler');
  }
  btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="3,9 12,15 21,9"/></svg> Nutzungsanfrage senden`;
  btn.disabled = false;
}

// Parzellennummer automatisch via AV-API aus RS-Koordinate laden
// force=true: Cache ignorieren und neu abfragen
async function fetchParcelAuto(force) {
  const el = document.getElementById('parzelle-display');
  if (!el) return;
  const pair = PAIRS.find(p => p.id === currentPairId);
  if (!pair) return;

  const pd = getPairData(currentPairId);
  // Cache verwenden – aber SDR-Ergebnisse (nicht-numerische Nummern wie «D15») verwerfen
  const cached = pd.parcelAuto;
  if (!force && cached && /^\d+$/.test(cached.number)) { renderParcelDisplay(cached); return; }

  el.innerHTML = '<span style="color:#9ca3af;font-size:11px;">Laden…</span>';

  try {
    if (!pair.rs?.e || !pair.rs?.n) return;
    const rsLL = lv95ToWgs84(pair.rs.e, pair.rs.n);
    const d = 0.005; // ~500m Bounding Box
    const params = new URLSearchParams({
      geometry:       `${rsLL.lng},${rsLL.lat}`,
      geometryType:   'esriGeometryPoint',
      layers:         'all:ch.swisstopo-vd.amtliche-vermessung',
      mapExtent:      `${rsLL.lng-d},${rsLL.lat-d},${rsLL.lng+d},${rsLL.lat+d}`,
      imageDisplay:   '800,600,96',
      tolerance:      '10',
      sr:             '4326',
      lang:           'de',
      returnGeometry: 'false',
    });
    const res  = await fetch(`https://api.geo.admin.ch/rest/services/ech/MapServer/identify?${params}`);
    const data = await res.json();

    if (!data.results?.length) {
      el.innerHTML = '<span style="color:#9ca3af;font-size:11px;">Keine Parzelle gefunden</span>';
      return;
    }
    // Liegenschaft bevorzugen (rein numerische Nummer); SDR haben Buchstaben wie «D15»
    const hit = data.results.find(r => /^\d+$/.test(r.attributes.number)) ?? data.results[0];
    const a = hit.attributes;
    const parcelAuto = {
      number:        a.number        || a.label || '–',
      egrid:         a.egris_egrid   || '',
      identnd:       a.identnd       || '',
      ak:            a.ak            || '',
      geoportal_url: a.geoportal_url || '',
    };
    setPairData(currentPairId, { parcelAuto });
    renderParcelDisplay(parcelAuto);
  } catch {
    el.innerHTML = '<span style="color:#9ca3af;font-size:11px;">Nicht verfügbar</span>';
  }
}

function renderParcelDisplay(p) {
  const el = document.getElementById('parzelle-display');
  if (!el) return;
  if (!p?.number) { el.innerHTML = '<span style="color:#9ca3af;font-size:11px;">–</span>'; return; }
  const meta = [p.identnd, p.ak].filter(Boolean).join(' · ');
  const link = p.geoportal_url
    ? ` <a href="${p.geoportal_url}" target="_blank" style="color:#3b82f6;font-size:10px;font-weight:600;margin-left:5px;">→ Kantonsplan</a>`
    : '';
  el.innerHTML = `<strong>${p.number}</strong> <span style="color:#9ca3af;font-size:10px;">${meta}</span>${link}`;
}

function loadZugangData() {
  const pd = getPairData(currentPairId);
  fetchParcelAuto(false);
  setZugart(pd.zugart || '');
  if (pd.kontakt) {
    document.getElementById('fremd-name').value  = pd.kontakt.name  || '';
    document.getElementById('fremd-tel').value   = pd.kontakt.tel   || '';
    document.getElementById('fremd-email').value = pd.kontakt.email || '';
    document.getElementById('fremd-kat').value   = pd.kontakt.kat   || '';
    document.getElementById('fremd-notiz').value = pd.kontakt.notiz || '';
  } else {
    ['fremd-name','fremd-tel','fremd-email','fremd-kat','fremd-notiz'].forEach(id => {
      document.getElementById(id).value = '';
    });
  }
}

// ============================================================
// SICHERHEIT
// ============================================================

// Generische Toggle-Funktion für Ja/Nein/k.A.-Schalter
function setToggle(prefix, val) {
  ['ja','nein','ka'].forEach(v => {
    const el = document.getElementById(prefix + '-' + v);
    if (el) el.className = 'siwa-opt' + (v === val.replace('-','') ? ` active-${val}` : '');
  });
}
function setSiwa(val)  { setToggle('siwa',  val); if (!isLoading) saveSicherheit(); }
function setStrom(val) { setToggle('strom', val); if (!isLoading) saveSicherheit(); }
function setSperr(val) {
  setToggle('sperr', val);
  document.getElementById('sperrfenster-row').style.display = val === 'ja' ? 'flex' : 'none';
  if (!isLoading) saveSicherheit();
}
function saveSicherheit() {
  const activePSA = [...document.querySelectorAll('#psa-grid .psa-cb:checked')].map(c => c.value);
  const getVal = prefix => {
    for (const v of ['ja','nein','k-a']) {
      const id = prefix+'-'+(v==='k-a'?'ka':v);
      if (document.getElementById(id)?.className.includes('active')) return v;
    }
    return 'k-a';
  };
  setPairData(currentPairId, { sicherheit: {
    siwa:          getVal('siwa'),
    sperrung:      getVal('sperr'),
    sperrfenster:  document.getElementById('sperrfenster').value,
    strom:         getVal('strom'),
    mindestabstand:document.getElementById('mindestabstand').value,
    psa:           activePSA,
    hinweise:      document.getElementById('sicher-hinweise').value,
  }});
  showAutoSaved();
}

function loadSicherheit() {
  const s = getPairData(currentPairId).sicherheit || {};
  setSiwa(s.siwa || 'k-a');
  setSperr(s.sperrung || 'k-a');
  setStrom(s.strom || 'k-a');
  document.getElementById('sperrfenster').value   = s.sperrfenster   || '';
  document.getElementById('mindestabstand').value = s.mindestabstand || '';
  document.getElementById('sicher-hinweise').value= s.hinweise       || '';
  const activePSA = s.psa || [];
  document.querySelectorAll('#psa-grid .psa-cb').forEach(c => {
    c.checked = activePSA.includes(c.value);
  });
}

// ============================================================
// FELDDATEN
// ============================================================
function switchFeldTab(tab) {
  currentFeldTab = tab;
  ['rs','rks'].forEach(t => {
    const panel = document.getElementById('panel-' + t);
    const tabEl = document.getElementById('tab-' + t);
    if (panel) panel.classList.toggle('active', t === tab);
    if (tabEl) tabEl.className = 'feld-tab' + (t === tab ? (' active-' + t) : '');
  });
  const panelBs = document.getElementById('panel-bs');
  if (panelBs) panelBs.classList.toggle('active', tab === 'bs');
  const tabBs = document.getElementById('tab-bs');
  if (tabBs) tabBs.style.fontWeight = tab === 'bs' ? '700' : '400';
  _schlagTab = tab === 'bs' ? 'rs' : tab;
  schlagRenderTable();
}

function toggleGWDepth(type) {
  const val = document.getElementById(type+'-gw').value;
  document.getElementById(type+'-gw-depth').classList.toggle('visible', val==='ja');
}

function saveFelddaten() {
  const fd = {
    rs_tiefe_ist:  document.getElementById('rs-tiefe-ist').value,
    rs_abbruch:    document.getElementById('rs-abbruch').value,
    rs_gw:         document.getElementById('rs-gw').value,
    rs_gw_tiefe:   document.getElementById('rs-gw-tiefe').value,
    rs_bemerkung:  document.getElementById('rs-bemerkung').value,
    rks_tiefe_ist: document.getElementById('rks-tiefe-ist').value,
    rks_abbruch:   document.getElementById('rks-abbruch').value,
    rks_kerngewinn:document.getElementById('rks-kerngewinn').value,
    rks_gw:        document.getElementById('rks-gw').value,
    rks_gw_tiefe:  document.getElementById('rks-gw-tiefe').value,
    rks_schicht:   document.getElementById('rks-schicht').value,
  };
  setPairData(currentPairId, { felddaten: fd });
  showAutoSaved();
}

function saveBsPanel() {
  const pair = getPairData(currentPairId);
  const existingBs = pair.bs || {};
  const updates = {
    bs: {
      ...existingBs,
      tiefe:    parseFloat(document.getElementById('bs-tiefe-ist')?.value) || null,
      abbruch:  document.getElementById('bs-abbruch')?.value  || '',
      bemerkung:document.getElementById('bs-bemerkung')?.value || '',
    }
  };
  const rsE = parseInt(document.getElementById('bs-rs-e')?.value);
  const rsN = parseInt(document.getElementById('bs-rs-n')?.value);
  if (rsE > 2000000 && rsN > 1000000) updates.rs  = { ...(pair.rs  || {}), e: rsE,  n: rsN  };
  const rksE = parseInt(document.getElementById('bs-rks-e')?.value);
  const rksN = parseInt(document.getElementById('bs-rks-n')?.value);
  if (rksE > 2000000 && rksN > 1000000) updates.rks = { ...(pair.rks || {}), e: rksE, n: rksN };
  setPairData(currentPairId, updates);
  updateFeldTabs();
  showAutoSaved();
}

function loadFelddaten() {
  const fd = getPairData(currentPairId).felddaten || {};
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
  set('rs-tiefe-ist', fd.rs_tiefe_ist);
  set('rs-abbruch', fd.rs_abbruch);
  set('rs-gw', fd.rs_gw || 'nein');
  set('rs-gw-tiefe', fd.rs_gw_tiefe);
  set('rs-bemerkung', fd.rs_bemerkung);
  set('rks-tiefe-ist', fd.rks_tiefe_ist);
  set('rks-abbruch', fd.rks_abbruch);
  set('rks-kerngewinn', fd.rks_kerngewinn);
  set('rks-gw', fd.rks_gw || 'nein');
  set('rks-gw-tiefe', fd.rks_gw_tiefe);
  set('rks-schicht', fd.rks_schicht);
  toggleGWDepth('rs');
  toggleGWDepth('rks');
  // BS Panel
  const pair = getPairData(currentPairId);
  const bs = pair.bs || {};
  set('bs-tiefe-ist', bs.tiefe);
  set('bs-abbruch', bs.abbruch);
  set('bs-bemerkung', bs.bemerkung);
  set('bs-rs-e',  pair.rs?.e  || '');
  set('bs-rs-n',  pair.rs?.n  || '');
  set('bs-rks-e', pair.rks?.e || '');
  set('bs-rks-n', pair.rks?.n || '');
}

// ============================================================
// SCHLAGZAHL PROTOKOLL
// ============================================================
const SCHLAG_KEY = () => 'sp_schlagzahl__' + _activeId;
const SCHLAG_GRENZWERT_KEY = () => 'sp_schlag_grenzwert__' + _activeId;

function schlagSaveGrenzwert(val) {
  const v = parseInt(val) || 50;
  store.setItem(SCHLAG_GRENZWERT_KEY(), v);
  schlagRedrawChart();
}

function schlagLoadGrenzwert() {
  const saved = store.getItem(SCHLAG_GRENZWERT_KEY());
  const val = saved ? parseInt(saved) : 50;
  const el = document.getElementById('schlag-grenzwert');
  if (el) el.value = val;
  return val;
}

let _schlagTab = 'rs'; // aktiver Tab

function loadAllSchlagzahl() {
  try { return jsonParse(store.getItem(SCHLAG_KEY())) || {}; } catch { return {}; }
}
function saveAllSchlagzahl(all) { store.setItem(SCHLAG_KEY(), JSON.stringify(all)); }

function loadSchlagzahlFelder(pairId) {
  const all = loadAllSchlagzahl();
  const d = all[pairId] || {};
  const intervall = d.intervall || '0.3';
  const el = document.getElementById('schlag-intervall');
  if (el) el.value = intervall;
  schlagLoadGrenzwert();
  schlagRenderTable();
  updateSchlagStatusDot(pairId);
}

function switchSchlagTab(tab) {
  _schlagTab = tab;
  ['rs','rks'].forEach(t => {
    const btn = document.getElementById('schlag-tab-' + t);
    if (btn) {
      btn.className = 'feld-tab' + (t === tab ? (t === 'rs' ? ' active-rs' : ' active-rks') : '');
    }
  });
  schlagRenderTable();
}

function schlagUpdateIntervall() {
  if (!currentPairId) return;
  const all = loadAllSchlagzahl();
  const key = currentPairId;
  all[key] = all[key] || {};
  all[key].intervall = document.getElementById('schlag-intervall')?.value || '0.3';
  saveAllSchlagzahl(all);
  schlagRenderTable();
}

function schlagGetData() {
  const all = loadAllSchlagzahl();
  const d = all[currentPairId] || {};
  return {
    intervall: parseFloat(d.intervall || '0.3'),
    rows_rs:   d.rows_rs  || [],
    rows_rks:  d.rows_rks || [],
  };
}

function schlagRenderTable() {
  const wrap = document.getElementById('schlag-table-wrap');
  if (!wrap || !currentPairId) return;

  const d = schlagGetData();
  const intervall = d.intervall;
  const rows = _schlagTab === 'rs' ? d.rows_rs : d.rows_rks;
  const fd = getPairData(currentPairId).felddaten || {};
  const tiefe = parseFloat(_schlagTab === 'rs' ? fd.rs_tiefe_ist : fd.rks_tiefe_ist) || 5;
  const nRows = Math.ceil(tiefe / intervall);
  const intervallLabel = intervall === 0.1 ? 'N10' : intervall === 0.2 ? 'N20' : 'N30';
  const color = _schlagTab === 'rs' ? '#1d4ed8' : '#9d174d';

  while (rows.length < nRows) rows.push({ n: '', bem: '' });

  // Header-Zeile im feld-row Stil
  let html = `<div style="display:flex;gap:6px;margin-bottom:4px;padding:0 2px;">
    <div style="font-size:10px;font-weight:600;color:#9ca3af;min-width:64px;">Tiefe [m]</div>
    <div style="font-size:10px;font-weight:600;color:#9ca3af;width:60px;">${intervallLabel}</div>
    <div style="font-size:10px;font-weight:600;color:#9ca3af;flex:1;">Bemerkung</div>
  </div>`;

  // Zeilen im feld-row Stil
  rows.slice(0, nRows).forEach((row, i) => {
    const depthFrom = (i * intervall).toFixed(2);
    const depthTo   = ((i + 1) * intervall).toFixed(2);
    const overLimit = parseInt(row.n) >= 50;
    html += `<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;padding:2px;border-radius:5px;${i%2===1?'background:#f8fafc;':''}">
      <div style="font-size:11px;color:#6b7280;min-width:64px;">${depthFrom}–${depthTo}</div>
      <input type="number" min="0" max="999" value="${row.n}" placeholder="–"
        oninput="schlagSaveRow(${i},'n',this.value)"
        style="width:60px;padding:5px 6px;border:1px solid ${overLimit?'#fca5a5':'#e5e7eb'};border-radius:6px;font-size:11px;text-align:center;font-family:inherit;background:${overLimit?'#fff1f1':'white'};">
      <input type="text" value="${row.bem||''}" placeholder="–"
        oninput="schlagSaveRow(${i},'bem',this.value)"
        style="flex:1;padding:5px 6px;border:1px solid #e5e7eb;border-radius:6px;font-size:11px;font-family:inherit;background:white;">
    </div>`;
  });

  html += `<div style="display:flex;gap:6px;margin-top:8px;">
    <button onclick="schlagAddRow()" style="padding:5px 10px;border-radius:6px;border:1px solid #e5e7eb;background:white;font-size:11px;cursor:pointer;color:#374151;">+ Zeile</button>
    <button onclick="schlagRemoveRow()" style="padding:5px 10px;border-radius:6px;border:1px solid #e5e7eb;background:white;font-size:11px;cursor:pointer;color:#dc2626;">− Zeile</button>
    <button onclick="schlagToggleChart()" style="margin-left:auto;padding:5px 10px;border-radius:6px;border:1px solid ${color};background:white;font-size:11px;cursor:pointer;color:${color};">Diagramm</button>
  </div>`;

  wrap.innerHTML = html;
  schlagRedrawChart();
}

function schlagSaveRow(idx, field, val) {
  if (!currentPairId) return;
  const all = loadAllSchlagzahl();
  const key = currentPairId;
  all[key] = all[key] || { intervall: '0.3', rows_rs: [], rows_rks: [] };
  const rowsKey = _schlagTab === 'rs' ? 'rows_rs' : 'rows_rks';
  while (all[key][rowsKey].length <= idx) all[key][rowsKey].push({ n: '', bem: '' });
  all[key][rowsKey][idx][field] = val;
  saveAllSchlagzahl(all);
  // Rot markieren bei ≥50
  if (field === 'n') {
    const input = document.querySelectorAll('.schlag-table tbody tr')[idx]?.querySelectorAll('input')[0];
    if (input) input.style.background = parseInt(val) >= 50 ? '#fee2e2' : '';
  }
  schlagRedrawChart();
  updateSchlagStatusDot(currentPairId);
}

function schlagAddRow() {
  if (!currentPairId) return;
  const all = loadAllSchlagzahl();
  const key = currentPairId;
  all[key] = all[key] || { intervall: '0.3', rows_rs: [], rows_rks: [] };
  const rowsKey = _schlagTab === 'rs' ? 'rows_rs' : 'rows_rks';
  all[key][rowsKey].push({ n: '', bem: '' });
  saveAllSchlagzahl(all);
  schlagRenderTable();
}

function schlagRemoveRow() {
  if (!currentPairId) return;
  const all = loadAllSchlagzahl();
  const key = currentPairId;
  if (!all[key]) return;
  const rowsKey = _schlagTab === 'rs' ? 'rows_rs' : 'rows_rks';
  if (all[key][rowsKey]?.length > 0) all[key][rowsKey].pop();
  saveAllSchlagzahl(all);
  schlagRenderTable();
}

function schlagToggleChart() {
  const wrap = document.getElementById('schlag-chart-wrap');
  if (!wrap) return;
  wrap.style.display = wrap.style.display === 'none' ? '' : 'none';
  if (wrap.style.display !== 'none') schlagRedrawChart();
}

function schlagRedrawChart() {
  const canvas = document.getElementById('schlag-chart-canvas');
  const wrap   = document.getElementById('schlag-chart-wrap');
  if (!canvas || !wrap || wrap.style.display === 'none') return;

  const d = schlagGetData();
  const rows = (_schlagTab === 'rs' ? d.rows_rs : d.rows_rks).filter(r => r.n !== '');
  if (rows.length === 0) { wrap.style.display = 'none'; return; }

  const grenzwert = parseInt(document.getElementById('schlag-grenzwert')?.value) || parseInt(store.getItem(SCHLAG_GRENZWERT_KEY())) || 50;
  const intervall = d.intervall;
  const color     = _schlagTab === 'rs' ? '#2563eb' : '#9d174d';
  const maxN      = Math.max(grenzwert + 5, ...rows.map(r => parseInt(r.n) || 0));

  const dpr   = window.devicePixelRatio || 1;
  const rowH  = 20;
  const barH  = 10; // schlanke Balken
  const padL  = 44, padR = 32, padT = 22, padB = 18;
  const cssW  = canvas.parentElement?.offsetWidth || 280;
  const cssH  = rows.length * rowH + padT + padB;

  // Hochauflösend rendern
  canvas.width  = cssW  * dpr;
  canvas.height = cssH  * dpr;
  canvas.style.width  = cssW  + 'px';
  canvas.style.height = cssH  + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  const plotW = cssW - padL - padR;

  // Hintergrund
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, cssW, cssH);

  // Gitterlinien X
  const gridVals = [0, 10, 20, 30, 50, 75, 100].filter(v => v <= maxN);
  gridVals.forEach(v => {
    const x = padL + (v / maxN) * plotW;
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 0.5 / dpr;
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, cssH - padB); ctx.stroke();
    ctx.fillStyle = '#9ca3af'; ctx.font = `${9}px -apple-system,sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(v, x, padT - 6);
  });

  // Grenzwert-Linie
  const gx = padL + (grenzwert / maxN) * plotW;
  ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(gx, padT); ctx.lineTo(gx, cssH - padB); ctx.stroke();
  ctx.setLineDash([]);

  // Balken + Tiefenachse
  rows.forEach((row, i) => {
    const n     = parseInt(row.n) || 0;
    const cy    = padT + i * rowH + rowH / 2; // Mittelachse der Zeile
    const barW  = (n / maxN) * plotW;
    const barY  = cy - barH / 2;
    const depthFrom = (i * intervall).toFixed(1);

    // Balken
    ctx.fillStyle   = n >= grenzwert ? '#fca5a5' : color + 'cc';
    ctx.strokeStyle = n >= grenzwert ? '#dc2626' : color;
    ctx.lineWidth   = 0.5;
    ctx.beginPath();
    const r = 2;
    ctx.roundRect ? ctx.roundRect(padL, barY, Math.max(barW, 0), barH, r)
                  : ctx.rect(padL, barY, Math.max(barW, 0), barH);
    ctx.fill(); ctx.stroke();

    // Schlagzahl
    if (n > 0) {
      ctx.fillStyle = n >= grenzwert ? '#b91c1c' : '#1e3a5f';
      ctx.font = `600 10px -apple-system,sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(n, padL + barW + 4, cy + 4);
    }

    // Tiefe Y-Achse
    ctx.fillStyle = '#6b7280'; ctx.font = `9px -apple-system,sans-serif`; ctx.textAlign = 'right';
    ctx.fillText(depthFrom, padL - 5, cy + 3.5);
  });

  // Letzte Tiefe
  const lastCy = padT + rows.length * rowH;
  ctx.fillStyle = '#6b7280'; ctx.font = `9px -apple-system,sans-serif`; ctx.textAlign = 'right';
  ctx.fillText((rows.length * intervall).toFixed(1), padL - 5, lastCy + 3.5);

  // Y-Achse
  ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 0.75;
  ctx.beginPath(); ctx.moveTo(padL, padT - 4); ctx.lineTo(padL, cssH - padB); ctx.stroke();
}

function updateSchlagStatusDot(pairId) {
  const dot = document.getElementById('schlag-status-dot');
  if (!dot) return;
  const all = loadAllSchlagzahl();
  const d = all[pairId] || {};
  const hasData = (d.rows_rs?.some(r => r.n !== '') || d.rows_rks?.some(r => r.n !== ''));
  dot.innerHTML = hasData
    ? '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#16a34a;"></span>'
    : '';
}

// ── Schlagzahl PDF Export (Einzeln) ──────────────────────────
async function schlagExportPdf() {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) { ui.toast('PDF-Bibliothek nicht verfügbar.', 'fehler'); return; }
  await schlagBuildPdf([currentPairId], true);
}

// ── Serienplot (aus Liste) ────────────────────────────────────
async function schlagSerienplotPdf() {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) { ui.toast('PDF-Bibliothek nicht verfügbar.', 'fehler'); return; }
  const allSz = loadAllSchlagzahl();
  // Nur Standorte mit Schlagzahldaten
  const pairIds = PAIRS
    .filter(p => allSz[p.id]?.rows_rs?.some(r => r.n !== '') || allSz[p.id]?.rows_rks?.some(r => r.n !== ''))
    .map(p => p.id);
  if (pairIds.length === 0) { ui.toast('Keine Schlagzahldaten vorhanden.', 'fehler'); return; }
  await schlagBuildPdf(pairIds, false);
}

async function schlagBuildPdf(pairIds, single) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const projekt = loadProjectsMeta().find(p => p.id === _activeId);

  for (let pi = 0; pi < pairIds.length; pi++) {
    if (pi > 0) doc.addPage();
    const pairId = pairIds[pi];
    const pair   = PAIRS.find(p => p.id === pairId) || {};
    const fd     = getPairData(pairId).felddaten || {};
    const all    = loadAllSchlagzahl();
    const d      = all[pairId] || {};
    const intervall = parseFloat(d.intervall || '0.3');
    const intervallLabel = intervall === 0.1 ? 'N10' : intervall === 0.2 ? 'N20' : 'N30';

    // Header
    doc.setFillColor(26,58,92); doc.rect(0,0,210,20,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(12); doc.setFont(undefined,'bold');
    doc.text('Rammsondierprotokoll', 14, 10);
    doc.setFontSize(9); doc.setFont(undefined,'normal');
    doc.text(`${projekt?.name || ''} · ${standortName(pair)} · KM ${pair.km_rs ? parseFloat(pair.km_rs).toFixed(3) : '—'}`, 14, 16);

    let y = 26;
    doc.setTextColor(0,0,0); doc.setFontSize(8);

    // Kopfdaten
    const info = [
      ['Bezeichnung', pair.bezeichnung || '—'],
      ['Koordinaten RS', pair.rs?.e ? `E ${pair.rs.e} / N ${pair.rs.n}` : '—'],
      ['Tiefe Ist RS', fd.rs_tiefe_ist ? `${fd.rs_tiefe_ist} m` : '—'],
      ['Abbruchgrund RS', fd.rs_abbruch || '—'],
      ['Grundwasser RS', fd.rs_gw === 'ja' ? `Ja, bei ${fd.rs_gw_tiefe || '?'} m` : 'Nein'],
      ['Intervall', `${(intervall*100).toFixed(0)} cm (${intervallLabel})`],
    ];
    info.forEach(([label, val]) => {
      doc.setFont(undefined,'bold'); doc.text(label + ':', 14, y);
      doc.setFont(undefined,'normal'); doc.text(String(val), 70, y);
      y += 5;
    });
    y += 3;

    // Tabellen RS + RKS nebeneinander
    const grenzwert = parseInt(document.getElementById('schlag-grenzwert')?.value) || parseInt(store.getItem(SCHLAG_GRENZWERT_KEY())) || 50;

    for (const typ of ['rs','rks']) {
      if (y > 250) { doc.addPage(); y = 20; }
      const rows = (typ === 'rs' ? d.rows_rs : d.rows_rks) || [];
      const tiefe = parseFloat(typ === 'rs' ? fd.rs_tiefe_ist : fd.rks_tiefe_ist) || 0;
      if (tiefe === 0 && rows.filter(r => r.n !== '').length === 0) continue;

      const typColor = typ === 'rs' ? [29,78,216] : [157,23,77];
      doc.setFont(undefined,'bold'); doc.setFontSize(9);
      doc.setTextColor(...typColor);
      doc.text(typ.toUpperCase(), 14, y); y += 4;
      doc.setTextColor(0,0,0); doc.setFontSize(8);

      // Tabellenkopf
      doc.setFillColor(26,58,92); doc.setTextColor(255,255,255);
      doc.rect(14, y, 35, 5, 'F'); doc.text('Tiefe [m]', 16, y+3.5);
      doc.rect(49, y, 25, 5, 'F'); doc.text(intervallLabel, 51, y+3.5);
      doc.rect(74, y, 130, 5, 'F'); doc.text('Bemerkung', 76, y+3.5);
      y += 5;
      doc.setTextColor(0,0,0);

      rows.filter(r => r.n !== '').forEach((row, i) => {
        const from = (i * intervall).toFixed(2);
        const to   = ((i+1)*intervall).toFixed(2);
        const n    = parseInt(row.n) || 0;
        if (n >= grenzwert) { doc.setFillColor(254,226,226); doc.rect(14, y-3.5, 190, 5, 'F'); }
        else if (i % 2 === 0) { doc.setFillColor(248,250,252); doc.rect(14, y-3.5, 190, 5, 'F'); }
        doc.setFont(undefined,'normal');
        doc.text(`${from}–${to}`, 16, y);
        doc.setFont(undefined, n >= grenzwert ? 'bold' : 'normal');
        doc.setTextColor(n >= grenzwert ? 220 : 0, n >= grenzwert ? 38 : 0, n >= grenzwert ? 38 : 0);
        doc.text(String(n), 51, y);
        doc.setTextColor(0,0,0); doc.setFont(undefined,'normal');
        doc.text(row.bem || '', 76, y);
        y += 5;
        if (y > 270) { doc.addPage(); y = 20; }
      });

      // Schlagzahldiagramm
      if (y + 60 < 270) {
        y += 4;
        const chartRows = rows.filter(r => r.n !== '');
        if (chartRows.length > 0) {
          const maxN = Math.max(grenzwert + 5, ...chartRows.map(r => parseInt(r.n) || 0));
          const chartX = 14, chartW = 120, rowH = 4;
          const chartH = chartRows.length * rowH;
          // Grenzwert-Linie
          const gx = chartX + (grenzwert / maxN) * chartW;
          doc.setDrawColor(245,158,11); doc.setLineWidth(0.3);
          doc.line(gx, y, gx, y + chartH);
          // Balken
          chartRows.forEach((row, i) => {
            const n = parseInt(row.n) || 0;
            const barW = (n / maxN) * chartW;
            const ry = y + i * rowH;
            if (n >= grenzwert) doc.setFillColor(252,165,165);
            else doc.setFillColor(typ === 'rs' ? 37 : 157, typ === 'rs' ? 99 : 23, typ === 'rs' ? 235 : 77);
            doc.rect(chartX, ry + 0.5, barW, rowH - 1, 'F');
          });
          y += chartH + 6;
        }
      }
      y += 4;
    }
  }

  const datum = new Date().toLocaleDateString('de-CH').replace(/\./g,'-');
  const fname = single
    ? `Schlagzahl_Mast${PAIRS.find(p=>p.id===pairIds[0])?.mast||'X'}_${datum}.pdf`
    : `Serienplot_${projekt?.name||'Projekt'}_${datum}.pdf`;
  doc.save(fname);
}

// ============================================================
// RS/RKS AKTIV SCHALTEN
// ============================================================
function setTypAktiv(typ, aktiv) {
  const pd = getPairData(currentPairId);
  const state = pd.typAktiv || { rs: true, rks: true };
  state[typ] = aktiv;
  setPairData(currentPairId, { typAktiv: state });
  logChange(currentPairId, typ.toUpperCase() + ' Status', aktiv ? 'Aktiv' : 'Passiv');

  // Toggle-Optik + Metadaten + Felddaten-Tabs aktualisieren
  updateTypToggles();
  const pair = PAIRS.find(p => p.id === currentPairId);
  if (pair) { renderMetaSection(pair); addMarkers(pair); }
  renderCards();
}

function toggleTyp(typ) {
  const pd = getPairData(currentPairId);
  const state = pd.typAktiv || { rs: true, rks: true };
  setTypAktiv(typ, state[typ] === false);
}

function updateTypToggles() {
  const pair = PAIRS.find(p => p.id === currentPairId);
  if (!pair) return;

  const hasRS  = !!(pair.rs?.e  && pair.rs?.n);
  const hasRKS = !!(pair.rks?.e && pair.rks?.n);
  const hasBS  = !!(pair.bs?.e  && pair.bs?.n);
  const total  = [hasRS, hasRKS, hasBS].filter(Boolean).length;

  // Zellen (Tab + ✕-Button) ein-/ausblenden
  const cellRs  = document.getElementById('tabcell-rs');
  const cellRks = document.getElementById('tabcell-rks');
  const cellBs  = document.getElementById('tabcell-bs');
  const tabAdd  = document.getElementById('tab-add-sondage');

  if (cellRs)  cellRs.style.display  = hasRS  ? '' : 'none';
  if (cellRks) cellRks.style.display = hasRKS ? '' : 'none';
  if (cellBs)  cellBs.style.display  = hasBS  ? '' : 'none';

  // ✕-Buttons nur zeigen wenn mehr als eine Sondage vorhanden (min. eine muss bleiben)
  ['rs','rks','bs'].forEach(t => {
    const del = document.getElementById('tab-del-' + t);
    if (del) del.style.display = total > 1 ? '' : 'none';
  });

  // + Tab zeigen wenn mindestens eine Sondage fehlt (Baugrund-Phase)
  if (tabAdd) tabAdd.style.display = (_activePhase === 'baugrund' && (!hasRS || !hasRKS)) ? '' : 'none';

  // Auf einen vorhandenen Tab wechseln falls aktueller nicht mehr vorhanden
  if (currentFeldTab === 'rs'  && !hasRS)  switchFeldTab(hasRKS ? 'rks' : hasBS ? 'bs' : 'rs');
  if (currentFeldTab === 'rks' && !hasRKS) switchFeldTab(hasRS  ? 'rs'  : hasBS ? 'bs' : 'rs');
  if (currentFeldTab === 'bs'  && !hasBS)  switchFeldTab(hasRS  ? 'rs'  : 'rks');
}

async function confirmDeleteSondage(type) {
  const pair = PAIRS.find(p => p.id === currentPairId);
  if (!pair) return;
  const total = [pair.rs, pair.rks, pair.bs].filter(p => p?.e && p?.n).length;
  if (total <= 1) {
    ui.toast('Mindestens eine Sondage muss erhalten bleiben.\nUm den gesamten Standort zu löschen, nutze den Löschen-Knopf in den Metadaten.', 'fehler');
    return;
  }
  const label = type.toUpperCase();
  if (!await ui.confirm(`${label} wirklich entfernen?\nAlle Felddaten (Tiefe, Abbruchgrund usw.) für diesen Punkt gehen verloren.`)) return;
  deleteSondageType(type);
}

function deleteSondageType(type) {
  const pair = PAIRS.find(p => p.id === currentPairId);
  if (!pair) return;
  pushUndo();
  pair[type] = null;
  savePairs();
  logChange(currentPairId, type.toUpperCase() + ' entfernt', 'Sondage gelöscht');
  updateTypToggles();
  renderMetaSection(pair);
  addMarkers(pair);
  renderCards();
}

// ============================================================
