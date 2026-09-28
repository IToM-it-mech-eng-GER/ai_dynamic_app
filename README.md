# ETF-Renditevergleich

Statische Single-Page-App zum Vergleich von bis zu drei ETF-Sparplänen. Die App benötigt keinen Build-Schritt und kann direkt über GitHub Pages veröffentlicht werden.

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

Die Ergebnisse sind vereinfachte Modellrechnungen und keine Anlageberatung.

## GitHub Pages

Den Projektinhalt in ein GitHub-Repository übertragen und unter **Settings → Pages** die Veröffentlichung aus dem Hauptzweig und dem Stammverzeichnis aktivieren. Da die App keine externen Abhängigkeiten und keinen Build-Schritt besitzt, sind keine weiteren Anpassungen nötig.
