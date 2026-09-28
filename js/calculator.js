const PRODUCT_LIMITS = Object.freeze({
  initialCapital: [0, 10_000_000],
  monthlyContribution: [0, 100_000],
  annualReturn: [-50, 50],
  annualFee: [0, 10],
});

const PRODUCT_DEFAULTS = Object.freeze({
  name: "ETF-Sparplan",
  initialCapital: 5_000,
  monthlyContribution: 300,
  annualReturn: 6,
  annualFee: 0.2,
});

export function normalizeHorizon(value) {
  const number = toFiniteNumber(value, 30);
  return Math.round(clamp(number, 1, 50));
}

export function normalizeProduct(product = {}) {
  return {
    name: normalizeName(product.name),
    initialCapital: normalizeProductNumber(
      product.initialCapital,
      "initialCapital",
    ),
    monthlyContribution: normalizeProductNumber(
      product.monthlyContribution,
      "monthlyContribution",
    ),
    annualReturn: normalizeProductNumber(product.annualReturn, "annualReturn"),
    annualFee: normalizeProductNumber(product.annualFee, "annualFee"),
  };
}

export function calculatePlan(product, horizon) {
  const normalizedProduct = normalizeProduct(product);
  const years = normalizeHorizon(horizon);
  const months = years * 12;
  const netAnnualReturn = clamp(
    normalizedProduct.annualReturn - normalizedProduct.annualFee,
    -99,
    50,
  );
  const monthlyRate = (1 + netAnnualReturn / 100) ** (1 / 12) - 1;
  const series = [
    {
      year: 0,
      balance: normalizedProduct.initialCapital,
      contributed: normalizedProduct.initialCapital,
    },
  ];

  let balance = normalizedProduct.initialCapital;
  let contributed = normalizedProduct.initialCapital;

  for (let month = 1; month <= months; month += 1) {
    balance = balance * (1 + monthlyRate) + normalizedProduct.monthlyContribution;
    contributed += normalizedProduct.monthlyContribution;

    if (month % 12 === 0) {
      series.push({
        year: month / 12,
        balance,
        contributed,
      });
    }
  }

  return {
    product: normalizedProduct,
    years,
    netAnnualReturn,
    endingBalance: balance,
    totalContributions: contributed,
    totalGain: balance - contributed,
    series,
  };
}

function normalizeName(value) {
  const name = String(value ?? "").trim().slice(0, 48);
  return name || PRODUCT_DEFAULTS.name;
}

function normalizeProductNumber(value, key) {
  const [minimum, maximum] = PRODUCT_LIMITS[key];
  const fallback = PRODUCT_DEFAULTS[key];
  return clamp(toFiniteNumber(value, fallback), minimum, maximum);
}

function toFiniteNumber(value, fallback) {
  const number = Number(
    typeof value === "string" ? value.trim().replace(",", ".") : value,
  );
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
