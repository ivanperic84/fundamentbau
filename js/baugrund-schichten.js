// ============================================================
// BAUGRUND — SCHICHTAUFBAU UND AUSLEGUNG
// ============================================================
//
// WARUM EIN EIGENES MODUL
// Ein Baugrundprofil trug bisher EINEN Kennwertsatz: me, phi, gamma, c.
// Das ist der Satz, mit dem die Liste, die Grenzwertprüfung, die Zuweisung
// und der Export arbeiten — und der gehört auch dorthin. Was fehlte, war
// der Aufschluss darunter: die Schichtenfolge, aus der dieser eine Satz
// überhaupt erst hergeleitet wird.
//
// Beides steht deshalb nebeneinander:
//
//   profil.schichten[]   der Aufschluss  — was die Sondierung angetroffen hat
//   profil.me/phi/…      die Auslegung   — der Satz, mit dem gerechnet wird
//
// Die Auslegung bestimmt in der Praxis der Geologe in Abstimmung mit dem
// Bauingenieur. Genau diese beiden Lesarten sind als Modus hinterlegt: GEO
// mittelt über den massgebenden Bereich, ING nimmt die ungünstigste
// Schicht daraus. Wer den Satz von Hand setzt, bleibt auf «manuell».
//
// DER FLACHE SATZ BLEIBT DIE WAHRHEIT. Bei GEO/ING schreibt der Editor das
// Ergebnis in dieselben Felder me/phi/gamma/c zurück, die es schon gab.
// Damit braucht KEIN bestehender Verbraucher eine Fallunterscheidung —
// Liste, Zuweisung, Beurteilung, Excel- und PDF-Export lesen unverändert
// weiter, nur eben den hergeleiteten Wert. Derselbe Kniff wie bei
// neigungKlasse(): die Herleitung ändert den Wert, nicht seine Form.
//
// ALTBESTAND. Profile ohne schichten[] verhalten sich unverändert: kein
// Aufbau, Modus «manuell», flache Felder wie erfasst. Keine Migration.
//
// NAMENSGEBUNG. «Schicht» ist in dieser App vergeben — loadSchichten() sind
// die ARBEITSSCHICHTEN (Tag/Nacht) der Bauprogramm-Bibliothek. Alles hier
// heisst darum bg… und spricht von Bodenschichten oder Schichtaufbau.
// ============================================================

