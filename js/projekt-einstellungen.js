// DATEN SICHERN / LADEN (JSON Export/Import für Teamarbeit)
// ============================================================
function openExportModal() {
  document.getElementById('export-daten-modal').classList.add('open');
}
function closeExportDatenModal() {
  document.getElementById('export-daten-modal').classList.remove('open');
}

// ============================================================
// PROJEKTERFASSUNG — Projekt wechseln, neu erstellen, löschen
// ============================================================
function openProjektModal() {
  renderProjektList();
  renderProjektModalTemplateInfo();
  document.getElementById('projekt-modal').classList.add('open');
}
function closeProjektModal() {
  document.getElementById('projekt-modal').classList.remove('open');
}

function renderProjektList() {
  const list = document.getElementById('projekt-list');
  if (!list) return;
  const projects = loadProjectsMeta();
  list.innerHTML = '';
  projects.forEach(p => {
    const isActive = p.id === _activeId;
    const item = document.createElement('div');
    item.style.cssText = `display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:8px;border:2px solid ${isActive?'#1a3a5c':'#e5e7eb'};background:${isActive?'#f0f4ff':'white'};cursor:${isActive?'default':'pointer'};transition:all 0.15s;`;
    if (!isActive) { item.onmouseover = () => item.style.borderColor = '#94a3b8'; item.onmouseout = () => item.style.borderColor = '#e5e7eb'; }
    const iconBtnStyle = 'padding:4px 8px;border-radius:6px;border:1px solid #c7d2e8;background:white;color:#1a3a5c;cursor:pointer;display:flex;align-items:center;gap:4px;font-size:11px;font-weight:600;flex-shrink:0;';
    item.innerHTML = `
      <div onclick="${isActive?'':'switchProject(\''+p.id+'\')'}" style="flex:1;min-width:0;${isActive?'':'cursor:pointer;'}">
        <div style="font-size:13px;font-weight:${isActive?'700':'600'};color:${isActive?'#1a3a5c':'#374151'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${isActive?'▶ ':''} ${p.name}</div>
        <div style="font-size:10px;color:#9ca3af;margin-top:1px;">${new Date(p.createdAt).toLocaleDateString('de-CH')}</div>
      </div>
      ${isActive ? `
        <button onclick="event.stopPropagation();closeProjektModal();openProjektKenndatenModal()" title="Projektkenndaten" style="${iconBtnStyle}" onmouseover="this.style.background='#e8eef7'" onmouseout="this.style.background='white'"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Kenndaten</button>
        <button onclick="event.stopPropagation();closeProjektModal();openBeteiligteModal()" title="Projektbeteiligte" style="${iconBtnStyle}" onmouseover="this.style.background='#e8eef7'" onmouseout="this.style.background='white'"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Beteiligte</button>
        <span style="font-size:10px;font-weight:700;color:#059669;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:2px 8px;flex-shrink:0;">Aktiv</span>
      ` : ''}
      ${projects.length > 1 ? `<button onclick="event.stopPropagation();deleteProject('${p.id}')" title="Projekt löschen" style="padding:3px 8px;border-radius:5px;border:1px solid #fca5a5;background:none;color:#ef4444;cursor:pointer;font-size:11px;font-weight:700;flex-shrink:0;">✕</button>` : ''}
    `;
    if (!isActive) item.querySelector('div[onclick]').style.cursor = 'pointer';
    list.appendChild(item);
  });
}

async function switchProject(id) {
  if (id === _activeId) { closeProjektModal(); return; }
  if (!await ui.confirm('Zum gewählten Projekt wechseln?')) return;
  store.setItem(ACTIVE_PROJECT_KEY, id);
  appReload();
}

async function createNewProject() {
  const name = prompt('Name des neuen Projekts:', 'Neues Projekt');
  if (!name || !name.trim()) return;
  const projects = loadProjectsMeta();
  const id = genProjectId();
  projects.push({ id, name: name.trim(), createdAt: new Date().toISOString() });
  saveProjectsMeta(projects);
  store.setItem('sp_pairs__'    + id, JSON.stringify([]));
  store.setItem('sp_data__'     + id, JSON.stringify({}));
  store.setItem('sp_tags__'     + id, JSON.stringify([]));
  store.setItem('sp_tagdates__' + id, JSON.stringify({}));
  store.setItem('sp_titel__'    + id, name.trim());
  const tpl = loadAppTemplate();
  if (tpl && await ui.confirm('Möchtest du die gespeicherte App-Vorlage auf das neue Projekt anwenden?\n\n(Tags, Briefvorlagen, Standard-Feldbelegung)')) {
    applyTemplateTo(id, tpl);
  }
  store.setItem(ACTIVE_PROJECT_KEY, id);
  sessionStorage.setItem('reopen_projekt_modal', '1');
  appReload();
}

// Fundamentliste in neues Projekt importieren (Projektname per prompt, dann Reload mit sessionStorage-Brücke)
function importFundamentlisteNeuesProjekt(input) {
  const file = input.files[0]; if (!file) return;
  input.value = '';
  const name = prompt('Name des neuen Projekts:', 'Neues Projekt');
  if (!name?.trim()) return;
  const projects = loadProjectsMeta();
  const id = genProjectId();
  projects.push({ id, name: name.trim(), createdAt: new Date().toISOString() });
  saveProjectsMeta(projects);
  store.setItem('sp_pairs__'    + id, JSON.stringify([]));
  store.setItem('sp_data__'     + id, JSON.stringify({}));
  store.setItem('sp_tags__'     + id, JSON.stringify([]));
  store.setItem('sp_tagdates__' + id, JSON.stringify({}));
  store.setItem('sp_titel__'    + id, name.trim());
  store.setItem(ACTIVE_PROJECT_KEY, id);
  closeProjektModal();
  const reader = new FileReader();
  reader.onload = e => {
    const u8 = new Uint8Array(e.target.result);
    let bin = ''; u8.forEach(b => bin += String.fromCharCode(b));
    sessionStorage.setItem('pendingFlImport', btoa(bin));
    appReload();
  };
  reader.readAsArrayBuffer(file);
}

// ============================================================
// PROJEKT ALS DATEI — vollstaendiger Export/Import eines einzelnen Projekts
//
// Unterschied zum Gesamt-Backup: Hier wandert genau EIN Projekt in eine Datei
// und wird beim Einlesen als NEUES Projekt angelegt. Nichts Bestehendes wird
// ueberschrieben — dadurch entfaellt jede ID-Neuverdrahtung, weil alle Keys
// unter einer frisch vergebenen Projekt-ID landen.
//
// Im Paket stehen die Keys OHNE Projektsuffix ('sp_pairs' statt
// 'sp_pairs__p_123'); der Suffix wird beim Import neu gesetzt.
// ============================================================
const PROJEKT_EXPORT_FORMAT = 'sondagen-projekt';

// Projektuebergreifende Keys, die das Ergebnis beeinflussen (Parameterdatenbank,
// Phasenkonfiguration). Sie reisen mit, werden beim Import aber getrennt
// abgefragt — sonst ueberschreibt ein Import die Werte anderer Projekte.
const PROJEKT_EXPORT_GLOBALS = ['sp_ft_geo_overrides', 'sp_ft_mat_overrides', 'sp_phases_cfg'];

