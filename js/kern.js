// ============================================================
// ICONS — eine Quelle für alle Sinnbilder der Oberfläche
//
// Die App ist monochrom; farbige Emoji (⚠️ 📄 ⚙ 🔄 …) brachen das Bild und
// wurden je nach Betriebssystem und Schriftart unterschiedlich gross und
// unterschiedlich bunt gerendert. svgIcon() liefert stattdessen ein Inline-SVG,
// das über currentColor die Textfarbe seines Elternelements übernimmt.
//
// Einsatz nur dort, wo HTML möglich ist. In reinen Textzusammenhängen
// (ui.confirm, ui.toast, textContent, <option>-Beschriftungen, SVG-<text>)
// gibt es kein Symbol — dort trägt die Formulierung die Aussage allein.
// ============================================================
const SVG_ICON_PFAD = {
  warnung:    '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  dokument:   '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  zahnrad:    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  neuladen:   '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  brief:      '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  karte:      '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  kopieren:   '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  drucken:    '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  klammer:    '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  kamera:     '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  papierkorb: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  stift:      '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  duplizieren:'<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  extern:     '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  telefon:    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mobil:      '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  standort:   '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  lineal:     '<path d="M2 12h20"/><path d="M6 9v6M10 9v6M14 9v6M18 9v6"/>',
  sanduhr:    '<path d="M6 2h12M6 22h12M6 2c0 5 6 6 6 10s-6 5-6 10M18 2c0 5-6 6-6 10s6 5 6 10"/>',
  haken:      '<polyline points="20 6 9 17 4 12"/>',
  kreuz:      '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  blitz:      '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  download:   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
};

/**
 * Inline-SVG als Zeichenkette für Template-Literale.
 * @param {string} name   Schlüssel aus SVG_ICON_PFAD
 * @param {object} [opt]  { groesse, farbe, strich, stil }
 */
function svgIcon(name, opt) {
  const p = SVG_ICON_PFAD[name];
  if (!p) return '';
  const o = opt || {};
  const g = o.groesse || 13;
  return `<svg width="${g}" height="${g}" viewBox="0 0 24 24" fill="none" stroke="${o.farbe || 'currentColor'}"`
       + ` stroke-width="${o.strich || 2}" stroke-linecap="round" stroke-linejoin="round"`
       + ` style="flex-shrink:0;vertical-align:-2px;${o.stil || ''}" aria-hidden="true">${p}</svg>`;
}

// ============================================================
// PROJEKTVERWALTUNG — Mehrere Projekte lokal speicherbar
// ============================================================
const PROJECTS_META_KEY  = 'sondagen_projects';
const ACTIVE_PROJECT_KEY = 'sondagen_active_project';
const APP_TEMPLATE_KEY   = 'sp_app_template';   // Globale Vorlage (projektunabhängig)
const USER_PROFILE_KEY   = 'sp_user_profile';   // Benutzerprofil global
const SIDEBAR_CFG_KEY    = 'sp_sidebar_cfg';    // Sidebar-Sichtbarkeit global
const PHASES_CFG_KEY     = 'sp_phases_cfg';     // Phasen-Konfiguration global

// Alle konfigurierbaren Sidebar-Sektionen
const SIDEBAR_SECTIONS = [
  { id:'sec-meta',             label:'Metadaten',             defaultOn:true  },
  { id:'sec-begehung',         label:'Begehung',              defaultOn:true  },
  { id:'sec-termine',          label:'Termine',               defaultOn:true  },
  { id:'sec-ausfplanung',      label:'Ausführungsplanung',    defaultOn:true  },
  { id:'sec-zugang',           label:'Zugang & Abklärung',    defaultOn:true  },
  { id:'sec-fotos',            label:'Fotos',                 defaultOn:true  },
  { id:'sec-skizzen',          label:'Skizzen',               defaultOn:true  },
  { id:'sec-feld',             label:'Felddaten',             defaultOn:true  },
  { id:'sec-sicher',           label:'Sicherheit',            defaultOn:true  },
  { id:'sec-phase-bauprojekt', label:'Bauprojekt-Felder',     defaultOn:true  },
  { id:'sec-hoehenkoten',      label:'Höhenkoten',            defaultOn:true  },
  { id:'sec-bodenkennwerte',   label:'Bodenkennwerte',        defaultOn:true  },
  { id:'sec-naturschutz',      label:'Umweltschutz',          defaultOn:true  },
  { id:'sec-aushub',           label:'Aushubprotokoll',       defaultOn:true  },
  { id:'sec-material',         label:'Materialbestellung',    defaultOn:true  },
  { id:'sec-abnahme-link',     label:'Abnahme-Checkliste',    defaultOn:true  },
  { id:'sec-changelog',        label:'Änderungsprotokoll',    defaultOn:true  },
  { id:'sec-pdf',              label:'PDF-Bericht',           defaultOn:true  },
];

