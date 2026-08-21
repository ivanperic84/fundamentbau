// INIT
// ============================================================
// Wird von js/start.js aufgerufen, NICHT hier direkt ausgefuehrt:
// der Block nutzt Funktionen aus spaeter geladenen Modulen
// (z. B. renderCards -> loadFtProfile aus fundamenttypen.js).
function initApp() {
try {
  // Event-Delegation: Auto-Save für alle Eingabefelder in der Sidebar
  (() => {
    const sidebar = document.querySelector('.detail-sidebar');
    if (!sidebar) return;
    const handle = (e) => {
      if (isLoading) return;
      const t = e.target;
      if (t.closest('#sec-zugang')) debouncedSaveComment();
      else if (t.closest('#sec-feld')) debouncedSaveFeld();
      else if (t.closest('#sec-sicher')) debouncedSaveSicher();
    };
    sidebar.addEventListener('input', handle);
    sidebar.addEventListener('change', handle);
  })();

  migrateAusfNotizenToNew();
  updateProgress();
  renderTagFilterChips();
  renderCards();
  renderContacts();

  // Modal nach Neues-Projekt-Erstellen wieder öffnen
  if (sessionStorage.getItem('reopen_projekt_modal')) {
    sessionStorage.removeItem('reopen_projekt_modal');
    setTimeout(() => openProjektModal(), 300);
  }

  // Ausstehender Fundamentliste-Import nach Neues-Projekt-Erstellen
  (() => {
    const b64 = sessionStorage.getItem('pendingFlImport');
    if (!b64) return;
    sessionStorage.removeItem('pendingFlImport');
    try {
      const bin = atob(b64);
      const u8  = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      setTimeout(() => _importFundamentlisteFromBuffer(u8.buffer), 200);
    } catch(e) { console.error('pendingFlImport Fehler:', e); }
  })();

  // Nach Refresh: gespeicherte Ansicht wiederherstellen
  const refreshView      = sessionStorage.getItem('refresh_view');
  const refreshTab       = sessionStorage.getItem('refresh_tab') || 'karten';
  const refreshBpHighlight = sessionStorage.getItem('refresh_bp_highlight') || '';
  sessionStorage.removeItem('refresh_view');
  sessionStorage.removeItem('refresh_pair');
  sessionStorage.removeItem('refresh_tab');
  sessionStorage.removeItem('refresh_bp_highlight');
  if (refreshView === 'detail') {
    const refreshPair = parseInt(sessionStorage.getItem('refresh_pair') || '0');
    if (refreshPair && PAIRS.find(p => p.id === refreshPair)) {
      setTimeout(() => showDetail(refreshPair), 0);
    } else {
      document.getElementById('overview-view').style.display = 'block';
      setTimeout(() => setOverviewView(refreshTab), 50);
    }
  } else {
    document.getElementById('overview-view').style.display = 'block';
    if (refreshBpHighlight) {
      // Direkt auf Baupaket-Karte zoomen
      setTimeout(() => showBaupaketOnMap(refreshBpHighlight), 150);
    } else {
      setTimeout(() => setOverviewView(refreshTab), 50);
    }
  }

  // Phasen initialisieren
  renderPhaseBanner();
  setTimeout(updatePhaseSelectState, 100);
  // Phasenbindung der Bereichsreiter: _navTabsAktualisieren() aus js/start.js.
  // Hier standen dieselben display:none-Zuweisungen ein zweites Mal — sie haben
  // die Sperrlogik ueberschrieben und den Baugrund-Reiter unsichtbar gehalten.
  // Installationen-Tab entfernt — Installationen direkt in Kachelansicht integriert
  // Bestehende Pairs migrieren: tag/nacht → Schicht-Bibliothek (einmalig, idempotent)
  setTimeout(() => autoRegisterSchichtenFromPairs(PAIRS), 100);
  // Verlaufs-Navigation initialisieren (Startzustand eintragen)
  setTimeout(() => {
    pushNavState({ type: 'overview', phase: _activePhase, view: currentOverviewView });
    updateNavButtons();
  }, 200);

} catch(e) {
  document.getElementById('overview-view').style.display = 'block';
  document.body.insertAdjacentHTML('afterbegin',
    `<div style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:white;overflow:auto;padding:20px;">
      <strong style="color:#b91c1c;">Fehler beim Laden:</strong><br>
      <span style="font-family:monospace;font-size:12px;color:red;white-space:pre-wrap;">${e.message}\n\n${e.stack}</span>
    </div>`);
}
}   // Ende initApp()

// ============================================================
// PHASENABHÄNGIGE EINGABEMASKE
// ============================================================
function applyCreatePhase() {
  const isBP   = _activePhase === 'bauprojekt';
  const isAF   = _activePhase === 'ausfuehrung';
  const isBG   = !isBP && !isAF;
  const isInst = _createInstallMode;

  // Installation: nur Positionspunkt + Inst-Felder
  const instFields = document.getElementById('cs-inst-fields');
  if (instFields) instFields.style.display = isInst ? '' : 'none';

  // Marker-Sektion: Installation → Bauprojekt-Marker (ein Punkt) | BG → RS/RKS/BS | BP/AF → Fundament
  const mBG = document.getElementById('cs-marker-baugrund');
  const mBP = document.getElementById('cs-marker-bauprojekt');
  if (mBG) mBG.style.display = (!isInst && isBG) ? '' : 'none';
  if (mBP) mBP.style.display = (isInst || isBP || isAF) ? '' : 'none';

  // Koordinaten: BG → RS/RKS/BS | BP/AF/Inst → ein Punkt
  const cBG = document.getElementById('cs-coords-baugrund');
  const cBP = document.getElementById('cs-coords-bauprojekt');
  if (cBG) cBG.style.display = (!isInst && isBG) ? '' : 'none';
  if (cBP) cBP.style.display = (isInst || isBP || isAF) ? '' : 'none';

  // Felder: BG → BG-Felder, BP/AF → BP-Felder, Inst → Inst-Felder (BG/BP ausblenden)
  const fBG = document.getElementById('cs-felder-baugrund');
  const fBP = document.getElementById('cs-felder-bauprojekt');
  if (fBG) fBG.style.display = (!isInst && isBG) ? '' : 'none';
  if (fBP) fBP.style.display = 'none'; // BP/AF-Felder werden nachträglich in der Sidebar definiert

  // Zugang-Feld: nur in Baugrundphase und nicht bei Installationen
  const zugangSection = document.getElementById('cs-zugang-section');
  if (zugangSection) zugangSection.style.display = (!isInst && isBG) ? '' : 'none';

  // Gemeinsame Grundfelder (Mast, KM, Strecke, Gleis): nicht relevant für Installationen
  const grundfelder = document.getElementById('cs-gemeinsame-grundfelder');
  if (grundfelder) grundfelder.style.display = isInst ? 'none' : '';

  // Picker-Titel
  const mBPBtn = document.getElementById('create-btn-fund2');
  if (mBPBtn) mBPBtn.textContent = isInst ? 'Standort setzen' : (isAF ? '◆ Fund. setzen' : 'Standort setzen');

  // Picker-Startmodus
  setCreatePickMode('rs');
}

function onCreateBestandChange() {
  const val = document.getElementById('c-bestand')?.value;
  // Massnahme-Wrap nur bei "Bestand" (nicht bei Provisorium oder Neubau)
  const massnahmeWrap = document.getElementById('c-massnahme-wrap');
  if (massnahmeWrap) massnahmeWrap.style.display = val === 'bestand' ? '' : 'none';
  if (val !== 'bestand') {
    const sw = document.getElementById('c-sicherung-wrap');
    if (sw) sw.style.display = 'none';
  }
}

function onCreateMassnahmeChange() {
  const val = document.getElementById('c-massnahme')?.value;
  const sw = document.getElementById('c-sicherung-wrap');
  if (sw) sw.style.display = val === 'sicherung' ? '' : 'none';
}

function onCreateFundtypChange() {
  const val = document.getElementById('c-fundtyp')?.value || '';
  const nw  = document.getElementById('c-nachweis-wrap');
  if (!nw) return;
  nw.style.display = isFtSpezial(val) ? '' : 'none';
}

function refreshFundtypDatalist() {
  const dl = document.getElementById('fundtyp-datalist');
  if (!dl) return;
  // Standard-Optionen fix + Bibliotheks-Einträge dynamisch
  const standard = ['DP1a','DP2a','HP1a','HP2a','spezial-pfahl','spezial-exz','spezial-rhs','spezial-kunstbau','spezial-mauer','spezial-fels','spezial-brunnen'];
  const libNames  = loadFtProfile().map(t => t.name).filter(n => !standard.includes(n));
  const all = [...standard, ...libNames];
  dl.innerHTML = all.map(n => `<option value="${n}">`).join('');
}

// Koordinaten-Label im Bauprojekt aktualisieren
function updateFundCoordLabel(latlng) {
  const lv95 = wgs84ToLv95(latlng.lat, latlng.lng);
  const lbl = document.getElementById('create-fund-coord-lbl');
  if (lbl) lbl.textContent = `E ${lv95.e} / N ${lv95.n}`;
  // Koordinaten auch in die Bauprojekt-Felder schreiben
  const eEl = document.getElementById('c-fund-e2');
  const nEl = document.getElementById('c-fund-n2');
  if (eEl) eEl.value = lv95.e;
  if (nEl) nEl.value = lv95.n;
}

// ============================================================
// BAUPROJEKT FELDER — openCreateView laden
// ============================================================
const BP_KEY = () => 'sp_bauprojekt__' + _activeId;

function loadAllBauprojekt() {
  try { return jsonParse(store.getItem(BP_KEY())) || {}; } catch { return {}; }
}
function saveAllBauprojekt(all) {
  store.setItem(BP_KEY(), JSON.stringify(all));
}

// ============================================================
// NOTIZEN — Storage (alle Phasen, standort-übergreifend)
// ============================================================
function loadAllNotizen() {
  try { return jsonParse(store.getItem('sp_notizen__' + _activeId) || '{}'); } catch(e) { return {}; }
}
function saveAllNotizen(obj) {
  store.setItem('sp_notizen__' + _activeId, JSON.stringify(obj));
}
function migrateAusfNotizenToNew() {
  const bpAll  = loadAllBauprojekt();
  const notAll = loadAllNotizen();
  let changed  = false;
  Object.keys(bpAll).forEach(pid => {
    const old = bpAll[pid]?.ausfNotizen;
    if (old?.length && !notAll[pid]?.length) {
      notAll[pid] = old.map(n => ({
        id: 'mg_' + Math.random().toString(36).slice(2),
        ts: n.ts, text: n.text
      }));
      changed = true;
    }
  });
  if (changed) saveAllNotizen(notAll);
}

// Rückwärtskompatibilität: alte spezial-* Codes auf Bibliotheks-Namen mappen
const SPEZIAL_LEGACY_MAP = {
  'spezial-pfahl':    'Pfahlfundament',
  'spezial-exz':      'Blockfundament exzentrisch',
  'spezial-rhs':      'RHS-Fundament',
  'spezial-kunstbau': 'Mast auf Kunstbau',
  'spezial-mauer':    'Mast an Mauer',
  'spezial-fels':     'Felsiger Baugrund',
  'spezial-brunnen':  'Brunnenring',
};

function normFundtyp(name) {
  return SPEZIAL_LEGACY_MAP[name] || name;
}

// Prüft ob ein Fundamenttyp als «Spezial» gilt (Nachweis erforderlich).
//
// Für Namen ohne Eintrag in der Bibliothek entschied früher allein das Präfix
// «spezial-». Importierte Bezeichnungen wie «Monopfahl / Ø400» galten damit als
// Standard — auf der Kachel ohne Kennzeichnung, in der Detailansicht ohne
// Nachweisfeld. Jetzt gilt: was keiner Standardfamilie der Bibliothek
// zuzuordnen ist, wird als Spezial behandelt. Das ist die sichere Seite.
function isFtSpezial(name) {
  if (!name) return false;
  const ft = loadFtProfile().find(t => t.name === name);
  if (ft) return ft.typ === 'spezial';
  if (name.startsWith('spezial-')) return true;      // Legacy-Schreibweise
  const familie = name.includes('/') ? name.split('/')[0].trim() : name.trim();
  return !getFtFamilies().includes(familie);
}

// Prüft ob es sich um einen Bauwerk-Typ handelt (Mauer / Kunstbau — keine Geländeneigung, kein Baugrund)
function isFtBauwerk(name) {
  if (!name) return false;
  const ft = loadFtProfile().find(t => t.name === name);
  if (ft) return ft.fundamentArt === 'mauer' || ft.fundamentArt === 'bauwerk';
  return name === 'Mast auf Kunstbau' || name === 'Mast an Mauer'
      || name === 'spezial-kunstbau'  || name === 'spezial-mauer'; // Legacy-Fallback
}

// Prüft ob es sich um einen Fels-Typ handelt (keine Bodenbeurteilung nötig)
function isFtFels(name) {
  if (!name) return false;
  const ft = loadFtProfile().find(t => t.name === name);
  if (ft) return ft.fundamentArt === 'fels';
  return name === 'spezial-fels' || name === 'Mast in Fels'; // Legacy-Fallback
}

// Prüft ob für diesen Fundamenttyp keine Bodenbeurteilung erforderlich ist
function isFtOhneBodenbeurteilung(name) {
  return isFtBauwerk(name) || isFtFels(name);
}

// Befüllt den bp-fundtyp Select dynamisch aus der Fundamenttypen-Bibliothek
function refreshBpFundtypSelect(savedVal) {
  seedDefaultFtProfile();
  const sel = document.getElementById('bp-fundtyp');
  if (!sel) return;
  const typen = loadFtProfile();
  const val = normFundtyp(savedVal || '');
  const std    = typen.filter(t => t.typ === 'standard');
  const spez   = typen.filter(t => t.typ === 'spezial');
  const custom = typen.filter(t => t.typ !== 'standard' && t.typ !== 'spezial');
  const opt = (t) => `<option value="${t.name}"${val === t.name ? ' selected' : ''}>${_ftLabel(t)}</option>`;
  let html = '<option value="">— wählen —</option>';
  if (std.length)    html += `<optgroup label="── Standard ──────────────">${std.map(opt).join('')}</optgroup>`;
  if (spez.length)   html += `<optgroup label="── Spezial ──────────────">${spez.map(opt).join('')}</optgroup>`;
  if (custom.length) html += `<optgroup label="── Bibliothek ────────────">${custom.map(opt).join('')}</optgroup>`;
  sel.innerHTML = html;
}

