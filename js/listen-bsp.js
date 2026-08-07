// DYNAMISCHE LISTENANSICHT — phasenabhängige Spalten
// ============================================================
const LIST_COLUMNS = {
  baugrund: [
    { key: 'mast',   label: 'Mast',    render: p => p.mast || '—' },
    { key: 'km',     label: 'KM',      render: p => p.km_rs ? parseFloat(p.km_rs).toFixed(3) : '—' },
    { key: 'tag',    label: 'Tagarbeit',render: p => p.tag || '—' },
    { key: 'tiefe',  label: 'Tiefe [m]',render: p => p.tiefe || '—' },
    { key: 'gleis',  label: 'Gleis',   render: p => p.gleis || '—' },
    { key: 'status', label: 'Status',  render: p => { const s=getPairData(p.id).status||'geplant'; return `<span style="font-size:10px;padding:2px 7px;border-radius:4px;background:${s==='abgeschlossen'?'#dcfce7':s==='abklaerung'?'#fef3c7':'#f3f4f6'};color:${s==='abgeschlossen'?'#166534':s==='abklaerung'?'#92400e':'#6b7280'};">${statusLabel(s)}</span>`; } },
  ],
  bauprojekt: [
    { key: 'km',       label: 'KM',          render: p => p.km_rs ? parseFloat(p.km_rs).toFixed(3) : '—' },
    // Zuweisen läuft über den Bearbeiten-Modus der Liste (_listEditMode in
    // renderList) — dort wird diese Spalte zum Auswahlfeld.
    { key: 'fundtyp',  label: 'Fundamenttyp', render: p => {
      const bp    = loadAllBauprojekt()[p.id] || {};
      const ft    = bp.fundtyp || p.fundtyp || '—';
      const warnB = bp.importVerify?.boden   ? '<span title="Baugrundkennwerte fehlen" style="margin-left:4px;color:#d97706;opacity:0.7;display:inline-flex;">' + svgIcon('warnung',{groesse:10}) + '</span>' : '';
      const warnS = bp.importVerify?.spezial ? '<span title="Spezialtyp bitte prüfen" style="margin-left:4px;color:#d97706;opacity:0.7;display:inline-flex;">' + svgIcon('warnung',{groesse:10}) + '</span>' : '';
      return ft + warnS + warnB;
    } },
    { key: 'reftyp', label: 'Ref.typ', render: p => {
      const bp  = loadAllBauprojekt()[p.id] || {};
      const ref = getBpRefFamilie(bp);
      return ref
        ? `<span style="font-size:11px;font-weight:600;color:#374151;">${ref}</span>`
        : '<span style="color:#d1d5db;">—</span>';
    } },
    { key: 'neigung',  label: 'Neigung',      render: p => { const bp=loadAllBauprojekt()[p.id]||{}; const n=bp.neigung||p.neigung; if(n) return n; return bp.importVerify?.neigung?'<span title="Geländeneigung fehlt" style="font-size:10px;color:#d97706;opacity:0.7;">? —</span>':'—'; } },
    { key: 'boden',    label: 'Baugrund',     render: p => { const bp=loadAllBauprojekt()[p.id]||{}; const me=bp.bkMe; const phi=bp.bkPhi; if(!me&&!phi) return '—'; const nbt=(bp.bkBodentyp==='fein'||bp.bkBodentyp==='grob')?bp.bkBodentyp:_uscsToBodentyp(bp.bkBodentyp); const grenz=BK_GRENZWERTE[nbt]||BK_GRENZWERTE.fein; const ok=(!me||parseFloat(me)>=grenz.me)&&(!phi||parseFloat(phi)>=27); return `<span style="color:${ok?'#16a34a':'#dc2626'};font-weight:600;">${ok?'Erfüllt':'Nicht erfüllt'}</span>`; } },
  ],
  ausfuehrung: [
    { key: 'km',      label: 'KM',      render: p => p.km_rs ? parseFloat(p.km_rs).toFixed(3) : '—' },
    { key: 'aushub',  label: 'Aushub',  render: p => { const af=loadAllAusfuehrung()[p.id]||{}; const s=af.protokoll||''; return s==='ja'?'<span style="color:#16a34a;font-weight:600;">Erstellt</span>':s==='pendent'?'<span style="color:#f59e0b;font-weight:600;">Pendent</span>':s==='nein'?'<span style="color:#dc2626;font-weight:600;">Nein</span>':'—'; } },
    { key: 'material',label: 'Material',render: p => { const af=loadAllAusfuehrung()[p.id]||{}; const s=af.matStatus||''; return s==='geliefert'?'<span style="color:#16a34a;font-weight:600;">Geliefert</span>':s==='bestellt'?'<span style="color:#f59e0b;font-weight:600;">Bestellt</span>':s?s:'—'; } },
    { key: 'abnahme', label: 'Abnahme', clickFn: id => `openCheckliste(${id})`, render: p => { const ck=loadAllChecklisten()[p.id]; if(!ck) return '—'; const ok=CK_PRUEFPUNKTE.filter(x=>ck[`ck_${x.id}_ok`]==='ok'||ck[`ck_${x.id}_ok`]==='na').length; const mn=CK_PRUEFPUNKTE.filter(x=>ck[`ck_${x.id}_ok`]==='mangel').length; return mn>0?`<span style="color:#dc2626;font-weight:600;">${mn} Mängel</span>`:ok===CK_PRUEFPUNKTE.length?'<span style="color:#16a34a;font-weight:600;">Bestanden</span>':`${ok}/${CK_PRUEFPUNKTE.length}`; } },
  ],
};

// ============================================================
// ERWEITERTE LISTEN-SPALTEN (Spalten-Picker)
// ============================================================
const LIST_EXTRA_COLUMNS = {
  baugrund: [
    { key: 'zugang',    label: 'Zugang',    render: p => p.zugang||'—' },
    { key: 'e_rs',      label: 'E LV95',    render: p => p.rs?.e||'—' },
    { key: 'n_rs',      label: 'N LV95',    render: p => p.rs?.n||'—' },
    { key: 'gleis',     label: 'Gleis',     render: p => p.gleis||'—' },
    { key: 'tiefe_ist', label: 'Tiefe Ist', render: p => getPairData(p.id).felddaten?.rs_tiefe_ist||'—' },
    { key: 'kommentar', label: 'Kommentar', render: p => getPairData(p.id).comment||'—' },
  ],
  bauprojekt: [
    // Aus der früheren Zuweisungstabelle übernommen
    { key: 'ft_status',   label: 'Zuweisung',   render: p => ftStatusHtml(p.id) },
    { key: 'vfk',         label: 'VFK',         render: p => `<input type="checkbox" ${(loadAllBauprojekt()[p.id]||{}).vfk ? 'checked' : ''} onclick="event.stopPropagation()" onchange="saveBpVfk(${p.id},this.checked)" style="cursor:pointer;width:13px;height:13px;accent-color:#1a3a5c;" title="VFK — Vorfabrizierter Fundamentkopf">` },
    { key: 'ft_intervall',label: 'Intervall (h)',render: p => {
      const ft = loadFtProfile().find(t => t.id === loadFtZuweisungen()[p.id]);
      if (!ft) return '—';
      // Leistungsprofil hat Vorrang — gleiche Rangfolge wie getFtLeistung() in
      // der Terminrechnung. Die Spalte zeigte den Eigenwert des Typs und wich
      // damit von der Dauer ab, mit der das Bauprogramm tatsächlich rechnet.
      const lp   = ft.leistungsprofilId ? loadLeistungsprofile().find(x => x.id === ft.leistungsprofilId) : null;
      const intv = lp?.ftIntervall ?? ft.ftIntervall;
      const tab  = lp?.ftLeistungen || ft.ftLeistungen;
      return (intv != null ? intv + ' h' : '—')
           + (tab ? ' <span style="font-size:10px;color:#16a34a;font-weight:600;" title="Schichtleistungen definiert">Tab.</span>' : '');
    } },
    { key: 'schicht',       label: 'Schicht',      render: p => schichtLabel(p.schichtId) },
    { key: 'sperrmuster',   label: 'Sperrmuster',  render: p => resolveSpForPair(p.id)?.name || '—' },
    { key: 'gleisgebunden', label: 'Gleisgebunden',render: p => (loadAllBauprojekt()[p.id]||{}).ausfGleisgebunden?'Ja':'—' },
    { key: 'kommentar',     label: 'Kommentar',    render: p => getPairData(p.id).comment||'—' },
    { key: 'e_rs',          label: 'E LV95',       render: p => p.rs?.e||'—' },
    { key: 'n_rs',          label: 'N LV95',       render: p => p.rs?.n||'—' },
    { key: 'gleis',         label: 'Gleis',        render: p => `<input type="text" value="${p.gleis||''}" placeholder="—" style="width:52px;font-size:12px;border:1px solid #d1d5db;border-radius:4px;padding:1px 4px;text-align:center;" onclick="event.stopPropagation()" onchange="saveListGleis(${p.id},this.value)">` },
    { key: 'gw_zone',       label: 'GW-Zone',      render: p => { const z=(loadAllNaturschutz()[p.id]||{}).gwZone||''; return z ? (GW_ZONE_LABEL[z]||z) : '—'; } },
    { key: 'gw_kote',       label: 'GW-Kote',      render: p => { const k=getBpGwKote(p.id); return k!==null?k.toFixed(1)+' m ü.M.':'—'; } },
    { key: 'ns_schutz',     label: 'Schutzgebiete',render: p => { const ns=loadAllNaturschutz()[p.id]||{}; const items=[ns.bln&&'BLN',ns.nsg&&'NSG',ns.gewaesser&&'Gew.',ns.wald&&'Wald',ns.andere&&'Andere'].filter(Boolean); return items.length?items.join(', '):'—'; } },
    { key: 'ns_auflagen',   label: 'Auflagen',     render: p => (loadAllNaturschutz()[p.id]||{}).auflagen||'—' },
  ],
  ausfuehrung: [
    { key: 'startdatum',     label: 'Startdatum',   render: p => getPairData(p.id).startdatum||'—' },
    { key: 'schicht',        label: 'Schicht',      render: p => schichtLabel(p.schichtId) },
    { key: 'sperrmuster',    label: 'Sperrmuster',  render: p => resolveSpForPair(p.id)?.name || '—' },
    { key: 'geraet',         label: 'Gerät',        render: p => (loadAllBauprojekt()[p.id]||{}).ausfGeraet||'—' },
    { key: 'schichtleistung',label: 'Sch.-Leistung',render: p => { const v=(loadAllBauprojekt()[p.id]||{}).schichtleistung; return v?v+' Fund./Sch.':'—'; } },
    { key: 'kommentar',      label: 'Kommentar',    render: p => getPairData(p.id).comment||'—' },
    { key: 'e_rs',           label: 'E LV95',       render: p => p.rs?.e||'—' },
    { key: 'n_rs',           label: 'N LV95',       render: p => p.rs?.n||'—' },
    { key: 'gleis',          label: 'Gleis',        render: p => p.gleis||'—' },
    { key: 'gw_zone',        label: 'GW-Zone',      render: p => { const z=(loadAllNaturschutz()[p.id]||{}).gwZone||''; return z ? (GW_ZONE_LABEL[z]||z) : '—'; } },
    { key: 'gw_kote',        label: 'GW-Kote',      render: p => { const v=(loadAllNaturschutz()[p.id]||{}).gwKote; return v?v+' m ü.M.':'—'; } },
    { key: 'ns_schutz',      label: 'Schutzgebiete',render: p => { const ns=loadAllNaturschutz()[p.id]||{}; const items=[ns.bln&&'BLN',ns.nsg&&'NSG',ns.gewaesser&&'Gew.',ns.wald&&'Wald',ns.andere&&'Andere'].filter(Boolean); return items.length?items.join(', '):'—'; } },
  ],
};

const _listExtraColsKey = () => 'list_extra_cols__' + _activeId + '__' + _activePhase;
function loadListExtraCols() { try { return jsonParse(store.getItem(_listExtraColsKey())) || []; } catch { return []; } }
let _listExtraCols = [];

function getListColumns() {
  const base  = LIST_COLUMNS[_activePhase] || LIST_COLUMNS.baugrund;
  const extra = (LIST_EXTRA_COLUMNS[_activePhase] || []).filter(c => _listExtraCols.includes(c.key));
  return [...base, ...extra];
}

function toggleListColumnPicker(btn) {
  const picker = document.getElementById('list-col-picker');
  if (!picker) return;
  if (picker.style.display !== 'none') { picker.style.display = 'none'; return; }
  const extras = LIST_EXTRA_COLUMNS[_activePhase] || [];
  const items  = document.getElementById('list-col-picker-items');
  if (items) {
    const umweltKeys = new Set(['gw_zone','gw_kote','ns_schutz','ns_auflagen']);
    const metaKeys   = new Set(['e_rs','n_rs','gleis']);
    const baseExtras  = extras.filter(c => !umweltKeys.has(c.key) && !metaKeys.has(c.key));
    const metaExtras  = extras.filter(c =>  metaKeys.has(c.key));
    const umweltExtras= extras.filter(c =>  umweltKeys.has(c.key));
    const sectionHdr  = label => `<div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;margin:8px 0 4px;">${label}</div>`;
    const renderItems = cols => cols.map(c => `
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#374151;cursor:pointer;padding:3px 0;">
          <input type="checkbox" ${_listExtraCols.includes(c.key)?'checked':''} style="accent-color:#1a3a5c;"
            onchange="toggleListExtraCol('${c.key}')">
          ${c.label}
        </label>`).join('');
    items.innerHTML = !extras.length
      ? '<span style="font-size:11px;color:#9ca3af;">Keine zusätzlichen Spalten.</span>'
      : renderItems(baseExtras)
        + (metaExtras.length  ? sectionHdr('Metadaten') + renderItems(metaExtras)  : '')
        + (umweltExtras.length ? sectionHdr('Umwelt')    + renderItems(umweltExtras) : '');
  }
  const r = btn.getBoundingClientRect();
  picker.style.top  = (r.bottom + 6) + 'px';
  picker.style.left = Math.max(14, r.right - 200) + 'px';
  picker.style.display = 'block';
}

function toggleListExtraCol(key) {
  const idx = _listExtraCols.indexOf(key);
  if (idx >= 0) _listExtraCols.splice(idx, 1); else _listExtraCols.push(key);
  store.setItem(_listExtraColsKey(), JSON.stringify(_listExtraCols));
  renderList();
}

function saveListGleis(pairId, value) {
  const pair = PAIRS.find(p => p.id === pairId);
  if (!pair) return;
  pair.gleis = value.trim() || null;
  savePairs();
}

function saveListRefFamilie(pairId, value) {
  const allBP = loadAllBauprojekt();
  if (!allBP[pairId]) allBP[pairId] = {};
  allBP[pairId].refFamilie = value;
  // Spezialtyp-Warnflag quittieren, sobald Referenztyp gesetzt wird
  if (value && allBP[pairId].importVerify?.spezial) {
    const iv = { ...allBP[pairId].importVerify };
    delete iv.spezial;
    if (Object.keys(iv).length) allBP[pairId].importVerify = iv;
    else delete allBP[pairId].importVerify;
  }
  saveAllBauprojekt(allBP);
  renderList();
}

// Schließt den Spalten-Picker bei Klick außerhalb
document.addEventListener('click', e => {
  const picker = document.getElementById('list-col-picker');
  const btn    = document.getElementById('list-col-picker-btn');
  if (picker && picker.style.display !== 'none' && !picker.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
    picker.style.display = 'none';
  }
});

// ============================================================
// LISTEN-EXPORT (Excel + PDF)
// ============================================================
function exportListExcel() {
  if (typeof XLSX === 'undefined') { ui.toast('XLSX-Bibliothek nicht geladen.', 'fehler'); return; }
  const cols  = getListColumns();
  const pairs = getFilteredSorted();
  const pn    = getActiveProjectName() || 'Export';
  const stripHtml = s => String(s).replace(/<[^>]*>/g, '').trim();

  const rows = pairs.map(p => {
    const row = { 'Standort': p.bezeichnung || (p.mast ? 'Mast '+p.mast : 'ID '+p.id) };
    cols.forEach(c => { row[c.label] = stripHtml(c.render(p)); });
    row['Tags'] = (getPairData(p.id).tags||[]).map(tid => { const t=customTags.find(x=>x.id===tid); return t?t.name:''; }).filter(Boolean).join(', ');
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0]||{}).map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Standorte');
  XLSX.writeFile(wb, pn.replace(/[^a-zA-Z0-9_]/g,'_') + '_Liste.xlsx');
}

