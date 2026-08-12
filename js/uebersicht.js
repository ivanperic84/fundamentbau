// OVERVIEW
// ============================================================
let currentFilter = 'alle';

// Standorte der aktiven Phase nach Status zaehlen. Ein Status ausserhalb der
// Konfiguration zaehlt wie «abgeschlossen» — so war es schon im Balken, und
// beides muss dieselbe Zahl ergeben.
function zaehleNachStatus() {
  const phasePairs = _activePhase === 'baugrund' ? getSondagen() : getFundamente();
  const proStatus = {};
  let g = 0, a = 0, ab = 0;
  phasePairs.forEach(p => {
    const s = getPairData(p.id).status;
    proStatus[s] = (proStatus[s] || 0) + 1;
    if (s === 'geplant') g++; else if (s === 'abklaerung') a++; else ab++;
  });
  return { proStatus, g, a, ab, total: phasePairs.length };
}

function updateProgress() {
  const { g, a, ab, total } = zaehleNachStatus();
  // Der Fortschritt steht als schmale Anzeige im Kopfband. Die Zahlen je
  // Status stehen an den Filterknoepfen — dort, wo man sie auch anklickt.
  const label = document.getElementById('progress-label');
  if (label) label.textContent = `${ab}/${total}`;
  const wrap = document.getElementById('kopf-fortschritt');
  if (wrap) wrap.title = `Abgeschlossen ${ab} · In Abklärung ${a} · Geplant ${g} · von ${total}`;
  const gruen = document.getElementById('pb-green');
  if (gruen) gruen.style.width = total ? (ab/total*100)+'%' : '0%';
  const gelb = document.getElementById('pb-amber');
  if (gelb) gelb.style.width = total ? (a/total*100)+'%' : '0%';
  renderFilterButtons();
  updateHeaderSub();
}

function updateHeaderSub() {
  const el = document.getElementById('header-sub');
  if (!el) return;
  const phase = PHASEN_CONFIG[_activePhase]?.label || _activePhase;
  const phasePairs = _activePhase === 'baugrund' ? getSondagen() : getFundamente();
  const label = _activePhase === 'baugrund' ? 'Sondagestandorte' : 'Fundamentstandorte';
  el.textContent = `${phasePairs.length} ${label} · ${phase}`;
}

function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  refreshCurrentView();
}

// --- Status-Konfiguration (pro Phase) ---
const DEFAULT_STATUS_CFG_BY_PHASE = {
  baugrund: [
    { key: 'geplant',        label: 'Geplant',        color: '#6b7280' },
    { key: 'abklaerung',     label: 'In Abklärung',   color: '#d97706' },
    { key: 'abgeschlossen',  label: 'Abgeschlossen',  color: '#059669' },
  ],
  bauprojekt: [
    { key: 'geplant',        label: 'Geplant',         color: '#6b7280' },
    { key: 'abklaerung',     label: 'In Bearbeitung',  color: '#d97706' },
    { key: 'abgeschlossen',  label: 'Freigegeben',     color: '#059669' },
  ],
  ausfuehrung: [
    { key: 'geplant',        label: 'Geplant',         color: '#6b7280' },
    { key: 'abklaerung',     label: 'In Ausführung',   color: '#d97706' },
    { key: 'abgeschlossen',  label: 'Abgenommen',      color: '#059669' },
  ],
};
function getDefaultStatusCfg() {
  return DEFAULT_STATUS_CFG_BY_PHASE[_activePhase] || DEFAULT_STATUS_CFG_BY_PHASE.baugrund;
}
function getStatusCfgKey() { return 'sp_status_cfg_' + (_activePhase || 'baugrund'); }

function getStatusCfg() {
  try { return jsonParse(store.getItem(getStatusCfgKey())) || getDefaultStatusCfg(); }
  catch { return getDefaultStatusCfg(); }
}
function saveStatusCfgData(cfg) {
  store.setItem(getStatusCfgKey(), JSON.stringify(cfg));
}

function statusLabel(s) {
  const found = getStatusCfg().find(c => c.key === s);
  return found ? found.label : (s || '—');
}

// Farbe eines Status aus Config
function getStatusColor(key) {
  const found = getStatusCfg().find(c => c.key === key);
  return found?.color || '#6b7280';
}

function getCardBg(status) {
  const col = getStatusColor(status) || '#6b7280';
  const r = parseInt(col.slice(1,3), 16);
  const g = parseInt(col.slice(3,5), 16);
  const b = parseInt(col.slice(5,7), 16);
  // Sehr heller Pastell-Ton — 8% Farbanteil
  const rf = Math.round(255 - (255 - r) * 0.08);
  const gf = Math.round(255 - (255 - g) * 0.08);
  const bf = Math.round(255 - (255 - b) * 0.08);
  return `rgba(${rf},${gf},${bf},0.92)`;
}

// Inline-Style für qs-badge basierend auf Config-Farbe
function qsBadgeStyle(status) {
  const col = getStatusColor(status);
  return `background:${col}22;color:${col};border-color:${col}66;`;
}

// Dynamische Optionsliste für qs-picker
function buildQsOpts(pairId, currentStatus) {
  return getStatusCfg().map(c => {
    const col = c.color || '#6b7280';
    const active = currentStatus === c.key;
    return `<button class="qs-opt${active ? ' qs-opt-active' : ''}" `
      + `style="background:${col}18;color:${col};" `
      + `onclick="quickStatus(${pairId},'${c.key}')">${c.label}<span class="qs-check">✓</span></button>`;
  }).join('');
}

function renderFilterButtons() {
  const bar = document.getElementById('filter-bar');
  if (!bar) return;
  const { proStatus, total } = zaehleNachStatus();
  // Alle außer "Alle"-Button neu setzen
  bar.querySelectorAll('.filter-btn:not(#filter-btn-alle)').forEach(b => b.remove());
  const alle = document.getElementById('filter-btn-alle');
  if (alle) alle.innerHTML = 'Alle<span class="fb-zahl">' + total + '</span>';
  getStatusCfg().forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (currentFilter === c.key ? ' active' : '');
    btn.id = 'filter-btn-' + c.key;
    btn.style.flexShrink = '0';
    // Zahl je Status: sie ersetzt den frueheren Zahlenblock ueber der Liste.
    btn.innerHTML = escHtml(c.label) + '<span class="fb-zahl">' + (proStatus[c.key] || 0) + '</span>';
    btn.onclick = () => setFilter(c.key, btn);
    bar.appendChild(btn);
  });
}

