// OFFLINE SERVICE WORKER (PWA) — sw.js cacht die App-Shell
// (index.html, lib/, Icons) für den Offline-Start im Feld.
// Meldet der SW eine neue Version, erscheint ein Update-Hinweis.
// Nur über http(s) möglich — file:// wird übersprungen.
// ============================================================
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  // updateViaCache: 'none' — sonst laedt der Browser sw.js UND dessen
  // importScripts('version.js') aus dem HTTP-Cache. Eine alte version.js
  // wuerde das Geraet dauerhaft auf der alten Modulversion festhalten.
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(e =>
    console.warn('Service-Worker-Registrierung fehlgeschlagen:', e));
  navigator.serviceWorker.addEventListener('message', ev => {
    if (ev.data && ev.data.typ === 'update-verfuegbar') {
      ui.toast('Neue App-Version verfügbar — mit «App neu laden» aktualisieren.', '', 8000);
    }
  });
}

// ============================================================
// MESSFUNKTION
// ============================================================
let measurePoints = [];
let measurePolyline = null;
let measurePolygon  = null;
let measureMarkers  = [];
let measureLabel    = null;
let measureType     = 'dist'; // 'dist' | 'area'

// Gespeicherter Messlayer — bleibt beim Wechsel erhalten
let _measureLayerItems  = [];   // [{id,type:'dist'|'area',points:[{lat,lng}],result,color}]
let _measureLayerVisible = true;
let _measureLeafletGroup = [];  // Leaflet-Objekte des gespeicherten Layers
let _measRadierer        = false;  // Radiermodus: ein Klick loescht eine Messung
let _measAuswahlId       = null;   // ausgewaehlte Messung — ihre Ecken sind Griffe

const MEASURE_KEY = () => 'sp_measure__' + _activeId;

// ── Darstellung der Messungen ────────────────────────────────
// Farbe und Deckkraft sind Geschmack und haengen am Kartenbild: auf einem
// hellen Luftbild traegt ein kraeftiges Gruen, auf einer Graukarte stoert es.
// Darum einstellbar statt fest verdrahtet (App-Einstellungen › Kartendarstellung).
const MESS_CFG_KEY = 'sp_mess_cfg';
const MESS_CFG_VORGABE = { farbeDist: '#1a3a5c', farbeArea: '#059669', deckkraft: 70, nurSymbole: false };

function ladeMessCfg() {
  try { return { ...MESS_CFG_VORGABE, ...(jsonParse(store.getItem(MESS_CFG_KEY)) || {}) }; }
  catch { return { ...MESS_CFG_VORGABE }; }
}
function speichereMessCfg(cfg) { store.setItem(MESS_CFG_KEY, JSON.stringify(cfg)); }

const _messFarbe = typ => (typ === 'area' ? ladeMessCfg().farbeArea : ladeMessCfg().farbeDist);
const _messAlpha = () => Math.max(0.2, Math.min(1, (ladeMessCfg().deckkraft || 70) / 100));

function initAppTabMessen() {
  const cfg = ladeMessCfg();
  const setz = (id, wert, feld) => { const e = document.getElementById(id); if (e) e[feld] = wert; };
  setz('ko-mess-farbe-dist', cfg.farbeDist, 'value');
  setz('ko-mess-farbe-area', cfg.farbeArea, 'value');
  setz('ko-mess-deckkraft', cfg.deckkraft, 'value');
  setz('ko-toolbar-symbole', cfg.nurSymbole, 'checked');
  const w = document.getElementById('ko-mess-deckkraft-wert');
  if (w) w.textContent = cfg.deckkraft + ' %';
}

function onMessOptionChange() {
  const wert = (id, feld) => document.getElementById(id)?.[feld];
  const cfg = ladeMessCfg();
  cfg.farbeDist  = wert('ko-mess-farbe-dist', 'value') || cfg.farbeDist;
  cfg.farbeArea  = wert('ko-mess-farbe-area', 'value') || cfg.farbeArea;
  cfg.deckkraft  = parseInt(wert('ko-mess-deckkraft', 'value')) || cfg.deckkraft;
  cfg.nurSymbole = !!wert('ko-toolbar-symbole', 'checked');
  speichereMessCfg(cfg);
  const w = document.getElementById('ko-mess-deckkraft-wert');
  if (w) w.textContent = cfg.deckkraft + ' %';
  toolbarBeschriftungPruefen();
  renderMeasureLayer();
}

// Beschriftung der Werkzeugleiste. Die Woerter stehen im Markup als eigenes
// Element, damit sie sich schalten lassen, ohne dass die Symbole ihre Bedeutung
// verlieren — der Titel bleibt in jedem Fall.
//
// Sie weichen, sobald die Werkzeuge nicht mehr nebeneinander passen. Gemessen
// und nicht an eine feste Breite gebunden, weil die Leiste ihre Laenge mit dem
// Modus aendert: im Kartenmodus sind es drei Knoepfe (gemessen 301 px), im
// Messmodus kommen acht dazu (627 px). In der Detailansicht teilt sich die
// Karte den Schirm mit der Seitenleiste und laesst der Leiste 616 px — der
// Messmodus passte dort bisher nicht und musste gescrollt werden. Ein fester
// Schwellwert waere fuer einen der beiden Zustaende immer falsch, und beim
// naechsten Knopf fuer beide.
function toolbarBeschriftungPruefen() {
  const leiste = document.querySelector('.sketch-toolbar');
  if (!leiste) return;
  const staerken = document.getElementById('size-tools');
  const passt = () => leiste.scrollWidth <= leiste.clientWidth;

  // Immer von weit nach eng: erst alles zuruecknehmen, sonst kaeme nichts
  // zurueck, wenn wieder Platz da ist (Karte im Vollbild).
  leiste.classList.remove('ohne-wort', 'eng');
  if (staerken) staerken.classList.remove('zu');

  // Stufe 1 — die Beschriftung. Der Handschalter aus den Optionen nimmt sie
  // ohnehin weg; sonst nur, wenn es sonst nicht reicht.
  if (ladeMessCfg().nurSymbole || !passt()) leiste.classList.add('ohne-wort');

  // Stufe 2 — die Abstaende. Erst wenn auch das nicht reicht. Der Preis sind
  // enger stehende Knoepfe; dafuer bleibt jedes Werkzeug erreichbar, ohne die
  // Leiste seitwaerts schieben zu muessen.
  if (!passt()) leiste.classList.add('eng');

  // Stufe 3 — die Strichstaerken auf die gewaehlte. Jetzt kostet es einen
  // zweiten Tipp, deshalb steht sie zuletzt: erst wenn Weglassen und
  // Zusammenruecken ausgereizt sind.
  if (!passt() && staerken) staerken.classList.add('zu');
}

function loadMeasureLayer(pairId) {
  try {
    const all = jsonParse(store.getItem(MEASURE_KEY())) || {};
    _measureLayerItems = all[pairId] || [];
  } catch { _measureLayerItems = []; }
  // Altbestand ohne Kennung nachruesten — Auswahl und Loeschen brauchen sie
  _measureLayerItems.forEach((it, i) => { if (!it.id) it.id = 'm' + Date.now() + '_' + i; });
  _measAuswahlId = null;
  renderMeasureLayer();
}

function _measSpeichern() {
  try {
    const all = jsonParse(store.getItem(MEASURE_KEY())) || {};
    all[currentPairId] = _measureLayerItems;
    store.setItem(MEASURE_KEY(), JSON.stringify(all));
  } catch {}
}

// ── Eine Formel, ein Etikett ─────────────────────────────────
// Ergebnis einer Messung aus ihren Punkten. Frueher stand die Rechnung an
// drei Stellen — beim Messen, beim Speichern und nirgends beim Verschieben,
// weshalb eine verschobene Messung ihr altes Ergebnis behalten haette.
function measErgebnis(type, pts) {
  if (type === 'area') return pts.length >= 3 ? formatArea(calcArea(pts)) : '';
  if (pts.length < 2) return '';
  let total = 0;
  for (let i = 1; i < pts.length; i++)
    total += haversine(pts[i-1].lat, pts[i-1].lng, pts[i].lat, pts[i].lng);
  return formatDist(total);
}

// Dasselbe Etikett fuer die laufende und die gespeicherte Messung. Vorher
// waren es zwei Bauarten — andere Groesse, anderer Rand, anderer Aufhaengepunkt
// —, und das Etikett sprang beim Speichern sichtbar um.
// iconSize [0,0] hiess: das Element ist null Pixel gross — der Inhalt lief
// darueber hinaus und wurde beschnitten, die Kaestchen umschlossen ihre Zahl
// nicht. Ohne iconSize bemisst Leaflet das Element am Inhalt; die Verschiebung
// um die halbe Breite und Hoehe setzt es mittig auf seinen Punkt.
function _measEtikett(text, farbe) {
  return L.divIcon({
    html: '<div style="transform:translate(-50%,-50%);display:inline-block;background:' + farbe + ';'
        + 'color:white;padding:5px 12px;border-radius:9px;font-size:12px;font-weight:700;'
        + 'white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.28);">' + text + '</div>',
    className: 'meas-label', iconSize: null
  });
}

// Teilstrecken anschreiben — halbtransparent, damit sie die Karte nicht
// zudecken. Bei der Flaeche werden die Umfangsseiten beschriftet, die
// letzte Seite schliesst zum ersten Punkt.
function _measSegmentEtiketten(pts, farbe, geschlossen) {
  const marker = [];
  const n = pts.length;
  if (n < 2) return marker;
  const bis = geschlossen ? n : n - 1;
  for (let i = 0; i < bis; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const d = haversine(a.lat, a.lng, b.lat, b.lng);
    if (d < 0.5) continue;                     // zu kurz zum Anschreiben
    marker.push(L.marker([(a.lat + b.lat) / 2, (a.lng + b.lng) / 2], {
      interactive: false,
      icon: L.divIcon({
        html: '<div style="transform:translate(-50%,-50%);display:inline-block;background:rgba(255,255,255,0.82);'
            + 'color:' + farbe + ';padding:1px 6px;border-radius:5px;font-size:10px;font-weight:600;'
            + 'white-space:nowrap;border:1px solid rgba(255,255,255,0.95);">' + formatDist(d) + '</div>',
        className: 'meas-label', iconSize: null
      })
    }));
  }
  return marker;
}

function saveMeasureLayer() {
  if (measurePoints.length < 2) return;
  const pts = measurePoints.map(p => ({ lat: p.lat, lng: p.lng }));
  const result = measErgebnis(measureType, pts);
  if (!result) return;
  _measureLayerItems.push({
    id: 'm' + Date.now(),
    type: measureType,
    points: pts,
    result,
    color: _messFarbe(measureType),
  });
  _measSpeichern();
  clearCurrentMeasure();
  renderMeasureLayer();
  // Vorher wurde das Symbol des Knopfes durch ein Hakenzeichen ersetzt und
  // nach einer Sekunde zurueckgetauscht — der Knopf sprang in der Breite.
  // Die Rueckmeldung steht jetzt dort, wo auch sonst der Messhinweis steht.
  showMeasureLabel('Messung gespeichert · ' + result);
  setTimeout(() => {
    if (currentMode === 'measure') showMeasureLabel(measureType === 'area'
      ? 'Ersten Eckpunkt antippen (mind. 3)' : 'Ersten Punkt antippen');
  }, 1600);
}

function renderMeasureLayer() {
  _measureLeafletGroup.forEach(obj => { try { obj.remove(); } catch {} });
  _measureLeafletGroup = [];
  if (!leafletMap || !_measureLayerVisible) return;

  _measureLayerItems.forEach(item => {
    const pts = item.points.map(p => [p.lat, p.lng]);
    const ausgewaehlt = item.id === _measAuswahlId;
    const klick = () => {
      if (_measRadierer) { measLoeschen(item.id); return; }
      _measAuswahlId = ausgewaehlt ? null : item.id;
      renderMeasureLayer();
    };

    // Die gespeicherte Farbe bleibt die des Eintrags; die Deckkraft kommt aus
    // den Optionen, damit sich bestehende Messungen mitregeln lassen.
    const alpha = _messAlpha();
    let form = null;
    if (item.type === 'dist' && pts.length >= 2) {
      form = L.polyline(pts, { color: item.color, opacity: alpha,
                               weight: ausgewaehlt ? 4 : 2, dashArray: '6,4' });
    } else if (item.type === 'area' && pts.length >= 3) {
      form = L.polygon(pts, { color: item.color, opacity: alpha, fillColor: item.color,
                              fillOpacity: (ausgewaehlt ? 0.2 : 0.1) * alpha,
                              weight: ausgewaehlt ? 4 : 2 });
    }
    if (form) {
      form.addTo(leafletMap).on('click', ev => { L.DomEvent.stop(ev); klick(); });
      // Rechtsklick auf die Linie setzt dort einen Punkt — eingehaengt in die
      // Seite, der er am naechsten liegt, damit die Form nicht springt.
      form.on('contextmenu', ev => {
        L.DomEvent.stop(ev);
        const p = { lat: ev.latlng.lat, lng: ev.latlng.lng };
        const n = item.points.length;
        const bis = item.type === 'area' ? n : n - 1;
        let besteI = 0, besteD = Infinity;
        for (let i = 0; i < bis; i++) {
          const a = item.points[i], b = item.points[(i + 1) % n];
          const d = _measAbstandZurStrecke(p, a, b);
          if (d < besteD) { besteD = d; besteI = i; }
        }
        item.points.splice(besteI + 1, 0, p);
        item.result = measErgebnis(item.type, item.points);
        _measAuswahlId = item.id;
        _measSpeichern();
        renderMeasureLayer();
      });
      _measureLeafletGroup.push(form);
    }

    // Teilstrecken
    _measSegmentEtiketten(item.points, item.color, item.type === 'area')
      .forEach(m => { m.addTo(leafletMap); _measureLeafletGroup.push(m); });

    // Eckpunkte: ausgewaehlt als ziehbare Griffe, sonst nur als Punkt
    item.points.forEach((p, idx) => {
      if (ausgewaehlt) {
        const griff = L.marker([p.lat, p.lng], {
          draggable: true,
          icon: L.divIcon({
            html: '<div style="width:13px;height:13px;border-radius:50%;background:white;border:3px solid '
                + item.color + ';box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>',
            className: '', iconSize: [13, 13], iconAnchor: [6.5, 6.5]
          })
        }).addTo(leafletMap);
        griff.on('drag', ev => {
          const ll = ev.target.getLatLng();
          item.points[idx] = { lat: ll.lat, lng: ll.lng };
          if (form) form.setLatLngs(item.points.map(q => [q.lat, q.lng]));
        });
        griff.on('dragend', () => {
          item.result = measErgebnis(item.type, item.points);
          _measSpeichern();
          renderMeasureLayer();
        });
        // Rechtsklick auf eine Ecke nimmt sie weg. Die Untergrenze bleibt
        // gewahrt: zwei Punkte fuer eine Strecke, drei fuer eine Flaeche.
        griff.on('contextmenu', ev => {
          L.DomEvent.stop(ev);
          const min = item.type === 'area' ? 3 : 2;
          if (item.points.length <= min) {
            ui.toast('Eine ' + (item.type === 'area' ? 'Fläche braucht mindestens 3' : 'Strecke braucht mindestens 2') + ' Punkte.', 'fehler');
            return;
          }
          item.points.splice(idx, 1);
          item.result = measErgebnis(item.type, item.points);
          _measSpeichern();
          renderMeasureLayer();
        });
        _measureLeafletGroup.push(griff);
      } else {
        const dot = L.circleMarker([p.lat, p.lng], { radius: 4, color: item.color,
          fillColor: 'white', fillOpacity: 1, weight: 2 }).addTo(leafletMap);
        dot.on('click', ev => { L.DomEvent.stop(ev); klick(); });
        _measureLeafletGroup.push(dot);
      }
    });

    // Etikett — ziehbar, wenn die Messung ausgewaehlt ist: dann wandert die
    // ganze Messung mit, waehrend die Griffe einzelne Ecken versetzen.
    const mittel = item.type === 'area'
      ? item.points.reduce((a, p) => ({ lat: a.lat + p.lat / item.points.length,
                                        lng: a.lng + p.lng / item.points.length }), { lat: 0, lng: 0 })
      : item.points[item.points.length - 1];
    const label = L.marker([mittel.lat, mittel.lng], {
      draggable: ausgewaehlt,
      icon: _measEtikett(item.result + (ausgewaehlt ? ' ·' : ''), item.color)
    }).addTo(leafletMap);
    if (ausgewaehlt) {
      let vorher = null;
      label.on('dragstart', ev => { vorher = ev.target.getLatLng(); });
      label.on('drag', ev => {
        const jetzt = ev.target.getLatLng();
        const dLat = jetzt.lat - vorher.lat, dLng = jetzt.lng - vorher.lng;
        vorher = jetzt;
        item.points = item.points.map(p => ({ lat: p.lat + dLat, lng: p.lng + dLng }));
        if (form) form.setLatLngs(item.points.map(q => [q.lat, q.lng]));
      });
      label.on('dragend', () => { _measSpeichern(); renderMeasureLayer(); });
    } else {
      label.on('click', ev => { L.DomEvent.stop(ev); klick(); });
    }
    _measureLeafletGroup.push(label);
  });
}

