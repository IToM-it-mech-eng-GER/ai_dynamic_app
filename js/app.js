import {
  TAX_RULE_YEAR,
  calculatePlan,
  getPensionTaxableShare,
} from "./calculator.js";
import { renderChart } from "./chart.js";
import {
  addProduct,
  createProducts,
  removeProduct,
  updateProduct,
} from "./products.js";
import {
  getSwipeStep,
  moveWizardStep,
  normalizeScenario,
} from "./scenario.js";
import {
  PROFILE_STORAGE_KEY,
  cloneSetup,
  normalizeProfileName,
  readProfiles,
  removeProfile,
  serializeProfiles,
  upsertProfile,
} from "./profiles.js";

const STEP_NAMES = ["Persönlich", "Investment", "Entnahme", "Strategie", "Steuern", "Produktdetail"];
const STRING_SCENARIO_FIELDS = new Set([
  "depotType",
  "taxAssessment",
  "withdrawalFrequency",
  "withdrawalType",
]);
const money = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const elements = {
  addProduct: getElement("add-product"),
  chart: getElement("growth-chart"),
  chartDescription: getElement("chart-description"),
  chartRange: getElement("chart-range"),
  comparisonBody: getElement("comparison-body"),
  costPanel: getElement("cost-panel"),
  costTab: getElement("cost-tab"),
  dashboard: getElement("dashboard"),
  nextStep: getElement("next-step"),
  overviewPanel: getElement("overview-panel"),
  overviewTab: getElement("overview-tab"),
  profileEmpty: getElement("profile-empty"),
  profileForm: getElement("profile-form"),
  profileList: getElement("profile-list"),
  profileName: getElement("profile-name"),
  profilePanel: getElement("profile-panel"),
  profileStatus: getElement("profile-status"),
  profilesClose: getElement("profiles-close"),
  profilesToggle: getElement("profiles-toggle"),
  previousStep: getElement("previous-step"),
  pensionTaxShare: getElement("pension-tax-share"),
  personalTaxLabel: getElement("personal-tax-label"),
  privateTaxYear: getElement("private-tax-year"),
  productCards: getElement("product-cards"),
  productCount: getElement("product-count"),
  productTabs: getElement("product-tabs"),
  removeProduct: getElement("remove-product"),
  resetButton: getElement("reset-button"),
  saverAllowance: getElement("saver-allowance"),
  selectedPosition: getElement("selected-position"),
  settingsForm: getElement("settings-form"),
  settingsOpen: getElement("settings-open"),
  settingsPanel: getElement("settings-panel"),
  settingsToggle: getElement("settings-toggle"),
  stepName: getElement("step-name"),
  stepProgress: getElement("step-progress"),
  track: getElement("wizard-track"),
  viewport: getElement("wizard-viewport"),
  withdrawalUnit: getElement("withdrawal-unit"),
  withdrawalExplanation: getElement("withdrawal-explanation"),
};

const summaryElements = {
  contributions: getElement("summary-contributions"),
  costs: getElement("summary-costs"),
  ending: getElement("summary-ending"),
  grossReturn: getElement("summary-gross-return"),
  grossWithdrawals: getElement("summary-gross-withdrawals"),
  name: getElement("overview-product-name"),
  netWithdrawals: getElement("summary-net-withdrawals"),
  politicalImpact: getElement("political-impact"),
  taxes: getElement("summary-taxes"),
};

let state = createInitialState();
let swipeStart = null;