function genProjectId() { return 'p_' + Date.now(); }

function loadProjectsMeta() {
  try { return jsonParse(store.getItem(PROJECTS_META_KEY)) || []; } catch { return []; }
}
function saveProjectsMeta(list) { store.setItem(PROJECTS_META_KEY, JSON.stringify(list)); }

// Erstes Projekt anlegen, wenn noch keines vorhanden ist.
//
// Hier stand zuvor eine Übernahme aus der Zeit vor der Mehrprojektfähigkeit:
// fünf feste Schlüssel wurden in projektbezogene kopiert. Einer davon trug den
// Namen eines realen Bauvorhabens. Die Übernahme ist entfallen — sie betraf nur
// Installationen aus der Entwicklungszeit, deren Daten nicht mehr gebraucht
// werden. Neue Projekte entstehen ausschliesslich über die Projektverwaltung.
(function initErstesProjekt() {
  if (loadProjectsMeta().length) return;

  const id = genProjectId();
  saveProjectsMeta([{ id, name: 'Projekt A', createdAt: new Date().toISOString() }]);
  store.setItem(ACTIVE_PROJECT_KEY, id);
})();

// Aktives Projekt bestimmen
let _projects = loadProjectsMeta();
let _activeId = store.getItem(ACTIVE_PROJECT_KEY);
if (!_activeId || !_projects.find(p => p.id === _activeId)) {
  _activeId = _projects[0]?.id || genProjectId();
  store.setItem(ACTIVE_PROJECT_KEY, _activeId);
}

// Dynamische Storage-Keys — die restlichen Lade-/Speicherfunktionen lesen diese Variablen
let PAIRS_KEY      = 'sp_pairs__'    + _activeId;
let STORAGE_KEY    = 'sp_data__'     + _activeId;
let TAGS_KEY       = 'sp_tags__'     + _activeId;
let TAGDATES_KEY   = 'sp_tagdates__' + _activeId;
let TITEL_KEY      = 'sp_titel__'    + _activeId;
let CONTACTS_KEY   = 'sp_contacts__' + _activeId;
let LETTER_KEY     = 'sp_letter__'   + _activeId;
let PHASE_KEY      = 'sp_phase__'    + _activeId;
let KENNDATEN_KEY  = 'sp_kenndaten__'+ _activeId;

// ============================================================
// PHASEN-KONFIGURATION
// Zentrale Konfiguration — neue Phasen hier ergänzen
// ============================================================
const PHASEN_CONFIG = {
  baugrund: {
    id: 'baugrund',
    label: 'Baugrunduntersuchung',
    labelKurz: 'Baugrund',
    beschreibung: 'Sondagen RS / RKS · Zugänglichkeit · Feldresultate',
    sidebarSektionen: ['zugaenglichkeit', 'feldresultate', 'kontakte'],
    standortFelder: ['rs', 'rks', 'zugang', 'tiefe', 'tag'],
  },
  bauprojekt: {
    id: 'bauprojekt',
    label: 'Bauprojekt',
    labelKurz: 'Bauprojekt',
    beschreibung: 'Fundamente · Baugrund · Statische Nachweise',
    sidebarSektionen: ['fundamenttyp', 'bestandsmassnahme', 'kontakte'],
    standortFelder: ['fundament', 'bestand', 'massnahme', 'baugrund', 'nachweis'],
  },
  ausfuehrung: {
    id: 'ausfuehrung',
    label: 'Ausführungsprojekt',
    labelKurz: 'Ausführung',
    beschreibung: 'Aushubprotokoll · Materialbestellung · Abnahme',
    sidebarSektionen: ['aushub', 'material', 'abnahme', 'kontakte'],
    standortFelder: ['aushub', 'material', 'checkliste'],
  },
};

