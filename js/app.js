import { calculatePlan, normalizeHorizon } from "./calculator.js";
import { renderChart } from "./chart.js";
import {
  addProduct,
  createProducts,
  removeProduct,
  updateProduct,
} from "./products.js";

const money = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const percent = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

const elements = {
  addProduct: getElement("add-product"),
  chart: getElement("growth-chart"),
  chartDescription: getElement("chart-description"),
  chartYears: getElement("chart-years"),
  comparisonBody: getElement("comparison-body"),
  form: getElement("product-form"),
  horizonInput: getElement("horizon-input"),
  horizonOutput: getElement("horizon-output"),
  productCards: getElement("product-cards"),
  productCount: getElement("product-count"),
  productTabs: getElement("product-tabs"),
  removeProduct: getElement("remove-product"),
  resetButton: getElement("reset-button"),
  selectedPosition: getElement("selected-position"),
};

const fields = {
  name: getElement("product-name"),
  initialCapital: getElement("initial-capital"),
  monthlyContribution: getElement("monthly-contribution"),
  annualReturn: getElement("annual-return"),
  annualFee: getElement("annual-fee"),
};

let state = createInitialState();

elements.form.addEventListener("submit", (event) => event.preventDefault());
elements.form.addEventListener("input", handleProductInput);
elements.form.addEventListener("change", () => syncForm(getSelectedProduct()));
elements.horizonInput.addEventListener("input", handleHorizonInput);
elements.productCards.addEventListener("click", handleProductChoice);
elements.productTabs.addEventListener("click", handleProductChoice);
elements.addProduct.addEventListener("click", handleAddProduct);
elements.removeProduct.addEventListener("click", handleRemoveProduct);
elements.resetButton.addEventListener("click", () => {
  state = createInitialState();
  render();
});

render();

function createInitialState() {
  const products = createProducts(2);
  return {
    horizon: 30,
    products,
    selectedId: products[0].id,
  };
}

function render({ syncInputs = true } = {}) {
  ensureSelection();
  const plans = state.products.map((product) => ({
    product,
    result: calculatePlan(product, state.horizon),
  }));

  renderProductCards(plans);
  renderProductTabs();
  renderComparison(plans);
  renderChart(elements.chart, plans, state.horizon);
  renderStatus(plans);

  if (syncInputs) syncForm(getSelectedProduct());
}

function renderProductCards(plans) {
  const bestIndex = plans.reduce(
    (best, plan, index) => plan.result.endingBalance > plans[best].result.endingBalance ? index : best,
    0,
  );
  const cards = plans.map(({ product, result }, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `product-card ${getColorClass(product)}`;
    button.dataset.productId = product.id;
    button.setAttribute("aria-pressed", String(product.id === state.selectedId));
    button.setAttribute("aria-label", `${product.name} bearbeiten`);
    if (index === bestIndex && plans.length > 1) button.classList.add("is-best");

    const title = createElement("span", "card-title");
    title.append(
      createElement("span", "color-dot", "", true),
      createElement("span", "", product.name),
    );
    button.append(title);
    if (button.classList.contains("is-best")) {
      button.append(createElement("span", "best-label", "Höchster Wert"));
    }
    button.append(
      createElement("span", "card-label", `Endvermögen nach ${state.horizon} Jahren`),
      createElement("strong", "card-value", money.format(result.endingBalance)),
      createMeta(result),
    );
    return button;
  });

  if (plans.length < 3) {
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "add-card";
    addButton.dataset.action = "add";
    addButton.setAttribute("aria-label", "Weiteres Produkt hinzufügen");
    addButton.append(
      createElement("span", "", "+", true),
      document.createTextNode("Produkt hinzufügen"),
    );
    cards.push(addButton);
  }

  elements.productCards.replaceChildren(...cards);
}

function createMeta(result) {
  const meta = createElement("span", "card-meta");
  const contributions = createElement("span", "");
  const gain = createElement("span", result.totalGain < 0 ? "negative" : "positive");
  contributions.append("Eingezahlt ", createElement("strong", "", money.format(result.totalContributions)));
  gain.append("Zuwachs ", createElement("strong", "", formatSignedMoney(result.totalGain)));
  meta.append(contributions, gain);
  return meta;
}