async function projektExportJson(projektId) {
  const pid    = projektId || _activeId;
  const meta   = loadProjectsMeta().find(p => p.id === pid);
  const suffix = '__' + pid;
  ui.toast('Projekt wird exportiert…');

  const keys = {};
  store.keys().filter(k => k.endsWith(suffix)).forEach(k => {
    keys[k.slice(0, -suffix.length)] = store.getItem(k);
  });

  // Fotos liegen ausserhalb des JSON-Stores: ueber die Standortdaten einsammeln
  const pd      = jsonParse(keys['sp_data'] || '{}') || {};
  const blobIds = new Set();
  Object.values(pd).forEach(d => (d?.fotos || []).forEach(f => f?.blobId && blobIds.add(f.blobId)));

  const fotos = {};
  let fehlend = 0;
  for (const id of blobIds) {
    try {
      const b = await store.blobGet(id);
      if (!b) { fehlend++; continue; }
      fotos[id] = await new Promise(res => {
        const r = new FileReader();
        r.onload  = () => res(r.result);
        r.onerror = () => res(null);
        r.readAsDataURL(b);
      });
    } catch (e) { fehlend++; console.error('Foto-Export fehlgeschlagen:', id, e); }
  }

  const global = {};
  PROJEKT_EXPORT_GLOBALS.forEach(k => { const v = store.getItem(k); if (v != null) global[k] = v; });

  const paket = {
    format:      PROJEKT_EXPORT_FORMAT,
    version:     1,
    erstellt_am: new Date().toISOString(),
    projekt:     { name: meta?.name || 'Projekt', createdAt: meta?.createdAt || null },
    keys, fotos, global,
  };

  const dateiname = 'Projekt_' + (meta?.name || 'Projekt').replace(/[^\wäöüÄÖÜß-]+/g, '-')
    + '_' + new Date().toISOString().slice(0, 10) + '.json';
  const blob = new Blob([JSON.stringify(paket)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = dateiname;
  a.click();
  URL.revokeObjectURL(a.href);

  ui.toast('Projekt exportiert — ' + Object.keys(keys).length + ' Datensätze, '
    + Object.keys(fotos).length + ' Fotos'
    + (fehlend ? ' (' + fehlend + ' Foto(s) nicht auffindbar)' : ''), fehlend ? 'fehler' : 'erfolg');
}

function projektImportJson(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const paket = jsonParse(e.target.result);
    if (!paket || paket.format !== PROJEKT_EXPORT_FORMAT || !paket.keys) {
      ui.toast('Ungültige Datei — kein Sondagen-Projektexport.', 'fehler');
      return;
    }
    const anzFotos = Object.keys(paket.fotos || {}).length;
    const name = prompt('Name für das importierte Projekt:', paket.projekt?.name || 'Importiertes Projekt');
    if (!name || !name.trim()) return;

    ui.toast('Projekt wird eingelesen…');
    const neueId = genProjectId();
    const suffix = '__' + neueId;
    Object.entries(paket.keys).forEach(([k, v]) => { if (v != null) store.setItem(k + suffix, v); });

    // Fotos unter NEUEN Blob-IDs ablegen und die Referenzen nachziehen —
    // die alten IDs koennten auf diesem Geraet bereits belegt sein.
    const idMap = {};
    for (const [altId, dataUrl] of Object.entries(paket.fotos || {})) {
      if (!dataUrl) continue;
      try { idMap[altId] = await fotoBlobs.speichern(dataUrl); }
      catch (err) { console.error('Foto-Import fehlgeschlagen:', altId, err); }
    }
    if (Object.keys(idMap).length) {
      const pd = jsonParse(store.getItem('sp_data' + suffix) || '{}') || {};
      Object.values(pd).forEach(d => (d?.fotos || []).forEach(f => {
        if (f?.blobId && idMap[f.blobId]) f.blobId = idMap[f.blobId];
      }));
      store.setItem('sp_data' + suffix, JSON.stringify(pd));
    }

    // Projekt registrieren
    const projects = loadProjectsMeta();
    projects.push({ id: neueId, name: name.trim(), createdAt: new Date().toISOString(),
                    importiertAm: new Date().toISOString() });
    saveProjectsMeta(projects);
    store.setItem('sp_titel' + suffix, name.trim());

    // Globale Parameter nur auf ausdrueckliche Bestaetigung uebernehmen
    const abweichend = Object.entries(paket.global || {}).filter(([k, v]) => store.getItem(k) !== v);
    if (abweichend.length) {
      const uebernehmen = await ui.confirm(
        'Die Datei enthält abweichende projektübergreifende Einstellungen:\n\n'
        + abweichend.map(([k]) => '· ' + k).join('\n')
        + '\n\nDiese gelten für ALLE Projekte auf diesem Gerät. Übernehmen?',
        { ok: 'Übernehmen', abbrechen: 'Behalten' }
      );
      if (uebernehmen) abweichend.forEach(([k, v]) => store.setItem(k, v));
    }

    store.setItem(ACTIVE_PROJECT_KEY, neueId);
    await store.flush();
    ui.toast('Projekt «' + name.trim() + '» importiert — '
      + Object.keys(paket.keys).length + ' Datensätze, ' + anzFotos + ' Fotos', 'erfolg');
    setTimeout(appReload, 900);
  };
  reader.readAsText(file);
}

// ============================================================
// APP-VORLAGE (Globale Einstellungen)
// ============================================================
function loadAppTemplate() {
  try { return jsonParse(store.getItem(APP_TEMPLATE_KEY)); } catch { return null; }
}
function saveAppTemplateData(tpl) {
  store.setItem(APP_TEMPLATE_KEY, JSON.stringify(tpl));
}

// Bauprogramm-Kennwerte für die Vorlage. Termine, Lose und Paket-Kennungen
// bleiben aussen vor — die sind projektspezifisch. Übernommen wird, was in
// einem Betrieb gleich bleibt: Fristen, Puffer, Rüstabzug, Gruppengrösse.
// Die Los-Aushärtefristen werden über den Paketnamen gesichert, damit die
// abweichende Frist der Provisorien nicht in jedem Projekt neu zu setzen ist.
function _tplBauprogrammLesen() {
  const einst = (typeof loadProjEinst === 'function') ? loadProjEinst() : {};
  const losAushaerte = {};
  (typeof loadBaupakete === 'function' ? loadBaupakete() : []).forEach(p => {
    if (p.aushaerteTage != null && p.aushaerteTage !== '' && p.name) {
      losAushaerte[p.name] = p.aushaerteTage;
    }
  });
  return {
    aushaerteTage:   einst.aushaerteTage,
    flMontagePuffer: einst.flMontagePuffer,
    bbVersatzTage:   einst.bbVersatzTage,
    abzugMinuten:    einst.abzugMinuten,
    bauGruppeMax:    einst.bauGruppeMax,
    losAushaerte,
  };
}

// Vorlage aus aktuellem Projekt befüllen und speichern
function saveCurrentAsTemplate() {
  const tpl = {
    version:    1,
    savedAt:    new Date().toISOString(),
    statusCfg:  getStatusCfg(),
    tags:       customTags || [],
    letters:    {},
    defaults:   loadTemplateDefaults(),
    bauprogramm: _tplBauprogrammLesen(),
  };
  // Briefvorlagen aus aktuellem Projekt lesen
  Object.keys(MAIL_TYPES).forEach(type => {
    tpl.letters[type] = loadLetterTemplate(type);
  });
  saveAppTemplateData(tpl);
  return tpl;
}

// Vorlage auf ein Projekt anwenden
function applyTemplateTo(projectId, tpl) {
  if (!tpl) return;
  if (tpl.tags?.length)       store.setItem('sp_tags__' + projectId, JSON.stringify(tpl.tags));
  if (tpl.letters)            Object.keys(tpl.letters).forEach(type => {
    const cfg = MAIL_TYPES[type];
    if (cfg) store.setItem(cfg.key().replace(_activeId, projectId), tpl.letters[type]);
  });
  if (tpl.defaults)           store.setItem('sp_tpl_defaults__' + projectId, JSON.stringify(tpl.defaults));
  if (tpl.bauprogramm)        _tplBauprogrammAnwenden(projectId, tpl.bauprogramm);
  // Status-Config ist global → kein projektbezogener Eintrag nötig
}

// Bauprogramm-Kennwerte der Vorlage übernehmen. Nur gesetzte Werte werden
// geschrieben, damit bestehende Projektangaben nicht durch Lücken in einer
// älteren Vorlage überschrieben werden.
function _tplBauprogrammAnwenden(projectId, bp) {
  const einstKey = 'sp_proj_einst__' + projectId;
  const einst    = jsonParse(store.getItem(einstKey) || '{}') || {};
  ['aushaerteTage', 'flMontagePuffer', 'bbVersatzTage', 'abzugMinuten', 'bauGruppeMax']
    .forEach(k => { if (bp[k] != null) einst[k] = bp[k]; });
  store.setItem(einstKey, JSON.stringify(einst));

  if (!bp.losAushaerte || !Object.keys(bp.losAushaerte).length) return;
  const pakKey = 'sp_baupakete__' + projectId;
  const pakete = jsonParse(store.getItem(pakKey) || '[]') || [];
  let geaendert = 0;
  pakete.forEach(p => {
    const t = bp.losAushaerte[p.name];
    if (t != null && p.aushaerteTage !== t) { p.aushaerteTage = t; geaendert++; }
  });
  if (geaendert) store.setItem(pakKey, JSON.stringify(pakete));
}

// Demo-Projekt "Testprojekt Altstetten" mit 25 Fundamentstandorten anlegen
function seedDemoProjectAltstetten() {
  const PID   = 'p_demo_altstetten';
  const PNAME = 'Testprojekt Altstetten';

  // Projekt in Meta eintragen (falls noch nicht vorhanden)
  let meta = jsonParse(store.getItem(PROJECTS_META_KEY) || '[]');
  if (!meta.find(p => p.id === PID)) {
    meta.push({ id: PID, name: PNAME, createdAt: new Date().toISOString() });
    store.setItem(PROJECTS_META_KEY, JSON.stringify(meta));
  }

  // 25 Standorte: Korridor durch Zürich Altstetten (LV95, ~90 m Abstand)
  const pts = [
    [2678400,1249400],[2678490,1249420],[2678580,1249440],[2678670,1249460],
    [2678760,1249480],[2678850,1249500],[2678940,1249520],[2679030,1249530],
    [2679120,1249545],[2679210,1249555],[2679300,1249565],[2679390,1249570],
    [2679480,1249575],[2679570,1249580],[2679660,1249585],[2679745,1249590],
    [2679830,1249600],[2679915,1249615],[2680000,1249630],[2680085,1249650],
    [2680165,1249670],[2680250,1249695],[2680335,1249720],[2680415,1249745],
    [2680500,1249770]
  ];

  // Fundtypen: Index 4/9/14/19/24 = Spezialfundamente (~20 %)
  const stdFT = [
    'DP1a / 1.80','DP1a / 2.40','DP2a / 2.00','DP2a / 2.70','DG1a / 2.40',
    'DP1a / 1.80','DP1a / 2.40','DP2a / 2.00','DP1a / 1.80','DP2a / 2.00',
    'DG1a / 2.40','DP1a / 1.80','DP2a / 2.70','DP1a / 2.40','DG1a / 2.40',
    'DP1a / 1.80','DP2a / 2.00','DP1a / 2.40','DP2a / 2.00','DP2a / 2.70',
    'DP1a / 1.80','DP1a / 2.40','DG1a / 2.40','DP2a / 2.00','DP1a / 1.80'
  ];
  const spezialFT = {
    4:'Monopfahl / Ø400', 9:'Pfahlfundament gross',
    14:'Felsanker 2×SN25', 19:'Mauerfundament', 24:'Bauwerk / Abutment'
  };

  // Massnahme-Ausnahmen (Rest = '' → Neubau)
  const massnahmeMap = { 3:'prov', 4:'abbruch', 7:'abbruch', 9:'prov', 14:'abbruch', 19:'prov', 20:'prov', 22:'abbruch', 23:'abbruch', 24:'prov' };

  const statusOf = i => i < 5 ? 'abgeschlossen' : i < 12 ? 'abklaerung' : 'geplant';

  const pairs = [], appData = {}, allBP = {};

  for (let i = 0; i < 25; i++) {
    const [e, n]  = pts[i];
    const km      = parseFloat((i * 0.090).toFixed(3));
    const fundtyp = spezialFT[i] || stdFT[i];
    const massnahme = massnahmeMap[i] || '';
    // prov-Pairs brauchen bestand='prov' damit getPairBpTyp sie als 'provisorium' erkennt
    const bestand = massnahme === 'abbruch' ? 'bestehend' : massnahme === 'prov' ? 'prov' : 'neu';
    const id = i + 1;

    pairs.push({
      id, mast: 'FS T' + id,
      km_rs: km, km_rks: km,
      strecke: 'Linie 755 Altstetten–Schlieren', streckennr: '755.0',
      rs: { e, n }, rks: { e, n },
      _phase: 'bauprojekt', bezeichnung: '',
      fundtyp, bestand, massnahme,
    });
    appData[id] = { status: statusOf(i) };
    allBP[id]   = { bestand, massnahme, fundtyp };
  }

  // FT-Zuweisungen aus DEFAULT_FT_PROFIL ableiten (Name → ID)
  const ftByName = {};
  DEFAULT_FT_PROFIL.forEach(f => { ftByName[f.name] = f.id; });
  const ftZuwMap = {};
  pairs.forEach(p => { if (ftByName[p.fundtyp]) ftZuwMap[p.id] = ftByName[p.fundtyp]; });

  // Standard-Projektkonfiguration: ein Los + Baubeginn
  const demoEinst = {
    baubeginn:               '2026-09-01',
    abzugMinuten:            30,
    berücksichtigeFeiertage: true,
    bauGruppeMax:            3,
    standardSperrmusterId:   'sp_demo_nacht',
    aushaerteTage:           28,
    flMontagePuffer:         7,
    bbVersatzTage:           7,
    // Provisorien werden früher belastet als konventionelle Fundamente. Die
    // Frist hängt am Baupaket (bpAushaerteTage), hier steht der Startwert, den
    // die Auto-Erzeugung dem Provisorien-Los mitgibt.
    provAushaerteTage:       7,
    teams: [{ id: 'team_demo_1', name: 'Los 1', color: '#3b82f6' }],
  };

  // Demo-Sperrmuster: Nachtsperrung Mo–Fr 22:00–05:00
  const demoSperrmuster = [{
    id: 'sp_demo_nacht', name: 'Nachtsperrung Mo–Fr',
    typ: 'nacht', farbe: '#1a3a5c',
    wochentage: [1,2,3,4,5],
    von: '22:00', bis: '05:00', nettoH: 6.5,
    gleissperrung: 'eingleisig', gleisNr: '1',
    fl: 'nein', bemerkung: 'Demo-Sperrmuster',
  }];

  store.setItem('sp_pairs__'         + PID, JSON.stringify(pairs));
  store.setItem('sp_data__'          + PID, JSON.stringify(appData));
  store.setItem('sp_bauprojekt__'    + PID, JSON.stringify(allBP));
  store.setItem('sp_ft_zuweisung__'  + PID, JSON.stringify(ftZuwMap));
  store.setItem('sp_proj_einst__'    + PID, JSON.stringify(demoEinst));
  store.setItem('sp_sperrmuster__'   + PID, JSON.stringify(demoSperrmuster));
  store.setItem(ACTIVE_PROJECT_KEY, PID);
  appReload();
}

// Vorlage auf aktives Projekt anwenden
async function applyTemplateToActive() {
  const tpl = loadAppTemplate();
  if (!tpl) { ui.toast('Keine Vorlage gespeichert.', 'erfolg'); return; }
  if (!await ui.confirm('Vorlage auf dieses Projekt anwenden?\n\nTags und Briefvorlagen werden überschrieben.')) return;
  applyTemplateTo(_activeId, tpl);
  // Tags sofort neu laden
  customTags = jsonParse(store.getItem('sp_tags__' + _activeId) || '[]');
  saveCustomTags();
  closeAppSettingsModal();
  refreshCurrentView();
  ui.toast('✓ Vorlage angewendet.', 'erfolg');
}

// Vorlage anwenden aus dem Projekterfassung-Modal (mit Reload)
async function applyTemplateToActiveFromModal() {
  const tpl = loadAppTemplate();
  if (!tpl) { ui.toast('Keine Vorlage gespeichert.', 'erfolg'); return; }
  if (!await ui.confirm('Vorlage auf aktives Projekt anwenden?\n(Tags, Briefvorlagen, Standard-Feldbelegung werden überschrieben)')) return;
  applyTemplateTo(_activeId, tpl);
  appReload();
}

// Vorlage aus anderem Projekt übernehmen und auf aktives Projekt anwenden
async function copyTemplateFromProject(fromId) {
  if (!fromId) return;
  if (!await ui.confirm('Vorlage aus gewähltem Projekt übernehmen und auf das aktive Projekt anwenden?\n(Tags, Briefvorlagen werden überschrieben)')) {
    document.getElementById('tpl-copy-from').value = '';
    return;
  }
  const tpl = {
    version: 1,
    savedAt: new Date().toISOString(),
    tags:    jsonParse(store.getItem('sp_tags__' + fromId) || '[]'),
    letters: {},
    defaults:jsonParse(store.getItem('sp_tpl_defaults__' + fromId) || '{}'),
  };
  Object.keys(MAIL_TYPES).forEach(type => {
    const cfg = MAIL_TYPES[type];
    if (!cfg) return;
    const key = cfg.key().replace(_activeId, fromId);
    const val = store.getItem(key);
    if (val) tpl.letters[type] = val;
  });
  saveAppTemplateData(tpl);
  applyTemplateTo(_activeId, tpl);
  appReload();
}

// Vorlage-Info im Projekterfassung-Modal aktualisieren
function renderProjektModalTemplateInfo() {
  const tpl = loadAppTemplate();
  const el  = document.getElementById('tpl-info');
  const applyBtn = document.getElementById('tpl-apply-btn');
  if (el) {
    el.textContent = tpl?.savedAt
      ? 'Zuletzt gespeichert: ' + new Date(tpl.savedAt).toLocaleDateString('de-CH')
      : 'Keine Vorlage gespeichert';
  }
  if (applyBtn) {
    applyBtn.disabled = !tpl;
    applyBtn.style.opacity = tpl ? '1' : '0.45';
    applyBtn.style.cursor  = tpl ? 'pointer' : 'default';
  }
  // "Aus Projekt übernehmen"-Dropdown befüllen
  const sel = document.getElementById('tpl-copy-from');
  if (sel) {
    const projects = loadProjectsMeta();
    sel.innerHTML = '<option value="">Aus Projekt übernehmen…</option>' +
      projects.filter(p => p.id !== _activeId)
              .map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }
}

// Standard-Feldbelegung
const TPL_DEFAULTS_KEY_FN = () => 'sp_tpl_defaults__' + _activeId;
function loadTemplateDefaults() {
  try { return jsonParse(store.getItem(TPL_DEFAULTS_KEY_FN())) || {}; } catch { return {}; }
}
function saveTemplateDefaults(d) {
  store.setItem(TPL_DEFAULTS_KEY_FN(), JSON.stringify(d));
}

// App-Einstellungen Modal
function openAppSettingsModal() {
  closeProjektModal();
  document.getElementById('app-settings-modal').classList.add('open');
  openAppSettingsTab('allgemein');
  refreshStorageEstimate();
  refreshBackupLabel();
}
function closeAppSettingsModal() {
  document.getElementById('app-settings-modal').classList.remove('open');
}

// ============================================================
// SPEICHER-FÜLLSTAND + GESAMT-BACKUP
// ============================================================
const LAST_BACKUP_KEY = 'sondagen_last_backup';

function _bytesLesbar(b) {
  if (b >= 1024 * 1024 * 1024) return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  if (b >= 1024 * 1024)        return (b / 1024 / 1024).toFixed(1) + ' MB';
  return Math.round(b / 1024) + ' KB';
}

async function refreshStorageEstimate() {
  const lbl = document.getElementById('storage-estimate-label');
  const bar = document.getElementById('storage-estimate-bar');
  if (!lbl || !bar) return;
  if (!(navigator.storage && navigator.storage.estimate)) {
    lbl.textContent = 'nicht verfügbar'; return;
  }
  try {
    const est = await navigator.storage.estimate();
    const proz = est.quota ? (est.usage / est.quota) * 100 : 0;
    lbl.textContent = _bytesLesbar(est.usage) + ' von ' + _bytesLesbar(est.quota) +
                      ' (' + (proz < 1 ? '<1' : Math.round(proz)) + ' %)';
    bar.style.width = Math.max(proz, 1) + '%';
    bar.style.background = proz > 80 ? 'var(--c-danger)' : proz > 60 ? 'var(--c-warning)' : 'var(--c-primary)';
  } catch (e) {
    lbl.textContent = 'nicht verfügbar';
  }
}

function refreshBackupLabel() {
  const el = document.getElementById('backup-letztes-label');
  if (!el) return;
  const ts = store.getItem(LAST_BACKUP_KEY);
  el.textContent = ts
    ? 'Letztes Gesamt-Backup: ' + new Date(ts).toLocaleString('de-CH')
    : 'Noch kein Gesamt-Backup erstellt.';
}

async function backupGesamtExport() {
  ui.toast('Backup wird erstellt…');
  const daten = {};
  store.keys().forEach(k => { daten[k] = store.getItem(k); });

  // Foto-Blobs als Data-URL mitsichern (liegen ausserhalb des JSON-Stores)
  const blobs = {};
  try {
    const alle = await store.blobAlle();
    for (const [id, blob] of alle) {
      blobs[id] = await new Promise(res => {
        const r = new FileReader();
        r.onload  = () => res(r.result);
        r.onerror = () => res(null);
        r.readAsDataURL(blob);
      });
    }
  } catch (e) { console.error('Blobs konnten nicht gesichert werden:', e); }

  const backup = {
    format: 'sondagen-gesamt-backup',
    version: 2,
    erstellt_am: new Date().toISOString(),
    anzahlKeys: Object.keys(daten).length,
    anzahlBlobs: Object.keys(blobs).length,
    daten,
    blobs,
  };
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Sondagen-Backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  store.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  refreshBackupLabel();
  ui.toast('Gesamt-Backup erstellt (' + backup.anzahlKeys + ' Einträge, ' +
           backup.anzahlBlobs + ' Fotos)', 'erfolg');
}

function backupGesamtImport(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const backup = jsonParse(e.target.result);
    if (!backup || backup.format !== 'sondagen-gesamt-backup' || !backup.daten) {
      ui.toast('Ungültige Backup-Datei — kein Sondagen-Gesamt-Backup.', 'fehler');
      return;
    }
    const n = Object.keys(backup.daten).length;
    const nBlobs = Object.keys(backup.blobs || {}).length;
    const wann = backup.erstellt_am ? new Date(backup.erstellt_am).toLocaleString('de-CH') : 'unbekannt';
    const ok = await ui.confirm(
      'Backup vom ' + wann + ' mit ' + n + ' Einträgen' +
      (nBlobs ? ' und ' + nBlobs + ' Fotos' : '') + ' wiederherstellen?\n\n' +
      'ACHTUNG: Alle aktuellen Daten (alle Projekte und Einstellungen) werden überschrieben.',
      { gefaehrlich: true, ok: 'Wiederherstellen' }
    );
    if (!ok) return;
    // Bestehende Keys entfernen, dann Backup einspielen
    store.keys().forEach(k => store.removeItem(k));
    Object.entries(backup.daten).forEach(([k, v]) => store.setItem(k, v));
    // Foto-Blobs zurückschreiben
    if (nBlobs) {
      ui.toast('Fotos werden wiederhergestellt…');
      for (const [id, dataUrl] of Object.entries(backup.blobs)) {
        try {
          const b = await (await fetch(dataUrl)).blob();
          await store.blobPut(id, b);
        } catch (e) { console.error('Foto-Blob wiederherstellen:', id, e); }
      }
    }
    ui.toast('Backup wiederhergestellt — App wird neu geladen…', 'erfolg');
    setTimeout(appReload, 800);
  };
  reader.readAsText(file);
}