function exportListPdf() {
  const jsPDFLib = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFLib) { ui.toast('jsPDF-Bibliothek nicht geladen.', 'fehler'); return; }
  const doc   = new jsPDFLib({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const cols  = getListColumns();
  const pairs = getFilteredSorted();
  const pn    = getActiveProjectName() || 'Projekt';
  const date  = new Date().toLocaleDateString('de-CH');
  const stripHtml = s => String(s).replace(/<[^>]*>/g, '').trim();

  // Titel
  doc.setFontSize(13); doc.setFont(undefined,'bold');
  doc.text(`${pn} — Standortliste`, 14, 14);
  doc.setFontSize(9); doc.setFont(undefined,'normal');
  doc.text(`Phase: ${PHASEN_CONFIG[_activePhase]?.label || _activePhase} · ${pairs.length} Einträge · ${date}`, 14, 20);

  // Tabellenspalten
  const head = [['Standort', ...cols.map(c=>c.label), 'Tags']];
  const body = pairs.map(p => [
    p.bezeichnung || (p.mast ? 'Mast '+p.mast : 'ID '+p.id),
    ...cols.map(c => stripHtml(c.render(p))),
    (getPairData(p.id).tags||[]).map(tid => { const t=customTags.find(x=>x.id===tid); return t?t.name:''; }).filter(Boolean).join(', ')
  ]);

  // Manuelles Zeichnen (kein autoTable-Plugin nötig)
  const startY = 26, rowH = 6;
  const colW = Math.floor(270 / head[0].length);
  let y = startY;

  const drawHeader = () => {
    doc.setFillColor(26, 58, 92); doc.setTextColor(255,255,255);
    doc.rect(14, y - 4, head[0].length * colW, rowH, 'F');
    doc.setFontSize(8); doc.setFont(undefined,'bold');
    head[0].forEach((h, i) => doc.text(String(h).slice(0,20), 15 + i*colW, y));
    doc.setTextColor(0,0,0);
    y += rowH;
  };

  drawHeader();
  doc.setFont(undefined,'normal');
  body.forEach((row, ri) => {
    if (y > 192) { doc.addPage(); y = 14; drawHeader(); }
    if (ri % 2 === 1) { doc.setFillColor(248,250,252); doc.rect(14, y-4, head[0].length*colW, rowH, 'F'); }
    row.forEach((cell, i) => doc.text(String(cell).slice(0,22), 15 + i*colW, y));
    y += rowH;
  });

  doc.save(pn.replace(/[^a-zA-Z0-9_]/g,'_') + '_Liste.pdf');
}

// ============================================================
// BEGEHUNG SKIZZE
// ============================================================
const BSK_KEY = () => 'sp_beg_skizze__' + _activeId;
let _bskPairId   = null;
let _bskPhase    = null;
let _bskIndex    = 1;   // aktuelle Skizzen-Nummer (1-basiert)
let _bskTool     = 'pen';
let _bskColor    = '#e53e3e';
let _bskSize     = 4;
let _bskStrokes  = [];
let _bskHistory  = [];
let _bskDrawing  = false;
let _bskCurStroke = null;
let _bskBgOpacity = 0.5;
let _bskMap      = null;
let _bskHasBg    = false;                    // nur bei echtem Hintergrundbild speichern
let _bskBgRect   = null;                     // Lage des Bildes auf dem Blatt
let _bskView     = { w: 0, h: 0 };           // sichtbarer Ausschnitt
let _bskPan      = { x: 0, y: 0, scale: 1 }; // Blattverschiebung und Zoom
let _bskPanZieh  = null;                     // laufendes Verschieben mit der Maus
let _bskEventsGebunden = false;

// Das Blatt ist bewusst grösser als der sichtbare Ausschnitt: beim Zoomen und
// Schieben soll auch ausserhalb des Startbereichs gezeichnet werden können.
// Vorher war die Zeichenfläche exakt einen Ausschnitt gross — daneben liess
// sich nichts mehr anlegen.
const BSK_BLATT_FAKTOR = 2;

function loadAllBskSkizzen() {
  try { return jsonParse(store.getItem(BSK_KEY())) || {}; } catch { return {}; }
}
function saveAllBskSkizzen(all) { store.setItem(BSK_KEY(), JSON.stringify(all)); }

// Schlüssel für eine bestimmte Skizze
function bskKey(pairId, phase, idx) { return `${pairId}_${phase}_${idx}`; }

// Nächste freie Nummer ermitteln
function bskNextIndex(pairId, phase) {
  const all = loadAllBskSkizzen();
  let i = 1;
  // Limit verhindert Endlosschleife bei korrupten localStorage-Daten
  while (all[bskKey(pairId, phase, i)] && i < 9999) i++;
  return i;
}

// Anzahl vorhandener Skizzen
function bskCount(pairId, phase) {
  const all = loadAllBskSkizzen();
  let count = 0;
  while (all[bskKey(pairId, phase, count + 1)] && count < 9999) count++;
  return count;
}

function openBegehungSkizze(pairId, bgImageDataUrl, idx) {
  _bskPairId = pairId;
  _bskPhase  = _activePhase;
  _bskIndex  = idx || (bgImageDataUrl ? bskNextIndex(pairId, _activePhase) : 1);
  const pair = PAIRS.find(p => p.id === pairId) || {};
  const count = bskCount(pairId, _activePhase);
  const view = document.getElementById('beg-skizze-view');
  view.style.display = 'flex';
  _bskActivatePaste();

  const title = document.getElementById('beg-skizze-title');
  const phaseLabel = PHASEN_CONFIG[_activePhase]?.label || _activePhase;
  if (title) title.textContent = `Mast ${pair.mast || pairId} · ${phaseLabel} · Skizze ${_bskIndex}${count > 1 ? ' / ' + count : ''}`;

  const all = loadAllBskSkizzen();
  const d   = all[bskKey(pairId, _activePhase, _bskIndex)];
  _bskStrokes = d?.strokes || [];
  _bskHistory = [];
  _bskHasBg   = false;
  _bskBgRect  = null;

  setTimeout(() => {
    bskInitCanvas();
    if (d && !d.blatt) _bskAltdatenZentrieren();
    bskRedraw();
    // Hintergrundbild: entweder neu übergeben oder gespeichertes wiederherstellen
    const bgSrc = bgImageDataUrl || d?.bgData || null;
    if (bgSrc) {
      if (d?.bgOpacity !== undefined) _bskBgOpacity = d.bgOpacity;
      const ausSpeicher = !bgImageDataUrl;
      const img = new Image();
      img.onload = () => {
        // Altbestand: leere Skizzen wurden als schwarzes JPEG gesichert. Ein
        // solcher «Hintergrund» wird verworfen statt grau eingeblendet.
        if (ausSpeicher && _bskIstSchwarzflaeche(img)) return;
        _bskBgZeichnen(img);
        const opBtn = document.getElementById('bsk-opacity-preview');
        if (opBtn) opBtn.textContent = Math.round(_bskBgOpacity * 100) + '%';
      };
      img.src = bgSrc;
    }
  }, 80);
}

// Ist das Bild durchgehend schwarz? Erkennt Hintergründe aus dem Altbestand,
// die aus einem leeren, transparenten Canvas als JPEG entstanden sind. Ein
// echtes Bauwerksfoto wird nie flächig schwarz; im Zweifel entfällt nur der
// Hintergrund, die Zeichnung bleibt.
function _bskIstSchwarzflaeche(bild) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const ctx = c.getContext('2d');
  ctx.drawImage(bild, 0, 0, 16, 16);
  const d = ctx.getImageData(0, 0, 16, 16).data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 12 || d[i+1] > 12 || d[i+2] > 12) return false;
  }
  return true;
}

// Hintergrundbild mittig auf das Blatt zeichnen, eingepasst in den sichtbaren
// Ausschnitt — nicht auf das ganze, grössere Blatt: sonst wäre bei Zoom 1 nur
// ein Viertel des Bildes zu sehen.
function _bskBgZeichnen(bild) {
  const bgCanvas = document.getElementById('bsk-bg-canvas');
  if (!bgCanvas || !bgCanvas.width || !bild.width) return;
  const f = Math.min(_bskView.w / bild.width, _bskView.h / bild.height);
  const w = Math.round(bild.width  * f);
  const h = Math.round(bild.height * f);
  const x = Math.round((bgCanvas.width  - w) / 2);
  const y = Math.round((bgCanvas.height - h) / 2);
  const ctx = bgCanvas.getContext('2d');
  ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  ctx.drawImage(bild, x, y, w, h);
  bgCanvas.style.opacity = _bskBgOpacity;
  _bskHasBg  = true;
  _bskBgRect = { x, y, w, h };
}

// Skizzen aus der Zeit vor dem grösseren Blatt liegen im Ursprung oben links.
// Einmalig auf die Blattmitte schieben, wo der Ausschnitt jetzt beginnt.
function _bskAltdatenZentrieren() {
  const dc = document.getElementById('bsk-draw-canvas');
  if (!dc || !_bskStrokes.length) return;
  const dx = (dc.width  - _bskView.w) / 2;
  const dy = (dc.height - _bskView.h) / 2;
  if (dx <= 0 && dy <= 0) return;
  _bskStrokes = _bskStrokes.map(s => ({
    ...s,
    points: (s.points || []).map(p => ({ ...p, x: p.x + dx, y: p.y + dy })),
  }));
}

// Screenshot der aktuellen Detailkarte als Skizzen-Hintergrund
function openFotoAsSkizzeBackground() {
  const pd = getPairData(currentPairId);
  const fotos = (pd.fotos || []).filter(f => (f.phase || 'baugrund') === _activePhase);

  if (fotos.length === 0) {
    ui.toast('Keine Fotos für diese Phase vorhanden. Bitte zuerst Fotos hinzufügen.', 'fehler');
    return;
  }

  // Falls nur ein Foto: direkt öffnen
  if (fotos.length === 1) {
    const nextIdx = bskNextIndex(currentPairId, _activePhase);
    openBegehungSkizze(currentPairId, fotos[0].data, nextIdx);
    return;
  }

  // Mehrere Fotos: Auswahl-Popup
  const existing = document.getElementById('foto-picker-popup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'foto-picker-popup';
  popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9000;background:white;border-radius:12px;padding:16px;box-shadow:0 8px 32px rgba(0,0,0,0.25);max-width:320px;width:90%;';
  popup.innerHTML = `
    <div style="font-size:13px;font-weight:700;color:#1a3a5c;margin-bottom:10px;">Foto als Hintergrund wählen</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;" id="foto-picker-grid"></div>
    <button onclick="document.getElementById('foto-picker-popup').remove()"
      style="width:100%;padding:8px;border-radius:8px;border:1px solid #e5e7eb;background:#f9fafb;font-size:12px;cursor:pointer;color:#374151;">Abbrechen</button>`;
  document.body.appendChild(popup);

  const grid = popup.querySelector('#foto-picker-grid');
  fotos.forEach((f, i) => {
    const img = document.createElement('img');
    img.src = fotoSrc(f);
    img.style.cssText = 'width:80px;height:60px;object-fit:cover;border-radius:6px;border:2px solid #e5e7eb;cursor:pointer;';
    img.onclick = () => {
      popup.remove();
      const nextIdx = bskNextIndex(currentPairId, _activePhase);
      openBegehungSkizze(currentPairId, fotoSrc(f), nextIdx);
    };
    grid.appendChild(img);
  });
}

async function captureMapScreenshot() {
  const mapEl = document.getElementById('map');
  if (!mapEl || typeof html2canvas === 'undefined') {
    ui.toast('Screenshot nicht verfügbar.', 'fehler'); return;
  }
  try {
    const canvas = await html2canvas(mapEl, { useCORS: true, allowTaint: true, scale: 1 });
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const nextIdx = bskNextIndex(currentPairId, _activePhase);
    openBegehungSkizze(currentPairId, dataUrl, nextIdx);
  } catch(e) {
    ui.toast('Screenshot fehlgeschlagen: ' + e.message, 'fehler');
  }
}

function closeBegehungSkizze() {
  bskSave();
  _bskDeactivatePaste();
  document.getElementById('beg-skizze-view').style.display = 'none';
  if (_bskMap) { _bskMap.remove(); _bskMap = null; }
  const picker = document.getElementById('bsk-map-picker');
  if (picker) picker.style.display = 'none';
  renderSkizzeThumbs();
}

function renderSkizzeThumbs() {
  const wrap = document.getElementById('skizze-thumbs-wrap');
  if (!wrap || !currentPairId) return;
  const all = loadAllBskSkizzen();
  const phases = ['baugrund','bauprojekt','ausfuehrung'];
  const labels = { baugrund:'Baugrund', bauprojekt:'Bauprojekt', ausfuehrung:'Ausführung' };
  let html = '';

  phases.forEach(phase => {
    let i = 1;
    while (all[bskKey(currentPairId, phase, i)]) {
      const d = all[bskKey(currentPairId, phase, i)];
      const idx = i;
      const phLabel = labels[phase];
      html += `<div style="position:relative;display:inline-block;margin:4px;">
        <img src="${d.thumb || ''}" style="width:72px;height:56px;object-fit:cover;border-radius:6px;border:2px solid #e5e7eb;cursor:pointer;background:#f3f4f6;"
          onclick="openBegehungSkizzeForPhase('${phase}',${idx})" title="${phLabel} · Skizze ${idx}">
        <div style="position:absolute;bottom:3px;left:3px;background:rgba(26,58,92,0.75);color:white;font-size:8px;font-weight:700;padding:1px 4px;border-radius:3px;">${phLabel} ${idx}</div>
        <button onclick="bskDelete('${phase}',${idx})"
          style="position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:50%;border:none;background:#ef4444;color:white;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;">×</button>
      </div>`;
      i++;
    }
  });

  // + Neue Skizze Button
  html += `<div style="display:inline-block;margin:4px;vertical-align:top;">
    <button onclick="openBegehungSkizze(currentPairId,null,bskNextIndex(currentPairId,_activePhase))"
      style="width:72px;height:56px;border-radius:6px;border:2px dashed #d1d5db;background:#f9fafb;color:#9ca3af;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;">+</button>
  </div>`;

  wrap.innerHTML = html;
  wrap.style.display = '';
}

function openBegehungSkizzeForPhase(phase, idx) {
  // Temporär Phase setzen damit openBegehungSkizze korrekt lädt
  const prevPhase = _activePhase;
  _activePhase = phase;
  openBegehungSkizze(currentPairId, null, idx);
  _activePhase = prevPhase; // Sidebar-Phase bleibt unverändert
}

async function bskDelete(phase, idx) {
  if (!await ui.confirm('Skizze löschen?')) return;
  const all = loadAllBskSkizzen();
  // Löschen und neu nummerieren
  delete all[bskKey(currentPairId, phase, idx)];
  // Nachfolgende verschieben
  let i = idx + 1;
  while (all[bskKey(currentPairId, phase, i)]) {
    all[bskKey(currentPairId, phase, i - 1)] = all[bskKey(currentPairId, phase, i)];
    delete all[bskKey(currentPairId, phase, i)];
    i++;
  }
  saveAllBskSkizzen(all);
  renderSkizzeThumbs();
}

// Umschliessendes Rechteck des Inhalts. Das Blatt ist grösser als der Inhalt,
// darum werden Vorschau und Export darauf zugeschnitten.
function _bskInhaltsBox(blattB, blattH) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  _bskStrokes.forEach(s => (s.points || []).forEach(p => {
    const r = (s.size || 4) / 2 + 2;
    if (p.x - r < x0) x0 = p.x - r;
    if (p.y - r < y0) y0 = p.y - r;
    if (p.x + r > x1) x1 = p.x + r;
    if (p.y + r > y1) y1 = p.y + r;
  }));
  if (_bskHasBg && _bskBgRect) {
    x0 = Math.min(x0, _bskBgRect.x);
    y0 = Math.min(y0, _bskBgRect.y);
    x1 = Math.max(x1, _bskBgRect.x + _bskBgRect.w);
    y1 = Math.max(y1, _bskBgRect.y + _bskBgRect.h);
  }
  if (!isFinite(x0)) {                      // leere Skizze: Startausschnitt
    x0 = (blattB - _bskView.w) / 2; y0 = (blattH - _bskView.h) / 2;
    x1 = x0 + _bskView.w;           y1 = y0 + _bskView.h;
  }
  const rand = 12;
  x0 = Math.max(0, Math.floor(x0 - rand));   y0 = Math.max(0, Math.floor(y0 - rand));
  x1 = Math.min(blattB, Math.ceil(x1 + rand)); y1 = Math.min(blattH, Math.ceil(y1 + rand));
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

// Weisser Grund + Hintergrundbild + Zeichnung auf ein Canvas, zugeschnitten
// auf den Inhalt. Basis für Vorschaubild und Export.
function _bskFlachbild() {
  const bgCanvas   = document.getElementById('bsk-bg-canvas');
  const drawCanvas = document.getElementById('bsk-draw-canvas');
  if (!drawCanvas || !drawCanvas.width) return null;
  const box = _bskInhaltsBox(drawCanvas.width, drawCanvas.height);
  const out = document.createElement('canvas');
  out.width  = box.w;
  out.height = box.h;
  const ctx = out.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, box.w, box.h);
  if (_bskHasBg && bgCanvas) {
    ctx.globalAlpha = _bskBgOpacity;
    ctx.drawImage(bgCanvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    ctx.globalAlpha = 1;
  }
  ctx.drawImage(drawCanvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  return out;
}

function bskSave() {
  if (!_bskPairId) return;
  const all = loadAllBskSkizzen();
  const key = bskKey(_bskPairId, _bskPhase, _bskIndex);
  const drawCanvas = document.getElementById('bsk-draw-canvas');

  const flach = _bskFlachbild();
  const thumb = flach ? flach.toDataURL('image/jpeg', 0.6) : null;

  // Nur ein tatsächlich vorhandenes Hintergrundbild sichern, und nur dessen
  // Fläche. Ein leeres Canvas ist transparent und wird als JPEG schwarz — das
  // erschien beim Wiederöffnen als grauer Hintergrund.
  let bgData = null;
  if (_bskHasBg && _bskBgRect) {
    const bgCanvas = document.getElementById('bsk-bg-canvas');
    const teil = document.createElement('canvas');
    teil.width  = _bskBgRect.w;
    teil.height = _bskBgRect.h;
    teil.getContext('2d').drawImage(bgCanvas, _bskBgRect.x, _bskBgRect.y, _bskBgRect.w, _bskBgRect.h,
                                              0, 0, _bskBgRect.w, _bskBgRect.h);
    try { bgData = teil.toDataURL('image/jpeg', 0.7); } catch(e) {}
  }

  all[key] = {
    strokes: _bskStrokes, thumb, bgData, bgOpacity: _bskBgOpacity,
    blatt: drawCanvas ? { w: drawCanvas.width, h: drawCanvas.height } : null,
  };
  saveAllBskSkizzen(all);
}

function bskInitCanvas() {
  const bgCanvas   = document.getElementById('bsk-bg-canvas');
  const drawCanvas = document.getElementById('bsk-draw-canvas');
  const wrap       = document.getElementById('bsk-canvas-wrap');
  const scrollWrap = document.getElementById('bsk-scroll-wrap');
  if (!bgCanvas || !drawCanvas || !wrap || !scrollWrap) return;

  _bskView = {
    w: scrollWrap.offsetWidth  || window.innerWidth,
    h: scrollWrap.offsetHeight || (window.innerHeight - 120),
  };
  const W = Math.round(_bskView.w * BSK_BLATT_FAKTOR);
  const H = Math.round(_bskView.h * BSK_BLATT_FAKTOR);
  wrap.style.width  = W + 'px';
  wrap.style.height = H + 'px';
  bgCanvas.width    = W; bgCanvas.height = H;
  drawCanvas.width  = W; drawCanvas.height = H;

  bskResetView();
  _bskBindCanvasEvents(drawCanvas, scrollWrap);

  const hint = document.getElementById('bsk-hint');
  if (hint) hint.style.opacity = '1';
  setTimeout(() => { if (hint) hint.style.opacity = '0'; }, 3000);

  bskRedraw();
}

// Ausschnitt auf die Blattmitte stellen
function bskResetView() {
  const dc = document.getElementById('bsk-draw-canvas');
  if (!dc) return;
  _bskPan = { x: -(dc.width - _bskView.w) / 2, y: -(dc.height - _bskView.h) / 2, scale: 1 };
  _bskAnsichtAnwenden();
}

// Verschiebung begrenzen, damit das Blatt den Ausschnitt nie ganz verlässt
function _bskPanBegrenzen() {
  const dc = document.getElementById('bsk-draw-canvas');
  if (!dc) return;
  const bw = dc.width  * _bskPan.scale;
  const bh = dc.height * _bskPan.scale;
  _bskPan.x = Math.min(_bskView.w / 2, Math.max(_bskView.w / 2 - bw, _bskPan.x));
  _bskPan.y = Math.min(_bskView.h / 2, Math.max(_bskView.h / 2 - bh, _bskPan.y));
}

function _bskAnsichtAnwenden() {
  const wrap = document.getElementById('bsk-canvas-wrap');
  if (!wrap) return;
  _bskPanBegrenzen();
  wrap.style.transform = `translate(${_bskPan.x}px,${_bskPan.y}px) scale(${_bskPan.scale})`;
}

// Die Canvas-Elemente stehen fest im Markup und werden nie ersetzt. Würde man
// hier bei jedem Öffnen erneut binden, liefen die Touch-Handler mehrfach: die
// Punkte eines Strichs vervielfachten sich und jede Closure führte einen
// eigenen Zoom-Stand mit.
function _bskBindCanvasEvents(drawCanvas, scrollWrap) {
  if (_bskEventsGebunden) return;
  _bskEventsGebunden = true;

  let lastTouches = null;

  // Koordinaten + Druck im Canvas-Space
  const getCanvasPos = (clientX, clientY, pressure) => {
    const rect = drawCanvas.getBoundingClientRect();
    const pos = {
      x: (clientX - rect.left) * (drawCanvas.width  / rect.width),
      y: (clientY - rect.top)  * (drawCanvas.height / rect.height)
    };
    if (pressure !== undefined) pos.p = pressure > 0 ? pressure : 0.5;
    return pos;
  };

  // Palm Rejection: Touch blockieren wenn S-Pen aktiv
  let _bskActivePenId = null;

  // Touch-Handler
  drawCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (_bskActivePenId !== null) return; // Palm rejection
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const prs = t.force > 0 ? t.force : undefined; // force = pressure auf iOS/Stylus
      const pos = getCanvasPos(t.clientX, t.clientY, prs);
      if (_bskTool === 'eraser') {
        bskErase(pos);
      } else {
        _bskDrawing = true;
        _bskCurStroke = { color: _bskColor, size: _bskSize, points: [pos] };
      }
    } else if (e.touches.length === 2) {
      _bskDrawing = false;
      _bskCurStroke = null;
      lastTouches = [...e.touches].map(t => ({ x: t.clientX, y: t.clientY }));
    }
  }, { passive: false });

  drawCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (_bskActivePenId !== null) return; // Palm rejection
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const prs = t.force > 0 ? t.force : undefined;
      const pos = getCanvasPos(t.clientX, t.clientY, prs);
      if (_bskTool === 'eraser') {
        bskErase(pos);
      } else if (_bskDrawing && _bskCurStroke) {
        _bskCurStroke.points.push(pos);
        bskRedrawLive();
      }
    } else if (e.touches.length === 2 && lastTouches) {
      const t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const t1 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
      const prev0 = lastTouches[0], prev1 = lastTouches[1];

      // Zoom
      const prevDist = Math.hypot(prev1.x - prev0.x, prev1.y - prev0.y);
      const currDist = Math.hypot(t1.x - t0.x, t1.y - t0.y);
      const dScale = currDist / (prevDist || 1);
      const newScale = Math.max(0.4, Math.min(4, _bskPan.scale * dScale));

      // Pan (Mittelpunkt-Verschiebung)
      const prevMid = { x: (prev0.x + prev1.x) / 2, y: (prev0.y + prev1.y) / 2 };
      const currMid = { x: (t0.x + t1.x) / 2, y: (t0.y + t1.y) / 2 };

      // Zoom um Mittelpunkt
      const rect = scrollWrap.getBoundingClientRect();
      const ox = currMid.x - rect.left;
      const oy = currMid.y - rect.top;
      _bskPan.x = ox + (_bskPan.x - ox) * (newScale / _bskPan.scale) + (currMid.x - prevMid.x);
      _bskPan.y = oy + (_bskPan.y - oy) * (newScale / _bskPan.scale) + (currMid.y - prevMid.y);
      _bskPan.scale = newScale;
      _bskAnsichtAnwenden();
      lastTouches = [t0, t1];
    }
  }, { passive: false });

  drawCanvas.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) lastTouches = null;
    if (_bskActivePenId !== null) return; // Palm rejection
    if (!_bskDrawing) return;
    _bskDrawing = false;
    if (_bskCurStroke && _bskCurStroke.points.length > 1) {
      _bskHistory.push([..._bskStrokes]);
      _bskStrokes.push(_bskCurStroke);
      bskSave();
    }
    _bskCurStroke = null;
    bskRedraw();
  }, { passive: false });

  // Pointer-Handler für Desktop + Stift (mit Pointer Capture + Palm Rejection)
  drawCanvas.onpointerdown = (e) => {
    if (e.pointerType === 'touch') return; // Touch via touchstart handled
    // Mittlere Maustaste verschiebt das Blatt
    if (e.button === 1) {
      e.preventDefault();
      _bskPanZieh = { x: e.clientX, y: e.clientY };
      try { drawCanvas.setPointerCapture(e.pointerId); } catch(_) {}
      return;
    }
    if (e.pointerType === 'pen') _bskActivePenId = e.pointerId;
    try { drawCanvas.setPointerCapture(e.pointerId); } catch(_) {}
    const prs = e.pressure > 0 ? e.pressure : 0.5;
    const pos = getCanvasPos(e.clientX, e.clientY, prs);
    if (_bskTool === 'eraser') {
      _bskDrawing = true;
      bskErase(pos);
    } else {
      _bskDrawing = true;
      _bskCurStroke = { color: _bskColor, size: _bskSize, points: [pos] };
    }
  };
  drawCanvas.onpointermove = (e) => {
    if (e.pointerType === 'touch') return;
    if (_bskPanZieh) {
      _bskPan.x += e.clientX - _bskPanZieh.x;
      _bskPan.y += e.clientY - _bskPanZieh.y;
      _bskPanZieh = { x: e.clientX, y: e.clientY };
      _bskAnsichtAnwenden();
      return;
    }
    if (!_bskDrawing) return;
    const prs = e.pressure > 0 ? e.pressure : 0.5;
    // Coalesced Events für glatte Stiftspur
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
    for (const ce of events) {
      const pos = getCanvasPos(ce.clientX, ce.clientY, ce.pressure > 0 ? ce.pressure : prs);
      if (_bskTool === 'eraser') {
        bskErase(pos);
      } else if (_bskCurStroke) {
        _bskCurStroke.points.push(pos);
        bskRedrawLive();
      }
    }
  };
  drawCanvas.onpointerup = (e) => {
    if (e.pointerType === 'touch') return;
    if (_bskPanZieh) { _bskPanZieh = null; return; }
    if (e.pointerType === 'pen') _bskActivePenId = null;
    if (!_bskDrawing) return;
    _bskDrawing = false;
    if (_bskTool !== 'eraser' && _bskCurStroke && _bskCurStroke.points.length > 1) {
      _bskHistory.push([..._bskStrokes]);
      _bskStrokes.push(_bskCurStroke);
      bskSave();
    }
    _bskCurStroke = null;
    bskRedraw();
  };
  drawCanvas.onpointercancel = (e) => {
    if (e.pointerType === 'pen') _bskActivePenId = null;
    _bskPanZieh = null;
    _bskDrawing = false;
    _bskCurStroke = null;
    bskRedraw();
  };

  // Ohne Touchscreen liesse sich das Blatt sonst nicht bewegen: Scrollen
  // verschiebt, Strg+Scrollen zoomt (das sendet auch die Trackpad-Geste).
  scrollWrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const rect = scrollWrap.getBoundingClientRect();
      const ox = e.clientX - rect.left;
      const oy = e.clientY - rect.top;
      const neu = Math.max(0.4, Math.min(4, _bskPan.scale * (1 - e.deltaY * 0.002)));
      _bskPan.x = ox + (_bskPan.x - ox) * (neu / _bskPan.scale);
      _bskPan.y = oy + (_bskPan.y - oy) * (neu / _bskPan.scale);
      _bskPan.scale = neu;
    } else {
      _bskPan.x -= e.deltaX;
      _bskPan.y -= e.deltaY;
    }
    _bskAnsichtAnwenden();
  }, { passive: false });
}

