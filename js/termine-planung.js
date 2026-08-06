// EREIGNISSE / BAUPROGRAMM
// ============================================================
const EREIGNISSE_KEY = () => 'sp_ereignisse__' + _activeId;
function loadEreignisse()     { try { return jsonParse(store.getItem(EREIGNISSE_KEY())) || []; } catch { return []; } }
function saveEreignisse(list) { store.setItem(EREIGNISSE_KEY(), JSON.stringify(list)); }

const EREIGNIS_TYPEN = {
  begehung:  { label: 'Begehung',       color: '#2563eb', bg: '#eff6ff' },
  sondierung:{ label: 'Sondierung',     color: '#16a34a', bg: '#dcfce7' },
  abnahme:   { label: 'Abnahme',        color: '#7c3aed', bg: '#f3e8ff' },
  sonstig:   { label: 'Sonstiges',      color: '#6b7280', bg: '#f3f4f6' },
  // Bau-Ausführung: nur noch intern (Bauprogramm) — nicht mehr im Dropdown
  bau:       { label: 'Bau-Ausführung', color: '#ea580c', bg: '#fff7ed' },
};
const EREIGNIS_STATUS = {
  geplant:       { label: 'Geplant',       color: '#6b7280', bg: '#f3f4f6' },
  bestaetigt:    { label: 'Bestätigt',     color: '#2563eb', bg: '#dbeafe' },
  abgeschlossen: { label: 'Abgeschlossen', color: '#16a34a', bg: '#dcfce7' },
  abgesagt:      { label: 'Abgesagt',      color: '#dc2626', bg: '#fee2e2' },
};

let _ergEditId = null;
let _ergPreselectedPairId = null;

// ── Ausführungsplanung: Inline-Tabelle im Programm-View ─────────────────
function renderAusfPlanungInline() {
  const table  = document.getElementById('ausfplanung-inline-table');
  if (!table) return;
  const pairs  = getFilteredSorted();
  const allBp  = loadAllBauprojekt();
  const spList = loadSperrmuster();

  // Zähler-Label aktualisieren
  const cntLbl = document.getElementById('ausf-il-count-label');
  if (cntLbl) cntLbl.textContent = pairs.length ? `${pairs.length} Standorte` : '';

  if (!pairs.length) {
    table.innerHTML = `<tbody><tr><td colspan="8" style="text-align:center;padding:32px;font-size:12px;color:#9ca3af;">
      Keine Standorte in dieser Phase.</td></tr></tbody>`;
    return;
  }

  const spOpts = `<option value="">— Sperrmuster —</option>` +
    spList.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

  const GERAET_OPTS = `<option value="">— Gerät —</option>
    <option value="bagger">Bagger</option>
    <option value="bohrmaschine">Bohrmaschine</option>
    <option value="kran">Kran</option>
    <option value="sonstige">Sonstige</option>`;

  const STATUS_OPTS = `<option value="geplant">Geplant</option>
    <option value="bestaetigt">Bestätigt</option>
    <option value="abgeschlossen">Abgeschlossen</option>
    <option value="abgesagt">Abgesagt</option>`;

  const thS = 'padding:7px 8px;font-size:10px;font-weight:700;text-align:left;white-space:nowrap;color:white;';

  const rows = pairs.map((p, i) => {
    const bp  = allBp[p.id] || {};
    const pd  = getPairData(p.id);
    const km  = p.km_rs  ? parseFloat(p.km_rs).toFixed(3)  :
                p.km_rks ? parseFloat(p.km_rks).toFixed(3) : '—';
    const lbl = p.bezeichnung || (p.mast ? 'Mast ' + p.mast : 'ID ' + p.id);
    const bg  = i % 2 === 0 ? '#ffffff' : '#f9fafb';

    // Anzahl Schichten aus Auto-Berechnung
    const sch = getSchichtenForPair(p.id);
    const schTxt = sch ? `<span style="font-size:11px;font-weight:600;color:#1a3a5c;">${sch}</span>` :
      `<span style="font-size:11px;color:#d1d5db;">—</span>`;

    // Status-Badge Farbe
    const stVal = pd.status || 'geplant';
    const stStyles = {
      geplant:      ['#dbeafe','#2563eb'],
      bestaetigt:   ['#dcfce7','#16a34a'],
      abgeschlossen:['#f0fdf4','#15803d'],
      abgesagt:     ['#fee2e2','#dc2626'],
    };
    const [stBg, stFg] = stStyles[stVal] || ['#f3f4f6','#6b7280'];

    // Sperrmuster Auto-Match Chip
    const resolvedSp = resolveSpForPair(p.id);
    const gleisWarn  = resolvedSp?.gleisNr && p.gleis &&
      !resolvedSp.gleisNr.split(/[,\/\s]+/).map(s => s.trim()).filter(Boolean).includes(String(p.gleis).trim());
    const spChip = resolvedSp
      ? `<span style="font-size:10px;padding:2px 7px;border-radius:4px;background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;white-space:nowrap;" title="${resolvedSp.name}">${resolvedSp.name}${gleisWarn ? ' <span style="color:#b91c1c;" title="Gleis-Mismatch">' + svgIcon('warnung',{groesse:10}) + '</span>' : ''}</span>`
      : `<span style="font-size:10px;color:#d1d5db;">— kein Muster —</span>`;

    // Gerät Select
    const geraetVals = ['lkw-kran','robel','raupe','bagger','sonstiges'];
    const geraetLabels = ['LKW-Kran','Robel','Raupe','Bagger','Sonstiges'];
    const selGerOpts = geraetVals.map((v,j) =>
      `<option value="${v}" ${bp.ausfGeraet === v ? 'selected' : ''}>${geraetLabels[j]}</option>`
    ).join('');

    // Status Select
    const stVals   = ['geplant','bestaetigt','abgeschlossen','abgesagt'];
    const stLabels = ['Geplant','Bestätigt','Abgeschlossen','Abgesagt'];
    const selStOpts = stVals.map((v,j) =>
      `<option value="${v}" ${stVal === v ? 'selected' : ''}>${stLabels[j]}</option>`
    ).join('');

    // Bedingungen-Chips
    const bedChips = [
      ['ausfGleisgebunden',    'GL'],
      ['ausfHoehenbegrenzung', 'HB'],
      ['ausfAbschaltung',      'FL'],
      ['ausfNachbargleis',     'NG'],
    ].map(([field, abbr]) => bp[field]
      ? `<span style="font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;background:#dbeafe;color:#1d4ed8;border:1px solid #bfdbfe;">${abbr}</span>`
      : `<span style="font-size:9px;padding:2px 5px;border-radius:4px;background:#f3f4f6;color:#d1d5db;border:1px solid #e5e7eb;">${abbr}</span>`
    ).join('');

    return `<tr id="ausf-il-row-${p.id}" class="list-hover-row" style="background:${bg};">
      <td style="padding:6px 8px;font-size:10px;font-weight:700;color:#9ca3af;text-align:center;">T${i+1}</td>
      <td style="padding:6px 8px;">
        <span style="font-size:11px;font-weight:700;color:#1a3a5c;">${lbl}</span>
      </td>
      <td style="padding:6px 8px;font-size:11px;color:#6b7280;">${km}</td>
      <td style="padding:6px 8px;">${spChip}</td>
      <td style="padding:6px 8px;text-align:center;">${schTxt}</td>
      <td style="padding:6px 8px;">
        <select id="ausf-il-${p.id}-ger"
          style="padding:3px 6px;border:1px solid #e5e7eb;border-radius:5px;font-size:10px;font-family:inherit;background:white;min-width:90px;"
          onchange="saveAusfPlanungInline(${p.id})">
          <option value="">— Gerät —</option>
          ${selGerOpts}
        </select>
      </td>
      <td style="padding:6px 8px;">
        <div style="display:flex;gap:3px;flex-wrap:wrap;cursor:pointer;"
          onclick="toggleAusfBedingungen(${p.id})" title="Klicken zum Bearbeiten">
          ${bedChips}
        </div>
      </td>
      <td style="padding:6px 8px;">
        <select id="ausf-il-${p.id}-st"
          style="padding:3px 6px;border:1px solid transparent;border-radius:5px;font-size:10px;font-family:inherit;background:${stBg};color:${stFg};font-weight:600;min-width:100px;"
          onchange="saveAusfPlanungInline(${p.id})"
          onfocus="this.style.border='1px solid #e5e7eb'" onblur="this.style.border='1px solid transparent'">
          ${selStOpts}
        </select>
      </td>
    </tr>`;
  }).join('');

  table.innerHTML = `
    <thead>
      <tr style="background:#1a3a5c;">
        <th style="${thS}width:32px;text-align:center;">#</th>
        <th style="${thS}">Standort</th>
        <th style="${thS}width:70px;">KM</th>
        <th style="${thS}">Sperrmuster</th>
        <th style="${thS}width:60px;text-align:center;" title="Anzahl Schichten (auto)">Sch.</th>
        <th style="${thS}">Gerät</th>
        <th style="${thS}width:100px;" title="GL=Gleisgebunden, HB=Höhenbegr., FL=FL-Abschaltung, NG=Nachbargleis">Bedingungen</th>
        <th style="${thS}">Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>`;
}

// Bedingungen-Inline-Editor: Toggle-Popover für die 4 Checkboxen
function toggleAusfBedingungen(pairId) {
  const existingPop = document.getElementById('ausf-bed-popover');
  if (existingPop) {
    const isForSame = existingPop.dataset.pairId == pairId;
    existingPop.remove();
    if (isForSame) return;
  }

  const bp  = loadAllBauprojekt()[pairId] || {};
  const row = document.getElementById('ausf-il-row-' + pairId);
  if (!row) return;
  const bedCell = row.cells[6];

  const pop = document.createElement('div');
  pop.id = 'ausf-bed-popover';
  pop.dataset.pairId = pairId;
  pop.style.cssText = 'position:absolute;background:white;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;z-index:1000;box-shadow:0 4px 16px rgba(0,0,0,.12);';

  const fields = [
    ['ausfGleisgebunden',    'Gleisgebunden'],
    ['ausfHoehenbegrenzung', 'Höhenbegr.'],
    ['ausfAbschaltung',      'FL-Abschaltung'],
    ['ausfNachbargleis',     'Nachbargleis'],
  ];
  pop.innerHTML = fields.map(([f, lbl]) =>
    `<label style="display:flex;align-items:center;gap:8px;font-size:11px;color:#374151;cursor:pointer;margin-bottom:6px;">
      <input type="checkbox" ${bp[f] ? 'checked' : ''} style="accent-color:#1a3a5c;"
        onchange="saveAusfBedingungInline(${pairId},'${f}',this.checked)">
      ${lbl}
    </label>`
  ).join('') + `<div style="text-align:right;margin-top:4px;">
    <button onclick="document.getElementById('ausf-bed-popover')?.remove()"
      style="font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid #d1d5db;background:white;cursor:pointer;color:#374151;">
      Schliessen
    </button>
  </div>`;

  // Positionierung relativ zu bedCell
  document.body.appendChild(pop);
  const rect = bedCell.getBoundingClientRect();
  pop.style.top  = (window.scrollY + rect.bottom + 4) + 'px';
  pop.style.left = (window.scrollX + rect.left) + 'px';

  // Schliessen bei Klick ausserhalb
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!pop.contains(e.target) && !bedCell.contains(e.target)) {
        pop.remove();
        document.removeEventListener('click', handler);
      }
    });
  }, 50);
}

