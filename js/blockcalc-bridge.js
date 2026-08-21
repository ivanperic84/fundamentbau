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
//   ← blockcalc:loaded {id,hinweise}  übernommen (FLACH — kein payload)
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

// Das Baugrundprofil dieser Position — als EINE Form, egal woher es kommt.
// Ist keines zugewiesen, stehen die Kennwerte direkt an der Position (aus
// der Bodenkennwerte-Sektion); sie werden als Profil ohne Schichtaufbau
// gereicht, damit die Übergabe nur einen Weg kennt.
function bcBaugrundProfil(pairId, bp) {
  const id = bp.bgProfilId || (typeof loadBgZuweisungen === 'function' ? loadBgZuweisungen()[pairId] : '');
  const p  = id && typeof loadBgProfile === 'function' ? loadBgProfile().find(x => x.id === id) : null;
  if (p) return p;
  return { name: 'Baugrund', auslegung: 'manuell', schichten: [],
           bodentyp: bp.bkBodentyp, uscs: '',
           me: bp.bkMe, phi: bp.bkPhi, gamma: bp.bkGamma, c: bp.bkC };
}

// Welcher Baugrund geht hinüber: der erfasste Schichtaufbau oder der eine
// ausgelegte Satz. Die Wahl gehört zur Position und bleibt dort stehen —
// wer sie einmal getroffen hat, soll sie beim zweiten Lauf nicht wiederholen.
function bcBaugrundModus(bp, profil) {
  if (!bgSchichten(profil).length) return 'auslegung';
  return bp.bcBaugrundModus === 'auslegung' ? 'auslegung' : 'schichten';
}

// ── BLOCKCALCS UEBERNAHMEHINWEISE ───────────────────────────
// Was BlockCalc beim Einlesen des Falls beanstandet, meldet es zurück:
//   ← blockcalc:loaded { id, hinweise: [...] }
//
// Die Nachricht wurde bisher nicht behandelt. Verloren waren die Hinweise
// deshalb nicht ganz — BlockCalc legt dieselbe Liste auch dem ERGEBNIS bei,
// und bcErgebnisUebernehmen() schreibt sie seit je nach bp.blockcalc.hinweise.
// Nur gelesen hat sie dort nie jemand: die Statuszeile zeigte Bauweise,
// Abmessung, η und Datum — die Hinweise nicht.
//
// Zweimal falsch also, an zwei Stellen:
//   live    Wer den Fall lädt, sieht erst nach dem Rechnen, dass BlockCalc
//           etwas anderes angesetzt hat als geschickt wurde — und wer ohne
//           Ergebnis schliesst, erfährt es nie.
//   später  Ein Nachweis, der mit abweichender Pfahlzahl gerechnet wurde,
//           sah in der Sidebar aus wie jeder andere.
//
// Beides ist hier behoben: die Liste erscheint sofort im Kopf der
// Überlagerung und bleibt danach in der Statuszeile stehen.
//
// EINSTUFUNG. Ein Hinweis heisst entweder «BlockCalc hat etwas anderes
// angesetzt als geschickt» (Lastniveau nicht gefunden, Pfahlzahl nicht im
// Auswahlsatz, Baugrund der Voreinstellung) oder er ist reine Auskunft
// (Torsion wird nicht geführt, Klassenobergrenze konservativ angesetzt).
// Unterschieden wird am Text — die Auskunftsfälle sind benannt, ALLES
// ANDERE gilt als Abweichung. Diese Richtung ist Absicht: formuliert
// BlockCalc einmal um oder kommt eine neue Warnung dazu, wird sie zu
// deutlich angezeigt statt zu leise. Der umgekehrte Fehler wäre der
// gefährliche.
const BC_NUR_AUSKUNFT = /nicht geführt|konservativ/i;
const bcIstAbweichung = t => !BC_NUR_AUSKUNFT.test(String(t || ''));

