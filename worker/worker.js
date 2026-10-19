const OPENFIGI_URL = "https://api.openfigi.com/v3/mapping";
const ALPHA_VANTAGE_URL = "https://www.alphavantage.co/query";
const CACHE_SECONDS = 86400;
const WKN_PATTERN = /^[A-HJ-NP-Z0-9]{6}$/;

function safeText(value, maxLength = 160) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function alphaProviderError(payload = {}) {
  const message = safeText(payload.Note || payload.Information, 500);
  const normalized = message.toLowerCase();
  if (!normalized) return "";
  if (/(invalid|missing|not valid).*(api\s*key|apikey)|(api\s*key|apikey).*(invalid|missing|not valid)/.test(normalized)) {
    return "Der Alpha-Vantage-Schlüssel ist ungültig oder fehlt.";
  }
  if (/rate limit|call frequency|requests per day|calls per day|higher api call volume/.test(normalized)) {
    return "Das tägliche Abruflimit des Marktdatenanbieters ist erreicht.";
  }
  if (/premium endpoint|premium api|premium membership/.test(normalized)) {
    return "Diese Marktdaten benötigen einen kostenpflichtigen Zugang.";
  }
  return "Der Marktdatenanbieter hat die Anfrage abgelehnt.";
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "" || value === "None" || value === "-") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function yearFromReport(report) {
  const date = safeText(report?.fiscalDateEnding, 10);
  const year = Number(date.slice(0, 4));
  return Number.isInteger(year) && year >= 1900 && year <= 2200 ? year : null;
}

export function validateWkn(value) {
  const normalized = safeText(value, 12).toUpperCase();
  return WKN_PATTERN.test(normalized) ? normalized : "";
}

function selectFigiInstrument(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const scored = entries.map((entry) => {
    const type = `${entry.securityType ?? ""} ${entry.securityType2 ?? ""}`.toUpperCase();
    let score = 0;
    if (entry.ticker) score += 4;
    if (entry.name) score += 3;
    if (/COMMON|EQUITY|ETF|ETP|FUND/.test(type)) score += 3;
    if (/WARRANT|OPTION|FUTURE/.test(type)) score -= 8;
    return { entry, score };
  });
  scored.sort((first, second) => second.score - first.score);
  return scored[0].entry;
}

function normalizeAlphaMatch(match) {
  return {
    symbol: safeText(match?.["1. symbol"], 40),
    name: safeText(match?.["2. name"]),
    type: safeText(match?.["3. type"], 60),
    region: safeText(match?.["4. region"], 60),
    currency: safeText(match?.["8. currency"], 12),
    score: numberOrNull(match?.["9. matchScore"]) ?? 0,
  };
}

export function directAlphaInstrument(figi = {}) {
  const ticker = safeText(figi.ticker, 40).toUpperCase();
  if (safeText(figi.exchCode, 12).toUpperCase() !== "US" || !ticker) return null;
  return {
    symbol: ticker,
    name: safeText(figi.name),
    type: safeText(figi.securityType2 || figi.securityType, 60),
    region: "United States",
    currency: "USD",
    score: 1,
  };
}

export function selectAlphaMatch(matches, figi = {}) {
  if (!Array.isArray(matches) || matches.length === 0) return null;
  const ticker = safeText(figi.ticker, 40).toUpperCase();
  const name = safeText(figi.name).toLocaleLowerCase("en");
  const scored = matches.map((match) => {
    const normalized = normalizeAlphaMatch(match);
    const symbolRoot = normalized.symbol.split(".")[0].toUpperCase();
    let score = normalized.score * 10;
    if (ticker && normalized.symbol.toUpperCase() === ticker) score += 20;
    else if (ticker && symbolRoot === ticker) score += 12;
    if (name && normalized.name.toLocaleLowerCase("en") === name) score += 5;
    return { normalized, score };
  });
  scored.sort((first, second) => second.score - first.score);
  return scored[0].normalized.symbol ? scored[0].normalized : null;
}

export function parseWeeklyPrices(payload) {
  const series = payload?.["Weekly Adjusted Time Series"] ?? payload?.["Weekly Time Series"];
  if (!series || typeof series !== "object") return [];

  return Object.entries(series)
    .map(([date, values]) => ({
      date,
      close: numberOrNull(values?.["5. adjusted close"] ?? values?.["4. close"]),
    }))
    .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && entry.close > 0)
    .sort((first, second) => first.date.localeCompare(second.date));
}

function reportMap(reports) {
  const result = new Map();
  if (!Array.isArray(reports)) return result;
  reports.forEach((report) => {
    const year = yearFromReport(report);
    if (year) result.set(year, report);
  });
  return result;
}