// Abstand eines Punktes zur Strecke a–b, in Gradmass genaehert. Fuer die
// Frage «an welche Seite gehoert der neue Punkt» reicht das: verglichen
// werden nur Abstaende untereinander.
function _measAbstandZurStrecke(p, a, b) {
  const vx = b.lng - a.lng, vy = b.lat - a.lat;
  const wx = p.lng - a.lng, wy = p.lat - a.lat;
  const len2 = vx * vx + vy * vy;
  const t = len2 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0;
  const dx = wx - t * vx, dy = wy - t * vy;
  return Math.sqrt(dx * dx + dy * dy);
}

// Eine einzelne Messung loeschen — der Radierer, den es bisher nicht gab:
// «Zuruecksetzen» warf den ganzen Layer weg.
function measLoeschen(id) {
  _measureLayerItems = _measureLayerItems.filter(it => it.id !== id);
  if (_measAuswahlId === id) _measAuswahlId = null;
  _measSpeichern();
  renderMeasureLayer();
  showMeasureLabel('Messung gelöscht');
  setTimeout(() => { if (currentMode === 'measure' && !_measRadierer) hideMeasureLabel(); }, 1200);
}

function toggleMeasRadierer() {
  _measRadierer = !_measRadierer;
  if (_measRadierer) _measAuswahlId = null;
  const btn = document.getElementById('btn-measure-radierer');
  if (btn) btn.classList.toggle('active', _measRadierer);
  if (leafletMap) leafletMap.getContainer().style.cursor = _measRadierer ? 'not-allowed' : 'crosshair';
  showMeasureLabel(_measRadierer
    ? 'Radierer: Messung antippen zum Löschen'
    : (measureType === 'area' ? 'Ersten Eckpunkt antippen (mind. 3)' : 'Ersten Punkt antippen'));
  renderMeasureLayer();
}

function toggleMeasureLayer() {
  _measureLayerVisible = !_measureLayerVisible;
  const btn = document.getElementById('btn-measure-layer');
  if (btn) {
    btn.classList.toggle('active', _measureLayerVisible);
    btn.innerHTML = _measureLayerVisible
      ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
      : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    btn.title = _measureLayerVisible ? 'Bemassungen ausblenden' : 'Bemassungen einblenden';
  }
  // Auch die LAUFENDE Messung ausblenden. Vorher betraf der Schalter nur die
  // gespeicherten — auf der Karte blieben Linie, Punkte und Etikett stehen,
  // obwohl «ausgeblendet» angeschrieben war.
  const anzeigen = _measureLayerVisible ? '' : 'none';
  [measurePolyline, measurePolygon, measureLabel].forEach(o => {
    if (o && o._path) o._path.style.display = anzeigen;
    else if (o && o._icon) o._icon.style.display = anzeigen;
  });
  measureMarkers.forEach(m => { if (m._path) m._path.style.display = anzeigen; });
  _measSegGruppe.forEach(m => { if (m._icon) m._icon.style.display = anzeigen; });
  renderMeasureLayer();
}

function setMeasureType(type) {
  measureType = type;
  document.getElementById('btn-measure-dist').classList.toggle('active', type === 'dist');
  document.getElementById('btn-measure-area').classList.toggle('active', type === 'area');
  clearCurrentMeasure();
}

// Segment-Etiketten der laufenden Messung
let _measSegGruppe = [];
function _measSegGruppeLeeren() {
  _measSegGruppe.forEach(m => { try { m.remove(); } catch {} });
  _measSegGruppe = [];
}

// Nur aktuelle (noch nicht gespeicherte) Messung löschen
function clearCurrentMeasure() {
  if (measurePolyline) { measurePolyline.remove(); measurePolyline = null; }
  if (measurePolygon)  { measurePolygon.remove();  measurePolygon  = null; }
  measureMarkers.forEach(m => m.remove()); measureMarkers = [];
  if (measureLabel)    { measureLabel.remove();    measureLabel    = null; }
  _measSegGruppeLeeren();
  measurePoints = [];
  showMeasureLabel(measureType === 'area' ? 'Ersten Eckpunkt antippen (mind. 3)' : 'Ersten Punkt antippen');
}

// Legacy: resetMeasure = clearCurrentMeasure + Layer löschen
function resetMeasure() {
  clearCurrentMeasure();
  _measureLayerItems = [];
  _measAuswahlId = null;
  try {
    const all = jsonParse(store.getItem(MEASURE_KEY())) || {};
    delete all[currentPairId];
    store.setItem(MEASURE_KEY(), JSON.stringify(all));
  } catch {}
  renderMeasureLayer();
}

// Shoelace formula für Fläche in m²
function calcArea(pts) {
  if (pts.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    // Konvertierung zu Meter-Koordinaten (vereinfacht)
    const x1 = pts[i].lng * Math.cos(pts[i].lat * Math.PI/180) * 111320;
    const y1 = pts[i].lat * 110540;
    const x2 = pts[j].lng * Math.cos(pts[j].lat * Math.PI/180) * 111320;
    const y2 = pts[j].lat * 110540;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

function formatArea(m2) {
  if (m2 >= 10000) return (m2 / 10000).toFixed(2) + ' ha';
  return Math.round(m2) + ' m²';
}

function startMeasure() {
  measurePoints = [];
  showMeasureLabel(measureType === 'area' ? 'Ersten Eckpunkt antippen (mind. 3)' : 'Ersten Punkt antippen');
  if (!leafletMap) return;
  leafletMap.getContainer().style.cursor = 'crosshair';
  leafletMap.on('click', onMeasureClick);
}

function stopMeasure() {
  if (!leafletMap) return;
  leafletMap.off('click', onMeasureClick);
  leafletMap.getContainer().style.cursor = '';
  if (measurePolyline) { measurePolyline.remove(); measurePolyline = null; }
  if (measurePolygon)  { measurePolygon.remove();  measurePolygon  = null; }
  measureMarkers.forEach(m => m.remove()); measureMarkers = [];
  if (measureLabel) { measureLabel.remove(); measureLabel = null; }
  _measSegGruppeLeeren();
  measurePoints = [];
  _measRadierer = false;
  _measAuswahlId = null;
  document.getElementById('btn-measure-radierer')?.classList.remove('active');
  renderMeasureLayer();
  hideMeasureLabel();
}

function onMeasureClick(e) {
  if (_measRadierer) return;                 // im Radiermodus wird nicht gemessen
  measurePoints.push(e.latlng);
  const dot = L.circleMarker(e.latlng, {
    radius: 5, color: '#1a3a5c', fillColor: 'white', fillOpacity: 1, weight: 2
  }).addTo(leafletMap);
  measureMarkers.push(dot);

  const farbe = _messFarbe(measureType);
  _measSegGruppeLeeren();

  if (measureType === 'dist') {
    if (measurePoints.length === 1) {
      showMeasureLabel('Zweiten Punkt antippen');
    } else {
      if (measurePolyline) measurePolyline.remove();
      measurePolyline = L.polyline(measurePoints, { color: farbe, opacity: _messAlpha(), weight: 2, dashArray: '6,4' }).addTo(leafletMap);
      const ergebnis = measErgebnis('dist', measurePoints);
      if (measureLabel) measureLabel.remove();
      measureLabel = L.marker(measurePoints[measurePoints.length-1], {
        icon: _measEtikett(ergebnis, farbe)
      }).addTo(leafletMap);
      _measSegGruppe = _measSegmentEtiketten(measurePoints, farbe, false);
      _measSegGruppe.forEach(m => m.addTo(leafletMap));
      showMeasureLabel(ergebnis + ' · Weiteren Punkt oder Messen beenden');
    }
  } else {
    if (measurePoints.length < 3) {
      showMeasureLabel(measurePoints.length + ' Punkt(e) · mind. 3 für Fläche');
    }
    if (measurePoints.length >= 2) {
      if (measurePolyline) measurePolyline.remove();
      measurePolyline = L.polyline([...measurePoints, measurePoints[0]], { color: farbe, opacity: _messAlpha(), weight: 2, dashArray: '6,4' }).addTo(leafletMap);
      _measSegGruppe = _measSegmentEtiketten(measurePoints, farbe, measurePoints.length >= 3);
      _measSegGruppe.forEach(m => m.addTo(leafletMap));
    }
    if (measurePoints.length >= 3) {
      if (measurePolygon) measurePolygon.remove();
      measurePolygon = L.polygon(measurePoints, { color: farbe, opacity: _messAlpha(), fillColor: farbe, fillOpacity: 0.12 * _messAlpha(), weight: 2 }).addTo(leafletMap);
      const ergebnis = measErgebnis('area', measurePoints);
      if (measureLabel) measureLabel.remove();
      measureLabel = L.marker(measurePolygon.getBounds().getCenter(), {
        icon: _measEtikett(ergebnis, farbe)
      }).addTo(leafletMap);
      showMeasureLabel(ergebnis + ' · Weiteren Punkt oder Messen beenden');
    }
  }
}

function showMeasureLabel(text) {
  let el = document.getElementById('measure-hint');
  if (!el) {
    el = document.createElement('div');
    el.id = 'measure-hint';
    // 52 px statt 10: darueber steht die Standort-Auswahl mit ihren Pfeilen,
    // und die Hinweiszeile legte sich mitten darauf.
    el.style.cssText = 'position:absolute;top:52px;left:50%;transform:translateX(-50%);z-index:700;background:rgba(26,58,92,0.92);color:white;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;pointer-events:none;white-space:nowrap;max-width:calc(100% - 24px);overflow:hidden;text-overflow:ellipsis;';
    document.querySelector('.map-container').appendChild(el);
  }
  el.textContent = text;
  el.style.display = 'block';
}

function hideMeasureLabel() {
  const el = document.getElementById('measure-hint');
  if (el) el.style.display = 'none';
}

// ============================================================
// TITEL BEARBEITEN
// ============================================================

/** Gibt den Namen des aktuell aktiven Projekts zurück (für Exporte/Dateinamen). */
function getActiveProjectName() {
  const p = _projects && _projects.find(x => x.id === _activeId);
  if (p && p.name) return p.name;
  return document.getElementById('app-title-text')?.textContent?.trim() || '';
}

function startEditTitle() {
  const span  = document.getElementById('app-title-text');
  const input = document.getElementById('app-title-input');
  input.value = span.textContent;
  span.style.display  = 'none';
  input.style.display = 'inline-block';
  input.focus(); input.select();
}

function saveTitle() {
  const span  = document.getElementById('app-title-text');
  const input = document.getElementById('app-title-input');
  const val = input.value.trim();
  if (val) {
    span.textContent = val;
    store.setItem(TITEL_KEY, val);
    // Projektnamen in Metadaten synchronisieren
    const p = _projects.find(x => x.id === _activeId);
    if (p) { p.name = val; saveProjectsMeta(_projects); }
  }
  input.style.display = 'none';
  span.style.display  = '';
}

function cancelEditTitle() {
  document.getElementById('app-title-input').style.display = 'none';
  document.getElementById('app-title-text').style.display  = '';
}

// ============================================================
// PROJEKTKENNDATEN MODAL
// ============================================================
function loadKenndaten() {
  try { return jsonParse(store.getItem(KENNDATEN_KEY) || '{}'); } catch { return {}; }
}
function saveKenndatenData(obj) {
  store.setItem(KENNDATEN_KEY, JSON.stringify(obj));
}

function openProjektKenndatenModal() {
  const kd = loadKenndaten();
  const titleEl = document.getElementById('app-title-text');
  document.getElementById('pkd-name').value = titleEl?.textContent?.trim() || '';
  document.getElementById('pkd-isp').value       = kd.isp        || '';
  document.getElementById('pkd-linie').value     = kd.linie      || '';
  document.getElementById('pkd-von').value       = kd.von        || '';
  document.getElementById('pkd-bis').value       = kd.bis        || '';
  document.getElementById('pkd-stand').value     = kd.stand      || '';
  document.getElementById('pkd-bearbeiter').value= kd.bearbeiter || '';
  document.getElementById('projektkd-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('pkd-name')?.focus(), 50);
}

function closeProjektKenndatenModal() {
  document.getElementById('projektkd-modal').style.display = 'none';
}

function saveProjektKenndaten() {
  const name  = document.getElementById('pkd-name')?.value.trim();
  const isp        = document.getElementById('pkd-isp')?.value.trim()       || '';
  const linie      = document.getElementById('pkd-linie')?.value.trim()     || '';
  const von        = document.getElementById('pkd-von')?.value.trim()       || '';
  const bis        = document.getElementById('pkd-bis')?.value.trim()       || '';
  const stand      = document.getElementById('pkd-stand')?.value            || '';
  const bearbeiter = document.getElementById('pkd-bearbeiter')?.value.trim()|| '';

  // Projektname speichern (gleiche Logik wie saveTitle)
  if (name) {
    const span = document.getElementById('app-title-text');
    if (span) { span.textContent = name; }
    store.setItem(TITEL_KEY, name);
    const p = _projects.find(x => x.id === _activeId);
    if (p) { p.name = name; saveProjectsMeta(_projects); }
  }

  // Weitere Kenndaten speichern
  saveKenndatenData({ isp, linie, von, bis, stand, bearbeiter });

  // Header-Sub aktualisieren
  updateHeaderSub();

  closeProjektKenndatenModal();
}

function updateHeaderSub() {
  const kd   = loadKenndaten();
  const sub  = document.getElementById('header-sub');
  if (!sub) return;
  const parts = [];
  if (kd.linie) parts.push(`Linie ${kd.linie}`);
  if (kd.von && kd.bis) parts.push(`km ${kd.von}–${kd.bis}`);
  else if (kd.von)      parts.push(`ab km ${kd.von}`);
  if (kd.isp)  parts.push(`ISP ${kd.isp}`);
  const pairsCount = typeof PAIRS !== 'undefined' ? PAIRS.length : 0;
  if (pairsCount) parts.unshift(`${pairsCount} Standorte`);
  sub.textContent = parts.join(' · ');
}

// Projekttitel + Kenndaten laden
(function() {
  const saved = store.getItem(TITEL_KEY);
  if (saved) {
    const el = document.getElementById('app-title-text');
    if (el) { el.textContent = saved; }
  }
  document.title = 'Fundamentbau';
  updateHeaderSub();
})();

// ============================================================
// MODAL KARTEN-PICKER — Standort per Karte / Suche eingeben
// ============================================================
// ============================================================
// VOLLBILD-ERFASSUNGSANSICHT
// ============================================================
let createMapLeaflet = null;
let createRsMarker = null;
let createRksMarker = null;
let createBsMarker = null;
let createPickMode = 'rs';
let createEditId = null;
let _createInstallMode = false;  // true wenn "+ Installation" geöffnet wurde
let _createSearchTimer = null;
let _createExistingGroup = null;

const CREATE_RS_ICON = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>',
  iconAnchor: [9, 9]
});
const CREATE_RKS_ICON = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#16a34a;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>',
  iconAnchor: [9, 9]
});
const CREATE_BS_ICON = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:4px;background:#b45309;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>',
  iconAnchor: [9, 9]
});
const CREATE_EXISTING_RS_ICON = L.divIcon({
  className: '',
  html: '<div style="width:12px;height:12px;border-radius:50%;background:#9ca3af;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.25);opacity:0.6;"></div>',
  iconAnchor: [6, 6]
});
const CREATE_EXISTING_RKS_ICON = L.divIcon({
  className: '',
  html: '<div style="width:12px;height:12px;border-radius:50%;background:#6b7280;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.25);opacity:0.6;"></div>',
  iconAnchor: [6, 6]
});

