// ============================================================
// BAHNLINIEN — Kartenebene und Kilometrierung
//
// QUELLE UND BEDINGUNGEN:
//
//  · «Linie (Kilometrierungspunkte)» und «Linie (Betriebspunkte)» der SBB
//    Infrastruktur, bezogen ueber data.sbb.ch.
//    Nutzungsbedingungen: https://data.sbb.ch/page/licence
//    Ziffer 4.1 verlangt die Nennung von data.sbb.ch als Bezugsort.
//    Ziffer 3 beschraenkt die Anzahl Abfragen; das Limit gilt fuer alle
//    anonymen Nutzer GEMEINSAM. Deshalb wird jeder Kartenausschnitt hoechstens
//    EINMAL geladen: geladene Rechtecke stehen als Merkliste im Store, und ein
//    bereits abgedeckter Ausschnitt loest keine Abfrage aus. Einmal gesehene
//    Gebiete sind damit auch ohne Netz verfuegbar.
//    Ziffer 6 schliesst jede Gewaehr fuer die Genauigkeit aus: ein hier
//    ermittelter Kilometer ist ein Vorschlag, kein gesetzter Wert.
//
// NICHT verwendet wird die Kachelebene «Schienennetz» des BAV
// (wmts.geo.admin.ch/ch.bav.schienennetz). Sie enthaelt neben der Eisenbahn
// auch Trams: bei Zuerich Altstetten liefert sie mitten im Projektgebiet die
// VBZ-Linie Z027 (Meterspur, Escher-Wyss-Platz–Altstetten). Ein Rasterbild
// laesst sich nicht filtern, der SBB-Datensatz dagegen enthaelt nur
// Eisenbahnlinien — Trams und Busse fallen damit von selbst weg.
//
// GENAUIGKEIT: Abgebildet wird die KILOMETRIERUNGSACHSE je Linie, nicht das
// einzelne Gleis. Gleisnummern sind in den offenen Datensaetzen nicht
// enthalten. Das Punktraster betraegt durchgehend 0.1 km (nachgemessen ueber
// Linie 840: 70 von 70 Abstaenden genau 0.1 km, Sehnenlaenge 99.9–100.0 m);
// der Linienzug schneidet in engen Boegen entsprechend ab.
// ============================================================

// Quellenangabe in der Kartenecke (Nutzungsbedingungen Ziffer 4.1)
const BAHN_QUELLE_HTML =
  'Bahndaten <a href="https://data.sbb.ch" target="_blank" rel="noopener">data.sbb.ch</a>';

const BAHN_KM_KEY = () => 'sp_bahnkm__' + _activeId;
const BAHN_BP_KEY = () => 'sp_bahnbp__' + _activeId;

// Ab dieser Zoomstufe erscheinen ueberhaupt Kilometermarken
const BAHN_MIN_ZOOM = 12;
// Ab hier zusaetzlich die Betriebspunkte (Stationen, Abzweigungen)
const BAHN_BP_ZOOM  = 13;
// Gleicher Kilometer innerhalb dieses Bildschirmabstands wird nur einmal
// angeschrieben. In einem mehrgleisigen Korridor liegen die Achsen dicht
// beieinander und trugen sonst alle dieselbe Zahl.
const BAHN_DOPPEL_PX = 150;

let _bahnPunkte   = null;  // [{ linienr, liniename, km, e, n, lat, lon }]
let _bahnStationen = null; // [{ name, kurz, linienr, km, lat, lon }]
let _bahnGebiete  = null;  // bereits geladene Rechtecke
let _bahnEbenen   = {};    // je Karte: { marken, linien, hinweis, aktiv }
let _bahnLaedt    = false;

// Punktraster nach Zoomstufe. Rueckgabe in Zehntelkilometern, damit ganzzahlig
// gerechnet werden kann — 0.1 km als Fliesskomma waere beim Modulo unsauber.
function bahnRaster(zoom) {
  if (zoom >= 16) return 1;    // alle 0.1 km
  if (zoom >= 14) return 5;    // alle 0.5 km
  return 10;                   // alle 1.0 km
}

// ------------------------------------------------------------
// Kilometrierungspunkte laden (einmal je Projekt, dann aus dem Store)
// ------------------------------------------------------------
function bahnPunkteAusCache() {
  if (_bahnPunkte) return _bahnPunkte;
  const c = jsonParse(store.getItem(BAHN_KM_KEY()));
  if (c?.punkte?.length) _bahnPunkte = c.punkte;
  return _bahnPunkte;
}

