import assert from "node:assert/strict";
import test from "node:test";

import {
  alphaRequest,
  alphaProviderError,
  buildFundamentalHistory,
  directAlphaInstrument,
  loadAsset,
  parseWeeklyPrices,
  selectAlphaMatch,
  validateWkn,
} from "../worker/worker.js";

test("liefert jeden erfolgreichen Teilabruf auch bei späterem Anbieterlimit zurück", async () => {
  const originalFetch = globalThis.fetch;
  const providerRequests = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "api.openfigi.com") {
      return new Response(JSON.stringify([{ data: [{
        ticker: "PLTR",
        name: "Palantir Technologies",
        exchCode: "US",
        securityType2: "Common Stock",
      }] }]), { status: 200 });
    }

    const functionName = url.searchParams.get("function");
    providerRequests.push(functionName);
    const payloads = {
      TIME_SERIES_WEEKLY_ADJUSTED: {
        "Weekly Adjusted Time Series": { "2025-01-03": { "5. adjusted close": "75.50" } },
      },
      INCOME_STATEMENT: {
        annualReports: [{ fiscalDateEnding: "2025-09-30", totalRevenue: "1000", operatingIncome: "180", ebitda: "250" }],
      },
      BALANCE_SHEET: { Note: "Our standard API rate limit is 25 requests per day." },
      CASH_FLOW: {
        annualReports: [{ fiscalDateEnding: "2025-09-30", operatingCashflow: "300", capitalExpenditures: "-80" }],
      },
    };
    return new Response(JSON.stringify(payloads[functionName]), { status: 200 });
  };

  try {
    const result = await loadAsset("A2QA4J", { ALPHA_VANTAGE_API_KEY: "test-key" }, null);
    assert.deepEqual(result.prices, [{ date: "2025-01-03", close: 75.5 }]);
    assert.equal(result.fundamentals[0].revenue, 1000);
    assert.equal(result.fundamentals[0].freeCashFlow, 220);
    assert.equal(result.fundamentals[0].totalAssets, null);
    assert.equal(result.partial, true);
    assert.match(result.warnings.join(" "), /Bilanzdaten/);
    assert.deepEqual(providerRequests, [
      "TIME_SERIES_WEEKLY_ADJUSTED",
      "INCOME_STATEMENT",
      "BALANCE_SHEET",
      "CASH_FLOW",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("nutzt manuelle Stammdaten und fragt nur ausgewählte Datenbereiche ab", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    if (url.hostname === "api.openfigi.com") {
      throw new Error("Die WKN-Suche darf bei manuellen Stammdaten nicht aufgerufen werden.");
    }
    return new Response(JSON.stringify({
      annualReports: [{ fiscalDateEnding: "2025-09-30", operatingCashflow: "300", capitalExpenditures: "-80" }],
    }), { status: 200 });
  };

  try {
    const result = await loadAsset("A2QA4J", { ALPHA_VANTAGE_API_KEY: "test-key" }, null, {
      instrument: {
        name: "Palantir Technologies",
        symbol: "PLTR",
        type: "Common Stock",
        currency: "USD",
        exchange: "NASDAQ",
      },
      sections: ["cashflow"],
    });

    assert.equal(result.instrument.name, "Palantir Technologies");
    assert.equal(result.fundamentals[0].freeCashFlow, 220);
    assert.deepEqual(requests.map((url) => url.searchParams.get("function")), ["CASH_FLOW"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("nutzt eine eindeutige US-Börsenkennung ohne zusätzliche Anbietersuche", () => {
  assert.deepEqual(directAlphaInstrument({
    ticker: "PLTR",
    name: "PALANTIR TECHNOLOGIES INC-A",
    exchCode: "US",
    securityType2: "Common Stock",
  }), {
    symbol: "PLTR",
    name: "PALANTIR TECHNOLOGIES INC-A",
    type: "Common Stock",
    region: "United States",
    currency: "USD",
    score: 1,
  });
});

test("verwendet erfolgreich geladene Anbieterdaten bei einem erneuten Abruf wieder", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const storedResponses = new Map();
  const cache = {
    async match(request) {
      const response = storedResponses.get(request.url);
      return response?.clone();
    },
    async put(request, response) {
      storedResponses.set(request.url, response.clone());
    },
  };
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return new Response(JSON.stringify({ "Weekly Time Series": {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await alphaRequest("TIME_SERIES_WEEKLY", { symbol: "PLTR" }, "geheimer-schluessel", cache);
    await alphaRequest("TIME_SERIES_WEEKLY", { symbol: "PLTR" }, "geheimer-schluessel", cache);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requests.length, 1);
  assert.equal(storedResponses.size, 1);
  assert.doesNotMatch([...storedResponses.keys()][0], /geheimer-schluessel/);
});

test("ruft den Anbieter auch bei einem nicht lesbaren Zwischenspeicher ab", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  let requestCount = 0;
  console.warn = () => {};
  globalThis.fetch = async () => {
    requestCount += 1;
    return new Response(JSON.stringify({ "Weekly Time Series": {} }), { status: 200 });
  };

  try {
    await alphaRequest("TIME_SERIES_WEEKLY", { symbol: "PLTR" }, "geheimer-schluessel", {
      async match() {
        throw new Error("Zwischenspeicher nicht erreichbar");
      },
      async put() {},
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }

  assert.equal(requestCount, 1);
});

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
