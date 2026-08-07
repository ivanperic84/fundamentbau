// BEGEHUNG — alle Phasen
// ============================================================
const BEGEHUNG_KEY = () => 'sp_begehung__' + _activeId;

function loadAllBegehung() {
  try { return jsonParse(store.getItem(BEGEHUNG_KEY())) || {}; } catch { return {}; }
}
function saveAllBegehung(all) { store.setItem(BEGEHUNG_KEY(), JSON.stringify(all)); }

let _begehungStatus = '';

function loadBegehungFelder(pairId) {
  const all = loadAllBegehung();
  const key = `${pairId}_${_activePhase}`;
  const d = all[key] || {};
  const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  v('beg-datum',   d.datum);
  v('beg-person',  d.person);
  v('beg-befund',  d.befund);
  v('beg-massnahme-ja', d.massnahmeJa);
  v('beg-massnahme-beschrieb', d.massnahmeBeschrieb);
  _begehungStatus = d.status || '';
  renderBegehungTags(d.tags || []);
  updateBegehungStatusBtns();
  updateBegehungUI();
  begFillEreignisDropdown();
  v('beg-ereignis-vorlage', d.ereignisId);
}

function saveBegehung() {
  if (!currentPairId) return;
  const v = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const all      = loadAllBegehung();
  const key      = `${currentPairId}_${_activePhase}`;
  const existing = all[key] || {};

  const befundText = v('beg-befund').trim();
  const prevBefund = (existing.befund || '').trim();

  const updated = {
    ...existing,
    datum:              v('beg-datum'),
    person:             v('beg-person'),
    status:             _begehungStatus,
    befund:             v('beg-befund'),
    massnahmeJa:        v('beg-massnahme-ja'),
    massnahmeBeschrieb: v('beg-massnahme-beschrieb'),
    ereignisId:         v('beg-ereignis-vorlage'),
  };
  all[key] = updated;

  // Befund / Hindernisse → Notiz synchronisieren
  // Jede Änderung erzeugt/aktualisiert eine Notiz mit context='Begehung'.
  // Die Notiz-ID wird in befundNotizId gespeichert um Duplikate zu vermeiden.
  if (befundText !== prevBefund) {
    const notAll = loadAllNotizen();
    if (!Array.isArray(notAll[currentPairId])) notAll[currentPairId] = [];
    const existingNoteId = existing.befundNotizId;

    if (befundText) {
      const noteIdx = existingNoteId
        ? notAll[currentPairId].findIndex(n => n.id === existingNoteId)
        : -1;
      if (noteIdx >= 0) {
        // Bestehende Notiz aktualisieren
        notAll[currentPairId][noteIdx].text  = befundText;
        notAll[currentPairId][noteIdx].ts    = new Date().toLocaleString('de-CH');
        notAll[currentPairId][noteIdx].phase = _activePhase || 'baugrund';
      } else {
        // Neue Notiz anlegen
        const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        notAll[currentPairId].push({
          id: newId, ts: new Date().toLocaleString('de-CH'),
          phase: _activePhase || 'baugrund',
          text: befundText, context: 'Begehung',
        });
        all[key].befundNotizId = newId;
      }
    } else if (existingNoteId) {
      // Befund geleert → verknüpfte Notiz entfernen
      notAll[currentPairId] = notAll[currentPairId].filter(n => n.id !== existingNoteId);
      delete all[key].befundNotizId;
    }
    saveAllNotizen(notAll);
    renderPaarNotizen(currentPairId);
  }

  saveAllBegehung(all);
  updateBegehungUI();
}

function setBegehungStatus(status) {
  _begehungStatus = status;
  updateBegehungStatusBtns();
  saveBegehung();
}

function updateBegehungStatusBtns() {
  const btns = {
    geplant:       { el: 'beg-btn-geplant',       bg: '#f3f4f6', color: '#374151' },
    durchgefuehrt: { el: 'beg-btn-durchgefuehrt', bg: '#dcfce7', color: '#166534' },
    nichtmoeglich: { el: 'beg-btn-nichtmoeglich',  bg: '#fee2e2', color: '#b91c1c' },
  };
  Object.entries(btns).forEach(([key, cfg]) => {
    const btn = document.getElementById(cfg.el);
    if (!btn) return;
    const active = _begehungStatus === key;
    btn.style.background = active ? cfg.bg : 'white';
    btn.style.color      = active ? cfg.color : '#6b7280';
    btn.style.fontWeight = active ? '700' : '600';
  });
}

function updateBegehungUI() {
  // Massnahme-Beschrieb ein/ausblenden
  const massnahmeJa = document.getElementById('beg-massnahme-ja')?.value;
  const wrap = document.getElementById('beg-massnahme-beschrieb-wrap');
  if (wrap) wrap.style.display = massnahmeJa === 'ja' ? '' : 'none';

  // Status-Dot im Header
  const dot = document.getElementById('begehung-status-dot');
  if (dot) {
    const colors = { geplant: '#f59e0b', durchgefuehrt: '#16a34a', nichtmoeglich: '#dc2626' };
    const color = colors[_begehungStatus] || '';
    dot.innerHTML = color ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};"></span>` : '';
  }
}

// Begehung — Ereignis-Dropdown befüllen
function begFillEreignisDropdown() {
  const sel = document.getElementById('beg-ereignis-vorlage');
  if (!sel) return;
  const begehungen = loadEreignisse().filter(e => e.typ === 'begehung');
  sel.innerHTML = '<option value="">— Begehung aus Terminen wählen —</option>' +
    begehungen.map(e => {
      const d = e.datum ? e.datum.split('-').reverse().join('.') : '?';
      return `<option value="${e.id}">${d} – ${(e.titel||'Begehung').replace(/</g,'&lt;')}</option>`;
    }).join('');
}

// Begehung — Ereignis-Daten in Formular übernehmen und auf alle Positionen der Phase anwenden
function begLadeEreignis(id) {
  if (!id) return;
  const e = loadEreignisse().find(x => x.id === id);
  if (!e) return;

  const datum  = document.getElementById('beg-datum');
  const person = document.getElementById('beg-person');
  if (datum && e.datum) datum.value = e.datum;
  if (person && Array.isArray(e.beteiligte) && e.beteiligte.length) {
    person.value = e.beteiligte.join(', ');
  } else if (person && e.ort && !person.value) {
    person.value = e.ort;
  }

  // Status auf Geplant setzen
  _begehungStatus = 'geplant';
  updateBegehungStatusBtns();

  // Aktuellen Standort speichern (ereignisId bleibt im Dropdown gesetzt → wird via saveBegehung persistiert)
  saveBegehung();

  // Datum + Person + status='geplant' auf alle Positionen der Phase übertragen.
  // Positionen mit Status 'durchgefuehrt' oder 'nichtmoeglich' werden nicht überschrieben.
  const allBeg    = loadAllBegehung();
  const datumVal  = e.datum || '';
  const personVal = (Array.isArray(e.beteiligte) && e.beteiligte.length)
    ? e.beteiligte.join(', ') : (e.ort || '');

  getPhasePairs().forEach(p => {
    if (p.id === currentPairId) return;
    const pKey     = `${p.id}_${_activePhase}`;
    const existing = allBeg[pKey] || {};
    if (existing.status === 'durchgefuehrt' || existing.status === 'nichtmoeglich') return;
    allBeg[pKey] = { ...existing, datum: datumVal, person: personVal,
                     status: 'geplant', ereignisId: id };
  });
  saveAllBegehung(allBeg);
}

// Begehung PDF — Modal öffnen
function openBegehungPdfModal() {
  const modal = document.getElementById('begehung-pdf-modal');
  if (!modal) return;
  const phasePairs = getFilteredSorted();
  const allBeg = loadAllBegehung();
  const list = document.getElementById('begehung-pdf-pair-list');
  if (list) {
    list.innerHTML = phasePairs.map(p => {
      const beg = allBeg[`${p.id}_${_activePhase}`] || {};
      const hasBeg = !!(beg.datum || beg.befund || beg.status);
      const checked = (p.id === currentPairId || hasBeg) ? 'checked' : '';
      const km = p.km_rs ? parseFloat(p.km_rs).toFixed(3) : '—';
      const dot = hasBeg ? '<span style="color:#16a34a;font-size:10px;margin-left:2px;">●</span>' : '';
      return `<label style="display:flex;align-items:center;gap:7px;font-size:11px;padding:3px 0;cursor:pointer;color:#374151;">
        <input type="checkbox" class="beg-pdf-chk" value="${p.id}" ${checked} style="accent-color:#1a3a5c;">
        Mast ${p.mast||'?'} · KM ${km}${dot}
      </label>`;
    }).join('');
  }
  modal.style.display = 'flex';
}

function begPdfSelectAll(select) {
  document.querySelectorAll('.beg-pdf-chk').forEach(el => el.checked = select);
}

function doExportBegehungPdf() {
  const pairIds = Array.from(document.querySelectorAll('.beg-pdf-chk:checked')).map(el => parseInt(el.value));
  if (!pairIds.length) { ui.toast('Bitte mindestens einen Standort auswählen.', 'fehler'); return; }
  const inclFotos = document.getElementById('beg-pdf-include-fotos')?.checked !== false;
  document.getElementById('begehung-pdf-modal').style.display = 'none';
  exportBegehungPdf(pairIds, inclFotos);
}