elements.settingsForm.addEventListener("submit", (event) => event.preventDefault());
elements.settingsForm.addEventListener("input", handleSettingsInput);
elements.settingsForm.addEventListener("change", () => render());
elements.productCards.addEventListener("click", handleProductChoice);
elements.productTabs.addEventListener("click", handleProductChoice);
elements.addProduct.addEventListener("click", handleAddProduct);
elements.removeProduct.addEventListener("click", handleRemoveProduct);
elements.previousStep.addEventListener("click", () => changeStep(-1, true));
elements.nextStep.addEventListener("click", handleNextStep);
elements.settingsToggle.addEventListener("click", () => setSettingsCollapsed(true));
elements.settingsOpen.addEventListener("click", () => setSettingsCollapsed(false));
elements.overviewTab.addEventListener("click", () => setDetailTab("overview"));
elements.costTab.addEventListener("click", () => setDetailTab("cost"));
elements.profilesToggle.addEventListener("click", () => setProfilesOpen(!state.profilesOpen));
elements.profilesClose.addEventListener("click", () => setProfilesOpen(false));
elements.profileForm.addEventListener("submit", handleProfileSave);
elements.profileList.addEventListener("click", handleProfileAction);
elements.viewport.addEventListener("pointerdown", handlePointerDown);
elements.viewport.addEventListener("pointerup", handlePointerUp);
elements.viewport.addEventListener("pointercancel", () => { swipeStart = null; });
elements.resetButton.addEventListener("click", () => {
  state = createInitialState();
  render();
});

render();

function createInitialState() {
  const products = createProducts(2);
  return {
    detailTab: "overview",
    products,
    profiles: readStoredProfiles(),
    profilesOpen: false,
    selectedId: products[0].id,
    settingsCollapsed: false,
    step: 0,
  };
}

function render({ syncInputs = true } = {}) {
  ensureSelection();
  const plans = state.products.map((product) => ({
    product,
    result: calculatePlan(product, product.scenario),
  }));

  renderProductCards(plans);
  renderProductTabs();
  renderComparison(plans);
  renderChart(elements.chart, plans);
  renderStatus(plans);
  renderWizard();
  renderDependencies();
  renderDetailTabs();
  renderPanelState();
  renderProfiles();

  if (syncInputs) syncForms(getSelectedProduct());
}

function renderProductCards(plans) {
  const bestIndex = plans.reduce(
    (best, plan, index) => plan.result.retirementBalance > plans[best].result.retirementBalance ? index : best,
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
    title.append(createElement("span", "color-dot", "", true), createElement("span", "", product.name));
    button.append(title);
    if (index === bestIndex && plans.length > 1) button.append(createElement("span", "best-label", "Höchster Wert"));
    button.append(
      createElement("span", "card-label", `Vermögen mit ${product.scenario.retirementAge}`),
      createElement("strong", "card-value", money.format(result.retirementBalance)),
      createCardMeta(result),
    );
    return button;
  });

  if (plans.length < 3) {
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "add-card";
    addButton.dataset.action = "add";
    addButton.append(createElement("span", "", "+", true), document.createTextNode("Produkt hinzufügen"));
    cards.push(addButton);
  }
  elements.productCards.replaceChildren(...cards);
}

function createCardMeta(result) {
  const meta = createElement("span", "card-meta");
  const contributions = createElement("span", "");
  const ending = createElement("span", "");
  contributions.append("Eingezahlt ", createElement("strong", "", money.format(result.totalContributions)));
  ending.append("Lebensende ", createElement("strong", "", money.format(result.endingBalance)));
  meta.append(contributions, ending);
  return meta;
}

function renderProductTabs() {
  const tabs = state.products.map((product, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "product-tab";
    button.dataset.productId = product.id;
    button.setAttribute("aria-pressed", String(product.id === state.selectedId));
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
    productLabel.append(createElement("span", `color-dot ${getColorClass(product)}`, "", true), product.name);
    productCell.append(productLabel);
    row.append(
      productCell,
      createElement("td", "", money.format(result.totalContributions)),
      createElement("td", "positive", money.format(result.retirementBalance)),
      createElement("td", "", money.format(result.totalWithdrawals)),
      createElement("td", "", money.format(result.endingBalance)),
    );
    return row;
  });
  elements.comparisonBody.replaceChildren(...rows);
}

