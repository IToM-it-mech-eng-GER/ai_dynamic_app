import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePlan,
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
