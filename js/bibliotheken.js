// BAUGRUND-BIBLIOTHEK
// ============================================================
const BG_PROFIL_KEY = () => 'sp_bg_profile__' + _activeId;
const BG_ZUWEISUNG_KEY = () => 'sp_bg_zuweisung__' + _activeId;

function loadBgProfile() {
  try { return jsonParse(store.getItem(BG_PROFIL_KEY())) || []; } catch { return []; }
}
function saveBgProfile(list) { store.setItem(BG_PROFIL_KEY(), JSON.stringify(list)); }

function loadBgZuweisungen() {
  try { return jsonParse(store.getItem(BG_ZUWEISUNG_KEY())) || {}; } catch { return {}; }
}
function saveBgZuweisungen(map) { store.setItem(BG_ZUWEISUNG_KEY(), JSON.stringify(map)); }

let _bgEditId = null;

function renderBaugrundView() {
  renderBgProfileGrid();
  renderBgZuweisungList();
}

// ============================================================
// INSTALLATIONEN-TAB
// ============================================================

// ── Installationskachel ──────────────────────────────────────
// EINE Kachel fuer beide Orte: die Installationsansicht und den Abschnitt
// unten in der Kachelansicht. Vorher gab es zwei Bauarten mit demselben
// Zweck, die verschieden aussahen und getrennt gepflegt werden mussten.
//
// Sie folgt der Standortkachel: .card, Name und Kennzeichen oben, eine
// Kennzahlzeile, ein Untertitel, unten Status und Symbole. Alles Weitere —
// Bestellkette, Dauer, Bemerkung, Bestelllink — steht in der Detailansicht,
// wo Platz dafuer ist. Auf der Kachel zaehlt der Ueberblick.

// Flaeche: gerechnet, wenn Laenge und Breite dastehen. Vorher stand da
// «25×12 m» — die Zahl, auf die es ankommt, musste man im Kopf bilden.
function instFlaeche(p) {
  const zahl = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return n > 0 ? n : null; };
  const l = zahl(p.flaecheL), b = zahl(p.flaecheB);
  return { m2: zahl(p.flaeche) ?? (l && b ? l * b : null), masse: (l && b) ? l + ' × ' + b + ' m' : null };
}

// Dauer in Tagen, beide Enden gezaehlt — eine Flaeche, die einen Tag steht,
// steht einen Tag und nicht null.
function instTage(p) {
  if (!p.von || !p.bis) return null;
  const a = new Date(p.von + 'T00:00:00'), b = new Date(p.bis + 'T00:00:00');
  if (isNaN(a) || isNaN(b)) return null;
  const t = Math.round((b - a) / 86400000) + 1;
  return t > 0 ? t : null;
}

const _instDatum = d => d ? d.split('-').reverse().join('.') : null;
const _instZahl = n => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString('de-CH');

// Die Bestellkette ist die eigentliche Arbeit an einer Installationsflaeche:
// bestellen, auf Rueckmeldung warten, bestaetigt bekommen.
// Auf der Kachel steht das kurze Wort — «Rückmeldung pendent» brach dort um
// und lief aus dem Kennzeichen heraus. Die volle Formulierung steht in der
// Detailansicht, wo Platz dafuer ist.
//
// Dieser Stand ersetzt auf der Installationskachel den allgemeinen Status
// (Geplant / In Ausführung / Abgenommen): der gehoert zu Standorten und
// Sondagen, wird oben im Band gezaehlt und sagt ueber eine bestellte Flaeche
// nichts aus.
const INST_STAENDE = [
  { key: '',                 text: 'Nicht bestellt', lang: 'Noch nicht bestellt',  farbe: '#6b7280', grund: '#f9fafb', rand: '#e5e7eb' },
  { key: 'instBestellt',     text: 'Bestellt',       lang: 'Bestellt',             farbe: '#0369a1', grund: '#f0f9ff', rand: '#bae6fd' },
  { key: 'instRueckmeldung', text: 'Rückmeldung',    lang: 'Rückmeldung pendent',  farbe: '#b45309', grund: '#fffbeb', rand: '#fde68a' },
  { key: 'instBestaetigt',   text: 'Bestätigt',      lang: 'Bestätigt',            farbe: '#15803d', grund: '#f0fdf4', rand: '#bbf7d0' },
];

function instBestellStand(p) {
  if (p.instBestaetigt)   return INST_STAENDE[3];
  if (p.instRueckmeldung) return INST_STAENDE[2];
  if (p.instBestellt)     return INST_STAENDE[1];
  return INST_STAENDE[0];
}

// Bestellfrist: sie ist im Gleistiefbau der Engpass. Gemeldet wird nur, was
// noch NICHT bestaetigt ist — eine abgelaufene Frist an einer bestaetigten
// Flaeche ist keine Nachricht mehr.
function instFristStand(p) {
  if (!p.instFrist || p.instBestaetigt) return null;
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const frist = new Date(p.instFrist + 'T00:00:00');
  if (isNaN(frist)) return null;
  const tage = Math.round((frist - heute) / 86400000);
  if (tage < 0)   return { text: 'Frist überschritten', tage, farbe: '#b91c1c' };
  if (tage <= 14) return { text: 'Frist in ' + tage + ' Tagen', tage, farbe: '#b45309' };
  return null;
}

// Stand setzen: die Kette ist geordnet, also setzt eine Stufe alle darunter
// mit — «bestätigt» heisst, dass bestellt und rueckgemeldet wurde.
function instStandSetzen(pairId, stufe) {
  const p = PAIRS.find(x => x.id === pairId);
  if (!p) return;
  p.instBestellt     = stufe >= 1;
  p.instRueckmeldung = stufe === 2;
  p.instBestaetigt   = stufe >= 3;
  savePairs();
  document.querySelectorAll('.qs-picker').forEach(el => el.classList.remove('open'));
  renderInstallationen();
  if (typeof renderCards === 'function') renderCards();
  if (typeof currentPairId !== 'undefined' && currentPairId === pairId && typeof showDetail === 'function') showDetail(pairId);
}

function instStandPicker(pairId, el) {
  const picker = document.getElementById('inst-picker-' + pairId);
  if (!picker) return;
  const offen = picker.classList.contains('open');
  document.querySelectorAll('.qs-picker').forEach(x => x.classList.remove('open'));
  if (!offen) picker.classList.add('open');
}