async function exportBegehungPdf(pairIds, inclFotos) {
  const jsPDFLib = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFLib) { ui.toast('jsPDF nicht geladen.', 'fehler'); return; }
  // Foto-Daten vorab laden — die Seitenschleife läuft danach synchron
  if (inclFotos) {
    await fotosFuerPdfLaden(pairIds.flatMap(id => getPairData(id).fotos || []));
  }
  const doc    = new jsPDFLib({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const allBeg = loadAllBegehung();
  const pn     = getActiveProjectName() || 'Projekt';
  const today  = new Date().toLocaleDateString('de-CH');
  const fmtD   = d => { if (!d) return '—'; const p = d.split('-'); return p.length===3 ? `${p[2]}.${p[1]}.${p[0]}` : d; };
  const STATUS_LABEL = { geplant:'Geplant', durchgefuehrt:'Durchgeführt', nichtmoeglich:'Nicht möglich' };
  const STATUS_COL   = { geplant:[245,158,11], durchgefuehrt:[22,163,74], nichtmoeglich:[220,38,38] };

  // Deckblatt-Kopf
  doc.setFillColor(26,58,92); doc.rect(0,0,210,3,'F');
  let y = 13;
  doc.setFontSize(14); doc.setFont(undefined,'bold'); doc.setTextColor(26,58,92);
  doc.text('Begehungs-Protokoll', 14, y);
  doc.setFontSize(9); doc.setFont(undefined,'normal'); doc.setTextColor(107,114,128);
  doc.text(pn, 14, y+6);
  doc.setFontSize(8); doc.text(today, 196, y, { align:'right' });
  doc.text(`${pairIds.length} Standort${pairIds.length!==1?'e':''}`, 196, y+6, { align:'right' });
  y += 14; doc.setDrawColor(229,231,235); doc.line(14,y,196,y); y += 7;

  pairIds.forEach((pairId, idx) => {
    const pair = PAIRS.find(p => p.id === pairId);
    if (!pair) return;
    const beg = allBeg[`${pairId}_${_activePhase}`] || {};

    // Neue Seite ab 2. Standort oder wenn Platz nicht reicht
    if (idx > 0) { doc.addPage(); y = 14; }

    // Standort-Header Box
    const statusCol = STATUS_COL[beg.status] || [100,116,139];
    doc.setFillColor(26,58,92);
    doc.roundedRect(14, y-4, 182, 11, 2, 2, 'F');
    doc.setFontSize(10); doc.setFont(undefined,'bold'); doc.setTextColor(255,255,255);
    doc.text(`Mast ${pair.mast||'—'}  ·  KM ${pair.km_rs ? parseFloat(pair.km_rs).toFixed(3) : '—'}`, 18, y+3);
    if (beg.status) {
      const sl = STATUS_LABEL[beg.status] || beg.status;
      doc.setFillColor(...statusCol); doc.roundedRect(162, y-2, 30, 7, 2, 2, 'F');
      doc.setFontSize(7); doc.text(sl, 177, y+2, { align:'center' });
    }
    y += 13;

    // Datum + Durchgeführt von
    doc.setTextColor(107,114,128); doc.setFontSize(8); doc.setFont(undefined,'bold');
    doc.text('Datum:', 14, y); doc.setFont(undefined,'normal'); doc.setTextColor(30,30,30);
    doc.text(fmtD(beg.datum), 36, y);
    doc.setFont(undefined,'bold'); doc.setTextColor(107,114,128);
    doc.text('Durchgeführt von:', 90, y); doc.setFont(undefined,'normal'); doc.setTextColor(30,30,30);
    const perLines = doc.splitTextToSize(beg.person || '—', 68);
    doc.text(perLines, 128, y); y += Math.max(perLines.length, 1) * 5 + 4;

    // Befund
    if (beg.befund) {
      doc.setFillColor(249,250,251); doc.roundedRect(14, y-2, 182, 6, 1, 1, 'F');
      doc.setFont(undefined,'bold'); doc.setTextColor(107,114,128); doc.setFontSize(7.5);
      doc.text('BEFUND / HINDERNISSE', 16, y+2);
      y += 7;
      doc.setFont(undefined,'normal'); doc.setTextColor(55,65,81); doc.setFontSize(8);
      const befLines = doc.splitTextToSize(beg.befund, 182);
      doc.text(befLines, 14, y); y += befLines.length * 4.5 + 4;
      doc.setTextColor(30,30,30);
    }

    // Massnahme
    if (beg.massnahmeJa === 'ja') {
      doc.setFillColor(255,243,205);
      const massLines = doc.splitTextToSize(beg.massnahmeBeschrieb || '(keine Beschreibung)', 172);
      doc.roundedRect(14, y-2, 182, massLines.length*4.5+10, 2, 2, 'F');
      doc.setFillColor(245,158,11); doc.roundedRect(14, y-2, 4, massLines.length*4.5+10, 1, 1, 'F');
      doc.setFont(undefined,'bold'); doc.setFontSize(7.5); doc.setTextColor(146,64,14);
      doc.text('MASSNAHME ERFORDERLICH', 20, y+2); y += 6;
      doc.setFont(undefined,'normal'); doc.setFontSize(8); doc.text(massLines, 20, y);
      y += massLines.length * 4.5 + 6; doc.setTextColor(30,30,30);
    }

    // Tags
    const tags = beg.tags || [];
    if (tags.length) {
      doc.setFont(undefined,'bold'); doc.setFontSize(7.5); doc.setTextColor(107,114,128);
      doc.text('TAGS', 14, y); y += 4;
      doc.setFont(undefined,'normal'); doc.setFontSize(8); doc.setTextColor(55,65,81);
      const tagLines = doc.splitTextToSize(tags.join('  ·  '), 182);
      doc.text(tagLines, 14, y); y += tagLines.length * 4.5 + 4;
      doc.setTextColor(30,30,30);
    }

    // Fotos
    if (inclFotos) {
      const pd = getPairData(pairId);
      // Fotos dieser Phase, ohne Abnahme, gefiltert auf Begehungs-Datum wenn vorhanden
      const begFotos = (pd.fotos || []).filter(f => {
        if ((f.phase || 'baugrund') !== _activePhase) return false;
        if (f.kategorie && f.kategorie !== 'begehung') return false; // nur reguläre + begehung
        if (!beg.datum) return true;
        // Begehungs-Fotos haben datum direkt gespeichert
        if (f.datum) return f.datum === beg.datum;
        // Reguläre Fotos: Datum aus ts-String parsen ("29.05.2026, 14:30")
        if (f.ts) {
          const dp = f.ts.split(',')[0].trim().split('.');
          if (dp.length === 3) {
            const fDate = `${dp[2]}-${dp[1].padStart(2,'0')}-${dp[0].padStart(2,'0')}`;
            return fDate === beg.datum;
          }
        }
        return false;
      });
      if (begFotos.length) {
        if (y > 230) { doc.addPage(); y = 14; }
        doc.setDrawColor(229,231,235); doc.line(14, y, 196, y); y += 5;
        doc.setFont(undefined,'bold'); doc.setFontSize(7.5); doc.setTextColor(107,114,128);
        doc.text('FOTOS', 14, y); y += 5;
        const imgW=56, imgH=42, perRow=3, gap=7;
        let col = 0;
        for (const f of begFotos) {
          if (col === 0 && y + imgH + 10 > 285) { doc.addPage(); y = 14; }
          try { doc.addImage(fotoPdfSrc(f), 'JPEG', 14 + col*(imgW+gap), y, imgW, imgH); } catch(e) {}
          col++;
          if (col >= perRow) { col = 0; y += imgH + 6; }
        }
        if (col > 0) y += imgH + 6;
      }
    }

    // Trennlinie
    if (idx < pairIds.length - 1) {
      y += 4; doc.setDrawColor(229,231,235); doc.line(14,y,196,y);
    }
  });

  doc.save(`Begehung_${pn.replace(/[^a-zA-Z0-9]/g,'_')}_${today.replace(/\./g,'-')}.pdf`);
}

// ============================================================
// AUSFÜHRUNGSPROJEKT
// ============================================================
const AUSFUEHRUNG_KEY = () => 'sp_ausfuehrung__' + _activeId;

function loadAllAusfuehrung() {
  try { return jsonParse(store.getItem(AUSFUEHRUNG_KEY())) || {}; } catch { return {}; }
}
function saveAllAusfuehrung(all) { store.setItem(AUSFUEHRUNG_KEY(), JSON.stringify(all)); }

function loadAusfuehrungFelder(pairId) {
  const all = loadAllAusfuehrung();
  const d = all[pairId] || {};
  const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  v('au-datum',      d.datum);
  v('au-firma',      d.firma);
  v('au-tiefe',      d.tiefe);
  v('au-protokoll',  d.protokoll);
  v('au-befund',     d.befund);
  v('au-link',       d.link);
  v('mat-fundtyp-ok',  d.matFundtypOk);
  v('mat-status',      d.matStatus);
  v('mat-bestellung',  d.matBestellung);
  v('mat-lieferdatum', d.matLieferdatum);
  v('mat-bemerkung',   d.matBemerkung);
  // Referenz aus Bauprojekt laden
  loadAusfuehrungRef(pairId);
  // Abnahme-Summary
  updateAbnahmeSummary(pairId);
  updateAusfuehrungUI();
  // Ausführungsplanung: Baupaket-Info + Notizen
  loadAusfPlanung(pairId);
  // Koten-Info: UK Fundament + GW-Kote
  renderAushubKotenInfo(pairId);
}

function saveAusfuehrung() {
  if (!currentPairId) return;
  const v = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const all = loadAllAusfuehrung();
  all[currentPairId] = {
    ...(all[currentPairId] || {}),
    datum:          v('au-datum'),
    firma:          v('au-firma'),
    tiefe:          v('au-tiefe'),
    protokoll:      v('au-protokoll'),
    befund:         v('au-befund'),
    link:           v('au-link'),
    matFundtypOk:   v('mat-fundtyp-ok'),
    matStatus:      v('mat-status'),
    matBestellung:  v('mat-bestellung'),
    matLieferdatum: v('mat-lieferdatum'),
    matBemerkung:   v('mat-bemerkung'),
  };
  saveAllAusfuehrung(all);
  updateAusfuehrungUI();
}

function loadAusfuehrungRef(pairId) {
  const el = document.getElementById('ausfuehrung-ref-content');
  if (!el) return;
  const bp = loadAllBauprojekt()[pairId] || {};
  const pair = PAIRS.find(p => p.id === pairId) || {};
  const lines = [];
  if (pair.mast)    lines.push(`Mast Nr.: <strong>${pair.mast}</strong>`);
  if (pair.km_rs)   lines.push(`KM: <strong>${parseFloat(pair.km_rs).toFixed(3)}</strong>`);
  const fundtyp = bp.fundtyp || pair.fundtyp || '';
  if (fundtyp)      lines.push(`Fundamenttyp: <strong>${fundtyp}</strong>`);
  const neigung = bp.neigung || pair.neigung || '';
  if (neigung)      lines.push(`Geländeneigung: <strong>${neigung}</strong>`);
  el.innerHTML = lines.length ? lines.join('<br>') : '— keine Bauprojekt-Daten —';
}

function updateAusfuehrungUI() {
  const isAF = _activePhase === 'ausfuehrung';
  ['sec-ausfuehrung-ref','sec-aushub','sec-material','sec-abnahme-link'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isAF ? '' : 'none';
  });

  // Aushub-Status-Dot
  const protokoll = document.getElementById('au-protokoll')?.value;
  const aushubDot = document.getElementById('aushub-status-dot');
  if (aushubDot) {
    const color = protokoll === 'ja' ? '#16a34a' : protokoll === 'pendent' ? '#f59e0b' : protokoll === 'nein' ? '#dc2626' : '';
    aushubDot.innerHTML = color ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};"></span>` : '';
  }

  // Material-Status-Dot
  const matStatus = document.getElementById('mat-status')?.value;
  const matDot = document.getElementById('material-status-dot');
  if (matDot) {
    const color = matStatus === 'geliefert' ? '#16a34a' : matStatus === 'bestellt' ? '#f59e0b' : matStatus === 'pendent' ? '#dc2626' : '';
    matDot.innerHTML = color ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};"></span>` : '';
  }
}

// Berechnet Betonvolumen aus FT-Profil (Block + Kopf) in m³
// vfk=true: Kopf wird als Fertigteil geliefert → nur Blockvolumen
function _ftBetonVolumen(ft, vfk) {
  // Delegiert an die gemeinsame Formel in fundamenttypen.js. Hier stand eine
  // eigene Rechnung, die den Block über die volle Tiefe legte UND den Kopf
  // addierte — die oberste Kopfhöhe war doppelt gezählt.
  const v = ftBetonVolumen(ft, vfk);
  return v ? v.total : null;
}

// Materialpositionen für ein FT-Profil (1 Fundament)
// vfk=true: VFK-Position hinzufügen, Kopfvolumen aus Beton ausschliessen
function _ftMaterialItems(ft, bestand, vfk) {
  const vol = _ftBetonVolumen(ft, vfk);
  const items = [];
  if (ft.schraubenArtikelNr) {
    const schrBez = ft.schraubenAnzahl && ft.schraubenDurchmesser
      ? `Fundamentschrauben ${ft.schraubenAnzahl}×${ft.schraubenDurchmesser}${ft.schraubenLaenge ? ', '+ankerLaengeText(ft.schraubenLaenge) : ''} – ${ft.name}`
      : `Fundamentschrauben-Set ${ft.name}`;
    items.push({ artNr: ft.schraubenArtikelNr, bez: schrBez, menge: 1, einh: 'Set' });
  }
  if (ft.buegelArtikelNr) {
    const bBez = ft.buegelAnzahl && ft.buegelDurchmesser
      ? `Bewehrungsbügel ${ft.buegelAnzahl}×Ø${ft.buegelDurchmesser}/${ft.buegelSeitenlaenge} mm (${ft.buegelMaterial || 'B500B'}) – ${ft.name}`
      : `Bewehrungsbügel-Set ${ft.name}`;
    items.push({ artNr: ft.buegelArtikelNr, bez: bBez, menge: 1, einh: 'Set' });
  }
  if (vfk && ft.vfkZeichnungsNr)
    items.push({ artNr: ft.vfkZeichnungsNr, bez: `VFK – Vorfabrizierter Fundamentkopf ${ft.name}`, menge: 1, einh: 'Stk.' });
  if (vol != null)
    items.push({ artNr: '—', bez: `Beton (${ft.beton || 'C30/37'})`, menge: +vol.toFixed(3), einh: 'm³' });
  items.push({ artNr: '—', bez: `Bewehrung (${ft.bewehrung || 'B550B, feuerverzinkt'})`, menge: 'gem. Plan', einh: '—' });
  return items;
}