function renderStatus(plans) {
  const selectedIndex = state.products.findIndex((product) => product.id === state.selectedId);
  const selectedPlan = plans[selectedIndex];
  const result = selectedPlan.result;
  elements.productCount.textContent = String(state.products.length);
  elements.selectedPosition.textContent = `Produkt ${selectedIndex + 1} von ${state.products.length}`;
  elements.chartRange.textContent = `${getSelectedScenario().currentAge} bis ${result.endAge} Jahre`;
  elements.removeProduct.disabled = state.products.length === 1;
  elements.addProduct.disabled = state.products.length === 3;
  elements.chartDescription.textContent = plans
    .map(({ product, result: planResult }) => `${product.name}: ${money.format(planResult.retirementBalance)} zum Rentenbeginn und ${money.format(planResult.endingBalance)} am Modellende.`)
    .join(" ");

  summaryElements.name.textContent = selectedPlan.product.name;
  summaryElements.contributions.textContent = money.format(result.totalContributions);
  summaryElements.grossReturn.textContent = formatSignedMoney(
    result.grossEndingBalance + result.grossWithdrawals - result.totalContributions,
  );
  summaryElements.costs.textContent = formatNegativeMoney(result.totalCosts);
  summaryElements.netWithdrawals.textContent = money.format(result.totalWithdrawals);
  summaryElements.grossWithdrawals.textContent = money.format(result.grossWithdrawals);
  summaryElements.taxes.textContent = formatNegativeMoney(result.estimatedTaxes);
  summaryElements.ending.textContent = money.format(result.netEndingBalance);
  summaryElements.politicalImpact.textContent = formatNegativeMoney(result.estimatedTaxes);
}

function renderWizard() {
  elements.track.style.transform = `translateX(-${state.step * 100}%)`;
  const steps = [...elements.track.querySelectorAll(".wizard-step")];
  steps.forEach((step, index) => {
    const inactive = index !== state.step;
    step.setAttribute("aria-hidden", String(inactive));
    step.inert = inactive;
  });
  elements.previousStep.disabled = state.step === 0;
  elements.nextStep.querySelector("span").textContent = state.step === 5 ? "✓" : "›";
  elements.nextStep.setAttribute("aria-label", state.step === 5 ? "Eingaben schließen" : "Nächster Schritt");
  elements.stepProgress.textContent = `Schritt ${state.step + 1} von 6`;
  elements.stepName.textContent = STEP_NAMES[state.step];
}

function renderDependencies() {
  const scenario = getSelectedScenario();
  document.querySelectorAll("[data-dependent], [data-depot-mode]").forEach((container) => {
    const dependencyMatches = !container.dataset.dependent
      || Boolean(scenario[container.dataset.dependent]);
    const depotMatches = !container.dataset.depotMode
      || container.dataset.depotMode === scenario.depotType;
    const visible = dependencyMatches && depotMatches;
    container.hidden = !visible;
    container.inert = !visible;
  });
  const retirementStartYear = TAX_RULE_YEAR + scenario.retirementAge - scenario.currentAge;
  const pensionTaxableShare = getPensionTaxableShare(retirementStartYear);
  const saverAllowanceMaximum = scenario.depotType === "private"
    ? (scenario.taxAssessment === "joint" ? 2_000 : 1_000)
    : 2_000;
  elements.saverAllowance.max = String(saverAllowanceMaximum);
  elements.saverAllowance.value = String(scenario.saverAllowance);
  elements.privateTaxYear.textContent = `Rentenbeginn ${retirementStartYear}`;
  elements.pensionTaxShare.textContent = `${pensionTaxableShare.toLocaleString("de-DE")} % Rentenanteil steuerpflichtig`;
  elements.personalTaxLabel.textContent = scenario.depotType === "private"
    ? "Günstigerprüfung anwenden"
    : "Persönlicher Steuersatz";
  elements.withdrawalExplanation.textContent = scenario.depotType === "private"
    ? "Die Nettoentnahme bleibt das Ziel. Steuern erhöhen den nötigen Bruttoverkauf und beschleunigen den Kapitalverbrauch."
    : "Die Entnahme reduziert das Depot in gleicher Höhe.";
  elements.withdrawalUnit.textContent = scenario.withdrawalType === "percent" ? "%" : "€";
}

