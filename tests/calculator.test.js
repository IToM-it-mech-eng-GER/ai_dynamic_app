import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateFifoSale,
  calculateIncomeTax2026,
  calculatePlan,
  getPensionTaxableShare,
  normalizeHorizon,
  normalizeProduct,
} from "../js/calculator.js";

test("summiert Startkapital und monatliche Einzahlungen ohne Rendite", () => {
  const result = calculatePlan(
    {
      initialCapital: 1_000,
      monthlyContribution: 100,
      annualReturn: 0,
      annualFee: 0,
    },
    2,
  );

  assert.equal(result.totalContributions, 3_400);
  assert.equal(result.endingBalance, 3_400);
  assert.equal(result.totalGain, 0);
  assert.deepEqual(result.series.map((point) => point.year), [0, 1, 2]);
});

test("bildet die jährliche Rendite über monatliche Perioden korrekt ab", () => {
  const result = calculatePlan(
    {
      initialCapital: 1_000,
      monthlyContribution: 0,
      annualReturn: 6,
      annualFee: 0,
    },
    1,
  );

  assert.ok(Math.abs(result.endingBalance - 1_060) < 0.0001);
  assert.ok(Math.abs(result.totalGain - 60) < 0.0001);
});

test("zieht die laufende Kostenquote von der Renditeannahme ab", () => {
  const result = calculatePlan(
    {
      initialCapital: 1_000,
      monthlyContribution: 0,
      annualReturn: 6,
      annualFee: 0.2,
    },
    1,
  );

  assert.ok(Math.abs(result.endingBalance - 1_058) < 0.0001);
  assert.equal(result.netAnnualReturn, 5.8);
});

test("begrenzt unplausible Produktwerte auf sichere Bereiche", () => {
  const product = normalizeProduct({
    name: "   ",
    initialCapital: -10,
    monthlyContribution: 200_000,
    annualReturn: 80,
    annualFee: -1,
  });

  assert.equal(product.name, "ETF-Sparplan");
  assert.equal(product.initialCapital, 0);
  assert.equal(product.monthlyContribution, 100_000);
  assert.equal(product.annualReturn, 50);
  assert.equal(product.annualFee, 0);
});

test("begrenzt den gemeinsamen Anlagehorizont auf 1 bis 50 Jahre", () => {
  assert.equal(normalizeHorizon(0), 1);
  assert.equal(normalizeHorizon(25.8), 26);
  assert.equal(normalizeHorizon(99), 50);
  assert.equal(normalizeHorizon("ungueltig"), 30);
});

test("liefert auch bei negativer Nettorendite endliche Werte", () => {
  const result = calculatePlan(
    {
      initialCapital: 5_000,
      monthlyContribution: 250,
      annualReturn: -10,
      annualFee: 1,
    },
    30,
  );

  assert.ok(Number.isFinite(result.endingBalance));
  assert.ok(result.endingBalance >= 0);
  assert.equal(result.series.length, 31);
});

test("berechnet Anspar- und Entnahmephase entlang der Altersangaben", () => {
  const result = calculatePlan(
    {
      initialCapital: 0,
      monthlyContribution: 100,
      annualReturn: 0,
      annualFee: 0,
    },
    {
      currentAge: 40,
      retirementAge: 42,
      lifeExpectancy: 44,
      withdrawalEnabled: true,
      withdrawalAmount: 50,
      withdrawalFrequency: "monthly",
      withdrawalType: "euro",
      postRetirementReturn: 0,
      inflationEnabled: false,
      rebalancingEnabled: false,
    },
  );

  assert.equal(result.totalContributions, 2_400);
  assert.equal(result.totalWithdrawals, 1_200);
  assert.equal(result.retirementBalance, 2_400);
  assert.equal(result.endingBalance, 1_200);
  assert.equal(result.totalGain, 0);
  assert.deepEqual(result.series.map((point) => point.age), [40, 41, 42, 43, 44]);
});

test("erhöht Entnahmen bei aktivierter Inflation jährlich", () => {
  const baseScenario = {
    currentAge: 60,
    retirementAge: 61,
    lifeExpectancy: 64,
    withdrawalEnabled: true,
    withdrawalAmount: 1_000,
    withdrawalFrequency: "yearly",
    withdrawalType: "euro",
    postRetirementReturn: 0,
  };
  const product = {
    initialCapital: 100_000,
    monthlyContribution: 0,
    annualReturn: 0,
    annualFee: 0,
  };

  const withoutInflation = calculatePlan(product, {
    ...baseScenario,
    inflationEnabled: false,
  });
  const withInflation = calculatePlan(product, {
    ...baseScenario,
    inflationEnabled: true,
    inflationRate: 10,
  });

  assert.equal(withoutInflation.totalWithdrawals, 3_000);
  assert.ok(withInflation.totalWithdrawals > withoutInflation.totalWithdrawals);
  assert.ok(withInflation.endingBalance < withoutInflation.endingBalance);
});