function renderMaterialliste() {
  const out = document.getElementById('mat-materialliste-output');
  if (!out || !currentPairId) return;

  const allBp  = loadAllBauprojekt();
  const bpData = allBp[currentPairId] || {};
  const bestand = bpData.bestand || '';

  if (bestand !== 'neu' && bestand !== 'prov') {
    out.innerHTML = '<div style="font-size:11px;color:#9ca3af;padding:4px 0;font-style:italic;">Materialliste nur für Neubau / Provisorium.</div>';
    return;
  }

  const ftName = bpData.fundtyp || '';
  const ft = ftName ? loadFtProfile().find(t => t.name === ftName) : null;
  if (!ft) {
    out.innerHTML = '<div style="font-size:11px;color:#9ca3af;padding:4px 0;">Kein Fundamenttyp zugewiesen.</div>';
    return;
  }

  const pair   = PAIRS.find(p => p.id === currentPairId) || {};
  const vfk    = !!(bpData.vfk) && !!ft.vfkZeichnungsNr;
  const items  = _ftMaterialItems(ft, bestand, vfk);

  const thS = 'padding:5px 8px;font-size:10px;font-weight:700;color:white;text-align:left;border-right:1px solid #2d4f73;white-space:nowrap;';
  const tdS = 'padding:4px 8px;font-size:11px;color:#111827;border-bottom:1px solid #f0f2f5;border-right:1px solid #f0f2f5;';
  const tdMono = tdS + 'font-family:monospace;font-size:10px;color:#1a3a5c;font-weight:600;';

  out.innerHTML = `
    <div style="border:1px solid #d1d5db;border-radius:6px;overflow:hidden;margin-top:6px;font-family:inherit;">
      <div style="background:#1a3a5c;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:11px;font-weight:700;color:white;letter-spacing:.02em;">Materialliste &nbsp;·&nbsp; Mast ${pair.mast || currentPairId}</span>
        <span style="font-size:10px;color:#93c5fd;">${bestand === 'prov' ? 'Provisorium' : 'Neubau'} &nbsp;·&nbsp; ${ft.name}${ft.zeichnungsNr ? ' &nbsp;·&nbsp; Zeichn. ' + ft.zeichnungsNr : ''}${vfk ? ' &nbsp;·&nbsp; VFK' : ''}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#334155;">
            <th style="${thS}width:26px;text-align:center;">Pos.</th>
            <th style="${thS}width:96px;">Art.-Nr.</th>
            <th style="${thS}">Bezeichnung</th>
            <th style="${thS}width:56px;text-align:right;">Menge</th>
            <th style="${thS}width:34px;border-right:none;">Einh.</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, i) => `<tr style="background:${i % 2 === 0 ? 'white' : '#f8fafc'};">
            <td style="${tdS}text-align:center;color:#9ca3af;">${i + 1}</td>
            <td style="${tdMono}">${it.artNr}</td>
            <td style="${tdS}">${it.bez}</td>
            <td style="${tdS}text-align:right;font-weight:600;">${typeof it.menge === 'number' ? it.menge.toFixed(it.einh === 'm³' ? 2 : 0) : it.menge}</td>
            <td style="${tdS}color:#6b7280;border-right:none;">${it.einh}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Statische Zubehör- und Fixierungsdaten für Stückliste ────────────────────
const SCHRAUB_ZUBEHOER_DB = {
  'M30': [
    { artNr:'370.00.111',  bez:'6kt-Mu ISO 4032-M30-8',  material:'St tZn', anzPro:2 },
    { artNr:'481.10.1302', bez:'U-Scheibe M30 33×56×4',   material:'St tZn', anzPro:2 },
  ],
  'M36': [
    { artNr:'370.00.131',  bez:'6kt-Mu ISO 4032-M36-8',  material:'St tZn', anzPro:2 },
    { artNr:'481.10.1362', bez:'U-Scheibe M36 39×66×5',   material:'St tZn', anzPro:2 },
  ],
};
const FIXIERUNG_FL_DB = {
  'DP1a': [{ artNr:'371.06.153', bez:'FL DIN 174-25×3-440',                      anzPro:4 }],
  'DP2a': [{ artNr:'371.06.153', bez:'FL DIN 174-25×3-440',                      anzPro:4 }],
  'DG1a': [{ artNr:'371.06.154', bez:'FL DIN 174-25×3-600',                      anzPro:4 }],
  'DG2a': [{ artNr:'371.06.155', bez:'FL DIN 174-25×3-850 (lange Seite)',         anzPro:2 },
            { artNr:'371.06.156', bez:'FL DIN 174-25×3-360 (kurze Seite)',        anzPro:2 }],
  'DG3a': [{ artNr:'371.06.155', bez:'FL DIN 174-25×3-850 (lange Seite)',         anzPro:2 },
            { artNr:'371.06.156', bez:'FL DIN 174-25×3-360 (kurze Seite)',        anzPro:2 }],
  'HP1a': [{ artNr:'371.06.157', bez:'FL DIN 174-25×3-500',                      anzPro:6 }],
  'HP2a': [{ artNr:'371.06.157', bez:'FL DIN 174-25×3-500',                      anzPro:6 }],
};
const BUEGEL_ABGEW_DB = {
  '371.06.158': 1.86, '371.06.159': 1.96, '371.06.160': 2.60,
  '371.06.161': 2.20, '371.06.162': 2.20,
};
const BUEGEL_SCREW_DB = {
  '371.06.158': 'M30', '371.06.159': 'M36', '371.06.160': 'M36',
  '371.06.161': 'M36', '371.06.162': 'M36',
};

/** Aggregiert Materialien aus Neubau/Prov-Positionen mit Standardtyp. selectedIds: Array<pairId> oder null = alle */
function _calcMateriallisteData(selectedIds) {
  const allBp  = loadAllBauprojekt();
  const ftProf = loadFtProfile();
  const positionen = PAIRS.map(p => {
    if (selectedIds && !selectedIds.includes(p.id)) return null;
    const bp = allBp[p.id] || {};
    if (bp.bestand !== 'neu' && bp.bestand !== 'prov') return null;
    const ft = bp.fundtyp ? ftProf.find(t => t.name === bp.fundtyp && t.typ === 'standard') : null;
    if (!ft) return null;
    return { pair: p, bp, ft, family: ft.name.split('/')[0].trim() };
  }).filter(Boolean);

  const ftCounts = {};
  positionen.forEach(({ ft }) => { ftCounts[ft.name] = (ftCounts[ft.name] || 0) + 1; });

  const schrAgg = {};
  positionen.forEach(({ ft, family }) => {
    if (!ft.schraubenArtikelNr) return;
    const an = ft.schraubenArtikelNr;
    if (!schrAgg[an]) schrAgg[an] = {
      artNr: an, durchm: ft.schraubenDurchmesser,
      laengeM: ft.schraubenLaenge ? ft.schraubenLaenge / 100 : null,   // cm -> m, siehe ANKER_LAENGE_EINHEIT
      material: ft.schraubenMaterial || 'B550B / tZn',
      anzStueck: 0, families: new Set(),
    };
    schrAgg[an].anzStueck += +ft.schraubenAnzahl || 4;
    schrAgg[an].families.add(family);
  });

  const zubehoerAgg = {};
  Object.values(schrAgg).forEach(s => {
    (SCHRAUB_ZUBEHOER_DB[s.durchm] || []).forEach(z => {
      if (!zubehoerAgg[z.artNr]) zubehoerAgg[z.artNr] = { artNr:z.artNr, bez:z.bez, material:z.material, anzStueck:0 };
      zubehoerAgg[z.artNr].anzStueck += s.anzStueck * z.anzPro;
    });
  });

  const buegelAgg = {};
  positionen.forEach(({ ft, family }) => {
    if (!ft.buegelArtikelNr) return;
    const an = ft.buegelArtikelNr;
    if (!buegelAgg[an]) buegelAgg[an] = {
      artNr: an, durchm: ft.buegelDurchmesser,
      dim: ft.buegelSeitenlaenge, material: ft.buegelMaterial || 'B500B',
      anzStueck: 0, families: new Set(),
    };
    buegelAgg[an].anzStueck += 2;
    buegelAgg[an].families.add(family);
  });

  const fixAgg = {};
  positionen.forEach(({ family }) => {
    (FIXIERUNG_FL_DB[family] || []).forEach(fix => {
      if (!fixAgg[fix.artNr]) fixAgg[fix.artNr] = {
        artNr: fix.artNr, bez: fix.bez, material: 'S235JRG2', anzStueck: 0, families: new Set(),
      };
      fixAgg[fix.artNr].anzStueck += fix.anzPro;
      fixAgg[fix.artNr].families.add(family);
    });
  });

  return {
    positionen, ftCounts, total: positionen.length,
    schrAgg:     Object.values(schrAgg).sort((a,b) => a.artNr.localeCompare(b.artNr)),
    zubehoerAgg: Object.values(zubehoerAgg).sort((a,b) => a.artNr.localeCompare(b.artNr)),
    buegelAgg:   Object.values(buegelAgg).sort((a,b) => a.artNr.localeCompare(b.artNr)),
    fixAgg:      Object.values(fixAgg).sort((a,b) => a.artNr.localeCompare(b.artNr)),
  };
}

// ── Positionsauswahl-Helpers ─────────────────────────────────
function getMexSelectedIds() {
  const checks = document.querySelectorAll('#mex-pos-list input[type=checkbox]');
  if (!checks.length) return null;
  return [...checks].filter(c => c.checked).map(c => +c.dataset.pid);
}
function mexSelAll(state) {
  document.querySelectorAll('#mex-pos-list input[type=checkbox]').forEach(c => c.checked = state);
  _updateMexCount(); return false;
}
function _updateMexCount() {
  const all = document.querySelectorAll('#mex-pos-list input[type=checkbox]').length;
  const sel = document.querySelectorAll('#mex-pos-list input[type=checkbox]:checked').length;
  const el = document.getElementById('mex-pos-count');
  if (el) el.textContent = `${sel} / ${all}`;
}
function renderMexPositionList() {
  const list = document.getElementById('mex-pos-list');
  if (!list) return;
  const allBp  = loadAllBauprojekt();
  const ftProf = loadFtProfile();
  const pairs  = (typeof PAIRS !== 'undefined' ? PAIRS : [])
    .filter(p => {
      const bp = allBp[p.id] || {};
      if (bp.bestand !== 'neu' && bp.bestand !== 'prov') return false;
      return !!(bp.fundtyp ? ftProf.find(t => t.name === bp.fundtyp && t.typ === 'standard') : false);
    })
    .sort((a, b) => parseFloat(a.km_rs || a.km_rks || 0) - parseFloat(b.km_rs || b.km_rks || 0));
  if (!pairs.length) {
    list.innerHTML = '<div style="padding:8px 10px;font-size:11px;color:#9ca3af;">Keine Neubau-/Prov-Positionen gefunden.</div>';
    return;
  }
  list.innerHTML = pairs.map(p => {
    const bp  = allBp[p.id] || {};
    const ft  = ftProf.find(t => t.name === bp.fundtyp && t.typ === 'standard');
    const km  = p.km_rs ? parseFloat(p.km_rs).toFixed(3) : (p.km_rks ? parseFloat(p.km_rks).toFixed(3) : '—');
    const typ = bp.bestand === 'prov' ? 'Prov.' : 'Neubau';
    return `<label style="display:flex;align-items:center;gap:8px;padding:4px 10px;border-bottom:1px solid #f3f4f6;cursor:pointer;">
      <input type="checkbox" data-pid="${p.id}" checked onchange="_updateMexCount()" style="accent-color:#1a3a5c;flex-shrink:0;">
      <span style="min-width:64px;font-size:11px;font-weight:600;color:#374151;">${p.mast || 'Pos. '+p.id}</span>
      <span style="min-width:60px;font-size:10px;color:#6b7280;">KM ${km}</span>
      <span style="min-width:44px;font-size:10px;color:#6b7280;">${typ}</span>
      <span style="font-size:11px;font-weight:600;color:#1a3a5c;">${ft?.name || '—'}</span>
    </label>`;
  }).join('');
  _updateMexCount();
}

function openMaterialExportModal() {
  const kd = loadKenndaten();
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.value = v||''; };
  set('mex-projekt',    getActiveProjectName() || '');
  set('mex-isp',        kd.isp || '');
  set('mex-phase',      kd.mexPhase || 'Ausführung');
  set('mex-datum',      kd.mexDatum || new Date().toISOString().slice(0,10));
  set('mex-ersteller',  kd.mexErsteller || '');
  set('mex-kontierung', kd.mexKontierung || '');
  document.getElementById('mat-export-modal').style.display = 'flex';
  renderMexPositionList();
}
function closeMaterialExportModal() {
  document.getElementById('mat-export-modal').style.display = 'none';
}
function saveMexToKenndaten() {
  const g = id => document.getElementById(id)?.value || '';
  saveKenndatenData({
    ...loadKenndaten(),
    mexPhase:      g('mex-phase'),
    mexDatum:      g('mex-datum'),
    mexErsteller:  g('mex-ersteller'),
    mexKontierung: g('mex-kontierung'),
  });
  showToast('Projektdaten gespeichert');
}