function bskRedraw() {
  const drawCanvas = document.getElementById('bsk-draw-canvas');
  if (!drawCanvas) return;
  const ctx = drawCanvas.getContext('2d');
  ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  _bskStrokes.forEach(s => bskDrawStroke(ctx, s));
}

function bskRedrawLive() {
  bskRedraw();
  if (!_bskCurStroke) return;
  const ctx = document.getElementById('bsk-draw-canvas').getContext('2d');
  bskDrawStroke(ctx, _bskCurStroke);
}

function bskDrawStroke(ctx, s) {
  if (!s.points || s.points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.globalCompositeOperation = 'source-over';

  const hasPressure = s.points.some(p => p.p !== undefined);

  if (hasPressure) {
    // Druckabhängig: lineTo pro Segment (±10%)
    for (let i = 1; i < s.points.length; i++) {
      const prs = ((s.points[i-1].p ?? 0.5) + (s.points[i].p ?? 0.5)) / 2;
      ctx.lineWidth = s.size * (0.9 + prs * 0.2);
      ctx.beginPath();
      ctx.moveTo(s.points[i-1].x, s.points[i-1].y);
      ctx.lineTo(s.points[i].x,   s.points[i].y);
      ctx.stroke();
    }
  } else {
    // Catmull-Rom Spline — identisch zur Detailansicht
    ctx.lineWidth = s.size;
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 0; i < s.points.length - 1; i++) {
      const p0 = s.points[i > 0 ? i - 1 : 0];
      const p1 = s.points[i];
      const p2 = s.points[i + 1];
      const p3 = s.points[i + 2 < s.points.length ? i + 2 : s.points.length - 1];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function bskErase(pos) {
  const threshold = _bskSize * 5 + 20;
  const before = _bskStrokes.length;
  _bskStrokes = _bskStrokes.filter(s =>
    !s.points.some(p => Math.hypot(p.x - pos.x, p.y - pos.y) < threshold)
  );
  if (_bskStrokes.length !== before) { bskRedraw(); bskSave(); }
}

function bskUndo() {
  if (_bskHistory.length === 0) return;
  _bskStrokes = _bskHistory.pop();
  bskRedraw();
  bskSave();
}

function bskSetTool(tool) {
  _bskTool = tool;
  const drawCanvas = document.getElementById('bsk-draw-canvas');
  if (drawCanvas) drawCanvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
  const penBtn    = document.getElementById('bsk-btn-pen');
  const eraserBtn = document.getElementById('bsk-btn-eraser');
  if (penBtn)    penBtn.classList.toggle('active',    tool === 'pen');
  if (eraserBtn) eraserBtn.classList.toggle('active', tool === 'eraser');
}

function bskToggleColorPicker() {
  const picker = document.getElementById('bsk-color-picker');
  if (!picker) return;
  const isOpen = picker.style.display === 'flex';
  // Alle Picker schliessen
  ['bsk-color-picker','bsk-opacity-picker'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  if (!isOpen) picker.style.display = 'flex';
}

function bskSetBrushSize(step, px) {
  _bskSize = px;
  [1,2,3,4].forEach(s => {
    const btn = document.getElementById('bsk-size-btn-' + s);
    if (btn) btn.classList.toggle('active', s === step);
  });
}

function bskToggleOpacityPicker() {
  const picker = document.getElementById('bsk-opacity-picker');
  if (!picker) return;
  const isOpen = picker.style.display === 'flex';
  ['bsk-color-picker','bsk-opacity-picker'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  if (!isOpen) picker.style.display = 'flex';
}

function bskSelectOpacity(val) {
  bskSetBgOpacity(val);
  const preview = document.getElementById('bsk-opacity-preview');
  if (preview) preview.textContent = val + '%';
  document.getElementById('bsk-opacity-picker').style.display = 'none';
}

function bskSetColor(color, btnId) {
  _bskColor = color;
  _bskTool  = 'pen';
  bskSetTool('pen');
  // Farb-Button aktualisieren
  const btn = document.getElementById('bsk-color-btn');
  if (btn) btn.style.background = color;
  // Picker schliessen
  const picker = document.getElementById('bsk-color-picker');
  if (picker) picker.style.display = 'none';
}

function bskSetSize(val) {
  _bskSize = parseInt(val);
}

function bskSetBgOpacity(val) {
  _bskBgOpacity = val / 100;
  const bgCanvas = document.getElementById('bsk-bg-canvas');
  if (bgCanvas) bgCanvas.style.opacity = _bskBgOpacity;
}

// Kartenausschnitt — Picker öffnen
function bskSetBgMap() {
  const picker = document.getElementById('bsk-map-picker');
  picker.style.display = 'flex';
  picker.style.flexDirection = 'column';

  // Leaflet-Karte initialisieren
  const container = document.getElementById('bsk-map-container');
  container.innerHTML = '<div id="bsk-map-inner" style="width:100%;height:100%;"></div>';

  if (_bskMap) { _bskMap.remove(); _bskMap = null; }

  const pair   = PAIRS.find(p => p.id === _bskPairId);
  const center = (pair?.rs?.e && pair?.rs?.n)
    ? lv95ToWgs84(pair.rs.e, pair.rs.n)
    : (pair?.rks?.e && pair?.rks?.n)
      ? lv95ToWgs84(pair.rks.e, pair.rks.n)
      : { lat: 47.566, lng: 9.106 };

  setTimeout(() => {
    _bskMap = L.map('bsk-map-inner', KARTE_DREH_OPT).setView([center.lat, center.lng], 18);
    karteDrehungAnmelden(_bskMap);
    makeTile(detailBaseLayerKey || 'swiss-luft').addTo(_bskMap);

    // Transparenter Marker für Standort
    if (pair) {
      const icon = L.divIcon({
        html: `<div style="width:24px;height:24px;border-radius:50%;border:3px solid rgba(26,58,92,0.7);background:rgba(26,58,92,0.25);"></div>`,
        iconSize: [24,24], iconAnchor: [12,12], className: ''
      });
      L.marker([center.lat, center.lng], { icon }).addTo(_bskMap);
    }
  }, 100);
}

// Kartenausschnitt aufnehmen
async function bskCaptureMap() {
  const mapEl = document.getElementById('bsk-map-inner');
  if (!mapEl || typeof html2canvas === 'undefined') {
    ui.toast('Kartenaufnahme nicht verfügbar.', 'fehler'); return;
  }
  try {
    const canvas = await html2canvas(mapEl, { useCORS: true, allowTaint: true, scale: 1 });
    _bskBgZeichnen(canvas);
    bskSave();
  } catch(e) {
    ui.toast('Kartenaufnahme fehlgeschlagen: ' + e.message, 'fehler');
  }
  document.getElementById('bsk-map-picker').style.display = 'none';
  if (_bskMap) { _bskMap.remove(); _bskMap = null; }
}

// Foto als Hintergrund laden
// Gemeinsame Hilfsfunktion: Blob/File als Hintergrundbild laden
// Das Blatt behält seine Grösse — früher wurde es an das Bild angepasst, wobei
// bereits gezeichnete Striche ihre Pixelkoordinaten behielten und dadurch
// verrutschten.
function bskLoadImageFromBlob(blob) {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    _bskBgZeichnen(img);
    bskSave();
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function bskLoadFoto(input) {
  const file = input.files[0];
  if (!file) return;
  bskLoadImageFromBlob(file);
  input.value = '';
}

// Paste-Handler: aktiv während Skizze offen ist
let _bskPasteHandler = null;

function _bskActivatePaste() {
  _bskDeactivatePaste();
  _bskPasteHandler = e => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) { bskLoadImageFromBlob(blob); e.preventDefault(); return; }
      }
    }
  };
  document.addEventListener('paste', _bskPasteHandler);
}

function _bskDeactivatePaste() {
  if (_bskPasteHandler) {
    document.removeEventListener('paste', _bskPasteHandler);
    _bskPasteHandler = null;
  }
}

// Paste-Button: versucht navigator.clipboard.read(), Fallback zeigt Hinweis
async function bskPasteBtn() {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imgType = item.types.find(t => t.startsWith('image/'));
      if (imgType) {
        const blob = await item.getType(imgType);
        bskLoadImageFromBlob(blob);
        return;
      }
    }
    ui.toast('Kein Bild in der Zwischenablage.', 'fehler');
  } catch {
    // Clipboard-API nicht erlaubt → Hinweis
    const hint = document.getElementById('bsk-paste-hint');
    if (hint) { hint.style.opacity = '1'; setTimeout(() => { hint.style.opacity = '0'; }, 2500); }
  }
}

