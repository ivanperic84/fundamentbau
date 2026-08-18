#!/usr/bin/env node
/* ============================================================
   STATISCHE PRUEFUNG DER APP — ohne Abhaengigkeiten, ohne Build.

   Aufruf aus dem Projektverzeichnis:
       node werkzeuge/pruefen.js
       node werkzeuge/pruefen.js --nur=ids,tags
       node werkzeuge/pruefen.js --leise      (nur Fehler, kein OK-Protokoll)

   Rueckgabewert: 0 = alles sauber, 1 = mindestens ein Fehler.

   Geprueft werden ausschliesslich Fehlerklassen, die im Markup unsichtbar
   sind und im Betrieb still Daten verlieren oder Funktionen lahmlegen —
   jede einzelne ist in der Praxis dieses Projekts schon aufgetreten:

     ids       Doppelte id-Attribute. getElementById trifft nur das erste
               Element; das zweite ist in beide Richtungen tot (Eingaben
               werden verworfen, Werte nie angezeigt, Rücksetzen greift
               nicht). War 2,5 Monate in ft-prof-schraub-laenge aktiv.
     tags      Unausgeglichene div/button/svg-Paare. Zeigt abgebrochene
               oder doppelt eingefuegte Bloecke nach Skript-Umbauten.
     attribute Zweimal class= oder style= im selben Tag. Der Browser nimmt
               das erste, alles Weitere verschwindet lautlos.
     css       Mehrfach definierte Utility-Klassen in css/*.css. Die
               spaetere Definition gewinnt und ueberschreibt die Marken — so
               geschehen bei .modal-close (16px statt 20px) und .modal-input.
               Seit der Aufteilung ueber alle Dateien hinweg gezaehlt.
     stil      Gestaltungsdateien unter css/ sind in index.html verlinkt, in
               sw.js gecacht und in der Reihenfolge marken → bausteine →
               ansichten eingebunden. Diese Reihenfolge ist die Kaskade.
     handler   onclick/onchange verweist auf eine Funktion, die es nirgends
               gibt. Faellt erst beim Klick auf, dann als ReferenceError.
     module    Die Modulliste in sw.js weicht von js/ ab. Folge: der
               Service Worker legt Dateien ab, die es nicht gibt, oder
               laesst neue Module ungecacht.
     version   version.js als einzige Versionsquelle vorhanden und von
               index.html sowie sw.js gelesen.
   ============================================================ */

'use strict';
const fs   = require('fs');
const path = require('path');

const WURZEL = path.resolve(__dirname, '..');
const P = (...t) => path.join(WURZEL, ...t);
const lies = p => fs.readFileSync(p, 'utf8');

const args  = process.argv.slice(2);
const leise = args.includes('--leise');
const nurArg = args.find(a => a.startsWith('--nur='));
const nur   = nurArg ? nurArg.slice(6).split(',').map(s => s.trim()) : null;
const aktiv = name => !nur || nur.includes(name);

let fehlerZahl = 0, warnZahl = 0;
const fehler = (bereich, text) => { fehlerZahl++; console.log('FEHLER  [' + bereich + '] ' + text); };
const warnung = (bereich, text) => { warnZahl++; console.log('HINWEIS [' + bereich + '] ' + text); };
const ok = (bereich, text) => { if (!leise) console.log('ok      [' + bereich + '] ' + text); };

const html = lies(P('index.html'));
const zeileVon = idx => html.slice(0, idx).split('\n').length;

// Alle Zeichen ausserhalb von <script>-Bloecken — fuer Markup-Pruefungen,
// damit JS-Zeichenketten wie '<div>' nicht mitgezaehlt werden.
const ohneSkripte = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, m => ' '.repeat(m.length));
const skriptQuellen = () => fs.readdirSync(P('js')).filter(f => f.endsWith('.js')).map(f => ['js/' + f, lies(P('js', f))]);
const stilQuellen   = () => fs.readdirSync(P('css')).filter(f => f.endsWith('.css')).map(f => ['css/' + f, lies(P('css', f))]);

