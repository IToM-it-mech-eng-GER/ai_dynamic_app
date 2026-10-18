import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ANALYSIS_STORAGE_KEY,
  buildStackedSeries,
  createAnalysisSecurity,
  getFiveYearFundamentals,
  normalizeWkn,
  readAnalysisState,
  serializeAnalysisState,
  setSecurityActive,
} from "../js/analysis-model.js";

test("akzeptiert gültige WKN und verwirft mehrdeutige Zeichen", () => {
  assert.equal(normalizeWkn(" 865985 "), "865985");
  assert.equal(normalizeWkn("a1jx52"), "A1JX52");
  assert.equal(normalizeWkn("A1IO00"), "");
  assert.equal(normalizeWkn("12345"), "");
});

test("speichert Wertpapiere mit Kurs- und Fundamentaldaten lokal", () => {
  const security = createAnalysisSecurity({
    id: "security-1",
    wkn: "865985",
    purchaseDate: "2020-01-03",
    purchasePrice: 100,
    quantity: 3.5,
    fetchedAt: "2026-10-18T10:00:00.000Z",
    instrument: { name: "Apple Inc.", symbol: "AAPL" },
    prices: [{ date: "2020-01-03", close: 75 }],
    fundamentals: [{ year: 2025, revenue: 1000 }],
  });

  const serialized = serializeAnalysisState({ securities: [security] });
  const restored = readAnalysisState(serialized);

  assert.equal(ANALYSIS_STORAGE_KEY, "renditeatlas-analysis-v1");
  assert.equal(restored.securities[0].purchasePrice, 100);
  assert.equal(restored.securities[0].quantity, 3.5);
  assert.equal(restored.securities[0].prices[0].close, 75);
  assert.equal(restored.securities[0].fundamentals[0].revenue, 1000);
});

test("schaltet nur das gewählte Wertpapier aktiv", () => {
  const first = createAnalysisSecurity({ id: "one", wkn: "865985", purchaseDate: "2024-01-01", purchasePrice: 100 });
  const second = createAnalysisSecurity({ id: "two", wkn: "A1JX52", purchaseDate: "2024-01-01", purchasePrice: 100 });
  const updated = setSecurityActive([first, second], "one", false);

  assert.equal(updated[0].active, false);
  assert.equal(updated[1].active, true);
});

test("gestapelte Kursreihen enden am letzten vorhandenen Wert des jeweiligen Produkts", () => {
  const first = createAnalysisSecurity({
    id: "one",
    wkn: "865985",
    purchaseDate: "2024-01-05",
    purchasePrice: 100,
    prices: [
      { date: "2024-01-05", close: 50 },
      { date: "2024-01-12", close: 55 },
    ],
  });
  const second = createAnalysisSecurity({
    id: "two",
    wkn: "A1JX52",
    purchaseDate: "2024-01-05",
    purchasePrice: 200,
    prices: [
      { date: "2024-01-05", close: 100 },
      { date: "2024-01-12", close: 110 },
      { date: "2024-01-19", close: 120 },
    ],
  });

  const result = buildStackedSeries([first, second]);

  assert.deepEqual(result.dates, ["2024-01-05", "2024-01-12", "2024-01-19"]);
  assert.equal(result.layers[0].points.at(-1).value, null);
  assert.equal(result.layers[1].points.at(-1).value, 240);
  assert.equal(result.totals.at(-1).value, 240);
});

test("multipliziert den Kursverlauf mit der gekauften Stückzahl", () => {
  const security = createAnalysisSecurity({
    id: "one",
    wkn: "865985",
    purchaseDate: "2024-01-05",
    purchasePrice: 100,
    quantity: 2.5,
    prices: [
      { date: "2024-01-05", close: 100 },
      { date: "2024-01-12", close: 120 },
    ],
  });

  const result = buildStackedSeries([security]);

  assert.equal(result.layers[0].points[0].value, 250);
  assert.equal(result.layers[0].points.at(-1).value, 300);
});

test("behandelt ältere gespeicherte Produkte wie einen Anteil", () => {
  const security = createAnalysisSecurity({
    id: "one",
    wkn: "865985",
    purchaseDate: "2024-01-05",
    purchasePrice: 100,
  });

  assert.equal(security.quantity, 1);
});

test("liefert höchstens die letzten fünf Geschäftsjahre in zeitlicher Reihenfolge", () => {
  const reports = [2020, 2021, 2022, 2023, 2024, 2025].map((year) => ({ year, revenue: year * 10 }));
  const selected = getFiveYearFundamentals(reports);

  assert.deepEqual(selected.map((report) => report.year), [2021, 2022, 2023, 2024, 2025]);
});

test("die Analyse bleibt eine eigenständige geschützte Seite", async () => {
  const html = await readFile(new URL("../analyse.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../js/analysis.js", import.meta.url), "utf8");
  const config = await readFile(new URL("../js/analysis-config.js", import.meta.url), "utf8");

  assert.match(html, /id="analysis-login"/);
  assert.match(html, /id="analysis-add-form"/);
  assert.match(html, /id="analysis-quantity"/);
  assert.match(html, /id="analysis-chart"/);
  assert.match(html, /id="fundamentals-grid"/);
  assert.match(app, /crypto\.subtle\.digest/);
  assert.match(app, /analysis-config\.js\?v=api1/);
  assert.match(config, /https:\/\/renditeatlas-analysis-api\.itmeise\.workers\.dev/);
  assert.doesNotMatch(`${html}\n${app}`, /adminadmin/);
});

test("die Analyse zeigt keine erfundenen Entwicklungsdaten", async () => {
  const html = await readFile(new URL("../analyse.html", import.meta.url), "utf8");

  assert.doesNotMatch(html, /Apple|Microsoft|Vanguard|MSCI World/);
  assert.match(html, /Noch keine Wertpapiere/);
});
