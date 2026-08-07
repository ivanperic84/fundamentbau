// OVERVIEW VIEWS: Karten / Liste / Karte
// ============================================================
let currentOverviewView = 'karten';
let overviewMap = null;
let overviewMarkers = [];

// Farbgebung Massnahme für Fundamentstandorte
function getMassnahmeColor(bpData) {
  if (bpData.bestand === 'prov' || (bpData.fundtyp || '').startsWith('spezial-prov')) return '#16a34a';
  // Massnahme nur auswerten wenn bestand==='bestand' (sonst veraltete Werte ignorieren)
  if (bpData.bestand === 'bestand') {
    if (bpData.massnahme === 'abbruch')     return '#ca8a04'; // amber
    if (bpData.massnahme === 'abbruch-nur') return '#ca8a04'; // amber
    if (bpData.massnahme === 'sicherung')   return '#6b8c7a'; // grau-grün
    return '#6b7280'; // erhalten / kein Eingriff
  }
  return '#dc2626'; // Neubau (bestand='neu' oder leer)
}
function getMassnahmeLabel(bpData) {
  if (bpData.bestand === 'prov' || (bpData.fundtyp || '').startsWith('spezial-prov')) return 'Provisorium';
  if (bpData.bestand === 'bestand') {
    if (bpData.massnahme === 'abbruch')     return 'Abbruch & Neubau';
    if (bpData.massnahme === 'abbruch-nur') return 'Abbruch';
    if (bpData.massnahme === 'sicherung')   return 'Sicherung';
    return 'Erhalten';
  }
  return 'Neubau';
}
let overviewGpsMarker = null, overviewGpsCircle = null, overviewWatchId = null;

// Übersichtskarte: aktive Basis-Karte
let overviewBaseLayer = null;
let overviewBaseLayerKey = 'swiss-luft';

let overviewMapOpacity = 0.75; // 0..1

function setOverviewMapOpacity(pct, btnIdx) {
  overviewMapOpacity = pct / 100;
  if (overviewBaseLayer) overviewBaseLayer.setOpacity(overviewMapOpacity);
  // Legacy button support
  for (let i = 1; i <= 4; i++) {
    const b = document.getElementById('ov-op-btn-' + i);
    if (b) b.classList.toggle('active', i === btnIdx);
  }
}

function setOverviewOpacityFromSelect(val) {
  setOverviewMapOpacity(parseInt(val), null);
}

let _detailMapOpacity = 75;

function setDetailOpacityFromSelect(val) {
  const pct = parseInt(val);
  _detailMapOpacity = pct;
  setMapOpacity(pct, null);
}

// ── Karten-Kontextmenü ────────────────────────────────────────
let _mapCtxTarget = null; // 'detail' | 'overview'
let _mapCtxLatlng = null;

function showMapCtxMenu(target, latlng, clientX, clientY) {
  _mapCtxTarget = target;
  _mapCtxLatlng = latlng;
  const isDetail  = target === 'detail';
  const curBase   = isDetail ? detailBaseLayerKey : overviewBaseLayerKey;
  const curOp     = isDetail ? _detailMapOpacity : Math.round(overviewMapOpacity * 100);

  const bases = [
    { key:'swiss-luft',  label:'Luftbild' },
    { key:'swiss-karte', label:'swisstopo' },
    { key:'umwelt',      label:'Umwelt' },
  ];
  const btnS  = 'display:block;width:100%;text-align:left;padding:6px 10px;border:none;background:none;font-size:12px;font-family:inherit;cursor:pointer;border-radius:6px;color:#374151;';
  const sBtnS = btnS + 'font-weight:700;color:#1a3a5c;background:#eff6ff;';
  const opBtnS = (active) => `padding:5px 0;border:1px solid ${active?'#1a3a5c':'#e5e7eb'};border-radius:6px;font-size:11px;font-family:inherit;cursor:pointer;font-weight:${active?'700':'400'};background:${active?'#1a3a5c':'white'};color:${active?'white':'#374151'};`;

  const menu = document.getElementById('map-ctx-menu');
  menu.innerHTML = `
    <div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;padding:4px 10px 2px;">Kartenart</div>
    ${bases.map(b =>
      `<button style="${curBase===b.key?sBtnS:btnS}" onmouseenter="this.style.background='${curBase===b.key?'#dbeafe':'#f9fafb'}'" onmouseleave="this.style.background='${curBase===b.key?'#eff6ff':'none'}'" onclick="mapCtxSetBase('${b.key}')">
        ${curBase===b.key?`<svg style="display:inline;vertical-align:middle;margin-right:4px;" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1a3a5c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`:'<span style="display:inline-block;width:14px;"></span>'}${b.label}
      </button>`
    ).join('')}
    <div style="height:1px;background:#f3f4f6;margin:5px 0;"></div>
    <div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em;padding:2px 10px 4px;">Transparenz</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:2px 10px 4px;">
      ${[25,50,75,100].map(p =>
        `<button style="${opBtnS(curOp===p)}" onclick="mapCtxSetOpacity(${p})">${p}%</button>`
      ).join('')}
    </div>
    ${isDetail ? `
    <div style="height:1px;background:#f3f4f6;margin:5px 0;"></div>
    <button style="${parcelQueryActive?sBtnS:btnS}" onmouseenter="this.style.background='${parcelQueryActive?'#dbeafe':'#f9fafb'}'" onmouseleave="this.style.background='${parcelQueryActive?'#eff6ff':'none'}'" onclick="mapCtxToggleInfo()">
      ${parcelQueryActive?`<svg style="display:inline;vertical-align:middle;margin-right:4px;" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1a3a5c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`:'<span style="display:inline-block;width:14px;"></span>'}Info-Abfrage
    </button>
    <button style="${btnS}" onmouseenter="this.style.background='#f9fafb'" onmouseleave="this.style.background='none'" onclick="mapCtxPlaceText()">
      <span style="display:inline-block;width:14px;"></span>Text setzen
    </button>` : ''}`;

  const mw = 200, mh = isDetail ? 270 : 200;
  menu.style.left    = Math.min(clientX, window.innerWidth  - mw - 10) + 'px';
  menu.style.top     = Math.min(clientY, window.innerHeight - mh - 10) + 'px';
  menu.style.display = '';

  setTimeout(() => {
    function _mCtxOut(e) {
      const m = document.getElementById('map-ctx-menu');
      if (m && !m.contains(e.target)) {
        hideMapCtxMenu();
        document.removeEventListener('click', _mCtxOut, true);
      }
    }
    document.addEventListener('click', _mCtxOut, true);
  }, 0);
}

function hideMapCtxMenu() {
  const m = document.getElementById('map-ctx-menu');
  if (m) m.style.display = 'none';
}

function mapCtxSetBase(key) {
  if (_mapCtxTarget === 'detail') setDetailBaseLayer(key);
  else setOverviewBaseLayer(key);
  hideMapCtxMenu();
}

function mapCtxSetOpacity(pct) {
  if (_mapCtxTarget === 'detail') {
    setDetailOpacityFromSelect(String(pct));
    const sel = document.getElementById('detail-opacity-select');
    if (sel) sel.value = String(pct);
  } else {
    setOverviewOpacityFromSelect(String(pct));
    const sel = document.getElementById('ov-opacity-select');
    if (sel) sel.value = String(pct);
  }
  hideMapCtxMenu();
}

function mapCtxToggleInfo() {
  toggleParcelQuery();
  hideMapCtxMenu();
}

function mapCtxPlaceText() {
  hideMapCtxMenu();
  if (!leafletMap || !_mapCtxLatlng) return;
  if (currentMode !== 'draw') setMode('draw');
  setTool('text');
  const canvasPos = latLngToCanvasPos(L.latLng(_mapCtxLatlng.lat, _mapCtxLatlng.lng));
  textInputLatlng  = { lat: _mapCtxLatlng.lat, lng: _mapCtxLatlng.lng };
  textInputPending = true;
  editingTextIdx   = -1;
  editingTextBackup = null;
  showTextInputAt(canvasPos, '', currentColor, fontSizeFromBrush());
}

let _overviewInfoLayer = 'status';
let _bpLayerFilter  = { schichtNr: null, datum: null, mast: '' };
let _bauablaufDatum  = null;   // aktuell gewähltes Datum im Schieber (YYYY-MM-DD)
let _bauablaufTyp    = 'baustart'; // 'baustart' | 'ausschaltermin'
let _bauablaufDaten  = [];    // aktuell angezeigte Datumsliste (für Slider)

// ── Übersichtskarte: Info-Layer Optionen je Phase ──────────────
const OV_INFO_OPTIONS = {
  baugrund: [
    { value:'status',         label:'Status' },
    { value:'bodenkennwerte', label:'Bodenkennwerte' },
    { value:'naturschutz',    label:'Umweltschutz' },
    { value:'tags',           label:'Tags' },
  ],
  bauprojekt: [
    { value:'massnahme',  label:'Massnahme' },
    { value:'fundtyp',    label:'Fundamenttyp' },
    { value:'status',     label:'Status' },
    { value:'abnahme',    label:'Abnahme' },
  ],
  ausfuehrung: [
    { value:'massnahme',   label:'Massnahme' },
    { value:'fundtyp',     label:'Fundamenttyp' },
    { value:'baupaket',    label:'Baupaket / Schicht' },
    { value:'bauablauf',   label:'Bauablauf' },
    { value:'status',      label:'Status' },
    { value:'abnahme',     label:'Abnahme' },
  ],
};

function setOverviewInfoLayer(val) {
  if (val !== 'baupaket') _bpLayerFilter = { schichtNr: null, datum: null, mast: '' };
  if (val !== 'bauablauf') _bauablaufDatum = null;
  _overviewInfoLayer = val;
  const sel = document.getElementById('ov-layer-select');
  if (sel && sel.value !== val) sel.value = val;
  refreshOverviewMarkerLabels();
}

function setBpLayerFilter(key, val) {
  if (key === '_reset') _bpLayerFilter = { schichtNr: null, datum: null, mast: '' };
  else _bpLayerFilter[key] = val;
  refreshBpMapHighlight();
  updateOverviewLegend('baupaket');
}

// ── Abnahme-Status pro Standort (aus Checkliste) ──────────────
function getAbnahmeStatus(pairId) {
  const ck = (typeof loadAllChecklisten === 'function' ? loadAllChecklisten() : {})[pairId] || {};
  const pts = typeof CK_PRUEFPUNKTE !== 'undefined' ? CK_PRUEFPUNKTE : [];
  const touched = pts.filter(p => ck[`ck_${p.id}_ok`]);
  if (!touched.length) return 'ausstehend';
  if (pts.some(p => ck[`ck_${p.id}_ok`] === 'mangel')) return 'maengel';
  if (pts.every(p => ck[`ck_${p.id}_ok`] === 'ok'))    return 'abgenommen';
  return 'teilweise';
}

// ── Einheitliche Farbgebung für alle Info-Layer ────────────────
function getOvColor(pairId, mode) {
  const FUND_COL = { 'DP1a':'#2563eb', 'DP2a':'#0ea5e9', 'HP1a':'#ea580c', 'HP2a':'#d97706' };
  if (mode === 'status') {
    const s = getPairData(pairId).status || 'geplant';
    return s === 'abklaerung' ? '#d97706' : s === 'abgeschlossen' ? '#059669' : '#6b7280';
  }
  if (mode === 'massnahme') {
    return getMassnahmeColor(loadAllBauprojekt()[pairId] || {});
  }
  if (mode === 'fundtyp') {
    const t = (loadAllBauprojekt()[pairId] || {}).fundtyp || '';
    if (!t) return '#9ca3af';
    if (isFtSpezial(t)) return '#7c3aed';
    return FUND_COL[t] || '#6b7280';
  }
  if (mode === 'bodenkennwerte') {
    const bp = loadAllBauprojekt()[pairId] || {};
    const me = parseFloat(bp.bkMe), phi = parseFloat(bp.bkPhi);
    if (isNaN(me) && isNaN(phi)) return '#9ca3af';
    const normBt = (bp.bkBodentyp === 'fein' || bp.bkBodentyp === 'grob') ? bp.bkBodentyp : _uscsToBodentyp(bp.bkBodentyp);
    const grenz = BK_GRENZWERTE[normBt] || BK_GRENZWERTE.fein;
    return ((!isNaN(me) ? me >= grenz.me : true) && (!isNaN(phi) ? phi >= 27 : true)) ? '#059669' : '#dc2626';
  }
  if (mode === 'naturschutz') {
    const ns = loadAllNaturschutz()[pairId] || {};
    return (ns.bln || ns.nsg || ns.gewaesser || ns.wald) ? '#dc2626' : '#059669';
  }
  if (mode === 'abnahme') {
    const s = getAbnahmeStatus(pairId);
    return s === 'abgenommen' ? '#059669' : s === 'maengel' ? '#dc2626' : s === 'teilweise' ? '#d97706' : '#9ca3af';
  }
  if (mode === 'baupaket') {
    const z = (typeof loadSchichtZuw === 'function' ? loadSchichtZuw() : {})[pairId];
    if (!z?.paketId) return '#d1d5db';
    const pak = (typeof loadBaupakete === 'function' ? loadBaupakete() : []).find(p => p.id === z.paketId);
    return pak?.farbe || '#6b7280';
  }
  if (mode === 'bauablauf') {
    const z = (typeof loadSchichtZuw === 'function' ? loadSchichtZuw() : {})[pairId];
    if (!z?.paketId) return '#d1d5db';
    const pak = (typeof loadBaupakete === 'function' ? loadBaupakete() : []).find(p => p.id === z.paketId);
    if (!_bauablaufDatum) return pak?.farbe || '#6b7280';
    const posDate = _bauablaufGetDatum(pairId, _bauablaufTyp);
    if (!posDate) return '#d1d5db';
    return posDate <= _bauablaufDatum ? (pak?.farbe || '#6b7280') : '#d1d5db';
  }
  if (mode === 'tags') {
    return (getPairData(pairId).tags?.length) ? '#7c3aed' : '#9ca3af';
  }
  return '#9ca3af';
}

// Kurzbeschriftung auf dem Marker je Info-Layer
function getOvIconLabel(pair, mode, defaultLabel) {
  const pairId = pair.id;
  if (mode === 'fundtyp') {
    const t = (loadAllBauprojekt()[pairId] || {}).fundtyp || '';
    return !t ? (defaultLabel || '?') : isFtSpezial(t) ? 'S' : t.substring(0, 4);
  }
  if (mode === 'abnahme') {
    const s = getAbnahmeStatus(pairId);
    return s === 'abgenommen' ? '✓' : s === 'maengel' ? '!' : s === 'teilweise' ? '½' : '–';
  }
  if (mode === 'baupaket' || mode === 'bauablauf') {
    const z = (typeof loadSchichtZuw === 'function' ? loadSchichtZuw() : {})[pairId];
    return z?.schichtNr ? 'S' + z.schichtNr : '–';
  }
  // Für alle anderen Modi: Standard-Label (RS/RKS oder Mastnummer)
  return defaultLabel || '?';
}

function _bauablaufGetDatum(pairId, typ) {
  const zuw = (typeof loadSchichtZuw === 'function' ? loadSchichtZuw() : {})[pairId];
  if (!zuw?.paketId || zuw.schichtNr == null) return null;
  const pak = (typeof loadBaupakete === 'function' ? loadBaupakete() : []).find(p => p.id === zuw.paketId);
  if (!pak) return null;
  const schicht = bpGetSchichten(pak).find(s => s.schichtNr === zuw.schichtNr);
  if (!schicht) return null;
  if (typ === 'ausschaltermin') {
    const tage = (typeof loadProjEinst === 'function' ? loadProjEinst() : {}).ausschalfristTage || 7;
    return bpFmtDate(bpAddDays(bpParseDate(schicht.datum), tage));
  }
  return schicht.datum;
}

function _bauablaufSlider(inputEl) {
  const idx = parseInt(inputEl.value);
  _bauablaufDatum = idx < _bauablaufDaten.length ? _bauablaufDaten[idx] : null;
  // Label aktualisieren ohne Legende neu zu rendern (verhindert Snapping)
  const lbl = document.getElementById('ba-slider-lbl');
  if (lbl) {
    if (_bauablaufDatum) {
      const [y,m,dd] = _bauablaufDatum.split('-');
      lbl.textContent = `${dd}.${m}.`;
    } else {
      lbl.textContent = 'Alle';
    }
  }
  // Balken-Farben + Zahl in-place aktualisieren (3 Zustände)
  document.querySelectorAll('[data-ba-bar]').forEach(el => {
    const i         = parseInt(el.getAttribute('data-ba-bar'));
    const d         = _bauablaufDaten[i];
    const isCurrent = d === _bauablaufDatum;
    const isPast    = _bauablaufDatum && d < _bauablaufDatum;
    const bg = !_bauablaufDatum ? '#1a3a5c'
             : isCurrent        ? '#1a3a5c'
             : isPast            ? '#94a3b8'
             :                    '#dde1e7';
    const inner    = el.querySelector('[data-ba-inner]');
    const countLbl = el.querySelector('[data-ba-lbl]');
    if (inner) inner.style.background = bg;
    if (countLbl) {
      countLbl.style.visibility = isCurrent ? 'visible' : 'hidden';
      if (isCurrent) countLbl.textContent = el.getAttribute('data-ba-count');
    }
  });
  // Nur Marker aktualisieren, Legende nicht neu rendern
  refreshOverviewMarkerLabels(true);
}

function _bauablaufSetTyp(typ) {
  _bauablaufTyp = typ;
  _bauablaufDatum = null;
  refreshOverviewMarkerLabels();
  updateOverviewLegend('bauablauf');
}

