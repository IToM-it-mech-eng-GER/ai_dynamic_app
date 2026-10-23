import { ANALYSIS_API_BASE_URL } from "./analysis-config.js?v=api1";
import { renderAnalysisChart } from "./analysis-chart.js";
import {
  ANALYSIS_STORAGE_KEY,
  createAnalysisSecurity,
  getAnalysisColor,
  getAnalysisColorIndex,
  getFiveYearFundamentals,
  mergeAnalysisSecurityData,
  normalizeWkn,
  readAnalysisState,
  serializeAnalysisState,
  setSecurityActive,
} from "./analysis-model.js";

const PASSWORD_HASH = "d82494f05d6917ba02f7aaa29689ccb444bb73f20380876cb05d1f37537b7892";
const CACHE_AGE_MS = 24 * 60 * 60 * 1000;

const METRICS = [
  { key: "revenue", label: "Umsatz", format: "money" },
  { key: "operatingIncome", label: "Operatives Ergebnis", format: "money" },
  { key: "freeCashFlow", label: "Freier Cashflow", format: "money" },
  { key: "ebitdaMargin", label: "EBITDA-Marge", format: "percent" },
  { key: "totalAssets", label: "Bilanzsumme", format: "money" },
  { key: "priceToSales", label: "Kurs-Umsatz-Verhältnis", format: "ratio" },
  { key: "cash", label: "Liquide Mittel", format: "money" },
  { key: "debt", label: "Schulden", format: "money" },
];

const elements = {
  main: document.querySelector("#analysis-main"),
  login: document.querySelector("#analysis-login"),
  loginForm: document.querySelector("#analysis-login-form"),
  password: document.querySelector("#analysis-password"),
  loginError: document.querySelector("#analysis-login-error"),
  addButton: document.querySelector("#analysis-add"),
  addDialog: document.querySelector("#analysis-add-dialog"),
  addForm: document.querySelector("#analysis-add-form"),
  addClose: document.querySelector("#analysis-add-close"),
  addCancel: document.querySelector("#analysis-add-cancel"),
  addSubmit: document.querySelector("#analysis-add-submit"),
  addError: document.querySelector("#analysis-add-error"),
  wkn: document.querySelector("#analysis-wkn"),
  purchaseDate: document.querySelector("#analysis-purchase-date"),
  purchasePrice: document.querySelector("#analysis-purchase-price"),
  quantity: document.querySelector("#analysis-quantity"),
  status: document.querySelector("#analysis-status"),
  products: document.querySelector("#analysis-products"),
  empty: document.querySelector("#analysis-empty"),
  count: document.querySelector("#analysis-count"),
  chart: document.querySelector("#analysis-chart"),
  chartLegend: document.querySelector("#analysis-chart-legend"),
  chartDescription: document.querySelector("#analysis-chart-description"),
  fundamentals: document.querySelector("#fundamentals-grid"),
};

let state = readAnalysisState(localStorage.getItem(ANALYSIS_STORAGE_KEY));

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

async function hashText(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function saveState() {
  localStorage.setItem(ANALYSIS_STORAGE_KEY, serializeAnalysisState(state));
}

function setStatus(message, kind = "") {
  elements.status.textContent = message;
  elements.status.dataset.kind = kind;
}

function formatMoney(value, compact = false, currency = "EUR") {
  if (!Number.isFinite(value)) return "–";
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: /^[A-Z]{3}$/.test(currency) ? currency : "EUR",
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("de-DE", { maximumFractionDigits: compact ? 1 : 2 }).format(value);
  }
}

