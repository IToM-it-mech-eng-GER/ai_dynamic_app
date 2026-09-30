# ETF-Renditevergleich

Statische Single-Page-App zum Vergleich von bis zu drei ETF-Sparplänen. Persönliche Zeiträume, Entnahmephase, Strategie, vereinfachte Steuerannahmen und Depotkosten werden über einen sechsstufigen Eingabe-Assistenten gesteuert. Die App benötigt keinen Build-Schritt und kann direkt über GitHub Pages veröffentlicht werden.

Die Eingaben lassen sich ein- und ausklappen. Auf kleinen Bildschirmen können die sechs Seiten zusätzlich horizontal gewischt werden. Jeder Plan speichert seine sechs Seiten unabhängig.

## Lokal starten

```bash
python3 -m http.server 4177
```

Danach ist die App unter `http://localhost:4177` erreichbar.

## Prüfen

```bash
npm test
npm run check
```

Die Ergebnisse sind vereinfachte Modellrechnungen und keine Anlage- oder Steuerberatung.

## GitHub Pages

Den Projektinhalt in ein GitHub-Repository übertragen und unter **Settings → Pages** die Veröffentlichung aus dem Hauptzweig und dem Stammverzeichnis aktivieren. Da die App keine externen Abhängigkeiten und keinen Build-Schritt besitzt, sind keine weiteren Anpassungen nötig.