// Status-Konfig-Modal
let _statusCfgEditing = [];
let _newStatusColor = '#8b5cf6';

function openStatusCfgModal() {
  _statusCfgEditing = jsonParse(JSON.stringify(getStatusCfg()));
  const phaseLabel = { baugrund:'Baugrunduntersuchung', bauprojekt:'Bauprojekt', ausfuehrung:'Ausführungsprojekt' }[_activePhase] || _activePhase;
  const titleEl = document.querySelector('#status-cfg-modal h2');
  if (titleEl) titleEl.textContent = 'Status · ' + phaseLabel;
  renderStatusCfgList();
  renderNewStatusSwatches();
  document.getElementById('status-cfg-modal').classList.add('open');
}

function renderNewStatusSwatches() {
  const wrap = document.getElementById('status-cfg-new-swatches');
  const prev = document.getElementById('status-cfg-new-preview');
  if (!wrap) return;
  wrap.innerHTML = STATUS_COLORS.map(sc =>
    `<div onclick="_newStatusColor='${sc}';renderNewStatusSwatches()"
      style="width:9px;height:9px;border-radius:50%;background:${sc};cursor:pointer;flex-shrink:0;
      box-shadow:${sc===_newStatusColor?`0 0 0 1.5px white,0 0 0 3px ${sc}`:'none'};"></div>`
  ).join('');
  if (prev) { prev.style.background = _newStatusColor; prev.style.boxShadow = `0 0 0 1px ${_newStatusColor}`; }
}
function closeStatusCfgModal() {
  document.getElementById('status-cfg-modal').classList.remove('open');
}

function renderStatusCfgList() {
  const list = document.getElementById('status-cfg-list');
  if (!list) return;
  const defaults = getDefaultStatusCfg().map(d => d.key);
  list.innerHTML = _statusCfgEditing.map((c, i) => {
    const isDef = defaults.includes(c.key);
    const col = c.color || '#6b7280';
    const swatches = STATUS_COLORS.map(sc =>
      `<div onclick="_statusCfgEditing[${i}].color='${sc}';renderStatusCfgList()"
        style="width:9px;height:9px;border-radius:50%;background:${sc};cursor:pointer;flex-shrink:0;
        box-shadow:${sc===col?`0 0 0 1.5px white,0 0 0 3px ${sc}`:'none'};"></div>`
    ).join('');
    return `<div style="display:flex;flex-direction:column;gap:4px;padding:8px;border-radius:8px;border:1px solid ${col}44;background:${col}08;">
      <div style="display:flex;gap:6px;align-items:center;">
        <div style="width:12px;height:12px;border-radius:50%;background:${col};flex-shrink:0;border:2px solid white;box-shadow:0 0 0 1px ${col};"></div>
        <input class="modal-input" style="flex:1;border-color:${col};color:${col};font-weight:700;padding:5px 8px;"
          value="${c.label.replace(/"/g,'&quot;')}"
          oninput="_statusCfgEditing[${i}].label=this.value"
          placeholder="Bezeichnung">
        ${isDef
          ? `<span style="font-size:10px;color:#9ca3af;padding:0 4px;flex-shrink:0;" title="Standard (nicht löschbar)">gesperrt</span>`
          : `<button onclick="statusCfgDelete(${i})" title="Löschen"
              style="padding:4px 8px;border-radius:6px;border:1px solid #fca5a5;background:#fef2f2;color:#dc2626;cursor:pointer;font-size:12px;">✕</button>`
        }
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;padding:2px 0 0 18px;">${swatches}</div>
    </div>`;
  }).join('');
}

function statusCfgDelete(i) {
  _statusCfgEditing.splice(i, 1);
  renderStatusCfgList();
}

function statusCfgAdd() {
  const inp = document.getElementById('status-cfg-new-input');
  const label = (inp.value || '').trim();
  if (!label) return;
  const key = 'custom_' + Date.now();
  _statusCfgEditing.push({ key, label, color: _newStatusColor });
  inp.value = '';
  renderStatusCfgList();
}

async function statusCfgReset() {
  if (!await ui.confirm('Alle Anpassungen zurücksetzen auf Standard?')) return;
  _statusCfgEditing = jsonParse(JSON.stringify(getDefaultStatusCfg()));
  renderStatusCfgList();
}

function statusCfgSave() {
  // Leere Labels auffüllen
  _statusCfgEditing = _statusCfgEditing.filter(c => c.label.trim());
  saveStatusCfgData(_statusCfgEditing);
  renderFilterButtons();
  refreshCurrentView();
  closeStatusCfgModal();
}

// ============================================================
// SCHNELL-BEARBEITEN MODAL
// ============================================================
let _qeId = null;
let _qeStatus = 'geplant';

