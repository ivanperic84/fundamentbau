// ============================================================
// STARTUP — laeuft als LETZTES Modul, wenn alle Funktionen geladen sind.
//
// Hier gehoeren alle Aufrufe hin, die beim App-Start einmalig laufen und
// auf Funktionen aus mehreren Modulen zugreifen. Grund: die Module werden
// nacheinander als klassische Scripts geladen; Top-Level-Code in einem
// frueheren Modul sieht Funktionen spaeterer Module noch NICHT.
//
// Faustregel fuer neuen Code:
//   - Funktions-/Klassendeklarationen  -> ins passende Fachmodul
//   - sofort ausgefuehrte Startlogik   -> hierher
// ============================================================

// Fundamenttypen-Bibliothek vorabfüllen und Versionsmigrationen auflegen.
// Lief bisher nur beiläufig — beim Öffnen der Bibliothek oder eines Standorts.
// Eine Änderung an den Standardtypen wirkte dadurch erst irgendwann, und die
// Reparatur direkt darunter las eine womöglich noch leere Bibliothek.
seedDefaultFtProfile();

// Datenreparatur: ftProfilId und ftZuweisungen aus fundtyp-Text ableiten
// (braucht loadFtProfile/loadFtZuweisungen aus fundamenttypen.js und
//  loadAllBauprojekt aus init-phasen.js)
_migrateFtProfilId();

// Oberflaeche aufbauen: Auto-Save-Delegation, erste Renderdurchlaeufe,
// Wiederherstellung der zuletzt aktiven Ansicht (aus init-phasen.js)
initApp();

// Beschriftung der Werkzeugleiste nach der Einstellung — sie steht global,
// gilt also ab dem ersten Aufbau und nicht erst nach einem Kartenwechsel.
if (typeof toolbarBeschriftungPruefen === 'function') toolbarBeschriftungPruefen();

// Phasenbindung der Bereichsreiter setzen. Muss auch beim Erststart laufen —
// setPhase() wird nur beim Wechsel aufgerufen, nicht beim Laden.
_navTabsAktualisieren();

// Erinnerung, wenn das letzte Gesamt-Backup zu lange her ist
checkBackupErinnerung();

// Fotos in den Blob-Store migrieren, danach verwaiste Blobs aufraeumen.
// Reihenfolge wichtig: die Migration erzeugt erst die Referenzen, die die
// Bereinigung prueft.
migriereFotosZuBlobs().then(bereinigeVerwaisteFotoBlobs);
