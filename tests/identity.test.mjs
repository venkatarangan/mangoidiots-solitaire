import test from "node:test";
import assert from "node:assert/strict";
import { gameStorageKey } from "../src/identity.ts";

test("storage identity follows the deployed Pages scope", () => {
  const projectSite = new URL("https://venkatarangan.github.io/mangoidiots-solitaire/");
  const customDomain = new URL("https://solitaire.mangoidiots.com/");
  assert.equal(gameStorageKey(projectSite), "mangoidiots-solitaire:/mangoidiots-solitaire/");
  assert.equal(gameStorageKey(customDomain), "mangoidiots-solitaire:/");
});

test("storage key creation does not mutate the live application URL", () => {
  const base = new URL("https://venkatarangan.github.io/mangoidiots-solitaire/");
  const before = base.href;
  gameStorageKey(base);
  assert.equal(base.href, before);
});