// Beim App-Start: Erinnerung wenn letztes Backup älter als 7 Tage
// (nur wenn nennenswerte Datenmenge vorhanden ist)
function checkBackupErinnerung() {
  if (store.keys().length < 5) return;
  const ts = store.getItem(LAST_BACKUP_KEY);
  const alterTage = ts ? (Date.now() - new Date(ts).getTime()) / 86400000 : Infinity;
  if (alterTage <= 7) return;
  const meldung = ts
    ? 'Letztes Gesamt-Backup vor ' + Math.floor(alterTage) + ' Tagen — Backup empfohlen (App-Einstellungen → Allgemein).'
    : 'Noch kein Gesamt-Backup vorhanden — Backup empfohlen (App-Einstellungen → Allgemein).';
  setTimeout(() => ui.toast(meldung, '', 8000), 1500);
}
// Aufrufe von checkBackupErinnerung() und der Foto-Migration erfolgen
// gesammelt in js/start.js.

function initAppTabAllgemein() {
  const p = loadUserProfile();
  const set = (id, val) => { const el = document.getElementById('up-' + id); if (el) el.value = val || ''; };
  set('name', p.name); set('firma', p.firma); set('email', p.email);
  set('tel',  p.tel);  set('mobile', p.mobile); set('adresse', p.adresse);
}

function initAppTabSidebar() {
  const cfg  = loadSidebarCfg();
  const list = document.getElementById('sidebar-cfg-list');
  if (!list) return;

  // Build ordered list: saved order first, append any missing entries
  const savedOrder = _loadSbOrder() || SIDEBAR_SECTIONS.map(s => s.id);
  const ordered = [
    ...savedOrder.map(id => SIDEBAR_SECTIONS.find(s => s.id === id)).filter(Boolean),
    ...SIDEBAR_SECTIONS.filter(s => !savedOrder.includes(s.id)),
  ];

  list.innerHTML = '';
  let cfgDragId = null;

  ordered.forEach(s => {
    const row = document.createElement('div');
    row.className = 'sb-cfg-row';
    row.dataset.id = s.id;
    row.setAttribute('draggable', 'true');
    row.innerHTML =
      `<span style="cursor:grab;color:#d1d5db;font-size:13px;user-select:none;flex-shrink:0;">⠿</span>` +
      `<input type="checkbox" id="sbcfg-${s.id}" ${cfg[s.id] !== false ? 'checked' : ''} style="accent-color:#1a3a5c;width:15px;height:15px;flex-shrink:0;cursor:pointer;">` +
      `<label for="sbcfg-${s.id}" style="flex:1;cursor:pointer;">${s.label}</label>`;

    row.addEventListener('dragstart', e => {
      cfgDragId = s.id;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => row.classList.add('sb-cfg-dragging'), 0);
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('sb-cfg-dragging');
      list.querySelectorAll('.sb-drag-over-top,.sb-drag-over-bottom')
        .forEach(el => el.classList.remove('sb-drag-over-top','sb-drag-over-bottom'));
      cfgDragId = null;
    });
    row.addEventListener('dragover', e => {
      if (!cfgDragId || cfgDragId === s.id) return;
      e.preventDefault();
      const mid = row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
      row.classList.toggle('sb-drag-over-top',    e.clientY < mid);
      row.classList.toggle('sb-drag-over-bottom', e.clientY >= mid);
    });
    row.addEventListener('dragleave', e => {
      if (!row.contains(e.relatedTarget))
        row.classList.remove('sb-drag-over-top','sb-drag-over-bottom');
    });
    row.addEventListener('drop', e => {
      e.preventDefault();
      row.classList.remove('sb-drag-over-top','sb-drag-over-bottom');
      if (!cfgDragId || cfgDragId === s.id) return;
      const srcRow = list.querySelector(`[data-id="${cfgDragId}"]`);
      if (!srcRow) return;
      const mid = row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
      list.insertBefore(srcRow, e.clientY < mid ? row : row.nextSibling);
      // Persist order immediately
      const newOrder = [...list.querySelectorAll('[data-id]')].map(el => el.dataset.id);
      store.setItem(SB_ORDER_KEY, JSON.stringify(newOrder));
      _applySbOrder();
    });

    list.appendChild(row);
  });
}