// ============================================================
// NAVIGATION — Phasenbindung der Bereiche
//
// Eine Quelle dafuer, welcher Bereich in welcher Phase zulaessig ist.
// Frueher stand das verteilt in setPhase() als Kette von display:none-
// Zuweisungen plus fuenf fest verdrahteten Ruecksetzungen auf «Kacheln».
// null = in jeder Phase verfuegbar.
// ============================================================
const VIEW_PHASEN = {
  karten:      null,
  liste:       null,
  karte:       null,
  termine:     null,
  baugrund:    ['baugrund'],
  fundamente:  ['bauprojekt'],          // Bausortiment gehoert zur Projektierung
  bauprogramm: ['ausfuehrung'],
  protokolle:  null,                    // Besprechungen fallen in jeder Phase an
};

function viewErlaubt(view, phase) {
  const erlaubt = VIEW_PHASEN[view];
  return !erlaubt || erlaubt.includes(phase || _activePhase);
}

// Kein Sperrzustand mehr: Jeder Bereich ist immer erreichbar. Die Phase folgt
// dem Bereich (siehe _navPhaseFuerBereichWechseln), statt ihn zu verbieten.
// Hier wird nur noch die Zugehoerigkeit im Tooltip hinterlegt — Information
// ohne Verbot.
function _navTabsAktualisieren() {
  Object.keys(VIEW_PHASEN).forEach(v => {
    const btn = document.getElementById('vbtn-' + v);
    if (!btn) return;
    if (btn.dataset.titelStd === undefined) btn.dataset.titelStd = btn.title || '';
    const phasen = VIEW_PHASEN[v];
    btn.title = phasen
      ? 'Bereich der Phase ' + phasen.map(p => PHASEN_CONFIG[p]?.labelKurz || p).join(' / ')
      : (btn.dataset.titelStd || 'In jeder Phase verfügbar');
  });
}

// Die Reiterzeile scrollt horizontal. Auf schmalen Geraeten liegt der gerade
// aktive Bereich nach einem Wechsel oft ausserhalb des sichtbaren Bereichs —
// deshalb heranholen. Nur innerhalb der Leiste scrollen, nicht die Seite.
function _navAktivenReiterZeigen() {
  const leiste = document.querySelector('.view-bar');
  const btn    = leiste?.querySelector('.view-btn.active');
  if (!leiste || !btn) return;
  const l = leiste.getBoundingClientRect(), b = btn.getBoundingClientRect();
  const rand = 12;
  if (b.left < l.left + rand) {
    leiste.scrollBy({ left: b.left - l.left - rand, behavior: 'smooth' });
  } else if (b.right > l.right - rand) {
    leiste.scrollBy({ left: b.right - l.right + rand, behavior: 'smooth' });
  }
}

// Klick auf einen Bereich einer anderen Phase: Phase mitziehen und den Bereich
// oeffnen — ohne Rueckfrage. Der Nutzer waehlt den Bereich, die Phase folgt.
// Kein Hinweis mehr: der Phasenwaehler ist in einem Bereich gar nicht sichtbar,
// die Verortung im Kopfband nennt die Phase ohnehin.
function _navPhaseFuerBereichWechseln(view) {
  setPhase(VIEW_PHASEN[view][0]);
  setOverviewView(view);
}

// Aktive Phase laden / speichern
function loadPhase() {
  return store.getItem(PHASE_KEY) || 'baugrund';
}
function savePhase(phase) {
  store.setItem(PHASE_KEY, phase);
}
let _activePhase = loadPhase();

