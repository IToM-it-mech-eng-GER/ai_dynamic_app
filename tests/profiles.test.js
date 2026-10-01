import assert from "node:assert/strict";
import test from "node:test";

import {
  cloneSetup,
  readProfiles,
  removeProfile,
  serializeProfiles,
  normalizeProfileName,
  upsertProfile,
} from "../js/profiles.js";
import { createProducts } from "../js/products.js";

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

test("entfernt nur das gewählte Profil", () => {
  const setup = createSetup();
  const first = upsertProfile([], "Eins", setup, { id: "profile-1", savedAt: "2026-09-30" });
  const profiles = upsertProfile(first, "Zwei", setup, { id: "profile-2", savedAt: "2026-09-30" });

  assert.deepEqual(removeProfile(profiles, "profile-1").map((profile) => profile.name), ["Zwei"]);
  assert.deepEqual(cloneSetup(setup), setup);
});
