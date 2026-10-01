# ETF-Renditevergleich

Statische Single-Page-App zum Vergleich von bis zu drei ETF-Sparplänen. Persönliche Zeiträume, Entnahmephase, Strategie, Steuerannahmen und Depotkosten werden über einen sechsstufigen Eingabe-Assistenten gesteuert. Die App benötigt keinen Build-Schritt und kann direkt über GitHub Pages veröffentlicht werden.

Die Eingaben lassen sich ein- und ausklappen. Auf kleinen Bildschirmen können die sechs Seiten zusätzlich horizontal gewischt werden. Jeder Plan speichert seine sechs Seiten unabhängig. Für Privatdepots berechnet die App den nötigen Bruttoverkauf für eine gewünschte Nettoentnahme anhand von FIFO, Teilfreistellung, Sparer-Pauschbetrag, Rentenbesteuerung und Günstigerprüfung nach dem Rechtsstand 2026.

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

Die Ergebnisse sind Modellrechnungen und keine Anlage- oder Steuerberatung. Individuelle Sonderausgaben, Kirchensteuer, Kranken- und Pflegeversicherung, Verlustverrechnung, Vorabpauschalen und Ausschüttungen sind nicht enthalten.

## Rechtsgrundlagen des Privatdepots

- [§ 20 EStG](https://www.gesetze-im-internet.de/estg/__20.html): Veräußerungsgewinn, FIFO und Sparer-Pauschbetrag
- [§ 32d EStG](https://www.gesetze-im-internet.de/estg/__32d.html): Abgeltungsteuer und Günstigerprüfung
- [§ 32a EStG](https://www.gesetze-im-internet.de/estg/__32a.html): Einkommensteuertarif 2026
- [§ 22 EStG](https://www.gesetze-im-internet.de/estg/__22.html): Besteuerungsanteil der gesetzlichen Rente
- [§ 20 InvStG](https://www.gesetze-im-internet.de/invstg_2018/__20.html): Teilfreistellung von Investmentfonds
- [Solidaritätszuschlaggesetz 1995](https://www.gesetze-im-internet.de/solzg_1995/)

## GitHub Pages

Den Projektinhalt in ein GitHub-Repository übertragen und unter **Settings → Pages** die Veröffentlichung aus dem Hauptzweig und dem Stammverzeichnis aktivieren. Da die App keine externen Abhängigkeiten und keinen Build-Schritt besitzt, sind keine weiteren Anpassungen nötig.
