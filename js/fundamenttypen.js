// FUNDAMENTTYPEN-BIBLIOTHEK
// ============================================================
//
// WER HAENGT AN WEM
// Uebernommen aus HANDBUCH.md, die nach dem Modulschnitt sonst nur noch
// veraltete Wegbeschreibungen enthielt und entfernt wurde. Der Zusammenhang
// spannt vier Module und ist in keiner einzelnen Datei zu sehen — deshalb
// steht er hier, bei der Bibliothek, die alle anderen befragen. Alle
// genannten Namen sind nachgeprueft und vorhanden.
//
//   Gelaendeneigung (Feld bp-neigung)
//        |
//        v
//   Fundamenttyp-Auswahl (Feld bp-ft-familie)
//        |   filtert ueber _ftMatchesNeigung()  -> js/bauprogramm.js
//        |   liest dazu einsatzBedingung aus dem FT-Profil
//        v
//   Fundamenttyp-Tiefe (Feld bp-ft-tiefe)
//        v
//   Karte «Aus Bibliothek»  <- renderBpFtInfo() -> js/init-phasen.js
//        v
//   Statischer Nachweis, nur bei Spezialtypen   -> js/blockcalc-bridge.js
//
//   Parameterdatenbank (sp_ft_geo_overrides)
//        |-> renderParamdbGeo()  Anzeige in den Einstellungen
//        |                       -> js/projekt-einstellungen.js
//        |-> onFtRefTypChange()  fuellt beim Spezialfundament vor (hier)
//        `-> ftUpdateVol()       Volumenberechnung (hier)
//
//   Namensaenderung in der Parameterdatenbank
//        |-> saveFtProfile()      fuehrt die Bibliothek nach (hier)
//        `-> saveAllBauprojekt()  fuehrt alle Zuweisungen nach
//
// Die Spalte Hangneigung der Parameterdatenbank steuert damit mittelbar,
// welche Typen in der Seitenleiste ueberhaupt zur Wahl stehen. Wer dort
// «14-33°» auf «<= 14°» stellt, nimmt den Typ aus der Boeschungsvariante —
// sichtbar wird das erst in der Sidebar, drei Module weiter.
// ============================================================
const FT_PROFIL_KEY    = () => 'sp_ft_profile__'    + _activeId;
const FT_VERSION_KEY   = () => 'sp_ft_version__'    + _activeId;
const DEFAULT_FT_VERSION = 18; // Erhöhen bei Änderungen an Standardtypen

// Bauzeiten vor v16. Sie waren grob geschätzt und lagen um das Drei- bis
// Fünffache über dem, was der Leistungskatalog hergibt — bei einem Kostenblock,
// der zwei Drittel der Summe ausmacht, ist das keine Nuance.
//
// Die Migration ersetzt DESHALB, aber nur wo der Wert noch dem alten
// Vorgabewert entspricht. Wer seine Zahl selbst gesetzt hat, behält sie:
// die App kann einen gepflegten Wert nicht von einem ungeprüften
// unterscheiden — der alte Vorgabewert ist das einzige Merkmal, das sie hat.
const FT_INTERVALL_V15 = {
  ft_std_dp1a_15: 4, ft_std_dp1a:    4, ft_std_dp1a_21: 4, ft_std_dp1b:    4,
  ft_std_dp2a:    4, ft_std_dp2a_24: 5, ft_std_dp2b:    5, ft_std_dg1a_24: 5,
  ft_std_dg1a_27: 5, ft_std_dg1a_30: 6, ft_std_dg2a_25: 5, ft_std_dg3a_26: 5,
  ft_std_dg3a_30: 6, ft_std_dg3a_35: 7, ft_std_hp1a:    5, ft_std_hp1a_29: 5,
  ft_std_hp1b:    6, ft_std_hp2a:    5, ft_std_hp2b:    5,
};
const LP_INTERVALL_V15 = { lp_block: 4, lp_pfahl: 6 };
// v15: laengsAnzahl/laengsDurchmesser bei den Standardtypen entfernt. Die Felder
//      führen die ANKER von Verankerung in Fels und Befestigung an Mauer; ein
//      Standardfundament hat keine. Sie standen dort als «Längsbewehrung» und
//      liefen in Modal, Typenübersicht und Parameterdatenbank mit.

// Standardtypen als Grundauswahl — werden beim ersten Öffnen vorabgefüllt
// Kopf: 600×600 mm × h=1.0 m (gleich für alle DP/HP/DG-Typen)
// Materialdaten gemäss BS19-Zeichnungen SBB 0161.1011.017x – 018x
const DEFAULT_FT_PROFIL = [
  // ── DP1a — Doppelstiel klein (Block 1.0×1.0 m) ──
  { id:'ft_std_dp1a_15', name:'DP1a / 1.5', typ:'standard', fundamentArt:'blockfundament',
    kopfAbmessung:'600×600 mm', kopfHoehe:'1.0', blockAbmessung:'1000×1000 mm',
    anzahlPfaehle:'', pfahlLaenge:'', tiefe:'1.5', grabenBreite:'1.00', ftIntervall:1.0,
    zeichnungsNr:'0161.1011.0171', schraubenArtikelNr:'371.10.07',
    vfkZeichnungsNr:'0161.1011.0190.1',
    beton:'NPK F, C30/37, XC4(CH), XD3(CH), XF2(CH), Dmax 32; Cl 0.1; C3, AAR-Beständig',
    bewehrung:'B500B', bewehrungsstahl:'B500B', betondeckung:'40',
    buegelAnzahl:'2', buegelDurchmesser:'10', buegelSeitenlaenge:'340',
    buegelArtikelNr:'371.06.158', buegelMaterial:'B500B',
    schraubenAnzahl:'4', schraubenDurchmesser:'M30', schraubenLaenge:'250',
    schraubenMaterial:'B550B / tZn',
    einsatzBedingung:'Hangneigung ≤ 14°', nachweisRequired:false, bemerkung:'' },
  { id:'ft_std_dp1a', name:'DP1a / 1.8', typ:'standard', fundamentArt:'blockfundament',
    kopfAbmessung:'600×600 mm', kopfHoehe:'1.0', blockAbmessung:'1000×1000 mm',
    anzahlPfaehle:'', pfahlLaenge:'', tiefe:'1.8', grabenBreite:'1.00', ftIntervall:1.0,
    zeichnungsNr:'0161.1011.0172', schraubenArtikelNr:'371.10.07',
    vfkZeichnungsNr:'0161.1011.0190.1',
    beton:'NPK F, C30/37, XC4(CH), XD3(CH), XF2(CH), Dmax 32; Cl 0.1; C3, AAR-Beständig',
    bewehrung:'B500B', bewehrungsstahl:'B500B', betondeckung:'40',
    buegelAnzahl:'2', buegelDurchmesser:'10', buegelSeitenlaenge:'340',
    buegelArtikelNr:'371.06.158', buegelMaterial:'B500B',
    schraubenAnzahl:'4', schraubenDurchmesser:'M30', schraubenLaenge:'250',
    schraubenMaterial:'B550B / tZn',
    einsatzBedingung:'Hangneigung ≤ 14°', nachweisRequired:false, bemerkung:'' },
  { id:'ft_std_dp1a_21', name:'DP1a / 2.1', typ:'standard', fundamentArt:'blockfundament',
    kopfAbmessung:'600×600 mm', kopfHoehe:'1.0', blockAbmessung:'1000×1000 mm',
    anzahlPfaehle:'', pfahlLaenge:'', tiefe:'2.1', grabenBreite:'1.00', ftIntervall:1.0,
    zeichnungsNr:'0161.1011.0173', schraubenArtikelNr:'371.10.07',
    vfkZeichnungsNr:'0161.1011.0190.1',
    beton:'NPK F, C30/37, XC4(CH), XD3(CH), XF2(CH), Dmax 32; Cl 0.1; C3, AAR-Beständig',
    bewehrung:'B500B', bewehrungsstahl:'B500B', betondeckung:'40',
    buegelAnzahl:'2', buegelDurchmesser:'10', buegelSeitenlaenge:'340',
    buegelArtikelNr:'371.06.158', buegelMaterial:'B500B',
    schraubenAnzahl:'4', schraubenDurchmesser:'M30', schraubenLaenge:'250',
    schraubenMaterial:'B550B / tZn',
    einsatzBedingung:'Hangneigung ≤ 14°', nachweisRequired:false, bemerkung:'' },
  { id:'ft_std_dp1b', name:'DP1a / 2.4', typ:'standard', fundamentArt:'blockfundament',
    kopfAbmessung:'600×600 mm', kopfHoehe:'1.0', blockAbmessung:'1000×1000 mm',
    anzahlPfaehle:'', pfahlLaenge:'', tiefe:'2.4', grabenBreite:'1.20', ftIntervall:1.0,
    zeichnungsNr:'0161.1011.0174', schraubenArtikelNr:'371.10.08',
    vfkZeichnungsNr:'0161.1011.0190.2',
    beton:'NPK F, C30/37, XC4(CH), XD3(CH), XF2(CH), Dmax 32; Cl 0.1; C3, AAR-Beständig',
    bewehrung:'B500B', bewehrungsstahl:'B500B', betondeckung:'40',
    buegelAnzahl:'2', buegelDurchmesser:'10', buegelSeitenlaenge:'340',
    buegelArtikelNr:'371.06.158', buegelMaterial:'B500B',
    schraubenAnzahl:'4', schraubenDurchmesser:'M30', schraubenLaenge:'320',
    schraubenMaterial:'B550B / tZn',
    einsatzBedingung:'Hangneigung 14–33°', nachweisRequired:false, bemerkung:'' },
  // ── DP2a — Doppelstiel mittel (Block 1.2×1.2 m) ──
  { id:'ft_std_dp2a', name:'DP2a / 2.0', typ:'standard', fundamentArt:'blockfundament',
    kopfAbmessung:'600×600 mm', kopfHoehe:'1.0', blockAbmessung:'1200×1200 mm',
    anzahlPfaehle:'', pfahlLaenge:'', tiefe:'2.0', grabenBreite:'1.20', ftIntervall:1.0,
    zeichnungsNr:'0161.1011.0175', schraubenArtikelNr:'371.10.10',
    vfkZeichnungsNr:'0161.1011.0191.1',
    beton:'NPK F, C30/37, XC4(CH), XD3(CH), XF2(CH), Dmax 32; Cl 0.1; C3, AAR-Beständig',
    bewehrung:'B500B', bewehrungsstahl:'B500B', betondeckung:'40',
    buegelAnzahl:'2', buegelDurchmesser:'12', buegelSeitenlaenge:'340',
    buegelArtikelNr:'371.06.159', buegelMaterial:'B500B',
    schraubenAnzahl:'4', schraubenDurchmesser:'M36', schraubenLaenge:'250',
    schraubenMaterial:'B550B / tZn',
    einsatzBedingung:'Hangneigung ≤ 14°', nachweisRequired:false, bemerkung:'' },
  { id:'ft_std_dp2a_24', name:'DP2a / 2.4', typ:'standard', fundamentArt:'blockfundament',
    kopfAbmessung:'600×600 mm', kopfHoehe:'1.0', blockAbmessung:'1200×1200 mm',
    anzahlPfaehle:'', pfahlLaenge:'', tiefe:'2.4', grabenBreite:'1.20', ftIntervall:1.0,
    zeichnungsNr:'0161.1011.0176', schraubenArtikelNr:'371.10.10',
    vfkZeichnungsNr:'0161.1011.0191.1',
    beton:'NPK F, C30/37, XC4(CH), XD3(CH), XF2(CH), Dmax 32; Cl 0.1; C3, AAR-Beständig',
    bewehrung:'B500B', bewehrungsstahl:'B500B', betondeckung:'40',
    buegelAnzahl:'2', buegelDurchmesser:'12', buegelSeitenlaenge:'340',
    buegelArtikelNr:'371.06.159', buegelMaterial:'B500B',
    schraubenAnzahl:'4', schraubenDurchmesser:'M36', schraubenLaenge:'250',
    schraubenMaterial:'B550B / tZn',
    einsatzBedingung:'Hangneigung ≤ 14°', nachweisRequired:false, bemerkung:'' },
  { id:'ft_std_dp2b', name:'DP2a / 2.7', typ:'standard', fundamentArt:'blockfundament',
    kopfAbmessung:'600×600 mm', kopfHoehe:'1.0', blockAbmessung:'1200×1200 mm',
    anzahlPfaehle:'', pfahlLaenge:'', tiefe:'2.7', grabenBreite:'1.30', ftIntervall:1.5,
    zeichnungsNr:'0161.1011.0177', schraubenArtikelNr:'371.10.11',
    vfkZeichnungsNr:'0161.1011.0191.2',
    beton:'NPK F, C30/37, XC4(CH), XD3(CH), XF2(CH), Dmax 32; Cl 0.1; C3, AAR-Beständig',
    bewehrung:'B500B', bewehrungsstahl:'B500B', betondeckung:'40',
    buegelAnzahl:'2', buegelDurchmesser:'12', buegelSeitenlaenge:'340',
    buegelArtikelNr:'371.06.159', buegelMaterial:'B500B',
    schraubenAnzahl:'4', schraubenDurchmesser:'M36', schraubenLaenge:'320',
    schraubenMaterial:'B550B / tZn',
    einsatzBedingung:'Hangneigung 14–33°', nachweisRequired:false, bemerkung:'' },
  // ── DG1a — Gittermast klein (Block 1.3×1.3 m) ──
  { id:'ft_std_dg1a_24', name:'DG1a / 2.4', typ:'standard', fundamentArt:'blockfundament',
    kopfAbmessung:'600×600 mm', kopfHoehe:'1.0', blockAbmessung:'1300×1300 mm',
    anzahlPfaehle:'', pfahlLaenge:'', tiefe:'2.4', grabenBreite:'1.30', ftIntervall:1.5,
    zeichnungsNr:'0161.1011.0178', schraubenArtikelNr:'371.10.11',
    beton:'NPK F, C30/37, XC4(CH), XD3(CH), XF2(CH), Dmax 32; Cl 0.1; C3, AAR-Beständig',
    bewehrung:'B500B', bewehrungsstahl:'B500B', betondeckung:'40',
    buegelAnzahl:'2', buegelDurchmesser:'12', buegelSeitenlaenge:'500',
    buegelArtikelNr:'371.06.160', buegelMaterial:'B500B',
    schraubenAnzahl:'4', schraubenDurchmesser:'M36', schraubenLaenge:'320',
    schraubenMaterial:'B550B / tZn',
    einsatzBedingung:'Gittermast, Hangneigung ≤ 14°', nachweisRequired:false, bemerkung:'' },
  { id:'ft_std_dg1a_27', name:'DG1a / 2.7', typ:'standard', fundamentArt:'blockfundament',
    kopfAbmessung:'600×600 mm', kopfHoehe:'1.0', blockAbmessung:'1300×1300 mm',
    anzahlPfaehle:'', pfahlLaenge:'', tiefe:'2.7', grabenBreite:'1.30', ftIntervall:1.5,
    zeichnungsNr:'0161.1011.0179', schraubenArtikelNr:'371.10.11',
    beton:'NPK F, C30/37, XC4(CH), XD3(CH), XF2(CH), Dmax 32; Cl 0.1; C3, AAR-Beständig',
    bewehrung:'B500B', bewehrungsstahl:'B500B', betondeckung:'40',
    buegelAnzahl:'2', buegelDurchmesser:'12', buegelSeitenlaenge:'500',
    buegelArtikelNr:'371.06.160', buegelMaterial:'B500B',
    schraubenAnzahl:'4', schraubenDurchmesser:'M36', schraubenLaenge:'320',
    schraubenMaterial:'B550B / tZn',
    einsatzBedingung:'Gittermast, Hangneigung ≤ 14°', nachweisRequired:false, bemerkung:'' },
  { id:'ft_std_dg1a_30', name:'DG1a / 3.0', typ:'standard', fundamentArt:'blockfundament',
    kopfAbmessung:'600×600 mm', kopfHoehe:'1.0', blockAbmessung:'1300×1300 mm',
    anzahlPfaehle:'', pfahlLaenge:'', tiefe:'3.0', grabenBreite:'1.30', ftIntervall:1.5,
    zeichnungsNr:'0161.1011.0180', schraubenArtikelNr:'371.10.12',
    beton:'NPK F, C30/37, XC4(CH), XD3(CH), XF2(CH), Dmax 32; Cl 0.1; C3, AAR-Beständig',
    bewehrung:'B500B', bewehrungsstahl:'B500B', betondeckung:'40',
    buegelAnzahl:'2', buegelDurchmesser:'12', buegelSeitenlaenge:'500',
    buegelArtikelNr:'371.06.160', buegelMaterial:'B500B',
    schraubenAnzahl:'4', schraubenDurchmesser:'M36', schraubenLaenge:'400',
    schraubenMaterial:'B550B / tZn',
    einsatzBedingung:'Gittermast, Hangneigung 14–33°', nachweisRequired:false, bemerkung:'' },
  // ── DG2a — Gittermast mittel (Block 1.2×1.2 m) ──
  { id:'ft_std_dg2a_25', name:'DG2a / 2.5', typ:'standard', fundamentArt:'blockfundament',
    kopfAbmessung:'600×600 mm', kopfHoehe:'1.0', blockAbmessung:'1200×1200 mm',
    anzahlPfaehle:'', pfahlLaenge:'', tiefe:'2.5', grabenBreite:'1.20', ftIntervall:1.5,
    zeichnungsNr:'0161.1011.0181', schraubenArtikelNr:'371.10.11',
    beton:'NPK F, C30/37, XC4(CH), XD3(CH), XF2(CH), Dmax 32; Cl 0.1; C3, AAR-Beständig',
    bewehrung:'B500B', bewehrungsstahl:'B500B', betondeckung:'40',
    buegelAnzahl:'2', buegelDurchmesser:'12', buegelSeitenlaenge:'260×750',
    buegelArtikelNr:'371.06.162', buegelMaterial:'B500B',
    schraubenAnzahl:'4', schraubenDurchmesser:'M36', schraubenLaenge:'320',
    schraubenMaterial:'B550B / tZn',
    einsatzBedingung:'Gittermast mittel', nachweisRequired:false, bemerkung:'' },
  // ── DG3a — Gittermast gross (Block 1.3×1.6 m) ──
  // Der einzige Standardtyp mit RECHTECKIGEM Querschnitt. Er ist der Grund,
  // weshalb «grabenBreite» auch ein Paar aufnehmen kann.
  { id:'ft_std_dg3a_26', name:'DG3a / 2.6', typ:'standard', fundamentArt:'blockfundament',
    kopfAbmessung:'600×600 mm', kopfHoehe:'1.0', blockAbmessung:'1300×1600 mm',
    anzahlPfaehle:'', pfahlLaenge:'', tiefe:'2.6', grabenBreite:'1.30 × 1.60', ftIntervall:1.5,
    zeichnungsNr:'0161.1011.0182', schraubenArtikelNr:'371.10.11',
    beton:'NPK F, C30/37, XC4(CH), XD3(CH), XF2(CH), Dmax 32; Cl 0.1; C3, AAR-Beständig',
    bewehrung:'B500B', bewehrungsstahl:'B500B', betondeckung:'40',
    buegelAnzahl:'2', buegelDurchmesser:'12', buegelSeitenlaenge:'260×750',
    buegelArtikelNr:'371.06.162', buegelMaterial:'B500B',
    schraubenAnzahl:'4', schraubenDurchmesser:'M36', schraubenLaenge:'320',
    schraubenMaterial:'B550B / tZn',
    einsatzBedingung:'Gittermast gross, Hangneigung ≤ 14°', nachweisRequired:false, bemerkung:'' },
  { id:'ft_std_dg3a_30', name:'DG3a / 3.0', typ:'standard', fundamentArt:'blockfundament',
    kopfAbmessung:'600×600 mm', kopfHoehe:'1.0', blockAbmessung:'1300×1600 mm',
    anzahlPfaehle:'', pfahlLaenge:'', tiefe:'3.0', grabenBreite:'1.30 × 1.60', ftIntervall:2.0,
    zeichnungsNr:'0161.1011.0183', schraubenArtikelNr:'371.10.12',
    beton:'NPK F, C30/37, XC4(CH), XD3(CH), XF2(CH), Dmax 32; Cl 0.1; C3, AAR-Beständig',
    bewehrung:'B500B', bewehrungsstahl:'B500B', betondeckung:'40',
    buegelAnzahl:'2', buegelDurchmesser:'12', buegelSeitenlaenge:'260×750',
    buegelArtikelNr:'371.06.162', buegelMaterial:'B500B',
    schraubenAnzahl:'4', schraubenDurchmesser:'M36', schraubenLaenge:'400',
    schraubenMaterial:'B550B / tZn',
    einsatzBedingung:'Gittermast gross, Hangneigung ≤ 14°', nachweisRequired:false, bemerkung:'' },
  { id:'ft_std_dg3a_35', name:'DG3a / 3.5', typ:'standard', fundamentArt:'blockfundament',
    kopfAbmessung:'600×600 mm', kopfHoehe:'1.0', blockAbmessung:'1300×1600 mm',
    anzahlPfaehle:'', pfahlLaenge:'', tiefe:'3.5', grabenBreite:'1.30 × 1.60', ftIntervall:3.0,
    zeichnungsNr:'0161.1011.0184', schraubenArtikelNr:'371.10.12',
    beton:'NPK F, C30/37, XC4(CH), XD3(CH), XF2(CH), Dmax 32; Cl 0.1; C3, AAR-Beständig',
    bewehrung:'B500B', bewehrungsstahl:'B500B', betondeckung:'40',
    buegelAnzahl:'2', buegelDurchmesser:'12', buegelSeitenlaenge:'260×750',
    buegelArtikelNr:'371.06.162', buegelMaterial:'B500B',
    schraubenAnzahl:'4', schraubenDurchmesser:'M36', schraubenLaenge:'400',
    schraubenMaterial:'B550B / tZn',
    einsatzBedingung:'Gittermast gross, Hangneigung 14–33°', nachweisRequired:false, bemerkung:'' },
  // ── HP1a — Hoher Pied gross (Block 1.3×1.3 m) ──
  { id:'ft_std_hp1a', name:'HP1a / 2.4', typ:'standard', fundamentArt:'blockfundament',
    kopfAbmessung:'600×600 mm', kopfHoehe:'1.0', blockAbmessung:'1300×1300 mm',
    anzahlPfaehle:'', pfahlLaenge:'', tiefe:'2.4', grabenBreite:'1.30', ftIntervall:1.5,
    zeichnungsNr:'0161.1011.0185', schraubenArtikelNr:'371.10.11',
    vfkZeichnungsNr:'0161.1011.0192.1',
    beton:'NPK F, C30/37, XC4(CH), XD3(CH), XF2(CH), Dmax 32; Cl 0.1; C3, AAR-Beständig',
    bewehrung:'B500B', bewehrungsstahl:'B500B', betondeckung:'40',
    buegelAnzahl:'2', buegelDurchmesser:'12', buegelSeitenlaenge:'400',
    buegelArtikelNr:'371.06.161', buegelMaterial:'B500B',
    schraubenAnzahl:'6', schraubenDurchmesser:'M36', schraubenLaenge:'320',
    schraubenMaterial:'B550B / tZn',
    einsatzBedingung:'Hangneigung ≤ 14°', nachweisRequired:false, bemerkung:'' },
  { id:'ft_std_hp1a_29', name:'HP1a / 2.9', typ:'standard', fundamentArt:'blockfundament',
    kopfAbmessung:'600×600 mm', kopfHoehe:'1.0', blockAbmessung:'1300×1300 mm',
    anzahlPfaehle:'', pfahlLaenge:'', tiefe:'2.9', grabenBreite:'1.30', ftIntervall:1.5,
    zeichnungsNr:'0161.1011.0186', schraubenArtikelNr:'371.10.11',
    vfkZeichnungsNr:'0161.1011.0192.1',
    beton:'NPK F, C30/37, XC4(CH), XD3(CH), XF2(CH), Dmax 32; Cl 0.1; C3, AAR-Beständig',
    bewehrung:'B500B', bewehrungsstahl:'B500B', betondeckung:'40',
    buegelAnzahl:'2', buegelDurchmesser:'12', buegelSeitenlaenge:'400',
    buegelArtikelNr:'371.06.161', buegelMaterial:'B500B',
    schraubenAnzahl:'6', schraubenDurchmesser:'M36', schraubenLaenge:'320',
    schraubenMaterial:'B550B / tZn',
    einsatzBedingung:'Hangneigung ≤ 14°', nachweisRequired:false, bemerkung:'' },
  { id:'ft_std_hp1b', name:'HP1a / 3.2', typ:'standard', fundamentArt:'blockfundament',
    kopfAbmessung:'600×600 mm', kopfHoehe:'1.0', blockAbmessung:'1300×1300 mm',
    anzahlPfaehle:'', pfahlLaenge:'', tiefe:'3.2', grabenBreite:'1.30', ftIntervall:1.5,
    zeichnungsNr:'0161.1011.0187', schraubenArtikelNr:'371.10.12',
    vfkZeichnungsNr:'0161.1011.0192.2',
    beton:'NPK F, C30/37, XC4(CH), XD3(CH), XF2(CH), Dmax 32; Cl 0.1; C3, AAR-Beständig',
    bewehrung:'B500B', bewehrungsstahl:'B500B', betondeckung:'40',
    buegelAnzahl:'2', buegelDurchmesser:'12', buegelSeitenlaenge:'400',
    buegelArtikelNr:'371.06.161', buegelMaterial:'B500B',
    schraubenAnzahl:'6', schraubenDurchmesser:'M36', schraubenLaenge:'400',
    schraubenMaterial:'B550B / tZn',
    einsatzBedingung:'Hangneigung 14–33°', nachweisRequired:false, bemerkung:'' },
  // ── HP2a — Hoher Pied gross (Block 1.3×1.3 m) ──
  { id:'ft_std_hp2a', name:'HP2a / 2.4', typ:'standard', fundamentArt:'blockfundament',
    kopfAbmessung:'600×600 mm', kopfHoehe:'1.0', blockAbmessung:'1300×1300 mm',
    anzahlPfaehle:'', pfahlLaenge:'', tiefe:'2.4', grabenBreite:'1.30', ftIntervall:1.5,
    zeichnungsNr:'0161.1011.0188', schraubenArtikelNr:'371.10.10',
    vfkZeichnungsNr:'0161.1011.0193.1',
    beton:'NPK F, C30/37, XC4(CH), XD3(CH), XF2(CH), Dmax 32; Cl 0.1; C3, AAR-Beständig',
    bewehrung:'B500B', bewehrungsstahl:'B500B', betondeckung:'40',
    buegelAnzahl:'2', buegelDurchmesser:'12', buegelSeitenlaenge:'400',
    buegelArtikelNr:'371.06.161', buegelMaterial:'B500B',
    schraubenAnzahl:'6', schraubenDurchmesser:'M36', schraubenLaenge:'250',
    schraubenMaterial:'B550B / tZn',
    einsatzBedingung:'Hangneigung ≤ 14°', nachweisRequired:false, bemerkung:'' },
  { id:'ft_std_hp2b', name:'HP2a / 2.7', typ:'standard', fundamentArt:'blockfundament',
    kopfAbmessung:'600×600 mm', kopfHoehe:'1.0', blockAbmessung:'1300×1300 mm',
    anzahlPfaehle:'', pfahlLaenge:'', tiefe:'2.7', grabenBreite:'1.30', ftIntervall:1.5,
    zeichnungsNr:'0161.1011.0189', schraubenArtikelNr:'371.10.11',
    vfkZeichnungsNr:'0161.1011.0193.2',
    beton:'NPK F, C30/37, XC4(CH), XD3(CH), XF2(CH), Dmax 32; Cl 0.1; C3, AAR-Beständig',
    bewehrung:'B500B', bewehrungsstahl:'B500B', betondeckung:'40',
    buegelAnzahl:'2', buegelDurchmesser:'12', buegelSeitenlaenge:'400',
    buegelArtikelNr:'371.06.161', buegelMaterial:'B500B',
    schraubenAnzahl:'6', schraubenDurchmesser:'M36', schraubenLaenge:'320',
    schraubenMaterial:'B550B / tZn',
    einsatzBedingung:'Hangneigung 14–33°', nachweisRequired:false, bemerkung:'' },
  { id:'ft_std_pfahl', name:'Pfahlfundament', typ:'spezial', fundamentArt:'mehrpfahl',
    kopfAbmessung:'', blockAbmessung:'', anzahlPfaehle:'4', pfahlLaenge:'6.0', tiefe:'',
    leistungsprofilId:'lp_pfahl',
    einsatzBedingung:'Schlechter Baugrund / hohe Lasten', nachweisRequired:true, bemerkung:'' },
  { id:'ft_std_exz', name:'Blockfundament exzentrisch', typ:'spezial', fundamentArt:'blockfundament',
    kopfAbmessung:'', blockAbmessung:'', anzahlPfaehle:'', pfahlLaenge:'', tiefe:'',
    leistungsprofilId:'lp_block',
    einsatzBedingung:'Exzentrische Lasteinleitung / beengte Verhältnisse', nachweisRequired:true, bemerkung:'' },
  { id:'ft_std_kunstbau', name:'Mast auf Kunstbau', typ:'spezial', fundamentArt:'bauwerk',
    kopfAbmessung:'', blockAbmessung:'', anzahlPfaehle:'', pfahlLaenge:'', tiefe:'',
    leistungsprofilId:'lp_bau',
    einsatzBedingung:'Fundament auf Brücke, Unterführung oder bestehendem Bauwerk', nachweisRequired:true, bemerkung:'' },
  { id:'ft_std_mauer', name:'Mast an Mauer', typ:'spezial', fundamentArt:'mauer',
    kopfAbmessung:'', blockAbmessung:'', anzahlPfaehle:'', pfahlLaenge:'', tiefe:'',
    leistungsprofilId:'lp_mauer',
    einsatzBedingung:'Verankerung an bestehender Stützmauer', nachweisRequired:true, bemerkung:'' },
  { id:'ft_std_fels', name:'Felsiger Baugrund', typ:'spezial', fundamentArt:'fels',
    kopfAbmessung:'', blockAbmessung:'', anzahlPfaehle:'', pfahlLaenge:'', tiefe:'',
    leistungsprofilId:'lp_fels',
    einsatzBedingung:'Anstehender Fels < 1.0 m Tiefe', nachweisRequired:true, bemerkung:'' },
  { id:'ft_std_brunnen', name:'Brunnenring', typ:'spezial', fundamentArt:'sonstige',
    kopfAbmessung:'', blockAbmessung:'', anzahlPfaehle:'', pfahlLaenge:'', tiefe:'',
    leistungsprofilId:'lp_sonst',
    einsatzBedingung:'Weicher Untergrund / hoher Grundwasserstand', nachweisRequired:true, bemerkung:'' },
  { id:'ft_std_block_angepasst', name:'Blockfundament (angepasst)', typ:'spezial', fundamentArt:'blockfundament',
    kopfAbmessung:'', kopfB:'', kopfL:'', kopfHoehe:'', blockAbmessung:'', blockB:'', blockL:'',
    anzahlPfaehle:'', pfahlLaenge:'', tiefe:'',
    leistungsprofilId:'lp_block',
    einsatzBedingung:'Baugrund erfüllt Standardanforderungen nicht — individuelle Parameteranpassung',
    nachweisRequired:true,
    bemerkung:'Einzusetzen wenn Bodenkennwerte ungenügend oder abweichende Lastfälle vorliegen. Alle Parameter frei definierbar.' },
];