// Zahlen kommen aus Eingabefeldern und aus Importen — Komma wie Punkt.
function bgZahl(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

// Eine leere Bodenschicht. gamma2 wird nicht erfasst, sondern abgeleitet
// (siehe bgGamma2) — γ' = γ − 10 ist für gesättigten Boden exakt, ein
// eigenes Feld wäre eine Fehlerquelle ohne Gewinn.
function bgSchichtNeu(nr) {
  return { name: 'Schicht ' + (nr || 1), uscs: '', d: '', me: '', phi: '', gamma: '', c: '' };
}

// Auftriebswichte aus der Wichte. Untergrenze 8 kN/m³, damit ein zu klein
// erfasstes γ nicht in negative Spannungen läuft.
function bgGamma2(gamma) {
  const g = bgZahl(gamma);
  return g == null ? 10 : Math.max(8, +(g - 10).toFixed(1));
}

// Schichtaufbau eines Profils, normalisiert. Ohne Aufbau: leeres Feld —
// die Aufrufer entscheiden selbst, ob sie auf die flachen Werte
// zurückfallen. Kein stiller Ersatz durch eine Pseudo-Schicht: die Frage
// «ist ein Aufschluss erfasst?» muss beantwortbar bleiben.
function bgSchichten(profil) {
  const list = Array.isArray(profil?.schichten) ? profil.schichten : [];
  return list.filter(s => s && (s.name || s.me || s.phi || s.gamma || s.c || s.d || s.uscs));
}

// Tiefenlage der Schicht i [m ab Terrain]. bis === null heisst «durchgehend
// nach unten» — die unterste Schicht hat nie eine Mächtigkeit.
function bgSchichtTiefe(list, i) {
  let von = 0;
  for (let j = 0; j < i; j++) von += bgZahl(list[j].d) ?? 0;
  const d = bgZahl(list[i].d);
  return { von, bis: (i === list.length - 1 || d == null) ? null : von + d };
}

function bgSchichtTiefeText(list, i) {
  const { von, bis } = bgSchichtTiefe(list, i);
  // Die unterste Schicht hat keine Untergrenze — «2.5 – ∞ m» las sich
  // schlechter als «ab 2.5 m» und sagt dasselbe.
  return bis == null ? ('ab ' + von.toFixed(1) + ' m')
                     : (von.toFixed(1) + ' – ' + bis.toFixed(1) + ' m');
}

// ── AUSLEGUNG ───────────────────────────────────────────────
// Massgebende Tiefe ab Terrain. Blockfundamente stehen mit ihrer Sohle bei
// 1.6–2.4 m; die Pressungen reichen rund 2·B darunter. Was tiefer liegt,
// trägt zum Tragverhalten des Blocks nichts mehr bei und würde einen
// Mittelwert nur schönen. 3.0 m ist die Vorgabe, nicht das Gesetz.
const BG_MASSTIEFE_STD = 3.0;
function bgMassTiefe(profil) {
  const t = bgZahl(profil?.massTiefe);
  return (t != null && t > 0) ? t : BG_MASSTIEFE_STD;
}

const BG_AUSLEGUNG = {
  manuell: { kurz: 'Manuell', label: 'Manuell erfasst',
             text: 'Die Kennwerte unten gelten so, wie sie eingetragen sind.' },
  geo:     { kurz: 'GEO', label: 'GEO — gewichtetes Mittel',
             text: 'Mittelwert über die Schichten im massgebenden Bereich, nach Mächtigkeit gewichtet.' },
  ing:     { kurz: 'ING', label: 'ING — massgebende Schicht',
             text: 'Die ungünstigste Schicht im massgebenden Bereich, mit ihrem vollständigen Kennwertsatz.' },
};

function bgAuslegungModus(profil) {
  const m = profil?.auslegung;
  return BG_AUSLEGUNG[m] ? m : 'manuell';
}

// Schichten, die den Bereich 0…tiefe schneiden, mit ihrem Anteil daran.
// Der Anteil ist das Gewicht der Mittelung: eine Schicht, die nur 0.2 m in
// den Bereich hineinragt, darf ihn nicht bestimmen.
function bgSchichtenImBand(list, tiefe) {
  const out = [];
  let z = 0;
  for (let i = 0; i < list.length && z < tiefe; i++) {
    const { bis } = bgSchichtTiefe(list, i);
    const unten   = bis == null ? tiefe : Math.min(bis, tiefe);
    const anteil  = Math.max(0, unten - z);
    if (anteil > 0) out.push({ s: list[i], anteil });
    if (bis == null) break;
    z = bis;
  }
  // Kein Treffer (alle Mächtigkeiten leer oder 0) — dann gilt die erste.
  if (!out.length && list.length) out.push({ s: list[0], anteil: tiefe });
  return out;
}

// Mittelwert nach Mächtigkeit. Schichten ohne diesen Kennwert bleiben
// aussen vor, statt als 0 einzugehen — ein fehlendes c ist keine Kohäsion
// von null, sondern eine Lücke.
function bgMittel(band, feld) {
  let summe = 0, gewicht = 0;
  band.forEach(({ s, anteil }) => {
    const v = bgZahl(s[feld]);
    if (v != null) { summe += v * anteil; gewicht += anteil; }
  });
  return gewicht > 0 ? +(summe / gewicht).toFixed(1) : null;
}

// M_E wird NICHT arithmetisch gemittelt. Die Schichten liegen in Serie: die
// Zusammendrückungen addieren sich, die Steifigkeiten tun es nicht. Eine
// steife Deckschicht über weichem Untergrund käme sonst als tragfähig
// heraus, obwohl sich alles darunter setzt. Massgebend ist das harmonische
// Mittel — das Ersatz-M_E der Schichtfolge.
function bgMeErsatz(band) {
  let dSum = 0, quot = 0;
  band.forEach(({ s, anteil }) => {
    const me = bgZahl(s.me);
    if (me != null && me > 0) { dSum += anteil; quot += anteil / me; }
  });
  return quot > 0 ? +(dSum / quot).toFixed(1) : null;
}

// Die ungünstigste Schicht im Bereich. Rangfolge: kleinstes M_E, bei
// Gleichstand kleinstes φ'. Zurück kommt die GANZE Schicht, nicht das
// Minimum je Kennwert — ein aus mehreren Schichten zusammengesetzter Satz
// beschreibt keinen Boden, der irgendwo ansteht.
function bgSchichtMassgebend(band) {
  let best = null, bestRang = null;
  band.forEach(({ s }) => {
    const rang = [bgZahl(s.me) ?? Infinity, bgZahl(s.phi) ?? Infinity];
    if (!bestRang || rang[0] < bestRang[0] || (rang[0] === bestRang[0] && rang[1] < bestRang[1])) {
      best = s; bestRang = rang;
    }
  });
  return best;
}

// Die Auslegung eines Profils: der Kennwertsatz, mit dem gerechnet wird,
// samt Herkunft. EIN Auflöser — Editor und BlockCalc-Brücke fragen beide
// hier, damit die Vorschau im Modal und die Übergabe nicht auseinanderlaufen.
function bgAuslegen(profil) {
  const flach = {
    bodentyp: profil?.bodentyp || '', uscs: profil?.uscs || '',
    me: profil?.me || '', phi: profil?.phi || '',
    gamma: profil?.gamma || '', c: profil?.c || '',
  };
  const modus = bgAuslegungModus(profil);
  const list  = bgSchichten(profil);
  if (modus === 'manuell' || !list.length)
    return { ...flach, modus: 'manuell', herkunft: 'Manuell erfasst', massgebend: '' };

  const tiefe = bgMassTiefe(profil);
  const band  = bgSchichtenImBand(list, tiefe);
  const bis   = tiefe.toFixed(1) + ' m';

  if (modus === 'ing') {
    const s = bgSchichtMassgebend(band) || list[0];
    return {
      bodentyp: s.uscs ? _uscsToBodentyp(s.uscs) : flach.bodentyp,
      uscs: s.uscs || '', me: s.me || '', phi: s.phi || '',
      gamma: s.gamma || '', c: s.c || '',
      modus: 'ing', herkunft: 'ING · ungünstigste Schicht bis ' + bis,
      massgebend: s.name || '',
    };
  }

  // GEO — der Bodentyp folgt der Schicht mit dem grössten Anteil. Einen
  // gemittelten Bodentyp gibt es nicht, und der ME-Grenzwert hängt daran.
  const dominant = band.slice().sort((a, b) => b.anteil - a.anteil)[0]?.s || list[0];
  const txt = v => v == null ? '' : String(v);
  return {
    bodentyp: dominant.uscs ? _uscsToBodentyp(dominant.uscs) : flach.bodentyp,
    uscs:  dominant.uscs || '',
    me:    txt(bgMeErsatz(band)),
    phi:   txt(bgMittel(band, 'phi')),
    gamma: txt(bgMittel(band, 'gamma')),
    c:     txt(bgMittel(band, 'c')),
    modus: 'geo', herkunft: 'GEO · gewichtetes Mittel bis ' + bis,
    massgebend: '',
  };
}

// ── EDITOR ──────────────────────────────────────────────────
// Entwurfsstand, solange das Profilmodal offen ist. Erst Speichern legt ihn
// ins Profil — Abbrechen verwirft ihn, wie bei den übrigen Feldern auch.
let _bgSchichtEntwurf = [];

function bgSchichtenLaden(profil) {
  _bgSchichtEntwurf = bgSchichten(profil).map(s => ({ ...s }));
  bgSchichtenRender();
}

function bgSchichtenSammeln() {
  return _bgSchichtEntwurf
    .filter(s => s.name || s.uscs || s.d || s.me || s.phi || s.gamma || s.c)
    .map(s => ({ ...s }));
}

function bgSchichtAdd() {
  _bgSchichtEntwurf.push(bgSchichtNeu(_bgSchichtEntwurf.length + 1));
  bgSchichtenRender();
}

function bgSchichtDel(i) {
  _bgSchichtEntwurf.splice(i, 1);
  bgSchichtenRender();
}

function bgSchichtMove(i, richtung) {
  const j = i + richtung;
  if (j < 0 || j >= _bgSchichtEntwurf.length) return;
  const [s] = _bgSchichtEntwurf.splice(i, 1);
  _bgSchichtEntwurf.splice(j, 0, s);
  bgSchichtenRender();
}

// Beim Tippen NICHT neu zeichnen — das Feld verlöre den Fokus mitten im
// Wort. Nur die abgeleiteten Anzeigen ziehen nach.
function bgSchichtSet(i, feld, wert) {
  if (!_bgSchichtEntwurf[i]) return;
  _bgSchichtEntwurf[i][feld] = wert;
  if (feld === 'd') _bgSchichtEntwurf.forEach((_, k) => {
    const el = document.getElementById('bg-sch-tiefe-' + k);
    if (el) el.textContent = bgSchichtTiefeText(_bgSchichtEntwurf, k);
  });
  bgAuslegungVorschau();
}

const _bgEsc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
                                   .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Spaltenraster der Schichtzeile — Kopf und Zeilen teilen es sich, sonst
// stehen die Einheiten über den falschen Feldern.
const _BG_RASTER = 'display:grid;grid-template-columns:14px minmax(64px,1fr) 44px 44px 42px 42px 42px 44px;' +
                   'gap:4px;align-items:center;';

function bgSchichtenRender() {
  const box = document.getElementById('bg-schichten-liste');
  if (!box) return;
  const list = _bgSchichtEntwurf;

  if (!list.length) {
    box.innerHTML =
      '<div style="font-size:11px;color:#9ca3af;padding:7px 2px;">Kein Schichtaufbau erfasst — ' +
      'die Kennwerte unten gelten als einziger Satz.</div>';
    bgAuslegungVorschau();
    return;
  }

  const zellS = 'padding:4px 5px;border:1px solid #e5e7eb;border-radius:5px;font-size:11px;' +
                'font-family:inherit;background:white;width:100%;min-width:0;';
  const kopfS = 'font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;' +
                'letter-spacing:0.04em;text-align:center;';
  const knopfS = 'padding:3px 4px;border:1px solid #e5e7eb;border-radius:4px;background:white;' +
                 'cursor:pointer;color:#9ca3af;line-height:0;';

  const feld = (i, f, ph, zahl) =>
    `<input id="bg-sch-${f}-${i}" value="${_bgEsc(list[i][f])}" placeholder="${ph}"` +
    (zahl ? ' type="number" step="0.5"' : '') +
    ` oninput="bgSchichtSet(${i},'${f}',this.value)" style="${zellS}${zahl ? 'text-align:right;' : ''}">`;

  box.innerHTML =
    `<div style="${_BG_RASTER}margin-bottom:3px;">
       <span></span>
       <span style="${kopfS}text-align:left;padding-left:2px;">Bodenschicht</span>
       <span style="${kopfS}">USCS</span>
       <span style="${kopfS}">d [m]</span>
       <span style="${kopfS}" title="Steifemodul [MPa]">M<sub>E</sub></span>
       <span style="${kopfS}" title="Reibungswinkel [°]">φ'<sub>k</sub></span>
       <span style="${kopfS}" title="Raumlast [kN/m³]">γ</span>
       <span style="${kopfS}" title="Kohäsion [kPa]">c'<sub>k</sub></span>
     </div>` +
    list.map((s, i) => {
      const letzte = i === list.length - 1;
      const hoch = i === 0
        ? `<span style="width:19px;"></span>`
        : `<button type="button" onclick="bgSchichtMove(${i},-1)" title="nach oben" style="${knopfS}">
             <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
           </button>`;
      return `<div style="${_BG_RASTER}margin-bottom:4px;">
        <span style="font-size:10px;color:#9ca3af;text-align:center;">${i + 1}</span>
        ${feld(i, 'name', 'Bezeichnung')}
        ${feld(i, 'uscs', 'SM')}
        ${letzte
          ? `<span title="Die unterste Schicht reicht durchgehend nach unten." style="font-size:11px;color:#9ca3af;text-align:center;">&#8734;</span>`
          : feld(i, 'd', '2.0', true)}
        ${feld(i, 'me', '25', true)}
        ${feld(i, 'phi', '30', true)}
        ${feld(i, 'gamma', '20', true)}
        ${feld(i, 'c', '0', true)}
      </div>
      <div style="${_BG_RASTER}margin:-1px 0 7px;">
        <span></span>
        <span id="bg-sch-tiefe-${i}" style="font-size:10px;color:#6b7280;padding-left:2px;">${bgSchichtTiefeText(list, i)}</span>
        <span style="grid-column:3 / -1;display:flex;gap:3px;justify-content:flex-end;">
          ${hoch}
          <button type="button" onclick="bgSchichtDel(${i})" title="Schicht entfernen" style="${knopfS}">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </span>
      </div>`;
    }).join('');

  bgAuslegungVorschau();
}

// Zeigt im Profilmodal an, was die gewählte Auslegung aus dem Aufbau macht,
// und trägt sie bei GEO/ING gleich in die Kennwertfelder ein. Von dort
// speichert saveBaugrundProfil() sie als flachen Satz — deshalb liest der
// Rest der App unverändert weiter.
function bgAuslegungVorschau() {
  const box   = document.getElementById('bg-auslegung-info');
  const modus = document.getElementById('bg-prof-auslegung')?.value || 'manuell';
  const list  = bgSchichtenSammeln();

  // Kennwertfelder sind bei GEO/ING abgeleitet — dann gesperrt, sonst
  // überschreibt die nächste Herleitung die Eingabe kommentarlos.
  const abgeleitet = modus !== 'manuell' && list.length > 0;
  ['bg-prof-me', 'bg-prof-phi', 'bg-prof-gamma', 'bg-prof-c', 'bg-prof-uscs', 'bg-prof-bodentyp']
    .forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName === 'SELECT') el.disabled = abgeleitet;
      else                         el.readOnly = abgeleitet;
      el.style.background = abgeleitet ? '#f8fafc' : '';
      el.style.color      = abgeleitet ? '#6b7280' : '';
    });

  if (abgeleitet) {
    const a = bgAuslegen({
      schichten: list, auslegung: modus,
      massTiefe: document.getElementById('bg-prof-masstiefe')?.value,
      bodentyp:  document.getElementById('bg-prof-bodentyp')?.value,
    });
    const setz = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
    setz('bg-prof-me', a.me);       setz('bg-prof-phi', a.phi);
    setz('bg-prof-gamma', a.gamma); setz('bg-prof-c', a.c);
    setz('bg-prof-uscs', a.uscs);
    if (a.bodentyp) setz('bg-prof-bodentyp', a.bodentyp);
    if (box) box.textContent = a.herkunft + (a.massgebend ? ' · ' + a.massgebend : '');
  } else if (box) {
    box.textContent = list.length
      ? BG_AUSLEGUNG[modus].text
      : 'Ohne Schichtaufbau gelten die Kennwerte unten unverändert.';
  }

  if (typeof updateBgProfilBeurteilung === 'function') updateBgProfilBeurteilung();
}

function onBgAuslegungChange() {
  const modus = document.getElementById('bg-prof-auslegung')?.value || 'manuell';
  const wrap  = document.getElementById('bg-masstiefe-wrap');
  if (wrap) wrap.style.visibility = modus === 'manuell' ? 'hidden' : '';
  bgAuslegungVorschau();
}

// ── ÜBERGABE AN BLOCKCALC ───────────────────────────────────
// BlockCalc nimmt beliebig viele Schichten: {name, phi, c, gamma, gamma2,
// me, d}, die unterste mit d = 999 (durchgehend). Genau in diese Form wird
// hier umgesetzt — die Auslegung als EINE Schicht ist derselbe Aufbau mit
// der Länge eins, damit die Brücke nur einen Weg kennt.
function bgSchichtenFuerBlockCalc(profil, modus) {
  const list = bgSchichten(profil);
  if (modus === 'schichten' && list.length) {
    return list.map((s, i, arr) => ({
      name:   s.name || ('Schicht ' + (i + 1)),
      phi:    bgZahl(s.phi)   ?? 27,
      c:      bgZahl(s.c)     ?? 0,
      gamma:  bgZahl(s.gamma) ?? 20,
      gamma2: bgGamma2(s.gamma),
      me:     bgZahl(s.me)    ?? 25,
      d:      i === arr.length - 1 ? 999 : (bgZahl(s.d) ?? 999),
    }));
  }
  const a = bgAuslegen(profil);
  const gamma = bgZahl(a.gamma) ?? 20;
  return [{
    name:   a.massgebend || (BG_AUSLEGUNG[a.modus]?.kurz + '-Auslegung') || 'Baugrund',
    phi:    bgZahl(a.phi) ?? 27,
    c:      bgZahl(a.c)   ?? 0,
    gamma, gamma2: bgGamma2(gamma),
    me:     bgZahl(a.me)  ?? 25,
    d:      999,
  }];
}
