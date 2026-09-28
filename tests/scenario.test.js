import assert from "node:assert/strict";
import test from "node:test";

import {
  getSwipeStep,
  moveWizardStep,
  normalizeScenario,
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
    withdrawalAmount: -50,
    postRetirementReturn: 80,
    inflationRate: 30,
    marginalTaxRate: 120,
    fundSwitchPercentage: 140,
  });

  assert.equal(scenario.withdrawalAmount, 0);
  assert.equal(scenario.postRetirementReturn, 30);
  assert.equal(scenario.inflationRate, 15);
  assert.equal(scenario.marginalTaxRate, 60);
  assert.equal(scenario.fundSwitchPercentage, 100);
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