function openQuickEdit(id) {
  _qeId = id;
  const p  = PAIRS.find(x => x.id === id);
  if (!p) return;
  const pd = getPairData(id);
  const isBG = !p._phase || p._phase === 'baugrund';

  _qeStatus = pd.status || 'geplant';

  // Felder befüllen
  document.getElementById('qe-bezeichnung').value   = p.bezeichnung || '';
  document.getElementById('qe-mast').value           = p.mast || '';
  document.getElementById('qe-gleis').value          = p.gleis || '';
  document.getElementById('qe-km-rs').value          = p.km_rs || '';
  document.getElementById('qe-strecke').value        = p.strecke || '';
  document.getElementById('qe-gelaendehoehe').value  = p.gelaendehoehe || '';
  document.getElementById('qe-zugang').value         = p.zugang || '';
  document.getElementById('qe-kommentar').value      = pd.comment || '';

  // Baugrund-spezifisch
  const sondiSection = document.getElementById('qe-sondierung-section');
  if (sondiSection) sondiSection.style.display = isBG ? '' : 'none';
  if (isBG) {
    document.getElementById('qe-tag').value    = p.tag   || '';
    document.getElementById('qe-nacht').value  = p.nacht || '';
    document.getElementById('qe-tiefe').value  = p.tiefe || '';
    document.getElementById('qe-km-rks').value = p.km_rks || '';
  }

  // Koordinaten
  document.getElementById('qe-rs-e').value  = p.rs?.e  || '';
  document.getElementById('qe-rs-n').value  = p.rs?.n  || '';
  document.getElementById('qe-rks-e').value = isBG ? (p.rks?.e || '') : '';
  document.getElementById('qe-rks-n').value = isBG ? (p.rks?.n || '') : '';
  const zEl = document.getElementById('qe-rs-z');
  if (zEl) zEl.value = p.z != null && !isNaN(parseFloat(p.z)) ? parseFloat(p.z).toFixed(2) : '';
  const rksFields = document.getElementById('qe-rks-fields');
  if (rksFields) rksFields.parentElement.style.display = isBG ? '' : 'none';
  // RKS-N-Feld auch verstecken wenn BP
  const allCoordFields = document.querySelectorAll('#qe-coords-section .modal-field');
  if (!isBG && allCoordFields.length >= 4) {
    allCoordFields[2].style.display = 'none';
    allCoordFields[3].style.display = 'none';
  } else if (allCoordFields.length >= 4) {
    allCoordFields[2].style.display = '';
    allCoordFields[3].style.display = '';
  }

  // Titel + Labels
  document.getElementById('qe-title').textContent = isBG ? 'Sondage bearbeiten' : 'Fundamentstandort bearbeiten';
  document.getElementById('qe-zugang-lbl').textContent = isBG ? 'Zugang / Bemerkung' : 'Bemerkung';
  document.getElementById('qe-gleis').closest('.modal-field').style.display       = isBG ? '' : 'none';
  document.getElementById('qe-bezeichnung').closest('.modal-field').style.display = isBG ? '' : 'none';

  // Coords zuklappen
  document.getElementById('qe-coords-section').style.display = 'none';
  document.getElementById('qe-coords-chevron').textContent = '▸';

  // Status-Buttons rendern
  qeRenderStatusBtns();
  // Schicht-Datalists aktualisieren
  updateSchichtDatalist();

  document.getElementById('quick-edit-modal').classList.add('open');
}

function qeRenderStatusBtns() {
  const wrap = document.getElementById('qe-status-btns');
  if (!wrap) return;
  const cfg = getStatusCfg();
  wrap.innerHTML = cfg.map(c => {
    // Farbe direkt aus globaler Status-Konfiguration
    const col    = c.color || '#6b7280';
    const active = _qeStatus === c.key;
    return `<button onclick="qeSetStatus('${c.key}')" id="qe-sbtn-${c.key}"
      style="flex:1;min-width:80px;padding:8px 6px;border-radius:8px;border:2px solid ${active ? col : '#e5e7eb'};
      background:${active ? col+'18' : 'white'};color:${active ? col : '#6b7280'};
      font-size:12px;font-weight:700;cursor:pointer;transition:all 0.15s;">${c.label}</button>`;
  }).join('');
}

function qeSetStatus(s) {
  _qeStatus = s;
  qeRenderStatusBtns();
}

function qeToggleCoords() {
  const sec = document.getElementById('qe-coords-section');
  const chev = document.getElementById('qe-coords-chevron');
  const open = sec.style.display !== 'none';
  sec.style.display = open ? 'none' : '';
  chev.textContent = open ? '▸' : '▾';
}

async function qeLookupSbb() {
  const e = parseInt(document.getElementById('qe-rs-e').value) || (PAIRS.find(x=>x.id===_qeId)?.rs?.e);
  const n = parseInt(document.getElementById('qe-rs-n').value) || (PAIRS.find(x=>x.id===_qeId)?.rs?.n);
  if (!e || !n) { ui.toast('Keine Koordinaten vorhanden. Bitte Koordinaten-Abschnitt öffnen und E/N eingeben.', 'fehler'); return; }
  const ll = lv95ToWgs84(e, n);
  const kmFld = document.getElementById('qe-km-rs');
  kmFld.style.background = '#f0f9ff';
  try {
    const url = `https://data.sbb.ch/api/explore/v2.1/catalog/datasets/linienkilometrierung/records`
      + `?limit=5&order_by=distance(geo_point_2d,geom'POINT(${ll.lng}%20${ll.lat})')&select=km,geo_point_2d,liniename,linienr`;
    const res = await fetch(url, { mode:'cors' });
    if (!res.ok) throw new Error('API ' + res.status);
    const data = await res.json();
    if (!data.results?.length) throw new Error('Keine Daten');
    const p1 = data.results[0];
    kmFld.value = parseFloat(p1.km).toFixed(3);
    document.getElementById('qe-strecke').value = p1.liniename || '';
  } catch(err) {
    ui.toast('SBB-Abfrage fehlgeschlagen: ' + err.message, 'fehler');
  }
  kmFld.style.background = '';
}

async function qeLookupHoehe() {
  const e = parseInt(document.getElementById('qe-rs-e').value) || (PAIRS.find(x=>x.id===_qeId)?.rs?.e);
  const n = parseInt(document.getElementById('qe-rs-n').value) || (PAIRS.find(x=>x.id===_qeId)?.rs?.n);
  if (!e || !n) { ui.toast('Keine Koordinaten vorhanden.', 'fehler'); return; }
  const hEl = document.getElementById('qe-gelaendehoehe');
  hEl.style.background = '#f0f9ff';
  try {
    const res = await fetch(`https://api.geo.admin.ch/rest/services/height?easting=${e}&northing=${n}&sr=2056&format=json`);
    if (!res.ok) throw new Error('API ' + res.status);
    const data = await res.json();
    if (data.height) hEl.value = parseFloat(data.height).toFixed(1);
  } catch(err) {
    ui.toast('Höhenabfrage fehlgeschlagen: ' + err.message, 'fehler');
  }
  hEl.style.background = '';
}

