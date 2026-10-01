const DEFAULT_SCENARIO = Object.freeze({
  currentAge: 37,
  retirementAge: 67,
  lifeExpectancy: 85,
  depotType: "pension",
  statutoryPensionMonthly: 0,
  taxAssessment: "single",
  partialExemptionRate: 30,
  withdrawalEnabled: true,
  withdrawalAmount: 1_000,
  withdrawalFrequency: "monthly",
  withdrawalType: "euro",
  postRetirementReturn: 4,
  inflationEnabled: true,
  inflationRate: 2,
  rebalancingEnabled: true,
  rebalancingReduction: 0.5,
  fundSwitchEnabled: true,
  fundSwitchAge: 62,
  fundSwitchPercentage: 100,
  personalTaxEnabled: true,
  marginalTaxRate: 35,
  socialContributionsEnabled: true,
  saverAllowance: 0,
  baseRate: 3.2,
  taxDisabled: false,
  solidarityEnabled: true,
});

export function createScenario() {
  return { ...DEFAULT_SCENARIO };
}

export function normalizeScenario(values = {}) {
  const currentAge = normalizeInteger(values.currentAge, DEFAULT_SCENARIO.currentAge, 18, 99);
  const retirementAge = normalizeInteger(
    values.retirementAge,
    DEFAULT_SCENARIO.retirementAge,
    currentAge + 1,
    100,
  );
  const lifeExpectancy = normalizeInteger(
    values.lifeExpectancy,
    DEFAULT_SCENARIO.lifeExpectancy,
    retirementAge + 1,
    110,
  );
  const depotType = normalizeChoice(
    values.depotType,
    ["pension", "private"],
    DEFAULT_SCENARIO.depotType,
  );
  const taxAssessment = normalizeChoice(
    values.taxAssessment,
    ["single", "joint"],
    DEFAULT_SCENARIO.taxAssessment,
  );
  const saverAllowanceLimit = depotType === "private"
    ? (taxAssessment === "joint" ? 2_000 : 1_000)
    : 10_000;

  return {
    currentAge,
    retirementAge,
    lifeExpectancy,
    depotType,
    statutoryPensionMonthly: normalizeNumber(
      values.statutoryPensionMonthly,
      DEFAULT_SCENARIO.statutoryPensionMonthly,
      0,
      100_000,
    ),
    taxAssessment,
    partialExemptionRate: normalizeNumber(
      values.partialExemptionRate,
      DEFAULT_SCENARIO.partialExemptionRate,
      0,
      80,
    ),
    withdrawalEnabled: normalizeBoolean(values.withdrawalEnabled, DEFAULT_SCENARIO.withdrawalEnabled),
    withdrawalAmount: normalizeNumber(values.withdrawalAmount, DEFAULT_SCENARIO.withdrawalAmount, 0, 100_000),
    withdrawalFrequency: normalizeChoice(values.withdrawalFrequency, ["monthly", "yearly"], DEFAULT_SCENARIO.withdrawalFrequency),
    withdrawalType: normalizeChoice(values.withdrawalType, ["euro", "percent"], DEFAULT_SCENARIO.withdrawalType),
    postRetirementReturn: normalizeNumber(values.postRetirementReturn, DEFAULT_SCENARIO.postRetirementReturn, -50, 30),
    inflationEnabled: normalizeBoolean(values.inflationEnabled, DEFAULT_SCENARIO.inflationEnabled),
    inflationRate: normalizeNumber(values.inflationRate, DEFAULT_SCENARIO.inflationRate, 0, 15),
    rebalancingEnabled: normalizeBoolean(values.rebalancingEnabled, DEFAULT_SCENARIO.rebalancingEnabled),
    rebalancingReduction: normalizeNumber(values.rebalancingReduction, DEFAULT_SCENARIO.rebalancingReduction, 0, 10),
    fundSwitchEnabled: normalizeBoolean(values.fundSwitchEnabled, DEFAULT_SCENARIO.fundSwitchEnabled),
    fundSwitchAge: normalizeInteger(values.fundSwitchAge, DEFAULT_SCENARIO.fundSwitchAge, currentAge, retirementAge),
    fundSwitchPercentage: normalizeNumber(values.fundSwitchPercentage, DEFAULT_SCENARIO.fundSwitchPercentage, 0, 100),
    personalTaxEnabled: normalizeBoolean(values.personalTaxEnabled, DEFAULT_SCENARIO.personalTaxEnabled),
    marginalTaxRate: normalizeNumber(values.marginalTaxRate, DEFAULT_SCENARIO.marginalTaxRate, 0, 60),
    socialContributionsEnabled: normalizeBoolean(values.socialContributionsEnabled, DEFAULT_SCENARIO.socialContributionsEnabled),
    saverAllowance: normalizeNumber(
      values.saverAllowance,
      DEFAULT_SCENARIO.saverAllowance,
      0,
      saverAllowanceLimit,
    ),
    baseRate: normalizeNumber(values.baseRate, DEFAULT_SCENARIO.baseRate, 0, 20),
    taxDisabled: normalizeBoolean(values.taxDisabled, DEFAULT_SCENARIO.taxDisabled),
    solidarityEnabled: normalizeBoolean(values.solidarityEnabled, DEFAULT_SCENARIO.solidarityEnabled),
  };
}

export function moveWizardStep(currentStep, direction) {
  const step = normalizeInteger(currentStep, 0, 0, 5);
  return clamp(step + Math.sign(Number(direction) || 0), 0, 5);
}

export function getSwipeStep(deltaX, deltaY) {
  const horizontal = Number(deltaX) || 0;
  const vertical = Math.abs(Number(deltaY) || 0);
  if (Math.abs(horizontal) < 50 || Math.abs(horizontal) <= vertical * 1.25) return 0;
  return horizontal > 0 ? -1 : 1;
}

function normalizeBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeChoice(value, choices, fallback) {
  return choices.includes(value) ? value : fallback;
}

function normalizeInteger(value, fallback, minimum, maximum) {
  return Math.round(normalizeNumber(value, fallback, minimum, maximum));
}

function normalizeNumber(value, fallback, minimum, maximum) {
  const number = Number(typeof value === "string" ? value.trim().replace(",", ".") : value);
  return clamp(Number.isFinite(number) ? number : fallback, minimum, maximum);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