// Phase umschalten
function setPhase(phase) {
  if (!PHASEN_CONFIG[phase]) return;
  _activePhase = phase;
  savePhase(phase);
  _notizFilterPhase = phase; // Notiz-Filter automatisch auf aktive Phase setzen
  renderPhaseBanner();
  updateHeaderSub();
  renderContacts();
  // Reiter: nur Tooltips zur Phasenzugehoerigkeit (siehe _navTabsAktualisieren)
  _navTabsAktualisieren();
  // Installationen-Tab entfernt — Installationen direkt in Kachelansicht integriert

  // setPhase() wechselt bewusst KEINE Ansicht mehr. Frueher stellte es die in
  // der Zielphase zuletzt benutzte Ansicht wieder her — man wechselte die Phase
  // und landete unvermittelt woanders. Die Steuerung laeuft nur noch in eine
  // Richtung: der Bereich zieht die Phase nach, nie umgekehrt. Waehlbar ist die
  // Phase ohnehin nur in den Standortansichten, und die sind phasenfrei.
  // Fortschritt im Kopfband und Zahlen an den Filterknoepfen beziehen sich auf
  // die Standorte der aktiven Phase — beide zieht updateProgress() nach.
  updateProgress();
  // Liste neu rendern falls aktiv
  if (currentOverviewView === 'liste') renderList();
  // In der Übersicht: Karten neu rendern
  if (document.getElementById('overview-view')?.style.display !== 'none') {
    renderCards();
  }
  // Banner-Navigationspfeile nach Phasenwechsel aktualisieren
  updateBannerNavButtons();
  // Übersichtskarte zurücksetzen: Sondagen-Marker gelten nur für Baugrundphase
  if (overviewMap) {
    overviewMarkers.forEach(m => {
      if (m.rs)  m.rs.remove();
      if (m.rks) m.rks.remove();
      if (m.bs)  m.bs.remove();
    });
    overviewMarkers = [];
    overviewMap.remove();
    overviewMap = null;
    // Mit der Karte sind auch ihre Ebenen weg. Ohne dieses Vergessen galt die
    // Bahnebene weiter als aktiv und wurde auf der neuen Karte nicht mehr
    // angelegt — nach einem Phasenwechsel fehlten die Linien.
    if (typeof bahnKarteVergessen === 'function') bahnKarteVergessen('overview');
  }
  // Karte-View sofort neu initialisieren (zeigt Platzhalter wenn nicht Baugrundphase)
  if (currentOverviewView === 'karte') {
    initOverviewMap();
    setTimeout(resizeOverviewMap, 50);
    // Der Ausschnitt gehoert zur neuen Phase, nicht zur vorherigen
    setTimeout(overviewKarteAufPhaseZentrieren, 350);
  }
  // In Detailansicht: Sidebar mit neuer Phase neu laden
  if (document.getElementById('detail-view')?.style.display === 'block' && currentPairId) {
    showDetail(currentPairId);
  }
  // In der Erfassung: Maske nachziehen. Die Phasenwahl ist dort seit dem Umbau
  // im Kopfband erreichbar; ohne das zeigte das Formular weiter die Felder der
  // vorherigen Phase.
  if (document.getElementById('create-view')?.style.display === 'block'
      && typeof applyCreatePhase === 'function') {
    applyCreatePhase();
  }
}

// Mehrere Module rufen diesen Namen; die Arbeit macht renderPhaseBanner().
function updatePhaseSelectState() {
  renderPhaseBanner();
}

// Phasenwahl in der Navigationsleiste fuellen. Die Beschreibung der Phase
// steht im Tooltip — als Fliesstext nahm sie frueher den Platz der Verortung.
function renderPhaseBanner() {
  const phasen = getEffectivePhases();
  const optionen = phasen.map(p =>
    '<option value="' + p.id + '">' + escHtml(p.labelKurz || p.label) + '</option>'
  ).join('');
  const beschreibung = phasen.find(p => p.id === _activePhase)?.beschreibung || '';
  // Zwei Waehler: einer in der Navigationsleiste, einer im Kopfband fuer die
  // Detailansicht. Beide zeigen denselben Zustand.
  document.querySelectorAll('.phase-select').forEach(sel => {
    sel.innerHTML = optionen;
    sel.value = _activePhase;
    if (!sel.disabled) sel.title = beschreibung;
  });
}

// Phasenwahl im Kopfband: sie tritt an die Stelle des Projekttitels, sobald
// dieser weicht — also in Detail- und Erfassungsansicht.
function bannerPhaseZeigen(zeigen) {
  const wrap = document.getElementById('detail-phase-wrap');
  if (wrap) wrap.style.display = zeigen ? 'flex' : 'none';
}

