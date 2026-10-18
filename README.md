# ETF-Renditevergleich

Statische Single-Page-App zum Vergleich von bis zu drei ETF-Sparplänen. Persönliche Zeiträume, Entnahmephase, Strategie, Steuerannahmen und Depotkosten werden über einen sechsstufigen Eingabe-Assistenten gesteuert. Die App benötigt keinen Build-Schritt und kann direkt über GitHub Pages veröffentlicht werden.

Die Eingaben lassen sich ein- und ausklappen. Auf kleinen Bildschirmen können die sechs Seiten zusätzlich horizontal gewischt werden. Jeder Plan speichert seine sechs Seiten unabhängig. Für Privatdepots berechnet die App den nötigen Bruttoverkauf für eine gewünschte Nettoentnahme anhand von FIFO, Teilfreistellung, Sparer-Pauschbetrag, Rentenbesteuerung und Günstigerprüfung nach dem Rechtsstand 2026. Beim Rentendepot wird die lebenslange Rente mit dem altersabhängigen Ertragsanteil besteuert; Grundfreibetrag, gesetzliche Rente und Veranlagungsart werden berücksichtigt.

Der getrennte Bereich **Analyse** verwaltet Aktien und ETFs über WKN, Kaufdatum und Kaufpreis. Abgerufene Kurs- und Fundamentaldaten werden im Browser gespeichert. Aktive Produkte werden in einem gemeinsamen transparenten Flächendiagramm dargestellt; acht Unternehmenskennzahlen zeigen bis zu fünf Geschäftsjahre. Für ETFs sind Fundamentaldaten häufig nicht verfügbar.

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

Die Ergebnisse sind Modellrechnungen und keine Anlage- oder Steuerberatung. Individuelle Sonderausgaben, Kirchensteuer, Kranken- und Pflegeversicherung, Vorabpauschalen und Ausschüttungen sind nicht enthalten. Vollständige Fondswechsel im Privatdepot werden als steuerpflichtige Verkäufe mit Verlustfortführung im Kapitalertragsteuertopf modelliert. Vor Rentenbeginn wird mangels Angaben zum Erwerbseinkommen keine Günstigerprüfung angewendet.

## Rechtsgrundlagen des Privatdepots

- [§ 20 EStG](https://www.gesetze-im-internet.de/estg/__20.html): Veräußerungsgewinn, FIFO und Sparer-Pauschbetrag
- [§ 32d EStG](https://www.gesetze-im-internet.de/estg/__32d.html): Abgeltungsteuer und Günstigerprüfung
- [§ 32a EStG](https://www.gesetze-im-internet.de/estg/__32a.html): Einkommensteuertarif 2026
- [§ 22 EStG](https://www.gesetze-im-internet.de/estg/__22.html): Besteuerungsanteil der gesetzlichen Rente
- [§ 20 InvStG](https://www.gesetze-im-internet.de/invstg_2018/__20.html): Teilfreistellung von Investmentfonds
- [Solidaritätszuschlaggesetz 1995](https://www.gesetze-im-internet.de/solzg_1995/)

## Rechtsgrundlage des Rentendepots

- [§ 22 Nummer 1 Satz 3 Buchstabe a Doppelbuchstabe bb EStG](https://www.gesetze-im-internet.de/estg/__22.html): altersabhängiger Ertragsanteil einer lebenslangen privaten Leibrente

## GitHub Pages

Den Projektinhalt in ein GitHub-Repository übertragen und unter **Settings → Pages** die Veröffentlichung aus dem Hauptzweig und dem Stammverzeichnis aktivieren. Die Vergleichsrechnung benötigt keinen Build-Schritt.

## Online-Daten der Analyse

Der Ordner `worker/` enthält den vorgesehenen Cloudflare-Dienst. Er löst WKN über OpenFIGI auf, lädt Kurs- und Unternehmensdaten von Alpha Vantage und speichert erfolgreiche Antworten 24 Stunden im Cloudflare-Cache. Der Browser speichert die bereits geladenen Daten zusätzlich lokal.

Für den Betrieb sind folgende Schritte nötig:

1. Einen eigenen Alpha-Vantage-Zugangsschlüssel anlegen.
2. Im Ordner `worker/` das Cloudflare-Geheimnis `ALPHA_VANTAGE_API_KEY` setzen.
3. Den Worker veröffentlichen.
4. Die veröffentlichte Worker-Adresse in `js/analysis-config.js` eintragen.

Ein optionaler OpenFIGI-Schlüssel kann als `OPENFIGI_API_KEY` hinterlegt werden. Geheimnisse gehören ausschließlich in Cloudflare und niemals in dieses Repository. Die lokale Passwortabfrage der statischen Seite ist nur eine Sichtbarriere und ersetzt keine serverseitige Anmeldung. Das kostenlose Alpha-Vantage-Angebot ist stark begrenzt; der tägliche Cache reduziert deshalb erneute Abrufe.
