// ============================================================
// EINZIGE VERSIONSQUELLE DER APP
//
// Wird von zwei Seiten gelesen:
//   · index.html  — als klassisches <script> vor dem Modul-Loader.
//                   Jedes Modul wird als 'js/xy.js?v=APP_VERSION' geladen.
//   · sw.js       — via importScripts(). Der Cache-Name und die Adressen
//                   im App-Shell leiten sich daraus ab.
//
// Damit gibt es genau EINE Stelle zum Erhoehen. Vorher standen hier zwei
// Konstanten (APP_VERSION / CACHE_VERSION) in getrennten Dateien; liefen
// sie auseinander, lieferte der Service Worker Module der falschen Version.
//
// BEI JEDEM RELEASE ERHOEHEN.
// ============================================================
const APP_VERSION = 'v260';
