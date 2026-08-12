// EXCEL EXPORT
// ============================================================
function getExportRows() {
  return PAIRS.map(p => {
    const pd = getPairData(p.id);
    const fd = pd.felddaten || {};
    const s  = pd.sicherheit || {};
    return [
      p.id, p.bezeichnung||'', p.km_rs||'', p.mast||'', p.tag||'',
      p.tiefe||'', p.gleis||'', statusLabel(pd.status),
      fd.rs_tiefe_ist||'', fd.rs_abbruch||'',
      fd.rks_tiefe_ist||'', fd.rks_abbruch||'',
      pd.comment||'', (s.psa||[]).join(', '), s.hinweise||''
    ];
  });
}

function exportPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(13);
  doc.setTextColor(26, 58, 92);
  doc.text('Fundamentbau – ' + (getActiveProjectName() || 'Export'), 14, 14);
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Erstellt: ${new Date().toLocaleDateString('de-CH')}`, 14, 20);
  doc.autoTable({
    startY: 25,
    head: [['Nr','Bezeichnung','KM RS','Mast','Tag','Tiefe','Gleis','Status','RS Ist','RS Abbruch','RKS Ist','RKS Abbruch','Kommentar','PSA','Hinweise']],
    body: getExportRows(),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [26, 58, 92], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    margin: { left: 14, right: 14 },
  });
  doc.save('Fundamentbau_' + (getActiveProjectName() || 'Export').replace(/[^a-zA-Z0-9_]/g,'_') + '.pdf');
}

function exportOneNote() {
  const rows = getExportRows();
  const headers = ['Nr','Bezeichnung','KM RS','Mast','Tag','Tiefe','Gleis','Status','RS Ist','RS Abbruch','RKS Ist','RKS Abbruch','Kommentar','PSA','Hinweise'];
  const trHead = `<tr>${headers.map(h=>`<th style="background:#1a3a5c;color:white;padding:6px 10px;font-size:12px;">${h}</th>`).join('')}</tr>`;
  const trRows = rows.map((r,i)=>`<tr style="background:${i%2===0?'#f5f8fc':'white'}">${r.map(c=>`<td style="padding:5px 10px;font-size:11px;border-bottom:1px solid #e5e7eb;">${c}</td>`).join('')}</tr>`).join('');
  const _pname = getActiveProjectName() || 'Export';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fundamentbau ${_pname}</title></head><body style="font-family:Arial,sans-serif;padding:24px;">
<h2 style="color:#1a3a5c;">Fundamentbau – ${_pname}</h2>
<p style="color:#6b7280;font-size:12px;">Erstellt: ${new Date().toLocaleDateString('de-CH')}</p>
<table style="border-collapse:collapse;width:100%;">${trHead}${trRows}</table>
<p style="font-size:10px;color:#9ca3af;margin-top:16px;">Erstellt mit Fundamentbau-App · 2026</p>
</body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Fundamentbau_' + _pname.replace(/[^a-zA-Z0-9_]/g,'_') + '.html';
  a.click();
}

function exportExcel() {
  const rows = PAIRS.map(p => {
    const pd = getPairData(p.id);
    const fd = pd.felddaten || {};
    const s  = pd.sicherheit || {};
    return {
      'Nr':                  p.id,
      'Bezeichnung':         p.bezeichnung || '',
      'KM RS':               p.km_rs,
      'KM RKS':              p.km_rks,
      'Mast':                p.mast,
      'Tiefe Soll (m)':      p.tiefe,
      'Gleis':               p.gleis,
      'Tagarbeit':           p.tag,
      'E LV95 RS':           p.rs?.e ?? '',
      'N LV95 RS':           p.rs?.n ?? '',
      'E LV95 RKS':          p.rks?.e ?? '',
      'N LV95 RKS':          p.rks?.n ?? '',
      'Zugang':              p.zugang,
      'Status':              statusLabel(pd.status),
      'RS Tiefe Ist (m)':    fd.rs_tiefe_ist  || '',
      'RS Abbruchgrund':     fd.rs_abbruch    || '',
      'RS Grundwasser':      fd.rs_gw==='ja' ? `Ja bei ${fd.rs_gw_tiefe||'?'} m` : 'Nein',
      'RS Bemerkung':        fd.rs_bemerkung  || '',
      'RKS Tiefe Ist (m)':   fd.rks_tiefe_ist || '',
      'RKS Abbruchgrund':    fd.rks_abbruch   || '',
      'RKS Kerngewinn':      fd.rks_kerngewinn|| '',
      'RKS Grundwasser':     fd.rks_gw==='ja' ? `Ja bei ${fd.rks_gw_tiefe||'?'} m` : 'Nein',
      'RKS Schichtfolge':    fd.rks_schicht   || '',
      'Kommentar':           pd.comment       || '',
      'SiWä':                (s.siwa          || 'k.A.'),
      'Gleissperrung':       (s.sperrung      || 'k.A.'),
      'Sperrfenster':        s.sperrfenster   || '',
      'Fahrstrom abschalten':(s.strom         || 'k.A.'),
      'Mindestabstand Gleis':s.mindestabstand || '',
      'PSA':                 (s.psa||[]).join(', '),
      'Sicherheitshinweise': s.hinweise       || '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  // Column widths
  ws['!cols'] = [
    {wch:4},{wch:9},{wch:9},{wch:8},{wch:10},{wch:6},{wch:9},
    {wch:11},{wch:11},{wch:11},{wch:11},{wch:50},{wch:15},
    {wch:14},{wch:20},{wch:20},{wch:20},{wch:14},{wch:20},{wch:16},{wch:20},{wch:30},{wch:40}
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fundamentbau');

  // Sheet INSTALLATIONEN anhängen wenn vorhanden
  const instList = getInstallationen();
  if (instList.length) {
    const instRows = instList.map(p => ({
      'Nr':            p.id,
      'Bezeichnung':   p.bezeichnung || '',
      'Typ':           INST_TYP_LABELS[p.installTyp] || p.installTyp || '',
      'Länge (m)':     p.flaecheL ?? '',
      'Breite (m)':    p.flaecheB ?? '',
      'Fläche (m²)':   p.flaeche ?? '',
      'Von':           p.von || '',
      'Bis':           p.bis || '',
      'E LV95':        p.rs?.e ?? '',
      'N LV95':        p.rs?.n ?? '',
      'Bemerkung':     p.bemerkung || '',
    }));
    const wsInst = XLSX.utils.json_to_sheet(instRows);
    wsInst['!cols'] = [{wch:4},{wch:24},{wch:16},{wch:10},{wch:10},{wch:10},{wch:12},{wch:12},{wch:12},{wch:12},{wch:40}];
    XLSX.utils.book_append_sheet(wb, wsInst, 'INSTALLATIONEN');
  }

  XLSX.writeFile(wb, 'Fundamentbau_' + (getActiveProjectName() || 'Export').replace(/[^a-zA-Z0-9_]/g,'_') + '.xlsx');
}

// ── Export als Fundamentliste (SBB-Format) ──────────────────────────────────
function exportFundamentliste() {
  const kenndaten = loadKenndaten();
  const allBP     = loadAllBauprojekt();
  const ftList    = loadFtProfile();
  const titel     = store.getItem(TITEL_KEY) || '';
  const todayDisp = new Date().toLocaleDateString('de-CH');
  const todayISO  = new Date().toISOString().split('T')[0];
  const bearb     = kenndaten.bearbeiter || '';

  const ftByName = new Map(ftList.map(f => [f.name, f]));
  const aoa = [];
  // Zeile 1: Projektname + ISP + Stand
  aoa.push([titel, '', '', 'ISP:', kenndaten.isp || '', '', 'Stand:', todayDisp]);
  // Zeilen 2–6: leer
  for (let i = 0; i < 5; i++) aoa.push(new Array(28).fill(null));
  // Zeile 7: Primäre Spaltenköpfe
  aoa.push([
    'Mast', null, null, 'Bezugsgleis', 'Überhöhung', 'Mass a', 'hkgl', 'Ausrichtung Kopf', 'Lichte Weite',
    'Koordinaten (LV95)', null, null,
    'Gelände-neigung βp', 'Typ USCS', 'ME-Wert', 'Reibungswinkel φ\'k', 'Raumlast Boden γ\'k', 'Kohäsion c\'k',
    'GWSP ab OKT', 'Einsatz-bedingungen', 'Fundamenttyp Standard', null, 'Fundament-schrauben',
    'Fundamenttyp Spezial', null, 'Bemerkungen', 'Letzte Änderung', null
  ]);
  // Zeile 8: Einheiten/Unterköpfe
  aoa.push([
    'Km', 'Nr.', 'Masttyp FL', 'Gleis', '[mm]', '[m]', '[cm]', 'Gleis/Mast', '[m]',
    'E-Achse', 'N-Achse', 'Z-Achse',
    '[°]', 'GSMCO', '[Mpa]', '[°]', '[kN/m³]', '[kPa]',
    '[m]', '—', 'gem. FL-/SA-Planung', 'Zeichnungs-Nr.', 'Artikel-Nr.',
    'Typenblattbez./Plan-Nr.', '—', '—', 'Datum', 'Name'
  ]);
  // Zeilen 9–17: leer
  for (let i = 0; i < 9; i++) aoa.push(new Array(28).fill(null));
  // Ab Zeile 18: Datenpositionen (1 Zeile pro Pair)
  PAIRS.forEach(p => {
    const bp       = allBP[p.id] || {};
    const ft       = ftByName.get(bp.fundtyp || '');
    const neigGrad = bp.neigung === '≤14°' ? 7 : bp.neigung === '14–33°' ? 23 : null;
    aoa.push([
      p.km_rs,                    // A:0  Km
      p.mast        || '',         // B:1  Nr.
      p.masttyp     || '',         // C:2  Masttyp FL
      p.gleis       || '',         // D:3  Gleis
      p.ueberhohung ?? '',         // E:4  Überhöhung [mm]
      p.massA       ?? '',         // F:5  Mass a [m]
      p.hkgl        ?? '',         // G:6  hkgl [cm]
      p.ausrichtung ?? '',         // H:7  Ausrichtung Kopf
      p.lichteWeite ?? '',         // I:8  Lichte Weite [m]
      p.rs?.e       ?? '',         // J:9  E-Achse LV95
      p.rs?.n       ?? '',         // K:10 N-Achse LV95
      p.z           ?? '',         // L:11 Z-Achse
      neigGrad,                    // M:12 Geländeneigung [°]
      bp.bkBodentyp || '',         // N:13 Typ USCS
      bp.bkMe       || '',         // O:14 ME-Wert [Mpa]
      bp.bkPhi      || '',         // P:15 Reibungswinkel [°]
      bp.bkGamma    || '',         // Q:16 Raumlast [kN/m³]
      bp.bkC        || '',         // R:17 Kohäsion [kPa]
      bp.bkGrundwasser || '',      // S:18 GWSP [m]
      '',                          // T:19 Einsatzbedingungen (nicht in App)
      isFtSpezial(bp.fundtyp) ? (getBpRefFamilie(bp) || '') : (bp.fundtyp || ''), // U:20 Fundamenttyp Standard (bei Spezial: Referenz-Familie)
      ft?.vfkZeichnungsNr || '',   // V:21 Zeichnungs-Nr.
      '',                          // W:22 Schrauben Artikel-Nr.
      bp.nachweisLink || '',       // X:23 Fundamenttyp Spezial
      '',                          // Y:24
      bp.bemerkung  || '',         // Z:25 Bemerkungen
      todayISO,                    // AA:26 Letzte Änderung Datum
      bearb,                       // AB:27 Letzte Änderung Name
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    {wch:8},{wch:8},{wch:12},{wch:7},{wch:9},{wch:8},{wch:7},{wch:12},{wch:8},
    {wch:12},{wch:12},{wch:8},{wch:10},{wch:8},{wch:8},{wch:10},{wch:10},{wch:8},
    {wch:8},{wch:10},{wch:16},{wch:12},{wch:12},{wch:22},{wch:8},{wch:22},{wch:12},{wch:10}
  ];
  const wbOut = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbOut, ws, 'LISTE');
  const ispPfx = kenndaten.isp ? kenndaten.isp + '_' : '';
  XLSX.writeFile(wbOut, ispPfx + 'Fundamentliste_' + todayISO + '.xlsx');
}

// ============================================================
// PAIR CRUD: create / edit / delete / reorder
// ============================================================
// Erfassen und Bearbeiten laufen in ALLEN Phasen über die Vollbildmaske.
// Für Sondagen gab es dafür ein eigenes Modal mit kleiner Karte und einer
// abweichenden Feldanordnung — zwei Masken für dieselbe Aufgabe.
// Der Schichtwähler des alten Modals entfällt hier; die Schichtzuordnung
// läuft über die Schichten-Bibliothek und die Terminplanung.
function openModal(id) {
  openCreateView(id || undefined);
}

// Sondage-Modal entfernt: Erfassen und Bearbeiten laufen in allen Phasen
// ueber die Vollbildmaske (openCreateView).

async function deletePair(id) {
  const p = PAIRS.find(x => x.id === id);
  const name = p.bezeichnung || 'Standort ' + id;
  if (!await ui.confirm(`«${name}» wirklich löschen?`)) return;
  pushUndo();
  PAIRS.splice(PAIRS.findIndex(x => x.id === id), 1);
  delete appData[id];
  saveData(appData);
  savePairs();
  updateProgress();
  renderCards();
}

// ============================================================
// EXCEL IMPORT
// ============================================================
function importExcel(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rows.length) { ui.toast('Keine Daten in der Excel-Datei gefunden.', 'fehler'); return; }

      const col = (row, ...names) => {
        for (const n of names) {
          const k = Object.keys(row).find(k => k.trim().toLowerCase() === n.toLowerCase());
          if (k !== undefined && row[k] !== '') return row[k];
        }
        return '';
      };

      const parsed = rows.map((row, i) => {
        const rsE  = parseInt(col(row, 'E LV95 RS',  'RS E', 'rs_e',  'e_rs'));
        const rsN  = parseInt(col(row, 'N LV95 RS',  'RS N', 'rs_n',  'n_rs'));
        const rksE = parseInt(col(row, 'E LV95 RKS', 'RKS E','rks_e', 'e_rks'));
        const rksN = parseInt(col(row, 'N LV95 RKS', 'RKS N','rks_n', 'n_rks'));
        if (!rsE || !rsN || !rksE || !rksN) return null;
        return {
          id:          i + 1,
          bezeichnung: String(col(row, 'Bezeichnung', 'Name', 'bezeichnung') || ''),
          tag:         String(col(row, 'Tagarbeit', 'tag') || 'T1'),
          mast:        String(col(row, 'Mast', 'Mast Nr.', 'mast') || ''),
          km_rs:       parseFloat(col(row, 'KM RS', 'km_rs') || 0),
          km_rks:      parseFloat(col(row, 'KM RKS', 'km_rks') || 0),
          tiefe:       parseFloat(col(row, 'Tiefe Soll (m)', 'Tiefe', 'tiefe') || 5),
          gleis:       String(col(row, 'Gleis', 'gleis') || ''),
          rs:  { e: rsE,  n: rsN  },
          rks: { e: rksE, n: rksN },
          zugang: String(col(row, 'Zugang', 'zugang') || ''),
        };
      }).filter(Boolean);

      if (!parsed.length) {
        ui.toast('Keine gültigen Zeilen importiert.\nPflichtfelder: E LV95 RS, N LV95 RS, E LV95 RKS, N LV95 RKS\n\nHinweis: Nutze den Excel-Export als Vorlage für den Import.', 'erfolg');
        return;
      }

      const mode = await ui.confirm(
        `${parsed.length} Standort(e) importiert.\n\nOK = Bestehendes ersetzen\nAbbrechen = Zu bestehenden hinzufügen`
      );
      pushUndo();
      if (mode) {
        PAIRS.length = 0;
        parsed.forEach(p => PAIRS.push(p));
      } else {
        const maxId = PAIRS.length ? Math.max(...PAIRS.map(p => p.id)) : 0;
        parsed.forEach((p, i) => PAIRS.push({ ...p, id: maxId + i + 1 }));
      }
      savePairs();
      // Schicht-Kurzbezeichnungen aus Import-Daten in Bibliothek eintragen
      autoRegisterSchichtenFromPairs(parsed);
      updateProgress();
      renderCards();
      ui.toast(`Import abgeschlossen: ${parsed.length} Standorte ${mode ? 'ersetzt' : 'hinzugefügt'}.`, 'erfolg');
    } catch(err) {
      ui.toast('Fehler beim Lesen der Excel-Datei: ' + err.message, 'fehler');
    }
  };
  reader.readAsArrayBuffer(file);
}

// ── Hilfs-Konverter für Fundamentliste-Import ───────────────────────────────
function _normFtName(s)     { return typeof s === 'string' ? s.replace(/\s*\/\s*/g, ' / ').trim() : ''; }

// Robustes FT-Matching: exakt → Tiefe als Float (2.0 == 2.00) → Family-Prefix + nächste Tiefe
function _findFtInCache(cache, ftName) {
  if (!ftName) return null;
  // 1. Exakter Match
  let m = cache.find(f => f.name === ftName);
  if (m) return m;
  // 2. Tiefe normalisieren: "DP2a / 2.0" vs "DP2a / 2.00"
  const parseParts = n => { const p = n.split('/'); if (p.length < 2) return null; const d = parseFloat(p[1]); return isNaN(d) ? null : { family: p[0].trim().toLowerCase(), depth: d }; };
  const imp = parseParts(ftName);
  if (imp) {
    m = cache.find(f => { const p = parseParts(f.name); return p && p.family === imp.family && Math.abs(p.depth - imp.depth) < 0.001; });
    if (m) return m;
    // 3. Gleiche Family, nächste verfügbare Tiefe
    const same = cache.filter(f => { const p = parseParts(f.name); return p && p.family === imp.family; });
    if (same.length) return same.reduce((a, b) => { const pa = parseParts(a.name), pb = parseParts(b.name); return Math.abs(pa.depth - imp.depth) <= Math.abs(pb.depth - imp.depth) ? a : b; });
  }
  return null;
}
function _toNeigLabel(deg)  { const d = parseFloat(deg); return isNaN(d) ? '' : d <= 14 ? '≤14°' : d <= 33 ? '14–33°' : '>33°'; }
function _gwNumToEnum(v)    { if (v === null || v === '') return ''; const n = parseFloat(v); return isNaN(n) ? 'unbekannt' : (n > 0 ? 'angetroffen' : 'nicht_angetroffen'); }
function _uscsToBodentyp(s) { return /^[GS]/i.test(String(s||'').trim()) ? 'grob' : 'fein'; }

// Bodenkennwerte kommen in der Fundamentliste auch als Spanne vor («1-50»,
// «10 – 20», «5 bis 12»). Als Zeichenkette gespeichert liefen sie überall auf:
// die Zahlenfelder der Modale nehmen sie nicht an (der Browser verwirft eine
// ungültige Zahl, das Feld blieb leer), und die Grenzwertprüfung rechnete über
// parseFloat ohnehin nur mit dem unteren Wert weiter.
//
// Übernommen wird deshalb der UNTERE Wert — er ist für Steifigkeit und
// Reibungswinkel der massgebende, weil ungünstigere Fall. Die Original­angabe
// geht nicht verloren: _impSpanneNotiz sammelt sie für die Bemerkung.
function _impKennwert(roh) {
  const s = String(roh ?? '').trim();
  if (!s) return { wert: '', spanne: null };
  const m = s.match(/^(-?\d+(?:[.,]\d+)?)\s*(?:-|–|—|bis|\.\.\.|\.\.)\s*(-?\d+(?:[.,]\d+)?)$/i);
  if (!m) return { wert: s.replace(',', '.'), spanne: null };
  const a = parseFloat(m[1].replace(',', '.'));
  const b = parseFloat(m[2].replace(',', '.'));
  return { wert: String(Math.min(a, b)), spanne: s };
}

// Alle eindeutigen Familien-Kürzel aus dem FT-Profil-Cache (DP1a, DP2a, HP1a, …)
function getFtFamilies() {
  const seen = new Set();
  return loadFtProfile()
    .filter(t => t.typ === 'standard' && t.name.includes('/'))
    .map(t => t.name.split('/')[0].trim())
    .filter(f => { if (seen.has(f)) return false; seen.add(f); return true; })
    .sort();
}

// Gibt die gespeicherte oder abgeleitete Referenz-Familie zurück.
// Reihenfolge: Standort-Angabe → Referenztyp des zugewiesenen FT-Eintrags →
// Familie aus dem Namen eines Standardtyps.
//
// Ohne den mittleren Schritt blieb die Spalte «Ref.typ» bei Spezialfundamenten
// leer, sobald die Referenz nur am Bibliothekseintrag hing (so legt sie der
// Import an). Die Namensableitung greift nur noch bei echten Familien —
// «Monopfahl / Ø400» ergab sonst die Familie «Monopfahl».
function getBpRefFamilie(bp) {
  if (!bp) return '';
  if (bp.refFamilie) return bp.refFamilie;
  if (bp.ftProfilId) {
    const ft = loadFtProfile().find(t => t.id === bp.ftProfilId);
    if (ft?.referenzTyp) return ft.referenzTyp;
  }
  const name = bp.fundtyp || '';
  if (!name.includes('/')) return '';
  const fam = name.split('/')[0].trim();
  return getFtFamilies().includes(fam) ? fam : '';
}

// ── Import aus SBB-Fundamentliste (xlsm/xlsx) ───────────────────────────────
function importFundamentliste(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  const reader = new FileReader();
  reader.onload = e => _importFundamentlisteFromBuffer(e.target.result);
  reader.readAsArrayBuffer(file);
}

// Kern-Logik Import — trennt FileReader-Schicht von Verarbeitungsschicht
// damit der Buffer auch aus sessionStorage (Neues-Projekt-Flow) kommen kann
// Spalten-Mapping der SBB-Fundamentliste ermitteln.
// Robust gegen manuell eingefuegte Spalten: es werden nur echte Header-Zeilen
// gescannt (erkannt an eindeutigen Zellwerten), nicht Titel- oder Datenzellen.
// Eingabe: rows (Sheet als Array-of-Arrays). Rueckgabe: Spaltenindizes je Feld.
function _impSpaltenMapping(rows) {
  // Nur echte Header-Zeilen werden gescannt — kein falsches Matching auf Titel-
  // oder Datenzellen. Header-Zeilen werden anhand eindeutiger Zellwerte gefunden.
  const _nh = s => typeof s === 'string' ? s.toLowerCase().replace(/\s+/g, ' ').trim() : '';
  // Primäre Header-Zeile: enthält BEIDE Bezeichnungen in derselben Zeile —
  // "Fundamenttyp Standard" (evtl. mit Zusatz) UND "Spezial Fundament" (Spalte U).
  // Nur die eigentliche Header-Zeile 7 erfüllt beide Bedingungen gleichzeitig.
  const _hdrA = rows.find(r => r &&
    r.some(c => _nh(c).includes('fundamenttyp standard')) &&
    r.some(c => _nh(c).includes('spezial fundament')));
  // Sub-Header-Zeile: enthält gleichzeitig 'Km' und 'E-Achse'
  const _hdrB = rows.find(r => r && r.some(c => _nh(c) === 'km') && r.some(c => _nh(c) === 'e-achse'));
  // Spalten-Karte aufbauen: normierter Zelltext → Spalten-Index
  // Primäre Header-Zeile zuerst (gewinnt bei gleichem Schlüssel)
  const _colMap = {};
  [_hdrA, _hdrB].forEach(hr => {
    if (!hr) return;
    hr.forEach((v, i) => { const k = _nh(v); if (k && !(_colMap[k] !== undefined)) _colMap[k] = i; });
  });
  // Exakte Suche mit Fallback auf fixen Index
  const _ci = (key, fallback) => _colMap[_nh(key)] ?? fallback;
  // Partielle Suche: gibt ersten Eintrag zurück dessen Key den Suchstring enthält
  const _ciPart = (partial, fallback) => {
    const p = _nh(partial);
    for (const [k, v] of Object.entries(_colMap)) { if (k.includes(p)) return v; }
    return fallback;
  };
  // Versucht mehrere alternative Bezeichnungen; liefert ersten Treffer oder Fallback
  const _ciAny = (partials, fallback) => {
    for (const s of partials) { const r = _ciPart(s, null); if (r !== null) return r; }
    return fallback;
  };

  // Vorberechnete Spalten-Indizes (exakt oder partiell, jeweils mit festem Fallback)
  const COL = {
    km:          _ci('km',                        0),
    mast:        _ci('nr.',                        1),
    masttyp:     _ci('masttyp fl',                 2),
    gleis:       _ci('gleis',                      3),
    ueberhohung: _ciPart('überhöhung',             4),
    massA:       _ci('mass a',                     5),
    hkgl:        _ci('hkgl',                       6),
    ausrichtung: _ciPart('ausrichtung',             7),
    lichteWeite: _ciPart('lichte weite',            8),
    eAchse:      _ci('e-achse',                    9),
    nAchse:      _ci('n-achse',                   10),
    zAchse:      _ci('z-achse',                   11),
    neigung:     _ciPart('neigung',               12),
    uscs:        _ci('typ uscs',                  13),
    bkMe:        _ci('me-wert',                   14),
    bkPhi:       _ciPart('reibungswinkel',         15),
    bkGamma:     _ciPart('raumlast',               16),
    bkC:         _ciPart('kohäsion',               17),
    gwsp:        _ciPart('gwsp',                   18),
    ftStd:       _ciAny(['fundamenttyp standard', 'standardtyp', 'ft standard'], 21),
    // Spezialfundament-Spalte: verschiedene mögliche Bezeichnungen im SBB-Excel
    // In der aktuellen SBB-Vorlage: "Spezial Fundament Typ" (Spalte U, eine vor dem Standard)
    // Fallback: eine Stelle links vom Standard (ftStd - 1)
    get ftSpez() { return _ciAny(
      ['spezial fundament', 'fundamenttyp spezial', 'spezialfundament', 'spezialtyp', 'spezial-typ', 'ft spezial', 'spez.'],
      (COL.ftStd ?? 21) - 1
    ); },
    bemerkung:   _ci('bemerkungen',                25),
  };

  return COL;
}

async function _importFundamentlisteFromBuffer(buffer) {
  try {
    const wb = XLSX.read(buffer, { type: 'array' });
      // Primär "LISTE"-Sheet, Fallback auf erstes Sheet
      const wsName = wb.SheetNames.includes('LISTE') ? 'LISTE' : wb.SheetNames[0];
      const ws   = wb.Sheets[wsName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

      // ── Projektmetadaten aus Zeilen 1–2 (Index 0–1) ──────────────
      const row0 = rows[0] || [];
      // Projektname: erster nicht-leerer String nach Spalte A (Index 0)
      const projName = row0.slice(1).find(v => typeof v === 'string' && v.trim()) || null;
      // ISP und Stand: Zelle rechts neben Label-String
      const findAfterLabel = (rowArr, label) => {
        if (!rowArr) return null;
        for (let i = 0; i < rowArr.length - 1; i++) {
          if (typeof rowArr[i] === 'string' && rowArr[i].toLowerCase().includes(label.toLowerCase()))
            return rowArr[i + 1] ?? rowArr[i + 2] ?? null;
        }
        return null;
      };
      const ispVal   = findAfterLabel(rows[1], 'ISP')   || findAfterLabel(rows[0], 'ISP');
      const standVal = findAfterLabel(rows[1], 'Stand') || findAfterLabel(rows[0], 'Stand');

      // Alias-Kurzformen für lesbarere Aufrufe weiter unten
      const normFt         = _normFtName;
      const toNeigLabel    = _toNeigLabel;
      const gwNumToEnum    = _gwNumToEnum;
      const uscsToBodentyp = _uscsToBodentyp;

      // Spaltenindizes ermitteln (siehe _impSpaltenMapping)
      const COL = _impSpaltenMapping(rows);

      // ── Datenpositionen: Spalte A ist positive Dezimalzahl (km-Wert) ──
      const dataRows = rows.filter(r => r && r[COL.km] !== null && !isNaN(parseFloat(r[COL.km])) && parseFloat(r[COL.km]) > 0);
      if (!dataRows.length) {
        ui.toast('Keine Datenpositionen gefunden.\nErwartet: LISTE-Sheet mit Km-Werten (Spalte A) ab Zeile 18.', 'fehler');
        return;
      }

      const newPairs = [];
      const newBP    = {};
      // Bibliothek vorabfüllen: der Import gleicht gegen die Standardtypen ab.
      // In ein frisch angelegtes Projekt importiert, war sie sonst noch leer —
      // dann fand _findFtInCache nichts und jede Zuweisung lief ins Leere.
      seedDefaultFtProfile();
      const ftCache  = loadFtProfile();
      // Neu importierte Spezialtypen: Name → generierte ID (werden nach dem Loop gespeichert)
      const _impSpezNew    = {};
      const _impSpezRefTyp = {}; // Name → refFamilie (für referenzTyp auf dem FT-Eintrag)
      const _impTs         = Date.now().toString(36);
      const _impFamilien   = getFtFamilies();
      let   _impCnt        = 0;
      dataRows.forEach((r, i) => {
        const id         = i + 1;
        const ftStdName  = normFt(r[COL.ftStd]);
        const _ftSpezRaw = r[COL.ftSpez] != null ? String(r[COL.ftSpez]).trim() : '';
        // Platzhalter ("-", "—", "–") gelten als leer — Einsatzbedingungen erfüllt
        const ftSpezVal  = /^[-–—]+$/.test(_ftSpezRaw) ? '' : _ftSpezRaw;
        const masttyp     = String(r[COL.masttyp] ?? '').trim();
        const nutzungsart = MAST_DATEN[masttyp] ? masttyp : '';
        const refFromMast = getMasttypRefTyp(masttyp);
        // Nur echte Familien der Bibliothek gelten als Referenztyp — sonst wurde
        // ein Freitext aus der Spalte «Fundamenttyp Standard» zur Familie.
        const famAusStd  = (ftStdName.split('/')[0] || '').trim();
        const refFamilie = (famAusStd && _impFamilien.includes(famAusStd)) ? famAusStd : refFromMast;

        // ── Geländeneigung ────────────────────────────────────────
        const neigRaw   = r[COL.neigung];
        const neigLabel = toNeigLabel(neigRaw);
        const noNeigung = neigLabel === '';

        // ── Bodenkennwerte ────────────────────────────────────────
        const bkUscs  = r[COL.uscs]    != null ? String(r[COL.uscs]).trim() : '';
        const _me     = _impKennwert(r[COL.bkMe]);
        const _phi    = _impKennwert(r[COL.bkPhi]);
        const _gamma  = _impKennwert(r[COL.bkGamma]);
        const _c      = _impKennwert(r[COL.bkC]);
        const bkMe    = _me.wert, bkPhi = _phi.wert, bkGamma = _gamma.wert, bkC = _c.wert;
        // Spannen für die Bemerkung festhalten — der übernommene Wert allein
        // verschweigt sonst, dass in der Liste ein Bereich stand.
        const spannen = [
          _me.spanne    ? 'ME-Wert '   + _me.spanne    : '',
          _phi.spanne   ? "φ'k "       + _phi.spanne   : '',
          _gamma.spanne ? "γ'k "       + _gamma.spanne : '',
          _c.spanne     ? "c'k "       + _c.spanne     : '',
        ].filter(Boolean);
        const spannenNotiz = spannen.length
          ? 'Bereichsangabe in der Fundamentliste: ' + spannen.join(', ') + ' — jeweils unterer Wert übernommen.'
          : '';
        const bkGwNum = r[COL.gwsp];
        const bkGw    = bkGwNum != null ? String(bkGwNum) : '';
        const noBoden = !bkUscs && !bkMe && !bkPhi && !bkGamma && !bkC && !bkGw;

        // importVerify-Flags für Positionen die Nachprüfung brauchen
        const importVerify = {};
        if (noNeigung) importVerify.neigung = true;
        if (noBoden)   importVerify.boden   = true;
        if (ftSpezVal) importVerify.spezial = true;

        // ── Fundamenttyp: Standard oder Spezial ─────────────────────────────
        // Spezial wenn Spalte ftSpez einen Wert enthält (z.B. Plannummer, Typname)
        let _ftEntry, _ftNachweisLink, _ftSpezName;
        if (ftSpezVal) {
          const spezCache = ftCache.filter(t => t.typ === 'spezial');
          _ftEntry        = _findFtInCache(spezCache, ftSpezVal) || null;
          _ftSpezName     = _ftEntry?.name || ftSpezVal;
          _ftNachweisLink = ftSpezVal;
          // Kein Bibliotheks-Treffer → ID + Referenztyp für neuen Eintrag reservieren
          if (!_ftEntry) {
            if (!_impSpezNew[ftSpezVal]) {
              const slug = ftSpezVal.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
              _impSpezNew[ftSpezVal] = `ft_imp_${slug}_${_impTs}${_impCnt++}`;
            }
            if (refFamilie && !_impSpezRefTyp[ftSpezVal]) {
              _impSpezRefTyp[ftSpezVal] = refFamilie;
            }
          }
        } else {
          _ftEntry        = _findFtInCache(ftCache, ftStdName);
          _ftNachweisLink = '';
        }

        const eCoord = Math.round(parseFloat(r[COL.eAchse]) || 0);
        const nCoord = Math.round(parseFloat(r[COL.nAchse]) || 0);
        const validCoord = eCoord > 2400000 && eCoord < 2900000 && nCoord > 1000000 && nCoord < 1400000;
        const coordObj   = validCoord ? { e: eCoord, n: nCoord } : { e: 0, n: 0 };

        // Z-Achse = OK Fundamentkopf (m ü.M.) — direkt als Höhenkote übernehmen
        const zVal   = r[COL.zAchse] != null ? parseFloat(r[COL.zAchse]) : NaN;
        const validZ = !isNaN(zVal);
        let sohleFromZ = null;
        if (validZ) {
          const ftNameZ  = ftSpezVal ? _ftSpezName : (_ftEntry?.name || ftStdName);
          const neigKZ   = neigLabel.includes('14–33') ? '14–33°' : '≤14°';
          const abmZ     = FUND_ABMESSUNGEN[`${ftNameZ}|${neigKZ}`];
          if (abmZ) {
            sohleFromZ = parseFloat((zVal - 1.00 - parseFloat(abmZ.tiefe)).toFixed(1));
          } else {
            const ftZ = ftCache.find(t => t.name === ftNameZ);
            if (ftZ?.tiefe != null && !isNaN(parseFloat(ftZ.tiefe)))
              sohleFromZ = parseFloat((zVal - 1.00 - parseFloat(ftZ.tiefe)).toFixed(1));
          }
        }

        newPairs.push({
          id,
          _objType:    'fundament',
          km_rs:       parseFloat(r[COL.km]) || 0,
          km_rks:      parseFloat(r[COL.km]) || 0,
          mast:        String(r[COL.mast]        ?? ''),
          masttyp:     masttyp,
          gleis:       String(r[COL.gleis]       ?? ''),
          ueberhohung: r[COL.ueberhohung] ?? null,
          massA:       r[COL.massA]       ?? null,
          hkgl:        r[COL.hkgl]        ?? null,
          ausrichtung: r[COL.ausrichtung] ?? null,
          lichteWeite: r[COL.lichteWeite] ?? null,
          rs:          coordObj,
          rks:         coordObj,
          z:           r[COL.zAchse] ?? null,
          _phase:      'bauprojekt',
          bezeichnung: '',
          tag:         'T1',
          tiefe:       5,
          zugang:      '',
          strecke:     '',
          streckennr:  '',
        });
        newBP[id] = {
          bestand:       'neu',
          massnahme:     '',
          neigung:       neigLabel,
          bkBodentyp:    _uscsToBodentyp(bkUscs),
          bkUscs,
          bkMe,
          bkPhi,
          bkGamma,
          bkC,
          bkGrundwasser: bkGw,
          ...(spannenNotiz ? { bkBemerkung: spannenNotiz } : {}),
          fundtyp:       ftSpezVal ? _ftSpezName : (_ftEntry?.name || ftStdName),
          ftProfilId:    _ftEntry?.id || (ftSpezVal ? (_impSpezNew[ftSpezVal] || '') : ''),
          refFamilie,
          nutzungsart,
          nachweisLink:  _ftNachweisLink,
          bemerkung:     r[COL.bemerkung] != null ? String(r[COL.bemerkung]) : '',
          vfk:           false,
          ...(validZ ? { fundkopf_mueM: parseFloat(zVal.toFixed(1)) } : {}),
          ...(sohleFromZ !== null ? { sohle_mueM: sohleFromZ } : {}),
          ...(Object.keys(importVerify).length ? { importVerify } : {}),
        };
      });

      // ── Neu importierte Spezialtypen in die FT-Bibliothek eintragen ──────────
      // Für jeden unbekannten Code (B3, C3, LSP …) wird ein minimaler Eintrag angelegt.
      // Der Benutzer kann später Name, Beschreibung und Parameter ergänzen.
      if (Object.keys(_impSpezNew).length) {
        const ftList = loadFtProfile();
        let ftChanged = false;
        for (const [name, id] of Object.entries(_impSpezNew)) {
          // Nur gegen Spezialtypen pruefen — genau dort wurde vorher gesucht
          // (_findFtInCache auf spezCache). Ein gleichnamiger STANDARD-Typ haette
          // den Eintrag sonst verhindert, waehrend ftProfilId schon auf die neue
          // ID zeigt: die Zuweisung liefe dann ins Leere.
          if (!ftList.some(t => t.typ === 'spezial' && t.name === name)) {
            const refTyp = _impSpezRefTyp[name] || null;
            ftList.push({
              id, name, typ: 'spezial',
              fundamentArt:     'sonstige',
              ...(refTyp ? { referenzTyp: refTyp } : {}),
              kopfAbmessung: '', blockAbmessung: '',
              anzahlPfaehle: '', pfahlLaenge: '', tiefe: '',
              einsatzBedingung: 'Spezialfundament — aus Import (bitte Typ prüfen)',
              nachweisRequired: true,
              bemerkung:        '',
            });
            ftChanged = true;
          }
        }
        if (ftChanged) saveFtProfile(ftList);
      }

      // Sicherheitsnetz: Zuweisungen auf nicht (mehr) vorhandene FT-Eintraege
      // verwerfen. Eine ins Leere zeigende ftProfilId bleibt sonst unbemerkt und
      // laesst spaeter die Paketgenerierung und die Kapazitaetsrechnung auflaufen.
      const ftIds     = new Set(loadFtProfile().map(t => t.id));
      let   ftVerwaist = 0;
      const ftZuwNew  = {};
      Object.entries(newBP).forEach(([id, bp]) => {
        if (!bp.ftProfilId) return;
        if (!ftIds.has(bp.ftProfilId)) { delete bp.ftProfilId; ftVerwaist++; return; }
        ftZuwNew[id] = bp.ftProfilId;
      });
      if (ftVerwaist) console.warn('Import: ' + ftVerwaist + ' Fundamenttyp-Zuweisung(en) ohne Bibliothekseintrag verworfen.');

      // ── Baugrundprofile aus Importdaten erstellen (mit Deduplizierung) ──
      // Dedup-Schlüssel: Bodentyp§USCS§ME§Phi§Gamma§C§GW.
      // WICHTIG: Beide Seiten muessen dieselben Felder in derselben Reihenfolge
      // benutzen. Frueher begann der Schluessel bestehender Profile mit `uscs`,
      // der neuer Zeilen mit `bkBodentyp` — dadurch traf die Deduplizierung nie
      // ein vorhandenes Profil und jeder erneute Import legte alle Profile neu an.
      const _bgKey = (bodentyp, uscs, me, phi, gamma, c, gw) =>
        [bodentyp||'', uscs||'', me||'', phi||'', gamma||'', c||'', gw||''].join('§');
      const existingBgProfiles = loadBgProfile();
      const newBgProfiles      = [...existingBgProfiles];
      const bgDedup            = {};  // key → profilId
      // Vorhandene Profile in Dedup-Map eintragen
      existingBgProfiles.forEach(p => {
        const k = _bgKey(p.bodentyp, p.uscs, p.me, p.phi, p.gamma, p.c, p.grundwasser);
        if (!bgDedup[k]) bgDedup[k] = p.id;
      });
      const tempToBgProfil = {};
      let newProfCount = 0;
      const importTs = Date.now();
      Object.entries(newBP).forEach(([idStr, bp]) => {
        if (bp.importVerify?.boden) return;
        const gwEnum = gwNumToEnum(bp.bkGrundwasser);
        const key = _bgKey(bp.bkBodentyp, bp.bkUscs, bp.bkMe, bp.bkPhi, bp.bkGamma, bp.bkC, gwEnum);
        let profilId = bgDedup[key];
        if (!profilId) {
          newProfCount++;
          profilId = 'bg_imp_' + importTs + '_' + newProfCount;
          const bodentyp = bp.bkBodentyp; // bereits normalisiert ('fein'/'grob')
          const uscsRaw  = bp.bkUscs || '';
          newBgProfiles.push({
            id:          profilId,
            name:        `Import-Profil ${existingBgProfiles.length + newProfCount}` +
                         (uscsRaw ? ` — ${uscsRaw}` : ''),
            beschrieb:   '',
            bodentyp,
            uscs:        uscsRaw,
            me:          bp.bkMe,
            phi:         bp.bkPhi,
            gamma:       bp.bkGamma,
            c:           bp.bkC,
            grundwasser: gwEnum,
            gwTiefe:     bp.bkGrundwasser || '',
            gwMueM:      '',
            bemerkung:   'Automatisch aus Fundamentliste-Import erstellt'
                         + (bp.bkBemerkung ? '\n' + bp.bkBemerkung : ''),
          });
          bgDedup[key] = profilId;
        }
        tempToBgProfil[idStr] = profilId;
        // bgProfilId auch in newBP eintragen damit assignBgProfil-Logik greift
        bp.bgProfilId = profilId;
      });

      const replace = await ui.confirm(
        `${newPairs.length} Positionen gefunden.\n\nOK = Bestehendes ersetzen\nAbbrechen = Zu bestehendem hinzufügen`
      );
      pushUndo();

      // Baugrundprofile immer speichern (Deduplizierung berücksichtigt bestehende)
      if (newBgProfiles.length > existingBgProfiles.length) saveBgProfile(newBgProfiles);

      let finalBgZuw = {};

      if (replace) {
        PAIRS.length = 0;
        newPairs.forEach(p => PAIRS.push(p));
        saveAllBauprojekt(newBP);
        saveFtZuweisungen(ftZuwNew);
        finalBgZuw = { ...tempToBgProfil };
      } else {
        const maxId  = PAIRS.length ? Math.max(...PAIRS.map(p => p.id)) : 0;
        const allBP  = loadAllBauprojekt();
        const allFtZ = loadFtZuweisungen();
        finalBgZuw   = { ...loadBgZuweisungen() };
        newPairs.forEach((p, i) => {
          const nid = maxId + i + 1;
          PAIRS.push({ ...p, id: nid });
          allBP[nid]  = newBP[p.id];
          if (ftZuwNew[p.id])       allFtZ[nid]    = ftZuwNew[p.id];
          if (tempToBgProfil[p.id]) finalBgZuw[nid]= tempToBgProfil[p.id];
        });
        saveAllBauprojekt(allBP);
        saveFtZuweisungen(allFtZ);
      }
      saveBgZuweisungen(finalBgZuw);
      _migrateObjType(); // setzt _objType auf allen Pairs ohne es (inkl. neu importierte)
      savePairs();

      // Zusammenfassung Verifikationspositionen
      const needNeig  = Object.values(newBP).filter(b => b.importVerify?.neigung).length;
      const needBoden = Object.values(newBP).filter(b => b.importVerify?.boden).length;
      const warnParts = [];
      if (needNeig)  warnParts.push(`${needNeig} ohne Geländeneigung`);
      if (needBoden) warnParts.push(`${needBoden} ohne Baugrundkennwerte`);
      const warnMsg  = warnParts.length
        ? `\n\nZu verifizieren: ${warnParts.join(', ')}\n   (im Bauprogramm orange markiert)`
        : '';
      const bgMsg = newProfCount > 0 ? `\n${newProfCount} Baugrundprofil(e) erstellt.` : '';

      // Projektmetadaten übernehmen
      if (projName) {
        store.setItem(TITEL_KEY, projName);
        const span = document.getElementById('app-title-text');
        if (span) span.textContent = projName;
        const proj = _projects?.find(x => x.id === _activeId);
        if (proj) { proj.name = projName; saveProjectsMeta(_projects); }
      }
      const kd = loadKenndaten();
      if (ispVal)   kd.isp   = String(ispVal);
      if (standVal) {
        // SheetJS-Datum: serielle Zahl → ISO-String
        kd.stand = typeof standVal === 'number'
          ? new Date(Math.round((standVal - 25569) * 86400000)).toISOString().split('T')[0]
          : String(standVal).replace(/\./g, '-').split('-').reverse().join('-');
      }
      saveKenndatenData(kd);
      updateHeaderSub();

      autoRegisterSchichtenFromPairs(newPairs);
      setPhase('bauprojekt');
      // setPhase() wechselt keine Ansicht mehr. Lief der Import aus einem
      // Bereich einer anderen Phase (etwa Bauprogramm), bliebe dessen Inhalt
      // unter der neuen Phase stehen — deshalb hier gezielt zurueck.
      if (!viewErlaubt(currentOverviewView, 'bauprojekt')) setOverviewView('karten');
      renderCards();
      ui.toast(`Import abgeschlossen: ${newPairs.length} Positionen ${replace ? 'ersetzt' : 'hinzugefügt'}.${bgMsg}${warnMsg}`, 'erfolg');
    } catch(err) {
      ui.toast('Fehler beim Lesen der Fundamentliste:\n' + err.message, 'fehler');
      console.error(err);
    }
}

// ============================================================
// STARTTERMINE
// ============================================================
// Alle Tagarbeits-Labels — zentral definiert, an mehreren Stellen verwendet
const ALL_TAGS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
function loadTagDates() { try { return jsonParse(store.getItem(TAGDATES_KEY)) || {}; } catch { return {}; } }
function saveTagDatesData() { store.setItem(TAGDATES_KEY, JSON.stringify(tagDates)); }
let tagDates = loadTagDates();

function tagLabel(tag) {
  if (!tag) return '';
  const d = tagDates[tag];
  if (!d) return tag;
  const [y, m, day] = d.split('-');
  return `${tag} (${day}.${m}.${y})`;
}

function openTermineModal() {
  // Termine-View öffnen (T1-T12 sind jetzt dort integriert)
  document.getElementById('overview-view').style.display = '';
  document.getElementById('detail-view').style.display   = 'none';
  setOverviewView('termine');
}
function closeTermineModal()      { /* Modal durch Termine-View ersetzt */ }
function closeTermineModalOnBg() { /* Modal durch Termine-View ersetzt */ }

function exportTermineIcs() {
  const pn     = getActiveProjectName() || 'Rammsondagen';
  const events = [];
  const SCHICHT_LABEL = { tag: 'Tagarbeit', nacht: 'Nachtarbeit', gemischt: 'Tagarbeit/Nachtarbeit' };

  // Standort-Starttermine (aus pairData pro Pair der aktuellen Phase)
  getFilteredSorted().forEach((p, i) => {
    const pd = getPairData(p.id);
    if (!pd.startdatum) return;
    const lbl    = standortName(p);
    const sch    = schichtForPair(p.id);
    const schLbl = sch ? sch.name : (SCHICHT_LABEL[pd.startSchicht] || 'Tagarbeit');
    const [y, m, d] = pd.startdatum.split('-');
    const uid    = `sondagen-st-${p.id}-${pd.startdatum.replace(/-/g,'')}@sondagen-app`;
    let lines;
    if (pd.startVon && pd.startBis) {
      const dtStart = `${y}${m}${d}T${pd.startVon.replace(':','')}00`;
      const dtEnd   = `${y}${m}${d}T${pd.startBis.replace(':','')}00`;
      lines = ['BEGIN:VEVENT', `UID:${uid}`, `DTSTART:${dtStart}`, `DTEND:${dtEnd}`,
               `SUMMARY:T${i+1} ${lbl} – ${schLbl} – ${pn}`, 'CATEGORIES:Baustelle', 'END:VEVENT'];
    } else {
      const nextDay = new Date(pd.startdatum); nextDay.setDate(nextDay.getDate() + 1);
      const endStr  = nextDay.toISOString().split('T')[0].replace(/-/g, '');
      lines = ['BEGIN:VEVENT', `UID:${uid}`, `DTSTART;VALUE=DATE:${y}${m}${d}`,
               `DTEND;VALUE=DATE:${endStr}`,
               `SUMMARY:T${i+1} ${lbl} – ${schLbl} – ${pn}`, 'CATEGORIES:Baustelle', 'END:VEVENT'];
    }
    events.push(lines.join('\r\n'));
  });

  // Ereignisse mit optionalem VALARM
  loadEreignisse().filter(e => e.datum && e.status !== 'abgesagt').forEach(e => {
    const uid = `sondagen-erg-${e.id}@sondagen-app`;
    const [y, m, d] = e.datum.split('-');
    const lines = ['BEGIN:VEVENT', `UID:${uid}`];
    if (e.uhrzeit) {
      const dtS = `${y}${m}${d}T${e.uhrzeit.replace(':','')}00`;
      const dtE = e.uhrzeitBis ? `${y}${m}${d}T${e.uhrzeitBis.replace(':','')}00`
                               : `${y}${m}${d}T${String(parseInt(e.uhrzeit.split(':')[0])+1).padStart(2,'0')}${e.uhrzeit.split(':')[1]}00`;
      lines.push(`DTSTART:${dtS}`, `DTEND:${dtE}`);
    } else {
      const nd = new Date(e.datum); nd.setDate(nd.getDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${y}${m}${d}`, `DTEND;VALUE=DATE:${nd.toISOString().split('T')[0].replace(/-/g,'')}`);
    }
    const schLbl = e.typ === 'bau' && e.schichttyp ? ` [${SCHICHT_LABEL[e.schichttyp] || e.schichttyp}]` : '';
    const grpLbl = e.typ === 'bau' && e.baugruppe  ? ` · ${e.baugruppe}` : '';
    lines.push(`SUMMARY:${e.titel}${schLbl}${grpLbl}`);
    if (e.ort)       lines.push(`LOCATION:${e.ort}`);
    if (e.beschrieb) lines.push(`DESCRIPTION:${e.beschrieb.replace(/\n/g, '\\n')}`);
    lines.push('CATEGORIES:Baustelle');
    // VALARM falls Erinnerungsdatum gesetzt
    if (e.erinnerung?.datum && e.datum) {
      const mainDt = new Date(e.datum + 'T' + (e.uhrzeit || '08:00'));
      const erinDt = new Date(e.erinnerung.datum + 'T' + (e.erinnerung.uhrzeit || '08:00'));
      const diffMin = Math.round((mainDt - erinDt) / 60000);
      if (diffMin > 0) {
        lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:Erinnerung: ${e.titel}`,
                   `TRIGGER:-PT${diffMin}M`, 'END:VALARM');
      }
    }
    lines.push('END:VEVENT');
    events.push(lines.join('\r\n'));
  });

  if (!events.length) { ui.toast('Keine Termine erfasst.', 'fehler'); return; }
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Fundamentbau//DE',
               'CALSCALE:GREGORIAN','METHOD:PUBLISH', ...events, 'END:VCALENDAR'].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'Termine_' + pn.replace(/[^a-zA-Z0-9_]/g,'_') + '.ics';
  a.click();

  const email = document.getElementById('termine-email').value.trim();
  if (email) {
    const summary = getFilteredSorted()
      .filter(p => getPairData(p.id).startdatum)
      .map((p, i) => {
        const pd  = getPairData(p.id);
        const lbl = standortName(p);
        const sch = schichtForPair(p.id);
        const [y, m, d] = pd.startdatum.split('-');
        return `${d}.${m}.${y}  T${i+1} ${lbl}  (${sch ? sch.name : 'Tagarbeit'})`;
      }).join('\n');
    const _icsName = 'Termine_' + pn.replace(/[^a-zA-Z0-9_]/g,'_') + '.ics';
    const subject  = encodeURIComponent(`Starttermine – ${pn}`);
    const body     = encodeURIComponent(
      `Guten Tag\n\nIm Anhang die Starttermine (Datei: ${_icsName}).\n\nÜbersicht:\n${summary}\n\nBitte die .ics-Datei im Anhang in den Kalender importieren.`
    );
    setTimeout(() => { window.location.href = `mailto:${email}?subject=${subject}&body=${body}`; }, 500);
  }
}

function nextWorkingDay(date) {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

function autoFillTermine() {
  autoFillTermineStandorte(null);
}

function autoFillTermineStandorte(fromPairId) {
  const pairs = getFilteredSorted();
  if (!pairs.length) return;
  const startIdx  = fromPairId ? Math.max(0, pairs.findIndex(p => p.id === fromPairId)) : 0;
  const startEl   = document.getElementById('st-' + pairs[startIdx]?.id + '-datum');
  if (!startEl?.value) return;
  let cur = new Date(startEl.value);
  pairs.slice(startIdx + 1).forEach(p => {
    cur = nextWorkingDay(cur);
    const el = document.getElementById('st-' + p.id + '-datum');
    if (el && !el.value) el.value = cur.toISOString().split('T')[0];
  });
}

function saveTermine() {
  getFilteredSorted().forEach(p => {
    const datum     = document.getElementById('st-' + p.id + '-datum')?.value    || '';
    const von       = document.getElementById('st-' + p.id + '-von')?.value      || '';
    const bis       = document.getElementById('st-' + p.id + '-bis')?.value      || '';
    const schichtId = document.getElementById('st-' + p.id + '-schicht')?.value  || '';
    // Datum/Zeit in pairData speichern
    const pd = getPairData(p.id);
    setPairData(p.id, { ...pd,
      startdatum: datum    || undefined,
      startVon:   von      || undefined,
      startBis:   bis      || undefined,
    });
    // Schicht auf pair speichern
    const pairObj = PAIRS.find(x => x.id === p.id);
    if (pairObj) {
      if (schichtId) pairObj.schichtId = schichtId; else delete pairObj.schichtId;
    }
  });
  savePairs();
  renderCards();
  if (currentOverviewView === 'liste') renderList();
}

// ============================================================
// CUSTOM TAGS
// ============================================================
const TAG_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];
const STATUS_COLORS = [
  '#6b7280','#374151','#1a3a5c',
  '#ef4444','#f97316','#d97706','#ca8a04',
  '#16a34a','#059669','#14b8a6',
  '#3b82f6','#6366f1','#8b5cf6','#ec4899',
];
let newTagColor = TAG_COLORS[0];

function loadCustomTags() { try { return jsonParse(store.getItem(TAGS_KEY)) || []; } catch { return []; } }
function saveCustomTags() { store.setItem(TAGS_KEY, JSON.stringify(customTags)); }
let customTags = loadCustomTags();

function openTagModal() {
  renderTagModal();
  document.getElementById('new-tag-name').value = '';
  document.getElementById('tag-modal-overlay').classList.add('open');
}
function closeTagModal() { document.getElementById('tag-modal-overlay').classList.remove('open'); }
function closeTagModalOnBg(e) { if (e.target === document.getElementById('tag-modal-overlay')) closeTagModal(); }

function renderTagModal() {
  // Existing tags
  const list = document.getElementById('tag-list-render');
  list.innerHTML = customTags.length ? '' : '<span style="font-size:12px;color:#9ca3af;">Noch keine Tags erstellt.</span>';
  customTags.forEach(t => {
    const chip = document.createElement('span');
    chip.className = 'ctag-chip';
    chip.style.cssText = `background:${t.color}22;color:${t.color};border-color:${t.color}55;`;
    chip.innerHTML = `${t.name} <span class="ctag-del" onclick="deleteCustomTag('${t.id}')" title="Löschen">✕</span>`;
    list.appendChild(chip);
  });
  // Color picker
  const cp = document.getElementById('new-tag-colors');
  cp.innerHTML = '';
  TAG_COLORS.forEach(c => {
    const dot = document.createElement('div');
    dot.className = 'color-dot' + (c === newTagColor ? ' selected' : '');
    dot.style.background = c;
    dot.onclick = () => { newTagColor = c; renderTagModal(); };
    cp.appendChild(dot);
  });
}

function addCustomTag() {
  const name = document.getElementById('new-tag-name').value.trim();
  if (!name) return;
  customTags.push({ id: 'ct_' + Date.now(), name, color: newTagColor });
  saveCustomTags();
  renderTagModal();
  renderTagFilterChips();
  if (document.getElementById('tag-assign-row')) renderTagAssignment();
}

async function deleteCustomTag(id) {
  if (!await ui.confirm('Tag löschen? Er wird von allen Standorten entfernt.')) return;
  customTags = customTags.filter(t => t.id !== id);
  saveCustomTags();
  // Remove from all pairs data
  Object.keys(appData).forEach(k => {
    if (appData[k].tags) appData[k].tags = appData[k].tags.filter(tid => tid !== id);
  });
  saveData(appData);
  if (activeTagFilter === id) { activeTagFilter = null; }
  renderTagModal();
  renderTagFilterChips();
  if (document.getElementById('tag-assign-row')) renderTagAssignment();
  refreshCurrentView();
}

function togglePairTag(pairId, tagId) {
  const pd = getPairData(pairId);
  const tags = pd.tags ? [...pd.tags] : [];
  const idx = tags.indexOf(tagId);
  if (idx >= 0) tags.splice(idx, 1); else tags.push(tagId);
  setPairData(pairId, { tags });
  renderTagAssignment();
  refreshCurrentView();
}

let listTagPickerPairId = null;

function openListTagPicker(pairId, btn) {
  const picker = document.getElementById('list-tag-picker');
  if (listTagPickerPairId === pairId && picker.style.display === 'flex') {
    closeListTagPicker(); return;
  }
  listTagPickerPairId = pairId;
  const targets  = _listTargets(pairId);
  const isMulti  = targets.length > 1;
  const header   = document.getElementById('list-tag-picker-header');
  if (header) header.textContent = isMulti ? `${targets.length} Positionen` : 'Tags';
  const items = document.getElementById('list-tag-picker-items');
  items.innerHTML = '';
  if (!customTags.length) {
    items.innerHTML = '<span style="font-size:11px;color:#9ca3af;">Noch keine Tags.</span>';
  } else {
    customTags.forEach(t => {
      const activeCount = targets.filter(id => (getPairData(id).tags || []).includes(t.id)).length;
      const allActive   = activeCount === targets.length;
      const someActive  = activeCount > 0 && !allActive;
      const lbl = document.createElement('label');
      lbl.className = 'card-tag-picker-item';
      lbl.innerHTML = `<input type="checkbox" ${allActive ? 'checked' : ''} style="accent-color:${t.color}"> <span style="color:${t.color};font-weight:600;">${t.name}</span>`;
      const cb = lbl.querySelector('input');
      if (someActive) cb.indeterminate = true;
      cb.onchange = e => {
        const add = e.target.checked;
        targets.forEach(id => {
          const pd   = getPairData(id);
          const tags = pd.tags ? [...pd.tags] : [];
          const idx  = tags.indexOf(t.id);
          if (add && idx < 0)  tags.push(t.id);
          if (!add && idx >= 0) tags.splice(idx, 1);
          setPairData(id, { tags });
        });
        if (isMulti) _showListEditNotice(`${targets.length} Positionen aktualisiert`);
        renderTagAssignment();
        renderList();
      };
      items.appendChild(lbl);
    });
  }
  const r = btn.getBoundingClientRect();
  picker.style.display = 'flex';
  picker.style.top  = (r.bottom + 6) + 'px';
  picker.style.left = Math.min(r.left, window.innerWidth - 180) + 'px';
}

function closeListTagPicker() {
  document.getElementById('list-tag-picker').style.display = 'none';
  listTagPickerPairId = null;
}

// Globaler Click-Handler: Schließt Listen- und Kachel-Tag-Picker wenn außerhalb geklickt wird
document.addEventListener('click', e => {
  if (!e.target.closest('#list-tag-picker') && !e.target.closest('button[onclick*="openListTagPicker"]')) {
    closeListTagPicker();
  }
  if (!e.target.closest('.card-tag-picker') && !e.target.closest('[onclick*="toggleCardTagPicker"]')) {
    document.querySelectorAll('.card-tag-picker.open').forEach(el => el.classList.remove('open'));
  }
});

function toggleCardTagPicker(pairId, btn) {
  // Andere offene Picker schließen, dann eigenen umschalten
  document.querySelectorAll('.card-tag-picker.open').forEach(el => {
    if (el.id !== 'card-tag-picker-' + pairId) el.classList.remove('open');
  });
  const picker = document.getElementById('card-tag-picker-' + pairId);
  if (picker) picker.classList.toggle('open');
}

function renderTagAssignment() {
  const row = document.getElementById('tag-assign-row');
  if (!row) return;
  row.innerHTML = '';
  if (!customTags.length) {
    row.innerHTML = '<span style="font-size:11px;color:#9ca3af;">Keine Tags vorhanden — <a href="#" onclick="openTagModal();return false" style="color:#3b82f6;">Tags erstellen</a></span>';
    return;
  }
  const pd = getPairData(currentPairId);
  const active = pd.tags || [];
  customTags.forEach(t => {
    const chip = document.createElement('span');
    chip.className = 'ctag-chip' + (active.includes(t.id) ? ' active' : '');
    chip.style.cssText = active.includes(t.id)
      ? `background:${t.color}22;color:${t.color};border-color:${t.color};`
      : `background:#f9fafb;color:#6b7280;border-color:#e5e7eb;`;
    chip.textContent = t.name;
    chip.onclick = () => togglePairTag(currentPairId, t.id);
    row.appendChild(chip);
  });
}

