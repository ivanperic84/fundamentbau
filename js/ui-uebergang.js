// ============================================================
// UEBERGAENGE — bewegte Ansichtswechsel an einer Stelle.
//
// Die App wechselt Ansichten, indem sie Kaesten auf display:none und wieder
// auf display:block setzt. Das ist ein harter Schnitt: die angetippte Kachel
// verschwindet, und anderswo erscheint eine Seite. Der Zusammenhang zwischen
// beidem geht dabei verloren — gerade auf dem Tablet im Feld, wo man mit dem
// Finger auf die Kachel zeigt und dann etwas anderes sieht.
//
// Die View Transitions API stellt ihn her: tragen zwei Elemente vor und nach
// dem Wechsel denselben view-transition-name, waechst das eine ins andere.
// Das Muster heisst Container Transform und ist dasselbe, das Android und iOS
// beim Oeffnen einer Kachel zeigen.
//
// Kann der Browser es nicht, laeuft der Wechsel unveraendert sofort ab. Es
// gibt keinen zweiten Pfad, der gepflegt werden muesste, und keine Abfrage
// beim Aufrufer — der merkt keinen Unterschied.
// ============================================================

// Aendert sich zur Laufzeit nicht, deshalb einmal ermittelt.
const UEBERGANG_KANN = typeof document.startViewTransition === 'function';

// Wer im Betriebssystem weniger Bewegung eingestellt hat, bekommt keine.
// Dieselbe Einstellung setzt in css/marken.css die Bewegungsmarken auf 0ms.
const _wenigerBewegung = window.matchMedia('(prefers-reduced-motion: reduce)');

// Der Name des Paares, das ineinander uebergeht. Es ist immer nur eines
// unterwegs, und der Name muss im Dokument eindeutig sein.
const UEBERGANG_PAAR = 'kachel-detail';

let _uebergangLaeuft = false;

// ansichtEinblenden() haelt sich waehrenddessen zurueck — sonst laufen das
// Einblenden des Kastens und der Uebergang uebereinander.
function uebergangLaeuft() { return _uebergangLaeuft; }

function _kachelVon(pairId) {
  return document.querySelector('.card[data-pair-id="' + pairId + '"]');
}

// Fuehrt wechsel() aus. Sind Ausgangspunkt und Ziel vorhanden und kann der
// Browser einen Uebergang, wachsen sie ineinander; sonst schaltet es wie
// bisher sofort um. Das Ziel wird als Funktion uebergeben, weil es den
// Rueckweg erst gibt, nachdem der Wechsel die Uebersicht neu aufgebaut hat.
function _uebergang(vorher, zielSuchen, wechsel) {
  if (!UEBERGANG_KANN || _wenigerBewegung.matches || !vorher) { wechsel(); return; }

  // view-transition-name steht nur waehrend des Uebergangs am Element und
  // wird danach wieder entfernt: er muss im Dokument eindeutig sein. Das ist
  // eine Angabe zur Bewegung, keine zum Aussehen — deshalb hier und nicht
  // in css/bausteine.css.
  const gesetzt = [vorher];
  vorher.style.viewTransitionName = UEBERGANG_PAAR;
  _uebergangLaeuft = true;

  const vt = document.startViewTransition(() => {
    wechsel();
    const ziel = zielSuchen();
    if (ziel) { ziel.style.viewTransitionName = UEBERGANG_PAAR; gesetzt.push(ziel); }
  });

  // ready lehnt ab, sobald der Uebergang abgebrochen wird — etwa weil schon der
  // naechste startet, wenn jemand zuegig durch die Standorte blaettert. Das ist
  // kein Fehler; ohne Behandlung meldet der Browser aber eine unbehandelte
  // Ablehnung in der Konsole. finished raeumt in beiden Faellen auf.
  vt.ready.catch(() => {});

  const aufraeumen = () => {
    _uebergangLaeuft = false;
    gesetzt.forEach(el => { el.style.viewTransitionName = ''; });
  };
  vt.finished.then(aufraeumen, aufraeumen);
}

// Kachel waechst in die Detailansicht.
function uebergangZuDetail(pairId, wechsel) {
  _uebergang(_kachelVon(pairId), () => document.getElementById('detail-view'), wechsel);
}

// Und zurueck: die Detailansicht schrumpft in ihre Kachel. Nur wenn gleich
// auch wirklich Kacheln erscheinen — in Liste, Karte oder Bauprogramm gibt es
// keine Kachel, in die sie zurueckkoennte, und ein Uebergang ohne Gegenstueck
// waere nur ein Wischen ueber die ganze Seite. Welche Uebersicht kommt, weiss
// nur der Aufrufer, deshalb sagt er es.
function uebergangZuUebersicht(pairId, zielAnsicht, wechsel) {
  if (zielAnsicht !== 'karten') { wechsel(); return; }
  _uebergang(document.getElementById('detail-view'), () => _kachelVon(pairId), wechsel);
}