function instKachel(p) {
  const typLabel = INST_TYP_LABELS[p.installTyp] || p.installTyp || '—';
  const fl = instFlaeche(p);
  const pd = getPairData(p.id);
  const fotos = (pd.fotos || []).length;
  const notizen = ((typeof loadAllNotizen === 'function' ? loadAllNotizen()[p.id] : null) || []).length;
  const hatOrt = !!(p.rs && p.rs.e && p.rs.n);
  const stand = instBestellStand(p);
  const frist = instFristStand(p);

  const card = document.createElement('div');
  card.className = 'card';
  // Ausgangspunkt fuer den Uebergang in die Detailansicht (js/ui-uebergang.js)
  card.dataset.pairId = p.id;
  card.style.backgroundImage = hatOrt ? 'url(' + cardTileUrl(p) + ')' : '';
  card.style.backgroundColor = getCardBg(pd.status);
  card.addEventListener('click', (e) => {
    if (e.target.closest('.qs-wrap') || e.target.closest('.qs-picker') || e.target.closest('.card-actions')) return;
    showDetail(p.id);
  });

  const sym = (titel, pfad) =>
    '<span title="' + titel + '"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" '
    + 'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + pfad + '</svg></span>';

  card.innerHTML =
    '<div class="card-top">'
    +   '<div class="card-id">' + escHtml(p.bezeichnung || ('Installation ' + p.id)) + '</div>'
    +   '<div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">'
    +     '<div class="card-tag" style="background:white;color:#6b7280;border:1px solid #e5e7eb;">' + escHtml(typLabel) + '</div>'
    +   '</div>'
    + '</div>'
    + '<div class="card-km">' + (fl.m2 ? _instZahl(fl.m2) + ' m²' : '—')
    +   ((p.von || p.bis) ? ' · ' + (_instDatum(p.von) || '?') + ' – ' + (_instDatum(p.bis) || '?') : '') + '</div>'
    + '<div class="card-footer">'
    +   '<div class="qs-wrap" onclick="event.stopPropagation()">'
    +     '<button class="qs-badge" title="' + stand.lang + '" style="background:' + stand.grund
    +       ';color:' + stand.farbe + ';border:1px solid ' + stand.rand + ';font-weight:600;" '
    +       'onclick="instStandPicker(' + p.id + ',this)">' + stand.text + '<span class="qs-chevron">▾</span></button>'
    +     '<div class="qs-picker" id="inst-picker-' + p.id + '">'
    +       INST_STAENDE.map((st, i) =>
            '<div class="qs-opt" onclick="instStandSetzen(' + p.id + ',' + i + ')" style="color:' + st.farbe + ';">'
            + st.text + (stand === st ? ' ✓' : '') + '</div>').join('')
    +     '</div>'
    +   '</div>'
    +   '<div class="card-metas">'
    +     (frist ? '<span title="' + frist.text + '" style="color:' + frist.farbe + ';">'
            + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg></span>' : '')
    +     (p.instAbschaltung ? sym('Abschaltung Fahrleitung erforderlich', '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>') : '')
    +     (hatOrt ? '' : sym('Keine Koordinaten — erscheint nicht auf der Karte', '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'))
    +     (p.instBestellLink ? sym('Bestelllink hinterlegt', '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>') : '')
    +     (fotos ? sym('Fotos', '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>') : '')
    +     (notizen ? sym(notizen + ' Notiz' + (notizen > 1 ? 'en' : ''), '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>') : '')
    +   '</div>'
    + '</div>';
  return card;
}

function renderInstallationen() {
  const container = document.getElementById('installationen-cards');
  if (!container) return;
  const list = getInstallationen();
  container.innerHTML = '';
  if (!list.length) {
    container.innerHTML = '<div style="color:#9ca3af;font-size:13px;padding:24px 0;">Noch keine Installationsflächen erfasst. Klicken Sie auf «+ Installation» um eine neue anzulegen.</div>';
    return;
  }
  list.forEach(p => container.appendChild(instKachel(p)));
}

async function deleteInstallation(id) {
  if (!await ui.confirm('Baustelleninstallation wirklich löschen?', { gefaehrlich: true, ok: 'Löschen' })) return;
  pushUndo();
  const idx = PAIRS.findIndex(p => p.id === id);
  if (idx !== -1) PAIRS.splice(idx, 1);
  savePairs();
  renderCards();
  renderInstallationen();
  if (currentOverviewView === 'liste') renderList();
}

function renderFundtypView() {
  seedDefaultFtProfile();                   // Standardtypen einmalig vorabfüllen falls leer
  seedLeistungsprofile();                   // Standardprofile je Bauart vorabfüllen falls leer
  _initStdFtDefaultLeistungsprofil();       // lp_block als Voreinstellung für Standardfundamente
  renderLpGrid();
  renderFundtypProfilGrid();
  renderStatikBerichte();
}

// ============================================================
// STATIKBERICHTE — Storage & Rendering
// ============================================================
const STATIK_KEY = () => 'sp_statik__' + _activeId;
function loadStatikBerichte() {
  try { return jsonParse(store.getItem(STATIK_KEY())) || { sharepoint: '', berichte: [] }; } catch { return { sharepoint: '', berichte: [] }; }
}
function saveStatikBerichte(d) { store.setItem(STATIK_KEY(), JSON.stringify(d)); }

function renderStatikBerichte() {
  const data = loadStatikBerichte();
  // Global-URL befüllen
  const globalInput = document.getElementById('statik-global-url');
  if (globalInput) globalInput.value = data.sharepoint || '';

  const container = document.getElementById('statik-berichte-list');
  if (!container) return;

  if (!data.berichte.length) {
    container.innerHTML = `<div style="font-size:11px;color:#9ca3af;padding:6px 0;">Noch keine Berichte hinzugefügt. Klicke <em>+ Bericht hinzufügen</em>.</div>`;
    return;
  }

  const typen = loadFtProfile().filter(t => t.typ !== 'standard');
  container.innerHTML = data.berichte.map(b => {
    const linked = (b.ftIds || []).map(id => typen.find(t => t.id === id)?.name).filter(Boolean);
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 11px;background:white;border:1px solid #e5e7eb;border-radius:8px;flex-wrap:wrap;">
      <div style="flex:1;min-width:160px;">
        <div style="font-size:12px;font-weight:700;color:#1a3a5c;margin-bottom:2px;">${b.name}</div>
        ${b.url
          ? `<a href="${b.url}" target="_blank" style="font-size:11px;color:#2563eb;word-break:break-all;">${b.url.length > 60 ? b.url.substring(0,60) + '…' : b.url}</a>`
          : `<span style="font-size:11px;color:#9ca3af;">Kein Link gesetzt</span>`
        }
        ${linked.length ? `<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:3px;">${linked.map(n => `<span style="font-size:9px;background:#f5f3ff;color:#7c3aed;padding:1px 5px;border-radius:3px;border:1px solid #ddd6fe;">${n}</span>`).join('')}</div>` : ''}
        ${b.bemerkung ? `<div style="font-size:10px;color:#6b7280;margin-top:3px;font-style:italic;">${b.bemerkung}</div>` : ''}
      </div>
      <div style="display:flex;gap:5px;flex-shrink:0;align-items:flex-start;">
        ${b.url ? `<a href="${b.url}" target="_blank" style="padding:4px 8px;border-radius:5px;border:1px solid #d1d5db;background:white;font-size:11px;color:#374151;text-decoration:none;">↗</a>` : ''}
        <button onclick="openBerichtModal('${b.id}')" style="padding:4px 8px;border-radius:5px;border:1px solid #d1d5db;background:white;font-size:11px;color:#374151;cursor:pointer;display:inline-flex;align-items:center;">${svgIcon('stift',{groesse:11})}</button>
      </div>
    </div>`;
  }).join('');
}

function saveStatikGlobal() {
  const url = document.getElementById('statik-global-url')?.value?.trim() || '';
  const data = loadStatikBerichte();
  data.sharepoint = url;
  saveStatikBerichte(data);
}

function openStatikGlobal() {
  const url = document.getElementById('statik-global-url')?.value?.trim();
  if (!url) { ui.toast('Bitte zuerst eine URL eingeben und speichern.', 'fehler'); return false; }
  window.open(url, '_blank');
  return false;
}

// ── Bericht Modal ──
let _sbEditId = null;
function openBerichtModal(id) {
  _sbEditId = id;
  const isNew = !id;
  document.getElementById('sb-modal-title').textContent = isNew ? 'Statikbericht erfassen' : 'Statikbericht bearbeiten';
  document.getElementById('sb-delete-btn').style.display = isNew ? 'none' : '';

  const v = (eid, val) => { const el = document.getElementById(eid); if (el) el.value = val || ''; };
  if (!isNew) {
    const b = loadStatikBerichte().berichte.find(x => x.id === id) || {};
    v('sb-name', b.name); v('sb-url', b.url); v('sb-bemerkung', b.bemerkung);
    _sbEditFtIds = b.ftIds ? [...b.ftIds] : [];
  } else {
    v('sb-name', ''); v('sb-url', ''); v('sb-bemerkung', '');
    _sbEditFtIds = [];
  }

  // Spezial-Fundtypen als Checkboxen rendern
  const container = document.getElementById('sb-ft-checkboxes');
  const spez = loadFtProfile().filter(t => t.typ !== 'standard');
  if (!container) { document.getElementById('statik-bericht-modal').style.display = 'flex'; return; }
  if (!spez.length) {
    container.innerHTML = '<div style="font-size:11px;color:#9ca3af;">Noch keine Spezialfundamente in der Bibliothek.</div>';
  } else {
    container.innerHTML = spez.map(t => `
      <label style="display:flex;align-items:center;gap:7px;font-size:12px;color:#374151;padding:5px 7px;border-radius:5px;border:1px solid #e5e7eb;cursor:pointer;">
        <input type="checkbox" value="${t.id}" ${_sbEditFtIds.includes(t.id) ? 'checked' : ''}
          onchange="toggleSbFtId('${t.id}', this.checked)"
          style="accent-color:#7c3aed;width:14px;height:14px;">
        <span><strong>${_ftLabel(t)}</strong> <span style="color:#9ca3af;font-size:10px;">— ${ART_LABEL[t.fundamentArt] || 'Spezial'}</span></span>
      </label>`
    ).join('');
  }
  document.getElementById('statik-bericht-modal').style.display = 'flex';
}

let _sbEditFtIds = [];
function toggleSbFtId(ftId, checked) {
  if (checked) { if (!_sbEditFtIds.includes(ftId)) _sbEditFtIds.push(ftId); }
  else { _sbEditFtIds = _sbEditFtIds.filter(id => id !== ftId); }
}

function openSbUrl() {
  const url = document.getElementById('sb-url')?.value?.trim();
  if (!url) return false;
  window.open(url, '_blank');
  return false;
}

function saveBerichtModal() {
  const v = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const name = v('sb-name');
  if (!name) { ui.toast('Bitte Bezeichnung eingeben.', 'fehler'); return; }
  const bericht = {
    id:        _sbEditId || ('sb_' + Date.now()),
    name,
    url:       v('sb-url'),
    bemerkung: v('sb-bemerkung'),
    ftIds:     [..._sbEditFtIds],
  };
  const data = loadStatikBerichte();
  const idx = data.berichte.findIndex(b => b.id === bericht.id);
  if (idx >= 0) data.berichte[idx] = bericht; else data.berichte.push(bericht);
  saveStatikBerichte(data);
  closeBerichtModal();
  renderStatikBerichte();
  renderFundtypProfilGrid(); // Bericht-Chips auf Kacheln aktualisieren
}

async function deleteBerichtModal() {
  if (!_sbEditId || !await ui.confirm('Statikbericht wirklich löschen?', { gefaehrlich: true, ok: 'Löschen' })) return;
  const data = loadStatikBerichte();
  data.berichte = data.berichte.filter(b => b.id !== _sbEditId);
  saveStatikBerichte(data);
  closeBerichtModal();
  renderStatikBerichte();
  renderFundtypProfilGrid();
}

function closeBerichtModal() {
  document.getElementById('statik-bericht-modal').style.display = 'none';
  _sbEditId = null; _sbEditFtIds = [];
}

// ── Fundamenttyp duplizieren ──
function duplicateFundtyp(id) {
  const list = loadFtProfile();
  const orig = list.find(t => t.id === id);
  if (!orig) return;
  const copy = { ...orig, id: 'ft_' + Date.now(), name: orig.name + ' (Kopie)' };
  list.push(copy);
  saveFtProfile(list);
  renderFundtypProfilGrid();
}

function renderBgProfileGrid() {
  const grid = document.getElementById('baugrund-profile-grid');
  if (!grid) return;
  const profile = loadBgProfile();
  const addTile = `<div class="card" onclick="openBaugrundProfilModal(null)" style="cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80px;border:2px dashed #d1d5db;background:#fafafa;color:#9ca3af;gap:6px;">
    <span style="font-size:22px;line-height:1;">+</span>
    <span style="font-size:11px;font-weight:600;">Profil hinzufügen</span>
  </div>`;
  if (profile.length === 0) {
    grid.innerHTML = addTile;
    return;
  }
  const cards = profile.map(p => {
    const beurteilung = beurteileBgProfil(p);
    const dot = beurteilung.ok
      ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#16a34a;margin-right:5px;"></span>'
      : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#dc2626;margin-right:5px;"></span>';
    const count = Object.values(loadBgZuweisungen()).filter(id => id === p.id).length;
    // Der Aufbau steht neben den Kennwerten, nicht statt ihrer: die Kachel
    // zeigt weiterhin den Satz, mit dem gerechnet wird, und dazu woher er
    // kommt — sonst sieht man einem gemittelten ME nicht an, dass es eines ist.
    const nSch  = bgSchichten(p).length;
    const modus = bgAuslegungModus(p);
    const aufbau = nSch
      ? `<span style="background:#f3f4f6;color:#4b5563;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;margin-right:4px;">${nSch} Schichten · ${BG_AUSLEGUNG[modus].kurz}</span>`
      : '';
    return `<div class="card" onclick="openBaugrundProfilModal('${p.id}')" style="cursor:pointer;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
        <div style="font-size:13px;font-weight:700;color:#1a3a5c;">${p.name}</div>
        <span style="font-size:10px;background:#f3f4f6;padding:2px 7px;border-radius:4px;color:#6b7280;">${count} Standort${count !== 1 ? 'e' : ''}</span>
      </div>
      ${p.beschrieb ? `<div style="font-size:11px;color:#6b7280;margin-bottom:4px;">${p.beschrieb}</div>` : ''}
      <div style="font-size:11px;color:#374151;line-height:1.7;">
        ${aufbau}${p.bodentyp ? `<span style="background:#eff6ff;color:#2563eb;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600;margin-right:4px;">${p.bodentyp === 'fein' ? 'Feinkörnig' : 'Grobkörnig'}</span>` : ''}
        ${p.uscs ? `<span style="background:#f3f4f6;padding:1px 6px;border-radius:3px;font-size:10px;margin-right:4px;">${p.uscs}</span>` : ''}
        ${p.me ? `ME ${p.me} MPa` : ''} ${p.phi ? `· φ'k ${p.phi}°` : ''}
        ${p.gwTiefe ? `· GW bei ${p.gwTiefe} m` : ''} ${p.gwMueM ? `(${p.gwMueM} m ü.M.)` : ''}
      </div>
      <div style="margin-top:5px;font-size:11px;">${dot}${beurteilung.label}</div>
    </div>`;
  }).join('');
  grid.innerHTML = cards + addTile;
}

// ── Baugrund-Zuweisung: Spalten-Konfiguration ───────────────────
const BGZ_COL_DEFS = [
  { id:'massnahme', label:'Massnahme',      def:true  },
  { id:'km',        label:'KM',             def:true  },
  { id:'fundtyp',   label:'Fundamenttyp',   def:true  },
  { id:'profil',    label:'Baugrundprofil', def:true  },
  { id:'uscs',      label:'USCS',           def:true  },
  { id:'me',        label:'ME [MPa]',       def:true  },
  { id:'phi',       label:'φ\' [°]',        def:true  },
  { id:'gamma',     label:'γ [kN/m³]',      def:false },
  { id:'c',         label:'c [kN/m²]',      def:false },
  { id:'gw',        label:'Grundwasser',    def:false },
];
let _bgzCols = null;

function _loadBgzCols() {
  if (_bgzCols) return _bgzCols;
  const raw = store.getItem('bgz_cols__' + _activeId);
  if (raw) { try { _bgzCols = jsonParse(raw); return _bgzCols; } catch(e) {} }
  _bgzCols = {};
  BGZ_COL_DEFS.forEach(c => { _bgzCols[c.id] = c.def !== false; });
  return _bgzCols;
}
function _saveBgzCols() {
  store.setItem('bgz_cols__' + _activeId, JSON.stringify(_bgzCols));
}
function toggleBgzColPanel() {
  const panel = document.getElementById('bgz-col-panel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : '';
  if (!isOpen) {
    const cols = _loadBgzCols();
    panel.innerHTML = `<div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Spalten</div>` +
      BGZ_COL_DEFS.map(c =>
        `<label style="display:flex;align-items:center;gap:8px;padding:3px 0;cursor:pointer;font-size:11px;color:#374151;white-space:nowrap;">
          <input type="checkbox" ${cols[c.id] ? 'checked' : ''} onchange="setBgzCol('${c.id}',this.checked)"
            style="cursor:pointer;width:13px;height:13px;accent-color:#1a3a5c;flex-shrink:0;">
          ${c.label}
        </label>`
      ).join('');
    setTimeout(() => {
      function _bgzColOutside(e) {
        const p2 = document.getElementById('bgz-col-panel');
        const btn = document.getElementById('bgz-col-btn');
        if (p2 && !p2.contains(e.target) && !btn.contains(e.target)) {
          p2.style.display = 'none';
          document.removeEventListener('click', _bgzColOutside, true);
        }
      }
      document.addEventListener('click', _bgzColOutside, true);
    }, 0);
  }
}
function setBgzCol(id, visible) {
  _bgzCols = _loadBgzCols();
  _bgzCols[id] = visible;
  _saveBgzCols();
  renderBgZuweisungList();
}

function renderBgZuweisungList() {
  const table = document.getElementById('baugrund-zuweisung-list');
  if (!table) return;
  const profile     = loadBgProfile();
  const zuweisungen = loadBgZuweisungen();
  const fundamente  = getFundamente();
  const cols        = _loadBgzCols();
  const col         = id => !!cols[id];

  // Zähler-Label und Bulk-Select aktualisieren
  const countLbl = document.getElementById('bgz-count-label');
  if (countLbl) countLbl.textContent = fundamente.length ? `${fundamente.length} Standorte` : '';
  const bulkSel = document.getElementById('bgz-bulk-profil');
  if (bulkSel) {
    const prev = bulkSel.value;
    bulkSel.innerHTML = `<option value="">— kein Profil —</option>` +
      profile.map(pr => `<option value="${pr.id}">${pr.name}</option>`).join('');
    bulkSel.value = prev;
  }

  const visCount = 2 + BGZ_COL_DEFS.filter(c => cols[c.id]).length; // checkbox + Standort + sichtbare + Status
  if (fundamente.length === 0) {
    table.innerHTML = `<tbody><tr><td colspan="${visCount + 1}" style="text-align:center;padding:32px;font-size:12px;color:#9ca3af;">
      Noch keine Fundamentstandorte vorhanden. Diese werden im Bauprojekt erfasst.</td></tr></tbody>`;
    return;
  }

  const allBp  = loadAllBauprojekt();
  const thS    = 'padding:8px 10px;font-size:10px;font-weight:700;text-align:left;white-space:nowrap;color:white;';
  const gwLbls = { nicht_angetroffen:'Nicht angetroffen', angetroffen:'Angetroffen', gespannt:'Gespannt', unbekannt:'Unbekannt' };

  const bkCell = (val, ok) => {
    if (!val && val !== 0) return `<span style="font-size:11px;color:#d1d5db;">—</span>`;
    const c = ok === true ? '#16a34a' : ok === false ? '#dc2626' : '#374151';
    return `<span style="font-size:11px;color:${c};font-weight:${ok !== null ? '600' : '400'};">${val}</span>`;
  };

  const rows = fundamente.map((p, i) => {
    const assignedId = zuweisungen[p.id] || '';
    const assigned   = profile.find(pr => pr.id === assignedId);
    const bpData     = allBp[p.id] || {};
    const massCol    = getMassnahmeColor(bpData);
    const massLbl    = getMassnahmeLabel(bpData);
    const massSet    = bpData.bestand || (bpData.fundtyp || '').startsWith('spezial-prov');
    const fundtyp    = bpData.fundtyp || p.fundtyp || '';
    const km         = p.km_rs ? parseFloat(p.km_rs).toFixed(3) : '—';
    const bg         = i % 2 === 0 ? '#ffffff' : '#f9fafb';

    // BK-Werte: bevorzugt aus zugewiesenem Profil, sonst aus BP-Daten
    const meVal  = (assigned?.me   || bpData.bkMe)    || '';
    const phiVal = (assigned?.phi  || bpData.bkPhi)   || '';
    const gamVal = (assigned?.gamma|| bpData.bkGamma) || '';
    const cVal   = (assigned?.c    || bpData.bkC)     || '';
    const uscsVal= (assigned?.uscs || bpData.bkUscs)  || '';
    const gwEnum = (assigned?.grundwasser || bpData.bkGrundwasser) || '';
    const gwVal  = gwLbls[gwEnum] || gwEnum || '';

    const normBt = assigned?.bodentyp || ((bpData.bkBodentyp === 'fein' || bpData.bkBodentyp === 'grob') ? bpData.bkBodentyp : _uscsToBodentyp(bpData.bkBodentyp));
    const grenz  = BK_GRENZWERTE[normBt] || BK_GRENZWERTE.fein;
    const meNum  = parseFloat(meVal);
    const phiNum = parseFloat(phiVal);
    const meOk   = !isNaN(meNum)  ? (meNum  >= grenz.me) : null;
    const phiOk  = !isNaN(phiNum) ? (phiNum >= 27)       : null;

    const statusBadge = assigned ? (() => {
      const b = beurteileBgProfil(assigned);
      if (b.ok === true)  return `<span style="font-size:10px;color:#16a34a;font-weight:700;background:#dcfce7;padding:3px 8px;border-radius:5px;white-space:nowrap;">✓ Erfüllt</span>`;
      if (b.ok === false) return `<span style="font-size:10px;color:#dc2626;font-weight:700;background:#fee2e2;padding:3px 8px;border-radius:5px;white-space:nowrap;" title="${b.label}">✗ Nicht erfüllt</span>`;
      return `<span style="font-size:10px;color:#9ca3af;font-weight:600;background:#f3f4f6;padding:3px 8px;border-radius:5px;white-space:nowrap;">— k.A.</span>`;
    })() : `<span style="font-size:10px;color:#d1d5db;padding:3px 8px;white-space:nowrap;">—</span>`;

    const selOpts = profile.map(pr =>
      `<option value="${pr.id}" ${assignedId === pr.id ? 'selected' : ''}>${pr.name}</option>`
    ).join('');

    const tdS = 'padding:8px 10px;';
    return `<tr class="list-hover-row" style="background:${bg};cursor:pointer;"
        onclick="event.target.type!=='checkbox'&&event.target.tagName!=='SELECT'&&showDetail(${p.id})">
      <td style="${tdS}" onclick="event.stopPropagation()">
        <input type="checkbox" class="bgz-row-cb" data-id="${p.id}" onchange="bgzUpdateBulkBar()"
          style="cursor:pointer;width:14px;height:14px;accent-color:#1a3a5c;">
      </td>
      <td style="${tdS}">
        <span style="font-size:12px;font-weight:700;color:#1a3a5c;">${standortName(p)}</span>
      </td>
      ${col('massnahme') ? `<td style="${tdS}white-space:nowrap;">${massSet
        ? `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;background:${massCol}22;color:${massCol};border:1px solid ${massCol}44;">${massLbl}</span>`
        : `<span style="font-size:10px;color:#d1d5db;">—</span>`}</td>` : ''}
      ${col('km')       ? `<td style="${tdS}font-size:11px;color:#6b7280;">${km}</td>` : ''}
      ${col('fundtyp')  ? `<td style="${tdS}font-size:11px;color:#374151;">${fundtyp || '—'}</td>` : ''}
      ${col('profil')   ? `<td style="${tdS}" onclick="event.stopPropagation()">
        <select onchange="assignBgProfil(${p.id},this.value)"
          style="padding:4px 6px;border:1px solid #e5e7eb;border-radius:5px;font-size:11px;font-family:inherit;background:white;min-width:140px;">
          <option value="">— kein Profil —</option>${selOpts}
        </select></td>` : ''}
      ${col('uscs')     ? `<td style="${tdS}font-size:11px;color:#374151;">${uscsVal || '—'}</td>` : ''}
      ${col('me')       ? `<td style="${tdS}">${bkCell(meVal, meOk)}</td>` : ''}
      ${col('phi')      ? `<td style="${tdS}">${bkCell(phiVal, phiOk)}</td>` : ''}
      ${col('gamma')    ? `<td style="${tdS}font-size:11px;color:#374151;">${gamVal || '—'}</td>` : ''}
      ${col('c')        ? `<td style="${tdS}font-size:11px;color:#374151;">${cVal || '—'}</td>` : ''}
      ${col('gw')       ? `<td style="${tdS}font-size:11px;color:#374151;">${gwVal || '—'}</td>` : ''}
      <td style="${tdS}">${statusBadge}</td>
    </tr>`;
  }).join('');

  table.innerHTML = `
    <thead>
      <tr style="background:#1a3a5c;">
        <th style="padding:8px 10px;width:34px;">
          <input type="checkbox" id="bgz-all-cb" onchange="bgzSelectAll(this.checked)"
            style="cursor:pointer;width:14px;height:14px;accent-color:#fff;">
        </th>
        <th style="${thS}">Standort</th>
        ${col('massnahme') ? `<th style="${thS}">Massnahme</th>` : ''}
        ${col('km')        ? `<th style="${thS}">KM</th>` : ''}
        ${col('fundtyp')   ? `<th style="${thS}">Fundamenttyp</th>` : ''}
        ${col('profil')    ? `<th style="${thS}">Baugrundprofil</th>` : ''}
        ${col('uscs')      ? `<th style="${thS}">USCS</th>` : ''}
        ${col('me')        ? `<th style="${thS}">ME [MPa]</th>` : ''}
        ${col('phi')       ? `<th style="${thS}">φ' [°]</th>` : ''}
        ${col('gamma')     ? `<th style="${thS}">γ [kN/m³]</th>` : ''}
        ${col('c')         ? `<th style="${thS}">c [kN/m²]</th>` : ''}
        ${col('gw')        ? `<th style="${thS}">Grundwasser</th>` : ''}
        <th style="${thS}">Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>`;
}

function bgzUpdateBulkBar() {
  const selected = document.querySelectorAll('.bgz-row-cb:checked').length;
  const total    = document.querySelectorAll('.bgz-row-cb').length;
  const bar  = document.getElementById('bgz-bulk-bar');
  const lbl  = document.getElementById('bgz-bulk-count-lbl');
  const allCb = document.getElementById('bgz-all-cb');
  if (bar) bar.style.display = selected > 0 ? 'flex' : 'none';
  if (lbl) lbl.textContent = `${selected} von ${total} ausgewählt`;
  if (allCb) allCb.indeterminate = selected > 0 && selected < total;
  if (allCb && selected === total && total > 0) allCb.checked = true;
  if (allCb && selected === 0) allCb.checked = false;
}

function bgzSelectAll(checked) {
  document.querySelectorAll('.bgz-row-cb').forEach(cb => cb.checked = checked);
  bgzUpdateBulkBar();
}

function applyBgzBulk() {
  const profilId = document.getElementById('bgz-bulk-profil')?.value || '';
  const selected = [...document.querySelectorAll('.bgz-row-cb:checked')].map(cb => +cb.dataset.id);
  if (!selected.length) return;
  const zuweisungen = loadBgZuweisungen();
  selected.forEach(pairId => {
    if (profilId) zuweisungen[pairId] = profilId;
    else delete zuweisungen[pairId];
  });
  saveBgZuweisungen(zuweisungen);
  renderBgZuweisungList();
  renderBgProfileGrid();
}

// Baugrund-Zuweisung Excel-Export
function exportBgzXlsx() {
  if (typeof XLSX === 'undefined') { ui.toast('SheetJS nicht geladen.', 'fehler'); return; }
  const profile     = loadBgProfile();
  const zuweisungen = loadBgZuweisungen();
  const fundamente  = getFundamente();
  const allBp       = loadAllBauprojekt();
  const rows = [['Standort', 'KM', 'Fundamenttyp', 'Baugrundprofil', 'Status']];
  fundamente.forEach(p => {
    const assignedId = zuweisungen[p.id] || '';
    const assigned   = profile.find(pr => pr.id === assignedId);
    const bpData     = allBp[p.id] || {};
    const fundtyp    = bpData.fundtyp || p.fundtyp || '';
    const km         = p.km_rs ? parseFloat(p.km_rs).toFixed(3) : '';
    let status = '—';
    if (assigned) { const b = beurteileBgProfil(assigned); status = b.ok === true ? 'Erfüllt' : b.ok === false ? 'Nicht erfüllt' : 'k.A.'; }
    rows.push([`${standortName(p)}`, km, fundtyp, assigned ? assigned.name : '', status]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Baugrund');
  XLSX.writeFile(wb, `Baugrund_Zuweisung_${new Date().toLocaleDateString('de-CH').replace(/\./g,'-')}.xlsx`);
}

// Baugrund-Zuweisung PDF-Export
function exportBgzPdf() {
  const jsPDFLib = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFLib) { ui.toast('jsPDF nicht geladen.', 'fehler'); return; }
  const doc         = new jsPDFLib({ orientation:'portrait', unit:'mm', format:'a4' });
  const profile     = loadBgProfile();
  const zuweisungen = loadBgZuweisungen();
  const fundamente  = getFundamente();
  const allBp       = loadAllBauprojekt();
  const pn          = getActiveProjectName() || 'Projekt';
  const date        = new Date().toLocaleDateString('de-CH');

  doc.setFillColor(26,58,92); doc.rect(0,0,210,3,'F');
  doc.setFontSize(12); doc.setFont(undefined,'bold'); doc.setTextColor(26,58,92);
  doc.text('Baugrund-Zuweisung · ' + pn, 14, 11);
  doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.setTextColor(107,114,128);
  doc.text(date + ' · ' + fundamente.length + ' Standorte', 14, 17);
  doc.setDrawColor(229,231,235); doc.line(14,20,196,20);

  const cols = [55, 28, 45, 45, 28]; // widths
  const xs   = [14, 69, 97, 142, 187];
  let y = 28;

  const drawHeader = () => {
    doc.setFillColor(26,58,92); doc.rect(14, y-4, 182, 7, 'F');
    doc.setFontSize(7); doc.setFont(undefined,'bold'); doc.setTextColor(255,255,255);
    ['Standort','KM','Fundamenttyp','Baugrundprofil','Status'].forEach((h,i) => doc.text(h, xs[i], y));
    y += 7; doc.setTextColor(30,30,30);
  };
  drawHeader();

  fundamente.forEach((p, ri) => {
    if (y > 272) { doc.addPage(); y = 14; drawHeader(); }
    const assignedId = zuweisungen[p.id] || '';
    const assigned   = profile.find(pr => pr.id === assignedId);
    const bpData     = allBp[p.id] || {};
    const fundtyp    = bpData.fundtyp || p.fundtyp || '—';
    const km         = p.km_rs ? parseFloat(p.km_rs).toFixed(3) : '—';
    let status = '—'; let sCol = [150,150,150];
    if (assigned) { const b = beurteileBgProfil(assigned); status = b.ok === true ? '✓ Erfüllt' : b.ok === false ? '✗ Nicht erfüllt' : 'k.A.'; sCol = b.ok === true ? [22,163,74] : b.ok === false ? [220,38,38] : [150,150,150]; }
    if (ri % 2 === 1) { doc.setFillColor(248,250,252); doc.rect(14, y-4, 182, 6, 'F'); }
    doc.setFont(undefined,'bold'); doc.setFontSize(7); doc.setTextColor(30,30,30);
    doc.text(`${standortName(p)}`, xs[0], y);
    doc.setFont(undefined,'normal');
    doc.text(km, xs[1], y);
    doc.text(doc.splitTextToSize(fundtyp, 43)[0], xs[2], y);
    doc.text(assigned ? doc.splitTextToSize(assigned.name, 43)[0] : '—', xs[3], y);
    doc.setTextColor(...sCol);
    doc.text(status, xs[4], y);
    doc.setTextColor(30,30,30);
    y += 6;
  });
  doc.save(`Baugrund_Zuweisung_${date.replace(/\./g,'-')}.pdf`);
}

function assignBgProfil(pairId, profilId) {
  const zuweisungen = loadBgZuweisungen();
  const profilName = profilId ? (loadBgProfile().find(p => p.id === profilId)?.name || profilId) : '(entfernt)';
  logChange(pairId, 'Baugrundprofil', profilName, 'baugrund');
  if (profilId) zuweisungen[pairId] = profilId;
  else delete zuweisungen[pairId];
  saveBgZuweisungen(zuweisungen);
  // Baugrundkennwerte automatisch in BP-Speicher übernehmen
  if (profilId) {
    const profil = loadBgProfile().find(p => p.id === profilId);
    if (profil) {
      const all = loadAllBauprojekt();
      all[pairId] = {
        ...(all[pairId] || {}),
        bkBodentyp:    profil.bodentyp || 'fein',
        bkMe:          profil.me       || '',
        bkPhi:         profil.phi      || '',
        bkGamma:       profil.gamma    || '',
        bkC:           profil.c        || '',
        bkGrundwasser: profil.grundwasser || '',
        bgProfilId:    profilId,
      };
      saveAllBauprojekt(all);
    }
  }
  renderBgZuweisungList();
}

function beurteileBgProfil(p) {
  const grenz = BK_GRENZWERTE[p.bodentyp || 'fein'];
  const results = [];
  if (p.me)  results.push(parseFloat(p.me) >= grenz.me);
  if (p.phi) results.push(parseFloat(p.phi) >= 27);
  // Grundwasser wird nur dokumentiert, nicht bewertet
  if (results.length === 0) return { ok: null, label: 'Nicht beurteilt' };
  const ok = results.every(r => r);
  return { ok, label: ok ? 'Einsatzbedingungen erfüllt' : 'Einsatzbedingungen nicht erfüllt' };
}

function openBaugrundProfilModal(id) {
  _bgEditId = id;
  const isNew = !id;
  document.getElementById('baugrund-profil-modal-title').textContent = isNew ? 'Baugrundprofil erfassen' : 'Baugrundprofil bearbeiten';
  document.getElementById('bg-prof-delete-btn').style.display = isNew ? 'none' : '';

  // Zahlenfelder verwerfen jeden Wert, den der Browser nicht als Zahl liest.
  // Ältere Importe haben Bereichsangaben («1-50») als Text abgelegt — das Feld
  // blieb dann kommentarlos leer, während die Liste den Text weiter anzeigte.
  // Für solche Werte wird der untere Wert eingesetzt, wie beim Import auch.
  const v = (elId, val) => {
    const el = document.getElementById(elId);
    if (!el) return;
    let s = val == null ? '' : String(val);
    if (el.type === 'number' && s && isNaN(Number(s))) {
      const z = parseFloat(s.replace(',', '.'));
      s = isNaN(z) ? '' : String(z);
    }
    el.value = s;
  };
  if (!isNew) {
    const p = loadBgProfile().find(x => x.id === id) || {};
    v('bg-prof-name',       p.name);
    v('bg-prof-beschrieb',  p.beschrieb);
    v('bg-prof-bodentyp',   p.bodentyp);
    v('bg-prof-uscs',       p.uscs);
    v('bg-prof-me',         p.me);
    v('bg-prof-phi',        p.phi);
    v('bg-prof-gamma',      p.gamma || '');
    v('bg-prof-c',          p.c     || '');
    v('bg-prof-grundwasser',p.grundwasser);
    v('bg-prof-gw-tiefe',   p.gwTiefe);
    v('bg-prof-gw-mueM',    p.gwMueM);
    v('bg-prof-bemerkung',  p.bemerkung);
    v('bg-prof-auslegung',  bgAuslegungModus(p));
    v('bg-prof-masstiefe',  p.massTiefe);
    bgSchichtenLaden(p);
  } else {
    ['bg-prof-name','bg-prof-beschrieb','bg-prof-uscs','bg-prof-me','bg-prof-phi','bg-prof-gamma','bg-prof-c','bg-prof-gw-tiefe','bg-prof-bemerkung'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    v('bg-prof-bodentyp',''); v('bg-prof-grundwasser','');
    v('bg-prof-auslegung','manuell'); v('bg-prof-masstiefe','');
    const gwEl = document.getElementById('bg-prof-gw-mueM'); if (gwEl) gwEl.value = '';
    bgSchichtenLaden(null);
  }
  onBgAuslegungChange();
  updateBgProfilBeurteilung();
  document.getElementById('baugrund-profil-modal').style.display = 'flex';
}

function closeBaugrundProfilModal() {
  document.getElementById('baugrund-profil-modal').style.display = 'none';
  _bgEditId = null;
}

function updateBgProfilBeurteilung() {
  const el = document.getElementById('bg-prof-beurteilung');
  if (!el) return;
  const bodentyp   = document.getElementById('bg-prof-bodentyp')?.value || 'fein';
  const me         = parseFloat(document.getElementById('bg-prof-me')?.value);
  const phi        = parseFloat(document.getElementById('bg-prof-phi')?.value);
  const gw         = document.getElementById('bg-prof-grundwasser')?.value;
  const grenz      = BK_GRENZWERTE[bodentyp];
  const lines = [];
  if (!isNaN(me)) {
    const ok = me >= grenz.me;
    lines.push(`<span style="color:${ok?'#16a34a':'#dc2626'};">ME: ${me} MPa ${ok?'≥':'<'} ${grenz.me} MPa (${ok?'OK':'nicht erfüllt'})</span>`);
  }
  if (!isNaN(phi)) {
    const ok = phi >= 27;
    lines.push(`<span style="color:${ok?'#16a34a':'#dc2626'};">φ'k: ${phi}° ${ok?'≥':'<'} 27° (${ok?'OK':'nicht erfüllt'})</span>`);
  }
  if (gw) {
    const gwMueM = document.getElementById('bg-prof-gw-mueM')?.value;
    const gwLabels = { nicht_angetroffen: 'Nicht angetroffen', angetroffen: 'Angetroffen', gespannt: 'Gespannt', unbekannt: 'Unbekannt' };
    const gwText = gwLabels[gw] || gw;
    const kote = gwMueM ? ` (${gwMueM} m ü. M.)` : '';
    lines.push(`<span style="color:#374151;">Grundwasser: ${gwText}${kote}</span>`);
  }
  el.innerHTML = lines.length ? lines.join(' · ') : '<span style="color:#9ca3af;">Werte eingeben für Beurteilung</span>';
}