// ============================================================
// SORT + TAG FILTER
// ============================================================
let currentSort = 'default';
let _listSortDir = 1; // 1 = aufsteigend, -1 = absteigend
let _listEditMode = false;
function toggleListEditMode() {
  _listEditMode = !_listEditMode;
  const btn = document.getElementById('list-edit-mode-btn');
  if (btn) {
    btn.style.background   = _listEditMode ? '#1a3a5c' : 'white';
    btn.style.color        = _listEditMode ? 'white'   : '#374151';
    btn.style.borderColor  = _listEditMode ? '#1a3a5c' : '#d1d5db';
  }
  renderList();
}
let activeTagFilter = null;

function setSort(val) {
  currentSort = val;
  refreshCurrentView();
}

function setListSort(col) {
  if (currentSort === col) {
    _listSortDir = _listSortDir === 1 ? -1 : 1;
  } else {
    currentSort = col;
    _listSortDir = 1;
  }
  renderList();
}

function setTagFilter(tagId) {
  activeTagFilter = activeTagFilter === tagId ? null : tagId;
  renderTagFilterChips();
  refreshCurrentView();
}

function refreshCurrentView() {
  if (currentOverviewView === 'karten') renderCards();
  else if (currentOverviewView === 'liste') renderList();
  else if (currentOverviewView === 'karte') refreshOverviewMap();
}