function toggleCreateMapFullscreen() {
  const main = document.querySelector('.create-main');
  if (!main) return;
  const isFS = main.classList.toggle('create-map-fullscreen');
  if (createMapLeaflet) setTimeout(() => createMapLeaflet.invalidateSize(), 50);
}

function locateCreateMap() {
  if (!createMapLeaflet) return;
  if (!navigator.geolocation) { ui.toast('GPS nicht verfügbar', 'fehler'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const ll = [pos.coords.latitude, pos.coords.longitude];
    createMapLeaflet.setView(ll, 17);
  }, () => ui.toast('Standort konnte nicht ermittelt werden.', 'fehler'), { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
}

function toggleInstStatus(pairId, key) {
  const p = PAIRS.find(x => x.id === pairId);
  if (!p) return;
  p[key] = !p[key];
  savePairs();
  // Sidebar ohne volle showDetail-Neu-Render aktualisieren
  const _si = document.getElementById('sec-inst-content');
  if (_si) {
    // Checkbox-DIVs direkt toggling
    const labels = _si.querySelectorAll('label[onclick]');
    labels.forEach(lbl => {
      const onclk = lbl.getAttribute('onclick') || '';
      if (!onclk.includes(`'${key}'`)) return;
      const checked = !!p[key];
      const box = lbl.querySelector('div');
      if (box) {
        box.style.borderColor  = checked ? '#1a3a5c' : '#d1d5db';
        box.style.background   = checked ? '#1a3a5c' : 'white';
        box.innerHTML = checked
          ? '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 6 5 9 10 3"/></svg>'
          : '';
      }
      const span = lbl.querySelector('span');
      if (span) {
        span.style.color      = checked ? '#1a3a5c' : '#6b7280';
        span.style.fontWeight = checked ? '600' : '400';
      }
    });
    // Bestelldatum-Zeile ein-/ausblenden
    if (key === 'instBestellt') {
      const _row = document.getElementById('inst-bestellt-datum-row');
      if (_row) _row.style.display = p.instBestellt ? '' : 'none';
    }
    if (key === 'instRueckgabeOk') {
      const _row = document.getElementById('inst-rueckgabe-datum-row');
      if (_row) _row.style.display = p.instRueckgabeOk ? '' : 'none';
    }
  }
}

// Die auf der Karte gemessene Flaeche als Installationsflaeche uebernehmen.
// Genommen wird die zuletzt gespeicherte Flaechenmessung dieses Standorts —
// gemessen wird ohnehin auf der Karte dieser Installationsflaeche.
function instFlaecheAusMessung(pairId) {
  const flaechen = (_measureLayerItems || []).filter(it => it.type === 'area');
  if (!flaechen.length) {
    ui.toast('Keine Flächenmessung auf dieser Karte. Unter «Messen» eine Fläche aufnehmen und speichern.', 'fehler');
    return;
  }
  const letzte = flaechen[flaechen.length - 1];
  const m2 = calcArea(letzte.points);
  if (!(m2 > 0)) { ui.toast('Die Messung ergibt keine Fläche.', 'fehler'); return;

  }
  const p = PAIRS.find(x => x.id === pairId);
  if (!p) return;
  p.flaeche  = Math.round(m2 * 10) / 10;
  p.flaecheL = null;              // die Masse passen nicht mehr zur Flaeche
  p.flaecheB = null;
  savePairs();
  if (typeof logChange === 'function')
    logChange(pairId, 'Fläche aus Kartenmessung', p.flaeche + ' m²', 'sonstig');
  showDetail(pairId);
  if (typeof renderInstallationen === 'function') renderInstallationen();
  ui.toast('Fläche übernommen: ' + p.flaeche + ' m²', 'erfolg');
}

// Ein einzelnes Feld der Installation sichern (Datumsfelder der Seitenleiste)
function saveInstFeld(pairId, feld, wert) {
  const p = PAIRS.find(x => x.id === pairId);
  if (!p) return;
  p[feld] = wert || '';
  savePairs();
}

function saveInstBestelltDatum(pairId, value) {
  const p = PAIRS.find(x => x.id === pairId);
  if (!p) return;
  p.instBestelltDatum = value || '';
  savePairs();
}

function openCreateInstallation(id) {
  _createInstallMode = true;
  openCreateView(id || null);
}

function openCreateView(id) {
  createEditId = id || null;
  // _createInstallMode wird von openCreateInstallation gesetzt; beim normalen Aufruf zurücksetzen,
  // ausser wenn das zu bearbeitende Pair selbst eine Installation ist
  if (!_createInstallMode && id) {
    const _editPair = PAIRS.find(p => p.id === id);
    if (_editPair?._objType === 'installation') _createInstallMode = true;
  }
  if (!_createInstallMode && !id) _createInstallMode = false;
  document.getElementById('overview-view').style.display = 'none';
  document.getElementById('detail-view').style.display = 'none';
  const _cv = document.getElementById('create-view');
  _cv.style.display = 'block';
  _cv.style.visibility = 'visible';
  _cv.style.pointerEvents = '';
  bannerProjektZeigen(false);
  document.getElementById('create-view-title').textContent = _createInstallMode
    ? (id ? 'Installation bearbeiten' : 'Installation erfassen')
    : (id ? 'Standort bearbeiten' : 'Standort erfassen');

  // Phasenabhängige Maske anwenden
  applyCreatePhase();

  // Felder leeren oder mit bestehenden Werten füllen
  let mapCenter;
  if (id) {
    const p = PAIRS.find(x => x.id === id);
    // Bauprojekt-Felder: autoritativer Speicher ist loadAllBauprojekt() (Sidebar schreibt nur dorthin)
    const isBPedit = _activePhase === 'bauprojekt' || _activePhase === 'ausfuehrung';
    const bpStored = isBPedit ? (loadAllBauprojekt()[id] || {}) : {};
    const bp = k => bpStored[k] ?? p[k] ?? ''; // BP-Speicher hat Vorrang vor PAIRS

    updateSchichtDatalist();
    document.getElementById('c-bezeichnung').value  = p.bezeichnung || '';
    document.getElementById('c-tag').value          = p.tag   || '';
    const _cnacht = document.getElementById('c-nacht'); if (_cnacht) _cnacht.value = p.nacht || '';
    document.getElementById('c-mast').value         = p.mast || '';
    document.getElementById('c-km-rs').value        = p.km_rs || '';
    document.getElementById('c-km-rks').value       = p.km_rks || '';
    document.getElementById('c-tiefe').value        = p.tiefe || '';
    const schlitzEl = document.getElementById('c-schlitz'); if (schlitzEl) schlitzEl.value = p.schlitz || '';
    document.getElementById('c-gleis').value        = p.gleis || '';
    document.getElementById('c-strecke').value      = p.strecke    || '';
    const _csnr = document.getElementById('c-streckennr'); if (_csnr) _csnr.value = p.streckennr || '';
    const _cgh  = document.getElementById('c-gelaendehoehe'); if (_cgh) _cgh.value = p.gelaendehoehe ?? '';
    const _czEl = document.getElementById('c-zugang');       if (_czEl) _czEl.value = p.zugang || '';
    // Bauprojekt-Felder (Sidebar-Werte, Felder sind im Create-Form ausgeblendet)
    const _cauEl = document.getElementById('c-ausfuehrung'); if (_cauEl) _cauEl.value = p.ausfuehrung || '';
    const _cbEl  = document.getElementById('c-bestand');     if (_cbEl)  _cbEl.value  = bp('bestand') || 'neu';
    const _cmEl  = document.getElementById('c-massnahme');   if (_cmEl)  _cmEl.value  = bp('massnahme') || '';
    const _cslEl = document.getElementById('c-sicherung-link'); if (_cslEl) _cslEl.value = bp('sicherungLink') || '';
    const _csbEl = document.getElementById('c-sicherung-bemerkung'); if (_csbEl) _csbEl.value = bp('sicherungBemerkung') || '';
    const _cftEl = document.getElementById('c-fundtyp');     if (_cftEl) _cftEl.value = bp('fundtyp') || '';
    const _cnlEl = document.getElementById('c-nachweis-link'); if (_cnlEl) _cnlEl.value = bp('nachweisLink') || '';
    const _bodenEl = document.getElementById('c-boden'); if (_bodenEl) _bodenEl.value = bp('boden');
    // Installations-Felder füllen (wenn Installation)
    if (p._objType === 'installation') {
      const _ib = id => { const el = document.getElementById(id); if (el) el.value = ''; };
      _ib('c-inst-bezeichnung'); _ib('c-inst-typ'); _ib('c-inst-flaeche-l'); _ib('c-inst-flaeche-b'); _ib('c-inst-flaeche'); _ib('c-inst-von'); _ib('c-inst-bis'); _ib('c-inst-bestelllink'); _ib('c-inst-bemerkung'); _ib('c-inst-frist'); _ib('c-inst-gleisabstand');
      const _is = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
      _is('c-inst-bezeichnung', p.bezeichnung);
      _is('c-inst-typ', p.installTyp);
      _is('c-inst-flaeche-l', p.flaecheL);
      _is('c-inst-flaeche-b', p.flaecheB);
      _is('c-inst-flaeche', p.flaeche);
      _is('c-inst-von', p.von);
      _is('c-inst-bis', p.bis);
      _is('c-inst-bestelllink', p.instBestellLink);
      _is('c-inst-bemerkung', p.bemerkung);
      _is('c-inst-frist', p.instFrist);
      _is('c-inst-gleisabstand', p.instGleisAbstand);
      const _cab = document.getElementById('c-inst-abschaltung'); if (_cab) _cab.checked = !!p.instAbschaltung;
      const _cer = document.getElementById('c-inst-erdung');      if (_cer) _cer.checked = !!p.instErdung;
    }
    // Koordinaten
    document.getElementById('c-rs-e').value  = p.rs?.e || '';
    document.getElementById('c-rs-n').value  = p.rs?.n || '';
    document.getElementById('c-rks-e').value = p.rks?.e || '';
    document.getElementById('c-rks-n').value = p.rks?.n || '';
    document.getElementById('c-bs-e').value  = p.bs?.e || '';
    document.getElementById('c-bs-n').value  = p.bs?.n || '';
    const bsKm = document.getElementById('c-bs-km'); if (bsKm) bsKm.value = p.bs?.km || '';
    const bsTiefe = document.getElementById('c-bs-tiefe'); if (bsTiefe) bsTiefe.value = p.bs?.tiefe || '';
    const bsAbbruch = document.getElementById('c-bs-abbruch'); if (bsAbbruch) bsAbbruch.value = p.bs?.abbruch || '';
    const bsBem = document.getElementById('c-bs-bemerkung'); if (bsBem) bsBem.value = p.bs?.bemerkung || '';
    document.getElementById('c-fund-e2').value = p.rs?.e || '';
    document.getElementById('c-fund-n2').value = p.rs?.n || '';
    const _mc = (p.rs?.e && p.rs?.n) ? lv95ToWgs84(p.rs.e, p.rs.n) : { invalid: true };
    mapCenter = _mc.invalid ? { lat: 47.566, lng: 9.106 } : _mc;
    // Konditionelle UI-Zustände wiederherstellen
    onCreateBestandChange();
    onCreateMassnahmeChange();
    onCreateFundtypChange();
  } else {
    ['c-bezeichnung','c-mast','c-km-rs','c-km-rks','c-tiefe','c-rs-e','c-rs-n',
     'c-rks-e','c-rks-n','c-bs-e','c-bs-n','c-bs-km','c-bs-tiefe','c-bs-abbruch','c-bs-bemerkung',
     'c-zugang','c-strecke','c-streckennr','c-gelaendehoehe','c-ausfuehrung',
     'c-massnahme','c-sicherung-link','c-sicherung-bemerkung','c-fundtyp',
     'c-nachweis-link','c-boden'
    ].forEach(fid => { const el = document.getElementById(fid); if (el) el.value = ''; });
    // Standard-Feldbelegung aus Vorlage anwenden
    const _tplDefs = loadTemplateDefaults();
    document.getElementById('c-tag').value    = _tplDefs.tag   || '';
    const _cnaEl = document.getElementById('c-nacht'); if (_cnaEl) _cnaEl.value = _tplDefs.nacht || '';
    document.getElementById('c-gleis').value  = _tplDefs.gleis || '';
    const _ctiefeEl = document.getElementById('c-tiefe'); if (_ctiefeEl) _ctiefeEl.value = _tplDefs.tiefe || '';
    const _cb2 = document.getElementById('c-bestand'); if (_cb2) _cb2.value = 'neu';
    onCreateBestandChange();
    onCreateFundtypChange();
    // Schicht-Datalists befüllen
    updateSchichtDatalist();
    // Letzten Standort als Referenz für Kartenzentrierung
    if (PAIRS.length) {
      const last = PAIRS[PAIRS.length - 1];
      const src  = last.rs?.e ? last.rs : (last.rks?.e ? last.rks : null);
      const c    = src ? lv95ToWgs84(src.e, src.n) : null;
      mapCenter  = (c && !c.invalid) ? c : { ...CREATE_MAP_NOTFALL, ersatz: true };
    } else {
      mapCenter = { ...CREATE_MAP_NOTFALL, ersatz: true };
    }
  }

  // Koordinaten-Labels: im Edit-Modus vorhandene Werte anzeigen
  if (id) {
    const p2 = PAIRS.find(x => x.id === id);
    const isBPe = _activePhase === 'bauprojekt' || _activePhase === 'ausfuehrung';
    if (isBPe && p2?.rs?.e) {
      const fl = document.getElementById('create-fund-coord-lbl');
      if (fl) fl.textContent = `E ${p2.rs.e} / N ${p2.rs.n}`;
    } else {
      if (p2?.rs?.e)  document.getElementById('create-rs-coord-lbl').textContent  = `RS: E ${p2.rs.e} / N ${p2.rs.n}`;
      if (p2?.rks?.e) document.getElementById('create-rks-coord-lbl').textContent = `RKS: E ${p2.rks.e} / N ${p2.rks.n}`;
      if (p2?.bs?.e)  { const bl = document.getElementById('create-bs-coord-lbl'); if (bl) bl.textContent = `BS: E ${p2.bs.e} / N ${p2.bs.n}`; }
    }
  } else {
    document.getElementById('create-rs-coord-lbl').textContent = 'RS: –';
    document.getElementById('create-rks-coord-lbl').textContent = 'RKS: –';
    const fundLbl = document.getElementById('create-fund-coord-lbl');
    if (fundLbl) fundLbl.textContent = 'Koordinaten: –';
    const bsLbl = document.getElementById('create-bs-coord-lbl');
    if (bsLbl) bsLbl.textContent = 'BS: –';
  }
  document.getElementById('create-dist-box').style.display = 'none';
  document.getElementById('create-dist-map-badge').style.display = 'none';
  document.getElementById('create-map-search').value = '';
  document.getElementById('create-search-results').style.display = 'none';

  // Datalist mit Bibliotheks-Fundamenttypen aktualisieren
  refreshFundtypDatalist();

  // Kartenhöhe explizit setzen (umgeht CSS-Chain-Probleme)
  const _mapEl = document.getElementById('create-map');
  if (_mapEl) _mapEl.style.height = (window.innerHeight - 110) + 'px';

  // Karte nach Layout-Berechnung initialisieren
  setTimeout(() => {
    initCreateMap(mapCenter);
    setCreatePickMode('rs');
    // Leaflet-Grösse nach Render-Zyklus neu berechnen
    setTimeout(() => { if (createMapLeaflet) createMapLeaflet.invalidateSize(); }, 200);
  }, 80);
}

// Letzte Rueckfallposition, wenn weder eine Strecke noch ein bestehender
// Standort noch GPS etwas Besseres liefern: Mitte des bisherigen Projektgebiets.
const CREATE_MAP_NOTFALL = { lat: 47.566, lng: 9.106 };

// Kartenart der Erfassungskarte — waehrend der Sitzung gemerkt, damit sie
// nicht bei jedem neuen Standort zurueckspringt.
let _createBasemapKey  = 'swiss-luft';
let _createBaseLayer   = null;
let _createUmweltEbenen = [];

// ── Kartenausschnitt aus Strecke oder Liniennummer ───────────
// Beim Anlegen steht die Linie meist schon fest, der Punkt noch nicht. Statt
// die Karte irgendwo stehen zu lassen, wird sie auf diese Linie gestellt.
let _createStreckeTimer = null;

function onCreateStreckeEingabe() {
  clearTimeout(_createStreckeTimer);
  _createStreckeTimer = setTimeout(() => createKarteAusVorgabe(true), 600);
}

// nurStrecke=true: kein Rueckgriff auf GPS (der Nutzer hat gerade getippt)
async function createKarteAusVorgabe(nurStrecke) {
  const karte = createMapLeaflet;
  if (!karte) return;
  // Gesetzte Punkte nicht ueberfahren
  const gesetzt = () => karte !== createMapLeaflet || createRsMarker || createRksMarker;
  if (gesetzt()) return;

  const nr    = document.getElementById('c-streckennr')?.value.trim() || '';
  const name  = document.getElementById('c-strecke')?.value.trim() || '';
  // Die Liniennummer steckt haeufig im Streckennamen («Linie 755 Altstetten…»)
  const linie = (nr.match(/\d{3}/) || name.match(/\d{3}/) || [])[0];

  // Was bereits geladen ist, kostet keine Abfrage
  const ausCache = (typeof bahnSuche === 'function' ? bahnSuche(linie || name) : [])[0];
  if (ausCache && !gesetzt()) { karte.setView([ausCache.lat, ausCache.lon], 15); return; }

  if (linie && typeof bahnLinieOrtOnline === 'function') {
    const ort = await bahnLinieOrtOnline(linie);
    if (ort && !gesetzt()) { karte.setView([ort.lat, ort.lon], 14); return; }
  }
  if (name && typeof bahnStationSuchenOnline === 'function') {
    const st = (await bahnStationSuchenOnline(name))[0];
    if (st && !gesetzt()) { karte.setView([st.lat, st.lon], 15); return; }
  }
  if (nurStrecke || !navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    pos => { if (!gesetzt()) karte.setView([pos.coords.latitude, pos.coords.longitude], 18); },
    () => { /* ohne GPS bleibt die Rueckfallposition stehen */ },
    { enableHighAccuracy: true, maximumAge: 60000, timeout: 8000 }
  );
}

function setCreateBaseLayer(key) {
  _createBasemapKey = key;
  const sel = document.getElementById('create-basemap-select');
  if (sel) sel.value = key;
  if (!createMapLeaflet) return;
  _createUmweltEbenen.forEach(l => { try { createMapLeaflet.removeLayer(l); } catch {} });
  _createUmweltEbenen = [];
  if (_createBaseLayer) createMapLeaflet.removeLayer(_createBaseLayer);
  // «Umwelt» ist die graue Landeskarte mit den Fachebenen darueber
  _createBaseLayer = makeTile(key === 'umwelt' ? 'swiss-karte' : key,
    key === 'umwelt' ? { className: 'umwelt-base-tile' } : {}).addTo(createMapLeaflet);
  _createBaseLayer.bringToBack();
  if (key === 'umwelt') {
    _createUmweltEbenen = _buildUmweltOverlays();
    _createUmweltEbenen.forEach(l => l.addTo(createMapLeaflet));
  }
}

function initCreateMap(center) {
  // Vorherige Instanz bereinigen
  if (createMapLeaflet) {
    createMapLeaflet.remove();
    createMapLeaflet = null;
    createRsMarker = null;
    createRksMarker = null;
    createBsMarker = null;
    _createExistingGroup = null;
  }

  const el = document.getElementById('create-map');
  if (!el) return;

  // Quellenangabe wie auf den uebrigen Karten
  createMapLeaflet = L.map('create-map', { zoomControl: true, ...KARTE_DREH_OPT })
    .setView([center.lat, center.lng], 19);
  karteDrehungAnmelden(createMapLeaflet);

  // Kein bestehender Standort als Anhaltspunkt: erst die vorgegebene Strecke
  // versuchen, sonst die eigene Position. Beides wird nachgeholt, sobald es
  // vorliegt — die Karte steht solange auf der Rueckfallposition.
  if (center.ersatz) createKarteAusVorgabe();

  setCreateBaseLayer(_createBasemapKey);

  // Bahnlinien sind standardmässig an (App-Einstellungen › Kartendarstellung)
  if (typeof bahnStandardAnwenden === 'function') setTimeout(() => bahnStandardAnwenden('create'), 60);

  // Bestehende Standorte ausgegraut anzeigen — nur in der Baugrundphase (Sondagen)
  _createExistingGroup = L.layerGroup().addTo(createMapLeaflet);
  if (_activePhase === 'baugrund') {
    PAIRS.forEach(p => {
      if (p.id === createEditId) return; // Bearbeiteter Standort nicht ausgegraut
      const name = p.bezeichnung || 'Standort ' + p.id;
      if (p.rs?.e && p.rs?.n) {
        const rsLL = lv95ToWgs84(p.rs.e, p.rs.n);
        L.marker([rsLL.lat, rsLL.lng], { icon: CREATE_EXISTING_RS_ICON, interactive: true })
          .bindTooltip(name + ' RS', { permanent: false, direction: 'top', className: '' })
          .addTo(_createExistingGroup);
      }
      if (p.rks?.e && p.rks?.n) {
        const rksLL = lv95ToWgs84(p.rks.e, p.rks.n);
        L.marker([rksLL.lat, rksLL.lng], { icon: CREATE_EXISTING_RKS_ICON, interactive: true })
          .bindTooltip(name + ' RKS', { permanent: false, direction: 'top', className: '' })
          .addTo(_createExistingGroup);
      }
    });
  }

  createMapLeaflet.on('click', onCreateMapClick);
  createMapLeaflet.getContainer().style.cursor = 'crosshair';

  // Vorhandene Koordinaten als Marker setzen (Edit-Modus)
  if (_activePhase === 'baugrund') {
    // Baugrundphase: RS + RKS + optionaler Fund-Marker
    const rsE  = parseInt(document.getElementById('c-rs-e').value);
    const rsN  = parseInt(document.getElementById('c-rs-n').value);
    const rksE = parseInt(document.getElementById('c-rks-e').value);
    const rksN = parseInt(document.getElementById('c-rks-n').value);
    if (rsE  && rsN)  placeCreateMarker('rs',  lv95ToWgs84(rsE,  rsN));
    if (rksE && rksN) placeCreateMarker('rks', lv95ToWgs84(rksE, rksN));
  } else {
    // Bauprojekt / Ausführung: nur Fundamentstandort (c-fund-e2/n2 = RS-Koordinate)
    const fE2 = parseInt(document.getElementById('c-fund-e2')?.value);
    const fN2 = parseInt(document.getElementById('c-fund-n2')?.value);
    if (fE2 && fN2) placeCreateMarker('rs', lv95ToWgs84(fE2, fN2));
  }
}

function placeCreateMarker(type, latlng) {
  if (!createMapLeaflet) return;
  if (type === 'rs') {
    if (createRsMarker) {
      createRsMarker.setLatLng(latlng);
    } else {
      createRsMarker = L.marker(latlng, { icon: CREATE_RS_ICON, draggable: true })
        .addTo(createMapLeaflet)
        .on('dragend', e => {
          fillCreateCoords('rs', e.target.getLatLng());
          updateCreateDistance();
          autoStandortdatenAbfragen(wgs84ToLv95(e.target.getLatLng().lat, e.target.getLatLng().lng));
        });
    }
    fillCreateCoords('rs', latlng);
  } else if (type === 'rks') {
    if (createRksMarker) {
      createRksMarker.setLatLng(latlng);
    } else {
      createRksMarker = L.marker(latlng, { icon: CREATE_RKS_ICON, draggable: true })
        .addTo(createMapLeaflet)
        .on('dragend', e => { fillCreateCoords('rks', e.target.getLatLng()); updateCreateDistance(); });
    }
    fillCreateCoords('rks', latlng);
  } else if (type === 'bs') {
    if (createBsMarker) {
      createBsMarker.setLatLng(latlng);
    } else {
      createBsMarker = L.marker(latlng, { icon: CREATE_BS_ICON, draggable: true })
        .addTo(createMapLeaflet)
        .on('dragend', e => { fillCreateCoords('bs', e.target.getLatLng()); updateCreateDistance(); });
    }
    fillCreateCoords('bs', latlng);
  } else if (type === 'fund') {
    if (window.createFundMarker) {
      window.createFundMarker.setLatLng(latlng);
    } else {
      const fundIcon = L.divIcon({
        html: `<div style="background:#1a3a5c;color:white;font-size:10px;font-weight:700;padding:3px 7px;border-radius:10px;white-space:nowrap;box-shadow:0 2px 4px rgba(0,0,0,0.3);">Fund</div>`,
        iconAnchor: [20, 10], className: ''
      });
      window.createFundMarker = L.marker(latlng, { icon: fundIcon, draggable: true })
        .addTo(createMapLeaflet)
        .on('dragend', e => { fillCreateCoords('fund', e.target.getLatLng()); });
    }
    fillCreateCoords('fund', latlng);
  }
  updateCreateDistance();
}

function fillCreateCoords(type, latlng) {
  const lv95 = wgs84ToLv95(latlng.lat, latlng.lng);
  if (type === 'rs') {
    document.getElementById('c-rs-e').value = lv95.e;
    document.getElementById('c-rs-n').value = lv95.n;
    document.getElementById('create-rs-coord-lbl').textContent = 'RS: E ' + lv95.e + ' / N ' + lv95.n;
    // BP/AF: Fundament-Koordinaten in Bauprojekt-Sektion mitsetzen
    const fe = document.getElementById('c-fund-e2'); if (fe) fe.value = lv95.e;
    const fn2 = document.getElementById('c-fund-n2'); if (fn2) fn2.value = lv95.n;
    const fl2 = document.getElementById('create-fund-coord-lbl2');
    if (fl2) fl2.textContent = 'E ' + lv95.e + ' / N ' + lv95.n;
  } else if (type === 'rks') {
    document.getElementById('c-rks-e').value = lv95.e;
    document.getElementById('c-rks-n').value = lv95.n;
    document.getElementById('create-rks-coord-lbl').textContent = 'RKS: E ' + lv95.e + ' / N ' + lv95.n;
  } else if (type === 'bs') {
    const bsE = document.getElementById('c-bs-e'); if (bsE) bsE.value = lv95.e;
    const bsN = document.getElementById('c-bs-n'); if (bsN) bsN.value = lv95.n;
    const bsLbl = document.getElementById('create-bs-coord-lbl');
    if (bsLbl) bsLbl.textContent = 'BS: E ' + lv95.e + ' / N ' + lv95.n;
  }
}

// ----------------------------------------------------------------
// GeoAdmin Geländehöhe (m ü. M.) — swisstopo REST API
// Eingabe: LV95-Koordinaten (E, N) → gibt Höhe in m ü. M. zurück
// ----------------------------------------------------------------
async function fetchGelaendehoehe(e, n) {
  const url = `https://api.geo.admin.ch/rest/services/height?easting=${e}&northing=${n}&sr=2056`;
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  const h = parseFloat(data.height);
  if (isNaN(h)) throw new Error('Kein Höhenwert');
  return h;
}

// Geländehöhe in Erfassungsmaske befüllen (nach Marker-Setzung)
async function fillGelaendehoeheCreate(e, n) {
  const el = document.getElementById('c-gelaendehoehe');
  if (!el) return;
  el.placeholder = 'Höhe wird abgefragt…';
  el.style.background = '#f0f9ff';
  try {
    const h = await fetchGelaendehoehe(e, n);
    el.value = h.toFixed(1);
    el.style.background = '#f0fdf4';
    el.placeholder = '';
    updateSohleMueM(); // Sohle neu berechnen
    return h;
  } catch (err) {
    el.style.background = '#fff7ed';
    el.placeholder = 'Höhe nicht verfügbar';
    console.warn('GeoAdmin Höhe Fehler:', err);
    return null;
  }
}

// Refresh-Button: Geländehöhe aus aktuellen Markerkoordinaten neu abfragen
async function refreshGelaendehoeheCreate() {
  const isBP = _activePhase !== 'baugrund';
  const eEl = document.getElementById(isBP ? 'c-fund-e2' : 'c-rs-e');
  const nEl = document.getElementById(isBP ? 'c-fund-n2' : 'c-rs-n');
  const e = parseInt(eEl?.value), n = parseInt(nEl?.value);
  if (!e || !n) { ui.toast('Bitte zuerst einen Standort auf der Karte setzen.', 'fehler'); return; }
  await fillGelaendehoeheCreate(e, n);
}

// Höhenkoten werden in der Detailansicht berechnet (recalcHoehenkoten)
function updateSohleMueM() { /* kein Create-Form-Feld mehr — Stub für Legacy-Aufrufe */ }

// ----------------------------------------------------------------
// SBB Bahn-KM für einen gesetzten Standort vorschlagen
//
// Die Rechnung steckt in js/bahn.js (bahnKmAusPunkten): Projektion auf die
// Verbindung der beiden benachbarten Kilometermarken. Vorher wurde hier der
// blosse ABSTAND zum nächsten Punkt als Laufvariable benutzt — bei einem
// Fundament neben dem Gleis zählte der seitliche Versatz damit als
// Längsversatz und verschob den Kilometer um bis zu diesen Betrag.
//
// Quelle der Punkte: data.sbb.ch, Nutzungsbedingungen siehe js/bahn.js.
// Der Wert ist ein Vorschlag zur Kontrolle — die SBB schliesst jede Gewähr
// für die Genauigkeit aus.
// ----------------------------------------------------------------
async function lookupSbbKm(lat, lng, type) {
  const kmFieldId = type === 'rs' ? 'c-km-rs' : 'c-km-rks';
  const kmField = document.getElementById(kmFieldId);
  if (!kmField) return;

  kmField.placeholder = 'KM wird abgefragt…';
  kmField.style.background = '#f0f9ff';

  try {
    const lv = wgs84ToLv95(lat, lng);
    // Zuerst der projektweite Zwischenspeicher — spart Abfragen und wirkt
    // auch ohne Netz. Sonst die fünf nächsten Punkte frisch holen.
    let treffer = bahnKmFuerPunkt(lv.e, lv.n);
    if (!treffer) {
      const url = 'https://data.sbb.ch/api/explore/v2.1/catalog/datasets/linienkilometrierung/records'
        + '?limit=5'
        + `&order_by=distance(geo_point_2d,geom'POINT(${lng}%20${lat})')`
        + '&select=km,x,y,liniename,linienr';
      const res = await fetch(url);
      if (!res.ok) throw new Error('API ' + res.status);
      const data = await res.json();
      if (!data.results?.length) throw new Error('Keine Daten');
      // SBB führt x als Nord- und y als Ostwert
      const punkte = data.results.map(p => ({
        linienr: p.linienr, liniename: p.liniename || '', km: +p.km, e: p.y, n: p.x,
      }));
      treffer = bahnKmAusPunkten(lv.e, lv.n, punkte);
    }
    if (!treffer) throw new Error('Keine Daten');

    kmField.value = treffer.km.toFixed(3);
    kmField.style.background = '#f0fdf4';
    kmField.placeholder = '';

    if (type === 'rs') fillSbbAutoFields(treffer.liniename, String(treffer.linienr ?? ''), 'create');
    return treffer;

  } catch (err) {
    kmField.style.background = '#fff7ed';
    kmField.placeholder = '';
    console.warn('SBB KM Lookup Fehler:', err);
    return null;
  }
}

// ----------------------------------------------------------------
// AUTOMATISCHE ABFRAGE BEIM SETZEN EINES STANDORTS
//
// Fruher musste man nach dem Setzen erst den Aktualisieren-Knopf druecken.
// Jetzt laufen Kilometrierung (SBB) und Geländehöhe (swisstopo) gleich mit,
// und das Ergebnis erscheint als Info-Modal statt als Kasten in der
// Seitenleiste — dort verschob es die Felder und wurde leicht uebersehen.
// ----------------------------------------------------------------
let _autoAbfrageLaeuft = false;

async function autoStandortdatenAbfragen(lv95) {
  if (_autoAbfrageLaeuft || !lv95?.e || !lv95?.n) return;
  _autoAbfrageLaeuft = true;
  try {
    const ll = lv95ToWgs84(lv95.e, lv95.n);
    const [bahn, hoehe] = await Promise.all([
      lookupSbbKm(ll.lat, ll.lng, 'rs'),
      fillGelaendehoeheCreate(lv95.e, lv95.n),
    ]);
    zeigeStandortInfoModal(bahn, hoehe);
  } finally {
    _autoAbfrageLaeuft = false;
  }
}

// Mehrgleisige Korridore sind der Regelfall: dort liegen mehrere Linien
// wenige Meter auseinander, und welche zum Standort gehoert, weiss nur der
// Projektleiter. Deshalb stehen die naechstgelegenen Alternativen zur Wahl.
function zeigeStandortInfoModal(bahn, hoehe) {
  const körper = document.getElementById('standort-info-body');
  if (!körper) return;
  const zeile = (bez, wert) =>
    `<div class="si-zeile"><span>${escHtml(bez)}</span><strong>${escHtml(wert)}</strong></div>`;

  let html = '';
  if (bahn) {
    html += zeile('Linie', `${bahn.linienr}${bahn.liniename ? ' · ' + bahn.liniename : ''}`);
    html += zeile('Kilometer', bahn.km.toFixed(3));
    html += zeile('Abstand zur Achse', bahn.abstand + ' m');
    if (bahn.sprung) html += '<div class="si-warn">Kilometersprung in der Nähe — auf die nächste Marke gerundet.</div>';
  } else {
    html += '<div class="si-warn">Keine Kilometrierung gefunden — KM und Strecke bitte von Hand eintragen.</div>';
  }
  html += hoehe != null ? zeile('Geländehöhe', hoehe.toFixed(1) + ' m ü.M.')
                        : '<div class="si-warn">Geländehöhe nicht verfügbar.</div>';

  if (bahn?.alternativen?.length) {
    html += '<div class="si-titel">Andere Linien in der Nähe</div>';
    html += bahn.alternativen.map((a, i) =>
      `<button class="si-alt" data-alt="${i}">Linie ${a.linienr} · km ${a.km.toFixed(3)}`
      + `<span>${a.abstand} m</span></button>`).join('');
  }
  html += '<div class="si-fuss">Werte aus data.sbb.ch und swisstopo — Vorschlag zur Kontrolle. '
        + 'Die SBB schliesst jede Gewähr für die Genauigkeit aus.</div>';
  körper.innerHTML = html;

  körper.querySelectorAll('[data-alt]').forEach(btn => {
    btn.onclick = () => {
      const a = bahn.alternativen[+btn.dataset.alt];
      const kmField = document.getElementById('c-km-rs');
      if (kmField) kmField.value = a.km.toFixed(3);
      fillSbbAutoFields(a.liniename, String(a.linienr ?? ''), 'create');
      closeStandortInfoModal();
    };
  });
  document.getElementById('standort-info-modal').classList.add('open');
}

function closeStandortInfoModal() {
  document.getElementById('standort-info-modal')?.classList.remove('open');
}

// ----------------------------------------------------------------
// SBB-Felder Strecke + Streckennr. aus KM-Antwort befüllen
// Wird direkt aus lookupSbbKm aufgerufen
// ----------------------------------------------------------------
function fillSbbAutoFields(liniename, linienr, context) {
  const pfx = context === 'create' ? 'c-' : 'm-';
  const streckeField    = document.getElementById(pfx + 'strecke');
  const streckennrField = document.getElementById(pfx + 'streckennr');
  if (streckeField    && liniename) { streckeField.value    = liniename; }
  if (streckennrField && linienr)   { streckennrField.value = linienr;   }
}

function refreshSbbCreate() {
  // Koordinaten: bevorzugt aus gesetztem Marker, sonst aus Koordinatenfeldern
  let lat, lng;
  if (createRsMarker) {
    const ll = createRsMarker.getLatLng();
    lat = ll.lat; lng = ll.lng;
  } else {
    const isBP = _activePhase !== 'baugrund';
    const eId  = isBP ? 'c-fund-e2' : 'c-rs-e';
    const nId  = isBP ? 'c-fund-n2' : 'c-rs-n';
    const e = parseInt(document.getElementById(eId)?.value);
    const n = parseInt(document.getElementById(nId)?.value);
    if (!e || !n) { ui.toast('Bitte zuerst einen Standort auf der Karte setzen.', 'fehler'); return; }
    const ll = lv95ToWgs84(e, n);
    lat = ll.lat; lng = ll.lng;
  }
  lookupSbbKm(lat, lng, 'rs');
}

function syncCreateMarkerFromInput(type) {
  const e = parseInt(document.getElementById('c-' + type + '-e').value);
  const n = parseInt(document.getElementById('c-' + type + '-n').value);
  if (e && n) {
    const ll = lv95ToWgs84(e, n);
    placeCreateMarker(type, ll);
    if (createMapLeaflet) createMapLeaflet.panTo([ll.lat, ll.lng]);
  }
}

function onCreateMapClick(e) {
  placeCreateMarker(createPickMode, e.latlng);
  // Der Hauptpunkt bestimmt Kilometer, Strecke und Geländehöhe — beim Setzen
  // gleich mit abfragen statt hinterher auf den Aktualisieren-Knopf zu warten.
  if (createPickMode === 'rs') autoStandortdatenAbfragen(wgs84ToLv95(e.latlng.lat, e.latlng.lng));
  // Bauprojekt/Ausführung: nur ein Fundamentstandort — kein Auto-Advance
  if (_activePhase !== 'baugrund') return;
  // Baugrund: Auto-advance RS → RKS → BS → Fund
  if (createPickMode === 'rs')        setCreatePickMode('rks');
  else if (createPickMode === 'rks')  setCreatePickMode('bs');
  else if (createPickMode === 'bs')   setCreatePickMode('fund');
}

function setCreatePickMode(mode) {
  createPickMode = mode;
  const btnRs   = document.getElementById('create-btn-rs');
  const btnRks  = document.getElementById('create-btn-rks');
  const btnBs   = document.getElementById('create-btn-bs');
  const btnFund  = document.getElementById('create-btn-fund');
  const btnFund2 = document.getElementById('create-btn-fund2');
  if (btnRs)  btnRs.classList.toggle('active',  mode === 'rs');
  if (btnRks) btnRks.classList.toggle('active',  mode === 'rks');
  if (btnBs) {
    btnBs.style.background = mode === 'bs' ? '#b45309' : 'white';
    btnBs.style.color      = mode === 'bs' ? 'white'   : '#b45309';
  }
  if (btnFund) {
    btnFund.style.background = mode === 'fund' ? '#1a3a5c' : 'white';
    btnFund.style.color      = mode === 'fund' ? 'white'   : '#1a3a5c';
  }
  // Bauprojekt-Button (aktiv wenn RS-Modus = Fundamentpunkt setzen)
  if (btnFund2) btnFund2.classList.toggle('active', mode === 'rs');
}

function updateCreateDistance() {
  // Referenzpunkt: RS-Marker (falls gesetzt), sonst RKS-Marker
  const ref = createRsMarker ? createRsMarker.getLatLng() :
              createRksMarker ? createRksMarker.getLatLng() : null;
  if (!ref) return;

  // In Bauprojekt/Ausführung: nur Fundamentstandorte (gleiche Phase), keine Sondagen
  const isBaugrund = _activePhase === 'baugrund';
  const label = isBaugrund ? 'Sondage' : 'Fundamentstandort';

  // Filtere den aktuell bearbeiteten Standort heraus; passende Objektart je nach Modus
  const candidatePool = _createInstallMode ? getInstallationen() : (isBaugrund ? getSondagen() : getFundamente());
  const candidates = candidatePool.filter(p => p.id !== createEditId);
  if (!candidates.length) {
    document.getElementById('create-dist-box').style.display = 'none';
    document.getElementById('create-dist-map-badge').style.display = 'none';
    return;
  }

  // Nächsten Standort berechnen
  let minDist = Infinity, nearest = null;
  candidates.forEach(p => {
    const c = pairCenter(p);
    const d = haversine(ref.lat, ref.lng, c.lat, c.lng);
    if (d < minDist) { minDist = d; nearest = p; }
  });
  if (!nearest) return;

  const name = nearest.bezeichnung || 'Standort ' + nearest.id;
  const distText = minDist < 1000
    ? Math.round(minDist) + ' m'
    : (minDist / 1000).toFixed(2) + ' km';

  // Sidebar-Box anzeigen
  document.getElementById('create-dist-box').style.display = 'block';
  document.getElementById('create-dist-value').textContent = distText;
  document.getElementById('create-dist-sub').textContent = 'zu «' + name + '»';

  // Karten-Badge anzeigen
  const badge = document.getElementById('create-dist-map-badge');
  badge.textContent = 'Nächste ' + label + ': ' + distText + ' (' + name + ')';
  badge.style.display = 'block';
}

function saveCreate() {
  const v = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const isBP   = _activePhase === 'bauprojekt';
  const isInst = _createInstallMode;

  // ── Installationsfläche ──────────────────────────────────────────────────────
  if (isInst) {
    const instE = parseInt(v('c-fund-e2')); const instN = parseInt(v('c-fund-n2'));
    if (!instE || !instN) { ui.toast('Bitte Standort auf der Karte setzen oder Koordinaten eingeben.', 'fehler'); return; }
    const fL = parseFloat(v('c-inst-flaeche-l')) || 0;
    const fB = parseFloat(v('c-inst-flaeche-b')) || 0;
    const fDirekt = parseFloat(v('c-inst-flaeche')) || 0;
    const flaeche = (fL && fB) ? Math.round(fL * fB * 100) / 100 : fDirekt;
    const instData = {
      _objType:    'installation',
      _phase:      _activePhase,
      bezeichnung: v('c-inst-bezeichnung').trim() || 'Installation',
      installTyp:  v('c-inst-typ'),
      flaecheL:    fL || null,
      flaecheB:    fB || null,
      flaeche:     flaeche || null,
      von:           v('c-inst-von') || null,
      bis:           v('c-inst-bis') || null,
      instBestellLink: v('c-inst-bestelllink').trim() || null,
      instFrist:       v('c-inst-frist') || null,
      instGleisAbstand: v('c-inst-gleisabstand') || null,
      instAbschaltung: !!document.getElementById('c-inst-abschaltung')?.checked,
      instErdung:      !!document.getElementById('c-inst-erdung')?.checked,
      bemerkung:     v('c-inst-bemerkung').trim(),
      rs:            { e: instE, n: instN },
    };
    pushUndo();
    let savedId;
    if (createEditId) {
      const idx = PAIRS.findIndex(p => p.id === createEditId);
      PAIRS[idx] = { ...PAIRS[idx], ...instData };
      savedId = createEditId;
    } else {
      savedId = PAIRS.length ? Math.max(...PAIRS.map(p => p.id)) + 1 : 1;
      PAIRS.push({ id: savedId, ...instData });
    }
    savePairs();
    _createInstallMode = false;
    if (createMapLeaflet) { createMapLeaflet.remove(); createMapLeaflet = null; createRsMarker = null; createRksMarker = null; createBsMarker = null; }
    document.getElementById('create-view').style.display = 'none';
    showDetail(savedId);
    return;
  }

  // Koordinaten je nach Phase
  let rsE, rsN, rksE, rksN;
  if (isBP) {
    rsE  = parseInt(v('c-fund-e2')); rsN  = parseInt(v('c-fund-n2'));
    rksE = rsE; rksN = rsN; // Bauprojekt: ein Punkt
    if (!rsE || !rsN) { ui.toast('Bitte Standort auf der Karte setzen oder Koordinaten eingeben.', 'fehler'); return; }
  } else {
    rsE  = parseInt(v('c-rs-e'));  rsN  = parseInt(v('c-rs-n'));
    rksE = parseInt(v('c-rks-e')); rksN = parseInt(v('c-rks-n'));
    // Mindestens RS muss gesetzt sein; RKS ist optional
    if (!rsE || !rsN) {
      ui.toast('Bitte mindestens die RS-Koordinaten auf der Karte setzen oder manuell eingeben.', 'fehler'); return;
    }
  }

  const data = {
    bezeichnung:       v('c-bezeichnung').trim(),
    tag:               isBP ? '' : v('c-tag'),
    nacht:             isBP ? '' : v('c-nacht'),
    mast:              v('c-mast'),
    km_rs:             parseFloat(v('c-km-rs')) || 0,
    km_rks:            isBP ? parseFloat(v('c-km-rs')) || 0 : (parseFloat(v('c-km-rks')) || parseFloat(v('c-km-rs')) || 0),
    tiefe:             isBP ? 0 : (parseFloat(v('c-tiefe')) || 5),
    schlitz:           parseFloat(v('c-schlitz')) || 0,
    gleis:             isBP ? '' : v('c-gleis'),
    strecke:           v('c-strecke').trim(),
    streckennr:        v('c-streckennr').trim(),
    gelaendehoehe:     parseFloat(v('c-gelaendehoehe')) || null,
    zugang:            v('c-zugang'),
    // Bauprojekt-Felder
    ausfuehrung:       v('c-ausfuehrung'),
    bestand:           v('c-bestand'),
    massnahme:         v('c-massnahme'),
    sicherungLink:     v('c-sicherung-link'),
    sicherungBemerkung:v('c-sicherung-bemerkung'),
    fundtyp:           v('c-fundtyp'),
    nachweisLink:      v('c-nachweis-link'),
    boden:             v('c-boden'),
    rs:  (rsE  && rsN)  ? { e: rsE,  n: rsN  } : null,
    rks: (rksE && rksN) ? { e: rksE, n: rksN } : null,
    bs:  (() => { const bsE = parseInt(v('c-bs-e')); const bsN = parseInt(v('c-bs-n')); return (bsE && bsN) ? { e: bsE, n: bsN, km: parseFloat(v('c-bs-km')) || null, tiefe: parseFloat(v('c-bs-tiefe')) || null, abbruch: v('c-bs-abbruch'), bemerkung: v('c-bs-bemerkung') } : null; })(),
    _phase: _activePhase,   // Phase bei der Erfassung
    _objType: (_activePhase === 'bauprojekt' || _activePhase === 'ausfuehrung') ? 'fundament' : 'sondage',
  };
  pushUndo();
  let savedId;
  if (createEditId) {
    const idx = PAIRS.findIndex(p => p.id === createEditId);
    PAIRS[idx] = { ...PAIRS[idx], ...data };
    savedId = createEditId;
  } else {
    savedId = PAIRS.length ? Math.max(...PAIRS.map(p => p.id)) + 1 : 1;
    PAIRS.push({ id: savedId, ...data });
  }
  savePairs();
  // Schicht-Kurzbezeichnung automatisch in Bibliothek eintragen
  if (data.tag || data.nacht) autoRegisterSchichtenFromPairs([data]);

  // BP- und AF-Felder im separaten BP-Speicher sichern (Sidebar + Ref-Sektion lesen daraus)
  if (isBP || _activePhase === 'ausfuehrung') {
    const all = loadAllBauprojekt();
    all[savedId] = {
      ...(all[savedId] || {}),
      bestand:            v('c-bestand'),
      massnahme:          v('c-massnahme'),
      sicherungLink:      v('c-sicherung-link'),
      sicherungBemerkung: v('c-sicherung-bemerkung'),
      fundtyp:            v('c-fundtyp'),
      nachweisLink:       v('c-nachweis-link'),
      bemerkung:          v('c-zugang'),
    };
    saveAllBauprojekt(all);
  }

  updateProgress();
  document.getElementById('create-view').style.display = 'none';
  if (createMapLeaflet) { createMapLeaflet.remove(); createMapLeaflet = null; createRsMarker = null; createRksMarker = null; createBsMarker = null; }
  showDetail(savedId);
}

// Swisstopo Ortssuche für Vollbild-Ansicht
function onCreateSearch(val) {
  clearTimeout(_createSearchTimer);
  const rd = document.getElementById('create-search-results');
  if (!val || val.length < 2) { rd.style.display = 'none'; return; }
  _createSearchTimer = setTimeout(() => fetchCreateSearch(val), 320);
}

// Ein Feld für alles: Ortsnamen kommen von geo.admin, Station, Liniennummer
// und Kilometer aus den geladenen Bahndaten (js/bahn.js). Ein zweites
// Suchfeld daneben waere die naheliegende, aber schlechtere Loesung — man
// muesste erst entscheiden, welches Feld zustaendig ist.
async function fetchCreateSearch(query) {
  const orteHolen = (async () => {
    try {
      const url = `https://api.geo.admin.ch/rest/services/ech/SearchServer?searchText=${encodeURIComponent(query)}&type=locations&lang=de&limit=5&sr=4326`;
      const data = await fetch(url).then(r => r.json());
      // geo.admin liefert im Suchergebnis y als Breite und x als Laenge
      return (data.results || []).map(r => ({
        lat: r.attrs.y, lng: r.attrs.x,
        titel: r.attrs.label.replace(/<[^>]+>/g, ''), neben: '', art: 'Ort',
      }));
    } catch { return []; } // Netzwerkfehler ignorieren — Bahntreffer bleiben nutzbar
  })();
  const stationenHolen = typeof bahnStationSuchenOnline === 'function'
    ? bahnStationSuchenOnline(query) : Promise.resolve([]);

  const bahn = (typeof bahnSuche === 'function' ? bahnSuche(query) : []);
  const [stationen, orte] = await Promise.all([stationenHolen, orteHolen]);

  // Stationen zuerst: gesucht wird der Bahnhof, nicht das Dorfzentrum.
  // Was die oertliche Suche schon kennt, kommt nicht doppelt.
  const bekannt = new Set(bahn.map(t => t.titel));
  const alleBahn = [...bahn, ...stationen.filter(s => !bekannt.has(s.titel))]
    .map(t => ({ lat: t.lat, lng: t.lon, titel: t.titel, neben: t.neben, art: t.art }));
  renderCreateSearchResults([...alleBahn, ...orte]);
}

let _createSuchTreffer = [];

function renderCreateSearchResults(results) {
  const rd = document.getElementById('create-search-results');
  _createSuchTreffer = results;
  if (!results.length) { rd.style.display = 'none'; return; }
  rd.innerHTML = results.map((r, i) =>
    `<div class="create-search-result" data-treffer="${i}">`
    + `<span class="csr-art">${escHtml(r.art)}</span>`
    + `<span class="csr-titel">${escHtml(r.titel)}</span>`
    + (r.neben ? `<span class="csr-neben">${escHtml(r.neben)}</span>` : '')
    + '</div>').join('');
  rd.querySelectorAll('[data-treffer]').forEach(el => {
    el.onclick = () => {
      const t = _createSuchTreffer[+el.dataset.treffer];
      selectCreateSearchResult(t.lat, t.lng, t.titel);
    };
  });
  rd.style.display = 'block';
}

function selectCreateSearchResult(lat, lng, label) {
  document.getElementById('create-map-search').value = label;
  document.getElementById('create-search-results').style.display = 'none';
  if (createMapLeaflet) createMapLeaflet.flyTo([lat, lng], 17, { duration: 0.6 });
}

// Klick ausserhalb der Suche schliesst Dropdown
document.addEventListener('click', e => {
  const wrap = document.getElementById('create-map-search')?.closest('.create-search-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const rd = document.getElementById('create-search-results');
    if (rd) rd.style.display = 'none';
  }
});

// ============================================================
// KONTAKTE — Projektleiter / Geologe / Subunternehmer
// ============================================================
// ============================================================
// KONTAKTE — frei definierbare Rollen mit Phasenzuordnung
// ============================================================
// Kontakte werden als Array gespeichert: [{id, rolle, name, firma, ...}]
// Altbestand kann ein Feld «phasen» tragen — es wird nicht mehr gelesen.
function loadContacts() {
  try {
    const s = store.getItem(CONTACTS_KEY);
    if (s) {
      const parsed = jsonParse(s);
      // Migration: altes Objekt-Format → neues Array-Format
      if (!Array.isArray(parsed)) {
        const migrated = [];
        const roleMap = { pl: 'Projektleitung (PL)', geo: 'Geologie / Geotechnik (GEO)', sub: 'Subunternehmer Geologie (SUB)' };
        Object.entries(parsed).forEach(([key, c]) => {
          if (c && c.name) migrated.push({ id: key, rolle: roleMap[key] || key, ...c });
        });
        return migrated;
      }
      return parsed;
    }
  } catch {}
  return [];
}
function saveContacts(list) { store.setItem(CONTACTS_KEY, JSON.stringify(list)); }
let _contacts = loadContacts();

function renderContacts() {
  const grid = document.getElementById('kontakt-grid');
  if (!grid) return;
  // Alle Kontakte, unabhaengig von der Phase. Die Leiste erscheint auch in
  // Termine und Protokolle, wo gar keine Phase waehlbar ist — dort hatte der
  // frueher aktive Phasenfilter still Eintraege verborgen.
  const visible = _contacts;
  const colorClasses = ['pl','geo','sub','pl','geo','sub'];

  grid.innerHTML = visible.map((c, i) => {
    const colorClass = colorClasses[i % colorClasses.length];
    return `<div class="kontakt-card">
      <div class="kontakt-card-role ${colorClass}">${c.rolle || '—'}</div>
      ${c.name ? `
        <div class="kontakt-card-name">${c.name}</div>
        ${c.firma ? `<div class="kontakt-card-firma">${c.firma}</div>` : ''}
        <div class="kontakt-card-links">
          ${c.tel    ? `<a href="tel:${c.tel}">${svgIcon('telefon',{groesse:11})} ${c.tel}</a>` : ''}
          ${c.mobile ? `<a href="tel:${c.mobile}">${svgIcon('mobil',{groesse:11})} ${c.mobile}</a>` : ''}
          ${c.email  ? `<a href="mailto:${c.email}">${svgIcon('brief',{groesse:11})} ${c.email}</a>` : ''}
          ${c.adresse? `<span style="font-size:11px;color:#6b7280;">${svgIcon('standort',{groesse:11})} ${c.adresse}</span>` : ''}
        </div>
      ` : `<div class="kontakt-empty">Noch keine Angaben</div>`}
      <button class="kontakt-edit-btn" onclick="openKontaktModal('${c.id}')" title="Bearbeiten">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </div>`;
  }).join('') + `
    <div class="kontakt-card" style="border:1px dashed #d1d5db;background:#f9fafb;cursor:pointer;display:flex;align-items:center;justify-content:center;min-height:80px;"
         onclick="openKontaktModal(null)">
      <span style="font-size:12px;color:#9ca3af;font-weight:600;">+ Kontakt hinzufügen</span>
    </div>`;
}

function openKontaktModal(id) {
  const isNew = !id;
  let c = isNew ? { id: 'k_' + Date.now(), rolle: '', name:'',firma:'',tel:'',mobile:'',email:'',adresse:'' }
                : _contacts.find(x => x.id === id) || {};

  document.getElementById('kontakt-modal-title').textContent = isNew ? 'Kontakt hinzufügen' : 'Kontakt bearbeiten';
  document.getElementById('kontakt-modal-role').value = c.id || '';
  document.getElementById('k-rolle').value   = c.rolle   || '';
  document.getElementById('k-name').value    = c.name    || '';
  document.getElementById('k-firma').value   = c.firma   || '';
  document.getElementById('k-tel').value     = c.tel     || '';
  document.getElementById('k-mobile').value  = c.mobile  || '';
  document.getElementById('k-email').value   = c.email   || '';
  document.getElementById('k-adresse').value = c.adresse || '';

  // Löschen-Button
  const delBtn = document.getElementById('k-delete-btn');
  if (delBtn) delBtn.style.display = isNew ? 'none' : '';

  document.getElementById('kontakt-modal').classList.add('open');
}

function closeKontaktModal() {
  document.getElementById('kontakt-modal').classList.remove('open');
}

function saveKontakt() {
  const id = document.getElementById('kontakt-modal-role').value;
  const updated = {
    id,
    rolle:   document.getElementById('k-rolle').value.trim(),
    name:    document.getElementById('k-name').value.trim(),
    firma:   document.getElementById('k-firma').value.trim(),
    tel:     document.getElementById('k-tel').value.trim(),
    mobile:  document.getElementById('k-mobile').value.trim(),
    email:   document.getElementById('k-email').value.trim(),
    adresse: document.getElementById('k-adresse').value.trim(),
  };
  const idx = _contacts.findIndex(x => x.id === id);
  if (idx >= 0) _contacts[idx] = updated;
  else _contacts.push(updated);
  saveContacts(_contacts);
  closeKontaktModal();
  renderContacts();
  // Beteiligte-Modal synchron halten
  if (document.getElementById('beteiligte-modal')?.style.display !== 'none') renderBeteiligteList();
}

async function deleteKontakt() {
  const id = document.getElementById('kontakt-modal-role').value;
  if (!await ui.confirm('Kontakt wirklich löschen?')) return;
  _contacts = _contacts.filter(x => x.id !== id);
  saveContacts(_contacts);
  closeKontaktModal();
  renderContacts();
  // Beteiligte-Modal synchron halten
  if (document.getElementById('beteiligte-modal')?.style.display !== 'none') renderBeteiligteList();
}

// ============================================================
// PROJEKTBETEILIGTE — Modal + Import
// ============================================================

function openBeteiligteModal() {
  const projects = loadProjectsMeta();
  const proj = projects.find(p => p.id === _activeId);
  document.getElementById('beteiligte-modal-title').textContent =
    'Projektbeteiligte – ' + (proj?.name || '');
  // "Aus Projekt übernehmen"-Dropdown befüllen
  const sel = document.getElementById('beteiligte-copy-from');
  if (sel) {
    sel.innerHTML = '<option value="">Aus Projekt übernehmen…</option>' +
      projects.filter(p => p.id !== _activeId)
              .map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }
  renderBeteiligteList();
  document.getElementById('beteiligte-modal').style.display = 'flex';
}

function closeBeteiligteModal() {
  document.getElementById('beteiligte-modal').style.display = 'none';
}

function renderBeteiligteList() {
  const list = document.getElementById('beteiligte-list');
  if (!list) return;
  const contacts = loadContacts();
  if (!contacts.length) {
    list.innerHTML = '<div style="font-size:12px;color:#9ca3af;padding:8px 0;text-align:center;">Noch keine Beteiligte erfasst.</div>';
    return;
  }
  list.innerHTML = contacts.map(c => `
    <div style="display:flex;align-items:center;gap:8px;padding:9px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:600;color:#1a3a5c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.rolle || '—'}</div>
        <div style="font-size:11px;color:#374151;">${c.name || ''}${c.firma ? ' · ' + c.firma : ''}</div>
      </div>
      <button onclick="openKontaktModal('${c.id}')"
        title="Bearbeiten"
        style="padding:3px 6px;border-radius:5px;border:1px solid #e5e7eb;background:white;color:#6b7280;cursor:pointer;display:flex;align-items:center;"
        onmouseover="this.style.color='#1a3a5c'" onmouseout="this.style.color='#6b7280'">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button onclick="deleteBeteiligte('${c.id}')"
        title="Löschen"
        style="padding:3px 6px;border-radius:5px;border:1px solid #fca5a5;background:none;color:#ef4444;cursor:pointer;font-size:11px;font-weight:700;">✕</button>
    </div>`).join('');
}

async function deleteBeteiligte(id) {
  if (!await ui.confirm('Kontakt löschen?')) return;
  _contacts = _contacts.filter(c => c.id !== id);
  saveContacts(_contacts);
  renderContacts();
  renderBeteiligteList();
}

async function copyBeteiligteFromProject(fromId) {
  if (!fromId) return;
  if (!await ui.confirm('Kontakte aus dem gewählten Projekt übernehmen?\nBestehende Kontakte werden ersetzt.')) {
    document.getElementById('beteiligte-copy-from').value = '';
    return;
  }
  const src = store.getItem('sp_contacts__' + fromId);
  store.setItem(CONTACTS_KEY, src || '[]');
  _contacts = loadContacts();
  renderContacts();
  renderBeteiligteList();
  document.getElementById('beteiligte-copy-from').value = '';
}

function importBeteiligteFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    const imported = file.name.toLowerCase().endsWith('.vcf')
      ? parseVcfContacts(text)
      : parseCsvContacts(text);
    if (!imported.length) { ui.toast('Keine Kontakte gefunden.', 'fehler'); input.value = ''; return; }
    _contacts.push(...imported);
    saveContacts(_contacts);
    renderContacts();
    renderBeteiligteList();
    input.value = '';
    ui.toast(`${imported.length} Kontakt(e) importiert.`, 'erfolg');
  };
  reader.readAsText(file, 'UTF-8');
}

