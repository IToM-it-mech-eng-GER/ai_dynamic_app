# Aufgaben

- [x] Projektgrundlage und Spezifikation anlegen
  - Abnahme: Stack, Grenzen und Erfolgskriterien sind festgehalten.
  - Prüfung: Dateien sind vorhanden und gültig.

- [x] Sparplanberechnung testgetrieben umsetzen
  - Abnahme: Einzahlungen, Zuwachs, Kosten und Jahreswerte stimmen.
  - Prüfung: `npm test`

- [x] Vergleichsoberfläche umsetzen
  - Abnahme: Ein bis drei Produkte besitzen getrennte Einstellungen.
  - Prüfung: `npm run check` und Bedienprüfung im Browser

- [x] Responsive und zugängliche Darstellung abschließen
  - Abnahme: Ansichten bei 320, 768, 1024 und 1440 Pixeln funktionieren.
  - Prüfung: Browser-Screenshots, Fokusreihenfolge und saubere Konsole

- [x] Lokale Vorschau bereitstellen
  - Abnahme: App ist unter Port 4177 erreichbar.
  - Prüfung: HTTP-Aufruf und Browser-Ladetest

- [x] Szenario- und Entnahmelogik erweitern
  - Abnahme: Altersgrenzen, Entnahme und Kosten liefern nachvollziehbare Ergebnisse.
  - Prüfung: `npm test`

- [x] Sechsstufigen Eingabe-Assistenten umsetzen
  - Abnahme: Pfeile und horizontale Wischgeste wechseln sicher zwischen sechs Seiten.
  - Prüfung: Bedienprüfung im Browser

- [x] Eingaben ein- und ausklappbar machen
  - Abnahme: Der Vergleich nutzt den freien Platz und alle Bedienelemente bleiben erreichbar.
  - Prüfung: Desktop- und Mobilansicht

- [x] Referenzoptik und Unterfunktionen vervollständigen
  - Abnahme: Entnahme, Strategie, politische Szenarien, Steuern und Depotkosten reagieren auf Eingaben.
  - Prüfung: `npm run check` und Browserprüfung

- [x] Szenarien je Produkt isolieren
  - Abnahme: Änderungen an Plan 1 verändern keine der sechs Eingabeseiten von Plan 2 oder 3.
  - Prüfung: `npm test` und Produktwechsel im Browser

- [x] Privatdepot mit steuerlicher Nettoentnahme ergänzen
  - Abnahme: FIFO, Teilfreistellung, Freibeträge und gesetzliche Rente bestimmen den Bruttoverkauf je Produkt.
  - Prüfung: `npm test`, Produktwechsel sowie Desktop- und Mobilansicht im Browser

- [x] Eigenständigen Analysebereich und Kennwortabfrage ergänzen
  - Abnahme: Der neue Menüpunkt öffnet ausschließlich die Analyseseite; bestehende Bereiche bleiben unverändert.
  - Prüfung: Strukturtests und Browserprüfung

- [x] Wertpapiere und lokale Datenspeicherung umsetzen
  - Abnahme: WKN, Kaufdatum, Kaufpreis und Aktivstatus bleiben nach dem Neuladen erhalten.
  - Prüfung: `npm test`

- [ ] Kurs- und Fundamentaldaten sicher anbinden
  - Abnahme: Der Vermittlungsdienst löst gültige WKN auf, schützt Zugangsschlüssel und speichert Antworten 24 Stunden zwischen.
  - Prüfung: Schnittstellen- und Eingabeprüfungen; Veröffentlichung benötigt noch einen Alpha-Vantage-Schlüssel und die Cloudflare-Adresse.

- [x] Kurs- und Fundamentalanalyse darstellen
  - Abnahme: Aktive Produkte erscheinen im gemeinsamen Flächendiagramm; acht Kennzahlen zeigen bis zu fünf Geschäftsjahre je Produkt.
  - Prüfung: `npm test`, Syntaxprüfung und Browserprüfung