function closestPriceOnOrBefore(prices, fiscalDate) {
  let closest = null;
  for (const price of prices) {
    if (price.date > fiscalDate) break;
    closest = price;
  }
  return closest;
}

function totalDebt(balance) {
  const direct = numberOrNull(balance?.shortLongTermDebtTotal);
  if (direct !== null) return direct;
  const current = numberOrNull(balance?.currentDebt) ?? numberOrNull(balance?.shortTermDebt);
  const longTerm = numberOrNull(balance?.longTermDebt) ?? numberOrNull(balance?.longTermDebtNoncurrent);
  if (current === null && longTerm === null) return null;
  return (current ?? 0) + (longTerm ?? 0);
}

export function buildFundamentalHistory(incomeReports, balanceReports, cashFlowReports, prices) {
  const incomes = reportMap(incomeReports);
  const balances = reportMap(balanceReports);
  const cashFlows = reportMap(cashFlowReports);
  const years = [...new Set([...incomes.keys(), ...balances.keys(), ...cashFlows.keys()])].sort((a, b) => a - b).slice(-5);

  return years.map((year) => {
    const income = incomes.get(year) ?? {};
    const balance = balances.get(year) ?? {};
    const cashFlow = cashFlows.get(year) ?? {};
    const revenue = numberOrNull(income.totalRevenue);
    const ebitda = numberOrNull(income.ebitda);
    const operatingCashflow = numberOrNull(cashFlow.operatingCashflow);
    const capitalExpenditures = numberOrNull(cashFlow.capitalExpenditures);
    const shares = numberOrNull(balance.commonStockSharesOutstanding);
    const fiscalDate = safeText(income.fiscalDateEnding || balance.fiscalDateEnding || cashFlow.fiscalDateEnding, 10);
    const price = closestPriceOnOrBefore(prices, fiscalDate)?.close ?? null;

    return {
      year,
      revenue,
      operatingIncome: numberOrNull(income.operatingIncome),
      freeCashFlow: operatingCashflow !== null && capitalExpenditures !== null
        ? operatingCashflow - Math.abs(capitalExpenditures)
        : null,
      ebitdaMargin: revenue && ebitda !== null ? ebitda / revenue * 100 : null,
      totalAssets: numberOrNull(balance.totalAssets),
      priceToSales: revenue && shares && price ? price * shares / revenue : null,
      cash: numberOrNull(balance.cashAndCashEquivalentsAtCarryingValue)
        ?? numberOrNull(balance.cashAndShortTermInvestments),
      debt: totalDebt(balance),
    };
  });
}

function isFundLike(figi, alpha) {
  const type = `${figi?.securityType ?? ""} ${figi?.securityType2 ?? ""} ${alpha?.type ?? ""}`.toUpperCase();
  return /ETF|ETP|FUND/.test(type);
}