function exportMateriallisteExcelFull() {
  if (!window.XLSX) { ui.toast('SheetJS nicht geladen.', 'fehler'); return; }
  const selectedIds = getMexSelectedIds();
  const d = _calcMateriallisteData(selectedIds);
  if (!d.total) { ui.toast('Keine Neubau-/Provisorium-Positionen mit Standardtyp vorhanden.', 'fehler'); return; }

  const get  = id => document.getElementById(id)?.value || '';
  const pn   = get('mex-projekt') || getActiveProjectName() || 'Projekt';
  const isp  = get('mex-isp');
  const phase= get('mex-phase') || 'Ausführung';
  const datum= get('mex-datum') || new Date().toLocaleDateString('de-CH');
  const erst = get('mex-ersteller');
  const kont = get('mex-kontierung');

  const C = 9; // Spaltenanzahl
  const E = (n) => Array(C).fill('').map((_, i) => i === 0 ? (n||'') : ''); // Sektions-Header-Zeile
  const secHdr = txt => { const r = E(txt); return r; };

  // ── Sheet 1: Positionen ──────────────────────────────────────
  const posRows = [];
  posRows.push([`Positionen · ${pn}${isp ? ' · ISP '+isp : ''} · ${datum}`]);
  posRows.push([]);
  posRows.push(['Mast / Pos.', 'KM / Sta.', 'Massnahme', 'Fundamenttyp', 'Zeichnungs-Nr.', 'VFK', 'Neigung', 'Betonmaterial', 'Fundamentschrauben']);
  d.positionen.forEach(({ pair: p, bp, ft }) => {
    const km  = p.km_rs ? parseFloat(p.km_rs).toFixed(3) : (p.km_rks ? parseFloat(p.km_rks).toFixed(3) : '—');
    const vfk = bp.vfk ? 'Ja' : '—';
    posRows.push([
      p.mast || 'Pos. '+p.id, km,
      bp.bestand === 'prov' ? 'Provisorium' : 'Neubau',
      ft?.name || '—', ft?.zeichnungsNr || '—', vfk,
      bp.neigung || '—',
      ft?.beton ? ft.beton.split(',')[0] : '—',
      ft?.schraubenAnzahl && ft?.schraubenDurchmesser
        ? `${ft.schraubenAnzahl}×${ft.schraubenDurchmesser}, ${ankerLaengeText(ft.schraubenLaenge) || 'L=?'}` : '—',
    ]);
  });
  const wsP = window.XLSX.utils.aoa_to_sheet(posRows);
  wsP['!cols'] = [{wch:14},{wch:10},{wch:13},{wch:14},{wch:18},{wch:6},{wch:12},{wch:20},{wch:22}];

  // ── Sheet 2: Materialliste ───────────────────────────────────
  const rows = [];
  rows.push(['Materialliste für Fundamentbau', ...Array(C-1).fill('')]);
  rows.push([]);
  rows.push(['Projekt:',   pn,    '', '', 'Total Anz. Fundamente:', d.total, '', '', '']);
  rows.push(['ISP:',       isp,   '', '', 'Phase:',  phase, '', '', '']);
  rows.push(['Datum:',     datum, '', '', 'Ersteller:', erst, '', '', '']);
  rows.push(['Kontierung:',kont,  '', '', '', '', '', '', '']);
  rows.push([]);

  // FT-Typ Übersicht
  rows.push([...secHdr('Anzahl Fundamenttyp Standard (Neubau/Prov)')]);
  const ftOrder = DEFAULT_FT_PROFIL.filter(t => t.typ === 'standard').map(t => t.name);
  const used    = ftOrder.filter(n => d.ftCounts[n]);
  rows.push(['Typ', 'Anz.', '', 'Typ', 'Anz.', '', 'Typ', 'Anz.', '']);
  const col1 = used.slice(0, Math.ceil(used.length / 3));
  const col2 = used.slice(col1.length, col1.length + Math.ceil(used.length / 3));
  const col3 = used.slice(col1.length + col2.length);
  for (let i = 0; i < Math.max(col1.length, col2.length, col3.length); i++) {
    rows.push([
      col1[i]||'', col1[i]?(d.ftCounts[col1[i]]||0):'', '',
      col2[i]||'', col2[i]?(d.ftCounts[col2[i]]||0):'', '',
      col3[i]||'', col3[i]?(d.ftCounts[col3[i]]||0):'', '',
    ]);
  }
  rows.push([]);

  // Fundamentschrauben
  rows.push([...secHdr('Fundamentschrauben')]);
  rows.push(['Pos.','Anz. [Stk.]','Bezeichnung','Art.-Nr.','Länge [m]','Total L. [m]','Material','Bemerkungen','zu Fund. Typ Std.']);
  d.schrAgg.forEach((s, i) => {
    const L   = s.laengeM ? s.laengeM.toFixed(2) : '—';
    const tot = s.laengeM ? (s.anzStueck * s.laengeM).toFixed(2) : '—';
    rows.push([
      i+1, s.anzStueck,
      `Fundamentschrauben ${s.durchm}, L = ${s.laengeM ? (s.laengeM*100).toFixed(0) : '?'} cm`,
      s.artNr, L, tot, s.material,
      `Fundamentschraube ${s.durchm}, L=${s.laengeM?(s.laengeM*100).toFixed(0):'?'} cm — ${s.material}`,
      [...s.families].join(' / '),
    ]);
  });
  rows.push([]);

  // Zubehör
  rows.push([...secHdr('Zubehör Fundamentschrauben (Muttern / Scheiben)')]);
  rows.push(['Pos.','Anz. [Stk.]','Bezeichnung','Art.-Nr.','','','Material','Bemerkungen','']);
  d.zubehoerAgg.forEach((z, i) => rows.push([
    i+11, z.anzStueck, z.bez, z.artNr, '', '', z.material,
    `${z.bez} — ${z.material}`, '',
  ]));
  rows.push([]);

  // Schubbewehrung
  rows.push([...secHdr('Schubbewehrung pro Fundament (Bewehrungsbügel)')]);
  rows.push(['Pos.','Anz. [Stk.]','Ø [mm]','abgew. L. [m]','Total L. [m]','Aussenmasse [cm]','Material','Bemerkungen','zu Fund. Typ Std.']);
  d.buegelAgg.forEach((b, i) => {
    const schrTyp = BUEGEL_SCREW_DB[b.artNr] || 'M36';
    const abgL    = BUEGEL_ABGEW_DB[b.artNr] || '';
    const totL    = abgL ? (b.anzStueck * abgL).toFixed(2) : '—';
    const dimCm   = b.dim ? (b.dim.includes('×')
      ? b.dim.split('×').map(v => (+v/10).toFixed(0)).join(' × ')
      : (+b.dim/10).toFixed(0) + ' × ' + (+b.dim/10).toFixed(0)) : '—';
    rows.push([
      i+21, b.anzStueck, b.durchm,
      abgL ? abgL.toFixed(2) : '—', totL, dimCm, b.material,
      `Bewehrungsbügel zu FL-Blockfundament für ${schrTyp} ${dimCm} cm (gem. ${b.artNr}) (2 Stk. / Fundament)`,
      [...b.families].join(' / '),
    ]);
  });
  rows.push([]);

  // Fixierung
  rows.push([...secHdr('Fixierung der Fundamentschrauben unten pro Fundament')]);
  rows.push(['Pos.','Anz. [Stk.]','Bez.','Bezeichnung DIN','Art.-Nr.','Länge [mm]','Material','Bemerkungen','zu Fund. Typ Std.']);
  d.fixAgg.forEach((f, i) => {
    const lenMatch = f.bez.match(/-(\d+)$/);
    const lenMm    = lenMatch ? lenMatch[1] : '—';
    rows.push([
      i+31, f.anzStueck, 'Flachstahl', f.bez, f.artNr, lenMm, f.material,
      `Fixierung der Fundamentschrauben unten (gem. ${f.artNr})`,
      [...f.families].join(' / '),
    ]);
  });

  const ws = window.XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:5},{wch:10},{wch:36},{wch:16},{wch:11},{wch:14},{wch:16},{wch:52},{wch:16}];

  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, wsP, 'Positionen');
  window.XLSX.utils.book_append_sheet(wb, ws,  'Materialliste');
  window.XLSX.writeFile(wb, `Materialliste_${pn.replace(/[^a-zA-Z0-9_]/g,'_')}_${datum.replace(/\./g,'-')}.xlsx`);
  closeMaterialExportModal();
}

function exportMateriallistePdf() {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) { ui.toast('jsPDF nicht geladen.', 'fehler'); return; }
  const selectedIds = getMexSelectedIds();
  const d = _calcMateriallisteData(selectedIds);
  if (!d.total) { ui.toast('Keine Neubau-/Provisorium-Positionen mit Standardtyp vorhanden.', 'fehler'); return; }

  const get  = id => document.getElementById(id)?.value || '';
  const pn   = get('mex-projekt') || getActiveProjectName() || 'Projekt';
  const isp  = get('mex-isp');
  const phase= get('mex-phase') || 'Ausführung';
  const datum= get('mex-datum') || new Date().toLocaleDateString('de-CH');
  const erst = get('mex-ersteller');
  const kont = get('mex-kontierung');

  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
  const ml = 10, pw = 277;
  let y = 12;

  const DARK = [26, 58, 92];
  const MID  = [51, 65, 85];

  const secBar = (title, yPos) => {
    doc.setFillColor(...MID);
    doc.rect(ml, yPos, pw, 6, 'F');
    doc.setTextColor(255,255,255); doc.setFont(undefined,'bold'); doc.setFontSize(8.5);
    doc.text(title, ml+2, yPos+4.2);
    doc.setTextColor(0,0,0); doc.setFont(undefined,'normal');
    return yPos + 6;
  };
  const pageCheck = (needed) => {
    if (y + needed > 192) { doc.addPage(); y = 12; }
  };
  const footer = () => {
    const n = doc.internal.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setFont(undefined,'normal'); doc.setTextColor(150,150,150);
      doc.text(`${pn}${isp?' · ISP '+isp:''}${phase?' · '+phase:''}  ·  ${datum}`, ml, 202);
      doc.text(`Seite ${i} / ${n}`, ml+pw, 202, {align:'right'});
      doc.setDrawColor(210,210,210); doc.line(ml, 200, ml+pw, 200);
    }
  };

  // ── Titel + Kopf ─────────────────────────────────────────────
  doc.setFont(undefined,'bold'); doc.setFontSize(13); doc.setTextColor(...DARK);
  doc.text('Materialliste — Fundamentbau', ml, y); y += 6;
  doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.setTextColor(0,0,0);
  const hL = [['Projekt:',pn],['ISP:',isp],['Phase:',phase],['Datum:',datum],['Ersteller:',erst],['Kontierung:',kont]];
  const hY0 = y;
  hL.forEach(([lbl,val],i) => {
    const x = ml + (i % 3) * 92;
    const ly = hY0 + Math.floor(i/3) * 5;
    doc.setFont(undefined,'bold'); doc.text(lbl, x, ly);
    doc.setFont(undefined,'normal'); doc.text(val||'—', x+22, ly);
  });
  // Total-Box
  doc.setFillColor(...DARK); doc.rect(ml+pw-36, hY0-4, 36, 12, 'F');
  doc.setTextColor(255,255,255); doc.setFont(undefined,'bold'); doc.setFontSize(7);
  doc.text('Total Fundamente', ml+pw-34, hY0+1);
  doc.setFontSize(14); doc.text(String(d.total), ml+pw-18, hY0+8, {align:'center'});
  doc.setTextColor(0,0,0); doc.setFont(undefined,'normal'); doc.setFontSize(8);
  y = hY0 + 13;

  // ── FT-Übersicht ─────────────────────────────────────────────
  y = secBar('Anzahl Fundamenttyp Standard (Neubau / Provisorium)', y) + 1;
  const ftOrder = DEFAULT_FT_PROFIL.filter(t => t.typ==='standard').map(t => t.name);
  const used    = ftOrder.filter(n => d.ftCounts[n]);
  const cols3   = [used.slice(0, Math.ceil(used.length/3)), used.slice(Math.ceil(used.length/3), Math.ceil(used.length*2/3)), used.slice(Math.ceil(used.length*2/3))];
  const maxFt   = Math.max(1,...cols3.map(c=>c.length));
  const ftBody  = Array.from({length:maxFt},(_,i) => cols3.map(col => col[i]?[col[i],d.ftCounts[col[i]]||0]:['','']).flat());
  doc.autoTable({
    startY:y, head:[['Typ','Anz.','Typ','Anz.','Typ','Anz.']], body:ftBody,
    theme:'grid',
    headStyles:{ fillColor:DARK, textColor:255, fontSize:8, fontStyle:'bold', halign:'center' },
    bodyStyles:{ fontSize:8.5 },
    columnStyles:{0:{cellWidth:44},1:{cellWidth:12,halign:'center',fontStyle:'bold'},2:{cellWidth:44},3:{cellWidth:12,halign:'center',fontStyle:'bold'},4:{cellWidth:44},5:{cellWidth:12,halign:'center',fontStyle:'bold'}},
    margin:{left:ml},
    didParseCell(data){ if(data.section==='body'&&data.column.index%2===1){const v=parseInt(data.cell.raw);if(!v)data.cell.styles.textColor=[180,180,180];} }
  });
  y = doc.lastAutoTable.finalY + 5;

  // ── Positionen ───────────────────────────────────────────────
  pageCheck(30);
  y = secBar('Positionen', y) + 1;
  const posBody = d.positionen.map(({pair:p,bp,ft}) => {
    const km = p.km_rs ? parseFloat(p.km_rs).toFixed(3) : (p.km_rks ? parseFloat(p.km_rks).toFixed(3) : '—');
    return [
      p.mast||'Pos.'+p.id, km,
      bp.bestand==='prov'?'Provisorium':'Neubau',
      ft?.name||'—', ft?.zeichnungsNr||'—',
      bp.vfk?'Ja':'—', bp.neigung||'—',
    ];
  });
  doc.autoTable({
    startY:y, head:[['Mast / Pos.','KM / Sta.','Massnahme','Fundamenttyp','Zeichnungs-Nr.','VFK','Neigung']], body:posBody,
    theme:'striped',
    headStyles:{ fillColor:DARK, textColor:255, fontSize:8, fontStyle:'bold' },
    bodyStyles:{ fontSize:8 },
    columnStyles:{0:{cellWidth:28},1:{cellWidth:20,halign:'center'},2:{cellWidth:24},3:{cellWidth:28,fontStyle:'bold'},4:{cellWidth:32,fontStyle:'bold'},5:{cellWidth:14,halign:'center'},6:{cellWidth:20}},
    margin:{left:ml},
  });
  y = doc.lastAutoTable.finalY + 5;

  // ── Fundamentschrauben ───────────────────────────────────────
  pageCheck(20);
  y = secBar('Fundamentschrauben', y) + 1;
  const schrBody = d.schrAgg.map((s,i) => [
    i+1, s.anzStueck,
    `Fundamentschrauben ${s.durchm}, L=${s.laengeM?(s.laengeM*100).toFixed(0):'?'} cm`,
    s.artNr,
    s.laengeM?s.laengeM.toFixed(2)+'m':'—',
    s.laengeM?(s.anzStueck*s.laengeM).toFixed(2)+'m':'—',
    s.material, [...s.families].join(' / '),
  ]);
  doc.autoTable({
    startY:y, head:[['Pos.','Anz.','Bezeichnung','Art.-Nr.','L [m]','Total L [m]','Material','zu Fund. Typ Std.']], body:schrBody,
    theme:'grid',
    headStyles:{ fillColor:MID, textColor:255, fontSize:8, fontStyle:'bold' },
    bodyStyles:{ fontSize:8 },
    columnStyles:{0:{cellWidth:10,halign:'center'},1:{cellWidth:12,halign:'center'},2:{cellWidth:58},3:{cellWidth:24,fontStyle:'bold'},4:{cellWidth:16,halign:'center'},5:{cellWidth:20,halign:'center'},6:{cellWidth:34},7:{cellWidth:28}},
    margin:{left:ml},
  });
  y = doc.lastAutoTable.finalY + 4;

  // ── Zubehör ──────────────────────────────────────────────────
  pageCheck(20);
  y = secBar('Zubehör Fundamentschrauben (Muttern / Scheiben)', y) + 1;
  const zubBody = d.zubehoerAgg.map((z,i) => [i+11, z.anzStueck, z.bez, z.artNr, z.material]);
  doc.autoTable({
    startY:y, head:[['Pos.','Anz.','Bezeichnung','Art.-Nr.','Material']], body:zubBody,
    theme:'grid',
    headStyles:{ fillColor:MID, textColor:255, fontSize:8, fontStyle:'bold' },
    bodyStyles:{ fontSize:8 },
    columnStyles:{0:{cellWidth:10,halign:'center'},1:{cellWidth:12,halign:'center'},2:{cellWidth:100},3:{cellWidth:28,fontStyle:'bold'},4:{cellWidth:36}},
    margin:{left:ml},
  });
  y = doc.lastAutoTable.finalY + 4;

  // ── Schubbewehrung ───────────────────────────────────────────
  pageCheck(30);
  y = secBar('Schubbewehrung pro Fundament (Bewehrungsbügel)', y) + 1;
  const buegelBody = d.buegelAgg.map((b,i) => {
    const schrTyp = BUEGEL_SCREW_DB[b.artNr]||'M36';
    const abgL    = BUEGEL_ABGEW_DB[b.artNr]||'';
    const totL    = abgL?(b.anzStueck*abgL).toFixed(2)+' m':'—';
    const dimCm   = b.dim?(b.dim.includes('×')
      ?b.dim.split('×').map(v=>(+v/10).toFixed(0)).join(' × ')
      :(+b.dim/10).toFixed(0)+' × '+(+b.dim/10).toFixed(0)):'—';
    return [
      i+21, b.anzStueck, b.durchm,
      abgL?abgL.toFixed(2)+' m':'—', totL, dimCm,
      b.material, b.artNr,
      `Bewehrungsbügel zu FL-Blockfundament für ${schrTyp} ${dimCm} cm (gem. ${b.artNr}) (2 Stk./Fundament)`,
      [...b.families].join(' / '),
    ];
  });
  doc.autoTable({
    startY:y,
    head:[['Pos.','Anz.','Ø [mm]','abgew. L [m]','Total L [m]','Aussenmasse [cm]','Material','Art.-Nr.','Bemerkungen','zu Typ']],
    body:buegelBody,
    theme:'grid',
    headStyles:{ fillColor:MID, textColor:255, fontSize:7.5, fontStyle:'bold' },
    bodyStyles:{ fontSize:7.5 },
    columnStyles:{0:{cellWidth:9,halign:'center'},1:{cellWidth:10,halign:'center'},2:{cellWidth:11,halign:'center'},3:{cellWidth:17,halign:'center'},4:{cellWidth:17,halign:'center'},5:{cellWidth:22,halign:'center'},6:{cellWidth:16},7:{cellWidth:20,fontStyle:'bold'},8:{cellWidth:72},9:{cellWidth:18}},
    margin:{left:ml},
  });
  y = doc.lastAutoTable.finalY + 4;

  // ── Fixierung ────────────────────────────────────────────────
  pageCheck(30);
  y = secBar('Fixierung der Fundamentschrauben unten pro Fundament', y) + 1;
  const fixBody = d.fixAgg.map((f,i) => {
    const lenMatch = f.bez.match(/-(\d+)$/);
    const lenMm    = lenMatch?lenMatch[1]:'—';
    return [
      i+31, f.anzStueck, 'Flachstahl', f.bez, f.artNr, lenMm+' mm', f.material,
      `Fixierung der Fundamentschrauben unten (gem. ${f.artNr})`,
      [...f.families].join(' / '),
    ];
  });
  doc.autoTable({
    startY:y,
    head:[['Pos.','Anz.','Bez.','Bezeichnung DIN','Art.-Nr.','Länge','Material','Bemerkungen','zu Typ']],
    body:fixBody,
    theme:'grid',
    headStyles:{ fillColor:MID, textColor:255, fontSize:7.5, fontStyle:'bold' },
    bodyStyles:{ fontSize:7.5 },
    columnStyles:{0:{cellWidth:9,halign:'center'},1:{cellWidth:10,halign:'center'},2:{cellWidth:18},3:{cellWidth:42,fontStyle:'bold'},4:{cellWidth:20,fontStyle:'bold'},5:{cellWidth:16,halign:'center'},6:{cellWidth:20},7:{cellWidth:72},8:{cellWidth:26}},
    margin:{left:ml},
  });

  footer();
  doc.save(`Materialliste_${pn.replace(/[^a-zA-Z0-9_]/g,'_')}_${datum.replace(/\./g,'-')}.pdf`);
  closeMaterialExportModal();
}

