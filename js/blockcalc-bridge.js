// ============================================================
// An diese App angepasst: getActiveProjectName() statt projektName()
// und ui.toast(text, art) statt eines globalen toast() — ohne das
// waeren die Meldungen Browser-Dialoge und der Projektkopf leer.
// ============================================================
// BLOCKCALC-BRÜCKE — statischer Nachweis im iframe
// ============================================================
//
// FACHLICHE HINWEISE
// Uebernommen aus der Integrationsanleitung, die als eigener Ordner im
// Projekt lag und nach dem Einbau entfernt wurde. Die Punkte stehen sonst
// nirgends im Code und sind keiner Datei anzusehen.
//
// Kopfhoehe — beide Seiten meinen inzwischen dasselbe.
//   Diese App fuehrt kopfHoehe als GESAMTMASS (OK Block bis OK Kopf,
//   Standard 1.00 m). BlockCalc hat seine Konvention im August 2026
//   nachgezogen: dort ist H_Kopf seither ebenfalls das Gesamtmass ab
//   Koerper-Oberkante, und der Ueberstand ueber Terrain ist keine
//   Eingabegroesse mehr, sondern H_Kopf - ue.
//
//   Bis dahin war H_Kopf der Ueberstand, und die Zuordnung war die Falle,
//   die man nicht erraten konnte. Sie ist keine mehr — aber die Bruecke
//   schickt weiterhin BEIDE Groessen, kopfHoehe und ueberstand, denn
//   BlockCalc leitet die Ueberdeckung daraus ab:
//     ue = kopfHoehe - Ueberstand     H_Kopf = kopfHoehe
//   Fehlt der Ueberstand, setzt BlockCalc ue auf 0.40 m und warnt.
//   Nachgemessen am laufenden Rundlauf (v238): gesendet kopfHoehe 1.00 und
//   Ueberstand 0.60, in BlockCalc angekommen g_hkopf 1.00 und g_uberd 0.40.
//   Ueberstand = fundkopf_mueM - (gelaende_swisstopo ?? pair.gelaendehoehe).
//   Fehlen die Hoehenkoten, greift der Erwartungswert der Neigungsklasse:
//   0.60 m bei <= 14 Grad, 0.40 m bei 14-33 Grad — dieselben Werte, gegen
//   die loadHoehenkoten() das Delta Terrain schon plausibilisiert.
//
// Standardlasten — einmalig je Arbeitsstation importieren.
//   Lastschluessel ist bp.refFamilie ("Referenztyp (Standardlasten)"), das
//   Feld erscheint ohnehin nur bei Spezialfundamenten. Die Lastwerte stehen
//   NICHT im Code, sondern in
//   blockcalc/Lastniveaus_SBB_0161.1011.0002_a.json (8 Niveaus:
//   DP1a/DP2a/HP1a/HP2a mal V=0/V=150).
//   Einzuspielen ueber: BlockCalc oeffnen, Optionen, Datenaustausch,
//   Import, diese Datei waehlen. Ohne sie meldet BlockCalc "Lastniveau
//   nicht gefunden" — und zwar auf jedem Rechner neu.
//   Dass es zwei Faelle je Position sind, gibt die Norm vor: Nachweise mit
//   V_min = 0 kN und V_max = 150 kN. V=0 ist fuer den Steckner-GZT
//   massgebend, V=150 fuer Grundbruch und Setzung. Die Bruecke schickt
//   derzeit vFall:'max'; den zweiten Fall bei Bedarf als zweiten Durchgang.
//
// Neigungsklasse 14-33 Grad — Modellgrenze, kein Versagen.
//   Die konservative Klassenobergrenze 33 Grad treibt den Block-GZG in
//   seinen Modellgrenzfall: Steckners Gl. 4 mindert C1 mit (1 + beta/40),
//   bei -33 Grad bleibt kaum Bettung uebrig. Gemessen liefert derselbe Fall
//   eta_GZT 0.81, aber eta_GZG 0.012. Ohne Hinweis kaeme jede Position
//   dieser Klasse als "nicht erfuellt" zurueck. Die Bruecke haengt darum
//   einen Hinweis an: tatsaechlichen Boeschungswinkel erfassen und, bei
//   endlicher Boeschung, die Boeschungshoehe h_beta.
//
// Nicht gefuehrt.
//   Torsionsmoment T (3.3-5.0 kNm nach 0161.1011.0002_a) rechnet BlockCalc
//   nicht. Es wird mitgetragen und als Hinweis ausgewiesen, nicht
//   stillschweigend weggelassen. Ebenfalls nicht abgedeckt: Verankerung im
//   Fels ueber Anker (0161.1011.0601) und Befestigung an einer Mauer —
//   beide erscheinen mit Infotext statt Knopf.
// ============================================================
// Öffnet BlockCalc für EINE Position, übergibt Geometrie/Baugrund/Lasten und schreibt die
// dimensionierten Abmessungen zurück. Bewusst kein Stapellauf: jede Berechnung wird vom
// Ingenieur gesichtet — der Nutzen liegt im schnellen Hin und Her je Position.
//
// Protokoll (Gegenstück in BlockCalc: Abschnitt „EMBED-MODUS")
//   ← blockcalc:ready              BlockCalc ist bereit
//   → blockcalc:case   {payload}   ein Rechenfall
//   ← blockcalc:loaded {hinweise}  übernommen, ggf. mit Hinweisen
//   ← blockcalc:result {payload}   Bauweise + Abmessungen + Nachweise
// Ohne Ergebnis verlassen wird über „Schliessen" im Kopf dieses Overlays erledigt — der Host
// schliesst also selbst und braucht dafür keine Meldung des Guests.
//
// AUSLIEFERUNG: BlockCalc gehört als Unterordner ./blockcalc/ neben diese App.
// Dann ist alles same-origin, offline lauffähig und — wichtig für einen prüffähigen
// Nachweis — versionsfest. Ein iframe auf eine lebende GitHub-Pages-URL würde das
// Ergebnis einer bereits geprüften Berechnung bei jedem Commit still verändern.
// Standardpfad = Unterordner (empfohlene Auslieferung). Liegt BlockCalc woanders — Submodul,
// Geschwisterordner, Entwicklungsstand — kann `window.BLOCKCALC_URL` das überschreiben, ohne
// dieses Modul zu ändern. Wird bei jedem Öffnen frisch gelesen.
function bcUrl() {
  return (typeof window !== 'undefined' && window.BLOCKCALC_URL) || 'blockcalc/index.html?embed=1';
}