test("weist Depot- und Transaktionskosten als Modellkosten aus", () => {
  const result = calculatePlan(
    {
      initialCapital: 10_000,
      monthlyContribution: 100,
      annualReturn: 5,
      annualFee: 0.2,
      annualCustodyFee: 24,
      transactionFee: 1,
    },
    {
      currentAge: 30,
      retirementAge: 40,
      lifeExpectancy: 80,
      withdrawalEnabled: false,
    },
  );

  assert.ok(result.totalCosts > 0);
  assert.ok(result.grossEndingBalance > result.endingBalance);
  assert.equal(result.series.at(-1).age, 40);
});

test("deaktiviert die vereinfachte Steuerberechnung vollständig", () => {
  const result = calculatePlan(
    {
      initialCapital: 10_000,
      monthlyContribution: 0,
      annualReturn: 10,
      annualFee: 0,
    },
    {
      currentAge: 30,
      retirementAge: 40,
      lifeExpectancy: 80,
      withdrawalEnabled: false,
      taxDisabled: true,
    },
  );

  assert.equal(result.estimatedTaxes, 0);
});

test("behandelt Rebalancing als Renditeabzug und niemals als Bonus", () => {
  const product = {
    initialCapital: 10_000,
    monthlyContribution: 200,
    annualReturn: 6,
    annualFee: 0.2,
  };
  const scenario = {
    currentAge: 30,
    retirementAge: 50,
    lifeExpectancy: 80,
    withdrawalEnabled: false,
    taxDisabled: true,
    rebalancingReduction: 0.5,
  };
  const withoutRebalancing = calculatePlan(product, {
    ...scenario,
    rebalancingEnabled: false,
  });
  const withRebalancing = calculatePlan(product, {
    ...scenario,
    rebalancingEnabled: true,
  });

  assert.equal(withRebalancing.netAnnualReturn, 5.3);
  assert.ok(withRebalancing.endingBalance < withoutRebalancing.endingBalance);
});

test("ordnet Verkäufe im Privatdepot nach dem FIFO-Prinzip zu", () => {
  const sale = calculateFifoSale([
    { marketValue: 200, costBasis: 100 },
    { marketValue: 200, costBasis: 180 },
  ], 250);

  assert.equal(sale.proceeds, 250);
  assert.equal(sale.realizedGain, 105);
  assert.deepEqual(sale.remainingLots, [
    { marketValue: 150, costBasis: 135 },
  ]);
});

test("bildet den Einkommensteuertarif 2026 und das Splittingverfahren ab", () => {
  assert.equal(calculateIncomeTax2026(12_348), 0);
  assert.ok(calculateIncomeTax2026(30_000) > 0);
  assert.equal(
    calculateIncomeTax2026(24_696, "joint"),
    0,
  );
});

test("ermittelt den gesetzlichen Besteuerungsanteil der Rente", () => {
  assert.equal(getPensionTaxableShare(2005), 50);
  assert.equal(getPensionTaxableShare(2026), 84);
  assert.equal(getPensionTaxableShare(2056), 99);
  assert.equal(getPensionTaxableShare(2058), 100);
});

test("verkauft im Privatdepot brutto mehr als die gewünschte Nettoentnahme", () => {
  const result = calculatePlan(
    {
      initialCapital: 10_000,
      monthlyContribution: 0,
      annualReturn: 10,
      annualFee: 0,
    },
    {
      currentAge: 60,
      retirementAge: 61,
      lifeExpectancy: 62,
      depotType: "private",
      withdrawalEnabled: true,
      withdrawalAmount: 1_000,
      withdrawalFrequency: "yearly",
      withdrawalType: "euro",
      postRetirementReturn: 0,
      inflationEnabled: false,
      rebalancingEnabled: false,
      fundSwitchEnabled: false,
      personalTaxEnabled: false,
      socialContributionsEnabled: false,
      saverAllowance: 0,
      partialExemptionRate: 0,
      solidarityEnabled: false,
      taxDisabled: false,
    },
  );

  assert.ok(Math.abs(result.totalWithdrawals - 1_000) < 0.01);
  assert.ok(result.grossWithdrawals > result.totalWithdrawals);
  assert.ok(Math.abs(result.grossWithdrawals - result.totalWithdrawals - result.estimatedTaxes) < 0.01);
  assert.ok(result.endingBalance < 10_000);
});