// Excel-Export der Materialliste aller Neubau/Prov-Positionen des Projekts
function exportMaterialbestellungXlsx() {
  if (!window.XLSX) { ui.toast('SheetJS nicht geladen.', 'fehler'); return; }
  const allBp  = loadAllBauprojekt();
  const ftProf = loadFtProfile();
  const pn     = getActiveProjectName() || 'Projekt';
  const date   = new Date().toLocaleDateString('de-CH');

  // Alle Neubau/Prov-Positionen sammeln
  const positionen = PAIRS.map(p => {
    const bp = allBp[p.id] || {};
    if (bp.bestand !== 'neu' && bp.bestand !== 'prov') return null;
    const ft = bp.fundtyp ? ftProf.find(t => t.name === bp.fundtyp) : null;
    return { pair: p, bp, ft };
  }).filter(Boolean);

  if (!positionen.length) { ui.toast('Keine Neubau- oder Provisorium-Positionen vorhanden.', 'fehler'); return; }

  // ── Sheet 1: Detailliste je Standort ──
  const detailRows = [
    [`Materialliste · ${pn} · ${date}`],
    [],
    ['Mast', 'KM', 'Massnahme', 'Fundamenttyp', 'Nutzungsart', 'Zeichnungs-Nr.', 'VFK-Zeichnungs-Nr.', 'Schrauben Art.-Nr.', 'Beton (m³)', 'Bewehrung'],
  ];
  positionen.forEach(({ pair: p, bp, ft }) => {
    const km  = p.km_rs ? parseFloat(p.km_rs).toFixed(3) : (p.km_rks ? parseFloat(p.km_rks).toFixed(3) : '');
    const vfk = !!(bp.vfk) && !!(ft?.vfkZeichnungsNr);
    const vol = ft ? _ftBetonVolumen(ft, vfk) : null;
    const nutz = bp.nutzungsart ? (MAST_DATEN[bp.nutzungsart]?.label || bp.nutzungsart) : '—';
    detailRows.push([
      'Mast ' + (p.mast || p.id),
      km,
      bp.bestand === 'prov' ? 'Provisorium' : 'Neubau',
      ft?.name || '—',
      nutz,
      ft?.zeichnungsNr || '—',
      vfk ? (ft?.vfkZeichnungsNr || '—') : '—',
      ft?.schraubenArtikelNr || '—',
      vol != null ? +vol.toFixed(3) : '—',
      ft?.bewehrung || '—',
    ]);
  });

  // ── Sheet 2: Aggregierte Bestellliste nach Artikel-Nr. ──
  const agg = {};
  positionen.forEach(({ bp, ft }) => {
    if (!ft) return;
    const items = _ftMaterialItems(ft, bp.bestand, !!(bp.vfk) && !!(ft.vfkZeichnungsNr));
    items.forEach(it => {
      const key = it.artNr + '|' + it.bez + '|' + it.einh;
      if (!agg[key]) agg[key] = { artNr: it.artNr, bez: it.bez, einh: it.einh, menge: 0, isTxt: typeof it.menge !== 'number' };
      if (!agg[key].isTxt) agg[key].menge += (typeof it.menge === 'number' ? it.menge : 0);
    });
  });

  const bestellRows = [
    [`Bestellliste · ${pn} · ${date}`],
    [`${positionen.length} Positionen (Neubau/Provisorium)`],
    [],
    ['Pos.', 'Art.-Nr.', 'Bezeichnung', 'Menge', 'Einheit'],
  ];
  Object.values(agg).forEach((it, i) => {
    bestellRows.push([
      i + 1,
      it.artNr,
      it.bez,
      it.isTxt ? 'gem. Plan' : +it.menge.toFixed(it.einh === 'm³' ? 2 : 0),
      it.einh,
    ]);
  });

  const wsDetail  = window.XLSX.utils.aoa_to_sheet(detailRows);
  const wsBestehl = window.XLSX.utils.aoa_to_sheet(bestellRows);

  // Spaltenbreiten
  wsDetail['!cols']  = [{ wch:14 },{ wch:9 },{ wch:14 },{ wch:18 },{ wch:18 },{ wch:18 },{ wch:18 },{ wch:10 },{ wch:10 },{ wch:28 }];
  wsBestehl['!cols'] = [{ wch:5 },{ wch:16 },{ wch:42 },{ wch:10 },{ wch:8 }];

  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, wsBestehl, 'Bestellliste');
  window.XLSX.utils.book_append_sheet(wb, wsDetail,  'Positionen');
  window.XLSX.writeFile(wb, `Materialliste_${pn.replace(/\s+/g,'_')}_${date.replace(/\./g,'-')}.xlsx`);
}

function updateAbnahmeSummary(pairId) {
  const el = document.getElementById('abnahme-summary');
  const dot = document.getElementById('abnahme-status-dot');
  if (!el) return;
  const ck = loadAllChecklisten()[pairId];
  if (!ck) {
    el.textContent = 'Noch nicht ausgefüllt.';
    if (dot) dot.innerHTML = '';
    return;
  }
  const total = CK_PRUEFPUNKTE.length;
  const ok    = CK_PRUEFPUNKTE.filter(p => ck[`ck_${p.id}_ok`] === 'ok').length;
  const maengel = CK_PRUEFPUNKTE.filter(p => ck[`ck_${p.id}_ok`] === 'mangel').length;
  const color = maengel > 0 ? '#dc2626' : ok === total ? '#16a34a' : '#f59e0b';
  el.innerHTML = `<span style="color:${color};font-weight:700;">${ok}/${total} OK</span>${maengel > 0 ? ` · <span style="color:#dc2626;">${maengel} Mängel</span>` : ''}`;
  if (dot) dot.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};"></span>`;
}

// ============================================================
// ABNAHME-CHECKLISTE
// ============================================================
const CK_PRUEFPUNKTE = [
  // Fundamentschrauben
  { id:1,  kuerzel:'ø',   gruppe:'schrauben', typ:'mess',     einheit:'mm',  beschreibung:'Durchmesser Fundamentschrauben' },
  { id:2,  kuerzel:'HA',  gruppe:'schrauben', typ:'mess',     einheit:'mm',  beschreibung:'Horiz. Abstände der Fundamentschrauben zueinander (Tol. ±2 mm)' },
  { id:3,  kuerzel:'LF',  gruppe:'schrauben', typ:'mess',     einheit:'mm',  beschreibung:'Länge Fundamentschrauben überstehend über Fundamentkopf (Tol. ±5 mm)' },
  { id:4,  kuerzel:'GF',  gruppe:'schrauben', typ:'kontrolle',einheit:'',   beschreibung:'Gewinde Fundamentschrauben (gereinigt, unbeschädigt)' },
  { id:5,  kuerzel:'MU',  gruppe:'schrauben', typ:'kontrolle',einheit:'',   beschreibung:'Je 2 Muttern / Unterlegscheibe pro Fundamentschraube vorhanden' },
  // Beton
  { id:6,  kuerzel:'BO',  gruppe:'beton',     typ:'kontrolle',einheit:'',   beschreibung:'Betonoberfläche i.O. (Fugen, Kiesnester, Lunkern, Kanten)' },
  { id:7,  kuerzel:'AZ',  gruppe:'beton',     typ:'mess',     einheit:'cm',  beschreibung:'Anzug Fundamentkopf (> 2 cm)' },
  // Lage + Ausrichtung
  { id:8,  kuerzel:'OK',  gruppe:'lage',      typ:'mess',     einheit:'cm',  beschreibung:'Höhe OK Fundamentkopf über OK Terrain (i.d.R. 60 cm, Tol. gem. Typenblatt)' },
  { id:9,  kuerzel:'km',  gruppe:'lage',      typ:'mess',     einheit:'Δ cm',beschreibung:'Lage Kilometrierung (Tol. ±5 cm)' },
  { id:10, kuerzel:'D',   gruppe:'lage',      typ:'mess',     einheit:'cm',  beschreibung:'Distanz Mass a gemäss Fundamentliste (Tol. ±5 cm)' },
  { id:11, kuerzel:'HK',  gruppe:'lage',      typ:'mess',     einheit:'cm',  beschreibung:'Höhe Fundamentkopf Mass hk gemäss Fundamentliste (Tol. ±2 cm)' },
  { id:12, kuerzel:'AK',  gruppe:'lage',      typ:'kontrolle',einheit:'',   beschreibung:'Ausrichtung Kopf auf Gleis / Mast gemäss Fundamentliste' },
  // Umgebung
  { id:13, kuerzel:'UMG', gruppe:'umgebung',  typ:'kontrolle',einheit:'',   beschreibung:'Umgebung, Soll–Ist Zustand, Ordnung + Sauberkeit' },
];