function saveAusfBedingungInline(pairId, field, checked) {
  const all = loadAllBauprojekt();
  all[pairId] = { ...(all[pairId] || {}), [field]: checked };
  saveAllBauprojekt(all);
  renderAusfPlanungInline();  // Chips aktualisieren
}

// Ausführungsplanung Excel-Export
function exportAusfIlXlsx() {
  if (typeof XLSX === 'undefined') { ui.toast('SheetJS nicht geladen.', 'fehler'); return; }
  const pairs  = getFilteredSorted();
  const allBp  = loadAllBauprojekt();
  const spList = loadSperrmuster();
  const rows   = [['#', 'Standort', 'KM', 'Sperrmuster', 'Sch.', 'Gerät', 'Gleisgebunden', 'Höhenbegr.', 'FL-Absch.', 'Nachbargl.', 'Status']];
  pairs.forEach((p, i) => {
    const bp  = allBp[p.id] || {};
    const pd  = getPairData(p.id);
    const sp  = resolveSpForPair(p.id);
    const sch = getSchichtenForPair(p.id);
    const km  = p.km_rs ? parseFloat(p.km_rs).toFixed(3) : '';
    const lbl = p.bezeichnung || (p.mast ? 'Mast ' + p.mast : 'ID ' + p.id);
    rows.push([
      `T${i+1}`, lbl, km, sp ? sp.name : '',
      sch || '', bp.ausfGeraet || '',
      bp.ausfGleisgebunden ? 'Ja' : '',
      bp.ausfHoehenbegrenzung ? 'Ja' : '',
      bp.ausfAbschaltung ? 'Ja' : '',
      bp.ausfNachbargleis ? 'Ja' : '',
      pd.status || 'geplant',
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ausführungsplanung');
  XLSX.writeFile(wb, `Ausfuehrungsplanung_${new Date().toLocaleDateString('de-CH').replace(/\./g,'-')}.xlsx`);
}

// Ausführungsplanung PDF-Export
function exportAusfIlPdf() {
  const jsPDFLib = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFLib) { ui.toast('jsPDF nicht geladen.', 'fehler'); return; }
  const doc    = new jsPDFLib({ orientation:'landscape', unit:'mm', format:'a4' });
  const pairs  = getFilteredSorted();
  const allBp  = loadAllBauprojekt();
  const spList = loadSperrmuster();
  const pn     = getActiveProjectName() || 'Projekt';
  const date   = new Date().toLocaleDateString('de-CH');

  doc.setFillColor(26,58,92); doc.rect(0,0,297,3,'F');
  doc.setFontSize(12); doc.setFont(undefined,'bold'); doc.setTextColor(26,58,92);
  doc.text('Ausführungsplanung · ' + pn, 14, 11);
  doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.setTextColor(107,114,128);
  doc.text(date + ' · ' + pairs.length + ' Standorte', 14, 17);
  doc.setDrawColor(229,231,235); doc.line(14,20,283,20);

  const xs  = [14, 38, 68, 85, 148, 168, 196, 222, 230, 238, 246];
  const hdrs= ['#','Standort','KM','Sperrmuster','Sch.','Gerät','GL','HB','FL','NG','Status'];
  let y = 28;

  const drawHeader = () => {
    doc.setFillColor(26,58,92); doc.rect(14, y-4, 269, 7, 'F');
    doc.setFontSize(7); doc.setFont(undefined,'bold'); doc.setTextColor(255,255,255);
    hdrs.forEach((h,i) => doc.text(h, xs[i], y));
    y += 7; doc.setTextColor(30,30,30);
  };
  drawHeader();

  pairs.forEach((p, ri) => {
    if (y > 196) { doc.addPage(); y = 14; drawHeader(); }
    const bp  = allBp[p.id] || {};
    const pd  = getPairData(p.id);
    const sp  = resolveSpForPair(p.id);
    const sch = getSchichtenForPair(p.id);
    const km  = p.km_rs ? parseFloat(p.km_rs).toFixed(3) : '—';
    const lbl = p.bezeichnung || (p.mast ? 'Mast ' + p.mast : 'ID ' + p.id);
    const stVal = pd.status || 'geplant';
    const stCols = { geplant:[37,99,235], bestaetigt:[22,163,74], abgeschlossen:[21,128,61], abgesagt:[220,38,38] };

    if (ri % 2 === 1) { doc.setFillColor(248,250,252); doc.rect(14, y-4, 269, 6, 'F'); }
    doc.setFont(undefined,'bold'); doc.setFontSize(7); doc.setTextColor(107,114,128);
    doc.text(`T${ri+1}`, xs[0], y);
    doc.setTextColor(30,30,30);
    doc.text(doc.splitTextToSize(lbl,23)[0], xs[1], y);
    doc.setFont(undefined,'normal');
    doc.text(km, xs[2], y);
    doc.text(sp ? doc.splitTextToSize(sp.name,60)[0] : '—', xs[3], y);
    doc.text(sch ? String(sch) : '—', xs[4], y);
    doc.text(bp.ausfGeraet || '—', xs[5], y);
    const mkDot = (val, xi) => {
      if (val) { doc.setTextColor(22,163,74); doc.text('✓', xs[xi], y); }
      else { doc.setTextColor(209,213,219); doc.text('–', xs[xi], y); }
      doc.setTextColor(30,30,30);
    };
    mkDot(bp.ausfGleisgebunden,    6);
    mkDot(bp.ausfHoehenbegrenzung, 7);
    mkDot(bp.ausfAbschaltung,      8);
    mkDot(bp.ausfNachbargleis,     9);
    const sc = stCols[stVal] || [107,114,128];
    doc.setTextColor(...sc); doc.setFont(undefined,'bold');
    doc.text(stVal.charAt(0).toUpperCase()+stVal.slice(1), xs[10], y);
    doc.setTextColor(30,30,30); doc.setFont(undefined,'normal');
    y += 6;
  });
  doc.save(`Ausfuehrungsplanung_${date.replace(/\./g,'-')}.pdf`);
}

function saveAusfPlanungInline(pairId) {
  const all = loadAllBauprojekt();
  const bp  = all[pairId] || {};
  const val = id => document.getElementById(id)?.value;

  // Bedingungen werden separat via saveAusfBedingungInline gespeichert → hier nicht überschreiben
  all[pairId] = {
    ...bp,
    ausfGeraet: val('ausf-il-' + pairId + '-ger') || null,
  };
  saveAllBauprojekt(all);

  // Status auf pair-Ebene speichern (falls geändert)
  const statusVal = val('ausf-il-' + pairId + '-st');
  const pd = getPairData(pairId);
  if (statusVal && statusVal !== pd.status) {
    setPairData(pairId, { ...pd, status: statusVal });
    renderCards();
    if (currentOverviewView === 'liste') renderList();
  }

  // Schichten-Zelle live aktualisieren (abhängig vom Sperrmuster)
  const row = document.getElementById('ausf-il-row-' + pairId);
  if (row) {
    const sch   = getSchichtenForPair(pairId);
    const schTd = row.cells[4];
    if (schTd) schTd.innerHTML = sch
      ? `<span style="font-size:11px;font-weight:600;color:#1a3a5c;">${sch}</span>`
      : `<span style="font-size:11px;color:#d1d5db;">—</span>`;
  }

}

// Programm-View: STARTTERMINE + Bibliotheken + Briefe
function renderProgrammView() {
  // Programm-Tab wurde in Bauprogramm-Tab überführt
  setOverviewView('bauprogramm');
}

// Termine-View: Ereignisse, Meilensteine, Bauprogramm, Abnahmen
function renderTermineView() {
  renderEreignisListe();
  renderTermineMeilensteine();
  renderTermineBauprogramm();
  renderTermineMatBestellung();
  renderTermineAbnahmen();
}

function renderTermineMatBestellung() {
  const sumWrap  = document.getElementById('termine-material-summary');
  const listWrap = document.getElementById('termine-material-list');
  if (!sumWrap || !listWrap) return;

  const allBp   = loadAllBauprojekt();
  const allAusf = loadAllAusfuehrung();
  const ftProf  = loadFtProfile();

  const positionen = PAIRS.map(p => {
    const bp = allBp[p.id] || {};
    if (bp.bestand !== 'neu' && bp.bestand !== 'prov') return null;
    const ausf   = allAusf[p.id] || {};
    const ft     = bp.fundtyp ? ftProf.find(t => t.name === bp.fundtyp) : null;
    const status = ausf.matStatus || '';
    return { pair: p, bp, ft, status, bestellNr: ausf.matBestellung || '', lieferdatum: ausf.matLieferdatum || '' };
  }).filter(Boolean);

  if (!positionen.length) {
    sumWrap.innerHTML  = '<div style="font-size:11px;color:#9ca3af;">Keine Neubau/Prov-Positionen erfasst.</div>';
    listWrap.innerHTML = '';
    return;
  }

  // Status-Summierung
  const cnt = { geliefert:0, bestellt:0, pendent:0, offen:0 };
  positionen.forEach(p => {
    if      (p.status === 'geliefert') cnt.geliefert++;
    else if (p.status === 'bestellt')  cnt.bestellt++;
    else if (p.status === 'pendent')   cnt.pendent++;
    else                               cnt.offen++;
  });

  const chip = (label, n, col) => n > 0
    ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:10px;background:${col}18;border:1px solid ${col}55;font-size:11px;font-weight:600;color:${col};">${n} ${label}</span>`
    : '';
  sumWrap.innerHTML = [
    chip('Geliefert', cnt.geliefert, '#16a34a'),
    chip('Bestellt',  cnt.bestellt,  '#2563eb'),
    chip('Pendent',   cnt.pendent,   '#d97706'),
    chip('Offen',     cnt.offen,     '#9ca3af'),
  ].filter(Boolean).join('') || '';

  const STATUS_COL = { geliefert:'#16a34a', bestellt:'#2563eb', pendent:'#d97706' };
  const STATUS_LBL = { geliefert:'Geliefert', bestellt:'Bestellt', pendent:'Pendent' };

  listWrap.innerHTML = positionen.map(({ pair: p, bp, ft, status, bestellNr, lieferdatum }) => {
    const col = STATUS_COL[status] || '#9ca3af';
    const lbl = STATUS_LBL[status] || 'Offen';
    const meta = [ft?.name, bestellNr ? 'Best.Nr. ' + bestellNr : '', lieferdatum ? 'Lieferung ' + lieferdatum : ''].filter(Boolean).join(' · ');
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid #e5e7eb;border-radius:7px;background:white;">
      <span style="width:8px;height:8px;border-radius:50%;background:${col};flex-shrink:0;"></span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:600;color:#1a3a5c;">Mast ${p.mast || p.id}
          <span style="font-size:10px;font-weight:400;color:#9ca3af;margin-left:4px;">${bp.bestand === 'prov' ? 'Prov.' : 'Neubau'}</span>
        </div>
        ${meta ? `<div style="font-size:10px;color:#6b7280;margin-top:1px;">${meta}</div>` : ''}
      </div>
      <span style="font-size:10px;font-weight:700;color:${col};white-space:nowrap;">${lbl}</span>
    </div>`;
  }).join('');
}

function renderTermineMeilensteine() {
  const wrap = document.getElementById('termine-meilensteine-list');
  if (!wrap) return;
  const list   = loadMeilensteine().sort((a, b) => {
    const da = msMsResolvedDatum(a) || '9999';
    const db = msMsResolvedDatum(b) || '9999';
    return da.localeCompare(db);
  });
  if (!list.length) {
    wrap.innerHTML = '<div style="font-size:11px;color:#9ca3af;padding:8px 0;">Noch keine Meilensteine erfasst.</div>';
    return;
  }
  const TYP_LABEL = { baubeginn:'Baubeginn', 'fl-montage':'FL-Montage', 'vfk-vorabnahme':'VFK Vorabnahme', materialbestellung:'Materialbestellung', abnahme:'Abnahme', frei:'Meilenstein' };
  const today = new Date().toISOString().split('T')[0];
  const calSvg = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  wrap.innerHTML = list.map(ms => {
    const d     = msMsResolvedDatum(ms);
    const col   = ms.farbe || '#7c3aed';
    const past  = d && d < today;
    const typ   = TYP_LABEL[ms.typ] || ms.typ;
    const abhLbl = ms.abh?.typ === 'nach-ausschal-gruppe' ? 'Auto: nach Ausschal Gruppe' : '';
    return `<div
      style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:white;border:1px solid #e5e7eb;border-radius:8px;opacity:${past?'0.6':'1'};">
      <div style="width:4px;min-height:40px;border-radius:2px;background:${col};flex-shrink:0;"></div>
      <div style="min-width:80px;text-align:center;">
        <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:4px;background:#f1f5f9;color:#64748b;white-space:nowrap;">${typ}</span>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:#1a3a5c;margin-bottom:2px;">${ms.label||'(kein Label)'}</div>
        <div style="font-size:11px;color:#6b7280;display:flex;align-items:center;gap:4px;">${calSvg} ${d ? bpFmtDisplay(d) : '—'}${abhLbl ? ' · <em>' + abhLbl + '</em>' : ''}</div>
      </div>
    </div>`;
  }).join('');
}

function renderTermineBauprogramm() {
  const wrap = document.getElementById('termine-bauprogramm-list');
  if (!wrap) return;
  const pakete = loadBaupakete().sort((a, b) => (a.startDatum || '').localeCompare(b.startDatum || ''));
  const einst  = loadProjEinst();
  const teams  = einst.teams || [];
  if (!pakete.length) {
    wrap.innerHTML = '<div style="font-size:11px;color:#9ca3af;padding:8px 0;">Noch keine Baupakete erfasst.</div>';
    return;
  }
  const fmt = d => { if (!d) return '—'; const [y,m,dd]=d.split('-'); return `${dd}.${m}.${y}`; };
  const mapPinSvg = `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:7px;background:#f0f4f8;border:1px solid #dde3ea;flex-shrink:0;" title="Auf Karte zeigen"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2.2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>`;
  wrap.innerHTML = pakete.map(pak => {
    const col  = pak.farbe || '#1a3a5c';
    const end  = bpPaketEnd(pak);
    const team = pak.teamId ? teams.find(t => t.id === pak.teamId) : null;
    const vaList = (pak.vorarbeiten || []).map(va => {
      const vaStart = pak.startDatum ? bpFmtDate(bpAddDays(bpParseDate(pak.startDatum), va.offsetTage ?? -14)) : null;
      return `<span style="font-size:10px;color:#6b7280;">${va.name || 'Vorarbeit'}: ${vaStart ? fmt(vaStart) : '—'}</span>`;
    }).join(' · ');
    return `<div onclick="openBpFullscreen('${pak.id}')"
      style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:white;border:1px solid #e5e7eb;border-radius:8px;cursor:pointer;transition:background 0.1s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
      <div style="width:4px;min-height:40px;border-radius:2px;background:${col};flex-shrink:0;margin-top:2px;"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:#1a3a5c;margin-bottom:2px;">${pak.name}</div>
        <div style="font-size:11px;color:#6b7280;">
          ${pak.startDatum ? `Bau: ${fmt(pak.startDatum)}${end ? ' – ' + fmt(end) : ''}` : 'Kein Startdatum'}
          ${pak.anzahlNaechte ? ` · ${pak.anzahlNaechte} Nächte` : ''}
          ${team ? ` · ${team.name}` : ''}
        </div>
        ${vaList ? `<div style="margin-top:3px;">${vaList}</div>` : ''}
      </div>
      ${mapPinSvg}
    </div>`;
  }).join('');
}

function renderTermineAbnahmen() {
  const wrap = document.getElementById('termine-abnahmen-list');
  if (!wrap) return;
  const all = loadAllChecklisten();
  const fmt = d => { if (!d) return '—'; const [y,m,dd]=d.split('-'); return `${dd}.${m}.${y}`; };
  const rows = PAIRS.filter(p => all[p.id]?.datum).map(p => ({ p, ck: all[p.id] }));
  rows.sort((a, b) => (a.ck.datum || '').localeCompare(b.ck.datum || ''));
  if (!rows.length) {
    wrap.innerHTML = '<div style="font-size:11px;color:#9ca3af;padding:8px 0;">Noch keine Abnahmen erfasst.</div>';
    return;
  }
  const calSvgA  = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const pplSvgA  = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  wrap.innerHTML = rows.map(({ p, ck }) => {
    const anw = ck.anwesend ? ck.anwesend.split(',').map(s => s.trim()).filter(Boolean) : [];
    const mngCount = typeof CK_PRUEFPUNKTE !== 'undefined'
      ? CK_PRUEFPUNKTE.filter(x => ck[`ck_${x.id}_ok`] === 'mangel').length : 0;
    const statusBg  = mngCount > 0 ? '#fee2e2' : '#dcfce7';
    const statusCol = mngCount > 0 ? '#b91c1c' : '#15803d';
    const statusLbl = mngCount > 0 ? `${mngCount} Mängel` : 'OK';
    return `<div onclick="openCheckliste(${p.id})"
      style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:white;border:1px solid #e5e7eb;border-radius:8px;cursor:pointer;transition:background 0.1s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:#1a3a5c;margin-bottom:2px;">Mast ${p.mast || p.id} · KM ${p.km_rs ? parseFloat(p.km_rs).toFixed(3) : '—'}</div>
        <div style="font-size:11px;color:#6b7280;display:flex;align-items:center;gap:4px;">${calSvgA} ${fmt(ck.datum)}${ck.ort ? ' · ' + ck.ort : ''}</div>
        ${anw.length ? `<div style="font-size:10px;color:#9ca3af;margin-top:2px;display:flex;align-items:center;gap:4px;">${pplSvgA} ${anw.join(', ')}</div>` : ''}
      </div>
      <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;background:${statusBg};color:${statusCol};flex-shrink:0;">${statusLbl}</span>
    </div>`;
  }).join('');
}

// ============================================================
// STARTTERMINE — Multi-Select & Bulk-Zuweisung
// ============================================================
let _stSelectedIds = new Set();

function toggleStRow(pairId, checked) {
  if (checked) _stSelectedIds.add(pairId);
  else _stSelectedIds.delete(pairId);
  _updateStRowHighlight(pairId, checked);
  _updateStSelectAllState();
  updateStBulkBar();
}

function toggleStSelectAll(checked) {
  const pairs = getFilteredSorted();
  pairs.forEach(p => {
    if (checked) _stSelectedIds.add(p.id);
    else _stSelectedIds.delete(p.id);
    const cb = document.getElementById('st-cb-' + p.id);
    if (cb) cb.checked = checked;
    _updateStRowHighlight(p.id, checked);
  });
  updateStBulkBar();
}

function _updateStRowHighlight(pairId, selected) {
  const row = document.getElementById('st-row-' + pairId);
  if (row) row.style.background = selected ? '#eff6ff' : '';
}

function _updateStSelectAllState() {
  const pairs = getFilteredSorted();
  const cb = document.getElementById('st-select-all');
  if (!cb) return;
  cb.checked = _stSelectedIds.size === pairs.length && pairs.length > 0;
  cb.indeterminate = _stSelectedIds.size > 0 && _stSelectedIds.size < pairs.length;
}

function updateStBulkBar() {
  const bar = document.getElementById('st-bulk-bar');
  if (!bar) return;
  const n = _stSelectedIds.size;
  bar.style.display = n > 0 ? 'flex' : 'none';
  const cnt = document.getElementById('st-bulk-count');
  if (cnt) cnt.textContent = n + (n === 1 ? ' Standort' : ' Standorte') + ' ausgewählt';
  _updateStSelectAllState();
}

function applyStBulkAssign() {
  const schichtId = document.getElementById('st-bulk-schicht')?.value;
  const datum     = document.getElementById('st-bulk-datum')?.value;
  const von       = document.getElementById('st-bulk-von')?.value;
  const bis       = document.getElementById('st-bulk-bis')?.value;
  _stSelectedIds.forEach(pairId => {
    if (schichtId !== undefined) {
      const el = document.getElementById('st-' + pairId + '-schicht');
      if (el) el.value = schichtId;
    }
    if (datum) { const el = document.getElementById('st-' + pairId + '-datum'); if (el) el.value = datum; }
    if (von)   { const el = document.getElementById('st-' + pairId + '-von');   if (el) el.value = von;   }
    if (bis)   { const el = document.getElementById('st-' + pairId + '-bis');   if (el) el.value = bis;   }
  });
  _stSelectedIds.clear();
  // Checkboxen und Highlighting zurücksetzen
  document.querySelectorAll('[id^="st-cb-"]').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('[id^="st-row-"]').forEach(row => { row.style.background = ''; });
  updateStBulkBar();
  // Bulk-Felder leeren
  ['st-bulk-datum','st-bulk-von','st-bulk-bis'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
}

function clearStSelection() {
  _stSelectedIds.clear();
  document.querySelectorAll('[id^="st-cb-"]').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('[id^="st-row-"]').forEach(row => { row.style.background = ''; });
  updateStBulkBar();
}

// Kombinierte Standort-Termine-Tabelle (ersetzt statische T1–T12 Zeilen)
function renderStandortTermine() {
  _stSelectedIds.clear();
  const wrap = document.getElementById('standort-termine-table');
  if (!wrap) return;
  const pairs     = getFilteredSorted();
  const schichten = loadSchichten();
  if (!pairs.length) {
    wrap.innerHTML = '<div style="padding:8px 0;font-size:11px;color:#9ca3af;">Keine Standorte in dieser Phase.</div>';
    return;
  }

  // Bulk-Zuweisung Schicht-Optionen
  const bulkSchichtOpts = `<option value="">— keine —</option>` +
    schichten.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

  // Bulk-Aktionsleiste (versteckt bis Auswahl)
  const bulkBar = `<div id="st-bulk-bar" style="display:none;align-items:center;gap:8px;flex-wrap:wrap;
      background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 12px;margin-bottom:8px;">
    <span id="st-bulk-count" style="font-size:11px;font-weight:700;color:#1d4ed8;white-space:nowrap;min-width:120px;"></span>
    <select id="st-bulk-schicht" style="padding:4px 8px;border:1px solid #93c5fd;border-radius:6px;font-size:11px;font-family:inherit;background:white;min-width:130px;">
      ${bulkSchichtOpts}
    </select>
    <input type="date" id="st-bulk-datum" title="Datum für alle setzen (leer = nicht ändern)"
      style="padding:4px 6px;border:1px solid #93c5fd;border-radius:6px;font-size:11px;font-family:inherit;">
    <input type="time" id="st-bulk-von" title="Von für alle setzen"
      style="padding:4px 6px;border:1px solid #93c5fd;border-radius:6px;font-size:11px;font-family:inherit;width:82px;">
    <input type="time" id="st-bulk-bis" title="Bis für alle setzen"
      style="padding:4px 6px;border:1px solid #93c5fd;border-radius:6px;font-size:11px;font-family:inherit;width:82px;">
    <button onclick="applyStBulkAssign()"
      style="padding:5px 14px;border-radius:6px;border:none;background:#1d4ed8;color:white;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">
      Zuweisen
    </button>
    <button onclick="clearStSelection()"
      style="padding:5px 10px;border-radius:6px;border:1px solid #93c5fd;background:white;color:#374151;font-size:11px;cursor:pointer;">
      ✕
    </button>
  </div>`;

  // Tabellenkopf
  const cols = '16px 28px 1fr 68px 148px 140px 60px 60px';
  const hdr  = `<div style="display:grid;grid-template-columns:${cols};gap:5px;padding-bottom:5px;margin-bottom:3px;border-bottom:1px solid #f0f2f5;align-items:center;">
    <input type="checkbox" id="st-select-all" title="Alle auswählen"
      onchange="toggleStSelectAll(this.checked)"
      style="cursor:pointer;accent-color:#1d4ed8;">
    <span></span>
    <span style="font-size:10px;color:#9ca3af;font-weight:700;">Standort</span>
    <span style="font-size:10px;color:#9ca3af;font-weight:700;">KM</span>
    <span style="font-size:10px;color:#9ca3af;font-weight:700;">Datum</span>
    <span style="font-size:10px;color:#9ca3af;font-weight:700;">Schicht</span>
    <span style="font-size:10px;color:#9ca3af;font-weight:700;">Von</span>
    <span style="font-size:10px;color:#9ca3af;font-weight:700;">Bis</span>
  </div>`;

  const schichtBaseOpts = `<option value="">— keine —</option>` +
    schichten.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

  const rows = pairs.map((p, i) => {
    const pd  = getPairData(p.id);
    const km  = p.km_rs  ? parseFloat(p.km_rs).toFixed(3)
              : p.km_rks ? parseFloat(p.km_rks).toFixed(3) : '—';
    const lbl = p.bezeichnung || (p.mast ? 'Mast ' + p.mast : 'ID ' + p.id);
    const selHtml = schichtBaseOpts.replace(`value="${p.schichtId || ''}"`, `value="${p.schichtId || ''}" selected`);
    const isFirst = i === 0;
    return `<div id="st-row-${p.id}" style="display:grid;grid-template-columns:${cols};gap:5px;align-items:center;padding:2px 0;border-radius:5px;transition:background 0.1s;">
      <input type="checkbox" id="st-cb-${p.id}" onchange="toggleStRow(${p.id}, this.checked)"
        style="cursor:pointer;accent-color:#1d4ed8;">
      <label style="font-size:10px;font-weight:700;color:${isFirst?'#1a3a5c':'#9ca3af'};cursor:default;">S${i+1}${isFirst?'<small style="font-weight:400;color:#9ca3af;"> →</small>':''}</label>
      <span style="font-size:11px;font-weight:600;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${lbl}">${lbl}</span>
      <span style="font-size:10px;color:#9ca3af;">${km}</span>
      <input type="date" id="st-${p.id}-datum" value="${pd.startdatum || ''}"
        onchange="autoFillTermineStandorte(${p.id})"
        style="padding:4px 6px;border:1px solid #e5e7eb;border-radius:5px;font-size:11px;font-family:inherit;width:100%;box-sizing:border-box;">
      <select id="st-${p.id}-schicht"
        style="padding:3px 5px;border:1px solid #e5e7eb;border-radius:5px;font-size:10px;font-family:inherit;background:white;width:100%;">${selHtml}</select>
      <input type="time" id="st-${p.id}-von" value="${pd.startVon || ''}"
        style="padding:3px 4px;border:1px solid #e5e7eb;border-radius:5px;font-size:10px;font-family:inherit;">
      <input type="time" id="st-${p.id}-bis" value="${pd.startBis || ''}"
        style="padding:3px 4px;border:1px solid #e5e7eb;border-radius:5px;font-size:10px;font-family:inherit;">
    </div>`;
  }).join('');

  wrap.innerHTML = bulkBar + hdr + `<div style="display:flex;flex-direction:column;gap:3px;">${rows}</div>`;
}

function renderEreignisListe() {
  const wrap = document.getElementById('ereignisse-list-wrap');
  if (!wrap) return;
  const typFilter    = document.getElementById('erg-filter-typ')?.value    || '';
  const statusFilter = document.getElementById('erg-filter-status')?.value || '';
  let alle = loadEreignisse().sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));
  if (typFilter)    alle = alle.filter(e => e.typ    === typFilter);
  if (statusFilter) alle = alle.filter(e => e.status === statusFilter);
  if (alle.length === 0) {
    wrap.innerHTML = '<div style="padding:20px;text-align:center;color:#9ca3af;font-size:13px;">Noch keine Termine erfasst.</div>';
    return;
  }
  const today = new Date().toISOString().split('T')[0];
  const SCHICHT_BADGE = { tag: 'Tag', nacht: 'Nacht', gemischt: 'Gem.' };
  const GERAET_LABEL  = { 'lkw-kran':'LKW-Kran', robel:'Robel', raupe:'Raupe', bagger:'Bagger', bohrmaschine:'Bohrmaschine', kran:'Kran', sonstiges:'Sonstiges', sonstige:'Sonstige' };
  const SICH_LABEL    = { posten:'Streckenposten', lf:'Lf', sperrung:'Gleissperrung', keine:'Strassenseitig' };
  wrap.innerHTML = alle.map(e => {
    const typ      = EREIGNIS_TYPEN[e.typ]     || EREIGNIS_TYPEN.sonstig;
    const st       = EREIGNIS_STATUS[e.status] || EREIGNIS_STATUS.geplant;
    const fmt      = d => { if (!d) return ''; const [y,m,dd]=d.split('-'); return `${dd}.${m}.${y}`; };
    const past     = e.datum && e.datum < today && e.status !== 'abgeschlossen' && e.status !== 'abgesagt';
    const selected = _ergSelection.has(e.id);
    const slbl     = !e.pairIds || e.pairIds.length === 0
      ? 'Alle Standorte'
      : `${e.pairIds.length} Standort${e.pairIds.length > 1 ? 'e' : ''}`;
    const zeitStr = e.uhrzeit ? (e.uhrzeit + (e.uhrzeitBis ? '–' + e.uhrzeitBis : '')) : '';
    const metaStr = [fmt(e.datum), e.datumBis ? '– '+fmt(e.datumBis):'', zeitStr, e.ort].filter(Boolean).join(' · ');
    const schichtBadge = e.typ === 'bau' && e.schichttyp
      ? `<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:#f3f4f6;color:#374151;margin-left:4px;">${SCHICHT_BADGE[e.schichttyp]||e.schichttyp}</span>` : '';
    const grpBadge = e.typ === 'bau' && e.baugruppe
      ? `<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:#eff6ff;color:#1d4ed8;margin-left:4px;">${e.baugruppe}</span>` : '';
    const erinBadge = e.erinnerung?.datum
      ? `<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:#fef9c3;color:#854d0e;margin-left:4px;">Erin.</span>` : '';
    // Bau-spezifische Info-Chips
    let bauChips = '';
    if (e.typ === 'bau') {
      const chips = [];
      if (e.gleisgebunden)    chips.push('Gleisgebunden');
      if (e.hoehenbegrenzung) chips.push('Höhenbegr.');
      if (e.abschaltung)      chips.push('FL-Abschalt.');
      if (e.nachbargleis)     chips.push('Nachbargleis');
      if (e.geraet)           chips.push(GERAET_LABEL[e.geraet] || e.geraet);
      if (e.sicherung)        chips.push(SICH_LABEL[e.sicherung] || e.sicherung);
      if (e.sperrpause)       chips.push(e.sperrpause);
      if (chips.length) bauChips = `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;">${chips.map(c => `<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:#f1f5f9;color:#475569;white-space:nowrap;">${c}</span>`).join('')}</div>`;
    }
    const checkHtml = _ergMultiselect
      ? `<input type="checkbox" ${selected ? 'checked' : ''} onclick="event.stopPropagation();toggleErgSelect('${e.id}')" style="width:15px;height:15px;accent-color:#1a3a5c;flex-shrink:0;cursor:pointer;">`
      : '';
    const clickHandler = _ergMultiselect
      ? `toggleErgSelect('${e.id}')`
      : `openEreignisModal('${e.id}')`;
    const calSvgE = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;vertical-align:middle;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    return `<div data-erg-id="${e.id}" onclick="${clickHandler}"
      style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:white;border:1px solid ${selected?'#1a3a5c':'#e5e7eb'};border-radius:8px;cursor:pointer;opacity:${past?'0.65':'1'};${selected?'box-shadow:0 0 0 2px #1a3a5c33;':''}">
      ${checkHtml}
      <div style="width:4px;min-height:46px;border-radius:2px;background:${typ.color};flex-shrink:0;"></div>
      <div style="min-width:80px;text-align:center;">
        <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:4px;background:#f1f5f9;color:#64748b;white-space:nowrap;">${typ.label}</span>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:#1a3a5c;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${e.titel||'(kein Titel)'}${schichtBadge}${grpBadge}${erinBadge}
        </div>
        <div style="font-size:11px;color:#6b7280;display:flex;align-items:center;gap:4px;">${calSvgE} ${metaStr||'—'}</div>
        <div style="font-size:10px;color:#9ca3af;margin-top:1px;">${slbl}</div>
        ${bauChips}
      </div>
      <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;background:${st.bg};color:${st.color};white-space:nowrap;flex-shrink:0;">${st.label}</span>
    </div>`;
  }).join('');
}

function loadSidebar_Termine(pairId) {
  const el = document.getElementById('sb-termine-list');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const events = loadEreignisse()
    .filter(e => (!e.pairIds || e.pairIds.length === 0 || e.pairIds.includes(pairId)) && e.status !== 'abgesagt')
    .sort((a, b) => (a.datum || '').localeCompare(b.datum || ''))
    .slice(0, 5);
  if (events.length === 0) {
    el.innerHTML = '<div style="font-size:11px;color:#9ca3af;padding:4px 0;">Keine Termine.</div>';
    return;
  }
  const SCHICHT_SB = { tag: 'T', nacht: 'N', gemischt: 'G' };
  el.innerHTML = events.map(e => {
    const typ  = EREIGNIS_TYPEN[e.typ]    || EREIGNIS_TYPEN.sonstig;
    const st   = EREIGNIS_STATUS[e.status] || EREIGNIS_STATUS.geplant;
    const fmt  = d => { if (!d) return '—'; const [y,m,dd]=d.split('-'); return `${dd}.${m}.${y}`; };
    const past = e.datum && e.datum < today && e.status !== 'abgeschlossen';
    const schichtIcon = e.typ === 'bau' && e.schichttyp ? `<span style="font-size:9px;margin-left:2px;">${SCHICHT_SB[e.schichttyp] || ''}</span>` : '';
    const grpLabel = e.typ === 'bau' && e.baugruppe ? `<span style="font-size:9px;color:#6b7280;"> · ${e.baugruppe}</span>` : '';
    return `<div onclick="openEreignisModal('${e.id}')"
      style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:6px;border:1px solid #e5e7eb;background:white;cursor:pointer;opacity:${past ? '0.6' : '1'};">
      <span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;background:${typ.bg};color:${typ.color};flex-shrink:0;">${typ.label}</span>
      <span style="font-size:11px;font-weight:600;color:#1a3a5c;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.titel || '—'}${schichtIcon}${grpLabel}</span>
      <span style="font-size:10px;color:#9ca3af;white-space:nowrap;">${fmt(e.datum)}</span>
      <span style="font-size:9px;padding:1px 5px;border-radius:3px;background:${st.bg};color:${st.color};">${st.label}</span>
    </div>`;
  }).join('');
}

function openEreignisModalForPair() {
  _ergPreselectedPairId = currentPairId;
  openEreignisModal(null);
}

// Bau-spezifische Felder im Ereignis-Modal ein-/ausblenden
function onErgTypChange() {
  const typ = document.getElementById('erg-typ')?.value;
  const isBau      = typ === 'bau';
  const isBegehung = typ === 'begehung';
  const isAbnahme  = typ === 'abnahme';
  // Bau-spezifisch: nur bei bau-Typ (Bauprogramm-Verknüpfung)
  ['erg-schicht-wrap','erg-baugruppe-wrap','erg-geraet-wrap',
   'erg-einschr-wrap','erg-sicherung-wrap','erg-sperrpause-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isBau ? '' : 'none';
  });
  // Beteiligte: Begehung + Abnahme
  const betWrap = document.getElementById('erg-beteiligte-wrap');
  if (betWrap) betWrap.style.display = (isBegehung || isAbnahme) ? '' : 'none';
  // Abnahme-Verknüpfungs-Sektion
  const ahWrap = document.getElementById('erg-abnahme-wrap');
  if (ahWrap) ahWrap.style.display = isAbnahme ? '' : 'none';
  if (isAbnahme) renderErgAbnahmeLinks();
}

// Abnahme-Links (Öffne Abnahmeprotokoll je Standort)
function renderErgAbnahmeLinks() {
  const wrap = document.getElementById('erg-abnahme-links');
  if (!wrap) return;
  const alleChk = document.getElementById('erg-alle-chk');
  const pairIds = alleChk?.checked ? PAIRS.map(p => p.id) :
    Array.from(document.querySelectorAll('.erg-pair-chk:checked')).map(el => parseInt(el.value));
  if (!pairIds.length) {
    wrap.innerHTML = '<span style="font-size:10px;color:#9ca3af;">Noch kein Standort ausgewählt.</span>';
    return;
  }
  wrap.innerHTML = pairIds.map(pid => {
    const p = PAIRS.find(x => x.id === pid);
    if (!p) return '';
    return `<button type="button" onclick="closeEreignisModal();openCheckliste(${pid})"
      style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;cursor:pointer;font-family:inherit;background:#7c3aed;color:white;border:none;">
      Abnahme Mast ${p.mast || pid} öffnen
    </button>`;
  }).join('');
}

// Ausführungsplanung → Bau-Ausführungs-Ereignis verknüpfen/erstellen
function ausfPlanungZuTermin() {
  if (!currentPairId) return;
  const all = loadAllBauprojekt();
  const d   = all[currentPairId] || {};
  const pair = PAIRS.find(p => p.id === currentPairId);
  if (!pair) return;

  const pairName = pair.bezeichnung || ('Mast ' + (pair.mast || pair.id));
  const schichtLbl = { tag:'Tagarbeit', nacht:'Nachtarbeit', gemischt:'Gemischt' };

  // Vorhandenes Bau-Ereignis für diesen Standort suchen (erstes treffen)
  const list = loadEreignisse();
  let existing = list.find(e => e.typ === 'bau' && e.pairIds && e.pairIds.includes(currentPairId));

  const updated = {
    id:              existing?.id || ('erg_' + Date.now()),
    titel:           existing?.titel || ('Bau-Ausführung ' + pairName),
    typ:             'bau',
    datum:           existing?.datum  || '',
    datumBis:        existing?.datumBis || '',
    uhrzeit:         existing?.uhrzeit   || (() => { const sp = resolveSpForPair(currentPairId); return sp?.von || ''; })(),
    uhrzeitBis:      existing?.uhrzeitBis || (() => { const sp = resolveSpForPair(currentPairId); return sp?.bis || ''; })(),
    ort:             existing?.ort || '',
    status:          existing?.status || 'geplant',
    schichttyp:      d.ausfSchichttyp   || existing?.schichttyp  || 'tag',
    baugruppe:       existing?.baugruppe || (() => { const e = loadEreignisse().find(x => x.typ==='bau' && Array.isArray(x.pairIds) && x.pairIds.includes(currentPairId)); return e?.baugruppe || ''; })(),
    geraet:          existing?.geraet   || d.ausfGeraet || '',
    sicherung:       existing?.sicherung || '',
    sperrpause:      existing?.sperrpause || (() => { const sp = resolveSpForPair(currentPairId); return sp?.von && sp?.bis ? `${sp.von}–${sp.bis} Uhr` : ''; })(),
    gleisgebunden:   !!d.ausfGleisgebunden,
    hoehenbegrenzung:!!d.ausfHoehenbegrenzung,
    abschaltung:     !!d.ausfAbschaltung,
    nachbargleis:    !!d.ausfNachbargleis,
    pairIds:         existing?.pairIds || [currentPairId],
    beschrieb:       existing?.beschrieb || '',
    bemerkung:       existing?.bemerkung || '',
    erinnerung:      existing?.erinnerung,
  };

  const idx = list.findIndex(e => e.id === updated.id);
  if (idx >= 0) list[idx] = updated; else list.push(updated);
  saveEreignisse(list);
  loadSidebar_Termine(currentPairId);
  if (currentOverviewView === 'termine') renderEreignisListe();
  ui.toast(`Bau-Ausführung wurde ${existing ? 'aktualisiert' : 'erstellt'} und mit den Terminen verknüpft.`, 'erfolg');
}

// ── Mehrfachauswahl Terminliste ──────────────────────────────
let _ergSelection = new Set();
let _ergMultiselect = false;

function toggleMultiselect(on) {
  _ergMultiselect = on;
  _ergSelection.clear();
  const bar = document.getElementById('erg-bulk-bar');
  if (bar) bar.style.display = 'none';
  renderEreignisListe();
}

function toggleErgSelect(id) {
  if (_ergSelection.has(id)) _ergSelection.delete(id); else _ergSelection.add(id);
  updateErgBulkBar();
  // Optik des angeklickten Cards aktualisieren
  const card = document.querySelector(`[data-erg-id="${id}"]`);
  if (card) card.style.outline = _ergSelection.has(id) ? '2px solid #1a3a5c' : '';
}

// Eigener Name: «updateBulkBar» gibt es auch in js/ansichten.js fuer die
// Sammelaktionen der Standortliste. Da beide Module im selben Namensraum
// liegen, ueberschrieb die spaeter geladene Fassung die andere — die Leiste
// der Liste erschien dadurch nie.
function updateErgBulkBar() {
  const bar = document.getElementById('erg-bulk-bar');
  const cnt = document.getElementById('erg-bulk-count');
  if (!bar) return;
  const n = _ergSelection.size;
  bar.style.display = n > 0 ? 'flex' : 'none';
  if (cnt) cnt.textContent = n + ' ausgewählt';
}

function clearErgSelection() {
  _ergSelection.clear();
  updateErgBulkBar();
  renderEreignisListe();
}

function applyBulkEdit() {
  if (_ergSelection.size === 0) return;
  const newStatus   = document.getElementById('bulk-status')?.value;
  const newSchicht  = document.getElementById('bulk-schichttyp')?.value;
  const newGruppe   = document.getElementById('bulk-baugruppe')?.value.trim();
  const list = loadEreignisse();
  list.forEach(e => {
    if (!_ergSelection.has(e.id)) return;
    if (newStatus)  e.status    = newStatus;
    if (newSchicht) e.schichttyp = newSchicht;
    if (newGruppe)  e.baugruppe  = newGruppe;
  });
  saveEreignisse(list);
  // Reset selects
  ['bulk-status','bulk-schichttyp'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const bg = document.getElementById('bulk-baugruppe'); if (bg) bg.value = '';
  clearErgSelection();
}

// ── Ausführungsplanung pro Standort ─────────────────────────
function loadAusfPlanung(pairId) {
  const all = loadAllBauprojekt();
  const d   = all[pairId] || {};
  const c   = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

  // Betriebliche Einschränkungen
  c('ausf-gleisgebunden',    d.ausfGleisgebunden);
  c('ausf-hoehenbegrenzung', d.ausfHoehenbegrenzung);
  c('ausf-abschaltung',      d.ausfAbschaltung);
  c('ausf-nachbargleis',     d.ausfNachbargleis);

  // Bauprogramm-Infos aus zugewiesenem Baupaket rendern
  renderAusfBpInfo(pairId);
}

function saveAusfPlanung() {
  if (!currentPairId) return;
  const chk = id => !!document.getElementById(id)?.checked;
  const all = loadAllBauprojekt();
  all[currentPairId] = {
    ...(all[currentPairId] || {}),
    ausfGleisgebunden:   chk('ausf-gleisgebunden'),
    ausfHoehenbegrenzung:chk('ausf-hoehenbegrenzung'),
    ausfAbschaltung:     chk('ausf-abschaltung'),
    ausfNachbargleis:    chk('ausf-nachbargleis'),
  };
  saveAllBauprojekt(all);
}

async function ausfEinschraenkungenGlobal() {
  if (!currentPairId) return;
  const chk  = id => !!document.getElementById(id)?.checked;
  const gl   = chk('ausf-gleisgebunden');
  const ho   = chk('ausf-hoehenbegrenzung');
  const ab   = chk('ausf-abschaltung');
  const na   = chk('ausf-nachbargleis');

  // Nur gesetzte Checkboxen anzeigen, damit klar ist was übernommen wird
  const aktive = [
    gl && 'Gleisgebunden',
    ho && 'Höhenbegrenzung',
    ab && 'Abschaltung Fahrleitung',
    na && 'Nachbargleis',
  ].filter(Boolean);

  // Alle Nicht-Baugrund-Paare (wie die Ausführungsansicht zeigt)
  const ziele = getFundamente().filter(p => p.id !== currentPairId);
  if (!ziele.length) { ui.toast('Keine weiteren Ausführungsstandorte vorhanden.', 'fehler'); return; }

  const msg = aktive.length
    ? `Folgende Einschränkungen auf alle ${ziele.length} Ausführungsstandorte übernehmen?\n\n✔ ${aktive.join('\n✔ ')}`
    : `Alle Einschränkungen auf alle ${ziele.length} Ausführungsstandorte übernehmen?\n(Alle Häkchen werden entfernt)`;

  if (!await ui.confirm(msg)) return;

  const all = loadAllBauprojekt();
  ziele.forEach(p => {
    all[p.id] = {
      ...(all[p.id] || {}),
      ausfGleisgebunden:   gl,
      ausfHoehenbegrenzung:ho,
      ausfAbschaltung:     ab,
      ausfNachbargleis:    na,
    };
  });
  saveAllBauprojekt(all);
  ui.toast(`Einschränkungen auf ${ziele.length} Standorte übernommen.`, 'erfolg');
}

// ============================================================
// AUSFÜHRUNGSPLANUNG — Sperrmuster Auto-Match (read-only)
// ============================================================
function renderAusfSpInfo(pairId) {
  const block = document.getElementById('ausf-sp-block');
  if (!block) return;
  const sp    = resolveSpForPair(pairId);
  const pair  = PAIRS.find(p => p.id === pairId) || {};
  const gleis = pair.gleis ? String(pair.gleis).trim() : null;

  if (!sp) {
    block.innerHTML = `<div style="font-size:11px;color:#9ca3af;padding:7px 10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:7px;">
      Kein passendes Sperrmuster gefunden
    </div>`;
    return;
  }

  const gleisWarn = gleis && sp.gleisNr &&
    !sp.gleisNr.split(/[,\/\s]+/).map(s => s.trim()).filter(Boolean).includes(gleis);
  const fmtD = s => { if (!s) return ''; const [y,m,d] = s.split('-'); return `${d}.${m}.${y}`; };
  const gueltig = (sp.gueltigVon || sp.gueltigBis)
    ? `${fmtD(sp.gueltigVon) || '…'} – ${fmtD(sp.gueltigBis) || '…'}`
    : 'Allgemeingültig';
  const zeit = sp.von && sp.bis ? `${sp.von}–${sp.bis} Uhr` : sp.nettoH ? `${sp.nettoH} h` : '';

  block.innerHTML = `
    <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <div style="padding:7px 10px;background:#f8fafc;display:flex;align-items:center;gap:6px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.03em;">Sperrmuster (auto)</span>
        ${gleisWarn ? `<span style="font-size:10px;color:#b91c1c;margin-left:auto;" title="Gleis-Nr. ${sp.gleisNr} stimmt nicht mit Standort-Gleis ${gleis} überein">${svgIcon('warnung',{groesse:10})} Gleis-Mismatch</span>` : ''}
      </div>
      <div style="padding:7px 10px;display:flex;flex-direction:column;gap:3px;">
        <div style="display:flex;gap:6px;font-size:11px;">
          <span style="color:#9ca3af;flex-shrink:0;min-width:68px;">Bezeichnung</span>
          <span style="font-weight:600;color:#374151;">${sp.name}</span>
        </div>
        ${zeit ? `<div style="display:flex;gap:6px;font-size:11px;">
          <span style="color:#9ca3af;flex-shrink:0;min-width:68px;">Fenster</span>
          <span style="color:#374151;">${zeit}</span>
        </div>` : ''}
        <div style="display:flex;gap:6px;font-size:11px;">
          <span style="color:#9ca3af;flex-shrink:0;min-width:68px;">Gültigkeit</span>
          <span style="color:#374151;">${gueltig}</span>
        </div>
      </div>
    </div>`;
}

// ============================================================
// AUSFÜHRUNGSPLANUNG — Baupaket-Info (read-only aus Bauprogramm)
// ============================================================
function renderAusfBpInfo(pairId) {
  const block = document.getElementById('ausf-bp-block');
  if (!block) return;
  const zuw = loadSchichtZuw()[pairId];
  const pak = zuw?.paketId ? loadBaupakete().find(p => p.id === zuw.paketId) : null;

  if (!pak) {
    block.innerHTML = `<div style="font-size:11px;color:#9ca3af;padding:9px 12px;background:#f1f5f9;border:1px solid #dde3ea;border-radius:7px;display:flex;align-items:center;gap:6px;">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
      <span>Kein Baupaket zugewiesen</span>
    </div>`;
    renderAusfSpInfo(pairId);
    return;
  }

  const col     = pak.farbe || '#1a3a5c';
  const schicht = bpGetSchichten(pak).find(s => s.schichtNr === zuw.schichtNr);
  const _pair   = PAIRS.find(p => p.id === pairId);
  // SP pro Fundament: p.gleis hat Vorrang gegenüber dem im Schicht gespeicherten SP
  const sp = schicht?.datum
    ? (resolveSpForGleis(_pair?.gleis, schicht.datum) || resolveSpForPak(pak, schicht.datum))
    : resolveSpForPak(pak, pak.startDatum);
  const end     = bpPaketEnd(pak);
  const fmtD    = d => { if (!d) return '—'; const [y,m,dd] = d.split('-'); return `${dd}.${m}.${y}`; };
  const intervall  = sp?.von && sp?.bis ? `${sp.von}–${sp.bis} Uhr` : sp?.nettoH ? `${sp.nettoH} h` : '';
  const schichtTyp = sp ? (sp.typ === 'nacht' ? 'Nacht' : sp.typ === 'wochenende' ? 'Wochenende' : 'Tag') : '';

  // Gleise aus zugewiesenen Fundamenten ableiten
  const _zuwAll = loadSchichtZuw();
  const _pakPairs = PAIRS.filter(p => _zuwAll[p.id]?.paketId === pak.id);
  const _pakGleise = [...new Set(_pakPairs.map(p => p.gleis).filter(Boolean))];

  const params = [];
  if (_pakGleise.length) {
    params.push(`<div style="display:flex;gap:6px;font-size:11px;">
      <span style="color:#9ca3af;flex-shrink:0;min-width:68px;">Gleise</span>
      <span style="font-weight:600;color:#374151;">${_pakGleise.join(', ')}</span>
    </div>`);
  }
  if (sp) {
    const spLabel = [sp.name || sp.id, intervall, schichtTyp].filter(Boolean).join(' · ');
    params.push(`<div style="display:flex;gap:6px;font-size:11px;">
      <span style="color:#9ca3af;flex-shrink:0;min-width:68px;">Sperrmuster</span>
      <span style="font-weight:600;color:#374151;">${spLabel}</span>
    </div>`);
  }
  if (pak.anzahlNaechte) {
    params.push(`<div style="display:flex;gap:6px;font-size:11px;">
      <span style="color:#9ca3af;flex-shrink:0;min-width:68px;">Schichten</span>
      <span style="font-weight:600;color:#374151;">${pak.anzahlNaechte} total</span>
    </div>`);
  }

  block.innerHTML = `
    <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#f8fafc;">
        <div style="width:4px;min-height:34px;border-radius:2px;background:${col};flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:700;color:#1a3a5c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${pak.name}</div>
          <div style="font-size:10px;color:#6b7280;margin-top:1px;">
            ${schicht ? `Schicht ${schicht.schichtNr} · ${fmtD(schicht.datum)}` : `${fmtD(pak.startDatum)}${end ? ' – ' + fmtD(end) : ''}`}
          </div>
        </div>
      </div>
      ${params.length ? `<div style="padding:7px 10px;border-top:1px solid #f0f2f5;display:flex;flex-direction:column;gap:3px;">${params.join('')}</div>` : ''}
    </div>`;
  renderAusfSpInfo(pairId);
}

// ============================================================
// NOTIZEN — Eigenständige Sektion (alle Phasen)
// ============================================================
function renderPaarNotizen(pairId) {
  const grid        = document.getElementById('notizen-grid');
  const alleBtnWrap = document.getElementById('notizen-alle-btn-wrap');
  if (!grid) return;
  const notizen = (loadAllNotizen()[pairId] || []).slice().reverse();
  grid.innerHTML = '';
  const max = 4;

  // Notiz-Kacheln (max. 4 sichtbar)
  notizen.slice(0, max).forEach(n => {
    const card = document.createElement('div');
    card.style.cssText = 'position:relative;width:calc(50% - 3px);min-height:60px;background:#f8fafc;' +
      'border:1px solid #e5e7eb;border-radius:7px;padding:7px 8px;cursor:default;box-sizing:border-box;';
    card.innerHTML = `
      <div style="font-size:9px;font-weight:600;color:#9ca3af;margin-bottom:3px;">${n.ts}</div>
      <div style="font-size:11px;color:#374151;white-space:pre-wrap;word-break:break-word;overflow:hidden;max-height:42px;">${n.text.replace(/</g,'&lt;')}</div>
      <button onclick="notizLoeschen('${pairId}','${n.id}')"
        style="position:absolute;top:4px;right:4px;font-size:9px;color:#ef4444;background:none;border:none;cursor:pointer;padding:2px;opacity:0.6;" title="Löschen">✕</button>`;
    grid.appendChild(card);
  });

  // +Kachel am Ende
  const addCard = document.createElement('div');
  addCard.onclick = notizNeu;
  addCard.style.cssText = 'width:calc(50% - 3px);min-height:60px;background:white;' +
    'border:2px dashed #d1d5db;border-radius:7px;display:flex;flex-direction:column;' +
    'align-items:center;justify-content:center;cursor:pointer;gap:3px;box-sizing:border-box;';
  addCard.innerHTML = '<span style="font-size:20px;color:#d1d5db;line-height:1;">+</span>' +
    '<span style="font-size:10px;color:#9ca3af;">Notiz</span>';
  grid.appendChild(addCard);

  if (alleBtnWrap) alleBtnWrap.style.display = notizen.length > max ? '' : 'none';
}

function notizNeu() {
  // Direktes Popup-Modal für aktuellen Standort (ohne Standort-Auswahl)
  const pair    = currentPairId ? PAIRS.find(p => p.id === currentPairId) : null;
  const titleEl = document.getElementById('schnellnotiz-title');
  const pairRow = document.getElementById('schnellnotiz-pair-row');
  const pairSel = document.getElementById('schnellnotiz-pair');
  const inp     = document.getElementById('schnellnotiz-input');
  const ctxInp  = document.getElementById('schnellnotiz-context');
  if (titleEl) titleEl.textContent = pair ? `Notiz · Mast ${pair.mast || currentPairId}` : 'Neue Notiz';
  if (pairRow) pairRow.style.display = 'none';
  if (ctxInp) ctxInp.value = getNotizContext();
  // Optionen befüllen damit value korrekt gesetzt werden kann
  if (pairSel) {
    pairSel.innerHTML = PAIRS.map(p =>
      `<option value="${p.id}">Mast ${p.mast || p.id}</option>`).join('');
    pairSel.value = currentPairId || '';
  }
  if (inp) inp.value = '';
  document.getElementById('schnellnotiz-modal').style.display = 'flex';
  setTimeout(() => inp?.focus(), 50);
}

function notizAbbrechen() {
  const wrap = document.getElementById('notiz-input-wrap');
  if (wrap) wrap.style.display = 'none';
  const inp = document.getElementById('notiz-input');
  if (inp) inp.value = '';
}

function notizSpeichern() {
  const inp  = document.getElementById('notiz-input');
  const text = inp?.value?.trim();
  if (!text || !currentPairId) return;
  const all = loadAllNotizen();
  if (!Array.isArray(all[currentPairId])) all[currentPairId] = [];
  all[currentPairId].push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    ts: new Date().toLocaleString('de-CH'),
    phase: _activePhase || 'baugrund',
    text
  });
  saveAllNotizen(all);
  notizAbbrechen();
  renderPaarNotizen(currentPairId);
}

async function notizLoeschen(pairId, noteId) {
  if (!await ui.confirm('Notiz löschen?')) return;
  const all = loadAllNotizen();
  if (all[pairId]) {
    all[pairId] = all[pairId].filter(n => n.id !== noteId);
    saveAllNotizen(all);
  }
  const numId = parseInt(pairId);
  if (!isNaN(numId)) renderPaarNotizen(numId);
  renderNotizSection();
}

// Zustand für laufende Notiz-Bearbeitung
let _editNote = null; // { pairId, noteId } oder null

function notizBearbeiten(pairId, noteId) {
  const all  = loadAllNotizen();
  const note = (all[pairId] || []).find(n => n.id === noteId);
  if (!note) return;
  _editNote = { pairId, noteId };
  const titleEl  = document.getElementById('schnellnotiz-title');
  const pairRow  = document.getElementById('schnellnotiz-pair-row');
  const saveBtn  = document.getElementById('schnellnotiz-save-btn');
  const inp      = document.getElementById('schnellnotiz-input');
  if (titleEl)  titleEl.textContent  = 'Notiz bearbeiten';
  if (pairRow)  pairRow.style.display = 'none';
  if (saveBtn)  saveBtn.textContent  = 'Speichern';
  if (inp)      inp.value            = note.text;
  const ctxInpE = document.getElementById('schnellnotiz-context');
  if (ctxInpE)  ctxInpE.value       = note.context || '';
  document.getElementById('schnellnotiz-modal').style.display = 'flex';
  setTimeout(() => { inp?.focus(); inp?.select(); }, 50);
}

// Alle-Notizen-Modal
let _alleNotizenPhase = 'alle';

function openAlleNotizenModal() {
  _alleNotizenPhase = 'alle';
  renderAlleNotizenList('alle');
  document.getElementById('alle-notizen-modal').style.display = 'flex';
}

function closeAlleNotizenModal() {
  document.getElementById('alle-notizen-modal').style.display = 'none';
}

function renderAlleNotizenList(phase) {
  _alleNotizenPhase = phase;
  ['alle','baugrund','bauprojekt','ausfuehrung'].forEach(p => {
    const btn = document.getElementById('an-filter-' + p);
    if (btn) btn.classList.toggle('an-filter-active', p === phase);
  });
  const all  = loadAllNotizen();
  const wrap = document.getElementById('alle-notizen-list');
  if (!wrap) return;
  const rows = [];
  PAIRS.forEach(p => {
    const pPhase = p._phase || 'baugrund';
    if (phase !== 'alle' && pPhase !== phase) return;
    (all[p.id] || []).slice().reverse().forEach(n => rows.push({ p, n, isGlobal: false }));
  });
  // Mastunabhängige Notizen bei "Alle"
  if (phase === 'alle') {
    (all['_global'] || []).slice().reverse().forEach(n => rows.push({ p: null, n, isGlobal: true }));
  }
  rows.sort((a, b) => b.n.ts.localeCompare(a.n.ts));
  if (!rows.length) {
    wrap.innerHTML = '<div style="font-size:12px;color:#9ca3af;padding:8px 0;text-align:center;">Keine Notizen vorhanden.</div>';
    return;
  }
  wrap.innerHTML = rows.map(({ p, n, isGlobal }) => {
    const pairId = isGlobal ? '_global' : p.id;
    const label  = isGlobal
      ? `<span style="font-size:11px;font-weight:700;color:#6b7280;">Allgemein</span>`
      : `<span style="font-size:11px;font-weight:700;color:#1a3a5c;cursor:pointer;"
           onclick="closeAlleNotizenModal();showDetail(${p.id})">Mast ${p.mast || p.id}</span>`;
    return `
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:9px 12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        ${label}
        <span style="font-size:9px;color:#9ca3af;">${n.ts}</span>
      </div>
      <div style="font-size:11px;color:#374151;white-space:pre-wrap;word-break:break-word;">${n.text.replace(/</g,'&lt;')}</div>
      <div style="display:flex;gap:10px;margin-top:4px;">
        <button onclick="notizBearbeiten('${pairId}','${n.id}');renderAlleNotizenList(_alleNotizenPhase)"
          style="font-size:9px;color:#6b7280;background:none;border:none;cursor:pointer;padding:0;">Bearbeiten</button>
        <button onclick="notizLoeschen('${pairId}','${n.id}');renderAlleNotizenList(_alleNotizenPhase)"
          style="font-size:9px;color:#ef4444;background:none;border:none;cursor:pointer;padding:0;">Löschen</button>
      </div>
    </div>`;
  }).join('');
}

// Schnellnotiz-Modal (FAB auf Karte — mit Standort-Auswahl)
function openSchnellNotizModal() {
  const titleEl = document.getElementById('schnellnotiz-title');
  const pairRow = document.getElementById('schnellnotiz-pair-row');
  const sel     = document.getElementById('schnellnotiz-pair');
  const inp     = document.getElementById('schnellnotiz-input');
  const ctxInp  = document.getElementById('schnellnotiz-context');
  if (titleEl) titleEl.textContent = 'Schnellnotiz';
  if (pairRow) pairRow.style.display = '';
  if (sel) {
    sel.innerHTML = '<option value="_global">— Mastunabhängig —</option>' +
      PAIRS.map(p => `<option value="${p.id}">Mast ${p.mast || p.id} · KM ${p.km_rs ? parseFloat(p.km_rs).toFixed(3) : '—'}</option>`).join('');
    sel.value = '_global';
  }
  if (inp) inp.value = '';
  if (ctxInp) ctxInp.value = getNotizContext();
  document.getElementById('schnellnotiz-modal').style.display = 'flex';
  setTimeout(() => inp?.focus(), 50);
}

function onSchnellnotizPairChange(val) {
  const ctxInp = document.getElementById('schnellnotiz-context');
  if (!ctxInp) return;
  if (!val || val === '_global') {
    ctxInp.value = getNotizContext();
  } else {
    const pair = PAIRS.find(p => String(p.id) === String(val));
    ctxInp.value = pair ? 'Mast ' + (pair.mast || pair.id) : '';
  }
}

function closeSchnellNotizModal() {
  document.getElementById('schnellnotiz-modal').style.display = 'none';
  _editNote = null;
  // Zustand für nächste Verwendung zurücksetzen
  const titleEl = document.getElementById('schnellnotiz-title');
  const pairRow = document.getElementById('schnellnotiz-pair-row');
  if (titleEl) titleEl.textContent  = 'Schnellnotiz';
  if (pairRow) pairRow.style.display = '';
}

function schnellNotizSpeichern() {
  const text = document.getElementById('schnellnotiz-input')?.value?.trim();
  if (!text) return;
  const all = loadAllNotizen();

  const context = document.getElementById('schnellnotiz-context')?.value.trim() || '';

  if (_editNote) {
    // Bearbeitungs-Modus: bestehende Notiz aktualisieren
    const { pairId, noteId } = _editNote;
    const note = (all[pairId] || []).find(n => n.id === noteId);
    if (note) { note.text = text; note.context = context; saveAllNotizen(all); }
    closeSchnellNotizModal();
    const numId = parseInt(pairId);
    if (!isNaN(numId) && numId === currentPairId) renderPaarNotizen(numId);
    renderNotizSection();
    return;
  }

  // Neu-Modus
  const rawId  = document.getElementById('schnellnotiz-pair')?.value || '_global';
  const pairId = rawId === '_global' ? '_global' : +rawId;
  if (!Array.isArray(all[pairId])) all[pairId] = [];
  all[pairId].push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    ts: new Date().toLocaleString('de-CH'),
    phase: _activePhase || 'baugrund',
    context,
    text
  });
  saveAllNotizen(all);
  closeSchnellNotizModal();
  if (pairId === currentPairId) renderPaarNotizen(currentPairId);
  renderNotizSection();
}