function saveBaugrundProfil() {
  const v = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const name = v('bg-prof-name');
  if (!name) { ui.toast('Bitte Profilname eingeben.', 'fehler'); return; }
  const profil = {
    id:          _bgEditId || ('bg_' + Date.now()),
    name,
    beschrieb:   v('bg-prof-beschrieb'),
    bodentyp:    v('bg-prof-bodentyp'),
    uscs:        v('bg-prof-uscs'),
    me:          v('bg-prof-me'),
    phi:         v('bg-prof-phi'),
    gamma:       v('bg-prof-gamma'),
    c:           v('bg-prof-c'),
    grundwasser: v('bg-prof-grundwasser'),
    gwTiefe:     v('bg-prof-gw-tiefe'),
    gwMueM:      v('bg-prof-gw-mueM'),
    bemerkung:   v('bg-prof-bemerkung'),
    // Der Aufschluss. Die Kennwerte darueber sind bei GEO/ING daraus
    // hergeleitet und werden trotzdem flach gespeichert — genau so lesen
    // Liste, Zuweisung und Export sie unveraendert weiter.
    schichten:   bgSchichtenSammeln(),
    auslegung:   v('bg-prof-auslegung') || 'manuell',
    massTiefe:   v('bg-prof-masstiefe'),
  };
  const list = loadBgProfile();
  const idx = list.findIndex(p => p.id === profil.id);
  if (idx >= 0) list[idx] = profil; else list.push(profil);
  saveBgProfile(list);

  // Zugewiesene Standorte aktualisieren
  const zuweisungen = loadBgZuweisungen();
  Object.entries(zuweisungen).forEach(([pairId, profilId]) => {
    if (profilId === profil.id) assignBgProfil(parseInt(pairId), profil.id);
  });

  // Auto-Zuweisung wenn aus Bodenkennwerte-Sidebar aufgerufen
  const autoAssignId = _bgAutoAssignPairId;
  _bgAutoAssignPairId = null;
  if (autoAssignId) {
    assignBgProfil(autoAssignId, profil.id);
    if (autoAssignId === currentPairId) {
      loadBauprojektFelder(currentPairId);
      updateBodenkennwerteUI();
      updateBkProfilInfo();
    }
  }

  closeBaugrundProfilModal();
  renderBaugrundView();
}