// Seitenweise Abfrage eines Datensatzes von data.sbb.ch. Gedeckelt, weil das
// Abfragelimit fuer alle anonymen Nutzer GEMEINSAM gilt (Nutzungsbedingungen
// Ziffer 3) — hier wird nicht unbegrenzt durchgeblaettert.
async function _bahnAbfrage(datensatz, where, umwandeln, maxSaetze) {
  const basis = `https://data.sbb.ch/api/explore/v2.1/catalog/datasets/${datensatz}/records`
              + '?limit=100&where=' + encodeURIComponent(where);
  const ergebnis = [];
  let offset = 0, total = 1;
  while (offset < total && offset < (maxSaetze || 2000)) {
    const r = await fetch(basis + '&offset=' + offset);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    total = j.total_count || 0;
    if (!j.results?.length) break;
    j.results.forEach(satz => {
      const um = umwandeln(satz);
      if (um) ergebnis.push(um);
    });
    offset += 100;
  }
  return ergebnis;
}

// Geladen wird in einem festen Raster, nicht im jeweiligen Kartenausschnitt.
// Sonst gilt ein Gebiet beim Zurueckkehren als «nicht abgedeckt», weil der
// Ausschnitt um ein paar Meter verschoben ist — gemessen: Hin- und Rueckweg
// nach Altstetten loesten zwei Abfragen desselben Gebiets aus. Mit dem Raster
// wird jede Kachel hoechstens einmal geholt.
const BAHN_KACHEL_LAT = 0.05;    // ~5.5 km
const BAHN_KACHEL_LON = 0.075;   // ~5.6 km auf Schweizer Breite
// Deckel gegen eine Abfragelawine. Gemessener Kachelbedarf eines Ausschnitts:
// Zoom 16 → 1, Zoom 15 → 1, Zoom 14 → 6, Zoom 13 → 15, Zoom 12 → 35.
// Mit 9 laedt alles ab Zoom 14 auch bei unguenstiger Rasterlage; weiter
// draussen wird nur noch gezeichnet, was bereits im Bestand ist.
const BAHN_KACHELN_MAX = 9;

function bahnGebieteAusCache() {
  if (_bahnGebiete) return _bahnGebiete;
  const c = jsonParse(store.getItem(BAHN_KM_KEY()));
  _bahnGebiete = c?.gebiete || [];
  return _bahnGebiete;
}

// Rasterkacheln, die den Ausschnitt ueberdecken
function _bahnKachelnFuer(bbox) {
  const kacheln = [];
  const iVon = Math.floor(bbox.latMin / BAHN_KACHEL_LAT), iBis = Math.floor(bbox.latMax / BAHN_KACHEL_LAT);
  const jVon = Math.floor(bbox.lonMin / BAHN_KACHEL_LON), jBis = Math.floor(bbox.lonMax / BAHN_KACHEL_LON);
  for (let i = iVon; i <= iBis; i++) {
    for (let j = jVon; j <= jBis; j++) {
      kacheln.push({
        schluessel: i + '_' + j,
        latMin: i * BAHN_KACHEL_LAT, latMax: (i + 1) * BAHN_KACHEL_LAT,
        lonMin: j * BAHN_KACHEL_LON, lonMax: (j + 1) * BAHN_KACHEL_LON,
      });
    }
  }
  return kacheln;
}

function _bahnFehlendeKacheln(bbox) {
  const geladen = new Set(bahnGebieteAusCache());
  return _bahnKachelnFuer(bbox).filter(k => !geladen.has(k.schluessel));
}

function _bahnSpeichern() {
  store.setItem(BAHN_KM_KEY(), JSON.stringify({
    stand: new Date().toISOString(), punkte: _bahnPunkte || [], gebiete: _bahnGebiete || [] }));
  store.setItem(BAHN_BP_KEY(), JSON.stringify({
    stand: new Date().toISOString(), stationen: _bahnStationen || [] }));
}