// Erwarteter Überstand OK Kopf über Terrain je Neigungsklasse [m].
// Gleiche Werte, die loadHoehenkoten() zur Δ-Terrain-Plausibilisierung verwendet.
const BC_UEBERSTAND = { '≤14°': 0.60, '14–33°': 0.40, '>33°': 0.40 };
// Böschungswinkel je Klasse — konservativ die Klassenobergrenze
const BC_BETA = { '≤14°': 14, '14–33°': 33, '>33°': 33 };
// fundamentArt der Bibliothek → Berechnungsmodell in BlockCalc
const BC_MODELL = { blockfundament: 'block', mehrpfahl: 'pfahlbock' };
// Bauweisen, die BlockCalc (noch) nicht abbildet — mit Begründung statt stummer Ablehnung.
// ── STANDARDLASTEN ──────────────────────────────────────────
// Vorlaeufig hier im Code statt allein in BlockCalcs Importdatei.
//
// Grund: der Import dort gilt pro Geraet und Browser. Fehlt er, findet
// BlockCalc den Typenschluessel nicht und rechnet still mit seinen
// Vorgabewerten weiter — gemessen NG 50 / MGx 40 statt der Werte des
// Referenztyps. Solange die App in Entwicklung ist, reisen die Lasten
// deshalb im Fall mit; BlockCalc gibt expliziten Werten Vorrang vor dem
// Schluessel. Am Schluss wandern sie zurueck in die Importdatei.
//
// Quelle: 0161.1011.0002_a (ab 2019), charakteristisch, OK Fundamentkopf.
// V=0 und V=150 unterscheiden sich NUR im NG. Deshalb steht hier je Familie
// EIN Satz, und NG kommt aus der Bauweise:
//     Blockfundament   NG =   0 kN
//     Pfahlfundament   NG = 150 kN
const BC_LASTEN = {
  DP1a: { HGx: 5,    HGy: 5,    MGx: 40,   MGy: 40,   HWx: 5,    HWy: 5,    MWx: 40,   MWy: 40,   _masttyp: 'DP22',     _torsion: 3.3 },
  DP2a: { HGx: 8.5,  HGy: 8.5,  MGx: 67.5, MGy: 67.5, HWx: 8.5,  HWy: 8.5,  MWx: 67.5, MWy: 67.5, _masttyp: 'DP26',     _torsion: 4.7 },
  HP1a: { HGx: 14.5, HGy: 9.5,  MGx: 77,   MGy: 115,  HWx: 14.5, HWy: 9.5,  MWx: 77,   MWy: 115,  _masttyp: 'DPM24',    _torsion: 5.0 },
  HP2a: { HGx: 9.5,  HGy: 14.5, MGx: 115,  MGy: 77,   HWx: 9.5,  HWy: 14.5, MWx: 115,  MWy: 77,   _masttyp: 'DPM24-P',  _torsion: 5.0 },
  // DG1a-DG3a: Lasten noch nicht definiert. Bis dahin faellt die Bruecke fuer
  // diese Familien auf den Typenschluessel zurueck und weist darauf hin.
};
const BC_NG = { block: 0, flach: 0, pfahlbock: 150 };