// Hintergrund entfernen
function bskClearBg() {
  const bgCanvas = document.getElementById('bsk-bg-canvas');
  if (bgCanvas) {
    bgCanvas.getContext('2d').clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  }
  _bskHasBg  = false;
  _bskBgRect = null;
  bskSave();
}

// Als Bild exportieren (Hintergrund + Zeichnung kombiniert)
function bskExport() {
  const out = _bskFlachbild();
  if (!out) return;

  const pair = PAIRS.find(p => p.id === _bskPairId) || {};
  const datum = new Date().toLocaleDateString('de-CH').replace(/\./g,'-');
  const a = document.createElement('a');
  a.download = `Skizze_Mast${pair.mast||_bskPairId}_${datum}.png`;
  a.href = out.toDataURL('image/png');
  a.click();
}

function toggleKontaktSection() {
  const body    = document.getElementById('kontakt-section-body');
  const chevron = document.getElementById('kontakt-chevron');
  if (!body) return;
  const collapsed = body.style.display === 'none';
  body.style.display      = collapsed ? '' : 'none';
  if (chevron) chevron.style.transform = collapsed ? '' : 'rotate(-90deg)';
}

// ── GIS-Abfrage Altlasten (KbS) ──────────────────────────────
// KbS-Layer haben keine GeoTable → kein Identify-Support.
// Stattdessen WMS GetFeatureInfo mit BBOX um den Standort.
// ch.bafu.kataster-belasteter-standorte-kbs existiert nicht als federaler Layer (kantonal)
// Verfügbare Bundes-KbS: öV (BAV), Zivilflugplätze (BAZL), Militär (VBS)
const GIS_ALTLASTEN_LAYERS = [
  { id: 'ch.bav.kataster-belasteter-standorte-oev',                  label: 'KbS öV (BAV)'       },
  { id: 'ch.bazl.kataster-belasteter-standorte-zivilflugplaetze',    label: 'KbS Flugplatz (BAZL)' },
  { id: 'ch.vbs.kataster-belasteter-standorte-militaer',             label: 'KbS Militär (VBS)'   },
];

async function queryGisAltlasten() {
  const resultEl = document.getElementById('ns-gis-altlasten');
  if (!resultEl) return;
  const pair = PAIRS.find(p => p.id === currentPairId);
  if (!pair?.rs?.e || !pair?.rs?.n) { resultEl.style.display = 'none'; return; }
  const e = pair.rs.e, n = pair.rs.n;
  resultEl.style.display = '';
  resultEl.innerHTML = '<span style="color:#9ca3af;">Wird abgefragt…</span>';

  const layerIds = GIS_ALTLASTEN_LAYERS.map(l => l.id).join(',');
  const baseParams = { geometryType: 'esriGeometryPoint', sr: '2056',
    layers: `all:${layerIds}`, returnGeometry: 'false', lang: 'de', geometry: `${e},${n}` };

  // Abfrage 1: Punkt exakt innerhalb einer KbS-Fläche
  const p1 = new URLSearchParams({ ...baseParams,
    mapExtent: `${e-5},${n-5},${e+5},${n+5}`, imageDisplay: '11,11,96', tolerance: '0' });
  // Abfrage 2: Innerhalb 50 m (Umgebung)
  const p2 = new URLSearchParams({ ...baseParams,
    mapExtent: `${e-50},${n-50},${e+50},${n+50}`, imageDisplay: '101,101,96', tolerance: '50' });

  try {
    const base = 'https://api.geo.admin.ch/rest/services/all/MapServer/identify?';
    const [r1, r2] = await Promise.all([fetch(base + p1), fetch(base + p2)]);
    const [d1, d2] = await Promise.all([
      r1.ok ? r1.json() : { results: [] },
      r2.ok ? r2.json() : { results: [] }
    ]);

    const insideIds = new Set((d1.results || []).map(r => r.id ?? `${r.layerBodId}-${r.featureId}`));

    const parseHits = (results, inside) => results.map(r => {
      const props = r.attributes || r.properties || {};
      const layerDef = GIS_ALTLASTEN_LAYERS.find(l => l.id === r.layerBodId);
      return {
        id: r.id ?? `${r.layerBodId}-${r.featureId}`,
        label:  layerDef?.label || r.layerBodId || '',
        name:   props.standortname || props.name || props.bezeichnung || '',
        status: props.statuscode   || props.status_de || props.zustand || '',
        inside
      };
    });

    // Treffer aus Query 2 deduplizieren; Query-1-Treffer gelten als "innerhalb"
    const allById = new Map();
    parseHits(d2.results || [], false).forEach(r => allById.set(r.id, r));
    parseHits(d1.results || [], true ).forEach(r => allById.set(r.id, r));
    const allResults = [...allById.values()];

    if (allResults.length === 0) { resultEl.style.display = 'none'; return; }

    const lines = allResults.map(({ label, name, status, inside }) => {
      const detail = [name, status].filter(Boolean).join(' — ');
      const dot   = inside ? '#dc2626' : '#f59e0b';
      const badge = inside
        ? '<span style="font-size:9px;background:#fee2e2;color:#b91c1c;border-radius:3px;padding:1px 4px;margin-left:4px;">innerhalb</span>'
        : '<span style="font-size:9px;background:#fef3c7;color:#92400e;border-radius:3px;padding:1px 4px;margin-left:4px;">Nähe &lt; 50 m</span>';
      return `<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:3px;">
        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${dot};margin-top:3px;flex-shrink:0;"></span>
        <span><strong>${label}</strong>${badge}${detail ? '<br><span style="font-size:10px;color:#6b7280;">' + detail + '</span>' : ''}</span>
      </div>`;
    });
    resultEl.innerHTML = `<div style="font-size:10px;color:#9ca3af;margin-bottom:5px;font-style:italic;">Quelle: geo.admin.ch — Zur Kontrolle ↗ Karte prüfen</div>` + lines.join('');

  } catch { resultEl.style.display = 'none'; }
}

function loadNaturschutzFelder(pairId) {
  const all = loadAllNaturschutz();
  const d = all[pairId] || {};
  const cb = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
  const v  = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  cb('ns-bln',       d.bln);
  cb('ns-nsg',       d.nsg);
  cb('ns-gewaesser', d.gewaesser);
  cb('ns-wald',      d.wald);
  cb('ns-andere',    d.andere);
  v('ns-andere-text',             d.andereText);
  v('ns-auflagen',                d.auflagen);
  v('ns-bewilligung-erforderlich',d.bewilligungErforderlich);
  v('ns-bewilligung-status',      d.bewilligungStatus);
  v('ns-bewilligung-link',        d.bewilligungLink);
  v('ns-bemerkung',               d.bemerkung);
  // Grundwasser
  v('ns-gw-kote',       d.gwKote);
  v('ns-gw-schwankung', d.gwSchwankung);
  v('ns-gw-massnahmen', d.gwMassnahmen);
  // Migration alter Einzelwerte auf neue zusammengefasste Optionen
  const GW_ZONE_MIG = { Au: 'AuAo', Ao: 'AuAo', Sh: 'andere', Sm: 'andere', GA: 'andere' };
  v('ns-gw-zone', GW_ZONE_MIG[d.gwZone] ?? d.gwZone);
  const noteEl = document.getElementById('ns-gw-zone-note');
  if (noteEl) noteEl.style.display = d.gwZone ? '' : 'none';
  _updateGwZoneStyle();
  _updateGwSpiegelStatus();
  // GIS-Kartenlinks mit aktuellen Koordinaten setzen
  const pair = PAIRS.find(p => p.id === pairId);
  if (pair?.rs?.e && pair?.rs?.n) updateGisMapLinks(pair.rs.e, pair.rs.n);
  updateNaturschutzUI();
}

function saveNaturschutz() {
  if (!currentPairId) return;
  const cb = id => { const el = document.getElementById(id); return el ? el.checked : false; };
  const v  = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const all = loadAllNaturschutz();
  all[currentPairId] = {
    bln:                    cb('ns-bln'),
    nsg:                    cb('ns-nsg'),
    gewaesser:              cb('ns-gewaesser'),
    wald:                   cb('ns-wald'),
    andere:                 cb('ns-andere'),
    andereText:             v('ns-andere-text'),
    auflagen:               v('ns-auflagen'),
    bewilligungErforderlich:v('ns-bewilligung-erforderlich'),
    bewilligungStatus:      v('ns-bewilligung-status'),
    bewilligungLink:        v('ns-bewilligung-link'),
    bemerkung:              v('ns-bemerkung'),
    // Grundwasser
    gwKote:       v('ns-gw-kote'),
    gwSchwankung: v('ns-gw-schwankung'),
    gwMassnahmen: v('ns-gw-massnahmen'),
    gwZone:       v('ns-gw-zone'),
  };
  saveAllNaturschutz(all);
  updateNaturschutzUI();
}

function updateNaturschutzUI() {
  // Sektion nur im Bauprojekt sichtbar
  const sec = document.getElementById('sec-naturschutz');
  if (sec) sec.style.display = _activePhase === 'bauprojekt' ? '' : 'none';

  // "Andere Schutzzone" Textfeld
  const andereChecked = document.getElementById('ns-andere')?.checked;
  const andereText = document.getElementById('ns-andere-text');
  if (andereText) andereText.style.display = andereChecked ? '' : 'none';

  // Bewilligungs-Status nur wenn erforderlich = ja
  const erforderlich = document.getElementById('ns-bewilligung-erforderlich')?.value;
  const statusWrap = document.getElementById('ns-bewilligung-status-wrap');
  if (statusWrap) statusWrap.style.display = erforderlich === 'ja' ? '' : 'none';

  // Bewilligungs-Icon
  const status = document.getElementById('ns-bewilligung-status')?.value;
  const icon   = document.getElementById('ns-bewilligung-icon');
  if (icon) {
    if (status === 'erteilt') {
      icon.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#16a34a;margin-left:4px;"></span>';
    } else if (status === 'verweigert') {
      icon.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#dc2626;margin-left:4px;"></span>';
    } else if (status === 'pendent') {
      icon.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f59e0b;margin-left:4px;"></span>';
    } else {
      icon.innerHTML = '';
    }
  }

  // Gesamturteil im Header
  const urteilEl = document.getElementById('ns-gesamturteil');
  if (!urteilEl) return;
  if (erforderlich === 'ja') {
    if (status === 'erteilt') {
      urteilEl.textContent = 'Erteilt'; urteilEl.style.background = '#dcfce7'; urteilEl.style.color = '#166534';
    } else if (status === 'verweigert') {
      urteilEl.textContent = 'Verweigert'; urteilEl.style.background = '#fee2e2'; urteilEl.style.color = '#b91c1c';
    } else if (status === 'pendent' || erforderlich === 'abklaerung') {
      urteilEl.textContent = 'Pendent'; urteilEl.style.background = '#fef3c7'; urteilEl.style.color = '#92400e';
    } else {
      urteilEl.textContent = 'Offen'; urteilEl.style.background = '#fef3c7'; urteilEl.style.color = '#92400e';
    }
  } else if (erforderlich === 'nein') {
    urteilEl.textContent = 'Keine Bewilligung'; urteilEl.style.background = '#f3f4f6'; urteilEl.style.color = '#6b7280';
  } else {
    urteilEl.textContent = '';
  }
}

const FUNDAMENTE_KEY = () => 'sp_fundamente__' + _activeId;

function loadFundamente() {
  try {
    const s = store.getItem(FUNDAMENTE_KEY());
    return s ? jsonParse(s) : [];
  } catch { return []; }
}

function saveFundamente(list) {
  store.setItem(FUNDAMENTE_KEY(), JSON.stringify(list));
}

let _fundamentFilter = 'alle';
let _editFundamentId = null;
let _fundamentFotosNew = []; // base64 fotos during edit

function setFundamentFilter(f, btn) {
  _fundamentFilter = f;
  renderFundamente();
}