// Eine Rasterkachel nachladen und in den Bestand einfuegen. Mehrfach
// vorhandene Punkte werden ueber Linie + Kilometer erkannt, damit sich
// angrenzende Kacheln nicht summieren.
async function bahnGebietLaden(bbox) {
  if (!bbox || _bahnLaedt) return bahnPunkteAusCache() || [];
  _bahnLaedt = true;
  try {
    const rechteck = feld =>
      `in_bbox(${feld}, ${bbox.latMin}, ${bbox.lonMin}, ${bbox.latMax}, ${bbox.lonMax})`;

    // SBB fuehrt x als Nord- und y als Ostwert (nachgerechnet gegen
    // geo_point_2d: Abweichung 0 m).
    const neu = await _bahnAbfrage('linienkilometrierung', rechteck('geo_point_2d'), p =>
      (p.km == null || !p.x || !p.y) ? null : {
        linienr: p.linienr, liniename: p.liniename || '', km: +p.km,
        e: p.y, n: p.x, lat: p.geo_point_2d?.lat, lon: p.geo_point_2d?.lon,
      });
    const bestand = new Set((bahnPunkteAusCache() || []).map(p => p.linienr + '|' + p.km));
    _bahnPunkte = (_bahnPunkte || []).concat(neu.filter(p => !bestand.has(p.linienr + '|' + p.km)));

    // Betriebspunkte: Stationen, Abzweigungen
    const neuBp = await _bahnAbfrage('linie-mit-betriebspunkten', rechteck('geopos'), p =>
      (!p.geopos || !p.bezeichnung_offiziell) ? null : {
        name: p.bezeichnung_offiziell, kurz: p.abkurzung_bpk || '',
        linienr: p.linie, km: p.km != null ? +p.km : null,
        lat: p.geopos.lat, lon: p.geopos.lon,
      });
    const bpBestand = new Set((bahnStationenAusCache() || []).map(s => s.name + '|' + s.linienr));
    _bahnStationen = (_bahnStationen || []).concat(neuBp.filter(s => !bpBestand.has(s.name + '|' + s.linienr)));

    _bahnGebiete = bahnGebieteAusCache().concat([bbox.schluessel]);
    _bahnSpeichern();
    return _bahnPunkte;
  } catch (err) {
    console.warn('Bahndaten konnten nicht geladen werden:', err);
    ui.toast('Bahndaten konnten nicht geladen werden: ' + err.message, 'fehler');
    return _bahnPunkte || [];
  } finally {
    _bahnLaedt = false;
  }
}

// Ausschnitt der Karte als Rechteck, mit etwas Rand fuer kleine Verschiebungen
function _bahnSichtBbox(karte) {
  const b = karte.getBounds().pad(0.25);
  return { latMin: b.getSouth(), lonMin: b.getWest(), latMax: b.getNorth(), lonMax: b.getEast() };
}

function bahnStationenAusCache() {
  if (_bahnStationen) return _bahnStationen;
  const c = jsonParse(store.getItem(BAHN_BP_KEY()));
  if (c?.stationen?.length) _bahnStationen = c.stationen;
  return _bahnStationen;
}

// ------------------------------------------------------------
// Kilometer für einen Punkt bestimmen
//
// Projektion auf die Verbindung der beiden benachbarten Marken. Der reine
// Abstand zum naechsten Punkt taugt nicht: ein Fundament steht neben dem
// Gleis, und der seitliche Versatz wuerde als Laengsversatz gezaehlt.
// ------------------------------------------------------------
function bahnKmFuerPunkt(e, n, optionen) {
  return bahnKmAusPunkten(e, n, bahnPunkteAusCache(), optionen);
}

// Projektion auf eine einzelne Linie. Die Punkte muessen zu dieser Linie
// gehoeren und nach Kilometer sortiert sein.
function _bahnAufLinie(e, n, linie) {
  let idx = 0, dMin = Infinity;
  linie.forEach((p, i) => {
    const d = Math.hypot(p.e - e, p.n - n);
    if (d < dMin) { dMin = d; idx = i; }
  });
  let best = { km: linie[idx].km, abstand: dMin, interpoliert: false, sprung: false };
  for (const [i, j] of [[idx - 1, idx], [idx, idx + 1]]) {
    const A = linie[i], B = linie[j];
    if (!A || !B) continue;
    const vx = B.e - A.e, vy = B.n - A.n;
    const laenge2 = vx * vx + vy * vy;
    if (!laenge2) continue;
    // Kilometersprung: die Achse ist dort unstetig, dazwischen darf nicht
    // interpoliert werden (nachgewiesen bei Linie 840 km 59.4 → 59.5:
    // 104.2 m Luftlinie fuer 0.1 km).
    if (Math.abs(Math.sqrt(laenge2) - Math.abs(B.km - A.km) * 1000) > 5) {
      best.sprung = true;
      continue;
    }
    const t    = Math.max(0, Math.min(1, ((e - A.e) * vx + (n - A.n) * vy) / laenge2));
    const abst = Math.hypot(e - (A.e + t * vx), n - (A.n + t * vy));
    if (abst <= best.abstand) {
      best = { km: A.km + t * (B.km - A.km), abstand: abst, interpoliert: true, sprung: best.sprung };
    }
  }
  return best;
}