// Lastblock des Falls. Ist die Familie hinterlegt, gehen die Werte explizit
// mit; sonst nur der Schluessel, den BlockCalc in seiner eigenen Tabelle
// sucht. Das Torsionsmoment reist mit, obwohl BlockCalc es nicht fuehrt —
// es weist es dann als Hinweis aus, statt dass es stillschweigend fehlt.
function bcLastblock(familie, modell) {
  const vFall = (BC_NG[modell] ?? 0) > 0 ? 'max' : 'min';
  const satz = BC_LASTEN[familie];
  if (!satz) return { typ: familie || '', vFall };
  const { _masttyp, _torsion, ...werte } = satz;
  return { typ: familie, vFall, werte: { ...werte, NG: BC_NG[modell] ?? 0 }, torsion: _torsion };
}

const BC_NICHT_RECHENBAR = {
  fels:     'Verankerung im Fels wird von BlockCalc noch nicht gerechnet — der Nachweis über Anker ' +
            '(0161.1011.0601) ist dort nicht abgebildet. Nachweis separat führen.',
  mauer:    'Befestigung an einer Mauer wird von BlockCalc noch nicht gerechnet — es fehlt das ' +
            'Modell für die Einleitung in das bestehende Bauwerk. Nachweis separat führen.',
  bauwerk:  'Mast auf Kunstbau wird von BlockCalc nicht gerechnet — der Nachweis gehört zum Bauwerk.',
  sonstige: 'Für diese Bauweise (z. B. Brunnenring) hat BlockCalc kein Modell.'
};

let _bcPairId = null;      // Position, für die gerade gerechnet wird
let _bcReady  = false;
let _bcPending = null;     // Fall, der noch auf 'ready' wartet

// „1200×1200 mm" / „1.2 x 1.2 m" → [1.20, 1.20] (m)
function bcMasse(s) {
  const m = String(s || '').match(/(\d+(?:[.,]\d+)?)\s*[×xX*]\s*(\d+(?:[.,]\d+)?)/);
  if (!m) return [null, null];
  const f = v => { const n = parseFloat(String(v).replace(',', '.')); return n > 20 ? n / 1000 : n; };
  return [f(m[1]), f(m[2])];
}
const bcNum = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? null : n; };

// Bauweise bestimmen. Spezialfundamente sind oft FREI BENANNT und haben gar keinen
// Bibliothekseintrag — und selbst die vorhandenen spezial-Einträge führen bewusst KEINE
// Geometrie (blockAbmessung/tiefe sind leer), weil es bei ihnen keine Standardmasse gibt.
// Darum: Profil nutzen wenn vorhanden, sonst aus dem Namen ableiten.
function bcArtErmitteln(name, ft) {
  if (ft?.fundamentArt) return ft.fundamentArt;
  const n = String(name || '').toLowerCase();
  if (/mauer/.test(n))                          return 'mauer';
  if (/bauwerk|kunstbau|abutment|perron/.test(n)) return 'bauwerk';
  if (/brunnen/.test(n))                        return 'sonstige';
  if (/fels|anker/.test(n))                     return 'fels';
  if (/pfahl/.test(n))                          return 'mehrpfahl';
  return 'blockfundament';
}