function renderFundamente() {
  const grid = document.getElementById('fundamente-grid');
  if (!grid) return;
  let list = loadFundamente();

  if (_fundamentFilter !== 'alle') {
    list = list.filter(f => {
      if (_fundamentFilter === 'standard') return f.typ === 'standard';
      if (_fundamentFilter === 'spezial')  return f.typ === 'spezial';
      if (_fundamentFilter === 'begehung') return f.phase === 'begehung';
      if (_fundamentFilter === 'bau')      return f.phase === 'bau';
      if (_fundamentFilter === 'abnahme')  return f.phase === 'abnahme';
      return true;
    });
  }

  if (list.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:30px;text-align:center;color:#9ca3af;font-size:13px;">Noch keine Fundamente erfasst.<br><br><button onclick="openFundamentModal(null)" style="background:#1a3a5c;color:white;border:none;padding:8px 18px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;">+ Erstes Fundament erfassen</button></div>';
    return;
  }

  grid.innerHTML = list.map(f => {
    const typLabel = f.typ === 'standard'
      ? (f.standardTyp || '—')
      : (f.spezialTyp || 'Spezial');
    const typColor = f.typ === 'standard' ? '#2563eb' : '#d97706';
    const typBg    = f.typ === 'standard' ? '#eff6ff'  : '#fef3c7';
    const phaseMap = { begehung: 'Begehung', bau: 'Bau', abnahme: 'Abnahme' };
    const phaseLabel = phaseMap[f.phase] || '—';
    const bestandLabel = f.bestand === 'bestand' ? 'Bestand' : 'Neu';
    const abnStatus = f.phase === 'abnahme' && f.abnahme?.status
      ? ({ bestanden: svgIcon('haken',{groesse:11}) + ' Bestanden',
           mängel: svgIcon('warnung',{groesse:11}) + ' Mängel',
           'nicht bestanden': svgIcon('kreuz',{groesse:11}) + ' Nicht bestanden' }[f.abnahme.status] || '')
      : '';
    const fotoPreview = f.fotos && f.fotos.length
      ? `<img src="${f.fotos[0]}" style="width:100%;height:80px;object-fit:cover;border-radius:6px;margin-top:8px;">`
      : '';
    return `<div class="card" onclick="openFundamentModal('${f.id}')" style="border-left:4px solid ${typColor};">
      <div class="card-top">
        <div class="card-id">Mast ${f.mast || '—'}</div>
        <span style="font-size:10px;background:${typBg};color:${typColor};padding:2px 8px;border-radius:4px;font-weight:700;">${f.typ === 'standard' ? 'Standard' : 'Spezial'}</span>
      </div>
      <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:4px;">${typLabel}</div>
      ${f.km ? `<div class="card-km">KM ${parseFloat(f.km).toFixed(3)}</div>` : ''}
      ${f.bezeichnung ? `<div style="font-size:11px;color:#6b7280;margin-bottom:2px;">${f.bezeichnung}</div>` : ''}
      <div style="font-size:11px;color:#6b7280;margin-top:4px;display:flex;gap:8px;flex-wrap:wrap;">
        <span>${bestandLabel}</span>
        ${f.neigung ? `<span>${f.neigung}</span>` : ''}
      </div>
      ${fotoPreview}
      <div class="card-footer">
        <span style="font-size:11px;font-weight:600;color:#6b7280;">${phaseLabel}</span>
        ${abnStatus ? `<span style="font-size:11px;font-weight:700;">${abnStatus}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

let _currentFundamentPhase = 'begehung';
let _currentFundamentTyp   = 'standard';
let _currentHangneigung    = 'flach';

function openFundamentModal(id) {
  _editFundamentId = id;
  _fundamentFotosNew = [];
  const modal = document.getElementById('fundament-modal');
  modal.style.display = 'flex';

  // Reset
  ['f-mast','f-km','f-bezeichnung','f-beg-datum','f-beg-person','f-beg-zustand',
   'f-beg-bemerkung','f-bau-datum','f-bau-firma','f-bau-bemerkung',
   'f-bau-kopf','f-abn-datum','f-abn-bemerkung'].forEach(i => {
    const el = document.getElementById(i); if (el) el.value = '';
  });
  ['f-neigung','f-grundwasser','f-boden','f-bestand','f-standard-typ',
   'f-spezial-typ','f-bau-protokoll','f-abn-status'].forEach(i => {
    const el = document.getElementById(i); if (el) el.value = '';
  });
  document.getElementById('f-fotos-wrap').innerHTML = '';

  if (id) {
    // Edit mode
    document.getElementById('fundament-modal-title').textContent = 'Fundament bearbeiten';
    document.getElementById('f-delete-btn').style.display = '';
    const list = loadFundamente();
    const f = list.find(x => x.id === id);
    if (!f) return;
    document.getElementById('f-mast').value         = f.mast || '';
    document.getElementById('f-km').value           = f.km || '';
    document.getElementById('f-bezeichnung').value  = f.bezeichnung || '';
    document.getElementById('f-neigung').value      = f.neigung || '';
    document.getElementById('f-grundwasser').value  = f.grundwasser || '';
    document.getElementById('f-boden').value        = f.boden || '';
    document.getElementById('f-bestand').value      = f.bestand || 'neu';
    setFundamentTyp(f.typ || 'standard');
    setHangneigung(f.hangneigung || 'flach');
    if (f.typ === 'standard') document.getElementById('f-standard-typ').value = f.standardTyp || '';
    else document.getElementById('f-spezial-typ').value = f.spezialTyp || '';
    setFundamentPhase(f.phase || 'begehung');
    if (f.begehung) {
      document.getElementById('f-beg-datum').value    = f.begehung.datum || '';
      document.getElementById('f-beg-person').value   = f.begehung.person || '';
      document.getElementById('f-beg-zustand').value  = f.begehung.zustand || '';
      document.getElementById('f-beg-bemerkung').value= f.begehung.bemerkung || '';
    }
    if (f.bau) {
      document.getElementById('f-bau-datum').value    = f.bau.datum || '';
      document.getElementById('f-bau-firma').value    = f.bau.firma || '';
      document.getElementById('f-bau-protokoll').value= f.bau.protokoll || '';
      document.getElementById('f-bau-kopf').value     = f.bau.kopf || '';
      document.getElementById('f-bau-bemerkung').value= f.bau.bemerkung || '';
    }
    if (f.abnahme) {
      document.getElementById('f-abn-datum').value    = f.abnahme.datum || '';
      document.getElementById('f-abn-status').value   = f.abnahme.status || '';
      document.getElementById('f-abn-bemerkung').value= f.abnahme.bemerkung || '';
    }
    // Fotos
    if (f.fotos && f.fotos.length) {
      _fundamentFotosNew = [...f.fotos];
      renderFundamentFotoPreview();
    }
  } else {
    document.getElementById('fundament-modal-title').textContent = 'Fundament erfassen';
    document.getElementById('f-delete-btn').style.display = 'none';
    setFundamentTyp('standard');
    setHangneigung('flach');
    setFundamentPhase('begehung');
    document.getElementById('f-bestand').value = 'neu';
  }
}

function closeFundamentModal() {
  document.getElementById('fundament-modal').style.display = 'none';
  _editFundamentId = null;
  _fundamentFotosNew = [];
}

function setFundamentTyp(typ) {
  _currentFundamentTyp = typ;
  const isStd = typ === 'standard';
  document.getElementById('f-standard-section').style.display = isStd ? '' : 'none';
  document.getElementById('f-spezial-section').style.display  = isStd ? 'none' : '';
  document.getElementById('f-typ-standard-btn').classList.toggle('aktiv', isStd);
  document.getElementById('f-typ-spezial-btn').classList.toggle('aktiv', !isStd);
}

function setHangneigung(h) {
  _currentHangneigung = h;
  const isFlach = h === 'flach';
  document.getElementById('f-hang-flach-btn').classList.toggle('aktiv', isFlach);
  document.getElementById('f-hang-steil-btn').classList.toggle('aktiv', !isFlach);
  // Filter select options
  const sel = document.getElementById('f-standard-typ');
  Array.from(sel.options).forEach(o => {
    const grp = o.closest('optgroup');
    if (!grp) return;
    const isFlachGrp = grp.id === 'f-opt-flach';
    o.style.display = (isFlach && isFlachGrp) || (!isFlach && !isFlachGrp) ? '' : 'none';
  });
  sel.value = '';
}

function setFundamentPhase(phase) {
  _currentFundamentPhase = phase;
  ['begehung','bau','abnahme'].forEach(p => {
    const btn   = document.getElementById('f-phase-'+p+'-btn');
    const panel = document.getElementById('f-panel-'+p);
    if (!btn || !panel) return;
    const active = p === phase;
    btn.classList.toggle('aktiv', active);
    panel.style.display = active ? '' : 'none';
  });
}

function addFundamentFotos(input) {
  const files = Array.from(input.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      _fundamentFotosNew.push(e.target.result);
      renderFundamentFotoPreview();
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function renderFundamentFotoPreview() {
  const wrap = document.getElementById('f-fotos-wrap');
  wrap.innerHTML = _fundamentFotosNew.map((src, i) =>
    `<div style="position:relative;">
      <img src="${src}" style="width:70px;height:70px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;">
      <button onclick="removeFundamentFoto(${i})" style="position:absolute;top:-5px;right:-5px;background:#ef4444;color:white;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:1;">✕</button>
    </div>`
  ).join('');
}

function removeFundamentFoto(i) {
  _fundamentFotosNew.splice(i, 1);
  renderFundamentFotoPreview();
}

function saveFundament() {
  const list = loadFundamente();
  const id = _editFundamentId || ('f_' + Date.now());
  const entry = {
    id,
    mast:        document.getElementById('f-mast').value.trim(),
    km:          document.getElementById('f-km').value,
    bezeichnung: document.getElementById('f-bezeichnung').value.trim(),
    typ:         _currentFundamentTyp,
    hangneigung: _currentHangneigung,
    standardTyp: document.getElementById('f-standard-typ').value,
    spezialTyp:  document.getElementById('f-spezial-typ').value,
    neigung:     document.getElementById('f-neigung').value,
    grundwasser: document.getElementById('f-grundwasser').value,
    boden:       document.getElementById('f-boden').value,
    bestand:     document.getElementById('f-bestand').value,
    phase:       _currentFundamentPhase,
    begehung: {
      datum:     document.getElementById('f-beg-datum').value,
      person:    document.getElementById('f-beg-person').value.trim(),
      zustand:   document.getElementById('f-beg-zustand').value.trim(),
      bemerkung: document.getElementById('f-beg-bemerkung').value.trim(),
    },
    bau: {
      datum:     document.getElementById('f-bau-datum').value,
      firma:     document.getElementById('f-bau-firma').value.trim(),
      protokoll: document.getElementById('f-bau-protokoll').value,
      kopf:      document.getElementById('f-bau-kopf').value,
      bemerkung: document.getElementById('f-bau-bemerkung').value.trim(),
    },
    abnahme: {
      datum:     document.getElementById('f-abn-datum').value,
      status:    document.getElementById('f-abn-status').value,
      bemerkung: document.getElementById('f-abn-bemerkung').value.trim(),
    },
    fotos: [..._fundamentFotosNew],
    erstellt: _editFundamentId ? (list.find(x=>x.id===id)?.erstellt || new Date().toLocaleDateString('de-CH')) : new Date().toLocaleDateString('de-CH'),
    geaendert: new Date().toLocaleDateString('de-CH'),
  };

  if (_editFundamentId) {
    const idx = list.findIndex(x => x.id === _editFundamentId);
    if (idx >= 0) list[idx] = entry; else list.push(entry);
  } else {
    list.push(entry);
  }
  saveFundamente(list);
  closeFundamentModal();
  renderFundamente();
}

async function deleteFundament() {
  if (!_editFundamentId) return;
  if (!await ui.confirm('Fundament wirklich löschen?')) return;
  const list = loadFundamente().filter(x => x.id !== _editFundamentId);
  saveFundamente(list);
  closeFundamentModal();
  renderFundamente();
}

// Pointer- statt Maus-Ereignisse: dieselbe API liefert Maus, Stift und Finger.
// Mit 'mousemove'/'mouseup' liess sich der Gantt auf dem Tablet nicht bedienen —
// dort entstehen diese Ereignisse gar nicht oder erst nach dem Loslassen.
document.addEventListener('pointermove',   e => { bpResizeMove(e); bpMoveMove(e); bpFundMoveMove(e); bpMsMoveMove(e); });
document.addEventListener('pointerup',     e => { bpResizeEnd(e);  bpMoveEnd(e);  bpFundMoveEnd(e); bpMsMoveEnd(e); });
document.addEventListener('pointercancel', e => { bpResizeEnd(e);  bpMoveEnd(e);  bpFundMoveEnd(e); bpMsMoveEnd(e); });

// ============================================================
// PROTOKOLLE: einklappbare Sektionen
// ============================================================
const _protokolleCollapsed = { abnahme: false, aushub: true, bsp: true };

function toggleProtoSektion(key) {
  _protokolleCollapsed[key] = !_protokolleCollapsed[key];
  const body    = document.getElementById('proto-body-' + key);
  const chevron = document.getElementById('proto-chevron-' + key);
  if (!body) return;
  const collapsed = _protokolleCollapsed[key];
  body.style.display    = collapsed ? 'none' : 'block';
  if (chevron) chevron.style.transform = collapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
  // Lazy render für Aushub
  if (!collapsed && key === 'aushub') renderAushubView();
  if (!collapsed && key === 'bsp')    renderBspSection();
}

// ============================================================
// TERMINE: einklappbare Sektionen
// ============================================================
const _termineCollapsed = {};

function toggleTermineSektion(key) {
  _termineCollapsed[key] = !_termineCollapsed[key];
  const body    = document.getElementById('termine-body-' + key);
  const chevron = document.getElementById('termine-chevron-' + key);
  if (!body) return;
  body.style.display = _termineCollapsed[key] ? 'none' : '';
  if (chevron) chevron.style.transform = _termineCollapsed[key] ? 'rotate(-90deg)' : 'rotate(0deg)';
}

// ============================================================
// BAUSITZUNGSPROTOKOLLE (BSP)
// ============================================================
function loadBsp() {
  try { return jsonParse(store.getItem('sp_bsp__' + _activeId) || '[]'); } catch { return []; }
}
function saveBsp(data) {
  store.setItem('sp_bsp__' + _activeId, JSON.stringify(data));
}

const BSP_TEMPLATES = {
  standard: {
    label: 'Standard Bausitzung',
    traktanden: [
      '1. Protokollgenehmigung / Pendenzen',
      '2. Stand Bauarbeiten',
      '3. Qualitätskontrolle / Abnahmen',
      '4. Termine & Planung',
      '5. Verschiedenes / Nächste Sitzung'
    ]
  },
  abnahme: {
    label: 'Abnahme-Sitzung',
    traktanden: [
      '1. Prüfpunkte & Ergebnisse',
      '2. Mängel & Massnahmen',
      '3. Termine Nachbesserung',
      '4. Unterschriften & Abschluss'
    ]
  },
  koordination: {
    label: 'Koordinationssitzung',
    traktanden: [
      '1. Pendenzen Vorperiode',
      '2. Schnittstellenkoordination',
      '3. Ressourcen & Material',
      '4. Termine',
      '5. Verschiedenes'
    ]
  }
};

// --- State ---
let _bspViewMode    = 'list';      // 'list' | 'editor'
let _bspEditorTab   = 'protokoll'; // 'protokoll' | 'aufgaben'
let _bspCurrentId   = null;
let _bspImgTargetTraktId = null;
let _bspImgSelectedSrc   = null;
let _bspSelectedKontakte = new Set();

// --- Haupt-Dispatch ---
function renderBspSection() {
  const body = document.getElementById('proto-body-bsp');
  if (!body) return;
  if (_bspViewMode === 'list') {
    renderBspList();
  } else {
    renderBspEditor();
  }
}

// --- Editor öffnen / schliessen ---
function openBspEditor(id) {
  _bspCurrentId = id;
  _bspViewMode  = 'editor';
  _bspEditorTab = 'protokoll';
  const body = document.getElementById('proto-body-bsp');
  if (body && body.style.display === 'none') toggleProtoSektion('bsp');
  renderBspSection();
}

// Alias für Rückwärtskompatibilität
function openBspModal(id) { openBspEditor(id); }

function closeBspEditor() {
  _bspViewMode  = 'list';
  _bspCurrentId = null;
  renderBspSection();
}

function closeBspModal() { closeBspEditor(); }

// --- Editor rendern ---
function renderBspEditor() {
  const body = document.getElementById('proto-body-bsp');
  if (!body) return;

  body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
      <button onclick="closeBspEditor()" style="display:flex;align-items:center;gap:5px;padding:5px 12px;border-radius:7px;border:1px solid #d1d5db;background:white;color:#374151;font-size:11px;font-weight:600;cursor:pointer;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        Zurück
      </button>
      <div style="display:flex;gap:4px;">
        <button onclick="setBspEditorTab('protokoll')" id="bsp-tab-protokoll"
          style="padding:5px 14px;border-radius:7px;border:2px solid #1a3a5c;background:#1a3a5c;color:white;font-size:11px;font-weight:700;cursor:pointer;">
          ${svgIcon('dokument',{groesse:12})} Protokoll
        </button>
        <button onclick="setBspEditorTab('aufgaben')" id="bsp-tab-aufgaben"
          style="padding:5px 14px;border-radius:7px;border:2px solid #e5e7eb;background:white;color:#374151;font-size:11px;font-weight:700;cursor:pointer;">
          ✓ Aufgaben
        </button>
      </div>
      <div style="display:flex;gap:6px;">
        <button onclick="exportBspPdfCurrent()" style="padding:5px 12px;border-radius:7px;border:1px solid #d1d5db;background:white;color:#374151;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          PDF
        </button>
        <button onclick="openBspEmailModal('protokoll', _bspCurrentId)" style="padding:5px 12px;border-radius:7px;border:1px solid #d1d5db;background:white;color:#374151;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          Versenden
        </button>
        <button onclick="saveBspEditor()" style="padding:5px 14px;border-radius:7px;border:none;background:#1a3a5c;color:white;font-size:11px;font-weight:700;cursor:pointer;">
          Speichern
        </button>
      </div>
    </div>
    <div id="bsp-editor-tab-content"></div>
  `;

  renderBspEditorTabContent();
}

function setBspEditorTab(tab) {
  _bspEditorTab = tab;
  ['protokoll','aufgaben'].forEach(t => {
    const btn = document.getElementById('bsp-tab-' + t);
    if (!btn) return;
    const active = t === tab;
    btn.style.background  = active ? '#1a3a5c' : 'white';
    btn.style.color       = active ? 'white'   : '#374151';
    btn.style.borderColor = active ? '#1a3a5c' : '#e5e7eb';
  });
  renderBspEditorTabContent();
}

function renderBspEditorTabContent() {
  const content = document.getElementById('bsp-editor-tab-content');
  if (!content) return;
  if (_bspEditorTab === 'protokoll') {
    content.innerHTML = _buildBspProtokollTab();
    _bindBspProtokollTab();
  } else {
    content.innerHTML = _buildBspAufgabenTab();
  }
}

// --- Protokoll-Tab ---
function _buildBspProtokollTab() {
  const bsp    = _bspCurrentId ? loadBsp().find(b => b.id === _bspCurrentId) : null;
  const isNew  = !bsp;
  const allBsps = loadBsp();
  const prevBsp = allBsps.filter(b => b.id !== _bspCurrentId).slice(-1)[0];
  const today   = new Date().toISOString().slice(0, 10);

  const nr         = bsp ? bsp.nr         : String(allBsps.length + 1);
  const datum      = bsp ? (bsp.datum || today) : today;
  const ort        = bsp ? (bsp.ort    || '') : '';
  const teilnehmer = bsp ? (bsp.teilnehmer || '') : (prevBsp ? (prevBsp.teilnehmer || '') : '');
  const traktanden = bsp ? (bsp.traktanden || []) : [];

  let openTaskCount = 0;
  if (prevBsp) {
    (prevBsp.traktanden || []).forEach(t => {
      (t.tasks || []).forEach(task => { if (!task.done) openTaskCount++; });
    });
  }

  const traktandenHtml = traktanden.map(t => _bspTraktHtml(t, teilnehmer)).join('');

  return `
    <div style="background:white;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin-bottom:12px;">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
        <div>
          <label style="font-size:11px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Protokoll-Nr.</label>
          <input id="bsp-nr" type="text" value="${nr}" style="width:100%;padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;font-family:inherit;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Datum</label>
          <input id="bsp-datum" type="date" value="${datum}" style="width:100%;padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;font-family:inherit;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:#374151;display:block;margin-bottom:4px;">Ort</label>
          <input id="bsp-ort" type="text" value="${ort.replace(/"/g,'&quot;')}" placeholder="Baubüro" style="width:100%;padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;font-family:inherit;box-sizing:border-box;">
        </div>
      </div>
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
          <label style="font-size:11px;font-weight:700;color:#374151;">Teilnehmer</label>
          <button onclick="openBspKontaktPicker()" style="padding:2px 8px;border-radius:5px;border:1px solid #d1d5db;background:white;color:#374151;font-size:10px;cursor:pointer;display:flex;align-items:center;gap:3px;">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Projektbeteiligte
          </button>
        </div>
        <textarea id="bsp-teilnehmer" rows="3" placeholder="Name, Funktion / Firma (je eine Person pro Zeile)"
          style="width:100%;padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;font-family:inherit;resize:vertical;box-sizing:border-box;">${teilnehmer.replace(/</g,'&lt;')}</textarea>
      </div>
    </div>

    ${isNew ? `
    <div style="background:white;border:1px solid #e5e7eb;border-radius:10px;padding:12px 16px;margin-bottom:12px;">
      <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:8px;">Template</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button onclick="applyBspTemplate('standard')" id="bsp-tmpl-standard" style="padding:5px 12px;border-radius:20px;border:2px solid #1a3a5c;background:#1a3a5c;color:white;font-size:11px;font-weight:600;cursor:pointer;">Standard</button>
        <button onclick="applyBspTemplate('abnahme')" id="bsp-tmpl-abnahme" style="padding:5px 12px;border-radius:20px;border:2px solid #e5e7eb;background:white;color:#374151;font-size:11px;font-weight:600;cursor:pointer;">Abnahme</button>
        <button onclick="applyBspTemplate('koordination')" id="bsp-tmpl-koordination" style="padding:5px 12px;border-radius:20px;border:2px solid #e5e7eb;background:white;color:#374151;font-size:11px;font-weight:600;cursor:pointer;">Koordination</button>
        <button onclick="applyBspTemplate('leer')" id="bsp-tmpl-leer" style="padding:5px 12px;border-radius:20px;border:2px solid #e5e7eb;background:white;color:#374151;font-size:11px;font-weight:600;cursor:pointer;">Leer</button>
        ${openTaskCount > 0 ? `<button onclick="importOffeneTasksAlsTraktandum()" style="padding:5px 12px;border-radius:20px;border:2px solid #f59e0b;background:#fffbeb;color:#92400e;font-size:11px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:4px;">${svgIcon('warnung',{groesse:11})}${openTaskCount} offene Aufgabe${openTaskCount>1?'n':''} übernehmen</button>` : ''}
      </div>
    </div>` : (openTaskCount > 0 ? `
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
      <span style="font-size:12px;color:#92400e;display:inline-flex;align-items:center;gap:4px;">${svgIcon('warnung',{groesse:11})}${openTaskCount} offene Aufgabe${openTaskCount>1?'n':''} aus dem letzten Protokoll</span>
      <button onclick="importOffeneTasksAlsTraktandum()" style="padding:3px 10px;border-radius:6px;border:1px solid #f59e0b;background:white;color:#92400e;font-size:11px;font-weight:600;cursor:pointer;">Übernehmen</button>
    </div>` : '')}

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div style="font-size:12px;font-weight:700;color:#374151;">Traktanden</div>
      <button onclick="addBspTraktandum()" style="padding:4px 12px;border-radius:6px;border:1px solid #1a3a5c;background:#1a3a5c;color:white;font-size:11px;font-weight:600;cursor:pointer;">+ Traktandum</button>
    </div>
    <div id="bsp-traktanden-list">${traktandenHtml}</div>
  `;
}

function _bindBspProtokollTab() {
  const bsp = _bspCurrentId ? loadBsp().find(b => b.id === _bspCurrentId) : null;
  if (!bsp) { applyBspTemplate('standard'); return; }
  // Assignee-Selects befüllen
  (bsp.traktanden || []).forEach(t => {
    (t.tasks || []).forEach((task, ti) => {
      const sel = document.querySelector(`.bsp-trakt-item[data-id="${t.id}"] .bsp-task-assignee[data-tidx="${ti}"]`);
      if (sel && task.assignee) sel.value = task.assignee;
    });
  });
}

// --- Traktandum HTML ---
function _bspTraktHtml(t, teilnehmer) {
  const tnText  = teilnehmer !== undefined ? teilnehmer : (document.getElementById('bsp-teilnehmer')?.value || '');
  const tnLines = tnText.split('\n').map(l => l.trim()).filter(Boolean);

  const assigneeOpts = '<option value="">— Person —</option>'
    + tnLines.map(n => `<option value="${n.replace(/"/g,'&quot;')}">${n}</option>`).join('');

  const tasksHtml = (t.tasks || []).map((task, ti) => `
    <div class="bsp-task-row" data-tidx="${ti}" style="display:grid;grid-template-columns:auto 1fr auto auto auto;gap:6px;align-items:center;padding:4px 0;border-bottom:1px solid #f3f4f6;">
      <input type="checkbox" ${task.done ? 'checked' : ''} onchange="_bspToggleTask(${t.id},${ti},this.checked)"
        style="width:14px;height:14px;accent-color:#1a3a5c;cursor:pointer;flex-shrink:0;">
      <input type="text" value="${(task.text||'').replace(/"/g,'&quot;')}" placeholder="Aufgabe…"
        class="bsp-task-text" data-tidx="${ti}"
        style="padding:3px 6px;border:1px solid #e5e7eb;border-radius:5px;font-size:11px;font-family:inherit;${task.done?'text-decoration:line-through;color:#9ca3af;':''}">
      <select class="bsp-task-assignee" data-tidx="${ti}" style="padding:3px 6px;border:1px solid #e5e7eb;border-radius:5px;font-size:11px;font-family:inherit;min-width:110px;">
        ${assigneeOpts}
      </select>
      <input type="date" value="${task.dueDate||''}" class="bsp-task-due" data-tidx="${ti}"
        style="padding:3px 6px;border:1px solid #e5e7eb;border-radius:5px;font-size:11px;font-family:inherit;">
      <button onclick="_bspRemoveTask(${t.id},${ti})" style="border:none;background:none;color:#d1d5db;font-size:12px;cursor:pointer;padding:0 2px;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#d1d5db'">✕</button>
    </div>`).join('');

  const bilderHtml = (t.bilder || []).map((b, bi) => `
    <div style="position:relative;display:inline-block;margin:3px;">
      <img src="${b.src}" style="width:80px;height:60px;object-fit:cover;border-radius:4px;border:1px solid #e5e7eb;">
      ${b.caption ? `<div style="font-size:9px;color:#6b7280;text-align:center;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${b.caption}</div>` : ''}
      <button onclick="_bspRemoveBild(${t.id},${bi})" style="position:absolute;top:-4px;right:-4px;background:#dc2626;color:white;border:none;border-radius:50%;width:16px;height:16px;font-size:9px;cursor:pointer;line-height:1;padding:0;">✕</button>
    </div>`).join('');

  return `
    <div class="bsp-trakt-item" data-id="${t.id}" data-bilder='${JSON.stringify(t.bilder||[]).replace(/'/g,"&#39;")}' data-tasks='${JSON.stringify(t.tasks||[]).replace(/'/g,"&#39;")}'
         style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:10px;overflow:hidden;background:white;">
      <div style="background:#f8fafc;padding:8px 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e5e7eb;">
        <input class="bsp-trakt-titel" value="${(t.titel||'').replace(/"/g,'&quot;')}" placeholder="Traktandum-Titel"
               style="flex:1;border:none;background:transparent;font-size:12px;font-weight:700;color:#1a3a5c;font-family:inherit;outline:none;">
        <button onclick="_bspRemoveTraktandum(${t.id})" style="border:none;background:none;color:#d1d5db;font-size:14px;cursor:pointer;padding:0;line-height:1;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#d1d5db'">✕</button>
      </div>
      <div style="padding:10px 12px;">
        <textarea class="bsp-trakt-inhalt" rows="2" placeholder="Besprechungspunkte, Beschlüsse…"
          style="width:100%;border:1px solid #e5e7eb;border-radius:6px;padding:6px 8px;font-size:12px;font-family:inherit;resize:vertical;box-sizing:border-box;">${(t.inhalt||'').replace(/</g,'&lt;')}</textarea>

        <div style="margin-top:8px;">
          <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:5px;">Aufgaben</div>
          <div class="bsp-tasks-container" data-traktid="${t.id}">${tasksHtml}</div>
          <button onclick="_bspAddTask(${t.id})" style="margin-top:5px;padding:3px 8px;border-radius:5px;border:1px dashed #d1d5db;background:white;color:#6b7280;font-size:10px;cursor:pointer;">+ Aufgabe</button>
        </div>

        <div style="margin-top:8px;display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap;">
          <div style="display:flex;flex-wrap:wrap;gap:0;">${bilderHtml}</div>
          <button onclick="openBspImgPicker(${t.id})" style="padding:3px 8px;border-radius:5px;border:1px dashed #d1d5db;background:white;color:#6b7280;font-size:10px;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;">${svgIcon('kamera',{groesse:11})}Bild einfügen</button>
        </div>
      </div>
    </div>`;
}

// --- Traktanden verwalten ---
function addBspTraktandum() {
  const list = document.getElementById('bsp-traktanden-list');
  if (!list) return;
  const existing = list.querySelectorAll('.bsp-trakt-item');
  const newId = Date.now();
  const div = document.createElement('div');
  div.innerHTML = _bspTraktHtml({ id: newId, titel: String(existing.length + 1) + '. ', inhalt: '', bilder: [], tasks: [] });
  list.appendChild(div.firstElementChild);
}

function _bspRemoveTraktandum(id) {
  const list = document.getElementById('bsp-traktanden-list');
  if (!list) return;
  const item = list.querySelector(`.bsp-trakt-item[data-id="${id}"]`);
  if (item) item.remove();
}

function _bspRemoveBild(traktId, bildIdx) {
  const list = document.getElementById('bsp-traktanden-list');
  if (!list) return;
  const item = list.querySelector(`.bsp-trakt-item[data-id="${traktId}"]`);
  if (!item) return;
  let bilder = jsonParse(item.dataset.bilder || '[]');
  bilder.splice(bildIdx, 1);
  item.dataset.bilder = JSON.stringify(bilder);
  const inhalt = item.querySelector('.bsp-trakt-inhalt')?.value || '';
  const titel  = item.querySelector('.bsp-trakt-titel')?.value || '';
  const tasks  = jsonParse(item.dataset.tasks || '[]');
  const newHtml = _bspTraktHtml({ id: traktId, titel, inhalt, bilder, tasks });
  const div = document.createElement('div');
  div.innerHTML = newHtml;
  item.replaceWith(div.firstElementChild);
  const newItem = document.querySelector(`.bsp-trakt-item[data-id="${traktId}"]`);
  if (newItem) tasks.forEach((task, ti) => {
    const sel = newItem.querySelector(`.bsp-task-assignee[data-tidx="${ti}"]`);
    if (sel && task.assignee) sel.value = task.assignee;
  });
}

// --- Task-Hilfsfunktionen ---
function _bspAddTask(traktId) {
  const item = document.querySelector(`.bsp-trakt-item[data-id="${traktId}"]`);
  if (!item) return;
  let tasks = jsonParse(item.dataset.tasks || '[]');
  const newTask = { id: Date.now(), text: '', assignee: '', dueDate: '', done: false };
  tasks.push(newTask);
  item.dataset.tasks = JSON.stringify(tasks);

  const container = item.querySelector('.bsp-tasks-container');
  const tnText    = document.getElementById('bsp-teilnehmer')?.value || '';
  const tnLines   = tnText.split('\n').map(l => l.trim()).filter(Boolean);
  const assigneeOpts = '<option value="">— Person —</option>' + tnLines.map(n => `<option value="${n.replace(/"/g,'&quot;')}">${n}</option>`).join('');

  const rowHtml = tasks.map((task, ti) => `
    <div class="bsp-task-row" data-tidx="${ti}" style="display:grid;grid-template-columns:auto 1fr auto auto auto;gap:6px;align-items:center;padding:4px 0;border-bottom:1px solid #f3f4f6;">
      <input type="checkbox" ${task.done ? 'checked' : ''} onchange="_bspToggleTask(${traktId},${ti},this.checked)" style="width:14px;height:14px;accent-color:#1a3a5c;cursor:pointer;">
      <input type="text" value="${(task.text||'').replace(/"/g,'&quot;')}" placeholder="Aufgabe…" class="bsp-task-text" data-tidx="${ti}" style="padding:3px 6px;border:1px solid #e5e7eb;border-radius:5px;font-size:11px;font-family:inherit;${task.done?'text-decoration:line-through;color:#9ca3af;':''}">
      <select class="bsp-task-assignee" data-tidx="${ti}" style="padding:3px 6px;border:1px solid #e5e7eb;border-radius:5px;font-size:11px;font-family:inherit;min-width:110px;">${assigneeOpts}</select>
      <input type="date" value="${task.dueDate||''}" class="bsp-task-due" data-tidx="${ti}" style="padding:3px 6px;border:1px solid #e5e7eb;border-radius:5px;font-size:11px;font-family:inherit;">
      <button onclick="_bspRemoveTask(${traktId},${ti})" style="border:none;background:none;color:#d1d5db;font-size:12px;cursor:pointer;padding:0 2px;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#d1d5db'">✕</button>
    </div>`).join('');
  if (container) container.innerHTML = rowHtml;

  tasks.forEach((task, ti) => {
    const sel = item.querySelector(`.bsp-task-assignee[data-tidx="${ti}"]`);
    if (sel && task.assignee) sel.value = task.assignee;
  });
}