// Kern der Berechnung, getrennt vom Zwischenspeicher: die Erfassungsmaske
// reicht frisch abgefragte Punkte durch, wenn noch nichts geladen ist.
// Erwartet Punkte mit metrischen LV95-Feldern e und n.
//
// Es wird JEDE Linie in der Umgebung einzeln geprueft, nicht nur die mit dem
// naechstgelegenen Punkt. In einem mehrgleisigen Korridor liegen die Linien
// wenige Meter auseinander — bei Zuerich Altstetten sind es 17 —, und der
// naechste Einzelpunkt kann zu einer Nachbarlinie mit voellig anderem
// Kilometer gehoeren. Gemessen wurde so ein Fehlgriff von 3.2 km.
// optionen.linienr erzwingt eine bestimmte Linie.
function bahnKmAusPunkten(e, n, punkte, optionen) {
  if (!punkte?.length) return null;
  const umkreis = optionen?.umkreis || 500;

  const proLinie = {};
  punkte.forEach(p => {
    if (optionen?.linienr && p.linienr !== optionen.linienr) return;
    if (Math.abs(p.e - e) > umkreis || Math.abs(p.n - n) > umkreis) return;
    (proLinie[p.linienr] = proLinie[p.linienr] || []).push(p);
  });

  const treffer = Object.values(proLinie).map(liste => {
    liste.sort((a, b) => a.km - b.km);
    const best = _bahnAufLinie(e, n, liste);
    return {
      linienr: liste[0].linienr, liniename: liste[0].liniename,
      km: +best.km.toFixed(3), abstand: Math.round(best.abstand),
      interpoliert: best.interpoliert, sprung: best.sprung,
    };
  }).sort((a, b) => a.abstand - b.abstand);

  if (!treffer.length) return null;
  // Weitere Linien in aehnlicher Entfernung mitgeben: im Korridor muss der
  // Nutzer entscheiden koennen, zu welchem Gleis der Standort gehoert.
  return { ...treffer[0], alternativen: treffer.slice(1, 4) };
}

// ------------------------------------------------------------
// Kartenebene
// ------------------------------------------------------------
function _bahnKarte(welche) {
  if (welche === 'detail') return leafletMap;
  if (welche === 'create') return createMapLeaflet;
  if (welche === 'abnahme') return typeof _ckLeafletMap !== 'undefined' ? _ckLeafletMap : null;
  return overviewMap;
}

function bahnEbeneAktiv(welche) {
  return !!_bahnEbenen[welche]?.aktiv;
}

// Wird eine Karte abgeraeumt, sind auch ihre Ebenen weg. Ohne dieses
// Vergessen gilt die Ebene beim naechsten Oeffnen als bereits aktiv und
// bahnStandardAnwenden() legt sie nicht neu an.
function bahnKarteVergessen(welche) {
  delete _bahnEbenen[welche];
}

// Quellenangabe ein-/ausblenden. Sollte eine Karte ohne Attributionsleiste
// erzeugt worden sein, wird sie hier angelegt — die Nennung von data.sbb.ch
// ist Pflicht (Nutzungsbedingungen Ziffer 4.1).
function _bahnQuelleZeigen(karte, an) {
  if (!karte.attributionControl) {
    if (!an) return;
    karte.attributionControl = L.control.attribution({ prefix: false }).addTo(karte);
  }
  if (an) karte.attributionControl.addAttribution(BAHN_QUELLE_HTML);
  else    karte.attributionControl.removeAttribution(BAHN_QUELLE_HTML);
}

// ------------------------------------------------------------
// Kartenoptionen (App-Einstellungen › Kartendarstellung)
// ------------------------------------------------------------
const KARTEN_OPT_KEY = 'sp_kartenoptionen';
const KARTEN_OPT_STANDARD = { bahnAn: true, kmMarken: true, stationen: true, linienNr: true };

function ladeKartenOptionen() {
  return Object.assign({}, KARTEN_OPT_STANDARD, jsonParse(store.getItem(KARTEN_OPT_KEY) || '{}'));
}
function speichereKartenOptionen(opt) {
  store.setItem(KARTEN_OPT_KEY, JSON.stringify(opt));
}

// Wird nach dem Aufbau jeder Karte aufgerufen: die Ebene ist standardmaessig
// an, bis sie in den Optionen abgeschaltet wird.
function bahnStandardAnwenden(welche) {
  if (!ladeKartenOptionen().bahnAn || bahnEbeneAktiv(welche)) return;
  bahnEbeneSetzen(welche, true);
}

// Auf allen offenen Karten anwenden — nach einer Aenderung in den Optionen
function bahnOptionenAnwenden() {
  const an = ladeKartenOptionen().bahnAn;
  ['overview', 'detail', 'create', 'abnahme'].forEach(welche => {
    if (!_bahnKarte(welche)) return;
    if (an !== bahnEbeneAktiv(welche)) bahnEbeneSetzen(welche, an);
    else if (an) bahnMarkenZeichnen(welche);
  });
}