/** Füllt die Bibliothek mit Standardtypen vor; migriert bei Versionswechsel */
function seedDefaultFtProfile() {
  const existing      = loadFtProfile();
  const storedVersion = +(store.getItem(FT_VERSION_KEY()) || 0);
  if (existing.length > 0 && storedVersion >= DEFAULT_FT_VERSION) {
    // Einmal je Projekt: Überschreibungen der Parameterdatenbank auflegen.
    // Deckt Eintraege ab, die vor dem Durchschreiben entstanden sind.
    ftParamdbAufBibliothekAnwenden();
    return;
  }

  const defaultIds = new Set(DEFAULT_FT_PROFIL.map(t => t.id));
  const keepUser = existing.filter(t => !defaultIds.has(t.id));

  // Bei Versionswechsel: Materialfelder IMMER aus neuem Default übernehmen.
  // Nur Leistungs-/Intervall-Anpassungen des Users bewahren.
  const merged = DEFAULT_FT_PROFIL.map(t => {
    const old = existing.find(e => e.id === t.id);
    if (!old) return { ...t };
    return {
      ...t,
      // Eigener Wert bleibt; der alte Vorgabewert weicht dem neuen.
      ftIntervall:           (old.ftIntervall != null && +old.ftIntervall !== FT_INTERVALL_V15[t.id])
                               ? old.ftIntervall : t.ftIntervall,
      ftLeistungen:          old.ftLeistungen  ?? null,
      leistungsprofilId:     ('leistungsprofilId' in old) ? old.leistungsprofilId : (t.leistungsprofilId ?? null),
      fixBaupaketzuweisungId:old.fixBaupaketzuweisungId || null,
    };
  });

  saveFtProfile([...merged, ...keepUser]);

  // Dieselbe Korrektur für die Leistungsprofile. seedLeistungsprofile()
  // ergänzt nur Fehlendes und fasst bestehende Profile nie an — ohne diesen
  // Schritt behielte jedes bestehende Projekt die groben Bauzeiten.
  const lps = loadLeistungsprofile();
  if (lps.length) {
    let lpGeaendert = false;
    lps.forEach(p => {
      const vorgabe = DEFAULT_LEISTUNGSPROFILE.find(d => d.id === p.id);
      if (vorgabe && +p.ftIntervall === LP_INTERVALL_V15[p.id]) {
        p.ftIntervall = vorgabe.ftIntervall;
        lpGeaendert = true;
      }
    });
    if (lpGeaendert) saveLeistungsprofile(lps);
  }

  store.setItem(FT_VERSION_KEY(), String(DEFAULT_FT_VERSION));
  // Die Standardtypen wurden gerade aus den Vorgaben neu gesetzt — die
  // Anpassungen der Parameterdatenbank muessen erneut darauf.
  ftParamdbAufBibliothekAnwenden(true);

  // Migration: bestehende bpData.fundtyp-Namen auf neue Schreibweise aktualisieren
  // (z.B. "DP2a / 2.00" → "DP2a / 2.0")
  const nameMap = {};
  DEFAULT_FT_PROFIL.forEach(t => {
    // Alias für zweistellige Dezimalschreibweise aufbauen
    const m = t.name.match(/^(.+\/\s*)(\d+\.\d)$/);
    if (m) nameMap[m[1].replace(/\s+/g, '') + '/ ' + parseFloat(m[2]).toFixed(2)] = t.name;
    nameMap[t.name] = t.name;
  });
  const allBp = loadAllBauprojekt();
  let migChanged = false;
  Object.values(allBp).forEach(bp => {
    const mapped = bp.fundtyp && nameMap[bp.fundtyp];
    if (mapped && mapped !== bp.fundtyp) { bp.fundtyp = mapped; migChanged = true; }
  });
  if (migChanged) saveAllBauprojekt(allBp);
}

/** Setzt alle Standard-Materialfelder auf aktuelle Defaults zurück (behält Leistungsanpassungen) */
async function resetFtMaterialDefaults() {
  if (!await ui.confirm('Alle Materialdaten der Standardfundamente auf aktuelle Standardwerte zurücksetzen?\n\nLeistungsprofile und Intervalle bleiben erhalten.')) return;
  store.removeItem(FT_VERSION_KEY());
  seedDefaultFtProfile();
  openFtDatenbank();
  // Bestehende Sidebar-Infokarte aktualisieren
  if (typeof renderBpFtInfo === 'function') renderBpFtInfo();
  showToast('FT-Materialdaten zurückgesetzt');
}
const FT_ZUWEISUNG_KEY = () => 'sp_ft_zuweisung__' + _activeId;

function loadFtProfile()         { try { return jsonParse(store.getItem(FT_PROFIL_KEY()))    || []; } catch { return []; } }
function saveFtProfile(list)     { store.setItem(FT_PROFIL_KEY(),    JSON.stringify(list)); }

function toggleFtSelect(ftId) {
  if (_ftSelected.has(ftId)) _ftSelected.delete(ftId);
  else _ftSelected.add(ftId);
  renderFundtypProfilGrid();
}

// Bearbeiten-Button auf Spezial-Kachel: Einzel- oder Sammelbearbeitung je nach Selektion
function _openFtOrBulk(clickedId) {
  if (_ftSelected.size > 1 && _ftSelected.has(clickedId)) {
    openFundtypProfilModal(clickedId, null, [..._ftSelected]);
  } else {
    openFundtypProfilModal(clickedId);
  }
}

function openGlobalFtModal() {
  const sel = _ftSelected.size;
  const info = document.getElementById('ft-global-scope-info');
  if (info) info.textContent = sel > 0
    ? `Betrifft ${sel} ausgewählte Typen (Checkboxen aktiviert).`
    : 'Betrifft alle Standardtypen (keine Auswahl aktiv).';
  document.getElementById('ft-global-field').value = '';
  document.getElementById('ft-global-value').value = '';
  document.getElementById('ft-global-preview').style.display = 'none';
  document.getElementById('ft-global-modal').style.display = 'flex';
}

function closeGlobalFtModal() {
  document.getElementById('ft-global-modal').style.display = 'none';
}

function updateGlobalFtPreview() {
  const field = document.getElementById('ft-global-field').value;
  const val   = document.getElementById('ft-global-value').value;
  const prev  = document.getElementById('ft-global-preview');
  const txt   = document.getElementById('ft-global-preview-text');
  if (field && val) {
    prev.style.display = '';
    txt.textContent = `${field} = "${val}"`;
  } else {
    prev.style.display = 'none';
  }
}

function applyGlobalFtChange() {
  const field = document.getElementById('ft-global-field').value;
  const val   = document.getElementById('ft-global-value').value.trim();
  if (!field) { ui.toast('Bitte ein Feld wählen.', 'fehler'); return; }
  if (!val)   { ui.toast('Bitte einen Wert eingeben.', 'fehler'); return; }

  const list = loadFtProfile();
  const targetIds = _ftSelected.size > 0 ? [..._ftSelected] : null;
  let count = 0;
  list.forEach(t => {
    if (targetIds ? targetIds.includes(t.id) : t.typ === 'standard') {
      t[field] = val;
      count++;
    }
  });
  saveFtProfile(list);
  closeGlobalFtModal();
  renderFundtypProfilGrid();
  ui.toast(`${field} wurde bei ${count} Typ${count !== 1 ? 'en' : ''} aktualisiert.`, 'erfolg');
}

function setFtBaupaket(ftId, baupaketzuweisungId) {
  const list = loadFtProfile();
  const idsToUpdate = (_ftSelected.size > 1 && _ftSelected.has(ftId))
    ? [..._ftSelected] : [ftId];
  idsToUpdate.forEach(id => {
    const ft = list.find(t => t.id === id);
    if (ft) ft.fixBaupaketzuweisungId = baupaketzuweisungId || null;
  });
  saveFtProfile(list);
  renderFundtypProfilGrid();
}

function selectAllStdFt() {
  loadFtProfile().filter(t => t.typ === 'standard').forEach(t => _ftSelected.add(t.id));
  renderFundtypProfilGrid();
}

function clearFtSelection() {
  _ftSelected.clear();
  renderFundtypProfilGrid();
}

function applyFtLeistungsprofilBulk() {
  const profilId = document.getElementById('ft-std-bulk-lp')?.value;
  if (!profilId) { ui.toast('Bitte ein Leistungsprofil wählen.', 'fehler'); return; }
  const list = loadFtProfile();
  const ids  = [..._ftSelected];
  let count  = 0;
  list.forEach(t => {
    if (ids.includes(t.id)) { t.leistungsprofilId = profilId; count++; }
  });
  saveFtProfile(list);
  _ftSelected.clear();
  renderFundtypProfilGrid();
  renderLpGrid();
  const lp  = loadLeistungsprofile().find(p => p.id === profilId);
  ui.toast(`Leistungsprofil «${lp?.name || profilId}» wurde ${count} Typ${count !== 1 ? 'en' : ''} zugewiesen.`, 'erfolg');
}

// Setzt lp_block als Voreinstellung für alle Standardfundamente ohne zugewiesenes Leistungsprofil
function _initStdFtDefaultLeistungsprofil() {
  const list = loadFtProfile();
  let changed = false;
  list.forEach(t => {
    if (t.typ === 'standard' && !t.leistungsprofilId) {
      t.leistungsprofilId = 'lp_block';
      changed = true;
    }
  });
  if (changed) saveFtProfile(list);
}

function loadFtZuweisungen()     { try { return jsonParse(store.getItem(FT_ZUWEISUNG_KEY())) || {}; } catch { return {}; } }
function saveFtZuweisungen(map)  { store.setItem(FT_ZUWEISUNG_KEY(), JSON.stringify(map)); }