// ── Zweistufige FT-Auswahl (Familie + Neigung → Tiefe) ───────────────────────

// Löst den spezifischen FT-Eintrag aus Familie + Neigung auf
function resolveFtByFamilieNeigung(family, neigung, tiefe) {
  if (!family) return null;
  const std  = loadFtProfile().filter(t => t.typ === 'standard');
  const isB  = !!(neigung?.includes('14–33'));
  const opts = std.filter(t => {
    const fam = t.name.split('/')[0].trim();
    return fam === family && !!(t.einsatzBedingung?.includes('14–33')) === isB;
  });
  if (!opts.length) return null;
  if (opts.length === 1) return opts[0];
  if (tiefe) {
    const exact = opts.find(t => String(parseFloat(t.tiefe)) === String(parseFloat(tiefe)));
    if (exact) return exact;
  }
  // Standard-Fallback: Eintrag mit vollständigen Materialdaten
  return opts.find(t => t.beton && t.beton !== 'gem. Dok.') || opts[0];
}

// «Bearbeiten» neben dem Fundamenttyp in der Detailansicht.
//
// Vorher führte dieser Knopf bei Standardtypen in die Parameterdatenbank
// (Tabelle über alle Typen) und nur bei Spezialtypen ins Fundamenttyp-Modal —
// zwei verschiedene Oberflächen für dieselbe Handlung, je nach Typ. Unter
// Bausortiment öffnet ein Klick auf die Kachel immer das Modal. Jetzt beide
// Wege gleich: das Modal zeigt den Typ, bei Standardtypen mit gesperrter
// Geometrie und dem Verweis auf die Parameterdatenbank.
function onBpFtBearbeitenClick() {
  const name = document.getElementById('bp-fundtyp')?.value || '';
  if (!name) { openFtDatenbank(); return; }
  const ft = loadFtProfile().find(t => t.name === name) || _findFtInCache(loadFtProfile(), name);
  if (!ft) { openFtDatenbank(); return; }
  // Fallback: refFamilie aus Standort-Daten mitgeben, falls der FT-Eintrag noch
  // keinen referenzTyp trägt
  const bpRef = (loadAllBauprojekt()[currentPairId] || {}).refFamilie || '';
  openFundtypProfilModal(ft.id, bpRef);
}

// Befüllt #bp-ft-familie; stellt gespeicherten Wert wieder her
function refreshBpFamilieSelect(savedFundtyp) {
  seedDefaultFtProfile();
  const sel = document.getElementById('bp-ft-familie');
  if (!sel) return;
  const all    = loadFtProfile();
  const std    = all.filter(t => t.typ === 'standard');
  const spez   = all.filter(t => t.typ !== 'standard');
  const fams   = [...new Set(std.map(t => t.name.split('/')[0].trim()))];
  sel.innerHTML = `<option value="">— Familie wählen —</option>
    <optgroup label="── Standardtypen ──────────────">${fams.map(f => `<option value="${f}">${f}</option>`).join('')}</optgroup>
    ${spez.length ? `<optgroup label="── Spezial / Bibliothek ────────">${spez.map(t => `<option value="__spez__${t.id}">${_ftLabel(t)}</option>`).join('')}</optgroup>` : ''}`;

  if (!savedFundtyp) return;
  // Exakter Match; Fallback: Fuzzy-Match via _findFtInCache (toleriert "2.0" vs "2.00" etc.)
  const ft = all.find(t => t.name === savedFundtyp) || _findFtInCache(all, savedFundtyp);
  if (!ft) return;
  if (ft.typ === 'standard') {
    sel.value = ft.name.split('/')[0].trim();
    // Hidden bp-fundtyp befüllen und Tiefe-Picker ggf. zeigen
    refreshBpFundtypSelect(savedFundtyp);
    const bpSel = document.getElementById('bp-fundtyp');
    if (bpSel) bpSel.value = savedFundtyp;
    updateBpTiefeSelect(ft);
  } else {
    sel.value = '__spez__' + ft.id;
    const wrap = document.getElementById('bp-ft-tiefe-wrap');
    if (wrap) wrap.style.display = 'none';
    refreshBpFundtypSelect(savedFundtyp);
    const bpSel = document.getElementById('bp-fundtyp');
    if (bpSel) bpSel.value = savedFundtyp;
  }
}

// Tiefe-Picker anzeigen/befüllen wenn mehrere Varianten für Familie+Neigung existieren
function updateBpTiefeSelect(currentFt) {
  const family  = document.getElementById('bp-ft-familie')?.value || '';
  const wrap    = document.getElementById('bp-ft-tiefe-wrap');
  const tiefeSel = document.getElementById('bp-ft-tiefe');
  if (!wrap || !tiefeSel) return;
  if (!family || family.startsWith('__spez__')) { wrap.style.display = 'none'; return; }
  const neigung = document.getElementById('bp-neigung')?.value || '';
  const isB     = neigung.includes('14–33');
  const std     = loadFtProfile().filter(t => t.typ === 'standard');
  const opts    = std.filter(t => {
    const fam = t.name.split('/')[0].trim();
    return fam === family && !!(t.einsatzBedingung?.includes('14–33')) === isB;
  });
  if (opts.length <= 1) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  const cur = currentFt?.tiefe || '';
  tiefeSel.innerHTML = opts.map(t =>
    `<option value="${t.tiefe}"${String(t.tiefe) === String(cur) ? ' selected' : ''}>${t.tiefe} m — ${t.name}</option>`
  ).join('');
}

// Wird aufgerufen wenn Familie-Dropdown geändert wird
function onBpFamilieChange() {
  const famVal  = document.getElementById('bp-ft-familie')?.value || '';
  const neigung = document.getElementById('bp-neigung')?.value   || '';
  const bpSel   = document.getElementById('bp-fundtyp');
  if (!famVal) {
    if (bpSel) { bpSel.value = ''; }
    const wrap = document.getElementById('bp-ft-tiefe-wrap');
    if (wrap) wrap.style.display = 'none';
    onBpFundtypChange();
    return;
  }
  if (famVal.startsWith('__spez__')) {
    const id = famVal.replace('__spez__', '');
    const ft = loadFtProfile().find(t => t.id === id);
    if (ft && bpSel) { refreshBpFundtypSelect(ft.name); bpSel.value = ft.name; }
    const wrap = document.getElementById('bp-ft-tiefe-wrap');
    if (wrap) wrap.style.display = 'none';
  } else {
    const resolved = resolveFtByFamilieNeigung(famVal, neigung, null);
    updateBpTiefeSelect(resolved);
    if (resolved && bpSel) { refreshBpFundtypSelect(resolved.name); bpSel.value = resolved.name; }
    else if (bpSel) bpSel.value = '';
  }
  onBpFundtypChange();
}

// Wird aufgerufen wenn Tiefe-Picker geändert wird
function onBpTiefeChange() {
  const family  = document.getElementById('bp-ft-familie')?.value || '';
  const neigung = document.getElementById('bp-neigung')?.value   || '';
  const tiefe   = document.getElementById('bp-ft-tiefe')?.value  || '';
  const bpSel   = document.getElementById('bp-fundtyp');
  const resolved = resolveFtByFamilieNeigung(family, neigung, tiefe);
  if (resolved && bpSel) { refreshBpFundtypSelect(resolved.name); bpSel.value = resolved.name; }
  onBpFundtypChange();
}

// Wird aufgerufen wenn Neigung geändert wird — löst Familie neu auf
function onBpNeignungChange() {
  const famVal = document.getElementById('bp-ft-familie')?.value || '';
  if (famVal && !famVal.startsWith('__spez__')) onBpFamilieChange();
  saveBauprojektFeld(); updateBpFundAbmessung(); updateBodenkennwerteUI(); loadHoehenkoten();
  bpNeigungHinweis();
}

// Sagt an, was der gemessene Winkel mit der Klasse macht. Ohne das bliebe
// unklar, warum die Standardabmessung verschwindet, obwohl die Stufe noch
// «14–33°» anzeigt.
function bpNeigungHinweis() {
  const box = document.getElementById('bp-neigung-hinweis');
  if (!box) return;
  const bp = { neigung:     document.getElementById('bp-neigung')?.value || '',
               neigungGrad: document.getElementById('bp-neigung-grad')?.value || '' };
  const g = neigungGemessen(bp);
  if (g == null) { box.textContent = ''; box.style.color = '#9ca3af'; return; }
  const klasse = neigungKlasse(bp);
  if (g > NEIGUNG_STANDARD_MAX) {
    box.textContent = g.toFixed(1) + '° über ' + NEIGUNG_STANDARD_MAX + '° — kein Standardfundament, Nachweis erforderlich.';
    box.style.color = '#b45309';
  } else if (bp.neigung && klasse !== bp.neigung) {
    box.textContent = g.toFixed(1) + '° entspricht der Klasse ' + klasse + ' — es gilt der gemessene Wert.';
    box.style.color = '#b45309';
  } else {
    box.textContent = 'Gerechnet wird mit ' + g.toFixed(1) + '° statt der Klassenobergrenze.';
    box.style.color = '#9ca3af';
  }
}

// Zeigt FT-Profil-Daten als read-only Infokarte im Bauprojekt-Sidebar
function renderBpFtInfo() {
  const wrap = document.getElementById('bp-ft-info');
  if (!wrap) return;
  const name = document.getElementById('bp-fundtyp')?.value || '';
  const ft   = name ? loadFtProfile().find(t => t.name === name) : null;

  // VFK-Checkbox: für Standard- und Spezialfundamente anbieten (VFK = Baumethode, nicht FT-Eigenschaft)
  const vfkWrap = document.getElementById('bp-vfk-wrap');
  if (vfkWrap) {
    vfkWrap.style.display = (ft?.typ === 'standard' || ft?.typ === 'spezial') ? '' : 'none';
    const zeich = document.getElementById('bp-vfk-zeich');
    if (zeich) zeich.textContent = ft?.vfkZeichnungsNr || '';
  }

  if (!ft) {
    wrap.innerHTML = '';
    refreshBpNutzungsartSelect({}, '');
    return;
  }

  // Hilfsfunktionen
  const m2 = v => (v != null && v !== '' && v !== 'null' && !isNaN(parseFloat(v))) ? parseFloat(v).toFixed(2) : null;
  const mmStr2m = str => str ? str
    .replace(/(\d+(?:\.\d+)?)×(\d+(?:\.\d+)?)\s*mm/g, (_, a, b) => `${(+a/1000).toFixed(2)} × ${(+b/1000).toFixed(2)} m`)
    .replace(/(\d+(?:\.\d+)?)\s*mm/g, (_, a) => `${(+a/1000).toFixed(2)} m`) : str;
  const fmt = (v, unit) => { const n = m2(v); return n ? `${n}${unit ? ' ' + unit : ''}` : null; };
  const row = (lbl, val) => val ? `<div style="display:flex;align-items:baseline;gap:6px;padding:3px 0;border-bottom:1px solid #f0f2f5;">
    <span style="font-size:10px;color:#9ca3af;min-width:80px;flex-shrink:0;">${lbl}</span>
    <span style="font-size:11px;font-weight:600;color:#374151;">${val}</span>
  </div>` : '';

  const ART_LABELS = { blockfundament:'Blockfundament', einzelpfahl:'Einzelpfahl', mehrpfahl:'Mehrpfahlfundament', direktgr:'Direktgründung', fels:'Verankerung in Fels', mauer:'Befestigung an Mauer', bauwerk:'Befestigung an Bauwerk', sonstige:'Sonstige' };
  const artLabel = ART_LABELS[ft.fundamentArt] || (ft.fundamentArt ? ft.fundamentArt.charAt(0).toUpperCase() + ft.fundamentArt.slice(1) : '');

  // Kopf-Abmessungen
  let kopfBL = '';
  let kopfH  = '';
  if (ft.kopfB != null) {
    const bStr = m2(ft.kopfB);
    if (bStr) {
      const lStr = (ft.kopfL != null && ft.kopfL !== ft.kopfB) ? m2(ft.kopfL) : null;
      kopfBL = lStr ? `${bStr} × ${lStr} m` : `${bStr} × ${bStr} m`;
    }
  } else if (ft.kopfAbmessung) { kopfBL = mmStr2m(ft.kopfAbmessung); }
  if (ft.kopfHoehe != null) { const hStr = m2(ft.kopfHoehe); if (hStr) kopfH = `${hStr} m`; }

  // Block-Abmessungen
  let blockBL = '';
  if (ft.blockB != null) {
    const bStr = m2(ft.blockB);
    if (bStr) {
      const lStr = (ft.blockL != null && ft.blockL !== ft.blockB) ? m2(ft.blockL) : null;
      blockBL = lStr ? `${bStr} × ${lStr} m` : `${bStr} × ${bStr} m`;
    }
  } else if (ft.blockAbmessung && ft.blockAbmessung !== '—') { blockBL = mmStr2m(ft.blockAbmessung); }

  // Pfahl-Info
  let pfahl = '';
  if (ft.anzahlPfaehle) {
    pfahl = `${ft.anzahlPfaehle} Stk.`;
    if (ft.pfahlLaenge) pfahl += ` · ${ft.pfahlLaenge} m Länge`;
    // Hier stand `${ft.schraubLaenge} m` — das ist die Ankerbolzenlänge in
    // Zentimetern, im Pfahl-Block als Meter ausgegeben (250 wurde zu «250 m»).
    // Die Ankerbolzen erscheinen vollständig in der Zeile «schrauben» unten.
  }

  // Anker: nur bei Verankerung in Fels und Befestigung an Mauer. Die Felder
  // hiessen früher «Längsbewehrung» und standen bei jedem Standardtyp — dort
  // gibt es keine.
  const istAnkerBauweise = ft.fundamentArt === 'fels' || ft.fundamentArt === 'mauer';
  const anker = istAnkerBauweise && (ft.laengsAnzahl || ft.laengsDurchmesser)
    ? (ft.laengsAnzahl && ft.laengsDurchmesser
        ? `${ft.laengsAnzahl}×Ø${ft.laengsDurchmesser}`
        : (ft.laengsAnzahl || ft.laengsDurchmesser))
    : null;
  const buegel = ft.buegelDurchmesser && ft.buegelSeitenlaenge
    ? `${ft.buegelAnzahl ? ft.buegelAnzahl+'×' : ''}Ø${ft.buegelDurchmesser}/${ft.buegelSeitenlaenge} mm${ft.buegelArtikelNr ? ' ('+ft.buegelArtikelNr+')' : ''}` : null;
  const schrauben = ft.schraubenAnzahl && ft.schraubenDurchmesser
    ? `${ft.schraubenAnzahl}×${ft.schraubenDurchmesser}${ft.schraubenLaenge ? ', '+ankerLaengeText(ft.schraubenLaenge) : ''}${ft.schraubenArtikelNr ? ' ('+ft.schraubenArtikelNr+')' : ''}` : null;

  const isSpezial = ft.typ === 'spezial';

  // Referenztyp + Einsatzbedingung + Nachweis + Nutzungsart (per Standort)
  const bpD        = currentPairId ? (loadAllBauprojekt()[currentPairId] || {}) : {};
  refreshBpNutzungsartSelect(bpD, getBpRefFamilie(bpD) || (ft.name?.includes('/') ? ft.name.split('/')[0].trim() : ''));
  const refTyp     = isSpezial ? (ft.referenzTyp || bpD.refFamilie || null) : null;
  const nachweis   = isSpezial ? (bpD.nachweisLink || null) : null;
  const einsatz    = isSpezial ? (ft.einsatzBedingung || null) : null;
  const ftBemerkung = isSpezial ? (ft.bemerkung || null) : null;
  const effNutz   = bpD.nutzungsart || ft.nutzungsart || null;
  const nutzLabel  = effNutz ? (MAST_DATEN[effNutz]?.label || effNutz) : null;

  const rows = [
    row('Fundamentart',    artLabel),
    isSpezial ? row('Referenztyp',    refTyp) : null,
    nutzLabel   ? row('Nutzungsart',   nutzLabel) : null,
    row('Kopf b × b',      kopfBL || null),
    row('Kopf h',          kopfH  || null),
    row('Block b × b',     blockBL || null),
    row('Pfähle',          pfahl || null),
    row('Tiefe',           fmt(ft.tiefe, 'm')),
    isSpezial ? row('Stat. Nachweis', nachweis) : null,
    isSpezial ? row('Einsatzbedingung', einsatz) : null,
    isSpezial ? row('Bemerkung',      ftBemerkung) : null,
    !isSpezial ? row('Zeichnung Nr.',  ft.zeichnungsNr || null) : null,
    !isSpezial ? row('Beton',          ft.beton || null) : null,
    !isSpezial ? row('Betondeckung',   ft.betondeckung ? ft.betondeckung + ' mm' : null) : null,
    !isSpezial ? row('Bewehrungsstahl',ft.bewehrungsstahl || null) : null,
    row('Anker',           anker),
    !isSpezial ? row('Bügel',          buegel) : null,
    !isSpezial ? row('Fundamentschrauben', schrauben) : null,
    !isSpezial ? row('Schrauben Art.-Nr.', ft.schraubenArtikelNr || null) : null,
  ].filter(Boolean).join('');

  const vfkVisible = ft.typ === 'standard';
  wrap.innerHTML = rows ? `
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:${vfkVisible ? '7px 7px 0 0' : '7px'};padding:8px 10px;margin-bottom:0;">
      <div style="margin-bottom:6px;">
        <span style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Aus Bibliothek</span>
      </div>
      ${rows}
    </div>` : '';
}

