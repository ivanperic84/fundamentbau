// MASSEN & KOSTEN
// ============================================================
// Zwei Dinge in einer Ansicht, weil sie zusammengehoeren:
//
//  · MASSENAUSZUG — gerechnet aus dem Bestand. Jeder Standort traegt einen
//    Fundamenttyp, jeder Typ traegt seine Kubatur. Das ergibt Beton, Aushub,
//    Bewehrung und Fundamentschrauben ohne Handarbeit.
//
//  · LEISTUNGSVERZEICHNIS — kommt von aussen. Positionsnummern, Texte und
//    Einheitspreise stammen aus der Tabelle des Anwenders; hier werden sie
//    gehalten, gerechnet und mit dem Massenauszug verbunden. Erfunden wird
//    nichts: ohne eingelesenes Verzeichnis bleibt die Tabelle leer.
//
// Der Bezug zwischen beidem laeuft ueber das Feld «herkunft» einer Position:
// steht dort ein Schluessel aus dem Massenauszug (z.B. 'beton'), zieht die
// Position ihre Menge von dort. Sonst wird die Menge von Hand gesetzt.

const LV_POS_KEY   = () => 'sp_lv_positionen__' + _activeId;
const LV_EINST_KEY = () => 'sp_lv_einstellungen__' + _activeId;

// Groessen, die der Massenauszug kennt. Die Einheit steht hier, damit sie in
// Tabelle und Verzeichnis dieselbe ist.
const MASSEN_GROESSEN = [
  { id: 'anzahl',  label: 'Fundamente',        einheit: 'Stk' },
  { id: 'beton',   label: 'Beton',             einheit: 'm³'  },
  { id: 'aushub',  label: 'Aushub',            einheit: 'm³'  },
  { id: 'schalung',label: 'Schalung',          einheit: 'm²'  },
  { id: 'bewehr',  label: 'Bewehrung',         einheit: 'kg'  },
  { id: 'schraub', label: 'Fundamentschrauben',einheit: 'Stk' },
];

// ── Speicher ─────────────────────────────────────────────────
function loadLvPositionen() {
  try { return jsonParse(store.getItem(LV_POS_KEY())) || []; } catch { return []; }
}
function saveLvPositionen(liste) {
  store.setItem(LV_POS_KEY(), JSON.stringify(liste));
}
function loadMkEinstellungen() {
  try { return jsonParse(store.getItem(LV_EINST_KEY())) || { zuschlag: 10, mwst: 8.1 }; }
  catch { return { zuschlag: 10, mwst: 8.1 }; }
}
function saveMkEinstellungen(e) {
  store.setItem(LV_EINST_KEY(), JSON.stringify(e));
}

function mkEinstellungSpeichern() {
  const zu = parseFloat(document.getElementById('mk-zuschlag')?.value);
  const mw = parseFloat(document.getElementById('mk-mwst')?.value);
  saveMkEinstellungen({
    zuschlag: Number.isFinite(zu) ? zu : 0,
    mwst:     Number.isFinite(mw) ? mw : 0,
  });
  renderMassenView();
}

// ── Massenauszug ─────────────────────────────────────────────
// Die Kubatur steht nicht als Zahl am Fundamenttyp — das Feld «beton» traegt
// die Betonsorte (NPK F, C30/37 …), nicht ein Volumen. Gerechnet wird deshalb
// aus der Geometrie:
//
//   Blockfundament   Kopf   = Kopfmass² × Kopfhoehe
//                    Block  = Blockmass² × (Tiefe − Kopfhoehe)
//                    Aushub = Blockmass² × Tiefe    (ohne Arbeitsraumzuschlag)
//                    Schalung = Umfang × Hoehe je Teil
//
// Was sich so nicht rechnen laesst — Pfahlfundamente ohne Durchmesser,
// Spezialfundamente ohne Masse — wird NICHT geschaetzt, sondern als fehlend
// ausgewiesen. Eine erfundene Menge waere in einer Kostenschaetzung das
// Gegenteil von hilfreich.
//
// Bewehrung bleibt offen: am Typ steht die Stahlsorte (B500B), nicht das
// Gewicht. Sobald die Vorlage des Anwenders Kilogramm je Typ mitbringt, ist
// hier die Stelle dafuer.

