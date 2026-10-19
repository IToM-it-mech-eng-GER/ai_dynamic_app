import assert from "node:assert/strict";
import test from "node:test";

import {
  alphaProviderError,
  buildFundamentalHistory,
  parseWeeklyPrices,
  selectAlphaMatch,
  validateWkn,
} from "../worker/worker.js";

test("unterscheidet Schlüssel-, Tarif- und Limitfehler des Marktdatenanbieters", () => {
  assert.match(
    alphaProviderError({ Information: "The parameter apikey is invalid or missing." }),
    /Schlüssel ist ungültig/,
  );
  assert.match(
    alphaProviderError({ Information: "This is a premium endpoint." }),
    /kostenpflichtigen Zugang/,
  );
  assert.match(
    alphaProviderError({ Note: "Our standard API rate limit is 25 requests per day." }),
    /tägliche Abruflimit/,
  );
  assert.match(
    alphaProviderError({ Information: "Please contact premium@example.com if you are targeting a higher API call volume." }),
    /tägliche Abruflimit/,
  );
});

test("der Abrufdienst akzeptiert nur eindeutige WKN", () => {
  assert.equal(validateWkn("865985"), "865985");
  assert.equal(validateWkn("a1jx52"), "A1JX52");
  assert.equal(validateWkn("A1IO00"), "");
  assert.equal(validateWkn("1234567"), "");
});

test("wählt den passendsten Börsentreffer anhand Ticker und Trefferqualität", () => {
  const result = selectAlphaMatch([
    { "1. symbol": "APC.DEX", "2. name": "Apple Inc", "4. region": "Germany", "8. currency": "EUR", "9. matchScore": "0.82" },
    { "1. symbol": "AAPL", "2. name": "Apple Inc", "4. region": "United States", "8. currency": "USD", "9. matchScore": "1.00" },
  ], { ticker: "AAPL", name: "Apple Inc" });

  assert.equal(result.symbol, "AAPL");
  assert.equal(result.currency, "USD");
});

test("liest wöchentliche Schlusskurse chronologisch", () => {
  const prices = parseWeeklyPrices({
    "Weekly Adjusted Time Series": {
      "2025-01-10": { "5. adjusted close": "105.50" },
      "2025-01-03": { "5. adjusted close": "100.00" },
    },
  });

  assert.deepEqual(prices, [
    { date: "2025-01-03", close: 100 },
    { date: "2025-01-10", close: 105.5 },
  ]);
});

test("verknüpft die acht Kennzahlen auf höchstens fünf Geschäftsjahre", () => {
  const years = [2020, 2021, 2022, 2023, 2024, 2025];
  const income = years.map((year) => ({
    fiscalDateEnding: `${year}-09-30`,
    totalRevenue: "1000",
    operatingIncome: "180",
    ebitda: "250",
  }));
  const balance = years.map((year) => ({
    fiscalDateEnding: `${year}-09-30`,
    totalAssets: "4000",
    cashAndCashEquivalentsAtCarryingValue: "500",
    shortLongTermDebtTotal: "900",
    commonStockSharesOutstanding: "100",
  }));
  const cashFlow = years.map((year) => ({
    fiscalDateEnding: `${year}-09-30`,
    operatingCashflow: "300",
    capitalExpenditures: "-80",
  }));
  const prices = years.map((year) => ({ date: `${year}-09-25`, close: 20 }));

  const result = buildFundamentalHistory(income, balance, cashFlow, prices);

  assert.deepEqual(result.map((report) => report.year), [2021, 2022, 2023, 2024, 2025]);
  assert.equal(result.at(-1).freeCashFlow, 220);
  assert.equal(result.at(-1).ebitdaMargin, 25);
  assert.equal(result.at(-1).priceToSales, 2);
  assert.equal(result.at(-1).cash, 500);
  assert.equal(result.at(-1).debt, 900);
});

test("erfindet bei fehlenden Bilanzwerten keine schuldenfreie Lage", () => {
  const result = buildFundamentalHistory(
    [{ fiscalDateEnding: "2025-09-30", totalRevenue: "1000" }],
    [{ fiscalDateEnding: "2025-09-30", totalAssets: "4000" }],
    [{ fiscalDateEnding: "2025-09-30" }],
    [{ date: "2025-09-25", close: 20 }],
  );

  assert.equal(result[0].debt, null);
});
