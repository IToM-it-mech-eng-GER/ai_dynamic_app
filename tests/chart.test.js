import assert from "node:assert/strict";
import test from "node:test";

import { getMonthlyNetPayment, getPaymentLinePattern } from "../js/chart.js";

function createPlan(overrides = {}) {
  return {
    product: {
      scenario: {
        withdrawalEnabled: true,
        withdrawalAmount: 570,
        withdrawalFrequency: "monthly",
        withdrawalType: "euro",
        ...overrides,
      },
    },
    result: { retirementBalance: 240_000 },
  };
}

test("zeigt monatliche Nettozahlungen in Euro unverändert", () => {
  assert.equal(getMonthlyNetPayment(createPlan()), 570);
});

test("rechnet jährliche Nettozahlungen auf den Monat um", () => {
  assert.equal(getMonthlyNetPayment(createPlan({ withdrawalAmount: 12_000, withdrawalFrequency: "yearly" })), 1_000);
});

test("rechnet prozentuale Nettozahlungen auf einen Monatswert um", () => {
  assert.equal(getMonthlyNetPayment(createPlan({ withdrawalAmount: 6, withdrawalType: "percent" })), 1_200);
});

test("blendet Nettozahlungen bei deaktivierter Entnahme aus", () => {
  assert.equal(getMonthlyNetPayment(createPlan({ withdrawalEnabled: false })), 0);
});

test("versetzt gleich hohe Nettozahlungslinien lückenlos gegeneinander", () => {
  assert.deepEqual(getPaymentLinePattern(0, 2), { dashArray: "6 6", dashOffset: 0 });
  assert.deepEqual(getPaymentLinePattern(1, 2), { dashArray: "6 6", dashOffset: 6 });
  assert.deepEqual(getPaymentLinePattern(2, 3), { dashArray: "6 12", dashOffset: 12 });
});
