import { createAnalysisSecurity, hasAnalysisData, mergeAnalysisSecurityData } from "./analysis-model.js?v=service-check1";

export const ANALYSIS_SECTION_LABELS = {
  prices: "Kursdaten",
  income: "Ergebnisdaten",
  balance: "Bilanzdaten",
  cashflow: "Cashflow-Daten",
};

export async function downloadAnalysisSections(security, sections, { fetchSection, onResponse, onStart = () => {} }) {
  let current = createAnalysisSecurity(security);
  const selected = [...new Set(sections)].filter(section => Object.hasOwn(ANALYSIS_SECTION_LABELS, section));
  const outcomes = [];
  for (const section of selected) {
    if (section !== "prices" && /ETF|ETP|FUND|FONDS/i.test(current.instrument.type)) continue;
    await onStart(section, outcomes.length + 1, selected.length);
    let remote;
    try {
      remote = await fetchSection(current, [section]);
    } catch (error) {
      remote = { warnings: [`${ANALYSIS_SECTION_LABELS[section]}: ${error instanceof Error ? error.message : "Abruf fehlgeschlagen."}`] };
    }
    const received = hasAnalysisData(remote);
    const warnings = Array.isArray(remote.warnings) ? remote.warnings : [];
    if (!received && warnings.length === 0) warnings.push(`${ANALYSIS_SECTION_LABELS[section]}: Keine Zahlenwerte erhalten.`);
    current = mergeAnalysisSecurityData(current, {
      ...remote,
      warnings: [...current.warnings.filter(warning => !warning.startsWith(`${ANALYSIS_SECTION_LABELS[section]}:`)), ...warnings],
    });
    const outcome = { section, received, warnings, prices: remote.prices?.length || 0, years: remote.fundamentals?.length || 0 };
    await onResponse(current, outcome);
    outcomes.push(outcome);
  }
  return { security: current, outcomes };
}
