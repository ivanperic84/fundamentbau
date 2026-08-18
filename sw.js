// ============================================================
// SERVICE WORKER — Offline-Cache für die Fundamentbau-App.
//
// Strategie: Stale-While-Revalidate für same-origin-Ressourcen.
//   → App startet sofort aus dem Cache (auch offline),
//   → im Hintergrund wird die neue Version geholt,
//   → der Client wird per postMessage informiert, wenn sich
//     index.html geändert hat (Update-Hinweis in der App).
// Fremd-Domains (Kartenkacheln, geoadmin, SBB-API) werden NICHT
// gecacht — immer Netz.
//
// VERSIONIERUNG — bitte beim Ändern lesen:
//   Die Version steht ausschliesslich in version.js und wird hier via
//   importScripts() gelesen. Frueher gab es zwei Konstanten (APP_VERSION
//   in index.html, CACHE_VERSION hier); liefen sie auseinander, passten
//   Cache-Name und Modul-Adressen nicht mehr zusammen.
//
//   Ausserdem wurde hier fruener mit `ignoreSearch: true` gematcht. Dadurch
//   beantwortete ein alter Cache-Eintrag 'js/kern.js' auch die Anfrage
//   'js/kern.js?v=v25' — der Versions-Parameter war wirkungslos und Geraete
//   liefen beliebig lange auf altem Code. Jetzt wird exakt gematcht: die
//   Module stehen mit ihrer Version im App-Shell.
//
//   Der Precache holt bewusst mit `cache: 'reload'`, sonst uebernimmt er
//   eine veraltete Kopie aus dem HTTP-Cache des Browsers.
// ============================================================
importScripts('version.js');   // liefert APP_VERSION

const CACHE_VERSION = APP_VERSION;
const CACHE_NAME    = 'sondagen-' + CACHE_VERSION;

// App-Module — Liste muss mit APP_MODULE in index.html uebereinstimmen.
// Sie werden von der Seite als 'js/xy.js?v=<Version>' angefordert, also
// muessen sie unter genau diesem Schluessel im Cache liegen.
const APP_MODULE = [
  'js/ui-uebergang.js',          // Bewegte Ansichtswechsel (View Transitions)
  'js/kern.js',
  'js/fundament-mengen.js',
  'js/uebersicht.js',
  'js/detail-sidebar.js',
  'js/karte-skizze.js',
  'js/ansichten.js',
  'js/import-export.js',
  'js/projekt-einstellungen.js',
  'js/fotos-bericht.js',
  'js/modals.js',
  'js/init-phasen.js',
  'js/begehung-ausfuehrung.js',
  'js/bibliotheken.js',
  'js/bauprogramm.js',
  'js/fundamenttypen.js',
  'js/termine-planung.js',
  'js/listen-bsp.js',
  'js/bahn.js',
  'js/massen-kosten.js',
  'js/blockcalc-bridge.js',
  'js/start.js',
];

// Ressourcen ohne Versions-Parameter (so fordert die Seite sie an)
const STATISCH = [
  './',
  'index.html',
  'manual.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-512-maskable.png',
  // Gestaltung — Reihenfolge wie in index.html: marken, bausteine, ansichten.
  'css/marken.css',
  'css/bausteine.css',
  'css/ansichten.css',
  'lib/leaflet.css',
  'lib/leaflet.js',
  'lib/leaflet-rotate.js',
  'lib/xlsx.full.min.js',
  'lib/jspdf.umd.min.js',
  'lib/jspdf.plugin.autotable.min.js',
  'lib/html2canvas.min.js',
  'lib/images/layers.png',
  'lib/images/layers-2x.png',
  'lib/images/marker-icon.png',
  'lib/images/marker-icon-2x.png',
  'lib/images/marker-shadow.png',
];

const APP_SHELL = [
  ...STATISCH,
  'version.js',
  ...APP_MODULE.map(m => m + '?v=' + APP_VERSION),
];

// version.js bestimmt, welche Modulversion die Seite anfordert. Eine alte
// Kopie wuerde das Gerät auf der alten Version festnageln → immer Netz zuerst.
const NETZ_ZUERST = 'version.js';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // cache: 'reload' erzwingt Netz und umgeht den HTTP-Cache des Browsers
      .then(cache => cache.addAll(APP_SHELL.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('sondagen-') && k !== CACHE_NAME)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Nur GET und nur same-origin cachen; alles andere direkt ins Netz
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // BlockCalc liegt als eigenstaendige Anwendung unter /blockcalc/ und bringt
  // einen eigenen Service Worker mit. Dieser hier haelt sich davon fern.
  //
  // Ohne die Ausnahme verschluckt die SPA-Regel weiter unten den iframe: eine
  // iframe-Navigation hat mode === 'navigate', also lieferte der Cache die
  // Schale der Fundamentbau-App aus — gemessen kam im iframe <title>
  // Fundamentbau mit 603'838 Zeichen an, waehrend ein blosses fetch() derselben
  // Adresse die echten 1'056'991 Zeichen mit <title>BlockCalc — SIA 267 lieferte.
  // Im iframe lief daher kein einziges Skript von BlockCalc, und der Handschlag
  // blieb aus.
  if (url.pathname.includes('/blockcalc/')) return;

  // version.js: Netz zuerst, Cache nur als Rueckfall (offline)
  if (url.pathname.endsWith('/' + NETZ_ZUERST) || url.pathname === '/' + NETZ_ZUERST) {
    event.respondWith(
      fetch(new Request(event.request, { cache: 'reload' }))
        .then(antwort => {
          if (antwort && antwort.ok) {
            const kopie = antwort.clone();
            caches.open(CACHE_NAME).then(c => c.put(NETZ_ZUERST, kopie));
          }
          return antwort;
        })
        .catch(() => caches.open(CACHE_NAME).then(c => c.match(NETZ_ZUERST)))
    );
    return;
  }

  // Navigation → index.html (SPA); no-cache erzwingt Revalidierung der Shell.
  //
  // Ausgenommen sind eigenstaendige Seiten. manual.html ist eine echte zweite
  // Seite, die der Handbuch-Knopf in einem neuen Tab oeffnet. Ohne die
  // Ausnahme beantwortete der Service Worker auch deren Navigation mit
  // index.html — der Knopf zeigte dann die App statt des Handbuchs, und zwar
  // nur mit aktivem Service Worker, also nicht beim Entwickeln.
  const eigeneSeite = url.pathname.endsWith('/manual.html');
  const anfrage = (event.request.mode === 'navigate' && !eigeneSeite)
    ? new Request('index.html', { cache: 'no-cache' })
    : event.request;

  // EXAKTES Matching (kein ignoreSearch): '?v=<Version>' ist Teil des Schluessels,
  // eine neue Version trifft nie einen alten Eintrag.
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(anfrage).then(imCache => {
        const vomNetz = fetch(anfrage).then(antwort => {
          if (antwort && antwort.ok) {
            cache.put(anfrage, antwort.clone());
            // Bei geänderter index.html: Clients informieren
            if (event.request.mode === 'navigate' && imCache) {
              Promise.all([imCache.clone().text(), antwort.clone().text()])
                .then(([alt, neu]) => {
                  if (alt !== neu) {
                    self.clients.matchAll().then(cs =>
                      cs.forEach(c => c.postMessage({ typ: 'update-verfuegbar' })));
                  }
                }).catch(() => {});
            }
          }
          return antwort;
        }).catch(() => imCache); // offline → Cache
        return imCache || vomNetz;
      })
    )
  );
});
