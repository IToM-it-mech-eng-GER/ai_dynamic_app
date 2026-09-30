# Spezifikation: ETF-Renditevergleich

## Ziel

Eine deutschsprachige, statische Single-Page-App vergleicht ein bis drei ETF-Sparpläne von der Anspar- bis optional in die Entnahmephase. Änderungen an Produkt- und Szenariodaten aktualisieren Kennzahlen, Diagramm und Tabelle sofort. Die Anwendung ist als verständlicher Prototyp für GitHub Pages gedacht.

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
- `js/calculator.js`: reine Sparplan- und Entnahmeberechnung
- `js/scenario.js`: Szenariozustand, Eingabegrenzen und Assistentennavigation
- `js/chart.js`: SVG-Diagramm
- `js/app.js`: Zustand, Formulare und Darstellung
- `tests/`: Rechentests

## Stil

Sprechende deutsche Oberflächentexte, englische JavaScript-Bezeichner und kleine reine Funktionen. Die Berechnung bleibt ohne DOM-Zugriff.

## Tests

Die Rechenlogik wird vor der Umsetzung mit Node-Tests beschrieben. Geprüft werden Nullrendite, Zinseszins, Kosten, Altersgrenzen, Anspar- und Entnahmephase sowie die sechs Schritte. Anschließend folgen Syntaxprüfung und Browserkontrolle für große und kleine Ansichten.

## Grenzen

- Immer: Eingaben begrenzen, Text sicher ausgeben, Berechnung als Modell kennzeichnen
- Vorher fragen: neue Abhängigkeiten, Backend, externe ETF-Daten oder Steuerlogik
- Nie: Live-Daten vortäuschen, Nutzerdaten übertragen oder Finanzberatung versprechen

## Erfolgskriterien

- Ein bis drei Produkte lassen sich hinzufügen, auswählen, bearbeiten und entfernen.
- Jedes Produkt besitzt eigene Werte für Name, Startkapital, Sparrate, Rendite, Kostenquote und ein vollständiges Szenario über alle sechs Eingabeseiten.
- Beim Wechsel des Produkts werden alle sechs zugehörigen Seiten mit den gespeicherten Produktwerten geladen.
- Persönliches Alter, Rentenalter und Lebenserwartung bestimmen den Zeitraum.
- Eine aktivierbare Entnahmephase stoppt die Sparrate ab Rentenbeginn und berücksichtigt Entnahme, Rendite und optionale Inflation.
- Rebalancing, Fondswechsel, politische Szenarien und Steuereinstellungen lassen sich aktivieren und einstellen.
- Endvermögen, Einzahlungen, Wertzuwachs, Kosten und Modellsteuern werden nachvollziehbar verglichen.
- Diagramm und Ergebnistabelle reagieren unmittelbar auf Änderungen.
- Die Eingaben lassen sich ein- und ausklappen.
- Sechs nummerierte Unterseiten lassen sich über Schaltflächen und horizontale Wischgesten wechseln.
- Die Oberfläche folgt der sterilen Weiß-Grau-Optik der Referenzen mit Orange als Interaktionsfarbe.
- Die App funktioniert ab 320 Pixel Breite und ist per Tastatur bedienbar.
- Die App läuft unverändert auf GitHub Pages.

## Sechs Eingabeseiten

1. Persönliche Parameter
2. Investment-Parameter
3. Entnahmephase
4. Strategie und Fondswechsel
5. Politische Szenarien und Steuer-Einstellungen
6. Produktübersicht und Depotkosten

## Nicht enthalten

Historische Kursdaten, Produktempfehlungen, rechtsverbindliche Steuerberechnung und Speicherung über Sitzungen hinweg.
