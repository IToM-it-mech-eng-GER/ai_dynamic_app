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

export const TAX_RULE_YEAR = 2026;
const PENSION_EXPENSE_ALLOWANCE = 102;
const CAPITAL_TAX_RATE = 0.25;
const SOLIDARITY_RATE = 0.055;
const OPTIONAL_SOCIAL_RATE = 0.03;

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
    scenario: normalizeScenario(product.scenario),
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
  let grossWithdrawals = 0;
  let withdrawalTaxes = 0;
  let realizedGains = 0;
  let fundSwitchLoss = 0;
  const privateLots = context.depotType === "private"
    ? createInitialLots(normalizedProduct.initialCapital)
    : [];

  for (let month = 1; month <= savingMonths; month += 1) {
    const netContribution = normalizedProduct.monthlyContribution
      * (1 - normalizedProduct.transactionFee / 100);
    balance = Math.max(
      0,
      balance * (1 + monthlyRate)
        + netContribution
        - normalizedProduct.annualCustodyFee / 12,
    );
    if (context.depotType === "private") {
      growLots(privateLots, monthlyRate);
      addLot(privateLots, netContribution, normalizedProduct.monthlyContribution);
      reconcileLotValues(privateLots, balance);
    }
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
      if (context.depotType === "private") reconcileLotValues(privateLots, balance);
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
  let annualTaxState = createAnnualTaxState();

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
      if (context.depotType === "private") {
        growLots(privateLots, retirementMonthlyRate);
        reconcileLotValues(privateLots, balance);
      }
      grossBalance = Math.max(0, grossBalance * (1 + retirementGrossRate));

      const desiredWithdrawal = getWithdrawalForMonth(context, retirementBalance, month);
      let actualWithdrawal = Math.min(balance, desiredWithdrawal);
      let grossWithdrawal = actualWithdrawal;
      let taxForWithdrawal = 0;
      let gainForWithdrawal = 0;

      if (context.depotType === "private" && desiredWithdrawal > 0) {
        const taxYear = TAX_RULE_YEAR + years + Math.floor((month - 1) / 12);
        if (annualTaxState.year !== taxYear) annualTaxState = createAnnualTaxState(taxYear);
        const withdrawal = calculatePrivateNetWithdrawal(
          privateLots,
          desiredWithdrawal,
          context,
          annualTaxState,
        );
        actualWithdrawal = withdrawal.netWithdrawal;
        grossWithdrawal = withdrawal.grossWithdrawal;
        taxForWithdrawal = withdrawal.tax;
        gainForWithdrawal = withdrawal.realizedGain;
        annualTaxState = withdrawal.taxState;
      }

      balance = Math.max(0, balance - grossWithdrawal);
      grossBalance = Math.max(0, grossBalance - Math.min(grossBalance, grossWithdrawal));
      totalWithdrawals += actualWithdrawal;
      grossWithdrawals += grossWithdrawal;
      withdrawalTaxes += taxForWithdrawal;
      realizedGains += gainForWithdrawal;

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
  const totalGain = balance + grossWithdrawals - contributed;
  const taxableGain = Math.max(0, totalGain);
  const estimatedTaxes = context.depotType === "private"
    ? withdrawalTaxes
    : calculateEstimatedTaxes(taxableGain, context);

  return {
    product: normalizedProduct,
    years,
    endAge: context.withdrawalEnabled ? context.lifeExpectancy : context.retirementAge,
    netAnnualReturn,
    rebalancingCost,
    endingBalance: balance,
    netEndingBalance: context.depotType === "private"
      ? balance
      : Math.max(0, balance - estimatedTaxes),
    grossEndingBalance: grossBalance,
    retirementBalance,
    retirementGrossBalance,
    totalContributions: contributed,
    totalGain,
    totalWithdrawals,
    grossWithdrawals,
    withdrawalTaxes,
    realizedGains,
    totalCosts,
    fundSwitchLoss,
    estimatedTaxes,
    series,
  };
}