// Einfacher CSV-Parser (Outlook-Standardformat)
function parseCsvContacts(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,'').toLowerCase());
  const get = (cols, ...keys) => {
    for (const k of keys) {
      const i = headers.indexOf(k);
      if (i >= 0 && cols[i]) return cols[i].trim().replace(/^"|"$/g,'');
    }
    return '';
  };
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    const name = get(cols,'name','anzeigename','full name','vorname') ||
                 [get(cols,'first name','vorname'), get(cols,'last name','nachname')].filter(Boolean).join(' ');
    if (!name) return null;
    return {
      id:      'k_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5),
      rolle:   get(cols,'rolle','funktion','title','berufsbezeichnung','job title') || '',
      name,
      firma:   get(cols,'firma','company','organisation','unternehmen') || '',
      tel:     get(cols,'telefon','phone','telefon arbeit','business phone','work phone') || '',
      mobile:  get(cols,'mobile','handy','mobiltelefon','mobile phone') || '',
      email:   get(cols,'email','e-mail','e-mail-adresse','email address') || '',
      adresse: get(cols,'adresse','address','strasse','street') || '',
    };
  }).filter(Boolean);
}

// Einfacher vCard-Parser (BEGIN:VCARD … END:VCARD Blöcke)
function parseVcfContacts(text) {
  return text.split(/BEGIN:VCARD/i).slice(1).map(block => {
    const get = key => {
      const m = block.match(new RegExp(key + '[^:\r\n]*:([^\r\n]+)', 'i'));
      return m ? m[1].trim() : '';
    };
    const rawN = get('N');
    const parts = rawN.split(';');
    const nameFromN = [parts[1], parts[0]].filter(Boolean).join(' ').trim();
    const name = get('FN') || nameFromN;
    if (!name) return null;
    return {
      id:      'k_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5),
      rolle:   get('TITLE') || get('ROLE') || '',
      name,
      firma:   get('ORG') || '',
      tel:     get('TEL;TYPE=WORK') || get('TEL;WORK') || get('TEL') || '',
      mobile:  get('TEL;TYPE=CELL') || get('TEL;TYPE=MOBILE') || '',
      email:   get('EMAIL') || '',
      adresse: get('ADR') || '',
    };
  }).filter(Boolean);
}