// Rechnet diese Position überhaupt? (nur Spezialfundamente mit einem Modell, das BlockCalc kennt)
function bcRechenbar(pairId) {
  const bp = (loadAllBauprojekt()[pairId]) || {};
  if (!bp.fundtyp || !isFtSpezial(bp.fundtyp)) return { ok: false, grund: 'kein Spezialfundament' };
  const ft  = loadFtProfile().find(t => t.name === bp.fundtyp);
  const art = bcArtErmitteln(bp.fundtyp, ft);
  if (!BC_MODELL[art])
    return { ok: false, art,
             grund: BC_NICHT_RECHENBAR[art] || ('Bauweise «' + art + '» wird von BlockCalc nicht gerechnet.') };
  return { ok: true, art, ft, bp };
}

// ── Position → Rechenfall ────────────────────────────────────────────────────
function bcFallBauen(pairId) {
  const pair = (typeof PAIRS !== 'undefined' ? PAIRS : []).find(p => p.id === pairId) || {};
  const chk  = bcRechenbar(pairId);
  if (!chk.ok) return null;
  const { ft, bp, art } = chk;
  const hinweise = [];

  // Geometrie: ZUERST aus einer früheren BlockCalc-Dimensionierung dieser Position,
  // sonst aus dem Profil.
  //
  // Die Reihenfolge war umgekehrt, und bei den Pfählen fehlte der Rückfall ganz.
  // Folge: eine auf 7.5 m dimensionierte Pfahllänge wurde beim nächsten Öffnen
  // wieder als die 6.0 m des Profils hinübergeschickt — das Ergebnis war
  // gespeichert, kam aber nicht mit. Ein Ergebnis gehört zu DIESER Position und
  // ist neuer; das Profil ist der Bibliothekswert für den Start.
  //
  // Für die Blockmasse ist die Umkehr folgenlos: kein Spezialprofil trägt Masse
  // (alle sieben durchgesehen). Sie vereinheitlicht nur, was für die Pfähle
  // ohnehin nötig war.
  //
  // Spezialfundamente haben regelmässig KEINE Standardmasse — dann bleiben die
  // Felder leer, BlockCalc startet mit seinen Vorgabewerten und der Ingenieur trägt die
  // tatsächliche Geometrie dort ein. Das ist der vorgesehene Weg, kein Fehlerfall.
  const [Bbc, Lbc] = bcMasse(bp.bcAbmessung);
  const [Bft, Lft] = bcMasse(ft?.blockAbmessung);
  const B = Bbc ?? Bft, L = Lbc ?? Lft;
  const [Bk, Lk]  = bcMasse(ft?.kopfAbmessung);
  const kopfHoehe = bcNum(ft?.kopfHoehe) ?? 1.00;
  const tiefe     = bcNum(bp.bcTiefe) ?? bcNum(ft?.tiefe);
  if (B == null || tiefe == null)
    hinweise.push('Für diesen Typ sind keine Standardmasse hinterlegt — Geometrie in BlockCalc erfassen.');

  // Überstand OK Kopf über Terrain: gemessen, sonst Klassen-Erwartungswert.
  // BlockCalc leitet daraus ü = kopfHoehe − Überstand ab (dort ist H_Kopf der Überstand).
  const kopfKote = bcNum(bp.fundkopf_mueM);
  const gelaende = bcNum(bp.gelaende_swisstopo ?? pair.gelaendehoehe);
  let ueberstand = (kopfKote != null && gelaende != null) ? +(kopfKote - gelaende).toFixed(2) : null;
  if (ueberstand == null) {
    ueberstand = BC_UEBERSTAND[bp.neigung] ?? 0.60;
    hinweise.push('Keine Höhenkoten erfasst — Überstand mit dem Erwartungswert ' +
                  ueberstand.toFixed(2) + ' m der Neigungsklasse angesetzt.');
  } else if (ueberstand <= 0) {
    hinweise.push('Gemessener Überstand ' + ueberstand.toFixed(2) + ' m ist ≤ 0 — Höhenkoten prüfen.');
  }
  const _neigGemessen = (typeof neigungGemessen === 'function') ? neigungGemessen(bp) : null;
  const _neigKlasse   = (typeof neigungKlasse === 'function') ? neigungKlasse(bp) : (bp.neigung || '');
  if (_neigGemessen != null)
    hinweise.push('Gemessene Geländeneigung ' + _neigGemessen.toFixed(1) + '° übergeben'
                + (_neigGemessen > 33 ? ' — über 33°, kein Standardfundament.' : '.'));
  else if (_neigKlasse === '>33°')
    hinweise.push('Neigung > 33°: BlockCalc erhält 33° als UNTERGRENZE — den tatsächlichen Winkel dort von Hand erfassen.');
  else if (_neigKlasse === '14–33°')
    // Die Klassenobergrenze ist zwar konservativ, treibt den Block-GZG aber in seinen
    // Modellgrenzfall: Steckners Gl.4 mindert C₁ mit (1+β/40) und lässt die Bettung gegen
    // β = −40° verschwinden. Bei −33° bleibt davon wenig übrig → η_GZG wird sehr klein.
    // Das ist eine Modellgrenze, kein reales Versagen.
    hinweise.push('Neigungsklasse 14–33°: konservativ mit 33° gerechnet. Der Block-GZG (Schiefstellung) ' +
                  'erreicht dort seine Modellgrenze — für ein belastbares Ergebnis den tatsächlichen ' +
                  'Böschungswinkel und, falls die Böschung endlich ist, die Böschungshöhe h_β erfassen.');
  // Referenztyp ueber den Aufloeser: er sieht auch im FT-Profil und im
  // Typnamen nach. Das rohe Feld allein ist leer, sobald der Wert von dort
  // kommt — und dann waeren die Lasten weg, ohne dass es jemand merkt.
  const familie = (typeof getBpRefFamilie === 'function') ? getBpRefFamilie(bp) : (bp.refFamilie || '');
  if (!familie)
    hinweise.push('Kein Referenztyp gesetzt — ohne ihn stehen keine Standardlasten zur Verfügung.');
  else if (!BC_LASTEN[familie])
    hinweise.push('Für den Referenztyp «' + familie + '» sind in der App noch keine Lasten hinterlegt — '
                + 'BlockCalc sucht den Schlüssel in seiner eigenen Tabelle.');

  const phi   = bcNum(bp.bkPhi);
  const gamma = bcNum(bp.bkGamma) ?? 20;
  if (phi == null) hinweise.push('Kein φ′ erfasst — BlockCalc rechnet mit seiner Voreinstellung.');

  return {
    schema: 'blockcalc.case/1',
    id: pairId,
    meta: {
      projekt:  (typeof getActiveProjectName === 'function' ? getActiveProjectName() : '') || '',
      fundament: pair.bezeichnung || ('Mast ' + (pair.mast || '')),
      mastNr:   pair.mast || '',
      km:       pair.km_rs != null ? String(pair.km_rs) : '',
      bemerkung: bp.bemerkung || ''
    },
    modell: BC_MODELL[art],
    geometrie: {
      B, L, H_Block: tiefe,
      B_Kopf: Bk, L_Kopf: Lk,
      kopfHoehe,                 // Gesamtmass OK Block → OK Kopf
      ueberstand,                // OK Kopf über Terrain
      // Pfahllänge ab UK Block — dieselbe Definition wie BlockCalcs pb_L, das
      // beim Pfahlbock ab Unterkante Bankett misst.
      pfahlAnzahl: bcNum(bp.bcPfahlAnzahl) ?? bcNum(ft?.anzahlPfaehle)
                   ?? (/mono|einzel/i.test(bp.fundtyp) ? 1 : null),
      pfahlLaenge: bcNum(bp.bcPfahlLaenge) ?? bcNum(ft?.pfahlLaenge)
    },
    baugrund: {
      schichten: [{
        name: bp.bkBodentyp || 'Baugrund',
        phi: phi ?? 27, c: bcNum(bp.bkC) ?? 0,
        gamma, gamma2: Math.max(8, gamma - 10),
        me: bcNum(bp.bkMe) ?? 25, d: 999
      }],
      gw: !!bp.bkGrundwasser && bp.bkGrundwasser !== 'nein',
      gwTiefe: bcNum(bp.bkGrundwasserTiefe),
      // Gemessener Winkel, sonst die Klassenobergrenze. Der gemessene ist der
      // belastbarere Wert — die Obergrenze ist eine konservative Annahme.
      neigung: { beta: neigungGrad(bp) ?? 0 }
    },
    lasten: bcLastblock(familie, BC_MODELL[art]),
    _hinweise: hinweise
  };
}

