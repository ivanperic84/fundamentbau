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

// ============================================================
// LEISTUNGSKATALOG
// ============================================================
// Der Katalog gilt fuer alle Projekte, nicht je Projekt. Je Position stehen
// darin der Einheitspreis der Region und die Schichtleistung je
// Intervalldauer (4h bis 9h). Daraus folgen die Schichten:
//
//   Schichten je Position = aufrunden(Menge / Leistungswert bei Intervall)
//
// Achtung auf die Einheit: der Katalog zaehlt FUNDAMENTE JE SCHICHT, das Feld
// «ftIntervall» der Typenbibliothek dagegen STUNDEN JE FUNDAMENT. Beides
// steht nebeneinander, umgerechnet wird nichts — welcher Wert die Bauzeit
// bestimmt, entscheidet der Anwender (siehe lkVergleich()).
const LK_KATALOG_KEY = 'sp_lk_katalog';
const FT_LW_KEY      = 'sp_ft_leistungswerte';

// Intervalldauern in der Reihenfolge der Katalogspalten
const LK_INTERVALLE = [4, 5, 6, 7, 8, 9];

function loadLkKatalog() {
  try { return jsonParse(store.getItem(LK_KATALOG_KEY)) || null; } catch { return null; }
}
function saveLkKatalog(k) { store.setItem(LK_KATALOG_KEY, JSON.stringify(k)); }

function loadFtLeistungswerte() {
  try { return jsonParse(store.getItem(FT_LW_KEY)) || {}; } catch { return {}; }
}
function saveFtLeistungswerte(w) { store.setItem(FT_LW_KEY, JSON.stringify(w)); }

// Gewaehlte Intervalldauer — der Wert steht im Sperrmuster, hier nur die
// Vorgabe fuer die Rechnung mit dem Katalog.
const LK_INTERVALL_KEY = () => 'sp_lk_intervall__' + _activeId;
function lkIntervall() {
  const n = parseFloat(store.getItem(LK_INTERVALL_KEY()));
  return LK_INTERVALLE.includes(n) ? n : 5;
}
function lkIntervallSetzen(wert) {
  store.setItem(LK_INTERVALL_KEY(), String(wert));
  renderMassenView();
}

// Groessen, die der Massenauszug kennt. Die Einheit steht hier, damit sie in
// Tabelle und Verzeichnis dieselbe ist.
const MASSEN_GROESSEN = [
  { id: 'anzahl',     label: 'Fundamente',        einheit: 'Stk' },
  { id: 'beton',      label: 'Beton',             einheit: 'm³'  },
  { id: 'aushub',     label: 'Aushub',            einheit: 'm³'  },
  { id: 'schalung',   label: 'Schalung',          einheit: 'm²'  },
  { id: 'bewehr',     label: 'Bewehrung',         einheit: 'kg'  },
  { id: 'schraub',    label: 'Fundamentschrauben',einheit: 'Stk' },
  // Pfaehle werden nach Stueck und Bohrmeter abgerechnet, nicht nach Volumen
  { id: 'pfahlStk',   label: 'Pfähle',            einheit: 'Stk' },
  { id: 'pfahlMeter', label: 'Pfahllänge',        einheit: 'm'   },
];

