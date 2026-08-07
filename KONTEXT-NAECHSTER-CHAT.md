# Sondagen-App — Kontext für nächsten Chat

## Projekt
Standalone HTML-App (`index.html`) für SBB-Ramm-/Rammkernsondierungen.  
Kein Build-Step. CDN-Bibliotheken: Leaflet 1.9.4, SheetJS, jsPDF, html2canvas.  
Alle Daten in **IndexedDB** (via `store`-Schicht, seit 2026-07-26 — siehe unten). Phasen: Baugrund / Bauprojekt / Ausführung.

**Pfad:** `/home/ivan_peric/projekte/Tiefbau/Sondagen/index.html`  
**Backup (2026-05-21):** `index-backup-2026-05-21.html`  
**Backup vor Storage-Umbau (2026-07-26):** `index.html.bak-storage`  
**Preview-Server:** Port 8745 (kann sich ändern)

---

## WICHTIG: Umbauten 2026-07-25/26 (bei allen Änderungen beachten)

### Storage-Schicht (IndexedDB)
- **Alle Storage-Zugriffe laufen über `store.getItem/setItem/removeItem/keys()`** — NIE direkt `localStorage` verwenden.
- `store` = synchroner In-Memory-Cache + Write-Through nach IndexedDB (DB `sondagen-store`). Definition am Anfang des ersten `<script>`-Blocks.
- Haupt-Script ist **inert** (`<script type="text/x-app-src" id="app-main-src">`); ein Boot-Loader (Modul-Script) wartet auf `store.init()` und startet den App-Code danach mit globalem Scope.
- Einmalige Migration localStorage→IndexedDB beim ersten Start (Flag `__migriert_von_localstorage_v1`); localStorage bleibt als Sicherung.
- **`appReload()` statt `location.reload()`** — flusht ausstehende Schreibvorgänge.
- Fallback auf localStorage wenn IndexedDB fehlt (`store.istFallback`).