function loadBauprojektFelder(pairId) {
  const all = loadAllBauprojekt();
  const bpData = all[pairId] || {};
  // Fallback: Daten können auch direkt in PAIRS gespeichert sein
  const pair = PAIRS.find(p => p.id === pairId) || {};
  const d = Object.keys(bpData).length > 0 ? bpData : pair;

  const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  v('bp-bestand',          d.bestand);
  v('bp-massnahme',        d.massnahme);
  v('bp-sicherung-link',   d.sicherungLink);
  v('bp-sicherung-bemerkung', d.sicherungBemerkung);
  refreshBpFamilieSelect(d.fundtyp); // zweistufig: Familie + Tiefe
  refreshBpRefFamilieSelect(d);      // Referenztyp-Familie (bei Spezialfundamenten)
  refreshBpNutzungsartSelect(d, getBpRefFamilie(d)); // Masttyp / Nutzungsart
  const vfkCb = document.getElementById('bp-vfk');
  if (vfkCb) vfkCb.checked = !!(d.vfk);
  renderBpFtInfo();
  v('bp-nachweis-link',    d.nachweisLink);
  v('bp-neigung',          d.neigung);
  v('bp-neigung-grad',     d.neigungGrad);
  v('bp-bemerkung',        d.bemerkung || pair.zugang || '');
  // Bodenkennwerte
  v('bk-me-wert',          d.bkMe);
  v('bk-phi-wert',         d.bkPhi);
  v('bk-gamma-wert',       d.bkGamma || '');
  v('bk-c-wert',           d.bkC     || '');
  _bkGrundwasser = d.bkGrundwasser || '';
  v('bk-bemerkung',        d.bkBemerkung);
  setBkBodentyp(d.bkBodentyp || 'fein', false);
  // Ausführungsplanung
  loadAusfPlanung(pairId);
  // Conditional visibility
  updateBpBestandUI();
  updateBpNachweisAndBoden();
  updateBodenkennwerteUI();
  updateBpFundAbmessung();
  loadHoehenkoten();
  // BlockCalc-Nachweis: Button-Sichtbarkeit + zuletzt übernommenes Ergebnis
  if (typeof bcStatusAktualisieren === 'function') bcStatusAktualisieren(pairId);
}

function saveBauprojektFeld() {
  if (!currentPairId) return;
  const v = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const all = loadAllBauprojekt();
  const existing = all[currentPairId] || {};
  const fundtypName = v('bp-fundtyp');

  // FT-Zuweisung-Store synchron halten
  let ftProfilId = existing.ftProfilId || '';
  const zuweisungen = loadFtZuweisungen();
  if (fundtypName) {
    const match = loadFtProfile().find(t => t.name === fundtypName);
    if (match) {
      ftProfilId = match.id;
      zuweisungen[currentPairId] = match.id;
      saveFtZuweisungen(zuweisungen);
    }
  } else if (existing.fundtyp && !fundtypName) {
    ftProfilId = '';
    delete zuweisungen[currentPairId];
    saveFtZuweisungen(zuweisungen);
  }

  const newBestand   = v('bp-bestand');
  const newMassnahme = v('bp-massnahme');
  // Änderungen protokollieren
  if (newBestand !== (existing.bestand || '') || newMassnahme !== (existing.massnahme || '')) {
    logChange(currentPairId, 'Massnahme', getMassnahmeLabel({bestand: newBestand, massnahme: newMassnahme}), 'massnahme');
  }
  if (fundtypName && fundtypName !== (existing.fundtyp || '')) {
    logChange(currentPairId, 'Fundamenttyp', fundtypName, 'fundtyp');
  }
  all[currentPairId] = {
    ...existing,
    bestand:           newBestand,
    massnahme:         newMassnahme,
    sicherungLink:     v('bp-sicherung-link'),
    sicherungBemerkung:v('bp-sicherung-bemerkung'),
    fundtyp:           fundtypName,
    ftProfilId,
    vfk:               document.getElementById('bp-vfk')?.checked || false,
    nachweisLink:      v('bp-nachweis-link'),
    neigung:           v('bp-neigung'),
    neigungGrad:       v('bp-neigung-grad'),
    bemerkung:         v('bp-bemerkung'),
    refFamilie:        v('bp-ref-familie'),
  };
  // importVerify.spezial quittieren sobald BP-Felder manuell gespeichert werden
  if (all[currentPairId].importVerify?.spezial) {
    const iv = { ...all[currentPairId].importVerify };
    delete iv.spezial;
    if (Object.keys(iv).length) all[currentPairId].importVerify = iv;
    else delete all[currentPairId].importVerify;
  }
  saveAllBauprojekt(all);
  refreshCurrentView();
}

function saveBodenkennwerte() {
  if (!currentPairId) return;
  const v = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const all = loadAllBauprojekt();
  const existing = all[currentPairId] || {};
  const bkMe  = v('bk-me-wert');
  const bkPhi = v('bk-phi-wert');
  // Bodenkennwerte gesetzt → importVerify.boden quittieren
  const ivUpd = { ...(existing.importVerify || {}) };
  if (bkMe || bkPhi) delete ivUpd.boden;
  all[currentPairId] = {
    ...existing,
    bkBodentyp:    _bkBodentyp,
    bkMe,
    bkPhi,
    bkGamma:       v('bk-gamma-wert'),
    bkC:           v('bk-c-wert'),
    bkGrundwasser: _bkGrundwasser,
    bkBemerkung:   v('bk-bemerkung'),
    importVerify:  Object.keys(ivUpd).length ? ivUpd : undefined,
  };
  saveAllBauprojekt(all);
  showBkFiWarn();
}

// ── Bodenaufschluss / Profil ─────────────────────────────────

function updateBkProfilInfo() {
  const sel = document.getElementById('bk-bg-profil-sel');
  if (!sel || !currentPairId) return;
  const profiles   = loadBgProfile();
  const assignedId = loadBgZuweisungen()[currentPairId] || '';
  sel.innerHTML =
    '<option value="">— kein Profil zugeordnet —</option>' +
    profiles.map(p => `<option value="${p.id}"${assignedId === p.id ? ' selected' : ''}>${p.name}</option>`).join('') +
    '<option value="__neu__">+ Neues Profil anlegen…</option>';
}

let _bgAutoAssignPairId = null;

function onBkBearbeitenClick() {
  if (!currentPairId) return;
  const assignedId = loadBgZuweisungen()[currentPairId] || null;
  if (!assignedId) _bgAutoAssignPairId = currentPairId;
  openBaugrundProfilModal(assignedId);
}

function onBkProfilSelChange(val) {
  if (!currentPairId) return;
  if (val === '__neu__') {
    _bgAutoAssignPairId = currentPairId;
    openBaugrundProfilModal(null);
    document.getElementById('bk-bg-profil-sel').value = '';
    return;
  }
  assignBgProfil(currentPairId, val || null);
  loadBauprojektFelder(currentPairId);
  updateBodenkennwerteUI();
  updateBkProfilInfo();
}

let _bkpTab = 'rs';

function openBkProfilModal() {
  const fd = getPairData(currentPairId).felddaten || {};
  const set = (id, val) => { const el = document.getElementById('bkp-' + id); if (el) el.value = val || ''; };
  set('rs-tiefe-ist',   fd.rs_tiefe_ist);
  set('rs-abbruch',     fd.rs_abbruch);
  set('rs-gw',          fd.rs_gw || 'nein');
  set('rs-gw-tiefe',    fd.rs_gw_tiefe);
  set('rs-bemerkung',   fd.rs_bemerkung);
  set('rks-tiefe-ist',  fd.rks_tiefe_ist);
  set('rks-abbruch',    fd.rks_abbruch);
  set('rks-kerngewinn', fd.rks_kerngewinn);
  set('rks-gw',         fd.rks_gw || 'nein');
  set('rks-gw-tiefe',   fd.rks_gw_tiefe);
  set('rks-schicht',    fd.rks_schicht);
  bkpToggleGW('rs');
  bkpToggleGW('rks');
  bkpSwitchTab('rs');
  document.getElementById('bk-profil-modal').style.display = 'flex';
}

function closeBkProfilModal() {
  document.getElementById('bk-profil-modal').style.display = 'none';
}

function saveBkProfilModal() {
  if (!currentPairId) return;
  const v = id => { const el = document.getElementById('bkp-' + id); return el ? el.value : ''; };
  const fd = {
    rs_tiefe_ist:   v('rs-tiefe-ist'),
    rs_abbruch:     v('rs-abbruch'),
    rs_gw:          v('rs-gw'),
    rs_gw_tiefe:    v('rs-gw-tiefe'),
    rs_bemerkung:   v('rs-bemerkung'),
    rks_tiefe_ist:  v('rks-tiefe-ist'),
    rks_abbruch:    v('rks-abbruch'),
    rks_kerngewinn: v('rks-kerngewinn'),
    rks_gw:         v('rks-gw'),
    rks_gw_tiefe:   v('rks-gw-tiefe'),
    rks_schicht:    v('rks-schicht'),
  };
  setPairData(currentPairId, { felddaten: fd });
  loadFelddaten();
  updateBkProfilInfo();
  closeBkProfilModal();
  showAutoSaved();
}

function bkpToggleGW(type) {
  const gw    = document.getElementById('bkp-' + type + '-gw');
  const depth = document.getElementById('bkp-' + type + '-gw-depth');
  if (gw && depth) depth.style.display = gw.value === 'ja' ? 'flex' : 'none';
}

function bkpSwitchTab(tab) {
  _bkpTab = tab;
  ['rs','rks'].forEach(t => {
    const btn = document.getElementById('bkp-tab-' + t);
    const pan = document.getElementById('bkp-panel-' + t);
    const active = t === tab;
    if (btn) btn.classList.toggle('aktiv', active);
    if (pan) pan.style.display = active ? 'flex' : 'none';
  });
}

let _bkFiWarnTimer = null;
function showBkFiWarn() {
  const w = document.getElementById('bk-fi-warn');
  if (!w) return;
  w.style.display = '';
  clearTimeout(_bkFiWarnTimer);
  _bkFiWarnTimer = setTimeout(() => { w.style.display = 'none'; }, 4000);
}

let _bpFtWarnTimer = null;
function showBpFtWarn() {
  const w = document.getElementById('bp-ft-warn');
  if (!w) return;
  w.style.display = '';
  clearTimeout(_bpFtWarnTimer);
  _bpFtWarnTimer = setTimeout(() => { w.style.display = 'none'; }, 4000);
}

// ── Bodenkennwerte UI ────────────────────────────────────────
let _bkBodentyp   = 'fein';
let _bkGrundwasser = '';

// Grenzwerte gem. 0161.1011.0010
const BK_GRENZWERTE = {
  fein: { me: 12, label: 'ME ≥ 12 MPa (feinkörnig, Erstbelastung)' },
  grob: { me: 25, label: 'ME ≥ 25 MPa (grobkörnig, Erstbelastung)' },
};

function setBkBodentyp(typ, save = true) {
  // USCS-Code normalisieren → 'fein'/'grob' (für BK_GRENZWERTE-Lookup)
  _bkBodentyp = (typ === 'fein' || typ === 'grob') ? typ : _uscsToBodentyp(typ);
  if (save) { saveBodenkennwerte(); updateBodenkennwerteUI(); }
}

