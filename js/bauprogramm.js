// BAUPROGRAMM-TAB — Datenmodell
// ============================================================
const BP_PAKET_KEY   = () => 'sp_baupakete__'   + _activeId;
const PROJ_EINST_KEY = () => 'sp_proj_einst__'  + _activeId;
const SCHICHT_ZUW_KEY= () => 'sp_schicht_zuw__' + _activeId;

function loadBaupakete()          { try { return jsonParse(store.getItem(BP_PAKET_KEY()))    || []; } catch { return []; } }
function saveBaupakete(list)      { bpSnapshotBeforeChange(); store.setItem(BP_PAKET_KEY(),    JSON.stringify(list)); }
function loadProjEinst()          { try { return jsonParse(store.getItem(PROJ_EINST_KEY()))  || {}; } catch { return {}; } }
function saveProjEinst(obj)       { store.setItem(PROJ_EINST_KEY(),  JSON.stringify(obj)); }
function loadSchichtZuw()         { try { return jsonParse(store.getItem(SCHICHT_ZUW_KEY())) || {}; } catch { return {}; } }
function saveSchichtZuw(obj)      { bpSnapshotBeforeChange(); store.setItem(SCHICHT_ZUW_KEY(), JSON.stringify(obj)); }

// Separater Store für Abbruch-Zeilen bei abbruch-neubau Paaren
const ABBRUCH_ZUW_KEY = () => 'sp_abbruch_zuw__' + _activeId;
function loadAbbZuw()  { try { return jsonParse(store.getItem(ABBRUCH_ZUW_KEY())) || {}; } catch { return {}; } }
function saveAbbZuw(o) { bpSnapshotBeforeChange(); store.setItem(ABBRUCH_ZUW_KEY(), JSON.stringify(o)); }

// In welchem Store liegt die ABBRUCH-Zuweisung eines Standorts?
//   'abb' → sp_abbruch_zuw__ : Abbruch+Neubau-Paare haben zwei Zeilen und damit
//                              zwei unabhaengige Zuweisungen; die Abbruch-Zeile
//                              lebt im eigenen Store (siehe saveBpAbbZuweisung).
//   'zuw' → sp_schicht_zuw__ : reine Abbrueche ('abbruch-nur') haben nur eine
//                              Zeile und nutzen die normale Schichtzuweisung.
// Render (Gantt/Tabelle) und Drag muessen dieselbe Regel anwenden, sonst zeigt
// der Balken das Neubau-Datum und verschiebt beim Ziehen den Neubau-Termin.
function bpAbbZuwStore(pairId, allBpData) {
  return (allBpData || loadAllBauprojekt())[pairId]?.massnahme === 'abbruch' ? 'abb' : 'zuw';
}

// Fuehrt die alten Ein-Zeilen-Stores in die normale Schichtzuweisung zusammen.
// sp_abbruch_zuw__ gehoert NICHT dazu: dieser Store ist aktiv und haelt die
// zweite Zuweisung der Abbruch+Neubau-Paare. Solange er hier mitlief, wurde er
// bei jedem Render geloescht — und da zuw[pid] durch die Neubau-Zeile bereits
// belegt ist, ging die Abbruch-Zuweisung dabei ersatzlos verloren.
function migrateZuwStores() {
  const zuw = loadSchichtZuw();
  let changed = false;
  ['sp_sicherung_zuw__', 'sp_prov_zuw__'].forEach(prefix => {
    const raw = store.getItem(prefix + _activeId);
    if (!raw) return;
    try {
      const old = jsonParse(raw);
      Object.entries(old).forEach(([pid, v]) => { if (!zuw[pid]) { zuw[pid] = v; changed = true; } });
      store.removeItem(prefix + _activeId);
    } catch {}
  });
  if (changed) saveSchichtZuw(zuw);
}

// Bestimmt den Paarkategorie-Typ für Bauprogramm-Logik
function getPairBpTyp(pairId, allBpData) {
  const bp = allBpData[pairId] || {};
  if (bp.bestand === 'prov') return 'provisorium';
  const m = bp.massnahme;
  if (m === 'erhalten')    return 'erhalten';
  if (m === 'sicherung')   return 'sicherung';
  if (m === 'abbruch-nur') return 'abbruch';
  if (m === 'abbruch')     return 'abbruch-neubau';
  return 'neubau';
}

const BAUGRUPPEN_KEY = () => 'sp_baugruppen__' + _activeId;
function loadBaugruppen()         { try { return jsonParse(store.getItem(BAUGRUPPEN_KEY())) || []; } catch { return []; } }
// Snapshot wie bei den uebrigen bp-Stores: bpCaptureSnapshot() sichert die
// Baugruppen mit, ohne den Snapshot hier ginge eine Baugruppen-Aenderung beim
// naechsten Undo verloren.
function saveBaugruppen(list)     { bpSnapshotBeforeChange(); store.setItem(BAUGRUPPEN_KEY(), JSON.stringify(list)); }

// Baugruppen-Daten (Betoniertermin/Ausschaltermin) aus aktuellen Schichtzuweisungen neu berechnen
function _recalcBaugruppenDates() {
  const gruppen = loadBaugruppen();
  if (!gruppen.length) return;
  const zuw    = loadSchichtZuw();
  const pakete = loadBaupakete();
  const einst  = loadProjEinst();
  let changed  = false;
  gruppen.forEach(grp => {
    let maxDate = '';
    let letzteZ = null;
    (grp.pairIds || []).forEach(pid => {
      const z = zuw[pid];
      if (!z?.paketId || !z?.schichtNr) return;
      const d = bpSchichtDatum(z.paketId, z.schichtNr, pakete);
      if (d && d > maxDate) { maxDate = d; letzteZ = z; }
    });
    if (!maxDate) return;
    const betonD  = bpFmtDate(bpAddDays(bpParseDate(maxDate), 1));
    const ausschal = bpFmtDate(bpAddDays(bpParseDate(betonD), bpAushaerteTage(letzteZ, einst, pakete)));
    if (grp.betoniertermin !== betonD || grp.ausschaltermin !== ausschal) {
      grp.betoniertermin = betonD;
      grp.ausschaltermin = ausschal;
      changed = true;
    }
  });
  if (changed) saveBaugruppen(gruppen);
}

const MEILENSTEINE_KEY = () => 'sp_meilensteine__' + _activeId;
function loadMeilensteine()       { try { return jsonParse(store.getItem(MEILENSTEINE_KEY())) || []; } catch { return []; } }
function saveMeilensteine(list)   { bpSnapshotBeforeChange(); store.setItem(MEILENSTEINE_KEY(), JSON.stringify(list)); }

// ── Undo / Redo ───────────────────────────────────────────────
const _bpUndoStack = [];
const _bpRedoStack = [];
const BP_UNDO_MAX  = 30;
let   _bpSnapshotThisTick = false;

function bpCaptureSnapshot() {
  return {
    pakete:    store.getItem(BP_PAKET_KEY())    || '[]',
    zuw:       store.getItem(SCHICHT_ZUW_KEY()) || '{}',
    abbZuw:    store.getItem(ABBRUCH_ZUW_KEY()) || '{}',
    ms:        store.getItem(MEILENSTEINE_KEY())|| '[]',
    einst:     store.getItem(PROJ_EINST_KEY())  || '{}',
    baugruppen:store.getItem(BAUGRUPPEN_KEY())  || '[]',
  };
}

function bpRestoreSnapshot(snap) {
  if (!snap) return;
  store.setItem(BP_PAKET_KEY(),    snap.pakete);
  store.setItem(SCHICHT_ZUW_KEY(), snap.zuw);
  if (snap.abbZuw) store.setItem(ABBRUCH_ZUW_KEY(), snap.abbZuw);
  store.setItem(MEILENSTEINE_KEY(),snap.ms);
  store.setItem(PROJ_EINST_KEY(),  snap.einst);
  store.setItem(BAUGRUPPEN_KEY(),  snap.baugruppen);
}

function bpSnapshotBeforeChange() {
  if (_bpSnapshotThisTick) return;
  _bpSnapshotThisTick = true;
  setTimeout(() => { _bpSnapshotThisTick = false; }, 0);
  const snap = bpCaptureSnapshot();
  _bpUndoStack.push(snap);
  if (_bpUndoStack.length > BP_UNDO_MAX) _bpUndoStack.shift();
  _bpRedoStack.length = 0;
  _bpUpdateUndoRedoBtns();
}

function _bpUpdateUndoRedoBtns() {
  const u = document.getElementById('bp-undo-btn');
  const r = document.getElementById('bp-redo-btn');
  if (u) u.disabled = _bpUndoStack.length === 0;
  if (r) r.disabled = _bpRedoStack.length === 0;
}

function bpUndo() {
  if (!_bpUndoStack.length) return;
  _bpRedoStack.push(bpCaptureSnapshot());
  bpRestoreSnapshot(_bpUndoStack.pop());
  _bpUpdateUndoRedoBtns();
  renderBauprogrammTab();
}

function bpRedo() {
  if (!_bpRedoStack.length) return;
  _bpUndoStack.push(bpCaptureSnapshot());
  bpRestoreSnapshot(_bpRedoStack.pop());
  _bpUpdateUndoRedoBtns();
  renderBauprogrammTab();
}

// Keyboard shortcut Ctrl+Z / Ctrl+Y für Undo/Redo
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
    e.preventDefault(); bpUndo();
  } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
    e.preventDefault(); bpRedo();
  }
});

// Datum-Hilfsfunktionen
function bpParseDate(str)         { return str ? new Date(str + 'T00:00:00') : null; }
function bpFmtDate(d)             { if (!d) return ''; const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function bpAddDays(d, n)          { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function bpFmtDisplay(str)        { if (!str) return '—'; const d = bpParseDate(str); return d.toLocaleDateString('de-CH',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function bpDayDiff(a, b)          { return Math.round((bpParseDate(b) - bpParseDate(a)) / 86400000); }

// Paket-Enddatum (letzte tatsächliche Arbeitsnacht, Sperrmuster-bewusst)
function bpPaketEnd(pak) {
  if (!pak?.startDatum || !pak.anzahlNaechte) return pak?.startDatum || '';
  const schichten = bpGetSchichten(pak);
  if (schichten.length) return schichten[schichten.length - 1].datum;
  return bpFmtDate(bpAddDays(bpParseDate(pak.startDatum), (pak.anzahlNaechte || 1) - 1));
}

// Letzte Arbeitsschicht eines Fundaments — Grundlage der Aushärtung, solange
// kein Betoniertermin erfasst ist. Genau diese Basis nutzt auch der Fundament-
// Gantt für seinen Aushärte-Balken (betonEndD || drillEndD).
function bpFundArbeitsEnde(z, pakete) {
  if (!z) return '';
  pakete = pakete || loadBaupakete();
  if (z.bohrSchichten?.length) {
    const letzte = z.bohrSchichten[z.bohrSchichten.length - 1];
    // Bei Pfahlfundamenten folgt auf die Bohrschichten die Betonschicht
    if (z.betonSchichtNr != null) return bpSchichtDatum(letzte.paketId, z.betonSchichtNr, pakete);
    return bpSchichtDatum(letzte.paketId, letzte.schichtNr, pakete);
  }
  if (z.paketId && z.schichtNr) return bpSchichtDatum(z.paketId, z.schichtNr, pakete);
  return '';
}

// Aushärtedatum eines Fundaments: individuell gesetzter Termin, sonst
// Betoniertermin + eigene bzw. globale Aushärtezeit. Ist kein Betoniertermin
// erfasst — der Regelfall direkt nach der Auto-Zuweisung —, zählt die letzte
// Arbeitsschicht als Betonierdatum. Ohne diesen Rückfall zeigte das Bauprogramm
// gar keine Aushärtestrecke, obwohl der Fundament-Gantt sie längst darstellte.
// Massgebende Aushärtezeit eines Fundaments. Drei Stufen, die speziellere
// gewinnt: Fundament → Baupaket → Projekt. Die Paketstufe deckt Lose ab, die
// von der Regelfrist abweichen — Provisorien etwa werden früher belastet als
// konventionelle Fundamente und brauchen deshalb eine eigene Frist.
function bpAushaerteTage(z, einst, pakete) {
  if (z?.customAushaerteTage != null) return z.customAushaerteTage;
  const pakId = z?.paketId || z?.bohrSchichten?.[0]?.paketId;
  if (pakId) {
    const pak = (pakete || loadBaupakete()).find(p => p.id === pakId);
    if (pak?.aushaerteTage != null && pak.aushaerteTage !== '') return parseInt(pak.aushaerteTage, 10);
  }
  return (einst || loadProjEinst()).aushaerteTage ?? 28;
}

function bpFundAusschaltermin(z, einst, pakete) {
  if (!z) return '';
  if (z.ausschaltermin) return z.ausschaltermin;
  const basis = z.betoniertermin || bpFundArbeitsEnde(z, pakete);
  if (!basis) return '';
  const tage = bpAushaerteTage(z, einst, pakete);
  return bpFmtDate(bpAddDays(bpParseDate(basis), tage));
}

// Fertigstellung eines Pakets — bis wann es den Abschnitt tatsächlich belegt.
// bpPaketEnd liefert nur die letzte ARBEITSNACHT; das Paket ist aber erst
// abgeschlossen, wenn das zuletzt betonierte Fundament ausgehärtet ist.
function bpPaketFertig(pak, zuw, einst, pakete) {
  const arbeitsEnde = bpPaketEnd(pak);
  if (!pak?.id) return arbeitsEnde;
  zuw    = zuw    || loadSchichtZuw();
  einst  = einst  || loadProjEinst();
  pakete = pakete || loadBaupakete();
  let ende = arbeitsEnde;
  Object.values(zuw).forEach(z => {
    const gehoert = z.paketId === pak.id
      || (z.bohrSchichten || []).some(s => s.paketId === pak.id);
    if (!gehoert) return;
    const a = bpFundAusschaltermin(z, einst, pakete);
    if (a && a > ende) ende = a;   // ISO-Datum: Zeichenkettenvergleich genügt
  });
  return ende;
}

// Kaskade-Konflikt-Vorschau: gibt Array von {pak, altStart, neuStart} zurück ohne Mutation
function bpKaskadePreview(paketId, allPakete) {
  const copy    = jsonParse(JSON.stringify(allPakete));
  const before  = Object.fromEntries(allPakete.map(p => [p.id, p.startDatum]));
  _bpKaskadeApply(paketId, copy);
  return copy.filter(p => p.startDatum && p.startDatum !== before[p.id])
    .map(p => ({ pak: p, altStart: before[p.id], neuStart: p.startDatum }));
}

// Referenzdatum eines Vorgängerpakets für Terminabhängigkeiten.
// «Ende» meint die FERTIGSTELLUNG inkl. Aushärtung: ein Folgepaket am selben
// Abschnitt kann erst beginnen, wenn ausgeschalt ist. EINE Definition, damit
// Kaskade, Modal-Vorschau, Meilensteine und Auto-Erzeugung nicht auseinander-
// laufen — vorher rechnete jede Stelle für sich mit der letzten Arbeitsnacht.
function bpPaketRefDatum(pak, refPunkt) {
  if (!pak) return null;
  return refPunkt === 'start' ? pak.startDatum : bpPaketFertig(pak);
}

// Prüft, ob `vorgaengerId` als Vorgänger von `paketId` einen Zyklus ergäbe:
// läuft die Vorgängerkette hoch und schaut, ob sie zu paketId zurückführt.
function bpWuerdeZyklusErzeugen(paketId, vorgaengerId, allPakete) {
  if (!paketId || !vorgaengerId) return false;
  if (paketId === vorgaengerId) return true;
  const liste = allPakete || loadBaupakete();
  const besucht = new Set();
  let cur = liste.find(p => p.id === vorgaengerId);
  while (cur && cur.vorgaengerId && !besucht.has(cur.id)) {
    besucht.add(cur.id);
    if (cur.vorgaengerId === paketId) return true;
    cur = liste.find(p => p.id === cur.vorgaengerId);
  }
  return false;
}

// Versatz eines Nachfolgers gegenüber seinem Vorgänger, in Tagen.
//
// Bei Referenzpunkt «Ende» kommt ein Tag hinzu: der Nachfolger kann frühestens
// am Tag nach der Fertigstellung beginnen. Bei «Start» und bei Meilensteinen
// gilt der eingestellte Versatz unverändert — ein Meilenstein ist ein Zeitpunkt
// und keine Dauer, dort wirkte der stille Zusatztag wie ein Rechenfehler:
// «Abbruch 0 Tage nach FL-Montage» ergab den Folgetag.
// Mastbezeichnungen natürlich vergleichen: «FS T2» vor «FS T10».
// parseInt('FS T1') ergibt NaN — die Sortierung «Mast-Nr.» verglich deshalb
// überall 0 gegen 0 und liess die Reihenfolge unverändert.
function bpMastVergleich(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''), 'de', { numeric: true, sensitivity: 'base' });
}

function bpVorgaengerVersatz(nachfolger, useStart, istMeilenstein) {
  const abstand = nachfolger?.mindestAbstand || 0;
  return (useStart || istMeilenstein) ? abstand : 1 + abstand;
}

// Terminkaskade: schiebt Nachfolger auf ihren frühestmöglichen Start.
//
// `einrasten` unterscheidet die beiden Aufrufarten und war früher der einzige
// Unterschied zwischen zwei sonst identischen Kopien (bpKaskade und
// _bpKaskadeApply). Zwei Fassungen derselben Terminlogik konnten auseinander-
// laufen, ohne dass es auffällt:
//   true  — echte Anwendung: der Start rastet auf eine Sperrmuster-Nacht ein.
//   false — Vorschau auf einer Kopie: das rohe Datum genügt, und das Einrasten
//           würde die Vorschau von zufälligen Sperrmuster-Daten abhängig machen.
//
// `besucht` bricht Zyklen ab. Ohne diesen Schutz liefen A→B→A oder ein
// Selbstbezug in einen Stapelüberlauf (RangeError) und rissen die ganze
// Bauprogramm-Ansicht mit — reproduzierbar, nicht nur theoretisch.
function bpKaskadeLauf(paketId, allPakete, einrasten, besucht) {
  besucht = besucht || new Set();
  if (besucht.has(paketId)) return;
  besucht.add(paketId);
  const vorg = allPakete.find(p => p.id === paketId);
  if (!vorg) return;
  allPakete.filter(p => p.vorgaengerId === paketId && p.id !== paketId).forEach(n => {
    const useStart = n.vorgaengerRefPunkt === 'start';
    const refDate  = bpParseDate(bpPaketRefDatum(vorg, useStart ? 'start' : 'ende'));
    if (!refDate) return;
    const minStart = bpAddDays(refDate, bpVorgaengerVersatz(n, useStart));
    const curStart = bpParseDate(n.startDatum);
    if (!curStart || curStart < minStart) {
      const roh = bpFmtDate(minStart);
      n.startDatum = einrasten ? (bpSnapToSperrmuster(roh, null) || roh) : roh;
      bpKaskadeLauf(n.id, allPakete, einrasten, besucht);
    }
  });
}

function _bpKaskadeApply(paketId, allPakete, besucht) {
  bpKaskadeLauf(paketId, allPakete, false, besucht);
}

// Delta-Kaskade: verschiebt alle transitiven Nachfolger um denselben Offset (Drag & Drop)
// Kaskadiert auch durch Meilensteine: Pakete die via «nach-paket»-Meilenstein abhängen werden mitgezogen.
function bpKaskadeDelta(paketId, deltaDays, allPakete, besucht) {
  if (!deltaDays) return;
  besucht = besucht || new Set();
  if (besucht.has(paketId)) return;   // Zyklusschutz, siehe _bpKaskadeApply
  besucht.add(paketId);
  // Direkte Paket-Nachfolger
  allPakete.filter(p => p.vorgaengerId === paketId && p.id !== paketId).forEach(n => {
    const cur = bpParseDate(n.startDatum);
    if (cur) {
      n.startDatum = bpFmtDate(bpAddDays(cur, deltaDays));
      bpKaskadeDelta(n.id, deltaDays, allPakete, besucht);
    }
  });
  // Meilensteine die dieses Paket als Vorgänger haben → deren abhängige Pakete mitziehen
  loadMeilensteine()
    .filter(ms => ms.abh?.typ === 'nach-paket' && ms.abh?.referenzId === paketId)
    .forEach(ms => bpMsKaskadeDelta(ms.id, deltaDays, allPakete));
}

// Vorgänger-Abhängigkeit im Modal: Start-Datum berechnen und ausgrauen
function bpVorgaengerChanged() {
  const vorgId  = document.getElementById('bp-pak-vorgaenger')?.value || '';
  const abstand = parseInt(document.getElementById('bp-pak-abstand')?.value) || 0;
  const startFld = document.getElementById('bp-pak-start');
  const infoDiv  = document.getElementById('bp-pak-start-info');
  const lbl      = document.getElementById('bp-pak-start-label');
  if (!startFld) return;

  if (!vorgId) {
    startFld.disabled = false;
    startFld.style.background = '';
    startFld.style.color = '';
    if (infoDiv) infoDiv.style.display = 'none';
    if (lbl) lbl.textContent = 'Startdatum (erste Nacht)';
    return;
  }

  let vorgEndStr = null, vorgLabel = '', isMsVorg = false;
  const allMs = loadMeilensteine();
  const ms = allMs.find(m => m.id === vorgId);
  const refWrap = document.getElementById('bp-pak-vorg-ref-wrap');
  const refPunkt = document.querySelector('input[name="bp-pak-vorg-ref"]:checked')?.value || 'ende';

  if (ms) {
    vorgEndStr = msMsResolvedDatum(ms);
    vorgLabel  = '◆ ' + (ms.label || ms.typ);
    isMsVorg   = true;
  } else {
    const pak = loadBaupakete().find(p => p.id === vorgId);
    if (pak) {
      vorgEndStr = bpPaketRefDatum(pak, refPunkt);
      vorgLabel  = pak.name;
    }
  }

  // Referenzpunkt-Auswahl nur bei Paket-Vorgänger zeigen (nicht bei Meilenstein)
  if (refWrap) refWrap.style.display = (vorgId && !isMsVorg) ? '' : 'none';

  if (vorgEndStr) {
    const offset   = bpVorgaengerVersatz({ mindestAbstand: abstand }, refPunkt === 'start', isMsVorg);
    const newStart = bpFmtDate(bpAddDays(bpParseDate(vorgEndStr), offset));
    startFld.value    = newStart;
    startFld.disabled = true;
    startFld.style.background = '#f3f4f6';
    startFld.style.color      = '#6b7280';
    if (infoDiv) {
      const refTxt    = isMsVorg ? '' : (refPunkt === 'start' ? ' (Start)' : ' (Ende inkl. Aushärtung)');
      const abstandTxt = abstand > 0 ? ` + ${abstand} Tage Versatz` : '';
      infoDiv.textContent = `Berechnet aus: ${vorgLabel}${refTxt}${abstandTxt}`;
      infoDiv.style.display = '';
    }
    if (lbl) lbl.textContent = 'Startdatum (berechnet)';
  } else {
    startFld.disabled = false;
    startFld.style.background = '';
    if (infoDiv) infoDiv.style.display = 'none';
  }
}

// Meilenstein-Kaskade bei Drag: verschiebt alle Pakete die diesen MS als Vorgänger haben
// Pakete, die an einem Meilenstein hängen, auf dessen neues Datum setzen und
// die Kaskade weiterlaufen lassen. Speichert nur, wenn sich etwas ändert.
function bpMsNachfolgerNachziehen(msId, altDatum, neuDatum) {
  if (!neuDatum || altDatum === neuDatum) return 0;
  const pakete = loadBaupakete();
  let geaendert = 0;
  pakete.filter(p => p.vorgaengerId === msId).forEach(p => {
    const roh  = bpFmtDate(bpAddDays(bpParseDate(neuDatum), bpVorgaengerVersatz(p, false, true)));
    const neu  = bpSnapToSperrmuster(roh, null) || roh;
    if (p.startDatum === neu) return;
    p.startDatum = neu;
    geaendert++;
    bpKaskade(p.id, pakete);
  });
  if (geaendert) saveBaupakete(pakete);
  return geaendert;
}

function bpMsKaskadeDelta(msId, deltaDays, allPakete) {
  if (!deltaDays) return;
  allPakete.filter(p => p.vorgaengerId === msId).forEach(p => {
    const cur = bpParseDate(p.startDatum);
    if (cur) {
      p.startDatum = bpFmtDate(bpAddDays(cur, deltaDays));
      bpKaskadeDelta(p.id, deltaDays, allPakete);
    }
  });
}

// ── Meilenstein Drag & Drop ───────────────────────────────────
let _bpMsDrag = null; // { msId, origDatum, startX, currentDatum, moved }

function bpMsMoveMove(e) {
  if (!_bpMsDrag) return;
  const delta = e.clientX - _bpMsDrag.startX;
  if (Math.abs(delta) > 3) _bpMsDrag.moved = true;
  if (!_bpMsDrag.moved) return;
  const deltaDays = Math.round(delta / _bpZoomColW);
  _bpMsDrag.currentDatum = bpFmtDate(bpAddDays(bpParseDate(_bpMsDrag.origDatum), deltaDays));
  const tip = document.getElementById('bp-resize-tooltip');
  if (tip) {
    tip.textContent = '◆ ' + bpFmtDisplay(_bpMsDrag.currentDatum);
    tip.style.display = 'block';
    tip.style.left = (e.clientX + 14) + 'px';
    tip.style.top  = (e.clientY - 32) + 'px';
  }
  if (_bpZoomColW > 0) {
    const wrap = document.getElementById('bp-gantt-wrap');
    if (wrap) {
      const rect   = wrap.getBoundingClientRect();
      const svgX   = e.clientX - rect.left + wrap.scrollLeft;
      const dayOff = Math.round((svgX - 112) / _bpZoomColW);
      _bpShowSnapHighlight('bp-gantt-wrap', 112 + dayOff * _bpZoomColW, _bpZoomColW);
    }
  }
}

function bpMsMoveEnd(e) {
  if (!_bpMsDrag) return;
  _bpHideSnapHighlight();
  const tip = document.getElementById('bp-resize-tooltip');
  if (tip) tip.style.display = 'none';
  if (_bpMsDrag.moved && _bpMsDrag.currentDatum && _bpMsDrag.currentDatum !== _bpMsDrag.origDatum) {
    const msList = loadMeilensteine();
    const ms = msList.find(m => m.id === _bpMsDrag.msId);
    if (ms) {
      const delta = Math.round((bpParseDate(_bpMsDrag.currentDatum) - bpParseDate(_bpMsDrag.origDatum)) / 86400000);
      ms.datum = _bpMsDrag.currentDatum;
      if (ms.abh) ms.abh = { typ: 'manuell', referenzId: null, offsetTage: 0 };
      saveMeilensteine(msList);
      const allPak = loadBaupakete();
      bpMsKaskadeDelta(ms.id, delta, allPak);
      saveBaupakete(allPak);
      renderBauprogrammTab();
    }
  } else if (!_bpMsDrag.moved) {
    openMeilensteinModal(_bpMsDrag.msId);
  }
  _bpMsDrag = null;
}

// Snappt ein Datum auf den nächsten gültigen Sperrmuster-Tag
// gleisNr: optionaler Gleisfilter (null = beliebiges SP akzeptiert)
function bpSnapToSperrmuster(dateStr, gleisNr) {
  if (!dateStr) return dateStr;
  const berFt = !!loadProjEinst().berücksichtigeFeiertage;
  let d = bpParseDate(dateStr);
  for (let i = 0; i < 28; i++) {
    const ds = bpFmtDate(d);
    if (berFt && chFeiertage(d.getFullYear()).has(ds)) { d = bpAddDays(d, 1); continue; }
    if (resolveSpForGleis(gleisNr || null, ds)) return ds;
    d = bpAddDays(d, 1);
  }
  return null; // Kein gültiger Tag in 28 Tagen gefunden
}

// Kaskadierung: verschiebt Nachfolger wenn Vorgänger verschoben wird
function bpKaskade(paketId, allPakete, besucht) {
  bpKaskadeLauf(paketId, allPakete, true, besucht);
}

// Schichtkapazität eines Pakets (Minuten netto, datum-getrieben ab Startdatum)
function bpSchichtKapazitaet(pak) {
  const sp    = resolveSpForPak(pak, pak?.startDatum);
  const einst = loadProjEinst();
  if (!sp?.nettoH) return null;
  return sp.nettoH * 60 - (einst.abzugMinuten || 0);
}

// Schicht-Bedarf und summierte Leistung für ein Baupaket
// bedarf     = total benötigte Schichten, aufgerundet
// bedarfRoh  = ungerundeter Bedarf (für Tooltip/Diagnose)
// kapSum     = Summe der Leistungswerte (Fundamente/Schicht, aufaddiert)
// cnt        = Anzahl zugewiesener Standorte
//
// Ein Fundament belegt 1/Leistung einer Schicht, nicht eine ganze. Bei 3
// Fund./Schicht brauchen 17 Fundamente 6 Nächte, nicht 17. Deshalb werden die
// Anteile zuerst summiert und erst die Summe aufgerundet. Pfahlfundamente
// zählen weiter ganzzahlig — ihre Bohrschichten teilen sich niemand.
function bpPaketBedarf(pakId) {
  const pakete = loadBaupakete();
  const pak    = pakete.find(p => p.id === pakId);
  if (!pak) return { bedarf: 0, bedarfRoh: 0, kapSum: 0, cnt: 0 };
  const zuwAll = loadSchichtZuw();
  const ftZuw  = loadFtZuweisungen();
  const ftAll  = loadFtProfile();
  const sp     = resolveSpForPak(pak, pak?.startDatum);
  const einst  = loadProjEinst();
  const pairs  = getFilteredSorted();
  let bedarfGanz = 0, bedarfAnteil = 0, kapSum = 0, cnt = 0;
  pairs.forEach(p => {
    const z = zuwAll[p.id];
    if (z?.paketId !== pakId) return;
    cnt++;
    if (z.isPfahlFund && z.bohrSchichten?.length) {
      bedarfGanz += z.bohrSchichten.length;
      kapSum += 1;
      return;
    }
    let   ft  = ftAll.find(t => t.id === ftZuw[p.id]);
    if (!ft) { const allBpFb = loadAllBauprojekt(); const fb = (allBpFb[p.id]||{}).fundtyp||''; if (fb) ft = _findFtInCache(ftAll, fb); }
    const kap = sp?.nettoH ? getFtLeistung(ft, sp.nettoH, einst.abzugMinuten) : null;
    if (kap && kap > 0) {
      bedarfAnteil += 1 / kap;
      kapSum += kap;
    } else {
      bedarfAnteil += 1;
      kapSum += 1;
    }
  });
  const bedarfRoh = bedarfGanz + bedarfAnteil;
  // 1e-9 fängt Rundungsreste ab: 3 × (1/3) ergibt 1.0000000000000002 → sonst 2 N.
  return { bedarf: bedarfGanz + Math.ceil(bedarfAnteil - 1e-9), bedarfRoh, kapSum, cnt };
}

// Nächte-Bedarf einer Fundamentgruppe, für die Paket-Auto-Generierung.
// Gleiche Regel wie bpPaketBedarf: Anteile summieren, erst die Summe aufrunden.
// Der Sperrmuster wird pro Fundament über dessen Gleis aufgelöst, weil in einer
// Gruppe Fundamente aus verschiedenen Gleisen liegen können.
//
// abzugMin muss derselbe Wert sein, mit dem die Zuweisung später rechnet. Stand
// hier eine 0, während die Zuweisung den Rüstabzug abzieht, fiel die Leistung
// beim Zuweisen eine Stufe tiefer aus als bei der Generierung — das Paket war
// zu kurz und Pfad 1 klemmte alle Überzähligen in die letzte Schicht.
function bpNaechteFuerPairs(pairs, ftList, ftZuw, stdSp, refDatum, fallbackProFund, abzugMin) {
  const anteil = pairs.reduce((sum, p) => {
    const ft   = ftList.find(t => t.id === ftZuw[p.id]);
    const pSp  = resolveSpForGleis(p.gleis || null, refDatum) || stdSp;
    const leis = (ft && pSp?.nettoH) ? getFtLeistung(ft, pSp.nettoH, abzugMin || 0) : null;
    return sum + (leis > 0 ? 1 / leis : fallbackProFund);
  }, 0);
  return Math.max(1, Math.ceil(anteil - 1e-9));
}

// Schichtleistung ermitteln: Profil hat Vorrang vor individuellen Werten
// Löst pfahlLeistung auf (h/Pfahl): direkt am FT oder aus zugeordnetem LP
// Bei LP-Einheit 'pro-meter' wird lp.pfahlLeistung × ft.pfahlLaenge gerechnet
function _resolvePfahlLeistung(ft) {
  if (!ft) return null;
  if (ft.pfahlLeistung) return parseFloat(ft.pfahlLeistung);
  if (ft.leistungsprofilId) {
    const lp = loadLeistungsprofile().find(p => p.id === ft.leistungsprofilId);
    if (lp?.pfahlLeistung) {
      if (lp.pfahlLeistungEinheit === 'pro-meter') {
        const laenge = parseFloat(ft.pfahlLaenge);
        return laenge > 0 ? parseFloat(lp.pfahlLeistung) * laenge : parseFloat(lp.pfahlLeistung);
      }
      return parseFloat(lp.pfahlLeistung);
    }
  }
  return null;
}

function getFtLeistung(ft, nettoH, abzugMin) {
  if (!ft || !nettoH) return null;
  const h = Math.round(nettoH);
  // Leistungsprofil auflösen (hat Vorrang vor individuellen Werten)
  let src = ft;
  let lp  = null;
  if (ft.leistungsprofilId) {
    lp = loadLeistungsprofile().find(p => p.id === ft.leistungsprofilId);
    if (lp) src = lp;
  }
  // Expliziter Tabellenwert hat höchste Priorität
  if (src.ftLeistungen?.[h] != null) return src.ftLeistungen[h];
  // Mehrpfahl: Schichtkapazität aus Pfahl-Kalkulation (FT oder LP)
  const pfahlLeistung = ft.pfahlLeistung || lp?.pfahlLeistung;
  if (ft.fundamentArt === 'mehrpfahl' && pfahlLeistung && parseInt(ft.anzahlPfaehle) > 0) {
    const mockFt = { ...ft, pfahlLeistung };
    const calc = _calcPfahlSchichten(mockFt, nettoH, abzugMin || 0);
    if (calc?.total > 0) {
      const raw = 1 / calc.total;
      return raw >= 1 ? Math.floor(raw) : Math.round(raw * 10) / 10;
    }
  }
  // Auto-Berechnung aus Ausführungsdauer
  if (!src.ftIntervall) return null;
  const effMin = Math.max(0, nettoH * 60 - (abzugMin || 0));
  const raw = effMin / (src.ftIntervall * 60);
  return raw >= 1 ? Math.floor(raw) : Math.round(raw * 10) / 10;
}

// Alle Schicht-Daten eines Pakets generieren
// Gleise werden aus zugewiesenen Fundamenten abgeleitet (pro Fundament: p.gleis).
// Falls keine Gleisinfo bekannt (noch nicht zugewiesen): beliebiges Sperrmuster akzeptiert (Fallback).
function bpGetSchichten(pak) {
  if (!pak?.startDatum || !pak.anzahlNaechte) return [];
  const berFt = !!loadProjEinst().berücksichtigeFeiertage;
  let feiertage = new Set();
  if (berFt) {
    const yr = bpParseDate(pak.startDatum).getFullYear();
    chFeiertage(yr).forEach(d => feiertage.add(d));
    chFeiertage(yr + 1).forEach(d => feiertage.add(d));
  }

  // Gleise aus zugewiesenen Fundamenten ableiten (alle Pakettypen: NB, Abbruch, Sicherung, Prov)
  // Stufe 1: Zuweisungen vorhanden → Gleise der zugewiesenen Fundamente (p.gleis)
  // Stufe 2: keine Zuweisungen → kein Gleisfilter (beliebiges SP, Fallback)
  const zuw = loadSchichtZuw();
  const gleise = [...new Set(
    Object.entries(zuw)
      .filter(([, z]) => z.paketId === pak.id)
      .map(([pid]) => PAIRS.find(p => p.id === Number(pid))?.gleis)
      .filter(Boolean)
  )];
  // gleise leer → resolveNight nutzt beliebiges SP (Fallback bei noch nicht zugewiesenen Paketen)

  // Nacht gültig wenn IRGEND EIN Gleis ein Sperrmuster hat (oder beliebig wenn keine Gleise bekannt)
  const resolveNight = ds => {
    if (!gleise.length) return resolveSpForGleis(null, ds);
    for (const g of gleise) {
      const sp = resolveSpForGleis(g, ds);
      if (sp) return sp;
    }
    return null;
  };

  const result  = [];
  const maxDays = pak.anzahlNaechte * 7 + 56;
  let calDay = 0;
  while (result.length < pak.anzahlNaechte && calDay < maxDays) {
    const d  = bpAddDays(bpParseDate(pak.startDatum), calDay++);
    const ds = bpFmtDate(d);
    if (berFt && feiertage.has(ds)) continue;
    const sp = resolveNight(ds);
    if (!sp) continue;
    result.push({ schichtNr: result.length + 1, datum: ds, spId: sp.id, nettoH: sp.nettoH });
  }
  return result;
}

// Datum einer konkreten Schicht ermitteln (Sperrmuster-bewusst)
function bpSchichtDatum(paketId, schichtNr, paketeList) {
  const pak = (paketeList || loadBaupakete()).find(p => p.id === paketId);
  if (!pak?.startDatum) return null;
  const schichten = bpGetSchichten(pak);
  const s = schichten.find(s => s.schichtNr === schichtNr);
  if (s) return s.datum;
  return bpFmtDate(bpAddDays(bpParseDate(pak.startDatum), (schichtNr || 1) - 1));
}

// Prüft ob ein Standort ein Mehrpfahlfundament ist
function bpIstMehrpfahl(pairId) {
  const ftId = loadFtZuweisungen()[pairId];
  const ft   = loadFtProfile().find(t => t.id === ftId);
  return !!(ft?.fundamentArt === 'mehrpfahl' && parseInt(ft.anzahlPfaehle) > 0);
}

// Pile-Schichten berechnen: Bohr-Schichten + Beton-Schichten
// Returns { bohrShifts, betonShifts, pilesPerShift } or null if insufficient data
// Warnzeichen INNERHALB eines SVG. Ein Inline-<svg> ist hier nicht möglich,
// darum dieselbe Pfadform als Gruppe, auf die gewünschte Kantenlänge skaliert.
// yBasis ist die frühere Textgrundlinie — die Gruppe wird darüber gesetzt.
function _bpWarnSvg(x, yBasis, farbe, kante) {
  const k = kante || 11;
  const m = k / 24;
  return `<g transform="translate(${x},${yBasis - k + 1}) scale(${m.toFixed(3)})" fill="none" stroke="${farbe}"`
       + ` stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;">`
       + `<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>`
       + `<line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></g>`;
}

function _calcPfahlSchichten(ft, nettoH, abzugMin) {
  const anzahl = parseInt(ft.anzahlPfaehle) || 0;
  const pleis  = parseFloat(ft.pfahlLeistung) || 0;
  if (!anzahl || !pleis || !nettoH) return null;
  const effH   = Math.max(0.1, nettoH - (abzugMin || 0) / 60);
  const pilesPerShift = effH / pleis;
  const bohrShifts = Math.ceil(anzahl / pilesPerShift);
  // Ausführungsdauer für die Betonierschichten: Leistungsprofil hat Vorrang,
  // gleiche Rangfolge wie in getFtLeistung(). Hier stand nur ft.ftIntervall —
  // bei einem Pfahltyp, dessen Dauer aus dem Profil kommt (so sind die
  // Standardtypen ausgeliefert), fiel die Betonierschicht ganz weg.
  const lpIntv = ft.leistungsprofilId
    ? loadLeistungsprofile().find(p => p.id === ft.leistungsprofilId)?.ftIntervall
    : null;
  const intv = lpIntv ?? ft.ftIntervall;
  const betonShifts = intv ? Math.ceil(intv / nettoH) : 0;
  return { bohrShifts, betonShifts, pilesPerShift, total: bohrShifts + betonShifts };
}

// ── Zoom-Zustand ──────────────────────────────────────────────
let _bpZoom          = 'tag'; // 'tag' | 'woche' | 'monat' | 'jahr'
let _bpFundSort      = 'datum';  // 'km' | 'datum' | 'baugruppe'
let _bpCollapsed     = new Set(); // IDs kollabierter Baugruppen
let _bpZoomColW      = 28;    // aktuell gepixelter Spaltenbreite (für Resize)
let _bpResizeDrag    = null;  // { pakId, side, startX, startNaechte, startDatum, currentNaechte, currentStart }
let _bpMoveDrag      = null;  // { pakId, origStart, startX, currentStart, moved }
let _bpFundMoveDrag  = null;  // { pairId, paketId, origSchichtNr, multiOrig, startX, currentDate, moved }
let _bpWeatherData   = null;
let _bpFundGanttRef  = { projStart: null, colW: 28, leftW: 112, zoom: 'tag' };
// WICHTIG: Diese drei halten pairIds immer als STRING. Die IDs stammen aus
// data-Attributen (getAttribute liefert Strings), waehrend pair.id im Datenmodell
// eine Zahl ist. Ohne die Vereinheitlichung schlaegt Set.has(pair.id) fehl —
// die Auswahl wird beim Neuzeichnen unsichtbar, verschiebt aber weiterhin mit.
let _bpFundSelection = new Set();  // ausgewählte pairIds (Ctrl/Shift-Selektion)
let _bpFundLastClick = null;       // letzter geklickter pairId (für Shift-Range)
let _bpFundRowOrder  = [];         // gerenderte Reihenfolge der pairIds (für Range)

// Schweizer Bundesfeiertage (fix + bewegliche)
function chFeiertage(year) {
  const fixed = [
    `${year}-01-01`, `${year}-08-01`, `${year}-12-25`, `${year}-12-26`,
  ];
  // Osterberechnung (Gregorianisch)
  const a=year%19, b=Math.floor(year/100), c=year%100, d=Math.floor(b/4), e=b%4,
        f=Math.floor((b+8)/25), g=Math.floor((b-f+1)/3), h=(19*a+b-d-g+15)%30,
        i=Math.floor(c/4), k=c%4, l=(32+2*e+2*i-h-k)%7, m=Math.floor((a+11*h+22*l)/451),
        mo=Math.floor((h+l-7*m+114)/31), dy=((h+l-7*m+114)%31)+1;
  const easter = new Date(year, mo-1, dy);
  const add = n => bpFmtDate(bpAddDays(easter, n));
  return new Set([...fixed, add(-2), add(0), add(1), add(39), add(49), add(50)]);
}


// ── Drag-Snap-Highlight ───────────────────────────────────────
function _bpShowSnapHighlight(wrapId, colX, colW) {
  let hl = document.getElementById('bp-snap-hl');
  if (!hl) {
    hl = document.createElement('div');
    hl.id = 'bp-snap-hl';
    hl.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;background:rgba(59,130,246,0.18);border-left:2px solid rgba(59,130,246,0.7);border-right:2px solid rgba(59,130,246,0.7);top:0;height:100vh;transition:left 0.05s,width 0.05s;';
    document.body.appendChild(hl);
  }
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  hl.style.display = 'block';
  hl.style.left    = (rect.left + colX - wrap.scrollLeft) + 'px';
  hl.style.width   = colW + 'px';
  hl.style.top     = rect.top + 'px';
  hl.style.height  = rect.height + 'px';
  document.body.style.cursor = 'grabbing';
}

function _bpHideSnapHighlight() {
  const hl = document.getElementById('bp-snap-hl');
  if (hl) hl.style.display = 'none';
  document.body.style.cursor = '';
}

// ── Alle Schichtzuweisungen zurücksetzen ──────────────────────
function resetAllSchichtZuw() {
  saveSchichtZuw({});
  saveBaugruppen([]);
  renderBauprogrammTab();
}

function openBpResetModal() {
  const modal = document.getElementById('bp-reset-modal');
  if (!modal) return;
  // Checkboxen auf Standardwerte zurücksetzen
  const zuw = document.getElementById('bp-rst-zuw');
  const pak = document.getElementById('bp-rst-pak');
  const ms  = document.getElementById('bp-rst-ms');
  if (zuw) zuw.checked = true;
  if (pak) pak.checked = true;
  if (ms)  ms.checked  = true;
  modal.style.display = 'flex';
}

function closeBpResetModal() {
  const modal = document.getElementById('bp-reset-modal');
  if (modal) modal.style.display = 'none';
}

async function executeBpReset() {
  const delZuw = document.getElementById('bp-rst-zuw')?.checked;
  const delPak = document.getElementById('bp-rst-pak')?.checked;
  const delMs  = document.getElementById('bp-rst-ms')?.checked;
  if (!delZuw && !delPak && !delMs) { closeBpResetModal(); return; }
  const parts = [
    delZuw && 'Schichtzuweisungen',
    delPak && 'Baupakete & Lose',
    delMs  && 'Meilensteine',
  ].filter(Boolean).join(', ');
  if (!await ui.confirm(`Folgendes wird unwiderruflich gelöscht:\n· ${parts}\n\nFortfahren?`,
                        { gefaehrlich: true, ok: 'Löschen' })) return;
  if (delZuw) { saveSchichtZuw({}); saveBaugruppen([]); }
  if (delPak) saveBaupakete([]);
  if (delMs)  saveMeilensteine([]);
  closeBpResetModal();
  renderBauprogrammTab();
}

function bpResizeMove(e) {
  if (!_bpResizeDrag) return;
  const delta      = e.clientX - _bpResizeDrag.startX;
  const daysPerCol = { tag: 1, woche: 7, monat: 30, jahr: 365 }[_bpZoom] || 1;
  const deltaDays  = Math.round(delta / _bpZoomColW) * daysPerCol;
  const tip = document.getElementById('bp-resize-tooltip');

  if (_bpResizeDrag.side === 'left') {
    // Linker Handle: startDatum verschiebt sich, Länge passt sich an
    const newOffset  = Math.min(deltaDays, _bpResizeDrag.startNaechte - 1); // Start darf nicht nach Ende
    const newNaechte = Math.max(1, _bpResizeDrag.startNaechte - newOffset);
    const newStart   = bpFmtDate(bpAddDays(bpParseDate(_bpResizeDrag.startDatum), newOffset));
    _bpResizeDrag.currentNaechte = newNaechte;
    _bpResizeDrag.currentStart   = newStart;
    if (tip) {
      tip.textContent = bpFmtDisplay(newStart) + ' · ' + newNaechte + ' Nächte';
    }
  } else {
    // Rechter Handle: Länge (anzahlNaechte) ändern
    const newNaechte = Math.max(1, _bpResizeDrag.startNaechte + deltaDays);
    _bpResizeDrag.currentNaechte = newNaechte;
    _bpResizeDrag.currentStart   = _bpResizeDrag.startDatum;
    if (tip) {
      const newEnd = bpFmtDate(bpAddDays(bpParseDate(_bpResizeDrag.startDatum), newNaechte - 1));
      tip.textContent = newNaechte + ' Nächte · bis ' + bpFmtDisplay(newEnd);
    }
  }
  if (tip) {
    tip.style.display = 'block';
    tip.style.left = (e.clientX + 14) + 'px';
    tip.style.top  = (e.clientY - 32) + 'px';
  }
  // Snap-Highlight: Spaltenstreifen am aktuellen Maus-X
  if (_bpZoomColW > 0) {
    const wrap = document.getElementById('bp-gantt-wrap');
    if (wrap) {
      const rect   = wrap.getBoundingClientRect();
      const svgX   = e.clientX - rect.left + wrap.scrollLeft;
      const LEFT_W = 120;
      const dayOff = Math.round((svgX - LEFT_W) / _bpZoomColW);
      const colX   = LEFT_W + dayOff * _bpZoomColW;
      _bpShowSnapHighlight('bp-gantt-wrap', colX, _bpZoomColW);
    }
  }
}

function bpResizeEnd(e) {
  if (!_bpResizeDrag) return;
  _bpHideSnapHighlight();
  const tip = document.getElementById('bp-resize-tooltip');
  if (tip) tip.style.display = 'none';
  const changed = _bpResizeDrag.currentNaechte !== _bpResizeDrag.startNaechte
    || (_bpResizeDrag.currentStart && _bpResizeDrag.currentStart !== _bpResizeDrag.startDatum);
  if (changed) {
    const allPak = loadBaupakete();
    const pak    = allPak.find(p => p.id === _bpResizeDrag.pakId);
    if (pak) {
      const oldEnd     = bpPaketEnd(pak);
      pak.anzahlNaechte = _bpResizeDrag.currentNaechte;
      if (_bpResizeDrag.currentStart) pak.startDatum = _bpResizeDrag.currentStart;
      const newEnd     = bpPaketEnd(pak);
      const deltaEnd   = oldEnd && newEnd ? Math.round((bpParseDate(newEnd) - bpParseDate(oldEnd)) / 86400000) : 0;
      const deltaStart = _bpResizeDrag.currentStart
        ? Math.round((bpParseDate(_bpResizeDrag.currentStart) - bpParseDate(_bpResizeDrag.startDatum)) / 86400000) : 0;
      // Nachfolger-Pakete kaskadieren
      bpKaskade(pak.id, allPak);
      // Meilensteine mit nach-paket-Abhängigkeit kaskadieren (Ende oder Start verschoben)
      if (deltaEnd || deltaStart) {
        loadMeilensteine().filter(m => m.abh?.typ === 'nach-paket' && m.abh?.referenzId === pak.id)
          .forEach(ms => {
            const d = ms.abh.refPunkt === 'start' ? deltaStart : deltaEnd;
            if (d) bpMsKaskadeDelta(ms.id, d, allPak);
          });
      }
      saveBaupakete(allPak);
      // SchichtNr klemmen: Zuweisungen die nach Reduktion über anzahlNaechte liegen → auf Maximum setzen
      if (_bpResizeDrag.currentNaechte < _bpResizeDrag.startNaechte) {
        const allZuw = loadSchichtZuw();
        let zuwChanged = false;
        Object.values(allZuw).forEach(z => {
          if (!z || z.paketId !== pak.id) return;
          if (z.schichtNr > pak.anzahlNaechte) { z.schichtNr = pak.anzahlNaechte; zuwChanged = true; }
          z.bohrSchichten?.forEach(bs => {
            if (bs.paketId === pak.id && bs.schichtNr > pak.anzahlNaechte) { bs.schichtNr = pak.anzahlNaechte; zuwChanged = true; }
          });
        });
        if (zuwChanged) saveSchichtZuw(allZuw);
      }
      renderBauprogrammTab();
    }
  }
  _bpResizeDrag = null;
}

function bpMoveMove(e) {
  if (!_bpMoveDrag) return;
  const delta      = e.clientX - _bpMoveDrag.startX;
  if (Math.abs(delta) > 3) _bpMoveDrag.moved = true;
  if (!_bpMoveDrag.moved) return;
  const daysPerCol = { tag: 1, woche: 7, monat: 30, jahr: 365 }[_bpZoom] || 1;
  const deltaDays  = Math.round(delta / _bpZoomColW) * daysPerCol;
  _bpMoveDrag.currentStart = bpFmtDate(bpAddDays(bpParseDate(_bpMoveDrag.origStart), deltaDays));
  const tip = document.getElementById('bp-resize-tooltip');
  if (tip) {
    tip.textContent = '⟷ ' + bpFmtDisplay(_bpMoveDrag.currentStart);
    tip.style.display = 'block';
    tip.style.left = (e.clientX + 14) + 'px';
    tip.style.top  = (e.clientY - 32) + 'px';
  }
  // Snap-Highlight: Spaltenstreifen am aktuellen Maus-X
  if (_bpZoomColW > 0) {
    const wrap = document.getElementById('bp-gantt-wrap');
    if (wrap) {
      const rect   = wrap.getBoundingClientRect();
      const svgX   = e.clientX - rect.left + wrap.scrollLeft;
      const LEFT_W = 120;
      const dayOff = Math.round((svgX - LEFT_W) / _bpZoomColW);
      const colX   = LEFT_W + dayOff * _bpZoomColW;
      _bpShowSnapHighlight('bp-gantt-wrap', colX, _bpZoomColW);
    }
  }
}

function bpMoveEnd(e) {
  if (!_bpMoveDrag) return;
  _bpHideSnapHighlight();
  const tip = document.getElementById('bp-resize-tooltip');
  if (tip) tip.style.display = 'none';
  if (_bpMoveDrag.moved && _bpMoveDrag.currentStart && _bpMoveDrag.currentStart !== _bpMoveDrag.origStart) {
    const allPak = loadBaupakete();
    const pak    = allPak.find(p => p.id === _bpMoveDrag.pakId);
    if (pak) {
      const origStart  = _bpMoveDrag.origStart;
      const newStart   = bpSnapToSperrmuster(_bpMoveDrag.currentStart, null) || _bpMoveDrag.currentStart;
      const deltaDays  = Math.round((bpParseDate(newStart) - bpParseDate(origStart)) / 86400000);
      pak.startDatum   = newStart;
      bpKaskadeDelta(pak.id, deltaDays, allPak);
      // Meilensteine mit nach-paket-Abhängigkeit kaskadieren
      loadMeilensteine().filter(m => m.abh?.typ === 'nach-paket' && m.abh?.referenzId === pak.id)
        .forEach(ms => bpMsKaskadeDelta(ms.id, deltaDays, allPak));
      saveBaupakete(allPak);
      renderBauprogrammTab();
    }
  } else if (!_bpMoveDrag.moved) {
    openBaupaketModal(_bpMoveDrag.pakId);
  }
  _bpMoveDrag = null;
}

function bpFundMoveMove(e) {
  if (!_bpFundMoveDrag) return;
  _bpFundMoveDrag._lastX = e.clientX;
  _bpFundMoveDrag._lastY = e.clientY;
  const delta = e.clientX - _bpFundMoveDrag.startX;
  if (Math.abs(delta) > 3) _bpFundMoveDrag.moved = true;
  if (!_bpFundMoveDrag.moved) return;
  const ref  = _bpFundGanttRef;
  const wrap = document.getElementById('bp-fund-gantt-wrap');
  if (!wrap || !ref.projStart || !_bpFundMoveDrag.origDatum) return;

  // Zieldatum aus der ZUGDISTANZ, nicht aus der absoluten Mausposition:
  // sonst haengt das Ergebnis davon ab, wo im Balken angefasst wurde.
  // daysPerCol wie beim Paket-Drag, sonst stimmt jede Zoomstufe ausser «tag» nicht.
  const daysPerCol = { tag: 1, woche: 7, monat: 30, jahr: 365 }[ref.zoom] || 1;
  const deltaDays  = Math.round(delta / ref.colW) * daysPerCol;
  _bpFundMoveDrag.deltaDays   = deltaDays;
  _bpFundMoveDrag.currentDate = bpFmtDate(bpAddDays(bpParseDate(_bpFundMoveDrag.origDatum), deltaDays));

  const tip = document.getElementById('bp-resize-tooltip');
  if (tip) {
    const vz = deltaDays > 0 ? '+' : '';
    tip.textContent = '⟷ ' + bpFmtDisplay(_bpFundMoveDrag.currentDate)
      + (deltaDays ? '  (' + vz + deltaDays + ' Tage)' : '');
    tip.style.display = 'block';
    tip.style.left = (e.clientX + 14) + 'px';
    tip.style.top  = (e.clientY - 32) + 'px';
  }
  // Snap-Highlight auf der Spalte des Zieldatums (xFor kennt die Zoom-Umrechnung)
  if (ref.xFor) _bpShowSnapHighlight('bp-fund-gantt-wrap', ref.xFor(_bpFundMoveDrag.currentDate), ref.colW);
}

// Schicht-Nr auf nächsten gültigen Sperrmuster-Tag innerhalb Paket snappen (datum-getrieben)
function bpSnapSchichtNr(pak, nr) {
  const schichten = bpGetSchichten(pak);
  if (!schichten.length) return Math.max(1, Math.min(pak.anzahlNaechte || 1, nr));
  if (schichten.find(s => s.schichtNr === nr)) return nr;
  // Nächste gültige Schicht (vorwärts oder rückwärts)
  const maxNr = pak.anzahlNaechte || 1;
  for (let off = 1; off <= maxNr; off++) {
    if (schichten.find(s => s.schichtNr === nr + off)) return nr + off;
    if (schichten.find(s => s.schichtNr === nr - off)) return nr - off;
  }
  return schichten[0].schichtNr;
}

// Kurze Warn-Meldung neben Cursor einblenden (nicht blockierend)
// Kalenderbereiche aller Pakete einmalig aufbauen (bpPaketEnd ruft
// bpGetSchichten — das pro Fundament und Paket erneut zu tun waere teuer).
function _bpPaketBereiche(pakete) {
  return pakete
    .filter(p => p.startDatum)
    .map(p => ({ pak: p, von: p.startDatum, bis: bpPaketEnd(p) }))
    .sort((a, b) => a.von.localeCompare(b.von));
}

// In welches Paket faellt ein Datum? Das Ausgangspaket hat Vorrang, damit ein
// Zug innerhalb des eigenen Pakets nicht in ein ueberlappendes Nachbarpaket
// springt. Massgeblich ist derselbe Kalenderbereich, den auch die rote
// «ausserhalb»-Markierung im Renderer verwendet (startDatum … bpPaketEnd).
function bpPaketFuerDatum(datum, bereiche, bevorzugtId) {
  const passt = b => datum >= b.von && datum <= b.bis;
  const bevorzugt = bereiche.find(b => b.pak.id === bevorzugtId);
  if (bevorzugt && passt(bevorzugt)) return bevorzugt.pak;
  const treffer = bereiche.find(passt);
  return treffer ? treffer.pak : null;
}

function _bpWarnBubble(msg) {
  let el = document.getElementById('bp-warn-bubble');
  if (!el) {
    el = document.createElement('div');
    el.id = 'bp-warn-bubble';
    el.style.cssText = 'position:fixed;z-index:9999;background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;font-size:11px;font-weight:600;padding:5px 10px;border-radius:6px;pointer-events:none;transition:opacity 0.3s;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  el.style.left = (_bpFundMoveDrag ? (_bpFundMoveDrag._lastX || 0) + 14 : 200) + 'px';
  el.style.top  = (_bpFundMoveDrag ? (_bpFundMoveDrag._lastY || 0) - 36 : 100) + 'px';
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => { el.style.opacity = '0'; }, 1800);
}

function bpFundMoveEnd(e) {
  if (!_bpFundMoveDrag) return;
  _bpHideSnapHighlight();
  const tip = document.getElementById('bp-resize-tooltip');
  if (tip) tip.style.display = 'none';
  if (_bpFundMoveDrag.moved && _bpFundMoveDrag.currentDate) {
    const pakete    = loadBaupakete();
    const multiOrig = _bpFundMoveDrag.multiOrig || {};
    const origEntry = multiOrig[_bpFundMoveDrag.pairId];
    const origDate  = origEntry ? bpSchichtDatum(origEntry.paketId, origEntry.schichtNr, pakete) : null;
    const delta     = origDate ? bpDayDiff(origDate, _bpFundMoveDrag.currentDate) : 0;

    if (delta !== 0) {
      // Abbruch-Balken von A+N-Paaren liegen in einem eigenen Store
      const istAbbStore = _bpFundMoveDrag.zuwStore === 'abb';
      const allZuw = istAbbStore ? loadAbbZuw() : loadSchichtZuw();
      let changed = false;
      let clampedAny = false;
      const bereiche = _bpPaketBereiche(pakete);
      const wechsel  = [];   // { pid, nach } — fuer die Rueckmeldung
      let   bewegt   = 0;    // tatsaechlich veraenderte Fundamente
      Object.entries(multiOrig).forEach(([pid, orig]) => {
        const z = allZuw[pid];
        if (!z) return;
        const origBarDate = bpSchichtDatum(orig.paketId, orig.schichtNr, pakete);
        if (!origBarDate) return;
        const newBarDate = bpFmtDate(bpAddDays(bpParseDate(origBarDate), delta));

        // Faellt das Zieldatum in ein anderes Paket, wechselt das Fundament
        // dorthin und die Schichtnummer wird im Zielpaket neu bestimmt.
        // Ohne Treffer bleibt es im Ausgangspaket und wird begrenzt.
        const zielPak = bpPaketFuerDatum(newBarDate, bereiche, orig.paketId);
        const pak     = zielPak || pakete.find(pk => pk.id === orig.paketId);
        if (!pak?.startDatum) return;

        const rawNr  = bpDayDiff(pak.startDatum, newBarDate) + 1;
        const maxNr  = pak.anzahlNaechte || 1;
        if (!zielPak && (rawNr < 1 || rawNr > maxNr)) clampedAny = true;
        const clampedNr = Math.max(1, Math.min(maxNr, rawNr));
        const snappedNr = bpSnapSchichtNr(pak, clampedNr);

        let dieseGeaendert = false;
        if (pak.id !== z.paketId) { z.paketId = pak.id; dieseGeaendert = true; wechsel.push({ pid, nach: pak.name }); }
        if (snappedNr !== z.schichtNr) { z.schichtNr = snappedNr; dieseGeaendert = true; }
        if (dieseGeaendert) { changed = true; bewegt++; }
      });
      if (clampedAny) _bpWarnBubble('Ausserhalb Baupaket — auf Paketgrenze begrenzt');
      if (changed) {
        if (istAbbStore) saveAbbZuw(allZuw);
        else { saveSchichtZuw(allZuw); _recalcBaugruppenDates(); }
        renderBauprogrammTab();

        // Eine Meldung fuer die ganze Geste: Anzahl, Verschiebung, ggf. Zielpaket.
        // Erst nach dem Speichern, damit bpUndo() den Snapshot bereits kennt.
        const ziele = [...new Set(wechsel.map(w => w.nach))];
        const text  = (bewegt === 1 ? 'Fundament' : bewegt + ' Fundamente') + ' verschoben'
          + ' um ' + (delta > 0 ? '+' : '') + delta + ' Tage'
          + (ziele.length ? ' → ' + ziele.map(n => '«' + n + '»').join(', ') : '');
        ui.toast(text, 'erfolg', null, { text: 'Rückgängig', aufRuf: bpUndo });
      }
    }
  }
  _bpFundMoveDrag = null;
}

function setBpZoom(zoom) {
  _bpZoom = zoom;
  bpFundAuswahlLeeren(false);
  ['tag','woche','monat','jahr'].forEach(z => {
    // Beide Leisten stehen auf hellem Grund und tragen dieselbe Hervorhebung
    document.getElementById('bp-zoom-' + z)?.classList.toggle('aktiv', z === zoom);
    document.getElementById('bp-fs-zoom-' + z)?.classList.toggle('aktiv', z === zoom);
  });
  renderBauprogrammTab();
}

// Mini-Modal: Ausschalung / Aushärtezeit für einzelnen Standort anpassen
function openAusschalModal(pairId) {
  const zuw  = loadSchichtZuw();
  const z    = zuw[pairId] || {};
  const einst = loadProjEinst();
  const pairs = getFilteredSorted();
  const pair  = pairs.find(p => p.id == pairId) || {};
  // Vorgabe ist der Paketwert, falls das Los eine eigene Frist führt
  const defaultAT = bpAushaerteTage({ paketId: z.paketId, bohrSchichten: z.bohrSchichten }, einst);
  const curAT = z.customAushaerteTage ?? defaultAT;
  const betonD = z.betoniertermin;
  const pakName = (loadBaupakete().find(p => p.id === z.paketId) || {}).name;
  document.getElementById('ausschal-modal-title').textContent = 'Aushärtezeit · Mast ' + (pair.mast || '—');
  document.getElementById('ausschal-modal-pairid').value = pairId;
  document.getElementById('ausschal-modal-tage').value   = curAT;
  document.getElementById('ausschal-modal-default').textContent =
    'Standard: ' + defaultAT + ' Tage' + (defaultAT !== (einst.aushaerteTage ?? 28) && pakName ? ' (Los ' + pakName + ')' : '');
  document.getElementById('ausschal-modal-betoniert').textContent = betonD ? 'Betoniert: ' + bpFmtDisplay(betonD) : '';
  document.getElementById('ausschal-modal').style.display = 'flex';
}
function closeAusschalModal() {
  document.getElementById('ausschal-modal').style.display = 'none';
}
// Alle Ausschaltermine ohne individuellen Wert auf eine neue Aushärtezeit
// umrechnen. Fundamente mit customAushaerteTage bleiben unberührt, ebenso
// Lose mit eigener Frist am Baupaket — sonst überschriebe die Projektvorgabe
// die abweichende Frist der Provisorien.
function bpAushaerteNeuBerechnen(tage) {
  const zuw    = loadSchichtZuw();
  const pakete = loadBaupakete();
  let geaendert = 0;
  Object.keys(zuw).forEach(pid => {
    const z = zuw[pid];
    if (!z || z.customAushaerteTage != null || !z.betoniertermin) return;
    const pak = pakete.find(p => p.id === z.paketId);
    if (pak?.aushaerteTage != null && pak.aushaerteTage !== '') return;
    const neu = bpFmtDate(bpAddDays(bpParseDate(z.betoniertermin), tage));
    if (z.ausschaltermin !== neu) { z.ausschaltermin = neu; geaendert++; }
  });
  if (geaendert) {
    saveSchichtZuw(zuw);
    const gruppen = loadBaugruppen();
    gruppen.forEach(g => _bpBaugruppeAushaerteNachziehen(g.id, zuw));
  }
  return geaendert;
}

// Aushärtetermin der Baugruppe auf den spätesten ihrer Fundamente nachziehen
function _bpBaugruppeAushaerteNachziehen(grpId, zuw) {
  if (!grpId) return;
  const gruppen = loadBaugruppen();
  const grp = gruppen.find(g => g.id === grpId);
  if (!grp) return;
  let maxDate = '';
  (grp.pairIds || []).forEach(pid => {
    const d = bpFundAusschaltermin(zuw[pid]);
    if (d && d > maxDate) maxDate = d;
  });
  if (maxDate && grp.ausschaltermin !== maxDate) { grp.ausschaltermin = maxDate; saveBaugruppen(gruppen); }
}

function saveAusschalModal() {
  const pairId = document.getElementById('ausschal-modal-pairid').value;
  const tage   = parseInt(document.getElementById('ausschal-modal-tage').value) || 28;
  const zuw    = loadSchichtZuw();
  if (!zuw[pairId]) { closeAusschalModal(); return; }
  const betonD = zuw[pairId].betoniertermin;
  zuw[pairId].customAushaerteTage = tage;
  if (betonD) zuw[pairId].ausschaltermin = bpFmtDate(bpAddDays(bpParseDate(betonD), tage));
  saveSchichtZuw(zuw);
  _bpBaugruppeAushaerteNachziehen(zuw[pairId].bauGruppeId, zuw);
  closeAusschalModal();
  renderBauprogrammTab();
}
function resetAusschalModal() {
  const pairId = document.getElementById('ausschal-modal-pairid').value;
  const einst  = loadProjEinst();
  const zuw    = loadSchichtZuw();
  if (!zuw[pairId]) { closeAusschalModal(); return; }
  delete zuw[pairId].customAushaerteTage;
  const betonD = zuw[pairId].betoniertermin;
  if (betonD) zuw[pairId].ausschaltermin = bpFmtDate(bpAddDays(bpParseDate(betonD), einst.aushaerteTage ?? 28));
  saveSchichtZuw(zuw);
  _bpBaugruppeAushaerteNachziehen(zuw[pairId].bauGruppeId, zuw);
  closeAusschalModal();
  renderBauprogrammTab();
}

// ── Haupt-Render ──────────────────────────────────────────────
function renderBauprogrammTab() {
  migrateZuwStores();
  bpSeedStartwerte();   // einmalig je Projekt: ein Sperrmuster, ein Los
  try { renderBpGantt(); } catch(e) {
    console.error('renderBpGantt:', e);
    const w = document.getElementById('bp-gantt-wrap');
    if (w) w.innerHTML = '<div style="text-align:center;padding:30px;color:#dc2626;font-size:12px;">Fehler beim Rendern der Baupakete (siehe Konsole).<br><small>' + String(e).replace(/</g,'&lt;') + '</small></div>';
  }
  try { renderBpLegende(); } catch(e) { console.error('renderBpLegende:', e); }
  try { renderBpFundamenteGantt(); } catch(e) {
    console.error('renderBpFundamenteGantt:', e);
    const w = document.getElementById('bp-fund-gantt-wrap');
    if (w) w.innerHTML = '<div style="text-align:center;padding:30px;color:#dc2626;font-size:12px;">Fehler beim Rendern des Fundamentplan (siehe Konsole).</div>';
  }
  try { renderBpZuweisungTable(); } catch(e) {
    console.error('renderBpZuweisungTable:', e);
    const w = document.getElementById('bp-zuweisung-table');
    if (w) w.innerHTML = '<div style="text-align:center;padding:30px;color:#dc2626;font-size:12px;">Fehler beim Rendern der Schichtzuweisung (siehe Konsole).</div>';
  }
  try { updateBpInfoBar(); } catch(e) { console.error('updateBpInfoBar:', e); }
  try { renderSperrmusterBibliothek(); } catch(e) { console.error('renderSperrmusterBibliothek:', e); }
  try { updateAllSperrmusterSelects(); } catch(e) { console.error('updateAllSperrmusterSelects:', e); }
  _updateBpToolbar();
}

// Einzige Quelle fuer die Frage «was fehlt noch, bevor Baupakete entstehen koennen?».
// Toolbar-Sperren, Leerzustand, Infozeile und der Abbruch in autoGenerateBaupakete
// lesen alle hier — vorher pruefte jede Stelle eigene Bedingungen, wodurch der
// Button gesperrt blieb, obwohl die Funktion mit einem Baubeginn aus den
// Projekteinstellungen durchgelaufen waere.
//
// fehlend[] ist in Arbeitsreihenfolge sortiert; `ziel` benennt den Tab der
// Projekteinstellungen, der das Problem loest (null = woanders zu erledigen).
// ── Startwerte ───────────────────────────────────────────────────────────────
// Ohne Sperrmuster lassen sich keine Paketdauern rechnen, ohne Los blockiert die
// Paketerzeugung. Statt den Nutzer mit zwei leeren Bibliotheken zu empfangen,
// legt die App je einen gebräuchlichen Startwert an — wie seedDefaultFtProfile()
// es für die Fundamenttypen tut. Beide sind ganz normal bearbeit- und löschbar;
// einmal angelegt (Merker) wird nichts wieder erzeugt.
const BP_STARTWERTE_KEY = () => 'sp_bp_startwerte__' + _activeId;

function bpSeedStartwerte() {
  if (store.getItem(BP_STARTWERTE_KEY())) return { sperrmuster: 0, lose: 0 };
  let sperrmuster = 0, lose = 0;

  if (!loadSperrmuster().length) {
    // Nachtfenster Mo–Do 01:00–05:00: das im Bahnbau übliche Standardintervall
    saveSperrmuster([{
      id: 'sp_start_nacht', name: 'Nacht Mo–Do (Standard)', typ: 'nacht', farbe: '#1a3a5c',
      wochentage: [1, 2, 3, 4], von: '01:00', bis: '05:00', nettoH: 4,
      gleissperrung: 'keine', gleisNr: null, fl: 'neutral',
      gueltigVon: null, gueltigBis: null,
      bemerkung: 'Startwert — bitte an die Sperrpause des Projekts anpassen.',
    }]);
    sperrmuster = 1;
  }

  const einst = loadProjEinst();
  if (!(einst.teams || []).length) {
    einst.teams = [{ id: 'team_start_1', name: 'Los 1', geraet: '' }];
    if (!einst.standardSperrmusterId) einst.standardSperrmusterId = 'sp_start_nacht';
    saveProjEinst(einst);
    lose = 1;
  }

  store.setItem(BP_STARTWERTE_KEY(), '1');
  return { sperrmuster, lose };
}

function bpVoraussetzungen() {
  const einst  = loadProjEinst();
  const allBp  = loadAllBauprojekt();
  const pairs  = getFilteredSorted();
  const ftZuw  = loadFtZuweisungen();
  const msBb   = loadMeilensteine().find(m => m.typ === 'baubeginn');
  const baubeginn = (msBb ? msMsResolvedDatum(msBb) : null) || einst.baubeginn || '';

  const nbPairs = pairs.filter(p => {
    const t = getPairBpTyp(p.id, allBp);
    return t === 'neubau' || t === 'abbruch-neubau';
  });
  const mitFt = nbPairs.filter(p => ftZuw[p.id] || (allBp[p.id] || {}).fundtyp);

  const fehlend = [];
  if (!nbPairs.length) {
    fehlend.push({ schluessel:'standorte', text:'Standorte mit Neubau-Massnahme anlegen', ziel:null });
  } else if (!mitFt.length) {
    fehlend.push({ schluessel:'fundamenttyp', text:'Fundamenttyp je Standort hinterlegen', ziel:null });
  }
  if (!(einst.teams || []).length) {
    fehlend.push({ schluessel:'lose', text:'Lose / Teams definieren', ziel:'lose' });
  }
  if (!baubeginn) {
    fehlend.push({ schluessel:'baubeginn', text:'Baubeginn festlegen (Meilenstein oder Projekteinstellungen)', ziel:'zeitplanung' });
  }

  // Weich: blockiert die Paketerzeugung nicht, aber Dauern bleiben unberechenbar
  const warnungen = [];
  if (!loadSperrmuster().length) {
    warnungen.push({ schluessel:'sperrmuster', text:'Kein Sperrmuster definiert — Paketdauern koennen nicht berechnet werden' });
  }

  return {
    baubeginn,
    fehlend,
    warnungen,
    kannPakete: fehlend.length === 0,
    naechsterSchritt: fehlend[0] || null,
  };
}

function _updateBpToolbar() {
  const hasPakete = loadBaupakete().length > 0;
  const hasZuw    = Object.keys(loadSchichtZuw()).length > 0 || loadMeilensteine().length > 0;
  // Gedimmte Buttons bleiben klickbar: pointer-events:none wuerde auch den
  // title-Tooltip unterdruecken, der Nutzer saehe nur einen grauen Knopf ohne
  // Begruendung. Die Aktionen melden selbst, was fehlt.
  const _setBtn = (ids, active, grund) => {
    (Array.isArray(ids) ? ids : [ids]).forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.style.opacity = active ? '1' : '0.38';
      btn.style.cursor  = active ? 'pointer' : 'help';
      btn.style.pointerEvents = '';
      if (!active && grund) btn.title = grund;
      else if (active && btn.dataset.titelOriginal !== undefined) btn.title = btn.dataset.titelOriginal;
      if (btn.dataset.titelOriginal === undefined) btn.dataset.titelOriginal = btn.title || '';
    });
  };
  const vor = bpVoraussetzungen();
  _setBtn('bp-btn-auto-pak', vor.kannPakete,
          vor.naechsterSchritt ? 'Zuerst: ' + vor.naechsterSchritt.text : '');
  _setBtn('bp-btn-recalc',   hasPakete, 'Zuerst Baupakete anlegen');
  _setBtn('bp-btn-autozuw',  hasPakete, 'Zuerst Baupakete anlegen');
  _setBtn('bp-btn-reset',     hasPakete || hasZuw, 'Nichts zurückzusetzen');
  _syncBpDirtyButtons();
}

function setBpFundSort(sort) {
  _bpFundSort = sort;
  bpFundAuswahlLeeren(false);
  // Aktiven Zustand über die Klasse .aktiv (siehe .seg im Stylesheet)
  ['km','datum','baugruppe'].forEach(s => {
    document.getElementById('bp-fsort-' + s)?.classList.toggle('aktiv', s === sort);
  });
  renderBpFundamenteGantt();
}

// Auswahl leeren — beim Wechsel von Sortierung, Zoom oder Ansicht, damit keine
// Auswahl aus einem anderen Kontext ueberlebt und beim naechsten Zug mitwandert.
function bpFundAuswahlLeeren(neuZeichnen = true) {
  if (!_bpFundSelection.size && !_bpFundLastClick) { _bpFundAuswahlAnzeige(); return; }
  _bpFundSelection.clear();
  _bpFundLastClick = null;
  if (neuZeichnen) renderBpFundamenteGantt(); else _bpFundAuswahlAnzeige();
}

// Sichtbare Rueckmeldung zur Mehrfachauswahl: ohne sie bleibt eine aktive
// Auswahl unbemerkt und verschiebt beim naechsten Zug ungewollt mit.
function _bpFundAuswahlAnzeige() {
  const el = document.getElementById('bp-fund-auswahl');
  if (!el) return;
  const n = _bpFundSelection.size;
  if (!n) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'inline-flex';
  el.innerHTML = '<span style="font-weight:700;">' + n + ' ausgewählt</span>'
    + '<button onclick="bpFundAuswahlLeeren()" title="Auswahl aufheben"'
    + ' style="margin-left:6px;padding:0 5px;border-radius:4px;border:1px solid #93c5fd;background:white;'
    + 'color:#1d4ed8;font-size:11px;font-weight:700;cursor:pointer;line-height:16px;">×</button>';
}

// Selektion-Styling auf einem SVG-Balken-Element setzen/entfernen
function _fpSetBarSelected(el, selected) {
  el.setAttribute('opacity', selected ? '1' : '0.85');
  const isOutside = el.getAttribute('stroke') === '#ef4444';
  if (selected && !isOutside) {
    el.setAttribute('stroke', '#3b82f6');
    el.setAttribute('stroke-width', '3');
  } else if (!selected && !isOutside) {
    el.removeAttribute('stroke');
    el.removeAttribute('stroke-width');
  }
}

// Hintergrund des Fundamente-Gantts: Zebrastreifen je Zeile (Vorarbeits-Zeilen
// eigene Farbe), Wochenend-/Feiertagsraster in der Tagesansicht, Heute-Linie.
function _bpFundHintergrundSvg(g) {
  let svg = '';
  let y = g.HEADER_H;
  g.rowDefs.forEach((r, ri) => {
    const h = ['gruppe','abbruch-header'].includes(r.type) ? g.GROUP_H : g.ROW_H;
    svg += `<rect x="0" y="${y}" width="${g.totalW}" height="${h}" fill="${r.type==='vorarbeit'?'#fffbeb':ri%2===0?'#fff':'#f9fafb'}"/>`;
    y += h;
  });

  if (_bpZoom === 'tag') {
    const feiertage = chFeiertage(g.projStart.getFullYear());
    if (g.projEnd.getFullYear() !== g.projStart.getFullYear()) {
      chFeiertage(g.projEnd.getFullYear()).forEach(d => feiertage.add(d));
    }
    g.cols.forEach((col, ci) => {
      const x    = g.LEFT_W + ci * g.COL_W;
      const dow  = col.getDay();
      const isFt = feiertage.has(bpFmtDate(col));
      if (dow === 0 || dow === 6 || isFt) {
        svg += `<rect x="${x}" y="${g.HEADER_H}" width="${g.COL_W}" height="${g.totalH-g.HEADER_H}" fill="${isFt?'rgba(239,68,68,0.07)':'rgba(148,163,184,0.10)'}" style="pointer-events:none;"/>`;
      }
    });
  }

  const todayX = g.xFor(bpFmtDate(new Date()));
  if (todayX >= g.LEFT_W && todayX <= g.totalW) {
    svg += `<line x1="${todayX}" y1="${g.HEADER_H}" x2="${todayX}" y2="${g.totalH}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.6"/>`;
    svg += `<text x="${todayX+2}" y="${g.totalH-4}" font-size="9" fill="#ef4444" font-family="system-ui">Heute</text>`;
  }
  return svg;
}

// Spaltenkopf des Fundamente-Gantts inkl. Spalten-Trennlinien.
// Tagesansicht: KW-Wechsel, Wochentag und Datum; sonst Gruppenlabel + Spaltenlabel.
function _bpFundHeaderSvg(g) {
  let svg = '', prevGrp = '', prevKw = -1;
  g.cols.forEach((col, ci) => {
    const x = g.LEFT_W + ci * g.COL_W;
    if (_bpZoom === 'tag') {
      const kw = _isoWeek(col);
      if (kw !== prevKw) {
        svg += `<text x="${x+2}" y="12" font-size="9" fill="#64748b" font-weight="700" font-family="system-ui">KW${kw}</text>`;
        prevKw = kw;
      }
      const dow    = col.getDay();
      const dowLbl = ['So','Mo','Di','Mi','Do','Fr','Sa'][dow];
      const isWe   = dow === 0 || dow === 6;
      svg += `<text x="${x+g.COL_W/2}" y="26" font-size="8" fill="${isWe?'#94a3b8':'#6b7280'}" text-anchor="middle" font-family="system-ui">${dowLbl}</text>`;
      svg += `<text x="${x+g.COL_W/2}" y="44" font-size="10" fill="${isWe?'#94a3b8':'#374151'}" text-anchor="middle" font-weight="${isWe?'400':'600'}" font-family="system-ui">${col.getDate()}</text>`;
    } else {
      const grpLbl = _bpZoom==='woche' ? col.toLocaleDateString('de-CH',{month:'short',year:'2-digit'})
                   : _bpZoom==='jahr'  ? (Math.floor(col.getFullYear()/5)*5)+'er'
                   : String(col.getFullYear());
      if (grpLbl !== prevGrp) {
        svg += `<text x="${x+2}" y="14" font-size="9" fill="#9ca3af" font-weight="600" font-family="system-ui">${grpLbl}</text>`;
        prevGrp = grpLbl;
      }
      const hdrLbl = _bpZoom==='woche' ? 'KW'+_isoWeek(col)
                   : _bpZoom==='jahr'  ? String(col.getFullYear())
                   : col.toLocaleDateString('de-CH',{month:'short'});
      svg += `<text x="${x+g.COL_W/2}" y="40" font-size="10" fill="#6b7280" text-anchor="middle" font-family="system-ui">${hdrLbl}</text>`;
    }
    svg += `<line x1="${x}" y1="${g.HEADER_H-2}" x2="${x}" y2="${g.totalH}" stroke="#f0f2f5" stroke-width="1"/>`;
  });
  return svg;
}

// Bindet die Drag-Interaktionen der Fundament- und Abbruch-Balken an das
// gerenderte SVG. Wird nach jedem Render neu aufgerufen; die eigentliche
// Bewegung verarbeiten die Wrap-Level-Listener (bpFundMoveMove/-End).
function _bpFundDragHandlerBinden(wrap) {
// Drag-to-move für Fundament-Balken (mit Ctrl/Shift Multi-Select)
wrap.querySelectorAll('[data-fp-move]').forEach(el => {
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const pId = el.getAttribute('data-fp-move');

    // Ctrl/Meta: Selektion togglen — nur visuell aktualisieren, kein Re-Render
    if (e.ctrlKey || e.metaKey) {
      const nowSel = !_bpFundSelection.has(pId);
      if (nowSel) _bpFundSelection.add(pId); else _bpFundSelection.delete(pId);
      _bpFundLastClick = pId;
      _fpSetBarSelected(el, nowSel);
      _bpFundAuswahlAnzeige();
      return;
    }

    // Shift: Range-Selektion — nur visuell aktualisieren, kein Re-Render
    if (e.shiftKey && _bpFundLastClick) {
      const i1 = _bpFundRowOrder.indexOf(_bpFundLastClick);
      const i2 = _bpFundRowOrder.indexOf(pId);
      if (i1 !== -1 && i2 !== -1) {
        const from = Math.min(i1, i2), to = Math.max(i1, i2);
        for (let i = from; i <= to; i++) {
          const pid2 = _bpFundRowOrder[i];
          _bpFundSelection.add(pid2);
          const el2 = wrap.querySelector(`[data-fp-move="${pid2}"]`);
          if (el2) _fpSetBarSelected(el2, true);
        }
        _bpFundAuswahlAnzeige();
      }
      return;
    }

    // Normaler Klick: unselektierten Balken anklicken → andere deselektieren
    _bpFundLastClick = pId;
    if (!_bpFundSelection.has(pId)) {
      _bpFundSelection.forEach(pid2 => {
        const el2 = wrap.querySelector(`[data-fp-move="${pid2}"]`);
        if (el2) _fpSetBarSelected(el2, false);
      });
      _bpFundSelection.clear();
    }

    // multiOrig für alle selektierten (oder nur diesen) aufbauen
    const toMove    = _bpFundSelection.size > 0 ? [..._bpFundSelection] : [pId];
    const multiOrig = {};
    const allZuw    = loadSchichtZuw();
    toMove.forEach(pid => {
      const z = allZuw[pid];
      if (z?.paketId && z?.schichtNr) multiOrig[pid] = { paketId: z.paketId, schichtNr: z.schichtNr };
    });

    _bpFundMoveDrag = {
      pairId:      pId,
      paketId:     el.getAttribute('data-fp-paket'),
      multiOrig,
      // Ausgangsdatum des gezogenen Balkens — Bezugspunkt fuer die Zugdistanz
      origDatum:   multiOrig[pId]
        ? bpSchichtDatum(multiOrig[pId].paketId, multiOrig[pId].schichtNr, loadBaupakete())
        : null,
      startX:      e.clientX,
      currentDate: null,
      moved:       false,
    };
  });
});

// Drag für Abbruch-Balken
wrap.querySelectorAll('[data-fp-abbruch-move]').forEach(el => {
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const pId    = el.getAttribute('data-fp-abbruch-move');
    const quelle = bpAbbZuwStore(pId);
    const az     = (quelle === 'abb' ? loadAbbZuw() : loadSchichtZuw())[pId] || {};
    _bpFundMoveDrag = {
      pairId:      pId,
      paketId:     el.getAttribute('data-fp-abbruch-paket'),
      // Zielstore merken, damit bpFundMoveEnd nicht in die Neubau-Zuweisung schreibt
      zuwStore:    quelle,
      multiOrig:   (az.paketId && az.schichtNr) ? { [pId]: { paketId: az.paketId, schichtNr: az.schichtNr } } : {},
      origDatum:   (az.paketId && az.schichtNr) ? bpSchichtDatum(az.paketId, az.schichtNr, loadBaupakete()) : null,
      startX:      e.clientX,
      currentDate: null,
      moved:       false,
    };
  });
});

}

// Baut die Zeilenstruktur des Fundamente-Gantts: Fundament-Zeilen (ggf. nach
// Baugruppen gruppiert), Abbruch-Zeilen und die Vorarbeits-Zeilen je Baupaket,
// die oben eingefuegt werden. Rueckgabe: Array von Zeilendefinitionen.
function _bpFundZeilenstruktur(g) {
  const { abbruchPairs, gruppen, neubauPairs, pairs, pakete, sortPairs, zuw } = g;
const rowDefs = [];
const sorted  = sortPairs(neubauPairs);

if (_bpFundSort === 'baugruppe') {
  const grouped = {};
  sorted.forEach(p => { const gid = zuw[p.id]?.bauGruppeId||'__none__'; (grouped[gid]=grouped[gid]||[]).push(p); });
  Object.entries(grouped).forEach(([gid, gPairs]) => {
    if (gid === '__none__') { gPairs.forEach(p => rowDefs.push({type:'fund', pair:p})); return; }
    const grp = gruppen.find(g => g.id === gid);
    rowDefs.push({type:'gruppe', grp, gid, pairs:gPairs});
    if (!_bpCollapsed.has(gid)) gPairs.forEach(p => rowDefs.push({type:'fund', pair:p, indent:true}));
  });
} else {
  sorted.forEach(p => rowDefs.push({type:'fund', pair:p}));
}
if (abbruchPairs.length) {
  rowDefs.push({type:'abbruch-header'});
  sortPairs(abbruchPairs).forEach(p => rowDefs.push({type:'fund-abbruch', pair:p}));
}

// Vorarbeiten-Zeilen oben einfügen (pro Baupaket, sortiert nach startDatum)
const vaRows = [];
[...pakete].sort((a,b) => (a.startDatum||'').localeCompare(b.startDatum||'')).forEach(pak => {
  if (!pak.vorarbeiten?.length || !pak.startDatum) return;
  pak.vorarbeiten.forEach(va => {
    if (!va.name) return;
    const startD = bpFmtDate(bpAddDays(bpParseDate(pak.startDatum), va.offsetTage ?? -14));
    const endD   = bpFmtDate(bpAddDays(bpParseDate(startD), Math.max(1, va.dauer || 7) - 1));
    vaRows.push({ type: 'vorarbeit', va, pak, startD, endD });
  });
});
// Als Block voranstellen — einzelnes unshift je Zeile wuerde die Sortierung umkehren
rowDefs.unshift(...vaRows);

  return rowDefs;
}

function renderBpFundamenteGantt() {
  const wrap    = document.getElementById('bp-fund-gantt-wrap');
  if (!wrap) return;
  const pakete    = loadBaupakete();
  const zuw       = loadSchichtZuw();
  const pairs     = getFilteredSorted();
  const allBp     = loadAllBauprojekt();
  const ftZuw     = loadFtZuweisungen();
  const ftList    = loadFtProfile();
  const gruppen   = loadBaugruppen();
  const einst     = loadProjEinst();
  const spList    = loadSperrmuster();
  const abbZuw    = loadAbbZuw();
  const _getEffZ = p => zuw[p.id] || {};
  // Abbruch-Zuweisung — Store haengt am Standorttyp (siehe bpAbbZuwStore)
  const _getAbbZ = p => (bpAbbZuwStore(p.id, allBp) === 'abb' ? abbZuw[p.id] : zuw[p.id]) || {};

  if (!pairs.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:30px;color:#9ca3af;font-size:12px;">Keine Standorte vorhanden.</div>';
    return;
  }

  // Neubau vs Abbruch trennen; "Bestand erhalten" komplett ausblenden
  // 'abbruch' (A+N) erscheint in BEIDEN Sektionen — Neubau-Bar oben, Abbruch-Bar unten
  const neubauPairs  = pairs.filter(p => { const m = (allBp[p.id]||{}).massnahme; return m !== 'abbruch-nur' && m !== 'erhalten'; });
  const abbruchPairs = pairs.filter(p => { const m = (allBp[p.id]||{}).massnahme; return m === 'abbruch' || m === 'abbruch-nur'; });

  // Datum aus Zuweisung — berücksichtigt Sicherung/Provisorium
  const getStartDate = p => {
    const z = _getEffZ(p); if (!z.paketId && !z.bohrSchichten?.length) return null;
    if (z.bohrSchichten?.length) return bpSchichtDatum(z.bohrSchichten[0].paketId, z.bohrSchichten[0].schichtNr, pakete);
    return (z.paketId && z.schichtNr) ? bpSchichtDatum(z.paketId, z.schichtNr, pakete) : null;
  };
  const getEndDate = p => {
    const z = _getEffZ(p); if (!z.paketId && !z.bohrSchichten?.length) return null;
    if (z.betoniertermin) return z.betoniertermin;
    if (z.bohrSchichten?.length) { const l = z.bohrSchichten[z.bohrSchichten.length-1]; return bpSchichtDatum(l.paketId, l.schichtNr, pakete); }
    return (z.paketId && z.schichtNr) ? bpSchichtDatum(z.paketId, z.schichtNr, pakete) : null;
  };
  // Abbruch-Datum aus der Abbruch-Zuweisung des jeweiligen Stores
  const getAbbruchStartDate = p => {
    const az = _getAbbZ(p); if (!az.paketId || !az.schichtNr) return null;
    return bpSchichtDatum(az.paketId, az.schichtNr, pakete);
  };

  // Sortierung
  const sortPairs = list => {
    if (_bpFundSort === 'datum') return [...list].sort((a,b) => (getStartDate(a)||'9999').localeCompare(getStartDate(b)||'9999'));
    if (_bpFundSort === 'baugruppe') return [...list].sort((a,b) => (zuw[a.id]?.bauGruppeId||'zzz_'+a.id).localeCompare(zuw[b.id]?.bauGruppeId||'zzz_'+b.id));
    return [...list].sort((a,b) => parseFloat(a.km_rs||0) - parseFloat(b.km_rs||0));
  };

  // Zeilenstruktur (siehe _bpFundZeilenstruktur)
  const rowDefs = _bpFundZeilenstruktur({ abbruchPairs, gruppen, neubauPairs, pairs, pakete, sortPairs, zuw });

  // Wenn alle Standorte "Bestand erhalten" sind → kein Gantt nötig
  if (!rowDefs.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:30px;color:#9ca3af;font-size:12px;">Alle Standorte sind als «Bestand erhalten» klassiert — kein Baupaket erforderlich.</div>';
    return;
  }

  // Reihenfolge für Shift-Range-Selektion merken
  _bpFundRowOrder = rowDefs.filter(r => r.type === 'fund' || r.type === 'fund-abbruch').map(r => String(r.pair.id));

  // Datumsbereich bestimmen
  const allDates = [];
  pairs.forEach(p => {
    const d = getStartDate(p); if (d) allDates.push(d);
    const z = _getEffZ(p);
    if (z.ausschaltermin) allDates.push(z.ausschaltermin);
    if (z.paketId && z.schichtNr) { const d2 = bpSchichtDatum(z.paketId, z.schichtNr, pakete); if (d2) allDates.push(d2); }
    // Abbruch-Datum ebenfalls einbeziehen
    const dabb = getAbbruchStartDate(p); if (dabb) allDates.push(dabb);
  });
  pakete.forEach(p => { if (p.startDatum) allDates.push(p.startDatum); const e=bpPaketEnd(p); if (e) allDates.push(e); });
  pakete.forEach(pak => {
    (pak.vorarbeiten || []).forEach(va => {
      if (!pak.startDatum || !va.name) return;
      allDates.push(bpFmtDate(bpAddDays(bpParseDate(pak.startDatum), va.offsetTage ?? -14)));
    });
  });

  const sortedD = allDates.filter(Boolean).sort();
  if (!sortedD.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:30px;color:#9ca3af;font-size:12px;">Noch keine Zuweisung. Auto-Zuweisung starten.</div>';
    return;
  }
  const projStart = bpParseDate(sortedD[0]);
  const projEnd   = bpAddDays(bpParseDate(sortedD[sortedD.length-1]), 35);

  // Layout
  const ROW_H   = 32, GROUP_H = 28, HEADER_H = 44, LEFT_W = 112;
  const COL_W   = _bpZoom === 'tag' ? 28 : _bpZoom === 'woche' ? 44 : _bpZoom === 'jahr' ? 90 : 50;
  // Referenz für Drag-Reverse-Mapping speichern
  _bpFundGanttRef = { projStart, colW: COL_W, leftW: LEFT_W, zoom: _bpZoom };

  // Spalten
  const cols = [];
  let cur = new Date(projStart);
  while (cur <= projEnd) {
    cols.push(new Date(cur));
    if (_bpZoom === 'tag') cur.setDate(cur.getDate()+1);
    else if (_bpZoom === 'woche') cur.setDate(cur.getDate()+7);
    else if (_bpZoom === 'jahr') cur.setFullYear(cur.getFullYear()+1);
    else cur.setMonth(cur.getMonth()+1);
  }
  const totalW = LEFT_W + cols.length * COL_W;
  const totalH = HEADER_H + rowDefs.reduce((h,r) => h + (['gruppe','abbruch-header'].includes(r.type) ? GROUP_H : ROW_H), 0) + 8;

  const xFor = dateStr => {
    if (!dateStr) return LEFT_W;
    const d = bpParseDate(dateStr);
    if (_bpZoom === 'tag')   return LEFT_W + bpDayDiff(bpFmtDate(projStart), dateStr) * COL_W;
    if (_bpZoom === 'woche') return LEFT_W + Math.floor(bpDayDiff(bpFmtDate(projStart), dateStr)/7) * COL_W;
    if (_bpZoom === 'jahr')  return LEFT_W + ((d.getFullYear()-projStart.getFullYear()) + (d.getMonth()-projStart.getMonth())/12) * COL_W;
    return LEFT_W + ((d.getFullYear()-projStart.getFullYear())*12 + (d.getMonth()-projStart.getMonth())) * COL_W;
  };
  // Nachreichen statt oben mitgeben: xFor ist erst hier initialisiert.
  // Der Drag braucht es fuer das Snap-Highlight (Zoom-Umrechnung Datum → x).
  _bpFundGanttRef.xFor = xFor;

  let svg = '';
  // Zweite Ebene fuer das Freeze-Panel: alles was in der linken Spalte steht,
  // wird zusaetzlich hier gesammelt und als fixierte Kopie ueber den Gantt
  // gelegt. Interaktive Flaechen bleiben im Haupt-SVG (Panel ist klickdurchlaessig).
  let svgLeft = '';
  const beide = s => { svg += s; svgLeft += s; };

  svg += _bpFundHintergrundSvg({ rowDefs, cols, COL_W, LEFT_W, HEADER_H, ROW_H, GROUP_H,
                                 totalW, totalH, projStart, projEnd, xFor });
  svg += _bpFundHeaderSvg({ cols, COL_W, LEFT_W, HEADER_H, totalH });

  // Zeilen rendern
  let rowY = HEADER_H;
  rowDefs.forEach(r => {
    const h   = ['gruppe','abbruch-header'].includes(r.type) ? GROUP_H : ROW_H;
    const midY = rowY + h/2 + 4;

    // Linke Spalte
    beide(`<rect x="0" y="${rowY}" width="${LEFT_W}" height="${h}" fill="${r.type==='gruppe'?'#f8fafc':r.type==='abbruch-header'?'#fff7ed':r.type==='vorarbeit'?'#fffbeb':'white'}"/>`);
    beide(`<line x1="${LEFT_W}" y1="${rowY}" x2="${LEFT_W}" y2="${rowY+h}" stroke="#e5e7eb" stroke-width="1"/>`);

    if (r.type === 'gruppe') {
      const collapsed = _bpCollapsed.has(r.gid);
      beide(`<text x="8" y="${midY}" font-size="11" fill="#1a3a5c" font-weight="700" font-family="system-ui">${collapsed?'▶':'▼'} ${(r.grp?.name||'Gruppe').slice(0,12)}</text>`);
      // Klickbare Fläche für Toggle
      svg += `<rect x="0" y="${rowY}" width="${LEFT_W}" height="${h}" fill="transparent" style="cursor:pointer;" data-toggle-grp="${r.gid}"/>`;
      // Sammelbalken
      const starts = r.pairs.map(p=>getStartDate(p)).filter(Boolean).sort();
      const ends   = r.pairs.map(p=>getEndDate(p)).filter(Boolean).sort();
      if (starts.length && ends.length) {
        const bx = xFor(starts[0]);
        const bw = Math.max(COL_W, xFor(ends[ends.length-1])+COL_W-bx);
        svg += `<rect x="${bx}" y="${rowY+6}" width="${bw}" height="${h-12}" rx="3" fill="#1a3a5c" opacity="0.12"/>`;
        const beton = r.grp?.betoniertermin;
        if (beton) { const btX=xFor(beton)+COL_W/2; svg += `<line x1="${btX}" y1="${rowY+3}" x2="${btX}" y2="${rowY+h-3}" stroke="#059669" stroke-width="2"/>`; }
      }
    } else if (r.type === 'abbruch-header') {
      svg += `<rect x="0" y="${rowY}" width="${totalW}" height="${h}" fill="#fff7ed"/>`;
      beide(`<text x="8" y="${midY}" font-size="10" fill="#92400e" font-weight="700" font-family="system-ui">ABBRUCH BESTAND</text>`);
    } else if (r.type === 'vorarbeit') {
      // Label links
      beide(`<text x="6" y="${rowY + ROW_H/2}" font-size="10" fill="#92400e" font-weight="700" font-family="system-ui" dominant-baseline="middle">${r.va.name.slice(0,13)}</text>`);
      // Bar
      const bx  = xFor(r.startD);
      const ex  = xFor(r.endD) + COL_W;
      const bw  = Math.max(ex - bx, COL_W);
      const col = r.va.farbe || '#f59e0b';
      svg += `<rect x="${bx}" y="${rowY+5}" width="${bw}" height="${ROW_H-10}" rx="4" fill="${col}" opacity="0.88" style="pointer-events:none;"/>`;
      svg += `<text x="${bx+6}" y="${rowY + ROW_H/2}" font-size="9" fill="white" font-weight="700" font-family="system-ui" dominant-baseline="middle" style="pointer-events:none;">${r.va.dauer}T · ${r.pak.name.slice(0,12)}</text>`;
      svg += `<line x1="0" y1="${rowY+ROW_H}" x2="${totalW}" y2="${rowY+ROW_H}" stroke="#f0f2f5" stroke-width="0.5"/>`;
      rowY += ROW_H;
      return;
    } else {
      const p      = r.pair;
      const z      = _getEffZ(p);
      const indent = r.indent ? 12 : 0;
      const lbl    = ('Mast '+(p.mast||'—')).slice(0,13);
      const kmStr  = p.km_rs ? 'km ' + parseFloat(p.km_rs).toFixed(3) : '';
      const glStr  = p.gleis ? 'Gl '  + p.gleis : '';
      const sub    = [kmStr, glStr].filter(Boolean).join(' · ');
      beide(`<text x="${8+indent}" y="${rowY+11}" font-size="9" fill="#374151" font-weight="${r.indent?'400':'600'}" font-family="system-ui">${lbl}</text>`);
      if (sub) beide(`<text x="${8+indent}" y="${rowY+22}" font-size="8" fill="#9ca3af" font-family="system-ui">${sub}</text>`);

      if (r.type === 'fund-abbruch') {
        const sd = getAbbruchStartDate(p);
        if (sd) {
          const bx  = xFor(sd);
          const bw2 = COL_W;
          const az  = _getAbbZ(p);
          svg += `<rect x="${bx}" y="${rowY+6}" width="${bw2}" height="${ROW_H-12}" rx="3" fill="#fdba74" opacity="0.85" style="cursor:grab;" data-fp-abbruch-move="${p.id}" data-fp-abbruch-paket="${az.paketId||''}"/>`;
          svg += `<rect x="${bx-2}" y="${rowY}" width="${bw2+4}" height="${ROW_H}" fill="transparent" style="cursor:grab;" data-fp-abbruch-move="${p.id}" data-fp-abbruch-paket="${az.paketId||''}"/>`;
          svg += `<text x="${bx+4}" y="${rowY+ROW_H/2+4}" font-size="9" fill="white" font-weight="600" font-family="system-ui" style="pointer-events:none;">Abbruch</text>`;
        } // else: noch keine Zuweisung → keine Darstellung
      } else {
        // Neubau
        let startD=null, drillEndD=null, betonStartD=null, betonEndD=null;
        if (z.bohrSchichten?.length) {
          startD    = bpSchichtDatum(z.bohrSchichten[0].paketId, z.bohrSchichten[0].schichtNr, pakete);
          const l   = z.bohrSchichten[z.bohrSchichten.length-1];
          drillEndD = bpSchichtDatum(l.paketId, l.schichtNr, pakete);
        } else if (z.paketId && z.schichtNr) {
          startD    = bpSchichtDatum(z.paketId, z.schichtNr, pakete);
          drillEndD = startD;
        }

        // Betonphase für Pfahlfundamente: aus betonSchichtNr + FT-Kalkulation
        if (z.isPfahlFund && z.betonSchichtNr != null && drillEndD) {
          const lastBohrPaketId = z.bohrSchichten?.length
            ? z.bohrSchichten[z.bohrSchichten.length-1].paketId : z.paketId;
          betonStartD = bpSchichtDatum(lastBohrPaketId, z.betonSchichtNr, pakete);
          const ftId  = ftZuw[p.id];
          let   ft    = ftList.find(t => t.id === ftId);
          if (!ft) { const fb = (allBp[p.id]||{}).fundtyp||''; if (fb) ft = _findFtInCache(ftList, fb); }
          const bPak  = pakete.find(pk => pk.id === lastBohrPaketId);
          const sp    = bPak ? resolveSpForPak(bPak, betonStartD || bPak.startDatum) : null;
          if (ft && sp?.nettoH) {
            const calc = _calcPfahlSchichten(ft, sp.nettoH, einst.abzugMinuten || 0);
            if (calc?.betonShifts > 0) {
              betonEndD = bpSchichtDatum(lastBohrPaketId, z.betonSchichtNr + calc.betonShifts - 1, pakete);
            }
          }
          if (!betonEndD && betonStartD) betonEndD = betonStartD;
        }

        const endD = betonEndD || drillEndD;
        if (startD) {
          const pak      = pakete.find(pk => pk.id === (z.bohrSchichten?.length ? z.bohrSchichten[0].paketId : z.paketId));
          const col      = pak?.farbe||'#1a3a5c';
          const bx       = xFor(startD);
          const isSelected = _bpFundSelection.has(String(p.id));
          const pakStart = pak ? bpParseDate(pak.startDatum) : null;
          const pakEnd   = pak ? bpParseDate(bpPaketEnd(pak)) : null;
          const schichtD = bpParseDate(startD);
          const isOutside  = pakStart && pakEnd && schichtD && (schichtD < pakStart || schichtD > pakEnd);
          const strokeAttr = isOutside ? 'stroke="#ef4444" stroke-width="2"' : isSelected ? 'stroke="#3b82f6" stroke-width="3"' : '';

          if (betonStartD && drillEndD) {
            // 2-Phase Balken: Bohrphase (leicht) + Betonphase (voll)
            const drillBw  = Math.max(COL_W, xFor(drillEndD) + COL_W - bx);
            const betonBx  = xFor(betonStartD);
            const betonBw  = Math.max(COL_W, xFor(betonEndD||betonStartD) + COL_W - betonBx);
            const totalBw  = Math.max(COL_W, (betonBx + betonBw) - bx);
            svg += `<rect x="${bx}" y="${rowY+6}" width="${drillBw}" height="${ROW_H-12}" rx="3" fill="${col}" opacity="0.40" style="cursor:grab;" data-fp-pair="${p.id}" data-fp-move="${p.id}" data-fp-paket="${z.paketId}" ${strokeAttr}/>`;
            svg += `<rect x="${betonBx}" y="${rowY+6}" width="${betonBw}" height="${ROW_H-12}" rx="3" fill="${col}" opacity="0.85" style="cursor:grab;" data-fp-move="${p.id}" data-fp-paket="${z.paketId}"/>`;
            svg += `<rect x="${bx-2}" y="${rowY}" width="${Math.max(totalBw+4, COL_W)}" height="${ROW_H}" fill="transparent" style="cursor:grab;" data-fp-pair="${p.id}" data-fp-move="${p.id}" data-fp-paket="${z.paketId}"/>`;
            const nBohr = z.bohrSchichten?.length || 1;
            if (drillBw > 32) svg += `<text x="${bx+4}" y="${rowY+ROW_H/2+4}" font-size="9" fill="white" font-weight="600" font-family="system-ui" style="pointer-events:none;">${nBohr}× Bohr</text>`;
            if (betonBw > 28) svg += `<text x="${betonBx+4}" y="${rowY+ROW_H/2+4}" font-size="9" fill="white" font-weight="700" font-family="system-ui" style="pointer-events:none;">Beton</text>`;
            if (isOutside) svg += _bpWarnSvg(bx + totalBw + 2, rowY + ROW_H/2 + 4, '#ef4444');
          } else {
            // Normaler Balken
            const bw = (drillEndD && drillEndD !== startD) ? Math.max(COL_W, xFor(drillEndD)+COL_W-bx) : COL_W;
            svg += `<rect x="${bx}" y="${rowY+6}" width="${bw}" height="${ROW_H-12}" rx="3" fill="${col}" opacity="${isSelected ? '1' : '0.65'}" style="cursor:grab;" data-fp-pair="${p.id}" data-fp-move="${p.id}" data-fp-paket="${z.paketId}" ${strokeAttr}/>`;
            svg += `<rect x="${bx-2}" y="${rowY}" width="${Math.max(bw+4, COL_W)}" height="${ROW_H}" fill="transparent" style="cursor:grab;" data-fp-pair="${p.id}" data-fp-move="${p.id}" data-fp-paket="${z.paketId}"/>`;
            if (bw > 28) {
              const nLbl = z.bohrSchichten?.length ? z.bohrSchichten.length+' Sch.' : '1 Sch.';
              svg += `<text x="${bx+4}" y="${rowY+ROW_H/2+4}" font-size="9" fill="white" font-weight="600" font-family="system-ui" style="pointer-events:none;">${nLbl}</text>`;
            }
            if (isOutside) svg += _bpWarnSvg(bx + bw + 2, rowY + ROW_H/2 + 4, '#ef4444');
          }

          // Aushärte-Balken startet nach Betonphase (oder Bohrphase wenn kein Betonteil)
          const cureBaseD = betonEndD || drillEndD;
          if (cureBaseD) {
            const cureStart = bpFmtDate(bpAddDays(bpParseDate(cureBaseD), 1));
            const cureT     = bpAushaerteTage(z, einst, pakete);
            const cureEnd   = z.ausschaltermin||bpFmtDate(bpAddDays(bpParseDate(cureBaseD), cureT));
            const cx = xFor(cureStart);
            const cw = Math.max(COL_W, xFor(cureEnd)+COL_W-cx);
            svg += `<rect x="${cx}" y="${rowY+10}" width="${cw}" height="${ROW_H-20}" rx="2" fill="none" stroke="${col}" stroke-width="1" opacity="0.4" style="cursor:pointer;" data-cure-click="${p.id}"/>`;
            svg += `<text x="${xFor(cureBaseD)+COL_W+4}" y="${rowY+ROW_H/2}" font-size="8" fill="${col}" font-family="system-ui" dominant-baseline="middle" style="pointer-events:none;" opacity="0.6">${cureT}d</text>`;
          }
        }
      }
    }
    svg += `<line x1="0" y1="${rowY+h}" x2="${totalW}" y2="${rowY+h}" stroke="#f0f2f5" stroke-width="0.5"/>`;
    rowY += h;
  });

  // Meilenstein-Linien
  loadMeilensteine().forEach(ms => {
    const d = msMsResolvedDatum(ms);
    if (!d) return;
    const mx = xFor(d);
    if (mx < LEFT_W || mx > totalW) return;
    const col = ms.farbe || '#7c3aed';
    svg += `<line x1="${mx}" y1="${HEADER_H}" x2="${mx}" y2="${totalH}" stroke="${col}" stroke-width="1.5" stroke-dasharray="5,3" opacity="0.85" style="cursor:pointer;" data-ms-id="${ms.id}"/>`;
    const dy = HEADER_H + 10;
    svg += `<polygon points="${mx},${dy-6} ${mx+5},${dy} ${mx},${dy+6} ${mx-5},${dy}" fill="${col}" style="cursor:pointer;" data-ms-id="${ms.id}"/>`;
    const lbl = (ms.label||ms.typ).slice(0,18);
    svg += `<text x="${mx+7}" y="${HEADER_H+12}" font-size="8" fill="${col}" font-weight="700" font-family="system-ui" style="pointer-events:none;">${lbl}</text>`;
  });

  // Freeze-Panel abschliessen: Kopfbereich abdecken, damit beim Scrollen keine
  // Balken unter der Spaltenkopfzeile durchscheinen, plus rechte Begrenzung.
  svgLeft = `<rect x="0" y="0" width="${LEFT_W}" height="${HEADER_H}" fill="white"/>`
    + svgLeft
    + `<line x1="${LEFT_W}" y1="0" x2="${LEFT_W}" y2="${totalH}" stroke="#d1d5db" stroke-width="1.5"/>`
    + `<line x1="0" y1="${HEADER_H}" x2="${LEFT_W}" y2="${HEADER_H}" stroke="#e5e7eb" stroke-width="1"/>`;

  // Hauptinhalt + fixierte Kopie der linken Spalte (translateX folgt scrollLeft)
  wrap.innerHTML =
    `<div style="position:relative;width:${totalW}px;">`
    + `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" style="display:block;min-width:${totalW}px;">${svg}</svg>`
    + `<div class="_bp-freeze" style="position:absolute;top:0;left:0;width:${LEFT_W}px;height:${totalH}px;z-index:6;pointer-events:none;will-change:transform;">`
    + `<svg xmlns="http://www.w3.org/2000/svg" width="${LEFT_W}" height="${totalH}" style="display:block;">${svgLeft}</svg>`
    + `</div></div>`;

  // Scroll-Listener: Panel horizontal mitfuehren (alten zuerst entfernen)
  if (wrap._bpFreezeScroll) wrap.removeEventListener('scroll', wrap._bpFreezeScroll);
  wrap._bpFreezeScroll = () => {
    const freeze = wrap.querySelector('._bp-freeze');
    if (freeze) freeze.style.transform = 'translateX(' + wrap.scrollLeft + 'px)';
  };
  wrap.addEventListener('scroll', wrap._bpFreezeScroll, { passive: true });
  wrap._bpFreezeScroll();

  // Baugruppen-Toggle per Klick
  wrap.querySelectorAll('[data-toggle-grp]').forEach(el => {
    el.addEventListener('click', () => {
      const gid = el.getAttribute('data-toggle-grp');
      if (_bpCollapsed.has(gid)) _bpCollapsed.delete(gid); else _bpCollapsed.add(gid);
      renderBpFundamenteGantt();
    });
  });
  wrap.querySelectorAll('[data-ms-id]').forEach(el => {
    const id = el.getAttribute('data-ms-id');
    el.onclick = () => openMeilensteinModal(id);
  });
  wrap.querySelectorAll('[data-cure-click]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      openAusschalModal(el.getAttribute('data-cure-click'));
    });
  });

  // Drag-Interaktionen anbinden (siehe _bpFundDragHandlerBinden)
  _bpFundDragHandlerBinden(wrap);
  _bpFundAuswahlAnzeige();

  // Wrap-Level-Listener nur einmal anhängen (verhindert Akkumulation bei Re-Renders)
  if (!wrap._fpListenersAttached) {
    wrap._fpListenersAttached = true;

    // Rechtsklick-Menü (Event-Delegation, funktioniert auch nach SVG-Rebuild)
    wrap.addEventListener('contextmenu', e => {
      const bar = e.target.closest('[data-fp-pair]');
      if (!bar) return;
      e.preventDefault();
      showFpCtxMenu(bar.getAttribute('data-fp-pair'), e.clientX, e.clientY);
    });

    // Klick auf Hintergrund: Selektion aufheben
    wrap.addEventListener('pointerdown', e => {
      if (e.target.closest('[data-fp-move]') || e.target.closest('[data-fp-abbruch-move]')) return;
      if (e.ctrlKey || e.shiftKey || e.metaKey) return;
      if (_bpFundSelection.size > 0) {
        _bpFundSelection.forEach(pid => {
          const el2 = wrap.querySelector(`[data-fp-move="${pid}"]`);
          if (el2) _fpSetBarSelected(el2, false);
        });
        _bpFundSelection.clear();
        _bpFundLastClick = null;
        _bpFundAuswahlAnzeige();
      }
    });
  }
}

// Kompakte Paket-Legende unterhalb des Gantt
function renderBpLegende() {
  const wrap   = document.getElementById('bp-gantt-wrap');
  if (!wrap) return;
  const pakete = loadBaupakete();
  const zuw    = loadSchichtZuw();
  const pairs  = getFilteredSorted();
  const spList = loadSperrmuster();
  const einst  = loadProjEinst();

  // Existierendes Legende-Div entfernen / erneuern
  let leg = document.getElementById('bp-legende');
  if (!leg) {
    leg = document.createElement('div');
    leg.id = 'bp-legende';
    wrap.parentElement.insertBefore(leg, wrap.nextSibling);
  }

  const items = pakete.map(pak => {
    const assignedPairs  = pairs.filter(p => zuw[p.id]?.paketId === pak.id);
    const cnt            = assignedPairs.length;
    const col            = pak.farbe || '#1a3a5c';
    // Gleise aus zugewiesenen Fundamenten ableiten
    const gleisSet = [...new Set(assignedPairs.map(p => p.gleis).filter(Boolean))];
    const gleisLabel = gleisSet.length
      ? `<span style="color:#6b7280;font-size:10px;padding:1px 5px;border-radius:4px;background:#f3f4f6;border:1px solid #e5e7eb;" title="Gleise">Gl. ${gleisSet.join(', ')}</span>`
      : '';
    const bd       = bpPaketBedarf(pak.id);
    const _überlast = bd.cnt > 0 && pak.anzahlNaechte && bd.bedarf > pak.anzahlNaechte;
    const bdLabel  = bd.cnt > 0 && pak.anzahlNaechte
      ? `${bd.bedarf}/${pak.anzahlNaechte}&nbsp;N.`
      : '';
    const kapSumLabel = bd.kapSum > 0
      ? `∑&nbsp;${Math.round(bd.kapSum * 10) / 10}/Sch.`
      : '';
    const _bdStyle = _überlast
      ? 'color:#dc2626;background:#fef2f2;border:1px solid #fca5a5;'
      : 'color:#374151;background:#f3f4f6;border:1px solid #e5e7eb;';
    const _bdRoh   = Math.round(bd.bedarfRoh * 10) / 10;
    const _bdTitle = _überlast
      ? `Überlast: Bedarf ${bd.bedarf} N. (${_bdRoh} rechnerisch) > verfügbare ${pak.anzahlNaechte} N.`
      : `Schicht-Bedarf / verfügbare Nächte — ${cnt} Standorte ≙ ${_bdRoh} Schichten`;
    return `<div style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:white;border:1px solid #e5e7eb;border-left:3px solid ${col};border-radius:6px;font-size:11px;">
      <span style="font-weight:700;color:${col};cursor:pointer;" onclick="openBaupaketModal('${pak.id}')" title="Bearbeiten">${pak.name}</span>
      ${pak.startDatum ? `<span style="color:#9ca3af;">${bpFmtDisplay(pak.startDatum)}</span>` : ''}
      ${gleisLabel}
      ${kapSumLabel ? `<span style="font-size:10px;font-weight:700;color:#374151;" title="Summierte Leistung aller zugewiesenen Standorte">${kapSumLabel}</span>` : ''}
      ${bdLabel ? `<span style="font-size:10px;font-weight:600;padding:1px 6px;border-radius:4px;${_bdStyle}" title="${_bdTitle}">${_überlast ? svgIcon('warnung',{groesse:10}) + '&nbsp;' : ''}${bdLabel}</span>` : ''}
      <span style="background:#f3f4f6;color:#374151;padding:1px 6px;border-radius:8px;font-weight:600;font-size:10px;">${cnt} St.</span>
    </div>`;
  }).join('');

  // «+ Baupaket» immer aktiv
  const addChip = `<div onclick="openBaupaketModal(null)"
    style="display:flex;align-items:center;gap:5px;padding:5px 12px;background:white;border:2px dashed #d1d5db;border-radius:6px;cursor:pointer;font-size:11px;color:#9ca3af;font-weight:600;transition:all 0.15s;"
    onmouseover="this.style.borderColor='#3b82f6';this.style.color='#3b82f6';this.style.background='#f0f4ff';"
    onmouseout="this.style.borderColor='#d1d5db';this.style.color='#9ca3af';this.style.background='white';">
    <span style="font-size:18px;font-weight:300;line-height:1;">+</span> Baupaket
  </div>`;

  leg.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:10px 0 2px;align-items:center;';
  leg.innerHTML = items + addChip;


  // Hinweis: Karte auf "Baupaket / Schicht" umschalten
  const hasZuw = Object.keys(zuw).length > 0;
  if (hasZuw && overviewMap && _overviewInfoLayer !== 'baupaket') {
    let hint = document.getElementById('bp-map-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'bp-map-hint';
      hint.style.cssText = 'font-size:11px;color:#3730a3;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:5px 10px;margin-top:6px;cursor:pointer;display:flex;align-items:center;gap:6px;';
      hint.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></svg> Karte jetzt auf «Baupaket / Schicht» umschalten';
      hint.onclick = () => { setOverviewInfoLayer('baupaket'); hint.remove(); };
      wrap.parentElement.insertBefore(hint, leg.nextSibling);
    }
  }
}

function updateBpInfoBar() {
  const pakete  = loadBaupakete();
  const zuw     = loadSchichtZuw();
  const allBp   = loadAllBauprojekt();
  const pairs   = getFilteredSorted();
  const einst   = loadProjEinst();
  const bar     = document.getElementById('bp-info-bar');
  if (!bar) return;

  const nbPairs   = pairs.filter(p => { const t=getPairBpTyp(p.id,allBp); return t==='neubau'||t==='abbruch-neubau'; });
  const abbPairs  = pairs.filter(p => { const t=getPairBpTyp(p.id,allBp); return t==='abbruch'||t==='abbruch-neubau'; });
  const sichPairs = pairs.filter(p => getPairBpTyp(p.id,allBp) === 'sicherung');
  const provPairs = pairs.filter(p => getPairBpTyp(p.id,allBp) === 'provisorium');

  const zugewNB   = nbPairs.filter(p => !!zuw[p.id]).length;
  const zugewABB  = abbPairs.filter(p => !!zuw[p.id]).length;
  const zugewSich = sichPairs.filter(p => !!zuw[p.id]).length;
  const zugewProv = provPairs.filter(p => !!zuw[p.id]).length;

  const abzug    = einst.abzugMinuten ? ' · Abzug: ' + einst.abzugMinuten + ' min/Schicht' : '';
  const pfahlAnz   = pairs.filter(p => zuw[p.id]?.isPfahlFund).length;
  const gruppenAnz = loadBaugruppen().length;
  const pfahlInfo  = pfahlAnz ? ' · ' + pfahlAnz + ' Pfahlfundamente in ' + gruppenAnz + ' Gruppen' : '';
  const abbInfo    = abbPairs.length  ? ' · Abbruch: '    + zugewABB  + '/' + abbPairs.length  : '';
  const sichInfo   = sichPairs.length ? ' · Sicherung: '  + zugewSich + '/' + sichPairs.length : '';
  const provInfo   = provPairs.length ? ' · Provisorium: ' + zugewProv + '/' + provPairs.length : '';
  const infoText   = pakete.length + ' Baupaket' + (pakete.length !== 1 ? 'e' : '')
    + ' · Neubau: ' + zugewNB + '/' + nbPairs.length + ' zugewiesen'
    + abbInfo + sichInfo + provInfo + abzug + pfahlInfo;

  // Baubeginn-Konflikt prüfen — Datum und offene Schritte zentral aus bpVoraussetzungen
  const vor          = bpVoraussetzungen();
  const baubeginnDat = vor.baubeginn || null;
  const bbHint = (!pakete.length && vor.naechsterSchritt)
    ? ' · ☆ Nächster Schritt: ' + vor.naechsterSchritt.text
    : '';
  const zuFrüh = baubeginnDat ? pakete.filter(p => p.startDatum && p.startDatum < baubeginnDat) : [];

  // Überlast-Prüfung: Pakete mit Bedarf > anzahlNaechte
  const überlastPaks = pakete.filter(p => {
    const bd = bpPaketBedarf(p.id);
    return bd.cnt > 0 && p.anzahlNaechte && bd.bedarf > p.anzahlNaechte;
  });

  // Text fuer ein JS-Stringliteral in einem onclick-Attribut absichern:
  // echte Zeilenumbrueche wuerden das Literal sonst zerreissen.
  const _jsStr = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');

  let chips = '';
  if (zuFrüh.length) {
    chips += `<span style="margin-left:8px;padding:2px 10px;border-radius:5px;background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;font-size:10px;font-weight:700;cursor:pointer;"
        title="${zuFrüh.map(p=>p.name+' startet '+bpFmtDisplay(p.startDatum)+' (vor Baubeginn '+bpFmtDisplay(baubeginnDat)+')').join('\n')}"
        onclick="ui.toast('Baupakete vor Baubeginn (${bpFmtDisplay(baubeginnDat)}):\\n\\n${zuFrüh.map(p=>p.name+': '+bpFmtDisplay(p.startDatum)).join('\\n')}', 'fehler')">
        ${svgIcon('warnung',{groesse:11})} ${zuFrüh.length} Paket${zuFrüh.length>1?'e':''} vor Baubeginn
      </span>`;
  }
  if (überlastPaks.length) {
    const _übDetail = überlastPaks.map(p => { const bd=bpPaketBedarf(p.id); return `${p.name}: Bedarf ${bd.bedarf} N. > ${p.anzahlNaechte} N.`; }).join('\n');
    chips += `<span style="margin-left:8px;padding:2px 10px;border-radius:5px;background:#fff7ed;border:1px solid #fed7aa;color:#ea580c;font-size:10px;font-weight:700;cursor:pointer;"
        title="${_übDetail}"
        onclick="ui.toast('Sperrmuster-Überlast:\\n\\n${_jsStr(_übDetail)}', 'fehler')">
        ${svgIcon('blitz',{groesse:11})} ${überlastPaks.length} Paket${überlastPaks.length>1?'e':''} überlastet
      </span>`;
  }

  if (chips) {
    bar.innerHTML = `<span>${infoText}${bbHint}</span>` + chips;
  } else {
    bar.textContent = infoText + bbHint;
  }
}

// ── Gantt SVG ─────────────────────────────────────────────────
// Leerzustand des Gantt: Hinweis + Einstiegs-Buttons. «Auto-Pakete» ist
// erst moeglich, wenn ein Baubeginn-Meilenstein mit Datum existiert.
// Leerzustand des Bauprogramms.
// Vorher waren der Kasten «Offene Schritte» und die Knopfleiste beide
// inline-level in einem zentrierten Container — dadurch rutschten sie
// nebeneinander und überlappten. Jetzt eine klare Blockfolge:
// Überschrift → Erklärung → offene Schritte → Aktionen.
function _bpGanttLeerHtml() {
  const vor  = bpVoraussetzungen();
  const IKON = {
    meilenstein: '<svg width="12" height="12" viewBox="-1 -1 2 2" aria-hidden="true"><polygon points="0,-1 1,0 0,1 -1,0" fill="currentColor"/></svg>',
    auto: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    plus: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  };

  // Auto-Pakete bleibt klickbar und erklaert sich beim Klick selbst
  const autoBtn = vor.kannPakete
    ? '<button onclick="autoGenerateBaupakete()" class="btn btn-primary btn-sm">' + IKON.auto + ' Auto-Pakete</button>'
    : '<button onclick="autoGenerateBaupakete()" class="btn btn-ghost btn-sm" style="cursor:help;"'
      + ' title="Zuerst: ' + escHtml(vor.naechsterSchritt.text) + '">' + IKON.auto + ' Auto-Pakete</button>';
  const msBtn = !vor.baubeginn
    ? '<button onclick="openMeilensteinModal(null)" class="btn btn-secondary btn-sm">' + IKON.meilenstein + ' Meilenstein</button>'
    : '';

  const schritte = vor.fehlend.length
    ? '<div style="max-width:420px;margin:0 auto 18px;text-align:left;background:var(--c-warning-bg);'
      + 'border:1px solid var(--c-warning-border);border-radius:var(--r-md);padding:10px 14px;'
      + 'font-size:var(--fs-sm);color:var(--c-warning-fg);">'
      + '<div style="font-weight:700;margin-bottom:5px;">Offene Schritte</div>'
      + '<ol style="margin:0;padding-left:18px;line-height:1.7;">'
      + vor.fehlend.map(f => '<li>' + escHtml(f.text) + '</li>').join('')
      + '</ol></div>'
    : '';

  return '<div style="padding:40px 20px;text-align:center;">'
    + '<div style="font-size:var(--fs-lg);font-weight:600;color:var(--c-text);margin-bottom:6px;">Noch keine Baupakete vorhanden</div>'
    + '<div style="font-size:var(--fs-md);color:var(--c-text-muted);margin-bottom:18px;line-height:1.6;">'
    + 'Baupakete manuell über «Baupaket» anlegen<br>oder automatisch mit «Auto-Pakete» generieren lassen.</div>'
    + schritte
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">'
    + msBtn + autoBtn
    + '<button onclick="openBaupaketModal(null)" class="btn btn-secondary btn-sm">' + IKON.plus + ' Baupaket</button>'
    + '</div></div>';
}

// Zebrastreifen, Wochenend-/Feiertagsraster und Heute-Linie als SVG.
// Liefert getrennte Fragmente fuer Hauptflaeche und Freeze-Panel links.
function _bpGanttHintergrundSvg(g) {
  let inner = '', left = '';

  g.rows.forEach((row, ri) => {
    const y = g.HEADER_H + ri * g.ROW_H;
    const fill = ri % 2 === 0 ? '#ffffff' : '#f9fafb';
    inner += '<rect x="0" y="' + y + '" width="' + g.totalW + '" height="' + g.ROW_H + '" fill="' + fill + '"/>';
    left  += '<rect x="0" y="' + y + '" width="' + g.LEFT_W + '" height="' + g.ROW_H + '" fill="' + fill + '"/>';
  });

  // Wochenende + Feiertage nur in der Tagesansicht sinnvoll
  if (_bpZoom === 'tag') {
    const feiertage = chFeiertage(g.projStart.getFullYear());
    if (g.projEnd.getFullYear() !== g.projStart.getFullYear()) {
      chFeiertage(g.projEnd.getFullYear()).forEach(d => feiertage.add(d));
    }
    g.cols.forEach((col, ci) => {
      const x   = g.LEFT_W + ci * g.z.colW;
      const dow = col.getDay();                 // 0=So, 6=Sa
      const isFt = feiertage.has(bpFmtDate(col));
      if (dow === 0 || dow === 6 || isFt) {
        inner += '<rect x="' + x + '" y="' + g.HEADER_H + '" width="' + g.z.colW + '" height="' + (g.totalH - g.HEADER_H) + '" fill="' + (isFt ? 'rgba(239,68,68,0.07)' : 'rgba(148,163,184,0.10)') + '" style="pointer-events:none;"/>';
      }
    });
  }

  const todayX = g.xForDate(bpFmtDate(new Date()));
  if (todayX >= g.LEFT_W && todayX <= g.totalW) {
    inner += '<line x1="' + todayX + '" y1="' + g.HEADER_H + '" x2="' + todayX + '" y2="' + g.totalH + '" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.6"/>';
    inner += '<text x="' + (todayX+2) + '" y="' + (g.totalH-4) + '" font-size="9" fill="#ef4444" font-family="system-ui">Heute</text>';
  }
  return { inner, left };
}

function renderBpGantt(targetId = 'bp-gantt-wrap', karteMode = false) {
  const wrap   = document.getElementById(targetId);
  if (!wrap) return;
  const pakete = loadBaupakete();
  if (!pakete.length) { wrap.innerHTML = _bpGanttLeerHtml(); return; }

  // Schichtzuweisungen + Standorte für Mast-Labels (alle Typen)
  const zuw   = loadSchichtZuw();
  const pairs = getFilteredSorted();
  const allBpGantt = loadAllBauprojekt();
  const einstGantt = loadProjEinst();   // für die Aushärtestrecke der Balken

  // Datumsbereich: Pakete + Meilensteine einschliessen
  const _msList    = loadMeilensteine();
  const _msDatums  = _msList.map(m => msMsResolvedDatum(m)).filter(Boolean).map(d => bpFmtDate(bpParseDate(d)));
  // Fertigstellung statt Arbeitsende: sonst wird die Aushärtestrecke abgeschnitten
  const allDaten   = [...pakete.flatMap(p => [p.startDatum, bpPaketFertig(p, zuw, einstGantt)]), ..._msDatums].filter(Boolean).sort();
  if (!allDaten.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:30px;color:#9ca3af;font-size:12px;">Baupaket ohne Startdatum — bitte Baupaket öffnen und Datum setzen.</div>';
    return;
  }
  // Padding links (4 Einheiten) für freies Rückwärts-Scrollen
  const _padLeft   = { tag: 7, woche: 28, monat: 60, jahr: 180 }[_bpZoom] ?? 14;
  const projStart  = bpAddDays(bpParseDate(allDaten[0]), -_padLeft);
  const projEnd    = bpAddDays(bpParseDate(allDaten[allDaten.length - 1]), 14);

  // Zoom-Parameter
  const ZOOM = {
    tag:   { unit:'day',   colW:28, fmtHeader: d => d.getDate()+'.', fmtGroup: d => d.toLocaleDateString('de-CH',{weekday:'short'}) },
    woche: { unit:'week',  colW:44, fmtHeader: d => 'KW'+_isoWeek(d), fmtGroup: d => d.toLocaleDateString('de-CH',{month:'short',year:'2-digit'}) },
    monat: { unit:'month', colW:50, fmtHeader: d => d.toLocaleDateString('de-CH',{month:'short'}), fmtGroup: d => String(d.getFullYear()) },
    jahr:  { unit:'year',  colW:90, fmtHeader: d => String(d.getFullYear()), fmtGroup: d => Math.floor(d.getFullYear()/5)*5 + 'er' },
  };
  const z = ZOOM[_bpZoom] || ZOOM.monat;
  _bpZoomColW = z.colW;

  // Spalten (Zeiteinheiten) berechnen
  const cols = [];
  let cur = new Date(projStart);
  while (cur <= projEnd) {
    cols.push(new Date(cur));
    if (_bpZoom === 'tag')   cur.setDate(cur.getDate() + 1);
    else if (_bpZoom === 'woche') cur.setDate(cur.getDate() + 7);
    else if (_bpZoom === 'jahr') cur.setFullYear(cur.getFullYear() + 1);
    else cur.setMonth(cur.getMonth() + 1);
  }

  // Teams für Zeilen — Pakete ohne Teamzuweisung je eigene Zeile
  const einst = loadProjEinst();
  const teams = einst.teams || [];
  const rowKey = p => p.teamId || ('__pak__' + p.id);
  const rowKeys = [...new Set(pakete.map(rowKey))];
  const rows = rowKeys.map(rk => {
    if (!rk.startsWith('__pak__')) {
      const team = teams.find(t => t.id === rk);
      return { tid: rk, label: team ? team.name : 'Kein Los', pakete: pakete.filter(p => p.teamId === rk) };
    }
    const pak = pakete.find(p => ('__pak__' + p.id) === rk);
    return { tid: rk, label: pak?.name || 'Kein Los', pakete: pak ? [pak] : [] };
  });

  const ROW_H = 72;
  const _HEADER_DATE_H = 64;   // Höhe des Datums-Headers (KW-Zeilen)
  const LEFT_W = 100;
  const spList = loadSperrmuster();
  const SP_STRIP_H = 18;       // Höhe pro Sperrmuster-Streifen (dezent, 2 Zeilen à 7-8 px)
  const SP_BAND_H = spList.length > 0 ? spList.length * SP_STRIP_H + 4 : 0;
  const HEADER_H = _HEADER_DATE_H + SP_BAND_H;   // Gesamt-Header
  const totalW = LEFT_W + cols.length * z.colW;
  const totalH = HEADER_H + rows.length * ROW_H + 16;

  // x-Position eines Datums
  const xForDate = dateStr => {
    const d = bpParseDate(dateStr);
    if (!d) return LEFT_W;
    if (_bpZoom === 'tag') {
      return LEFT_W + bpDayDiff(bpFmtDate(projStart), dateStr) * z.colW;
    } else if (_bpZoom === 'woche') {
      const weeks = Math.floor(bpDayDiff(bpFmtDate(projStart), dateStr) / 7);
      return LEFT_W + weeks * z.colW;
    } else if (_bpZoom === 'jahr') {
      const years = (d.getFullYear() - projStart.getFullYear()) + (d.getMonth() - projStart.getMonth()) / 12;
      return LEFT_W + years * z.colW;
    } else {
      const months = (d.getFullYear() - projStart.getFullYear()) * 12 + (d.getMonth() - projStart.getMonth());
      return LEFT_W + months * z.colW;
    }
  };
  // Breite der ARBEITSSTRECKE (letzte Arbeitsnacht). Bleibt Bezug für den
  // Resize-Griff, der anzahlNaechte verändert.
  const wForPak = pak => {
    if (!pak.startDatum || !pak.anzahlNaechte) return z.colW;
    const endStr = bpPaketEnd(pak);
    if (!endStr) return Math.max((pak.anzahlNaechte || 1) * z.colW, 22);
    return Math.max(xForDate(endStr) - xForDate(pak.startDatum) + z.colW, 22);
  };
  // Beschriftungszusatz: Fertigstellung nur nennen, wenn sie nach der letzten
  // Arbeitsnacht liegt — sonst steht zweimal dasselbe Datum im Balkenlabel.
  const _fertigTxt = pak => {
    const f = bpPaketFertig(pak, zuw, einstGantt);
    return (f && f > bpPaketEnd(pak)) ? '  ·  ausgeschalt ' + bpFmtDisplay(f) : '';
  };
  // Breite bis zur FERTIGSTELLUNG (letztes Fundament ausgehärtet).
  const wForPakGesamt = pak => {
    if (!pak.startDatum) return z.colW;
    const fertig = bpPaketFertig(pak, zuw, einstGantt);
    if (!fertig) return wForPak(pak);
    return Math.max(xForDate(fertig) - xForDate(pak.startDatum) + z.colW, wForPak(pak));
  };

  // SVG aufbauen
  // Schraffur für die Aushärtestrecke der Paketbalken
  let svgInner = '<defs><pattern id="bp-aushaerte-muster" width="6" height="6"'
    + ' patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
    + '<rect width="6" height="6" fill="#ffffff"/>'
    + '<line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" stroke-width="2"/>'
    + '</pattern></defs>';
  let svgLeft  = ''; // Freeze-Panel: linke Spalte (Left_W Breite, folgt scrollLeft)

  // Hintergrund: Zebrastreifen, Wochenenden/Feiertage, Heute-Linie
  {
    const bg = _bpGanttHintergrundSvg({ rows, cols, z, LEFT_W, HEADER_H, ROW_H,
                                        totalW, totalH, projStart, projEnd, xForDate });
    svgInner += bg.inner;
    svgLeft  += bg.left;
  }

  // Spalten-Trennlinien + Header (mit KW in Tag-Ansicht + Wetter)
  let prevGroup = '';
  let prevKw = -1;

  cols.forEach((col, ci) => {
    const x   = LEFT_W + ci * z.colW;
    const ds  = bpFmtDate(col);
    const group = z.fmtGroup(col);
    // Tag-Ansicht: KW-Block übernimmt Gruppierung — generisches Gruppen-Label weglassen
    if (group !== prevGroup && _bpZoom !== 'tag') {
      svgInner += '<text x="' + (x+2) + '" y="13" font-size="10" fill="#9ca3af" font-weight="600" font-family="system-ui">' + group + '</text>';
    }
    prevGroup = group;

    // KW-Marker in Tag-Ansicht (am Montag oder Spaltenstart)
    if (_bpZoom === 'tag') {
      const kw = _isoWeek(col);
      if (kw !== prevKw) {
        svgInner += '<rect x="' + x + '" y="0" width="' + (z.colW*7) + '" height="16" fill="rgba(148,163,184,0.06)" style="pointer-events:none;"/>';
        svgInner += '<text x="' + (x+3) + '" y="12" font-size="9" fill="#64748b" font-weight="700" font-family="system-ui">KW' + kw + '</text>';
        prevKw = kw;
      }
      // Wochentag-Name (Zeile 2)
      const dow    = col.getDay();
      const dowLbl = ['So','Mo','Di','Mi','Do','Fr','Sa'][dow];
      const isWe   = dow === 0 || dow === 6;
      const dayCol = isWe ? '#94a3b8' : '#374151';
      svgInner += '<text x="' + (x+z.colW/2) + '" y="25" font-size="9" fill="' + (isWe?'#94a3b8':'#6b7280') + '" text-anchor="middle" font-family="system-ui">' + dowLbl + '</text>';
      svgInner += '<text x="' + (x+z.colW/2) + '" y="38" font-size="10" fill="' + dayCol + '" text-anchor="middle" font-weight="' + (isWe?'400':'600') + '" font-family="system-ui">' + col.getDate() + '</text>';
    } else {
      svgInner += '<text x="' + (x + z.colW/2) + '" y="40" font-size="11" fill="#6b7280" text-anchor="middle" font-family="system-ui">' + z.fmtHeader(col) + '</text>';
    }

    svgInner += '<line x1="' + x + '" y1="' + (HEADER_H-2) + '" x2="' + x + '" y2="' + totalH + '" stroke="#f0f2f5" stroke-width="1"/>';
  });

  // ── Sperrmuster-Band ──────────────────────────────────────────
  if (spList.length > 0) {
    // Hintergrund des Bands
    svgInner += '<rect x="0" y="' + _HEADER_DATE_H + '" width="' + totalW + '" height="' + SP_BAND_H + '" fill="#f8fafc" style="pointer-events:none;"/>';
    // Trennlinie unten
    svgInner += '<line x1="0" y1="' + HEADER_H + '" x2="' + totalW + '" y2="' + HEADER_H + '" stroke="#d1d5db" stroke-width="1"/>';

    // Hilfsfunktion: prüft ob ein Datum im Sperrmuster aktiv ist
    const spIsActive = (sp, ds, dow) => {
      if (sp.gueltigVon && ds < sp.gueltigVon) return false;
      if (sp.gueltigBis && ds > sp.gueltigBis) return false;
      if (sp.wochentage?.length && !sp.wochentage.includes(dow)) return false;
      return true;
    };

    spList.forEach((sp, si) => {
      const bandY  = _HEADER_DATE_H + si * SP_STRIP_H + 2;
      const stripH = SP_STRIP_H - 4;   // 14 px nutzbarer Balken
      const col    = sp.farbe || '#64748b';

      // Linke Spalte: Name + Gleis · nettoH  (in svgInner UND svgLeft für Freeze-Panel)
      const _spBgY = _HEADER_DATE_H + si * SP_STRIP_H;
      svgInner += '<rect x="0" y="' + _spBgY + '" width="' + LEFT_W + '" height="' + SP_STRIP_H + '" fill="#f8fafc"/>';
      svgLeft  += '<rect x="0" y="' + _spBgY + '" width="' + LEFT_W + '" height="' + SP_STRIP_H + '" fill="#f8fafc"/>';
      const _spSub = [sp.gleisNr ? 'Gl. ' + sp.gleisNr : '', sp.nettoH ? sp.nettoH + ' h' : ''].filter(Boolean).join(' · ');
      const _spTxtA = _spSub
        ? '<text x="' + (LEFT_W - 5) + '" y="' + (bandY + 7) + '" font-size="8" fill="' + col + '" font-weight="700" text-anchor="end" font-family="system-ui" style="pointer-events:none;">' + sp.name.slice(0, 16) + '</text>'
          + '<text x="' + (LEFT_W - 5) + '" y="' + (bandY + 14) + '" font-size="7" fill="#9ca3af" text-anchor="end" font-family="system-ui" style="pointer-events:none;">' + _spSub + '</text>'
        : '<text x="' + (LEFT_W - 5) + '" y="' + (bandY + stripH/2 + 3) + '" font-size="8" fill="' + col + '" font-weight="700" text-anchor="end" font-family="system-ui" style="pointer-events:none;">' + sp.name.slice(0, 16) + '</text>';
      svgInner += _spTxtA;
      svgLeft  += _spTxtA;
      const _spSepLine = '<line x1="' + LEFT_W + '" y1="' + _spBgY + '" x2="' + LEFT_W + '" y2="' + (_spBgY + SP_STRIP_H) + '" stroke="#e5e7eb" stroke-width="1"/>';
      svgInner += _spSepLine;
      svgLeft  += _spSepLine;

      if (_bpZoom === 'tag') {
        // Tag-Zoom: pro Tag einzelne Bars
        cols.forEach((c, ci) => {
          const ds  = bpFmtDate(c);
          const dow = c.getDay();
          if (!spIsActive(sp, ds, dow)) return;
          const cx = LEFT_W + ci * z.colW;
          svgInner += '<rect x="' + (cx+1) + '" y="' + bandY + '" width="' + (z.colW-2) + '" height="' + stripH + '" fill="' + col + '" opacity="0.35" rx="2" style="pointer-events:none;"/>';
        });
      } else {
        // Woche/Monat/Jahr: für jede Spalte prüfen welcher Anteil der Tage aktiv ist
        cols.forEach((c, ci) => {
          const cx = LEFT_W + ci * z.colW;
          const colEnd = new Date(c);
          if (_bpZoom === 'woche')      colEnd.setDate(colEnd.getDate() + 6);
          else if (_bpZoom === 'monat') { colEnd.setMonth(colEnd.getMonth() + 1); colEnd.setDate(0); }
          else                          { colEnd.setFullYear(colEnd.getFullYear() + 1); colEnd.setDate(0); }
          let active = 0, total = 0;
          for (let d = new Date(c); d <= colEnd; d.setDate(d.getDate() + 1)) {
            total++;
            if (spIsActive(sp, bpFmtDate(d), d.getDay())) active++;
          }
          if (!active) return;
          const op = (0.15 + (active / Math.max(total, 1)) * 0.30).toFixed(2);
          svgInner += '<rect x="' + (cx+1) + '" y="' + bandY + '" width="' + (z.colW-2) + '" height="' + stripH + '" fill="' + col + '" opacity="' + op + '" rx="2" style="pointer-events:none;"/>';
        });
      }

      // Gültigkeitsgrenzen als vertikale Markierungslinien
      if (sp.gueltigVon) {
        const vx = xForDate(sp.gueltigVon);
        if (vx >= LEFT_W && vx <= totalW)
          svgInner += '<line x1="' + vx + '" y1="' + bandY + '" x2="' + vx + '" y2="' + (bandY + stripH) + '" stroke="' + col + '" stroke-width="2" style="pointer-events:none;"/>';
      }
      if (sp.gueltigBis) {
        const vx = xForDate(sp.gueltigBis) + z.colW;
        if (vx >= LEFT_W && vx <= totalW)
          svgInner += '<line x1="' + vx + '" y1="' + bandY + '" x2="' + vx + '" y2="' + (bandY + stripH) + '" stroke="' + col + '" stroke-width="2" style="pointer-events:none;"/>';
      }

      // Horizontale Trennlinie zwischen Streifen
      if (si < spList.length - 1) {
        svgInner += '<line x1="' + LEFT_W + '" y1="' + (_HEADER_DATE_H + (si+1) * SP_STRIP_H) + '" x2="' + totalW + '" y2="' + (_HEADER_DATE_H + (si+1) * SP_STRIP_H) + '" stroke="#e5e7eb" stroke-width="0.5" style="pointer-events:none;"/>';
      }
    });
  }

  // Team-Labels (linke Spalte) — in svgInner UND svgLeft
  rows.forEach((row, ri) => {
    const y = HEADER_H + ri * ROW_H;
    const _lblRect  = '<rect x="0" y="' + y + '" width="' + LEFT_W + '" height="' + ROW_H + '" fill="white"/>';
    const _lblText  = '<text x="8" y="' + (y + ROW_H/2 + 5) + '" font-size="12" fill="#374151" font-weight="600" font-family="system-ui">' + row.label.slice(0,12) + '</text>';
    const _lblBorder = '<line x1="' + LEFT_W + '" y1="' + y + '" x2="' + LEFT_W + '" y2="' + (y+ROW_H) + '" stroke="#e5e7eb" stroke-width="1"/>';
    svgInner += _lblRect + _lblText + _lblBorder;
    svgLeft  += _lblRect + _lblText + _lblBorder;
  });

  // Baubeginn-Meilenstein für Konflikt-Markierung
  const _bbMs  = loadMeilensteine().find(m => m.typ === 'baubeginn');
  const _bbDat = _bbMs ? msMsResolvedDatum(_bbMs) : null;

  // Paket-Balken + Abhängigkeitspfeile
  rows.forEach((row, ri) => {
    const y = HEADER_H + ri * ROW_H;
    row.pakete.forEach(pak => {
      if (!pak.startDatum) return;
      const x  = xForDate(pak.startDatum);
      const w  = wForPak(pak);
      const col  = pak.farbe || '#1a3a5c';
      const barY = y + 6;
      const barH = ROW_H - 12;

      // Auslastung: Schicht-Bedarf vs. verfügbare Nächte
      const { bedarf: bpBedarf } = bpPaketBedarf(pak.id);
      const load = bpBedarf > 0
        ? bpBedarf / Math.max(1, pak.anzahlNaechte || 1)
        : (pairs.filter(p => zuw[p.id]?.paketId === pak.id).length) / Math.max(1, pak.anzahlNaechte || 1);
      const barFill = col;

      // Aushärtestrecke: vom Ende der letzten Arbeitsnacht bis das zuletzt
      // betonierte Fundament ausgehärtet ist. Bewusst schraffiert und ohne
      // Schatten — es wird nicht gearbeitet, der Abschnitt bleibt aber belegt.
      const wGes = wForPakGesamt(pak);
      if (wGes > w + 1) {
        svgInner += '<rect x="' + (x + w) + '" y="' + (barY + 3) + '" width="' + (wGes - w) + '" height="' + (barH - 6)
                 +  '" rx="3" fill="url(#bp-aushaerte-muster)" stroke="' + col + '" stroke-width="1"'
                 +  ' stroke-dasharray="3,2" opacity="0.55" style="pointer-events:none;"/>';
      }

      // Schatten
      svgInner += '<rect x="' + (x+2) + '" y="' + (barY+2) + '" width="' + w + '" height="' + barH + '" rx="4" fill="rgba(0,0,0,0.08)"/>';

      // Basisfläche (gedimmt = freie Kapazität)
      svgInner += '<rect x="' + x + '" y="' + barY + '" width="' + w + '" height="' + barH + '" rx="4" fill="' + barFill + '" opacity="0.35" style="cursor:pointer;"/>';

      // Clip-Pfad (abgerundete Ecken)
      svgInner += '<clipPath id="cp-' + pak.id + '"><rect x="' + x + '" y="' + barY + '" width="' + w + '" height="' + barH + '" rx="4"/></clipPath>';

      // Solide Streifen nur für tatsächlich zugewiesene Schichten (nicht nur Sperrmuster-Kapazität)
      const _assignedNrs = new Set();
      Object.values(zuw).forEach(z2 => {
        if (z2.paketId === pak.id && z2.schichtNr != null) _assignedNrs.add(z2.schichtNr);
        z2.bohrSchichten?.forEach(bs => { if (bs.paketId === pak.id && bs.schichtNr != null) _assignedNrs.add(bs.schichtNr); });
      });
      if (_assignedNrs.size > 0) {
        const _schichtSet = new Set(bpGetSchichten(pak).filter(s => _assignedNrs.has(s.schichtNr)).map(s => s.datum));
        cols.forEach((col, ci) => {
          const cx = LEFT_W + ci * z.colW;
          const colEnd = new Date(col);
          if      (_bpZoom === 'woche') colEnd.setDate(colEnd.getDate() + 6);
          else if (_bpZoom === 'monat') { colEnd.setMonth(colEnd.getMonth() + 1); colEnd.setDate(colEnd.getDate() - 1); }
          else if (_bpZoom === 'jahr')  { colEnd.setFullYear(colEnd.getFullYear() + 1); colEnd.setDate(colEnd.getDate() - 1); }
          let hasShift = false;
          for (let d = new Date(col); d <= colEnd && !hasShift; d.setDate(d.getDate() + 1)) {
            if (_schichtSet.has(bpFmtDate(d))) hasShift = true;
          }
          if (hasShift) {
            svgInner += '<rect x="' + cx + '" y="' + barY + '" width="' + (z.colW + 1) + '" height="' + barH + '" fill="' + barFill + '" opacity="0.72" clip-path="url(#cp-' + pak.id + ')" style="pointer-events:none;"/>';
          }
        });
      }

      // Überlast-Streifen (rot, rechts am Rand)
      if (load > 1.05) {
        svgInner += '<rect x="' + (x+w-6) + '" y="' + barY + '" width="6" height="' + barH + '" fill="#ef4444" opacity="0.85" style="pointer-events:none;"/>';
      }

      // Baubeginn-Konflikt: roter Rahmen + Warnsymbol
      if (_bbDat && pak.startDatum < _bbDat) {
        svgInner += '<rect x="' + x + '" y="' + barY + '" width="' + w + '" height="' + barH + '" rx="4" fill="none" stroke="#dc2626" stroke-width="2" stroke-dasharray="4,3" style="pointer-events:none;"/>';
        if (w > 22) svgInner += _bpWarnSvg(x + w - 15, barY + barH/2 + 4, '#dc2626', 12);
      }

      // Klickbares / ziehbares Rect (mittlerer Bereich, Handles ausschliessen)
      const clickAttr = karteMode
        ? 'data-bp-karte="' + pak.id + '"'
        : 'data-bp-modal="' + pak.id + '" data-bp-move="' + pak.id + '" data-bp-start="' + pak.startDatum + '" data-bp-ctx="' + pak.id + '"';
      svgInner += '<rect x="' + (x+6) + '" y="' + barY + '" width="' + Math.max(1, w-12) + '" height="' + barH + '" rx="4" fill="transparent" style="cursor:grab;" ' + clickAttr + '/>';

      // Resize-Handle rechts (verlängert/kürzt anzahlNaechte)
      if (!karteMode && w > 14) {
        svgInner += '<rect x="' + (x+w-5) + '" y="' + (barY+4) + '" width="5" height="' + (barH-8) + '" rx="2" fill="rgba(255,255,255,0.60)" style="cursor:ew-resize;" data-bp-resize="' + pak.id + '" data-bp-side="right" data-bp-start="' + pak.startDatum + '" data-bp-naechte="' + pak.anzahlNaechte + '"/>';
        svgInner += '<line x1="' + (x+w-2) + '" y1="' + (barY+8) + '" x2="' + (x+w-2) + '" y2="' + (barY+barH-8) + '" stroke="rgba(0,0,0,0.22)" stroke-width="1" style="pointer-events:none;"/>';
      }

      // Label links vom Paket (ausserhalb, immer lesbar)
      const labelAvail = x - LEFT_W - 6;
      if (labelAvail > 20) {
        const lblClipId = 'lbl-cp-' + pak.id;
        svgInner += '<clipPath id="' + lblClipId + '"><rect x="' + LEFT_W + '" y="' + barY + '" width="' + Math.max(0, labelAvail) + '" height="' + barH + '"/></clipPath>';
        const lblX = x - 6;
        svgInner += '<text x="' + lblX + '" y="' + (barY + 15) + '" font-size="11" fill="#1a3a5c" font-weight="700" font-family="system-ui" text-anchor="end" clip-path="url(#' + lblClipId + ')" style="pointer-events:none;">' + pak.name + '</text>';
        if (pak.startDatum) {
          const nStr = pak.anzahlNaechte ? ' · ' + pak.anzahlNaechte + ' N.' : '';
          svgInner += '<text x="' + lblX + '" y="' + (barY + 28) + '" font-size="9" fill="#6b7280" font-family="system-ui" text-anchor="end" clip-path="url(#' + lblClipId + ')" style="pointer-events:none;">' + bpFmtDisplay(pak.startDatum) + ' – ' + bpFmtDisplay(bpPaketEnd(pak)) + nStr + _fertigTxt(pak) + '</text>';
        }
      }

      // Mastnummern im Balken (kurze Liste)
      const assigned = pairs.filter(p => zuw[p.id]?.paketId === pak.id);
      if (assigned.length && w > 20) {
        const maxMasts = Math.max(1, Math.floor(w / 22));
        const mastNrs  = assigned.map(p => p.mast || '?');
        const mastText = assigned.length <= maxMasts
          ? mastNrs.join(' · ')
          : mastNrs.slice(0, maxMasts - 1).join(' · ') + ' +' + (assigned.length - (maxMasts - 1));
        svgInner += '<text x="' + (x + w/2) + '" y="' + (barY + barH/2 + 4) + '" font-size="9" fill="rgba(255,255,255,0.90)" font-family="system-ui" text-anchor="middle" clip-path="url(#cp-' + pak.id + ')" style="pointer-events:none;">' + mastText + '</text>';
      }

      // Schicht-Trennlinien (Tage-Zoom)
      for (let s = 1; s < (pak.anzahlNaechte||1); s++) {
        const sx = xForDate(bpFmtDate(bpAddDays(bpParseDate(pak.startDatum), s)));
        if (_bpZoom === 'tag') svgInner += '<line x1="' + sx + '" y1="' + (barY+3) + '" x2="' + sx + '" y2="' + (barY+barH-3) + '" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>';
      }
    });
  });

  // Abhängigkeitspfeile
  pakete.forEach(pak => {
    if (!pak.vorgaengerId) return;
    const vorg = pakete.find(p => p.id === pak.vorgaengerId);
    if (!vorg) return;
    const vorgRi = rows.findIndex(r => r.pakete.some(p => p.id === vorg.id));
    const pakRi  = rows.findIndex(r => r.pakete.some(p => p.id === pak.id));
    if (vorgRi < 0 || pakRi < 0) return;
    // Rechte Kante des Vorgaengerbalkens. wForPakGesamt misst ab dessen START-
    // datum bis zur Fertigstellung — genau der Punkt, ab dem die Kaskade den
    // Nachfolger rechnet. Frueher wurde die volle Balkenbreite auf das ENDdatum
    // addiert, wodurch der Pfeil um (Balkenlaenge − 1 Spalte) zu weit rechts
    // begann; danach zeigte er auf die letzte Arbeitsnacht statt aufs Ausschalen.
    const x1 = xForDate(vorg.startDatum) + wForPakGesamt(vorg);
    const y1 = HEADER_H + vorgRi * ROW_H + ROW_H/2;
    const x2 = xForDate(pak.startDatum);
    const y2 = HEADER_H + pakRi * ROW_H + ROW_H/2;
    svgInner += '<path d="M' + x1 + ',' + y1 + ' C' + (x1+15) + ',' + y1 + ' ' + (x2-15) + ',' + y2 + ' ' + x2 + ',' + y2 + '" stroke="#94a3b8" stroke-width="1.5" fill="none" stroke-dasharray="4,2"/>';
    svgInner += '<polygon points="' + x2 + ',' + y2 + ' ' + (x2-6) + ',' + (y2-3) + ' ' + (x2-6) + ',' + (y2+3) + '" fill="#94a3b8"/>';
  });

  // Horizontale Trennlinien zwischen Zeilen
  rows.forEach((_, ri) => {
    const y = HEADER_H + ri * ROW_H;
    svgInner += '<line x1="0" y1="' + y + '" x2="' + totalW + '" y2="' + y + '" stroke="#e5e7eb" stroke-width="0.5"/>';
  });
  svgInner += '<line x1="0" y1="' + HEADER_H + '" x2="' + totalW + '" y2="' + HEADER_H + '" stroke="#e5e7eb" stroke-width="1"/>';

  // Meilenstein-Linien (über alles, mit Edge-Indikatoren für ausserhalb-Bereich)
  const _msStrip = []; // für den nicht-scrollbaren Strip unten
  _msList.forEach(ms => {
    const d = msMsResolvedDatum(ms);
    if (!d) return;
    const mx  = xForDate(d);
    const col = ms.farbe || '#7c3aed';
    const lbl = (ms.label || ms.typ).slice(0, 24);
    const dateStr = bpFmtDisplay(d);
    _msStrip.push({ ms, col, lbl, dateStr, mx });

    if (mx >= LEFT_W && mx <= totalW) {
      // Normal: senkrechte Linie + Raute + Label
      svgInner += '<line x1="' + mx + '" y1="' + HEADER_H + '" x2="' + mx + '" y2="' + totalH + '" stroke="' + col + '" stroke-width="1.5" stroke-dasharray="5,3" opacity="0.85" style="cursor:pointer;" data-ms-id="' + ms.id + '"/>';
      const dy = HEADER_H + 10;
      svgInner += '<polygon points="' + mx + ',' + (dy-7) + ' ' + (mx+6) + ',' + dy + ' ' + mx + ',' + (dy+7) + ' ' + (mx-6) + ',' + dy + '" fill="' + col + '" style="cursor:pointer;" data-ms-id="' + ms.id + '"/>';
      svgInner += '<text x="' + (mx+8) + '" y="' + (HEADER_H+14) + '" font-size="9" fill="' + col + '" font-weight="700" font-family="system-ui" style="pointer-events:none;">' + lbl + '</text>';
      svgInner += '<text x="' + (mx+8) + '" y="' + (HEADER_H+24) + '" font-size="8" fill="' + col + '" opacity="0.8" font-family="system-ui" style="pointer-events:none;">' + dateStr + '</text>';
    } else {
      // Edge-Indikator: Raute am Rand + Pfeil-Label
      const isLeft = mx < LEFT_W;
      const ex = isLeft ? LEFT_W + 4 : totalW - 4;
      const dy = HEADER_H + 10;
      // Raute am Rand
      svgInner += '<polygon points="' + ex + ',' + (dy-7) + ' ' + (ex+6) + ',' + dy + ' ' + ex + ',' + (dy+7) + ' ' + (ex-6) + ',' + dy + '" fill="' + col + '" opacity="0.7" style="cursor:pointer;" data-ms-id="' + ms.id + '"/>';
      // Pfeil-Linie
      const arrowX2 = isLeft ? ex + 14 : ex - 14;
      svgInner += '<line x1="' + (isLeft ? ex+6 : ex-6) + '" y1="' + dy + '" x2="' + arrowX2 + '" y2="' + dy + '" stroke="' + col + '" stroke-width="1.5" opacity="0.6" style="pointer-events:none;"/>';
      // Label
      const tx = isLeft ? ex + 16 : ex - 8;
      const anchor = isLeft ? 'start' : 'end';
      svgInner += '<text x="' + tx + '" y="' + (HEADER_H+14) + '" font-size="9" fill="' + col + '" font-weight="700" font-family="system-ui" text-anchor="' + anchor + '" style="cursor:pointer;" data-ms-id="' + ms.id + '">' + (isLeft ? '◀ ' : '') + lbl + (!isLeft ? ' ▶' : '') + '</text>';
      svgInner += '<text x="' + tx + '" y="' + (HEADER_H+24) + '" font-size="8" fill="' + col + '" opacity="0.8" font-family="system-ui" text-anchor="' + anchor + '" style="pointer-events:none;">' + dateStr + '</text>';
    }
  });

  // Freeze-Panel abschliessen: Header-Hintergrund + rechter Rand + Zeilen-Trennlinien
  const _ff = "'Segoe UI',system-ui,sans-serif";
  svgLeft = '<rect x="0" y="0" width="' + LEFT_W + '" height="' + HEADER_H + '" fill="white"/>'
    + svgLeft
    + '<line x1="' + LEFT_W + '" y1="0" x2="' + LEFT_W + '" y2="' + totalH + '" stroke="#d1d5db" stroke-width="1.5"/>'
    + '<line x1="0" y1="' + HEADER_H + '" x2="' + LEFT_W + '" y2="' + HEADER_H + '" stroke="#e5e7eb" stroke-width="1"/>'
    + rows.map((_, ri) => '<line x1="0" y1="' + (HEADER_H + ri * ROW_H) + '" x2="' + LEFT_W + '" y2="' + (HEADER_H + ri * ROW_H) + '" stroke="#e5e7eb" stroke-width="0.5"/>').join('');

  // SVG rendern — Hauptinhalt + Freeze-Overlay (translateX per scroll-Event synchronisiert)
  wrap.innerHTML =
    '<div style="position:relative;width:' + totalW + 'px;">'
    + '<svg width="' + totalW + '" height="' + totalH + '" style="display:block;font-family:' + _ff + ';">' + svgInner + '</svg>'
    + '<div class="_bp-freeze" style="position:absolute;top:0;left:0;width:' + LEFT_W + 'px;height:' + totalH + 'px;z-index:6;pointer-events:none;will-change:transform;">'
    + '<svg width="' + LEFT_W + '" height="' + totalH + '" style="display:block;font-family:' + _ff + ';">' + svgLeft + '</svg>'
    + '</div></div>';

  // Scroll-Listener: Freeze-Panel horizontal mitführen
  if (wrap._bpFreezeScroll) wrap.removeEventListener('scroll', wrap._bpFreezeScroll);
  wrap._bpFreezeScroll = () => {
    const freeze = wrap.querySelector('._bp-freeze');
    if (freeze) freeze.style.transform = 'translateX(' + wrap.scrollLeft + 'px)';
  };
  wrap.addEventListener('scroll', wrap._bpFreezeScroll, { passive: true });
  // Initialen Zustand sofort setzen (falls scrollLeft bereits > 0 beim Neu-Render)
  wrap._bpFreezeScroll();

  // Meilenstein-Strip (nicht scrollbar, immer sichtbar)
  let msStripEl = document.getElementById(targetId + '-ms-strip');
  if (!msStripEl) {
    msStripEl = document.createElement('div');
    msStripEl.id = targetId + '-ms-strip';
    msStripEl.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:6px 0 2px;align-items:center;';
    wrap.parentElement.insertBefore(msStripEl, wrap.nextSibling);
  }
  msStripEl.innerHTML = _msStrip.map(({ ms, col, lbl, dateStr }) =>
    `<div onclick="openMeilensteinModal('${ms.id}')" title="Zu Meilenstein scrollen"
      style="display:flex;align-items:center;gap:4px;padding:3px 9px 3px 7px;border-radius:12px;
             background:${col}18;border:1px solid ${col}55;cursor:pointer;font-size:10px;font-weight:600;color:${col};white-space:nowrap;"
      onmouseover="this.style.background='${col}30'" onmouseout="this.style.background='${col}18'">
      <svg width="9" height="9" viewBox="-1 -1 2 2"><polygon points="0,-1 1,0 0,1 -1,0" fill="${col}"/></svg>
      ${lbl} <span style="font-weight:400;opacity:0.7;margin-left:2px;">${dateStr}</span>
    </div>`
  ).join('');

  // onclick direkt auf Rect-Elemente setzen (zuverlässiger als Attribute im SVG-String)
  wrap.querySelectorAll('[data-bp-karte]').forEach(el => {
    const id = el.getAttribute('data-bp-karte');
    el.style.cursor = 'pointer';
    el.onclick = () => bpKarteClick(id);
  });
  wrap.querySelectorAll('[data-bp-modal]').forEach(el => {
    const id = el.getAttribute('data-bp-modal');
    el.style.cursor = 'pointer';
    el.onclick = () => openBaupaketModal(id);
  });
  wrap.querySelectorAll('[data-ms-id]').forEach(el => {
    const id = el.getAttribute('data-ms-id');
    el.style.cursor = 'ew-resize';
    el.onpointerdown = e => {
      e.preventDefault(); e.stopPropagation();
      const ms = loadMeilensteine().find(m => m.id === id);
      if (!ms) return;
      // Berechnete Meilensteine (nach-paket, nach-ausschal-gruppe) nicht per DnD verschiebbar
      const abhTyp = ms.abh?.typ || 'manuell';
      if (abhTyp !== 'manuell') { openMeilensteinModal(id); return; }
      const datum = msMsResolvedDatum(ms) || ms.datum;
      _bpMsDrag = { msId: id, origDatum: datum, startX: e.clientX, currentDatum: datum, moved: false };
    };
  });
  wrap.querySelectorAll('[data-bp-resize]').forEach(el => {
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const naechte = parseInt(el.getAttribute('data-bp-naechte'));
      const start   = el.getAttribute('data-bp-start');
      _bpResizeDrag = {
        pakId:          el.getAttribute('data-bp-resize'),
        side:           el.getAttribute('data-bp-side') || 'right',
        startX:         e.clientX,
        startNaechte:   naechte,
        startDatum:     start,
        currentNaechte: naechte,
        currentStart:   start,
      };
    });
  });
  wrap.querySelectorAll('[data-bp-move]').forEach(el => {
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      _bpMoveDrag = {
        pakId:        el.getAttribute('data-bp-move'),
        origStart:    el.getAttribute('data-bp-start'),
        startX:       e.clientX,
        currentStart: el.getAttribute('data-bp-start'),
        moved:        false,
      };
    });
  });

  // Kontextmenü nur einmal anhängen
  if (!wrap._bpPakCtxAttached) {
    wrap._bpPakCtxAttached = true;
    wrap.addEventListener('contextmenu', e => {
      const bar = e.target.closest('[data-bp-ctx]');
      if (!bar) return;
      e.preventDefault();
      showBpPakCtxMenu(bar.getAttribute('data-bp-ctx'), e.clientX, e.clientY);
    });
  }

  updateBpInfoBar();
}

// ── Baupaket auf Karte hervorheben ───────────────────────────────────────────
let _bpHighlightPaketId = null;

function showBaupaketOnMap(paketId) {
  if (paketId !== _bpHighlightPaketId) _bpLayerFilter = { schichtNr: null, datum: null, mast: '' };
  _bpHighlightPaketId = paketId;
  setOverviewView('karte');
  setTimeout(() => {
    refreshBpMapHighlight();
    // Auf zugeordnete Standorte zoomen
    const zuw   = loadSchichtZuw();
    const pairs = getFilteredSorted();
    const active = pairs.filter(p => zuw[p.id]?.paketId === paketId);
    if (overviewMap && active.length) {
      const latlngs = active.map(p => {
        const lat = parseFloat(p.lat_fund || p.lat_rs || p.lat_rks);
        const lng = parseFloat(p.lng_fund || p.lng_rs || p.lng_rks);
        return (isFinite(lat) && isFinite(lng)) ? [lat, lng] : null;
      }).filter(Boolean);
      if (latlngs.length === 1) {
        overviewMap.setView(latlngs[0], 15);
      } else if (latlngs.length > 1) {
        overviewMap.fitBounds(latlngs, { padding: [40, 40], maxZoom: 16 });
      }
    }
  }, 200);
}

function clearBaupaketMapHighlight() {
  _bpHighlightPaketId = null;
  refreshBpMapHighlight();
}

function refreshBpMapHighlight() {
  if (!overviewMap || !overviewMarkers?.length) return;
  const paketId = _bpHighlightPaketId;
  const zuw    = typeof loadSchichtZuw === 'function' ? loadSchichtZuw() : {};
  const pakete = typeof loadBaupakete  === 'function' ? loadBaupakete()  : [];
  const pak    = pakete.find(p => p.id === paketId);
  const activeCol = pak?.farbe || '#1a3a5c';
  const f = _bpLayerFilter;
  const hasFilter = paketId && (f.schichtNr != null || f.datum);
  const pakSchichten = hasFilter ? (typeof bpGetSchichten === 'function' ? bpGetSchichten(pak) : []) : [];
  const sz = 30;

  overviewMarkers.forEach(({ pairId, rs }) => {
    if (!rs) return;
    const z = zuw[pairId];
    let isActive = !paketId || z?.paketId === paketId;
    if (isActive && hasFilter) {
      if (f.schichtNr != null && z?.schichtNr !== f.schichtNr) isActive = false;
      if (isActive && f.datum) {
        const s = pakSchichten.find(x => x.schichtNr === z?.schichtNr);
        if (s?.datum !== f.datum) isActive = false;
      }
    }
    const p = PAIRS.find(x => x.id === pairId);
    const label = p?.mast || '?';
    if (isActive) {
      rs.setIcon(L.divIcon({
        html: `<div style="background:${activeCol};color:white;border-radius:50%;width:${sz}px;height:${sz}px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);line-height:1;">M${label}</div>`,
        iconSize:[sz,sz], iconAnchor:[sz/2,sz/2], className:''
      }));
      rs.setOpacity(1);
    } else {
      rs.setIcon(L.divIcon({
        html: `<div style="background:#d1d5db;color:#9ca3af;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:600;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.15);line-height:1;">M${label}</div>`,
        iconSize:[22,22], iconAnchor:[11,11], className:''
      }));
      rs.setOpacity(0.35);
    }
  });

  // Reset-Button im Bauprogramm-Tab einblenden
  const resetBtn = document.getElementById('bp-map-reset-btn');
  if (resetBtn) resetBtn.style.display = paketId ? 'flex' : 'none';
}

// ── Vollbild-Bauprogramm ──────────────────────────────────────
let _bpFsMapOpen            = false;
let _bpFsHighlightPaket     = null;
let _bpFsMapMoved           = false;
let _bpFsPrevInfoLayer      = null; // gespeicherter InfoLayer-Zustand vor Vollbild
let _bpZuwSelected      = new Set();
let _bpZuwSort          = 'mast';
let _bpZuwSortDir       = 1;
let _ftSelected         = new Set();
let _ftBulkIds          = null;   // null = Einzelbearbeitung; Array = Sammelbearbeitung
let _ftBulkMixed        = new Set(); // Felder mit unterschiedlichen Werten über Selektion

function openBpFullscreen(paketId) {
  const overlay = document.getElementById('bp-fullscreen-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  const _pakete = loadBaupakete();
  _bpFsHighlightPaket = paketId || (_pakete.length ? _pakete[0].id : null);
  renderBpGantt('bp-fs-gantt-wrap', true);
  _renderBpFsLegende();
  const sub = document.getElementById('bp-fs-subtitle');
  if (sub) sub.textContent = document.getElementById('bp-info-bar')?.textContent || '';
  document.addEventListener('keydown', _bpFsKeyClose);
  // Karte immer einblenden
  const pane = document.getElementById('bp-fs-map-pane');
  if (pane) pane.style.display = 'block';
  _bpFsMapOpen = true;
  _moveFsMap();
  // Info-Layer auf "Baupaket / Schicht" setzen
  _bpFsPrevInfoLayer = _overviewInfoLayer;
  setOverviewInfoLayer('baupaket');
}

function closeBpFullscreen() {
  document.getElementById('bp-fullscreen-overlay').style.display = 'none';
  _restoreFsMap();
  _bpFsMapOpen = false;
  _bpFsHighlightPaket = null;
  document.removeEventListener('keydown', _bpFsKeyClose);
  // Info-Layer wiederherstellen
  if (_bpFsPrevInfoLayer) { setOverviewInfoLayer(_bpFsPrevInfoLayer); _bpFsPrevInfoLayer = null; }
}

function _bpFsKeyClose(e) {
  if (e.key === 'Escape') {
    // ESC zuerst nativen Vollbild beenden — Overlay bleibt offen
    if (document.fullscreenElement) return;
    closeBpFullscreen();
  }
}

function toggleBpNativeFs() {
  if (!document.fullscreenElement) {
    document.getElementById('bp-fullscreen-overlay')?.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

document.addEventListener('fullscreenchange', () => {
  const btn = document.getElementById('bp-fs-native-btn');
  if (!btn) return;
  if (document.fullscreenElement) {
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>`;
    btn.title = 'Vollbild beenden';
  } else {
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
    btn.title = 'Nativer Vollbild';
  }
});

function toggleBpFsMap() {
  _bpFsMapOpen = !_bpFsMapOpen;
  const pane = document.getElementById('bp-fs-map-pane');
  if (pane) pane.style.display = _bpFsMapOpen ? 'block' : 'none';
  if (_bpFsMapOpen) _moveFsMap();
  else _restoreFsMap();
}

// Die Legende bleibt, wo sie auf jeder Karte steht: als Leaflet-Steuerung
// unten links. Im Bauprogramm-Vollbild wird sie nur aufgeklappt und etwas
// breiter — dort steckt der Bauablauf-Schieber, der hier das Werkzeug ist und
// auf schmalen Geraeten sonst hinter dem zugeklappten Koerper liegt.
function _bpFsLegendeUmhaengen(insVollbild) {
  const leg = document.getElementById('ov-legend-outer');
  if (!leg) return;
  leg.classList.toggle('legende-gross', !!insVollbild);
  if (insVollbild) leg.querySelector('#ov-legend-body')?.classList.remove('ov-legend-collapsed');
}

// Verschiebt #overview-map in den Vollbild-Pane und zeigt Paket-Highlight
function _moveFsMap() {
  if (_bpFsMapMoved) {
    // Bereits verschoben: nur Highlight + Zoom aktualisieren
    _bpHighlightPaketId = _bpFsHighlightPaket;
    refreshBpMapHighlight();
    setTimeout(() => _bpFsZoomToHighlight(), 50);
    return;
  }
  const mapEl = document.getElementById('overview-map');
  const pane  = document.getElementById('bp-fs-map-pane');
  if (!mapEl || !pane) return;
  // Karte initialisieren falls noch nicht geschehen
  if (!overviewMap) {
    pane.style.display = 'block';
    initOverviewMap();
  }
  pane.insertBefore(mapEl, pane.firstChild);
  // Die Standort-Navigation gehoert zur Karte, nicht zum Uebersichtskasten —
  // sonst bliebe sie beim Verschieben zurueck und man koennte im Vollbild
  // keinen Mast mehr anfahren.
  // Bedienelemente der Karte wandern mit: Standort-Navigation oben,
  // Kartenart, Transparenz und Bahn-Suche unten. Blieben sie im
  // Uebersichtskasten zurueck, waere die Vollbildkarte nicht mehr bedienbar.
  const nav       = document.getElementById('ov-nav-halter');
  const navHalter = document.getElementById('bp-fs-nav-halter');
  if (nav && navHalter) {
    navHalter.appendChild(nav);
    nav.classList.add('im-kopf');
    // Wer direkt ins Bauprogramm geht, hat die Uebersichtskarte nie geoeffnet
    // — die Zeile ist dann noch leer.
    ovNavAktualisieren();
  }
  // Kartenart, Transparenz und Bahn-Suche bleiben im Uebersichtskasten: hier
  // wuerden sie die Karte zustellen, und dieselben Einstellungen stehen im
  // Rechtsklickmenue der Karte (showMapCtxMenu) wie auf den uebrigen Karten.
  _bpFsLegendeUmhaengen(true);
  mapEl.style.height       = '100%';
  mapEl.style.width        = '100%';
  mapEl.style.borderRadius = '0';
  _bpFsMapMoved = true;
  // invalidateSize zuerst — dann Highlight und Zoom nachgelagert damit Containergrö sse bekannt ist
  setTimeout(() => {
    overviewMap?.invalidateSize();
    _bpHighlightPaketId = _bpFsHighlightPaket;
    refreshBpMapHighlight();
    setTimeout(() => _bpFsZoomToHighlight(), 100);
  }, 150);
}

// Verschiebt #overview-map zurück in den ursprünglichen Karte-Bereich
function _restoreFsMap() {
  if (!_bpFsMapMoved) return;
  const mapEl = document.getElementById('overview-map');
  const wrap  = document.getElementById('overview-map-wrap');
  if (!mapEl || !wrap) return;
  wrap.insertBefore(mapEl, wrap.firstChild);
  const nav = document.getElementById('ov-nav-halter');
  if (nav) { wrap.appendChild(nav); nav.classList.remove('im-kopf'); }
  _bpFsLegendeUmhaengen(false);
  mapEl.style.height       = '';
  mapEl.style.width        = '';
  mapEl.style.borderRadius = '';
  _bpFsMapMoved = false;
  _bpHighlightPaketId = null;
  refreshBpMapHighlight();
  setTimeout(() => overviewMap?.invalidateSize(), 100);
  const pane = document.getElementById('bp-fs-map-pane');
  if (pane) pane.style.display = 'none';
}

// Zoomt overviewMap auf die dem aktiven Paket zugeordneten Standorte
function _bpFsZoomToHighlight() {
  if (!overviewMap || !_bpFsHighlightPaket) return;
  const zuw = loadSchichtZuw();
  // Koordinaten direkt aus den bereits platzierten overviewMarkers lesen
  const latlngs = overviewMarkers
    .filter(m => m.rs && zuw[m.pairId]?.paketId === _bpFsHighlightPaket)
    .map(m => { const ll = m.rs.getLatLng(); return [ll.lat, ll.lng]; });
  if (latlngs.length === 1) {
    overviewMap.setView(latlngs[0], 15, { animate: true });
  } else if (latlngs.length > 1) {
    overviewMap.fitBounds(latlngs, { padding: [40, 40], maxZoom: 16, animate: true });
  }
}

// Karte-Button in Legende: Vollbild-Karte oder Übersichtskarte
function bpKarteClick(paketId) {
  if (document.getElementById('bp-fullscreen-overlay')?.style.display !== 'none') {
    // Filter zurücksetzen wenn Paket wechselt
    if (paketId !== _bpFsHighlightPaket) _bpLayerFilter = { schichtNr: null, datum: null, mast: '' };
    _bpFsHighlightPaket = paketId;
    _bpHighlightPaketId = paketId;
    if (!_bpFsMapOpen) {
      toggleBpFsMap();
    } else {
      refreshBpMapHighlight();
      _bpFsZoomToHighlight();
    }
    // Gantt-Legende (bp-fs-legende) Aktivzustand aktualisieren
    const pakete = loadBaupakete();
    document.querySelectorAll('[data-bp-leg]').forEach(el => {
      const pak    = pakete.find(p => p.id === el.dataset.bpLeg);
      const col    = pak?.farbe || '#1a3a5c';
      const active = el.dataset.bpLeg === paketId;
      el.style.background = active ? col + '18' : 'white';
      el.style.borderLeft = '3px solid ' + (active ? col : '#e5e7eb');
      el.style.boxShadow  = active ? '0 1px 5px ' + col + '44' : 'none';
    });
    updateOverviewLegend('baupaket');
  } else {
    showBaupaketOnMap(paketId);
  }
}

// Legende im Vollbild (mit bpKarteClick statt showBaupaketOnMap)
function _renderBpFsLegende() {
  const leg = document.getElementById('bp-fs-legende');
  if (!leg) return;
  const pakete = loadBaupakete();
  const zuw    = loadSchichtZuw();
  const pairs  = getFilteredSorted();
  const spList = loadSperrmuster();
  const einst  = loadProjEinst();

  leg.innerHTML = pakete.map(pak => {
    const assignedPairs = pairs.filter(p => zuw[p.id]?.paketId === pak.id);
    const cnt           = assignedPairs.length;
    const col           = pak.farbe || '#1a3a5c';
    const gleisSet = [...new Set(assignedPairs.map(p => p.gleis).filter(Boolean))];
    const gleisLabel = gleisSet.length
      ? `<span style="color:#6b7280;font-size:10px;padding:1px 5px;border-radius:4px;background:#f3f4f6;border:1px solid #e5e7eb;" title="Gleise">Gl. ${gleisSet.join(', ')}</span>`
      : '';
    const isActive = pak.id === _bpFsHighlightPaket;
    return `<div data-bp-leg="${pak.id}" onclick="bpKarteClick('${pak.id}')"
      style="display:flex;align-items:center;gap:6px;padding:5px 10px;
        background:${isActive ? col+'18' : 'white'};
        border:1px solid #e5e7eb;border-left:3px solid ${isActive ? col : '#e5e7eb'};
        border-radius:6px;font-size:11px;cursor:pointer;
        box-shadow:${isActive ? '0 1px 5px '+col+'44' : 'none'};
        transition:background 0.15s,box-shadow 0.15s;">
      <span style="font-weight:700;color:${col};">${pak.name}</span>
      ${pak.startDatum ? `<span style="color:#9ca3af;">${bpFmtDisplay(pak.startDatum)}</span>` : ''}
      ${pak.anzahlNaechte ? `<span style="color:#6b7280;">${pak.anzahlNaechte} N.</span>` : ''}
      ${gleisLabel}
      <span style="background:${col}22;color:${col};padding:1px 6px;border-radius:8px;font-weight:700;">${cnt} St.</span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="${col}" stroke="none" style="opacity:0.7;flex-shrink:0;"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
    </div>`;
  }).join('');
}

// ISO Wochennummer
function _isoWeek(d) {
  const tmp = new Date(d);
  tmp.setHours(0,0,0,0);
  tmp.setDate(tmp.getDate() + 3 - (tmp.getDay() + 6) % 7);
  const jan4 = new Date(tmp.getFullYear(), 0, 4);
  return 1 + Math.round(((tmp - jan4) / 86400000 - 3 + (jan4.getDay() + 6) % 7) / 7);
}

// Badge-Hilfsfunktion: Typ eines Standorts (Neubau / Prov / Abbruch etc.)
function _bpMassnahmeTyp(bp) {
  const b = bp?.bestand, m = bp?.massnahme;
  if (b === 'prov' || (bp?.fundtyp||'').startsWith('spezial-prov'))
    return { label:'PROV', color:'#166534', bg:'#dcfce7', border:'#86efac' };
  if (m === 'abbruch')
    return { label:'A+N',  color:'#92400e', bg:'#fef3c7', border:'#fcd34d' };
  if (m === 'abbruch-nur')
    return { label:'ABB',  color:'#92400e', bg:'#fef3c7', border:'#fcd34d' };
  if (m === 'sicherung')
    return { label:'SIC',  color:'#9a3412', bg:'#ffedd5', border:'#fdba74' };
  if (m === 'erhalten')
    return { label:'BST',  color:'#374151', bg:'#f3f4f6', border:'#d1d5db' };
  return { label:'NB',   color:'#991b1b', bg:'#fee2e2', border:'#fca5a5' };
}

// ── Schichtzuweisung-Tabelle ──────────────────────────────────
function setBpZuwSort(col) {
  if (_bpZuwSort === col) _bpZuwSortDir = _bpZuwSortDir === 1 ? -1 : 1;
  else { _bpZuwSort = col; _bpZuwSortDir = 1; }
  renderBpZuweisungTable();
}

// Eine Zeile der Bauprogramm-Zuweisungstabelle als HTML.
// rowMode: 'neubau' | 'abbruch' | 'sicherung' | 'provisorium'
// showControls: Dropdowns anzeigen; zuwData: alternativer Zuweisungs-Store
// (fuer die ABB-Zeile bei abbruch-neubau). ctx buendelt die Tabellen-
// konstanten und geladenen Listen aus renderBpZuweisungTable().
function _bpZuwZeileHtml(p, rowMode, showControls, zuwData, ctx) {
  const { allBp, baugruppen, einst, ftList, ftZuw, gerOpts, pakOpts, pakete, stLabels, stStyles, stVals, tdS, zuw } = ctx;
    if (rowMode === true)  rowMode = 'abbruch';   // backward compat
    if (rowMode === false) rowMode = 'neubau';
    const isSpecialRow = rowMode !== 'neubau';    // steuert Betoniertermin/Ausschaltermin-Logik
    const ftId  = ftZuw[p.id];
    let   ft    = ftList.find(t => t.id === ftId);
    // Fallback: FT per Name aus BP-Daten suchen wenn keine direkte ID-Zuweisung
    if (!ft) {
      const ftNameFb = (allBp[p.id] || {}).fundtyp || '';
      if (ftNameFb) ft = _findFtInCache(ftList, ftNameFb);
    }
    const bp2   = allBp[p.id] || {};
    const massnahme = bp2.massnahme || '';

    const z = (zuwData || zuw)[p.id] || {};

    // Typ-Badge je nach Modus
    const rowTypInfo = rowMode === 'abbruch'
      ? { label:'ABB',  color:'#b45309', bg:'#fef3c7', border:'#fde68a' }
      : rowMode === 'sicherung'
      ? { label:'SICH', color:'#6b7280', bg:'#f3f4f6', border:'#d1d5db' }
      : rowMode === 'provisorium'
      ? { label:'PROV', color:'#4b7c59', bg:'#f0fdf4', border:'#d1fae5' }
      : _bpMassnahmeTyp(bp2);
    const typBadge = '<span style="font-size:9px;font-weight:700;padding:2px 5px;border-radius:3px;color:' + rowTypInfo.color + ';background:' + rowTypInfo.bg + ';border:1px solid ' + rowTypInfo.border + ';white-space:nowrap;">' + rowTypInfo.label + '</span>';

    const istPfahl     = !!(z.isPfahlFund && z.bohrSchichten?.length);
    const baugruppe    = istPfahl ? baugruppen.find(g => g.id === z.bauGruppeId) : null;
    // Abbruch + Sicherung: kein Betoniertermin; PROV: Betoniertermin ja
    const suppressBeton = rowMode === 'abbruch' || rowMode === 'sicherung';
    const betonierterm = suppressBeton ? null
      : (z.betoniertermin || (z.paketId && z.schichtNr ? bpSchichtDatum(z.paketId, z.schichtNr, pakete) : null));
    const ausschalterm = suppressBeton ? null
      : (z.ausschaltermin || (betonierterm ? bpFmtDate(bpAddDays(bpParseDate(betonierterm), bpAushaerteTage(z, einst))) : null));
    const pak       = pakete.find(pk => pk.id === z.paketId);
    const schichten = pak ? bpGetSchichten(pak) : [];
    // SP pro Fundament: p.gleis hat Vorrang (Gleis kann von Paket-Gleis abweichen)
    const _schDatum = schichten.find(s => s.schichtNr === z.schichtNr)?.datum || schichten[0]?.datum || pak?.startDatum;
    const sp    = _schDatum
      ? (resolveSpForGleis(p.gleis, _schDatum) || resolveSpForPak(pak, _schDatum))
      : (pak ? resolveSpForPak(pak, pak.startDatum) : null);
    const kap   = getFtLeistung(ft, sp?.nettoH, einst.abzugMinuten);

    const schOpts = '<option value="">—</option>' +
      schichten.map(s => '<option value="' + s.schichtNr + '"' + (z.schichtNr == s.schichtNr ? ' selected' : '') + '>Schicht ' + s.schichtNr + ' (' + bpFmtDisplay(s.datum) + ')</option>').join('');
    const pakCol = pak?.farbe || '#9ca3af';

    const rowSuffix = rowMode === 'neubau' ? '' : '-' + rowMode;
    const rowId = 'bp-zuw-row-' + p.id + rowSuffix;
    const bgRow = rowMode === 'abbruch'    ? '#fdfaf9'
                : rowMode === 'sicherung'  ? '#fdfaf8'
                : rowMode === 'provisorium'? '#f9fdfb'
                : (zuw[p.id] ? 'white' : '#fafafa');
    const sel = rowMode === 'neubau' && _bpZuwSelected.has(p.id);
    const rowBg = sel ? '#eff6ff' : bgRow;
    const rowBorder = sel ? 'outline:2px solid #3b82f6;outline-offset:-2px;' : '';

    // ABB-Zeilen (abbruch-neubau) nutzen eigenen Store und eigene Save-Funktion
    const isAbbRow = rowMode === 'abbruch' && zuwData !== null;
    const saveSchichtFn = isAbbRow
      ? 'saveBpAbbZuweisung(' + p.id + ',this.value,\'paket\')'
      : 'saveBpZuweisung(' + p.id + ',this.value,\'schicht\')';
    const savePaketFn = isAbbRow
      ? 'saveBpAbbZuweisung(' + p.id + ',this.value,\'schicht\')'
      : 'saveBpZuweisung(' + p.id + ',this.value,\'paket\')';
    const idPfx      = 'bp-zuw';
    // rowSuffix als ID-Teil nutzen damit ABB und NB nie kollidieren
    const pakInputId = idPfx + '-pak-' + p.id + rowSuffix;
    const schInputId = idPfx + '-sch-' + p.id + rowSuffix;

    const bedChips = !showControls ? '' : [
      { key:'gleisgebunden', label:'GL', color:'#b91c1c', bg:'#fee2e2', val: bp2.ausfGleisgebunden },
      { key:'hoehenbegr',    label:'HB', color:'#92400e', bg:'#fef3c7', val: bp2.ausfHoehenbegrenzung },
      { key:'abschaltung',   label:'FL', color:'#166534', bg:'#dcfce7', val: bp2.ausfAbschaltung },
      { key:'nachbargleis',  label:'NG', color:'#1d4ed8', bg:'#dbeafe', val: bp2.ausfNachbargleis },
    ].map(c => {
      const active = !!c.val;
      return '<span onclick="toggleBpBedingung(' + p.id + ',\'' + c.key + '\')" style="cursor:pointer;padding:2px 5px;border-radius:4px;font-size:9px;font-weight:700;border:1px solid ' + (active ? c.color : '#e5e7eb') + ';background:' + (active ? c.bg : 'white') + ';color:' + (active ? c.color : '#9ca3af') + ';" title="' + c.key + '">' + c.label + '</span>';
    }).join('');

    const stVal = !showControls ? 'geplant' : ((getPairData(p.id).status) || 'geplant');
    const [stBg, stFg] = stStyles[stVal] || ['#f3f4f6','#6b7280'];
    const selStOpts = stVals.map((v,j) =>
      '<option value="' + v + '"' + (stVal === v ? ' selected' : '') + '>' + stLabels[j] + '</option>'
    ).join('');

    const cbCell = '<td style="' + tdS + 'width:36px;text-align:center;"><input type="checkbox" ' + (sel ? 'checked' : '') + ' onclick="bpZuwToggleRow(' + p.id + ',this.checked)" style="width:14px;height:14px;cursor:pointer;accent-color:#3b82f6;"></td>';

    const verifyChips = '';
    const verifyBorder = '';

    return '<tr class="list-hover-row" style="background:' + rowBg + ';' + verifyBorder + rowBorder + '" id="' + rowId + '">'
      + cbCell
      + '<td style="' + tdS + 'font-weight:700;color:#1a3a5c;">Mast ' + (p.mast||'—') + '</td>'
      + '<td style="' + tdS + 'color:#6b7280;">' + (p.km_rs ? parseFloat(p.km_rs).toFixed(3) : '—') + '</td>'
      + '<td style="' + tdS + 'text-align:center;">' + typBadge + '</td>'
      + '<td style="' + tdS + '">'
        + (ft ? '<span onclick="openFundtypProfilModal(\'' + ft.id + '\')" title="' + _ftLabel(ft) + '" style="font-size:11px;color:#374151;cursor:pointer;display:inline-flex;align-items:baseline;gap:2px;max-width:200px;" onmouseover="this.style.color=\'#1d4ed8\'" onmouseout="this.style.color=\'#374151\'"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-decoration:underline;text-decoration-color:#d1d5db;">' + _ftLabel(ft) + '</span><span style="flex-shrink:0;white-space:nowrap;text-decoration:underline;text-decoration-color:#d1d5db;">↗</span></span>' : '<span style="color:#d1d5db;">—</span>')
        + (verifyChips ? '<div style="margin-top:3px;display:flex;gap:3px;flex-wrap:wrap;">' + verifyChips + '</div>' : '')
        + '</td>'
      + (istPfahl && rowMode === 'neubau'
        ? '<td style="' + tdS + '">'
            + (baugruppe ? '<span style="font-size:10px;background:#f0f4ff;color:#3730a3;padding:2px 6px;border-radius:4px;font-weight:600;">' + baugruppe.name + '</span> <button onclick="bpGruppeAufteilen(' + p.id + ')" title="In eigene Gruppe verschieben" style="padding:1px 6px;border-radius:4px;border:1px solid #d1d5db;background:white;font-size:10px;color:#6b7280;cursor:pointer;" onmouseover="this.style.background=\'#f3f4f6\'" onmouseout="this.style.background=\'white\'">↗</button>' : '<span style="color:#9ca3af;font-size:11px;">—</span>')
            + '</td>'
            + '<td style="' + tdS + 'font-size:11px;color:#374151;">'
            + '<div style="font-size:11px;color:#374151;white-space:nowrap;">'
            + z.bohrSchichten.length + ' Sch. · P1–' + z.bohrSchichten[z.bohrSchichten.length-1].pfahlBis
            + '</div>'
            + (baugruppe?.betoniertermin ? '<div style="font-size:10px;color:#059669;font-weight:600;white-space:nowrap;">' + bpFmtDisplay(baugruppe.betoniertermin) + (baugruppe.ausschaltermin ? ' <span style="color:#9ca3af;font-weight:400;">↗ ' + bpFmtDisplay(baugruppe.ausschaltermin) + '</span>' : '') + '</div>' : '')
            + '</td>'
            + '<td style="' + tdS + 'text-align:center;"><span style="color:#9ca3af;font-size:11px;">—</span></td>'
        : !showControls
          ? '<td style="' + tdS + '"><span style="color:#d1d5db;font-size:11px;">—</span></td>'
              + '<td style="' + tdS + '"><span style="color:#d1d5db;font-size:11px;">—</span></td>'
              + '<td style="' + tdS + 'text-align:center;"><span style="color:#d1d5db;">—</span></td>'
          : '<td style="' + tdS + '"><select onchange="' + saveSchichtFn + '" id="' + pakInputId + '" style="padding:4px 6px;border:1px solid #e5e7eb;border-radius:5px;font-size:11px;font-family:inherit;max-width:160px;' + (pak ? 'border-left:3px solid ' + pakCol + ';' : '') + '" data-pairid="' + p.id + '">' + pakOpts + '</select></td>'
              + '<td style="' + tdS + '"><select onchange="' + savePaketFn + '" id="' + schInputId + '" style="padding:4px 6px;border:1px solid #e5e7eb;border-radius:5px;font-size:11px;font-family:inherit;max-width:140px;">' + schOpts + '</select></td>'
              + '<td style="' + tdS + 'text-align:center;">' + (kap !== null ? '<span style="font-size:11px;color:#15803d;font-weight:600;">' + kap + '/Sch.</span>' : '<span style="color:#d1d5db;">—</span>') + '</td>'
        )
      + '<td style="' + tdS + 'white-space:nowrap;">' + (betonierterm ? '<span style="font-size:11px;color:#374151;">' + bpFmtDisplay(betonierterm) + '</span>' : '<span style="color:#d1d5db;">—</span>') + '</td>'
      + '<td style="' + tdS + 'white-space:nowrap;">' + (ausschalterm ? '<span style="font-size:11px;color:#9ca3af;">' + bpFmtDisplay(ausschalterm) + '</span>' : '<span style="color:#d1d5db;">—</span>') + '</td>'
      + '<td style="' + tdS + '">' + (!showControls ? '<span style="color:#9ca3af;font-size:11px;">—</span>' : '<select id="bp-ger-' + p.id + '" onchange="saveBpAusfDetail(' + p.id + ',\'geraet\',this.value)" style="padding:3px 5px;border:1px solid #e5e7eb;border-radius:5px;font-size:10px;font-family:inherit;background:white;">' + gerOpts + '</select>') + '</td>'
      + '<td style="' + tdS + '"><div style="display:flex;gap:3px;flex-wrap:wrap;">' + bedChips + '</div></td>'
      + '<td style="' + tdS + '">' + (!showControls ? '<span style="color:#9ca3af;font-size:11px;">—</span>' : '<select id="bp-st-' + p.id + '" onchange="saveBpAusfDetail(' + p.id + ',\'status\',this.value)" style="padding:3px 5px;border:1px solid transparent;border-radius:5px;font-size:10px;font-family:inherit;background:' + stBg + ';color:' + stFg + ';font-weight:600;" onfocus="this.style.border=\'1px solid #e5e7eb\'" onblur="this.style.border=\'1px solid transparent\'">' + selStOpts + '</select>') + '</td>'
      + '</tr>';
}

function renderBpZuweisungTable() {
  const table  = document.getElementById('bp-zuweisung-table');
  const cntLbl = document.getElementById('bp-zuw-count');
  if (!table) return;

  const pakete    = loadBaupakete();
  const zuw       = loadSchichtZuw();
  const allAbbZuw = loadAbbZuw();
  const allPairs  = getFilteredSorted();
  const ftZuw  = loadFtZuweisungen();
  const ftList = loadFtProfile();
  const spList = loadSperrmuster();
  const einst  = loadProjEinst();
  const allBp  = loadAllBauprojekt();
  const baugruppen = loadBaugruppen();

  // "Bestand erhalten" braucht kein Baupaket → ausblenden
  const pairs       = allPairs.filter(p => getPairBpTyp(p.id, allBp) !== 'erhalten');
  const ausgeblendet = allPairs.length - pairs.length;

  // Sortierung anwenden
  const _bpZuwSortFn = (a, b) => {
    const d = _bpZuwSortDir;
    const za = zuw[a.id] || {};  const zb = zuw[b.id] || {};
    const fta = ftList.find(t => t.id === ftZuw[a.id]);
    const ftb = ftList.find(t => t.id === ftZuw[b.id]);
    const paka = pakete.find(p => p.id === za.paketId);
    const pakb = pakete.find(p => p.id === zb.paketId);
    switch (_bpZuwSort) {
      case 'km':       return d * (parseFloat(a.km_rs||9999) - parseFloat(b.km_rs||9999));
      case 'typ':      return d * ((allBp[a.id]||{}).massnahme||'').localeCompare((allBp[b.id]||{}).massnahme||'', 'de');
      case 'ft':       return d * ((fta ? _ftLabel(fta) : 'zzz').localeCompare(ftb ? _ftLabel(ftb) : 'zzz', 'de'));
      case 'paket':    return d * ((paka?.name||'zzz').localeCompare(pakb?.name||'zzz', 'de'));
      case 'schicht':  return d * ((za.schichtNr||9999) - (zb.schichtNr||9999));
      case 'betonier': return d * ((za.betoniertermin||'9999').localeCompare(zb.betoniertermin||'9999'));
      default:         return d * (parseInt(a.mast||9999) - parseInt(b.mast||9999));
    }
  };
  pairs.sort(_bpZuwSortFn);

  // Zähler je Typ
  const neubauPairsT   = pairs.filter(p => { const t = getPairBpTyp(p.id, allBp); return t === 'neubau' || t === 'abbruch-neubau'; });
  const abbruchPairsT  = pairs.filter(p => { const t = getPairBpTyp(p.id, allBp); return t === 'abbruch' || t === 'abbruch-neubau'; });
  const sicherungPairsT = pairs.filter(p => getPairBpTyp(p.id, allBp) === 'sicherung');
  const provPairsT      = pairs.filter(p => getPairBpTyp(p.id, allBp) === 'provisorium');
  const zugewNB   = neubauPairsT.filter(p => !!zuw[p.id]).length;
  const zugewABB  = abbruchPairsT.filter(p => {
    const t = getPairBpTyp(p.id, allBp);
    return t === 'abbruch-neubau' ? !!allAbbZuw[p.id] : !!zuw[p.id];
  }).length;
  const zugewSICH = sicherungPairsT.filter(p => !!zuw[p.id]).length;
  const zugewPROV = provPairsT.filter(p => !!zuw[p.id]).length;
  const cntParts = [neubauPairsT.length + ' Neubau (' + zugewNB + ' zugewiesen)'];
  if (abbruchPairsT.length)  cntParts.push(abbruchPairsT.length + ' Abbruch (' + zugewABB + ' zugewiesen)');
  if (sicherungPairsT.length) cntParts.push(sicherungPairsT.length + ' Sicherung (' + zugewSICH + ' zugewiesen)');
  if (provPairsT.length)      cntParts.push(provPairsT.length + ' Provisorium (' + zugewPROV + ' zugewiesen)');
  if (ausgeblendet) cntParts.push(ausgeblendet + ' Bestand ausgeblendet');
  if (cntLbl) cntLbl.textContent = cntParts.join(' · ');

  if (!pairs.length) {
    table.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:#9ca3af;font-size:12px;">' +
      (allPairs.length ? 'Alle ' + allPairs.length + ' Standorte sind als «Bestand erhalten» klassiert — keine Schichtzuweisung erforderlich.' : 'Keine Standorte vorhanden.') +
      '</td></tr>';
    return;
  }

  // Auswahl auf noch vorhandene Pairs beschränken
  const pairIds = new Set(pairs.map(p => p.id));
  _bpZuwSelected.forEach(id => { if (!pairIds.has(id)) _bpZuwSelected.delete(id); });

  const thS = 'padding:8px 10px;font-size:10px;font-weight:700;color:white;text-align:left;white-space:nowrap;';
  const tdS = 'padding:7px 10px;font-size:12px;vertical-align:middle;';

  const pakOpts = '<option value="">— kein Paket —</option>' +
    pakete.map(p => '<option value="' + p.id + '">' + p.name + (p.startDatum ? ' (' + bpFmtDisplay(p.startDatum) + ')' : '') + '</option>').join('');

  const stVals   = ['geplant','bestaetigt','abgeschlossen','abgesagt'];
  const stLabels = ['Geplant','Bestätigt','Abgeschlossen','Abgesagt'];
  const stStyles = {
    geplant:       ['#dbeafe','#2563eb'],
    bestaetigt:    ['#dcfce7','#16a34a'],
    abgeschlossen: ['#f0fdf4','#15803d'],
    abgesagt:      ['#fee2e2','#dc2626'],
  };

  const geraetVals   = ['bagger','bohrmaschine','kran','sonstige'];
  const geraetLabels = ['Bagger','Bohrmaschine','Kran','Sonstige'];
  const gerOpts = '<option value="">—</option>' +
    geraetVals.map((v,j) => '<option value="' + v + '">' + geraetLabels[j] + '</option>').join('');

  // Hilfsfunktion: eine Tabellenzeile rendern
  // rowMode: 'neubau' | 'abbruch' | 'sicherung' | 'provisorium'
  // showControls: true für alle Zeilen mit Dropdowns
  // zuwData: alternativer Zuweisung-Store (für ABB-Zeilen bei abbruch-neubau)
  // Zeilenrenderer: siehe _bpZuwZeileHtml() — Kontext einmalig buendeln
  const _zuwCtx = { allBp, baugruppen, einst, ftList, ftZuw, gerOpts, pakOpts, pakete, stLabels, stStyles, stVals, tdS, zuw };
  const makeRow = (p, rowMode, showControls = true, zuwData = null) =>
    _bpZuwZeileHtml(p, rowMode, showControls, zuwData, _zuwCtx);

  const rows = pairs.flatMap(p => {
    const t = getPairBpTyp(p.id, allBp);
    if (t === 'abbruch-neubau') return [makeRow(p, 'abbruch', true, allAbbZuw), makeRow(p, 'neubau', true)];
    if (t === 'abbruch')        return [makeRow(p, 'abbruch', true)];
    if (t === 'sicherung')      return [makeRow(p, 'sicherung', true)];
    if (t === 'provisorium')    return [makeRow(p, 'provisorium', true)];
    return [makeRow(p, 'neubau', true)];
  }).join('');

  const allSelected = pairs.length > 0 && pairs.every(p => _bpZuwSelected.has(p.id));
  const thSort = (col, label, extraStyle) => {
    const active = _bpZuwSort === col;
    const arrow  = active ? (_bpZuwSortDir === 1 ? ' ▲' : ' ▼') : ' <span style="opacity:0.4;">⇅</span>';
    const bg     = active ? 'background:#2d5a8e;' : '';
    return `<th style="${thS}cursor:pointer;user-select:none;${bg}${extraStyle||''}" onclick="setBpZuwSort('${col}')" title="Sortieren">${label}${arrow}</th>`;
  };
  const thFixed = (label, extraStyle) => `<th style="${thS}${extraStyle||''}">${label}</th>`;
  table.innerHTML = '<thead><tr style="background:#1a3a5c;">'
    + `<th style="${thS}width:36px;text-align:center;"><input type="checkbox" ${allSelected?'checked':''} onclick="bpZuwSelectAll(this.checked)" style="width:14px;height:14px;cursor:pointer;accent-color:#60a5fa;" title="Alle auswählen"></th>`
    + thSort('mast',    'Mast / Nr.')
    + thSort('km',      'KM')
    + thSort('typ',     'Typ', 'text-align:center;')
    + thSort('ft',      'Fundamenttyp')
    + thSort('paket',   'Baupaket / Gruppe')
    + thSort('schicht', 'Schicht / Bohrschichten')
    + thFixed('Kapazität', 'text-align:center;')
    + thSort('betonier', 'Betoniertermin')
    + thFixed('Ausschaltermin')
    + thFixed('Gerät')
    + thFixed('Bedingungen')
    + thFixed('Status')
    + '</tr></thead><tbody>' + rows + '</tbody>';

  const bpAll = loadAllBauprojekt();
  pairs.forEach(p => {
    // NB-Zeile: ID ohne Suffix (rowSuffix = '')
    const pakSel = document.getElementById('bp-zuw-pak-' + p.id);
    if (pakSel) { pakSel.value = (zuw[p.id]||{}).paketId || ''; }
    const schSel = document.getElementById('bp-zuw-sch-' + p.id);
    if (schSel) {
      const curPak = pakete.find(pk => pk.id === (zuw[p.id]||{}).paketId);
      if (curPak) schSel.innerHTML = '<option value="">—</option>' +
        bpGetSchichten(curPak).map(s => '<option value="' + s.schichtNr + '"' + ((zuw[p.id]||{}).schichtNr == s.schichtNr ? ' selected' : '') + '>Schicht ' + s.schichtNr + ' (' + bpFmtDisplay(s.datum) + ')</option>').join('');
    }
    const gerSel = document.getElementById('bp-ger-' + p.id);
    if (gerSel) gerSel.value = (bpAll[p.id] || {}).ausfGeraet || '';
    const stSel = document.getElementById('bp-st-' + p.id);
    if (stSel) stSel.value = (getPairData(p.id).status) || 'geplant';
  });

  // Reine ABB / SICH / PROV-Zeilen: Paket-Dropdown initialisieren (suffix -abbruch/-sicherung/-provisorium)
  const _typSuffixMap = { abbruch: '-abbruch', sicherung: '-sicherung', provisorium: '-provisorium' };
  pairs.filter(p => Object.keys(_typSuffixMap).includes(getPairBpTyp(p.id, bpAll))).forEach(p => {
    const _t      = getPairBpTyp(p.id, bpAll);
    const _suffix = _typSuffixMap[_t];
    const _z2     = zuw[p.id] || {};
    const _pakSel = document.getElementById('bp-zuw-pak-' + p.id + _suffix);
    if (_pakSel) _pakSel.value = _z2.paketId || '';
    const _schSel = document.getElementById('bp-zuw-sch-' + p.id + _suffix);
    if (_schSel && !_schSel.querySelector('[selected]')) {
      const _curPak = pakete.find(pk => pk.id === _z2.paketId);
      if (_curPak) {
        _schSel.innerHTML = '<option value="">—</option>' +
          bpGetSchichten(_curPak).map(s => '<option value="' + s.schichtNr + '"' +
            (_z2.schichtNr == s.schichtNr ? ' selected' : '') +
            '>Schicht ' + s.schichtNr + ' (' + bpFmtDisplay(s.datum) + ')</option>').join('');
      }
    }
  });

  // ABB-Zeilen bei abbruch-neubau: eigene IDs (-abbruch Suffix) + eigener Store
  pairs.filter(p => getPairBpTyp(p.id, bpAll) === 'abbruch-neubau').forEach(p => {
    const abbZ   = allAbbZuw[p.id] || {};
    const abbPak = document.getElementById('bp-zuw-pak-' + p.id + '-abbruch');
    if (abbPak) { abbPak.value = abbZ.paketId || ''; }
    const abbSch = document.getElementById('bp-zuw-sch-' + p.id + '-abbruch');
    if (abbSch) {
      const curPak = pakete.find(pk => pk.id === abbZ.paketId);
      if (curPak) abbSch.innerHTML = '<option value="">—</option>' +
        bpGetSchichten(curPak).map(s => '<option value="' + s.schichtNr + '"' +
          (abbZ.schichtNr == s.schichtNr ? ' selected' : '') +
          '>Schicht ' + s.schichtNr + ' (' + bpFmtDisplay(s.datum) + ')</option>').join('');
      abbSch.value = abbZ.schichtNr || '';
    }
  });
}

function saveBpAusfDetail(pairId, field, value) {
  const ids = (_bpZuwSelected.size > 1 && _bpZuwSelected.has(pairId))
    ? [..._bpZuwSelected] : [pairId];
  const fieldMap = {
    'geraet':        'ausfGeraet',
    'gleisgebunden': 'ausfGleisgebunden',
    'hoehenbegr':    'ausfHoehenbegrenzung',
    'abschaltung':   'ausfAbschaltung',
    'nachbargleis':  'ausfNachbargleis',
  };
  if (field === 'status') {
    ids.forEach(id => setPairData(id, { ...getPairData(id), status: value }));
  } else {
    const key = fieldMap[field];
    if (key) {
      const all = loadAllBauprojekt();
      ids.forEach(id => {
        const bp = all[id] || {};
        bp[key] = (value === true || value === false) ? value : (value || null);
        all[id] = bp;
      });
      saveAllBauprojekt(all);
    }
  }
  renderBpZuweisungTable();
}

function saveBpVfk(pairId, checked) {
  const all = loadAllBauprojekt();
  if (!all[pairId]) all[pairId] = {};
  all[pairId].vfk = checked;
  saveAllBauprojekt(all);
  if (currentPairId === pairId) {
    const cb = document.getElementById('bp-vfk');
    if (cb) cb.checked = checked;
    renderBpFtInfo();
  }
}

function _ftMatchesNeigung(ft, neigung) {
  if (!ft || ft.typ !== 'standard' || !neigung || neigung === '') return true;
  const isBoesch = !!(ft.einsatzBedingung?.includes('14–33'));
  if (neigung === '14–33°') return isBoesch;
  if (neigung === '≤14°')   return !isBoesch;
  if (neigung === '>33°')   return false;
  return true;
}

function assignFundtypFromTable(pairId, val) {
  const targets = _listTargets(pairId);

  if (targets.length === 1) {
    if (!val) { assignFundtyp(pairId, ''); renderList(); return; }
    if (val.startsWith('__fam__')) {
      const family  = val.replace('__fam__', '');
      const allBp   = loadAllBauprojekt();
      const neigung = (allBp[pairId] || {}).neigung || '';
      const resolved = resolveFtByFamilieNeigung(family, neigung, null);
      if (resolved) {
        assignFundtyp(pairId, resolved.id);
        const all2 = loadAllBauprojekt();
        all2[pairId] = { ...(all2[pairId] || {}), fundtyp: resolved.name, ftProfilId: resolved.id };
        saveAllBauprojekt(all2);
      }
    } else {
      assignFundtyp(pairId, val);
    }
    renderList();
    return;
  }

  // ── Multi-Row: apply to all selected, detect FT↔Neigung conflicts ──
  const allBp    = loadAllBauprojekt();
  const zuws     = loadFtZuweisungen();
  const ok       = [];
  const skipped  = [];

  targets.forEach(id => {
    const bp      = allBp[id] || {};
    const neigung = bp.neigung || '';

    if (!val) {
      delete zuws[id];
      allBp[id] = { ...bp, fundtyp: '', ftProfilId: '' };
      ok.push(id);
      return;
    }

    let ft = null;
    if (val.startsWith('__fam__')) {
      ft = resolveFtByFamilieNeigung(val.replace('__fam__', ''), neigung, null);
      if (!ft) {
        const famName = val.replace('__fam__', '');
        skipped.push(`${famName} ≠ Neigung "${neigung || '—'}" (Mast ${loadPairs().find(p=>p.id===id)?.mast || id})`);
        return;
      }
    } else {
      ft = loadFtProfile().find(t => t.id === val);
    }

    if (ft && !_ftMatchesNeigung(ft, neigung)) {
      skipped.push(`${ft.name.split('/')[0].trim()} ≠ Neigung "${neigung}" (Mast ${loadPairs().find(p=>p.id===id)?.mast || id})`);
      return;
    }

    if (ft) {
      zuws[id]  = ft.id;
      allBp[id] = { ...bp, fundtyp: ft.name, ftProfilId: ft.id };
      ok.push(id);
    }
  });

  saveAllBauprojekt(allBp);
  saveFtZuweisungen(zuws);

  if (skipped.length > 0) {
    const preview = skipped.slice(0, 2).join(' · ') + (skipped.length > 2 ? ` (+${skipped.length - 2})` : '');
    _showListEditNotice(
      `${ok.length}/${targets.length} zugewiesen · ${skipped.length} übersprungen: ${preview}`,
      true
    );
  } else if (ok.length > 1) {
    _showListEditNotice(`${ok.length} Positionen aktualisiert`);
  }
  renderList();
}

function toggleBpBedingung(pairId, key) {
  const fieldMap = {
    gleisgebunden: 'ausfGleisgebunden',
    hoehenbegr:    'ausfHoehenbegrenzung',
    abschaltung:   'ausfAbschaltung',
    nachbargleis:  'ausfNachbargleis',
  };
  const f = fieldMap[key];
  if (!f) return;
  const all    = loadAllBauprojekt();
  const newVal = !(all[pairId] || {})[f];  // neue Zielwert vom angeklickten Eintrag
  const ids    = (_bpZuwSelected.size > 1 && _bpZuwSelected.has(pairId))
    ? [..._bpZuwSelected] : [pairId];
  ids.forEach(id => {
    const bp = all[id] || {};
    bp[f]    = newVal;
    all[id]  = bp;
  });
  saveAllBauprojekt(all);
  renderBpZuweisungTable();
}

function saveBpZuweisung(pairId, value, field) {
  const zuw = loadSchichtZuw();
  if (field === 'schicht') {
    // Propagate to all selected rows if this pair is among them
    const ids = (_bpZuwSelected.size > 1 && _bpZuwSelected.has(pairId))
      ? [..._bpZuwSelected] : [pairId];
    ids.forEach(id => {
      if (!zuw[id]) zuw[id] = {};
      zuw[id].paketId   = value || null;
      zuw[id].schichtNr = null;
    });
    saveSchichtZuw(zuw);
    if (ids.length > 1) {
      renderBpZuweisungTable();
    } else {
      const pak = loadBaupakete().find(p => p.id === value);
      const schichten = pak ? bpGetSchichten(pak) : [];
      const schSel = document.getElementById('bp-zuw-sch-' + pairId);
      if (schSel) schSel.innerHTML = '<option value="">—</option>' +
        schichten.map(s => '<option value="' + s.schichtNr + '">Schicht ' + s.schichtNr + ' (' + bpFmtDisplay(s.datum) + ')</option>').join('');
      const pakSel = document.getElementById('bp-zuw-pak-' + pairId);
      if (pakSel) pakSel.style.borderLeft = pak?.farbe ? '3px solid ' + pak.farbe : '';
    }
  } else {
    const schIds = (_bpZuwSelected.size > 1 && _bpZuwSelected.has(pairId))
      ? [..._bpZuwSelected] : [pairId];
    schIds.forEach(id => {
      if (!zuw[id]) zuw[id] = {};
      zuw[id].schichtNr = value ? parseInt(value) : null;
    });
    saveSchichtZuw(zuw);
    _recalcBaugruppenDates();
    if (schIds.length > 1) renderBpZuweisungTable();
  }
  updateBpInfoBar();
}


// Paket/Schicht-Zuweisung für ABB-Zeile (abbruch-neubau) speichern
function saveBpAbbZuweisung(pairId, value, field) {
  const zuw = loadAbbZuw();
  if (!zuw[pairId]) zuw[pairId] = {};
  if (field === 'paket') {
    zuw[pairId].paketId   = value || null;
    zuw[pairId].schichtNr = null;
    saveAbbZuw(zuw);
    const pak = loadBaupakete().find(p => p.id === value);
    const schichten = pak ? bpGetSchichten(pak) : [];
    const schSel = document.getElementById('bp-zuw-sch-' + pairId + '-abbruch');
    if (schSel) schSel.innerHTML = '<option value="">—</option>' +
      schichten.map(s => '<option value="' + s.schichtNr + '">Schicht ' + s.schichtNr + ' (' + bpFmtDisplay(s.datum) + ')</option>').join('');
    const pakSel = document.getElementById('bp-zuw-pak-' + pairId + '-abbruch');
    if (pakSel) pakSel.style.borderLeft = pak?.farbe ? '3px solid ' + pak.farbe : '';
  } else {
    zuw[pairId].schichtNr = value ? parseInt(value) : null;
    saveAbbZuw(zuw);
  }
  updateBpInfoBar();
}

// Pfahlfundament aus seiner Baugruppe herauslösen und in eine eigene neue Gruppe verschieben
function bpGruppeAufteilen(pairId) {
  const zuw     = loadSchichtZuw();
  const z       = zuw[pairId];
  if (!z?.bauGruppeId) return;
  const gruppen = loadBaugruppen();
  const altGrp  = gruppen.find(g => g.id === z.bauGruppeId);
  if (!altGrp || altGrp.pairIds.length <= 1) {
    ui.toast('Dieser Standort ist der einzige in seiner Gruppe – aufteilen nicht möglich.', 'fehler');
    return;
  }
  // Pair aus alter Gruppe entfernen
  altGrp.pairIds = altGrp.pairIds.filter(id => id !== pairId);
  // Neue Gruppe erstellen
  const neueGrp = {
    id:            'grp_split_' + Date.now(),
    name:          'Gruppe ' + (gruppen.length + 1),
    pairIds:       [pairId],
    betoniertermin: z.betoniertermin || '',
    ausschaltermin: z.ausschaltermin || '',
  };
  gruppen.push(neueGrp);
  saveBaugruppen(gruppen);
  zuw[pairId].bauGruppeId = neueGrp.id;
  saveSchichtZuw(zuw);
  renderBauprogrammTab();
}

// ── Mehrfachauswahl Schichtzuweisung ─────────────────────────
function bpZuwToggleRow(pairId, checked) {
  if (checked) _bpZuwSelected.add(pairId);
  else _bpZuwSelected.delete(pairId);
  const row = document.getElementById('bp-zuw-row-' + pairId);
  if (row) {
    row.style.background = checked ? '#eff6ff' : 'white';
    row.style.outline = checked ? '2px solid #3b82f6' : '';
    row.style.outlineOffset = checked ? '-2px' : '';
  }
  // Alle-auswählen-Checkbox im Header synchronisieren
  const pairs = getFilteredSorted();
  const allSel = pairs.length > 0 && pairs.every(p => _bpZuwSelected.has(p.id));
  const hdrCb = document.querySelector('#bp-zuweisung-table thead input[type=checkbox]');
  if (hdrCb) hdrCb.checked = allSel;
}

function bpZuwSelectAll(checked) {
  const pairs = getFilteredSorted();
  pairs.forEach(p => {
    if (checked) _bpZuwSelected.add(p.id);
    else _bpZuwSelected.delete(p.id);
    const row = document.getElementById('bp-zuw-row-' + p.id);
    if (row) {
      row.style.background = checked ? '#eff6ff' : 'white';
      row.style.outline = checked ? '2px solid #3b82f6' : '';
      row.style.outlineOffset = checked ? '-2px' : '';
    }
    const cb = row?.querySelector('input[type=checkbox]');
    if (cb) cb.checked = checked;
  });
}


// ── FT-Gruppen Kategorien (vordefiniert) ──────────────────────
const FT_GRUPPEN_KATEGORIEN = [
  {
    key: 'standard',
    label: 'Block / Brunnen / Fels',
    farbe: '#1a3a5c',
    ftNames: ['DP1a','DP2a','HP1a','HP2a','spezial-brunnen','spezial-fels'],
  },
  {
    key: 'mauer',
    label: 'Mauer & Kunstbauten',
    farbe: '#7c3aed',
    ftNames: ['spezial-mauer','spezial-kunstbau','spezial-exz'],
  },
  {
    key: 'pfahl',
    label: 'Pfahlfundamente',
    farbe: '#b45309',
    ftNames: ['spezial-pfahl','spezial-rhs'],
  },
];

// ── Auto-Pakete generieren ────────────────────────────────────
// Shared state for detected groups between autoGenerateBaupakete() and modal functions
let _apakGruppen        = [];
let _apakAbbruchPairs   = [];
let _apakSicherungPairs = [];
let _apakProvPairs      = [];
let _apakBaubeginnDat   = '';
let _bpEinstActiveTab   = 'lose';
let _bpZuwDirty         = false;
let _bpRecalcDirty      = false;

function _syncBpDirtyButtons() {
  [
    [['bp-btn-autozuw'], _bpZuwDirty],
    [['bp-btn-recalc'],  _bpRecalcDirty],
  ].forEach(([ids, dirty]) => {
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      dirty ? el.classList.add('bp-dirty') : el.classList.remove('bp-dirty');
    });
  });
}

function autoGenerateBaupakete() {
  const vor = bpVoraussetzungen();

  // Fehlt etwas, wird das immer benannt — frueher sprang die Funktion wortlos
  // in die Projekteinstellungen und der Nutzer sah einen Dialog ohne Grund.
  if (!vor.kannPakete) {
    const s = vor.naechsterSchritt;
    ui.toast('Baupakete noch nicht möglich.\n\nNächster Schritt: ' + s.text, 'fehler');
    if (s.ziel) openProjEinstModal(s.ziel);
    return;
  }

  _apakBaubeginnDat = vor.baubeginn;
  _prepareApakGruppen();
  if (!_apakGruppen.length) {
    ui.toast('Keine Neubau-Fundamente mit bekanntem Fundamenttyp gefunden.\nBitte zuerst den Fundamenttyp pro Standort hinterlegen.', 'fehler');
    return;
  }
  vor.warnungen.forEach(w => ui.toast(w.text, 'fehler'));
  openProjEinstModal('autopak');
}

function _prepareApakGruppen() {
  const allPairs = getFilteredSorted();
  const ftZuw   = loadFtZuweisungen();
  const ftList  = loadFtProfile();
  const allBpD  = loadAllBauprojekt();

  const getFtName = p => {
    const ft = ftList.find(t => t.id === ftZuw[p.id]);
    return ft?.name || (allBpD[p.id] || {}).fundtyp || '';
  };

  const neubauPairsAll = allPairs.filter(p => {
    const t = getPairBpTyp(p.id, allBpD);
    return t === 'neubau' || t === 'abbruch-neubau';
  });
  const abbruchPairsAll = allPairs.filter(p => {
    const t = getPairBpTyp(p.id, allBpD);
    return t === 'abbruch' || t === 'abbruch-neubau';
  });

  const getPairKatKey = p => {
    const ft = ftList.find(t => t.id === ftZuw[p.id]);
    if (ft && ft.typ !== 'standard') {
      if (ft.fundamentArt === 'mehrpfahl' || ft.fundamentArt === 'monopfahl') return 'pfahl';
      if (ft.fundamentArt === 'mauer'     || ft.fundamentArt === 'bauwerk')   return 'mauer';
      return 'standard';
    }
    const ftName = getFtName(p);
    for (const kat of FT_GRUPPEN_KATEGORIEN) {
      if (kat.ftNames.some(n => ftName.toLowerCase().startsWith(n.toLowerCase()))) return kat.key;
    }
    return 'standard';
  };

  const gruppen = FT_GRUPPEN_KATEGORIEN.map(kat => ({
    ...kat, pairs: neubauPairsAll.filter(p => getPairKatKey(p) === kat.key)
  }));
  _apakGruppen        = gruppen.filter(g => g.pairs.length > 0);
  _apakAbbruchPairs   = abbruchPairsAll;
  _apakSicherungPairs = allPairs.filter(p => getPairBpTyp(p.id, allBpD) === 'sicherung');
  _apakProvPairs      = allPairs.filter(p => getPairBpTyp(p.id, allBpD) === 'provisorium');
}

function openAutoPaketeModal() {
  const einst   = loadProjEinst();
  const lose    = einst.teams || [];
  const spList  = loadSperrmuster();
  const konfig  = einst.autoPakKonfig || {};

  // Populate per-category rows
  const body = document.getElementById('apak-gruppen-body');
  if (body) {
    body.innerHTML = _apakGruppen.map(g => {
      const k     = konfig[g.key] || {};
      const defName = g.label;
      const nameVal = k.name || defName;
      const teamOpts = [
        '<option value="">— Kein Los / Team —</option>',
        ...lose.map(l => `<option value="${l.id}"${k.teamId === l.id ? ' selected' : ''}>${escHtml(l.name)}</option>`)
      ].join('');
      const gleisLabels = [...new Set(g.pairs.map(p => p.gleis).filter(Boolean))];
      const gleisHint   = gleisLabels.length ? `Gl. ${gleisLabels.join(', ')}` : '—';
      return `
        <div style="padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="width:12px;height:12px;border-radius:50%;background:${g.farbe};flex-shrink:0;display:inline-block;"></span>
            <span style="font-size:12px;font-weight:700;color:#374151;flex:1;">${escHtml(g.label)}</span>
            <span style="font-size:11px;color:#6b7280;background:#e5e7eb;padding:2px 7px;border-radius:10px;">${gleisHint}</span>
            <span style="font-size:11px;color:#6b7280;background:#e5e7eb;padding:2px 7px;border-radius:10px;">${g.pairs.length} Fd.</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <div>
              <div style="font-size:10px;color:#9ca3af;margin-bottom:3px;">Paket-Name</div>
              <input id="apak-name-${g.key}" type="text" value="${escHtml(nameVal)}"
                style="width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;font-family:inherit;">
            </div>
            <div>
              <div style="font-size:10px;color:#9ca3af;margin-bottom:3px;">Los / Team</div>
              <select id="apak-team-${g.key}" style="width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;font-family:inherit;background:white;">${teamOpts}</select>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  renderApakPresetList();

  // Zeitplanung nur anzeigen — geändert wird sie im gleichnamigen Reiter
  const zeitInfo = document.getElementById('apak-zeit-info');
  if (zeitInfo) {
    const losMitFrist = loadBaupakete()
      .filter(p => p.aushaerteTage != null && p.aushaerteTage !== '')
      .map(p => escHtml(p.name) + ': ' + p.aushaerteTage + ' Tage');
    zeitInfo.innerHTML =
        'Baubeginn-Versatz <b>' + (einst.bbVersatzTage ?? 7) + '</b> Tage'
      + ' &nbsp;·&nbsp; Aushärtezeit <b>' + (einst.aushaerteTage ?? 28) + '</b> Tage'
      + ' &nbsp;·&nbsp; FL-Montage Puffer <b>' + (einst.flMontagePuffer ?? 7) + '</b> Tage'
      + (losMitFrist.length ? '<div style="margin-top:4px;">Abweichende Los-Frist — ' + losMitFrist.join(' · ') + '</div>' : '');
  }

  // Weitere Lose (Abbruch/Sicherung/Provisorium): gleicher Stil wie Neubau-Lose
  const sondWrap = document.getElementById('apak-sond-wrap');
  const sondBody = document.getElementById('apak-sond-body');
  const sondTypes = [
    { key: 'abbruch',    label: 'Abbruch',           farbe: '#fb923c', pairs: _apakAbbruchPairs,   always: true },
    { key: 'sicherung',  label: 'Sicherung',          farbe: '#ea580c', pairs: _apakSicherungPairs, always: false },
    { key: 'provisorium',label: 'Provisorium',        farbe: '#16a34a', pairs: _apakProvPairs,      always: false },
  ].filter(s => s.always || s.pairs.length > 0);

  if (sondBody && sondWrap) {
    sondBody.innerHTML = sondTypes.map(s => {
      const sk      = konfig[s.key] || {};
      const defName = s.key === 'abbruch' ? 'Abbruch-Los'
                    : s.key === 'sicherung' ? 'Fundamentsicherung' : 'Provisorien';
      const nameVal  = sk.name || defName;
      const checked  = sk.generate !== false ? 'checked' : '';
      const disabled = sk.generate === false  ? 'opacity:0.4;pointer-events:none;' : '';
      const teamOpts = [
        '<option value="">— Kein Los / Team —</option>',
        ...lose.map(l => `<option value="${l.id}"${sk.teamId === l.id ? ' selected' : ''}>${escHtml(l.name)}</option>`)
      ].join('');

      return `
        <div style="padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <input type="checkbox" id="apak-gen-${s.key}" ${checked} style="accent-color:${s.farbe};width:14px;height:14px;flex-shrink:0;cursor:pointer;"
              onchange="var f=document.getElementById('apak-sond-fields-${s.key}');f.style.opacity=this.checked?'1':'0.4';f.style.pointerEvents=this.checked?'':'none';">
            <span style="width:10px;height:10px;border-radius:50%;background:${s.farbe};flex-shrink:0;display:inline-block;"></span>
            <span style="font-size:12px;font-weight:700;color:#374151;flex:1;">${escHtml(s.label)}</span>
            <span style="font-size:11px;color:#6b7280;background:#e5e7eb;padding:2px 7px;border-radius:10px;">${s.pairs.length} Fd.</span>
          </div>
          <div id="apak-sond-fields-${s.key}" style="${disabled}">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
              <div>
                <div style="font-size:10px;color:#9ca3af;margin-bottom:3px;">Paket-Name</div>
                <input id="apak-name-${s.key}" type="text" value="${escHtml(nameVal)}"
                  style="width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;font-family:inherit;">
              </div>
              <div>
                <div style="font-size:10px;color:#9ca3af;margin-bottom:3px;">Los / Team</div>
                <select id="apak-team-${s.key}" style="width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;font-family:inherit;background:white;">${teamOpts}</select>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
    sondWrap.style.display = sondTypes.length > 0 ? '' : 'none';
  }

  // Tab-Inhalt befüllt — Modal wird von openProjEinstModal geöffnet
}

function closeAutoPaketeModal() {
  closeProjEinstModal();
}


function applyAutoPaketeModal() {
  const einst   = loadProjEinst();
  const spList  = loadSperrmuster();
  const stdSpId = einst.standardSperrmusterId || (spList[0]?.id || '');
  const stdSp   = spList.find(s => s.id === stdSpId);

  // Zeitplanung kommt aus den Projekteinstellungen. Sie wurde hier früher aus
  // eigenen Eingabefeldern gelesen und zurückgeschrieben — damit überschrieb
  // die Paket-Erzeugung stillschweigend, was im Reiter «Zeitplanung» stand.
  const bbVersatz = einst.bbVersatzTage   ?? 7;
  const flPuffer  = einst.flMontagePuffer ?? 7;

  const konfig = _readApakKonfigAusModal();
  einst.autoPakKonfig = konfig;
  saveProjEinst(einst);

  closeProjEinstModal();

  // ── Generation logic ──────────────────────────────────────────
  const baubeginnDat  = _apakBaubeginnDat;
  const lose          = einst.teams || [];
  const abbruchPairsAll = _apakAbbruchPairs;
  const sicherungPairs  = _apakSicherungPairs;
  const provPairs       = _apakProvPairs;
  const aktivGruppen    = _apakGruppen;

  const abbCount  = abbruchPairsAll.length;
  const sichCount = sicherungPairs.length;
  const provCount = provPairs.length;

  const ftZuw  = loadFtZuweisungen();
  const ftList = loadFtProfile();

  const existingPak = loadBaupakete();
  const newPakete   = [];

  // Neubau-Start: T0 + bbVersatz Tage
  let curStart = bpFmtDate(bpAddDays(bpParseDate(baubeginnDat), bbVersatz));

  aktivGruppen.forEach((g, idx) => {
    const katK   = konfig[g.key] || {};
    const teamId = katK.teamId || (lose[idx % lose.length]?.id || '');
    const losObj = lose.find(l => l.id === teamId) || lose[idx % lose.length];
    const naechte = bpNaechteFuerPairs(g.pairs, ftList, ftZuw, stdSp, curStart, losObj?.naechteProFund || 2, einst.abzugMinuten);

    newPakete.push({
      id:            'pak_auto_' + g.key + '_' + Date.now() + idx,
      name:          katK.name || g.label,
      startDatum:    bpSnapToSperrmuster(curStart, null) || curStart,
      anzahlNaechte: naechte,
      // gleisNr weggelassen: SP wird pro Fundament über p.gleis aufgelöst
      teamId:        teamId,
      farbe:         g.farbe,
      vorgaengerId:  '',
    });
  });

  // Spätestes Neubau-Paket → FL-Montage-Datum dynamisch aus dessen Ende berechnen.
  // «Ende» schliesst seit der Umstellung die Aushärtung ein (bpPaketRefDatum),
  // deshalb ist hier nur noch der FL-Puffer aufzuschlagen. Vorher stand hier
  // `aushaerte + flPuffer` — das würde die Aushärtefrist nun doppelt zählen.
  const lastNbPak    = newPakete.reduce((last, p) => {
    const e = bpPaketFertig(p);
    return (!last || e > bpPaketFertig(last)) ? p : last;
  }, null);
  const lastNbEndStr = lastNbPak ? bpPaketFertig(lastNbPak) : baubeginnDat;
  const lastNbEnd    = bpParseDate(lastNbEndStr || baubeginnDat);
  const flMontageDat = bpFmtDate(bpAddDays(lastNbEnd, flPuffer));

  // Meilenstein FL-Montage erstellen oder aktualisieren
  // abh.typ = 'nach-paket' → Datum wird dynamisch aus dem letzten NB-Paket berechnet.
  // Pakete die diesen Meilenstein als Vorgänger haben folgen damit automatisch mit
  // wenn NB-Pakete verschoben werden (via bpKaskadeDelta-Meilenstein-Kaskade).
  const msList = loadMeilensteine();
  const flIdx  = msList.findIndex(m => m.typ === 'fl-montage');
  const flMs   = {
    id:    flIdx >= 0 ? msList[flIdx].id : ('ms_flmontage_' + Date.now()),
    typ:   'fl-montage',
    label: 'FL-Montage erfolgt',
    datum: null, // dynamisch über abh berechnet
    farbe: '#16a34a',
    abh:   { typ: 'nach-paket', referenzId: lastNbPak?.id || null, offsetTage: flPuffer, refPunkt: 'ende' },
  };
  if (flIdx >= 0) msList[flIdx] = flMs; else msList.push(flMs);
  saveMeilensteine(msList);

  // Abbruch-Paket (falls Abbruch-Pairs vorhanden und aktiviert)
  const abbKonf    = konfig.abbruch || {};
  // einst.abbruchLos war eine Konfiguration ohne Eingabemöglichkeit: kein
  // Bedienelement schrieb je hinein, gelesen wurde immer das leere Objekt.
  // Die Werte kommen aus dem Auto-Pakete-Reiter (abbKonf).
  if (abbCount > 0 && abbKonf.generate !== false) {
    const abbNaechte = bpNaechteFuerPairs(abbruchPairsAll, ftList, ftZuw, stdSp, flMontageDat, 1, einst.abzugMinuten);
    newPakete.push({
      id:            'pak_auto_abbruch_' + Date.now(),
      name:          abbKonf.name || 'Abbruch-Los',
      startDatum:    bpSnapToSperrmuster(flMontageDat, abbruchPairsAll[0]?.gleis || null) || flMontageDat,
      anzahlNaechte: abbNaechte,
      // gleisNr weggelassen: SP pro Fundament über p.gleis
      teamId:        abbKonf.teamId || '',
      farbe:         '#fb923c',
      vorgaengerId:  flMs.id,          // folgt FL-Montage-Meilenstein
      vorgaengerRefPunkt: 'ende',
    });
  }

  // Sicherung-Paket
  const sichKonf  = konfig.sicherung || {};
  const sichStart = bpFmtDate(bpAddDays(bpParseDate(baubeginnDat), bbVersatz));
  if (sichCount > 0 && sichKonf.generate !== false) {
    const sichNaechte = bpNaechteFuerPairs(sicherungPairs, ftList, ftZuw, stdSp, sichStart, 1, einst.abzugMinuten);
    newPakete.push({
      id:            'pak_auto_sicherung_' + Date.now(),
      name:          sichKonf.name || 'Fundamentsicherung',
      startDatum:    bpSnapToSperrmuster(sichStart, null) || sichStart,
      anzahlNaechte: sichNaechte,
      // gleisNr weggelassen: SP pro Fundament über p.gleis
      teamId:        sichKonf.teamId || '',
      farbe:         '#ea580c',
      vorgaengerId:  '',
    });
  }

  // Provisorium-Paket
  const provKonf  = konfig.provisorium || {};
  const provStart = bpFmtDate(bpAddDays(bpParseDate(baubeginnDat), bbVersatz));
  if (provCount > 0 && provKonf.generate !== false) {
    const provNaechte = bpNaechteFuerPairs(provPairs, ftList, ftZuw, stdSp, provStart, 1, einst.abzugMinuten);
    newPakete.push({
      id:            'pak_auto_prov_' + Date.now(),
      name:          provKonf.name || 'Provisorien',
      startDatum:    bpSnapToSperrmuster(provStart, null) || provStart,
      anzahlNaechte: provNaechte,
      // gleisNr weggelassen: SP pro Fundament über p.gleis
      teamId:        provKonf.teamId || '',
      farbe:         '#16a34a',
      vorgaengerId:  '',
      // Provisorien werden früher belastet; ohne Projektangabe bleibt die
      // Regelfrist, damit hier keine Frist stillschweigend erfunden wird.
      aushaerteTage: einst.provAushaerteTage ?? null,
    });
  }

  // Manuell erstellte Pakete behalten, auto-generierte ersetzen
  const manualPak = existingPak.filter(p => !p.id.startsWith('pak_auto_'));
  saveBaupakete([...manualPak, ...newPakete]);

  // Auto-assign FT-Profile zu generierten Paketen nach Kategorie (fundamentArt hat Vorrang)
  const ftListUpd = loadFtProfile();
  // Veraltete Zuweisungen zu nicht mehr existierenden Auto-Paketen bereinigen
  const validPakIds = new Set([...manualPak, ...newPakete].map(p => p.id));
  ftListUpd.forEach(ft => {
    if (ft.fixBaupaketzuweisungId && !validPakIds.has(ft.fixBaupaketzuweisungId))
      ft.fixBaupaketzuweisungId = null;
  });
  let ftAssignCount = 0;
  aktivGruppen.forEach((g, idx) => {
    const pak = newPakete[idx];
    ftListUpd.forEach(ft => {
      if (ft.typ !== 'standard') {
        const isPfahl = ft.fundamentArt === 'mehrpfahl' || ft.fundamentArt === 'monopfahl';
        const isMauer = ft.fundamentArt === 'mauer'     || ft.fundamentArt === 'bauwerk';
        if ((g.key === 'pfahl' && isPfahl) || (g.key === 'mauer' && isMauer) ||
            (g.key === 'standard' && !isPfahl && !isMauer)) {
          ft.fixBaupaketzuweisungId = pak.id;
          ftAssignCount++;
        }
      } else if (g.ftNames.some(n => (ft.name || '').toLowerCase().startsWith(n.toLowerCase()))) {
        ft.fixBaupaketzuweisungId = pak.id;
        ftAssignCount++;
      }
    });
  });
  if (ftAssignCount) saveFtProfile(ftListUpd);

  renderBauprogrammTab();
  _bpZuwDirty = true; _syncBpDirtyButtons();

  const abbInfo  = (abbCount > 0 && abbKonf.generate !== false)                  ? `\n· Abbruch-Los ab ${flMontageDat} (nach Aushärtung + ${flPuffer}d Puffer)` : '';
  const sichInfo = (sichCount > 0 && (konfig.sicherung?.generate) !== false)     ? `\n· Sicherung-Los: ${sichCount} Standorte ab Baubeginn` : '';
  const provInfo = (provCount > 0 && (konfig.provisorium?.generate) !== false)   ? `\n· Provisorien: ${provCount} Standorte ab Baubeginn`   : '';
  const ftInfo   = ftAssignCount ? `\n· ${ftAssignCount} Fundamenttyp${ftAssignCount!==1?'en':''} Baupaket als Voreinstellung zugewiesen` : '';
  // Hinweis wenn kein Sperrmuster definiert → Paketdauern und Schichtzählung werden nicht berechnet
  const spWarn   = !spList.length ? '\n\nKein Sperrmuster definiert. Bitte unter «Sperrmuster & Schichten» mindestens ein Muster anlegen, damit Paketdauern und die automatische Schichtzuweisung korrekt berechnet werden können.' : '';
  ui.toast(`${newPakete.length} Paket${newPakete.length!==1?'e':''} erstellt.\n· Neubau-Start: T0 + ${bbVersatz} Tage (${bpFmtDate(bpAddDays(bpParseDate(baubeginnDat), bbVersatz))})\n· Meilenstein «FL-Montage erfolgt»: ${flMontageDat}${abbInfo}${sichInfo}${provInfo}${ftInfo}\n\nDu kannst Abhängigkeiten und Daten nun von Hand anpassen.${spWarn}`, 'erfolg');
}

// ── Paketdauern neu berechnen ─────────────────────────────────
function recalcBaupakete() {
  const pakete  = loadBaupakete();
  if (!pakete.length) { ui.toast('Keine Baupakete vorhanden.', 'fehler'); return; }

  const zuw     = loadSchichtZuw();
  const ftZuw   = loadFtZuweisungen();
  const ftList  = loadFtProfile();
  const spList  = loadSperrmuster();
  const allBpD  = loadAllBauprojekt();
  const lps     = loadLeistungsprofile();

  const aenderungen = [];

  pakete.forEach(pak => {
    const sp = resolveSpForPak(pak, pak.startDatum);
    if (!sp?.nettoH) return;

    // Alle Pairs die diesem Paket zugewiesen sind
    const allePairs = Object.entries(zuw)
      .filter(([, z]) => z?.paketId === pak.id)
      .map(([id]) => id);

    if (!allePairs.length) return;

    // Dauer berechnen: Summe ceil(ftIntervall / nettoH) pro Fundament
    let neuNaechte = 0;
    const details = [];
    allePairs.forEach(pid => {
      const ftId = ftZuw[pid];
      const ft   = ftList.find(t => t.id === ftId);
      const effPfahlLeistung = _resolvePfahlLeistung(ft);
      const istPfahlFt = ft?.fundamentArt === 'mehrpfahl' && parseInt(ft.anzahlPfaehle) > 0 && effPfahlLeistung;
      if (istPfahlFt) {
        const mockFt = { ...ft, pfahlLeistung: effPfahlLeistung };
        const calc = _calcPfahlSchichten(mockFt, sp.nettoH, loadProjEinst().abzugMinuten || 0);
        if (calc) {
          neuNaechte += calc.total;
          details.push({ name: ft.name, intervall: `${effPfahlLeistung}h/Pf ×${ft.anzahlPfaehle}`, naechte: calc.total });
        }
      } else {
        // Effektives ftIntervall: LP hat Vorrang (konsistent mit getFtLeistung)
        const _effLp   = ft?.leistungsprofilId ? lps.find(p => p.id === ft.leistungsprofilId) : null;
        const _effIntv = _effLp?.ftIntervall ?? ft?.ftIntervall ?? null;
        if (_effIntv) {
          const n = Math.ceil(_effIntv / sp.nettoH);
          neuNaechte += n;
          details.push({ name: ft?.name || '?', intervall: _effIntv, naechte: n });
        }
      }
    });

    if (!neuNaechte) return;
    neuNaechte = Math.max(1, neuNaechte);

    const altNaechte = pak.anzahlNaechte || 0;
    if (altNaechte === neuNaechte) {
      aenderungen.push({ pak, alt: altNaechte, neu: neuNaechte, geaendert: false, details });
    } else {
      pak.anzahlNaechte = neuNaechte;
      aenderungen.push({ pak, alt: altNaechte, neu: neuNaechte, geaendert: true, details });
    }
  });

  // Kaskade für alle geänderten Pakete
  const geaendert = aenderungen.filter(a => a.geaendert);
  if (geaendert.length) {
    geaendert.forEach(a => bpKaskade(a.pak.id, pakete));
    saveBaupakete(pakete);
    // SchichtNr klemmen: Zuweisungen die nach Reduktion ausserhalb liegen → auf Maximum setzen
    const allZuw = loadSchichtZuw();
    let zuwChanged = false;
    geaendert.forEach(({ pak: p }) => {
      Object.values(allZuw).forEach(z => {
        if (z?.paketId !== p.id) return;
        if (z.schichtNr > p.anzahlNaechte) { z.schichtNr = p.anzahlNaechte; zuwChanged = true; }
        z.bohrSchichten?.forEach(bs => {
          if (bs.paketId === p.id && bs.schichtNr > p.anzahlNaechte) { bs.schichtNr = p.anzahlNaechte; zuwChanged = true; }
        });
      });
    });
    if (zuwChanged) saveSchichtZuw(allZuw);
    renderBauprogrammTab();
  }

  // Info-Modal befüllen
  const body = document.getElementById('bp-recalc-body');
  if (!body) return;

  if (!aenderungen.length) {
    body.innerHTML = '<div style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">Keine zugewiesenen Fundamente mit FT-Intervall gefunden.<br><span style="font-size:11px;">Bitte zuerst Fundamenttypen zuweisen und Schichtzuweisung vornehmen.</span></div>';
  } else {
    const rows = aenderungen.map(a => {
      const diff = a.neu - a.alt;
      const diffStr = diff > 0 ? '+' + diff : diff < 0 ? String(diff) : '±0';
      const diffCol = diff > 0 ? '#dc2626' : diff < 0 ? '#16a34a' : '#6b7280';
      const bg = a.geaendert ? (diff > 0 ? '#fff7f7' : '#f0fdf4') : 'white';
      const detailStr = [...new Map(a.details.map(d => [d.name, d])).values()]
        .map(d => `${d.name}: ${d.intervall}h ÷ ${resolveSpForPak(a.pak, a.pak.startDatum)?.nettoH||'?'}h = ${d.naechte}N`)
        .join(' · ');
      return `<tr style="background:${bg};">
        <td style="padding:8px 10px;font-size:12px;font-weight:700;color:#1a3a5c;">${a.pak.name}</td>
        <td style="padding:8px 10px;font-size:12px;text-align:center;color:#6b7280;">${a.alt}N</td>
        <td style="padding:8px 10px;font-size:12px;text-align:center;font-weight:700;color:#1a3a5c;">${a.neu}N</td>
        <td style="padding:8px 10px;font-size:12px;text-align:center;font-weight:700;color:${diffCol};">${diffStr}N</td>
        <td style="padding:8px 10px;font-size:10px;color:#9ca3af;">${detailStr}</td>
      </tr>`;
    }).join('');

    body.innerHTML = `
      <div style="font-size:11px;color:#6b7280;margin-bottom:10px;">
        ${geaendert.length} Paket${geaendert.length!==1?'e':''} angepasst · Kaskade aktualisiert
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-family:inherit;">
          <thead><tr style="background:#f8fafc;border-bottom:2px solid #e5e7eb;">
            <th style="padding:6px 10px;font-size:10px;font-weight:700;color:#374151;text-align:left;">Paket</th>
            <th style="padding:6px 10px;font-size:10px;font-weight:700;color:#374151;text-align:center;">Alt</th>
            <th style="padding:6px 10px;font-size:10px;font-weight:700;color:#374151;text-align:center;">Neu</th>
            <th style="padding:6px 10px;font-size:10px;font-weight:700;color:#374151;text-align:center;">Δ</th>
            <th style="padding:6px 10px;font-size:10px;font-weight:700;color:#374151;text-align:left;">Berechnung</th>
          </tr></thead>
          <tbody style="border-bottom:1px solid #e5e7eb;">${rows}</tbody>
        </table>
      </div>`;
  }

  _bpRecalcDirty = false; _syncBpDirtyButtons();
  document.getElementById('bp-recalc-modal').style.display = 'flex';
}

// ── Auto-Zuweisung ────────────────────────────────────────────
// ── Auto-Zuweisung: Teilschritte ──────────────────────────────
// Die Hauptfunktion autoZuweisenSchichten() setzt sich aus diesen
// Schritten zusammen; jeder ist fuer sich lesbar und testbar.

// Schritt 1: relevante Standorte auswaehlen und nach Konfiguration sortieren.
// NB immer, ABB/SICH/PROV nur wenn in der Konfiguration aktiviert.
function _azWaehlePairs(cfg, allBpAuto) {
  let pairs = getFilteredSorted().filter(p => {
    const t = getPairBpTyp(p.id, allBpAuto);
    if (t === 'erhalten') return false;
    if (t === 'neubau' || t === 'abbruch-neubau') return true;
    if (t === 'abbruch')     return cfg.assignAbbruch   !== false;
    if (t === 'sicherung')   return cfg.assignSicherung !== false;
    if (t === 'provisorium') return cfg.assignProvisorium !== false;
    return false;
  });

  const ftZuwSort  = loadFtZuweisungen();
  const ftListSort = loadFtProfile();
  if (cfg.sortierung === 'km_desc') {
    pairs = pairs.slice().sort((a, b) => (parseFloat(b.km_rs)||0) - (parseFloat(a.km_rs)||0));
  } else if (cfg.sortierung === 'mast_nr') {
    pairs = pairs.slice().sort((a, b) => bpMastVergleich(a.mast, b.mast));
  } else if (cfg.sortierung === 'ft_typ') {
    pairs = pairs.slice().sort((a, b) => {
      const ftA = ftListSort.find(f => f.id === ftZuwSort[a.id])?.name || '';
      const ftB = ftListSort.find(f => f.id === ftZuwSort[b.id])?.name || '';
      return ftA.localeCompare(ftB);
    });
  } else if (cfg.sortierung === 'gleis') {
    // Nach Gleis gruppieren, innerhalb der Gruppe nach KM. Stand früher als
    // dritte «Strategie» daneben und überschrieb die Sortierung stillschweigend
    // — es ist eine Reihenfolge, keine Zuweisungsart.
    pairs = pairs.slice().sort((a, b) => {
      const ga = a.gleis ? String(a.gleis) : 'zzz';
      const gb = b.gleis ? String(b.gleis) : 'zzz';
      if (ga !== gb) return ga.localeCompare(gb, 'de', { numeric: true });
      return (parseFloat(a.km_rs) || 0) - (parseFloat(b.km_rs) || 0);
    });
  } // km_asc ist der Standard aus getFilteredSorted
  return pairs;
}

// Schritt 2: vollstaendig konfigurierte Baupakete ermitteln, nach Startdatum
// sortiert. Pakete vor dem Baubeginn-Meilenstein werden nach Rueckfrage
// ausgeschlossen. Rueckgabe null = Abbruch (Meldung wurde bereits gezeigt).
async function _azAktivePakete(pakete, baubeginnDat) {
  const aktivePakete = pakete
    .filter(p => p.startDatum && p.anzahlNaechte)
    .sort((a, b) => a.startDatum.localeCompare(b.startDatum));

  if (!aktivePakete.length) {
    ui.toast('Keine vollständig konfigurierten Baupakete vorhanden (Datum und Anzahl Nächte erforderlich).', 'fehler');
    return null;
  }
  if (!baubeginnDat) return aktivePakete;

  const zuFrüh = aktivePakete.filter(p => p.startDatum < baubeginnDat);
  if (!zuFrüh.length) return aktivePakete;

  const namen = zuFrüh.map(p => `· ${p.name} (${bpFmtDisplay(p.startDatum)})`).join('\n');
  if (!await ui.confirm(`Folgende Baupakete starten vor dem Baubeginn-Meilenstein (${bpFmtDisplay(baubeginnDat)}):\n\n${namen}\n\nDiese Pakete werden in der Zuweisung übersprungen. Fortfahren?`)) return null;

  const gefiltert = aktivePakete.filter(p => p.startDatum >= baubeginnDat);
  if (!gefiltert.length) {
    ui.toast('Nach Ausschluss der Pakete vor Baubeginn sind keine Pakete mehr vorhanden.', 'fehler');
    return null;
  }
  return gefiltert;
}

// Gleise mit exklusiven Sperrmuster-Naechten zuerst: Fundamente, deren Gleis
// mindestens ein SP mit gesetztem gleisNr hat (z. B. Gl 66 -> Muster A), kommen
// VOR Fundamenten, deren Gleis nur universelle SPs nutzt. So fuellen spezifische
// Gleise ihre exklusiven Naechte, bevor der Cursor daran vorbeizieht.
function _azHatSpezifischesSp(gleis, spList) {
  if (!gleis) return false;
  const g = String(gleis).trim();
  return spList.some(sp => sp.gleisNr &&
    sp.gleisNr.split(/[,\/\s]+/).map(s => s.trim()).includes(g));
}
function _azSortiereNachGleisExklusivitaet(pairsListe, spList) {
  pairsListe.sort((a, b) =>
    (_azHatSpezifischesSp(a.gleis, spList) ? 0 : 1) -
    (_azHatSpezifischesSp(b.gleis, spList) ? 0 : 1));
}

// Betonier- und Ausschaltermin je Baugruppe aus den Bohrschichten ableiten
// und auf die zugehoerigen Zuweisungen zurueckschreiben.
function _azBerechneGruppenTermine(neueBaugruppen, neueZuw, aktivePakete) {
  neueBaugruppen.forEach(grp => {
    let maxDate = '';
    grp.pairIds.forEach(pid => {
      const bs = neueZuw[pid]?.bohrSchichten || [];
      if (!bs.length) return;
      const last = bs[bs.length - 1];
      const d    = bpSchichtDatum(last.paketId, last.schichtNr, aktivePakete);
      if (d && d > maxDate) maxDate = d;
    });
    // Betonieren startet am Tag NACH der letzten Bohrschicht
    grp.betoniertermin = maxDate ? bpFmtDate(bpAddDays(bpParseDate(maxDate), 1)) : '';
    grp.ausschaltermin = grp.betoniertermin ? bpFmtDate(bpAddDays(bpParseDate(grp.betoniertermin), loadProjEinst().aushaerteTage ?? 28)) : '';
    grp.pairIds.forEach(pid => {
      if (neueZuw[pid]) {
        neueZuw[pid].betoniertermin = grp.betoniertermin;
        neueZuw[pid].ausschaltermin = grp.ausschaltermin;
      }
    });
  });
}

// Schritt A der Auto-Zuweisung: Abbruch-, Sicherungs- und Provisoriums-
// Standorte werden direkt ihrem automatisch angelegten Typ-Paket zugewiesen,
// mit eigenem Schicht-Cursor (unabhaengig vom spaeteren Pool-Cursor).
// Schreibt nach ctx.neueZuw und liefert die Menge der zugewiesenen Pair-IDs.
function _azWeisePauschaltypenZu(ctx) {
  const { typePakMap, pakete, pairs, allBpAuto, ftZuw, ftList, cfg, einst,
          neueZuw, abbNeueZuw, getPaketKap, isSchichtValid } = ctx;
  const preAssigned = new Set();

  ['abbruch', 'sicherung', 'provisorium'].forEach(typ => {
    const typPakId = typePakMap[typ];
    if (!typPakId) return;
    const typPak = pakete.find(p => p.id === typPakId);
    if (!typPak) return;

    const typSp  = resolveSpForPak(typPak, typPak.startDatum);
    const typKap = getPaketKap(typPak);
    const maxSNr = Math.max(1, typPak.anzahlNaechte || 1);
    let tSNr  = 1;
    let tRest = typKap;
    const naechsteGueltigeNacht = () => {
      tSNr++;
      while (tSNr <= maxSNr && !isSchichtValid(typPak, tSNr)) tSNr++;
      tRest = typKap;
    };
    while (tSNr <= maxSNr && !isSchichtValid(typPak, tSNr)) tSNr++;

    // Ins Abbruchpaket gehören ZWEI Gruppen: reine Abbrüche («abbruch-nur»)
    // und die ABBRUCHSEITE der A+N-Standorte. Letztere fehlten bisher ganz —
    // sie landeten nur mit ihrer Neubauseite im Pool, das Abbruchpaket blieb
    // leer. Beide teilen sich denselben Schichtzeiger, damit die Kapazität
    // des Pakets gemeinsam verrechnet wird; sie schreiben aber in getrennte
    // Speicher (siehe bpAbbZuwStore).
    // «Abbruch zuweisen» abgewählt: dann bleibt auch die Abbruchseite der
    // A+N-Standorte unberührt (die Neubauseite läuft davon unabhängig).
    const abbErlaubt = cfg.assignAbbruch !== false;
    const kandidaten = typ === 'abbruch'
      ? pairs.filter(p => {
          const t = getPairBpTyp(p.id, allBpAuto);
          return t === 'abbruch' || (t === 'abbruch-neubau' && abbErlaubt);
        })
      : pairs.filter(p => getPairBpTyp(p.id, allBpAuto) === typ);

    kandidaten.forEach(p => {
      if (tSNr > maxSNr) tSNr = maxSNr;
      const istAplusN = getPairBpTyp(p.id, allBpAuto) === 'abbruch-neubau';
      if (istAplusN) {
        // Nur die Abbruchseite; die Neubauseite bleibt im Pool.
        if (abbNeueZuw) abbNeueZuw[p.id] = { paketId: typPak.id, schichtNr: tSNr };
      } else {
        neueZuw[p.id] = { paketId: typPak.id, schichtNr: tSNr };
        preAssigned.add(p.id);
      }

      const ft2 = ftList.find(t => t.id === ftZuw[p.id]);
      if (cfg.strategie !== 'einzel' && typKap > 0) {
        // Sicherung: manuelle Minutenangabe hat Vorrang vor FT-Leistung
        let minProEinh = null;
        const manuell = cfg.pauschalLeistung?.[typ] ?? (typ === 'sicherung' ? cfg.sicherungLeistung : null);
        if (manuell > 0) {
          minProEinh = manuell;
        } else if (ft2) {
          const leis = getFtLeistung(ft2, typSp?.nettoH, einst.abzugMinuten);
          if (leis && leis > 0) minProEinh = typKap / leis;
        }
        if (minProEinh && minProEinh > 0) {
          tRest -= minProEinh;
          if (tRest <= 0) naechsteGueltigeNacht();
          return;
        }
      }
      naechsteGueltigeNacht();
    });
  });
  return preAssigned;
}

function _azErgebnisMeldung(neueZuw, pairs, neueBaugruppen, abbAnz, ueberzaehlig) {
  const zugewiesene = Object.keys(neueZuw).length;
  const nichtZug    = pairs.length - zugewiesene;
  const pfahlAnz    = Object.values(neueZuw).filter(z => z.isPfahlFund).length;
  return 'Auto-Zuweisung abgeschlossen:\n✓ ' + zugewiesene + ' Standorte zugewiesen'
    + (abbAnz ? '\n✓ ' + abbAnz + ' Abbruchseiten (A+N) ins Abbruchpaket' : '')
    + (pfahlAnz ? '\n⊕ ' + pfahlAnz + ' Pfahlfundamente in ' + neueBaugruppen.length + ' Baugruppen' : '')
    + (ueberzaehlig > 0 ? '\n' + ueberzaehlig + ' Standorte in die letzte Nacht gelegt — Paket zu kurz, bitte Nächte erhöhen' : '')
    + (nichtZug > 0 ? '\n' + nichtZug + ' Standorte ohne Zuweisung (kein Fundamenttyp oder Kapazität erschöpft)' : '');
}

// Schutz vor Endlosschleife: der zweite Lauf nach dem Verlängern fragt nicht
// erneut nach, auch wenn dann noch Nächte fehlen sollten.
let _azErneut = false;

async function autoZuweisenSchichten(config) {
  const cfg    = Object.assign(_defaultAzConfig(), config || {});
  const pakete = loadBaupakete();
  if (!pakete.length) { ui.toast('Keine Baupakete vorhanden. Bitte zuerst Baupakete anlegen.', 'fehler'); return; }

  // Baubeginn-Meilenstein muss definiert sein
  const meilensteine = loadMeilensteine();
  const baubeginnMs  = meilensteine.find(m => m.typ === 'baubeginn');
  const baubeginnDat = baubeginnMs ? msMsResolvedDatum(baubeginnMs) : null;
  if (!baubeginnDat) {
    if (!await ui.confirm('Kein Baubeginn-Meilenstein mit Datum definiert.\n\nDie Zuweisung startet ab dem frühesten Baupaket-Datum. Fortfahren?')) return;
  }

  const allBpAuto = loadAllBauprojekt();
  let pairs = _azWaehlePairs(cfg, allBpAuto);

  // «Bestehende Zuweisungen behalten»: bereits zugewiesene Standorte aus dem
  // Lauf nehmen. Ohne diese Möglichkeit ersetzte jeder Lauf den gesamten
  // Bestand — von Hand gesetzte Zuweisungen waren danach weg.
  const bestand = loadSchichtZuw();
  if (cfg.behalteManuell) {
    pairs = pairs.filter(p => !bestand[p.id]?.paketId);
    if (!pairs.length) {
      ui.toast('Alle Standorte sind bereits zugewiesen. Nichts zu tun.', 'erfolg');
      return;
    }
  }

  const ftZuw  = loadFtZuweisungen();
  const ftList = loadFtProfile();
  const spList = loadSperrmuster();
  const einst  = loadProjEinst();

  const aktivePakete = await _azAktivePakete(pakete, baubeginnDat);
  if (!aktivePakete) return;

  const neueZuw = {};
  let paketIdx  = 0;
  let schichtNr = 1;

  // Cache: Schichten pro Paket (datum-getrieben aufgelöst)
  const pakSchichtenCache = new Map();
  const getPakSchichten = pak => {
    if (!pakSchichtenCache.has(pak.id)) pakSchichtenCache.set(pak.id, bpGetSchichten(pak));
    return pakSchichtenCache.get(pak.id);
  };

  // Kapazität einer bestimmten Nacht in Minuten. Die Nettozeit kann je Nacht
  // verschieden sein — wird hier keine Schichtnummer übergeben, galt früher
  // pauschal die erste Nacht. Verbraucht wurde aber mit der Leistung der
  // aktuellen: bei gemischten Sperrmustern lief die Restkapazität auseinander.
  const getPaketKap = (pak, schichtNrOpt) => {
    const schichten = getPakSchichten(pak);
    const sch = schichtNrOpt != null
      ? schichten.find(s => s.schichtNr === schichtNrOpt)
      : schichten[0];
    const nettoH = sch?.nettoH || schichten[0]?.nettoH || resolveSpForPak(pak, pak.startDatum)?.nettoH;
    return nettoH ? Math.max(0, nettoH * 60 - (einst.abzugMinuten || 0)) : 0;
  };

  // Beim Behalten des Bestands gelten bereits belegte Nächte als besetzt. Sonst
  // würden neue Standorte in Nächte gelegt, deren Kapazität schon verbraucht
  // ist — die Restkapazität des Bestands lässt sich nicht zuverlässig
  // nachrechnen. Bewusst konservativ: lieber eine Nacht weiter als überbucht.
  const belegteNaechte = new Set();
  if (cfg.behalteManuell) {
    Object.values(bestand).forEach(z => {
      if (z.paketId && z.schichtNr) belegteNaechte.add(z.paketId + '#' + z.schichtNr);
      (z.bohrSchichten || []).forEach(s => belegteNaechte.add(s.paketId + '#' + s.schichtNr));
    });
  }

  // Prüft ob Schicht-Nr für ein Paket eine gültige Sperrmuster-Nacht hat
  const isSchichtValid = (pak, nr) =>
    !belegteNaechte.has(pak.id + '#' + nr) && !!getPakSchichten(pak).find(s => s.schichtNr === nr);

  // Weiterschalten zur nächsten gültigen Schicht im Pool
  const advanceSchicht = () => {
    do {
      schichtNr++;
      if (schichtNr > (aktivePakete[paketIdx]?.anzahlNaechte || 1)) {
        paketIdx++;
        schichtNr = 1;
      }
    } while (paketIdx < aktivePakete.length && !isSchichtValid(aktivePakete[paketIdx], schichtNr));
    if (paketIdx >= aktivePakete.length) paketIdx = aktivePakete.length;
  };

  // Startschicht vorwärts auf erste gültige Schicht setzen
  if (paketIdx < aktivePakete.length && !isSchichtValid(aktivePakete[paketIdx], schichtNr)) {
    advanceSchicht();
  }

  // Startversatz: erste N gültige Schichten überspringen
  const _offsetN = cfg.offsetNaechte || 0;
  for (let _oi = 0; _oi < _offsetN && paketIdx < aktivePakete.length; _oi++) advanceSchicht();

  // schichtRestMin nach Offset/Vorwärts-Sprung initialisieren
  let schichtRestMin = paketIdx < aktivePakete.length ? getPaketKap(aktivePakete[paketIdx], schichtNr) : 0;

  // ── FT-Baupaket-Zuweisungen auslesen ─────────────────────────
  const ftBaupaketzuweisung = {};
  ftList.forEach(ft => { if (ft.fixBaupaketzuweisungId) ftBaupaketzuweisung[ft.id] = ft.fixBaupaketzuweisungId; });

  // Typ-spezifische Pakete ermitteln (auto-generiert oder per bestehender Zuweisung)
  const existingZuwForTypes = loadSchichtZuw();
  const typePakMap = {};
  pakete.forEach(pak => {
    if (pak.id.startsWith('pak_auto_abbruch'))   typePakMap['abbruch']    = pak.id;
    if (pak.id.startsWith('pak_auto_sicherung')) typePakMap['sicherung']  = pak.id;
    if (pak.id.startsWith('pak_auto_prov'))      typePakMap['provisorium']= pak.id;
  });

  // ── Schritt A: ABB/SICH/PROV direkt in ihr Typ-Paket zuweisen ─
  // (laeuft vor der Pool-Logik und mit eigenem Schicht-Cursor)
  const abbNeueZuw = {};   // Abbruchseite der A+N-Standorte (eigener Speicher)
  const preAssigned = _azWeisePauschaltypenZu({
    typePakMap, pakete, pairs, allBpAuto, ftZuw, ftList, cfg, einst,
    neueZuw, abbNeueZuw, getPaketKap, isSchichtValid,
  });
  // Pre-assigned Pairs aus dem Pool entfernen
  pairs = pairs.filter(p => !preAssigned.has(p.id));

  // ── Schritt B: NB-Pairs in Pool und FT-fixed aufteilen ────────
  const fixedByPaket = {};   // { paketId: [pair, ...] }
  const poolPairs    = [];
  let   ueberzaehlig = 0;    // in die letzte Nacht geklemmt, weil Paket zu kurz
  const fehlNaechte  = {};   // { paketId: fehlende Nächte }

  pairs.forEach(p => {
    const ftId     = ftZuw[p.id];
    const fixPakId = ftId ? ftBaupaketzuweisung[ftId] : null;
    if (fixPakId) {
      if (!fixedByPaket[fixPakId]) fixedByPaket[fixPakId] = [];
      fixedByPaket[fixPakId].push(p);
    } else {
      poolPairs.push(p);
    }
  });

  // Pool-Sortierung: Gleise mit exklusiven Sperrmuster-Nächten zuerst
  // (KM-Reihenfolge bleibt innerhalb der Gruppe erhalten)
  _azSortiereNachGleisExklusivitaet(poolPairs, spList);

  // ── Baugruppen-Verwaltung (für Pfahlfundamente) ──────────────
  const neueBaugruppen = [];
  let aktGruppe = null;
  const GRUPPE_MAX = einst.bauGruppeMax || 3;

  // Hilfsfunktion: ein einzelnes Pair einem Baupaket + Schicht zuweisen
  const assignOnePair = (p, pak, sNr, curSp) => {
    const ftId   = ftZuw[p.id];
    const ft     = ftList.find(t => t.id === ftId);
    if (!ft) return false;
    const istPfahl = ft.fundamentArt === 'mehrpfahl' && parseInt(ft.anzahlPfaehle) > 0;
    if (istPfahl) {
      // Pfahlfundament: Baugruppe + Bohrschichten + optionaler Betonteil
      const anzahlPfähle = parseInt(ft.anzahlPfaehle);
      const effPL = _resolvePfahlLeistung(ft);
      const pfahlCalc    = _calcPfahlSchichten(effPL ? { ...ft, pfahlLeistung: effPL } : ft, curSp?.nettoH, einst.abzugMinuten);
      const pilesPerShift = pfahlCalc
        ? pfahlCalc.pilesPerShift
        : Math.max(1, Math.floor(getFtLeistung(ft, curSp?.nettoH, einst.abzugMinuten) || 1));
      const numBohrSchichten = pfahlCalc ? pfahlCalc.bohrShifts : Math.ceil(anzahlPfähle / pilesPerShift);
      const numBetonSchichten = pfahlCalc ? pfahlCalc.betonShifts : 0;
      const totalSchichten = numBohrSchichten + numBetonSchichten;

      const bohrSchichten = [];
      let remainingPfähle = anzahlPfähle;
      let pfahlNr = 1;
      let bSNr    = sNr;
      for (let i = 0; i < numBohrSchichten; i++) {
        const pilesThis = Math.min(Math.ceil(pilesPerShift), remainingPfähle);
        bohrSchichten.push({ paketId: pak.id, schichtNr: Math.min(bSNr, pak.anzahlNaechte || 1), pfahlVon: pfahlNr, pfahlBis: pfahlNr + pilesThis - 1 });
        remainingPfähle -= pilesThis;
        pfahlNr         += pilesThis;
        bSNr++;
      }
      const betonSchichtNr = numBetonSchichten > 0 ? Math.min(bSNr, pak.anzahlNaechte || 1) : null;

      neueZuw[p.id] = { paketId: pak.id, schichtNr: Math.min(sNr, pak.anzahlNaechte || 1), bohrSchichten, isPfahlFund: true };
      if (betonSchichtNr != null) neueZuw[p.id].betonSchichtNr = betonSchichtNr;
      if (!aktGruppe || aktGruppe.pairIds.length >= GRUPPE_MAX) {
        aktGruppe = { id: 'grp_' + Date.now() + '_' + neueBaugruppen.length, name: 'Gruppe ' + (neueBaugruppen.length + 1), pairIds: [] };
        neueBaugruppen.push(aktGruppe);
      }
      aktGruppe.pairIds.push(p.id);
      neueZuw[p.id].bauGruppeId = aktGruppe.id;
      return totalSchichten;
    } else {
      neueZuw[p.id] = { paketId: pak.id, schichtNr: Math.min(sNr, pak.anzahlNaechte || 1) };
      // Multi-Schicht-Fundamente: wenn ftIntervall > nettoH braucht ein Fundament mehrere Nächte
      if (curSp?.nettoH) {
        const _ftL = getFtLeistung(ft, curSp.nettoH, einst.abzugMinuten);
        if (_ftL != null && _ftL > 0 && _ftL < 1) return Math.ceil(1 / _ftL);
      }
      return 1;
    }
  };

  // ── Pfad 1: Fixed-Baupaket pairs (inkl. ABB/SICH/PROV) ──────
  Object.entries(fixedByPaket).forEach(([pakId, fixPairs]) => {
    // Gleis-spezifische Pairs zuerst, damit exklusive Nächte (z. B. Gl 66 → Muster A)
    // nicht von anderen Gleisen blockiert werden
    _azSortiereNachGleisExklusivitaet(fixPairs, spList);

    // Suche in allen Paketen, nicht nur aktivePakete (ABB/SICH/PROV haben ggf. kein Sperrmuster)
    const pak = pakete.find(p => p.id === pakId);
    if (!pak) {
      console.warn('Baupaket', pakId, 'nicht gefunden, Pairs übersprungen:', fixPairs.map(p=>p.id));
      return;
    }
    const sp     = resolveSpForPak(pak, pak.startDatum);
    let fxNr     = 1;
    let fxErschoepft = false;

    // Erste gültige Schicht
    while (fxNr <= (pak.anzahlNaechte || 1) && !isSchichtValid(pak, fxNr)) fxNr++;

    // Kapazität der jeweils aktuellen Nacht, nicht pauschal der ersten
    let fxRest = getPaketKap(pak, fxNr);

    const advFx = (consumed) => {
      for (let c = 0; c < (consumed || 1); c++) {
        fxNr++;
        while (fxNr <= (pak.anzahlNaechte || 1) && !isSchichtValid(pak, fxNr)) fxNr++;
      }
      fxRest = getPaketKap(pak, fxNr);
    };

    fixPairs.forEach(p => {
      // Paket erschöpft: das Fundament bleibt zugewiesen, wird aber in die
      // letzte Nacht gelegt. Ohne Meldung sah das wie eine fehlerhafte
      // Zuweisung aus — mehrere Fundamente stapelten sich stumm in einer Nacht.
      // Ab dem Übertritt zählt jedes weitere Fundament mit, nicht nur das erste.
      // Wie viele Nächte fehlen, wird je Paket festgehalten: danach lässt sich
      // anbieten, das Paket zu verlängern, statt die Zahl von Hand zu suchen.
      // fxNr läuft bewusst über die Paketlänge hinaus weiter — nur so ist
      // ablesbar, wie viele Nächte fehlen. Das Klemmen auf die letzte Nacht
      // übernimmt assignOnePair.
      const _maxN = pak.anzahlNaechte || 1;
      if (fxNr > _maxN) {
        fehlNaechte[pak.id] = fxNr - _maxN;
        fxErschoepft = true;
      }
      if (fxErschoepft) ueberzaehlig++;
      const ftId2    = ftZuw[p.id];
      const ft2      = ftList.find(t => t.id === ftId2);

      // ── Gleis-Advance (Pfad 1): Nächte ohne gültiges SP für dieses Gleis überspringen ─
      if (p.gleis) {
        const _fxGleis = String(p.gleis).trim();
        const _maxNr   = pak.anzahlNaechte || 1;
        let _fxGuard   = 0;
        let _fxMoved   = false;
        while (fxNr <= _maxNr && _fxGuard++ < 300) {
          const _fxSch = getPakSchichten(pak).find(s => s.schichtNr === fxNr);
          if (!_fxSch) break;
          if (resolveSpForGleis(_fxGleis, _fxSch.datum)) break; // kompatibel
          fxNr++;
          while (fxNr <= _maxNr && !isSchichtValid(pak, fxNr)) fxNr++;
          fxRest = getPaketKap(pak, fxNr);
          _fxMoved = true;
        }
        if (fxNr > _maxNr) return; // kein kompatibler Slot → Pair überspringen
        // Kapazität nur zurücksetzen wenn wir tatsächlich auf eine neue Nacht gesprungen sind —
        // sonst wird die bisherige Buchung des vorherigen Fundamentes überschrieben.
        if (_fxMoved) {
          const _fxSch2 = getPakSchichten(pak).find(s => s.schichtNr === fxNr);
          const _fxSp   = _fxSch2?.datum ? resolveSpForGleis(_fxGleis, _fxSch2.datum) : null;
          if (_fxSp?.nettoH) fxRest = Math.max(0, _fxSp.nettoH * 60 - (einst.abzugMinuten || 0));
        }
      }

      // SP für dieses Pair (gleis-spezifisch) für Kapazitätsberechnung
      const _fxSch  = getPakSchichten(pak).find(s => s.schichtNr === fxNr);
      const pairSp  = (p.gleis && _fxSch?.datum)
        ? (resolveSpForGleis(String(p.gleis).trim(), _fxSch.datum) || sp)
        : sp;

      const consumed = assignOnePair(p, pak, fxNr, pairSp);

      if (ft2 && cfg.strategie !== 'einzel' && pairSp?.nettoH) {
        const pairKap = Math.max(0, pairSp.nettoH * 60 - (einst.abzugMinuten || 0));
        const ftLeis  = getFtLeistung(ft2, pairSp.nettoH, einst.abzugMinuten);
        const dur     = (ftLeis != null && ftLeis > 0 && pairKap > 0) ? pairKap / ftLeis : null;
        if (dur != null) {
          fxRest -= dur;
          if (fxRest <= 0) advFx(consumed);
          return;
        }
      }
      advFx(consumed);
    });
  });

  // ── Pfad 2: Pool pairs (bestehende sequenzielle Logik) ───────
  poolPairs.forEach(p => {
    if (paketIdx >= aktivePakete.length) return;

    const ftId = ftZuw[p.id];
    const ft   = ftList.find(t => t.id === ftId);
    if (!ft) return;

    // ── Gleis-Vorvorrücken: Nächte ohne gültiges SP für dieses Gleis überspringen ──
    // Massgebend ist resolveSpForGleis(p.gleis, datum) — NICHT _sch.spId aus dem Cache.
    // Der Cache wird mit gleise=[] aufgebaut und gibt daher immer das "spezifischste" SP
    // zurück (z.B. Muster A mit gleisNr='66'). Ein Pair auf Gl-63 würde so fälschlicherweise
    // alle Nächte als "Muster-A-exklusiv" bewerten, obwohl Muster B an denselben Daten gilt.
    // resolveSpForGleis(p.gleis, datum) löst korrekt auf: Muster B für Gl-63 an einem Datum
    // wo Muster A UND Muster B gültig sind.
    if (p.gleis) {
      const _pGleis = String(p.gleis).trim();
      let _guard = 0;
      let _moved = false;
      while (paketIdx < aktivePakete.length && _guard++ < 300) {
        const _sch = getPakSchichten(aktivePakete[paketIdx]).find(s => s.schichtNr === schichtNr);
        if (!_sch) break; // kein Schicht-Eintrag → nicht weiterrücken
        if (resolveSpForGleis(_pGleis, _sch.datum)) break; // gültiges SP für dieses Gleis → kompatibel
        // Kein SP für dieses Gleis an diesem Datum → Nacht überspringen
        advanceSchicht();
        _moved = true;
        if (paketIdx < aktivePakete.length) schichtRestMin = getPaketKap(aktivePakete[paketIdx], schichtNr);
      }
      if (paketIdx >= aktivePakete.length) return;
      // schichtRestMin nur zurücksetzen wenn wir tatsächlich auf eine neue Nacht gesprungen sind,
      // sonst wird die bisherige Kapazitätsbuchung (aus vorherigen Fundamenten in derselben Nacht)
      // überschrieben und jedes Fundament landet fälschlicherweise in einer eigenen Nacht.
      if (_moved) {
        const _advSch = getPakSchichten(aktivePakete[paketIdx]).find(s => s.schichtNr === schichtNr);
        const _advSp  = _advSch?.datum ? resolveSpForGleis(_pGleis, _advSch.datum) : null;
        if (_advSp?.nettoH) schichtRestMin = Math.max(0, _advSp.nettoH * 60 - (einst.abzugMinuten || 0));
      }
    }

    const curPak      = aktivePakete[paketIdx];
    const _nightSch   = getPakSchichten(curPak).find(s => s.schichtNr === schichtNr);
    const _nightDate  = _nightSch?.datum || curPak.startDatum;
    // SP pro Fundament: p.gleis bestimmt das relevante Sperrmuster.
    // Fallback auf den für diese Nacht geplanten SP (spId), falls resolveSpForGleis nichts findet.
    const curSp = resolveSpForGleis(p.gleis, _nightDate)
               || (_nightSch?.spId ? spList.find(s => s.id === _nightSch.spId) : null);
    if (!curSp) return; // kein gültiges SP → Pair ohne Zuweisung überspringen
    const istPfahl = ft.fundamentArt === 'mehrpfahl' && parseInt(ft.anzahlPfaehle) > 0;

    if (istPfahl) {
      const anzahlPfähle  = parseInt(ft.anzahlPfaehle);
      const effPL2 = _resolvePfahlLeistung(ft);
      const pfahlCalc     = _calcPfahlSchichten(effPL2 ? { ...ft, pfahlLeistung: effPL2 } : ft, curSp?.nettoH, einst.abzugMinuten);
      const numBetonSchichten = pfahlCalc ? pfahlCalc.betonShifts : 0;

      const bohrSchichten = [];
      let remainingPfähle = anzahlPfähle;
      let pfahlNr = 1;
      let firstPaketId = paketIdx < aktivePakete.length ? aktivePakete[paketIdx].id : null;

      while (remainingPfähle > 0 && paketIdx < aktivePakete.length) {
        const thisPak      = aktivePakete[paketIdx];
        const _tDate       = getPakSchichten(thisPak).find(s => s.schichtNr === schichtNr)?.datum || thisPak.startDatum;
        const thisSp       = resolveSpForGleis(p.gleis, _tDate) || resolveSpForGleis(null, _tDate);
        const thisPpS  = pfahlCalc
          ? Math.max(0.01, (Math.max(0.1, thisSp?.nettoH || 8) - (einst.abzugMinuten||0)/60) / pfahlCalc.pilesPerShift * pfahlCalc.pilesPerShift)
          : Math.max(1, Math.floor(getFtLeistung(ft, thisSp?.nettoH, einst.abzugMinuten) || 1));
        const pilesThis = Math.min(Math.ceil(pfahlCalc ? pfahlCalc.pilesPerShift : thisPpS), remainingPfähle);

        bohrSchichten.push({ paketId: aktivePakete[paketIdx].id, schichtNr, pfahlVon: pfahlNr, pfahlBis: pfahlNr + pilesThis - 1 });
        remainingPfähle -= pilesThis;
        pfahlNr         += pilesThis;

        advanceSchicht();
        if (paketIdx < aktivePakete.length) schichtRestMin = getPaketKap(aktivePakete[paketIdx], schichtNr);
      }

      // Betonteil nach Bohrschichten einplanen
      let betonSchichtNr = null;
      if (numBetonSchichten > 0 && paketIdx < aktivePakete.length) {
        betonSchichtNr = schichtNr;
        for (let i = 0; i < numBetonSchichten && paketIdx < aktivePakete.length; i++) {
          advanceSchicht();
          if (paketIdx < aktivePakete.length) schichtRestMin = getPaketKap(aktivePakete[paketIdx], schichtNr);
        }
      }

      const lastBohr = bohrSchichten[bohrSchichten.length - 1] || { paketId: firstPaketId, schichtNr: 1 };
      neueZuw[p.id] = { paketId: lastBohr.paketId, schichtNr: lastBohr.schichtNr, bohrSchichten, isPfahlFund: true };
      if (betonSchichtNr != null) neueZuw[p.id].betonSchichtNr = betonSchichtNr;

      if (!aktGruppe || aktGruppe.pairIds.length >= GRUPPE_MAX) {
        aktGruppe = { id: 'grp_' + Date.now() + '_' + neueBaugruppen.length, name: 'Gruppe ' + (neueBaugruppen.length + 1), pairIds: [] };
        neueBaugruppen.push(aktGruppe);
      }
      aktGruppe.pairIds.push(p.id);
      neueZuw[p.id].bauGruppeId = aktGruppe.id;

    } else {
      neueZuw[p.id] = { paketId: curPak.id, schichtNr };

      if (cfg.strategie === 'einzel') {
        // Einzelzuweisung: immer zur nächsten Schicht vorrücken
        advanceSchicht();
        if (paketIdx < aktivePakete.length) schichtRestMin = getPaketKap(aktivePakete[paketIdx], schichtNr);
      } else {
        // Kapazitätsbasiert — curSp ist bereits per Fundament-Gleis aufgelöst
        const pakKap     = curSp?.nettoH ? Math.max(0, curSp.nettoH * 60 - (einst.abzugMinuten || 0)) : getPaketKap(curPak, schichtNr);
        const ftLeistung = getFtLeistung(ft, curSp?.nettoH, einst.abzugMinuten);
        const durMin     = (ftLeistung != null && ftLeistung > 0 && pakKap > 0)
          ? pakKap / ftLeistung
          : null;

        if (durMin != null && durMin > 0) {
          schichtRestMin -= durMin;
          if (schichtRestMin <= 0) {
            // Multi-Schicht-Fundament: Cursor um ceil(1/ftLeistung) Nächte vorrücken
            const _nAdv = (ftLeistung > 0 && ftLeistung < 1) ? Math.ceil(1 / ftLeistung) : 1;
            for (let _ai = 0; _ai < _nAdv && paketIdx < aktivePakete.length; _ai++) {
              advanceSchicht();
              if (paketIdx < aktivePakete.length) schichtRestMin = getPaketKap(aktivePakete[paketIdx], schichtNr);
            }
          }
        } else {
          // Kein Kapazitätswert ermittelbar oder Kapazität = 0 → Einzelzuweisung
          advanceSchicht();
          if (paketIdx < aktivePakete.length) schichtRestMin = getPaketKap(aktivePakete[paketIdx], schichtNr);
        }
      }
    }
  });

  _azBerechneGruppenTermine(neueBaugruppen, neueZuw, aktivePakete);

  saveBaugruppen(neueBaugruppen);
  // Beim Behalten wird der Bestand vorangestellt, sonst ersetzt der Lauf alles
  saveSchichtZuw(cfg.behalteManuell ? Object.assign({}, bestand, neueZuw) : neueZuw);
  // Abbruchseite der A+N-Standorte in ihren eigenen Speicher. Bestehende
  // Einträge anderer Standorte bleiben erhalten — die Auto-Zuweisung ersetzt
  // nur, was sie selbst vergeben hat.
  if (Object.keys(abbNeueZuw).length) {
    saveAbbZuw(Object.assign(loadAbbZuw(), abbNeueZuw));
  }

  renderBauprogrammTab();
  _bpZuwDirty = false; _syncBpDirtyButtons();

  // Zu kurze Pakete: verlängern anbieten statt den Nutzer die Zahl suchen zu
  // lassen. Nach dem Verlängern läuft die Zuweisung erneut — dann passen alle
  // Fundamente in ihre Nacht und die Kaskade zieht die Folgepakete nach.
  if (!_azErneut && Object.keys(fehlNaechte).length) {
    const namen = Object.entries(fehlNaechte).map(([id, n]) => {
      const p = pakete.find(q => q.id === id);
      return '· ' + (p?.name || id) + ': ' + (p?.anzahlNaechte || 1) + ' → ' + ((p?.anzahlNaechte || 1) + n) + ' Nächte';
    }).join('\n');
    if (await ui.confirm('Für alle Fundamente reichen die Nächte nicht:\n\n' + namen
                       + '\n\nPakete verlängern und neu zuweisen?', { ok: 'Verlängern' })) {
      const akt = loadBaupakete();
      akt.forEach(p => { if (fehlNaechte[p.id]) p.anzahlNaechte = (p.anzahlNaechte || 1) + fehlNaechte[p.id]; });
      akt.forEach(p => bpKaskade(p.id, akt));
      saveBaupakete(akt);
      _azErneut = true;
      try { await autoZuweisenSchichten(config); } finally { _azErneut = false; }
      return;
    }
  }

  // Abschlussmeldung ist eine Erfolgsmeldung — der Schweregrad 'fehler' war ein
  // Rueckstand aus der mechanischen alert()-Umstellung und zeigte sie rot an.
  ui.toast(_azErgebnisMeldung(neueZuw, pairs, neueBaugruppen, Object.keys(abbNeueZuw).length, ueberzaehlig), 'erfolg');
}

// ── Auto-Zuweisung Konfiguration ──────────────────────────────
function _defaultAzConfig() {
  return { sortierung: 'km_asc', strategie: 'kapazitaet', assignAbbruch: true, assignSicherung: true,
           assignProvisorium: true, offsetNaechte: 0, behalteManuell: false };
}
function loadAutoZuwConfig() {
  try { return Object.assign(_defaultAzConfig(), jsonParse(store.getItem('sp_az_cfg__' + _activeId) || 'null') || {}); } catch { return _defaultAzConfig(); }
}
function saveAutoZuwConfig(cfg) {
  store.setItem('sp_az_cfg__' + _activeId, JSON.stringify(cfg));
}
// Los-Konfiguration aus dem Auto-Pakete-Reiter lesen. Eigene Funktion, damit
// die Paket-Erzeugung und die Voreinstellungen dieselbe Struktur erzeugen.
// Kein gleis auf Paket-Ebene — das Sperrmuster wird pro Fundament aufgelöst.
function _readApakKonfigAusModal() {
  const konfig = {};
  _apakGruppen.forEach(g => {
    konfig[g.key] = {
      name:   document.getElementById(`apak-name-${g.key}`)?.value || g.label,
      teamId: document.getElementById(`apak-team-${g.key}`)?.value || '',
    };
  });
  ['abbruch','sicherung','provisorium'].forEach(key => {
    konfig[key] = {
      generate: document.getElementById(`apak-gen-${key}`)?.checked !== false,
      name:     document.getElementById(`apak-name-${key}`)?.value  || '',
      teamId:   document.getElementById(`apak-team-${key}`)?.value  || '',
    };
  });
  return konfig;
}

// ── Voreinstellungen Auto-Pakete ──────────────────────────────
// Gespeichert wird die Los-Konfiguration (Namen, Team, erzeugen ja/nein) aus
// einst.autoPakKonfig — dieselbe Struktur, die die Paket-Erzeugung liest.
function loadApakPresets() {
  try { return jsonParse(store.getItem('sp_apak_presets__' + _activeId) || '[]'); } catch { return []; }
}
function saveApakPresets(p) { store.setItem('sp_apak_presets__' + _activeId, JSON.stringify(p)); }

function renderApakPresetList() {
  const wrap = document.getElementById('apak-preset-list');
  if (!wrap) return;
  const list = loadApakPresets();
  wrap.innerHTML = list.length
    ? list.map((p, i) =>
        '<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:6px;'
        + 'border:1px solid #e5e7eb;background:#f9fafb;font-size:11px;margin:0 4px 4px 0;">'
        + '<button type="button" onclick="loadApakPreset(' + i + ')" style="background:none;border:none;padding:0;'
        + 'cursor:pointer;color:#1a3a5c;font-weight:600;font-size:11px;">' + escHtml(p.name) + '</button>'
        + '<button type="button" onclick="deleteApakPreset(' + i + ')" title="Löschen" style="background:none;'
        + 'border:none;padding:0;cursor:pointer;color:#9ca3af;font-size:12px;line-height:1;">×</button></span>').join('')
    : '<span style="font-size:11px;color:#9ca3af;">Noch keine Voreinstellung gespeichert.</span>';
}

function saveApakPreset() {
  const nameFld = document.getElementById('apak-preset-name');
  const name = (nameFld?.value || '').trim();
  if (!name) { ui.toast('Bitte Bezeichnung eingeben.', 'fehler'); return; }
  const list = loadApakPresets();
  const konfig = _readApakKonfigAusModal();
  const idx = list.findIndex(p => p.name === name);
  if (idx >= 0) list[idx] = { name, konfig }; else list.push({ name, konfig });
  saveApakPresets(list);
  if (nameFld) nameFld.value = '';
  renderApakPresetList();
  ui.toast('Voreinstellung «' + name + '» gespeichert.', 'erfolg');
}

function loadApakPreset(idx) {
  const p = loadApakPresets()[idx];
  if (!p) return;
  const einst = loadProjEinst();
  einst.autoPakKonfig = p.konfig;
  saveProjEinst(einst);
  openAutoPaketeModal();
  ui.toast('Voreinstellung «' + p.name + '» geladen.', 'erfolg');
}

async function deleteApakPreset(idx) {
  const list = loadApakPresets();
  if (!list[idx]) return;
  if (!await ui.confirm('Voreinstellung «' + list[idx].name + '» löschen?', { gefaehrlich: true })) return;
  list.splice(idx, 1);
  saveApakPresets(list);
  renderApakPresetList();
}

function loadAutoZuwPresets() {
  try { return jsonParse(store.getItem('sp_az_presets__' + _activeId) || '[]'); } catch { return []; }
}
function saveAutoZuwPresets(p) {
  store.setItem('sp_az_presets__' + _activeId, JSON.stringify(p));
}

function openAutoZuwModal() {
  const cfg = loadAutoZuwConfig();
  const sortR = document.querySelector(`input[name="az-sort"][value="${cfg.sortierung}"]`);
  if (sortR) sortR.checked = true;
  const stratR = document.querySelector(`input[name="az-strat"][value="${cfg.strategie}"]`);
  if (stratR) stratR.checked = true;
  const cbAbb  = document.getElementById('az-assign-abbruch'); if (cbAbb)  cbAbb.checked  = cfg.assignAbbruch  !== false;
  const cbSich = document.getElementById('az-assign-sich');    if (cbSich) cbSich.checked = cfg.assignSicherung !== false;
  const offEl  = document.getElementById('az-offset-naechte'); if (offEl)  offEl.value    = cfg.offsetNaechte || 0;
  const cbProv = document.getElementById('az-assign-prov');    if (cbProv) cbProv.checked = cfg.assignProvisorium !== false;
  const cbBeh  = document.getElementById('az-behalte-manuell'); if (cbBeh) cbBeh.checked  = cfg.behalteManuell === true;
  // sicherungLeistung ist der Altbestand aus der Zeit, als es das Feld nur für
  // Sicherungen gab — weiterhin lesen, damit gespeicherte Werte nicht verfallen.
  const pl = cfg.pauschalLeistung || {};
  const setzen = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  setzen('az-leis-abbruch',  pl.abbruch);
  setzen('az-sich-leistung', pl.sicherung ?? cfg.sicherungLeistung);
  setzen('az-leis-prov',     pl.provisorium);
  // Vorschau bei jeder Änderung im Reiter neu rechnen
  const tab = document.getElementById('bpeist-tab-autozuw');
  if (tab && !tab._vorschauGebunden) {
    tab.addEventListener('change', renderAzVorschau);
    tab.addEventListener('input',  renderAzVorschau);
    tab._vorschauGebunden = true;
  }
  renderAzVorschau();
  renderAzPresetList();
  // Tab-Inhalt befüllt — Modal wird von openProjEinstModal geöffnet
}

function closeAutoZuwModal() {
  closeProjEinstModal();
}

function _readAzConfigFromModal() {
  return {
    sortierung:         document.querySelector('input[name="az-sort"]:checked')?.value  || 'km_asc',
    strategie:          document.querySelector('input[name="az-strat"]:checked')?.value || 'kapazitaet',
    assignAbbruch:      document.getElementById('az-assign-abbruch')?.checked !== false,
    assignSicherung:    document.getElementById('az-assign-sich')?.checked    !== false,
    assignProvisorium:  document.getElementById('az-assign-prov')?.checked    !== false,
    offsetNaechte:      parseInt(document.getElementById('az-offset-naechte')?.value) || 0,
    behalteManuell:     document.getElementById('az-behalte-manuell')?.checked === true,
    // Minuten je Standort für Lose ohne hinterlegten Fundamenttyp
    pauschalLeistung: {
      abbruch:     parseFloat(document.getElementById('az-leis-abbruch')?.value)  || null,
      sicherung:   parseFloat(document.getElementById('az-sich-leistung')?.value) || null,
      provisorium: parseFloat(document.getElementById('az-leis-prov')?.value)     || null,
    },
  };
}

// Vorschau: zeigt vor dem Zuweisen, welches Los wie viele Standorte bekommt
// und ob dessen Nächte reichen. Bewusst eine Schätzung aus derselben
// Kapazitätsrechnung wie die Zuweisung — der genaue Verlauf hängt an
// übersprungenen Nächten und ist erst im Lauf bekannt.
function renderAzVorschau() {
  const el = document.getElementById('az-vorschau');
  if (!el) return;
  const cfg    = _readAzConfigFromModal();
  const allBp  = loadAllBauprojekt();
  const pakete = loadBaupakete();
  if (!pakete.length) { el.innerHTML = ''; return; }

  let pairs = _azWaehlePairs(cfg, allBp);
  const bestand = loadSchichtZuw();
  const behalten = cfg.behalteManuell ? pairs.filter(p => bestand[p.id]?.paketId).length : 0;
  if (cfg.behalteManuell) pairs = pairs.filter(p => !bestand[p.id]?.paketId);

  const ftZuw  = loadFtZuweisungen();
  const ftList = loadFtProfile();
  const einst  = loadProjEinst();
  const fixMap = {};
  ftList.forEach(ft => { if (ft.fixBaupaketzuweisungId) fixMap[ft.id] = ft.fixBaupaketzuweisungId; });
  const typPak = {};
  pakete.forEach(p => {
    if (p.id.startsWith('pak_auto_abbruch'))   typPak['abbruch']     = p.id;
    if (p.id.startsWith('pak_auto_sicherung')) typPak['sicherung']   = p.id;
    if (p.id.startsWith('pak_auto_prov'))      typPak['provisorium'] = p.id;
  });

  const proPaket = {};
  pairs.forEach(p => {
    const typ = getPairBpTyp(p.id, allBp);
    const pakId = typPak[typ] || fixMap[ftZuw[p.id]] || pakete[0].id;
    if (!proPaket[pakId]) proPaket[pakId] = [];
    proPaket[pakId].push(p);
  });

  const stdSp = loadSperrmuster().find(s => s.id === einst.standardSperrmusterId) || loadSperrmuster()[0];
  const zeilen = Object.entries(proPaket).map(([id, ps]) => {
    const pak  = pakete.find(q => q.id === id);
    const noetig = bpNaechteFuerPairs(ps, ftList, ftZuw, stdSp, pak?.startDatum, 1, einst.abzugMinuten);
    const da   = pak?.anzahlNaechte || 1;
    const eng  = noetig > da;
    return '<div style="display:flex;gap:8px;' + (eng ? 'color:#dc2626;' : '') + '">'
      + '<span style="flex:1;">' + escHtml(pak?.name || id) + '</span>'
      + '<span>' + ps.length + ' Standorte</span>'
      + '<span style="min-width:92px;text-align:right;">' + noetig + ' / ' + da + ' Nächte</span></div>';
  });

  el.innerHTML = zeilen.length
    ? '<div style="padding:9px 12px;border-radius:7px;border:1px solid #e5e7eb;background:#f9fafb;">'
      + '<div style="font-weight:700;margin-bottom:5px;">Vorschau <span style="font-weight:400;color:#9ca3af;">· geschätzt</span></div>'
      + zeilen.join('')
      + (behalten ? '<div style="color:#6b7280;margin-top:5px;">' + behalten + ' bestehende Zuweisungen bleiben unberührt</div>' : '')
      + '</div>'
    : '<div style="color:#9ca3af;">Keine Standorte für die aktuelle Auswahl.</div>';
}

function applyAutoZuwConfig() {
  const cfg = _readAzConfigFromModal();
  saveAutoZuwConfig(cfg);
  closeProjEinstModal();
  autoZuweisenSchichten(cfg);
}

function resetAutoZuwModal() {
  const def = _defaultAzConfig();
  const sortR = document.querySelector(`input[name="az-sort"][value="${def.sortierung}"]`);
  if (sortR) sortR.checked = true;
  const stratR = document.querySelector(`input[name="az-strat"][value="${def.strategie}"]`);
  if (stratR) stratR.checked = true;
  const cbAbb  = document.getElementById('az-assign-abbruch'); if (cbAbb)  cbAbb.checked  = def.assignAbbruch;
  const cbSich = document.getElementById('az-assign-sich');    if (cbSich) cbSich.checked = def.assignSicherung;
  const cbProv = document.getElementById('az-assign-prov');    if (cbProv) cbProv.checked = def.assignProvisorium;
  const offEl  = document.getElementById('az-offset-naechte'); if (offEl)  offEl.value    = 0;
  const leistEl   = document.getElementById('az-sich-leistung');
  const leistWrap = document.getElementById('az-sich-leis-wrap');
  if (leistEl)   leistEl.value = '';
  if (leistWrap) leistWrap.style.display = 'flex';
}

function renderAzPresetList() {
  const presets = loadAutoZuwPresets();
  const list    = document.getElementById('az-preset-list');
  if (!list) return;
  if (!presets.length) {
    list.innerHTML = '<div style="font-size:11px;color:#9ca3af;padding:2px 0;">Noch keine Presets gespeichert.</div>';
    return;
  }
  list.innerHTML = presets.map((pr, i) => `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
      <button onclick="loadAutoZuwPreset(${i})" style="flex:1;text-align:left;padding:5px 10px;border-radius:6px;border:1px solid #d1d5db;background:white;font-size:12px;font-weight:500;color:#374151;cursor:pointer;">${pr.name}</button>
      <button onclick="deleteAutoZuwPreset(${i})" style="padding:5px 8px;border-radius:6px;border:1px solid #fca5a5;background:#fef2f2;color:#dc2626;font-size:12px;font-weight:700;cursor:pointer;">×</button>
    </div>`).join('');
}

function loadAutoZuwPreset(idx) {
  const pr = loadAutoZuwPresets()[idx];
  if (!pr) return;
  const sortR = document.querySelector(`input[name="az-sort"][value="${pr.config.sortierung||'km_asc'}"]`);
  if (sortR) sortR.checked = true;
  const stratR = document.querySelector(`input[name="az-strat"][value="${pr.config.strategie||'kapazitaet'}"]`);
  if (stratR) stratR.checked = true;
  const cbAbb  = document.getElementById('az-assign-abbruch'); if (cbAbb)  cbAbb.checked  = pr.config.assignAbbruch  !== false;
  const cbSich = document.getElementById('az-assign-sich');    if (cbSich) cbSich.checked = pr.config.assignSicherung !== false;
  const cbProv = document.getElementById('az-assign-prov');    if (cbProv) cbProv.checked = pr.config.assignProvisorium !== false;
}

function saveAutoZuwPreset() {
  const name = (document.getElementById('az-preset-name')?.value || '').trim();
  if (!name) { ui.toast('Bitte Preset-Name eingeben.', 'fehler'); return; }
  const cfg     = _readAzConfigFromModal();
  const presets = loadAutoZuwPresets();
  const idx     = presets.findIndex(p => p.name === name);
  if (idx >= 0) presets[idx].config = cfg; else presets.push({ name, config: cfg });
  saveAutoZuwPresets(presets);
  const inp = document.getElementById('az-preset-name');
  if (inp) inp.value = '';
  renderAzPresetList();
}

function deleteAutoZuwPreset(idx) {
  const presets = loadAutoZuwPresets();
  presets.splice(idx, 1);
  saveAutoZuwPresets(presets);
  renderAzPresetList();
}

// ── Projekt-Einstellungen Modal ───────────────────────────────
function openProjEinstModal(tab = 'lose') {
  const einst  = loadProjEinst();
  const spList = loadSperrmuster();

  // Tab 1: Lose
  renderEinstTeamsList(einst.teams || []);
  const spSel = document.getElementById('einst-std-sperrmuster');
  if (spSel) {
    spSel.innerHTML = '<option value="">— kein Standard —</option>'
      + spList.map(s => `<option value="${s.id}" ${einst.standardSperrmusterId === s.id ? 'selected' : ''}>${s.name}</option>`).join('');
  }
  const feiEl = document.getElementById('einst-feiertage');
  if (feiEl) feiEl.checked = !!einst.berücksichtigeFeiertage;
  // Tab 2: Zeitplanung
  const bbMs  = loadMeilensteine().find(m => m.typ === 'baubeginn');
  const bbDat = bbMs ? msMsResolvedDatum(bbMs) : null;
  const bbFld = document.getElementById('einst-baubeginn');
  const bbHint = document.getElementById('einst-baubeginn-hint');
  if (bbFld) {
    if (bbDat) {
      bbFld.value = bbDat; bbFld.disabled = true;
      bbFld.style.background = '#f3f4f6'; bbFld.style.color = '#9ca3af';
      if (bbHint) { bbHint.style.display = ''; bbHint.textContent = 'Wird vom Meilenstein „Baubeginn" gesteuert.'; }
    } else {
      bbFld.value = einst.baubeginn || ''; bbFld.disabled = false;
      bbFld.style.background = ''; bbFld.style.color = '';
      if (bbHint) bbHint.style.display = 'none';
    }
  }
  const abzugEl = document.getElementById('einst-abzug');
  if (abzugEl) abzugEl.value = einst.abzugMinuten || '';
  const bgMaxEl = document.getElementById('einst-baugruppe-max');
  if (bgMaxEl) bgMaxEl.value = einst.bauGruppeMax || 3;
  const aushaerteFld = document.getElementById('einst-aushaerte');
  const bbVersatzFld = document.getElementById('einst-bb-versatz');
  const flPufferFld  = document.getElementById('einst-fl-puffer');
  if (aushaerteFld) aushaerteFld.value = einst.aushaerteTage  ?? 28;
  if (bbVersatzFld) bbVersatzFld.value = einst.bbVersatzTage  ?? 7;
  if (flPufferFld)  flPufferFld.value  = einst.flMontagePuffer ?? 7;

  // Tab 3: Auto-Pakete — Inhalt vorbereiten falls Daten vorhanden
  if (tab === 'autopak') {
    if (!_apakGruppen.length) { _prepareApakGruppen(); }
    openAutoPaketeModal();
  }

  // Tab 4: Auto-Zuweisung
  if (tab === 'autozuw') {
    openAutoZuwModal();
  }

  document.getElementById('proj-einst-modal').style.display = 'flex';
  switchBpEinstTab(tab);

  // Hinweis-Bereich zurücksetzen
  const hint = document.getElementById('bpeist-hint');
  if (hint) hint.style.display = 'none';
}

// Stilles Speichern ohne Modal schliessen (für Tab-Wechsel)
function _autoSaveProjEinst() {
  const bbFld = document.getElementById('einst-baubeginn');
  if (!bbFld) return;
  const teams = _readTeamRows()
    .map((t, i) => ({ ...t, name: t.name.trim() || ('Los ' + (i+1)) }))
    .filter(t => t.name);
  const einst = {
    ...loadProjEinst(),
    baubeginn:               bbFld.disabled ? (loadProjEinst().baubeginn || '') : (bbFld.value || ''),
    abzugMinuten:            parseInt(document.getElementById('einst-abzug')?.value) || 0,
    berücksichtigeFeiertage: document.getElementById('einst-feiertage')?.checked ?? false,
    bauGruppeMax:            parseInt(document.getElementById('einst-baugruppe-max')?.value) || 3,
    standardSperrmusterId:   document.getElementById('einst-std-sperrmuster')?.value || '',
    aushaerteTage:           parseInt(document.getElementById('einst-aushaerte')?.value) || 28,
    flMontagePuffer:         parseInt(document.getElementById('einst-fl-puffer')?.value) || 7,
    bbVersatzTage:           parseInt(document.getElementById('einst-bb-versatz')?.value) || 7,
    teams,
  };
  const vorherAushaerte = loadProjEinst().aushaerteTage ?? 28;
  saveProjEinst(einst);
  // Geänderte Aushärtezeit auf alle Fundamente OHNE eigenen Wert nachziehen.
  // Ohne das blieben gespeicherte Ausschaltermine auf dem alten Stand — die
  // Einstellung wirkte dann nur auf neu betonierte Fundamente.
  if ((einst.aushaerteTage ?? 28) !== vorherAushaerte) {
    bpAushaerteNeuBerechnen(einst.aushaerteTage ?? 28);
  }
  if (einst.baubeginn) {
    const msList = loadMeilensteine();
    let bbMs = msList.find(m => m.typ === 'baubeginn');
    if (!bbMs) { bbMs = { id: 'ms_bb_auto', typ: 'baubeginn', name: 'Baubeginn' }; msList.push(bbMs); }
    if (bbMs.datum !== einst.baubeginn) { bbMs.datum = einst.baubeginn; saveMeilensteine(msList); }
  }
}

function switchBpEinstTab(tab) {
  // Beim Verlassen von Lose/Zeitplanung: Daten automatisch sichern
  if (_bpEinstActiveTab === 'lose' || _bpEinstActiveTab === 'zeitplanung') {
    _autoSaveProjEinst();
  }
  _bpEinstActiveTab = tab;
  ['lose','zeitplanung','autopak','autozuw'].forEach(t => {
    const panel = document.getElementById('bpeist-tab-' + t);
    const btn   = document.getElementById('bpeist-btn-' + t);
    if (panel) panel.style.display = t === tab ? '' : 'none';
    if (btn) btn.classList.toggle('aktiv', t === tab);
  });
  const savBtn = document.getElementById('bpeist-save-btn');
  const genBtn = document.getElementById('bpeist-gen-btn');
  const zuwBtn = document.getElementById('bpeist-zuw-btn');
  const rstBtn = document.getElementById('bpeist-reset-btn');
  if (savBtn) savBtn.style.display = (tab === 'lose' || tab === 'zeitplanung') ? '' : 'none';
  if (genBtn) genBtn.style.display = tab === 'autopak' ? 'flex' : 'none';
  if (zuwBtn) zuwBtn.style.display = tab === 'autozuw' ? 'flex' : 'none';
  if (rstBtn) rstBtn.style.display = (tab === 'lose' || tab === 'zeitplanung') ? '' : 'none';

  // Tab-Inhalt initialisieren (mit frisch gespeicherten Daten)
  if (tab === 'autopak') {
    if (!_apakGruppen.length) _prepareApakGruppen();
    openAutoPaketeModal();
  }
  if (tab === 'autozuw') {
    openAutoZuwModal();
  }
}

function _runGeneratePakete() {
  const einst = loadProjEinst();
  const lose  = einst.teams || [];
  // Kein Los definiert → Warnung, aber nicht blockieren (Paket wird ohne Team generiert)
  const msList = loadMeilensteine();
  const bbMs   = msList.find(m => m.typ === 'baubeginn');
  const bbDat  = (bbMs ? msMsResolvedDatum(bbMs) : null) || einst.baubeginn || '';
  if (!bbDat) {
    _showBpEinstHint('Bitte zuerst im Tab «Zeitplanung» ein Baubeginn-Datum setzen.');
    switchBpEinstTab('zeitplanung'); return;
  }
  _apakBaubeginnDat = bbDat;
  if (!_apakGruppen.length) {
    _prepareApakGruppen();
    openAutoPaketeModal();
  }
  applyAutoPaketeModal();
}

function _runAutoZuweisung() {
  applyAutoZuwConfig();
}

function _showBpEinstHint(msg) {
  const h = document.getElementById('bpeist-hint');
  if (!h) return;
  h.textContent = msg;
  h.style.display = '';
}

function closeProjEinstModal() {
  document.getElementById('proj-einst-modal').style.display = 'none';
}

function renderEinstTeamsList(teams) {
  const wrap = document.getElementById('einst-teams-list');
  if (!wrap) return;
  const GERAET_OPT = ['bagger','bohrmaschine','kran','sonstige'];
  const GERAET_LBL = { 'bagger':'Bagger','bohrmaschine':'Bohrmaschine','kran':'Kran','sonstige':'Sonstige' };

  const addTile = '<div onclick="addTeamRow()" '
    + 'style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;'
    + 'padding:14px 10px;border-radius:8px;border:2px dashed #d1d5db;cursor:pointer;'
    + 'color:#9ca3af;font-size:12px;font-weight:600;transition:border-color .15s,color .15s;min-height:68px;"'
    + ' onmouseover="this.style.borderColor=\'#1a3a5c\';this.style.color=\'#1a3a5c\'"'
    + ' onmouseout="this.style.borderColor=\'#d1d5db\';this.style.color=\'#9ca3af\'">'
    + '<span style="font-size:22px;line-height:1;font-weight:300;">+</span>'
    + '<span>Los hinzufügen</span>'
    + '</div>';

  if (!teams.length) {
    wrap.innerHTML = addTile;
    return;
  }

  wrap.innerHTML = teams.map((t, i) => {
    const gerOptHtml = '<option value="">— Gerät —</option>'
      + GERAET_OPT.map(g => '<option value="' + g + '"' + (t.geraet === g ? ' selected' : '') + '>' + GERAET_LBL[g] + '</option>').join('');
    return '<div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center;box-shadow:0 1px 3px rgba(0,0,0,0.06);" id="team-row-' + i + '">'
      + '<input type="text" value="' + (t.name || '') + '" placeholder="Los 1" id="team-name-' + i + '" '
        + 'style="padding:6px 8px;border:1px solid #e5e7eb;border-radius:5px;font-size:12px;font-family:inherit;font-weight:600;">'
      + '<select id="team-geraet-' + i + '" style="padding:6px 8px;border:1px solid #e5e7eb;border-radius:5px;font-size:12px;font-family:inherit;background:white;">'
        + gerOptHtml
        + '</select>'
      + '<button onclick="removeTeamRow(' + i + ')" title="Los entfernen" '
        + 'style="padding:4px 8px;border-radius:5px;border:1px solid #fee2e2;background:#fff5f5;color:#dc2626;font-size:12px;cursor:pointer;white-space:nowrap;">✕</button>'
      + '</div>';
  }).join('')
  + addTile;
}

function _readTeamRows() {
  const wrap = document.getElementById('einst-teams-list');
  const rows = wrap ? wrap.querySelectorAll('[id^="team-row-"]') : [];
  const saved = loadProjEinst().teams || [];
  return Array.from(rows).map((_, i) => ({
    id:     saved[i]?.id || 'team_' + Date.now() + i,
    name:   document.getElementById('team-name-'+i)?.value || '',
    geraet: document.getElementById('team-geraet-'+i)?.value || '',
  }));
}

function addTeamRow() {
  const teams = _readTeamRows();
  teams.push({ id: 'team_' + Date.now(), name: '', geraet: '' });
  renderEinstTeamsList(teams);
}

function removeTeamRow(idx) {
  const teams = _readTeamRows().filter((_, i) => i !== idx);
  renderEinstTeamsList(teams);
}

function resetProjEinstModal() {
  document.getElementById('einst-abzug').value         = '0';
  document.getElementById('einst-feiertage').checked   = false;
  document.getElementById('einst-baugruppe-max').value = '3';
  document.getElementById('einst-aushaerte').value     = '28';
  document.getElementById('einst-bb-versatz').value    = '7';
  const flPufferReset = document.getElementById('einst-fl-puffer');
  if (flPufferReset) flPufferReset.value = '7';
  const abbName = document.getElementById('einst-abb-name');
  if (abbName) abbName.value = '';
  const abbGer  = document.getElementById('einst-abb-geraet');
  if (abbGer)  abbGer.value = '';
  const abbSp   = document.getElementById('einst-abb-sp');
  if (abbSp)   abbSp.value = '';
  renderEinstTeamsList([]);
}

function saveProjEinstModal() {
  const teams = _readTeamRows()
    .map((t, i) => ({ ...t, name: t.name.trim() || ('Los ' + (i+1)) }))
    .filter(t => t.name);
  const bbFld = document.getElementById('einst-baubeginn');
  // Auf den Bestand aufsetzen statt ihn zu ersetzen: das Formular deckt nicht
  // alle Einstellungen ab (z. B. provAushaerteTage), und ein neu gebautes
  // Objekt liesse alles Übrige stillschweigend fallen.
  const einst = Object.assign({}, loadProjEinst(), {
    baubeginn:               bbFld.disabled ? (loadProjEinst().baubeginn || '') : (bbFld.value || ''),
    abzugMinuten:            parseInt(document.getElementById('einst-abzug').value) || 0,
    berücksichtigeFeiertage: document.getElementById('einst-feiertage').checked,
    bauGruppeMax:            parseInt(document.getElementById('einst-baugruppe-max').value) || 3,
    standardSperrmusterId:   document.getElementById('einst-std-sperrmuster')?.value || '',
    teams,
    aushaerteTage:   parseInt(document.getElementById('einst-aushaerte')?.value) || 28,
    flMontagePuffer: parseInt(document.getElementById('einst-fl-puffer')?.value) || 7,
    bbVersatzTage:   parseInt(document.getElementById('einst-bb-versatz')?.value) || 7,
  });
  delete einst.abbruchLos;   // Altbestand ohne Bedienelement
  saveProjEinst(einst);
  // Baubeginn → Meilenstein synchronisieren
  if (einst.baubeginn) {
    const msList = loadMeilensteine();
    let bbMs = msList.find(m => m.typ === 'baubeginn');
    if (!bbMs) { bbMs = { id: 'ms_bb_auto', typ: 'baubeginn', name: 'Baubeginn' }; msList.push(bbMs); }
    if (bbMs.datum !== einst.baubeginn) { bbMs.datum = einst.baubeginn; saveMeilensteine(msList); }
  }
  if (loadBaupakete().length > 0) { _bpRecalcDirty = true; }
  closeProjEinstModal();
  renderBauprogrammTab();
}

// ── Baupaket Modal ────────────────────────────────────────────
let _bpEditId = null;

function openBaupaketModal(id) {
  _bpEditId = id;
  const pak   = id ? loadBaupakete().find(p => p.id === id) : null;
  const spList = loadSperrmuster();
  const einst  = loadProjEinst();
  const teams  = einst.teams || [];
  const allPak = loadBaupakete();

  document.getElementById('baupaket-modal-title').textContent = id ? 'Baupaket bearbeiten' : 'Baupaket erfassen';
  document.getElementById('bp-pak-delete-btn').style.display  = id ? '' : 'none';
  document.getElementById('bp-pak-name').value       = pak?.name        || '';
  document.getElementById('bp-pak-start').value      = pak?.startDatum  || (einst.baubeginn || '');
  document.getElementById('bp-pak-naechte').value    = pak?.anzahlNaechte || '';
  document.getElementById('bp-pak-abstand').value    = pak?.mindestAbstand ?? 0;
  const ahEl2 = document.getElementById('bp-pak-aushaerte');
  ahEl2.value       = pak?.aushaerteTage ?? '';
  ahEl2.placeholder = (einst.aushaerteTage ?? 28) + ' (Projekt)';
  document.getElementById('bp-pak-farbe').value      = pak?.farbe       || '#1a3a5c';
  document.getElementById('bp-pak-bemerkung').value  = pak?.bemerkung   || '';

  const teamSel = document.getElementById('bp-pak-team');
  teamSel.innerHTML = '<option value="">— kein Los / Team —</option>' +
    teams.map(t => '<option value="' + t.id + '"' + (pak?.teamId===t.id?' selected':'') + '>' + t.name + '</option>').join('');

  const vorgSel = document.getElementById('bp-pak-vorgaenger');
  const msList  = loadMeilensteine().filter(m => msMsResolvedDatum(m));
  vorgSel.innerHTML = '<option value="">— keiner —</option>'
    + (allPak.filter(p => p.id !== id).length ? '<optgroup label="Baupakete">'
        + allPak.filter(p => p.id !== id).map(p => '<option value="' + p.id + '"' + (pak?.vorgaengerId===p.id?' selected':'') + '>' + p.name + '</option>').join('')
        + '</optgroup>' : '')
    + (msList.length ? '<optgroup label="Meilensteine">'
        + msList.map(m => '<option value="' + m.id + '"' + (pak?.vorgaengerId===m.id?' selected':'') + '>◆ ' + (m.label||m.typ) + '</option>').join('')
        + '</optgroup>' : '');
  // Referenzpunkt-Radio setzen
  const refPunktVal = pak?.vorgaengerRefPunkt || 'ende';
  const refRadio = document.querySelector(`input[name="bp-pak-vorg-ref"][value="${refPunktVal}"]`);
  if (refRadio) refRadio.checked = true;
  setTimeout(bpVorgaengerChanged, 0);

  _bpVorarbeiten = pak?.vorarbeiten ? pak.vorarbeiten.map(v => ({...v})) : [];
  renderBpVorarbeitenList();
  bpUpdateKapHint();
  document.getElementById('baupaket-modal').style.display = 'flex';
}

function bpUpdateKapHint() {
  const hint    = document.getElementById('bp-pak-kapazitaet-hint');
  if (!hint) return;
  const startDatum = document.getElementById('bp-pak-start')?.value || '';
  const naechte    = parseInt(document.getElementById('bp-pak-naechte')?.value) || 0;
  // SP-Auflösung ohne Gleisfilter: zeigt verfügbare Kapazität aller Sperrmuster am Startdatum
  const sp = startDatum ? resolveSpForGleis(null, startDatum) : null;
  const einst   = loadProjEinst();
  if (!sp?.nettoH || !naechte) { hint.style.display = 'none'; return; }
  const lps    = loadLeistungsprofile();
  const kapArr = loadFtProfile().map(f => {
    const kap = getFtLeistung(f, sp.nettoH, einst.abzugMinuten || 0);
    if (kap == null || kap <= 0) return null;
    const lp    = f.leistungsprofilId ? lps.find(p => p.id === f.leistungsprofilId) : null;
    const lpTag = lp ? ` <span style="opacity:0.65;">(${lp.name})</span>` : '';
    const total = Math.round(kap * naechte * 10) / 10;
    return { label: f.name + lpTag, kap, total };
  }).filter(Boolean);
  if (!kapArr.length) { hint.style.display = 'none'; return; }
  hint.style.display = '';
  const isOpen = hint.dataset.open !== 'false';
  hint.innerHTML = `
    <div onclick="const h=this.closest('#bp-pak-kapazitaet-hint');h.dataset.open=h.dataset.open==='false'?'true':'false';h.querySelector('.bp-kap-rows').style.display=h.dataset.open==='false'?'none':'';h.querySelector('.bp-kap-chevron').style.transform=h.dataset.open==='false'?'rotate(-90deg)':'';"
      style="display:flex;align-items:center;justify-content:space-between;gap:6px;cursor:pointer;user-select:none;font-weight:700;">
      <span>Kapazität (${naechte} N., ${sp.nettoH}h/N., ${einst.abzugMinuten||0}min Abzug · ${sp.name})</span>
      <svg class="bp-kap-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;transition:transform 0.15s;transform:${isOpen?'':'rotate(-90deg)'}"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
    <div class="bp-kap-rows" style="margin-top:6px;display:${isOpen?'':'none'};">
      ${kapArr.map(k => `<div>· ${k.label}: <b>${k.kap}</b> Fund./Schicht → <b>${k.total}</b> Fund. total</div>`).join('')}
    </div>`;
}

// ── Vorarbeiten im Baupaket ───────────────────────────────────
let _bpVorarbeiten = [];

function renderBpVorarbeitenList() {
  const wrap = document.getElementById('bp-vorarbeiten-list');
  if (!wrap) return;
  if (!_bpVorarbeiten.length) {
    wrap.innerHTML = '<div style="font-size:11px;color:#9ca3af;padding:4px 0;">Keine Vorarbeiten definiert.</div>';
    return;
  }
  wrap.innerHTML = _bpVorarbeiten.map((v, i) => `
    <div style="display:grid;grid-template-columns:1fr 58px 58px 34px auto;gap:5px;align-items:center;margin-bottom:4px;">
      <input type="text" value="${v.name||''}" placeholder="Bezeichnung (z.B. Kabelumlegung)" id="bpva-name-${i}"
        style="padding:5px 7px;border:1px solid #e5e7eb;border-radius:5px;font-size:12px;font-family:inherit;min-width:0;">
      <input type="number" value="${v.offsetTage ?? -14}" id="bpva-offset-${i}" title="Vorlauf in Tagen vor Baupaket-Start (negativ eingeben, z.B. -14)"
        style="padding:5px 7px;border:1px solid #e5e7eb;border-radius:5px;font-size:12px;font-family:inherit;" min="-365" max="0" step="1">
      <input type="number" value="${v.dauer||7}" id="bpva-dauer-${i}" title="Dauer in Tagen" min="1" max="365" step="1"
        style="padding:5px 7px;border:1px solid #e5e7eb;border-radius:5px;font-size:12px;font-family:inherit;">
      <input type="color" value="${v.farbe||'#f59e0b'}" id="bpva-farbe-${i}"
        style="width:34px;height:28px;padding:2px;border:1px solid #e5e7eb;border-radius:5px;cursor:pointer;box-sizing:border-box;">
      <button onclick="removeBpVorarbeit(${i})" style="padding:3px 8px;border-radius:5px;border:1px solid #fee2e2;background:#fff5f5;color:#dc2626;font-size:12px;cursor:pointer;">✕</button>
    </div>
  `).join('') + `<div style="display:grid;grid-template-columns:1fr 58px 58px 34px auto;gap:5px;margin-top:2px;">
    <div style="font-size:9px;color:#9ca3af;">Bezeichnung</div>
    <div style="font-size:9px;color:#9ca3af;text-align:center;">Vorlauf (T)</div>
    <div style="font-size:9px;color:#9ca3af;text-align:center;">Dauer (T)</div>
    <div></div><div></div>
  </div>`;
}

function addBpVorarbeit() {
  _bpVorarbeiten.push({ id: 'va_' + Date.now(), name: '', offsetTage: -14, dauer: 7, farbe: '#f59e0b' });
  renderBpVorarbeitenList();
}

function removeBpVorarbeit(idx) {
  _bpVorarbeiten.splice(idx, 1);
  renderBpVorarbeitenList();
}

function _readBpVorarbeitenFromDom() {
  return _bpVorarbeiten.map((v, i) => ({
    id:         v.id,
    name:       document.getElementById('bpva-name-'+i)?.value?.trim() || '',
    offsetTage: parseInt(document.getElementById('bpva-offset-'+i)?.value) || -14,
    dauer:      parseInt(document.getElementById('bpva-dauer-'+i)?.value)  || 7,
    farbe:      document.getElementById('bpva-farbe-'+i)?.value            || '#f59e0b',
  })).filter(v => v.name);
}

function closeBaupaketModal() {
  document.getElementById('baupaket-modal').style.display = 'none';
  _bpEditId = null;
}

// ── Meilenstein Modal ─────────────────────────────────────────
let _msEditId = null;

function msMeilensteinAbhToggle() {
  const msTyp  = document.getElementById('ms-typ').value;
  const abhTyp = document.getElementById('ms-abh-typ').value;
  const isBaubeginn = msTyp === 'baubeginn';
  document.getElementById('ms-abh-typ').closest('div').style.display = isBaubeginn ? 'none' : '';
  const isGruppe  = abhTyp === 'nach-ausschal-gruppe' && !isBaubeginn;
  const isPaket   = abhTyp === 'nach-paket'           && !isBaubeginn;
  document.getElementById('ms-abh-gruppe-row').style.display = isGruppe ? '' : 'none';
  document.getElementById('ms-abh-paket-row').style.display  = isPaket  ? '' : 'none';
  document.getElementById('ms-abh-offset-row').style.display = (isGruppe || isPaket) ? '' : 'none';
  // Offset-Label je nach Typ anpassen
  const lbl = document.getElementById('ms-abh-offset-label');
  if (lbl) lbl.textContent = isGruppe ? 'Versatz (Tage nach Ausschaltermin)' : 'Versatz (Tage nach Paketende/-start)';
  const showDatum = isBaubeginn || abhTyp === 'manuell';
  document.getElementById('ms-datum').closest('div').style.display = showDatum ? '' : 'none';
}

function openMeilensteinModal(id) {
  _msEditId = id;
  const list = loadMeilensteine();
  const ms   = id ? list.find(m => m.id === id) : null;

  document.getElementById('meilenstein-modal-title').textContent = id ? 'Meilenstein bearbeiten' : 'Meilenstein erfassen';
  document.getElementById('ms-delete-btn').style.display = id ? '' : 'none';

  // Erster Meilenstein: Baubeginn / heutiges Datum / "Baustart" als Standard
  const isNew     = !id;
  const isFirst   = isNew && !loadMeilensteine().length;
  const todayIso  = new Date().toISOString().slice(0, 10);
  document.getElementById('ms-typ').value         = ms?.typ        || (isFirst ? 'baubeginn' : 'frei');
  document.getElementById('ms-label').value        = ms?.label      || (isFirst ? 'Baustart'  : '');
  document.getElementById('ms-datum').value        = ms?.datum      || (isFirst ? todayIso    : '');
  document.getElementById('ms-farbe').value        = ms?.farbe      || '#7c3aed';
  document.getElementById('ms-abh-typ').value      = ms?.abh?.typ   || 'manuell';
  document.getElementById('ms-abh-offset').value   = ms?.abh?.offsetTage ?? 14;

  // Gruppen-Select füllen
  const grpSel = document.getElementById('ms-abh-gruppe');
  const gruppen = loadBaugruppen();
  grpSel.innerHTML = '<option value="">— wählen —</option>'
    + gruppen.map(g => `<option value="${g.id}" ${ms?.abh?.referenzId===g.id?'selected':''}>${g.name||g.id}</option>`).join('');

  // Baupaket-Select füllen
  const pakSel = document.getElementById('ms-abh-paket');
  const bpList = loadBaupakete();
  pakSel.innerHTML = '<option value="">— wählen —</option>'
    + bpList.map(p => `<option value="${p.id}" ${ms?.abh?.referenzId===p.id?'selected':''}>${p.name}</option>`).join('');
  const refPunktVal = ms?.abh?.refPunkt || 'ende';
  const refPunktR   = document.querySelector(`input[name="ms-abh-ref-punkt"][value="${refPunktVal}"]`);
  if (refPunktR) refPunktR.checked = true;

  msMeilensteinAbhToggle();
  document.getElementById('meilenstein-modal').style.display = 'flex';
}

function closeMeilensteinModal() {
  document.getElementById('meilenstein-modal').style.display = 'none';
  _msEditId = null;
}

function msMsResolvedDatum(ms) {
  if (!ms?.abh || ms.abh.typ === 'manuell') return ms?.datum || null;
  const offset = parseInt(ms.abh.offsetTage) || 0;

  let refDate = null;
  if (ms.abh.typ === 'nach-ausschal-gruppe') {
    const grp = loadBaugruppen().find(g => g.id === ms.abh.referenzId);
    refDate = grp?.ausschaltermin || null;
  } else if (ms.abh.typ === 'nach-paket') {
    const pak = loadBaupakete().find(p => p.id === ms.abh.referenzId);
    if (pak) refDate = bpPaketRefDatum(pak, ms.abh.refPunkt);
  }
  if (!refDate) return ms?.datum || null;
  return bpFmtDate(bpAddDays(bpParseDate(refDate), offset));
}

function saveMeilensteinModal() {
  const label = document.getElementById('ms-label').value.trim();
  if (!label) { ui.toast('Bitte Bezeichnung eingeben.', 'fehler'); return; }
  const abhTyp = document.getElementById('ms-abh-typ').value;
  const datum  = abhTyp === 'manuell' ? document.getElementById('ms-datum').value : null;
  if (abhTyp === 'manuell' && !datum) { ui.toast('Bitte Datum eingeben.', 'fehler'); return; }
  if (abhTyp === 'nach-paket' && !document.getElementById('ms-abh-paket').value) { ui.toast('Bitte Baupaket wählen.', 'fehler'); return; }
  if (abhTyp === 'nach-ausschal-gruppe' && !document.getElementById('ms-abh-gruppe').value) { ui.toast('Bitte Baugruppe wählen.', 'fehler'); return; }

  const ms = {
    id:     _msEditId || ('ms_' + Date.now()),
    typ:    document.getElementById('ms-typ').value,
    label,
    datum,
    farbe:  document.getElementById('ms-farbe').value,
    abh: {
      typ:        abhTyp,
      referenzId: abhTyp === 'nach-paket'
        ? (document.getElementById('ms-abh-paket').value  || null)
        : (document.getElementById('ms-abh-gruppe').value || null),
      refPunkt:   document.querySelector('input[name="ms-abh-ref-punkt"]:checked')?.value || 'ende',
      offsetTage: parseInt(document.getElementById('ms-abh-offset').value) || 0,
    },
  };

  const list = loadMeilensteine();
  const idx  = list.findIndex(m => m.id === ms.id);
  const altDatum = idx >= 0 ? msMsResolvedDatum(list[idx]) : null;
  if (idx >= 0) list[idx] = ms; else list.push(ms);
  saveMeilensteine(list);

  // Abhängige Pakete nachziehen. Ohne das blieb ein verschobener Meilenstein
  // ohne Wirkung: das Abbruch-Los hängt am Meilenstein «FL-Montage», behielt
  // aber sein altes Startdatum, bis jemand ein Paket anfasste.
  const neuDatum = msMsResolvedDatum(ms);
  bpMsNachfolgerNachziehen(ms.id, altDatum, neuDatum);

  closeMeilensteinModal();
  if (document.getElementById('bauprogramm-tab-wrap')?.style.display !== 'none') renderBauprogrammTab();
  if (currentOverviewView === 'termine') renderTermineView();
}

async function deleteMeilenstein() {
  if (!_msEditId) return;
  if (!await ui.confirm('Meilenstein löschen?')) return;
  saveMeilensteine(loadMeilensteine().filter(m => m.id !== _msEditId));
  closeMeilensteinModal();
  if (document.getElementById('bauprogramm-tab-wrap')?.style.display !== 'none') renderBauprogrammTab();
  if (currentOverviewView === 'termine') renderTermineView();
}

// ── Baupaket-Gantt Kontextmenü (oberer Gantt) ─────────────────
let _bpPakCtxId = null;

function showBpPakCtxMenu(pakId, clientX, clientY) {
  _bpPakCtxId = pakId;
  const pak  = loadBaupakete().find(p => p.id === pakId);
  const menu = document.getElementById('bp-pak-ctx-menu');
  if (!menu || !pak) return;
  document.getElementById('bp-pak-ctx-header').textContent = pak.name
    + (pak.startDatum ? '  ·  ' + bpFmtDisplay(pak.startDatum) : '');
  menu.style.display = 'block';
  const mw = 200, mh = 180;
  menu.style.left = Math.min(clientX, window.innerWidth  - mw - 8) + 'px';
  menu.style.top  = Math.min(clientY, window.innerHeight - mh - 8) + 'px';
  setTimeout(() => document.addEventListener('click', hideBpPakCtxMenu, { once: true }), 0);
}

function hideBpPakCtxMenu() {
  const m = document.getElementById('bp-pak-ctx-menu');
  if (m) m.style.display = 'none';
  _bpPakCtxId = null;
}

function bpPakCtxEdit() {
  if (!_bpPakCtxId) return;
  hideBpPakCtxMenu();
  openBaupaketModal(_bpPakCtxId);
}

function bpPakCtxShift(days) {
  if (!_bpPakCtxId) return;
  const allPak = loadBaupakete();
  const pak    = allPak.find(p => p.id === _bpPakCtxId);
  if (pak?.startDatum) {
    pak.startDatum = bpFmtDate(bpAddDays(bpParseDate(pak.startDatum), days));
    saveBaupakete(allPak);
    renderBauprogrammTab();
  }
  hideBpPakCtxMenu();
}

function bpPakCtxKarte() {
  if (!_bpPakCtxId) return;
  hideBpPakCtxMenu();
  bpKarteClick(_bpPakCtxId);
}

async function bpPakCtxDelete() {
  if (!_bpPakCtxId) return;
  const pak = loadBaupakete().find(p => p.id === _bpPakCtxId);
  if (!pak) return;
  if (!await ui.confirm('Baupaket «' + pak.name + '» wirklich löschen?\nAlle Schichtzuweisungen zu diesem Paket werden entfernt.')) return;
  saveBaupakete(loadBaupakete().filter(p => p.id !== _bpPakCtxId));
  const allZuw = loadSchichtZuw();
  Object.keys(allZuw).forEach(pid => { if (allZuw[pid]?.paketId === _bpPakCtxId) delete allZuw[pid]; });
  saveSchichtZuw(allZuw);
  hideBpPakCtxMenu();
  renderBauprogrammTab();
}

// ── Fundament-Gantt Kontextmenü ──────────────────────────────
let _fpCtxPairId = null;

// Auf welche Fundamente wirken die Menuebefehle?
// Rechtsklick auf einen Balken, der Teil einer Mehrfachauswahl ist → auf alle.
// Sonst nur auf den angeklickten; eine bestehende Auswahl bleibt unberuehrt.
function _fpCtxZiele() {
  if (_fpCtxPairId == null) return [];
  const id = String(_fpCtxPairId);
  return (_bpFundSelection.size > 1 && _bpFundSelection.has(id)) ? [..._bpFundSelection] : [id];
}

function showFpCtxMenu(pairId, clientX, clientY) {
  _fpCtxPairId = pairId;
  const pair   = PAIRS.find(p => p.id == pairId);
  const zuw    = loadSchichtZuw();
  const z      = zuw[pairId] || {};
  const pakete = loadBaupakete();
  const ziele  = _fpCtxZiele();

  // Header — bei Mehrfachauswahl die Anzahl statt eines einzelnen Masts
  const header = document.getElementById('fp-ctx-header');
  if (header) header.textContent = ziele.length > 1
    ? ziele.length + ' Fundamente ausgewählt'
    : 'Mast ' + (pair?.mast || '—') + (z.paketId ? ' · ' + (pakete.find(p=>p.id===z.paketId)?.name||'') : '');

  // Baupaket-Select befüllen
  const pakSel = document.getElementById('fp-ctx-pak-sel');
  pakSel.innerHTML = '<option value="">— Paket —</option>' +
    pakete.map(p => `<option value="${p.id}" ${z.paketId===p.id?'selected':''}>${p.name}</option>`).join('');
  fpCtxPakChange(z.schichtNr);

  // Vor/Zurück-Buttons aktivieren/deaktivieren.
  // Bei Mehrfachauswahl genuegt es, wenn EIN Fundament noch Luft hat — die
  // uebrigen bleiben an der Paketgrenze stehen (siehe fpCtxShift).
  const kannVor = ziele.some(pid => {
    const zz = zuw[pid] || {}; const pk = pakete.find(p => p.id === zz.paketId);
    const cur = zz.bohrSchichten?.length ? zz.bohrSchichten[0].schichtNr : (zz.schichtNr || 0);
    return pk && cur < pk.anzahlNaechte;
  });
  const kannZurueck = ziele.some(pid => {
    const zz = zuw[pid] || {};
    const cur = zz.bohrSchichten?.length ? zz.bohrSchichten[0].schichtNr : (zz.schichtNr || 0);
    return cur > 1;
  });
  document.getElementById('fp-ctx-btn-prev').style.opacity = kannZurueck ? '1' : '0.35';
  document.getElementById('fp-ctx-btn-next').style.opacity = kannVor     ? '1' : '0.35';

  // Destruktiver Befehl benennt die Menge ausdruecklich
  const clearBtn = document.getElementById('fp-ctx-btn-clear');
  if (clearBtn) clearBtn.textContent = ziele.length > 1
    ? '✕ ' + ziele.length + ' Zuweisungen aufheben'
    : '✕ Zuweisung aufheben';

  // Position
  const menu = document.getElementById('fp-ctx-menu');
  menu.style.display = 'block';
  const mw = 240, mh = 220;
  menu.style.left = Math.min(clientX, window.innerWidth  - mw - 8) + 'px';
  menu.style.top  = Math.min(clientY, window.innerHeight - mh - 8) + 'px';

  // Schliessen bei Klick ausserhalb des Menus
  setTimeout(() => {
    function _fpCtxOutside(e) {
      if (!document.getElementById('fp-ctx-menu').contains(e.target)) {
        hideFpCtxMenu();
        document.removeEventListener('click', _fpCtxOutside, true);
      }
    }
    document.addEventListener('click', _fpCtxOutside, true);
  }, 0);
}

function hideFpCtxMenu() {
  document.getElementById('fp-ctx-menu').style.display = 'none';
  _fpCtxPairId = null;
}

function fpCtxPakChange(preselSchicht) {
  const pakId  = document.getElementById('fp-ctx-pak-sel').value;
  const pak    = loadBaupakete().find(p => p.id === pakId);
  const schSel = document.getElementById('fp-ctx-sch-sel');
  if (!pak) { schSel.innerHTML = '<option value="">— Schicht —</option>'; return; }
  schSel.innerHTML = bpGetSchichten(pak)
    .map(s => `<option value="${s.schichtNr}" ${s.schichtNr===(preselSchicht||0)?'selected':''}>${s.schichtNr}. Schicht (${bpFmtDisplay(s.datum)})</option>`)
    .join('');
}

function fpCtxSchApply() {
  const ziele = _fpCtxZiele();
  if (!ziele.length) return;
  const pakId  = document.getElementById('fp-ctx-pak-sel').value;
  const schNr  = parseInt(document.getElementById('fp-ctx-sch-sel').value);
  if (!pakId || !schNr) return;
  const zuw = loadSchichtZuw();
  ziele.forEach(pid => {
    if (!zuw[pid]) zuw[pid] = {};
    zuw[pid].paketId   = pakId;
    zuw[pid].schichtNr = schNr;
    delete zuw[pid].bohrSchichten;
  });
  saveSchichtZuw(zuw);
  hideFpCtxMenu();
  _recalcBaugruppenDates();
  renderBpFundamenteGantt();
  updateBpInfoBar();
  if (ziele.length > 1) ui.toast(ziele.length + ' Fundamente zugewiesen', 'erfolg', null,
                                 { text: 'Rückgängig', aufRuf: bpUndo });
}

function fpCtxShift(delta) {
  const ziele = _fpCtxZiele();
  if (!ziele.length) return;
  const zuw    = loadSchichtZuw();
  const pakete = loadBaupakete();
  let bewegt = 0, blockiert = 0;

  ziele.forEach(pid => {
    const z   = zuw[pid] || {};
    const pak = pakete.find(p => p.id === z.paketId);
    if (!pak) return;
    if (z.bohrSchichten?.length) {
      // Pfahlfundament: alle Bohrschichten verschieben
      zuw[pid].bohrSchichten = z.bohrSchichten.map(bs => {
        const newNr = (bs.schichtNr || 1) + delta;
        return newNr >= 1 && newNr <= pak.anzahlNaechte ? { ...bs, schichtNr: newNr } : bs;
      });
      bewegt++;
    } else {
      const newNr = (z.schichtNr || 1) + delta;
      // Am Paketrand bleibt dieses Fundament stehen — die uebrigen wandern trotzdem
      if (newNr < 1 || newNr > pak.anzahlNaechte) { blockiert++; return; }
      zuw[pid].schichtNr = newNr;
      bewegt++;
    }
  });

  if (!bewegt) { hideFpCtxMenu(); if (blockiert) ui.toast('Paketgrenze erreicht', 'fehler'); return; }
  saveSchichtZuw(zuw);
  hideFpCtxMenu();
  _recalcBaugruppenDates();
  renderBpFundamenteGantt();
  updateBpInfoBar();
  if (ziele.length > 1) {
    ui.toast(bewegt + ' Fundamente um ' + (delta > 0 ? '+' : '') + delta + ' Schicht verschoben'
             + (blockiert ? ' · ' + blockiert + ' an Paketgrenze' : ''),
             'erfolg', null, { text: 'Rückgängig', aufRuf: bpUndo });
  }
}

function fpCtxShiftAll(delta) {
  if (!_fpCtxPairId) return;
  const zuw    = loadSchichtZuw();
  const pakete = loadBaupakete();
  const sorted = getFilteredSorted().sort((a,b) => parseFloat(a.km_rs||0) - parseFloat(b.km_rs||0));
  const idx    = sorted.findIndex(p => p.id == _fpCtxPairId);
  if (idx < 0) return;

  sorted.slice(idx).forEach(p => {
    const z   = zuw[p.id];
    if (!z) return;
    const pak = pakete.find(pk => pk.id === z.paketId);
    if (!pak) return;
    if (z.bohrSchichten?.length) {
      z.bohrSchichten = z.bohrSchichten.map(bs => {
        const newNr = (bs.schichtNr||1) + delta;
        return (newNr >= 1 && newNr <= pak.anzahlNaechte) ? { ...bs, schichtNr: newNr } : bs;
      });
    } else if (z.schichtNr) {
      const newNr = z.schichtNr + delta;
      if (newNr >= 1 && newNr <= pak.anzahlNaechte) z.schichtNr = newNr;
    }
  });
  saveSchichtZuw(zuw);
  hideFpCtxMenu();
  renderBpFundamenteGantt();
  updateBpInfoBar();
}

function fpCtxClear() {
  const ziele = _fpCtxZiele();
  if (!ziele.length) return;
  const zuw = loadSchichtZuw();
  ziele.forEach(pid => delete zuw[pid]);
  saveSchichtZuw(zuw);
  hideFpCtxMenu();
  _recalcBaugruppenDates();
  renderBpFundamenteGantt();
  updateBpInfoBar();
  ui.toast(ziele.length === 1 ? 'Zuweisung aufgehoben' : ziele.length + ' Zuweisungen aufgehoben',
           'erfolg', null, { text: 'Rückgängig', aufRuf: bpUndo });
}

let _bpKaskadePending = null; // {allPak, conflicts} zum Bestätigen/Ablehnen

function saveBaupaketModal() {
  const name = document.getElementById('bp-pak-name').value.trim();
  if (!name) { ui.toast('Bitte Bezeichnung eingeben.', 'fehler'); return; }
  const allPak = loadBaupakete();
  const pak = {
    id:            _bpEditId || ('pak_' + Date.now()),
    name,
    teamId:        document.getElementById('bp-pak-team').value          || null,
    startDatum:    document.getElementById('bp-pak-start').value         || null,
    anzahlNaechte:    parseInt(document.getElementById('bp-pak-naechte').value)  || 1,
    vorgaengerId:       document.getElementById('bp-pak-vorgaenger').value || null,
    mindestAbstand:     parseInt(document.getElementById('bp-pak-abstand').value)  || 0,
    vorgaengerRefPunkt: document.querySelector('input[name="bp-pak-vorg-ref"]:checked')?.value || 'ende',
    farbe:            document.getElementById('bp-pak-farbe').value    || '#1a3a5c',
    bemerkung:        document.getElementById('bp-pak-bemerkung').value.trim(),
    vorarbeiten:      _readBpVorarbeitenFromDom(),
    // Leeres Feld = Projektvorgabe. 0 ist ein gültiger Wert (Abbruch härtet
    // nicht aus), darum kein `|| null`.
    aushaerteTage:    (() => {
      const v = document.getElementById('bp-pak-aushaerte').value.trim();
      if (v === '') return null;
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n >= 0 ? n : null;
    })(),
  };
  // Ringschluss verhindern: ein Paket darf weder sich selbst noch einen seiner
  // Nachfolger als Vorgänger haben. Ohne diese Prüfung lief die Kaskade in einen
  // Stapelüberlauf und die Bauprogramm-Ansicht blieb leer.
  if (pak.vorgaengerId && bpWuerdeZyklusErzeugen(pak.id, pak.vorgaengerId, allPak)) {
    const v = allPak.find(p => p.id === pak.vorgaengerId);
    ui.toast('«' + (v?.name || 'Dieses Paket') + '» hängt bereits von «' + pak.name
           + '» ab — das ergäbe einen Ringschluss. Bitte anderen Vorgänger wählen.', 'fehler', 6000);
    return;
  }
  const idx = allPak.findIndex(p => p.id === pak.id);
  if (idx >= 0) allPak[idx] = pak; else allPak.push(pak);

  // Kaskaden-Konflikt prüfen
  const conflicts = bpKaskadePreview(pak.id, allPak);
  if (conflicts.length) {
    _bpKaskadePending = { allPak, pakId: pak.id };
    const list = document.getElementById('kaskade-list');
    if (list) {
      list.innerHTML = conflicts.map(c => `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:7px;padding:8px 12px;font-size:12px;">
          <span style="font-weight:700;color:#374151;">${c.pak.name}</span>
          <span style="color:#9ca3af;"> · bisher </span>
          <span style="color:#dc2626;">${bpFmtDisplay(c.altStart)}</span>
          <span style="color:#9ca3af;"> → neu </span>
          <span style="color:#16a34a;font-weight:600;">${bpFmtDisplay(c.neuStart)}</span>
        </div>`).join('');
    }
    saveBaupakete(allPak); // Paket selbst speichern, Nachfolger noch nicht
    closeBaupaketModal();
    document.getElementById('kaskade-modal').style.display = 'flex';
    return;
  }

  saveBaupakete(allPak);
  closeBaupaketModal();
  renderBauprogrammTab();
}

function applyBpKaskade() {
  if (!_bpKaskadePending) return;
  const allPak = loadBaupakete();
  _bpKaskadeApply(_bpKaskadePending.pakId, allPak);
  saveBaupakete(allPak);
  _bpKaskadePending = null;
  document.getElementById('kaskade-modal').style.display = 'none';
  renderBauprogrammTab();
}

function rejectBpKaskade() {
  _bpKaskadePending = null;
  document.getElementById('kaskade-modal').style.display = 'none';
  renderBauprogrammTab();
}

async function deleteBaupaket() {
  if (!_bpEditId || !await ui.confirm('Baupaket wirklich löschen? Alle Schichtzuweisungen dieses Pakets werden entfernt.')) return;
  const allPak = loadBaupakete().filter(p => p.id !== _bpEditId);
  saveBaupakete(allPak);
  const zuw = loadSchichtZuw();
  Object.keys(zuw).forEach(k => { if (zuw[k]?.paketId === _bpEditId) delete zuw[k]; });
  saveSchichtZuw(zuw);
  closeBaupaketModal();
  renderBauprogrammTab();
}

// ── Export Bauprogramm ────────────────────────────────────────
function exportBauprogrammJson() {
  const pn  = getActiveProjectName() || 'Projekt';
  const data = {
    projekt:    pn,
    exportiert: new Date().toISOString(),
    pakete:     loadBaupakete(),
    meilensteine: loadMeilensteine(),
    schichtZuw:   loadSchichtZuw(),
    einstellungen:loadProjEinst(),
    baugruppen:   loadBaugruppen(),
    sperrmuster:  loadSperrmuster(),
    ftProfile:    loadFtProfile(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = pn.replace(/[^a-zA-Z0-9_]/g,'_') + '_Bauprogramm.json';
  a.click();
}

function exportBauprogrammXlsx() {
  if (!window.XLSX) { ui.toast('SheetJS nicht geladen.', 'fehler'); return; }
  const pakete = loadBaupakete();
  const zuw    = loadSchichtZuw();
  const pairs  = getFilteredSorted();
  const ftZuw  = loadFtZuweisungen();
  const ftList = loadFtProfile();
  const spList = loadSperrmuster();
  const einst  = loadProjEinst();

  const rows = [['Mast','KM','Gleis','Fundamenttyp','Baupaket','Schicht Nr.','Schichtdatum','Sperrmuster','Eff. Schichtzeit (min)']];
  pairs.forEach(p => {
    const z   = zuw[p.id] || {};
    const pak = pakete.find(pk => pk.id === z.paketId);
    const ft  = ftList.find(t => t.id === ftZuw[p.id]);
    const schichten = pak ? bpGetSchichten(pak) : [];
    const sch = schichten.find(s => s.schichtNr === z.schichtNr);
    // SP pro Fundament: p.gleis hat Vorrang vor dem im Paket hinterlegten SP
    const sp  = sch?.datum
      ? (resolveSpForGleis(p.gleis, sch.datum) || (sch.spId ? spList.find(s => s.id === sch.spId) : null))
      : (pak ? resolveSpForPak(pak, pak.startDatum) : null);
    const effMin = sp?.nettoH ? sp.nettoH * 60 - (einst.abzugMinuten || 0) : '';
    rows.push([
      'Mast ' + (p.mast || p.id),
      p.km_rs ? parseFloat(p.km_rs).toFixed(3) : '',
      p.gleis || '',
      ft?.name || '',
      pak?.name || '',
      z.schichtNr || '',
      sch ? bpFmtDisplay(sch.datum) : '',
      sp?.name || '',
      effMin,
    ]);
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Bauprogramm');
  XLSX.writeFile(wb, 'Bauprogramm_' + (getActiveProjectName()||'Projekt') + '.xlsx');
}

function exportSchichtZuwXlsx() { exportBauprogrammXlsx(); }

function exportBauprogrammPdf() {
  const jsPDFLib = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFLib) { ui.toast('jsPDF nicht geladen.', 'fehler'); return; }
  const doc    = new jsPDFLib({ orientation:'landscape', unit:'mm', format:'a4' });
  const pakete = loadBaupakete();
  const zuw    = loadSchichtZuw();
  const pairs  = getFilteredSorted();
  const ftZuw  = loadFtZuweisungen();
  const ftList = loadFtProfile();
  const spList = loadSperrmuster();
  const pn     = getActiveProjectName() || 'Projekt';

  doc.setFillColor(26,58,92); doc.rect(0,0,297,3,'F');
  doc.setFontSize(12); doc.setFont(undefined,'bold'); doc.setTextColor(26,58,92);
  doc.text('Bauprogramm · ' + pn, 14, 11);
  doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.setTextColor(107,114,128);
  doc.text(new Date().toLocaleDateString('de-CH') + ' · ' + pairs.length + ' Standorte · ' + pakete.length + ' Baupakete', 14, 17);
  doc.setDrawColor(229,231,235); doc.line(14,20,283,20);

  let y = 28;
  pakete.forEach(pak => {
    if (y > 185) { doc.addPage(); y = 14; }
    const sp  = resolveSpForPak(pak, pak.startDatum);
    const col = pak.farbe || '#1a3a5c';
    doc.setFillColor(...hexToRgb(col)); doc.rect(14, y-3, 3, 6, 'F');
    doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(26,58,92);
    doc.text(pak.name, 20, y);
    doc.setFont(undefined,'normal'); doc.setTextColor(107,114,128); doc.setFontSize(7.5);
    const info = [sp?.name, pak.startDatum ? bpFmtDisplay(pak.startDatum) : '', pak.anzahlNaechte + ' Nächte'].filter(Boolean).join(' · ');
    doc.text(info, 20, y+5); y += 12;

    const pakPairs = pairs.filter(p => zuw[p.id]?.paketId === pak.id)
      .sort((a,b) => (zuw[a.id]?.schichtNr||0) - (zuw[b.id]?.schichtNr||0));
    if (pakPairs.length) {
      doc.setFontSize(7); doc.setTextColor(55,65,81);
      pakPairs.forEach(p => {
        if (y > 190) { doc.addPage(); y = 14; }
        const z = zuw[p.id];
        const ft = ftList.find(t => t.id === ftZuw[p.id]);
        doc.text('  Schicht ' + (z?.schichtNr||'?') + ' · Mast ' + (p.mast||'—') + ' · KM ' + (p.km_rs?parseFloat(p.km_rs).toFixed(3):'—') + ' · ' + (ft?.name||'—'), 20, y); y += 5;
      });
      y += 4;
    }
  });

  doc.save('Bauprogramm_' + pn.replace(/[^a-zA-Z0-9_]/g,'_') + '.pdf');
}

// ── ICS Kalender-Export ───────────────────────────────────────
function exportBauprogrammIcs() {
  const pakete = loadBaupakete();
  if (!pakete.length) { ui.toast('Keine Baupakete vorhanden.', 'fehler'); return; }

  const zuw    = loadSchichtZuw();
  const pairs  = getFilteredSorted();
  const ftZuw  = loadFtZuweisungen();
  const ftList = loadFtProfile();
  const spList = loadSperrmuster();
  const pn     = getActiveProjectName() || 'Projekt';

  const fmtIcsDt = (dateStr, h = 22, offsetH = 0) => {
    // Schicht-Nächte: Beginn 22:00 des angegebenen Datums (Ortszeit → UTC+1 im Winter / +2 im Sommer)
    // Für ICS: Datum als YYYYMMDDTHHMMSS (lokal, ohne Z)
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const hh = String((h + offsetH) % 24).padStart(2, '0');
    const dd = h + offsetH >= 24 ? d + 1 : d;
    return `${y}${String(m).padStart(2,'0')}${String(dd).padStart(2,'0')}T${hh}0000`;
  };

  const icsUid = (pakId, schNr) => `bp-${pakId}-s${schNr}-${_activeId}@sondagen-app`;
  const now = new Date().toISOString().replace(/[-:.]/g,'').slice(0,15) + 'Z';

  let lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fundamentbau//Bauprogramm//DE',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:Bauprogramm ${pn}`, 'X-WR-TIMEZONE:Europe/Zurich'];

  pakete.forEach(pak => {
    const schichten = bpGetSchichten(pak);
    const einst     = loadProjEinst();
    const abzugH    = (einst.abzugMinuten || 0) / 60;

    const pakPairs = pairs.filter(p => zuw[p.id]?.paketId === pak.id);

    schichten.forEach(sch => {
      const sp      = sch.spId ? loadSperrmuster().find(s => s.id === sch.spId) : resolveSpForPak(pak, sch.datum);
      const nettoH  = sch.nettoH || sp?.nettoH || 4;
      const schPairs = pakPairs.filter(p => zuw[p.id]?.schichtNr === sch.schichtNr);
      const ftNames  = [...new Set(schPairs.map(p => ftList.find(t => t.id === ftZuw[p.id])?.name).filter(Boolean))];
      const mastList = schPairs.map(p => 'Mast ' + (p.mast || p.id)).join(', ');

      const desc = [
        `Baupaket: ${pak.name}`,
        `Schicht: ${sch.schichtNr} / ${pak.anzahlNaechte}`,
        sp ? `Sperrmuster: ${sp.name} (${nettoH}h netto)` : '',
        `Eff. Arbeitszeit: ${(nettoH - abzugH).toFixed(1)}h`,
        schPairs.length ? `Fundamente (${schPairs.length}): ${mastList}` : 'Noch keine Fundamente zugewiesen',
        ftNames.length ? `Fundamenttypen: ${ftNames.join(', ')}` : '',
      ].filter(Boolean).join('\\n');

      const summary = `${pak.name} – Schicht ${sch.schichtNr}${sp ? ' ('+sp.name+')' : ''}`;
      const dtStart = fmtIcsDt(sch.datum, 22, 0);
      const dtEnd   = fmtIcsDt(sch.datum, 22 + Math.ceil(nettoH), 0);

      lines.push('BEGIN:VEVENT',
        `UID:${icsUid(pak.id, sch.schichtNr)}`,
        `DTSTAMP:${now}`,
        `DTSTART;TZID=Europe/Zurich:${dtStart}`,
        `DTEND;TZID=Europe/Zurich:${dtEnd}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${desc}`,
        pak.farbe ? `COLOR:${pak.farbe}` : '',
        'END:VEVENT'
      );
    });
  });

  // Meilensteine als ganztägige VEVENT-Einträge
  const TYP_LABEL_ICS = { baubeginn:'Baubeginn', 'fl-montage':'FL-Montage', 'vfk-vorabnahme':'VFK Vorabnahme', materialbestellung:'Materialbestellung', abnahme:'Abnahme', frei:'Meilenstein' };
  loadMeilensteine().forEach(ms => {
    const d = msMsResolvedDatum(ms);
    if (!d) return;
    const [y, m, day] = d.split('-');
    const nextDay = bpFmtDate(bpAddDays(bpParseDate(d), 1)).replace(/-/g, '');
    const dtDate  = `${y}${m}${day}`;
    const abhDesc = ms.abh?.typ === 'nach-ausschal-gruppe' ? ' (Auto: nach Ausschal Gruppe)' : '';
    lines.push('BEGIN:VEVENT',
      `UID:ms-${ms.id}-${_activeId}@sondagen-app`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dtDate}`,
      `DTEND;VALUE=DATE:${nextDay}`,
      `SUMMARY:⬥ ${ms.label || TYP_LABEL_ICS[ms.typ] || 'Meilenstein'}${abhDesc}`,
      `DESCRIPTION:Typ: ${TYP_LABEL_ICS[ms.typ] || ms.typ}\\nProjekt: ${pn}`,
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  const ics = lines.filter(Boolean).join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `Bauprogramm_${pn.replace(/[^a-zA-Z0-9_]/g,'_')}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16)||26;
  const g = parseInt(hex.slice(3,5),16)||58;
  const b = parseInt(hex.slice(5,7),16)||92;
  return [r,g,b];
}

// ── Ausführungsplanung: Sperrmuster + Schichtleistung speichern ──
// (Erweiterung der saveAusfPlanung / loadAusfPlanung)
// ── Wird durch _patchAusfPlanungFunctions() beim App-Start einmalig eingehängt

// ============================================================
