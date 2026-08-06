# Sondagen-App — Benutzerhandbuch

**Version:** 3.141 · **Stand:** 2026-05-21  
**Einsatzbereich:** SBB-Ramm- und Rammkernsondierungen / Mastfundamente  
**Norm:** SBB Dok. 0161.1011.0002

---

## Inhaltsverzeichnis

1. [Übersicht & Konzept](#1-übersicht--konzept)
2. [Installation & Start](#2-installation--start)
3. [Projektnavigation](#3-projektnavigation)
4. [Kartenansicht](#4-kartenansicht)
5. [Standort-Sidebar: Baugrund-Phase](#5-standort-sidebar-baugrund-phase)
6. [Standort-Sidebar: Bauprojekt-Phase](#6-standort-sidebar-bauprojekt-phase)
7. [Standort-Sidebar: Ausführungs-Phase](#7-standort-sidebar-ausführungs-phase)
8. [Listenansicht & Multi-Row-Edit](#8-listenansicht--multi-row-edit)
9. [Fundamenttypen-Bibliothek](#9-fundamenttypen-bibliothek)
10. [Parameterdatenbank](#10-parameterdatenbank)
11. [Bodenkennwerte](#11-bodenkennwerte)
12. [Export & Import](#12-export--import)
13. [App-Einstellungen](#13-app-einstellungen)
14. [Abhängigkeiten & Anpassungen](#14-abhängigkeiten--anpassungen)
15. [Entkopplung & Dateistruktur](#15-entkopplung--dateistruktur)

---

## 1. Übersicht & Konzept

Die Sondagen-App ist eine **Standalone-Webanwendung** (eine einzige HTML-Datei) zur Verwaltung von Sondierstandorten und Mastfundamenten für SBB-Leitungsprojekte.

### Kernprinzipien
- **Offline-fähig:** Alle Daten im Browser-`localStorage`, kein Server
- **Phasenbasiert:** Jeder Standort durchläuft drei Phasen: Baugrund → Bauprojekt → Ausführung
- **Typengeprüft:** Standardfundamente aus SBB-Norm 0161.1011 sind vorinstalliert
- **Exportierbar:** JSON (Vollsicherung), Excel (Berichte), PDF (Druckansicht)

### Drei Phasen

```
┌─────────────┐    ┌─────────────┐    ┌──────────────┐
│  BAUGRUND   │ →  │ BAUPROJEKT  │ →  │  AUSFÜHRUNG  │
│             │    │             │    │              │
│ Sondierung  │    │ Fundamenttyp│    │ Material     │
│ Bodenprofil │    │ Bodenkennw. │    │ Lieferant    │
│ Grundwasser │    │ Statik-Nw.  │    │ Aushubprot.  │
└─────────────┘    └─────────────┘    └──────────────┘
```

---

## 2. Installation & Start

1. `index.html` lokal speichern (z.B. `C:\Projekte\Sondagen\index.html`)
2. Im Browser öffnen (Chrome, Edge empfohlen)
3. Beim ersten Start: **Neues Projekt anlegen** über das Ordner-Symbol oben rechts

> **Hinweis:** Für die swisstopo-Karte und geo.admin.ch-Abfragen ist eine Internetverbindung erforderlich. Alle eingegebenen Daten werden lokal gespeichert.

### Datensicherung
```
App-Einstellungen (⚙) → Vorlage-Tab → JSON exportieren
```
Regelmässige Sicherung empfohlen, da `localStorage` beim Browser-Leeren gelöscht wird.

---

## 3. Projektnavigation

```
┌──────────────────────────────────────────────────────┐
│  [Projektname ✏]   [📁] [<] [>] [?] [⚙]            │
│  8 Standorte                                          │
├──────────────────────────────────────────────────────┤
│  BAUGRUND | BAUPROJEKT | AUSFÜHRUNG   ← Phasen-Tabs  │
├──────────────────────────────────────────────────────┤
│  Karte    Liste    Termine    ...     ← View-Buttons  │
└──────────────────────────────────────────────────────┘
```

| Element | Funktion |
|---|---|
| `[📁]` | Projekt wechseln / neues Projekt anlegen |
| `[< >]` | Zwischen Standorten navigieren |
| `[⚙]` | App-Einstellungen öffnen |
| Phase-Tab | Aktive Phase wechseln (wirkt auf Sidebar + Listenfelder) |

### Projektstruktur
- Jedes Projekt hat eine eigene Daten-Isolation im `localStorage`
- Standorte = PAIRS (Doppelsonden: Rammsondierung + Rammkernsondierung)
- Jeder Standort hat eine **stabile ID** — Umbenennungen brechen keine Verknüpfungen

---

## 4. Kartenansicht

```
┌─────────────────────────────────────────────────────┐
│                    KARTE                             │
│    ┌──────────────────────────────────────────┐     │
│    │  [101]  [102]  [103●]                   │     │
│    │           swisstopo                      │     │
│    └──────────────────────────────────────────┘     │
│  [+ Karte]  [✏ Kommentieren]  [↔ Messen]            │
└─────────────────────────────────────────────────────┘
```

### Standort-Marker
- **Grau:** Geplant
- **Orange:** In Abklärung  
- **Grün:** Abgeschlossen
- **Rot-Outline:** Aktiver Standort

### Geolokalisierung
Koordinaten werden automatisch bei Standort-Auswahl mit folgenden Diensten abgefragt:
- **swisstopo WMTS** (Kartengrundlage LV95)
- **geo.admin.ch REST API**: Geländehöhe, KM-Angabe auf Bahnlinie, Streckenname
- Manuelle Eingabe möglich (⊕-Button)

---

## 5. Standort-Sidebar: Baugrund-Phase

Die Baugrund-Phase dokumentiert den **Untergrundaufschluss**.

```
┌────────────────────────────────────────┐
│ ← Zurück   Mast 101 / Sondierung 8    │
├────────────────────────────────────────┤
│ METADATEN                              │
│   Status: [Geplant ▾]                  │
│   Sondiertyp: [RS DP ▾]               │
│                                        │
│ BODENAUFSCHLUSS (Baugrundprofil)       │
│   [Profil auswählen ▾] [Bearbeiten]    │
│                                        │
│   BODENKENNWERTE  Feinkörnig          │
│   ME-Wert    30 MPa  ●                │
│   φ'k        28°     ●                │
│   Raumlast   19 kN/m³                 │
│   Grundwasser Nicht angetroffen        │
│   [Bearbeiten →Modal]                  │
│                                        │
│ HÖHENKOTEN                             │
│   Gelände: 432.5 m ü.M.               │
│                                        │
│ NATURSCHUTZ                            │
│   GIS-Abfrage Schutzgebiete           │
└────────────────────────────────────────┘
```

### Bodenkennwerte-Modal
Öffnet sich via **Bearbeiten** in der Bodenkennwerte-Karte:
- Bodentyp: Feinkörnig / Grobkörnig (beeinflusst ME-Grenzwert)
- ME-Wert, φ'k, Raumlast γ'k, Kohäsion c'k, Grundwasser
- Grenzwerte gem. SBB 0161.1011.0010: φ'k ≥ 27°, ME ≥ 12 MPa (fein) / 25 MPa (grob)
- Status-Dots zeigen Erfüllung / Nicht-Erfüllung

### Baugrundprofil-Bibliothek
Über **Bearbeiten** (Bodenaufschluss-Zeile):
- Profile anlegen mit USCS-Klassifikation, Schichtbeschrieb, Grundwassertiefe
- Profil wird dem Standort zugewiesen
- Mehrere Standorte können dasselbe Profil referenzieren

---

## 6. Standort-Sidebar: Bauprojekt-Phase

Zuweisung und Dokumentation des **Fundamenttyps**.

```
┌────────────────────────────────────────┐
│ BAUPROJEKT                             │
│                                        │
│ Bestand / Neu                          │
│   [Neu zu bauen ▾]                     │
│                                        │
│ Fundamenttyp                           │
│   [DP1a ▾]          [Bearbeiten]      │
│   [1.50 m ▾]  ← Tiefe-Picker          │
│                                        │
│ ┌── AUS BIBLIOTHEK ─────────────────┐ │
│ │ Fundamentart   Blockfundament     │ │
│ │ Kopf (B × L)   0.60×0.60 m       │ │
│ │ Block (B × L)  1.00×1.00 m       │ │
│ │ Tiefe          1.50 m            │ │
│ └───────────────────────────────────┘ │
│                                        │
│ Bodenkennwerte                         │
│   [Bodenaufschluss ▾] [Bearbeiten]    │
│                                        │
│ Statischer Nachweis (bei Spezial)      │
│   [Link/Dok-Nr. eingeben]              │
│                                        │
│ Geländeneigung                         │
│   [≤14° ▾]                            │
└────────────────────────────────────────┘
```

### Fundamenttyp-Auswahl (zweistufig)
1. **Familie wählen** (DP1a, DP2a, HP1a, HP2a, …)  
   → Filtert automatisch nach kompatibler Geländeneigung
2. **Tiefe wählen** (z.B. 1.50 / 1.80 / 2.10 / 2.40 m)

> **Abhängigkeit Neigung → Fundamenttyp:**  
> DP1a ≤14° → `ft_std_dp1a_15`  
> DP1a 14–33° → `ft_std_dp1b` (Böschungstyp)  
> Diese Logik ist in `_ftMatchesNeigung()` implementiert und prüft `einsatzBedingung` des Typs.

### Bearbeiten-Button (Fundamenttyp)
- **Standardtyp:** Öffnet Parameterdatenbank (Materialkennwerte anpassbar)
- **Spezialtyp:** Öffnet Fundamenttyp-Profil-Modal (alle Felder editierbar)

---

## 7. Standort-Sidebar: Ausführungs-Phase

Dokumentation der **Bauausführung**.

```
┌────────────────────────────────────────┐
│ AUSFÜHRUNGSPLANUNG                     │
│   Datum geplant: [TT.MM.JJJJ]         │
│   Datum ausgeführt: [TT.MM.JJJJ]      │
│   Ausführungsfirma: [...]              │
│                                        │
│ MATERIAL & LIEFERUNG                   │
│   Betonlieferant: [...]               │
│   Bestellnummer: [...]                 │
│                                        │
│ AUSHUBPROTOKOLL                        │
│   Grubenausmass (L, B, T)             │
│   Bodenklassen (Fein/Grob/Fels)       │
│   Wasserhaltung                        │
│                                        │
│ BEG-SKIZZE                            │
│   Freihandskizze auf Kartenausschnitt  │
└────────────────────────────────────────┘
```

---

## 8. Listenansicht & Multi-Row-Edit

Die Listenansicht zeigt alle Standorte in tabellarischer Form.

```
┌─────────────────────────────────────────────────────────┐
│ 📋 LISTE          [🔍 Suche]  [Filter ▾]  [✏ Bearbeiten]│
├────┬──────────┬──────────┬──────────┬────────┬──────────┤
│ ☐  │ Mast     │ Status   │ Fundtyp  │ Tiefe  │ Neigung  │
├────┼──────────┼──────────┼──────────┼────────┼──────────┤
│ ☑  │ Mast 101 │ Geplant  │ DP1a     │ 1.50 m │ ≤14°     │
│ ☑  │ Mast 102 │ Geplant  │ DP1a     │ 1.80 m │ ≤14°     │
│ ☐  │ Mast 103 │ Abgesch. │ DP2a     │ 2.00 m │ 14–33°   │
└────┴──────────┴──────────┴──────────┴────────┴──────────┘
```

### Multi-Row-Edit
**Mehrere Zeilen selektieren** (Checkboxen) + **✏ Bearbeiten** aktivieren:
- Feldänderung (Status, Fundamenttyp, Neigung etc.) wirkt **auf alle selektierten Zeilen gleichzeitig**
- **Konflikt-Detection:** Wenn ein Fundamenttyp nicht zur Geländeneigung einer Zeile passt, wird diese Zeile übersprungen
- **Toast-Meldung:**
  - 🔵 Blau: `"3 Positionen aktualisiert"`
  - 🟡 Gelb: `"2/3 zugewiesen · 1 übersprungen: DP1a ≠ Neigung '>33°' (Mast 102)"`

### Bearbeiten-Modus aktivieren
```
[✏ Bearbeiten]-Button oben in der Listenansicht
→ Felder werden editierbar
→ Mehrfachselektion via Checkbox aktiviert Multi-Row-Modus
```

---

## 9. Fundamenttypen-Bibliothek

Zugang: Zahnrad-Icon in der Bauprojekt-Sidebar **oder** direkt via Kartenmenü.

```
┌─────────────────────────────────────────────────────────┐
│ ⊞ FUNDAMENTTYPEN-BIBLIOTHEK                             │
│                                                          │
│ STANDARDFUNDAMENTE (typengeprüft gem. SBB 0161.1011)    │
│ ┌──────────┬─────────┬──────────┬──────────┐           │
│ │ DP1a/1.50│ DP1a/1.8│ DP2a/2.00│ HP1a/2.40│           │
│ │ 0.36m³   │ 0.36m³  │ 0.36m³   │ 0.36m³   │           │
│ └──────────┴─────────┴──────────┴──────────┘           │
│                                                          │
│ SPEZIALFUNDAMENTE (⚠ PGV-Nachweis erforderlich)         │
│ [+ Neues Spezialfundament]                              │
│ ┌──────────────────────────────────┐                    │
│ │ DP1a – Weicher Untergrund        │                    │
│ │ Ref: DP1a · Blockfundament       │                    │
│ └──────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

### Standardfundamente
Vorinstallierte, typengeprüfte Typen gem. SBB 0161.1011:

| Familie | Blockgrösse | Tiefen |
|---|---|---|
| DP1a | 1000×1000 mm | 1.50 / 1.80 / 2.10 / 2.40 m |
| DP2a | 1200×1200 mm | 2.00 / 2.40 / 2.70 m |
| HP1a | 1200×1200 mm | 2.40 / 2.70 m |
| HP2a | 1500×1500 mm | 2.60 / 3.00 / 3.50 m |
| DG1a | 1300×1300 mm | 2.40 / 2.70 / 3.00 m |
| DG2a | 1300×1300 mm | 2.50 m |
| DG3a | 1500×1500 mm | 2.60 / 3.00 / 3.50 m |

**Typen mit Böschungsvariante (14–33°):** DP1a/2.40, DP2a/2.70, HP1a/2.70, HP2a/3.50

Materialkennwerte von Standardtypen sind **schreibgeschützt** (Geometrie), Materialwerte können über die Parameterdatenbank angepasst werden.

### Spezialfundamente erstellen
1. **[+ Neues Spezialfundament]** klicken
2. **Referenztyp** wählen (DP1a / DP2a / HP1a / HP2a)  
   → Alle Felder werden automatisch mit Referenzwerten vorausgefüllt
3. Werte anpassen (Abmessungen, Material, VFK-Nummer)
4. Bezeichnung vergeben
5. Speichern

> **Hinweis:** Spezialfundamente erfordern immer einen statischen Nachweis für das PGV (Plangenehmigungsverfahren).

---

## 10. Parameterdatenbank

Zugang: **App-Einstellungen (⚙) → Tab "Parameterdatenbank"**

```
┌─────────────────────────────────────────────────────────┐
│ STANDARDFUNDAMENTE FL — PARAMETERDATENBANK               │
│ SBB Dok. 0161.1011.0002                                  │
│                                                          │
│ [✎ Bearbeiten]  [↓ Excel Export]  [↑ Excel Import]      │
│ [↺ Reset]                                               │
│                                                          │
│ [Geometrie] [Material & Bewehrung]                       │
│                                                          │
│ Typ          Hangneigung  Kopf bxb    Kopf h  Block bxb  │
│ DP1a / 1.50  ≤ 14°       0.60×0.60 m  1.00   1000×1000  │
│ DP1a / 1.80  ≤ 14°       0.60×0.60 m  1.00   1000×1000  │
│ DP1a / 2.40  14–33°      0.60×0.60 m  1.00   1000×1000  │
│ DP2a / 2.00  ≤ 14°       0.60×0.60 m  1.00   1200×1200  │
└─────────────────────────────────────────────────────────┘
```

### Tab: Geometrie
Editierbare Felder im Bearbeiten-Modus:
| Feld | Bedeutung | Auswirkung |
|---|---|---|
| **Typ** (Name) | Bezeichnung des Fundaments | Propagiert in alle Bauprojekt-Zuweisungen |
| **Hangneigung** | ≤14° oder 14–33° | Steuert Neigungsfilter in Fundtyp-Auswahl |
| **Kopf h** | Kopfhöhe in Metern | Volumenberechnung |
| **Block b×b** | Blockabmessung in mm (z.B. `1000×1000 mm`) | Volumen + Fundamenttyp-Anzeige |
| **Tiefe t** | Gesamttiefe in Metern | Volumen |

> **Neigungslogik:** Die Hangneigung-Spalte steuert, welche Fundtypen bei welcher Geländeneigung angeboten werden. Ändert man `DP1a / 2.40` von `14–33°` auf `≤14°`, wird dieser Typ nicht mehr als Böschungsvariante angeboten.

### Tab: Material & Bewehrung
| Feld | Inhalt |
|---|---|
| Beton | Betonspezifikation (z.B. `NPK F, C30/37, XC4...`) |
| Deckung | Betondeckung (z.B. `40 mm`) |
| Stahl | Bewehrungsstahl (z.B. `B500B`) |
| Längs | Längsbewehrung (z.B. `4 Ø 16 mm`) |
| Quer | Querbewehrung / Bügel |
| Anker | Fundamentschrauben |

### Excel-Austausch (Sharepoint-Workflow)
```
1. [↓ Excel Export] → speichert .xlsx mit 2 Sheets (Geometrie + Material)
2. Datei auf Sharepoint ablegen / bearbeiten
3. [↑ Excel Import] → lädt angepasste Werte zurück
4. Änderungen wirken sofort auf alle Standorte
```

### Reset
**[↺ Reset]** setzt alle Overrides zurück auf SBB-Standardwerte. Wirkt sofort, kann nicht rückgängig gemacht werden — vorher exportieren!

---

## 11. Bodenkennwerte

Die Bodenkennwerte dokumentieren die **geotechnischen Eigenschaften** des Baugrunds pro Standort (Bauprojekt-Phase).

### Anzeige (read-only Karte)
```
┌─ BODENKENNWERTE  [Feinkörnig] ────────────────┐
│ CL, ML, CM, CH, MH (USCS)                     │
│ ME-Wert    30 MPa  ●  Erfüllt (30 ≥ 12 MPa)   │
│ φ'k        28°     ●  Erfüllt (28° ≥ 27°)     │
│ Raumlast   19 kN/m³                            │
│ Kohäsion   0 kPa                               │
│ Grundwasser Nicht angetroffen                  │
├────────────────────────────────────────────────┤
│ GRENZWERTE (GEM. 0161.1011.0010)               │
│ φ'k ≥ 27° · ME ≥ 12 MPa (feinkörnig)         │
│ Grundwasser: unterhalb Fundament · ≤ 33°       │
└────────────────────────────────────────────────┘
```

### Bearbeiten-Modal
Öffnet sich über den **Bearbeiten**-Button in der Bodenaufschluss-Zeile:
- Bodentyp umschalten: **Feinkörnig** (ME ≥ 12 MPa) / **Grobkörnig** (ME ≥ 25 MPa)
- Alle Kennwerte eingeben
- Grundwasser-Status auswählen
- **Speichern** → Werte werden in der Karte angezeigt, Grenzwert-Check aktualisiert

### Grenzwerte gem. SBB 0161.1011.0010
| Parameter | Grenzwert feinkörnig | Grenzwert grobkörnig |
|---|---|---|
| Reibungswinkel φ'k | ≥ 27° | ≥ 27° |
| Steifemodul ME | ≥ 12 MPa | ≥ 25 MPa |
| Grundwasser | unterhalb Fundament | unterhalb Fundament |
| Geländeneigung | ≤ 33° | ≤ 33° |

---

## 12. Export & Import

### JSON — Vollsicherung
```
App-Einstellungen (⚙) → Vorlage → JSON exportieren / importieren
```
- Exportiert **alle** Projektdaten (Standorte, Bauprojekt, Profile, Einstellungen)
- Format: Einzelne JSON-Datei
- **Empfohlen als regelmässige Sicherung**
- Importieren überschreibt alle lokalen Daten!

### Excel — Parameterdatenbank
```
App-Einstellungen (⚙) → Parameterdatenbank → Excel Export / Import
```
- 2 Sheets: `Geometrie` + `Material_Bewehrung`
- Geeignet für Ablage auf **Sharepoint** / Weitergabe an FI
- Import liest Sheet-Namen und ordnet Spalten automatisch zu

### Excel — Listenansicht
```
Listenansicht → Export-Button (oben rechts)
```
- Exportiert aktuell angezeigte/gefilterte Standortliste
- Alle Felder der aktiven Phase

### PDF — Druckansicht
```
Listenansicht → PDF-Button oder Kartenansicht → Drucken
```
- Erzeugt druckoptimierte Übersicht
- Logo und Projekttitel werden aus den App-Einstellungen übernommen

### Vorlage
```
App-Einstellungen (⚙) → Vorlage
```
- Erstellt Vorlagen-JSON für neue Projekte (vordefinierte Einstellungen ohne Standortdaten)
- Nützlich für standardisierte Projektinitialisierung

---

## 13. App-Einstellungen

```
App-Einstellungen (⚙)
├── Allgemein         Name, Firma, E-Mail, Telefon, Adresse
├── Status            Statusbezeichnungen und Farben anpassen
├── Sidebar           Sichtbarkeit der Sidebar-Sektionen
├── Phasen            Phasenbezeichnungen umbenennen
├── Vorlage           JSON Export/Import, Vorlage erstellen
└── Parameterdatenbank  Geometrie- und Materialkennwerte
```

### Phasen umbenennen
Die drei Kernphasen können **umbenannt** werden (z.B. "Baugrund" → "Voruntersuchung"), ohne die Funktionalität zu beeinträchtigen. Kürzel (max. 5 Zeichen) erscheinen in der Phasen-Navigation.

### Sidebar-Sektionen ein-/ausblenden
Nicht benötigte Sektionen können pro Phase ausgeblendet werden (z.B. Naturschutz-Sektion, wenn nicht relevant).

---

## 14. Abhängigkeiten & Anpassungen

### Abhängigkeitsgraph

```
Geländeneigung (bp-neigung)
        │
        ▼
Fundamenttyp-Auswahl (bp-ft-familie)
        │  filtert via _ftMatchesNeigung()
        │  liest einsatzBedingung aus FT-Profil
        ▼
Fundamenttyp-Tiefe (bp-ft-tiefe)
        │
        ▼
"AUS BIBLIOTHEK"-Karte ← renderBpFtInfo()
        │
        ▼
Statischer Nachweis (nur bei Spezialtypen)
```

```
Parameterdatenbank (sp_ft_geo_overrides)
        │
        ├─► renderParamdbGeo() → Anzeige in Einstellungen
        ├─► onFtRefTypChange() → Vorausfüllen bei Spezialfundament
        └─► Volumenberechnung (ftUpdateVol)

Parameterdatenbank (Name-Änderung)
        │
        ├─► saveFtProfile() → FT-Bibliothek aktualisiert
        └─► saveAllBauprojekt() → alle Zuweisungen aktualisiert
```

### Neigungslogik im Detail

Die Funktion `_ftMatchesNeigung(ft, neigung)` entscheidet, ob ein Fundamenttyp für eine gegebene Geländeneigung geeignet ist:

```javascript
// einsatzBedingung enthält "14–33" → Böschungstyp
// DP1a / 2.40 → "Hangneigung 14–33°" → nur bei 14–33° sichtbar
// DP1a / 1.50 → "Hangneigung ≤ 14°"  → nur bei ≤14° sichtbar
// Neigung >33° → kein Standardtyp verfügbar
```

**Anpassen:** In der Parameterdatenbank → Geometrie → Spalte **Hangneigung** umstellen. Änderungen wirken sofort auf die Fundamenttyp-Auswahl in der Sidebar.

### Grenzwerte anpassen (Bodenkennwerte)

```javascript
// In index.html, Konstante BK_GRENZWERTE:
const BK_GRENZWERTE = {
  fein: { me: 12 },  // ME-Grenzwert feinkörnig in MPa
  grob: { me: 25 },  // ME-Grenzwert grobkörnig in MPa
};
// φ'k-Grenzwert: 27° (hardcoded in updateBodenkennwerteUI)
```

### Status-Labels anpassen
```
App-Einstellungen → Status-Tab
→ Bezeichnungen und Farben für jeden Status ändern
```

---

## 15. Entkopplung & Dateistruktur

### Aktuelle Struktur
```
Sondagen/
└── index.html          ← alles in einer Datei (~32'000 Zeilen)
```

### Empfohlene Entkopplung (bei Bedarf)

Die grössten Blöcke in `index.html` sind:
1. **`DEFAULT_FT_PROFIL`** (~300 Zeilen) — Standardfundament-Daten
2. **`FT_MATERIAL_DB`** (~50 Zeilen) — Materialdaten
3. **CSS** (~800 Zeilen im `<style>`-Block)
4. **JavaScript-Logik** (~28'000 Zeilen)

**Option A: Daten auslagern** (empfohlen für Wartbarkeit)
```
Sondagen/
├── index.html
├── data/
│   ├── ft-profil.js        ← DEFAULT_FT_PROFIL, FT_MATERIAL_DB
│   └── phasen-config.js    ← PHASEN_CONFIG, STATUS_CONFIG
└── css/
    └── styles.css
```
→ Benötigt Webserver (GitHub Pages, lokaler Server) wegen CORS-Policy bei `file://`

**Option B: Mehrere HTML-Module** (für Offline-Betrieb ohne Server)
```
Sondagen/
├── index.html          ← Hauptapp
├── handbuch.html       ← Diese Dokumentation als App-Seite
└── data-export.html    ← Hilfswerkzeug für Daten-Migration
```
→ Funktioniert auch mit `file://`, da separate HTML-Dateien selbstständig sind

**Option C: Single-File behalten** (Status quo, empfohlen für einfaches Deployment)
```
Sondagen/
├── index.html          ← komplette App
├── HANDBUCH.md         ← Dokumentation (dieses Dokument)
└── KONTEXT-NAECHSTER-CHAT.md
```
→ Maximum Portabilität: eine Datei, funktioniert überall

### GitHub-Deployment (GitHub Pages)
Bei Option A mit GitHub Pages:
1. Repository anlegen
2. `index.html` + Unterordner hochladen
3. GitHub Pages → Branch `main`, Ordner `/` aktivieren
4. App läuft unter `https://username.github.io/reponame/`
5. localStorage-Daten bleiben im Browser des jeweiligen Nutzers

> **Empfehlung:** Für den aktuellen Einsatz (lokal / einzelner Nutzer) **Option C** beibehalten. Bei mehreren Nutzern oder zentraler Datenhaltung auf Option A + GitHub Pages oder einfachen Node.js-Server wechseln.

---

## Tastenkürzel & Tipps

| Aktion | Kürzel/Tipp |
|---|---|
| Standort öffnen | Klick auf Marker in der Karte |
| Nächster Standort | `[>]`-Button oben |
| Sidebar schliessen | `[← Übersicht]`-Button |
| Multi-Row-Edit | Checkboxen + Bearbeiten aktivieren |
| Schnellsuche Liste | Suchfeld in der Listenansicht |
| Vollsicherung | Einstellungen → Vorlage → JSON exportieren |
| Parameterdatenbank | Einstellungen → Parameterdatenbank-Tab |

---

*Sondagen-App · SBB Infrastruktur · Stand 2026-05-21*