async function deleteBaugrundProfil() {
  if (!_bgEditId || !await ui.confirm('Profil wirklich löschen?', { gefaehrlich: true, ok: 'Löschen' })) return;
  const list = loadBgProfile().filter(p => p.id !== _bgEditId);
  saveBgProfile(list);
  // Zuweisungen entfernen
  const zuweisungen = loadBgZuweisungen();
  Object.keys(zuweisungen).forEach(k => { if (zuweisungen[k] === _bgEditId) delete zuweisungen[k]; });
  saveBgZuweisungen(zuweisungen);
  closeBaugrundProfilModal();
  renderBaugrundView();
}

// ============================================================
// SCHICHT-BIBLIOTHEK
// ============================================================
const SP_SCHICHT_KEY = () => 'sp_schichten__' + _activeId;
function loadSchichten()     { try { return jsonParse(store.getItem(SP_SCHICHT_KEY())) || []; } catch { return []; } }
function saveSchichten(list) { store.setItem(SP_SCHICHT_KEY(), JSON.stringify(list)); }

function schichtLabel(schichtId) {
  if (!schichtId) return '—';
  const s = loadSchichten().find(x => x.id === schichtId);
  return s ? s.name : schichtId;
}

function schichtForPair(pairId) {
  const p = PAIRS.find(x => x.id === pairId);
  if (!p?.schichtId) return null;
  return loadSchichten().find(s => s.id === p.schichtId) || null;
}