/* ── ids ──────────────────────────────────────────────────── */
if (aktiv('ids')) {
  const gesehen = new Map();
  for (const m of ohneSkripte.matchAll(/\sid="([^"]+)"/g)) {
    const id = m[1];
    if (!gesehen.has(id)) gesehen.set(id, []);
    gesehen.get(id).push(zeileVon(m.index));
  }
  const doppelt = [...gesehen].filter(([, z]) => z.length > 1);
  if (doppelt.length) {
    for (const [id, zeilen] of doppelt) {
      fehler('ids', 'id="' + id + '" ' + zeilen.length + '× vergeben — Zeilen ' + zeilen.join(', ')
        + '. getElementById trifft nur Zeile ' + zeilen[0] + '.');
    }
  } else {
    ok('ids', gesehen.size + ' ids, alle eindeutig');
  }
}

/* ── tags ─────────────────────────────────────────────────── */
if (aktiv('tags')) {
  let sauber = true;
  for (const tag of ['div', 'button', 'svg', 'select', 'textarea']) {
    const auf = (ohneSkripte.match(new RegExp('<' + tag + '\\b', 'g')) || []).length;
    const zu  = (ohneSkripte.match(new RegExp('</' + tag + '>', 'g')) || []).length;
    if (auf !== zu) { fehler('tags', '<' + tag + '> ' + auf + '× geöffnet, ' + zu + '× geschlossen'); sauber = false; }
  }
  if (sauber) ok('tags', 'div/button/svg/select/textarea paarweise ausgeglichen');
}

/* ── attribute ────────────────────────────────────────────── */
if (aktiv('attribute')) {
  let treffer = 0;
  for (const m of ohneSkripte.matchAll(/<[a-zA-Z][^>]*>/g)) {
    for (const attr of ['class', 'style', 'id', 'onclick']) {
      const n = (m[0].match(new RegExp('\\s' + attr + '\\s*=', 'g')) || []).length;
      if (n > 1) { fehler('attribute', 'Zeile ' + zeileVon(m.index) + ': ' + attr + ' ' + n + '× im selben Tag — '
        + m[0].slice(0, 90).replace(/\s+/g, ' ')); treffer++; }
    }
  }
  if (!treffer) ok('attribute', 'kein Tag mit doppeltem class/style/id/onclick');
}