let _bcUebernahme = [];    // Hinweise aus blockcalc:loaded, für diesen Lauf
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

  // ── Baugrund
  const profil   = bcBaugrundProfil(pairId, bp);
  const bgModus  = bcBaugrundModus(bp, profil);
  const schichten = bgSchichtenFuerBlockCalc(profil, bgModus);
  const nSchicht = bgSchichten(profil).length;
  if (!nSchicht)
    hinweise.push('Kein Schichtaufbau erfasst — der Baugrund geht als eine durchgehende Schicht hinüber.');
  else if (bgModus === 'auslegung')
    hinweise.push('Baugrund als ' + (BG_AUSLEGUNG[bgAuslegungModus(profil)]?.kurz || 'ausgelegter')
                + '-Auslegung übergeben; die ' + nSchicht + ' erfassten Schichten bleiben aussen vor.');
  // Fehlt φ′ überall, setzt bgSchichtenFuerBlockCalc still 27° ein. Das ist
  // ein Vorgabewert, kein erfasster Boden — er gehört benannt.
  const phiErfasst = nSchicht ? bgSchichten(profil).some(s => bgZahl(s.phi) != null)
                              : bgZahl(profil.phi) != null;
  if (!phiErfasst) hinweise.push('Kein φ′ erfasst — BlockCalc rechnet mit seiner Voreinstellung.');

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
      // Der erfasste Aufbau, oder dessen Auslegung als eine Schicht.
      // BlockCalc nimmt beide Formen gleich entgegen; die unterste Schicht
      // trägt d = 999 und reicht damit durchgehend nach unten.
      schichten,
      gw: !!bp.bkGrundwasser && bp.bkGrundwasser !== 'nein',
      gwTiefe: bcNum(bp.bkGrundwasserTiefe),
      // Gemessener Winkel, sonst die Klassenobergrenze. Der gemessene ist der
      // belastbarere Wert — die Obergrenze ist eine konservative Annahme.
      neigung: { beta: neigungGrad(bp) ?? 0 }
    },
    lasten: bcLastblock(familie, BC_MODELL[art]),
    _hinweise: hinweise,
    // Nur für die Vorschau: woher jeder Wert stammt. Eine Zahl allein sagt
    // nicht, ob sie aus einer früheren Rechnung, aus dem Typenprofil oder
    // gar nicht kommt — und genau das will man vor dem Start sehen.
    _herkunft: {
      masse:  Bbc != null ? 'Ergebnis' : (Bft != null ? 'Typenprofil' : '—'),
      tiefe:  bcNum(bp.bcTiefe) != null ? 'Ergebnis' : (bcNum(ft?.tiefe) != null ? 'Typenprofil' : '—'),
      pfahl:  bcNum(bp.bcPfahlLaenge) != null ? 'Ergebnis' : (bcNum(ft?.pfahlLaenge) != null ? 'Typenprofil' : '—'),
      hoehe:  (kopfKote != null && gelaende != null) ? 'gemessen' : 'Erwartungswert der Neigungsklasse',
      beta:   _neigGemessen != null ? 'gemessen' : 'Klassenobergrenze',
      boden:  bgModus, bodenProfil: profil.name || '', bodenSchichten: nSchicht,
      bodenAuslegung: bgAuslegungModus(profil),
    }
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
      '<div id="bc-ov-warn" style="display:none;padding:7px 12px;border-bottom:1px solid #fde68a;' +
           'background:#fffbeb;max-height:120px;overflow-y:auto"></div>' +
      '<iframe id="bc-frame" title="BlockCalc" style="border:0;flex:1;width:100%"></iframe>' +
    '</div>';
  document.body.appendChild(ov);
  return ov;
}
function bcSchliessen() {
  const ov = document.getElementById('bc-overlay');
  if (ov) { ov.style.display = 'none'; const f = document.getElementById('bc-frame'); if (f) f.src = 'about:blank'; }
  _bcReady = false; _bcPending = null; _bcPairId = null; _bcUebernahme = [];
}