// ── Schichtleistungs-Profile (Bauart-Vorlagen) ────────────────
const LP_KEY = () => 'sp_leistungsprofile__' + _activeId;
function loadLeistungsprofile() {
  try { return jsonParse(store.getItem(LP_KEY())) || []; } catch { return []; }
}
function saveLeistungsprofile(list) { store.setItem(LP_KEY(), JSON.stringify(list)); }

// Standardprofile je Bauart sicherstellen — fehlende Profile werden nachträglich ergänzt
// Bauzeit je Fundament, OHNE Ruestzeit — die steht als Abzug fuer Installation
// und Anfahrt in den Projekteinstellungen und wird von der Intervalldauer
// abgezogen, bevor hier geteilt wird.
//
// Block und Pfahl sind aus dem Leistungskatalog hergeleitet (Abschnitt 700):
// bei fester Ruestzeit von 0.5 h passt die Bauzeit ueber alle sechs
// Intervalldauern zusammen. Die uebrigen Bauarten fuehrt der Katalog nicht —
// ihre Werte bleiben Schaetzungen und sind als solche zu behandeln.
const DEFAULT_LEISTUNGSPROFILE = [
  { id:'lp_block', name:'Blockfundament',        bauart:'blockfundament', ftIntervall:1.0, ftLeistungen:null },
  { id:'lp_pfahl', name:'Pfahlfundament',         bauart:'mehrpfahl',      ftIntervall:4.0, ftLeistungen:null },
  { id:'lp_mono',  name:'Monopfahl',              bauart:'monopfahl',      ftIntervall:8, ftLeistungen:null },
  { id:'lp_fels',  name:'Verankerung in Fels',    bauart:'fels',           ftIntervall:8, ftLeistungen:null },
  { id:'lp_mauer', name:'Befestigung an Mauer',   bauart:'mauer',          ftIntervall:6, ftLeistungen:null },
  { id:'lp_bau',   name:'Befestigung an Bauwerk', bauart:'bauwerk',        ftIntervall:6, ftLeistungen:null },
  { id:'lp_sonst', name:'Sonstige',               bauart:'sonstige',       ftIntervall:6, ftLeistungen:null },
];
function seedLeistungsprofile() {
  const existing    = loadLeistungsprofile();
  const existingIds = new Set(existing.map(p => p.id));
  const missing     = DEFAULT_LEISTUNGSPROFILE.filter(d => !existingIds.has(d.id));
  if (missing.length) saveLeistungsprofile([...existing, ...missing]);
}

let _ftEditId = null;

// Labels für Fundamentarten (gemeinsam genutzt)
const ART_LABEL = {
  blockfundament: 'Blockfundament', mehrpfahl: 'Mehrpfahlfundament', monopfahl: 'Monopfahlfundament',
  mauer: 'Befestigung an Mauer',   bauwerk: 'Befestigung an Bauwerk',
  fels: 'Verankerung in Fels',     sonstige: 'Sonstige',
};

// Wandelt "600×600 mm" → "0.60 × 0.60 m"; passiert "—" unverändert
function _ftLabel(t) {
  if (!t) return '';
  return t.name + (t.typ !== 'standard' && t.referenzTyp ? ' (' + t.referenzTyp + ')' : '');
}

function mmAbmessungToM(str) {
  if (!str || str === '—') return str;
  const bare = str.replace(/\s*mm\s*$/i, '').trim();
  return bare.split(/[×x]/).map(v => (parseFloat(v.trim()) / 1000).toFixed(2)).join(' × ') + ' m';
}

// Ausführungsdauer auf der Kachel. Sie ist der Taktgeber für Paketdauer und
// Kapazitätsrechnung, war aber in beiden Modalen einstellbar und auf der Kachel
// nirgends zu sehen. Ein gesetztes Leistungsprofil hat Vorrang — gleiche
// Rangfolge wie in openFtLeistungROModal.
function _ftDauerZeile(t, lp) {
  const neubau  = lp?.ftIntervall || t.ftIntervall;
  const abbruch = t.ftIntervallAbbruch;
  if (!neubau && !abbruch) return '';
  const teile = [
    neubau  ? `Neubau ${neubau} h`   : '',
    abbruch ? `Abbruch ${abbruch} h` : '',
  ].filter(Boolean).join(' · ');
  const quelle = (lp?.ftIntervall && neubau === lp.ftIntervall) ? ` — aus Leistungsprofil «${lp.name}»` : '';
  return `<div title="Ausführungsdauer je Fundament${quelle}" style="font-size:10px;color:#6b7280;margin-bottom:5px;"><span style="color:#9ca3af;font-weight:600;">Ausf.-Dauer</span> ${teile}</div>`;
}