// ── Suche im Kopf ────────────────────────────────────────────
// Reine Zahlen gelten als Mast-/Positionsnummer oder Kilometer. Eine
// Volltextsuche nach «4» traefe sonst Jahreszahlen in Notizen, Koordinaten,
// Artikelnummern — praktisch jeden Standort.
const SUCHE_ZAHL      = /^\d+(?:[.,]\d+)?$/;
const SUCHE_ZAHL_TEIL = /\d+(?:[.,]\d+)?/g;
// Kilometer sind auf 10 m angeschrieben; wer «0.27» eingibt, meint diese Marke
const SUCHE_KM_TOLERANZ = 0.05;

function _zahl(s) { return parseFloat(String(s).replace(',', '.')); }

function _sucheTrifftZahl(p, q) {
  const wert = _zahl(q);
  if (String(p.id) === q) return true;
  const ausText = feld => (String(feld || '').match(SUCHE_ZAHL_TEIL) || []).some(z => _zahl(z) === wert);
  if (ausText(p.mast) || ausText(p.bezeichnung)) return true;
  return [p.km_rs, p.km_rks].some(km =>
    km !== null && km !== undefined && km !== '' && Math.abs(_zahl(km) - wert) < SUCHE_KM_TOLERANZ);
}

// Alles, was am Standort haengt, in einen Text — damit die Suche nicht nur
// Bezeichnung und Mast findet, sondern auch Strecke, Fundamenttyp, Zugang,
// Kommentar, Schlagworte, Bauprojektangaben und Notizen.
function _sucheText(p, notAll, bpAll) {
  const pd = getPairData(p.id);
  const bp = bpAll[p.id] || {};
  return [
    p.bezeichnung, 'Standort ' + p.id, p.mast, p.strecke, p.streckennr,
    p.fundtyp, p.zugang, p.bemerkung, p.massnahme, p.bestand,
    pd.comment, typeof statusLabel === 'function' ? statusLabel(pd.status) : pd.status,
    ...(pd.tags || []).map(id => (customTags.find(t => t.id === id) || {}).name),
    ...Object.values(bp).filter(v => typeof v === 'string' || typeof v === 'number'),
    ...(notAll[p.id] || []).map(n => n.text),
  ].filter(Boolean).join(' ').toLowerCase();
}

