// SUCHE
// ============================================================
function onSearchInput(val) {
  searchQuery = val.trim();
  refreshCurrentView();
  kopfSuchListe(val);
}

// ── Standortwahl aus dem Suchfeld im Kopf ────────────────────
// Das Feld filterte bisher nur die Liste. Wer einen bestimmten Mast sucht,
// will ihn aber oeffnen — dieselbe Handlung wie in der Sprungliste der
// Navigationszeile, nur ohne den Umweg ueber eine der Kartenansichten.
let _kopfSuchMarkiert = 0;

function kopfSuchTreffer(q) {
  if (!q || q.trim().length < 1) return [];
  const notAll = loadAllNotizen();
  const bpAll  = typeof loadAllBauprojekt === 'function' ? loadAllBauprojekt() : {};
  return getPhasePairs()
    .filter(p => sucheTrifftStandort(p, q, notAll, bpAll))
    .slice(0, 12);
}

// Auf der Uebersichtskarte kommen Bahntreffer dazu: Station, Liniennummer und
// Kilometer. Sie hatten frueher ein eigenes Feld am unteren Kartenrand — zwei
// Suchfelder nebeneinander, die verschiedene Dinge fanden.
function _kopfSuchBahn(val) {
  if (currentOverviewView !== 'karte') return [];
  if (document.getElementById('overview-view')?.style.display === 'none') return [];
  if (typeof bahnSuche !== 'function' || !bahnEbeneAktiv('overview')) return [];
  return bahnSuche(val).slice(0, 5);
}

// Notizen als eigene Trefferart. Sie zaehlten schon bisher mit, aber nur
// stillschweigend: der Standort erschien, ohne dass zu sehen war, warum.
// Hier steht die Fundstelle selbst — mit dem Wortlaut, an dem es lag.
function _kopfSuchNotizen(val) {
  const q = String(val || '').trim().toLowerCase();
  if (q.length < 2 || SUCHE_ZAHL.test(q)) return [];
  const alle = loadAllNotizen();
  const bekannt = new Set(getPhasePairs().map(p => p.id));
  const treffer = [];
  Object.entries(alle).forEach(([pairId, notizen]) => {
    const id = Number(pairId);
    if (!bekannt.has(id)) return;
    (notizen || []).forEach(n => {
      if (!n?.text || !n.text.toLowerCase().includes(q)) return;
      treffer.push({ pairId: id, text: n.text });
    });
  });
  return treffer.slice(0, 6);
}

function _kopfSuchAuszug(text, q) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  const von = Math.max(0, i - 12);
  const auszug = text.slice(von, von + 48).replace(/\s+/g, ' ');
  return (von > 0 ? '…' : '') + auszug + (von + 48 < text.length ? '…' : '');
}

function kopfSuchListe(val) {
  const panel = document.getElementById('kopf-such-panel');
  const liste = document.getElementById('kopf-such-liste');
  if (!panel || !liste) return;
  const treffer = kopfSuchTreffer(val);
  const bahn    = _kopfSuchBahn(val);
  const notizen = _kopfSuchNotizen(val);
  _kopfSuchMarkiert = 0;
  if (!treffer.length && !bahn.length && !notizen.length) { panel.classList.remove('offen'); return; }
  const standortHtml = treffer.map((p, i) => {
    const km   = p.km_rs || p.km_rks;
    const name = p.mast ? 'Mast ' + p.mast : (p.bezeichnung || 'Standort ' + p.id);
    return '<button class="pair-jump-eintrag' + (i === 0 ? ' markiert' : '')
      + '" data-kopf-pair="' + p.id + '">'
      + '<span>' + escHtml(name) + '</span>'
      + (km ? '<span class="pj-neben">' + escHtml(parseFloat(km).toFixed(3)) + '</span>' : '')
      + '</button>';
  }).join('');
  const bahnHtml = bahn.map((t, i) =>
    '<button class="pair-jump-eintrag' + (!treffer.length && i === 0 ? ' markiert' : '')
    + '" data-kopf-bahn="' + i + '">'
    + '<span>' + escHtml(t.titel) + '</span>'
    + '<span class="pj-neben">' + escHtml(t.neben || t.art) + '</span></button>').join('');
  const notizHtml = notizen.map((n, i) => {
    const pair = PAIRS.find(p => p.id === n.pairId);
    const name = pair?.mast ? 'Mast ' + pair.mast : 'Standort ' + n.pairId;
    return '<button class="pair-jump-eintrag" data-kopf-notiz="' + i + '"'
      + ' title="' + escHtml(n.text) + '" style="align-items:flex-start;">'
      + '<span style="white-space:normal;line-height:1.35;">' + escHtml(_kopfSuchAuszug(n.text, val)) + '</span>'
      + '<span class="pj-neben">' + escHtml(name) + '</span></button>';
  }).join('');
  liste.innerHTML = standortHtml
    + (notizen.length ? '<div class="pair-jump-leer">Notizen</div>' + notizHtml : '')
    + (bahn.length ? '<div class="pair-jump-leer">Bahn</div>' + bahnHtml : '');
  liste.querySelectorAll('[data-kopf-pair]').forEach(btn => {
    btn.onclick = () => kopfSuchWaehlen(Number(btn.dataset.kopfPair));
  });
  liste.querySelectorAll('[data-kopf-notiz]').forEach(btn => {
    btn.onclick = () => kopfSuchWaehlen(notizen[+btn.dataset.kopfNotiz].pairId);
  });
  liste.querySelectorAll('[data-kopf-bahn]').forEach(btn => {
    btn.onclick = () => { kopfSuchSchliessen(); bahnTrefferAnfahren(bahn[+btn.dataset.kopfBahn]); };
  });
  panel.classList.add('offen');
}

function kopfSuchSchliessen() {
  document.getElementById('kopf-such-panel')?.classList.remove('offen');
}

// In der Kartenansicht der Uebersicht wird der Standort angefahren, sonst
// geoeffnet — beides ist «Standort waehlen», nur je nach Ansicht.
function kopfSuchWaehlen(id) {
  kopfSuchSchliessen();
  const pair = PAIRS.find(p => p.id === id);
  if (!pair) return;
  if (currentOverviewView === 'karte' && typeof ovNavZeigeStandort === 'function'
      && document.getElementById('overview-view')?.style.display !== 'none') {
    ovNavZeigeStandort(pair);
    ovNavAktualisieren();
    return;
  }
  showDetail(id);
}