// ============================================================
// MAILVORLAGEN — Template + Bausteine
// ============================================================

// Nutzungsanfrage (Baugrund)
const DEFAULT_LETTER_TEMPLATE =
`Betreff: Geotechnische Voruntersuchung – Rammsondierung {{standort_name}}

Guten Tag

Im Rahmen des Projekts «{{projekt}}» sind wir beauftragt, geotechnische Voruntersuchungen entlang der Bahnstrecke durchzuführen. Dazu werden an ausgewählten Standorten Rammsondierungen (RS) und Rammkernsondierungen (RKS) vorgenommen.

Ein Standort befindet sich auf Ihrer Parzelle bzw. in Ihrem Zuständigkeitsbereich:
Standort: {{standort_name}} · KM {{standort_km}}

Wir bitten Sie um Ihre Zustimmung bzw. Rückmeldung bis [Datum].

Für Rückfragen stehen Ihnen folgende Ansprechpersonen zur Verfügung:

Projektleitung:
{{pl_name}}, {{pl_firma}}
{{pl_adresse}}
{{pl_tel}} · {{pl_email}}

Geologie / Geotechnik:
{{geo_name}}, {{geo_firma}}
{{geo_adresse}}
{{geo_tel}} · {{geo_email}}

Subunternehmer Geologie:
{{sub_name}}, {{sub_firma}}
{{sub_adresse}}
{{sub_tel}} · {{sub_email}}

Freundliche Grüsse
{{pl_name}}`;