const CK_KEY = () => 'sp_checkliste__' + _activeId;
let _ckPairId       = null;
let _ckLastOrt      = '';   // Carry-over: letzter eingegebener Ort
let _ckLastAnwesend = [];   // Carry-over: letzte Personen-Liste

// ── Checkliste: Standort-Navigation ──────────────────────────────────────────
// Die frueheren zwei Textknoepfe «‹ Standort / Standort ›» konnten nur
// blaettern. Hier steht dieselbe Zeile wie auf den Karten: Pfeile, Name und
// Sprungliste mit Suche — bei 25 Positionen der einzige zumutbare Weg.
function updateCkNavButtons() {
  karteNavAufbauen('ck-nav-halter', {
    liste:  () => getFilteredSorted(),
    waehle: p => openCheckliste(p.id),
    aktiv:  () => _ckPairId,
  })?.aktualisieren();
}

// ── Checkliste: Situationskarte ───────────────────────────────────────────────
let _ckLeafletMap  = null;
let _ckTileLayer   = null;
let _ckPairMarker  = null;
let _ckGpsWatchId  = null;
let _ckGpsMarker   = null;
let _ckGpsCircle   = null;
let _ckGpsActive   = false;

function initCkMap() {
  if (_ckLeafletMap) {
    // Karte existiert — nur zum aktuellen Standort zentrieren
    _updateCkMapCenter();
    return;
  }
  const pair   = PAIRS.find(p => p.id === _ckPairId);
  const center = pair ? pairCenter(pair) : { lat: 47.37, lng: 8.55 };
  // Quellenangabe wie auf den uebrigen Karten — swisstopo und, sobald die
  // Bahnebene dazukommt, data.sbb.ch (Nutzungsbedingungen Ziffer 4.1).
  _ckLeafletMap = L.map('ck-karte', { zoomControl: true }).setView([center.lat, center.lng], 19);
  _ckTileLayer  = makeTile(detailBaseLayerKey || 'swiss-luft').addTo(_ckLeafletMap);
  // Kilometrierung ist gerade auf der Abnahmekarte die nuetzlichste Ebene
  if (typeof bahnStandardAnwenden === 'function') setTimeout(() => bahnStandardAnwenden('abnahme'), 60);
  _updateCkMapCenter();
}

// Nachbarmarker-Array (werden bei jedem Wechsel entfernt/neu gesetzt)
let _ckNeighbourMarkers = [];

function _updateCkMapCenter() {
  const pair = PAIRS.find(p => p.id === _ckPairId);
  if (!pair || !_ckLeafletMap) return;
  const c = pairCenter(pair);
  _ckLeafletMap.setView([c.lat, c.lng], 19);

  // Hauptmarker entfernen
  if (_ckPairMarker) { _ckPairMarker.remove(); _ckPairMarker = null; }
  // Nachbarmarker entfernen
  _ckNeighbourMarkers.forEach(m => m.remove());
  _ckNeighbourMarkers = [];

  // Aktueller Standort — Marker mit Mastnummer/Bezeichnung
  const mainLabel = pair.mast ? String(pair.mast) : (pair.bezeichnung || String(pair.id));
  const mainIcon = L.divIcon({
    html: `<div style="background:#1a3a5c;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);">${mainLabel}</div>`,
    iconSize: [28,28], iconAnchor: [14,14], className: ''
  });
  _ckPairMarker = L.marker([c.lat, c.lng], { icon: mainIcon, zIndexOffset: 100 }).addTo(_ckLeafletMap);

  // Nachbar-Standorte aus der aktuellen Phase (±3 in der sortierten Liste)
  const allPhase = getFilteredSorted();
  const idx = allPhase.findIndex(p => p.id === _ckPairId);
  const nbStart = Math.max(0, idx - 3);
  const nbEnd   = Math.min(allPhase.length - 1, idx + 3);
  for (let i = nbStart; i <= nbEnd; i++) {
    if (i === idx) continue; // Aktueller schon gesetzt
    const nb = allPhase[i];
    if (!nb.rs?.e && !nb.rks?.e) continue;
    const nbC = pairCenter(nb);
    const nbLabel = nb.mast ? String(nb.mast) : (nb.bezeichnung || String(nb.id));
    const nbIcon = L.divIcon({
      html: `<div style="background:#9ca3af;color:white;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.25);">${nbLabel}</div>`,
      iconSize: [22,22], iconAnchor: [11,11], className: ''
    });
    const m = L.marker([nbC.lat, nbC.lng], { icon: nbIcon, zIndexOffset: 0 }).addTo(_ckLeafletMap);
    _ckNeighbourMarkers.push(m);
  }
}

function destroyCkMap() {
  if (_ckGpsWatchId !== null) { navigator.geolocation.clearWatch(_ckGpsWatchId); _ckGpsWatchId = null; }
  _ckGpsActive = false;
  const gpsBtn = document.getElementById('ck-gps-btn');
  if (gpsBtn) { gpsBtn.style.opacity = '0.5'; gpsBtn.style.background = 'white'; }
  if (_ckGpsMarker)  { _ckGpsMarker.remove();  _ckGpsMarker  = null; }
  if (_ckGpsCircle)  { _ckGpsCircle.remove();  _ckGpsCircle  = null; }
  if (_ckPairMarker) { _ckPairMarker.remove(); _ckPairMarker = null; }
  _ckNeighbourMarkers.forEach(m => m.remove()); _ckNeighbourMarkers = [];
  if (_ckLeafletMap) { _ckLeafletMap.remove(); _ckLeafletMap = null; }
  if (typeof bahnKarteVergessen === 'function') bahnKarteVergessen('abnahme');
  _ckTileLayer = null;
}

function toggleCkKarte() {
  const wrap = document.getElementById('ck-karte-wrap');
  const btn  = document.getElementById('ck-karte-btn');
  if (!wrap) return;
  const visible = wrap.style.display !== 'none';
  if (visible) {
    wrap.style.display = 'none';
    if (btn) btn.style.background = 'rgba(255,255,255,0.12)';
    destroyCkMap();
  } else {
    wrap.style.display = 'block';
    if (btn) btn.style.background = 'rgba(255,255,255,0.28)';
    setTimeout(initCkMap, 50); // nach DOM-Paint initialisieren
  }
}

function toggleCkGps() {
  if (!_ckLeafletMap) return;
  const btn = document.getElementById('ck-gps-btn');
  if (_ckGpsActive) {
    // GPS deaktivieren
    if (_ckGpsWatchId !== null) { navigator.geolocation.clearWatch(_ckGpsWatchId); _ckGpsWatchId = null; }
    if (_ckGpsMarker) { _ckGpsMarker.remove(); _ckGpsMarker = null; }
    if (_ckGpsCircle) { _ckGpsCircle.remove(); _ckGpsCircle = null; }
    _ckGpsActive = false;
    if (btn) { btn.style.opacity = '0.5'; btn.style.background = 'white'; }
  } else {
    // GPS aktivieren
    if (!navigator.geolocation) { ui.toast('Geolocation nicht verfügbar.', 'fehler'); return; }
    if (btn) { btn.style.opacity = '1'; btn.style.background = '#e0f2fe'; }
    _ckGpsActive = true;
    _ckGpsWatchId = navigator.geolocation.watchPosition(pos => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      if (_ckGpsMarker) { _ckGpsMarker.setLatLng([lat, lng]); _ckGpsCircle.setLatLng([lat, lng]).setRadius(accuracy); }
      else {
        _ckGpsMarker = L.circleMarker([lat, lng], { radius: 7, color: '#0284c7', fillColor: '#38bdf8', fillOpacity: 0.85, weight: 2 }).addTo(_ckLeafletMap);
        _ckGpsCircle = L.circle([lat, lng], { radius: accuracy, color: '#0284c7', fillColor: '#bae6fd', fillOpacity: 0.2, weight: 1 }).addTo(_ckLeafletMap);
      }
    }, () => { _ckGpsActive = false; if (btn) { btn.style.opacity = '0.5'; btn.style.background = 'white'; } },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
  }
}

function loadAllChecklisten() {
  try { return jsonParse(store.getItem(CK_KEY())) || {}; } catch { return {}; }
}
function saveAllChecklisten(all) { store.setItem(CK_KEY(), JSON.stringify(all)); }

// ── Anwesend — Tag-basierte Mehrfachauswahl ───────────────────────────────────
let _ckPersons = [];

function renderCkPersonTags() {
  const wrap = document.getElementById('ck-anwesend-tags');
  if (!wrap) return;
  wrap.innerHTML = _ckPersons.map((name, i) =>
    `<span style="display:inline-flex;align-items:center;gap:4px;background:#1a3a5c;color:white;border-radius:5px;padding:2px 8px 2px 8px;font-size:11px;font-weight:600;white-space:nowrap;">
      ${name.replace(/</g,'&lt;')}
      <button type="button" onclick="removeCkPerson(${i})"
        style="display:flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;border:none;background:rgba(255,255,255,0.25);color:white;font-size:10px;cursor:pointer;padding:0;line-height:1;flex-shrink:0;">×</button>
    </span>`
  ).join('');
}

function addCkPerson(name) {
  name = name.trim();
  if (!name || _ckPersons.includes(name)) return;
  _ckPersons.push(name);
  renderCkPersonTags();
  saveCheckliste();
}

function removeCkPerson(idx) {
  _ckPersons.splice(idx, 1);
  renderCkPersonTags();
  saveCheckliste();
}

function ckAnwesentKeydown(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim().replace(/,$/, '');
    if (val) { addCkPerson(val); e.target.value = ''; }
  } else if (e.key === 'Backspace' && !e.target.value && _ckPersons.length) {
    removeCkPerson(_ckPersons.length - 1);
  }
}

function ckAnwesentInput(el) {
  // Auswahl aus Datalist direkt als Tag übernehmen (Option-Click)
  const dl = document.getElementById('ck-anwesend-list');
  if (!dl) return;
  const opts = [...dl.options].map(o => o.value);
  if (opts.includes(el.value)) {
    addCkPerson(el.value);
    el.value = '';
  }
}

// ── GPS-Ortsname für Checkliste ───────────────────────────────────────────────
function ckFetchOrt() {
  const btn = document.getElementById('ck-ort-btn');
  if (btn) btn.style.color = '#1a3a5c';
  if (!navigator.geolocation) { ui.toast('Geolocation nicht verfügbar.', 'fehler'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lng } = pos.coords;
    // Reverse Geocode via Nominatim
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=de`)
      .then(r => r.json())
      .then(d => {
        const a = d.address || {};
        // Ort: Gemeinde / Stadt, dann Kanton
        const ort = a.municipality || a.city || a.town || a.village || a.suburb || '';
        const el  = document.getElementById('ck-ort');
        if (el) { el.value = ort || `${lat.toFixed(4)}, ${lng.toFixed(4)}`; saveCheckliste(); }
        if (btn) btn.style.color = '#16a34a';
        setTimeout(() => { if (btn) btn.style.color = '#6b7280'; }, 2000);
      })
      .catch(() => {
        const el = document.getElementById('ck-ort');
        if (el) { el.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`; saveCheckliste(); }
        if (btn) btn.style.color = '#6b7280';
      });
  }, () => {
    if (btn) btn.style.color = '#ef4444';
    setTimeout(() => { if (btn) btn.style.color = '#6b7280'; }, 2000);
    ui.toast('GPS-Standort konnte nicht ermittelt werden.', 'fehler');
  }, { enableHighAccuracy: true, timeout: 10000 });
}

// Datalist-Befüllung für Anwesend (aus Kontakten + UserProfile)
function _fillCkDatalistAnwesend() {
  const dl = document.getElementById('ck-anwesend-list');
  if (!dl) return;
  const opts = new Set();
  const prof = loadUserProfile();
  if (prof.name) opts.add(prof.name);
  loadContacts().forEach(c => { if (c.name) opts.add(c.name); });
  dl.innerHTML = [...opts].map(n => `<option value="${n.replace(/"/g,'&quot;')}">`).join('');
}

// Datalist-Befüllung für Datum (aus Startdaten der Standorte + tagDates)
function _fillCkDatalistDatum(pairId) {
  const dl = document.getElementById('ck-datum-list');
  if (!dl) return;
  const opts = new Set();
  const pd = getPairData(pairId);
  if (pd.startdatum) opts.add(pd.startdatum);
  try {
    const tagDates = jsonParse(store.getItem(TAGDATES_KEY)) || {};
    for (let i = 1; i <= 12; i++) { const d = tagDates['T' + i]; if (d) opts.add(d); }
  } catch {}
  getFilteredSorted().forEach(p => { const d = getPairData(p.id).startdatum; if (d) opts.add(d); });
  dl.innerHTML = [...opts].sort().map(d => `<option value="${d}">`).join('');
}

