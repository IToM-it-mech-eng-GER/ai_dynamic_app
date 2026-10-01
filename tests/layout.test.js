import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesUrl = new URL("../styles.css", import.meta.url);

test("der Assistentenrahmen erzeugt keinen zweiten Scrollbereich", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  const viewportRule = styles.match(/\.wizard-viewport\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.match(viewportRule, /overflow:\s*clip\s*;/);
});