// Einladung Begehung
const DEFAULT_BEGEHUNG_TEMPLATE =
`Betreff: Einladung Begehung – {{standort_name}} / KM {{standort_km}}

Guten Tag

Im Rahmen des Projekts «{{projekt}}» möchten wir Sie zur Begehung des Standorts {{standort_name}} (KM {{standort_km}}) einladen.

Datum / Zeit: [Datum] · [Uhrzeit]
Treffpunkt: {{standort_name}}, KM {{standort_km}}

Bitte teilen Sie uns bis [Rückmeldedatum] mit, ob Sie an der Begehung teilnehmen können.

Ansprechperson:
{{pl_name}}, {{pl_firma}}
{{pl_tel}} · {{pl_mobile}}
{{pl_email}}

Freundliche Grüsse
{{pl_name}}`;

// Einladung Begehung Perimeter (projektübergreifend, alle Fundamentstandorte)
const DEFAULT_BEGEHUNG_PERIMETER_TEMPLATE =
`Betreff: Einladung Begehung – Projekt {{projekt}}

Guten Tag

Im Rahmen des Projekts «{{projekt}}» möchten wir Sie zur gemeinsamen Begehung aller Fundamentstandorte einladen.

Datum / Zeit: [Datum] · [Uhrzeit]
Treffpunkt: [Treffpunkt]

Standorte (Projektperimeter):
{{standorte_liste}}

Bitte teilen Sie uns bis [Rückmeldedatum] mit, ob Sie an der Begehung teilnehmen können.

Ansprechperson:
{{pl_name}}, {{pl_firma}}
{{pl_tel}} · {{pl_mobile}}
{{pl_email}}

Freundliche Grüsse
{{pl_name}}`;