function saveQuickEdit() {
  if (!_qeId) return;
  pushUndo();
  const idx = PAIRS.findIndex(p => p.id === _qeId);
  if (idx < 0) return;
  const p = PAIRS[idx];
  const isBG = !p._phase || p._phase === 'baugrund';
  const v = id => { const el = document.getElementById(id); return el ? el.value : ''; };

  // Koordinaten übernehmen wenn geändert
  const rsE  = parseInt(v('qe-rs-e'))  || p.rs?.e;
  const rsN  = parseInt(v('qe-rs-n'))  || p.rs?.n;
  const rksE = isBG ? (parseInt(v('qe-rks-e')) || p.rks?.e) : rsE;
  const rksN = isBG ? (parseInt(v('qe-rks-n')) || p.rks?.n) : rsN;
  const zRaw = parseFloat(v('qe-rs-z'));
  const zVal = !isNaN(zRaw) ? zRaw : (p.z ?? undefined);

  PAIRS[idx] = {
    ...p,
    bezeichnung:  v('qe-bezeichnung').trim(),
    mast:         v('qe-mast'),
    gleis:        isBG ? v('qe-gleis') : p.gleis,
    km_rs:        parseFloat(v('qe-km-rs')) || p.km_rs,
    km_rks:       isBG ? (parseFloat(v('qe-km-rks')) || p.km_rks) : p.km_rks,
    strecke:      v('qe-strecke').trim() || p.strecke,
    gelaendehoehe:parseFloat(v('qe-gelaendehoehe')) || p.gelaendehoehe,
    zugang:       v('qe-zugang'),
    tag:          isBG ? v('qe-tag')   : p.tag,
    nacht:        isBG ? v('qe-nacht') : p.nacht,
    tiefe:        isBG ? (parseFloat(v('qe-tiefe')) || p.tiefe) : p.tiefe,
    rs:  (rsE  && rsN)  ? { e: rsE,  n: rsN  } : null,
    rks: (rksE && rksN) ? { e: rksE, n: rksN } : null,
    ...(zVal != null ? { z: zVal } : {}),
  };
  savePairs();
  // Schicht-Kurzbezeichnung automatisch in Bibliothek eintragen
  if (isBG) autoRegisterSchichtenFromPairs([PAIRS[idx]]);

  // Status + Kommentar
  setPairData(_qeId, { status: _qeStatus, comment: v('qe-kommentar') });

  updateProgress();
  closeQuickEdit();
  refreshCurrentView();
  // Höhenkoten-Anzeige aktualisieren wenn aktueller Standort
  if (_qeId === currentPairId) loadHoehenkoten(currentPairId);
}

function closeQuickEdit() {
  document.getElementById('quick-edit-modal').classList.remove('open');
  _qeId = null;
}

function hasSicherheit(id) {
  const s = getPairData(id).sicherheit || {};
  return s.siwa && s.siwa !== 'k-a' || s.sperrung && s.sperrung !== 'k-a' || s.hinweise;
}

function hasFelddaten(id) {
  const fd = getPairData(id).felddaten || {};
  return fd.rs_tiefe_ist || fd.rks_tiefe_ist || fd.rks_schicht;
}

// ============================================================
// KACHELN — REIHENFOLGE UND INHALT
// ============================================================
// Die Kachel zeigte immer dasselbe und stand immer in derselben Reihenfolge.
// Je nach Aufgabe braucht man aber anderes: beim Abgehen der Strecke die
// Kilometer, beim Bestellen den Fundamenttyp.
const KACHEL_SORT_KEY   = 'sp_kachel_sort';
const KACHEL_FELDER_KEY = 'sp_kachel_felder';

const KACHEL_FELDER = [
  { id: 'massnahme',  label: 'Massnahme' },
  { id: 'fundtyp',    label: 'Fundamenttyp' },
  { id: 'baupaket',   label: 'Baupaket / Schicht' },
  { id: 'km',         label: 'Kilometer und Neigung' },
  { id: 'untertitel', label: 'Untertitel (Boden, Zugang)' },
  { id: 'tags',       label: 'Schlagworte' },
  { id: 'symbole',    label: 'Symbole (Foto, Notiz …)' },
];

function kachelSort() {
  return store.getItem(KACHEL_SORT_KEY) || 'alpha';
}

function kachelSortSetzen(wert) {
  store.setItem(KACHEL_SORT_KEY, wert);
  renderCards();
}

function _kachelFelderCfg() {
  try { return jsonParse(store.getItem(KACHEL_FELDER_KEY)) || {}; } catch { return {}; }
}

// Standard: alles an. Gespeichert wird nur, was abgeschaltet ist.
function kachelZeigt(id) {
  return _kachelFelderCfg()[id] !== false;
}

function kachelFeldUmschalten(id, an) {
  const cfg = _kachelFelderCfg();
  if (an) delete cfg[id]; else cfg[id] = false;
  store.setItem(KACHEL_FELDER_KEY, JSON.stringify(cfg));
  renderCards();
}

function kachelInhaltPanelUmschalten(ev) {
  if (ev) ev.stopPropagation();
  const panel = document.getElementById('kachel-inhalt-panel');
  if (!panel) return;
  if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
  panel.innerHTML = '<div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:8px;">Auf der Kachel zeigen</div>'
    + KACHEL_FELDER.map(f =>
      `<label style="display:flex;align-items:center;gap:7px;padding:3px 0;font-size:11px;color:#374151;cursor:pointer;">
         <input type="checkbox" ${kachelZeigt(f.id) ? 'checked' : ''}
                onchange="kachelFeldUmschalten('${f.id}', this.checked)">
         ${escHtml(f.label)}
       </label>`).join('');
  panel.style.display = 'block';
}

document.addEventListener('click', e => {
  if (e.target.closest('#kachel-inhalt-panel') || e.target.closest('#kachel-inhalt-btn')) return;
  const panel = document.getElementById('kachel-inhalt-panel');
  if (panel) panel.style.display = 'none';
});

// Natuerliche Ordnung: «FS T10» gehoert hinter «FS T9», nicht dazwischen.
const _kachelVergleich = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

function _kachelName(p) {
  return p.mast ? String(p.mast) : (p.bezeichnung || 'Standort ' + p.id);
}

