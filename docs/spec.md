# Spezifikation: ETF-Renditevergleich

## Ziel

Eine deutschsprachige, statische Single-Page-App vergleicht ein bis drei ETF-Sparpläne über einen gemeinsamen Anlagehorizont. Änderungen an Produktdaten aktualisieren Kennzahlen, Diagramm und Tabelle sofort. Die Anwendung ist als verständlicher Prototyp für GitHub Pages gedacht.

## Technik

- Semantisches HTML, CSS und JavaScript als ES-Module
- Keine Laufzeitabhängigkeiten und kein Backend
- SVG-Diagramm aus lokalen Berechnungsdaten
- Eingebaute Node-Testausführung wie bei der 34D_WebApp

## Befehle

- Start: `python3 -m http.server 4177`
- Tests: `npm test`
- Syntaxprüfung: `npm run check`

## Struktur

- `index.html`: zugängliche Seitenstruktur
- `styles.css`: Gestaltung und responsive Ansichten
- `js/calculator.js`: reine Sparplanberechnung und Eingabegrenzen
- `js/chart.js`: SVG-Diagramm
- `js/app.js`: Zustand, Formulare und Darstellung
- `tests/`: Rechentests

## Stil

Sprechende deutsche Oberflächentexte, englische JavaScript-Bezeichner und kleine reine Funktionen. Beispiel: `calculatePlan(product, years)` liefert Jahreswerte und Summen ohne DOM-Zugriff.

## Tests

Die Rechenlogik wird vor der Umsetzung mit Node-Tests beschrieben. Geprüft werden Nullrendite, Zinseszins, Kosten, Grenzen und Jahresreihen. Anschließend folgen Syntaxprüfung und Browserkontrolle für große und kleine Ansichten.

## Grenzen

- Immer: Eingaben begrenzen, Text sicher ausgeben, Berechnung als Modell kennzeichnen
- Vorher fragen: neue Abhängigkeiten, Backend, externe ETF-Daten oder Steuerlogik
- Nie: Live-Daten vortäuschen, Nutzerdaten übertragen oder Finanzberatung versprechen

## Erfolgskriterien

- Ein bis drei Produkte lassen sich hinzufügen, auswählen, bearbeiten und entfernen.
- Jedes Produkt besitzt eigene Werte für Name, Startkapital, Sparrate, Rendite und Kostenquote.
- Der gemeinsame Zeitraum beträgt 1 bis 50 Jahre.
- Endvermögen, Einzahlungen und Wertzuwachs werden korrekt verglichen.
- Diagramm und Ergebnistabelle reagieren unmittelbar auf Änderungen.
- Die App funktioniert ab 320 Pixel Breite und ist per Tastatur bedienbar.
- Die App läuft unverändert auf GitHub Pages.

## Nicht enthalten

Steuern, Inflation, Entnahmephase, historische Kursdaten, Produktempfehlungen und Speicherung über Sitzungen hinweg.