const DEFAULT_ABNAHME_PERIMETER_TEMPLATE =
`Betreff: Einladung Abnahme – Projekt {{projekt}}

Guten Tag

Im Rahmen des Projekts «{{projekt}}» möchten wir Sie zur Abnahme der fertiggestellten Fundamente einladen.

Datum / Zeit: [Datum] · [Uhrzeit]
Treffpunkt: [Treffpunkt]

Standorte (Projektperimeter):
{{standorte_liste}}

Bitte teilen Sie uns bis [Rückmeldedatum] Ihre Teilnahme mit.

Ansprechperson:
{{pl_name}}, {{pl_firma}}
{{pl_tel}} · {{pl_mobile}}
{{pl_email}}

Freundliche Grüsse
{{pl_name}}`;

const DEFAULT_PARZELLE_PERIMETER_TEMPLATE =
`Betreff: Anfrage Zugang Parzelle – Projekt {{projekt}}

Guten Tag

Im Rahmen des Projekts «{{projekt}}» bitten wir Sie um die Bewilligung des Zugangs zu den nachfolgend aufgeführten Standorten für Vermessungs- und Sondierarbeiten.

Standorte:
{{standorte_liste}}

Geplanter Zeitraum: [Von] bis [Bis]

Wir versichern, dass alle Arbeiten fachgerecht ausgeführt und entstandene Schäden behoben werden. Bei Fragen stehen wir Ihnen gerne zur Verfügung.

Ansprechperson:
{{pl_name}}, {{pl_firma}}
{{pl_tel}} · {{pl_mobile}}
{{pl_email}}

Freundliche Grüsse
{{pl_name}}`;

// Materialbestellung Vorlage
const DEFAULT_MATERIALBESTELLUNG_TEMPLATE =
`Betreff: Materialbestellung – Fundamente {{projekt_name}}

Guten Tag

Im Rahmen des Projekts {{projekt_name}} bestellen wir hiermit die nachfolgenden Materialien für die Erstellung der Flachbettfundamente gemäss SBB Dok. 0161.1011.0002.

Die detaillierte Materialliste liegt dieser Bestellung als Beilage bei.

BESTELLPOSITION

Pos. 1  Fundamentschrauben-Sets
        Gemäss beiliegender Materialliste nach Fundamenttyp

Pos. 2  Bewehrung B550B, feuerverzinkt
        Gemäss Planvorgabe

Pos. 3  Beton C30/37, XC4(CH), XD3(CH), XF2(CH), Dmax 32, Cl 0.1, AAR-beständig
        Volumen gemäss beiliegender Materialliste

LIEFERADRESSE
{{standort_name}}

LIEFERTERMIN
Bitte bis spätestens [Datum] liefern.

BEMERKUNGEN
-

Bei Fragen stehe ich gerne zur Verfügung.

Freundliche Grüsse
{{pl_name}}, {{pl_firma}}
{{pl_tel}} · {{pl_mobile}}
{{pl_email}}`;

// Konfiguration aller Mailvorlagen-Typen
const MAIL_TYPES = {
  anfrage:           { label: 'Nutzungsanfrage',              key: () => LETTER_KEY,                                            default: DEFAULT_LETTER_TEMPLATE               },
  begehung:          { label: 'Einladung Begehung',           key: () => 'sp_letter_begehung__'           + _activeId,          default: DEFAULT_BEGEHUNG_TEMPLATE              },
  begehung_perimeter:{ label: 'Einladung Begehung Perimeter', key: () => 'sp_letter_begehung_perimeter__' + _activeId,          default: DEFAULT_BEGEHUNG_PERIMETER_TEMPLATE    },
  abnahme_perimeter: { label: 'Einladung Abnahme Perimeter',  key: () => 'sp_letter_abnahme_perimeter__'  + _activeId,          default: DEFAULT_ABNAHME_PERIMETER_TEMPLATE     },
  parzelle_perimeter:{ label: 'Anfrage Parzellenzugang',      key: () => 'sp_letter_parzelle_perimeter__' + _activeId,          default: DEFAULT_PARZELLE_PERIMETER_TEMPLATE    },
  materialbestellung:{ label: 'Materialbestellung',           key: () => 'sp_letter_materialbestell__'    + _activeId,          default: DEFAULT_MATERIALBESTELLUNG_TEMPLATE    },
};

let _activeBriefType = 'anfrage'; // aktiver Vorlagentyp

function loadLetterTemplate(type) {
  const cfg = MAIL_TYPES[type || _activeBriefType];
  const saved = store.getItem(cfg.key());
  return (saved !== null) ? saved : cfg.default;
}
function saveBriefTemplate() {
  const cfg = MAIL_TYPES[_activeBriefType];
  store.setItem(cfg.key(), document.getElementById('brief-template-input').value);
}

let _activeBausteine = new Set(); // aktive optionale Blöcke

// pairId: Standort vorauswählen; tab: 'template'|'preview'; type: Vorlagentyp
function openBriefModal(pairId, tab, type) {
  _activeBriefType = type || 'anfrage';
  const cfg = MAIL_TYPES[_activeBriefType];

  // Modaltitel aktualisieren
  const titleEl = document.getElementById('brief-modal-title');
  if (titleEl) titleEl.textContent = cfg.label;

  // Template laden
  document.getElementById('brief-template-input').value = loadLetterTemplate(_activeBriefType);

  // Standort-Dropdown befüllen (Mast Nr für BP/AF, Bezeichnung für Baugrund)
  const isBP = _activePhase !== 'baugrund';
  const sel = document.getElementById('brief-standort-select');
  sel.innerHTML = '<option value="">— Kein Standort gewählt —</option>' +
    PAIRS.map(p => {
      const name = isBP ? `${standortName(p)}` : (p.bezeichnung || 'Standort ' + p.id);
      const km   = p.km_rs ? ' · KM ' + parseFloat(p.km_rs).toFixed(3) : '';
      return `<option value="${p.id}">${name}${km}</option>`;
    }).join('');

  // Standort vorauswählen; bei Perimeter-Vorlage keinen Standort vorwählen (projektübergreifend)
  if (pairId && _activeBriefType !== 'begehung_perimeter') sel.value = pairId;

  // Bausteine zurücksetzen
  _activeBausteine.clear();
  ['karte','skizze','pdf'].forEach(k => {
    document.getElementById('bs-' + k).classList.remove('active');
  });

  showBriefTab(tab || 'preview');
  document.getElementById('brief-modal').classList.add('open');
}
function closeBriefModal() {
  document.getElementById('brief-modal').classList.remove('open');
}

function showBriefTab(tab) {
  const isTpl = tab === 'template';
  document.getElementById('brief-panel-template').style.display = isTpl ? '' : 'none';
  document.getElementById('brief-panel-preview').style.display  = isTpl ? 'none' : '';
  document.getElementById('brief-tab-template').classList.toggle('aktiv', isTpl);
  document.getElementById('brief-tab-preview').classList.toggle('aktiv', !isTpl);
  if (!isTpl) renderBriefPreview();
}

function toggleBaustein(key) {
  if (_activeBausteine.has(key)) _activeBausteine.delete(key);
  else _activeBausteine.add(key);
  document.getElementById('bs-' + key).classList.toggle('active', _activeBausteine.has(key));
  renderBriefPreview();
}

// Cache für generiertes Kartenbild
let _briefMapImgUrl     = null;
let _briefMapImgPairId  = null;
let _briefMapWithSkizze = false;