// Beschriftung der Bereiche für den Verortungspfad
// Der Verortungspfad «Phase › Bereich › Standort» entfiel: Phase und Bereich
// stehen als gewaehlte Schaltflaechen in der Navigationsleiste, der Standort
// in der Kopfzeile der Seitenleiste. Der Pfad wiederholte das nur.
// Zurueck fuehrt der Pfeil im Kopfband — navigatePair() legt keine
// Verlaufseintraege an, ein Klick landet also wieder in der Uebersicht.


// ============================================================
// DATA
// ============================================================
const DEFAULT_PAIRS = [];

// ============================================================
// MUTABLE PAIRS
// ============================================================
function loadPairs() {
  try { const s = jsonParse(store.getItem(PAIRS_KEY)); if (Array.isArray(s)) return s; } catch {}
  return jsonParse(JSON.stringify(DEFAULT_PAIRS));
}
function savePairs() { store.setItem(PAIRS_KEY, JSON.stringify(PAIRS)); }
let PAIRS = loadPairs();
let liveDistances = {};   // pairId -> meters, filled when GPS active

// Einheit der Ankerbolzenlänge (Feld schraubenLaenge / schraubLaenge).
// Der Bestand speichert Zentimeter — Standardtypen tragen 250 = 2.5 m.
// Vorher stand ' cm' als Textbaustein in drei Ausgaben und ' m' in einer
// vierten; dieselbe Zahl erschien damit als 250 cm und als 250 m.
const ANKER_LAENGE_EINHEIT = 'cm';
const ankerLaengeText = wert =>
  (wert || wert === 0) ? `L=${wert} ${ANKER_LAENGE_EINHEIT}` : '';

// Installationstyp-Labels (global, vor renderCards benötigt)
const INST_TYP_LABELS = {
  kran: 'Kran', lagerplatz: 'Lagerplatz', baueinrichtung: 'Baueinrichtung',
  zufahrt: 'Zufahrt', sonstig: 'Sonstiges'
};

// Einmalige Migration: setzt _objType auf bestehenden PAIRS-Einträgen
function _migrateObjType() {
  let changed = false;
  PAIRS.forEach(p => {
    if (!p._objType) {
      p._objType = (!p._phase || p._phase === 'baugrund') ? 'sondage' : 'fundament';
      changed = true;
    }
  });
  if (changed) savePairs();
}
_migrateObjType();

// Einmalige Migration: ftProfilId + ftZuweisungen aus fundtyp-Text reparieren
// Tritt auf wenn Daten via Import gespeichert wurden ohne assignFundtyp() zu rufen
function _migrateFtProfilId() {
  const ftProfiles  = loadFtProfile();
  const allBp       = loadAllBauprojekt();
  const ftZuw       = loadFtZuweisungen();
  let bpChanged = false, zuwChanged = false;
  PAIRS.filter(p => p._objType === 'fundament').forEach(p => {
    const bpd = allBp[p.id];
    if (!bpd) return;
    // ftProfilId aus fundtyp-Text ableiten falls leer
    if (!bpd.ftProfilId && bpd.fundtyp) {
      const match = ftProfiles.find(x => x.name === bpd.fundtyp);
      if (match) { bpd.ftProfilId = match.id; bpChanged = true; }
    }
    // ftZuweisungen mit bpData.ftProfilId synchronisieren
    if (bpd.ftProfilId && !ftZuw[p.id]) {
      ftZuw[p.id] = bpd.ftProfilId;
      zuwChanged = true;
    }
  });
  if (bpChanged)  saveAllBauprojekt(allBp);
  if (zuwChanged) saveFtZuweisungen(ftZuw);
}
// Aufruf erfolgt in js/start.js — diese Migration braucht Funktionen
// aus spaeter geladenen Modulen (fundamenttypen.js, init-phasen.js).

function getFundamente()     { return PAIRS.filter(p => p._objType === 'fundament'); }
function getSondagen()       { return PAIRS.filter(p => p._objType === 'sondage'); }
function getInstallationen() { return PAIRS.filter(p => p._objType === 'installation'); }

