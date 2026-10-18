# Spezifikation: ETF-Renditevergleich

## Ziel

Eine deutschsprachige, statische Web-App vergleicht ein bis drei ETF-Sparpläne von der Anspar- bis optional in die Entnahmephase. Änderungen an Produkt- und Szenariodaten aktualisieren Kennzahlen, Diagramm und Tabelle sofort. Ein davon getrennter Analysebereich wertet reale Kurs- und Fundamentaldaten von Aktien und ETFs aus. Die Anwendung ist für GitHub Pages gedacht.

## Technik

- Semantisches HTML, CSS und JavaScript als ES-Module
- Keine Laufzeitabhängigkeiten im Browser
- SVG-Diagramm aus lokalen Berechnungsdaten
- Separater Cloudflare-Dienst als Vermittlung für externe Marktdaten
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
- `analyse.html`: geschützter, getrennter Analysebereich
- `js/analysis-model.js`: lokaler Analysezustand und gestapelte Kursreihen
- `js/analysis-chart.js`: SVG-Kursdiagramm
- `js/analysis.js`: Bedienung, lokaler Speicher und Datenabruf
- `worker/worker.js`: WKN-Auflösung, Marktdatenabruf und Tagescache
- `tests/`: Rechentests

## Stil

Sprechende deutsche Oberflächentexte, englische JavaScript-Bezeichner und kleine reine Funktionen. Die Berechnung bleibt ohne DOM-Zugriff.

## Tests

Die Rechenlogik wird vor der Umsetzung mit Node-Tests beschrieben. Geprüft werden Nullrendite, Zinseszins, Kosten, Altersgrenzen, Anspar- und Entnahmephase sowie die sechs Schritte. Anschließend folgen Syntaxprüfung und Browserkontrolle für große und kleine Ansichten.

## Grenzen

- Immer: Eingaben begrenzen, Text sicher ausgeben, Berechnung als Modell kennzeichnen
- Externe Zugangsschlüssel niemals an den Browser oder ins Repository geben
- WKN serverseitig validieren und externe Antworten vor der Speicherung normalisieren
- Nie: Live-Daten vortäuschen, Nutzerdaten übertragen oder Finanzberatung versprechen

## Erfolgskriterien

- Ein bis drei Produkte lassen sich hinzufügen, auswählen, bearbeiten und entfernen.
- Jedes Produkt besitzt eigene Werte für Name, Startkapital, Sparrate, Rendite, Kostenquote und ein vollständiges Szenario über alle sechs Eingabeseiten.
- Beim Wechsel des Produkts werden alle sechs zugehörigen Seiten mit den gespeicherten Produktwerten geladen.
- Persönliches Alter, Rentenalter und Lebenserwartung bestimmen den Zeitraum.
- Eine aktivierbare Entnahmephase stoppt die Sparrate ab Rentenbeginn und berücksichtigt Entnahme, Rendite und optionale Inflation.
- Rebalancing lässt sich im Renten-Depot als Renditesteigerung aktivieren.
- Pro Produkt lassen sich mehrere vollständige Fondswechsel festlegen. Im Privatdepot werden dabei realisierte Gewinne besteuert.
- Fondswechsel vor Rentenbeginn werden mangels Angaben zum Erwerbseinkommen mit der Abgeltungsteuer modelliert; ab Rentenbeginn greift zusätzlich die Günstigerprüfung.
- Negative steuerpflichtige Fondsergebnisse werden im Modell innerhalb des Kapitalertragsteuertopfs fortgeführt.
- Endvermögen, Einzahlungen, Wertzuwachs, Kosten und Modellsteuern werden nachvollziehbar verglichen.
- Je Produkt kann zwischen Renten- und Privatdepot gewechselt werden.
- Das Privatdepot rechnet Nettoentnahmen in FIFO-Bruttoverkäufe um und berücksichtigt Teilfreistellung, Sparer-Pauschbetrag, gesetzliche Rente, Rentenbesteuerungsanteil, Grundfreibetrag, Günstigerprüfung und Solidaritätszuschlag nach dem Rechtsstand 2026.
- Diagramm und Ergebnistabelle reagieren unmittelbar auf Änderungen.
- Die Eingaben lassen sich ein- und ausklappen.
- Sechs nummerierte Unterseiten lassen sich über Schaltflächen und horizontale Wischgesten wechseln.
- Die Oberfläche folgt der sterilen Weiß-Grau-Optik der Referenzen mit Orange als Interaktionsfarbe.
- Die App funktioniert ab 320 Pixel Breite und ist per Tastatur bedienbar.
- Die App läuft unverändert auf GitHub Pages.
- Die Analyse ist als eigene Seite erreichbar und verändert die bestehende Vergleichsrechnung nicht.
- Aktien und ETFs lassen sich per WKN, Kaufdatum, Kaufpreis und Stückzahl hinzufügen und einzeln aktivieren.
- Geladene Daten bleiben im Browser erhalten und der Vermittlungsdienst speichert Antworten 24 Stunden zwischen.
- Aktive Kursverläufe werden transparent gestapelt; jede Reihe darf an ihrem eigenen letzten verfügbaren Datum enden.
- Umsatz, operatives Ergebnis, freier Cashflow, EBITDA-Marge, Bilanzsumme, Kurs-Umsatz-Verhältnis, liquide Mittel und Schulden werden für bis zu fünf Geschäftsjahre dargestellt.

## Sechs Eingabeseiten

1. Persönliche Parameter
2. Investment-Parameter
3. Entnahmephase
4. Strategie und Fondswechsel
5. Politische Szenarien und Steuer-Einstellungen
6. Produktübersicht und Depotkosten

## Nicht enthalten

Produktempfehlungen und rechtsverbindliche Steuerberatung. Im Privatdepot nicht enthalten sind Kirchensteuer, individuelle Sonderausgaben, Kranken- und Pflegeversicherung, Vorabpauschalen und Ausschüttungen. Die Passwortabfrage auf GitHub Pages ist keine vollwertige Zugriffskontrolle. Historische Fundamentaldaten von ETFs sowie nicht vom Datenanbieter abgedeckte Wertpapiere werden als nicht verfügbar angezeigt.