function refreshOverviewMarkerLabels(skipLegend) {
  const mode       = _overviewInfoLayer || 'status';
  if (!overviewMap || !overviewMarkers?.length) { if (!skipLegend) updateOverviewLegend(mode); return; }
  const isBG       = _activePhase === 'baugrund';
  const isBpMode   = mode === 'baupaket';
  const isBaMode   = mode === 'bauablauf';
  const f          = _bpLayerFilter;
  const activePakId = _bpFsHighlightPaket || _bpHighlightPaketId;
  const needsPakDim = !!activePakId && !isBpMode && !isBaMode;
  const paketeCache = isBpMode ? loadBaupakete() : null;
  const zuwCache    = (isBpMode || needsPakDim || isBaMode)
    ? (typeof loadSchichtZuw === 'function' ? loadSchichtZuw() : {}) : null;
  const hasAnyFilter = isBpMode && (f.schichtNr != null || f.datum || f.mast);

  overviewMarkers.forEach(({ pairId, rs, rks }) => {
    const p = PAIRS.find(x => x.id === pairId);
    if (!p) return;
    let col     = getOvColor(pairId, mode);
    let opacity = 1;

    if (isBpMode && hasAnyFilter) {
      const zuw = zuwCache[pairId];
      let match = !!zuw?.paketId;
      if (match && f.schichtNr != null && zuw.schichtNr !== f.schichtNr) match = false;
      if (match && f.datum) {
        const pak = paketeCache.find(pk => pk.id === zuw.paketId);
        const s = pak ? bpGetSchichten(pak).find(x => x.schichtNr === zuw.schichtNr) : null;
        if (s?.datum !== f.datum) match = false;
      }
      if (match && f.mast && !String(p.mast || '').toLowerCase().includes(f.mast.toLowerCase())) match = false;
      if (!match) { col = '#d1d5db'; opacity = 0.3; }
    } else if (needsPakDim) {
      // Aktives Paket: andere Pakete ausgrauen (alle Darstellungsarten)
      const z = zuwCache[pairId];
      if (!z || z.paketId !== activePakId) { col = '#d1d5db'; opacity = 0.35; }
    } else if (isBaMode && _bauablaufDatum) {
      const posDate = _bauablaufGetDatum(pairId, _bauablaufTyp);
      if (!posDate || posDate > _bauablaufDatum) { col = '#c8cdd4'; opacity = 0.18; }  // zukünftig: stark ausgegraut
      else if (posDate < _bauablaufDatum)        { col = '#9ca3af'; opacity = 0.45; }  // vergangen: grau, kein Farbablenkung
      // posDate === _bauablaufDatum → volle Farbe, volle Opacity (aktiv)
    }

    // Markerbeschriftung: Baugrundphase → RS/RKS; Bauprojekt/AF → Mastnummer
    const defaultRS  = isBG ? 'RS'  : (p.mast || '?');
    const defaultRKS = isBG ? 'RKS' : (p.mast || '?');
    const labelRS    = getOvIconLabel(p, mode, defaultRS);
    const labelRKS   = getOvIconLabel(p, mode, defaultRKS);

    const mkIcon = (label, sz) => L.divIcon({
      html: `<div style="background:${col};color:white;border-radius:50%;width:${sz}px;height:${sz}px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);line-height:1;">${label}</div>`,
      iconSize:[sz,sz], iconAnchor:[sz/2,sz/2], className:''
    });
    if (rs)  { rs.setIcon(mkIcon(labelRS,  isBG ? 26 : 28)); rs.setOpacity((isBpMode || needsPakDim || isBaMode) ? opacity : 1); }
    if (rks) { rks.setIcon(mkIcon(labelRKS, 26)); rks.setOpacity((isBpMode || needsPakDim || isBaMode) ? opacity : 1); }
  });

  if (!skipLegend) updateOverviewLegend(mode);
}