function initAppTabPhasen() {
  const custom = loadPhasesCfg() || [];
  ['baugrund','bauprojekt','ausfuehrung'].forEach(id => {
    const ov = custom.find(c => c.id === id) || PHASEN_CONFIG[id];
    const setV = (suffix, val) => { const el = document.getElementById('ph-' + suffix + '-' + id); if (el) el.value = val || ''; };
    setV('lbl',  ov.label);
    setV('kurz', ov.labelKurz);
    setV('desc', ov.beschreibung);
  });
  // Custom Phasen
  const cont = document.getElementById('custom-phases-list');
  if (cont) {
    cont.innerHTML = '';
    custom.filter(c => c.mapsTo).forEach(c => {
      addCustomPhaseRow();
      const row = cont.lastElementChild;
      row.dataset.id = c.id;
      row.querySelector('.cp-label').value = c.label || '';
      row.querySelector('.cp-kurz').value  = c.labelKurz || '';
      row.querySelector('.cp-maps').value  = c.mapsTo || 'baugrund';
    });
  }
}

function renderAppSettingsModal() {
  const tpl = loadAppTemplate();
  const defs = loadTemplateDefaults();

  // Vorlage-Status-Anzeige
  const tplInfo = document.getElementById('app-tpl-info');
  if (tplInfo) {
    if (tpl) {
      const d = new Date(tpl.savedAt).toLocaleDateString('de-CH');
      const t = new Date(tpl.savedAt).toLocaleTimeString('de-CH', {hour:'2-digit',minute:'2-digit'});
      tplInfo.innerHTML = `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:7px;padding:8px 12px;font-size:12px;color:#166534;">
        ✓ Vorlage gespeichert am ${d} um ${t}<br>
        <span style="color:#6b7280;">
          ${tpl.tags?.length || 0} Tags ·
          ${Object.keys(tpl.letters||{}).filter(k=>tpl.letters[k]).length} Briefvorlagen ·
          Status: ${(tpl.statusCfg||[]).map(c=>c.label).join(', ')}
        </span>
      </div>`;
    } else {
      tplInfo.innerHTML = `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:7px;padding:8px 12px;font-size:12px;color:#9ca3af;">Noch keine Vorlage gespeichert.</div>`;
    }
  }

  // Standard-Felder befüllen
  const v = id => { const el = document.getElementById(id); if (el) el.value = defs[id.replace('tpl-','')] || ''; };
  v('tpl-tiefe'); v('tpl-tag'); v('tpl-nacht'); v('tpl-gleis');
  const gleisEl = document.getElementById('tpl-gleis');
  if (gleisEl && defs.gleis) gleisEl.value = defs.gleis;
}

function saveAppSettingsDefaults() {
  const g = id => { const el = document.getElementById('tpl-' + id); return el ? el.value : ''; };
  saveTemplateDefaults({
    tiefe:  parseFloat(g('tiefe')) || null,
    tag:    g('tag'),
    nacht:  g('nacht'),
    gleis:  g('gleis'),
  });
  ui.toast('✓ Standard-Werte gespeichert.', 'erfolg');
}

function exportAppTemplate() {
  const tpl = loadAppTemplate();
  if (!tpl) { ui.toast('Keine Vorlage gespeichert. Bitte zuerst speichern.', 'erfolg'); return; }
  const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'sondagen_vorlage_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
}

function importAppTemplate(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const tpl = jsonParse(e.target.result);
      if (!tpl.version || !tpl.statusCfg) { ui.toast('Ungültige Vorlage-Datei.', 'fehler'); return; }
      saveAppTemplateData(tpl);
      saveStatusCfgData(tpl.statusCfg);
      renderAppSettingsModal();
      ui.toast('✓ Vorlage importiert und angewendet.', 'erfolg');
    } catch { ui.toast('Datei konnte nicht gelesen werden.', 'fehler'); }
  };
  reader.readAsText(file);
  input.value = '';
}

// ============================================================
// BENUTZERPROFIL
// ============================================================
function loadUserProfile() {
  try { return jsonParse(store.getItem(USER_PROFILE_KEY)) || {}; } catch { return {}; }
}
function saveUserProfileData(p) { store.setItem(USER_PROFILE_KEY, JSON.stringify(p)); }

function saveUserProfile() {
  const g = id => { const el = document.getElementById('up-' + id); return el ? el.value.trim() : ''; };
  saveUserProfileData({ name: g('name'), firma: g('firma'), email: g('email'), tel: g('tel'), mobile: g('mobile'), adresse: g('adresse') });
  ui.toast('✓ Profil gespeichert.', 'erfolg');
}

// ============================================================
// SIDEBAR-SICHTBARKEIT
// ============================================================
// ============================================================
// VORLAGEN FUER DIE SEITENLEISTE
// ============================================================
// Die Seitenleiste traegt je nach Phase bis zu zwanzig Gruppen. Wer gerade
// eine Begehung macht, braucht davon vier. Eine Vorlage blendet den Rest aus
// — zusaetzlich zur Phasenlogik und zur Sichtbarkeit aus den Einstellungen,
// nie darueber hinweg: gezeigt wird nur, was ohnehin sichtbar waere.
const SB_VORLAGE_KEY = 'sp_sb_vorlage';

const SB_VORLAGEN = [
  { id: 'alles',      label: 'Alle Gruppen', sektionen: null },
  { id: 'begehung',   label: 'Begehung',     sektionen: ['sec-meta','sec-begehung','sec-zugang','sec-fotos','sec-skizzen','sec-notizen'] },
  { id: 'bauprojekt', label: 'Bauprojekt',   sektionen: ['sec-meta','sec-phase-bauprojekt','sec-hoehenkoten','sec-bodenkennwerte','sec-naturschutz','sec-notizen'] },
  { id: 'ausfuehrung',label: 'Ausführung',   sektionen: ['sec-meta','sec-ausfplanung','sec-termine','sec-sicher','sec-aushub','sec-material','sec-abnahme-link','sec-notizen'] },
  { id: 'bilder',     label: 'Bilder & Notizen', sektionen: ['sec-meta','sec-fotos','sec-skizzen','sec-notizen'] },
];

function sbVorlageAktiv() {
  const id = store.getItem(SB_VORLAGE_KEY);
  return SB_VORLAGEN.find(v => v.id === id) ? id : 'alles';
}

function sbVorlageSetzen(id) {
  store.setItem(SB_VORLAGE_KEY, id);
  applySidebarCfg();
}

function sbVorlageWahlFuellen() {
  const sel = document.getElementById('sb-vorlage');
  if (!sel) return;
  const aktiv = sbVorlageAktiv();
  sel.innerHTML = SB_VORLAGEN.map(v =>
    `<option value="${v.id}"${v.id === aktiv ? ' selected' : ''}>${escHtml(v.label)}</option>`).join('');
}

function loadSidebarCfg() {
  try { return jsonParse(store.getItem(SIDEBAR_CFG_KEY)) || {}; } catch { return {}; }
}
function saveSidebarCfgData(c) { store.setItem(SIDEBAR_CFG_KEY, JSON.stringify(c)); }

// Auf aktive Sidebar anwenden — nur Sektionen ausblenden die der User deaktiviert hat
// (Phase-basierte Sichtbarkeit wird von showDetail() gesteuert — hier NUR zusätzliche Deaktivierungen)
// Alle Gruppen, die eine Vorlage betreffen kann
function _sbAlleSektionen() {
  return SIDEBAR_SECTIONS.map(s => s.id).concat('sec-notizen');
}

// Stand nach der Phasenlogik festhalten: welche Gruppe waere sichtbar?
// Ohne diese Aufnahme wuesste die Vorlage beim Zurueckschalten nicht, was sie
// wieder einblenden darf, und die Seitenleiste bliebe leer.
function sbPhasenStandMerken() {
  _sbAlleSektionen().forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.userHidden === '1') return;
    el.dataset.phaseAus = el.style.display === 'none' ? '1' : '';
  });
}

function applySidebarCfg() {
  const cfg     = loadSidebarCfg();
  const vorlage = SB_VORLAGEN.find(v => v.id === sbVorlageAktiv());
  const erlaubt = vorlage?.sektionen ? new Set(vorlage.sektionen) : null;
  sbVorlageWahlFuellen();
  _sbAlleSektionen().forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const aus = cfg[id] === false || (erlaubt && !erlaubt.has(id));
    if (aus) el.dataset.userHidden = '1';
    else delete el.dataset.userHidden;
    // Die Phase hat das letzte Wort: was sie ausblendet, bleibt aus
    el.style.display = (aus || el.dataset.phaseAus === '1') ? 'none' : '';
  });
}

function saveSidebarCfg() {
  const cfg = {};
  SIDEBAR_SECTIONS.forEach(s => {
    const cb = document.getElementById('sbcfg-' + s.id);
    if (cb) cfg[s.id] = cb.checked ? undefined : false;
  });
  Object.keys(cfg).forEach(k => { if (cfg[k] === undefined) delete cfg[k]; });
  saveSidebarCfgData(cfg);
  // Save order from settings list
  const list = document.getElementById('sidebar-cfg-list');
  if (list) {
    const order = [...list.querySelectorAll('[data-id]')].map(el => el.dataset.id);
    if (order.length) store.setItem(SB_ORDER_KEY, JSON.stringify(order));
  }
  applySidebarCfg();
  _applySbOrder();
  ui.toast('✓ Sidebar-Einstellungen gespeichert.', 'erfolg');
}

// ============================================================
// PHASEN-KONFIGURATION
// ============================================================
function loadPhasesCfg() {
  try { return jsonParse(store.getItem(PHASES_CFG_KEY)) || null; } catch { return null; }
}
function savePhasesCfgData(c) { store.setItem(PHASES_CFG_KEY, JSON.stringify(c)); }

// Gibt die aktive Phasen-Liste zurück (Custom überschreibt Default-Labels)
function getEffectivePhases() {
  const custom = loadPhasesCfg();
  if (!custom) return Object.values(PHASEN_CONFIG);
  // Bestehende überschreiben + custom Phasen anhängen
  const result = Object.values(PHASEN_CONFIG).map(p => {
    const ov = custom.find(c => c.id === p.id);
    return ov ? { ...p, label: ov.label, labelKurz: ov.labelKurz, beschreibung: ov.beschreibung } : p;
  });
  // Custom Phasen (mapsTo: existing id)
  custom.filter(c => c.mapsTo).forEach(c => {
    if (!result.find(r => r.id === c.id)) result.push({ ...PHASEN_CONFIG[c.mapsTo], ...c });
  });
  return result;
}