// ── Overlay ──────────────────────────────────────────────────────────────────
function bcOverlay() {
  let ov = document.getElementById('bc-overlay');
  if (ov) return ov;
  ov = document.createElement('div');
  ov.id = 'bc-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:4000;background:rgba(15,23,42,.55);' +
                     'display:none;align-items:center;justify-content:center;padding:16px;';
  ov.innerHTML =
    '<div style="background:#fff;border-radius:10px;width:min(1400px,100%);height:min(900px,100%);' +
         'display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.3)">' +
      '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid #e5e7eb">' +
        '<strong id="bc-ov-title" style="font-size:13px;color:#374151">Statischer Nachweis</strong>' +
        '<span id="bc-ov-hint" style="font-size:11px;color:#d97706"></span>' +
        '<span style="flex:1"></span>' +
        '<button onclick="bcSchliessen()" style="border:1px solid #e5e7eb;background:#fff;border-radius:6px;' +
                'padding:4px 10px;font-size:12px;cursor:pointer">Schliessen</button>' +
      '</div>' +
      '<iframe id="bc-frame" title="BlockCalc" style="border:0;flex:1;width:100%"></iframe>' +
    '</div>';
  document.body.appendChild(ov);
  return ov;
}
function bcSchliessen() {
  const ov = document.getElementById('bc-overlay');
  if (ov) { ov.style.display = 'none'; const f = document.getElementById('bc-frame'); if (f) f.src = 'about:blank'; }
  _bcReady = false; _bcPending = null; _bcPairId = null;
}