function kopfSuchTaste(ev) {
  const eintraege = [...document.querySelectorAll('#kopf-such-liste .pair-jump-eintrag')];
  if (ev.key === 'Escape') { kopfSuchSchliessen(); return; }
  if (!eintraege.length) return;
  if (ev.key === 'Enter') {
    ev.preventDefault();
    eintraege[_kopfSuchMarkiert]?.click();
    return;
  }
  if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
  ev.preventDefault();
  eintraege[_kopfSuchMarkiert]?.classList.remove('markiert');
  _kopfSuchMarkiert = (_kopfSuchMarkiert + (ev.key === 'ArrowDown' ? 1 : -1) + eintraege.length) % eintraege.length;
  eintraege[_kopfSuchMarkiert].classList.add('markiert');
  eintraege[_kopfSuchMarkiert].scrollIntoView({ block: 'nearest' });
}

document.addEventListener('click', e => {
  if (!e.target.closest('#kopf-such-wrap')) kopfSuchSchliessen();
});

// ============================================================
// SCHNELLSTATUS
// ============================================================
function toggleQsPicker(pairId, badgeEl) {
  event.stopPropagation();
  const picker = document.getElementById('qs-picker-' + pairId);
  const isOpen = picker.classList.contains('open');
  // Alle anderen schliessen
  document.querySelectorAll('.qs-picker.open').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.qs-badge.open').forEach(b => b.classList.remove('open'));
  // Diesen umschalten
  if (!isOpen) {
    picker.classList.add('open');
    badgeEl.classList.add('open');
  }
}

// Picker schliessen bei Klick ausserhalb — einmalig registrieren
if (!window._qsPickerListenerAdded) {
  window._qsPickerListenerAdded = true;
  document.addEventListener('click', () => {
    document.querySelectorAll('.qs-picker.open').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('.qs-badge.open').forEach(b => b.classList.remove('open'));
  });
}

function quickStatus(pairId, status) {
  setPairData(pairId, { status });
  logChange(pairId, 'Status', statusLabel(status));
  updateProgress();
  renderCards();
  renderInstallationen();
  if (currentOverviewView === 'liste') renderList();
}

// ============================================================
// DISTANZANZEIGE
// ============================================================
function formatDist(m) {
  return m < 1000 ? Math.round(m) + ' m' : (m/1000).toFixed(1) + ' km';
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function updateDistances(lat, lng) {
  PAIRS.forEach(p => {
    const c = pairCenter(p);
    liveDistances[p.id] = haversine(lat, lng, c.lat, c.lng);
  });
  refreshCurrentView();
}

// ============================================================
// FOTOS
// ============================================================
// Galerie-Upload (mehrere Dateien auf einmal)
// ── Bildkomprimierung ────────────────────────────────────────
// Max. 1200px auf der längsten Seite, JPEG 0.75 Qualität
// Typische Reduktion: 4–8 MB → 150–300 KB
const FOTO_MAX_PX = 1200;
const FOTO_QUALITY = 0.75;

function compressImage(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > FOTO_MAX_PX || h > FOTO_MAX_PX) {
        if (w >= h) { h = Math.round(h * FOTO_MAX_PX / w); w = FOTO_MAX_PX; }
        else        { w = Math.round(w * FOTO_MAX_PX / h); h = FOTO_MAX_PX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', FOTO_QUALITY));
    };
    img.src = dataUrl;
  });
}

