import assert from "node:assert/strict";
import test from "node:test";
import { renderAnalysisChart } from "../js/analysis-chart.js";

test("zeigt einen einzigen vorhandenen Kurswert als sichtbaren Punkt mit Wert und Datum", () => {
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.attributes = {}; }
    setAttribute(key, value) { this.attributes[key] = value; }
    append(...children) { this.children.push(...children); }
    replaceChildren() { this.children = []; }
  }
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElementNS: (_, tag) => new Element(tag),
    createElement: tag => new Element(tag),
    createTextNode: text => ({ textContent: text }),
  };
  try {
    const svg = new Element("svg");
    renderAnalysisChart(svg, new Element("div"), new Element("p"), [{ id: "test", wkn: "A2QA4J", active: true,
      purchaseDate: "2025-03-14", purchasePrice: 75.26, quantity: 30,
      prices: [{ date: "2025-03-14", close: 75.5 }], instrument: { name: "Testaktie" } }]);
    const point = svg.children.find(child => child.tag === "circle");
    assert.ok(point, "Ein einzelner Wert benötigt einen sichtbaren Punkt");
    assert.ok(Number(point.attributes.r) >= 4);
    assert.match(point.children[0].textContent, /Testaktie/);
    assert.match(point.children[0].textContent, /2025/);
  } finally {
    globalThis.document = originalDocument;
  }
});