function sucheTrifftStandort(p, roh, notAll, bpAll) {
  const q = String(roh || '').trim().toLowerCase();
  if (!q) return true;
  if (SUCHE_ZAHL.test(q)) return _sucheTrifftZahl(p, q);
  return _sucheText(p, notAll || {}, bpAll || {}).includes(q);
}

function getFilteredSorted() {
  // Nur Standorte der aktuellen Phase anzeigen (Installationen nie in der normalen Kachelansicht)
  let list = _activePhase === 'baugrund'
    ? getSondagen()
    : getFundamente();
  if (currentFilter !== 'alle') list = list.filter(p => getPairData(p.id).status === currentFilter);
  if (activeTagFilter) list = list.filter(p => (getPairData(p.id).tags || []).includes(activeTagFilter));
  if (searchQuery) {
    // Notizen und Bauprojektdaten einmal je Durchgang laden, nicht je Standort
    const notAll = loadAllNotizen();
    const bpAll  = typeof loadAllBauprojekt === 'function' ? loadAllBauprojekt() : {};
    list = list.filter(p => sucheTrifftStandort(p, searchQuery, notAll, bpAll));
  }
  if (currentSort === 'name')   list.sort((a,b) => _listSortDir * (a.bezeichnung||'Standort '+a.id).localeCompare(b.bezeichnung||'Standort '+b.id, 'de'));
  if (currentSort === 'tag')    list.sort((a,b) => { const da = tagDates[a.tag]||'9999'; const db = tagDates[b.tag]||'9999'; return _listSortDir * (da < db ? -1 : da > db ? 1 : 0); });
  if (currentSort === 'km')     list.sort((a,b) => _listSortDir * (parseFloat(a.km_rs||9999) - parseFloat(b.km_rs||9999)));
  if (currentSort === 'mast')   list.sort((a,b) => _listSortDir * (parseInt(a.mast||9999) - parseInt(b.mast||9999)));
  if (currentSort === 'status') list.sort((a,b) => _listSortDir * getPairData(a.id).status.localeCompare(getPairData(b.id).status, 'de'));
  return list;
}

function renderTagFilterChips() {
  const wrap = document.getElementById('tag-filter-chips');
  if (!wrap) return;
  wrap.innerHTML = '';
  customTags.forEach(t => {
    const chip = document.createElement('span');
    chip.className = 'ctag-chip' + (activeTagFilter === t.id ? ' active' : '');
    chip.style.cssText = activeTagFilter === t.id
      ? `background:${t.color}22;color:${t.color};border-color:${t.color};`
      : `background:#f9fafb;color:#6b7280;border-color:#e5e7eb;`;
    chip.textContent = t.name;
    chip.onclick = () => setTagFilter(t.id);
    wrap.appendChild(chip);
  });
}

// ============================================================