function savePhasesCfg() {
  const cfg = [];
  // Standard-Phasen umbenennen
  ['baugrund','bauprojekt','ausfuehrung'].forEach(id => {
    const lbl  = document.getElementById('ph-lbl-' + id)?.value.trim();
    const kurz = document.getElementById('ph-kurz-' + id)?.value.trim();
    const desc = document.getElementById('ph-desc-' + id)?.value.trim();
    if (lbl || kurz || desc) cfg.push({ id, label: lbl || PHASEN_CONFIG[id].label, labelKurz: kurz || PHASEN_CONFIG[id].labelKurz, beschreibung: desc || PHASEN_CONFIG[id].beschreibung });
  });
  // Eigene Phasen
  document.querySelectorAll('.custom-phase-row').forEach(row => {
    const id    = row.dataset.id;
    const lbl   = row.querySelector('.cp-label')?.value.trim();
    const kurz  = row.querySelector('.cp-kurz')?.value.trim();
    const maps  = row.querySelector('.cp-maps')?.value;
    if (lbl && maps) cfg.push({ id, mapsTo: maps, label: lbl, labelKurz: kurz || lbl });
  });
  savePhasesCfgData(cfg.length ? cfg : null);
  renderPhaseBanner();
  ui.toast('✓ Phasen gespeichert. Seite wird neu geladen um Änderungen vollständig anzuwenden.', 'erfolg');
  setTimeout(() => appReload(), 1000);
}

function addCustomPhaseRow() {
  const cont = document.getElementById('custom-phases-list');
  if (!cont) return;
  const id = 'cp_' + Date.now();
  const row = document.createElement('div');
  row.className = 'custom-phase-row';
  row.dataset.id = id;
  row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;';
  row.innerHTML = `
    <input class="modal-input cp-label" placeholder="Name (z.B. Vorprojekt)" style="flex:2;">
    <input class="modal-input cp-kurz"  placeholder="Kurz" style="flex:1;">
    <select class="modal-input cp-maps" style="flex:1;">
      <option value="baugrund">= Baugrund</option>
      <option value="bauprojekt">= Bauprojekt</option>
      <option value="ausfuehrung">= Ausführung</option>
    </select>
    <button onclick="this.closest('.custom-phase-row').remove()" style="padding:5px 8px;border-radius:6px;border:1px solid #fca5a5;background:#fef2f2;color:#dc2626;cursor:pointer;flex-shrink:0;">✕</button>`;
  cont.appendChild(row);
}

// App-Einstellungen Modal — Tab-Navigation
let _appSettingsTab = 'allgemein';
function openAppSettingsTab(tab) {
  _appSettingsTab = tab;
  document.querySelectorAll('.app-settings-tab-btn').forEach(b => {
    b.classList.toggle('active-tab', b.dataset.tab === tab);
  });
  document.querySelectorAll('.app-settings-panel').forEach(p => {
    p.style.display = p.dataset.panel === tab ? '' : 'none';
  });
  // Breite anpassen für Parameterdatenbank-Tab
  const inner = document.getElementById('app-settings-modal-inner');
  if (inner) inner.style.width = tab === 'paramdb' ? 'min(98vw,820px)' : '520px';
  // Panel-spezifische Initialisierung
  if (tab === 'allgemein')   initAppTabAllgemein();
  if (tab === 'karte')       initAppTabKarte();
  if (tab === 'sidebar')     initAppTabSidebar();
  if (tab === 'phasen')      initAppTabPhasen();
  if (tab === 'vorlage')     renderAppSettingsModal();
  if (tab === 'paramdb')     initAppTabParamdb();
}

// ── Parameterdatenbank in Einstellungen ──────────────────────────────────────

const FT_GEO_OVERRIDE_KEY = 'sp_ft_geo_overrides';
const FT_MAT_OVERRIDE_KEY = 'sp_ft_mat_overrides';

function loadFtGeoOverrides()  { try { return jsonParse(store.getItem(FT_GEO_OVERRIDE_KEY)  || '{}'); } catch { return {}; } }
function saveFtGeoOverrides(d) { store.setItem(FT_GEO_OVERRIDE_KEY,  JSON.stringify(d)); }
function loadFtMatOverrides()  { try { return jsonParse(store.getItem(FT_MAT_OVERRIDE_KEY) || '{}'); } catch { return {}; } }
function saveFtMatOverrides(d) { store.setItem(FT_MAT_OVERRIDE_KEY, JSON.stringify(d)); }

let _paramdbEditMode = false;

function initAppTabParamdb() {
  _paramdbEditMode = false;
  _paramdbEditModeKnopfZeigen();
  paramdbSubTab('geo');
  renderParamdbTables();
}

function paramdbSubTab(tab) {
  ['geo','mat','mast'].forEach(t => {
    const panel = document.getElementById('paramdb-panel-' + t);
    const btn   = document.getElementById('paramdb-tab-' + t);
    if (!panel || !btn) return;
    const active = t === tab;
    panel.style.display = active ? '' : 'none';
    btn.classList.toggle('aktiv', active);
  });
}

// Gedrueckt-Zustand ueber die Knopf-Klassen statt ueber Inline-Farben.
function _paramdbEditModeKnopfZeigen() {
  const btn = document.getElementById('paramdb-edit-mode-btn');
  if (!btn) return;
  btn.classList.toggle('btn-primary',   _paramdbEditMode);
  btn.classList.toggle('btn-secondary', !_paramdbEditMode);
  btn.setAttribute('aria-pressed', String(_paramdbEditMode));
}

function toggleParamdbEditMode() {
  _paramdbEditMode = !_paramdbEditMode;
  _paramdbEditModeKnopfZeigen();
  renderParamdbTables();
}

function renderParamdbTables() {
  renderParamdbGeo();
  renderParamdbMat();
  renderParamdbMast();
}

// ── Masttypen: Nutzungsart je Referenztyp ───────────────────────────────────
// Die Zuordnung stand bis hierher fest im Quelltext. Sie gehört zu denselben
// Zulassungsunterlagen wie Geometrie und Material und muss darum am selben Ort
// einsehbar und anpassbar sein.
function renderParamdbMast() {
  const body = document.getElementById('paramdb-mast-body');
  if (!body) return;

  const daten  = getMastDaten();
  const keys   = Object.keys(daten).sort((a, b) =>
    (daten[a].refTyp || '').localeCompare(daten[b].refTyp || '') || a.localeCompare(b));
  const tdS    = 'padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;white-space:nowrap;';
  const inpS   = 'padding:2px 4px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;';
  const rowBg  = i => i % 2 === 0 ? '#ffffff' : '#f8fafc';
  const familien = getFtFamilies();

  // Eingabezeile für einen neuen Masttyp — im Bearbeiten-Modus am Tabellenende
  const neuZeile = !_paramdbEditMode ? '' : `
    <tr style="background:#f8fafc;border-top:2px solid #e5e7eb;">
      <td style="${tdS}"><input type="text" id="paramdb-mast-neu-key" placeholder="Kürzel" style="width:88px;${inpS}"></td>
      <td style="${tdS}"><select id="paramdb-mast-neu-ref" style="${inpS}"><option value="">—</option>${familien.map(f => `<option value="${f}">${f}</option>`).join('')}</select></td>
      <td style="${tdS}"><input type="text" id="paramdb-mast-neu-profil" placeholder="z.B. HEB 220" style="width:100px;${inpS}"></td>
      <td style="${tdS}"><select id="paramdb-mast-neu-typ" style="${inpS}"><option value="mast">Stielmast</option><option value="anker">Ankermontage</option></select></td>
      <td style="${tdS}"><button onclick="paramdbMastNeu()" class="btn btn-secondary btn-sm">Hinzufügen</button></td>
    </tr>`;

  if (!keys.length) {
    body.innerHTML = `<tr><td colspan="5" style="${tdS}color:#9ca3af;">Keine Masttypen hinterlegt.</td></tr>` + neuZeile;
    return;
  }

  body.innerHTML = keys.map((key, i) => {
    const d = daten[key];
    if (!_paramdbEditMode) {
      return `<tr style="background:${rowBg(i)};">
        <td style="${tdS}font-weight:700;color:#1a3a5c;">${key}</td>
        <td style="${tdS}">${d.refTyp || '—'}</td>
        <td style="${tdS}">${d.profil || '—'}</td>
        <td style="${tdS}color:#6b7280;">${d.typ === 'anker' ? 'Ankermontage' : 'Stielmast'}</td>
        <td style="${tdS}"></td>
      </tr>`;
    }
    const refOpts = ['', ...familien].map(f =>
      `<option value="${f}"${(d.refTyp || '') === f ? ' selected' : ''}>${f || '—'}</option>`).join('');
    return `<tr style="background:${rowBg(i)};">
      <td style="${tdS}font-weight:700;color:#1a3a5c;">${key}</td>
      <td style="${tdS}"><select onchange="saveParamdbMastField('${key}','refTyp',this.value)" style="${inpS}">${refOpts}</select></td>
      <td style="${tdS}"><input type="text" value="${String(d.profil || '').replace(/"/g,'&quot;')}" placeholder="z.B. HEB 220"
            onchange="saveParamdbMastField('${key}','profil',this.value)" style="width:100px;${inpS}"></td>
      <td style="${tdS}"><select onchange="saveParamdbMastField('${key}','typ',this.value)" style="${inpS}">
            <option value="mast"${d.typ !== 'anker' ? ' selected' : ''}>Stielmast</option>
            <option value="anker"${d.typ === 'anker' ? ' selected' : ''}>Ankermontage</option>
          </select></td>
      <td style="${tdS}"><button onclick="paramdbMastEntfernen('${key}')" class="btn btn-sm" style="color:#b91c1c;">Entfernen</button></td>
    </tr>`;
  }).join('') + neuZeile;
}

function saveParamdbMastField(key, feld, wert) {
  const ov = loadMastOverrides();
  ov[key] = { ...(ov[key] || {}), [feld]: wert };
  delete ov[key].geloescht;
  saveMastOverrides(ov);
  _mastAenderungAnwenden();
}

async function paramdbMastEntfernen(key) {
  if (!await ui.confirm(`Masttyp "${key}" entfernen?\n\nStandorte mit dieser Nutzungsart behalten ihren Eintrag, er steht aber nicht mehr zur Auswahl.`)) return;
  const ov = loadMastOverrides();
  ov[key] = { geloescht: true };
  saveMastOverrides(ov);
  _mastAenderungAnwenden();
}

function paramdbMastNeu() {
  const g    = id => document.getElementById(id)?.value.trim() || '';
  const kurz = g('paramdb-mast-neu-key');
  if (!kurz) { ui.toast('Bitte ein Kürzel eingeben.', 'fehler'); return; }
  if (getMastDaten()[kurz]) { ui.toast('Dieses Kürzel gibt es bereits.', 'fehler'); return; }
  const ov = loadMastOverrides();
  ov[kurz] = { refTyp: g('paramdb-mast-neu-ref'), profil: g('paramdb-mast-neu-profil'),
               typ: g('paramdb-mast-neu-typ') || 'mast' };
  saveMastOverrides(ov);
  _mastAenderungAnwenden();
}

// Alle Stellen nachziehen, die die Masttypentabelle lesen
function _mastAenderungAnwenden() {
  renderParamdbMast();
  if (typeof renderFundtypProfilGrid === 'function' && document.getElementById('fundtyp-std-grid')) renderFundtypProfilGrid();
  if (typeof currentPairId !== 'undefined' && currentPairId && typeof refreshBpNutzungsartSelect === 'function') {
    const bp = loadAllBauprojekt()[currentPairId] || {};
    refreshBpNutzungsartSelect(bp, getBpRefFamilie(bp));
  }
}