function updateOverviewLegend(mode) {
  const box = document.getElementById('ov-legend-box');
  if (!box) return;

  const dot = (col) => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${col};margin-right:6px;flex-shrink:0;vertical-align:middle;"></span>`;
  const row = (col, label, sub) => `<div style="display:flex;align-items:flex-start;margin-bottom:3px;">${dot(col)}<span style="line-height:1.4;">${label}${sub ? `<br><span style="font-size:9px;color:#9ca3af;">${sub}</span>` : ''}</span></div>`;

  const FUND_COL = { 'DP1a':'#2563eb', 'DP2a':'#0ea5e9', 'HP1a':'#ea580c', 'HP2a':'#d97706' };
  const FUND_DIM = { 'DP1a':'1.0 × 1.0 m', 'DP2a':'1.2–1.3 m', 'HP1a':'1.3 × 1.3 m', 'HP2a':'1.3 × 1.3 m' };

  if (mode === 'status') {
    const statuses = new Set(PAIRS.map(p => getPairData(p.id).status || 'geplant'));
    box.innerHTML =
      (statuses.has('geplant')       ? row('#6b7280','Geplant')       : '') +
      (statuses.has('abklaerung')    ? row('#d97706','In Abklärung')  : '') +
      (statuses.has('abgeschlossen') ? row('#059669','Abgeschlossen') : '');
    return;
  }

  if (mode === 'massnahme') {
    const allBp = loadAllBauprojekt();
    const lbls  = new Set(PAIRS.map(p => getMassnahmeLabel(allBp[p.id] || {})));
    box.innerHTML =
      (lbls.has('Neubau')               ? row('#dc2626','Neubau')               : '') +
      (lbls.has('Abbruch & Neubau')     ? row('#ca8a04','Abbruch & Neubau')     : '') +
      (lbls.has('Abbruch')              ? row('#ca8a04','Abbruch')              : '') +
      (lbls.has('Sicherung')            ? row('#6b8c7a','Sicherung')            : '') +
      (lbls.has('Erhalten')             ? row('#6b7280','Erhalten')             : '') +
      (lbls.has('Bestand')              ? row('#6b7280','Bestand')              : '') +
      (lbls.has('Provisorium')          ? row('#16a34a','Provisorium')          : '') +
      (lbls.has('Nicht kategorisiert')  ? row('#9ca3af','Nicht kategorisiert')  : '');
    return;
  }

  if (mode === 'fundtyp') {
    const allBP  = loadAllBauprojekt();
    const pres   = new Set();
    PAIRS.forEach(p => {
      const t = allBP[p.id]?.fundtyp || '';
      if (!t) pres.add('none'); else if (isFtSpezial(t)) pres.add('spezial'); else pres.add(t);
    });
    let html = '';
    ['DP1a','DP2a','HP1a','HP2a'].forEach(t => { if (pres.has(t)) html += row(FUND_COL[t], t, FUND_DIM[t]); });
    if (pres.has('spezial')) html += row('#7c3aed', 'Spezial', 'Nachweis erforderlich');
    if (pres.has('none'))    html += row('#9ca3af', 'Nicht gesetzt');
    box.innerHTML = html || row('#9ca3af','Keine Daten');
    return;
  }

  if (mode === 'bodenkennwerte') {
    box.innerHTML = row('#059669','Tragfähigkeit erfüllt') + row('#dc2626','Nicht erfüllt') + row('#9ca3af','Unbekannt');
    return;
  }

  if (mode === 'naturschutz') {
    box.innerHTML = row('#dc2626','Schutzzone vorhanden') + row('#059669','Keine Schutzzone');
    return;
  }

  if (mode === 'abnahme') {
    const pres = new Set(PAIRS.map(p => getAbnahmeStatus(p.id)));
    box.innerHTML =
      (pres.has('abgenommen') ? row('#059669','Abgenommen ✓')     : '') +
      (pres.has('teilweise')  ? row('#d97706','Teilweise geprüft') : '') +
      (pres.has('maengel')    ? row('#dc2626','Mängel vorhanden !') : '') +
      (pres.has('ausstehend') ? row('#9ca3af','Ausstehend')        : '');
    return;
  }


  if (mode === 'tags') {
    box.innerHTML = row('#7c3aed','Mit Tags') + row('#9ca3af','Ohne Tags');
    return;
  }

  if (mode === 'bauablauf') {
    const zuw    = typeof loadSchichtZuw === 'function' ? loadSchichtZuw() : {};
    const pakete = typeof loadBaupakete === 'function' ? loadBaupakete() : [];
    const allDaten = [...new Set(
      PAIRS.map(p => _bauablaufGetDatum(p.id, _bauablaufTyp)).filter(Boolean)
    )].sort();
    if (!allDaten.length) { box.innerHTML = '<div style="font-size:11px;color:#9ca3af;">Keine Zuweisung</div>'; return; }
    const curIdx  = _bauablaufDatum ? allDaten.indexOf(_bauablaufDatum) : allDaten.length;
    const fmtD    = d => { const [y,m,dd] = d.split('-'); return `${dd}.${m}.`; };
    const aktLabel = _bauablaufDatum ? fmtD(_bauablaufDatum) : 'Alle';
    const pakLeg = pakete.filter(p => PAIRS.some(x => zuw[x.id]?.paketId === p.id))
      .map(p => `<div style="display:flex;align-items:center;gap:5px;margin-bottom:2px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${p.farbe||'#6b7280'};flex-shrink:0;display:inline-block;"></span>
        <span style="font-size:11px;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name}</span>
      </div>`).join('');
    // Anzahl Positionen pro Datum
    const countMap = {};
    allDaten.forEach(d => { countMap[d] = PAIRS.filter(p => _bauablaufGetDatum(p.id, _bauablaufTyp) === d).length; });
    const maxCount = Math.max(...Object.values(countMap), 1);
    const _baBarBg = d => {
      if (!_bauablaufDatum)      return '#1a3a5c';  // Alle: alle satt
      if (d === _bauablaufDatum) return '#1a3a5c';  // aktiv: satt
      if (d < _bauablaufDatum)   return '#94a3b8';  // vergangen: mittelgrau
      return '#dde1e7';                              // zukünftig: hellgrau
    };
    const barChart = allDaten.map((d, i) => {
      const cnt  = countMap[d] || 0;
      const barH = Math.max(3, Math.round((cnt / maxCount) * 22));
      return `<div data-ba-bar="${i}" data-ba-count="${cnt}"
        style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:0;">
        <span data-ba-lbl style="font-size:8px;font-weight:700;color:#1a3a5c;line-height:1.2;visibility:hidden;"></span>
        <div data-ba-inner style="width:calc(100% - 1px);background:${_baBarBg(d)};height:${barH}px;border-radius:1px 1px 0 0;"></div>
      </div>`;
    }).join('');

    _bauablaufDaten = allDaten;
    box.innerHTML = `
      <div style="display:flex;gap:0;margin-bottom:6px;border:1px solid #e5e7eb;border-radius:5px;overflow:hidden;">
        <button onclick="_bauablaufSetTyp('baustart')"
          style="flex:1;padding:3px 0;font-size:10px;font-weight:600;border:none;cursor:pointer;font-family:inherit;
          background:${_bauablaufTyp==='baustart'?'#1a3a5c':'white'};color:${_bauablaufTyp==='baustart'?'white':'#6b7280'};">
          Baustart</button>
        <button onclick="_bauablaufSetTyp('ausschaltermin')"
          style="flex:1;padding:3px 0;font-size:10px;font-weight:600;border:none;cursor:pointer;font-family:inherit;
          background:${_bauablaufTyp==='ausschaltermin'?'#1a3a5c':'white'};color:${_bauablaufTyp==='ausschaltermin'?'white':'#6b7280'};">
          Ausschaltermin</button>
      </div>
      <div style="margin-bottom:0px;">
        <div style="display:flex;align-items:flex-end;height:32px;margin-bottom:0;">${barChart}</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:1px;">
          <span style="font-size:9px;color:#9ca3af;">${fmtD(allDaten[0])}</span>
          <span id="ba-slider-lbl" style="font-size:9px;font-weight:700;color:#1a3a5c;">${aktLabel}</span>
          <span style="font-size:9px;color:#9ca3af;">${fmtD(allDaten[allDaten.length-1])}</span>
        </div>
        <input type="range" id="ba-datum-slider" min="0" max="${allDaten.length}"
          value="${curIdx >= 0 ? curIdx : allDaten.length}"
          oninput="_bauablaufSlider(this)"
          style="width:100%;accent-color:#1a3a5c;cursor:pointer;margin:0;">
      </div>
      ${pakLeg ? `<div style="border-top:1px solid #f0f2f5;padding-top:5px;">${pakLeg}</div>` : ''}`;
    return;
  }

  if (mode === 'baupaket') {
    const pakete = loadBaupakete();
    const zuw    = typeof loadSchichtZuw === 'function' ? loadSchichtZuw() : {};
    const activePaketId = _bpFsHighlightPaket || _bpHighlightPaketId;
    let html = '';
    let hasPakete = false;
    pakete.forEach(pak => {
      const cnt = PAIRS.filter(p => zuw[p.id]?.paketId === pak.id).length;
      if (!cnt) return;
      hasPakete = true;
      const col = pak.farbe || '#1a3a5c';
      const isActive = pak.id === activePaketId;
      html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;padding:3px 5px;">
        <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${col};flex-shrink:0;"></span>
        <span style="flex:1;font-size:11px;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${pak.name}</span>
        <span style="font-size:10px;color:#9ca3af;">${cnt}</span>
      </div>`;
    });
    if (!hasPakete) { box.innerHTML = '<div style="font-size:11px;color:#9ca3af;">Keine Zuweisung</div>'; return; }
    box.innerHTML = html;
    return;
  }

  box.innerHTML = '';
}

// Overview fullscreen toggle
let _ovFullscreen = false;
function toggleOverviewFullscreen() {
  const wrap = document.getElementById('overview-map-wrap');
  const map  = document.getElementById('overview-map');
  const icon = document.getElementById('btn-ov-fullscreen-icon');
  _ovFullscreen = !_ovFullscreen;
  if (_ovFullscreen) {
    wrap.style.cssText += ';position:fixed;top:0;left:0;right:0;bottom:0;z-index:9000;padding:0;';
    map.style.height = '100vh';
    if (icon) icon.innerHTML = '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>';
  } else {
    wrap.style.cssText = wrap.style.cssText.replace(/position:fixed.*?padding:0;/,'');
    wrap.style.position = '';
    wrap.style.top = wrap.style.left = wrap.style.right = wrap.style.bottom = wrap.style.zIndex = '';
    map.style.height = '500px';
    if (icon) icon.innerHTML = '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>';
  }
  setTimeout(() => { if (overviewMap) overviewMap.invalidateSize(); }, 100);
}

let _umweltOverlaysOv = [];

function _applyUmweltOverlaysOv(map) {
  _umweltOverlaysOv.forEach(l => { try { map.removeLayer(l); } catch {} });
  _umweltOverlaysOv = _buildUmweltOverlays();
  _umweltOverlaysOv.forEach(l => l.addTo(map));
  _addUmweltLegend(map);
}

function setOverviewBaseLayer(key) {
  overviewBaseLayerKey = key;
  if (overviewMap) {
    _umweltOverlaysOv.forEach(l => { try { overviewMap.removeLayer(l); } catch {} });
    _umweltOverlaysOv = [];
    if (overviewBaseLayer) overviewMap.removeLayer(overviewBaseLayer);
    overviewBaseLayer = makeTile(key === 'umwelt' ? 'swiss-karte' : key,
      key === 'umwelt' ? { opacity: overviewMapOpacity, className: 'umwelt-base-tile' } : { opacity: overviewMapOpacity }).addTo(overviewMap);
    overviewBaseLayer.bringToBack();
    if (key === 'umwelt') _applyUmweltOverlaysOv(overviewMap);
  }
  // Sync dropdown
  const sel = document.getElementById('ov-basemap-select');
  if (sel) sel.value = key;
  // Legacy buttons
  ['swiss-karte','swiss-luft','google-maps','google-sat'].forEach(k => {
    const btn = document.getElementById('ov-map-btn-' + k);
    if (btn) btn.classList.toggle('active', k === key);
  });
}

// Projekttitel und Projekte-Knopf im Banner ein-/ausblenden. In Detail- und
// Erfassungsansicht steht der Standort im Vordergrund; der Projektname ist dort
// bereits in der Verortung enthalten und nimmt der mittleren Spalte nur Breite.
// Der Titel wird auf Breite null gesetzt statt mit display:none entfernt: der
// Kopf ist ein Raster «auto 1fr auto». Fällt das erste Element heraus, rücken
// die übrigen eine Spalte vor und der mittlere Block landet in der schmalen
// auto-Spalte — gemessen wurde er dadurch schmaler statt breiter.
function bannerProjektZeigen(zeigen) {
  // An seiner Stelle erscheint die Phasenwahl — dort fehlt sonst jeder Zugriff
  // darauf, weil die Navigationsleiste nicht sichtbar ist.
  if (typeof bannerPhaseZeigen === 'function') bannerPhaseZeigen(!zeigen);
  // Über eine Klasse statt über inline-Stile: der Abstand rechts steht als
  // inline-Angabe im Markup und wurde beim Zurücksetzen sonst mitgelöscht.
  const titel = document.getElementById('header-projekt');
  if (titel) titel.classList.toggle('eingeklappt', !zeigen);
  const btn = document.getElementById('projekte-btn-wrap');
  if (btn) btn.style.visibility = zeigen ? '' : 'hidden';
  // Das Suchfeld im Kopf filtert die Standortliste. In der Erfassungsansicht
  // steht es unmittelbar ueber dem Suchfeld der Karte, das etwas ganz anderes
  // tut — beim Absetzen eines Punktes stiftet das nur Verwirrung.
  const suche = document.getElementById('search-input');
  if (suche) {
    const erfassen = document.getElementById('create-view')?.style.display === 'block';
    suche.style.display = erfassen ? 'none' : '';
  }
}

// Kurzes Einblenden eines gerade sichtbar gemachten Kastens. Die Klasse wird
// erst entfernt und nach einem erzwungenen Umbruch neu gesetzt, sonst laeuft
// die Animation beim zweiten Wechsel auf denselben Kasten nicht erneut an.
function ansichtEinblenden(el) {
  if (!el) return;
  el.classList.remove('ansicht-rein');
  void el.offsetWidth;
  el.classList.add('ansicht-rein');
  el.addEventListener('animationend', () => el.classList.remove('ansicht-rein'), { once: true });
}

// Kasten je Ansicht — nur zum Einblenden. Die Kartenansicht fehlt bewusst:
// Leaflet misst die Kartengroesse kurz nach dem Umschalten, und eine laufende
// transform-Animation verfaelscht diese Messung.
const OV_INHALT_IDS = {
  karten: 'cards-grid', liste: 'list-wrap',
  baugrund: 'baugrund-wrap', fundamente: 'fundtyp-wrap',
  installationen: 'installationen-wrap', termine: 'termine-wrap',
  protokolle: 'protokolle-wrap', bauprogramm: 'bauprogramm-tab-wrap',
};

function setOverviewView(view) {
  // Bereich einer anderen Phase: Phase mitziehen statt blockieren
  // (siehe _navPhaseFuerBereichWechseln in kern.js).
  if (typeof viewErlaubt === 'function' && !viewErlaubt(view)) {
    _navPhaseFuerBereichWechseln(view);
    return;
  }
  currentOverviewView = view;
  ['karten','liste','karte','baugrund','fundamente','installationen','termine','protokolle','bauprogramm'].forEach(v => {
    const btn = document.getElementById('vbtn-'+v);
    if (btn) btn.classList.toggle('active', v===view);
  });
  // Erst nach dem Setzen von .active — sonst wird der vorherige Reiter geholt
  if (typeof _navAktivenReiterZeigen === 'function') _navAktivenReiterZeigen();
  document.getElementById('cards-grid').style.display        = view==='karten'    ? '' : 'none';
  const instSectionEl = document.getElementById('inst-section-inline');
  if (instSectionEl) instSectionEl.style.display = view==='karten' ? '' : 'none';
  document.getElementById('list-wrap').style.display         = view==='liste'     ? 'block' : 'none';
  document.getElementById('overview-map-wrap').style.display = view==='karte'     ? 'block' : 'none';
  document.getElementById('baugrund-wrap').style.display     = view==='baugrund'  ? 'block' : 'none';
  const ftwEl = document.getElementById('fundtyp-wrap');
  if (ftwEl) ftwEl.style.display = view==='fundamente' ? 'block' : 'none';
  const instWrapEl = document.getElementById('installationen-wrap');
  if (instWrapEl) instWrapEl.style.display = view==='installationen' ? 'block' : 'none';
  const twEl = document.getElementById('termine-wrap');
  if (twEl) twEl.style.display = view==='termine' ? 'block' : 'none';
  const protokolleEl = document.getElementById('protokolle-wrap');
  if (protokolleEl) protokolleEl.style.display = view==='protokolle' ? 'block' : 'none';
  const bpTabEl = document.getElementById('bauprogramm-tab-wrap');
  if (bpTabEl) bpTabEl.style.display = view==='bauprogramm' ? 'block' : 'none';
  const btnNeu = document.getElementById('btn-neu');
  if (btnNeu) btnNeu.style.display = view === 'karten' ? 'none' : '';
  // Überschrift «Standorte», Filterleiste und Fortschrittsbalken beziehen sich
  // auf die Standortliste. In einem Bereich (Baugrund, Bauprogramm, Termine …)
  // stehen sie über fremdem Inhalt und kosten nur Platz.
  const zeigtStandorte = (view === 'karten' || view === 'liste' || view === 'karte');
  const filterBarRow = document.getElementById('filter-bar-row');
  if (filterBarRow) filterBarRow.style.display = (view === 'karten' || view === 'liste') ? 'flex' : 'none';
  const titelRow = document.getElementById('standorte-titel-row');
  if (titelRow) titelRow.style.display = zeigtStandorte ? 'flex' : 'none';
  // Die Phase wirkt nur auf die Standortansichten. In einem Bereich bleibt sie
  // sichtbar (sonst aendert die Leiste ihre Breite), aber abgeschaltet.
  const phaseSel = document.getElementById('phase-select');
  if (phaseSel) {
    phaseSel.disabled = !zeigtStandorte;
    // renderPhaseBanner() setzt den Tooltip auf die Phasenbeschreibung zurueck
    if (zeigtStandorte) renderPhaseBanner();
    else phaseSel.title = 'Die Phase gilt für Kacheln, Liste und Karte';
  }
  // Der Uebersichtskasten traegt nur Standort-Inhalt (Ueberschrift, Filter,
  // Kacheln). Die Bereiche liegen als eigene Kaesten daneben — bliebe er
  // stehen, klaffte sein Innenabstand als Leerraum vor dem Bereichsinhalt.
  const ovBox = document.getElementById('overview-box');
  if (ovBox) ovBox.style.display = zeigtStandorte ? '' : 'none';
  const kontaktSec = document.getElementById('kontakt-section');
  const showBanner = (view === 'karten' || view === 'liste' || view === 'termine' || view === 'protokolle');
  if (kontaktSec) kontaktSec.style.display = showBanner ? '' : 'none';
  const ovView = document.getElementById('overview-view');
  if (ovView) ovView.style.paddingBottom = showBanner ? '38px' : '';

  if (view!=='karte' && overviewWatchId !== null) {
    navigator.geolocation.clearWatch(overviewWatchId); overviewWatchId = null;
    if (overviewGpsMarker) { overviewGpsMarker.remove(); overviewGpsMarker = null; }
    if (overviewGpsCircle) { overviewGpsCircle.remove(); overviewGpsCircle = null; }
    _syncOverviewGpsBtn(false);
    const bz = document.getElementById('btn-overview-gps-zoom');
    if (bz) bz.style.display = 'none';
  }
  if (view==='liste')      renderList();
  if (view==='karten')     renderCards();
  if (view==='karte') {
    const mapWasInit = !!overviewMap;
    initOverviewMap();
    ovNavAktualisieren();
    setTimeout(resizeOverviewMap, 50);
    setTimeout(() => {
      overviewKarteAufPhaseZentrieren();
      if (_bpHighlightPaketId) refreshBpMapHighlight();
    }, 350);
  }
  if (view==='baugrund')       renderBaugrundView();
  if (view==='fundamente')    renderFundtypView();
  if (view==='installationen') renderInstallationen();
  if (view==='termine')       renderTermineView();
  if (view==='protokolle') { renderAbnahmeListView(); renderAushubView(); }
  if (view==='bauprogramm') renderBauprogrammTab();
  ansichtEinblenden(document.getElementById(OV_INHALT_IDS[view]));
  // Notizen-Sektion immer zuunterst aktualisieren
  renderNotizSection();
  pushNavState({ type: 'overview', phase: _activePhase, view });
  updateNavButtons();
}

// ============================================================
// ABNAHMEN-LISTENANSICHT (Ausführungsphase)
// ============================================================
function renderAbnahmeListView() {
  const pairs = getFilteredSorted();
  const all   = loadAllChecklisten();
  const table = document.getElementById('abnahme-list-table');
  if (!table) return;

  const gruppen = [
    { name: 'Schrauben', ids: CK_PRUEFPUNKTE.filter(p=>p.gruppe==='schrauben').map(p=>p.id) },
    { name: 'Beton',     ids: CK_PRUEFPUNKTE.filter(p=>p.gruppe==='beton').map(p=>p.id) },
    { name: 'Lage',      ids: CK_PRUEFPUNKTE.filter(p=>p.gruppe==='lage').map(p=>p.id) },
    { name: 'Umgeb.',    ids: CK_PRUEFPUNKTE.filter(p=>p.gruppe==='umgebung').map(p=>p.id) },
  ];
  const thS = 'padding:6px 8px;font-size:10px;font-weight:600;white-space:nowrap;border-bottom:none;';

  // Gruppen-Header (colspan)
  let groupHeaders = `<th colspan="3" style="${thS}"></th>`;
  gruppen.forEach(g => {
    groupHeaders += `<th colspan="${g.ids.length}" style="${thS}text-align:center;border-bottom:2px solid rgba(255,255,255,0.25);">${g.name}</th>`;
  });

  // Spalten-Header
  let colHeaders = `
    <th style="${thS}cursor:pointer;" onclick="setListSort('mast')">Mast</th>
    <th style="${thS}cursor:pointer;" onclick="setListSort('km')">KM</th>
    <th style="${thS}">Gesamt</th>`;
  CK_PRUEFPUNKTE.forEach(p => {
    colHeaders += `<th style="${thS}text-align:center;" title="${p.beschreibung}">${p.kuerzel}</th>`;
  });

  // Zeilen
  let rows = '';
  pairs.forEach(p => {
    const ck = all[p.id] || {};
    const mngCount = CK_PRUEFPUNKTE.filter(x=>ck[`ck_${x.id}_ok`]==='mangel').length;
    const okCount  = CK_PRUEFPUNKTE.filter(x=>ck[`ck_${x.id}_ok`]==='ok'||ck[`ck_${x.id}_ok`]==='na').length;
    const noData   = !CK_PRUEFPUNKTE.some(x=>ck[`ck_${x.id}_ok`]);
    const gesamt   = noData
      ? '<span style="color:#9ca3af;font-size:11px;">–</span>'
      : mngCount > 0
        ? `<span style="color:#dc2626;font-weight:600;font-size:11px;display:inline-flex;align-items:center;gap:4px;">${svgIcon('warnung',{groesse:11})}${mngCount} Mängel</span>`
        : okCount === CK_PRUEFPUNKTE.length
          ? '<span style="color:#16a34a;font-weight:600;font-size:11px;">✓ Bestanden</span>'
          : `<span style="color:#f59e0b;font-weight:600;font-size:11px;">${okCount}/${CK_PRUEFPUNKTE.length}</span>`;

    let cells = '';
    CK_PRUEFPUNKTE.forEach(pp => {
      const s      = ck[`ck_${pp.id}_ok`] || '';
      const bg     = s==='ok'?'#dcfce7':s==='mangel'?'#fee2e2':'#f9fafb';
      const border = s==='ok'?'#86efac':s==='mangel'?'#fca5a5':'#e5e7eb';
      const sym    = s==='ok'?'✓':s==='mangel'?'✗':s==='na'?'N/A':'';
      const col    = s==='ok'?'#16a34a':s==='mangel'?'#dc2626':'#9ca3af';
      cells += `<td style="text-align:center;padding:4px;background:${bg};border:1px solid ${border};font-size:10px;font-weight:700;color:${col};">${sym}</td>`;
    });

    rows += `<tr onclick="openCheckliste(${p.id})" style="cursor:pointer;" class="list-hover-row">
      <td style="padding:6px 8px;font-weight:600;font-size:12px;">Mast ${p.mast||'—'}</td>
      <td style="padding:6px 8px;font-size:12px;color:#6b7280;">${p.km_rs?parseFloat(p.km_rs).toFixed(3):'—'}</td>
      <td style="padding:6px 8px;">${gesamt}</td>
      ${cells}
    </tr>`;
  });

  const emptyMsg = `<tr><td colspan="${3+CK_PRUEFPUNKTE.length}" style="text-align:center;padding:40px;color:#9ca3af;">Keine Standorte</td></tr>`;
  table.innerHTML = `<thead>
    <tr>${groupHeaders}</tr>
    <tr>${colHeaders}</tr>
  </thead>
  <tbody>${rows || emptyMsg}</tbody>`;
}

function exportAbnahmeListPdf() {
  const jsPDFLib = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFLib) { ui.toast('jsPDF nicht geladen.', 'fehler'); return; }

  const doc   = new jsPDFLib({ orientation:'landscape', unit:'mm', format:'a4' });
  const pairs = getFilteredSorted();
  const all   = loadAllChecklisten();
  const pn    = getActiveProjectName() || 'Projekt';
  const date  = new Date().toLocaleDateString('de-CH');

  // ── Masse & Farben ──────────────────────────────────────────
  const L = 14;              // linker Rand
  const PAGE_W = 297;
  const USABLE = PAGE_W - L - 14; // 269 mm
  const W_MAST  = 26;
  const W_KM    = 20;
  const W_GES   = 26;
  const W_FIXED = W_MAST + W_KM + W_GES;
  const W_PP    = Math.floor((USABLE - W_FIXED) / CK_PRUEFPUNKTE.length); // ~14.8 mm
  const ROW_H   = 7;
  const CELL_SZ = 4.5;  // Füll-Quadrat für Status
  const COL_BG  = [26, 58, 92];
  const COL_GR1 = [220, 38,  38];   // Mangel rot
  const COL_GR2 = [22, 163,  74];   // OK grün
  const COL_NA  = [209,213,219];    // N/A grau
  const COL_EMP = [240,242,245];    // leer hellgrau

  // X-Position jedes Prüfpunkts
  const ppX = (i) => L + W_FIXED + i * W_PP;

  // Gruppen-Definition für Kopfzeile
  const GRUPPEN = [
    { label:'Fundamentschrauben', gruppe:'schrauben' },
    { label:'Beton',              gruppe:'beton' },
    { label:'Lage + Ausrichtung', gruppe:'lage' },
    { label:'Umgebung',           gruppe:'umgebung' },
  ];

  // ── Kopf ────────────────────────────────────────────────────
  doc.setFillColor(...COL_BG); doc.rect(0, 0, PAGE_W, 3, 'F');
  let y = 11;
  doc.setFontSize(13); doc.setFont(undefined,'bold'); doc.setTextColor(...COL_BG);
  doc.text('Abnahme-Ubersicht', L, y);
  doc.setFontSize(9); doc.setFont(undefined,'normal'); doc.setTextColor(107,114,128);
  doc.text(pn, L, y + 6);
  doc.setFontSize(8);
  doc.text(date + '  |  Ausfuehrungsphase  |  ' + pairs.length + ' Standorte', PAGE_W - 14, y, { align:'right' });
  doc.setDrawColor(229,231,235); doc.line(L, y + 9, PAGE_W - 14, y + 9);
  y += 16;

  // ── Tabellenkopf zeichnen ───────────────────────────────────
  const drawHeader = () => {
    // Gruppen-Zeile (hellblauer Hintergrund)
    GRUPPEN.forEach(g => {
      const pts = CK_PRUEFPUNKTE.filter(p => p.gruppe === g.gruppe);
      if (!pts.length) return;
      const startI = CK_PRUEFPUNKTE.indexOf(pts[0]);
      const x  = ppX(startI);
      const w  = pts.length * W_PP - 1;
      doc.setFillColor(235, 241, 248);
      doc.rect(x, y - 3, w, 5.5, 'F');
      doc.setFontSize(6.5); doc.setFont(undefined,'bold'); doc.setTextColor(...COL_BG);
      // Text zentriert in der Gruppe
      doc.text(g.label.toUpperCase(), x + w / 2, y + 0.5, { align:'center', maxWidth: w - 2 });
    });
    y += 6;

    // Spalten-Kopf
    doc.setFillColor(...COL_BG);
    doc.rect(L, y - 4, USABLE, ROW_H, 'F');
    doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(255,255,255);
    doc.text('Mast',    L + 2,        y);
    doc.text('KM',      L + W_MAST + 2, y);
    doc.text('Gesamt',  L + W_MAST + W_KM + 2, y);
    CK_PRUEFPUNKTE.forEach((pp, i) => {
      doc.text(pp.kuerzel, ppX(i) + W_PP / 2, y, { align:'center' });
    });
    y += ROW_H;
  };

  drawHeader();

  // ── Datenzeilen ─────────────────────────────────────────────
  pairs.forEach((p, ri) => {
    if (y > 196) { doc.addPage(); y = 14; drawHeader(); }

    const ck   = all[p.id] || {};
    const mng  = CK_PRUEFPUNKTE.filter(x => ck[`ck_${x.id}_ok`] === 'mangel').length;
    const okCt = CK_PRUEFPUNKTE.filter(x => ck[`ck_${x.id}_ok`] === 'ok' || ck[`ck_${x.id}_ok`] === 'na').length;
    const noD  = !CK_PRUEFPUNKTE.some(x => ck[`ck_${x.id}_ok`]);

    // Zeilen-Hintergrund (abwechselnd)
    if (ri % 2 === 1) { doc.setFillColor(248,250,252); doc.rect(L, y-4, USABLE, ROW_H, 'F'); }

    // Mast
    doc.setFontSize(8); doc.setFont(undefined,'bold'); doc.setTextColor(...COL_BG);
    doc.text('Mast ' + (p.mast || '—'), L + 2, y);

    // KM
    doc.setFont(undefined,'normal'); doc.setTextColor(80,80,80);
    doc.text(p.km_rs ? parseFloat(p.km_rs).toFixed(3) : '—', L + W_MAST + 2, y);

    // Gesamt-Status (farbige Pill)
    const gesX = L + W_MAST + W_KM;
    if (!noD) {
      const pillCol = mng > 0 ? COL_GR1 : COL_GR2;
      const pillTxt = mng > 0 ? (mng + ' Mangel') : 'OK';
      doc.setFillColor(...pillCol);
      doc.roundedRect(gesX + 1, y - 3.5, W_GES - 3, 5, 1.2, 1.2, 'F');
      doc.setFontSize(7); doc.setFont(undefined,'bold'); doc.setTextColor(255,255,255);
      doc.text(pillTxt, gesX + (W_GES - 2) / 2, y - 0.2, { align:'center' });
    } else {
      doc.setFontSize(7); doc.setFont(undefined,'normal'); doc.setTextColor(180,180,180);
      doc.text('–', gesX + 2, y);
    }

    // Prüfpunkt-Zellen: gefülltes Quadrat statt Unicode-Symbol
    CK_PRUEFPUNKTE.forEach((pp, i) => {
      const s  = ck[`ck_${pp.id}_ok`] || '';
      const cx = ppX(i) + W_PP / 2 - CELL_SZ / 2;
      const cy = y - CELL_SZ + 1;
      if (s === 'ok') {
        doc.setFillColor(...COL_GR2);
        doc.roundedRect(cx, cy, CELL_SZ, CELL_SZ, 0.8, 0.8, 'F');
      } else if (s === 'mangel') {
        doc.setFillColor(...COL_GR1);
        doc.roundedRect(cx, cy, CELL_SZ, CELL_SZ, 0.8, 0.8, 'F');
      } else if (s === 'na') {
        doc.setFillColor(...COL_NA);
        doc.roundedRect(cx, cy, CELL_SZ, CELL_SZ, 0.8, 0.8, 'F');
      } else {
        doc.setFillColor(...COL_EMP);
        doc.roundedRect(cx, cy, CELL_SZ, CELL_SZ, 0.8, 0.8, 'F');
      }
    });

    // Trennlinie zwischen Zeilen
    doc.setDrawColor(229,231,235);
    doc.line(L, y + ROW_H - 4, L + USABLE, y + ROW_H - 4);
    y += ROW_H;
  });

  // ── Legende ─────────────────────────────────────────────────
  y += 4;
  if (y > 198) { doc.addPage(); y = 14; }
  const lx = L;
  doc.setFontSize(7); doc.setFont(undefined,'normal'); doc.setTextColor(107,114,128);
  const legend = [
    { col: COL_GR2, label: 'OK' },
    { col: COL_GR1, label: 'Mangel' },
    { col: COL_NA,  label: 'N/A' },
    { col: COL_EMP, label: 'Nicht geprueft' },
  ];
  let lxPos = lx;
  legend.forEach(lg => {
    doc.setFillColor(...lg.col);
    doc.setDrawColor(200,200,200);
    doc.roundedRect(lxPos, y - 3, 3.5, 3.5, 0.5, 0.5, 'FD');
    doc.setTextColor(80,80,80);
    doc.text(lg.label, lxPos + 5, y);
    lxPos += 24;
  });

  doc.save(pn.replace(/[^a-zA-Z0-9_]/g,'_') + '_Abnahmen.pdf');
}

// ── Excel-Export: Abnahme-Übersicht ────────────────────────────────────────
function exportAbnahmeListXlsx() {
  if (!window.XLSX) { ui.toast('SheetJS nicht geladen.', 'fehler'); return; }
  const pairs = getFilteredSorted();
  const all   = loadAllChecklisten();
  const pn    = getActiveProjectName() || 'Projekt';
  const date  = new Date().toLocaleDateString('de-CH');

  // Kopfzeile 1: Gruppen-Labels (merged über Prüfpunkte)
  const gruppen = [
    { label:'Fundamentschrauben', gruppe:'schrauben' },
    { label:'Beton',              gruppe:'beton' },
    { label:'Lage + Ausrichtung', gruppe:'lage' },
    { label:'Umgebung',           gruppe:'umgebung' },
  ];

  const row0 = ['', '', 'Abnahme-Ubersicht · ' + pn + '  (' + date + ')'];

  const row1 = ['Mast', 'KM', 'Gesamt'];
  gruppen.forEach(g => {
    const pts = CK_PRUEFPUNKTE.filter(p => p.gruppe === g.gruppe);
    pts.forEach((pp, i) => row1.push(i === 0 ? g.label : ''));
  });

  const row2 = ['', '', ''];
  CK_PRUEFPUNKTE.forEach(pp => row2.push(pp.kuerzel + ' – ' + pp.beschreibung));

  // Datenzeilen
  const dataRows = pairs.map(p => {
    const ck   = all[p.id] || {};
    const mng  = CK_PRUEFPUNKTE.filter(x => ck[`ck_${x.id}_ok`] === 'mangel').length;
    const okCt = CK_PRUEFPUNKTE.filter(x => ck[`ck_${x.id}_ok`] === 'ok' || ck[`ck_${x.id}_ok`] === 'na').length;
    const noD  = !CK_PRUEFPUNKTE.some(x => ck[`ck_${x.id}_ok`]);
    const gesamt = noD ? '–' : mng > 0 ? (mng + ' Mangel') : okCt === CK_PRUEFPUNKTE.length ? 'Bestanden' : (okCt + '/' + CK_PRUEFPUNKTE.length);

    const row = [
      'Mast ' + (p.mast || '—'),
      p.km_rs ? parseFloat(p.km_rs).toFixed(3) : '—',
      gesamt,
    ];
    CK_PRUEFPUNKTE.forEach(pp => {
      const s = ck[`ck_${pp.id}_ok`] || '';
      row.push(s === 'ok' ? 'OK' : s === 'mangel' ? 'Mangel' : s === 'na' ? 'N/A' : '');
    });
    return row;
  });

  const aoa = [row0, row1, row2, ...dataRows];
  const ws  = XLSX.utils.aoa_to_sheet(aoa);

  // Spaltenbreiten: Mast/KM/Gesamt breit, Prüfpunkte schmal
  ws['!cols'] = [
    { wch: 12 }, // Mast
    { wch: 10 }, // KM
    { wch: 14 }, // Gesamt
    ...CK_PRUEFPUNKTE.map(() => ({ wch: 8 })),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Abnahme-Uebersicht');
  XLSX.writeFile(wb, pn.replace(/[^a-zA-Z0-9_]/g,'_') + '_Abnahmen.xlsx');
}

// ── Baugrundtypen für Aushubprotokoll ────────────────────────
const AUSHUB_TYPEN = [
  { key: 'feinWeich',   label: 'Lehm weich',  short: 'Lhm w.',  color: '#c8a87a', border: '#a07840', grp: 'Feinkörnig/Gem.' },
  { key: 'feinSteif',   label: 'Lehm steif',  short: 'Lhm st.', color: '#a87c4a', border: '#7a5a2a', grp: 'Feinkörnig/Gem.' },
  { key: 'gemLocker',   label: 'Gem. locker', short: 'Gem.lok', color: '#b8c87a', border: '#8a9850', grp: 'Feinkörnig/Gem.' },
  { key: 'gemDicht',    label: 'Gem. dicht',  short: 'Gem.dct', color: '#7a9845', border: '#5a7825', grp: 'Feinkörnig/Gem.' },
  { key: 'sand',        label: 'Sand',         short: 'Sand',    color: '#e8d87a', border: '#c0b04a', grp: 'Grob/Fels' },
  { key: 'kiesSand',    label: 'Kies-Sand',   short: 'Kies',    color: '#c8a840', border: '#907820', grp: 'Grob/Fels' },
  { key: 'fels',        label: 'Fels',         short: 'Fels',    color: '#8a96a8', border: '#5a6878', grp: 'Grob/Fels' },
  { key: 'wasserWenig', label: 'Wasser w.',    short: 'Was.w.',  color: '#a8d4f0', border: '#6aaad0', grp: 'Wasser/GW' },
  { key: 'wasserViel',  label: 'Wasser v.',    short: 'Was.v.',  color: '#5aacd8', border: '#2a7cb0', grp: 'Wasser/GW' },
];

// ============================================================
// AUSHUBPROTOKOLL (Ausführungsphase)
// ============================================================
const AUSHUB_KEY      = () => 'sp_aushub__'      + _activeId;
const AUSHUB_KOPF_KEY = () => 'sp_aushub_kopf__' + _activeId;

function loadAllAushub() {
  try { return jsonParse(store.getItem(AUSHUB_KEY()) || '{}'); } catch { return {}; }
}
function saveAllAushub(all) { store.setItem(AUSHUB_KEY(), JSON.stringify(all)); }

function loadAushubKopf() {
  try { return jsonParse(store.getItem(AUSHUB_KOPF_KEY()) || '{}'); } catch { return {}; }
}
function saveAushubKopfData(obj) { store.setItem(AUSHUB_KOPF_KEY(), JSON.stringify(obj)); }

// Aktive pairId für Aushub-Modal
let _currentAushubPairId = null;

// ---- Tabellenansicht -----------------------------------------------

function renderAushubView() {
  const table = document.getElementById('aushub-list-table');
  if (!table) return;
  const pairs   = getFilteredSorted();
  const allAh   = loadAllAushub();
  const allAusf = loadAllAusfuehrung();

  const grpStyle = (color) => `padding:5px 8px;font-size:10px;font-weight:700;text-align:center;color:white;background:${color};white-space:nowrap;`;
  const thS = 'padding:5px 8px;font-size:10px;font-weight:600;white-space:nowrap;color:#374151;background:#f8fafc;border-bottom:1px solid #e5e7eb;';

  const headerRow1 = `<tr>
    <th colspan="3" style="${thS}background:#1a3a5c;color:white;"></th>
    <th colspan="3" style="${grpStyle('#1a3a5c')}border-left:2px solid white;">Grubenausmass *)</th>
    <th colspan="4" style="${grpStyle('#65813a')}border-left:2px solid white;">Feinkörnig / Gemischt</th>
    <th colspan="3" style="${grpStyle('#b45309')}border-left:2px solid white;">Grob / Fels</th>
    <th colspan="4" style="${grpStyle('#2563eb')}border-left:2px solid white;">Wasser / GW</th>
    <th colspan="2" style="${grpStyle('#7c3aed')}border-left:2px solid white;">Fundamenttyp</th>
  </tr>`;

  const headerRow2 = `<tr>
    <th style="${thS}">Mast</th>
    <th style="${thS}">km</th>
    <th style="${thS}">Ausführung</th>
    <th style="${thS}border-left:2px solid #e5e7eb;">L [m]</th>
    <th style="${thS}">B/D [m]</th>
    <th style="${thS}">T [m]</th>
    <th style="${thS}border-left:2px solid #e5e7eb;">Lhm weich</th>
    <th style="${thS}">Lhm steif</th>
    <th style="${thS}">Gem. locker</th>
    <th style="${thS}">Gem. dicht</th>
    <th style="${thS}border-left:2px solid #e5e7eb;">Sand</th>
    <th style="${thS}">Kies-Sand</th>
    <th style="${thS}">Fels</th>
    <th style="${thS}border-left:2px solid #e5e7eb;">Was. wenig</th>
    <th style="${thS}">Was. viel</th>
    <th style="${thS}">GW [m]</th>
    <th style="${thS}">Einsturz</th>
    <th style="${thS}border-left:2px solid #e5e7eb;">gem. Plan</th>
    <th style="${thS}">Anderer Typ</th>
  </tr>`;

  const tdS = 'padding:5px 8px;font-size:11px;white-space:nowrap;';
  const dash = '<span style="color:#d1d5db;">—</span>';

  // Build colored cell for soil type value
  const soilCell = (key, val) => {
    if (!val) return `<td style="${tdS}">${dash}</td>`;
    const t = AUSHUB_TYPEN.find(x => x.key === key);
    const dot = t ? `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${t.color};border:1px solid ${t.border};margin-right:4px;flex-shrink:0;vertical-align:middle;"></span>` : '';
    return `<td style="${tdS}">${dot}${val}</td>`;
  };

  const rows = pairs.map(p => {
    const ah   = allAh[p.id]   || {};
    const ausf = allAusf[p.id] || {};
    const km   = p.km_rs ? parseFloat(p.km_rs).toFixed(3) : '—';
    const ausfText = ah.ausfuehrung || ausf.firma || '';
    const hasData  = ah.savedAt;

    // Build mini profile from horizonte
    let profilePreview = '';
    if (ah.horizonte && ah.horizonte.length) {
      const bars = ah.horizonte.slice(0, 5).map(h => {
        const t = AUSHUB_TYPEN.find(x => x.key === h.typ);
        return t ? `<span title="${t.label} ${h.von}–${h.bis}m" style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${t.color};border:1px solid ${t.border};margin-right:1px;"></span>` : '';
      }).join('');
      profilePreview = `<span style="margin-left:4px;">${bars}</span>`;
    }

    const trStyle = hasData ? '' : 'opacity:0.75;';
    return `<tr onclick="openAushubModal(${p.id})" style="cursor:pointer;${trStyle}" onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background=''">
      <td style="${tdS}font-weight:700;color:#1a3a5c;">Mast ${p.mast || '—'}${profilePreview}</td>
      <td style="${tdS}color:#6b7280;">${km}</td>
      <td style="${tdS}">${ausfText || dash}</td>
      <td style="${tdS}border-left:2px solid #f0f2f5;">${ah.grubeL || dash}</td>
      <td style="${tdS}">${ah.grubeB || dash}</td>
      <td style="${tdS}">${ah.grubeT || dash}</td>
      ${soilCell('feinWeich',  ah.feinWeich)}
      ${soilCell('feinSteif',  ah.feinSteif)}
      ${soilCell('gemLocker',  ah.gemLocker)}
      ${soilCell('gemDicht',   ah.gemDicht)}
      ${soilCell('sand',       ah.sand)}
      ${soilCell('kiesSand',   ah.kiesSand)}
      ${soilCell('fels',       ah.fels)}
      ${soilCell('wasserWenig',ah.wasserWenig)}
      ${soilCell('wasserViel', ah.wasserViel)}
      <td style="${tdS}">${ah.grundwasser || dash}</td>
      <td style="${tdS}">${ah.einsturz || dash}</td>
      <td style="${tdS}border-left:2px solid #f0f2f5;">${ah.fundGemaessPlan || dash}</td>
      <td style="${tdS}">${ah.fundAndererTyp || dash}</td>
    </tr>`;
  });

  const tbody = pairs.length
    ? `<tbody>${rows.join('')}</tbody>`
    : `<tbody><tr><td colspan="19" style="padding:24px;text-align:center;color:#9ca3af;font-size:12px;">Keine Standorte vorhanden.</td></tr></tbody>`;

  table.innerHTML = `<thead>${headerRow1}${headerRow2}</thead>${tbody}`;
}

// ---- Aushub-Modal (Einzel-Eintrag) ---------------------------------

let _ahHorizonte = []; // temp state while editing

function openAushubModal(pairId) {
  _currentAushubPairId = pairId;
  const pair   = PAIRS.find(p => p.id === pairId) || {};
  const allAh  = loadAllAushub();
  const ah     = allAh[pairId] || {};
  const ausf   = loadAllAusfuehrung()[pairId] || {};
  const bp     = loadAllBauprojekt()[pairId]  || {};
  const fd     = getPairData(pairId).felddaten || {};

  document.getElementById('aushub-modal-title').textContent = 'Aushubprotokoll — Mast ' + (pair.mast || pairId);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('ah-dokNr',           ah.dokNr || '');
  set('ah-ausfuehrung',     ah.ausfuehrung || ausf.firma || '');
  set('ah-grubeL',          ah.grubeL || '');
  set('ah-grubeB',          ah.grubeB || '');
  set('ah-grubeT',          ah.grubeT || ausf.tiefe || '');
  set('ah-grundwasser',     ah.grundwasser || fd.rs_gw_tiefe || '');
  set('ah-einsturz',        ah.einsturz || '');
  set('ah-fundGemaessPlan', ah.fundGemaessPlan || normFundtyp(bp.fundtyp || '') || '');
  set('ah-fundAndererTyp',  ah.fundAndererTyp || '');

  // Soll-Abmessungen aus FUND_ABMESSUNGEN anzeigen
  const ftNorm = normFundtyp(bp.fundtyp || '');
  const neigKey = (bp.neigung || '').includes('14–33') ? '14–33°' : '≤14°';
  const sollDaten = ftNorm && !isFtSpezial(ftNorm) ? FUND_ABMESSUNGEN[ftNorm + '|' + neigKey] : null;
  const sollRow  = document.getElementById('ah-soll-abmess-row');
  const sollText = document.getElementById('ah-soll-abmess-text');
  if (sollRow && sollText) {
    if (sollDaten) {
      sollText.textContent = ftNorm + ' — Querschnitt ' + sollDaten.querschnitt + ', Einbindetiefe ' + sollDaten.tiefe;
      sollRow.style.display = 'block';
    } else {
      sollRow.style.display = 'none';
    }
  }

  // Horizonte aufbauen: aus gespeicherten Daten oder aus Legacy-Feldern
  if (ah.horizonte && ah.horizonte.length) {
    _ahHorizonte = ah.horizonte.map(h => ({ ...h }));
  } else {
    _ahHorizonte = [];
    const legacyKeys = ['feinWeich','feinSteif','gemLocker','gemDicht','sand','kiesSand','fels','wasserWenig','wasserViel'];
    legacyKeys.forEach(key => {
      const val = ah[key];
      if (!val) return;
      const m = val.match(/(\d+\.?\d*)\s*[–\-]\s*(\d+\.?\d*)/);
      if (m) _ahHorizonte.push({ von: parseFloat(m[1]), bis: parseFloat(m[2]), typ: key });
    });
    _ahHorizonte.sort((a, b) => a.von - b.von);
  }

  // Geländehöhe anzeigen
  const gelaende   = parseFloat(bp.gelaende_swisstopo ?? pair.gelaendehoehe);
  const gelaendeEl = document.getElementById('ah-gelaende-info');
  if (gelaendeEl) gelaendeEl.textContent = !isNaN(gelaende) ? gelaende.toFixed(1) + ' m ü.M.' : '—';

  // Auto-fill Grundwasserspiegel from bkGrundwasser when not yet manually set
  if (!ah.grundwasser && !fd.rs_gw_tiefe && bp.bkGrundwasser) {
    const gwNum = parseFloat(bp.bkGrundwasser);
    if (!isNaN(gwNum) && gwNum > 0) set('ah-grundwasser', gwNum.toFixed(1));
  }

  // Referenzkoten (absolute m ü.M.)
  const gwKote  = getBpGwKote(pairId);
  const refEl   = document.getElementById('ah-koten-ref');
  if (refEl) {
    const kopf  = bp.fundkopf_mueM != null ? parseFloat(bp.fundkopf_mueM) : NaN;
    const sohle = bp.sohle_mueM    != null ? parseFloat(bp.sohle_mueM)    : NaN;
    const hasAny = !isNaN(kopf) || !isNaN(sohle) || gwKote !== null;
    refEl.style.display = hasAny ? '' : 'none';
    const _v = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    _v('ah-ref-kopf',  !isNaN(kopf)  ? kopf.toFixed(1)     + ' m ü.M.' : '—');
    _v('ah-ref-sohle', !isNaN(sohle) ? sohle.toFixed(1)    + ' m ü.M.' : '—');
    _v('ah-ref-gw',    gwKote !== null ? gwKote.toFixed(1)  + ' m ü.M.' : '—');
    const gwCheckEl = document.getElementById('ah-ref-gw-check');
    if (gwCheckEl) {
      if (!isNaN(sohle) && gwKote !== null) {
        const delta = sohle - gwKote;
        gwCheckEl.style.display = '';
        if (delta >= 0) {
          gwCheckEl.style.color = '#16a34a';
          gwCheckEl.textContent = `UK Fundament ${delta.toFixed(1)} m über GW — Standardfundament zulässig`;
        } else {
          gwCheckEl.style.color = '#dc2626';
          gwCheckEl.textContent = `UK Fundament ${Math.abs(delta).toFixed(1)} m unter GW — Wasserhaltung / Spezialfundament prüfen`;
        }
      } else {
        gwCheckEl.style.display = 'none';
      }
    }
  }

  document.getElementById('aushub-modal').style.display = 'flex';
  renderAushubHorizonteList();
  renderAushubDiagram();
  setTimeout(() => document.getElementById('ah-dokNr')?.focus(), 50);
}

function closeAushubModal() {
  document.getElementById('aushub-modal').style.display = 'none';
  _currentAushubPairId = null;
}

function saveAushubEintrag() {
  if (!_currentAushubPairId) return;
  const g = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

  // Lese Horizonte aus der UI neu ein
  const horizList = document.getElementById('ah-horizonte-list');
  const vonEls = horizList ? horizList.querySelectorAll('.ah-h-von') : [];
  const bisEls = horizList ? horizList.querySelectorAll('.ah-h-bis') : [];
  _ahHorizonte.forEach((h, i) => {
    if (vonEls[i]) h.von = parseFloat(vonEls[i].value) || 0;
    if (bisEls[i]) h.bis = parseFloat(bisEls[i].value) || 0;
  });

  // Generiere Legacy-Felder aus Horizonten
  const byType = {};
  _ahHorizonte.forEach(h => {
    if (!h.typ) return;
    if (!byType[h.typ]) byType[h.typ] = [];
    byType[h.typ].push(h.von.toFixed(1) + '–' + h.bis.toFixed(1));
  });
  const legacy = (key) => byType[key] ? byType[key].join(', ') : '';

  const all = loadAllAushub();
  all[_currentAushubPairId] = {
    dokNr:           g('ah-dokNr'),
    ausfuehrung:     g('ah-ausfuehrung'),
    grubeL:          g('ah-grubeL'),
    grubeB:          g('ah-grubeB'),
    grubeT:          g('ah-grubeT'),
    horizonte:       _ahHorizonte.filter(h => h.von !== '' && h.bis !== ''),
    feinWeich:       legacy('feinWeich'),
    feinSteif:       legacy('feinSteif'),
    gemLocker:       legacy('gemLocker'),
    gemDicht:        legacy('gemDicht'),
    sand:            legacy('sand'),
    kiesSand:        legacy('kiesSand'),
    fels:            legacy('fels'),
    wasserWenig:     legacy('wasserWenig'),
    wasserViel:      legacy('wasserViel'),
    grundwasser:     g('ah-grundwasser'),
    einsturz:        g('ah-einsturz'),
    fundGemaessPlan: g('ah-fundGemaessPlan'),
    fundAndererTyp:  g('ah-fundAndererTyp'),
    savedAt:         new Date().toISOString(),
  };
  saveAllAushub(all);

  // Sidebar sync: Tiefe in sec-aushub aktualisieren
  const grubeT = g('ah-grubeT');
  if (grubeT) {
    const auEl = document.getElementById('au-tiefe');
    if (auEl && !auEl.value) { auEl.value = grubeT; saveAusfuehrung(); }
  }

  closeAushubModal();
  renderAushubView();
  renderSidebarAushubSummary(currentPairId);
}

// ---- Horizonte-Verwaltung -----------------------------------------

function ahAddHorizont() {
  const lastBis = _ahHorizonte.length ? _ahHorizonte[_ahHorizonte.length - 1].bis : 0;
  const maxD = parseFloat(document.getElementById('ah-grubeT')?.value) || 3.0;
  _ahHorizonte.push({ von: lastBis, bis: Math.min(lastBis + 0.5, maxD), typ: '' });
  renderAushubHorizonteList();
  renderAushubDiagram();
}

function ahDeleteHorizont(idx) {
  _ahHorizonte.splice(idx, 1);
  // Von-Werte der nachfolgenden Schichten neu verknüpfen
  for (let i = idx; i < _ahHorizonte.length; i++) {
    _ahHorizonte[i].von = i === 0 ? 0 : _ahHorizonte[i - 1].bis;
  }
  renderAushubHorizonteList();
  renderAushubDiagram();
}

function ahSetTyp(idx, key) {
  if (_ahHorizonte[idx]) { _ahHorizonte[idx].typ = key; }
  renderAushubHorizonteList();
  renderAushubDiagram();
}

function ahUpdateBis(idx, v) {
  if (!_ahHorizonte[idx]) return;
  const newBis = parseFloat(v);
  // Nur verarbeiten wenn gültige positive Zahl (nicht bei leerem Feld oder 0 während der Eingabe)
  if (isNaN(newBis) || newBis <= 0) return;
  const delta = newBis - _ahHorizonte[idx].bis;
  _ahHorizonte[idx].bis = newBis;
  // Nachfolgende Schichten verschieben (nur wenn sinnvoller Delta)
  if (delta !== 0) {
    for (let i = idx + 1; i < _ahHorizonte.length; i++) {
      _ahHorizonte[i].von = Math.max(0, parseFloat((_ahHorizonte[i].von + delta).toFixed(3)));
      _ahHorizonte[i].bis = Math.max(_ahHorizonte[i].von + 0.1, parseFloat((_ahHorizonte[i].bis + delta).toFixed(3)));
    }
  }
  renderAushubHorizonteList();
  renderAushubDiagram();
}

function renderAushubHorizonteList() {
  const container = document.getElementById('ah-horizonte-list');
  if (!container) return;

  if (!_ahHorizonte.length) {
    container.innerHTML = `<div style="color:#9ca3af;font-size:11px;font-style:italic;padding:10px 0;text-align:center;">Noch keine Horizonte. Bitte "+ Horizont hinzufügen" klicken.</div>`;
    return;
  }

  container.innerHTML = _ahHorizonte.map((h, idx) => {
    const typ = AUSHUB_TYPEN.find(t => t.key === h.typ);
    const typBtns = AUSHUB_TYPEN.map(t =>
      `<button type="button" onclick="ahSetTyp(${idx},'${t.key}')"
        style="padding:5px 10px;border-radius:5px;border:2px solid ${h.typ===t.key ? t.border : '#e5e7eb'};background:${h.typ===t.key ? t.color : 'white'};font-size:10px;font-weight:700;color:${h.typ===t.key ? '#333' : '#6b7280'};cursor:pointer;white-space:nowrap;transition:all 0.1s;"
        title="${t.label}">${t.label}</button>`
    ).join('');

    return `<div style="background:${typ ? typ.color+'22' : '#f8fafc'};border:1px solid ${typ ? typ.border+'55' : '#e5e7eb'};border-radius:8px;padding:8px 10px;margin-bottom:6px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:7px;">
        <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${typ ? typ.color : '#e5e7eb'};border:1px solid ${typ ? typ.border : '#ccc'};flex-shrink:0;"></span>
        <span style="font-size:11px;color:#6b7280;flex-shrink:0;">von</span>
        <input type="number" step="0.1" min="0" value="${h.von}" class="ah-h-von" readonly
          style="width:58px;padding:4px 6px;border:1px solid #e5e7eb;border-radius:5px;font-size:12px;font-family:inherit;text-align:center;background:#f3f4f6;color:#9ca3af;cursor:default;">
        <span style="font-size:11px;color:#9ca3af;">–</span>
        <input type="number" step="0.1" min="0" value="${h.bis}" class="ah-h-bis" oninput="ahUpdateBis(${idx},this.value)"
          style="width:58px;padding:4px 6px;border:1px solid #d1d5db;border-radius:5px;font-size:12px;font-family:inherit;text-align:center;">
        <span style="font-size:11px;font-weight:600;color:#6b7280;">m</span>
        <span style="flex:1;font-size:11px;font-weight:700;color:#374151;overflow:hidden;text-overflow:ellipsis;">${typ ? typ.label : '<span style="color:#9ca3af;font-style:italic;">—Typ wählen—</span>'}</span>
        <button type="button" onclick="ahDeleteHorizont(${idx})"
          style="padding:2px 8px;border-radius:5px;border:1px solid #fca5a5;background:none;color:#ef4444;cursor:pointer;font-size:12px;font-weight:700;flex-shrink:0;">✕</button>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;">${typBtns}</div>
    </div>`;
  }).join('');
}

function renderAushubDiagram() {
  const container = document.getElementById('ah-diagram-container');
  if (!container) return;
  const maxDepth = Math.max(parseFloat(document.getElementById('ah-grubeT')?.value) || 3.0, 0.5);
  const gw = parseFloat(document.getElementById('ah-grundwasser')?.value);
  const H = 260;
  const scale = H / maxDepth;
  const X0 = 28, W = 95;

  let svg = `<svg width="185" height="${H + 55}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;display:block;">`;

  // OK Terrain (schwarze Linie)
  svg += `<rect x="${X0}" y="8" width="${W}" height="4" fill="#333" rx="1"/>`;
  svg += `<text x="${X0 - 4}" y="11" font-size="8.5" fill="#555" text-anchor="end" font-family="sans-serif">OK T.</text>`;

  // Schichten
  const gridH = H;
  // Hintergrund (leerer Kasten)
  svg += `<rect x="${X0}" y="12" width="${W}" height="${gridH}" fill="#f8fafc" stroke="#e5e7eb" stroke-width="0.8"/>`;

  _ahHorizonte.forEach(h => {
    if (h.von === '' || h.bis === '' || h.bis <= h.von) return;
    const t = AUSHUB_TYPEN.find(x => x.key === h.typ);
    const color  = t ? t.color  : '#e5e7eb';
    const border = t ? t.border : '#ccc';
    const y1 = 12 + h.von * scale;
    const lh = (h.bis - h.von) * scale;
    svg += `<rect x="${X0}" y="${y1}" width="${W}" height="${lh}" fill="${color}" stroke="${border}" stroke-width="0.6"/>`;
    if (lh > 16 && t) {
      svg += `<text x="${X0 + W/2}" y="${y1 + lh/2 + 4}" font-size="9.5" fill="#333" text-anchor="middle" font-family="sans-serif" font-weight="600">${t.short}</text>`;
    }
  });

  // Tiefenachse + Ticks
  svg += `<line x1="${X0}" y1="12" x2="${X0}" y2="${12 + gridH}" stroke="#aaa" stroke-width="0.8"/>`;
  const step = maxDepth <= 2 ? 0.25 : maxDepth <= 5 ? 0.5 : 1.0;
  for (let d = 0; d <= maxDepth + 0.001; d += step) {
    const y = 12 + d * scale;
    const isMajor = (d % 1 < 0.001 || d % 1 > 0.999);
    svg += `<line x1="${X0 - (isMajor ? 5 : 3)}" y1="${y}" x2="${X0}" y2="${y}" stroke="${isMajor ? '#888' : '#ccc'}" stroke-width="0.8"/>`;
    if (isMajor) svg += `<text x="${X0 - 7}" y="${y + 3.5}" font-size="9" fill="#6b7280" text-anchor="end" font-family="sans-serif">${d.toFixed(0)}</text>`;
  }

  // GW Linie
  if (!isNaN(gw) && gw > 0 && gw <= maxDepth) {
    const gwY = 12 + gw * scale;
    svg += `<line x1="${X0}" y1="${gwY}" x2="${X0 + W}" y2="${gwY}" stroke="#2563eb" stroke-width="1.2" stroke-dasharray="5,3"/>`;
    svg += `<polygon points="${X0+W-4},${gwY-3} ${X0+W-4},${gwY+3} ${X0+W+2},${gwY}" fill="#2563eb"/>`;
    svg += `<text x="${X0 + W + 5}" y="${gwY + 3.5}" font-size="8" fill="#2563eb" font-family="sans-serif">GW ${gw}m</text>`;
  }

  // UK Sohle (rot gestrichelt)
  const sohleY = 12 + gridH;
  svg += `<line x1="${X0 - 6}" y1="${sohleY}" x2="${X0 + W + 4}" y2="${sohleY}" stroke="#f87171" stroke-width="1.5" stroke-dasharray="6,3"/>`;
  svg += `<text x="${X0 - 4}" y="${sohleY + 13}" font-size="9.5" fill="#f87171" text-anchor="middle" font-family="sans-serif" font-weight="600">UK Sohle</text>`;

  // Massbeil: Aushubtiefe rechts
  const AX = X0 + W + 16;
  svg += `<line x1="${AX}" y1="12" x2="${AX}" y2="${12 + gridH}" stroke="#f87171" stroke-width="1.2"/>`;
  svg += `<polygon points="${AX-3},${12+8} ${AX+3},${12+8} ${AX},${12}" fill="#f87171"/>`;
  svg += `<polygon points="${AX-3},${12+gridH-8} ${AX+3},${12+gridH-8} ${AX},${12+gridH}" fill="#f87171"/>`;
  const midY2 = 12 + gridH / 2;
  svg += `<text x="${AX + 10}" y="${midY2}" font-size="9.5" fill="#f87171" font-family="sans-serif" font-weight="600"
    transform="rotate(-90,${AX+10},${midY2})" text-anchor="middle">${maxDepth.toFixed(2)} m (Aushubtiefe)</text>`;

  svg += '</svg>';
  container.innerHTML = svg;
}

function renderSidebarAushubSummary(pairId) {
  const el = document.getElementById('aushub-sidebar-summary');
  if (!el || !pairId) return;
  const ah   = loadAllAushub()[pairId]   || {};
  const ausf = loadAllAusfuehrung()[pairId] || {};
  const parts = [];
  if (ausf.datum)  parts.push(new Date(ausf.datum).toLocaleDateString('de-CH'));
  if (ausf.firma || ah.ausfuehrung) parts.push(ausf.firma || ah.ausfuehrung);
  if (ausf.tiefe || ah.grubeT) parts.push('T=' + (ausf.tiefe || ah.grubeT) + ' m');
  if (ah.horizonte?.length) parts.push(ah.horizonte.length + ' Horizont' + (ah.horizonte.length !== 1 ? 'e' : ''));
  const dot = document.getElementById('aushub-status-dot');
  if (dot) {
    const ok = ausf.protokoll === 'ja';
    const pend = ausf.protokoll === 'pendent';
    dot.style.display = (ok || pend) ? 'inline-block' : 'none';
    dot.style.background = ok ? '#16a34a' : '#f59e0b';
  }
  el.innerHTML = parts.length
    ? parts.map(p => `<span style="display:block;font-size:11px;color:#374151;line-height:1.6;">${p}</span>`).join('')
    : '<span style="font-size:11px;color:#9ca3af;font-style:italic;">Noch kein Aushubprotokoll erfasst.</span>';
  renderAushubMiniProfil(pairId);
}

function renderAushubMiniProfil(pairId) {
  const el = document.getElementById('aushub-mini-profil');
  if (!el) return;
  const ah = loadAllAushub()[pairId] || {};
  if (!ah.horizonte || !ah.horizonte.length) { el.innerHTML = ''; return; }
  const maxD = parseFloat(ah.grubeT) || 3;
  const bars = ah.horizonte.map(h => {
    const t = AUSHUB_TYPEN.find(x => x.key === h.typ);
    const pct = Math.min(100, ((h.bis - h.von) / maxD) * 100);
    return `<div title="${t ? t.label : '?'} ${h.von}–${h.bis}m" style="height:${Math.max(4, pct * 0.5)}px;background:${t ? t.color : '#e5e7eb'};border-bottom:1px solid ${t ? t.border : '#ccc'};"></div>`;
  }).join('');
  el.innerHTML = `<div style="border:1px solid #e5e7eb;border-radius:5px;overflow:hidden;margin-bottom:2px;">${bars}</div><div style="font-size:10px;color:#9ca3af;text-align:center;">${ah.horizonte.length} Horizonte · T=${maxD}m</div>`;
}

// ---- Protokollkopf-Modal -------------------------------------------

function openAushubKopfModal() {
  const kopf = loadAushubKopf();
  const kd   = loadKenndaten();
  const pn   = getActiveProjectName() || '';
  // Kontakte: Bauherr und Baufirma aus Kontaktliste vorschlagen
  const contacts = jsonParse(store.getItem(CONTACTS_KEY) || '[]');
  const bauherr  = contacts.find(c => /bauherr|auftraggeber/i.test(c.rolle || ''));
  const baufirma = contacts.find(c => /baufirma|unternehmer|bauunternehmer/i.test(c.rolle || ''));

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('ah-kopf-projekt',    kopf.projekt    || pn);
  set('ah-kopf-bauherr',    kopf.bauherr    || (bauherr  ? (bauherr.firma  || bauherr.name)  : ''));
  set('ah-kopf-baufirma',   kopf.baufirma   || (baufirma ? (baufirma.firma || baufirma.name) : ''));
  set('ah-kopf-strecke',    kopf.strecke    || kd.linie  || '');
  set('ah-kopf-km',         kopf.km         || ((kd.von && kd.bis) ? kd.von + '–' + kd.bis : '') || '');
  set('ah-kopf-datum',      kopf.datum      || '');
  set('ah-kopf-bauleitung', kopf.bauleitung || '');

  document.getElementById('aushub-kopf-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('ah-kopf-projekt')?.focus(), 50);
}

function closeAushubKopfModal() {
  document.getElementById('aushub-kopf-modal').style.display = 'none';
}

function saveAushubKopf() {
  const g = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  saveAushubKopfData({
    projekt:    g('ah-kopf-projekt'),
    bauherr:    g('ah-kopf-bauherr'),
    baufirma:   g('ah-kopf-baufirma'),
    strecke:    g('ah-kopf-strecke'),
    km:         g('ah-kopf-km'),
    datum:      g('ah-kopf-datum'),
    bauleitung: g('ah-kopf-bauleitung'),
  });
  closeAushubKopfModal();
}

// ---- PDF-Export (landscape A4, SBB-Formatlayout) -------------------

function exportAushubPdf() {
  if (!window.jspdf?.jsPDF) { ui.toast('jsPDF nicht geladen.', 'fehler'); return; }
  const { jsPDF } = window.jspdf;
  const doc    = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
  const W      = 297, H = 210;
  const pairs  = getFilteredSorted();
  const allAh  = loadAllAushub();
  const allAusf= loadAllAusfuehrung();
  const kopf   = loadAushubKopf();
  const pn     = getActiveProjectName() || 'Projekt';
  const today  = new Date().toLocaleDateString('de-CH');

  // ---- Protokollkopf ----
  doc.setFont(undefined,'bold');
  doc.setFontSize(11);
  doc.setTextColor(26,58,92);
  doc.text('Aushubprotokoll', 14, 12);
  doc.setFont(undefined,'normal');
  doc.setFontSize(8);
  doc.setTextColor(55,65,81);

  const kopfLines = [
    ['Projekt:', kopf.projekt || pn,       'Bauherr:',  kopf.bauherr || ''],
    ['Baufirma:', kopf.baufirma || '',     'Strecke:',  kopf.strecke || ''],
    ['km:',       kopf.km || '',           'Datum:',    kopf.datum ? new Date(kopf.datum).toLocaleDateString('de-CH') : today],
    ['Bauleitung:', kopf.bauleitung || '', 'Erstellt:', today],
  ];
  let ky = 19;
  kopfLines.forEach(row => {
    doc.setFont(undefined,'bold'); doc.text(row[0], 14, ky);
    doc.setFont(undefined,'normal'); doc.text(row[1], 36, ky);
    doc.setFont(undefined,'bold'); doc.text(row[2], 120, ky);
    doc.setFont(undefined,'normal'); doc.text(row[3], 145, ky);
    ky += 5;
  });
  doc.setDrawColor(200,210,230);
  doc.line(14, ky, W-14, ky);
  ky += 4;

  // ---- Spalten-Definition ----
  const cols = [
    { label:'Mast',          key:'mast',         w:16, grp:'' },
    { label:'km',            key:'km',            w:14, grp:'' },
    { label:'Ausführung',    key:'ausfuehrung',   w:24, grp:'' },
    { label:'L [m]',         key:'grubeL',        w:12, grp:'Grubenausmass' },
    { label:'B/D [m]',       key:'grubeB',        w:12, grp:'Grubenausmass' },
    { label:'T [m]',         key:'grubeT',        w:12, grp:'Grubenausmass' },
    { label:'Lhm weich',     key:'feinWeich',     w:16, grp:'Feinkörnig/Gem.' },
    { label:'Lhm steif',     key:'feinSteif',     w:16, grp:'Feinkörnig/Gem.' },
    { label:'Gem.locker',    key:'gemLocker',     w:16, grp:'Feinkörnig/Gem.' },
    { label:'Gem.dicht',     key:'gemDicht',      w:16, grp:'Feinkörnig/Gem.' },
    { label:'Sand',          key:'sand',          w:14, grp:'Grob/Fels' },
    { label:'Kies-Sand',     key:'kiesSand',      w:16, grp:'Grob/Fels' },
    { label:'Fels',          key:'fels',          w:13, grp:'Grob/Fels' },
    { label:'W.wenig',       key:'wasserWenig',   w:15, grp:'Wasser/GW' },
    { label:'W.viel',        key:'wasserViel',    w:14, grp:'Wasser/GW' },
    { label:'GW [m]',        key:'grundwasser',   w:14, grp:'Wasser/GW' },
    { label:'Einsturz',      key:'einsturz',      w:15, grp:'Wasser/GW' },
    { label:'gem.Plan',      key:'fundGemaessPlan',w:20,grp:'Fundamenttyp' },
    { label:'And.Typ',       key:'fundAndererTyp', w:16,grp:'Fundamenttyp' },
  ];

  // Gruppen berechnen
  const grpMap = {};
  let x0 = 14;
  cols.forEach(c => {
    if (c.grp) {
      if (!grpMap[c.grp]) grpMap[c.grp] = { x: x0, w: 0 };
      grpMap[c.grp].w += c.w;
    }
    x0 += c.w;
  });

  // Gruppen-Header
  const grpColors = {
    'Grubenausmass':  [26,58,92],
    'Feinkörnig/Gem.':[22,163,74],
    'Grob/Fels':      [217,119,6],
    'Wasser/GW':      [37,99,235],
    'Fundamenttyp':   [124,58,237],
  };
  doc.setFontSize(6.5);
  Object.entries(grpMap).forEach(([name, g]) => {
    const col = grpColors[name] || [80,80,80];
    doc.setTextColor(...col);
    doc.setFont(undefined,'bold');
    doc.text(name, g.x + g.w/2, ky+3, { align:'center' });
    doc.setDrawColor(...col);
    doc.line(g.x+1, ky+4.5, g.x+g.w-1, ky+4.5);
  });
  ky += 6;

  // Spalten-Header
  doc.setFontSize(6);
  doc.setFont(undefined,'bold');
  doc.setTextColor(26,58,92);
  let xh = 14;
  cols.forEach(c => {
    doc.setFillColor(240,244,250);
    doc.rect(xh, ky-3, c.w, 5.5, 'F');
    doc.text(c.label, xh + c.w/2, ky+1, { align:'center' });
    xh += c.w;
  });
  doc.setDrawColor(200,210,230);
  doc.line(14, ky+2.5, W-14, ky+2.5);
  ky += 5.5;

  // Datenzeilen
  doc.setFont(undefined,'normal');
  doc.setFontSize(7.5);
  let rowIdx = 0;
  pairs.forEach(p => {
    if (ky > H - 18) { doc.addPage(); ky = 14; }
    const ah   = allAh[p.id]   || {};
    const ausf = allAusf[p.id] || {};
    const km   = p.km_rs ? parseFloat(p.km_rs).toFixed(3) : '';
    const rowData = {
      mast:           'Mast ' + (p.mast || '—'),
      km,
      ausfuehrung:    ah.ausfuehrung || ausf.firma || '',
      grubeL:         ah.grubeL     || '',
      grubeB:         ah.grubeB     || '',
      grubeT:         ah.grubeT     || '',
      feinWeich:      ah.feinWeich  || '',
      feinSteif:      ah.feinSteif  || '',
      gemLocker:      ah.gemLocker  || '',
      gemDicht:       ah.gemDicht   || '',
      sand:           ah.sand       || '',
      kiesSand:       ah.kiesSand   || '',
      fels:           ah.fels       || '',
      wasserWenig:    ah.wasserWenig|| '',
      wasserViel:     ah.wasserViel || '',
      grundwasser:    ah.grundwasser|| '',
      einsturz:       ah.einsturz  || '',
      fundGemaessPlan:ah.fundGemaessPlan || '',
      fundAndererTyp: ah.fundAndererTyp  || '',
    };
    doc.setFillColor(rowIdx % 2 === 0 ? 255 : 248,250,255);
    let xr = 14;
    cols.forEach(c => {
      doc.setFillColor(rowIdx % 2 === 0 ? 255 : 248);
      doc.rect(xr, ky-3, c.w, 5.5, 'F');
      doc.setTextColor(55,65,81);
      const txt = String(rowData[c.key] || '');
      doc.text(txt, xr + c.w/2, ky+1, { align:'center', maxWidth: c.w - 1 });
      xr += c.w;
    });
    doc.setDrawColor(229,231,235);
    doc.line(14, ky+2.5, W-14, ky+2.5);
    ky += 5.5;
    rowIdx++;
  });

  // Fussnote
  ky += 2;
  doc.setFontSize(6.5); doc.setTextColor(156,163,175);
  doc.text('*) L = Länge längs zum Gleis  B = Breite quer zum Gleis  D = Rohrdurchmesser (Rohrnachtrieb)  T = mittlere Eingrabtiefe  —  Tiefenangaben ab OK Terrain in Meter', 14, ky);

  doc.save('Aushubprotokoll_' + pn.replace(/[^a-zA-Z0-9_]/g,'_') + '_' + today.replace(/\./g,'-') + '.pdf');
}

// ---- Excel-Export --------------------------------------------------

function exportAushubXlsx() {
  if (!window.XLSX) { ui.toast('SheetJS nicht geladen.', 'fehler'); return; }
  const pairs  = getFilteredSorted();
  const allAh  = loadAllAushub();
  const allAusf= loadAllAusfuehrung();
  const kopf   = loadAushubKopf();
  const pn     = getActiveProjectName() || 'Projekt';
  const today  = new Date().toLocaleDateString('de-CH');

  // Kopfzeile Protokoll
  const row0 = ['Aushubprotokoll', pn, '', 'Datum:', today, '', 'Bauherr:', kopf.bauherr||'', '', 'Strecke/km:', (kopf.km||'')];

  // Gruppen-Header
  const row1 = ['Mast','km','Ausführung',
    'L [m]','B/D [m]','T [m]',
    'Lhm weich','Lhm steif','Gem.locker','Gem.dicht',
    'Sand','Kies-Sand','Fels',
    'Wasser wenig','Wasser viel','GW [m]','Einsturz',
    'gem.Plan','And.Typ'];

  const dataRows = pairs.map(p => {
    const ah   = allAh[p.id]   || {};
    const ausf = allAusf[p.id] || {};
    return [
      'Mast ' + (p.mast || '—'),
      p.km_rs ? parseFloat(p.km_rs).toFixed(3) : '',
      ah.ausfuehrung    || ausf.firma || '',
      ah.grubeL         || '',
      ah.grubeB         || '',
      ah.grubeT         || '',
      ah.feinWeich      || '',
      ah.feinSteif      || '',
      ah.gemLocker      || '',
      ah.gemDicht       || '',
      ah.sand           || '',
      ah.kiesSand       || '',
      ah.fels           || '',
      ah.wasserWenig    || '',
      ah.wasserViel     || '',
      ah.grundwasser    || '',
      ah.einsturz       || '',
      ah.fundGemaessPlan|| '',
      ah.fundAndererTyp || '',
    ];
  });

  const aoa = [row0, row1, ...dataRows,
    [],
    ['*) L = Länge längs zum Gleis  B = Breite quer zum Gleis  D = Rohrdurchmesser  T = mittlere Eingrabtiefe'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    {wch:14},{wch:10},{wch:22},
    {wch:8},{wch:8},{wch:8},
    {wch:14},{wch:14},{wch:14},{wch:14},
    {wch:10},{wch:12},{wch:10},
    {wch:13},{wch:12},{wch:10},{wch:12},
    {wch:16},{wch:16},
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Aushubprotokoll');
  XLSX.writeFile(wb, 'Aushubprotokoll_' + pn.replace(/[^a-zA-Z0-9_]/g,'_') + '.xlsx');
}

// ============================================================
// VERLAUFS-NAVIGATION (Browser-Back/Forward)
// ============================================================
let _navHistory  = [];   // Array von {type:'overview'|'detail', phase, view?, pairId?}
let _navIdx      = -1;   // Aktuelle Position im Verlauf
let _navSkipPush = false; // Verhindert Push während Verlaufs-Wiederherstellung

function pushNavState(state) {
  if (_navSkipPush) return;
  // Zukunft abschneiden
  _navHistory = _navHistory.slice(0, _navIdx + 1);
  // Doppelten aufeinanderfolgenden Eintrag verhindern
  const last = _navHistory[_navHistory.length - 1];
  if (last) {
    if (state.type === 'overview' && last.type === 'overview' &&
        last.view === state.view && last.phase === state.phase) return;
    if (state.type === 'detail' && last.type === 'detail' &&
        last.pairId === state.pairId && last.phase === state.phase) return;
  }
  _navHistory.push({ ...state });
  if (_navHistory.length > 60) _navHistory.shift();
  _navIdx = _navHistory.length - 1;
  updateNavButtons();
}

function navBack() {
  if (_navIdx <= 0) return;
  _navIdx--;
  if (overviewMap) overviewMap.closePopup();
  _navSkipPush = true;
  try { _restoreNavState(_navHistory[_navIdx]); } finally { _navSkipPush = false; }
  updateNavButtons();
}

function navForward() {
  if (_navIdx >= _navHistory.length - 1) return;
  _navIdx++;
  if (overviewMap) overviewMap.closePopup();
  _navSkipPush = true;
  try { _restoreNavState(_navHistory[_navIdx]); } finally { _navSkipPush = false; }
  updateNavButtons();
}

function _restoreNavState(state) {
  if (!state) return;
  // Phase wechseln falls nötig
  if (state.phase && state.phase !== _activePhase) {
    // Kein sel.value mehr nötig: der Phasen-Schrittanzeiger wird von
    // setPhase() über renderPhaseBanner() neu aufgebaut.
    setPhase(state.phase);
  }
  if (state.type === 'detail') {
    showDetail(state.pairId);
  } else {
    // Detail-View aufräumen falls sichtbar
    const dv = document.getElementById('detail-view');
    if (dv && dv.style.display !== 'none') {
      if (pendingDrag) cancelDrag();
      if (watchId) { navigator.geolocation.clearWatch(watchId); watchId = null; }
      destroySketchListeners();
      if (leafletMap) { try { leafletMap.remove(); } catch(e) {} leafletMap = null; }
    }
    // Übersicht IMMER sicherstellen (auch wenn detail bereits hidden war)
    if (dv) { dv.style.display = 'none'; dv.style.visibility = 'hidden'; }
    document.getElementById('overview-view').style.display = 'block';
    bannerProjektZeigen(true);
    if (overviewMap) overviewMap.closePopup();
    setTimeout(updatePhaseSelectState, 50);
    setOverviewView(state.view);
  }
}

function _navStateLabel(state) {
  if (!state) return '';
  if (state.type === 'detail') {
    const p = PAIRS.find(x => x.id === state.pairId);
    if (p) return p.bezeichnung || (p.mast ? 'Mast ' + p.mast : 'Standort ' + p.id);
    return 'Standort';
  }
  return { karten:'Kacheln', liste:'Liste', karte:'Karte', baugrund:'Baugrund', fundamente:'Bausortiment', programm:'Programm', termine:'Termine', abnahme:'Abnahmen', bauprogramm:'Bauprogramm' }[state.view] || state.view;
}

function updateNavButtons() {
  const prev = document.getElementById('banner-nav-prev');
  const next = document.getElementById('banner-nav-next');
  if (!prev || !next) return;
  const canBack = _navIdx > 0;
  const canFwd  = _navIdx < _navHistory.length - 1;
  // Aussehen haengt an :disabled (siehe .nav-pfeil), hier nur der Zustand.
  prev.disabled = !canBack;
  next.disabled = !canFwd;
  // Tooltip mit Ziel-Bezeichnung
  const prevState = canBack ? _navHistory[_navIdx - 1] : null;
  const nextState = canFwd  ? _navHistory[_navIdx + 1] : null;
  prev.title = prevState ? '← ' + _navStateLabel(prevState) : 'Zurück';
  next.title = nextState ? _navStateLabel(nextState) + ' →' : 'Vorwärts';
}

// Rückwärtskompat: updateBannerNavButtons bleibt als Alias erhalten
function updateBannerNavButtons() { updateNavButtons(); }

// Kartenhöhe dynamisch an den verbleibenden Viewport anpassen
function resizeOverviewMap() {
  const wrap = document.getElementById('overview-map-wrap');
  const mapEl = document.getElementById('overview-map');
  if (!wrap || mapEl.closest('#overview-view')?.style.display === 'none') return;
  if (wrap.style.display === 'none') return;
  const top = wrap.getBoundingClientRect().top;
  const available = window.innerHeight - top - 16; // 16px Abstand unten
  mapEl.style.height = Math.max(300, available) + 'px';
  if (overviewMap) overviewMap.invalidateSize();
}
window.addEventListener('resize', resizeOverviewMap);
new ResizeObserver(() => {
  const hh = document.querySelector('.header')?.getBoundingClientRect().height || 85;
  document.documentElement.style.setProperty('--app-header-h', hh + 'px');
}).observe(document.querySelector('.header'));

// ============================================================
// LIST MULTI-SELECT
// ============================================================
let selectedIds = new Set();

function updateBulkBar() {
  const bar = document.getElementById('bulk-bar');
  const cnt = document.getElementById('bulk-count');
  bar.style.display = selectedIds.size > 0 ? 'flex' : 'none';
  cnt.textContent = `${selectedIds.size} ausgewählt`;
  const allCb = document.getElementById('select-all-cb');
  if (allCb) {
    const visibleIds = [...document.querySelectorAll('.row-cb')].map(c => +c.dataset.id);
    allCb.checked = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
    allCb.indeterminate = !allCb.checked && visibleIds.some(id => selectedIds.has(id));
  }
  // Custom-Tag-Dropdown befüllen
  const sel = document.getElementById('bulk-custom-tag-select');
  if (sel) {
    sel.innerHTML = '<option value="">– Tag wählen –</option>' +
      customTags.map(t => `<option value="${t.id}" style="color:${t.color};">${t.name}</option>`).join('');
  }
  // Sammelzuweisung Fundamenttyp: nur im Bauprojekt, wo Typen vergeben werden
  const ftWrap = document.getElementById('bulk-fundtyp-wrap');
  if (ftWrap) {
    const zeigen = _activePhase === 'bauprojekt';
    ftWrap.style.display = zeigen ? 'flex' : 'none';
    const ftSel = document.getElementById('bulk-fundtyp-select');
    if (zeigen && ftSel) {
      // Dieselbe Optionsliste wie im Bearbeiten-Modus der Zeilen
      const vorher = ftSel.value;
      ftSel.innerHTML = _buildListFtOpts(null);
      ftSel.value = vorher;
    }
  }
}

// Sammelzuweisung aus der allgemeinen Liste heraus
function bulkFundtypZuweisen() {
  const wert = document.getElementById('bulk-fundtyp-select')?.value;
  if (!wert) { ui.toast('Bitte zuerst einen Fundamenttyp wählen.', 'fehler'); return; }
  if (!selectedIds.size) return;
  selectedIds.forEach(id => assignFundtypFromTable(id, wert));
  ui.toast(selectedIds.size + ' Standorte zugewiesen', 'erfolg');
  renderList();
}

function toggleRowSelect(id, cb) {
  if (cb.checked) selectedIds.add(id); else selectedIds.delete(id);
  const tr = cb.closest('tr');
  tr.style.background = cb.checked ? '#eff6ff' : '';
  updateBulkBar();
}


function toggleSelectAll(cb) {
  document.querySelectorAll('.row-cb').forEach(c => {
    const id = +c.dataset.id;
    c.checked = cb.checked;
    if (cb.checked) selectedIds.add(id); else selectedIds.delete(id);
    c.closest('tr').style.background = cb.checked ? '#eff6ff' : '';
  });
  updateBulkBar();
}

function bulkClear() {
  selectedIds.clear();
  document.querySelectorAll('.row-cb').forEach(c => { c.checked = false; c.closest('tr').style.background = ''; });
  updateBulkBar();
}

function bulkSetStatus(status) {
  if (!selectedIds.size) return;
  selectedIds.forEach(id => setPairData(id, { status }));
  updateProgress();
  renderList();
}

function bulkToggleCustomTag() {
  const tagId = document.getElementById('bulk-custom-tag-select')?.value;
  if (!tagId || !selectedIds.size) return;
  pushUndo();
  selectedIds.forEach(id => togglePairTag(id, tagId));
  renderList();
  renderCards();
}

async function deletePair(id) {
  const p = PAIRS.find(x => x.id === id);
  const name = p ? (p.mast ? `Mast ${p.mast}` : p.bezeichnung || 'Standort') : 'Standort';
  if (!await ui.confirm(`«${name}» wirklich löschen?`)) return;
  pushUndo();
  const idx = PAIRS.findIndex(x => x.id === id);
  if (idx >= 0) PAIRS.splice(idx, 1);
  delete appData[id];
  saveData(appData);
  savePairs();
  selectedIds.delete(id);
  updateProgress();
  renderList();
  renderCards();
}

async function bulkDelete() {
  if (!selectedIds.size) return;
  if (!await ui.confirm(`${selectedIds.size} Standort(e) wirklich löschen?`)) return;
  pushUndo();
  selectedIds.forEach(id => {
    const idx = PAIRS.findIndex(x => x.id === id);
    if (idx >= 0) PAIRS.splice(idx, 1);
    delete appData[id];
  });
  saveData(appData);
  savePairs();
  selectedIds.clear();
  updateProgress();
  renderList();
  renderCards();
}

function renderList() {
  _listExtraCols = loadListExtraCols();
  const cols     = getListColumns();
  const isBPlist = _activePhase !== 'baugrund';

  // Sortier-Pfeil Hilfsfunktion
  const sortArrow = col => {
    if (currentSort !== col) return '<span style="opacity:0.3;font-size:9px;"> ↕</span>';
    return _listSortDir === 1
      ? '<span style="font-size:9px;"> ▲</span>'
      : '<span style="font-size:9px;"> ▼</span>';
  };
  const thS = 'padding:9px 10px;text-align:left;font-size:11px;font-weight:600;cursor:pointer;user-select:none;white-space:nowrap;';

  // Header dynamisch setzen (phasenabhängige Spalten + Bezeichnung erste Spalte)
  const thead = document.querySelector('#list-table thead tr');
  if (thead) {
    const fixedStart = thead.cells[0].outerHTML;
    const fixedEnd   = Array.from(thead.cells).slice(-2).map(c => c.outerHTML).join('');
    const nameLabel  = _activePhase === 'baugrund' ? 'Bezeichnung / Nr' : 'Mast / Nr';
    thead.innerHTML  = fixedStart
      + `<th onclick="setListSort('name')" style="${thS}">${nameLabel}${sortArrow('name')}</th>`
      + (isBPlist ? `<th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:600;white-space:nowrap;">Massnahme</th>` : '')
      + cols.map(c => {
          const sortable = ['km','mast','status','fundtyp','aushub','material','abnahme','tag','tiefe'].includes(c.key);
          return sortable
            ? `<th onclick="setListSort('${c.key}')" style="${thS}">${c.label}${sortArrow(c.key)}</th>`
            : `<th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:600;white-space:nowrap;">${c.label}</th>`;
        }).join('')
      + fixedEnd;
  }

  const tbody = document.getElementById('list-body');
  tbody.innerHTML = '';

  const filtered = getFilteredSorted(); // bereits nach Phase gefiltert

  // Eintragszahl aktualisieren
  const countEl = document.getElementById('list-count');
  if (countEl) countEl.textContent = `${filtered.length} Einträge`;

  if (!filtered.length) {
    const colCount = 2 + cols.length + 2;
    tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center;padding:40px;color:#9ca3af;font-size:13px;">
      <strong style="color:#6b7280;">Keine Einträge vorhanden</strong>
    </td></tr>`;
    updateBulkBar();
    return;
  }

  filtered.forEach(p => {
    const pd = getPairData(p.id);
    const checked = selectedIds.has(p.id);
    const bpData = isBPlist ? (loadAllBauprojekt()[p.id] || {}) : {};
    const massCol = isBPlist ? getMassnahmeColor(bpData) : null;
    const massLbl = isBPlist ? getMassnahmeLabel(bpData) : null;
    const massSet = isBPlist && (bpData.massnahme || bpData.bestand || (bpData.fundtyp||'').startsWith('spezial-prov'));

    const tr = document.createElement('tr');
    tr.style.background = checked ? '#eff6ff' : '';

    const dynCells = cols.map(c => {
      if (_listEditMode && isBPlist) {
        if (c.key === 'fundtyp') {
          return `<td onclick="event.stopPropagation()" style="padding:4px 8px;">
            <select onchange="assignFundtypFromTable(${p.id},this.value)" id="list-ft-sel-${p.id}"
              style="padding:3px 5px;border:1px solid #e5e7eb;border-radius:5px;font-size:11px;font-family:inherit;background:white;max-width:160px;">
              ${_buildListFtOpts(p.id)}
            </select></td>`;
        }
        if (c.key === 'neigung') {
          const nv = bpData.neigung || '';
          return `<td onclick="event.stopPropagation()" style="padding:4px 8px;">
            <select onchange="saveListField(${p.id},'neigung',this.value)" style="padding:3px 5px;border:1px solid #e5e7eb;border-radius:5px;font-size:11px;font-family:inherit;background:white;">
              <option value="" ${!nv?'selected':''}>—</option>
              <option value="≤14°" ${nv==='≤14°'?'selected':''}>≤14°</option>
              <option value="14–33°" ${nv==='14–33°'?'selected':''}>14–33°</option>
              <option value=">33°" ${nv==='>33°'?'selected':''}>>33°</option>
            </select></td>`;
        }
        if (c.key === 'reftyp') {
          const rv = getBpRefFamilie(bpData);
          // Beim Standardfundament IST der Typ die Referenz — nichts zu wählen.
          const zugFt  = loadFtProfile().find(t => t.id === bpData.ftProfilId);
          const istStd = zugFt?.typ === 'standard';
          if (istStd) {
            return `<td onclick="event.stopPropagation()" style="padding:4px 8px;">
              <span title="Standardfundament — Referenztyp ergibt sich aus dem Typ" style="font-size:11px;font-weight:600;color:#9ca3af;">${rv || '—'}</span></td>`;
          }
          const fams = getFtFamilies();
          return `<td onclick="event.stopPropagation()" style="padding:4px 8px;">
            <select onchange="saveListRefFamilie(${p.id},this.value)" style="padding:3px 5px;border:1px solid #e5e7eb;border-radius:5px;font-size:11px;font-family:inherit;background:white;">
              <option value="">—</option>
              ${fams.map(f => `<option value="${f}"${rv===f?' selected':''}>${f}</option>`).join('')}
            </select></td>`;
        }
      }
      const clickAct = c.clickFn
        ? `${c.clickFn(p.id)};event.stopPropagation()`
        : `showDetail(${p.id})`;
      return `<td onclick="${clickAct}" style="cursor:pointer;font-size:12px;">${c.render(p)}</td>`;
    }).join('');

    const nameCell = isBPlist
      ? `<td onclick="showDetail(${p.id})" style="cursor:pointer;">
           <strong>Mast ${p.mast || '—'}</strong>
           ${p.bezeichnung ? `<div style="font-size:10px;color:#9ca3af;">${p.bezeichnung}</div>` : ''}
         </td>`
      : `<td onclick="showDetail(${p.id})" style="cursor:pointer"><strong>${p.bezeichnung || 'Standort '+p.id}</strong></td>`;

    const massnahmeCell = !isBPlist ? '' : _listEditMode
      ? `<td onclick="event.stopPropagation()" style="padding:4px 8px;white-space:nowrap;">
           <select onchange="saveListMassnahme(${p.id},this.value)" style="padding:3px 5px;border:1px solid #e5e7eb;border-radius:5px;font-size:11px;font-family:inherit;background:white;max-width:130px;">
             <option value="">— Massnahme —</option>
             <option value="neu|" ${(bpData.bestand==='neu'||(!bpData.bestand&&!bpData.massnahme)) ? 'selected':''}>Neubau</option>
             <option value="prov|" ${bpData.bestand==='prov' ? 'selected':''}>Provisorium</option>
             <option value="bestand|erhalten" ${bpData.bestand==='bestand'&&bpData.massnahme==='erhalten' ? 'selected':''}>Bestand erhalten</option>
             <option value="bestand|sicherung" ${bpData.bestand==='bestand'&&bpData.massnahme==='sicherung' ? 'selected':''}>Sicherung</option>
             <option value="bestand|abbruch" ${bpData.bestand==='bestand'&&bpData.massnahme==='abbruch' ? 'selected':''}>Abbruch + Neubau</option>
             <option value="bestand|abbruch-nur" ${bpData.bestand==='bestand'&&bpData.massnahme==='abbruch-nur' ? 'selected':''}>Abbruch (nur)</option>
           </select>
         </td>`
      : `<td onclick="showDetail(${p.id})" style="cursor:pointer;padding:6px 10px;white-space:nowrap;">
           ${massSet
             ? `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;background:${massCol}22;color:${massCol};border:1px solid ${massCol}44;">${massLbl}</span>`
             : `<span style="font-size:10px;color:#d1d5db;">—</span>`}
         </td>`;

    tr.innerHTML = `
      <td onclick="event.stopPropagation()"><input type="checkbox" class="row-cb" data-id="${p.id}" ${checked?'checked':''} onchange="toggleRowSelect(${p.id},this)"></td>
      ${nameCell}
      ${massnahmeCell}
      ${dynCells}
      <td onclick="event.stopPropagation()" style="white-space:nowrap;">
        <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
          ${(pd.tags||[]).map(tid=>{const t=customTags.find(x=>x.id===tid);return t?`<span style="padding:2px 6px;border-radius:10px;font-size:10px;font-weight:600;background:${t.color}22;color:${t.color};">${t.name}</span>`:''}).join('')}
          <button onclick="openListTagPicker(${p.id},this)" title="Tags zuordnen" style="padding:3px 6px;border-radius:5px;border:1px solid #e5e7eb;background:white;cursor:pointer;color:#6b7280;display:flex;align-items:center;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg></button>
        </div>
      </td>
      <td><div class="list-icons">
        ${!isBPlist && hasFelddaten(p.id) ? '<span title="Felddaten" style="color:#9ca3af;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></span>' : ''}
        ${pd.sketch ? '<span title="Skizze" style="color:#9ca3af;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></span>' : ''}
        ${pd.comment ? '<span title="Kommentar" style="color:#9ca3af;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>' : ''}
        <button onclick="event.stopPropagation();deletePair(${p.id})" title="Löschen"
          style="background:none;border:none;cursor:pointer;color:#d1d5db;padding:2px;display:flex;align-items:center;line-height:1;"
          onmouseover="this.style.color='#dc2626'" onmouseout="this.style.color='#d1d5db'">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div></td>`;
    tbody.appendChild(tr);
  });
  updateBulkBar();

  // ── Installationsflächen-Tabelle anhängen ──
  const _instWrap = document.getElementById('inst-list-section');
  if (_instWrap) _instWrap.remove();
  if (isBPlist) {
    const instArr = getInstallationen();
    if (instArr.length) {
      const _iSec = document.createElement('div');
      _iSec.id = 'inst-list-section';
      _iSec.style.cssText = 'margin-top:18px;';
      const _iRows = instArr.map(p => {
        const typL   = INST_TYP_LABELS[p.installTyp] || p.installTyp || '—';
        const fStr   = p.flaeche ? `${p.flaeche} m²` : (p.flaecheL && p.flaecheB ? `${p.flaecheL}×${p.flaecheB} m` : '—');
        const vonStr = p.von ? p.von.split('-').reverse().join('.') : '—';
        const bisStr = p.bis ? p.bis.split('-').reverse().join('.') : '—';
        const _pd    = getPairData(p.id);
        const stCol  = getStatusColor(_pd.status);
        const stLbl  = statusLabel(_pd.status);
        const linkCell = p.instBestellLink
          ? `<a href="${p.instBestellLink}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="color:#1a3a5c;font-weight:600;font-size:11px;text-decoration:none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">Link <svg style="vertical-align:middle" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>`
          : '<span style="color:#d1d5db;">—</span>';
        return `<tr class="list-hover-row" onclick="showDetail(${p.id})" style="cursor:pointer;">
          <td style="padding:7px 10px;font-weight:600;font-size:12px;">${p.bezeichnung || 'Installation ' + p.id}</td>
          <td style="padding:7px 10px;font-size:12px;">${typL}</td>
          <td style="padding:7px 10px;font-size:12px;">${fStr}</td>
          <td style="padding:7px 10px;font-size:12px;white-space:nowrap;">${vonStr}</td>
          <td style="padding:7px 10px;font-size:12px;white-space:nowrap;">${bisStr}</td>
          <td style="padding:7px 10px;font-size:12px;">${linkCell}</td>
          <td style="padding:7px 10px;"><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:${stCol}22;color:${stCol};border:1px solid ${stCol}44;">${stLbl}</span></td>
          <td style="padding:7px 10px;" onclick="event.stopPropagation()">
            <div style="display:flex;gap:4px;">
              <button onclick="openCreateInstallation(${p.id})" style="padding:2px 7px;border-radius:5px;border:1px solid #d1d5db;background:white;color:#374151;font-size:10px;font-weight:600;cursor:pointer;">Bearbeiten</button>
              <button onclick="deleteInstallation(${p.id})" style="padding:2px 7px;border-radius:5px;border:1px solid #fca5a5;background:#fff5f5;color:#dc2626;font-size:10px;font-weight:600;cursor:pointer;">Löschen</button>
            </div>
          </td>
        </tr>`;
      }).join('');
      _iSec.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
          <div style="flex:1;height:1px;background:#e5e7eb;"></div>
          <span style="font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;">Baustelleninstallationen</span>
          <div style="flex:1;height:1px;background:#e5e7eb;"></div>
        </div>
        <table class="list-table" style="width:100%;">
          <thead>
            <tr>
              <th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:600;white-space:nowrap;">Bezeichnung</th>
              <th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:600;">Typ</th>
              <th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:600;">Fläche</th>
              <th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:600;">Von</th>
              <th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:600;">Bis</th>
              <th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:600;">Bestelllink</th>
              <th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:600;">Status</th>
              <th style="padding:9px 10px;"></th>
            </tr>
          </thead>
          <tbody>${_iRows}</tbody>
        </table>`;
      const _listWrap = document.getElementById('list-wrap');
      if (_listWrap) _listWrap.appendChild(_iSec);
    }
  }
}

function _showListEditNotice(msg, isWarn) {
  let el = document.getElementById('list-edit-notice');
  if (!el) {
    el = document.createElement('div');
    el.id = 'list-edit-notice';
    el.style.cssText = 'position:fixed;bottom:76px;left:50%;transform:translateX(-50%);z-index:9999;padding:8px 18px;border-radius:8px;font-size:12px;font-weight:600;box-shadow:0 4px 14px rgba(0,0,0,0.18);max-width:480px;text-align:center;pointer-events:none;transition:opacity 0.3s;';
    document.body.appendChild(el);
  }
  el.style.background = isWarn ? '#fef3c7' : '#1a3a5c';
  el.style.color      = isWarn ? '#92400e'  : 'white';
  el.style.border     = isWarn ? '1px solid #fcd34d' : 'none';
  el.textContent = msg;
  el.style.opacity = '1';
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; setTimeout(() => { el.style.display = 'none'; }, 300); }, 3500);
}

function _listTargets(pairId) {
  return (selectedIds.size > 1 && selectedIds.has(pairId)) ? [...selectedIds] : [pairId];
}

function saveListMassnahme(pairId, combined) {
  if (!combined) return;
  const [bestand, massnahme] = combined.split('|');
  const all     = loadAllBauprojekt();
  const targets = _listTargets(pairId);
  targets.forEach(id => {
    all[id] = { ...(all[id] || {}), bestand, massnahme: massnahme || '' };
  });
  saveAllBauprojekt(all);
  if (targets.length > 1) _showListEditNotice(`${targets.length} Positionen aktualisiert`);
  renderList();
}

function saveListField(pairId, key, value) {
  const all     = loadAllBauprojekt();
  const targets = _listTargets(pairId);
  targets.forEach(id => {
    const existing = all[id] || {};
    const update = { ...existing, [key]: value };
    // Neigung manuell gesetzt → importVerify.neigung quittieren
    if (key === 'neigung' && value) {
      const iv = { ...(update.importVerify || {}) };
      delete iv.neigung;
      update.importVerify = Object.keys(iv).length ? iv : undefined;
    }
    all[id] = update;
  });
  saveAllBauprojekt(all);
  if (targets.length > 1) _showListEditNotice(`${targets.length} Positionen aktualisiert`);
  renderList();
}
function _buildListFtOpts(pairId) {
  const typen     = loadFtProfile();
  const zuws      = loadFtZuweisungen();
  const assignedId= zuws[pairId] || '';
  const typenStd  = typen.filter(t => t.typ === 'standard');
  const typenSpez = typen.filter(t => t.typ !== 'standard');
  const familien  = [...new Set(typenStd.map(t => t.name.split('/')[0].trim()))];
  const assignedFam = assignedId && typenStd.find(t => t.id === assignedId)
    ? typenStd.find(t => t.id === assignedId)?.name.split('/')[0].trim() : '';
  let html = '<option value="">— kein Typ —</option>';
  if (familien.length) html += `<optgroup label="── Standardtypen ──────">${familien.map(f => `<option value="__fam__${f}" ${assignedFam===f?'selected':''}>${f}</option>`).join('')}</optgroup>`;
  if (typenSpez.length) html += `<optgroup label="── Spezial ─────────────">${typenSpez.map(t => `<option value="${t.id}" ${assignedId===t.id?'selected':''}>${_ftLabel(t)}</option>`).join('')}</optgroup>`;
  return html;
}

// Punkte der Standorte einer Liste — fuer den Kartenausschnitt
function _standortPunkte(liste) {
  return liste.flatMap(p => {
    const pts = [];
    if (p.rs?.e  && p.rs?.n)  pts.push(lv95ToWgs84(p.rs.e,  p.rs.n));
    if (p.rks?.e && p.rks?.n) pts.push(lv95ToWgs84(p.rks.e, p.rks.n));
    return pts;
  });
}

// Kartenausschnitt auf die Standorte der aktiven Phase. Wird beim Wechsel in
// die Kartenansicht UND beim Phasenwechsel gebraucht: der Phasenwechsel baut
// die Karte neu auf, und ohne diesen Aufruf blieb sie auf dem Ausschnitt
// aller Standorte beider Phasen stehen.
function overviewKarteAufPhaseZentrieren() {
  if (!overviewMap) return;
  const pts = _standortPunkte(getFilteredSorted());
  if (!pts.length) return;
  const bounds = L.latLngBounds(pts.map(c => [c.lat, c.lng])).pad(0.15);
  overviewMap.fitBounds(bounds, { maxZoom: 17, animate: true });
}

function initOverviewMap() {
  if (overviewMap) {
    overviewMap.invalidateSize();
    return;
  }
  // Erster Ausschnitt: Standorte der aktiven Phase. Frueher standen hier alle
  // Standorte beider Phasen — beim Wechsel von Ausfuehrung zu Bauprojekt
  // begann die Karte dadurch viel zu weit draussen.
  const _phasePairs = getPhasePairs();
  const _allLL = _standortPunkte(_phasePairs.length ? _phasePairs : PAIRS);
  const _initView = _allLL.length
    ? { bounds: L.latLngBounds(_allLL.map(c => [c.lat, c.lng])), opts: { padding: [40, 40], maxZoom: 17 } }
    : { center: [47.55, 9.10], zoom: 13 };
  overviewMap = _allLL.length
    ? L.map('overview-map', KARTE_DREH_OPT).fitBounds(_initView.bounds, _initView.opts)
    : L.map('overview-map', KARTE_DREH_OPT).setView(_initView.center, _initView.zoom);
  karteDrehungAnmelden(overviewMap);

  // Basis-Karte setzen (zuletzt gewählte Kartenart)
  setOverviewBaseLayer(overviewBaseLayerKey);

  // Rechtsklick → Karten-Kontextmenü
  overviewMap.on('contextmenu', (e) => {
    L.DomEvent.preventDefault(e.originalEvent);
    const rect = overviewMap.getContainer().getBoundingClientRect();
    showMapCtxMenu('overview', e.latlng, rect.left + e.containerPoint.x, rect.top + e.containerPoint.y);
  });

  // Bahnlinien sind standardmässig an (App-Einstellungen › Kartendarstellung)
  if (typeof bahnStandardAnwenden === 'function') setTimeout(() => bahnStandardAnwenden('overview'), 60);

  // Standard-Info-Layer je Phase setzen
  _overviewInfoLayer = _activePhase === 'baugrund' ? 'status' : 'massnahme';

  const isBaugrundOv = _activePhase === 'baugrund';

  if (isBaugrundOv) {
    // ── Baugrundphase: Sondagen-Marker nach Status ──────────────────────
    const statusColor = { geplant:'#6b7280', abklaerung:'#d97706', abgeschlossen:'#059669' };

    getSondagen().forEach(p => {
      const pd  = getPairData(p.id);
      const col = statusColor[pd.status] || '#6b7280';
      if (!p.rs?.e || !p.rs?.n) return; // Kein RS → Marker überspringen
      const rsLL  = lv95ToWgs84(p.rs.e,  p.rs.n);
      const rksLL = (p.rks?.e && p.rks?.n) ? lv95ToWgs84(p.rks.e, p.rks.n) : rsLL;

      const mkIcon = (label) => L.divIcon({
        html: `<div style="background:${col};color:white;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);">${label}</div>`,
        iconSize:[26,26], iconAnchor:[13,13], className:''
      });
      const mkBsIcon = () => L.divIcon({
        html: `<div style="background:#b45309;color:white;border-radius:4px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);">BS</div>`,
        iconSize:[26,26], iconAnchor:[13,13], className:''
      });
      const mkOvPopup = (type, km) => `
        <div style="font-family:'Segoe UI',system-ui,sans-serif;min-width:180px;">
          <div style="background:${col};color:white;padding:7px 10px 6px;border-radius:7px 7px 0 0;font-size:12px;font-weight:700;white-space:nowrap;">
            ${p.bezeichnung||'Standort '+p.id} &ndash; ${type}
          </div>
          <div style="padding:7px 10px 4px;font-size:11px;line-height:1.6;">
            <div>KM ${km.toFixed(3)}</div>
            <div>${statusLabel(pd.status)}</div>
          </div>
          <div style="padding:4px 10px 8px;border-top:1px solid #f0f2f5;">
            <a href="#" onclick="showDetail(${p.id});return false;" style="font-size:11px;font-weight:600;color:#1d4ed8;text-decoration:none;display:flex;align-items:center;gap:4px;white-space:nowrap;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Öffnen
            </a>
          </div>
        </div>`;
      const mRS = L.marker([rsLL.lat, rsLL.lng], { icon: mkIcon('RS') }).addTo(overviewMap)
        .bindPopup(() => mkOvPopup('RS', p.km_rs), { maxWidth: 220 });
      const markers = { pairId: p.id, rs: mRS };
      if (p.rks?.e && p.rks?.n) {
        const mRKS = L.marker([rksLL.lat, rksLL.lng], { icon: mkIcon('RKS') }).addTo(overviewMap)
          .bindPopup(() => mkOvPopup('RKS', p.km_rks), { maxWidth: 220 });
        markers.rks = mRKS;
      }
      if (p.bs?.e && p.bs?.n) {
        const bsLL = lv95ToWgs84(p.bs.e, p.bs.n);
        const mBS = L.marker([bsLL.lat, bsLL.lng], { icon: mkBsIcon() }).addTo(overviewMap)
          .bindPopup(() => mkOvPopup('BS', p.km_rs), { maxWidth: 220 });
        markers.bs = mBS;
      }
      overviewMarkers.push(markers);
    });

  } else {
    // ── Bauprojekt / Ausführungsphase: Fundamentstandorte nach Massnahme ──
    const allBpData = loadAllBauprojekt();

    getFundamente().forEach(p => {
      // Koordinaten: pair.rs bevorzugt, pair.fund als Fallback (z.B. bei importierten + modal-gespeicherten Paaren)
      const _coordE = p.rs?.e || p.fund?.e;
      const _coordN = p.rs?.n || p.fund?.n;
      if (!_coordE || !_coordN) return;
      const bpData   = allBpData[p.id] || {};
      const col      = getMassnahmeColor(bpData);
      const massLabel= getMassnahmeLabel(bpData);
      const mastLabel= p.mast || '?';
      const ll       = lv95ToWgs84(_coordE, _coordN);

      const mkIcon = () => L.divIcon({
        html: `<div style="background:${col};color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);line-height:1;">${mastLabel}</div>`,
        iconSize:[28,28], iconAnchor:[14,14], className:''
      });

      // Baupaket-Info für Popup
      const _bpZuwMap  = (typeof loadSchichtZuw  === 'function') ? loadSchichtZuw()  : {};
      const _bpPakList = (typeof loadBaupakete   === 'function') ? loadBaupakete()   : [];
      const _bpSpList  = (typeof loadSperrmuster === 'function') ? loadSperrmuster() : [];
      const _bpZ = _bpZuwMap[p.id];
      const _bpPak = _bpZ?.paketId ? _bpPakList.find(x => x.id === _bpZ.paketId) : null;
      const _bpSchichten = _bpPak ? bpGetSchichten(_bpPak) : [];
      const _bpSch = _bpSchichten.find(s => s.schichtNr === _bpZ?.schichtNr);
      const bpInfoHtml = _bpPak
        ? `<div style="margin-top:4px;padding:4px 6px;background:${_bpPak.farbe||'#1a3a5c'}18;border-radius:5px;border-left:3px solid ${_bpPak.farbe||'#1a3a5c'};">
             <div style="font-weight:700;font-size:10px;color:${_bpPak.farbe||'#1a3a5c'};">${_bpPak.name}</div>
             <div style="font-size:10px;color:#6b7280;">${_bpZ?.schichtNr ? 'Schicht '+_bpZ.schichtNr : ''}${_bpSch ? ' · '+bpFmtDisplay(_bpSch.datum) : ''}${_bpSch?.nettoH ? ' · '+_bpSch.nettoH+'h' : ''}</div>
           </div>`
        : '';

      const popup = `
        <div style="font-family:'Segoe UI',system-ui,sans-serif;min-width:190px;">
          <div style="background:${col};color:white;padding:7px 10px 6px;border-radius:7px 7px 0 0;font-size:12px;font-weight:700;white-space:nowrap;">
            Mast ${mastLabel} &ndash; ${massLabel}
          </div>
          <div style="padding:7px 10px 4px;font-size:11px;line-height:1.6;">
            ${p.km_rs ? `<div>KM ${parseFloat(p.km_rs).toFixed(3)}</div>` : ''}
            ${bpData.fundtyp ? `<div>Typ: ${bpData.fundtyp}</div>` : ''}
            ${bpInfoHtml}
          </div>
          <div style="padding:4px 10px 8px;border-top:1px solid #f0f2f5;">
            <a href="#" onclick="showDetail(${p.id});return false;" style="font-size:11px;font-weight:600;color:#1d4ed8;text-decoration:none;display:flex;align-items:center;gap:4px;white-space:nowrap;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Öffnen
            </a>
          </div>
        </div>`;

      const mFund = L.marker([ll.lat, ll.lng], { icon: mkIcon() }).addTo(overviewMap)
        .bindPopup(popup, { maxWidth: 220 });
      overviewMarkers.push({ pairId: p.id, rs: mFund });
    });

    // ── Installationsflächen: quadratische Cyan-Marker ──
    getInstallationen().forEach(p => {
      if (!p.rs?.e || !p.rs?.n) return;
      const ll = lv95ToWgs84(p.rs.e, p.rs.n);
      const typLabel = INST_TYP_LABELS[p.installTyp] || p.installTyp || '?';
      const flaecheStr = p.flaeche ? `${p.flaeche} m²` : (p.flaecheL && p.flaecheB ? `${p.flaecheL}×${p.flaecheB} m` : '—');
      const instIcon = () => L.divIcon({
        html: `<div style="background:#0891b2;color:white;border-radius:4px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);line-height:1;">I</div>`,
        iconSize: [26, 26], iconAnchor: [13, 13], className: ''
      });
      const instPopup = `
        <div style="font-family:'Segoe UI',system-ui,sans-serif;min-width:170px;">
          <div style="background:#0891b2;color:white;padding:7px 10px 6px;border-radius:7px 7px 0 0;font-size:12px;font-weight:700;white-space:nowrap;">
            ${p.bezeichnung || 'Installation ' + p.id}
          </div>
          <div style="padding:7px 10px 4px;font-size:11px;line-height:1.6;">
            <div>${typLabel} · ${flaecheStr}</div>
            ${(p.von || p.bis) ? `<div>${p.von || '?'} – ${p.bis || '?'}</div>` : ''}
          </div>
          <div style="padding:4px 10px 8px;border-top:1px solid #f0f2f5;">
            <a href="#" onclick="showDetail(${p.id});return false;" style="font-size:11px;font-weight:600;color:#0891b2;text-decoration:none;display:flex;align-items:center;gap:4px;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Öffnen
            </a>
          </div>
        </div>`;
      const mInst = L.marker([ll.lat, ll.lng], { icon: instIcon() }).addTo(overviewMap)
        .bindPopup(instPopup, { maxWidth: 200 });
      overviewMarkers.push({ pairId: p.id, rs: mInst });
    });
  }

  // Legende mit Info-Layer-Selector einmalig hinzufügen (für alle Phasen)
  _addOverviewLegend(overviewMap);
  // Marker mit korrekten Farben/Labels für den aktuellen Info-Layer einfärben
  refreshOverviewMarkerLabels();
}

// Legende zur Übersichtskarte hinzufügen — kollabierbar, mit Info-Layer-Selector
function _addOverviewLegend(map) {
  const phase = _activePhase || 'baugrund';
  const opts  = OV_INFO_OPTIONS[phase] || OV_INFO_OPTIONS.baugrund;
  const optHtml = opts.map(o =>
    `<option value="${o.value}"${_overviewInfoLayer === o.value ? ' selected' : ''}>${o.label}</option>`
  ).join('');

  const legend = L.control({ position: 'bottomleft' });
  legend.onAdd = () => {
    const div = L.DomUtil.create('div');
    div.id = 'ov-legend-outer';
    div.style.cssText = 'background:white;border-radius:10px;font-size:11px;font-family:"Segoe UI",system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.18);min-width:170px;max-width:200px;overflow:hidden;';
    div.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px 5px 10px;background:#f9fafb;border-bottom:1px solid #e5e7eb;">
        <select id="ov-layer-select"
          style="font-size:11px;font-weight:700;color:#1a3a5c;border:none;background:transparent;cursor:pointer;outline:none;max-width:145px;padding:0;"
          onchange="setOverviewInfoLayer(this.value)"
          onclick="event.stopPropagation()">
          ${optHtml}
        </select>
        <button id="ov-legend-toggle"
          style="background:none;border:none;cursor:pointer;padding:2px 4px;color:#9ca3af;font-size:12px;line-height:1;flex-shrink:0;"
          onclick="this.closest('#ov-legend-outer').querySelector('#ov-legend-body').classList.toggle('ov-legend-collapsed');this.style.transform=this.closest('#ov-legend-outer').querySelector('#ov-legend-body').classList.contains('ov-legend-collapsed')?'rotate(-90deg)':'';">▾</button>
      </div>
      <div id="ov-legend-body" style="padding:8px 10px 9px;">
        <div id="ov-legend-box"></div>
      </div>`;

    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    return div;
  };
  legend.addTo(map);
}

const GPS_ICON_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';

// Der Knopf ist quadratisch und traegt nur das Zeichen. Frueher wurde hier
// «GPS Aktiv» als Text hineingeschrieben — das verdraengte im 32er-Quadrat
// das Zeichen. Der Zustand steht jetzt in den Klassen.
function _syncOverviewGpsBtn(active) {
  [document.getElementById('btn-overview-gps'),
   document.getElementById('btn-bp-fs-gps')].forEach(b => {
    if (!b) return;
    b.innerHTML = GPS_ICON_SVG;
    b.classList.toggle('an',  active);
    b.classList.toggle('aus', !active);
    b.title = active ? 'GPS aktiv — ausschalten' : 'GPS';
  });
}

function toggleOverviewGPS() {
  const btn = document.getElementById('btn-overview-gps');
  if (overviewWatchId !== null) {
    navigator.geolocation.clearWatch(overviewWatchId); overviewWatchId = null;
    if (overviewGpsMarker) { overviewGpsMarker.remove(); overviewGpsMarker = null; }
    if (overviewGpsCircle) { overviewGpsCircle.remove(); overviewGpsCircle = null; }
    _syncOverviewGpsBtn(false);
    document.getElementById('btn-overview-gps-zoom').style.display = 'none';
    return;
  }
  if (!navigator.geolocation) { ui.toast('GPS wird von diesem Browser nicht unterstützt.', 'fehler'); return; }
  if (btn) { btn.classList.remove('aus'); btn.title = 'GPS wird gesucht…'; }
  overviewWatchId = navigator.geolocation.watchPosition(
    pos => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      const gpsIcon = L.divIcon({ html: '<div class="gps-dot"></div>', iconSize:[14,14], iconAnchor:[7,7], className:'' });
      if (!overviewGpsMarker) {
        overviewGpsMarker = L.marker([lat,lng], { icon: gpsIcon, zIndexOffset:1000 }).addTo(overviewMap)
          .bindPopup(`Mein Standort<br>Genauigkeit: ±${Math.round(accuracy)} m`);
        overviewGpsCircle = L.circle([lat,lng], { radius:accuracy, color:'#3b82f6', fillColor:'#3b82f6', fillOpacity:0.1, weight:1 }).addTo(overviewMap);
        overviewMap.panTo([lat,lng]);
      } else {
        overviewGpsMarker.setLatLng([lat,lng]).setPopupContent(`Mein Standort<br>Genauigkeit: ±${Math.round(accuracy)} m`);
        overviewGpsCircle.setLatLng([lat,lng]).setRadius(accuracy);
      }
      _syncOverviewGpsBtn(true);
      document.getElementById('btn-overview-gps-zoom').style.display = '';
    },
    err => {
      _syncOverviewGpsBtn(false); overviewWatchId = null;
      document.getElementById('btn-overview-gps-zoom').style.display = 'none';
      let msg = "GPS-Zugriff verweigert. Bitte App ueber https:// oeffnen (GitHub Pages).";
      if (err.code === 2) msg = "GPS-Position konnte nicht ermittelt werden.";
      if (err.code === 3) msg = "GPS-Zeitüberschreitung. Bitte erneut versuchen.";
      ui.toast(msg, 'fehler');
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
}

function zoomToOverviewGPS() {
  if (overviewGpsMarker && overviewMap) overviewMap.setView(overviewGpsMarker.getLatLng(), 17);
}

// ============================================================
// STANDORT-NAVIGATION AUF KARTEN
// ============================================================
// Pfeile, Beschriftung und Sprungliste — dieselbe Bedienung wie in der
// Seitenleiste der Detailansicht. Die Zeile wird gebaut, nicht abgeschrieben:
// sie steht auf der Uebersichtskarte und in der Abnahme-Checkliste, und beide
// tun beim Anwaehlen etwas anderes (Karte anfahren bzw. Checkliste laden).
const KARTE_NAV_PFEIL = r =>
  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"`
  + ` stroke-linecap="round" stroke-linejoin="round"><polyline points="${r}"/></svg>`;

const _karteNavs = {};

// opt: { liste(), waehle(pair), name(pair), aktiv() }
function karteNavAufbauen(halterId, opt) {
  const halter = document.getElementById(halterId);
  if (!halter) return null;
  const nav = _karteNavs[halterId];
  if (nav) return nav;

  halter.innerHTML =
     '<div class="pair-nav">'
   +   '<button class="pair-nav-btn nur-symbol" data-nav="-1" title="Vorheriger Standort" aria-label="Vorheriger Standort">' + KARTE_NAV_PFEIL('15 18 9 12 15 6') + '</button>'
   +   '<div class="pair-jump-wrap">'
   +     '<button class="pair-jump-btn" data-nav-label title="Standort wählen">'
   +       '<span>Standort wählen</span>'
   +       '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
   +     '</button>'
   +     '<div class="pair-jump-panel">'
   +       '<input class="app-suche voll" type="search" placeholder="Standort suchen…">'
   +       '<div class="pair-jump-liste"></div>'
   +     '</div>'
   +   '</div>'
   +   '<button class="pair-nav-btn nur-symbol" data-nav="1" title="Nächster Standort" aria-label="Nächster Standort">' + KARTE_NAV_PFEIL('9 18 15 12 9 6') + '</button>'
   + '</div>';

  const el = {
    prev:  halter.querySelector('[data-nav="-1"]'),
    next:  halter.querySelector('[data-nav="1"]'),
    label: halter.querySelector('[data-nav-label] span'),
    knopf: halter.querySelector('[data-nav-label]'),
    panel: halter.querySelector('.pair-jump-panel'),
    such:  halter.querySelector('.app-suche'),
    liste: halter.querySelector('.pair-jump-liste'),
  };
  const name = opt.name || (p => p.mast ? 'Mast ' + p.mast : (p.bezeichnung || 'Standort ' + p.id));
  let markiert = 0;

  const aktualisieren = () => {
    const liste = opt.liste();
    const i = liste.findIndex(p => p.id === opt.aktiv());
    el.label.textContent = i < 0 ? 'Standort wählen' : `${name(liste[i])} / ${liste.length}`;
    el.prev.disabled = el.next.disabled = !liste.length;
    // Ohne Auswahl tritt die Zeile ueber der Karte zurueck (siehe .leer)
    halter.classList.toggle('leer', i < 0);
  };

  const zuklappen = () => el.panel.classList.remove('offen');

  const listeZeichnen = filter => {
    const q = (filter || '').trim();
    const notAll = q ? loadAllNotizen() : {};
    const bpAll  = q && typeof loadAllBauprojekt === 'function' ? loadAllBauprojekt() : {};
    const treffer = opt.liste().filter(p => !q || sucheTrifftStandort(p, q, notAll, bpAll));
    markiert = 0;
    if (!treffer.length) {
      el.liste.innerHTML = '<div class="pair-jump-leer">Kein Standort gefunden</div>';
      return;
    }
    el.liste.innerHTML = treffer.map((p, i) => {
      const km = p.km_rs || p.km_rks;
      return '<button class="pair-jump-eintrag'
        + (p.id === opt.aktiv() ? ' aktiv' : '')
        + (i === 0 ? ' markiert' : '') + '" data-pair="' + p.id + '">'
        + '<span>' + escHtml(name(p)) + '</span>'
        + (km ? '<span class="pj-neben">' + escHtml(parseFloat(km).toFixed(3)) + '</span>' : '')
        + '</button>';
    }).join('');
    el.liste.querySelectorAll('[data-pair]').forEach(btn => {
      btn.onclick = () => {
        zuklappen();
        const ziel = opt.liste().find(p => String(p.id) === btn.dataset.pair);
        if (ziel) { opt.waehle(ziel); aktualisieren(); }
      };
    });
    el.liste.querySelector('.pair-jump-eintrag.aktiv')?.scrollIntoView({ block: 'nearest' });
  };

  const gehe = richtung => {
    const liste = opt.liste();
    if (!liste.length) return;
    const i = liste.findIndex(p => p.id === opt.aktiv());
    // Ohne bisherige Wahl beim ersten bzw. letzten Standort einsteigen
    const ziel = i < 0 ? (richtung > 0 ? 0 : liste.length - 1)
                       : (i + richtung + liste.length) % liste.length;
    opt.waehle(liste[ziel]);
    aktualisieren();
  };

  el.prev.onclick = () => gehe(-1);
  el.next.onclick = () => gehe(1);
  el.knopf.onclick = ev => {
    ev.stopPropagation();
    if (!el.panel.classList.toggle('offen')) return;
    el.such.value = '';
    el.such.focus();
    listeZeichnen('');
  };
  el.such.oninput = () => listeZeichnen(el.such.value);
  el.such.onkeydown = ev => {
    const eintraege = [...el.liste.querySelectorAll('.pair-jump-eintrag')];
    if (ev.key === 'Escape') { zuklappen(); return; }
    if (!eintraege.length) return;
    if (ev.key === 'Enter') { ev.preventDefault(); eintraege[markiert]?.click(); return; }
    if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
    ev.preventDefault();
    eintraege[markiert]?.classList.remove('markiert');
    markiert = (markiert + (ev.key === 'ArrowDown' ? 1 : -1) + eintraege.length) % eintraege.length;
    eintraege[markiert].classList.add('markiert');
    eintraege[markiert].scrollIntoView({ block: 'nearest' });
  };

  _karteNavs[halterId] = { aktualisieren, zuklappen };
  aktualisieren();
  return _karteNavs[halterId];
}

// Klick daneben schliesst jede offene Sprungliste
document.addEventListener('click', e => {
  if (e.target.closest('.pair-jump-wrap')) return;
  Object.values(_karteNavs).forEach(n => n.zuklappen());
});

// ── Uebersichtskarte ─────────────────────────────────────────
let _ovNavId = null;

function ovNavZeigeStandort(pair) {
  const eintrag = overviewMarkers.find(m => m.pairId === pair.id);
  const marker  = eintrag?.rs || eintrag?.rks || eintrag?.bs;
  if (!marker || !overviewMap) return;
  _ovNavId = pair.id;
  overviewMap.setView(marker.getLatLng(), Math.max(overviewMap.getZoom(), 17));
  marker.openPopup();
}

function ovNavAktualisieren() {
  karteNavAufbauen('ov-nav-halter', {
    liste:  () => getFilteredSorted(),
    waehle: ovNavZeigeStandort,
    aktiv:  () => _ovNavId,
  })?.aktualisieren();
}

function refreshOverviewMap() {
  ovNavAktualisieren();
  // Sondagen-Marker nur in der Baugrundphase anzeigen
  if (_activePhase !== 'baugrund') {
    if (!overviewMap) { initOverviewMap(); setTimeout(resizeOverviewMap, 50); }
    return;
  }
  if (!overviewMap) { initOverviewMap(); return; }
  const visible = new Set(getFilteredSorted().map(p => p.id));
  overviewMarkers.forEach(({ pairId, rs, rks }) => {
    const show = visible.has(pairId);
    if (rs)  { rs.setOpacity(show ? 1 : 0);  rs.getElement()  && (rs.getElement().style.pointerEvents  = show ? '' : 'none'); }
    if (rks) { rks.setOpacity(show ? 1 : 0); rks.getElement() && (rks.getElement().style.pointerEvents = show ? '' : 'none'); }
  });
}

// ============================================================