function _bspRemoveTask(traktId, taskIdx) {
  const item = document.querySelector(`.bsp-trakt-item[data-id="${traktId}"]`);
  if (!item) return;
  let tasks = jsonParse(item.dataset.tasks || '[]');
  tasks.splice(taskIdx, 1);
  item.dataset.tasks = JSON.stringify(tasks);
  _rerenderTraktandum(traktId);
}

function _bspToggleTask(traktId, taskIdx, done) {
  const item = document.querySelector(`.bsp-trakt-item[data-id="${traktId}"]`);
  if (!item) return;
  let tasks = jsonParse(item.dataset.tasks || '[]');
  if (tasks[taskIdx]) {
    tasks[taskIdx].done = done;
    item.dataset.tasks = JSON.stringify(tasks);
    const textInput = item.querySelector(`.bsp-task-text[data-tidx="${taskIdx}"]`);
    if (textInput) { textInput.style.textDecoration = done ? 'line-through' : ''; textInput.style.color = done ? '#9ca3af' : ''; }
  }
}

function _rerenderTraktandum(traktId) {
  const list = document.getElementById('bsp-traktanden-list');
  if (!list) return;
  const item = list.querySelector(`.bsp-trakt-item[data-id="${traktId}"]`);
  if (!item) return;
  const tasks  = jsonParse(item.dataset.tasks || '[]');
  const bilder = jsonParse(item.dataset.bilder || '[]');
  const titel  = item.querySelector('.bsp-trakt-titel')?.value || '';
  const inhalt = item.querySelector('.bsp-trakt-inhalt')?.value || '';
  const tnText = document.getElementById('bsp-teilnehmer')?.value || '';
  const newHtml = _bspTraktHtml({ id: traktId, titel, inhalt, bilder, tasks }, tnText);
  const div = document.createElement('div');
  div.innerHTML = newHtml;
  item.replaceWith(div.firstElementChild);
  const newItem = list.querySelector(`.bsp-trakt-item[data-id="${traktId}"]`);
  if (newItem) tasks.forEach((task, ti) => {
    const sel = newItem.querySelector(`.bsp-task-assignee[data-tidx="${ti}"]`);
    if (sel && task.assignee) sel.value = task.assignee;
  });
}

// --- Speichern ---
function _readBspTraktandenFromDom() {
  const list = document.getElementById('bsp-traktanden-list');
  if (!list) return [];
  return Array.from(list.querySelectorAll('.bsp-trakt-item')).map(el => {
    const traktId = parseInt(el.dataset.id);
    const tasks   = _readTasksFromTraktItem(el);
    const bilder  = jsonParse(el.dataset.bilder || '[]');
    return {
      id:     traktId,
      titel:  el.querySelector('.bsp-trakt-titel')?.value || '',
      inhalt: el.querySelector('.bsp-trakt-inhalt')?.value || '',
      bilder,
      tasks
    };
  });
}

function _readTasksFromTraktItem(el) {
  const rows = el.querySelectorAll('.bsp-task-row');
  const storedTasks = jsonParse(el.dataset.tasks || '[]');
  return Array.from(rows).map((row, ti) => {
    const stored = storedTasks[ti] || {};
    return {
      id:       stored.id || Date.now() + ti,
      text:     row.querySelector('.bsp-task-text')?.value || '',
      assignee: row.querySelector('.bsp-task-assignee')?.value || '',
      dueDate:  row.querySelector('.bsp-task-due')?.value || '',
      done:     row.querySelector('input[type="checkbox"]')?.checked || false
    };
  });
}

// Rückwärtskompatibilität
function _readBspTraktanden() { return _readBspTraktandenFromDom(); }

function saveBspEditor() {
  const nr         = document.getElementById('bsp-nr')?.value.trim() || '1';
  const datum      = document.getElementById('bsp-datum')?.value || '';
  const ort        = document.getElementById('bsp-ort')?.value.trim() || '';
  const teilnehmer = document.getElementById('bsp-teilnehmer')?.value.trim() || '';
  const traktanden = _readBspTraktandenFromDom();

  const all = loadBsp();
  if (_bspCurrentId) {
    const idx = all.findIndex(b => b.id === _bspCurrentId);
    if (idx !== -1) all[idx] = { ...all[idx], nr, datum, ort, teilnehmer, traktanden };
    else all.push({ id: _bspCurrentId, nr, datum, ort, teilnehmer, traktanden });
  } else {
    const newId = Date.now();
    _bspCurrentId = newId;
    all.push({ id: newId, nr, datum, ort, teilnehmer, traktanden });
  }
  saveBsp(all);
  const btn = event?.target;
  if (btn) { const orig = btn.textContent; btn.textContent = '✓ Gespeichert'; setTimeout(() => { btn.textContent = orig; }, 1500); }
}

function saveBspModal() { saveBspEditor(); }

async function deleteBsp(id) {
  if (!await ui.confirm('Protokoll löschen?')) return;
  saveBsp(loadBsp().filter(b => b.id !== id));
  renderBspSection();
}

