import { expect } from "@playwright/test";

export const root = "/mangoidiots-solitaire/";
export const storageKey = `mangoidiots-solitaire:${root}`;
export async function loaded(page) {
  await page.goto(root);
  await expect(page.locator("#loading")).toBeHidden({ timeout: 40000 });
  await expect(page.locator("#offline-status")).toHaveText("Ready offline");
}
export async function start(page) { await loaded(page); await page.locator("#resume").click(); }
export async function readSave(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open(`mangoidiots-solitaire:${new URL(document.baseURI).pathname}`, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction("state").objectStore("state").get("current");
      read.onsuccess = () => { db.close(); resolve(read.result); };
      read.onerror = () => reject(read.error);
    };
  }));
}
export async function layout(page) {
  const box = await page.locator("#board canvas").boundingBox();
  const geometry = JSON.parse(await page.locator("#board canvas").getAttribute("data-layout"));
  const piles = Object.fromEntries(Object.entries(geometry.piles).map(([id, rect]) => [id,
    { ...rect, x: box.x + rect.x, y: box.y + rect.y }]));
  const width = geometry.cardWidth;
  return {
    box, width, height: geometry.cardHeight, piles, geometry,
    x: (column) => piles[`t${column}`].x,
    top: piles.stock.y, tableau: piles.t0.y,
    faceStep: geometry.faceStep, backStep: geometry.columns[0].backStep,
  };
}
export async function stockClick(page) {
  const l = await layout(page);
  await page.mouse.click(l.piles.stock.x + l.width / 2, l.piles.stock.y + l.height / 2);
}
export async function fixture(page, change, value) {
  await page.goto("/__test__/blank");
  await page.evaluate(async ({ source, value }) => {
    // Test-only code, evaluated on the harness homepage, never part of the game.
    const modify = new Function("current", "value", source);
    await new Promise((resolve, reject) => {
      const request = indexedDB.open("mangoidiots-solitaire:/mangoidiots-solitaire/", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction("state", "readwrite");
        const store = tx.objectStore("state"), read = store.get("current");
        read.onsuccess = () => store.put(modify(read.result, value), "current");
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => reject(tx.error);
      };
    });
  }, { source: change, value });
  await loaded(page);
}