function renderProductTabs() {
  const tabs = state.products.map((product, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "product-tab";
    button.dataset.productId = product.id;
    button.setAttribute("aria-pressed", String(product.id === state.selectedId));
    button.setAttribute("aria-label", `${product.name} auswählen`);
    button.textContent = `Plan ${index + 1}`;
    return button;
  });
  elements.productTabs.replaceChildren(...tabs);
}

function renderComparison(plans) {
  const rows = plans.map(({ product, result }) => {
    const row = document.createElement("tr");
    const productCell = document.createElement("td");
    const productLabel = createElement("span", "table-product");
    const dot = createElement("span", `color-dot ${getColorClass(product)}`, "", true);
    productLabel.append(dot, product.name);
    productCell.append(productLabel);

    row.append(
      productCell,
      createElement("td", "", money.format(result.totalContributions)),
      createElement("td", result.totalGain < 0 ? "negative" : "positive", formatSignedMoney(result.totalGain)),
      createElement("td", "", money.format(result.endingBalance)),
      createElement("td", "", `${percent.format(result.netAnnualReturn)} %`),
    );
    return row;
  });
  elements.comparisonBody.replaceChildren(...rows);
}

function renderStatus(plans) {
  const selectedIndex = state.products.findIndex((product) => product.id === state.selectedId);
  elements.productCount.textContent = String(state.products.length);
  elements.selectedPosition.textContent = `${selectedIndex + 1} von ${state.products.length}`;
  elements.chartYears.textContent = String(state.horizon);
  elements.horizonInput.value = String(state.horizon);
  elements.horizonOutput.textContent = state.horizon === 1 ? "1 Jahr" : `${state.horizon} Jahre`;
  elements.removeProduct.disabled = state.products.length === 1;
  elements.addProduct.disabled = state.products.length === 3;
  elements.chartDescription.textContent = plans
    .map(({ product, result }) => `${product.name}: ${money.format(result.endingBalance)} Endvermögen.`)
    .join(" ");
}

function syncForm(product) {
  for (const [key, field] of Object.entries(fields)) {
    field.value = String(product[key]);
  }
}

function handleProductInput(event) {
  const field = event.target;
  if (!(field instanceof HTMLInputElement) || !field.name) return;
  const value = field.name === "name" ? field.value : field.valueAsNumber;
  state.products = updateProduct(state.products, state.selectedId, {
    [field.name]: value,
  });
  render({ syncInputs: false });
}

function handleHorizonInput(event) {
  state.horizon = normalizeHorizon(event.target.valueAsNumber);
  render({ syncInputs: false });
}

function handleProductChoice(event) {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.action === "add") {
    handleAddProduct();
    return;
  }
  if (!button.dataset.productId) return;
  state.selectedId = button.dataset.productId;
  render();
}

function handleAddProduct() {
  const products = addProduct(state.products);
  if (products === state.products) return;
  state.products = products;
  state.selectedId = products.at(-1).id;
  render();
}

function handleRemoveProduct() {
  const products = removeProduct(state.products, state.selectedId);
  if (products === state.products) return;
  state.products = products;
  state.selectedId = products[0].id;
  render();
}

function ensureSelection() {
  if (!state.products.some((product) => product.id === state.selectedId)) {
    state.selectedId = state.products[0].id;
  }
}

function getSelectedProduct() {
  return state.products.find((product) => product.id === state.selectedId);
}

function getColorClass(product) {
  return `color-${product.id.at(-1)}`;
}

function formatSignedMoney(value) {
  const formatted = money.format(Math.abs(value));
  return `${value < 0 ? "−" : "+"}${formatted}`;
}

function createElement(tagName, className = "", text = "", hidden = false) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text) element.textContent = text;
  if (hidden) element.setAttribute("aria-hidden", "true");
  return element;
}

function getElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Element #${id} fehlt.`);
  return element;
}
