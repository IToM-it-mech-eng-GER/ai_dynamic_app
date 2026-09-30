import assert from "node:assert/strict";
import test from "node:test";

import {
  addProduct,
  createProducts,
  removeProduct,
  updateProduct,
} from "../js/products.js";

test("erstellt ein bis drei voneinander unabhängige Produkte", () => {
  assert.equal(createProducts(0).length, 1);
  assert.equal(createProducts(2).length, 2);
  assert.equal(createProducts(5).length, 3);
  assert.notEqual(createProducts(2)[0].id, createProducts(2)[1].id);
});

test("fügt höchstens drei Produkte hinzu", () => {
  let products = createProducts(1);

  products = addProduct(products);
  products = addProduct(products);
  products = addProduct(products);

  assert.equal(products.length, 3);
});

test("entfernt Produkte, behält aber immer mindestens eines", () => {
  const products = createProducts(2);
  const reduced = removeProduct(products, products[0].id);
  const minimum = removeProduct(reduced, reduced[0].id);

  assert.equal(reduced.length, 1);
  assert.equal(minimum.length, 1);
});

test("ändert nur die Einstellungen des gewählten Produkts", () => {
  const products = createProducts(2);
  const updated = updateProduct(products, products[1].id, {
    name: "Mein Vergleich",
    annualReturn: 9,
  });

  assert.equal(updated[0].name, products[0].name);
  assert.equal(updated[1].name, "Mein Vergleich");
  assert.equal(updated[1].annualReturn, 9);
  assert.equal(updated[1].monthlyContribution, products[1].monthlyContribution);
});

test("speichert die sechs Szenarien unabhängig je Produkt", () => {
  const products = createProducts(2);
  const updated = updateProduct(products, products[1].id, {
    scenario: {
      ...products[1].scenario,
      currentAge: 45,
      withdrawalAmount: 2_000,
    },
  });

  assert.notEqual(products[0].scenario, products[1].scenario);
  assert.equal(updated[1].scenario.currentAge, 45);
  assert.equal(updated[1].scenario.withdrawalAmount, 2_000);
  assert.equal(updated[0].scenario.currentAge, products[0].scenario.currentAge);
  assert.equal(updated[0].scenario.withdrawalAmount, products[0].scenario.withdrawalAmount);
});