function buildBriefText() {
  const tpl    = document.getElementById('brief-template-input').value;
  const pairId = parseInt(document.getElementById('brief-standort-select').value) || null;
  const pair   = pairId ? PAIRS.find(p => p.id === pairId) : null;
  const c      = _contacts;
  const today  = new Date().toLocaleDateString('de-CH', { day:'2-digit', month:'2-digit', year:'numeric' });
  const projekt = store.getItem(TITEL_KEY) || 'Sondagen-Projekt';

  const standortName = pair ? (pair.bezeichnung || 'Standort ' + pair.id) : '–';
  const standortKm   = pair ? pair.km_rs.toFixed(3) : '–';
  const standortLink = pair && pair.rs?.e
    ? `https://map.geo.admin.ch/#/map?lang=de&center=${pair.rs.e},${pair.rs.n}&z=10&bgLayer=ch.swisstopo.pixelkarte-farbe`
    : '–';

  // Standorte-Liste für Perimeter-Vorlage: alle Fundamentstandorte
  const fundStandorte = getFundamente()
    .sort((a, b) => (parseFloat(a.km_rs) || 0) - (parseFloat(b.km_rs) || 0));
  const standorteListe = fundStandorte.length
    ? fundStandorte.map((p, i) => {
        const km  = p.km_rs ? parseFloat(p.km_rs).toFixed(3) : '–';
        const name = standortName(p);
        return `  ${i + 1}. ${name} · KM ${km}`;
      }).join('\n')
    : '  (Noch keine Fundamentstandorte erfasst)';

  const cf = (role, field) => (c[role]?.[field]) || '–';

  let text = tpl
    .replace(/\{\{projekt\}\}/g,          projekt)
    .replace(/\{\{datum\}\}/g,            today)
    .replace(/\{\{standort_name\}\}/g,    standortName)
    .replace(/\{\{standort_km\}\}/g,      standortKm)
    .replace(/\{\{standort_link\}\}/g,    standortLink)
    .replace(/\{\{standorte_liste\}\}/g,  standorteListe)
    .replace(/\{\{pl_name\}\}/g,    cf('pl','name'))    .replace(/\{\{pl_firma\}\}/g,   cf('pl','firma'))
    .replace(/\{\{pl_adresse\}\}/g, cf('pl','adresse')) .replace(/\{\{pl_tel\}\}/g,     cf('pl','tel'))
    .replace(/\{\{pl_mobile\}\}/g,  cf('pl','mobile'))  .replace(/\{\{pl_email\}\}/g,   cf('pl','email'))
    .replace(/\{\{geo_name\}\}/g,   cf('geo','name'))   .replace(/\{\{geo_firma\}\}/g,  cf('geo','firma'))
    .replace(/\{\{geo_adresse\}\}/g,cf('geo','adresse')).replace(/\{\{geo_tel\}\}/g,    cf('geo','tel'))
    .replace(/\{\{geo_mobile\}\}/g, cf('geo','mobile')) .replace(/\{\{geo_email\}\}/g,  cf('geo','email'))
    .replace(/\{\{sub_name\}\}/g,   cf('sub','name'))   .replace(/\{\{sub_firma\}\}/g,  cf('sub','firma'))
    .replace(/\{\{sub_adresse\}\}/g,cf('sub','adresse')).replace(/\{\{sub_tel\}\}/g,    cf('sub','tel'))
    .replace(/\{\{sub_mobile\}\}/g, cf('sub','mobile')) .replace(/\{\{sub_email\}\}/g,  cf('sub','email'));

  const blocks = [];
  if (_activeBausteine.has('datum'))
    blocks.push(`─────────────────────\nDatum: ${today}`);
  if (_activeBausteine.has('link') && pair)
    blocks.push(`─────────────────────\nStandort auf map.geo.admin.ch:\n${standortLink}`);

  const kBlock = role => {
    // Finde ersten Kontakt der aktiven Phase für diese legacy-Rolle (pl/geo/sub)
    const roleMap = { pl: 'projektleitung', geo: 'geologie', sub: 'subunternehmer' };
    const ct = Array.isArray(_contacts)
      ? _contacts.find(x => x.rolle?.toLowerCase().includes(roleMap[role] || role))
      : (_contacts[role] || null);
    const roleLabel = roleMap[role] ? role.toUpperCase() : role;
    if (!ct?.name) return `(${roleLabel} – keine Angaben)`;
    return [ct.rolle || roleLabel, ct.name, ct.firma||null,
      ct.adresse||null,
      ct.tel    ? `Tel: ${ct.tel}`       : null,
      ct.mobile ? `Mobile: ${ct.mobile}` : null,
      ct.email  ? `E-Mail: ${ct.email}`  : null,
    ].filter(Boolean).join('\n');
  };
  if (_activeBausteine.has('pl'))  blocks.push('─────────────────────\n' + kBlock('pl'));
  if (_activeBausteine.has('geo')) blocks.push('─────────────────────\n' + kBlock('geo'));
  if (_activeBausteine.has('sub')) blocks.push('─────────────────────\n' + kBlock('sub'));

  const full = blocks.length ? text + '\n\n' + blocks.join('\n\n') : text;
  // Nicht ersetzte Platzhalter markieren
  return full.replace(/\{\{[^}]+\}\}/g, m => `[${m.slice(2,-2)}?]`);
}

// Statisches Kartenbild mit Markern + Skizze generieren
async function generateMapImage(pairId, withSkizze = false) {
  const pair = PAIRS.find(p => p.id === pairId);
  if (!pair) return null;

  // Skizzen-Striche laden (nur wenn gewünscht)
  const pd = getPairData(pairId);
  let strokes = [];
  if (withSkizze && pd.sketch) { try { strokes = jsonParse(pd.sketch); } catch {} }

  // Bounding Box in LV95 — alle Marker + Skizze einschliessen
  const allE = [pair.rs?.e, pair.rks?.e].filter(Boolean);
  const allN = [pair.rs?.n, pair.rks?.n].filter(Boolean);
  strokes.forEach(s => {
    const pts = s.points || (s.pos ? [s.pos] : []);
    pts.forEach(pt => {
      const lv = wgs84ToLv95(pt.lat, pt.lng);
      allE.push(lv.e); allN.push(lv.n);
    });
  });
  const pad = 80;
  const minE = Math.min(...allE) - pad, maxE = Math.max(...allE) + pad;
  const minN = Math.min(...allN) - pad, maxN = Math.max(...allN) + pad;

  const W = 640, H = 480;
  const bbox = `${minE},${minN},${maxE},${maxN}`;
  const mapUrl = `https://api.geo.admin.ch/rest/services/api/MapServer/export?bbox=${bbox}&bboxSR=2056&layers=show:ch.swisstopo.swissimage&size=${W},${H}&format=png&f=image`;

  // LV95 → Pixel auf dem Canvas
  const toP = (e, n) => ({
    x: (e - minE) / (maxE - minE) * W,
    y: H - (n - minN) / (maxN - minN) * H,
  });

  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // Skizzen-Striche zeichnen
      strokes.forEach(s => {
        if (s.tool === 'text' && s.pos) {
          const lv = wgs84ToLv95(s.pos.lat, s.pos.lng);
          const p  = toP(lv.e, lv.n);
          ctx.save();
          ctx.font = `bold ${Math.max(12, s.size || 14)}px sans-serif`;
          ctx.strokeStyle = 'white'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
          ctx.strokeText(s.text || '', p.x, p.y);
          ctx.fillStyle = s.color || '#e53e3e';
          ctx.fillText(s.text || '', p.x, p.y);
          ctx.restore();
          return;
        }
        if (!s.points || s.points.length < 2) return;
        ctx.strokeStyle = s.color || '#e53e3e';
        ctx.lineWidth   = s.size  || 3;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        s.points.forEach((pt, i) => {
          const lv = wgs84ToLv95(pt.lat, pt.lng);
          const p  = toP(lv.e, lv.n);
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      });

      // RS-Marker
      if (pair.rs?.e && pair.rs?.n) {
        const rsP = toP(pair.rs.e, pair.rs.n);
        drawBriefMarker(ctx, rsP.x, rsP.y, '#2563eb', 'RS');
      }
      // RKS-Marker
      if (pair.rks?.e && pair.rks?.n) {
        const rksP = toP(pair.rks.e, pair.rks.n);
        drawBriefMarker(ctx, rksP.x, rksP.y, '#16a34a', 'RKS');
      }

      resolve(cv.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = mapUrl;
  });
}

function drawBriefMarker(ctx, x, y, color, label) {
  const r = 14;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = 'white'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.save();
  ctx.font = 'bold 9px sans-serif';
  ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
  ctx.restore();
}

async function renderBriefPreview() {
  const out    = document.getElementById('brief-preview-output');
  const pairId = parseInt(document.getElementById('brief-standort-select').value) || null;
  const text   = buildBriefText();

  // «Karte» = nur Luftbild ohne Skizze, «Karte + Skizze» = mit Strichen
  const needMap    = (_activeBausteine.has('karte') || _activeBausteine.has('skizze')) && pairId;
  const withSkizze = _activeBausteine.has('skizze');

  if (_activeBausteine.has('pdf') && pairId) {
    out.innerHTML = '<span style="color:#6b7280;font-size:11px;">PDF-Bericht wird als separater Download erzeugt (Drucken-Button).</span>';
  }

  if (needMap && (_briefMapImgPairId !== pairId || _briefMapWithSkizze !== withSkizze)) {
    _briefMapImgUrl    = null;
    _briefMapImgPairId = pairId;
    _briefMapWithSkizze = withSkizze;
    out.innerHTML = `<pre style="white-space:pre-wrap;margin:0 0 10px;font-family:inherit;">${escHtml(text)}</pre>`
      + '<div style="color:#6b7280;font-size:11px;">Karte wird geladen…</div>';
    const url = await generateMapImage(pairId, withSkizze);
    _briefMapImgUrl = url;
    renderBriefPreviewSync(text, _briefMapImgUrl);
  } else {
    if (!needMap) { _briefMapImgUrl = null; _briefMapImgPairId = null; _briefMapWithSkizze = false; }
    renderBriefPreviewSync(text, needMap ? _briefMapImgUrl : null);
  }
}

function renderBriefPreviewSync(text, imgUrl) {
  const out = document.getElementById('brief-preview-output');
  if (!text.trim() && !imgUrl) {
    out.innerHTML = '<span style="color:#9ca3af;font-style:italic;">Bitte zuerst eine Vorlage im Tab «Vorlage bearbeiten» schreiben oder Bausteine aktivieren.</span>';
    return;
  }
  out.innerHTML =
    (text.trim() ? `<pre style="white-space:pre-wrap;margin:0;font-family:inherit;font-size:12px;line-height:1.7;">${escHtml(text)}</pre>` : '') +
    (imgUrl ? `<div style="margin-top:12px;"><img src="${imgUrl}" style="max-width:100%;border-radius:6px;border:1px solid #e5e7eb;" alt="Standort Karte & Skizze"><div style="font-size:10px;color:#9ca3af;margin-top:3px;">Luftbild swisstopo · Massstab ca. 1:1000</div></div>` : '');
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function copyBrief() {
  const btn  = event.target.closest('button');
  const text = buildBriefText();
  // HTML-Kopie mit Bild (für Mail-Clients die HTML akzeptieren)
  const imgHtml = _briefMapImgUrl
    ? `<br><img src="${_briefMapImgUrl}" style="max-width:600px;border-radius:6px;border:1px solid #e5e7eb;"><br><small style="color:#9ca3af;">Luftbild swisstopo</small>`
    : '';
  const html = `<pre style="font-family:'Segoe UI',sans-serif;font-size:13px;line-height:1.7;white-space:pre-wrap;">${escHtml(text)}</pre>${imgHtml}`;
  try {
    navigator.clipboard.write([new ClipboardItem({
      'text/plain': new Blob([text], { type: 'text/plain' }),
      'text/html':  new Blob([html], { type: 'text/html' }),
    })]).then(() => {
      const orig = btn.innerHTML; btn.innerHTML = '✓ Kopiert!';
      setTimeout(() => btn.innerHTML = orig, 1800);
    });
  } catch {
    // Fallback: nur Text
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.innerHTML; btn.innerHTML = '✓ Kopiert!';
      setTimeout(() => btn.innerHTML = orig, 1800);
    });
  }
}

function printBrief() {
  const text = buildBriefText();
  const pairId = parseInt(document.getElementById('brief-standort-select').value) || null;
  const pair   = pairId ? PAIRS.find(p => p.id === pairId) : null;

  const imgHtml = _briefMapImgUrl
    ? `<div style="margin-top:20px;page-break-inside:avoid;">
        <img src="${_briefMapImgUrl}" style="max-width:100%;border-radius:6px;border:1px solid #e5e7eb;">
        <p style="font-size:10px;color:#9ca3af;margin-top:4px;">Luftbild © swisstopo · Massstab ca. 1:1000</p>
       </div>`
    : '';

  // PDF-Bericht: Standortdetails als Tabelle anhängen
  let pdfHtml = '';
  if (_activeBausteine.has('pdf') && pair) {
    const pd = getPairData(pair.id);
    pdfHtml = `
      <div style="margin-top:24px;page-break-before:auto;">
        <h3 style="font-size:13px;color:#1a3a5c;margin-bottom:8px;">Standortdaten: ${pair.bezeichnung || 'Standort ' + pair.id}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <tr style="background:#f0f4ff;"><td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:600;">KM RS</td><td style="padding:5px 8px;border:1px solid #e5e7eb;">${pair.km_rs.toFixed(3)}</td>
              <td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:600;">KM RKS</td><td style="padding:5px 8px;border:1px solid #e5e7eb;">${pair.km_rks.toFixed(3)}</td></tr>
          <tr><td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:600;">RS LV95</td><td style="padding:5px 8px;border:1px solid #e5e7eb;">${pair.rs?.e ?? '–'} / ${pair.rs?.n ?? '–'}</td>
              <td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:600;">RKS LV95</td><td style="padding:5px 8px;border:1px solid #e5e7eb;">${pair.rks?.e ?? '–'} / ${pair.rks?.n ?? '–'}</td></tr>
          <tr style="background:#f0f4ff;"><td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:600;">Mast</td><td style="padding:5px 8px;border:1px solid #e5e7eb;">${pair.mast}</td>
              <td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:600;">Tiefe Soll</td><td style="padding:5px 8px;border:1px solid #e5e7eb;">${pair.tiefe} m</td></tr>
          <tr><td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:600;">Tagarbeit</td><td style="padding:5px 8px;border:1px solid #e5e7eb;">${pair.tag}</td>
              <td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:600;">Gleis</td><td style="padding:5px 8px;border:1px solid #e5e7eb;">${pair.gleis}</td></tr>
          <tr style="background:#f0f4ff;"><td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:600;">Status</td><td colspan="3" style="padding:5px 8px;border:1px solid #e5e7eb;">${statusLabel(pd.status || 'geplant')}</td></tr>
          <tr><td style="padding:5px 8px;border:1px solid #e5e7eb;font-weight:600;">Zugang</td><td colspan="3" style="padding:5px 8px;border:1px solid #e5e7eb;">${escHtml(pair.zugang || '–')}</td></tr>
        </table>
      </div>`;
  }

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>body{font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;line-height:1.7;
    color:#1a1a2e;padding:40px;max-width:740px;margin:0 auto;}
    pre{white-space:pre-wrap;font-family:inherit;}
    img{max-width:100%;}
    @media print{body{padding:20px;}}</style></head>
    <body><pre>${escHtml(text)}</pre>${imgHtml}${pdfHtml}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
}

// Mail-Versand via mailto: mit Template-Text und E-Mail aus Fremdparzellen-Kontakt
function sendBrief() {
  const pairId = parseInt(document.getElementById('brief-standort-select').value) || null;
  const pair   = pairId ? PAIRS.find(p => p.id === pairId) : null;

  // E-Mail-Adresse: zuerst Fremdparzellen-Kontakt des gewählten Standorts, sonst leer
  let email = '';
  if (pair) {
    const pd = getPairData(pair.id);
    email = pd.kontakt?.email || '';
  }

  // Betreff aus Standortbezeichnung
  const bez     = pair ? (pair.bezeichnung || 'Standort ' + pair.id) : 'Sondage';
  const km      = pair?.km_rs ? ` KM ${pair.km_rs.toFixed(3)}` : '';
  const subject = encodeURIComponent(`Nutzungsanfrage Sondage Baugrund – ${bez}${km}`);
  const body    = encodeURIComponent(buildBriefText());

  window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
}

// ============================================================