function renderFundtypProfilGrid() {
  const stdGrid  = document.getElementById('fundtyp-std-grid');
  const spezGrid = document.getElementById('fundtyp-spez-grid');
  if (!stdGrid || !spezGrid) return;

  const typen       = loadFtProfile();
  const zuweisungen = loadFtZuweisungen();
  const statik      = loadStatikBerichte();
  const profiles    = loadLeistungsprofile();

  const std  = typen.filter(t => t.typ === 'standard');
  const spez = typen.filter(t => t.typ !== 'standard');

  // Filter-Buttons optisch aktualisieren
  ['alle','zugeordnet'].forEach(f => {
    const btn = document.getElementById(`ft-f-${f}`);
    if (!btn) return;
    const active = _ftFilter === f;
    btn.style.background  = active ? '#1a3a5c' : 'white';
    btn.style.color       = active ? 'white'   : '#6b7280';
    btn.style.borderColor = active ? '#1a3a5c' : '#e5e7eb';
  });

  // ── Standard-Kacheln (schreibgeschützt, kompakt) — gruppiert nach Hangneigung ──
  // Gruppen: Flach (≤14°) und Böschung (14–33°)
  const stdAll    = std;
  const stdFlach  = stdAll.filter(t => !t.einsatzBedingung?.includes('14–33'));
  const stdBoesch = stdAll.filter(t =>  t.einsatzBedingung?.includes('14–33'));

  const renderStdKacheln = list => {
    const visible = _ftFilter === 'zugeordnet'
      ? list.filter(t => Object.values(zuweisungen).filter(id => id === t.id).length > 0)
      : list;
    if (!visible.length) return '';
    return visible.map(t => {
    const count        = Object.values(zuweisungen).filter(id => id === t.id).length;
    const missingBlock = !t.blockAbmessung || t.blockAbmessung === '—';
    const ftSelStyle   = _ftSelected.has(t.id) ? 'outline:2px solid #3b82f6;outline-offset:-2px;background:#eff6ff;' : '';
    const lp           = profiles.find(p => p.id === t.leistungsprofilId);
    const lpChip       = lp
      ? `<div style="margin-bottom:6px;"><span style="font-size:10px;background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;padding:2px 7px;border-radius:4px;">${lp.name}</span></div>`
      : `<div style="margin-bottom:6px;"><span style="font-size:10px;color:#9ca3af;padding:2px 0;border-radius:4px;">Kein Leistungsprofil</span></div>`;
    return `<div class="card" style="${ftSelStyle}" onclick="handleKachelClick(event,'${t.id}')">
      <!-- Header: Name + Leistungs-Button -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin-bottom:6px;">
        <div style="display:flex;align-items:center;gap:5px;flex:1;min-width:0;">
          <input type="checkbox" ${_ftSelected.has(t.id)?'checked':''} onclick="event.stopPropagation();toggleFtSelect('${t.id}')"
            style="flex-shrink:0;cursor:pointer;accent-color:#3b82f6;width:13px;height:13px;">
          <div style="font-size:13px;font-weight:700;color:#1a3a5c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.name}</div>
        </div>
        <button onclick="event.stopPropagation();openFtLeistungModal('${t.id}')" title="Schichtleistungen anpassen"
          style="flex-shrink:0;padding:3px 7px;border-radius:5px;border:1px solid #e5e7eb;background:white;font-size:11px;color:#6b7280;cursor:pointer;line-height:1;display:inline-flex;align-items:center;">${svgIcon('stift',{groesse:11})}</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:2px;margin-bottom:6px;">
        ${t.kopfAbmessung ? `<div style="font-size:10px;color:#374151;"><span style="color:#6b7280;font-weight:600;">Kopf</span> ${mmAbmessungToM(t.kopfAbmessung)}${t.kopfHoehe ? ` · h = ${parseFloat(t.kopfHoehe).toFixed(2)} m` : ''}</div>` : ''}
        ${t.blockAbmessung ? `<div style="font-size:10px;color:${missingBlock?'#9ca3af':'#374151'};"><span style="color:${missingBlock?'#9ca3af':'#6b7280'};font-weight:600;">Block</span> ${mmAbmessungToM(t.blockAbmessung)}</div>` : ''}
      </div>
      ${t.einsatzBedingung ? `<div style="font-size:10px;color:#9ca3af;font-style:italic;margin-bottom:6px;">${t.einsatzBedingung}</div>` : ''}
      ${_ftDauerZeile(t, lp)}
      ${lpChip}
      ${(() => {
        // Familie direkt aus dem Namen — hier ist t immer ein Standardtyp.
        // getBpRefFamilie() ist für Standort-Daten gedacht und las dafür die
        // gesamte Bibliothek erneut ein, einmal je Kachel.
        const masts = getMasttypenForRefTyp(t.name.split('/')[0].trim());
        return masts.length ? `<div style="font-size:9px;color:#9ca3af;margin-bottom:4px;">Mast: ${masts.join(' · ')}</div>` : '';
      })()}
      <div style="margin-top:auto;display:flex;flex-direction:column;gap:4px;">
        <span style="font-size:10px;background:#f3f4f6;padding:2px 6px;border-radius:4px;color:#6b7280;">${count} Standort${count !== 1 ? 'e' : ''}</span>
        <select onclick="event.stopPropagation()" onchange="setFtBaupaket('${t.id}', this.value)"
          style="font-size:10px;padding:2px 5px;border:1px solid #e5e7eb;border-radius:4px;background:white;color:#374151;cursor:pointer;max-width:100%;">
          <option value="">— Baupaket: Pool —</option>
          ${loadBaupakete().map(p => `<option value="${p.id}" ${t.fixBaupaketzuweisungId===p.id?'selected':''}>${p.name}</option>`).join('')}
        </select>
      </div>
    </div>`;
  }).join('');
  }; // end renderStdKacheln

  if (std.length) {
    let html = '';
    const flachHtml  = renderStdKacheln(stdFlach);
    const boeschHtml = renderStdKacheln(stdBoesch);
    if (flachHtml) {
      html += `<div style="grid-column:1/-1;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;padding:2px 0 4px;border-bottom:1px solid #e5e7eb;margin-bottom:4px;">Hangneigung ≤ 14°</div>`;
      html += flachHtml;
    }
    if (boeschHtml) {
      html += `<div style="grid-column:1/-1;font-size:10px;font-weight:700;color:#0e7490;text-transform:uppercase;letter-spacing:0.05em;padding:6px 0 4px;border-bottom:1px solid #e0f2f9;margin-bottom:4px;margin-top:8px;">Hangneigung 14–33°</div>`;
      html += boeschHtml;
    }
    if (!html) html = `<div style="grid-column:1/-1;font-size:12px;color:#9ca3af;padding:8px 0;">Keine Standardfundamente mit Zuweisung vorhanden.</div>`;
    stdGrid.innerHTML = html;
  } else {
    stdGrid.innerHTML = '<div style="grid-column:1/-1;font-size:12px;color:#9ca3af;padding:8px 0;">Keine Standardfundamente geladen. App neu laden.</div>';
  }

  // ── Selektion-Statusbar ──
  const selBar   = document.getElementById('ft-sel-bar');
  const selCount = _ftSelected.size;
  if (selBar) {
    selBar.style.display = selCount > 0 ? 'flex' : 'none';
    const lbl = document.getElementById('ft-sel-bar-count');
    if (lbl) lbl.textContent = `${selCount} Typ${selCount !== 1 ? 'en' : ''} ausgewählt`;
  }

  // ── Spezial-Kacheln (editierbar, Duplikat, Statikbericht-Links) ──
  const spezVisible = _ftFilter === 'zugeordnet'
    ? spez.filter(t => Object.values(zuweisungen).filter(id => id === t.id).length > 0)
    : spez;

  spezGrid.innerHTML = spezVisible.map(t => {
    const count   = Object.values(zuweisungen).filter(id => id === t.id).length;
    const artLbl  = ART_LABEL[t.fundamentArt] || 'Spezial';
    const isFels  = t.fundamentArt === 'fels';
    const spezLp  = profiles.find(p => p.id === t.leistungsprofilId);
    const params  = [
      t.kopfAbmessung  ? `Kopf: ${mmAbmessungToM(t.kopfAbmessung)}`                        : '',
      t.blockAbmessung ? `Block: ${mmAbmessungToM(t.blockAbmessung)}`                      : '',
      t.anzahlPfaehle  ? `${t.anzahlPfaehle} Pfähle`                                       : '',
      t.pfahlLaenge    ? `${isFels ? 'Anker' : 'L'} = ${parseFloat(t.pfahlLaenge).toFixed(2)} m` : '',
      t.tiefe          ? `${isFels ? 'Einbind.' : 't'} = ${parseFloat(t.tiefe).toFixed(2)} m`    : '',
      t.nutzungsart    ? (MAST_DATEN[t.nutzungsart]?.label || t.nutzungsart)                : '',
    ].filter(Boolean).join(' · ');

    // Verknüpfte Statikberichte
    const linked = statik.berichte.filter(b => b.ftIds && b.ftIds.includes(t.id));
    const berichtChips = linked.map(b =>
      `<a href="${b.url || '#'}" target="_blank" onclick="${b.url ? '' : 'return false'}"
        style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:600;
               background:#eff6ff;color:#2563eb;padding:2px 7px;border-radius:4px;
               border:1px solid #bfdbfe;text-decoration:none;white-space:nowrap;"
        title="${b.url || 'Kein Link gesetzt'}">${svgIcon('dokument',{groesse:11})}${b.name}</a>`
    ).join('');

    const spezSelStyle = _ftSelected.has(t.id) ? 'outline:2px solid #3b82f6;outline-offset:-2px;background:#eff6ff;' : '';
    return `<div class="card" style="${spezSelStyle}" onclick="handleKachelClick(event,'${t.id}')">
      <!-- Header: Name + Aktions-Buttons -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:5px;flex:1;min-width:0;">
          <input type="checkbox" ${_ftSelected.has(t.id)?'checked':''} onclick="event.stopPropagation();toggleFtSelect('${t.id}')"
            style="flex-shrink:0;cursor:pointer;accent-color:#3b82f6;width:13px;height:13px;">
          <span style="font-size:13px;font-weight:700;color:#1a3a5c;">${t.name}${t.typ !== 'standard' && t.referenzTyp ? `<span style="font-size:11px;font-weight:500;color:#6b7280;margin-left:4px;">(${t.referenzTyp})</span>` : ''}</span>
          ${(() => { const f = _ftFehlendeAngaben(t); return f.length
            ? `<span title="Fehlt: ${f.join(', ')}" style="color:#dc2626;flex-shrink:0;display:inline-flex;">${svgIcon('warnung',{groesse:12})}</span>` : ''; })()}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          <button onclick="event.stopPropagation();duplicateFundtyp('${t.id}')" title="Duplizieren"
            style="padding:3px 7px;border-radius:5px;border:1px solid #e5e7eb;background:white;font-size:11px;color:#6b7280;cursor:pointer;line-height:1;display:inline-flex;align-items:center;">${svgIcon('duplizieren',{groesse:11})}</button>
          <button onclick="event.stopPropagation();_openFtOrBulk('${t.id}')" title="Bearbeiten"
            style="padding:3px 7px;border-radius:5px;border:1px solid #e5e7eb;background:white;font-size:11px;color:#374151;cursor:pointer;font-weight:600;line-height:1;display:inline-flex;align-items:center;">${svgIcon('stift',{groesse:11})}</button>
        </div>
      </div>
      <!-- Bauart-Badge -->
      <div style="margin-bottom:5px;">
        <span style="font-size:10px;font-weight:700;background:#f5f3ff;color:#7c3aed;padding:1px 7px;border-radius:3px;">${artLbl}</span>
      </div>
      ${params ? `<div style="font-size:11px;color:#374151;line-height:1.6;margin-bottom:4px;">${params}</div>` : ''}
      ${t.einsatzBedingung ? `<div style="font-size:10px;color:#6b7280;font-style:italic;margin-bottom:5px;">${t.einsatzBedingung}</div>` : ''}
      ${_ftDauerZeile(t, spezLp)}
      ${berichtChips ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px;">${berichtChips}</div>` : ''}
      ${!linked.length ? `<div style="font-size:10px;color:#fbbf24;margin-bottom:4px;display:flex;align-items:center;gap:4px;">${svgIcon('warnung',{groesse:10})}Kein Statikbericht verknüpft</div>` : ''}
      <div style="margin-top:auto;display:flex;flex-direction:column;gap:4px;">
        <span style="font-size:10px;background:#f3f4f6;padding:2px 6px;border-radius:4px;color:#6b7280;">${count} Standort${count !== 1 ? 'e' : ''}</span>
        <select onclick="event.stopPropagation()" onchange="setFtBaupaket('${t.id}', this.value)"
          style="font-size:10px;padding:2px 5px;border:1px solid #e5e7eb;border-radius:4px;background:white;color:#374151;cursor:pointer;max-width:100%;">
          <option value="">— Baupaket: Pool —</option>
          ${loadBaupakete().map(p => `<option value="${p.id}" ${t.fixBaupaketzuweisungId===p.id?'selected':''}>${p.name}</option>`).join('')}
        </select>
      </div>
    </div>`;
  }).join('');

  // "+ Spezialtyp erfassen" Kachel am Ende (nur bei Filter "Alle")
  if (_ftFilter === 'alle') {
    const addCard = document.createElement('div');
    addCard.className = 'card card-add';
    addCard.title = 'Neuen Spezialtyp erfassen';
    addCard.onclick = () => openFundtypProfilModal(null);
    addCard.innerHTML = '<div class="card-add-icon">+</div><div class="card-add-label">Spezialtyp erfassen</div>';
    spezGrid.appendChild(addCard);
  }
}

let _ftFilter = 'alle';

function setFtFilter(filter) {
  _ftFilter = filter;
  renderFundtypProfilGrid();
}

// Kachel-Klick oeffnet den Typ. Frueher wies er den in der Zuweisungstabelle
// ausgewaehlten Standorten den Typ zu — diese Tabelle gibt es nicht mehr, und
// eine Auswahl aus einer anderen Ansicht waere nicht nachvollziehbar.
// Zuweisen laeuft jetzt in der Liste: Bearbeiten-Modus je Zeile oder
// Sammelaktionen-Leiste fuer mehrere Standorte.
function handleKachelClick(e, typId) {
  if (e && (e.ctrlKey || e.metaKey)) { toggleFtSelect(typId); return; }
  openFundtypProfilModal(typId);
}

// ── Export-Panel: öffnen/schliessen ──────────────────────────
function toggleExportPanel(panelId, btnId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  if (!open) {
    setTimeout(() => {
      const close = e => {
        const p = document.getElementById(panelId);
        if (p && !p.contains(e.target) && e.target.id !== btnId) {
          p.style.display = 'none';
          document.removeEventListener('click', close);
        }
      };
      document.addEventListener('click', close);
    }, 10);
  }
}

function toggleFtExportPanel() {
  const panel = document.getElementById('ft-export-panel');
  if (!panel) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  // Umfang-Radio auf aktuellen Filter vorbelegen
  if (!open) {
    const scope = _ftFilter === 'zugeordnet' ? 'zugeordnet' : 'alle';
    const radio = document.getElementById('ftexp-scope-' + (scope === 'zugeordnet' ? 'zug' : 'alle'));
    if (radio) radio.checked = true;
    // Klick außerhalb schließt Panel
    setTimeout(() => {
      const close = e => { if (!document.getElementById('ft-export-panel')?.contains(e.target) && e.target.id !== 'ft-export-btn') { panel.style.display='none'; document.removeEventListener('click', close); } };
      document.addEventListener('click', close);
    }, 10);
  }
}

// Einheitliche Export-Funktion — liest Panel-Einstellungen aus
function doFtExport(format) {
  const cbBib = document.getElementById('ftexp-cb-bibliothek')?.checked;
  const cbZuw = document.getElementById('ftexp-cb-zuweisung')?.checked;
  const scope = document.querySelector('input[name="ftexp-scope"]:checked')?.value || 'alle';
  // Temporär _ftFilter überschreiben damit die Export-Funktionen den richtigen Umfang sehen
  const prevFilter = _ftFilter;
  if (scope !== _ftFilter) _ftFilter = scope;

  if (format === 'pdf') {
    if (cbBib && cbZuw)       exportFtPdfKombiniert();
    else if (cbBib)           exportFtPdf();
    else if (cbZuw)           exportFtzPdf();
    else { ui.toast('Mindestens einen Inhalt auswählen.', 'fehler'); _ftFilter = prevFilter; return; }
  } else {
    if (cbBib && cbZuw)       exportFtXlsxKombiniert();
    else if (cbBib)           exportFtXlsx();
    else if (cbZuw)           exportFtzXlsx();
    else { ui.toast('Mindestens einen Inhalt auswählen.', 'fehler'); _ftFilter = prevFilter; return; }
  }
  _ftFilter = prevFilter;
  document.getElementById('ft-export-panel').style.display = 'none';
}

// Kombinierter Excel-Export: Bibliothek + Zuweisung auf separaten Sheets
function exportFtXlsxKombiniert() {
  if (!window.XLSX) { ui.toast('SheetJS nicht geladen.', 'fehler'); return; }
  const scope = document.querySelector('input[name="ftexp-scope"]:checked')?.value || 'alle';
  const ftList = scope === 'zugeordnet'
    ? loadFtProfile().filter(t => Object.values(loadFtZuweisungen()).includes(t.id))
    : loadFtProfile();

  // Sheet 1: Bibliothek
  const bibRows = [['Bezeichnung','Art','Kopf','Block','Tiefe (m)','Zeichnungs-Nr.','Schrauben Art.-Nr.','Beton','Bewehrung','Intervall (h)','Einsatzbedingung','Bemerkung']];
  ftList.forEach(t => bibRows.push([
    t.name||'', t.fundamentArt||'', t.kopfAbmessung||'', t.blockAbmessung||'',
    t.tiefe||'', t.zeichnungsNr||'', t.schraubenArtikelNr||'',
    t.beton||'', t.bewehrung||'', t.ftIntervall||'',
    t.einsatzBedingung||'', t.bemerkung||'',
  ]));
  const wsBib = window.XLSX.utils.aoa_to_sheet(bibRows);

  // Sheet 2: Zuweisung
  const pairs = getFilteredSorted();
  const zuw = loadFtZuweisungen();
  const allBp = loadAllBauprojekt();
  const zuwRows = [['Mast','KM','Fundamenttyp','Neigung','Status']];
  pairs.forEach(p => {
    const ft = ftList.find(t => t.id === zuw[p.id]);
    const bp = allBp[p.id] || {};
    const km = p.km_rs ? parseFloat(p.km_rs).toFixed(3) : (p.km_rks ? parseFloat(p.km_rks).toFixed(3) : '');
    zuwRows.push([standortName(p), km, ft?.name||'—', bp.neigung||'—', ft ? (ft.nachweisRequired?'Nachweis erf.':'Zugewiesen') : 'Nicht zugewiesen']);
  });
  const wsZuw = window.XLSX.utils.aoa_to_sheet(zuwRows);

  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, wsBib, 'Bibliothek');
  window.XLSX.utils.book_append_sheet(wb, wsZuw, 'Zuweisung');
  window.XLSX.writeFile(wb, 'Fundamenttypen_Export.xlsx');
}

// Kombinierter PDF-Export: Bibliothek + Zuweisung hintereinander
function exportFtPdfKombiniert() {
  // Bibliothek exportieren (fügt Seiten hinzu), dann Zuweisung anhängen
  // Da jsPDF-Dokumente nicht zusammengeführt werden können, rufen wir beide
  // Exports einzeln auf — der User erhält zwei Dateien, ist die pragmatischste Lösung
  exportFtPdf();
  setTimeout(exportFtzPdf, 600);
}

// PDF-Export aller Fundamenttypen (Standard + Spezial)
function exportFtPdf() {
  const jsPDFLib = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFLib) { ui.toast('jsPDF nicht geladen.', 'fehler'); return; }
  const doc    = new jsPDFLib({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const allFt  = loadFtProfile();
  const zuws   = loadFtZuweisungen();
  const pn     = getActiveProjectName() || 'Projekt';
  const date   = new Date().toLocaleDateString('de-CH');
  // Filter anwenden
  const typen  = _ftFilter === 'zugeordnet'
    ? allFt.filter(t => Object.values(zuws).filter(id => id === t.id).length > 0)
    : allFt;

  // Kopf
  doc.setFillColor(26, 58, 92); doc.rect(0, 0, 297, 3, 'F');
  doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(26, 58, 92);
  doc.text('Fundamenttypen-Bibliothek · ' + pn, 14, 11);
  doc.setFontSize(8); doc.setFont(undefined, 'normal'); doc.setTextColor(107, 114, 128);
  doc.text(date + ' · ' + typen.length + ' Typen' + (_ftFilter === 'zugeordnet' ? ' (nur zugeordnet)' : ''), 14, 17);
  doc.setDrawColor(229, 231, 235); doc.line(14, 20, 283, 20);

  // Tabellenkopf
  const cols   = ['Bezeichnung', 'Typ', 'Parameter', 'Einsatzbedingung', 'Standorte', 'Nachweis'];
  const widths = [40, 26, 82, 72, 18, 18];
  let y = 27;

  const drawHead = () => {
    doc.setFillColor(26, 58, 92); doc.rect(14, y - 4, widths.reduce((a,b)=>a+b,0), 7, 'F');
    doc.setFontSize(7.5); doc.setFont(undefined, 'bold'); doc.setTextColor(255, 255, 255);
    let x = 14;
    cols.forEach((c, i) => { doc.text(c, x + 1, y); x += widths[i]; });
    doc.setTextColor(30, 30, 30); y += 7;
  };
  drawHead();

  const ART_LBL = { blockfundament:'Blockfund.', mehrpfahl:'Mehrpfahl', monopfahl:'Monopfahl', mauer:'Mauer', bauwerk:'Bauwerk', fels:'Fels', sonstige:'Sonstige' };
  doc.setFont(undefined, 'normal');
  let ri = 0;
  typen.forEach(t => {
    if (y > 192) { doc.addPage(); y = 14; drawHead(); }
    const count  = Object.values(zuws).filter(id => id === t.id).length;
    const isStd  = t.typ === 'standard';
    const isFels = t.fundamentArt === 'fels';
    const params = [
      t.kopfAbmessung  ? `Kopf: ${mmAbmessungToM(t.kopfAbmessung)}`                               : '',
      t.blockAbmessung ? `Block: ${mmAbmessungToM(t.blockAbmessung)}`                             : '',
      t.anzahlPfaehle  ? `${t.anzahlPfaehle} Pfähle`                                              : '',
      t.pfahlLaenge    ? `${isFels ? 'Anker' : 'L'} = ${parseFloat(t.pfahlLaenge).toFixed(2)} m`  : '',
      t.tiefe          ? `t = ${parseFloat(t.tiefe).toFixed(2)} m`                                : '',
    ].filter(Boolean).join(' · ');
    if (ri % 2 === 1) { doc.setFillColor(248, 250, 252); doc.rect(14, y - 4, widths.reduce((a,b)=>a+b,0), 6, 'F'); }
    doc.setFontSize(7.5);
    let x = 14;
    const typLbl = isStd ? 'Standard' : (ART_LBL[t.fundamentArt] || 'Spezial');
    [t.name, typLbl, params, t.einsatzBedingung||'—', String(count), isStd ? '—' : 'Erf.'].forEach((val, i) => {
      const lines = doc.splitTextToSize(String(val||'—'), widths[i] - 2);
      doc.text(lines, x + 1, y);
      x += widths[i];
    });
    y += 6; ri++;
  });

  doc.save(pn.replace(/[^a-zA-Z0-9_]/g, '_') + '_Fundamenttypen.pdf');
}

// Excel-Export aller Fundamenttypen
function exportFtXlsx() {
  const XLSX = window.XLSX;
  if (!XLSX) { ui.toast('SheetJS nicht geladen.', 'fehler'); return; }
  const allFt = loadFtProfile();
  const zuws  = loadFtZuweisungen();
  const typen = _ftFilter === 'zugeordnet'
    ? allFt.filter(t => Object.values(zuws).filter(id => id === t.id).length > 0)
    : allFt;
  const ART_LBL = { blockfundament:'Blockfundament', mehrpfahl:'Mehrpfahlfundament', monopfahl:'Monopfahlfundament', mauer:'Befestigung an Mauer', bauwerk:'Befestigung an Bauwerk', fels:'Verankerung in Fels', sonstige:'Sonstige' };
  const rows = typen.map(t => {
    const count  = Object.values(zuws).filter(id => id === t.id).length;
    const isFels = t.fundamentArt === 'fels';
    return {
      'Bezeichnung':             t.name || '',
      'Typ':                     t.typ === 'standard' ? 'Standard' : 'Spezial',
      'Referenztyp':             t.referenzTyp || '',
      'Nutzungsart':             t.nutzungsart ? (MAST_DATEN[t.nutzungsart]?.label || t.nutzungsart) : '',
      'Fundamentart':            ART_LBL[t.fundamentArt] || '',
      'Kopfabmessung':           mmAbmessungToM(t.kopfAbmessung || ''),
      'Blockabmessung':          mmAbmessungToM(t.blockAbmessung || ''),
      'Anzahl Pfähle':           t.anzahlPfaehle || '',
      'Pfahllänge (m)':          t.pfahlLaenge ? parseFloat(t.pfahlLaenge).toFixed(2) : '',
      'Einbautiefe (m)':         t.tiefe ? parseFloat(t.tiefe).toFixed(2) : '',
      'Schraubenlänge (mm)':     t.schraubLaenge || '',
      'Bewehrt':                 t.bewehrt === 'ja' ? 'Ja' : t.bewehrt === 'nein' ? 'Nein' : '',
      'Bewehrung (kg)':          t.bewehrungKg ?? '',
      'Einsatzbedingung':        t.einsatzBedingung || '',
      'Statiknachweis':          t.nachweisRequired ? 'Erforderlich' : 'Nicht erforderlich',
      'Anzahl Standorte':        count,
      'Bemerkung':               t.bemerkung || '',
    };
  });
  const ws  = XLSX.utils.json_to_sheet(rows);
  const wb  = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fundamenttypen');
  const pn  = (getActiveProjectName() || 'Projekt').replace(/[^a-zA-Z0-9_]/g, '_');
  XLSX.writeFile(wb, pn + '_Fundamenttypen.xlsx');
}

// Sortierstatus der Fundamente-Zuweisung-Tabelle
// Die Zuweisungstabelle unter Bausortiment ist entfallen: sie zeigte
// dieselben Standorte wie die allgemeine Liste. Zuweisen laeuft dort ueber
// den Bearbeiten-Modus, Sammelzuweisung ueber die Sammelaktionen-Leiste.

// Zuweisungsstand eines Standorts — als Listenspalte «Zuweisung» uebernommen
// Zuweisungsstatus als Chip. Zeigt zusaetzlich die Bauart, denn ob ein Standard-
// oder ein Spezialfundament zugewiesen ist, war in der Liste sonst nur am Namen
// des Typs ablesbar. «Nachweis erf.» meint: Ausfuehrungsbedingungen des
// Standardtyps nicht erfuellt, statischer Nachweis fuers PGV noetig.
function ftStatusHtml(pairId) {
  const chip = (text, color, bg, border) =>
    `<span style="font-size:10px;color:${color};font-weight:600;background:${bg};border:1px solid ${border};padding:2px 8px;border-radius:10px;white-space:nowrap;">${text}</span>`;
  const ft = loadFtProfile().find(t => t.id === loadFtZuweisungen()[pairId]);
  if (!ft) return chip('Nicht zugewiesen', '#9ca3af', '#f3f4f6', '#f3f4f6');
  if (ft.typ === 'standard') return chip('Standard', '#16a34a', '#dcfce7', '#86efac');
  return ft.nachweisRequired
    ? chip('Spezial · Nachweis erf.', '#92400e', '#fef3c7', '#fcd34d')
    : chip('Spezial', '#374151', '#f3f4f6', '#d1d5db');
}

function assignFundtyp(pairId, typId) {
  const zuweisungen = loadFtZuweisungen();
  const typ = typId ? loadFtProfile().find(t => t.id === typId) : null;
  logChange(pairId, 'Fundamenttyp', typ ? typ.name : '(entfernt)', 'fundtyp');
  if (typId) zuweisungen[pairId] = typId;
  else delete zuweisungen[pairId];
  saveFtZuweisungen(zuweisungen);
  // Fundamenttyp-Name in BP-Daten synchronisieren
  if (typId) {
    const typ = loadFtProfile().find(t => t.id === typId);
    if (typ) {
      const all = loadAllBauprojekt();
      all[pairId] = { ...(all[pairId] || {}), fundtyp: typ.name, ftProfilId: typId };
      saveAllBauprojekt(all);
    }
  }
  if (typeof renderList === 'function' && currentOverviewView === 'liste') renderList();
}

// Referenz-Standardtyp zu einem Kürzel (DP1a, HP2a …).
// Basis ist der Eintrag der PROJEKTBIBLIOTHEK — dort stehen seit dem
// Durchschreiben auch die Werte der Parameterdatenbank. DEFAULT_FT_PROFIL
// dient nur als Rückfall, falls die Bibliothek den Typ nicht kennt.
// Vorher legten beide Aufrufer je ein eigenes Overlay über die Vorgaben; die
// Materialüberschreibungen kamen dabei nie an, weil sie andere Feldnamen tragen.
// Alle Bibliothekseinträge einer Typenfamilie, nach Blocktiefe sortiert.
// DP1a umfasst z.B. DP1a / 1.5, 1.8, 2.1 und 2.4 — verschiedene Blocktiefen
// mit eigener Geometrie und teils eigenen Ankerbolzen.
function _ftReferenzVarianten(ref) {
  if (!ref) return [];
  const passt = t => t.typ === 'standard' && t.name.split('/')[0].trim() === ref;
  const aus = loadFtProfile().filter(passt);
  return (aus.length ? aus : DEFAULT_FT_PROFIL.filter(passt))
    .slice().sort((a, b) => (parseFloat(a.tiefe) || 0) - (parseFloat(b.tiefe) || 0));
}

// Referenzeintrag zu Kürzel + optionaler Ausführung.
// Basis ist die PROJEKTBIBLIOTHEK — dort stehen seit dem Durchschreiben auch
// die Werte der Parameterdatenbank; DEFAULT_FT_PROFIL ist nur der Rückfall.
function _ftReferenzBasis(ref, varianteId) {
  const varianten = _ftReferenzVarianten(ref);
  if (!varianten.length) return null;
  return (varianteId && varianten.find(t => t.id === varianteId)) || varianten[0];
}

// Variante einer Familie, deren Blocktiefe der erfassten am nächsten kommt.
// Der Referenztyp nennt nur die Familie; welche Ausführung als Materialbasis
// dient, ergibt sich aus der individuell erfassten Blocktiefe.
function _ftVarianteZuTiefe(varianten, tiefe) {
  const t = parseFloat(tiefe);
  if (!varianten.length || isNaN(t)) return varianten[0] || null;
  return varianten.reduce((best, v) =>
    Math.abs((parseFloat(v.tiefe) || 0) - t) < Math.abs((parseFloat(best.tiefe) || 0) - t) ? v : best);
}

// Auswahlliste der Ausführungen füllen; bei nur einer Variante ausblenden.
// Die Liste ist eine Anzeige (Select ist gesperrt) — sie folgt der Blocktiefe.
function _ftRefVarianteSelectFuellen(ref, aktuelleId) {
  const wrap = document.getElementById('ft-ref-variante-wrap');
  const sel  = document.getElementById('ft-prof-ref-variante');
  if (!wrap || !sel) return null;
  const varianten = _ftReferenzVarianten(ref);
  if (varianten.length < 2) {
    wrap.style.display = 'none';
    sel.innerHTML = '';
    return varianten[0] || null;
  }
  const tiefeFeld = document.getElementById('ft-prof-tiefe')?.value || '';
  const gewaehlt = (aktuelleId && varianten.find(t => t.id === aktuelleId))
    || _ftVarianteZuTiefe(varianten, tiefeFeld);
  wrap.style.display = '';
  sel.innerHTML = varianten.map(t => {
    const tiefe = parseFloat(t.tiefe);
    const neig  = (t.einsatzBedingung || '').includes('14–33') ? '14–33°' : '≤ 14°';
    const label = `${t.name}${isNaN(tiefe) ? '' : ` · Tiefe ${tiefe.toFixed(2)} m`} · ${neig}`;
    return `<option value="${t.id}"${t.id === gewaehlt.id ? ' selected' : ''}>${label}</option>`;
  }).join('');
  return gewaehlt;
}

// Übernimmt alle Werte eines Referenzeintrags in die Formularfelder.
// War zweimal wortgleich vorhanden (Referenztyp-Wechsel und Zurücksetzen-Knopf).
// tiefeBehalten: eine bereits erfasste Blocktiefe ist beim Spezialfundament die
// eigenständige Angabe — der Referenzwechsel darf sie nicht überschreiben.
// nurLeere: nur Felder füllen, die noch leer sind. So lässt sich ein
// gespeicherter Spezialtyp beim Öffnen aus seinem Referenztyp vorbelegen, ohne
// eigene Eingaben zu überschreiben.
function _ftFelderAusBasis(basis, { tiefeBehalten = false, nurLeere = false } = {}) {
  if (!basis) return;
  if (tiefeBehalten && document.getElementById('ft-prof-tiefe')?.value) {
    basis = { ...basis, tiefe: '' };
  }
  const sv = (id, val) => {
    const el = document.getElementById(id);
    if (!el || val == null || val === '') return;
    if (nurLeere && el.value !== '') return;
    el.value = val;
  };
  const ausAbmessung = (str, idB, idL) => {
    const m = (str || '').match(/(\d+)[×x](\d+)/);
    if (m) { sv(idB, (parseInt(m[1]) / 1000).toFixed(3)); sv(idL, (parseInt(m[2]) / 1000).toFixed(3)); }
  };
  if (basis.kopfB != null) {
    sv('ft-prof-kopf-b', parseFloat(basis.kopfB).toFixed(3));
    sv('ft-prof-kopf-l', parseFloat(basis.kopfL ?? basis.kopfB).toFixed(3));
  } else ausAbmessung(basis.kopfAbmessung, 'ft-prof-kopf-b', 'ft-prof-kopf-l');
  sv('ft-prof-kopf-hoehe', basis.kopfHoehe);
  if (basis.blockB != null) {
    sv('ft-prof-block-b', parseFloat(basis.blockB).toFixed(3));
    sv('ft-prof-block-l', parseFloat(basis.blockL ?? basis.blockB).toFixed(3));
  } else ausAbmessung(basis.blockAbmessung, 'ft-prof-block-b', 'ft-prof-block-l');
  sv('ft-prof-tiefe',           basis.tiefe);
  sv('ft-prof-beton',           basis.beton);
  sv('ft-prof-betondeckung',    basis.betondeckung);
  sv('ft-prof-bewehrungsstahl', basis.bewehrungsstahl || basis.bewehrung);
  sv('ft-prof-bewehrung-kg',    basis.bewehrungKg);
  sv('ft-prof-laengs-anzahl',   basis.laengsAnzahl);
  sv('ft-prof-laengs-dm',       basis.laengsDurchmesser);
  sv('ft-prof-buegel-anzahl',   basis.buegelAnzahl);
  sv('ft-prof-buegel-dm',       basis.buegelDurchmesser);
  sv('ft-prof-buegel-seite',    basis.buegelSeitenlaenge);
  sv('ft-prof-schraub-anzahl',  basis.schraubenAnzahl);
  sv('ft-prof-schraub-dm',      basis.schraubenDurchmesser);
  sv('ft-prof-schraub-laenge',  basis.schraubenLaenge || basis.schraubLaenge);
  sv('ft-prof-schraub-artnr',   basis.schraubenArtikelNr);
  sv('ft-prof-vfk-zeich',       basis.vfkZeichnungsNr);
  ftUpdateVol();
}

// Blocktiefe geändert → angezeigte Basis-Ausführung nachziehen.
// Nur die Anzeige: die Materialfelder bleiben stehen, sie werden ausschliesslich
// über «Zurücksetzen» oder einen Referenztyp-Wechsel neu geschrieben.
// Sperrzustand des Referenzblocks. Die Basis-Ausführung ist immer abgeleitet;
// beim Standardtyp ist der Referenztyp der Typ selbst — dort ist der ganze Block
// nur Anzeige, auch der Zurücksetzen-Knopf (er ist kein input/select und wird
// von der Sperrschleife in openFundtypProfilModal nicht erfasst).
function _ftRefBlockUI(istStandard) {
  const sel   = document.getElementById('ft-prof-ref-variante');
  const reset = document.getElementById('ft-prof-ref-reset-btn');
  const wrap  = document.getElementById('ft-ref-variante-wrap');
  if (sel) { sel.disabled = true; sel.style.opacity = '0.6'; sel.style.cursor = 'not-allowed'; }
  if (reset) {
    reset.disabled       = !!istStandard;
    reset.style.opacity  = istStandard ? '0.5' : '';
    reset.style.cursor   = istStandard ? 'not-allowed' : '';
  }
  if (istStandard && wrap) wrap.style.display = 'none';
}

function ftRefVarianteAusTiefe() {
  const sel = document.getElementById('ft-prof-ref-variante');
  if (!sel || !sel.options.length) return;
  const ref  = document.getElementById('ft-prof-ref-typ')?.value || '';
  const passend = _ftVarianteZuTiefe(_ftReferenzVarianten(ref), document.getElementById('ft-prof-tiefe')?.value);
  if (passend) sel.value = passend.id;
  _ftBasisHinweisZeigen();
}

// Die Materialbasis ist die nächstgelegene Standardausführung der Familie. Deckt
// sie sich nicht mit der erfassten Blocktiefe, standen zwei verschiedene Tiefen
// unkommentiert untereinander — die Basis las sich wie eine falsch übernommene
// Blocktiefe. Die Abweichung wird jetzt benannt.
function _ftBasisHinweisZeigen() {
  const hint = document.getElementById('ft-ref-variante-hinweis');
  const sel  = document.getElementById('ft-prof-ref-variante');
  if (!hint || !sel) return;
  const ref    = document.getElementById('ft-prof-ref-typ')?.value || '';
  const basis  = _ftReferenzVarianten(ref).find(t => t.id === sel.value);
  const tiefe  = parseFloat(document.getElementById('ft-prof-tiefe')?.value);
  const bTiefe = parseFloat(basis?.tiefe);
  if (!basis || isNaN(tiefe) || isNaN(bTiefe) || Math.abs(tiefe - bTiefe) < 0.005) {
    hint.style.display = 'none';
    return;
  }
  hint.style.display = '';
  hint.style.color = '#b45309';
  hint.textContent = `Blocktiefe ${tiefe.toFixed(2)} m entspricht keiner Standardausführung — `
                   + `Materialkennwerte stammen aus ${basis.name} (${bTiefe.toFixed(2)} m).`;
}

// Erzwingt Übernahme aller Werte aus Ref.Typ (überschreibt bestehende Felder)
function ftPrefillFromRefTyp() {
  const ref = document.getElementById('ft-prof-ref-typ')?.value || '';
  if (!ref) { ui.toast('Bitte zuerst einen Referenztyp wählen.', 'fehler'); return; }
  const id    = document.getElementById('ft-prof-ref-variante')?.value || '';
  const basis = _ftReferenzBasis(ref, id);
  if (!basis) { ui.toast(`Kein Standardprofil für Referenztyp "${ref}" in der Bibliothek gefunden.`, 'fehler'); return; }
  _ftFelderAusBasis(basis);
}

// Masttyp-Info neben Ref.Typ aktualisieren
function _updateFtRefMasttypInfo(ref) {
  const infoEl = document.getElementById('ft-ref-masttyp-info');
  if (!infoEl) return;
  if (!ref) { infoEl.style.display = 'none'; return; }
  const opts = getMastOptionen(ref);
  if (opts.length) {
    infoEl.textContent = opts.map(o => o.label).join(' · ');
    infoEl.style.display = '';
  } else {
    infoEl.style.display = 'none';
  }
}

// Felder dynamisch ein-/ausblenden je nach Fundamentart
function _refreshFtNutzungsartSelect(ref, current) {
  const wrap = document.getElementById('ft-nutzungsart-wrap');
  const sel  = document.getElementById('ft-prof-nutzungsart');
  if (!wrap || !sel) return;
  const opts = getMastOptionen(ref);
  if (!opts.length) { wrap.style.display = 'none'; sel.innerHTML = ''; return; }
  wrap.style.display = '';
  sel.innerHTML = `<option value="">— nicht definiert —</option>` +
    opts.map(o => `<option value="${o.key}"${current === o.key ? ' selected' : ''}>${o.label}</option>`).join('');
}

function onFtRefTypChange() {
  const ref = document.getElementById('ft-prof-ref-typ')?.value || '';
  _updateFtRefMasttypInfo(ref);
  _refreshFtNutzungsartSelect(ref, '');
  const nameEl = document.getElementById('ft-prof-name');
  if (!nameEl) return;
  const refTypes = ['DP1a','DP2a','HP1a','HP2a','DG1a','DG2a','DG3a'];
  let currentName = nameEl.value.trim();
  // Strip existing ref prefix
  for (const r of refTypes) {
    if (currentName.startsWith(r + ' – ') || currentName.startsWith(r + ' - ')) {
      currentName = currentName.slice(r.length + 3).trim();
      break;
    } else if (currentName === r) {
      currentName = '';
      break;
    }
  }
  nameEl.value = ref ? (ref + (currentName ? ' – ' + currentName : '')) : currentName;

  if (!ref) { _ftRefVarianteSelectFuellen('', null); return; }

  // Basis-Ausführung aus der erfassten Blocktiefe ableiten und deren Werte
  // übernehmen — die Blocktiefe selbst bleibt die individuelle Angabe.
  const gewaehlt = _ftRefVarianteSelectFuellen(ref, null);
  _ftFelderAusBasis(gewaehlt, { tiefeBehalten: true });

  ftUpdateVol();
  _ftBasisHinweisZeigen();
}

// ── Betonvolumen — EINE Formel für Modal, Parameterdatenbank und Materialliste ──
// Modell: «Tiefe t» ist die Gesamttiefe ab OK Terrain. Der Fundamentkopf sitzt
// im obersten Abschnitt, der Block reicht darunter — Blockhöhe = t − Kopfhöhe.
//
// Vorher gab es drei Rechnungen: Modal und Parameterdatenbank so, die
// Materialliste dagegen mit dem Block über die VOLLE Tiefe plus Kopf obendrauf.
// Damit war die oberste Kopfhöhe doppelt gezählt — bei DP1a/1.8 ergab das
// 2.16 statt 1.16 m³, also rund 1 m³ Beton zu viel je Fundament in der
// Bestellung. Die Materialliste folgt jetzt derselben Formel.
//
// vfk = true: vorfabrizierter Fundamentkopf, Kopfvolumen entfällt.
function ftMasseAusFt(ft) {
  const ausText = str => {
    const m = (str || '').match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/);
    if (!m) return null;
    const a = parseFloat(m[1]), b = parseFloat(m[2]);
    return { b: a > 10 ? a / 1000 : a, l: b > 10 ? b / 1000 : b };   // mm oder m
  };
  // Leere Zeichenkette zählt als «nicht gesetzt» — sonst würde ein geleertes
  // Eingabefeld als Mass 0 durchschlagen.
  const zahl = v => (v === '' || v == null || isNaN(parseFloat(v))) ? null : parseFloat(v);
  const paar = (bRoh, lRoh, textForm, standard) => {
    const b = zahl(bRoh);
    if (b == null) return ausText(textForm) || standard || null;
    return { b, l: zahl(lRoh) ?? b };
  };
  const kopf  = paar(ft.kopfB,  ft.kopfL,  ft.kopfAbmessung,  { b: 0.60, l: 0.60 });
  const block = paar(ft.blockB, ft.blockL, ft.blockAbmessung, null);
  return { kopf, block, tiefe: parseFloat(ft.tiefe) || 0, kopfHoehe: parseFloat(ft.kopfHoehe) || 0 };
}

function ftBetonVolumen(ft, vfk) {
  const { kopf, block, tiefe, kopfHoehe } = ftMasseAusFt(ft);
  if (!block || !tiefe) return null;
  const blockH = tiefe - kopfHoehe;
  if (blockH <= 0) return null;
  const volKopf  = vfk ? 0 : kopf.b * kopf.l * kopfHoehe;
  const volBlock = block.b * block.l * blockH;
  return { kopf: volKopf, block: volBlock, total: volKopf + volBlock };
}

function ftUpdateVol() {
  const kopfB  = parseFloat(document.getElementById('ft-prof-kopf-b')?.value)    || 0;
  const kopfL  = parseFloat(document.getElementById('ft-prof-kopf-l')?.value)    || kopfB;
  const kopfH  = parseFloat(document.getElementById('ft-prof-kopf-hoehe')?.value) || 0;
  const blockB = parseFloat(document.getElementById('ft-prof-block-b')?.value)   || 0;
  const blockL = parseFloat(document.getElementById('ft-prof-block-l')?.value)   || blockB;
  const tiefe  = parseFloat(document.getElementById('ft-prof-tiefe')?.value)     || 0;
  const volWrap = document.getElementById('ft-vol-wrap');
  const volDisp = document.getElementById('ft-vol-display');
  if (!volWrap || !volDisp) return;
  const v = (kopfB > 0 && kopfH > 0)
    ? ftBetonVolumen({ kopfB, kopfL, kopfHoehe: kopfH, blockB, blockL, tiefe }, false)
    : null;
  if (v) {
    volDisp.textContent = `Kopf: ${v.kopf.toFixed(2)} m³  +  Block: ${v.block.toFixed(2)} m³  =  Total: ${v.total.toFixed(2)} m³`;
    volWrap.style.display = '';
  } else {
    volWrap.style.display = 'none';
  }
}

// Welche Pflichtangaben einem Spezialtyp fehlen. Rückgabe ist die Liste der
// Bezeichnungen — die Kachel nennt sie im Tooltip. Vorher gab es nur ein
// nacktes «Unvollständige Eingabe»: bei sieben gleich markierten Kacheln war
// nicht erkennbar, woran es liegt.
function _ftFehlendeAngaben(t) {
  if (t.typ === 'standard') return [];
  const fehlt = [];
  if (!t.referenzTyp) fehlt.push('Referenztyp');
  if (t.fundamentArt === 'blockfundament') {
    if (!((t.blockB || t.blockAbmessung) && t.blockAbmessung !== '—')) fehlt.push('Blockabmessung');
    if (!t.tiefe) fehlt.push('Blocktiefe');
  }
  return fehlt;
}

function _ftIsIncomplete(t) {
  return _ftFehlendeAngaben(t).length > 0;
}

function onFtArtChange() {
  const art = document.getElementById('ft-prof-art')?.value || '';

  // Sichtbare Feldgruppen je Fundamentart. Benannte Schluessel statt einer
  // Positionsliste: die frueheren Bool-Arrays mussten bei jeder neuen Gruppe
  // an sieben Stellen synchron erweitert werden.
  //   anker = Fundamentschrauben. Nur bei «Verankerung in Fels» frei zu
  //   erfassen; bei allen anderen Bauweisen legt der typengeprüfte Standardtyp
  //   sie fest.
  const ALLE_GRUPPEN = ['kopf','kopfhoehe','block','pfaehle','pfahl-laenge','tiefe','pfahl-leistung','anker'];
  const vis = {
    'blockfundament': ['kopf','block','tiefe'],
    'mehrpfahl':      ['kopf','pfaehle','pfahl-laenge','pfahl-leistung'],
    'monopfahl':      ['kopf','pfahl-laenge'],
    'mauer':          [],
    'bauwerk':        [],
    'fels':           ['pfahl-laenge','tiefe','anker'],
    'sonstige':       ['kopf','block','pfaehle','pfahl-laenge','tiefe'],
  };
  // Ohne gewaehlte Art: Geometrie zeigen, Ankerbolzen nicht.
  const sichtbar = new Set(vis[art] || ['kopf','block','pfaehle','pfahl-laenge','tiefe']);
  // Ankerbolzen zusaetzlich bei JEDEM Spezialfundament: dort sind sie nicht
  // durch einen typengeprueften Standardtyp festgelegt, sondern zu erfassen.
  // Bei Standardtypen bleiben sie ausgeblendet (Art.-Nr. kommt aus dem Typ).
  const istStandard = _ftEditId && loadFtProfile().find(t => t.id === _ftEditId)?.typ === 'standard';
  if (!istStandard) sichtbar.add('anker');
  // Die Kopfhoehe gehoert zur Kopfabmessung. Die alte Positionsliste hat sie
  // gar nicht geschaltet — bei «Fels», «Mauer» und «Bauwerk» stand sie ohne
  // zugehoerige Abmessung im Formular.
  if (sichtbar.has('kopf')) sichtbar.add('kopfhoehe');
  ALLE_GRUPPEN.forEach(gruppe => {
    const el = document.getElementById('ft-wrap-' + gruppe);
    if (el) el.style.display = sichtbar.has(gruppe) ? '' : 'none';
  });

  // Anker — ausschliesslich bei Verankerung in Fels und Befestigung an Mauer.
  // Weder Standardfundamente noch die übrigen Spezialbauweisen führen sie;
  // dort war die Gruppe früher als «Längsbewehrung» beschriftet.
  const laengsWrap  = document.getElementById('ft-wrap-laengs');
  const istAnker    = art === 'fels' || art === 'mauer';
  if (laengsWrap) laengsWrap.style.display = istAnker ? '' : 'none';

  // Label- und Placeholder-Anpassungen je Art
  const lbl   = id => document.getElementById(id);
  const input = id => document.getElementById(id);
  // Der Bezugspunkt gehoert in die Beschriftung, nicht in den Kopf des
  // Bearbeiters. Fuer den Pfahl ist er bekannt und mit BlockCalc identisch
  // (UK Block); fuer den Anker im Fels wird hier nichts behauptet.
  const hint = id => document.getElementById(id);
  if (art === 'fels') {
    if (lbl('ft-label-pfahl-laenge')) lbl('ft-label-pfahl-laenge').textContent = 'Ankerlänge (m)';
    if (lbl('ft-label-tiefe'))        lbl('ft-label-tiefe').textContent        = 'Einbindetiefe (m)';
    if (input('ft-prof-pfahl-laenge')) input('ft-prof-pfahl-laenge').placeholder = 'z.B. 3.0';
    if (input('ft-prof-tiefe'))        input('ft-prof-tiefe').placeholder        = 'z.B. 0.5';
    if (hint('ft-hint-pfahl-laenge'))  hint('ft-hint-pfahl-laenge').style.display = 'none';
  } else if (art === 'monopfahl') {
    // Ein Monopfahl hat kein Bankett und keinen Block. BlockCalc misst die
    // Laenge dort ab Terrain als Einbindelaenge; der freie Teil ueber GOK
    // laeuft getrennt als Ueberstand. «ab UK Block» waere hier falsch.
    if (lbl('ft-label-pfahl-laenge')) lbl('ft-label-pfahl-laenge').textContent = 'Einbindelänge ab Terrain (m)';
    if (lbl('ft-label-tiefe'))        lbl('ft-label-tiefe').textContent        = 'Blocktiefe (m)';
    if (input('ft-prof-pfahl-laenge')) input('ft-prof-pfahl-laenge').placeholder = 'z.B. 6.0';
    if (input('ft-prof-tiefe'))        input('ft-prof-tiefe').placeholder        = 'z.B. 1.6';
    if (hint('ft-hint-pfahl-laenge')) {
      hint('ft-hint-pfahl-laenge').style.display = '';
      hint('ft-hint-pfahl-laenge').textContent =
        'Gemessen ab Terrain — beim Einzelpfahl gibt es keinen Block; der Teil über Terrain zählt getrennt.';
    }
  } else {
    if (lbl('ft-label-pfahl-laenge')) lbl('ft-label-pfahl-laenge').textContent = 'Pfahllänge ab UK Block (m)';
    if (lbl('ft-label-tiefe'))        lbl('ft-label-tiefe').textContent        = 'Blocktiefe (m)';
    if (input('ft-prof-pfahl-laenge')) input('ft-prof-pfahl-laenge').placeholder = 'z.B. 6.0';
    if (input('ft-prof-tiefe'))        input('ft-prof-tiefe').placeholder        = 'z.B. 1.6';
    if (hint('ft-hint-pfahl-laenge')) {
      hint('ft-hint-pfahl-laenge').style.display = '';
      hint('ft-hint-pfahl-laenge').textContent =
        'Gemessen ab Unterkante Block — gleiche Definition wie im statischen Nachweis.';
    }
  }
  ftUpdatePfahlPlaceholders();
}

// Strukturierte Materialfelder → Anzeigetext.
// FT_MATERIAL_DB (unten) führte dieselben Angaben ein zweites Mal als Fliesstext.
// Beide beschrieben dasselbe, nur konnte die Textform nicht rechnen und nicht
// spaltenweise exportiert werden — und Eingaben darin erreichten das Modal nie,
// weil sie andere Feldnamen tragen. Sie ist jetzt eine ABGELEITETE Darstellung;
// FT_MATERIAL_DB dient nur noch als Rückfall für Einträge ohne strukturierte Werte.
function ftMaterialAnzeige(t) {
  if (!t) return {};
  const alt = FT_MATERIAL_DB[t.id] || {};
  // «laengs» entfällt: die Felder führen die Anker der Bauweisen Fels und Mauer,
  // und die beiden Materialtabellen listen ausschliesslich Standardtypen.
  const quer = (t.buegelAnzahl && t.buegelDurchmesser)
    ? `${t.buegelAnzahl}×Ø${t.buegelDurchmesser}${t.buegelSeitenlaenge ? '/' + t.buegelSeitenlaenge : ''} mm`
      + (t.buegelArtikelNr ? ` (${t.buegelArtikelNr})` : '')
    : (alt.quer || '');
  const anker = (t.schraubenAnzahl && t.schraubenDurchmesser)
    ? `${t.schraubenAnzahl}×${t.schraubenDurchmesser}`
      + (t.schraubenLaenge ? ', ' + ankerLaengeText(t.schraubenLaenge) : '')
      + (t.schraubenArtikelNr ? ` (${t.schraubenArtikelNr}${t.schraubenMaterial ? ', ' + t.schraubenMaterial : ''})` : '')
    : (alt.anker || '');
  return {
    beton:   t.beton || alt.beton || '',
    deckung: t.betondeckung ? `${t.betondeckung} mm` : (alt.deckung || ''),
    stahl:   t.bewehrungsstahl || t.bewehrung || alt.stahl || '',
    bewKg:   t.bewehrungKg != null && t.bewehrungKg !== '' ? `${t.bewehrungKg} kg` : '',
    quer, anker,
  };
}

// ── Parameterdatenbank — statische Material-/Bewehrungsdaten ──────────────────
// RÜCKFALL. Führende Quelle sind die strukturierten Felder in DEFAULT_FT_PROFIL
// bzw. in der Projektbibliothek; ftMaterialAnzeige() setzt daraus die Textform.
const FT_MATERIAL_DB = {
  // DP1a — Doppelstiel klein
  'ft_std_dp1a_15': { beton:'C30/37 (NPK F)', deckung:'40 mm', stahl:'B500B', quer:'2×Ø10/340 mm (371.06.158)', anker:'4×M30, L=250 cm (371.10.07, B550B/tZn)' },
  'ft_std_dp1a':    { beton:'C30/37 (NPK F)', deckung:'40 mm', stahl:'B500B', quer:'2×Ø10/340 mm (371.06.158)', anker:'4×M30, L=250 cm (371.10.07, B550B/tZn)' },
  'ft_std_dp1a_21': { beton:'C30/37 (NPK F)', deckung:'40 mm', stahl:'B500B', quer:'2×Ø10/340 mm (371.06.158)', anker:'4×M30, L=250 cm (371.10.07, B550B/tZn)' },
  'ft_std_dp1b':    { beton:'C30/37 (NPK F)', deckung:'40 mm', stahl:'B500B', quer:'2×Ø10/340 mm (371.06.158)', anker:'4×M30, L=320 cm (371.10.08, B550B/tZn)' },
  // DP2a — Doppelstiel mittel
  'ft_std_dp2a':    { beton:'C30/37 (NPK F)', deckung:'40 mm', stahl:'B500B', quer:'2×Ø12/340 mm (371.06.159)', anker:'4×M36, L=250 cm (371.10.10, B550B/tZn)' },
  'ft_std_dp2a_24': { beton:'C30/37 (NPK F)', deckung:'40 mm', stahl:'B500B', quer:'2×Ø12/340 mm (371.06.159)', anker:'4×M36, L=250 cm (371.10.10, B550B/tZn)' },
  'ft_std_dp2b':    { beton:'C30/37 (NPK F)', deckung:'40 mm', stahl:'B500B', quer:'2×Ø12/340 mm (371.06.159)', anker:'4×M36, L=320 cm (371.10.11, B550B/tZn)' },
  // DG1a — Gittermast klein
  'ft_std_dg1a_24': { beton:'C30/37 (NPK F)', deckung:'40 mm', stahl:'B500B', quer:'2×Ø12/500 mm (371.06.160)', anker:'4×M36, L=320 cm (371.10.11, B550B/tZn)' },
  'ft_std_dg1a_27': { beton:'C30/37 (NPK F)', deckung:'40 mm', stahl:'B500B', quer:'2×Ø12/500 mm (371.06.160)', anker:'4×M36, L=320 cm (371.10.11, B550B/tZn)' },
  'ft_std_dg1a_30': { beton:'C30/37 (NPK F)', deckung:'40 mm', stahl:'B500B', quer:'2×Ø12/500 mm (371.06.160)', anker:'4×M36, L=400 cm (371.10.12, B550B/tZn)' },
  // DG2a — Gittermast mittel
  'ft_std_dg2a_25': { beton:'C30/37 (NPK F)', deckung:'40 mm', stahl:'B500B', quer:'2×Ø12/260×750 mm (371.06.162)', anker:'4×M36, L=320 cm (371.10.11, B550B/tZn)' },
  // DG3a — Gittermast gross
  'ft_std_dg3a_26': { beton:'C30/37 (NPK F)', deckung:'40 mm', stahl:'B500B', quer:'2×Ø12/260×750 mm (371.06.162)', anker:'4×M36, L=320 cm (371.10.11, B550B/tZn)' },
  'ft_std_dg3a_30': { beton:'C30/37 (NPK F)', deckung:'40 mm', stahl:'B500B', quer:'2×Ø12/260×750 mm (371.06.162)', anker:'4×M36, L=400 cm (371.10.12, B550B/tZn)' },
  'ft_std_dg3a_35': { beton:'C30/37 (NPK F)', deckung:'40 mm', stahl:'B500B', quer:'2×Ø12/260×750 mm (371.06.162)', anker:'4×M36, L=400 cm (371.10.12, B550B/tZn)' },
  // HP1a — Hoher Pied gross
  'ft_std_hp1a':    { beton:'C30/37 (NPK F)', deckung:'40 mm', stahl:'B500B', quer:'2×Ø12/400 mm (371.06.161)', anker:'6×M36, L=320 cm (371.10.11, B550B/tZn)' },
  'ft_std_hp1a_29': { beton:'C30/37 (NPK F)', deckung:'40 mm', stahl:'B500B', quer:'2×Ø12/400 mm (371.06.161)', anker:'6×M36, L=320 cm (371.10.11, B550B/tZn)' },
  'ft_std_hp1b':    { beton:'C30/37 (NPK F)', deckung:'40 mm', stahl:'B500B', quer:'2×Ø12/400 mm (371.06.161)', anker:'6×M36, L=400 cm (371.10.12, B550B/tZn)' },
  // HP2a — Hoher Pied gross
  'ft_std_hp2a':    { beton:'C30/37 (NPK F)', deckung:'40 mm', stahl:'B500B', quer:'2×Ø12/400 mm (371.06.161)', anker:'6×M36, L=250 cm (371.10.10, B550B/tZn)' },
  'ft_std_hp2b':    { beton:'C30/37 (NPK F)', deckung:'40 mm', stahl:'B500B', quer:'2×Ø12/400 mm (371.06.161)', anker:'6×M36, L=320 cm (371.10.11, B550B/tZn)' },
};

/** Öffnet die Parameterdatenbank und befüllt alle drei Tabs */
function openFtDatenbank() {
  document.getElementById('ft-datenbank-modal').style.display = 'flex';
  ftDbTab('geo');   // Geometrie als Standard-Tab

  const types = DEFAULT_FT_PROFIL.filter(t => t.typ === 'standard');

  // ── Tab Geometrie ────────────────────────────────────────────────────────────
  const geoBody = document.getElementById('ftdb-geo-body');
  if (geoBody) {
    const tdS = 'padding:7px 10px;white-space:nowrap;border-bottom:1px solid #f3f4f6;';
    const rowBg = (i) => i % 2 === 0 ? '#ffffff' : '#f8fafc';
    geoBody.innerHTML = types.map((t, i) => {
      const kopfH   = parseFloat(t.kopfHoehe) || 1.0;
      const tiefe   = parseFloat(t.tiefe)     || 0;
      // Volumen aus der gemeinsamen Formel. Hier stand die ERSTE Blockseite
      // quadriert — bei DG3a (1.3 × 1.6 m) sind das 23 % zu wenig. Solange
      // jeder Standardtyp quadratisch war, konnte es nicht auffallen.
      const vol     = ftBetonVolumen(t, false);
      const volStr  = vol ? vol.total.toFixed(2) + ' m³' : '—';
      const hangBadge = t.einsatzBedingung.includes('14–33')
        ? `<span style="background:#ecfeff;color:#0e7490;border:1px solid #a5f3fc;border-radius:10px;padding:1px 7px;font-size:10px;">${t.einsatzBedingung}</span>`
        : `<span style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:10px;padding:1px 7px;font-size:10px;">${t.einsatzBedingung}</span>`;
      const blockTxt = t.blockAbmessung === '—'
        ? `<span style="color:#d97706;font-weight:600;">— ausstehend</span>`
        : mmAbmessungToM(t.blockAbmessung);
      return `<tr style="background:${rowBg(i)};">
        <td style="${tdS}font-weight:700;color:#1a3a5c;">${t.name}</td>
        <td style="${tdS}">${hangBadge}</td>
        <td style="${tdS}">0.60 × 0.60 m</td>
        <td style="${tdS}">${kopfH.toFixed(2)} m</td>
        <td style="${tdS}">${blockTxt}</td>
        <td style="${tdS}">${tiefe.toFixed(2)} m</td>
        <td style="${tdS}">${volStr}</td>
      </tr>`;
    }).join('');
  }

  // ── Tab Material & Bewehrung ─────────────────────────────────────────────────
  const matBody = document.getElementById('ftdb-mat-body');
  if (matBody) {
    const tdS = 'padding:7px 10px;white-space:nowrap;border-bottom:1px solid #f3f4f6;';
    const rowBg = (i) => i % 2 === 0 ? '#ffffff' : '#f8fafc';
    const bib = loadFtProfile();
    matBody.innerHTML = types.map((t, i) => {
      // Aus der Bibliothek lesen: dort stehen die Werte der Parameterdatenbank
      const m = ftMaterialAnzeige(bib.find(x => x.id === t.id) || t);
      return `<tr style="background:${rowBg(i)};">
        <td style="${tdS}font-weight:700;color:#1a3a5c;">${t.name}</td>
        <td style="${tdS}">${m.beton  || 'gem. Dok.'}</td>
        <td style="${tdS}">${m.deckung|| 'gem. Dok.'}</td>
        <td style="${tdS}">${m.stahl  || 'gem. Dok.'}</td>
        <td style="${tdS}">${m.quer   || 'gem. Dok.'}</td>
        <td style="${tdS}">${m.anker  || 'gem. Dok.'}</td>
      </tr>`;
    }).join('');
  }

  // ── Tab Bemerkungen ──────────────────────────────────────────────────────────
  const bemBody = document.getElementById('ftdb-bem-body');
  if (bemBody) {
    bemBody.innerHTML = types.map(t => {
      const hasBlock = t.blockAbmessung && t.blockAbmessung !== '—';
      const isBoesch = t.einsatzBedingung.includes('14–33');
      const color    = isBoesch ? '#0e7490' : '#1d4ed8';
      const bg       = isBoesch ? '#ecfeff' : '#eff6ff';
      const border   = isBoesch ? '#a5f3fc' : '#bfdbfe';
      return `<div style="border:1px solid ${border};border-left:4px solid ${color};border-radius:6px;background:${bg};padding:10px 14px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
          <span style="font-weight:700;font-size:13px;color:${color};">${t.name}</span>
          <span style="font-size:11px;color:#6b7280;">${t.einsatzBedingung}</span>
        </div>
        <div style="font-size:12px;color:#374151;line-height:1.6;">
          ${t.bemerkung ? `<p style="margin:0 0 4px;">${t.bemerkung}</p>` : ''}
          ${!hasBlock ? `<p style="margin:0;color:#d97706;">${svgIcon('warnung',{groesse:11})} Blockabmessungen für diesen Typ sind noch nicht in der Datenbank hinterlegt. Bitte SBB Dok. 0161.1011.0002 konsultieren.</p>` : ''}
          ${hasBlock  ? `<p style="margin:0;color:#15803d;">✓ Vollständige Geometriedaten vorhanden.</p>` : ''}
        </div>
      </div>`;
    }).join('');
  }
}

