import assert from "node:assert/strict";
import test from "node:test";

import {
  getSwipeStep,
  moveWizardStep,
  normalizeScenario,
  updateFundSwitchAge,
} from "../js/scenario.js";

test("ordnet persönliche Altersangaben in einer gültigen Reihenfolge", () => {
  const scenario = normalizeScenario({
    currentAge: 70,
    retirementAge: 40,
    lifeExpectancy: 35,
  });

  assert.equal(scenario.currentAge, 70);
  assert.equal(scenario.retirementAge, 71);
  assert.equal(scenario.lifeExpectancy, 72);
});

test("begrenzt Eingaben für Entnahme und politische Annahmen", () => {
  const scenario = normalizeScenario({
    depotType: "private",
    statutoryPensionMonthly: 250_000,
    taxAssessment: "joint",
    partialExemptionRate: 120,
    withdrawalAmount: -50,
    postRetirementReturn: 80,
    inflationRate: 30,
    marginalTaxRate: 120,
    fundSwitchAges: [62, 62, 150, 20],
  });

  assert.equal(scenario.withdrawalAmount, 0);
  assert.equal(scenario.depotType, "private");
  assert.equal(scenario.statutoryPensionMonthly, 100_000);
  assert.equal(scenario.taxAssessment, "joint");
  assert.equal(scenario.partialExemptionRate, 80);
  assert.equal(scenario.postRetirementReturn, 30);
  assert.equal(scenario.inflationRate, 15);
  assert.equal(scenario.marginalTaxRate, 60);
  assert.deepEqual(scenario.fundSwitchAges, [62, 67, 38]);
});

test("lässt Rebalancing ausschließlich im Rentendepot als Renditebonus zu", () => {
  const pension = normalizeScenario({
    depotType: "pension",
    rebalancingEnabled: true,
    rebalancingBonus: 0.8,
  });
  const privateDepot = normalizeScenario({
    depotType: "private",
    rebalancingEnabled: true,
    rebalancingBonus: 0.8,
  });

  assert.equal(pension.rebalancingEnabled, true);
  assert.equal(pension.rebalancingBonus, 0.8);
  assert.equal(privateDepot.rebalancingEnabled, false);
});

test("übernimmt gespeicherte einzelne Fondswechsel in die neue Liste", () => {
  const scenario = normalizeScenario({
    currentAge: 40,
    retirementAge: 67,
    fundSwitchAge: 58,
  });

  assert.deepEqual(scenario.fundSwitchAges, [58]);
});

test("behält die Reihenfolge geänderter Fondswechsel bei", () => {
  const scenario = normalizeScenario({
    currentAge: 37,
    retirementAge: 67,
    fundSwitchAges: [65, 63, 64],
  });

  assert.deepEqual(scenario.fundSwitchAges, [65, 63, 64]);
});

test("ändert genau einen Fondswechsel und verhindert doppelte Jahre", () => {
  const changed = updateFundSwitchAge([62, 63], 0, 65, 37, 67);
  const duplicate = updateFundSwitchAge([62, 63], 0, 63, 37, 67);

  assert.deepEqual(changed, { fundSwitchAges: [65, 63], valid: true });
  assert.deepEqual(duplicate, { fundSwitchAges: [62, 63], valid: false });
});

test("behält das bisherige Rentendepot als Standard", () => {
  const scenario = normalizeScenario();

  assert.equal(scenario.depotType, "pension");
  assert.equal(scenario.statutoryPensionMonthly, 0);
  assert.equal(scenario.taxAssessment, "single");
  assert.equal(scenario.partialExemptionRate, 30);
});

test("begrenzt den Sparer-Pauschbetrag im Privatdepot nach Veranlagung", () => {
  const single = normalizeScenario({
    depotType: "private",
    taxAssessment: "single",
    saverAllowance: 2_000,
  });
  const joint = normalizeScenario({
    depotType: "private",
    taxAssessment: "joint",
    saverAllowance: 3_000,
  });

  assert.equal(single.saverAllowance, 1_000);
  assert.equal(joint.saverAllowance, 2_000);
});

test("bewegt den Assistenten nur innerhalb seiner sechs Schritte", () => {
  assert.equal(moveWizardStep(0, -1), 0);
  assert.equal(moveWizardStep(0, 1), 1);
  assert.equal(moveWizardStep(5, 1), 5);
  assert.equal(moveWizardStep(3, -1), 2);
});

test("wertet nur deutliche horizontale Wischgesten aus", () => {
  assert.equal(getSwipeStep(120, 20), -1);
  assert.equal(getSwipeStep(-120, 20), 1);
  assert.equal(getSwipeStep(30, 4), 0);
  assert.equal(getSwipeStep(80, 100), 0);
});