function kachelSortieren(liste, allBp, ftProfiles) {
  const art = kachelSort();
  const kopie = [...liste];
  if (art === 'km') {
    return kopie.sort((a, b) =>
      (parseFloat(a.km_rs ?? a.km_rks ?? 9999) || 9999) - (parseFloat(b.km_rs ?? b.km_rks ?? 9999) || 9999));
  }
  if (art === 'fundtyp') {
    const typ = p => {
      const bp = { ...p, ...(allBp[p.id] || {}) };
      const eintrag = bp.ftProfilId ? ftProfiles.find(t => t.id === bp.ftProfilId) : null;
      return eintrag?.name || bp.fundtyp || 'zzz';
    };
    return kopie.sort((a, b) => _kachelVergleich.compare(typ(a), typ(b))
                             || _kachelVergleich.compare(_kachelName(a), _kachelName(b)));
  }
  if (art === 'status') {
    return kopie.sort((a, b) => _kachelVergleich.compare(statusLabel(getPairData(a.id).status), statusLabel(getPairData(b.id).status))
                             || _kachelVergleich.compare(_kachelName(a), _kachelName(b)));
  }
  return kopie.sort((a, b) => _kachelVergleich.compare(_kachelName(a), _kachelName(b)));
}

function renderCards() {
  renderFilterButtons();
  // Steuerung nur in der Kachelansicht zeigen
  const steuerung = document.getElementById('kachel-steuerung');
  if (steuerung) {
    steuerung.style.display = currentOverviewView === 'karten' ? 'flex' : 'none';
    const sel = document.getElementById('kachel-sort');
    if (sel) sel.value = kachelSort();
  }
  const grid  = document.getElementById('cards-grid');
  grid.innerHTML = '';
  const phase = _activePhase;
  const allBp = loadAllBauprojekt();
  const ftProfiles = loadFtProfile();

  kachelSortieren(getFilteredSorted(), allBp, ftProfiles).forEach(p => {
    const pd     = getPairData(p.id);
    const bpData = { ...p, ...(allBp[p.id] || {}) };
    const kmVal  = p.km_rs || p.km_rks;
    const km     = kmVal ? parseFloat(kmVal).toFixed(3) : '—';

    const card = document.createElement('div');
    card.className = 'card';
    card.style.backgroundImage = `url(${cardTileUrl(p)})`;
    card.style.backgroundColor = getCardBg(pd.status);

    // Click-Handler (alle Phasen identisch)
    const cardHandler = (e) => {
      if (e.target.closest('.qs-picker')||e.target.closest('.qs-badge')||e.target.closest('.card-actions')||e.target.closest('.card-tag-picker')) return;
      showDetail(p.id);
    };
    card.addEventListener('click', cardHandler);
    let _tX = 0, _tY = 0, _tMoved = false;
    card.addEventListener('touchstart', (e) => { _tX = e.touches[0].clientX; _tY = e.touches[0].clientY; _tMoved = false; }, { passive: true });
    card.addEventListener('touchmove',  (e) => { if (Math.abs(e.touches[0].clientX-_tX)>8||Math.abs(e.touches[0].clientY-_tY)>8) _tMoved=true; }, { passive: true });
    card.addEventListener('touchend',   (e) => {
      if (_tMoved) return;
      if (e.target.closest('.qs-picker')||e.target.closest('.qs-badge')||e.target.closest('.card-actions')||e.target.closest('.card-tag-picker')) return;
      e.preventDefault(); e.stopPropagation(); showDetail(p.id);
    }, { passive: false });

    // --- Phase-spezifische Inhalte ---
    let badgesHtml = '';
    let infoLine   = `KM ${km}`;
    let subtitle   = '';
    let metasHtml  = '';

    if (phase === 'baugrund') {
      // Sondiertyp-Badge (RS / RKS / RS+RKS)
      const hasRs  = !!(p.lat_rs  && p.lng_rs);
      const hasRks = !!(p.lat_rks && p.lng_rks);
      const typLbl = hasRs && hasRks ? 'RS+RKS' : hasRs ? 'RS' : hasRks ? 'RKS' : (p.sondiertyp || '');
      if (typLbl) badgesHtml += `<div class="card-tag" style="background:#1a3a5c18;color:#1a3a5c;border:1px solid #1a3a5c33;">${typLbl}</div>`;
      // Sondiertag-Badge
      if (p.tag) badgesHtml += `<div class="card-tag" style="background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd;">${tagLabel(p.tag)}</div>`;

      infoLine += (p.tiefe ? ` · ${p.tiefe} m Soll` : '') + (p.gleis ? ` · Gleis ${p.gleis}` : '');
      subtitle  = p.zugang || p.bezeichnung || '';

      metasHtml = `
        ${hasSicherheit(p.id) ? '<span class="card-warn" title="Sicherheitsangaben"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>' : ''}
        ${hasFelddaten(p.id) ? '<span title="Felddaten vorhanden"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></span>' : ''}
        ${pd.sketch ? '<span title="Skizze"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></span>' : ''}
        ${(pd.fotos||[]).length ? '<span title="Fotos"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></span>' : ''}
        <span class="card-comment-icon ${pd.comment?'has-comment':''}" title="${pd.comment?'Kommentar':''}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
        ${liveDistances[p.id] != null ? '<span class="dist-badge">'+formatDist(liveDistances[p.id])+'</span>' : ''}`;

    } else {
      // Bauprojekt / Ausführung
      const col         = getMassnahmeColor(bpData);
      const massLabel   = getMassnahmeLabel(bpData);
      const ftEintrag   = bpData.ftProfilId ? ftProfiles.find(t => t.id === bpData.ftProfilId) : null;
      const fundtyp     = ftEintrag?.name || bpData.fundtyp || '';
      // Standard oder Spezial war auf der Kachel nicht zu erkennen — der Name
      // allein setzt Kenntnis der Typensystematik voraus. Fällt kein Eintrag
      // der Bibliothek zu, entscheidet der Name (isFtSpezial deckt Altdaten ab).
      const istSpezial  = ftEintrag ? ftEintrag.typ !== 'standard' : isFtSpezial(fundtyp);
      const neigung     = bpData.neigung || '';
      const massnahmeSet = bpData.massnahme || bpData.bestand || (bpData.fundtyp||'').startsWith('spezial-prov');
      if (massnahmeSet && kachelZeigt('massnahme')) badgesHtml += `<div class="card-tag" style="background:${col}18;color:${col};border:1px solid ${col}55;font-weight:600;">${massLabel}</div>`;
      // Spezial wird über Form unterschieden, nicht über Farbe: Warnzeichen und
      // kräftigere Umrandung. Ein farbiger Chip stach im monochromen Kachelbild
      // stärker hervor als die Statusfarben, die dort etwas bedeuten.
      if (fundtyp && kachelZeigt('fundtyp')) badgesHtml += istSpezial
        ? `<div class="card-tag" title="Spezialfundament — statischer Nachweis erforderlich" style="background:white;color:#1f2937;border:1px solid #6b7280;font-weight:600;display:inline-flex;align-items:center;gap:4px;">${svgIcon('warnung',{groesse:10})}${fundtyp}</div>`
        : `<div class="card-tag" title="Standardfundament" style="background:white;color:#6b7280;border:1px solid #e5e7eb;">${fundtyp}</div>`;
      // Baupaket + Schicht-Badge (nur Ausführung)
      if (phase === 'ausfuehrung' && kachelZeigt('baupaket') && typeof loadSchichtZuw === 'function') {
        const z = loadSchichtZuw()[p.id];
        if (z?.paketId) {
          const pak = (typeof loadBaupakete === 'function' ? loadBaupakete() : []).find(x => x.id === z.paketId);
          const sn  = z.schichtNr ? ' S' + z.schichtNr : '';
          badgesHtml += `<div class="card-tag" style="background:white;color:#374151;border:1px solid #d1d5db;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(pak?.name||'')+sn}">${(pak?.name||'').slice(0,10)}${sn}</div>`;
        }
      }
      if (neigung) infoLine += ` · Neig. ${neigung}`;
      subtitle = bpData.boden ? `Boden: ${bpData.boden}` : (p.bezeichnung || '');

      metasHtml = `
        <span class="card-comment-icon ${pd.comment?'has-comment':''}" title="${pd.comment?'Kommentar':''}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
        ${pd.sketch ? '<span title="Skizze"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></span>' : ''}
        ${(pd.fotos||[]).length ? '<span title="Fotos"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></span>' : ''}
        ${liveDistances[p.id] != null ? '<span class="dist-badge">'+formatDist(liveDistances[p.id])+'</span>' : ''}`;
    }

    // Notiz-Icon — nur wenn Notizen vorhanden (wie Skizze/Foto-Icons)
    const noteCount = (loadAllNotizen()[p.id] || []).length;
    if (noteCount) metasHtml += `<span title="${noteCount} Notiz${noteCount > 1 ? 'en' : ''}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span>`;

    // Custom-Tags-Chips + "+Tag"-Button
    const tagChips = (pd.tags||[]).map(tid => {
      const t = customTags.find(x => x.id === tid);
      return t ? `<span style="padding:2px 7px;border-radius:10px;font-size:10px;font-weight:600;background:${t.color}22;color:${t.color};">${t.name}</span>` : '';
    }).join('');
    const customTagsHtml = `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;align-items:center;">
      ${tagChips}
      <span onclick="event.stopPropagation();toggleCardTagPicker(${p.id},this)"
        style="padding:2px 6px;border-radius:8px;font-size:9px;font-weight:600;color:#9ca3af;
               border:1px solid #e5e7eb;cursor:pointer;line-height:1.4;transition:color 0.15s,border-color 0.15s;"
        onmouseover="this.style.color='#6b7280';this.style.borderColor='#9ca3af'" onmouseout="this.style.color='#9ca3af';this.style.borderColor='#e5e7eb'">+Tag</span>
    </div>`;

    card.innerHTML = `
      <div class="card-tag-picker" id="card-tag-picker-${p.id}">
        <div class="card-tag-picker-label">Tags</div>
        ${customTags.length ? customTags.map(t => { const active=(getPairData(p.id).tags||[]).includes(t.id); return `<label class="card-tag-picker-item"><input type="checkbox" ${active?'checked':''} onchange="togglePairTag(${p.id},'${t.id}')"><span style="color:${t.color}">${t.name}</span></label>`; }).join('') : '<span style="font-size:11px;color:#9ca3af;">Noch keine Tags.</span>'}
      </div>
      <div class="card-top">
        <div class="card-id">${standortName(p)}</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">${badgesHtml}</div>
      </div>
      ${kachelZeigt('km') ? `<div class="card-km">${infoLine}</div>` : ''}
      ${subtitle && kachelZeigt('untertitel') ? `<div class="card-zugang">${subtitle}</div>` : ''}
      ${kachelZeigt('tags') ? customTagsHtml : ''}
      <div class="card-footer">
        <div class="qs-wrap" onclick="event.stopPropagation()">
          <button class="qs-badge" style="${qsBadgeStyle(pd.status)}" onclick="toggleQsPicker(${p.id},this)">${statusLabel(pd.status)}<span class="qs-chevron">▾</span></button>
          <div class="qs-picker" id="qs-picker-${p.id}">${buildQsOpts(p.id, pd.status)}</div>
        </div>
        <div class="card-metas">${kachelZeigt('symbole') ? metasHtml : ''}</div>
      </div>`;
    grid.appendChild(card);
  });

  // "+ Neuer Standort" Kachel am Ende
  const addCard = document.createElement('div');
  addCard.className = 'card card-add';
  addCard.title = phase === 'baugrund' ? 'Neuen Standort erfassen' : 'Neuen Fundamentstandort erfassen';
  addCard.onclick = () => openCreateView();
  addCard.innerHTML = `<div class="card-add-icon">+</div><div class="card-add-label">${phase === 'baugrund' ? 'Neuer Standort' : 'Neuer Fundamentstandort'}</div>`;
  grid.appendChild(addCard);

  // Baustelleninstallationen — aus dem Grid heraus in eigene Section
  document.getElementById('inst-section-inline')?.remove();
  if (phase === 'bauprojekt' || phase === 'ausfuehrung') {
    const instList = getInstallationen();
    const instSection = document.createElement('div');
    instSection.id = 'inst-section-inline';
    instSection.style.cssText = 'padding:12px 0 8px;';

    // Separator
    const sep = document.createElement('div');
    sep.style.cssText = 'display:flex;align-items:center;gap:12px;padding:16px 0 12px;';
    sep.innerHTML = `
      <div style="flex:1;height:1px;background:#e5e7eb;"></div>
      <span style="font-size:10px;font-weight:700;color:#9ca3af;white-space:nowrap;letter-spacing:0.06em;text-transform:uppercase;">Baustelleninstallationen</span>
      <div style="flex:1;height:1px;background:#e5e7eb;"></div>`;
    instSection.appendChild(sep);

    // Eigenes Grid für Installations-Kacheln
    const instGrid = document.createElement('div');
    instGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;margin-top:8px;';

    instList.forEach(p => {
      const typLabel   = INST_TYP_LABELS[p.installTyp] || p.installTyp || '—';
      const flaecheStr = p.flaeche ? `${p.flaeche} m²` : (p.flaecheL && p.flaecheB ? `${p.flaecheL}×${p.flaecheB} m` : '—');
      const zeitraum   = (p.von || p.bis)
        ? `${p.von ? p.von.split('-').reverse().join('.') : '?'} – ${p.bis ? p.bis.split('-').reverse().join('.') : '?'}`
        : '';
      const instCard = document.createElement('div');
      instCard.className = 'card';
      instCard.style.backgroundImage = (p.rs?.e && p.rs?.n) ? `url(${cardTileUrl(p)})` : '';
      instCard.style.backgroundColor = 'white';
      instCard.style.borderColor = '#e5e7eb';
      instCard.addEventListener('click', (e) => {
        if (e.target.closest('.card-actions') || e.target.closest('.qs-wrap') || e.target.closest('.qs-picker')) return;
        showDetail(p.id);
      });
      const _instPd = getPairData(p.id);
      instCard.innerHTML = `
        <div class="card-top">
          <div class="card-id">${p.bezeichnung || ('Installation ' + p.id)}</div>
          <div style="background:#f3f4f6;color:#374151;border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700;">${typLabel}</div>
        </div>
        <div class="card-km">${flaecheStr}</div>
        ${zeitraum ? `<div class="card-zugang" style="font-size:11px;color:#4b5563;">${zeitraum}</div>` : ''}
        <div class="card-footer" style="margin-top:auto;">
          <div class="qs-wrap" onclick="event.stopPropagation()">
            <button class="qs-badge" style="${qsBadgeStyle(_instPd.status)}" onclick="toggleQsPicker(${p.id},this)">${statusLabel(_instPd.status)}<span class="qs-chevron">▾</span></button>
            <div class="qs-picker" id="qs-picker-${p.id}">${buildQsOpts(p.id, _instPd.status)}</div>
          </div>
          <div class="card-actions" style="display:flex;gap:5px;">
            <button onclick="event.stopPropagation();openCreateInstallation(${p.id})"
              style="padding:3px 8px;border-radius:5px;border:1px solid #d1d5db;background:white;color:#374151;font-size:10px;font-weight:600;cursor:pointer;">Bearbeiten</button>
            <button onclick="event.stopPropagation();deleteInstallation(${p.id})"
              style="padding:3px 8px;border-radius:5px;border:1px solid #fca5a5;background:#fff5f5;color:#dc2626;font-size:10px;font-weight:600;cursor:pointer;">Löschen</button>
          </div>
        </div>`;
      instGrid.appendChild(instCard);
    });

    const instAddCard = document.createElement('div');
    instAddCard.className = 'card card-add';
    instAddCard.title = 'Baustelleninstallation erfassen';
    instAddCard.onclick = () => openCreateInstallation();
    instAddCard.innerHTML = `<div class="card-add-icon">+</div><div class="card-add-label">Baustelleninstallation</div>`;
    instGrid.appendChild(instAddCard);

    instSection.appendChild(instGrid);
    // Einfügen direkt nach dem cards-grid
    const gridEl = document.getElementById('cards-grid');
    gridEl.insertAdjacentElement('afterend', instSection);
    // Nur in Kacheln-Ansicht sichtbar
    if (currentOverviewView !== 'karten') instSection.style.display = 'none';
  }

  renderNotizSection();
}