function renderParamdbGeo() {
  const body = document.getElementById('paramdb-geo-body');
  if (!body) return;
  const types  = DEFAULT_FT_PROFIL.filter(t => t.typ === 'standard');
  const geoOv  = loadFtGeoOverrides();
  const stored = loadFtProfile();
  const tdS    = 'padding:6px 8px;white-space:nowrap;border-bottom:1px solid #f3f4f6;font-size:11px;';
  const inpS   = 'padding:2px 4px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;';
  const rowBg  = i => i % 2 === 0 ? '#ffffff' : '#f8fafc';

  const NEIG_OPTS = ['Hangneigung ≤ 14°', 'Hangneigung 14–33°'];

  body.innerHTML = types.map((t, i) => {
    const ov        = geoOv[t.id] || {};
    const effName   = (stored.find(s => s.id === t.id)?.name) || ov.name || t.name;
    const kopfH     = parseFloat(ov.kopfHoehe    ?? t.kopfHoehe)  || 1.0;
    const tiefe     = parseFloat(ov.tiefe        ?? t.tiefe)       || 0;
    const effNeig   = ov.einsatzBedingung ?? t.einsatzBedingung ?? '';
    // Gemeinsame Formel statt eigener Rechnung. Vorher wurde der Kopf mit fest
    // verdrahteten 0.36 m² angesetzt und der Block als QUADRAT (blockB × blockB)
    // — rechteckige Grundrisse ergaben dadurch ein falsches Volumen.
    const _vol   = ftBetonVolumen({ ...t, ...ov }, false);
    const volStr = _vol ? `${_vol.total.toFixed(2)} m³` : '—';
    const isBoesch  = effNeig.includes('14–33');
    const neigChip  = `<span style="font-size:10px;font-weight:600;padding:1px 6px;border-radius:8px;background:${isBoesch?'#fef9c3':'#eff6ff'};color:${isBoesch?'#854d0e':'#1d4ed8'};">${isBoesch?'14–33°':'≤ 14°'}</span>`;

    // Kopf- und Blockmasse einzeln — vorher war «Kopf b×b» fest verdrahtet
    // («0.60×0.60 m», gar nicht an Daten gebunden) und «Block b×b» ein
    // Freitextfeld. Damit liessen sich rechteckige Grundrisse nicht erfassen
    // und die Kopfmasse überhaupt nicht ändern.
    const masse = ftMasseAusFt({ ...t, ...ov });
    const mal   = '<span style="color:#9ca3af;padding:0 1px;">×</span>';

    if (_paramdbEditMode) {
      const neigOpts  = NEIG_OPTS.map(o => `<option value="${o}"${effNeig===o?' selected':''}>${o.replace('Hangneigung ','')}</option>`).join('');
      const zahl = (feld, wert) =>
        `<input type="number" step="0.01" min="0" value="${wert != null && !isNaN(wert) ? (+wert).toFixed(2) : ''}"
          onchange="saveParamdbGeoField('${t.id}','${feld}',this.value)" onblur="renderParamdbGeo()"
          style="width:58px;${inpS}">`;
      return `<tr style="background:${rowBg(i)};">
        <td style="${tdS}"><input type="text" value="${effName.replace(/"/g,'&quot;')}" onchange="saveParamdbGeoField('${t.id}','name',this.value)" onblur="renderParamdbGeo()" style="width:130px;${inpS}font-weight:700;color:#1a3a5c;"></td>
        <td style="${tdS}"><select onchange="saveParamdbGeoField('${t.id}','einsatzBedingung',this.value)" style="${inpS}"><option value="">—</option>${neigOpts}</select></td>
        <td style="${tdS}white-space:nowrap;">${zahl('kopfB', masse.kopf?.b)}${mal}${zahl('kopfL', masse.kopf?.l)}</td>
        <td style="${tdS}">${zahl('kopfHoehe', kopfH)}</td>
        <td style="${tdS}white-space:nowrap;">${zahl('blockB', masse.block?.b)}${mal}${zahl('blockL', masse.block?.l)}</td>
        <td style="${tdS}">${zahl('tiefe', tiefe)}</td>
        <td style="${tdS}color:#6b7280;">${volStr}</td>
      </tr>`;
    } else {
      const mText = m => m ? `${m.b.toFixed(2)}×${m.l.toFixed(2)} m` : null;
      const blockTxt = mText(masse.block)
        || `<span style="color:#d97706;font-weight:600;">— ausstehend</span>`;
      return `<tr style="background:${rowBg(i)};">
        <td style="${tdS}font-weight:700;color:#1a3a5c;">${effName}</td>
        <td style="${tdS}">${neigChip}</td>
        <td style="${tdS}">${mText(masse.kopf) || '—'}</td>
        <td style="${tdS}">${kopfH.toFixed(2)} m</td>
        <td style="${tdS}">${blockTxt}</td>
        <td style="${tdS}">${tiefe.toFixed(2)} m</td>
        <td style="${tdS}">${volStr}</td>
      </tr>`;
    }
  }).join('');
}

// Materialseite der Parameterdatenbank.
// Bearbeitet werden STRUKTURIERTE Felder (je Grösse ein Eingabefeld) — dieselben
// Feldnamen, die Modal, Materialliste und Exporte lesen. Vorher stand hier
// Fliesstext («4 Ø 16 mm») unter eigenen Schlüsseln; solche Eingaben kamen
// nirgends an. Die Leseansicht zeigt weiterhin die zusammengesetzte Textform.
function renderParamdbMat() {
  const body = document.getElementById('paramdb-mat-body');
  if (!body) return;
  const types = DEFAULT_FT_PROFIL.filter(t => t.typ === 'standard');
  const bib   = loadFtProfile();
  const tdS = 'padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:11px;';
  const rowBg = i => i % 2 === 0 ? '#ffffff' : '#f8fafc';
  const fehlt = '<span style="color:#9ca3af;">gem. Dok.</span>';

  body.innerHTML = types.map((t, i) => {
    const eff = bib.find(x => x.id === t.id) || t;      // Bibliothek führt
    const m   = ftMaterialAnzeige(eff);

    if (_paramdbEditMode) {
      const inp = (feld, ph, breite, typAttr) =>
        `<input type="${typAttr || 'text'}" value="${String(eff[feld] ?? '').replace(/"/g,'&quot;')}" placeholder="${ph}"
          onchange="saveParamdbMatField('${t.id}','${feld}',this.value)"
          style="width:${breite};padding:2px 4px;border:1px solid #d1d5db;border-radius:4px;font-size:10px;">`;
      const gruppe = inhalt => `<div style="display:flex;gap:3px;align-items:center;">${inhalt}</div>`;
      const mal = '<span style="color:#9ca3af;">×</span>';
      return `<tr style="background:${rowBg(i)};">
        <td style="${tdS}font-weight:700;color:#1a3a5c;white-space:nowrap;">${t.name}</td>
        <td style="${tdS}">${inp('beton','C30/37','100%')}</td>
        <td style="${tdS}">${inp('betondeckung','40','52px','number')}</td>
        <td style="${tdS}">${inp('bewehrungsstahl','B500B','76px')}</td>
        <td style="${tdS}">${inp('bewehrungKg','kg','58px','number')}</td>
        <!-- Seitenlänge als Textfeld: rechteckige Bügel tragen «260×750». -->
        <td style="${tdS}">${gruppe(inp('buegelAnzahl','Anz','40px','number') + mal + inp('buegelDurchmesser','Ø','40px','number')
                  + '<span style="color:#9ca3af;">/</span>' + inp('buegelSeitenlaenge','Seite','62px')
                  + inp('buegelArtikelNr','Art.-Nr.','78px'))}</td>
        <td style="${tdS}">${gruppe(inp('schraubenAnzahl','Anz','40px','number') + mal + inp('schraubenDurchmesser','M30','52px')
                  + '<span style="color:#9ca3af;">L</span>' + inp('schraubenLaenge','cm','48px','number')
                  + inp('schraubenArtikelNr','Art.-Nr.','78px'))}</td>
      </tr>`;
    }
    return `<tr style="background:${rowBg(i)};">
      <td style="${tdS}font-weight:700;color:#1a3a5c;white-space:nowrap;">${t.name}</td>
      <td style="${tdS}white-space:nowrap;">${m.beton   || fehlt}</td>
      <td style="${tdS}white-space:nowrap;">${m.deckung || fehlt}</td>
      <td style="${tdS}white-space:nowrap;">${m.stahl   || fehlt}</td>
      <td style="${tdS}white-space:nowrap;">${m.bewKg   || fehlt}</td>
      <td style="${tdS}white-space:nowrap;">${m.quer    || fehlt}</td>
      <td style="${tdS}white-space:nowrap;">${m.anker   || fehlt}</td>
    </tr>`;
  }).join('');
}

// ── Parameterdatenbank → FT-Bibliothek durchschreiben ────────────────────────
// Bis hierher landeten Eingaben der Parameterdatenbank nur im Override-Speicher.
// Gelesen wird aber überall `loadFtProfile()`: Modal, Materialliste, Betonvolumen,
// PDF- und Excel-Export. Folge: eine in der Datenbank geänderte Blocktiefe wirkte
// nirgends — die Materialliste rechnete weiter mit dem Vorgabewert.
// Statt in jedem Leser ein eigenes Overlay zu bauen, schreibt die Datenbank ihre
// Werte in die Bibliothek durch. Der Override-Speicher bleibt als Protokoll
// dessen, was abweicht (für Zurücksetzen und den Excel-Austausch).
//
// Abbildung Datenbankfeld → Bibliotheksfeld(er). Ein Eintrag je Feld; die
// Materialseite folgt, sobald sie strukturierte Werte statt Fliesstext führt.
const _zahlOderNull = v => {
  const n = parseFloat(v);
  return (v === '' || v == null || isNaN(n)) ? null : n;
};
// Schreibt die Zeichenkettenform aus den Einzelmassen zurück (in mm, wie im Bestand).
function _ftAbmessungSyncen(t, welche) {
  const b = t[welche + 'B'], l = t[welche + 'L'] ?? t[welche + 'B'];
  const feld = welche + 'Abmessung';
  t[feld] = (b == null) ? '—' : `${Math.round(b * 1000)}×${Math.round((l ?? b) * 1000)} mm`;
}

const PARAMDB_FELDER = {
  geo: {
    name:             (t, v) => { t.name = v; },
    einsatzBedingung: (t, v) => { t.einsatzBedingung = v; },   // _ftMatchesNeigung
    kopfHoehe:        (t, v) => { t.kopfHoehe = v; },
    tiefe:            (t, v) => { t.tiefe = v; },
    // Einzelmasse. Die Zeichenkettenform (kopfAbmessung/blockAbmessung) wird
    // an mehreren Stellen noch gelesen (Kachelanzeige, _ftIsIncomplete), darum
    // beide Richtungen synchron halten — sonst zeigt die Bibliothek alte Masse.
    kopfB:  (t, v) => { t.kopfB = _zahlOderNull(v); _ftAbmessungSyncen(t, 'kopf'); },
    kopfL:  (t, v) => { t.kopfL = _zahlOderNull(v); _ftAbmessungSyncen(t, 'kopf'); },
    blockB: (t, v) => { t.blockB = _zahlOderNull(v); _ftAbmessungSyncen(t, 'block'); },
    blockL: (t, v) => { t.blockL = _zahlOderNull(v); _ftAbmessungSyncen(t, 'block'); },
    blockAbmessung:   (t, v) => {
      t.blockAbmessung = v;
      // blockB/blockL synchron halten: _ftBetonVolumen bevorzugt sie gegenüber
      // der Zeichenkette, sonst rechnete es mit veralteten Massen weiter.
      const m = (v || '').match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/);
      if (m) {
        const z = n => n > 10 ? n / 1000 : n;              // mm oder m
        t.blockB = z(parseFloat(m[1]));
        t.blockL = z(parseFloat(m[2]));
      } else { t.blockB = null; t.blockL = null; }
    },
  },
  // Materialfelder heissen in der Datenbank genauso wie in der Bibliothek,
  // seit die Datenbank strukturierte Werte statt Fliesstext führt.
  mat: Object.fromEntries([
    'beton', 'betondeckung', 'bewehrungsstahl', 'bewehrungKg',
    'laengsAnzahl', 'laengsDurchmesser',
    'buegelAnzahl', 'buegelDurchmesser', 'buegelSeitenlaenge', 'buegelArtikelNr', 'buegelMaterial',
    'schraubenAnzahl', 'schraubenDurchmesser', 'schraubenLaenge', 'schraubenArtikelNr', 'schraubenMaterial',
  ].map(feld => [feld, (t, v) => {
    t[feld] = v;
    // schraubLaenge ist der numerische Zwilling von schraubenLaenge; beide
    // werden gelesen, also müssen sie zusammenbleiben.
    if (feld === 'schraubenLaenge') t.schraubLaenge = parseFloat(v) || null;
    if (feld === 'bewehrungsstahl') t.bewehrung = v;
    // Das Bewehrungsgewicht ist eine Zahl — das Typ-Fenster speichert es als
    // solche, und der Massenauszug rechnet damit. Als Zeichenkette abgelegt
    // liefen Datenbank und Fenster mit zwei Formen desselben Werts.
    if (feld === 'bewehrungKg') t.bewehrungKg = _zahlOderNull(v);
  }])),
};