// Panel «Kartendarstellung» in den App-Einstellungen
function initAppTabKarte() {
  const opt = ladeKartenOptionen();
  const setze = (id, wert) => { const e = document.getElementById(id); if (e) e.checked = !!wert; };
  setze('ko-bahn', opt.bahnAn);
  setze('ko-linien-nr', opt.linienNr);
  setze('ko-km', opt.kmMarken);
  setze('ko-stationen', opt.stationen);
  const bm = document.getElementById('ko-basemap');
  if (bm) bm.value = opt.basemap || (typeof overviewBaseLayerKey !== 'undefined' ? overviewBaseLayerKey : 'swiss-luft');
  const info = document.getElementById('ko-cache-info');
  if (info) {
    const k = bahnGebieteAusCache().length, p = bahnPunkteAusCache()?.length || 0;
    info.textContent = k ? `${k} Gebiete geladen, ${p} Kilometerpunkte` : 'Noch keine Bahndaten geladen';
  }
}

function onKartenOptionChange() {
  const wert = id => !!document.getElementById(id)?.checked;
  const opt = ladeKartenOptionen();
  opt.bahnAn    = wert('ko-bahn');
  opt.linienNr  = wert('ko-linien-nr');
  opt.kmMarken  = wert('ko-km');
  opt.stationen = wert('ko-stationen');
  const bm = document.getElementById('ko-basemap');
  if (bm) opt.basemap = bm.value;
  speichereKartenOptionen(opt);
  bahnOptionenAnwenden();
  if (bm && typeof setOverviewBaseLayer === 'function' && overviewMap) setOverviewBaseLayer(bm.value);
}

function bahnCacheLeeren() {
  store.removeItem(BAHN_KM_KEY());
  store.removeItem(BAHN_BP_KEY());
  _bahnPunkte = null; _bahnStationen = null; _bahnGebiete = null;
  ['overview', 'detail', 'create'].forEach(w => {
    if (_bahnKarte(w) && bahnEbeneAktiv(w)) { bahnLinienZeichnen(w); bahnMarkenZeichnen(w); }
  });
  initAppTabKarte();
  ui.toast('Geladene Bahndaten verworfen', 'erfolg');
}

async function bahnEbeneSetzen(welche, an) {
  const karte = _bahnKarte(welche);
  if (!karte) return;
  const stand = _bahnEbenen[welche] || (_bahnEbenen[welche] = {});
  if (!!stand.aktiv === !!an) return;

  if (stand.aktiv) {
    if (stand.marken) karte.removeLayer(stand.marken);
    if (stand.linien) karte.removeLayer(stand.linien);
    if (stand.handler) karte.off('zoomend moveend', stand.handler);
    if (stand.hinweis) { stand.hinweis.remove(); stand.hinweis = null; }
    _bahnQuelleZeigen(karte, false);
    stand.aktiv = false;
    _bahnKnopfAktualisieren(welche);
    return;
  }

  stand.marken = L.layerGroup().addTo(karte);
  stand.linien = L.layerGroup().addTo(karte);
  _bahnQuelleZeigen(karte, true);
  stand.handler = () => bahnAusschnittPruefen(welche);
  karte.on('zoomend moveend', stand.handler);
  stand.aktiv = true;
  _bahnKnopfAktualisieren(welche);

  await bahnAusschnittPruefen(welche);
}

// Fehlt der sichtbare Ausschnitt im Bestand, wird er nachgeladen. Damit ist
// die Ebene nicht mehr an das Projektgebiet gebunden: sie funktioniert auch
// im leeren Projekt und beim Verschieben über die ganze Schweiz.
async function bahnAusschnittPruefen(welche) {
  const karte = _bahnKarte(welche);
  if (!karte || !bahnEbeneAktiv(welche)) return;

  const zeichnen = () => { bahnLinienZeichnen(welche); bahnMarkenZeichnen(welche); };
  const bbox = _bahnSichtBbox(karte);
  const fehlend = _bahnFehlendeKacheln(bbox);

  if (!fehlend.length) { _bahnHinweisZeigen(welche, ''); zeichnen(); return; }
  if (karte.getZoom() < BAHN_MIN_ZOOM || fehlend.length > BAHN_KACHELN_MAX) {
    _bahnHinweisZeigen(welche, 'Für Bahndaten näher heranzoomen');
    zeichnen();
    return;
  }
  _bahnHinweisZeigen(welche, 'Bahndaten werden geladen…');
  for (const kachel of fehlend) await bahnGebietLaden(kachel);
  _bahnHinweisZeigen(welche, '');
  zeichnen();
}