// --- Aufgaben-Tab ---
function _buildBspAufgabenTab() {
  const bsp = _bspCurrentId ? loadBsp().find(b => b.id === _bspCurrentId) : null;
  if (!bsp) return '<div style="color:#9ca3af;padding:20px;text-align:center;">Protokoll zuerst speichern.</div>';

  const today = new Date(); today.setHours(0,0,0,0);

  let allTasks = [];
  (bsp.traktanden || []).forEach(t => {
    (t.tasks || []).forEach(task => {
      allTasks.push({ ...task, traktTitel: t.titel || '—' });
    });
  });

  if (!allTasks.length) return '<div style="color:#9ca3af;padding:20px;text-align:center;">Noch keine Aufgaben erfasst. Im Tab «Protokoll» bei den Traktanden Aufgaben hinzufügen.</div>';

  const rows = allTasks.map(task => {
    const due      = task.dueDate ? new Date(task.dueDate) : null;
    const daysLeft = due ? Math.ceil((due - today) / 86400000) : null;
    const isOverdue = daysLeft !== null && daysLeft < 0 && !task.done;
    const isUrgent  = daysLeft !== null && daysLeft >= 0 && daysLeft < 7 && !task.done;
    const dueCss    = isOverdue ? 'color:#dc2626;font-weight:700;' : isUrgent ? 'color:#f59e0b;font-weight:700;' : 'color:#6b7280;';
    const dueStr    = due ? due.toLocaleDateString('de-CH') : '—';
    const daysStr   = daysLeft !== null ? (daysLeft < 0 ? `${Math.abs(daysLeft)}T überfällig` : daysLeft === 0 ? 'Heute' : `T-${daysLeft}`) : '—';
    const rowBg     = task.done ? 'background:#f9fafb;' : isOverdue ? 'background:#fff5f5;' : isUrgent ? 'background:#fffbeb;' : '';
    return `
      <tr style="${rowBg}">
        <td style="padding:7px 10px;text-align:center;">
          <input type="checkbox" ${task.done?'checked':''} onchange="_bspToggleTaskGlobal('${task.id}',this.checked)"
            style="width:14px;height:14px;accent-color:#1a3a5c;cursor:pointer;">
        </td>
        <td style="padding:7px 10px;font-size:12px;${task.done?'text-decoration:line-through;color:#9ca3af;':''}">${task.text||'—'}</td>
        <td style="padding:7px 10px;font-size:11px;color:#6b7280;">${task.traktTitel}</td>
        <td style="padding:7px 10px;font-size:11px;color:#374151;">${task.assignee||'—'}</td>
        <td style="padding:7px 10px;font-size:11px;${dueCss}">${dueStr}</td>
        <td style="padding:7px 10px;font-size:11px;${dueCss}font-weight:700;">${daysStr}</td>
      </tr>`;
  }).join('');

  const openCount = allTasks.filter(t => !t.done).length;

  return `
    <div style="background:white;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
      <div style="padding:12px 16px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;">
        <div style="font-size:13px;font-weight:700;color:#1a3a5c;">Aufgaben BSP-${String(bsp.nr).padStart(3,'0')}</div>
        <div style="font-size:11px;color:#6b7280;">${openCount} offen · ${allTasks.length - openCount} erledigt</div>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr>
              <th style="background:#1a3a5c;color:white;padding:7px 10px;font-size:10px;font-weight:700;text-align:center;width:36px;">✓</th>
              <th style="background:#1a3a5c;color:white;padding:7px 10px;font-size:10px;font-weight:700;text-align:left;">Aufgabe</th>
              <th style="background:#1a3a5c;color:white;padding:7px 10px;font-size:10px;font-weight:700;text-align:left;">Traktandum</th>
              <th style="background:#1a3a5c;color:white;padding:7px 10px;font-size:10px;font-weight:700;text-align:left;">Zuständig</th>
              <th style="background:#1a3a5c;color:white;padding:7px 10px;font-size:10px;font-weight:700;text-align:left;">Bis</th>
              <th style="background:#1a3a5c;color:white;padding:7px 10px;font-size:10px;font-weight:700;text-align:left;">Frist</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function _bspToggleTaskGlobal(taskId, done) {
  if (!_bspCurrentId) return;
  const all = loadBsp();
  const bsp = all.find(b => b.id === _bspCurrentId);
  if (!bsp) return;
  (bsp.traktanden || []).forEach(t => {
    (t.tasks || []).forEach(task => {
      if (String(task.id) === String(taskId)) task.done = done;
    });
  });
  saveBsp(all);
  const content = document.getElementById('bsp-editor-tab-content');
  if (content) content.innerHTML = _buildBspAufgabenTab();
}

// --- Aufgaben-Übersicht in der Liste ---
function _buildBspTaskOverview() {
  const all   = loadBsp();
  const today = new Date(); today.setHours(0,0,0,0);

  let allTasks = [];
  all.forEach(bsp => {
    (bsp.traktanden || []).forEach(t => {
      (t.tasks || []).forEach(task => {
        if (!task.done) allTasks.push({ ...task, bspNr: bsp.nr, bspId: bsp.id, bspDatum: bsp.datum, traktTitel: t.titel });
      });
    });
  });

  if (!allTasks.length) return '';

  allTasks.sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate) : new Date('9999-12-31');
    const db = b.dueDate ? new Date(b.dueDate) : new Date('9999-12-31');
    return da - db;
  });

  const rows = allTasks.map(task => {
    const due      = task.dueDate ? new Date(task.dueDate) : null;
    const daysLeft = due ? Math.ceil((due - today) / 86400000) : null;
    const isOverdue = daysLeft !== null && daysLeft < 0;
    const isUrgent  = daysLeft !== null && daysLeft >= 0 && daysLeft < 7;
    const daysStr   = daysLeft !== null ? (daysLeft < 0 ? `${Math.abs(daysLeft)}T überfällig` : daysLeft === 0 ? 'Heute' : `T-${daysLeft}`) : '—';
    const rowBg     = isOverdue ? '#fff5f5' : isUrgent ? '#fffbeb' : 'white';
    const daysCss   = isOverdue ? 'color:#dc2626;font-weight:700;' : isUrgent ? 'color:#f59e0b;font-weight:700;' : 'color:#6b7280;';
    const daysBg    = isOverdue ? 'background:#fee2e2;' : isUrgent ? 'background:#fef3c7;' : 'background:#f3f4f6;';
    return `
      <tr style="background:${rowBg};">
        <td style="padding:6px 10px;font-size:11px;color:#1a3a5c;font-weight:600;cursor:pointer;" onclick="openBspEditor(${task.bspId})">BSP-${String(task.bspNr).padStart(3,'0')}</td>
        <td style="padding:6px 10px;font-size:11px;">${task.text||'—'}</td>
        <td style="padding:6px 10px;font-size:10px;color:#6b7280;">${task.assignee||'—'}</td>
        <td style="padding:6px 10px;font-size:11px;text-align:center;">
          <span style="padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;${daysCss}${daysBg}">${daysStr}</span>
        </td>
      </tr>`;
  }).join('');

  const urgentCount = allTasks.filter(t => {
    const due = t.dueDate ? new Date(t.dueDate) : null;
    const d   = due ? Math.ceil((due - today) / 86400000) : null;
    return d !== null && d < 7;
  }).length;

  return `
    <div style="background:white;border:1px solid ${urgentCount > 0 ? '#fcd34d' : '#e5e7eb'};border-radius:10px;margin-bottom:12px;overflow:hidden;">
      <div style="padding:10px 14px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;background:${urgentCount > 0 ? '#fffbeb' : 'white'};">
        <div style="font-size:12px;font-weight:700;color:#1a3a5c;">Offene Aufgaben</div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-size:11px;color:#6b7280;">${allTasks.length} offen${urgentCount > 0 ? ` · <span style="color:#f59e0b;font-weight:700;">${urgentCount} dringend</span>` : ''}</div>
          <button onclick="openBspEmailModal('reminder',null)" style="padding:3px 10px;border-radius:5px;border:1px solid #d1d5db;background:white;color:#374151;font-size:10px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Reminder senden
          </button>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="background:#f8fafc;padding:5px 10px;font-size:10px;font-weight:700;color:#6b7280;text-align:left;border-bottom:1px solid #e5e7eb;">Protokoll</th>
            <th style="background:#f8fafc;padding:5px 10px;font-size:10px;font-weight:700;color:#6b7280;text-align:left;border-bottom:1px solid #e5e7eb;">Aufgabe</th>
            <th style="background:#f8fafc;padding:5px 10px;font-size:10px;font-weight:700;color:#6b7280;text-align:left;border-bottom:1px solid #e5e7eb;">Zuständig</th>
            <th style="background:#f8fafc;padding:5px 10px;font-size:10px;font-weight:700;color:#6b7280;text-align:center;border-bottom:1px solid #e5e7eb;">Frist</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// --- Liste rendern ---
function renderBspList() {
  const wrap = document.getElementById('proto-body-bsp');
  if (!wrap) return;
  const bsps = loadBsp();

  const taskOverview = _buildBspTaskOverview();

  const listHtml = !bsps.length
    ? '<div style="color:#9ca3af;font-size:13px;padding:20px 0;text-align:center;">Noch keine Bausitzungsprotokolle erfasst.</div>'
    : bsps.map(b => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:6px;background:white;">
          <div style="flex:1;min-width:0;cursor:pointer;" onclick="openBspEditor(${b.id})">
            <div style="font-size:13px;font-weight:700;color:#1a3a5c;">BSP-${String(b.nr).padStart(3,'0')} · ${b.datum ? b.datum.split('-').reverse().join('.') : '—'}</div>
            <div style="font-size:11px;color:#6b7280;">${b.ort || '—'} · ${b.traktanden?.length || 0} Traktanden</div>
          </div>
          <div style="display:flex;gap:5px;flex-shrink:0;margin-left:10px;">
            <button onclick="openBspEditor(${b.id})" style="padding:4px 10px;border-radius:6px;border:1px solid #d1d5db;background:white;color:#374151;font-size:11px;font-weight:600;cursor:pointer;">Öffnen</button>
            <button onclick="exportBspPdf(${b.id})" style="padding:4px 10px;border-radius:6px;border:1px solid #d1d5db;background:white;color:#374151;font-size:11px;font-weight:600;cursor:pointer;">PDF</button>
            <button onclick="deleteBsp(${b.id})" style="padding:4px 10px;border-radius:6px;border:1px solid #fca5a5;background:#fff5f5;color:#dc2626;font-size:11px;font-weight:600;cursor:pointer;">✕</button>
          </div>
        </div>`).join('');

  wrap.innerHTML = `
    <div style="margin-bottom:12px;">
      <button onclick="openBspEditor(null)" style="padding:5px 14px;border-radius:6px;border:1px solid #1a3a5c;background:#1a3a5c;color:white;font-size:12px;font-weight:600;cursor:pointer;">+ Neues Protokoll</button>
    </div>
    ${taskOverview}
    <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:8px;">Protokolle</div>
    ${listHtml}`;
}

// --- Offene Tasks aus Vorperiode übernehmen ---
function importOffeneTasksAlsTraktandum() {
  const allBsps = loadBsp();
  const prevBsp = allBsps.filter(b => b.id !== _bspCurrentId).slice(-1)[0];
  if (!prevBsp) return;

  let offeneTasks = [];
  (prevBsp.traktanden || []).forEach(t => {
    (t.tasks || []).forEach(task => {
      if (!task.done) offeneTasks.push({ ...task });
    });
  });
  if (!offeneTasks.length) return;

  const list = document.getElementById('bsp-traktanden-list');
  if (!list) return;
  const newId = Date.now();
  const newTrakt = {
    id:     newId,
    titel:  `Pendenzen aus BSP-${String(prevBsp.nr).padStart(3,'0')}`,
    inhalt: '',
    bilder: [],
    tasks:  offeneTasks.map(t => ({ ...t, id: Date.now() + Math.floor(Math.random()*9999) }))
  };
  const tnText = document.getElementById('bsp-teilnehmer')?.value || '';
  const div = document.createElement('div');
  div.innerHTML = _bspTraktHtml(newTrakt, tnText);
  list.insertBefore(div.firstElementChild, list.firstChild);

  const newItem = list.querySelector(`.bsp-trakt-item[data-id="${newId}"]`);
  if (newItem) {
    newTrakt.tasks.forEach((task, ti) => {
      const sel = newItem.querySelector(`.bsp-task-assignee[data-tidx="${ti}"]`);
      if (sel && task.assignee) sel.value = task.assignee;
    });
  }

  // Import-Button ausblenden
  try { event?.target?.closest('div')?.remove?.() || event?.target?.remove?.(); } catch(e) {}
}

// --- Template anwenden ---
function applyBspTemplate(key, silent) {
  ['standard','abnahme','koordination','leer'].forEach(k => {
    const btn = document.getElementById('bsp-tmpl-' + k);
    if (btn) {
      btn.style.background  = k === key ? '#1a3a5c' : 'white';
      btn.style.color       = k === key ? 'white' : '#374151';
      btn.style.borderColor = k === key ? '#1a3a5c' : '#e5e7eb';
    }
  });
  if (key === 'leer') { _renderBspTraktanden([]); return; }
  const tmpl = BSP_TEMPLATES[key];
  if (!tmpl) return;
  const traktanden = tmpl.traktanden.map((titel, i) => ({ id: Date.now() + i, titel, inhalt: '', bilder: [], tasks: [] }));
  _renderBspTraktanden(traktanden);
}

function _renderBspTraktanden(traktanden) {
  const list = document.getElementById('bsp-traktanden-list');
  if (!list) return;
  const tnText = document.getElementById('bsp-teilnehmer')?.value || '';
  list.innerHTML = traktanden.map(t => _bspTraktHtml(t, tnText)).join('');
}

// --- Projektbeteiligte-Picker ---
function openBspKontaktPicker() {
  _bspSelectedKontakte = new Set();
  const picker = document.getElementById('bsp-kontakt-picker');
  if (!picker) return;
  picker.style.display = 'flex';

  const listEl = document.getElementById('bsp-kontakt-picker-list');
  if (!listEl) return;
  const contacts = (typeof loadContacts === 'function') ? loadContacts() : [];
  if (!contacts.length) {
    listEl.innerHTML = '<div style="color:#9ca3af;font-size:12px;padding:10px 0;">Keine Projektbeteiligten erfasst.</div>';
    return;
  }
  listEl.innerHTML = contacts.map(c => `
    <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:7px;cursor:pointer;border:1px solid #e5e7eb;margin-bottom:6px;background:white;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">
      <input type="checkbox" value="${c.id}" onchange="_bspToggleKontaktSelect('${c.id}',this.checked)" style="width:14px;height:14px;accent-color:#1a3a5c;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:600;color:#1a3a5c;">${c.name||'—'}</div>
        <div style="font-size:10px;color:#6b7280;">${c.rolle||''} ${c.firma ? '· ' + c.firma : ''}</div>
      </div>
    </label>`).join('');
}

function closeBspKontaktPicker() {
  const picker = document.getElementById('bsp-kontakt-picker');
  if (picker) picker.style.display = 'none';
}

function _bspToggleKontaktSelect(contactId, checked) {
  if (checked) _bspSelectedKontakte.add(contactId);
  else _bspSelectedKontakte.delete(contactId);
}

function applyBspKontakteToTeilnehmer() {
  const contacts = (typeof loadContacts === 'function') ? loadContacts() : [];
  const existing = (document.getElementById('bsp-teilnehmer')?.value || '').trim();
  const existingLines = existing ? existing.split('\n').map(l => l.trim()).filter(Boolean) : [];

  const toAdd = [..._bspSelectedKontakte].map(id => {
    const c = contacts.find(x => x.id === id);
    if (!c) return null;
    const parts = [c.name];
    if (c.rolle) parts.push(c.rolle);
    if (c.firma) parts.push(c.firma);
    return parts.filter(Boolean).join(', ');
  }).filter(Boolean);

  const newLines = [...existingLines];
  toAdd.forEach(line => { if (!newLines.includes(line)) newLines.push(line); });

  const textarea = document.getElementById('bsp-teilnehmer');
  if (textarea) textarea.value = newLines.join('\n');
  closeBspKontaktPicker();
}

// --- Bild-Picker ---
function openBspImgPicker(traktId) {
  _bspImgTargetTraktId = traktId;
  _bspImgSelectedSrc   = null;
  const picker = document.getElementById('bsp-img-picker');
  if (!picker) return;
  picker.style.display = 'flex';
  document.getElementById('bsp-img-caption').value = '';
  document.getElementById('bsp-img-preview-upload').innerHTML = '';
  document.getElementById('bsp-img-file-input').value = '';
  setBspImgTab('upload');
}

function closeBspImgPicker() {
  const picker = document.getElementById('bsp-img-picker');
  if (picker) picker.style.display = 'none';
}

function setBspImgTab(tab) {
  document.getElementById('bsp-imgtab-upload-body').style.display  = tab === 'upload' ? 'block' : 'none';
  document.getElementById('bsp-imgtab-fotos-body').style.display   = tab === 'fotos'  ? 'block' : 'none';
  ['upload','fotos'].forEach(t => {
    const btn = document.getElementById('bsp-imgtab-' + t);
    if (btn) {
      btn.style.background  = t === tab ? '#1a3a5c' : 'white';
      btn.style.color       = t === tab ? 'white' : '#374151';
      btn.style.borderColor = t === tab ? '#1a3a5c' : '#e5e7eb';
    }
  });
  if (tab === 'fotos') _renderBspFotosGrid();
}

async function _renderBspFotosGrid() {
  const grid = document.getElementById('bsp-fotos-grid');
  if (!grid) return;
  grid.innerHTML = '<div style="grid-column:1/-1;font-size:12px;color:var(--c-text-faint);">Fotos werden geladen…</div>';
  const allFotos = await loadAllFotos();
  const items = [];
  Object.entries(allFotos).forEach(([pairId, fotos]) => {
    const pair = (typeof PAIRS !== 'undefined' ? PAIRS : []).find(p => p.id === parseInt(pairId));
    (fotos || []).forEach(f => {
      if (f.src) items.push({ src: f.src, caption: f.caption || '', label: pair ? ('Mast ' + (pair.mast || pairId)) : ('ID ' + pairId) });
    });
  });
  if (!items.length) {
    grid.innerHTML = '<div style="color:#9ca3af;font-size:12px;padding:20px;text-align:center;">Keine Fotos im Projekt</div>';
    return;
  }
  grid.innerHTML = items.map((item, i) => `
    <div onclick="_selectBspFoto('${item.src.replace(/'/g,"\\'").replace(/\n/g,'')}','${(item.caption||'').replace(/'/g,"\\'")}',${i})"
         class="bsp-foto-thumb" data-idx="${i}"
         style="cursor:pointer;border-radius:6px;overflow:hidden;border:2px solid #e5e7eb;transition:border-color .15s;">
      <img src="${item.src}" style="width:100%;height:80px;object-fit:cover;display:block;">
      <div style="font-size:9px;color:#6b7280;padding:2px 4px;background:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.label}</div>
    </div>`).join('');
}

function _selectBspFoto(src, caption, idx) {
  _bspImgSelectedSrc = src;
  document.getElementById('bsp-img-caption').value = caption || '';
  document.querySelectorAll('.bsp-foto-thumb').forEach((el, i) => {
    el.style.borderColor = i === idx ? '#1a3a5c' : '#e5e7eb';
  });
}

function onBspImgFileSelected(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _bspImgSelectedSrc = e.target.result;
    document.getElementById('bsp-img-preview-upload').innerHTML = `<img src="${e.target.result}" style="max-width:100%;max-height:200px;border-radius:6px;margin-top:8px;">`;
  };
  reader.readAsDataURL(file);
}

function confirmBspImg() {
  if (!_bspImgSelectedSrc) { ui.toast('Bitte zuerst ein Bild auswählen.', 'fehler'); return; }
  const caption = document.getElementById('bsp-img-caption')?.value.trim() || '';
  const list    = document.getElementById('bsp-traktanden-list');
  if (!list) return;
  const item = list.querySelector(`.bsp-trakt-item[data-id="${_bspImgTargetTraktId}"]`);
  if (!item) return;

  let bilder = jsonParse(item.dataset.bilder || '[]');
  bilder.push({ src: _bspImgSelectedSrc, caption });
  item.dataset.bilder = JSON.stringify(bilder);

  const inhalt = item.querySelector('.bsp-trakt-inhalt')?.value || '';
  const titel  = item.querySelector('.bsp-trakt-titel')?.value || '';
  const tasks  = jsonParse(item.dataset.tasks || '[]');
  const newHtml = _bspTraktHtml({ id: _bspImgTargetTraktId, titel, inhalt, bilder, tasks });
  const div = document.createElement('div');
  div.innerHTML = newHtml;
  item.replaceWith(div.firstElementChild);
  const newItem = list.querySelector(`.bsp-trakt-item[data-id="${_bspImgTargetTraktId}"]`);
  if (newItem) tasks.forEach((task, ti) => {
    const sel = newItem.querySelector(`.bsp-task-assignee[data-tidx="${ti}"]`);
    if (sel && task.assignee) sel.value = task.assignee;
  });

  closeBspImgPicker();
}

function _getBspById(id) { return loadBsp().find(b => b.id === id); }

function exportBspPdfCurrent() {
  if (_bspCurrentId) {
    saveBspEditor();
    exportBspPdf(_bspCurrentId);
  } else {
    saveBspEditor();
    const all = loadBsp();
    if (all.length) exportBspPdf(all[all.length - 1].id);
  }
}

function exportBspPdf(id) {
  const jsPDFLib = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFLib) { ui.toast('jsPDF nicht geladen.', 'fehler'); return; }
  const bsp = _getBspById(id);
  if (!bsp) return;

  const doc = new jsPDFLib({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pn  = (typeof getActiveProjectName === 'function' ? getActiveProjectName() : '') || 'Projekt';
  const W   = 210, M = 20;
  const cW  = W - 2*M;
  let   y   = M;

  doc.setFillColor(26, 58, 92);
  doc.rect(0, 0, W, 14, 'F');
  doc.setFontSize(9); doc.setTextColor(255,255,255); doc.setFont(undefined,'bold');
  doc.text('BAUSITZUNGSPROTOKOLL', M, 9);
  doc.setFont(undefined,'normal');
  doc.text(pn, W - M, 9, { align: 'right' });
  y = 20;

  doc.setFontSize(13); doc.setTextColor(26,58,92); doc.setFont(undefined,'bold');
  doc.text('Bausitzungsprotokoll BSP-' + String(bsp.nr).padStart(3,'0'), M, y);
  y += 8;

  doc.setFontSize(10); doc.setFont(undefined,'normal'); doc.setTextColor(60,60,60);
  const datumStr = bsp.datum ? bsp.datum.split('-').reverse().join('.') : '—';
  doc.text('Datum: ' + datumStr + '   |   Ort: ' + (bsp.ort || '—'), M, y);
  y += 6;

  if (bsp.teilnehmer) {
    doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.setTextColor(26,58,92);
    doc.text('Teilnehmer:', M, y); y += 5;
    doc.setFont(undefined,'normal'); doc.setTextColor(60,60,60);
    const lines = doc.splitTextToSize(bsp.teilnehmer, cW);
    doc.text(lines, M, y); y += lines.length * 4.5 + 4;
  }

  doc.setDrawColor(230,230,230); doc.setLineWidth(0.3);
  doc.line(M, y, W - M, y); y += 6;

  (bsp.traktanden || []).forEach((t, ti) => {
    if (y > 265) { doc.addPage(); y = M; }

    doc.setFillColor(245, 247, 250);
    doc.rect(M, y - 3, cW, 7, 'F');
    doc.setFontSize(10); doc.setFont(undefined,'bold'); doc.setTextColor(26,58,92);
    doc.text(t.titel || ('Traktandum ' + (ti+1)), M + 2, y + 1.5);
    y += 8;

    if (t.inhalt) {
      doc.setFontSize(9.5); doc.setFont(undefined,'normal'); doc.setTextColor(50,50,50);
      const lines = doc.splitTextToSize(t.inhalt, cW);
      if (y + lines.length * 4.5 > 270) { doc.addPage(); y = M; }
      doc.text(lines, M, y); y += lines.length * 4.5 + 3;
    }

    if (t.bilder?.length) {
      const imgW = (cW - 5) / 2;
      const imgH = imgW * 0.6;
      let xi = 0;
      t.bilder.forEach((b, bi) => {
        if (y + imgH + 10 > 275) { doc.addPage(); y = M; xi = 0; }
        const xPos = M + xi * (imgW + 5);
        try {
          doc.addImage(b.src, 'JPEG', xPos, y, imgW, imgH);
          if (b.caption) {
            doc.setFontSize(7.5); doc.setTextColor(120,120,120);
            doc.text(b.caption, xPos + imgW/2, y + imgH + 3, { align: 'center' });
          }
        } catch(e) { /* Bild konnte nicht eingefügt werden */ }
        xi++;
        if (xi >= 2) { xi = 0; y += imgH + (t.bilder[bi]?.caption ? 8 : 5); }
      });
      if (xi > 0) y += imgH + 8;
    }

    y += 4;
    if (ti < (bsp.traktanden.length - 1)) {
      doc.setDrawColor(235,235,235); doc.setLineWidth(0.2);
      doc.line(M, y - 1, W - M, y - 1);
      y += 2;
    }
  });

  doc.setFontSize(8); doc.setTextColor(180,180,180);
  doc.text('Exportiert: ' + new Date().toLocaleDateString('de-CH'), M, 290);
  doc.text('Seite 1', W - M, 290, { align: 'right' });

  doc.save('BSP-' + String(bsp.nr).padStart(3,'0') + '_' + (bsp.datum || 'ohne-datum') + '.pdf');
}

// ============================================================
// BSP E-MAIL — Vorlagen + Versenden
// ============================================================

const _bspEmailDefaultTemplates = {
  protokoll: {
    subject: 'BSP-{nr} – Protokoll der Bausitzung vom {datum}',
    body: `Guten Tag

Anbei das Protokoll der Bausitzung Nr. {nr} vom {datum}, Ort: {ort}.

Projekt: {projektname}

Traktanden:
{traktanden}

Bitte melden Sie allfällige Korrekturen innerhalb von 5 Arbeitstagen.

Freundliche Grüsse`
  },
  reminder: {
    subject: 'Pendenzen-Reminder – {projektname}',
    body: `Guten Tag

Wir erinnern Sie an die folgenden offenen Aufgaben aus den Bausitzungsprotokollen:

{aufgaben}

Bitte erledigen Sie die Aufgaben bis zur angegebenen Frist.

Bei Fragen wenden Sie sich bitte an die Projektleitung.

Freundliche Grüsse`
  }
};

function _bspEmailTplKey() { return 'sp_bsp_email_tpl__' + _activeId; }

function loadBspEmailTemplates() {
  try {
    const s = store.getItem(_bspEmailTplKey());
    if (s) {
      const saved = jsonParse(s);
      return {
        protokoll: { ..._bspEmailDefaultTemplates.protokoll, ...saved.protokoll },
        reminder:  { ..._bspEmailDefaultTemplates.reminder,  ...saved.reminder  }
      };
    }
  } catch {}
  return { protokoll: { ..._bspEmailDefaultTemplates.protokoll }, reminder: { ..._bspEmailDefaultTemplates.reminder } };
}

function _saveBspEmailTemplates(tpls) {
  store.setItem(_bspEmailTplKey(), JSON.stringify(tpls));
}

let _bspEmailMode  = 'protokoll';
let _bspEmailBspId = null;

function _bspSubstitute(tmpl, vars) {
  return tmpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : '{' + k + '}'));
}

function _bspBuildEmailVars(mode, bspId) {
  const pn   = (typeof getActiveProjectName === 'function' ? getActiveProjectName() : '') || 'Projekt';
  const vars = { projektname: pn, nr: '—', datum: '—', ort: '—', traktanden: '', aufgaben: '' };

  if (mode === 'protokoll' && bspId) {
    const bsp = _getBspById(bspId);
    if (bsp) {
      vars.nr          = String(bsp.nr).padStart(3, '0');
      vars.datum       = bsp.datum ? bsp.datum.split('-').reverse().join('.') : '—';
      vars.ort         = bsp.ort || '—';
      vars.traktanden  = (bsp.traktanden || [])
        .map((t, i) => `  ${i + 1}. ${t.titel || '(kein Titel)'}`)
        .join('\n') || '  (keine Traktanden)';
    }
  }

  if (mode === 'reminder') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const lines = [];
    loadBsp().forEach(bsp => {
      (bsp.traktanden || []).forEach(t => {
        (t.tasks || []).forEach(task => {
          if (task.done) return;
          const due      = task.dueDate ? new Date(task.dueDate) : null;
          const daysLeft = due ? Math.ceil((due - today) / 86400000) : null;
          const fristStr = due
            ? due.toLocaleDateString('de-CH') + (daysLeft !== null
                ? (daysLeft < 0 ? ` (${Math.abs(daysLeft)}T überfällig)` : ` (T-${daysLeft})`)
                : '')
            : 'keine Frist';
          lines.push(`  • ${task.text || '—'}  |  ${task.assignee || '—'}  |  Frist: ${fristStr}  [BSP-${String(bsp.nr).padStart(3, '0')}]`);
        });
      });
    });
    vars.aufgaben = lines.join('\n') || '  (keine offenen Aufgaben)';
  }

  return vars;
}

function openBspEmailModal(mode, bspId) {
  _bspEmailMode  = mode || 'protokoll';
  _bspEmailBspId = bspId ?? _bspCurrentId ?? null;

  const modal = document.getElementById('bsp-email-modal');
  if (!modal) return;

  const tpl  = loadBspEmailTemplates()[_bspEmailMode];
  const vars = _bspBuildEmailVars(_bspEmailMode, _bspEmailBspId);

  document.getElementById('bsp-email-modal-title').textContent =
    _bspEmailMode === 'protokoll' ? 'Protokoll versenden' : 'Pendenzen-Reminder senden';
  document.getElementById('bsp-email-subject').value = _bspSubstitute(tpl.subject, vars);
  document.getElementById('bsp-email-body').value    = _bspSubstitute(tpl.body,    vars);
  document.getElementById('bsp-email-save-tpl').checked = false;

  // Build recipient chips
  const contacts      = (typeof loadContacts === 'function') ? loadContacts() : [];
  const emailContacts = contacts.filter(c => c.email);
  const recipEl       = document.getElementById('bsp-email-recipients');

  if (!emailContacts.length) {
    recipEl.innerHTML = '<span style="font-size:11px;color:#9ca3af;font-style:italic;">Keine Kontakte mit E-Mail-Adresse erfasst.</span>';
  } else {
    // Pre-selection: try to match by name or select all
    let preSelected = new Set();
    if (_bspEmailMode === 'protokoll' && _bspEmailBspId) {
      const bspTn = (_getBspById(_bspEmailBspId)?.teilnehmer || '').toLowerCase();
      emailContacts.forEach(c => { if (c.name && bspTn.includes(c.name.toLowerCase())) preSelected.add(c.id); });
    } else if (_bspEmailMode === 'reminder') {
      const assignees = new Set();
      loadBsp().forEach(b => (b.traktanden || []).forEach(t => (t.tasks || []).forEach(task => {
        if (!task.done && task.assignee) assignees.add(task.assignee.toLowerCase());
      })));
      emailContacts.forEach(c => { if (c.name && assignees.has(c.name.toLowerCase())) preSelected.add(c.id); });
    }
    if (!preSelected.size) emailContacts.forEach(c => preSelected.add(c.id));

    recipEl.innerHTML = emailContacts.map(c => `
      <label title="${c.email}" style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border:1px solid #e5e7eb;border-radius:20px;cursor:pointer;font-size:11px;background:white;white-space:nowrap;">
        <input type="checkbox" value="${c.id}" data-email="${c.email}" ${preSelected.has(c.id) ? 'checked' : ''} style="cursor:pointer;">
        ${c.name || c.email}
      </label>`).join('');
  }

  modal.style.display = 'flex';
}

function closeBspEmailModal() {
  const modal = document.getElementById('bsp-email-modal');
  if (modal) modal.style.display = 'none';
}

function _bspEmailResetBody() {
  const tpl  = loadBspEmailTemplates()[_bspEmailMode];
  const vars = _bspBuildEmailVars(_bspEmailMode, _bspEmailBspId);
  document.getElementById('bsp-email-subject').value = _bspSubstitute(tpl.subject, vars);
  document.getElementById('bsp-email-body').value    = _bspSubstitute(tpl.body,    vars);
}

function sendBspEmail() {
  const subject = document.getElementById('bsp-email-subject')?.value || '';
  const body    = document.getElementById('bsp-email-body')?.value    || '';
  const saveTpl = document.getElementById('bsp-email-save-tpl')?.checked;

  if (saveTpl) {
    const tpls = loadBspEmailTemplates();
    tpls[_bspEmailMode] = { subject, body };
    _saveBspEmailTemplates(tpls);
  }

  const emails = Array.from(
    document.querySelectorAll('#bsp-email-recipients input[type="checkbox"]:checked')
  ).map(cb => cb.dataset.email).filter(Boolean);

  const mailto = 'mailto:' + emails.join(',')
    + '?subject=' + encodeURIComponent(subject)
    + '&body='    + encodeURIComponent(body);

  window.location.href = mailto;
  closeBspEmailModal();
}

// --- Template-Editor ---
function openBspEmailTemplateModal() {
  const tpls = loadBspEmailTemplates();
  document.getElementById('bsp-tpl-prot-subject').value = tpls.protokoll.subject;
  document.getElementById('bsp-tpl-prot-body').value    = tpls.protokoll.body;
  document.getElementById('bsp-tpl-rem-subject').value  = tpls.reminder.subject;
  document.getElementById('bsp-tpl-rem-body').value     = tpls.reminder.body;
  const modal = document.getElementById('bsp-email-tpl-modal');
  if (modal) modal.style.display = 'flex';
}

function closeBspEmailTemplateModal() {
  const modal = document.getElementById('bsp-email-tpl-modal');
  if (modal) modal.style.display = 'none';
}

function saveBspEmailTemplatesFromModal() {
  _saveBspEmailTemplates({
    protokoll: {
      subject: document.getElementById('bsp-tpl-prot-subject')?.value || '',
      body:    document.getElementById('bsp-tpl-prot-body')?.value    || ''
    },
    reminder: {
      subject: document.getElementById('bsp-tpl-rem-subject')?.value || '',
      body:    document.getElementById('bsp-tpl-rem-body')?.value    || ''
    }
  });
  closeBspEmailTemplateModal();
}

async function resetBspEmailTemplates() {
  if (!await ui.confirm('Vorlagen auf Standardtexte zurücksetzen?')) return;
  _saveBspEmailTemplates(_bspEmailDefaultTemplates);
  closeBspEmailTemplateModal();
  renderMailvorlagenPanel();
}

// Teilen-Button für Abnahme/Aushub — öffnet E-Mail mit exportiertem PDF als Hinweis
function openProtoEmailModal(type) {
  const pn = (typeof getActiveProjectName === 'function' ? getActiveProjectName() : '') || 'Projekt';
  const tpl = loadBspEmailTemplates();
  const subject = encodeURIComponent(`${type === 'abnahme' ? 'Abnahme-Übersicht' : 'Aushubprotokoll'} – ${pn}`);
  const body = encodeURIComponent(
    `Guten Tag\n\nIm Anhang finden Sie ${type === 'abnahme' ? 'die Abnahme-Übersicht' : 'das Aushubprotokoll'} für das Projekt ${pn}.\n\nBitte laden Sie zuerst den PDF-Export herunter und fügen Sie diesen als Anhang hinzu.\n\nFreundliche Grüsse`
  );
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

function renderMailvorlagenPanel() {
  const el = document.getElementById('mailvorlagen-panel-content');
  if (!el) return;
  const tpls = loadBspEmailTemplates();
  el.innerHTML = `
    <div style="margin-bottom:16px;padding:14px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;">
      <div style="font-size:12px;font-weight:700;color:#1a3a5c;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        Protokoll versenden
      </div>
      <div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:3px;">Betreff</div>
        <input id="mv-prot-subject" type="text" value="${(tpls.protokoll.subject||'').replace(/"/g,'&quot;')}" style="width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid #d1d5db;border-radius:7px;font-size:12px;font-family:inherit;">
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:3px;">Text</div>
        <textarea id="mv-prot-body" rows="6" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #d1d5db;border-radius:7px;font-size:11px;font-family:inherit;resize:vertical;line-height:1.5;">${tpls.protokoll.body||''}</textarea>
      </div>
    </div>
    <div style="padding:14px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;">
      <div style="font-size:12px;font-weight:700;color:#1a3a5c;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Pendenzen-Reminder
      </div>
      <div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:3px;">Betreff</div>
        <input id="mv-rem-subject" type="text" value="${(tpls.reminder.subject||'').replace(/"/g,'&quot;')}" style="width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid #d1d5db;border-radius:7px;font-size:12px;font-family:inherit;">
      </div>
      <div>
        <div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:3px;">Text</div>
        <textarea id="mv-rem-body" rows="6" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #d1d5db;border-radius:7px;font-size:11px;font-family:inherit;resize:vertical;line-height:1.5;">${tpls.reminder.body||''}</textarea>
      </div>
    </div>`;
}

function saveMailvorlagenFromPanel() {
  _saveBspEmailTemplates({
    protokoll: {
      subject: document.getElementById('mv-prot-subject')?.value || '',
      body:    document.getElementById('mv-prot-body')?.value    || ''
    },
    reminder: {
      subject: document.getElementById('mv-rem-subject')?.value  || '',
      body:    document.getElementById('mv-rem-body')?.value     || ''
    }
  });
  const btn = document.querySelector('[onclick*="saveMailvorlagenFromPanel"]');
  if (btn) { btn.textContent = '✓ Gespeichert'; setTimeout(() => btn.textContent = 'Speichern', 1500); }
}

// ============================================================
// loadAllFotos — sammelt Fotos aller Paare aus getPairData
// ============================================================
// Liefert Data-URLs (nicht Object-URLs): die Auswahl wird dauerhaft
// im BSP-Dokument gespeichert und muss einen Reload überleben.
async function loadAllFotos() {
  const result = {};
  for (const p of PAIRS) {
    const fotos = (getPairData(p.id).fotos || []).filter(f => f && (f.blobId || f.data));
    if (!fotos.length) continue;
    const mitSrc = await Promise.all(fotos.map(async f =>
      ({ src: await fotoDataUrl(f), caption: f.caption || '' })));
    result[p.id] = mitSrc.filter(f => f.src);
  }
  return result;
}