// ── Öffnen ───────────────────────────────────────────────────────────────────
function bcNachweisOeffnen(pairId) {
  pairId = pairId || (typeof currentPairId !== 'undefined' ? currentPairId : null);
  if (!pairId) return;
  const fall = bcFallBauen(pairId);
  if (!fall) {
    const g = bcRechenbar(pairId).grund || 'nicht rechenbar';
    ui.toast('BlockCalc: ' + g, 'fehler');
    return;
  }
  _bcPairId = pairId; _bcReady = false; _bcPending = fall;

  const ov = bcOverlay();
  ov.style.display = 'flex';
  document.getElementById('bc-ov-title').textContent =
    'Statischer Nachweis — ' + fall.meta.fundament + (fall.lasten.typ ? ' · ' + fall.lasten.typ : '');
  document.getElementById('bc-ov-hint').textContent =
    fall._hinweise.length ? fall._hinweise.length + ' Hinweis' + (fall._hinweise.length > 1 ? 'e' : '') : '';
  document.getElementById('bc-frame').src = bcUrl();
}

// ── Nachrichten ──────────────────────────────────────────────────────────────
function bcSenden(fall) {
  const f = document.getElementById('bc-frame');
  if (!f || !f.contentWindow) return;
  // Ziel-Origin: bei Unterordner-Auslieferung identisch mit dem eigenen
  f.contentWindow.postMessage({ v: 1, type: 'blockcalc:case', payload: fall }, location.origin);
}