/* ── css ──────────────────────────────────────── */
if (aktiv('css')) {
  // Nur Utility-Klassen: einfache Klassenselektoren ohne Kombinator.
  // Regeln innerhalb von @media/@supports sind bewusste Ueberschreibungen und
  // zaehlen nicht als Doppeldefinition - sonst meldet die Pruefung jede
  // Anpassung fuer kleine Bildschirme als Fehler.
  const atBereiche = text => {
    const bereiche = [];
    for (const m of text.matchAll(/@(?:media|supports)\b[^{]*\{/g)) {
      let i = m.index + m[0].length, tiefe = 1;
      while (i < text.length && tiefe > 0) {
        if (text[i] === '{') tiefe++;
        else if (text[i] === '}') tiefe--;
        i++;
      }
      bereiche.push([m.index, i]);
    }
    return idx => bereiche.some(([a, b]) => idx >= a && idx < b);
  };

  // Ueber alle Dateien hinweg gezaehlt. Seit der Aufteilung ist die zweite
  // Fassung einer Klasse leichter zu uebersehen als vorher im einen Block -
  // sie gewinnt aber genauso lautlos.
  const zaehler = new Map();
  for (const [datei, css] of stilQuellen()) {
    const inAtBlock = atBereiche(css);
    const zeileIn = idx => css.slice(0, idx).split('\n').length;
    for (const m of css.matchAll(/(^|[\n{}])\s*(\.[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*)\s*\{/gi)) {
      if (inAtBlock(m.index)) continue;
      const sel = m[2];
      if (!zaehler.has(sel)) zaehler.set(sel, []);
      // + m[1].length: der Treffer beginnt am vorangehenden Umbruch bzw. Klammerzeichen
      zaehler.get(sel).push(datei + ':' + zeileIn(m.index + m[1].length));
    }
  }
  const doppelt = [...zaehler].filter(([, z]) => z.length > 1);
  if (doppelt.length) {
    // Bewusst ein Fehler, kein Hinweis: die spaetere Definition gewinnt lautlos.
    // So ueberschrieb eine alte .modal-close-Regel die Marken-Fassung (16px
    // statt 20px), und .modal-input haette die Felddefinition gekippt.
    for (const [sel, stellen] of doppelt) {
      fehler('css', sel + ' ' + stellen.length + '× definiert — ' + stellen.join(', ')
        + '. Die spätere Definition gewinnt; zusammenführen.');
    }
  } else {
    ok('css', zaehler.size + ' einfache Klassenselektoren, keiner doppelt');
  }
}

/* ── stil ─────────────────────────────────────── */
if (aktiv('stil')) {
  const vorhanden = fs.readdirSync(P('css')).filter(f => f.endsWith('.css')).map(f => 'css/' + f);
  const sw     = lies(P('sw.js'));
  const imSw   = [...sw.matchAll(/'(css\/[^']+)'/g)].map(m => m[1]);
  const imHtml = [...html.matchAll(/<link[^>]+href="(css\/[^"]+)"/g)].map(m => m[1]);
  let sauber = true;

  for (const d of vorhanden) {
    if (!imHtml.includes(d)) {
      fehler('stil', d + ' ist in index.html nicht verlinkt — die Regeln greifen nirgends'); sauber = false;
    }
    if (!imSw.includes(d)) {
      fehler('stil', d + ' fehlt in der STATISCH-Liste von sw.js — offline ohne Gestaltung'); sauber = false;
    }
  }
  for (const d of imHtml) {
    if (!vorhanden.includes(d)) {
      fehler('stil', 'index.html verlinkt ' + d + ' — Datei existiert nicht'); sauber = false;
    }
  }

  // Die Reihenfolge der Verweise IST die Kaskade: Marken muessen gesetzt sein,
  // bevor ein Baustein sie ausliest, und eine Ansicht muss den Baustein
  // ueberschreiben koennen, nicht umgekehrt. Deshalb steht sie hier fest.
  // Kommt eine vierte Datei dazu, gehoert sie in diese Liste.
  const soll = ['css/marken.css', 'css/bausteine.css', 'css/ansichten.css'];
  const ist  = imHtml.filter(d => soll.includes(d));
  if (JSON.stringify(ist) !== JSON.stringify(soll)) {
    fehler('stil', 'Reihenfolge in index.html ist ' + (ist.join(' → ') || '(leer)')
      + ', erwartet ' + soll.join(' → ')); sauber = false;
  }
  const unbekannt = vorhanden.filter(d => !soll.includes(d));
  unbekannt.forEach(d => warnung('stil', d + ' steht in keiner Reihenfolgeangabe von pruefen.js — Kaskade ungeprueft'));

  if (sauber) ok('stil', vorhanden.length + ' Gestaltungsdateien, in index.html und sw.js vollständig und in richtiger Folge');
}

/* ── handler ──────────────────────────────────────────────── */
if (aktiv('handler')) {
  const quellen = skriptQuellen();
  const inlineSkripte = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n');
  const allesJs = quellen.map(([, s]) => s).join('\n') + '\n' + inlineSkripte;

  const bekannt = new Set([
    // Browser- und Sprachbausteine
    'alert','confirm','prompt','parseInt','parseFloat','isNaN','String','Number',
    'Boolean','Array','Object','JSON','Math','Date','setTimeout','clearTimeout','setInterval','encodeURIComponent',
    'decodeURIComponent','event','require','fetch','open','print','close','focus','blur','postMessage',
    // Schluesselwoerter — stehen im Handler-Text vor einer Klammer, sind aber keine Aufrufe
    'if','for','while','switch','return','typeof','new','catch','do','else','delete','await','void','in','of',
    // CSS-Funktionen, die in Handlern vorkommen (this.style.background='rgba(...)')
    'rgba','rgb','hsl','hsla','url','calc','var','translate','translateY','translateX','scale','rotate',
  ]);
  for (const m of allesJs.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) bekannt.add(m[1]);
  // Bewusst jede Zuweisung, nicht nur = function/= ( : im Bestand entstehen
  // Handler-Funktionen auch als `const x = debounce(...)`.
  for (const m of allesJs.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) bekannt.add(m[1]);
  for (const m of allesJs.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)) bekannt.add(m[1]);

  const fehlende = new Map();
  for (const m of ohneSkripte.matchAll(/\son(?:click|change|input|submit|keydown|keyup|blur|focus|mouseover|mouseout)\s*=\s*"([^"]*)"/g)) {
    for (const auf of m[1].matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)) {
      const name = auf[1];
      if (bekannt.has(name)) continue;
      // Methodenaufrufe (obj.fn(), this.fn()) ueberspringen
      const davor = m[1].slice(Math.max(0, auf.index - 1), auf.index);
      if (davor === '.') continue;
      if (!fehlende.has(name)) fehlende.set(name, zeileVon(m.index));
    }
  }
  if (fehlende.size) {
    for (const [name, zeile] of fehlende) fehler('handler', name + '() aus einem Inline-Handler (Zeile ' + zeile + ') ist nirgends definiert');
  } else {
    ok('handler', 'alle Funktionen aus Inline-Handlern sind definiert');
  }
}

/* ── module ───────────────────────────────────────────────── */
if (aktiv('module')) {
  const sw = lies(P('sw.js'));
  const block = /APP_MODULE\s*=\s*\[([\s\S]*?)\]/.exec(sw);
  if (!block) {
    fehler('module', 'APP_MODULE in sw.js nicht gefunden');
  } else {
    const gelistet = [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
    const vorhanden = fs.readdirSync(P('js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f);
    const fehlt   = gelistet.filter(m => !vorhanden.includes(m));
    const zuviel  = vorhanden.filter(m => !gelistet.includes(m));
    fehlt.forEach(m => fehler('module', 'sw.js listet ' + m + ' — Datei existiert nicht'));
    zuviel.forEach(m => fehler('module', m + ' fehlt in der APP_MODULE-Liste von sw.js (wird nicht gecacht)'));

    // Reihenfolge: start.js muss zuletzt geladen werden (Top-Level-Code sieht nur frühere Module)
    if (gelistet.length && gelistet[gelistet.length - 1] !== 'js/start.js')
      fehler('module', 'js/start.js ist nicht der letzte Eintrag in APP_MODULE — Startlogik läuft zu früh');

    // index.html muss dieselben Module in derselben Reihenfolge einbinden
    const imHtml = [...html.matchAll(/<script\s+src="(js\/[^"?]+)/g)].map(m => m[1]);
    if (imHtml.length && JSON.stringify(imHtml) !== JSON.stringify(gelistet))
      fehler('module', 'Modulreihenfolge in index.html weicht von sw.js ab (' + imHtml.length + ' gegen ' + gelistet.length + ' Einträge)');

    if (!fehlt.length && !zuviel.length) ok('module', gelistet.length + ' Module, sw.js und js/ stimmen überein');
  }
}

/* ── version ──────────────────────────────────────────────── */
if (aktiv('version')) {
  const v = lies(P('version.js'));
  const treffer = /APP_VERSION\s*=\s*'([^']+)'/.exec(v);
  if (!treffer) fehler('version', 'APP_VERSION in version.js nicht gefunden');
  else {
    if (!/<script\s+src="version\.js"/.test(html)) fehler('version', 'index.html lädt version.js nicht');
    if (!/importScripts\(\s*'version\.js'\s*\)/.test(lies(P('sw.js')))) fehler('version', 'sw.js liest version.js nicht via importScripts');
    if (/CACHE_VERSION\s*=\s*'/.test(lies(P('sw.js')))) fehler('version', 'sw.js definiert eine eigene CACHE_VERSION — es darf nur eine Versionsquelle geben');
    if (!fehlerZahl) ok('version', 'einzige Versionsquelle: ' + treffer[1]);
  }
}

/* ── Abschluss ────────────────────────────────────────────── */
console.log('');
if (fehlerZahl) console.log('=> ' + fehlerZahl + ' Fehler' + (warnZahl ? ', ' + warnZahl + ' Hinweis(e)' : ''));
else if (warnZahl) console.log('=> keine Fehler, ' + warnZahl + ' Hinweis(e)');
else console.log('=> alles sauber');
process.exit(fehlerZahl ? 1 : 0);