// Abnahme-Termin Dropdown für Checkliste befüllen und Daten übernehmen
function renderCkAbnahmeTerminSelect() {
  const sel = document.getElementById('ck-abnahme-termin');
  if (!sel || !_ckPairId) return;
  // Nur Abnahme-Ereignisse die diesen Standort enthalten
  const ereignisse = loadEreignisse().filter(e =>
    e.typ === 'abnahme' &&
    (e.pairIds?.includes(_ckPairId) || e.pairIds?.length === 0)
  );
  const wrap = document.getElementById('ck-termin-wrap');
  if (wrap) wrap.style.display = ereignisse.length ? '' : 'none';
  if (!ereignisse.length) return;
  const fmt = d => { if (!d) return ''; const [y,m,dd]=d.split('-'); return `${dd}.${m}.${y}`; };
  const ck = loadAllChecklisten()[_ckPairId] || {};
  // Selektierten Termin ermitteln: gespeicherte termineId, oder Datum-Match
  const savedId = ck.abnahmeTerminId || '';
  sel.innerHTML = '<option value="">— kein Termin verknüpft —</option>' +
    ereignisse.map(e => {
      const label = [e.titel, fmt(e.datum), e.ort].filter(Boolean).join(' · ');
      return `<option value="${e.id}" ${e.id === savedId ? 'selected' : ''}>${label}</option>`;
    }).join('');
}

function ckApplyAbnahmeTermin(eid) {
  const sel = document.getElementById('ck-abnahme-termin');
  // Termin-ID in Checkliste speichern
  const all = loadAllChecklisten();
  const ck  = all[_ckPairId] || {};
  ck.abnahmeTerminId = eid || '';
  all[_ckPairId] = ck;
  saveAllChecklisten(all);
  if (!eid) return;
  const e = loadEreignisse().find(x => x.id === eid);
  if (!e) return;
  // Datum übernehmen
  if (e.datum) {
    const el = document.getElementById('ck-datum');
    if (el) { el.value = e.datum; }
  }
  // Ort übernehmen
  if (e.ort) {
    const el = document.getElementById('ck-ort');
    if (el) { el.value = e.ort; }
  }
  // Beteiligte übernehmen
  if (Array.isArray(e.beteiligte) && e.beteiligte.length) {
    _ckPersons = [...e.beteiligte];
    renderCkPersonTags();
  }
  saveCheckliste();
}

function openCheckliste(pairId) {
  _ckPairId = pairId;
  const view = document.getElementById('checkliste-view');
  if (!view) return;
  view.style.display = 'block';

  // Kopfdaten setzen
  const pair = PAIRS.find(p => p.id === pairId) || {};
  const sub = document.getElementById('ck-header-sub');
  if (sub) sub.textContent = `Mast ${pair.mast || '—'} · KM ${pair.km_rs ? parseFloat(pair.km_rs).toFixed(3) : '—'}`;

  // Prüfpunkte rendern
  renderCkGruppe('schrauben', 'ck-group-schrauben');
  renderCkGruppe('beton',     'ck-group-beton');
  renderCkGruppe('lage',      'ck-group-lage');
  renderCkGruppe('umgebung',  'ck-group-umgebung');

  // Kopfdaten und Visum laden
  const all = loadAllChecklisten();
  const ck = all[pairId] || {};
  const v = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  const _prof = loadUserProfile();
  v('ck-objekt',    ck.objekt    || (pair.bezeichnung || `Mast ${pair.mast || ''}`));
  v('ck-projektnr', ck.projektnr || _prof.projektnummer || '');
  // Datum: today als Standard falls noch nicht gesetzt
  const _pd = getPairData(pairId);
  const todayIso = new Date().toISOString().slice(0,10);
  v('ck-datum',     ck.datum || _pd.startdatum || todayIso);
  v('ck-ort',       ck.ort   || _ckLastOrt);
  // Anwesend als Tags laden (Carry-over: letzter Standort → nächster)
  const savedPersons = ck.anwesend ? ck.anwesend.split(',').map(s => s.trim()).filter(Boolean) : [];
  _ckPersons = savedPersons.length   ? savedPersons
    : _ckLastAnwesend.length         ? [..._ckLastAnwesend]
    : (_prof.name                    ? [_prof.name] : []);
  renderCkPersonTags();
  // Populate datalists
  _fillCkDatalistAnwesend();
  _fillCkDatalistDatum(pairId);
  v('ck-visum-bl',        ck.visumBl);
  v('ck-visum-af',        ck.visumAf);
  v('ck-schlussbemerkung',ck.schlussbemerkung);

  // Felder befüllen
  CK_PRUEFPUNKTE.forEach(p => {
    const messwert = document.getElementById(`ck_${p.id}_wert`);
    const mangel   = document.getElementById(`ck_${p.id}_mangel`);
    if (messwert) messwert.value = ck[`ck_${p.id}_wert`] || '';
    if (mangel)   mangel.value   = ck[`ck_${p.id}_mangel`] || '';
    const status = ck[`ck_${p.id}_ok`] || '';
    // Status in data-Attribut setzen für zuverlässiges Lesen
    const row = document.getElementById(`ck-row-${p.id}`);
    if (row) row.dataset.status = status;
    setCkBtnStyle(p.id, status);
  });

  updateCkGesamtstatus();
  renderCkFotos();
  updateCkNavButtons();
  renderCkAbnahmeTerminSelect();
  // Karte aktualisieren falls bereits geöffnet
  if (_ckLeafletMap) setTimeout(_updateCkMapCenter, 50);
}

function renderCkGruppe(gruppe, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const punkte = CK_PRUEFPUNKTE.filter(p => p.gruppe === gruppe);
  container.innerHTML = punkte.map(p => `
    <div style="border:1px solid #e5e7eb;border-radius:7px;padding:10px 12px;margin-bottom:8px;background:white;" id="ck-row-${p.id}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px;">
        <div style="flex:1;">
          <span style="font-size:10px;font-weight:700;color:#9ca3af;background:#f3f4f6;padding:1px 6px;border-radius:4px;margin-right:5px;">${p.kuerzel}</span>
          <span style="font-size:12px;color:#374151;">${p.beschreibung}</span>
        </div>
        <span style="font-size:10px;color:#9ca3af;white-space:nowrap;flex-shrink:0;">${p.typ === 'mess' ? 'Messen' : 'Kontrolle'}</span>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        ${p.typ === 'mess' ? `
        <div style="display:flex;align-items:center;gap:4px;">
          <input id="ck_${p.id}_wert" type="number" step="0.1" onchange="saveCheckliste()" placeholder="Messwert"
            style="width:90px;padding:5px 7px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;font-family:inherit;">
          <span style="font-size:11px;color:#6b7280;">${p.einheit}</span>
        </div>` : ''}
        <div style="display:flex;gap:4px;margin-left:auto;">
          <button id="ck_${p.id}_btn_ok" onclick="setCkStatus(${p.id},'ok')"
            style="padding:4px 10px;border-radius:5px;border:1px solid #e5e7eb;background:white;font-size:11px;font-weight:600;cursor:pointer;color:#6b7280;">OK</button>
          <button id="ck_${p.id}_btn_mangel" onclick="setCkStatus(${p.id},'mangel')"
            style="padding:4px 10px;border-radius:5px;border:1px solid #e5e7eb;background:white;font-size:11px;font-weight:600;cursor:pointer;color:#6b7280;">Mangel</button>
          <button id="ck_${p.id}_btn_na" onclick="setCkStatus(${p.id},'na')"
            style="padding:4px 10px;border-radius:5px;border:1px solid #e5e7eb;background:white;font-size:11px;font-weight:600;cursor:pointer;color:#6b7280;">N/A</button>
        </div>
      </div>
      <div style="margin-top:6px;">
        <input id="ck_${p.id}_mangel" type="text" onchange="saveCheckliste()" placeholder="Mängel / Pendenz (optional)"
          style="width:100%;padding:5px 7px;border:1px solid #e5e7eb;border-radius:6px;font-size:11px;font-family:inherit;color:#374151;">
      </div>
    </div>`).join('');
}

function setCkStatus(id, status) {
  // Speichere Status als data-Attribut für zuverlässiges Lesen
  const container = document.getElementById(`ck-row-${id}`);
  if (container) container.dataset.status = status;
  setCkBtnStyle(id, status);
  saveCheckliste();
  updateCkGesamtstatus();
}

function getCkStatus(id) {
  const container = document.getElementById(`ck-row-${id}`);
  return container ? (container.dataset.status || '') : '';
}

function setCkBtnStyle(id, status) {
  const styles = {
    ok:     { ok: 'background:#dcfce7;color:#166534;border-color:#86efac;', mangel: 'background:white;color:#6b7280;border-color:#e5e7eb;', na: 'background:white;color:#6b7280;border-color:#e5e7eb;' },
    mangel: { ok: 'background:white;color:#6b7280;border-color:#e5e7eb;',  mangel: 'background:#fee2e2;color:#b91c1c;border-color:#fca5a5;', na: 'background:white;color:#6b7280;border-color:#e5e7eb;' },
    na:     { ok: 'background:white;color:#6b7280;border-color:#e5e7eb;',  mangel: 'background:white;color:#6b7280;border-color:#e5e7eb;',   na: 'background:#f3f4f6;color:#374151;border-color:#d1d5db;' },
    '':     { ok: 'background:white;color:#6b7280;border-color:#e5e7eb;',  mangel: 'background:white;color:#6b7280;border-color:#e5e7eb;',   na: 'background:white;color:#6b7280;border-color:#e5e7eb;' },
  };
  const s = styles[status] || styles[''];
  ['ok','mangel','na'].forEach(k => {
    const btn = document.getElementById(`ck_${id}_btn_${k}`);
    if (btn) btn.style.cssText = `padding:4px 10px;border-radius:5px;border:1px solid;font-size:11px;font-weight:600;cursor:pointer;${s[k]}`;
  });
  // Zeilenhintergrund
  const row = document.getElementById(`ck-row-${id}`);
  if (row) row.style.background = status === 'mangel' ? '#fff5f5' : status === 'ok' ? '#f0fdf4' : 'white';
}

function saveCheckliste() {
  if (!_ckPairId) return;
  const v = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const all = loadAllChecklisten();
  const ck = all[_ckPairId] || {};

  ck.objekt            = v('ck-objekt');
  ck.projektnr         = v('ck-projektnr');
  ck.anwesend          = _ckPersons.join(', ');   // Tag-Array → kommagetrennt
  ck.ort               = v('ck-ort');
  ck.datum             = v('ck-datum');
  ck.visumBl           = v('ck-visum-bl');
  ck.visumAf           = v('ck-visum-af');
  ck.schlussbemerkung  = v('ck-schlussbemerkung');

  CK_PRUEFPUNKTE.forEach(p => {
    const messwert = document.getElementById(`ck_${p.id}_wert`);
    const mangel   = document.getElementById(`ck_${p.id}_mangel`);
    if (messwert) ck[`ck_${p.id}_wert`]   = messwert.value;
    if (mangel)   ck[`ck_${p.id}_mangel`] = mangel.value;
    const status = getCkStatus(p.id);
    if (status) ck[`ck_${p.id}_ok`] = status;
  });

  all[_ckPairId] = ck;
  saveAllChecklisten(all);
  updateCkGesamtstatus();
  // Carry-over: letzte Eingaben für den nächsten Standort merken
  const ortVal = document.getElementById('ck-ort')?.value?.trim() || '';
  if (ortVal)            _ckLastOrt      = ortVal;
  if (_ckPersons.length) _ckLastAnwesend = [..._ckPersons];
}

function updateCkGesamtstatus() {
  const el = document.getElementById('ck-gesamtstatus');
  if (!el) return;
  const all = loadAllChecklisten();
  const ck  = _ckPairId ? (all[_ckPairId] || {}) : {};
  const total   = CK_PRUEFPUNKTE.length;
  const ok      = CK_PRUEFPUNKTE.filter(p => ck[`ck_${p.id}_ok`] === 'ok' || ck[`ck_${p.id}_ok`] === 'na').length;
  const maengel = CK_PRUEFPUNKTE.filter(p => ck[`ck_${p.id}_ok`] === 'mangel').length;
  if (maengel > 0) {
    el.style.background = '#fee2e2'; el.style.color = '#b91c1c';
    el.textContent = `${maengel} Mängel — Abnahme nicht bestanden`;
  } else if (ok === total) {
    el.style.background = '#dcfce7'; el.style.color = '#166534';
    el.textContent = 'Alle Punkte OK — Abnahme bestanden';
  } else if (ok > 0) {
    el.style.background = '#fef3c7'; el.style.color = '#92400e';
    el.textContent = `${ok} / ${total} Punkte beurteilt`;
  } else {
    el.style.background = '#f3f4f6'; el.style.color = '#6b7280';
    el.textContent = 'Noch nicht beurteilt';
  }
}

function closeCheckliste() {
  document.getElementById('checkliste-view').style.display = 'none';
  const karteWrap = document.getElementById('ck-karte-wrap');
  if (karteWrap) karteWrap.style.display = 'none';
  const karteBtn = document.getElementById('ck-karte-btn');
  if (karteBtn) karteBtn.style.background = 'rgba(255,255,255,0.12)';
  destroyCkMap();
  // Abnahme-Summary in Sidebar aktualisieren
  if (_ckPairId && _activePhase === 'ausfuehrung') updateAbnahmeSummary(_ckPairId);
  _ckPairId = null;
}

// ── PDF-Scope-Dialog ──────────────────────────────────────────────────────────
let _ckPdfScopeForPairId = null;