window.addEventListener('message', ev => {
  const d = ev.data;
  if (!d || typeof d !== 'object' || String(d.type || '').indexOf('blockcalc:') !== 0) return;
  // Nur der eigene Origin ist erlaubt (Unterordner-Auslieferung). Bei getrennten Origins
  // hier den erwarteten Origin von BLOCKCALC_URL ergänzen.
  if (ev.origin !== location.origin && !(location.protocol === 'file:' && ev.origin === 'null')) return;

  if (d.type === 'blockcalc:ready') {
    _bcReady = true;
    if (_bcPending) { bcSenden(_bcPending); _bcPending = null; }
  }
  else if (d.type === 'blockcalc:result') bcErgebnisUebernehmen(d.payload);
  else if (d.type === 'blockcalc:error')  {
    ui.toast('BlockCalc-Fehler: ' + d.message, 'fehler');
  }
});

// ── Ergebnis zurückschreiben ─────────────────────────────────────────────────
function bcErgebnisUebernehmen(r) {
  if (!r || !r.id) return;
  const pairId = r.id;
  const all = loadAllBauprojekt();
  const bp  = all[pairId] || {};
  const a   = r.abmessung || {};

  // Bauart in BlockCalc gewechselt? In der Fundamentbau-App steht anfangs fast immer ein
  // Blockfundament — ob es reicht, zeigt sich erst in der Rechnung. Wechselt der Ingenieur
  // dort auf Pfahlfundament, muss die Position das übernehmen, sonst driftet sie von ihrem
  // eigenen Nachweis weg. Ziel-Fundamenttyp aus der Bibliothek nach fundamentArt suchen.
  let typWechsel = null;
  if (r.modellGeaendert) {
    const zielArt = { block: 'blockfundament', flach: 'blockfundament', pfahlbock: 'mehrpfahl' }[r.modell];
    const ziel = loadFtProfile().find(t => t.typ === 'spezial' && t.fundamentArt === zielArt);
    if (ziel) {
      typWechsel = { von: bp.fundtyp || '(leer)', nach: ziel.name,
                     vonBauweise: r.bauweiseVorher, nachBauweise: r.bauweise };
    }
  }

  const neu = { ...bp, blockcalc: {
    version: r.version, zeitpunkt: r.zeitpunkt, bauweise: r.bauweise,
    bauweiseVorher: r.modellGeaendert ? r.bauweiseVorher : null,
    abmessung: r.abmessungText, kubatur: r.betonKubatur,
    etaGZT: r.nachweise?.etaGZT ?? null, etaGZG: r.nachweise?.etaGZG ?? null,
    etaMin: r.nachweise?.etaMin ?? null, massgebend: r.nachweise?.massgebend || '',
    erfuellt: !!r.nachweise?.erfuellt, hinweise: r.hinweise || []
  }};
  // Dimensionierte Abmessungen in die Position übernehmen. Beim Einzelpfahl gibt es kein
  // Bankett — dort sind Pfahllänge und Profil die Abmessung, ein B×L wäre irreführend.
  // Zuerst die alten Masse verwerfen: wechselt eine Position die Bauweise (Block → Einzelpfahl),
  // bliebe sonst ein nicht mehr zutreffendes B×L stehen und täuschte eine Abmessung vor.
  ['bcAbmessung', 'bcTiefe', 'bcPfahlLaenge', 'bcPfahlAnzahl', 'bcProfil'].forEach(k => delete neu[k]);
  if (a.B && a.L) neu.bcAbmessung = Math.round(a.B * 1000) + '×' + Math.round(a.L * 1000) + ' mm';
  if (a.H_Block) neu.bcTiefe = a.H_Block;
  if (a.pfahlLaenge) {
    neu.bcPfahlLaenge = a.pfahlLaenge;
    if (a.pfahlAnzahl) neu.bcPfahlAnzahl = a.pfahlAnzahl;
    if (a.profil)      neu.bcProfil      = a.profil;
  }

  if (typWechsel) neu.fundtyp = typWechsel.nach;

  all[pairId] = neu;
  saveAllBauprojekt(all);
  if (typeof logChange === 'function') {
    logChange(pairId, 'BlockCalc-Nachweis',
      r.bauweise + ' ' + r.abmessungText + ' · η = ' +
      (r.nachweise?.etaMin != null ? r.nachweise.etaMin.toFixed(2) : '–') +
      ' (' + (r.nachweise?.massgebend || '–') + ')', 'nachweis');
    if (typWechsel)
      logChange(pairId, 'Bauart geändert (BlockCalc)',
        typWechsel.vonBauweise + ' → ' + typWechsel.nachBauweise +
        ' · Fundamenttyp «' + typWechsel.von + '» → «' + typWechsel.nach + '»', 'nachweis');
  }

  bcSchliessen();
  if (typeof refreshCurrentView === 'function') refreshCurrentView();
  if (typeof loadBauprojektFelder === 'function') loadBauprojektFelder(pairId);  // Fundamenttyp-Feld nachziehen
  ui.toast((typWechsel ? 'Bauart → ' + typWechsel.nachBauweise + ' · ' : 'Nachweis übernommen: ')
           + r.abmessungText + (r.nachweise?.erfuellt ? '' : ' — NICHT erfüllt'),
           r.nachweise?.erfuellt ? 'erfolg' : 'fehler');
}