// Kurze Rückmeldung am Kartenrand — ohne sie sieht ein leerer Ausschnitt
// aus wie ein Fehler, obwohl gerade geladen wird.
function _bahnHinweisZeigen(welche, text) {
  const karte = _bahnKarte(welche);
  if (!karte) return;
  const stand = _bahnEbenen[welche];
  if (!stand) return;
  if (!stand.hinweis) {
    stand.hinweis = L.DomUtil.create('div', 'bahn-hinweis', karte.getContainer());
  }
  stand.hinweis.textContent = text || '';
  stand.hinweis.style.display = text ? 'block' : 'none';
}

// Linienachsen aus den Kilometrierungspunkten. Frueher lag hier die
// Kachelebene des BAV — sie zeigt aber auch Trams: bei Zuerich Altstetten
// liefert sie die VBZ-Linie Z027 (Meterspur, Escher-Wyss-Platz–Altstetten)
// mitten im Projektgebiet. Ein Rasterbild laesst sich nicht filtern.
// Der SBB-Datensatz enthaelt nur Eisenbahnlinien — Trams und Busse fallen
// damit von selbst weg.
function bahnLinienZeichnen(welche) {
  const stand = _bahnEbenen[welche];
  if (!stand?.linien) return;
  stand.linien.clearLayers();
  const punkte = bahnPunkteAusCache();
  if (!punkte?.length) return;

  const proLinie = {};
  punkte.forEach(p => { (proLinie[p.linienr] = proLinie[p.linienr] || []).push(p); });

  Object.values(proLinie).forEach(liste => {
    liste.sort((a, b) => a.km - b.km);
    // An Kilometersprüngen und Datenluecken trennen, sonst zieht die Linie
    // quer durch die Landschaft.
    let zug = [];
    const zeichne = () => {
      if (zug.length > 1) {
        L.polyline(zug.map(p => [p.lat, p.lon]), {
          color: '#1a3a5c', weight: 2, opacity: 0.65, interactive: false,
        }).addTo(stand.linien);
      }
      zug = [];
    };
    liste.forEach((p, i) => {
      const vor = liste[i - 1];
      if (vor && Math.hypot(p.e - vor.e, p.n - vor.n) > 150) zeichne();
      zug.push(p);
    });
    zeichne();
  });
}