async function fetchJson(url, options, serviceName) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${serviceName} ist vorübergehend nicht erreichbar.`);
  return response.json();
}

async function mapWkn(wkn, env) {
  const headers = { "Content-Type": "application/json" };
  if (env.OPENFIGI_API_KEY) headers["X-OPENFIGI-APIKEY"] = env.OPENFIGI_API_KEY;
  const payload = await fetchJson(
    OPENFIGI_URL,
    {
      method: "POST",
      headers,
      body: JSON.stringify([{ idType: "ID_WERTPAPIER", idValue: wkn }]),
    },
    "Die WKN-Suche",
  );
  const result = payload?.[0];
  const instrument = selectFigiInstrument(result?.data);
  if (!instrument) throw new Error("Für diese WKN wurde kein Wertpapier gefunden.");
  return instrument;
}

function alphaCacheKey(functionName, parameters) {
  const url = new URL("https://analysis-cache.invalid/provider/alpha");
  url.searchParams.set("function", functionName);
  Object.entries(parameters)
    .sort(([first], [second]) => first.localeCompare(second))
    .forEach(([key, value]) => url.searchParams.set(key, value));
  return new Request(url);
}

export async function alphaRequest(functionName, parameters, apiKey, cache) {
  const cacheKey = alphaCacheKey(functionName, parameters);
  const cached = cache ? await cache.match(cacheKey) : null;
  if (cached) return cached.json();

  const url = new URL(ALPHA_VANTAGE_URL);
  url.searchParams.set("function", functionName);
  Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set("apikey", apiKey);
  const payload = await fetchJson(url, { headers: { Accept: "application/json" } }, "Der Marktdatenanbieter");
  const providerError = alphaProviderError(payload);
  if (providerError) {
    console.warn("Alpha Vantage rejected request", {
      functionName,
      message: safeText(payload.Note || payload.Information, 500),
    });
    throw new Error(providerError);
  }
  if (payload["Error Message"]) throw new Error("Der Marktdatenanbieter kennt dieses Wertpapier nicht.");
  if (cache) {
    try {
      await cache.put(cacheKey, new Response(JSON.stringify(payload), {
        headers: {
          "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
          "Content-Type": "application/json; charset=utf-8",
        },
      }));
    } catch {
      console.warn("Alpha Vantage response could not be cached", { functionName });
    }
  }
  return payload;
}

async function resolveAlphaInstrument(figi, apiKey, cache) {
  const keywords = safeText(figi.ticker || figi.name, 120);
  const search = await alphaRequest("SYMBOL_SEARCH", { keywords }, apiKey, cache);
  const match = selectAlphaMatch(search.bestMatches, figi);
  if (!match) throw new Error("Für dieses Wertpapier wurde kein kompatibler Kursdatenbestand gefunden.");
  return match;
}

async function loadAsset(wkn, env, cache) {
  if (!env.ALPHA_VANTAGE_API_KEY) throw new Error("Der Marktdatenzugang ist nicht konfiguriert.");
  const figi = await mapWkn(wkn, env);
  const alpha = directAlphaInstrument(figi)
    ?? await resolveAlphaInstrument(figi, env.ALPHA_VANTAGE_API_KEY, cache);
  const weekly = await alphaRequest("TIME_SERIES_WEEKLY_ADJUSTED", { symbol: alpha.symbol }, env.ALPHA_VANTAGE_API_KEY, cache);
  const prices = parseWeeklyPrices(weekly);
  if (!prices.length) throw new Error("Für dieses Wertpapier sind keine historischen Kurse verfügbar.");

  let fundamentals = [];
  if (!isFundLike(figi, alpha)) {
    const [income, balance, cashFlow] = await Promise.all([
      alphaRequest("INCOME_STATEMENT", { symbol: alpha.symbol }, env.ALPHA_VANTAGE_API_KEY, cache),
      alphaRequest("BALANCE_SHEET", { symbol: alpha.symbol }, env.ALPHA_VANTAGE_API_KEY, cache),
      alphaRequest("CASH_FLOW", { symbol: alpha.symbol }, env.ALPHA_VANTAGE_API_KEY, cache),
    ]);
    fundamentals = buildFundamentalHistory(
      income.annualReports,
      balance.annualReports,
      cashFlow.annualReports,
      prices,
    );
  }

  return {
    wkn,
    fetchedAt: new Date().toISOString(),
    instrument: {
      name: alpha.name || safeText(figi.name),
      symbol: alpha.symbol,
      type: alpha.type || safeText(figi.securityType2 || figi.securityType),
      currency: alpha.currency,
      exchange: alpha.region,
    },
    prices,
    fundamentals,
  };
}

function allowedOrigin(request, env) {
  const requestOrigin = request.headers.get("Origin") || "";
  const origins = safeText(env.ALLOWED_ORIGINS, 500)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.includes(requestOrigin) ? requestOrigin : "";
}

function responseHeaders(origin, cacheControl = "no-store") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept",
    "Cache-Control": cacheControl,
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
}

function jsonResponse(payload, status, origin, cacheControl) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: responseHeaders(origin, cacheControl),
  });
}

async function handleRequest(request, env, context) {
  const origin = allowedOrigin(request, env);
  if (!origin) return jsonResponse({ error: "Zugriff nicht erlaubt." }, 403, "null");

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(origin) });
  if (request.method !== "GET") return jsonResponse({ error: "Methode nicht erlaubt." }, 405, origin);

  const url = new URL(request.url);
  if (url.pathname !== "/asset") return jsonResponse({ error: "Nicht gefunden." }, 404, origin);
  const wkn = validateWkn(url.searchParams.get("wkn"));
  if (!wkn) return jsonResponse({ error: "Ungültige WKN." }, 400, origin);

  const cache = caches.default;
  const cacheKey = new Request(`https://analysis-cache.invalid/asset?wkn=${encodeURIComponent(wkn)}`);
  const cached = await cache.match(cacheKey);
  if (cached) {
    const data = await cached.json();
    return jsonResponse(data, 200, origin, `public, max-age=${CACHE_SECONDS}`);
  }

  try {
    const data = await loadAsset(wkn, env, cache);
    const cacheResponse = new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}`, "Content-Type": "application/json" },
    });
    context.waitUntil(cache.put(cacheKey, cacheResponse));
    return jsonResponse(data, 200, origin, `public, max-age=${CACHE_SECONDS}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Die Wertpapierdaten konnten nicht geladen werden.";
    return jsonResponse({ error: message }, 502, origin);
  }
}

export default {
  fetch(request, env, context) {
    return handleRequest(request, env, context);
  },
};