/** Schliesst die Parameterdatenbank */
function closeFtDatenbank() {
  document.getElementById('ft-datenbank-modal').style.display = 'none';
}

/** Wechselt den aktiven Tab in der Parameterdatenbank */
function ftDbTab(tab) {
  ['geo','mat','bem'].forEach(t => {
    const panel = document.getElementById(`ftdb-panel-${t}`);
    const btn   = document.getElementById(`ftdb-tab-${t}`);
    if (!panel || !btn) return;
    const active = t === tab;
    panel.style.display = active ? '' : 'none';
    btn.classList.toggle('aktiv', active);
  });
}

function openFundtypProfilModal(id, fallbackRefTyp, bulkIds) {
  _ftBulkIds  = (bulkIds && bulkIds.length > 1) ? bulkIds : null;
  _ftBulkMixed.clear();
  _ftEditId   = id;
  const isNew = !id && !_ftBulkIds;

  // ── Sammelbearbeitung ──────────────────────────────────────────────────────
  if (_ftBulkIds) {
    const allFts = loadFtProfile();
    const selFts = _ftBulkIds.map(bid => allFts.find(t => t.id === bid)).filter(Boolean);

    document.getElementById('fundtyp-profil-modal-title').textContent =
      `${selFts.length} Fundamenttypen bearbeiten`;
    document.getElementById('ft-prof-delete-btn').style.display = 'none';

    const bulkBanner = document.getElementById('ft-prof-bulk-banner');
    const bulkText   = document.getElementById('ft-prof-bulk-banner-text');
    if (bulkBanner && bulkText) {
      bulkText.innerHTML = `<strong>${selFts.length} Typen</strong> werden gleichzeitig bearbeitet. ` +
        `Felder mit <em>— Mehrere Werte —</em> werden nur überschrieben, wenn ein neuer Wert eingegeben wird.`;
      bulkBanner.style.display = 'flex';
    }
    document.getElementById('ft-prof-global-banner').style.display  = 'flex';
    document.getElementById('ft-prof-spez-banner').style.display    = 'none';
    document.getElementById('ft-prof-readonly-banner').style.display = 'none';

    // Leistungsprofil-Selector befüllen
    const lpSel = document.getElementById('ft-prof-lp-profil');
    if (lpSel) {
      const profiles = loadLeistungsprofile();
      lpSel.innerHTML = '<option value="">— Individuell (eigene Werte) —</option>' +
        profiles.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }

    // Hilfsfunktion: gemeinsamer Wert oder Sentinel
    const MIXED = '__mixed__';
    const shared = (getter) => {
      const vals = selFts.map(getter);
      return vals.every(v => v === vals[0]) ? (vals[0] ?? '') : MIXED;
    };
    const setInput = (elId, val) => {
      const el = document.getElementById(elId);
      if (!el) return;
      if (val === MIXED) {
        _ftBulkMixed.add(elId);
        el.value = '';
        el.placeholder = '— Mehrere Werte —';
        el.style.color = '#9ca3af'; el.style.fontStyle = 'italic';
        el.addEventListener('input', function onInput() {
          el.style.color = ''; el.style.fontStyle = '';
          el.removeEventListener('input', onInput);
        }, { once: true });
      } else {
        el.value = val || '';
        el.style.color = ''; el.style.fontStyle = '';
      }
    };
    const setSelect = (elId, val) => {
      const el = document.getElementById(elId);
      if (!el) return;
      // Mixed-Option sicherstellen
      if (!el.querySelector('option[value="__mixed__"]')) {
        const opt = document.createElement('option');
        opt.value = MIXED; opt.textContent = '— Mehrere Werte —';
        opt.style.color = '#9ca3af';
        el.insertBefore(opt, el.firstChild);
      }
      if (val === MIXED) {
        _ftBulkMixed.add(elId);
        el.value = MIXED;
      } else {
        el.value = val || '';
      }
    };

    setSelect('ft-prof-ref-typ',        shared(t => t.referenzTyp  || ''));
    setSelect('ft-prof-art',            shared(t => t.fundamentArt || ''));
    setSelect('ft-prof-bewehrt',        shared(t => t.bewehrt      || ''));
    setSelect('ft-prof-lp-profil',      shared(t => t.leistungsprofilId || ''));
    setInput ('ft-prof-kopf-b',         shared(t => t.kopfB  != null ? String(t.kopfB)  : ''));
    setInput ('ft-prof-kopf-l',         shared(t => t.kopfL  != null ? String(t.kopfL)  : ''));
    setInput ('ft-prof-kopf-hoehe',     shared(t => t.kopfHoehe != null ? String(t.kopfHoehe) : ''));
    setInput ('ft-prof-block-b',        shared(t => t.blockB != null ? String(t.blockB) : ''));
    setInput ('ft-prof-block-l',        shared(t => t.blockL != null ? String(t.blockL) : ''));
    setInput ('ft-prof-pfaehle',        shared(t => t.anzahlPfaehle || ''));
    setInput ('ft-prof-pfahl-laenge',   shared(t => t.pfahlLaenge   || ''));
    setInput ('ft-prof-pfahl-leistung', shared(t => t.pfahlLeistung != null ? String(t.pfahlLeistung) : ''));
    setInput ('ft-prof-tiefe',          shared(t => t.tiefe          || ''));
    setInput ('ft-prof-einsatz',        shared(t => t.einsatzBedingung || ''));
    setInput ('ft-prof-bemerkung',      shared(t => t.bemerkung        || ''));
    setInput ('ft-prof-schraub-laenge', shared(t => t.schraubLaenge != null ? String(t.schraubLaenge) : ''));
    setInput ('ft-prof-beton',          shared(t => t.beton          || ''));
    setInput ('ft-prof-betondeckung',   shared(t => t.betondeckung   || ''));
    setInput ('ft-prof-bewehrungsstahl',shared(t => t.bewehrungsstahl || ''));
    setInput ('ft-prof-bewehrung-kg',   shared(t => t.bewehrungKg != null ? String(t.bewehrungKg) : ''));
    setInput ('ft-prof-intervall',      shared(t => t.ftIntervall        != null ? String(t.ftIntervall)        : ''));
    setInput ('ft-prof-intervall-abbruch', shared(t => t.ftIntervallAbbruch != null ? String(t.ftIntervallAbbruch) : ''));
    // Bewehrungs- und Ankerfelder: standen bisher NICHT in dieser Vorbelegung,
    // trugen also die Werte der zuletzt einzeln bearbeiteten Kachel — und die
    // Ankerfelder wurden unten trotzdem geschrieben. Sammelbearbeitung eines
    // beliebigen Felds überschrieb damit die Ankerbolzen aller Selektierten.
    setInput ('ft-prof-laengs-anzahl',  shared(t => t.laengsAnzahl        || ''));
    setInput ('ft-prof-laengs-dm',      shared(t => t.laengsDurchmesser   || ''));
    setInput ('ft-prof-buegel-anzahl',  shared(t => t.buegelAnzahl        || ''));
    setInput ('ft-prof-buegel-dm',      shared(t => t.buegelDurchmesser   || ''));
    setInput ('ft-prof-buegel-seite',   shared(t => t.buegelSeitenlaenge  || ''));
    setInput ('ft-prof-schraub-anzahl', shared(t => t.schraubenAnzahl     || ''));
    setInput ('ft-prof-schraub-dm',     shared(t => t.schraubenDurchmesser|| ''));
    setInput ('ft-prof-schraub-artnr',  shared(t => t.schraubenArtikelNr  || ''));
    setInput ('ft-prof-vfk-zeich',      shared(t => t.vfkZeichnungsNr     || ''));

    // Name: deaktiviert (muss pro Typ eindeutig bleiben)
    const nameEl = document.getElementById('ft-prof-name');
    if (nameEl) {
      nameEl.value    = `${selFts.length} Typen`;
      nameEl.disabled = true;
      nameEl.style.color = '#9ca3af';
    }

    onFtArtChange();
    onFtProfProfilChange();
    ftUpdateVol();

    // Nutzungsart und Schichtleistung gehören zum einzelnen Typ und werden von
    // der Sammelbearbeitung nicht geschrieben — sichtbare Felder ohne Wirkung
    // wären irreführend, also ausblenden.
    ['ft-nutzungsart-wrap', 'ft-leis-wrap'].forEach(wid => {
      const el = document.getElementById(wid);
      if (el) el.style.display = 'none';
    });

    // Alle Felder entsperren (keine Readonly-Sperre in Bulk-Modus)
    document.getElementById('fundtyp-profil-modal').querySelectorAll('input, select, textarea').forEach(el => {
      if (el.id !== 'ft-prof-name') { el.disabled = false; el.style.opacity = ''; el.style.cursor = ''; }
    });
    // Basis-Ausführung folgt der Blocktiefe je Typ — über mehrere Typen hinweg
    // gibt es keine gemeinsame. Der Block bleibt in der Sammelbearbeitung leer.
    _ftRefBlockUI(false);
    const varWrap = document.getElementById('ft-ref-variante-wrap');
    if (varWrap) varWrap.style.display = 'none';

    document.getElementById('fundtyp-profil-modal').style.display = 'flex';
    return;
  }

  // ── Einzelbearbeitung (bisheriger Code) ───────────────────────────────────
  const bulkBannerEl = document.getElementById('ft-prof-bulk-banner');
  if (bulkBannerEl) bulkBannerEl.style.display = 'none';

  // Fallback aus Standort-Daten ableiten, falls kein expliziter Fallback mitgegeben wurde
  if (id && !fallbackRefTyp) {
    const allBP = loadAllBauprojekt();
    const match = Object.values(allBP).find(bp => bp.ftProfilId === id && bp.refFamilie);
    if (match) fallbackRefTyp = match.refFamilie;
  }
  document.getElementById('fundtyp-profil-modal-title').textContent = isNew ? 'Fundamenttyp erfassen' : 'Fundamenttyp bearbeiten';
  document.getElementById('ft-prof-delete-btn').style.display = isNew ? 'none' : '';
  const v = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };

  // Leistungsprofil-Selector befüllen
  const lpSel = document.getElementById('ft-prof-lp-profil');
  if (lpSel) {
    const profiles = loadLeistungsprofile();
    lpSel.innerHTML = '<option value="">— Individuell (eigene Werte) —</option>' +
      profiles.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }

  if (!isNew) {
    const t = loadFtProfile().find(x => x.id === id) || {};
    v('ft-prof-name',         t.name);
    v('ft-prof-art',          t.fundamentArt || 'sonstige');
    // Load Kopf-Abmessungen (new separate fields, fallback: parse legacy string, fallback: Referenzstandard)
    if (t.kopfB != null) {
      v('ft-prof-kopf-b', t.kopfB);
      v('ft-prof-kopf-l', t.kopfL != null ? t.kopfL : t.kopfB);
    } else if (t.kopfAbmessung) {
      const km = t.kopfAbmessung.match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/);
      if (km) {
        v('ft-prof-kopf-b', (parseFloat(km[1]) > 10 ? parseFloat(km[1])/1000 : parseFloat(km[1])).toFixed(3));
        v('ft-prof-kopf-l', (parseFloat(km[2]) > 10 ? parseFloat(km[2])/1000 : parseFloat(km[2])).toFixed(3));
      }
    } else if (t.typ !== 'standard') {
      // Spezialfundament ohne gespeicherte Kopfwerte → Referenzstandard 600×600 mm
      v('ft-prof-kopf-b', '0.600');
      v('ft-prof-kopf-l', '0.600');
    }
    v('ft-prof-kopf-hoehe', t.kopfHoehe || (t.typ !== 'standard' ? '1.0' : ''));
    // Load Block-Abmessungen
    if (t.blockB != null) {
      v('ft-prof-block-b', t.blockB);
      v('ft-prof-block-l', t.blockL != null ? t.blockL : t.blockB);
    } else if (t.blockAbmessung && t.blockAbmessung !== '—') {
      const bm = t.blockAbmessung.match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/);
      if (bm) {
        v('ft-prof-block-b', (parseFloat(bm[1]) > 10 ? parseFloat(bm[1])/1000 : parseFloat(bm[1])).toFixed(3));
        v('ft-prof-block-l', (parseFloat(bm[2]) > 10 ? parseFloat(bm[2])/1000 : parseFloat(bm[2])).toFixed(3));
      }
    }
    v('ft-prof-pfaehle',       t.anzahlPfaehle);
    v('ft-prof-pfahl-laenge',  t.pfahlLaenge);
    v('ft-prof-pfahl-leistung', t.pfahlLeistung != null ? t.pfahlLeistung : '');
    v('ft-prof-tiefe',        t.tiefe);
    v('ft-prof-intervall',         t.ftIntervall        != null ? t.ftIntervall        : '');
    v('ft-prof-intervall-abbruch', t.ftIntervallAbbruch != null ? t.ftIntervallAbbruch : '');
    if (lpSel) lpSel.value = t.leistungsprofilId || '';
    // Schichtleistungen je Fensterdauer laden
    [2,3,4,5,6,7,8].forEach(h => {
      const el = document.getElementById('ft-leis-' + h);
      if (el) el.value = t.ftLeistungen?.[h] != null ? t.ftLeistungen[h] : '';
    });
    v('ft-prof-einsatz',        t.einsatzBedingung);
    v('ft-prof-bemerkung',      t.bemerkung);
    const refSel = document.getElementById('ft-prof-ref-typ');
    // Standardtyp: die Familie steckt im Namen (DP1a / 1.8) — sie IST der
    // Referenztyp. Anzeigen statt leer lassen; gespeichert wird sie nicht,
    // saveFundtypProfil schreibt bei Standardtypen nur Materialfelder.
    const famAusName = t.typ === 'standard' && t.name?.includes('/') ? t.name.split('/')[0].trim() : '';
    if (refSel) refSel.value = famAusName || t.referenzTyp || fallbackRefTyp || '';
    _updateFtRefMasttypInfo(refSel?.value || '');
    // Die Basis richtet sich nach der geladenen Blocktiefe (oben bereits gesetzt);
    // ein gespeicherter referenzTypId hat Vorrang.
    const _refBasis = _ftRefVarianteSelectFuellen(refSel?.value || '', t.referenzTypId || null);
    _refreshFtNutzungsartSelect(refSel?.value || '', t.nutzungsart || '');
    v('ft-prof-schraub-laenge', t.schraubLaenge != null ? t.schraubLaenge : (t.schraubenLaenge || ''));
    const bewSel = document.getElementById('ft-prof-bewehrt');
    if (bewSel) bewSel.value = t.bewehrt || '';
    // Materialkennwerte
    v('ft-prof-beton',          t.beton || '');
    v('ft-prof-betondeckung',   t.betondeckung || '');
    v('ft-prof-bewehrungsstahl',t.bewehrungsstahl || '');
    v('ft-prof-bewehrung-kg',   t.bewehrungKg != null ? t.bewehrungKg : '');
    v('ft-prof-laengs-anzahl',  t.laengsAnzahl || '');
    v('ft-prof-laengs-dm',      t.laengsDurchmesser || '');
    v('ft-prof-buegel-anzahl',  t.buegelAnzahl || '');
    v('ft-prof-buegel-dm',      t.buegelDurchmesser || '');
    v('ft-prof-buegel-seite',   t.buegelSeitenlaenge || '');
    v('ft-prof-schraub-anzahl', t.schraubenAnzahl || '');
    v('ft-prof-schraub-dm',     t.schraubenDurchmesser || '');
    v('ft-prof-vfk-zeich',      t.vfkZeichnungsNr || '');
    v('ft-prof-schraub-artnr',  t.schraubenArtikelNr || '');

    // Spezialfundament: leere Felder aus dem Referenztyp vorbelegen.
    // Ein Spezialtyp erbt Geometrie und Material des Standardtyps und weicht nur
    // dort ab, wo es der Fall verlangt. Bisher blieben die Felder leer, wenn der
    // Eintrag selbst nichts gespeichert hatte (so legt sie der Import an) — die
    // Angaben des Referenztyps standen dann nirgends zur Verfügung.
    // Eigene Werte bleiben unangetastet; gespeichert wird erst beim Speichern.
    if (t.typ !== 'standard' && _refBasis) {
      _ftFelderAusBasis(_refBasis, { nurLeere: true });
    }
  } else {
    ['ft-prof-name','ft-prof-block-b','ft-prof-block-l','ft-prof-pfaehle','ft-prof-pfahl-laenge',
     'ft-prof-pfahl-leistung','ft-prof-tiefe','ft-prof-intervall','ft-prof-intervall-abbruch',
     'ft-prof-einsatz','ft-prof-bemerkung','ft-prof-schraub-laenge','ft-prof-beton',
     'ft-prof-betondeckung','ft-prof-bewehrungsstahl','ft-prof-bewehrung-kg',
     'ft-prof-laengs-anzahl','ft-prof-laengs-dm',
     'ft-prof-buegel-anzahl','ft-prof-buegel-dm','ft-prof-buegel-seite',
     'ft-prof-schraub-anzahl','ft-prof-schraub-dm','ft-prof-schraub-artnr','ft-prof-vfk-zeich']
      .forEach(eid => { const el = document.getElementById(eid); if (el) el.value = ''; });
    [2,3,4,5,6,7,8].forEach(h => { const el = document.getElementById('ft-leis-'+h); if (el) el.value = ''; });
    v('ft-prof-kopf-b',     '0.600');
    v('ft-prof-kopf-l',     '0.600');
    v('ft-prof-kopf-hoehe', '1.0');
    v('ft-prof-art', '');
    if (lpSel) lpSel.value = '';
    const refSel = document.getElementById('ft-prof-ref-typ');
    if (refSel) refSel.value = '';
    _ftRefVarianteSelectFuellen('', null);
    _refreshFtNutzungsartSelect('', '');
    const bewSel = document.getElementById('ft-prof-bewehrt');
    if (bewSel) bewSel.value = '';
  }
  onFtArtChange();
  onFtProfProfilChange();
  ftUpdateVol();
  // In der Sammelbearbeitung ausgeblendet — hier wieder zeigen
  const leisWrap = document.getElementById('ft-leis-wrap');
  if (leisWrap) leisWrap.style.display = '';

  // Standard-Typ: nur Geometrie-Felder sperren, Materialfelder editierbar
  const isStd = !isNew && (loadFtProfile().find(x => x.id === id)?.typ === 'standard');
  const STRUCT_IDS = new Set(['ft-prof-name','ft-prof-art','ft-prof-ref-typ','ft-prof-bewehrt',
    'ft-prof-kopf-b','ft-prof-kopf-l','ft-prof-kopf-hoehe',
    'ft-prof-block-b','ft-prof-block-l','ft-prof-pfaehle',
    'ft-prof-pfahl-laenge','ft-prof-pfahl-leistung','ft-prof-tiefe',
    'ft-prof-schraub-laenge']);
  const modal = document.getElementById('fundtyp-profil-modal');
  modal.querySelectorAll('input, select, textarea').forEach(el => {
    const lock = isStd && STRUCT_IDS.has(el.id);
    el.disabled = lock;
    el.style.opacity = lock ? '0.5' : '';
    el.style.cursor  = lock ? 'not-allowed' : '';
  });
  _ftRefBlockUI(isStd);
  _ftBasisHinweisZeigen();
  const roBanner   = document.getElementById('ft-prof-readonly-banner');
  const glBanner   = document.getElementById('ft-prof-global-banner');
  const spezBanner = document.getElementById('ft-prof-spez-banner');
  const saveBtn    = document.getElementById('ft-prof-save-btn');
  const delBtn     = document.getElementById('ft-prof-delete-btn');
  if (roBanner)   roBanner.style.display   = isStd ? 'flex' : 'none';
  if (glBanner)   glBanner.style.display   = isStd ? 'none' : 'flex';
  if (spezBanner) spezBanner.style.display = isStd ? 'none' : 'flex';
  if (saveBtn)  saveBtn.style.display  = '';
  if (delBtn)   delBtn.style.display   = (isNew || isStd) ? 'none' : '';
  if (isStd) {
    document.getElementById('fundtyp-profil-modal-title').textContent = 'Standardfundament — Materialkennwerte';
  }

  document.getElementById('fundtyp-profil-modal').style.display = 'flex';
}