function updateBodenkennwerteUI() {
  const sec = document.getElementById('sec-bodenkennwerte');
  if (sec) sec.style.display = _activePhase === 'bauprojekt' ? '' : 'none';

  const grenz  = BK_GRENZWERTE[_bkBodentyp] || BK_GRENZWERTE.fein;
  const meVal  = parseFloat(document.getElementById('bk-me-wert')?.value);
  const phiVal = parseFloat(document.getElementById('bk-phi-wert')?.value);
  const meOk   = !isNaN(meVal)  && meVal  >= grenz.me;
  const phiOk  = !isNaN(phiVal) && phiVal >= 27;
  const results = [];
  if (!isNaN(meVal))  results.push(meOk);
  if (!isNaN(phiVal)) results.push(phiOk);
  if (_bkGrundwasser && _bkGrundwasser !== 'unbekannt') results.push(true);

  const urteilEl = document.getElementById('bk-gesamturteil');
  if (urteilEl) {
    if (results.length > 0) {
      const allOk = results.every(r => r);
      urteilEl.textContent = allOk ? 'Erfüllt' : 'Nicht erfüllt';
      urteilEl.style.background = allOk ? '#dcfce7' : '#fee2e2';
      urteilEl.style.color      = allOk ? '#166534' : '#b91c1c';
    } else {
      urteilEl.textContent = '';
    }
  }

  const panel = document.getElementById('bk-compact-panel');
  if (!panel) return;

  const meRaw    = document.getElementById('bk-me-wert')?.value    || '';
  const phiRaw   = document.getElementById('bk-phi-wert')?.value   || '';
  const gammaRaw = document.getElementById('bk-gamma-wert')?.value || '';
  const cRaw     = document.getElementById('bk-c-wert')?.value     || '';
  const meNum    = parseFloat(meRaw);
  const phiNum   = parseFloat(phiRaw);
  const meOk2    = !isNaN(meNum)  && meNum  >= grenz.me;
  const phiOk2   = !isNaN(phiNum) && phiNum >= 27;
  const isFein   = _bkBodentyp !== 'grob';

  const dot  = ok => `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${ok?'#16a34a':'#dc2626'};flex-shrink:0;margin-left:2px;"></span>`;
  const rowS = 'display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #f0f2f5;';
  const lblS = 'font-size:10px;color:#9ca3af;min-width:84px;flex-shrink:0;';
  const valS = 'font-size:11px;color:#374151;font-weight:500;flex:1;';
  const unitS= 'font-size:10px;color:#9ca3af;flex-shrink:0;';
  const hint = (ok, txt) => `<div style="font-size:10px;color:${ok?'#9ca3af':'#b91c1c'};padding:1px 0 2px 90px;">${txt}</div>`;

  const gwLabels = { nicht_angetroffen:'Nicht angetroffen', angetroffen:'Angetroffen', gespannt:'Gespannt', unbekannt:'Unbekannt' };
  const _gwResolved = _bkGrundwasser ? (gwLabels[_bkGrundwasser] || _bkGrundwasser) : '—';
  const _gwIsNumeric = _bkGrundwasser && !gwLabels[_bkGrundwasser] && !isNaN(parseFloat(_bkGrundwasser));
  const gwLabel = _gwIsNumeric
    ? `${_gwResolved}<span style="font-size:10px;color:#9ca3af;margin-left:3px;">m</span>`
    : _gwResolved;

  panel.innerHTML = `
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:7px;padding:8px 10px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
        <span style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Bodenkennwerte</span>
        <span style="font-size:10px;font-weight:600;padding:1px 7px;border-radius:10px;background:${isFein?'#eff6ff':'#fef9c3'};color:${isFein?'#2563eb':'#854d0e'};">${isFein?'Feinkörnig':'Grobkörnig'}</span>
      </div>
      <div style="font-size:10px;color:#9ca3af;margin-bottom:6px;">${isFein?'CL, ML, CM, CH, MH (USCS)':'GW, GP, GM, GC, SW, SP, SM, SC (USCS)'}</div>

      <div style="${rowS}">
        <span style="${lblS}">ME-Wert</span>
        <span style="${valS}">${meRaw || '—'}${meRaw ? '<span style="font-size:10px;color:#9ca3af;margin-left:3px;">MPa</span>' : ''}</span>
        ${!isNaN(meNum) ? dot(meOk2) : ''}
      </div>
      ${!isNaN(meNum) ? hint(meOk2, meOk2 ? `Erfüllt (${meNum} ≥ ${grenz.me} MPa)` : `Nicht erfüllt (${meNum} < ${grenz.me} MPa)`) : ''}

      <div style="${rowS}">
        <span style="${lblS}">φ'k</span>
        <span style="${valS}">${phiRaw || '—'}${phiRaw ? '<span style="font-size:10px;color:#9ca3af;margin-left:2px;">°</span>' : ''}</span>
        ${!isNaN(phiNum) ? dot(phiOk2) : ''}
      </div>
      ${!isNaN(phiNum) ? hint(phiOk2, phiOk2 ? `Erfüllt (${phiNum}° ≥ 27°)` : `Nicht erfüllt (${phiNum}° < 27°)`) : ''}

      <div style="${rowS}">
        <span style="${lblS}">Raumlast γ'k</span>
        <span style="${valS}">${gammaRaw || '—'}${gammaRaw ? '<span style="font-size:10px;color:#9ca3af;margin-left:3px;">kN/m³</span>' : ''}</span>
      </div>

      <div style="${rowS}">
        <span style="${lblS}">Kohäsion c'k</span>
        <span style="${valS}">${cRaw || '—'}${cRaw ? '<span style="font-size:10px;color:#9ca3af;margin-left:3px;">kPa</span>' : ''}</span>
      </div>

      <div style="${rowS}border-bottom:none;">
        <span style="${lblS}">Grundwasser</span>
        <span style="${valS}">${gwLabel}</span>
      </div>

      <div style="margin-top:7px;padding-top:6px;border-top:1px solid #f0f2f5;font-size:10px;color:#6b7280;line-height:1.7;">
        <div style="font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:1px;">Grenzwerte (gem. 0161.1011.0010)</div>
        <div>φ'k ≥ <strong>27°</strong> &nbsp;·&nbsp; ME ≥ <strong>${grenz.me} MPa</strong> (${isFein?'feinkörnig':'grobkörnig'})</div>
        <div>Grundwasser: <strong>unterhalb Fundament</strong> &nbsp;·&nbsp; Neigung: <strong>≤ 33°</strong></div>
      </div>
    </div>`;
}

