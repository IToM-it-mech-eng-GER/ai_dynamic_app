import { normalizeScenario } from "./scenario.js";

const PRODUCT_LIMITS = Object.freeze({
  initialCapital: [0, 10_000_000],
  monthlyContribution: [0, 100_000],
  annualReturn: [-50, 50],
  annualFee: [0, 10],
  annualCustodyFee: [0, 10_000],
  transactionFee: [0, 10],
});

const PRODUCT_DEFAULTS = Object.freeze({
  name: "ETF-Sparplan",
  initialCapital: 5_000,
  monthlyContribution: 300,
  annualReturn: 6,
  annualFee: 0.2,
  annualCustodyFee: 0,
  transactionFee: 0,
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
    annualCustodyFee: normalizeProductNumber(product.annualCustodyFee, "annualCustodyFee"),
    transactionFee: normalizeProductNumber(product.transactionFee, "transactionFee"),
  };
}

export function calculatePlan(product, horizonOrScenario) {
  const normalizedProduct = normalizeProduct(product);
  const context = createCalculationContext(horizonOrScenario);
  const years = context.retirementAge - context.currentAge;
  const savingMonths = years * 12;
  const rebalancingCost = context.rebalancingEnabled ? context.rebalancingReduction : 0;
  const netAnnualReturn = clamp(
    normalizedProduct.annualReturn - normalizedProduct.annualFee - rebalancingCost,
    -99,
    50,
  );
  const monthlyRate = (1 + netAnnualReturn / 100) ** (1 / 12) - 1;
  const grossMonthlyRate = (1 + normalizedProduct.annualReturn / 100) ** (1 / 12) - 1;
  const series = [
    {
      year: 0,
      age: context.currentAge,
      balance: normalizedProduct.initialCapital,
      contributed: normalizedProduct.initialCapital,
      phase: "saving",
    },
  ];

  let balance = normalizedProduct.initialCapital;
  let grossBalance = normalizedProduct.initialCapital;
  let contributed = normalizedProduct.initialCapital;
  let totalWithdrawals = 0;
  let fundSwitchLoss = 0;

  for (let month = 1; month <= savingMonths; month += 1) {
    const netContribution = normalizedProduct.monthlyContribution
      * (1 - normalizedProduct.transactionFee / 100);
    balance = Math.max(
      0,
      balance * (1 + monthlyRate)
        + netContribution
        - normalizedProduct.annualCustodyFee / 12,
    );
    grossBalance = Math.max(
      0,
      grossBalance * (1 + grossMonthlyRate) + normalizedProduct.monthlyContribution,
    );
    contributed += normalizedProduct.monthlyContribution;

    const age = context.currentAge + month / 12;
    if (
      context.fundSwitchEnabled
      && Math.abs(age - context.fundSwitchAge) < 0.001
      && context.fundSwitchPercentage > 0
    ) {
      const switchAmount = balance * context.fundSwitchPercentage / 100;
      fundSwitchLoss = switchAmount * normalizedProduct.transactionFee / 100;
      balance = Math.max(0, balance - fundSwitchLoss);
    }

    if (month % 12 === 0) {
      series.push({
        year: month / 12,
        age: context.currentAge + month / 12,
        balance,
        contributed,
        phase: month === savingMonths ? "retirement" : "saving",
      });
    }
  }

  const retirementBalance = balance;
  const retirementGrossBalance = grossBalance;

  if (context.withdrawalEnabled) {
    const withdrawalMonths = (context.lifeExpectancy - context.retirementAge) * 12;
    const retirementNetReturn = clamp(
      context.postRetirementReturn - normalizedProduct.annualFee,
      -99,
      50,
    );
    const retirementMonthlyRate = (1 + retirementNetReturn / 100) ** (1 / 12) - 1;
    const retirementGrossRate = (1 + context.postRetirementReturn / 100) ** (1 / 12) - 1;

    for (let month = 1; month <= withdrawalMonths; month += 1) {
      balance = Math.max(
        0,
        balance * (1 + retirementMonthlyRate) - normalizedProduct.annualCustodyFee / 12,
      );
      grossBalance = Math.max(0, grossBalance * (1 + retirementGrossRate));

      const desiredWithdrawal = getWithdrawalForMonth(context, retirementBalance, month);
      const actualWithdrawal = Math.min(balance, desiredWithdrawal);
      balance -= actualWithdrawal;
      grossBalance = Math.max(0, grossBalance - Math.min(grossBalance, desiredWithdrawal));
      totalWithdrawals += actualWithdrawal;

      if (month % 12 === 0) {
        series.push({
          year: years + month / 12,
          age: context.retirementAge + month / 12,
          balance,
          contributed,
          phase: "withdrawal",
        });
      }
    }
  }

  const totalCosts = Math.max(0, grossBalance - balance);
  const taxableGain = Math.max(0, balance + totalWithdrawals - contributed);
  const estimatedTaxes = calculateEstimatedTaxes(taxableGain, context);

  return {
    product: normalizedProduct,
    years,
    endAge: context.withdrawalEnabled ? context.lifeExpectancy : context.retirementAge,
    netAnnualReturn,
    rebalancingCost,
    endingBalance: balance,
    netEndingBalance: Math.max(0, balance - estimatedTaxes),
    grossEndingBalance: grossBalance,
    retirementBalance,
    retirementGrossBalance,
    totalContributions: contributed,
    totalGain: balance + totalWithdrawals - contributed,
    totalWithdrawals,
    totalCosts,
    fundSwitchLoss,
    estimatedTaxes,
    series,
  };
}

function createCalculationContext(horizonOrScenario) {
  if (typeof horizonOrScenario !== "object" || horizonOrScenario === null) {
    const years = normalizeHorizon(horizonOrScenario);
    return {
      ...normalizeScenario(),
      currentAge: 0,
      retirementAge: years,
      lifeExpectancy: years,
      withdrawalEnabled: false,
      rebalancingEnabled: false,
      fundSwitchEnabled: false,
      taxDisabled: true,
    };
  }
  return normalizeScenario(horizonOrScenario);
}

function getWithdrawalForMonth(context, retirementBalance, month) {
  const isDue = context.withdrawalFrequency === "monthly" || month % 12 === 0;
  if (!isDue) return 0;
  const inflationYears = context.inflationEnabled ? Math.floor((month - 1) / 12) : 0;
  const inflationFactor = (1 + context.inflationRate / 100) ** inflationYears;
  const baseAmount = context.withdrawalType === "percent"
    ? retirementBalance * context.withdrawalAmount / 100
    : context.withdrawalAmount;
  const periodicAmount = context.withdrawalFrequency === "monthly" && context.withdrawalType === "percent"
    ? baseAmount / 12
    : baseAmount;
  return periodicAmount * inflationFactor;
}

function calculateEstimatedTaxes(taxableGain, context) {
  if (context.taxDisabled || taxableGain <= context.saverAllowance) return 0;
  const baseRate = context.personalTaxEnabled ? context.marginalTaxRate / 100 : 0.25;
  const solidarityRate = context.solidarityEnabled ? baseRate * 0.055 : 0;
  const socialRate = context.socialContributionsEnabled ? 0.03 : 0;
  return (taxableGain - context.saverAllowance) * Math.min(0.65, baseRate + solidarityRate + socialRate);
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