function openEreignisModal(id) {
  _ergEditId = id;
  const isNew = !id;
  document.getElementById('ereignis-modal-title').textContent = isNew ? 'Termin erfassen' : 'Termin bearbeiten';
  document.getElementById('ereignis-delete-btn').style.display = isNew ? 'none' : '';
  const v  = (eid, val) => { const el = document.getElementById(eid); if (el) el.value = val || ''; };
  const e  = id ? loadEreignisse().find(x => x.id === id) : null;
  if (e) {
    v('erg-titel', e.titel); v('erg-typ', e.typ || 'sonstig'); v('erg-datum', e.datum);
    v('erg-datum-bis', e.datumBis); v('erg-uhrzeit', e.uhrzeit); v('erg-uhrzeit-bis', e.uhrzeitBis);
    v('erg-ort', e.ort); v('erg-status', e.status || 'geplant');
    v('erg-schichttyp', e.schichttyp || 'tag'); v('erg-baugruppe', e.baugruppe);
    v('erg-geraet', e.geraet); v('erg-sicherung', e.sicherung); v('erg-sperrpause', e.sperrpause);
    const chk = (eid, val) => { const el = document.getElementById(eid); if (el) el.checked = !!val; };
    chk('erg-gleisgebunden', e.gleisgebunden); chk('erg-hoehenbegrenzung', e.hoehenbegrenzung);
    chk('erg-abschaltung', e.abschaltung); chk('erg-nachbargleis', e.nachbargleis);
    v('erg-beschrieb', e.beschrieb); v('erg-bemerkung', e.bemerkung);
    v('erg-erin-datum', e.erinnerung?.datum); v('erg-erin-uhrzeit', e.erinnerung?.uhrzeit);
    v('erg-erin-email', e.erinnerung?.email);
    renderEreignisPairSelection(e.pairIds || []);
    _ergBeteiligte = Array.isArray(e.beteiligte) ? [...e.beteiligte] : [];
    // Abnahme-Typ: Felder aus Checkliste vorschlagen wenn leer
    if (e.typ === 'abnahme' && (e.pairIds || []).length === 1) {
      const ck = loadAllChecklisten()[e.pairIds[0]] || {};
      if (!e.datum && ck.datum)         v('erg-datum', ck.datum);
      if (!e.ort   && ck.ort)           v('erg-ort',   ck.ort);
      if (!_ergBeteiligte.length && ck.anwesend)
        _ergBeteiligte = ck.anwesend.split(',').map(s => s.trim()).filter(Boolean);
    }
    renderErgBeteiligteTags();
    _ergPopulateVorlage();
  } else {
    ['erg-titel','erg-datum','erg-datum-bis','erg-uhrzeit','erg-uhrzeit-bis','erg-ort',
     'erg-baugruppe','erg-geraet','erg-sicherung','erg-sperrpause',
     'erg-beschrieb','erg-bemerkung','erg-erin-datum','erg-erin-uhrzeit','erg-erin-email'].forEach(eid => v(eid, ''));
    ['erg-gleisgebunden','erg-hoehenbegrenzung','erg-abschaltung','erg-nachbargleis'].forEach(eid => {
      const el = document.getElementById(eid); if (el) el.checked = false;
    });
    v('erg-typ', 'sonstig'); v('erg-status', 'geplant'); v('erg-schichttyp', 'tag');
    renderEreignisPairSelection(_ergPreselectedPairId ? [_ergPreselectedPairId] : []);
    _ergPreselectedPairId = null;
    _ergBeteiligte = [];
    renderErgBeteiligteTags();
    _ergPopulateVorlage();
  }
  onErgTypChange();
  document.getElementById('ereignis-modal').style.display = 'flex';
}