// Groessen, die als ganze Zahl angeschrieben werden
const MASSEN_GANZ = new Set(['anzahl', 'schraub', 'pfahlStk', 'bewehr']);

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

  // Pfaehle: Stueckzahl und Bohrmeter je Fundament. Ein Betonvolumen liesse
  // sich erst mit dem Pfahldurchmesser rechnen — den fuehrt der Typ nicht.
  const pfahlStk   = _mkZahlFeld(ft.anzahlPfaehle);
  const pfahlLaenge= _mkZahlFeld(ft.pfahlLaenge);
  const pfahlMeter = (pfahlStk != null && pfahlLaenge != null) ? pfahlStk * pfahlLaenge : null;

  const leer = { beton: null, aushub: null, schalung: null, bewehr: null,
                 schraub, pfahlStk, pfahlMeter };

  // Ohne Kopf- und Blockmass oder ohne Tiefe laesst sich der Block nicht rechnen
  if (!kopf || !block || kopfH == null || tiefe == null) return leer;

  const blockH   = Math.max(0, tiefe - kopfH);
  const kopfVol  = kopf.a * kopf.b * kopfH;
  const blockVol = block.a * block.b * blockH;
  const schalung = 2 * (kopf.a + kopf.b) * kopfH + 2 * (block.a + block.b) * blockH;

  return {
    ...leer,
    beton:    kopfVol + blockVol,
    aushub:   block.a * block.b * tiefe,
    schalung,
  };
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
    const eintrag = ftTypZuStandort(ftProfile, bp);
    const typName = eintrag?.name || bp.fundtyp || '— kein Typ —';

    let schluessel = typName;
    if (gliederung === 'massnahme') {
      schluessel = typeof getMassnahmeLabel === 'function' ? getMassnahmeLabel(bp) : (bp.massnahme || '—');
    } else if (gliederung === 'los') {
      const pak = pakete.find(x => x.id === zuw[p.id]?.paketId);
      schluessel = pak?.name || '— nicht zugewiesen —';
    }

    if (!gruppen.has(schluessel)) {
      const leer = { name: schluessel, fehlend: 0 };
      MASSEN_GROESSEN.forEach(g => { leer[g.id] = 0; });
      gruppen.set(schluessel, leer);
    }
    const g = gruppen.get(schluessel);
    g.anzahl++;
    const d = _mkTypDaten(eintrag);
    // Fehlend heisst: zu diesem Standort laesst sich gar keine Menge rechnen.
    // Ein Pfahlfundament ohne Betonvolumen, aber mit Bohrmetern zaehlt nicht
    // dazu — es ist erfasst, nur anders bemessen.
    if (!d || (d.beton == null && d.pfahlMeter == null)) g.fehlend++;
    if (d) MASSEN_GROESSEN.forEach(({ id }) => {
      if (id !== 'anzahl' && d[id] != null) g[id] += d[id];
    });
  });

  return [...gruppen.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

function massenSummen(zeilen) {
  const s = { fehlend: 0 };
  MASSEN_GROESSEN.forEach(g => { s[g.id] = 0; });
  zeilen.forEach(z => Object.keys(s).forEach(k => { s[k] += z[k] || 0; }));
  return s;
}

// ── Leistungsverzeichnis ─────────────────────────────────────
// ── Positionsvorlage aus dem Zusammenstellungsblatt ──────────
// Das Zusammenstellungsblatt fuehrt die Positionen, die bei diesen Arbeiten
// ueblicherweise anfallen: Installationen, Personal, Sicherung, Abbruch,
// Kabelkanal, Fundamente. Es liefert damit die AUSWAHL — welche davon im
// Projekt gebraucht werden und mit welcher Menge, entscheidet der Anwender.
const LV_VORLAGE_KEY = 'sp_lv_vorlage';

function loadLvVorlage() {
  try { return jsonParse(store.getItem(LV_VORLAGE_KEY)) || []; } catch { return []; }
}

// Die Positionsnummer steht in vier Spalten nebeneinander (Kapitel,
// Hauptposition, Unterposition, Variante) und wird zum Schluessel verkettet —
// so steht sie auch im Katalog.
function lvVorlageAusPuffer(puffer) {
  const wb = XLSX.read(puffer, { type: 'array' });
  const blattName = wb.SheetNames.find(n => /mengen|zusammenstell/i.test(n)) || wb.SheetNames[0];
  const roh = XLSX.utils.sheet_to_json(wb.Sheets[blattName], { header: 1, defval: '' });
  const katalog = loadLkKatalog();

  // Kopfzeile: die Zeile mit «Beschrieb» und «LE»
  let kopf = roh.findIndex(z => z.some(c => /beschrieb/i.test(String(c))));
  if (kopf < 0) throw new Error('Im Blatt «' + blattName + '» fehlt die Kopfzeile mit «Beschrieb».');
  const norm = roh[kopf].map(c => String(c || '').trim().toLowerCase());
  const sp = {
    text:    norm.findIndex(c => c.includes('beschrieb')),
    einheit: norm.findIndex(c => c === 'le' || c.includes('einheit')),
    pos:     norm.findIndex(c => c.includes('lk-position') || c.includes('lk position')),
  };

  const eintraege = [];
  roh.slice(kopf + 1).forEach(z => {
    // Vier Spalten ab der LK-Position bilden den Schluessel
    if (sp.pos < 0) return;
    const teile = [0, 1, 2, 3].map(i => String(z[sp.pos + i] ?? '').trim());
    if (!/^\d{3}$/.test(teile[0])) return;
    const schluessel = teile.join('');
    const ausKatalog = katalog?.positionen.find(p => p.id === schluessel);
    const text = String(z[sp.text] ?? '').trim() || ausKatalog?.text || '';
    if (!text) return;
    eintraege.push({
      pos:     schluessel,
      text:    text.replace(/\s+/g, ' ').slice(0, 160),
      einheit: String(z[sp.einheit] ?? '').trim() || ausKatalog?.einheit || '',
      preis:   ausKatalog?.preis ?? null,
    });
  });
  if (!eintraege.length) throw new Error('Keine Positionen mit Positionsnummer erkannt.');
  store.setItem(LV_VORLAGE_KEY, JSON.stringify(eintraege));
  return eintraege.length;
}

function lvVorlageImport(input) {
  const datei = input.files?.[0];
  if (!datei) return;
  const leser = new FileReader();
  leser.onload = e => {
    try {
      const n = lvVorlageAusPuffer(e.target.result);
      renderMassenView();
      ui.toast(n + ' Positionen als Vorlage übernommen', 'erfolg');
    } catch (err) { ui.toast(err.message, 'fehler'); }
    input.value = '';
  };
  leser.readAsArrayBuffer(datei);
}

// Auswahlfeld: Positionen der Vorlage ins Verzeichnis uebernehmen
function lvVorlagePanelUmschalten(ev) {
  if (ev) ev.stopPropagation();
  const panel = document.getElementById('mk-vorlage-panel');
  if (!panel) return;
  if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
  const vorlage = loadLvVorlage();
  if (!vorlage.length) {
    ui.toast('Noch keine Vorlage eingelesen — «Positionen einlesen».', 'fehler');
    return;
  }
  const drin = new Set(loadLvPositionen().map(z => z.pos));
  panel.innerHTML =
    '<div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:8px;">Position übernehmen</div>'
    + '<div style="max-height:320px;overflow-y:auto;">'
    + vorlage.map((v, i) =>
        `<button onclick="lvAusVorlage(${i})" ${drin.has(v.pos) ? 'disabled' : ''}
           style="display:block;width:100%;text-align:left;padding:5px 7px;border:none;border-radius:6px;
                  background:none;font-size:11px;font-family:inherit;cursor:pointer;
                  color:${drin.has(v.pos) ? '#c7cdd4' : '#374151'};"
           onmouseover="if(!this.disabled)this.style.background='#f3f4f6'" onmouseout="this.style.background='none'">
           <span style="font-variant-numeric:tabular-nums;color:#9ca3af;">${escHtml(v.pos)}</span>
           ${escHtml(v.text.slice(0, 70))}
         </button>`).join('')
    + '</div>';
  panel.style.display = 'block';
}

function lvAusVorlage(index) {
  const v = loadLvVorlage()[index];
  if (!v) return;
  const liste = loadLvPositionen();
  liste.push({ id: 'lv_' + Date.now().toString(36), pos: v.pos, text: v.text,
               einheit: v.einheit, menge: 0, preis: v.preis || 0, herkunft: '' });
  saveLvPositionen(liste);
  document.getElementById('mk-vorlage-panel').style.display = 'none';
  renderMassenView();
}

document.addEventListener('click', e => {
  if (e.target.closest('#mk-vorlage-panel') || e.target.closest('#mk-vorlage-btn')) return;
  const panel = document.getElementById('mk-vorlage-panel');
  if (panel) panel.style.display = 'none';
});

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

// Menge einer Position. Drei Herkuenfte:
//   ''          von Hand — die Zahl steht in der Zeile (globale Angabe)
//   'schicht'   Anzahl Schichten (Bauleitung, Sicherung, Maschinen je Nacht)
//   <Groesse>   eine Groesse des Massenauszugs
function lvMenge(zeile, summen) {
  if (zeile.herkunft === 'schicht') return schichtenGesamt();
  if (zeile.herkunft && summen[zeile.herkunft] != null) return summen[zeile.herkunft];
  return zeile.menge || 0;
}

// Schichten ueber alle Fundamenttypen, aus den Aufwandswerten. Das ist die
// Groesse, an der die zeitabhaengigen Positionen haengen.
function schichtenGesamt() {
  return lkVergleich().reduce((s, z) => s + (z.schichtenAufwand || 0), 0);
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
  _mkLwTabelle();
  _mkLvTabelle(summen);
}

// Leistungswerte und die daraus folgenden Schichten. Bewusst als
// Gegenueberstellung: der Katalog zaehlt Fundamente je Schicht, die
// Typenbibliothek Stunden je Fundament. Solange nicht entschieden ist,
// welcher Wert die Bauzeit bestimmt, wird hier nichts umgerechnet, sondern
// beides nebeneinander gezeigt.
function _mkLwTabelle() {
  const el = document.getElementById('mk-lw-tabelle');
  if (!el) return;

  const sel = document.getElementById('mk-intervall');
  if (sel && !sel.options.length) {
    sel.innerHTML = LK_INTERVALLE.map(h => `<option value="${h}">${h} h</option>`).join('');
  }
  if (sel) sel.value = String(lkIntervall());

  const katalog = loadLkKatalog();
  const standEl = document.getElementById('mk-katalog-stand');
  if (standEl) {
    standEl.textContent = katalog
      ? `${katalog.positionen.length} Positionen`
        + (katalog.region ? ' · ' + katalog.region : '')
        + (katalog.stand ? ' · Stand ' + new Date(katalog.stand).toLocaleDateString('de-CH') : '')
      : 'Kein Katalog eingelesen';
  }
  if (!katalog) {
    el.innerHTML = '<div style="padding:22px;text-align:center;font-size:12px;color:#9ca3af;line-height:1.6;">'
      + 'Leistungskatalog über <b>Katalog einlesen</b> laden<br>'
      + '<span style="font-size:11px;">Erwartet wird eine Tabelle mit Positionsnummer, Beschrieb, '
      + 'Einheit, Einheitspreis und den Schichtleistungen 4 h bis 9 h.</span></div>';
    return;
  }

  const zeilen = lkVergleich();
  const th = (t, rechts, hinweis) =>
    `<th ${hinweis ? `title="${escHtml(hinweis)}"` : ''} style="text-align:${rechts ? 'right' : 'left'};padding:7px 10px;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;">${t}</th>`;
  const td = (inhalt, rechts, stil) =>
    `<td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;${rechts ? 'text-align:right;font-variant-numeric:tabular-nums;' : ''}${stil || ''}">${inhalt}</td>`;

  // Vorschlagswerte stehen grau daneben, gerechnet wird mit dem eigenen Wert.
  // Ein leeres Feld heisst «Vorschlag gilt» — deshalb steht der Vorschlag als
  // Platzhalter im Feld und nicht als vorbelegter Inhalt: sonst waere nicht zu
  // unterscheiden, was der Anwender gesetzt hat und was hergeleitet ist.
  const grau = t => `<span style="color:#9ca3af;">${t}</span>`;
  const feld = (ftId, name, wert, platzhalter) =>
    `<input type="number" step="0.05" min="0" value="${wert ?? ''}"
            placeholder="${platzhalter != null ? _mkZahl(platzhalter, 2) : ''}"
            onchange="lwEigenSetzen('${ftId}','${name}',this.value)"
            style="width:66px;padding:3px 5px;border:1px solid #e5e7eb;border-radius:5px;
                   font-size:12px;font-family:inherit;text-align:right;font-variant-numeric:tabular-nums;">`;

  let sumKatalog = 0, sumAufwand = 0, ohneWert = 0;
  const koerper = zeilen.map(z => {
    if (z.schichtenKatalog != null) sumKatalog += z.schichtenKatalog; else ohneWert += z.anzahl;
    if (z.schichtenAufwand != null) sumAufwand += z.schichtenAufwand;
    return `<tr>
      ${td(escHtml(z.name))}
      ${td(z.anzahl, true)}
      ${td(z.lw != null ? grau(z.lw) : grau('—'), true)}
      ${td(z.schichtenKatalog != null ? grau(z.schichtenKatalog) : grau('—'), true)}
      ${td(z.vorschlagH != null ? grau(_mkZahl(z.vorschlagH, 2)) : grau('—'), true)}
      ${td(z.ftId ? feld(z.ftId, 'eigenH', z.eigenH, z.vorschlagH) : '', true)}
      ${td(z.ftId ? feld(z.ftId, 'eigenRuest', z.eigenRuest, z.vorschlagRuest) : '', true)}
      ${td(z.schichtenAufwand != null ? z.schichtenAufwand : '—', true, 'font-weight:600;')}
    </tr>`;
  }).join('');

  el.innerHTML =
    `<table style="width:100%;border-collapse:collapse;font-size:12px;">
       <thead><tr style="background:#f9fafb;">
         ${th('Fundamenttyp')}${th('Anzahl', true)}
         ${th('LE/Schicht', true, 'Schichtleistung aus dem Katalog bei der gewählten Intervalldauer — nur zur Ansicht')}
         ${th('Schichten daraus', true, 'aufgerundet: Anzahl ÷ Schichtleistung — nur zur Ansicht')}
         ${th('h/Fund. herg.', true, 'Aus den Schichtleistungen hergeleiteter Aufwandswert (Steigung der Ausgleichsgeraden)')}
         ${th('h/Fundament', true, 'Eigener Aufwandswert. Leer = hergeleiteter Wert gilt.')}
         ${th('Rüstzeit h', true, 'Fixe Zeit je Schicht: Sperrpause, Sicherung einrichten, Räumen. Leer = hergeleiteter Wert gilt.')}
         ${th('Schichten', true, 'aufgerundet: Anzahl × Aufwandswert ÷ (Intervalldauer − Rüstzeit)')}
       </tr></thead>
       <tbody>${koerper}</tbody>
       <tfoot><tr style="background:#f9fafb;font-weight:700;">
         ${td('Total')}${td(zeilen.reduce((s, z) => s + z.anzahl, 0), true)}
         ${td('')}${td(grau(sumKatalog), true)}${td('')}${td('')}${td('')}
         ${td(sumAufwand, true)}
       </tr></tfoot>
     </table>`
    + (ohneWert ? `<div style="padding:8px 14px;font-size:11px;color:#b45309;border-top:1px solid #f0f2f5;">`
        + `${ohneWert} Fundament(e) ohne Leistungswert im Katalog — Spezialtypen sind dort nicht als Position geführt. `
        + `Aufwandswert von Hand setzen.</div>` : '');
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
             summen.fehlend ? summen.fehlend + ' ohne rechenbare Menge' : '')
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
  // Die Spalten kommen aus MASSEN_GROESSEN — eine neue Groesse erscheint
  // damit von selbst in Tabelle, Summenzeile und Verzeichnis.
  const wert = (z, g) => _mkZahl(z[g.id], MASSEN_GANZ.has(g.id) ? 0 : 1);
  el.innerHTML =
    `<table style="width:100%;border-collapse:collapse;font-size:12px;">
       <thead><tr style="background:#f9fafb;">
         <th style="text-align:left;padding:7px 10px;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">${kopf}</th>
         ${MASSEN_GROESSEN.map(g =>
           `<th style="text-align:right;padding:7px 10px;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;">${g.label}<br><span style="font-weight:400;text-transform:none;">${g.einheit}</span></th>`).join('')}
       </tr></thead>
       <tbody>
         ${zeilen.map(z => `<tr>
           ${zelle(escHtml(z.name) + (z.fehlend ? ` <span title="${z.fehlend} Standort(e) ohne rechenbare Menge" style="color:#b45309;">·</span>` : ''))}
           ${MASSEN_GROESSEN.map(g => zelle(wert(z, g), true)).join('')}
         </tr>`).join('')}
       </tbody>
       <tfoot><tr style="background:#f9fafb;font-weight:700;">
         ${zelle('Total')}
         ${MASSEN_GROESSEN.map(g => zelle(wert(summen, g), true)).join('')}
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
       <option value="schicht"${z.herkunft === 'schicht' ? ' selected' : ''}>Anzahl Schichten</option>
       ${MASSEN_GROESSEN.map(g => `<option value="${g.id}"${z.herkunft === g.id ? ' selected' : ''}>${g.label}</option>`).join('')}
     </select>`;

  let total = 0;
  const zeilenHtml = positionen.map(z => {
    const menge  = lvMenge(z, summen);
    const betrag = menge * (z.preis || 0);
    total += betrag;
    const gebunden = z.herkunft === 'schicht' || !!(z.herkunft && summen[z.herkunft] != null);
    return `<tr>
      <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">${eingabe(z.id,'pos',z.pos,'70px')}</td>
      <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;">${eingabe(z.id,'text',z.text,'100%')}</td>
      <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;">${eingabe(z.id,'einheit',z.einheit,'52px')}</td>
      <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;text-align:right;">
        ${gebunden
          ? `<span title="${z.herkunft === 'schicht' ? 'Anzahl Schichten aus den Aufwandswerten' : 'aus dem Massenauszug'}" style="font-variant-numeric:tabular-nums;color:#1a3a5c;font-weight:600;">${_mkZahl(menge, 1)}</span>`
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

// ── Katalog einlesen ─────────────────────────────────────────
// Gelesen wird das Blatt mit den Leistungsbeschrieben. Die Spalten werden
// ueber die Kopfzeile gefunden, nicht ueber feste Buchstaben — die Vorlage
// wird gepflegt, und eine eingeschobene Spalte darf den Import nicht
// stillschweigend verschieben.
//
// Die Schichtleistungen koennen mehrfach nebeneinander stehen (mehrere
// Logistikvarianten mit denselben Stundenueberschriften). Genommen wird die
// erste Gruppe.
function _lkKopfzeileFinden(roh) {
  for (let i = 0; i < Math.min(roh.length, 40); i++) {
    const zeile = roh[i].map(z => String(z || '').toLowerCase());
    if (zeile.some(z => z.includes('leistungsbeschrieb'))) return i;
  }
  return -1;
}

function _lkSpalten(kopf) {
  const norm = kopf.map(z => String(z || '').replace(/\s+/g, ' ').trim().toLowerCase());
  const suche = teil => norm.findIndex(z => z.includes(teil));
  const spalten = {
    id:       norm.findIndex(z => z === 'id'),
    text:     suche('leistungsbeschrieb'),
    einheit:  suche('leistungs-einheit') >= 0 ? suche('leistungs-einheit') : suche('einheit [le]'),
    preis:    suche('einheitspreis'),
  };
  if (spalten.einheit < 0) spalten.einheit = suche('einheit');
  // Erste sechs Spalten mit einer Stundenangabe nach dem Einheitspreis
  spalten.lw = [];
  for (let i = Math.max(0, spalten.preis); i < norm.length && spalten.lw.length < 6; i++) {
    if (/^\d+\s*h$/.test(norm[i])) spalten.lw.push(i);
  }
  return spalten;
}

// Puffer auswerten und ablegen. Getrennt vom Dateifeld, damit dieselbe
// Auswertung auch aus einer anderen Quelle heraus geprueft werden kann.
// Rueckgabe: { positionen, zugeordnet } oder wirft mit Klartext.
function lkKatalogAusPuffer(puffer) {
  const wb = XLSX.read(puffer, { type: 'array' });
  const blattName = wb.SheetNames.find(n => /leistung/i.test(n)) || wb.SheetNames[0];
  const roh = XLSX.utils.sheet_to_json(wb.Sheets[blattName], { header: 1, defval: '' });
  const kopfIndex = _lkKopfzeileFinden(roh);
  if (kopfIndex < 0) throw new Error('Im Blatt «' + blattName + '» fehlt die Kopfzeile mit «Leistungsbeschriebe».');
  const sp = _lkSpalten(roh[kopfIndex]);
  if (sp.text < 0 || sp.lw.length < 6) {
    throw new Error('Kopfzeile erkannt, aber nicht alle Spalten (Beschrieb, Einheitspreis, 4h…9h).');
  }

  const zahl = w => {
    const n = parseFloat(String(w).replace(/'/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  const positionen = [];
  roh.slice(kopfIndex + 1).forEach(z => {
    const id = String(z[sp.id] ?? '').trim();
    if (!id || !/^\d/.test(id)) return;
    const preis = zahl(z[sp.preis]);
    const lw    = sp.lw.map(i => zahl(z[i]));
    if (preis == null && !lw.some(x => x != null)) return;
    positionen.push({
      id,
      text:    String(z[sp.text] ?? '').replace(/\s+/g, ' ').trim(),
      einheit: String(z[sp.einheit] ?? '').trim(),
      preis,
      lw,
    });
  });
  if (!positionen.length) throw new Error('Keine Positionen erkannt.');

  saveLkKatalog({
    stand: new Date().toISOString(),
    region: 'Zürich',
    blatt: blattName,
    positionen,
  });
  return { positionen: positionen.length, zugeordnet: lkLeistungswerteZuweisen() };
}

function lkKatalogImport(input) {
  const datei = input.files?.[0];
  if (!datei) return;
  const leser = new FileReader();
  leser.onload = e => {
    try {
      const { positionen, zugeordnet } = lkKatalogAusPuffer(e.target.result);
      renderMassenView();
      ui.toast(positionen + ' Positionen eingelesen, ' + zugeordnet + ' Typen zugeordnet', 'erfolg');
    } catch (err) {
      ui.toast(err.message, 'fehler');
    }
    input.value = '';
  };
  leser.readAsArrayBuffer(datei);
}

// ── Katalogposition ↔ Fundamenttyp ───────────────────────────
// Der Katalog nennt die Typen im Beschrieb: «Mastfundament DP1a /1.5,
// Kopfhoehe 100 cm …». Verglichen wird wie ueberall ueber Familie und Tiefe
// als Zahl — die Schreibweise ist auch hier uneinheitlich («DP1a /1.5» gegen
// «DP1a / 1.5»).
function _lkTypAusBeschrieb(text) {
  const m = String(text || '').match(/\b([A-Z]{2}\d[a-z])\s*\/\s*(\d+(?:[.,]\d+)?)/);
  return m ? { familie: m[1].toLowerCase(), tiefe: parseFloat(m[2].replace(',', '.')) } : null;
}

// Aus den Schichtleistungen den Aufwandswert herleiten.
//
// Die Katalogzahlen sind kein Zufall: sie entstehen aus einer festen Ruestzeit
// je Schicht und einer Arbeitszeit je Fundament. Traegt man die Intervalldauer
// ueber die Schichtleistung auf, liegen die Punkte auf einer Geraden
//
//     Intervalldauer = Ruestzeit + Aufwandswert × Schichtleistung
//
// Steigung und Achsenabschnitt einer Ausgleichsgeraden liefern damit beide
// Groessen. Fuer DP1a ergibt das rund 0.8 h je Fundament bei 1.8 h Ruestzeit.
// Der Wert ist ein VORSCHLAG — die Katalogzahlen sind ausgehandelte
// Mindestwerte, nicht zwingend die Planungswerte des Anwenders.
function _lwAufwandHerleiten(lw) {
  const punkte = [];
  lw.forEach((wert, i) => {
    if (wert != null && wert > 0) punkte.push({ x: wert, y: LK_INTERVALLE[i] });
  });
  if (punkte.length < 2) return null;
  const n  = punkte.length;
  const mx = punkte.reduce((s, p) => s + p.x, 0) / n;
  const my = punkte.reduce((s, p) => s + p.y, 0) / n;
  const sxy = punkte.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const sxx = punkte.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (!sxx) return null;
  const aufwand = sxy / sxx;
  if (!(aufwand > 0)) return null;
  return { aufwand, ruestzeit: Math.max(0, my - aufwand * mx) };
}

function lkLeistungswerteZuweisen() {
  const katalog = loadLkKatalog();
  if (!katalog) return 0;
  const werte = loadFtLeistungswerte();
  let treffer = 0;
  loadFtProfile().forEach(ft => {
    const gesucht = ftNameZerlegen(ft.name);
    if (!gesucht.familie || Number.isNaN(gesucht.tiefe)) return;
    const pos = katalog.positionen.find(p => {
      if (!p.lw.some(x => x != null)) return false;
      const k = _lkTypAusBeschrieb(p.text);
      return k && k.familie === gesucht.familie && Math.abs(k.tiefe - gesucht.tiefe) < 0.005;
    });
    if (!pos) return;
    const herleitung = _lwAufwandHerleiten(pos.lw);
    // Ein bereits gesetzter eigener Wert bleibt stehen — ein erneuter Import
    // darf die Planungswerte des Anwenders nicht ueberfahren.
    werte[ft.id] = {
      ...(werte[ft.id] || {}),
      lkPos: pos.id, lw: pos.lw, text: pos.text,
      vorschlagH:     herleitung ? Math.round(herleitung.aufwand   * 100) / 100 : null,
      vorschlagRuest: herleitung ? Math.round(herleitung.ruestzeit * 100) / 100 : null,
    };
    treffer++;
  });
  saveFtLeistungswerte(werte);
  return treffer;
}

// Eigener Aufwandswert je Typ. Leer heisst: es gilt der Vorschlag.
function lwEigenSetzen(ftId, feld, roh) {
  const werte = loadFtLeistungswerte();
  if (!werte[ftId]) werte[ftId] = {};
  const n = parseFloat(String(roh).replace(',', '.'));
  if (Number.isFinite(n) && n > 0) werte[ftId][feld] = n;
  else delete werte[ftId][feld];
  saveFtLeistungswerte(werte);
  renderMassenView();
}

// Massgeblicher Wert: eigener vor Vorschlag
function lwAufwand(ftId) {
  const e = loadFtLeistungswerte()[ftId];
  return e?.eigenH ?? e?.vorschlagH ?? null;
}
function lwRuestzeit(ftId) {
  const e = loadFtLeistungswerte()[ftId];
  return e?.eigenRuest ?? e?.vorschlagRuest ?? null;
}

// Leistungswert eines Typs bei der gewaehlten Intervalldauer
function lkLeistungswert(ftId, stunden) {
  const e = loadFtLeistungswerte()[ftId];
  if (!e) return null;
  const i = LK_INTERVALLE.indexOf(stunden ?? lkIntervall());
  return i < 0 ? null : (e.lw[i] ?? null);
}

// Gegenueberstellung: Schichten nach Katalog gegen Schichten nach der
// Ausfuehrungsdauer der Typenbibliothek. Beides je Fundamenttyp, damit der
// Unterschied sichtbar wird, bevor jemand danach plant.
function lkVergleich() {
  const stunden   = lkIntervall();
  const ftProfile = loadFtProfile();
  const allBp     = loadAllBauprojekt();
  const lps       = typeof loadLeistungsprofile === 'function' ? loadLeistungsprofile() : [];
  const proTyp    = new Map();

  getFundamente().forEach(p => {
    const bp = { ...p, ...(allBp[p.id] || {}) };
    const ft = ftTypZuStandort(ftProfile, bp);
    const schluessel = ft?.id || ('_' + (bp.fundtyp || 'ohne'));
    if (!proTyp.has(schluessel)) {
      proTyp.set(schluessel, { name: ft?.name || bp.fundtyp || '— kein Typ —', ft, anzahl: 0 });
    }
    proTyp.get(schluessel).anzahl++;
  });

  return [...proTyp.values()].map(z => {
    const ftId = z.ft?.id;
    const eintrag = ftId ? (loadFtLeistungswerte()[ftId] || {}) : {};
    const lw      = ftId ? lkLeistungswert(ftId, stunden) : null;
    const aufwand = ftId ? lwAufwand(ftId)   : null;
    const ruest   = ftId ? lwRuestzeit(ftId) : null;

    // Schichten aus dem Aufwandswert. Die Ruestzeit faellt in JEDER Schicht
    // an, nicht einmal je Baustelle — deshalb wird sie von der Intervalldauer
    // abgezogen und nicht zur Arbeitszeit addiert.
    const netto = (aufwand != null) ? stunden - (ruest || 0) : null;
    const schichtenAufwand = (netto && netto > 0)
      ? Math.ceil(z.anzahl * aufwand / netto) : null;

    return {
      name: z.name,
      ftId,
      anzahl: z.anzahl,
      lw,
      schichtenKatalog: lw ? Math.ceil(z.anzahl / lw) : null,
      vorschlagH:     eintrag.vorschlagH ?? null,
      vorschlagRuest: eintrag.vorschlagRuest ?? null,
      eigenH:         eintrag.eigenH ?? null,
      eigenRuest:     eintrag.eigenRuest ?? null,
      aufwand, ruest,
      schichtenAufwand,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

// ── Katalog und Leistungswerte ausgeben ──────────────────────
// Damit Preise und Leistungswerte in Excel gepflegt und wieder eingelesen
// werden koennen — dieselben Spaltennamen wie beim Einlesen.
function lkKatalogExport() {
  const katalog = loadLkKatalog();
  if (!katalog) { ui.toast('Noch kein Katalog eingelesen.', 'fehler'); return; }
  const kopf = ['ID', 'Leistungsbeschriebe', 'Leistungs-einheit [LE]', 'Einheitspreis [CHF/LE]']
    .concat(LK_INTERVALLE.map(h => h + 'h'));
  const zeilen = [kopf].concat(katalog.positionen.map(p =>
    [p.id, p.text, p.einheit, p.preis].concat(p.lw)));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(zeilen), 'Leistungskatalog');
  XLSX.writeFile(wb, 'Leistungskatalog.xlsx');
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