function openChecklistePdfDialog(pairId) {
  _ckPdfScopeForPairId = pairId || _ckPairId;
  const pairs   = getFilteredSorted();
  const allCk   = loadAllChecklisten();
  const pair    = PAIRS.find(p => p.id === _ckPdfScopeForPairId);
  const lbl     = pair ? (pair.bezeichnung || (pair.mast ? 'Mast ' + pair.mast : 'ID ' + pair.id)) : 'Dieser Standort';
  const filledN = pairs.filter(p => allCk[p.id] && Object.keys(allCk[p.id]).length > 0).length;
  const singleLbl = document.getElementById('ck-pdf-scope-single-label');
  if (singleLbl) singleLbl.textContent = lbl;
  const allLbl = document.getElementById('ck-pdf-scope-all-label');
  if (allLbl) allLbl.textContent = `${pairs.length} Standorte der aktuellen Phase`;
  const filledLbl = document.getElementById('ck-pdf-scope-filled-label');
  if (filledLbl) filledLbl.textContent = `${filledN} Standorte mit vorhandenen Einträgen`;
  const radio = document.querySelector('input[name="ck-pdf-scope"][value="single"]');
  if (radio) radio.checked = true;
  document.getElementById('ck-pdf-scope-modal').style.display = 'flex';
}

function closeCkPdfScopeModal() {
  document.getElementById('ck-pdf-scope-modal').style.display = 'none';
}

function confirmCkPdfExport() {
  const scope = document.querySelector('input[name="ck-pdf-scope"]:checked')?.value || 'single';
  closeCkPdfScopeModal();
  if (scope === 'single') {
    if (_ckPdfScopeForPairId) _ckPairId = _ckPdfScopeForPairId;
    exportChecklistePdf();
  } else {
    const pairs = getFilteredSorted();
    const allCk = loadAllChecklisten();
    const targets = scope === 'filled'
      ? pairs.filter(p => allCk[p.id] && Object.keys(allCk[p.id]).length > 0)
      : pairs;
    exportCkMultiPdf(targets);
  }
}

async function exportCkMultiPdf(pairs) {
  if (!pairs.length) { ui.toast('Keine Standorte für den Export.', 'fehler'); return; }
  const jsPDFLib = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFLib) { ui.toast('jsPDF nicht geladen.', 'fehler'); return; }
  // Foto-Daten vorab laden — die Seitenschleife läuft danach synchron
  await fotosFuerPdfLaden(pairs.flatMap(p =>
    (getPairData(p.id)?.fotos || []).filter(f => f.kategorie === 'abnahme')));
  const doc   = new jsPDFLib({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const allCk = loadAllChecklisten();
  const pn    = getActiveProjectName() || 'Projekt';
  const W = 210, M = 14;
  const tocEntries = [];

  // Seite 1 für TOC reservieren; Standorte ab Seite 2
  doc.addPage();

  pairs.forEach((pair, pairIdx) => {
    if (pairIdx > 0) doc.addPage();
    const startPage = doc.internal.getCurrentPageInfo().pageNumber;
    const lbl = pair.bezeichnung || (pair.mast ? 'Mast ' + pair.mast : 'ID ' + pair.id);
    tocEntries.push({ label: lbl, pairId: pair.id, page: startPage });
    const ck    = allCk[pair.id] || {};
    const fotos = (getPairData(pair.id)?.fotos || []).filter(f => f.kategorie === 'abnahme');
    _ckPdfPage(doc, ck, pair, pn, fotos);
  });

  // Inhaltsverzeichnis auf Seite 1
  doc.setPage(1);
  doc.setFillColor(26,58,92); doc.rect(0, 0, W, 2.5, 'F');
  let ty = 12;
  doc.setFontSize(13); doc.setFont(undefined,'bold'); doc.setTextColor(26,58,92);
  doc.text('Abnahme-Checklisten', M, ty);
  doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.setTextColor(107,114,128);
  doc.text(pn, W-M, ty, { align:'right' });
  doc.text(new Date().toLocaleDateString('de-CH'), W-M, ty+5, { align:'right' });
  ty += 12;
  doc.setDrawColor(220,225,230); doc.setLineWidth(0.3); doc.line(M, ty, W-M, ty); ty += 8;
  doc.setFontSize(9); doc.setFont(undefined,'normal');
  tocEntries.forEach(entry => {
    if (ty > 270) return;
    const ck    = allCk[entry.pairId] || {};
    const total = CK_PRUEFPUNKTE.length;
    const ok    = CK_PRUEFPUNKTE.filter(p => ck[`ck_${p.id}_ok`]==='ok'||ck[`ck_${p.id}_ok`]==='na').length;
    const mn    = CK_PRUEFPUNKTE.filter(p => ck[`ck_${p.id}_ok`]==='mangel').length;
    const noData = !CK_PRUEFPUNKTE.some(p => ck[`ck_${p.id}_ok`]);
    const stTxt = noData ? 'Ausstehend' : mn > 0 ? `${mn} Mängel` : ok===total ? 'Bestanden' : `${ok}/${total}`;
    const stCol = noData ? [160,165,170] : mn > 0 ? [180,40,40] : ok===total ? [50,120,70] : [90,100,110];
    doc.setTextColor(30,30,30); doc.setFont(undefined,'normal');
    doc.text(entry.label, M, ty);
    doc.setFont(undefined,'bold'); doc.setTextColor(...stCol);
    doc.text(stTxt, W-M-14, ty, { align:'right' });
    doc.setFont(undefined,'normal'); doc.setTextColor(130,140,150);
    doc.text(String(entry.page), W-M, ty, { align:'right' });
    doc.setDrawColor(220,225,230); doc.setLineWidth(0.2);
    doc.line(M, ty+1.5, W-M, ty+1.5);
    ty += 7;
  });

  doc.save(`Abnahme_${pn.replace(/[^a-zA-Z0-9]/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`);
}

function _ckPdfPage(doc, ck, pair, pn, fotos) {
  const W = 210, M = 14;
  let y = 0;

  // Kopfzeile: dünne blaue Linie + Titel
  doc.setFillColor(26,58,92); doc.rect(0, 0, W, 2.5, 'F');
  y = 11;
  doc.setFontSize(13); doc.setFont(undefined,'bold'); doc.setTextColor(26,58,92);
  doc.text('Abnahme FL-Fundamente', M, y);
  doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.setTextColor(107,114,128);
  const sub = [pair.mast ? 'Mast ' + pair.mast : '', pair.km_rs ? 'KM ' + parseFloat(pair.km_rs).toFixed(3) : ''].filter(Boolean).join('  ·  ');
  if (sub) doc.text(sub, M, y+5);
  const date = ck.datum || new Date().toLocaleDateString('de-CH');
  doc.setFontSize(8); doc.text(date, W-M, y, { align:'right' });
  doc.text(pn, W-M, y+5, { align:'right' });

  // Kopfdaten-Tabelle
  y = 22;
  doc.setDrawColor(220,225,230); doc.setLineWidth(0.3); doc.line(M, y, W-M, y); y += 4;
  const kopf = [
    ['Objekt / Teilobjekt', ck.objekt||'—', M],
    ['Projekt-Nr.', ck.projektnr||'—', 110],
    ['Anwesend', ck.anwesend||'—', M],
    ['Ort', ck.ort||'—', 110],
  ];
  doc.setFontSize(7.5);
  kopf.forEach(([label, val, x], i) => {
    const row = Math.floor(i / 2);
    doc.setFont(undefined,'bold'); doc.setTextColor(130,140,150);
    doc.text(label, x, y + row * 9);
    doc.setFont(undefined,'normal'); doc.setTextColor(30,30,30);
    doc.text(String(val).slice(0, 55), x, y + row * 9 + 4.5);
  });
  y += 22;
  doc.setDrawColor(220,225,230); doc.line(M, y, W-M, y); y += 6;

  // Prüfpunkte
  const gruppen = [
    { name: 'Fundamentschrauben', gruppe: 'schrauben' },
    { name: 'Beton',              gruppe: 'beton' },
    { name: 'Lage + Ausrichtung', gruppe: 'lage' },
    { name: 'Umgebung, Terrain',  gruppe: 'umgebung' },
  ];
  gruppen.forEach(g => {
    if (y > 258) { doc.addPage(); y = 14; }
    doc.setFillColor(26,58,92); doc.rect(M, y-3, 2.5, 6, 'F');
    doc.setFontSize(8); doc.setFont(undefined,'bold'); doc.setTextColor(26,58,92);
    doc.text(g.name.toUpperCase(), M+5, y);
    doc.setDrawColor(220,225,230); doc.setLineWidth(0.25); doc.line(M+5, y+2, W-M, y+2);
    y += 8;

    CK_PRUEFPUNKTE.filter(p => p.gruppe === g.gruppe).forEach(p => {
      if (y > 268) { doc.addPage(); y = 14; }
      const status = ck[`ck_${p.id}_ok`] || '';
      const wert   = ck[`ck_${p.id}_wert`] || '';
      const mangel = ck[`ck_${p.id}_mangel`] || '';

      // Kürzel + Beschreibung
      doc.setFontSize(8); doc.setFont(undefined,'bold'); doc.setTextColor(55,65,81);
      doc.text(p.kuerzel, M, y);
      doc.setFont(undefined,'normal'); doc.setTextColor(70,80,90);
      const desc = doc.splitTextToSize(p.beschreibung, wert ? 106 : 130);
      doc.text(desc, M+11, y);

      // Status rechts: nur Text, kein bunter Hintergrund
      const sl = status==='ok'?'✓ OK':status==='mangel'?'✗ Mangel':status==='na'?'N/A':'—';
      const stCol = status==='ok'?[50,120,70]:status==='mangel'?[180,40,40]:[160,165,170];
      doc.setFont(undefined,'bold'); doc.setFontSize(7.5); doc.setTextColor(...stCol);
      doc.text(sl, W-M, y, { align:'right' });

      // Messwert
      if (wert) {
        doc.setFont(undefined,'normal'); doc.setFontSize(7.5); doc.setTextColor(90,100,110);
        doc.text(`${wert} ${p.einheit}`, W-M-22, y, { align:'right' });
      }

      doc.setTextColor(30,30,30);
      y += desc.length > 1 ? 5 * desc.length : 6;
      if (mangel) {
        doc.setFont(undefined,'italic'); doc.setFontSize(7); doc.setTextColor(140,80,20);
        doc.text('Mangel: ' + mangel, M+11, y); y += 5;
        doc.setFont(undefined,'normal'); doc.setTextColor(30,30,30);
      }
    });
    y += 4;
  });

  // Visum
  if (y > 252) { doc.addPage(); y = 14; }
  doc.setDrawColor(220,225,230); doc.setLineWidth(0.3); doc.line(M, y, W-M, y); y += 7;
  doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(130,140,150);
  doc.text('VISUM', M, y); y += 5;
  doc.setFont(undefined,'normal'); doc.setTextColor(30,30,30);
  doc.text('Bauleitung:', M, y);
  if (ck.visumBl) doc.text(ck.visumBl, M+22, y);
  doc.setDrawColor(190,200,210); doc.line(M+20, y+1, 98, y+1);
  doc.text('Ausführung:', 108, y);
  if (ck.visumAf) doc.text(ck.visumAf, 130, y);
  doc.line(128, y+1, W-M, y+1);
  y += 8;
  if (ck.schlussbemerkung) {
    doc.setFont(undefined,'bold'); doc.setFontSize(7.5); doc.setTextColor(130,140,150);
    doc.text('BEMERKUNGEN', M, y); y += 5;
    doc.setFont(undefined,'normal'); doc.setFontSize(8); doc.setTextColor(55,65,81);
    const lines = doc.splitTextToSize(ck.schlussbemerkung, W-2*M);
    doc.text(lines, M, y); y += lines.length * 5 + 4;
  }

  // Fotos
  if (fotos && fotos.length > 0) {
    if (y > 238) { doc.addPage(); y = 14; }
    doc.setDrawColor(220,225,230); doc.line(M, y, W-M, y); y += 6;
    doc.setFontSize(7.5); doc.setFont(undefined,'bold'); doc.setTextColor(130,140,150);
    doc.text('FOTOAUFNAHMEN', M, y); y += 7;
    const imgW = 55, imgH = 41, perRow = 3, gap = 8;
    let col = 0;
    for (const f of fotos) {
      if (col === 0 && y + imgH + 12 > 285) { doc.addPage(); y = 14; }
      const x = M + col * (imgW + gap);
      try { doc.addImage(fotoPdfSrc(f), 'JPEG', x, y, imgW, imgH); } catch(e) {}
      if (f.datum) {
        doc.setFontSize(7); doc.setFont(undefined,'normal'); doc.setTextColor(160,165,170);
        doc.text(f.datum, x + imgW / 2, y + imgH + 4, { align:'center' });
      }
      col++;
      if (col >= perRow) { col = 0; y += imgH + 10; }
    }
  }
}

async function exportChecklistePdf() {
  saveCheckliste();
  const jsPDFLib = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFLib) { ui.toast('jsPDF nicht geladen.', 'fehler'); return; }
  const doc  = new jsPDFLib({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const all  = loadAllChecklisten();
  const ck   = _ckPairId ? (all[_ckPairId] || {}) : {};
  const pair = PAIRS.find(p => p.id === _ckPairId) || {};
  const pn   = getActiveProjectName() || 'Projekt';
  const fotos = (getPairData(_ckPairId)?.fotos || []).filter(f => f.kategorie === 'abnahme');
  await fotosFuerPdfLaden(fotos);
  _ckPdfPage(doc, ck, pair, pn, fotos);
  doc.save(`Checkliste_Mast${pair.mast||'X'}_${ck.datum||'unbekannt'}.pdf`);
}

// ============================================================