function closeEreignisModal() {
  document.getElementById('ereignis-modal').style.display = 'none';
  _ergEditId = null;
}

let _ergBeteiligte = [];

function renderErgBeteiligteTags() {
  const wrap = document.getElementById('erg-beteiligte-tags');
  if (!wrap) return;
  wrap.innerHTML = _ergBeteiligte.map((name, i) =>
    `<span style="display:inline-flex;align-items:center;gap:4px;background:#e8f0fb;color:#1a3a5c;border:1px solid #bfcfe8;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:600;">
      ${name.replace(/</g,'&lt;')}
      <button type="button" onclick="_ergBeteiligte.splice(${i},1);renderErgBeteiligteTags()"
        style="display:flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;border:none;background:rgba(26,58,92,0.15);color:#1a3a5c;font-size:10px;cursor:pointer;padding:0;line-height:1;">×</button>
    </span>`
  ).join('');
  renderErgBeteiligteContacts();
}

function renderErgBeteiligteContacts() {
  const wrap = document.getElementById('erg-beteiligte-contacts');
  if (!wrap) return;
  const contacts = typeof loadContacts === 'function' ? loadContacts() : [];
  if (!contacts.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  wrap.innerHTML = contacts.map(c => {
    const name = c.name || c.firma || '';
    if (!name) return '';
    const active = _ergBeteiligte.includes(name);
    const rolle  = c.rolle ? ` <span style="font-weight:400;opacity:0.65;">${c.rolle.replace(/</g,'&lt;')}</span>` : '';
    return `<button type="button" onclick="ergBeteiligteToggleContact('${name.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')"
      style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;cursor:pointer;font-family:inherit;
      background:${active ? '#1a3a5c' : '#f1f5f9'};color:${active ? 'white' : '#374151'};
      border:1px solid ${active ? '#1a3a5c' : '#d1d5db'};">
      ${name.replace(/</g,'&lt;')}${rolle}</button>`;
  }).filter(Boolean).join('');
}

function ergBeteiligteToggleContact(name) {
  const idx = _ergBeteiligte.indexOf(name);
  if (idx >= 0) _ergBeteiligte.splice(idx, 1);
  else _ergBeteiligte.push(name);
  renderErgBeteiligteTags();
}

function ergVorlageLoad(eid) {
  if (!eid) return;
  const e = loadEreignisse().find(x => x.id === eid);
  if (e && Array.isArray(e.beteiligte)) {
    e.beteiligte.forEach(name => { if (!_ergBeteiligte.includes(name)) _ergBeteiligte.push(name); });
    renderErgBeteiligteTags();
  }
  const sel = document.getElementById('erg-beteiligte-vorlage');
  if (sel) sel.value = '';
}

function _ergPopulateVorlage() {
  const sel  = document.getElementById('erg-beteiligte-vorlage');
  const wrap = document.getElementById('erg-beteiligte-vorlage-wrap');
  if (!sel || !wrap) return;
  const begehungen = loadEreignisse().filter(e => e.typ === 'begehung' && Array.isArray(e.beteiligte) && e.beteiligte.length && e.id !== _ergEditId);
  wrap.style.display = begehungen.length ? '' : 'none';
  sel.innerHTML = '<option value="">— Vorlage aus Begehung übernehmen —</option>' +
    begehungen.map(e => `<option value="${e.id}">${e.datum ? e.datum.split('-').reverse().join('.') : ''}${e.titel ? ' – ' + e.titel.replace(/</g,'&lt;') : ''}</option>`).join('');
}

function addErgBeteiligter(inputEl) {
  const name = inputEl?.value?.trim();
  if (!name || _ergBeteiligte.includes(name)) { if (inputEl) inputEl.value = ''; return; }
  _ergBeteiligte.push(name);
  renderErgBeteiligteTags();
  if (inputEl) inputEl.value = '';
}

function ergBeteiligteKeydown(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    addErgBeteiligter(e.target);
  } else if (e.key === 'Backspace' && !e.target.value && _ergBeteiligte.length) {
    _ergBeteiligte.pop();
    renderErgBeteiligteTags();
  }
}