### Design-System (Tokens + Utilities)
- **Design-Tokens** in `:root` am Anfang des `<style>`-Blocks: `--c-primary` (#1a3a5c), Text-/Flächen-/Linien-/Statusfarben, `--sp-*`, `--r-*`, `--fs-*`, `--tap-min` (30px Desktop / 44px Touch via `pointer: coarse`).
- **Utility-Klassen:** `.btn` (+ `-primary/-secondary/-danger/-ghost/-sm`), `.field`/`.field-label`/`.field-input`/`.field-hint`, `.badge` (+ `-success/-warning/-danger/-info`).
- **`ui`-Helfer:** `ui.toast(msg, 'erfolg'|'fehler')` und `await ui.confirm(msg, {gefaehrlich, ok, abbrechen})`.
- **Regel für neue UI:** ausschliesslich Tokens/Klassen + `ui.*` verwenden — keine neuen Inline-Styles, keine neuen `alert()`/`confirm()`. Altbestand wird opportunistisch migriert (Boy-Scout-Regel).

### GPS
- Alle Geolocation-Aufrufe mit `enableHighAccuracy: true` + `timeout`; Einzelabfragen mit `maximumAge: 0`.

### Roadmap-Status (vereinbart 2026-07-26)
- ✅ Storage-Schicht, IndexedDB-Migration, `storage.persist()`
- ✅ Design-Tokens, Utilities, Touch-Targets, Toast/Confirm-Infrastruktur
- ✅ Bibliotheken lokal in `lib/` (Leaflet inkl. `lib/images/`, SheetJS, jsPDF, autotable, html2canvas) — kein CDN mehr, App startet offline
- ✅ JSON.parse-Härtung: globaler Helper `jsonParse(str)` (liefert null statt Exception, loggt Fehler) — alle 82 Aufrufstellen umgestellt; **neue Parse-Stellen immer `jsonParse()` verwenden**
- ✅ Gesamt-Backup + Speicher-Füllstand (App-Einstellungen → Allgemein → Datenspeicherung): `backupGesamtExport()` (alle Keys als JSON, Format `sondagen-gesamt-backup` v1), `backupGesamtImport()` (mit ui.confirm, überschreibt alles), Füllstandsbalken via `navigator.storage.estimate()`, Backup-Erinnerungs-Toast beim Start wenn >7 Tage (`checkBackupErinnerung`, Key `sondagen_last_backup`)
- ✅ PWA: `manifest.webmanifest` (3 Icons: icon-192/icon-512/icon-512-maskable.png), `sw.js` (Stale-While-Revalidate, cacht App-Shell inkl. lib/, meldet Updates per postMessage → Toast). **Version nur in `version.js` erhöhen** (siehe Modul-Abschnitt). SW-Registrierung in js/modals.js (nur http/https, file:// übersprungen)
- ✅ PWA: `manifest.webmanifest`, `sw.js` (Stale-While-Revalidate), `icon-192/512/512-maskable.png`. **Bei jedem Release `APP_VERSION` in `version.js` erhöhen** — das ist die einzige Stelle.
- ✅ Fotos als Blobs (siehe eigenen Abschnitt unten)
- ✅ alert/confirm-Ablösung: **keine nativen Browser-Dialoge mehr** — 141× `alert()` → `ui.toast()`, 47× `confirm()` → `await ui.confirm()`. Einzige Ausnahme: die Storage-Fehlermeldung in `store` (blockierende Datenverlust-Warnung, bewusst so).
  - Viele Handler sind dadurch **async** geworden (`deletePair`, `clearSketch`, `deleteProject`, `executeBpReset`, …). Bei neuen Aufrufen beachten: Rückgabewert ist ein Promise.
  - Inline-`onclick` mit Rückfrage brauchen einen Wrapper (Muster: `deleteSperrmusterMitFrage(id)`).
- ✅ Aufteilung in `js/*.js` (siehe eigenen Abschnitt unten)
- 🔄 Riesenfunktionen aufteilen — begonnen (siehe unten)
- Offen (Prio): weitere Riesenfunktionen, Inline-Styles opportunistisch migrieren, Dark-/Kontrastmodus

### Riesenfunktionen entzerren (laufend, seit 2026-07-26)
Vorgehen: **Charakterisierungstest vor dem Umbau** — Testszenario aufbauen, Ergebnis der
unveränderten Funktion als Referenz sichern, refaktorieren, Ergebnis byteweise vergleichen.
Nur so ist bei Logik ohne Unit-Tests sicher, dass sich das Verhalten nicht ändert.

| Funktion | vorher | jetzt | Referenztest |
|---|---|---|---|
| `autoZuweisenSchichten` (bauprogramm.js) | 529 | 389 | 4 Konfigurationen (Sortierung × Strategie × Offset), Zuweisungen + Baugruppen byteidentisch |
| `renderBpGantt` (bauprogramm.js) | 562 | 519 | 5 Varianten (Zoom tag/woche/monat/jahr + Kartenmodus), `innerHTML` byteidentisch |
| `renderBpZuweisungTable` (bauprogramm.js) | 308 | 185 | `innerHTML` gegen alte Fassung byteidentisch (61'158 Zeichen) |
| `_importFundamentlisteFromBuffer` (import-export.js) | 383 | 321 | Import-Ergebnis (PAIRS, Bauprojekt, FT-Liste, Baugrundprofile, Titel) gegen alte Fassung byteidentisch |
| `renderBpFundamenteGantt` (bauprogramm.js) | 499 | 336 | 4 Zoomstufen `innerHTML` byteidentisch; zusätzlich Drag-Listener (mousedown → `_bpFundMoveDrag`) und Baugruppen-Sortierpfad geprüft |

Ausgelagerte Helfer: `_azWaehlePairs`, `_azAktivePakete`, `_azWeisePauschaltypenZu`,
`_azSortiereNachGleisExklusivitaet`, `_azBerechneGruppenTermine`, `_azErgebnisMeldung`,
`_bpGanttLeerHtml`, `_bpGanttHintergrundSvg`, `_bpZuwZeileHtml`, `_impSpaltenMapping`,
`_bpFundHintergrundSvg`, `_bpFundHeaderSvg`, `_bpFundDragHandlerBinden`, `_bpFundZeilenstruktur`.

**Bewusst NICHT zerlegt:** der Zeilen-Renderblock in `renderBpFundamenteGantt`
(147 Z., «// Zeilen rendern» bis «// Meilenstein-Linien») hat 28 Abhängigkeiten aus der
äusseren Funktion und mutiert drei Akkumulatoren (`svg`, `rowY`, `startD`). Eine mechanische
Extraktion mit so einem Kontextobjekt wäre schlechter lesbar als der Inline-Block.
→ löst sich mit dem Vorhaben «Render-Modell» unten auf.

### Vorhaben: Umbau des Gantt-Render-Modells (offen, eigenes Projekt)
**Problem:** Die drei Gantt-/Tabellen-Renderer bauen SVG/HTML in einem Durchgang per
String-Konkatenation auf. Layoutberechnung, Datenaufbereitung und Ausgabe sind
verschränkt; Zwischenzustand steckt in mutierten Akkumulatoren (`svg`, `rowY`, …).
Deshalb lassen sich die grossen Blöcke nicht sinnvoll herauslösen.

**Zielbild (in Schritten, jeder für sich testbar):**
1. **Datenschicht trennen:** eine reine Funktion baut aus Paketen/Zuweisungen/Pairs ein
   Modell `{ zeilen: [{typ, label, balken:[{von, bis, farbe, meta}], …}], spalten, meilensteine }`
   — kein DOM, kein SVG. Diese Funktion ist direkt gegen Sollwerte testbar.
2. **Layoutschicht:** aus Modell + Zoomstufe die Geometrie berechnen (x/y/Breiten),
   ebenfalls ohne Ausgabe.
3. **Renderer:** aus Modell + Layout das SVG erzeugen — dann klein und ohne Fachlogik.
4. Interaktionen (Drag, Klick, Kontextmenü) an das Modell binden statt an SVG-Attribute.

**Nutzen:** Gantt-Logik wird testbar, die drei Renderer teilen sich Layout und
Hintergrund/Header, und die verbleibenden Riesenfunktionen lösen sich dabei von selbst auf.
**Aufwand:** mehrere Sessions — nicht nebenbei machen. Vorher Charakterisierungstests
(`innerHTML`-Referenzen) anlegen, wie in dieser Datei beschrieben.

**Noch offen:** `renderBpFundamenteGantt` (499), Rest von `_importFundamentlisteFromBuffer`
(321 — weitere Kandidaten: «Spezialtypen in FT-Bibliothek» ~25 Z., «Baugrundprofile aus
Importdaten» ~50 Z.), Rest von `renderBpGantt` (Header ~118 Z., Paket-Balken ~105 Z.,
Meilenstein-Strip ~72 Z.).

✅ **Behoben (Umbau Service Worker):** `ignoreSearch` ist entfernt, die Module liegen
**mit** `?v=<Version>` im Cache, und die Version steht nur noch in **`version.js`**
(gelesen von index.html per `<script>` und von sw.js per `importScripts`). Registrierung
mit `updateViaCache: 'none'`, Precache mit `cache: 'reload'`. Ein Versionssprung in
`version.js` genügt jetzt, damit Geräte neuen Code bekommen — verifiziert ohne jedes
manuelle Aufräumen.

⚠️ **Historischer Fallstrick (vor dem Umbau, zur Einordnung älterer Notizen):**
Der Service Worker matchte mit `cache.match(…, { ignoreSearch: true })`; ein alter
Eintrag `js/kern.js` beantwortete damit auch `js/kern.js?v=v24`. Cache-Busting-Parameter
nützten nichts, und es sah aus, als liefere der Server veraltete Dateien (tat er nicht).
Zusätzlich übernahm der Precache über den HTTP-Cache veraltete Kopien.
**Falls doch einmal alter Code erscheint:**
```js
for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
for (const k of await caches.keys()) await caches.delete(k);
location.reload();
```
Zweiter Stolperstein bei der Diagnose: `wc -c` zählt Bytes, `String.length` in JS zählt
UTF-16-Einheiten — bei den vielen Umlauten/Sonderzeichen weichen die Werte um 1–2 % ab.
Zum Vergleich `(await r.arrayBuffer()).byteLength` verwenden, besser noch den
`last-modified`-Header oder einen eingefügten Marker.

**Referenztest für den Import** (funktioniert, Vorgehen wiederverwenden):
Testprojekt anlegen → `XLSX.writeFile` stubben und `exportFundamentliste()` aufrufen →
Workbook mit `XLSX.write(wb,{type:'array'})` zu Buffer → Projekt leeren →
`_importFundamentlisteFromBuffer(buffer)` → Zustand (PAIRS, Bauprojekt, FT-Liste,
Baugrundprofile, Titel) als JSON erfassen. Generierte IDs (`ft_imp_…`, `bg_imp_…`)
vor dem Vergleich normalisieren. `appReload` und `ui.confirm` stubben.

**Hinweise für Referenztests:**
- Baugruppen-IDs enthalten `Date.now()` → vor dem Vergleich normalisieren.
- Testszenario braucht eine gefüllte FT-Bibliothek (`saveFtProfile(DEFAULT_FT_PROFIL)`),
  sonst bricht die Pool-Zuweisung still ab und es werden nur ABB/SICH zugewiesen.
- Zum Testen von Codeänderungen: Browser-Cache umgehen, z. B. über `http://127.0.0.1:PORT`
  statt `localhost:PORT` (andere Origin = eigener Cache, kein Service Worker).

### Modulstruktur (Umbau 2026-07-26)
`index.html` enthält nur noch Markup, CSS, die Storage-/UI-Schicht und den Boot-Loader (8'000 statt 38'000 Zeilen). Der App-Code liegt in **17 Dateien unter `js/`**:

| Datei | Inhalt |
|---|---|
| kern.js | Projektverwaltung, Phasen, Storage, Undo, Koordinaten |
| uebersicht.js | Übersicht, Schnell-Bearbeiten, Notiz-Kacheln |
| detail-sidebar.js | Detailansicht, Sidebar-Sektionen, Felddaten, Schlagzahl |
| karte-skizze.js | Karte, Layer, Parzellen, GPS, Skizzen-Canvas |
| ansichten.js | Kacheln/Liste/Karte, Abnahmeliste, Aushub, Multi-Select |
| import-export.js | Excel Import/Export, Pair-CRUD, Termine, Tags, Filter |
| projekt-einstellungen.js | Projektwechsel, App-Vorlage, Backup, Profil, Phasen |
| fotos-bericht.js | Suche, Fotos, Änderungsprotokoll, PDF-Bericht |
| modals.js | Service Worker, Messen, Kartenpicker, Kontakte, Mailvorlagen |
| init-phasen.js | Init, phasenabhängige Maske, Bauprojektfelder, Notiz-Storage |
| begehung-ausfuehrung.js | Begehung, Ausführungsprojekt, Abnahme-Checkliste |
| bibliotheken.js | Baugrund, Installationen, Statik, Schichten, Sperrmuster |
| bauprogramm.js | Bauprogramm-Tab: Datenmodell, Gantt, Zuweisung |
| fundamenttypen.js | Fundamenttypen-Bibliothek, Parameterdatenbank |
| termine-planung.js | Ereignisse, Starttermine, Ausführungsplanung, Notizen |
| listen-bsp.js | Dynamische Listen, Listen-Export, Begehungsskizze, BSP |
| **start.js** | **Einmalige Startlogik — muss letztes Modul bleiben** |

**Regeln (wichtig!):**
- Die Module werden als **klassische Scripts nacheinander** geladen (Liste `APP_MODULE` im Boot-Loader in index.html). Sie teilen sich den globalen Scope; `let`/`const` auf oberster Ebene sind modulübergreifend sichtbar.
- **Top-Level-Code sieht nur Funktionen bereits geladener Module.** Sofort ausgeführte Startlogik gehört deshalb nach `js/start.js`, nicht ins Fachmodul.
- Reihenfolge in `APP_MODULE` **nicht ändern**; neue Module vor `start.js` einhängen.
- Die Module werden mit `?v=APP_VERSION` geladen. **`APP_VERSION` steht ausschliesslich in `version.js` — bei jedem Release nur dort erhöhen.** index.html lädt die Datei als `<script>` vor dem Boot-Loader, `sw.js` per `importScripts`; daraus leiten sich Cache-Name und die Adressen im App-Shell ab. Es gibt kein `CACHE_VERSION` mehr.
- Der Service Worker matcht **exakt** (kein `ignoreSearch`): Module liegen mit `?v=<Version>` im Cache, eine neue Version trifft nie einen alten Eintrag. Precache mit `cache: 'reload'`, Registrierung mit `updateViaCache: 'none'` — sonst kommen sw.js/version.js aus dem HTTP-Cache. `version.js` wird zur Laufzeit netz-zuerst geholt (Cache nur offline).
- Jede neue Moduldatei muss **zusätzlich in `sw.js` in `APP_MODULE`** eingetragen werden (nicht mehr `APP_SHELL` — die Liste wird dort automatisch mit `?v=` versehen), andere neue Dateien in `STATISCH`. Sonst bricht der Offline-Betrieb.

**Startreihenfolge (js/start.js):**
1. `_migrateFtProfilId()` — Datenreparatur (braucht fundamenttypen.js + init-phasen.js)
2. `initApp()` — der frühere INIT-Block; baut die Oberfläche auf (definiert in init-phasen.js)
3. `checkBackupErinnerung()`
4. `migriereFotosZuBlobs().then(bereinigeVerwaisteFotoBlobs)`

**Fallstrick, zweimal aufgetreten:** Ein Modul bricht bei einem ReferenceError im Top-Level-Code **stumm mitten in der Ausführung ab** — Funktionen bleiben (gehoistet) verfügbar, aber `let`/`const` danach bleiben in der TDZ. Symptom: „Cannot access 'X' before initialization" irgendwo ganz woanders.
**Diagnose:** je Modul die *letzte* `let`/`const`-Bindung abfragen — wirft sie, ist das Modul abgebrochen.
- **Bemessungskern:** eigene spätere Phase — es existiert bereits eine separate HTML-App, die angebunden wird (nicht neu bauen)

### Fotos als Blobs (Umbau 2026-07-26)
- Bilddaten liegen als **Blob im IndexedDB-Store `blobs`** (DB-Version 2), nicht mehr als Base64 im Projekt-JSON.
- Foto-Record: `{ blobId, ts, phase, kategorie?, datum?, caption? }` — Altformat `{ data: 'data:image/…' }` wird beim Start automatisch migriert (`migriereFotosZuBlobs()`).
- **Zugriffsregeln:**
  - Anzeige (`<img src>`, canvas): **`fotoSrc(f)`** — synchron, liefert Object-URL.
  - jsPDF: **`await fotosFuerPdfLaden(fotos)`** vor der Ausgabe, dann **`fotoPdfSrc(f)`** synchron. jsPDF akzeptiert **keine** Object-URLs, nur Data-URLs!
  - Einzelne Data-URL: `await fotoDataUrl(f)`.
- Neue Fotos anlegen: `const blobId = await fotoBlobs.speichern(dataUrl)`.
- Löschen: immer `fotoBlobs.loeschen(blobId)` mitaufrufen; zusätzlich läuft beim Start `bereinigeVerwaisteFotoBlobs()` (prüft ALLE `sp_data__*`-Keys, nicht nur das aktive Projekt).
- Export/Backup: Projekt-JSON-Export bettet Data-URLs ein (Import migriert zurück); Gesamt-Backup (Format v2) sichert die Blobs im Feld `blobs`.
- **Entschieden:** kein Framework-Rewrite, kein Neubau (Strangler-Pattern); nächster grosser Ausbau: Bemessungsmodul Fundamente

### Features 2026-07-25/26
- **Nutzungsart (Masttyp/Anker)** durchgängig: `MAST_DATEN`-Konstante (DP22/A30→DP1a, DP26/A36→DP2a, DPM24→HP1a, DPM24-P→HP2a); Sidebar-Dropdown (`bpData.nutzungsart`), FT-Modal-Feld (`ft.nutzungsart` als Fallback), Excel-Import (Spalte masttyp), Material-/FT-Export, Kachel-Anzeige
- **Höhenkoten-Rework:** `fundkopf_mueM` aus `pair.z` auto-befüllt, Sohle auto-berechnet (Kopf − Kopfhöhe − Tiefe), Δ-Terrain-Anzeige, GW-Check (Standard-/Spezialfundament), Referenzkoten im Aushub-Modal
- **Blocktiefe-Fix:** `ftPrefillFromRefTyp()` + `onFtRefTypChange()` übernehmen jetzt auch `tiefe`

---

## Architektur-Übersicht

### Kernkonzepte
- **PAIRS**: Array von Standort-Objekten `{id, name, lat, lng, ...}`
- **currentPairId**: aktiver Standort
- **_activePhase**: `'baugrund' | 'bauprojekt' | 'ausfuehrung'`
- **FT-Bibliothek**: Standard- und Spezialfundamente, gespeichert via `loadFtProfile()` / `saveFtProfile()`
- **DEFAULT_FT_PROFIL**: statisches Array aller Standardtypen (DP1a, DP2a, HP1a, HP2a, DG1a…)
- **FT_MATERIAL_DB**: Materialdaten je Typ-ID

### Wichtige localStorage-Keys
| Key-Funktion | Inhalt |
|---|---|
| `FT_PROFIL_KEY()` | FT-Bibliothek des Projekts |
| `sp_ft_geo_overrides` | Geometrie-Overrides der Parameterdatenbank |
| `sp_ft_mat_overrides` | Material-Overrides der Parameterdatenbank |
| `loadAllBauprojekt()` | Bauprojekt-Daten je PairId |
| `loadBgZuweisungen()` | Baugrundprofil-Zuweisungen |
| `USER_PROFILE_KEY` | Name, Firma, E-Mail, Telefon etc. |

---

## Prüfwerkzeug — VOR JEDEM ABSCHLUSS AUSFÜHREN

```bash
node werkzeuge/pruefen.js
```

Statische Prüfung ohne Abhängigkeiten. Rückgabewert 0 = sauber, 1 = Fehler.
Geprüft werden nur Fehlerklassen, die **im Markup unsichtbar** sind und im
Betrieb still Daten verlieren — jede ist in diesem Projekt schon aufgetreten:

| Bereich | Findet |
|---|---|
| `ids` | Doppelte `id`. `getElementById` trifft nur das erste Element, das zweite ist tot. War 2,5 Monate in `ft-prof-schraub-laenge` aktiv: Eingaben verworfen, Werte nie angezeigt, Rücksetzen ohne Wirkung. |
| `tags` | Unausgeglichene `div`/`button`/`svg`/`select`/`textarea`. Zeigt abgebrochene Blöcke nach Skript-Umbauten. |
| `attribute` | Zweimal `class=`/`style=` im selben Tag — der Browser nimmt das erste, der Rest verschwindet lautlos. |
| `css` | Mehrfach definierte Utility-Klassen. Die spätere Definition gewinnt; so überschrieb eine alte `.modal-close` die Token-Fassung (16px statt 20px), und `.modal-input`/`.toolbar-sep` ebenso. |
| `handler` | `onclick` verweist auf eine Funktion, die es nirgends gibt (fällt sonst erst beim Klick auf). |
| `module` | `APP_MODULE` in sw.js weicht von `js/` oder von der Reihenfolge in index.html ab; `js/start.js` nicht an letzter Stelle. |
| `version` | version.js als einzige Versionsquelle, von index.html und sw.js gelesen, keine eigene `CACHE_VERSION` in sw.js. |

Einzelne Bereiche: `node werkzeuge/pruefen.js --nur=ids,css` · nur Fehler: `--leise`

**Nach jeder Änderung an pruefen.js den Selbsttest laufen lassen:**

```bash
bash werkzeuge/pruefen-selbsttest.sh
```

Er baut jeden dieser Defekte gezielt in eine Kopie unter `/tmp` ein (Original
bleibt unberührt) und muss für alle acht `ERKANNT` melden. Eine Prüfung, die
nichts mehr findet, sieht genauso aus wie ein sauberes Projekt.

---

## Umgesetzte Features (diese Session)

### 1. Parameterdatenbank in App-Einstellungen
- Neuer Tab "Parameterdatenbank" im App-Einstellungen-Modal
- Bearbeiten-Toggle, Excel Export/Import, Reset
- Sub-Tabs: Geometrie / Material & Bewehrung
- Overrides in `sp_ft_geo_overrides` / `sp_ft_mat_overrides`
- **Typ-Name editierbar** → propagiert in FT-Bibliothek + alle Bauprojekt-Records mit `ftProfilId`

### 2. Bodenkennwerte-Sidebar
- Werte jetzt **read-only** in der Karte angezeigt (statisch)
- Bearbeitung nur via **Modal** (Button "Bearbeiten" in Bodenaufschluss-Zeile)
- `_bkGrundwasser` als JS-Variable (kein hidden Select mehr)
- Funktionen: `openBodenkennwerteModal()`, `bkModalSetBodentyp()`, `saveBodenkennwerteModal()`

### 3. Bauprojekt — Fundamenttyp
- Familie-Select + Bearbeiten-Button in einer Zeile (wie Bodenaufschluss)
- Select hat `min-width:0` → schrumpft bei langen Namen
- "AUS BIBLIOTHEK"-Karte: kein Bearbeiten-Button mehr
- Fundamentart-Grossschreibung via `ART_LABELS`-Lookup
- `null m` → `—` in der Anzeige

### 4. Liste — Multi-Row Edit
- Wenn mehrere Zeilen selektiert sind, wirkt Feldänderung auf **alle** gleichzeitig
- Konflikt-Detection: FT ↔ Geländeneigung (`_ftMatchesNeigung`)
- Toast-Nachrichten: blau = Erfolg, gelb = Konflikt/übersprungen
- Hilfsfunktionen: `_listTargets(pairId)`, `_showListEditNotice(msg, isWarn)`

### 5. Spezialfundamente — Referenzwerte übernehmen
- `onFtRefTypChange()` füllt beim Wählen eines Referenztyps (DP1a/DP2a/HP1a/HP2a) **alle** Felder vor:
  - Kopf- und Block-Abmessungen
  - Beton, Betondeckung, Bewehrungsstahl
  - Längs- und Bügelbewehrung, Schrauben
  - VFK-Zeichnungsnummer
- Paramdb-Overrides werden dabei berücksichtigt

### 6. App-Einstellungen — Bereinigungen
- **Projektnummer** aus Allgemein-Tab entfernt
- **Eigene Phase hinzufügen** aus Phasen-Tab entfernt
- Beschreibungstext in Phasen-Tab angepasst

---

## Schlüsselfunktionen (Referenz)

```
loadFtProfile() / saveFtProfile()       FT-Bibliothek
loadFtGeoOverrides() / saveFtGeoOverrides()
loadFtMatOverrides() / saveFtMatOverrides()
loadAllBauprojekt() / saveAllBauprojekt()
loadBauprojektFelder(pairId)            lädt Sidebar-Felder
saveBauprojektFeld()                    speichert Bauprojekt-Felder
renderBpFtInfo()                        zeigt "AUS BIBLIOTHEK"-Karte
refreshBpFamilieSelect(savedFundtyp)    befüllt Familie-Dropdown
updateBodenkennwerteUI()                rendert statische BK-Karte
openBodenkennwerteModal()               BK-Bearbeiten-Modal
seedDefaultFtProfile()                  initialisiert FT-Bibliothek
onFtRefTypChange()                      Referenzwerte übernehmen
saveParamdbGeoField(id, field, value)   Geo-Override + Name-Propagation
_listTargets(pairId)                    Multi-Row-Ziele
_ftMatchesNeigung(ft, neigung)          FT/Neigung-Konflikt
```

---

## Bekannte Besonderheiten
- `bp-fundtyp` (hidden select) = gespeicherter Fundtyp-Name; `ftProfilId` = stabile ID
- Bei Namensänderung via Parameterdatenbank: FT-Liste + alle Bauprojekt-Records werden aktualisiert
- `_bkBodentyp`: `'fein'` | `'grob'` (global state)
- `_bkGrundwasser`: string state (kein DOM-Element)
- Parameterdatenbank-Modal wird auf 820px verbreitert wenn aktiv
- Standard-FT-Typen: DP1a, DP2a, HP1a, HP2a (Hangneigung ≤14° und 14-33°), DG1a/2a/3a (Direktgründung), plus Spezialtypen
- `einsatzBedingung` enthält `'14–33'` für Böschungstypen, `'≤ 14°'` für Flachtypen

---

*Erstellt: 2026-05-21*

---

## Abklaerung Zugbewegungen in Echtzeit (2026-08-07) — zurueckgestellt

Gepruefte Quellen und Ergebnis, damit die Abklaerung nicht wiederholt wird:

- **Fahrzeugpositionen aus GPS gibt es nicht als offene Daten.** Weder SBB
  noch die Plattform opentransportdata veroeffentlichen Ortungsdaten der Zuege.
- **TRAVIC (geOps / Uni Freiburg)** zeigt keine gemessenen Positionen: die
  Fahrzeuge werden aus dem Fahrplan interpoliert und, wo vorhanden, mit
  GTFS-RT-Verspaetungen korrigiert; ohne Echtzeitkanal bleibt die reine
  Fahrplanposition. geOps nennt als Fehlerquellen Rundung auf ganze Minuten,
  verzoegerte Aktualisierung, unvollstaendige Haltezeiten, Ausfaelle und
  Umleitungen. Eine Minute Rundung sind bei 120 km/h 2 km Weg; zwischen zwei
  Stationen wird linear interpoliert, also ohne Anfahren und Bremsen.
  Echte Ortungsdaten stecken erst im kommerziellen Produkt TRALIS.
- **Nutzbar waere `transport.opendata.ch/v1/stationboard`** — ohne Schluessel
  abfragbar, liefert Abfahrten mit Verspaetung und Prognose (am 2026-08-07 aus
  der App heraus gegen Sulgen getestet, Antwort mit delay und prognosis).
  Daraus liesse sich eine geschaetzte Durchfahrt am Standort rechnen
  (Kilometrierung aus js/bahn.js, angenommene Geschwindigkeit).

**Entscheid:** vorerst nicht gebaut. Ein Alarm mit Vibration wuerde eine
Genauigkeit vortaeuschen, die die Datenlage nicht hergibt. Die Sicherung im
Gleisbereich bleibt beim Sicherheitswaerter.
