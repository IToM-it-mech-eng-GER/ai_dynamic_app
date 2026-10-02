import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesUrl = new URL("../styles.css", import.meta.url);
const indexUrl = new URL("../index.html", import.meta.url);
const appUrl = new URL("../js/app.js", import.meta.url);

test("der Assistentenrahmen erzeugt keinen zweiten Scrollbereich", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  const viewportRule = styles.match(/\.wizard-viewport\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(viewportRule, /overflow:\s*clip\s*;/);
});

test("der Assistent bleibt innerhalb des Parameterbereichs", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  const panelRule = styles.match(/(?:^|\n)\.settings-panel\s*\{([^}]*)\}/)?.[1] ?? "";
  const viewportRule = styles.match(/\.wizard-viewport\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(panelRule, /overflow:\s*clip\s*;/);
  assert.match(viewportRule, /min-width:\s*0\s*;/);
  assert.match(viewportRule, /width:\s*100%\s*;/);
});

test("die Nettoentnahme lässt sich in Ein-Euro-Schritten einstellen", async () => {
  const html = await readFile(indexUrl, "utf8");
  const withdrawalInput = html.match(/<input id="withdrawal-amount"[^>]*>/)?.[0] ?? "";

  assert.match(withdrawalInput, /step="1"/);
});

test("die zusätzliche Plan-Auswahl wird nicht angezeigt", async () => {
  const html = await readFile(indexUrl, "utf8");

  assert.doesNotMatch(html, /id="product-tabs"/);
});

test("die aktuelle Diagrammversion wird ohne alten Browsercache geladen", async () => {
  const app = await readFile(appUrl, "utf8");

  assert.match(app, /from "\.\/chart\.js\?v=payment-lines1"/);
});

test("das Diagramm schrumpft ohne horizontalen Scrollbereich", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  const scrollRule = styles.match(/\.chart-scroll\s*\{([^}]*)\}/)?.[1] ?? "";
  const chartRule = styles.match(/\.growth-chart\s*\{([^}]*)\}/)?.[1] ?? "";
  const legendRule = styles.match(/\.chart-legend\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(scrollRule, /overflow:\s*hidden\s*;/);
  assert.match(chartRule, /min-width:\s*0\s*;/);
  assert.match(legendRule, /flex-wrap:\s*wrap\s*;/);
});