test("wendet Teilfreistellung und Sparer-Pauschbetrag jährlich auf FIFO-Gewinne an", () => {
  const result = calculatePlan(
    {
      initialCapital: 10_000,
      monthlyContribution: 0,
      annualReturn: 10,
      annualFee: 0,
    },
    {
      currentAge: 60,
      retirementAge: 61,
      lifeExpectancy: 62,
      depotType: "private",
      withdrawalEnabled: true,
      withdrawalAmount: 5_000,
      withdrawalFrequency: "yearly",
      withdrawalType: "euro",
      postRetirementReturn: 0,
      inflationEnabled: false,
      rebalancingEnabled: false,
      fundSwitchEnabled: false,
      personalTaxEnabled: false,
      socialContributionsEnabled: false,
      saverAllowance: 1_000,
      partialExemptionRate: 30,
      solidarityEnabled: true,
      taxDisabled: false,
    },
  );

  assert.equal(result.estimatedTaxes, 0);
  assert.ok(Math.abs(result.grossWithdrawals - 5_000) < 0.01);
});

test("berücksichtigt die gesetzliche Rente bei der Günstigerprüfung", () => {
  const baseScenario = {
    currentAge: 60,
    retirementAge: 61,
    lifeExpectancy: 62,
    depotType: "private",
    withdrawalEnabled: true,
    withdrawalAmount: 5_000,
    withdrawalFrequency: "yearly",
    withdrawalType: "euro",
    postRetirementReturn: 0,
    inflationEnabled: false,
    rebalancingEnabled: false,
    fundSwitchEnabled: false,
    personalTaxEnabled: true,
    socialContributionsEnabled: false,
    saverAllowance: 0,
    partialExemptionRate: 0,
    solidarityEnabled: false,
    taxDisabled: false,
  };
  const product = {
    initialCapital: 10_000,
    monthlyContribution: 0,
    annualReturn: 10,
    annualFee: 0,
  };
  const withoutPension = calculatePlan(product, {
    ...baseScenario,
    statutoryPensionMonthly: 0,
  });
  const withPension = calculatePlan(product, {
    ...baseScenario,
    statutoryPensionMonthly: 4_000,
  });

  assert.ok(withPension.estimatedTaxes > withoutPension.estimatedTaxes);
});

test("setzt den Sparer-Pauschbetrag in jedem Entnahmejahr neu an", () => {
  const product = {
    initialCapital: 10_000,
    monthlyContribution: 0,
    annualReturn: 50,
    annualFee: 0,
  };
  const scenario = {
    currentAge: 60,
    retirementAge: 61,
    depotType: "private",
    withdrawalEnabled: true,
    withdrawalAmount: 5_000,
    withdrawalFrequency: "yearly",
    withdrawalType: "euro",
    postRetirementReturn: 0,
    inflationEnabled: false,
    rebalancingEnabled: false,
    fundSwitchEnabled: false,
    personalTaxEnabled: false,
    socialContributionsEnabled: false,
    saverAllowance: 1_000,
    partialExemptionRate: 0,
    solidarityEnabled: false,
    taxDisabled: false,
  };
  const oneYear = calculatePlan(product, { ...scenario, lifeExpectancy: 62 });
  const twoYears = calculatePlan(product, { ...scenario, lifeExpectancy: 63 });

  assert.ok(oneYear.estimatedTaxes > 0);
  assert.ok(Math.abs(twoYears.estimatedTaxes - oneYear.estimatedTaxes * 2) < 0.01);
});

test("deaktiviert auch im Privatdepot alle Entnahmesteuern", () => {
  const result = calculatePlan(
    {
      initialCapital: 10_000,
      monthlyContribution: 0,
      annualReturn: 10,
      annualFee: 0,
    },
    {
      currentAge: 60,
      retirementAge: 61,
      lifeExpectancy: 62,
      depotType: "private",
      withdrawalEnabled: true,
      withdrawalAmount: 1_000,
      withdrawalFrequency: "yearly",
      withdrawalType: "euro",
      postRetirementReturn: 0,
      inflationEnabled: false,
      rebalancingEnabled: false,
      fundSwitchEnabled: false,
      taxDisabled: true,
    },
  );

  assert.equal(result.estimatedTaxes, 0);
  assert.ok(Math.abs(result.grossWithdrawals - result.totalWithdrawals) < 0.01);
});
