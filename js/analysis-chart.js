import { buildStackedSeries, getAnalysisColorIndex } from "./analysis-model.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const WIDTH = 1040;
const HEIGHT = 460;
const MARGIN = { top: 24, right: 28, bottom: 54, left: 76 };

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NAMESPACE, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function formatMoney(value) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("de-DE", { month: "short", year: "numeric" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

function scaleDate(date, firstDate, lastDate) {
  const first = Date.parse(firstDate);
  const last = Date.parse(lastDate);
  const current = Date.parse(date);
  const width = WIDTH - MARGIN.left - MARGIN.right;
  return MARGIN.left + ((current - first) / Math.max(1, last - first)) * width;
}

function scaleValue(value, maxValue) {
  const height = HEIGHT - MARGIN.top - MARGIN.bottom;
  return MARGIN.top + height - (value / Math.max(1, maxValue)) * height;
}

function buildAreaPath(points, firstDate, lastDate, maxValue) {
  if (!points.length) return "";
  const top = points.map((point, index) => {
    const command = index === 0 ? "M" : "L";
    return `${command}${scaleDate(point.date, firstDate, lastDate).toFixed(2)},${scaleValue(point.top, maxValue).toFixed(2)}`;
  });
  const base = points
    .slice()
    .reverse()
    .map((point) => `L${scaleDate(point.date, firstDate, lastDate).toFixed(2)},${scaleValue(point.base, maxValue).toFixed(2)}`);
  return [...top, ...base, "Z"].join(" ");
}

function buildLinePath(points, firstDate, lastDate, maxValue) {
  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command}${scaleDate(point.date, firstDate, lastDate).toFixed(2)},${scaleValue(point.top, maxValue).toFixed(2)}`;
    })
    .join(" ");
}

export function renderAnalysisChart(svg, legend, description, securities) {
  svg.replaceChildren();
  legend.replaceChildren();
  const chart = buildStackedSeries(securities);

  if (chart.dates.length === 0) {
    const empty = svgElement("text", { x: WIDTH / 2, y: HEIGHT / 2, class: "analysis-chart-empty", "text-anchor": "middle" });
    empty.textContent = "Aktiviere ein Wertpapier mit verfügbaren Kursdaten.";
    svg.append(empty);
    description.textContent = "Keine aktiven Kursdaten vorhanden.";
    return;
  }

  const firstDate = chart.dates[0];
  const lastDate = chart.dates.at(-1);
  const maxValue = Math.max(1, ...chart.layers.flatMap((layer) => layer.points.map((point) => point.top ?? 0)));
  const plotBottom = HEIGHT - MARGIN.bottom;
  const plotRight = WIDTH - MARGIN.right;

  for (let index = 0; index <= 4; index += 1) {
    const value = (maxValue / 4) * index;
    const y = scaleValue(value, maxValue);
    svg.append(svgElement("line", { x1: MARGIN.left, x2: plotRight, y1: y, y2: y, class: "analysis-grid-line" }));
    const label = svgElement("text", { x: MARGIN.left - 14, y: y + 4, class: "analysis-axis-label", "text-anchor": "end" });
    label.textContent = formatMoney(value);
    svg.append(label);
  }

  const dateLabels = [firstDate, chart.dates[Math.floor((chart.dates.length - 1) / 2)], lastDate];
  [...new Set(dateLabels)].forEach((date) => {
    const x = scaleDate(date, firstDate, lastDate);
    const label = svgElement("text", { x, y: plotBottom + 32, class: "analysis-axis-label", "text-anchor": "middle" });
    label.textContent = formatDate(date);
    svg.append(label);
  });

  chart.layers.forEach((layer) => {
    const points = layer.points.filter((point) => point.value !== null);
    if (!points.length) return;

    const area = svgElement("path", {
      d: buildAreaPath(points, firstDate, lastDate, maxValue),
      fill: layer.color,
      class: "analysis-area",
    });
    const line = svgElement("path", {
      d: buildLinePath(points, firstDate, lastDate, maxValue),
      stroke: layer.color,
      class: "analysis-area-line",
    });
    svg.append(area, line);

    const legendItem = document.createElement("span");
    const swatch = document.createElement("i");
    swatch.className = `analysis-color-${getAnalysisColorIndex(layer.color)}`;
    legendItem.append(swatch, document.createTextNode(layer.name));
    legend.append(legendItem);
  });

  description.textContent = `${chart.layers.length} aktive Wertpapiere von ${formatDate(firstDate)} bis ${formatDate(lastDate)}.`;
}
