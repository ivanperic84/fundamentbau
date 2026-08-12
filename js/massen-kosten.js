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
  // Die Dauer steht an zwei Stellen — im Kopf der Tabelle und im
  // Einstellungsfenster; die zweite muss nachziehen.
  if (document.getElementById('mk-einst-modal')?.style.display === 'flex') _mkParameterTab();
}

// Groessen, die der Massenauszug kennt. Die Einheit steht hier, damit sie in
// Tabelle und Verzeichnis dieselbe ist.
const MASSEN_GROESSEN = [
  { id: 'anzahl',     label: 'Fundamente',        einheit: 'Stk' },
  { id: 'beton',      label: 'Beton',             einheit: 'm³'  },
  { id: 'aushub',     label: 'Aushub',            einheit: 'm³'  },
  { id: 'schalung',   label: 'Schalung',          einheit: 'm²'  },
  { id: 'buegel',     label: 'Bügel',             einheit: 'Stk',
    hinweis: 'Bügel je Fundament aus der Typenbibliothek — dieselbe Stückzahl, die die Materialliste je Artikelnummer führt' },
  { id: 'bewehrung',  label: 'Bewehrung',         einheit: 'kg',
    hinweis: 'Bewehrungsgewicht je Fundament, am Fundamenttyp hinterlegt — nicht aus dem Betonvolumen geschätzt' },
  // Materiell Teil der Bewehrung, abgerechnet aber nach Stueck
  { id: 'schraub',    label: 'Schrauben',         einheit: 'Stk',
    hinweis: 'Fundamentschrauben — materiell Teil der Bewehrung, abgerechnet nach Stück' },
  { id: 'fixierung',  label: 'Fixierung',         einheit: 'Stk',
    hinweis: 'Flacheisen zur Fixierung der Fundamentschrauben unten, je Fundamentfamilie — gleiche Quelle wie die Materialliste' },
  { id: 'vfk',        label: 'VFK',               einheit: 'Stk',
    hinweis: 'Fundamente mit vorgefertigtem Fundamentkopf (Zeichnungs-Nr. am Typ hinterlegt)' },
  // Pfaehle werden nach Stueck und Bohrmeter abgerechnet, nicht nach Volumen
  { id: 'pfahlStk',   label: 'Pfähle',            einheit: 'Stk' },
  { id: 'pfahlMeter', label: 'Pfahllänge',        einheit: 'm'   },
  // Verankerung in Fels und Befestigung an Mauer: dort fuehren dieselben
  // Schraubenfelder des Typs die Anker, nicht die Fundamentschrauben.
  { id: 'ankerStk',   label: 'Anker',             einheit: 'Stk' },
  { id: 'ankerMeter', label: 'Ankerlänge',        einheit: 'm'   },
];

// Spalten, die nur erscheinen, wenn sie eine Menge tragen. Pfahl- und
// Ankerangaben betreffen wenige Projekte; leer mitgeschleppt kosten sie in
// der Tabelle nur Breite. «Fundamente» bleibt immer stehen.
const _mkSpaltenSichtbar = (summen) =>
  MASSEN_GROESSEN.filter(g => g.id === 'anzahl' || (Number(summen[g.id]) || 0) > 0);

// Groessen, die als ganze Zahl angeschrieben werden
const MASSEN_GANZ = new Set(['anzahl', 'schraub', 'pfahlStk', 'buegel',
                             'ankerStk', 'fixierung', 'vfk', 'bewehrung']);

// ── Groessen, an die sich eine Position binden laesst ────────
// Die drei Schichtzahlen und alles, was der Massenauszug fuehrt. Dieselbe
// Liste bedient das Auswahlfeld im Verzeichnis, das in der Datenbank und die
// Spalte «Menge aus» beim Ein- und Auslesen — sonst liefen die drei
// auseinander.
const MK_HERKUENFTE = [
  { id: 'schicht',        label: 'Anzahl Schichten' },
  { id: 'schichtNacht',   label: 'Schichten Nacht' },
  { id: 'schichtSonntag', label: 'Schichten Sonntag' },
  { id: 'stunden',        label: 'Verrechnete Stunden' },
  { id: 'stundenNacht',   label: 'Verrechnete Stunden Nacht' },
  { id: 'stundenSonntag', label: 'Verrechnete Stunden Sonntag' },
  { id: 'installation',   label: '% der Bausumme' },
  ...MASSEN_GROESSEN.map(g => ({ id: g.id, label: g.label })),
];

const mkHerkunftLabel = id => MK_HERKUENFTE.find(h => h.id === id)?.label || '';

// Beim Einlesen wird die Beschriftung erkannt, die beim Auslesen geschrieben
// wurde — und ebenso die interne Kennung, falls jemand sie eintraegt.
function mkHerkunftId(wert) {
  const w = String(wert || '').trim().toLowerCase();
  if (!w) return '';
  return MK_HERKUENFTE.find(h => h.label.toLowerCase() === w || h.id.toLowerCase() === w)?.id || '';
}

function _mkHerkunftOptionen(aktiv) {
  return '<option value="">von Hand</option>'
    + MK_HERKUENFTE.map(h =>
        `<option value="${h.id}"${aktiv === h.id ? ' selected' : ''}>${h.label}</option>`).join('');
}

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