function formatMetric(value, format, currency) {
  if (!Number.isFinite(value)) return "–";
  if (format === "percent") return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value)} %`;
  if (format === "ratio") return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value);
  return formatMoney(value, true, currency);
}

function formatDate(value) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("de-DE").format(new Date(`${value}T00:00:00Z`));
}

function formatQuantity(value) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 6 }).format(value);
}

function isFresh(security) {
  const fetchedAt = Date.parse(security.fetchedAt);
  return Number.isFinite(fetchedAt) && Date.now() - fetchedAt < CACHE_AGE_MS;
}

function findCachedSecurity(wkn) {
  return state.securities.find((security) =>
    security.wkn === wkn
    && isFresh(security)
    && security.prices.length > 0
    && security.warnings.length === 0,
  );
}

async function fetchAsset(wkn) {
  if (!ANALYSIS_API_BASE_URL) {
    throw new Error("Der Online-Datendienst ist noch nicht verbunden.");
  }

  const url = new URL("asset", `${ANALYSIS_API_BASE_URL.replace(/\/$/, "")}/`);
  url.searchParams.set("wkn", wkn);
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Die Marktdaten konnten nicht geladen werden.");
  return payload;
}

function createButton(label, className, action, id) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.dataset.action = action;
  button.dataset.id = id;
  button.textContent = label;
  return button;
}

function renderProducts() {
  elements.products.replaceChildren();
  elements.empty.hidden = state.securities.length > 0;
  elements.count.textContent = `${state.securities.length} ${state.securities.length === 1 ? "Produkt" : "Produkte"}`;

  state.securities.forEach((security) => {
    const card = document.createElement("article");
    card.className = `analysis-product-card analysis-color-${getAnalysisColorIndex(security.color)}`;

    const top = document.createElement("div");
    top.className = "analysis-product-top";
    const identity = document.createElement("div");
    const name = document.createElement("h3");
    name.textContent = security.instrument.name || security.wkn;
    const details = document.createElement("p");
    details.textContent = [security.wkn, security.instrument.symbol, security.instrument.type].filter(Boolean).join(" · ");
    identity.append(name, details);

    const activeLabel = document.createElement("label");
    activeLabel.className = "analysis-active-toggle";
    const activeText = document.createElement("span");
    activeText.textContent = "Aktiv";
    const activeInput = document.createElement("input");
    activeInput.type = "checkbox";
    activeInput.checked = security.active;
    activeInput.dataset.action = "toggle";
    activeInput.dataset.id = security.id;
    const switchElement = document.createElement("i");
    activeLabel.append(activeText, activeInput, switchElement);
    top.append(identity, activeLabel);

    const meta = document.createElement("dl");
    [
      ["Kaufdatum", formatDate(security.purchaseDate)],
      ["Kaufpreis", formatMoney(security.purchasePrice)],
      ["Anteile / Aktien", formatQuantity(security.quantity)],
      ["Letzter Kurs", security.prices.length ? formatMoney(security.prices.at(-1).close, false, security.instrument.currency) : "–"],
    ].forEach(([term, value]) => {
      const wrapper = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = term;
      dd.textContent = value;
      wrapper.append(dt, dd);
      meta.append(wrapper);
    });

    const actions = document.createElement("div");
    actions.className = "analysis-product-actions";
    actions.append(
      createButton("Aktualisieren", "analysis-card-button", "refresh", security.id),
      createButton("Entfernen", "analysis-card-button danger", "remove", security.id),
    );

    const dataSummary = document.createElement("p");
    dataSummary.className = "analysis-data-summary";
    dataSummary.textContent = `${security.prices.length} Kurswerte · ${security.fundamentals.length} Geschäftsjahre`;

    const warning = document.createElement("p");
    warning.className = "analysis-data-warning";
    warning.hidden = security.warnings.length === 0;
    warning.textContent = security.warnings.length
      ? `Teildaten gespeichert: ${security.warnings.join(" ")}`
      : "";

    const updated = document.createElement("p");
    updated.className = "analysis-updated";
    updated.textContent = security.fetchedAt
      ? `Datenstand ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(security.fetchedAt))}`
      : "Noch kein Datenabruf";

    card.append(top, meta, dataSummary, warning, actions, updated);
    elements.products.append(card);
  });
}

function renderMetricChart(metric, reports, color, currency) {
  const panel = document.createElement("section");
  panel.className = "fundamental-metric";
  const heading = document.createElement("h4");
  heading.textContent = metric.label;
  panel.append(heading);

  const validValues = reports.map((report) => report[metric.key]).filter(Number.isFinite);
  if (!validValues.length) {
    const unavailable = document.createElement("p");
    unavailable.className = "fundamental-unavailable";
    unavailable.textContent = "Nicht verfügbar";
    panel.append(unavailable);
    return panel;
  }

  const maxValue = Math.max(...validValues.map(Math.abs), 1);
  const bars = document.createElement("div");
  bars.className = "fundamental-bars";
  reports.forEach((report) => {
    const column = document.createElement("div");
    column.className = "fundamental-column";
    const value = report[metric.key];
    const label = document.createElement("span");
    label.className = "fundamental-value";
    label.textContent = formatMetric(value, metric.format, currency);
    const track = document.createElement("div");
    track.className = "fundamental-track";
    const bar = document.createElement("i");
    const height = Number.isFinite(value) ? Math.max(5, Math.abs(value) / maxValue * 100) : 0;
    bar.classList.add(`analysis-bar-level-${Math.round(height / 5)}`);
    bar.classList.add(`analysis-color-${getAnalysisColorIndex(color)}`);
    if (value < 0) bar.classList.add("negative");
    track.append(bar);
    const year = document.createElement("span");
    year.className = "fundamental-year";
    year.textContent = String(report.year);
    column.append(label, track, year);
    bars.append(column);
  });
  panel.append(bars);
  return panel;
}

function renderFundamentals() {
  elements.fundamentals.replaceChildren();
  state.securities.forEach((security) => {
    const reports = getFiveYearFundamentals(security.fundamentals);
    const product = document.createElement("article");
    product.className = `fundamental-product analysis-color-${getAnalysisColorIndex(security.color)}`;
    const heading = document.createElement("div");
    heading.className = "fundamental-product-heading";
    const name = document.createElement("h3");
    name.textContent = security.instrument.name || security.wkn;
    const subline = document.createElement("p");
    subline.textContent = reports.length
      ? `${reports[0].year} bis ${reports.at(-1).year}`
      : "Für dieses Wertpapier sind keine Fundamentaldaten verfügbar.";
    heading.append(name, subline);
    product.append(heading);

    const metrics = document.createElement("div");
    metrics.className = "fundamental-metrics";
    METRICS.forEach((metric) => metrics.append(renderMetricChart(metric, reports, security.color, security.instrument.currency)));
    product.append(metrics);
    elements.fundamentals.append(product);
  });
}

function render() {
  state.securities.forEach((security, index) => {
    if (!security.color) security.color = getAnalysisColor(index);
  });
  renderProducts();
  renderAnalysisChart(elements.chart, elements.chartLegend, elements.chartDescription, state.securities);
  renderFundamentals();
}

async function addSecurity(event) {
  event.preventDefault();
  elements.addError.textContent = "";
  const wkn = normalizeWkn(elements.wkn.value);
  const purchasePrice = Number(elements.purchasePrice.value);
  const quantity = Number(elements.quantity.value);
  const purchaseDate = elements.purchaseDate.value;

  if (!wkn) {
    elements.addError.textContent = "Bitte eine gültige sechsstellige WKN eingeben.";
    return;
  }
  if (!purchaseDate || !Number.isFinite(purchasePrice) || purchasePrice <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
    elements.addError.textContent = "Bitte Kaufdatum, einen positiven Kaufpreis und eine positive Stückzahl angeben.";
    return;
  }

  elements.addSubmit.disabled = true;
  elements.addSubmit.textContent = "Daten werden geladen …";
  try {
    const cached = findCachedSecurity(wkn);
    const remote = cached || await fetchAsset(wkn);
    const security = createAnalysisSecurity({
      id: crypto.randomUUID(),
      wkn,
      purchaseDate,
      purchasePrice,
      quantity,
      active: true,
      color: getAnalysisColor(state.securities.length),
      fetchedAt: cached?.fetchedAt || remote.fetchedAt || new Date().toISOString(),
      instrument: remote.instrument,
      prices: remote.prices,
      fundamentals: remote.fundamentals,
      warnings: remote.warnings,
    });
    state.securities.push(security);
    saveState();
    render();
    elements.addForm.reset();
    closeDialog(elements.addDialog);
    setStatus(
      cached
        ? "Gespeicherte Daten wurden wiederverwendet."
        : security.warnings.length
          ? "Alle verfügbaren Teildaten wurden lokal gespeichert. Fehlende Werte können ergänzt werden."
          : "Wertpapierdaten wurden geladen und lokal gespeichert.",
      "success",
    );
  } catch (error) {
    elements.addError.textContent = error instanceof Error ? error.message : "Die Daten konnten nicht geladen werden.";
  } finally {
    elements.addSubmit.disabled = false;
    elements.addSubmit.textContent = "Abrufen & hinzufügen";
  }
}

async function refreshSecurity(security) {
  setStatus(`Daten für ${security.instrument.name || security.wkn} werden aktualisiert …`);
  try {
    const remote = await fetchAsset(security.wkn);
    state.securities = state.securities.map((entry) => entry.id === security.id
      ? mergeAnalysisSecurityData(entry, {
          ...remote,
          fetchedAt: remote.fetchedAt || new Date().toISOString(),
        })
      : entry);
    saveState();
    render();
    setStatus(
      remote.warnings?.length
        ? "Neue Teildaten wurden ergänzt. Fehlende Werte bleiben zur Bearbeitung offen."
        : "Die Wertpapierdaten wurden aktualisiert.",
      "success",
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Die Aktualisierung ist fehlgeschlagen.", "error");
  }
}

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const valid = await hashText(elements.password.value) === PASSWORD_HASH;
  elements.password.value = "";
  if (!valid) {
    elements.loginError.textContent = "Das Passwort ist nicht korrekt.";
    elements.password.focus();
    return;
  }
  elements.loginError.textContent = "";
  closeDialog(elements.login);
  elements.main.hidden = false;
  render();
  elements.main.focus();
});

elements.addButton.addEventListener("click", () => {
  elements.addError.textContent = "";
  elements.purchaseDate.max = new Date().toISOString().slice(0, 10);
  openDialog(elements.addDialog);
  elements.wkn.focus();
});
elements.addClose.addEventListener("click", () => closeDialog(elements.addDialog));
elements.addCancel.addEventListener("click", () => closeDialog(elements.addDialog));
elements.addForm.addEventListener("submit", addSecurity);

elements.products.addEventListener("change", (event) => {
  const input = event.target.closest('[data-action="toggle"]');
  if (!input) return;
  state.securities = setSecurityActive(state.securities, input.dataset.id, input.checked);
  saveState();
  render();
});

elements.products.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const security = state.securities.find((entry) => entry.id === button.dataset.id);
  if (!security) return;
  if (button.dataset.action === "refresh") refreshSecurity(security);
  if (button.dataset.action === "remove" && window.confirm("Dieses Wertpapier und seine gespeicherten Daten entfernen?")) {
    state.securities = state.securities.filter((entry) => entry.id !== security.id);
    saveState();
    render();
    setStatus("Das Wertpapier wurde entfernt.", "success");
  }
});

openDialog(elements.login);
elements.password.focus();