// ============================================================
// UNDO
// ============================================================
const undoStack = [];
function pushUndo() {
  undoStack.push(JSON.stringify(PAIRS));
  if (undoStack.length > 30) undoStack.shift();
  updateUndoBtn();
}
function undo() {
  if (!undoStack.length) return;
  const prev = jsonParse(undoStack.pop());
  PAIRS.length = 0;
  prev.forEach(p => PAIRS.push(p));
  savePairs();
  updateProgress();
  if (document.getElementById('overview-view').style.display !== 'none') renderCards();
  updateUndoBtn();
}
function updateUndoBtn() {
  document.querySelectorAll('.undo-btn').forEach(b => { b.disabled = undoStack.length === 0; });
}
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
});

// ============================================================
// STORAGE
// ============================================================
function loadData() { try { return jsonParse(store.getItem(STORAGE_KEY)) || {}; } catch { return {}; } }
function saveData(d) { store.setItem(STORAGE_KEY, JSON.stringify(d)); }
let appData = loadData();
function getPairData(id) { return appData[id] || { status:'geplant', comment:'', sketch:null, felddaten:{} }; }
function setPairData(id, updates) { appData[id] = { ...getPairData(id), ...updates }; saveData(appData); }

// Einmalige Migration: Base64-Fotos aus dem Projekt-JSON in den
// Blob-Store auslagern. Läuft pro Projekt einmal beim Start und
// verkleinert appData deutlich (bisher wurde bei jedem Speichern
// die gesamte Bildmenge neu serialisiert).
async function migriereFotosZuBlobs() {
  const zuMigrieren = [];
  Object.entries(appData).forEach(([pairId, pd]) => {
    (pd?.fotos || []).forEach(f => {
      if (f && f.data && !f.blobId) zuMigrieren.push(f);
    });
  });
  if (!zuMigrieren.length) return;
  let ok = 0;
  for (const f of zuMigrieren) {
    try {
      f.blobId = await fotoBlobs.speichern(f.data);
      delete f.data;
      ok++;
    } catch (e) { console.error('Foto-Migration fehlgeschlagen:', e); }
  }
  if (ok) {
    saveData(appData);
    console.info('Foto-Migration: ' + ok + ' Foto(s) in den Blob-Store ausgelagert.');
    if (typeof renderFotos === 'function' && currentPairId) renderFotos();
  }
}

// Verwaiste Foto-Blobs entfernen (Standort/Projekt gelöscht). Prüft
// bewusst ALLE Projekte — sonst würden Fotos anderer Projekte gelöscht.
async function bereinigeVerwaisteFotoBlobs() {
  try {
    const referenziert = new Set();
    store.keys().filter(k => k.startsWith('sp_data__')).forEach(k => {
      const daten = jsonParse(store.getItem(k)) || {};
      Object.values(daten).forEach(pd =>
        (pd?.fotos || []).forEach(f => { if (f?.blobId) referenziert.add(f.blobId); }));
    });
    const alle = await store.blobAlle();
    const verwaist = [...alle.keys()].filter(id => !referenziert.has(id));
    if (!verwaist.length) return;
    for (const id of verwaist) await fotoBlobs.loeschen(id);
    console.info('Blob-Bereinigung: ' + verwaist.length + ' verwaiste Foto(s) entfernt.');
  } catch (e) { console.warn('Blob-Bereinigung fehlgeschlagen:', e); }
}

// ============================================================
// AUTO-SAVE: Debounce + Indikator
// ============================================================
let isLoading = false;   // Verhindert Auto-Save während des Ladens eines Standorts
let _autoSaveTimer = null;

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function showAutoSaved() {
  const badge = document.getElementById('autosave-badge');
  if (!badge) return;
  badge.style.opacity = '1';
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => { badge.style.opacity = '0'; }, 1800);
}

const debouncedSaveComment = debounce(() => { if (!isLoading) saveComment(); }, 600);
const debouncedSaveFeld    = debounce(() => { if (!isLoading) saveFelddaten(); }, 600);
const debouncedSaveBsPanel = debounce(() => { if (!isLoading) saveBsPanel(); }, 600);
const debouncedSaveSicher  = debounce(() => { if (!isLoading) saveSicherheit(); }, 600);