// ── Statuszeile für die Nachweis-Sektion ─────────────────────────────────────
// Wird von loadBauprojektFelder() aufgerufen; zeigt das zuletzt übernommene Ergebnis.
// Traegt der Nachweisbereich nur noch BlockCalc (FT-Profil zugewiesen), soll er
// verschwinden, wenn weder Knopf noch Statuszeile etwas zeigen — sonst bliebe
// die Ueberschrift «Statischer Nachweis» ueber einer leeren Flaeche stehen.
function _bcBereichEinziehen() {
  const wrap = document.getElementById('bp-nachweis-wrap');
  if (!wrap || wrap.dataset.nurBc !== '1') return;
  const sichtbar = el => el && el.style.display !== 'none';
  wrap.style.display =
    (sichtbar(document.getElementById('bc-btn')) || sichtbar(document.getElementById('bc-status')))
      ? '' : 'none';
}

function bcStatusAktualisieren(pairId) {
  const box = document.getElementById('bc-status');
  if (!box) return;
  const chk = bcRechenbar(pairId);
  const btn = document.getElementById('bc-btn');
  if (btn) btn.style.display = chk.ok ? '' : 'none';

  // Spezialfundament, das BlockCalc nicht abbildet (Fels, Mauer, Kunstbau, Brunnenring):
  // kurz erklären, warum hier kein Nachweis angeboten wird — statt nur den Button zu verstecken.
  if (!chk.ok && chk.art && BC_NICHT_RECHENBAR[chk.art]) {
    box.style.display = '';
    box.innerHTML =
      '<div style="border:1px solid #e5e7eb;border-radius:6px;padding:5px 8px;font-size:11px;' +
           'margin-top:5px;color:#6b7280;background:#f9fafb">' + BC_NICHT_RECHENBAR[chk.art] + '</div>';
    _bcBereichEinziehen();
    return;
  }

  const bc = (loadAllBauprojekt()[pairId] || {}).blockcalc;
  if (!bc) { box.style.display = 'none'; _bcBereichEinziehen(); return; }
  box.style.display = '';
  const farbe = bc.erfuellt ? '#15803d' : '#b91c1c';
  const wechsel = bc.bauweiseVorher
    ? '<div style="color:#d97706">Bauart in BlockCalc geändert: ' + bc.bauweiseVorher + ' → ' + bc.bauweise + '</div>'
    : '';
  box.innerHTML =
    '<div style="border:1px solid #e5e7eb;border-radius:6px;padding:5px 8px;font-size:11px;margin-top:5px">' +
      '<div style="color:' + farbe + ';font-weight:600">' +
        bc.bauweise + ' · ' + bc.abmessung + ' — ' + (bc.erfuellt ? 'erfüllt' : 'nicht erfüllt') + '</div>' + wechsel +
      '<div style="color:#6b7280">η = ' + (bc.etaMin != null ? bc.etaMin.toFixed(2) : '–') +
        ' (' + bc.massgebend + ')' + (bc.kubatur ? ' · ' + bc.kubatur + ' m³' : '') + '</div>' +
      '<div style="color:#9ca3af;font-size:10px">' + bc.version + ' · ' +
        new Date(bc.zeitpunkt).toLocaleString('de-CH') + '</div>' +
    '</div>';
  _bcBereichEinziehen();
}