function addFotos(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  let loaded = 0;
  const results = [];
  files.forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = async e => {
      const compressed = await compressImage(e.target.result);
      const blobId = await fotoBlobs.speichern(compressed);
      results[i] = { blobId, ts: new Date().toLocaleString('de-CH'), phase: _activePhase };
      if (++loaded === files.length) {
        const pd = getPairData(currentPairId);
        const allFotos = (pd.fotos || []).concat(results);
        setPairData(currentPairId, { fotos: allFotos });
        logChange(currentPairId, 'Foto', `${files.length} hinzugefügt (${PHASEN_CONFIG[_activePhase]?.labelKurz || _activePhase})`);
        renderFotos();
        // Rueckmeldung: der Knopf an der Karte liegt oft ueber der eingeklappten
        // Fotoliste — ohne Meldung sieht man nicht, dass etwas gespeichert wurde.
        ui.toast(files.length === 1 ? 'Foto gespeichert' : `${files.length} Fotos gespeichert`, 'erfolg');
      }
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

// Legacy-Alias (falls noch aufgerufen)
function addFoto(input) { addFotos(input); }

// Schnellfoto-Knopf an der Karte der Detailansicht.
// Ohne gewaehlten Standort haette addFotos keinen Ort zum Ablegen — dann gar
// nicht erst die Kamera oeffnen, sondern sagen warum.
function schnellFotoDetail() {
  if (!currentPairId) { ui.toast('Kein Standort geöffnet', 'fehler'); return; }
  const inp = document.getElementById('detail-foto-input');
  if (!inp) return;
  inp.value = '';
  inp.click();
}

// ── Kamera-Funktionen ───────────────────────────────────────
let _cameraStream = null;
let _cameraFacing  = 'environment'; // 'environment' = Rückkamera, 'user' = Frontkamera

async function openCamera() {
  const modal = document.getElementById('camera-modal');
  const video = document.getElementById('camera-video');
  try {
    _cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: _cameraFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = _cameraStream;
    modal.classList.add('open');
  } catch(err) {
    if (err.name === 'NotAllowedError') {
      ui.toast('Kamera-Zugriff verweigert. Bitte Berechtigung in den Browser-Einstellungen erteilen.', 'fehler');
    } else if (err.name === 'NotFoundError') {
      ui.toast('Keine Kamera gefunden. Bitte ein Gerät mit Kamera verwenden oder Foto aus Galerie wählen.', 'fehler');
    } else {
      ui.toast('Kamera konnte nicht gestartet werden: ' + err.message, 'fehler');
    }
  }
}

async function flipCamera() {
  _cameraFacing = _cameraFacing === 'environment' ? 'user' : 'environment';
  if (_cameraStream) {
    _cameraStream.getTracks().forEach(t => t.stop());
    _cameraStream = null;
  }
  const video = document.getElementById('camera-video');
  try {
    _cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: _cameraFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = _cameraStream;
  } catch(err) {
    ui.toast('Kamera konnte nicht gewechselt werden: ' + err.message, 'fehler');
  }
}

async function capturePhoto() {
  const video  = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  // Auf max. FOTO_MAX_PX begrenzen
  let w = video.videoWidth  || 1280;
  let h = video.videoHeight || 720;
  if (w > FOTO_MAX_PX || h > FOTO_MAX_PX) {
    if (w >= h) { h = Math.round(h * FOTO_MAX_PX / w); w = FOTO_MAX_PX; }
    else        { w = Math.round(w * FOTO_MAX_PX / h); h = FOTO_MAX_PX; }
  }
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(video, 0, 0, w, h);
  const blobId = await fotoBlobs.speichern(canvas.toDataURL('image/jpeg', FOTO_QUALITY));

  if (_cameraAbnahmeMode) {
    _cameraAbnahmeMode = false;
    const datum = document.getElementById('ck-datum')?.value || new Date().toLocaleDateString('de-CH');
    const pd = getPairData(_ckPairId);
    const fotos = pd.fotos || [];
    fotos.push({ blobId, ts: new Date().toLocaleString('de-CH'),
                 phase: _activePhase || 'ausfuehrung', kategorie: 'abnahme', datum });
    setPairData(_ckPairId, { fotos });
    logChange(_ckPairId, 'Foto', 'Abnahme-Foto aufgenommen');
    renderCkFotos();
    if (_ckPairId === currentPairId) renderFotos();
  } else if (_cameraBegehungMode) {
    _cameraBegehungMode = false;
    const datum = document.getElementById('beg-datum')?.value || '';
    const pd = getPairData(currentPairId);
    const fotos = pd.fotos || [];
    fotos.push({ blobId, ts: new Date().toLocaleString('de-CH'),
                 phase: _activePhase, kategorie: 'begehung', datum });
    setPairData(currentPairId, { fotos });
    logChange(currentPairId, 'Foto', 'Begehungs-Foto aufgenommen');
    renderFotos();
  } else {
    const pd = getPairData(currentPairId);
    const fotos = pd.fotos || [];
    fotos.push({ blobId, ts: new Date().toLocaleString('de-CH'), phase: _activePhase });
    setPairData(currentPairId, { fotos });
    logChange(currentPairId, 'Foto', 'aufgenommen');
    renderFotos();
  }

  // Kurzes visuelles Feedback (Flash)
  const video2 = document.getElementById('camera-video');
  video2.style.transition = 'opacity 0.08s';
  video2.style.opacity = '0.2';
  setTimeout(() => { video2.style.opacity = '1'; }, 120);
}

function closeCamera() {
  if (_cameraStream) { _cameraStream.getTracks().forEach(t => t.stop()); _cameraStream = null; }
  document.getElementById('camera-video').srcObject = null;
  document.getElementById('camera-modal').classList.remove('open');
}

function renderFotos() {
  const inner = document.getElementById('photo-grid-inner');
  if (!inner) return;
  const pd      = getPairData(currentPairId);
  const allFotos = pd.fotos || [];
  // Aufteilen: reguläre Fotos, Begehungs-Fotos, Abnahme-Fotos (dieser Phase)
  const regular  = allFotos.filter(f => (f.phase || 'baugrund') === _activePhase && !f.kategorie);
  const begehung = allFotos.filter(f => (f.phase || 'baugrund') === _activePhase && f.kategorie === 'begehung');
  const abnahme  = allFotos.filter(f => (f.phase || 'baugrund') === _activePhase && f.kategorie === 'abnahme');
  inner.innerHTML = '';

  const mkThumb = (f) => {
    const origIdx = allFotos.indexOf(f);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;display:inline-block;margin:4px;';
    wrap.innerHTML = `
      <img src="${fotoSrc(f)}" title="${f.ts || ''}"
        style="width:72px;height:56px;object-fit:cover;border-radius:6px;border:2px solid #e5e7eb;cursor:pointer;display:block;"
        onclick="openLightbox(${origIdx})">
      <button onclick="deleteFotoInline(${origIdx})"
        style="position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:50%;border:none;background:#ef4444;color:white;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;">×</button>`;
    return wrap;
  };

  const mkDivider = (label) => {
    const d = document.createElement('div');
    d.style.cssText = 'width:100%;display:flex;align-items:center;gap:6px;margin:6px 4px 2px;';
    d.innerHTML = `<div style="flex:1;height:1px;background:#e5e7eb;"></div>
      <span style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;">${label}</span>
      <div style="flex:1;height:1px;background:#e5e7eb;"></div>`;
    return d;
  };

  // Reguläre Fotos
  regular.forEach(f => inner.appendChild(mkThumb(f)));

  // + Button (Galerie)
  const addBtn = document.createElement('label');
  addBtn.style.cssText = 'display:inline-block;margin:4px;vertical-align:top;cursor:pointer;';
  addBtn.innerHTML = `
    <div style="width:72px;height:56px;border-radius:6px;border:2px dashed #d1d5db;background:#f9fafb;color:#9ca3af;font-size:20px;display:flex;align-items:center;justify-content:center;">+</div>
    <input type="file" accept="image/*" multiple style="display:none;" onchange="addFotos(this)">`;
  inner.appendChild(addBtn);

  // Begehungs-Fotos — nach Datum gruppiert
  if (begehung.length > 0) {
    const fmtBegDatum = d => {
      if (!d) return 'Begehung';
      const p = d.split('-');
      return p.length === 3 ? `Begehung ${p[2]}.${p[1]}.` : 'Begehung';
    };
    // Einzigarte Daten in Reihenfolge ermitteln
    const dates = [...new Set(begehung.map(f => f.datum || ''))];
    dates.forEach(datum => {
      inner.appendChild(mkDivider(fmtBegDatum(datum)));
      begehung.filter(f => (f.datum || '') === datum).forEach(f => inner.appendChild(mkThumb(f)));
    });
  }

  // Abnahme-Fotos
  if (abnahme.length > 0) {
    inner.appendChild(mkDivider('Abnahme'));
    abnahme.forEach(f => inner.appendChild(mkThumb(f)));
  }
}

async function deleteFotoInline(origIdx) {
  if (!await ui.confirm('Foto löschen?')) return;
  const pd = getPairData(currentPairId);
  const fotos = pd.fotos || [];
  const [entfernt] = fotos.splice(origIdx, 1);
  setPairData(currentPairId, { fotos });
  if (entfernt?.blobId) fotoBlobs.loeschen(entfernt.blobId);
  logChange(currentPairId, 'Foto', 'gelöscht');
  renderFotos();
}

let lightboxIndex = 0;
// Standort, dessen Fotos gerade gezeigt werden. Die Abnahme-Checkliste öffnet
// die Anzeige für einen anderen Standort als den geöffneten — ohne diesen
// Merker blätterte man in der falschen Liste.
let _lightboxPairId = null;

function _lightboxFotos() { return getPairData(_lightboxPairId ?? currentPairId).fotos || []; }

// Bild und Bedienelemente auf den aktuellen Index bringen
function lightboxAnzeigen() {
  const fotos = _lightboxFotos();
  if (!fotos.length) { closeLightbox(); return; }
  lightboxIndex = Math.max(0, Math.min(fotos.length - 1, lightboxIndex));
  document.getElementById('lb-img').src = fotoSrc(fotos[lightboxIndex]);
  const mehrere = fotos.length > 1;
  ['lb-prev', 'lb-next'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.style.display = mehrere ? 'flex' : 'none';
  });
  const z = document.getElementById('lb-zaehler');
  if (z) z.textContent = mehrere ? `${lightboxIndex + 1} / ${fotos.length}` : '';
}

// Blättern läuft im Kreis: nach dem letzten Foto kommt wieder das erste
function lightboxBlaettern(richtung) {
  const fotos = _lightboxFotos();
  if (fotos.length < 2) return;
  lightboxIndex = (lightboxIndex + richtung + fotos.length) % fotos.length;
  lightboxAnzeigen();
}

function openLightbox(idx) {
  _lightboxPairId = currentPairId;
  lightboxIndex = idx;
  lightboxAnzeigen();
  document.getElementById('photo-lightbox').classList.add('open');
}

function closeLightbox() {
  document.getElementById('photo-lightbox').classList.remove('open');
}

// Tastatur: Pfeile blättern, Escape schliesst
document.addEventListener('keydown', e => {
  if (!document.getElementById('photo-lightbox')?.classList.contains('open')) return;
  if (e.key === 'ArrowLeft')  { e.preventDefault(); lightboxBlaettern(-1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); lightboxBlaettern(1); }
  if (e.key === 'Escape')     { closeLightbox(); }
});

// Wischen auf dem Bild — auf dem Tablet der naheliegendste Weg
(() => {
  let startX = null;
  const bild = () => document.getElementById('lb-img');
  document.addEventListener('touchstart', e => {
    if (e.target !== bild()) return;
    startX = e.touches[0].clientX;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (startX === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? startX) - startX;
    startX = null;
    if (Math.abs(dx) > 45) lightboxBlaettern(dx < 0 ? 1 : -1);
  }, { passive: true });
})();

async function deleteLightboxFoto() {
  if (!await ui.confirm('Foto löschen?')) return;
  const pid   = _lightboxPairId ?? currentPairId;
  const fotos = getPairData(pid).fotos || [];
  const [entfernt] = fotos.splice(lightboxIndex, 1);
  setPairData(pid, { fotos });
  if (entfernt?.blobId) fotoBlobs.loeschen(entfernt.blobId);
  logChange(pid, 'Foto', 'gelöscht');
  // Offen bleiben und das nächste Foto zeigen — nur beim letzten schliessen
  if (fotos.length) lightboxAnzeigen(); else closeLightbox();
  renderFotos();
}

// ============================================================
// BEGEHUNGS-FOTOS (aus Begehungs-Sektion)
// ============================================================
let _cameraBegehungMode = false;

function addFotosBegehung(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const datum = document.getElementById('beg-datum')?.value || '';
  let loaded = 0;
  const results = [];
  files.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = async e => {
      const compressed = await compressImage(e.target.result);
      results[idx] = { blobId: await fotoBlobs.speichern(compressed), ts: new Date().toLocaleString('de-CH'),
                       phase: _activePhase, kategorie: 'begehung', datum };
      if (++loaded === files.length) {
        const pd = getPairData(currentPairId);
        setPairData(currentPairId, { fotos: (pd.fotos || []).concat(results.filter(Boolean)) });
        logChange(currentPairId, 'Foto', `${files.length} Begehungs-Foto(s) hinzugefügt`);
        renderFotos();
      }
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function openCameraBegehung() {
  _cameraBegehungMode = true;
  openCamera();
}

// ============================================================
// ABNAHME-FOTOS (aus Checkliste-View)
// ============================================================
let _cameraAbnahmeMode = false;

function addAbnahmeFotos(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const datum = document.getElementById('ck-datum')?.value || new Date().toLocaleDateString('de-CH');
  let loaded = 0;
  const results = [];
  files.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = async e => {
      const compressed = await compressImage(e.target.result);
      results[idx] = { blobId: await fotoBlobs.speichern(compressed), ts: new Date().toLocaleString('de-CH'),
                       phase: _activePhase || 'ausfuehrung', kategorie: 'abnahme', datum };
      if (++loaded === files.length) {
        const pd = getPairData(_ckPairId);
        setPairData(_ckPairId, { fotos: (pd.fotos || []).concat(results.filter(Boolean)) });
        logChange(_ckPairId, 'Foto', `${files.length} Abnahme-Foto(s) hinzugefügt`);
        renderCkFotos();
        if (_ckPairId === currentPairId) renderFotos();
      }
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function openAbnahmeCamera() {
  _cameraAbnahmeMode = true;
  openCamera();
}

function renderCkFotos() {
  const grid = document.getElementById('ck-foto-grid');
  if (!grid) return;
  const fotos = (getPairData(_ckPairId).fotos || []).filter(f => f.kategorie === 'abnahme');
  grid.innerHTML = fotos.map((f, i) => `
    <div style="position:relative;display:inline-block;">
      <img src="${fotoSrc(f)}" title="${f.ts || ''}"
        style="width:80px;height:60px;object-fit:cover;border-radius:6px;border:2px solid #e5e7eb;cursor:pointer;display:block;"
        onclick="openCkFotoLightbox(${i})">
      <button onclick="deleteCkFoto(${i})"
        style="position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:50%;border:none;background:#ef4444;color:white;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;">×</button>
      <div style="font-size:9px;color:#9ca3af;text-align:center;margin-top:2px;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.datum || ''}</div>
    </div>`).join('');
}

function openCkFotoLightbox(localIdx) {
  // Abnahmefotos liegen in derselben Liste des Standorts — über den Index dort
  // öffnen, damit das Blättern und der Zähler dieselbe Grundlage haben.
  const alle  = getPairData(_ckPairId).fotos || [];
  const foto  = alle.filter(f => f.kategorie === 'abnahme')[localIdx];
  if (!foto) return;
  _lightboxPairId = _ckPairId;
  lightboxIndex = alle.indexOf(foto);
  lightboxAnzeigen();
  document.getElementById('photo-lightbox').classList.add('open');
}

async function deleteCkFoto(localIdx) {
  if (!await ui.confirm('Foto löschen?')) return;
  const pd  = getPairData(_ckPairId);
  const all = pd.fotos || [];
  const target = all.filter(f => f.kategorie === 'abnahme')[localIdx];
  const origIdx = all.indexOf(target);
  if (origIdx !== -1) all.splice(origIdx, 1);
  setPairData(_ckPairId, { fotos: all });
  if (target?.blobId) fotoBlobs.loeschen(target.blobId);
  renderCkFotos();
}

// ============================================================
// ÄNDERUNGSPROTOKOLL
// ============================================================
async function clearChangelog() {
  if (!await ui.confirm('Änderungsprotokoll wirklich löschen?')) return;
  setPairData(currentPairId, { changelog: [] });
  renderChangelog();
}

function logChange(pairId, field, value, type) {
  const pd = getPairData(pairId);
  const log = pd.changelog || [];
  log.unshift({ ts: new Date().toLocaleString('de-CH'), field, value, type: type || 'sonstig' });
  if (log.length > 50) log.pop();
  setPairData(pairId, { changelog: log });
}

function renderChangelog() {
  const el = document.getElementById('changelog-list');
  if (!el) return;
  const pd = getPairData(currentPairId);
  const log = pd.changelog || [];
  if (!log.length) { el.innerHTML = '<div style="font-size:11px;color:#9ca3af;">Noch keine Änderungen.</div>'; return; }
  const TYPE_COLOR = { fundtyp:'#2563eb', massnahme:'#ca8a04', baugrund:'#059669', ereignis:'#7c3aed', sonstig:'#9ca3af' };
  el.innerHTML = log.map(e => {
    const col = TYPE_COLOR[e.type] || TYPE_COLOR.sonstig;
    return `<div style="display:flex;gap:6px;padding:5px 0;border-bottom:1px solid #f3f4f6;align-items:flex-start;">
      <span style="display:inline-block;width:3px;min-height:32px;border-radius:2px;background:${col};flex-shrink:0;margin-top:1px;"></span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:10px;font-weight:700;color:${col};">${e.field}</div>
        <div style="font-size:11px;color:#374151;word-break:break-word;">${e.value}</div>
      </div>
      <span style="font-size:9px;color:#9ca3af;white-space:nowrap;flex-shrink:0;">${e.ts}</span>
    </div>`;
  }).join('');
}

function exportChangelogPdf(scope) {
  const { jsPDF } = window.jspdf;
  const pairs = scope === 'all'
    ? PAIRS.filter(p => (getPairData(p.id).changelog || []).length)
    : [PAIRS.find(p => p.id === currentPairId)].filter(Boolean);
  if (!pairs.length) { ui.toast('Keine Einträge vorhanden.', 'fehler'); return; }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const TYPE_COLOR = { fundtyp:[37,99,235], massnahme:[202,138,4], baugrund:[5,150,105], ereignis:[124,58,237], sonstig:[156,163,175] };
  const TYPE_LABEL = { fundtyp:'Fundamenttyp', massnahme:'Massnahme', baugrund:'Baugrundprofil', ereignis:'Ereignis', sonstig:'Sonstig' };

  // Header
  doc.setFillColor(26,58,92);
  doc.rect(0,0,210,18,'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(13); doc.setFont('helvetica','bold');
  doc.text('Änderungsprotokoll', 14, 11);
  doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text(`Erstellt: ${new Date().toLocaleString('de-CH')}`, 196, 11, {align:'right'});

  let y = 26;
  pairs.forEach((pair, pi) => {
    const log = getPairData(pair.id).changelog || [];
    if (!log.length) return;
    if (pi > 0) {
      if (y > 260) { doc.addPage(); y = 16; }
      doc.setDrawColor(220,220,220); doc.line(14,y,196,y); y += 6;
    }
    // Standort-Header
    if (y > 265) { doc.addPage(); y = 16; }
    doc.setFillColor(240,244,250);
    doc.rect(14,y-4,182,8,'F');
    doc.setTextColor(26,58,92); doc.setFontSize(10); doc.setFont('helvetica','bold');
    doc.text(`Mast ${pair.mast || pair.id}${pair.km_rs ? '  ·  KM '+parseFloat(pair.km_rs).toFixed(3) : ''}`, 16, y+1);
    y += 9;

    log.forEach(e => {
      if (y > 272) { doc.addPage(); y = 16; }
      const col = TYPE_COLOR[e.type] || TYPE_COLOR.sonstig;
      // Farbstreifen
      doc.setFillColor(...col);
      doc.rect(14, y-3, 2, 10, 'F');
      // Typ-Label
      doc.setTextColor(...col); doc.setFontSize(7.5); doc.setFont('helvetica','bold');
      doc.text(TYPE_LABEL[e.type] || e.type, 18, y+1);
      // Wert
      doc.setTextColor(55,65,81); doc.setFontSize(9); doc.setFont('helvetica','normal');
      const lines = doc.splitTextToSize(e.value, 130);
      doc.text(lines, 55, y+1);
      // Timestamp
      doc.setTextColor(156,163,175); doc.setFontSize(7.5);
      doc.text(e.ts, 196, y+1, {align:'right'});
      y += Math.max(lines.length * 4.5, 7) + 2;
    });
    y += 4;
  });

  doc.save(`Aenderungsprotokoll_${new Date().toLocaleDateString('de-CH').replace(/\./g,'-')}.pdf`);
}

// ============================================================
// PDF-BERICHT — DIALOG + EXPORT
// ============================================================

let _berichtPdfPairId = null;

function openBerichtPdfDialog() {
  _berichtPdfPairId = currentPairId;
  const pair = PAIRS.find(p => p.id === currentPairId);
  const allPairs = getFilteredSorted ? getFilteredSorted() : PAIRS;
  const lbl = document.getElementById('bericht-pdf-scope-single-label');
  if (lbl && pair) lbl.textContent = pair.bezeichnung || `Standort ${pair.id}`;
  const lblAll = document.getElementById('bericht-pdf-scope-all-label');
  if (lblAll) lblAll.textContent = `${allPairs.length} Standorte der aktuellen Phase`;
  const r = document.querySelector('input[name="bericht-pdf-scope"][value="single"]');
  if (r) r.checked = true;
  const modal = document.getElementById('bericht-pdf-modal');
  if (modal) modal.style.display = 'flex';
}

function closeBerichtPdfModal() {
  const modal = document.getElementById('bericht-pdf-modal');
  if (modal) modal.style.display = 'none';
}

async function confirmBerichtPdfExport() {
  const scope       = document.querySelector('input[name="bericht-pdf-scope"]:checked')?.value || 'single';
  const inclUmwelt  = document.getElementById('bericht-pdf-umwelt')?.checked ?? true;
  const inclSich    = document.getElementById('bericht-pdf-sicherheit')?.checked ?? true;
  const inclKarte   = document.getElementById('bericht-pdf-karte')?.checked ?? true;
  closeBerichtPdfModal();
  const opts = { inclUmwelt, inclSich, inclKarte };
  if (scope === 'single') {
    await exportPdfBericht(_berichtPdfPairId, opts);
  } else {
    const pairIds = (getFilteredSorted ? getFilteredSorted() : PAIRS).map(p => p.id);
    await exportBerichtMultiPdf(pairIds, opts);
  }
}

// Hilfsfunktion: GW-Zone-Bezeichnung
const GW_ZONE_LABEL = { '': '—', 'AuAo': 'Au/Ao — Gewässerschutzbereich', 'S3': 'S3 — Weitere Schutzzone', 'S2': 'S2 — Engere Schutzzone', 'S1': 'S1 — Fassungsbereich', 'andere': 'Andere (Sh, Sm, GA …)' };

// Phasenbezeichnung
const PHASE_LABEL = { 'bauprojekt': 'Bauprojekt', 'ausfuehrung': 'Ausführung', 'abnahme': 'Abnahme' };

// Bericht-Header auf bestehenden jsPDF-doc schreiben
function _berichtPdfHeader(doc, pair, phaseLabel) {
  doc.setFillColor(26, 58, 92);
  doc.rect(0, 0, 210, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text(pair.bezeichnung || 'Standort ' + pair.id, 14, 10);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(`Phase: ${phaseLabel}  ·  Erstellt: ${new Date().toLocaleString('de-CH')}`, 14, 17);
  doc.setTextColor(26, 58, 92);
}

// Umweltschutz-Tabelle für einen Standort ausgeben
function _berichtPdfUmwelt(doc, pairId, startY) {
  const ns = loadAllNaturschutz()[pairId] || {};
  const bp = loadAllBauprojekt()[pairId] || {};
  let y = startY;

  // GW-Spiegel-Status berechnen (GW-Kote aus Baugrundprofil abgeleitet)
  const gwKote = getBpGwKote(pairId);
  const sohle  = parseFloat(bp.sohle_mueM);
  const diff   = gwKote !== null && !isNaN(sohle) ? sohle - gwKote : null;
  let gwStatus = '—';
  if (diff !== null) {
    if (diff <= 0)       gwStatus = `Spiegel ${Math.abs(diff).toFixed(2)} m über UK Fund. — Wasserhaltung`;
    else if (diff <= 0.5) gwStatus = `Spiegel ${diff.toFixed(2)} m unter UK Fund. — Vorsicht`;
    else                 gwStatus = `OK (${diff.toFixed(1)} m unter UK Fund.)`;
  }

  // Schutzgebiete zusammenstellen
  const schutzItems = [
    ns.bln       && 'BLN (Bundesinventar Landschaften)',
    ns.nsg       && 'Naturschutzgebiet',
    ns.gewaesser && 'Gewässerraum',
    ns.wald      && 'Waldabstand / Waldzone',
    ns.andere    && ('Andere Schutzzone' + (ns.andereText ? ': ' + ns.andereText : '')),
  ].filter(Boolean);

  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(26,58,92);
  doc.text('Umweltschutz', 14, y); y += 6;
  doc.autoTable({
    startY: y, margin: { left: 14, right: 14 },
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [22, 101, 52], textColor: 255 },
    head: [['Thema', 'Wert', 'Thema', 'Wert']],
    body: [
      ['GW-Kote',      gwKote !== null ? gwKote.toFixed(1) + ' m ü.M.' : '—',
       'GW-Tiefe ab Gel.', (() => { const t=parseFloat(bp.bkGrundwasser); return !isNaN(t)&&t>0 ? t.toFixed(1)+' m' : '—'; })()],
      ['GW-Schutzzone', GW_ZONE_LABEL[ns.gwZone || ''] || '—', 'GW-Spiegel', gwStatus],
      ['Schutzgebiete', { content: schutzItems.length ? schutzItems.join(', ') : 'Keine', colSpan: 3 }],
      ...(ns.auflagen ? [['Auflagen', { content: ns.auflagen, colSpan: 3 }]] : []),
      ...(ns.bemerkung ? [['Bemerkung', { content: ns.bemerkung, colSpan: 3 }]] : []),
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 }, 2: { fontStyle: 'bold', cellWidth: 35 } }
  });
  return doc.lastAutoTable.finalY + 6;
}

// Phase-spezifische PDF-Sektionen (Baugrund / Bauprojekt / Ausführung)
function _berichtPdfPhaseSections(doc, pair, pd, startY, opts) {
  const { inclUmwelt = true, inclSich = true } = opts;
  const isBP = _activePhase === 'bauprojekt';
  const isAF = _activePhase === 'ausfuehrung';
  const isBG = !isBP && !isAF;
  const bp   = loadAllBauprojekt()[pair.id]  || {};
  const af   = loadAllAusfuehrung()[pair.id] || {};
  const fd   = pd.felddaten  || {};
  const s    = pd.sicherheit || {};
  let y = startY;

  const secHdr = (txt) => {
    if (y > 255) { doc.addPage(); y = 20; }
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 58, 92);
    doc.text(txt, 14, y); y += 6;
  };

  if (isBG) {
    // Koordinaten LV95
    secHdr('Koordinaten (LV95)');
    doc.autoTable({
      startY: y, margin: { left: 14, right: 14 },
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [26, 58, 92], textColor: 255 },
      body: [
        ['RS',  pair.rs  ? 'E ' + pair.rs.e  + '   N ' + pair.rs.n  : '—',
         'RKS', pair.rks ? 'E ' + pair.rks.e + '   N ' + pair.rks.n : '—'],
      ],
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 18 }, 2: { fontStyle: 'bold', cellWidth: 18 } }
    });
    y = doc.lastAutoTable.finalY + 6;

    // Felddaten (RS / RKS)
    secHdr('Felddaten');
    doc.autoTable({
      startY: y, margin: { left: 14, right: 14 },
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [26, 58, 92], textColor: 255 },
      head: [['', 'RS', 'RKS']],
      body: [
        ['Tiefe Ist (m)', fd.rs_tiefe_ist  || '—', fd.rks_tiefe_ist || '—'],
        ['Abbruchgrund',  fd.rs_abbruch    || '—', fd.rks_abbruch   || '—'],
        ['Grundwasser',   fd.rs_gw  === 'ja' ? `Ja bei ${fd.rs_gw_tiefe  || '?'} m` : 'Nein',
                          fd.rks_gw === 'ja' ? `Ja bei ${fd.rks_gw_tiefe || '?'} m` : 'Nein'],
        ['Bemerkung',     fd.rs_bemerkung  || '—', fd.rks_schicht   || '—'],
      ]
    });
    y = doc.lastAutoTable.finalY + 6;

    // Sicherheit
    if (inclSich && s.siwa) {
      if (y > 250) { doc.addPage(); y = 20; }
      secHdr('Sicherheit');
      doc.autoTable({
        startY: y, margin: { left: 14, right: 14 },
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [146, 64, 14], textColor: 255 },
        body: [
          ['SiWä',      s.siwa  || 'k.A.',  'Gleissperrung', s.sperrung || 'k.A.'],
          ['Fahrstrom', s.strom || 'k.A.',  'PSA', (s.psa || []).join(', ') || '—'],
          ['Hinweise', { content: s.hinweise || '—', colSpan: 3 }],
        ]
      });
      y = doc.lastAutoTable.finalY + 6;
    }
  }

  if (isBP) {
    // Bauprojekt-Felder
    secHdr('Bauprojekt');
    doc.autoTable({
      startY: y, margin: { left: 14, right: 14 },
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [26, 58, 92], textColor: 255 },
      body: [
        ['Fundamenttyp',  { content: bp.fundtyp   || '—', colSpan: 3 }],
        ['Massnahme',     { content: bp.massnahme || '—', colSpan: 3 }],
        ['Bestand',       { content: bp.bestand   || '—', colSpan: 3 }],
        ['UK Fundament',  bp.sohle_mueM    ? bp.sohle_mueM    + ' m ü.M.' : '—',
         'Fundamentkopf', bp.fundkopf_mueM ? bp.fundkopf_mueM + ' m ü.M.' : '—'],
        ...(bp.neigung    ? [['Neigung', bp.neigung + ' %', '', '']]         : []),
        ...(bp.bemerkung  ? [['Bemerkung', { content: bp.bemerkung, colSpan: 3 }]] : []),
      ],
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 38 }, 2: { fontStyle: 'bold', cellWidth: 38 } }
    });
    y = doc.lastAutoTable.finalY + 6;

    // Bodenkennwerte
    if (bp.bkMe || bp.bkPhi || bp.bkGamma || bp.bkC || bp.bkBemerkung) {
      if (y > 250) { doc.addPage(); y = 20; }
      secHdr('Bodenkennwerte');
      doc.autoTable({
        startY: y, margin: { left: 14, right: 14 },
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [26, 58, 92], textColor: 255 },
        body: [
          ['E-Modul Me',      bp.bkMe    ? bp.bkMe    + ' MN/m²' : '—',
           'Reibungswinkel φ', bp.bkPhi  ? bp.bkPhi   + ' °'     : '—'],
          ['Wichte γ',        bp.bkGamma ? bp.bkGamma + ' kN/m³' : '—',
           'Kohäsion c',      bp.bkC    ? bp.bkC     + ' kPa'   : '—'],
          ...(bp.bkBemerkung ? [['Bemerkung', { content: bp.bkBemerkung, colSpan: 3 }]] : []),
        ],
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 38 }, 2: { fontStyle: 'bold', cellWidth: 38 } }
      });
      y = doc.lastAutoTable.finalY + 6;
    }

    // Umweltschutz (immer für Bauprojekt-Phase)
    if (inclUmwelt) {
      if (y > 240) { doc.addPage(); y = 20; }
      y = _berichtPdfUmwelt(doc, pair.id, y);
    }
  }

  if (isAF) {
    // Ausführungsfelder
    secHdr('Ausführung');
    doc.autoTable({
      startY: y, margin: { left: 14, right: 14 },
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [26, 58, 92], textColor: 255 },
      body: [
        ['Datum',       af.datum  || '—',                 'Firma',      af.firma      || '—'],
        ['Tiefe Ist',   af.tiefe  ? af.tiefe + ' m' : '—', 'Protokoll', af.protokoll  || '—'],
        ...(af.befund ? [['Befund',  { content: af.befund, colSpan: 3 }]] : []),
        ...(af.link   ? [['Link',    { content: af.link,   colSpan: 3 }]] : []),
      ],
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 28 }, 2: { fontStyle: 'bold', cellWidth: 28 } }
    });
    y = doc.lastAutoTable.finalY + 6;

    // Material
    if (af.matStatus || af.matBestellung || af.matLieferdatum || af.matBemerkung) {
      if (y > 250) { doc.addPage(); y = 20; }
      secHdr('Material');
      doc.autoTable({
        startY: y, margin: { left: 14, right: 14 },
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [26, 58, 92], textColor: 255 },
        body: [
          ['Fundamenttyp OK', af.matFundtypOk === 'ja' ? 'Ja' : af.matFundtypOk === 'nein' ? 'Nein' : '—',
           'Status',          af.matStatus || '—'],
          ['Bestellung',      af.matBestellung  || '—', 'Lieferdatum', af.matLieferdatum || '—'],
          ...(af.matBemerkung ? [['Bemerkung', { content: af.matBemerkung, colSpan: 3 }]] : []),
        ],
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 38 }, 2: { fontStyle: 'bold', cellWidth: 38 } }
      });
      y = doc.lastAutoTable.finalY + 6;
    }

    // Umweltschutz
    if (inclUmwelt) {
      if (y > 240) { doc.addPage(); y = 20; }
      y = _berichtPdfUmwelt(doc, pair.id, y);
    }
  }

  return y;
}