export function calculateFifoSale(lots, requestedAmount) {
  const remainingLots = lots
    .map((lot) => ({
      marketValue: Math.max(0, Number(lot.marketValue) || 0),
      costBasis: Math.max(0, Number(lot.costBasis) || 0),
    }))
    .filter((lot) => lot.marketValue > 0.0000001);
  let amountLeft = Math.max(0, Number(requestedAmount) || 0);
  let proceeds = 0;
  let realizedGain = 0;

  while (amountLeft > 0.0000001 && remainingLots.length > 0) {
    const lot = remainingLots[0];
    const soldValue = Math.min(amountLeft, lot.marketValue);
    const soldRatio = soldValue / lot.marketValue;
    const soldCostBasis = lot.costBasis * soldRatio;
    proceeds += soldValue;
    realizedGain += soldValue - soldCostBasis;
    amountLeft -= soldValue;
    lot.marketValue -= soldValue;
    lot.costBasis -= soldCostBasis;
    if (lot.marketValue <= 0.0000001) remainingLots.shift();
  }

  return {
    proceeds,
    realizedGain,
    remainingLots,
  };
}

export function calculateIncomeTax2026(income, assessment = "single") {
  const taxableIncome = Math.max(0, Math.floor(Number(income) || 0));
  if (assessment === "joint") return 2 * calculateIncomeTax2026(taxableIncome / 2, "single");
  if (taxableIncome <= 12_348) return 0;
  if (taxableIncome <= 17_799) {
    const y = (taxableIncome - 12_348) / 10_000;
    return (914.51 * y + 1_400) * y;
  }
  if (taxableIncome <= 69_878) {
    const z = (taxableIncome - 17_799) / 10_000;
    return (173.10 * z + 2_397) * z + 1_034.87;
  }
  if (taxableIncome <= 277_825) return 0.42 * taxableIncome - 11_135.63;
  return 0.45 * taxableIncome - 19_470.38;
}