// Schreibt einen einzelnen Datenbankwert in die Bibliothek.
function _paramdbInBibliothek(id, bereich, field, value) {
  const setzen = PARAMDB_FELDER[bereich] && PARAMDB_FELDER[bereich][field];
  if (!setzen) return false;
  const list  = loadFtProfile();
  const entry = list.find(t => t.id === id);
  if (!entry) return false;
  setzen(entry, value);
  saveFtProfile(list);
  return true;
}

// Merker, welche Überschreibungen zuletzt auf die Bibliothek gelegt wurden.
// Nur damit lässt sich eine ENTFERNTE Überschreibung von einer Änderung
// unterscheiden, die der Nutzer im Fundamenttyp-Modal gemacht hat — dort sind
// die Materialkennwerte auch bei Standardtypen ausdrücklich editierbar.
const FT_PARAMDB_MARKER_KEY = () => 'sp_ft_paramdb_angewendet__' + _activeId;

// Gleicht die Bibliothek mit den Überschreibungen ab.
//
// Vorher wurden sie nur AUFGELEGT. Wurde eine entfernt (Excel- oder
// Projektimport), behielt die Bibliothek den alten Wert: die Tabelle zeigte
// wieder die Vorgabe, die Materialliste rechnete aber weiter mit dem
// überschriebenen Mass — zwei verschiedene Zahlen für dasselbe Fundament.
// Jetzt wird zusätzlich jedes Feld, das FRÜHER überschrieben war und es nicht
// mehr ist, gezielt auf die Vorgabe zurückgesetzt. Felder, die nie überschrieben
// waren, bleiben unangetastet.
let _paramdbAngewendetFuer = null;
function ftParamdbAufBibliothekAnwenden(erzwingen) {
  if (!erzwingen && _paramdbAngewendetFuer === _activeId) return;
  _paramdbAngewendetFuer = _activeId;
  const geoOv = loadFtGeoOverrides();
  const matOv = loadFtMatOverrides();

  const list = loadFtProfile();
  let geaendert = false;

  // Die Vorgaben führen die Einzelmasse nicht, sondern nur die Zeichenketten-
  // form («1000×1000 mm»). Für das Zurücksetzen müssen sie daraus abgeleitet
  // werden — sonst schriebe das Zurücksetzen null und die Abmessung würde «—».
  const vorgabeVollstaendig = v => {
    const m = ftMasseAusFt(v);
    return { ...v,
      kopfB:  m.kopf?.b  ?? null, kopfL:  m.kopf?.l  ?? null,
      blockB: m.block?.b ?? null, blockL: m.block?.l ?? null,
      schraubLaenge: parseFloat(v.schraubenLaenge) || null };
  };

  // Schritt 1: entfernte Überschreibungen auf die Vorgabe zurücksetzen
  let marker = {};
  try { marker = jsonParse(store.getItem(FT_PARAMDB_MARKER_KEY())) || {}; } catch { marker = {}; }
  const aktuell = { geo: geoOv, mat: matOv };
  Object.entries(marker).forEach(([bereich, proId]) => {
    Object.entries(proId || {}).forEach(([id, felder]) => {
      const entry = list.find(t => t.id === id);
      const roh   = DEFAULT_FT_PROFIL.find(t => t.id === id);
      if (!entry || !roh) return;
      const vorgabe = vorgabeVollstaendig(roh);
      (felder || []).forEach(feld => {
        if ((aktuell[bereich]?.[id] || {})[feld] !== undefined) return;   // weiterhin überschrieben
        const setzen = PARAMDB_FELDER[bereich]?.[feld];
        if (!setzen) return;
        setzen(entry, vorgabe[feld]);
        geaendert = true;
      });
    });
  });

  // Schritt 2: aktuelle Überschreibungen darüberlegen
  const anwenden = (ov, bereich) => {
    Object.keys(ov).forEach(id => {
      const entry = list.find(t => t.id === id);
      if (!entry) return;
      Object.keys(ov[id]).forEach(field => {
        const setzen = PARAMDB_FELDER[bereich][field];
        if (!setzen) return;
        setzen(entry, ov[id][field]);
        geaendert = true;
      });
    });
  };
  anwenden(geoOv, 'geo');
  anwenden(matOv, 'mat');
  if (geaendert) saveFtProfile(list);

  _paramdbMarkerFortschreiben();
}

// Hält den Merker auf dem Stand der aktuellen Überschreibungen.
function _paramdbMarkerFortschreiben() {
  const merken = ov => Object.fromEntries(Object.entries(ov).map(([id, f]) => [id, Object.keys(f)]));
  store.setItem(FT_PARAMDB_MARKER_KEY(), JSON.stringify({
    geo: merken(loadFtGeoOverrides()), mat: merken(loadFtMatOverrides()),
  }));
}

function saveParamdbGeoField(id, field, value) {
  const ov = loadFtGeoOverrides();
  ov[id] = ov[id] || {};
  ov[id][field] = value;
  saveFtGeoOverrides(ov);
  _paramdbInBibliothek(id, 'geo', field, value);
  _paramdbMarkerFortschreiben();

  // Der Typname steckt zusätzlich als Klartext in den Bauprojektdaten
  if (field === 'name' && value) {
    const all = loadAllBauprojekt();
    let changed = false;
    Object.keys(all).forEach(k => {
      if (all[k].ftProfilId === id) { all[k].fundtyp = value; changed = true; }
    });
    if (changed) saveAllBauprojekt(all);
  }
}

function saveParamdbMatField(id, field, value) {
  const ov = loadFtMatOverrides();
  ov[id] = ov[id] || {};
  ov[id][field] = value;
  saveFtMatOverrides(ov);
  _paramdbInBibliothek(id, 'mat', field, value);
  _paramdbMarkerFortschreiben();
}

// Spalten des Excel-Austauschs der Materialseite. Titel = Spaltenkopf in der
// Datei, feld = Feldname in der Bibliothek. Der Import ordnet über den Titel zu,
// nicht über die Position — eingefügte oder verschobene Spalten bleiben so heil.
const PARAMDB_MAT_SPALTEN = [
  { titel: 'Typ',                  feld: null },
  { titel: 'Beton',                feld: 'beton' },
  { titel: 'Betondeckung (mm)',    feld: 'betondeckung' },
  { titel: 'Bewehrungsstahl',      feld: 'bewehrungsstahl' },
  // Gewicht je Fundament aus dem Bewehrungsplan. Ueber diesen Weg lassen sich
  // alle Typen auf einmal hinterlegen, statt sechsundzwanzig Fenster zu oeffnen.
  { titel: 'Bewehrung (kg)',       feld: 'bewehrungKg' },
  { titel: 'Bügel Anzahl',         feld: 'buegelAnzahl' },
  { titel: 'Bügel Ø (mm)',         feld: 'buegelDurchmesser' },
  { titel: 'Bügel Seitenlänge (mm)', feld: 'buegelSeitenlaenge' },
  { titel: 'Bügel Art.-Nr.',       feld: 'buegelArtikelNr' },
  { titel: 'Fundamentschrauben Anzahl',   feld: 'schraubenAnzahl' },
  { titel: 'Fundamentschrauben Ø',        feld: 'schraubenDurchmesser' },
  { titel: 'Fundamentschrauben L (cm)',   feld: 'schraubenLaenge' },
  { titel: 'Fundamentschrauben Art.-Nr.', feld: 'schraubenArtikelNr' },
];

function exportParamdbExcel() {
  const types = DEFAULT_FT_PROFIL.filter(t => t.typ === 'standard');
  const geoOv = loadFtGeoOverrides();
  const matOv = loadFtMatOverrides();

  const geoRows = [['Typ','Hangneigung','Kopf h (m)','Block b×b (mm)','Tiefe t (m)']];
  types.forEach(t => {
    const ov = geoOv[t.id] || {};
    geoRows.push([
      ov.name || t.name,
      ov.einsatzBedingung ?? t.einsatzBedingung,
      parseFloat(ov.kopfHoehe ?? t.kopfHoehe) || '',
      ov.blockAbmessung != null ? ov.blockAbmessung : t.blockAbmessung,
      parseFloat(ov.tiefe ?? t.tiefe) || ''
    ]);
  });

  // Eine Spalte je Grösse — so lässt sich die Datei in Excel auswerten und
  // beim Import eindeutig zurückschreiben. Frühere Exporte hatten je eine
  // Freitextspalte («4 Ø 16 mm»), die beim Import niemand zerlegen konnte.
  const bib = loadFtProfile();
  const matRows = [PARAMDB_MAT_SPALTEN.map(s => s.titel)];
  types.forEach(t => {
    const eff = bib.find(x => x.id === t.id) || t;
    matRows.push(PARAMDB_MAT_SPALTEN.map(s => s.feld ? (eff[s.feld] ?? '') : t.name));
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(geoRows),  'Geometrie');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(matRows),  'Material_Bewehrung');
  XLSX.writeFile(wb, 'Parameterdatenbank_FL.xlsx');
}