async function exportPdfBericht(pairId, opts = {}) {
  pairId = pairId ?? currentPairId;
  const { inclUmwelt = true, inclSich = true, inclKarte = true } = opts;
  const { jsPDF } = window.jspdf;
  const pair = PAIRS.find(p => p.id === pairId);
  if (!pair) return;
  const pd  = getPairData(pairId);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const phaseLabel = PHASE_LABEL[_activePhase] || _activePhase || '—';

  _berichtPdfHeader(doc, pair, phaseLabel);
  let y = 30;

  // Metadaten (phasenunabhängige Standortdaten)
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 58, 92);
  doc.text('Metadaten', 14, y); y += 6;
  doc.autoTable({
    startY: y, margin: { left: 14, right: 14 },
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [26, 58, 92], textColor: 255 },
    body: [
      ['KM RS',  pair.km_rs?.toFixed(3)  ?? '—', 'KM RKS',     pair.km_rks?.toFixed(3) ?? '—'],
      ['Mast',   pair.mast  ?? '—',               'Tiefe Soll', (pair.tiefe ?? '—') + ' m'],
      ['Gleis',  pair.gleis ?? '—',               'Tagarbeit',  pair.tag    ?? '—'],
      ['Status', statusLabel(pd.status || 'geplant'), 'Zugang', pair.zugang || '—'],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 28 }, 2: { fontStyle: 'bold', cellWidth: 28 } }
  });
  y = doc.lastAutoTable.finalY + 6;

  // Phasenspezifische Sektionen
  y = _berichtPdfPhaseSections(doc, pair, pd, y, { inclUmwelt, inclSich });

  // Kommentar
  if (pd.comment) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setTextColor(26,58,92);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('Kommentar', 14, y); y += 5;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(60,60,60);
    const lines = doc.splitTextToSize(pd.comment, 182);
    doc.text(lines, 14, y); y += lines.length * 4.5 + 4;
  }

  // Kartenausschnitt
  const mapEl = document.getElementById('map');
  if (inclKarte && mapEl && typeof html2canvas !== 'undefined' && y < 240) {
    try {
      if (leafletMap) leafletMap.invalidateSize();
      await new Promise(r => setTimeout(r, 300));
      const mapRect   = mapEl.getBoundingClientRect();
      const mapCanvas = await html2canvas(mapEl, { useCORS: true, logging: false, allowTaint: true, width: mapRect.width, height: mapRect.height, scale: 1 });
      const combined  = document.createElement('canvas');
      combined.width = mapCanvas.width; combined.height = mapCanvas.height;
      const ctx = combined.getContext('2d');
      ctx.drawImage(mapCanvas, 0, 0);
      const sketchEl = document.getElementById('sketch-canvas');
      if (sketchEl && sketchStrokes.length > 0) {
        sketchStrokes.forEach(stroke => {
          if (stroke.points.length < 2) return;
          ctx.strokeStyle = stroke.color; ctx.lineWidth = stroke.size;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
          stroke.points.forEach((pt, i) => {
            const pos = leafletMap.latLngToContainerPoint(L.latLng(pt.lat, pt.lng));
            i === 0 ? ctx.moveTo(pos.x, pos.y) : ctx.lineTo(pos.x, pos.y);
          });
          ctx.stroke();
        });
      }
      const imgData = combined.toDataURL('image/jpeg', 0.85);
      const imgW = 182, imgH = Math.min(imgW / (combined.width / combined.height), Math.min(110, 270 - y));
      doc.setTextColor(26,58,92); doc.setFont('helvetica','bold'); doc.setFontSize(11);
      doc.text('Kartenausschnitt', 14, y); y += 5;
      doc.addImage(imgData, 'JPEG', 14, y, imgW, imgH);
      y += imgH + 4;
    } catch(e) { console.warn('Karte konnte nicht erfasst werden:', e); }
  }

  // Fotos
  const fotos = (pd.fotos || []).slice(0, 4);
  if (fotos.length > 0 && y < 260) {
    await fotosFuerPdfLaden(fotos);
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setTextColor(26,58,92); doc.setFont('helvetica','bold'); doc.setFontSize(11);
    doc.text('Fotos', 14, y); y += 5;
    let fx = 14;
    for (const foto of fotos) {
      const src = fotoPdfSrc(foto);
      if (!src) continue;
      if (fx + 44 > 196) { fx = 14; y += 46; }
      doc.addImage(src, 'JPEG', fx, y, 42, 42); fx += 46;
    }
  }

  doc.save(`Bericht_${pair.bezeichnung || 'Standort_' + pair.id}_${new Date().toLocaleDateString('de-CH').replace(/\./g, '-')}.pdf`);
}

