import { normalizeProduct } from "./calculator.js";

const COLORS = ["#d34d6f", "#0f766e", "#3648a8"];
const DEFAULT_RETURNS = [6, 7, 8];
const MAX_PRODUCTS = 3;

export function createProducts(count = 2) {
  const safeCount = Math.min(MAX_PRODUCTS, Math.max(1, Math.round(Number(count) || 1)));
  return Array.from({ length: safeCount }, (_, index) => createProduct(index + 1));
}

export function addProduct(products) {
  if (products.length >= MAX_PRODUCTS) return products;
  const nextIndex = findAvailableIndex(products);
  return [...products, createProduct(nextIndex)];
}

export function removeProduct(products, productId) {
  if (products.length <= 1) return products;
  return products.filter((product) => product.id !== productId);
}

export function updateProduct(products, productId, changes) {
  return products.map((product) => {
    if (product.id !== productId) return product;
    const normalized = normalizeProduct({ ...product, ...changes });
    return { ...product, ...normalized };
  });
}

function createProduct(index) {
  return {
    id: `plan-${index}`,
    color: COLORS[index - 1],
    ...normalizeProduct({
      name: `ETF-Sparplan ${index}`,
      initialCapital: 5_000,
      monthlyContribution: 300,
      annualReturn: DEFAULT_RETURNS[index - 1],
      annualFee: 0.2,
    }),
  };
}

function findAvailableIndex(products) {
  for (let index = 1; index <= MAX_PRODUCTS; index += 1) {
    if (!products.some((product) => product.id === `plan-${index}`)) return index;
  }
  return MAX_PRODUCTS;
}