function importParamdbExcel(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'binary' });

      const geoSheet = wb.Sheets['Geometrie'];
      if (geoSheet) {
        const rows = XLSX.utils.sheet_to_json(geoSheet, { header: 1 });
        const ov   = loadFtGeoOverrides();
        rows.slice(1).forEach(row => {
          const t = DEFAULT_FT_PROFIL.find(x => x.name === row[0] && x.typ === 'standard');
          if (!t) return;
          ov[t.id] = ov[t.id] || {};
          if (row[2] != null && row[2] !== '') ov[t.id].kopfHoehe      = String(row[2]);
          if (row[3] != null && row[3] !== '') ov[t.id].blockAbmessung = String(row[3]);
          if (row[4] != null && row[4] !== '') ov[t.id].tiefe          = String(row[4]);
        });
        saveFtGeoOverrides(ov);
      }

      const matSheet = wb.Sheets['Material_Bewehrung'];
      let altesFormat = false;
      if (matSheet) {
        const rows = XLSX.utils.sheet_to_json(matSheet, { header: 1 });
        const kopf = (rows[0] || []).map(z => String(z || '').trim());
        // Zuordnung über den Spaltentitel; Position ist unerheblich.
        const spalte = {};
        // Frühere Spaltentitel weiter annehmen — Dateien, die vor der
        // Umbenennung «Anker» → «Fundamentschrauben» exportiert wurden, sollen
        // sich nach wie vor einlesen lassen.
        const ALT_TITEL = {
          'Fundamentschrauben Anzahl':   'Anker Anzahl',
          'Fundamentschrauben Ø':        'Anker Ø',
          'Fundamentschrauben L (cm)':   'Anker Länge (cm)',
          'Fundamentschrauben Art.-Nr.': 'Anker Art.-Nr.',
        };
        PARAMDB_MAT_SPALTEN.forEach(s => {
          if (!s.feld) return;
          let i = kopf.indexOf(s.titel);
          if (i < 0 && ALT_TITEL[s.titel]) i = kopf.indexOf(ALT_TITEL[s.titel]);
          if (i >= 0) spalte[s.feld] = i;
        });
        const typSpalte = Math.max(0, kopf.indexOf('Typ'));
        // Datei aus der Zeit vor den Einzelspalten: enthält Freitext, der sich
        // nicht verlässlich zerlegen lässt — lieber melden als falsch raten.
        altesFormat = !Object.keys(spalte).length && kopf.some(z => /Längsbewehrung|Querbewehrung|Ankerbolzen/.test(z));
        if (!altesFormat) {
          const ov = loadFtMatOverrides();
          rows.slice(1).forEach(row => {
            const t = DEFAULT_FT_PROFIL.find(x => x.name === row[typSpalte] && x.typ === 'standard');
            if (!t) return;
            ov[t.id] = ov[t.id] || {};
            Object.entries(spalte).forEach(([feld, i]) => {
              if (row[i] != null && row[i] !== '') ov[t.id][feld] = String(row[i]);
            });
          });
          saveFtMatOverrides(ov);
        }
      }

      // Eingelesene Werte in die Bibliothek legen, sonst wirken sie nirgends
      ftParamdbAufBibliothekAnwenden(true);
      renderParamdbTables();
      if (typeof renderFundtypView === 'function') renderFundtypView();
      if (altesFormat) ui.toast('Geometrie übernommen. Das Materialblatt stammt aus einer älteren Fassung mit Freitextspalten und wurde übersprungen — bitte neu exportieren.', 'fehler', 7000);
      else ui.toast('Import erfolgreich!', 'erfolg');
    } catch (err) {
      ui.toast('Fehler beim Import: ' + err.message, 'fehler');
    }
    input.value = '';
  };
  reader.readAsBinaryString(file);
}

async function resetParamdbOverrides() {
  if (!await ui.confirm('Alle lokalen Anpassungen der Parameterdatenbank zurücksetzen?\n\nDie Original-Standardwerte werden wiederhergestellt.')) return;
  store.removeItem(FT_GEO_OVERRIDE_KEY);
  store.removeItem(FT_MAT_OVERRIDE_KEY);
  store.removeItem(MAST_OVERRIDE_KEY);
  store.removeItem(FT_PARAMDB_MARKER_KEY());   // nichts mehr aufgelegt
  // Die Werte stecken seit dem Durchschreiben auch in der Bibliothek — dort
  // die Vorgaben wiederherstellen, sonst wirkt das Zurücksetzen nur optisch.
  store.removeItem(FT_VERSION_KEY());
  seedDefaultFtProfile();
  renderParamdbTables();
  if (typeof renderFundtypView === 'function') renderFundtypView();
}

async function deleteProject(id) {
  const projects = loadProjectsMeta();
  if (projects.length <= 1) { ui.toast('Das letzte Projekt kann nicht gelöscht werden.', 'fehler'); return; }
  const p = projects.find(x => x.id === id);
  if (!await ui.confirm(`Projekt "${p?.name || id}" wirklich löschen?\n\nAlle Daten dieses Projekts werden permanent entfernt.`)) return;
  // Projektdaten aus localStorage entfernen
  ['sp_pairs__','sp_data__','sp_tags__','sp_tagdates__','sp_titel__'].forEach(prefix => {
    store.removeItem(prefix + id);
  });
  const idx = projects.findIndex(x => x.id === id);
  projects.splice(idx, 1);
  saveProjectsMeta(projects);
  // Falls aktives Projekt gelöscht, zum ersten wechseln
  if (id === _activeId) {
    store.setItem(ACTIVE_PROJECT_KEY, projects[0].id);
  }
  appReload();
}

async function deleteAllProjectData() {
  if (!await ui.confirm('ALLE Projekte und Daten wirklich löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden!')) return;
  if (!await ui.confirm('Letzte Bestätigung: Wirklich alle Fundamentbau-Daten löschen?')) return;
  // Alle projekt-spezifischen und Legacy-Keys entfernen
  const toRemove = store.keys().filter(k =>
    k.startsWith('sp_') || k.startsWith('sondagen_')
  );
  toRemove.forEach(k => store.removeItem(k));
  appReload();
}

async function projektAbschliessen() {
  closeProjektModal();

  const projekt = loadProjectsMeta().find(p => p.id === _activeId);
  const name = projekt?.name || 'Projekt';

  // Schritt 1: Bestätigung
  if (!await ui.confirm(`Projekt "${name}" abschliessen?\n\nEs wird zuerst eine vollständige JSON-Sicherung heruntergeladen.`)) return;

  // Schritt 2: Vollständige JSON-Sicherung aller Projektdaten
  const allKeys = store.keys().filter(k => k.endsWith('__' + _activeId) || k === 'sp_phase__' + _activeId);
  const backup = {
    version: 4,
    exportiert_am: new Date().toLocaleString('de-CH'),
    projektName: name,
    projektId: _activeId,
    pairs: PAIRS,
    pairData: appData,
    customTags,
    tagDates,
    titel: store.getItem(TITEL_KEY) || null,
    raw: {},
  };
  // Alle projektspezifischen Keys sichern
  allKeys.forEach(k => {
    try { backup.raw[k] = jsonParse(store.getItem(k)); }
    catch { backup.raw[k] = store.getItem(k); }
  });

  // Download
  const datum = new Date().toLocaleDateString('de-CH').replace(/\./g, '-');
  const blob  = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Abschluss_${name.replace(/\s+/g,'-')}_${datum}.json`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);

  // Schritt 3: Lokale Daten löschen?
  setTimeout(async () => {
    const loeschen = await ui.confirm(
      `Sicherung wurde heruntergeladen.\n\n` +
      `Sollen die lokalen Daten für "${name}" jetzt gelöscht werden?\n\n` +
      `✓ Empfohlen bei mehreren parallelen Projekten (spart Speicher & verbessert Performance)\n` +
      `✗ Nein = Daten bleiben lokal erhalten`
    );

    if (!loeschen) {
      ui.toast(`Projekt "${name}" wurde gesichert. Lokale Daten bleiben erhalten.`, 'erfolg');
      return;
    }

    // Alle projektspezifischen Keys entfernen
    const keysToDelete = store.keys().filter(k =>
      k.endsWith('__' + _activeId) ||
      k === 'sp_phase__' + _activeId ||
      k === 'sp_letter__' + _activeId
    );
    keysToDelete.forEach(k => store.removeItem(k));

    // Projekt in Metadaten als abgeschlossen markieren (aber nicht entfernen)
    const projects = loadProjectsMeta();
    const idx = projects.findIndex(p => p.id === _activeId);
    if (idx >= 0) {
      projects[idx].abgeschlossen = true;
      projects[idx].abgeschlossenAm = new Date().toISOString();
      saveProjectsMeta(projects);
    }

    const verbleibend = projects.filter(p => !p.abgeschlossen);
    if (verbleibend.length > 0) {
      // Zu einem anderen aktiven Projekt wechseln
      store.setItem(ACTIVE_PROJECT_KEY, verbleibend[0].id);
    }

    ui.toast(`Projekt "${name}" wurde abgeschlossen und lokale Daten gelöscht.\n${verbleibend.length > 0 ? `Aktiv: "${verbleibend[0].name}"` : 'Keine weiteren Projekte vorhanden.'}`, 'fehler');
    appReload();
  }, 800);
}

async function exportAppDaten() {
  const inclKarte  = document.getElementById('exp-opt-karte').checked;
  const inclSkizze = document.getElementById('exp-opt-skizze').checked;

  // appData kopieren; Skizzen bei Bedarf weglassen und Fotos als
  // Data-URL einbetten (im Projekt liegen nur Blob-Referenzen).
  const pairDataExport = {};
  for (const [id, pd] of Object.entries(appData)) {
    pairDataExport[id] = { ...pd };
    if (!inclSkizze) delete pairDataExport[id].sketch;
    if (pd.fotos?.length) {
      pairDataExport[id].fotos = await Promise.all(pd.fotos.map(async f => {
        const data = await fotoDataUrl(f);
        const kopie = { ...f, ...(data ? { data } : {}) };
        delete kopie.blobId;
        return kopie;
      }));
    }
  }

  const exportData = {
    version: 3,
    exportiert_am: new Date().toLocaleString('de-CH'),
    optionen: { karte: inclKarte, skizze: inclSkizze },
    pairs:      PAIRS,
    pairData:   pairDataExport,
    customTags: customTags,
    tagDates:   tagDates,
    titel:      store.getItem(TITEL_KEY) || null,
  };

  // Kartenausschnitt: Screenshot via html2canvas
  if (inclKarte) {
    const mapEl = document.getElementById('map');
    if (mapEl && typeof html2canvas !== 'undefined') {
      try {
        document.getElementById('exp-status').textContent = 'Karte wird erfasst...';
        const canvas = await html2canvas(mapEl, { useCORS: true, logging: false });
        exportData.kartenausschnitt = canvas.toDataURL('image/jpeg', 0.7);
      } catch(e) {
        exportData.kartenausschnitt = null;
      }
    }
  }

  document.getElementById('exp-status').textContent = '';
  closeExportDatenModal();

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const datum = new Date().toLocaleDateString('de-CH').replace(/\./g, '-');
  a.download = `Fundamentbau_Daten_${datum}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importAppDaten(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const data = jsonParse(e.target.result);
      if (!data.pairs || !Array.isArray(data.pairs)) {
        ui.toast('Ungültige Datei. Bitte eine gültige Fundamentbau-Datei (.json) wählen.', 'fehler'); return;
      }
      if (!await ui.confirm(`Daten vom ${data.exportiert_am || '?'} laden?\n\nAlle aktuellen Daten auf diesem Gerät werden überschrieben!`)) {
        input.value = ''; return;
      }

      // Standorte (Geometrie + Metadaten)
      PAIRS.length = 0;
      data.pairs.forEach(p => PAIRS.push(p));
      savePairs();

      // Felddaten, Status, Kommentare, Fotos, Changelog, Sicherheit, etc.
      if (data.pairData) {
        appData = data.pairData;
        saveData(appData);
        // Eingebettete Fotos wieder in den Blob-Store auslagern
        await migriereFotosZuBlobs();
      }

      // Custom Tags
      if (data.customTags) {
        customTags.length = 0;
        data.customTags.forEach(t => customTags.push(t));
        saveCustomTags();
      }

      // Starttermine T1–T12 (tagDates — neues Format v3; 'termine' für Abwärtskompatibilität)
      const importedDates = data.tagDates || data.termine || null;
      if (importedDates) {
        Object.keys(tagDates).forEach(k => delete tagDates[k]);
        Object.assign(tagDates, importedDates);
        saveTagDatesData();
      }

      // App-Titel
      if (data.titel) {
        store.setItem(TITEL_KEY, data.titel);
        document.getElementById('app-title-text').textContent = data.titel;
        // Projektname synchronisieren
        const proj = _projects.find(x => x.id === _activeId);
        if (proj) { proj.name = data.titel; saveProjectsMeta(_projects); }
      }

      updateProgress();
      renderTagFilterChips();
      renderCards();
      ui.toast('Daten erfolgreich geladen!', 'erfolg');
    } catch(err) {
      ui.toast('Fehler beim Lesen der Datei: ' + err.message, 'fehler');
    }
    input.value = '';
  };
  reader.readAsText(file);
}


// ============================================================
