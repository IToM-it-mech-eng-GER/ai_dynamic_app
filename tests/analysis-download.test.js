import assert from "node:assert/strict";
import test from "node:test";
import { downloadAnalysisSections } from "../js/analysis-download.js";

const security = { id: "one", wkn: "A2QA4J", purchaseDate: "2025-03-14", purchasePrice: 75.26,
  quantity: 30, instrument: { symbol: "PLTR", type: "Common Stock" } };

test("wartet nach jeder einzelnen Antwort auf Speicherung und Anzeige vor dem nächsten Abruf", async () => {
  const checkpoints = [];
  const requested = [];
  const result = await downloadAnalysisSections(security, ["prices", "income", "balance"], {
    async fetchSection(current, sections) {
      assert.equal(sections.length, 1);
      assert.equal(checkpoints.length, requested.length, "Vor dem nächsten Abruf muss die vorige Antwort gespeichert und angezeigt sein");
      requested.push(sections[0]);
      if (sections[0] === "prices") return { prices: [{ date: "2025-03-14", close: 75.5 }] };
      assert.equal(current.prices.length, 1);
      if (sections[0] === "income") return { fundamentals: [{ year: 2025, revenue: 1000 }] };
      assert.equal(current.fundamentals[0].revenue, 1000);
      return { fundamentals: [{ year: 2025, debt: 250 }] };
    },
    async onResponse(current) {
      await new Promise(resolve => setTimeout(resolve, 0));
      checkpoints.push(structuredClone(current));
    },
  });
  assert.deepEqual(requested, ["prices", "income", "balance"]);
  assert.equal(checkpoints[0].prices.length, 1);
  assert.equal(checkpoints[1].fundamentals[0].revenue, 1000);
  assert.equal(checkpoints[2].fundamentals[0].debt, 250);
  assert.equal(result.security.fundamentals[0].revenue, 1000);
});

test("zeigt auch fehlgeschlagene Teilantworten an und behält die zuvor geladenen Zahlen", async () => {
  const checkpoints = [];
  const result = await downloadAnalysisSections(security, ["prices", "income", "balance"], {
    async fetchSection(_, [section]) {
      if (section === "prices") return { prices: [{ date: "2025-03-14", close: 75.5 }] };
      if (section === "income") throw new Error("Anbieterlimit erreicht");
      return { fundamentals: [{ year: 2025, cash: 500 }] };
    },
    async onResponse(current, outcome) { checkpoints.push({ current, outcome }); },
  });
  assert.equal(checkpoints.length, 3);
  assert.equal(checkpoints[1].outcome.received, false);
  assert.match(checkpoints[1].outcome.warnings.join(" "), /Anbieterlimit/);
  assert.equal(result.security.prices.length, 1);
  assert.equal(result.security.fundamentals[0].cash, 500);
  assert.match(result.security.warnings.join(" "), /Anbieterlimit/);
});

test("startet keinen weiteren Abruf, wenn eine Teilantwort nicht gespeichert werden kann", async () => {
  let calls = 0;
  await assert.rejects(downloadAnalysisSections(security, ["prices", "income"], {
    async fetchSection() { calls += 1; return { prices: [{ date: "2025-03-14", close: 75.5 }] }; },
    async onResponse() { throw new Error("Speichern fehlgeschlagen"); },
  }), /Speichern fehlgeschlagen/);
  assert.equal(calls, 1);
});

test("führt bei einer Auswahl nur einen Teilabruf aus und überspringt Fundamentaldaten bei ETFs", async () => {
  const requested = [];
  const options = {
    async fetchSection(_, sections) { requested.push(sections); return { instrument: { type: "ETF" } }; },
    async onResponse() {},
  };
  await downloadAnalysisSections(security, ["prices"], options);
  assert.deepEqual(requested, [["prices"]]);
  requested.length = 0;
  await downloadAnalysisSections(security, ["prices", "income", "balance", "cashflow"], options);
  assert.deepEqual(requested, [["prices"]]);
});