async function exportBerichtMultiPdf(pairIds, opts = {}) {
  const { inclUmwelt = true, inclSich = true } = opts;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const phaseLabel = PHASE_LABEL[_activePhase] || _activePhase || '—';
  const pairs = pairIds.map(id => PAIRS.find(p => p.id === id)).filter(Boolean);

  // Deckblatt / Inhaltsverzeichnis
  doc.setFillColor(26, 58, 92);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15); doc.setFont('helvetica', 'bold');
  doc.text('Bericht — Standortliste', 14, 12);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(`Phase: ${phaseLabel}  ·  Erstellt: ${new Date().toLocaleString('de-CH')}`, 14, 20);
  doc.setTextColor(26, 58, 92);

  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.text('Inhaltsverzeichnis', 14, 40);
  doc.autoTable({
    startY: 46, margin: { left: 14, right: 14 },
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [26, 58, 92], textColor: 255 },
    head: [['#', 'Bezeichnung', 'KM', 'Mast', 'Status', 'Seite']],
    body: pairs.map((pair, i) => {
      const pd = getPairData(pair.id);
      return [i + 1, pair.bezeichnung || `Standort ${pair.id}`, pair.km_rs?.toFixed(3) ?? '—', pair.mast ?? '—', statusLabel(pd.status || 'geplant'), i + 2];
    })
  });

  // Einzelseiten
  for (const pair of pairs) {
    doc.addPage();
    const pd = getPairData(pair.id);
    _berichtPdfHeader(doc, pair, phaseLabel);
    let y = 30;

    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 58, 92);
    doc.text('Metadaten', 14, y); y += 6;
    doc.autoTable({
      startY: y, margin: { left: 14, right: 14 },
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [26, 58, 92], textColor: 255 },
      body: [
        ['KM RS',  pair.km_rs?.toFixed(3)  ?? '—', 'KM RKS',     pair.km_rks?.toFixed(3) ?? '—'],
        ['Mast',   pair.mast  ?? '—',               'Tiefe Soll', (pair.tiefe ?? '—') + ' m'],
        ['Gleis',  pair.gleis ?? '—',               'Tagarbeit',  pair.tag    ?? '—'],
        ['Status', statusLabel(pd.status || 'geplant'), 'Zugang', pair.zugang || '—'],
      ],
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 28 }, 2: { fontStyle: 'bold', cellWidth: 28 } }
    });
    y = doc.lastAutoTable.finalY + 6;

    _berichtPdfPhaseSections(doc, pair, pd, y, { inclUmwelt, inclSich });
  }

  doc.save(`Bericht_Alle_${phaseLabel}_${new Date().toLocaleDateString('de-CH').replace(/\./g, '-')}.pdf`);
}


// ============================================================