// ============================================================
// COORDINATES  LV95 → WGS84
// ============================================================
function lv95ToWgs84(E, N) {
  // Validierung: LV95 E: 2'480'000–2'840'000, N: 1'070'000–1'300'000
  if (E < 2480000 || E > 2840000 || N < 1070000 || N > 1300000) {
    // Fallback: Schweizmitte
    return { lat: 46.8182, lng: 8.2275, invalid: true };
  }
  const e = (E - 2600000) / 1000000;
  const n = (N - 1200000) / 1000000;
  const lon10k = 2.6779094 + 4.728982*e + 0.791484*e*n + 0.1306*e*n*n - 0.0436*e*e*e;
  const lat10k = 16.9023892 + 3.238272*n - 0.270978*e*e - 0.002528*n*n - 0.0447*e*e*n - 0.0140*n*n*n;
  return { lat: lat10k*100/36, lng: lon10k*100/36 };
}

function wgs84ToLv95(lat, lng) {
  const phi = (lat * 3600 - 169028.66) / 10000;
  const lam = (lng * 3600 -  26782.5)  / 10000;
  const E = 2600072.37 + 211455.93*lam - 10938.51*lam*phi - 0.36*lam*phi*phi - 44.54*lam*lam*lam;
  const N = 1200147.07 + 308807.95*phi +   3745.25*lam*lam + 76.63*phi*phi - 194.56*lam*lam*phi + 119.79*phi*phi*phi;
  return { e: Math.round(E), n: Math.round(N) };
}
function pairCenter(p) {
  const rs   = p.rs?.e   ? p.rs   : null;
  const rks  = p.rks?.e  ? p.rks  : null;
  const fund = p.fund?.e ? p.fund : null; // Fallback für BP/AF-Paare ohne gesetztes rs
  const src = rs && rks
    ? { e: (rs.e + rks.e) / 2, n: (rs.n + rks.n) / 2 }
    : rs || rks || fund || { e: 2600000, n: 1200000 }; // Fallback: Schweiz-Mitte
  return lv95ToWgs84(src.e, src.n);
}

function initMap() {
  if (leafletMap) { updateMapToCurrentPair(); return; }

  const pair = PAIRS.find(p => p.id === currentPairId);
  const center = pairCenter(pair);
  const zoom = center.invalid ? 8 : 19;

  leafletMap = L.map('map', { zoomControl: true, ...KARTE_DREH_OPT }).setView([center.lat, center.lng], zoom);
  karteDrehungAnmelden(leafletMap);

  // Basis-Karte setzen
  setDetailBaseLayer(detailBaseLayerKey);

  // Bahnlinien sind standardmässig an (App-Einstellungen › Kartendarstellung)
  if (typeof bahnStandardAnwenden === 'function') setTimeout(() => bahnStandardAnwenden('detail'), 60);

  // Klick auf Karte → Parzellen-Info (nur wenn Parzellenabfrage aktiv)
  leafletMap.on('click', (e) => {
    if (currentMode !== 'pan' || !parcelQueryActive) return;
    queryParcelInfo(e.latlng);
  });

  // Rechtsklick → Karten-Kontextmenü
  leafletMap.on('contextmenu', (e) => {
    if (currentMode !== 'pan') return;
    L.DomEvent.preventDefault(e.originalEvent);
    const rect = leafletMap.getContainer().getBoundingClientRect();
    showMapCtxMenu('detail', e.latlng, rect.left + e.containerPoint.x, rect.top + e.containerPoint.y);
  });

  addMarkers(pair);
  initSketchCanvas();
  redrawSketch();
}

function cardTileUrl(pair) {
  // MapServer-Export mit exakt zentrierter bbox auf RS/RKS-Mittelpunkt (LV95)
  const center = pairCenter(pair);
  const lv = wgs84ToLv95(center.lat, center.lng);
  const r = 80; // Radius in Metern → 160 × 160 m Ausschnitt
  const bbox = `${lv.e - r},${lv.n - r},${lv.e + r},${lv.n + r}`;
  return `https://api.geo.admin.ch/rest/services/api/MapServer/export?bbox=${bbox}&bboxSR=2056&layers=show:ch.swisstopo.swissimage&size=320,320&format=png&f=image`;
}

// ============================================================

