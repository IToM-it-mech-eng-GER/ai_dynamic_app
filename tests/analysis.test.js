import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ANALYSIS_STORAGE_KEY,
  buildStackedSeries,
  createAnalysisSecurity,
  getMissingAnalysisSections,
  getFiveYearFundamentals,
  mergeAnalysisSecurityData,
  normalizeWkn,
  removeAnalysisFundamental,
  removeAnalysisPrice,
  readAnalysisState,
  serializeAnalysisState,
  setSecurityActive,
  upsertAnalysisFundamental,
  upsertAnalysisPrice,
} from "../js/analysis-model.js";

test("ermittelt nur die noch fehlenden Online-Datenbereiche", () => {
  const security = createAnalysisSecurity({
    id: "security-1",
    wkn: "A2QA4J",
    purchaseDate: "2025-03-14",
    purchasePrice: 75.26,
    instrument: { name: "Palantir Technologies", symbol: "PLTR", type: "Common Stock", currency: "USD" },
    prices: [{ date: "2025-01-03", close: 75.5 }],
    fundamentals: [{
      year: 2025,
      revenue: 1000,
      operatingIncome: 180,
      freeCashFlow: null,
      ebitdaMargin: 25,
      totalAssets: 4000,
      priceToSales: 2,
      cash: 500,
      debt: 900,
    }],
  });

  assert.deepEqual(getMissingAnalysisSections(security), ["cashflow"]);
});

test("fordert für ein leeres Wertpapier alle benötigten Datenbereiche an", () => {
  const security = createAnalysisSecurity({
    id: "security-1",
    wkn: "A2QA4J",
    purchaseDate: "2025-03-14",
    purchasePrice: 75.26,
  });

  assert.deepEqual(getMissingAnalysisSections(security), ["prices", "income", "balance", "cashflow"]);
});

test("fragt vorhandene Kursdaten nicht nur wegen eines fehlenden Kurs-Umsatz-Verhältnisses erneut ab", () => {
  const security = createAnalysisSecurity({
    id: "security-1",
    wkn: "A2QA4J",
    purchaseDate: "2025-03-14",
    purchasePrice: 75.26,
    prices: [{ date: "2025-01-03", close: 75.5 }],
    fundamentals: [{
      year: 2025,
      revenue: 1000,
      operatingIncome: 180,
      freeCashFlow: 220,
      ebitdaMargin: 25,
      totalAssets: 4000,
      priceToSales: null,
      cash: 500,
      debt: 900,
    }],
  });

  assert.deepEqual(getMissingAnalysisSections(security), []);
});

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

test("bewahrt erhaltene Teildaten und ergänzt spätere Abrufe ohne Datenverlust", () => {
  const existing = createAnalysisSecurity({
    id: "security-1",
    wkn: "865985",
    purchaseDate: "2024-01-05",
    purchasePrice: 100,
    instrument: { name: "Apple Inc.", symbol: "AAPL", currency: "USD" },
    prices: [{ date: "2024-01-05", close: 185 }],
    fundamentals: [{ year: 2025, revenue: 1000, totalAssets: 4000 }],
  });

  const merged = mergeAnalysisSecurityData(existing, {
    fetchedAt: "2026-10-23T10:00:00.000Z",
    instrument: { name: "Apple Inc.", symbol: "AAPL", currency: "USD" },
    prices: [{ date: "2024-01-12", close: 190 }],
    fundamentals: [{ year: 2025, revenue: 1200, totalAssets: null }],
    warnings: ["Bilanzdaten konnten noch nicht geladen werden."],
  });

  assert.deepEqual(merged.prices, [
    { date: "2024-01-05", close: 185 },
    { date: "2024-01-12", close: 190 },
  ]);
  assert.equal(merged.fundamentals[0].revenue, 1200);
  assert.equal(merged.fundamentals[0].totalAssets, 4000);
  assert.deepEqual(merged.warnings, ["Bilanzdaten konnten noch nicht geladen werden."]);
});

test("einzelne Kurs- und Fundamentaldaten lassen sich manuell ergänzen und entfernen", () => {
  let security = createAnalysisSecurity({
    id: "security-1",
    wkn: "865985",
    purchaseDate: "2024-01-05",
    purchasePrice: 100,
  });

  security = upsertAnalysisPrice(security, { date: "2025-01-03", close: 210.5 });
  security = upsertAnalysisFundamental(security, { year: 2025, revenue: 1000, debt: 250 });
  assert.deepEqual(security.prices, [{ date: "2025-01-03", close: 210.5 }]);
  assert.equal(security.fundamentals[0].revenue, 1000);
  assert.equal(security.fundamentals[0].debt, 250);
  assert.equal(security.fundamentals[0].cash, null);

  security = removeAnalysisPrice(security, "2025-01-03");
  security = removeAnalysisFundamental(security, 2025);
  assert.deepEqual(security.prices, []);
  assert.deepEqual(security.fundamentals, []);
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

test("zeigt höchstens zehn Jahre und nur den letzten Kurswert je Quartal", () => {
  const security = createAnalysisSecurity({
    id: "one",
    wkn: "865985",
    purchaseDate: "2015-01-01",
    purchasePrice: 100,
    prices: [
      { date: "2015-01-02", close: 100 },
      { date: "2016-09-30", close: 108 },
      { date: "2016-10-21", close: 110 },
      { date: "2016-12-30", close: 112 },
      { date: "2017-01-06", close: 113 },
      { date: "2017-03-31", close: 114 },
      { date: "2017-04-07", close: 115 },
      { date: "2026-07-03", close: 200 },
      { date: "2026-09-25", close: 210 },
      { date: "2026-10-02", close: 220 },
    ],
  });

  const result = buildStackedSeries([security]);

  assert.deepEqual(result.dates, [
    "2016-12-30",
    "2017-03-31",
    "2017-04-07",
    "2026-09-25",
    "2026-10-02",
  ]);
  assert.deepEqual(result.layers[0].points.map((point) => point.value), [112, 114, 115, 210, 220]);
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
  assert.match(html, /id="analysis-add-manual"/);
  assert.match(html, /id="analysis-edit-dialog"/);
  assert.match(html, /id="analysis-edit-price-date"/);
  assert.match(html, /id="analysis-edit-fundamental-year"/);
  assert.match(html, /id="analysis-edit-save"/);
  assert.match(html, /id="analysis-quantity"/);
  assert.match(html, /id="analysis-name"/);
  assert.match(html, /id="analysis-symbol"/);
  assert.match(html, /id="analysis-type"/);
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