// Was BlockCalc beim Einlesen beanstandet hat — im Kopf der Überlagerung,
// solange noch etwas daran zu ändern ist.
function bcUebernahmeZeigen(liste) {
  const box = document.getElementById('bc-ov-warn');
  if (!box) return;
  if (!liste.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
  const abw = liste.filter(bcIstAbweichung).length;
  box.style.display = '';
  box.innerHTML =
    '<div style="font-size:11px;font-weight:600;color:#92400e;margin-bottom:3px">' +
      (abw ? 'BlockCalc hat ' + abw + ' Wert' + (abw > 1 ? 'e' : '') + ' anders angesetzt als übergeben'
           : 'Hinweise zur Übernahme') + '</div>' +
    '<ul style="margin:0;padding-left:16px;font-size:11px;line-height:1.55">' +
      liste.map(t => '<li style="color:' + (bcIstAbweichung(t) ? '#92400e' : '#78716c') + '">' +
                     _bcText(t) + '</li>').join('') +
    '</ul>';
}

// BlockCalcs Texte sind fremde Zeichenketten und gehen in innerHTML — sie
// werden entschärft, nicht vertraut.
function _bcText(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


// ── Übergabe-Vorschau ────────────────────────────────────────────────────────
// Vor dem Start zeigen, was hinübergeht. Zwei Gründe:
//
//   1. Der Baugrund ist eine ECHTE Wahl geworden. Ein Profil mit erfasstem
//      Schichtaufbau kann als Schichtenfolge hinübergehen oder als der eine
//      ausgelegte Satz, mit dem die Liste arbeitet. Beides ist richtig, je
//      nachdem was nachgewiesen wird — also fragt die App, statt zu raten.
//
//   2. Die Hinweise waren bisher unsichtbar. bcNachweisOeffnen() schrieb ihre
//      ANZAHL in die Kopfzeile des Overlays; was drinstand, sah niemand. Dass
//      der Überstand geschätzt, der Referenztyp leer oder die Geometrie aus
//      dem Typenprofil statt aus einer Rechnung stammt, gehört vor den Start,
//      nicht dahinter.
//
// Die Wahl bleibt an der Position stehen (bp.bcBaugrundModus) — beim zweiten
// Lauf steht sie schon richtig da.
let _bcVorschauPairId = null;

function bcVorschau() {
  let ov = document.getElementById('bc-vorschau');
  if (ov) return ov;
  ov = document.createElement('div');
  ov.id = 'bc-vorschau';
  ov.className = 'modal-overlay';
  ov.style.display = 'none';
  ov.onclick = ev => { if (ev.target === ov) bcVorschauSchliessen(); };
  ov.innerHTML =
    '<div class="modal" style="width:600px;max-height:88vh;overflow-y:auto;">' +
      '<h2 id="bc-vs-titel">Übergabe an BlockCalc</h2>' +
      '<div id="bc-vs-inhalt"></div>' +
      '<div class="modal-actions">' +
        '<button class="modal-btn cancel" onclick="bcVorschauSchliessen()">Abbrechen</button>' +
        '<button class="modal-btn primary" onclick="bcVorschauStarten()">In BlockCalc öffnen</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(ov);
  return ov;
}

function bcVorschauSchliessen() {
  const ov = document.getElementById('bc-vorschau');
  if (ov) ov.style.display = 'none';
  _bcVorschauPairId = null;
}

function bcVorschauStarten() {
  const id = _bcVorschauPairId;
  bcVorschauSchliessen();
  if (id) bcStarten(id);
}

// Baugrundwahl umstellen und die Vorschau neu aufbauen — die Kennwerte
// darunter ändern sich mit, sonst zeigt die Tabelle die alte Wahl.
function bcVorschauBoden(modus) {
  if (!_bcVorschauPairId) return;
  const all = loadAllBauprojekt();
  all[_bcVorschauPairId] = { ...(all[_bcVorschauPairId] || {}), bcBaugrundModus: modus };
  saveAllBauprojekt(all);
  bcNachweisOeffnen(_bcVorschauPairId);
}

// Wertzeile: Grösse, Wert, Herkunft. Ein fehlender Wert wird als «—» gezeigt
// und nicht verschwiegen — leer heisst hier «BlockCalc setzt seine Vorgabe».
function _bcZeile(label, wert, herkunft) {
  const leer = wert == null || wert === '' || wert === '—';
  return '<div style="display:grid;grid-template-columns:150px 1fr auto;gap:8px;align-items:baseline;' +
              'padding:3px 0;border-bottom:1px solid #f3f4f6;">' +
    '<span style="font-size:11px;color:#9ca3af;">' + label + '</span>' +
    '<span style="font-size:12px;color:' + (leer ? '#9ca3af' : '#374151') + ';font-weight:500;">' +
      (leer ? '—' : wert) + '</span>' +
    // Ohne Wert keine Herkunft — «Kopf B x L: — / Typenprofil» behauptete,
    // das Profil habe etwas geliefert, obwohl das Feld dort leer ist.
    '<span style="font-size:10px;color:#9ca3af;white-space:nowrap;">' + (leer ? '' : (herkunft || '')) + '</span>' +
  '</div>';
}

function _bcAbschnitt(titel, inhalt) {
  return '<div style="margin-bottom:12px;">' +
    '<div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;' +
         'letter-spacing:0.04em;margin-bottom:3px;">' + titel + '</div>' + inhalt + '</div>';
}

function bcVorschauFuellen(fall, pairId) {
  const h = fall._herkunft, g = fall.geometrie, b = fall.baugrund;
  const bp = loadAllBauprojekt()[pairId] || {};
  const m  = v => v == null ? '' : (Math.round(v * 100) / 100).toFixed(2) + ' m';

  // ── Baugrund: die Wahl, dann was sie liefert
  const hatAufbau = h.bodenSchichten > 0;
  const wahlKnopf = (wert, titel, unter, aktiv) =>
    '<label style="display:flex;gap:7px;align-items:flex-start;padding:6px 8px;border:1px solid ' +
        (aktiv ? '#1a3a5c' : '#e5e7eb') + ';border-radius:7px;cursor:pointer;flex:1;' +
        'background:' + (aktiv ? '#f8fafc' : 'white') + ';">' +
      '<input type="radio" name="bc-vs-boden" value="' + wert + '"' + (aktiv ? ' checked' : '') +
        ' onchange="bcVorschauBoden(\'' + wert + '\')" style="accent-color:#1a3a5c;margin-top:1px;">' +
      '<span><span style="font-size:12px;font-weight:600;color:#374151;display:block;">' + titel + '</span>' +
      '<span style="font-size:10px;color:#9ca3af;">' + unter + '</span></span></label>';

  const auslKurz = BG_AUSLEGUNG[h.bodenAuslegung]?.kurz || 'Manuell';
  const wahl = hatAufbau
    ? '<div style="display:flex;gap:7px;margin-bottom:7px;">' +
        wahlKnopf('schichten', 'Einzelschichten',
                  h.bodenSchichten + ' Schichten wie erfasst', h.boden === 'schichten') +
        wahlKnopf('auslegung', 'Interpretierte Werte',
                  auslKurz + '-Auslegung als eine Schicht', h.boden === 'auslegung') +
      '</div>'
    : '<div style="font-size:11px;color:#9ca3af;margin-bottom:6px;">Für dieses Profil ist kein ' +
      'Schichtaufbau erfasst — der Baugrund geht als eine durchgehende Schicht hinüber.</div>';

  const kopfS = 'font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;padding:0 5px 2px;text-align:right;';
  const zellS = 'font-size:11px;color:#374151;padding:3px 5px;text-align:right;border-top:1px solid #f3f4f6;';
  const tabelle =
    '<table style="width:100%;border-collapse:collapse;">' +
      '<tr><th style="' + kopfS + 'text-align:left;">Schicht</th>' +
          '<th style="' + kopfS + '">bis [m]</th><th style="' + kopfS + '">M<sub>E</sub></th>' +
          '<th style="' + kopfS + '">φ&prime;</th><th style="' + kopfS + '">γ</th>' +
          '<th style="' + kopfS + '">γ&prime;</th><th style="' + kopfS + '">c&prime;</th></tr>' +
      b.schichten.map((s, i, arr) => {
        let z = 0; for (let j = 0; j < i; j++) z += arr[j].d === 999 ? 0 : arr[j].d;
        const bis = (i === arr.length - 1 || s.d === 999) ? '∞' : (z + s.d).toFixed(1);
        return '<tr><td style="' + zellS + 'text-align:left;font-weight:600;">' + (s.name || '—') + '</td>' +
          '<td style="' + zellS + '">' + bis + '</td><td style="' + zellS + '">' + s.me + '</td>' +
          '<td style="' + zellS + '">' + s.phi + '</td><td style="' + zellS + '">' + s.gamma + '</td>' +
          '<td style="' + zellS + '">' + s.gamma2 + '</td><td style="' + zellS + '">' + s.c + '</td></tr>';
      }).join('') +
    '</table>';

  const gwText = b.gw ? ('angetroffen' + (b.gwTiefe != null ? ' bei ' + b.gwTiefe + ' m' : ', ohne Tiefe')) : 'nicht angesetzt';

  // ── Lasten
  const l = fall.lasten;
  const lastText = l.werte
    ? l.typ + ' · N_G ' + l.werte.NG + ' kN, H_Gx ' + l.werte.HGx + ' kN, M_Gx ' + l.werte.MGx + ' kNm'
    : (l.typ ? l.typ + ' — Werte sucht BlockCalc in seiner Tabelle' : '');

  document.getElementById('bc-vs-inhalt').innerHTML =
    '<div style="font-size:11px;color:#6b7280;margin:-6px 0 12px;">' +
      fall.meta.fundament + ' · ' + (fall.modell === 'pfahlbock' ? 'Pfahlfundament' : 'Blockfundament') +
      (h.bodenProfil ? ' · Baugrundprofil ' + h.bodenProfil : '') + '</div>' +

    _bcAbschnitt('Baugrund', wahl + tabelle +
      _bcZeile('Grundwasser', gwText, '') +
      _bcZeile('Geländeneigung', (b.neigung.beta || 0).toFixed(1) + '°', h.beta)) +

    _bcAbschnitt('Geometrie',
      _bcZeile('Abmessung B × L', g.B != null ? m(g.B) + ' × ' + m(g.L) : '', h.masse) +
      _bcZeile('Blocktiefe', m(g.H_Block), h.tiefe) +
      _bcZeile('Kopf B × L', g.B_Kopf != null ? m(g.B_Kopf) + ' × ' + m(g.L_Kopf) : '', 'Typenprofil') +
      _bcZeile('Kopfhöhe (ab OK Block)', m(g.kopfHoehe), 'Typenprofil') +
      _bcZeile('Überstand über Terrain', m(g.ueberstand), h.hoehe) +
      (fall.modell === 'pfahlbock'
        ? _bcZeile('Pfähle', (g.pfahlAnzahl || '—') + ' Stk. à ' + (g.pfahlLaenge != null ? m(g.pfahlLaenge) : '—') +
                             ' ab UK Block', h.pfahl)
        : '')) +

    _bcAbschnitt('Lasten', _bcZeile('Referenztyp', lastText, l.vFall === 'max' ? 'V = 150 kN' : 'V = 0 kN') +
      (l.torsion ? _bcZeile('Torsion T', l.torsion + ' kNm', 'BlockCalc rechnet T nicht') : '')) +

    (fall._hinweise.length
      ? _bcAbschnitt('Hinweise',
          '<ul style="margin:0;padding-left:16px;font-size:11px;color:#b45309;line-height:1.6;">' +
          fall._hinweise.map(t => '<li>' + t + '</li>').join('') + '</ul>')
      : '');
}

// ── Öffnen ───────────────────────────────────────────────────────────────────
// Erst die Vorschau, dann die Rechnung. Der Knopf in der Sidebar ruft
// weiterhin diese Funktion — was sich ändert, ist der Zwischenschritt.
function bcNachweisOeffnen(pairId) {
  pairId = pairId || (typeof currentPairId !== 'undefined' ? currentPairId : null);
  if (!pairId) return;
  const fall = bcFallBauen(pairId);
  if (!fall) {
    const g = bcRechenbar(pairId).grund || 'nicht rechenbar';
    ui.toast('BlockCalc: ' + g, 'fehler');
    return;
  }
  _bcVorschauPairId = pairId;
  const ov = bcVorschau();
  document.getElementById('bc-vs-titel').textContent = 'Übergabe an BlockCalc';
  bcVorschauFuellen(fall, pairId);
  ov.style.display = 'flex';
}

function bcStarten(pairId) {
  const fall = bcFallBauen(pairId);
  if (!fall) return;
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
  else if (d.type === 'blockcalc:loaded') {
    // ACHTUNG, die beiden Meldungen sind NICHT gleich gebaut. BlockCalcs
    // _embedSend() legt seine Daten mit Object.assign auf die oberste Ebene,
    // und nur das Ergebnis reicht zusätzlich ein eigenes payload durch:
    //
    //   blockcalc:result   { v, type, id, payload:{ … } }    verschachtelt
    //   blockcalc:loaded   { v, type, id, hinweise:[ … ] }   flach
    //
    // Wer hier wie beim Ergebnis nach d.payload greift, bekommt undefined,
    // vergleicht undefined mit der id und verwirft die Meldung stumm — genau
    // das ist beim ersten Versuch passiert und fiel nur auf, weil eine Sonde
    // am Fenster hing. Gelesen werden darum beide Formen; flach ist die heutige.
    const p = d.payload || d;
    // Nur die Meldung zum laufenden Fall — eine fremde id gehört nicht hierher.
    if (String(p.id) === String(_bcPairId)) {
      _bcUebernahme = Array.isArray(p.hinweise) ? p.hinweise : [];
      bcUebernahmeZeigen(_bcUebernahme);
    }
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
    // BlockCalc legt seine Übernahmehinweise dem Ergebnis ohnehin bei;
    // _bcUebernahme ist der Rückfall, falls eine ältere Fassung das nicht tut.
    erfuellt: !!r.nachweise?.erfuellt,
    hinweise: (r.hinweise && r.hinweise.length) ? r.hinweise : _bcUebernahme
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
      // Die Hinweise der Übernahme wurden schon immer mitgespeichert, aber nie
      // gezeigt. Ein Nachweis, der mit abweichender Pfahlzahl oder mit
      // Standardlasten gerechnet wurde, sah bisher aus wie jeder andere.
      ((bc.hinweise && bc.hinweise.length)
        ? '<ul style="margin:4px 0 0;padding-left:14px;font-size:10px;line-height:1.5">' +
          bc.hinweise.map(t => '<li style="color:' + (bcIstAbweichung(t) ? '#b45309' : '#9ca3af') + '">' +
                               _bcText(t) + '</li>').join('') + '</ul>'
        : '') +
    '</div>';
  _bcBereichEinziehen();
}