export function getPensionTaxableShare(retirementYear) {
  const year = Math.round(Number(retirementYear) || TAX_RULE_YEAR);
  if (year <= 2005) return 50;
  if (year <= 2020) return 50 + (year - 2005) * 2;
  if (year <= 2022) return 80 + (year - 2020);
  if (year <= 2058) return 82 + (year - 2022) * 0.5;
  return 100;
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

function calculatePrivateNetWithdrawal(lots, desiredNetWithdrawal, context, taxState) {
  const availableBalance = getLotValue(lots);
  if (availableBalance <= 0 || desiredNetWithdrawal <= 0) {
    return {
      netWithdrawal: 0,
      grossWithdrawal: 0,
      tax: 0,
      realizedGain: 0,
      taxState,
    };
  }

  const evaluate = (grossWithdrawal) => {
    const sale = calculateFifoSale(lots, grossWithdrawal);
    const taxableGain = sale.realizedGain * (1 - context.partialExemptionRate / 100);
    const taxableCapitalIncome = taxState.taxableCapitalIncome + taxableGain;
    const assessedTax = calculateAnnualPrivateTax(taxableCapitalIncome, context);
    const tax = Math.max(0, assessedTax - taxState.assessedTax);
    return {
      ...sale,
      taxableCapitalIncome,
      assessedTax,
      tax,
      netWithdrawal: Math.max(0, sale.proceeds - tax),
    };
  };

  let selected = evaluate(availableBalance);
  if (selected.netWithdrawal > desiredNetWithdrawal) {
    let lower = Math.min(desiredNetWithdrawal, availableBalance);
    let upper = availableBalance;
    for (let iteration = 0; iteration < 60; iteration += 1) {
      const middle = (lower + upper) / 2;
      const candidate = evaluate(middle);
      if (candidate.netWithdrawal < desiredNetWithdrawal) lower = middle;
      else upper = middle;
    }
    selected = evaluate(upper);
  }

  lots.splice(0, lots.length, ...selected.remainingLots);
  return {
    netWithdrawal: selected.netWithdrawal,
    grossWithdrawal: selected.proceeds,
    tax: selected.tax,
    realizedGain: selected.realizedGain,
    taxState: {
      year: taxState.year,
      taxableCapitalIncome: selected.taxableCapitalIncome,
      assessedTax: selected.assessedTax,
    },
  };
}

function calculateAnnualPrivateTax(taxableCapitalIncome, context) {
  if (context.taxDisabled) return 0;
  const taxableAfterAllowance = Math.max(
    0,
    taxableCapitalIncome - context.saverAllowance,
  );
  if (taxableAfterAllowance <= 0) return 0;

  const flatIncomeTax = taxableAfterAllowance * CAPITAL_TAX_RATE;
  const flatTotal = flatIncomeTax
    + (context.solidarityEnabled ? flatIncomeTax * SOLIDARITY_RATE : 0);
  let selectedTax = flatTotal;

  if (context.personalTaxEnabled) {
    const retirementStartYear = TAX_RULE_YEAR + context.retirementAge - context.currentAge;
    const pensionTaxableShare = getPensionTaxableShare(retirementStartYear) / 100;
    const taxablePension = Math.max(
      0,
      context.statutoryPensionMonthly * 12 * pensionTaxableShare
        - PENSION_EXPENSE_ALLOWANCE,
    );
    const pensionIncomeTax = calculateIncomeTax2026(taxablePension, context.taxAssessment);
    const combinedIncomeTax = calculateIncomeTax2026(
      taxablePension + taxableAfterAllowance,
      context.taxAssessment,
    );
    const pensionSurcharge = context.solidarityEnabled
      ? calculateSolidaritySurcharge(pensionIncomeTax, context.taxAssessment)
      : 0;
    const combinedSurcharge = context.solidarityEnabled
      ? calculateSolidaritySurcharge(combinedIncomeTax, context.taxAssessment)
      : 0;
    const tariffIncrease = Math.max(
      0,
      combinedIncomeTax + combinedSurcharge - pensionIncomeTax - pensionSurcharge,
    );
    selectedTax = Math.min(flatTotal, tariffIncrease);
  }

  const optionalSocialContributions = context.socialContributionsEnabled
    ? taxableAfterAllowance * OPTIONAL_SOCIAL_RATE
    : 0;
  return selectedTax + optionalSocialContributions;
}

function calculateSolidaritySurcharge(incomeTax, assessment) {
  const exemption = assessment === "joint" ? 40_700 : 20_350;
  if (incomeTax <= exemption) return 0;
  return Math.min(
    incomeTax * SOLIDARITY_RATE,
    (incomeTax - exemption) * 0.119,
  );
}

function createInitialLots(initialCapital) {
  return initialCapital > 0
    ? [{ marketValue: initialCapital, costBasis: initialCapital }]
    : [];
}

function addLot(lots, marketValue, costBasis) {
  if (marketValue <= 0) return;
  lots.push({ marketValue, costBasis: Math.max(0, costBasis) });
}

function growLots(lots, rate) {
  lots.forEach((lot) => {
    lot.marketValue = Math.max(0, lot.marketValue * (1 + rate));
  });
}

function reconcileLotValues(lots, targetValue) {
  const currentValue = getLotValue(lots);
  if (currentValue <= 0 || targetValue <= 0) {
    if (targetValue <= 0) lots.splice(0, lots.length);
    return;
  }
  const factor = targetValue / currentValue;
  lots.forEach((lot) => {
    lot.marketValue *= factor;
  });
}

function getLotValue(lots) {
  return lots.reduce((sum, lot) => sum + lot.marketValue, 0);
}

function createAnnualTaxState(year = 0) {
  return {
    year,
    taxableCapitalIncome: 0,
    assessedTax: 0,
  };
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