// Verrechnete Stunden je Schicht. Im Gleistiefbau rechnet der Baumeister eine
// GANZE Schicht ab — ueblich acht Stunden — auch wenn das Sperrintervall nur
// ein paar Stunden dauert; dasselbe gilt fuer Maschinen und Geraete. Die
// Nettodauer des Sperrmusters bestimmt, wie viel in einer Schicht geschafft
// wird. Was die Schicht KOSTET, bestimmt sie nicht.
function mkStundenJeSchicht() {
  const n = Number(loadMkEinstellungen().stundenJeSchicht);
  return Number.isFinite(n) && n > 0 ? n : 8;
}
function saveMkEinstellungen(e) {
  store.setItem(LV_EINST_KEY(), JSON.stringify(e));
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

// Die Mengen je Fundament stehen in js/fundament-mengen.js — dieselbe Quelle,
// aus der die Materialliste ihr Material zieht. Hier wird nur summiert.

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
      const leer = { name: schluessel, fehlend: 0, maengel: new Set() };
      MASSEN_GROESSEN.forEach(g => { leer[g.id] = 0; });
      gruppen.set(schluessel, leer);
    }
    const g = gruppen.get(schluessel);
    g.anzahl++;
    const d = fmMengen(eintrag);
    // Markiert wird jede Gruppe, deren Typ nicht vollstaendig hinterlegt ist —
    // und jeder Standort ohne Typ aus der Bibliothek. Beides fuehrt dazu, dass
    // im Auszug eine Menge fehlt, und das darf nicht stillschweigend passieren.
    if (!d) {
      g.fehlend++;
      g.maengel.add('kein Fundamenttyp aus der Bibliothek');
    } else {
      if (d.fehlend.length) { g.fehlend++; d.fehlend.forEach(f => g.maengel.add(f)); }
      MASSEN_GROESSEN.forEach(({ id }) => {
        if (id !== 'anzahl' && d[id] != null) g[id] += d[id];
      });
    }
  });

  return [...gruppen.values()]
    .map(g => ({ ...g, maengel: [...g.maengel] }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
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
      herkunft: '',
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

// Auswahlfeld: Positionen der Vorlage ins Verzeichnis uebernehmen. Gezeigt
// werden Nummer, ganzer Beschrieb, Einheit und Einheitspreis — die Auswahl
// faellt am Preis, nicht an der Positionsnummer.
function _lvVorlageZeilen(filter) {
  const vorlage = loadLvVorlage();
  const drin = new Set(loadLvPositionen().map(z => z.pos));
  const such = String(filter || '').trim().toLowerCase();
  const treffer = vorlage
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => !such || (v.pos + ' ' + v.text).toLowerCase().includes(such));

  if (!treffer.length) {
    return '<div style="padding:14px;text-align:center;font-size:11px;color:#9ca3af;">Kein Treffer</div>';
  }
  return treffer.map(({ v, i }) => {
    const belegt = drin.has(v.pos);
    return `<button onclick="lvAusVorlage(${i})" ${belegt ? 'disabled' : ''}
        title="${belegt ? 'bereits im Verzeichnis' : 'ins Verzeichnis übernehmen'}"
        style="display:flex;gap:8px;align-items:baseline;width:100%;text-align:left;padding:5px 7px;
               border:none;border-radius:6px;background:none;font-size:11px;font-family:inherit;
               cursor:${belegt ? 'default' : 'pointer'};color:${belegt ? '#c7cdd4' : '#374151'};"
        onmouseover="if(!this.disabled)this.style.background='#f3f4f6'" onmouseout="this.style.background='none'">
        <span style="font-variant-numeric:tabular-nums;color:${belegt ? '#dde1e6' : '#9ca3af'};flex:0 0 82px;">${escHtml(v.pos)}</span>
        <span style="flex:1 1 auto;line-height:1.35;">${escHtml(v.text)}</span>
        <span style="flex:0 0 34px;color:#9ca3af;">${escHtml(v.einheit || '')}</span>
        <span style="flex:0 0 76px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">${
          v.preis != null ? _mkZahl(v.preis) : '<span style="font-weight:400;color:#c7cdd4;">kein Preis</span>'}</span>
      </button>`;
  }).join('');
}

function lvVorlageFiltern(wert) {
  const liste = document.getElementById('mk-vorlage-liste');
  if (liste) liste.innerHTML = _lvVorlageZeilen(wert);
}

function lvVorlagePanelUmschalten(ev) {
  if (ev) ev.stopPropagation();
  const panel = document.getElementById('mk-vorlage-panel');
  if (!panel) return;
  if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
  if (!loadLvVorlage().length) {
    ui.toast('Noch keine Vorlage eingelesen — «Positionen einlesen».', 'fehler');
    return;
  }
  panel.innerHTML =
    '<div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:8px;">Position übernehmen</div>'
    + `<input id="mk-vorlage-suche" type="text" placeholder="Nummer oder Beschrieb"
             oninput="lvVorlageFiltern(this.value)"
             style="width:100%;padding:5px 8px;margin-bottom:8px;border:1px solid #e5e7eb;border-radius:6px;
                    font-size:11px;font-family:inherit;">`
    + `<div style="display:flex;gap:8px;padding:0 7px 4px;font-size:10px;color:#9ca3af;
                   text-transform:uppercase;letter-spacing:.05em;">
         <span style="flex:0 0 82px;">Pos.</span><span style="flex:1 1 auto;">Bezeichnung</span>
         <span style="flex:0 0 34px;">LE</span><span style="flex:0 0 76px;text-align:right;">Preis</span>
       </div>`
    + `<div id="mk-vorlage-liste" style="max-height:340px;overflow-y:auto;">${_lvVorlageZeilen('')}</div>`;
  panel.style.display = 'block';
  const knopf = document.getElementById('mk-vorlage-btn')?.getBoundingClientRect();
  if (knopf) {
    const breite = panel.getBoundingClientRect().width;
    panel.style.top  = (knopf.bottom + 6) + 'px';
    panel.style.left = Math.max(8, Math.min(knopf.right - breite, window.innerWidth - breite - 8)) + 'px';
  }
  document.getElementById('mk-vorlage-suche')?.focus();
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
//   'schicht'          Anzahl Schichten (Bauleitung, Sicherung, Maschinen)
//   'schichtNacht'     nur die Schichten im Nachtfenster (Nachtzuschlag)
//   'schichtSonntag'   nur die Schichten an Sonntagen (Sonntagszuschlag)
//   <Groesse>   eine Groesse des Massenauszugs
// Herkuenfte, die an der Schichtzahl haengen, samt Erklaerung fuer die Zeile
const MK_SCHICHT_HERKUNFT = {
  schicht:        'Anzahl Schichten',
  schichtNacht:   'Schichten im Nachtfenster',
  schichtSonntag: 'Schichten an Sonntagen',
  stunden:        'Verrechnete Stunden',
  stundenNacht:   'Verrechnete Stunden im Nachtfenster',
  stundenSonntag: 'Verrechnete Stunden an Sonntagen',
};

// teamId bindet die Zeile an ein Los, faktor ist die Anzahl — zwei Polier auf
// derselben Schicht sind zwei mal acht Stunden. Beide stehen nur an Zeilen,
// die aus der Besetzung erzeugt wurden.
// Der Preis einer Zeile. Nur die Installation hat einen gerechneten: sie ist
// ein Anteil der Bausumme und keine Zahl, die jemand einträgt.
function lvPreis(zeile, instBetrag) {
  return zeile.herkunft === 'installation' ? (instBetrag || 0) : (zeile.preis || 0);
}

function lvMenge(zeile, summen) {
  if (zeile.herkunft === 'installation') return 1;
  const f = zeile.faktor > 0 ? zeile.faktor : 1;
  if (MK_SCHICHT_HERKUNFT[zeile.herkunft]) {
    const a  = zeile.teamId ? schichtenAufteilung(zeile.teamId) : schichtenAufteilung();
    const nr = zeile.herkunft.endsWith('Nacht')   ? a.nacht
             : zeile.herkunft.endsWith('Sonntag') ? a.sonntag
             : (zeile.teamId ? a.total : schichtenGesamt());
    return nr * f * (zeile.herkunft.startsWith('stunden') ? mkStundenJeSchicht() : 1);
  }
  if (zeile.herkunft && summen[zeile.herkunft] != null) return summen[zeile.herkunft];
  return zeile.menge || 0;
}

// Anzahl Schichten — die Groesse, an der die zeitabhaengigen Positionen
// haengen. Massgebend ist das BAUPROGRAMM, sobald Baupakete terminiert sind:
// dort steckt der Abzug fuer Installation und Anfahrt und die Nettodauer des
// Sperrmusters, und ein Bauprogramm muss ohnehin vorgaengig gerechnet werden.
// Die Rechnung aus den Aufwandswerten ist der Vorgriff darauf, solange kein
// Programm steht.
function schichtenBauprogramm() {
  const pakete = typeof loadBaupakete === 'function' ? loadBaupakete() : [];
  const n = pakete.reduce((s, p) => s + (Number(p.anzahlNaechte) || 0), 0);
  return n > 0 ? n : null;
}

// Aufteilung der Schichten nach Zuschlagsgrund. Die Zuschlaege sind eigene
// Positionen mit eigenem Preis — sie haengen aber nicht an ALLEN Schichten:
// der Nachtzuschlag an denen im Nachtfenster, der Sonntagszuschlag an den
// Schichten, die auf einen Sonntag fallen. Beides steht im Bauprogramm; hier
// wird nur gezaehlt.
//
// Nacht heisst: das Sperrmuster beginnt ab 18 Uhr oder endet bis 08 Uhr.
// teamId grenzt auf die Baupakete EINES Loses ein — dafuer, dass Mannschaft
// und Geraete je Los abgerechnet werden und nicht ueber das ganze Projekt.
function schichtenAufteilung(teamId) {
  const alle   = typeof loadBaupakete === 'function' ? loadBaupakete() : [];
  const pakete = teamId ? alle.filter(p => p.teamId === teamId) : alle;
  const muster = typeof loadSperrmuster === 'function' ? loadSperrmuster() : [];
  const aufteilung = { total: 0, nacht: 0, sonntag: 0 };

  // Ohne Bauprogramm — oder wenn bewusst ohne gerechnet wird — gibt es keine
  // Termine und damit keine Wochentage. Dann gelten alle Schichten als
  // Nachtschichten, weil in der Sperrpause gearbeitet wird; Sonntage bleiben
  // bei null, denn geraten wird nicht.
  if (!pakete.length || mkSchichtQuelle() !== 'auto') {
    // Ein Los laesst sich ohne Bauprogramm nicht heraustrennen: die
    // Schichtzahl von Hand gilt dem ganzen Projekt. Sie hier auszuweisen
    // wuerde sie mit jedem weiteren Los ein zweites Mal verrechnen.
    if (teamId) return { total: 0, nacht: 0, sonntag: 0, ohneTermine: true };
    const n = schichtenGesamt();
    return { total: n, nacht: n, sonntag: 0, ohneTermine: true };
  }
  if (typeof bpGetSchichten !== 'function') return aufteilung;

  const istNacht = sp => {
    const von = parseInt(String(sp?.von || '').split(':')[0], 10);
    const bis = parseInt(String(sp?.bis || '').split(':')[0], 10);
    return (Number.isFinite(von) && von >= 18) || (Number.isFinite(bis) && bis <= 8);
  };

  pakete.forEach(pak => {
    (bpGetSchichten(pak) || []).forEach(s => {
      aufteilung.total++;
      const sp = muster.find(m => m.id === s.spId);
      if (istNacht(sp)) aufteilung.nacht++;
      const d = new Date(s.datum + 'T00:00:00');
      if (d.getDay() === 0) aufteilung.sonntag++;
    });
  });
  return aufteilung;
}

function schichtenAufwandGesamt() {
  return lkVergleich().reduce((s, z) => s + (z.schichtenAufwand || 0), 0);
}

// Woher die Schichten kommen sollen. 'auto' nimmt das Bauprogramm, sobald es
// steht — wer frueh schaetzt oder eine Variante ohne Programm rechnet, stellt
// auf 'aufwand' und bleibt bei den Aufwandswerten. 'hand' setzt die Zahl
// direkt: fuer die Offerte, bei der die Schichtzahl vorgegeben ist.
const MK_SCHICHT_QUELLE_KEY = () => 'sp_mk_schichtquelle__' + _activeId;
const MK_SCHICHT_HAND_KEY   = () => 'sp_mk_schichthand__' + _activeId;

function mkSchichtQuelle() {
  const q = store.getItem(MK_SCHICHT_QUELLE_KEY());
  return ['auto', 'aufwand', 'hand'].includes(q) ? q : 'auto';
}

function mkSchichtQuelleSetzen(wert) {
  store.setItem(MK_SCHICHT_QUELLE_KEY(), wert);
  renderMassenView();
  if (document.getElementById('mk-einst-modal')?.style.display === 'flex') _mkParameterTab();
}

function mkSchichtHand() {
  const n = parseFloat(store.getItem(MK_SCHICHT_HAND_KEY()));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function mkSchichtHandSetzen(wert) {
  const n = parseFloat(String(wert).replace(',', '.'));
  if (Number.isFinite(n) && n > 0) store.setItem(MK_SCHICHT_HAND_KEY(), String(n));
  else store.removeItem(MK_SCHICHT_HAND_KEY());
  renderMassenView();
}

function schichtenGesamt() {
  const quelle = mkSchichtQuelle();
  if (quelle === 'hand')    return mkSchichtHand();
  if (quelle === 'aufwand') return schichtenAufwandGesamt();
  return schichtenBauprogramm() ?? schichtenAufwandGesamt();
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
  // Ohne Katalog bleibt die Tabelle bedienbar: die Aufwandswerte darf der
  // Anwender von Hand setzen, der Katalog liefert nur den Vorschlag dazu.
  const zeilen = lkVergleich();
  if (!zeilen.length) {
    el.innerHTML = '<div style="padding:22px;text-align:center;font-size:12px;color:#9ca3af;line-height:1.6;">'
      + 'Noch keine Fundamenttypen zugewiesen<br>'
      + '<span style="font-size:11px;">Die Aufwandswerte hängen an den Typen der Standorte.</span></div>';
    return;
  }
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
    + _mkSchichtQuelle(sumAufwand)
    + (ohneWert ? `<div style="padding:8px 14px;font-size:11px;color:#b45309;border-top:1px solid #f0f2f5;">`
        + `${ohneWert} Fundament(e) ohne Leistungswert im Katalog — Spezialtypen sind dort nicht als Position geführt. `
        + `Aufwandswert von Hand setzen.</div>` : '');
}

// Woher die Schichten kommen, die das Verzeichnis verrechnet. Der Unterschied
// gehoert offen hingeschrieben: aus dem Bauprogramm ist es die terminierte
// Zahl, aus den Aufwandswerten die geschaetzte.
function _mkSchichtQuelle(sumAufwand) {
  const bp     = schichtenBauprogramm();
  const quelle = mkSchichtQuelle();
  const abzug  = mkAbzugStunden();
  const abzugText = abzug ? ` · Abzug Installation und Anfahrt ${_mkZahl(abzug * 60, 0)} min je Schicht` : '';
  const woher = {
    hand:    `<b>${mkSchichtHand()} Schichten von Hand</b>`,
    aufwand: `<b>${sumAufwand} Schichten aus den Aufwandswerten</b> — das Bauprogramm bleibt aussen vor`,
    auto:    bp != null
      ? `<b>${bp} Schichten aus dem Bauprogramm</b> (${sumAufwand} aus den Aufwandswerten)`
      : `<b>${sumAufwand} Schichten aus den Aufwandswerten</b> — sobald Baupakete terminiert sind, gilt das Bauprogramm`,
  }[quelle];
  return `<div style="padding:8px 14px;font-size:11px;color:#6b7280;border-top:1px solid #f0f2f5;">`
    + `Massgebend für das Verzeichnis: ${woher}${abzugText}`
    + ` · <a onclick="mkModalOeffnen('parameter')" style="color:#1a3a5c;cursor:pointer;text-decoration:underline;">ändern</a>`
    + '</div>';
}

function _mkKennzahlen(summen, zeilen) {
  const box = document.getElementById('mk-kennzahlen');
  if (!box) return;
  // warnung steht in Bernstein, zusatz in Grau: eine Aufteilung ist keine
  // Beanstandung und darf nicht aussehen wie eine.
  const kachel = (wert, label, warnung, zusatz) =>
    `<div style="background:white;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;">
       <div style="font-size:17px;font-weight:700;color:#1a3a5c;line-height:1.2;">${wert}</div>
       <div style="font-size:10px;color:#6b7280;margin-top:2px;">${escHtml(label)}</div>
       ${warnung ? `<div style="font-size:10px;color:#b45309;margin-top:3px;">${escHtml(warnung)}</div>` : ''}
       ${zusatz  ? `<div style="font-size:10px;color:#9ca3af;margin-top:3px;">${escHtml(zusatz)}</div>` : ''}
     </div>`;

  // Die Schichten stehen vorn: im Gleistiefbau haengen die Kosten an ihnen und
  // an den Stunden, die je Schicht verrechnet werden — nicht an der Kubatur.
  const auft = schichtenAufteilung();
  const jeSch = mkStundenJeSchicht();
  const auf = [auft.nacht ? auft.nacht + ' Nacht' : '',
               auft.sonntag ? auft.sonntag + ' Sonntag' : ''].filter(Boolean).join(' · ');
  box.innerHTML =
      kachel(auft.total, 'Schichten', '', auf)
    + kachel(_mkZahl(auft.total * jeSch, 0) + ' h', 'Verrechnete Stunden', '', jeSch + ' h je Schicht')
    + kachel(summen.anzahl, 'Fundamente',
             summen.fehlend ? summen.fehlend + ' ohne rechenbare Menge' : '')
    + kachel(_mkZahl(summen.beton, 1) + ' m³', 'Beton', '', zeilen.length + ' Gruppen im Auszug')
    + kachel(_mkZahl(summen.aushub, 1) + ' m³', 'Aushub');
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
  const spalten = _mkSpaltenSichtbar(summen);
  const weg = MASSEN_GROESSEN.filter(g => !spalten.includes(g)).map(g => g.label);
  el.innerHTML =
    `<table style="width:100%;border-collapse:collapse;font-size:12px;">
       <thead><tr style="background:#f9fafb;">
         <th style="text-align:left;padding:7px 10px;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">${kopf}</th>
         ${spalten.map(g =>
           `<th ${g.hinweis ? `title="${escHtml(g.hinweis)}"` : ''} style="text-align:right;padding:7px 10px;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;">${g.label}<br><span style="font-weight:400;text-transform:none;">${g.einheit}</span></th>`).join('')}
       </tr></thead>
       <tbody>
         ${zeilen.map(z => `<tr${z.fehlend ? ' style="background:#fffbeb;"' : ''}>
           ${zelle(escHtml(z.name) + (z.fehlend ? _mkMangelZeichen(z) : ''))}
           ${spalten.map(g => zelle(wert(z, g), true)).join('')}
         </tr>`).join('')}
       </tbody>
       <tfoot><tr style="background:#f9fafb;font-weight:700;">
         ${zelle('Total')}
         ${spalten.map(g => zelle(wert(summen, g), true)).join('')}
       </tr></tfoot>
     </table>`
    + _mkMangelHinweis(zeilen)
    + (weg.length ? `<div style="padding:7px 12px;font-size:10px;color:#9ca3af;border-top:1px solid #f0f2f5;">`
        + `Ohne Menge, deshalb ausgeblendet: ${escHtml(weg.join(', '))}</div>` : '');
}

// Markierung unvollstaendiger Positionen. Was der Typ nicht traegt, kann der
// Auszug nicht rechnen — das gehoert an die Zeile geschrieben und nicht in
// eine stille Null.
function _mkMangelZeichen(z) {
  const was = z.maengel?.length ? z.maengel.join(', ') : 'unvollständig';
  return ` <span title="${escHtml(z.fehlend + ' Standort(e): ' + was)}"
      style="display:inline-block;padding:0 5px;border:1px solid #fcd34d;border-radius:4px;
             background:#fef3c7;color:#92400e;font-size:9px;font-weight:700;
             vertical-align:middle;">${z.fehlend}</span>`;
}

function _mkMangelHinweis(zeilen) {
  const betroffen = zeilen.filter(z => z.fehlend);
  if (!betroffen.length) return '';
  return `<div style="padding:8px 12px;font-size:11px;color:#92400e;background:#fffbeb;
               border-top:1px solid #fde68a;line-height:1.6;">
      <b>Unvollständige Fundamenttypen</b> — die fehlenden Mengen sind nicht geschätzt, sondern nicht enthalten:<br>`
    + betroffen.map(z =>
        `<span style="color:#78350f;">${escHtml(z.name)}</span>
         <span style="color:#b45309;">(${z.fehlend}×): ${escHtml(z.maengel.join(', '))}</span>`)
        .join('<br>')
    + `<br><span style="font-size:10px;color:#b45309;">Ergänzen im Fundamenttyp-Modul — der Auszug rechnet ausschliesslich von dort.</span></div>`;
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
    _mkInstBasis(new Map());
    _mkSummenZeile(0);
    return;
  }

  const eingabe = (id, feld, wert, breite, art) =>
    `<input value="${escHtml(String(wert ?? ''))}" ${art === 'zahl' ? 'type="number" step="0.01"' : 'type="text"'}
            onchange="lvFeldSpeichern('${id}','${feld}',this.value)"
            style="width:${breite};padding:4px 6px;border:1px solid transparent;border-radius:5px;font-size:12px;font-family:inherit;background:transparent;${art === 'zahl' ? 'text-align:right;font-variant-numeric:tabular-nums;' : ''}"
            onfocus="this.style.borderColor='#d1d5db';this.style.background='white'"
            onblur="this.style.borderColor='transparent';this.style.background='transparent'">`;

  // Zeilen aus der Besetzung haengen an einem Los und einer Anzahl. Ein
  // Auswahlfeld waere hier irrefuehrend: geaendert wird die Besetzung, nicht
  // die Zeile — sonst liefe der naechste Lauf gegen die Handaenderung.
  const teamName = id => ((typeof loadProjEinst === 'function' ? loadProjEinst().teams : null) || [])
                           .find(t => t.id === id)?.name || 'Los';
  const herkunftWahl = (z) => z.quelle === 'besetzung'
    ? `<span title="Aus der Besetzung von ${escHtml(teamName(z.teamId))} — dort ändern"
             style="font-size:11px;color:#6b7280;white-space:nowrap;">${escHtml(mkHerkunftLabel(z.herkunft))}${
               z.faktor > 1 ? ' × ' + z.faktor : ''}</span>`
    : `<select onchange="lvFeldSpeichern('${z.id}','herkunft',this.value)"
             title="Menge aus dem Massenauszug übernehmen"
             style="padding:3px 5px;border:1px solid #e5e7eb;border-radius:5px;font-size:11px;font-family:inherit;background:white;">
       ${_mkHerkunftOptionen(z.herkunft)}
     </select>`;

  const zeileHtml = (z, menge, betrag, instBetrag) => {
    const gebunden = MK_SCHICHT_HERKUNFT[z.herkunft] || z.herkunft === 'installation'
                     || !!(z.herkunft && summen[z.herkunft] != null);
    // Der Preis der Installation folgt der Bausumme — er wird gerechnet, nicht
    // eingegeben. Ein Eingabefeld daneben waere eine Einladung zum Widerspruch.
    const preisFeld = z.herkunft === 'installation'
      ? `<span title="${_mkZahl(mkInstProzent(), 1)} % der Bausumme" style="font-variant-numeric:tabular-nums;color:#1a3a5c;font-weight:600;">${_mkZahl(instBetrag)}</span>`
      : eingabe(z.id, 'preis', z.preis, '90px', 'zahl');
    return `<tr>
      <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">${eingabe(z.id,'pos',z.pos,'70px')}</td>
      <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;">${eingabe(z.id,'text',z.text,'100%')}</td>
      <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;">${eingabe(z.id,'einheit',z.einheit,'52px')}</td>
      <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;text-align:right;">
        ${gebunden
          ? `<span title="${MK_SCHICHT_HERKUNFT[z.herkunft] || 'aus dem Massenauszug'}" style="font-variant-numeric:tabular-nums;color:#1a3a5c;font-weight:600;">${_mkZahl(menge, 1)}</span>`
          : eingabe(z.id,'menge',z.menge,'80px','zahl')}</td>
      <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;">${herkunftWahl(z)}</td>
      <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;text-align:right;">${preisFeld}</td>
      <td style="padding:4px 10px;border-bottom:1px solid #f3f4f6;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">${_mkZahl(betrag)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #f3f4f6;">
        <button onclick="lvZeileLoeschen('${z.id}')" title="Position löschen"
          style="border:none;background:none;cursor:pointer;color:#9ca3af;padding:2px;display:flex;align-items:center;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button></td>
    </tr>`;
  };

  // ERSTER DURCHGANG: die Abschnittssummen, aus denen sich die Installation
  // bemisst. Die Installationszeilen selbst bleiben aussen vor — ihr Betrag
  // steht erst fest, wenn die Basis steht, und er darf nicht in sie eingehen.
  const abschnitte = new Map();
  positionen.forEach(z => {
    if (z.herkunft === 'installation') return;
    const g = _lvGruppe(z.pos);
    if (!abschnitte.has(g.abschnitt)) abschnitte.set(g.abschnitt, { summe: 0, anzahl: 0 });
    const a = abschnitte.get(g.abschnitt);
    a.summe += lvMenge(z, summen) * (z.preis || 0);
    a.anzahl++;
  });
  const instBetrag = mkInstBasisSumme(abschnitte) * mkInstProzent() / 100;

  // Nach Kapitel gruppiert — die ersten drei Ziffern der Positionsnummer.
  // Die Zwischensumme je Kapitel ist die Groesse, die in der Zusammenstellung
  // gebraucht wird; die Abschnitte darunter tragen die Installationsbasis.
  const gruppen = new Map();
  let total = 0;
  positionen.forEach(z => {
    const menge  = lvMenge(z, summen);
    const betrag = menge * lvPreis(z, instBetrag);
    total += betrag;
    const g = _lvGruppe(z.pos);
    if (!gruppen.has(g.kapitel)) gruppen.set(g.kapitel, { summe: 0, zeilen: [] });
    const eintrag = gruppen.get(g.kapitel);
    eintrag.summe += betrag;
    eintrag.zeilen.push(zeileHtml(z, menge, betrag, instBetrag));
  });

  const sortiert = [...gruppen.keys()].sort((a, b) =>
    (a === '—') - (b === '—') || Number(a) - Number(b));
  const koerper = gruppen.size < 2
    ? sortiert.map(k => gruppen.get(k).zeilen.join('')).join('')
    : sortiert.map(k => {
        const g = gruppen.get(k);
        return `<tr style="background:#f9fafb;">
            <td colspan="8" style="padding:6px 10px;font-size:10px;font-weight:700;color:#374151;
                text-transform:uppercase;letter-spacing:.05em;border-top:1px solid #e5e7eb;">Gruppe ${escHtml(k)}</td>
          </tr>`
          + g.zeilen.join('')
          + `<tr>
              <td colspan="6" style="padding:5px 10px;text-align:right;font-size:11px;color:#6b7280;
                  border-bottom:1px solid #e5e7eb;">Zwischensumme ${escHtml(k)}</td>
              <td style="padding:5px 10px;text-align:right;font-variant-numeric:tabular-nums;font-weight:700;
                  border-bottom:1px solid #e5e7eb;">${_mkZahl(g.summe)}</td>
              <td style="border-bottom:1px solid #e5e7eb;"></td>
            </tr>`;
      }).join('');

  const th = (t, rechts) =>
    `<th style="text-align:${rechts ? 'right' : 'left'};padding:7px 10px;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;">${t}</th>`;
  el.innerHTML =
    `<table style="width:100%;border-collapse:collapse;font-size:12px;">
       <thead><tr style="background:#f9fafb;">
         ${th('Pos.')}${th('Bezeichnung')}${th('Einheit')}${th('Menge', true)}${th('Menge aus')}${th('Einheitspreis', true)}${th('Betrag', true)}${th('')}
       </tr></thead>
       <tbody>${koerper}</tbody>
     </table>`;
  _mkInstBasis(abschnitte);
  _mkSummenZeile(total, summen.anzahl);
}

// ── Basis der Baustelleninstallation ─────────────────────────
// Die Installation wird nicht frei geschaetzt, sondern aus den uebrigen
// Baukosten hergeleitet. Nicht alles zaehlt dazu: die Installation selbst
// nicht, das Personal und die Sicherheitsausruestung ebenfalls nicht — sonst
// bemaesse sich die Installation an sich selbst. Der Anwender kann jeden
// Abschnitt zu- und abwaehlen; die Vorgabe folgt der ueblichen Abgrenzung.
const LV_INST_KEY = () => 'sp_lv_instbasis__' + _activeId;
const INST_AUS_VORGABE = ['100.100', '100.200', '100.600'];

function loadInstAus() {
  try { return jsonParse(store.getItem(LV_INST_KEY())) || INST_AUS_VORGABE.slice(); }
  catch { return INST_AUS_VORGABE.slice(); }
}

// Anteil der Installation an der Bausumme. Die Zusammenstellung fuehrt dafuer
// eine Staffel — von Bausumme X bis Y ein fester Betrag. Ein Prozentsatz sagt
// dasselbe, ohne an den Stufengrenzen zu springen: waechst das Projekt um ein
// Fundament, waechst die Installation mit, statt eine Stufe lang stillzustehen
// und dann zu hopsen.
function mkInstProzent() {
  const n = Number(loadMkEinstellungen().instProzent);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Bausumme, an der sich die Installation bemisst: die Summe der Abschnitte,
// die dafuer angehakt sind. Nicht dazu zaehlen die Installation selbst, das
// Personal und die Sicherheitsausruestung — sonst bemaesse sie sich an sich
// selbst (siehe INST_AUS_VORGABE).
function mkInstBasisSumme(abschnitte) {
  const aus = loadInstAus();
  let basis = 0;
  abschnitte.forEach((a, k) => { if (!aus.includes(k)) basis += a.summe; });
  return basis;
}

function instAbschnittUmschalten(abschnitt) {
  const aus = loadInstAus();
  const i = aus.indexOf(abschnitt);
  if (i < 0) aus.push(abschnitt); else aus.splice(i, 1);
  store.setItem(LV_INST_KEY(), JSON.stringify(aus));
  renderMassenView();
}

// «1001110122» → Kapitel 100, Abschnitt 100.100 (erste Ziffer der
// Hauptposition, wie in der Zusammenstellung)
function _lvGruppe(pos) {
  const z = String(pos || '').replace(/\D/g, '');
  if (z.length < 4) return { kapitel: '—', abschnitt: '—' };
  const kapitel = z.slice(0, 3);
  return { kapitel, abschnitt: kapitel + '.' + z[3] + '00' };
}

function _mkInstBasis(abschnitte) {
  const el = document.getElementById('mk-instbasis');
  if (!el) return;
  if (!abschnitte.size) { el.innerHTML = ''; return; }

  const aus = loadInstAus();
  const keys = [...abschnitte.keys()].sort((a, b) =>
    (a === '—') - (b === '—') || a.localeCompare(b, 'de', { numeric: true }));
  const basis = mkInstBasisSumme(abschnitte);
  const zeilen = keys.map(k => {
    const a = abschnitte.get(k);
    const drin = !aus.includes(k);
    return `<label style="display:flex;align-items:center;gap:8px;padding:3px 0;font-size:11px;
                 color:${drin ? '#374151' : '#9ca3af'};cursor:pointer;">
        <input type="checkbox" ${drin ? 'checked' : ''} onchange="instAbschnittUmschalten('${k}')"
               style="margin:0;cursor:pointer;">
        <span style="font-variant-numeric:tabular-nums;flex:0 0 62px;">${escHtml(k)}</span>
        <span style="flex:0 0 78px;color:#9ca3af;">${a.anzahl} Pos.</span>
        <span style="flex:1 1 auto;text-align:right;font-variant-numeric:tabular-nums;">${_mkZahl(a.summe)}</span>
      </label>`;
  }).join('');

  el.innerHTML =
    `<div style="padding:10px 14px;">
       <div style="font-size:10px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">
         Baukosten für die Ermittlung der Baustelleninstallation</div>
       <div style="max-width:420px;">${zeilen}
         <div style="display:flex;gap:8px;border-top:1px solid #e5e7eb;margin-top:5px;padding-top:5px;
                     font-size:12px;font-weight:700;color:#1a3a5c;">
           <span style="flex:1 1 auto;">Bausumme</span>
           <span style="font-variant-numeric:tabular-nums;">${_mkZahl(basis)}</span></div>
         <div style="display:flex;align-items:center;gap:8px;margin-top:6px;font-size:11px;color:#374151;">
           <span style="flex:1 1 auto;">davon Installation</span>
           <input type="number" step="0.1" min="0" max="100" value="${mkInstProzent() || ''}"
                  onchange="mkInstProzentSetzen(this.value)" placeholder="0"
                  style="width:62px;padding:3px 6px;border:1px solid #e5e7eb;border-radius:5px;
                         font-size:11px;font-family:inherit;text-align:right;">
           <span style="flex:0 0 12px;color:#9ca3af;">%</span>
           <span style="flex:0 0 92px;text-align:right;font-variant-numeric:tabular-nums;font-weight:700;
                        color:${mkInstProzent() ? '#1a3a5c' : '#c7cdd4'};">${_mkZahl(basis * mkInstProzent() / 100)}</span>
         </div>
       </div>
       <div style="font-size:10px;color:#9ca3af;margin-top:6px;line-height:1.6;">
         Abgewählte Abschnitte zählen nicht mit — die Installation, das Personal und die
         Sicherheitsausrüstung bemessen sich nicht an sich selbst.
         ${mkInstProzent()
           ? 'Der Betrag steht als Einheitspreis in jeder Position, deren Menge auf «% der Bausumme» steht.'
           : 'Ohne Prozentsatz bleibt der Betrag bei null — die Zusammenstellung führt dafür eine Staffel nach Bausumme.'}</div>
     </div>`;
}

function mkInstProzentSetzen(wert) {
  const n = parseFloat(String(wert).replace(',', '.'));
  saveMkEinstellungen({ ...loadMkEinstellungen(), instProzent: Number.isFinite(n) && n > 0 ? n : 0 });
  renderMassenView();
}

function _mkSummenZeile(netto, anzahlFundamente) {
  const el = document.getElementById('mk-summen');
  if (!el) return;
  const e   = loadMkEinstellungen();
  const zu  = netto * (e.zuschlag || 0) / 100;
  const zwi = netto + zu;
  const mw  = zwi * (e.mwst || 0) / 100;
  const zeile = (label, wert, stark) =>
    `<div style="display:flex;justify-content:space-between;gap:16px;${stark ? 'border-top:1px solid #e5e7eb;margin-top:4px;padding-top:4px;' : 'font-weight:400;color:#6b7280;'}">
       <span>${label}</span><span style="font-variant-numeric:tabular-nums;">${_mkZahl(wert)}</span></div>`;

  // Kosten je Fundament als Kontrollzahl. Gerechnet auf die Summe des
  // Verzeichnisses OHNE Unvorhergesehenes und Mehrwertsteuer — das ist die
  // Zahl, die sich mit der Erfahrung aus fruehereren Baustellen vergleichen
  // laesst. Ein Stueckpreis mit Zuschlaegen drin waere ein anderer Massstab.
  const jeStk = anzahlFundamente > 0
    ? `<div style="display:flex;justify-content:space-between;gap:16px;border-top:1px solid #e5e7eb;
             margin-top:5px;padding-top:5px;font-weight:400;color:#6b7280;font-size:11px;"
            title="Summe des Verzeichnisses ohne Unvorhergesehenes und MWST, geteilt durch ${anzahlFundamente} Fundamente">
         <span>je Fundament (${anzahlFundamente} Stk.)</span>
         <span style="font-variant-numeric:tabular-nums;font-weight:700;color:#1a3a5c;">${_mkZahl(netto / anzahlFundamente)}</span></div>`
    : '';

  el.innerHTML = zeile('Summe LV', netto)
    + zeile(`Unvorhergesehenes ${_mkZahl(e.zuschlag || 0, 0)} %`, zu)
    + zeile(`MWST ${_mkZahl(e.mwst || 0, 1)} %`, mw)
    + zeile('Total inkl. MWST', zwi + mw, true)
    + jeStk;
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
// Rüstzeit: eigener Wert, sonst der hergeleitete, sonst der Abzug fuer
// Installation und Anfahrt aus dem Bauprogramm — dieselbe Zeit, hier in
// Stunden statt Minuten.
function lwRuestzeit(ftId) {
  const e = loadFtLeistungswerte()[ftId];
  return e?.eigenRuest ?? e?.vorschlagRuest ?? mkAbzugStunden();
}

function mkAbzugStunden() {
  const min = typeof loadProjEinst === 'function' ? loadProjEinst().abzugMinuten : null;
  return Number(min) > 0 ? Number(min) / 60 : null;
}

// Leistungswert eines Typs bei der gewaehlten Intervalldauer
function lkLeistungswert(ftId, stunden) {
  // Ohne Katalog steht am Typ nur der eigene Aufwandswert, kein lw-Feld.
  const e = loadFtLeistungswerte()[ftId];
  if (!e?.lw) return null;
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
      vorschlagRuest: eintrag.vorschlagRuest ?? mkAbzugStunden(),
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
  const positionen = loadLvPositionen();
  // Dieselbe Rechnung wie in der Ansicht: die Installation traegt den Anteil
  // an der Bausumme, nicht die Zahl aus der Datenbank.
  const abschnitte = new Map();
  positionen.forEach(z => {
    if (z.herkunft === 'installation') return;
    const g = _lvGruppe(z.pos);
    if (!abschnitte.has(g.abschnitt)) abschnitte.set(g.abschnitt, { summe: 0, anzahl: 0 });
    const a = abschnitte.get(g.abschnitt);
    a.summe += lvMenge(z, summen) * (z.preis || 0);
    a.anzahl++;
  });
  const instBetrag = mkInstBasisSumme(abschnitte) * mkInstProzent() / 100;
  const zeilen = positionen.map(z => {
    const menge = lvMenge(z, summen);
    const preis = lvPreis(z, instBetrag);
    return { 'Pos.': z.pos, 'Bezeichnung': z.text, 'Einheit': z.einheit,
             'Menge': menge, 'Einheitspreis': preis, 'Betrag': menge * preis };
  });
  if (!zeilen.length) { ui.toast('Keine Positionen zum Ausgeben.', 'fehler'); return; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(zeilen), 'Leistungsverzeichnis');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    massenauszugRechnen(document.getElementById('mk-massen-gliederung')?.value || 'typ')), 'Massenauszug');
  XLSX.writeFile(wb, 'Massen-Kosten.xlsx');
}

// ============================================================
// EINSTELLUNGEN UND DATENBANK
// ============================================================
// Drei Dinge in einem Fenster, weil sie zusammen die Kostenschaetzung
// bestimmen: die Parameter, die Mengen je Fundamenttyp und die Positionen mit
// ihren Einheitspreisen. Alles drei ist in der App aenderbar und faehrt ueber
// Excel raus und wieder rein.
let _mkTabAktiv = 'parameter';

function mkModalOeffnen(tab) {
  const m = document.getElementById('mk-einst-modal');
  if (!m) return;
  m.style.display = 'flex';
  mkTabWechseln(tab || 'parameter');
}

function mkModalSchliessen() {
  const m = document.getElementById('mk-einst-modal');
  if (m) m.style.display = 'none';
  renderMassenView();
}

function mkTabWechseln(tab) {
  _mkTabAktiv = tab;
  ['parameter', 'ansaetze', 'positionen'].forEach(t => {
    const inhalt = document.getElementById('mk-tab-' + t);
    const knopf  = document.getElementById('mk-tab-btn-' + t);
    if (inhalt) inhalt.style.display = t === tab ? 'block' : 'none';
    if (knopf)  knopf.classList.toggle('active', t === tab);
  });
  if (tab === 'parameter')  _mkParameterTab();
  if (tab === 'ansaetze')   _mkAnsatzTab();
  if (tab === 'positionen') _mkPositionenTab();
}

// ── Tab 1: Parameter ─────────────────────────────────────────
function _mkParameterTab() {
  const el = document.getElementById('mk-tab-parameter');
  if (!el) return;
  const e      = loadMkEinstellungen();
  const bp     = schichtenBauprogramm();
  const abzug  = mkAbzugStunden();
  const quelle = mkSchichtQuelle();

  const feld = (label, id, wert, schritt, einheit, hinweis) =>
    `<label style="display:flex;align-items:center;gap:10px;padding:7px 0;font-size:12px;color:#374151;">
       <span style="flex:1 1 auto;">${label}${hinweis ? `<br><span style="font-size:10px;color:#9ca3af;">${hinweis}</span>` : ''}</span>
       <input id="${id}" type="number" step="${schritt}" min="0" value="${wert}"
              onchange="mkParameterSpeichern()"
              style="width:84px;padding:5px 7px;border:1px solid #e5e7eb;border-radius:6px;
                     font-size:12px;font-family:inherit;text-align:right;">
       <span style="flex:0 0 26px;color:#9ca3af;font-size:11px;">${einheit}</span>
     </label>`;

  el.innerHTML =
    `<div style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Kostenschätzung</div>`
    + feld('Unvorhergesehenes', 'mk-p-zuschlag', e.zuschlag, '1', '%', 'Zuschlag auf die Summe des Verzeichnisses')
    + feld('MWST', 'mk-p-mwst', e.mwst, '0.1', '%', '')
    + `<div style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.05em;margin:16px 0 4px;">Schichten</div>`
    + feld('Verrechnete Stunden je Schicht', 'mk-p-stunden', mkStundenJeSchicht(), '0.5', 'h',
           'Der Baumeister rechnet die ganze Schicht ab, auch wenn das Intervall kürzer ist — gilt ebenso für Maschinen und Geräte')
    + `<label style="display:flex;align-items:center;gap:10px;padding:7px 0;font-size:12px;color:#374151;">
         <span style="flex:1 1 auto;">Intervalldauer<br><span style="font-size:10px;color:#9ca3af;">Nettodauer einer Schicht für die Rechnung mit den Aufwandswerten</span></span>
         <select onchange="lkIntervallSetzen(this.value)"
                 style="width:84px;padding:5px 7px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;font-family:inherit;">
           ${LK_INTERVALLE.map(h => `<option value="${h}"${h === lkIntervall() ? ' selected' : ''}>${h} h</option>`).join('')}
         </select><span style="flex:0 0 26px;"></span>
       </label>`
    + `<label style="display:flex;align-items:center;gap:10px;padding:7px 0;font-size:12px;color:#374151;">
         <span style="flex:1 1 auto;">Schichtzahl aus<br><span style="font-size:10px;color:#9ca3af;">Womit die zeitabhängigen Positionen rechnen</span></span>
         <select onchange="mkSchichtQuelleSetzen(this.value)"
                 style="width:186px;padding:5px 7px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;font-family:inherit;">
           <option value="auto"${quelle === 'auto' ? ' selected' : ''}>Bauprogramm, sonst Aufwandswerte</option>
           <option value="aufwand"${quelle === 'aufwand' ? ' selected' : ''}>nur Aufwandswerte</option>
           <option value="hand"${quelle === 'hand' ? ' selected' : ''}>von Hand</option>
         </select>
       </label>`
    + (quelle === 'hand'
        ? `<label style="display:flex;align-items:center;gap:10px;padding:7px 0;font-size:12px;color:#374151;">
             <span style="flex:1 1 auto;">Anzahl Schichten</span>
             <input type="number" step="1" min="0" value="${mkSchichtHand() || ''}"
                    onchange="mkSchichtHandSetzen(this.value)"
                    style="width:84px;padding:5px 7px;border:1px solid #e5e7eb;border-radius:6px;
                           font-size:12px;font-family:inherit;text-align:right;">
             <span style="flex:0 0 26px;"></span></label>`
        : '')
    + `<div style="padding:9px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;
                   font-size:11px;color:#6b7280;line-height:1.6;margin-top:8px;">`
      + `Massgebend: <b>${schichtenGesamt()} Schichten</b>`
      + (quelle === 'auto'
          ? (bp != null ? ' aus dem Bauprogramm. ' : ` aus den Aufwandswerten — noch keine Baupakete terminiert. `)
          : quelle === 'aufwand' ? ' aus den Aufwandswerten. ' : ' von Hand gesetzt. ')
      + (quelle !== 'auto'
          ? 'Ohne Bauprogramm gibt es keine Termine: alle Schichten zählen als Nachtschichten, Sonntage bleiben bei null. '
          : '')
      + (abzug
          ? `Der Abzug für Installation und Anfahrt beträgt ${_mkZahl(abzug * 60, 0)} min je Schicht und gilt als Vorschlag für die Rüstzeit.`
          : `Im Bauprogramm ist kein Abzug für Installation und Anfahrt hinterlegt.`)
      + `</div>`;
}

function mkParameterSpeichern() {
  const zu = parseFloat(document.getElementById('mk-p-zuschlag')?.value);
  const mw = parseFloat(document.getElementById('mk-p-mwst')?.value);
  const st = parseFloat(document.getElementById('mk-p-stunden')?.value);
  saveMkEinstellungen({
    zuschlag:        Number.isFinite(zu) ? zu : 0,
    mwst:            Number.isFinite(mw) ? mw : 0,
    stundenJeSchicht: Number.isFinite(st) && st > 0 ? st : 8,
  });
  renderMassenView();
  _mkParameterTab();
}

// ── Uebersicht der Fundamenttypen ────────────────────────────
// Nur zur Ansicht: was die Bibliothek je Typ traegt und was ihr fehlt.
// Geaendert wird im Fundamenttyp-Modul — der Auszug hat keine zweite Quelle.
function mkTypenImProjekt() {
  const ftProfile = typeof loadFtProfile === 'function' ? loadFtProfile() : [];
  const allBp     = typeof loadAllBauprojekt === 'function' ? loadAllBauprojekt() : {};
  const map = new Map();
  getFundamente().forEach(p => {
    const bp = { ...p, ...(allBp[p.id] || {}) };
    const ft = ftTypZuStandort(ftProfile, bp);
    const schluessel = ft?.id || ('name:' + String(bp.fundtyp || '—').trim());
    if (!map.has(schluessel)) {
      map.set(schluessel, {
        schluessel,
        name: ft?.name || bp.fundtyp || '— kein Typ —',
        art: ft ? (ft.typ === 'standard' ? 'Standard' : 'Spezial') : 'kein Bibliothekstyp',
        bauart: ft?.fundamentArt || '',
        anzahl: 0,
        daten: fmMengen(ft),
      });
    }
    map.get(schluessel).anzahl++;
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

function _mkAnsatzTab() {
  const el = document.getElementById('mk-tab-ansaetze');
  if (!el) return;
  const typen  = mkTypenImProjekt();
  const felder = MASSEN_GROESSEN.filter(g => g.id !== 'anzahl');

  if (!typen.length) {
    el.innerHTML = '<div style="padding:22px;text-align:center;font-size:12px;color:#9ca3af;">'
      + 'Noch keine Fundamentstandorte in dieser Phase.</div>';
    return;
  }

  const th = (t, rechts) =>
    `<th style="text-align:${rechts ? 'right' : 'left'};padding:6px 8px;font-size:10px;color:#6b7280;
         text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;">${t}</th>`;
  const zahl = (w, g) => w == null
    ? '<span style="color:#d1d5db;">—</span>'
    : _mkZahl(w, MASSEN_GANZ.has(g.id) ? 0 : 2);

  el.innerHTML =
    `<div style="font-size:11px;color:#6b7280;line-height:1.6;margin-bottom:10px;">
       Menge <b>je Fundament</b>, gerechnet aus den Feldern des Fundamenttyps. Geändert wird
       im Fundamenttyp-Modul — der Massenauszug hat keine zweite Quelle. Ein Strich heisst:
       diese Bauweise führt die Grösse nicht oder das Feld ist leer.
     </div>
     <div style="overflow-x:auto;">
     <table style="width:100%;border-collapse:collapse;font-size:12px;">
       <thead><tr style="background:#f9fafb;">
         ${th('Fundamenttyp')}${th('Anzahl', true)}
         ${felder.map(g => th(g.label + '<br><span style="font-weight:400;text-transform:none;">' + g.einheit + '</span>', true)).join('')}
       </tr></thead>
       <tbody>${typen.map(t => {
         const luecke = !t.daten || t.daten.fehlend.length;
         return `<tr${luecke ? ' style="background:#fffbeb;"' : ''}>
           <td style="padding:5px 8px;border-bottom:1px solid #f3f4f6;">
             ${escHtml(t.name)}
             <span style="font-size:10px;color:#9ca3af;">· ${escHtml(t.art)}</span>
             ${luecke ? `<br><span style="font-size:10px;color:#b45309;">fehlt: ${
               escHtml(t.daten ? t.daten.fehlend.join(', ') : 'kein Bibliothekstyp')}</span>` : ''}</td>
           <td style="padding:5px 8px;border-bottom:1px solid #f3f4f6;text-align:right;
               font-variant-numeric:tabular-nums;">${t.anzahl}</td>
           ${felder.map(g => `<td style="padding:5px 8px;border-bottom:1px solid #f3f4f6;text-align:right;
               font-variant-numeric:tabular-nums;">${zahl(t.daten?.[g.id], g)}</td>`).join('')}
         </tr>`;
       }).join('')}</tbody>
     </table></div>
     <div style="display:flex;gap:6px;margin-top:12px;">
       <button onclick="mkAnsatzExport()" class="btn btn-secondary btn-sm">Ausgeben</button>
       <button onclick="mkModalSchliessen();setOverviewView('fundamente')" class="btn btn-secondary btn-sm">Zum Fundamenttyp-Modul</button>
     </div>`;
}

function mkAnsatzExport() {
  const felder = MASSEN_GROESSEN.filter(g => g.id !== 'anzahl');
  const zeilen = mkTypenImProjekt().map(t => {
    const z = { 'Fundamenttyp': t.name, 'Art': t.art, 'Bauweise': t.bauart, 'Anzahl': t.anzahl };
    felder.forEach(g => { z[g.label + ' [' + g.einheit + ']'] = t.daten?.[g.id] ?? ''; });
    z['Fehlende Angaben'] = t.daten ? t.daten.fehlend.join(', ') : 'kein Bibliothekstyp';
    return z;
  });
  if (!zeilen.length) { ui.toast('Keine Fundamenttypen im Projekt.', 'fehler'); return; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(zeilen), 'Mengen je Typ');
  XLSX.writeFile(wb, 'Mengen-je-Fundamenttyp.xlsx');
}

// ── Tab 3: Positionsdatenbank ────────────────────────────────
// Dieselbe Liste, aus der «+ aus Vorlage» schoepft — hier aber aenderbar.
function saveLvVorlage(liste) { store.setItem(LV_VORLAGE_KEY, JSON.stringify(liste)); }

// ── Zuordnung: welche Position traegt welche Groesse ─────────
// Gelesen wird der Beschrieb, die Einheit engt ein: «Beton» in m3 ist die
// Kubatur, «Beton» in Stk waere etwas anderes. Die erste zutreffende Regel
// gewinnt, darum stehen die engeren oben. Der Vorschlag fuellt nur LEERE
// Zuordnungen — was der Anwender gesetzt hat, bleibt stehen. Er ist eine
// Lesehilfe, kein Urteil: die verbindliche Zuordnung steht danach in der
// Datenbank und faehrt ueber Excel mit.
const MK_ZUORDNUNG_REGELN = [
  // Nach Stunden abgerechnet zuerst: Personal, Maschinen und Geraete stehen im
  // Verzeichnis mit Std. als Einheit, und ihre Zuschlaege ebenso. Stuende die
  // Schicht-Regel oben, bekaeme eine Stundenposition die Schichtzahl.
  { herkunft: 'stundenSonntag', text: /sonntag/, einheit: /^(std|h|stunde)/ },
  { herkunft: 'stundenNacht',   text: /nacht/,   einheit: /^(std|h|stunde)/ },
  { herkunft: 'schichtSonntag', text: /sonntag/ },
  { herkunft: 'schichtNacht',   text: /nacht/ },
  // Die Installation bemisst sich an der Bausumme, nicht an Schichten
  { herkunft: 'installation',   text: /installation|baustelleneinrichtung|einrichten und räumen|einrichten und raeumen/ },
  { herkunft: 'schalung',       text: /schalung|einschal|ausschal/,           einheit: /m2/ },
  { herkunft: 'beton',          text: /beton/,                                einheit: /m3/ },
  { herkunft: 'aushub',         text: /aushub|abtrag|erdarbeit|graben/,       einheit: /m3/ },
  { herkunft: 'buegel',         text: /bügel|buegel/ },
  // Nur in kg: eine Position in Tonnen an eine Kilogramm-Menge zu binden
  // waere um den Faktor 1000 daneben — die bleibt offen und wird gesetzt.
  { herkunft: 'bewehrung',      text: /bewehrung|armierung|betonstahl|b500|b550/, einheit: /kg/ },
  { herkunft: 'fixierung',      text: /fixier|flacheisen|schablone/ },
  { herkunft: 'schraub',        text: /schraube/ },
  { herkunft: 'vfk',            text: /vorgefertigt|fundamentkopf|vfk/ },
  { herkunft: 'pfahlMeter',     text: /pfahl|bohrung/,                        einheit: /^(m|lfm)$|laufmeter/ },
  { herkunft: 'pfahlStk',       text: /pfahl/,                                einheit: /stk|stück|stueck/ },
  { herkunft: 'ankerMeter',     text: /anker/,                                einheit: /^(m|lfm)$|laufmeter/ },
  { herkunft: 'ankerStk',       text: /anker/,                                einheit: /stk|stück|stueck/ },
  // Alles, was nach Stunden geht, nimmt die verrechneten Stunden — welche
  // Leistung dahintersteht, spielt keine Rolle: die Einheit sagt es.
  { herkunft: 'stunden',        text: /./,       einheit: /^(std|h|stunde)/ },
  { herkunft: 'schicht',        text: /schicht|einsatz|bauleit|sicherheitschef|sicherheitsw|wärter|waerter|maschinist|absperr|zugsicher|bahnersatz/ },
  { herkunft: 'anzahl',         text: /fundament/,                            einheit: /stk|stück|stueck/ },
];

function mkHerkunftVorschlag(pos) {
  const text = String(pos?.text || '').toLowerCase();
  const le   = String(pos?.einheit || '').toLowerCase()
                 .replace(/³/g, '3').replace(/²/g, '2').replace(/[.\s]/g, '');
  if (!text) return '';
  for (const r of MK_ZUORDNUNG_REGELN) {
    if (r.einheit && !r.einheit.test(le)) continue;
    if (r.text.test(text)) return r.herkunft;
  }
  return '';
}

function mkZuordnungVorschlagen() {
  const liste = loadLvVorlage();
  if (!liste.length) { ui.toast('Die Datenbank ist leer.', 'fehler'); return; }
  let n = 0;
  liste.forEach(v => {
    if (v.herkunft) return;
    const vor = mkHerkunftVorschlag(v);
    if (vor) { v.herkunft = vor; n++; }
  });
  if (!n) { ui.toast('Kein neuer Vorschlag — alles Erkennbare ist bereits zugeordnet.', 'fehler'); return; }
  saveLvVorlage(liste);
  _mkPositionenTab();
  ui.toast(n + ' Positionen zugeordnet — bitte durchsehen', 'erfolg');
}

// ── Verzeichnis aus dem Modell zusammenstellen ───────────────
// Genommen wird jede Position der Datenbank, die an eine Groesse gebunden ist
// UND im Projekt eine Menge traegt. Damit stehen Pfahlpositionen nur da, wo
// Pfaehle vorkommen, Ankerpositionen nur bei Verankerung, der Nachtzuschlag
// nur bei Nachtschichten — die Auswahl folgt dem Modell und nicht einer
// Vorstellung davon, was ueblich ist.
//
// Bestehende Zeilen werden nicht ueberschrieben: eine von Hand gesetzte Menge
// oder ein verhandelter Preis waere sonst weg. Fehlt einer vorhandenen Zeile
// nur die Bindung, wird sie nachgetragen.
function lvAusModell() {
  const db = loadLvVorlage().filter(v => v.herkunft && v.pos);
  if (!db.length) {
    ui.toast('In der Datenbank ist noch keine Position an eine Grösse gebunden.\n'
             + 'Im Fenster «Datenbank» über «Zuordnung vorschlagen» oder von Hand setzen.', 'fehler');
    return;
  }
  const gliederung = document.getElementById('mk-massen-gliederung')?.value || 'typ';
  const summen = massenSummen(massenauszugRechnen(gliederung));
  const liste  = loadLvPositionen();
  let neu = 0, gebunden = 0, ohneMenge = 0, ausBesetzung = 0;

  // Was in der Besetzung eines Loses steht, wird NICHT zusaetzlich projektweit
  // gefuehrt. Sonst stuende der Polier zweimal im Verzeichnis: einmal mit den
  // Schichten aller Lose, einmal je Los — die Summe waere doppelt.
  const inBesetzung = new Set();
  ((typeof loadProjEinst === 'function' ? loadProjEinst().teams : null) || []).forEach(t => {
    [...(t.mannschaft || []), ...(t.geraete || [])].forEach(p => { if (p.pos) inBesetzung.add(p.pos); });
  });

  db.forEach(v => {
    if (inBesetzung.has(v.pos)) { ausBesetzung++; return; }
    const menge = lvMenge({ herkunft: v.herkunft, menge: 0 }, summen);
    if (!(menge > 0)) { ohneMenge++; return; }
    const da = liste.find(z => z.pos === v.pos);
    if (da) {
      if (!da.herkunft) { da.herkunft = v.herkunft; gebunden++; }
      return;
    }
    liste.push({ id: 'lv_' + Date.now().toString(36) + '_' + neu,
                 pos: v.pos, text: v.text, einheit: v.einheit,
                 menge: 0, preis: v.preis || 0, herkunft: v.herkunft });
    neu++;
  });

  const bes = _lvBesetzungZeilen(liste);

  if (!neu && !gebunden && !bes.neu && !bes.aktualisiert) {
    ui.toast('Nichts hinzuzufügen — die Positionen mit Menge stehen bereits im Verzeichnis.', 'fehler');
    return;
  }
  saveLvPositionen(liste);
  renderMassenView();
  ui.toast([neu ? neu + ' Positionen übernommen' : '',
            bes.neu ? bes.neu + ' aus der Besetzung' : '',
            bes.aktualisiert ? bes.aktualisiert + ' Besetzungszeilen nachgeführt' : '',
            gebunden ? gebunden + ' bestehende gebunden' : '',
            ausBesetzung ? ausBesetzung + ' nur über die Besetzung geführt' : '',
            ohneMenge ? ohneMenge + ' ohne Menge im Modell übersprungen' : '']
           .filter(Boolean).join(' · '), 'erfolg');
}

// Mannschaft und Geraete der Lose als eigene Zeilen. Die Menge ist
// Schichten des Loses × verrechnete Stunden × Anzahl — oder, wenn die
// Position nach Schichten geht, Schichten × Anzahl.
//
// Erkannt werden diese Zeilen an quelle/teamId/schluessel, damit ein zweiter
// Lauf die Anzahl nachfuehrt statt zu doppeln: aendert sich die Besetzung,
// soll das Verzeichnis mitgehen und nicht zweimal dasselbe fuehren.
function _lvBesetzungZeilen(liste) {
  const teams = (typeof loadProjEinst === 'function' ? loadProjEinst().teams : null) || [];
  const db    = loadLvVorlage();
  let neu = 0, aktualisiert = 0;

  teams.forEach(team => {
    [...(team.mannschaft || []), ...(team.geraete || [])].forEach(p => {
      if (!p.pos) return;
      const v = db.find(x => x.pos === p.pos);
      if (!v) return;
      const herkunft = mkHerkunftVorschlag(v) === 'stunden' ? 'stunden' : 'schicht';
      const schluessel = p.pos + '#' + (p.bez || '');
      const da = liste.find(z => z.quelle === 'besetzung' && z.teamId === team.id && z.schluessel === schluessel);
      if (da) {
        if (da.faktor !== (p.anzahl || 1)) { da.faktor = p.anzahl || 1; aktualisiert++; }
        return;
      }
      liste.push({
        id: 'lv_bes_' + team.id + '_' + neu + '_' + Date.now().toString(36),
        pos: v.pos,
        text: v.text + ' — ' + (team.name || 'Los') + (p.bez ? ' · ' + p.bez : ''),
        einheit: v.einheit, menge: 0, preis: v.preis || 0,
        herkunft, teamId: team.id, faktor: p.anzahl || 1,
        quelle: 'besetzung', schluessel,
      });
      neu++;
    });
  });
  return { neu, aktualisiert };
}

function dbPosSetzen(index, feld, wert) {
  const liste = loadLvVorlage();
  if (!liste[index]) return;
  liste[index][feld] = feld === 'preis'
    ? (parseFloat(String(wert).replace(',', '.')) || null)
    : String(wert).trim();
  saveLvVorlage(liste);
}

function dbPosNeu() {
  const liste = loadLvVorlage();
  liste.push({ pos: '', text: '', einheit: '', preis: null, herkunft: '' });
  saveLvVorlage(liste);
  _mkPositionenTab();
}

async function dbPosLoeschen(index) {
  if (!await ui.confirm('Position aus der Datenbank löschen?')) return;
  const liste = loadLvVorlage();
  liste.splice(index, 1);
  saveLvVorlage(liste);
  _mkPositionenTab();
}

// Startwerte aus dem Verzeichnis: was im Projekt schon verwendet wird, ist
// die beste Vorlage fuer das naechste.
function dbAusLv() {
  const liste = loadLvVorlage();
  const drin  = new Set(liste.map(v => v.pos));
  let n = 0;
  loadLvPositionen().forEach(z => {
    if (!z.pos || drin.has(z.pos)) return;
    liste.push({ pos: z.pos, text: z.text, einheit: z.einheit, preis: z.preis || null,
                 herkunft: z.herkunft || '' });
    drin.add(z.pos);
    n++;
  });
  if (!n) { ui.toast('Nichts zu übernehmen — die Positionen stehen schon in der Datenbank.', 'fehler'); return; }
  saveLvVorlage(liste);
  _mkPositionenTab();
  ui.toast(n + ' Positionen übernommen', 'erfolg');
}

function dbExport() {
  const liste = loadLvVorlage();
  if (!liste.length) { ui.toast('Die Datenbank ist leer.', 'fehler'); return; }
  const wb = XLSX.utils.book_new();
  // «Menge aus» faehrt mit: die Zuordnung ist der eigentliche Wert der
  // Datenbank und soll zwischen Projekten weitergegeben werden koennen.
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(liste.map(v =>
    ({ 'Pos.': v.pos, 'Bezeichnung': v.text, 'Einheit': v.einheit,
       'Einheitspreis': v.preis ?? '', 'Menge aus': mkHerkunftLabel(v.herkunft) }))),
    'Positionen');
  XLSX.writeFile(wb, 'Kostendatenbank.xlsx');
}

function dbImport(input) {
  const datei = input.files?.[0];
  if (!datei) return;
  const leser = new FileReader();
  leser.onload = ev => {
    try {
      const wb  = XLSX.read(ev.target.result, { type: 'array' });
      const roh = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const liste = [];
      roh.forEach(z => {
        const pos  = String(z['Pos.'] ?? z['Pos'] ?? z['Position'] ?? '').trim();
        const text = String(z['Bezeichnung'] ?? z['Text'] ?? '').trim();
        if (!pos && !text) return;
        const preis = parseFloat(String(z['Einheitspreis'] ?? z['Preis'] ?? '').replace(',', '.'));
        liste.push({ pos, text, einheit: String(z['Einheit'] ?? z['LE'] ?? '').trim(),
                     preis: Number.isFinite(preis) ? preis : null,
                     herkunft: mkHerkunftId(z['Menge aus'] ?? z['Herkunft'] ?? '') });
      });
      if (!liste.length) throw new Error('Keine Positionen erkannt. Erwartet: Pos., Bezeichnung, Einheit, Einheitspreis.');
      saveLvVorlage(liste);
      _mkPositionenTab();
      ui.toast(liste.length + ' Positionen eingelesen', 'erfolg');
    } catch (err) { ui.toast(err.message, 'fehler'); }
    input.value = '';
  };
  leser.readAsArrayBuffer(datei);
}

function _mkPositionenTab() {
  const el = document.getElementById('mk-tab-positionen');
  if (!el) return;
  const liste   = loadLvVorlage();
  const katalog = loadLkKatalog();

  const knoepfe =
    `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;">
       <button onclick="dbPosNeu()" class="btn btn-secondary btn-sm">+ Position</button>
       <button onclick="mkZuordnungVorschlagen()" class="btn btn-secondary btn-sm"
               title="Aus Beschrieb und Einheit vorschlagen, welche Grösse eine Position trägt — füllt nur leere Zuordnungen">Zuordnung vorschlagen</button>
       <button onclick="dbAusLv()" class="btn btn-secondary btn-sm"
               title="Positionen aus dem Leistungsverzeichnis dieses Projekts übernehmen">Aus LV übernehmen</button>
       <label class="btn btn-secondary btn-sm" style="cursor:pointer;">Einlesen
         <input type="file" accept=".xlsx,.xlsm,.xls" style="display:none" onchange="dbImport(this)"></label>
       <button onclick="dbExport()" class="btn btn-secondary btn-sm">Ausgeben</button>
       <label class="btn btn-secondary btn-sm" style="cursor:pointer;"
              title="Tabelle mit Positionsnummer, Einheitspreis und den Schichtleistungen">Katalog einlesen
         <input type="file" accept=".xlsx,.xlsm,.xls" style="display:none" onchange="lkKatalogImport(this)"></label>
       <label class="btn btn-secondary btn-sm" style="cursor:pointer;">Aus Zusammenstellung
         <input type="file" accept=".xlsx,.xlsm,.xls" style="display:none" onchange="lvVorlageImport(this)"></label>
     </div>
     <div style="font-size:10px;color:#9ca3af;margin-top:7px;">
       ${katalog
         ? katalog.positionen.length + ' Katalogpositionen hinterlegt — sie liefern die Einheitspreise beim Einlesen aus der Zusammenstellung.'
         : 'Kein Katalog hinterlegt — Einheitspreise werden dann von Hand gesetzt.'}
     </div>`;

  if (!liste.length) {
    el.innerHTML = '<div style="padding:22px;text-align:center;font-size:12px;color:#9ca3af;line-height:1.6;">'
      + 'Noch keine Positionen hinterlegt<br>'
      + '<span style="font-size:11px;">Aus dem Leistungsverzeichnis übernehmen, aus Excel einlesen oder von Hand anlegen.</span></div>'
      + knoepfe;
    return;
  }

  const eingabe = (i, feld, wert, breite, zahl) =>
    `<input value="${escHtml(String(wert ?? ''))}" ${zahl ? 'type="number" step="0.01"' : 'type="text"'}
            onchange="dbPosSetzen(${i},'${feld}',this.value)"
            style="width:${breite};padding:3px 5px;border:1px solid #e5e7eb;border-radius:5px;
                   font-size:12px;font-family:inherit;${zahl ? 'text-align:right;font-variant-numeric:tabular-nums;' : ''}">`;
  const th = (t, rechts) =>
    `<th style="text-align:${rechts ? 'right' : 'left'};padding:6px 8px;font-size:10px;color:#6b7280;
         text-transform:uppercase;letter-spacing:.05em;">${t}</th>`;

  const gebunden = liste.filter(v => v.herkunft).length;
  el.innerHTML =
    `<div style="font-size:10px;color:#9ca3af;margin-bottom:7px;">
       ${liste.length} Positionen · ${gebunden} an eine Grösse gebunden — nur diese kann
       «Aus Modell» ins Verzeichnis übernehmen, und nur wenn das Projekt eine Menge dafür trägt.
     </div>
     <div style="max-height:52vh;overflow-y:auto;">
     <table style="width:100%;border-collapse:collapse;font-size:12px;">
       <thead><tr style="background:#f9fafb;">${th('Pos.')}${th('Bezeichnung')}${th('Einheit')}${th('Einheitspreis', true)}${th('Menge aus')}${th('')}</tr></thead>
       <tbody>${liste.map((v, i) => `<tr>
         <td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;">${eingabe(i, 'pos', v.pos, '92px')}</td>
         <td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;">${eingabe(i, 'text', v.text, '100%')}</td>
         <td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;">${eingabe(i, 'einheit', v.einheit, '64px')}</td>
         <td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;text-align:right;">${eingabe(i, 'preis', v.preis, '92px', true)}</td>
         <td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;">
           <select onchange="dbPosSetzen(${i},'herkunft',this.value)"
                   style="padding:3px 5px;border:1px solid #e5e7eb;border-radius:5px;font-size:11px;
                          font-family:inherit;background:white;max-width:150px;">
             ${_mkHerkunftOptionen(v.herkunft)}
           </select></td>
         <td style="padding:4px 6px;border-bottom:1px solid #f3f4f6;">
           <button onclick="dbPosLoeschen(${i})" title="Position löschen"
             style="border:none;background:none;cursor:pointer;color:#9ca3af;padding:2px;display:flex;align-items:center;">
             <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
           </button></td>
       </tr>`).join('')}</tbody>
     </table></div>`
    + knoepfe;
}
