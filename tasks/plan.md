# Umsetzungsplan: ETF-Renditevergleich

## Überblick

Der leere Projektordner erhält eine kleine statische App nach dem Muster der 34D_WebApp. Rechenlogik, Darstellung und Interaktion bleiben getrennt, damit die Berechnung unabhängig getestet werden kann.

## Entscheidungen

- Gemeinsamer Anlagehorizont für einen fairen Vergleich
- Eigene Annahmen je Produkt
- Monatliche Verzinsung nach Abzug der jährlichen Kostenquote
- Keine Bibliotheken oder entfernten Ressourcen
- SVG statt externer Diagrammbibliothek

## Phasen

### 1. Grundlage

- Projektdateien, Spezifikation und Prüfkommandos anlegen
- Rechenverhalten mit Tests beschreiben

### 2. Kernfunktion

- Sparplanberechnung umsetzen
- Oberfläche für ein bis drei Produkte und Diagramm anbinden

### 3. Qualität

- Große und kleine Ansichten prüfen
- Tastaturbedienung, Konsole und Ergebnisse prüfen
- Vorschau auf Port 4177 bereitstellen

## Risiken

- Finanzwerte können als Prognose missverstanden werden: deutlicher Modellhinweis in der Oberfläche
- Viele Linien können auf kleinen Geräten unübersichtlich werden: Karten horizontal, Diagramm scrollbar
- Unplausible Eingaben: feste Grenzen und sichere Standardwerte

## Offene Punkte

- Steuer- und Entnahmephase sind bewusst nicht Bestandteil dieses Prototyps.