// «600×600 mm» → 0.6 (Seitenlaenge in Metern, quadratisch angenommen)
function _mkSeite(mass) {
  const m = String(mass || '').match(/(\d+(?:[.,]\d+)?)\s*[×x*]\s*(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const a = parseFloat(m[1].replace(',', '.'));
  const b = parseFloat(m[2].replace(',', '.'));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  // Angaben in Millimetern, wenn die Zahl gross ist
  const f = a > 20 ? 0.001 : 1;
  return { a: a * f, b: b * f };
}

function _mkZahlFeld(w) {
  const n = parseFloat(String(w).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function _mkTypDaten(ft) {
  if (!ft) return null;
  const schraub = _mkZahlFeld(ft.schraubenAnzahl);
  const kopf    = _mkSeite(ft.kopfAbmessung);
  const block   = _mkSeite(ft.blockAbmessung);
  const kopfH   = _mkZahlFeld(ft.kopfHoehe);
  const tiefe   = _mkZahlFeld(ft.tiefe);

  // Ohne Kopf- und Blockmass oder ohne Tiefe laesst sich nichts rechnen
  if (!kopf || !block || kopfH == null || tiefe == null) {
    return { beton: null, aushub: null, schalung: null, bewehr: null, schraub };
  }
  const blockH   = Math.max(0, tiefe - kopfH);
  const kopfVol  = kopf.a * kopf.b * kopfH;
  const blockVol = block.a * block.b * blockH;
  const schalung = 2 * (kopf.a + kopf.b) * kopfH + 2 * (block.a + block.b) * blockH;

  return {
    beton:    kopfVol + blockVol,
    aushub:   block.a * block.b * tiefe,
    schalung,
    bewehr:   null,       // am Typ steht die Stahlsorte, nicht das Gewicht
    schraub,
  };
}

// Typ eines Standorts finden. Zuerst ueber die stabile Kennung; aeltere und
// eingelesene Standorte tragen nur den Namen. Der wiederum stimmt nicht
// zeichengleich ueberein — die Bibliothek fuehrt «DP1a / 1.8», der Standort
// «DP1a / 1.80». Deshalb wird die Tiefe als Zahl verglichen, nicht als Text.
function _mkNameZerlegen(name) {
  const teile = String(name || '').split('/');
  const familie = teile[0].trim().toLowerCase();
  const tiefe = teile.length > 1 ? parseFloat(teile[1].replace(',', '.')) : NaN;
  return { familie, tiefe };
}

function _mkTypZuStandort(ftProfile, bp) {
  if (bp.ftProfilId) {
    const nachId = ftProfile.find(t => t.id === bp.ftProfilId);
    if (nachId) return nachId;
  }
  if (!bp.fundtyp) return null;
  const genau = ftProfile.find(t => t.name === bp.fundtyp);
  if (genau) return genau;
  const gesucht = _mkNameZerlegen(bp.fundtyp);
  if (!gesucht.familie) return null;
  return ftProfile.find(t => {
    const k = _mkNameZerlegen(t.name);
    if (k.familie !== gesucht.familie) return false;
    if (Number.isNaN(gesucht.tiefe) && Number.isNaN(k.tiefe)) return true;
    return Math.abs(k.tiefe - gesucht.tiefe) < 0.005;
  }) || null;
}

// Ein Eintrag je Gruppe, mit den Summen aller Groessen und der Zahl der
// Standorte, bei denen eine Angabe fehlt.
function massenauszugRechnen(gliederung) {
  const ftProfile = typeof loadFtProfile === 'function' ? loadFtProfile() : [];
  const allBp     = typeof loadAllBauprojekt === 'function' ? loadAllBauprojekt() : {};
  const zuw       = typeof loadSchichtZuw === 'function' ? loadSchichtZuw() : {};
  const pakete    = typeof loadBaupakete === 'function' ? loadBaupakete() : [];
  const gruppen   = new Map();

  getFundamente().forEach(p => {
    const bp = { ...p, ...(allBp[p.id] || {}) };
    const eintrag = _mkTypZuStandort(ftProfile, bp);
    const typName = eintrag?.name || bp.fundtyp || '— kein Typ —';

    let schluessel = typName;
    if (gliederung === 'massnahme') {
      schluessel = typeof getMassnahmeLabel === 'function' ? getMassnahmeLabel(bp) : (bp.massnahme || '—');
    } else if (gliederung === 'los') {
      const pak = pakete.find(x => x.id === zuw[p.id]?.paketId);
      schluessel = pak?.name || '— nicht zugewiesen —';
    }

    if (!gruppen.has(schluessel)) {
      gruppen.set(schluessel, { name: schluessel, anzahl: 0, fehlend: 0,
        beton: 0, aushub: 0, schalung: 0, bewehr: 0, schraub: 0 });
    }
    const g = gruppen.get(schluessel);
    g.anzahl++;
    const d = _mkTypDaten(eintrag);
    if (!d || d.beton == null) g.fehlend++;
    if (d) ['beton','aushub','schalung','bewehr','schraub'].forEach(k => {
      if (d[k] != null) g[k] += d[k];
    });
  });

  return [...gruppen.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

function massenSummen(zeilen) {
  const s = { anzahl: 0, fehlend: 0, beton: 0, aushub: 0, schalung: 0, bewehr: 0, schraub: 0 };
  zeilen.forEach(z => Object.keys(s).forEach(k => { s[k] += z[k] || 0; }));
  return s;
}

// ── Leistungsverzeichnis ─────────────────────────────────────
function lvZeileNeu() {
  const liste = loadLvPositionen();
  liste.push({ id: 'lv_' + Date.now().toString(36), pos: '', text: '',
               einheit: '', menge: 0, preis: 0, herkunft: '' });
  saveLvPositionen(liste);
  renderMassenView();
}

function lvFeldSpeichern(id, feld, wert) {
  const liste = loadLvPositionen();
  const z = liste.find(x => x.id === id);
  if (!z) return;
  z[feld] = ['menge','preis'].includes(feld) ? (parseFloat(String(wert).replace(',', '.')) || 0) : wert;
  saveLvPositionen(liste);
  if (feld === 'menge' || feld === 'preis' || feld === 'herkunft') renderMassenView();
}

async function lvZeileLoeschen(id) {
  if (!await ui.confirm('Position löschen?')) return;
  saveLvPositionen(loadLvPositionen().filter(x => x.id !== id));
  renderMassenView();
}

// Menge einer Position: aus dem Massenauszug, wenn eine Herkunft gesetzt ist
function lvMenge(zeile, summen) {
  if (zeile.herkunft && summen[zeile.herkunft] != null) return summen[zeile.herkunft];
  return zeile.menge || 0;
}

// ── Darstellung ──────────────────────────────────────────────
const _mkZahl = (n, stellen = 2) =>
  (Number(n) || 0).toLocaleString('de-CH', { minimumFractionDigits: stellen, maximumFractionDigits: stellen });

function renderMassenView() {
  const wrap = document.getElementById('massen-wrap');
  if (!wrap) return;
  const gliederung = document.getElementById('mk-massen-gliederung')?.value || 'typ';
  const zeilen  = massenauszugRechnen(gliederung);
  const summen  = massenSummen(zeilen);
  const einst   = loadMkEinstellungen();

  const zuschlagEl = document.getElementById('mk-zuschlag');
  const mwstEl     = document.getElementById('mk-mwst');
  if (zuschlagEl && document.activeElement !== zuschlagEl) zuschlagEl.value = einst.zuschlag;
  if (mwstEl     && document.activeElement !== mwstEl)     mwstEl.value     = einst.mwst;

  _mkKennzahlen(summen, zeilen);
  _mkMassenTabelle(zeilen, summen, gliederung);
  _mkLvTabelle(summen);
}

function _mkKennzahlen(summen, zeilen) {
  const box = document.getElementById('mk-kennzahlen');
  if (!box) return;
  const kachel = (wert, label, hinweis) =>
    `<div style="background:white;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;">
       <div style="font-size:17px;font-weight:700;color:#1a3a5c;line-height:1.2;">${wert}</div>
       <div style="font-size:10px;color:#6b7280;margin-top:2px;">${escHtml(label)}</div>
       ${hinweis ? `<div style="font-size:10px;color:#b45309;margin-top:3px;">${escHtml(hinweis)}</div>` : ''}
     </div>`;
  box.innerHTML =
      kachel(summen.anzahl, 'Fundamente',
             summen.fehlend ? summen.fehlend + ' ohne Kubatur' : '')
    + kachel(_mkZahl(summen.beton, 1) + ' m³', 'Beton')
    + kachel(_mkZahl(summen.aushub, 1) + ' m³', 'Aushub')
    + kachel(zeilen.length, 'Gruppen im Auszug');
}

function _mkMassenTabelle(zeilen, summen, gliederung) {
  const el = document.getElementById('mk-massen-tabelle');
  if (!el) return;
  if (!zeilen.length) {
    el.innerHTML = '<div style="padding:22px;text-align:center;font-size:12px;color:#9ca3af;">'
      + 'Noch keine Fundamentstandorte in dieser Phase.</div>';
    return;
  }
  const kopf = { typ: 'Fundamenttyp', massnahme: 'Massnahme', los: 'Los' }[gliederung] || 'Gruppe';
  const zelle = (inhalt, rechts) =>
    `<td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;${rechts ? 'text-align:right;font-variant-numeric:tabular-nums;' : ''}">${inhalt}</td>`;
  el.innerHTML =
    `<table style="width:100%;border-collapse:collapse;font-size:12px;">
       <thead><tr style="background:#f9fafb;">
         <th style="text-align:left;padding:7px 10px;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">${kopf}</th>
         ${MASSEN_GROESSEN.map(g =>
           `<th style="text-align:right;padding:7px 10px;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;">${g.label}<br><span style="font-weight:400;text-transform:none;">${g.einheit}</span></th>`).join('')}
       </tr></thead>
       <tbody>
         ${zeilen.map(z => `<tr>
           ${zelle(escHtml(z.name) + (z.fehlend ? ` <span title="${z.fehlend} Standort(e) ohne Kubatur am Typ" style="color:#b45309;">·</span>` : ''))}
           ${zelle(z.anzahl, true)}
           ${zelle(_mkZahl(z.beton, 1), true)}
           ${zelle(_mkZahl(z.aushub, 1), true)}
           ${zelle(_mkZahl(z.schalung, 1), true)}
           ${zelle(_mkZahl(z.bewehr, 0), true)}
           ${zelle(z.schraub, true)}
         </tr>`).join('')}
       </tbody>
       <tfoot><tr style="background:#f9fafb;font-weight:700;">
         ${zelle('Total')}
         ${zelle(summen.anzahl, true)}
         ${zelle(_mkZahl(summen.beton, 1), true)}
         ${zelle(_mkZahl(summen.aushub, 1), true)}
         ${zelle(_mkZahl(summen.schalung, 1), true)}
         ${zelle(_mkZahl(summen.bewehr, 0), true)}
         ${zelle(summen.schraub, true)}
       </tr></tfoot>
     </table>`;
}

function _mkLvTabelle(summen) {
  const el = document.getElementById('mk-lv-tabelle');
  const hinweisEl = document.getElementById('mk-lv-hinweis');
  if (!el) return;
  const positionen = loadLvPositionen();
  if (hinweisEl) hinweisEl.textContent = positionen.length
    ? positionen.length + ' Positionen'
    : 'Noch kein Verzeichnis eingelesen';

  if (!positionen.length) {
    el.innerHTML = '<div style="padding:22px;text-align:center;font-size:12px;color:#9ca3af;line-height:1.6;">'
      + 'Leistungsverzeichnis über <b>LV einlesen</b> laden<br>'
      + '<span style="font-size:11px;">Erwartet werden Spalten für Positionsnummer, Text, Einheit, Menge und Einheitspreis.</span></div>';
    _mkSummenZeile(0);
    return;
  }

  const eingabe = (id, feld, wert, breite, art) =>
    `<input value="${escHtml(String(wert ?? ''))}" ${art === 'zahl' ? 'type="number" step="0.01"' : 'type="text"'}
            onchange="lvFeldSpeichern('${id}','${feld}',this.value)"
            style="width:${breite};padding:4px 6px;border:1px solid transparent;border-radius:5px;font-size:12px;font-family:inherit;background:transparent;${art === 'zahl' ? 'text-align:right;font-variant-numeric:tabular-nums;' : ''}"
            onfocus="this.style.borderColor='#d1d5db';this.style.background='white'"
            onblur="this.style.borderColor='transparent';this.style.background='transparent'">`;

  const herkunftWahl = (z) =>
    `<select onchange="lvFeldSpeichern('${z.id}','herkunft',this.value)"
             title="Menge aus dem Massenauszug übernehmen"
             style="padding:3px 5px;border:1px solid #e5e7eb;border-radius:5px;font-size:11px;font-family:inherit;background:white;">
       <option value="">von Hand</option>
       ${MASSEN_GROESSEN.map(g => `<option value="${g.id}"${z.herkunft === g.id ? ' selected' : ''}>${g.label}</option>`).join('')}
     </select>`;

  let total = 0;
  const zeilenHtml = positionen.map(z => {
    const menge  = lvMenge(z, summen);
    const betrag = menge * (z.preis || 0);
    total += betrag;
    const gebunden = !!(z.herkunft && summen[z.herkunft] != null);
    return `<tr>
      <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">${eingabe(z.id,'pos',z.pos,'70px')}</td>
      <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;">${eingabe(z.id,'text',z.text,'100%')}</td>
      <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;">${eingabe(z.id,'einheit',z.einheit,'52px')}</td>
      <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;text-align:right;">
        ${gebunden
          ? `<span title="aus dem Massenauszug" style="font-variant-numeric:tabular-nums;color:#1a3a5c;font-weight:600;">${_mkZahl(menge, 1)}</span>`
          : eingabe(z.id,'menge',z.menge,'80px','zahl')}</td>
      <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;">${herkunftWahl(z)}</td>
      <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;text-align:right;">${eingabe(z.id,'preis',z.preis,'90px','zahl')}</td>
      <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">${_mkZahl(betrag)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #f3f4f6;">
        <button onclick="lvZeileLoeschen('${z.id}')" title="Position löschen"
          style="border:none;background:none;cursor:pointer;color:#9ca3af;padding:2px;display:flex;align-items:center;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button></td>
    </tr>`;
  }).join('');

  const th = (t, rechts) =>
    `<th style="text-align:${rechts ? 'right' : 'left'};padding:7px 10px;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;">${t}</th>`;
  el.innerHTML =
    `<table style="width:100%;border-collapse:collapse;font-size:12px;">
       <thead><tr style="background:#f9fafb;">
         ${th('Pos.')}${th('Bezeichnung')}${th('Einheit')}${th('Menge', true)}${th('Menge aus')}${th('Einheitspreis', true)}${th('Betrag', true)}${th('')}
       </tr></thead>
       <tbody>${zeilenHtml}</tbody>
     </table>`;
  _mkSummenZeile(total);
}

function _mkSummenZeile(netto) {
  const el = document.getElementById('mk-summen');
  if (!el) return;
  const e   = loadMkEinstellungen();
  const zu  = netto * (e.zuschlag || 0) / 100;
  const zwi = netto + zu;
  const mw  = zwi * (e.mwst || 0) / 100;
  const zeile = (label, wert, stark) =>
    `<div style="display:flex;justify-content:space-between;gap:16px;${stark ? 'border-top:1px solid #e5e7eb;margin-top:4px;padding-top:4px;' : 'font-weight:400;color:#6b7280;'}">
       <span>${label}</span><span style="font-variant-numeric:tabular-nums;">${_mkZahl(wert)}</span></div>`;
  el.innerHTML = zeile('Summe LV', netto)
    + zeile('Unvorhergesehenes', zu)
    + zeile('MWST', mw)
    + zeile('Total inkl. MWST', zwi + mw, true);
}

// ── Einlesen und Ausgeben ────────────────────────────────────
// Das Einlesen bleibt bewusst offen: welche Spalte was bedeutet, entscheidet
// die Vorlage des Anwenders. Erkannt werden gaengige Ueberschriften; was
// nicht zugeordnet werden kann, bleibt leer und laesst sich nachtragen.
const LV_SPALTEN = {
  pos:     ['pos', 'pos.', 'position', 'positionsnummer', 'nr', 'nr.'],
  text:    ['text', 'bezeichnung', 'leistung', 'beschreibung'],
  einheit: ['einheit', 'eh', 'me'],
  menge:   ['menge', 'anzahl', 'quantität', 'quantitaet'],
  preis:   ['einheitspreis', 'preis', 'ep', 'e-preis'],
};

function _lvSpalteZuordnen(titel) {
  const t = String(titel || '').trim().toLowerCase();
  return Object.keys(LV_SPALTEN).find(feld => LV_SPALTEN[feld].includes(t)) || null;
}

function lvImportDatei(input) {
  const datei = input.files?.[0];
  if (!datei) return;
  const leser = new FileReader();
  leser.onload = e => {
    try {
      const wb    = XLSX.read(e.target.result, { type: 'array' });
      const blatt = wb.Sheets[wb.SheetNames[0]];
      const roh   = XLSX.utils.sheet_to_json(blatt, { header: 1, defval: '' });
      if (!roh.length) { ui.toast('Die Datei enthält keine Zeilen.', 'fehler'); return; }

      // Kopfzeile suchen: die erste Zeile, in der sich mindestens zwei
      // Spalten zuordnen lassen.
      let kopfIndex = roh.findIndex(z => z.filter(_lvSpalteZuordnen).length >= 2);
      if (kopfIndex < 0) kopfIndex = 0;
      const zuordnung = roh[kopfIndex].map(_lvSpalteZuordnen);

      const positionen = [];
      roh.slice(kopfIndex + 1).forEach((zeile, i) => {
        const z = { id: 'lv_' + Date.now().toString(36) + '_' + i,
                    pos: '', text: '', einheit: '', menge: 0, preis: 0, herkunft: '' };
        zuordnung.forEach((feld, sp) => {
          if (!feld) return;
          const wert = zeile[sp];
          if (feld === 'menge' || feld === 'preis') {
            z[feld] = parseFloat(String(wert).replace(/'/g, '').replace(',', '.')) || 0;
          } else {
            z[feld] = String(wert ?? '').trim();
          }
        });
        if (z.pos || z.text) positionen.push(z);
      });

      if (!positionen.length) { ui.toast('Keine Positionen erkannt.', 'fehler'); return; }
      saveLvPositionen(positionen);
      renderMassenView();
      ui.toast(positionen.length + ' Positionen eingelesen', 'erfolg');
    } catch (err) {
      ui.toast('Datei konnte nicht gelesen werden: ' + err.message, 'fehler');
    }
    input.value = '';
  };
  leser.readAsArrayBuffer(datei);
}

function lvExportXlsx() {
  const summen = massenSummen(massenauszugRechnen(
    document.getElementById('mk-massen-gliederung')?.value || 'typ'));
  const zeilen = loadLvPositionen().map(z => {
    const menge = lvMenge(z, summen);
    return { 'Pos.': z.pos, 'Bezeichnung': z.text, 'Einheit': z.einheit,
             'Menge': menge, 'Einheitspreis': z.preis, 'Betrag': menge * (z.preis || 0) };
  });
  if (!zeilen.length) { ui.toast('Keine Positionen zum Ausgeben.', 'fehler'); return; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(zeilen), 'Leistungsverzeichnis');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    massenauszugRechnen(document.getElementById('mk-massen-gliederung')?.value || 'typ')), 'Massenauszug');
  XLSX.writeFile(wb, 'Massen-Kosten.xlsx');
}
