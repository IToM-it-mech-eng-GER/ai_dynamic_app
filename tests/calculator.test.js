import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateFifoSale,
  calculateIncomeTax2026,
  calculatePlan,
  getPrivateAnnuityTaxableShare,
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

test("verwendet ohne Angabe kein Startkapital", () => {
  assert.equal(normalizeProduct({}).initialCapital, 0);
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
      taxDisabled: true,
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

test("erhöht durch Rebalancing ausschließlich im Rentendepot die Rendite", () => {
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
    rebalancingBonus: 0.5,
  };
  const withoutRebalancing = calculatePlan(product, {
    ...scenario,
    rebalancingEnabled: false,
  });
  const withRebalancing = calculatePlan(product, {
    ...scenario,
    depotType: "pension",
    rebalancingEnabled: true,
  });
  const privateDepot = calculatePlan(product, {
    ...scenario,
    depotType: "private",
    rebalancingEnabled: true,
  });

  assert.equal(withRebalancing.netAnnualReturn, 6.3);
  assert.ok(withRebalancing.endingBalance > withoutRebalancing.endingBalance);
  assert.equal(privateDepot.netAnnualReturn, withoutRebalancing.netAnnualReturn);
});

test("besteuert einen vollständigen Fondswechsel im Privatdepot", () => {
  const result = calculatePlan(
    {
      initialCapital: 10_000,
      monthlyContribution: 0,
      annualReturn: 10,
      annualFee: 0,
      transactionFee: 0,
    },
    {
      currentAge: 30,
      retirementAge: 31,
      lifeExpectancy: 80,
      depotType: "private",
      withdrawalEnabled: false,
      rebalancingEnabled: false,
      fundSwitchEnabled: true,
      fundSwitchAges: [31],
      personalTaxEnabled: false,
      socialContributionsEnabled: false,
      saverAllowance: 0,
      partialExemptionRate: 0,
      solidarityEnabled: false,
      taxDisabled: false,
    },
  );

  assert.ok(Math.abs(result.fundSwitchTaxes - 250) < 0.01);
  assert.ok(Math.abs(result.retirementBalance - 10_750) < 0.01);
  assert.equal(result.fundSwitchCount, 1);
  assert.ok(Math.abs(result.estimatedTaxes - 250) < 0.01);
});

test("zeichnet den Steuerabzug eines Fondswechsels als sichtbares Diagrammereignis auf", () => {
  const result = calculatePlan(
    {
      initialCapital: 10_000,
      monthlyContribution: 0,
      annualReturn: 10,
      annualFee: 0,
      transactionFee: 0,
    },
    {
      currentAge: 30,
      retirementAge: 31,
      lifeExpectancy: 80,
      depotType: "private",
      withdrawalEnabled: false,
      rebalancingEnabled: false,
      fundSwitchEnabled: true,
      fundSwitchAges: [31],
      personalTaxEnabled: false,
      socialContributionsEnabled: false,
      saverAllowance: 0,
      partialExemptionRate: 0,
      solidarityEnabled: false,
      taxDisabled: false,
    },
  );

  assert.deepEqual(result.fundSwitchEvents, [{
    age: 31,
    balanceBefore: 11_000,
    balanceAfter: 10_750,
    fee: 0,
    tax: 250,
  }]);
  const switchPoints = result.series.filter((point) => point.age === 31);
  assert.equal(switchPoints.length, 2);
  assert.equal(switchPoints[0].balance, 11_000);
  assert.equal(switchPoints[1].balance, 10_750);
});

test("führt mehrere Fondswechsel aus und besteuert jeden neuen Gewinn", () => {
  const result = calculatePlan(
    {
      initialCapital: 10_000,
      monthlyContribution: 0,
      annualReturn: 10,
      annualFee: 0,
      transactionFee: 0,
    },
    {
      currentAge: 30,
      retirementAge: 32,
      lifeExpectancy: 80,
      depotType: "private",
      withdrawalEnabled: false,
      rebalancingEnabled: false,
      fundSwitchEnabled: true,
      fundSwitchAges: [31, 32],
      personalTaxEnabled: false,
      socialContributionsEnabled: false,
      saverAllowance: 0,
      partialExemptionRate: 0,
      solidarityEnabled: false,
      taxDisabled: false,
    },
  );

  assert.equal(result.fundSwitchCount, 2);
  assert.ok(Math.abs(result.fundSwitchTaxes - 518.75) < 0.01);
  assert.ok(Math.abs(result.retirementBalance - 11_556.25) < 0.01);
});

test("wendet Teilfreistellung, Pauschbetrag, Soli und Szenarioabgaben beim Fondswechsel an", () => {
  const result = calculatePlan(
    {
      initialCapital: 10_000,
      monthlyContribution: 0,
      annualReturn: 10,
      annualFee: 0,
      transactionFee: 0,
    },
    {
      currentAge: 30,
      retirementAge: 31,
      lifeExpectancy: 80,
      depotType: "private",
      withdrawalEnabled: false,
      rebalancingEnabled: false,
      fundSwitchEnabled: true,
      fundSwitchAges: [31],
      personalTaxEnabled: false,
      socialContributionsEnabled: true,
      saverAllowance: 100,
      partialExemptionRate: 30,
      solidarityEnabled: true,
      taxDisabled: false,
    },
  );

  assert.ok(Math.abs(result.fundSwitchTaxes - 176.25) < 0.01);
});

test("führt Steuer und Produktkosten beim Fondswechsel getrennt auf", () => {
  const result = calculatePlan(
    {
      initialCapital: 10_000,
      monthlyContribution: 0,
      annualReturn: 10,
      annualFee: 0,
      annualCustodyFee: 0,
      transactionFee: 0,
    },
    {
      currentAge: 30,
      retirementAge: 31,
      lifeExpectancy: 80,
      depotType: "private",
      withdrawalEnabled: false,
      rebalancingEnabled: false,
      fundSwitchEnabled: true,
      fundSwitchAges: [31],
      personalTaxEnabled: false,
      socialContributionsEnabled: false,
      saverAllowance: 0,
      partialExemptionRate: 0,
      solidarityEnabled: false,
      taxDisabled: false,
    },
  );

  assert.ok(result.fundSwitchTaxes > 0);
  assert.ok(Math.abs(result.totalCosts) < 0.01);
});

test("verrechnet Verluste im selben Steuerjahr mit einer vorherigen Fondswechselsteuer", () => {
  const result = calculatePlan(
    {
      initialCapital: 10_000,
      monthlyContribution: 0,
      annualReturn: 10,
      annualFee: 0,
      annualCustodyFee: 0,
      transactionFee: 0,
    },
    {
      currentAge: 30,
      retirementAge: 31,
      lifeExpectancy: 32,
      depotType: "private",
      withdrawalEnabled: true,
      withdrawalAmount: 100_000,
      withdrawalFrequency: "monthly",
      withdrawalType: "euro",
      postRetirementReturn: -50,
      inflationEnabled: false,
      rebalancingEnabled: false,
      fundSwitchEnabled: true,
      fundSwitchAges: [31],
      personalTaxEnabled: false,
      socialContributionsEnabled: false,
      saverAllowance: 0,
      partialExemptionRate: 0,
      solidarityEnabled: false,
      taxDisabled: false,
    },
  );

  assert.ok(result.withdrawalTaxes < 0);
  assert.ok(result.estimatedTaxes >= 0);
  assert.ok(result.estimatedTaxes < result.fundSwitchTaxes);
});

test("löst im Rentendepot beim Fondswechsel keine Steuer aus", () => {
  const result = calculatePlan(
    {
      initialCapital: 10_000,
      monthlyContribution: 0,
      annualReturn: 10,
      annualFee: 0,
      transactionFee: 0,
    },
    {
      currentAge: 30,
      retirementAge: 31,
      lifeExpectancy: 80,
      depotType: "pension",
      withdrawalEnabled: false,
      rebalancingEnabled: false,
      fundSwitchEnabled: true,
      fundSwitchAges: [31],
      taxDisabled: false,
    },
  );

  assert.equal(result.fundSwitchTaxes, 0);
  assert.equal(result.fundSwitchCount, 1);
  assert.equal(result.fundSwitchEvents[0].tax, 0);
  assert.equal(result.fundSwitchEvents[0].balanceBefore, result.fundSwitchEvents[0].balanceAfter);
  assert.ok(Math.abs(result.retirementBalance - 11_000) < 0.01);
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

test("ermittelt den gesetzlichen Ertragsanteil einer privaten Leibrente nach Rentenalter", () => {
  assert.equal(getPrivateAnnuityTaxableShare(66), 18);
  assert.equal(getPrivateAnnuityTaxableShare(67), 17);
  assert.equal(getPrivateAnnuityTaxableShare(68), 16);
  assert.equal(getPrivateAnnuityTaxableShare(92), 3);
  assert.equal(getPrivateAnnuityTaxableShare(97), 1);
});

test("erhöht im Rentendepot die Bruttoentnahme um die Steuer auf den Ertragsanteil", () => {
  const product = {
    initialCapital: 10_000,
    monthlyContribution: 0,
    annualReturn: 0,
    annualFee: 0,
  };
  const baseScenario = {
    currentAge: 66,
    retirementAge: 67,
    lifeExpectancy: 68,
    depotType: "pension",
    statutoryPensionMonthly: 2_000,
    withdrawalEnabled: true,
    withdrawalAmount: 1_000,
    withdrawalFrequency: "yearly",
    withdrawalType: "euro",
    postRetirementReturn: 0,
    inflationEnabled: false,
    rebalancingEnabled: false,
    fundSwitchEnabled: false,
    personalTaxEnabled: true,
    marginalTaxRate: 30,
    socialContributionsEnabled: false,
    solidarityEnabled: false,
    taxDisabled: false,
  };

  const age67 = calculatePlan(product, baseScenario);
  const age66 = calculatePlan(product, {
    ...baseScenario,
    currentAge: 65,
    retirementAge: 66,
    lifeExpectancy: 67,
  });

  assert.ok(Math.abs(age67.totalWithdrawals - 1_000) < 0.01);
  assert.ok(Math.abs(age67.grossWithdrawals - 1_000 / (1 - 0.17 * 0.3)) < 0.01);
  assert.ok(Math.abs(age67.estimatedTaxes - (age67.grossWithdrawals - 1_000)) < 0.01);
  assert.ok(age66.grossWithdrawals > age67.grossWithdrawals);
  assert.equal(age67.netEndingBalance, age67.endingBalance);
});

test("wendet im Rentendepot den Grundfreibetrag auf den Ertragsanteil an", () => {
  const result = calculatePlan(
    {
      initialCapital: 10_000,
      monthlyContribution: 0,
      annualReturn: 0,
      annualFee: 0,
    },
    {
      currentAge: 66,
      retirementAge: 67,
      lifeExpectancy: 68,
      depotType: "pension",
      statutoryPensionMonthly: 0,
      withdrawalEnabled: true,
      withdrawalAmount: 1_000,
      withdrawalFrequency: "yearly",
      withdrawalType: "euro",
      postRetirementReturn: 0,
      inflationEnabled: false,
      rebalancingEnabled: false,
      fundSwitchEnabled: false,
      personalTaxEnabled: true,
      marginalTaxRate: 30,
      socialContributionsEnabled: false,
      solidarityEnabled: false,
      taxDisabled: false,
    },
  );

  assert.equal(result.estimatedTaxes, 0);
  assert.ok(Math.abs(result.grossWithdrawals - result.totalWithdrawals) < 0.01);
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
