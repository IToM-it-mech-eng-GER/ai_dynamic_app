const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const WIDTH = 900;
const HEIGHT = 440;
const PADDING = Object.freeze({ top: 28, right: 78, bottom: 54, left: 82 });

const compactCurrency = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});
const monthlyCurrency = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function getMonthlyNetPayment({ product, result }) {
  const scenario = product?.scenario;
  if (!scenario?.withdrawalEnabled) return 0;

  const amount = Math.max(0, Number(scenario.withdrawalAmount) || 0);
  const baseAmount = scenario.withdrawalType === "percent"
    ? Math.max(0, Number(result?.retirementBalance) || 0) * amount / 100
    : amount;
  const isAnnualAmount = scenario.withdrawalType === "percent" || scenario.withdrawalFrequency === "yearly";
  return isAnnualAmount ? baseAmount / 12 : baseAmount;
}

export function renderChart(svg, plans) {
  svg.replaceChildren();

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const startAge = plans[0].result.series[0].age;
  const endAge = Math.max(...plans.map(({ result }) => result.series.at(-1).age));
  const horizon = Math.max(1, endAge - startAge);
  const maximum = getNiceMaximum(
    plans.flatMap(({ result }) => result.series.flatMap((point) => [point.balance, point.contributed])),
  );
  const monthlyNetPayments = plans.map(getMonthlyNetPayment);
  const paymentMaximum = monthlyNetPayments.some((payment) => payment > 0)
    ? getNiceMaximum(monthlyNetPayments)
    : 0;

  renderGrid(svg, maximum, startAge, endAge, plotWidth, plotHeight);
  if (paymentMaximum > 0) renderPaymentAxis(svg, paymentMaximum, plotWidth, plotHeight);

  for (const plan of plans) {
    const { product, result } = plan;
    const linePath = createLinePath(result.series, "balance", startAge, horizon, maximum, plotWidth, plotHeight);
    const contributionPath = createLinePath(result.series, "contributed", startAge, horizon, maximum, plotWidth, plotHeight);
    const lastPoint = result.series.at(-1);
    const endX = scaleX(lastPoint.age - startAge, horizon, plotWidth);
    const endY = scaleY(lastPoint.balance, maximum, plotHeight);

    svg.append(
      createSvgElement("path", {
        class: "chart-area",
        d: `${linePath} L ${endX} ${PADDING.top + plotHeight} L ${PADDING.left} ${PADDING.top + plotHeight} Z`,
        fill: product.color,
      }),
      createSvgElement("path", {
        class: "chart-line",
        d: linePath,
        stroke: product.color,
        "vector-effect": "non-scaling-stroke",
      }),
      createSvgElement("path", {
        class: "chart-contribution-line",
        d: contributionPath,
        stroke: product.color,
        "vector-effect": "non-scaling-stroke",
      }),
      createSvgElement("circle", {
        class: "chart-endpoint",
        cx: endX,
        cy: endY,
        r: 5,
        stroke: product.color,
        "vector-effect": "non-scaling-stroke",
      }),
    );

    const monthlyNetPayment = getMonthlyNetPayment(plan);
    if (monthlyNetPayment > 0) {
      const retirementX = scaleX(product.scenario.retirementAge - startAge, horizon, plotWidth);
      const paymentY = scaleY(monthlyNetPayment, paymentMaximum, plotHeight);
      svg.append(createSvgElement("path", {
        class: "chart-payment-line",
        d: `M ${retirementX} ${paymentY} L ${endX} ${paymentY}`,
        stroke: product.color,
        "vector-effect": "non-scaling-stroke",
      }));
    }
  }
}

function renderPaymentAxis(svg, maximum, plotWidth, plotHeight) {
  const axisX = PADDING.left + plotWidth;
  svg.append(createSvgElement(
    "text",
    {
      class: "chart-payment-axis-title",
      x: axisX + 14,
      y: PADDING.top - 10,
      "text-anchor": "start",
    },
    "€/Monat",
  ));

  for (let index = 0; index <= 4; index += 1) {
    const ratio = index / 4;
    const y = PADDING.top + plotHeight - ratio * plotHeight;
    svg.append(
      createSvgElement("line", {
        class: "chart-payment-tick",
        x1: axisX,
        x2: axisX + 6,
        y1: y,
        y2: y,
      }),
      createSvgElement(
        "text",
        {
          class: "chart-payment-axis-label",
          x: axisX + 10,
          y: y + 4,
          "text-anchor": "start",
        },
        monthlyCurrency.format(ratio * maximum),
      ),
    );
  }
}

function renderGrid(svg, maximum, startAge, endAge, plotWidth, plotHeight) {
  for (let index = 0; index <= 4; index += 1) {
    const ratio = index / 4;
    const y = PADDING.top + plotHeight - ratio * plotHeight;
    const value = ratio * maximum;

    svg.append(
      createSvgElement("line", {
        class: "chart-grid-line",
        x1: PADDING.left,
        x2: PADDING.left + plotWidth,
        y1: y,
        y2: y,
      }),
      createSvgElement(
        "text",
        {
          class: "chart-axis-label",
          x: PADDING.left - 14,
          y: y + 4,
          "text-anchor": "end",
        },
        compactCurrency.format(value),
      ),
    );
  }

  const ageTicks = [...new Set([0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(startAge + (endAge - startAge) * ratio)))];

  for (const age of ageTicks) {
    const x = scaleX(age - startAge, endAge - startAge, plotWidth);
    svg.append(
      createSvgElement(
        "text",
        {
          class: "chart-axis-label",
          x,
          y: HEIGHT - 18,
          "text-anchor": age === startAge ? "start" : age === endAge ? "end" : "middle",
        },
        `${age} J.`,
      ),
    );
  }
}

function createLinePath(series, key, startAge, horizon, maximum, plotWidth, plotHeight) {
  return series
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command} ${scaleX(point.age - startAge, horizon, plotWidth)} ${scaleY(point[key], maximum, plotHeight)}`;
    })
    .join(" ");
}

function scaleX(year, horizon, plotWidth) {
  return PADDING.left + (year / horizon) * plotWidth;
}

function scaleY(value, maximum, plotHeight) {
  return PADDING.top + plotHeight - (value / maximum) * plotHeight;
}

function getNiceMaximum(values) {
  const maximum = Math.max(1, ...values);
  const rawStep = maximum / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * magnitude * 4;
}

function createSvgElement(tagName, attributes, text = "") {
  const element = document.createElementNS(SVG_NAMESPACE, tagName);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  if (text) element.textContent = text;
  return element;
}
