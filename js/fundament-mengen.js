// FUNDAMENT-MENGEN
// ============================================================
// Was ein Fundament an Menge und Material bedeutet — an EINER Stelle.
//
// Drei Ansichten brauchen dieselbe Auskunft und hatten bis v172 jede ihre
// eigene Fassung davon:
//
//   · Massenauszug   Beton, Aushub, Schalung, Pfaehle, Anker
//   · Materialliste  Schrauben, Zubehoer, Buegel, Fixierung
//   · Bauprogramm    Pfahlzahl und Bohrmeter fuer die Schichtdauer
//
// Das ging zweimal schief: die Materialliste suchte ihren Typ ueber den
// exakten Namen und verfehlte jeden Standort mit «DP1a / 1.80» statt
// «DP1a / 1.8», und sie zaehlte fest zwei Buegel, wo der Typ vier fuehrt.
// Beides waren keine Rechenfehler, sondern Fehler der zweiten Quelle.
//
// Deshalb: die Mengen kommen aus diesem Modul, die Daten dafuer
// ausschliesslich aus der Typenbibliothek. Was ein Typ nicht traegt, wird
// nicht geschaetzt, sondern gemeldet — siehe «fehlend».

// ── Zahlen aus den Textfeldern der Bibliothek ────────────────
// «600×600 mm» → { a: 0.6, b: 0.6 } (Seitenlaengen in Metern)
function fmSeite(mass) {
  const m = String(mass || '').match(/(\d+(?:[.,]\d+)?)\s*[×x*]\s*(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const a = parseFloat(m[1].replace(',', '.'));
  const b = parseFloat(m[2].replace(',', '.'));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  // Angaben in Millimetern, wenn die Zahl gross ist
  const f = a > 20 ? 0.001 : 1;
  return { a: a * f, b: b * f };
}

function fmZahl(wert) {
  const n = parseFloat(String(wert).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Ein Mass, das als einzelne Zahl ODER als Paar geschrieben sein darf.
// Der Katalog nennt die Grabenmasse als Paar («Grabenbreiten min. 1.30 x
// 1.60 m»). Bei 16 der 19 Typen sind beide Seiten gleich und das Feld traegt
// eine Zahl; die drei DG3a-Typen haben einen rechteckigen Graben.
function fmMass(wert) {
  const paar = fmSeite(wert);
  if (paar) return paar;
  const n = fmZahl(wert);
  return n != null ? { a: n, b: n } : null;
}

// ── Was eine Bauweise braucht ────────────────────────────────
// Dieselbe Zuordnung, mit der der Typ-Editor die Felder ein- und ausblendet
// (onFtArtChange in fundamenttypen.js). Ein Feld, das eine Bauweise gar nicht
// erhebt, darf hier nicht vermisst werden.
const FM_ART_FELDER = {
  blockfundament: ['kopf', 'kopfHoehe', 'block', 'tiefe'],
  mehrpfahl:      ['kopf', 'kopfHoehe', 'pfaehle', 'pfahlLaenge'],
  monopfahl:      ['kopf', 'kopfHoehe', 'pfahlLaenge'],
  fels:           ['pfahlLaenge', 'tiefe', 'anker'],
  mauer:          ['anker'],
  bauwerk:        ['anker'],
  sonstige:       ['kopf', 'kopfHoehe', 'block', 'tiefe'],
};

// ── Aushub ───────────────────────────────────────────────────
// Der Aushub war das Blockmass mal der Tiefe — das idealisierte Loch, in dem
// der Block genau aufgeht. Der Leistungskatalog nennt je Typ eine Kubatur,
// und sie liegt durchweg darueber.
//
// Nachgerechnet ueber alle 19 Typen: der Unterschied ist eine MEHRTIEFE unter
// der Sohle von rund 0.30 m — Sauberkeitsschicht samt Toleranz — und nicht
// ein Arbeitsraum an den Seiten. Bei DP1a mit 1.00 m Grabenbreite trifft
// Grabenbreite² × (Tiefe + 0.30) die Katalogkubatur dreimal exakt
// (1.9 / 2.2 / 2.5 m³). Ueber die uebrigen Typen bleibt die Abweichung
// zwischen -6 % und +3 %, was der Angabe «min. ca.» entspricht.
//
// Gerechnet wird NUR, wo eine Grabenbreite hinterlegt ist. Fehlt sie — alle
// Spezialfundamente, und DG2a/DG3a bis zur Klaerung — bleibt es beim
// bisherigen Mass. Eine Mehrtiefe auf ein ungeklaertes Grabenmass zu legen
// hiesse, eine Genauigkeit zu behaupten, die nicht da ist.
const FM_AUSHUB_MEHRTIEFE = 0.30;

const FM_FELD_LABEL = {
  kopf:        'Kopfabmessung',
  kopfHoehe:   'Kopfhöhe',
  block:       'Blockabmessung',
  tiefe:       'Tiefe',
  pfaehle:     'Anzahl Pfähle',
  pfahlLaenge: 'Pfahl-/Ankerlänge',   // Pfahl: ab UK Block, wie im Nachweis
  anker:       'Ankerbolzen',
  buegel:      'Bügelbewehrung',
  bewehrung:   'Bewehrung (kg)',
};

// ── Material aus der Typenpruefung ───────────────────────────
// Zubehoer und Fixierung stehen nicht am einzelnen Typ, sondern folgen aus
// Schraubendurchmesser und Fundamentfamilie. Beides gehoert zum Fundament,
// nicht zur Ansicht, die es gerade braucht.
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

// Fixierungseintraege eines Typs. Die Tabelle fuehrt die Familie als «DP1a»,
// ftNameZerlegen liefert sie klein — verglichen wird ohne Gross-Klein.
function fmFixierung(ft) {
  if (!ft?.name) return [];
  const familie = ftNameZerlegen(ft.name).familie;
  const schluessel = Object.keys(FIXIERUNG_FL_DB).find(k => k.toLowerCase() === familie);
  return schluessel ? FIXIERUNG_FL_DB[schluessel] : [];
}

function fmZubehoer(durchmesser) {
  return SCHRAUB_ZUBEHOER_DB[durchmesser] || [];
}

// ── Die Mengen eines Fundaments ──────────────────────────────
// Alles JE FUNDAMENT. Was die Bauweise braucht, der Typ aber nicht traegt,
// steht in «fehlend»; die zugehoerige Menge bleibt null und wird nirgends
// durch eine Null ersetzt — eine fehlende Angabe ist keine Menge von 0.
function fmMengen(ft) {
  if (!ft) return null;
  const art    = ft.fundamentArt || 'blockfundament';
  const noetig = FM_ART_FELDER[art] || FM_ART_FELDER.blockfundament;

  const kopf   = fmSeite(ft.kopfAbmessung);
  const block  = fmSeite(ft.blockAbmessung);
  const kopfH  = fmZahl(ft.kopfHoehe);
  const tiefe  = fmZahl(ft.tiefe);
  const stk    = fmZahl(ft.anzahlPfaehle);
  const laenge = fmZahl(ft.pfahlLaenge);
  const schr   = fmZahl(ft.schraubenAnzahl);

  const vorhanden = {
    kopf: !!kopf, kopfHoehe: kopfH != null, block: !!block, tiefe: tiefe != null,
    pfaehle: stk != null, pfahlLaenge: laenge != null, anker: schr != null,
  };
  const fehlend = noetig.filter(f => !vorhanden[f]).map(f => FM_FELD_LABEL[f]);

  const d = { beton: null, aushub: null, schalung: null, buegel: null,
              bewehrung: null, schraub: null, fixierung: null, vfk: null,
              pfahlStk: null, pfahlMeter: null,
              ankerStk: null, ankerMeter: null };

  // Kopf: bei allen Bauweisen mit Fundamentkopf dasselbe Quader-Volumen.
  // Geschalt wird NUR der Kopf — der Block steht im Baugrund und wird gegen
  // das Erdreich betoniert. Flaeche = Umfang × Kopfhoehe.
  const kopfVol      = (kopf && kopfH != null) ? kopf.a * kopf.b * kopfH : null;
  const kopfSchalung = (kopf && kopfH != null) ? 2 * (kopf.a + kopf.b) * kopfH : null;

  if (art === 'blockfundament' || art === 'sonstige') {
    if (kopfVol != null && block && tiefe != null) {
      const blockH = Math.max(0, tiefe - kopfH);
      d.beton    = kopfVol + block.a * block.b * blockH;
      // Der Graben ist nie schmaler als der Block — die Katalogangabe ist ein
      // Mindestmass der Verbauregeln, nicht das Mass dieses Fundaments.
      // Kurze gegen kurze, lange gegen lange Seite: welche Seite in der
      // Bibliothek zuerst steht, ist Schreibweise und nicht Ausrichtung.
      const gr = fmMass(ft.grabenBreite);
      const kurz = m => Math.min(m.a, m.b);
      const lang = m => Math.max(m.a, m.b);
      d.aushub   = gr
        ? Math.max(kurz(gr), kurz(block)) * Math.max(lang(gr), lang(block)) * (tiefe + FM_AUSHUB_MEHRTIEFE)
        : block.a * block.b * tiefe;
      d.schalung = kopfSchalung;
    }
  } else if (art === 'mehrpfahl' || art === 'monopfahl') {
    // Der Pfahlbeton haengt am Bohrdurchmesser, den der Typ nicht fuehrt —
    // abgerechnet werden Pfaehle ohnehin nach Stueck und Bohrmeter.
    if (kopfVol != null) { d.beton = kopfVol; d.aushub = kopfVol; d.schalung = kopfSchalung; }
    const anzahl = art === 'monopfahl' ? (stk ?? 1) : stk;
    d.pfahlStk   = anzahl;
    d.pfahlMeter = (anzahl != null && laenge != null) ? anzahl * laenge : null;
  }

  // Bei Verankerung in Fels und Befestigung an Mauer fuehren die
  // Schraubenfelder die Anker, nicht die Fundamentschrauben.
  if (art === 'fels' || art === 'mauer') {
    d.ankerStk   = schr;
    d.ankerMeter = (schr != null && laenge != null) ? schr * laenge : null;
  } else {
    d.schraub = schr;
  }

  // Buegel nach Stueck, wie sie bestellt werden. Ein Kilogewicht liesse sich
  // rechnen, waere aber ohne die Laengseisen — die die Bibliothek nicht
  // fuehrt — keine Bewehrungsmenge.
  const bAnz = fmZahl(ft.buegelAnzahl);
  if (bAnz != null) d.buegel = bAnz;
  else if (d.beton != null) fehlend.push(FM_FELD_LABEL.buegel);

  // Bewehrung als Gewicht je Fundament. Sie steht am Typ und wird NICHT aus
  // der Geometrie geschaetzt: das Gewicht haengt am Bewehrungsplan, nicht am
  // Volumen, und ein angenommener Gehalt in kg/m3 waere eine erfundene Menge.
  //
  // Fehlt sie, wird sie NICHT vermisst. Im Gleistiefbau treibt das Material
  // die Kosten selten — dort haengen sie an den Schichten und den Stunden, die
  // je Schicht verrechnet werden. Ein Mangel an jedem Standort, nur weil kein
  // Bewehrungsgewicht hinterlegt ist, wuerde das Zeichen entwerten, das die
  // fehlende Geometrie meldet.
  const bewKg = fmZahl(ft.bewehrungKg);
  if (bewKg != null) d.bewehrung = bewKg;

  d.fixierung = fmFixierung(ft).reduce((s, f) => s + (f.anzPro || 0), 0) || null;

  // Vorgefertigter Fundamentkopf: der Typ fuehrt dazu eine Zeichnungsnummer.
  // Leer heisst «kein VFK verfuegbar», nicht «unbekannt».
  d.vfk = ft.vfkZeichnungsNr ? 1 : 0;

  return { ...d, fehlend };
}

// Mengen zu einem Standort — inklusive der Typzuordnung, damit kein Aufrufer
// sie selbst nachbaut. Ohne Bibliothekstyp gibt es keine Mengen, und das
// steht dann auch so da.
function fmMengenZuStandort(ftProfile, bpDaten) {
  const ft = ftTypZuStandort(ftProfile, bpDaten);
  if (!ft) return { ft: null, mengen: null, fehlend: ['kein Fundamenttyp aus der Bibliothek'] };
  const mengen = fmMengen(ft);
  return { ft, mengen, fehlend: mengen.fehlend };
}