function renderDetailTabs() {
  const overviewActive = state.detailTab === "overview";
  elements.overviewTab.setAttribute("aria-selected", String(overviewActive));
  elements.costTab.setAttribute("aria-selected", String(!overviewActive));
  elements.overviewPanel.hidden = !overviewActive;
  elements.costPanel.hidden = overviewActive;
}

function renderPanelState() {
  elements.dashboard.classList.toggle("is-settings-collapsed", state.settingsCollapsed);
  elements.settingsPanel.hidden = state.settingsCollapsed;
  elements.settingsPanel.inert = state.settingsCollapsed;
  elements.settingsOpen.hidden = !state.settingsCollapsed;
  elements.settingsToggle.setAttribute("aria-expanded", String(!state.settingsCollapsed));
}

function renderProfiles() {
  elements.profilePanel.hidden = !state.profilesOpen;
  elements.profilesToggle.setAttribute("aria-expanded", String(state.profilesOpen));
  elements.profileList.replaceChildren(...state.profiles.map(createProfileItem));
  elements.profileEmpty.hidden = state.profiles.length > 0;
}

function createProfileItem(profile) {
  const item = createElement("article", "profile-item");
  const heading = createElement("div", "profile-item-heading");
  heading.append(
    createElement("strong", "", profile.name),
    createElement("time", "", formatProfileDate(profile.savedAt)),
  );
  const details = createElement(
    "p",
    "",
    `${profile.setup.products.length} Produkte · Alter ${profile.setup.products[0].scenario.currentAge}`,
  );
  const actions = createElement("div", "profile-item-actions");
  const loadButton = createElement("button", "profile-action primary", "Laden");
  loadButton.type = "button";
  loadButton.dataset.profileAction = "load";
  loadButton.dataset.profileId = profile.id;
  const deleteButton = createElement("button", "profile-action", "Löschen");
  deleteButton.type = "button";
  deleteButton.dataset.profileAction = "delete";
  deleteButton.dataset.profileId = profile.id;
  actions.append(loadButton, deleteButton);
  item.append(heading, details, actions);
  return item;
}

function handleProfileSave(event) {
  event.preventDefault();
  const name = normalizeProfileName(elements.profileName.value);
  if (!name) {
    elements.profileStatus.textContent = "Bitte einen Profilnamen eingeben.";
    elements.profileName.focus();
    return;
  }

  state.profiles = upsertProfile(state.profiles, name, createSetupSnapshot());
  if (!persistProfiles(state.profiles)) return;
  elements.profileName.value = "";
  elements.profileStatus.textContent = `„${name}“ gespeichert.`;
  renderProfiles();
}

function handleProfileAction(event) {
  const button = event.target.closest("button[data-profile-action]");
  if (!button) return;
  const profile = state.profiles.find((item) => item.id === button.dataset.profileId);
  if (!profile) return;

  if (button.dataset.profileAction === "load") {
    const setup = cloneSetup(profile.setup);
    state.products = setup.products;
    state.selectedId = setup.selectedId;
    state.step = 0;
    state.detailTab = "overview";
    state.profilesOpen = false;
    elements.profileStatus.textContent = `„${profile.name}“ geladen.`;
    render();
    return;
  }

  state.profiles = removeProfile(state.profiles, profile.id);
  if (!persistProfiles(state.profiles)) return;
  elements.profileStatus.textContent = `„${profile.name}“ gelöscht.`;
  renderProfiles();
}

function createSetupSnapshot() {
  return cloneSetup({
    products: state.products,
    selectedId: state.selectedId,
  });
}