function bahnMarkenZeichnen(welche) {
  const karte = _bahnKarte(welche);
  const stand = _bahnEbenen[welche];
  if (!karte || !stand?.marken) return;
  stand.marken.clearLayers();

  const zoom = karte.getZoom();
  const sicht = karte.getBounds().pad(0.15);
  const punkte = bahnPunkteAusCache() || [];
  const sichtbar = zoom < BAHN_MIN_ZOOM ? [] : punkte.filter(p =>
    Math.round(p.km * 10) % bahnRaster(zoom) === 0 && p.lat != null && sicht.contains([p.lat, p.lon]));

  // Platzverwaltung im Bildschirmraum. Ein metrischer Umkreis reicht nicht:
  // je nach Zoom liegen 100 m mal 5, mal 50 Pixel auseinander — beim Lesen
  // zaehlt aber der Abstand auf dem Schirm.
  const belegt = [];
  const schild = (lat, lon, klasse, text) => {
    const pt = karte.latLngToContainerPoint([lat, lon]);
    // Leaflet setzt divIcons ohne iconSize mit der LINKEN OBEREN Ecke auf den
    // Punkt, nicht mittig (nachgemessen: Versatz 0/3 px). Der Kasten muss
    // deshalb rechts und unterhalb liegen.
    const br = text.length * 5.4 + 8, ho = 15;
    const kasten = { l: pt.x, r: pt.x + br, o: pt.y, u: pt.y + ho, text };
    // Gleiche Zahl in Lesenaehe: nur einmal anschreiben (parallele Gleise)
    if (belegt.some(b => b.text === text
        && Math.hypot(b.l - pt.x, b.o - pt.y) < BAHN_DOPPEL_PX)) return;
    // Ueberlappung mit einem bereits gesetzten Schild: weglassen
    if (belegt.some(b => !(b.r < kasten.l || kasten.r < b.l || b.u < kasten.o || kasten.u < b.o))) return;
    belegt.push(kasten);
    L.marker([lat, lon], {
      interactive: false,
      icon: L.divIcon({ className: 'bahn-schild-icon', html: `<span class="${klasse}">${escHtml(text)}</span>`, iconSize: null }),
    }).addTo(stand.marken);
  };

  // Reihenfolge nach Aussagekraft: was zuerst kommt, behaelt seinen Platz.
  // ── Betriebspunkte ───────────────────────────────────────────────
  // Beim Herauszoomen bleiben die Hauptstationen stehen: sie tragen die
  // geografische Orientierung, wenn Kilometermarken laengst weg sind.
  // Abzweigungen und Spurwechsel (Klammerzusatz im offiziellen Namen)
  // entfallen dann — sie sind Betriebspunkte ohne Ortsbezug.
  const opt = ladeKartenOptionen();
  const nurHaupt = zoom < BAHN_BP_ZOOM;
  const gezeigt = new Set();
  (opt.stationen ? (bahnStationenAusCache() || []) : []).forEach(s => {
    if (!sicht.contains([s.lat, s.lon]) || gezeigt.has(s.name)) return;
    if (nurHaupt && s.name.includes('(')) return;
    gezeigt.add(s.name);   // dieselbe Station steht je Linie einmal im Datensatz
    schild(s.lat, s.lon, 'bahn-bp', s.name);
  });

  // ── Liniennummern getrennt vom Kilometer ─────────────────────────
  // Je Linie ein Schild am mittleren sichtbaren Punkt, damit es nicht am
  // Kartenrand klebt.
  if (opt.linienNr) {
    const proLinie = {};
    sichtbar.forEach(p => { (proLinie[p.linienr] = proLinie[p.linienr] || []).push(p); });
    // Nur die Nummer: das Wort «Linie» wiederholt sich an jedem Schild und
    // die Zahl ist durch Schriftschnitt und fehlende Dezimalstelle klar von
    // einer Kilometermarke zu unterscheiden.
    Object.values(proLinie).forEach(liste => {
      const m = liste[Math.floor(liste.length / 2)];
      schild(m.lat, m.lon, 'bahn-linie', String(m.linienr));
    });
  }

  // ── Kilometer ────────────────────────────────────────────────────
  if (opt.kmMarken) sichtbar.forEach(p => schild(p.lat, p.lon, 'bahn-km', p.km.toFixed(1)));
}

// ------------------------------------------------------------
// Suche über Station, Liniennummer und Kilometer
//
// Drei Eingabearten in einem Feld, weil sie in der Praxis vermischt genannt
// werden: «Altstetten», «710», «710 3.4» oder nur «3.4».
// ------------------------------------------------------------
function bahnSuche(text) {
  const q = (text || '').trim().toLowerCase();
  if (q.length < 2) return [];
  const punkte    = bahnPunkteAusCache() || [];
  const stationen = bahnStationenAusCache() || [];
  const treffer   = [];

  // Zahlen aus der Eingabe: dreistellig ohne Komma gilt als Linie,
  // alles mit Komma oder Punkt als Kilometer.
  const zahlen  = q.match(/\d+(?:[.,]\d+)?/g) || [];
  const linieNr = zahlen.map(z => z.replace(',', '.'))
                        .filter(z => !z.includes('.') && +z >= 100 && +z <= 999).map(Number)[0];
  const kmWert  = zahlen.map(z => +z.replace(',', '.'))
                        .filter(z => !Number.isInteger(z) || z < 100)[0];

  // Stationen nach Name oder Abkürzung
  const gesehen = new Set();
  stationen.forEach(s => {
    if (!s.name.toLowerCase().includes(q) && s.kurz.toLowerCase() !== q) return;
    if (gesehen.has(s.name)) return;
    gesehen.add(s.name);
    treffer.push({ art: 'Station', titel: s.name,
                   neben: `Linie ${s.linienr}${s.km != null ? ' · km ' + s.km.toFixed(1) : ''}`,
                   lat: s.lat, lon: s.lon });
  });

  // Kilometer auf einer Linie
  if (kmWert != null) {
    punkte.filter(p => (!linieNr || p.linienr === linieNr) && Math.abs(p.km - kmWert) < 0.05)
      .slice(0, 6)
      .forEach(p => treffer.push({ art: 'Kilometer', titel: `km ${p.km.toFixed(1)}`,
                                   neben: `Linie ${p.linienr}`, lat: p.lat, lon: p.lon }));
  }

  // Reine Liniennummer: Mitte der Linie im geladenen Ausschnitt
  if (linieNr && kmWert == null) {
    const aufLinie = punkte.filter(p => p.linienr === linieNr).sort((a, b) => a.km - b.km);
    if (aufLinie.length) {
      const m = aufLinie[Math.floor(aufLinie.length / 2)];
      treffer.push({ art: 'Linie', titel: `Linie ${linieNr}`,
                     neben: `${m.liniename} · km ${aufLinie[0].km.toFixed(1)}–${aufLinie[aufLinie.length-1].km.toFixed(1)}`,
                     lat: m.lat, lon: m.lon });
    }
  }
  return treffer.slice(0, 8);
}