let _schichtEditId = null;

function renderSchichtBibliothek() {
  const list  = loadSchichten();
  const grid  = document.getElementById('schicht-grid');
  const empty = document.getElementById('schicht-empty');
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';
  const TYP_LBL = { tag: 'Tagarbeit', nacht: 'Nachtarbeit', gemischt: 'Gemischt' };
  grid.innerHTML = list.map(s => `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;background:white;display:flex;align-items:center;gap:10px;">
      <div style="width:10px;height:10px;border-radius:50%;background:${s.farbe||'#1a3a5c'};flex-shrink:0;"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:700;color:#1a3a5c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.name}</div>
        <div style="font-size:10px;color:#6b7280;">${TYP_LBL[s.typ] || s.typ}${s.beschreibung ? ' · ' + s.beschreibung : ''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
        <span style="font-size:10px;color:#9ca3af;">${PAIRS.filter(p=>p.schichtId===s.id).length} Std.</span>
        <button onclick="openSchichtModal('${s.id}')"
          style="padding:3px 8px;border-radius:5px;border:1px solid #d1d5db;background:#f9fafb;font-size:11px;cursor:pointer;color:#374151;">&#9998;</button>
      </div>
    </div>`).join('');
}

function renderSchichtZuweisungList() {
  const wrap = document.getElementById('schicht-zuweisung-list');
  if (!wrap) return;
  const list  = loadSchichten();
  const pairs = PAIRS;
  if (!pairs.length) { wrap.innerHTML = '<div style="font-size:11px;color:#9ca3af;padding:4px 0;">Keine Standorte vorhanden.</div>'; return; }
  const baseOpts = `<option value="">— keine —</option>` + list.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  wrap.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead><tr style="background:#f3f4f6;">
        <th style="padding:6px 8px;text-align:left;font-weight:700;color:#6b7280;border-radius:4px 0 0 0;">Standort</th>
        <th style="padding:6px 8px;text-align:left;font-weight:700;color:#6b7280;">KM</th>
        <th style="padding:6px 8px;text-align:left;font-weight:700;color:#6b7280;border-radius:0 4px 0 0;">Schicht</th>
      </tr></thead>
      <tbody>${pairs.map(p => {
        const km  = p.km_rs ? parseFloat(p.km_rs).toFixed(3) : (p.km_rks ? parseFloat(p.km_rks).toFixed(3) : '—');
        const lbl = standortName(p);
        const opts = baseOpts.replace(`value="${p.schichtId||''}"`, `value="${p.schichtId||''}" selected`);
        return `<tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:5px 8px;color:#374151;font-weight:600;">${lbl}</td>
          <td style="padding:5px 8px;color:#6b7280;">${km}</td>
          <td style="padding:5px 8px;">
            <select style="font-size:11px;padding:2px 5px;border:1px solid #e5e7eb;border-radius:4px;background:white;font-family:inherit;"
              onchange="assignSchicht(${p.id},this.value)">${opts}</select>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}

function assignSchicht(pairId, schichtId) {
  const p = PAIRS.find(x => x.id === pairId);
  if (!p) return;
  if (schichtId) p.schichtId = schichtId; else delete p.schichtId;
  savePairs();
  renderSchichtBibliothek();
  if (currentPairId === pairId) renderMetaSection(p);
}

function openSchichtModal(id) {
  _schichtEditId = id || null;
  const isNew = !id;
  document.getElementById('schicht-modal-title').textContent = isNew ? 'Schicht erfassen' : 'Schicht bearbeiten';
  document.getElementById('schicht-delete-btn').style.display = isNew ? 'none' : '';
  const s = id ? loadSchichten().find(x => x.id === id) : null;
  document.getElementById('sch-name').value         = s?.name         || '';
  document.getElementById('sch-typ').value          = s?.typ          || 'tag';
  document.getElementById('sch-farbe').value        = s?.farbe        || '#1a3a5c';
  document.getElementById('sch-beschreibung').value = s?.beschreibung || '';
  document.getElementById('schicht-modal').style.display = 'flex';
}

function closeSchichtModal() {
  document.getElementById('schicht-modal').style.display = 'none';
  _schichtEditId = null;
}

function saveSchichtModal() {
  const name = document.getElementById('sch-name').value.trim();
  if (!name) { ui.toast('Bitte eine Bezeichnung eingeben.', 'fehler'); return; }
  const list  = loadSchichten();
  const entry = {
    id:           _schichtEditId || (Date.now().toString(36) + Math.random().toString(36).slice(2)),
    name,
    typ:          document.getElementById('sch-typ').value,
    farbe:        document.getElementById('sch-farbe').value,
    beschreibung: document.getElementById('sch-beschreibung').value.trim(),
  };
  if (_schichtEditId) {
    const idx = list.findIndex(x => x.id === _schichtEditId);
    if (idx !== -1) list[idx] = entry; else list.push(entry);
  } else {
    list.push(entry);
  }
  saveSchichten(list);
  closeSchichtModal();
  renderSchichtBibliothek();
}

async function deleteSchichtFromModal() {
  if (!_schichtEditId || !await ui.confirm('Schicht löschen? Alle Zuweisungen werden entfernt.', { gefaehrlich: true, ok: 'Löschen' })) return;
  saveSchichten(loadSchichten().filter(x => x.id !== _schichtEditId));
  PAIRS.forEach(p => { if (p.schichtId === _schichtEditId) delete p.schichtId; });
  savePairs();
  closeSchichtModal();
  renderSchichtBibliothek();
}

// Schicht automatisch aus pair.tag / pair.nacht registrieren (Kurzbezeichnung → Bibliothek)
function autoRegisterSchicht(name, typ) {
  const n = (name || '').trim();
  if (!n) return;
  const list = loadSchichten();
  // Deduplizierung: gleicher Name (case-insensitive) → kein neuer Eintrag
  if (list.some(s => s.name.trim().toLowerCase() === n.toLowerCase())) return;
  list.push({
    id:           Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name:         n,
    typ:          typ || 'tag',
    farbe:        typ === 'nacht' ? '#1e3a5f' : '#1a3a5c',
    beschreibung: '',
  });
  saveSchichten(list);
}

// Aus einer Liste von Pairs alle tag/nacht-Werte in die Bibliothek eintragen
function autoRegisterSchichtenFromPairs(pairs) {
  (pairs || []).forEach(p => {
    if (p.tag)   autoRegisterSchicht(p.tag,   'tag');
    if (p.nacht) autoRegisterSchicht(p.nacht, 'nacht');
  });
}

// Datalists für tag/nacht-Eingabefelder mit aktuellen Bibliotheks-Einträgen befüllen
function updateSchichtDatalist() {
  const list = loadSchichten();
  ['schicht-tag-datalist','schicht-nacht-datalist'].forEach(id => {
    const dl = document.getElementById(id);
    if (!dl) return;
    dl.innerHTML = list.map(s => `<option value="${s.name}">`).join('');
  });
}

// ============================================================
// SPERRMUSTER-BIBLIOTHEK
// ============================================================
const SP_MUSTER_KEY = () => 'sp_sperrmuster__' + _activeId;

function loadSperrmuster() {
  try { return jsonParse(store.getItem(SP_MUSTER_KEY())) || []; } catch { return []; }
}
function saveSperrmuster(list) { store.setItem(SP_MUSTER_KEY(), JSON.stringify(list)); }

let _spModalId = null;

// Berechnet Intervalldauer aus Von/Bis-Zeiten (berücksichtigt Mitternachtsübergang)
function calcSpNettoH() {
  const von = document.getElementById('sp-von')?.value;
  const bis = document.getElementById('sp-bis')?.value;
  const field = document.getElementById('sp-netto-h');
  if (!von || !bis || !field) return;
  const [vh, vm] = von.split(':').map(Number);
  const [bh, bm] = bis.split(':').map(Number);
  let diffMin = (bh * 60 + bm) - (vh * 60 + vm);
  if (diffMin <= 0) diffMin += 24 * 60; // Mitternachtsübergang (z.B. 22:00–04:00)
  const h = Math.round(diffMin / 60 * 4) / 4; // auf 0.25 h runden
  field.value = h;
}

function openSperrmusterModal(id) {
  _spModalId = id;
  const modal = document.getElementById('sperrmuster-modal');
  if (!modal) return;

  const sp = id ? loadSperrmuster().find(x => x.id === id) : null;
  document.getElementById('sp-modal-title').textContent = id ? 'Sperrmuster bearbeiten' : 'Sperrmuster erfassen';
  document.getElementById('sp-delete-btn').style.display = id ? '' : 'none';

  // Felder befüllen
  document.getElementById('sp-name').value = sp?.name || '';
  document.getElementById('sp-typ').value = sp?.typ || 'nacht';
  document.getElementById('sp-farbe').value = sp?.farbe || '#1a3a5c';
  document.getElementById('sp-von').value = sp?.von || '';
  document.getElementById('sp-bis').value = sp?.bis || '';
  document.getElementById('sp-netto-h').value = sp?.nettoH || '';
  document.getElementById('sp-gleissperrung').value = sp?.gleissperrung || 'keine';
  document.getElementById('sp-gleis-nr').value      = sp?.gleisNr       || '';
  document.getElementById('sp-fl').value            = sp?.fl            || 'neutral';
  document.getElementById('sp-gueltig-von').value   = sp?.gueltigVon    || '';
  document.getElementById('sp-gueltig-bis').value   = sp?.gueltigBis    || '';
  document.getElementById('sp-bemerkung').value = sp?.bemerkung || '';

  // Wochentage
  document.querySelectorAll('.sp-wochentag').forEach(cb => {
    cb.checked = (sp?.wochentage || [1,2,3,4]).includes(parseInt(cb.value));
  });

  modal.style.display = 'flex';
}

function closeSperrmusterModal() {
  const modal = document.getElementById('sperrmuster-modal');
  if (modal) modal.style.display = 'none';
}

function saveSperrmusterModal() {
  const name = document.getElementById('sp-name').value.trim();
  if (!name) { ui.toast('Bitte Bezeichnung eingeben.', 'fehler'); return; }
  const list = loadSperrmuster();
  const sp = {
    id:               _spModalId || ('sp_' + Date.now()),
    name,
    typ:              document.getElementById('sp-typ').value,
    farbe:            document.getElementById('sp-farbe').value,
    wochentage:       Array.from(document.querySelectorAll('.sp-wochentag:checked')).map(el => parseInt(el.value)),
    von:              document.getElementById('sp-von').value,
    bis:              document.getElementById('sp-bis').value,
    nettoH:           parseFloat(document.getElementById('sp-netto-h').value) || null,
    gleissperrung:    document.getElementById('sp-gleissperrung').value,
    gleisNr:          document.getElementById('sp-gleis-nr').value.trim() || null,
    fl:               document.getElementById('sp-fl').value,
    gueltigVon:       document.getElementById('sp-gueltig-von').value || null,
    gueltigBis:       document.getElementById('sp-gueltig-bis').value || null,
    bemerkung:        document.getElementById('sp-bemerkung').value.trim(),
  };
  if (_spModalId) {
    const idx = list.findIndex(x => x.id === _spModalId);
    if (idx >= 0) list[idx] = sp; else list.push(sp);
  } else {
    list.push(sp);
  }
  saveSperrmuster(list);
  closeSperrmusterModal();
  renderSperrmusterBibliothek();
  renderAusfPlanungInline();
}

async function deleteSperrmusterFromModal() {
  if (!_spModalId || !await ui.confirm('Sperrmuster löschen?', { gefaehrlich: true, ok: 'Löschen' })) return;
  saveSperrmuster(loadSperrmuster().filter(x => x.id !== _spModalId));
  closeSperrmusterModal();
  renderSperrmusterBibliothek();
  renderAusfPlanungInline();
}

function renderSperrmusterBibliothek() {
  const grid = document.getElementById('sperrmuster-grid');
  const emptyMsg = document.getElementById('sperrmuster-empty');
  if (!grid) return;

  const list = loadSperrmuster();
  if (emptyMsg) emptyMsg.style.display = list.length ? 'none' : 'block';
  if (!list.length) { grid.innerHTML = ''; }

  const WD = ['So','Mo','Di','Mi','Do','Fr','Sa'];
  const TYP = { tag:'Tagarbeit', nacht:'Nachtsperrung', wochenende:'Wochenende', sonstig:'Individual' };
  const GL  = { keine:'Keine Sperrung', teil:'Teilsperrung', voll:'Vollsperrung' };
  const BADGE = 'padding:2px 7px;border-radius:10px;font-size:10px;font-weight:600;background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;';
  const fmtD = s => { if (!s) return ''; const [y,m,d] = s.split('-'); return `${d}.${m}.${y}`; };

  grid.innerHTML = list.map(sp => {
    const cnt       = PAIRS.filter(p => resolveSpForPair(p.id)?.id === sp.id).length;
    const wd        = (sp.wochentage || []).map(d => WD[d]).join(', ') || '—';
    const zeit      = (sp.von && sp.bis) ? `${sp.von}–${sp.bis} Uhr` : '—';
    const gueltig   = (sp.gueltigVon || sp.gueltigBis)
      ? `${fmtD(sp.gueltigVon) || '…'} – ${fmtD(sp.gueltigBis) || '…'}`
      : 'Allgemeingültig';
    const col = sp.farbe || '#6b7280';
    return `
      <div class="card" style="position:relative;border-left:3px solid ${col};">
        <!-- Aktionen oben rechts -->
        <div style="position:absolute;top:8px;right:8px;display:flex;gap:4px;">
          <button onclick="event.stopPropagation();openSperrmusterModal('${sp.id}')" title="Bearbeiten"
            style="padding:3px 7px;border-radius:5px;border:1px solid #e5e7eb;background:white;font-size:12px;color:#374151;cursor:pointer;display:inline-flex;align-items:center;">${svgIcon('stift',{groesse:11})}</button>
          <button onclick="event.stopPropagation();deleteSperrmusterMitFrage('${sp.id}')" title="Löschen"
            style="padding:3px 7px;border-radius:5px;border:1px solid #fecaca;background:#fff5f5;font-size:11px;color:#b91c1c;cursor:pointer;font-weight:700;">✕</button>
        </div>
        <div style="padding-right:56px;">
          <!-- Name -->
          <div style="font-size:13px;font-weight:700;color:#1a3a5c;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${sp.name}">${sp.name}</div>
          <!-- Badges -->
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">
            <span style="${BADGE}">${TYP[sp.typ] || sp.typ}</span>
            ${sp.gleissperrung && sp.gleissperrung !== 'keine' ? `<span style="${BADGE}">${GL[sp.gleissperrung]}</span>` : ''}
            ${sp.fl === 'aus' ? `<span style="${BADGE}">FL abgeschaltet</span>` : ''}
            ${sp.fl === 'ein' ? `<span style="${BADGE}">FL eingeschaltet</span>` : ''}
          </div>
          <!-- Parameter -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;font-size:11px;color:#6b7280;margin-bottom:6px;">
            <div><span style="font-weight:600;color:#374151;">Tage</span>&nbsp;${wd}</div>
            <div><span style="font-weight:600;color:#374151;">Fenster</span>&nbsp;${zeit}</div>
            <div><span style="font-weight:600;color:#374151;">Intervall</span>&nbsp;${sp.nettoH ? sp.nettoH + ' h/Sch.' : '—'}</div>
            <div><span style="font-weight:600;color:#374151;">Gültigkeit</span>&nbsp;${gueltig}</div>
            ${sp.gleisNr ? `<div><span style="font-weight:600;color:#374151;">Gleis</span>&nbsp;${sp.gleisNr}</div>` : ''}
          </div>
          ${sp.bemerkung ? `<div style="font-size:10px;color:#9ca3af;font-style:italic;margin-bottom:6px;">${sp.bemerkung}</div>` : ''}
          <!-- Footer -->
          <div style="text-align:right;margin-top:4px;">
            <span style="font-size:10px;background:#f3f4f6;padding:2px 6px;border-radius:4px;color:#6b7280;">${cnt} Fundament${cnt !== 1 ? 'e' : ''} (auto-match)</span>
          </div>
        </div>
      </div>`;
  }).join('');

  // "+ Sperrmuster erfassen" Add-Kachel am Ende
  const addCard = document.createElement('div');
  addCard.className = 'card card-add';
  addCard.title = 'Neues Sperrmuster erfassen';
  addCard.onclick = () => openSperrmusterModal(null);
  addCard.innerHTML = '<div class="card-add-icon">+</div><div class="card-add-label">Sperrmuster erfassen</div>';
  grid.appendChild(addCard);
}

function deleteSperrmusterById(id) {
  saveSperrmuster(loadSperrmuster().filter(x => x.id !== id));
  renderSperrmusterBibliothek();
  renderAusfPlanungInline();
}

// Rückfrage + Löschen (aus der Kachel-Liste aufgerufen)
async function deleteSperrmusterMitFrage(id) {
  const sp = loadSperrmuster().find(x => x.id === id);
  if (!sp) return;
  if (!await ui.confirm(`Sperrmuster «${sp.name}» löschen?`,
                        { gefaehrlich: true, ok: 'Löschen' })) return;
  deleteSperrmusterById(id);
}

// Sperrmuster-Select in der Sidebar befüllen
function updateAllSperrmusterSelects() {
  const list = loadSperrmuster();
  const optHtml = '<option value="">— kein Sperrmuster —</option>' +
    list.map(sp => `<option value="${sp.id}">${sp.name}</option>`).join('');
  document.querySelectorAll('.ausf-sperrmuster-sel').forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = optHtml;
    sel.value = cur || '';
  });
}

// Schichten-Auto-Anzeige aktualisieren (wird beim Laden der Sidebar aufgerufen)
function onAusfSperrmusterChange() {
  const sp = resolveSpForPair(currentPairId);

  // Betriebliche Einschränkungen aus Sperrmuster vorschlagen (nur wenn noch nicht gesetzt)
  if (sp) {
    if (sp.gleissperrung && sp.gleissperrung !== 'keine') {
      const el = document.getElementById('ausf-gleisgebunden'); if (el && !el.checked) el.checked = true;
    }
    if (sp.fl === 'aus') { const el = document.getElementById('ausf-abschaltung'); if (el && !el.checked) el.checked = true; }
  }

  const autoVal = calcSchichtenAuto(currentPairId);
  const schichtenEl = document.getElementById('ausf-anzahl-schichten');
  if (schichtenEl && !schichtenEl.value && autoVal != null) schichtenEl.value = autoVal;
  setAusfSchichtenDisplay(autoVal);
}

// Berechnet Anzahl Schichten aus FT-Intervall / Sperrmuster-nettoH
function calcSchichtenAuto(pairId) {
  if (!pairId) return null;
  const ftId = loadFtZuweisungen()[pairId];
  if (!ftId) return null;
  const ft = loadFtProfile().find(t => t.id === ftId);
  if (!ft?.ftIntervall) return null;
  const sp = resolveSpForPair(pairId);
  if (!sp?.nettoH) return null;
  return Math.ceil(ft.ftIntervall / sp.nettoH);
}

// Aktualisiert Anzeige: Auto-Wert-Label und Manuell-Überschreibungs-Hinweis
function setAusfSchichtenDisplay(autoVal) {
  const hint     = document.getElementById('ausf-schichten-manual-hint');
  const autoSpan = document.getElementById('ausf-schichten-auto-val');
  const autoLbl  = document.getElementById('ausf-schichten-auto-label');
  const input    = document.getElementById('ausf-anzahl-schichten');
  if (autoSpan) autoSpan.textContent = autoVal != null ? autoVal : '—';
  if (autoLbl)  autoLbl.textContent  = autoVal != null ? `Auto: ${autoVal}` : '';
  const manualVal = input ? parseInt(input.value) : NaN;
  const isManual  = !isNaN(manualVal) && autoVal != null && manualVal !== autoVal;
  if (hint) hint.style.display = isManual ? '' : 'none';
}

// Wird aufgerufen wenn Nutzer Schichten manuell ändert
function onAusfSchichtenInput() {
  const autoVal = calcSchichtenAuto(currentPairId);
  setAusfSchichtenDisplay(autoVal);
  saveAusfPlanung();
}

// Schichten für ein Paar berechnen (verwendet in Bauprogramm-Tabelle)
// Auto-Matching: Sperrmuster für einen Standort nach Datum + Gleis ermitteln
function resolveSpForPair(pairId, refDate) {
  const pair  = PAIRS.find(p => p.id === pairId);
  const gleis = pair?.gleis ? String(pair.gleis).trim() : null;
  const date  = refDate || new Date().toISOString().slice(0, 10);
  const list  = loadSperrmuster();
  const matches = list.filter(sp => {
    if (sp.gueltigVon && date < sp.gueltigVon) return false;
    if (sp.gueltigBis && date > sp.gueltigBis) return false;
    if (gleis && sp.gleisNr) {
      const gleise = sp.gleisNr.split(/[,\/\s]+/).map(s => s.trim()).filter(Boolean);
      if (!gleise.includes(gleis)) return false;
    }
    return true;
  });
  // Spezifisch (mit gleisNr) vor generisch (ohne)
  return matches.find(sp => sp.gleisNr) || matches[0] || null;
}

// Sperrmuster für eine Gleisnummer + Datum auflösen (Kernlogik)
// gleisNr: string oder null (null = kein Gleisfilter, erstes verfügbares SP wird zurückgegeben)
function resolveSpForGleis(gleisNr, dateStr) {
  if (!dateStr) return null;
  const allSp = loadSperrmuster();
  const gleis = gleisNr ? String(gleisNr).trim() : null;
  const d     = bpParseDate(dateStr);
  const dow   = d.getDay();
  const matches = allSp.filter(sp => {
    if (sp.gueltigVon && dateStr < sp.gueltigVon) return false;
    if (sp.gueltigBis && dateStr > sp.gueltigBis) return false;
    if (sp.wochentage?.length && !sp.wochentage.includes(dow)) return false;
    if (gleis && sp.gleisNr) {
      const gleise = sp.gleisNr.split(/[,\/\s]+/).map(s => s.trim()).filter(Boolean);
      if (!gleise.includes(gleis)) return false;
    }
    return true;
  });
  return matches.find(sp => sp.gleisNr) || matches[0] || null;
}

// Sperrmuster für ein Baupaket an einem Datum auflösen (Legacy-Wrapper via sperrmusterTypId)
// Kein pak.gleisNr mehr — SP wird pro Fundament über resolveSpForGleis(p.gleis) aufgelöst
function resolveSpForPak(pak, dateStr) {
  if (!dateStr) return null;
  let gleis = null;
  if (pak?.sperrmusterTypId) {
    const legacy = loadSperrmuster().find(s => s.id === pak.sperrmusterTypId);
    gleis = legacy?.gleisNr || null;
  }
  return resolveSpForGleis(gleis, dateStr);
}

function getSchichtenForPair(pairId) {
  const bp = loadAllBauprojekt()[pairId] || {};
  if (bp.ausfAnzahlSchichtenManual) return parseInt(bp.ausfAnzahlSchichtenManual);
  const ftId = loadFtZuweisungen()[pairId];
  if (!ftId) return null;
  const ft = loadFtProfile().find(t => t.id === ftId);
  if (!ft?.ftIntervall) return null;
  const sp = resolveSpForPair(pairId);
  if (!sp?.nettoH) return null;
  return Math.ceil(ft.ftIntervall / sp.nettoH);
}

// ── Tab-Umschalter Ereignisse ↔ Bauprogramm ──────────────────
// ============================================================