function setProfilesOpen(open) {
  state.profilesOpen = open;
  renderProfiles();
  if (open) elements.profileName.focus();
}

function readStoredProfiles() {
  try {
    return readProfiles(window.localStorage.getItem(PROFILE_STORAGE_KEY));
  } catch {
    return [];
  }
}

function persistProfiles(profiles) {
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, serializeProfiles(profiles));
    return true;
  } catch {
    elements.profileStatus.textContent = "Profile konnten lokal nicht gespeichert werden.";
    return false;
  }
}

function formatProfileDate(value) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
}

function syncForms(product) {
  const scenario = product.scenario;
  document.querySelectorAll("[data-product-field]").forEach((field) => {
    field.value = String(product[field.dataset.productField]);
  });
  document.querySelectorAll("[data-scenario-field]").forEach((field) => {
    const value = scenario[field.dataset.scenarioField];
    if (field instanceof HTMLInputElement && field.type === "checkbox") field.checked = value;
    else if (field instanceof HTMLInputElement && field.type === "radio") field.checked = field.value === value;
    else field.value = String(value);
  });
}

function handleSettingsInput(event) {
  const field = event.target;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) return;
  const productKey = field.dataset.productField;
  const scenarioKey = field.dataset.scenarioField;

  if (productKey) {
    const value = productKey === "name" ? field.value : field.valueAsNumber;
    state.products = updateProduct(state.products, state.selectedId, { [productKey]: value });
  }
  if (scenarioKey) {
    const value = readScenarioField(field, scenarioKey);
    const selectedProduct = getSelectedProduct();
    const scenario = normalizeScenario({ ...selectedProduct.scenario, [scenarioKey]: value });
    state.products = updateProduct(state.products, state.selectedId, { scenario });
  }
  render({ syncInputs: false });
}

function readScenarioField(field, key) {
  if (field instanceof HTMLInputElement && field.type === "checkbox") return field.checked;
  if (STRING_SCENARIO_FIELDS.has(key)) return field.value;
  return field instanceof HTMLInputElement ? field.valueAsNumber : Number(field.value);
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

function handleNextStep() {
  if (state.step === 5) {
    setSettingsCollapsed(true);
    return;
  }
  changeStep(1, true);
}

function changeStep(direction, focusHeading = false) {
  const nextStep = moveWizardStep(state.step, direction);
  if (nextStep === state.step) return;
  state.step = nextStep;
  renderWizard();
  if (focusHeading) {
    elements.track.querySelector(`[data-step="${state.step}"] h3`).focus({ preventScroll: true });
  }
}

function setSettingsCollapsed(collapsed) {
  state.settingsCollapsed = collapsed;
  renderPanelState();
  if (!collapsed) elements.settingsToggle.focus();
}

function setDetailTab(tab) {
  state.detailTab = tab;
  renderDetailTabs();
}

function handlePointerDown(event) {
  if (event.target.closest("input, select, button, label, summary")) return;
  swipeStart = { x: event.clientX, y: event.clientY };
}

function handlePointerUp(event) {
  if (!swipeStart) return;
  const direction = getSwipeStep(event.clientX - swipeStart.x, event.clientY - swipeStart.y);
  swipeStart = null;
  if (direction) changeStep(direction);
}

function ensureSelection() {
  if (!state.products.some((product) => product.id === state.selectedId)) state.selectedId = state.products[0].id;
}

function getSelectedProduct() {
  return state.products.find((product) => product.id === state.selectedId);
}

function getSelectedScenario() {
  return getSelectedProduct().scenario;
}

function getColorClass(product) {
  return `color-${product.id.at(-1)}`;
}

function formatSignedMoney(value) {
  return `${value < 0 ? "−" : "+"}${money.format(Math.abs(value))}`;
}

function formatNegativeMoney(value) {
  return value > 0 ? `−${money.format(value)}` : money.format(0);
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