function openBodenkennwerteModal() {
  if (!currentPairId) return;
  const existing = document.getElementById('bk-edit-modal');
  if (existing) existing.remove();

  const grenz    = BK_GRENZWERTE[_bkBodentyp] || BK_GRENZWERTE.fein;
  const meRaw    = document.getElementById('bk-me-wert')?.value    || '';
  const phiRaw   = document.getElementById('bk-phi-wert')?.value   || '';
  const gammaRaw = document.getElementById('bk-gamma-wert')?.value || '';
  const cRaw     = document.getElementById('bk-c-wert')?.value     || '';
  const isFein   = _bkBodentyp !== 'grob';

  const gwOpts = [['','— ausstehend —'],['nicht_angetroffen','Nicht angetroffen'],['angetroffen','Angetroffen'],['gespannt','Gespannt'],['unbekannt','Unbekannt']]
    .map(([v,l]) => `<option value="${v}"${_bkGrundwasser===v?' selected':''}>${l}</option>`).join('');

  const inpS = 'width:100%;padding:6px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;font-family:inherit;box-sizing:border-box;';

  const overlay = document.createElement('div');
  overlay.id = 'bk-edit-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:10000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:10px;padding:22px;width:340px;max-height:90vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.18);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="margin:0;font-size:14px;font-weight:700;color:#1a3a5c;">Bodenkennwerte bearbeiten</h3>
        <button onclick="document.getElementById('bk-edit-modal').remove()" style="background:none;border:none;cursor:pointer;font-size:20px;color:#6b7280;padding:0;line-height:1;">×</button>
      </div>

      <div style="margin-bottom:14px;">
        <label style="font-size:11px;font-weight:600;color:#374151;display:block;margin-bottom:5px;">Bodentyp</label>
        <div style="display:flex;gap:4px;">
          <button id="bk-modal-btn-fein" onclick="bkModalSetBodentyp('fein')" style="flex:1;padding:5px;border-radius:5px;border:1px solid ${isFein?'#1a3a5c':'#e5e7eb'};background:${isFein?'#1a3a5c':'white'};color:${isFein?'white':'#6b7280'};font-size:11px;font-weight:600;cursor:pointer;">Feinkörnig</button>
          <button id="bk-modal-btn-grob" onclick="bkModalSetBodentyp('grob')" style="flex:1;padding:5px;border-radius:5px;border:1px solid ${!isFein?'#1a3a5c':'#e5e7eb'};background:${!isFein?'#1a3a5c':'white'};color:${!isFein?'white':'#6b7280'};font-size:11px;font-weight:600;cursor:pointer;">Grobkörnig</button>
        </div>
      </div>

      <div style="display:grid;gap:10px;margin-bottom:18px;">
        <div>
          <label style="font-size:11px;font-weight:600;color:#374151;display:block;margin-bottom:3px;">ME-Wert (MPa)</label>
          <input id="bk-modal-me" type="number" step="0.5" min="0" value="${meRaw}" placeholder="—" style="${inpS}">
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:#374151;display:block;margin-bottom:3px;">φ'k (°)</label>
          <input id="bk-modal-phi" type="number" step="0.5" min="0" max="45" value="${phiRaw}" placeholder="—" style="${inpS}">
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:#374151;display:block;margin-bottom:3px;">Raumlast γ'k (kN/m³)</label>
          <input id="bk-modal-gamma" type="number" step="0.5" min="0" value="${gammaRaw}" placeholder="—" style="${inpS}">
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:#374151;display:block;margin-bottom:3px;">Kohäsion c'k (kPa)</label>
          <input id="bk-modal-c" type="number" step="0.5" min="0" value="${cRaw}" placeholder="—" style="${inpS}">
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:#374151;display:block;margin-bottom:3px;">Grundwasser</label>
          <select id="bk-modal-gw" style="${inpS}background:white;">${gwOpts}</select>
        </div>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button onclick="document.getElementById('bk-edit-modal').remove()" style="padding:7px 16px;border-radius:6px;border:1px solid #e5e7eb;background:white;color:#374151;cursor:pointer;font-size:12px;font-weight:600;">Abbrechen</button>
        <button onclick="saveBodenkennwerteModal()" style="padding:7px 16px;border-radius:6px;border:none;background:#1a3a5c;color:white;cursor:pointer;font-size:12px;font-weight:600;">Speichern</button>
      </div>
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function bkModalSetBodentyp(typ) {
  _bkBodentyp = typ;
  const isFein = typ !== 'grob';
  const btnFein = document.getElementById('bk-modal-btn-fein');
  const btnGrob = document.getElementById('bk-modal-btn-grob');
  if (btnFein) { btnFein.style.cssText += `;background:${isFein?'#1a3a5c':'white'};color:${isFein?'white':'#6b7280'};border:1px solid ${isFein?'#1a3a5c':'#e5e7eb'};`; }
  if (btnGrob) { btnGrob.style.cssText += `;background:${!isFein?'#1a3a5c':'white'};color:${!isFein?'white':'#6b7280'};border:1px solid ${!isFein?'#1a3a5c':'#e5e7eb'};`; }
}

function saveBodenkennwerteModal() {
  const sv = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  sv('bk-me-wert',    document.getElementById('bk-modal-me')?.value    || '');
  sv('bk-phi-wert',   document.getElementById('bk-modal-phi')?.value   || '');
  sv('bk-gamma-wert', document.getElementById('bk-modal-gamma')?.value || '');
  sv('bk-c-wert',     document.getElementById('bk-modal-c')?.value     || '');
  _bkGrundwasser = document.getElementById('bk-modal-gw')?.value || '';
  saveBodenkennwerte();
  document.getElementById('bk-edit-modal')?.remove();
  updateBodenkennwerteUI();
}

function setKennwertStatus(statusId, hinweisId, val, ok, nok, okText, nokText) {
  const statusEl  = document.getElementById(statusId);
  const hinweisEl = document.getElementById(hinweisId);
  if (statusEl) {
    if (isNaN(val)) {
      statusEl.innerHTML = '';
    } else {
      const color = ok ? '#16a34a' : '#dc2626';
      statusEl.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-left:4px;flex-shrink:0;"></span>`;
    }
  }
  if (hinweisEl) {
    if (isNaN(val)) { hinweisEl.style.display = 'none'; return; }
    hinweisEl.style.display = '';
    hinweisEl.textContent   = ok ? okText : nokText;
    hinweisEl.style.background = '';
    hinweisEl.style.color      = ok ? '#6b7280' : '#b91c1c';
    hinweisEl.style.border     = '';
  }
}

function onBpMassnahmeChange() {
  saveBauprojektFeld();
  updateBpBestandUI();
}

function updateBpBestandUI() {
  const bestand   = document.getElementById('bp-bestand')?.value;
  const massnahme = document.getElementById('bp-massnahme')?.value;

  // Massnahme-Wrap nur bei "Bestand" (nicht bei Provisorium oder Neubau)
  const massnahmeWrap = document.getElementById('bp-massnahme-wrap');
  if (massnahmeWrap) massnahmeWrap.style.display = bestand === 'bestand' ? '' : 'none';

  // Sicherungs-Wrap
  const sicherungWrap = document.getElementById('bp-sicherung-wrap');
  if (sicherungWrap) sicherungWrap.style.display = (bestand === 'bestand' && massnahme === 'sicherung') ? '' : 'none';

  // Nachweis + Bodenkennwerte kombiniert neu beurteilen
  updateBpNachweisAndBoden();
}

// Masttypen / Nutzungsarten gemäss SBB-Parameterdatenbank (Zulassungsdokument)
// typ:'mast'  = Standardmast (Stahlprofil)
// typ:'anker' = Ankermontage auf Fundamentschrauben
//
// Zuordnung Profil → Referenztyp: DP1a HEB 220, DP2a HEB 260, HP1a und HP2a
// HEM 240. Die Gittermastfamilien DG1a/DG2a/DG3a tragen keinen Stielmast,
// dort gibt es folgerichtig keine Nutzungsart zur Auswahl.
//
// Anpassbar über Parameterdatenbank → Masttypen. Diese Vorgaben sind der
// Ausgangszustand; Änderungen liegen als Überschreibung daneben und lassen sich
// zurücksetzen, wie bei Geometrie und Material auch.
const MAST_DATEN_STANDARD = {
  'DP22':    { refTyp:'DP1a', profil:'HEB 220', typ:'mast',  label:'DP22 — HEB 220' },
  'A30':     { refTyp:'DP1a', profil:'M30',     typ:'anker', label:'A30 — Anker M30' },
  'DP26':    { refTyp:'DP2a', profil:'HEB 260', typ:'mast',  label:'DP26 — HEB 260' },
  'A36':     { refTyp:'DP2a', profil:'M36',     typ:'anker', label:'A36 — Anker M36' },
  'DPM24':   { refTyp:'HP1a', profil:'HEM 240', typ:'mast',  label:'DPM24 — HEM 240' },
  'DPM24-P': { refTyp:'HP2a', profil:'HEM 240', typ:'mast',  label:'DPM24-P — HEM 240' },
};
const MAST_OVERRIDE_KEY = 'sp_mast_overrides';

function loadMastOverrides()  { try { return jsonParse(store.getItem(MAST_OVERRIDE_KEY) || '{}'); } catch { return {}; } }
function saveMastOverrides(d) { store.setItem(MAST_OVERRIDE_KEY, JSON.stringify(d)); }

// Wirksame Masttypentabelle: Vorgaben, überlagert von den Anpassungen.
// Ein Eintrag mit { geloescht:true } blendet eine Vorgabe aus.
function getMastDaten() {
  const ov  = loadMastOverrides();
  const aus = { ...MAST_DATEN_STANDARD };
  Object.entries(ov).forEach(([key, d]) => {
    if (d?.geloescht) { delete aus[key]; return; }
    aus[key] = { ...(aus[key] || {}), ...d };
  });
  // Beschriftung folgt Kürzel und Profil, damit sie nach einer Änderung passt
  Object.entries(aus).forEach(([key, d]) => {
    d.label = d.typ === 'anker' ? `${key} — Anker ${d.profil || ''}`.trim()
                                : `${key} — ${d.profil || ''}`.trim();
  });
  return aus;
}

// Rückwärtskompatibler Lesezugriff für Code, der MAST_DATEN[key] erwartet.
// Ein Proxy statt einer Kopie: sonst liefe jede Anpassung ins Leere, weil die
// Kopie beim Laden der Datei entstanden wäre.
const MAST_DATEN = new Proxy({}, {
  get:            (_, k) => getMastDaten()[k],
  has:            (_, k) => k in getMastDaten(),
  ownKeys:        ()     => Reflect.ownKeys(getMastDaten()),
  getOwnPropertyDescriptor: (_, k) => {
    const d = getMastDaten()[k];
    return d ? { value: d, enumerable: true, configurable: true } : undefined;
  },
});

// Masttyp → Ref.Typ (für Import-Auflösung)
function getMasttypRefTyp(masttyp) { return getMastDaten()[masttyp]?.refTyp || ''; }

// Kompatible Masttyp-Optionen für einen Ref.Typ (inkl. Anker wo vorhanden)
function getMastOptionen(refTyp) {
  if (!refTyp) return [];
  return Object.entries(getMastDaten())
    .filter(([, d]) => d.refTyp === refTyp)
    .map(([key, d]) => ({ key, ...d }));
}
// Nur die Stielmasttypen — für die Kurzangabe «Mast: …» auf der Kachel.
// Dort standen bisher auch Ankermontagen (A30), die kein Mastprofil sind.
function getMasttypenForRefTyp(refTyp) {
  return getMastOptionen(refTyp).filter(o => o.typ !== 'anker').map(o => o.key).sort();
}

// Fundamentabmessungen gemäss SBB Dok. 0161.1011.0002 (Fallback für Legacy-Einträge ohne FT-Profil)
const FUND_ABMESSUNGEN = {
  // DP1a — Neigung ≤ 14°
  'DP1a|≤14°':       { querschnitt: '1.0 × 1.0 m', tiefe: '1.8 m', zeich: '0161.1011.0172' },
  'DP1a / 1.50|≤14°': { querschnitt: '1.0 × 1.0 m', tiefe: '1.5 m', zeich: '0161.1011.0171' },
  'DP1a / 1.80|≤14°': { querschnitt: '1.0 × 1.0 m', tiefe: '1.8 m', zeich: '0161.1011.0172' },
  'DP1a / 2.10|≤14°': { querschnitt: '1.0 × 1.0 m', tiefe: '2.1 m', zeich: '0161.1011.0173' },
  // DP1a — Neigung 14–33°
  'DP1a|14–33°':      { querschnitt: '1.0 × 1.0 m', tiefe: '2.4 m', zeich: '0161.1011.0174' },
  'DP1a / 2.40|14–33°': { querschnitt: '1.0 × 1.0 m', tiefe: '2.4 m', zeich: '0161.1011.0174' },
  // DP2a — Neigung ≤ 14°
  'DP2a|≤14°':        { querschnitt: '1.2 × 1.2 m', tiefe: '2.0 m', zeich: '0161.1011.0175' },
  'DP2a / 2.00|≤14°': { querschnitt: '1.2 × 1.2 m', tiefe: '2.0 m', zeich: '0161.1011.0175' },
  'DP2a / 2.40|≤14°': { querschnitt: '1.2 × 1.2 m', tiefe: '2.4 m', zeich: '0161.1011.0176' },
  // DP2a — Neigung 14–33°
  'DP2a|14–33°':      { querschnitt: '1.2 × 1.2 m', tiefe: '2.7 m', zeich: '0161.1011.0177' },
  'DP2a / 2.70|14–33°': { querschnitt: '1.2 × 1.2 m', tiefe: '2.7 m', zeich: '0161.1011.0177' },
  // DG1a — Gittermast klein
  'DG1a / 2.40|≤14°': { querschnitt: '1.3 × 1.3 m', tiefe: '2.4 m', zeich: '0161.1011.0178' },
  'DG1a / 2.70|≤14°': { querschnitt: '1.3 × 1.3 m', tiefe: '2.7 m', zeich: '0161.1011.0179' },
  'DG1a / 3.00|14–33°': { querschnitt: '1.3 × 1.3 m', tiefe: '3.0 m', zeich: '0161.1011.0180' },
  // DG2a — Gittermast mittel
  'DG2a / 2.50|≤14°': { querschnitt: '1.3 × 1.3 m', tiefe: '2.5 m', zeich: '0161.1011.0181' },
  // DG3a — Gittermast gross
  'DG3a / 2.60|≤14°': { querschnitt: '1.5 × 1.5 m', tiefe: '2.6 m', zeich: '0161.1011.0182' },
  'DG3a / 3.00|≤14°': { querschnitt: '1.5 × 1.5 m', tiefe: '3.0 m', zeich: '0161.1011.0183' },
  'DG3a / 3.50|14–33°': { querschnitt: '1.5 × 1.5 m', tiefe: '3.5 m', zeich: '0161.1011.0184' },
  // HP1a — Neigung ≤ 14°
  'HP1a|≤14°':        { querschnitt: '1.3 × 1.3 m', tiefe: '2.4 m', zeich: '0161.1011.0185' },
  'HP1a / 2.40|≤14°': { querschnitt: '1.3 × 1.3 m', tiefe: '2.4 m', zeich: '0161.1011.0185' },
  'HP1a / 2.90|≤14°': { querschnitt: '1.3 × 1.3 m', tiefe: '2.9 m', zeich: '0161.1011.0186' },
  // HP1a — Neigung 14–33°
  'HP1a|14–33°':      { querschnitt: '1.3 × 1.3 m', tiefe: '3.2 m', zeich: '0161.1011.0187' },
  'HP1a / 3.20|14–33°': { querschnitt: '1.3 × 1.3 m', tiefe: '3.2 m', zeich: '0161.1011.0187' },
  // HP2a — Neigung ≤ 14°
  'HP2a|≤14°':        { querschnitt: '1.3 × 1.3 m', tiefe: '2.4 m', zeich: '0161.1011.0188' },
  'HP2a / 2.40|≤14°': { querschnitt: '1.3 × 1.3 m', tiefe: '2.4 m', zeich: '0161.1011.0188' },
  // HP2a — Neigung 14–33°
  'HP2a|14–33°':      { querschnitt: '1.3 × 1.3 m', tiefe: '2.7 m', zeich: '0161.1011.0189' },
  'HP2a / 2.70|14–33°': { querschnitt: '1.3 × 1.3 m', tiefe: '2.7 m', zeich: '0161.1011.0189' },
};

function updateBpFundAbmessung() {
  const wrap  = document.getElementById('bp-abmessung-wrap');
  const text  = document.getElementById('bp-abmessung-text');
  const zeich = document.getElementById('bp-abmessung-zeich');
  if (!wrap || !text || !zeich) return;

  const fundtyp = document.getElementById('bp-fundtyp')?.value || '';
  // Massgebend ist die Klasse inklusive gemessenem Winkel — ein Hang von 35°
  // hebt sie auf «>33°», und dann gibt es keine Standardabmessung mehr.
  const neigung = neigungKlasse({
    neigung:     document.getElementById('bp-neigung')?.value || '',
    neigungGrad: document.getElementById('bp-neigung-grad')?.value || '' });

  if (!fundtyp || !neigung || isFtSpezial(fundtyp) || neigung === '>33°') {
    wrap.style.display = 'none';
    return;
  }

  // Erst FT-Bibliothek prüfen (neue Einträge haben zeichnungsNr direkt)
  const ft = loadFtProfile().find(t => t.name === fundtyp);
  if (ft && ft.zeichnungsNr && ft.tiefe) {
    const blockStr = ft.blockAbmessung && ft.blockAbmessung !== '—'
      ? ft.blockAbmessung.replace(/(\d+)[×x](\d+)\s*mm/i, (_, a, b) => `${(+a/1000).toFixed(2)}×${(+b/1000).toFixed(2)} m`)
      : '';
    text.textContent  = `${ft.name}${blockStr ? ' — ' + blockStr : ''}`;
    zeich.textContent = `Zeichnung Nr. ${ft.zeichnungsNr}`;
    wrap.style.display = '';
    return;
  }

  // Fallback: FUND_ABMESSUNGEN (Legacy-Einträge mit Basistypname)
  const neigKey = neigung.includes('14–33') ? '14–33°' : '≤14°';
  const key     = `${fundtyp}|${neigKey}`;
  // Auch Basistyp versuchen (z.B. 'DP1a' aus 'DP1a / 1.80')
  const baseKey = `${fundtyp.split('/')[0].trim().split(' ')[0]}|${neigKey}`;
  const d = FUND_ABMESSUNGEN[key] || FUND_ABMESSUNGEN[baseKey];

  if (!d) { wrap.style.display = 'none'; return; }

  text.textContent  = `${fundtyp} / ${d.tiefe} — ${d.querschnitt}`;
  zeich.textContent = `Zeichnung Nr. ${d.zeich}`;
  wrap.style.display = '';
}

function onBpFundtypChange() {
  saveBauprojektFeld();
  updateBpFundtypUI();
  updateBpFundAbmessung();
  renderBpFtInfo();
  loadHoehenkoten();
  showBpFtWarn();
}

// ----------------------------------------------------------------
// HÖHENKOTEN — Fundamentkopf + Sohle m ü. M.
// Fundamentkopf = Geländehöhe + 0.60 m (≤14°) / + 0.40 m (14–33°)
// Sohle = Fundamentkopf − 1.00 m (Kopflänge) − Einbindetiefe
// ----------------------------------------------------------------
function loadHoehenkoten() {
  if (!currentPairId) return;
  const sec  = document.getElementById('sec-hoehenkoten');
  const isBP = _activePhase === 'bauprojekt' || _activePhase === 'ausfuehrung';
  if (sec) sec.style.display = isBP ? '' : 'none';
  if (!isBP) return;

  const pair = PAIRS.find(p => p.id === currentPairId) || {};
  const all  = loadAllBauprojekt();
  let bpData = all[currentPairId] || {};

  // ── Auto-fill Fundamentkopf from pair.z when missing ────────────────────
  const hasZ = pair.z != null && !isNaN(parseFloat(pair.z));
  if (hasZ && (bpData.fundkopf_mueM == null || isNaN(parseFloat(bpData.fundkopf_mueM)))) {
    const autoKopf  = parseFloat(parseFloat(pair.z).toFixed(1));
    const ft        = loadFtProfile().find(t => t.name === (bpData.fundtyp || ''));
    let   autoSohle = null;
    if (ft?.tiefe != null && !isNaN(parseFloat(ft.tiefe))) {
      autoSohle = parseFloat((autoKopf - parseFloat(ft.kopfHoehe || 1.0) - parseFloat(ft.tiefe)).toFixed(1));
    }
    all[currentPairId] = { ...bpData, fundkopf_mueM: autoKopf,
      ...(autoSohle !== null ? { sohle_mueM: autoSohle } : {}) };
    saveAllBauprojekt(all);
    bpData = all[currentPairId];
  }

  // ── Geländehöhe ──────────────────────────────────────────────────────────
  const gelaende = parseFloat(bpData.gelaende_swisstopo ?? pair.gelaendehoehe);
  const gelanEl  = document.getElementById('hk-gelaende');
  if (gelanEl) gelanEl.textContent = !isNaN(gelaende) ? gelaende.toFixed(1) + ' m ü.M.' : '—';

  // ── Fundamentkopf ────────────────────────────────────────────────────────
  const fundkopf = bpData.fundkopf_mueM != null ? parseFloat(bpData.fundkopf_mueM) : NaN;
  const kopfEl   = document.getElementById('sb-fundkopf-mueM');
  const srcEl    = document.getElementById('hk-kopf-source');
  const readOnly = hasZ;
  if (kopfEl) {
    kopfEl.value       = !isNaN(fundkopf) ? fundkopf.toFixed(1) : '';
    kopfEl.readOnly    = readOnly;
    kopfEl.style.cssText = readOnly
      ? 'width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;font-family:inherit;background:#f8fafc;color:#6b7280;'
      : 'width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;font-family:inherit;';
  }
  if (srcEl) srcEl.textContent = hasZ ? '(Import)' : (!isNaN(fundkopf) ? '(Berechnet)' : '');

  // Δ Terrain (OK Kopf − Geländehöhe)
  const refDiv   = document.getElementById('hk-fundkopf-ref');
  const diffEl   = document.getElementById('hk-fundkopf-diff');
  const refValEl = document.getElementById('hk-fundkopf-ref-val');
  if (refDiv) {
    if (!isNaN(fundkopf) && !isNaN(gelaende)) {
      const delta = fundkopf - gelaende;
      refDiv.style.display = '';
      if (diffEl) {
        diffEl.textContent = `Δ Terrain ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} m`;
        // expected offset: 0.60 m (≤14°) or 0.40 m (14-33°)
        const expected = [0.40, 0.60];
        const ok = expected.some(e => Math.abs(delta - e) < 0.10);
        diffEl.style.color = ok ? '#16a34a' : (Math.abs(delta) > 2 ? '#dc2626' : '#d97706');
      }
      if (refValEl) refValEl.textContent = `(${gelaende.toFixed(1)} m Terrain)`;
    } else {
      refDiv.style.display = !isNaN(fundkopf) ? 'none' : 'none';
    }
  }

  // ── Sohle (auto-calculated from Fundamentkopf + FT profile) ─────────────
  _hkComputeAndRenderSohle(bpData, fundkopf);

  // ── GW-Kote ──────────────────────────────────────────────────────────────
  const gwKote = getBpGwKote(currentPairId);
  const gwRow  = document.getElementById('hk-gw-row');
  if (gwRow) {
    if (gwKote !== null) {
      gwRow.style.display = '';
      const tiefe = parseFloat(bpData.bkGrundwasser);
      const koteEl = document.getElementById('hk-gw-kote-val');
      const tiefeEl = document.getElementById('hk-gw-tiefe-val');
      if (koteEl)  koteEl.textContent  = gwKote.toFixed(1) + ' m ü.M.';
      if (tiefeEl) tiefeEl.textContent = `(Tiefe ${tiefe.toFixed(1)} m ab Gelände)`;
    } else {
      gwRow.style.display = 'none';
    }
  }

  // ── GW-Check ─────────────────────────────────────────────────────────────
  const sohle = bpData.sohle_mueM != null ? parseFloat(bpData.sohle_mueM) : NaN;
  _hkRenderGwCheck(sohle, gwKote, bpData.fundtyp);

  // ── Hinweis ───────────────────────────────────────────────────────────────
  const hinweisEl = document.getElementById('hk-hinweis');
  if (hinweisEl) {
    if (isNaN(fundkopf)) {
      hinweisEl.textContent = 'Koten noch nicht berechnet — «Startwerte berechnen» klicken.';
    } else if (!isNaN(gelaende)) {
      hinweisEl.textContent = '';
    } else {
      hinweisEl.textContent = 'Geländehöhe nicht bekannt — «Startwerte berechnen» für swisstopo-Abfrage.';
    }
  }
  renderAushubKotenInfo(currentPairId);
}

// Sohle aus Fundamentkopf + FT-Profil berechnen und im DOM anzeigen
function _hkComputeAndRenderSohle(bpData, fundkopf) {
  const sohlHidden  = document.getElementById('sb-sohle-mueM');
  const sohlDisplay = document.getElementById('hk-sohle-display');
  const sohlFormel  = document.getElementById('hk-sohle-formel');

  let sohle = bpData.sohle_mueM != null ? parseFloat(bpData.sohle_mueM) : NaN;

  // Auto-calc when Fundamentkopf + FT-Tiefe known
  if (!isNaN(fundkopf)) {
    const ft = loadFtProfile().find(t => t.name === (bpData.fundtyp || ''));
    if (ft?.tiefe != null && !isNaN(parseFloat(ft.tiefe))) {
      const kopfH    = parseFloat(ft.kopfHoehe || 1.0);
      const tiefe    = parseFloat(ft.tiefe);
      const calcSohl = parseFloat((fundkopf - kopfH - tiefe).toFixed(1));
      if (isNaN(sohle) || Math.abs(sohle - calcSohl) > 0.05) {
        const all = loadAllBauprojekt();
        if (!all[currentPairId]) all[currentPairId] = {};
        all[currentPairId].sohle_mueM = calcSohl;
        saveAllBauprojekt(all);
        bpData.sohle_mueM = calcSohl;
        sohle = calcSohl;
      }
      if (sohlFormel) {
        sohlFormel.style.display = '';
        sohlFormel.textContent   = `${fundkopf.toFixed(1)} − ${kopfH.toFixed(2)} m Kopf − ${tiefe.toFixed(2)} m Tiefe`;
      }
    } else if (sohlFormel) {
      sohlFormel.style.display = 'none';
    }
  } else if (sohlFormel) {
    sohlFormel.style.display = 'none';
  }

  if (sohlHidden)  sohlHidden.value       = !isNaN(sohle) ? sohle.toFixed(1) : '';
  if (sohlDisplay) sohlDisplay.textContent = !isNaN(sohle) ? sohle.toFixed(1) + ' m ü.M.' : '—';
}

// GW-Check: ist UK Fundament oberhalb des Grundwasserspiegels?
function _hkRenderGwCheck(sohle, gwKote, fundtyp) {
  const checkEl = document.getElementById('hk-gw-check');
  if (!checkEl) return;
  if (isNaN(sohle) || gwKote === null) { checkEl.style.display = 'none'; return; }
  checkEl.style.display = '';
  const delta    = sohle - gwKote;
  const isSpezial = fundtyp ? isFtSpezial(fundtyp) : false;
  if (delta >= 0) {
    checkEl.style.background = '#f0fdf4';
    checkEl.style.border     = '1px solid #bbf7d0';
    checkEl.style.color      = '#166534';
    checkEl.innerHTML = `UK Fundament <strong>${sohle.toFixed(1)} m</strong> liegt <strong>${delta.toFixed(1)} m</strong> über GW ${gwKote.toFixed(1)} m — Bedingung Standardfundament erfüllt`;
  } else {
    const absD = Math.abs(delta).toFixed(1);
    if (isSpezial) {
      checkEl.style.background = '#eff6ff';
      checkEl.style.border     = '1px solid #bfdbfe';
      checkEl.style.color      = '#1e40af';
      checkEl.innerHTML = `Spezialfundament: UK <strong>${sohle.toFixed(1)} m</strong>, GW <strong>${gwKote.toFixed(1)} m</strong> — Massnahmen gemäss Spezialnachweis`;
    } else {
      checkEl.style.background = '#fef2f2';
      checkEl.style.border     = '1px solid #fecaca';
      checkEl.style.color      = '#991b1b';
      checkEl.innerHTML = `UK Fundament <strong>${sohle.toFixed(1)} m</strong> liegt <strong>${absD} m</strong> unter GW ${gwKote.toFixed(1)} m — Spezialfundament prüfen / Wasserhaltung vorsehen`;
    }
  }
}

// Wird aufgerufen wenn Fundamentkopf-Input manuell geändert wird
function onHkKopfChange() {
  saveHoehenkoten();
  loadHoehenkoten();
}

async function recalcHoehenkoten() {
  if (!currentPairId) return;
  const pair      = PAIRS.find(p => p.id === currentPairId) || {};
  const hinweisEl = document.getElementById('hk-hinweis');
  const e         = pair.rs?.e || pair.rks?.e;
  const n         = pair.rs?.n || pair.rks?.n;
  const hasImportedZ = pair.z != null && !isNaN(parseFloat(pair.z));

  // ── Hilfsfunktion: Geländehöhe von swisstopo holen ───────────────────────
  const _fetchGelaende = async () => {
    if (!e || !n) throw new Error('Keine Koordinaten');
    if (hinweisEl) hinweisEl.textContent = 'Geländehöhe wird von swisstopo abgefragt…';
    const res = await fetch(`https://api.geo.admin.ch/rest/services/height?easting=${e}&northing=${n}&sr=2056&format=json`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.height) throw new Error('Keine Höhe in Antwort');
    return parseFloat(data.height);
  };

  // ── Modus A: Z aus Fundamentliste vorhanden → Geländehöhe abrufen für Δ ──
  if (hasImportedZ) {
    try {
      const gelaende = await _fetchGelaende();
      const all = loadAllBauprojekt();
      all[currentPairId] = { ...(all[currentPairId] || {}), gelaende_swisstopo: gelaende };
      saveAllBauprojekt(all);
      loadHoehenkoten();   // zeigt Δ OK Kopf – Terrain, sohle, GW-Check
    } catch(err) {
      if (hinweisEl) hinweisEl.textContent = `Höhenabfrage fehlgeschlagen (${err.message}).`;
    }
    return;
  }

  // ── Modus B: kein Z-Import → Fundamentkopf aus swisstopo + Neigung ───────
  let gelaende = parseFloat(bpDataFor(currentPairId).gelaende_swisstopo ?? pair.gelaendehoehe);
  if (isNaN(gelaende)) {
    try {
      gelaende = await _fetchGelaende();
      const idx = PAIRS.findIndex(p => p.id === currentPairId);
      if (idx >= 0) { PAIRS[idx] = { ...PAIRS[idx], gelaendehoehe: gelaende }; savePairs(); }
    } catch(err) {
      if (hinweisEl) hinweisEl.textContent = `Höhenabfrage fehlgeschlagen (${err.message}) — Geländehöhe manuell eintragen.`;
      return;
    }
  }
  if (isNaN(gelaende)) return;

  const neigung = document.getElementById('bp-neigung')?.value || '';
  let kopfOffset = null;
  if (neigung === '≤14°')           kopfOffset = 0.60;
  else if (neigung.includes('14')) kopfOffset = 0.40;
  if (kopfOffset === null) { ui.toast('Bitte zuerst die Geländeneigung wählen.', 'fehler'); return; }

  const fundamentkopf = parseFloat((gelaende + kopfOffset).toFixed(1));

  // Speichern: fundkopf_mueM + gelaende_swisstopo — sohle wird in loadHoehenkoten auto-berechnet
  const all = loadAllBauprojekt();
  all[currentPairId] = { ...(all[currentPairId] || {}), fundkopf_mueM: fundamentkopf, gelaende_swisstopo: gelaende };
  saveAllBauprojekt(all);

  // Grün-Flash auf OK Fundamentkopf Input
  const kopfEl = document.getElementById('sb-fundkopf-mueM');
  if (kopfEl) { kopfEl.style.background = '#f0fdf4'; setTimeout(() => { if (kopfEl) kopfEl.style.background = ''; }, 1800); }

  // pair.z setzen (Koordinate = berechneter Fundamentkopf)
  const pIdx = PAIRS.findIndex(p => p.id === currentPairId);
  if (pIdx >= 0) { PAIRS[pIdx].z = fundamentkopf; savePairs(); renderMetaSection(PAIRS[pIdx]); }

  loadHoehenkoten();
}

// Hilfsfunktion: bpData ohne Neuladen
function bpDataFor(pairId) { return (loadAllBauprojekt()[pairId]) || {}; }

function saveHoehenkoten() {
  if (!currentPairId) return;
  const all      = loadAllBauprojekt();
  const existing = all[currentPairId] || {};
  const kopf     = parseFloat(document.getElementById('sb-fundkopf-mueM')?.value);
  // Sohle is auto-calculated; only persist fundkopf from manual input
  all[currentPairId] = {
    ...existing,
    fundkopf_mueM: isNaN(kopf) ? null : kopf,
  };
  saveAllBauprojekt(all);
  _autoCheckGwRelevant();
}

// Leitet GW-Kote (m ü.M.) aus bkGrundwasser (Tiefe ab Gelände) ab
function getBpGwKote(pairId) {
  const bp      = (loadAllBauprojekt()[pairId]) || {};
  const pair    = PAIRS.find(p => p.id === pairId) || {};
  const tiefe   = parseFloat(bp.bkGrundwasser);
  if (isNaN(tiefe) || tiefe <= 0) return null;
  const gelaende = parseFloat(bp.gelaende_swisstopo ?? pair.gelaendehoehe);
  if (isNaN(gelaende)) return null;
  return parseFloat((gelaende - tiefe).toFixed(1));
}

// Zeigt UK Fundament + GW-Kote + Delta im Aushubprotokoll-Sidebar
function renderAushubKotenInfo(pairId) {
  const infoEl = document.getElementById('au-koten-info');
  if (!infoEl) return;
  const bp     = loadAllBauprojekt()[pairId] || {};
  const sohle  = bp.sohle_mueM != null ? parseFloat(bp.sohle_mueM) : NaN;
  const gwKote = getBpGwKote(pairId);
  if (isNaN(sohle) && gwKote === null) { infoEl.style.display = 'none'; return; }
  infoEl.style.display = '';
  document.getElementById('au-sohle-val').textContent = !isNaN(sohle) ? sohle.toFixed(1) + ' m ü.M.' : '—';
  document.getElementById('au-gw-val').textContent    = gwKote !== null ? gwKote.toFixed(1) + ' m ü.M.' : '—';
  const deltaRow = document.getElementById('au-gw-delta-row');
  const deltaEl  = document.getElementById('au-gw-delta');
  if (!isNaN(sohle) && gwKote !== null) {
    const delta = sohle - gwKote;
    deltaRow.style.display = '';
    deltaEl.textContent = delta >= 0
      ? `GW ${delta.toFixed(1)} m unter UK Fundament`
      : `GW ${Math.abs(delta).toFixed(1)} m über UK Fundament — Wasserhaltung prüfen`;
    deltaEl.style.color = delta < 0 ? '#dc2626' : delta < 0.5 ? '#d97706' : '#6b7280';
  } else {
    deltaRow.style.display = 'none';
  }
}

// GW-Spiegel vs. Sohlen-Kote: Status automatisch berechnen und anzeigen
function _autoCheckGwRelevant() { _updateGwSpiegelStatus(); }

function _updateGwSpiegelStatus() {
  const gwKote = getBpGwKote(currentPairId) ?? NaN;
  const sohle  = parseFloat(document.getElementById('sb-sohle-mueM')?.value);
  const resEl  = document.getElementById('ns-gw-spiegel-result');
  const masEl  = document.getElementById('ns-gw-massnahmen');
  if (!resEl) return;

  if (isNaN(gwKote) || isNaN(sohle)) {
    resEl.style.display = 'none';
    if (masEl) masEl.style.display = 'none';
    return;
  }

  const diff = sohle - gwKote; // positiv = GW liegt unterhalb Sohle

  const dot  = (col) => `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${col};margin-top:3px;flex-shrink:0;"></span>`;
  const sub  = (txt) => `<div style="font-size:10px;color:#6b7280;margin-top:2px;">${txt}</div>`;

  if (gwKote >= sohle) {
    const delta = (gwKote - sohle).toFixed(2);
    resEl.style.display = '';
    resEl.innerHTML = `<div style="display:flex;align-items:flex-start;gap:6px;">
      ${dot('#dc2626')}
      <span><strong>Spiegel oberhalb Fundamentsohle</strong>
        <span style="font-size:9px;background:#fee2e2;color:#b91c1c;border-radius:3px;padding:1px 4px;margin-left:4px;">Δ +${delta} m</span>
        — Wasserhaltung erforderlich
        ${sub(`GW ${gwKote.toFixed(1)} m ü.M. / UK Fund. ${sohle.toFixed(1)} m ü.M.`)}
      </span></div>`;
    if (masEl) masEl.style.display = '';
  } else if (diff <= 0.5) {
    const delta = diff.toFixed(2);
    resEl.style.display = '';
    resEl.innerHTML = `<div style="display:flex;align-items:flex-start;gap:6px;">
      ${dot('#f59e0b')}
      <span><strong>Spiegel nahe Fundamentsohle</strong>
        <span style="font-size:9px;background:#fef3c7;color:#92400e;border-radius:3px;padding:1px 4px;margin-left:4px;">Δ −${delta} m</span>
        — Vorsicht
        ${sub(`GW ${gwKote.toFixed(1)} m ü.M. / UK Fund. ${sohle.toFixed(1)} m ü.M.`)}
      </span></div>`;
    if (masEl) masEl.style.display = 'none';
  } else {
    resEl.style.display = 'none';
    if (masEl) masEl.style.display = 'none';
  }
}

function _updateGwZoneStyle() {
  const sel = document.getElementById('ns-gw-zone');
  if (!sel) return;
  const styles = {
    '':       { bg: '#fff',     border: '#e5e7eb', color: '#374151' },
    'AuAo':   { bg: '#f3f4f6', border: '#9ca3af', color: '#374151' },
    'andere': { bg: '#f3f4f6', border: '#9ca3af', color: '#374151' },
    'S3':     { bg: '#fefce8', border: '#ca8a04', color: '#854d0e' },
    'S2':     { bg: '#fff7ed', border: '#f97316', color: '#9a3412' },
    'S1':     { bg: '#fef2f2', border: '#ef4444', color: '#991b1b' },
  };
  const s = styles[sel.value] || styles[''];
  sel.style.background = s.bg;
  sel.style.borderColor = s.border;
  sel.style.color = s.color;
}

function updateBpFundtypUI() {
  updateBpNachweisAndBoden();
}

// Zentrale Funktion: Nachweis-Wrap und Bodenkennwerte-Sektion dynamisch steuern
// Befüllt den Referenztyp-Dropdown mit allen bekannten Familien-Kürzeln
function refreshBpRefFamilieSelect(bp) {
  const sel = document.getElementById('bp-ref-familie');
  if (!sel) return;
  const saved = bp?.refFamilie || getBpRefFamilie(bp) || '';
  sel.innerHTML = `<option value="">— nicht angegeben —</option>` +
    getFtFamilies().map(f => `<option value="${f}"${saved === f ? ' selected' : ''}>${f}</option>`).join('');
}

function refreshBpNutzungsartSelect(bpData, refTyp) {
  const wrap = document.getElementById('bp-nutzungsart-wrap');
  const sel  = document.getElementById('bp-nutzungsart');
  const info = document.getElementById('bp-nutzungsart-info');
  if (!wrap || !sel) return;
  const optionen = getMastOptionen(refTyp);
  wrap.style.display = optionen.length ? '' : 'none';
  if (!optionen.length) return;
  const current = bpData.nutzungsart || '';
  sel.innerHTML = `<option value="">— nicht definiert —</option>` +
    optionen.map(o =>
      `<option value="${o.key}"${current === o.key ? ' selected' : ''}>${o.label}</option>`
    ).join('');
  const chosen = MAST_DATEN[current];
  if (info) info.textContent = chosen
    ? (chosen.typ === 'anker' ? `Ankermontage, Schrauben ${chosen.profil}` : `Mastprofil ${chosen.profil}`)
    : '';
}

function saveBpNutzungsart(pairId, value) {
  if (!pairId) return;
  const allBP = loadAllBauprojekt();
  if (!allBP[pairId]) allBP[pairId] = {};
  allBP[pairId].nutzungsart = value;
  saveAllBauprojekt(allBP);
  const info = document.getElementById('bp-nutzungsart-info');
  if (info) {
    const d = MAST_DATEN[value];
    info.textContent = d
      ? (d.typ === 'anker' ? `Ankermontage, Schrauben ${d.profil}` : `Mastprofil ${d.profil}`)
      : '';
  }
}

function updateBpNachweisAndBoden() {
  const bestand   = document.getElementById('bp-bestand')?.value   || '';
  const massnahme = document.getElementById('bp-massnahme')?.value  || '';
  const fundtyp   = document.getElementById('bp-fundtyp')?.value    || '';

  const isSpezial          = isFtSpezial(fundtyp);
  const isBauwerk          = isFtBauwerk(fundtyp);
  const isFels             = isFtFels(fundtyp);
  const isOhneBoden        = isFtOhneBodenbeurteilung(fundtyp);
  const isBestandErhalten  = bestand === 'bestand' && massnahme === 'erhalten';
  const isBestandAbbruch   = bestand === 'bestand' && massnahme === 'abbruch';
  const isBestandAbbruchNur = bestand === 'bestand' && massnahme === 'abbruch-nur';
  const isBestandSicherung = bestand === 'bestand' && massnahme === 'sicherung';

  // Prüfen ob ein FT-Profil hinterlegt ist → Felder dann gesperrt (nur über Modal änderbar)
  const bpData   = currentPairId ? (loadAllBauprojekt()[currentPairId] || {}) : {};
  const hasFtProfil = !!(bpData.ftProfilId);

  // ── Nachweis-Wrap: nur bei Spezial + Neubau, oder Fundamentsicherung ──
  const nachweisWrap  = document.getElementById('bp-nachweis-wrap');
  const nachweisInput = document.getElementById('bp-nachweis-link');

  const showNachweis = (isSpezial && !isBestandErhalten && !isBestandAbbruchNur) || isBestandSicherung;

  // Wenn FT hinterlegt + Spezial → Nachweis + Referenztyp stehen in der Info-Box
  // → nur die EINGABEN ausblenden. Der BlockCalc-Knopf bleibt; er ist keine
  // Angabe, sondern die Handlung, für die man hier ist. Bis v237 wurde der
  // ganze Bereich versteckt, und damit war der Knopf genau dann weg, wenn ein
  // Typ zugewiesen war — also im Normalfall.
  const hideInBox = hasFtProfil && isSpezial;
  const nachweisFelder = document.getElementById('bp-nachweis-felder');
  if (nachweisFelder) nachweisFelder.style.display = hideInBox ? 'none' : '';
  if (nachweisWrap) {
    nachweisWrap.style.display = showNachweis ? '' : 'none';
    // Merker fuer bcStatusAktualisieren: in diesem Zustand traegt der Bereich
    // nur noch BlockCalc. Hat BlockCalc nichts zu zeigen, verschwindet er ganz,
    // damit keine leere Ueberschrift stehen bleibt.
    nachweisWrap.dataset.nurBc = hideInBox ? '1' : '';
  }
  if (nachweisInput && !hideInBox && showNachweis) {
    nachweisInput.placeholder = 'https://… oder Dok.-Nr.';
    nachweisInput.disabled        = false;
    nachweisInput.style.background = '';
    nachweisInput.style.color      = '';
    nachweisInput.style.cursor     = '';
    const ftHintN = nachweisWrap.querySelector('.ft-locked-hint');
    if (ftHintN) ftHintN.remove();
  }

  // ── Referenztyp-Familie: nur bei Spezialfundamenten ohne hinterlegtem FT ──
  const refFamilieWrap = document.getElementById('bp-ref-familie-wrap');
  if (refFamilieWrap) refFamilieWrap.style.display = (isSpezial && !hideInBox) ? '' : 'none';
  if (!hideInBox) {
    const refFamilieSel = document.getElementById('bp-ref-familie');
    if (refFamilieSel) {
      refFamilieSel.disabled        = false;
      refFamilieSel.style.background = 'white';
      refFamilieSel.style.color      = '';
      refFamilieSel.style.cursor     = '';
    }
    const ftHintR = refFamilieWrap?.querySelector('.ft-locked-hint');
    if (ftHintR) ftHintR.remove();
  }

  // ── Geländeneigung: bei Bauwerk/Mauer und Fels nicht relevant ──
  const neigungWrap = document.getElementById('bp-neigung')?.closest('div');
  if (neigungWrap) neigungWrap.style.display = (isBauwerk || isFels) ? 'none' : '';

  // ── Bodenkennwerte-Sektion ──
  const secBoden = document.getElementById('sec-bodenkennwerte');
  if (!secBoden) return;

  // Bodenbeurteilung nicht nötig bei: Bestand erhalten, Abbruch, Fels, Mauer/Kunstbau
  // Bei allen anderen Fällen (Neu, Prov, Spezial ohne Fels/Bauwerk) ist sie zwingend.
  const bodenNichtRelevant = isBestandErhalten || isBestandAbbruchNur || isOhneBoden;
  const bodenBannerText = isBestandErhalten
    ? 'Nicht erforderlich — Bestand erhalten'
    : isBestandAbbruchNur
      ? 'Nicht erforderlich — Abbruch'
      : isFels
        ? 'Nicht erforderlich — Verankerung in Fels'
        : `Nicht erforderlich — Mast an ${fundtyp === 'Mast an Mauer' || fundtyp === 'spezial-mauer' ? 'Mauer' : 'Kunstbau/Bauwerk'}`;

  if (bodenNichtRelevant) {
    secBoden.style.display = '';
    const body = secBoden.querySelector('.sb-body');
    if (body) {
      let banner = secBoden.querySelector('#boden-nicht-relevant-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'boden-nicht-relevant-banner';
        banner.style.cssText = 'padding:8px 12px;background:#f3f4f6;border-radius:6px;font-size:11px;color:#6b7280;margin-bottom:8px;';
        body.insertBefore(banner, body.firstChild);
        Array.from(body.children).forEach(el => { if (el.id !== 'boden-nicht-relevant-banner') el.style.display = 'none'; });
      }
      banner.textContent = bodenBannerText;
    }
  } else {
    secBoden.style.display = _activePhase === 'bauprojekt' ? '' : 'none';
    const body = secBoden.querySelector('.sb-body');
    if (body) {
      const banner = secBoden.querySelector('#boden-nicht-relevant-banner');
      if (banner) banner.remove();
      Array.from(body.children).forEach(el => { el.style.display = ''; });
    }
    // Geländeneigung wieder einblenden
    if (neigungWrap) neigungWrap.style.display = '';
  }
}

// ── GIS-Abfrage Naturschutz (geo.admin.ch) ──────────────────
// Identify-API unterstützt nur Layer mit GeoTable (Vektordaten).
// ch.are.gewaesserraum liefert HTTP 400 — daher nur im Kartenlink.
// Nur Layer mit GeoTable / Identify-Support (WMS-Layer liefern HTTP 400):
// WMS-Layer ohne Identify-Support (nur Kartenlink): ch.bafu.gewaesserschutz, ch.are.gewaesserraum
const GIS_NS_LAYERS = [
  { id: 'ch.bafu.bundesinventare-bln',                label: 'BLN-Inventar',            key: 'bln'  },
  { id: 'ch.bafu.schutzgebiete-aulav_auen',           label: 'Auengebiet (AuLaV)',       key: 'auen' },
  { id: 'ch.bafu.schutzgebiete-aulav_moorlandschaften', label: 'Moorlandschaft (AuLaV)', key: 'moor' },
  { id: 'ch.pronatura.naturschutzgebiete',            label: 'Pro Natura Schutzgebiet',  key: 'nsg'  },
];

// Aktualisiert die drei ↗ Karte-Links mit den aktuellen Koordinaten
function updateGisMapLinks(e, n) {
  if (!e || !n) return;
  const z = 12;
  const pin = `&crosshair=marker`;
  const nsEl  = document.getElementById('ns-gis-map-link');
  const altEl = document.getElementById('ns-alt-map-link');
  const gwEl  = document.getElementById('ns-gw-geo-link');
  if (nsEl)  nsEl.href  = `https://map.geo.admin.ch/#/map?lang=de&center=${e},${n}&z=${z}&bgLayer=ch.swisstopo.pixelkarte-farbe&layers=ch.bafu.bundesinventare-bln;ch.bafu.schutzgebiete-aulav_auen;ch.bafu.schutzgebiete-aulav_moorlandschaften;ch.pronatura.naturschutzgebiete${pin}`;
  if (altEl) altEl.href = `https://map.geo.admin.ch/#/map?lang=de&center=${e},${n}&z=${z}&bgLayer=ch.swisstopo.pixelkarte-farbe&layers=ch.bav.kataster-belasteter-standorte-oev;ch.bazl.kataster-belasteter-standorte-zivilflugplaetze;ch.vbs.kataster-belasteter-standorte-militaer${pin}`;
  // GW: geodienste.ch WMS über geo.admin.ch eingebettet
  if (gwEl)  gwEl.href  = `https://map.geo.admin.ch/#/map?lang=de&center=${e},${n}&z=13&bgLayer=ch.swisstopo.pixelkarte-grau&layers=WMS%7Chttps://geodienste.ch/db/planerischer_gewaesserschutz_v1_2_0/deu?%7Cgewaesserschutzkarte,,0.5${pin}`;
  _updateGwsKantonLink(e, n);
}

// Kantonale GW-Schutzzonen-Links (Gewässerschutzkarte, Grundwasserschutzzonen S1/S2/S3)
const GWS_KANTON_URLS = {
  ZH: 'https://geo.zh.ch/maps',
  BE: 'https://map.apps.be.ch/?lang=de#catgroup=Umwelt&cat=Wasser',
  LU: 'https://www.geo.lu.ch/map/grundwasserschutz',
  SZ: 'https://map.geo.sz.ch/webgis/waermenutzung_grundwasser',
  ZG: 'https://maps.zg.ch/?topic=gwsz',
  SO: 'https://geo.so.ch/map/?topic=soAWGW_grundwasserschutzzonen',
  BL: 'https://www.geo.bl.ch/geodaten/themen/gewaesserschutz',
  AG: 'https://www.ag.ch/app/agisviewer4/index.html#/map?topic=Gewässerschutz',
  TG: 'https://maps.tg.ch/apps/grundwasserschutz',
  SG: 'https://www.geoportal.ch/ksgis/web/gis?userprofile=ksgis&project=SG&service=grundwasser',
  GR: 'https://geo.gr.ch/map?topic=grundwasser',
  VS: 'https://map.geo.vs.ch/?lang=fr&topic=Eau',
  VD: 'https://www.geo.vd.ch/theme/protection_eaux',
  GE: 'https://map.sitg.ch/app/?layers=zones_protection_eaux',
  FR: 'https://map.fr.ch/?lang=de&topic=GESZ',
  NE: 'https://sitn.ne.ch/map/?topic=protectionEaux',
  JU: 'https://www.jura.ch/DEN/SNE/Eau.html',
  UR: 'https://www.ur.ch/dienstleistungen/5453',
  OW: 'https://www.ow.ch/de/verwaltung/departemente/volkswirtschaftsdepartement/amt-fuer-raumentwicklung-und-geoinformation',
  NW: 'https://www.nw.ch/baugis',
  GL: 'https://www.gl.ch/verwaltung/departemente/departement-bau-und-umwelt/hochbau-raumplanung-und-umwelt/abteilung-umweltschutz.html/2338',
  SH: 'https://www.sh.ch/CMS/Webseite/Kanton-Schaffhausen/Beh-rde/Verwaltung/Volkswirtschaftsdepartement/Amt-f-r-Lebensmittelkontrolle-und-Umweltschutz-1174636-DE.html',
  AR: 'https://www.ar.ch/verwaltung/departemente/departement-bau-und-volkswirtschaft/amt-fuer-umwelt',
  AI: 'https://www.ai.ch/themen/umwelt-natur-und-landschaft/wasser',
  BS: 'https://map.bs.ch/?topic=Gewaesserschutz',
  TI: 'https://www4.ti.ch/dt/da/spaas/suolo-pianificazione-e-autorizzazioni/fondi-idrici/protezione-delle-acque-sotterranee/',
};

// Koordinaten an kantonale GIS-URLs anhängen (wo Parameter bekannt)
function _gwsUrlWithCoords(kanton, url, e, n) {
  const ex = Math.round(e), ny = Math.round(n);
  switch (kanton) {
    case 'ZH': return `https://geo.zh.ch/maps?x=${ex}&y=${ny}&scale=5000`;
    case 'BE': return url + `&x=${ex}&y=${ny}`;
    case 'SO': return url + `&map_x=${ex}&map_y=${ny}&map_zoom=6`;
    case 'AG': return url + `&x=${ex}&y=${ny}`;
    case 'BS': return `https://map.bs.ch/?topic=Gewaesserschutz&x=${ex}&y=${ny}&zoom=6`;
    default:   return url;
  }
}

async function _updateGwsKantonLink(e, n) {
  const el = document.getElementById('ns-gws-link');
  const labelEl = document.getElementById('ns-gws-label');
  if (!el) return;
  try {
    const params = new URLSearchParams({ geometry: `${e},${n}`, geometryType: 'esriGeometryPoint', sr: '2056',
      layers: 'all:ch.swisstopo.swissboundaries3d-kanton-flaeche.fill',
      mapExtent: `${e-500},${n-500},${e+500},${n+500}`, imageDisplay: '100,100,96', tolerance: '5',
      returnGeometry: 'false', lang: 'de' });
    const res = await fetch(`https://api.geo.admin.ch/rest/services/all/MapServer/identify?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    const r0 = data.results?.[0];
    const props = r0?.attributes || r0?.properties || {};
    const kanton = props.ak || props.kuerzel || props.kantonskuerzel;
    if (!kanton) return;
    const baseUrl = GWS_KANTON_URLS[kanton];
    if (baseUrl) {
      el.href = _gwsUrlWithCoords(kanton, baseUrl, e, n);
      el.title = `GW-Schutzzonen Kanton ${kanton}`;
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  } catch { /* stille Fehler — Link bleibt wie er ist */ }
}

// Grundwasserschutzzonen via geodienste.ch WMS GetFeatureInfo (alle Kantone)
// WMS-Layernamen → Dropdown-Wert, Priorität absteigend (gefährlichste zuerst)
const GWS_WMS_LAYER_MAP = [
  { layer: 'grundwasserschutzzone_s1_in_kraft', value: 'S1'     },
  { layer: 'grundwasserschutzzone_s2_in_kraft', value: 'S2'     },
  { layer: 'grundwasserschutzzone_s3_in_kraft', value: 'S3'     },
  { layer: 'grundwasserschutzzone_sh_in_kraft', value: 'andere' },
  { layer: 'grundwasserschutzzone_sm_in_kraft', value: 'andere' },
  { layer: 'grundwasserschutzareal_in_kraft',   value: 'andere' },
  { layer: 'gewaesserschutzbereich_ao',         value: 'AuAo'  },
  { layer: 'gewaesserschutzbereich_au',         value: 'AuAo'  },
];

async function queryGisGrundwasser() {
  const sel    = document.getElementById('ns-gw-zone');
  const noteEl = document.getElementById('ns-gw-zone-note');
  if (!sel || sel.value) return; // Nicht überschreiben wenn bereits manuell gesetzt

  const pair = PAIRS.find(p => p.id === currentPairId);
  if (!pair?.rs?.e || !pair?.rs?.n) return;
  const e = pair.rs.e, n = pair.rs.n;

  // Priorität absteigend (gefährlichste Zone zuerst)
  const GWS_PRIORITY = ['S1', 'S2', 'S3', 'andere', 'AuAo'];

  // Einzelne Layer aus GWS_WMS_LAYER_MAP (alle queryable laut GetCapabilities)
  // INFO_FORMAT=text/plain — server unterstützt kein application/json
  const layers = GWS_WMS_LAYER_MAP.map(l => l.layer).join(',');
  const url = `https://geodienste.ch/db/planerischer_gewaesserschutz_v1_2_0/deu?`
    + `SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo`
    + `&QUERY_LAYERS=${layers}&LAYERS=${layers}`
    + `&CRS=EPSG:2056&WIDTH=101&HEIGHT=101&I=50&J=50`
    + `&BBOX=${e-50},${n-50},${e+50},${n+50}`
    + `&INFO_FORMAT=text%2Fplain&FEATURE_COUNT=5`;

  if (noteEl) { noteEl.style.display = ''; noteEl.textContent = 'Abfrage läuft…'; }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (noteEl) noteEl.textContent = `WMS Fehler ${res.status}`;
      return;
    }
    const text = await res.text();

    // text/plain: GeoServer nennt Layer-Name im Response-Text wenn Treffer vorhanden
    // Höchste Priorität aus GWS_WMS_LAYER_MAP wählen
    const found = GWS_WMS_LAYER_MAP.find(l => text.includes(l.layer));

    if (!found) {
      if (noteEl) noteEl.style.display = 'none';
      return;
    }
    if (!sel.querySelector(`option[value="${found.value}"]`)) return;
    sel.value = found.value;
    saveNaturschutz();
    if (noteEl) noteEl.textContent = 'Vorschlag aus geodienste.ch — Zur Kontrolle ↗ Karte prüfen.';
  } catch (err) {
    if (noteEl) noteEl.textContent = `Fehler: ${err.message}`;
  }
}

async function queryGisNaturschutz() {
  const resultEl = document.getElementById('ns-gis-result');
  if (!resultEl) return;

  const pair = PAIRS.find(p => p.id === currentPairId);
  if (!pair?.rs?.e || !pair?.rs?.n) {
    resultEl.textContent = 'Keine Koordinaten vorhanden.';
    return;
  }
  const e = pair.rs.e, n = pair.rs.n;

  resultEl.innerHTML = '<span style="color:#9ca3af;">Wird abgefragt…</span>';

  const layerIds = GIS_NS_LAYERS.map(l => l.id).join(',');
  const params = new URLSearchParams({
    geometry:       `${e},${n}`,
    geometryType:   'esriGeometryPoint',
    sr:             '2056',
    layers:         `all:${layerIds}`,
    mapExtent:      `${e-1000},${n-1000},${e+1000},${n+1000}`,
    imageDisplay:   '1000,1000,96',
    tolerance:      '50',
    lang:           'de',
    returnGeometry: 'false',
  });
  const url = `https://api.geo.admin.ch/rest/services/all/MapServer/identify?${params}`;

  try {
    const res  = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const results = data.results || [];

    if (results.length === 0) {
      resultEl.innerHTML = '<span style="color:#16a34a;">Keine Bundesschutzgebiete an diesem Standort.</span>';
      return;
    }

    // Ergebnisse nach Layer gruppieren
    const found = {};
    results.forEach(r => {
      const layerMeta = GIS_NS_LAYERS.find(l => l.id === r.layerBodId);
      const label = layerMeta?.label || r.layerName || r.layerBodId;
      if (!found[label]) found[label] = [];
      const props = r.properties || {};
      const detail = props.sgz_typ || props.art || props.klasse || props.zone_bez
        || props.name || props.bezeichnung || props.objectid || '';
      found[label].push(detail);
    });

    const lines = Object.entries(found).map(([label, vals]) => {
      const unique = [...new Set(vals.filter(Boolean))];
      const detail = unique.length ? ` — ${unique.join(', ')}` : '';
      return `<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:3px;">
        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#dc2626;margin-top:3px;flex-shrink:0;"></span>
        <span><strong>${label}</strong>${detail}</span>
      </div>`;
    });

    resultEl.innerHTML = `<div style="font-size:10px;color:#9ca3af;margin-bottom:5px;font-style:italic;">Quelle: api.geo.admin.ch — zur Kontrolle ↗ Karte prüfen</div>`
      + lines.join('');

    // BLN-Checkbox automatisch setzen
    if (found['BLN-Inventar']) { const el = document.getElementById('ns-bln'); if (el && !el.checked) { el.checked = true; saveNaturschutz(); } }

  } catch(err) {
    resultEl.innerHTML = `<span style="color:#b45309;">Abfrage fehlgeschlagen (${err.message}) — bitte ↗ Karte prüfen.</span>`;
    console.warn('GIS Naturschutz Fehler:', err);
  }
}
const NS_KEY = () => 'sp_naturschutz__' + _activeId;

function loadAllNaturschutz() {
  try { return jsonParse(store.getItem(NS_KEY())) || {}; } catch { return {}; }
}
function saveAllNaturschutz(all) { store.setItem(NS_KEY(), JSON.stringify(all)); }

// Vordefinierte Begehungs-Tags pro Phase
const BEGEHUNG_TAGS_CONFIG = {
  baugrund: [
    'Zugang gesperrt',
    'Schacht vorhanden',
    'Vegetation / Bäume',
    'Hangneigung kritisch',
  ],
  bauprojekt: [
    'Kabelumlegung erforderlich',
    'Bestehende Leitung',
    'Schacht vorhanden',
    'Fundamentsicherung',
    'Spezialfundament',
    'Zugang für Maschinen eingeschränkt',
  ],
  ausfuehrung: [
    'Zugang für Maschinen geprüft',
    'Kabelumlegung geprüft',
    'Schacht / Hindernisse geprüft',
    'Baumassnahmen besprochen',
    'Installationsplatz definiert',
    'Sicherheitsmassnahmen besprochen',
    'Freigabe erteilt',
  ],
};

const BEGEHUNG_CUSTOM_TAGS_KEY = () => 'sp_beg_custom_tags__' + _activeId;

function loadBegehungCustomTags() {
  try { return jsonParse(store.getItem(BEGEHUNG_CUSTOM_TAGS_KEY())) || []; } catch { return []; }
}
function saveBegehungCustomTags(tags) {
  store.setItem(BEGEHUNG_CUSTOM_TAGS_KEY(), JSON.stringify(tags));
}

function renderBegehungTags(activeTags) {
  const wrap = document.getElementById('beg-tags-wrap');
  if (!wrap) return;
  const predefined = BEGEHUNG_TAGS_CONFIG[_activePhase] || [];
  const custom = loadBegehungCustomTags();
  const allTags = [...new Set([...predefined, ...custom])];

  wrap.innerHTML = allTags.map(tag => {
    const active = (activeTags || []).includes(tag);
    const isCustom = !predefined.includes(tag);
    return `<button onclick="toggleBegehungTag('${tag.replace(/'/g,"\\'")}',this)"
      data-tag="${tag.replace(/"/g,'&quot;')}"
      style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;
             border:1px solid ${active ? '#1a3a5c' : '#e5e7eb'};
             background:${active ? '#1a3a5c' : 'white'};
             color:${active ? 'white' : '#374151'};
             display:flex;align-items:center;gap:4px;">
      ${tag}
      ${isCustom ? `<span onclick="event.stopPropagation();removeBegehungCustomTag('${tag.replace(/'/g,"\\'")}');"
        style="opacity:0.6;font-size:10px;margin-left:2px;">✕</span>` : ''}
    </button>`;
  }).join('');
}