function renderEreignisPairSelection(selected) {
  const wrap = document.getElementById('erg-pair-select-wrap');
  if (!wrap) return;
  const fundamente = getFundamente();
  const allChecked = !selected || selected.length === 0;
  let html = `<label style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:#374151;margin-bottom:6px;cursor:pointer;">
    <input type="checkbox" id="erg-alle-chk" ${allChecked ? 'checked' : ''} onchange="toggleEreignisAlleStandorte(this.checked)">
    Alle / Projektübergreifend
  </label>`;
  if (fundamente.length > 0) {
    html += `<div id="erg-pair-checkboxes" style="${allChecked ? 'display:none' : 'display:flex'};flex-direction:column;gap:3px;max-height:130px;overflow-y:auto;padding-left:4px;">
      ${fundamente.map(p => {
        const km  = p.km_rs ? parseFloat(p.km_rs).toFixed(3) : '–';
        const lbl = `Mast ${p.mast || p.id} · KM ${km}`;
        const chk = selected && selected.includes(p.id) ? 'checked' : '';
        return `<label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;">
          <input type="checkbox" class="erg-pair-chk" value="${p.id}" ${chk}> ${lbl}</label>`;
      }).join('')}
    </div>`;
  }
  wrap.innerHTML = html;
}

function toggleEreignisAlleStandorte(checked) {
  const wrap = document.getElementById('erg-pair-checkboxes');
  if (wrap) wrap.style.display = checked ? 'none' : 'flex';
}