function closeFundtypProfilModal() {
  document.getElementById('fundtyp-profil-modal').style.display = 'none';
  _ftEditId = null;
  _ftBulkIds = null;
  _ftBulkMixed.clear();
  const bulkBanner = document.getElementById('ft-prof-bulk-banner');
  if (bulkBanner) bulkBanner.style.display = 'none';
  const nameEl = document.getElementById('ft-prof-name');
  if (nameEl) { nameEl.disabled = false; nameEl.style.color = ''; }
}

// Kompaktes Read-only-Modal: zeigt nur Leistungswerte eines Fundamenttyps (aus Schichtzuweisung)
function openFtLeistungROModal(ftId) {
  const ft = loadFtProfile().find(t => t.id === ftId);
  if (!ft) return;
  const lp = ft.leistungsprofilId ? loadLeistungsprofile().find(p => p.id === ft.leistungsprofilId) : null;
  const hours = [2,3,4,5,6,7,8];

  // Leistung für jede Stunde ermitteln (Profil hat Vorrang)
  const getLeistung = h => {
    if (lp?.ftLeistungen?.[h] != null) return lp.ftLeistungen[h];
    if (ft.ftLeistungen?.[h]  != null) return ft.ftLeistungen[h];
    const intv = lp?.ftIntervall || ft.ftIntervall;
    if (intv) {
      const raw = h / intv;
      return raw >= 1 ? Math.floor(raw) : Math.round(raw * 10) / 10;
    }
    return '—';
  };

  const body = document.getElementById('ft-leistung-ro-modal-body');
  if (!body) return;

  const rows = hours.map(h => {
    const val = getLeistung(h);
    return `<div style="text-align:center;padding:6px 4px;border-right:1px solid #f3f4f6;font-size:12px;font-weight:600;color:#374151;">${val}</div>`;
  }).join('');

  body.innerHTML = `
    <div style="font-size:13px;font-weight:700;color:#1a3a5c;margin-bottom:2px;">${ft.name || '—'}</div>
    <div style="font-size:11px;color:#6b7280;margin-bottom:14px;">${ft.fundamentArt ? ft.fundamentArt.charAt(0).toUpperCase()+ft.fundamentArt.slice(1) : ''}</div>

    ${lp ? `<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;padding:6px 10px;background:#eff6ff;border-radius:6px;border:1px solid #bfdbfe;">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span style="font-size:11px;color:#1d4ed8;font-weight:600;">Leistungsprofil: ${lp.name}</span>
    </div>` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
      <div style="padding:8px 10px;background:#f8fafc;border-radius:6px;border:1px solid #e5e7eb;">
        <div style="font-size:10px;color:#9ca3af;margin-bottom:3px;">Ausf.-Dauer Neubau</div>
        <div style="font-size:13px;font-weight:600;color:#374151;">${ft.ftIntervall ? ft.ftIntervall + ' h' : '—'}</div>
      </div>
      <div style="padding:8px 10px;background:#f8fafc;border-radius:6px;border:1px solid #e5e7eb;">
        <div style="font-size:10px;color:#9ca3af;margin-bottom:3px;">Ausf.-Dauer Abbruch</div>
        <div style="font-size:13px;font-weight:600;color:#374151;">${ft.ftIntervallAbbruch ? ft.ftIntervallAbbruch + ' h' : '—'}</div>
      </div>
    </div>

    <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Schichtleistung (Fundamente / Schicht)</div>
    <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <div style="display:grid;grid-template-columns:repeat(7,1fr);background:#f1f5f9;">
        ${hours.map(h=>`<div style="text-align:center;padding:5px 2px;font-size:10px;font-weight:700;color:#6b7280;border-right:1px solid #e5e7eb;">${h} h</div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);background:white;">
        ${rows}
      </div>
    </div>
    ${lp ? '<div style="font-size:10px;color:#9ca3af;margin-top:5px;">Werte aus Leistungsprofil</div>' : '<div style="font-size:10px;color:#9ca3af;margin-top:5px;">Leer = automatisch aus Ausf.-Dauer berechnet</div>'}
  `;
  document.getElementById('ft-leistung-ro-modal').style.display = 'flex';
}
function closeFtLeistungROModal() {
  document.getElementById('ft-leistung-ro-modal').style.display = 'none';
}

// Leistungsprofil-Selektor im Spezialtyp-Modal: Felder sperren/freigeben
function onFtProfProfilChange() {
  const profilId  = document.getElementById('ft-prof-lp-profil')?.value || '';
  const hasProfile = !!profilId;
  const intervallEl   = document.getElementById('ft-prof-intervall');
  const pfahlLeisEl   = document.getElementById('ft-prof-pfahl-leistung');
  const lock = (el, locked) => {
    if (!el) return;
    el.disabled      = locked;
    el.style.opacity = locked ? '0.4' : '1';
  };
  lock(intervallEl, hasProfile);
  [2,3,4,5,6,7,8].forEach(h => lock(document.getElementById('ft-leis-' + h), hasProfile));

  if (hasProfile) {
    const lp = loadLeistungsprofile().find(p => p.id === profilId);
    if (lp) {
      if (intervallEl) {
        intervallEl.value = '';
        intervallEl.placeholder = lp.ftIntervall ? lp.ftIntervall + ' h (aus Profil)' : 'aus Profil';
      }
      // Bohrleistung sperren falls im LP definiert
      if (pfahlLeisEl && lp.pfahlLeistung != null) {
        lock(pfahlLeisEl, true);
        pfahlLeisEl.value = '';
        const einheit = lp.pfahlLeistungEinheit === 'pro-meter' ? ' h/m (aus Profil)' : ' h/Pfahl (aus Profil)';
        pfahlLeisEl.placeholder = lp.pfahlLeistung + einheit;
      } else {
        lock(pfahlLeisEl, false);
      }
      [2,3,4,5,6,7,8].forEach(h => {
        const el = document.getElementById('ft-leis-' + h);
        if (!el) return;
        el.value = '';
        if (lp.ftLeistungen?.[h] != null) {
          el.placeholder = String(lp.ftLeistungen[h]);
        } else if (lp.ftIntervall) {
          const raw = h / lp.ftIntervall;
          el.placeholder = String(raw >= 1 ? Math.floor(raw) : Math.round(raw * 10) / 10);
        } else {
          el.placeholder = 'Auto';
        }
      });
    }
  } else {
    if (intervallEl) intervallEl.placeholder = 'z.B. 4';
    lock(pfahlLeisEl, false);
    if (pfahlLeisEl) pfahlLeisEl.placeholder = 'z.B. 4';
    ftUpdatePfahlPlaceholders();
  }
}

// Aktualisiert die «Auto»-Platzhalter der Schichtleistungsfelder basierend auf pfahlLeistung + anzahlPfaehle
function ftUpdatePfahlPlaceholders() {
  const art       = document.getElementById('ft-prof-art')?.value;
  const profilId  = document.getElementById('ft-prof-lp-profil')?.value;
  if (art !== 'mehrpfahl' || profilId) {
    [2,3,4,5,6,7,8].forEach(h => {
      const el = document.getElementById('ft-leis-' + h);
      if (el && !el.disabled) el.placeholder = 'Auto';
    });
    return;
  }
  const pfahlLeistung = parseFloat(document.getElementById('ft-prof-pfahl-leistung')?.value);
  const anzahlPfaehle = parseInt(document.getElementById('ft-prof-pfaehle')?.value);
  const ftIntervall   = parseFloat(document.getElementById('ft-prof-intervall')?.value) || null;
  if (!pfahlLeistung || !anzahlPfaehle) {
    [2,3,4,5,6,7,8].forEach(h => {
      const el = document.getElementById('ft-leis-' + h);
      if (el && !el.disabled) el.placeholder = 'Auto';
    });
    return;
  }
  const mockFt = { fundamentArt: 'mehrpfahl', pfahlLeistung, anzahlPfaehle, ftIntervall };
  [2,3,4,5,6,7,8].forEach(h => {
    const el = document.getElementById('ft-leis-' + h);
    if (!el || el.disabled) return;
    const calc = _calcPfahlSchichten(mockFt, h, 0);
    if (calc?.total > 0) {
      const raw = 1 / calc.total;
      el.placeholder = String(raw >= 1 ? Math.floor(raw) : Math.round(raw * 10) / 10);
    } else {
      el.placeholder = 'Auto';
    }
  });
}

// ── Schichtleistungs-Modal für Standardfundamente ─────────────
let _ftLeisEditId = null;

function openFtLeistungModal(id) {
  _ftLeisEditId = id;
  const t = loadFtProfile().find(x => x.id === id) || {};
  document.getElementById('ft-leis-modal-title').textContent = 'Leistung — ' + (t.name || id);
  document.getElementById('ft-leis-modal-subtitle').textContent =
    [t.kopfAbmessung ? 'Kopf ' + t.kopfAbmessung : '', t.tiefe ? 't = ' + t.tiefe + ' m' : '', t.einsatzBedingung || '']
    .filter(Boolean).join(' · ');

  // Individuelle Werte zuerst setzen (werden von onFtLeisProfilChange geleert falls Profil aktiv)
  document.getElementById('ft-leis-modal-intervall').value = t.ftIntervall != null ? t.ftIntervall : '';
  [2,3,4,5,6,7,8].forEach(h => {
    const el = document.getElementById('ft-leis-modal-h' + h);
    if (el) el.value = t.ftLeistungen?.[h] != null ? t.ftLeistungen[h] : '';
  });

  // Profil-Selector befüllen und Felder sperren/freigeben
  const lpSel = document.getElementById('ft-leis-modal-profil');
  if (lpSel) {
    const profiles = loadLeistungsprofile();
    lpSel.innerHTML = '<option value="">— Individuell (eigene Werte) —</option>' +
      profiles.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    lpSel.value = t.leistungsprofilId || '';
    onFtLeisProfilChange();
  }

  document.getElementById('ft-leistung-modal').style.display = 'flex';
}

function onFtLeisProfilChange() {
  const profilId = document.getElementById('ft-leis-modal-profil')?.value;
  const hasProfile = !!profilId;
  const intervallEl = document.getElementById('ft-leis-modal-intervall');
  if (intervallEl) {
    intervallEl.disabled = hasProfile;
    intervallEl.style.opacity = hasProfile ? '0.5' : '1';
    if (hasProfile) intervallEl.value = ''; // Wert leeren damit Placeholder (Profilwert) sichtbar wird
  }
  [2,3,4,5,6,7,8].forEach(h => {
    const el = document.getElementById('ft-leis-modal-h' + h);
    if (el) {
      el.disabled = hasProfile;
      el.style.opacity = hasProfile ? '0.5' : '1';
      if (hasProfile) el.value = '';
    }
  });
  if (hasProfile) {
    const lp = loadLeistungsprofile().find(p => p.id === profilId);
    if (lp) {
      if (intervallEl) intervallEl.placeholder = lp.ftIntervall ? lp.ftIntervall + ' h (aus Profil)' : '— aus Profil —';
      [2,3,4,5,6,7,8].forEach(h => {
        const el = document.getElementById('ft-leis-modal-h' + h);
        if (el) {
          const raw = lp.ftIntervall ? h / lp.ftIntervall : null;
          const auto = lp.ftLeistungen?.[h] != null ? lp.ftLeistungen[h]
            : raw == null ? null
            : raw >= 1 ? Math.floor(raw) : Math.round(raw * 10) / 10;
          el.placeholder = auto != null ? String(auto) + ' (Profil)' : 'Auto';
        }
      });
    }
  } else {
    if (intervallEl) intervallEl.placeholder = 'z.B. 4';
    [2,3,4,5,6,7,8].forEach(h => {
      const el = document.getElementById('ft-leis-modal-h' + h);
      if (el) el.placeholder = 'Auto';
    });
  }
}

function closeFtLeistungModal() {
  document.getElementById('ft-leistung-modal').style.display = 'none';
  _ftLeisEditId = null;
}

async function resetFtLeistungModal() {
  if (!await ui.confirm('Leistungswerte auf Standard-Ausgangswerte zurücksetzen?')) return;
  // Original-Default für diesen Typ suchen
  const def = DEFAULT_FT_PROFIL.find(x => x.id === _ftLeisEditId);
  document.getElementById('ft-leis-modal-intervall').value = def?.ftIntervall ?? '';
  [2,3,4,5,6,7,8].forEach(h => {
    const el = document.getElementById('ft-leis-modal-h' + h);
    if (el) el.value = '';
  });
}

function saveFtLeistungModal() {
  if (!_ftLeisEditId) return;
  const list = loadFtProfile();
  const idx  = list.findIndex(t => t.id === _ftLeisEditId);
  if (idx < 0) return;
  const profilId = document.getElementById('ft-leis-modal-profil')?.value || null;
  list[idx].leistungsprofilId = profilId || null;
  if (!profilId) {
    // Individuelle Werte speichern
    list[idx].ftIntervall = parseFloat(document.getElementById('ft-leis-modal-intervall').value) || null;
    const leis = {};
    [2,3,4,5,6,7,8].forEach(h => {
      const val = parseFloat(document.getElementById('ft-leis-modal-h' + h)?.value);
      if (!isNaN(val) && val >= 0) leis[h] = val;
    });
    list[idx].ftLeistungen = Object.keys(leis).length ? leis : null;
  }
  saveFtProfile(list);
  closeFtLeistungModal();
  renderFundtypProfilGrid();
  renderLpGrid();
  // Bauprogramm-Tab neu berechnen (Kapazitäten ändern sich durch neue Schichtleistung)
  if (document.getElementById('bauprogramm-tab-wrap')?.style.display !== 'none') renderBauprogrammTab();
}

// ── Schichtleistungs-Profil-Grid ─────────────────────────────
function renderLpGrid() {
  const grid = document.getElementById('lp-grid');
  if (!grid) return;
  const profiles = loadLeistungsprofile();
  const ftList   = loadFtProfile();

  const BAUART_LBL = { blockfundament:'Blockfundament', mehrpfahl:'Mehrpfahlfundament', monopfahl:'Monopfahlfundament', fels:'Verankerung in Fels', mauer:'Befestigung an Mauer', bauwerk:'Befestigung an Bauwerk', sonstige:'Sonstige' };

  const items = profiles.map(lp => {
    const zugeordnet = ftList.filter(t => t.leistungsprofilId === lp.id).length;
    const intervall  = lp.ftIntervall ? lp.ftIntervall + ' h/Fund.' : '—';
    const pfahlUnit  = lp.pfahlLeistungEinheit === 'pro-meter' ? 'h/m' : 'h/Pfahl';
    const pfahlInfo  = lp.pfahlLeistung ? `<div style="font-size:10px;color:#1a3a5c;margin-bottom:4px;">⊕ ${lp.pfahlLeistung} ${pfahlUnit} (Bohren)</div>` : '';
    const leisRow = [2,3,4,5,6,7,8].map(h => {
      const raw = lp.ftIntervall ? h / lp.ftIntervall : null;
      const val = lp.ftLeistungen?.[h] != null ? lp.ftLeistungen[h]
        : raw == null ? '—'
        : raw >= 1 ? Math.floor(raw)
        : Math.round(raw * 10) / 10;
      return `<div style="text-align:center;">
        <div style="font-size:9px;color:#9ca3af;">${h}h</div>
        <div style="font-size:11px;font-weight:600;color:#374151;">${val}</div>
      </div>`;
    }).join('');

    return `<div class="card" style="cursor:pointer;" onclick="openLpModal('${lp.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:4px;">
        <div style="font-size:12px;font-weight:700;color:#1a3a5c;">${lp.name}</div>
        <span style="font-size:9px;background:#f3f4f6;color:#6b7280;padding:1px 6px;border-radius:8px;font-weight:600;">${zugeordnet} Typ${zugeordnet !== 1 ? 'en' : ''}</span>
      </div>
      ${lp.bauart ? `<div style="font-size:10px;color:#9ca3af;margin-bottom:4px;">${BAUART_LBL[lp.bauart] || lp.bauart}</div>` : ''}
      ${pfahlInfo}
      <div style="font-size:10px;color:#6b7280;margin-bottom:6px;">${intervall}</div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;background:#f9fafb;border-radius:6px;padding:6px 4px;">
        ${leisRow}
      </div>
    </div>`;
  }).join('');

  const addCard = `<div class="card card-add" onclick="openLpModal(null)">
    <div class="card-add-icon">+</div>
    <div class="card-add-label">Neues Profil</div>
  </div>`;

  grid.innerHTML = items + addCard;
}

// ── LP-Modal Funktionen ───────────────────────────────────────
let _lpEditId = null;

function openLpModal(id) {
  _lpEditId = id;
  const lp = id ? (loadLeistungsprofile().find(p => p.id === id) || {}) : {};
  document.getElementById('lp-modal-title').textContent = id ? 'Profil bearbeiten' : 'Neues Leistungsprofil';
  document.getElementById('lp-modal-name').value    = lp.name    || '';
  document.getElementById('lp-modal-bauart').value  = lp.bauart  || '';
  document.getElementById('lp-modal-intervall').value = lp.ftIntervall != null ? lp.ftIntervall : '';
  const pfahlLEl = document.getElementById('lp-modal-pfahl-leistung');
  if (pfahlLEl) pfahlLEl.value = lp.pfahlLeistung != null ? lp.pfahlLeistung : '';
  const pfahlEEl = document.getElementById('lp-modal-pfahl-einheit');
  if (pfahlEEl) pfahlEEl.value = lp.pfahlLeistungEinheit || 'pro-pfahl';
  [2,3,4,5,6,7,8].forEach(h => {
    const el = document.getElementById('lp-modal-h' + h);
    if (el) el.value = lp.ftLeistungen?.[h] != null ? lp.ftLeistungen[h] : '';
  });
  const delBtn = document.getElementById('lp-modal-delete-btn');
  if (delBtn) delBtn.style.display = id ? 'block' : 'none';
  lpBauartChange();
  document.getElementById('lp-modal').style.display = 'flex';
}

function lpUpdatePlaceholders() {
  const intervall = parseFloat(document.getElementById('lp-modal-intervall')?.value);
  [2,3,4,5,6,7,8].forEach(h => {
    const el = document.getElementById('lp-modal-h' + h);
    if (!el) return;
    if (isNaN(intervall) || intervall <= 0) { el.placeholder = 'Auto'; return; }
    const raw = h / intervall;
    el.placeholder = String(raw >= 1 ? Math.floor(raw) : Math.round(raw * 10) / 10);
  });
  // Hinweistext je nach Einheit aktualisieren
  const einheit = document.getElementById('lp-modal-pfahl-einheit')?.value;
  const hint = document.getElementById('lp-pfahl-leistung-hint');
  if (hint) hint.textContent = einheit === 'pro-meter'
    ? 'Stunden pro Laufmeter · wird mit Pfahllänge des FT-Typs multipliziert'
    : 'Zeit pro Pfahl inkl. Versetzen · gilt für alle FT-Typen mit diesem Profil';
}

function lpBauartChange() {
  const bauart = document.getElementById('lp-modal-bauart')?.value;
  const wrap = document.getElementById('lp-wrap-pfahl-leistung');
  if (wrap) wrap.style.display = (bauart === 'mehrpfahl' || bauart === 'monopfahl') ? '' : 'none';
  lpUpdatePlaceholders();
}

function closeLpModal() {
  document.getElementById('lp-modal').style.display = 'none';
  _lpEditId = null;
}

function saveLpModal() {
  const name = document.getElementById('lp-modal-name').value.trim();
  if (!name) { ui.toast('Bitte Bezeichnung eingeben.', 'fehler'); return; }
  const leis = {};
  [2,3,4,5,6,7,8].forEach(h => {
    const val = parseFloat(document.getElementById('lp-modal-h' + h)?.value);
    if (!isNaN(val) && val >= 0) leis[h] = val;
  });
  const lp = {
    id:            _lpEditId || ('lp_' + Date.now()),
    name,
    bauart:        document.getElementById('lp-modal-bauart').value || null,
    ftIntervall:   parseFloat(document.getElementById('lp-modal-intervall').value) || null,
    pfahlLeistung:       parseFloat(document.getElementById('lp-modal-pfahl-leistung')?.value) || null,
    pfahlLeistungEinheit: document.getElementById('lp-modal-pfahl-einheit')?.value || 'pro-pfahl',
    ftLeistungen:  Object.keys(leis).length ? leis : null,
  };
  const list = loadLeistungsprofile();
  const idx  = list.findIndex(p => p.id === lp.id);
  if (idx >= 0) list[idx] = lp; else list.push(lp);
  saveLeistungsprofile(list);
  closeLpModal();
  renderLpGrid();
}

async function deleteLpModal() {
  if (!_lpEditId || !await ui.confirm('Leistungsprofil löschen? Zugeordnete Fundamenttypen verlieren die Zuweisung.')) return;
  // Zuweisung bei betroffenen Typen entfernen
  const ftList = loadFtProfile();
  ftList.forEach(t => { if (t.leistungsprofilId === _lpEditId) t.leistungsprofilId = null; });
  saveFtProfile(ftList);
  const list = loadLeistungsprofile().filter(p => p.id !== _lpEditId);
  saveLeistungsprofile(list);
  closeLpModal();
  renderLpGrid();
  renderFundtypProfilGrid();
}

function saveFundtypProfil() {
  const v = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

  // ── Sammelbearbeitung ──────────────────────────────────────────────────────
  if (_ftBulkIds) {
    const list = loadFtProfile();
    const MIXED = '__mixed__';
    // Nur Felder übernehmen die nicht mehr im Mixed-Zustand sind
    const getVal = (elId, parse) => {
      if (_ftBulkMixed.has(elId)) {
        const cur = v(elId);
        if (!cur || cur === MIXED) return undefined; // noch mixed → überspringen
        return parse ? parse(cur) : cur;
      }
      const cur = v(elId);
      return parse ? (cur ? parse(cur) : null) : cur;
    };
    const getSelect = (elId) => {
      const cur = v(elId);
      if (cur === MIXED || (_ftBulkMixed.has(elId) && !cur)) return undefined;
      return cur || null;
    };

    const updates = {};
    const maybeAdd = (key, elId, parse) => { const val = getVal(elId, parse); if (val !== undefined) updates[key] = val; };
    const maybeAddSel = (key, elId)     => { const val = getSelect(elId);    if (val !== undefined) updates[key] = val; };
    const toFloat = s => parseFloat(s) || null;

    // referenzTypId NICHT sammeln: die Basis-Ausführung leitet sich je Typ aus
    // dessen Blocktiefe ab. Der Select trug hier den Wert der zuletzt einzeln
    // bearbeiteten Familie und hätte ihn allen Selektierten aufgedrückt.
    maybeAddSel('referenzTyp',      'ft-prof-ref-typ');
    maybeAddSel('fundamentArt',     'ft-prof-art');
    maybeAddSel('bewehrt',          'ft-prof-bewehrt');
    maybeAddSel('leistungsprofilId','ft-prof-lp-profil');
    maybeAdd   ('kopfB',            'ft-prof-kopf-b',         toFloat);
    maybeAdd   ('kopfL',            'ft-prof-kopf-l',         toFloat);
    maybeAdd   ('kopfHoehe',        'ft-prof-kopf-hoehe',     toFloat);
    maybeAdd   ('blockB',           'ft-prof-block-b',        toFloat);
    maybeAdd   ('blockL',           'ft-prof-block-l',        toFloat);
    maybeAdd   ('anzahlPfaehle',    'ft-prof-pfaehle',        null);
    maybeAdd   ('pfahlLaenge',      'ft-prof-pfahl-laenge',   null);
    maybeAdd   ('pfahlLeistung',    'ft-prof-pfahl-leistung', toFloat);
    maybeAdd   ('tiefe',            'ft-prof-tiefe',          null);
    maybeAdd   ('einsatzBedingung', 'ft-prof-einsatz',        null);
    maybeAdd   ('bemerkung',        'ft-prof-bemerkung',      null);
    maybeAdd   ('schraubLaenge',    'ft-prof-schraub-laenge', toFloat);
    maybeAdd   ('schraubenLaenge',  'ft-prof-schraub-laenge', null);
    maybeAdd   ('schraubenAnzahl',  'ft-prof-schraub-anzahl', null);
    maybeAdd   ('schraubenDurchmesser','ft-prof-schraub-dm',  null);
    maybeAdd   ('schraubenArtikelNr','ft-prof-schraub-artnr', null);
    maybeAdd   ('beton',            'ft-prof-beton',          null);
    maybeAdd   ('betondeckung',     'ft-prof-betondeckung',   null);
    maybeAdd   ('bewehrungsstahl',  'ft-prof-bewehrungsstahl',null);
    maybeAdd   ('bewehrung',        'ft-prof-bewehrungsstahl',null);
    maybeAdd   ('bewehrungKg',      'ft-prof-bewehrung-kg',   toFloat);
    // Bewehrungsfelder waren im Formular sichtbar, wurden aber nie übernommen —
    // eine Eingabe verschwand beim Speichern kommentarlos.
    maybeAdd   ('laengsAnzahl',      'ft-prof-laengs-anzahl',  null);
    maybeAdd   ('laengsDurchmesser', 'ft-prof-laengs-dm',      null);
    maybeAdd   ('buegelAnzahl',      'ft-prof-buegel-anzahl',  null);
    maybeAdd   ('buegelDurchmesser', 'ft-prof-buegel-dm',      null);
    maybeAdd   ('buegelSeitenlaenge','ft-prof-buegel-seite',   null);
    maybeAdd   ('vfkZeichnungsNr',   'ft-prof-vfk-zeich',      null);
    maybeAdd   ('ftIntervall',      'ft-prof-intervall',      toFloat);
    maybeAdd   ('ftIntervallAbbruch','ft-prof-intervall-abbruch', toFloat);

    // kopfAbmessung + blockAbmessung als String-Cache synchron halten
    if ('kopfB' in updates) {
      const b = updates.kopfB, l = updates.kopfL;
      if (b) updates.kopfAbmessung = `${Math.round(b*1000)}×${Math.round((l||b)*1000)} mm`;
    }
    if ('blockB' in updates) {
      const b = updates.blockB, l = updates.blockL;
      if (b) updates.blockAbmessung = `${Math.round(b*1000)}×${Math.round((l||b)*1000)} mm`;
    }

    _ftBulkIds.forEach(bid => {
      const idx = list.findIndex(t => t.id === bid);
      if (idx < 0) return;
      list[idx] = { ...list[idx], ...updates };
    });
    saveFtProfile(list);
    _ftBulkIds = null;
    _ftBulkMixed.clear();
    closeFundtypProfilModal();
    renderFundtypView();
    refreshFundtypDatalist();
    if (typeof renderBpFtInfo === 'function') renderBpFtInfo();
    return;
  }

  // ── Einzelbearbeitung (bisheriger Code) ───────────────────────────────────
  const list    = loadFtProfile();
  const existing = _ftEditId ? list.find(t => t.id === _ftEditId) : null;
  const isStd   = existing?.typ === 'standard';

  // Gemeinsame Material + Performance Felder
  const matFields = {
    beton:              v('ft-prof-beton')             || '',
    bewehrung:          v('ft-prof-bewehrungsstahl')   || '',
    bewehrungsstahl:    v('ft-prof-bewehrungsstahl')   || '',
    betondeckung:       v('ft-prof-betondeckung')      || '',
    bewehrungKg:        parseFloat(v('ft-prof-bewehrung-kg')) || null,
    laengsAnzahl:       v('ft-prof-laengs-anzahl')     || '',
    laengsDurchmesser:  v('ft-prof-laengs-dm')         || '',
    buegelAnzahl:       v('ft-prof-buegel-anzahl')     || '',
    buegelDurchmesser:  v('ft-prof-buegel-dm')         || '',
    buegelSeitenlaenge: v('ft-prof-buegel-seite')      || '',
    schraubenAnzahl:    v('ft-prof-schraub-anzahl')    || '',
    schraubenDurchmesser:v('ft-prof-schraub-dm')       || '',
    schraubenArtikelNr: v('ft-prof-schraub-artnr')     || '',
    schraubenLaenge:    v('ft-prof-schraub-laenge')    || '',
    schraubLaenge:      parseFloat(v('ft-prof-schraub-laenge')) || null,
    vfkZeichnungsNr:    v('ft-prof-vfk-zeich')         || undefined,
    leistungsprofilId:  document.getElementById('ft-prof-lp-profil')?.value || null,
    ftIntervall:        parseFloat(v('ft-prof-intervall'))         || null,
    ftIntervallAbbruch: parseFloat(v('ft-prof-intervall-abbruch')) || null,
    ftLeistungen:       (() => {
      const l = {};
      [2,3,4,5,6,7,8].forEach(h => {
        const val = parseFloat(document.getElementById('ft-leis-'+h)?.value);
        if (!isNaN(val) && val >= 0) l[h] = val;
      });
      return Object.keys(l).length ? l : null;
    })(),
    einsatzBedingung:   v('ft-prof-einsatz'),
    bemerkung:          v('ft-prof-bemerkung'),
  };
  if (!matFields.vfkZeichnungsNr) delete matFields.vfkZeichnungsNr;

  if (isStd) {
    // Standard-Typ: nur Material + Performance aktualisieren, Geometrie bleibt
    const idx = list.indexOf(existing);
    list[idx] = { ...existing, ...matFields };
    saveFtProfile(list);
    closeFundtypProfilModal();
    renderFundtypView();
    refreshFundtypDatalist();
    return;
  }

  const name = v('ft-prof-name');
  if (!name) { ui.toast('Bitte Bezeichnung eingeben.', 'fehler'); return; }
  const art = v('ft-prof-art');
  if (!art) { ui.toast('Bitte Fundamentart wählen.', 'fehler'); return; }
  const typ = {
    id:               _ftEditId || ('ft_' + Date.now()),
    name,
    typ:              'spezial',
    fundamentArt:     art,
    kopfB:            parseFloat(v('ft-prof-kopf-b'))    || null,
    kopfL:            parseFloat(v('ft-prof-kopf-l'))    || null,
    blockB:           parseFloat(v('ft-prof-block-b'))   || null,
    blockL:           parseFloat(v('ft-prof-block-l'))   || null,
    kopfHoehe:        parseFloat(v('ft-prof-kopf-hoehe')) || null,
    kopfAbmessung:    (() => { const b=parseFloat(v('ft-prof-kopf-b')), l=parseFloat(v('ft-prof-kopf-l'))||b; return b ? `${Math.round(b*1000)}×${Math.round(l*1000)} mm` : ''; })(),
    blockAbmessung:   (() => { const b=parseFloat(v('ft-prof-block-b')), l=parseFloat(v('ft-prof-block-l'))||b; return b ? `${Math.round(b*1000)}×${Math.round(l*1000)} mm` : ''; })(),
    anzahlPfaehle:    v('ft-prof-pfaehle'),
    pfahlLaenge:      v('ft-prof-pfahl-laenge'),
    pfahlLeistung:    parseFloat(v('ft-prof-pfahl-leistung')) || null,
    tiefe:            v('ft-prof-tiefe'),
    referenzTyp:      document.getElementById('ft-prof-ref-typ')?.value || null,
    referenzTypId:    document.getElementById('ft-prof-ref-variante')?.value || null,
    nutzungsart:      document.getElementById('ft-prof-nutzungsart')?.value || null,
    bewehrt:          document.getElementById('ft-prof-bewehrt')?.value || null,
    nachweisRequired: true,
    ...matFields,
  };
  const idx = list.findIndex(t => t.id === typ.id);
  const oldName = idx >= 0 ? list[idx].name : null;
  // Zusammenführen statt ersetzen: `typ` enthält nur die vom Modal verwalteten
  // Felder. Vorher wurde der Eintrag komplett überschrieben, wodurch bei jedem
  // Speichern alles verloren ging, wofür es kein Modalfeld gibt — darunter
  // buegelArtikelNr, buegelMaterial, schraubenMaterial und zeichnungsNr.
  if (idx >= 0) list[idx] = { ...list[idx], ...typ }; else list.push(typ);
  saveFtProfile(list);
  // Alle bpData.fundtyp-Referenzen aktualisieren wenn Name geändert
  if (oldName && oldName !== typ.name) {
    const allBp = loadAllBauprojekt();
    let changed = false;
    Object.keys(allBp).forEach(pairId => {
      if (allBp[pairId].fundtyp === oldName) {
        allBp[pairId].fundtyp = typ.name;
        changed = true;
      }
    });
    if (changed) saveAllBauprojekt(allBp);
  }
  closeFundtypProfilModal();
  renderFundtypView();
  refreshFundtypDatalist();
  // Info-Box im Sidebar sofort aktualisieren (falls der Standort das gerade bearbeitete FT hat)
  if (typeof renderBpFtInfo === 'function') renderBpFtInfo();
}

async function deleteFundtypProfil() {
  if (!_ftEditId || !await ui.confirm('Fundamenttyp wirklich löschen?')) return;
  const list = loadFtProfile().filter(t => t.id !== _ftEditId);
  saveFtProfile(list);
  // Zuweisungen + Statikberichte-Verknüpfungen entfernen
  const zuweisungen = loadFtZuweisungen();
  Object.keys(zuweisungen).forEach(k => { if (zuweisungen[k] === _ftEditId) delete zuweisungen[k]; });
  saveFtZuweisungen(zuweisungen);
  const statik = loadStatikBerichte();
  statik.berichte.forEach(b => { b.ftIds = (b.ftIds || []).filter(id => id !== _ftEditId); });
  saveStatikBerichte(statik);
  closeFundtypProfilModal();
  renderFundtypView();
  refreshFundtypDatalist();
}

// ============================================================