// Namenssuche direkt bei data.sbb.ch. bahnSuche() kennt nur Stationen aus
// bereits geladenen Kartenausschnitten — beim Anlegen eines neuen Standorts
// ist dieser Bestand in der Regel leer, und die Ortssuche landet dann im
// Dorfzentrum statt am Bahnhof.
async function bahnStationSuchenOnline(text) {
  const q = (text || '').trim().replace(/["\\]/g, '');
  if (q.length < 2) return [];
  try {
    const treffer = await _bahnAbfrage(
      'linie-mit-betriebspunkten', `search(bezeichnung_offiziell, "${q}")`,
      p => (!p.geopos || !p.bezeichnung_offiziell) ? null : {
        art: 'Station', titel: p.bezeichnung_offiziell,
        neben: `Linie ${p.linie}${p.km != null ? ' · km ' + (+p.km).toFixed(1) : ''}`,
        lat: p.geopos.lat, lon: p.geopos.lon,
      }, 100);
    // Ein Betriebspunkt steht je Linie einmal im Datensatz — der erste
    // Eintrag genuegt, die Lage ist dieselbe.
    const gesehen = new Set();
    return treffer.filter(t => {
      if (gesehen.has(t.titel)) return false;
      gesehen.add(t.titel);
      return true;
    }).slice(0, 6);
  } catch {
    return []; // ohne Netz bleibt die oertliche Suche
  }
}

// Mitte einer Linie, ueber die Kilometrierungspunkte bei data.sbb.ch. Dient
// dazu, eine Karte auf eine eingegebene Liniennummer zu stellen, bevor
// ueberhaupt ein Punkt gesetzt ist.
async function bahnLinieOrtOnline(linienr) {
  const nr = parseInt(linienr, 10);
  if (!nr) return null;
  try {
    const punkte = await _bahnAbfrage('linienkilometrierung', `linienr=${nr}`, p =>
      (!p.geo_point_2d || p.km == null) ? null
        : { lat: p.geo_point_2d.lat, lon: p.geo_point_2d.lon, km: +p.km }, 100);
    if (!punkte.length) return null;
    punkte.sort((a, b) => a.km - b.km);
    return punkte[Math.floor(punkte.length / 2)];
  } catch {
    return null;
  }
}

function bahnSucheEingabe(text) {
  const liste = document.getElementById('bahn-such-liste');
  if (!liste) return;
  const treffer = bahnSuche(text);
  if (!treffer.length) {
    liste.innerHTML = (text || '').trim().length >= 2
      ? '<div class="bahn-such-leer">Kein Treffer</div>' : '';
    liste.style.display = liste.innerHTML ? 'block' : 'none';
    return;
  }
  liste.innerHTML = treffer.map((t, i) =>
    `<button class="bahn-such-eintrag" data-idx="${i}">`
    + `<span>${escHtml(t.titel)}</span><span class="bs-neben">${escHtml(t.neben)}</span></button>`
  ).join('');
  liste.style.display = 'block';
  liste.querySelectorAll('[data-idx]').forEach(btn => {
    btn.onclick = () => {
      const t = treffer[+btn.dataset.idx];
      const karte = _bahnKarte('overview');
      if (karte) karte.setView([t.lat, t.lon], Math.max(karte.getZoom(), 16));
      liste.style.display = 'none';
    };
  });
}

// Die Ebene wird nur noch über App-Einstellungen → Kartendarstellung geschaltet.
// Die früheren Schalter auf den drei Karten sind entfallen; geblieben ist die
// Suche, die zur Ebene gehört — ohne geladene Daten hat sie nichts anzubieten.
function _bahnKnopfAktualisieren(welche) {
  if (welche !== 'overview') return;
  const suche = document.getElementById('bahn-suche-wrap');
  if (!suche) return;
  const aktiv = bahnEbeneAktiv('overview');
  suche.style.display = aktiv ? 'flex' : 'none';
  const liste = document.getElementById('bahn-such-liste');
  if (liste && !aktiv) liste.style.display = 'none';
}

// Kein Zuruecksetzen beim Projektwechsel noetig: der laeuft ueber appReload(),
// also einen vollstaendigen Neuaufbau der Seite. Der Zwischenspeicher haengt
// ohnehin am Projektschluessel (BAHN_KM_KEY).
