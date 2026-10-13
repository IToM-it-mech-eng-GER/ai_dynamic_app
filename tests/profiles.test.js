import assert from "node:assert/strict";
import test from "node:test";

import {
  cloneSetup,
  readProfiles,
  removeProfile,
  serializeProfiles,
  normalizeProfileName,
  overwriteProfile,
  upsertProfile,
} from "../js/profiles.js";
import { createProducts } from "../js/products.js";
import { calculatePlan } from "../js/calculator.js";

function createSetup() {
  const products = createProducts(2);
  return { products, selectedId: products[0].id };
}

test("begrenzt und trimmt Profilnamen", () => {
  assert.equal(normalizeProfileName("  Ruhestand  "), "Ruhestand");
  assert.equal(normalizeProfileName("x".repeat(70)).length, 48);
  assert.equal(normalizeProfileName("   "), "");
});

test("speichert Profile unabhängig und ersetzt denselben Namen", () => {
  const setup = createSetup();
  setup.products[0].scenario.depotType = "private";
  setup.products[0].scenario.statutoryPensionMonthly = 2_100;
  const profiles = upsertProfile([], "Basis", setup, { id: "profile-1", savedAt: "2026-09-30" });
  setup.products[0].scenario.currentAge = 50;
  const replaced = upsertProfile(profiles, " basis ", setup, { id: "profile-2", savedAt: "2026-10-01" });

  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].setup.products[0].scenario.currentAge, 37);
  assert.equal(profiles[0].setup.products[0].scenario.depotType, "private");
  assert.equal(profiles[0].setup.products[0].scenario.statutoryPensionMonthly, 2_100);
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].id, "profile-2");
  assert.equal(replaced[0].setup.products[0].scenario.currentAge, 50);
});

test("liest beschädigte oder fremde Profildaten sicher ein", () => {
  const setup = createSetup();
  const serialized = serializeProfiles(upsertProfile([], "Gespeichert", setup, { id: "profile-1", savedAt: "2026-09-30" }));
  const profiles = readProfiles(serialized);
  const malformed = readProfiles("{ kaputt");

  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].setup.products.length, 2);
  assert.deepEqual(malformed, []);
});

test("übernimmt Fondswechsel und Rebalancing aus älteren Profilen", () => {
  const setup = createSetup();
  delete setup.products[0].scenario.fundSwitchAges;
  delete setup.products[0].scenario.rebalancingBonus;
  setup.products[0].scenario.fundSwitchAge = 58;
  setup.products[0].scenario.fundSwitchPercentage = 75;
  setup.products[0].scenario.rebalancingReduction = 0.7;
  const legacyProfile = [{
    id: "profile-alt",
    name: "Altbestand",
    savedAt: "2026-09-30",
    setup,
  }];

  const [profile] = readProfiles(JSON.stringify(legacyProfile));

  assert.deepEqual(profile.setup.products[0].scenario.fundSwitchAges, [58]);
  assert.equal(profile.setup.products[0].scenario.rebalancingBonus, 0.7);
  assert.equal("fundSwitchPercentage" in profile.setup.products[0].scenario, false);
});

test("entfernt nur das gewählte Profil", () => {
  const setup = createSetup();
  const first = upsertProfile([], "Eins", setup, { id: "profile-1", savedAt: "2026-09-30" });
  const profiles = upsertProfile(first, "Zwei", setup, { id: "profile-2", savedAt: "2026-09-30" });

  assert.deepEqual(removeProfile(profiles, "profile-1").map((profile) => profile.name), ["Zwei"]);
  assert.deepEqual(cloneSetup(setup), setup);
});

test("überschreibt ein gespeichertes Profil mit dem aktuellen Setup", () => {
  const setup = createSetup();
  const profiles = upsertProfile([], "G's Vergleich", setup, {
    id: "profile-1",
    savedAt: "2026-10-01",
  });
  const currentSetup = createSetup();
  currentSetup.products[0].scenario.withdrawalAmount = 570;

  const overwritten = overwriteProfile(profiles, "profile-1", currentSetup, {
    savedAt: "2026-10-02",
  });

  assert.equal(overwritten.length, 1);
  assert.equal(overwritten[0].id, "profile-1");
  assert.equal(overwritten[0].name, "G's Vergleich");
  assert.equal(overwritten[0].setup.products[0].scenario.withdrawalAmount, 570);
  assert.equal(overwritten[0].savedAt, new Date("2026-10-02").toISOString());
});

test("berechnet ein gespeichertes Rentendepot nach dem Laden mit dem Ertragsanteil neu", () => {
  const setup = createSetup();
  setup.products[0] = {
    ...setup.products[0],
    initialCapital: 10_000,
    monthlyContribution: 0,
    annualReturn: 0,
    annualFee: 0,
    scenario: {
      ...setup.products[0].scenario,
      currentAge: 66,
      retirementAge: 67,
      lifeExpectancy: 68,
      statutoryPensionMonthly: 2_000,
      withdrawalAmount: 1_000,
      withdrawalFrequency: "yearly",
      inflationEnabled: false,
      rebalancingEnabled: false,
      fundSwitchEnabled: false,
      marginalTaxRate: 30,
      socialContributionsEnabled: false,
      solidarityEnabled: false,
    },
  };
  const saved = upsertProfile([], "Rentenprofil", setup, {
    id: "profile-rente",
    savedAt: "2026-10-13",
  });
  const [loaded] = readProfiles(serializeProfiles(saved));

  const result = calculatePlan(
    loaded.setup.products[0],
    loaded.setup.products[0].scenario,
  );

  assert.ok(result.grossWithdrawals > result.totalWithdrawals);
  assert.ok(result.estimatedTaxes > 0);
});
