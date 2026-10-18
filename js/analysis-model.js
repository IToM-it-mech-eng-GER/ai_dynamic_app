export const ANALYSIS_STORAGE_KEY = "renditeatlas-analysis-v1";

const ANALYSIS_COLORS = ["#3d50c5", "#167d78", "#ca4f70", "#ff6b16", "#7b5cc7", "#2a9d55"];
const WKN_PATTERN = /^[A-HJ-NP-Z0-9]{6}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function finiteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanText(value, maxLength = 120) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function isValidDate(value) {
  if (!DATE_PATTERN.test(String(value ?? ""))) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function normalizeWkn(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return WKN_PATTERN.test(normalized) ? normalized : "";
}

function normalizePrices(prices) {
  if (!Array.isArray(prices)) return [];

  const byDate = new Map();
  prices.forEach((entry) => {
    const date = cleanText(entry?.date, 10);
    const close = finiteNumber(entry?.close);
    if (isValidDate(date) && close > 0) byDate.set(date, { date, close });
  });

  return [...byDate.values()].sort((first, second) => first.date.localeCompare(second.date));
}

function normalizeFundamentals(reports) {
  if (!Array.isArray(reports)) return [];

  const fields = [
    "revenue",
    "operatingIncome",
    "freeCashFlow",
    "ebitdaMargin",
    "totalAssets",
    "priceToSales",
    "cash",
    "debt",
  ];
  const byYear = new Map();

  reports.forEach((entry) => {
    const year = Math.trunc(finiteNumber(entry?.year, 0));
    if (year < 1900 || year > 2200) return;
    const normalized = { year };
    fields.forEach((field) => {
      normalized[field] = finiteNumber(entry?.[field]);
    });
    byYear.set(year, normalized);
  });

  return [...byYear.values()].sort((first, second) => first.year - second.year);
}

export function createAnalysisSecurity(input = {}) {
  const purchasePrice = finiteNumber(input.purchasePrice, 0);
  const purchaseDate = isValidDate(input.purchaseDate) ? input.purchaseDate : "";
  const instrument = input.instrument ?? {};

  return {
    id: cleanText(input.id, 80),
    wkn: normalizeWkn(input.wkn),
    purchaseDate,
    purchasePrice: purchasePrice > 0 ? purchasePrice : 0,
    active: input.active !== false,
    color: cleanText(input.color, 16),
    fetchedAt: cleanText(input.fetchedAt, 32),
    instrument: {
      name: cleanText(instrument.name),
      symbol: cleanText(instrument.symbol, 32),
      type: cleanText(instrument.type, 64),
      currency: cleanText(instrument.currency, 12),
      exchange: cleanText(instrument.exchange, 64),
    },
    prices: normalizePrices(input.prices),
    fundamentals: normalizeFundamentals(input.fundamentals),
  };
}

export function serializeAnalysisState(state) {
  const securities = Array.isArray(state?.securities)
    ? state.securities.map((security) => createAnalysisSecurity(security))
    : [];
  return JSON.stringify({ securities });
}

export function readAnalysisState(serialized) {
  try {
    const parsed = JSON.parse(serialized || "{}");
    return {
      securities: Array.isArray(parsed?.securities)
        ? parsed.securities
            .map((security) => createAnalysisSecurity(security))
            .filter((security) => security.id && security.wkn)
        : [],
    };
  } catch {
    return { securities: [] };
  }
}

export function setSecurityActive(securities, id, active) {
  return securities.map((security) =>
    security.id === id ? { ...security, active: Boolean(active) } : security,
  );
}

export function getAnalysisColor(index) {
  return ANALYSIS_COLORS[index % ANALYSIS_COLORS.length];
}

export function getAnalysisColorIndex(color) {
  const index = ANALYSIS_COLORS.indexOf(color);
  return index >= 0 ? index : 0;
}

export function getFiveYearFundamentals(reports) {
  return normalizeFundamentals(reports).slice(-5);
}

function nearestReferencePrice(prices, purchaseDate) {
  return prices.reduce((nearest, entry) => {
    if (!nearest) return entry;
    const currentDistance = Math.abs(Date.parse(entry.date) - Date.parse(purchaseDate));
    const nearestDistance = Math.abs(Date.parse(nearest.date) - Date.parse(purchaseDate));
    return currentDistance < nearestDistance ? entry : nearest;
  }, null);
}

function buildAdjustedSeries(security) {
  const prices = normalizePrices(security.prices);
  const reference = nearestReferencePrice(prices, security.purchaseDate);
  if (!reference || security.purchasePrice <= 0 || !security.purchaseDate) return [];

  const factor = security.purchasePrice / reference.close;
  const laterPrices = prices
    .filter((entry) => entry.date > security.purchaseDate)
    .map((entry) => ({ date: entry.date, value: entry.close * factor }));

  return [{ date: security.purchaseDate, value: security.purchasePrice }, ...laterPrices];
}

function valueAtDate(series, date) {
  if (!series.length || date < series[0].date || date > series.at(-1).date) return null;

  let value = null;
  for (const point of series) {
    if (point.date > date) break;
    value = point.value;
  }
  return value;
}

export function buildStackedSeries(securities) {
  const active = securities
    .filter((security) => security.active !== false)
    .map((security, index) => ({
      security,
      color: security.color || getAnalysisColor(index),
      series: buildAdjustedSeries(security),
    }))
    .filter((entry) => entry.series.length > 0);

  const dates = [...new Set(active.flatMap((entry) => entry.series.map((point) => point.date)))].sort();
  const cumulative = dates.map(() => 0);
  const available = dates.map(() => false);

  const layers = active.map((entry) => {
    const points = dates.map((date, index) => {
      const value = valueAtDate(entry.series, date);
      if (value === null) return { date, value: null, base: null, top: null };
      const base = cumulative[index];
      cumulative[index] += value;
      available[index] = true;
      return { date, value, base, top: cumulative[index] };
    });

    return {
      id: entry.security.id,
      name: entry.security.instrument.name || entry.security.wkn,
      color: entry.color,
      points,
    };
  });

  const totals = dates.map((date, index) => ({
    date,
    value: available[index] ? cumulative[index] : null,
  }));

  return { dates, layers, totals };
}
