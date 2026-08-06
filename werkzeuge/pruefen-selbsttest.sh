#!/bin/bash
# ============================================================
# SELBSTTEST FÜR pruefen.js
#
# Aufruf aus dem Projektverzeichnis:
#     bash werkzeuge/pruefen-selbsttest.sh
#
# Baut jeden Defekt, den pruefen.js finden soll, gezielt in eine KOPIE des
# Projekts unter /tmp ein und prüft, ob er gemeldet wird. Das Original wird
# nicht angefasst.
#
# Wozu: Eine Prüfung, die nichts findet, sieht genauso aus wie ein sauberes
# Projekt. Nach jeder Änderung an pruefen.js hier gegenprüfen — sonst weiss
# niemand, ob die Prüfung noch greift. Alle Zeilen müssen ERKANNT zeigen.
# ============================================================
set -u
ORIG=/home/ivan_peric/projekte/Tiefbau/Sondagen
ARB=/tmp/pruef-selbsttest
rm -rf "$ARB"; mkdir -p "$ARB"
cp -r "$ORIG"/index.html "$ORIG"/sw.js "$ORIG"/version.js "$ORIG"/js "$ORIG"/werkzeuge "$ARB"/
cd "$ARB"

ergebnis() {
  local name="$1" muster="$2"
  local aus; aus=$(node werkzeuge/pruefen.js 2>&1)
  local code=$?
  if echo "$aus" | grep -q "$muster"; then
    if [ "$code" = "1" ]; then echo "ERKANNT   $name (Rueckgabewert 1)"; else echo "TEILWEISE $name — gemeldet, aber Rueckgabewert $code"; fi
  else
    echo "VERPASST  $name"; echo "$aus" | sed 's/^/            /'
  fi
}

sichern() { cp index.html /tmp/_i.html; cp sw.js /tmp/_s.js; cp version.js /tmp/_v.js; }
zurueck() { cp /tmp/_i.html index.html; cp /tmp/_s.js sw.js; cp /tmp/_v.js version.js; }
sichern

echo "--- Ausgangslage (muss sauber sein) ---"
node werkzeuge/pruefen.js --leise; echo "Rueckgabewert: $?"
echo ""
echo "--- Eingebaute Defekte ---"

# 1. Doppelte id
sed -i '0,/id="ft-prof-name"/s//id="ft-prof-name"/' index.html
perl -0pi -e 's/(<input class="modal-input" id="ft-prof-vfk-zeich")/<input class="modal-input" id="ft-prof-beton" type="text">\n$1/' index.html
ergebnis "doppelte id (ft-prof-beton)" 'FEHLER.*\[ids\]'
zurueck

# 2. Unausgeglichenes div
perl -0pi -e 's/<\/body>/<div>\n<\/body>/' index.html
ergebnis "fehlendes </div>" 'FEHLER.*\[tags\]'
zurueck

# 3. Doppeltes class-Attribut
perl -0pi -e 's/(<button onclick="closeBaupaketModal\(\)" class="modal-close")/$1 class="btn"/' index.html
ergebnis "class zweimal im Tag" 'FEHLER.*\[attribute\]'
zurueck

# 4. Utility-Klasse doppelt definiert (der .modal-close-Fall)
perl -0pi -e 's/(  \.modal-actions)/  .modal-close { font-size: 16px; }\n$1/' index.html
ergebnis "Utility doppelt definiert" 'FEHLER.*\[css\].*modal-close'
zurueck

# 5. Handler zeigt auf nicht existierende Funktion
perl -0pi -e 's/onclick="closeBaupaketModal\(\)"/onclick="gibtEsNichtMehr()"/' index.html
ergebnis "unbekannte Handler-Funktion" 'FEHLER.*\[handler\].*gibtEsNichtMehr'
zurueck

# 6. Modul in sw.js gelistet, Datei fehlt
perl -0pi -e "s/'js\/kern.js',/'js\/kern.js', 'js\/gibtsnicht.js',/" sw.js
ergebnis "sw.js listet fehlende Datei" 'FEHLER.*\[module\]'
zurueck

# 7. start.js nicht mehr an letzter Stelle
perl -0pi -e "s/'js\/start.js',\n\];/'js\/start.js',\n  'js\/uebersicht.js',\n];/" sw.js
ergebnis "start.js nicht zuletzt" 'FEHLER.*\[module\].*start.js'
zurueck

# 8. Zweite Versionsquelle in sw.js
perl -0pi -e "s/(const CACHE_NAME)/const CACHE_VERSION = 'v99';\n\$1/" sw.js
ergebnis "eigene CACHE_VERSION in sw.js" 'FEHLER.*\[version\]'
zurueck

echo ""
echo "--- Abschluss: Original wieder sauber? ---"
node werkzeuge/pruefen.js --leise; echo "Rueckgabewert: $?"