// ============================================================
// NOTIZEN-SEKTION (Kachelansicht, mit Filter)
// ============================================================
let _notizFilterPhase   = 'alle';
let _notizFilterSearch  = '';
let _notizFilterContext = '';

function getNotizContext() {
  const inOverview = document.getElementById('overview-view')?.style.display !== 'none';
  if (inOverview) {
    const VIEW_LABELS = {
      bauprogramm: 'Bauprogramm', fundamente: 'Bausortiment',
      termine: 'Termine', aushub: 'Aushubprotokoll',
      abnahme: 'Abnahme', baugrund: 'Baugrundbibl.',
    };
    return VIEW_LABELS[currentOverviewView] || '';
  }
  // Detailansicht → Mast-Kontext
  const pair = PAIRS.find(p => p.id === currentPairId);
  return pair ? standortName(pair) : '';
}

function setNotizPhaseFilter(val) {
  _notizFilterPhase = val;
  renderNotizSection();
}

function setNotizContextFilter(val) {
  _notizFilterContext = (_notizFilterContext === val) ? '' : val;
  renderNotizSection();
}

function renderNotizSection() {
  const wrap = document.getElementById('notiz-section');
  if (!wrap) return;

  // Alle Notizen sammeln (mastgebunden + mastunabhängig)
  const notAll   = loadAllNotizen();
  let   allNotes = [];
  getFilteredSorted().forEach(p => {
    (notAll[p.id] || []).slice().reverse().forEach(n => allNotes.push({ p, n, isGlobal: false }));
  });
  (notAll['_global'] || []).slice().reverse().forEach(n => allNotes.push({ p: null, n, isGlobal: true }));
  allNotes.sort((a, b) => b.n.ts.localeCompare(a.n.ts));

  // Phasen-Filter
  if (_notizFilterPhase !== 'alle') {
    if (_notizFilterPhase === 'allgemein') {
      allNotes = allNotes.filter(x => x.isGlobal);
    } else {
      allNotes = allNotes.filter(x => {
        if (!x.isGlobal) return (x.p._phase || 'baugrund') === _notizFilterPhase;
        // Globale Notizen nach gespeicherter Phase filtern
        return (x.n.phase || 'baugrund') === _notizFilterPhase;
      });
    }
  }

  // Kontext-Filter
  if (_notizFilterContext) {
    allNotes = allNotes.filter(({ n }) => (n.context || '') === _notizFilterContext);
  }

  // Suche
  const q = _notizFilterSearch.trim().toLowerCase();
  if (q) {
    allNotes = allNotes.filter(({ p, n, isGlobal }) =>
      n.text.toLowerCase().includes(q) ||
      (n.context || '').toLowerCase().includes(q) ||
      (!isGlobal && String(p.mast || p.id).toLowerCase().includes(q))
    );
  }

  const searchFocused = document.activeElement?.id === 'notiz-search-input';

  const phases = [
    { val: 'alle',        label: 'Alle' },
    { val: 'baugrund',    label: 'Baugrund' },
    { val: 'bauprojekt',  label: 'Bauprojekt' },
    { val: 'ausfuehrung', label: 'Ausführung' },
    { val: 'allgemein',   label: 'Allgemein' },
  ];

  const tilesHtml = allNotes.map(({ p, n, isGlobal }) => {
    const pairId = isGlobal ? '_global' : p.id;
    const phaseLabels = { baugrund:'Baugrund', bauprojekt:'Bauprojekt', ausfuehrung:'Ausführung' };
    const phaseBadge = isGlobal && n.phase
      ? `<span style="font-size:9px;padding:1px 5px;border-radius:8px;background:#f3f4f6;color:#6b7280;margin-left:4px;">${phaseLabels[n.phase] || n.phase}</span>`
      : '';
    const label  = isGlobal
      ? `<span style="font-size:11px;font-weight:700;color:#6b7280;">Allgemein${phaseBadge}</span>`
      : `<span style="font-size:11px;font-weight:700;color:#1a3a5c;cursor:pointer;"
           onclick="event.stopPropagation();showDetail(${p.id})">${standortName(p)}</span>`;
    return `
      <div style="position:relative;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;
                  padding:9px 11px;${!isGlobal ? 'cursor:pointer;' : ''}box-sizing:border-box;"
           ${!isGlobal ? `onclick="showDetail(${p.id})"` : ''}>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;padding-right:42px;">
          ${label}
          <span style="font-size:9px;color:#9ca3af;">${n.ts}</span>
        </div>
        ${n.context ? `<div style="margin-bottom:3px;"><span style="font-size:9px;font-weight:700;color:#1a3a5c;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:1px 6px;">#${n.context}</span></div>` : ''}
        <div style="font-size:11px;color:#374151;white-space:pre-wrap;word-break:break-word;overflow:hidden;max-height:48px;">${n.text.replace(/</g,'&lt;')}</div>
        <div style="position:absolute;top:6px;right:6px;display:flex;gap:2px;">
          <button onclick="event.stopPropagation();notizBearbeiten('${pairId}','${n.id}')"
            style="font-size:10px;color:#9ca3af;background:none;border:none;cursor:pointer;padding:2px;line-height:1;"
            onmouseover="this.style.color='#1a3a5c'" onmouseout="this.style.color='#9ca3af'" title="Bearbeiten">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onclick="event.stopPropagation();notizLoeschen('${pairId}','${n.id}')"
            style="font-size:10px;color:#d1d5db;background:none;border:none;cursor:pointer;padding:2px;line-height:1;"
            onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#d1d5db'" title="Löschen">✕</button>
        </div>
      </div>`;
  }).join('');

  wrap.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:16px 0 12px;margin-top:4px;">
      <div style="flex:1;height:1px;background:#e5e7eb;"></div>
      <span style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;">Notizen</span>
      <div style="flex:1;height:1px;background:#e5e7eb;"></div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
      ${phases.map(ph => `
        <button class="filter-btn${_notizFilterPhase === ph.val ? ' active' : ''}"
          style="padding:4px 10px;font-size:11px;"
          onclick="setNotizPhaseFilter('${ph.val}')">${ph.label}</button>`).join('')}
      <input id="notiz-search-input" type="search" placeholder="Suchbegriff…"
        value="${_notizFilterSearch.replace(/"/g,'&quot;')}"
        oninput="_notizFilterSearch=this.value;renderNotizSection()"
        style="padding:4px 10px;border-radius:20px;border:1px solid #d1d5db;background:white;
               font-size:11px;font-family:inherit;outline:none;width:140px;">
    </div>
    ${(() => {
      const allCtx = [...new Set(Object.values(loadAllNotizen()).flat().map(n => n.context).filter(Boolean))].sort();
      if (!allCtx.length) return '';
      return `<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:10px;">
        ${allCtx.map(ctx => `<button onclick="setNotizContextFilter('${ctx.replace(/'/g,"\\'")}')"
          style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;
                 background:${_notizFilterContext===ctx?'#1a3a5c':'#eff6ff'};
                 color:${_notizFilterContext===ctx?'white':'#1a3a5c'};
                 border:1px solid ${_notizFilterContext===ctx?'#1a3a5c':'#bfdbfe'};">#${ctx}</button>`).join('')}
      </div>`;
    })()}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;">
      ${tilesHtml}
      <div onclick="openSchnellNotizModal()"
        style="background:white;border:2px dashed #d1d5db;border-radius:10px;display:flex;
               flex-direction:column;align-items:center;justify-content:center;cursor:pointer;
               gap:3px;box-sizing:border-box;min-height:60px;">
        <span style="font-size:20px;color:#d1d5db;line-height:1;">+</span>
        <span style="font-size:10px;color:#9ca3af;">Notiz</span>
      </div>
    </div>`;

  if (searchFocused) {
    const inp = document.getElementById('notiz-search-input');
    if (inp) { inp.focus(); const v = inp.value; inp.value = ''; inp.value = v; }
  }
}

// ============================================================