function saveEreignis() {
  const v     = eid => { const el = document.getElementById(eid); return el ? el.value.trim() : ''; };
  const titel = v('erg-titel');
  if (!titel) { ui.toast('Bitte Titel eingeben.', 'fehler'); return; }
  const alleChk     = document.getElementById('erg-alle-chk');
  const pairIds     = alleChk?.checked ? [] :
    Array.from(document.querySelectorAll('.erg-pair-chk:checked')).map(el => parseInt(el.value));
  const typ = v('erg-typ') || 'sonstig';
  const erinDatum   = v('erg-erin-datum');
  const erinUhrzeit = v('erg-erin-uhrzeit');
  const erinEmail   = v('erg-erin-email');
  const chkVal = id => { const el = document.getElementById(id); return el ? el.checked : false; };
  const ereignis = {
    id:              _ergEditId || ('erg_' + Date.now()),
    titel,
    typ,
    datum:           v('erg-datum'),
    datumBis:        v('erg-datum-bis'),
    uhrzeit:         v('erg-uhrzeit'),
    uhrzeitBis:      v('erg-uhrzeit-bis'),
    ort:             v('erg-ort'),
    status:          v('erg-status')   || 'geplant',
    schichttyp:      typ === 'bau' ? (v('erg-schichttyp') || 'tag') : undefined,
    baugruppe:       typ === 'bau' ? v('erg-baugruppe')    : undefined,
    geraet:          typ === 'bau' ? v('erg-geraet')       : undefined,
    sicherung:       typ === 'bau' ? v('erg-sicherung')    : undefined,
    sperrpause:      typ === 'bau' ? v('erg-sperrpause')   : undefined,
    gleisgebunden:   typ === 'bau' ? chkVal('erg-gleisgebunden')    : undefined,
    hoehenbegrenzung:typ === 'bau' ? chkVal('erg-hoehenbegrenzung') : undefined,
    abschaltung:     typ === 'bau' ? chkVal('erg-abschaltung')      : undefined,
    nachbargleis:    typ === 'bau' ? chkVal('erg-nachbargleis')      : undefined,
    pairIds,
    beschrieb:       v('erg-beschrieb'),
    bemerkung:       v('erg-bemerkung'),
    erinnerung:      erinDatum ? { datum: erinDatum, uhrzeit: erinUhrzeit, email: erinEmail } : undefined,
    beteiligte:      (typ === 'begehung' || typ === 'abnahme') ? [..._ergBeteiligte] : undefined,
  };
  const list = loadEreignisse();
  const idx  = list.findIndex(e => e.id === ereignis.id);
  const isNew = idx < 0;
  if (idx >= 0) list[idx] = ereignis; else list.push(ereignis);
  saveEreignisse(list);
  // Änderungsprotokoll: für verknüpfte Standorte loggen
  const ergLabel = `${isNew ? 'Neu' : 'Geändert'}: ${ereignis.titel}${ereignis.datum ? ' · ' + ereignis.datum : ''}`;
  const affectedPairs = pairIds.length > 0 ? pairIds : (currentPairId ? [currentPairId] : []);
  affectedPairs.forEach(pid => logChange(pid, 'Ereignis', ergLabel, 'ereignis'));

  // Abnahme-Termin → Datum / Ort / Beteiligte in Checkliste übernehmen
  if (typ === 'abnahme' && pairIds.length > 0) {
    const datum    = ereignis.datum;
    const ort      = ereignis.ort;
    const anwesend = _ergBeteiligte.join(', ');
    const allCk    = loadAllChecklisten();
    pairIds.forEach(pid => {
      const ck = allCk[pid] || {};
      if (datum)    ck.datum    = datum;
      if (ort)      ck.ort      = ort;
      if (anwesend) ck.anwesend = anwesend;
      allCk[pid] = ck;
    });
    saveAllChecklisten(allCk);
  }

  closeEreignisModal();
  if (currentOverviewView === 'termine') renderEreignisListe();
  loadSidebar_Termine(currentPairId);
}

async function deleteEreignis() {
  if (!_ergEditId || !await ui.confirm('Termin wirklich löschen?')) return;
  saveEreignisse(loadEreignisse().filter(e => e.id !== _ergEditId));
  closeEreignisModal();
  if (currentOverviewView === 'termine') renderEreignisListe();
  loadSidebar_Termine(currentPairId);
}

// ============================================================