function toggleBegehungTag(tag, btn) {
  const all = loadAllBegehung();
  const key = `${currentPairId}_${_activePhase}`;
  const d = all[key] || {};
  const tags = d.tags || [];
  const idx = tags.indexOf(tag);
  if (idx >= 0) tags.splice(idx, 1);
  else tags.push(tag);
  d.tags = tags;
  all[key] = d;
  saveAllBegehung(all);
  renderBegehungTags(tags);
}

function addBegehungTag() {
  const input = document.getElementById('beg-tag-input');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  const custom = loadBegehungCustomTags();
  if (!custom.includes(val)) {
    custom.push(val);
    saveBegehungCustomTags(custom);
  }
  // Auch direkt aktivieren
  const all = loadAllBegehung();
  const key = `${currentPairId}_${_activePhase}`;
  const d = all[key] || {};
  const tags = d.tags || [];
  if (!tags.includes(val)) tags.push(val);
  d.tags = tags;
  all[key] = d;
  saveAllBegehung(all);
  input.value = '';
  renderBegehungTags(tags);
}

function removeBegehungCustomTag(tag) {
  const custom = loadBegehungCustomTags().filter(t => t !== tag);
  saveBegehungCustomTags(custom);
  // Auch aus aktiven Tags entfernen
  const all = loadAllBegehung();
  const key = `${currentPairId}_${_activePhase}`;
  const d = all[key] || {};
  d.tags = (d.tags || []).filter(t => t !== tag);
  all[key] = d;
  saveAllBegehung(all);
  renderBegehungTags(d.tags);
}

// ============================================================
